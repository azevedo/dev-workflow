---
name: ba:review
description: Run post-implementation code review with built-in and discovered reviewers
argument-hint: "[MR URL, !N, #N, git ref range, --local, or empty]"
---

# Post-Implementation Code Review

Review actual code changes for quality, security, and design using built-in review agents and any additional reviewers available in the environment.

## Arguments

<review_scope> #$ARGUMENTS </review_scope>

---

## Step 1: Determine Review Scope & Capture Diff

> **CRITICAL:** The scope is determined ONCE in step 1a. Execute ONLY the matching path (1b OR 1c) — never both. The diff captured in that path is the SOLE source of truth for the entire review. Do NOT run `git diff`, `git log`, or any local git commands to second-guess or supplement a remote MR diff.

### 1a. Classify the argument

Parse `<review_scope>` to determine the scope type. **Match the FIRST row that fits — then skip directly to the indicated step.**

| Pattern | Scope | Go to | Examples |
|---|---|---|---|
| GitLab MR URL | `mr` | **1b** | `https://gitlab.com/group/repo/-/merge_requests/123` |
| GitHub PR URL | `mr` | **1b** | `https://github.com/owner/repo/pull/123` |
| Bare number, `!N`, or `#N` | `mr` | **1b** | `42`, `!42`, `#42` |
| Contains `..` | `local-range` | **1c** | `abc123..def456` |
| `--staged` | `local-staged` | **1c** | |
| `--local` | `local-auto` | **1c** | |
| Empty | `local-auto` | **1c** | |

---

### 1b. Fetch diff — MR/PR scope (remote)

> **MANDATORY: When this path is taken, do NOT run `git diff` or use local branch state at any point during the review. The remote MR diff is the sole input. Skip step 1c entirely.**

**Step 1 — Detect platform.** If the argument is a full URL, parse the platform from it. Otherwise, detect from the repo remote:

```bash
git remote get-url origin 2>/dev/null
```

- URL contains `gitlab` → GitLab (use `glab`)
- URL contains `github` → GitHub (use `gh`)

**Step 2 — Extract the MR/PR number.** Strip everything except the number:
- `https://gitlab.com/group/repo/-/merge_requests/123` → `123`
- `https://github.com/owner/repo/pull/123` → `123`
- `!42` or `#42` → `42`
- `42` → `42`

**Step 3 — Fetch diff and metadata in parallel:**

**GitHub:**
```bash
gh pr diff <N>
```
```bash
gh pr view <N> --json title,body,baseRefName,headRefName,additions,deletions,changedFiles,files
```

**GitLab:**
```bash
glab mr diff <N> --color=never
```
```bash
glab mr view <N> --output json
```

**Step 4 — Extract the standard data from the commands above (not from local git):**
- **FULL_DIFF** — from `pr diff` / `mr diff` output
- **CHANGED_FILES** — from API metadata (`files` field), or parse `+++ b/path` lines from the diff
- **STAT** — from API metadata (additions, deletions, file count)
- **MR_TITLE** — from API metadata
- **MR_DESCRIPTION** — from API metadata (use as additional review context alongside plan)
- **BASE_BRANCH** / **HEAD_BRANCH** — from API metadata

If the CLI command fails (not installed, auth error, MR not found), report the error clearly and exit. Do not silently fall back to local.

**Then skip to step 1d.** Do NOT execute step 1c.

---

### 1c. Fetch diff — local scope

> **Only reached when `<review_scope>` matched `local-range`, `local-staged`, `local-auto`, or was empty. If scope is `mr`, you should not be here.**

**For `local-range`:** use the provided range directly as `DIFF_RANGE`.

**For `local-staged`:** set `DIFF_RANGE="--staged"`.

**For `local-auto`:** run this bash block to detect scope:

```bash
# Detect default branch (redirect stdout — only check exit code)
if git rev-parse --verify main >/dev/null 2>&1; then
  DEFAULT_BRANCH=main
elif git rev-parse --verify master >/dev/null 2>&1; then
  DEFAULT_BRANCH=master
elif git symbolic-ref refs/remotes/origin/HEAD >/dev/null 2>&1; then
  DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||')
else
  DEFAULT_BRANCH=""
fi

CURRENT_BRANCH=$(git branch --show-current)
MERGE_BASE=""
DIFF_BASE=""

# Find the nearest ancestor branch (stacked branch support).
# For main→A→B, this picks A as the base when reviewing B,
# instead of diffing all the way back to main.
if [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "${DEFAULT_BRANCH:-}" ]; then
  BEST_COUNT=999999
  for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
    [ "$branch" = "$CURRENT_BRANCH" ] && continue
    mb=$(git merge-base HEAD "$branch" 2>/dev/null) || continue
    count=$(git rev-list --count "$mb..HEAD" 2>/dev/null) || continue
    if [ "$count" -gt 0 ] && [ "$count" -lt "$BEST_COUNT" ]; then
      BEST_COUNT=$count
      MERGE_BASE=$mb
      DIFF_BASE=$branch
    fi
  done
fi

if [ -n "$MERGE_BASE" ]; then
  DIFF_RANGE="$MERGE_BASE..HEAD"
  SCOPE_TYPE="branch"
elif [ -n "$(git diff --staged --name-only)" ]; then
  DIFF_RANGE="--staged"
  SCOPE_TYPE="staged"
elif [ -n "$(git log --oneline -1 2>/dev/null)" ]; then
  COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo 0)
  if [ "$COMMIT_COUNT" -le 5 ]; then
    DIFF_RANGE="$(git rev-list --max-parents=0 HEAD | head -1)..HEAD"
  else
    DIFF_RANGE="HEAD~5..HEAD"
  fi
  SCOPE_TYPE="recent"
else
  echo "NO_CHANGES"
  exit 0
fi
```

If `SCOPE_TYPE` resolved, capture everything in one pass:

```bash
echo "---STAT---"
git diff $DIFF_RANGE --stat
echo "---CHANGED_FILES---"
git diff $DIFF_RANGE --name-only
echo "---DIFF---"
git diff $DIFF_RANGE
```

If auto-detect found nothing (`NO_CHANGES`), tell the user: "No changes detected to review. Pass an MR URL or a git ref range, e.g., `/ba:review !123` or `/ba:review abc123..def456`" and exit.

---

### 1d. Announce scope

- For **mr** scope: "Reviewing MR !N: *[MR_TITLE]* — `[HEAD_BRANCH]` into `[BASE_BRANCH]` ([N] files, +[additions] -[deletions])."
- For **branch** scope: "Reviewing branch `[CURRENT_BRANCH]` against `[DIFF_BASE]` ([N] files, [N] lines changed)."
- For **staged** scope: "Reviewing staged changes ([N] files, [N] lines changed)."
- For **recent** scope: "Reviewing last [N] commits ([N] files, [N] lines changed)."

### 1e. Gather plan context

Check for a recent plan in parallel:

```bash
ls -t docs/plans/*.md 2>/dev/null | head -1
```

If found and created within last 7 days, read its Overview and Acceptance Criteria sections. For MR scope, also use **MR_DESCRIPTION** as context. Pass all context to reviewers.

### 1f. Store captured data

You now have everything needed for the rest of the workflow:
- **STAT** — file-level change summary
- **CHANGED_FILES** — list of affected file paths
- **FULL_DIFF** — the complete unified diff

**STOP. From this point forward, the captured data above is the ONLY diff you use.** Do not run `git diff`, `git log`, `glab mr diff`, `gh pr diff`, or any other command that produces a diff. If you are reviewing an MR, do not compare the remote diff against local state — local state is irrelevant. Pass the captured data directly to reviewers in Step 3.

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

**All five built-in reviewers MUST appear as options in Step 2d. Do not filter or omit any.**

### 2b. Discover external reviewers

**This step is mandatory.** Do not skip it or substitute it with a curated list. Run all Glob calls in parallel:

```
Glob("**/*.md", path="~/.claude/agents/")
Glob("**/*.md", path=".claude/agents/")
Glob("**/*.md", path="~/.claude/skills/")
Glob("**/*.md", path="~/.claude/commands/")
Glob("**/*.md", path=".claude/commands/")
```

Read each discovered file's frontmatter (first 15 lines). The frontmatter is the authoritative source — it may be richer than the system-reminder summary. Include the file if its `name`, `description`, or any frontmatter field contains any of: "review", "code-review", "reviewer", "quality", "lint", "audit", "assess", "guidelines", "compliance", "pattern", "architecture", "composition".

Exclude files that are clearly orchestration commands or non-review tools (e.g., plan writers, test runners, implementation specialists). Exclude the built-in agents already listed in 2a.

**Also scan the system-reminder skills list** as a fallback for skills not stored as files. Include any skill whose name or description matches the same keywords above. Exclude: `ba:review`, `ba:review-plan`, and other orchestration skills.

**Skills and commands are valid reviewers regardless of which directory they live in.** A skill that performs code review, audit, or quality assessment should be included.

For each discovered external reviewer, record:
- **name**: from frontmatter
- **description**: from frontmatter
- **source**: "agent" or "skill"

### 2c. Present unified list

Use **AskUserQuestion** with `multiSelect: true`.

**Each reviewer gets its own individual option.** Never bundle, group, or create preset combinations. The user needs fine-grained control — they may want all reviewers except one, which is impossible with bundles.

**Never hide or remove reviewers.** All built-in reviewers and all discovered external reviewers must appear as separate options. If an external reviewer overlaps with a built-in (e.g., both cover architecture or naming), show both — append "(overlaps with [built-in name])" to the external's description so the user can make an informed choice.

**Question:** "Which reviewers should I run?"

One option per reviewer, in this order: built-ins first (pre-selected), then external/discovered (unselected):

```
[✓] Architecture reviewer (built-in) — Codebase patterns, coupling, separation of concerns, naming
[✓] Security reviewer (built-in) — XSS, sensitive data, auth patterns
[✓] Simplification reviewer (built-in) — Over-engineering, unnecessary abstraction, YAGNI
[✓] Error handling reviewer (built-in) — Edge cases, error paths, graceful failures
[✓] Test coverage reviewer (built-in) — Missing test scenarios, test quality
[ ] <each discovered external reviewer, one per line — with "(overlaps with X)" if applicable>
```

If no external reviewers were found after running the Globs, say so explicitly: "No external reviewers found in ~/.claude/agents/, .claude/agents/, ~/.claude/skills/, ~/.claude/commands/, .claude/commands/."

If the user selects nothing, ask: "No reviewers selected. Would you like to exit or re-select?"

---

## Step 3: Run Reviews in Parallel

For each selected reviewer, dispatch a fresh subagent using the Agent tool — regardless of whether it is an agent or a skill. Every reviewer must run in its own isolated context.

For **agent-based reviewers**, prompt the subagent directly:

- Task <reviewer-agent>("Review these code changes for [dimension focus].

Context:
- Scope: [scope description]
- MR context: [MR title + description, if MR scope]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Review the diff AND read the full content of changed files for context. Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.")

For **skill-based reviewers**, instruct the subagent to invoke the skill:

- Task general-purpose("Use the `[skill-name]` skill to review these code changes.

Context:
- Scope: [scope description]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.")

For **user-typed reviewers** (names typed manually that are not in the built-in or discovered lists):

Before dispatching, **resolve the name** against known skills and agents:

1. **Normalize:** strip any leading `/` from the typed name to get the bare name
2. **Match against skills:** check if the bare name (or any prefix-qualified variant like `namespace:bare-name`) appears in the system-reminder skills list. Also check if a `/bare-name` skill exists. If matched → dispatch as a **skill-based reviewer** (same template as above)
3. **Match against agent types:** check if the bare name is a registered agent type (from the Agent tool's available types). If matched → dispatch as an **agent-based reviewer** (same template as above)
4. **No match → custom review dimension:** dispatch as a `general-purpose` subagent — do NOT use the typed name as `subagent_type` since it won't be a registered agent type:

- Task general-purpose("You are a code reviewer specializing in **[user-typed name]**. Review these code changes through that lens.

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

The options depend on the scope type.

### For local scopes (branch, staged, recent, local-range)

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

### For MR/PR scope (remote)

Use **AskUserQuestion**:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Post inline comments** — Post findings as inline comments on the MR/PR (details below)
2. **Review one by one** — Walk through each finding for discussion
3. **Done** — Acknowledge findings without further action

#### Posting inline comments

Use `gh api` / `glab api` to create review comments on specific diff lines. Group into a single review submission where the platform supports it (e.g., GitHub pull request reviews).

**Format each comment as a [Conventional Comment](https://conventionalcomments.org/).**

Translate internal categories to CC labels using this mapping:

| Internal category | CC format | When |
|---|---|---|
| Must Address (correctness, security, data loss) | `issue (blocking): <subject>` | Would cause real problems if shipped — rare |
| Must Address (all other) | `issue: <subject>` | Worth fixing, but not a merge gate |
| Consider | `suggestion (non-blocking): <subject>` | Improvement the author can take or leave |
| Consider (trivial) | `nitpick (non-blocking): <subject>` | Style, naming, formatting preferences |
| Looks Good | `praise: <subject>` | Positive reinforcement |

**Default to non-blocking.** Most findings are `issue:` or `suggestion (non-blocking):`. Only use `(blocking)` for genuine correctness bugs, security vulnerabilities, or data-loss risks.

Additional CC labels to use when they fit naturally:
- `question:` — "Is this intentional?" or "Did you consider X?" — when unsure if something is a problem
- `thought:` — An idea sparked by the code, not a request to change anything
- `todo:` — Small necessary housekeeping (missing import, unused variable)

Each comment body follows the CC template:
```
<label> [decorations]: <subject>

<discussion — why this matters, suggested fix if any>
```

---

## Important Guidelines

- **This reviews code, not plans.** Reviewers receive actual diffs and file contents.
- **Fresh context per reviewer.** Each reviewer runs as an independent subagent for unbiased analysis.
- **Discovery is best-effort.** Missing external reviewers are not errors. Built-in reviewers always provide baseline coverage.
- **Announce scope.** Always tell the user what will be reviewed before starting.
- **Report coverage.** Show what was and wasn't reviewed at the end.
- **No convention-compliance check on review output.** This command reviews code — it doesn't produce planning artifacts that need convention checking.
