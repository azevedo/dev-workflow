---
title: Add Pre-Slice Scope Tripwire to /ba:execute
type: feat
status: completed
date: 2026-05-18
origin: docs/brainstorms/2026-05-18-ba-execute-scope-tripwire-brainstorm.md
detail_level: minimal
iteration_count: 1
tags: [ba-execute, scope-discipline, deviation-handling]
---

# Add Pre-Slice Scope Tripwire to /ba:execute

Insert a pre-coding discipline check in `/ba:execute` that catches scope creep before the agent writes any code in a slice. The agent projects LoC by listing files-to-touch and estimating per-file changes; if projection ≥ 2× the slice's `Est. LoC`, it pauses via the existing Step 4 Deviation Handling flow.

Text-only change to `commands/ba/execute.md`, one bullet in `README.md`, version bump. No new agents, no schema changes to plans or slices.

(See brainstorm: `docs/brainstorms/2026-05-18-ba-execute-scope-tripwire-brainstorm.md`.)

## Acceptance Criteria

- [x] `commands/ba/execute.md` gains a new `## Step 1.5: Pre-Slice Scope Check` between current Step 1 and Step 2.
- [x] Step 1.5 describes the projection: build files-to-touch list, estimate LoC per file, sum to projection **M**.
- [x] Threshold **T** is explicit and binary:
  - Sliced plan with well-formed `Est. LoC = ~N`: **T = 2 × N**.
  - Sliced plan with absent or unparseable `Est. LoC` cell (cell missing, row absent, or value not in the form `~<integer>`): warn once and fall back to **T = 400**.
  - Non-sliced plan: **T = 400** (2× the existing 200-LoC post-slice warning).
- [x] **M ≥ T** triggers the pause via Step 4 Deviation Handling — Expected/Found/Why block followed by AskUserQuestion (Accept / Update plan / Pause).
- [x] **M < T** proceeds, with a one-line summary announced for visibility (e.g., *"Pre-slice scope check: projected ~75 LoC vs Est. ~80 (threshold 160). Proceeding."*).
- [x] The pause's Expected/Found/Why text surfaces the **binding-scope rule** explicitly: when AC and LoC disagree, LoC is the binding scope signal — surface the contradiction; do not silently implement both.
- [x] Triggered events are logged to `## Deviations` under a recognizable subsection: `### Scope tripwire: Slice [N] — projected M ≥ 2× estimate` (multiple rounds on the same slice append `(round 2)`, `(round 3)`, etc.).
- [x] Deviations entry is written **before** Pause returns control (so the audit record survives the exit).
- [x] **Re-projection** runs after the user picks "Update the plan" and signals via an explicit AskUserQuestion sync gate that the edit is done: re-read `Est. LoC` row, re-build files list, re-compare against new T. Proceed only when M < T.
- [x] **Resume rules**:
  - Fresh-slice resume (no `[x]` in current slice's tasks) → Step 1.5 fires.
  - Mid-slice resume (any `[x]` in current slice's tasks) → Step 1.5 skips; rely on the post-slice 200-LoC warning.
- [x] **No mid-slice re-firing**: once Step 1.5 passes, it does not re-fire within the slice (not after Step 2c's test-failure escape hatch, not on file-list growth).
- [x] **Ordering**: Step 1.5 fires after Step 1 fully completes (Branch Check, Resume Detection including any resume-test prompt, Test Discovery), regardless of the resume-test outcome the user chose.
- [x] `## Important Guidelines` gains a bullet stating that the pre-slice scope check is binding and LoC is the binding scope signal.
- [x] `README.md`'s `/ba:execute` bullet list gains one line describing the scope check.
- [x] `.claude-plugin/plugin.json` version bumped (0.16.1 → 0.17.0).
- [x] **Replay test**: the slice-8 case (`Est. LoC = ~80`, three surfaces in AC, ~310 LoC actual) appears in `## Behaviors to Test` and demonstrates the pause firing — 310 ≥ 160.
- [x] No new files in `agents/`. No edits to `commands/ba/slice.md`, `commands/ba/plan.md`, plan templates, or any agent definition.

## What We're NOT Doing

- Per-slice acceptance criteria (criteria stay feature-wide, slice-inherited).
- Per-slice `## Out of Scope` lists.
- `files-touched` columns in slice tables.
- Mid-slice running-diff polling.
- Strengthening the existing post-slice 200-LoC warning (separate concern; can be considered later).
- Changes to `/ba:slice` or `/ba:plan` schema or templates.
- A new scope-gate agent parallel to `plan-iteration-gate`.
- Catching *adjacent-edit* drift (renames, unrequested defaults, "improving" nearby code).
- Suppressing Step 1.5 for COMPREHENSIVE non-sliced plans — they fire universally at the 400-LoC threshold; frequent trips are acceptable on intentionally-large runs.
- Mid-slice re-firing on plan amendment — if a slice is paused mid-execution, the plan is amended to widen scope, and the slice resumes, Step 1.5 does not re-fire (mid-slice resume always skips). This is an accepted gap; the post-slice 200-LoC warning remains the reactive safety net for this case.

## Behaviors to Test *(optional)*

User-observable behaviors this plan must satisfy. Each is a candidate verification check against the new `commands/ba/execute.md` text:

- [x] On a sliced plan with `Est. LoC = ~80`, projecting ~310 LoC triggers a pause (the slice-8 replay).
- [x] Sliced plan whose active slice row has `Est. LoC` absent or unparseable as `~<integer>` triggers the fallback: agent warns and uses T = 400.
- [x] Resuming a slice with at least one `[x]` mark skips Step 1.5 entirely; resuming with zero `[x]` marks re-fires it.
- [x] The Expected/Found/Why pause block names the binding-scope rule when AC and LoC disagree on scope.

## Context

### Files this plan touches

- `commands/ba/execute.md` — insert `## Step 1.5: Pre-Slice Scope Check` (between current Step 1 at lines 69-113 and Step 2 at line 115); add one bullet to `## Important Guidelines` (lines 359-369).
- `README.md` — add one bullet to the `/ba:execute` behavior list (currently lines 144-149).
- `.claude-plugin/plugin.json` — bump `version` from `0.16.1` to `0.17.0`.

### Anchors and patterns to follow

- **Step heading style**: `## Step N: <Title Case Name>` with one-line opener describing when it fires (`commands/ba/execute.md:215, 232`).
- **Sub-step style** for procedural sub-sections: existing Step 2 uses letter suffixes (`### 2a.`, `### 2b.`...). Step 1.5 will follow the same convention with `### 1.5a.` through `### 1.5f.`
- **Deviation Handling flow to reuse**: existing Step 4 (`commands/ba/execute.md:232-263`) — Expected/Found/Why block (`:236-243`), AskUserQuestion + three options (`:245-251`), `## Deviations` log template (`:252-262`).
- **Mandatory rule emphasis**: `**You MUST ...**` / `**MANDATORY**` (e.g., `commands/ba/execute.md:167, 169`).
- **`Est. LoC` source**: `## Slices` table row, column `Est. LoC`, format `~N` (`commands/ba/slice.md:130-137`). Step 5 already edits this same table by row at `commands/ba/execute.md:310` — same lookup mechanism.
- **Slice marker shape**: `<!-- slice:N "name" -->` (`commands/ba/slice.md:140-152`). Used to scope per-slice task ranges; carries number and name only, not LoC.
- **No new agents convention**: `CLAUDE.md` — agents live in `agents/` only when the function is reusable across commands; this discipline lives inline.

### Why the four-approach analysis is not "design-it-twice"

The brainstorm enumerated four alternatives (planning-time disambiguation, defense in depth, static AC-vs-LoC cue, mid-stream polling) before choosing pre-coding dynamic projection. This is default-mode brainstorm reasoning, not the `design-it-twice` interface generator (no new module / no new public interface exists). No `## Locked Design` / `## Rejected Designs` sections are required in this plan.

## MVP

### `commands/ba/execute.md` — insert after line 113 (after Step 1, before Step 2)

Insert this new section. Place it immediately after the `---` separator that closes Step 1, and before the `## Step 2: Execution Loop` heading.

```markdown
## Step 1.5: Pre-Slice Scope Check

Before any code is written for this slice (or this run, for non-sliced plans), project the size of what you're about to do and reconcile it against the slice's `Est. LoC`. This catches scope creep — when an acceptance criterion implicitly covers more surface than the LoC estimate budgets — before it lands as code.

**When this fires:**
- Once per slice, after Step 1 has fully completed (Branch Check, Resume Detection including any resume-test prompt, Test Discovery).
- Once per run on non-sliced plans, using a fallback threshold.
- **Fresh-slice resume re-fires; mid-slice resume skips.** If no `[x]` marks exist in the current slice's tasks, fire. If any `[x]` exists in the current slice's tasks, skip — the post-slice 200-LoC warning remains the only safety net for this slice.
- **Once Step 1.5 passes, it does not re-fire within this slice** — not after Step 2c's test-failure escape hatch, not when the files-to-touch list grows mid-implementation.

### 1.5a. Build the files-to-touch list

List every file you would create or modify to satisfy this slice's tasks. Include:

- Files named in the plan's "Changes Required" / phase blocks for this slice.
- Files implied by those changes (imports, type definitions, fixtures, snapshot updates).
- New files you would need to create.

Do **not** include files you "might also touch" — only files the slice's tasks plainly require.

### 1.5b. Project LoC per file

For each file in the list:

- **Plan provides code in this slice's tasks**: count the lines of the provided code block.
- **No code in plan, file exists**: estimate the diff size from the task description; reference similar implementations in the codebase if needed.
- **New file, no code in plan**: estimate from the closest analogue (similar new files in this codebase).

Sum the per-file estimates. Call this the **projection** (M).

### 1.5c. Read the threshold (T)

- **Sliced plan, well-formed cell**: Find this slice's row in the `## Slices` summary table. Parse the `Est. LoC` cell (format `~N` where N is a positive integer). Set **T = 2 × N**.
- **Sliced plan, absent or unparseable cell**: if the cell is missing, the row is absent, or the value cannot be parsed as `~<integer>`, announce a one-line warning ("Couldn't parse Est. LoC for slice [N] — using fallback threshold 400 LoC") and set **T = 400**.
- **Non-sliced plan**: set **T = 400** (2× the existing post-slice 200-LoC warning at `commands/ba/execute.md:312` — keep these in sync if that threshold changes).

### 1.5d. Compare and act

- **If M < T**: announce a one-line summary ("Pre-slice scope check: projected ~[M] LoC vs Est. ~[N] (threshold [T]). Proceeding.") and continue to Step 2.
- **If M ≥ T**: pause via Step 4 Deviation Handling using the protocol below.

### 1.5e. Pause flow

Surface the contradiction via the standard Expected/Found/Why block. Populate it so the **binding-scope rule** is visible to the user:

```
**Deviation detected:**
- **Expected**: ~[N] LoC (slice Est. LoC). [If the slice's AC names more surfaces than the LoC budgets, add: "Acceptance criteria mention [X] surfaces; LoC estimate implies [Y]."]
- **Found**: Projected ~[M] LoC across [file count] files: [short list].
- **Why**: Scope: projected M ≥ 2× estimate. When AC and LoC disagree, **LoC is the binding scope signal** — surface the contradiction; do not silently implement both.
```

Then use **AskUserQuestion** with three options:

1. **Accept and continue** — Proceed with the projected scope, record the override.
2. **Update the plan** — Modify the plan to match reality, then re-project (see 1.5f).
3. **Pause execution** — Stop here.

**Record** each fire in the plan's `## Deviations` section (create the section if missing). Write the entry **before** the Pause returns control:

```markdown
### Scope tripwire: Slice [N] — projected M ≥ 2× estimate
- **Expected**: ~[N] LoC (slice Est. LoC)
- **Found**: ~[M] LoC projected across [file count] files
- **Why**: [reason — including AC contradiction if applicable]
- **Resolution**: [accepted / plan updated / paused]
```

If the same slice triggers multiple times (re-projection after an Update did not clear), append `(round 2)`, `(round 3)`, etc. to the heading so each round is visible in the audit trail.

### 1.5f. Re-projection after "Update the plan"

When the user picks "Update the plan", surface an explicit sync gate via **AskUserQuestion** ("Let me know when the edit is done — pick **Re-project** once the plan reflects the new scope") with two options: **Re-project** and **Pause execution**. Once the user picks Re-project:

1. Re-read the slice's `Est. LoC` row from the (now updated) `## Slices` table.
2. Re-build the files-to-touch list and re-project M.
3. Re-evaluate against the new T = 2 × new N.
4. If M < T: announce "Re-projection clears the new threshold. Proceeding." and continue to Step 2.
5. If M ≥ T: re-enter the pause flow (1.5e). Each round writes its own subsection under `## Deviations` with `(round 2)`, `(round 3)`, etc. appended to the heading, so the audit trail shows the spiral, not just the final state.

---
```

### `commands/ba/execute.md` — add to `## Important Guidelines` (current lines 359-369)

Insert this bullet immediately after the existing `**Report deviations immediately.**` line (the natural sibling — the tripwire is a special-case deviation):

```markdown
- **Pre-slice scope check is binding** (Step 1.5). LoC is the scope signal when AC and LoC conflict — surface it, don't implement both.
```

### `README.md` — add to the `/ba:execute` behavior list (currently lines 144-149)

Insert this bullet between the existing `**Deviation handling**` bullet and the `**Slice-aware execution**` bullet (it bridges the two):

```markdown
- **Pre-slice scope check** — projects files-to-touch and LoC before coding; pauses via deviation handling when projection exceeds the slice's `Est. LoC` threshold.
```

### `.claude-plugin/plugin.json` — version bump

```json
{
  "version": "0.17.0"
}
```

Change `0.16.1` → `0.17.0` (new feature, minor bump).

## Sources

- **Origin brainstorm**: `docs/brainstorms/2026-05-18-ba-execute-scope-tripwire-brainstorm.md` — carried forward: trigger location (between slice resolution and Step 4), trigger condition (2× `Est. LoC`), gate behavior (reuse Step 4), no new agents/schema, binding-scope rule.
- **Reused Step 4 flow**: `commands/ba/execute.md:232-263`.
- **`Est. LoC` schema**: `commands/ba/slice.md:130-137` (`~N` format in `## Slices` table).
- **Existing post-slice 200-LoC warning**: `commands/ba/execute.md:312` (the safety net Step 1.5 explicitly does not replace).
- **Slice marker shape**: `commands/ba/slice.md:140-152`.
- **Versioning convention**: `CLAUDE.md` ("Bump `version` in `.claude-plugin/plugin.json` for every release").
- **README touchpoint**: `README.md:139-149` (the `/ba:execute` behavior bullets).

## Convention Compliance

Convention-checker run 2026-05-18: **0 violations, 1 non-blocking warning (resolved), 14 aligned, 1 justified override.**

- [x] Filename pattern (`YYYY-MM-DD-<type>-<descriptive-name>-plan.md`) — aligned.
- [x] YAML frontmatter fields (title, type, status, date, origin, detail_level, iteration_count, tags) — aligned.
- [x] MINIMAL template section order (description → AC → Not Doing → Behaviors to Test → Context → MVP → Sources) — aligned.
- [x] `*(optional)*` marker on `## Behaviors to Test` heading — resolved by the warning fix.
- [x] Origin brainstorm cross-reference (frontmatter `origin:`, inline pointer, Sources block) — aligned.
- [x] Brainstorm decisions carried forward (trigger location, 2× threshold, reuse Step 4, no new agents/schema, binding-scope rule) — aligned.
- [x] Open-for-plan-time brainstorm questions all answered in AC + MVP — aligned.
- [x] Command prefix `ba:` — aligned.
- [x] No new agent files — aligned (explicit AC; no entries added to `agents/`).
- [x] Version bump (0.16.1 → 0.17.0) — aligned (in AC and MVP).
- [x] README touchpoint when a command changes — aligned (one new bullet planned).
- [x] Planning-commands-write-no-code — N/A; this plan modifies an execution command.
- [x] Exact file paths and code (no placeholders) — aligned (every path and line range concrete and verified).
- [x] `## What We're NOT Doing` present — aligned (lifts brainstorm Scope Boundaries).
- [x] Sources section with origin + file:line refs — aligned.
- [x] Detail level appropriateness (3 files, MINIMAL) — aligned with `commands/ba/plan.md` guidance.
- [x] **Justified override**: no `## Locked Design` / `## Rejected Designs` sections — text-only change with no new module or public interface, so design-it-twice mode does not apply (carries over the same justification accepted on the brainstorm).

## Deviations

### Task: Insert Step 1.5 — stale line reference
- **Expected**: MVP text in Step 1.5c references `commands/ba/execute.md:312` for the post-slice 200-LoC warning.
- **Found**: Inserting Step 1.5 shifts that warning to line 394; verbatim insertion leaves a misleading pointer.
- **Why**: The plan was authored before the insertion it prescribes; the embedded line number is invalidated by the very edit it lives in.
- **Resolution**: Plan updated — replaced the line-number reference with a symbolic pointer ("the post-slice 200-LoC warning in Step 5's Slice Completion"), eliminating future drift.
