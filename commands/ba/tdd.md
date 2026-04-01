---
name: ba:tdd
description: Execute an approved plan using test-driven development — red-green-refactor with per-cycle validation
argument-hint: "[path to plan file, or leave empty to auto-detect latest]"
---

# TDD Execution

Execute a plan using test-driven development discipline: for each behavior, write one failing test (RED), implement minimally to pass (GREEN), validate the cycle, repeat. After all behaviors are green, a refactor phase applies Ousterhout deep-module principles.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

### Locate the Plan

**If a path was provided above**, read it directly.

**If no path was provided**, auto-detect the most recent actionable plan:

```bash
ls -t docs/plans/*.md 2>/dev/null | head -5
```

From the results, read each plan's YAML frontmatter. Prefer plans with `status: active` or `status: in-progress`. Skip plans with `status: completed`.

If found, announce: "Found plan: `[filename]`. Executing with TDD."
If not found, ask the user: "No actionable plans found in `docs/plans/`. Which file should I execute? Or run `/ba:plan` to create one."

### Read & Validate the Plan

Read the plan file thoroughly. Extract:

1. **Behaviors to test**: Look for a "Behaviors to Test" section. This is the primary source.
2. **Fallback to acceptance criteria**: If no "Behaviors to Test" section, scan for acceptance criteria checkboxes and convert them to testable behaviors. After conversion, validate specificity: each behavior should be concrete enough to write a single test (e.g., "login endpoint returns 200 with valid credentials" not "user can authenticate"). Flag vague behaviors and suggest more specific alternatives before presenting to the user.
3. **Fallback to interactive definition**: If neither section exists, ask the user to define behaviors interactively via AskUserQuestion.

Present the extracted behavior list to the user:

"Found [N] behaviors to test:
1. [behavior 1]
2. [behavior 2]
..."

Use **AskUserQuestion**: "Proceed in this order, or reorder?"
- **Proceed** — start the TDD loop as listed
- **Reorder** — ask the user for the new order
- **Edit** — let the user add, remove, or modify behaviors

---

## Step 1: Initialize

### Branch Check

Check the current git branch:

```bash
git branch --show-current
```

- **If on `main` or `master`**: Use **AskUserQuestion** to offer creating a feature branch. Suggest a name derived from the plan filename.
- **If on another branch**: Announce the branch name and proceed.
- **If detached HEAD**: Warn the user and suggest creating a branch.

### Resume Detection

**If resuming (existing `[x]` marks found in Behaviors to Test or acceptance criteria)**:
1. Announce: "Resuming TDD execution. [N] of [M] behaviors already completed."
2. Check for uncommitted changes. If found, ask whether to commit, stash, or continue.
3. Run targeted tests for already-completed behaviors to verify green state. (Full suite is deferred to completion — see Step 4 — because many project suites are too slow to run on every resume.)
4. If tests pass: proceed to first unchecked behavior.
5. If tests fail: report and ask whether to fix, proceed anyway, or abort.

**If fresh start**:
1. Update plan YAML frontmatter: `status: in-progress`
2. Announce: "Starting TDD execution. [M] behaviors to implement."

### Test Discovery

Determine the project's test and lint commands. Check in order:

1. **CLAUDE.md** — Look for explicit test/lint commands
2. **package.json** — `scripts.test`, `scripts.lint`
3. **Makefile** — `test`, `lint` targets
4. **pyproject.toml / setup.cfg** — Python test/lint configuration
5. **Cargo.toml** — Rust (`cargo test`, `cargo clippy`)
6. **go.mod** — Go (`go test ./...`, `golangci-lint run`)
7. **mix.exs** — Elixir (`mix test`, `mix credo`)

If no test command found, ask: "What command runs the tests for this project?"

Also discover a lint command using the same approach. If found, lint runs at completion (Step 4) alongside the test suite.

---

## Step 2: TDD Loop

For each unchecked behavior in order:

### 2a. Announce

"**Behavior [N]/[M]**: [behavior description]"

### 2b. RED Phase — Write Failing Test

Write a test that describes the behavior. The test should:
- Use the public interface of the code under test
- Assert on behavior (what), not implementation (how)
- Be named descriptively after the behavior
- Follow existing test file organization patterns in the project

Place the test in the appropriate test file following the project's existing conventions. If no convention is obvious, ask the user.

### 2c. Confirm RED

Run the new test:

```bash
[targeted test command for the new test file]
```

**If the test fails (expected — RED confirmed)**:
- Announce: "RED confirmed — test fails as expected."
- **Capture test file baseline**: Record the content hash (or snapshot) of the test file(s) modified in 2b. This baseline is used for mutation detection in 2g.
- Proceed to 2d.

**If the test passes (unexpected — behavior already exists)**:
- Announce: "Test passes immediately — behavior appears already satisfied."
- Use **AskUserQuestion**:
  1. **Skip this behavior** — mark as complete, move to next
  2. **Write a more specific test** — return to 2b with a more targeted test
  3. **Accept existing coverage** — mark as complete, no implementation needed

**If the test errors (syntax, import, configuration)**:
- This is not a valid RED state. Fix the test so it fails for the right reason (assertion failure, not error), then re-confirm.

### 2d. GREEN Phase — Minimal Implementation

Write the minimal code that makes the current test pass. "Minimal" means:
- Only add behavior that the test exercises
- No speculative code for future behaviors
- No defensive handling for untested paths
- No premature abstraction
- If the plan provides implementation code for this behavior, use it as guidance but keep it minimal

### 2e. Confirm GREEN

Run the current behavior's test:

```bash
[targeted test command for the test file]
```

**If the test passes (expected — GREEN confirmed)**:
- Announce: "GREEN confirmed — test passes."
- Proceed to 2f.

**If the test fails (unexpected)**:
1. Analyze the failure. Attempt to fix (max 3 attempts).
2. If fixed: proceed to 2f.
3. If still failing after 3 attempts, use **AskUserQuestion**:
   - "Test still failing after implementing [behavior]. What should I do?"
   - Options:
     1. **Show me the error** — Display full test output
     2. **Skip this behavior** — Mark as deviation, move to next
     3. **Pause execution** — Stop here, keep progress

### 2f. Regression Check

Run ALL accumulated behavior tests (all tests written so far in this TDD session, not just the current one):

```bash
[targeted test command covering all behavior test files so far]
```

**If all pass**: Proceed to 2g.

**If a prior test fails (regression)**:
- Announce: "Regression detected: test for behavior [earlier behavior] now fails after implementing [current behavior]."
- Attempt to fix (max 3 attempts, same as GREEN phase escalation).
- If fixed within 3 attempts: re-run all accumulated tests to confirm, then proceed to 2g.
- If still failing after 3 attempts, use **AskUserQuestion**:
  1. **Revert current implementation** — Undo GREEN phase changes, reconsider approach
  2. **Ask me** — User takes over to diagnose
  3. **Override and continue** — Accept the regression, proceed to next behavior

Regressions must be resolved before proceeding to the gate.

### 2g. Cycle Gate

Dispatch the `tdd-cycle-gate` agent to validate this red-to-green cycle:

- Task tdd-cycle-gate("Validate this TDD cycle.

Behavior: [behavior description]

Test diff (RED phase):
[diff of test file changes from 2b]

Implementation diff (GREEN phase):
[diff of implementation file changes from 2d]

Test file baseline (after RED): [content hash or relevant snapshot from 2c]
Current test file state (after GREEN): [current content hash]
Test file paths: [paths to test files for full context reading]

Validate against all 6 criteria. Return only violations.")

**If no violations**: Continue silently to 2h.

**If violations found**: Present each violation to the user via **AskUserQuestion**:
- "[Violation description from gate agent]"
- Options:
  1. **Fix and re-run cycle** — Return to the appropriate phase (RED or GREEN) and redo
  2. **Override and continue** — Accept the violation, proceed to next behavior
  3. **Abort execution** — Stop TDD loop, keep progress

### 2h. System-Wide Self-Check (at area transitions only)

Run this check when the next behavior switches to a different module or area of the codebase, OR after the final behavior completes (before the refactor phase). Skip it for consecutive behaviors within the same module.

Silently review these 5 questions (inherited from `/ba:execute`):

1. **What fires?** — What callbacks, middleware, observers, or event handlers does this change trigger?
2. **Real chain tested?** — Did the tests exercise the actual chain, not just the unit in isolation?
3. **Orphaned state?** — Can partial failure leave inconsistent state?
4. **Other interfaces?** — Are there other interfaces that expose equivalent functionality and need updating?
5. **Error alignment?** — Do error types flow correctly across layer boundaries?

If a concern is found: surface it as a brief note. Do NOT block unless critical (data loss risk).

### 2i. Update Checkpoint

Update the plan file: change the completed behavior's `[ ]` to `[x]` using the Edit tool.

### 2j. Commit Check (MANDATORY)

Evaluate using the same table as `/ba:execute`:

| Commit when... | Don't commit when... |
|----------------|---------------------|
| Behavior cycle complete (RED→GREEN→gate passed) | Mid-cycle (RED phase only, or GREEN not confirmed) |
| Tests pass + meaningful progress | Tests failing |
| >3 files changed since last commit | Trivially small change to same file as previous cycle |
| About to switch to a different area of the codebase | |

**Default**: commit after each behavior cycle. Consolidate only when multiple behaviors are trivially small and touch the same files.

**Commit workflow:**
```bash
git add <test files and implementation files from this cycle>
git commit -m "<type>(<scope>): <behavior description>

Red-green cycle [N]/[M]
Plan: docs/plans/<filename>"
```

**IMPORTANT**: Never commit at RED. Every commit must be a GREEN state where all accumulated tests pass.

---

## Step 3: Refactor Phase

After ALL behaviors are green:

### 3a. Announce & Offer Skip

"All [M] behaviors implemented and passing. Entering refactor phase."

Use **AskUserQuestion**:
1. **Run refactor-advisor** — Analyze implementation for deep-module improvements
2. **Skip refactoring** — Proceed directly to completion

If user skips, go to Step 4.

### 3b. Dispatch Refactor-Advisor

- Task refactor-advisor("Analyze these files for refactoring opportunities using Ousterhout deep-module principles.

Files changed during TDD:
[list of all files modified during the TDD loop]

Test files:
[list of all test files]

Behaviors implemented:
[list of all behaviors]

All tests are currently passing. Suggest refactoring improvements that keep tests green.")

### 3c. Present Suggestions

Present the refactor-advisor's suggestions to the user. For each suggestion:

Use **AskUserQuestion**:
- "[Suggestion from advisor: principle, location, current vs. suggested, impact]"
- Options:
  1. **Apply this suggestion** — Implement the refactoring
  2. **Skip this suggestion** — Move to next suggestion
  3. **Done refactoring** — Stop reviewing suggestions, proceed to completion

### 3d. Apply & Verify

For each accepted suggestion:
1. Apply the refactoring change
2. Run ALL behavior tests immediately:
   ```bash
   [targeted test command covering all behavior test files]
   ```
3. **If tests pass**: Announce success, continue to next suggestion
4. **If tests fail**: Revert the refactoring change using `git checkout -- <affected files>` scoped to only the files this suggestion modified. Announce "Refactoring broke tests — reverted. Moving to next suggestion."

### 3e. Commit Refactoring

After all selected suggestions are applied (or user says "done refactoring"):

```bash
git add <all refactored files>
git commit -m "refactor(<scope>): apply deep-module improvements

Post-TDD refactoring with Ousterhout principles
Plan: docs/plans/<filename>"
```

---

## Step 4: Completion

### Fresh Verification

1. Confirm all behavior checkboxes are `[x]` in the plan
2. Run targeted tests for all changed files
3. Use **AskUserQuestion**:
   - "All behaviors complete. How should I verify?"
   - Options:
     1. **Run full test suite + lint now** — Complete local verification
     2. **Targeted tests only** — Defer full suite to CI
     3. **Skip verification** — Trust the per-cycle tests

### Update Plan Status

Update the plan YAML frontmatter: `status: completed`

### Summary

```
TDD execution complete!

Plan: docs/plans/[filename]
Behaviors: [N]/[M] completed
Cycles: [N] red-green cycles
Gate violations: [N] found, [N] overridden
Refactoring: [N] suggestions applied
Commits: [N] commits made
Test suite: passing

Commits made:
- [hash] [message]
- [hash] [message]
```

### Next Steps

Use **AskUserQuestion**:

**Question:** "All behaviors complete. What would you like to do next?"

**Options:**
1. **Review code** — Run `/ba:review` for post-implementation code quality review
2. **Create MR/PR** — Generate a merge/pull request
3. **Review changes** — Show `git diff` against the base branch
4. **Continue working** — Open-ended mode for additional changes
5. **Done** — Wrap up

**Based on selection:**
- **Review code** → Invoke `/ba:review` directly.
- **Create MR/PR** → Detect VCS platform from git remote. Use the plan title and TDD summary as the description.
- **Review changes** → Show the diff, then return to options.
- **Continue working** → Ask what they want to work on. Exit structured execution flow.
- **Done** → Display final summary and exit.

---

## Important Guidelines

- **The plan is the authority on WHAT to build.** The TDD loop controls HOW — one behavior at a time, test-first.
- **RED means the test fails for the right reason.** A test that errors (syntax, import) is not RED — it is broken. Fix it first.
- **GREEN means minimal.** Only implement what the test demands. The refactor phase handles elegance.
- **Never refactor while RED.** Refactoring happens only after ALL behaviors are green, in the dedicated refactor phase.
- **The gate is a validator, not a blocker.** It reports violations; the user decides how to proceed.
- **Track progress in the plan file.** Every completed behavior gets `[x]`. This is how resume works.
- **Commit at GREEN, never at RED.** Every commit must pass all accumulated tests.
- **Evidence-based completion.** Never claim "done" without showing passing tests.
- **Mutation is the #1 LLM risk.** Watch for tests being weakened during the GREEN phase. The gate catches this, but stay vigilant.
