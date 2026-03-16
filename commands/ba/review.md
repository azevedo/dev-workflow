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
