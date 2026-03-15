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
