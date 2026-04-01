---
title: "feat: Add /ba:tdd command for test-driven execution"
type: feat
status: completed
date: 2026-03-30
origin: docs/brainstorms/2026-03-29-tdd-execution-discipline-brainstorm.md
detail_level: comprehensive
tags: [tdd, execute, testing, refactoring, agents, ousterhout]
---

# feat: Add /ba:tdd Command — Implementation Plan

## Overview

Add a dedicated `/ba:tdd` command that executes approved plans using test-driven development discipline: vertical-slice tracer bullets (one failing test, minimal implementation, cycle validation, repeat), followed by a dedicated refactor phase guided by Ousterhout's deep-module principles. Two new workflow agents — `tdd-cycle-gate` and `refactor-advisor` — encode the discipline as reusable participants (see brainstorm: `docs/brainstorms/2026-03-29-tdd-execution-discipline-brainstorm.md`).

## Current State

- `/ba:execute` command at `commands/ba/execute.md` (307 lines): procedural execution loop with plan-driven tasks, checkpoint tracking, commit discipline, deviation handling, and completion menu. Explicit design choice at line 306: "No TDD machinery baked into the command."
- Two workflow agents in `agents/workflow/`: `convention-checker.md` (128 lines), `spec-flow-analyzer.md` (130 lines). Both use `model: inherit`, neither declares `tools`.
- Five review agents in `agents/review/` with standardized output format (Must Address / Consider / Looks Good).
- Plan templates inline in `commands/ba/plan.md:197-394` across three detail levels (MINIMAL, STANDARD, COMPREHENSIVE). No "Behaviors to Test" section exists.
- Plugin version: `0.5.0` (`.claude-plugin/plugin.json:3`).
- CLAUDE.md lists Execution Commands at line 17-19, Agents at lines 29-44.
- README.md documents commands at lines 26-141, agents table at lines 158-175, roadmap at lines 192-198.

## What We're NOT Doing

(Carried forward from brainstorm scope boundaries)

- **NOT replacing `/ba:execute`** — the two commands coexist as alternative execution modes
- **NOT modifying existing execute command's behavior** — its "no TDD machinery" stance is preserved
- **NOT adding new artifact types** — `/ba:tdd` operates on existing plan files
- **NOT enforcing TDD on plans without "Behaviors to Test"** — the command falls back gracefully (acceptance criteria → interactive definition)
- **NOT absorbing the full external Ousterhout skill** — `refactor-advisor` encodes only the principles relevant to post-TDD refactoring
- **NOT committing at RED** — failing tests are never committed; only GREEN states get commits
- **NOT running full test suite per cycle** — targeted tests per behavior; full suite at completion
- **NOT adding TDD-specific plan detail level detection** — `/ba:tdd` works with any detail level plan that has behaviors to test

## Proposed Solution

Three new files plus four modifications:

1. **`agents/workflow/tdd-cycle-gate.md`** — Per-cycle validator checking four TDD discipline criteria (test describes behavior, uses public interface, survives refactor, code is minimal) plus two LLM-specific anti-pattern checks (test mutation during GREEN, tests not responsive to prior cycle). Silent by default; surfaces only violations.

2. **`agents/workflow/refactor-advisor.md`** — Ousterhout deep-module refactoring guide for the post-TDD phase. Analyzes accumulated implementation code and provides categorized suggestions (interface simplification, duplication extraction, module deepening). Interactive — user selects which suggestions to apply.

3. **`commands/ba/tdd.md`** — Execution command orchestrating the TDD loop: extract behaviors → for each behavior (RED → confirm RED → GREEN → confirm GREEN → regression check → gate → self-check → checkpoint → commit) → refactor phase → completion.

4. **`commands/ba/plan.md`** — Add optional "Behaviors to Test" section to all three plan templates.

5. **`CLAUDE.md`** — Add `/ba:tdd` to Execution Commands, add both agents to Agents list.

6. **`README.md`** — Add `/ba:tdd` documentation, add agents to table, update roadmap.

7. **`.claude-plugin/plugin.json`** — Version bump to `0.6.0`, add "tdd" keyword.

### Critical Design Decisions

These resolve gaps identified during spec-flow analysis:

**1. RED phase — test passes immediately.** When a test unexpectedly passes during the RED phase (behavior already implemented by a prior cycle), announce: "Behavior appears already satisfied — test passed immediately." Present options via AskUserQuestion: (a) skip to next behavior, (b) write a more specific test, (c) accept existing coverage. Do NOT insist on a failing test when the behavior is genuinely implemented. (Why: this is one of the most common TDD scenarios with sequential behaviors that share implementation.)

**2. Gate violation resolution flow.** When the `tdd-cycle-gate` surfaces a violation, present it to the user with options: (a) fix and re-run this cycle, (b) override and continue to next behavior, (c) abort execution. The gate does NOT block automatically — the user decides. (Why: discipline without blocking flow, per brainstorm decision.)

**3. Mutation detection mechanism.** After the RED phase completes, the command captures a snapshot of the test file(s) content (via a hash or diff baseline). After the GREEN phase, the gate agent receives this baseline and compares against the current state of the test file(s). Any modifications to test files during the GREEN phase are flagged as "test mutated to pass." (Why: this is the key LLM-specific anti-pattern from the brainstorm — agents may modify the test instead of writing real implementation.)

**4. "Minimal implementation" criteria.** "Minimal" means: the implementation makes the current test pass without adding behavior beyond what the test exercises. No speculative code for future behaviors, no defensive handling for untested paths, no premature abstraction. The gate checks whether the implementation adds code paths not exercised by any currently-passing test. (Why: operational definition prevents subjective disputes.)

**5. GREEN phase failure escalation.** Same as `/ba:execute`: max 3 fix attempts, then escalate to user with options (show error, skip behavior, pause execution). (Why: consistent with established execute patterns; prevents infinite retry loops.)

**6. Refactor phase interactivity.** Interactive, not automatic. The `refactor-advisor` presents suggestions categorized by Ousterhout principle. The user selects which to apply (similar to `/ba:review`'s resolution step). After each applied suggestion, tests are re-run. If tests break, revert that specific suggestion and continue. Refactor phase is skippable — after "Entering refactor phase" announcement, offer: (a) run refactor-advisor, (b) skip refactoring. (Why: user maintains control; forced refactoring adds ceremony with no value for trivial features.)

**7. Commit strategy.** One commit per successful red-green-gate cycle when it represents a logically complete unit. Same >3 file heuristic as execute. Multiple trivially small behaviors touching the same files may be consolidated into one commit. Never commit at RED. Refactoring changes are committed separately from the behavior loop. (Why: each commit represents a green, tested state — preserves bisectability.)

**8. Regression handling.** After the GREEN phase, run ALL accumulated behavior tests (not just the current one). If a prior test fails, announce: "Regression detected: test for behavior [N] now fails." Present options: (a) fix the regression, (b) revert the current implementation, (c) ask the user. This check runs before the gate — regressions must be resolved before the cycle is considered complete. (Why: TDD with sequential behaviors almost always encounters regressions; they must be caught immediately.)

**9. Self-check questions inherited.** The five system-wide self-check questions from `/ba:execute` (What fires? Real chain tested? Orphaned state? Other interfaces? Error alignment?) run silently after each green-gate cycle. Concerns are surfaced as brief notes, same as execute. (Why: these catch real integration issues; omitting them from TDD would be a regression.)

**10. Behavior ordering.** Before starting the TDD loop, present the behavior list and ask: "Proceed in this order, or reorder?" User can reorder based on dependencies or risk. (Why: plan order may not match implementation order; user knows best.)

**11. Test scope per cycle.** Run the current behavior's test first. If it passes (GREEN confirmed), then run ALL accumulated behavior tests to check for regressions. Only proceed to gate if all pass. (Why: catches regressions early without running the full project suite every cycle.)

## Technical Approach

### Architecture

The command follows the established execution command pattern from `commands/ba/execute.md`:
- YAML frontmatter with `name`, `description`, `argument-hint`
- `#$ARGUMENTS` capture in a `<plan_path>` tag
- Same plan-locating logic (auto-detect or explicit path)
- Same branch check, resume detection, test discovery patterns
- AskUserQuestion for all user interactions
- Checkpoint tracking via `[ ]` → `[x]` in plan file

Key architectural differences from `/ba:execute`:
- The execution unit is a **behavior** (not a file block or acceptance criterion)
- Each cycle has explicit **RED** and **GREEN** phases with confirmation
- An **agent dispatch** happens per cycle (tdd-cycle-gate) and once at end (refactor-advisor)
- **Mutation detection** requires capturing test file state between phases
- The **refactor phase** is a distinct step after all behaviors, not inline

### Alternative Approaches Considered

(From brainstorm — see brainstorm: "Approaches considered")

1. **Default TDD in `/ba:execute` with opt-out** — Rejected: adds ceremony to simple tasks, would need escape hatch anyway.
2. **Opt-in per plan (`execution_style: tdd`)** — Rejected: easy to forget, TDD becomes inconsistent, two execution paths in one command.
3. **Separate `/ba:tdd` command** — Chosen: clean separation, iterate in isolation, preserve execute's explicit "no TDD" stance.

## Implementation Phases

### Phase 1: Foundation — Workflow Agents

Create both workflow agents. These encode the TDD principles and must be verified independently before the command depends on them.

#### Changes Required

**File**: `agents/workflow/tdd-cycle-gate.md`

````markdown
---
name: tdd-cycle-gate
description: "Validates each TDD red-to-green cycle for discipline compliance. Dispatched by /ba:tdd after each behavior's green phase. Surfaces only violations — silent when the cycle is clean."
model: inherit
tools: Read, Grep, Glob, LS
---

<examples>
<example>
Context: The /ba:tdd command has just completed a red-to-green cycle for a behavior.
user: "Validate this TDD cycle. Behavior: 'User can log in with valid credentials'. Test file: src/auth.test.ts (diff attached). Implementation file: src/auth.ts (diff attached). Test file baseline hash: abc123. Current test file hash: abc123."
assistant: "I'll validate this cycle against the TDD discipline checklist and check for LLM-specific anti-patterns."
<commentary>The tdd command dispatches this agent after each GREEN phase. The agent receives the behavior description, file diffs, and test file baseline for mutation detection.</commentary>
</example>
<example>
Context: The /ba:tdd command has completed a cycle where the test was modified during the GREEN phase.
user: "Validate this TDD cycle. Behavior: 'Cart total includes tax'. Test file: src/cart.test.ts (diff attached). Implementation: src/cart.ts (diff attached). Test file baseline hash: def456. Current test file hash: ghi789."
assistant: "I'll check this cycle. The test file hashes differ — this indicates the test was modified during the GREEN phase, which is a potential mutation violation."
<commentary>Hash mismatch between baseline and current triggers the mutation check. The agent reads both versions to determine if the change weakened the test.</commentary>
</example>
</examples>

You are a TDD cycle discipline validator. Your mission is to verify that each red-to-green cycle follows test-driven development principles and to detect LLM-specific anti-patterns where the agent takes shortcuts instead of writing genuine implementations.

**You validate silently. Report ONLY violations. If the cycle is clean, return "No violations detected."**

## Inputs

You receive from the `/ba:tdd` command:
1. **Behavior description** — the behavior being tested
2. **Test file diff** — changes made during the RED phase (the new test)
3. **Implementation diff** — changes made during the GREEN phase
4. **Test file baseline** — content or hash of the test file after RED phase (for mutation detection)
5. **Current test file state** — content or hash of the test file after GREEN phase
6. **Test file paths** — paths to test files for reading full context

## Validation Checklist

For each cycle, check these six criteria:

### 1. Test Describes Behavior, Not Implementation
The test name and assertions should describe WHAT the code does (user-visible behavior), not HOW it does it (internal mechanics). Violations: testing private methods, asserting on internal data structures, test name references implementation details (e.g., "calls the database" instead of "returns user data").

### 2. Test Uses Public Interface Only
The test should exercise the code through its public API — the same interface a consumer would use. Violations: importing internal/private modules, reaching into component internals, testing helper functions that are implementation details.

### 3. Test Would Survive Internal Refactor
If someone refactored the implementation without changing behavior, would this test still pass? Violations: mocking internal collaborators that could change, asserting on call counts of internal methods, testing the exact sequence of internal operations.

### 4. Code Is Minimal
The implementation should only add behavior that the current test exercises. Violations: adding error handling for untested paths, adding configuration options not under test, implementing future behaviors speculatively, abstracting prematurely.

### 5. Test Not Mutated During GREEN Phase (LLM Anti-Pattern)
Compare the test file baseline (from after RED phase) against the current test file state. If they differ, read both versions and determine:
- **Acceptable**: formatting-only changes, import additions required by implementation
- **Violation**: weakened assertions, removed test cases, changed expected values, added `skip`/`xtest`/`pending` markers, broadened matchers (e.g., `toBe(5)` changed to `toBeTruthy()`)

### 6. Test Responsive to Prior Cycle (LLM Anti-Pattern)
Each test should emerge from the actual implementation state — testing behavior that genuinely needs to be added next. Violations: the test is a mechanical translation of the plan's behavior list with no connection to what the code actually looks like after prior cycles, the test duplicates coverage already provided by an earlier test.

## Output Format

**When violations are found:**

```markdown
## Cycle Violations

### [Violation Title]
- **Criterion**: [which of the 6 criteria]
- **Evidence**: [specific code reference — file:line, assertion text, diff excerpt]
- **Why this matters**: [brief explanation]
- **Suggestion**: [how to fix]
```

**When no violations are found:**

```
No violations detected.
```

## Important Rules

- **Silent on success.** Do not congratulate or summarize clean cycles. Just return "No violations detected."
- **Evidence-based.** Every violation must cite specific code. No vague warnings.
- **Criterion 5 is the priority.** Test mutation is the most dangerous LLM anti-pattern — always check this first.
- **Read the actual files** when diff context is insufficient. Use Read on test and implementation files for full context.
- **Do NOT block the cycle.** You report violations; the command handles resolution with the user.
- **Do NOT suggest refactoring.** That is the refactor-advisor's job, not yours.
````

---

**File**: `agents/workflow/refactor-advisor.md`

````markdown
---
name: refactor-advisor
description: "Provides Ousterhout deep-module refactoring guidance after all TDD behaviors are green. Dispatched by /ba:tdd during the refactor phase. Analyzes accumulated implementation and suggests improvements."
model: inherit
tools: Read, Grep, Glob, LS
---

<examples>
<example>
Context: The /ba:tdd command has completed all behavior cycles and entered the refactor phase.
user: "Analyze these files for refactoring opportunities using Ousterhout deep-module principles. Files changed during TDD: src/auth.ts, src/auth.test.ts, src/middleware/session.ts. All tests passing."
assistant: "I'll analyze the implementation against deep-module principles and suggest refactoring opportunities."
<commentary>The tdd command dispatches this agent once after all behaviors are green. The agent reads all changed files and their tests to provide targeted suggestions.</commentary>
</example>
</examples>

You are a refactoring advisor guided by John Ousterhout's deep-module design philosophy (from "A Philosophy of Software Design"). Your mission is to analyze code produced during a TDD cycle and suggest refactoring improvements that deepen modules, simplify interfaces, and reduce complexity.

**You suggest. You do not apply.** The command presents your suggestions to the user for selection.

## Inputs

You receive from the `/ba:tdd` command:
1. **Changed files** — list of files modified during the TDD loop
2. **Test files** — corresponding test files
3. **Behavior list** — the behaviors that were implemented

## Principles to Apply

Analyze the code through these five Ousterhout-derived lenses:

### 1. Deep Modules (Small Interface, Deep Implementation)
A module's interface should be much simpler than its implementation. Look for:
- Functions with many parameters that could be reduced
- Classes/modules exposing internal details through their interface
- Shallow modules that are "all interface, no depth" — thin wrappers adding no abstraction value
- Opportunities to absorb complexity into the implementation so callers don't deal with it

### 2. Dependency Injection over Hard-Coded Dependencies
Look for:
- Hard-coded imports that should be injected (especially for testability)
- Functions reaching into global state instead of receiving it as parameters
- Tight coupling to specific implementations instead of interfaces/contracts

### 3. Return Results over Side Effects
Look for:
- Functions that mutate external state instead of returning new values
- Methods that communicate through side effects (modifying shared objects, writing to global stores) instead of return values
- Opportunities to make data flow explicit through function signatures

### 4. Extract Duplication
Look for:
- Repeated code patterns across the behaviors implemented
- Similar logic in test and implementation that could share a helper
- Copy-paste code that emerged from the "minimal implementation" approach of TDD

### 5. Deepen Modules (Merge Shallow Layers)
Look for:
- Thin pass-through layers that add no value
- Chains of functions where one just calls the next with minimal transformation
- Opportunities to merge adjacent shallow modules into one deeper module

## Process

1. **Read all changed files** — implementation and test files
2. **Identify patterns** — look for each principle's signals
3. **Categorize suggestions** — group by principle
4. **Prioritize** — order by impact (most significant simplification first)

## Output Format

```markdown
## Refactoring Suggestions

### Summary
- Suggestions found: [N]
- By principle: [N] deep modules, [N] dependency injection, [N] return over side effects, [N] extract duplication, [N] deepen modules

### Suggestions

#### 1. [Suggestion Title]
- **Principle**: [which of the 5]
- **Location**: [file_path:line_number]
- **Current**: [what the code does now — brief excerpt]
- **Suggested**: [what it should look like — brief code or description]
- **Impact**: [why this matters — complexity reduction, testability, readability]

#### 2. [Suggestion Title]
...

### No Suggestions
[If the code is already clean, say so. Do not manufacture suggestions for the sake of having output.]
```

## Important Rules

- **Only suggest what tests can verify.** Every suggestion must keep existing tests green. If a refactoring would require test changes, note that explicitly.
- **Respect the TDD investment.** Do not suggest redesigns that invalidate the test suite. The tests are the safety net.
- **Prioritize impact over quantity.** Three high-impact suggestions beat ten trivial ones.
- **Read the full files.** Do not suggest based on diffs alone — you need context.
- **No new features.** Refactoring changes behavior's implementation, not its interface. If a suggestion adds capability, it is not refactoring.
- **Acknowledge clean code.** If the TDD process produced clean code with no refactoring opportunities, say "No suggestions — the implementation is clean." Do not force suggestions.
````

#### Success Criteria

##### Automated:
- [x] `ls agents/workflow/tdd-cycle-gate.md` — file exists
- [x] `ls agents/workflow/refactor-advisor.md` — file exists
- [x] `head -6 agents/workflow/tdd-cycle-gate.md` — contains YAML frontmatter with name, description, model, tools
- [x] `head -6 agents/workflow/refactor-advisor.md` — contains YAML frontmatter with name, description, model, tools
- [x] `grep "tools:" agents/workflow/tdd-cycle-gate.md` — shows `Read, Grep, Glob, LS`
- [x] `grep "tools:" agents/workflow/refactor-advisor.md` — shows `Read, Grep, Glob, LS`

##### Manual:
- [x] tdd-cycle-gate agent has complete validation checklist (6 criteria including 2 LLM-specific)
- [x] refactor-advisor agent covers all 5 Ousterhout principles from brainstorm
- [x] Both agents follow established agent structure: examples block, role statement, process, output format, guidelines

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 2.

---

### Phase 2: Core — `/ba:tdd` Command

Create the TDD execution command. This is the main deliverable — ~300 lines of markdown orchestrating the TDD loop with agent dispatch.

#### Changes Required

**File**: `commands/ba/tdd.md`

````markdown
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

### 2h. System-Wide Self-Check

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
````

#### Success Criteria

##### Automated:
- [x] `ls commands/ba/tdd.md` — file exists
- [x] `head -5 commands/ba/tdd.md` — contains YAML frontmatter with name: ba:tdd
- [x] `grep -c "AskUserQuestion" commands/ba/tdd.md` — multiple occurrences (user interaction points)
- [x] `grep "tdd-cycle-gate" commands/ba/tdd.md` — agent dispatch present
- [x] `grep "refactor-advisor" commands/ba/tdd.md` — agent dispatch present
- [x] `grep "Behaviors to Test" commands/ba/tdd.md` — behavior extraction present

##### Manual:
- [x] Command follows established execute.md structural pattern (plan locating, branch check, resume detection, test discovery, checkpoint tracking, commit discipline, completion menu)
- [x] TDD loop has explicit RED and GREEN phases with confirmation steps
- [x] Mutation detection mechanism is specified (baseline capture at RED, comparison at gate)
- [x] All 11 critical design decisions from the plan's "Critical Design Decisions" section are implemented in the command
- [x] Regression check runs ALL accumulated tests, not just the current behavior
- [x] Refactor phase is skippable and interactive

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 3.

---

### Phase 3: Integration — Templates, Documentation, Configuration

Update existing files to register the new command and agents.

#### Changes Required

**File**: `commands/ba/plan.md` — Add optional "Behaviors to Test" section to all three plan templates.

Insert after the "What We're NOT Doing" section in each template:

For **MINIMAL template** (after "What We're NOT Doing", before "Context"):

```markdown
## Behaviors to Test *(optional — consumed by `/ba:tdd`)*

- [ ] [Testable behavior derived from acceptance criteria]
- [ ] [Another testable behavior]
```

For **STANDARD template** (after "What We're NOT Doing", before "Proposed Solution"):

```markdown
## Behaviors to Test *(optional — consumed by `/ba:tdd`)*

- [ ] [Testable behavior 1 — what the code should do, not how]
- [ ] [Testable behavior 2]
- [ ] [Testable behavior 3]
```

For **COMPREHENSIVE template** (after "What We're NOT Doing", before "Proposed Solution"):

```markdown
## Behaviors to Test *(optional — consumed by `/ba:tdd`)*

- [ ] [Testable behavior 1 — what the code should do, not how]
- [ ] [Testable behavior 2]
- [ ] [Testable behavior 3]
```

---

**File**: `CLAUDE.md` — Add `/ba:tdd` to Execution Commands and both agents to the Agents list.

Under `### Execution Commands (implement approved plans)`, add:

```markdown
- `/ba:tdd [plan]` — Execute a plan using test-driven development — red-green-refactor with per-cycle validation
```

Under `## Agents`, add:

```markdown
- `tdd-cycle-gate` — Per-cycle TDD discipline validation (Read, Grep, Glob, LS)
- `refactor-advisor` — Ousterhout deep-module refactoring guidance (Read, Grep, Glob, LS)
```

---

**File**: `README.md` — Add `/ba:tdd` command documentation and agents to table.

Under the `/ba:execute` section (after line 121), add:

```markdown
### `/ba:tdd [plan]`

Executes an approved plan using test-driven development discipline: one failing test, minimal implementation, per-cycle validation, repeat. After all behaviors are green, a dedicated refactor phase with Ousterhout deep-module principles.

- **Behaviors from the plan** — extracts "Behaviors to Test" section, falls back to acceptance criteria, or asks interactively
- **Tracer-bullet loop** — RED (write failing test) → confirm RED → GREEN (minimal implementation) → confirm GREEN → regression check → cycle gate → repeat
- **Per-cycle gate** — `tdd-cycle-gate` agent validates each cycle silently; surfaces only violations (test describes behavior, uses public interface, code is minimal, no test mutation)
- **LLM-specific anti-patterns** — detects tests mutated during GREEN phase and tests not responsive to prior implementation cycle
- **Refactor phase** — after all behaviors green, `refactor-advisor` agent provides Ousterhout-guided suggestions (deep modules, dependency injection, return results over side effects)
- **Same infrastructure as `/ba:execute`** — branch check, resume detection, targeted testing, checkpoint tracking, commit discipline, completion menu
```

Under the Agents table, add two rows:

```markdown
| `tdd-cycle-gate` | Validates each TDD red-to-green cycle for discipline compliance and LLM anti-patterns |
| `refactor-advisor` | Provides Ousterhout deep-module refactoring guidance after TDD behaviors are green |
```

Update the "Starting a flow" decision tree to mention `/ba:tdd` as an alternative to `/ba:execute`.

In the Roadmap section, add:

```markdown
- `/ba:tdd` — TDD execution discipline with per-cycle validation and deep-module refactoring ✅
- Merge `/ba:tdd` into `/ba:execute` as an execution mode — after `/ba:tdd` is validated through real usage
```

---

**File**: `.claude-plugin/plugin.json` — Version bump and keyword addition.

```json
{
  "name": "dev-workflow",
  "version": "0.6.0",
  "description": "Research, brainstorm, plan, execute, TDD execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
  "author": {
    "name": "Bruno Azevedo"
  },
  "license": "MIT",
  "keywords": [
    "research",
    "brainstorm",
    "planning",
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

#### Success Criteria

##### Automated:
- [x] `grep "Behaviors to Test" commands/ba/plan.md` — section present in templates
- [x] `grep "ba:tdd" CLAUDE.md` — command listed under Execution Commands
- [x] `grep "tdd-cycle-gate" CLAUDE.md` — agent listed
- [x] `grep "refactor-advisor" CLAUDE.md` — agent listed
- [x] `grep "ba:tdd" README.md` — command documented
- [x] `grep "tdd-cycle-gate" README.md` — agent in table
- [x] `grep "refactor-advisor" README.md` — agent in table
- [x] `grep '"0.6.0"' .claude-plugin/plugin.json` — version bumped
- [x] `grep '"tdd"' .claude-plugin/plugin.json` — keyword added

##### Manual:
- [x] Plan templates include "Behaviors to Test" as an optional section in all three detail levels
- [x] CLAUDE.md correctly categorizes `/ba:tdd` as an Execution Command
- [x] README.md decision tree updated to mention TDD as an execution alternative
- [x] README.md command description accurately reflects the TDD workflow

> **Phase gate:** Automated verification must pass. Pause for manual verification before considering the feature complete.

## System-Wide Impact

### Interaction Graph

- `/ba:tdd` dispatches `tdd-cycle-gate` agent per behavior cycle (N dispatches for N behaviors)
- `/ba:tdd` dispatches `refactor-advisor` agent once after all behaviors green
- `/ba:tdd` reads and modifies plan files (same as `/ba:execute` — checkbox updates, status changes)
- `/ba:plan` produces plans with optional "Behaviors to Test" section consumed by `/ba:tdd`
- `/ba:review` can review `/ba:tdd` output (auto-detects scope from branch diff — no changes needed)
- No interaction with `/ba:brainstorm`, `/ba:research`, `/ba:compound`, or `/ba:review-plan` beyond existing patterns

### Error & Failure Propagation

- **Test failure in RED phase**: Expected — confirms RED state. Errors (syntax/import) require fix before proceeding.
- **Test failure in GREEN phase**: Up to 3 retry attempts, then user escalation. Does NOT propagate to other behaviors.
- **Regression in accumulated tests**: Blocks current cycle. Must be resolved before gate validation. Does NOT skip to next behavior.
- **Gate violation**: Presented to user. Does NOT automatically block — user chooses resolution.
- **Refactor breaks tests**: Specific suggestion reverted. Other suggestions unaffected. Does NOT abort refactor phase.
- **Agent dispatch failure**: If gate agent fails, note it and continue (same pattern as review command). If refactor-advisor fails, announce and skip refactor phase.

### State Lifecycle Risks

- **Plan file checkboxes**: Same risk as `/ba:execute` — session interrupted between checkbox update and commit leaves a checked item without a commit. Mitigated by resume validation running tests at start.
- **Test file baseline for mutation detection**: Ephemeral, held in command context only. Lost on session interruption. On mid-cycle resume (no `[x]` but test file exists), mutation detection is skipped for the first cycle — the gate runs its other 5 criteria but cannot evaluate criterion 5 (test mutation) without the pre-GREEN baseline. This is an accepted limitation; the risk is low since a fresh session is unlikely to exhibit the mutation anti-pattern.
- **Partial behavior list completion**: Plan checkboxes track this. Resume picks up at first unchecked behavior.

### API Surface Parity

- `/ba:tdd` and `/ba:execute` both consume plan files — plans work with either command
- Plan files with "Behaviors to Test" work with both commands (`/ba:execute` ignores the section; `/ba:tdd` consumes it)
- Plan files without "Behaviors to Test" work with `/ba:tdd` via fallback chain

### Integration Test Scenarios

1. **Full TDD cycle**: Create a plan with "Behaviors to Test", run `/ba:tdd`, verify all cycles complete with commits at GREEN states only
2. **Fallback to acceptance criteria**: Plan without "Behaviors to Test" section, verify `/ba:tdd` extracts behaviors from acceptance criteria
3. **Resume after interruption**: Complete 2 of 5 behaviors, interrupt, resume — verify picks up at behavior 3 with tests passing
4. **Gate violation flow**: Deliberately mutate a test during GREEN, verify gate catches it and presents resolution options
5. **Refactor phase**: Complete all behaviors, run refactor-advisor, apply one suggestion, verify tests stay green

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Command file too large (>400 lines) | Medium | Low | Accept — execute.md is 307 lines, TDD adds phases. If >400, extract shared infrastructure into a reference doc |
| Gate agent false positives | Medium | Medium | Gate does not block — user overrides. Iterate on criteria based on real usage |
| Minimal implementation too literal (hard-coded returns) | Medium | Medium | "Minimal" definition in plan excludes hard-coded returns; gate checks code paths |
| LLM mutates test files in practice | High | High | Mutation detection mechanism (baseline comparison) is the primary defense. Gate criterion 5 is the highest priority check |
| Regression spiral (each behavior breaks prior ones) | Medium | High | Regression check before gate; user escalation; option to revert |
| Refactor-advisor suggests too much | Low | Low | Interactive selection — user skips irrelevant suggestions |

## Documentation Plan

All documentation updates are included in Phase 3:
- CLAUDE.md: command and agent registry
- README.md: command documentation, agent table, decision tree, roadmap
- No new artifact path documentation needed (command operates on existing plan files)

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-03-29-tdd-execution-discipline-brainstorm.md` — Key decisions carried forward: separate `/ba:tdd` command (not retrofit), plan-driven behaviors, per-cycle gate agent, single refactor phase at end, Ousterhout as workflow agent

### Internal References
- Execute command pattern: `commands/ba/execute.md` (plan locating, branch check, resume, test discovery, checkpoint, commit discipline, completion)
- Workflow agent pattern: `agents/workflow/convention-checker.md:1-5` (frontmatter structure), `agents/workflow/spec-flow-analyzer.md` (body structure)
- Review agent dispatch: `commands/ba/review.md:165-222` (parallel agent dispatch, resolution flow)
- Plan templates: `commands/ba/plan.md:197-394` (three detail levels, section structure)
- Plugin config: `.claude-plugin/plugin.json` (version, keywords)

## Convention Compliance

- [x] Command prefix `ba:` — aligned (`ba:tdd`)
- [x] Agent names `lowercase-with-hyphens` — aligned (`tdd-cycle-gate`, `refactor-advisor`)
- [x] All artifacts require YAML frontmatter — aligned (command + both agents have frontmatter)
- [x] Bump `version` in `plugin.json` — aligned (0.5.0 → 0.6.0)
- [x] Execution commands implement approved plans — aligned (same behavioral contract as `/ba:execute`)
- [x] Agent `tools` declarations include `LS` — aligned (both agents: `Read, Grep, Glob, LS`)
- [x] Update README.md — aligned (Phase 3 includes README updates)
- [x] Update CLAUDE.md — aligned (Phase 3 includes CLAUDE.md updates)
- [x] Agent directory placement `agents/workflow/` — aligned (matches convention-checker, spec-flow-analyzer)
- [x] No new artifact paths — aligned (operates on existing plan files)
