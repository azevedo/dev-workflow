---
title: "feat: Add ba:slice command for MR-sized plan decomposition"
type: feat
status: completed
date: 2026-04-14
origin: docs/brainstorms/2026-04-13-ba-slice-command-brainstorm.md
detail_level: standard
tags: [ba-slice, execution, mr-splitting, delivery, pipeline]
---

# ba:slice Command Implementation Plan

## Overview

Add a new `ba:slice` Planning Command that decomposes approved plans into MR-sized slices (<=150 LoC excluding tests), plus enhance `ba:execute` to support per-slice execution via `--slice N`. This sits between `ba:plan` and `ba:execute` in the pipeline, making the full flow: **brainstorm -> plan -> slice -> execute (per slice) -> review (per slice)**. Slicing is optional -- small features that fit in a single MR skip it entirely (see brainstorm: `docs/brainstorms/2026-04-13-ba-slice-command-brainstorm.md`).

## Current State

- 8 commands in `commands/ba/`: brainstorm, plan, review-plan, execute, tdd, review, compound, research
- `ba:execute` (`commands/ba/execute.md`) processes entire plans in one session with no delivery-size awareness
- Arguments captured via `#$ARGUMENTS` in semantic XML tags -- no flag parsing precedent exists
- Plan frontmatter schema: `title`, `type`, `status`, `date`, `origin`, `detail_level`, `tags` (`commands/ba/plan.md:186-195`)
- Task extraction varies by detail level (`commands/ba/execute.md:40-44`): MINIMAL (acceptance criteria), STANDARD (file blocks), COMPREHENSIVE (file blocks within phases)
- Checkpoint tracking via `[ ]` -> `[x]` (`commands/ba/execute.md:143`)
- Pipeline chaining through AskUserQuestion completion menus (`commands/ba/plan.md:480-501`, `commands/ba/execute.md:276-292`)
- Plugin version: `0.6.0` (`.claude-plugin/plugin.json:3`)

## What We're NOT Doing

Explicit scope boundaries from the brainstorm (see brainstorm: Scope Boundaries > Out of Scope):

- **Stacked MR management** -- V1 creates sequential branches but does not manage rebases or stacked-branch detection. User manually rebases when a parent slice branch is updated. Stacked-branch suggestion (branching from prior slice's branch) deferred to V2 alongside rebase management.
- **ba:tdd integration** -- V1 slicing only works with ba:execute. ba:tdd gains no slice awareness and no modifications.
- **Auto-MR creation** -- V1 relies on existing ba:execute completion menu for MR creation.
- **Real-time LoC counting during execution** -- V1 trusts slice boundaries from ba:slice. Post-completion LoC check only.
- **Parallel slice execution** -- V1 executes slices sequentially.
- **Slice-aware ba:review** -- V1 uses ba:review as-is on per-slice diffs.
- **Partial re-slicing (--reslice)** -- V1 supports "re-slice from scratch" only. Partial re-slicing that preserves completed slice numbering deferred to V2 after real usage data shows whether it's needed.

## Proposed Solution

Create `commands/ba/slice.md` following existing command patterns (frontmatter, `#$ARGUMENTS` capture, numbered steps, AskUserQuestion menus). Enhance `commands/ba/execute.md` with flag parsing for `--slice N` and slice-scoped task extraction. Update `commands/ba/plan.md` completion menu to offer slicing (see brainstorm: Key Decisions).

Key design decisions carried forward from brainstorm:

| Decision | Choice | Rationale |
|---|---|---|
| Command category | Planning Command | ba:slice documents delivery structure; never writes code |
| Artifact location | Inline in plan file | One file, one source of truth. No separate manifest |
| LoC targets | 150 target, 200 warning | Research shows review effectiveness drops above 200 LoC |
| Dependency model | Sequential by default | Independent when the feature naturally decomposes |
| Plan authority | Preserved | `--slice N` is a subset view, not a new authority |
| LoC overflow | Warn and continue | Logical seams > exact counts |

## Technical Considerations

- **Flag parsing is a new pattern.** No existing command parses flags from `#$ARGUMENTS`. The approach: scan the argument string for `--slice N`, strip it, use the remainder as the plan path. `--slice` consumes exactly the next whitespace-delimited token and validates it as a positive integer. Documented within execute.md's argument section as a localized pattern -- not elevated to a global convention until more commands adopt it.
- **Slice boundary placement.** HTML comment markers go between task elements. For STANDARD: between `**File**:` blocks. For COMPREHENSIVE: between file blocks, never spanning phase boundaries. For MINIMAL: between groups of related acceptance criteria (grouped by functional area).
- **Already-sliced plans.** `ba:slice` on an already-sliced plan asks the user: re-slice from scratch (remove all markers and re-decompose) or abort.
- **Sliced plan without --slice.** `ba:execute` on a sliced plan without `--slice N` auto-detects the first incomplete slice and asks the user to confirm or pick a different slice.
- **LoC estimation.** Count lines in code fences (excluding test files). For plans with descriptions instead of code, estimate conservatively (~30-50 LoC per described file change) and flag estimates as approximate.
- **Convention-compliance for ba:slice.** Justified override: ba:slice modifies an existing plan file, not creating a new artifact. Includes a lightweight structural validation step consistent with the convention's spirit.
- **Marker format.** Simplified to `<!-- slice:N "name" -->`. The summary table is the canonical source for dependencies, estimated LoC, and status -- markers only carry slice number and name for boundary detection.

## System-Wide Impact

- **Interaction graph**: ba:slice writes to plan files (HTML comments + frontmatter) -- same write pattern as ba:execute checkpoint updates. ba:execute reads slice markers during task extraction. ba:plan's completion menu gains a new option.
- **Error propagation**: Malformed slice markers -> ba:execute falls back to non-sliced behavior with a warning. Invalid `--slice N` (out of range, non-integer) -> error with explicit guidance.
- **State lifecycle risks**: Re-slicing from scratch removes all markers before re-decomposing, avoiding partial state. ba:slice validates annotation completeness after writing to catch interrupted edits.

## Implementation Approach

### Changes Required

---

**File**: `commands/ba/slice.md` *(new file)*

````markdown
---
name: ba:slice
description: Decompose an approved plan into MR-sized slices for incremental delivery
argument-hint: "[path to plan file, or leave empty to auto-detect latest]"
---

# Decompose a Plan into MR-Sized Slices

Read an approved plan and decompose it into self-contained, MR-sized slices of <=150 LoC (excluding tests). Each slice represents one merge request's worth of work with clear scope, estimated size, dependencies, and acceptance criteria.

ba:plan answers "how to build." ba:slice answers "how to ship."

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

### Locate the Plan

**If a path was provided**, read it directly.

**If no path was provided**, auto-detect the most recent actionable plan:

```bash
ls -t docs/plans/*.md 2>/dev/null | head -5
```

From the results, read each plan's YAML frontmatter. Prefer plans with `status: active` or `status: in-progress`. Skip plans with `status: completed`.

If multiple plans match (more than one `active` or `in-progress`), list them and use **AskUserQuestion** to ask the user which one to slice rather than silently choosing.

If found, announce: "Found plan: `[filename]`. Slicing this one."
If not found, ask the user: "No actionable plans found in `docs/plans/`. Which file should I slice? Or run `/ba:plan` to create one."

### Validate the Plan

Read the plan file thoroughly. Check:

1. **Status**: Must be `active` or `in-progress`. If `completed`, announce: "This plan is already completed. Nothing to slice." and stop.

2. **Already sliced** (has `sliced: true` in frontmatter):
   Use **AskUserQuestion**:
   - "This plan is already sliced into [N] slices. What would you like to do?"
   - Options:
     1. **Re-slice from scratch** -- Remove all existing slice markers and the `## Slices` table, then re-decompose
     2. **Keep current slices** -- Exit without changes
   - If "Re-slice": remove all existing `<!-- slice:... -->` markers and the `## Slices` table, reset frontmatter slice fields, then proceed with fresh decomposition.

3. **Partially executed** (has `[x]` marks in implementation sections):
   Only slice uncompleted tasks. Announce: "[N] of [M] tasks already completed. Slicing the remaining [M-N] tasks."

---

## Step 1: Analyze Plan Structure

### Extract Detail Level

Read the `detail_level` field from YAML frontmatter. If missing, infer:
- Has "Implementation Phases" sections -> COMPREHENSIVE
- Has "Changes Required" sections -> STANDARD
- Otherwise -> MINIMAL

### Extract Tasks and Estimate LoC

Based on detail level, extract the task list and estimate LoC for each:

- **MINIMAL**: Each acceptance criterion checkbox is a task. Estimate LoC from the "MVP" code section -- count lines in code fences, distribute across criteria proportionally.
- **STANDARD**: Each `**File**:` block under "Changes Required" is a task. Count lines in each file block's code fence.
- **COMPREHENSIVE**: Each `**File**:` block within a phase is a task. Count code fence lines per block. Respect phase boundaries -- never merge tasks across phases.

### LoC Counting Rules

- Count only lines inside code fences (triple-backtick blocks)
- Exclude test file changes (files matching: `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.*`, files under `tests/`, `__tests__/`, `test/`)
- If a task has no code fence, estimate conservatively (~30-50 LoC per described file change) and mark as "est. approximate"
- Track total estimated LoC across all tasks

### Single-Slice Check

If total estimated LoC <= 150, announce: "This plan fits in a single MR (~[N] LoC). Slicing adds no value -- proceed directly with `/ba:execute`." and stop.

---

## Step 2: Decompose into Slices

### Grouping Algorithm

Group consecutive tasks into slices following these rules:

1. **Target**: <=150 LoC per slice (excluding tests)
2. **Atomic tasks**: Never split a single task (file block) across slices
3. **Logical seams**: Group related files together (e.g., types + model, route + middleware). Coherent units over exact LoC targets.
4. **Phase boundaries** (COMPREHENSIVE only): A slice never spans two phases. If a single phase exceeds 150 LoC, it becomes one slice with a note.
5. **MINIMAL plan grouping**: Group acceptance criteria by functional area (e.g., data layer criteria together, UI criteria together). When functional boundaries are unclear, group sequentially in chunks that fit under 150 LoC.
6. **Oversized tasks**: If a single task exceeds 150 LoC, it becomes its own slice. Add a note: "Oversized -- consider splitting this file in the plan."

### Assign Metadata

For each slice:

- **Number**: Sequential starting from 1
- **Name**: Short descriptive name (2-5 words) derived from the tasks it contains
- **Estimated LoC**: Sum of task LoC estimates within the slice
- **Dependencies**: `none` for the first slice or independent slices. Sequential slices depend on the prior slice number.
- **Acceptance criteria**: What should work after this slice is merged -- derived from the tasks' success criteria

---

## Step 3: Pre-Write Review

Before writing, review the slice list: confirm every task appears in exactly one slice and slice numbers are sequential. If something looks off, fix it before proceeding.

---

## Step 4: Annotate the Plan

### Update Frontmatter

Add or update slice fields in the plan's YAML frontmatter using the Edit tool:

```yaml
sliced: true
slice_count: N
```

### Insert Slice Summary Table

Add a `## Slices` section immediately before the first implementation section ("Implementation Approach", "Acceptance Criteria", or "Implementation Phases" depending on detail level):

```markdown
## Slices

| # | Name | Est. LoC | Depends | Status |
|---|---|---|---|---|
| 1 | [name] | ~[N] | -- | pending |
| 2 | [name] | ~[N] | 1 | pending |
| 3 | [name] | ~[N] | 2 | pending |
```

### Insert Slice Markers

Insert HTML comment markers before the first task of each slice:

```
<!-- slice:1 "Types and data model" -->
```

**Placement by detail level:**
- **MINIMAL**: Before the first acceptance criterion checkbox in the slice
- **STANDARD**: Before the first `**File**:` block in the slice
- **COMPREHENSIVE**: Before the first `**File**:` block in the slice (within its phase)

Markers go on their own line, with a blank line before and after for readability.

### Write All Changes

Use the Edit tool to apply changes to the plan file in this order:
1. Frontmatter updates (add `sliced`, `slice_count`)
2. Slice summary table insertion
3. HTML comment marker insertion (from last slice to first, to avoid offset issues)

### Post-Write Validation

After all edits, read back the plan file and verify:
- Frontmatter has `sliced: true` and correct `slice_count`
- The `## Slices` summary table exists with the expected number of rows
- The expected number of `<!-- slice:N ... -->` markers are present in the file

If validation fails, surface the inconsistency to the user and offer to re-run ba:slice.

---

## Step 5: Present & Chain

Display the slice summary:

```
Plan sliced!

Plan: docs/plans/[filename]
Slices: [N] slices, targeting <=150 LoC each

| # | Name | Est. LoC | Depends |
|---|---|---|---|
| 1 | [name] | ~[N] | -- |
| 2 | [name] | ~[N] | 1 |
...

Total estimated LoC: ~[total] (excluding tests)
```

Use **AskUserQuestion** to present next steps:

**Question:** "Plan sliced into [N] MR-sized deliverables. What would you like to do next?"

**Options:**
1. **Start slice 1** -- Begin executing slice 1 in this session
2. **Fresh-context slice 1** -- Clear context and start slice 1 with only the plan loaded
3. **Review plan** -- Run `/ba:review-plan` to review the sliced plan
4. **Adjust slices** -- Manually modify slice boundaries before executing
5. **Done for now** -- Return later

**Based on selection:**
- **Start slice 1** -> Begin executing: invoke the equivalent of `ba:execute --slice 1 docs/plans/[filename]` directly.
- **Fresh-context slice 1** -> Tell the user: "Run `/clear` then `/ba:execute --slice 1 docs/plans/[filename]`"
- **Review plan** -> Invoke `/ba:review-plan docs/plans/[filename]`
- **Adjust slices** -> Ask which slice to adjust, modify markers and table, return to options.
- **Done for now** -> Display summary and exit.

---

## Important Guidelines

- **Never write code.** ba:slice annotates plan structure -- it does not implement anything.
- **Logical seams over exact counts.** 150 LoC is a target, not a hard cap. A 160 LoC slice that groups logically related changes is better than splitting them awkwardly.
- **One file, one source of truth.** Slices live in the plan file. No separate manifest.
- **Preserve completed work.** When re-slicing from scratch on a partially-executed plan, completed task checkboxes (`[x]`) are never modified.
- **Plan stays the authority.** Slices are a delivery lens -- they don't change what gets built, only the order and grouping of delivery.
- **Insert markers last-to-first.** When inserting multiple HTML comment markers, work from the bottom of the file upward to avoid line-offset drift.
````

---

**File**: `commands/ba/execute.md` *(modifications to existing file)*

Five changes to the existing execute command. Each change specifies where it goes relative to the current file structure.

**Change 0: Update frontmatter argument-hint (line 4)**

Update the `argument-hint` field to reflect the new `--slice N` flag:

````markdown
argument-hint: "[path to plan file] [--slice N]"
````

**Change 1: Add argument parsing after the `<plan_path>` tag (after line 13)**

Insert a new `### Parse Arguments` section between the `<plan_path>` tag and `### Locate the Plan`:

````markdown
### Parse Arguments

Check the argument string for recognized flags before interpreting the plan path:

- **`--slice N`**: Scan for the token `--slice` followed by the next whitespace-delimited token. Validate that token as a positive integer. If valid, extract the slice number and strip both tokens (`--slice` and `N`) from the argument string. If the token is missing, zero, negative, a float, or non-numeric, announce: "Invalid slice number: `[raw token]`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop.
- **Everything else** after stripping flags: Treat as the plan file path.

**Note:** This flag-parsing pattern is specific to ba:execute for slice support. Other commands continue to treat `#$ARGUMENTS` as a plain path or description.
````

**Change 2: Add sliced plan detection in "Read & Validate" (after the "Already complete" check, after line 46)**

Append as item 5 in the extraction list:

````markdown
5. **Sliced plan detection**: Check for `sliced: true` in YAML frontmatter.
   - **If sliced AND `--slice N` provided**: Validate N <= `slice_count` from frontmatter. If N > slice_count, announce: "Slice [N] does not exist. This plan has [slice_count] slices. Use `--slice 1` through `--slice [slice_count]`." and stop. Otherwise, find the `<!-- slice:N ... -->` marker in the file. Extract only tasks between this marker and the next slice marker (`<!-- slice:N+1 ... -->`) or the end of implementation sections. These are the tasks for this execution run.
   - **If sliced AND no `--slice N`**: Scan the `## Slices` summary table for the first slice with Status `pending`. Use **AskUserQuestion**:
     - "This plan is sliced into [M] slices. Slice [X] ([name]) is next. What would you like to do?"
     - Options:
       1. **Execute slice [X]** -- Proceed with the next incomplete slice
       2. **Pick a different slice** -- Enter a slice number
   - **If NOT sliced**: Proceed with existing behavior (no change).
````

**Change 3: Add slice-aware branch naming in "Branch Check" (extend the section around line 60)**

Add after the existing branch suggestion logic:

````markdown
- **If executing a slice (`--slice N`)**: Suggest a branch name incorporating the slice: `<plan-branch>-slice-N` (e.g., `feat/add-auth-slice-1`). Branch from the current branch regardless of slice number. The user is responsible for ensuring prior slice changes are present in their working tree.
````

**Change 4: Add slice reference in commit messages (modify the commit format around line 172)**

Extend the commit message format. When executing a slice, append a `Slice:` trailer:

````markdown
**Sliced execution commit format:**
```bash
git commit -m "<type>(<scope>): <description>

Plan: docs/plans/<filename>
Slice: N/M"
```

Where N is the current slice number and M is the total slice count from frontmatter.
````

**Change 5: Add slice completion handling in "Step 5: Completion" (before the existing "Next Steps" section around line 276)**

Insert before the existing completion menu:

````markdown
### Slice Completion (Sliced Execution Only)

If this was a sliced execution (`--slice N`):

1. **Update slice status**: Edit the `## Slices` summary table in the plan -- change this slice's Status from `pending` to `done`. Target the specific table row by matching the full row pattern including the slice number (e.g., `| N | [name] | ... | pending |`), not just the word "pending".

2. **LoC check**: Count the lines of code changed in this slice (use `git diff --stat` against the branch base, exclude test files). If the changed LoC exceeds 200:
   - Warn: "This slice exceeded the 200 LoC target ([actual] LoC). The slice is complete, but consider re-slicing the remaining work: run `/ba:slice` on the plan and choose 'Re-slice from scratch'."

3. **Last slice check**: If this was the final slice (N == slice_count AND all slices in the table show `done`), update plan frontmatter `status: completed` and proceed to the standard completion menu below.

4. **If more slices remain**, use a slice-aware completion menu instead of the standard one:

Use **AskUserQuestion**:

**Question:** "Slice [N]/[M] complete ([name]). [remaining] slices left. What's next?"

**Options:**
1. **Review code** -- Run `/ba:review` on this slice's changes
2. **Create MR/PR** -- Generate a merge/pull request for this slice
3. **Next slice (fresh session)** -- Start slice [N+1] with clean context (recommended)
4. **Next slice (continue here)** -- Execute slice [N+1] in this session
5. **Done for now** -- Return later

**Based on selection:**
- **Review code** -> Invoke `/ba:review` for this slice's diff.
- **Create MR/PR** -> Same as existing behavior. Use the slice name as MR title prefix: "[Slice N/M] [slice name]". Include slice acceptance criteria in description.
- **Next slice (fresh session)** -> Tell the user: "Run `/clear` then `/ba:execute --slice [N+1] docs/plans/[filename]`". This gives a clean context window for the next slice.
- **Next slice (continue here)** -> Proceed immediately to execute slice N+1 in the current session. **If this is the second or more consecutive slice in this session**, add a note: "You've executed [count] slices in this session. Fresh context is recommended for best results -- consider `/clear` before the next slice."
- **Done for now** -> Display summary including which slices are done and which remain, then exit.
````

---

**File**: `commands/ba/plan.md` *(modify completion menu around line 484)*

In the AskUserQuestion options list, insert a new option 2 between "Start implementation" and the current option 2. Renumber subsequent options:

````markdown
**Options:**
1. **Start implementation** -- Begin executing this plan in the current session
2. **Slice plan** -- Decompose into MR-sized slices for incremental delivery (`/ba:slice`)
3. **Fresh-context implementation** -- Clear context and implement with only the plan loaded (saves tokens)
4. **Review plan** -- Run `/ba:review-plan` to review with available agents and skills (copy, complexity, tests, code review)
5. **Review and refine** -- Manually improve specific sections of the plan
6. **Create issue** -- Create issue in project tracker (GitHub/Linear)
7. **Done for now** -- Return later
````

Add to the "Based on selection" section:

````markdown
- **Slice plan** -> Invoke `/ba:slice docs/plans/[filename]` to decompose into MR-sized slices before executing.
````

---

**File**: `CLAUDE.md` *(add ba:slice to Planning Commands section)*

Add the new command line to the Planning Commands list, after `/ba:plan` and before `/ba:review-plan`:

````markdown
- `/ba:slice [plan]` -- Decompose plans into MR-sized slices for incremental delivery
````

---

**File**: `README.md` *(add ba:slice section and update flow diagram)*

**Change 1**: Update the "Starting a flow" diagram (around line 42-45) to include the optional slice step:

````markdown
After planning, choose your execution mode:
    Plan is large (multiple MRs worth of work)?              -> /ba:slice first
    Plan has testable behaviors / want test-first discipline? -> /ba:tdd
    Straightforward implementation?                          -> /ba:execute
    Plan is sliced?                                          -> /ba:execute --slice N
````

**Change 2**: Add a new section for ba:slice between the `/ba:plan` section and the `/ba:review-plan` section (between line 103 and 105):

````markdown
### `/ba:slice [plan]`

Decomposes an approved plan into MR-sized slices for incremental delivery. Each slice targets <=150 LoC (excluding tests) and represents one merge request's worth of work.

- **Auto-detects the latest plan** if no path is given; reads plan structure and estimates LoC per task
- **Inline annotations** -- slices live as HTML comment markers in the plan file (one file, one source of truth)
- **Three detail levels** -- handles MINIMAL, STANDARD, and COMPREHENSIVE plans; respects phase boundaries in COMPREHENSIVE
- **Re-sliceable** -- run ba:slice again and choose "Re-slice from scratch" to re-decompose when estimates prove wrong
- **Pipeline chaining** -- completion menu offers to start slice 1 immediately or with fresh context

After slicing, execute one slice at a time with `/ba:execute --slice N`. Each slice gets its own branch and MR.
````

**Change 3**: Update the `/ba:execute` section (around line 116-126) to mention slice support:

````markdown
- **Slice-aware execution** -- `--slice N` executes a single slice; auto-detects next incomplete slice on sliced plans; suggests fresh context between slices
````

**Change 4**: Add ba:slice to the Roadmap section (around line 213) as a completed item:

````markdown
- `/ba:slice` -- plan decomposition into MR-sized slices for incremental delivery ✅
````

---

**File**: `.claude-plugin/plugin.json` *(version bump and metadata update)*

Update version from `0.6.0` to `0.7.0`. Add "slice" to keywords. Update description:

```json
{
  "name": "dev-workflow",
  "version": "0.7.0",
  "description": "Research, brainstorm, plan, slice, execute, TDD execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
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
    "tdd",
    "workflow",
    "conventions",
    "review",
    "compound",
    "knowledge"
  ]
}
```

---

### Success Criteria

#### Automated:

- [x] `ls commands/ba/slice.md` -- file exists
- [x] `grep -c 'ba:slice' CLAUDE.md` -- ba:slice appears in CLAUDE.md
- [x] `grep -c 'ba:slice' README.md` -- ba:slice appears in README.md
- [x] `grep '"version": "0.7.0"' .claude-plugin/plugin.json` -- version bumped
- [x] `grep 'slice' commands/ba/execute.md` -- execute.md has slice support
- [x] `grep 'Slice plan' commands/ba/plan.md` -- plan.md completion menu has slice option

#### Manual:

- [ ] Run `/ba:slice` on a STANDARD plan with >150 LoC -- produces correct slice markers and summary table
- [ ] Run `/ba:execute --slice 1` -- extracts only slice 1 tasks, suggests fresh session after completion
- [ ] Run `/ba:execute` on a sliced plan without `--slice` -- auto-detects next incomplete slice
- [ ] Run `/ba:slice` on an already-sliced plan -- offers "Re-slice from scratch" or "Keep current"
- [ ] Run `/ba:slice` on a plan with <=150 LoC -- announces no slicing needed
- [ ] Run `/ba:plan` and verify "Slice plan" appears in the completion menu
- [ ] Pipeline flows correctly: ba:plan -> ba:slice -> ba:execute --slice 1 -> ba:review
- [ ] Run `/ba:execute --slice 99` on a 3-slice plan -- shows explicit error with valid range

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| LoC estimates are inaccurate for description-only plans | Flag approximate estimates; re-slicing from scratch recovers from bad estimates |
| Flag parsing from `#$ARGUMENTS` is a new pattern | Documented as localized to execute; simple token stripping, not a full parser |
| Slice markers could break plan parsing by other commands | Markers are HTML comments (invisible to markdown renderers); ba:execute, ba:tdd, ba:review-plan all ignore unknown content |
| Interrupted annotation leaves plan inconsistent | Post-write validation step detects missing markers/table; re-running ba:slice recovers |
| Phase boundaries in COMPREHENSIVE plans may produce oversized slices | Accept oversized slices at phase boundaries with a note; logical coherence > exact LoC |

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-04-13-ba-slice-command-brainstorm.md` -- Key decisions carried forward: inline annotation format, Planning Command classification, 150/200 LoC targets, sequential dependency model

### Internal References

- Command structure pattern: `commands/ba/execute.md` (plan-consuming command template)
- Plan auto-detect pattern: `commands/ba/execute.md:18-28`
- Task extraction by detail level: `commands/ba/execute.md:40-44`
- Checkpoint tracking: `commands/ba/execute.md:143`
- Commit discipline: `commands/ba/execute.md:146-179`
- Plan completion menu: `commands/ba/plan.md:480-501`
- Execute completion menu: `commands/ba/execute.md:276-292`
- Branch check pattern: `commands/ba/execute.md:52-62`
- Plugin version: `.claude-plugin/plugin.json:3`

## Convention Compliance

- [x] **ba: prefix** -- command uses `ba:slice`. Aligned.
- [x] **Agent naming** -- no new agents. Not applicable.
- [x] **Artifact paths** -- slices inline in existing plan files, no new artifact type. Aligned.
- [x] **Planning command category** -- ba:slice never writes code, only annotates. Aligned.
- [x] **YAML frontmatter** -- extends existing plan frontmatter (`sliced`, `slice_count`). Justified override: metadata additions consistent with how other commands add state (e.g., `status: in-progress`).
- [x] **Convention-compliance check** -- justified override: ba:slice modifies an existing plan file, not creating a new artifact. Includes lightweight structural validation consistent with the convention's spirit.
- [x] **Flag parsing pattern** -- justified override: new pattern localized to execute.md, documented in-command. Not elevated to global convention until more commands adopt it.
- [x] **Version bump** -- 0.6.0 -> 0.7.0. Aligned.
- [x] **CLAUDE.md update** -- ba:slice added to Planning Commands (after ba:plan, before ba:review-plan). Aligned.
- [x] **README.md update** -- ba:slice section added, flow diagram updated. Aligned.
- [x] **Plan authority preserved** -- `--slice N` is a lens, not a new authority. Aligned.
