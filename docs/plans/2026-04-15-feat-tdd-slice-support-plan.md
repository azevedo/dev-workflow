---
title: "feat: Add slice support to ba:tdd"
type: feat
status: completed
date: 2026-04-15
origin: docs/brainstorms/2026-04-15-tdd-slice-support-brainstorm.md
detail_level: standard
tags: [ba:tdd, ba:slice, ba:execute, slicing]
---

# Add Slice Support to ba:tdd

Mirror ba:execute's slice mechanics into ba:tdd so sliced plans can be executed with either command interchangeably. Update ba:slice to offer both execution modes. (see brainstorm: docs/brainstorms/2026-04-15-tdd-slice-support-brainstorm.md)

## Overview

ba:execute already supports `--slice N` for scoped execution of sliced plans. ba:tdd has zero slice awareness. This plan adds the same slice mechanics to ba:tdd (argument parsing, scoped behavior extraction, branch naming, commit format, completion flow) and updates ba:slice's completion menu to offer both execution modes. The design decision is "mirror, don't abstract" — two self-contained commands rather than shared slice infrastructure (see brainstorm: Key Decisions).

## Current State

- `commands/ba/execute.md` — full slice support: `--slice N` parsing (line 17-22), sliced plan detection (line 57-64), slice branch naming (line 81), sliced commit format (line 198-206), slice completion flow (line 303-332)
- `commands/ba/tdd.md` — zero slice awareness; reads behaviors from plan, runs TDD loop on all of them
- `commands/ba/slice.md` — chains exclusively to ba:execute in Step 5 (lines 197-204); inserts `<!-- slice:N -->` markers only in implementation sections, not in "Behaviors to Test"
- `.claude-plugin/plugin.json` — version 0.7.1
- `README.md` — flow chart (line 46) routes sliced plans only to ba:execute; ba:tdd description (lines 142-152) has no mention of slice support; slice description (line 117) only references ba:execute

## What We're NOT Doing

- Extracting shared slice infrastructure between ba:execute and ba:tdd (brainstorm decision: mirror, don't abstract)
- Adding slice support to any other commands (brainstorm, plan, review, compound)
- Merging ba:tdd into ba:execute as an execution mode (roadmap item, deferred until ba:tdd is validated through real usage)
- Changing how ba:execute's slice support works

## Behaviors to Test

- [x] ba:tdd parses `--slice N` flag and extracts slice number from arguments
- [x] ba:tdd rejects invalid slice arguments (missing N, zero, negative, non-numeric, out of range)
- [x] ba:tdd detects sliced plans and auto-selects next pending slice when no `--slice` flag given
- [x] ba:tdd errors when `--slice N` is used on a non-sliced plan
- [x] ba:tdd scopes behavior extraction to the current slice's marker range
- [x] ba:tdd suggests slice-specific branch names (`-slice-N`)
- [x] ba:tdd commit messages include both TDD cycle info and `Slice: N/M`
- [x] ba:tdd updates slice status table and shows slice-aware completion menu
- [x] ba:tdd bulk-marks implementation task checkboxes at slice/plan completion
- [x] ba:slice inserts markers into "Behaviors to Test" section alongside implementation sections
- [x] ba:slice offers execution mode choice (execute vs tdd) in completion menu

## Proposed Solution

Six files changed, all markdown prompt files (no runtime code):

1. **ba:tdd** gains slice mechanics mirrored from ba:execute
2. **ba:slice** gains behavior-section markers and dual execution mode options
3. **ba:execute** gets a minor note update
4. **plugin.json**, **README.md** — housekeeping updates

### Key design decisions resolved during brainstorming:

- **Behavior-to-slice mapping**: ba:slice inserts `<!-- slice:N -->` markers into the "Behaviors to Test" section (same markers, same pattern as implementation sections). ba:tdd uses the same marker-scanning logic as ba:execute's task extraction.
- **Bulk task completion**: During the TDD loop, ba:tdd only checks off behaviors (its execution unit). At slice completion (all behaviors green + refactor done), ba:tdd bulk-marks all implementation task checkboxes within the slice's marker range as `[x]`. For non-sliced execution, the bulk update happens at plan completion. This keeps the plan fully checked without fragile per-behavior file-path matching.
- **Refactor phase scoping**: When executing a slice, the refactor-advisor receives only files changed during the current slice's TDD loop.

## Technical Considerations

- **Marker placement in Behaviors to Test**: ba:slice currently inserts markers before `**File**:` blocks (STANDARD) or acceptance criteria checkboxes (MINIMAL). The Behaviors section uses a flat checkbox list, so markers go before the first behavior in each slice — same as MINIMAL placement logic.
- **Bulk task completion timing**: ba:tdd defers implementation-task checkoffs to slice/plan completion rather than per-behavior. This avoids fragile file-path matching during the TDD loop. At completion, all task checkboxes within the slice's marker range (or all tasks for non-sliced) are bulk-marked `[x]` since the work is done.
- **Resume with mixed execution**: ba:tdd's resume detection scans "Behaviors to Test" for `[x]` marks. ba:execute's resume scans implementation sections. Since each scans its own section, they don't conflict. A plan with slice 1 done via ba:execute (tasks `[x]`) and slice 2 in-progress via ba:tdd (some behaviors `[x]`) works correctly.

## System-Wide Impact

- **Interaction graph**: ba:slice now writes to an additional plan section (Behaviors to Test). ba:tdd now reads slice markers and bulk-writes to implementation task checkboxes at completion. No callbacks or external systems affected.
- **Error propagation**: New error cases (invalid `--slice` args, missing markers in Behaviors section, orphaned markers with falsy `sliced`) all terminate with clear messages before the TDD loop starts. No mid-execution failures introduced.
- **State lifecycle risks**: The bulk task completion at slice/plan end means implementation tasks are updated in a single pass after all behaviors are green. If the bulk Edit fails, behaviors are `[x]` but tasks remain `[ ]` — the plan is functionally complete (ba:tdd tracks behaviors) but cosmetically inconsistent. A re-run of the bulk step would fix it.

## Implementation Approach

### Changes Required

---

**File**: `commands/ba/tdd.md` — line 4 (argument-hint)

```markdown
argument-hint: "[path to plan file] [--slice N]"
```

---

**File**: `commands/ba/tdd.md` — insert after line 14 (`<plan_path>` tag), before "### Locate the Plan"

```markdown
### Parse Arguments

Check the argument string for recognized flags before interpreting the plan path:

- **`--slice N`**: Scan for the token `--slice` followed by the next whitespace-delimited token. Validate that token as a positive integer. If valid, extract the slice number and strip both tokens (`--slice` and `N`) from the argument string. If `--slice` is the last token with nothing after it, announce: "Missing slice number after `--slice`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop. If the token is zero, negative, a float, or non-numeric, announce: "Invalid slice number: `[raw token]`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop.
- **Everything else** after stripping flags: Treat as the plan file path.

**Note:** This flag-parsing pattern is shared across execution commands (ba:execute, ba:tdd) for slice support. Other commands continue to treat `#$ARGUMENTS` as a plain path or description.
```

---

**File**: `commands/ba/tdd.md` — insert after the three behavior extraction items (after line 36 "Fallback to interactive definition"), before "Present the extracted behavior list"

```markdown
4. **Sliced plan detection**: Check for `sliced: true` in YAML frontmatter.
   - **If sliced AND `--slice N` provided**: Validate 1 <= N <= `slice_count` from frontmatter. If N is out of range, announce: "Slice [N] does not exist. This plan has [slice_count] slices. Use `--slice 1` through `--slice [slice_count]`." and stop. Otherwise, find the `<!-- slice:N ... -->` marker in the "Behaviors to Test" section. If the marker is not found, announce: "Slice [N] marker not found in the Behaviors to Test section. The plan may need re-slicing — run `/ba:slice` to fix." and stop. Extract only behaviors between this marker and the next slice marker (`<!-- slice:N+1 ... -->`) or the end of the Behaviors to Test section.
   - **If sliced AND no `--slice N`**: Scan the `## Slices` summary table for the first slice with Status `pending`. Use **AskUserQuestion**:
     - "This plan is sliced into [M] slices. Slice [X] ([name]) is next. What would you like to do?"
     - Options:
       1. **Execute slice [X] with TDD** -- Proceed with the next incomplete slice
       2. **Pick a different slice** -- Enter a slice number
   - **If NOT sliced AND `--slice N` provided**: First check whether `<!-- slice:` markers exist in the file despite `sliced` being falsy. If markers found, warn: "Plan has slice markers but `sliced: true` is not set in frontmatter. Run `/ba:slice` to fix, or add `sliced: true` manually." and stop. If no markers, announce: "This plan is not sliced. Run `/ba:slice` first, or remove `--slice N` to execute the full plan." and stop.
   - **If NOT sliced**: Proceed with existing behavior (no change).
```

---

**File**: `commands/ba/tdd.md` — insert after line 64 (the "If detached HEAD" bullet in Branch Check)

```markdown
- **If executing a slice (`--slice N`)**: Suggest a branch name incorporating the slice: `<plan-branch>-slice-N` (e.g., `feat/add-auth-slice-1`). Branch from the current branch regardless of slice number. The user is responsible for ensuring prior slice changes are present in their working tree.
```

---

**File**: `commands/ba/tdd.md` — replace lines 235-236 (step 2i: Update Checkpoint)

Replace the current:
> Update the plan file: change the completed behavior's `[ ]` to `[x]` using the Edit tool.

With:

```markdown
Update the plan file: change the completed behavior's `[ ]` to `[x]` in the "Behaviors to Test" section using the Edit tool.

**Note:** Implementation task checkboxes in "Changes Required" / "Implementation Phases" are NOT updated per-behavior. They are bulk-checked at slice or plan completion (see Step 4: Completion).
```

---

**File**: `commands/ba/tdd.md` — insert after line 258 (end of current commit format block in step 2j)

````markdown
**Sliced execution commit format:**
```bash
git commit -m "<type>(<scope>): <behavior description>

Red-green cycle [N]/[M]
Plan: docs/plans/<filename>
Slice: N/M"
```

Where N is the current slice number and M is the total slice count from frontmatter.
````

---

**File**: `commands/ba/tdd.md` — in Step 3b (Dispatch Refactor-Advisor, ~line 279), append to the advisor task prompt

```markdown
If executing a slice, only include files changed during this slice's TDD loop — do not suggest refactoring files outside the slice scope.
```

---

**File**: `commands/ba/tdd.md` — insert before "### Next Steps" (~line 365), after the Fresh Verification and Update Plan Status subsections

```markdown
### Bulk Task Completion

After confirming all behaviors and before updating plan status, bulk-mark implementation task checkboxes:

**If sliced execution (`--slice N`)**: Find all `[ ]` checkboxes in "Changes Required" or "Implementation Phases" between the current slice's `<!-- slice:N ... -->` marker and the next marker (or end of section). Change each to `[x]`.

**If non-sliced execution**: Find all `[ ]` checkboxes in the implementation sections and change each to `[x]`.

This ensures the plan file shows all work as complete regardless of whether ba:tdd or ba:execute was used.

### Slice Completion (Sliced Execution Only)

If this was a sliced execution (`--slice N`):

1. **Update slice status**: Edit the `## Slices` summary table in the plan -- change this slice's Status from `pending` to `done`. Target the specific table row by matching the full row pattern including the slice number (e.g., `| N | [name] | ... | pending |`), not just the word "pending".

2. **LoC check**: Count the lines of code changed in this slice (use `git diff --stat` against the branch base, exclude test files). Slices target 150 LoC; the warning threshold is 200 LoC to allow for estimation error. If the changed LoC exceeds 200:
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
- **Next slice (fresh session)** -> Tell the user: "Run `/clear` then `/ba:tdd --slice [N+1] docs/plans/[filename]`". This gives a clean context window for the next slice. Add: "To switch to ba:execute for the next slice, use `/ba:execute --slice [N+1]` instead."
- **Next slice (continue here)** -> Proceed immediately to execute slice N+1 in the current session. **If this is the second or more consecutive slice in this session**, add a note: "You've executed [count] slices in this session. Fresh context is recommended for best results -- consider `/clear` before the next slice."
- **Done for now** -> Display summary including which slices are done and which remain, then exit.
```

---

**File**: `commands/ba/slice.md` — in Step 4 "Insert Slice Markers" subsection (~line 139), add after the placement rules

```markdown
### Insert Behavior Markers

If the plan has a "Behaviors to Test" section, also insert `<!-- slice:N "name" -->` markers into that section. Place each marker before the first behavior checkbox that belongs to the slice.

**Mapping behaviors to slices**: Behaviors map to slices by the implementation tasks they exercise. For each slice's task group, identify which behaviors cover those tasks (by file path or functional area) and group them under the corresponding slice marker.

If the mapping is ambiguous (a behavior spans multiple slices, or no clear task correspondence exists), use **AskUserQuestion** to ask the user which slice each ambiguous behavior belongs to.

**Cross-cutting behaviors** (e.g., "API responses include proper error codes for all endpoints") that span all slices should be assigned to the final slice as a validation pass.

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
```

---

**File**: `commands/ba/slice.md` — in Step 4 "Post-Write Validation" subsection (~line 165), add a validation item

```markdown
- If the plan has a "Behaviors to Test" section, verify that behavior markers were inserted and the count matches the implementation markers
```

---

**File**: `commands/ba/slice.md` — line 79 (single-slice check message)

Replace:
> "This plan fits in a single MR (~[N] LoC). Slicing adds no value -- proceed directly with `/ba:execute`."

With:
```markdown
"This plan fits in a single MR (~[N] LoC). Slicing adds no value -- proceed directly with `/ba:execute` or `/ba:tdd`."
```

---

**File**: `commands/ba/slice.md` — lines 196-207 (Step 5: Present & Chain options and handlers)

Replace the current options block with:

```markdown
**Options:**
1. **Start slice 1** -- Begin executing slice 1 in this session
2. **Fresh-context slice 1** -- Clear context and start slice 1 with only the plan loaded
3. **Review plan** -- Run `/ba:review-plan` to review the sliced plan
4. **Adjust slices** -- Manually modify slice boundaries before executing
5. **Done for now** -- Return later

**Based on selection:**
- **Start slice 1** / **Fresh-context slice 1** -> Ask a follow-up: "Which execution mode?" with options: **Execute** (`ba:execute --slice 1`) or **TDD** (`ba:tdd --slice 1`). For in-session start, invoke the chosen command directly. For fresh-context, tell the user the appropriate `/clear` then command string.
- **Review plan** -> Invoke `/ba:review-plan docs/plans/[filename]`
- **Adjust slices** -> Ask which slice to adjust, modify markers and table, return to options.
- **Done for now** -> Display summary and exit.
```

---

**File**: `commands/ba/execute.md` — line 22

Replace:
> **Note:** This flag-parsing pattern is specific to ba:execute for slice support. Other commands continue to treat `#$ARGUMENTS` as a plain path or description.

With:
```markdown
**Note:** This flag-parsing pattern is shared across execution commands (ba:execute, ba:tdd) for slice support. Other commands continue to treat `#$ARGUMENTS` as a plain path or description.
```

---

**File**: `.claude-plugin/plugin.json` — line 3

Replace:
> "version": "0.7.1"

With:
```json
"version": "0.8.0"
```

---

**File**: `README.md` — line 46

Replace:
```
    Plan is sliced?                                          → /ba:execute --slice N
```

With:
```
    Plan is sliced?                                          → /ba:execute --slice N or /ba:tdd --slice N
```

---

**File**: `README.md` — line 117

Replace:
> After slicing, execute one slice at a time with `/ba:execute --slice N`. Each slice gets its own branch and MR.

With:
```markdown
After slicing, execute one slice at a time with `/ba:execute --slice N` or `/ba:tdd --slice N`. Each slice gets its own branch and MR.
```

---

**File**: `README.md` — after line 151 (inside ba:tdd description, after the "Same infrastructure" bullet)

Insert:
```markdown
- **Slice-aware execution** — `--slice N` executes a single slice with TDD; auto-detects next incomplete slice on sliced plans; suggests fresh context between slices
```

---

### Success Criteria

#### Automated:
- [ ] `grep -c "slice" commands/ba/tdd.md` — returns >0 (slice support present)
- [ ] `grep "slice" commands/ba/slice.md | grep -c "tdd"` — returns >0 (ba:tdd referenced in slice)
- [ ] `grep "shared across execution commands" commands/ba/execute.md` — matches (note updated)
- [ ] `grep "0.8.0" .claude-plugin/plugin.json` — matches (version bumped)
- [ ] `grep "ba:tdd --slice" README.md` — matches (README updated)

#### Manual:
- [ ] Run `/ba:tdd --slice 1` on a sliced plan — behaviors are scoped to slice 1
- [ ] Run `/ba:slice` on a plan with "Behaviors to Test" — markers appear in both sections
- [ ] Run `/ba:execute --slice 1` then `/ba:tdd --slice 2` on same plan — both track progress correctly
- [ ] ba:tdd completion menu references `ba:tdd --slice N+1` for next slice

## Dependencies & Risks

- **No external dependencies** — all changes are to markdown prompt files within the plugin
- **Risk: behavior-to-slice mapping ambiguity** — when ba:slice maps behaviors to slices, some behaviors may span multiple slices or have no clear task correspondence. Mitigated by the AskUserQuestion fallback for ambiguous cases.
- **Risk: plan-file-format coupling** — After this change, modifying the plan file format (marker syntax, section naming, checkbox format) requires updating three command files in lockstep (ba:execute, ba:tdd, ba:slice). Mitigated by the roadmap item to merge ba:tdd into ba:execute, which will consolidate the duplication.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-04-15-tdd-slice-support-brainstorm.md` — Key decisions: mirror don't abstract, slice scopes behaviors, dual checkpoint, ba:slice offers execution mode choice

### Internal References
- ba:execute slice support: `commands/ba/execute.md:17-22` (parsing), `commands/ba/execute.md:57-64` (detection), `commands/ba/execute.md:81` (branch), `commands/ba/execute.md:198-206` (commit), `commands/ba/execute.md:303-332` (completion)
- ba:tdd insertion points: `commands/ba/tdd.md:4` (hint), `commands/ba/tdd.md:14` (args), `commands/ba/tdd.md:36` (detection), `commands/ba/tdd.md:64` (branch), `commands/ba/tdd.md:235` (checkpoint), `commands/ba/tdd.md:258` (commit), `commands/ba/tdd.md:365` (completion)
- ba:slice chaining: `commands/ba/slice.md:196-207` (Step 5 options)
- ba:slice original brainstorm: `docs/brainstorms/2026-04-13-ba-slice-command-brainstorm.md` — deferred ba:tdd integration to V2

## Convention Compliance

- [x] Command prefix `ba:` — aligned (no new commands)
- [x] Agent names lowercase-with-hyphens — aligned (no new agents)
- [x] Bump version in plugin.json — aligned (0.7.1 → 0.8.0)
- [x] Update README.md — aligned (flow chart, slice description, ba:tdd capabilities all updated with exact content)
- [x] Planning commands never write code — aligned (ba:slice changes are prompt/marker changes)
- [x] Execution commands implement approved plans — aligned (ba:tdd still plan-driven)
- [x] Convention-compliance check mandatory — aligned (no new planning artifacts)
- [x] All built-in reviewers always appear in /ba:review — aligned (no reviewer changes)
- [x] CLAUDE.md descriptions — no changes needed (descriptions are brief capability summaries)
