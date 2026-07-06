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
gh pr view <N> --json title,body,baseRefName,headRefName,additions,deletions,changedFiles,files,author,headRefOid,isCrossRepository
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
- **MR_AUTHOR** — `author.login` (GitHub) / `author.username` (GitLab); also keep `author.name` (+ email if present) for the Step 5 authorship fallback
- **MR_HEAD_SHA** — `headRefOid` (GitHub) / `.diff_refs.head_sha` (GitLab; `.sha` is the alias)
- **IS_FORK** — `isCrossRepository` (GitHub) / `source_project_id != target_project_id` (GitLab)

If the CLI command fails (not installed, auth error, MR not found), report the error clearly and exit. Do not silently fall back to local.

**After extraction — capture the current user (for Step 5 authorship routing):**

GitHub:
```bash
gh api user --jq .login
```
GitLab:
```bash
glab api user --jq .username
```

If the user call fails (auth error), do **not** error out — record `CURRENT_USER` as unavailable; Step 5
will fall back to a best-effort `git config user.name` / `user.email` comparison. The review proceeds;
only own-MR fix-local routing is affected.

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

## Step 2: Discover, Judge & Select Reviewers

### 2a. Gather built-in reviewers

List the seven built-in review agents (all live flat in `agents/`):

| Agent | Focus |
|---|---|
| `architecture-reviewer` | Codebase patterns, coupling, separation of concerns, naming |
| `security-reviewer` | XSS, sensitive data, auth patterns |
| `simplification-reviewer` | Over-engineering, unnecessary abstraction, YAGNI |
| `error-handling-reviewer` | Edge cases, error paths, graceful failures |
| `test-coverage-reviewer` | Missing test scenarios, test quality |
| `deep-module-reviewer` | Ousterhout deep-module design: small interface / deep implementation, dependency injection, return-over-side-effects, duplication, shallow-layer merging |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |

**All seven built-in reviewers MUST appear in the selection ledger (Step 2d) — selected (`✓`)
or set aside (`○`), each with a reason. Never omit a reviewer from the ledger or from the
Adjust pick-list.**

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

### 2c. Judge each candidate against the diff

You already captured `FULL_DIFF` and `CHANGED_FILES` in Step 1. **Reuse that read — do NOT run
`git diff`, `glab mr diff`, `gh pr diff`, or any diff command here** (the Step 1f STOP rule still
binds). For **each** candidate reviewer — the seven built-ins **and** every discovered external,
judged uniformly with no built-in/external precedence — answer one question:

> **Does this diff contain substantive work in this reviewer's domain?**

This is a judgment call on the **surfaces actually present in the diff** — UI markup/styles,
exported symbols, untested logic, error/IO paths, auth/input handling, abstraction/coupling, test
files, and so on. It is **not** a scoring rubric and **not** a category→reviewer mapping. Judge
what the diff actually does. *(A fixed category→reviewer table is rejected on purpose: it
over-selects on shallow file-extension matches and under-selects on cross-cutting changes. Reading
the diff surfaces directly avoids both — do not regress this step into a lookup table.)*

- **Meaningful-work bar.** Select (`✓`) a reviewer only when the diff has substantive work in its
  domain — not a token file match, not merely a "safe pair." Otherwise set it aside (`○`).
- **Uniform pass.** Built-in and discovered-external reviewers clear the same bar. An external
  earns `✓` on merit; a built-in may be set aside.
- **Overlap.** When two otherwise-selected reviewers are largely redundant *on this diff*, keep
  the deeper one and set the other aside (`○`), naming the **surviving** reviewer as the reason.
  Keep both when each contributes a distinct part worth having. No numeric threshold — this is a
  stated judgment, recorded in the ledger. A built-in may be set aside by overlap with an external
  (and vice versa); name the survivor either way. For a three-way overlap, keep one and name it as
  the survivor for the other two.
- **Uncertainty.** When the call is genuinely 50/50, set aside (`○`) with a reason that names the
  **absent or ambiguous surface** — the ledger + Adjust make a wrong set-aside one toggle away to
  correct. (This is why `○` reasons must cite the missing surface, not say "not relevant": the
  honest reason is what lets the user spot a wrong call.)
- **Reason quality.** Every `✓` reason cites the **present** surface; every `○` reason cites the
  **absent** surface or the overlapping reviewer.

This judgment writes **no state** — it is recomputed fresh on every run.

### 2d. Present the selection ledger and confirm

Print the **full roster** as plain text (not a widget) in stable order — the seven built-ins
first, then discovered externals — every candidate on its own line:

```
Reviewer selection — <T> candidates (<S> ✓ selected, <A> ○ set aside)

✓ architecture-reviewer — new module with cross-cutting exports; structure worth a look
✓ simplification-reviewer — ~200-line addition; check for over-engineering
✓ test-coverage-reviewer — new exported logic arrives with no tests
○ security-reviewer — no auth, input-handling, or sensitive-data surface in this diff
○ error-handling-reviewer — no new IO or error paths
○ deep-module-reviewer — overlaps with architecture-reviewer here; architecture covers the structure
○ complexity-reviewer — diff is small and linear; no cognitive-load surface
○ dragon-test-reviewer (agent) — overlaps with test-coverage-reviewer on this diff
```

**No elision.** The real guarantee is the **enumeration**: every candidate appears on its own line
exactly once. Never truncate, summarize ("…and N others"), or drop a low-relevance reviewer — a
candidate missing from the ledger is unreachable, which violates the never-hide guarantee.

**Header count `<T>`** is a sanity aid, not the mechanism: the **pre-judgment** total =
`7 (built-ins from 2a) + count(all externals from 2b)` — every discovered candidate, including
borderline keyword matches kept under 2b's "when in doubt, include" rule. It is **not** the `✓` count.

If discovery (2b) found no externals, append after the roster: "No external reviewers found in
~/.claude/agents/, ~/.claude/skills/, ~/.claude/commands/, .claude/agents/, .claude/commands/,
.agents/, .agents/agents/, .agents/skills/, .agents/commands/." so an all-built-in ledger is
distinguishable from a discovery that silently failed.

Then confirm with a single **AskUserQuestion**. The branch depends on whether the `✓` set is empty.

**When the `✓` set is non-empty** — question: "Run the selected reviewers, or adjust the set?"
1. **Run the ✓ set** — dispatch the selected reviewers (Step 3).
2. **Adjust** — open the full pick-list to change the set.
3. **Cancel review** — exit without running any reviewer (no findings produced).

**When the `✓` set is empty** (no reviewer judged to have substantive work, e.g. a docs-only or
binary-only diff) — question: "No reviewer was judged to have substantive work in this diff. Pick
reviewers manually, or cancel?" Drop the "Run" option (per the never-dispatch-empty-set invariant
below); the options are exactly `1 = Adjust`, `2 = Cancel review` — no hidden "Run" at position 1.
1. **Adjust** — pick reviewers manually from the full list.
2. **Cancel review** — exit without running any reviewer.

> The third option is **Cancel review**, not "Done." This refines the brainstorm's shorthand
> "Done" to avoid colliding with Step 5's "Done" (acknowledge findings) and the misread "I'm done,
> proceed." It runs nothing and produces no findings.

**Common-case guarantee:** when the user accepts the default `✓` set ("Run the ✓ set"), exactly
**one** AskUserQuestion appears between the ledger and dispatch.

#### Adjust — full pick-list

Present **every** candidate from the ledger (built-in and external — the identical set, with **no**
judgment re-filtering) as an individual, selectable option via **AskUserQuestion** with
`multiSelect: true`. **Each reviewer gets its own option — never bundle multiple reviewers into a
single option.**

Apply these distribution rules:

1. Collect all reviewers into an ordered list: 7 built-ins first, then discovered externals.
2. Partition into groups of 2-4 (prefer 3-4 to minimize questions). If the final group would be a
   lone reviewer, rebalance with the adjacent group — split their combined members into two groups
   of 2-3, rather than pushing one group past 4.
3. Use short `header` values (max 12 chars), e.g. `"Analysis"`, `"Quality"`, `"External"`.
4. The reviewers marked `✓` in the ledger are the recommended default. **If the entering `✓` set
   is empty** (an all-`○` ledger), open Adjust with **nothing** pre-checked — do not fall back to
   the `○` set as a default.
5. **If candidates exceed 16** (the `AskUserQuestion` 4×4 ceiling), present them across consecutive
   `AskUserQuestion` calls (≤16 each), accumulating the picks in the orchestrator's turn context
   only (never persisted), so every reviewer stays individually selectable — never a non-selectable
   text list. Cancelling any round is a **Cancel review** (the invariant below).

The **"Other"** free-text option still accepts a reviewer name not in the roster; typed names
resolve via Step 3's user-typed handling, which is **self-contained in Step 3** and does not
depend on any logic removed from the old menu.

**Invariant — never dispatch an empty set.** This is the single rule behind both the empty-`✓`
branch above and any all-deselected Adjust result — they are two entry points to it, not competing
mechanisms. At any confirm or Adjust step, an empty resulting set routes to a forced choice, never
a silent run:
- **Non-empty** result → proceed to Step 3 with that set.
- **Empty** result (the judge selected none, or the user deselected everything) → ask "No reviewers
  selected. Adjust again or cancel?" Looping re-opens the pick-list; **cancel here is identical to
  "Cancel review"** at the confirm step — no reviewers run, no findings, no persist directory created.

Discovery (2b) is **not** re-run on Adjust or on any loop — the roster is fixed for the run.

---

## Step 3: Run Reviews in Parallel

For each selected reviewer, dispatch a fresh subagent using the Agent tool — regardless of whether it is an agent or a skill. Every reviewer must run in its own isolated context.

**Built-in vs external dispatch:** built-in plugin reviewers use `subagent_type: dev-workflow:<name>` (e.g. `dev-workflow:security-reviewer`). The selection ledger shows bare display names for readability; the dispatch uses the fully-qualified ID — this does not affect ledger presence or the never-hide convention. Discovered **external** reviewers (e.g. `code-reviewer`, `dragon-test-reviewer`) dispatch by their own discovered name, **never** prefixed with `dev-workflow:`.

For **agent-based reviewers**, prompt the subagent directly:

- Task <reviewer-agent>("Review these code changes for [dimension focus].

**Severity ladder and confidence.** Return findings under the four-level ladder + `Looks Good`. Each non-`Looks Good` bullet must include a confidence anchor between the file:line marker and the body.

Bullet format (exact):

`- **<path>:<line>** *(confidence: N)* — <body>`

where `N ∈ {0, 25, 50, 75, 100}`.

**Anchor scope.** The `<path>:<line>` anchor must identify a location in the codebase under review — a file in `Changed files` or reachable via `git ls-files`. Rubrics, specs, and external guideline documents are cited in the body, never as the anchor. A finding that compares the codebase against an external rubric should anchor to the offending in-repo file and reference the rubric in the body. Example: `**src/Button.tsx:42** ... — missing keyboard handler (per web-interface-guidelines §3.2)` anchors to the in-repo file, not to the guideline. Anchors that don't resolve in the repo are dropped by the consolidation pipeline.

| Heading | Meaning |
|---|---|
| `## Critical` | Correctness, security, production-breaking, data-loss risk. Must fix before merge. |
| `## High` | Significant defect or risk. Strongly recommended. |
| `## Medium` | Clear improvement, not blocking. |
| `## Low` | Nit, style, micro-improvement. |
| `## Looks Good` | Positive observation. No file:line, no confidence. Format: `- [Validated aspect]`. |

| Confidence | Meaning |
|---|---|
| `100` | Certain. |
| `75` | High; minor context risk. Default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. |
| `25` | Speculative; flag only when missing it would be costly. |
| `0` | Suppress. Records the consideration; will not be displayed. |

If no issues at a severity, write `None` under that heading. Do not invent placeholder bullets.

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

Context:
- Scope: [scope description]
- MR context: [MR title + description, if MR scope]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Review the diff AND read the full content of changed files for context. Return findings in the standard format described above (Critical / High / Medium / Low / Looks Good with confidence anchors and file:line references).")

For **skill-based reviewers**, instruct the subagent to invoke the skill:

- Task general-purpose("Use the `[skill-name]` skill to review these code changes.

**Severity ladder and confidence.** Return findings under the four-level ladder + `Looks Good`. Each non-`Looks Good` bullet must include a confidence anchor between the file:line marker and the body.

Bullet format (exact):

`- **<path>:<line>** *(confidence: N)* — <body>`

where `N ∈ {0, 25, 50, 75, 100}`.

**Anchor scope.** The `<path>:<line>` anchor must identify a location in the codebase under review — a file in `Changed files` or reachable via `git ls-files`. Rubrics, specs, and external guideline documents are cited in the body, never as the anchor. A finding that compares the codebase against an external rubric should anchor to the offending in-repo file and reference the rubric in the body. Example: `**src/Button.tsx:42** ... — missing keyboard handler (per web-interface-guidelines §3.2)` anchors to the in-repo file, not to the guideline. Anchors that don't resolve in the repo are dropped by the consolidation pipeline.

| Heading | Meaning |
|---|---|
| `## Critical` | Correctness, security, production-breaking, data-loss risk. Must fix before merge. |
| `## High` | Significant defect or risk. Strongly recommended. |
| `## Medium` | Clear improvement, not blocking. |
| `## Low` | Nit, style, micro-improvement. |
| `## Looks Good` | Positive observation. No file:line, no confidence. Format: `- [Validated aspect]`. |

| Confidence | Meaning |
|---|---|
| `100` | Certain. |
| `75` | High; minor context risk. Default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. |
| `25` | Speculative; flag only when missing it would be costly. |
| `0` | Suppress. Records the consideration; will not be displayed. |

If no issues at a severity, write `None` under that heading. Do not invent placeholder bullets.

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

Context:
- Scope: [scope description]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Return findings in the standard format described above (Critical / High / Medium / Low / Looks Good with confidence anchors and file:line references).")

For **user-typed reviewers** (names typed manually that are not in the built-in or discovered lists):

Before dispatching, **resolve the name** against known skills and agents:

1. **Normalize:** strip any leading `/` from the typed name to get the bare name
2. **Match against skills:** check if the bare name (or any prefix-qualified variant like `namespace:bare-name`) appears in the system-reminder skills list. Also check if a `/bare-name` skill exists. If matched → dispatch as a **skill-based reviewer** (same template as above)
3. **Match against agent types:** check if the bare name matches the **suffix** of a registered `dev-workflow:<name>` ID (e.g., typing `security-reviewer` matches `dev-workflow:security-reviewer`). If matched → dispatch as an **agent-based reviewer** using the full `dev-workflow:<name>` ID (same template as above). If the bare name matches a non-`dev-workflow:` registered agent type exactly, dispatch by that name.
4. **No match → custom review dimension:** dispatch as a `general-purpose` subagent — do NOT use the typed name as `subagent_type` since it won't be a registered agent type:

- Task general-purpose("You are a code reviewer specializing in **[user-typed name]**. Review these code changes through that lens.

**Severity ladder and confidence.** Return findings under the four-level ladder + `Looks Good`. Each non-`Looks Good` bullet must include a confidence anchor between the file:line marker and the body.

Bullet format (exact):

`- **<path>:<line>** *(confidence: N)* — <body>`

where `N ∈ {0, 25, 50, 75, 100}`.

**Anchor scope.** The `<path>:<line>` anchor must identify a location in the codebase under review — a file in `Changed files` or reachable via `git ls-files`. Rubrics, specs, and external guideline documents are cited in the body, never as the anchor. A finding that compares the codebase against an external rubric should anchor to the offending in-repo file and reference the rubric in the body. Example: `**src/Button.tsx:42** ... — missing keyboard handler (per web-interface-guidelines §3.2)` anchors to the in-repo file, not to the guideline. Anchors that don't resolve in the repo are dropped by the consolidation pipeline.

| Heading | Meaning |
|---|---|
| `## Critical` | Correctness, security, production-breaking, data-loss risk. Must fix before merge. |
| `## High` | Significant defect or risk. Strongly recommended. |
| `## Medium` | Clear improvement, not blocking. |
| `## Low` | Nit, style, micro-improvement. |
| `## Looks Good` | Positive observation. No file:line, no confidence. Format: `- [Validated aspect]`. |

| Confidence | Meaning |
|---|---|
| `100` | Certain. |
| `75` | High; minor context risk. Default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. |
| `25` | Speculative; flag only when missing it would be costly. |
| `0` | Suppress. Records the consideration; will not be displayed. |

If no issues at a severity, write `None` under that heading. Do not invent placeholder bullets.

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

Context:
- Scope: [scope description]
- Plan context: [overview + acceptance criteria from plan, if available]

Diff:
[the captured diff]

Changed files: [list of changed file paths]

Review the diff AND read the full content of changed files for context. Return findings in the standard format described above (Critical / High / Medium / Low / Looks Good with confidence anchors and file:line references).")

Run all selected reviewers **in parallel**.

If a reviewer fails or returns empty: note it for the summary but do not block other results.

---

## Step 4: Consolidate & Present Findings

After all reviewers complete, the orchestrator runs a five-step internal pipeline. Reviewers emit prose; the orchestrator extracts records; the user sees re-rendered prose. **The user-visible output is prose. The records are internal to consolidation.**

### 4a. Parse each reviewer's raw return text

For each reviewer's return text, extract records using this grammar (permissive):

| Token | Rule |
|---|---|
| Severity section | `^## ` followed by a recognised label (case-insensitive): `Critical`, `High`, `Medium`, `Low`, `Looks Good`. Trailing text after the label is allowed (`## Critical Issues` matches `Critical`). |
| Legacy section | `^## ` followed by `Must Address` or `Consider` — map `Must Address → High`, `Consider → Medium`. A reviewer whose output contains **only** legacy headings (no new-ladder headings) increments `legacy_format`. A reviewer whose output mixes legacy headings with at least one new-ladder heading increments `mixed_format` instead. The two counters reflect distinct conditions: `legacy_format` flags reviewers needing wholesale updates; `mixed_format` flags reviewers that are partially compliant. |
| Bullet anchor | `^- \*\*<path>:<line>\*\*` — `path` non-empty; `line` is a positive integer. First `**…**` matching `path:line` shape on the line is the anchor; subsequent bold markers are body content. |
| Confidence marker | After the anchor, optional `\*\(confidence:\s*<N>\s*\)\*` (case-insensitive on `confidence`). |
| Em-dash separator | `—`, `–`, or `--`, optionally surrounded by whitespace. |
| Body | Everything after the separator until the next bullet (`^- \*\*`) or next heading (`^## `). Non-bullet, non-heading lines are body continuation of the parent bullet. |
| `None` token | A heading whose only content is the literal `None` (case-insensitive, possibly `_None_` / `*None*`) emits zero records under that heading. No warning. |
| `Looks Good` bullet | Format stays `- [Validated aspect]`. No file:line, no confidence. Record severity = `Looks Good`; skip anchor/confidence extraction. **Separate bucket — not a rung on the Critical/H/M/L ladder.** Confidence floor does not apply; dedup does not cross `Looks Good` and other severities; merge/promotion math is irrelevant. |

Worked example — the line `- **src/auth.ts:42** *(confidence: 75)* — SQL injection risk in `where` clause; the user-supplied id is concatenated into the query string.` parses as `severity=<section>, file=src/auth.ts, line=42, confidence=75, body=SQL injection risk in \`where\` clause; the user-supplied id is concatenated into the query string.`. The complexity-reviewer's lens tag (`[cognitive load]` / `[change amplification]` / `[obscurity]`) and the deep-module-reviewer's `Current:` / `Suggested:` / `Impact:` continuation lines both fall under `body` and are preserved verbatim through the pipeline.

Produce a list of records `(severity, file, line, confidence, body, reviewer_name)` per reviewer.

### 4b. Validate each record

For each non-`Looks Good` record, run these checks. Increment the named counter on failure.

| Check | Action on failure | Counter |
|---|---|---|
| Severity ∈ {Critical, High, Medium, Low} | Default to `Low` | `coerced` (shared) |
| File path non-empty AND line is positive integer | Drop record | `dropped_no_fileline` |
| Confidence ∈ {0, 25, 50, 75, 100} | If numeric: snap to nearest anchor (ties go up). If non-numeric or missing: default to the section severity's floor (`Critical → 50`, `H/M/L → 75`). | `snapped` or `confidence_default` |
| Body non-empty | Coerce body to `(no description)` | `coerced` (shared) |
| File exists somewhere in the repo (`git ls-files \| grep -Fx "<path>"`) | Drop record | `dropped_file_not_in_repo` |
| File present in `CHANGED_FILES` from Step 1 | If absent, keep record; append `(off-diff)` to body | `off_diff` (informational, not a warning) |

The `coerced` counter is shared between severity-default and empty-body coercions — both signal "the reviewer's output needed light salvaging" and both fire rarely, so a single counter is enough signal without inflating the warning list. The `off_diff` counter is informational: an off-diff citation is not an error. Any reviewer that intentionally traces beyond `CHANGED_FILES` (complexity-reviewer's one-hop traversal, an architecture-reviewer following an import chain, etc.) receives the annotation so the reader can see at a glance that the cited file is off-diff and referenced for context.

`Looks Good` records skip every check above (severity coercion, file:line validation, confidence snapping, file-in-repo, off-diff) — `Looks Good` is a separate bucket, not a rung on the Critical/H/M/L ladder, so the confidence floor does not apply. Two checks still run: an empty body is coerced to `(no description)` and increments `coerced` (same rule as the H/M/L path); a `## Looks Good` heading whose only content is the literal `None` token emits zero records, per §4a's `None` rule (which applies uniformly to every severity heading).

### 4c. Group records by `file:line` fingerprint

Group all non-`Looks Good` records by exact `<file>:<line>` match. `Looks Good` records are grouped separately — they only merge among themselves.

### 4d. Merge each group

For groups of size ≥ 2:

- **Severity** = `max(group)` using rank `Critical (4) > High (3) > Medium (2) > Low (1)`.
- **Confidence** = `max(c_i for i where c_i > 0) + 25 × (count(c_i > 0) − 1)`, capped at 100. The anchor step size is **25** (the gap between adjacent anchors in `{0, 25, 50, 75, 100}`). Reviewers with `c_i = 0` are excluded from both the `max(·)` and the count — a zero vote records the consideration in attribution but does not corroborate the finding, because `0` means "consider but suppress." Worked examples: two reviewers at 50/50 → `50 + 25 × 1 = 75`; three reviewers at 50/50/50 → `50 + 25 × 2 = 100`; three reviewers at 75/50/50 → `75 + 25 × 2 = 125 → 100` (capped); two reviewers at 75/0 → `75 + 25 × 0 = 75` (the zero contributes nothing).
- **Body** = render the merged-finding template (see 4f). Keep every reviewer's bullet with attribution.

For groups of size 1, pass through with no attribution suffix — the single reviewer's identity is already discoverable from the Coverage block, and the omission keeps single-reviewer findings to one tight line. Reviewer attribution is reserved for merged findings where it carries real information.

### 4e. Apply soft gate

Compare each merged record's *merged confidence* against the *merged severity*'s floor:

| Merged severity | Confidence floor |
|---|---|
| Critical | ≥ 50 |
| High / Medium / Low | ≥ 75 |

Below-floor records move to the `## Suppressed (low confidence)` bucket. Above-floor records render in the main severity sections.

When a `Critical` finding falls below its floor, increment `critical_suppressed`. This counter is surfaced in the consolidation header so high-stakes findings are not buried.

### 4f. Render

Render the consolidated output:

````markdown
## Code Review Summary

Scope: <scope description from Step 1d>
Reviewers: <N> ran, <N> succeeded, <N> failed
Findings: <raw_count> raw → <displayed_count> after dedup
<conditional warning lines — see header template below>

### Critical
- **<file>:<line>** *(confidence: <N>)* — <body or merged template>

### High
- ...

### Medium
- ...

### Low
- ...

### Looks Good
- <validated aspect>

### Suppressed (low confidence) — <K> findings

#### Critical *(suppressed)*
- **<file>:<line>** *(confidence: <N>)* — <body>

#### High *(suppressed)*
- ...

(Heading levels: the suppressed bucket is an H3 / `###` peer of the main severity sections; its inner severity sub-headings use H4 / `####` so they nest one level deeper. Plain Markdown headings — no HTML — because this block renders inline in the Claude Code terminal, which prints raw `<details>`/`<summary>` tags as literal text instead of collapsing them.)

## Coverage

- Files reviewed: <list>
- Files skipped (binary): <list, if any>
- Reviewers that failed: <list, if any>
````

**Header warning lines** — each `⚠ ...` line is emitted only when its counter is ≥ 1. When multiple fire in the same run, render them in the order shown in the block below (so two runs of the same review can be diffed line-for-line to spot regressions):

```
⚠ <K> Critical findings suppressed by confidence gate — see Suppressed section
⚠ Defaults applied: <C> missing confidence (→ section floor: Critical=50, H/M/L=75)
⚠ Snapped: <P> findings to nearest confidence anchor
⚠ Coerced: <X> findings (severity defaulted to Low, or body coerced to "(no description)")
⚠ Dropped: <D> findings (no file:line) + <F> findings (file not in repo)
⚠ Off-diff: <O> findings reference files outside the diff (informational, not a warning)
⚠ Legacy-format detected: <L> reviewers
⚠ Mixed-format detected: <M> reviewers
```

When `raw_count == displayed_count`, render `Findings: <count> (no overlap)` instead of `<count> raw → <count> after dedup`.

**Merged-finding template:**

Show `(own_severity, conf own_conf)` only when the reviewer's own severity OR confidence differs from the merged values. When a reviewer agrees on both, the attribution line drops the parenthetical entirely:

```markdown
- **<file>:<line>** *(confidence: <merged_conf>, merged from <K> reviewers)* — <highest-severity reviewer's one-sentence summary>
  - *<reviewer-1> (<own_severity>, conf <own_conf>):* <full body>   ← shown only when diverging from merged
  - *<reviewer-2>:* <full body>                                       ← own_severity AND own_conf match merged
  - ...
```

This reserves the dense `(severity, conf)` metadata for cases where divergence matters — typically the most useful signal in a merged finding.

For single-reviewer findings (no merge layout), pass through without attribution:

```markdown
- **<file>:<line>** *(confidence: <N>)* — <body>
```

Do NOT write `- **<file>:<line>** *(confidence: <N>, via <reviewer-name>)* — <body>` for single-reviewer findings; the reviewer identity is recoverable from the Coverage block. Per-line attribution is reserved for merged findings.

The pipeline operates as `parse → validate → group → merge → gate → render`: dedup happens **before** the soft gate so corroboration can promote a finding past its floor (the `+25 per extra reviewer` math is what makes the ordering matter).

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

[Write the reviewer's **raw return text** here, verbatim as returned from the subagent in Step 3 — *not* Step 4's wrapped/consolidated form. Cross-reviewer merges, suppression, and validator coercions are recorded only in `summary.md`; per-reviewer files stay raw so a reader can always reconstruct what each reviewer actually said.

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

[The full Step 4 output verbatim — the consolidation summary with severity sections, merged findings, the suppressed section, and the header warning counters.]

## Validator Warnings

The internal validator coerced or dropped the following records during consolidation. Per-reviewer files (`<reviewer>.md` in this directory) contain the raw reviewer output for reference.

<one bullet per reviewer with at least one warning, e.g.:>
- *<reviewer-name>*: dropped <N> findings (no file:line); snapped <M> confidence values; <K> findings annotated `(off-diff)`.

When no warnings fired, omit this section entirely.
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

> **Unified fix-local walk.** This section is reached by both local-scope review and own-MR **Fix locally**
> (the MR menu's authored-by-you branch). The `Apply Critical + High + Med-conf-100` filter defined in this
> section (see **Filter for `Apply Critical + High + Med-conf-100`** below) is the **single source of
> truth** for that predicate — the others'-MR posting menu and the README bullet reference it by name
> rather than restating it, so the filter lives in one place.

Use **AskUserQuestion**:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Accept all recommendations** — Apply each finding's recommended disposition (apply recommended-Apply, skip recommended-Skip); pause only at recommended-Modify to collect your edit.
2. **Apply Critical + High + Med-conf-100** — Critical + High at displayed confidence, plus Medium only when confidence == 100; Low and lower-confidence Medium excluded. Always offered; reports "0 findings matched the filter" when nothing qualifies.
3. **Review one by one** — Go through each finding and decide Apply/Skip/Modify
4. **Done** — Acknowledge findings without modifying code

**Recommended disposition (per finding).** Every rendered post-gate finding carries a **recommended
disposition** — Apply, Skip, or Modify — and a one-line reason, e.g. `(Recommended — Apply: clean
mechanical fix, no taste call)` or `(Recommended — Skip: stylistic, your call)`. The recommendation is
a **fix-quality judgment**, not a severity threshold — a clean Medium may be Apply; a High taste-call
may be Skip. Severity does **not** gate eligibility: unlike the retired severity-filtered "Apply all
fixes", a **Low** finding may carry a recommended **Apply** and be applied under either mode — the
fix-quality judgment decides, not the rung. This property is computed once, at presentation time (no
stored field on the finding schema), and is read by both the "Review one by one" flow below and the
"Accept all recommendations" flow below.

**"Review one by one" flow:**

For each finding, use a single **AskUserQuestion** that includes the full finding context in the question text — do NOT output the finding as separate text before the question. The AskUserQuestion widget covers preceding text, so the user must be able to see everything they need inside the question itself.

**Question format:** `"Finding [N]/[total]: [title]\n\nFiles: [file:line references]\n\n[code snippet or description]\n\nDisposition?"` — include enough context to decide without scrolling up.

**Options** (recommended disposition listed first and pre-selected — confirming is one step):
1. **Apply** — Mechanically apply the suggested fix to the local working tree.
2. **Skip** — Don't apply (a taste call, or not worth it on your own code).
3. **Modify** — Apply with edits: you describe the adjustment, then it's applied.

Per **Recommended disposition (per finding)** above, each finding leads with its recommendation; the
recommended option is first and pre-selected — overriding it costs exactly one interaction. No finding
is hidden or pre-decided beyond the default selection.

For a finding **resurfaced by the guard**, show its prior-revert marker and recommend **Skip**
or **Modify** (not Apply) — re-applying the identical reverted fix would just re-fail. The **bulk** apply
modes (`Accept all recommendations` / `Apply Critical + High + Med-conf-100`) skip any prior-revert-marked finding for
the same reason — a resurfaced finding is only re-applied through a deliberate per-finding choice.

**"Accept all recommendations" flow:**

Iterate the rendered (post-gate) findings in order, executing each finding's recommendation per
**Recommended disposition (per finding)** above — with **no per-finding confirmation**:
- **Recommended Apply** → apply the suggested fix silently.
- **Recommended Skip** → skip silently.
- **Recommended Modify** → **pause at this finding only**, presenting the identical per-finding
  "Review one by one" AskUserQuestion (finding context inside the question text, recommended option
  first and pre-selected) so the user can Modify (describe the edit), Skip, or Apply; then continue.

**Prior-revert-marked (guard-resurfaced)** findings are never auto-applied — same as the confidence
filter bulk mode — they are deferred to a deliberate one-by-one walk and counted as **Deferred**, not
Skipped.

**Selecting the option is the sole confirmation** — there is no up-front prompt or manifest before the
silent apply.

If **every** finding is recommended-Modify, this degenerates into the per-finding walk (a pause at
each) — acceptable, no special handling.

The applied set (recommended-Apply + Modify edits) funnels through the **existing** post-apply guard
(reconciliation + verify-then-keep, below) and the **protected-artifacts applier guard** (below) — the
silent apply must never apply a finding that deletes, relocates, or renames a protected doc. If the
accepted set is empty (all Skipped/Deferred, or zero findings), the **empty-set clause** below applies —
apply nothing and return to the menu — but first emit the **Critical/High skipped-by-recommendation**
callout (see summary below) if any such finding was skipped, so a bare "nothing applied" cannot bury a
blocking-severity skip.

There is **no dedicated mid-run abort** (matches the existing bulk modes) — each recommended-Modify
pause is a normal per-finding decision (the user may Skip there instead). The guard runs **once, after
the loop**, not per finding: if the run is interrupted before it completes, the recommended-Apply
fixes already applied stay in the working tree **unverified** — the same exposure window as today's
sequential bulk apply, widened only by the Modify pauses.

**After the guard**, render a compact post-guard outcome summary, e.g. `Applied N · Skipped M ·
Modified K · Resurfaced R (open) · Deferred D`. This summary is the accept-all flow's headline over
the guard's standard **Return to the menu** step (below) — it does not replace that step and does not
re-list the resurfaced findings the guard already surfaces as open; the counts are the headline, the
guard's open-findings list is the detail. It reflects guard outcomes: a fix the guard
auto-reverted moves out of Applied/Modified into **Resurfaced (open)**; **Deferred** is the
prior-revert-marked findings sent to a deliberate walk; and any **Critical/High finding
skipped-by-recommendation** is called out explicitly so a blocking-severity skip is never buried. Omit
zero-count buckets to stay compact.

**After applying accepted dispositions (the guard).**
Runs on any per-finding Apply/Modify or bulk apply disposition (`Accept all recommendations`,
`Apply Critical + High + Med-conf-100`), regardless of entry point (Fix locally sub-menu or direct
"Walk one by one"). **Empty-set clause:** if the accepted set is empty (all Skipped, or a filter that matched zero), apply nothing,
note "nothing applied," and return to the menu — no reconciliation, no test run.

**1. Bidirectional reconciliation.** Map findings to edits by **target region** (file + line range),
many-to-many — one edit may satisfy several findings; one finding may need edits across files:
- **Under-application** — an accepted (Apply/Modify) finding whose target region was NOT changed.
  Surface: "Finding <N> was accepted but no edit landed." Never silently resolve.
- **Over-application** — an edit to a region NO accepted finding targets (e.g., a Skipped finding's
  region). Surface: "An edit touched <file:line> but no accepted finding targets it." Never silently
  resolve.
- A **Modify** satisfies its finding via the modified edit. For both Apply and Modify, "target region"
  means the **applied edit's actual diff region** (not the suggested fix's text), so a legitimately wider
  Modify is not flagged as over-application. A multi-file finding counts as **applied** when any of its
  targeted regions is edited — a partial Modify is the user's choice, not under-application.
- On a **bulk** apply (`Accept all recommendations` / `Apply Critical + High + Med-conf-100`), edits land sequentially
  and shift later line numbers; match each finding's target region against the post-edit offsets, and treat
  a residual shifted-anchor mismatch as expected noise the user can dismiss — not a real over/under-application.

**2. Verify-then-keep (auto-revert + resurface).** Detect the project's targeted test/compile command
for the affected files (from repo conventions — `package.json` scripts, Makefile target, language
default, or a command documented in CLAUDE.md/README):
- **Could not verify** (no runnable test/compile command for the affected files) → keep the fixes but
  surface: "applied fixes were NOT verified (no runnable tests for the affected files) — review
  manually." Unverified is distinct from passing.
- Otherwise, note whether the targeted tests **already pass before applying** (a cheap baseline run; if a
  baseline can't be established, treat the pre-state as unknown). Apply, then re-run:
  - **Green** → keep the fixes.
  - **Newly red** (passed at baseline, fail after applying) → **auto-revert and resurface**: when the
    test output *clearly* implicates a specific fix's file(s), revert that fix; otherwise revert **all**
    fixes from this apply batch — never guess the culprit, never leave a newly-failing tree. Resurface
    each reverted finding as an open finding ("an unverified fix is not finished"). Reverting the whole
    batch when attribution is unclear also avoids cascade / half-state issues between dependent fixes.
  - **Already red / environmental** (failing at baseline, or failing for env reasons — missing deps, no
    services, no DB) → the failure is **not attributable** to the applied fixes: keep the fixes and
    surface "tests failing independently of the applied fixes — review manually." Do **not** revert good
    work for a broken environment.
  - **Unknown baseline** (the pre-apply baseline could not be established) and post-apply **red** → the
    failure is **not attributable** to the applied fixes either (no baseline to compare against): keep the
    fixes and surface "tests failed after applying, but the pre-apply baseline could not be established —
    cannot attribute the failure to these fixes; review manually." Do **not** revert without attribution.

Auto-revert is the **only** sanctioned reversal; it is never a silent drop because the resurfacing IS
the surfacing.

**3. Return to the menu** with the reconciliation report (if any), the verify outcome, and any
resurfaced findings listed as **open**. A resurfaced finding re-enters at the menu, **not** auto-re-walked;
re-attempting is user-driven, and the walk recommends Skip/Modify for it so a broken fix can't
loop. No skipped finding is ever applied; no accepted finding is reversed except via this surfaced revert.

**Protected artifacts (applier-facing).** The applier may edit the **content** of files under
`docs/{brainstorms,plans,solutions,research,reviews}/` when a finding targets them, but must never apply
a finding that deletes, relocates, or renames them — consistent with the reviewer-dispatch guard
(identity protected, contents not).

**Filter for `Apply Critical + High + Med-conf-100`:** From the **rendered (post-gate) findings only** — *not* the `Suppressed (low confidence)` section — select each finding where `severity == Critical OR severity == High OR (severity == Medium AND confidence == 100)`. The merged confidence (post-Step-4d, after `+25 per extra reviewer` promotion) is the value compared. The option is always offered. If zero findings match, report `"0 findings matched the filter (Critical + High + Med-conf-100)."` and return to this menu (do not treat as `Done`).

**After "Done":**

Use **AskUserQuestion**:

**Question:** "What would you like to do next?"

**Options:**
1. **Create MR/PR** — Generate merge/pull request
2. **Re-run review** — Run `/ba:review` again (e.g., after manual fixes)
3. **Done** — Exit

**When `PERSIST=true`** and the user selects Done, also display: `Persisted to docs/reviews/<TIMESTAMP>-<scope-ref>/`.

### For MR/PR scope (remote)

**Authorship determination.** Before showing the menu, determine whether this MR is yours.
Compare `MR_AUTHOR` to `CURRENT_USER`, trimming whitespace — **case-insensitively for GitHub** (logins
are case-insensitive) and **case-sensitively for GitLab** (usernames are case-sensitive) (GitHub
`author.login` vs `gh api user --jq .login`; GitLab `author.username` vs `glab api user --jq .username`).
If `CURRENT_USER` is unavailable, fall back to comparing `git config user.name` against `MR_AUTHOR`'s
name — email is usually absent from both `gh`/`glab` MR-view author objects, so this is a best-effort
name comparison. Because a name match is too weak to grant fix-local — common names collide and
`git config user.name` may be a substring of `author.name` — **the fallback never yields `mine`**: a
name match yields **undetermined**, a clear mismatch yields **theirs**, and only a login-to-login
comparison (when `CURRENT_USER` is available) can yield **mine**. If `CURRENT_USER` is unavailable
**and** git config has no identity (fresh clone, CI), there is nothing to compare → **undetermined**,
reason "no local git identity configured".

Set `MR_AUTHORSHIP`:
- **mine** — author matches current user.
- **theirs** — author is a different, known user. A bot-opened MR (Dependabot, release bot) is *theirs*
  — you can still review it `--local` on a checked-out branch.
- **undetermined** — identity could not be resolved (auth failure + inconclusive fallback).

Announce one line before the menu:
- mine → "This MR is authored by you — fixing locally is available."
- theirs → "This MR is authored by `<MR_AUTHOR>` — resolution is posting-only."
- undetermined → "Could not confirm MR authorship (`<reason>`) — treating as not-yours; to fix locally,
  re-run `/ba:review --local` on the checked-out branch."

**When `MR_AUTHORSHIP == mine`**, use **AskUserQuestion** — "How would you like to handle the findings?"
1. **Fix locally** *(Recommended — it's your MR)* — Apply fixes to your local checkout
   (precondition-gated; see below). Leads to the fix-local resolution sub-menu.
2. **Accept all recommendations** — Apply each finding's recommended disposition directly, without
   opening the sub-menu (precondition-gated; see below) — same flow as **"Accept all recommendations"
   flow** under **For local scopes** (recommended dispositions, Modify-pause, prior-revert deferral,
   guard, summary). If zero post-gate findings exist, display "No findings to apply." and return to
   this menu.
3. **Walk one by one** — Step through each finding; per-finding choose Apply / Skip / Modify
   (precondition-gated; see below). Skips the fix-local sub-menu and goes directly to the per-finding fix
   walk (the same walk as **"Review one by one" flow** in the sub-menu). If zero post-gate findings exist,
   display "No findings to walk." and return to this menu.
4. **Done** — Acknowledge findings without further action.

Precondition failure for **Accept all recommendations** and **Walk one by one**: reuse the existing
failure flow verbatim (see Fix locally — precondition check, below), including the one-Checkout limit. The
"Post comment" fallback always posts all findings regardless of which option triggered the precondition check.

(The discussion-only "Review one by one" walk is not offered on own-MR — thin with no second party.
"Walk one by one" here is a direct-path shortcut to the per-finding fix walk; Fix locally reaches the same
walk via its sub-menu. **AskUserQuestion allows at most 4 options — a harness limit, not a style choice.**)

**When `MR_AUTHORSHIP == theirs` or `undetermined`**, use **AskUserQuestion** — today's posting-only menu,
unchanged:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Post inline comments** — Post all displayed (post-gate) findings as inline comments on the MR/PR (details below)
2. **Post Critical + High + Med-conf-100** — Same posting flow as option 1, but pre-filtered using the **Filter for `Apply Critical + High + Med-conf-100`** defined under **For local scopes** (operating on the rendered (post-gate) findings only — the Suppressed section is never eligible). Always offered; if zero findings match, report "0 findings matched the filter (Critical + High + Med-conf-100)." and return to this menu (not treated as Done). Uses the same CC-mapping and submission logic under "Posting inline comments" below.
3. **Review one by one** — Walk through each finding for discussion
4. **Done** — Acknowledge findings without further action

**When `PERSIST=true`** and the user selects Done, also display: `Persisted to docs/reviews/<TIMESTAMP>-<scope-ref>/`.

**"Review one by one" flow (posting, for discussion):** Use the same finding-context-inside-the-question convention as the fix-local walk — include the full finding context inside each AskUserQuestion's question text; never output finding details as separate text before the question widget. This posting walk shows **no** disposition recommendation (the Apply/Skip/Modify recommendation is fix-local only) — it is still for discussion, not applying.

#### Fix locally — precondition check

Selecting **Fix locally** does NOT immediately edit files. First confirm the local tree IS the reviewed
tree, so the remote diff's `file:line` anchors apply. Use the `MR_HEAD_SHA` captured in Step 1b — do
**not** re-fetch it (Step 1f STOP rule: the precondition compares SHAs and reads `git status`; it does
not re-diff). Check, in order; each failure surfaces a SPECIFIC reason — never edit a misaligned tree:

1. **Head aligned** — `git rev-parse HEAD` equals `MR_HEAD_SHA` (captured Step 1b). A detached HEAD at
   the right SHA **passes** — alignment, not branch name, is the gate. To **classify** an alignment
   failure (so the right fallback is offered), read two more primitives: `git branch --show-current` and
   whether the head branch exists locally (`git branch --list <HEAD_BRANCH>`). Empty current branch **or**
   absent head branch → **not checked out**; on the head branch but SHA differs → **head moved** (rebased
   / squashed / updated since review). If `IS_FORK`, name that as context in the reason — the head likely
   isn't local and a checkout will fetch it.
2. **Changed files clean** — `git status --porcelain -- <CHANGED_FILES>` is empty. Uncommitted edits to
   reviewed files would shift anchors and confound the guard's test attribution.

(`IS_FORK` is **not** an independent gate: at the reviewed SHA the anchors are valid regardless of fork;
if you're not at it, "fork" is merely *why* — so it annotates the not-aligned reason rather than failing
its own check.)

On failure, surface the reason and offer reason-specific fallbacks (each via AskUserQuestion):
- **Not checked out** (empty/other current branch, or the head branch — possibly a fork — isn't local) →
  **Checkout** (`gh pr checkout <N>` / `glab mr checkout <N>`, which fetches a fork too; then re-run the
  precondition) / **Post comment** / **Patch** (emit the reviewer-suggested fixes as a `git apply`-able patch).
- **Head moved** (on the branch but SHA ≠ reviewed; rebased/squashed/updated) → do **not** silently
  checkout onto a stale diff. **Re-review** (`/ba:review <N>` to capture a fresh diff against the current
  head) / **Post comment** / **Patch**.
- **Dirty changed files** → **Stash or commit** the changed files then re-run / **Post comment** / **Patch**.

After any **Checkout**, re-run the precondition (both checks) — **Checkout is offered once**; it is not
offered again after a post-Checkout re-run failure. If alignment still can't be reached, the only safe
applying path is **Re-review**; otherwise **Post comment** / **Patch**.

Then proceed to the fix-local resolution sub-menu (see **For local scopes** — the same Accept all
recommendations / Critical+High+Med-conf-100 / one-by-one walk / Done options, the same guard).

#### Posting inline comments

Use `gh api` / `glab api` to create review comments on specific diff lines. Group into a single review submission where the platform supports it (e.g., GitHub pull request reviews).

**Format each comment as a [Conventional Comment](https://conventionalcomments.org/).**

Translate internal categories to CC labels using this mapping:

| Internal severity | CC format | When |
|---|---|---|
| Critical | `issue (blocking): <subject>` | Correctness, security, data-loss risk. Would cause real problems if shipped. |
| High | `issue: <subject>` | Significant defect or risk. Strongly recommended before merge. |
| Medium | `suggestion (non-blocking): <subject>` | Improvement the author can take or leave. |
| Low | `nitpick (non-blocking): <subject>` | Style, naming, formatting, micro-improvements. |
| Looks Good | `praise: <subject>` | Positive reinforcement. |

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
