---
date: 2026-06-15
topic: plan-code-justification-gate
status: approved
triage_level: full
tags: [plan, execute, brainstorm, pipeline, verbosity, keep-code]
---

# Justification-Gated Hybrid: Decisions-by-Default Code in /ba:plan

## What We're Building

A change to how the dev-workflow planning pipeline treats code in plan documents. Today `/ba:plan`
mandates literal implementation code in every template tier (`Include **actual code** — not
descriptions of code`). We're moving to a **justification-gated hybrid**:

- **Default** plan content is *decisions* — approach, scope boundaries, exact file paths,
  patterns-to-follow, and test scenarios (pseudo-code allowed for shape, not literal implementation).
- A **real code block is permitted only** where the code's *shape* is itself the design decision,
  and only when flagged with an explicit `**Code-shape decision:** <why the shape is non-obvious>`
  label.
- When a brainstorm precedes the plan, code-bearing blocks **anchor to its `## Locked Design`**.

This reframes the *purpose* of code in a plan from **rework-prevention** (unmeasured, and already
half-disabled by `/ba:execute`) to **design validation** — a forcing function applied precisely where
the design is non-obvious. It is a form/contract change, not a redefinition of what a plan is for.

## Why This Approach

Provenance forced the question. `/ba:plan`'s keep-code rule is inherited ce-plan heritage, and ce
reversed it ("separate planning from implementation") six days after our fork, then hardened a no-code
model for 2.5+ months. Our own consolidated verbosity research
(`docs/research/2026-06-14-plan-verbosity-consolidated-research.md`) found the implementation body is
60–80% of every painful plan and the #1 review-cost driver is prose *inside* the code — but that
research took keep-code as a fixed input and never tested dropping it.

Three approaches were weighed:

- **(a) Keep full code** (status quo) — **rejected.** It is the volume and the cost, its stated
  benefit (rework-prevention) is unmeasured, and `execute.md:213` already treats plan code as a
  "structural reference, not complete comment inventory" — so the mechanism that would prevent
  rewrites is already disabled.
- **(b) Pure decisions-only** (ce's headline) — **rejected.** Throws away the design-validation
  forcing function that has real value where the shape is non-obvious.
- **(c) Justification-gated hybrid** — **chosen.** It is where ce *actually* landed (their carve-out:
  code allowed "unless the plan is about code shape as a design artifact"), and it matches the
  reviewer's own split instinct — code earns its place only where shape is the risk, and doesn't
  the rest of the time. It also dissolves the unmeasured-benefit problem by changing *why* code is
  kept (design validation, not rework-prevention), so no rework measurement is required.

## Key Decisions

- **Hybrid, not binary** — decisions-by-default; literal code only where shape is the design decision.
  *Rationale:* preserves the forcing function where it pays, removes it where it is pure cost.
- **Trigger = justification-gated** — a real code block requires a `**Code-shape decision:** <why
  non-obvious>` label. *Rationale:* self-policing, works with or without a brainstorm, and the label
  simultaneously fills the under-served "design rationale" gap the research identified.
- **Anchor to Locked Design** — when a brainstorm origin exists, code-bearing blocks lock onto its
  `## Locked Design` (interface, signatures, invariants, error modes). *Rationale:* the pipeline
  already has this binding decisions-only artifact; generalize it rather than invent a new one. Wire
  `plan.md` Step 0 to name it as a source (it currently doesn't).
- **Purpose reframe** — code in a plan is for *design validation*, not *rework-prevention*.
  *Rationale:* removes the need to measure rework (moot) and aligns with how `/ba:execute` already
  behaves.
- **Plan stays the authority** — the decisions-first contract must keep the plan unambiguously
  authoritative so `/ba:execute` implements the plan's decisions and does not silently invent build
  choices the plan deliberately left as pseudo-code. *Rationale:* preserves the execution-commands
  convention (the plan is the authority on what to build).
- **Review-plan restructure deferred** — not bundled here. *Rationale:* orthogonal to keep-code, and
  the hybrid changes review-plan's inputs (lighter, code-light plans), so decide its fate after the
  hybrid lands. [considered, deferred]

## Scope Boundaries

- **NOT** redefining what a plan is *for* — purpose untouched; form/contract only.
- **NOT** pure decisions-only — the code-shape carve-out stays.
- **NOT** measuring rework-prevention — moot under the design-validation reframe.
- **NOT** changing `/ba:review-plan` in this effort (deferred). Also out: the integrated-economy-pass
  idea and the auto-HTML-companion idea (both parked for separate evaluation).
- **NOT** changing the MINIMAL/STANDARD/COMPREHENSIVE tier *purposes* — the decisions-default applies
  across all tiers (tiers scale context/phasing, not the presence of code).

## Acceptance Criteria

- `plan.md`'s three templates (MINIMAL / STANDARD / COMPREHENSIVE) default to decisions + pseudo +
  exact file paths + patterns-to-follow + test scenarios; literal code appears only under a
  `**Code-shape decision:** <why>` label.
- The "Key rules for all templates" section no longer mandates "actual code, not descriptions"; it
  states the justification-gated rule instead.
- `plan.md` Step 0 names `## Locked Design` as a binding source when a brainstorm origin exists.
- `execute.md`'s default path writes code from the plan's decisions; literal-code reuse is reserved
  for `**Code-shape decision:**` blocks; the "follow it exactly / already reviewed" framing is
  softened toward "implement to the plan's decisions"; Step 1.5b LoC projection default flips to
  estimate-from-description.
- `review-plan.md` and `brainstorm.md` require no contract-breaking change (confirmed by the
  pipeline-contract map).
- **Validation:** re-render one STANDARD and one COMPREHENSIVE plan under the new rule — code volume
  drops to only justified blocks, and the design rationale (the "why") now appears where code used to.

## Open Questions

None — trigger rule, purpose reframe, and review-plan scope were all resolved in dialogue.

## Convention Compliance

Convention-checker run before write: **0 violations**, 4 aligned, 4 N/A. The design is convention-clean
and *strengthens* the "planning commands never write code" rule (it pushes `/ba:plan` further toward a
documenter role). Downstream requirements to carry into the plan/execute stage (not brainstorm
violations):

1. **README.md sync** — update command descriptions/contracts that describe plan output as code-bearing.
2. **plugin.json version bump** — current `0.23.0`; bump on the shipped change (it is the auto-update
   cache key — do not defer).
3. **Cross-file consistency** — the `**Code-shape decision:**` label and the `## Locked Design` anchor
   wording must stay in sync across `plan.md`, `execute.md`, and any README description (mirror the
   existing `/ba:review` "keep them in sync" discipline).

## Next Steps

→ `/ba:plan` to create the implementation plan. Primary target: `plan.md` template rewrite + inverted
"Key rules" + Step 0 Locked-Design wiring (HIGHEST blast radius). Secondary: `execute.md` default-flip
and softened "follow exactly" framing (MODERATE). Include the README sync and version bump as explicit
plan steps.
