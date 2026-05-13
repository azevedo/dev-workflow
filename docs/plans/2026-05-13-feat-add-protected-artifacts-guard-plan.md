---
title: Add protected-artifacts guard to /ba:review dispatcher
type: feat
status: completed
date: 2026-05-13
origin: https://github.com/azevedo/dev-workflow/issues/3
detail_level: minimal
iteration_count: 0
tags: [ba-review, dispatcher, reviewer-guard, protected-artifacts, ce-code-review-port]
---

# Add protected-artifacts guard to /ba:review dispatcher

`/ba:review` dispatches reviewer subagents that operate on captured diffs in isolated contexts. When a branch touches the plugin's four workflow-artifact directories (`docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`), reviewers may flag those files for deletion, gitignoring, or relocation — advice that is wrong-by-design because these directories are intentional plugin outputs. This plan injects a single dispatcher-level guard into all three dispatch template variants in `commands/ba/review.md` so the warning travels with every reviewer prompt uniformly. Source pattern: `ce-code-review` SKILL.md "Protected Artifacts" rule, ranked #1 by leverage/cost in `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md:346-350`.

## Acceptance Criteria

- [x] All three dispatch template strings in `commands/ba/review.md` (agent-based at `:285`, skill-based at `:301`, user-typed at `:323`) carry the identical protected-artifacts guard text.
- [x] The guard names exactly the four paths from the `CLAUDE.md` Artifact Paths table: `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`.
- [x] The guard prohibits suggesting deletion, removal, hiding, gitignoring, relocation, renaming, archiving, consolidation, splitting, or any other action that changes the existence, path, or identity of a file under those roots.
- [x] The guard explicitly preserves content review: reviewers may still flag in-file quality issues (vague acceptance criteria, missing edge cases, broken cross-references) and may still review changes to these files when they appear in the diff under review.
- [x] `CLAUDE.md` Conventions section names the new dispatcher-level invariant so future authors and the `convention-checker` agent are aware.
- [x] `.claude-plugin/plugin.json` version is bumped from `0.13.0` to `0.14.0` (minor bump per semver — `type: feat` warrants a minor even though no consumer-facing surface changes).
- [x] No edits to any file under `agents/review/` (per-agent placement is explicitly rejected by issue #3).
- [ ] Manual smoke test: dispatch `/ba:review` against a branch that touches `docs/plans/` or `docs/brainstorms/`, confirm no reviewer suggests deleting/relocating an artifact, and confirm reviewers still surface content-quality findings against artifact files when warranted.

## What We're NOT Doing

- **Per-agent placement.** Not editing `agents/review/*.md` files. Per issue #3, the guard is dispatcher-level only — 7× the edit surface for no benefit, and the guard is review-context-specific (reviewers invoked outside `/ba:review` don't need it). This matches the precedent in `commands/ba/compound.md:52-60`, which prepends/appends invariants at dispatch time rather than per-agent.
- **Adding `docs/reviews/` to the protected list.** That path doesn't exist today. It depends on the A2 candidate (run-artifact persist flag, separate GitHub issue). If A2 lands, A2's plan adds `docs/reviews/` to this guard's path list — not this plan.
- **Hard programmatic enforcement.** No regex on reviewer output, no post-hoc filter, no validation pass. The guard is a soft prompt-level constraint. Mitigation is observation per issue #3: spot-check `/ba:review` output and tighten wording if violations occur.
- **Extracting a shared prompt-fragment mechanism.** This codebase has no shared-fragment infrastructure (verified — `compound.md` repeats invariants verbatim across 5 Task blocks). Introducing one for a 3-template repetition would be premature abstraction. The guard is duplicated verbatim across the three templates; if a fourth dispatch path appears, that plan is the place to consider extraction.
- **README.md update.** No commands, agents, or artifact paths are being added or changed — only an internal dispatch behavior of an existing command. Per `CLAUDE.md:72`, README.md updates are triggered by command/agent/path changes, none of which apply here.
- **Updating the convention-checker agent.** The new convention is descriptive (states current behavior), not prescriptive for future plans to comply with. No agent behavior change required.

## Behaviors to Test

- [ ] When a reviewer is dispatched via `/ba:review` and the diff includes a file under any of the four protected roots, the reviewer's output contains no suggestion to delete, gitignore, relocate, rename, archive, consolidate, or otherwise remove that file.
- [ ] When the diff under review contains a file under a protected root with content-quality issues (e.g., a plan with vague acceptance criteria), reviewers still surface those issues as in-file findings.
- [ ] When the diff under review *modifies* a protected file (e.g., updating a plan mid-implementation), reviewers may comment on the in-diff changes themselves — the guard protects the file's existence and location, not its contents.
- [x] The guard text appears identically in all three template strings; a `grep -c` for a guard-anchoring phrase returns 3.

## Context

**Key files:**
- `commands/ba/review.md:281-336` — Step 3 dispatch templates (the placement target)
  - `:285` — agent-based reviewer template
  - `:301` — skill-based reviewer template
  - `:323` — user-typed reviewer (no-match → general-purpose) template
  - `:316-321` — resolution preamble that routes user-typed names back through templates 1 and 2 (no edits needed here; routing inherits the guard automatically)
- `CLAUDE.md:55-58` — canonical Artifact Paths table (the four protected roots)
- `CLAUDE.md:60-72` — Conventions section (where the new convention line is appended)
- `.claude-plugin/plugin.json:3` — version field to bump

**Precedents the guard wording and placement follow:**
- `commands/ba/compound.md:52-60` — verbatim invariant (`Return TEXT ONLY — do not write any files.`) repeated across 5 dispatched Task blocks. Closest existing pattern: dispatcher-injected, repeated verbatim, lives inside the Task prompt string.
- `agents/review/deep-module-reviewer.md:18` and `agents/review/complexity-reviewer.md:18` — `**You suggest. You do not apply.**` invariant, bold lead clause + plain-prose explanation. The new guard adopts this voice.

**Why the wording is broader than issue #3's draft:**
- Issue #3 listed "deletion, removal, gitignoring, relocation." Spec-flow analysis surfaced additional verbs reviewers might use: archive, consolidate, split, rename, deprecate, mark-as-obsolete. Broadening the verb list closes those loopholes without lengthening the rule meaningfully.
- A content-review carve-out is explicit so the guard doesn't chill legitimate in-file findings (the most common false-positive risk per `simplification-reviewer.md:20-23` and `architecture-reviewer.md:24`).
- An in-diff exception is explicit so reviewers can still review changes to a plan/brainstorm that ship as part of the MR under review.

**Reviewers most likely to violate the guard absent this change:**
- `simplification-reviewer.md` (lens: dead code / YAGNI / unused) — most likely to suggest deleting "stale" research or brainstorm files.
- `architecture-reviewer.md` (lens: file organization) — most likely to suggest relocating docs into a different directory.
- `complexity-reviewer.md` (lens: cross-file structural obscurity) — could suggest consolidating overlapping plans.

**Constraint inherited from issue #3:**
- A2 dependency note: if/when the A2 candidate ships, `docs/reviews/` joins this list. Out of scope here, but the guard wording is structured so adding a fifth path in the future is a one-token edit at three sites (still no shared-fragment refactor required).

## MVP

### `commands/ba/review.md` — Step 3 template edits

The guard is the same paragraph in all three templates. It is placed immediately after the role-setting opening sentence and before `Context:` — i.e., as the first content the reviewer reads after being told what kind of review to do. This matches the deep-module/complexity precedent of placing invariants near the top of the prompt body.

**Template 1: Agent-based reviewer (`commands/ba/review.md:285`)**

```markdown
- Task <reviewer-agent>("Review these code changes for [dimension focus].

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, or `docs/research/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

Context:
- Scope: [scope description]
- MR context: [MR title + description, if MR scope]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Review the diff AND read the full content of changed files for context. Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.")
```

**Template 2: Skill-based reviewer (`commands/ba/review.md:301`)**

```markdown
- Task general-purpose("Use the `[skill-name]` skill to review these code changes.

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, or `docs/research/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

Context:
- Scope: [scope description]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.")
```

**Template 3: User-typed reviewer / no-match → general-purpose (`commands/ba/review.md:323`)**

```markdown
- Task general-purpose("You are a code reviewer specializing in **[user-typed name]**. Review these code changes through that lens.

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, or `docs/research/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

Context:
- Scope: [scope description]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Review the diff AND read the full content of changed files for context. Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.")
```

### `CLAUDE.md` — append convention line

Add to the Conventions list (after the existing `/ba:review` line at `CLAUDE.md:71`):

```markdown
- `/ba:review` dispatches reviewer subagents with a protected-artifacts guard naming `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, and `docs/research/` — reviewers must not suggest deleting, relocating, or otherwise removing files under these roots (content review is unaffected)
```

### `.claude-plugin/plugin.json` — version bump

```json
{
  "name": "dev-workflow",
  "version": "0.14.0",
  ...
}
```

## Sources

- Origin issue: https://github.com/azevedo/dev-workflow/issues/3 (Candidate A1: Protected-artifacts guard)
- Source pattern: `ce-code-review` SKILL.md "Protected Artifacts" rule
- Research backing the placement decision: `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md:312-316` (placement tradeoff) and `:346-350` (ranked #1 idea worth porting)
- Dispatcher-injected invariant precedent: `commands/ba/compound.md:52-60`
- Per-agent invariant precedent (style, not placement): `agents/review/deep-module-reviewer.md:18`, `agents/review/complexity-reviewer.md:18`
- Canonical protected-paths source: `CLAUDE.md:55-58` (Artifact Paths table)

## Convention Compliance

- [x] **Title prefix `feat:`** — matches CLAUDE.md convention for new functionality.
- [x] **Filename format** — `2026-05-13-feat-add-protected-artifacts-guard-plan.md` matches `YYYY-MM-DD-<type>-<name>-plan.md`.
- [x] **YAML frontmatter present** — all required fields populated.
- [x] **Version bump included** — `0.13.0` → `0.14.0` per `CLAUDE.md:65`; minor bump (semver) aligned with `type: feat`, confirmed with user during planning.
- [x] **README.md update — N/A** — no commands, agents, or artifact paths are added/changed (only an internal dispatch behavior change); per `CLAUDE.md:72`, README.md update is not triggered.
- [x] **Planning-only command discipline** — this plan writes no code; only `/ba:execute` will edit files.
- [x] **Four protected paths match the canonical list** — `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/` exactly mirror `CLAUDE.md:55-58`.
- [x] **No new agent introduced** — guard is dispatcher-injected, so no `## Agents` section update is needed in `CLAUDE.md` or `README.md`.
