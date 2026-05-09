---
date: 2026-05-09T00:00:00Z
researcher: Claude
git_commit: 5634f2fd9f225904b1fa01f46af48a566f48877d
branch: claude/compare-code-review-IASs9
repository: dev-workflow
topic: "ce-review benchmark methodology (PR #434) and shaping a similar setup for /ba:review"
tags: [research, benchmark, evaluation, ce-review, ba-review, signal-to-noise, contract-tests]
status: complete
last_updated: 2026-05-09
---

# Research: `ce-review` benchmark methodology (PR #434) and shaping a similar setup for `/ba:review`

**Date**: 2026-05-09
**Git Commit**: 5634f2fd9f225904b1fa01f46af48a566f48877d
**Branch**: claude/compare-code-review-IASs9
**Repository**: dev-workflow

## Research Question

PR https://github.com/EveryInc/compound-engineering-plugin/pull/434
("feat(ce-review): improve signal-to-noise with confidence rubric, FP
suppression, and intent verification") describes a benchmark that
demonstrates a ~49% reduction in false-positive findings on clean code
without losing sensitivity on buggy code. The benchmark itself does
not appear to be committed to the repo.

What can we learn from PR #434 — methodology, metrics, fixtures — and
what's the minimum-viable shape of a similar setup for `/ba:review`
that downstream `/ba:brainstorm`, `/ba:plan`, and `/ba:execute` phases
can pick up?

This document is intentionally framed as research input to feed those
later phases — it describes the problem space, prior art, and concrete
options without committing to a design.

## Summary

PR #434 documents a benchmark in its description but **does not commit
the benchmark itself**. None of the changed files are under
`tests/`, `evals/`, `benchmarks/`, or `fixtures/`. The repo's
`tests/` dir contains 47 `*.test.ts` files, but the review-related ones
(`review-skill-contract.test.ts`, `pipeline-review-contract.test.ts`)
are **contract tests** (they assert that `SKILL.md` and reference
files contain specific schema strings and fixture invariants — not
runtime evals on model output).

The PR's benchmark uses three eval types — **planted-bug**,
**large-refactor**, **feature-intent** — with three metric families:
**sensitivity** (do we still catch real bugs?), **specificity** (how
much noise on clean code?), and **efficiency** (tokens, duration, tool
uses). 3 runs per configuration. Wins reported with mean ± stddev.

Replicating this in dev-workflow has two clean layers, each
independently valuable:

- **Contract tests** for the `/ba:review` reviewer schema and command
  invariants — like `tests/review-skill-contract.test.ts` upstream.
  These catch *configuration drift* in reviewer prompts, schema
  fields, and command structure. Fast, deterministic, no model calls.
  Cheap. The dev-workflow repo currently has **no test runtime at
  all** — adding one is its own decision.

- **A benchmark harness** that runs `/ba:review` against a small
  curated set of fixture diffs and records sensitivity, specificity,
  and efficiency metrics. Slow, non-deterministic, requires model
  calls. Expensive. Highest value for measuring whether changes to
  reviewer prompts (e.g., a future port of confidence rubric or FP
  suppression) actually improve signal-to-noise.

The two layers are decoupled — we can adopt contract tests without a
benchmark, or build a benchmark scaffold without writing contract
tests first.

## Detailed Findings

### What PR #434 actually changed (the *substance* being measured)

Five files in `plugins/compound-engineering/skills/ce-review/` and one
new agent. None are tests or fixtures.

1. `references/subagent-template.md` (+24/-1) — added 6-tier
   confidence rubric (0.00–1.00), false-positive suppression
   categories (pre-existing issues, style nitpicks, intentional
   patterns, issues handled elsewhere, code restatements, generic
   "consider" advice), and intent verification block
   (`<pr-context>` containing PR title/body/URL).
2. `references/findings-schema.json` (+4/-3) — refined confidence
   tier descriptions; added P0 exception ("P0 findings at 0.50+ may
   be reported").
3. `references/persona-catalog.md` (+3/-2) — bumped persona count
   15 → 16; added `previous-comments-reviewer`.
4. `SKILL.md` (+31/-11) — model tiering (Haiku for personas,
   default for orchestrator), cross-reviewer agreement boost (+0.10
   confidence when 2+ reviewers flag same issue), disagreement
   resolution.
5. `agents/review/previous-comments-reviewer.md` (+60) — new
   conditional persona that pulls prior PR review threads via `gh`
   CLI to track whether feedback has been addressed.

### Benchmark methodology (verbatim where retrievable)

From the PR description:

- **Sensitivity (planted-bug):**
  - `deduplicateAgents` no-op filter (logic error) — 3/3 caught (new),
    3/3 caught (old)
  - `sanitizeDescription` off-by-one (contract violation) — 3/3 caught
    (new), 3/3 caught (old)
- **Specificity (large-refactor, clean code):**
  - 1.7 ± 0.9 findings (new) vs 3.3 ± 0.5 findings (old) — **−49%**
- **Efficiency (per run):**
  - Tokens: 69.4K vs 71.9K (−3.6%)
  - Duration: 48.7s vs 53.6s (−9.2%)
  - Tool uses: 8.9 vs 10.6 (−16.5%)
- **Test plan:**
  - Planted-bug eval: 3 runs per config, 3/3 catches expected
  - Large-refactor eval: 3 runs per config, fewer findings expected
  - Feature-intent eval: 0 findings (new) vs 3 false positives (old)
  - Existing contract tests pass (`bun test`)

### What is *not* in the repo

- No `evals/`, `benchmarks/`, `eval/`, or `bench/` directory.
- No fixture diffs under `tests/fixtures/` matching the planted-bug
  or large-refactor eval (the only review-related fixture is
  `tests/fixtures/ce-code-review-stable-numbering.md`, which is a
  *output-shape* fixture for contract testing).
- No harness script that runs the skill N times, captures stdout,
  parses findings, and computes metrics. The methodology lives in
  the PR description.
- No reference results or thresholds checked into a CI gate. There's
  no "sensitivity must stay 3/3" or "specificity must improve"
  automated check.

### What contract tests upstream actually do (worth modeling)

`tests/review-skill-contract.test.ts` uses Bun's `expect()` with
`toContain()` / `toMatch()` to assert that markdown and JSON files
contain specific strings. Examples:

- Asserts `SKILL.md` documents `mode:autofix`, `mode:report-only`,
  `mode:headless` and the rule `"Do not write run artifacts"`.
- Validates the four routing options `(A)…(D)` exist.
- Parses `findings-schema.json` and asserts the `autofix_class` enum
  is exactly `["safe_auto", "gated_auto", "manual", "advisory"]`.
- Asserts the 5-anchor confidence rubric strings appear verbatim
  (`0 -- Not confident`, `25 -- Somewhat confident`,
  `50 -- Moderately confident`, `75 -- Highly confident`,
  `100 -- Absolutely certain`).
- Scans all 18 persona agent files and rejects any float-style
  `0.\d{2}+` pattern (forces anchor language only).
- Loads fixture `tests/fixtures/ce-code-review-stable-numbering.md`
  and asserts findings IDs `[1, 2, 3]` are reused between primary
  and residual tables.
- Verifies `lfg/SKILL.md` invokes `ce-code-review` with
  `mode:autofix` (cross-skill orchestration contract).

These are essentially **structural lint** for the prompt files —
they make sure that schema, anchor language, mode strings, and
inter-skill calls don't drift silently.

### Where dev-workflow stands today (test infrastructure)

- **No test runtime.** No `package.json`, no `bun.lock`, no
  `vitest.config`, no test files. The repo is pure markdown agents
  and commands plus YAML/JSON metadata. Adding any test layer is a
  net-new infrastructure decision.
- **No benchmark scaffold.** No `evals/`, no `benchmarks/`, no
  fixture diffs.
- **`/ba:review` itself is markdown.** Its dispatch logic lives in
  prose-with-bash-blocks (see `commands/ba/review.md:117-160` for
  scope detection, `:281-336` for parallel reviewer dispatch).
  Driving it from a harness means invoking Claude Code itself with
  the slash command (or simulating the dispatch), not calling a
  function.
- **No metric-emitting hooks.** `/ba:review` doesn't currently
  capture token count, duration, or tool-use count. Wall-clock can
  be approximated externally; token/tool-use counts would need to
  come from Claude Code's own session telemetry or be skipped.

### What `/ba:review` exposes that a benchmark could exercise

From the prior comparison research
(`docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md`):

- 3-bucket output contract (Must Address / Consider / Looks Good)
  with `[file:line]` citations — easily parseable for finding
  counts.
- Seven built-in reviewers always selectable; user-curated picks
  via `AskUserQuestion`. **Interactive-only today** — no
  non-interactive mode, which is a real obstacle for any
  unattended benchmark harness. Either we add a non-interactive
  mode (already on the port wishlist) or we drive review by
  invoking individual reviewer agents directly via the Agent tool,
  bypassing `/ba:review` entirely.
- Conventional Comments mapping at posting boundary — irrelevant
  for benchmarking, since benchmarks don't post.

### Mapping the three eval types onto `/ba:review`

| Eval type | Purpose | What's needed | Maps to which `/ba:review` use case |
|---|---|---|---|
| **Planted-bug** | Confirm sensitivity isn't lost when changes are made to reviewer prompts | A handful of small TypeScript / Python / Ruby diffs with a known correctness, security, or off-by-one bug — and the expected file:line | All seven reviewers, especially `error-handling-reviewer`, `security-reviewer`, `complexity-reviewer` |
| **Large-refactor (clean)** | Measure noise floor — reviewer should produce few findings on intentional cross-cutting changes | A diff that touches many files but introduces no real defects (e.g., a rename, a folder move, a formatter run) | All reviewers; particularly stresses `simplification-reviewer` and `architecture-reviewer` |
| **Feature-intent** | Catch reviewers flagging code that *correctly* implements the stated intent | A small feature with a clear plan/acceptance criteria, where a naive reviewer might second-guess the architecture | `architecture-reviewer`, `simplification-reviewer`, `deep-module-reviewer`. Pairs cleanly with future plan-driven Requirements Completeness section. |

## Code References

- `commands/ba/review.md:117-160` — scope detection (`/ba:review`)
- `commands/ba/review.md:200-212` — built-in reviewer roster
- `commands/ba/review.md:281-336` — reviewer dispatch (entry point a
  benchmark harness could call into)
- `commands/ba/review.md:342-371` — consolidation; finding count is
  derivable from this output
- `agents/review/architecture-reviewer.md:35-46` — output schema
  (canonical 3-bucket shape)
- `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md`
   — earlier comparison; "ideas worth porting" list there is what a
  benchmark would help us validate

External references (read-only, not committed locally):

- PR #434 description — benchmark methodology and results
- `tests/review-skill-contract.test.ts` (upstream) — model for
  contract testing
- `tests/fixtures/ce-code-review-stable-numbering.md` (upstream) —
  model for output-shape fixtures

## Architecture Insights

### Two layers, decoupled

Contract tests and benchmarks measure different things and have
different cost profiles. They are independently adoptable.

- Contract tests are **deterministic, fast, free**. They catch
  drift in reviewer prompts and the dispatch contract. A
  contract-test layer is a small but real infrastructure
  addition (introduces a test runtime).
- Benchmarks are **non-deterministic, slow, expensive** (model
  calls). They measure actual review quality. A benchmark layer
  doesn't strictly require a test runtime — it could be a
  shell/JS script that invokes Claude Code with `/ba:review`
  against fixture branches and parses output to a CSV/JSON
  results file.

If we adopt only one, **contract tests come first** — they're
cheaper, they protect the schema we'd want to extend (e.g., when
porting confidence anchors from `ce-review`), and they don't
require solving the non-interactive-mode problem.

### Benchmarks force the non-interactive question

Any unattended benchmark needs `/ba:review` to run without
`AskUserQuestion`. Current `/ba:review` is interactive-only. We have
two options:

1. **Add a non-interactive mode** (already on the port wishlist
   from prior research). This unblocks benchmarking *and* CI/orchestrator
   usage. Bigger lift, broader payoff.
2. **Bypass `/ba:review`** and invoke the seven reviewer agents
   directly via the Agent tool from a harness. Smaller lift, but
   skips the dispatcher logic — the *consolidation* and *conflict
   detection* never get measured. This is fine if what we want to
   measure is per-reviewer prompt quality, not the full pipeline.

The choice depends on what the benchmark is for. If the goal is
"validate prompt edits to a single reviewer", option 2 is enough.
If the goal is "validate end-to-end signal-to-noise like PR #434
did", option 1 is required.

### The reviewer contract is what gets benchmarked

The substance of PR #434 is the reviewer prompt: confidence rubric,
FP-suppression categories, intent block. Those changes live in
`subagent-template.md` and are reused across all personas. A
similar lever for us is `agents/review/*.md`. Each port we'd
consider (P0–P3 ladder, confidence anchors, fingerprint dedup,
evidence-match) has a clear before/after that a benchmark can
measure. Without a benchmark, every port is a coin flip.

### Metrics we can capture vs. metrics we can't (yet)

- **Findings count** per fixture — easy, parse the markdown output.
- **Finding correctness** (true positive / false positive) —
  requires a labeled fixture (the file:line where the planted bug
  lives) and a fuzzy match.
- **Wall-clock duration** — easy if the harness times the call.
- **Tokens / tool uses** — *not* exposed by Claude Code to a
  child invocation. Either skip these for now, or capture via
  session-telemetry if/when available.
- **Cross-run variance** — requires N≥3 runs. PR #434 used 3.

This means our minimum-viable benchmark can produce sensitivity
(catches/total), specificity (mean findings on clean diff), and
duration. Token/tool-use efficiency would be a stretch goal.

### Fixtures should be small and self-contained

The PR's fixtures are described as "real TypeScript code with
known correctness issues" — but small. A 10–30 line diff with a
single planted bug is enough. Mirror that for dev-workflow:

- 3–5 planted-bug diffs (off-by-one, null deref, security regress,
  test missing, unhandled error path)
- 2–3 large-refactor diffs (rename, file move, formatter run)
- 2–3 feature-intent diffs (small feature with paired plan/AC)

Total: ~10 fixture diffs. Each is a `.diff` or `.patch` file plus
a YAML manifest with expected outcomes. Stored under e.g.
`evals/fixtures/`.

## Historical Context (from `docs/research/`)

- `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md`
   — prior comparison establishing the schema and capability gap
  between `/ba:review` and `ce-code-review`. Lists the
  ideas-worth-porting that a benchmark would let us evaluate
  empirically.

## Related Research

- PR #434 (external, read-only)
- `docs/plans/2026-03-15-feat-add-ba-review-command-plan.md` —
  original `/ba:review` plan; specifies the existing reviewer
  contract that any new schema would need to extend
- `docs/plans/2026-05-03-feat-port-complexity-reviewer-plan.md` —
  most recent reviewer-port plan; would be a natural first
  target for benchmark-driven validation if we keep porting
  reviewers

## Inputs for downstream phases

This research deliberately stops short of designing anything. The
next phases should pick from the following.

### For `/ba:brainstorm`

Open questions worth exploring before any plan:

- **What is the benchmark *for*?** Two distinct goals: (a) gate
  schema/prompt changes ("don't ship a regression"), or (b)
  exploratory measurement of `/ba:review` quality on real diffs
  ("how good are we, really?"). They lead to different harness
  shapes — (a) wants a small fixed eval set with thresholds; (b)
  wants flexible scratch runs.
- **Who pays the model cost?** Local dev only? CI? On every
  reviewer-prompt change, or only manually?
- **Determinism strategy.** N=3 runs per config, mean ± stddev.
  Or do we set `temperature=0` and accept that real users don't?
- **Test runtime decision.** This plugin is markdown-only today.
  Adding `bun` / `vitest` / shell-only is a meta-decision before
  contract tests can land.
- **Scope creep risk.** Building a full eval harness is a real
  project. The MVP is "one shell script that runs `/ba:review`
  on three fixtures and prints a count". That alone gives
  before/after signal on prompt edits.

### For `/ba:plan`

Two tracks, ranked by leverage / cost:

1. **Contract tests for the reviewer schema** — small infra
   addition, immediate value. Modeled on
   `tests/review-skill-contract.test.ts` upstream. Asserts:
   - All seven reviewer files contain the canonical 3-bucket
     output shape (`## Must Address`, `## Consider`, `## Looks Good`)
   - The lens-tag requirement appears in `complexity-reviewer.md`
   - The "you suggest, you do not apply" guard appears where
     intended
   - Any future schema additions (P0–P3, confidence anchors)
     are present uniformly across all reviewers
   - Entry: `commands/ba/review.md` references all seven
     reviewers in step 2a
2. **Minimum-viable benchmark scaffold** — `evals/fixtures/` with
   3–5 planted-bug + 2 large-refactor + 1 feature-intent
   fixtures, plus a runner script (`evals/run.sh` or similar)
   that invokes `/ba:review` per fixture, parses output, and
   writes `evals/results/<timestamp>.json`. **Blocked on
   non-interactive mode for `/ba:review`** unless we accept
   bypassing the dispatcher and dispatching individual reviewers
   directly.

A natural sequencing: `/ba:plan` for non-interactive mode first
(unlocks (2) and is generally useful), then `/ba:plan` for
contract tests, then `/ba:plan` for the benchmark harness with
the first 3 fixtures.

### For `/ba:execute`

Once a plan exists, the smallest valuable executable unit is:

- One fixture diff
- A shell runner that pipes the diff into `/ba:review --headless`
  (or simulates by invoking one reviewer)
- A parser that extracts the `## Must Address` and `## Consider`
  bullet counts
- A single-row results CSV write

Everything else (multiple fixtures, multiple runs, mean/stddev,
reference baselines, CI integration) is iteration on this core.

## Open Questions

- **Non-interactive `/ba:review` first, or harness around individual
  reviewers first?** Argument for non-interactive: bigger payoff,
  unblocks more. Argument for individual-reviewer harness: ships
  faster, lets us iterate on per-reviewer prompts (which is where
  the substance of PR #434 lives).
- **Do we need to commit the actual diffs, or generate them?**
  Committing real (anonymized?) diffs makes results comparable
  across runs but ages. Generating diffs from a corpus avoids
  staleness but adds machinery.
- **Where do reference results live?** `evals/baselines/<sha>.json`
  with manual updates? A live table in `docs/research/`? A CI
  artifact?
- **Cost ceiling.** PR #434 reports ~70K tokens per run. With 10
  fixtures × 3 runs × N reviewers, costs add up. Concrete budget
  needed before we wire this into anything automatic.
- **Reuse of contract-test ideas without a test runtime.** Could
  we get 80% of the value with a single bash script
  (`scripts/lint-reviewer-contract.sh`) that greps for required
  strings? Probably yes for now.
