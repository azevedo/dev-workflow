#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VERDICT_CODE = { PASS: 0, FAIL: 1, UNKNOWN: 2 };

function formatRecord(r) {
  const loc = r.line != null ? `${r.file}:${r.line}` : r.file;
  return `${r.invariant} — ${loc} — ${r.message}`;
}

// FAIL outranks UNKNOWN — a broken invariant must read as "broken", not "couldn't tell".
function verdictForRecords(records) {
  if (records.some((r) => r.verdict === 'FAIL')) return 'FAIL';
  if (records.some((r) => r.verdict === 'UNKNOWN')) return 'UNKNOWN';
  return 'PASS';
}

function exitCodeForRecords(records) {
  return VERDICT_CODE[verdictForRecords(records)];
}

function usage() {
  return 'Usage: check-invariants.mjs [--only <id>] [--root <dir>]';
}

function parseArgs(argv) {
  const opts = { only: null, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') opts.only = argv[++i];
    else if (a === '--root') opts.root = argv[++i];
    else {
      console.error(`Unknown flag: ${a}\n${usage()}`);
      return null;
    }
  }
  return opts;
}

// Returns an error result rather than throwing, so callers can produce a named UNKNOWN record.
function readLines(root, relPath) {
  try {
    const text = fs.readFileSync(path.join(root, relPath), 'utf8');
    return { lines: text.split('\n') };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

// Recursive so one helper serves both the flat agents/ and the nested commands/ba/;
// returns an error result rather than throwing on a missing relDir.
function walkMarkdown(root, relDir) {
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
    } catch (err) {
      throw { relDir: dir, error: String((err && err.message) || err) };
    }
    for (const entry of entries) {
      const relPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(relPath);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relPath);
    }
  }
  try {
    walk(relDir);
  } catch (e) {
    return { error: e.error, relDir: e.relDir };
  }
  files.sort();
  return { files };
}

const SENTINEL_CORPUS_DIRS = ['commands', 'agents'];
const ALLOWED_AUTO_SCORE_KEYWORDS = new Set(['clean', 'weak', 'error']);

function fenceMatch(line) {
  const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!m) return null;
  return { char: m[1][0], length: m[1].length };
}

// Only its own consumer (the heredoc sub-assertion) needs fence boundaries, so it lives here.
// Tracks fence character and run length (not just "inside a fence") because the corpus has
// four-backtick fences containing nested three-backtick fences — a length-blind scanner would
// close on the inner fence and mis-split the region.
function fencedRegions(lines) {
  const regions = [];
  const unterminated = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    if (!open) {
      const m = fenceMatch(lines[i]);
      if (m) open = { ...m, start: i };
      continue;
    }
    const trimmed = lines[i].trim();
    const isCloser =
      trimmed.length > 0 &&
      trimmed.length >= open.length &&
      [...trimmed].every((c) => c === open.char);
    if (isCloser) {
      regions.push({ start: open.start, end: i });
      open = null;
    }
  }
  if (open) unterminated.push(open.start);
  return { regions, unterminated };
}

function loadCorpus(opts, dirs) {
  const files = [];
  const errorRecords = [];
  for (const dir of dirs) {
    const res = walkMarkdown(opts.root, dir);
    if (res.error) {
      errorRecords.push({
        invariant: 'sentinels',
        file: dir,
        line: null,
        verdict: 'UNKNOWN',
        message: `cannot list directory: ${res.error}`,
      });
      continue;
    }
    files.push(...res.files);
  }
  return { files, errorRecords };
}

function autoScoreKeywordAgreement(opts, corpus) {
  const records = [];
  const participants = [];
  for (const file of corpus) {
    const lr = readLines(opts.root, file);
    if (lr.error) {
      records.push({
        invariant: 'sentinels',
        file,
        line: null,
        verdict: 'UNKNOWN',
        message: `cannot read file: ${lr.error}`,
      });
      continue;
    }
    const keywords = new Map();
    lr.lines.forEach((line, idx) => {
      const re = /\[AUTO-SCORE:\s*([a-z]+)/g;
      let m;
      while ((m = re.exec(line))) {
        if (!keywords.has(m[1])) keywords.set(m[1], idx + 1);
      }
    });
    if (keywords.size > 0) participants.push({ file, keywords });
  }

  if (participants.length < 2) {
    records.push({
      invariant: 'sentinels',
      file: SENTINEL_CORPUS_DIRS.join(', '),
      line: null,
      verdict: 'UNKNOWN',
      message: `expected an emitter and a parser, found ${participants.length}`,
    });
    return { records, participantCount: participants.length };
  }

  for (const p of participants) {
    for (const [kw, line] of p.keywords) {
      if (!ALLOWED_AUTO_SCORE_KEYWORDS.has(kw)) {
        records.push({
          invariant: 'sentinels',
          file: p.file,
          line,
          verdict: 'FAIL',
          message: `[AUTO-SCORE: ${kw}] is outside {clean, weak, error}`,
        });
      }
    }
  }

  for (const a of participants) {
    for (const b of participants) {
      if (a === b) continue;
      for (const [kw, bLine] of b.keywords) {
        if (!a.keywords.has(kw)) {
          records.push({
            invariant: 'sentinels',
            file: a.file,
            line: bLine,
            verdict: 'FAIL',
            message: `keyword set differs from ${b.file}: missing '${kw}' (present at ${b.file}:${bLine})`,
          });
        }
      }
    }
  }

  return { records, participantCount: participants.length };
}

function heredocFencePairing(opts, corpus) {
  const records = [];
  let openerCount = 0;
  for (const file of corpus) {
    const lr = readLines(opts.root, file);
    if (lr.error) continue; // already reported by autoScoreKeywordAgreement's read of the same file
    const { regions, unterminated } = fencedRegions(lr.lines);
    for (const startLine of unterminated) {
      records.push({
        invariant: 'sentinels',
        file,
        line: startLine + 1,
        verdict: 'UNKNOWN',
        message: 'fence opened here is never closed before EOF',
      });
    }
    lr.lines.forEach((line, idx) => {
      const m = line.match(/<<'([^']+)'/);
      if (!m) return;
      openerCount++;
      const token = m[1];
      const region = regions.find((r) => idx > r.start && idx < r.end);
      if (!region) {
        records.push({
          invariant: 'sentinels',
          file,
          line: idx + 1,
          verdict: 'FAIL',
          message: `heredoc opener <<'${token}' is not inside a fenced code block`,
        });
        return;
      }
      let terminators = 0;
      for (let i = region.start + 1; i < region.end; i++) {
        if (lr.lines[i].trim() === token) terminators++;
      }
      if (terminators !== 1) {
        records.push({
          invariant: 'sentinels',
          file,
          line: idx + 1,
          verdict: 'FAIL',
          message: `heredoc opener <<'${token}' has ${terminators} terminator(s) in its fence, expected exactly 1`,
        });
      }
    });
  }
  if (openerCount === 0) {
    records.push({
      invariant: 'sentinels',
      file: SENTINEL_CORPUS_DIRS.join(', '),
      line: null,
      verdict: 'UNKNOWN',
      message: 'no heredoc openers found in the corpus',
    });
  }
  return { records, openerCount };
}

function sentinelsCheck(opts) {
  const { files: corpus, errorRecords } = loadCorpus(opts, SENTINEL_CORPUS_DIRS);
  const a = autoScoreKeywordAgreement(opts, corpus);
  const b = heredocFencePairing(opts, corpus);
  const records = [...errorRecords, ...a.records, ...b.records];
  return {
    subjectCount: a.participantCount + b.openerCount,
    subjectNoun: 'subjects',
    reason: `${a.participantCount} AUTO-SCORE participant(s), ${b.openerCount} heredoc opener(s)`,
    records,
  };
}

function notImplemented(id) {
  return {
    subjectCount: 0,
    subjectNoun: 'subjects',
    reason: 'check not implemented yet',
    records: [
      {
        invariant: id,
        file: 'scripts/check-invariants.mjs',
        line: null,
        verdict: 'UNKNOWN',
        message: 'check not implemented yet',
      },
    ],
  };
}

const CHECKS = [
  { id: 'sentinels', run: sentinelsCheck },
  { id: 'references', run: () => notImplemented('references') },
  { id: 'version-bump', run: () => notImplemented('version-bump') },
];

function runChecks(opts) {
  const checks = opts.only ? CHECKS.filter((c) => c.id === opts.only) : CHECKS;
  if (opts.only && checks.length === 0) {
    console.error(`Unknown check id: ${opts.only}`);
    return null;
  }
  return checks.map((c) => ({ id: c.id, ...c.run(opts) }));
}

// Every verdict line prints, PASS included, with a mandatory reason — two PASSes with the
// same subject count can mean different things (e.g. version-bump's "not applicable" vs.
// "version bumped"), and an indistinguishable line reintroduces the vacuous green one level up.
function report(results) {
  for (const r of results) {
    const verdict = verdictForRecords(r.records);
    console.log(`${r.id}: ${verdict} (${r.subjectCount} ${r.subjectNoun}) — ${r.reason}`);
  }
  for (const r of results) {
    for (const rec of r.records.filter((x) => x.verdict !== 'PASS')) {
      console.log(formatRecord(rec));
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    process.exitCode = 2;
    return;
  }
  try {
    const results = runChecks(opts);
    if (results === null) {
      process.exitCode = 2;
      return;
    }
    report(results);
    const allRecords = results.flatMap((r) => r.records);
    process.exitCode = exitCodeForRecords(allRecords);
  } catch (err) {
    console.error(String((err && err.stack) || err));
    process.exitCode = 2;
  }
}

main();
