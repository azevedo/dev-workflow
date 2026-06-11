---
date: 2026-06-11
topic: ba-propose-lean-body
status: approved
triage_level: standard
tags: [ba-propose, body-composition, leanness, editorial-discipline, lynch, ce]
---

# `ba:propose` — Restore Lean-Body Editorial Discipline

## What We're Building

A targeted hardening of `ba:propose`'s body-composition spec (Step 3 of `commands/ba/propose.md`) so it actively keeps MR/PR bodies lean.

The command already ports Lynch's section *menu* and a "never restate the diff verbatim" invariant — but during the port it dropped CE's editorial *discipline*: the "match weight to weight / shorter wins / a larger diff earns more selectivity, not more content" principle, the per-size shape targets, and Lynch's explicit "leave out" list. The result is an **additive** section registry (more sections activate as the diff grows) braked only by a single 150-line warning that fires after roughly five screens — too late and too blunt to push toward the one-screen target.

We restore that discipline. The audience is anyone running `ba:propose` and, downstream, the reviewer who reads its output.

## Why This Approach

Three scopes were on the table:

1. **Restore the dropped discipline** (chosen) — add the selectivity principle, per-size shape targets, and a "leave out" block; make the size signal per-tier. The feedback's specific anti-patterns (re-narrating the diff, splitting what/why into two headed sections, enumerating every unit test, six reviewer-note bullets, an un-collapsed image wall with verbose captions) are all *symptoms* of one root gap — under-ported editorial pressure. Restoring what the source material demonstrably contained is more surgical and more principled than bolting on new ad-hoc rules.
2. **Light touch — just add the anti-pattern rules as guidelines** (rejected) — leaves the additive registry and the late single cap as the structural bias; treats symptoms, not cause.
3. **Minimal — only the verifiable bits** (rejected) — the triggering feedback was an MR body *not verified* to be a propose output, so this option would defer the fix until a real propose run bloats. But the structural bias (additive registry + late cap) lives in the spec regardless of which body triggered the feedback, and the fix is cheap prompt-guidance. Waiting buys nothing.

**All edits live inside the composition seam.** The `compose_body` contract and the opaque-input philosophy are synthesis-locked (`docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md` `## Locked Design`) and are left untouched. The tier→section mapping and editorial rules are explicitly seam-hidden and "swappable… not a frozen contract" (that brainstorm's internal-sketch note), so tightening them is squarely within the lock. No rejected-design elements (Design B's public `overrides`, Design C's I/O ports) are re-added.

## Key Decisions

- **Selectivity becomes a composition invariant.** Add to Step 3's invariants list, beside the existing "never restate the diff verbatim": *"Match weight to weight; when in doubt, shorter wins; a larger diff earns more selectivity, not more content."* This is the general rule — every decision below is an instance of it.
- **Restore the per-tier shape targets dropped in the port.** small = prose, no headers unless two distinct concerns, ~300-char target; medium = narrative + ≤2 `H2` sections (~one screen); large = ≤150 lines as a backstop; perf = before/after table + narrative. These are **soft editorial targets**, consistent with Step 3.6's existing "Do not auto-trim — the user decides" stance — not rigid gates.
- **Add a "Leave out" rule block to Step 3**, mirroring Lynch's "Leave out" list: no file-list / what-changed play-by-play (the diff already shows it); no unit-test enumeration; cap reviewer / alternatives notes to ~2–3 and fold a lone one into Impact/Scope; wrap screenshots/demo in `<details>` with one-line captions.
- **The size signal goes per-tier.** Replace Step 3.6's single global 150-line warning with tier-aware overshoot warnings; the diagnostic surfaced at preview (Step 4) names the tier's *own* target, not a global 150.
- **Resolve the Impact (#2) / Motivation (#3) tension without contradicting the feedback.** Keep both section-registry rows, but govern them with "no headers unless two distinct concerns" — they fold into prose at small/medium tier and become separate headed sections only at large tier. This honors both the feedback's "one What/Why" instinct and Lynch's menu.

## Scope Boundaries

- **Not touching** the `compose_body` contract, the orchestrator (Steps 0–2, 5), branch routing, host dispatch, or the preserved-block / Linear / `docs/solutions/` plumbing.
- **No new tier, no new section, no config knob.** No `--lean` flag — the preview's Edit affordance already covers ad-hoc trimming (same lens as the dropped `--diverge`).
- **No auto-trimming.** The size signal warns; the user decides (unchanged from Step 3.6).
- **No README / CLAUDE.md change** — no command, agent, or artifact-path is added or renamed. A `plugin.json` version bump applies when the `propose.md` edit *ships*, not at brainstorm stage (carry it as a ship-time checklist item so it isn't deferred).

## Acceptance Criteria

- Step 3's invariants list carries a selectivity invariant phrased as "shorter wins / more selectivity, not more content."
- The section-registry body rules plus a new "Leave out" block encode: no what-changed play-by-play, no unit-test enumeration, capped reviewer/alternatives notes, `<details>` screenshots, and "no headers unless two distinct concerns."
- Step 3.6 emits a **per-tier** overshoot warning whose text names the tier's own target (small ~300 chars / medium ~one screen / large ~150 lines); the single global-threshold warning is gone.
- A sample medium change composes to roughly one screen by default, and a small change to a few sentences with no headers — verifiable via the `--describe-only` dry run.
- The `compose_body` contract, the orchestrator, and all Step 2 gather logic are unchanged — confirmable by diffing the edit and seeing it confined to Step 3 (3.2 / 3.4 / 3.6 + invariants), the Step 4 preview warning text, and the "Important Guidelines" footer.

## Open Questions

*(None — both design forks resolved in dialogue: scope = restore-discipline; size signal = per-tier targets with overshoot warnings.)*

## Convention Compliance

Convention-checker run 2026-06-11: 9 conventions checked, 7 aligned, **0 violations**, 2 advisory risks.

- **Risk (public-safe artifacts):** clean at the description level. Watch-item for plan/execute — any illustrative MR/PR body example in the final `propose.md` prose must use a fabricated, non-Dragon subject. The `compose_body` seam name is established public-safe precedent (used throughout the 2026-05-19 brainstorm's public `## Locked Design`).
- **Risk (don't invent verbatim constraints when porting):** the per-tier numbers (~300 chars / ≤2 H2 / ≤150 lines) must read as **soft editorial targets**, consistent with the existing "soft size cap" / "user decides" language — not hardened into rigid gates. Captured as a Key Decision above.
- **Aligned:** planning-command-never-writes-code (documents WHAT, not code); synthesis-lock honored (edits are seam-internal, contract untouched, no rejected-design re-add); frontmatter + filename convention; no README change triggered; version bump deferred to ship time correctly.

## Next Steps

→ `/ba:plan` to turn this into an implementation plan for the `commands/ba/propose.md` Step 3 edits.
