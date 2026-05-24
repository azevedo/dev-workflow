---
name: ba:propose
description: Commit, push, and open a PR/MR with a composed title and body — preview-then-confirm, host-detected dispatch for GitHub and GitLab.
argument-hint: "[--describe-only] [--issue <ID>] [optional: free-text hint]"
---

# Propose Changes for Review

Compose a commit and PR/MR body that helps the code reviewer first, teammates and future-bug-investigators next.

## Arguments

<propose_args> #$ARGUMENTS </propose_args>

### Parse Arguments

Strip recognized flags from the argument string; what remains is a free-text hint that the user wants reflected in motivation.

Recognized flags:

- `--describe-only` — Compose and print the body; do not commit, push, or create/edit a PR/MR. Useful as a dry run.
- `--issue <ID>` — Explicitly bind a Linear issue ID. Overrides branch-name detection.

Note: there is no explicit `--describe-update` flag. Step 0b resolves a single `ACTION` enum (one of `commit_push_create` / `commit_push_edit` / `edit_only` / `describe_only`) from the args and the branch state; Steps 5a-5d dispatch on `ACTION`. The "nothing to push + open PR" case resolves to `edit_only` via a single confirmation prompt in 0b. One arg flag, one `ACTION` enum, no cross-product of mode + skip flags.

## Step 0: Pre-flight

### 0a. Detect remote host

```bash
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
```

Parse `REMOTE_URL` to classify:

- Matches `github.com` → `HOST=github`, `CLI=gh`.
- Matches `gitlab.com` → `HOST=gitlab`, `CLI=glab`.
- Else → `HOST=unknown` (unless the user overrides via the env-var escape hatch below).
- No remote at all → `HOST=unknown`.

**Env-var escape hatch** for self-hosted users (GHES, self-hosted GitLab):

- If `BA_PROPOSE_HOST=ghes` is set, treat as `HOST=ghes`, `CLI=gh`. Caller is responsible for `gh auth login` and `GH_HOST` if needed.
- If `BA_PROPOSE_HOST=gitlab-self` is set, treat as `HOST=gitlab-self`, `CLI=glab`. Caller is responsible for `glab auth login`.

This replaces an earlier ladder design (`gh api /meta` probe → `glab config get` probe → unknown). The probe ladder was rejected at plan-review time as YAGNI for v0.18.0 — the repo has no documented GHES / self-hosted GitLab users today, the probes have unspecified failure semantics (CLI-missing vs probe-error), and probe #2 had the side effect of mutating `GH_HOST` in the caller's environment. Re-add auto-detection in a future plan when a real user reports the escape hatch is insufficient.

If `HOST=unknown`, announce: "Remote `<URL>` is not GitHub or GitLab. `ba:propose` will still commit and push, but cannot open the PR/MR — paste the composed body into your platform's web UI when prompted. (Self-hosted? Set `BA_PROPOSE_HOST=ghes` or `BA_PROPOSE_HOST=gitlab-self`.)"

### 0b. Resolve ACTION

Compute a single `ACTION` value that drives the rest of the orchestration. Every state the rest of the command cares about — describe vs apply, commit-push-then-PR vs PR-edit-only — collapses into one named enum so Step 5 dispatches on one dimension instead of a cross-product:

| `ACTION` | Triggered when | Step 5 behavior |
|---|---|---|
| `describe_only` | `--describe-only` was passed | Compose, preview, print body, exit zero. No commit, no push, no PR/MR write. |
| `commit_push_create` | No `--describe-only` AND no open PR/MR for branch | 5a stage → 5b commit → 5c push → 5d create. |
| `commit_push_edit` | No `--describe-only` AND open PR/MR exists AND there are commits to push | 5a stage → 5b commit → 5c push → 5d edit. |
| `edit_only` | No `--describe-only` AND open PR/MR exists AND nothing to push | Skip 5a-5c; 5d edits the existing PR/MR description. |

Resolution sequence:

```bash
ACTION=commit_push_create
if [[ "$ARGS" == *--describe-only* ]]; then
  ACTION=describe_only
else
  # Probe upstream and open-PR state once
  HAS_COMMITS_TO_PUSH=$([[ -n "$(git rev-list @{upstream}..HEAD 2>/dev/null)" ]] && echo yes || echo no)
  OPEN_PR_EXISTS=$(... gh pr view / glab mr view — see Step 2d's probe ...)
  if [[ "$OPEN_PR_EXISTS" == yes && "$HAS_COMMITS_TO_PUSH" == no ]]; then
    # Confirm the edit-only intent — refusing this exits early
    ask "Nothing to push. Update the PR description only?" yes/no
    [[ answer == yes ]] && ACTION=edit_only || exit 0
  elif [[ "$OPEN_PR_EXISTS" == yes ]]; then
    ACTION=commit_push_edit
  fi
fi
```

After Step 0b, every downstream step reads `ACTION` and nothing else for mode dispatch. `MODE` and `skip_push` are not separate variables — they were intermediate concepts in an earlier draft, collapsed at plan-review time into `ACTION` so cross-step state is named once. The Step 5 action plan table (below) dispatches on `ACTION` directly.

## Step 1: Branch routing

```bash
git status --porcelain=v2 --branch
git rev-parse --abbrev-ref HEAD
```

Detect branch state and route per CE's four-way decision tree (see `docs/research/2026-05-17-shipping-skill-source-material-research.md` *Branch routing*):

| State | Behavior |
|---|---|
| Detached HEAD | Ask: "Detached HEAD — create a feature branch from these commits? Suggested name: `<derived-from-diff>`." If yes, `git checkout -b <name>` and continue. If no, refuse. |
| Default branch with uncommitted work | Ask: "You're on `<default>` with uncommitted work. Create a feature branch? Suggested name: `<derived-from-diff>`." If yes, `git checkout -b <name>` and continue. If no, refuse. |
| Default branch with no work | Refuse: "On `<default>` with nothing to propose. Switch to a feature branch first." |
| Feature branch | Continue. |

**Default-branch detection** (used above):

```bash
DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')
[[ -z "$DEFAULT_BRANCH" ]] && DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)
[[ -z "$DEFAULT_BRANCH" ]] && DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}')
```

If still empty, ask the user.

## Step 2: Gather inputs

Each sub-step materializes one field of `CompositionInputs`. None of this happens inside composition.

### 2a. Diff and branch metadata

```bash
git fetch --no-tags origin "$DEFAULT_BRANCH"
DIFF_BASE=$(git merge-base HEAD "origin/$DEFAULT_BRANCH")
git diff --stat "$DIFF_BASE..HEAD"
git diff --numstat "$DIFF_BASE..HEAD"
git log --pretty=oneline "$DIFF_BASE..HEAD"
git rev-parse --abbrev-ref HEAD
```

Capture into the orchestrator's local state:

- `diff.range = "$DIFF_BASE..HEAD"`
- `diff.file_stats = <output of --numstat>`
- `diff.commit_log = <output of --pretty=oneline>`
- `branch.name = <current branch>`
- `branch.base_ref = "origin/$DEFAULT_BRANCH"`
- `branch.last_merge_sha = "$DIFF_BASE"`

If `git diff --stat "$DIFF_BASE..HEAD"` is empty AND there are commits in the log, raise the empty-diff error:

> **CompositionInputError: branch is fully contained in base.**
> Your commits exist but the diff vs `<DEFAULT_BRANCH>` is empty. Likely causes: someone landed equivalent changes in `<DEFAULT_BRANCH>` and your branch is now redundant, or the base was force-pushed past your branch tip. Rebase, or close the branch.

If `git diff --stat` is non-empty but unreadable (returns non-zero with no diff), raise:

> **CompositionInputError: diff unreadable.**
> `git diff $DIFF_BASE..HEAD` returned non-zero. Check the repository state.

### 2b. Linear issue context (optional)

Determine the issue ID:

1. If `--issue <ID>` was passed, use it.
2. Else, regex-extract from branch name: `[A-Z]{2,5}-[0-9]+` (e.g., `bru/TO-1234-fix-x` → `TO-1234`).
3. Else, no issue ID — skip MCP entirely, `issue_context = None`.

If an ID is present, attempt the MCP call:

```
mcp__claude_ai_Linear__get_issue(id: <ID>)
```

- **Success** → normalize the MCP payload into composition-owned vocabulary before passing it across the seam:

  ```
  issue_context = IssueContext(
    ref         = <mcp_response>.identifier,        # e.g., "TO-1234"
    summary     = <mcp_response>.title,             # short headline
    body_text   = <mcp_response>.description,       # long-form description, possibly empty
    priority    = <mcp_response>.priority,          # optional, opaque to composition
    raw         = <full mcp_response, Mapping[str, Any]>,
  )
  ```

  The normalizer is Step 2b's job, not composition's. If Linear renames `description` → `body` or `identifier` → `key` in a future MCP schema, that change lands here in Step 2b and never reaches Step 3. Composition reads `issue_context.ref`, `.summary`, `.body_text` — not Linear's field names. The `.raw` mapping is retained as an escape hatch but composition should not read it for production sections; reach for `.raw` only when prototyping a new section, then promote the field into the normalizer.
- **Failure** (MCP not installed, server down, auth expired, ID not found) → `issue_context = None`, AND record `mcp_unavailable = True` so the preview can surface a warning: "Linear MCP unavailable — using diff-derived motivation."

The orchestrator never raises on MCP failure. Linear is optional.

`mcp_unavailable` is **orchestrator-side state only** — it lives in the run-local variables alongside `DIFF_BASE`, `DEFAULT_BRANCH`, etc. It never flows into `CompositionInputs`; composition makes no decision based on it. The flag's sole consumer is the preview warning prefix in Step 4.

### 2c. `docs/solutions/` auto-detection

If `docs/solutions/` exists at the repo root:

```bash
git log "$DIFF_BASE..HEAD" --name-only --pretty=format: -- docs/solutions/ | sort -u
```

For each entry returned:

- Read the file's frontmatter and the first paragraph of `## Solution` (or first paragraph of body if no `## Solution`).
- Prepare a one-line summary: `<frontmatter.problem or H1>` — link target relative to repo root.

If at least one entry was returned, ask the user **once**, presenting the full list:

> "Found N `docs/solutions/` entries touched on this branch:
> 1. `<path-1>` — <summary-1>
> 2. `<path-2>` — <summary-2>
> ...
>
> Include as 'What I learned'?"
>
> 1. **Include all** — splice every detected entry
> 2. **Skip all** — splice none
> 3. **Choose** — drop into a per-entry yes/no loop (only when the user wants surgical control)

Default for the typical case (1–3 entries) is "Include all" — that's what the loop is gathering. The per-entry **Choose** path opens an AskUserQuestion sequence with a single yes/no per remaining entry; no Include-all / Skip-all shortcuts at that level (the user already picked "Choose" because they want individual control).

`solutions = (<accepted entries>...)`. Empty tuple is normal.

If `docs/solutions/` does not exist or returns no entries, set `solutions = ()` silently. The directory does not exist in the repo today — this code path is dormant until `/ba:compound` creates the first entry.

### 2d. Preserved blocks from existing PR/MR description

If an open PR/MR exists for the current branch:

```bash
# GitHub
gh pr view --json url,state,body,isDraft

# GitLab
glab mr view -F json
```

If `state == OPEN`:

- Extract `<!-- CURSOR_SUMMARY --> … <!-- /CURSOR_SUMMARY -->` block(s) — preserved verbatim.
- Extract `## Demo` section (heading + content until next H2 or EOF).
- Extract `## Screenshots` section (same shape).

`preserved_blocks = ((kind="bugbot", raw_markdown=<text>), (kind="demo", raw_markdown=<text>), (kind="screenshots", raw_markdown=<text>))` — only kinds present.

Step 5d re-fetches the body immediately before write and re-extracts these blocks at apply time — see Step 5d for the rationale. The Step 2d extract is what the preview displays; Step 5d's extract is what actually ships.

If `ACTION` is one of `commit_push_create` / `describe_only` and no open PR/MR exists for the branch, set `preserved_blocks = ()`. The `commit_push_edit` and `edit_only` cases imply an open PR/MR by Step 0b's resolution, so this branch isn't reached for those actions.

### 2e. Evidence (user-supplied URLs only)

If the diff suggests user-observable behavior — UI files changed, e.g. files matching `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `templates/`, `views/`, etc. — ask:

> "This change appears user-visible. Include evidence?"
>
> 1. **Use existing evidence** — paste URL(s) or markdown embed → splice as `## Demo`
> 2. **Skip** — no evidence section

If "Use existing evidence", prompt for the markdown to splice. Accept whatever the user pastes verbatim (URL validation is out of scope — preview catches obvious issues).

`evidence = ((kind="markdown", raw=<text>),)` or `()`.

If no user-observable files changed, skip this prompt — `evidence = ()`.
