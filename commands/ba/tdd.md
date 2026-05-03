---
name: ba:tdd
description: Execute an approved plan using test-driven development — red-green-refactor with per-cycle validation
argument-hint: "[path to plan file] [--slice N]"
---

# TDD Execution

Execute a plan using test-driven development discipline: for each behavior, write one failing test (RED), implement minimally to pass (GREEN), validate the cycle, repeat. After all behaviors are green, a refactor phase applies Ousterhout deep-module principles.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

### Parse Arguments

Check the argument string for recognized flags before interpreting the plan path:

- **`--slice N`**: Scan for the token `--slice` followed by the next whitespace-delimited token. Validate that token as a positive integer. If valid, extract the slice number and strip both tokens (`--slice` and `N`) from the argument string. If `--slice` is the last token with nothing after it, announce: "Missing slice number after `--slice`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop. If the token is zero, negative, a float, or non-numeric, announce: "Invalid slice number: `[raw token]`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop.
- **Everything else** after stripping flags: Treat as the plan file path.

**Note:** This flag-parsing pattern is shared across execution commands (ba:execute, ba:tdd) for slice support. Other commands continue to treat `#$ARGUMENTS` as a plain path or description.

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

4. **Sliced plan detection**: Check for `sliced: true` in YAML frontmatter.
   - **If sliced AND `--slice N` provided**: Validate 1 <= N <= `slice_count` from frontmatter. If N is out of range, announce: "Slice [N] does not exist. This plan has [slice_count] slices. Use `--slice 1` through `--slice [slice_count]`." and stop. Otherwise, check whether the plan has a "Behaviors to Test" section. If no such section exists, fall through to fallback behavior extraction (acceptance criteria, then interactive). If the section exists, find the `<!-- slice:N ... -->` marker within it. If the marker is not found, announce: "Slice [N] marker not found in the Behaviors to Test section. The plan may need re-slicing — run `/ba:slice` to fix." and stop. Extract only behaviors between this marker and the next slice marker (`<!-- slice:N+1 ... -->`) or the end of the Behaviors to Test section.
   - **If sliced AND no `--slice N`**: Scan the `## Slices` summary table for the first slice with Status `pending`. Use **AskUserQuestion**:
     - "This plan is sliced into [M] slices. Slice [X] ([name]) is next. What would you like to do?"
     - Options:
       1. **Execute slice [X] with TDD** -- Proceed with the next incomplete slice
       2. **Pick a different slice** -- Enter a slice number
     - If option 1 selected: proceed as if `--slice X` was provided. All subsequent references to `--slice N` apply with N = X.
     - If option 2 selected: ask the user to enter a slice number. Validate: 1 <= entered number <= slice_count. If invalid, re-prompt. If valid, proceed as if `--slice [entered number]` was provided. All subsequent references to `--slice N` apply with N = the entered number.
   - **If NOT sliced AND `--slice N` provided**: First check whether `<!-- slice:` markers exist in the file despite `sliced` being falsy. If markers found, warn: "Plan has slice markers but `sliced: true` is not set in frontmatter. Run `/ba:slice` to fix, or add `sliced: true` manually." and stop. If no markers, announce: "This plan is not sliced. Run `/ba:slice` first, or remove `--slice N` to execute the full plan." and stop.
   - **If NOT sliced**: Proceed with existing behavior (no change).

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

- **If on `main` or `master`**: Use **AskUserQuestion** to offer creating a feature branch. Suggest a name derived from the plan filename; if also executing a slice, suggest `<plan-branch>-slice-N` (e.g., `feat/add-auth-slice-1`) as the branch name.
- **If on another branch**: Announce the branch name and proceed.
- **If detached HEAD**: Warn the user and suggest creating a branch.
- **If executing a slice (`--slice N`)**: Branch from the current branch regardless of slice number. The user is responsible for ensuring prior slice changes are present in their working tree.

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

Update the plan file: change the completed behavior's `[ ]` to `[x]` in the "Behaviors to Test" section using the Edit tool.

**Note:** Implementation task checkboxes in "Changes Required" / "Implementation Phases" are NOT updated per-behavior. They are bulk-checked at slice or plan completion (see Step 4: Completion).

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

**Sliced execution commit format:**
```bash
git commit -m "<type>(<scope>): <behavior description>

Red-green cycle [N]/[M]
Plan: docs/plans/<filename>
Slice: [slice_num]/[slice_count]"
```

Where [slice_num] is the current slice number and [slice_count] is the total slice count from frontmatter.

**IMPORTANT**: Never commit at RED. Every commit must be a GREEN state where all accumulated tests pass.

---

## Step 3: Refactor Phase

After ALL behaviors are green:

### 3a. Announce & Offer Skip

"All [M] behaviors implemented and passing. Entering refactor phase."

Use **AskUserQuestion**:
1. **Run deep-module-reviewer** — Analyze implementation for deep-module improvements
2. **Skip refactoring** — Proceed directly to completion

If user skips, go to Step 4.

### 3b. Dispatch Deep-Module-Reviewer

- Task deep-module-reviewer("Review these files for deep-module design opportunities using Ousterhout principles.

Files changed during TDD:
[list of all files modified during the TDD loop]

Test files:
[list of all test files]

Behaviors implemented:
[list of all behaviors]

Report deep-module review findings using your canonical Must Address / Consider / Looks Good output format. Tests are currently passing — flag only opportunities that preserve the green test suite.

If executing a slice, only include files changed during this slice's TDD loop — do not suggest refactoring files outside the slice scope.")

After the deep-module-reviewer returns its report, print the findings inline. Do not present them via AskUserQuestion. Do not apply changes. Proceed directly to Step 4 — the user can refactor manually after reading the report if motivated.

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

### Bulk Task Completion

After confirming all behaviors and before updating plan status, bulk-mark implementation task checkboxes:

**If sliced execution (`--slice N`)**: Find all `[ ]` checkboxes in "Changes Required" or "Implementation Phases" between the current slice's `<!-- slice:N ... -->` marker and the next marker (or end of section). Change each to `[x]`.

**If non-sliced execution**: Find all `[ ]` checkboxes in the implementation sections and change each to `[x]`.

This ensures the plan file shows all work as complete regardless of whether ba:tdd or ba:execute was used.

### Slice Completion (Sliced Execution Only)

If this was a sliced execution (`--slice N`):

1. **Update slice status**: Edit the `## Slices` summary table in the plan -- change this slice's Status from `pending` to `done`. Target the specific table row by matching the full row pattern including the slice number (e.g., `| N | [name] | ... | pending |`), not just the word "pending".

2. **LoC check**: Count the lines of code changed in this slice (use `git diff --stat` against the commit SHA at the start of this slice's TDD loop — the HEAD before any changes from this slice — exclude test files). Slices target 150 LoC; the warning threshold is 200 LoC to allow for estimation error. If the changed LoC exceeds 200:
   - Warn: "This slice exceeded the 200 LoC target ([actual] LoC). The slice is complete, but consider re-slicing the remaining work: run `/ba:slice` on the plan and choose 'Re-slice from scratch'."

3. **Last slice check**: If this was the final slice (N == slice_count AND all slices in the table show `done`), update plan frontmatter `status: completed`. Then display the slice-aware completion menu (item 4 below) with the question "All [M] slices complete! What's next?" — do NOT use the standard `### Next Steps` block.

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

**After the slice-aware menu completes, do NOT proceed to `### Update Plan Status` or the standard `### Next Steps` block.** Those sections apply only to non-sliced execution. The slice-aware flow handles its own status updates and next-step routing above.

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
