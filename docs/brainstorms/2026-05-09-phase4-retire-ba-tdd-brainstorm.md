---
date: 2026-05-09
topic: phase4-retire-ba-tdd
status: approved
triage_level: full
tags: [phase-4, ba-tdd, ba-execute, behaviors-to-test, retirement, ousterhout-roadmap]
---

# Phase 4 — Retire `ba:tdd`, Keep "Behaviors to Test" as Standalone Artifact

> **Roadmap parent:** [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](2026-05-02-ousterhout-principles-roadmap-brainstorm.md)
>
> **Standing discipline rules:** This brainstorm is governed by the **Discipline Rules** section of the parent roadmap (lines 130–160). Red flags, stop points, and concrete rules apply to any iteration of this brainstorm or its downstream plan. The pivot in this brainstorm — from "per-slice routing" to "retirement" — is itself an instance of the rule "if user questions necessity twice, the feature is cut": Bruno questioned `ba:tdd`'s routing necessity, then questioned its very existence, and the empirical signal supports cutting.

## What We're Building

Retire `ba:tdd` as a first-class command in `dev-workflow`. Delete `commands/ba/tdd.md` and the supporting `agents/workflow/tdd-cycle-gate.md`. Keep "Behaviors to Test" as a Kent C. Dodds-style testing-checklist artifact in plan templates — authored once at the top of plans, valuable as scope, review aid, and test-coverage guarantee, regardless of execution process.

`ba:execute` is unchanged in this phase. No behavior-verification check is added now; whether and where verification logic eventually lives (most likely `ba:review`) is **explicitly TBD and out of scope**. `ba:slice` Step 5 is simplified to drop the two TDD execution-path options.

The original Phase 4 framing — per-slice routing or merge into `ba:execute` as a mode flag — is superseded by the retirement decision. The 4a/4b sub-phase split dissolves.

## Why This Approach

### Approaches Considered

1. **Retire `ba:tdd`; keep "Behaviors to Test" as standalone artifact (chosen).** No empirical evidence that red-green-refactor produced different code in Bruno's practice, even on the well-cast TDD case (Slice 4 of TATO-2349, which had destination code shown in detail in the plan). The 30–40% TDD overhead measured by the Slice 4 retro is unjustified ceremony. The Behaviors checklist stands on its own value.

2. **Per-slice routing inferred from `<!-- slice:N -->` markers in the Behaviors section** (the original Phase 4a direction during this brainstorm session). Rejected mid-dialogue: empirical inspection of recent plans showed all of Bruno's plans, including the well-cast TDD case, carry destination code in detail. Routing presumes both modes have validated value; the data shows only one mode (execute) does.

3. **Soft-deprecate `ba:tdd` as a hidden alias.** Rejected: code-surface debt for no migration benefit. Old plans' "Behaviors to test *(consumed by `/ba:tdd`)*" headings are plain markdown that doesn't break when the command goes away.

4. **Keep `ba:tdd`; add `--with-tests` flag to `ba:execute` as a middle ground.** Rejected: doesn't address the "ceremony for no design pressure" problem; just adds a third mode with no clear use case.

5. **Defer Phase 4 entirely.** Rejected: empirical signal from four lived retros plus direct inspection of recent plans is sufficient. Continuing to defer would itself be confidence-chasing.

### Why Retirement Wins

- **No validated process value.** Bruno could not recall whether red-green-refactor on the well-cast Slice 4 actually shaped the implementation, or just produced the same code more slowly. Without that claim, `ba:tdd` is paying overhead for unverified benefit.
- **The artifact survives independently.** "Behaviors to Test" as a Kent C. Dodds-style user-observable-behavior checklist is valuable as scope, review aid, and test-coverage guarantee — fully decoupled from any red-green process.
- **Plugin surface shrinks by one command.** Fewer commands to maintain, fewer routing decisions for the user, no per-slice mode metadata, no slice-mode gate agent.
- **TDD is a known dev workflow.** Anyone who hits a genuinely greenfield slice (no plan code, real design pressure) can run red-green-refactor manually; it doesn't need plugin support for the rare case.
- **Aligns with the discipline rules.** This phase *removes* machinery rather than adding it — directly opposite of the verifier-finding-triggers-machinery anti-pattern. Empirical evidence that TDD's red-pressure on a code-shown plan can amplify YAGNI (yagni-violations retro 2026-04-27, fabricated fixtures) reinforces the call.

## Key Decisions

- **Delete `commands/ba/tdd.md` and `agents/workflow/tdd-cycle-gate.md`.** Both files removed from the repo.
- **Behaviors-to-test stays.** Plan template (`commands/ba/plan.md`) retains the section but reframes the heading to drop the "(consumed by `/ba:tdd`)" annotation; rewrite the section's purpose statement as a Kent C. Dodds-style testing checklist of user-observable behaviors.
- **`ba:execute` is unchanged in this phase.** No behavior-verification check is added. Whether and where verification logic eventually lives (most likely `ba:review`) is TBD and out of scope.
- **`ba:slice` Step 5 simplified.** Drop the two TDD execution-path options (Start TDD / Fresh-context TDD); only Execute and Fresh-context Execute remain.
- **Phase 4a/4b split dissolves.** No second mode to merge — retirement accomplishes the merge.
- **Parent roadmap Phase 4 brief gets updated** as an in-scope deliverable of this brainstorm's downstream plan (alongside README/CLAUDE.md/plugin.json updates), so future per-phase brainstorms reference an accurate roadmap.

## Scope Boundaries

### In Scope

- Delete `commands/ba/tdd.md`.
- Delete `agents/workflow/tdd-cycle-gate.md`.
- Update `commands/ba/plan.md`: drop the "consumed by `/ba:tdd`" annotation on the Behaviors-to-test section; reframe the section's purpose statement as a Kent C. Dodds-style testing-behavior checklist.
- Update `commands/ba/slice.md`: drop the TDD execution-path options from Step 5. Whether `ba:slice` should still insert per-slice markers into the Behaviors section (`slice.md:154–176`) is a vestigial-after-retirement question — decision deferred to plan time.
- Update `README.md`: remove `/ba:tdd` from Execution Commands; remove the line 235 "Merge `/ba:tdd` into `/ba:execute`" roadmap item (resolved by retirement).
- Update `CLAUDE.md` (root): remove `/ba:tdd` references throughout.
- Bump `.claude-plugin/plugin.json` version per CLAUDE.md:66.
- Update parent roadmap Phase 4 brief (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` lines 89–107) to reflect retirement as the chosen outcome and supersede the original a/b/c/d option framing.

### Out of Scope

- Behavior-verification logic in `ba:execute` (no check added; TBD via `ba:review` or other downstream phase).
- Per-slice routing or mode tagging (rendered moot by retirement).
- Migration tooling for old plans (Behaviors heading still works as plain markdown — no programmatic dependence).
- Retroactive edits to prior brainstorms / plans / retros that mention `/ba:tdd` (frozen historical record).
- Changes to `agents/review/deep-module-reviewer.md` (already decoupled into a peer reviewer in Phase 1; orthogonal to this phase).

## Acceptance Criteria

- `commands/ba/tdd.md` is deleted (no longer in repo).
- `agents/workflow/tdd-cycle-gate.md` is deleted.
- `commands/ba/plan.md`'s "Behaviors to Test" section retains the heading but no longer carries the "(consumed by `/ba:tdd`)" annotation; section opening prose reframes purpose as a testing checklist of user-observable behaviors.
- `commands/ba/slice.md` Step 5 menu offers only Execute and Fresh-context Execute options.
- `README.md` "Execution Commands" section no longer lists `/ba:tdd`. README's roadmap section drops the merge line.
- `CLAUDE.md` (root) no longer references `/ba:tdd`.
- `.claude-plugin/plugin.json` version bumped.
- Parent roadmap (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`) Phase 4 section updated to reflect retirement as the chosen outcome.
- After this MR, `grep -r 'ba:tdd\|tdd-cycle-gate' commands/ agents/ CLAUDE.md README.md .claude-plugin/` returns no matches (excluding the historical brainstorm/plan files in `docs/brainstorms/` and `docs/plans/`).

## Open Questions

None. Two scope-level decisions are deferred to plan time and documented inline in scope hooks (whether `ba:slice` should still insert per-slice markers into the Behaviors section; ultimate home of behavior-verification logic) — not parked as blocking questions for this brainstorm.

## Convention Compliance

**Checked against `CLAUDE.md`, the brainstorm template (`commands/ba/brainstorm.md`), and the parent roadmap's Discipline section on 2026-05-09 by `convention-checker`.**

- **Filename and frontmatter** (CLAUDE.md:56, template): ALIGNED — `2026-05-09-phase4-retire-ba-tdd-brainstorm.md` matches `YYYY-MM-DD-<topic>-brainstorm.md`; all five required frontmatter fields present and correctly typed; matches sibling phase brainstorm precedent (`phase1-...`, `phase2-...`).
- **No code in brainstorm** (CLAUDE.md:67): ALIGNED — file references and conceptual hooks only.
- **Per-phase Discipline-section reference** (parent roadmap line 132): ALIGNED — top-of-doc callout names the section and the line range (130–160).
- **Per-phase deliverables (README, CLAUDE.md, plugin.json)** (parent roadmap line 169, CLAUDE.md:66): ALIGNED — listed in In Scope and Acceptance Criteria.
- **Section presence vs FULL template**: ALIGNED — every required heading present (`What We're Building`, `Why This Approach`, `Key Decisions`, `Scope Boundaries`, `Acceptance Criteria`, `Open Questions`, `Convention Compliance`, `Next Steps`).
- **Open Questions empty before handoff** (template HARD GATE): ALIGNED — `None.` plus deferred-but-named decisions explicitly marked as not-blocking.
- **Discipline red-flag compliance**: ALIGNED — this phase *removes* machinery (`ba:tdd`, `tdd-cycle-gate`) rather than adding any. Scope shrinks across the dialogue (per-slice routing → retirement); no monotonic LoC growth, no abstract vocabulary creep. Empirical-signal-driven decision (plan inspection of TATO-2349) directly satisfies the "verifier finding answered with >20 lines of new plan → wrong direction" rule by going the *other* way: verifier finding answered with one fewer command.
- **Roadmap Phase 4 brief divergence — DOCUMENTED OVERRIDE**: The parent roadmap (lines 89–107) framed Phase 4 as "TDD-vs-execute routing (and possible merge)" and enumerated four decision options (a/b/c/d) — all of which assumed `ba:tdd` continues to exist in some form. This brainstorm chooses **option (e): retire `ba:tdd` entirely**, outside the roadmap's stated menu. **Rationale for the override**: empirical inspection of recent plans (notably the TATO-2349 default-leave-types plan Slice 4 — the well-cast TDD case) showed all of Bruno's plans carry destination code in detail, undermining the routing premise that both modes have validated value. The parent roadmap's Phase 4 open question — *"Does the data justify the V2 merge now?"* — is answered with *"merge isn't the right framing; deletion is."* **Resolution**: parent roadmap Phase 4 brief is updated as an in-scope deliverable of this brainstorm's downstream plan, restoring source-of-truth alignment for future per-phase brainstorms.

## Next Steps

→ `/ba:plan` to create the implementation plan for Phase 4. The plan will cover the file deletions, template updates, README/CLAUDE.md/plugin.json updates, parent roadmap Phase 4 update, and the deferred plan-time decision on whether `ba:slice` should still insert per-slice Behaviors-section markers.
