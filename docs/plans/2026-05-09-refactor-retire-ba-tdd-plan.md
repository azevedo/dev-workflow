---
title: Retire `/ba:tdd` and reframe Behaviors-to-Test as a standalone artifact
type: refactor
status: completed
date: 2026-05-09
origin: docs/brainstorms/2026-05-09-phase4-retire-ba-tdd-brainstorm.md
detail_level: standard
iteration_count: 0
tags: [phase-4, ba-tdd, ba-execute, behaviors-to-test, retirement, ousterhout-roadmap]
---

# Retire `/ba:tdd` and Reframe Behaviors-to-Test as a Standalone Artifact

> **Roadmap parent:** Phase 4 of [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](../brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md). The standing **Discipline Rules** (parent roadmap lines 130–160) govern this plan as well as its origin brainstorm.

## Overview

Delete `/ba:tdd` and the `tdd-cycle-gate` agent. Keep "Behaviors to Test" as a Kent C. Dodds-style testing-checklist artifact in plan templates — its value as scope, review aid, and test-coverage guarantee survives the retirement of red-green-refactor as a plugin command. `ba:execute` is unchanged in this phase; behavior-verification logic is deliberately not added (TBD via `ba:review` or other phase). The plugin surface shrinks by one command and one workflow agent.

## Current State

- `commands/ba/tdd.md` — 425+ line command implementing red-green-refactor with per-cycle gating.
- `agents/workflow/tdd-cycle-gate.md` — workflow agent dispatched by `ba:tdd` after each green phase to surface discipline violations.
- `commands/ba/plan.md:214,254,321` — three template snippets each titled `## Behaviors to Test *(optional — consumed by `/ba:tdd`)*`. The "consumed by `/ba:tdd`" annotation is the only programmatic-consumer claim; the section's standalone value is undocumented.
- `commands/ba/slice.md:79,223,225,232,234` — Step 5 menu offers Start TDD / Fresh-context TDD options; line 79 references `/ba:tdd` in the single-MR fast-path message. The Behaviors-section marker logic at `slice.md:154–176` and the cross-section symmetry validation at `slice.md:192` were originally added to feed `ba:tdd`'s per-slice behavior extraction.
- `commands/ba/execute.md:22` — note frames the slice flag-parsing pattern as "shared across execution commands (ba:execute, ba:tdd)".
- `commands/ba/review.md:232` — discovery-exclusion list cites "execution commands (`ba:execute`, `ba:tdd`)".
- `README.md:7,44,46,117,142–152,209,231,235,236` — multiple references: intro paragraph, routing diagram, slice-execution sentence, full `/ba:tdd` command section, agents table row for `tdd-cycle-gate`, roadmap entries.
- `CLAUDE.md:21,49` — command list and agent list entries for `/ba:tdd` and `tdd-cycle-gate`.
- `.claude-plugin/plugin.json` — version `0.11.0`, description string contains "TDD execute", `keywords` array contains `"tdd"`.
- `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md:89–107` — parent roadmap Phase 4 brief frames the phase as "TDD-vs-execute routing (and possible merge)" with options (a)–(d) all assuming `ba:tdd` continues to exist. The retirement decision is option (e) — outside the brief's stated menu.
- `commands/ba/plan.md:182–190` (origin: 2026-05-09 brainstorm `Convention Compliance` block) — the brainstorm passed all convention checks except a documented override on the parent roadmap's Phase 4 framing, which this plan resolves as an in-scope deliverable.

## What We're NOT Doing

- **No behavior-verification logic in `ba:execute`.** No check is added now. Whether and where verification logic eventually lives (most likely `ba:review`) is **explicitly TBD and out of scope** (see brainstorm: `docs/brainstorms/2026-05-09-phase4-retire-ba-tdd-brainstorm.md`).
- **No per-slice mode tagging.** The original Phase 4 framing of `tdd | execute | either` per-slice routing is moot under retirement.
- **No migration tooling for old plans.** The "Behaviors to Test *(consumed by `/ba:tdd`)*" heading in historical plans is plain markdown that doesn't break when the command goes away. No automated rewrite.
- **No retroactive edits to historical brainstorms, plans, or retros.** Files under `docs/brainstorms/`, `docs/plans/`, and `docs/research/` that mention `/ba:tdd` are frozen historical record. The single exception is the parent roadmap's Phase 4 brief, which is updated as an in-scope deliverable so future per-phase brainstorms reference an accurate roadmap.
- **No changes to `agents/review/deep-module-reviewer.md`.** Already decoupled in Phase 1 — orthogonal to this phase.
- **No changes to `agents/workflow/plan-iteration-gate.md` or `agents/workflow/spec-flow-analyzer.md` or `agents/workflow/convention-checker.md`.** Only `tdd-cycle-gate` is removed from `agents/workflow/`.
- **No drop of the per-slice Behaviors-section markers in `ba:slice`.** Decision resolved at plan time: keep them. They organize the Behaviors checklist by slice for human MR readers regardless of programmatic consumption. `slice.md:154–176` and `slice.md:192` stay intact.
- **No new "(replaces /ba:tdd)" deprecation comments** anywhere in code or docs. The brainstorm rejected soft-deprecation; clean removal is the chosen approach.

## Behaviors to Test *(optional)*

Verification states the repository should reach after this change lands. Run after edits and before commit:

- [x] `commands/ba/tdd.md` no longer exists in the repository.
- [x] `agents/workflow/tdd-cycle-gate.md` no longer exists in the repository.
- [x] `grep -r 'ba:tdd\|tdd-cycle-gate' commands/ agents/ CLAUDE.md README.md .claude-plugin/` returns no matches (excluding `docs/brainstorms/`, `docs/plans/`, `docs/research/`, `docs/solutions/`).
- [x] `commands/ba/plan.md` has zero occurrences of "consumed by `/ba:tdd`" and three "Behaviors to Test" headings whose opening prose reframes the section as a Kent C. Dodds-style user-observable-behavior checklist.
- [x] `commands/ba/slice.md` Step 5 menu lists exactly two execution-path options (Execute and Fresh-context Execute), no TDD entries.
- [x] `.claude-plugin/plugin.json` version is incremented from `0.11.0` and its `keywords` array no longer contains `"tdd"`; description string no longer mentions "TDD".
- [x] `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` Phase 4 section reflects retirement as the chosen outcome and supersedes the original a/b/c/d option framing.

## Proposed Solution

A single MR. Two file deletions and a coordinated sweep of `/ba:tdd` references across command files, agent docs, README, CLAUDE.md, plugin metadata, and the parent roadmap. The Behaviors-to-Test section in `commands/ba/plan.md` is reframed: heading drops the "consumed by" annotation; opening prose is rewritten as a Kent C. Dodds-style testing checklist of user-observable behaviors, valuable as scope and review aid.

`ba:execute` flow is preserved end-to-end. `ba:slice` Step 5 menu collapses from four execution options (Execute, TDD, Fresh-Execute, Fresh-TDD) to two (Execute, Fresh-Execute). The Behaviors-section per-slice markers `ba:slice` already inserts stay — they continue to organize the checklist by slice for MR review even without `ba:tdd` consuming them.

## Technical Considerations

- **No code dependencies on `ba:tdd`.** Verified by grep: nothing in `agents/workflow/`, `agents/review/`, `commands/ba/` (besides `tdd.md` itself, `slice.md` menu, and `execute.md`/`review.md` reference notes), or `.claude-plugin/` references the command at runtime. The `tdd-cycle-gate` agent has only one dispatcher (`tdd.md`), which is being deleted.
- **Heading-text references in historical plans.** Old plans contain `## Behaviors to Test *(optional — consumed by `/ba:tdd`)*` as plain text. They render fine without the command and require no migration.
- **Plugin version semantics.** Per CLAUDE.md:66, every release bumps `version` in `.claude-plugin/plugin.json`. A user-visible command removal is a minor-version bump under 1.0: `0.11.0 → 0.12.0`.
- **Discipline-rule alignment.** This phase *removes* machinery (`tdd.md`, `tdd-cycle-gate.md`, two slice-menu options) rather than adding any. It is the inverse of the verifier-finding-triggers-machinery anti-pattern from parent roadmap line 148.

## System-Wide Impact

- **Interaction graph**: `/ba:slice` Step 5 menu shrinks. `/ba:plan` Step 7 menu (line 485 `Slice plan`) is unchanged because it doesn't surface TDD options. Auto-detection logic in `ba:execute` is unchanged. No middleware/observers fire.
- **Error propagation**: A user typing `/ba:tdd` after this change gets Claude Code's standard "command not found" handling. Acceptable per brainstorm — explicitly rejected soft-deprecate alias as "code-surface debt for no migration benefit".
- **State lifecycle risks**: None. No plan-file mutations, no on-disk state owned by `ba:tdd` to migrate. Old plans with `<!-- slice:N -->` markers in their Behaviors section still work — `ba:slice` continues inserting them; nothing reads them programmatically anymore but they remain valid markdown comments.

## Implementation Approach

### Changes Required

The MR ships in one commit. File-by-file:

---

**File**: `commands/ba/tdd.md`

Delete the entire file. (Removed from filesystem.)

---

**File**: `agents/workflow/tdd-cycle-gate.md`

Delete the entire file. (Removed from filesystem.)

---

**File**: `commands/ba/plan.md`

Update all three "Behaviors to Test" template snippets. Each appears once per detail-level template (MINIMAL at line 214, STANDARD at line 254, COMPREHENSIVE at line 321).

Replace each occurrence of:

```markdown
## Behaviors to Test *(optional — consumed by `/ba:tdd`)*

- [ ] [Testable behavior derived from acceptance criteria]
- [ ] [Another testable behavior]
```

(MINIMAL form — STANDARD/COMPREHENSIVE have three checkbox examples and slightly different placeholder text — preserve their placeholders as-is)

with:

```markdown
## Behaviors to Test *(optional)*

A Kent C. Dodds-style checklist of user-observable behaviors this plan must satisfy. Authored once at planning time, this list serves three audiences: scope (what's in vs. out), review (does the implementation cover every claim), and test-coverage guarantee (each line is a candidate test case). Each item should be concrete enough to write a single test for — what the code does for the user, not how.

- [ ] [Testable behavior derived from acceptance criteria]
- [ ] [Another testable behavior]
```

For STANDARD and COMPREHENSIVE templates, preserve their three-example forms while adopting the same heading and opening prose. The opening-prose paragraph is identical across all three detail levels.

---

**File**: `commands/ba/slice.md`

Three changes:

1. **Line 79**: replace
   ```
   If total estimated LoC <= 150, announce: "This plan fits in a single MR (~[N] LoC). Slicing adds no value -- proceed directly with `/ba:execute` or `/ba:tdd`." and stop.
   ```
   with
   ```
   If total estimated LoC <= 150, announce: "This plan fits in a single MR (~[N] LoC). Slicing adds no value -- proceed directly with `/ba:execute`." and stop.
   ```

2. **Step 5 menu (lines 217–237)**: replace the seven-item options block

   ```markdown
   **Options:**
   1. **Start with Execute** -- Begin executing slice 1 with `ba:execute --slice 1` in this session
   2. **Start with TDD** -- Begin executing slice 1 with `ba:tdd --slice 1` in this session
   3. **Fresh-context Execute** -- Clear context and start slice 1 with `ba:execute --slice 1`
   4. **Fresh-context TDD** -- Clear context and start slice 1 with `ba:tdd --slice 1`
   5. **Review plan** -- Run `/ba:review-plan` to review the sliced plan
   6. **Adjust slices** -- Manually modify slice boundaries before executing
   7. **Done for now** -- Return later

   **Based on selection:**
   - **Start with Execute** -> Invoke `ba:execute --slice 1 docs/plans/[filename]` directly.
   - **Start with TDD** -> Invoke `ba:tdd --slice 1 docs/plans/[filename]` directly.
   - **Fresh-context Execute** -> Tell the user: "Run `/clear` then `/ba:execute --slice 1 docs/plans/[filename]`"
   - **Fresh-context TDD** -> Tell the user: "Run `/clear` then `/ba:tdd --slice 1 docs/plans/[filename]`"
   - **Review plan** -> Invoke `/ba:review-plan docs/plans/[filename]`
   - **Adjust slices** -> Ask which slice to adjust, modify markers and table, return to options.
   - **Done for now** -> Display summary and exit.
   ```

   with the five-item form

   ```markdown
   **Options:**
   1. **Start with Execute** -- Begin executing slice 1 with `ba:execute --slice 1` in this session
   2. **Fresh-context Execute** -- Clear context and start slice 1 with `ba:execute --slice 1`
   3. **Review plan** -- Run `/ba:review-plan` to review the sliced plan
   4. **Adjust slices** -- Manually modify slice boundaries before executing
   5. **Done for now** -- Return later

   **Based on selection:**
   - **Start with Execute** -> Invoke `ba:execute --slice 1 docs/plans/[filename]` directly.
   - **Fresh-context Execute** -> Tell the user: "Run `/clear` then `/ba:execute --slice 1 docs/plans/[filename]`"
   - **Review plan** -> Invoke `/ba:review-plan docs/plans/[filename]`
   - **Adjust slices** -> Ask which slice to adjust, modify markers and table, return to options.
   - **Done for now** -> Display summary and exit.
   ```

3. **Behaviors-section marker logic (lines 154–176, 192)**: leave unchanged. Per plan-time decision, per-slice markers still organize the Behaviors checklist for MR readers even though `ba:tdd` (their original programmatic consumer) is gone. The cross-section symmetry validation at `slice.md:192` stays intact.

---

**File**: `commands/ba/execute.md`

**Line 22**: replace
```
**Note:** This flag-parsing pattern is shared across execution commands (ba:execute, ba:tdd) for slice support. Other commands continue to treat `#$ARGUMENTS` as a plain path or description.
```
with
```
**Note:** Other commands continue to treat `#$ARGUMENTS` as a plain path or description; only `ba:execute` strips `--slice N` before path parsing.
```

(Drops the "shared across execution commands" framing — there is only one execution command after this MR.)

---

**File**: `commands/ba/review.md`

**Line 232**: replace
```
**If a file matches the keywords above, include it.** Only exclude if it is one of these specific categories: plan writers (`ba:plan`, `ba:brainstorm`), execution commands (`ba:execute`, `ba:tdd`), fixer skills that modify code rather than producing read-only findings (`simplify`), or the built-in agents already listed in 2a. When in doubt, include — let the user decide.
```
with
```
**If a file matches the keywords above, include it.** Only exclude if it is one of these specific categories: plan writers (`ba:plan`, `ba:brainstorm`), execution commands (`ba:execute`), fixer skills that modify code rather than producing read-only findings (`simplify`), or the built-in agents already listed in 2a. When in doubt, include — let the user decide.
```

---

**File**: `README.md`

Six edits:

1. **Line 7** (Why paragraph): replace
   ```
   ...then implement — either straight (`/ba:execute`) or with TDD discipline (`/ba:tdd`). Post-implementation review (`/ba:review`)...
   ```
   with
   ```
   ...then implement (`/ba:execute`). Post-implementation review (`/ba:review`)...
   ```

2. **Lines 42–47** (Starting-a-flow routing diagram): replace
   ```
   After planning, choose your execution mode:
       Plan is large (multiple MRs worth of work)?              → /ba:slice first
       Plan has testable behaviors / want test-first discipline? → /ba:tdd
       Straightforward implementation?                          → /ba:execute
       Plan is sliced?                                          → /ba:execute --slice N or /ba:tdd --slice N
   ```
   with
   ```
   After planning, choose your execution mode:
       Plan is large (multiple MRs worth of work)?              → /ba:slice first
       Otherwise?                                               → /ba:execute
       Plan is sliced?                                          → /ba:execute --slice N
   ```

3. **Line 117** (slice subsection trailing sentence): replace
   ```
   After slicing, execute one slice at a time with `/ba:execute --slice N` or `/ba:tdd --slice N`. Each slice gets its own branch and MR.
   ```
   with
   ```
   After slicing, execute one slice at a time with `/ba:execute --slice N`. Each slice gets its own branch and MR.
   ```

4. **Lines 142–152** (entire `### `/ba:tdd [plan]`` subsection): delete the section in full, including the heading and all bullets. Section ends immediately before `### `/ba:review [ref range]`` at line 154.

5. **Line 209** (agents table row): delete the row
   ```
   | `tdd-cycle-gate` | Validates each TDD red-to-green cycle for discipline compliance and LLM anti-patterns |
   ```

6. **Roadmap section (lines 231, 235, 236)**: delete line 231 (`/ba:tdd ✅`); delete line 235 (`Merge /ba:tdd into /ba:execute...`); rewrite line 236 to drop the `/ba:tdd` reference. Replace
   ```
   - `/ba:tdd` — TDD execution discipline with per-cycle validation and deep-module refactoring ✅
   - `/ba:slice` — plan decomposition into MR-sized slices for incremental delivery ✅
   - `/ba:handoff` — session continuity for multi-session work
   - `/ba:execute` V3 — batch mode and subagent-driven execution
   - Merge `/ba:tdd` into `/ba:execute` as an execution mode — after `/ba:tdd` is validated through real usage
   - Plan size vs human-review tax — investigate splitting `/ba:plan` output into a short decision doc (human-reviewed, ~200 lines: scope, architecture, risks, phases, slice table) + per-slice mechanical briefs (types, code stubs, test lists) generated fresh at `/ba:tdd` time. Motivation: plans routinely grow past human-reviewable size (1000+ LoC) because one artifact serves both human reviewers and implementation agents; fresh per-slice briefs also catch mechanical drift (stale imports, renamed types, hallucinated helpers) that a plan-time snapshot accumulates before execution. Open questions: does the decision doc stay coherent across slices if kept that thin; can brief generation stay deterministic enough that slice N doesn't contradict slice N-1.
   ```
   with
   ```
   - `/ba:slice` — plan decomposition into MR-sized slices for incremental delivery ✅
   - `/ba:handoff` — session continuity for multi-session work
   - `/ba:execute` V3 — batch mode and subagent-driven execution
   - Plan size vs human-review tax — investigate splitting `/ba:plan` output into a short decision doc (human-reviewed, ~200 lines: scope, architecture, risks, phases, slice table) + per-slice mechanical briefs (types, code stubs, test lists) generated fresh at `/ba:execute` time. Motivation: plans routinely grow past human-reviewable size (1000+ LoC) because one artifact serves both human reviewers and implementation agents; fresh per-slice briefs also catch mechanical drift (stale imports, renamed types, hallucinated helpers) that a plan-time snapshot accumulates before execution. Open questions: does the decision doc stay coherent across slices if kept that thin; can brief generation stay deterministic enough that slice N doesn't contradict slice N-1.
   ```

---

**File**: `CLAUDE.md`

Two line deletions:

1. **Line 21**: delete the row
   ```
   - `/ba:tdd [plan]` — Execute a plan using test-driven development — red-green-refactor with per-cycle validation
   ```

2. **Line 49**: delete the row
   ```
   - `tdd-cycle-gate` — Per-cycle TDD discipline validation (Read, Grep, Glob, LS)
   ```

After deletion, also revise the inline phrasing in the same file:

3. **Line 68** (Conventions block): replace
   ```
   - Execution commands (execute, tdd) implement approved plans — the plan is the authority on what to build
   ```
   with
   ```
   - Execution commands (execute) implement approved plans — the plan is the authority on what to build
   ```

---

**File**: `.claude-plugin/plugin.json`

Three edits:

1. Bump `version` from `"0.11.0"` to `"0.12.0"`.
2. Update `description` from
   ```
   "Research, brainstorm, plan, slice, execute, TDD execute, review, and compound commands with triage, convention compliance, and knowledge compounding"
   ```
   to
   ```
   "Research, brainstorm, plan, slice, execute, review, and compound commands with triage, convention compliance, and knowledge compounding"
   ```
3. Remove `"tdd"` from the `keywords` array.

Resulting file:

```json
{
  "name": "dev-workflow",
  "version": "0.12.0",
  "description": "Research, brainstorm, plan, slice, execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
  "author": {
    "name": "Bruno Azevedo"
  },
  "license": "MIT",
  "keywords": [
    "research",
    "brainstorm",
    "planning",
    "slice",
    "execute",
    "workflow",
    "conventions",
    "review",
    "compound",
    "knowledge"
  ]
}
```

---

**File**: `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`

Update the Phase 4 section (lines 89–107) to reflect retirement as the chosen outcome. Replace the entire current block

```markdown
### Phase 4 — TDD-vs-execute routing (and possible merge into single `ba:execute`)

**Goal:** Address the "ba:tdd is miscast for many slices" pain by either routing per-slice or merging tdd into execute as a mode.

**Scope hooks (all open, to be settled in the Phase 4 brainstorm):**
- Slicing is owned by `ba:slice`, not `ba:plan` (per the 2026-04-13 ba-slice brainstorm's resolved questions). Routing logic lands in `ba:slice` or in the merged `ba:execute`, **never in `ba:plan`**.
- Per-slice tagging (`tdd | execute | either`) using the heuristics from the decision-framework retro: counterfactual test, two-engineer test, plan-shape test, slice-content router.
- Roadmap line 233 (`README.md`) anticipates merging `ba:tdd` into `ba:execute` as a mode, deferred until validation. The four retros are that validation.
- The Phase 4 brainstorm decides: (a) per-slice tagging only, (b) merge into `ba:execute` with mode flag, (c) both, (d) neither.
- The Phase 4 brainstorm may also split this into two sub-phases (4a per-slice tagging, 4b merge) if the data supports per-slice tagging clearly but leaves the merge open.

**Open questions for Phase 4 brainstorm:**
- Does the data justify the V2 merge now?
- Where does routing live — slice metadata, execute mode flag, or both?
- Should plan-size split (roadmap line 234) be absorbed into Phase 4 or its own phase? (Per-slice mode tagging does **not** shrink plans — that's a distinct architectural change.)

**Why fourth:** depends on Phase 3's discipline gate to avoid its own brainstorm ratcheting. Heuristics may evolve with more retro data.

**Risk:** medium. The most open questions of any phase.
```

with the post-brainstorm version

```markdown
### Phase 4 — Retire `ba:tdd`; keep "Behaviors to Test" as a standalone artifact

**Goal:** Remove `ba:tdd` and `tdd-cycle-gate` from the plugin surface. Retain "Behaviors to Test" as a Kent C. Dodds-style testing-checklist artifact in plan templates.

**Outcome (settled by the Phase 4 brainstorm 2026-05-09):** The original (a)–(d) routing/merge menu is superseded by **option (e): retire `ba:tdd` entirely**. Empirical inspection of recent plans (notably `~/Programming/dragon/docs/plans/2026-04-20-feat-tato-2349-default-leave-types-edit-drawer-plan.md` Slice 4 — the well-cast TDD case) showed all of Bruno's plans carry destination code in detail. Routing presumes both modes have validated value; the data shows only one mode (execute) does. The roadmap's open question — *"Does the data justify the V2 merge now?"* — is answered with *"merge isn't the right framing; deletion is."*

**Brainstorm:** [`docs/brainstorms/2026-05-09-phase4-retire-ba-tdd-brainstorm.md`](2026-05-09-phase4-retire-ba-tdd-brainstorm.md).
**Plan:** [`docs/plans/2026-05-09-refactor-retire-ba-tdd-plan.md`](../plans/2026-05-09-refactor-retire-ba-tdd-plan.md).

**4a/4b sub-phase split dissolves.** No second mode to merge — retirement accomplishes the merge.

**`ba:execute` is unchanged in this phase.** No behavior-verification check is added now; whether and where verification logic eventually lives (most likely `ba:review`) is **TBD and out of scope** for Phase 4.

**Why fourth:** depends on Phase 3's discipline gate to avoid its own brainstorm ratcheting. Phase 3's gate caught the "verifier finding answered with >20 lines of new plan" pattern in real time during the brainstorm dialogue, supporting the retirement decision.

**Risk:** very low. This phase *removes* machinery rather than adding it — directly opposite of the verifier-finding-triggers-machinery anti-pattern.
```

(Also: when this plan is executed, also fix the parent roadmap's reference at line 96 — `Roadmap line 233 (README.md) anticipates merging /ba:tdd into /ba:execute` — implicitly resolved by removal of that README line. The Phase 4 outcome paragraph above already supersedes the open question; no additional cross-reference edit needed.)

---

### Success Criteria

#### Automated:

- [ ] `git ls-files commands/ba/tdd.md agents/workflow/tdd-cycle-gate.md` returns no rows (both files removed from index).
- [ ] `grep -rn 'ba:tdd\|tdd-cycle-gate' commands/ agents/ CLAUDE.md README.md .claude-plugin/` produces zero output.
- [ ] `grep -c 'consumed by .ba:tdd.' commands/ba/plan.md` returns `0`.
- [ ] `grep -c 'Behaviors to Test \*(optional)\*' commands/ba/plan.md` returns `3` (one per detail-level template).
- [ ] `grep -c '"version": "0.12.0"' .claude-plugin/plugin.json` returns `1`.
- [ ] `python -c 'import json; data=json.load(open(".claude-plugin/plugin.json")); assert "tdd" not in data["keywords"]'` exits 0.
- [ ] `grep -c '/ba:tdd' README.md CLAUDE.md` returns `0`.
- [ ] `grep -n '### `/ba:tdd' README.md` returns no match (heading deleted).
- [ ] `git diff --stat HEAD~1 docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` shows non-empty diff (Phase 4 brief updated).

#### Manual:

- [ ] Skim `commands/ba/plan.md` and confirm all three Behaviors-to-Test snippets share the same opening prose (Kent C. Dodds-style testing-checklist framing) and identical heading text.
- [ ] Skim the post-edit `commands/ba/slice.md` Step 5 menu and confirm five options total, no TDD references.
- [ ] Open `README.md`, confirm the routing diagram, intro paragraph, agents table, and roadmap section read coherently after deletions.
- [ ] Run `/ba:slice` (mentally or on a recent plan) and confirm the Step 5 menu displays cleanly with the new five options.
- [ ] Open the parent roadmap and confirm the new Phase 4 paragraph reads as a coherent post-brainstorm outcome, not an open question.

## Dependencies & Risks

- **No runtime dependencies.** No external systems or downstream consumers.
- **Risk: stale plan files in user directories.** Old plan files outside this repo may reference `/ba:tdd`. Acceptable per scope ("no migration tooling for old plans" — historical record).
- **Risk: muscle-memory.** Bruno may type `/ba:tdd` and get a not-found error. Acceptable per brainstorm — soft-deprecate alias was rejected as code-surface debt.
- **Risk: Phase 4 brainstorm and plan deviate from parent roadmap if not carefully synced.** Mitigated by the in-scope parent-roadmap edit; the override is documented in the brainstorm's Convention Compliance section.

## Sources & References

- **Origin brainstorm:** [`docs/brainstorms/2026-05-09-phase4-retire-ba-tdd-brainstorm.md`](../brainstorms/2026-05-09-phase4-retire-ba-tdd-brainstorm.md). Key decisions carried forward: (1) retire `ba:tdd` entirely rather than route or merge; (2) keep Behaviors-to-Test as a standalone artifact, reframed as Kent C. Dodds-style testing checklist; (3) `ba:execute` unchanged in this phase — no behavior-verification logic added now.
- **Parent roadmap:** [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](../brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md), Phase 4 brief at lines 89–107 (to be updated by this plan); Discipline Rules at lines 130–160 (governing).
- **Empirical evidence cited in the brainstorm:**
  - `~/Programming/dragon/docs/plans/2026-04-20-feat-tato-2349-default-leave-types-edit-drawer-plan.md` — well-cast TDD case (Slice 4) carrying destination code in plan, undermining the routing premise.
  - `~/Programming/dragon/docs/learnings/2026-04-23-planning-phase-yagni-and-confidence-chasing.md` — discipline rules' source.
  - `~/Programming/dragon/docs/solutions/dev-workflow/2026-04-24-ba-tdd-vs-ba-execute-decision-framework.md`, `learnings/2026-04-24-ba-tdd-retro-slice-4-displaynameseditor.md`, `solutions/tdd-workflow/2026-04-27-react-tdd-form-mutation-pitfalls.md`, `solutions/tdd-workflow/2026-04-27-yagni-violations-form-tdd.md` — four lived TDD retros.
- **Internal references:**
  - `commands/ba/tdd.md` (deletion target).
  - `agents/workflow/tdd-cycle-gate.md` (deletion target).
  - `commands/ba/plan.md:214,254,321` (Behaviors-to-Test heading update).
  - `commands/ba/slice.md:79,154–176,192,217–237` (single-MR message + Step 5 menu; behavior-marker logic intentionally preserved).
  - `commands/ba/execute.md:22` (flag-parsing note).
  - `commands/ba/review.md:232` (discovery-exclusion list).
  - `README.md:7,42–47,117,142–152,209,231,235,236` (multi-section sweep).
  - `CLAUDE.md:21,49,68` (command list, agent list, conventions block).
  - `.claude-plugin/plugin.json` (version, description, keywords).

## Convention Compliance

To be filled in by the convention-checker dispatch in Step 5 below. Pre-checked manually against `CLAUDE.md`:

- [x] **Plan filename and frontmatter** (CLAUDE.md artifact-paths block, plan.md template): ALIGNED — `2026-05-09-refactor-retire-ba-tdd-plan.md` matches `YYYY-MM-DD-<type>-<descriptive-name>-plan.md`; required frontmatter fields (title, type, status, date, origin, detail_level, iteration_count, tags) all present.
- [x] **`origin:` frontmatter field present** (plan.md Step 6): ALIGNED — points to brainstorm.
- [x] **"What We're NOT Doing" section** (plan.md key rules): ALIGNED — explicit scope boundaries listed.
- [x] **Plan never writes code; describes changes** (CLAUDE.md:67): ALIGNED — implementation contains exact replacement diffs as documentation, not executable artifacts.
- [x] **Version bump in `.claude-plugin/plugin.json`** (CLAUDE.md:66): ALIGNED — included in the plugin.json edit.
- [x] **README updated whenever commands/agents/artifact paths change** (CLAUDE.md:73): ALIGNED — README has six explicit edits.
- [x] **Naming conventions** (CLAUDE.md:64 — agent names lowercase-with-hyphens, command prefix `ba:`): ALIGNED — no new agents or commands; only deletions and reference edits.
- [x] **Brainstorm decisions carried forward** (plan.md Step 6): ALIGNED — every Acceptance Criterion line from the brainstorm has a corresponding Implementation Approach entry; both deferred decisions resolved (per-slice markers KEEP; behavior-verification placement REMAINS TBD/OOS as the brainstorm specified).
- [x] **Discipline-rules compliance** (parent roadmap lines 130–160): ALIGNED — this plan removes machinery, no LoC ratcheting, no abstract-vocabulary creep, single-MR delivery rather than multi-phase, no over-cautious confidence-chasing iteration.

(Overrides documented in the brainstorm's Convention Compliance block — most notably the Phase 4 brief override — are resolved by this plan as in-scope deliverables, not carried forward as overrides on the plan itself.)
