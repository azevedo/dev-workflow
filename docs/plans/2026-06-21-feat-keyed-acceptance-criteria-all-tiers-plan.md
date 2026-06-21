---
title: Keyed Acceptance Criteria across all plan tiers
type: feat
status: active
date: 2026-06-21
origin: docs/brainstorms/2026-06-21-reconcile-acceptance-verification-schema-brainstorm.md
detail_level: minimal
tags: [plan-template, acceptance-criteria, issue-35]
---

# Keyed Acceptance Criteria across all plan tiers

The thin, gap-free slice of #35. Today `## Acceptance Criteria` exists **only** in the MINIMAL plan template, yet `/ba:execute`, `/ba:review`, and the brainstorm→plan handoff all assume it exists — so `/ba:review` silently receives **no acceptance context** on STANDARD/COMPREHENSIVE plans (a live defect, `commands/ba/review.md:217`). This plan adds a keyed `## Acceptance Criteria` section to all three tiers and keys the existing MINIMAL one, laying the `AC<N>` foundation the rest of the verification-schema work builds on. Everything coupled to `/ba:execute`'s checkbox/state behavior is deferred to #31 (see "What We're NOT Doing" and the brainstorm's plan-time scope correction).

## Acceptance Criteria

- [ ] AC1: The STANDARD and COMPREHENSIVE templates in `commands/ba/plan.md` each contain a `## Acceptance Criteria` section (they have none today).
- [ ] AC2: Acceptance items in all three tiers are keyed `AC<N>` (monotonic from 1), phrased as user-observable "done" statements, and **retain** the existing `- [ ]` checkbox style.
- [ ] AC3: A STANDARD or COMPREHENSIVE plan authored from the updated template surfaces its acceptance criteria to `/ba:review` (verified by inspection of `commands/ba/review.md:217` — the section is now present for it to read; **no `review.md` edit expected**).

## What We're NOT Doing

Per the brainstorm's plan-time scope correction (see brainstorm `## Scope Boundaries`), all of the following are **deferred to #31** because each is gated on `/ba:execute`'s checkbox/state rework, which is #31's core:

- **NOT going checkbox-free.** Removing `[ ]` from acceptance breaks `/ba:execute`'s MINIMAL task-derivation (`execute.md:44` — "each acceptance-criterion checkbox is a task") and `[x]` resume scan (`execute.md:41`). SYNC-4 precondition ("execute no longer reads checkboxes as state") is unmet pre-#31.
- **NOT adding per-unit `Test scenarios:` or `Verify:` fields** — they ride on #31's stable U-IDs.
- **NOT introducing the `Covers AC<N>` link syntax** — dangling until per-unit `Test scenarios:` exist (#31).
- **NOT retiring `### Success Criteria (Automated/Manual)` or rewriting the COMPREHENSIVE phase gate** (SYNC-3) — gated on per-unit `Verify:` existing to carry the "Automated" role; removing it now leaves a verification gap.
- **NOT retiring `## Behaviors to Test`** — gated on per-unit `Test scenarios:` existing as its replacement home (#31).
- **Accepting transitional overlap:** STANDARD/COMPREHENSIVE will temporarily carry `## Acceptance Criteria` + `## Behaviors to Test` + `### Success Criteria` together. The dedup is #31's job. Conscious tradeoff to ship the review-context fix now without a gap.

## Context

- `commands/ba/plan.md` — the only file edited:
  - MINIMAL `## Acceptance Criteria` at **:205-208** (two unkeyed bullets) → key them.
  - STANDARD has **no** acceptance section → insert one between `## Current State` (:251) and `## What We're NOT Doing` (:253).
  - COMPREHENSIVE has **no** acceptance section → insert one between `## Current State` (:321) and `## What We're NOT Doing` (:323).
- `commands/ba/review.md:217` reads "Overview and Acceptance Criteria sections" if present → adding the section *is* the fix; no edit anticipated. Verify only.
- Locked schema: acceptance is keyed `AC<N>`, plan-owned (minted by `/ba:plan`, not inherited from the origin), user-observable, with an optional indented "When X, Y" example; AC-IDs carry **no** stability/strike discipline — plan-internal only (see brainstorm: `## Locked Design` and Key Decisions). #35 keeps the checkbox style; checkbox-free is #31.
- Conventions (convention-checker, 2026-06-21): heading stays `## Acceptance Criteria` (not renamed); `**Code-shape decision:**` mirror untouched; **no README/CLAUDE obligation** (template internals, not a command/agent/artifact-path).

## MVP

### commands/ba/plan.md

The exact section to use, identically, in all three tiers (heading retained, items keyed, checkbox retained):

```markdown
## Acceptance Criteria

Keyed `AC<N>` (monotonic from 1), plan-owned — minted here, not inherited from the origin ticket. Each item is a user-observable "done" statement. Add an indented "When X, Y" example under a criterion only when prose alone leaves an edge case ambiguous.

- [ ] AC1: [user-observable success statement]
- [ ] AC2: [another]
```

Decisions:
- **MINIMAL (:205-208):** keep the `## Acceptance Criteria` heading; replace the two unkeyed bullets (`Core requirement 1/2`) with the keyed `AC1:/AC2:` form; add the one-line guidance note above the bullets.
- **STANDARD:** insert the full section verbatim after `## Current State` (between :251 and :253). Mirrors MINIMAL's order (acceptance precedes "What We're NOT Doing").
- **COMPREHENSIVE:** insert the full section verbatim after `## Current State` (between :321 and :323).
- **Do NOT touch** `## Behaviors to Test`, `### Success Criteria`, phase-gate lines, or any `[ ]` elsewhere. No code-shape blocks involved (this is exact template content, not code requiring a `**Code-shape decision:**` label).
- Optionally update the Step 2 section lists that enumerate tier contents (plan.md:150/156/162) only if they now misstate acceptance presence — verify, edit only if inconsistent.

### commands/ba/review.md

- Verify-only: confirm `:217` ("read its Overview and Acceptance Criteria sections") reads the section by heading when present. With AC now on all tiers, review gains context with no edit. If the read proves order/format-sensitive on inspection, that would be a surprise — none expected.

## Sources

- Origin brainstorm: `docs/brainstorms/2026-06-21-reconcile-acceptance-verification-schema-brainstorm.md` — scope split + plan-time scope correction (checkbox-free, `Covers AC<N>`, `### Success Criteria` retirement → #31); keyed/plan-owned AC and "keep the heading" decisions.
- Related: `commands/ba/plan.md:205` (MINIMAL AC), `:249-253` (STANDARD insertion), `:319-323` (COMPREHENSIVE insertion); `commands/ba/review.md:217` (consumer).

## Convention Compliance

- [x] Heading kept as `## Acceptance Criteria` (not renamed) — aligned (brainstorm decision).
- [x] `AC<N>` keying, plan-owned/minted-here — aligned.
- [x] `**Code-shape decision:**` mirror-sync clause — untouched (no code-shape text edited).
- [x] README/CLAUDE "update on command/agent/path change" — not triggered (template internals only); no obligation.
- [x] `/ba:review` no-op verification — sound (the section's absence was the defect; presence is the fix).
- [x] Plan artifact: edits a command/template prose file (consistent with the self-modifying plugin), carries YAML frontmatter with `origin:` — aligned.
- [x] **Justified override of the locked design** (confirmed with user, 2026-06-21): the brainstorm originally scoped *checkbox-free acceptance* and the *`### Success Criteria` retirement* into #35; planning falsified the "standalone" assumption (both gated on `/ba:execute`'s checkbox/Verify rework = #31). Recorded as a justified override here and corrected in the brainstorm's `## Scope Boundaries`. The schema end state is unchanged; only the issue that ships it moved.
