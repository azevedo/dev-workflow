---
title: Structural Invariant Checks
type: feat
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow; progress is git-derived
date: 2026-07-28
detail_level: minimal
tags: [ci, tooling, invariants, github-actions]
---

# Structural Invariant Checks

This repo's cross-file conventions are enforced by nothing today. Three of them are
mechanically checkable and were verified non-vacuous against HEAD: the `[AUTO-SCORE: …]`
sentinel contract between two command files, shell heredoc sentinel pairing inside fenced
blocks, `references/*.md` load-site resolution, and version-bump discipline in
`.claude-plugin/plugin.json`.

Deliver one checker (`scripts/check-invariants.mjs`, stdlib only, read-only), one self-check that
exercises the checker's FAIL and UNKNOWN branches against ephemeral trees
(`scripts/selfcheck-invariants.mjs`), and one GitHub Actions workflow running both. These are the
repo's first executable code and first CI — there is no `package.json`, no existing `scripts/`, no
`.github/`, and no prior tooling convention to match.

The dominant failure mode for this class of tool is the **vacuous green**: a check whose
subject set collapsed to empty reports success and is indistinguishable from a healthy repo.
Every check therefore reports a tri-state verdict and prints its subject count.

## Acceptance Criteria

- AC1: `node scripts/check-invariants.mjs` runs from the repo root with no arguments, runs
  all three checks unconditionally, prints one verdict line per check, and exits 0 when every
  check passes. `--root <dir>` retargets **all three** checks at `<dir>`; no check reads a path
  relative to the process cwd once `--root` is given.
- AC2: The `sentinels` check extracts the verdict keyword from every `[AUTO-SCORE: <word>` occurrence
  under `commands/` and `agents/`, and FAILs when the keyword sets of two participating files
  differ, or when the union contains a keyword outside `{clean, weak, error}`.
    When `commands/ba/plan.md` spells the payload `weak — …` and
    `commands/ba/review-plan.md` spells it `weak — <reviewer list>`, both normalize to `weak`
    and the check PASSes — raw-string comparison would be a false red.
- AC3: The `sentinels` check counts `<<'TOKEN'` heredoc openers and their bare-line terminators
  only inside fenced code blocks, so the prose mention of `__BA_PROPOSE_COMMIT_END__` at
  `commands/ba/propose.md:603` produces no failure, while an opener with no terminator inside
  its own fence does.
- AC4: The `references` check FAILs, naming the reference path, for any `references/*.md` with
  no backticked `` `references/<basename>` `` citation in `commands/**/*.md` or `agents/*.md`.
  A citation appearing only in `agents/` satisfies the requirement; citations from within
  `references/` itself do not.
- AC5: The `version-bump` check FAILs, naming `.claude-plugin/plugin.json`, when the `HEAD~1..HEAD`
  diff touches `commands/`, `agents/`, or `references/` and the `version` value is byte-identical
  at both revisions.
- AC6: Any check whose subject set is empty reports UNKNOWN with the reason, never PASS. A missing
  scan directory, an unreadable file, an absent `git`, or a non-git working tree each produce a
  named UNKNOWN record rather than an uncaught throw. The process exits 1 if any check FAILed,
  otherwise 2 if any check reported UNKNOWN, otherwise 0.
- AC7: Both scripts import only Node built-in modules and declare no dependencies.
  `check-invariants.mjs` performs no filesystem writes and no mutating git operations at all;
  `selfcheck-invariants.mjs` writes only under `os.tmpdir()` and never inside the repo.
- AC8: A GitHub Actions workflow runs the script on `push` to `main` and on `pull_request`, and
  the job fails when the script exits non-zero.
- AC9: The workflow's `actions/checkout` step fetches enough history that `HEAD~1` resolves, so
  the `version-bump` check never degrades to UNKNOWN for want of a parent commit.
- AC10: Every non-PASS record prints the invariant id, a `file:line` location (or `file` when no
  single line applies), and a message. No failure path exits non-zero with only a stack trace.
- AC11: Every FAIL and UNKNOWN branch of all three checks is exercised by
  `node scripts/selfcheck-invariants.mjs`, which builds ephemeral trees under `os.tmpdir()`, runs
  the real `check-invariants.mjs` against them via `--root`, asserts the expected exit code and
  record text per case, and exits non-zero on any mismatch.

## What We're NOT Doing

Each exclusion below is inherited from issue #64, which dropped it with a recorded reason
after the first planning pass verified all five originally-proposed checks against HEAD.

- **No mirror-site obligation check.** `CLAUDE.md`'s convention prose is not machine-readable:
  `README.md` mirrors the `/ba:compound` hand-off exception as a deliberate paraphrase with no
  matching string, backticked paths in the bullets include explicit *non*-sites, and the 6×2
  axis grid is an indented list continuation a naive parser derives zero rows from. Regularizing
  that prose is a separate decision.
- **No registry, and no hardcoded copy of CLAUDE.md's site lists** anywhere in the script. A
  registry was the first pass's workaround for the above and makes the drift-detection tool a
  second source of truth for the very lists it checks. Do not reintroduce one in a later slice.
- **No cited-section-heading check.** Most real citations in the repo are unquoted or lowercased
  prose; a quote-matching detector sees none of them, and fuzzy matching is high complexity for
  low yield.
- **No reviewer-bullet-grammar check.** All 40 candidate lines in `commands/ba/review.md` are
  exempt by the check's own rule; the single concrete example sits mid-paragraph inside an inline
  code span.
- **No Claude Code hook and no committed `.claude/settings.json`.** That would execute a script on
  every `Write`/`Edit` for anyone who clones this public repo.
- **No committed fixture corpus.** The repo itself is the corpus for the PASS paths, and each
  check's `Verify:` runs the script against HEAD. the self-check's negative-path cases are built in
  `os.tmpdir()` at run time and deleted after — nothing is checked in, so there is no fixture
  directory to drift out of sync with the checks. That is the distinction from the rejected
  8-fixture corpus, which was persisted files the checks had to keep matching.
- **No `package.json`, no `setup-node` step, no test framework, no new command or agent.** Both
  scripts run on the runner's preinstalled Node; the self-check's assertions are plain `if`/`throw`, not a
  runner.
- **No `CLAUDE.md` convention line documenting the checker.** Decided separately once it has run
  in CI (see Sources).
- **No README update.** `CLAUDE.md:95` scopes that obligation to commands, agents, and artifact
  paths; a checked-in tool is none of the three, and it is not an artifact of a command run so it
  does not belong in the artifact-path table either.

## Context

**Repo shape.** Pure prose plus JSON manifests. `commands/ba/*.md` (9 files), `agents/*.md`
(17 files), `references/*.md` (3 files: `brainstorm-sections.md`, `html-rendering.md`,
`plan-sections.md`), `.claude-plugin/plugin.json` (currently `"version": "0.36.0"`).
`.gitignore` contains only `docs/reviews/`.

**Prior art in git history.** Reverted commit `976a477` (`feat(scripts): tri-state verdict
skeleton for structural invariant checks`, reverted by `67d1b09`) contains an 87-line
`scripts/check-invariants.mjs` skeleton: `VERDICT_CODE`, `formatRecord`, `exitCodeForRecords`,
`report`, `parseArgs` (`--only`, `--root`), a three-entry `CHECKS` registry with
`notImplemented` stubs, and `main`. Recover it with
`git show 976a477:scripts/check-invariants.mjs`. It is the starting point for U1, with two
corrections noted there. The over-scoped plan that commit's message refers to is not on disk.

**Verified facts the checks rest on** (all confirmed against HEAD during planning):

| Fact | Location |
|---|---|
| `[AUTO-SCORE: …]` emitted (declaration + flow list) | `commands/ba/review-plan.md:578,579,581,595,597,601` |
| `[AUTO-SCORE: …]` parsed | `commands/ba/plan.md:676,677,680,685` |
| Emitter spells `weak — <reviewer list>`; parser abbreviates to `weak — …` at `:680`, `error — …` at `:685` | as above |
| `__BA_PROPOSE_COMMIT_END__` opener / terminator, inside fence `592-601` | `commands/ba/propose.md:594,598` |
| `__BA_PROPOSE_COMMIT_END__` prose mention, outside any fence | `commands/ba/propose.md:603` |
| `__BA_PROPOSE_BODY_END__` opener / terminator, inside fence `680-711`, **no** prose twin | `commands/ba/propose.md:682,684` |
| The only two `<<'TOKEN'` heredoc openers in `commands/`, `agents/`, `references/` | `commands/ba/propose.md:594,682` |
| Reference load site in `agents/` — each backticked path intact on its own line, only the sentence wraps | `agents/convention-checker.md:130,131` |
| Four-backtick fences containing nested three-backtick fences | `commands/ba/plan.md:250-287,291-355,359-469`; `review-plan.md:425-449`; `review.md:628-666` |
| Indented fences (2–3 leading spaces) | `commands/ba/plan.md:610,615`; `propose.md:210,218`; `review.md:21,23`; `brainstorm.md:391,394`; `execute.md:527,532` |

**Citation form.** Every `references/*.md` citation in the repo is the repo-relative path in
inline backticks — `` `references/html-rendering.md` ``. A grep for non-backticked forms returns
zero hits, so the check needs no other form.

**Conventions that apply.** `CLAUDE.md:73` (bump `plugin.json` version — it is the auto-update
cache key, so it cannot be deferred to a later commit). `CLAUDE.md:95` (README) and `CLAUDE.md:97`
/ `.claude/agent_docs/prompt-authoring.md` are both path-scoped to `commands/`, `agents/`,
`references/` and are **not** triggered — this diff edits no prompt file. No convention constrains
where non-prompt tooling lives or how a script or workflow file is named.

**Output contract as a machine boundary.** The exit-code mapping, the FAIL-outranks-UNKNOWN
precedence, and the record line format are read by CI and by humans, so they are specified to the
character below. Per `CLAUDE.md:97`'s category test that precision is correct, not
over-specification.

## MVP

### U1 — Script skeleton: verdict core, check registry, exit precedence

Create `scripts/check-invariants.mjs` starting from the reverted skeleton
(`git show 976a477:scripts/check-invariants.mjs`). Keep its `VERDICT_CODE`
(`PASS: 0, FAIL: 1, UNKNOWN: 2`), `formatRecord`, `parseArgs` (`--only <id>`, `--root <dir>`),
the three-entry `CHECKS` registry keyed `sentinels` / `references` / `version-bump`, and `main`'s
try/catch that maps a thrown error to exit 2.

Four corrections to the recovered code:

1. **Replace `exitCodeForRecords`' `Math.max` fold.** `Math.max` gives UNKNOWN (2) precedence over
   FAIL (1), so a broken invariant reported alongside an unrelated UNKNOWN exits 2 and reads as
   "couldn't tell" instead of "broken". Precedence is: any FAIL → 1, else any UNKNOWN → 2, else 0.
   The same precedence folds a single check's records into its one verdict line.
2. **Always run all three checks and print a verdict line for each**, including PASS. The recovered
   `report` prints only non-PASS records, which leaves a green run silent about which checks
   actually ran — the exact ambiguity that makes a vacuous green invisible. Per-check verdict lines
   carry the subject count **and a reason**: `<id>: <VERDICT> (<n> <subject noun>) — <reason>`. The
   reason is mandatory on every verdict including PASS, because two PASSes with identical subject
   counts can mean different things — see U4, where `not applicable — no prompt-surface paths
   changed` and `version 0.36.0 → 0.37.0` both report the same three comparison inputs. A verdict
   line that cannot distinguish "verified" from "nothing to verify" reintroduces the vacuous green
   one level up.
3. **Thread `opts.root` through every path resolution.** The recovered `parseArgs` accepts
   `--root <dir>` but the checks must all honor it: `walkMarkdown` and the `references/` glob join
   against `opts.root`, and U4's `execFileSync` passes `{cwd: opts.root}`. A flag honored by one
   check and ignored by the others is worse than no flag — `--root ../other` would scan this repo's
   prompt files while diffing the other repo's history, and no verdict would reveal it. The self-check is the
   consumer that makes the flag load-bearing rather than decorative.
4. **Make helper IO failures named records, not throws.** `walkMarkdown` on a missing directory and
   `readLines` on an unreadable file both throw, and `main`'s blanket catch turns either into a bare
   stack trace at exit 2 with no invariant, file, or message — violating AC10 and losing the one
   thing the operator needs. Both helpers return a result the caller can convert into an UNKNOWN
   record naming the path and the failed operation. This is the mirror-image of the vacuous green:
   an opaque crash where a named UNKNOWN belongs.

Each check is a function `(opts) => Record[]`, where a `Record` is
`{ invariant, file, line, verdict, message }` with `line` nullable. `formatRecord` renders
`<invariant> — <file>:<line> — <message>`, collapsing to `<invariant> — <file> — <message>` when
`line` is null. Non-PASS records print after the verdict lines.

Shared helpers, defined here because all three checks use them:

- `readLines(root, relPath) → {lines} | {error}` — `fs.readFileSync`, split on `\n`, no trimming
  (line numbers are 1-based indices into `lines`). Returns an error result rather than throwing.
- `walkMarkdown(root, relDir) → {files} | {error}` — recursive
  `fs.readdirSync(..., {withFileTypes: true})`, `.md` only, paths relative to `root`, sorted for
  deterministic output. A missing `relDir` is an error result, not a throw. Recursion is what lets
  one helper serve both the flat `agents/` and the nested `commands/ba/`; it is bounded by the
  corpus having no directory below `commands/ba/`, and a future nested directory would be picked up
  silently — acceptable, since a new prompt file joining the corpus is the desired behavior.

`fencedRegions` is defined in U2, not here — it has one consumer and belongs beside the fence rules
it implements.

Stub the three checks as `UNKNOWN — check not implemented yet` for this unit, as the recovered code
does. A skeleton wired to CI before the checks land must not read as a passing suite.

Test scenarios:
- Running with no arguments prints three verdict lines and exits 2 while all three checks are
  stubbed. (Covers AC1, AC6)
- `--only sentinels` runs exactly one check; `--only bogus` prints an unknown-check-id error and
  exits 2. (Covers AC1)
- `--root <dir>` pointed at a directory with no `commands/` yields a named UNKNOWN per affected
  check, not a stack trace, confirming every check honors the flag. (Covers AC1, AC6, AC10)
- A record with `line: null` renders as `<invariant> — <file> — <message>` with no stray colon.
  (Covers AC10)
- Every verdict line, PASS included, carries a reason after the subject count. (Covers AC10)
- The script imports only `node:fs`, `node:path`, and `node:child_process`. (Covers AC7)

Verify: `node scripts/check-invariants.mjs --only sentinels; test $? -eq 2` — asserts the registry, dispatch, verdict mapping, and exit-code path are connected end to end while the check is still a stub.

### U2 — Check `sentinels`

Two sub-assertions, both emitting records under the invariant id `sentinels`. Corpus for both:
`walkMarkdown('commands')` plus `walkMarkdown('agents')`. `docs/` is excluded — plans and research
docs quote these sentinels as prose and are not participants in the contract.

**(a) `[AUTO-SCORE: …]` verdict-keyword agreement.** For each corpus file, extract every match of
`/\[AUTO-SCORE:\s*([a-z]+)/g` and collect the captured keywords into a set. A file with a non-empty
set is a *participant*. Then:

- Every participant's keyword set must be identical. When two differ, FAIL naming each participant
  with the first line of a keyword the other lacks.
- The union must be a subset of `{clean, weak, error}`. A keyword outside it FAILs at its line — a
  typo'd or newly invented verdict must red loudly rather than quietly widening the contract.
- Fewer than two participants → UNKNOWN (`expected an emitter and a parser, found <n>`). On HEAD
  there are exactly two: `commands/ba/review-plan.md` and `commands/ba/plan.md`, each yielding
  `{clean, weak, error}`.

Normalizing to the first payload word is what makes this green on HEAD: the emitter spells
`weak — <reviewer list>` while `commands/ba/plan.md:680` abbreviates to `weak — …`, so a
raw-string set comparison would be a false red. Participants are *discovered* by the grep rather
than hardcoded to the two filenames, so a future third mention under `commands/` or `agents/`
joins the check instead of drifting past it.

**(b) Fence-scoped heredoc sentinel pairing.** Define `fencedRegions(lines) → Array<{start, end}>`
in this unit (its only consumer), compute it per file, then for each
`<<'TOKEN'` opener *inside* a fenced region, require exactly one line inside the **same** region
whose trimmed content equals `TOKEN` exactly. Zero or more than one → FAIL at the opener's line.
Openers outside any fenced region → FAIL at that line (a heredoc in prose is either a typo or a
fence that never opened).

Fence rules, per CommonMark, because the repo exercises all three edge cases:

- An opener is a line matching `/^ {0,3}(`{3,}|~{3,})/`. Up to three leading spaces are allowed —
  the repo has ten indented fences (`commands/ba/propose.md:210,218` among them), and a `^```
  `-anchored scanner mis-pairs from the first one onward and can place `propose.md:594` outside any
  region, collapsing this sub-assertion to zero subjects.
- Record the opener's fence character and run length. Close only on a line whose run uses the *same*
  character with length **≥** the opener's. The repo has four-backtick fences containing nested
  three-backtick fences (`commands/ba/plan.md:250-287` and four more), which a
  length-blind scanner splits into wrong regions.
- A fence still open at EOF → UNKNOWN for that file, naming the opener line. Do not guess a closer.
- Zero heredoc openers found across the whole corpus → UNKNOWN. HEAD has exactly two
  (`commands/ba/propose.md:594` and `:682`).

The prose mention at `commands/ba/propose.md:603` is excluded by the bare-line terminator test on
its own — the token there is wrapped in single quotes inside inline backticks, so it never equals
`TOKEN` after trimming. Fence-scoping is what handles the indent and nesting problems, and what
keeps a *future* prose mention inside no fence from being counted as a terminator.

Test scenarios:
- Against HEAD, `sentinels` PASSes and reports non-zero subject counts for both sub-assertions.
  (Covers AC2, AC3)
- `commands/ba/propose.md:603`'s prose mention produces no record. (Covers AC3)
- A file whose `[AUTO-SCORE:` keyword set is `{clean, weak}` while another's is
  `{clean, weak, error}` FAILs, naming both files and the missing keyword's line. (Covers AC2, AC11)
- `[AUTO-SCORE: warn]` anywhere in the corpus FAILs at its line. (Covers AC2, AC11)
- A `<<'TOKEN'` opener inside a four-backtick fence whose terminator sits inside a nested
  three-backtick fence is still paired correctly. HEAD has no such case — every heredoc there sits
  in a plain three-backtick fence — so this is a self-check case. (Covers AC3, AC11)
- An opener whose fence is never closed before EOF yields UNKNOWN for that file. (Covers AC6, AC11)
- A corpus with no heredoc openers at all yields UNKNOWN, not PASS. (Covers AC6, AC11)

Verify: `node scripts/check-invariants.mjs --only sentinels | grep -E 'sentinels: PASS \(.*[1-9]'` — exits 0 only when the check passes against HEAD *and* reports a non-zero subject count, so a scanner that silently found nothing fails this line.

### U3 — Check `references`

Subjects are the entries of `references/*.md` (top-level only, no recursion — the directory is
flat). Search corpus: `walkMarkdown('commands')` plus `walkMarkdown('agents')`.

For each reference file, search the corpus for the literal string `` `references/<basename>` ``
(backticks included) on a single line. Zero hits → FAIL, naming the reference file with `line: null`
and a message stating it has no load site. `references/` itself is excluded from the corpus:
reference files cross-cite each other (`references/html-rendering.md:5` cites the other two), and
counting those would let the three satisfy each other with no command or agent ever loading them.

Deliberately narrow matching, in both directions:

- **Backticked and single-line.** Loosening to a bare filename would make every reference trivially
  cited by prose that merely mentions it. Every citation in the repo already uses the backticked
  form — a grep for non-backticked forms returns zero hits — so nothing legitimate is missed.
- **No cross-line joining.** `agents/convention-checker.md:130-131` wraps its *sentence* across a
  line break, but each backticked path is intact on its own line, so no joiner is needed. Building
  one would add a false-green path (two unrelated lines joining into a spurious match) for zero
  coverage.

`agents/` must be in the corpus, not just `commands/`. Restricting to `commands/` encodes a false
model of where references load from. This check would still pass at HEAD with `agents/` omitted —
each of the three files is also cited from a command — so the repo cannot prove the corpus spans
`agents/`. A grep for the string `'agents'` in the script proves nothing either: it matches a
comment, an unrelated literal, or another check's corpus list, so it would let exactly the
regression it guards against pass. The proof is behavioral and lives in the self-check — a scratch tree whose
only citation of a reference sits in `agents/`, which must PASS. U3's own `Verify:` asserts the
check passes at HEAD; the self-check's case is what pins the corpus.

Empty `references/*.md` glob, or an empty search corpus → UNKNOWN.

Test scenarios:
- Against HEAD, all three reference files resolve and the check PASSes with subject count 3.
  (Covers AC4)
- A new `references/foo.md` with no citation anywhere FAILs, naming `references/foo.md`.
  (Covers AC4, AC10)
- A reference cited only from `agents/convention-checker.md` PASSes — exercised by the self-check, since HEAD
  cannot distinguish it. (Covers AC4, AC11)
- A reference cited only from another file under `references/` FAILs. (Covers AC4, AC11)
- An empty `references/` directory yields UNKNOWN, not PASS. (Covers AC6, AC11)

Verify: `node scripts/check-invariants.mjs --only references; test $? -eq 0` — the HEAD PASS path only; the corpus-spans-`agents/` claim is pinned by the self-check's case, not by this line.

### U4 — Check `version-bump`

Compare `HEAD~1` to `HEAD` using `child_process.execFileSync('git', [...], {cwd: opts.root})` —
never a shell string, and never a mutating subcommand. Three reads:

1. `git rev-parse --verify HEAD~1^{commit}` — resolve the base.
2. `git diff --name-only HEAD~1 HEAD` — the changed path set.
3. `git show HEAD~1:.claude-plugin/plugin.json` and `git show HEAD:.claude-plugin/plugin.json` —
   the two blobs, each `JSON.parse`d for `version`.

Verdict table — this is the decision, and it is the reason the check does not treat "no relevant
paths changed" as a zero-subject UNKNOWN:

| Condition | Verdict |
|---|---|
| `git` not on `PATH` (`execFileSync` throws `ENOENT`) | UNKNOWN |
| `opts.root` is not a git working tree | UNKNOWN |
| `HEAD~1` unresolvable (initial commit, shallow clone) | UNKNOWN |
| Either `plugin.json` blob missing or unparseable at its rev | UNKNOWN |
| Either blob parses but has no `version` key, or its value is not a non-empty string | UNKNOWN |
| Inputs readable; diff touches none of `commands/`, `agents/`, `references/` | PASS (not applicable) |
| Diff touches one of them; trimmed `version` values differ | PASS |
| Diff touches one of them; trimmed `version` values equal | FAIL at `.claude-plugin/plugin.json` |

Every row above is produced by a **local** try/catch around the git reads and the two
`JSON.parse` calls, converted into an UNKNOWN record naming the git command or the parse that
failed. None of them may reach `main`'s blanket catch: that path exits 2 with a bare stack trace and
no invariant, file, or message, which violates AC10 and tells the operator nothing about which
invariant went dark. `main`'s catch stays as a last-resort backstop for genuinely unforeseen errors,
not as this check's error handling.

The comparison trims both `version` values before comparing, and requires each to be a non-empty
string. Without that, a trailing space added to one blob's version counts as "values differ" and
produces a PASS that is not a real bump — a false green inside the one check deliberately carved out
of the zero-subject guard. A JSON number or `null` for `version` is UNKNOWN, not a comparison.

This check's subjects are its **comparison inputs** — a resolvable base and two readable blobs —
not the changed path set. Applying "zero subjects → UNKNOWN" to the path set instead would exit 2
on every commit touching only `scripts/`, `docs/`, or `README.md`, which is the normal case for this
repo and includes this branch's own HEAD. The zero-subject guard still bites where a vacuous green
is the real risk: U2 and U3.

Because both PASS rows report the same three comparison inputs, the subject count alone cannot tell
them apart in a CI log — which is why U1's verdict line carries a mandatory reason. This check's two
PASS reasons are `not applicable — no prompt-surface paths changed` and
`version <old> → <new>`. Without the reason suffix, "nothing needed checking" and "checked and
correct" render identically, and the ambiguity this whole check is built to avoid reappears in its
own output.

Path matching is a prefix test on the `git diff --name-only` output against `commands/`, `agents/`,
and `references/`. Every UNKNOWN message names the git command that produced it, so a CI amber is
diagnosable from the log alone.

Test scenarios:
- On this branch's HEAD (whose parent diff touches only `scripts/`), the check PASSes with the
  not-applicable reason. (Covers AC5)
- A commit editing `commands/ba/plan.md` without bumping `version` FAILs, naming
  `.claude-plugin/plugin.json`. (Covers AC5, AC10, AC11)
- The same commit with `version` bumped PASSes and prints the old → new pair. (Covers AC5, AC11)
- Two revs whose `version` differs only by trailing whitespace FAIL, not PASS. (Covers AC5, AC11)
- In a repo cloned with `--depth 1`, `HEAD~1` is unresolvable and the check reports UNKNOWN naming
  the failed `git rev-parse`, and the process exits 2. Runnable as
  `git clone --depth 1 . <tmp> && node scripts/check-invariants.mjs --root <tmp> --only version-bump`.
  This is the check degrading gracefully, which is AC6 — AC9 is the separate claim that the
  workflow's fetch depth keeps CI from ever reaching this state. (Covers AC6, AC11)
- Running outside a git working tree, and with `git` absent from `PATH`, each yield a named UNKNOWN
  rather than a stack trace. (Covers AC6, AC10, AC11)
- No `git` invocation in the check writes to the repo or the index. (Covers AC7)

Verify: `node scripts/check-invariants.mjs --only version-bump; test $? -eq 0` — passes against this branch's HEAD via the not-applicable path, and fails if the git reads or the JSON parse are miswired (either would produce UNKNOWN and exit 2).

### U5 — GitHub Actions workflow, self-check, and version bump

Create `.github/workflows/invariants.yml`:

- `name: invariants`
- Triggers: `push` with `branches: [main]`, and `pull_request` (all target branches).
- One job on `ubuntu-latest` with `permissions: contents: read`.
- Step 1: `actions/checkout@v4` with `fetch-depth: 0`.
- Step 2: `run: node scripts/selfcheck-invariants.mjs`. It runs **first**: if the checker's own
  FAIL and UNKNOWN branches are broken, the next step's verdict cannot be trusted, and a green
  checker run would be evidence of nothing.
- Step 3: `run: node scripts/check-invariants.mjs`. No `setup-node` — both scripts are stdlib-only
  and the runner's preinstalled Node satisfies them. The job fails on any non-zero exit, so both
  FAIL (1) and UNKNOWN (2) are red in CI; that is intended, since an UNKNOWN means the repo could
  not be checked.

`fetch-depth: 0` rather than `2`. Issue #64's requirement is "2 or more", and 0 (full history)
satisfies it. The reason for 0 over 2: on `pull_request`, GitHub checks out an ephemeral merge
commit whose first parent is the base branch tip, so `HEAD~1` compares base→merge — the PR's
cumulative diff, which is the semantics this check wants — but a shallow fetch of a merge ref at
depth 2 can leave that parent grafted, making the comparison silently truncated. Full history on a
repo this size costs nothing and removes the edge case. Carry this reasoning as a comment in the
YAML; a later "optimization" to `fetch-depth: 1` is exactly the regression AC9 exists to prevent.

Bump `.claude-plugin/plugin.json` `version` from `0.36.0` to `0.37.0` (`CLAUDE.md:73`; the version
is the auto-update cache key, so it ships with the change rather than after it). Note this diff
touches no prompt-surface path, so the `version-bump` check itself does not require the bump — the
convention does.

**This unit's verification is CI-only, and the plan says so rather than implying otherwise.** Nothing
local can execute a GitHub Actions trigger, so all four scenarios below are confirmed by watching the
first real run — they are not covered by the `Verify:` line, which can only assert the YAML says what
it should. That is the "proves text exists" pattern `.claude/agent_docs/prompt-authoring.md` warns
about, and it is unavoidable here; naming it is the honest alternative to a `Verify:` line that
pretends to more. The first pull request opened after this lands **is** the test — treat a missing or
red check on it as an unfinished U5, not as a flaky CI.

Test scenarios (all confirmed only on the first real CI run):
- Opening a pull request triggers the workflow, and a PR that breaks an invariant shows a failed
  check. (Covers AC8)
- A push to `main` triggers the workflow; a push to any other branch does not. (Covers AC8)
- The `version-bump` check reports a real verdict rather than UNKNOWN in the CI log, confirming
  `HEAD~1` resolved under the configured fetch depth. (Covers AC9)
- The self-check step runs before the checker step and both are green, with three PASS lines carrying
  reasons in the checker's log. (Covers AC1, AC11)

**Static assertions for the workflow file:** `grep -q 'fetch-depth: 0' .github/workflows/invariants.yml && grep -q 'node scripts/selfcheck-invariants.mjs' .github/workflows/invariants.yml && grep -q 'node scripts/check-invariants.mjs' .github/workflows/invariants.yml && grep -q 'branches: \[main\]' .github/workflows/invariants.yml && grep -q '"version": "0.37.0"' .claude-plugin/plugin.json` — checkout depth, both script invocations, the push trigger, and the version bump. Rolled into this unit's single `Verify:` below; it cannot prove the workflow runs.

**Self-check script (part of this unit).**

Create `scripts/selfcheck-invariants.mjs`. Node stdlib only. It builds ephemeral trees with
`fs.mkdtempSync(path.join(os.tmpdir(), 'ba-invariants-'))`, runs the **real**
`check-invariants.mjs` against each via `execFileSync('node', [checker, '--root', tmp, '--only', id])`,
asserts the exit code and that stdout contains an expected substring, removes the tree with
`fs.rmSync(tmp, {recursive: true, force: true})` in a `finally`, and exits 1 on the first mismatch
after printing which case failed and what it got instead.

This exists because the repo at HEAD is green by construction: every `Verify:` line in U1–U5 can only
prove a PASS path. A regression that breaks a FAIL or UNKNOWN branch — the branches that carry the
tool's entire value — would ship silently and stay silent until a real violation happened to arrive,
at which point the checker would report green and the invariant would be broken with nothing to say
so. That is the vacuous green one level up: not a check with no subjects, but a *suite* that only ever
exercises success.

Trees are ephemeral — created under `os.tmpdir()` and removed in a `finally`, nothing committed.
This is also what makes `--root` load-bearing: without a consumer, U1's flag is a trap.

Cases, each a minimal tree containing only what the case needs. Every case names the invariant it
targets, and the assertion is on exit code **and** an expected fragment of the record line, so a case
passing for the wrong reason is caught:

- `sentinels` FAIL — two files whose `[AUTO-SCORE:` keyword sets differ.
- `sentinels` FAIL — a file containing `[AUTO-SCORE: warn]`.
- `sentinels` FAIL — a heredoc opener with no terminator inside its fence.
- `sentinels` PASS — a heredoc opener inside a four-backtick fence whose terminator sits inside a
  nested three-backtick fence. HEAD has no such case, so this is the only place the run-length rule
  is actually exercised.
- `sentinels` PASS — a bare-line token appearing only outside any fence does not count as a
  terminator.
- `sentinels` UNKNOWN — a corpus with fewer than two `[AUTO-SCORE:` participants.
- `sentinels` UNKNOWN — a corpus with no heredoc openers.
- `sentinels` UNKNOWN — a fence left open at EOF.
- `references` FAIL — a `references/foo.md` cited nowhere.
- `references` FAIL — a reference cited only from another file under `references/`.
- `references` PASS — a reference cited **only** from a file under `agents/`. This is the case that
  pins U3's corpus; dropping `agents/` from the corpus turns it red, which no HEAD-based check can do.
- `references` UNKNOWN — an empty `references/` directory.
- `version-bump` FAIL — a scratch git repo (`git init`, two commits) touching `commands/` with
  `version` unchanged.
- `version-bump` FAIL — the same, with `version` differing only by trailing whitespace.
- `version-bump` PASS — the same, with a real bump.
- `version-bump` PASS — a second commit touching only `docs/`, expecting the not-applicable reason.
- `version-bump` UNKNOWN — a directory that is not a git working tree.
- `version-bump` UNKNOWN — a single-commit repo, so `HEAD~1` is unresolvable.
- Any check UNKNOWN — a `--root` whose `commands/` directory is absent, asserting a named record
  rather than a stack trace.

The `version-bump` cases need a real git history, so those trees run `git init`, `git commit` with
`-c user.email=… -c user.name=…` and `--no-gpg-sign` so the case does not depend on the runner's git
identity or signing config. All of it stays under `os.tmpdir()`; nothing writes to the repo.

Test scenarios:
- `node scripts/selfcheck-invariants.mjs` exits 0 with every case passing, and prints one line per
  case. (Covers AC11)
- Reverting U1's FAIL-outranks-UNKNOWN precedence makes at least one case fail. (Covers AC11)
- Removing `agents/` from the `references` corpus makes the `agents/`-only case fail. (Covers AC4, AC11)
- Removing the run-length awareness from `fencedRegions` makes the nested-fence case fail.
  (Covers AC3, AC11)
- Every temp tree is removed even when a case throws mid-run. (Covers AC7)
- No case writes anywhere outside `os.tmpdir()`. (Covers AC7)

Verify: `node scripts/selfcheck-invariants.mjs >/dev/null 2>&1 && grep -q 'fetch-depth: 0' .github/workflows/invariants.yml && grep -q 'node scripts/selfcheck-invariants.mjs' .github/workflows/invariants.yml && grep -q 'node scripts/check-invariants.mjs' .github/workflows/invariants.yml && grep -q 'branches: \[main\]' .github/workflows/invariants.yml && grep -q '"version": "0.37.0"' .claude-plugin/plugin.json` — runs the whole negative-path case matrix **and** statically asserts the workflow wiring and the version bump. The self-check writes only under `os.tmpdir()`, leaving the repo untouched, so it stays safe for `derive-state` to run.

## Sources

- Origin: GitHub issue #64 — `[roadmap] Structural assertions for cross-file invariants`
  (`cluster:infra`, `ready`). Split from #7; the three-check scope, the dropped-checks findings, and
  the GitHub-Actions-only execution surface all come from its 2026-07-28 rescope. Now independent of
  #59 — dropping the mirror-site check removed the argument that #64 must land first.
- Prior art: reverted commit `976a477` (`git show 976a477:scripts/check-invariants.mjs`), reverted by
  `67d1b09`. The verdict core and CLI dispatch are recovered from it in U1.
- Conventions: `CLAUDE.md:73` (version bump), `CLAUDE.md:95` (README scope — not triggered),
  `CLAUDE.md:97` and `.claude/agent_docs/prompt-authoring.md` (prompt-surface scope — not
  triggered; its "verification that only proves the text exists" rule is why U1–U4 and the self-check run the
  script rather than grepping for prose, and why U5 — which cannot, since no local command triggers
  a GitHub Actions run — states that limitation outright instead of dressing a grep up as coverage).
- Sentinel contract: `commands/ba/review-plan.md:566-601` (`## Auto-invoke contract`, the owner) and
  `commands/ba/plan.md:665-686` (`### Auto-score pass`, the citing consumer).
- Heredoc sentinels: `commands/ba/propose.md:592-605` and `:680-711`, including the single-call
  invariant at `:605` that makes the heredoc load-bearing.
- Reference load sites: `agents/convention-checker.md:130-131`; `references/html-rendering.md:5`.

## Deferred decisions

Recorded here so a later slice does not resolve them by accident:

- **Whether `CLAUDE.md` gains a convention line naming this checker.** Once it lands, the script is
  a second authority over `commands/`, `agents/`, and `references/` text alongside `CLAUDE.md`, and
  nothing currently documents that. Deliberately left out of this plan; decide after the checker has
  run in CI against real pull requests.
- **Whether `CLAUDE.md`'s mirror-site convention prose gets regularized** into a form a checker can
  read. This is the actual blocker behind the dropped mirror-site check, and it is a decision about
  the convention, not about tooling.

## Convention Compliance

- [x] `CLAUDE.md:73` — version bump to `0.37.0` included in U5, not deferred
- [x] `CLAUDE.md:81` — plan carries decisions, not code; no literal code block, so no
  `**Code-shape decision:**` label is needed
- [x] `CLAUDE.md:82` — unit anchors are `### U<n> — <title>` with an em dash
- [x] `CLAUDE.md:95` — README obligation not triggered (no command, agent, or artifact path changes);
  recorded in `## What We're NOT Doing`
- [x] `CLAUDE.md:97` / `prompt-authoring.md` — not triggered; this diff edits no prompt file, so no
  fixture A/B is required and the change is testable by running it
- [x] Planning command wrote no code — this artifact only
- [x] Every unit carries `Test scenarios:` with `(Covers AC<n>)` tags and exactly one code-matchable
  `Verify:`; U1–U4 are read-only, the self-check's writes are confined to `os.tmpdir()` and never touch the repo
- [x] Convention-checker agent run before write — no violations found
- [x] Plan review pass applied: U1, U3, U4, U5 Must-Address findings resolved. U2's record-folding
  question was answered incidentally by U1's precedence correction; the remaining Consider finding —
  whether a `<<'TOKEN'` opener outside any fence should FAIL, given a future prose sentence
  explaining heredoc syntax would trip it — is deliberately left for execution
