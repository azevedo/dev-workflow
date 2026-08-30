#!/usr/bin/env node

// Attributes /ba-review findings to the reviewer that produced them, and measures how many
// of them propose adding a test. Answers "which reviewer is generating the test mass?" with
// counts instead of intuition.
//
// Two sources, one parser:
//   - persist  — docs/reviews/<ts>-<scope>/<reviewer>.md, written by `/ba-review --persist`.
//                Authoritative: reviewer identity is in the frontmatter, text is the raw return.
//   - transcripts — ~/.claude/projects/**/*.jsonl. Recovers runs that predate any use of
//                --persist, by pairing each Task tool_use with its tool_result.
//
// This is an analysis tool, not an invariant check. It is not wired into CI and exits 0
// whenever it completed, whatever the numbers say.
//
// Usage: audit-reviewer-findings.mjs [--reviews <dir>] [--transcripts <dir>]
//                                    [--source both|persist|transcripts] [--since YYYY-MM-DD]
//                                    [--dump <file.jsonl>] [--json]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Finding grammar — mirrors skills/ba-review/SKILL.md §4a. Kept permissive for the
// same reason §4a is: a reviewer that drifts off-format should show up as a parsed
// finding with a defaulted field, not vanish from the counts and flatter its own total.
// ---------------------------------------------------------------------------

const SEVERITY_ALIASES = new Map([
  ['critical', 'Critical'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
  ['looks good', 'Looks Good'],
  ['must address', 'High'], // legacy (§4a)
  ['consider', 'Medium'], // legacy (§4a)
]);

const SEVERITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const CONFIDENCE_FLOOR = { Critical: 50, High: 75, Medium: 75, Low: 75 }; // §4e soft gate

const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/;
const BULLET_RE = /^[-*]\s+\*\*([^*]+?):(\d+)\*\*(.*)$/;
const CONFIDENCE_RE = /^\s*\*?\(\s*confidence:\s*(\d+)\s*\)\*?/i;
const NONE_RE = /^[_*]*none[_*]*\.?$/i;

function matchSeverityHeading(text) {
  const lower = text.toLowerCase().replace(/[:*_`]/g, '').trim();
  for (const [alias, canonical] of SEVERITY_ALIASES) {
    // Trailing text after the label is allowed — "## Critical Issues" matches Critical.
    if (lower === alias || lower.startsWith(`${alias} `)) return canonical;
  }
  return null;
}

// Returns { findings, sawLegacy, sawModern } so a caller can tell a reviewer that emitted
// nothing from one that emitted an unparseable shape.
function parseFindings(rawText) {
  const findings = [];
  let severity = null;
  let current = null;
  let sawLegacy = false;
  let sawModern = false;

  const flush = () => {
    if (current) {
      current.body = current.body.join('\n').trim();
      findings.push(current);
      current = null;
    }
  };

  for (const line of String(rawText || '').split('\n')) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      flush();
      const canonical = matchSeverityHeading(heading[1]);
      if (canonical) {
        const bare = heading[1].toLowerCase().replace(/[:*_`]/g, '').trim();
        if (bare.startsWith('must address') || bare.startsWith('consider')) sawLegacy = true;
        else sawModern = true;
      }
      severity = canonical;
      continue;
    }
    if (!severity) continue;

    if (severity === 'Looks Good') {
      const positive = line.match(/^[-*]\s+(.*)$/);
      if (positive && !NONE_RE.test(positive[1].trim())) {
        flush();
        findings.push({ severity, file: null, line: null, confidence: null, body: positive[1].trim() });
      }
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      flush();
      let rest = bullet[3];
      let confidence = null;
      const conf = rest.match(CONFIDENCE_RE);
      if (conf) {
        confidence = Number(conf[1]);
        rest = rest.slice(conf[0].length);
      }
      current = {
        severity,
        file: bullet[1].trim(),
        line: Number(bullet[2]),
        confidence,
        body: [rest.replace(/^\s*[—–-]+\s*/, '').trim()],
      };
      continue;
    }

    // Non-bullet, non-heading lines continue the parent bullet (§4a).
    if (current) current.body.push(line.trim());
  }
  flush();
  return { findings, sawLegacy, sawModern };
}

// ---------------------------------------------------------------------------
// Test-proposal classifier
//
// Deliberately split strong/weak rather than emitting one number. The weak patterns fire on
// prose that merely mentions testing, so folding them into a single count would manufacture
// exactly the confident-but-unfounded figure this audit exists to avoid. Strong and
// weak-only are reported as a range; --dump prints every match for eyeballing.
// ---------------------------------------------------------------------------

const STRONG_PATTERNS = [
  ['add-test', /\badd(?:ing|s)?\b[^.;]{0,40}\btests?\b/i],
  ['missing-test', /\b(?:no|missing|lacks?|lacking|without|absent|needs?)\b[^.;]{0,30}\b(?:tests?|test coverage|spec)\b/i],
  ['untested', /\buntested\b|\bnot\s+(?:covered|tested|exercised)\b|\bcoverage gap\b/i],
  ['test-scenario', /\btest\s+(?:case|scenario|for the|that)\b/i],
  ['should-test', /\bshould be tested\b|\bworth (?:a )?test(?:ing)?\b|\bcover(?:ed)? by a test\b/i],
  ['suggest-spec', /\bsuggested fix:[^.]{0,60}\b(?:tests?|spec)\b/i],
];

const WEAK_PATTERNS = [
  ['mentions-assert', /\bassert(?:ion|ions|s)?\b/i],
  ['mentions-mock', /\bmocks?\b|\bstubs?\b|\bfixtures?\b/i],
  ['mentions-test-word', /\btests?\b|\bspec\b/i],
];

const TEST_PATH_RE = /(^|\/)(__tests__|__specs__|tests?|specs?)\/|\.(test|spec)\.[a-z0-9]+$|_test\.[a-z0-9]+$/i;

function classify(finding) {
  const body = finding.body || '';
  const strong = STRONG_PATTERNS.filter(([, re]) => re.test(body)).map(([id]) => id);
  const weak = WEAK_PATTERNS.filter(([, re]) => re.test(body)).map(([id]) => id);
  return {
    proposesTest: strong.length > 0,
    maybeTest: strong.length === 0 && weak.length > 0,
    patterns: strong.length ? strong : weak,
    anchorIsTest: finding.file ? TEST_PATH_RE.test(finding.file) : false,
  };
}

// ---------------------------------------------------------------------------
// Source: persist directories
// ---------------------------------------------------------------------------

function readFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { fields: {}, body: text };
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: text.slice(match[0].length) };
}

function collectFromPersist(reviewsDir, since) {
  const outputs = [];
  const problems = [];
  let runDirs;
  try {
    runDirs = fs.readdirSync(reviewsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch (err) {
    return { outputs, problems: [`persist: cannot read ${reviewsDir} (${err.code || err.message})`] };
  }

  for (const dir of runDirs) {
    // Directory name is ${TIMESTAMP}-${SCOPE_REF}, TIMESTAMP = YYYY-MM-DD-HHMMSS.
    const stamp = dir.name.match(/^(\d{4}-\d{2}-\d{2})-\d{6}/);
    if (since && stamp && stamp[1] < since) continue;
    const runPath = path.join(reviewsDir, dir.name);
    let files;
    try {
      files = fs.readdirSync(runPath).filter((f) => f.endsWith('.md') && f !== 'summary.md');
    } catch (err) {
      problems.push(`persist: cannot read ${runPath} (${err.code || err.message})`);
      continue;
    }
    for (const file of files) {
      let text;
      try {
        text = fs.readFileSync(path.join(runPath, file), 'utf8');
      } catch (err) {
        problems.push(`persist: cannot read ${path.join(runPath, file)} (${err.code || err.message})`);
        continue;
      }
      const { fields, body } = readFrontmatter(text);
      outputs.push({
        reviewer: fields.reviewer || path.basename(file, '.md'),
        kind: fields.source || 'unknown',
        status: fields.status || 'succeeded',
        model: fields.model || 'unknown',
        runId: dir.name,
        origin: 'persist',
        rawText: body,
      });
    }
  }
  return { outputs, problems };
}

// ---------------------------------------------------------------------------
// Source: transcripts
// ---------------------------------------------------------------------------

function listJsonl(dir) {
  const found = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) found.push(p);
    }
  };
  walk(dir);
  return found;
}

function resultText(block) {
  const content = block.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((c) => c && c.type === 'text').map((c) => c.text).join('\n');
  }
  return '';
}

// A `Task` dispatch names its reviewer in subagent_type, except for the two general-purpose
// templates (skill-based and custom-dimension), where the identity is only in the prompt text.
// Those are labelled so they never silently merge into one "general-purpose" bucket.
function reviewerFromTask(input) {
  const subagent = String(input?.subagent_type || '').trim();
  const prompt = String(input?.prompt || '');
  if (subagent && subagent !== 'general-purpose') {
    return { reviewer: subagent.replace(/^dev-workflow:/, ''), kind: subagent.startsWith('dev-workflow:') ? 'built-in' : 'external-agent' };
  }
  const skill = prompt.match(/Use the `([^`]+)` skill/);
  if (skill) return { reviewer: skill[1], kind: 'external-skill' };
  const dimension = prompt.match(/specializing in \*\*([^*]+)\*\*/);
  if (dimension) return { reviewer: dimension[1].trim(), kind: 'user-typed' };
  return { reviewer: 'general-purpose (unattributed)', kind: 'unknown' };
}

// Only Task calls that look like review dispatches count. The marker is the bullet grammar
// every Step 3 template carries inline — which is also the thing that makes the return
// parseable, so a dispatch without it would yield no findings anyway.
const REVIEW_DISPATCH_RE = /confidence:\s*N|Code-Anchor & Confidence Grammar|Looks Good/;

function collectFromTranscripts(dir, since) {
  const outputs = [];
  const problems = [];
  const files = listJsonl(dir);
  if (files.length === 0) problems.push(`transcripts: no .jsonl found under ${dir}`);

  for (const file of files) {
    let lines;
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch (err) {
      problems.push(`transcripts: cannot read ${file} (${err.code || err.message})`);
      continue;
    }
    const pending = new Map(); // tool_use_id -> {reviewer, kind, day}
    for (const raw of lines) {
      let entry;
      try {
        entry = JSON.parse(raw);
      } catch {
        continue;
      }
      const blocks = entry?.message?.content;
      if (!Array.isArray(blocks)) continue;
      const day = String(entry.timestamp || '').slice(0, 10);

      for (const block of blocks) {
        if (block.type === 'tool_use' && block.name === 'Task') {
          if (!REVIEW_DISPATCH_RE.test(String(block.input?.prompt || ''))) continue;
          if (since && day && day < since) continue;
          pending.set(block.id, { ...reviewerFromTask(block.input), day });
        } else if (block.type === 'tool_result' && pending.has(block.tool_use_id)) {
          const meta = pending.get(block.tool_use_id);
          pending.delete(block.tool_use_id);
          const text = resultText(block);
          outputs.push({
            reviewer: meta.reviewer,
            kind: meta.kind,
            status: block.is_error ? 'failed' : 'succeeded',
            model: 'unknown', // transcripts do not record the dispatched model
            runId: `${path.basename(file, '.jsonl').slice(0, 8)}:${meta.day}`,
            origin: 'transcript',
            rawText: text,
          });
        }
      }
    }
    for (const meta of pending.values()) {
      problems.push(`transcripts: dispatch to ${meta.reviewer} in ${path.basename(file)} has no result (interrupted run?)`);
    }
  }
  return { outputs, problems };
}

// ---------------------------------------------------------------------------
// Corroboration analysis
//
// §4d merges same-anchor findings as max(c) + 25*(n-1) with no independence condition.
// This counts the groups that clear §4e's floor ONLY because a second reviewer agreed —
// the population where correlated lenses, not evidence, did the promoting.
// ---------------------------------------------------------------------------

function analyseCoAnchors(findings) {
  const groups = new Map();
  for (const f of findings) {
    if (!f.file || f.severity === 'Looks Good') continue;
    const key = `${f.file}:${f.line}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  const pairs = new Map();
  let shared = 0;
  let promotedByCorroboration = 0;
  const examples = [];

  for (const [key, group] of groups) {
    const reviewers = [...new Set(group.map((f) => f.reviewer))];
    if (reviewers.length < 2) continue;
    shared++;

    for (let i = 0; i < reviewers.length; i++) {
      for (let j = i + 1; j < reviewers.length; j++) {
        const pair = [reviewers[i], reviewers[j]].sort().join('  +  ');
        pairs.set(pair, (pairs.get(pair) || 0) + 1);
      }
    }

    const severity = group.reduce((a, f) => ((SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[a] || 0) ? f.severity : a), 'Low');
    const votes = group.map((f) => (f.confidence == null ? CONFIDENCE_FLOOR[f.severity] || 75 : f.confidence)).filter((c) => c > 0);
    if (votes.length === 0) continue;
    const best = Math.max(...votes);
    const merged = Math.min(100, best + 25 * (votes.length - 1));
    const floor = CONFIDENCE_FLOOR[severity] || 75;
    if (best < floor && merged >= floor) {
      promotedByCorroboration++;
      if (examples.length < 5) examples.push({ anchor: key, reviewers, best, merged, floor, severity });
    }
  }

  const topPairs = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { sharedAnchors: shared, promotedByCorroboration, topPairs, examples };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function padLeft(s, n) {
  s = String(s);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}
function pct(part, total) {
  return total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;
}

function report(stats, coAnchor, problems, opts) {
  const rows = [...stats.byReviewer.values()].sort((a, b) => b.findings - a.findings);
  const nameWidth = Math.max(20, ...rows.map((r) => r.reviewer.length));

  console.log('');
  console.log(`Reviewer finding audit — ${stats.runs} dispatch(es) across ${stats.distinctRuns} run(s), ${stats.findings} finding(s)`);
  console.log(`Sources: ${[...stats.origins].join(', ') || 'none'}${opts.since ? `  ·  since ${opts.since}` : ''}`);
  console.log('');

  console.log(
    `${pad('REVIEWER', nameWidth)}  ${padLeft('DISP', 4)}  ${padLeft('FIND', 5)}  ${padLeft('/RUN', 6)}  ${padLeft('TEST', 5)}  ${padLeft('%', 5)}  ${padLeft('MAYBE', 6)}  ${padLeft('C', 3)} ${padLeft('H', 3)} ${padLeft('M', 3)} ${padLeft('L', 3)}`
  );
  console.log('-'.repeat(nameWidth + 56));
  for (const r of rows) {
    console.log(
      `${pad(r.reviewer, nameWidth)}  ${padLeft(r.dispatches, 4)}  ${padLeft(r.findings, 5)}  ${padLeft((r.findings / Math.max(1, r.dispatches)).toFixed(1), 6)}  ${padLeft(r.proposesTest, 5)}  ${padLeft(pct(r.proposesTest, r.findings), 5)}  ${padLeft(r.maybeTest, 6)}  ${padLeft(r.sev.Critical, 3)} ${padLeft(r.sev.High, 3)} ${padLeft(r.sev.Medium, 3)} ${padLeft(r.sev.Low, 3)}`
    );
  }
  console.log('-'.repeat(nameWidth + 56));
  console.log(
    `${pad('TOTAL', nameWidth)}  ${padLeft(stats.runs, 4)}  ${padLeft(stats.findings, 5)}  ${padLeft('', 6)}  ${padLeft(stats.proposesTest, 5)}  ${padLeft(pct(stats.proposesTest, stats.findings), 5)}  ${padLeft(stats.maybeTest, 6)}`
  );
  console.log('');
  console.log('TEST  = body matched a strong test-proposal pattern.  MAYBE = weak signal only');
  console.log('        (mentions tests/mocks/assertions without proposing one). Treat TEST as the');
  console.log('        lower bound and TEST+MAYBE as the upper bound; --dump to check by hand.');
  console.log('');

  const anchored = stats.anchorIsTest;
  if (anchored > 0) {
    console.log(`Findings anchored to a test file: ${anchored} (${pct(anchored, stats.findings)}) — these review existing`);
    console.log('        tests rather than ask for new ones, so they push against mass, not for it.');
    console.log('');
  }

  console.log(`Shared anchors (2+ reviewers on one file:line): ${coAnchor.sharedAnchors}`);
  console.log(`  Promoted past the §4e floor only by corroboration: ${coAnchor.promotedByCorroboration}`);
  console.log('  §4d adds +25 per extra reviewer with no independence condition, so any pair of');
  console.log('  overlapping lenses reading one diff inflates here. This is that population.');
  if (coAnchor.topPairs.length) {
    console.log('  Most frequent co-anchoring pairs:');
    for (const [pair, n] of coAnchor.topPairs) console.log(`    ${padLeft(n, 4)}  ${pair}`);
  }
  for (const e of coAnchor.examples) {
    console.log(`    e.g. ${e.anchor} — ${e.severity} best=${e.best} merged=${e.merged} (floor ${e.floor}) via ${e.reviewers.join(' + ')}`);
  }
  console.log('');

  if (stats.legacyFormat || stats.emptyReturns || stats.failed) {
    console.log('Data quality:');
    if (stats.failed) console.log(`  ${stats.failed} dispatch(es) recorded as failed — excluded from finding counts.`);
    if (stats.emptyReturns) console.log(`  ${stats.emptyReturns} dispatch(es) parsed to zero findings (clean review, or off-format return).`);
    if (stats.legacyFormat) console.log(`  ${stats.legacyFormat} dispatch(es) used legacy headings (Must Address / Consider).`);
    console.log('');
  }

  if (problems.length) {
    console.log('Problems:');
    for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
    if (problems.length > 20) console.log(`  … and ${problems.length - 20} more`);
    console.log('');
  }

  if (stats.findings === 0) {
    console.log('No findings parsed. Either no /ba-review run is recorded in these sources, or the');
    console.log('runs predate the persist flag. The clean corpus comes from `/ba-review --persist`.');
    console.log('');
  }
}

// ---------------------------------------------------------------------------

function usage() {
  return [
    'Usage: audit-reviewer-findings.mjs [options]',
    '',
    '  --reviews <dir>       persist dir (default: docs/reviews)',
    '  --transcripts <dir>   transcript root (default: ~/.claude/projects)',
    '  --source <s>          both | persist | transcripts (default: both)',
    '  --since <YYYY-MM-DD>  ignore older runs',
    '  --dump <file.jsonl>   write every classified finding for manual audit',
    '  --json                emit machine-readable summary instead of the table',
  ].join('\n');
}

// Distinguishes "printed help, exit 0" from "bad flag, exit 2" without overloading null.
const HELP = Symbol('help');

function parseArgs(argv) {
  const opts = {
    reviews: path.join(process.cwd(), 'docs/reviews'),
    transcripts: path.join(os.homedir(), '.claude/projects'),
    source: 'both',
    since: null,
    dump: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reviews') opts.reviews = argv[++i];
    else if (a === '--transcripts') opts.transcripts = argv[++i];
    else if (a === '--source') opts.source = argv[++i];
    else if (a === '--since') opts.since = argv[++i];
    else if (a === '--dump') opts.dump = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') {
      console.log(usage());
      return HELP;
    } else {
      console.error(`Unknown flag: ${a}\n${usage()}`);
      return null;
    }
  }
  if (!['both', 'persist', 'transcripts'].includes(opts.source)) {
    console.error(`--source must be both|persist|transcripts\n${usage()}`);
    return null;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts === HELP) return;
  if (!opts) {
    process.exitCode = 2;
    return;
  }

  const outputs = [];
  const problems = [];
  if (opts.source !== 'transcripts') {
    const r = collectFromPersist(opts.reviews, opts.since);
    outputs.push(...r.outputs);
    problems.push(...r.problems);
  }
  if (opts.source !== 'persist') {
    const r = collectFromTranscripts(opts.transcripts, opts.since);
    outputs.push(...r.outputs);
    problems.push(...r.problems);
  }

  const stats = {
    runs: 0,
    distinctRuns: 0,
    findings: 0,
    proposesTest: 0,
    maybeTest: 0,
    anchorIsTest: 0,
    failed: 0,
    emptyReturns: 0,
    legacyFormat: 0,
    origins: new Set(),
    byReviewer: new Map(),
  };
  const allFindings = [];
  const runIds = new Set();
  const dumpRows = [];

  for (const out of outputs) {
    stats.origins.add(out.origin);
    runIds.add(out.runId);
    if (out.status === 'failed') {
      stats.failed++;
      continue;
    }
    stats.runs++;

    if (!stats.byReviewer.has(out.reviewer)) {
      stats.byReviewer.set(out.reviewer, {
        reviewer: out.reviewer,
        dispatches: 0,
        findings: 0,
        proposesTest: 0,
        maybeTest: 0,
        sev: { Critical: 0, High: 0, Medium: 0, Low: 0, 'Looks Good': 0 },
      });
    }
    const row = stats.byReviewer.get(out.reviewer);
    row.dispatches++;

    const { findings, sawLegacy, sawModern } = parseFindings(out.rawText);
    if (sawLegacy && !sawModern) stats.legacyFormat++;
    const scored = findings.filter((f) => f.severity !== 'Looks Good');
    if (scored.length === 0) stats.emptyReturns++;

    for (const f of findings) {
      row.sev[f.severity]++;
      if (f.severity === 'Looks Good') continue;

      const c = classify(f);
      row.findings++;
      stats.findings++;
      if (c.proposesTest) {
        row.proposesTest++;
        stats.proposesTest++;
      }
      if (c.maybeTest) {
        row.maybeTest++;
        stats.maybeTest++;
      }
      if (c.anchorIsTest) stats.anchorIsTest++;

      const record = { ...f, reviewer: out.reviewer, runId: out.runId, origin: out.origin, ...c };
      allFindings.push(record);
      if (opts.dump) dumpRows.push(JSON.stringify(record));
    }
  }
  stats.distinctRuns = runIds.size;

  const coAnchor = analyseCoAnchors(allFindings);

  if (opts.dump) {
    try {
      fs.writeFileSync(opts.dump, dumpRows.join('\n') + (dumpRows.length ? '\n' : ''));
      problems.push(`dump: wrote ${dumpRows.length} finding(s) to ${opts.dump}`);
    } catch (err) {
      problems.push(`dump: cannot write ${opts.dump} (${err.code || err.message})`);
    }
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          totals: {
            dispatches: stats.runs,
            runs: stats.distinctRuns,
            findings: stats.findings,
            proposesTest: stats.proposesTest,
            maybeTest: stats.maybeTest,
            anchorIsTest: stats.anchorIsTest,
            failed: stats.failed,
          },
          byReviewer: [...stats.byReviewer.values()],
          coAnchor,
          problems,
        },
        null,
        2
      )
    );
  } else {
    report(stats, coAnchor, problems, opts);
  }
}

main();
