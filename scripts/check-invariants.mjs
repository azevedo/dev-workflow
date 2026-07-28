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
  { id: 'sentinels', run: () => notImplemented('sentinels') },
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
