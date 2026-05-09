---
date: 2026-05-09T00:00:00Z
researcher: Claude
git_commit: 5634f2fd9f225904b1fa01f46af48a566f48877d
branch: claude/compare-code-review-IASs9
repository: dev-workflow
topic: "Comparison of EveryInc ce-code-review skill vs /ba:review command"
tags: [research, code-review, ba-review, ce-code-review, external-comparison, reviewer-architecture]
status: complete
last_updated: 2026-05-09
---

# Research: Comparison of EveryInc `ce-code-review` skill vs `/ba:review` command

**Date**: 2026-05-09
**Git Commit**: 5634f2fd9f225904b1fa01f46af48a566f48877d
**Branch**: claude/compare-code-review-IASs9
**Repository**: dev-workflow

## Research Question

How does the external `ce-code-review` skill from
`EveryInc/compound-engineering-plugin` compare to our `/ba:review` command,
and which of its ideas are worth porting?

External source:
`https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/skills/ce-code-review`

## Summary

`/ba:review` and `ce-code-review` solve the same problem — multi-reviewer
post-implementation code review — but optimize for different operating
points.

- `/ba:review` is **interactive-first, transparent, and user-curated.** The
  user picks reviewers from a discovered menu, gets a 3-bucket markdown
  report (Must Address / Consider / Looks Good), and decides what to do
  with findings. Severity is qualitative; there is no schema, no dedup
  beyond a manual "⚠ Conflicting" tag, no validator pass, and no run
  artifacts. It posts inline review comments using a clean
  Conventional Comments mapping.

- `ce-code-review` is **mode-driven, structured, and automation-ready.** It
  has four modes (interactive / autofix / report-only / headless), auto-
  selects reviewers from diff content (always-on + cross-cutting +
  stack-specific), uses an anchored confidence + P0–P3 + autofix-class
  schema, deduplicates findings by fingerprint, runs a validator pass,
  and writes per-run JSON artifacts to `/tmp`. It does not (in the
  fetched summary) post Conventional Comments inline.

The biggest gaps in `/ba:review` relative to `ce-code-review` are:
non-interactive modes, structured findings schema, fingerprint dedup,
validator pass, evidence-match check before applying fixes,
protected-artifacts guard, and run-artifact directories. The biggest
strengths of `/ba:review` worth preserving are: user-selectable
reviewer roster, external-reviewer discovery, simple schema, and the
Conventional Comments mapping for inline MR/PR posting.

This document records the comparison so that selective porting can be
planned without losing context. Per the user's intent: "Lots of good
stuff, not everything is going to go to ba:review."

## Detailed Findings

### Current `/ba:review` output contract (snapshot)

All seven built-in reviewers live under `agents/review/` and share an
identical contract. None declare a `tools:` restriction; all set
`model: sonnet`.

| Agent | File |
|---|---|
| `architecture-reviewer` | `agents/review/architecture-reviewer.md` |
| `security-reviewer` | `agents/review/security-reviewer.md` |
| `simplification-reviewer` | `agents/review/simplification-reviewer.md` |
| `error-handling-reviewer` | `agents/review/error-handling-reviewer.md` |
| `test-coverage-reviewer` | `agents/review/test-coverage-reviewer.md` |
| `deep-module-reviewer` | `agents/review/deep-module-reviewer.md` |
| `complexity-reviewer` | `agents/review/complexity-reviewer.md` |

Every reviewer is told to "Return findings using EXACTLY this structure"
(`agents/review/architecture-reviewer.md:35-46` and parallel sections in
the other six):

```
## Must Address
- **[file_path:line_number]** — [Issue]. [Why]. Suggested fix: [fix]

## Consider
- **[file_path:line_number]** — [Issue]. [Why this could improve ...].

## Looks Good
- [Aspect that is well-implemented]
```

Two reviewers (`agents/review/deep-module-reviewer.md:18`,
`agents/review/complexity-reviewer.md:18`) carry an explicit
"**You suggest. You do not apply.**" guard. The `complexity-reviewer`
also requires an inline lens tag prefix (`[cognitive load]` /
`[change amplification]` / `[obscurity]`,
`agents/review/complexity-reviewer.md:57`). No other structured fields
exist — no severity enum beyond Must/Consider, no confidence, no
autofix class, no fingerprint, no machine-readable schema.

### Current `/ba:review` flow

- Step 1, scope detection: classifies arg into MR/PR vs. local-range /
  staged / auto, with stacked-branch nearest-ancestor support
  (`commands/ba/review.md:117-129`). Once captured, the diff is the
  sole source of truth — local git is forbidden after an MR diff is
  fetched (`commands/ba/review.md:39-40`, `:184-190`).
- Step 2, reviewer discovery: parallel Globs across `~/.claude/`,
  `.claude/`, `.agents/` directories
  (`commands/ba/review.md:218-228`); user picks via
  `AskUserQuestion(multiSelect: true)` distributed across up to 4
  questions. All seven built-ins always appear
  (`commands/ba/review.md:212`).
- Step 3, dispatch: each selected reviewer runs as a fresh parallel
  subagent (`commands/ba/review.md:281-336`).
- Step 4, consolidation: per-reviewer sections concatenated; conflict
  detection at file:line level adds a "⚠ Conflicting" tag
  (`commands/ba/review.md:371`). No dedup, no severity normalization
  across reviewers.
- Step 5, resolution: AskUserQuestion menu — Apply all / Must-address
  only / One-by-one / Done. For MR scope, posts inline Conventional
  Comments via `gh api` / `glab api` with category→CC mapping
  (`commands/ba/review.md:442-465`). This is the only place severity
  widens beyond 3 buckets — at the platform-posting boundary, into 5
  CC labels.

### Current `/ba:review` capabilities not in `ce-code-review` (summary)

- **External-reviewer discovery** across multiple plugin/agent dirs.
  `ce-code-review`'s reviewer roster is fixed (always-on + conditional
  personas it ships with).
- **User-curated reviewer selection** via `AskUserQuestion`.
  `ce-code-review` selects automatically from diff content.
- **Conventional Comments mapping** for inline MR/PR comments
  (`commands/ba/review.md:442-465`). Not present in the fetched
  `ce-code-review` summary.

### `ce-code-review` capabilities not in `/ba:review`

#### Operational modes
- Four modes via `mode:` arg: `interactive`, `autofix`, `report-only`,
  `headless`. `/ba:review` is interactive-only.
- `base:<sha-or-ref>` fast-path to skip scope detection.
- `plan:<path>` arg for explicit plan injection.
- Skip-conditions: CLOSED/MERGED PRs, "trivial" PRs judged by a
  lightweight sub-agent.

#### Reviewer selection
- Auto-selected per diff content: 6 always-on personas + 7 cross-cutting
  conditionals (security, performance, API contract, migrations, etc.) +
  6 stack-specific (Rails, Python, TS, Stimulus/Turbo, Swift) + 2
  CE-specific when migrations present.
- Stage 3b: locates ancestor `CLAUDE.md` and `AGENTS.md` files and feeds
  them to a `project-standards` persona.

#### Findings schema
- `severity ∈ {P0, P1, P2, P3}`
- `confidence` anchored at 50 / 75 / 100
- `autofix_class ∈ {safe_auto, gated_auto, manual, advisory}`
- `owner` (e.g., review-fixer / downstream-resolver / human / release)
- `requires_verification: bool`
- `pre_existing: bool`
- `suggested_fix: string`
- `evidence` (cited code that allows later evidence-match verification)
- Output emitted as **pipe-delimited markdown tables grouped P0→P3** in
  interactive mode, structured envelope in headless mode.

#### Consolidation pipeline (Stage 5)
- Validate compact returns; drop malformed.
- Fingerprint dedup: `normalize(file) + line_bucket(line, ±3) + normalize(title)`.
- Cross-reviewer agreement promotes confidence by one anchor step
  (50→75, 75→100).
- Conservative resolution on routing/severity/owner disagreements;
  routing may narrow but never widen.
- Mode-aware demotion of weak P2/P3 findings.
- Confidence gate: suppress < 75 (P0 exempted at 50+).
- Partition into fixer / residual / report-only queues.
- Stable monotonic `#` IDs assigned after sort.

#### Validator pass (Stage 5b)
- Per-finding validator subagents (mid-tier model) capped at 15 returning
  `{validated, reason}`. Drops failed findings before fixes/tickets.
- Runs in headless, autofix, and option-C-tickets paths.

#### Output sections (Stage 6)
- Header (scope, intent, mode, reviewer team with justifications)
- Findings (table format, grouped by severity)
- Requirements Completeness (when plan found; flags unaddressed
  requirements as P1 manual for explicit plans, P3 advisory for inferred)
- Applied Fixes
- Residual Actionable Work
- Pre-existing
- Learnings & Past Solutions
- Agent-Native Gaps
- Schema Drift Check
- Deployment Notes
- Coverage (suppressed counts, demotion counts, validator drops, failed
  reviewers, untracked files)
- Verdict: Ready to merge / Ready with fixes / Not ready

#### Post-review fix pipeline
- Auto-apply `safe_auto` before asking.
- Routing question with options: (A) walkthrough one-by-one, (B)
  auto-resolve best-judgment, (C) file tracker tickets, (D) report-only.
- One fixer subagent applies the queue per pass.
- Heterogeneous-queue contract: per-finding routing to applied / failed /
  advisory buckets.
- **Evidence-match check** before applying: verifies cited code at
  file:line still resembles persona's evidence (at least one token
  appears, line not deleted). Fails route to `failed`.
- `requires_verification: true` triggers targeted test runs; failure
  routes to `failed`.
- `max_rounds: 2` bounded re-review loop on autofix/walkthrough paths.

#### Artifacts and protections
- Per-run dir: `/tmp/compound-engineering/ce-code-review/<run-id>/`
  containing each reviewer's full JSON, applied fixes, residual
  actionable work, and `metadata.json` (run_id / branch / head_sha /
  verdict / completed_at).
- **Protected artifacts** never flagged for deletion:
  `docs/brainstorms/*`, `docs/plans/*.md`, `docs/solutions/*.md`.
- Quality gates pre-delivery: every finding actionable, no false
  positives from skimming, severity calibrated, line numbers accurate,
  no duplication of linter output.

### Pattern reuse audit (in dev-workflow today)

| Pattern | Status | Evidence |
|---|---|---|
| Non-interactive mode flags in `/ba:tdd` and `/ba:execute` | **Net-new.** Both heavily interactive. | `commands/ba/tdd.md:55,66,152,184,205,234,306,339`, `commands/ba/execute.md:55,59,79,144,220,245,274,319,339` |
| Solution-doc writing two-phase pattern | Exists. Subagents return text only; orchestrator writes single file. | `commands/ba/compound.md:45` (text-only), `:79` (assembly), `:128` (single Write) |
| `/tmp/` run-artifact dirs | **Net-new.** Zero references. | not present |
| P0–P3 priority tiers | **Net-new.** | not present |
| Confidence scoring | **Net-new.** | not present |
| 3-tier qualitative severity (Must / Consider / Looks Good) | Exists across all 7 reviewers. | `agents/review/architecture-reviewer.md:37-46`, etc. |
| Blocking tier mapping | Exists at MR/PR posting boundary. | `commands/ba/review.md:446-452` |
| File:line citation contract | Exists, but no automated evidence-match validation. | `commands/ba/review.md:358,361,400`, `agents/review/deep-module-reviewer.md:65` |
| Parallel sub-agent dispatch | Well-established. | `commands/ba/review.md:279-336`, `commands/ba/review-plan.md:126-128,220-252`, `commands/ba/research.md:55-79` |
| Finding consolidation | Exists with conflict tag and lens tags. Reviewer-level dedup via `replaces:` frontmatter, not finding-level. | `commands/ba/review.md:371`, `agents/review/complexity-reviewer.md:57`, `docs/plans/2026-03-15-feat-add-ba-review-command-plan.md:58,77,269` |
| Fingerprint-based finding dedup | **Net-new.** | not present |
| Evidence-match verification | **Net-new.** | not present |

## Code References

- `commands/ba/review.md:1-475` — full `/ba:review` command
- `commands/ba/review.md:117-129` — stacked-branch nearest-ancestor
  scope detection
- `commands/ba/review.md:184-190` — captured-diff-as-source-of-truth
  invariant
- `commands/ba/review.md:200-212` — built-in reviewer roster contract
  (all seven always shown)
- `commands/ba/review.md:218-273` — external reviewer discovery and
  unified selection via `AskUserQuestion`
- `commands/ba/review.md:281-336` — parallel reviewer dispatch
- `commands/ba/review.md:342-371` — consolidation with conflict
  detection
- `commands/ba/review.md:382-432` — local vs. MR resolution menus
- `commands/ba/review.md:442-465` — Conventional Comments mapping for
  MR/PR posting
- `agents/review/architecture-reviewer.md:35-46` — output schema
  (canonical)
- `agents/review/deep-module-reviewer.md:18` — "you suggest, you do not
  apply" guard
- `agents/review/complexity-reviewer.md:57` — lens-tag requirement
- `commands/ba/compound.md:45,79,128` — text-only-then-write two-phase
  pattern reusable for run-artifact emission
- `docs/plans/2026-03-15-feat-add-ba-review-command-plan.md` — original
  `/ba:review` plan, `replaces:` frontmatter dedup mechanism
- `docs/plans/2026-04-15-fix-exclude-fixer-skills-from-review-discovery-plan.md`
   — fixer-skill exclusion (relevant to "advisory vs. fixer" boundary in
  any future port)

## Architecture Insights

- **Reviewer contract is the leverage point.** All structured-schema
  features in `ce-code-review` (P0–P3, confidence, autofix_class,
  owner, requires_verification, pre_existing, evidence) live in what
  the *reviewer* is asked to return. Porting any of them means
  changing the seven `agents/review/*.md` files in lockstep with
  `commands/ba/review.md`'s consolidator. The current contract is
  a 3-bucket markdown shape with prose; widening it is a coordinated
  schema change, not a single-file edit.

- **The user-curated roster is a deliberate axis.** `/ba:review` invests
  in discovery (parallel Globs across multiple dirs) and presentation
  (`AskUserQuestion` distributed across up to 4 questions, with
  overlap notes). `ce-code-review` skips this entirely with
  diff-content-driven auto-selection. Any port that adds non-
  interactive modes must decide: do those modes still discover and
  pick, or do they auto-select? The likely answer is auto-select for
  non-interactive, retain pick for interactive — but reviewer-relevance
  scoring needs to be invented since `/ba:review` doesn't have it
  today.

- **The Conventional Comments mapping is the "5-tier" that already
  exists.** `/ba:review` already has more than three severity buckets
  in practice — it just only widens them at the platform-posting
  boundary. Porting `ce-code-review`'s severity ladder upstream means
  pushing this mapping back into the reviewer contract instead of the
  dispatcher. That's a coherent simplification, not a feature add.

- **Run-artifact directories enable downstream commands.** A
  `/tmp/.../<run-id>/` dir per review run (with metadata.json) is
  cheap to add and immediately useful for `/ba:compound` (mining
  recurring findings) and a future `/ba:research` follow-up. This
  is small surface area, high optionality.

- **Protected-artifacts guard is a single-line invariant.** The
  `docs/brainstorms/*`, `docs/plans/*`, `docs/solutions/*` exclusion
  is a one-paragraph addition to each reviewer's frontmatter or a
  single rule in the dispatcher prompt. Cheap and high-value given
  this plugin produces all three artifact types.

## Historical Context (from docs/research/)

This is the first research document in `docs/research/` — none existed
prior to this run. `docs/solutions/` is also empty. The dev-workflow
plugin has been operating without captured research or learnings until
now.

## Related Research

- `docs/plans/2026-03-15-feat-add-ba-review-command-plan.md` — original
  `/ba:review` design including the `replaces:` reviewer-replacement
  mechanism
- `docs/brainstorms/2026-03-15-ba-review-command-brainstorm.md` —
  pre-plan exploration of the review command
- `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`
   — design lineage for `deep-module-reviewer` and `complexity-reviewer`
- `docs/plans/2026-05-03-feat-port-complexity-reviewer-plan.md` — most
  recent reviewer-port plan; useful as a template if any
  `ce-code-review` persona is ported
- `docs/plans/2026-04-15-fix-exclude-fixer-skills-from-review-discovery-plan.md`
   — fixer vs. reviewer boundary

## Ideas Worth Porting (ranked by leverage / cost)

1. **Protected-artifacts guard** — one-line invariant added to reviewer
   prompts and/or the dispatcher. Prevents reviewers from ever
   suggesting deletion of `docs/brainstorms/*`, `docs/plans/*.md`,
   `docs/solutions/*.md`. Smallest port, immediate safety win for this
   plugin specifically.

2. **Run-artifact directory** under `/tmp/dev-workflow/ba-review/<run-id>/`
   with `metadata.json` (run_id / branch / head_sha / verdict /
   completed_at) plus per-reviewer raw output. Enables
   `/ba:compound` follow-ups and headless workflows later. Small,
   net-new surface area; no schema disruption.

3. **Severity ladder pulled upstream into reviewer contract.** Replace
   Must/Consider/Looks Good with a P0–P3 + `(blocking)` flag schema
   that maps cleanly to the existing CC labels at the posting
   boundary. This is the simplest "structured schema" win because the
   mapping already exists at `commands/ba/review.md:446-452`.

4. **Confidence field** on each finding (anchored 50/75/100). Pairs
   well with cross-reviewer agreement promotion in consolidation.
   Requires touching all seven reviewer prompts.

5. **Fingerprint dedup** in Step 4 consolidation
   (`file + ±3-line bucket + normalized title`). Replaces the manual
   "⚠ Conflicting" tag with automatic merging plus an agreement-count
   field.

6. **Evidence-match check** before any Edit during fix application.
   Cheap insurance against stale findings — verifies the cited code
   still contains a token from the reviewer's evidence.

7. **Optional non-interactive modes** (`--report-only`, `--autofix`,
   `--headless`) for CI/orchestrator use. Largest port: requires
   reviewer auto-selection logic since the user pick step is gone.
   Defer until earlier items land.

8. **Validator pass** before applying fixes — per-finding validator
   subagents capped at 15 with `{validated, reason}` returns. Pair
   with `Apply all` and any non-interactive autofix mode.

9. **Plan-driven Requirements Completeness section.** Natural fit
   because `/ba:plan` already produces acceptance criteria. Reads the
   linked plan, flags unaddressed requirements as findings.

Out of scope for porting (intentional axes where `/ba:review` differs):
- Fixed reviewer roster (we keep user-curated discovery + selection)
- Stack-specific personas (Rails, TS, etc. — not in our scope)
- Dropping the Conventional Comments mapping (we keep it)

## Open Questions

- **Schema migration strategy.** If we adopt P0–P3 and confidence,
  what's the upgrade path for existing external reviewers discovered
  via Glob? They emit Must/Consider/Looks Good. Either keep accepting
  the legacy 3-bucket shape and synthesize a default
  (`P1`/`confidence=75`), or require external reviewers to declare
  their schema version in frontmatter.
- **Reviewer auto-selection signal.** If non-interactive modes are
  added, how do we decide which reviewers run without user input? Do
  we use file-extension hints (e.g., security on auth-related diffs),
  declared `applies_to` frontmatter, or an LLM-based selector?
- **Where to draw the validator-pass line.** `ce-code-review` runs it
  in headless / autofix / option-C-tickets paths but not in the
  walk-through option. Do we want it always-on for "Apply all", or
  only for non-interactive modes?
- **Run-artifact retention.** `/tmp` is process-local and ephemeral.
  If `/ba:compound` mines findings, do we need a longer-lived
  location?
