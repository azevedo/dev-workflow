---
title: "feat: Add /ba:execute command for plan implementation"
type: feat
status: completed
date: 2026-03-14
origin: docs/brainstorms/2026-03-14-ba-execute-command-brainstorm.md
detail_level: standard
tags: [execute, command, implementation, workflow]
---

# feat: Add /ba:execute Command — Implementation Plan

## Overview

Add the `/ba:execute` command — the missing piece between planning (`/ba:plan`, `/ba:review-plan`) and post-implementation commands (future `/ba:validate`, `/ba:compound`). It takes a plan file and implements it systematically: code changes, continuous testing, progress tracking via plan checkboxes, deviation reporting, and atomic commits at logical boundaries.

V1 implements continuous execution mode with phase gates. Batch mode and subagent-driven mode are deferred to V3 (see brainstorm: `docs/brainstorms/2026-03-14-ba-execute-command-brainstorm.md`).

## Current State

- Three existing commands: `commands/ba/brainstorm.md` (285 lines), `commands/ba/plan.md` (~470 lines), `commands/ba/review-plan.md` (138 lines)
- All follow identical structural patterns: YAML frontmatter, `#$ARGUMENTS` capture, auto-detection, numbered steps, `AskUserQuestion` handoff menus
- Plan auto-detection proven in `commands/ba/review-plan.md:19-26`
- Checkbox progress tracking (`[ ]` → `[x]`) used extensively in plan templates (`commands/ba/plan.md:198-199, 268, 271`)
- CLAUDE.md convention "Commands must never write code" needs refinement to distinguish planning vs execution commands (see brainstorm: key decision on convention refinement)
- Plugin version: `0.1.0` (`.claude-plugin/plugin.json:3`)
- Reference implementation: `compound-engineering-plugin/plugins/compound-engineering/commands/ce/work.md` (execution loop, checkbox updates, commit protocol, system-wide check)

## What We're NOT Doing

(Carried forward from brainstorm scope boundaries)

- **No batch mode** — deferred to V3
- **No subagent-driven mode** — deferred to V3
- **No parallel/swarm execution** — deferred to V4
- **No PR creation built-in** — offered as a completion menu option, but separate from core execution
- **No knowledge capture** — future `/ba:compound` command
- **No formal handoff documents** — plan checkboxes provide resume; formal handoff is future `/ba:handoff`
- **No review agent dispatch** — future `/ba:review` command
- **No worktree management** — offer branch creation, don't manage worktrees
- **No convention-checker during execution** — tests and linting are the code quality gates (plan already went through convention-checking)
- **No new agents for V1** — main agent handles all work

## Proposed Solution

A single comprehensive command file `commands/ba/execute.md` (~300-350 lines) following established plugin patterns. This matches the brainstorm's chosen structure (see brainstorm: "Structure chosen: Single comprehensive command file").

The command has 6 phases:
1. **Locate & parse plan** — auto-detect or accept path, extract detail level and tasks, detect resume state
2. **Initialize** — branch check, resume validation, test discovery
3. **Execution loop** — per-task: announce → implement → test → self-check → update checkbox → commit decision
4. **Phase gates** — COMPREHENSIVE plans only: automated verification + manual verification pause
5. **Deviation handling** — Expected/Found/Why format, persist in plan file, ask user
6. **Completion** — fresh verification, summary, next-steps menu

Supporting changes: CLAUDE.md convention refinement, plugin.json version bump at release.

### Key Design Decisions Resolved

These address critical gaps identified during spec-flow analysis:

**Task granularity per detail level:**
- MINIMAL: Each acceptance criterion checkbox is a task. MVP code section is implementation reference.
- STANDARD: Each file block under "Changes Required" is a task. Success criteria validated after all file changes in a section.
- COMPREHENSIVE: Each file block within a phase is a task. Phase gates at phase boundaries.

**Execution loop sequence:** announce → implement → test → self-check (internal) → update checkbox → commit at boundary. Checkbox updated AFTER tests pass but BEFORE commit, so interrupted sessions may have a checked item without a commit — but the resume validation (run tests at start) catches this.

**Test failure ceiling:** Max 3 fix attempts, then ask user (show error / skip as deviation / pause execution). Prevents infinite loops.

**Deviation persistence:** Append `## Deviations` section at bottom of plan file. Each deviation recorded with Expected/Found/Why/Resolution. Survives session boundaries for resume.

**Completion menu (V1):** Create MR/PR, review changes, continue working, done. VCS-agnostic — detect platform from git remote (GitHub/GitLab) and discover available MR/PR tools (skills, `gh`, `glab`). The brainstorm listed "capture learnings" and "create handoff" as completion options, but these conflict with V1 scope boundaries ("No knowledge capture", "No formal handoff documents"). Replaced with "Create MR/PR" and "Review changes" which are actionable in V1. Capture learnings and create handoff will arrive with `/ba:compound` and `/ba:handoff` respectively.

**Testing strategy — scope-aware, not brute-force:** After each task, run **targeted/affected tests** (e.g., test files related to changed code). Only run the full suite + lint at completion verification — and even then, offer to skip if the user relies on CI for full-suite/lint validation. The command must not assume a fast test suite.

**Fresh verification:** Run targeted tests (or full suite if user confirms), confirm all checkboxes `[x]`, display output as evidence. Offer to defer full suite + lint to CI if the user prefers.

**Commit boundaries:** MINIMAL = single commit after all criteria. STANDARD = one commit per "Changes Required" section. COMPREHENSIVE = one commit per completed phase. Also commit before risky changes or when >3 files changed uncommitted.

**Resume validation:** Run targeted tests once at start of resume to verify the foundation. If tests fail, report and ask user before proceeding. Trust `[x]` marks for task-level progress.

**Plan status lifecycle:** Update YAML frontmatter `status` field: `active` → `in-progress` (at start) → `completed` (at end).

**Branch naming:** Derive from plan filename. `2026-03-14-feat-add-auth-plan.md` → `feat/add-auth`.

**System-wide self-check:** Internal (silent). Only surfaces to user if a concern is found. Not a blocking gate.

**Fully-completed plans:** If all checkboxes are `[x]`, announce "This plan is already complete" and offer: re-verify, review changes, or done.

## Technical Considerations

- **Architecture**: Single command file, no new agents, no new directories. Follows proven command patterns.
- **Performance**: No subagent overhead. Targeted (not full-suite) tests per task keep execution fast. Full suite + lint deferred to completion or CI.
- **Interruption safety**: Checkboxes + commits mean any interruption loses at most one task's work. Resume picks up from last checkbox.
- **Plan format coupling**: The command must parse 3 plan templates (MINIMAL, STANDARD, COMPREHENSIVE). If plan templates change in the future, execute.md must be updated to match.

## System-Wide Impact

- **Interaction graph**: The execute command reads plan files (produced by `/ba:plan`), updates them in-place (checkboxes, status, deviations section), and creates git commits. No callbacks or observers.
- **Error propagation**: Test failures are the primary error path — handled with 3-attempt ceiling then user escalation. Git failures (pre-commit hooks, merge conflicts) surface directly to user.
- **State lifecycle risks**: Partial execution is safe — checkboxes track progress, commits are atomic. The only risk is a checked item without a commit (session interrupted between checkbox update and commit), which resume validation catches.
- **Convention impact**: CLAUDE.md update distinguishes planning from execution commands. This is a convention refinement, not a violation — the convention-checker agent already validated this approach during brainstorming (see brainstorm: Convention Compliance section).

## Implementation Approach

### Changes Required

**File**: `commands/ba/execute.md` (new file, ~300-350 lines)

````markdown
---
name: ba:execute
description: Execute an approved implementation plan — implement changes, test continuously, track progress
argument-hint: "[path to plan file, or leave empty to auto-detect latest]"
---

# Execute an Implementation Plan

Take a plan produced by `/ba:plan` and implement it systematically: make code changes, run tests, track progress via plan checkboxes, handle deviations, and commit at logical boundaries.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

### Locate the Plan

**If a path was provided above**, read it directly.

**If no path was provided**, auto-detect the most recent actionable plan:

```bash
ls -t docs/plans/*.md 2>/dev/null | head -5
```

From the results, read each plan's YAML frontmatter. Prefer plans with `status: active` or `status: in-progress`. Skip plans with `status: completed`.

If found, announce: "Found plan: `[filename]`. Executing this one."
If not found, ask the user: "No actionable plans found in `docs/plans/`. Which file should I execute? Or run `/ba:plan` to create one."

### Read & Validate the Plan

Read the plan file thoroughly. Extract:

1. **Detail level** from YAML frontmatter `detail_level` field. If missing, infer:
   - Has "Implementation Phases" sections → COMPREHENSIVE
   - Has "Changes Required" sections → STANDARD
   - Otherwise → MINIMAL

2. **Resume state**: Scan for existing `[x]` marks in implementation sections (acceptance criteria, changes required, phase tasks). If found, this is a resume.

3. **Task list**: Extract the discrete executable tasks based on detail level:
   - **MINIMAL**: Each acceptance criterion checkbox is a task. The "MVP" code section is the implementation reference.
   - **STANDARD**: Each file block under "Changes Required" is a task. Success criteria are validated after all file changes in a section complete.
   - **COMPREHENSIVE**: Each file block within a phase is a task. Phase gates occur at phase boundaries.

4. **Already complete**: If ALL checkboxes are `[x]`, announce "This plan is already fully complete." Use **AskUserQuestion** with options: Re-verify (run tests to confirm), Review changes (`git diff` against base), Done.

---

## Step 1: Initialize

### Branch Check

Check the current git branch:

```bash
git branch --show-current
```

- **If on `main` or `master`**: Use **AskUserQuestion** to offer creating a feature branch. Suggest a name derived from the plan filename (e.g., `2026-03-14-feat-add-auth-plan.md` → `feat/add-auth`). If the user declines, confirm they want to work on main and proceed.
- **If on another branch**: Announce the branch name and proceed. If the branch name seems unrelated to the plan, mention it and ask the user to confirm.
- **If detached HEAD**: Warn the user and suggest creating a branch before proceeding.

### Resume Detection

**If resuming (existing `[x]` marks found)**:
1. Announce: "Resuming execution. [N] of [M] tasks already completed."
2. Check for uncommitted changes in the working tree. If found, ask the user whether to commit them, stash them, or continue with them.
3. Run the test suite once to verify the codebase is in a passing state.
4. If tests pass: proceed to first unchecked task.
5. If tests fail: report failures and ask the user whether to (a) fix the failures first, (b) proceed anyway, or (c) abort.

**If fresh start**:
1. Update plan YAML frontmatter: `status: in-progress`
2. Announce: "Starting execution. [M] tasks to complete."

### Test Discovery

Determine the project's test command. Check in order:

1. **CLAUDE.md** — Look for explicit test/lint commands
2. **package.json** — `scripts.test`, `scripts.lint`
3. **Makefile** — `test` target
4. **pyproject.toml / setup.cfg** — Python test configuration
5. **Cargo.toml** — Rust (`cargo test`)
6. **go.mod** — Go (`go test ./...`)
7. **mix.exs** — Elixir (`mix test`)

If multiple test commands exist, prefer the one in CLAUDE.md. If none found, ask the user: "What command runs the tests for this project?"

Also discover a lint command using the same approach. If found, lint runs alongside tests.

---

## Step 2: Execution Loop

For each unchecked task in order:

### 2a. Announce

Brief announcement: "**Task [N]/[M]**: [description] in `[file path]`"

For COMPREHENSIVE plans, also announce phase transitions: "**--- Phase [N]: [Phase Title] ---**"

### 2b. Implement

Read the plan's code for this task and implement it. Follow the plan exactly — it has already been reviewed and approved.

If the plan provides actual code, use it. If the plan describes the change without full code, implement it following existing codebase patterns.

### 2c. Test

Run **targeted tests** — tests related to the files changed in this task. Prefer scoped test commands (e.g., `pytest path/to/test_file.py`, `npm test -- --testPathPattern=module`) over the full suite. If scoped testing isn't possible, run the full test command.

Do NOT run linting or type-checking after every task — defer those to completion verification or CI.

**On pass**: Continue to 2d.

**On failure**:
1. Analyze the failure. Attempt to fix (max 3 attempts).
2. If fixed: continue to 2d.
3. If still failing after 3 attempts, use **AskUserQuestion**:
   - "Tests failing after implementing [task description]. What should I do?"
   - Options:
     1. **Show me the error** — Display full test output for the user to diagnose
     2. **Skip this task** — Mark as deviation and move to next task
     3. **Pause execution** — Stop here, keep progress, user will fix manually and resume later

### 2d. System-Wide Self-Check

Silently review these 5 questions after each task:

1. **What fires?** — What callbacks, middleware, observers, or event handlers does this change trigger?
2. **Real chain tested?** — Did the tests exercise the actual chain, not just the unit in isolation?
3. **Orphaned state?** — Can partial failure leave inconsistent state (DB rows, cache, files)?
4. **Other interfaces?** — Are there other interfaces that expose equivalent functionality and need updating?
5. **Error alignment?** — Do error types flow correctly across layer boundaries?

If a concern is found: surface it as a brief note to the user. Do NOT block execution unless the concern is critical (e.g., data loss risk).

### 2e. Update Checkpoint

Update the plan file: change the completed task's `[ ]` to `[x]` using the Edit tool.

### 2f. Commit Decision

Evaluate whether to commit now based on detail level:

- **MINIMAL**: Commit after all acceptance criteria pass (single commit at end).
- **STANDARD**: Commit after completing each logical group of file changes (typically each "Changes Required" section).
- **COMPREHENSIVE**: Commit after each completed phase (before the phase gate).

Also commit immediately if:
- About to start a risky or experimental change
- Context switch between unrelated areas of code
- Significant chunk of work done (>3 files changed uncommitted)

**Commit format**:
```
<type>(<scope>): <description>

Plan: docs/plans/<filename>
```

Where `<type>` matches the plan's type (feat, fix, refactor). The scope is the primary affected area.

---

## Step 3: Phase Gates (COMPREHENSIVE Plans Only)

At each phase boundary:

1. Run all **automated** success criteria for the completed phase. Report results.
2. If automated criteria pass, present the **manual** verification items to the user via **AskUserQuestion**:
   - "Phase [N] automated checks passed. Please verify these manual items:"
   - List each manual criterion
   - Options:
     1. **All verified, continue** — Proceed to next phase
     2. **Issue found** — Describe the issue, pause execution
     3. **Skip manual checks** — Proceed without manual verification

3. Only proceed to the next phase after user confirmation.

---

## Step 4: Deviation Handling

When implementation diverges from the plan (different file path, changed API, missing dependency, etc.):

1. **Report** in Expected/Found/Why format:

   ```
   **Deviation detected:**
   - **Expected**: [what the plan said]
   - **Found**: [what actually happened]
   - **Why**: [reason for the deviation]
   ```

2. **Ask** the user via **AskUserQuestion**:
   - "Deviation from plan detected. How should I proceed?"
   - Options:
     1. **Accept and continue** — Proceed with the deviation, record it
     2. **Update the plan** — Modify the plan to match reality, then continue
     3. **Pause execution** — Stop and let the user decide

3. **Record** the deviation in the plan file. Append to a `## Deviations` section at the bottom of the plan (create the section if it doesn't exist):

   ```markdown
   ## Deviations

   ### Task [N]: [description]
   - **Expected**: [what the plan said]
   - **Found**: [what actually happened]
   - **Why**: [reason]
   - **Resolution**: [accepted / plan updated / ...]
   ```

---

## Step 5: Completion

When all tasks are done:

### Fresh Verification

1. Confirm all plan checkboxes are `[x]`.
2. Run targeted tests for all changed files.
3. Use **AskUserQuestion** to ask about full verification:
   - "All tasks complete. How should I verify?"
   - Options:
     1. **Run full test suite + lint now** — Complete local verification before finishing
     2. **Targeted tests only** — Already ran per-task tests, defer full suite + lint to CI
     3. **Skip verification** — Trust the per-task tests, move to summary
4. Display test output as evidence of completion.

If verification fails, report and let the user decide before claiming completion.

### Update Plan Status

Update the plan YAML frontmatter: `status: completed`

### Summary

Display:

```
Execution complete!

Plan: docs/plans/[filename]
Tasks: [N]/[M] completed
Commits: [N] commits made
Deviations: [N] recorded
Test suite: passing ✓

Commits made:
- [hash] [message]
- [hash] [message]
```

### Next Steps

Use **AskUserQuestion**:

**Question:** "All tasks complete. What would you like to do next?"

**Options:**
1. **Create MR/PR** — Generate a merge/pull request for the implemented changes
2. **Review changes** — Show `git diff` against the base branch
3. **Continue working** — Open-ended mode for additional changes beyond the plan
4. **Done** — Wrap up

**Based on selection:**
- **Create MR/PR** → Detect VCS platform from git remote (GitHub → `gh pr create`, GitLab → `glab mr create`). Also check for available MR/PR skills or custom commands in the environment. If unclear, ask the user which tool to use. Use the plan title and overview + completion summary as the description.
- **Review changes** → Show the diff, then return to options.
- **Continue working** → Ask what they want to work on. Exit structured execution flow.
- **Done** → Display final summary and exit.

---

## Important Guidelines

- **The plan is the authority.** Follow it. Don't add features, refactor surrounding code, or "improve" things beyond what the plan specifies.
- **Track progress in the plan file.** Every completed task gets `[x]`. This is how resume works.
- **Test after every task — targeted, not full suite.** Run tests related to changed files. Defer full suite + lint to completion or CI.
- **Report deviations immediately.** Don't silently work around plan/reality mismatches.
- **Commit at logical boundaries.** Each commit should pass tests and represent a coherent unit of work.
- **Evidence-based completion.** Never claim "done" without showing passing tests.
- **No convention-checker during execution.** Tests and linting are the quality gates for code.
- **Respect phase gates.** For COMPREHENSIVE plans, never skip manual verification between phases without user consent.
- **TDD follows the plan.** No TDD machinery baked into the command. If the plan specifies test-first steps, follow them. If not, implement and test normally. The plan is the authority on testing approach.
````

---

**File**: `CLAUDE.md` (edit — distinguish planning vs execution commands)

Current `## Commands` section:

```markdown
## Commands

- `/ba:brainstorm [idea]` — Explore requirements and approaches before planning
- `/ba:plan [feature]` — Create implementation plans from feature descriptions
- `/ba:review-plan [path]` — Discovery-based plan review with available agents and skills
```

Replace with:

```markdown
## Commands

### Planning Commands (research and document — never write code)

- `/ba:brainstorm [idea]` — Explore requirements and approaches before planning
- `/ba:plan [feature]` — Create implementation plans from feature descriptions
- `/ba:review-plan [path]` — Discovery-based plan review with available agents and skills

### Execution Commands (implement approved plans)

- `/ba:execute [plan]` — Execute an approved implementation plan
```

Current `## Conventions` section includes:

```markdown
- Commands must never write code — only research and document
```

Replace with:

```markdown
- Planning commands (brainstorm, plan, review-plan) must never write code — only research and document
- Execution commands (execute) implement approved plans — the plan is the authority on what to build
```

---

**File**: `.claude-plugin/plugin.json` (edit at release — version bump + keyword)

Current version: `0.1.0`. Bump to `0.2.0` (new feature: execute command).

Add `"execute"` to keywords array.

**Note:** Per CLAUDE.md convention, version bump happens at release time, not during implementation.

---

### Success Criteria

#### Automated:
- [x] `ls commands/ba/execute.md` — file exists
- [x] `head -5 commands/ba/execute.md` — has correct YAML frontmatter (name: ba:execute, description, argument-hint)
- [x] `grep -c 'AskUserQuestion' commands/ba/execute.md` — uses AskUserQuestion for user interactions (7 occurrences)
- [x] `grep '#\$ARGUMENTS' commands/ba/execute.md` — captures arguments in expected pattern
- [x] `grep 'status: in-progress' commands/ba/execute.md` — updates plan status during execution
- [x] `grep 'status: completed' commands/ba/execute.md` — updates plan status at completion
- [x] `grep '## Deviations' commands/ba/execute.md` — persists deviations in plan file
- [x] `grep -c '\[ \].*→.*\[x\]\|checkbox' commands/ba/execute.md` — references checkbox update pattern (5 matches)
- [x] `grep 'Planning Commands' CLAUDE.md` — CLAUDE.md updated with command categories
- [x] `grep 'Execution Commands' CLAUDE.md` — CLAUDE.md has execution commands section
- [x] `grep 'ba:execute' CLAUDE.md` — execute command listed in CLAUDE.md

#### Manual:
- [ ] Command file reads naturally and follows the structural patterns of existing commands (frontmatter, argument capture, numbered steps, guidelines)
- [ ] Execute.md is ~300-350 lines (matching brainstorm estimate for comprehensive single-file command)
- [ ] The execution loop (Step 2) clearly defines the per-task sequence: announce → implement → test → self-check → checkpoint → commit
- [ ] All three plan detail levels (MINIMAL, STANDARD, COMPREHENSIVE) are addressed with appropriate task granularity and commit boundaries
- [ ] Phase gates (Step 3) correctly separate automated from manual verification
- [ ] Deviation handling (Step 4) includes Expected/Found/Why format and plan file persistence
- [ ] Completion (Step 5) includes fresh verification with evidence before claiming done
- [ ] CLAUDE.md convention update cleanly distinguishes planning from execution commands without breaking the convention-checker's ability to validate planning commands

## Dependencies & Risks

**Dependencies:**
- Plan files produced by `/ba:plan` — execute must correctly parse all three templates (MINIMAL, STANDARD, COMPREHENSIVE). If plan templates change, execute must be updated to match.
- Test infrastructure of target projects — test discovery relies on conventional locations (CLAUDE.md, package.json, Makefile, etc.). Projects with non-standard test setups require user input.

**Risks:**
- **Plan format drift**: If `/ba:plan` templates evolve, execute's parsing logic may break. Mitigation: task granularity rules are documented in execute.md and reference the plan templates explicitly.
- **Checkpoint-commit ordering**: A session interrupted between checkbox update and commit leaves a checked item without a commit. Mitigation: resume validation runs tests at start to verify foundation.
- **Test runner variability**: Different projects have wildly different test commands and behaviors. Mitigation: discovery algorithm with user fallback.

## Convention Compliance

- [x] **ba: prefix** — aligned (`ba:execute`)
- [x] **Agent names: lowercase-with-hyphens** — aligned (no new agents)
- [x] **YAML frontmatter required** — aligned (execute.md has frontmatter matching existing commands)
- [x] **Version bump in plugin.json** — aligned (noted as release-time step)
- [x] **Plan artifact path** — aligned (`docs/plans/YYYY-MM-DD-type-name-plan.md`)
- [x] **Command structural patterns** — aligned (frontmatter, `#$ARGUMENTS`, numbered steps, `AskUserQuestion` handoff)
- [x] **`#$ARGUMENTS` tag wrapper** — aligned (uses `<plan_path>` matching review-plan)
- [x] **Commands must never write code** — justified override: CLAUDE.md updated to distinguish planning commands (never write code) from execution commands (implement approved plans). Convention refinement, not violation. (see brainstorm: Convention Compliance)
- [x] **Convention-compliance check for source code** — justified override: source code follows the plan, which already passed convention-checking. Tests and linting are the quality gates for implementation output. (see brainstorm: key decision on convention-compliance)
- [x] **Convention-compliance check for plan file edits** — justified override: plan file modifications during execution (checkbox updates `[ ]`→`[x]`, status field changes, appending Deviations section) are mechanical/structural progress-tracking updates that do not alter design decisions. Re-running convention-checker after each checkbox flip would add overhead with no design benefit. The convention targets new or significantly revised artifacts, not progress annotations.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-03-14-ba-execute-command-brainstorm.md` — Key decisions carried forward: single comprehensive command file (~300-350 lines), continuous execution with phase gates, plan file as progress tracker, convention refinement for CLAUDE.md

### Internal References
- Command structure pattern: `commands/ba/brainstorm.md:1-5` (frontmatter), `commands/ba/plan.md:13` (argument capture), `commands/ba/review-plan.md:19-26` (plan auto-detection)
- Checkbox tracking: `commands/ba/plan.md:198-199, 268, 271` (plan template checkboxes)
- Handoff/completion pattern: `commands/ba/plan.md:455-476` (next-steps menu)
- Reference execution implementation: `compound-engineering-plugin/plugins/compound-engineering/commands/ce/work.md` (execution loop, commit protocol, system-wide check)
- Plugin metadata: `.claude-plugin/plugin.json:3` (current version 0.1.0)
