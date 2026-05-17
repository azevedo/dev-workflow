---
name: ba:review
description: Run post-implementation code review with built-in and discovered reviewers
argument-hint: "[MR URL, !N, #N, git ref range, --local, or empty]"
---

# Post-Implementation Code Review

Review actual code changes for quality, security, and design using built-in review agents and any additional reviewers available in the environment.

## Arguments

<review_scope> #$ARGUMENTS </review_scope>

### Parse Arguments

Check the argument string for recognized flags before classifying scope:

- **`--persist`**: Scan `<review_scope>` for the token `--persist`. If found, set `PERSIST=true` and strip the token from the argument string. Multiple occurrences collapse to a single set flag (idempotent). When `PERSIST=true`, immediately capture the timestamp that will name the persist directory:

  ```bash
  TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)   # local time; single capture, reused at Step 1d and Step 4.5
  ```

  Capture it **here, once** — not later in Step 4.5a — so the value announced in Step 1d matches what Step 4.5 writes. Reviewers can take minutes; deferring the capture would let wall-clock advance and produce announcement-vs-write skew.

- **Everything else** after stripping `--persist`: treat as the scope argument and proceed to Step 1a classification. The remaining string may still contain `--staged` or `--local` (scope tokens) or be empty (local-auto).

**Note:** Unknown flags (e.g., `--persists`, `-persist`) are not recognized — they fall through to scope classification and will produce a downstream error (`git diff` reporting an unknown revision). This matches existing behavior; explicit unknown-flag validation is out of scope for this change.

---

## Step 1: Determine Review Scope & Capture Diff

> **CRITICAL:** The scope is determined ONCE in step 1a. Execute ONLY the matching path (1b OR 1c) — never both. The diff captured in that path is the SOLE source of truth for the entire review. Do NOT run `git diff`, `git log`, or any local git commands to second-guess or supplement a remote MR diff.

### 1a. Classify the argument

Parse the post-flag-strip `<review_scope>` (see **Parse Arguments** above) to determine the scope type. **Match the FIRST row that fits — then skip directly to the indicated step.**

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

If auto-detect found nothing (`NO_CHANGES`), tell the user: "No changes detected to review. Pass an MR URL or a git ref range, e.g., `/ba:review !123` or `/ba:review abc123..def456`" and exit. **When `PERSIST=true`, the `NO_CHANGES` exit takes precedence — no persist directory is created.**

---

### 1d. Announce scope

- For **mr** scope: "Reviewing MR !N: *[MR_TITLE]* — `[HEAD_BRANCH]` into `[BASE_BRANCH]` ([N] files, +[additions] -[deletions])."
- For **branch** scope: "Reviewing branch `[CURRENT_BRANCH]` against `[DIFF_BASE]` ([N] files, [N] lines changed)."
- For **staged** scope: "Reviewing staged changes ([N] files, [N] lines changed)."
- For **recent** scope: "Reviewing last [N] commits ([N] files, [N] lines changed)."

**When `PERSIST=true`**, also announce on a second line the fully-resolved persist target — substitute `${TIMESTAMP}` (captured in Parse Arguments) and the `SCOPE_REF` derived from `SCOPE_TYPE` (see Step 4.5a's table). Example: `Persist target: docs/reviews/2026-05-13-143022-feat_add-auth/`. Show this *before* Step 2's reviewer selection so the user can `^C` if the target path looks wrong.

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

List the seven built-in review agents from `agents/review/`:

| Agent | Focus |
|---|---|
| `architecture-reviewer` | Codebase patterns, coupling, separation of concerns, naming |
| `security-reviewer` | XSS, sensitive data, auth patterns |
| `simplification-reviewer` | Over-engineering, unnecessary abstraction, YAGNI |
| `error-handling-reviewer` | Edge cases, error paths, graceful failures |
| `test-coverage-reviewer` | Missing test scenarios, test quality |
| `deep-module-reviewer` | Ousterhout deep-module design: small interface / deep implementation, dependency injection, return-over-side-effects, duplication, shallow-layer merging |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |

**All seven built-in reviewers MUST appear as options in Step 2c. Do not filter or omit any.**

### 2b. Discover external reviewers

**This step is mandatory.** Do not skip it or substitute it with a curated list. Run all Glob calls in parallel:

```
Glob("**/*.md", path="~/.claude/agents/")
Glob("**/*.md", path="~/.claude/skills/")
Glob("**/*.md", path="~/.claude/commands/")
Glob("**/*.md", path=".claude/agents/")
Glob("**/*.md", path=".claude/commands/")
Glob("**/*.md", path=".agents/")
Glob("**/*.md", path=".agents/agents/")
Glob("**/*.md", path=".agents/skills/")
Glob("**/*.md", path=".agents/commands/")
```

Read each discovered file's frontmatter (first 15 lines). The frontmatter is the authoritative source — it may be richer than the system-reminder summary. Include the file if its `name`, `description`, or any frontmatter field contains any of: "review", "code-review", "reviewer", "quality", "lint", "audit", "assess", "guidelines", "compliance", "pattern", "architecture", "composition".

**If a file matches the keywords above, include it.** Only exclude if it is one of these specific categories: plan writers (`ba:plan`, `ba:brainstorm`), execution commands (`ba:execute`), fixer skills that modify code rather than producing read-only findings (`simplify`), or the built-in agents already listed in 2a. When in doubt, include — let the user decide.

**Also scan the system-reminder skills list** as a fallback for skills not stored as files. Include any skill whose name or description matches the same keywords above. Exclude: `ba:review`, `ba:review-plan`, fixer skills (`simplify`), and other orchestration skills. Fixer skills modify code rather than producing read-only findings — they violate the reviewer contract and risk mutating the working tree during parallel review execution.

**Skills and commands are valid reviewers regardless of which directory they live in.** A skill that performs code review, audit, or quality assessment should be included.

For each discovered external reviewer, record:
- **name**: from frontmatter
- **description**: from frontmatter
- **source**: "agent" or "skill"

### 2c. Present unified selection

Use **AskUserQuestion** with `multiSelect: true` to present reviewers. Each reviewer gets its own individual option — never bundle multiple reviewers into a single option.

**Never hide or remove reviewers.** All built-in reviewers and all discovered external reviewers must appear as separate options. If an external reviewer overlaps with a built-in (e.g., both cover architecture or naming), show both — append "(overlaps with [built-in name])" to the external's description so the user can make an informed choice.

**AskUserQuestion limits:** 1-4 questions per call, 2-4 options per question. Distribute reviewers across multiple questions within a single call to stay within these limits.

**Distribution rules:**

1. Collect all reviewers into an ordered list: 7 built-ins first, then discovered externals.
2. Partition into groups of 2-4. Prefer groups of 3-4 to minimize the number of questions. Never leave 1 reviewer alone in a group — merge it into the adjacent group (keeping that group at ≤4).
3. Use short `header` values (max 12 chars) to label each question, e.g.: `"Analysis"`, `"Quality"`, `"External"`.
4. If total reviewers exceed 16 (4 questions × 4 options), present the first 16 and list any remaining in a follow-up text message.

**Typical distributions:**

| Scenario | Questions |
|---|---|
| 7 built-in, 0 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") |
| 7 built-in, 1 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") |
| 7 built-in, 2-4 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") · Q3: 2-4 externals (header "External") |
| 7 built-in, 5+ external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") · Q3-Q4: remaining externals partitioned to never leave 1 alone (header "External") |

**Question text:** First question: `"Which reviewers should I run? (select all that apply)"`. Subsequent questions: `"Additional reviewers:"`.

**Option format:**
- Built-in: label = `"Architecture reviewer"`, description = `"Codebase patterns, coupling, separation of concerns, naming"`
- External: label = `"dragon-test-reviewer (agent)"`, description = `"Dragon testing conventions (overlaps with Test coverage reviewer)"`

If no external reviewers were found after running the Globs, say so explicitly after presenting built-ins: "No external reviewers found in ~/.claude/agents/, ~/.claude/skills/, ~/.claude/commands/, .claude/agents/, .claude/commands/, .agents/, .agents/agents/, .agents/skills/, .agents/commands/."

If the user selects nothing across all questions, ask: "No reviewers selected. Would you like to exit or re-select?"

---

## Step 3: Run Reviews in Parallel

For each selected reviewer, dispatch a fresh subagent using the Agent tool — regardless of whether it is an agent or a skill. Every reviewer must run in its own isolated context.

For **agent-based reviewers**, prompt the subagent directly:

- Task <reviewer-agent>("Review these code changes for [dimension focus].

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

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

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

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

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

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

## Step 4.5: Persist Run Artifacts (if `--persist`)

> **Skipped entirely when `PERSIST=false`.** This step has no effect on the default flow.

When `PERSIST=true`, write the run's per-reviewer outputs and a consolidated summary to a dated directory under `docs/reviews/`. The command does **not** touch `.gitignore` in the consuming repo — ignoring `docs/reviews/` is the user's responsibility (see the "Runtime `.gitignore` management" entry in **What We're NOT Doing**).

### 4.5a. Derive the run directory name

`TIMESTAMP` was captured in Parse Arguments. Compute `SCOPE_REF` from `SCOPE_TYPE` (resolved by Step 1c, or set implicitly by Step 1b for `mr`):

| `SCOPE_TYPE` | `SCOPE_REF` formula | Example |
|---|---|---|
| `mr` | `mr-<N>` where N is the same MR/PR number Step 1b extracted | `mr-123` |
| `branch` | `sanitize(current_branch)`; on detached HEAD, falls through to `unknown` via the sanitize empty-string rule (HEAD SHA is still preserved in `summary.md`'s `head_sha` field) | `feat_add-auth`, `unknown` |
| `staged` | literal `staged` | `staged` |
| `recent` | literal `recent` (the underlying SHA range is recorded in `summary.md`'s scope section, not the directory name) | `recent` |
| `local-range` | `sanitize(range)` — `..` becomes `__`, slashes become `_` | `origin_main__HEAD`, `abc123__def456` |

**`sanitize(s)`**: replace every character outside `[A-Za-z0-9._-]` with `_`; collapse runs of `_` into one; trim leading and trailing `_`; if empty, fall back to `unknown`. Leading dots (`.bugfix` → `.bugfix`) and leading digits (`123-fix` → `123-fix`) pass through unchanged — the regex is intentionally permissive for both.

The full directory path is:

```
docs/reviews/${TIMESTAMP}-${SCOPE_REF}/
```

**Collision handling.** Before creating the directory, check whether it already exists. If yes, append `-2`, then `-3`, etc., to the full directory name until an unused name is found (`docs/reviews/${TIMESTAMP}-${SCOPE_REF}-2/`). One-second timestamp resolution makes this collision rare; the suffix is belt-and-braces.

### 4.5b. Create the run directory

```bash
mkdir -p docs/reviews/${TIMESTAMP}-${SCOPE_REF}/
```

### 4.5c. Write per-reviewer files

For each reviewer that was dispatched in Step 3, write a file named `<sanitized-reviewer-name>.md` inside the run directory.

Each per-reviewer file uses this template:

```markdown
---
reviewer: <reviewer-name>
source: built-in | external-agent | external-skill | user-typed
status: succeeded | failed
---

# <reviewer-name>

[Write the reviewer's **raw return text** here, verbatim as returned from the subagent in Step 3 — *not* Step 4's wrapped/consolidated form. If Step 4 injected any ⚠ Conflicting annotations against this reviewer's findings during consolidation, append them at the end with `(see also: <other-reviewer>.md)` cross-references so the file is readable on its own.

If `status: failed`, write a one-line failure reason in place of the raw text.
If `status: succeeded` but the reviewer returned an empty body, write `_Reviewer returned no findings._`]
```

### 4.5d. Write `summary.md`

The summary captures what a future reader needs to reconstruct the review without scrolling chat history:

```markdown
---
scope: mr | branch | staged | recent | local-range
timestamp: <TIMESTAMP>
head_sha: <git rev-parse HEAD at run time, or N/A for mr scope>
reviewers: [<reviewer-1>, <reviewer-2>, ...]
---

# Code Review — <scope description from Step 1d>

## Run Metadata

- Command: `/ba:review <original arguments including --persist>`
- Timestamp: <TIMESTAMP> (local time)
- HEAD SHA: <short SHA or N/A for mr scope>

## Scope

- Type: <SCOPE_TYPE>
- Diff stat: <STAT block from Step 1>
- Underlying SHA range (only when `recent` scope): <shortbase>..<shorthead>
- MR title / description: <if mr scope, from MR_TITLE + MR_DESCRIPTION; otherwise omit>
- Plan context (if Step 1e found one): plan filename + Overview + Acceptance Criteria, verbatim

## Reviewer Roster

| Reviewer | Source | Status | File |
|---|---|---|---|
| <reviewer-1> | built-in | succeeded | [<sanitized-name>.md](./<sanitized-name>.md) |
| <reviewer-2> | external-skill | failed | [<sanitized-name>.md](./<sanitized-name>.md) |
| ... | ... | ... | ... |

## Consolidated Findings

[The full Step 4 output verbatim — every reviewer's Must Address / Consider / Looks Good blocks, with conflict annotations.]
```

### 4.5e. Announce the persist target

After all writes complete:

> "Persisted review to `docs/reviews/${TIMESTAMP}-${SCOPE_REF}/` (`<N>` reviewer files + `summary.md`)."

If any write failed (`mkdir`, per-reviewer `Write`, or summary `Write`), warn:

> "⚠ Persist failed: `<reason>`. Findings above were displayed in chat only and are not on disk."

Continue to Step 5 regardless. The chat output is the source of truth on failure — the persist directory is supplementary.

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

**"Review one by one" flow:**

For each finding, use a single **AskUserQuestion** that includes the full finding context in the question text — do NOT output the finding as separate text before the question. The AskUserQuestion widget covers preceding text, so the user must be able to see everything they need inside the question itself.

**Question format:** `"Finding [N]/[total]: [title]\n\nFiles: [file:line references]\n\n[code snippet or description]\n\nAgree?"` — include enough context for the user to decide without scrolling up.

**Options:**
1. **Agree** — Include this in the review comments
2. **Skip** — Not worth flagging
3. **Modify** — Adjust the wording or severity before posting

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

**When `PERSIST=true`** and the user selects Done, also display: `Persisted to docs/reviews/<TIMESTAMP>-<scope-ref>/`.

### For MR/PR scope (remote)

Use **AskUserQuestion**:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Post inline comments** — Post findings as inline comments on the MR/PR (details below)
2. **Review one by one** — Walk through each finding for discussion
3. **Done** — Acknowledge findings without further action

**When `PERSIST=true`** and the user selects Done, also display: `Persisted to docs/reviews/<TIMESTAMP>-<scope-ref>/`.

**"Review one by one" flow:** Same as local scope — include the full finding context inside each AskUserQuestion's question text. Never output finding details as separate text before the question widget.

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
