---
title: Fix ba-review-plan's dispatch drift and pin it per Task block
type: fix
plan_schema: 2
status: active
date: 2026-08-08
origin: docs/solutions/prompt-authoring/2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md
detail_level: standard
tags: [ba-review-plan, dispatch-template, ci-invariants, rubric-mirror]
---

# Fix ba-review-plan's Dispatch Drift and Pin It per Task Block

## Overview

`skills/ba-review-plan/SKILL.md` carries slice 1's exact defect — the one slice 1 fixed in
`skills/ba-review/SKILL.md` and left in its sibling. Two of its three dispatch templates reach their
subagent with no legal-value literal and no protected-artifacts guard, and all three cite their
instructions **positionally** at a subagent that has no file to position against.

`rubric-mirror` is green on this file, which is the second half of the defect: the check tests
per-file, so a drifted template passes on a sibling's correct copy.

Split out of the slice-2 extraction plan (`docs/plans/2026-08-08-refactor-prompt-surface-shrink-slice-2-plan.md`)
because it is a live defect with no dependency on that refactor — no `references/` involvement, no
probe gate, and no reason to wait behind one.

## Current State

Verified 2026-08-08 against `skills/ba-review-plan/SKILL.md`:

| Site | State |
|---|---|
| `:289`, `:303`, `:322` | apply-phrases read "the dispatch instructions in the section above" — the only positional citations left in `skills/`, `agents/`, or `references/` |
| `:294` (agent-based template) | carries `N ∈ {0, 25, 50, 75, 100}` ✅ |
| `:302`, `:321` (both `general-purpose`) | carry **neither** the literal **nor** the protected-artifacts guard |
| `:253` | hoisted block is `### Dispatch instructions — apply to ALL templates` — a `###` with no citable `##`-level name; nearest `##` is `## Plan-Anchor & Confidence Grammar` at `:192` |
| `:224`, `:270` | the literal appears here too, which is why per-file CI passes |

The `general-purpose` templates are the ones that **cannot** fall back: there is no agent definition
behind them, so the template text is the whole specification. `skills/ba-review/SKILL.md` is the
corrected shape to copy — each of its three `Task` blocks (`:484`, `:502`, `:526`) cites the section by
title **and** carries the literal inline (`:486`, `:504`, `:528`).

`rubric-mirror` (`scripts/check-invariants.mjs:499`) walks `RUBRIC_MIRROR_FILES` (`:102`) plus
`agents/*-reviewer.md`. Its zero-occurrence branch (`:538`) is per-file. Selfcheck suite is at 52.

## Acceptance Criteria

- AC1: A `general-purpose` reviewer dispatched by `/ba-review-plan` receives the legal confidence value set and the protected-artifacts guard in its prompt — verified by reading the raw Step 3 subagent return blocks in the transcript, before Step 4's parser rewrites them.
- AC2: Every confidence value in those raw returns is drawn from `{0, 25, 50, 75, 100}`, and the consolidation header reports zero `snapped` and zero `confidence_default`.
- AC3: `rubric-mirror` FAILs when any single `Task` block loses the literal, even while sibling blocks in the same file retain it.
- AC4: `rubric-mirror` PASSes on `skills/ba-review/SKILL.md` and `skills/ba-review-plan/SKILL.md` as they stand after this fix, and its verdict distinguishes missing from drifted.
- AC5: No positional apply-phrase ("the section above" / "described above") remains in `skills/`, `agents/`, or `references/`.
- AC6: `node scripts/selfcheck-invariants.mjs` passes with the new fixtures, and the reported total is above **52** — the post-slice-2 baseline. (Stated as 47 when this plan was written; slice 2 added five cases, which would have made the original threshold tautologically true.)
- AC7: `.claude-plugin/plugin.json` shows exactly one version change in this plan.

## What We're NOT Doing

- **The `--persist` extraction.** Owned by the sibling plan; this one touches no `references/`.
- **The severity-ladder wording and per-anchor confidence meanings.** Hand-mirrored across the seven
  reviewer agents and both review skills, unchecked. This plan pins string identity, never meaning — a
  green `rubric-mirror` still does not mean the agents agree.
- **Widening the rubric corpus to `skills/*/references/*.md`.** No dispatch template lives in one, and
  widening would silently change three existing check subjects.
- **Driving `ba-review`'s two `general-purpose` templates.** They fire only for a skill-based or
  user-typed reviewer. `ba-review-plan`'s equivalents are the ones this plan exercises; `ba-review`'s
  stay covered by inspection.
- **Adding a persist mode to `ba-review-plan`.** Its absence is why AC1 is verified from the transcript
  rather than from an artifact file; that asymmetry is recorded, not fixed here.

## Proposed Solution

Make the weaker twin match the corrected one — cite by title **and** inline the contract — then change
the check from per-file to per-`Task`-block so the same drift cannot recur silently.

Order matters: the CI change lands **with or before** the prompt fix, so the fix is verified by the
tightened check rather than grandfathered past the loose one.

## Technical Considerations

- **Adding a copy is not defensive duplication.** The repo's rule against copied prose concerns one
  reader loading text twice. A dispatch template becomes the *entire* context of a fresh subagent, so
  each copy has a different reader. Slice 1's shipped note in `ba-review` Step 3 says this explicitly;
  the same reasoning applies here, and nothing in this plan removes a copy.
- **Positional citation is the subtler half.** "Above" resolves against a document the subagent does not
  have. When it resolves to nothing the subagent invents a plausible output shape — silent, because each
  reviewer's own `## Output Format` supplies one.
- **The check's granularity was the root cause.** Per-file `.some()` is satisfied by whichever copy is
  still right. The house pattern is loose locator, byte-exact assertion, not whitespace-normalised.

## System-Wide Impact

- **Interaction graph**: `/ba-review-plan` Step 3 dispatches up to three template shapes; only the
  agent-based one currently carries a complete contract. Step 4's parser snaps out-of-set confidence
  values, which is why AC1 and AC2 must be read pre-consolidation.
- **Error propagation**: a subagent with no grammar emits unparseable bullets that Step 4 silently drops
  into `dropped_no_anchor`, or legal-looking values that `snapped` absorbs. Neither surfaces as an error.
- **State lifecycle risks**: none — no state is written; this is prompt text and a CI script.

## Implementation Approach

### Changes Required

**File**: `scripts/check-invariants.mjs`

### U1 — `rubric-mirror` asserts per `Task` block

Enumerate each `Task` block in `RUBRIC_MIRROR_FILES` and require the literal within that block's own
line range. Keep the house pattern: a loose locator to name the offending line, a byte-exact assertion,
deliberately **not** whitespace-normalised (spacing is what a hand-maintained mirror loses first),
missing and drifted as distinct verdicts, and an unreadable owner file as UNKNOWN rather than FAIL.

A block's range runs from its `- Task ` line to the line before the next `- Task ` or the next `##`
heading, whichever comes first.

Test scenarios:
- One block's literal drifts while siblings are correct → FAIL naming the line (Covers AC3)
- A whitespace-only variant still FAILs (Covers AC3)
- `skills/ba-review/SKILL.md` unchanged → PASS, since `:486`/`:504`/`:528` sit inside `:484`/`:502`/`:526` (Covers AC4)
- An unreadable mirror file → UNKNOWN (Covers AC4)

Verify: `node scripts/check-invariants.mjs --only rubric-mirror`

---

**File**: `scripts/selfcheck-invariants.mjs`

### U2 — Fixtures for the new granularity

Append `CASES` entries covering all four scenarios above, following the existing `rubric-mirror` cases
as the template. Each fixture builds a minimal tree in-process; there are no fixture files on disk.

Test scenarios:
- The suite's reported total rises above 47 (Covers AC6)
- The drifted-sibling fixture fails without the fix and passes with it (Covers AC3)

Verify: `node scripts/selfcheck-invariants.mjs`

---

**File**: `skills/ba-review-plan/SKILL.md`

### U3 — Cite by title, and inline the contract where it cannot fall back

Three changes:
1. Replace the positional apply-phrases at `:289`, `:303`, `:322` with citations by section title.
2. Promote `:253` to a citable `##` heading. The byte-identical heading also sits at
   `skills/ba-review/SKILL.md:463` — promote **both**, or a currently-parallel pair splits with nothing
   detecting it.
3. Add the legal-value literal and the protected-artifacts guard inline to both `general-purpose`
   templates (`:302`, `:321`).

Also add the orchestrator-addressed sentence `ba-review` already carries — that the apply-phrase is an
instruction to the orchestrator to compose the section's full text into the dispatch prompt, not text a
reviewer can act on. Without it, an apply-phrase reads as pass-through content.

Test scenarios:
- A dispatched `general-purpose` reviewer's raw return uses only legal confidence values (Covers AC1, AC2)
- The consolidation header reports zero `snapped` and zero `confidence_default` (Covers AC2)
- No positional apply-phrase remains anywhere in `skills/`, `agents/`, or `references/` (Covers AC5)
- Both files' `Dispatch instructions` headings are `##` (Covers AC5)

Verify: `! grep -rq 'instructions in the section above' skills/ agents/ references/ && test "$(grep -c 'N ∈ {0, 25, 50, 75, 100}' skills/ba-review-plan/SKILL.md)" -ge 5 && grep -q '^## Dispatch instructions' skills/ba-review-plan/SKILL.md && grep -q '^## Dispatch instructions' skills/ba-review/SKILL.md && node scripts/check-invariants.mjs --only rubric-mirror`

---

**File**: `CLAUDE.md`

### U4 — Update the bullet that says CI pins two things

`CLAUDE.md`'s `rubric-mirror` bullet states CI "pins two things and no more" and that the check owns
the literal and each agent's section-title citation. U1 changes the granularity, so the bullet's
description is now incomplete. Keep its honest limits intact — the ladder wording and per-anchor
meanings remain hand-mirrored and unchecked, and the prose pointers outside `agents/` remain unpinned.

Test scenarios:
- The bullet describes per-`Task`-block granularity and still states what CI cannot pin

Verify: `grep -q 'Task' CLAUDE.md && grep -q 'a green build does not mean the agents agree' CLAUDE.md`

---

**File**: `.claude-plugin/plugin.json`

### U5 — One version bump

Bump once. Check whether the branch already bumped before adding one; if the sibling slice-2 plan lands
first in the same release, this plan carries no second bump.

Test scenarios:
- `version` changes exactly once across this plan (Covers AC7)
- `version-bump` passes, since `skills/` changed

Verify: `node scripts/check-invariants.mjs --only version-bump`

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| CI change lands after the prompt fix, grandfathering it | U1 and U2 precede U3; U3's `Verify:` re-runs the check |
| Per-block range detection mis-parses a `Task` block | Four fixtures in U2, including the unchanged-`ba-review` case |
| `ba-review-plan` has no persist mode, so raw output is transcript-only | AC1 reads the Step 3 return blocks directly; recorded as an asymmetry that makes these edits higher-risk to verify than `ba-review`'s |
| Version double-bump if both plans ship together | U5 states the check-first rule explicitly |
| Fixing the literal but not the guard, or vice versa | U3's `Verify:` counts the literal; the guard is covered by AC1's raw-return scenario |

> **Citations re-pointed 2026-08-09 against `main` @ `9694645`.** This plan was written before the
> slice-2 PR landed; that PR inserted `loadSiteMirrorCheck` into `scripts/check-invariants.mjs` and
> edited `skills/ba-review/SKILL.md`, shifting four of the line numbers cited below. Mapping applied:
> `check-invariants.mjs` `:493`→`:499`, `:532`→`:538` (`:102` unchanged); `ba-review/SKILL.md`
> `:453`→`:463`, `:453-518`→`:463-539`; Task blocks `:474`/`:492`/`:516`→`:484`/`:502`/`:526` and their
> inline literal `:476`/`:494`/`:518`→`:486`/`:504`/`:528`. The selfcheck baseline moved 47→52, which
> made AC6's original threshold tautological, so AC6 now reads against 52. Unit anchors normalised from
> `#### U<n>` to the convention's `### U<n>`. **All ten `skills/ba-review-plan/SKILL.md` citations were
> re-verified and are unchanged** — that file was not touched, and the defect this plan fixes is still
> present exactly as described. Symbols and intent are unchanged — verify before relying on any line
> number, since nothing pins these.

## Sources & References

- Origin: `docs/solutions/prompt-authoring/2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md`
  — the defect, its root cause, and the "Residual gaps to keep visible" section that named these exact
  line numbers.
- Sibling plan: `docs/plans/2026-08-08-refactor-prompt-surface-shrink-slice-2-plan.md`
- Corrected shape to copy: `skills/ba-review/SKILL.md:463-539` (Step 3 preamble and the three templates)
- `scripts/check-invariants.mjs:102` (`RUBRIC_MIRROR_FILES`), `:499` (`rubricMirrorCheck`), `:538` (the
  per-file zero-occurrence branch this plan replaces)
- `docs/plans/2026-08-02-refactor-prompt-surface-shrink-slice-1-plan.md` — slice 1, where the same defect
  was found and fixed in the sibling file

## Convention Compliance

- [x] Never de-duplicate dispatch-path text — aligned. U3 only adds copies.
- [x] Protected-artifacts guard — aligned, and repaired where missing.
- [x] Reviewer rubric ownership — aligned. The literal's owner stays
  `skills/ba-review/SKILL.md`'s `## Code-Anchor & Confidence Grammar`; this plan changes only where CI
  asserts it.
- [x] Per-occurrence CI assertion — aligned; loose locator, byte-exact assertion, missing vs drifted
  distinguished, UNKNOWN on unreadable.
- [x] Runtime-observable acceptance criteria — aligned. AC1 and AC2 are read from raw pre-consolidation
  output, not from file state.
- [x] One version bump per ship — aligned, with the already-bumped check stated in U5.
- [x] Hyphen never colon outside `docs/` — aligned.
- [ ] **Ladder wording and per-anchor meanings stay unchecked — known debt.** Stated in
  `## What We're NOT Doing` and preserved in `CLAUDE.md` by U4 rather than quietly dropped.
