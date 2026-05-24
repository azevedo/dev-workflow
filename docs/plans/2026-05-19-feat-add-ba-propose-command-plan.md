---
title: "feat: Add ba:propose Shipping Command"
type: feat
status: in-progress
date: 2026-05-19
origin: docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md
detail_level: comprehensive
iteration_count: 2
sliced: true
slice_count: 5
tags: [command, ba-propose, git-workflow, commit, pull-request, merge-request, body-composition]
---

# Add `ba:propose` Shipping Command — Implementation Plan

## Overview

Add a new `ba:propose` command to the `dev-workflow` plugin that commits, pushes, and opens a PR/MR with a composed title and body. The command introduces a new **Git workflow** command category alongside Research / Planning / Execution / Quality / Knowledge, and is the first command in the repo that issues `gh pr create` / `glab mr create` itself (existing `/ba:execute` delegates the act).

The high-level design is locked at the brainstorm (see brainstorm: `docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md` — *Locked Design*). The plan's job is to translate that design into the concrete command-markdown structure, document set, and version bump that ship `ba:propose` to v0.18.0.

## Current State

- **Command files** all live in `commands/ba/*.md` as self-contained markdown (8 files, 164–821 LoC each). `commands/ba/execute.md:419-437` already has a "Create MR/PR" completion menu that delegates to the user; `ba:propose` replaces that delegation with a concrete command.
- **No existing command issues `gh pr create` / `glab mr create`.** Existing `gh`/`glab` usage is read-only — `commands/ba/review.md:76-86` invokes `gh pr diff`, `gh pr view`, `glab mr diff`, `glab mr view`.
- **No `--body-file` heredoc precedent in the repo.** `commands/ba/plan.md:507` uses `gh issue create --title <t> --body-file <plan_path>` but that's the only existing `--body-file` usage, and it's for issues, not PRs. `ba:propose` establishes the multi-paragraph PR-body discipline for the first time.
- **`docs/solutions/` directory does not yet exist** anywhere in the repo. `commands/ba/compound.md:55-61` already includes defensive handling ("If the directory doesn't exist or is empty, return 'No existing docs found'"); `ba:propose` follows the same defensive pattern.
- **No Linear MCP integration precedent.** `commands/ba/plan.md:497-508` mentions Linear only as a tracker CLI (`linear issue create ...`), not as an MCP source. `ba:propose` establishes the optional-MCP-with-graceful-fallback pattern.
- **Plugin version is `0.17.0`** at `.claude-plugin/plugin.json:3`. Marketplace version at `.claude-plugin/marketplace.json:11` is `0.1.0` (stale, not bumped per release historically — not in scope here).
- **CLAUDE.md `## Commands` section** has five subsections — Research / Planning / Execution / Quality / Knowledge (`CLAUDE.md:5-28`). New "Git workflow" subsection lands between Knowledge and `## Agents` at line 29.
- **README `## Commands` section** is flat — no subsection headings, each command has its own `### /ba:xxx` block (`README.md:36-197`). New `/ba:propose` block lands before `### Severity ladder…` at line 172.
- **CE four-way branch decision tree, Lynch's 16-section menu, `--body-file` heredoc recipe, BugBot sentinel** all extracted verbatim in `docs/research/2026-05-17-shipping-skill-source-material-research.md`. (Squash-merge detection was also extracted but is no longer used — see brainstorm: *2026-05-19 Addendum — `--diverge` dropped*.)
- **`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`** is the standing synthesis-lock authority cited by the brainstorm (brainstorm line 157). Plan must respect the lock — refine, do not re-add rejected elements.

## What We're NOT Doing

- **Not writing Python code.** The locked design's `compose_body(inputs) -> ComposedBody` is a logical specification Claude executes from the command markdown — not an importable function (see brainstorm: `## Convention Compliance`, *Informational*). Type signatures stay as design contracts.
- **Not creating `docs/solutions/`** as part of this rollout. Defer to first `/ba:compound` run.
- **Not creating a sub-agent for body composition.** Composition is inlined as a clearly-delimited spec section in `commands/ba/propose.md`. Extracting to `agents/workflow/body-composer.md` later is a future plan if the spec grows past ~300 LoC of internal complexity.
- **Not creating a `references/` directory pattern.** No existing command in the repo splits into helper markdown; `propose.md` is a single self-contained file like every other.
- **Not implementing automated evidence capture** (CE's `ce-demo-reel`). Evidence is user-supplied URLs only.
- **Not adding auto-`/ba:review` chaining.** User decides when to run review.
- **Not handling deploy, merge, or auto-approve.** The command does three things: commit, push, open PR/MR.
- **Not bumping `marketplace.json`.** Out of scope; not a per-command convention.
- **Not adding a `--diverge` flag** for commit-vs-PR-body divergence (see brainstorm: *2026-05-19 Addendum — `--diverge` dropped*). The aligned-default plus the preview's Edit affordance handle ad-hoc divergence; the brainstorm's own rejection of Design B's `overrides` (YAGNI) applies here too.
- **Not adding a roadmap entry** before release. Roadmap line gets `✅` after release if added at all.
- **Not updating `commands/ba/execute.md`'s "Create MR/PR" completion menu** (currently `execute.md:419-437`) to point at `/ba:propose`. Out of scope for v0.18.0 to avoid blast-radius coupling between commands; tracked as [azevedo/dev-workflow#13](https://github.com/azevedo/dev-workflow/issues/13).

## Behaviors to Test

User-observable behaviors `ba:propose` must satisfy. Authored once here; serves scope, review, and test-coverage simultaneously. Each line is one structural grep or one manual scenario. Behaviors are grouped by the slice that delivers them (see `## Slices` table below).

<!-- slice:1 "Scaffold, mode dispatch, branch routing" -->

- [x] Branch routing handles all four CE cases — detached HEAD, default branch with uncommitted work, default branch with no work, feature branch.

<!-- slice:2 "Input gathering (Step 2)" -->

- [x] When a Linear issue ID is detected (supplied as arg or parsed from branch name) and the Linear MCP server responds, motivation is sourced from MCP.
- [x] When a Linear issue ID is detected but the Linear MCP server is unavailable, the preview shows a one-line warning ("Linear MCP unavailable — using diff-derived motivation") and the command continues without error.
- [x] When no Linear issue ID is present, the command never errors on missing Linear; motivation is derived from the diff and recent commits.
- [x] `docs/solutions/` entries touched on the current branch since the last merge to `origin/HEAD` are detected and presented one-by-one for inclusion confirmation; the user can accept any subset.
- [x] Empty-diff (feature branch fully contained in base) raises a `CompositionInputError` with the message "branch is fully contained in base; rebase or close."

<!-- slice:3 "Composition spec (Step 3)" -->

- [x] Title is effect-phrased — when composition rewrites a mechanism-only title, the preview shows `Title: <effect-phrased>  (rewritten from: <original>)`.
- [x] Cursor BugBot block (`<!-- CURSOR_SUMMARY --> … <!-- /CURSOR_SUMMARY -->`) is preserved byte-identical when rewriting an existing PR/MR description.
- [x] Existing `## Demo` and `## Screenshots` blocks are preserved byte-identical when rewriting an existing PR/MR description.

<!-- slice:4 "Preview, apply, failure modes" -->

- [ ] On a feature branch with new commits, running `/ba:propose` previews a title and body, then on confirmation pushes commits and opens a PR/MR.
- [ ] When the remote host is `github.com` (or a GHES host inferred from remote URL), the command invokes `gh pr create --body-file <path>`.
- [ ] When the remote host is `gitlab.com` (or a self-hosted GitLab), the command invokes `glab mr create --description-file <path>`.
- [ ] When the remote host is neither GitHub nor GitLab, the command completes commit + push, prints the composed body, and tells the user the platform isn't supported — without ever calling `gh pr create` / `glab mr create`.
- [ ] No `gh pr create` / `glab mr create` invocation uses `--body "$(cat ...)"`, stdin, pipes, or `--body-file -`. Every invocation uses `--body-file <temp_path>` (or `--description-file <temp_path>`) where `<temp_path>` was written by a quoted-sentinel heredoc.
- [ ] Commit message and PR/MR body share the same composed markdown — no separate per-commit-vs-PR rendering path.
- [ ] Staging uses explicit paths only — no `git add -A`, no `git add .` anywhere in the command's bash blocks.
- [ ] No `--no-verify` flag is passed to `git commit` or `git push` anywhere.
- [ ] On pre-commit / commit-msg hook failure, the command surfaces hook output, leaves the working tree intact, and exits with a clear "fix the hook and re-run" message — never with `--no-verify`.
- [ ] `--describe-only` prints the composed body without committing or pushing; on a branch with no open PR/MR it composes and prints, returning zero.
- [ ] When the command is run on a feature branch that has an open PR/MR, it switches to edit semantics (`gh pr edit --body-file` / `glab mr update --description-file`) instead of failing with "PR already exists."
- [ ] The command never issues a force-push silently; non-fast-forward push prompts the user to use `--force-with-lease` or abort.
- [ ] Preview-abort returns the user to a menu: edit body, regenerate with a one-line hint, or exit. The flow never silently exits or silently recomposes.

<!-- slice:5 "Docs + version bump" -->

- [ ] CLAUDE.md gains a new `### Git Workflow Commands` subsection and a new convention bullet; README gains a new `### /ba:propose` block.
- [ ] `.claude-plugin/plugin.json` version is bumped to `0.18.0`, `description` includes "propose", and `keywords` array includes `"propose"`.

## Proposed Solution

Ship `ba:propose` as a single comprehensive command file `commands/ba/propose.md` containing:

1. **Frontmatter** — `name: ba:propose`, instruction-to-Claude description, argument-hint covering `[--describe-only] [--issue <ID>]`.
2. **Argument capture** — `<propose_args> #$ARGUMENTS </propose_args>` block following the established pattern (`commands/ba/execute.md:13`).
3. **Orchestrator step sequence** — Step 0 (pre-flight: host + mode detection) → Step 1 (branch routing) → Step 2 (gather inputs) → Step 3 (compose body — the seam) → Step 4 (preview) → Step 5 (apply: commit, push, create-or-edit PR/MR).
4. **Composition spec** — a clearly-delimited section that documents the `compose_body` contract: inputs, tier classifier, section selector, splicer, title rewriter, invariants. Claude executes this spec at runtime.
5. **Failure modes** — explicit recovery flows for hook failure, push rejection, post-push PR-create failure, unknown host, MCP unavailability, preserved-block staleness, empty diff, body-too-large warning.

Outside the command file, three documents update: `CLAUDE.md` (new category + convention bullet), `README.md` (new `### /ba:propose` block), `.claude-plugin/plugin.json` (version, description, keywords).

## Technical Approach

### Architecture

```
                  ┌─────────────────────────────────────────────────┐
                  │  commands/ba/propose.md  (single-file command)  │
                  └─────────────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
   Orchestrator              Composition Spec (seam)          Platform Adapter
   (gather inputs            (pure-function contract,         (host detection,
   from git, MCP,            tier+section+splice+title,       gh/glab dispatch,
   solutions, evidence)      no I/O reach-out)                heredoc-to-tempfile,
                                                              create-or-edit)
```

- **Orchestrator** owns I/O — git, `gh repo view`, Linear MCP, `docs/solutions/` scan, preserved-block extraction, user-supplied evidence prompts.
- **Composition spec** is pure; consumes only the value objects from `CompositionInputs`. Stateless, deterministic, idempotent. All editorial judgment lives here.
- **Platform adapter** is a thin layer that handles host detection (parse `git remote get-url origin`), maps to `gh` or `glab` commands, applies the `--body-file` heredoc recipe, and detects "PR already exists" → switches to edit.

This mirrors the brainstorm's locked design (see brainstorm: `## Locked Design`, *Dependency strategy*): pure composition + I/O-owning orchestrator + thin host adapter, no Linear/MCP/git knowledge inside composition.

### Alternative Approaches Considered

- **Composition as a sub-agent (`agents/workflow/body-composer.md`).** Rejected. The agent precedent is small (74–129 LoC) and single-purpose, but composition needs the same context the orchestrator has just gathered — making it a separate agent means re-passing all those inputs through a Task call, which is a serialization tax with no architectural payoff. The brainstorm's pure-function seam already gives the testability and swap-ability we need without crossing an agent boundary. A future plan can extract if internal complexity warrants.
- **Two commands — `ba:commit` and `ba:open`.** Rejected. The brainstorm names `ba:propose` and resolves the namespace question (see brainstorm: `## Resolved Questions`, "Namespace"). Two commands also fragment the body — the same composed body should feed both commit and PR/MR by default.
- **A `references/` directory pattern** — separating composition spec from orchestrator narrative. Rejected. No repo precedent; CLAUDE.md convention update would be required; single-file precedent is robust and reviewable.
- **Embedding the spec as a sub-document at `commands/ba/propose/composition.md`.** Same rejection rationale — net-new convention, no payoff over a section heading inside the main file.
- **Auto-creating `docs/solutions/`** as part of this plan. Rejected. The brainstorm doesn't require it, and `commands/ba/compound.md:56` already documents the "directory absent → return 'no docs found'" defensive pattern; `ba:propose` follows the same pattern. Pre-creating the directory introduces noise without benefit.

## Slices

| # | Name | Est. LoC | Depends | Status |
|---|---|---|---|---|
| 1 | Scaffold, mode dispatch, branch routing | ~90 | -- | done |
| 2 | Input gathering (Step 2) | ~120 | 1 | done |
| 3 | Composition spec (Step 3) | ~115 | 2 | pending |
| 4 | Preview, apply, failure modes (Step 4-5 + appendix) | ~190 | 3 | pending |
| 5 | Docs + version bump (CLAUDE.md / README / plugin.json) | ~25 | 4 | pending |

> Slice 4 is **oversized** (~190 LoC) — one phase, one `**File**:` block, atomic per the slice rules. Consider splitting Phase 4's `commands/ba/propose.md` append into two file blocks in a future plan revision (Step 4 preview vs. Step 5 apply + Failure Modes) to enable a finer cut. For this round, ship Phase 4 as one MR.

## Implementation Phases

### Phase 1 — Command scaffold, frontmatter, mode dispatch, branch routing

Lay down `commands/ba/propose.md` with the frontmatter, argument capture, mode-dispatch logic, host detection, and branch-routing decision tree. No body composition yet — Phase 1 ends with a command that can identify what mode it's in, detect the host, route correctly across the four CE branch states, and refuse cleanly on unsupported hosts or detached HEAD.

#### Changes Required

<!-- slice:1 "Scaffold, mode dispatch, branch routing" -->

**File**: `commands/ba/propose.md` (new file)

````markdown
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

## Step 2: … (continued in Phase 2)
````

#### Success Criteria

##### Automated:
- [x] `ls commands/ba/propose.md` — file exists
- [x] `head -5 commands/ba/propose.md` — frontmatter starts with `name: ba:propose`
- [x] `grep -c '#\$ARGUMENTS' commands/ba/propose.md` — argument capture present (>= 1)
- [ ] `grep -c 'AskUserQuestion' commands/ba/propose.md` — interactive prompts present (>= 5 by end of plan)
- [x] `grep -c '^## Step ' commands/ba/propose.md` — step structure present (>= 1 after Phase 1; >= 6 after Phase 5)
- [x] `grep -E 'git add -A|git add \.' commands/ba/propose.md` — returns empty (no bulk staging)
- [x] `grep '\--no-verify' commands/ba/propose.md` — returns empty (no hook bypass)
- [x] `grep 'github.com\|gitlab.com' commands/ba/propose.md` — both hosts referenced
- [x] `grep 'Detached HEAD\|default branch' commands/ba/propose.md` — all four branch states mentioned

##### Manual:
- [x] Frontmatter matches the universal command shape (`name`, `description`, `argument-hint`).
- [x] Prose voice is instruction-to-Claude (imperative, "Run …", "Ask …") — matching `commands/ba/execute.md` and `commands/ba/review.md`.
- [x] Host-detection branch enumerates GHES and self-hosted GitLab explicitly, with a graceful unknown-host path.

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 2.

---

### Phase 2 — Input gathering (diff, branch, Linear, solutions, preserved blocks, evidence)

Add Step 2 to the command file: the orchestrator's input-gathering steps that materialize `CompositionInputs` for the composition seam. Linear MCP optional with explicit failure-vs-absence distinction; `docs/solutions/` scan with per-entry confirmation; preserved-block extraction from existing PR body (re-extracted at apply time in Step 5d to close the BugBot-edit race window without explicit hash compare); evidence prompt.

#### Changes Required

<!-- slice:2 "Input gathering (Step 2)" -->

**File**: `commands/ba/propose.md` (append Step 2)

````markdown
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
````

#### Success Criteria

##### Automated:
- [x] `grep 'mcp__claude_ai_Linear__get_issue' commands/ba/propose.md` — MCP tool referenced
- [x] `grep 'CompositionInputError' commands/ba/propose.md` — error types defined
- [x] `grep 'CURSOR_SUMMARY' commands/ba/propose.md` — BugBot sentinel mentioned
- [x] `grep '## Demo\|## Screenshots' commands/ba/propose.md` — preserved-block kinds enumerated
- [x] `grep 'docs/solutions/' commands/ba/propose.md` — solutions integration present
- [x] `grep 'origin/HEAD\|DEFAULT_BRANCH' commands/ba/propose.md` — default-branch detection present
- [ ] `grep -c 'AskUserQuestion' commands/ba/propose.md` — interactive prompts increased (>= 8) *(deferred — see Deviations; literal token first appears in Phase 4)*

##### Manual:
- [x] Linear-failure vs Linear-absence distinction is explicit; `mcp_unavailable` flag is set on failure.
- [x] `docs/solutions/` scan is per-entry confirmable; "include all"/"skip all" shortcuts present.
- [x] Preserved-block extraction is re-run at apply time in Step 5d (not compared by hash) so the published body always reflects the freshest remote read.
- [x] Evidence prompt only triggers on heuristic UI-file detection; otherwise silent.
- [x] Empty-diff distinguishes "branch fully contained in base" from "diff unreadable" with separate messages.

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 3.

---

### Phase 3 — Composition spec (the seam)

Document the `compose_body` contract inline in `commands/ba/propose.md` as Step 3. This is the section Claude reads to compute `title` and `body` from `CompositionInputs`. The brainstorm's locked design (interface, invariants, tier→section mapping, swappable internals) lifts in verbatim where it's contract-shaped.

#### Changes Required

<!-- slice:3 "Composition spec (Step 3)" -->

**File**: `commands/ba/propose.md` (append Step 3)

````markdown
## Step 3: Compose body (the seam)

This is the composition spec — Claude executes it to produce `title` and `body` from the inputs gathered in Step 2. It is pure: it reads from `CompositionInputs` only, performs no I/O, makes no MCP calls, runs no git commands. If you find yourself needing a fact that isn't in `CompositionInputs`, that's a gather-side bug — go back to Step 2.

### Contract

**Inputs** (already materialized in Step 2):

```
CompositionInputs:
  diff               # range, file stats, commit log
  branch             # name, base ref, last merge SHA
  issue_context      # opaque Mapping or None
  solutions          # tuple of accepted entries, possibly empty
  preserved_blocks   # tuple of (kind, raw_markdown), possibly empty
  evidence           # tuple of (kind, raw), possibly empty
```

**Outputs**:

```
ComposedBody:
  title              # effect-phrased, ≤72 chars, no trailing period
  body               # final markdown — feeds both commit and PR/MR
  rewritten_from     # str or None — original title when 3.3 rewrote a mechanism-only draft; None when no rewrite occurred
  size_warning       # bool — True when body exceeds Lynch's ~150-line soft cap (3.6)
```

`rewritten_from` and `size_warning` are declared output fields so the orchestrator's preview (Step 4) reads them by name; composition never side-channels state to the orchestrator. The seam stays one-direction: inputs in, ComposedBody out.

(See brainstorm: `## Locked Design`, *Interface*.)

### Invariants (every composition pass must satisfy these)

- `body` never restates the diff verbatim. The diff is visible on the platform; the body explains what the diff cannot show.
- `title` is effect-phrased. If the initial draft is mechanism-only (e.g., "add a mutex to guard X"), rewrite to effect form ("prevent X during simultaneous Y") and stash the original for the preview's "rewritten from" disclosure.
- Preserved blocks appear exactly once, byte-identical to input. Splice positions chosen internally.
- Section order follows Lynch's priority (descriptive title → impact → motivation → breaking changes → external refs → dependency justifications → cross-refs → bug summaries → testing instr → testing limits → what I learned → alternatives → searchable artifacts → screenshots → rants → tempted-to-explain).
- Empty inputs (no Linear, no solutions, no preserved blocks, tiny diff) still produce a valid minimal body.
- Stateless; deterministic given identical inputs.

Errors collapse to `CompositionInputError` — raised only by Step 2 when the diff is unreadable or empty. Composition itself does not raise.

### Internal pipeline (seam-hidden, swappable)

The implementation below is the first cut. Future authors can swap to pure-Lynch, pure-CE, or a continuous-score scheme without changing the call site. None of these names ("tier", "section selector", "splicer") appear in the orchestrator.

#### 3.1 Classify size tier

Read `diff.file_stats` and `diff.commit_log`. Compute totals:

- `lines_changed = sum(additions + deletions across all files)`
- `files_changed = count of files`
- `is_perf = (lines_changed >= 30 AND any commit message in branch matches /perf|performance/) OR (diff includes a benchmark or measurement file — paths matching *bench*, *benchmark*, *measure*, *perf-test*, or files with `.bench.` infix)`
- `is_typo = files_changed == 1 AND lines_changed <= 4 AND the change is pure string/comment/whitespace — no operators, no conditionals, no call expressions, no type annotations`

Tier table (first match wins):

| Tier | Heuristic |
|---|---|
| typo | `is_typo` |
| perf | `is_perf` |
| small | `lines_changed <= 30 AND files_changed <= 3` |
| medium | `lines_changed <= 200 AND files_changed <= 10` |
| large | otherwise |

#### 3.2 Section registry (tier threshold + source requirement + body rule)

One declarative table replaces the earlier three-step pipeline (tier→sections → filter-by-availability → per-section generator). Each row owns one section: the minimum tier at which it activates, the input that must be present for it to appear, and the rule for generating its body. To add a new section, add one row. To add a new tier, raise/lower thresholds in this column only. Reviewers maintaining the spec read one place to see what each section depends on.

Reference numbers are Lynch's menu (see `docs/research/2026-05-17-shipping-skill-source-material-research.md` *Source 4*). "Activates at" uses the tier order `typo < small < medium < large`; `perf` is a tier-modifier (see 3.1 note below) that activates rows tagged with `perf` regardless of size threshold.

| # | Section | Activates at | Required input (drop section if missing) | Body rule |
|---|---|---|---|---|
| 1 | Title | typo | — | See 3.3 (title rewriting). Always present. |
| 2 | Impact | small | — | One sentence: what was impossible/broken before, what's possible/fixed now. Falls back to commit log when motivation is thin. |
| 3 | Motivation | small (when non-obvious), medium+, perf | — | Lead with `issue_context.summary` and expand from `issue_context.body_text` when `issue_context` is present; else derive from `diff.commit_log` and changed file paths. Composition reads only composition-owned fields; the Linear-shape mapping lives in Step 2b. |
| 4 | Breaking changes | large | Diff signals an API removal or schema change | Name the breaking surface (removed API, schema migration, etc.) under a `**BREAKING:**` line. Never use `!` in the title or `BREAKING CHANGE:` trailer without explicit user confirmation. |
| 6 | Dependency justifications | large | Lockfile / dependency-manifest changes in diff | List lockfile-detected adds; one-line rationale per addition. |
| 7 | Cross-refs | medium, large | `issue_context.ref` is present | `Fixes <issue_context.ref>` (normalized ref from Step 2b, e.g., `TO-1234`). Never prefix list items with `#` (auto-links `#1` — use `org/repo#N` or full URL). |
| 8 | Bug summaries | large | `issue_context.body_text` is present | Paragraph form, never just `Fixes #N`. |
| 9 | Testing instructions | medium (conditional), large | Automated tests don't exist for the change | Spell out the manual verification path. |
| 10 | Testing limitations | large | — | Disclose what wasn't tested. |
| 11 | What I learned | medium (conditional), large | `solutions` is non-empty | For each `solutions` entry, render as a bullet linking to the file with the entry's `.summary`. |
| 12 | Alternatives considered | large | Diff isn't self-explanatory | Brief notes on rejected approaches. |
| 14 | Screenshots / Demo | medium (conditional), large, perf | `evidence` is non-empty OR `preserved_blocks` contains `demo`/`screenshots` | Splice `evidence` markdown verbatim; when `preserved_blocks` contains `demo`/`screenshots`, prefer those byte-identical. For perf tier, render as a before/after table. |

For each row whose tier threshold is satisfied by `tier` AND whose required input is present in `CompositionInputs`, generate the body per the rule. Rows whose threshold isn't met or whose input is missing emit nothing — no second-pass filter needed. Section ordering follows Lynch's priority (#1 → #2 → #3 → #4 → #6 → #7 → #8 → #9 → #10 → #11 → #12 → #14); preserved blocks splice into canonical positions (Step 3.4).

> **Note on `perf` as a tier-modifier**: a perf-typed change can be small *or* large by line count. The table treats `perf` as a flag that activates row #3 and row #14 regardless of size threshold; size-derived threshold rules still apply to other rows. This avoids the "first-match-wins" gotcha where a tiny perf change would otherwise classify as `typo` and drop row #14's before/after table.

#### 3.3 Title rewriting

Draft a title from `diff.commit_log[0]` or the user's free-text hint if provided.

Check for mechanism-only phrasing — leading verbs like `add`, `move`, `extract`, `refactor`, `update`, `change`, `bump`, `wrap` followed by a noun phrase that names a code construct (`mutex`, `class`, `function`, `field`, etc.) without naming the user-observable effect.

If mechanism-only, rewrite to effect form. Emit the original on `ComposedBody.rewritten_from` (declared in the Outputs contract above); leave `ComposedBody.rewritten_from = None` when no rewrite was needed. Worked example from Lynch — keep in mind when judging:

| Bad (mechanism) | Good (effect) |
|---|---|
| Add a mutex to guard the database handle | Prevent database corruption during simultaneous sign-ups |

Cap at 72 chars. Strip trailing period. Imperative mood. Lowercase after the conventional-commits prefix.

**`fix:` vs `feat:` rule** (from CE / `pr-description-writing.md`): when both fit, default to `fix:` — adding code to remedy missing behavior is `fix:`. Reserve `feat:` for capabilities the user could not previously accomplish.

#### 3.4 Splice preserved blocks

After sections are rendered, splice preserved blocks at their canonical positions:

- `## Demo` → after #2 / #3, before #11.
- `## Screenshots` → after `## Demo`, or in `## Demo`'s slot if no `## Demo`.
- `<!-- CURSOR_SUMMARY --> … <!-- /CURSOR_SUMMARY -->` → at the very end of the body, after all generated sections and after any rants/tempted-to-explain content.

Byte-identical: the raw markdown carried in `preserved_blocks` is inserted as-is. Do not re-format, re-indent, or alter whitespace.

#### 3.5 Final assembly

Commit message and PR/MR body share the same rendered string: `title + "\n\n" + body`. No per-commit-vs-PR divergence is computed here. If the user wants a tighter commit body than the PR body on a given run, they edit the preview (Step 4) — Per the brainstorm's *2026-05-19 Addendum — `--diverge` dropped*, the YAGNI rejection of Design B's `overrides` applies here too.

#### 3.6 Soft size cap warning

After full composition, count `body` lines. Emit `ComposedBody.size_warning = (line_count > 150)` (Lynch's soft cap for large tier). Do not auto-trim — the user decides. The preview at Step 4 reads `size_warning` by name; composition never side-channels state to the orchestrator.

### Trade-offs documented at lock time

The seam intentionally exposes no tier flag, section list, template selector, or ordering hint to the orchestrator. Section-choice debugging requires reading this spec. If observability becomes a real pain point, add a `ComposedBody.trace` field later. (See brainstorm: `## Locked Design`, *Trade-offs*.)
````

#### Success Criteria

##### Automated:
- [x] `grep '## Step 3' commands/ba/propose.md` — composition section exists
- [x] `grep -c 'tier' commands/ba/propose.md` — tier logic documented (>= 5 occurrences)
- [x] `grep 'CompositionInputs\|ComposedBody' commands/ba/propose.md` — contract types named
- [x] `grep 'Lynch' commands/ba/propose.md` — Lynch attribution present
- [x] `grep 'effect-phrased\|effect, not mechanism\|mechanism' commands/ba/propose.md` — title rewriting rule documented
- [x] `grep 'mutex.*sign-ups\|database corruption' commands/ba/propose.md` — Lynch worked example carried over
- [x] `grep '72 char\|72-char\|≤72\|<=72' commands/ba/propose.md` — title cap documented
- [x] `grep '150 line\|150-line\|>= 150\|>150' commands/ba/propose.md` — soft cap documented

##### Manual:
- [ ] Composition spec is clearly a contract Claude executes, not Python to import — phrased as instruction.
- [ ] Section-vocabulary choice is visibly seam-hidden — the orchestrator never names a tier or section.
- [ ] Linear MCP shape is normalized by Step 2b into composition-owned vocabulary (`issue_context.ref`, `.summary`, `.body_text`); Step 3 never reads Linear's field names. Schema drift is absorbed in Step 2b, not the composition seam.
- [ ] Filter step lists exact "drop section if source missing" rules from the brainstorm.

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 4.

---

### Phase 4 — Preview, apply, failure-mode handling

Add Steps 4 and 5: the preview/confirm gate, then the apply mechanics — `git commit` with `-F`, file-level staging, `git push` with non-fast-forward handling, `gh pr create` / `glab mr create` with `--body-file` heredoc discipline, edit-vs-create branching when an open PR/MR exists, hook-failure recovery, post-push PR-create failure messaging. Plus the explicit Failure Modes appendix.

#### Changes Required

<!-- slice:4 "Preview, apply, failure modes" -->

**File**: `commands/ba/propose.md` (append Steps 4, 5, and Failure Modes)

````markdown
## Step 4: Preview and confirm

Print the preview block:

```
─────────────────────────────────────────
Action: <commit_push_create | commit_push_edit | edit_only | describe_only>  (Host: <github|gitlab|...>)
Title: <result.title>
       (rewritten from: <result.rewritten_from>)      [only if result.rewritten_from is not None]
Body lines: <N>                                       (size warning prefix if result.size_warning)
Lead: <first two sentences of result.body>
─────────────────────────────────────────
[full result.body printed below]
─────────────────────────────────────────
```

Tier observability is deliberately omitted from the preview — exposing the seam-internal vocabulary would break the "tier never named at call site" invariant from Step 3. If tier debugging becomes a real pain point, add an optional `ComposedBody.trace` field per the brainstorm's *Locked Design > Trade-offs*.

Pre-prefix the block with warnings if any:

- `⚠ Linear MCP unavailable — using diff-derived motivation` (from `mcp_unavailable` orchestrator flag set in Step 2b)
- `⚠ Composed body is <N> lines (long for typical PR descriptions — consider trimming)` (when `result.size_warning` is True; phrasing avoids surfacing the "Lynch's soft cap" source vocabulary)

Then ask via AskUserQuestion:

> "Apply?"
>
> 1. **Apply** — proceed to Step 5
> 2. **Edit body** — open the body in `$EDITOR` (fallback `nano`), re-preview after save
> 3. **Regenerate with hint** — prompt for a one-line hint, re-run Step 3 with the hint, re-preview
> 4. **Exit** — abort without changes

Loop until the user picks Apply or Exit.

## Step 5: Apply

Step 5 dispatches on the single `ACTION` value resolved in Step 0b. The `HOST=unknown` case short-circuits inside 5d regardless of `ACTION`.

| `ACTION` | Actions |
|---|---|
| `commit_push_create` | 5a (stage) → 5b (commit) → 5c (push) → 5d (create PR/MR) |
| `commit_push_edit` | 5a (stage) → 5b (commit) → 5c (push) → 5d (edit existing PR/MR) |
| `edit_only` | 5d only (edit existing PR/MR description; no commit, no push) |
| `describe_only` | Print body to stdout; exit zero. |

`HOST=unknown` overlay: when `HOST=unknown` and `ACTION` is any of the three apply variants, 5a-5c run as normal (commit and push still succeed against the remote), but 5d short-circuits to "paste manually" mode — see 5d's host-unknown handling. The matrix is closed: every (`ACTION`, `HOST`) pair has defined behavior.

### 5a. Stage explicit paths

Identify the changed files from Step 2a's `--numstat` output. Stage all of them in a single commit using explicit paths only — no `git add -A`, no `git add .`:

```bash
git add path/to/file1 path/to/file2 path/to/file3
```

The command always produces one commit per run. Users who want multiple commits run `/ba:propose` twice on separately-staged subsets — the user already controls the grouping by deciding what to stage before the run. A heuristic split-by-subdirectory was considered and rejected as YAGNI: same lens as the brainstorm's *2026-05-19 Addendum — `--diverge` dropped*.

### 5b. Commit

Write the commit message to a temp file and pass via `-F`:

```bash
COMMIT_MSG_FILE=$(mktemp "${TMPDIR:-/tmp}/ba-propose-commit.XXXXXX")
cat > "$COMMIT_MSG_FILE" <<'__BA_PROPOSE_COMMIT_END__'
<title>

<commit body — same content as PR/MR body>
__BA_PROPOSE_COMMIT_END__

git commit -F "$COMMIT_MSG_FILE"
```

The quoted sentinel `'__BA_PROPOSE_COMMIT_END__'` blocks `$VAR`, backticks, and literal `EOF` expansion.

**Hook failure recovery.** If `git commit` returns non-zero:

- Print the hook output verbatim.
- Leave the working tree exactly as the hook left it.
- Exit with message: "Hook failed — fix the reported issue and re-run `/ba:propose`. Composition outputs are deterministic; re-running re-derives them. Never re-run with `--no-verify` unless you've audited the hook and have an explicit reason."
- Do NOT pass `--no-verify`. Never.

### 5c. Push

```bash
git push -u origin HEAD
```

If push fails with non-fast-forward (rejected for `non-fast-forward` or `protected`):

```bash
git fetch origin "$BRANCH_NAME"
git rev-list --left-right --count "origin/$BRANCH_NAME...HEAD"
```

Ask the user:

> "Upstream `origin/<branch>` has commits not in your local branch. Force-pushing would discard them."
>
> 1. **Force-with-lease** — `git push --force-with-lease origin HEAD` (safe re-write; aborts if upstream changed since last fetch)
> 2. **Abort** — leave the push undone; investigate manually

Never `git push --force` without lease. Never silent.

### 5d. Create or edit PR/MR

If `HOST=unknown`:

- Skip this step.
- Print: "Host `<URL>` not supported by `ba:propose`. Composed body:" followed by the body.
- Print: "Paste into your platform's UI manually. Commits were pushed successfully."
- Exit zero (commit + push succeeded).

Otherwise, check for existing open PR/MR:

```bash
# GitHub
EXISTING_PR_URL=$(gh pr view --json url,state -q 'select(.state=="OPEN") | .url' 2>/dev/null)

# GitLab
EXISTING_MR_URL=$(glab mr view -F json 2>/dev/null | jq -r 'select(.state=="opened") | .web_url')
```

**Fetch-before-write** (when editing — last read wins):

```bash
# Re-fetch body immediately before publish; re-extract preserved blocks from the now-current remote body
CURRENT_BODY=$(gh pr view --json body -q .body)
# (re-run the Step 2d extract on $CURRENT_BODY → fresh preserved_blocks tuple)
```

**Invariant**: Preserved blocks are byte-identical by construction (Step 3.4 inserts the raw markdown as-is). The *last* read of the remote body wins; an explicit hash comparison adds no information. So if the re-extracted preserved blocks differ from what Step 2d captured, the fresh extract is authoritative.

**Splice via re-composition, not manual edit.** To incorporate the fresh preserved blocks without leaking Step 3.4's splice-position rules into the orchestrator, rebuild `CompositionInputs` with the fresh `preserved_blocks` tuple and call `compose_body` a second time. By the determinism invariant (Step 3 contract), `title` and the non-preserved sections of `body` re-derive identically because all other inputs are unchanged; the only change between the preview's composed body and the published body is the (refreshed) preserved-block content at their canonical positions. The orchestrator never names a splice position. Cost: one extra composition pass (no I/O, deterministic) and one extra `gh pr view` round-trip; in exchange the seam stays narrow and "preview ≈ publish" holds modulo the freshest preserved blocks.

Surface a one-line notice in 5d's output when the published body's preserved blocks differ from those shown at preview: `ℹ Preserved blocks updated between preview and publish — published body uses the latest remote read.` This keeps the user informed without recreating the rejected interactive recovery menu.

**Write body to temp file** (always — no `--body "$(cat ...)"`, no stdin, no pipes):

```bash
BODY_FILE=$(mktemp "${TMPDIR:-/tmp}/ba-propose-body.XXXXXX")
cat > "$BODY_FILE" <<'__BA_PROPOSE_BODY_END__'
<full PR/MR body — same content as commit message>
__BA_PROPOSE_BODY_END__
```

**Dispatch:**

```bash
# GitHub — create
gh pr create \
  --title "<title>" \
  --body-file "$BODY_FILE" \
  --base "$DEFAULT_BRANCH"

# GitHub — edit existing
gh pr edit "$EXISTING_PR_URL" \
  --title "<title>" \
  --body-file "$BODY_FILE"

# GitLab — create
glab mr create \
  --title "<title>" \
  --description-file "$BODY_FILE" \
  --target-branch "$DEFAULT_BRANCH"

# GitLab — edit existing
glab mr update "$EXISTING_MR_URL" \
  --title "<title>" \
  --description-file "$BODY_FILE"
```

**Post-push PR-create failure.** If push succeeded in 5c but the `gh pr create` / `glab mr create` call fails:

- Surface the platform's exact error message.
- Print: "Push succeeded; PR/MR creation failed. Re-run `/ba:propose` after fixing the platform issue — commits are already pushed, so staging/commit/push are no-ops, and Step 5d will create the PR."
- Exit non-zero. Do not retry automatically. Do not rewind the push.

### 5e. Output

On success, print:

```
✓ <title>
  <PR or MR URL>
```

## Failure Modes

| Failure | Where it surfaces | Recovery |
|---|---|---|
| Invalid branch state (detached HEAD, default branch with or without work) | Step 1 | Interactive routing per Step 1's four-way decision table — offer create-branch or refuse. |
| `HOST=unknown` | Step 0a | Skip 5d; commit + push only; print body for manual paste. |
| Empty diff (base moved) | Step 2a | `CompositionInputError` with rebase-or-close message. |
| Linear MCP failure with ID present | Step 2b | Warn at preview; fall back to diff-derived motivation. |
| Preserved-block race window | Step 5d | Re-fetch + re-extract immediately before publish; published body uses the freshest remote read. No interactive recovery needed. |
| Body > 150 lines | Step 4 | Warn at preview; user decides. |
| Hook failure on commit | Step 5b | Surface output, exit, never `--no-verify`. |
| Non-fast-forward push | Step 5c | Offer `--force-with-lease` or abort. |
| PR-create after-push fails | Step 5d | Surface error; instruct user to re-run `/ba:propose` (commits already pushed, so 5a-5c are no-ops, 5d retries the create). |

## Important Guidelines

- Composition is a pure contract — it consumes the value objects in `CompositionInputs` and reaches out to nothing. Add I/O? Add it to Step 2.
- Never `git add -A` / `git add .`. Explicit paths only.
- Never `--no-verify` unless the user has explicitly asked, with an audited reason.
- Never silent force-push. `--force-with-lease` only, with explicit confirmation.
- `--body-file` always points at a temp file written by a quoted-sentinel heredoc. Never `--body "$(cat ...)"`, never stdin, never pipes.
- Preserved blocks (`<!-- CURSOR_SUMMARY -->`, `## Demo`, `## Screenshots`) are byte-identical in and out.
- Linear is optional. Failure ≠ absence — warn at preview when MCP failed.
- `docs/solutions/` absence is normal. Defensive empty-tuple.
- The diff is visible on the platform; the body explains what the diff cannot show.
- Title = effect, not mechanism. Rewrite if drafted as mechanism, disclose the rewrite in preview.
- `fix:` over `feat:` when ambiguous.
````

#### Success Criteria

##### Automated:
- [ ] `grep '__BA_PROPOSE_BODY_END__\|__BA_PROPOSE_COMMIT_END__' commands/ba/propose.md` — quoted-sentinel heredoc markers present
- [ ] `grep -c 'mktemp' commands/ba/propose.md` — temp-file pattern used (>= 2)
- [ ] `grep 'force-with-lease' commands/ba/propose.md` — force-push policy present, no `--force` alone
- [ ] `grep -E 'gh pr create|gh pr edit|glab mr create|glab mr update' commands/ba/propose.md` — all four host actions present
- [ ] `grep '## Failure Modes' commands/ba/propose.md` — failure mode appendix present
- [ ] `grep 'Hook failed' commands/ba/propose.md` — hook-failure recovery present
- [ ] `grep -c 'AskUserQuestion' commands/ba/propose.md` — interactive prompts (final >= 12)
- [ ] `commands/ba/propose.md` line count between 400 and 800 — in line with comparable commands

##### Manual:
- [ ] Preview block includes title, optional "rewritten from", line count, lead sentence, and warnings.
- [ ] Edit-vs-create dispatch is conditional on `EXISTING_PR_URL` / `EXISTING_MR_URL`.
- [ ] Step 5d re-fetches the PR body via `gh pr view --json body` (or `glab mr view`) and re-extracts preserved blocks from the freshest remote read immediately before publishing — no hash compare, no interactive menu.
- [ ] Step 5a stages all changed files in a single commit using explicit paths only; no heuristic-based multi-commit grouping prompt.
- [ ] `HOST=unknown` path completes commit + push but never invokes platform-specific create — falls through gracefully.
- [ ] Post-push PR-create failure does not retry, does not rewind the push, and gives a clear `--describe-only` recovery path.

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 5.

---

### Phase 5 — Docs updates and version bump

Update `CLAUDE.md`, `README.md`, and `.claude-plugin/plugin.json` so the new command, new category, and new convention are documented in all three places per the established convention (`CLAUDE.md:74` — "Update README.md whenever commands, agents, or artifact paths are added or changed").

#### Changes Required

<!-- slice:5 "Docs + version bump" -->

**File**: `CLAUDE.md`

Insert a new `### Git Workflow Commands` subsection between Knowledge (line 28) and `## Agents` (line 30). Title Case matches the cadence of peer subsections in `CLAUDE.md:7-26`. Verbatim block to insert at line 29:

```markdown

### Git Workflow Commands (ship code — commit, push, open PR/MR)

- `/ba:propose [--describe-only] [--issue <ID>]` — Commit, push, and open PR/MR with a composed title and body
```

Append a new convention bullet at the end of `## Conventions` (currently `CLAUDE.md:74`):

```markdown
- Git workflow commands (`ba:propose`) commit, push, and open PR/MR — they never modify source files outside the staged diff
```

**File**: `README.md`

README's `## Commands` section is intentionally flat — no category subsections, each command gets its own `### /ba:xxx` block (see `README.md:36-197`). The new "Git Workflow" grouping lives in CLAUDE.md only. README readers see `/ba:propose` as a peer of every other `/ba:` command. This asymmetry is deliberate: CLAUDE.md tracks categories so Claude can reason about them; README is a flat user-facing reference.

Insert a new `### /ba:propose [args]` block at line 172 (immediately before `### Severity ladder and confidence anchors (/ba:review)`):

```markdown
### /ba:propose [--describe-only] [--issue <ID>]

Commit, push, and open a PR/MR with a composed title and body.

- Pure-function body composition: orchestrator gathers inputs (diff, branch, Linear, docs/solutions, preserved blocks, evidence) → composition reads value objects and returns title + body
- Host-detected dispatch: GitHub `gh`, GitLab `glab`, graceful fallback for unknown hosts (compose + push only)
- Body composition selects from Michael Lynch's 16-section menu, sized to the diff — the size-tier vocabulary is hidden behind the composition seam (no flag, no preview surface)
- Linear MCP optional with diff-derived fallback; clear preview warning when MCP is unavailable
- `docs/solutions/` auto-detection on current-branch-touched entries; per-entry confirm to splice as "What I learned"
- Cursor BugBot block and existing `## Demo` / `## Screenshots` preserved byte-identical
- Commit message and PR/MR body share the same composed markdown — no separate render path
- `--body-file` discipline (temp file + quoted-sentinel heredoc); no `git add -A`/`.`; no `--no-verify`; `--force-with-lease` only
- Preview-then-confirm always — apply / edit / regenerate-with-hint / exit
```

**File**: `.claude-plugin/plugin.json`

Bump version, extend description, add keyword.

Before:

```json
{
  "name": "dev-workflow",
  "version": "0.17.0",
  "description": "Research, brainstorm, plan, slice, execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
  ...
  "keywords": [
    "research", "brainstorm", "planning", "slice", "execute",
    "workflow", "conventions", "review", "compound", "knowledge"
  ]
}
```

After:

```json
{
  "name": "dev-workflow",
  "version": "0.18.0",
  "description": "Research, brainstorm, plan, slice, execute, review, compound, and propose commands with triage, convention compliance, and knowledge compounding",
  ...
  "keywords": [
    "research", "brainstorm", "planning", "slice", "execute",
    "workflow", "conventions", "review", "compound", "knowledge", "propose"
  ]
}
```

#### Success Criteria

##### Automated:
- [ ] `grep 'Git Workflow Commands' CLAUDE.md` — new category present
- [ ] `grep '/ba:propose' CLAUDE.md` — command listed in CLAUDE.md
- [ ] `grep 'Git workflow commands.*never modify source files' CLAUDE.md` — convention bullet present
- [ ] `grep '/ba:propose' README.md` — command listed in README
- [ ] `grep -c 'force-with-lease\|--body-file' README.md` — discipline bullets visible to users (>= 1)
- [ ] `grep '"version": "0.18.0"' .claude-plugin/plugin.json` — version bumped
- [ ] `grep '"propose"' .claude-plugin/plugin.json` — keyword added
- [ ] `grep '"description":.*propose' .claude-plugin/plugin.json` — description updated

##### Manual:
- [ ] CLAUDE.md `### Git Workflow Commands` section reads as a peer of the other category subsections, not a footnote.
- [ ] README `### /ba:propose` block matches the style of `/ba:slice` and `/ba:compound` (one-line description + bullet list).
- [ ] `plugin.json` version bump matches semver convention for a new command (`0.X.0` minor bump).
- [ ] No accidental edits to `marketplace.json` (out of scope).
- [ ] No accidental edits to `commands/ba/execute.md`'s "Create MR/PR" delegation — that menu may eventually point at `/ba:propose` but is out of scope here.

> **Phase gate:** Automated verification must pass. Manual verification completes the plan.

---

## System-Wide Impact

### Interaction Graph

When `/ba:propose` runs in `full` mode:

```
user             →   /ba:propose
orchestrator     →   git remote / git status / git rev-parse / git fetch / git diff / git log
orchestrator     →   mcp__claude_ai_Linear__get_issue (optional)
orchestrator     →   docs/solutions/ scan (file read)
orchestrator     →   gh pr view --json url,state,body  /  glab mr view -F json (when existing PR)
composition      ←   (returns title + body — no callouts)
orchestrator     →   AskUserQuestion (preview confirm)
orchestrator     →   git add <files>
orchestrator     →   git commit -F <tempfile>  (triggers pre-commit, commit-msg hooks)
orchestrator     →   git push -u origin HEAD  (triggers pre-push hook)
orchestrator     →   gh pr create --body-file <tempfile>  /  glab mr create --description-file <tempfile>
                     OR gh pr edit / glab mr update (when existing PR)
```

External callbacks affected: any pre-commit / commit-msg / pre-push hook the repo has installed. The command does not bypass them.

### Error & Failure Propagation

- Gather-side errors (Step 2) raise `CompositionInputError` — never reach composition.
- Composition errors are not allowed by contract — it produces a valid body or it's a code bug to fix.
- Apply-side errors (Step 5) surface verbatim to the user with explicit recovery instructions:
  - Hook failure: working tree untouched, exit non-zero, user fixes and re-runs.
  - Push rejection: explicit `--force-with-lease` confirmation, no silent override.
  - PR-create failure after push success: separate `--describe-only` recovery flow documented.
- MCP failure with ID present: warning bubbles to preview, no exception thrown.
- `docs/solutions/` directory missing: defensive empty-tuple, silent.

### State Lifecycle Risks

The command makes mutations in this order: commit (local) → push (remote) → create/edit PR (remote). A failure between push and create-PR leaves a pushed branch with no PR — recovery is simply re-running `/ba:propose`: commits are already pushed, so 5a-5c are no-ops and 5d creates the PR. The fetch-before-write at the start of Step 5d ensures the freshest preserved blocks are spliced into the published body.

No per-repo state file is written by `ba:propose`. Earlier drafts cached a `--diverge` answer in `.git/dev-workflow/propose-config`; that flag was dropped post-capture (see brainstorm: *2026-05-19 Addendum — `--diverge` dropped*) and the cache went with it.

### API Surface Parity

GitHub and GitLab adapters expose equivalent capability:

| Operation | GitHub | GitLab |
|---|---|---|
| View open PR/MR | `gh pr view --json url,state,body,isDraft` | `glab mr view -F json` |
| Create | `gh pr create --title <T> --body-file <F> --base <B>` | `glab mr create --title <T> --description-file <F> --target-branch <B>` |
| Edit | `gh pr edit <URL> --title <T> --body-file <F>` | `glab mr update <URL> --title <T> --description-file <F>` |

GHES uses `gh` with `GH_HOST` env. Self-hosted GitLab uses `glab` with its own config. Unknown hosts skip the create/edit step entirely.

### Integration Test Scenarios

Five cross-layer scenarios that unit-level greps would not catch:

1. **GitHub feature branch, no existing PR, full workflow, no Linear, no solutions, no evidence.** Confirms minimal-input happy path produces a short body (composition-internal "small" tier; not named at call site) and `gh pr create --body-file` succeeds.
2. **GitLab feature branch, existing open MR, BugBot block present, no new commits to push.** Step 0b detects the open MR + nothing-to-push and asks "update description only?" — on Yes, Step 5 skips push and Step 5d calls `glab mr update` (not `glab mr create`); BugBot block round-trips byte-identical.
3. **Substantive change (>200 lines, >10 files) with multiple `docs/solutions/` hits, per-entry confirm.** Confirms per-entry AskUserQuestion, "include all"/"skip all" shortcuts, and that the composed body splices accepted entries as "What I learned" while dropping rejected ones.
4. **Linear MCP unavailable (server stopped), branch name `bru/TO-123-fix-x`.** Confirms preview shows the "Linear MCP unavailable" warning, body uses diff-derived motivation, command does not error.
5. **Unknown host (`git@bitbucket.org:org/repo.git`), feature branch, full workflow.** Confirms commit + push succeed, the create-PR step is skipped with the "paste manually" message, body is printed in full, exit code is zero.

## Risk Analysis & Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| `--body-file` discipline regresses (someone adds `--body "$(cat ...)"` in a future edit) | High | Automated grep in Success Criteria; explicit Important Guidelines bullet; the Failure Modes table singles it out. |
| Composition seam leaks (orchestrator starts reading composition internals) | Medium | Locked design documented in Step 3; reviewers can flag drift. |
| Preserved-block byte-identity breaks (a future composition tweak alters whitespace) | High | Step 3.4 explicitly says "raw markdown is inserted as-is — do not re-format"; success criterion includes BugBot round-trip behavior. |
| MCP schema drift breaks Linear motivation | Low | `issue_context.raw: Mapping[str, Any]` is opaque — composition reads "whatever fields exist if available." |
| `gh`/`glab` not installed | Medium | Detection failure in Step 0a leads to `HOST=unknown` path; no hard dependency assertion. |
| Hook bypass via accident | High | Explicit "never `--no-verify`" rule; Failure Modes recovery is fix-and-retry, never bypass. |
| Force-push catastrophic | High | Only `--force-with-lease`, only after explicit AskUserQuestion confirmation. |
| Title rewrite changes intent silently | Medium | Always disclose `rewritten from: <original>` in preview when a rewrite occurred. |
| Body too long without warning | Low | Soft cap warning at preview; user decides. |

## Testing Strategy

This repo has no test harness — verification is structural greps + manual scenario walk-throughs (see `docs/plans/2026-03-14-feat-add-ba-execute-command-plan.md` for the canonical precedent). The `Success Criteria` per phase above codifies both.

**Manual scenario coverage** corresponds 1:1 to the five Integration Test Scenarios above. Each can be exercised by running `/ba:propose` against a real branch with the relevant repo configuration. The author should run all five before tagging v0.18.0.

**Convention-checker re-run** (already done at plan capture; success criteria covers the conventions the plan introduces).

## Documentation Plan

- `commands/ba/propose.md` — new, ~500–700 LoC, the command itself.
- `CLAUDE.md` — new category subsection + new convention bullet.
- `README.md` — new `### /ba:propose` block.
- `.claude-plugin/plugin.json` — version + description + keywords.

Not in this plan:
- `marketplace.json` bump (separate cadence).
- `docs/solutions/` seeding (handled organically by `/ba:compound` after first usage).
- Roadmap `✅` (added post-release if at all).

## Dependencies & Risks

**External CLIs required at runtime:**
- `gh` — GitHub CLI. Installation: `brew install gh` / `apt install gh`. Authentication: `gh auth login`.
- `glab` — GitLab CLI. Installation: `brew install glab`. Authentication: `glab auth login`.

**Optional MCP server:**
- Linear MCP (`mcp__claude_ai_Linear__*`). Absence is silently tolerated; presence is auto-detected.

**Risks tracked above** in *Risk Analysis & Mitigation*.

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md`. Key decisions carried forward:
  - Command name `ba:propose` and new "Git workflow" category (see brainstorm: `## Key Decisions`).
  - Hybrid Locked Design — A's pure-function composition + C's opaque value-object inputs (see brainstorm: `## Locked Design`).
  - Acceptance criteria items 1–11 (see brainstorm: `## Acceptance Criteria`).
  - Scope boundaries (see brainstorm: `## Scope Boundaries`).
  - Carry-over from CE: mode dispatch, four-way branch tree, file-level commit splitting, `--body-file` discipline, preview-apply summary, `fix:` vs `feat:`, `#`-list-prefix gotcha (see brainstorm: `## Key Decisions`).
  - Carry-over from `mr` skill: Linear MCP optional, BugBot preservation, Lynch effect-vs-mechanism worked example.
  - Drops from `mr`: fixed 3-heading template, hardcoded `time-off` scope, 50-char title cap, GitLab-only orientation.

### Internal References

- Existing command file structures: `commands/ba/execute.md`, `commands/ba/review.md`, `commands/ba/compound.md`, `commands/ba/plan.md`.
- Existing `gh`/`glab` usage precedent (read-only): `commands/ba/review.md:76-86`.
- Existing `--body-file` precedent (issue creation): `commands/ba/plan.md:507`.
- Existing `docs/solutions/` defensive pattern: `commands/ba/compound.md:55-61`.
- Existing test-strategy precedent: `docs/plans/2026-03-14-feat-add-ba-execute-command-plan.md:459-482`.
- Standing synthesis-lock rule: `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` *### Concrete rules*.

### External References

- Michael Lynch, *How to Write Useful Commit Messages* — `https://refactoringenglish.com/chapters/commit-messages/` (extracted in `docs/research/2026-05-17-shipping-skill-source-material-research.md` Source 4).
- EveryInc `ce-commit-push-pr` skill — extracted in `docs/research/2026-05-17-shipping-skill-source-material-research.md` Source 1.
- Local `mr` skill — `~/.claude/skills/mr/SKILL.md` (Bruno's machine; reference only).
- Cursor BugBot sentinel format — extracted in `docs/research/2026-05-17-shipping-skill-source-material-research.md` Source 5.

## Convention Compliance

- [x] Filename matches `YYYY-MM-DD-<type>-<name>-plan.md` — `2026-05-19-feat-add-ba-propose-command-plan.md`
- [x] YAML frontmatter present with `title`, `type`, `status`, `date`, `origin`, `detail_level`, `iteration_count`, `tags`
- [x] Plan does not write source code — only specifies markdown command file + doc updates
- [x] Command prefix `ba:` honored
- [x] `What We're NOT Doing` section present
- [x] Per-phase Success Criteria separated into Automated and Manual
- [x] Phase gates pause for manual verification before next phase
- [x] Exact file paths and concrete code blocks used (no placeholder pseudo-paths)
- [x] CLAUDE.md `## Conventions` update planned (Phase 5)
- [x] README.md update planned (Phase 5)
- [x] `version` bump in `.claude-plugin/plugin.json` planned (Phase 5)
- [x] Composition-spec Python signatures retained as design contract — template-sanctioned per the brainstorm's design-it-twice template (see brainstorm: `## Convention Compliance`, *Informational*)
- [x] New "Git workflow" command category added to CLAUDE.md per brainstorm's Convention Compliance directive
- [x] Origin brainstorm reference present in frontmatter and Sources
- [x] All built-in reviewers / protected-artifact rules unaffected by this plan

## Deviations

### Phase 2: AskUserQuestion grep threshold (>= 8) unmet
- **Expected**: `grep -c 'AskUserQuestion' commands/ba/propose.md` returns >= 8 by end of Phase 2.
- **Found**: Returns 1 — the single occurrence sits in Step 0b's mode-resolution prose (carried over from Phase 1). Phase 2's content as written in the plan uses prose-style prompts (`ask the user **once**`, `ask:` with numbered option lists) and never spells the literal `AskUserQuestion` token. The token first appears literally in Phase 4 (Step 4 preview), where the count will jump.
- **Why**: Plan-internal mismatch — the Phase 2 success-criteria threshold cannot be satisfied by the Phase 2 markdown content the plan itself prescribes. The metric was apparently authored on the assumption that prose `ask:` lines would also count. Phase 1's `>= 5 by end of plan` target tracks the same metric and will pass once Phase 4 lands.
- **Resolution**: Accepted. Slice 2's user-observable behaviors (Linear MCP optional/absent, `docs/solutions/` per-entry confirm, empty-diff error) are all satisfied by the Step 2 prose prompts as written; the interactive-prompt invariant is satisfied in spirit. Phase 4's introduction of literal `AskUserQuestion` blocks will bring the cumulative count well above the original end-of-plan goal.
