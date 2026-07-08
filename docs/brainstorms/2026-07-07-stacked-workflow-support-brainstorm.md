---
date: 2026-07-07
topic: stacked-workflow-support
status: approved
triage_level: full
tags: [ba-execute, ba-handoff, ba-propose, ba-review, stacked-mrs, u-id-convention, derive-state]
---

# Stacked-Workflow Support for `/ba:*` Commands

## What We're Building

A shared **stack-base resolution** mechanism that makes the `ba:` command family correct on **stacked branches** — a feature branch built on another not-yet-merged feature branch that has its own open MR. Today `/ba:execute`, `/ba:handoff`, and `/ba:propose` all compute their base as `merge-base HEAD origin/<default-branch>` — always against the repo default branch. On a stacked branch that window swallows the parent plan's commits, causing two bugs:

- **#45** — the U-ID subject-scan resume tier collides on the parent plan's reused `U1/U2/U3` tokens and **silently skips** real, not-yet-done units (handoff, which runs `run_verify: false`, has no backstop at all).
- **#47** — `/ba:propose` mis-scopes the MR (double-counting the parent's work into a huge, un-reviewable diff) and targets the default branch instead of the parent.

Both are the same root cause: base is always the default branch. The fix introduces one owned operation, `resolve-stack-base`, that detects the stack parent and returns the correct base — narrowing the resume window (fixes #45) and the diff/target (fixes #47) from a single source of truth. For Bruno, who does stacked MRs routinely (base branches are unsquashed, so colliding U-IDs across plans are the norm, not the exception).

## Why This Approach

Both issues share one root cause, so we fix it once. For #45 there were two philosophies: make the *labels* globally unique (a plan-discriminator in the commit-subject grammar) or fix *where* the resume logic looks (narrow the base). We chose window-narrowing: computing base against the detected stack parent puts the parent plan's commits outside `<base>..HEAD`, so the collision cannot occur — **no commit-subject grammar change**. The grammar route was rejected because it re-opens a decision consciously deferred on 2026-06-24 (`docs/plans/2026-06-24-refactor-decouple-plan-state-plan.md`), ripples across all five citation sites on the *grammar* axis + `CLAUDE.md`, and *still* leaves #47's detection to build separately.

Window-narrowing reuses the parent detection `/ba:propose` needs for #47 anyway, so #45 comes nearly free. The trade is that the resume fix's correctness now rides on detection being right — so we pair it with a cheap **fail-loud guard**: when detection is low-confidence or a foreign-plan U-ID is still detected in the window, surface a warning rather than silently skipping units. Detection reuses the working nearest-ancestor detector already in `/ba:review` (`commands/ba/review.md:148-163`), extended to remote refs, and absorbs it into the one shared operation so there aren't two drifting copies.

**Note on the citation-site discipline:** the commit-subject grammar is unchanged, but this design *does* change `<base>` derivation — and `<base>` is owned inside the same `## U-ID & Git-Derived State Convention` section that the five-site rule protects. So the lockstep-update discipline still fires, just on the **`<base>` axis** rather than the grammar axis (enumerated under Key Decisions).

## Key Decisions

- **#45 fixed by window-narrowing, not a grammar change**: Compute `<base>` against the stack parent; parent-plan commits fall outside the scan window. The **U-ID commit-subject grammar is unchanged**, so the plan-discriminator stays deferred per 2026-06-24 — but `<base>` derivation changes, so the citation-site sync discipline applies on the base axis (see the citation-site decision below).
- **One shared operation, as a new sibling owned sub-section in `execute.md`**: `resolve-stack-base` gets its own anchor and its own explicit citation-site list (consumers: execute, handoff, propose, and review), sibling to `## U-ID & Git-Derived State Convention` — **not** folded into it — so the sync obligation stays legible. This mirrors the existing single-owner pattern (`execute.md` owns `derive-state` and `<base>`; others cite). It absorbs `review.md`'s inline nearest-ancestor detector so there is one definition, not two drifting copies.
- **Citation-site sync targets (`<base>` axis)**: the base-consuming sites update in lockstep — `execute.md`'s `<base>` definition + `derive-state` window; `propose.md` Step 2a `DIFF_BASE` (its "same `merge-base` against the same default-branch ladder" sentence must change) + Step 2f deviation-trailer window; and `handoff.md`'s `run_verify: false` reader over the same window. `plan.md` and `review-plan.md` are grammar-only citers → reviewed and confirmed unaffected, not assumed out.
- **Auto-detect + confirm + override**: nearest-ancestor (fewest commits ahead of HEAD), git-first, extended to remote refs; confirm when ambiguous; an explicit `--target`/`--base` override always wins; `/ba:propose` additionally treats "an ancestor branch with its own open MR" as a strong signal.
- **Git-first for execute/handoff**: the host signal is injected as an optional callback; execute/handoff never pass it → zero host-API calls. Only propose layers the open-MR signal.
- **Fail-loud guard is the safety net**: an override sets the base but does **not** silence the foreign-U-ID collision check; the guard is confidence/warning-based, so it works even in handoff's `run_verify: false` path (no verify tier required).
- **Preserve `<base>` degrade/abort rules verbatim**: fetch or merge-base non-zero → abort; no remote → local default; both absent → empty window (fall back to the `Verify:` tier).
- **README touch (behavior-change, not add/rename)**: the add/rename/re-path trigger is *not* hit, but `/ba:propose` gains user-visible stacked target-branch + `DIFF_BASE` behavior — so the README `/ba:propose` (and possibly `/ba:execute`) description gets a line, and any base/target mirror text is checked for drift. Recorded as an explicit decision rather than left silent.
- **Deliver as one unified change**: `resolve-stack-base` + all consumers + guard together; `review.md` reconciliation may ride along or fast-follow.

## Locked Design

**Source:** Hybrid: B ergonomics + A guard — B's lean one-call common-case shape (one call, byte-identical non-stacked path) plus A/C's richer `confidence: high|ambiguous|low` and explicit `warning` (incl. `FOREIGN_UID_IN_WINDOW`); host signal as an injected callback (not C's opaque preset); an override sets the base but does not silence the foreign-U-ID guard.

### Interface

`resolve-stack-base(git, opts) → resolution` — a documented convention operation (shell-invoked git), owned by `commands/ba/execute.md` alongside `derive-state` and `<base>`.

- **`opts`** (all optional; a bare `resolve-stack-base(git)` is the common invocation):
  - `target_override` / `base_override` — explicit `--target` / `--base`; when set, win unconditionally.
  - `host_signal` — optional injected callback that promotes "ancestor branch has its own open MR" to a strong parent signal. Absent by default; `execute`/`handoff` never pass it (git-first by construction); only `propose` passes it.
- **`resolution`** (consumers read fields, never re-derive):
  - `base` — commit-ish to measure from (this *is* the `<base>` fed to `derive-state` and diff ranges).
  - `window` — `"<base>..HEAD"`, or `""` when the degrade ladder yields an empty window.
  - `parent` — resolved stack-parent ref short-name; the default branch when HEAD sits directly on it (non-stacked).
  - `target` — MR/PR target branch (defaults to `parent`).
  - `confidence` — `high | ambiguous | low`.
  - `warning` — `string | null`; non-null exactly when `confidence != high`; carries `FOREIGN_UID_IN_WINDOW` when a foreign-plan U-ID remains in the window.
- **Invariants / ordering**: call once, early, before `derive-state` and any diff-range construction; read-only and idempotent. Override precedence is total for `base`/`target` — **but the foreign-U-ID guard check still runs advisory even under an override.** Abort (fetch or merge-base non-zero, for any reason including a clean fetch followed by a failing merge-base) is raised, never returned. The empty-window state is reserved strictly for the no-remote/no-local-default degrade, never the abort path.

### Usage example

```
# /ba:execute — the common, non-stacked case
r = resolve-stack-base(git)                 # no opts: git-first, zero host calls
if r.warning: surface(r.warning)            # fail-loud guard hook
derive-state(plan, git, run_verify: true, base: r.base)
# handoff is identical with run_verify: false

# /ba:propose — layer the host signal
r = resolve-stack-base(git, host_signal: open-mr-probe)
target    = r.target                        # MR/PR target branch
DIFF_BASE = r.base                          # diff range + deviation-trailer scan window
```

Non-stacked branch: one call, one field read, byte-identical to today's `merge-base HEAD origin/<default-branch>`.

### What's hidden behind the seam

The nearest-ancestor algorithm (the `review.md:148-163` loop: iterate refs, `merge-base HEAD $branch`, `rev-list --count`, keep the smallest positive count), the local-vs-remote ref scope, the full `<base>` degrade/abort ladder, default-branch detection, confidence/ambiguity scoring plus the foreign-U-ID collision check, and host-signal integration. The git-first guarantee for execute/handoff is **structural** (they pass no callback), not a caller discipline to remember.

### Dependency strategy

`git` is injected as the repo-operation handle (as `derive-state(plan, git, …)` already does), keeping the operation a pure function of injected state. The single host dependency — the open-MR probe — is injected as the `host_signal` callback rather than reached for internally; this is the load-bearing seam that keeps execute/handoff git-first while letting propose layer a host signal without the operation knowing which host (GitHub/GitLab) is in play. The operation **absorbs** review.md's inline detector (review.md becomes a consumer), mirroring how `execute.md` owns `<base>` and `derive-state`.

### Trade-offs

- **From B (kept):** the common non-stacked path is a single call plus a single field read, byte-for-byte the same base commit as today — zero migration cost and zero new overhead for the majority of runs; folding review.md's scan and propose's Step 2a merge-base into one owned definition removes the "same algorithm, two copies" drift the `<base>` note already flags.
- **From A (kept):** the guard is near-structural — `warning` is non-null iff `confidence != high`, so a consumer cannot silently skip units without ignoring a field; the git-first guarantee is structural (execute/handoff pass no `host_signal`).
- **Cost of the hybrid:** a medium return struct where a given caller uses a subset of fields (execute/handoff ignore `target`); and we deliberately keep the foreign-U-ID check running under an override (slightly more work than B's short-circuit) to close B's "a wrong `--base` is silently trusted" gap.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`). Plan and execute may refine this design within the bounds of the lock; they may not re-add elements from the rejected designs below.

## Rejected Designs

### Design B — Common case (largely incorporated)
- **Interface summary:** leanest 4-field return (`base`, `window`, `parent`, `confidence: high|low`); non-stacked path is one call + one field read, byte-identical to today; edge-case params opt-in.
- **What was / wasn't incorporated:** incorporated its lean common-case ergonomics and one-call non-stacked path. **Not** incorporated: its `high|low`-only confidence, and its override short-circuit that silences the guard on the override path — the hybrid uses A's 3-state confidence and keeps the foreign-U-ID guard live under overrides.

### Design A — Deepest module (partially incorporated)
- **Interface summary:** one fat 7-field struct answers everything for every caller; guard structurally non-skippable; host signal as an injected callback.
- **What was / wasn't incorporated:** incorporated its rich `confidence` + `warning` and the injected-callback host signal. **Not** incorporated: the full fat struct (fields like `window_empty`/`target_branch` that most callers ignore) — the hybrid takes B's leaner shape instead.

### Design C — Info hiding (rejected)
- **Interface summary:** opaque `SignalSet` preset (`GIT_ONLY | GIT_PLUS_HOST`) + `on_ambiguous` callback; callers can't tell whether a host API was consulted; opaque `warnings[]` tokens.
- **Why rejected:** the `SignalSet` preset is real ceremony for a two-caller-shape world (its own trade-off admits a plain callback/bool is lighter) — we kept a simple injected callback. Its `FOREIGN_UID_IN_WINDOW` warning idea *was* incorporated into the hybrid's `warning`.

## Scope Boundaries

- **NOT changing the U-ID / commit-subject grammar** — the plan-discriminator stays deferred (2026-06-24). Grammar-axis citation sites (`plan.md`, `review-plan.md`) keep their grammar; they are reviewed and confirmed unaffected. The `<base>`-axis sync (execute/propose/handoff) is in scope, per Key Decisions.
- **`review.md` edit is scoped to the base-detection block only** (Step 1, `review.md:148-163`). The Step-2 never-hide **selection ledger** and the **protected-artifacts guard** are untouched. If reconciliation is deferred to fast-follow, the nearest-ancestor logic is temporarily duplicated in two definitions (`resolve-stack-base` vs. `review.md`) — a known, time-boxed divergence to track, not left silent.
- **NOT integrating Graphite / git-town / stacking tooling** (issue #47 direction 4) — detection is git-native.
- **NOT managing rebases** of dependent branches when a parent updates (the retired `/ba:slice` V2 idea), and **NOT auto-creating** stacked branches or sequencing a stack of MRs.
- **Remote-only parent detection is in scope** — extend nearest-ancestor to remote refs (the known gap in review.md's local-only detector).

## Acceptance Criteria

- On a stacked branch, `resolve-stack-base` returns the stack parent's tip as `base` (not the default-branch merge-base), verified against the stacked-branch repro topology (a child branch built on an unmerged parent).
- `/ba:execute` and `/ba:handoff` resume windows exclude the parent plan's commits → parent-plan U-IDs no longer read as `done-via-subject`, and the previously-silently-skipped current-plan units read `pending`.
- `/ba:propose` on a stacked branch targets the parent branch and computes `DIFF_BASE` (diff + deviation-trailer window) against it — the MR shows only this plan's commits.
- Non-stacked branch behavior is byte-identical to today (same base commit; zero new host calls in execute/handoff).
- Fail-loud guard: when detection is low-confidence or a foreign-plan U-ID remains in the window, execute/handoff surface a warning and do not silently skip; an explicit `--target`/`--base` override sets the base but the foreign-U-ID check still runs.
- Existing `<base>` degrade/abort rules preserved (fetch/merge-base non-zero → abort; no remote → local default; both absent → empty window).
- All `<base>`-axis citation sites updated in lockstep (execute `<base>`+`derive-state`, propose Step 2a/2f, handoff reader); `plan.md`/`review-plan.md` confirmed grammar-only; README `/ba:propose` description touched; `review.md`'s detector reconciled to consume `resolve-stack-base` or its deferral explicitly tracked.

## Open Questions

- _(none — all resolved during brainstorm)_

## Convention Compliance

Checked via `convention-checker` before write. **No hard violations** in the architecture. Resolved concerns (all wording/scope, no design change):

- **Five-citation-site rule (Concern 1, resolved):** original framing implied the rule was not triggered. Corrected — the commit-subject grammar is unchanged, but `<base>` derivation (owned in the same convention section) changes, so the sync discipline fires on the `<base>` axis. Base-consuming sync targets enumerated (execute/propose/handoff); `plan.md`/`review-plan.md` confirmed grammar-only.
- **Ownership placement (Concern 4, resolved):** `resolve-stack-base` specified as a *new sibling owned sub-section* with its own anchor + citation-site list (not folded into the U-ID convention), keeping the sync obligation legible. Ownership-by-`execute.md` matches the existing single-owner pattern.
- **`review.md` reconciliation (Concern 2, resolved):** scoped to the base-detection block; the never-hide selection ledger and protected-artifacts guard are explicitly out of scope; temporary two-definition divergence flagged if deferred.
- **README (Concern 3, resolved):** add/rename trigger not hit, but the `/ba:propose` behavior change warrants a description touch — recorded as an explicit decision.
- **Naming / Locked-Rejected vocabulary / no-code (OK):** `resolve-stack-base` follows `derive-state` naming; `## Locked Design`/`## Rejected Designs` match `references/brainstorm-sections.md`; brainstorm documents approach only.

## Next Steps

→ `/ba:plan` to create the implementation plan.
