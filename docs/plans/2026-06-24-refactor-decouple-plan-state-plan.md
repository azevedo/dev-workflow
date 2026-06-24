---
title: Decouple Plan-State from the Plan File — stable U-IDs + git-derived progress
type: refactor
status: completed
date: 2026-06-24
origin: docs/brainstorms/2026-06-22-decouple-plan-state-brainstorm.md
detail_level: comprehensive
tags: [plan-state, execute, plan, propose, handoff, stable-uids, git-derived-progress, read-only-plan]
---

# Decouple Plan-State from the Plan File Implementation Plan

## Overview

Make the plan a **read-only decision artifact** and move all `/ba:execute` state into **git + code**. Today `/ba:execute` treats the plan file *as* its state store (flips `status:` frontmatter, checks `[ ]`→`[x]`, appends `## Deviations`), which is fragile because in the target work repo the plan is usually uncommitted — so resume and traceability ride on a mutated file that doesn't travel across machines or teammates. This refactor introduces stable **U-IDs** on implementation units, a **git-commit-subject scan** for the fast resume path, and per-unit **`Verify:`-against-code** as the squash-proof done-authority. It also folds in the remaining #35 verification-schema work (checkbox-free rendering, per-unit `Test scenarios:`/`Verify:`, `Covers AC<N>`, retirement of `### Success Criteria` and `## Behaviors to Test`). Scope is end-to-end across `plan.md`, `execute.md`, `propose.md`, `handoff.md`, plus `CLAUDE.md` and `README.md` sync. (See brainstorm: `## Locked Design`.)

This plan edits **Markdown command specs only** — no production code.

## Current State

All references verified against the repo at planning time.

- **`commands/ba/execute.md`** — writes the plan in three ways: `status: in-progress` (line 78) and `status: completed` (lines 340–342); checkbox flip `[ ]`→`[x]` via Edit (lines 229–231); `## Deviations` append (Step 4, lines 308–318) and the Step 1.5 scope-tripwire's `## Deviations` writes (lines 160–170, 179). Resume is a `[x]`-scan (lines 41, 70–76, 105). The Step 1.5 pre-execution LoC tripwire (T=400) spans lines 99–181, and its 1.5b classifier (lines 120–124, 128) is the **sole owner of the LoC-counting rule** named by CLAUDE.md:80. Step 2b (line 195) cross-references "classified per Step 1.5b". Commit grammar lives in Step 2f (lines 260–262: `<type>(<scope>): <description>` + `Plan:` trailer). The interactive phase-gate manual-verification pause is Step 3 (lines 271–284). `status: active|completed` is read in Locate-the-Plan (line 27) and "already complete" (line 48).
- **`commands/ba/plan.md`** — three templates carry `- [ ]` checkboxes (Acceptance Criteria, Behaviors to Test, Success Criteria) at lines 209–210, 220–221, 259–260, 270–272, 303, 306, 336–337, 347–349, 378, 380. `### Success Criteria` (STANDARD 300–306; COMPREHENSIVE per-phase 376–380) and `## Behaviors to Test` (MINIMAL 216–221; STANDARD 266–272; COMPREHENSIVE 343–349). The `**Code-shape decision:**` label appears at 47, 150, 233, 297, 373, 441, 558. YAML frontmatter block at lines 186–196 (`status: active` at 190). Phase-gate placeholder at line 382. Keyed `AC<N>` Acceptance Criteria already shipped (lines 206–210, 256–260, 332–337).
- **`commands/ba/propose.md`** — composes its **own** commit message (Step 3.3 title rewriting, lines 381–394; final assembly 406–408; commit via `-F` temp file, Step 5b lines 484–499) with **zero U-ID awareness**. `DIFF_BASE=$(git merge-base HEAD origin/$DEFAULT_BRANCH)` is already defined (line 129). Cross-refs row emits `Fixes <ref>` (line 359). No commit-trailer mechanism exists today.
- **`commands/ba/handoff.md`** — narrates `/ba:execute` progress as a task count sourced from session memory (lines 32–33), not by parsing checkboxes/status. Verified-facts rule at lines 43–44.
- **`CLAUDE.md`** — line 80 is the Code-shape five-site rule naming `execute.md` "Step 2b + Step 1.5b LoC projection — sole owner of the LoC-counting rule". Line 78 is the never-hide-ledger pattern (owner inside a shipped command file + README mirror). Line 81 is the README-update convention. Line 72 is the version-bump convention.
- **`README.md`** — line 15 ("Plans drive implementation, then flip to `status: completed`"), line 98 (`/ba:plan` Code-shape label), lines 127 (checkbox-resume), 128 (deviations persisted in plan file), 129 (Pre-execution LoC scope check, 400 LoC), 120–130 (`/ba:execute` bullet incl. phase gates / `status: completed`), 160–172 (`/ba:propose`), 174–182 (`/ba:handoff`).
- **`.claude-plugin/plugin.json`** — version `0.26.0`.
- **`docs/solutions/`** — does not exist; no prior learnings.

## Acceptance Criteria

Plan-owned, minted here.

- [ ] AC1: `/ba:execute` performs **zero** writes to the plan file across a full run and a resume — no `status:` transition, no `[ ]`→`[x]` flip, no `## Deviations` append.
- [ ] AC2: Resume is derived from git via a single `derive-state(plan, git, run_verify)` operation that returns a **per-unit verdict** `done-via-subject` / `done-via-verify` / `pending`: a unit whose `U<n>` appears (word-boundary, subject-only) in a `<base>..HEAD` commit subject is `done-via-subject`; else (only when `run_verify`) a unit whose `Verify:` passes is `done-via-verify`; else `pending`. Execution resumes at the first `pending` unit.
- [ ] AC3: `<base>` is defined **once** in the convention as `git merge-base HEAD origin/<default-branch>` (mirroring `propose.md`), with a stated degrade path when there is no upstream/remote and an explicit **abort** (not silent-empty) when a `git` invocation itself errors, so `derive-state` returns the same verdict for the same inputs.
- [ ] AC4: The U-ID matcher reads commit **subjects only** (`git log --format=%s`), matches `U<n>` only when preceded by `: ` and followed by space/end (so neither `U11` nor `U3done` matches `U3`), and **excludes** `Revert` commits.
- [ ] AC5: Plan templates render checkbox-free; implementation units carry `### U<n> — <title>`, one or more `Test scenarios:` bullets (optional `(Covers AC<N>)`), and exactly one **code-matchable, read-only** `Verify:` line; `## Behaviors to Test` and `### Success Criteria` are gone from all three templates.
- [ ] AC6: Plan frontmatter carries a `plan_schema: 2` discriminator; `/ba:execute` refuses a plan without it, distinguishing **absent** (re-plan guidance) from **present-but-≠2** (version mismatch) from **present-but-malformed** (frontmatter error).
- [ ] AC7: `/ba:execute` commits **one U-ID per commit** at every detail level; the COMPREHENSIVE phase gate is an **automated checkpoint** (proceed only when every unit in the phase is `done`) with **no** interactive manual-verification prompt; the content-triggered deviation pause still fires.
- [ ] AC8: On resume, before re-implementing any unit whose verdict is `pending`, `/ba:execute` checks for a dirty working tree and surfaces it rather than silently re-implementing (the dirty tree is the safety net when a weak/absent `Verify:` left a partly-implemented unit reading `pending`).
- [ ] AC9: Deviations live in the MR/PR body (rolled up by `/ba:propose` from optional transient `Deviation (U<n>):` commit trailers over `DIFF_BASE..HEAD`) and the Linear ticket when linked; never in the plan; the MR **title** carries no U-ID; `/ba:propose` does not author a commit that strips or masks execute's U-tagged subjects.
- [ ] AC10: `/ba:handoff` narrates progress via `derive-state(run_verify: false)` — **subject-scan only**, guaranteed side-effect-free (it never runs `Verify:` commands), so it reports each unit as `done-via-subject` (committed) or `pending`; a `done-via-verify` unit is invisible to handoff and is narrated as `pending` (uncommitted, not yet durable).
- [ ] AC11: The U-ID/git-state convention has a **single owner** (a section in `execute.md`) cited by `propose.md` and `handoff.md` and minted-against by `plan.md`; a `CLAUDE.md` Conventions bullet names the owner and citation sites.
- [ ] AC12: `CLAUDE.md`'s Code-shape bullet drops the deleted "Step 1.5b LoC projection — sole owner of the LoC-counting rule" clause; the `**Code-shape decision:**` label string remains byte-identical at its surviving sites (plan.md trigger + three placeholders, execute.md Step 2b, README.md), and Step 2b absorbs the literal-vs-pseudo classifier formerly in Step 1.5b.
- [ ] AC13: `README.md` reflects the new model at every affected site (15, 98, 127, 128, 129, the `/ba:execute`/`/ba:propose`/`/ba:handoff` bullets), and `.claude-plugin/plugin.json` version is bumped.

## What We're NOT Doing

- **Not** driving `Test scenarios:` via agent-browser — that is the `/ba:prove` (#20) / `/ba:polish` (#24) lane. (See brainstorm: `## Scope Boundaries`.)
- **Not** building HTML output mode (#33) — this unblocks it, doesn't build it. (U-IDs are visible-text headings so #33 can reuse them, but no HTML rendering is added here.)
- **Not** committing dev-workflow artifacts in work repos — immutability is the chosen durability answer.
- **Not** adding a migration helper for old plans — hard cutover, single code path. (See brainstorm Key Decision 6.)
- **Not** writing the plan doc *itself* under `plan_schema: 2` — this plan is authored under the current (pre-cutover) template so the current `/ba:execute` can run it; the new schema applies only to plans created after this lands.
- **Not** adding a plan-discriminator to the commit subject grammar — the design assumes **one in-flight plan per branch** (documented as an explicit assumption, not solved).
- **Not** re-adding any element from the brainstorm's `## Rejected Designs` (hidden-comment U-IDs, derived test scenarios, keep-Success-Criteria, keep-LoC-tripwire, human phase-boundary pause) — the design is locked.

## Behaviors to Test

<!-- This plan itself is authored under the current (pre-schema-2) template, so it
uses `## Behaviors to Test` + `- [ ]` checkboxes deliberately — it must run under
the *current* /ba:execute. It is NOT an example of the new template, which retires
both (Phase 2 / U8). Future plan_schema:2 authors: see the new plan.md templates. -->

- [ ] A `plan_schema: 2` plan with units `U1..U4`, commits for `U1`/`U2` present in `<base>..HEAD`, `U3` absent but its `Verify:` passing, `U4` absent and failing → `derive-state` reports `{done: U1,U2,U3; pending: U4}` and execute resumes at `U4`.
- [ ] A subject `feat(x): U11 …` does **not** mark `U1` as done, and `feat(x): U3done …` does **not** mark `U3` as done (word-boundary matcher: digit- *and* letter-adjacency).
- [ ] A `Revert "feat(x): U3 …"` commit does **not** mark `U3` as done (revert exclusion).
- [ ] A `Deviation (U7): …` trailer in `U4`'s commit **body** does **not** mark `U7` done (subject-only scan).
- [ ] A plan with no `plan_schema` key is refused with re-plan guidance; a plan with `plan_schema: 1` is refused with a version-mismatch message; a plan with `plan_schema: "two"` is refused with a malformed-frontmatter message.
- [ ] Resuming with a `pending` unit and a dirty tree surfaces the dirty tree before re-implementing.
- [ ] A content-triggered deviation where the user picks "Pause execution" still records the `Deviation (U<n>):` trailer (the unit is committed with the trailer before the pause returns), and the pause fires the "run /ba:propose to persist" reminder.
- [ ] A fully-merged (squashed) plan whose every `Verify:` passes is announced "already complete (verified against code)" rather than re-executed.
- [ ] `grep -F '[ ]' commands/ba/plan.md` over the three template bodies returns no implementation checkboxes; `grep '### Success Criteria' commands/ba/plan.md` and `grep '## Behaviors to Test' commands/ba/plan.md` return nothing.
- [ ] `grep -n 'Step 1.5' commands/ba/execute.md` returns nothing (tripwire fully retired).
- [ ] The `**Code-shape decision:**` label string is byte-identical across plan.md (trigger + three placeholders), execute.md Step 2b, README.md.
- [ ] `/ba:handoff`'s narration of a plan-in-progress runs no `Verify:` shell commands.

## Proposed Solution

A shared **U-ID & Git-Derived State Convention** (authored as a top-level section in `execute.md`, the only shipped file where `derive-state` is the core operation) owns exactly: (1) the U-ID anchor grammar, (2) the commit-subject grammar, (3) the `derive-state` operation with its `<base>` definition and matcher rules. `plan.md` mints anchors per the grammar; `propose.md` and `handoff.md` cite the section. `CLAUDE.md` gains a Conventions bullet naming the owner + citation sites (mirroring the never-hide-ledger and Code-shape-label patterns). The plan file becomes a one-way input: minted into by `plan.md`, never re-read for state. (See brainstorm: `## Locked Design`, *Dependency strategy*.)

## Technical Approach

### Architecture

The seam is the `derive-state(plan, git, run_verify) → per-unit verdict` operation. It is **one** operation, not two: the `run_verify` flag selects whether the `Verify:` tier runs (execute resume passes `true`; handoff passes `false` for a guaranteed side-effect-free read). The verdict (`done-via-subject` / `done-via-verify` / `pending`) is the seam's only output — callers branch on the verdict, never on *how* the subject-vs-`Verify:` resolution ran, so swapping the fallback later (e.g. `git notes`) touches no consumer. The hybrid resolution, the `<base>` window, and the subject-string internals all live behind the one convention section. (See brainstorm: `## Locked Design`, *What's hidden behind the seam*.)

The single most load-bearing detail the flow analysis surfaced: **`<base>` and the matcher must be literal in the convention**, not re-derived per consumer, or `execute` and `handoff` drift exactly as the commit grammar drifts today. The convention borrows `propose.md`'s already-precise `merge-base` derivation verbatim.

### Key decisions resolved during planning (refinements within the lock)

- **Convention owner = a section in `execute.md`** (not `.claude/agent_docs/`). Rationale: shipped command files cite it; `.claude/agent_docs/roadmap-management.md` is a repo-maintenance doc that does **not** ship to plugin consumers, so an execution-time convention consumers' `/ba:execute` runs against must live in a shipped file. Mirrors how the never-hide ledger lives in `review.md` Step 2. (Convention-checker confirmed.)
- **`status:` stays an optional human-authored field** (values e.g. `active` / `superseded`). `/ba:execute` stops reading it for resume and stops writing it. "Already complete" is derived (all units `done`). Locate-the-Plan auto-detection switches from `status`-preference to most-recent `plan_schema: 2` plan. (SYNC-5 sub-decision; convention-checker confirmed `status` removal from execute is consistent with read-only-plan.)
- **One commit per unit at all detail levels** — resolves the C3/I7 contradiction (brainstorm "one U-ID per commit" vs current execute "one commit per phase"). The COMPREHENSIVE phase boundary becomes a verification+proceed checkpoint, not a commit-batching boundary.
- **`propose` does not re-author execute's commits.** Common path: execute made N U-tagged commits, `propose` pushes + opens the PR and rolls up trailers. AC9's "preserve U-IDs" means *don't rewrite the U-tagged subjects already in `<base>..HEAD`*, and propose's mechanism→effect title rewriting (Step 3.3) applies to the **PR title only**, which is U-ID-free by design.

### Alternative Approaches Considered

- **Convention in `.claude/agent_docs/`** — rejected: doesn't ship to plugin consumers, so shipped command files would cite a file end users don't have.
- **Remove `status:` entirely** — rejected: it has residual human-browsing value; keeping it as inert authoring metadata is less churn and harmless once execute ignores it.
- **Keep per-phase commit batching + relax "one U-ID per commit" to "≥1 U-ID per commit"** — rejected: complicates the matcher (multiple tokens per subject) for no resume benefit; one-commit-per-unit is the simplest model the subject scan needs.
- **Subject-scan as a hint confirmed by `Verify:` (flip resolution order)** — rejected: changes the locked resolution order; reverts are instead handled by excluding `Revert` commits and documenting the residual re-tag path. (See brainstorm `## Locked Design` — resolution order is locked.)

## Implementation Phases

### Phase 1: The convention + execute.md rewrite (foundation)

This phase establishes the convention everything else cites, then rewrites execute's state handling to use it. All edits are in `commands/ba/execute.md`.

#### Changes Required

**File**: `commands/ba/execute.md`

**U1 — Author the `## U-ID & Git-Derived State Convention` section.** Add a new top-level section (placed before Step 1, after the Locate/Read-Validate preamble) that is the single owner of the grammar + `derive-state`. Update the file's opening blurb (line 9) which currently says "track progress via plan checkboxes" → git-derived progress.

**Code-shape decision:** the exact wording of this section is the design — `<base>`, the matcher, the pass criterion, and the resolution order must be literal so `execute`/`handoff`/`propose` cannot re-derive them differently (the drift this whole refactor removes). `execute.md` is the authoritative home; the block below is the proposed section text. Anchor: brainstorm `## Locked Design` → *Interface* and *Usage example*.

```markdown
## U-ID & Git-Derived State Convention

This section is the single owner of the U-ID grammar and the derive-state read.
`/ba:plan` mints anchors per (1); `/ba:execute` writes (2) and runs (3) with
`run_verify: true`; `/ba:propose` and `/ba:handoff` cite this section, and
`/ba:handoff` calls (3) with `run_verify: false`.

**(1) U-ID anchor** (minted by `/ba:plan`): each implementation unit is a
`### U<n> — <title>` heading. `<n>` is a positive integer, monotonic,
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
the plan is ignored — struck units are inert). For each plan unit, resolve in
order:
  a. **done-via-subject** — its `U<n>` token appears in a commit subject in
     `<base>..HEAD`. Match on **subjects only** and on **word boundaries**:
     `git log --format=%s <base>..HEAD --invert-grep --grep='^Revert'` piped to
     a token match where `U<n>` is immediately preceded by `: ` and followed by
     a space or end-of-line (e.g. `grep -E ': U<n>( |$)'`) — so neither `U11`
     nor `U3done` matches `U3`. Subjects-only is deliberate: `Deviation (U<n>):`
     trailers put other U-IDs in bodies; reverts are excluded so a reverted unit
     re-reads pending until re-tagged.
  b. else, **only when `run_verify` is true**, **done-via-verify** — the unit's
     `Verify:` passes against the working tree. **"Passes"** = the command exits
     0, or the named symbol/path is present in the working tree. A unit with no
     code-matchable `Verify:` line is **commit-tag-only**: it skips this tier and
     stays `pending` until its U-ID appears in a subject. A `Verify:` that exits
     non-zero for an **environmental** reason (command not found, permission
     denied) must surface a warning — never silently read `pending`.
  c. else **pending**.
Resume at the first `pending` unit. With `run_verify: false` (handoff) the
operation runs the subject scan only and is **guaranteed side-effect-free** — it
never executes a `Verify:` command, so it returns only `done-via-subject` or
`pending` and cannot observe `done-via-verify`. With `run_verify: true` (execute
resume) `Verify:` commands run and must be read-only per the `Verify:` minting
rules in `plan.md` (Phase 2 / U9).

**`<base>` definition** (owned here, mirrors `propose.md`; `/ba:propose` cites
this for both its diff range and its deviation-trailer rollup window):
`git fetch --no-tags origin <default-branch>` then
`<base> = git merge-base HEAD origin/<default-branch>`, using the same
default-branch detection ladder as `propose.md`. Degrade order: no
upstream/remote (fresh local branch) → merge-base against the local default
branch; that absent too → treat the subject-scan window as **empty** and rely on
the `Verify:` tier. Distinct from degrade: if a `git` invocation itself returns
non-zero (a repo with no commits yet, `fetch` failing offline such that
`merge-base` can't run), surface the git error and **abort** — do not silently
treat the window as empty.
```

**U2 — Rewrite Locate/Read-Validate/Resume to use `derive-state`.** Decisions:
- Locate-the-Plan (line 27): drop `status`-preference; auto-detect the most-recent `plan_schema: 2` plan. **`/ba:execute` ignores `status:` entirely for control flow — including a human-set `status: completed`**; completion is derived from `derive-state` only, never from the frontmatter.
- **Hard-cutover three-way refusal** (read `plan_schema` from YAML frontmatter only, not body prose; a file with no `---` frontmatter block at all is the **absent** case): **absent** → "This plan predates the git-derived execution model. Re-plan with `/ba:plan` to regenerate it under `plan_schema: 2`" (point at `origin:` brainstorm when present); **present but ≠ 2** → name the found value + plugin upgrade/downgrade guidance; **present but unparseable** → "frontmatter malformed near `plan_schema`". Optional preflight: if the file has neither `plan_schema` nor any recognizable plan structure (no `## Acceptance Criteria`, no `### U<n>`), say "this doesn't look like a plan file" rather than the re-plan message.
- Resume state (lines 41, 70–76): replace the `[x]`-scan with `derive-state(plan, git, run_verify: true)`; announce "Resuming at U<k> (<d>/<m> done)." A `Verify:` that errors for an environmental reason surfaces the warning from the convention rather than silently re-implementing.
- "Already complete" (line 48): replace "ALL checkboxes `[x]`" with "every unit `done` (via either path)"; for a fully-merged/squashed plan whose units all read `done-via-verify`, announce "already complete (verified against code); no pending units" rather than re-executing (post-merge resume — flow finding I2).
- **Dirty-tree guard (AC8):** before re-implementing any unit whose verdict is `pending`, check for uncommitted changes (the existing check at line 72) and surface them: "U<k> reads pending, but the working tree is dirty — inspect / commit / discard before I re-implement?" The per-unit verdict from `derive-state` is what makes this checkable; worktree dirtiness is a *legitimate* resume signal (the only plan-file-adjacent signal not designed out).

**U3 — Retire Step 1.5 entirely; rewrite Step 2b to self-contain the classifier.** Decisions:
- Delete the whole Step 1.5 block (lines 99–181) including 1.5e/1.5f `## Deviations` writes and the T=400 machinery.
- Step 2b (line 195) currently says "classified per Step 1.5b" — rewrite it to carry the literal-vs-pseudo classification inline (the three-case rule: fence under a `**Code-shape decision:**` label → literal; unlabeled fence in a plan that has ≥1 label → pseudo-code; any fence in a plan with no labels → literal). The `**Code-shape decision:**` label string stays byte-identical (AC12).
- Update Important Guidelines: remove line 390 (pre-execution scope check mandatory).

**U4 — Drop all plan-mutation writes; one-commit-per-unit cadence.** Decisions:
- Remove `status: in-progress` write (line 78) and `status: completed` write (lines 340–342) and the Step 5 "Update Plan Status" subsection.
- Remove the Step 2e "Update Checkpoint" checkbox flip (lines 229–231) entirely — the commit is the only checkpoint.
- Remove the Step 4 `## Deviations` append (lines 308–318); Step 4 keeps the **content-triggered deviation pause** (Expected/Found/Why + AskUserQuestion) but records via the **optional transient `Deviation (U<n>):` commit trailer** instead of the plan. **Durability on pause (flow finding M4/Critical):** because the trailer can only exist in a commit, execute must commit the affected unit *with* its `Deviation (U<n>):` trailer **before** the "Pause execution" branch returns control — preserving the old model's "record before the pause" guarantee. A deviation must never be lost because the user paused.
- Rewrite Step 2f Detail-level boundaries (lines 249–252): MINIMAL/STANDARD/COMPREHENSIVE all commit **one U-ID per unit**; drop "one commit per phase". Step 2f commit grammar (lines 260–262) cites the convention's grammar `<type>(<scope>): U<n> <description>` (replace the `Plan:` trailer with the U-ID-in-subject form; keep an optional `Deviation (U<n>):` trailer line in the body when a deviation was accepted).
- Update Important Guidelines line 387 ("Track progress in the plan file … `[x]` … how resume works") → git-derived resume.

**U5 — Automated phase checkpoint + deviation durability + completion reminder.** Decisions:
- Rewrite Step 3 (lines 271–284): the phase boundary is reached **only when every unit in the phase is `done`** (a partly-passing phase keeps execute in the Step 2 unit loop — flow finding I6); at the boundary, run the phase's units' `Verify:` (already satisfied by definition), commit, and proceed — **no** AskUserQuestion manual-verification prompt. Drop Important Guidelines line 394 (manual verification between phases).
- Completion step (Step 5): add a reminder when any `Deviation (U<n>):` trailer was written — "Run `/ba:propose` to persist N deviation(s) to the MR/ticket; they are not durable until then. **Do not squash these commits before `/ba:propose` — squashing buries the `Deviation (U<n>):` trailers before propose can roll them up.**" Fire this reminder on **any** exit path that leaves trailers unpersisted — clean completion **and** the "Pause execution" / early-exit branches — not only on clean completion. Update the Summary block to drop "Deviations: N recorded" (no longer in-plan) or reframe as "Deviation trailers: N (run /ba:propose to persist)".

#### Success Criteria

##### Automated:
- [x] `grep -n 'Step 1.5' commands/ba/execute.md` — returns nothing.
- [x] `grep -nE '\[ \]|\[x\]' commands/ba/execute.md` — no checkbox-flip instructions remain (allow incidental AskUserQuestion option text only).
- [x] `grep -n 'status: in-progress\|status: completed' commands/ba/execute.md` — returns nothing (status no longer written).
- [x] `grep -n 'derive-state' commands/ba/execute.md` — present; `grep -n 'U-ID & Git-Derived State Convention' commands/ba/execute.md` — present.
- [x] `grep -n 'merge-base' commands/ba/execute.md` — `<base>` defined.
- [x] `grep -n '## Deviations' commands/ba/execute.md` — returns nothing.

##### Manual:
- [x] Read the convention section end-to-end: `<base>`, word-boundary matcher, `%s`-only, revert-exclusion, plan-scoped, struck-units-inert, and the read-only-`Verify:` asymmetry are all stated literally.
- [x] The three-way `plan_schema` refusal gives distinct guidance per case.
- [x] Step 2b reads standalone (no dangling reference to the deleted Step 1.5b).

> **Phase gate:** Automated greps must pass. Pause for the manual read-through before Phase 2.

---

### Phase 2: plan.md template overhaul

All edits in `commands/ba/plan.md`.

#### Changes Required

**File**: `commands/ba/plan.md`

**U6 — Frontmatter discriminator.** Add `plan_schema: 2` to the YAML Frontmatter block (lines 186–196). Keep `status:` as an optional authoring field; add a one-line note that `status:` is human-authored, **not** execution-mutated, and **ignored by `/ba:execute` for control flow — including `status: completed`** (execute derives progress from git only). Update Step 0 (line 47) and any prose that implies execute writes status.

**U7 — Checkbox-free templates + U-ID units.** For all three templates (MINIMAL `## MVP`, STANDARD `### Changes Required`, COMPREHENSIVE phase `#### Changes Required`):
- Remove every `- [ ]` from Acceptance Criteria, and convert each implementation unit/file block to a `### U<n> — <title>` heading (monotonic, strike-don't-renumber per the convention in execute.md, cited by file+section).
- Each unit carries `Test scenarios:` (plain bullets, optional `(Covers AC<N>)`) and exactly one `Verify:` line. Keyed `AC<N>` Acceptance Criteria stay (they are not checkboxes-for-resume; render them as a plain keyed list, not `- [ ]`).

**Code-shape decision:** the per-unit unit template shape is the design contract `/ba:execute`'s `derive-state` reads — show the exact rendered shape once so all three templates stay consistent. Anchor: brainstorm `## Locked Design` → *Interface* (1).

```markdown
### U1 — <unit title>

<decisions: approach, exact paths, patterns to follow, pseudo-code for shape.
Literal code only under a **Code-shape decision:** <why> label.>

Test scenarios:
- <user-observable behavior> (Covers AC1)
- <another>

Verify: <one code-matchable, read-only check — a grep-able symbol/path, a
file-existence claim, or a read-only command>
```

**U8 — Retire `### Success Criteria` and `## Behaviors to Test`.** Remove both from all three templates (MINIMAL 216–221; STANDARD 266–272, 300–306; COMPREHENSIVE 343–349, 376–380). `## Behaviors to Test` content descends into per-unit `Test scenarios:`. Rewrite the COMPREHENSIVE phase-gate placeholder (line 382) from "Pause for manual verification" → an **automated checkpoint** ("all of the phase's units' `Verify:` pass → commit → proceed"). Update "Key rules" (lines 442–443) and detail-level descriptions (line 162) that reference Automated/Manual success criteria + phase gates.

**U9 — `Verify:` minting quality rules + plan-time convention-check note.** Add a short rules block (near the Code-shape rule) stating every minted `Verify:` must be: (a) **code-matchable** (grep-able symbol/path, file-existence, or runnable command); (b) **read-only** (no state mutation — so `derive-state`/`handoff` stay side-effect-free); (c) checking **source state, not build output** (prefer a repo symbol over `dist/…`). Purely visual/manual checks belong in `Test scenarios:`, never in `Verify:` — a unit with no code-matchable `Verify:` is **commit-tag-only** (the execute.md convention defines how it resolves: it skips the `Verify:` tier and stays `pending` until committed). Extend the Step 5 convention-check expectation to flag a `Verify:` that looks unmatchable or non-read-only. (These minting rules are the authoring half of the contract the execute.md convention's `Verify:` tier cites by name — keep the two in sync.)

#### Success Criteria

##### Automated:
- [x] `grep -nE '^- \[ \]' commands/ba/plan.md` — no implementation checkboxes in template bodies (Step 5/Step 6 command-internal checklists may remain; verify by reviewing matches).
- [x] `grep -n '### Success Criteria\|#### Success Criteria\|## Behaviors to Test' commands/ba/plan.md` — returns nothing.
- [x] `grep -n 'plan_schema: 2' commands/ba/plan.md` — present.
- [x] `grep -n 'Verify:' commands/ba/plan.md` and `grep -n 'Test scenarios:' commands/ba/plan.md` — present in all three templates.
- [x] `grep -c '\*\*Code-shape decision:\*\*' commands/ba/plan.md` — label still present at trigger + three placeholders.

##### Manual:
- [x] Each template renders a `### U<n> — <title>` unit with `Test scenarios:` + one `Verify:`; AC keying preserved as a plain keyed list.
- [x] The `Verify:` quality rules (code-matchable, read-only, source-not-build) read clearly and cite the execute.md convention by name.

> **Phase gate:** Automated greps pass; manual render-through confirms unit shape before Phase 3.

---

### Phase 3: propose.md + handoff.md (consumers)

#### Changes Required

**File**: `commands/ba/propose.md`

**U10 — Preserve U-IDs + roll up deviation trailers.** Decisions:
- Add a note (Step 3.3 / Step 5b) that `propose` **does not author a commit that strips or masks** execute's existing U-tagged subjects in `<base>..HEAD`; the mechanism→effect title rewriting applies to the **PR/MR title only**, which is U-ID-free by design. Cite the execute.md convention by name for the subject grammar.
- Add a section-registry behavior (Step 3.2 table) for **deviation rollup**: scan commit bodies for `Deviation (U<n>):` trailers over the **same `<base>..HEAD` window the execute.md convention defines** (propose's existing `DIFF_BASE` *is* that window — cite the convention's `<base>` so the two never drift, don't just note the coincidence in prose); render them into the MR/PR body (and the Linear ticket when `issue_context` is present) as a `## Deviations` body section. Deviations on commits outside that range are out of scope (flow finding I5b).
- **Zero / malformed trailers (C8):** when no trailers are found, **omit** the `## Deviations` section entirely (no empty header). A near-match that doesn't fit the exact `Deviation (U<n>):` form (e.g. `Deviations:` or a missing U-ID) is skipped from the rollup but **warned** at preview so the author can correct before the PR opens.
- Note that local squashing before `propose` drops trailers in non-final commits (documented residual, not solved).

**File**: `commands/ba/handoff.md`

**U11 — Narrate via `derive-state(run_verify: false)` (subject-scan only).** Decisions:
- Rewrite the `/ba:execute` progress section (lines 32–33) to call `derive-state` with `run_verify: false` — subject scan only, **never** run `Verify:` commands (handoff must be side-effect-free; cite the execute.md convention's read-only asymmetry). Replace the "3 of 5 tasks complete" task-checkbox vocabulary with U-resolution.
- Narrate from the subject-only verdict: a unit is either `done-via-subject` (committed) or `pending`. Because handoff does not run `Verify:`, it **cannot** observe `done-via-verify` — a unit implemented-but-uncommitted reads `pending` and is narrated as "uncommitted, not yet durable — commit and run `/ba:propose` to make it durable." State this limitation explicitly so the receiving session knows handoff progress reflects **git durability**, not worktree state.

#### Success Criteria

##### Automated:
- [x] `grep -n 'U-ID\|U<n>\|derive-state' commands/ba/propose.md` — present (U-ID preservation + trailer rollup referenced).
- [x] `grep -n 'Deviation (U' commands/ba/propose.md` — trailer rollup present.
- [x] `grep -n 'derive-state' commands/ba/handoff.md` — present.
- [x] `grep -n '3 of 5 tasks' commands/ba/handoff.md` — returns nothing (old vocabulary replaced).

##### Manual:
- [x] propose's title stays U-ID-free; the U-ID-preservation note cites execute.md's convention.
- [x] handoff's narration is explicitly subject-scan-only and never runs `Verify:`.

> **Phase gate:** Greps pass; manual check that both consumers cite the single owner. Pause before Phase 4.

---

### Phase 4: CLAUDE.md + README.md sync + version bump

#### Changes Required

**File**: `CLAUDE.md`

**U12 — New convention bullet + Code-shape/LoC self-edit.** Decisions:
- Add a Conventions bullet naming `execute.md`'s `## U-ID & Git-Derived State Convention` **section** as the single owner of the U-ID grammar + `derive-state`, with citation sites: `plan.md` (minter), `execute.md` Step 2f (commit *site* — applies the grammar, does not own it), `propose.md` (preserve + rollup, cites `<base>`), `handoff.md` (reader, `run_verify: false`) — mirroring the never-hide-ledger pattern. Name the section as owner, not Step 2f, so readers go to the section for the grammar.
- Edit line 80 to **drop** "(Step 2b + Step 1.5b LoC projection — sole owner of the LoC-counting rule)" → the LoC clause is gone with Step 1.5; the mirror list becomes plan.md (trigger + three placeholders), execute.md **Step 2b**, README.md.

**Code-shape decision:** the surviving label string must be byte-identical and the bullet's mirror-site list must be exact — show the target text. Anchor: convention-checker report (Watch 1) + brainstorm SYNC-2.

```
- Plan documents default to **decisions** … a literal code block is permitted
  only under a `**Code-shape decision:** <why>` label. The label wording is
  mirrored across `commands/ba/plan.md` ("Key rules for all templates" trigger
  block **and** the three template placeholders), `commands/ba/execute.md`
  (Step 2b), and `README.md` (`/ba:plan` description) — keep them in sync. …
```

**File**: `README.md`

**U13 — README sync (all sites).** Decisions:
- Line 15 (SDD ladder): "Plans drive implementation, then flip to `status: completed`…" → plans drive implementation; progress is git-derived; plans are read-only at execute time.
- Line 127 (checkbox-resume) → "resumes across sessions via git: U-ID commit subjects + per-unit `Verify:` against code."
- Line 128 (deviations persisted in plan) → "deviations surface in the MR/PR body and Linear ticket (rolled up by `/ba:propose`), never the plan file."
- Line 129 (Pre-execution LoC scope check, 400 LoC) → **remove**.
- `/ba:execute` bullet (120–130): rework phase-gate description (per-phase automated `Verify:` checkpoint, no manual pause); drop `status: completed` skip (124) → "auto-detects the latest `plan_schema: 2` plan."
- `/ba:propose` (160–172): add U-ID preservation + deviation rollup.
- `/ba:handoff` (174–182): change "task progress reached" → git-derived (`derive-state`) progress.
- Add the U-ID/git-state convention to README's convention coverage (matching the CLAUDE.md bullet), per the never-hide mirror pattern.

**File**: `.claude-plugin/plugin.json`

**U14 — Version bump.** `0.26.0` → `0.27.0` (the auto-update cache key; every shipped change needs a bump).

#### Success Criteria

##### Automated:
- [x] `grep -n 'Step 1.5b\|sole owner of the LoC-counting rule' CLAUDE.md` — returns nothing.
- [x] `grep -n 'U-ID' CLAUDE.md` — new convention bullet present.
- [x] `grep -n '400 LoC\|plan checkboxes\|persists deviations in the plan' README.md` — returns nothing.
- [x] `grep -n 'derive-state\|U-ID' README.md` — new model referenced.
- [x] `grep '"version"' .claude-plugin/plugin.json` — shows `0.27.0`.

##### Manual:
- [x] The `**Code-shape decision:**` label is byte-identical across plan.md (trigger + three placeholders), execute.md Step 2b, README.md, CLAUDE.md bullet.
- [x] README line 15 SDD-ladder framing is factually correct under read-only plans.

> **Phase gate:** Greps pass; final byte-identical-label diff check across all sites.

## System-Wide Impact

### Interaction Graph
`/ba:plan` mints U-IDs → `/ba:execute` reads them via `derive-state` and writes U-tagged commits (+ optional deviation trailers) → `/ba:propose` reads `DIFF_BASE..HEAD` for U-tagged subjects (preserve) and `Deviation (U<n>):` trailers (roll up to MR body + Linear) → `/ba:handoff` reads `derive-state` (subject scan only) for narration. The convention section in `execute.md` is the one node all four touch.

### Error & Failure Propagation
- Hard-cutover refusal short-circuits execute before any work (three-way message).
- `<base>` resolution failure (no upstream/remote) degrades gracefully to an empty subject window + `Verify:` fallback — never errors out.
- A mutating/unmatchable `Verify:` degrades resume silently; mitigated by the plan-time convention-check (U9) and the dirty-tree guard (U2/AC8).

### State Lifecycle Risks
- **Deviation trailers are transient** until `/ba:propose` rolls them up — execute reminds at completion; local squash before propose drops them (documented residual).
- **Post-merge / squash**: subject scan finds zero U-IDs after a squash-merge; the `Verify:` fallback + "already complete (verified)" path (U2) prevents re-execution of merged work.
- **Reverts**: excluded from the subject scan; a reverted unit must be re-tagged by its follow-up commit (documented).

### API Surface Parity
Two commit-subject grammars exist today (execute Step 2f, propose Step 3.3/5b). After this refactor, execute owns U-tagged per-unit subjects; propose must not strip/mask them and only composes the U-ID-free PR title. The convention section is the single grammar source both cite.

### Integration Test Scenarios
1. Fresh `plan_schema: 2` plan → execute → 4 U-tagged commits → `propose` opens a PR with a U-ID-free title and a `## Deviations` body section rolled from one trailer.
2. Kill execute mid-unit (dirty tree, uncommitted U4) → re-run → dirty-tree guard fires before re-implementing U4.
3. Squash-merge the branch → re-run execute on the same plan → "already complete (verified against code)".
4. Plan with `plan_schema` absent / `=1` / malformed → three distinct refusals.
5. `/ba:handoff` mid-execute → narrates U-resolution with no `Verify:` shell side effects.

## Risk Analysis & Mitigation

- **Resume quality rides on `Verify:` signal** (brainstorm cost): mitigated by U9 minting rules + plan-time convention-check + U2 dirty-tree guard.
- **Optional trailer the seam can't enforce** (brainstorm cost): mitigated by execute's completion reminder (U5); residual local-squash loss documented.
- **Two-grammar drift**: removed by collapsing both into the single convention section (U1) that propose/handoff cite.
- **Bootstrapping**: this plan doc is authored under the *current* schema so the *current* execute can run it; the new schema applies only to plans created after Phase 2 lands.

## Testing Strategy

Per-phase automated greps (above) verify each spec edit landed; per-phase manual read-throughs verify prose coherence (no dangling references, byte-identical label, single-owner citations). No production code, so the "tests" are grep assertions over the Markdown plus a final cross-file label-diff. The five integration scenarios are manual walk-throughs against a scratch `plan_schema: 2` plan after all phases land.

## Documentation Plan

`CLAUDE.md` (new convention bullet + Code-shape self-edit) and `README.md` (all affected sites) are updated in Phase 4 — they are in-scope deliverables, not afterthoughts. Post-merge follow-up (out of plan scope, tracked in issues): update GitHub issue #31 (unblocked, design locked) and close the #35-gated dependency. (See brainstorm `## Next Steps`.)

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-06-22-decouple-plan-state-brainstorm.md` — Key decisions carried forward: read-only plan; stable U-IDs as visible `### U<n> — <title>` headings; hybrid git-derived resume with `Verify:` as sole done-authority; single convention owner; deviations → MR/ticket via transient trailers; hard cutover (`plan_schema: 2`); #35 remainder (checkbox-free, `Test scenarios:`/`Verify:`, `Covers AC<N>`, retire Success Criteria + Behaviors to Test); automated phase checkpoint; retire Step 1.5 LoC tripwire. Locked Design + Rejected Designs are binding.

### Internal References
- `commands/ba/execute.md` — current state writes (78, 229–231, 340–342), resume scan (41, 70–76, 105), Step 1.5 (99–181), Step 2b (195), Step 2f grammar (260–262), Step 3 phase gate (271–284), Step 4 deviations (308–318).
- `commands/ba/plan.md` — checkboxes (209–210, 220–221, 259–260, 270–272, 303, 306, 336–337, 347–349, 378, 380), Success Criteria (300–306, 376–380), Behaviors to Test (216–221, 266–272, 343–349), Code-shape label (47, 150, 233, 297, 373, 441, 558), frontmatter (186–196), phase gate (382).
- `commands/ba/propose.md` — `DIFF_BASE` merge-base (129), title rewriting (381–394), final assembly (406–408), commit (484–499), cross-refs row (359).
- `commands/ba/handoff.md` — execute-progress narration (32–33), verified-facts (43–44).
- `CLAUDE.md` — Code-shape/LoC bullet (80), never-hide pattern (78), README-update (81), version-bump (72).
- `README.md` — SDD ladder (15), Code-shape (98), execute bullet (120–130; checkbox-resume 127, deviations 128, LoC 129), propose (160–172), handoff (174–182).
- `.claude-plugin/plugin.json` — version `0.26.0`.

### Analysis carried forward
- spec-flow-analyzer findings folded in: C1 (`<base>`), C2 (matcher), C3/I7 (commit authoring + cadence), C4 (three-way cutover), C5 (`Verify:` purity), I1 (dirty-tree guard), I2 (post-merge already-complete), I3 (reverts), I4 (subject-only), I5 (deviation durability), I6 (partial phase), I8 (non-code `Verify:`), I9 (plan-scoped), N1–N4.

## Deviations

### Scope tripwire: projected ~491 LoC ≥ threshold (~400)
- **Expected**: ≤ ~400 LoC for one run
- **Found**: ~491 LoC projected across 7 files (execute.md ~221, plan.md ~147, propose.md ~40, README.md ~40, CLAUDE.md ~22, handoff.md ~20, plugin.json ~1)
- **Why**: Plan is intentionally 4-phase end-to-end; all phases are tightly coupled — execute.md's convention section must land before plan.md templates or propose/handoff consumers. Scope is by design, not drift.
- **Resolution**: accepted

## Convention Compliance

- [x] Planning/execution separation (CLAUDE.md:73–74) — aligned; edits Markdown specs only, no production code.
- [x] All artifacts require YAML frontmatter (CLAUDE.md:71) — aligned; this plan + the new `plan_schema: 2` field.
- [x] Convention-compliance check before writing (CLAUDE.md:75) — aligned; convention-checker ran (0 violations).
- [x] Convention ownership in a shipped command file (never-hide pattern, CLAUDE.md:78) — aligned; convention owned in `execute.md`, not non-shipping `.claude/agent_docs/`.
- [x] Code-shape label five-site rule + LoC-owner self-edit (CLAUDE.md:80) — addressed in U12/AC12; LoC clause dropped, label byte-identical at surviving sites, Step 2b absorbs the classifier.
- [x] README-update convention (CLAUDE.md:81) — addressed in U13/AC13 (incl. line 15 added per convention-checker).
- [x] Version-bump convention (CLAUDE.md:72) — addressed in U14 (`0.26.0` → `0.27.0`).
- [x] Roadmap-in-issues (CLAUDE.md:83) — N/A to plan content; #31/#35 follow-up is an issues action, not a competing doc.
