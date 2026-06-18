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

- **MINIMAL**: Each acceptance criterion checkbox is a task. Estimate LoC from the "MVP" section by applying the LoC Counting Rules below to each fence, distributing across criteria proportionally.
- **STANDARD**: Each `**File**:` block under "Changes Required" is a task. Apply the LoC Counting Rules below to each file block's fence.
- **COMPREHENSIVE**: Each `**File**:` block within a phase is a task. Apply the LoC Counting Rules below to each block's fence. Respect phase boundaries -- never merge tasks across phases.

### LoC Counting Rules

- Count only lines inside **literal** code fences. A fence counts as literal only when it is immediately preceded by a `**Code-shape decision:**` label; any unlabeled fence is pseudo-code — do not line-count it, fall through to the estimate rule below. **Backward-compat:** if the plan has no `**Code-shape decision:**` labels anywhere (a pre-change plan), treat every fenced block as literal and count it — otherwise old plans route all code to the estimate fallback and slice under-sizes MRs. <!-- Maintainer note: keep this routing identical to execute.md Step 1.5b; both are mirrors per the CLAUDE.md Code-shape decision sync convention. -->
- Exclude test file changes (files matching: `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.*`, files under `tests/`, `__tests__/`, `test/`)
- If a task has no literal code fence (pseudo-code/decisions only), estimate conservatively (~30-50 LoC per described file change) and mark as "est. approximate"
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

### Insert Behavior Markers

If the plan has a "Behaviors to Test" section, also insert `<!-- slice:N "name" -->` markers into that section. Place each marker before the first behavior checkbox that belongs to the slice.

**Mapping behaviors to slices**: Behaviors map to slices by the implementation tasks they exercise. For each slice's task group, identify which behaviors cover those tasks (by file path or functional area) and group them under the corresponding slice marker.

**First**, identify cross-cutting behaviors — those that span all slices or have no clear task correspondence (e.g., "API responses include proper error codes for all endpoints"). Assign these to the final slice as a validation pass.

**Then**, for any remaining behaviors with ambiguous mapping (a behavior spans multiple specific slices without being truly cross-cutting), use **AskUserQuestion** to ask the user which slice each ambiguous behavior belongs to.

**Example:**
```markdown
## Behaviors to Test

<!-- slice:1 "Types and data model" -->
- [ ] Widget type validates required fields
- [ ] Widget model persists to database

<!-- slice:2 "Routes and handlers" -->
- [ ] GET /widgets returns paginated list
- [ ] POST /widgets creates new widget
```

Behavior markers follow the same last-to-first insertion order as implementation markers.

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
- If the plan has a "Behaviors to Test" section, verify that behavior markers were inserted and that the set of distinct `<!-- slice:N -->` tag numbers in the Behaviors section matches the set in the implementation sections (same N values present in both)

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

---

## Important Guidelines

- **Never write code.** ba:slice annotates plan structure -- it does not implement anything.
- **Logical seams over exact counts.** 150 LoC is a target, not a hard cap. A 160 LoC slice that groups logically related changes is better than splitting them awkwardly.
- **One file, one source of truth.** Slices live in the plan file. No separate manifest.
- **Preserve completed work.** When re-slicing from scratch on a partially-executed plan, completed task checkboxes (`[x]`) are never modified.
- **Plan stays the authority.** Slices are a delivery lens -- they don't change what gets built, only the order and grouping of delivery.
- **Insert markers last-to-first.** When inserting both implementation markers and behavior markers, work from the bottom of each respective section upward to avoid line-offset drift.
