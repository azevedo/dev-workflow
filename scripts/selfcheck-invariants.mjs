#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const CHECKER = fileURLToPath(new URL('./check-invariants.mjs', import.meta.url));

function write(root, relPath, content) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function gitInit(root) {
  execFileSync('git', ['init', '-q'], { cwd: root });
}

function gitCommit(root, message) {
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync(
    'git',
    ['-c', 'user.email=selfcheck@example.com', '-c', 'user.name=selfcheck', 'commit', '-q', '-m', message, '--no-gpg-sign'],
    { cwd: root },
  );
}

// Combines stdout+stderr into one string: normal check output goes to stdout, but parse
// errors (e.g. an unknown --only id) are written to stderr, and case assertions need to see both.
// Uses process.execPath (not the bare "node") so a case can strip PATH via envOverride to
// simulate git being absent without also breaking Node's own resolution of the checker.
function runChecker(root, checkId, envOverride) {
  const args = [CHECKER, '--root', root];
  if (checkId) args.push('--only', checkId);
  try {
    const stdout = execFileSync(process.execPath, args, {
      encoding: 'utf8',
      env: envOverride ? { ...process.env, ...envOverride } : process.env,
    });
    return { exitCode: 0, stdout };
  } catch (err) {
    return { exitCode: err.status, stdout: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

// A minimal well-formed rubric corpus — owner heading + literal, the sibling skill's copy, and one
// citing reviewer agent. Each case overrides only the part it is testing, so a fixture never
// accidentally trips a second assertion and passes for the wrong reason.
function buildRubricTree(root, opts = {}) {
  const literal = 'N ∈ {0, 25, 50, 75, 100}';
  const heading = opts.ownerHeading ?? '## Code-Anchor & Confidence Grammar';
  if (!opts.omitOwner) {
    write(root, 'skills/ba-review/SKILL.md', `${heading}\n\nwhere \`${literal}\`.\n`);
  }
  write(root, 'skills/ba-review-plan/SKILL.md', `adapts Code-Anchor & Confidence Grammar; \`${literal}\`\n`);
  const agents = opts.agents ?? {
    'architecture-reviewer.md': `cites Code-Anchor & Confidence Grammar\n\`${literal}\`\n`,
  };
  for (const [name, content] of Object.entries(agents)) write(root, `agents/${name}`, content);
}

const CASES = [
  {
    name: 'sentinels FAIL — differing AUTO-SCORE keyword sets',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
    },
    expectExit: 1,
    expectSubstring: 'keyword set differs',
  },
  {
    name: 'sentinels FAIL — [AUTO-SCORE: warn] outside allowed set',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: warn]\n');
    },
    expectExit: 1,
    expectSubstring: 'is outside {clean, weak, error}',
  },
  {
    name: 'sentinels FAIL — heredoc opener with no terminator in its fence',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'skills/c.md', "```bash\ncat <<'TOKEN'\nno terminator here\n```\n");
    },
    expectExit: 1,
    expectSubstring: 'terminator(s) in its fence, expected exactly 1',
  },
  {
    name: 'sentinels PASS — heredoc paired across a nested fence via run-length',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(
        root,
        'skills/c.md',
        "````bash\ncat <<'TOKEN'\n```\nnested three-backtick fence\n```\nTOKEN\n````\n",
      );
    },
    expectExit: 0,
    expectSubstring: 'sentinels: PASS',
  },
  {
    name: 'sentinels PASS — bare-line token outside any fence is not a terminator',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(
        root,
        'skills/c.md',
        "```bash\ncat <<'TOKEN'\nbody\nTOKEN\n```\n\nTOKEN\n",
      );
    },
    expectExit: 0,
    expectSubstring: 'sentinels: PASS',
  },
  {
    name: 'sentinels UNKNOWN — fewer than two AUTO-SCORE participants',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', 'no sentinel here\n');
    },
    expectExit: 2,
    expectSubstring: 'expected an emitter and a parser, found 1',
  },
  {
    name: 'sentinels UNKNOWN — no heredoc openers in the corpus',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
    },
    expectExit: 2,
    expectSubstring: 'no heredoc openers found',
  },
  {
    name: 'sentinels UNKNOWN — fence left open at EOF',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'skills/c.md', '```bash\necho hi\n');
    },
    expectExit: 2,
    expectSubstring: 'never closed before EOF',
  },
  {
    name: 'references FAIL — reference cited nowhere',
    checkId: 'references',
    build(root) {
      write(root, 'references/foo.md', 'content\n');
      write(root, 'skills/a.md', 'no citation here\n');
    },
    expectExit: 1,
    expectSubstring: 'no citation of `references/foo.md`',
  },
  {
    name: 'references FAIL — cited only from another file under references/',
    checkId: 'references',
    build(root) {
      write(root, 'references/foo.md', 'content\n');
      write(root, 'references/other.md', 'cross-cite `references/foo.md`\n');
      write(root, 'skills/a.md', 'no citation here\n');
    },
    expectExit: 1,
    expectSubstring: 'no citation of `references/foo.md`',
  },
  {
    name: 'references PASS — cited only from a file under agents/',
    checkId: 'references',
    build(root) {
      write(root, 'references/foo.md', 'content\n');
      write(root, 'agents/b.md', 'see `references/foo.md` for details\n');
      write(root, 'skills/a.md', 'no citation here\n');
    },
    expectExit: 0,
    expectSubstring: 'references: PASS',
  },
  {
    // Pins the needle's missing leading backtick (check-invariants.mjs). Re-adding it would still pass
    // every bare-form fixture above while silently failing the anchored form real skill bodies use.
    name: 'references PASS — cited only via the plugin-root-anchored spelling from skills/',
    checkId: 'references',
    build(root) {
      write(root, 'references/foo.md', 'content\n');
      write(root, 'skills/a.md', 'load `${CLAUDE_PLUGIN_ROOT}/references/foo.md` at compose time\n');
      write(root, 'agents/b.md', 'no citation here\n');
    },
    expectExit: 0,
    expectSubstring: 'references: PASS',
  },
  {
    name: 'references PASS — bare and anchored spellings both satisfy the same needle',
    checkId: 'references',
    build(root) {
      write(root, 'references/foo.md', 'content\n');
      write(root, 'references/bar.md', 'content\n');
      write(root, 'skills/a.md', 'load `${CLAUDE_PLUGIN_ROOT}/references/foo.md`\n');
      write(root, 'agents/b.md', 'see `references/bar.md`\n');
    },
    expectExit: 0,
    expectSubstring: 'references: PASS',
  },
  {
    name: 'references UNKNOWN — empty references/ directory',
    checkId: 'references',
    build(root) {
      fs.mkdirSync(path.join(root, 'references'), { recursive: true });
      write(root, 'skills/a.md', 'nothing to cite\n');
    },
    expectExit: 2,
    expectSubstring: 'empty references/ glob',
  },
  {
    name: 'version-bump FAIL — skills/ touched, version unchanged',
    checkId: 'version-bump',
    build(root) {
      gitInit(root);
      write(root, '.claude-plugin/plugin.json', '{"version": "1.0.0"}\n');
      write(root, 'skills/a.md', 'initial\n');
      gitCommit(root, 'init');
      write(root, 'skills/a.md', 'changed\n');
      gitCommit(root, 'change');
    },
    expectExit: 1,
    expectSubstring: 'version unchanged',
  },
  {
    name: 'version-bump FAIL — version differs only by trailing whitespace',
    checkId: 'version-bump',
    build(root) {
      gitInit(root);
      write(root, '.claude-plugin/plugin.json', '{"version": "1.0.0"}\n');
      write(root, 'skills/a.md', 'initial\n');
      gitCommit(root, 'init');
      write(root, '.claude-plugin/plugin.json', '{"version": "1.0.0 "}\n');
      write(root, 'skills/a.md', 'changed\n');
      gitCommit(root, 'change');
    },
    expectExit: 1,
    expectSubstring: 'version unchanged',
  },
  {
    name: 'version-bump PASS — real version bump',
    checkId: 'version-bump',
    build(root) {
      gitInit(root);
      write(root, '.claude-plugin/plugin.json', '{"version": "1.0.0"}\n');
      write(root, 'skills/a.md', 'initial\n');
      gitCommit(root, 'init');
      write(root, '.claude-plugin/plugin.json', '{"version": "1.1.0"}\n');
      write(root, 'skills/a.md', 'changed\n');
      gitCommit(root, 'change');
    },
    expectExit: 0,
    expectSubstring: 'version 1.0.0 → 1.1.0',
  },
  {
    name: 'version-bump PASS — commit touching only docs/ is not applicable',
    checkId: 'version-bump',
    build(root) {
      gitInit(root);
      write(root, '.claude-plugin/plugin.json', '{"version": "1.0.0"}\n');
      write(root, 'skills/a.md', 'initial\n');
      gitCommit(root, 'init');
      write(root, 'docs/notes.md', 'unrelated\n');
      gitCommit(root, 'docs change');
    },
    expectExit: 0,
    expectSubstring: 'not applicable',
  },
  {
    name: 'version-bump UNKNOWN — not a git working tree',
    checkId: 'version-bump',
    build() {},
    expectExit: 2,
    expectSubstring: 'git rev-parse HEAD~1 failed',
  },
  {
    name: 'version-bump UNKNOWN — single-commit repo, HEAD~1 unresolvable',
    checkId: 'version-bump',
    build(root) {
      gitInit(root);
      write(root, '.claude-plugin/plugin.json', '{"version": "1.0.0"}\n');
      gitCommit(root, 'init');
    },
    expectExit: 2,
    expectSubstring: 'git rev-parse HEAD~1 failed',
  },
  {
    name: 'sentinels UNKNOWN — --root with no skills/ directory yields a named record',
    checkId: 'sentinels',
    build(root) {
      fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    },
    expectExit: 2,
    expectSubstring: 'cannot list directory',
  },
  {
    name: 'references UNKNOWN — --root with no skills/ directory yields a named record too',
    checkId: 'references',
    build(root) {
      fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
      write(root, 'references/foo.md', 'content\n');
    },
    expectExit: 2,
    expectSubstring: 'cannot list directory',
  },
  {
    name: 'sentinels PASS — an over-indented closer (>3 spaces) does not prematurely end the fence',
    checkId: 'sentinels',
    build(root) {
      write(root, 'skills/a.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(
        root,
        'skills/c.md',
        "```bash\ncat <<'TOKEN'\nbody\n            ```\nTOKEN\n```\n",
      );
    },
    expectExit: 0,
    expectSubstring: 'sentinels: PASS',
  },
  {
    name: 'version-bump UNKNOWN — git absent from PATH',
    checkId: 'version-bump',
    build() {},
    expectExit: 2,
    expectSubstring: 'git rev-parse HEAD~1 failed',
    env: { PATH: '' },
  },
  {
    name: 'retired-invocations FAIL — planted colon form under skills/ is reported with file:line',
    checkId: 'retired-invocations',
    build(root) {
      write(root, 'skills/a.md', 'run `/ba:plan` to start\n');
      write(root, 'agents/b.md', 'clean\n');
      write(root, 'references/foo.md', 'clean\n');
      write(root, '.claude/agent_docs/c.md', 'clean\n');
      write(root, 'README.md', 'clean\n');
      write(root, 'CLAUDE.md', 'clean\n');
    },
    expectExit: 1,
    expectSubstrings: ['skills/a.md:1', "retired invocation string '/ba:'"],
  },
  {
    name: 'retired-invocations FAIL — planted commands/ba/ path citation is reported',
    checkId: 'retired-invocations',
    build(root) {
      write(root, 'skills/a.md', 'clean\n');
      write(root, 'agents/b.md', 'see `commands/ba/plan.md` for the rubric\n');
      write(root, 'references/foo.md', 'clean\n');
      write(root, '.claude/agent_docs/c.md', 'clean\n');
      write(root, 'README.md', 'clean\n');
      write(root, 'CLAUDE.md', 'clean\n');
    },
    expectExit: 1,
    expectSubstrings: ['agents/b.md:1', "retired invocation string 'commands/ba/'"],
  },
  {
    // references/ and .claude/agent_docs/ are in the corpus beyond the two prompt-surface dirs;
    // without this, narrowing RETIRED_INVOCATION_DIRS back to PROMPT_SURFACE_DIRS would pass.
    name: 'retired-invocations FAIL — planted colon form in references/ and .claude/agent_docs/',
    checkId: 'retired-invocations',
    build(root) {
      write(root, 'skills/a.md', 'clean\n');
      write(root, 'agents/b.md', 'clean\n');
      write(root, 'references/foo.md', 'composed by /ba:plan\n');
      write(root, '.claude/agent_docs/c.md', 'surface is `commands/ba/*.md`\n');
      write(root, 'README.md', 'clean\n');
      write(root, 'CLAUDE.md', 'clean\n');
    },
    expectExit: 1,
    expectSubstrings: ['references/foo.md:1', '.claude/agent_docs/c.md:1'],
  },
  {
    name: 'retired-invocations FAIL — multiple hits in one file each report their own line',
    checkId: 'retired-invocations',
    build(root) {
      write(root, 'skills/a.md', 'clean\n');
      write(root, 'agents/b.md', 'clean\n');
      write(root, 'references/foo.md', 'clean\n');
      write(root, '.claude/agent_docs/c.md', 'clean\n');
      write(root, 'README.md', 'run `/ba:plan`\nthen read `commands/ba/execute.md`\n');
      write(root, 'CLAUDE.md', 'clean\n');
    },
    expectExit: 1,
    expectSubstrings: ['README.md:1', 'README.md:2'],
  },
  {
    name: 'retired-invocations UNKNOWN — no corpus dirs and no root files',
    checkId: 'retired-invocations',
    build(root) {
      fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    },
    expectExit: 2,
    expectSubstring: 'empty scan corpus',
  },
  {
    name: 'retired-invocations PASS — clean tree with only hyphen forms',
    checkId: 'retired-invocations',
    build(root) {
      write(root, 'skills/a.md', 'run `/ba-plan` to start\n');
      write(root, 'agents/b.md', 'see `skills/ba-review/SKILL.md` §4\n');
      write(root, 'references/foo.md', 'composed by /ba-plan\n');
      write(root, '.claude/agent_docs/c.md', 'surface is `skills/ba-*/SKILL.md`\n');
      write(root, 'README.md', '`/ba-execute [plan]`\n');
      write(root, 'CLAUDE.md', 'invoke as `/ba-<name>`\n');
    },
    expectExit: 0,
    expectSubstring: 'retired-invocations: PASS',
  },
  {
    name: 'retired-invocations PASS — a colon form under docs/ is out of corpus by construction',
    checkId: 'retired-invocations',
    build(root) {
      write(root, 'skills/a.md', 'clean\n');
      write(root, 'agents/b.md', 'clean\n');
      write(root, 'references/foo.md', 'clean\n');
      write(root, '.claude/agent_docs/c.md', 'clean\n');
      write(root, 'README.md', 'clean\n');
      write(root, 'CLAUDE.md', 'clean\n');
      write(root, 'docs/plans/old-plan.md', 'historical: run `/ba:plan` then `/ba:execute`\n');
      write(root, 'docs/solutions/x/note.md', 'we fixed it via `commands/ba/review.md`\n');
    },
    expectExit: 0,
    expectSubstring: 'retired-invocations: PASS',
  },
  {
    name: 'rubric-mirror FAIL — one agent carries a divergent value set',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root, { agents: { 'security-reviewer.md': 'cites Code-Anchor & Confidence Grammar\nN ∈ {0, 50, 100}\n' } });
    },
    expectExit: 1,
    expectSubstring: 'value set spelled `N ∈ {0, 50, 100}`',
  },
  {
    // Pins the exact-string comparison (check-invariants.mjs). The divergent-value fixture above
    // would fail under a whitespace-normalising implementation too; only this one discriminates.
    name: 'rubric-mirror FAIL — value set differs only in whitespace',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root, { agents: { 'security-reviewer.md': 'cites Code-Anchor & Confidence Grammar\nN ∈ {0,25,50,75,100}\n' } });
    },
    expectExit: 1,
    expectSubstring: 'value set spelled `N ∈ {0,25,50,75,100}`',
  },
  {
    name: 'rubric-mirror FAIL — cited section absent from ba-review',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root, { ownerHeading: '## Some Other Heading' });
    },
    expectExit: 1,
    expectSubstring: 'no `## Code-Anchor & Confidence Grammar` heading',
  },
  {
    name: 'rubric-mirror FAIL — an agent does not cite the section',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root, { agents: { 'security-reviewer.md': 'no citation\nN ∈ {0, 25, 50, 75, 100}\n' } });
    },
    expectExit: 1,
    expectSubstring: 'no citation of `Code-Anchor & Confidence Grammar`',
  },
  {
    name: 'rubric-mirror PASS — all copies agree and the section resolves',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root);
    },
    expectExit: 0,
    expectSubstring: 'rubric-mirror: PASS',
  },
  {
    name: 'rubric-mirror UNKNOWN — no reviewer agents in the corpus',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root, { agents: {} });
      write(root, 'agents/convention-checker.md', 'not a reviewer\n');
    },
    expectExit: 2,
    expectSubstring: 'no *-reviewer.md files in agents/',
  },
  {
    name: 'rubric-mirror UNKNOWN — ba-review/SKILL.md absent or unreadable',
    checkId: 'rubric-mirror',
    build(root) {
      buildRubricTree(root, { omitOwner: true });
    },
    expectExit: 2,
    expectSubstring: 'cannot read rubric owner skills/ba-review/SKILL.md',
  },
  {
    name: 'no --only: all five checks run and their verdicts fold with FAIL outranking UNKNOWN',
    checkId: null,
    build(root) {
      write(
        root,
        'skills/a.md',
        "[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n```bash\ncat <<'TOKEN'\nbody\nTOKEN\n```\n",
      );
      write(root, 'agents/b.md', '[AUTO-SCORE: clean]\n[AUTO-SCORE: weak]\n[AUTO-SCORE: error]\n');
      write(root, 'references/foo.md', 'content\n'); // cited nowhere -> references FAIL
      // no git repo at all -> version-bump UNKNOWN; no *-reviewer.md -> rubric-mirror UNKNOWN
    },
    expectExit: 1,
    expectSubstrings: ['sentinels: PASS', 'references: FAIL', 'version-bump: UNKNOWN', 'rubric-mirror: UNKNOWN'],
  },
  {
    name: '--only bogus: unknown check id reports an error and exits 2',
    checkId: 'bogus',
    build() {},
    expectExit: 2,
    expectSubstring: 'Unknown check id: bogus',
  },
];

// Static, not a checker invocation: greps the two scripts' own import lines rather than
// building a tree and running the checker, since AC7 is a property of the source files
// themselves, not of any check's behavior against a corpus.
function checkStdlibImportsOnly() {
  const name = 'both scripts import only Node built-in modules (AC7)';
  const files = ['check-invariants.mjs', 'selfcheck-invariants.mjs'].map((f) =>
    fileURLToPath(new URL(`./${f}`, import.meta.url)),
  );
  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const importRe = /^import .* from ['"]([^'"]+)['"];?$/gm;
    let m;
    while ((m = importRe.exec(text))) {
      if (!m[1].startsWith('node:')) offenders.push(`${path.basename(file)}: ${m[1]}`);
    }
  }
  if (offenders.length === 0) {
    console.log(`PASS: ${name}`);
    return true;
  }
  console.log(`FAIL: ${name}`);
  console.log(`  non-builtin imports: ${offenders.join(', ')}`);
  return false;
}

function main() {
  let failures = 0;
  if (!checkStdlibImportsOnly()) failures++;
  for (const c of CASES) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-invariants-'));
    try {
      const expected = c.expectSubstrings ?? [c.expectSubstring];
      c.build(root);
      const { exitCode, stdout } = runChecker(root, c.checkId, c.env);
      const exitOk = exitCode === c.expectExit;
      const substringOk = expected.every((s) => stdout.includes(s));
      if (exitOk && substringOk) {
        console.log(`PASS: ${c.name}`);
      } else {
        failures++;
        console.log(`FAIL: ${c.name}`);
        console.log(`  expected exit ${c.expectExit}, got ${exitCode}`);
        console.log(`  expected stdout to include: ${expected.join(' AND ')}`);
        console.log(`  actual stdout:\n${stdout}`);
      }
    } catch (err) {
      // A case's own build() (e.g. gitInit/gitCommit) throwing must not abort the remaining
      // cases — record it as a failure and keep going, same as an assertion mismatch.
      failures++;
      console.log(`FAIL: ${c.name}`);
      console.log(`  case threw: ${String((err && err.stack) || err)}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  const totalChecks = CASES.length + 1; // +1 for checkStdlibImportsOnly
  if (failures > 0) {
    console.error(`${failures}/${totalChecks} selfcheck check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`All ${totalChecks} selfcheck checks passed.`);
  }
}

main();
