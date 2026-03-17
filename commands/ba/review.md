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

## Step 1: Determine Review Scope & Capture Diff

> **CRITICAL: Run git diff exactly ONCE.** This step captures the stat summary AND full diff in a single pass. Do NOT re-run `git diff` after this step — reuse the captured output for all subsequent steps including reviewer dispatch.

### 1a. Detect scope

**If explicit ref range provided above**, use it directly.

**If no arguments provided**, run this single bash block to detect scope and capture everything at once:

```bash
# Detect scope type
DEFAULT_BRANCH=$(git rev-parse --verify main 2>/dev/null && echo main || (git rev-parse --verify master 2>/dev/null && echo master || git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'))
CURRENT_BRANCH=$(git branch --show-current)
MERGE_BASE=$(git merge-base HEAD "$DEFAULT_BRANCH" 2>/dev/null)

if [ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ] && [ -n "$MERGE_BASE" ]; then
  DIFF_RANGE="$MERGE_BASE..HEAD"
  SCOPE_TYPE="branch"
elif [ -n "$(git diff --staged --name-only)" ]; then
  DIFF_RANGE="--staged"
  SCOPE_TYPE="staged"
elif [ -n "$(git log --oneline -1 2>/dev/null)" ]; then
  DIFF_RANGE="HEAD~5..HEAD"
  SCOPE_TYPE="recent"
else
  echo "NO_CHANGES"
  exit 0
fi

echo "---SCOPE---"
echo "SCOPE_TYPE=$SCOPE_TYPE"
echo "DIFF_RANGE=$DIFF_RANGE"
echo "CURRENT_BRANCH=$CURRENT_BRANCH"
echo "DEFAULT_BRANCH=$DEFAULT_BRANCH"
echo "---STAT---"
git diff $DIFF_RANGE --stat
echo "---CHANGED_FILES---"
git diff $DIFF_RANGE --name-only
echo "---DIFF---"
git diff $DIFF_RANGE
```

If output contains `NO_CHANGES`, tell the user: "No changes detected to review. Run with a git ref range, e.g., `/ba:review abc123..def456`" and exit.

### 1b. Announce scope

From the `---STAT---` section, announce:

"Reviewing [scope type]: [details] ([N] files, [N] lines changed)."

### 1c. Gather plan context

Check for a recent plan in parallel (this is the only other bash call needed):

```bash
ls -t docs/plans/*.md 2>/dev/null | head -1
```

If found and created within last 7 days, read its Overview and Acceptance Criteria sections. Pass this context to reviewers.

### 1d. Store captured data

You now have everything needed for the rest of the workflow:
- **STAT** — from the `---STAT---` section
- **CHANGED_FILES** — from the `---CHANGED_FILES---` section
- **FULL_DIFF** — from the `---DIFF---` section

**Do NOT run any more `git diff` commands.** Pass the captured diff directly to reviewers in Step 3.

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

Scan for review-capable agents and skills using concrete file discovery. Run these in parallel:

**Agent files** — Use the Glob tool to find agent definitions:

```
Glob("**/*.md", path="~/.claude/agents/")
Glob("**/*.md", path=".claude/agents/")
```

Read each discovered file's frontmatter (first 15 lines). Include the agent if its `name` or `description` contains any of: "review", "code-review", "reviewer", "quality", "lint", "audit".

Exclude agents that are clearly not code reviewers (e.g., plan reviewers, test runners, implementation specialists).

**Skills** — Scan the available skills listed in the system-reminder context. Include any skill whose name or description matches the same keywords above. Exclude plan-review skills (like `ba:review-plan`).

For each discovered external reviewer, record:
- **name**: from frontmatter
- **description**: from frontmatter
- **source**: "agent" or "skill"
- **replaces**: value of `replaces` field in frontmatter, if present (e.g., `replaces: architecture-reviewer`)

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
