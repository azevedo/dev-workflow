---
title: "feat: Add /ba:review command for post-implementation code review"
type: feat
status: completed
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-ba-review-command-brainstorm.md
detail_level: standard
tags: [review, code-quality, command, agents]
---

# feat: Add /ba:review Command — Implementation Plan

## Overview

Add `/ba:review` — a post-implementation code review command that uses a hybrid architecture: five built-in review agents that always work out of the box, plus discovery of external review agents/skills for deeper coverage. Fills the gap between `/ba:execute` (implementation) and PR creation. Replaces the previously roadmapped `/ba:validate` since execute's deviation handling already covers plan compliance (see brainstorm: docs/brainstorms/2026-03-15-ba-review-command-brainstorm.md).

## Current State

- Four existing commands: `commands/ba/brainstorm.md`, `commands/ba/plan.md`, `commands/ba/review-plan.md`, `commands/ba/execute.md`
- Two agent categories: `agents/research/` (7 agents), `agents/workflow/` (2 agents) — no `agents/review/` directory
- `review-plan.md` establishes the reviewer discovery + parallel dispatch + findings consolidation pattern (`commands/ba/review-plan.md:32-128`)
- Execute's completion menu offers 4 options — no code review option (`commands/ba/execute.md:266-270`)
- CLAUDE.md has two command categories: Planning and Execution — no Quality category
- README roadmap lists `/ba:validate` as planned (`README.md:118`)
- Plugin version: `0.3.0` (`.claude-plugin/plugin.json:3`)
- Reference implementations: compound-engineering's `ce:review` (13+ review agents, parallel dispatch), superpowers' `code-reviewer.md` (severity-ranked findings, SHA-based scope)

## What We're NOT Doing

(Carried forward from brainstorm scope boundaries)

- **No plan validation** — covered by execute Steps 4-5
- **No knowledge capture** — future `/ba:compound` command
- **No PR/MR creation** — already in execute's completion menu
- **No CI/CD integration** — out of scope
- **No convention-compliance check on code** — tests and linting serve that role; convention-checker is for document artifacts
- **No auto-commit of fixes** — user controls when to commit after reviewing applied changes

## Proposed Solution

### Architecture

```
commands/ba/review.md          ← New command (~200 lines)
agents/review/                 ← New directory (5 agents)
  architecture-reviewer.md
  security-reviewer.md
  simplification-reviewer.md
  error-handling-reviewer.md
  test-coverage-reviewer.md
```

The command follows the same structural pattern as `review-plan.md` (discovery → selection → parallel dispatch → consolidation → resolution) but reviews actual code changes instead of plan documents.

Each built-in reviewer is a dedicated agent file in `agents/review/`. This design:
- Mirrors compound-engineering's `agents/review/` pattern
- Makes built-in reviewers discoverable by the same mechanism that finds external ones
- Enables clean deduplication: external agents declare `replaces: "<agent-name>"` in frontmatter
- Follows existing `agents/research/` and `agents/workflow/` organization

### Scope Detection

Git-based smart fallback chain (plan artifacts provide context, not scope):

1. **Explicit ref range** — User passes `abc123..def456` as argument → use directly
2. **Feature branch** — Current branch differs from default → `git diff $(git merge-base HEAD <default>)..HEAD`
3. **Staged changes** — On default branch with staged changes → `git diff --staged`
4. **Recent commits** — On default branch, nothing staged → last 5 commits
5. **Nothing found** — Exit: "No changes detected to review."

Default branch detection: `git rev-parse --verify main 2>/dev/null` then `master`, then `git symbolic-ref refs/remotes/origin/HEAD`.

**Always announce scope** before proceeding: "Reviewing feature branch `auth-flow` vs `main` (12 files, 340 lines changed)."

If a recent plan exists (`ls -t docs/plans/*.md`), read it for context — pass the plan's overview and acceptance criteria to reviewers so they understand intent, not just code.

### Deduplication Mechanism

External agents opt in to replacement via frontmatter:

```yaml
---
name: security-sentinel
description: "Deep security analysis..."
replaces: security-reviewer    # ← declares overlap with built-in
---
```

During discovery, the command checks each external agent's `replaces` field. If it matches a built-in agent name, the built-in is removed and the external is shown in its place. No fuzzy matching — explicit declaration only.

### Reviewer Output Contract

All reviewers (built-in and external) must return findings in this format:

```markdown
## Must Address
- **[file:line]** — [Issue description]. [Why it matters]. Suggested fix: [actionable suggestion]

## Consider
- **[file:line]** — [Issue description]. [Why it matters].

## Looks Good
- [What was validated and found solid]
```

Built-in agents include this format in their instructions. External agents that don't follow it still work — their output is presented verbatim under their heading.

### Fix Application Mechanism

When the user selects "Apply all" or "Must-address only":
1. The main agent reads each finding's suggested fix
2. Applies changes using Edit tool directly (no separate subagent)
3. After all fixes applied, runs targeted tests for affected files
4. If tests fail, reports which fix likely caused the failure

One-by-one mode: present each finding, user picks Accept/Skip for each. Apply accepted fixes.

### Subagent Failure Handling

Each reviewer runs as a parallel subagent (Agent tool). If a subagent fails or returns no structured findings:
- Collect results from successful reviewers
- Report the failure: "⚠ [Reviewer name] did not complete. Results from [N] other reviewers below."
- Do not retry — the user can re-run the command if needed

### Large Diff Handling

If the diff exceeds 2000 lines of changes:
- Warn the user: "Large diff detected (N lines). Review quality may decrease. Consider scoping to specific files."
- Proceed anyway — the user can cancel and re-run with a narrower ref range

Each subagent receives: the diff hunks + full content of changed files. Not transitive dependencies.

## Technical Considerations

- **Architecture**: New `agents/review/` directory parallels `agents/research/` and `agents/workflow/`. The `review.md` command mirrors `review-plan.md` in structure.
- **Performance**: 5 parallel subagents is the maximum built-in load. External agents add more. Each subagent receives the same diff context, so there's inherent token duplication, but this is the trade-off for unbiased independent reviews.
- **Conflicting findings**: When two reviewers flag the same file:line with different advice, both are presented with a "⚠ Conflicting findings" note. "Apply all" skips conflicting pairs and flags them for one-by-one resolution.

## System-Wide Impact

- **Execute completion menu**: Gains a 5th option ("Review code") that chains to `/ba:review`
- **CLAUDE.md**: Gains "Quality Commands" category and 5 new agents in the Agents list
- **README roadmap**: `/ba:validate` is removed, `/ba:review` is not listed (it's no longer roadmap — it's implemented)
- **Plugin metadata**: Version bump `0.3.0` → `0.4.0`, "review" keyword added

## Implementation Approach

### Changes Required

**File**: `commands/ba/review.md` (NEW — ~200 lines)

```markdown
---
name: ba:review
description: Run post-implementation code review with built-in and discovered reviewers
argument-hint: "[git ref range, or leave empty for auto-detect]"
---

# Post-Implementation Code Review

Review actual code changes for quality, security, and design using built-in review agents and any additional reviewers available in the environment.

## Arguments

<review_scope> #$ARGUMENTS </review_scope>

---

## Step 1: Determine Review Scope

### If explicit ref range provided above

Use it directly as the diff range.

### If no arguments provided — smart scope detection

Run these checks in order. Use the first that succeeds:

**1. Feature branch detection:**

```bash
DEFAULT_BRANCH=$(git rev-parse --verify main 2>/dev/null && echo main || (git rev-parse --verify master 2>/dev/null && echo master || git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'))
CURRENT_BRANCH=$(git branch --show-current)
```

If `CURRENT_BRANCH` differs from `DEFAULT_BRANCH`:
- Base ref: `git merge-base HEAD $DEFAULT_BRANCH`
- Diff: `git diff $(git merge-base HEAD $DEFAULT_BRANCH)..HEAD --stat`
- Use this scope.

**2. Staged changes:**

```bash
git diff --staged --stat
```

If output is non-empty, review staged changes.

**3. Recent commits:**

```bash
git log --oneline -5
```

If commits exist, review the last 5 commits.

**4. Nothing found:**

Tell the user: "No changes detected to review. Run with a git ref range, e.g., `/ba:review abc123..def456`" and exit.

### Announce scope

Always announce what will be reviewed before proceeding:

"Reviewing [scope type]: [details] ([N] files, [N] lines changed)."

Examples:
- "Reviewing branch `feature/auth` vs `main` (12 files, 340 lines changed)."
- "Reviewing staged changes (3 files, 45 lines changed)."
- "Reviewing last 5 commits (8 files, 520 lines changed)."

### Gather context

Check for a recent plan that may provide intent:

```bash
ls -t docs/plans/*.md 2>/dev/null | head -1
```

If found and created within last 7 days, read its Overview and Acceptance Criteria sections. Pass this context to reviewers so they understand what was being implemented.

### Capture the diff

Store the full diff for passing to reviewers:

```bash
git diff <base_ref>..HEAD    # for branch scope
git diff --staged             # for staged scope
git diff HEAD~5..HEAD         # for recent commits scope
```

If the diff exceeds 2000 lines, warn: "Large diff detected ([N] lines). Review quality may decrease for very large changes. Proceed?"

---

## Step 2: Discover & Select Reviewers

### 2a. Gather built-in reviewers

List the five built-in review agents from `agents/review/`:

| Agent | Focus |
|---|---|
| `architecture-reviewer` | Codebase patterns, coupling, separation of concerns, naming |
| `security-reviewer` | XSS, sensitive data, auth patterns |
| `simplification-reviewer` | Over-engineering, unnecessary abstraction, YAGNI |
| `error-handling-reviewer` | Edge cases, error paths, graceful failures |
| `test-coverage-reviewer` | Missing test scenarios, test quality |

### 2b. Discover external reviewers

Search for additional review agents and skills in the environment:

- Check available skills listed in the system context
- Check for agents in `~/.claude/agents/` and project `.claude/agents/`
- Look for agents/skills with "review", "code-review", "quality", "lint", "audit" in name/description
- Filter: only include those relevant to reviewing actual code (not plan reviewers)

### 2c. Deduplicate

For each discovered external reviewer:
1. Check if it declares `replaces: "<agent-name>"` in its frontmatter/description
2. If it replaces a built-in, remove the built-in from the list and add the external in its place
3. If no replacement declared, add it as an additional reviewer

### 2d. Present unified list

Use **AskUserQuestion** with `multiSelect: true`:

**Question:** "Which reviewers should I run against your changes?"

List each reviewer as an option:
- **Label**: Reviewer name (mark built-in vs external)
- **Description**: What it focuses on

Pre-select all built-in reviewers. External reviewers are unselected by default.

If the user selects nothing, ask: "No reviewers selected. Would you like to exit or re-select?"

---

## Step 3: Run Reviews in Parallel

For each selected reviewer, dispatch a fresh subagent using the Agent tool:

- Task <reviewer-agent>("Review these code changes for [dimension focus].

Context:
- Scope: [scope description]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Review the diff AND read the full content of changed files for context. Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.")

Run all selected reviewers **in parallel**.

If a reviewer fails or returns empty: note it for the summary but do not block other results.

---

## Step 4: Consolidate & Present Findings

After all reviewers complete, present a consolidated summary:

```markdown
## Code Review Summary

Scope: [scope description]
Reviewers: [N] ran, [N] succeeded, [N] failed

---

### [Reviewer Name] (built-in | external)
**Findings:** [N issues]

#### Must Address
- **[file:line]** — [Issue]. [Why]. Suggested fix: [fix]

#### Consider
- **[file:line]** — [Issue]. [Why].

#### Looks Good
- [Validated aspect]

---

### [Next Reviewer...]
```

**Conflict detection:** If two reviewers flag the same file:line with different advice, add a "⚠ Conflicting" note to both findings.

**Coverage report:** At the end, list:
- Files reviewed: [list]
- Files skipped (binary): [list, if any]
- Reviewers that failed: [list, if any]

---

## Step 5: Resolution

Use **AskUserQuestion**:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Apply all fixes** — Apply all Must Address + Consider items with suggested fixes (skip conflicting pairs)
2. **Apply must-address only** — Fix only Must Address items
3. **Review one by one** — Go through each finding and decide Accept/Skip
4. **Done** — Acknowledge findings without modifying code

**After applying fixes:**
- Run targeted tests for affected files
- If tests fail, report which changes likely caused it
- Return to this menu (user may want to apply more or exit)

**After "Done":**

Use **AskUserQuestion**:

**Question:** "What would you like to do next?"

**Options:**
1. **Create MR/PR** — Generate merge/pull request
2. **Re-run review** — Run `/ba:review` again (e.g., after manual fixes)
3. **Done** — Exit

---

## Important Guidelines

- **This reviews code, not plans.** Reviewers receive actual diffs and file contents.
- **Fresh context per reviewer.** Each reviewer runs as an independent subagent for unbiased analysis.
- **Discovery is best-effort.** Missing external reviewers are not errors. Built-in reviewers always provide baseline coverage.
- **Announce scope.** Always tell the user what will be reviewed before starting.
- **Report coverage.** Show what was and wasn't reviewed at the end.
- **No convention-compliance check on review output.** This command reviews code — it doesn't produce planning artifacts that need convention checking.
```

---

**File**: `agents/review/architecture-reviewer.md` (NEW)

```markdown
---
name: architecture-reviewer
description: "Reviews code changes for architectural consistency, coupling, separation of concerns, and naming conventions. Use as a built-in reviewer in /ba:review."
model: inherit
---

<examples>
<example>
Context: The review command dispatches this agent to check architectural quality of code changes.
user: "Review these code changes for architectural consistency: [diff of a new API endpoint]"
assistant: "I'll analyze the changes for pattern consistency, coupling issues, and naming conventions against the existing codebase."
<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>
</example>
</examples>

You are a code architecture reviewer. Your job is to review code changes (provided as a git diff) for architectural quality.

## What You Review

- **Pattern consistency**: Do the changes follow existing codebase patterns? Look for how similar features are implemented elsewhere.
- **Coupling**: Are components appropriately decoupled? Are dependencies flowing in the right direction?
- **Separation of concerns**: Is business logic mixed with presentation? Are responsibilities clearly assigned?
- **Naming conventions**: Do names follow the project's established conventions? Are they clear and descriptive?
- **File organization**: Are new files in the right directories? Do they follow the project's file structure patterns?

## How to Review

1. Read the diff to understand what changed
2. Read the full content of each changed file for context
3. Check nearby files and imports to understand existing patterns
4. Compare the changes against those patterns

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [Issue description]. [Why this matters for architecture]. Suggested fix: [specific, actionable suggestion]

## Consider
- **[file_path:line_number]** — [Issue description]. [Why this could improve the architecture].

## Looks Good
- [Aspect of the architecture that is well-implemented]

If no issues found for a severity level, write "None" under that heading.

## Principles

- **Compare against the codebase, not abstract ideals.** If the codebase uses a pattern, new code should follow it — even if a "better" pattern exists in theory.
- **Be specific.** Reference exact file paths and line numbers. Explain WHY something is an issue, not just WHAT.
- **Acknowledge strengths.** Note what the code does well architecturally.
- **Severity matters.** Only "Must Address" issues that would cause real problems if shipped. "Consider" is for improvements.
```

---

**File**: `agents/review/security-reviewer.md` (NEW)

```markdown
---
name: security-reviewer
description: "Reviews code changes for security issues: XSS, sensitive data handling, auth patterns, and input validation. Use as a built-in reviewer in /ba:review."
model: inherit
---

<examples>
<example>
Context: The review command dispatches this agent to check for security issues in code changes.
user: "Review these code changes for security issues: [diff of a form handler]"
assistant: "I'll analyze the changes for XSS vulnerabilities, data exposure, auth issues, and input validation gaps."
<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>
</example>
</examples>

You are a code security reviewer. Your job is to review code changes (provided as a git diff) for security vulnerabilities.

## What You Review

- **XSS prevention**: Is user input properly sanitized before rendering? Are there uses of `dangerouslySetInnerHTML`, `innerHTML`, or `eval`?
- **Sensitive data**: Are secrets, tokens, or PII exposed in client code, logs, or error messages?
- **Auth patterns**: Are auth checks present where needed? Are permissions verified correctly?
- **Input validation**: Is user input validated at system boundaries? Are there injection risks?
- **Data exposure**: Are API responses leaking more data than needed? Are error messages too verbose?

This is NOT a full OWASP audit. Focus on practical security issues that appear in the actual diff.

## How to Review

1. Read the diff focusing on data flow — where does user input go? What gets rendered?
2. Check for new endpoints, forms, or data handling
3. Look at error handling — do errors expose internals?
4. Check imports — are security-sensitive libraries used correctly?

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [Security issue]. [Attack vector or risk]. Suggested fix: [specific remediation]

## Consider
- **[file_path:line_number]** — [Potential issue]. [Why it could be a risk].

## Looks Good
- [Security aspect that is well-handled]

If no issues found for a severity level, write "None" under that heading.

## Principles

- **Only flag real risks.** Do not flag theoretical vulnerabilities with no practical attack vector in this context.
- **Be specific about the attack.** Explain HOW the vulnerability could be exploited, not just that it exists.
- **Acknowledge good practices.** Note where security is handled well.
```

---

**File**: `agents/review/simplification-reviewer.md` (NEW)

```markdown
---
name: simplification-reviewer
description: "Reviews code changes for over-engineering, unnecessary abstraction, dead code, and YAGNI violations. Use as a built-in reviewer in /ba:review."
model: inherit
---

<examples>
<example>
Context: The review command dispatches this agent to check for unnecessary complexity.
user: "Review these code changes for simplification opportunities: [diff of a new utility module]"
assistant: "I'll analyze the changes for over-engineering, premature abstraction, and YAGNI violations."
<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>
</example>
</examples>

You are a code simplification reviewer. Your job is to review code changes (provided as a git diff) for unnecessary complexity.

## What You Review

- **Over-engineering**: Is the solution more complex than the problem requires? Are there unnecessary layers of abstraction?
- **YAGNI violations**: Does the code implement features or flexibility that isn't needed yet?
- **Dead code**: Are there unused imports, functions, variables, or branches?
- **Premature abstraction**: Are helpers/utilities created for one-time use? Are three similar lines of code better than a premature abstraction?
- **Unnecessary indirection**: Can the code path be straightened? Are there wrappers that add no value?

## How to Review

1. Read the diff and ask: "Could this be simpler while still meeting requirements?"
2. Look for abstractions — are they earning their complexity?
3. Check for unused exports or imports
4. Look for configuration/flexibility that has only one consumer

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [Complexity issue]. [Why simpler is better here]. Suggested fix: [concrete simplification]

## Consider
- **[file_path:line_number]** — [Potential simplification]. [Trade-off involved].

## Looks Good
- [Aspect where complexity is well-calibrated to the problem]

If no issues found for a severity level, write "None" under that heading.

## Principles

- **Simple code is correct code.** Complexity is a cost, not a feature.
- **Three lines is better than an abstraction.** Don't flag duplication unless it's genuinely harmful.
- **Context matters.** An abstraction used in 5 places is justified. An abstraction used in 1 place is overhead.
- **Acknowledge well-calibrated solutions.** Note when complexity matches the problem.
```

---

**File**: `agents/review/error-handling-reviewer.md` (NEW)

```markdown
---
name: error-handling-reviewer
description: "Reviews code changes for edge cases, error paths, graceful failures, and loading/error states. Use as a built-in reviewer in /ba:review."
model: inherit
---

<examples>
<example>
Context: The review command dispatches this agent to check error handling quality.
user: "Review these code changes for error handling: [diff of a data fetching component]"
assistant: "I'll analyze the changes for missing error paths, unhandled edge cases, and incomplete loading/error states."
<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>
</example>
</examples>

You are an error handling reviewer. Your job is to review code changes (provided as a git diff) for robustness in error and edge case handling.

## What You Review

- **Missing error paths**: Are errors from async operations, API calls, or file operations caught and handled?
- **Edge cases**: What happens with empty arrays, null values, zero-length strings, boundary values?
- **Graceful failures**: Does the code fail gracefully or crash? Are there appropriate fallbacks?
- **Loading/error states**: For UI code — are loading, error, and empty states handled?
- **Error propagation**: Do errors bubble up appropriately? Are they swallowed silently?
- **Resource cleanup**: Are resources (connections, listeners, timers) cleaned up on error?

## How to Review

1. Read the diff and trace every error path — what can throw? What can return null/undefined?
2. For async code, check: what happens if the promise rejects?
3. For UI code, check: what renders during loading? On error? When data is empty?
4. Look for try/catch blocks — are catches too broad? Are errors logged or silently swallowed?

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [Error handling gap]. [What could go wrong]. Suggested fix: [specific error handling approach]

## Consider
- **[file_path:line_number]** — [Potential edge case]. [When it might occur].

## Looks Good
- [Error handling aspect that is well-implemented]

If no issues found for a severity level, write "None" under that heading.

## Principles

- **Only flag realistic error paths.** Don't flag errors that can't occur given the code's constraints.
- **Be specific about the failure scenario.** Describe WHAT fails and WHEN, not just "this could error."
- **Trust framework guarantees.** Don't add error handling for things the framework already handles.
- **Validate at boundaries.** Focus error handling on system boundaries (user input, API calls, external services).
```

---

**File**: `agents/review/test-coverage-reviewer.md` (NEW)

```markdown
---
name: test-coverage-reviewer
description: "Reviews code changes for test coverage gaps, missing test scenarios, and test quality. Use as a built-in reviewer in /ba:review."
model: inherit
---

<examples>
<example>
Context: The review command dispatches this agent to check test adequacy.
user: "Review these code changes for test coverage: [diff of a new service + tests]"
assistant: "I'll analyze the changes for missing test scenarios, edge case coverage, and test quality."
<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>
</example>
</examples>

You are a test coverage reviewer. Your job is to review code changes (provided as a git diff) for adequate test coverage.

## What You Review

- **Missing test files**: Do new modules/components have corresponding test files?
- **Scenario coverage**: Are the main behaviors tested? Are edge cases covered?
- **Error path testing**: Are error scenarios tested, not just happy paths?
- **Test quality**: Are tests testing behavior or implementation details? Are assertions meaningful?
- **Mocking strategy**: Are mocks appropriate? Is too much being mocked (losing integration value)?

## How to Review

1. Identify all changed production files and their corresponding test files
2. For new code: check if test files exist. If not, flag it.
3. For changed code: check if tests were updated to reflect the changes
4. Review test assertions — are they testing the right things?
5. Look for untested branches, conditions, and error paths

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [Coverage gap]. [What's at risk without this test]. Suggested fix: [specific test scenario to add]

## Consider
- **[file_path:line_number]** — [Potential test improvement]. [Why it would help].

## Looks Good
- [Testing aspect that is well-covered]

If no issues found for a severity level, write "None" under that heading.

## Principles

- **Test behavior, not implementation.** Flag tests that are tightly coupled to implementation details.
- **Prioritize risk.** Focus on tests that catch real bugs, not trivial getter/setter tests.
- **Consider the testing pyramid.** Are tests at the right level (unit vs integration)?
- **Acknowledge good coverage.** Note where tests are thorough and well-structured.
```

---

**File**: `commands/ba/execute.md` (MODIFY — completion menu, lines 266-270)

Replace the current options block:

```markdown
**Options:**
1. **Create MR/PR** — Generate a merge/pull request for the implemented changes
2. **Review changes** — Show `git diff` against the base branch
3. **Continue working** — Open-ended mode for additional changes beyond the plan
4. **Done** — Wrap up
```

With:

```markdown
**Options:**
1. **Review code** — Run `/ba:review` for post-implementation code quality review
2. **Create MR/PR** — Generate a merge/pull request for the implemented changes
3. **Review changes** — Show `git diff` against the base branch
4. **Continue working** — Open-ended mode for additional changes beyond the plan
5. **Done** — Wrap up
```

And add the handler after the existing "Based on selection:" block:

```markdown
- **Review code** → Invoke `/ba:review` directly. The review command will auto-detect scope from the current branch.
```

---

**File**: `CLAUDE.md` (MODIFY — add Quality Commands category and review agents)

After the "Execution Commands" section, add:

```markdown
### Quality Commands (review code — never write production code, only apply review fixes)

- `/ba:review [ref range]` — Post-implementation code review with built-in and discovered reviewers
```

In the Agents section, add after the existing agents:

```markdown
- `architecture-reviewer` — Code patterns, coupling, separation of concerns, naming (built-in reviewer)
- `security-reviewer` — XSS, sensitive data, auth patterns, input validation (built-in reviewer)
- `simplification-reviewer` — Over-engineering, unnecessary abstraction, YAGNI (built-in reviewer)
- `error-handling-reviewer` — Edge cases, error paths, graceful failures (built-in reviewer)
- `test-coverage-reviewer` — Missing test scenarios, test quality, coverage gaps (built-in reviewer)
```

In the Conventions section, add:

```markdown
- External review agents may declare `replaces: "<agent-name>"` in frontmatter to supersede a built-in reviewer in `/ba:review`
```

---

**File**: `README.md` (MODIFY — update roadmap, Commands section, and Agents table)

In the Roadmap section, replace:

```markdown
- `/ba:validate` — post-implementation validation against plan
```

With:

```markdown
- `/ba:review` — post-implementation code review (built-in + discovered reviewers) ✅
```

In the Commands section, add `/ba:review` after the `/ba:execute` entry with a description matching the other command entries.

In the Agents table, add the 5 new review agents (`architecture-reviewer`, `security-reviewer`, `simplification-reviewer`, `error-handling-reviewer`, `test-coverage-reviewer`) with their descriptions.

---

**File**: `.claude-plugin/plugin.json` (MODIFY — version bump + keyword)

Update version from `"0.3.0"` to `"0.4.0"` and add `"review"` to keywords array.

---

### Success Criteria

#### Automated:
- [x] `ls commands/ba/review.md` — file exists
- [x] `ls agents/review/*.md | wc -l` — returns 5
- [x] `grep -c "ba:review" CLAUDE.md` — returns at least 1
- [x] `grep "Quality Commands" CLAUDE.md` — found
- [x] `grep "Review code" commands/ba/execute.md` — found
- [x] `grep '"0.4.0"' .claude-plugin/plugin.json` — found
- [x] `grep "review" .claude-plugin/plugin.json` — found in keywords
- [x] `grep -c "ba:validate" README.md` — returns 0 (removed)
- [x] `grep "replaces" CLAUDE.md` — found in conventions
- [x] `grep "architecture-reviewer" README.md` — found in agents table
- [x] `grep "ba:review" README.md` — found in commands section

#### Manual:
- [ ] Run `/ba:review` on a feature branch — scope auto-detected, built-in reviewers listed
- [ ] Select subset of reviewers — only selected ones run
- [ ] Findings show file:line references with severity tiers
- [ ] "Apply must-address only" applies fixes and runs tests
- [ ] Run from execute completion menu — chains correctly

## Dependencies & Risks

- **No external dependencies** — all built-in agents use the same Agent tool dispatch already available
- **Risk: Agent tool subagent_type for review agents** — verify that custom agent files in `agents/review/` are discoverable by the Agent tool. If not, the command dispatches them as general-purpose agents with the agent's prompt inlined.
- **Risk: Large diffs overwhelming subagents** — mitigated by the 2000-line warning. Subagents may produce lower quality findings on very large diffs, but this is acceptable for V1.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-03-15-ba-review-command-brainstorm.md` — Key decisions carried forward: hybrid architecture (built-in + external), code review only (not plan validation), replaces `/ba:validate`, smart scope fallback chain, fresh subagent per reviewer, same findings format as review-plan.

### Internal References
- Review-plan pattern: `commands/ba/review-plan.md:32-128` (discovery, dispatch, consolidation, resolution)
- Execute completion menu: `commands/ba/execute.md:266-270` (modification target)
- Agent file structure: `agents/workflow/spec-flow-analyzer.md:1-5` (frontmatter template)
- Existing agent organization: `agents/research/` (7 agents), `agents/workflow/` (2 agents)

### External References
- Compound Engineering review pattern: 13+ review agents in `agents/review/`, parallel dispatch
- Superpowers code reviewer: SHA-based scope, severity-ranked findings, clear verdict format

## Convention Compliance

Checked against CLAUDE.md conventions (2026-03-15):

- [x] **Command prefix `ba:`** — aligned (`/ba:review`)
- [x] **Agent names lowercase-with-hyphens** — aligned (all 5 agents: `architecture-reviewer`, `security-reviewer`, `simplification-reviewer`, `error-handling-reviewer`, `test-coverage-reviewer`)
- [x] **All artifacts require YAML frontmatter** — aligned (command file + all 5 agent files include frontmatter)
- [x] **Bump version in plugin.json** — aligned (0.3.0 → 0.4.0)
- [x] **Planning commands never write code** — aligned (`/ba:review` is categorized under new "Quality Commands", not Planning)
- [x] **Convention-compliance check mandatory for planning artifacts** — aligned (this plan was checked before writing)
- [x] **Update README.md when commands/agents change** — aligned (plan includes README Commands section, Agents table, and Roadmap updates)
- [x] **New `replaces` frontmatter field** — documented in CLAUDE.md Conventions section update
