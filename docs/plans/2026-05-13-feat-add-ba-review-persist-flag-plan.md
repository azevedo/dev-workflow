---
title: Add --persist flag to /ba:review for run-artifact persistence
type: feat
status: active
date: 2026-05-13
origin: https://github.com/azevedo/dev-workflow/issues/4
detail_level: standard
iteration_count: 2
tags: [ba-review, persistence, run-artifacts, gitignore, protected-artifacts, ce-code-review-port]
---

# Add `--persist` flag to `/ba:review` for run-artifact persistence

## Overview

`/ba:review` is the lone `/ba:*` command without a paper trail — reviewer findings disappear when the conversation ends. This plan adds an **opt-in** `--persist` flag that writes per-reviewer outputs plus a run summary to a dated directory under `docs/reviews/`. The plugin does **not** modify any consuming repo's `.gitignore`; keeping persisted runs out of version control is the user's responsibility (e.g. `.git/info/exclude`, a global gitignore, or the repo's own `.gitignore`). The dev-workflow repo itself ships a committed `.gitignore` covering `docs/reviews/` only because it dogfoods this command. Default behavior (no flag) is unchanged. Source pattern: ce-code-review's Stage 5 run-artifact directories (see `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md:220-225,352-356`); deliberately diverges from ce by being **opt-in in interactive mode** rather than always-on in non-interactive mode (C1 candidate, deferred).

## Current State

- `/ba:review` runs reviewers in parallel and consolidates findings to chat only — no file writes. Reviewer agents return text; the orchestrator never persists anything (`commands/ba/review.md:1-475`, `agents/review/*.md` output sections).
- Argument parsing at `commands/ba/review.md:13` reads `<review_scope>` whole and classifies via a pattern table (`:23-33`). Only scope-replacing tokens (`--staged`, `--local`) are recognized; there is no flag-strip step.
- Flag-strip precedent: `/ba:execute --slice N` strips the flag pair from `#$ARGUMENTS` before path parsing (`commands/ba/execute.md:15-22`). This is the model `--persist` follows.
- Two-phase write pattern: subagents return text only; orchestrator writes the file (`commands/ba/compound.md:43-47` and `:127-128`). Reviewer agents already follow Phase 1 of this contract.
- mkdir-then-Write idiom appears in four commands (`brainstorm.md:84`, `plan.md:480`, `research.md:105`, `compound.md:127-128`). All use flat directories; `docs/reviews/<run-id>/` would be the first **nested** run-scoped artifact directory.
- Protected-artifacts guard (just landed) lists four paths verbatim at three sites: `commands/ba/review.md:287` (agent-based template), `:305` (skill-based), `:329` (user-typed). A2 adds `docs/reviews/` to all three.
- No `.gitignore` exists at the dev-workflow repo root — confirmed via `ls -la`. The plan creates one **in dev-workflow only** (committed, static, one line) because dev-workflow dogfoods `/ba:review --persist` on itself. The command does **not** read, create, or append to `.gitignore` at runtime in any consuming repo.
- `.claude-plugin/plugin.json:3` is at `"version": "0.14.0"` (A1 bumped it from 0.13.0). A2 is a `feat`, so bump to `0.15.0`.
- `CLAUDE.md:51-58` (Artifact Paths) and `:60-73` (Conventions) need additions. `README.md:141-159` (`/ba:review` section) and `:205-213` (Artifact Paths) mirror these.
- Scope-type labels resolved by Step 1d (`:168-171`): `mr`, `branch`, `staged`, `recent`. Plus `local-range` from 1a classification. These five labels drive the `<scope-ref>` segment of the persist directory name.

## What We're NOT Doing

- **Non-interactive mode integration.** Deferred to C1 (separate candidate). `--persist` is an interactive opt-in; the persist write code path is *structurally ready* to be called from a future non-interactive entry point, but no C1-specific surface is added here. — Reason: issue #4 explicit "Out" list.
- **`/ba:compound`-reads-reviews consumer.** Future enhancement once we have persisted runs to mine. — Reason: issue #4 explicit "Out" list.
- **Retention or pruning policy.** Manual deletion is fine at the dated-prefix granularity (sortable, easy to `rm -rf`). — Reason: issue #4 explicit "Out" list; YAGNI before a single user has complained.
- **Extending persistence to other `/ba:*` commands.** `/ba:research` already persists; `/ba:review-plan` is out of scope until A2 has been used. — Reason: issue #4 explicit "Out" list.
- **Persisting the captured diff (`diff.patch`).** Useful for reproducibility but expands directory size and not requested. — Reason: defer; surface as a follow-up if observed need emerges.
- **Persisting reviewer prompt strings.** Useful for debugging but bloats the run dir. — Reason: defer; spec-flow analyzer flagged as nice-to-have.
- **Machine-readable `findings.json`.** Markdown-only for now; a future `/ba:compound`-reads-reviews consumer can parse markdown or motivate a structured format then. — Reason: defer.
- **Unknown-flag fail-fast check.** Existing behavior (unknown tokens fall through to scope classification and produce a `git diff` error) is preserved. Adding `--persist` handling does not justify auditing every other token shape. — Reason: scope discipline; out of scope for A2.
- **Cross-linking consecutive persist runs on the same scope.** Each run is an independent snapshot. — Reason: defer.
- **`--persist=path` override.** Users who want custom paths can `mv` the resulting directory. — Reason: defer; one path is enough.
- **Refactoring Step 4 consolidation into a structured intermediate.** Step 4.5 reads the same consolidated text Step 4 displays. Factoring out a structured form is a C1 prerequisite, not an A2 one. — Reason: keep the change additive and contained.
- **Runtime `.gitignore` management in consuming repos.** `--persist` writes the run directory only; it never reads, creates, or appends to the `.gitignore` of whatever repo it runs in. Keeping `docs/reviews/` untracked is the user's responsibility (`.git/info/exclude`, a global gitignore, or the repo's own `.gitignore`). — Reason: removes the plugin's single user-data-loss-risky write; the cleanliness it bought is a property users already control by other means. Dev-workflow's own committed `.gitignore` (an edit in the set below) is unaffected — it is a static committed file for dogfooding, not a runtime write.

## Behaviors to Test

- [ ] Running `/ba:review` without `--persist` produces no `docs/reviews/` directory — the default flow is untouched.
- [ ] Running `/ba:review --persist` after the run completes leaves a directory named `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` containing one `.md` per dispatched reviewer plus a `summary.md`.
- [ ] `--persist` appears interchangeably **before** the scope (`/ba:review --persist !123`), **after** the scope (`/ba:review !123 --persist`), or **alone** (`/ba:review --persist` → local-auto).
- [ ] `--persist` combined with `--staged` (`/ba:review --persist --staged`) and `--local` (`/ba:review --persist --local`) behaves identically to the flag-alone forms with the corresponding scope.
- [ ] When scope resolves to `NO_CHANGES` (Step 1c early exit), `--persist` creates no directory. The early exit short-circuits Step 4.5.
- [ ] When a reviewer subagent fails, its per-reviewer file is still written with `status: failed` in the frontmatter plus a one-line failure reason in the body. When a reviewer succeeds but returns no findings, the file is written with `status: succeeded` and the body `_Reviewer returned no findings._`. The directory is self-documenting either way.
- [ ] When two reviewers flag the same `file:line` with different advice, the `⚠ Conflicting` annotation appears in **both** per-reviewer files (with a cross-reference to the other reviewer by name) **and** in `summary.md`.
- [ ] Running `--persist` in a consuming repo that has an existing `.gitignore` leaves that `.gitignore` byte-for-byte unchanged — the plugin never writes it. (In the dev-workflow repo, `docs/reviews/` is already covered by the committed `.gitignore` from the edit set.)
- [ ] Branch names containing slashes (`feat/add-auth`), colons, tildes, or spaces are sanitized via `s/[^A-Za-z0-9._-]/_/g`, collapsed-runs, trimmed: `feat/add-auth` → `feat_add-auth`, `feat:thing` → `feat_thing`, `feat with space` → `feat_with_space`.
- [ ] Detached HEAD on `branch` scope falls through to the `unknown` fallback (same as the empty-string case); the HEAD SHA is still recorded in `summary.md`'s `head_sha` frontmatter field.
- [ ] `local-range` scope sanitizes `..` to `__` and slashes the same way: `origin/main..HEAD` → `origin_main__HEAD`.
- [ ] `recent` scope uses the literal directory ref `recent` (matching how `staged` works); the underlying short SHA range is recorded in `summary.md`'s scope section, not the directory name.
- [ ] `mr` scope produces `mr-<N>` (e.g., `mr-123`), not the branch name. MR number is the canonical identifier.
- [ ] Two persist runs on the same scope within the same wall-clock second produce distinct directories — the second appends `-2` to the full directory name (`...-mr-123-2`), per the `compound.md:60` precedent.
- [ ] No reviewer dispatched from `/ba:review` ever suggests deleting, relocating, gitignoring, renaming, archiving, consolidating, or otherwise changing the existence of a file under `docs/reviews/` (the path joins the protected-artifacts guard at all three dispatch sites).
- [ ] The summary file carries minimal YAML frontmatter (`scope`, `timestamp`, `head_sha`, `reviewers`) and the per-reviewer files carry frontmatter (`reviewer`, `source`, `status`).

## Proposed Solution

Five edits, sequenced so each is independently reviewable:

1. **`commands/ba/review.md`** — add a `Parse Arguments` subsection before Step 1a, append `docs/reviews/` to the three protected-artifacts guard strings, add a new Step 4.5 that conditionally writes the run directory, and mention the persist path in Step 1d's announcement and Step 5's completion message.
2. **`CLAUDE.md`** — extend the protected-artifacts guard line and add a row to the Artifact Paths table.
3. **`README.md`** — mirror the CLAUDE.md changes in the `/ba:review` section and the Artifact Paths table, stating that ignoring `docs/reviews/` is user-managed.
4. **`.gitignore`** — create **in the dev-workflow repo only** (committed, static, one `docs/reviews/` line) for dogfooding. Not a runtime write; `--persist` never touches `.gitignore` in consuming repos.
5. **`.claude-plugin/plugin.json`** — bump `0.14.0` → `0.15.0`.

The persist write reuses the existing two-phase pattern: reviewers continue returning text only; the orchestrator collects all per-reviewer outputs, builds the consolidated summary in memory (Step 4), then writes everything in Step 4.5.

## Technical Considerations

- **Argument parsing.** Strip `--persist` from `#$ARGUMENTS` *before* Step 1a's classification table runs. This mirrors `/ba:execute --slice N` (`commands/ba/execute.md:15-22`) where strip-then-classify is the pattern. `--persist` is a bare flag (no argument follows) — simpler than `--slice N`. Idempotency: multiple `--persist` tokens collapse to one set flag.
- **TIMESTAMP capture timing.** `TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)` is captured **once** inside the Parse Arguments block when `PERSIST=true`, *not* later in Step 4.5a. This ensures the same value is used in Step 1d's announcement and Step 4.5's directory write — otherwise the wall-clock can advance by minutes while reviewers run, producing announcement-vs-write skew. Locked here so the executor doesn't capture it in two places.
- **Scope-ref derivation.** A single function-like block in the plan body produces the `<scope-ref>` segment per scope type. Deterministic so a script or user can predict the path:
  - `mr` → `mr-<N>` (N is the MR/PR number extracted in Step 1b, Step 2 — the same value passed to `gh pr view <N>` / `glab mr view <N>`)
  - `branch` → `sanitize(current_branch)`; on detached HEAD → falls through to `unknown` (HEAD SHA is still preserved in `summary.md`'s `head_sha` field)
  - `local-range` → `sanitize(range)` (slashes and `..` replaced)
  - `staged` → literal `staged`
  - `recent` → literal `recent` (the underlying SHA range is recorded in `summary.md`, not the directory name)
- **Sanitization regex.** Single transform: replace any character outside `[A-Za-z0-9._-]` with `_`; collapse runs of `_`; trim leading/trailing `_`; if the result is empty, fall back to `unknown`. Locked here so future readers and locator agents can predict directory names without running the command. Note: leading dots (`.bugfix`) and leading digits (`123-fix`) pass through unchanged — the regex is intentionally permissive for both.
- **Timestamp.** Local time via `date +%Y-%m-%d-%H%M%S` — matches user expectation ("this morning's review"). Documented in the command so users aren't surprised by missing-UTC.
- **No runtime `.gitignore` write.** `--persist` deliberately does not manage `.gitignore` in consuming repos. The only `.gitignore` in scope is dev-workflow's own committed dogfooding file (in the edit set). This removes the plugin's single user-data-loss-risky write; users keep `docs/reviews/` untracked by whatever mechanism they already use.
- **Reviewer failure handling.** Every selected reviewer produces a file in the persist directory, even on failure. File frontmatter carries `status: succeeded | failed`. A succeeded reviewer with no findings writes the body `_Reviewer returned no findings._` — the empty-body case speaks for itself; no separate `empty` state needed. This keeps the directory self-documenting.
- **Conflict annotations.** The `⚠ Conflicting` marker (Step 4) is duplicated into both per-reviewer files (with `(see also: <other-reviewer>.md)` cross-reference) and the summary. Each file must be readable on its own.
- **Protected-artifacts guard.** Add `docs/reviews/` to the existing four-path guard list (brainstorms, plans, solutions, research) at `commands/ba/review.md:287,305,329`. The guard is forward-looking — `docs/reviews/` is typically untracked, so its files won't appear in a normal diff — but adding `docs/reviews/` preserves symmetry and protects the edge case where a user chooses to track their reviews and they appear in a future diff.
- **Nested directory discoverability.** `docs/reviews/<run-dir>/` is the first run-scoped (per-invocation nested) artifact directory in the plugin. Existing four artifact paths are flat (`docs/brainstorms/*.md`) or one-level categorized (`docs/solutions/<category>/*.md`). Any future locator agent over reviews (e.g., a `reviews-locator` for `/ba:compound` consumption) must Glob `docs/reviews/**/*.md`, not `docs/reviews/*.md`. Called out here so the convention is locked.

## System-Wide Impact

- **Interaction graph.** Step 1a's classifier is the new fan-in point. Today: argument → scope. After: argument → flag-strip → scope, with a `PERSIST` boolean threaded through Steps 1d (announcement), 3 (no change — reviewers don't see the flag), 4 (no change — consolidation is in-memory), 4.5 (gated write), and 5 (mention path). No new subagents dispatched. No new external commands invoked.
- **Error propagation.** Failures in Step 4.5 (mkdir, Write) must not silently swallow the consolidated findings — the user has already seen Step 4's chat output, so a persist failure should produce a clear warning ("Persist failed: <reason>. Findings above were displayed in chat only.") and continue to Step 5. The captured findings are not lost.
- **State lifecycle risks.** The persist directory write is the only side effect introduced. If `mkdir` succeeds but per-reviewer Write fails midway, the directory will contain a partial set of files. Recovery: re-running `--persist` creates a new (timestamped) directory — partial dirs are inert, not corrupting. No cleanup attempted.
- **No user-data-loss surface.** With runtime `.gitignore` management removed, every write `--persist` performs targets a freshly-created, uniquely-timestamped directory under `docs/reviews/`. The plugin never modifies a pre-existing user file in any consuming repo. The spec-flow analyzer's earlier highest-risk-path flag (a careless `.gitignore` overwrite) no longer applies — the path is gone, not mitigated.

## Implementation Approach

### Changes Required

**File**: `commands/ba/review.md`

**Edit 1 — Add `### Parse Arguments` subsection between line 13 (`<review_scope>` block) and line 15 (the `---` separator).** The new subsection sits before the separator and before Step 1a, matching `execute.md`'s placement of `### Parse Arguments` immediately after its `<plan_path>` block. The `---` separator at line 15 stays where it is; the new subsection is inserted *above* it.

```markdown
### Parse Arguments

Check the argument string for recognized flags before classifying scope:

- **`--persist`**: Scan `<review_scope>` for the token `--persist`. If found, set `PERSIST=true` and strip the token from the argument string. Multiple occurrences collapse to a single set flag (idempotent). When `PERSIST=true`, immediately capture the timestamp that will name the persist directory:

  ```bash
  TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)   # local time; single capture, reused at Step 1d and Step 4.5
  ```

  Capture it **here, once** — not later in Step 4.5a — so the value announced in Step 1d matches what Step 4.5 writes. Reviewers can take minutes; deferring the capture would let wall-clock advance and produce announcement-vs-write skew.

- **Everything else** after stripping `--persist`: treat as the scope argument and proceed to Step 1a classification. The remaining string may still contain `--staged` or `--local` (scope tokens) or be empty (local-auto).

**Note:** Unknown flags (e.g., `--persists`, `-persist`) are not recognized — they fall through to scope classification and will produce a downstream error (`git diff` reporting an unknown revision). This matches existing behavior; explicit unknown-flag validation is out of scope for this change.
```

**Edit 2 — Update Step 1a's introductory paragraph (line 21) to reference the new flag-strip step:**

Replace:
```markdown
Parse `<review_scope>` to determine the scope type. **Match the FIRST row that fits — then skip directly to the indicated step.**
```

With:
```markdown
Parse the post-flag-strip `<review_scope>` (see **Parse Arguments** above) to determine the scope type. **Match the FIRST row that fits — then skip directly to the indicated step.**
```

**Edit 3 — Step 1c `NO_CHANGES` early exit (around line 147) — add a one-sentence clarification:**

After the existing `echo "NO_CHANGES"` / `exit 0` block, append a comment line into the surrounding prose:

```markdown
If auto-detect found nothing (`NO_CHANGES`), tell the user: "No changes detected to review. Pass an MR URL or a git ref range, e.g., `/ba:review !123` or `/ba:review abc123..def456`" and exit. **When `PERSIST=true`, the `NO_CHANGES` exit takes precedence — no persist directory is created.**
```

**Edit 4 — Step 1d's scope announcement (lines 168–171) — append the persist destination on a second line when `PERSIST=true`:**

After the four scope-specific announcement lines, append:

```markdown
**When `PERSIST=true`**, also announce on a second line the fully-resolved persist target — substitute `${TIMESTAMP}` (captured in Parse Arguments) and the `SCOPE_REF` derived from `SCOPE_TYPE` (see Step 4.5a's table). Example: `Persist target: docs/reviews/2026-05-13-143022-feat_add-auth/`. Show this *before* Step 2's reviewer selection so the user can `^C` if the target path looks wrong.
```

**Edit 5 — Step 3 protected-artifacts guard (all three dispatch templates) — append `docs/reviews/` to the path list at `commands/ba/review.md:287`, `:305`, `:329`:**

Replace the substring `` `docs/research/`. `` in each of the three guard paragraphs with:

```
`docs/research/`, or `docs/reviews/`.
```

The full updated guard sentence (identical in all three templates) reads:

> **Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You may still review and flag content-quality issues inside these files (vague acceptance criteria, missing edge cases, broken references), and you may review changes to these files when they appear in the diff — the guard protects the file's existence and location, not its contents.

**Edit 6 — Insert new `## Step 4.5: Persist Run Artifacts (if --persist)` between Step 4 and Step 5 (after line 383):**

````markdown
---

## Step 4.5: Persist Run Artifacts (if `--persist`)

> **Skipped entirely when `PERSIST=false`.** This step has no effect on the default flow.

When `PERSIST=true`, write the run's per-reviewer outputs and a consolidated summary to a dated directory under `docs/reviews/`. The command does **not** touch `.gitignore` in the consuming repo — ignoring `docs/reviews/` is the user's responsibility (see the "Runtime `.gitignore` management" entry in **What We're NOT Doing**).

### 4.5a. Derive the run directory name

`TIMESTAMP` was captured in Parse Arguments (see Edit 1). Compute `SCOPE_REF` from `SCOPE_TYPE` (resolved by Step 1c, or set implicitly by Step 1b for `mr`):

| `SCOPE_TYPE` | `SCOPE_REF` formula | Example |
|---|---|---|
| `mr` | `mr-<N>` where N is the same MR/PR number Step 1b's Step 2 extracted and passed to `gh pr view <N>` / `glab mr view <N>` | `mr-123` |
| `branch` | `sanitize(current_branch)`; on detached HEAD, falls through to `unknown` via the sanitize empty-string rule (HEAD SHA is still preserved in `summary.md`'s `head_sha` field) | `feat_add-auth`, `unknown` |
| `staged` | literal `staged` | `staged` |
| `recent` | literal `recent` (the underlying SHA range is recorded in `summary.md`'s scope section, not the directory name) | `recent` |
| `local-range` | `sanitize(range)` — `..` becomes `__`, slashes become `_` | `origin_main__HEAD`, `abc123__def456` |

**`sanitize(s)`**: replace every character outside `[A-Za-z0-9._-]` with `_`; collapse runs of `_` into one; trim leading and trailing `_`; if empty, fall back to `unknown`. Leading dots (`.bugfix` → `.bugfix`) and leading digits (`123-fix` → `123-fix`) pass through unchanged — the regex is intentionally permissive for both.

The full directory path is:

```
docs/reviews/${TIMESTAMP}-${SCOPE_REF}/
```

**Collision handling.** Before creating the directory, check whether it already exists. If yes, append `-2`, then `-3`, etc., to the full directory name until an unused name is found (`docs/reviews/${TIMESTAMP}-${SCOPE_REF}-2/`). One-second timestamp resolution makes this collision rare; the suffix is belt-and-braces. Pattern matches `commands/ba/compound.md:60`.

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

The summary captures what a future reader needs to reconstruct the review without scrolling chat history. Four sections — anything beyond this duplicates the directory or the per-reviewer files:

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

The Status column doubles as the coverage report — failed reviewers are already visible here, and skipped-binary files are noted in the diff stat above.

## Consolidated Findings

[The full Step 4 output verbatim — every reviewer's Must Address / Consider / Looks Good blocks, with conflict annotations.]
```

### 4.5e. Announce the persist target

After all writes complete:

> "Persisted review to `docs/reviews/${TIMESTAMP}-${SCOPE_REF}/` (`<N>` reviewer files + `summary.md`)."

If any write failed (`mkdir`, per-reviewer `Write`, or summary `Write`), warn:

> "⚠ Persist failed: `<reason>`. Findings above were displayed in chat only and are not on disk."

Continue to Step 5 regardless. The chat output is the source of truth on failure — the persist directory is supplementary.
````

**Edit 7 — Step 5's "Done" branch (local and MR scopes) — mention the persist path in the completion summary:**

Find the existing "Done" outcomes in Step 5 (local scope's `Done` option around line 410+ and MR scope's `Done` option later). In each completion summary, when `PERSIST=true` was set, append:

```markdown
Persisted to `docs/reviews/<TIMESTAMP>-<scope-ref>/`.
```

---

**File**: `CLAUDE.md`

**Edit 1 — Extend the existing protected-artifacts guard line at `CLAUDE.md:72` to add `docs/reviews/`:**

Replace:
```markdown
- `/ba:review` dispatches reviewer subagents with a protected-artifacts guard naming `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, and `docs/research/` — reviewers must not suggest deleting, relocating, or otherwise removing files under these roots (content review is unaffected)
```

With:
```markdown
- `/ba:review` dispatches reviewer subagents with a protected-artifacts guard naming `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, and `docs/reviews/` — reviewers must not suggest deleting, relocating, or otherwise removing files under these roots (content review is unaffected)
```

This makes `:72` the single authoritative guard list — no duplication in the new persist bullet below.

**Edit 2 — Append a row to the Artifact Paths table (after line 58):**

```markdown
| Review run artifacts | `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` |
```

The "opt-in / user-managed-ignore" facts live in the README description, not in the CLAUDE.md table — the existing four rows are clean noun-phrase → path and the new row matches. No new Convention bullet is added: there is no longer a runtime `.gitignore` safety invariant to operationalize (runtime gitignore management was removed from scope), and the only `.gitignore` artifact is dev-workflow's own committed dogfooding file.

---

**File**: `README.md`

**Edit 1 — Update `/ba:review` description bullets (around `README.md:154-159`):**

Append a new bullet to the existing bullet list:

```markdown
- **Optional persistence** — pass `--persist` to write per-reviewer outputs and a `summary.md` to a dated `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` directory. The command does **not** modify your repo's `.gitignore`; if you want persisted runs kept out of version control, ignore `docs/reviews/` yourself (e.g. via `.git/info/exclude`, a global gitignore, or your repo's own `.gitignore`). Default behavior (no flag) is unchanged
```

**Edit 2 — Append a row to the Artifact Paths table (after `README.md:212`):**

```markdown
| Review run artifacts (opt-in via `--persist`; not auto-ignored — user-managed) | `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` |
```

(The README table — unlike CLAUDE.md's — keeps the parenthetical annotation, since README is feature-marketing tone and rows there already vary in shape. CLAUDE.md's Edit 2 is annotation-free for table-purity reasons; README is more permissive. The two tables already drift in row order, which is pre-existing and not in scope to fix here.)

**Edit 3 — Update the argument hint in the `/ba:review` heading shown in README** (no change needed — README does not currently show argument hints inline; the heading at line 141 is bare).

---

**File**: `.gitignore` (new file at the **dev-workflow repo root only** — committed, static, dogfooding)

```
docs/reviews/
```

(Single line, trailing newline. This is a one-time committed file in the dev-workflow repo because dev-workflow runs `/ba:review --persist` on itself, and its `docs/` tree is otherwise version-controlled. It is **not** generated at runtime; `--persist` never reads, creates, or appends to `.gitignore` in any consuming repo — see the "Runtime `.gitignore` management" entry in **What We're NOT Doing** and the Technical Considerations note.)

---

**File**: `.claude-plugin/plugin.json`

```json
{
  "name": "dev-workflow",
  "version": "0.15.0",
  ...
}
```

(Only the `version` field changes; everything else is preserved.)

### Success Criteria

#### Automated:

- [ ] `grep -c 'docs/reviews/' commands/ba/review.md` returns at least **4** — three updated guard sites plus at least one mention in the new Step 4.5 (likely far more).
- [ ] `grep -c '\-\-persist' commands/ba/review.md` returns at least **5** — Parse Arguments subsection, Step 1d announcement, Step 4.5 header, Step 4.5 conditional, and Step 5 mention.
- [ ] `grep 'docs/reviews/' .gitignore` returns exactly one match (`docs/reviews/`).
- [ ] `cat .claude-plugin/plugin.json | grep '"version"'` shows `"version": "0.15.0"`.
- [ ] `grep 'docs/reviews/' CLAUDE.md` returns matches in the extended `:72` guard line and the new Artifact Paths row (at least 2 hits).
- [ ] `grep 'docs/reviews/' README.md` returns matches in both the `/ba:review` section and the Artifact Paths table (at least 2 hits).
- [ ] All three guard paragraphs in `commands/ba/review.md` contain the substring ``docs/reviews/`.`` or `` `docs/reviews/`.`` — a `grep -c` for the closing-backtick form returns 3.
- [ ] No edits to any file under `agents/review/` (per the A1 precedent that scopes guard-list changes to the dispatcher).

#### Manual:

- [ ] Smoke test: run `/ba:review --persist` against a small local diff (e.g., a one-line README edit). Verify `docs/reviews/<dir>/` is created and contains the expected files. (`--persist` does not touch `.gitignore`; in the dev-workflow repo `docs/reviews/` is already covered by the committed `.gitignore` from the edit set.)
- [ ] Smoke test: run `/ba:review --persist` against an MR (e.g., `/ba:review --persist !123` if available). Verify `mr-123` appears in the directory name and the summary references the MR title.
- [ ] Smoke test: run `/ba:review --persist --staged` with nothing staged. Verify the `NO_CHANGES` exit fires and no directory is created.
- [ ] Smoke test: run `/ba:review --persist` twice in quick succession on the same branch. Verify the second run gets a `-2` suffix (or, if the second run happens in a different second, two distinct timestamps).
- [ ] Smoke test: on a branch named `feat/add-things`, verify the directory name contains `feat_add-things`.
- [ ] Smoke test: run `/ba:review --persist` on a branch where a reviewer fails (force a failure by selecting a deliberately broken external reviewer, if available). Verify a per-reviewer file with `status: failed` is still written.
- [ ] Smoke test: in a consuming repo with an existing `.gitignore`, run `/ba:review --persist` and confirm `.gitignore` is byte-for-byte unchanged — the plugin never writes it.
- [ ] Smoke test: dispatch reviewers via `/ba:review --persist` on a diff touching `docs/reviews/` (manually un-gitignore for the test) and confirm no reviewer suggests deleting/relocating those files — the protected-artifacts guard covers the new path.

## Dependencies & Risks

**Dependencies:**

- **A1 (protected-artifacts guard, issue #3 — landed).** A2 adds `docs/reviews/` to the path list at three sites. No version skew risk; A1 shipped at `0.14.0`, A2 ships at `0.15.0`.
- **No dependency on C1** (non-interactive modes — deferred).
- **No dependency on B6** (dedup) or any other candidate.

**Risks:**

- **Untracked `docs/reviews/` in consuming repos (accepted trade-off).** Because the plugin no longer writes `.gitignore`, persisted runs show as untracked in `git status` until the user ignores them by their preferred mechanism. This is the deliberate cost of removing the plugin's only user-data-loss-risky write. Risk of accidental commit is the user's to manage — consistent with `--persist` being an explicit opt-in — and is a property users already control globally (`.git/info/exclude`, global gitignore).
- **Branch-name sanitization producing collisions.** Two distinct branches sanitizing to the same `SCOPE_REF` (e.g., `feat/foo` and `feat_foo` both sanitize to `feat_foo`) could overwrite each other if reviewed in the same second. Mitigated by HHMMSS resolution + the `-2`/`-3` suffix fallback. Extremely rare in practice.
- **`docs/reviews/` becoming large.** No retention policy means users accumulate review dirs indefinitely. Mitigated in dev-workflow by the committed `.gitignore` (no repo bloat); in consuming repos the directory is untracked noise at worst (never committed unless the user opts in) and users can `rm -rf docs/reviews/<old-prefix>*`. Out of scope for A2.
- **Partial-write directories.** A persist failure mid-write leaves a partial directory. Mitigated by the new-timestamped-dir-per-run model — partial dirs are inert and don't corrupt anything. Cleanup is user-driven.
- **Spec-flow analyzer noted concern about consolidation factoring for future C1 readiness.** Confirmed deliberately out of scope here — Step 4.5 reads the same in-memory consolidated text that Step 4 displays. C1 will need to factor this out when it lands; the work is contained.

## Sources & References

- **Origin issue:** https://github.com/azevedo/dev-workflow/issues/4 (Candidate A2 — Run-artifact persist flag, accepted, implementation-ready)
- **A1 (dependency, landed):** `docs/plans/2026-05-13-feat-add-protected-artifacts-guard-plan.md`, issue #3
- **Source pattern:** ce-code-review Stage 5 run-artifact directories — see `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md:220-225,346-356`. A2 deliberately diverges by being interactive-opt-in and repo-local, not `/tmp` and not always-on; and unlike ce, A2 does not manage `.gitignore` — ignoring persisted runs is left to the user.
- **Flag-parsing precedent:** `commands/ba/execute.md:15-22` (`--slice N` strip-then-classify)
- **Two-phase write precedent:** `commands/ba/compound.md:43-47` (subagents return text), `:127-128` (orchestrator writes)
- **mkdir-then-Write idiom:** `commands/ba/brainstorm.md:84`, `commands/ba/plan.md:480`, `commands/ba/research.md:105`, `commands/ba/compound.md:127-128`
- **Collision-suffix precedent:** `commands/ba/compound.md:60`
- **Scope-type labels (canonical):** `commands/ba/review.md:133-148` (`branch`, `staged`, `recent`), `:25-33` (`mr`, `local-range`)
- **Protected-artifacts guard sites:** `commands/ba/review.md:287,305,329`
- **Canonical Artifact Paths source:** `CLAUDE.md:51-58`

## Convention Compliance

- [x] **Title prefix `feat:`** — matches CLAUDE.md convention for new functionality.
- [x] **Filename format** — `2026-05-13-feat-add-ba-review-persist-flag-plan.md` matches `YYYY-MM-DD-<type>-<name>-plan.md`.
- [x] **YAML frontmatter present** — all required fields populated.
- [x] **Version bump included** — `0.14.0` → `0.15.0` per `CLAUDE.md:65`; minor bump (semver) aligned with `type: feat`, matching the A1 precedent.
- [x] **README.md update — applies** — adds `--persist` bullet to `/ba:review` section and a row to the Artifact Paths table; satisfies `CLAUDE.md:73`.
- [x] **CLAUDE.md update — applies** — extends the existing protected-artifacts guard line at `:72` with `docs/reviews/` (single authoritative guard list) and adds a clean Artifact Paths row (no in-table annotation). No new Convention bullet — runtime `.gitignore` management was removed from scope, so there is no safety invariant to encode as a project-wide rule; dev-workflow's committed `.gitignore` is a static dogfooding file.
- [x] **Planning-only command discipline** — this plan writes no code; `/ba:execute` will edit files.
- [x] **Protected-artifacts guard updated at all three sites** — `commands/ba/review.md:287,305,329`. The four existing paths plus `docs/reviews/`.
- [x] **No new agent introduced** — persist is dispatcher-level only; no `## Agents` section update needed.
- [x] **Two-phase write contract preserved** — reviewers continue returning text only; orchestrator does all file writes (Step 4.5).
- [x] **Artifact-tracking divergence noted explicitly** — `docs/reviews/` is the only artifact path the plugin does not keep under version control automatically. README's `/ba:review` bullet and table row state that ignoring it is the user's responsibility (the plugin never writes `.gitignore` in consuming repos); the dev-workflow repo carries a committed `.gitignore` for dogfooding. Readers won't be surprised that this artifact type is uncommitted or that the plugin doesn't manage their `.gitignore`.
- [x] **Nested-directory artifact convention noted** — Technical Considerations flags that any future locator-style agent over `docs/reviews/` must Glob `docs/reviews/**/*.md` (matching the `solutions/<category>/` precedent), not the flat-directory pattern used by brainstorms/plans/research.
