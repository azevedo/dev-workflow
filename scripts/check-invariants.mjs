#!/usr/bin/env node

const VERDICT_CODE = { PASS: 0, FAIL: 1, UNKNOWN: 2 };

function formatRecord(r) {
  const loc = r.line != null ? `${r.file}:${r.line}` : r.file;
  return `${r.invariant} — ${loc} — ${r.message}`;
}

function exitCodeForRecords(records) {
  let worst = 0;
  for (const r of records) worst = Math.max(worst, VERDICT_CODE[r.verdict] ?? 0);
  return worst;
}

function report(records) {
  const nonPass = records.filter((r) => r.verdict !== 'PASS');
  if (nonPass.length === 0) {
    console.log('All structural invariants pass.');
    return;
  }
  for (const r of nonPass) console.log(formatRecord(r));
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

function notImplemented(id) {
  return [{ invariant: id, file: 'scripts/check-invariants.mjs', line: null, verdict: 'UNKNOWN', message: 'check not implemented yet' }];
}

// Stubs report UNKNOWN rather than an empty PASS so the skeleton cannot be mistaken for a
// passing suite — a silently vacuous green is the dominant failure mode for this class of tool
// and is indistinguishable from a healthy repo unless the check says otherwise.
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
  const records = [];
  for (const c of checks) records.push(...c.run(opts));
  return records;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    process.exitCode = 2;
    return;
  }
  try {
    const records = runChecks(opts);
    if (records === null) {
      process.exitCode = 2;
      return;
    }
    report(records);
    process.exitCode = exitCodeForRecords(records);
  } catch (err) {
    console.error(String((err && err.stack) || err));
    process.exitCode = 2;
  }
}

main();
