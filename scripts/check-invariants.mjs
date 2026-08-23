#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VERDICT_CODE = { PASS: 0, FAIL: 1, UNKNOWN: 2 };

function makeRecord(invariant, file, line, verdict, message) {
  return { invariant, file, line, verdict, message };
}

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

// Recursive so one helper serves both the flat agents/ and the nested skills/ba-*/SKILL.md;
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

const PROMPT_SURFACE_DIRS = ['skills', 'agents'];
const VERSION_BUMP_WATCHED_PREFIXES = [...PROMPT_SURFACE_DIRS, 'references'].map((d) => `${d}/`);
const ALLOWED_AUTO_SCORE_KEYWORDS = new Set(['clean', 'weak', 'error']);

// A stale colon invocation does not throw — it burns a round-trip while the model narrates "run it
// yourself" — so only a standing check catches a reintroduction.
const RETIRED_INVOCATION_NEEDLES = ['/ba:', 'commands/ba/'];
// docs/ is excluded by construction, not by allowlist; scripts/ so this cannot flag the line above.
const RETIRED_INVOCATION_DIRS = [...PROMPT_SURFACE_DIRS, 'references', '.claude/agent_docs'];
const RETIRED_INVOCATION_FILES = ['README.md', 'CLAUDE.md'];

// The agents cite this section by title; renaming it here without updating them leaves a dangling
// citation that raises no error at dispatch — reviewers self-supply a plausible bullet shape from
// their own ## Output Format, so the loss is silent.
const RUBRIC_OWNER_FILE = 'skills/ba-review/SKILL.md';
const RUBRIC_SECTION_HEADING = '## Code-Anchor & Confidence Grammar';
// The two skills that state the legal confidence set in their own dispatch grammar. Declared
// standalone rather than by widening PROMPT_SURFACE_DIRS, which sentinels, references, and
// retired-invocations all share — widening it would silently change three existing corpora.
const RUBRIC_MIRROR_FILES = [RUBRIC_OWNER_FILE, 'skills/ba-review-plan/SKILL.md'];
// A dir + suffix pair rather than a glob, since loadCorpus(dirs) cannot express one.
// A load-site sentence duplicated across sites is a machine-boundary contract: the copies must be
// byte-identical, and an occurrence count cannot detect two copies diverging (the plan that
// introduced this pair claimed identity while checking a single substring's count).
const LOAD_SITE_FILE = 'skills/ba-review/SKILL.md';
const LOAD_SITE_ANCHOR = '**Load site — persist run artifacts.**';

// The reviewer model pins. `security-reviewer` follows the session model deliberately — the stakes
// carve-out — and every other reviewer stays pinned so an eight-way fan-out stays cheap by default.
// Pinned here because nothing else reads agent frontmatter: `comment-quality-reviewer` shipped at
// `sonnet` while its own plan specified `inherit`, and no check noticed.
const AGENT_MODEL_EXPECTED_DEFAULT = 'sonnet';
const AGENT_MODEL_EXCEPTIONS = new Map([['security-reviewer.md', 'inherit']]);
// Diagnostic only: locates any `model:` key so a FAIL can name the offending line. The assertion is
// the exact expected value.
const AGENT_MODEL_ANY_VALUE = /^model:\s*(.*)$/;

// The `model:<value>` contract is stated once per review skill, on each skill's always-executed
// parse path — duplication chosen over a shared reference file, which would cost a Read on every
// invocation. That trade is only safe if the copies cannot drift, so they are pinned here.
// Per-skill divergences (scan ordering, the never-scan surface, discovered externals, the
// AUTO-SCORE clause) deliberately sit outside the anchors, so the pinned span needs no exception
// list.
const TOKEN_GRAMMAR_FILES = ['skills/ba-review/SKILL.md', 'skills/ba-review-plan/SKILL.md'];
const TOKEN_GRAMMAR_SPANS = [
  { name: 'model-token-grammar', start: '<!-- model-token-grammar:start -->', end: '<!-- model-token-grammar:end -->' },
  { name: 'model-resolution', start: '<!-- model-resolution:start -->', end: '<!-- model-resolution:end -->' },
];

const RUBRIC_AGENT_DIR = 'agents';
const RUBRIC_AGENT_SUFFIX = '-reviewer.md';
// A machine-boundary literal: Step 4's parser and every dispatched reviewer must agree on it exactly.
// Not whitespace-normalised — spacing drift is what a hand-maintained mirror loses first.
const RUBRIC_VALUE_SET_LITERAL = 'N ∈ {0, 25, 50, 75, 100}';
// Diagnostic only: locates each candidate spelling so a FAIL can name the offending line. The
// assertion is the exact literal above.
const RUBRIC_VALUE_SET_ANY_SPELLING = /N\s*∈\s*\{[^}]*\}/;
// A dispatch template becomes the entire context of a fresh subagent, so the literal has to sit
// inside each Task block — not merely somewhere in the file. A file-level test is satisfied by
// whichever copy is still right, which is how a `general-purpose` template shipped reaching its
// subagent with no grammar at all while the check stayed green on a sibling's correct copy.
const RUBRIC_TASK_BLOCK_ANCHOR = /^\s*- Task /;

// Reads the corpus once — both dir listing and file contents — so every check that needs the
// same prompt-surface text shares one read and one error-reporting path, rather than each
// sub-check re-reading files and trusting a sibling to have reported a read failure.
function loadCorpus(opts, dirs, invariant) {
  const files = [];
  const errorRecords = [];
  for (const dir of dirs) {
    const res = walkMarkdown(opts.root, dir);
    if (res.error) {
      errorRecords.push(makeRecord(invariant, dir, null, 'UNKNOWN', `cannot list directory: ${res.error}`));
      continue;
    }
    files.push(...res.files);
  }
  const entries = [];
  for (const file of files) {
    const lr = readLines(opts.root, file);
    if (lr.error) {
      errorRecords.push(makeRecord(invariant, file, null, 'UNKNOWN', `cannot read file: ${lr.error}`));
      continue;
    }
    entries.push({ file, lines: lr.lines });
  }
  return { entries, errorRecords };
}

function fenceMatch(line) {
  const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!m) return null;
  return { char: m[1][0], length: m[1].length };
}

// A closer has the same 0-3-space indentation cap as an opener (CommonMark), plus no info
// string — trimming all leading whitespace before comparing (the prior approach) accepted a
// closer indented arbitrarily far, letting fence *content* that happened to repeat the fence
// character prematurely end the region.
function fenceCloseMatch(line, char, minLength) {
  const re = char === '`' ? /^ {0,3}(`{3,})\s*$/ : /^ {0,3}(~{3,})\s*$/;
  const m = line.match(re);
  return m != null && m[1].length >= minLength;
}

// Tracks fence character and run length (not just "inside a fence") because the corpus has
// four-backtick fences containing nested three-backtick fences — a length-blind scanner would
// close on the inner fence and mis-split the region. A fence still open at EOF still yields a
// region (start..EOF, terminated: false) so a heredoc opener inside it is recognized as "in a
// fence" rather than misreported as bare prose — the fence's own UNKNOWN already covers it.
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
    if (fenceCloseMatch(lines[i], open.char, open.length)) {
      regions.push({ start: open.start, end: i, terminated: true });
      open = null;
    }
  }
  if (open) {
    unterminated.push(open.start);
    regions.push({ start: open.start, end: lines.length, terminated: false });
  }
  return { regions, unterminated };
}

function autoScoreKeywordAgreement(entries) {
  const records = [];
  const participants = [];
  for (const { file, lines } of entries) {
    const keywords = new Map();
    lines.forEach((line, idx) => {
      const re = /\[AUTO-SCORE:\s*([a-z]+)/g;
      let m;
      while ((m = re.exec(line))) {
        if (!keywords.has(m[1])) keywords.set(m[1], idx + 1);
      }
    });
    if (keywords.size > 0) participants.push({ file, keywords });
  }

  if (participants.length < 2) {
    records.push(
      makeRecord(
        'sentinels',
        PROMPT_SURFACE_DIRS.join(', '),
        null,
        'UNKNOWN',
        `expected an emitter and a parser, found ${participants.length}`,
      ),
    );
    return { records, participantCount: participants.length };
  }

  for (const p of participants) {
    for (const [kw, line] of p.keywords) {
      if (!ALLOWED_AUTO_SCORE_KEYWORDS.has(kw)) {
        records.push(makeRecord('sentinels', p.file, line, 'FAIL', `[AUTO-SCORE: ${kw}] is outside {clean, weak, error}`));
      }
    }
  }

  for (const a of participants) {
    for (const b of participants) {
      if (a === b) continue;
      for (const [kw, bLine] of b.keywords) {
        if (!a.keywords.has(kw)) {
          records.push(
            makeRecord(
              'sentinels',
              a.file,
              bLine,
              'FAIL',
              `keyword set differs from ${b.file}: missing '${kw}' (present at ${b.file}:${bLine})`,
            ),
          );
        }
      }
    }
  }

  return { records, participantCount: participants.length };
}

function heredocFencePairing(entries) {
  const records = [];
  let openerCount = 0;
  for (const { file, lines } of entries) {
    const { regions, unterminated } = fencedRegions(lines);
    for (const startLine of unterminated) {
      records.push(makeRecord('sentinels', file, startLine + 1, 'UNKNOWN', 'fence opened here is never closed before EOF'));
    }
    const consumedTerminators = new Set();
    lines.forEach((line, idx) => {
      const m = line.match(/<<'([^']+)'/);
      if (!m) return;
      openerCount++;
      const token = m[1];
      const region = regions.find((r) => idx > r.start && idx < r.end);
      if (!region) {
        records.push(makeRecord('sentinels', file, idx + 1, 'FAIL', `heredoc opener <<'${token}' is not inside a fenced code block`));
        return;
      }
      // An opener inside a fence that's still open at EOF isn't independently mis-terminated —
      // the fence's own "never closed before EOF" UNKNOWN above already names the root cause.
      if (!region.terminated) return;
      let terminators = 0;
      let matchedLine = null;
      for (let i = region.start + 1; i < region.end; i++) {
        if (consumedTerminators.has(i)) continue; // claimed by an earlier opener sharing this token+region
        if (lines[i].trim() === token) {
          terminators++;
          if (matchedLine === null) matchedLine = i;
        }
      }
      if (terminators === 1) {
        consumedTerminators.add(matchedLine);
      } else {
        records.push(
          makeRecord(
            'sentinels',
            file,
            idx + 1,
            'FAIL',
            `heredoc opener <<'${token}' has ${terminators} terminator(s) in its fence, expected exactly 1`,
          ),
        );
      }
    });
  }
  if (openerCount === 0) {
    records.push(makeRecord('sentinels', PROMPT_SURFACE_DIRS.join(', '), null, 'UNKNOWN', 'no heredoc openers found in the corpus'));
  }
  return { records, openerCount };
}

function sentinelsCheck(opts) {
  const { entries, errorRecords } = loadCorpus(opts, PROMPT_SURFACE_DIRS, 'sentinels');
  const a = autoScoreKeywordAgreement(entries);
  const b = heredocFencePairing(entries);
  const records = [...errorRecords, ...a.records, ...b.records];
  return {
    subjectCount: a.participantCount + b.openerCount,
    subjectNoun: 'subjects',
    reason: `${a.participantCount} AUTO-SCORE participant(s), ${b.openerCount} heredoc opener(s)`,
    records,
  };
}

// Top-level only — references/ is flat, and recursing would need walkMarkdown, whose recursion
// this directory has no use for.
function listReferenceFiles(root) {
  try {
    const entries = fs.readdirSync(path.join(root, 'references'), { withFileTypes: true });
    return { files: entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => `references/${e.name}`).sort() };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

function referencesCheck(opts) {
  const records = [];
  const refRes = listReferenceFiles(opts.root);
  if (refRes.error) {
    const message = `cannot list references/: ${refRes.error}`;
    return {
      subjectCount: 0,
      subjectNoun: 'reference files',
      reason: message,
      records: [makeRecord('references', 'references', null, 'UNKNOWN', message)],
    };
  }
  const { entries, errorRecords } = loadCorpus(opts, PROMPT_SURFACE_DIRS, 'references');
  records.push(...errorRecords);

  if (refRes.files.length === 0 || entries.length === 0) {
    records.push(
      makeRecord(
        'references',
        'references',
        null,
        'UNKNOWN',
        `empty references/ glob (${refRes.files.length}) or empty search corpus (${entries.length})`,
      ),
    );
    return { subjectCount: refRes.files.length, subjectNoun: 'reference files', reason: 'no subjects to check', records };
  }

  for (const refFile of refRes.files) {
    const basename = path.basename(refFile);
    // Leading backtick omitted: `references/…` follows a '/' where skill bodies anchor to the plugin
    // root and a backtick where agents/ cite bare — pinning either spelling fails the other.
    const needle = `references/${basename}\``;
    const cited = entries.some(({ lines }) => lines.some((line) => line.includes(needle)));
    if (!cited) {
      records.push(
        makeRecord(
          'references',
          refFile,
          null,
          'FAIL',
          `no citation of \`${refFile}\` found in ${PROMPT_SURFACE_DIRS.join('/, ')}/`,
        ),
      );
    }
  }

  return {
    subjectCount: refRes.files.length,
    subjectNoun: 'reference files',
    reason: `${refRes.files.length} reference file(s) checked against ${entries.length} corpus file(s)`,
    records,
  };
}

function retiredInvocationsCheck(opts) {
  const { entries: dirEntries, errorRecords } = loadCorpus(opts, RETIRED_INVOCATION_DIRS, 'retired-invocations');
  const records = [...errorRecords];
  const fileEntries = [];

  for (const relPath of RETIRED_INVOCATION_FILES) {
    const lr = readLines(opts.root, relPath);
    if (lr.error) {
      records.push(makeRecord('retired-invocations', relPath, null, 'UNKNOWN', `cannot read file: ${lr.error}`));
      continue;
    }
    fileEntries.push({ file: relPath, lines: lr.lines });
  }

  const entries = [...dirEntries, ...fileEntries];

  if (entries.length === 0) {
    const message = 'empty scan corpus';
    records.push(makeRecord('retired-invocations', RETIRED_INVOCATION_DIRS.join(', '), null, 'UNKNOWN', message));
    return { subjectCount: 0, subjectNoun: 'scanned files', reason: message, records };
  }

  for (const { file, lines } of entries) {
    lines.forEach((line, idx) => {
      for (const needle of RETIRED_INVOCATION_NEEDLES) {
        if (line.includes(needle)) {
          records.push(
            makeRecord('retired-invocations', file, idx + 1, 'FAIL', `retired invocation string '${needle}' — use the hyphen form`),
          );
        }
      }
    });
  }

  return {
    subjectCount: entries.length,
    subjectNoun: 'scanned files',
    reason: `${entries.length} file(s) scanned for ${RETIRED_INVOCATION_NEEDLES.join(' and ')}`,
    records,
  };
}

function gitRead(root, args, label) {
  try {
    return { value: execFileSync('git', args, { cwd: root, encoding: 'utf8' }) };
  } catch (err) {
    return { error: `${label} failed: ${String((err && err.message) || err).split('\n')[0]}` };
  }
}

function parsePluginVersion(blobText, label) {
  let parsed;
  try {
    parsed = JSON.parse(blobText);
  } catch (err) {
    return { error: `${label}: plugin.json did not parse as JSON` };
  }
  const version = parsed.version;
  if (typeof version !== 'string' || version.trim() === '') {
    return { error: `${label}: 'version' is missing or not a non-empty string` };
  }
  return { value: version.trim() };
}

// HEAD~1..HEAD is per-commit locally but per-PR in CI, where pull_request checks out a merge commit
// whose first parent is the base tip (see .github/workflows/invariants.yml). So a mid-branch local run
// FAILs on any commit touching a watched path without its own bump — expected, not a defect.
function versionBumpCheck(opts) {
  const unknown = (message) => ({
    subjectCount: 0,
    subjectNoun: 'comparison inputs',
    reason: message,
    records: [makeRecord('version-bump', '.claude-plugin/plugin.json', null, 'UNKNOWN', message)],
  });

  const base = gitRead(opts.root, ['rev-parse', '--verify', 'HEAD~1^{commit}'], 'git rev-parse HEAD~1');
  if (base.error) return unknown(base.error);

  const diff = gitRead(opts.root, ['diff', '--name-only', 'HEAD~1', 'HEAD'], 'git diff --name-only');
  if (diff.error) return unknown(diff.error);
  const changedPaths = diff.value.split('\n').filter(Boolean);
  const touchesWatched = changedPaths.some((p) => VERSION_BUMP_WATCHED_PREFIXES.some((prefix) => p.startsWith(prefix)));

  if (!touchesWatched) {
    const reason = 'not applicable — no prompt-surface paths changed';
    return {
      subjectCount: 3,
      subjectNoun: 'comparison inputs',
      reason,
      records: [makeRecord('version-bump', '.claude-plugin/plugin.json', null, 'PASS', reason)],
    };
  }

  const oldBlob = gitRead(opts.root, ['show', 'HEAD~1:.claude-plugin/plugin.json'], 'git show HEAD~1:.claude-plugin/plugin.json');
  if (oldBlob.error) return unknown(oldBlob.error);
  const newBlob = gitRead(opts.root, ['show', 'HEAD:.claude-plugin/plugin.json'], 'git show HEAD:.claude-plugin/plugin.json');
  if (newBlob.error) return unknown(newBlob.error);

  const oldVersion = parsePluginVersion(oldBlob.value, 'HEAD~1');
  if (oldVersion.error) return unknown(oldVersion.error);
  const newVersion = parsePluginVersion(newBlob.value, 'HEAD');
  if (newVersion.error) return unknown(newVersion.error);

  if (oldVersion.value === newVersion.value) {
    const message = `version unchanged (${oldVersion.value}) while ${VERSION_BUMP_WATCHED_PREFIXES.join(', ')} changed`;
    return {
      subjectCount: 3,
      subjectNoun: 'comparison inputs',
      reason: message,
      records: [makeRecord('version-bump', '.claude-plugin/plugin.json', null, 'FAIL', message)],
    };
  }

  const reason = `version ${oldVersion.value} → ${newVersion.value}`;
  return {
    subjectCount: 3,
    subjectNoun: 'comparison inputs',
    reason,
    records: [makeRecord('version-bump', '.claude-plugin/plugin.json', null, 'PASS', reason)],
  };
}

function rubricMirrorCheck(opts) {
  const records = [];
  const unknown = (file, message) => ({
    subjectCount: 0,
    subjectNoun: 'rubric mirror files',
    reason: message,
    records: [...records, makeRecord('rubric-mirror', file, null, 'UNKNOWN', message)],
  });

  const agentRes = walkMarkdown(opts.root, RUBRIC_AGENT_DIR);
  if (agentRes.error) {
    return unknown(RUBRIC_AGENT_DIR, `cannot list ${RUBRIC_AGENT_DIR}/: ${agentRes.error}`);
  }
  const agentFiles = agentRes.files.filter((f) => f.endsWith(RUBRIC_AGENT_SUFFIX));
  if (agentFiles.length === 0) {
    return unknown(RUBRIC_AGENT_DIR, `no *${RUBRIC_AGENT_SUFFIX} files in ${RUBRIC_AGENT_DIR}/`);
  }

  const corpus = [];
  for (const file of [...RUBRIC_MIRROR_FILES, ...agentFiles]) {
    const lr = readLines(opts.root, file);
    // The owner is the citation target: without it, "does the cited section resolve?" is
    // unanswerable, so its absence is UNKNOWN for the whole check rather than a FAIL.
    if (lr.error && file === RUBRIC_OWNER_FILE) {
      return unknown(file, `cannot read rubric owner ${file}: ${lr.error}`);
    }
    if (lr.error) {
      records.push(makeRecord('rubric-mirror', file, null, 'UNKNOWN', `cannot read file: ${lr.error}`));
      continue;
    }
    corpus.push({ file, lines: lr.lines });
  }

  for (const { file, lines } of corpus) {
    const occurrences = [];
    lines.forEach((line, idx) => {
      const m = line.match(RUBRIC_VALUE_SET_ANY_SPELLING);
      if (m) occurrences.push({ line: idx + 1, spelling: m[0], exact: line.includes(RUBRIC_VALUE_SET_LITERAL) });
    });
    if (occurrences.length === 0) {
      const message = `missing the legal value set \`${RUBRIC_VALUE_SET_LITERAL}\``;
      records.push(makeRecord('rubric-mirror', file, null, 'FAIL', message));
      continue;
    }
    // ba-review and ba-review-plan carry the literal several times — the owning section plus each
    // dispatch template's inline copy — and the template copies are the ones that reach a dispatched
    // subagent. A per-file test would pass a drifted copy while the canonical occurrence stayed right.
    for (const { line, spelling, exact } of occurrences) {
      if (exact) continue;
      const message = `value set spelled \`${spelling}\`, expected \`${RUBRIC_VALUE_SET_LITERAL}\``;
      records.push(makeRecord('rubric-mirror', file, line, 'FAIL', message));
    }
  }

  // The `##` bound, not just the next `- Task `, is what stops the last block in a section from
  // swallowing the rest of the file and passing on a literal that belongs to a later section.
  const taskBlocks = (lines) => {
    const starts = [];
    lines.forEach((line, i) => {
      if (RUBRIC_TASK_BLOCK_ANCHOR.test(line)) starts.push(i);
    });
    return starts.map((start, n) => {
      let end = n + 1 < starts.length ? starts[n + 1] : lines.length;
      for (let j = start + 1; j < end; j += 1) {
        if (lines[j].startsWith('##')) {
          end = j;
          break;
        }
      }
      return { line: start + 1, body: lines.slice(start, end) };
    });
  };

  let blockCount = 0;
  for (const { file, lines } of corpus.filter((e) => RUBRIC_MIRROR_FILES.includes(e.file))) {
    const blocks = taskBlocks(lines);
    // Zero blocks is vacuous, not passing: a mirror file whose templates had been deleted would
    // otherwise report identically to one whose every template carries the literal.
    if (blocks.length === 0) {
      records.push(
        makeRecord('rubric-mirror', file, null, 'UNKNOWN', 'no `- Task ` dispatch block to check'),
      );
      continue;
    }
    blockCount += blocks.length;
    for (const { line, body } of blocks) {
      if (body.some((l) => l.includes(RUBRIC_VALUE_SET_LITERAL))) continue;
      // Only *missing* is reported here. A block whose copy drifted still holds a candidate
      // spelling, and the per-occurrence loop above already FAILs it at the offending line — so
      // the two verdicts stay distinct instead of double-reporting the same drift.
      const spelled = body.some((l) => RUBRIC_VALUE_SET_ANY_SPELLING.test(l));
      const message = spelled
        ? `dispatch block spells the value set inexactly, expected \`${RUBRIC_VALUE_SET_LITERAL}\` inline`
        : `dispatch block is missing the legal value set \`${RUBRIC_VALUE_SET_LITERAL}\``;
      records.push(makeRecord('rubric-mirror', file, line, 'FAIL', message));
    }
  }

  const owner = corpus.find((e) => e.file === RUBRIC_OWNER_FILE);
  const headingIdx = owner.lines.findIndex((line) => line.trimEnd() === RUBRIC_SECTION_HEADING);
  if (headingIdx === -1) {
    records.push(
      makeRecord('rubric-mirror', RUBRIC_OWNER_FILE, null, 'FAIL', `no \`${RUBRIC_SECTION_HEADING}\` heading`),
    );
  }
  // Cited by title, not by heading marker — an agent references the section in prose.
  const citation = RUBRIC_SECTION_HEADING.replace(/^#+\s*/, '');
  for (const { file, lines } of corpus.filter((e) => e.file.endsWith(RUBRIC_AGENT_SUFFIX))) {
    if (!lines.some((line) => line.includes(citation))) {
      records.push(makeRecord('rubric-mirror', file, null, 'FAIL', `no citation of \`${citation}\``));
    }
  }

  return {
    subjectCount: corpus.length,
    subjectNoun: 'rubric mirror files',
    reason: `${corpus.length} file(s) and ${blockCount} dispatch block(s) checked for \`${RUBRIC_VALUE_SET_LITERAL}\`, and the ${agentFiles.length} reviewer agent(s)' citation of \`${citation}\``,
    records,
  };
}

function loadSiteMirrorCheck(opts) {
  const records = [];
  const unknown = (message) => ({
    subjectCount: 0,
    subjectNoun: 'load-site blocks',
    reason: message,
    records: [makeRecord('load-site-mirror', LOAD_SITE_FILE, null, 'UNKNOWN', message)],
  });

  const lr = readLines(opts.root, LOAD_SITE_FILE);
  if (lr.error) return unknown(`cannot read ${LOAD_SITE_FILE}: ${lr.error}`);

  // A block runs from its anchor line to the next blank line, so it tracks the paragraph rather
  // than a fixed length — an added or removed line is compared, not silently excluded.
  const blocks = [];
  lr.lines.forEach((line, i) => {
    if (!line.startsWith(LOAD_SITE_ANCHOR)) return;
    const body = [];
    for (let j = i; j < lr.lines.length && lr.lines[j].trim() !== ''; j += 1) body.push(lr.lines[j]);
    blocks.push({ line: i + 1, text: body.join('\n') });
  });

  // Zero or one copy is nothing to mirror. That is vacuous, not passing: reporting PASS here would
  // read identically to "both copies agree" on a tree where one site had been deleted.
  if (blocks.length < 2) {
    return unknown(
      `expected at least 2 '${LOAD_SITE_ANCHOR}' blocks in ${LOAD_SITE_FILE}, found ${blocks.length}`,
    );
  }

  const [first, ...rest] = blocks;
  for (const block of rest) {
    if (block.text === first.text) continue;
    records.push(
      makeRecord(
        'load-site-mirror',
        LOAD_SITE_FILE,
        block.line,
        'FAIL',
        `load-site block differs from the copy at line ${first.line}; the copies must be byte-identical`,
      ),
    );
  }

  return {
    subjectCount: blocks.length,
    subjectNoun: 'load-site blocks',
    reason: `${blocks.length} copies of the load-site block compared for byte-identity`,
    records,
  };
}

function agentModelPinCheck(opts) {
  const records = [];
  const unknown = (file, message) => ({
    subjectCount: 0,
    subjectNoun: 'reviewer agent files',
    reason: message,
    records: [makeRecord('agent-model-pin', file, null, 'UNKNOWN', message)],
  });

  const agentRes = walkMarkdown(opts.root, RUBRIC_AGENT_DIR);
  if (agentRes.error) {
    return unknown(RUBRIC_AGENT_DIR, `cannot list ${RUBRIC_AGENT_DIR}/: ${agentRes.error}`);
  }
  const agentFiles = agentRes.files.filter((f) => f.endsWith(RUBRIC_AGENT_SUFFIX));
  // An empty corpus is vacuous, not passing: a PASS here would read identically to "every reviewer
  // is pinned correctly" on a tree where the reviewers had been moved or renamed away.
  if (agentFiles.length === 0) {
    return unknown(RUBRIC_AGENT_DIR, `no *${RUBRIC_AGENT_SUFFIX} files in ${RUBRIC_AGENT_DIR}/`);
  }

  for (const file of agentFiles) {
    const lr = readLines(opts.root, file);
    if (lr.error) {
      records.push(makeRecord('agent-model-pin', file, null, 'UNKNOWN', `cannot read file: ${lr.error}`));
      continue;
    }
    const expected = AGENT_MODEL_EXCEPTIONS.get(path.basename(file)) ?? AGENT_MODEL_EXPECTED_DEFAULT;
    let found = null;
    for (let i = 0; i < lr.lines.length; i += 1) {
      const m = lr.lines[i].match(AGENT_MODEL_ANY_VALUE);
      if (m) {
        found = { line: i + 1, value: m[1].trim() };
        break;
      }
    }
    // Absence is a FAIL, not a skip: a dropped `model:` key is exactly how the prior drift would
    // have read, and it leaves the reviewer's model undefined rather than merely unchecked.
    if (found == null) {
      records.push(
        makeRecord('agent-model-pin', file, null, 'FAIL', `no \`model:\` key; expected \`model: ${expected}\``),
      );
      continue;
    }
    if (found.value === expected) continue;
    records.push(
      makeRecord(
        'agent-model-pin',
        file,
        found.line,
        'FAIL',
        `model pinned to \`${found.value}\`, expected \`${expected}\``,
      ),
    );
  }

  return {
    subjectCount: agentFiles.length,
    subjectNoun: 'reviewer agent files',
    reason: `${agentFiles.length} reviewer agent(s) checked against the model pin map (${AGENT_MODEL_EXPECTED_DEFAULT} by default, ${[...AGENT_MODEL_EXCEPTIONS.entries()].map(([f, v]) => `${f} → ${v}`).join(', ')})`,
    records,
  };
}

function tokenGrammarMirrorCheck(opts) {
  const records = [];
  const unknown = (file, message) => ({
    subjectCount: 0,
    subjectNoun: 'token-grammar spans',
    reason: message,
    records: [makeRecord('token-grammar-mirror', file, null, 'UNKNOWN', message)],
  });

  const sources = [];
  for (const file of TOKEN_GRAMMAR_FILES) {
    const lr = readLines(opts.root, file);
    if (lr.error) return unknown(file, `cannot read ${file}: ${lr.error}`);
    sources.push({ file, lines: lr.lines });
  }

  // Extracted between explicit anchors rather than by paragraph, because the pinned span runs to
  // several paragraphs and a table — a blank-line bound would silently pin only its first block.
  const extract = ({ file, lines }, span) => {
    const startIdx = lines.findIndex((l) => l.trim() === span.start);
    if (startIdx === -1) return null;
    const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === span.end);
    if (endIdx === -1) return null;
    return { file, line: startIdx + 1, text: lines.slice(startIdx + 1, endIdx).join('\n') };
  };

  let compared = 0;
  for (const span of TOKEN_GRAMMAR_SPANS) {
    const found = sources.map((src) => extract(src, span)).filter(Boolean);
    // One copy is nothing to mirror, and that is vacuous rather than passing: a PASS would read
    // identically to "both copies agree" on a tree where one skill's anchor had been deleted.
    if (found.length < 2) {
      const missing = TOKEN_GRAMMAR_FILES.filter((f) => !found.some((b) => b.file === f));
      records.push(
        makeRecord(
          'token-grammar-mirror',
          missing[0] ?? TOKEN_GRAMMAR_FILES[0],
          null,
          'UNKNOWN',
          `expected the \`${span.name}\` span in both review skills, found ${found.length} (missing in ${missing.join(', ') || 'none'})`,
        ),
      );
      continue;
    }
    compared += found.length;
    const [first, ...rest] = found;
    for (const other of rest) {
      if (other.text === first.text) continue;
      records.push(
        makeRecord(
          'token-grammar-mirror',
          other.file,
          other.line,
          'FAIL',
          `\`${span.name}\` span differs from the copy at ${first.file}:${first.line}; the copies must be byte-identical (not whitespace-normalised)`,
        ),
      );
    }
  }

  return {
    subjectCount: compared,
    subjectNoun: 'token-grammar spans',
    reason: `${compared} span(s) across ${TOKEN_GRAMMAR_FILES.length} review skill(s) compared for byte-identity`,
    records,
  };
}

const CHECKS = [
  { id: 'sentinels', run: sentinelsCheck },
  { id: 'references', run: referencesCheck },
  { id: 'retired-invocations', run: retiredInvocationsCheck },
  { id: 'version-bump', run: versionBumpCheck },
  { id: 'rubric-mirror', run: rubricMirrorCheck },
  { id: 'load-site-mirror', run: loadSiteMirrorCheck },
  { id: 'agent-model-pin', run: agentModelPinCheck },
  { id: 'token-grammar-mirror', run: tokenGrammarMirrorCheck },
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
