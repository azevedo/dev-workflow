---
name: ba:execute
description: Execute an approved implementation plan — implement changes, test continuously, track progress
argument-hint: "[path to plan file]"
---

# Execute an Implementation Plan

Take a plan produced by `/ba:plan` and implement it systematically: make code changes, run tests, track progress via git-derived state, handle deviations, and commit at logical boundaries.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

Treat `#$ARGUMENTS` as the plan file path.

### Locate the Plan

**If a path was provided above**, read it directly.

**If no path was provided**, auto-detect the most recent actionable plan:

```bash
ls -t docs/plans/*.{md,html} 2>/dev/null | head -5
```

From the results, **branch on extension**:

- **`.md`** files: read YAML frontmatter. Select the most recent with `plan_schema: 2`. Skip
  files without `plan_schema: 2`.
- **`.html`** files: apply the **named HTML conformance preflight** (see
  `references/html-rendering.md` "Named HTML Conformance Preflight") — all three signals must
  be present (visible-text header block + ≥1 `U<n>` visible-text heading with `id=""` +
  composition footer). A non-conforming `.html` is **not** a plan file — reject it with "doesn't
  look like a plan file" (not "predates the git-derived execution model", which is the
  `.md`-absent case only). A conforming `.html` is treated as `plan_schema: 2`-equivalent.

Select the most recent conforming file across both extensions. If found, announce: "Found plan: `[filename]`. Executing this one."
If not found, ask the user: "No actionable plans found in `docs/plans/`. Which file should I execute? Or run `/ba:plan` to create one."

### Read & Validate the Plan

Read the plan file thoroughly. **Branch on extension** for validation:

#### `.md` plans

**Validate `plan_schema`** (read from YAML frontmatter only; a file with no `---` block is the absent case):
- **Absent** — stop and say: "This plan predates the git-derived execution model. Re-plan with `/ba:plan` to regenerate it under `plan_schema: 2`." Point at the `origin:` brainstorm path when present. Optional preflight: if the file has neither `plan_schema` nor any recognizable plan structure (no `## Acceptance Criteria`, no `### U<n>`), say "this doesn't look like a plan file" instead.
- **Present, an integer ≠ 2** (e.g. `plan_schema: 1`) — stop and say: "This plan has `plan_schema: <value>`. Expected `plan_schema: 2`. Check that your dev-workflow plugin version matches the plan's schema (upgrade or downgrade as needed)."
- **Present but not an integer** (a quoted string like `"two"`, a list, a map) **or unparseable YAML** — stop and say: "Frontmatter malformed near `plan_schema` (expected the integer `2`). Fix the YAML and retry." A wrong *type* is a malformed-frontmatter case, not a version mismatch.

#### `.html` plans

Apply the **named HTML conformance preflight** (from `references/html-rendering.md`) — all
three signals must be present (visible-text header block + ≥1 `U<n>` visible-text heading with
`id=""` + composition footer). Do not re-derive the signal list here; cite it by name.

A non-conforming `.html` — including legacy HTML files in `docs/plans/` that pre-date this
convention (e.g. `docs/plans/2026-05-19-feat-add-ba-propose-command-plan.html`) — is rejected
with "doesn't look like a plan file (missing: <list failing signals>)" and **not** executed. It is **not** refused as "predates
the git-derived execution model" (that message is the `.md`-absent case only). A conforming
`.html` is treated as `plan_schema: 2`-equivalent; read the visible-text header block for
`detail_level`.

Extract:

1. **Detail level** — from YAML frontmatter `detail_level` field (`.md`) or the visible-text
   header block's `Detail level` field (`.html`). If missing, infer:
   - Has "Implementation Phases" sections → COMPREHENSIVE
   - Has "Changes Required" sections → STANDARD
   - Otherwise → MINIMAL

2. **Resume state**: Run `derive-state(plan, git, run_verify: true)` (see `## U-ID & Git-Derived State Convention`). Count units with verdict `done` vs `pending`. If any are `done`, this is a resume.

3. **Task list**: Extract the discrete executable tasks based on detail level — **format-neutral**:
   - **MINIMAL**: Each implementation unit anchor (markdown `### U<n> — <title>` heading, or HTML `U<n>` visible-text heading with `id=""`) is a task.
   - **STANDARD**: Each implementation unit anchor is a task.
   - **COMPREHENSIVE**: Each implementation unit anchor within a phase is a task. Phase gates occur at phase boundaries.

4. **Already complete**: If every unit is `done` (via either path), announce "This plan is already complete — no pending units." For a fully-merged/squashed plan whose units all read `done-via-verify`, announce "already complete (verified against code); no pending units" and use **AskUserQuestion** with options: Re-verify (run `Verify:` checks to confirm), Review changes (`git diff` against base), Done.

**Legacy slice artifacts**: Some older plans carry `sliced: true`, a `## Slices` table, or `<!-- slice:N -->` markers from the retired `/ba:slice` command. Ignore them — execute the full plan as a single run. Do not branch on, refuse, or warn about these inert artifacts.

---

## U-ID & Git-Derived State Convention

This section is the single owner of the U-ID grammar and the derive-state read.
`/ba:plan` mints anchors per (1); `/ba:execute` writes (2) and runs (3) with
`run_verify: true`; `/ba:propose`, `/ba:handoff`, and `/ba:review-plan` cite this
section; `/ba:handoff` calls (3) with `run_verify: false`.

The grammar and derive-state operation are **format-neutral**: they apply identically to
markdown plans (`.md`) and HTML plans (`.html`).

**(1) U-ID anchor** (minted by `/ba:plan`): each implementation unit has a
format-neutral anchor — a `### U<n> — <title>` heading in markdown **or** an HTML
`U<n>` visible-text heading with a matching `id=""` attribute (e.g.
`<h3 id="u<n>">U<n> — <title></h3>`). `<n>` is a positive integer, monotonic,
strike-don't-renumber (a struck unit's `<n>` is never reused). U-IDs attach to
implementation units only — never to `AC<N>` or `Test scenarios:`. U-IDs are
**plan-scoped, not globally unique**: the subject scan assumes one in-flight
plan per branch.

**(2) Commit-subject grammar** (the only durable write during execution):
`<type>(<scope>): U<n> <description>`, exactly one U-ID per commit. Scope: this
grammar governs **execution-time per-unit commits only** — it does NOT govern
the single summary commit `/ba:propose` may author from its composed body. An
optional transient `Deviation (U<n>): …` trailer may appear in the commit body.

**(3) `derive-state(plan, git, run_verify) → per-unit verdict`** — the only read.
Returns, for each unit, one of `done-via-subject` / `done-via-verify` /
`pending` (a caller needing only a boolean reads `done = via-subject | via-verify`).
Iterates the **plan's** current unit set (a U-ID in git history but absent from
the plan is ignored — struck units are inert). **Locating the unit set is
format-neutral:** for a markdown plan, scan `### U<n>` headings; for an HTML plan,
scan visible-text `U<n>` headings alongside matching `id="u<n>"` attributes. The
git side (subject scan, merge-base, `Verify:`) is unchanged and format-blind. For each plan unit, resolve in
order:
  a. **done-via-subject** — its `U<n>` token appears in a commit subject in
     `<base>..HEAD`. Match on **subjects only** and on **word boundaries**.
     Print subjects, then exclude reverts and match the token **on the printed
     subject** (do NOT use `git log --grep`/`--invert-grep` for the revert
     exclusion — those match the full commit message, not the subject `%s`, so a
     commit whose *body* starts with `Revert` would be wrongly dropped):
     `git log --format=%s <base>..HEAD | grep -v '^Revert' | grep -E ': U<n>( |$)'`
     where `U<n>` is immediately preceded by `: ` and followed by a space or
     end-of-line — so neither `U11` nor `U3done` matches `U3`. Subjects-only is
     deliberate: `Deviation (U<n>):` trailers put other U-IDs in bodies. Revert
     exclusion matches only the default `git revert` subject form (`^Revert`,
     capital-R, no colon); reverts authored with an alternate subject
     (`revert:`, `chore(revert):`) are **not** excluded and must be manually
     re-tagged — a documented residual. A reverted unit re-reads pending until
     re-tagged. (Residual: a description that coincidentally contains `: U<n>`
     mid-subject is a false-positive match — acceptable under the one-in-flight-
     plan-per-branch assumption.)
  b. else, **only when `run_verify` is true**, **done-via-verify** — the unit's
     `Verify:` passes against the working tree. **"Passes"** = the command exits
     0, or the named symbol/path is present in the working tree. A unit with no
     code-matchable `Verify:` line is **commit-tag-only**: it skips this tier and
     stays `pending` until its U-ID appears in a subject. **Distinguish two
     non-zero outcomes** (both exit non-zero, but they mean opposite things): an
     **environmental failure** — the command could not be *invoked* (exit 127,
     or stderr names `command not found` / `permission denied` / `No such file`)
     — must surface a warning and **never** silently read `pending`, because the
     check never actually ran. A **legitimate failure** — a runnable command
     that returns non-zero because the thing it checks is genuinely absent (e.g.
     `grep -q 'FunctionName' src/` returning 1 because the symbol isn't there) —
     resolves the unit to `pending` with no warning; that is the `Verify:` tier
     working as intended.
  c. else **pending**.
Resume at the first `pending` unit. With `run_verify: false` (handoff) the
operation runs the subject scan only and is **guaranteed side-effect-free** — it
never executes a `Verify:` command, so it returns only `done-via-subject` or
`pending` and cannot observe `done-via-verify`. With `run_verify: true` (execute
resume) `Verify:` commands run and must be read-only per the `Verify:` minting
rules in `commands/ba/plan.md` ("Key rules for all templates").

**`<base>` definition** (owned here; `/ba:propose` cites this for both its diff
range and its deviation-trailer rollup window). `propose.md`'s Step 2a computes
`DIFF_BASE` with the same `merge-base` call against the same default-branch
detection ladder — it is the same algorithm, not a separate definition; `propose.md`
relies on its own Step 1 routing (detached-HEAD / default-branch guard) to ensure a
remote is present by the time Step 2a runs, rather than the degrade steps below:
`git fetch --no-tags origin <default-branch>` then
`<base> = git merge-base HEAD origin/<default-branch>`, using the same
default-branch detection ladder as `propose.md`. Degrade order: no
upstream/remote (fresh local branch) → merge-base against the local default
branch; that absent too → treat the subject-scan window as **empty** and rely on
the `Verify:` tier. Distinct from degrade: if **either** `git fetch` **or**
`git merge-base` returns non-zero for any reason (a repo with no commits yet, an
orphan branch with no common ancestor, `fetch` failing offline) — including a
`fetch` that succeeds followed by a `merge-base` that fails — surface the git
error and **abort**. Do not silently treat the window as empty, and do not read a
clean `fetch` as license to degrade through a subsequent `merge-base` failure.

---

## Step 1: Initialize

### Branch Check

Check the current git branch:

```bash
git branch --show-current
```

- **If on `main` or `master`**: Use **AskUserQuestion** to offer creating a feature branch. Suggest a name derived from the plan filename (e.g., `2026-03-14-feat-add-auth-plan.md` → `feat/add-auth`). If the user declines, confirm they want to work on main and proceed.
- **If on another branch**: Announce the branch name and proceed. If the branch name seems unrelated to the plan, mention it and ask the user to confirm.
- **If detached HEAD**: Warn the user and suggest creating a branch before proceeding.

### Resume Detection

**If resuming (`derive-state` found any `done` units)**:
1. Announce: "Resuming at U<k> (<d>/<m> done)." where `k` is the first `pending` unit, `d` is done count, `m` is total.
2. **Dirty-tree guard**: before re-implementing the first `pending` unit, check for uncommitted changes (`git status --short`). If dirty, surface: "U<k> reads pending, but the working tree is dirty — inspect / commit / discard before I re-implement?" Offer: Inspect (show `git diff`), Commit now, Discard changes, Proceed anyway.
3. A `Verify:` that exits non-zero for an environmental reason (command not found, permission denied) surfaces the warning from the convention — never silently re-implements.

**If fresh start (all units `pending`)**:
1. Announce: "Starting execution. [M] tasks to complete."

### Test Discovery

Determine the project's test command. Check in order:

1. **CLAUDE.md** — Look for explicit test/lint commands
2. **package.json** — `scripts.test`, `scripts.lint`
3. **Makefile** — `test` target
4. **pyproject.toml / setup.cfg** — Python test configuration
5. **Cargo.toml** — Rust (`cargo test`)
6. **go.mod** — Go (`go test ./...`)
7. **mix.exs** — Elixir (`mix test`)

If multiple test commands exist, prefer the one in CLAUDE.md. If none found, ask the user: "What command runs the tests for this project?"

Also discover a lint command using the same approach. If found, lint runs alongside tests.

---

## Step 2: Execution Loop

For each unchecked task in order:

### 2a. Announce

Brief announcement: "**Task [N]/[M]**: [description] in `[file path]`"

For COMPREHENSIVE plans, also announce phase transitions: "**--- Phase [N]: [Phase Title] ---**"

### 2b. Implement

Implement the plan's decisions for this task. Classify each fenced block before using it: a fence under a `**Code-shape decision:**` label is **literal**; an unlabeled fence in a plan that has at least one such label is **pseudo-code**; any fence in a plan with no `**Code-shape decision:**` labels anywhere is **literal**. Where the plan provides a literal code block, implement that code as specified — it captures a committed decision and is binding verbatim. Where the plan gives decisions, pseudo-code, or unlabeled fences (pseudo-code), implement to them following existing codebase patterns. Where a literal code block and prose both address the same file or function, the code block governs the structure; the prose is context.

When rewriting an existing file, read the original first and carry over any WHY comments (non-obvious rationale, workarounds, invariant explanations) that are not reproduced in the plan's code block but are not explicitly removed by the plan. Plan code samples are structural references, not complete comment inventories.

### 2c. Test

Run **targeted tests** — tests related to the files changed in this task. Prefer scoped test commands (e.g., `pytest path/to/test_file.py`, `npm test -- --testPathPattern=module`) over the full suite. If scoped testing isn't possible, run the full test command.

Do NOT run linting or type-checking after every task — defer those to completion verification or CI.

**On pass**: Continue to 2d.

**On failure**:
1. Analyze the failure. Attempt to fix (max 3 attempts).
2. If fixed: continue to 2d.
3. If still failing after 3 attempts, use **AskUserQuestion**:
   - "Tests failing after implementing [task description]. What should I do?"
   - Options:
     1. **Show me the error** — Display full test output for the user to diagnose
     2. **Skip this task** — Mark as deviation and move to next task
     3. **Pause execution** — Stop here, keep progress, user will fix manually and resume later

### 2d. System-Wide Self-Check

Silently review these 5 questions after each task:

1. **What fires?** — What callbacks, middleware, observers, or event handlers does this change trigger?
2. **Real chain tested?** — Did the tests exercise the actual chain, not just the unit in isolation?
3. **Orphaned state?** — Can partial failure leave inconsistent state (DB rows, cache, files)?
4. **Other interfaces?** — Are there other interfaces that expose equivalent functionality and need updating?
5. **Error alignment?** — Do error types flow correctly across layer boundaries?

If a concern is found: surface it as a brief note to the user. Do NOT block execution unless the concern is critical (e.g., data loss risk).

### 2e. Commit (MANDATORY)

**Commit after every completed unit. Do NOT defer commits to the end.**

Use the grammar from the `## U-ID & Git-Derived State Convention`:

```bash
# Stage only files changed for this unit (NOT `git add .`)
git add <files changed for this unit>

# Commit with U-ID in the subject
git commit -m "<type>(<scope>): U<n> <description>"
```

When a deviation was accepted for this unit, include an optional trailer in the body:

```bash
git commit -m "<type>(<scope>): U<n> <description>

Deviation (U<n>): <what diverged and why>"
```

**All detail levels commit one U-ID per unit.** At MINIMAL/STANDARD this is every unit. At COMPREHENSIVE this is every unit in the phase — the phase boundary is a checkpoint, not a commit batch.

**IMPORTANT**: If you realize you have >3 files changed without a commit, STOP implementing and commit immediately before continuing.

---

## Step 3: Phase Gates (COMPREHENSIVE Plans Only)

A phase boundary is reached **only when every unit in the phase is `done`** (a partly-passing phase keeps execute in the Step 2 unit loop). At the boundary:

1. Confirm all of the phase's units are `done` via `derive-state`. A unit still `pending` stays in the Step 2 loop — do not advance to the next phase.
2. Run the phase's `Verify:` checks (already satisfied by definition since all units are `done`). Report results.
3. Proceed to the next phase automatically — no interactive manual-verification prompt.

---

## Step 4: Deviation Handling

When implementation diverges from the plan (different file path, changed API, missing dependency, etc.):

1. **Report** in Expected/Found/Why format:

   ```
   **Deviation detected:**
   - **Expected**: [what the plan said]
   - **Found**: [what actually happened]
   - **Why**: [reason for the deviation]
   ```

2. **Ask** the user via **AskUserQuestion**:
   - "Deviation from plan detected. How should I proceed?"
   - Options:
     1. **Accept and continue** — Proceed with the deviation, record it
     2. **Update the plan** — Modify the plan to match reality, then continue
     3. **Pause execution** — Stop and let the user decide

3. **Record** the deviation via an optional `Deviation (U<n>):` trailer in the commit body for the affected unit (see `## U-ID & Git-Derived State Convention`). `/ba:propose` rolls these trailers up into the MR/PR body and the Linear ticket when linked.

   **Durability on pause:** because the trailer can only exist in a commit, commit the affected unit *with* its `Deviation (U<n>):` trailer **before** the "Pause execution" branch returns control — so the deviation is never lost if the user walks away. If that commit **fails** (pre-commit hook rejection, disk full, pre-push policy), do **not** silently pause — surface the commit error verbatim and ask the user to resolve it (fix the hook, free space, etc.) so the deviation is recorded before pausing; never drop to the pause with the trailer unpersisted, and never `--no-verify` around a hook to force it through. Once committed, fire a reminder: "Run `/ba:propose` to persist deviation(s) to the MR/ticket; they are not durable until then."

---

## Step 5: Completion

When all tasks are done:

### Fresh Verification

1. Confirm every unit is `done` via `derive-state(plan, git, run_verify: true)`.
2. Run targeted tests for all changed files.
3. Use **AskUserQuestion** to ask about full verification:
   - "All tasks complete. How should I verify?"
   - Options:
     1. **Run full test suite + lint now** — Complete local verification before finishing
     2. **Targeted tests only** — Already ran per-task tests, defer full suite + lint to CI
     3. **Skip verification** — Trust the per-task tests, move to summary
4. Display test output as evidence of completion.

If verification fails, report and let the user decide before claiming completion.

**Deviation-trailer reminder** (fire on any exit path — clean completion, "Pause execution", or early exit — when any `Deviation (U<n>):` trailer was written during this run): "Run `/ba:propose` to persist N deviation(s) to the MR/ticket; they are not durable until then. **Do not squash these commits before `/ba:propose` — squashing buries the `Deviation (U<n>):` trailers before propose can roll them up.**"

### Summary

Display:

```
Execution complete!

Plan: docs/plans/[filename]
Tasks: [N]/[M] completed
Commits: [N] commits made
Deviation trailers: [N] (run /ba:propose to persist)
Test suite: passing ✓

Commits made:
- [hash] [message]
- [hash] [message]
```

### Next Steps

Use **AskUserQuestion**:

**Question:** "All tasks complete. What would you like to do next?"

**Options:**
1. **Review code** — Run `/ba:review` for post-implementation code quality review
2. **Create MR/PR** — Generate a merge/pull request for the implemented changes
3. **Review changes** — Show `git diff` against the base branch
4. **Continue working** — Open-ended mode for additional changes beyond the plan
5. **Done** — Wrap up

**Based on selection:**
- **Review code** → Invoke `/ba:review` directly. The review command will auto-detect scope from the current branch.
- **Create MR/PR** → Prefer `/ba:propose` — it composes the title and a reviewer-first body, detects GitHub/GitLab from the git remote, preserves protected PR/MR blocks, and creates or updates the PR/MR as appropriate. Invoke `/ba:propose` directly. It composes the body from the diff and any linked issue, so the plan's overview and acceptance criteria are not auto-injected. **Fallback** — if `/ba:propose` is unavailable or the user wants a one-off ad-hoc PR: detect the platform from the git remote (GitHub → `gh pr create`, GitLab → `glab mr create`), or use a project/personal PR command the user prefers.
- **Review changes** → Show the diff, then return to options.
- **Continue working** → Ask what they want to work on. Exit structured execution flow.
- **Done** → Display final summary and exit.

---

## Important Guidelines

- **The plan's decisions are the authority.** Literal code blocks are authoritative verbatim; implement everything else to the plan's decisions. Don't add features, refactor surrounding code, or invent build choices the plan deliberately left as decisions.
- **Track progress via git.** Each completed unit gets a `U<n>`-tagged commit. Resume is derived from `derive-state` — no plan-file writes for progress.
- **Test after every task — targeted, not full suite.** Run tests related to changed files. Defer full suite + lint to completion or CI.
- **Report deviations immediately.** Don't silently work around plan/reality mismatches.
- **Commit at logical boundaries — this is mandatory, not optional.** Each commit should pass tests and represent a coherent unit of work. Never reach completion with zero incremental commits on a STANDARD or COMPREHENSIVE plan.
- **Evidence-based completion.** Never claim "done" without showing passing tests.
- **No convention-checker during execution.** Tests and linting are the quality gates for code.
- **TDD follows the plan.** No TDD machinery baked into the command. If the plan specifies test-first steps, follow them. If not, implement and test normally. The plan is the authority on testing approach.
