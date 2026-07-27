---
date: 2026-07-24
topic: plan-requirement-reconciliation-ledger
status: approved
triage_level: full
tags: [ba-plan, requirement-fidelity, acceptance-criteria, scope-guard, plan-gate]
---

# Requirement Reconciliation Ledger for `/ba:plan`

## What We're Building

A plan-time reconciliation step in `commands/ba/plan.md` that stops `/ba:plan` from silently
dropping or narrowing an explicit origin requirement. After the plan body (and its `AC<n>`) is
drafted, the command enumerates the origin's **explicit** requirements as a transient list,
reconciles each to a disposition — either `→ AC<n>` (covered) or `→ EXCLUDED: <reason>` (a scope
reduction, landing in the existing `## What We're NOT Doing`) — and prints the full mapping as an
audit trail. Before the disk-write it **soft-gates**: it stops and asks the user (AskUserQuestion)
when a requirement resolves to an exclusion, when a dispatched sub-agent flagged an open decision,
or when the origin was too thin to trace (few/no explicit requirements, or ACs that are mostly the
assistant's inference rather than origin-sourced). Clean requirement→AC mappings pass with no added
friction.

It is for the plan author (the assistant) and the human reviewing the plan — it closes the trust
boundary "I trusted the Linear→plan translation was accurate" that the grounding case broke.

## Why This Approach

**The grounding failure was mis-located by the original handoff.** Full investigation (tiger
!88267 / TATO-2943, transcript-verified) showed the requirement — "keep `notes` and `edit_reason`
separate" — was explicit and path-owner-sourced, that **two** sub-agents (spec-flow-analyzer,
convention-checker) flagged the decision as needing sign-off, and that `/ba:plan` let the assistant
resolve it silently inside the artifact (demoted to `## What We're NOT Doing`, reframed as
already-satisfied). `/ba:execute` then faithfully built the reduced scope. So the defect is at
**plan time**, not execute or review time — every downstream gate anchors on the plan and cannot
catch a defect the plan itself sanctions.

**Two structural gaps confirmed by research (`commands/ba/plan.md`, `commands/ba/review-plan.md`):**
- **Gap A — no requirement→AC reconciliation.** ACs are minted fresh ("*not inherited from the
  origin ticket*", `plan.md:254`); nothing checks that every stated requirement became an AC or an
  explicit exclusion. A requirement can simply never reappear.
- **Gap B — scope reductions and flagged decisions resolve silently.** `## What We're NOT Doing` is
  authored with no surfacing step; Step 3's spec-flow findings are folded via "incorporate / add /
  note" with **no gate** (`plan.md:214-218`). The only hard gate today is Step 5 (convention
  compliance) — it does not gate on requirement coverage or scope reduction.

**Why this shape.** The mechanism reuses the project's established *enumerate-everything, drop-
nothing-silently* ethos (as in `/ba:review`'s selection ledger) but is deliberately named the
**requirement reconciliation ledger** and is **not** a mirror site of the reviewer never-hide
convention (which names exactly three sites — keep them untouched). It is confined to `plan.md`,
the only command that sees the origin, and it steps around the locked AC/`Verify:`/`Test scenarios:`
schema by *mapping* origin requirements to plan-minted ACs, never inheriting or renumbering them.

**Rejected alternatives.** (1) *Minimal gate-only, no ledger* — surfaces exclusions but enumerates
nothing, so a requirement never mentioned again still vanishes; rejected as not fixing Gap A.
(2) *First-class Linear ingestion* — a real fetch/parse path; rejected as Linear-coupled and heavier
than needed (source-agnostic capture works for any origin, matching issue #6's re-scoping).
(3) *Delegate the backstop to `/ba:review-plan`* — it reads only the plan, never the origin
(`review-plan.md:78-80, 615`), so it structurally cannot reconcile against requirements; that is
issue #6's coverage-only territory and a separate, larger change.

## Key Decisions

- **Source-agnostic requirement capture.** Enumerate the *explicit* requirements already in context
  — pasted/fetched ticket text, the brainstorm, or the refined prompt. "Explicit" = a stated
  requirement / fix-direction / acceptance in the origin, not inferred desiderata. No Linear API
  integration. Rationale: works for every origin; avoids tracker coupling.
- **Show-all, stop-on-reductions (soft-gate).** Print the full ledger for auditability, but only
  block-and-ask on (a) any requirement dispositioned as an exclusion, (b) any sub-agent finding
  flagged as needing an explicit decision, and (c) a thin/low-fidelity origin (see next decision).
  Clean 1:1 requirement→AC mappings pass silently. Rationale: catches the real failure (a
  rationalized exclusion) without gate fatigue, since exclusions/flagged-decisions are rare relative
  to clean coverage.
- **Thin-origin / inferred-AC signal (third stop condition).** A thin ledger must not be a silent
  no-op. When the origin yields few or no explicit requirements, or when most minted ACs trace to
  the assistant's interpretation rather than the origin, surface it before writing — *"origin was
  thin: N ACs inferred, M sourced; confirm this is the intended scope"* — and stop for the user's
  sign-off. Rationale: a poor ticket is exactly where the Linear→plan translation is least
  trustworthy (the grounding case's broken trust boundary); the coverage half (Gap A) is otherwise
  near-vacuous on a lacking ticket — this turns that silence into an explicit interpretation check.
  It does **not** invent requirements — it makes the *act of inferring* visible and consented to.
- **Amend Step 3 (and Step 5) finding-handling.** A sub-agent finding explicitly flagged as "needs
  an explicit decision" / "under-specified — author must be explicit" must route into the gate's
  stop-and-ask set rather than being silently folded via "incorporate / add / note". This is the
  direct cause in the grounding case and the core of Gap B.
- **Transient ledger, not a persisted plan section.** The requirement→AC mapping is scaffolding used
  to find the gaps, then discarded; approved exclusions live in the existing `## What We're NOT
  Doing` with their (now user-approved) reasons. Rationale (Simplicity First / YAGNI + the locked
  read-only-plan model): avoids a new template section, a `references/plan-sections.md` contract
  change, and any new plan state. The bug-relevant decisions (exclusions-with-reasons) remain
  durable regardless. *(This is an internal-mechanism choice, not a scope reduction of the request —
  both gaps are fully fixed either way.)*
- **Generalizes the brainstorm-only cross-check.** Today's Step 6 requirement-capture line
  (`plan.md:531`) runs only for brainstorm origins and is prose-only; the new step supersedes it
  with a source-agnostic reconciliation.
- **Named distinctly; not a never-hide mirror site.** Per convention-check Flag 1 — keep the
  concept, avoid the "never-hide ledger" label, and do not touch the three reviewer mirror sites.
- Design-it-twice did not fire: this modifies an existing command's flow (no new module/interface
  boundary), so no `## Locked Design` section.

## Scope Boundaries

- **No changes to `commands/ba/execute.md` or `commands/ba/review.md`.** The execute/verify model
  and its locked AC exclusion are correct and stay untouched.
- **No Linear/tracker API ingestion path** — source-agnostic capture only.
- **No new persisted `## Requirement Ledger` plan section** — transient; reuses `## What We're NOT
  Doing`.
- **`/ba:review-plan` is not given the origin** and gets no requirement backstop here — that is
  issue #6 (review-completeness), a separate effort.
- **The locked AC / `Verify:` / `Test scenarios:` schema is not reopened.**
- **No auto-generation of ACs from requirements** — the assistant still authors ACs; the ledger only
  checks coverage and surfaces reductions.
- **No CE-style mandatory behavior-pinning-test rule** — the deepest real backstop observed (a test
  that fails if the requirement is violated) is noted as future work, not built here.

## Acceptance Criteria

- AC1: `/ba:plan` enumerates the origin's explicit requirements (source-agnostic) and reconciles
  each to either an `AC<n>` or an explicit exclusion; no explicit requirement is silently absent
  from the reconciliation.
- AC2: The full reconciliation ledger (every requirement → AC or exclusion) is shown to the user
  before the plan is written to disk.
- AC3: The command STOPS and asks the user (AskUserQuestion) before the disk-write when a requirement
  is dispositioned as an exclusion, OR when a dispatched sub-agent returned a finding flagged as
  needing an explicit decision.
- AC4: A plan whose requirements all map cleanly to ACs, with no exclusions and no flagged decisions,
  is written without any added prompt (no gate fatigue on the common case).
- AC5: The change is confined to `commands/ba/plan.md`; `execute.md`, `review.md`, and the locked AC
  schema are unchanged, and no reviewer never-hide mirror site is modified.
- AC6 (grounding regression): Replaying the tiger!88267 scenario, "keep `notes` and `edit_reason`
  separate" is enumerated as a requirement and, being dispositioned as an exclusion, is surfaced to
  the user before write — it cannot be silently demoted to `## What We're NOT Doing`.
- AC7 (thin-origin): When the origin carries few/no explicit requirements, or the minted ACs are
  mostly assistant-inferred rather than origin-sourced, `/ba:plan` surfaces that (a count of
  inferred vs. sourced ACs) and stops for the user's sign-off before writing — rather than
  proceeding silently on a low-fidelity translation.

## Open Questions

None. (Resolved this session: ledger source → source-agnostic capture; gate strictness →
show-all/stop-on-reductions; persist vs. transient → transient; review-plan involvement → out of
scope; poor/lacking ticket → added the thin-origin / inferred-AC third stop condition.)

## Convention Compliance

Checked by `convention-checker` — **0 hard violations**. Three plan-time flags recorded (not
brainstorm defects):
- **Flag 1 (MEDIUM, incorporated):** do not reuse the "never-hide ledger" label (a proper-noun
  convention with exactly three mirror sites — `README.md`, `review.md` Step 2, `review-plan.md`
  Step 2). Named the mechanism "requirement reconciliation ledger" and stated it is not a mirror
  site; the three existing sites stay untouched.
- **Flag 2 (LOW–MEDIUM, for the plan):** a user-facing `/ba:plan` behavior change likely triggers
  the README-sync obligation — the plan should include a unit to touch the README `/ba:plan`
  description (and the CLAUDE.md convention bullet if the gate is elevated to a convention), or a
  justified skip.
- **Flag 3 (LOW, for the plan):** the shipping unit must bump `version` in
  `.claude-plugin/plugin.json` (currently `0.35.0`) — it is the auto-update cache key.

Aligned on all sharp landmines: planning-never-writes-code, the U-ID/stack-base citation grid
(untouched — `plan.md` stays grammar-only), the locked AC schema (mapping, not inheriting), and the
mandatory pre-write convention gate (strengthened, not weakened).

## Next Steps

→ `/ba:plan` to create the implementation plan (confined to `commands/ba/plan.md`; carry Flags 2–3
as plan-time obligations).
