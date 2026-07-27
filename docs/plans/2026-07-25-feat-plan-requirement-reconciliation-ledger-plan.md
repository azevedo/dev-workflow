---
title: Add requirement reconciliation ledger to /ba:plan
type: feat
plan_schema: 2
status: active
date: 2026-07-25
origin: docs/brainstorms/2026-07-24-plan-requirement-reconciliation-ledger-brainstorm.md
detail_level: standard
tags: [ba-plan, requirement-fidelity, acceptance-criteria, scope-guard, plan-gate]
---

# Add requirement reconciliation ledger to /ba:plan Implementation Plan

## Overview

Add a requirement-reconciliation step to `commands/ba/plan.md` so `/ba:plan` cannot silently drop
or narrow an explicit origin requirement. After the plan body and its `AC<n>` are drafted, the
command enumerates the origin's explicit requirements (source-agnostic), reconciles each to an
`AC<n>` or an explicit exclusion, prints the full ledger on every path, and — folded into the
existing mandatory pre-write gate — stops to ask the user only on scope-reducing or low-fidelity
outcomes. Confined to `plan.md` plus two doc-sync edits. See brainstorm:
`docs/brainstorms/2026-07-24-plan-requirement-reconciliation-ledger-brainstorm.md`.

## Current State

- `commands/ba/plan.md:59-108` — Step 0 ingests a brainstorm origin richly (carry-forward at
  `:81-89`, "the brainstorm is the origin document" `:91`) or refines a bare prompt; a Linear
  ticket is **not** a recognized ingestion path (only outbound `issue create` in Step 7).
- `plan.md:254` — AC minting: "*plan-owned, minted here, **not inherited from the origin ticket***"
  — no reconciliation back to origin requirements exists.
- `plan.md:214-218` — Step 3 spec-flow findings are folded via "incorporate / add / note" with
  **no gate** (the direct Gap-B mechanism in the grounding case).
- `plan.md:261-263, 308-309, 376-377` — `## What We're NOT Doing` is authored silently; nothing
  surfaces exclusions to the user.
- `plan.md:495-519` — Step 5 convention-compliance is the **only** mandatory pre-write gate
  ("MUST resolve all violations before writing", `:511`); it gates on convention, not requirement
  coverage.
- `plan.md:523-537` — Step 6 brainstorm cross-check is brainstorm-only and prose-only; lines
  `:531` ("Constraints and requirements are captured in acceptance criteria") and `:535`
  ("Scope boundaries … in What We're NOT Doing") overlap the new step.
- `plan.md:570-595` — Step 7 runs `/ba:review-plan --auto` (reads only the plan; never the origin).
- `.claude-plugin/plugin.json:3` — `"version": "0.35.0"`.
- `docs/solutions/` — does not exist (no prior learnings).

## Acceptance Criteria

- AC1: `/ba:plan` enumerates the origin's explicit requirements (source-agnostic — from ticket text
  in context, the brainstorm, or the refined prompt; no Linear API) and reconciles each to either
  an `AC<n>` or an explicit exclusion; no explicit requirement is silently absent from the
  reconciliation.
- AC2: The full reconciliation ledger **prints on every reachable `/ba:plan` path** — all detail
  levels, all origin types, interactive or not. A clean reconciliation and a skipped reconciliation
  are never byte-identical output.
- AC3: A single batched pre-write decision round stops and asks the user (AskUserQuestion) on any of:
  (a) a **plan-introduced** exclusion, (b) a Step 3 spec-flow finding at critical/important tier that
  proposes narrowing or dropping a requirement, (c) a thin-origin divergence, (d) `origin-unresolved`.
  These are batched with Step 5's convention violations into one round — not serial stops.
- AC4: A plan whose requirements all map cleanly to ACs, with none of the AC3 conditions present, is
  written with no added prompt (no gate fatigue on the common case).
- AC5: An inherited, already-user-approved brainstorm scope boundary is **printed** in the ledger but
  does **not** trip the gate (only plan-introduced exclusions do).
- AC6: When the origin is a bare reference (ticket ID/URL) whose body is not in context, `/ba:plan`
  emits `origin-unresolved` and gates — it never emits a clean-looking empty ledger from absent text.
- AC7: The thin-origin condition fires only on a fidelity↔ambition mismatch — not on a legitimately
  small MINIMAL task with a thin origin. "Thin origin" has an **operational definition** (not a
  fuzzy judgment): the origin yields **fewer than 2 explicit requirements**, OR **at least half the
  minted ACs are assistant-inferred** (no origin-traceable requirement). The condition fires only
  when that thin-origin test is true **and** (detail level is STANDARD/COMPREHENSIVE **or** ≥2
  inferred ACs); it is suppressed on a MINIMAL plan whose small scope matches the thin origin.
- AC8: In a non-interactive session the gate prints the ledger plus a "gate not presented —
  non-interactive" trace and proceeds for the **new** decision conditions; it never hangs and never
  silently drops. Convention-checker violations retain their unconditional resolve-before-write
  semantics in every mode (they are never carried past on the non-interactive path).
- AC9 (grounding regression): Replaying the tiger!88267 scenario, "keep `notes` and `edit_reason`
  separate" is enumerated as a requirement and, dispositioned as a plan-introduced exclusion, is
  surfaced to the user before write — it cannot be silently demoted to `## What We're NOT Doing`.
- AC11 (partial coverage): A compound or bidirectional requirement is decomposed into
  independently-reconciled sub-clauses. A requirement satisfied in one clause but dropped/narrowed
  in another does **not** reconcile as fully covered (`→ AC<n>`) — the dropped sub-clause surfaces
  as its own disposition (an exclusion, which then gates). This closes the sharper variant of the
  grounding failure: tiger!88267 was a *bidirectional* requirement ("keep separate") met one way
  and dropped the other, which a per-requirement (non-decomposed) check would wave through.
- AC10: The change is confined to `commands/ba/plan.md`, `README.md`, and
  `.claude-plugin/plugin.json`. `execute.md`, `review.md`, all agent files, the locked AC/`Verify:`
  schema, and `references/plan-sections.md` are unchanged; no reviewer "selection ledger" mirror
  site is modified; no new plan section is added.

## What We're NOT Doing

- No changes to `commands/ba/execute.md` or `commands/ba/review.md`.
- No Linear/tracker API ingestion path — source-agnostic capture only.
- No persisted `## Requirement Ledger` plan section; the ledger is transient (printed), and
  `references/plan-sections.md` / the HTML header contract are untouched. Approved exclusions live
  in the existing `## What We're NOT Doing`. *(User decision this session: transient over persisted.)*
- No edits to `spec-flow-analyzer` / `convention-checker` agent output contracts — condition (b)
  maps to spec-flow's existing critical/important tiers rather than a new machine flag.
- `/ba:review-plan` is not given the origin and gets no requirement backstop here (that is issue #6,
  separate).
- The locked AC / `Verify:` / `Test scenarios:` schema is not reopened; ACs are still authored, not
  auto-generated from requirements — the ledger only checks coverage and surfaces reductions.
- No CE-style mandatory behavior-pinning-test rule (noted as future work in the brainstorm).

## Proposed Solution

A new **Requirement Reconciliation** step (Step 4.6, after Step 4 draft/AC-minting) computes a
transient ledger: it enumerates the origin's explicit requirements, maps each to `→ AC<n>` or
`→ EXCLUDED: <reason>` (recording provenance), and prints it unconditionally. The existing mandatory
Step 5 gate is widened into a single batched pre-write decision round that adds four
scope/fidelity stop conditions alongside its convention violations. Step 3 is amended so a flagged
spec-flow finding is parked for that round instead of being silently folded. Step 6's two
requirement/scope lines are trimmed to cross-reference the ledger. README and `plugin.json` are
synced. The mechanism is the project's enumerate-everything-drop-nothing ethos, but named the
"requirement reconciliation ledger" and explicitly **not** a mirror site of the reviewer selection
ledger.

## Technical Considerations

- **Falsifiability of enumeration** is the weak link (spec-flow C2): the guarantee only holds if
  enumeration catches the buried requirement. Step 4.6 carries an explicit self-check — *"for each
  origin requirement, could the plan ship and pass all its ACs without addressing it? If yes, it is
  under-mapped"* — mirroring the `Verify:` falsifiability rule at `plan.md:491`.
- **Gate fatigue** is controlled by three design choices: provenance (AC5), divergence-gated
  thin-origin (AC7), and batching into one round (AC3).
- **The Caution-1 carve-out** (convention-checker gate) is a correctness constraint, not a
  preference — see U2.

## System-Wide Impact

- **Interaction graph**: Step 4.6 consumes the drafted ACs + `## What We're NOT Doing` + parked
  Step 3 findings; feeds the merged Step 5 gate; the gate precedes the Step 7 disk-write and the
  `/ba:review-plan --auto` pass. No new agent dispatch.
- **Error propagation**: `origin-unresolved` and non-interactive are explicit branches (AC6, AC8);
  neither silently drops. Convention violations keep their hard pre-write semantics.
- **State lifecycle**: ledger is transient (no persisted state); on a `/ba:plan` resume the step
  re-enumerates and must dedupe against the existing `## What We're NOT Doing` rather than
  blind-appending (spec-flow I5).

## Implementation Approach

**File**: `commands/ba/plan.md`

### U1 — Requirement Reconciliation step (enumerate → reconcile → print) + Step 6 trim

Add a new **Step 4.6 "Requirement Reconciliation"** after Step 4 (Draft the Plan), before Step 5.
Decisions:
- **Enumerate** the origin's *explicit* requirements as a transient list. Define "explicit"
  tightly (spec-flow M3): an imperative, user-observable demand stated in the origin (a "must/
  should", a bulleted requirement/fix-direction, an explicit brainstorm AC) — exclude background,
  rationale, implementation suggestions, examples.
- **Decompose compound/bidirectional requirements into sub-clauses** (review AC11): a requirement
  with multiple independent clauses or a bidirectional demand (e.g. "keep A and B **separate**" ⇒
  "A must not leak into B" **and** "B must not leak into A") is split into sub-clauses, each
  reconciled independently. A sub-clause satisfied while its sibling is dropped does **not** let the
  parent reconcile as `→ AC<n>` — the dropped sub-clause gets its own disposition. This is the fix
  for the *partial-coverage* variant a per-statement check waves through.
- **`origin-unresolved` detection** (spec-flow C2): if the origin is a bare reference (ticket
  ID/URL, "see the ticket") whose body is **not** in context, do not emit a clean empty ledger —
  mark the reconciliation `origin-unresolved` (a gate condition, handled in U2).
- **Reconcile** each requirement to `→ AC<n>` (one or more) or `→ EXCLUDED: <reason>`. Record
  **provenance** on each exclusion: `inherited` (mirrors an already-approved brainstorm scope
  boundary carried in per `plan.md:84`) vs `plan-introduced` (the plan chose to drop/narrow a
  requirement the approved origin did not already exclude). Only `plan-introduced` is a gate
  condition (U2 / AC5).
- **Falsifiability self-check** per Technical Considerations, applied **per sub-clause** during
  reconciliation (so a partially-covered compound requirement fails the check on its dropped clause).
- **Print the full ledger unconditionally** on every reachable path (all detail levels, all origin
  types, interactive or not). State this as an explicit invariant in the step text: *the ledger
  prints on every path; only the gate is conditional; a clean pass and a skipped reconciliation
  must not produce identical output* (the propose-5f observability lesson — see
  `docs/plans/2026-07-22-fix-propose-5f-mandatory-trace-plan.md`).
- **All detail levels** run U1 (spec-flow M1) — the anti-silent-drop core is cheap and the failure
  can bite a MINIMAL plan.
- **Resume dedupe** (spec-flow I5): approved exclusions are written to `## What We're NOT Doing`
  only if not already present. Dedupe on the **excluded requirement's identity** (which requirement
  is being excluded), **not** the free-text reason string — two runs may word the same exclusion
  differently, and an exact-string check would append a near-duplicate.
- **Trim Step 6** (`plan.md:531` and `:535`): replace those two independent checks with a
  cross-reference to Step 4.6 (the ledger now owns requirement/scope reconciliation for *all*
  origins, not just brainstorm). Leave Step 6's other items (decisions reflected, approach matches,
  open questions, `origin:` frontmatter, Sources) intact.

Test scenarios:
- A ticket requirement that maps to an AC shows `R→AC<n>` in the printed ledger (Covers AC1)
- A requirement the plan drops shows `EXCLUDED: <reason>` with `plan-introduced` provenance
  (Covers AC1, AC9)
- An inherited brainstorm scope boundary shows in the ledger tagged `inherited` (Covers AC5)
- A bare ticket-ID origin with no body in context yields `origin-unresolved`, not an empty ledger
  (Covers AC6)
- The ledger prints on a fully-clean MINIMAL plan (nothing gated) — output is not identical to a
  run where the step was skipped (Covers AC2)
- A bidirectional requirement ("keep A and B separate") whose plan covers only one direction does
  NOT reconcile as `→ AC<n>`; the uncovered sub-clause surfaces as its own disposition
  (Covers AC11)
- Re-running `/ba:plan` on an in-flight plan does not duplicate `## What We're NOT Doing` entries,
  matching on excluded-requirement identity not reason text (Covers AC1)

Verify: `grep -q 'Requirement Reconciliation' commands/ba/plan.md && grep -q 'origin-unresolved' commands/ba/plan.md && grep -q 'plan-introduced' commands/ba/plan.md && grep -q 'inherited' commands/ba/plan.md && grep -q 'sub-clause' commands/ba/plan.md && ! grep -q 'Constraints and requirements are captured in acceptance criteria' commands/ba/plan.md`

### U2 — Merged batched pre-write decision gate + Step 3 parking + non-interactive fallback

Widen the existing MANDATORY Step 5 convention gate into a **single batched pre-write decision
round**. Decisions:
- **Stop-and-ask conditions** (new, batched with Step 5's convention violations into one
  AskUserQuestion round, not serial stops): (a) a `plan-introduced` exclusion; (b) a Step 3
  spec-flow finding at **critical/important** tier that proposes narrowing/dropping a requirement
  (map to existing tiers — no agent-contract change); (c) **thin-origin divergence** per the
  operational definition in AC7; (d) `origin-unresolved`.
- **De-dupe (a) and (b)** (review — simplification): (a) and (b) can co-fire for the *same*
  origin-explicit requirement (the ledger already surfaces it as a `plan-introduced` exclusion).
  Scope (b) to spec-flow findings **not already covered by an origin-explicit requirement** (a
  spec-flow-discovered gap the origin never stated); when they do co-fire on one requirement, the
  batched round asks **once**, not twice.
- **Clean pass** (none of a–d, no convention violations) writes with no added prompt (AC4).
- **Caution-1 carve-out (load-bearing):** the non-interactive proceed-fallback applies **only** to
  the new decision conditions (a–d). Convention-checker VIOLATIONS keep their pre-existing
  unconditional "MUST resolve all violations before writing" semantics (`plan.md:511`) in **every**
  mode. The gate text must carry the literal canonical marker phrase — *"never auto-proceeds past a
  convention violation"* — so the carve-out is greppable by U2's `Verify:` and a regression that
  drops it is falsifiable (review — test-coverage, conf 100).
- **Non-interactive check order** (review AC8, was suppressed but folded in for airtightness):
  evaluate convention violations **first** and hard-stop if any exist, independent of (a–d); only
  then evaluate (a–d) for the trace-and-proceed path — so a mixed headless round can never leak a
  violation past.
- **Non-interactive fallback** (spec-flow M2): in a non-interactive session, print the ledger plus a
  `gate not presented — non-interactive` trace and proceed for conditions (a–d); never hang. (Mirror
  the trace shape in `docs/plans/2026-07-22-fix-propose-5f-mandatory-trace-plan.md`.)
- **Amend Step 3** (`plan.md:214-218`): a spec-flow finding flagged (critical/important) as
  proposing to narrow/drop a requirement is **parked** and routed to this gate instead of being
  silently folded via "incorporate/add/note". **Carrier decision (pinned now, review — not deferred
  to execution):** the parked finding is held in the assistant's running context under a named
  heading — literally a `Parked-for-gate:` list — from Step 3 until the gate reads it; it is
  **never** written into the plan doc. The `Parked-for-gate:` token is the distinctive string U2's
  `Verify:` greps at both ends (producer in Step 3, consumer in the gate) so the wire can't dangle.

Test scenarios:
- A plan-introduced exclusion triggers one AskUserQuestion in the merged round (Covers AC3, AC9)
- A convention violation and a plan-introduced exclusion surface in the **same** batched round, not
  two serial stops (Covers AC3)
- A thin origin on a MINIMAL, correctly-scoped task does **not** trigger the gate (Covers AC7)
- A thin origin on a COMPREHENSIVE plan (or with several inferred ACs) triggers the thin-origin ask
  (Covers AC7)
- Non-interactive run past a plan-introduced exclusion prints the trace and proceeds; a convention
  violation in the same run still blocks the write (Covers AC8)
- A plan whose ledger has no exclusions, no origin-unresolved, no thin-origin divergence, and no
  critical Step 3 finding writes with **no** AskUserQuestion round (Covers AC4)
- A critical Step 3 spec-flow finding that proposes dropping a requirement reaches the gate rather
  than being folded silently (Covers AC3)

Verify: `grep -q 'plan-introduced' commands/ba/plan.md && grep -q 'gate not presented — non-interactive' commands/ba/plan.md && grep -q 'Parked-for-gate' commands/ba/plan.md && grep -q 'auto-proceeds past a convention' commands/ba/plan.md`

### U3 — Doc sync (README + version bump)

**Files**: `README.md`, `.claude-plugin/plugin.json`. Decisions:
- Update the `/ba:plan` description in `README.md` with a substantive one-line mention of the
  requirement reconciliation ledger / pre-write scope-reduction gate (not just a version string).
  Edit only the `/ba:plan` block — do **not** touch the review/review-plan selection-ledger bullets
  (avoids the three-site never-hide sync obligation).
- Bump `.claude-plugin/plugin.json` `version` `0.35.0 → 0.36.0` (minor feature; the auto-update
  cache key).

Test scenarios:
- `README.md` `/ba:plan` entry mentions the reconciliation ledger behavior (Covers AC10)
- `plugin.json` reads `0.36.0` (Covers AC10)
- The review/review-plan selection-ledger README bullets are unchanged

Verify: `grep -q '"version": "0.36.0"' .claude-plugin/plugin.json && grep -qiE 'reconcil' README.md`

## Dependencies & Risks

- **Risk — enumeration misses a buried requirement** (the failure this fixes): mitigated by the
  tight "explicit" definition + the falsifiability self-check (U1), but not eliminated; it degrades
  gracefully (a missed requirement is no worse than today).
- **Risk — merged gate weakens the convention check**: mitigated by the load-bearing Caution-1
  carve-out (U2 / AC8). This is the item to review most carefully at execution.
- **Risk — gate fatigue**: mitigated by provenance (AC5), divergence-gating (AC7), and batching
  (AC3).
- No external dependencies; no new agents; single-command scope keeps the U-ID and stack-base
  citation grids untouched.

## Sources & References

- Origin brainstorm: `docs/brainstorms/2026-07-24-plan-requirement-reconciliation-ledger-brainstorm.md`
  — carried forward: source-agnostic capture, show-all/stop-on-reductions, transient ledger, Step 6
  supersession, thin-origin condition, scope boundaries, AC1–7.
- Grounding case + root cause: tiger!88267 / TATO-2943 (requirement demoted at plan time, verified
  via session transcripts).
- Observability + non-interactive precedent: `docs/plans/2026-07-22-fix-propose-5f-mandatory-trace-plan.md`.
- Locked AC/Verify schema (not reopened): `docs/brainstorms/2026-06-21-reconcile-acceptance-verification-schema-brainstorm.md`.
- Related roadmap: issue #6 (review-completeness — separate, coverage-only).

## Convention Compliance

- [x] Planning-never-writes-code — ledger prints; exclusions land in `## What We're NOT Doing`;
  no source write. Aligned.
- [x] Convention-compliance mandatory before write — strengthened, not weakened; the Caution-1
  carve-out (U2/AC8) keeps convention violations unconditionally blocking in every mode.
- [x] Never-hide "selection ledger" proper noun — feature named "requirement reconciliation ledger",
  distinct; no reviewer mirror site touched (U3 edits only the `/ba:plan` README block). Aligned.
- [x] U-ID / stack-base citation grids — untouched (`plan.md` stays grammar-only; Step 6 is not a
  convention owner). Aligned.
- [x] Locked AC/`Verify:` schema + `references/plan-sections.md` — not reopened (transient ledger,
  no new section). Aligned.
- [x] README-sync + `plugin.json` bump (0.35.0 → 0.36.0) — U3. Aligned.
- [x] `Verify:` minting — distinctive newly-introduced greps (falsifiable; avoid pre-existing terms
  like bare "ledger"). Aligned.
