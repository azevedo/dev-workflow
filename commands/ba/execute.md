---
name: ba:execute
description: Execute an approved implementation plan — implement changes, test continuously, track progress
argument-hint: "[path to plan file]"
---

# Execute an Implementation Plan

Take a plan produced by `/ba:plan` and implement it systematically: make code changes, run tests, track progress via plan checkboxes, handle deviations, and commit at logical boundaries.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

Treat `#$ARGUMENTS` as the plan file path.

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

**Legacy slice artifacts**: Some older plans carry `sliced: true`, a `## Slices` table, or `<!-- slice:N -->` markers from the retired `/ba:slice` command. Ignore them — execute the full plan as a single run. Do not branch on, refuse, or warn about these inert artifacts.

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

## Step 1.5: Pre-Execution Scope Check

Before any code is written for this run, project the size of what you're about to do and compare it against a fixed threshold. This catches scope creep — when the plan implicitly covers more surface than its decisions suggest — before it lands as code.

**When this fires:**
- Once per run, after Step 1 has fully completed (Branch Check, Resume Detection including any resume-test prompt, Test Discovery).
- **Fresh start fires; mid-run resume skips.** If no `[x]` marks exist in the plan's tasks, fire. If any `[x]` exists, skip — you're resuming partial work, not starting fresh.
- **Once Step 1.5 passes, it does not re-fire within this run** — not after Step 2c's test-failure escape hatch, not when the files-to-touch list grows mid-implementation.

### 1.5a. Build the files-to-touch list

List every file you would create or modify to satisfy the plan's tasks. Include:

- Files named in the plan's "Changes Required" / phase blocks.
- Files implied by those changes (imports, type definitions, fixtures, snapshot updates).
- New files you would need to create.

Do **not** include files you "might also touch" — only files the plan's tasks plainly require.

### 1.5b. Project LoC per file

Classify each fenced block as **literal** or **pseudo-code** before counting (three cases):

- **Fence under a `**Code-shape decision:**` label** → literal.
- **Unlabeled fence, in a plan that has at least one `**Code-shape decision:**` label** → pseudo-code.
- **Any fence, in a plan with no `**Code-shape decision:**` labels anywhere** (a pre-change plan) → literal.

For each file in the list:

- **Plan provides a literal code block for this file** (fence under a `**Code-shape decision:**` label, or any fence in a pre-change plan with no labels at all): count the lines of that block.
- **Decisions/pseudo-code only, file exists**: estimate the diff size from the task description; reference similar implementations in the codebase if needed.
- **New file, decisions only**: estimate from the closest analogue (similar new files in this codebase).

Sum the per-file estimates. Call this the **projection** (M).

### 1.5c. The threshold (T)

Set **T = 400** LoC (≈ 2× a typical plan's LoC — the fallback threshold carried over from the retired slice model). This is a deliberately loose ceiling: it flags a run that would write substantially more code than a typical plan, prompting a check that the plan isn't over-scoped for a single execution pass.

### 1.5d. Compare and act

- **If M < T**: announce a one-line summary ("Pre-execution scope check: projected ~[M] LoC (threshold [T]). Proceeding.") and continue to Step 2.
- **If M ≥ T**: pause via Step 4 Deviation Handling using the protocol below.

### 1.5e. Pause flow

Surface the projection via the standard Expected/Found/Why block:

```
**Deviation detected:**
- **Expected**: ≤ ~[T] LoC for a single execution run.
- **Found**: Projected ~[M] LoC across [file count] files: [short list].
- **Why**: Scope: projected M ≥ threshold (~400 LoC). Confirm the plan is correctly scoped for one execution pass before writing code — don't silently implement a larger surface than the plan intends.
```

Then use **AskUserQuestion** with three options:

1. **Accept and continue** — Proceed with the projected scope, record the override.
2. **Update the plan** — Modify the plan to narrow scope, then re-project (see 1.5f).
3. **Pause execution** — Stop here.

**Record** each fire in the plan's `## Deviations` section (create the section if missing). Write the entry **before** the Pause returns control:

```markdown
### Scope tripwire: projected M ≥ threshold
- **Expected**: ≤ ~[T] LoC for one run
- **Found**: ~[M] LoC projected across [file count] files
- **Why**: [reason]
- **Resolution**: [accepted / plan updated / paused]
```

If the projection triggers again after an Update (re-projection did not clear), append `(round 2)`, `(round 3)`, etc. to the heading so each round is visible in the audit trail.

### 1.5f. Re-projection after "Update the plan"

When the user picks "Update the plan", surface an explicit sync gate via **AskUserQuestion** ("Let me know when the edit is done — pick **Re-project** once the plan reflects the new scope") with two options: **Re-project** and **Pause execution**. Once the user picks Re-project:

1. Re-build the files-to-touch list and re-project M.
2. Re-evaluate against T = 400.
3. If M < T: announce "Re-projection clears the threshold. Proceeding." and continue to Step 2.
4. If M ≥ T: re-enter the pause flow (1.5e). Each round writes its own subsection under `## Deviations` with `(round 2)`, `(round 3)`, etc. appended to the heading, so the audit trail shows the spiral, not just the final state.

---

## Step 2: Execution Loop

For each unchecked task in order:

### 2a. Announce

Brief announcement: "**Task [N]/[M]**: [description] in `[file path]`"

For COMPREHENSIVE plans, also announce phase transitions: "**--- Phase [N]: [Phase Title] ---**"

### 2b. Implement

Implement the plan's decisions for this task. Where the plan provides a literal code block — classified per Step 1.5b (a fence under a `**Code-shape decision:**` label, or any fence in a pre-change plan with no labels anywhere) — implement that code as specified; it captures a committed decision and is binding verbatim. Where the plan gives decisions, pseudo-code, or unlabeled fences (pseudo-code), implement to them following existing codebase patterns. Where a literal code block and prose both address the same file or function, the code block governs the structure; the prose is context.

When rewriting an existing file, read the original first and carry over any WHY comments (non-obvious rationale, workarounds, invariant explanations) that are not reproduced in the plan's code block but are not explicitly removed by the plan. Plan code samples are structural references, not complete comment inventories.

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

### 2f. Commit Check (MANDATORY)

**You MUST commit at logical boundaries. Do NOT defer all commits to the end.**

Evaluate after each task using this table:

| Commit when... | Don't commit when... |
|----------------|---------------------|
| Logical unit complete (types, function, component, test file) | Small part of a larger unit |
| Tests pass + meaningful progress | Tests failing |
| About to switch contexts (data layer → UI layer) | Purely scaffolding with no behavior |
| >3 files changed since last commit | Would need a "WIP" commit message |
| About to start risky or experimental changes | |

**Heuristic:** "Can I write a commit message that describes a complete, valuable change? If yes, commit now. If the message would be 'WIP' or 'partial X', wait — but no longer than 3 files."

**Detail-level boundaries:**
- **MINIMAL**: Single commit after all acceptance criteria pass.
- **STANDARD**: One commit per "Changes Required" section or logical group. Typically 3-6 commits per plan.
- **COMPREHENSIVE**: One commit per completed phase (before the phase gate).

**Commit workflow:**
```bash
# 1. Stage only files related to this logical unit (NOT `git add .`)
git add <files related to this logical unit>

# 2. Commit with conventional message referencing the plan
git commit -m "<type>(<scope>): <description>

Plan: docs/plans/<filename>"
```

Where `<type>` matches the plan's type (feat, fix, refactor). The scope is the primary affected area.

**IMPORTANT**: If you realize you have >3 files changed without a commit, STOP implementing and commit immediately before continuing.

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
1. **Review code** — Run `/ba:review` for post-implementation code quality review
2. **Create MR/PR** — Generate a merge/pull request for the implemented changes
3. **Review changes** — Show `git diff` against the base branch
4. **Continue working** — Open-ended mode for additional changes beyond the plan
5. **Done** — Wrap up

**Based on selection:**
- **Review code** → Invoke `/ba:review` directly. The review command will auto-detect scope from the current branch.
- **Create MR/PR** → Prefer `/ba:propose` — it composes the title and a reviewer-first body, detects GitHub/GitLab from the git remote, preserves protected PR/MR blocks, and creates or updates the PR/MR as appropriate. Invoke `/ba:propose` directly. It composes the body from the diff and any linked issue, so the plan's overview and acceptance criteria are not auto-injected. **Fallback** — if `/ba:propose` is unavailable or the user wants a one-off ad-hoc PR: detect the platform from the git remote (GitHub → `gh pr create`, GitLab → `glab mr create`), or use a project/personal PR command the user prefers.
- **Review changes** → Show the diff, then return to options.
- **Continue working** → Ask what they want to work on. Exit structured execution flow.
- **Done** → Display final summary and exit.

---

## Important Guidelines

- **The plan's decisions are the authority.** Literal code blocks are authoritative verbatim; implement everything else to the plan's decisions. Don't add features, refactor surrounding code, or invent build choices the plan deliberately left as decisions.
- **Track progress in the plan file.** Every completed task gets `[x]`. This is how resume works.
- **Test after every task — targeted, not full suite.** Run tests related to changed files. Defer full suite + lint to completion or CI.
- **Report deviations immediately.** Don't silently work around plan/reality mismatches.
- **Pre-execution scope check is mandatory** (Step 1.5) — always run it. The LoC projection is the scope-creep signal; when the run projects ≥ the threshold, surface it before writing code (the user decides whether to proceed).
- **Commit at logical boundaries — this is mandatory, not optional.** Each commit should pass tests and represent a coherent unit of work. Never reach completion with zero incremental commits on a STANDARD or COMPREHENSIVE plan.
- **Evidence-based completion.** Never claim "done" without showing passing tests.
- **No convention-checker during execution.** Tests and linting are the quality gates for code.
- **Respect phase gates.** For COMPREHENSIVE plans, never skip manual verification between phases without user consent.
- **TDD follows the plan.** No TDD machinery baked into the command. If the plan specifies test-first steps, follow them. If not, implement and test normally. The plan is the authority on testing approach.
