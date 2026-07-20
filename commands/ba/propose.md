---
name: ba:propose
description: Commit, push, and open a PR/MR with a composed title and body — apply-by-default (--review to restore confirmation), host-detected dispatch for GitHub and GitLab.
argument-hint: "[--describe-only] [--review] [--issue <ID>] [optional: free-text hint]"
---

# Propose Changes for Review

Compose a commit and PR/MR body that helps the code reviewer first, teammates and future-bug-investigators next.

## Arguments

<propose_args> #$ARGUMENTS </propose_args>

### Parse Arguments

Strip recognized flags from the argument string; what remains is a free-text hint that the user wants reflected in motivation.

Recognized flags:

- `--describe-only` — Compose and print the body; do not commit, push, or create/edit a PR/MR. Useful as a dry run.
- `--review` (alias `--interactive`) — Restore the interactive confirmation gates (Step 0b edit-only confirm, Step 4 Apply menu) that are otherwise skipped by default. See `REVIEW_MODE` below.
- `--issue <ID>` — Explicitly bind a Linear issue ID. Overrides branch-name detection.
- `--target <branch>` — Override the resolved MR/PR target branch. Flows into `resolve-stack-base` opts as `target_override` (wins unconditionally for `target`; the foreign-U-ID guard still runs). Validated as an existing local/`origin/` ref.
- `--base <ref>` — Override the resolved diff base. Flows into `resolve-stack-base` opts as `base_override` (wins unconditionally for `base`; must be an ancestor of HEAD; the foreign-U-ID guard still runs).

**`REVIEW_MODE`** — a run-local orchestrator variable (alongside `ACTION`, `HOST`; it never enters `CompositionInputs`) that gates the Step 0b edit-only confirm and the Step 4 Apply menu (see U2 in those steps). Resolved as an OR, not an AND: `REVIEW_MODE = (--review present) OR (BA_PROPOSE_REVIEW is set to a non-empty, non-"0" value)`. Either signal alone is sufficient — a flag or an env var must never be silently ignored, since silently dropping an explicit safety opt-in on an apply-by-default command is the worst failure mode. `BA_PROPOSE_REVIEW=0` and an empty value are treated as unset. `BA_PROPOSE_REVIEW=1` set once in a shell profile is the persistent equivalent of always passing `--review`.

**`REVIEW_MODE` touches exactly two confirmations** — the Step 0b edit-only confirm and the Step 4 `Apply?` menu — and nothing else. The Step 5b hook-failure surface-and-exit (never `--no-verify`), the Step 5c non-fast-forward `--force-with-lease` confirmation, and the `describe_only` short-circuit are unaffected by `REVIEW_MODE` regardless of how it resolves. The **Step 5f ship-time capture offer** is likewise **not** a `REVIEW_MODE`-gated confirmation: it is non-blocking, mode-independent **post-completion chrome** that fires identically with or without `--review` — it runs after the ship has already succeeded, gates on its own predicate (5e printed `✓ <url>` and `ACTION == commit_push_create`), and can never change the ship's exit status. (Review fix: this list previously lived as two independent near-verbatim copies, one at each confirmation site, with no cross-reference tying them together — stated once here instead.)

Note: there is no explicit `--describe-update` flag. Step 0b resolves a single `ACTION` enum (one of `commit_push_create` / `commit_push_edit` / `edit_only` / `describe_only`) from the args and the branch state; Steps 5a-5d dispatch on `ACTION`. The "nothing to push + open PR" case resolves to `edit_only` via a single confirmation prompt in 0b (skipped by default — see `REVIEW_MODE`). One arg flag, one `ACTION` enum, no cross-product of mode + skip flags.

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

Resolution sequence — also caches `OPEN_PR_URL` for reuse by Steps 2d and 5d so the open-PR probe runs exactly once per command invocation:

```bash
ACTION=commit_push_create
OPEN_PR_URL=""
if [[ "$ARGS" == *--describe-only* ]]; then
  ACTION=describe_only
else
  # Probe upstream once.
  HAS_COMMITS_TO_PUSH=$([[ -n "$(git rev-list @{upstream}..HEAD 2>/dev/null)" ]] && echo yes || echo no)

  # Probe open-PR/MR state once; cache the URL (empty string when none).
  if [[ "$HOST" == "github" || "$HOST" == "ghes" ]]; then
    OPEN_PR_URL=$(gh pr view --json url,state -q 'select(.state=="OPEN") | .url' 2>/dev/null)
  elif [[ "$HOST" == "gitlab" || "$HOST" == "gitlab-self" ]]; then
    OPEN_PR_URL=$(glab mr view -F json 2>/dev/null | jq -r 'select(.state=="opened") | .web_url')
  fi

  if [[ -n "$OPEN_PR_URL" && "$HAS_COMMITS_TO_PUSH" == no ]]; then
    if [[ "$REVIEW_MODE" == true ]]; then
      # Confirm the edit-only intent — refusing this exits early
      ask "Nothing to push. Update the PR description only?" yes/no
      [[ answer == yes ]] && ACTION=edit_only || exit 0
    else
      # Apply-by-default (U2): auto-confirm edit-only intent, no prompt.
      ACTION=edit_only
    fi
  elif [[ -n "$OPEN_PR_URL" ]]; then
    ACTION=commit_push_edit
  fi
fi
```

**Apply-by-default (U2):** this confirmation is auto-confirmed to `ACTION=edit_only` when `REVIEW_MODE` is false (the default — no `--review` flag and no `BA_PROPOSE_REVIEW`) and asked (current behavior) only when `REVIEW_MODE` is true. See the `REVIEW_MODE` definition (Arguments, above) for the full scope of what this flip touches and what it leaves unaffected.

After Step 0b, every downstream step reads `ACTION` and `OPEN_PR_URL` and nothing else for mode dispatch / PR-targeting. `MODE` and `skip_push` are not separate variables — they were intermediate concepts in an earlier draft, collapsed at plan-review time into `ACTION` so cross-step state is named once. The Step 5 action plan table (below) dispatches on `ACTION` directly; `OPEN_PR_URL` is the canonical PR identifier threaded through Steps 2d and 5d.

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
if [[ -z "$DEFAULT_BRANCH" && ( "$HOST" == "github" || "$HOST" == "ghes" ) ]]; then
  DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null)
fi
[[ -z "$DEFAULT_BRANCH" ]] && DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}')
```

The `gh repo view` probe is guarded behind `HOST=github|ghes` so a non-GitHub remote (GitLab, Bitbucket, unknown) does not invoke the wrong CLI. `git symbolic-ref` is host-agnostic and tried first; `git remote show origin` is the host-agnostic fallback that carries the unknown-host case.

If still empty, ask the user.

## Step 2: Gather inputs

Each sub-step materializes one field of `CompositionInputs`. None of this happens inside composition.

### 2a. Diff and branch metadata

`DIFF_BASE` and the MR/PR target both come from `resolve-stack-base` (owned by the
`## Stack-Base Resolution Convention` section in `execute.md`) — do **not** re-derive
`merge-base HEAD origin/$DEFAULT_BRANCH` inline. **Execute the owner spec, don't
approximate it:** open that section and run its detection / degrade-abort / guard steps
verbatim — the full algorithm (ref scope, self-exclusion, fetch policy, confidence
precedence, foreign-U-ID guard, override validation) lives only there; this step supplies
the `host_signal` and reads the resulting `resolution` fields. `/ba:propose` is the one
consumer that layers a `host_signal`:

- `r = resolve-stack-base(git, host_signal: open-mr-probe, base_override: <--base>, target_override: <--target>)`
- `DIFF_BASE = r.base`; the MR/PR target (Step 5) = `r.target`.
- Capture `r.warning` / `r.confidence` into orchestrator-side state (alongside `DIFF_BASE`, `DEFAULT_BRANCH` — **not** into `CompositionInputs`). When `r.warning != null` (equivalently `r.confidence != high` — e.g. an `ambiguous` host-vs-git target disagreement, or a `low` `FOREIGN_UID_IN_WINDOW`), the Step 4 preview surfaces it (see Step 4's warning lines) so the author sees a contested/uncertain base **before** the MR opens against it. This is the consumer that cashes in the `ambiguous` state.
- **Open-MR probe** (`host_signal` callback): given a candidate ancestor branch,
  reports whether **that branch** has its own open PR/MR. It reuses the *host detection*
  from Step 0a but **not** Step 0b's `OPEN_PR_URL` probe — that probe is scoped to the
  current branch (`gh pr view` / `glab mr view` with no ref). The callback must query
  the candidate by name: `gh pr list --head "<candidate>" --state open` (GitHub) /
  `glab mr list --source-branch "<candidate>" --state opened` (GitLab), treating a
  non-empty result as "has an open MR." Promotes such an ancestor to a strong parent
  signal so the MR stacks onto the parent branch.
- **Empty-window (per the Stack-Base empty-window contract):** propose's Step 1 routing
  guarantees a valid branch/remote, so `window == ""` is not expected — but if
  `resolve-stack-base` returns `window == ""` / `base == ""`, raise
  `CompositionInputError` rather than forming an invalid `..HEAD` range.

```bash
git diff --stat "$DIFF_BASE..HEAD"
git diff --numstat "$DIFF_BASE..HEAD"
git diff --name-status "$DIFF_BASE..HEAD"
git log --pretty=oneline "$DIFF_BASE..HEAD"
git rev-parse --abbrev-ref HEAD
```

Capture into the orchestrator's local state:

- `diff.range = "$DIFF_BASE..HEAD"`
- `diff.file_stats = <output of --numstat>`
- `diff.file_status = <output of --name-status>` — per-path add/modify/delete status. `--numstat` gives line-count deltas only, so it can't distinguish a deleted test file from a modified one; Proof detection (Step 2e) reads `diff.file_status` to exclude deletions.
- `diff.commit_log = <output of --pretty=oneline>`
- `branch.name = <current branch>`
- `branch.base_ref = "$(r.target)"` (the resolved stack target — `origin/$DEFAULT_BRANCH` when non-stacked)
- `branch.last_merge_sha = "$DIFF_BASE"`

If `git diff --stat "$DIFF_BASE..HEAD"` is empty AND there are commits in the log, raise the empty-diff error:

> **CompositionInputError: branch is fully contained in base.**
> Your commits exist but the diff vs the resolved base (`<r.target>` — the stack parent when stacked, `origin/<DEFAULT_BRANCH>` otherwise) is empty. Likely causes: someone landed equivalent changes in the base and your branch is now redundant, or the base was force-pushed past your branch tip. Rebase, or close the branch.

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

If at least one entry was returned, ask the user **once** via `AskUserQuestion`. Print the numbered list of detected entries (with summaries) as the question text so the user can see what's being included before choosing:

```
AskUserQuestion(
  question: "Found N docs/solutions/ entries touched on this branch:\n
            1. <path-1> — <summary-1>\n
            2. <path-2> — <summary-2>\n
            ...\n
            \nInclude as 'What I learned'?",
  header: "Solutions",
  multiSelect: false,
  options: [
    { label: "Include all",  description: "Splice every detected entry" },
    { label: "Skip all",     description: "Splice none" },
    { label: "Choose",       description: "Drop into a per-entry yes/no loop (surgical control)" },
  ],
)
```

Default for the typical case (1–3 entries) is "Include all" — that's what the loop is gathering. The per-entry **Choose** path opens a follow-up `AskUserQuestion` sequence with a single yes/no per remaining entry; no Include-all / Skip-all shortcuts at that level (the user already picked "Choose" because they want individual control).

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

### 2e. Proof detection (non-blocking — no question asked)

Scan `diff.file_stats` + `diff.file_status` (both captured in 2a) and derive `proof` deterministically. No prompt — this replaces the earlier blocking evidence question:

- **Automated** — one or more test files with `A`/`M` status in `diff.file_status` (deletions excluded, since a deleted test file proves nothing) → `proof = ("automated", "<first test file path>")`. Test-file globs: a path matching `*_test.*`, `*.test.*`, `*_spec.*`, `*.spec.*`, `test_*.*`, or under a `test/`, `tests/`, `spec/`, or `__tests__/` segment. Presence only — quality is not asserted (a weakening diff still trips this).
- **Visual** — `preserved_blocks` contains `demo`/`screenshots` → `proof = ("visual", <pointer to the Screenshots/Demo section>)`. A pointer, not an embed.
- **n/a** — no runtime surface: every changed path is under `docs/`, or a repo-root passive doc (`README.md`, `CLAUDE.md`, `CHANGELOG.md`), or config-only → `proof = ("na", None)`. Review fix: a bare `*.md` glob would also match `commands/*.md`, `agents/*.md`, `skills/*.md` — prompt-spec files that are executable agent logic, not passive documentation — and wrongly suppress the pending/QA nudge on exactly the diffs (like this one) that most need it. Those paths fall through to **pending** instead.
- **pending** — otherwise → `proof = ("pending", None)`.

`Manual` (repro/QA notes) is **non-materializing**: no gather step ever sets `proof.kind = manual`. It exists only as help/prose vocabulary describing what a human may add by hand via the `--review` Edit-body path (Step 4) — it is not a code-representable `proof` value, and no registry branch renders it.

### 2f. Deviation trailers (`/ba:execute` rollup)

Scan commit bodies over the **same `DIFF_BASE..HEAD` window** materialized in 2a (this is the `<base>..HEAD` window; `<base>` derivation is owned by the `## Stack-Base Resolution Convention` section in `execute.md` — `DIFF_BASE` *is* that `<base>` (`resolve-stack-base(git, host_signal: open-mr-probe).base`); do not re-derive it). The plan being preserved may be `.md` or `.html` — this step reads only git commit bodies, never the plan file, so the format is irrelevant here:

```bash
git log "$DIFF_BASE..HEAD" --format=%B | grep -E '^Deviation \(U[0-9]+\):'
```

For each matched line, capture the trailer **text only** — the content after the `Deviation (U<n>):` label. The `U<n>` token is read to match the line but is **not** carried forward: it is plan-scoped state a reviewer cannot decode (the plan lives outside the pushed repo), so it is noise in reviewer-facing output. Strip the leading label here, at gather time — this is render-side only and never rewrites the commit body, so `derive-state`'s subjects-only scan is unaffected. Dedup on **exact text** so a single deviation that recurred across multiple units (each unit emitting its own trailer) collapses to one entry rather than one bullet per unit:

- `deviation_trailers = ("<what diverged and why>", ...)` or `()` — a tuple of unique trailer texts.

**Near-matches**: a line that almost fits the trailer form but doesn't match the exact `Deviation (U<n>):` grammar (e.g. `Deviations:`, a missing `U<n>`, lowercase `deviation`) is **skipped** from `deviation_trailers` but recorded in orchestrator-side state as a near-match so Step 4's preview can warn the author to correct it before the MR/PR opens. Near-match warnings are orchestrator-side only — they never flow into `CompositionInputs`.

If no trailers (and no near-matches) are found, set `deviation_trailers = ()` silently. Note: local squashing before `/ba:propose` drops trailers in non-final commits (documented residual).

### 2g. Shared classification facts (runs before 2h)

Materialize two facts **once**, read by three consumers — the existing Breaking-changes row #4, Risk (2h below), and `## Where to look` (Step 2i) — so none of the three re-derives them and the heuristics can't drift apart:

- `sensitive_paths_touched` — the matched sensitive-class names touched by the diff (possibly empty), matched on a **path segment / word boundary**, never a substring (so `AuthorList.tsx` does not match `auth`). Classes:
  - **payments**: `payment`, `billing`, `charge`, `invoice`
  - **auth**: `auth`, `session`, `token`, `login`, `credential`, `password`
  - **migrations**: `migrate`, `migration`, `schema`, `db/`
  - **security**: `crypto`, `secret`, `permission`, `acl`, `security`
- `breaking_signal` — bool, reusing row #4's existing API-removal/schema-change detector.

### 2h. Risk derivation (deterministic; runs after 2g)

Materialize `risk = (level, reason)` from `sensitive_paths_touched` + diff size + `breaking_signal`. Evaluate the table top-down; the first matching row wins (review fix: the earlier `max(path_risk, size_risk, breaking_risk)` framing named three sub-scores that were never independently defined — this table is the only definition):

| level | condition |
|---|---|
| high | `breaking_signal` is true OR `sensitive_paths_touched` is non-empty |
| medium | `lines_changed > 200 OR files_changed > 10` (raw facts from `diff.file_stats`, computed here directly — **not** the seam-hidden `tier` value, since 2h runs before Step 3's `3.1 Classify size tier` even exists; review fix: the earlier "`large` tier by size" wording named a not-yet-computed, composition-only concept, and the dropped "sensitive-adjacent path with notable size" clause added nothing beyond `sensitive_paths_touched`, which already forces `high` above) |
| low | otherwise |

`reason` names the dominant contributor, drawn from `sensitive_paths_touched` / the breaking signal (e.g. `medium — touches auth, DB migration`). Materialize `risk` as a fixed string here — never generate it as free-text inside composition — because it feeds a structured lead-line that Step 5d's fetch-before-write re-composition must re-derive byte-identically.

### 2i. Focus-area selection (deterministic; runs after 2h)

Materialize `focus_areas` — a tuple of 1–2 short strings, possibly empty — from diff hotspots. Reads the shared `sensitive_paths_touched` / `breaking_signal` facts (2g) and the already-materialized `risk` (2h); this is why 2g → 2h → 2i is a strict order within Step 2.

**Hotspot rule:** the top 1–2 files by churn (`additions + deletions` from `diff.file_stats`'s `--numstat`) that also carry a breaking or sensitive signal, plus any breaking-change surface.

**Dedup vs Risk basis:** dedup against the shared structured fact `sensitive_paths_touched` (2g) directly — drop a hotspot whose matched sensitive-class name is already in that set (e.g. drop a `payments/…` hotspot when `sensitive_paths_touched` already contains `payments`). Not a raw-path string compare, and not a text-parse of `risk.reason`'s rendered prose (review fix: parsing `reason`'s wording would couple 2i to however 2h happens to phrase it, silently breaking if that phrasing ever changes — `sensitive_paths_touched` is the stable, already-shared fact both consumers were built to read).

If no file clearly dominates and no breaking/sensitive signal exists, `focus_areas = ()` (no hotspot).

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
  proof              # (kind, pointer) — kind ∈ {automated, visual, na, pending}
  risk               # (level, reason) — level ∈ {low, medium, high}; materialized string
  focus_areas        # tuple of short strings, possibly empty
  breaking_signal    # bool — materialized once in Step 2g; row #4 (Breaking changes) reads this field rather than re-deriving its own detector (review fix: 2g's "so none of the three re-derives them" claim was previously unenforceable because this field never crossed the seam)
  deviation_trailers # tuple of (text,) — unique trailer texts, label stripped, possibly empty
```

**Outputs**:

```
ComposedBody:
  title              # effect-phrased, ≤72 chars, no trailing period
  body               # final markdown — feeds both commit and PR/MR
  rewritten_from     # str or None — original title when 3.3 rewrote a mechanism-only draft; None when no rewrite occurred
  size_warning       # str or None — when the body overshoots its tier's soft target (3.1a), a ready-to-print phrase naming that target shape (e.g. "~one screen for a change this size"); None when within target. Mirrors rewritten_from's None-or-value shape. The phrase names the target SHAPE, never the tier label — the tier stays seam-internal (Step 4 invariant).
```

`rewritten_from` and `size_warning` are declared output fields so the orchestrator's preview (Step 4) reads them by name; composition never side-channels state to the orchestrator. The seam stays one-direction: inputs in, ComposedBody out.

(See brainstorm: `## Locked Design`, *Interface*.)

### Invariants (every composition pass must satisfy these)

- `body` never restates the diff verbatim. The diff is visible on the platform; the body explains what the diff cannot show.
- Match weight to weight: when in doubt, shorter wins, and a larger diff earns *more selectivity, not more content*. Default to the smallest body that still saves the reviewer a round-trip. This governs prose verbosity and optional/narrative sections — it never suppresses a required section (breaking changes, dependency justifications, cross-refs still appear when their input is present). See the per-tier shape targets (3.1a) and the leave-out list (3.2a).
- `title` is effect-phrased. If the initial draft is mechanism-only (e.g., "add a mutex to guard X"), rewrite to effect form ("prevent X during simultaneous Y") and stash the original for the preview's "rewritten from" disclosure.
- Preserved blocks appear exactly once, byte-identical to input. Splice positions chosen internally.
- Section order follows Lynch's priority (descriptive title → risk lead-line → impact → motivation → where to look → breaking changes → external refs → dependency justifications → cross-refs → bug summaries → testing instr → testing limits → proof → what I learned → alternatives → searchable artifacts → screenshots → rants → tempted-to-explain). A deviation fold (when present) rewrites impact's prose in place — it does not occupy its own position in this order.
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

#### 3.1a Per-tier shape targets

The tier from 3.1 sets a **soft** target shape. These are editorial guidance, not gates — do not auto-trim; the user decides (same stance as 3.6). 3.6 warns only when a body overshoots its own tier's target.

| Tier | Target shape |
|---|---|
| typo | One line. No body. |
| small | Prose, no `##` headers unless two genuinely distinct concerns. ~300 characters. |
| medium | Narrative frame, then what-and-why. At most two `H2` sections (~one screen). |
| large | Narrative + 3–5 design-decision callouts + brief test summary. ~150 lines as a backstop; a summary table beats an `H3` per mechanism. |
| perf | Before/after table + short narrative (size-independent — see the 3.1 perf-modifier note). |

"No headers unless two distinct concerns" is what folds impact (#2) and motivation (#3) into one prose paragraph at small/medium tier; they become separate headed sections only at large tier.

#### 3.2 Section registry (tier threshold + source requirement + body rule)

One declarative table replaces the earlier three-step pipeline (tier→sections → filter-by-availability → per-section generator). Each row owns one section: the minimum tier at which it activates, the input that must be present for it to appear, and the rule for generating its body. To add a new section, add one row. To add a new tier, raise/lower thresholds in this column only. Reviewers maintaining the spec read one place to see what each section depends on.

Reference numbers #1–#14 are Lynch's menu (see `docs/research/2026-05-17-shipping-skill-source-material-research.md` *Source 4*). **Rows #15–#17 (Proof, Risk lead-line, Where to look) are `/ba:propose`-specific additions layered past Lynch's original 1–16 numbering, not citations of Lynch's own #15/#16** (which are "Rants and stories" and "tempted to explain outside the commit message," respectively) — a reader following the citation should not expect rows #15–#17 to match the source doc. "Activates at" uses the tier order `typo < small < medium < large`; `perf` is a tier-modifier (see 3.1 note below) that activates rows tagged with `perf` regardless of size threshold.

| # | Section | Activates at | Required input (drop section if missing) | Body rule |
|---|---|---|---|---|
| 1 | Title | typo | — | See 3.3 (title rewriting). Always present. |
| 2 | Impact | small | — | One sentence: what was impossible/broken before, what's possible/fixed now. Falls back to commit log when motivation is thin. |
| 3 | Motivation | small (when non-obvious), medium+, perf | — | Lead with `issue_context.summary` and expand from `issue_context.body_text` when `issue_context` is present; else derive from `diff.commit_log` and changed file paths. Composition reads only composition-owned fields; the Linear-shape mapping lives in Step 2b. |
| 4 | Breaking changes | large | `breaking_signal` is true (materialized once in Step 2g; review fix: this row previously named the raw diff signal instead of the shared `CompositionInputs` field, so it silently re-derived rather than reading what 2g already computed) | Name the breaking surface (removed API, schema migration, etc.) under a `**BREAKING:**` line. Never use `!` in the title or `BREAKING CHANGE:` trailer without explicit user confirmation. |
| 6 | Dependency justifications | large | Lockfile / dependency-manifest changes in diff | List lockfile-detected adds; one-line rationale per addition. |
| 7 | Cross-refs | medium, large | `issue_context.ref` is present | `Fixes <issue_context.ref>` (normalized ref from Step 2b, e.g., `TO-1234`). Never prefix list items with `#` (auto-links `#1` — use `org/repo#N` or full URL). |
| 8 | Bug summaries | large | `issue_context.body_text` is present | Paragraph form, never just `Fixes #N`. |
| 9 | Testing instructions | medium (conditional), large | Automated tests don't exist for the change | Spell out the manual verification path. Give the manual path, not an enumeration of every unit case — "unit-covered; manual checks below" is enough. |
| 10 | Testing limitations | large | — | Disclose what wasn't tested. |
| 11 | What I learned | medium (conditional), large | `solutions` is non-empty | For each `solutions` entry, render as a bullet linking to the file with the entry's `.summary`. |
| 12 | Alternatives considered | large | Diff isn't self-explanatory | Brief notes on rejected approaches. Cap at ~2–3 notes; include only those that pre-empt a likely reviewer flag. Fold a lone note into Impact/Scope rather than giving it its own section. |
| 13 | Deviations (fold) | small | `deviation_trailers` is non-empty (gathered in Step 2f) | No standalone header — this row does not occupy its own position in the ordering sequence below. When genuinely reviewer-relevant, fold the substance of `deviation_trailers` into the **Impact** prose (#2) as one clause, rewritten in plain change terms — no "plan" reference, no `U<n>`. Composition owns the fold; Step 2f's job is unchanged (capture the raw, deduped, U-ID-stripped trailer text). Non-reviewer-relevant trailers are simply not surfaced in the body. At **typo tier** (no Impact section; Risk/Proof suppressed) a deviation surfaces **nowhere** in the reviewer body — the durable `Deviation (U<n>):` commit trailer and the Linear rollup (unchanged, mirrored when `issue_context` is present) are the guarantee. If `deviation_trailers` is empty, nothing folds — Impact reads as normal. Near-match warnings are surfaced by Step 4's preview (see Step 2f), not here. |
| 14 | Screenshots / Demo | medium (conditional), large, perf | `preserved_blocks` contains `demo`/`screenshots` | Splice the `preserved_blocks` `demo`/`screenshots` content byte-identical. For perf tier, render as a before/after table. Wrap screenshot/demo blocks in a `<details>` element with one-line captions — a supplement, not an image wall. |
| 15 | Proof | small | — (always renders; absolutely suppressed at typo tier) | One compact line by `proof.kind`: `automated` → `**Proof:** unit-covered — <test file>`; `visual` → `**Proof:** screenshots below` (pointer to row #14's `<details>`); `na` → `**Proof:** n/a`; `pending` → `**Proof:** _pending — add tests / QA notes / screenshots before merge_`. Placement: after the testing rows (#9/#10), before What-I-learned (#11); a standalone line when those rows are absent. |
| 16 | Risk lead-line | small | — (always renders; absolutely suppressed at typo tier — no carve-out) | `**Risk:** <level> — <reason>` as an un-headed line, the first line of the body, above Impact (#2). No wrapper section header — the line stands alone. |
| 17 | Where to look | medium, large | `focus_areas` is non-empty | A `## Where to look` section with 1–2 bullets naming each area, placed after Impact/Motivation (#2/#3), before Breaking changes (#4). Never repeats an area `risk.reason` already named (dedup basis: 2i). At `medium` with a single trivial area, the content **may** fold into the Impact prose instead of earning its own header; at `large` it always renders as its own section. Omitted entirely when `focus_areas` is empty (no hotspot). |

For each row whose tier threshold is satisfied by `tier` AND whose required input is present in `CompositionInputs`, generate the body per the rule. Rows whose threshold isn't met or whose input is missing emit nothing — no second-pass filter needed. Section ordering follows Lynch's priority (#1 → #16 → #2 → #3 → #17 → #4 → #6 → #7 → #8 → #9 → #10 → #15 → #11 → #12 → #14); preserved blocks splice into canonical positions (Step 3.4). Row #13 (Deviations fold) does not appear in this sequence — it has no standalone position; when active, it rewrites #2's prose in place.

> **Note on `perf` as a tier-modifier**: a perf-typed change can be small *or* large by line count. The table treats `perf` as a flag that activates row #3 and row #14 regardless of size threshold; size-derived threshold rules still apply to other rows. This avoids the "first-match-wins" gotcha where a tiny perf change would otherwise classify as `typo` and drop row #14's before/after table.

#### 3.2a Leave out (the anti-bloat list)

Cross-cutting omissions that apply regardless of which sections activate (Lynch's "Leave out"). These are instances of the selectivity invariant:

- **No what-changed play-by-play.** Do not re-narrate the diff in prose ("renamed X, moved Y, extracted Z, updated the tests"). The diff already shows the mechanism; the body explains what the diff cannot. This is the single biggest source of bloat on small diffs.
- **No file list / change-size enumeration.** Obvious from the diff.
- **One what/why, not two headed sections** at small/medium tier (governed by the per-tier shape targets in 3.1a).
- **Short-term discussion and tooling artifacts stay out** — preview URLs, build links, "I'll address comments below."

#### 3.3 Title rewriting

**U-ID preservation:** `/ba:propose` must not author a commit that strips or masks execute's existing U-tagged subjects in `DIFF_BASE..HEAD`. The U-tagged commit subjects (grammar: `<type>(<scope>): U<n> <description>` — owned by the `## U-ID & Git-Derived State Convention` section in `execute.md`) are the durable state record; rewriting them would break `derive-state` on resume. The plan whose U-IDs are being preserved may be `.md` or `.html` — propose reads only git subjects, never the plan file, so the format is irrelevant. The title rewriting below applies to the **PR/MR title only**, which is U-ID-free by design. Step 5a–5b's commit (the `/ba:propose` summary commit, if authored) uses the composed PR/MR title — it does not carry a `U<n>` token.

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

#### 3.6 Soft size-target warning

The always-on Risk lead-line (#16), the always-on Proof line (#15), and the `## Where to look` section (#17, heading + bullets, **only when rendered as its own standalone section** — see below) are **routing chrome** — they exist to route the reviewer's attention, not to describe the change, so they must never self-trigger a small-tier overshoot warning. Measure the size target against the **narrative content only** (rows #2–#12 and any preserved blocks): compute `body`'s length as generated, then exclude the Risk line, the Proof line, and — only in the standalone-section case — the Where-to-look heading-plus-bullets before comparing to the target below. Review fix: measuring narrative-only up front (rather than measuring the whole rendered body and subtracting chrome after the fact) removes the ambiguity of where each chrome element's text ends. It also resolves row #17's medium-tier fold case cleanly: when Where-to-look folds into Impact prose instead of earning its own header, that folded content is no longer separable chrome — it *is* narrative content at that point, so it is measured as ordinary Impact prose, not excluded.

After that subtraction, compare the remainder against its tier's soft target shape (3.1a):

- small — warn if the body exceeds ~300 characters or introduces `##` headers without two distinct concerns.
- medium — warn if the body exceeds ~one screen or more than two `H2` sections.
- large — warn if the body exceeds ~150 lines (backstop).
- typo / perf — no size warning (typo is one line; perf is shaped by its table).

When a tier overshoots, set `ComposedBody.size_warning` to a short phrase naming the *target shape* for a change this size (never the tier label). Otherwise `size_warning = None`. Do not auto-trim — the user decides. The preview at Step 4 reads `size_warning` by name; composition never side-channels state to the orchestrator.

### Trade-offs documented at lock time

The seam intentionally exposes no tier flag, section list, template selector, or ordering hint to the orchestrator. Section-choice debugging requires reading this spec. If observability becomes a real pain point, add a `ComposedBody.trace` field later. (See brainstorm: `## Locked Design`, *Trade-offs*.)

## Step 4: Preview and confirm

Print the preview block:

```
─────────────────────────────────────────
Action: <commit_push_create | commit_push_edit | edit_only | describe_only>  (Host: <github|gitlab|...>)
Title: <result.title>
       (rewritten from: <result.rewritten_from>)      [only if result.rewritten_from is not None]
Body lines: <N>                                       (size-target prefix if result.size_warning is not None)
Lead: <first two sentences of result.body>
─────────────────────────────────────────
[full result.body printed below]
─────────────────────────────────────────
```

Tier observability is deliberately omitted from the preview — exposing the seam-internal vocabulary would break the "tier never named at call site" invariant from Step 3. If tier debugging becomes a real pain point, add an optional `ComposedBody.trace` field per the brainstorm's *Locked Design > Trade-offs*.

Pre-prefix the block with warnings if any:

- `⚠ Linear MCP unavailable — using diff-derived motivation` (from `mcp_unavailable` orchestrator flag set in Step 2b)
- `⚠ Stack-base: <r.warning>` (printed verbatim when the `r.warning` captured in Step 2a is non-null — e.g. `⚠ Stack-base: target A came from the open-MR host signal; git's commit-count metric picked C (ambiguous)` or `⚠ Stack-base: FOREIGN_UID_IN_WINDOW — <detail>`. Surfacing this is why `/ba:propose` reads `r.confidence`/`r.warning` at all: an `ambiguous`/`low` base resolution must be visible before the MR opens against it. Never blocks — informational, like the size and MCP warnings.)
- `⚠ <result.size_warning>` (printed verbatim when `result.size_warning is not None` — e.g. `⚠ Composed body is longer than typical for a change this size (target: ~one screen) — consider trimming`. The phrase names the target shape only; it never surfaces the tier label or the "Lynch's soft cap" source vocabulary.)

**`describe_only` short-circuit.** When `ACTION=describe_only`, the preview block IS the output — print it and exit zero. Do NOT ask `AskUserQuestion`; a dry-run flag must not require the user to navigate a confirmation menu before delivering its result. (Peer command `/ba:review --local` follows the same rule.)

**Apply-by-default (U2).** For every other `ACTION`, branch on `REVIEW_MODE` (resolved in Arguments, U1, from `--review`/`--interactive` OR `BA_PROPOSE_REVIEW`):

- `REVIEW_MODE` false (default) — the preview block still prints (it is a receipt, not a gate); skip the `AskUserQuestion` below and proceed straight to Step 5.
- `REVIEW_MODE` true — ask via `AskUserQuestion`:

> "Apply?"
>
> 1. **Apply** — proceed to Step 5
> 2. **Edit body** — open the body in `$EDITOR` (fallback `nano`), re-preview after save
> 3. **Regenerate with hint** — prompt for a one-line hint, re-run Step 3 with the hint, re-preview
> 4. **Exit** — abort without changes

Loop until the user picks Apply or Exit.

See the `REVIEW_MODE` definition (Arguments, above) for the full scope of what this flip touches (this menu and Step 0b's edit-only confirm) and what it leaves unaffected.

**Documented residual:** with no gate, a mis-composed title/body ships to a public PR before a human reads it, and `edit_only` overwrites a live PR description with no abort point. Accepted per user decision (fire-and-forget); mitigation is `--describe-only` (dry run) or `--review` for risky work. See Dependencies & Risks in the originating plan.

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

**Single-call invariant (load-bearing).** The `mktemp`, the heredoc write, and `git commit -F` above **must run in the same Bash tool call** — as shown, one block. Each `/ba:propose` Bash call is a fresh shell, so `$COMMIT_MSG_FILE` does not survive into a later call. Never recover the path in a separate call via `find`/`glob`/`ls` over `${TMPDIR:-/tmp}`: that directory is shared across every concurrent session on the machine, so such a match can silently pick up a *different* session's leftover `ba-propose-commit.*` file and commit the wrong message. If the message is needed again, re-derive it (composition is deterministic) and write a **fresh** temp file inside that same call. Same rule applies to 5d's `BODY_FILE`.

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

Otherwise, reuse the cached `OPEN_PR_URL` from Step 0b — the open-PR/MR probe runs once per invocation, not three times:

```bash
# Reuse the cached URL from Step 0b. Empty string means "no open PR/MR" → take the create path; non-empty → take the edit path.
if [[ -n "$OPEN_PR_URL" ]]; then
  # edit existing PR/MR — $OPEN_PR_URL is the canonical handle
  :
else
  # create a new PR/MR
  :
fi
```

If `OPEN_PR_URL` was populated in Step 0b but the PR has since been closed (race window between probe and apply — see *Failure Modes*), the platform's `edit` call will fail with a not-found error; surface the error per the *Post-push PR-create failure* recovery below.

**Fetch-before-write** (when editing — last read wins):

```bash
# Re-fetch body immediately before publish; re-extract preserved blocks from the now-current remote body
CURRENT_BODY=$(gh pr view --json body -q .body)
# (re-run the Step 2d extract on $CURRENT_BODY → fresh preserved_blocks tuple)
```

**Invariant**: Preserved blocks are byte-identical by construction (Step 3.4 inserts the raw markdown as-is). The *last* read of the remote body wins; an explicit hash comparison adds no information. So if the re-extracted preserved blocks differ from what Step 2d captured, the fresh extract is authoritative.

**Splice via re-composition, not manual edit.** To incorporate the fresh preserved blocks without leaking Step 3.4's splice-position rules into the orchestrator, rebuild `CompositionInputs` with the fresh `preserved_blocks` tuple and call `compose_body` a second time. By the determinism invariant (Step 3 contract), `title` and the non-preserved sections of `body` re-derive identically because all other inputs are unchanged; the only change between the preview's composed body and the published body is the (refreshed) preserved-block content at their canonical positions. The orchestrator never names a splice position. Cost: one extra composition pass (no I/O, deterministic) and one extra `gh pr view` round-trip; in exchange the seam stays narrow and "preview ≈ publish" holds modulo the freshest preserved blocks.

Surface a one-line notice in 5d's output when the published body's preserved blocks differ from those shown at preview: `ℹ Preserved blocks updated between preview and publish — published body uses the latest remote read.` This keeps the user informed without recreating the rejected interactive recovery menu.

**Write body to temp file** (always — no stdin, no pipes). GitHub: use `--body-file "$BODY_FILE"`. GitLab: `glab` has no `--description-file`; use `--description "$(cat "$BODY_FILE")"` instead.

**Single-call invariant (load-bearing).** The `mktemp`, the heredoc write, and the one applicable dispatch command below **must run in the same Bash tool call** — that is why the write and the dispatch are one block, not two. Each `/ba:propose` Bash call is a fresh shell, so `$BODY_FILE` does not survive into a later call. **Never** recover the path in a separate call via `find`/`glob`/`ls` over `${TMPDIR:-/tmp}` (e.g. `find "$TMPDIR" -name 'ba-propose-body.*' -newer …`): that directory is shared across every concurrent session on the machine, so such a match can silently pick up a *different* session's leftover file and ship the wrong PR/MR body — a confirmed, repeated production incident. If the body is needed again (the fetch-before-write re-composition above splices fresh preserved blocks), re-run `compose_body` and write a **fresh** temp file inside that same call — do not reach for the earlier path. `${TMPDIR:-/tmp}` is used because no session-scoped temp path is portably exposed to the command; the same-call rule, not the path, is what prevents the cross-session collision.

**Dispatch** — in one Bash tool call: `mktemp` + heredoc write, then run **exactly one** dispatch command matching (`HOST`, create-vs-edit):

```bash
BODY_FILE=$(mktemp "${TMPDIR:-/tmp}/ba-propose-body.XXXXXX")
cat > "$BODY_FILE" <<'__BA_PROPOSE_BODY_END__'
<full PR/MR body — same content as commit message>
__BA_PROPOSE_BODY_END__

# --- then, in THIS SAME call, run exactly one of the following ---

# GitHub — create (target = resolved r.target: the stack parent when stacked, origin default when not)
gh pr create \
  --title "<title>" \
  --body-file "$BODY_FILE" \
  --base "<r.target>"

# GitHub — edit existing
gh pr edit "$OPEN_PR_URL" \
  --title "<title>" \
  --body-file "$BODY_FILE"

# GitLab — create (target = resolved r.target: the stack parent when stacked, origin default when not)
glab mr create \
  --title "<title>" \
  --description "$(cat "$BODY_FILE")" \
  --target-branch "<r.target>"

# GitLab — edit existing
glab mr update "$OPEN_PR_URL" \
  --title "<title>" \
  --description "$(cat "$BODY_FILE")"
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

### 5f. Ship-time capture offer

**Physically last in Step 5** — runs only after 5e has printed `✓ <url>`. Non-blocking,
mode-independent **post-completion chrome**, not a confirmation gate: *not* governed by
`REVIEW_MODE`, fires identically with or without `--review`, and never feeds `CompositionInputs`.
The ship has already succeeded before this block runs.

**Code-shape decision:** the gate/silence/offer control flow is the load-bearing decision of this
change, and re-deriving it from prose alone plausibly produces a *wrong* structure (firing on edit
paths, gating on the word "create", or letting a compound failure taint the ship). The exact
predicate + ordering is fixed by this sketch; the failure-isolation boundary is drawn around the
**whole** 5f body, not just the `/ba:compound` call. It is a shape sketch, not literal command
text — the file is a prose spec — and the paragraphs below elaborate each branch.

```
# 5f. Ship-time capture offer — runs only after 5e printed "✓ <url>".
# The ENTIRE block is failure-isolated: any exception anywhere below degrades to the
# "PR is live" message; nothing here can change the ship's exit status.
if ACTION != commit_push_create or created_pr_url is None:
    return                      # edit_only / commit_push_edit / describe_only / HOST=unknown → unreachable
if not interactive_session():   # default-mode propose may run scripted/headless
    return                      # no answerer for the offer → silent, never hang
try:
    if solutions:               # Step 2c non-empty → already documented & in the PR
        return                  # silent
    if not assess_reusable_learning(deviation_trailers, conversation_arc,
                                    commit_type, risk, proof):
        return                  # routine or uncertain → silent (lean-silent = precision)
    answer = AskUserQuestion("Document this learning?", options=[Yes, No])  # No = one keystroke
    if answer != Yes:
        return                  # decline → normal completion; ship already succeeded
    run("/ba:compound", context_hint=seed(motivation, deviation_trailers, risk, proof, diff_summary))
    # NOTE: compound prints its OWN completion summary AND its own Step 4 menu —
    # a possible second insufficient-context prompt is also compound's, not propose's.
    print("captured — doc is uncommitted and NOT in this PR")
except Exception:
    print("PR is live; capture failed — run /ba:compound manually.")   # ship stays successful
```

**Gate — offer iff 5e printed a `✓ <url>` and the action created a new PR/MR.** Concretely:
`ACTION == commit_push_create` **and** 5d returned a non-empty PR/MR URL. Binding to the URL
(not the word "create") is deliberate — it automatically excludes `HOST=unknown` (no URL) and
every failure exit (no URL). The block is therefore unreachable for `describe_only` (exits at
Step 4), `edit_only`/`commit_push_edit` (edit paths, no new PR), `HOST=unknown`, and any
commit/push/create failure.

**Silence preconditions (any true → stay completely silent, no output at all):**

1. **Non-interactive session** (scripted/headless, no answerer) — *checked first*, before any
   assessment. The offer adds the first `AskUserQuestion` to the default (`--review`-absent)
   flow, which is prompt-free/scriptable today, so a missing interactive answerer is a silence
   precondition, never a hang.
2. **Already captured** — `solutions` (Step 2c) is non-empty. The learning is already documented
   and rode this very PR; a high-precision negative that costs nothing.
3. **Negative or uncertain judgment** — the assessment did not land clearly positive. Lean
   **silent**: precision over recall.

**Assessment (best-effort, blended, read-only).** Not a rigid rubric. Read already-materialized
orchestrator state plus the conversation; mutate nothing. Weigh:

- (a) `deviation_trailers` from Step 2f — *strongest* signal ("reality diverged from the plan,
  here's why").
- (b) A problem → investigation → fix arc visible in the conversation.
- (c) Commit type / motivation — a `fix:` for a gotcha/workaround weighs positive; a clean `feat:`
  or a docs/config-only change weighs toward routine.
- (d) Lightly: `risk` (2h), `proof` (2e), `sensitive_paths_touched` (2g).

Lean-silent: a genuinely ambiguous change (e.g. a `fix:` with no deviation trailer and no clear
problem→fix arc) is judged **uncertain** and stays silent.

**Offer (only on a positive judgment).** One 2-option `AskUserQuestion` — "Document this
learning?" — Yes / No, with **No** as the recommended-neutral default (one keystroke to decline).

- **Decline** → proceed to normal completion. Nothing remains to print; success already printed.
- **Accept** → invoke `/ba:compound` on its explicit (proceed-directly) path, passing a **seeded
  context hint** — composed motivation + deviation-trailer texts + `risk`/`proof` + a one-line
  diff summary — so compound's Step 0 insufficient-context guard passes even in a resumed/handoff
  session whose conversation arc is absent. `/ba:compound` then surfaces its **own** completion
  summary and its **own** Step 4 menu (Continue / View / Other), and — if the seeded hint is judged
  thin — may still hit compound's retained Step 0 guard (a possible second round-trip). These are
  compound's prompts, not propose's.

**Post-hoc summary on accept.** After compound returns, surface its completion summary and
**explicitly note the created doc is uncommitted and NOT in this PR** — it was written after the
push, so commit it separately or it rides your next `/ba:propose` (whose Step 5a would stage it).

**Failure isolation (the whole 5f body).** The ship is already reported successful; nothing in 5f
may change its exit status. Any exception *anywhere* in this block — in the assessment, in the
`AskUserQuestion` itself, or in the `/ba:compound` invocation — degrades identically to a single
note and leaves the ship successful: "PR is live; capture failed — run `/ba:compound` manually."
Manual `/ba:compound` is the false-negative escape hatch for every silent path (a correct silence
is indistinguishable from a missed positive, and the silent path has no trace — accepted).

## Failure Modes

| Failure | Where it surfaces | Recovery |
|---|---|---|
| Invalid branch state (detached HEAD, default branch with or without work) | Step 1 | Interactive routing per Step 1's four-way decision table — offer create-branch or refuse. |
| `HOST=unknown` | Step 0a | Skip 5d; commit + push only; print body for manual paste. |
| Empty diff (base moved) | Step 2a | `CompositionInputError` with rebase-or-close message. |
| Linear MCP failure with ID present | Step 2b | Warn at preview; fall back to diff-derived motivation. |
| Preserved-block race window | Step 5d | Re-fetch + re-extract immediately before publish; published body uses the freshest remote read. No interactive recovery needed. |
| Body overshoots its tier's soft target (3.1a) | Step 4 | Warn at preview with a phrase naming the target shape; user decides. No auto-trim. |
| Hook failure on commit | Step 5b | Surface output, exit, never `--no-verify`. |
| Non-fast-forward push | Step 5c | Offer `--force-with-lease` or abort. |
| PR-create after-push fails | Step 5d | Surface error; instruct user to re-run `/ba:propose` (commits already pushed, so 5a-5c are no-ops, 5d retries the create). |
| PR closed between Step 0b probe and Step 5d apply | Step 5d | The `gh pr edit` / `glab mr update` call against the cached `OPEN_PR_URL` will fail with a not-found error. Surface the platform error verbatim; instruct the user to re-run `/ba:propose` (the next probe will see no open PR and take the create path). |

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
- Match weight to weight — shorter wins; a bigger diff earns more selectivity, not more content. No what-changed play-by-play, no unit-test enumeration, screenshots in `<details>`. Required safety sections (breaking changes, dep justifications) are exempt from trimming.
- Title = effect, not mechanism. Rewrite if drafted as mechanism, disclose the rewrite in preview.
- `fix:` over `feat:` when ambiguous.
