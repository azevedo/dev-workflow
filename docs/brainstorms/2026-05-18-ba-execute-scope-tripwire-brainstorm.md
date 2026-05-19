---
date: 2026-05-18
topic: ba-execute-scope-tripwire
status: approved
triage_level: full
tags: [ba-execute, scope-creep, discipline, slice]
---

# `/ba:execute` Pre-Slice Scope Tripwire

## What We're Building

A pre-coding discipline check in `/ba:execute` that catches scope creep before the agent writes any code in a slice. When the agent picks up a slice, it first projects LoC by listing the files it would create or modify and estimating per-file changes. If the projection is ≥ 2× the slice's `Est. LoC`, the agent pauses and surfaces the divergence to the user via the existing Step 4 Deviation Handling flow.

Single check, single moment, reuses existing infrastructure. No new agent, no schema changes to plans or slices, no mid-stream polling.

## Why This Approach

The repo already has three layers of scope discipline — but all of them act on the *plan*, not on execution:

- `## What We're NOT Doing` in plans (feature-wide, written at plan-time, not consumed by `/ba:execute`)
- `plan-iteration-gate` (monotonic-ratchet detector during plan review)
- `convention-checker` (planning hygiene)

Execution itself has only a *reactive* post-slice 200-LoC warning (after the damage is done) and a per-task Deviation Handling flow that catches plan/reality mismatches the *other* direction (file doesn't exist, API differs) — never cumulative overreach.

The bug in slice 8 of the balance-cards plan was: AC said *"Applied to drawer, overview section, and widget"* while `Est. LoC = 80` implied drawer-only-this-MR. The agent read AC as binding and the LoC as soft, when the LoC was actually the binding scope signal. A pre-coding LoC projection forces this contradiction into the open *before* the agent commits to a wider implementation.

**Approaches considered:**

1. **Planning-time disambiguation** (per-slice AC, per-slice out-of-scope, files-touched column) — rejected. Requires schema changes across `/ba:slice`, `/ba:plan`, the `convention-checker`, and every existing plan template. High surface-area cost relative to a single execution-side comprehension fix.
2. **Defense in depth** (planning-time + execution-time) — rejected for the same reason: the marginal coverage gain over an execution-only fix doesn't justify the maintenance cost across multiple commands.
3. **Static cue** (read AC, count surfaces named, compare to slice header) — rejected. Surface-counting is brittle (AC vocabulary varies widely) and doesn't speak the language of the slice header (LoC).
4. **Mid-stream polling** (per-task running diff vs threshold) — rejected. The single pre-slice check is simpler, and the existing post-slice 200-LoC warning already provides a safety net for gold-plating that slipped through.

**Chosen: pre-coding dynamic projection.** The agent does what it would already do (figure out which files to touch) — then makes the size of that exploration visible to itself and reconciles it against the slice header before committing to code.

## Key Decisions

- **Trigger location**: `/ba:execute`, before any code is written in a slice. Sits between slice announce and Step 4 Deviation Handling.
- **Trigger condition**: projected LoC ≥ **2× slice `Est. LoC`**. Moderate sensitivity — catches the 4× case from slice 8 and 2–3× drift; tolerates noise from seam reshuffles.
- **Gate behavior**: **pause-and-confirm** via the existing Deviation Handling protocol (Expected / Found / Why + Accept / Update plan / Pause), logged to `## Deviations`.
- **No new agent.** Lives as a discipline rule in `/ba:execute` text, sibling to Step 4.
- **No schema changes.** Slice headers, plan templates, slice tables stay as-is.
- **Pre-slice only.** No mid-stream polling. The existing post-slice 200-LoC warning is the safety net for gold-plating that slipped past the pre-slice check.
- **Binding-scope rule**: when AC and LoC estimate disagree, the discipline rule treats **LoC as the binding scope signal** — the agent surfaces the contradiction; it does not silently implement both.

## Scope Boundaries

**Not doing:**
- Per-slice acceptance criteria (criteria stay feature-wide, slice-inherited)
- Per-slice `## Out of Scope` lists
- `files-touched` columns in slice tables
- Mid-slice running-diff polling
- Strengthening the existing post-slice 200-LoC warning (separate concern; can be considered later)
- Changes to `/ba:slice` or `/ba:plan` schema or templates
- A new scope-gate agent parallel to `plan-iteration-gate`
- Catching *adjacent-edit* drift (renames, unrequested defaults, "improving" nearby code) — that's a different failure mode, already covered by user-level Surgical-Changes discipline

**Open for plan-time decisions** (not blocking this brainstorm):
- Exact placement of the tripwire in `/ba:execute`'s step ordering
- How the tripwire behaves for non-sliced plans (no per-slice LoC estimate exists)
- Whether the agent re-projects after the user picks "Update plan"
- Exact prompt wording for the projection step

## Acceptance Criteria

- `/ba:execute` text describes the pre-slice scope tripwire: before coding, agent lists files-to-touch, projects LoC, compares to slice `Est. LoC`.
- Threshold is explicit and binary: projection ≥ 2× slice estimate → pause.
- Pause uses the existing Deviation Handling flow (Expected / Found / Why + Accept / Update plan / Pause).
- Triggered events are logged to `## Deviations` under a recognizable label (e.g., *"Scope: projected M ≥ 2× estimate"*).
- The rule states explicitly: when AC and LoC estimate disagree, LoC is the binding scope signal — surface the contradiction, don't implement both.
- No new files in `agents/`. No changes to `commands/ba/slice.md`, `commands/ba/plan.md`, or plan templates.
- Replay test: slice 8 (80 LoC estimate, AC names three surfaces, ~310 LoC actual) would trigger the pause if the rule had been in place.

## Open Questions

None blocking.

## Convention Compliance

Convention-checker run 2026-05-18: **0 violations, 1 non-blocking warning, 10 aligned.**

- Aligned: filename pattern, kebab-case topic slug, YAML frontmatter (date / topic / status / triage_level / tags), required sections in correct order, FULL-triage depth, empty Open Questions before plan handoff, Next Steps → `/ba:plan`, planning-command-writes-no-code rule.
- Warning (resolved): convention-checker flagged ambiguity about whether design-it-twice mode fired in Phase 2. **It did not.** The proposed change is text-only to `/ba:execute` — no new module, file, agent, or public interface — so the design-it-twice trigger does not apply. The four-approach enumeration in `## Why This Approach` is the default-mode pattern, not design-it-twice output. Per template guidance, no `## Locked Design` / `## Rejected Designs` sections are required.

## Next Steps

→ `/ba:plan` to create implementation plan.
