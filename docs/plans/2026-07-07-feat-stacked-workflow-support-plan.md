---
title: "feat: Stacked-workflow support for /ba:* commands"
type: feat
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow; progress is git-derived
date: 2026-07-07
origin: docs/brainstorms/2026-07-07-stacked-workflow-support-brainstorm.md
detail_level: comprehensive
tags: [ba-execute, ba-handoff, ba-propose, ba-review, stacked-mrs, resolve-stack-base, u-id-convention]
---

# feat: Stacked-workflow support for /ba:* commands — Implementation Plan

## Overview

Introduce one owned convention operation, `resolve-stack-base(git, opts) → resolution`, that makes the `ba:` command family correct on **stacked branches** (a feature branch built on another not-yet-merged feature branch with its own open MR). Today `/ba:execute`, `/ba:handoff`, and `/ba:propose` all compute base as `merge-base HEAD origin/<default-branch>` — always the repo default branch — which on a stacked branch swallows the parent plan's commits and causes two bugs: the U-ID resume scan silently skips real units (**#45**), and `/ba:propose` mis-scopes the MR and targets the default branch (**#47**). Both share one root cause; `resolve-stack-base` fixes it once by **window-narrowing** — computing base against the detected stack parent so the parent plan's commits fall outside `<base>..HEAD` — with **no change to the U-ID commit-subject grammar** (see brainstorm: docs/brainstorms/2026-07-07-stacked-workflow-support-brainstorm.md, Key Decisions).

## Current State

- **`## U-ID & Git-Derived State Convention`** (`commands/ba/execute.md:86-178`) is the single owner of the U-ID grammar, `derive-state`, and the `<base>` definition. `<base>` is defined strictly against the default branch (`commands/ba/execute.md:162-178`), with a precise **degrade/abort ladder** (degrade → empty window + `Verify:` tier; abort → surface git error). It has **no stack-parent detection**.
- **`/ba:propose`** computes `DIFF_BASE = git merge-base HEAD origin/$DEFAULT_BRANCH` at Step 2a (`commands/ba/propose.md:141`), reuses that window for the deviation-trailer scan at Step 2f (`commands/ba/propose.md:277-280`), and hardcodes the MR target to `$DEFAULT_BRANCH` at Step 5 (`--base` at `commands/ba/propose.md:662`, `--target-branch` at `:673`).
- **`/ba:handoff`** is a read-only consumer: `derive-state(plan, git, run_verify: false)` (`commands/ba/handoff.md:46-53`) — subject scan only, **no `Verify:` backstop at all** (the worst-off path for #45).
- **`commands/ba/review.md:148-163`** holds the *only* existing stack-parent detector — a nearest-ancestor loop over **local heads only** (`refs/heads/`), self-contained, no `fetch`, not shared. Staged/recent fallbacks follow at `:165+`.
- **Divergent default-branch ladders** exist: propose's `symbolic-ref → gh (host-guarded) → remote show → ask` (`commands/ba/propose.md:119-131`) vs review's `main → master → symbolic-ref` (`commands/ba/review.md:133-142`).
- **CLAUDE.md** owns the citation-site enumerations. The U-ID five-site rule does **not** include `review.md`. README mirrors the U-ID convention at `README.md:255` (does not mention `<base>`).
- Plugin version: `.claude-plugin/plugin.json` → `0.32.0`.

## Acceptance Criteria

Plan-owned, minted here.

- **AC1**: On a stacked branch (main→A→B, A not merged), `resolve-stack-base(git)` returns A's merge-base as `base` and `parent = target = A` — not the default-branch merge-base. Verified against the stacked-branch repro topology (a child branch built on an unmerged parent; see brainstorm Acceptance Criteria).
- **AC2**: On a non-stacked branch, resolution is **byte-identical to today**: `base = merge-base HEAD origin/<default>`, `parent = target = <default>`, `confidence = high`, `warning = null`, and **zero new host calls** in `/ba:execute` and `/ba:handoff` (they pass no `host_signal`).
- **AC3**: `/ba:execute` and `/ba:handoff` resume windows exclude the parent plan's commits → parent-plan U-IDs no longer read `done-via-subject`, and the previously-silently-skipped current-plan units read `pending`.
- **AC4**: `/ba:propose` on a stacked branch targets the parent branch (`gh pr create --base A` / `glab mr create --target-branch A`) and computes `DIFF_BASE` against it — the MR shows only this plan's commits.
- **AC5** (foreign-U-ID guard): `resolve-stack-base` sets `warning = FOREIGN_UID_IN_WINDOW` when any `U<n>` token appears in **≥2** commit subjects within `<base>..HEAD` (the observable proxy for a foreign plan; subjects-only, reverts excluded — same grammar as `derive-state` tier-a). This check runs even under an explicit `--base`/`--target` override and forces `confidence = low`. **Residual (documented, not fixed):** this is a *numeric-collision* proxy only — a foreign plan whose U-IDs do **not** overlap the current plan's numbering (parent minted U1–U5, current mints U6–U10) leaves no duplicate, so the guard does not fire and `confidence` can stay `high` over a still-polluted window. This is sufficient for #45 (the silent-skip bug is *caused* by reused/colliding U-IDs, which the proxy catches) but is not a general foreign-window detector; #47's diff-scoping relies on correct **detection** narrowing the base, not on this guard. Recorded as a residual mirroring the revert-exclusion residual in the U-ID convention.
    - When `warning != null`, `/ba:execute` surfaces the warning and does **not** silently skip: when `confidence == low` it distrusts `done-via-subject` verdicts and falls through to the `Verify:` tier for the affected units.
    - `/ba:handoff` (no `Verify:` backstop) surfaces **and persists** the warning into the handoff artifact so the receiving session inherits the uncertainty.
- **AC6** (self-exclusion): the detector never selects the current branch as its own parent — excluded across **all** ref forms: local `refs/heads/<current>`, `refs/remotes/origin/<current>`, and the `@{upstream}` ref.
- **AC7** (ref scope): detection iterates `refs/heads/` and `refs/remotes/origin/` only (origin-only; `refs/remotes/origin/HEAD` excluded), deduped by normalized short-name; when a name's local and remote tips diverge, `confidence = ambiguous`. This divergence check is a **post-loop comparison** of the two same-name candidates' merge-bases (the illustrative detection loop in U1 handles distinct-name ties only; the local-vs-remote-same-name divergence is specified in prose and computed after the loop — see U1(c)).
- **AC8** (degrade/abort preserved verbatim): fetch or the final chosen-base merge-base non-zero → **abort** (raised, never returned); no remote → local default; both absent → **empty window** (`""`) + `Verify:` tier. A per-candidate `merge-base` failure inside the detection loop (and any per-candidate ref fetch, where one is performed) is **skipped** (`|| continue`), not aborted — the detection loop itself performs no per-candidate fetch (it reads already-known local/remote-tracking refs); the only fetches are the up-front default-branch fetch and the single chosen-winner fetch (U1(c)). Empty-window degrade sets `confidence = low` (the guard cannot run).
- **AC9** (confidence states): `high | ambiguous | low` map to observable git conditions per the decision table in U1. **`ambiguous` is informational** — it carries a richer `warning` message (and, for `/ba:propose`, signals that `target` came from a contested host-vs-git call), but it is **not a control-flow fork**: execute/handoff treat `ambiguous` exactly like `high` for the subject-scan trust decision. **`low` is the only state that changes consumer trust behavior** (execute distrusts `done-via-subject`). The three states do not collapse to a boolean *for the warning surface* (three distinct messages) but the *trust decision* is a boolean on `low`. (Resolves the AC9-overclaim finding — the earlier "handled distinctly by consumers" wording implied an `ambiguous` control-flow fork that no consumer has.)
- **AC10** (override matrix): `base_override`/`target_override` populate their fields unconditionally per the U1 matrix; a `base_override` that is not an ancestor of HEAD aborts with a clear error.
- **AC11** (citation-site sync): the `resolve-stack-base` convention has a new CLAUDE.md bullet with its **own** 4-site citation list (execute/handoff/propose/review), distinct from the U-ID five-site list. All `<base>`-axis sites updated in lockstep; `plan.md`/`review-plan.md` confirmed grammar-only; README touched; `.claude-plugin/plugin.json` version bumped.

## What We're NOT Doing

Carried from brainstorm Scope Boundaries (see brainstorm: docs/brainstorms/2026-07-07-stacked-workflow-support-brainstorm.md):

- **NOT changing the U-ID / commit-subject grammar** — the plan-discriminator stays deferred (2026-06-24). Grammar-axis sites (`plan.md`, `review-plan.md`) keep their grammar; confirmed unaffected.
- **NOT integrating Graphite / git-town / stacking tooling** — detection is git-native.
- **NOT managing rebases** of dependent branches when a parent updates, and **NOT auto-creating** stacked branches or sequencing a stack of MRs.
- **NOT touching** `review.md`'s never-hide selection ledger (Step 2) or the protected-artifacts guard — the `review.md` edit is scoped to the base-detection block only (`:148-163`).
- **NOT adding a `plan` parameter** to `resolve-stack-base` — the interface is `(git, opts)`; the foreign-U-ID guard uses a plan-free structural proxy (duplicate `U<n>` in-window).

## Proposed Solution

`resolve-stack-base` is added as a **new sibling owned `##` sub-section** in `commands/ba/execute.md`, next to (not folded into) `## U-ID & Git-Derived State Convention`. It absorbs `review.md`'s nearest-ancestor loop (extended to remote refs) so there is one definition, not two drifting copies, and it takes ownership of `<base>` derivation (moving the degrade/abort ladder verbatim). Consumers read `resolution` fields and never re-derive. The common non-stacked path is one call + one field read, byte-identical to today (Design B ergonomics); the guard is near-structural (`warning` non-null ⇔ `confidence != high`, Design A) — this is the locked hybrid (see brainstorm `## Locked Design`).

The spec-flow analysis surfaced that the locked interface was under-specified at three load-bearing points; the resolutions below are refinements **within** the lock (they do not re-add rejected-design elements):
- **Foreign-U-ID observable proxy**: a `U<n>` token in ≥2 in-window subjects (plan-free; directly detects the #45 collision).
- **`warning`/`confidence` contradiction under override**: the guard firing forces `confidence = low`, keeping the biconditional intact and the guard non-skippable (user-confirmed decision).
- **Anti-skip is behavioral, not cosmetic**: `confidence == low` makes `/ba:execute` distrust `done-via-subject` and fall to the `Verify:` tier; `/ba:handoff` persists the warning (user-confirmed decision).

## Technical Approach

### Architecture

One owned operation, four consumers, git-first by construction. The single host dependency (open-MR probe) is injected as an optional `host_signal` callback — only `/ba:propose` passes it; `/ba:execute` and `/ba:handoff` pass nothing, so the git-first guarantee is **structural**, not a caller discipline (see brainstorm `## Locked Design`, "What's hidden behind the seam" and "Dependency strategy").

### Alternative Approaches Considered

Rejected at brainstorm (see brainstorm `## Rejected Designs`): a grammar-change plan-discriminator for #45 (re-opens the 2026-06-24 deferral, ripples across the grammar axis, still leaves #47's detection to build); Design C's opaque `SignalSet` preset (ceremony for a two-caller world). This plan implements the locked hybrid only.

## Implementation Phases

### Phase 1: The owned operation (the seam)

#### Changes Required

**File**: `commands/ba/execute.md`

##### U1 — Author `## Stack-Base Resolution Convention` (the single owner)

Add a new `##` section immediately after the `## U-ID & Git-Derived State Convention` section (after `commands/ba/execute.md:178`, before the `---` at `:180`) — sibling, not nested. The section contains:

**(a) Ownership + citation-site statement.** Open with a single-owner line mirroring the U-ID section's style: "This section is the single owner of stack-base resolution. Consumers cite this section and do not re-derive base detection: `/ba:execute` (base for `derive-state` + guard), `/ba:handoff` (same, `run_verify: false`), `/ba:propose` (`DIFF_BASE` + MR target, layers `host_signal`), `/ba:review` (branch-base detection)." Format-neutral (git-side; identical for `.md`/`.html` plans).

**(b) Interface.** `resolve-stack-base(git, opts) → resolution`:
- `opts` (all optional; bare `resolve-stack-base(git)` is the common invocation): `target_override` / `base_override` (explicit `--target`/`--base`; win unconditionally for their field); `host_signal` (optional injected callback promoting "ancestor branch has its own open MR" to a strong parent signal — absent by default).
- `resolution` (consumers read, never re-derive): `base` (commit-ish; this *is* `<base>`), `window` (`"<base>..HEAD"` or `""` on empty-window degrade), `parent` (resolved stack-parent short-name; the default branch when non-stacked), `target` (MR/PR target; defaults to `parent`), `confidence` (`high | ambiguous | low`), `warning` (`string | null`; non-null **exactly when** `confidence != high`; carries the literal `FOREIGN_UID_IN_WINDOW` when the guard fires).
- **Empty-window contract (all consumers).** When `window == ""` (equivalently `base == ""`, the no-remote/no-local-default degrade), a consumer must **branch on the empty window before** constructing or running any `<base>..HEAD` range — an empty `base` otherwise forms `..HEAD`, an **invalid git revision range**, not a graceful empty window. Git-first consumers (execute, handoff) treat `window == ""` as "no subject-scan window → every unit resolves via the `Verify:` tier only" (handoff, with no `Verify:` tier, reports every unit `pending` and surfaces the empty-window `low` warning). `/ba:propose` treats it as `CompositionInputError` (U4). This rule is stated once here and restated at each wiring site (U2/U3/U4) so no consumer forms `..HEAD` by omission.

**(c) Ref scope + self-exclusion** (resolves spec-flow C4, I3, I4, N2):
- Iterate `refs/heads/` and `refs/remotes/origin/` only (origin-only — a fork/upstream remote injects unrelated candidates). Exclude `refs/remotes/origin/HEAD` (symbolic dup of default).
- Exclude the current branch across **all** forms: `refs/heads/<current>`, `refs/remotes/origin/<current>`, and the `@{upstream}` ref. (`review.md:154` excludes short-name only; extending to remotes without this would mis-select `origin/<current>` as parent once the branch is pushed and advanced.)
- Dedup candidates by normalized short-name. **Local-vs-remote-same-name divergence** (e.g. `A` and `origin/A` at different tips) is detected by a **post-loop comparison** of the two candidates' merge-bases with HEAD: if they differ, the candidate still contributes (using the nearer merge-base) but the divergence sets `confidence = ambiguous`. This is *not* the same as the distinct-name tie the illustrative loop in the Code-shape block detects (that loop's `short != PARENT` guard deliberately suppresses same-name pairs) — the divergence check is a separate, prose-specified step run after the loop over any short-name that appeared both locally and under `origin/`.
- **Fetch policy**: `git fetch --no-tags origin <default-branch>` (preserved) **and** fetch the chosen winner's `origin/` ref once before finalizing so the *winner's* count/merge-base isn't stale. **Residual (documented):** the ranking itself runs against whatever `refs/remotes/origin/*` tips are already local (only `<default>` is freshly fetched up front), so a stale sibling ref can in principle flip which branch has the smallest positive ahead-count and select the wrong parent at `confidence = high`. Fetching every candidate before ranking would be O(n) network round-trips for a heuristic; the winner-only fetch is the accepted cost trade. **Winner-fetch-failure fallback** (was underspecified): if the single chosen winner's fetch fails, do **not** abort and do **not** silently use the stale ref — instead **re-run selection excluding that candidate** (pick the next-best), and if no candidate remains fall through to the default-branch (non-stacked) path; set `confidence = ambiguous` with a stale-fetch warning when a re-selection occurred.
- Detached HEAD (`git branch --show-current` empty) → detection loop skipped → non-stacked default path.

**(d) Confidence decision table** (resolves spec-flow I1, I2). A first-class table mapping observable git conditions → confidence → warning:

| Observable git condition | `confidence` | `warning` |
|---|---|---|
| Single nearest-ancestor at smallest positive count; no guard fire | `high` | `null` |
| Non-stacked (no positive-count ancestor); clean default merge-base | `high` | `null` |
| ≥2 candidate ancestors tie at the smallest positive count | `ambiguous` | names the tied candidates + chosen pick |
| Chosen parent's local vs `origin/` tip diverge | `ambiguous` | names the divergence |
| `host_signal` names a parent git's count metric did not pick | `ambiguous` | names host pick vs git pick |
| A `U<n>` token appears in ≥2 in-window subjects (`FOREIGN_UID_IN_WINDOW`) | `low` | `FOREIGN_UID_IN_WINDOW` + detail |
| Empty-window degrade (no remote, no local default → `window = ""`) | `low` | "empty window — guard did not run" |

`ambiguous` = a parent was chosen but the pick is uncertain (the window is still a valid narrowing). `low` = the window itself is untrustworthy for the subject scan.

**Precedence (load-bearing — resolves the co-occurrence hole):** the table rows are **not** first-match. When more than one row's condition holds, confidence resolves to the **lowest** matching level: `low` dominates `ambiguous` dominates `high`. The foreign-U-ID guard (the two `low` rows) is evaluated **last and unconditionally** — so a foreign-U-ID duplicate co-occurring with a host/git disagreement (an `ambiguous` row) resolves to `low`, never `ambiguous`. Without this, a first-match reading could resolve `ambiguous` (which execute *trusts* for the subject scan) over a genuinely polluted window and silently reintroduce the #45 skip this plan exists to fix.

**(e) Foreign-U-ID guard** (resolves spec-flow C1, C2): after `base` is resolved (including under override), **reuse `derive-state`'s tier-a subject-scan invocation** (owned by the `## U-ID & Git-Derived State Convention` section — cite it, do not respecify the pipeline), generalized to *extract all* `U<n>` tokens rather than match one, and raise `FOREIGN_UID_IN_WINDOW` when any `U<n>` token occurs in **≥2** subjects. Reusing tier-a's exact invocation (rather than restating a near-duplicate regex) keeps the revert-exclusion residual defined in one place — a DRY discipline this plan applies to itself. Under the one-in-flight-plan-per-branch assumption a given `U<n>` is committed once; two occurrences ⇒ two plans' commits are in the window ⇒ foreign. The guard runs even under `base_override`/`target_override` (advisory) and forces `confidence = low` (per the user-confirmed C2 resolution — the biconditional stays intact; an override over a polluted window reads low, not high).
- **Residual (documented, safe-side):** the proxy assumes exactly one commit per `U<n>` for the life of the branch (consistent with `execute.md:397` "each completed unit gets a `U<n>`-tagged commit"). A legitimate rework/fixup that re-tags the *same* `U<n>` a second time on an otherwise correctly-scoped, non-stacked branch would false-trigger `FOREIGN_UID_IN_WINDOW`. The failure mode is safe-side (forces the `Verify:`-tier fallback, never a false `done`), but the user would see a confusing warning on a solo branch. Recorded as a residual (mirroring the U-ID convention's own residual notes); if same-unit re-tagging becomes a supported flow, the proxy must be revisited.

**(f) Override field-population matrix** (resolves spec-flow I7):

| Override given | `base` | `target` | `parent` |
|---|---|---|---|
| none | auto-detected | = `parent` | auto-detected |
| `--base X` only | `X` | auto-detected parent | auto-detected |
| `--target Y` only | auto-detected | `Y` | auto-detected |
| both | `X` | `Y` | auto-detected (informational) |

A `base_override` is validated as an ancestor of HEAD (`git merge-base --is-ancestor X HEAD`); a non-ancestor aborts with a clear error (an arbitrary `X..HEAD` is syntactically valid but breaks diff semantics). **Distinguish the two failure exit codes**: `--is-ancestor` returns **exit 1** = "X is a valid ref but not an ancestor of HEAD" (semantic rejection) and **exit 128** = "X does not resolve to a valid object" (a typo / bad ref) — the abort message must name which, so a typo isn't reported as a semantic override rejection. **`target_override` validation** (parity with `base_override`): validate it resolves to an existing local or `origin/` ref (`git rev-parse --verify`); a nonexistent target aborts here with a clear error rather than surfacing only later as a host-specific failure at `/ba:propose` Step 5.

**(g) Degrade/abort ladder — moved verbatim** from the current `<base>` definition (`commands/ba/execute.md:170-178`): degrade order (no upstream/remote → local default; that absent → empty window + `Verify:` tier); abort (either `git fetch` or the final chosen-base `git merge-base` non-zero, for any reason including a clean fetch then a failing merge-base → surface the git error and **abort**; never silently empty). Empty-window is reserved strictly for the no-remote/no-local-default degrade, never the abort path (spec-flow I5, N3).
- **No-remote detection is a pre-check, not fetch-failure introspection** (resolves the degrade-vs-abort ambiguity now fanned out to 4 consumers): "no upstream/remote → degrade" and "`git fetch` failed offline → abort" both surface as a non-zero `fetch`, so they must be disambiguated *before* attempting the fetch. Detect the missing-remote condition up front — `git remote get-url origin` (no origin) and the absence of an `@{upstream}` — and route that to **degrade**. Only a fetch that fails *when a remote demonstrably exists* routes to **abort**. Do not infer no-remote from the fetch exit code.

**(h) Invariants**: call once, early, before `derive-state` and any diff-range construction; read-only w.r.t. the working tree and `refs/heads` (may write remote-tracking refs via `fetch`, as the existing `<base>` ladder already does — spec-flow N1); idempotent. Override precedence is total for `base`/`target`; the foreign-U-ID guard still runs advisory. Abort is raised, never returned.

**(i) `host_signal` conflict resolution** (resolves spec-flow I9): host + git agree → `high`; disagree → the `host_signal` parent wins `parent`/`target` (it is the strong signal — that is where the MR should stack), `base` is recomputed as `merge-base HEAD <host-parent>` for a coherent diff, and `confidence = ambiguous` with a warning naming both picks.

**Code-shape decision:** *the exact ref-iteration and count-selection is the design, and re-deriving it from prose would plausibly produce a wrong structure (dropping the `origin/HEAD` exclusion, missing the tie-detection that yields `ambiguous`, or not skipping per-candidate failures) — it anchors to the existing loop at `commands/ba/review.md:148-163` and the brainstorm `## Locked Design` "What's hidden behind the seam".* Include a single labeled bash block in the section showing the absorbed + extended detector:

```bash
# Nearest-ancestor stack-parent detection (absorbs review.md:148-163, extended to origin/ refs).
# Emits BEST_MB (merge-base with the chosen parent), PARENT (short-name), and TIE (≥2 at min count).
CURRENT=$(git branch --show-current)                 # empty on detached HEAD → loop skipped
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
BEST_COUNT=999999; BEST_MB=""; PARENT=""; TIE=0
if [ -n "$CURRENT" ]; then
  for ref in $(git for-each-ref --format='%(refname:short)' refs/heads/ refs/remotes/origin/); do
    short=${ref#origin/}
    [ "$short" = "$CURRENT" ] && continue            # exclude current: local + origin/<current>
    [ "$ref" = "origin/HEAD" ] && continue           # exclude symbolic default dup
    [ "$ref" = "$UPSTREAM" ] && continue             # exclude @{u}
    mb=$(git merge-base HEAD "$ref" 2>/dev/null) || continue     # per-candidate failure: skip, don't abort
    count=$(git rev-list --count "$mb..HEAD" 2>/dev/null) || continue
    if [ "$count" -gt 0 ] && [ "$count" -lt "$BEST_COUNT" ]; then
      BEST_COUNT=$count; BEST_MB=$mb; PARENT=$short; TIE=0
    elif [ "$count" -gt 0 ] && [ "$count" -eq "$BEST_COUNT" ] && [ "$short" != "$PARENT" ]; then
      TIE=1                                          # ≥2 candidates tie at min count → confidence=ambiguous
    fi
  done
fi
# No positive-count ancestor found → non-stacked: BEST_MB="", fall to default merge-base (byte-identical to today).
```

**Test scenarios:**
- On main→A→B with A unmerged, the loop selects A (fewest commits ahead), not main (Covers AC1).
- On a fresh non-stacked feature branch, the loop finds no positive-count ancestor → falls through to default merge-base (Covers AC2).
- A pushed-then-advanced current branch does not select `origin/<current>` as parent (Covers AC6).
- Two sibling branches tying at the same commit count set `TIE=1` → `confidence = ambiguous` (Covers AC9).
- A window containing two commits both tagged `U2` sets `warning = FOREIGN_UID_IN_WINDOW`, `confidence = low` (Covers AC5).

**Verify:** `grep -q '## Stack-Base Resolution Convention' commands/ba/execute.md && grep -q 'FOREIGN_UID_IN_WINDOW' commands/ba/execute.md && grep -q 'single owner of stack-base' commands/ba/execute.md`

> **Phase gate:** the owner section exists with its interface, guard token, and ownership statement → proceed.

---

### Phase 2: Git-first consumers (execute, handoff)

#### Changes Required

**File**: `commands/ba/execute.md`

##### U2 — Wire `/ba:execute` to consume `resolve-stack-base`; repoint `<base>`

- At Step 1 (before the `derive-state` call at `commands/ba/execute.md:73`), add a `resolve-stack-base(git)` call once, early. Thread its `base` into the resume read: `derive-state(plan, git, run_verify: true, base: r.base)` — `derive-state` gains an explicit `base:` argument (the caller now computes base once and passes it, rather than `derive-state` re-deriving). Surface `r.warning` when non-null. **Empty-window (per U1(b)):** when `r.window == ""`, execute must not construct `r.base..HEAD` (it would form `..HEAD`) — it skips tier-a and resolves every unit via the `Verify:` tier, surfacing the empty-window `low` warning.
- **Repoint the `<base>` definition** inside `## U-ID & Git-Derived State Convention`: **delete the entire `**<base> definition** (owned here; …)` paragraph** — all of `commands/ba/execute.md:162-178`, **including the leading `(owned here; …)` ownership label** — and replace it with a single one-line cite: "`<base>` is `resolve-stack-base(git).base`; base derivation and the degrade/abort ladder are owned by `## Stack-Base Resolution Convention`." (Deleting the label too is load-bearing: if the `(owned here)` label survives, the U-ID section would assert ownership of `<base>` in one sentence and cite a different owner in the next — the two-owner ambiguity. Ownership moves cleanly to the new section.) The `derive-state` subject-scan grammar (tier-a, `:123-139`) stays put and format-blind.
- **Anti-skip behavior** (resolves spec-flow C3, per user-confirmed decision): when `r.warning != null`, execute prints it; when `r.confidence == low`, execute must **not** trust `done-via-subject` verdicts and falls through to the `Verify:` tier. (`ambiguous` surfaces the warning + chosen parent but the narrowing is still valid, so subject-scan is trusted — the only trust fork is on `low`, per AC9.)
    - **"Affected units" scope**: because `confidence` is a resolution-level (not per-unit) field, `low` distrusts `done-via-subject` for **every unit in the resume window**, not only the specific duplicated `U<n>` — the conservative, safe-side reading (two colliding plans can duplicate several units at once). List the affected units.
    - **Commit-tag-only starvation** (resolves the error-handling finding): a unit with no code-matchable `Verify:` line is commit-tag-only (`derive-state` tier-b, `commands/ba/execute.md:143-144`: stays `pending` until its `U<n>` appears in a subject). Under `confidence == low`, tier-a is distrusted and tier-b has nothing to run — such a unit would read a bare `pending` and re-read `pending` on every future run while the low-confidence condition persists. Execute must surface a **distinct** signal for these units ("cannot verify — no `Verify:` line and subject-scan distrusted", not a plain `pending`), so the user knows it is "can't tell," not merely "not yet done," and can resolve the base (e.g. via `--base`) or re-tag.
- **Five-site walk** (resolves spec-flow Risk 2): this unit edits the *owned* U-ID convention section (relocating `<base>`, threading `base:` into `derive-state`), so the "update all five citation sites together" rule fires. State explicitly that the plan walked all five (plan.md, execute.md Step 2e, propose.md, handoff.md, review-plan.md) + the README:255 mirror: `plan.md`/`review-plan.md` reference neither `<base>` nor a based `derive-state` call → grammar-only, unaffected; execute/propose/handoff are edited in U2/U3/U4; README in U6.

**Test scenarios:**
- Resume on a stacked branch: parent-plan U-IDs are outside `r.base..HEAD` → read `pending`, not `done-via-subject` (Covers AC3).
- Resume with `confidence == low`: execute re-resolves the affected units via the `Verify:` tier instead of trusting the subject scan (Covers AC5).
- Non-stacked resume: `r.base` equals today's `merge-base HEAD origin/<default>`; behavior byte-identical (Covers AC2).

**Verify:** `[ "$(grep -c 'resolve-stack-base' commands/ba/execute.md)" -ge 2 ] && grep -Eq 'run_verify: true, base: r\.base|base: r\.base' commands/ba/execute.md`

**File**: `commands/ba/handoff.md`

##### U3 — Wire `/ba:handoff` (git-first, persist the warning)

- Update the `derive-state(plan, git, run_verify: false)` narration (`commands/ba/handoff.md:46-53`) to note that `<base>` comes from `resolve-stack-base(git)` (git-first — handoff passes **no** `host_signal`, zero host calls). The `run_verify: false` asymmetry citation (`:48`) stays pointing at the U-ID convention (it owns that asymmetry).
- **Empty-window (per U1(b)):** handoff must branch on `r.window == ""` before any `<base>..HEAD` construction — with no `Verify:` tier to degrade to, an empty base would otherwise make the subject-scan itself error (`..HEAD`) instead of reporting "all pending." On `r.window == ""`, narrate every unit as `pending` and record the empty-window `low` warning in the artifact (below).
- **Persist the warning** (resolves spec-flow I11): when `r.warning != null`, handoff surfaces it **and writes it into the handoff artifact** — since `run_verify: false` gives no `Verify:` backstop, a console-only warning is lost when the next session reads the document. The receiving session must inherit the uncertainty.
- Confirm the `<base>..HEAD` prose reference (`commands/ba/handoff.md:53`) stays coherent with the relocated `<base>` owner (resolves spec-flow Risk 1) — reword to cite `## Stack-Base Resolution Convention` for base derivation if needed.

**Test scenarios:**
- On a stacked branch, handoff narrates current-plan units as `pending` (parent-plan U-IDs excluded from the window) (Covers AC3).
- On a low-confidence resolution, the handoff document contains the warning text, not just a console line (Covers AC5).

**Verify:** `grep -q 'resolve-stack-base' commands/ba/handoff.md && grep -q 'warning' commands/ba/handoff.md`

> **Phase gate:** execute and handoff both consume `resolve-stack-base` and honor the guard → proceed.

---

### Phase 3: Host-signal consumer (propose)

#### Changes Required

**File**: `commands/ba/propose.md`

##### U4 — Wire `/ba:propose` (DIFF_BASE, deviation window, MR target, host_signal)

- **Step 2a** (`commands/ba/propose.md:137-147`): replace the inline `git fetch … / DIFF_BASE=$(git merge-base HEAD origin/$DEFAULT_BRANCH)` with `DIFF_BASE = resolve-stack-base(git, host_signal: open-mr-probe).base`, and set the MR/PR target from the same call's `target`. Define the **open-MR probe** callback: it reports whether a candidate ancestor branch has its own open PR/MR, reusing the host detection + open-PR probe already in Step 0a/0b (`gh pr view` / `glab mr view`, `commands/ba/propose.md:31-99`). Handle `window == ""` (resolves spec-flow I8): propose's Step 1 routing guarantees a valid branch/remote, so this is not expected — but if `resolve-stack-base` returns `window == ""`/`base == ""`, raise `CompositionInputError` rather than forming a `..HEAD` range.
- **Step 2f** (`commands/ba/propose.md:277`, resolves convention-checker **Violation 1**): the deviation-trailer scan still runs over the same `DIFF_BASE..HEAD` window (mechanics unchanged), **but** its ownership attribution — "this is the `<base>..HEAD` window owned by the `## U-ID & Git-Derived State Convention` section" — is now **stale** and must repoint to `## Stack-Base Resolution Convention` (which now owns `<base>`). This step is **not** "unchanged." Leave `commands/ba/propose.md:449` (U-tagged commit-subject grammar) pointing at the U-ID convention — the grammar stays there.
- **Step 5** (resolves spec-flow I10): both dispatch arms use `r.target` instead of `$DEFAULT_BRANCH` — `gh pr create --base "<r.target>"` (`commands/ba/propose.md:662`) and `glab mr create --target-branch "<r.target>"` (`:673`). The Step 5c **push** target (`origin/<current-branch>`) is correctly **unaffected**.
- **Arguments** (`commands/ba/propose.md:10-29`): document `--target <branch>` / `--base <ref>` as recognized overrides that flow into `resolve-stack-base` opts (win unconditionally for their field; the foreign-U-ID guard still runs).

**Test scenarios:**
- Stacked branch, parent A has an open MR: propose targets A (`--base A` / `--target-branch A`) and `DIFF_BASE` = merge-base with A → MR shows only this plan's commits (Covers AC4).
- Non-stacked branch: `DIFF_BASE` and target are byte-identical to today (`origin/<default>`) (Covers AC2).
- `host_signal` names A but git's count metric picked C: target = A, `confidence = ambiguous`, warning surfaced (Covers AC9).

**Verify:** `grep -q 'resolve-stack-base' commands/ba/propose.md && grep -q 'Stack-Base Resolution Convention' commands/ba/propose.md && grep -Eq 'r\.target|resolved target' commands/ba/propose.md`

> **Phase gate:** propose consumes `resolve-stack-base` for base + target and the Step 2f attribution is repointed → proceed.

---

### Phase 4: Reconciliation + citation-site / README / CLAUDE sync

#### Changes Required

**File**: `commands/ba/review.md`

##### U5 — Reconcile `/ba:review`'s inline detector

- Replace the inline nearest-ancestor loop (`commands/ba/review.md:148-163`) with consumption of `resolve-stack-base` for the **branch** case: use `r.base`/`r.parent` to set `MERGE_BASE`/`DIFF_RANGE`/`SCOPE_TYPE="branch"`. **Keep** the staged/recent-commit/`NO_CHANGES` fallbacks that follow (`:165-182`) — those are review's own scope selection for the non-branch cases and are **not** base resolution (resolves spec-flow I6). Note review.md's local-only `DEFAULT_BRANCH` ladder (`:133-142`) is superseded by `resolve-stack-base`'s canonical ladder.
- **`/ba:review` does not surface `warning`/`confidence`** — unlike execute/handoff/propose, it consumes only `r.base`/`r.parent` for a diff range; it does not resume execution or make a trust decision, so the anti-skip/warning-surfacing behavior does not apply. State this one-line exemption explicitly so a reader doesn't infer review was accidentally omitted from the warning-surfacing consumers.
- The Step 2 never-hide selection ledger and the protected-artifacts guard are **untouched** (explicitly out of scope).
- If reconciliation is instead deferred to fast-follow, record the temporary two-definition divergence explicitly (brainstorm Scope Boundaries) — but this plan delivers it as one unified change (brainstorm Key Decision "Deliver as one unified change").

**Test scenarios:**
- Reviewing branch B on main→A→B, `/ba:review` scopes the diff to A..B via `r.base` (not main..B) (Covers AC1, AC7).
- Reviewing with no branch (staged changes only): the staged/recent fallbacks still fire — review.md's non-branch behavior is unchanged (Covers AC8 fall-through semantics).

**Verify:** `grep -q 'resolve-stack-base' commands/ba/review.md && ! grep -q 'BEST_COUNT=999999' commands/ba/review.md`

**Files**: `README.md`, `CLAUDE.md`, `.claude-plugin/plugin.json`

##### U6 — Docs sync + version bump

- **README.md**: (1) `/ba:propose` description gains a line on stacked-branch target-branch + `DIFF_BASE` behavior (and a note on `/ba:execute`/`/ba:handoff` stacked-resume correctness) — the behavior-change README trigger (brainstorm Key Decision "README touch"). (2) Review `README.md:255` (the U-ID convention mirror) for staleness from relocating `<base>` — it does not name `<base>`, so it survives, but confirm deliberately (convention-checker **Violation 2**, gap 1). (3) Add a sibling mirror paragraph `### Stack-base resolution convention` next to `:255` for parity with the single-owner-pattern mirrors (Violation 2, gap 2).
- **CLAUDE.md**: document the `resolve-stack-base` owned operation (owned by `## Stack-Base Resolution Convention` in `commands/ba/execute.md`) with a "change all together" rule. **To prevent citation-list drift** (resolves the complexity finding): the new 4-site list (execute/handoff/propose/**review**) overlaps the existing U-ID five-site list (plan/execute/propose/handoff/**review-plan**) on 3 members and differs only at the edges — two near-identical prose bullets are a drift trap. Render both axes as **one table** in CLAUDE.md instead of two paragraphs: rows = the 6 files (plan, execute, handoff, propose, review, review-plan), columns = "U-ID axis" / "Stack-base axis", each cell marking membership + role. Membership differences (review vs review-plan; plan present on U-ID axis only) then read as an explicit ✓/— grid, not a careful two-paragraph diff. Keep the "any change updates all sites on that axis together" rule above the table. Confirm the plan.md/review-plan.md grammar-only status in a table cell.
- **.claude-plugin/plugin.json**: bump `version` from `0.32.0` (the auto-update cache key — every shipped change needs a bump).

**Test scenarios:**
- CLAUDE.md documents `resolve-stack-base` as an owned convention with a 4-site list distinct from the U-ID five-site list (Covers AC11).
- README `/ba:propose` mentions stacked target/base behavior; a sibling stack-base mirror paragraph exists (Covers AC11).
- plugin.json version is no longer `0.32.0` (Covers AC11).

**Verify:** `grep -q 'resolve-stack-base' CLAUDE.md && grep -q 'Stack-Base Resolution Convention' README.md && ! grep -q '"version": "0.32.0"' .claude-plugin/plugin.json`

> **Phase gate:** review reconciled, CLAUDE.md/README mirrors + 4-site list added, version bumped → done.

## System-Wide Impact

### Interaction Graph
`resolve-stack-base` is called once per command run, early: `/ba:execute` and `/ba:handoff` → `resolve-stack-base(git)` → `derive-state(…, base: r.base)`; `/ba:propose` → `resolve-stack-base(git, host_signal: open-mr-probe)` → Step 2a `DIFF_BASE` + Step 2f window + Step 5 target; `/ba:review` → `resolve-stack-base(git)` → branch-scope selection. The open-MR probe fires only inside propose's callback (host detection reused from Step 0a/0b).

### Error & Failure Propagation
Abort (fetch / final merge-base non-zero) is raised, never returned — it surfaces the git error and stops the command, exactly as the current `<base>` ladder does. Per-candidate failures inside the detection loop are swallowed (`|| continue`) so one bad ref never aborts resolution. `window == ""` propagates as: execute/handoff → empty subject-scan window + `Verify:` tier (confidence `low`); propose → `CompositionInputError` (never a `..HEAD` git syntax error).

### State Lifecycle Risks
Read-only w.r.t. working tree and `refs/heads`; the only writes are remote-tracking refs via `fetch` (pre-existing behavior). Idempotent — re-running yields the same resolution. No plan-file writes; progress stays git-derived.

### API Surface Parity
`derive-state`'s signature gains an explicit `base:` argument (owned in the U-ID section, edited in U2). All base-consuming sites (execute `<base>` + `derive-state`, propose Step 2a/2f/5, handoff reader, review detector) route through `resolve-stack-base`. Grammar-only sites (plan.md, review-plan.md) unchanged.

### Integration Test Scenarios
1. main→A→B, A unmerged, both with open MRs: `/ba:propose` on B targets A and shows only B's commits; `/ba:execute` resume on B reads B's units `pending` and A's units as out-of-window (not `done`).
2. Non-stacked feature branch: execute/handoff/propose/review all byte-identical to pre-change; zero new host calls in execute/handoff.
3. Colliding U-IDs (A and B both define U1–U3): with correct narrowing no duplicate appears in-window; with a too-far-back `--base` override, `FOREIGN_UID_IN_WINDOW` fires, `confidence = low`, execute falls to the `Verify:` tier.
4. Pushed-then-advanced branch: `origin/<current>` is not mis-selected as parent.
5. Offline (fetch fails): abort with the git error, not a silent empty window.

## Risk Analysis & Mitigation

- **Detection wrong → resume fix rides on it.** Mitigation: the fail-loud guard (`FOREIGN_UID_IN_WINDOW` → `confidence = low` → execute distrusts subject-scan; handoff persists the warning). This closes the silent-skip path **for the numeric-collision case** the guard detects (which is the #45 failure mode — colliding reused U-IDs). It does **not** catch a foreign plan whose U-IDs don't numerically overlap the current plan's (documented residual, AC5/U1(e)); that case relies on correct base **detection**, not the guard. The guard precedence rule (U1(d)) ensures a detected collision always resolves `low`, never `ambiguous`.
- **Citation-site drift** (the real exposure per convention-checker). Mitigation: the new 4-site list in CLAUDE.md + the five-site walk in U2; Step 2f attribution repoint (U4); README:255 review + sibling mirror (U6).
- **review.md two-definition divergence** if reconciliation slips. Mitigation: delivered in-scope (U5); the plan flags the deferral path explicitly if it must slip.
- **Stale remote refs.** Mitigation: fetch the chosen candidate's `origin/` ref before finalizing (U1 fetch policy).

## Testing Strategy

Prompt/convention change — no runtime unit tests. Verification is (a) each unit's `Verify:` grep against the edited `.md`/json files (code-matchable, read-only, wiring-level), and (b) the integration scenarios above, exercised manually against the stacked-branch repro topology (a child branch on an unmerged parent) post-merge (a stacked-branch topology can't be fully live-tested on this plan's own dev branch — consistent with the known post-merge-test pattern for consumer-of-plan changes).

## Documentation Plan

README `/ba:propose` (+ execute/handoff) stacked line + sibling stack-base mirror paragraph; CLAUDE.md new owned-convention bullet with its 4-site list; the owner section itself (`## Stack-Base Resolution Convention`) is the canonical documentation.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-07-07-stacked-workflow-support-brainstorm.md` — key decisions carried forward: window-narrowing (not grammar change) fixes #45; one shared owned operation with its own citation-site list; git-first for execute/handoff (host_signal only in propose); fail-loud guard live under overrides; `<base>` degrade/abort preserved verbatim. Locked hybrid design (B ergonomics + A guard).

### Internal References
- U-ID & Git-Derived State Convention + `<base>` + degrade/abort: `commands/ba/execute.md:86-178`
- Nearest-ancestor detector being absorbed: `commands/ba/review.md:148-163` (+ staged/recent fallbacks `:165-182`)
- propose base/target read sites: `commands/ba/propose.md:141`, `:277-280`, `:662`, `:673`; host/open-PR probe `:31-99`
- handoff reader: `commands/ba/handoff.md:46-53`
- README U-ID mirror: `README.md:255`
- Related issues: #45 (silent-skip resume collision), #47 (propose mis-scope/mis-target)

## Convention Compliance

- [x] Single-owner + citation-site pattern — aligned: `resolve-stack-base` is a new sibling owned section with its own CLAUDE.md bullet + 4-site list (convention-checker confirmed correct).
- [x] U-ID five-site rule — aligned: U2 edits the owned section (relocates `<base>`, threads `base:` into `derive-state`); the plan walks all five sites + README:255 mirror. `plan.md`/`review-plan.md` confirmed grammar-only (neither references `<base>` or a based `derive-state`).
- [x] README update trigger — aligned: `/ba:propose` behavior change → README touched; U-ID mirror reviewed; sibling stack-base mirror added (resolves convention-checker Violation 2).
- [x] Step 2f `<base>` attribution repoint — aligned: U4 repoints propose.md:277 to the new owner; propose.md:449 (commit-subject grammar) stays on the U-ID convention (resolves convention-checker Violation 1).
- [x] handoff:53 `<base>` prose coherence — aligned: U3 rewords to cite the relocated owner (resolves convention-checker Risk 1).
- [x] Code-shape decision label — aligned: one literal bash block in U1 under a `**Code-shape decision:**` label, anchored to review.md:148-163 + brainstorm Locked Design.
- [x] Protected-artifacts guard + never-hide ledger — aligned: explicitly out of scope for U5.
- [x] plugin.json version bump — aligned: U6 bumps from 0.32.0.
- [x] Naming — aligned: `resolve-stack-base` follows the `derive-state` verb-object style.
