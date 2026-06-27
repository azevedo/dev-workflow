---
title: Bring /ba:review-plan up to parity with /ba:review
type: feat
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-06-25
origin: docs/brainstorms/2026-06-24-review-plan-parity-brainstorm.md
detail_level: comprehensive
tags: [review-plan, review, confidence-gating, ba-commands, prompt-engineering]
---

# Bring /ba:review-plan up to parity with /ba:review Implementation Plan

## Overview

`/ba:review-plan` has drifted behind `/ba:review`: it runs a cold multiselect menu over discovered reviewers and emits a flat Must-Address / Consider / Looks-Good summary, while `/ba:review` has gained a judged selection ledger, a confidence/severity ladder, and a `parse→validate→group→merge→gate→render` consolidation pipeline. This plan brings `review-plan` to parity in *mechanism* (ledger + pipeline + soft gate) while keeping it plan-native in *vocabulary* (Must-Address / Consider / Looks-Good, section/U-ID/AC anchors). It also makes `/ba:plan` auto-run a cheap, self-suppressing section-scoring pass at the end of planning so the value is captured without the user remembering to invoke review (see brainstorm: docs/brainstorms/2026-06-24-review-plan-parity-brainstorm.md).

This is a prompt-engineering change to two command markdown files plus four sync sites — no source code.

## Current State

- `commands/ba/review-plan.md:32–90` — Step 1 runs a mandatory external-reviewer Glob sweep across nine directories; `review-plan.md:52` carries a divergence note justifying the cold menu ("there is no diff to judge against").
- `commands/ba/review-plan.md:94–123` — Step 2 presents reviewers via a cold `multiSelect` menu (no judge, no ledger).
- `commands/ba/review-plan.md:147–204` — Steps 4–5 emit the flat Must-Address / Consider / Looks-Good summary and an apply-fixes menu with the spec-decision vs implementation-decision classification.
- `commands/ba/review.md:232–403` — the judge (2c), ledger presentation (2d), empty-set/never-dispatch invariants, and Adjust pick-list to port.
- `commands/ba/review.md:504–554` — Step 3 user-typed reviewer resolution (the only thing that makes an "Other" free-text reviewer work) — **absent** from review-plan today.
- `commands/ba/review.md:562–709` — the `parse→validate→group→merge→gate→render` pipeline to port; validator's `git ls-files` file-existence check (line 595) becomes "anchor exists in the plan."
- `commands/ba/review.md:445` — the reviewer-dispatch protected-artifacts guard to port.
- `commands/ba/plan.md:493–527` — Step 7 handoff menu; option 3 (`plan.md:512,520`) invokes `/ba:review-plan`. The auto-score pass slots in after the disk-write (`plan.md:501`), before the menu.
- `CLAUDE.md:15` (description), `:78` (never-hide ledger convention + sync clause), `:79` (protected-artifacts guard convention), `:81` (U-ID convention citation-site list); `README.md:109–118` (review-plan section, "discovery-based" + "two-bucket"), `:146` (review's ledger bullet, the model for review-plan's new bullet); `.claude-plugin/plugin.json` version `0.28.0`.

## Acceptance Criteria

Keyed `AC<N>` (monotonic from 1), plan-owned — minted here, tracking the brainstorm's acceptance criteria and the spec-flow findings.

- AC1: `/ba:review-plan` presents a judged ledger (`✓` selected / `○` set-aside, each with a one-line reason) over the 7 built-in reviewers, scored against plan sections, with every reviewer enumerated and an Adjust path that keeps all reviewers — and an "Other" free-text external — reachable. No reviewer is ever silently dropped.
- AC2: review-plan no longer runs the external-discovery Glob sweep; the divergence note at `review-plan.md:52` is removed, and the ledger footer carries **no** "no external reviewers found" discovery note (there is no discovery).
- AC3: Findings carry per-finding confidence `{0,25,50,75,100}`, are deduped/merged across reviewers, and pass a soft gate with per-tier floors (**Must-Address ≥ 50, Consider ≥ 75**; Looks-Good exempt); below-floor findings are surfaced in a Suppressed bucket, not lost.
- AC4: Findings anchor to a plan **section heading**, a `### U<n>` anchor, or a keyed `AC<n>` that exists in the plan; an anchor that does not resolve in the plan is dropped by consolidation and counted in a surfaced `dropped_off_plan` counter (the AC3 "not lost" promise is bounded to *resolvable* findings).
- AC5: `/ba:plan` auto-runs the section-scoring pass at the end of planning (Step 7, after disk-write); on a plan with **no weak sections** it dispatches zero reviewers, emits **zero AskUserQuestion widgets**, reports "no weak sections", and proceeds to the handoff menu; on **weak sections** it surfaces the ledger and asks before dispatching.
- AC6: The plan↔review-plan auto-invoke coupling has a declared **owner** (`review-plan.md`) and a **citation site** (`plan.md` Step 7), reconciled with the existing handoff-menu "Review plan" option; every auto-path branch (clean / weak-dispatched-and-resolved / weak-declined) converges on the Step 7 handoff menu.
- AC7: All keep-in-sync obligations are addressed: never-hide ledger gains `review-plan.md` as a sync site (`CLAUDE.md:78`); the protected-artifacts guard convention names both commands (`CLAUDE.md:79`); the "discovery-based"/"two-bucket" descriptions are updated (`CLAUDE.md:15`, `README.md:109–118`); review-plan is cited as a *consumer* of the U-ID/AC anchor grammar (`CLAUDE.md:81`); `plugin.json` is bumped to `0.29.0`.

## What We're NOT Doing

- **Not** porting `/ba:review`'s diff-capture, MR/PR fetch, `--persist`, posting-to-MR, authorship routing, or large-diff (>2000 line) warning — review-plan reviews a `.md`, not a code diff.
- **Not** porting `/ba:review`'s Step 5 verify-then-keep / auto-revert / baseline-test / bidirectional-reconciliation harness — there are no tests to run on a plan `.md`. review-plan keeps its existing plan-native apply-fixes menu.
- **Not** adding external-reviewer discovery to review-plan (Decision 2 removes it). A rare plan-relevant external stays reachable only via Adjust's "Other" free-text.
- **Not** introducing the four-level Critical/High/Medium/Low ladder — review-plan keeps Must-Address / Consider / Looks-Good (Decision 4).
- **Not** redefining the `### U<n>` / keyed-`AC<n>` anchor grammar — review-plan is a reader/consumer only (Decision 5). The U-ID grammar is owned by `execute.md`; the AC-key grammar by `plan.md`.
- **Not** auto-re-scoring after the user applies fixes to a plan on the auto path — the handoff-menu "Review plan" option is the manual re-loop (mirrors `/ba:review`'s manual "Re-run review").
- **Not** building the CE residual-work gate or tiered size-based escalation here — those map to *code* review (`/ba:review`).

## Proposed Solution

Rewrite `commands/ba/review-plan.md` so its Step 1–2 become a judge + ledger over the 7 built-ins (no discovery), its Step 3 ports built-in + user-typed dispatch with plan framing and the protected-artifacts guard, its Step 4 becomes the ported `parse→validate→group→merge→gate→render` pipeline re-keyed to plan anchors, and its Step 5 keeps the plan-native apply-fixes menu (extended to exclude Suppressed findings and to govern merged-finding spec/impl classification). Add an **auto-invoke entry contract** section to `review-plan.md` (owner), then insert a self-suppressing section-scoring pass into `plan.md` Step 7 that cites it. Finally, reconcile the four documentation sync sites and bump the version.

The auto path and the manual `/ba:review-plan` path share one engine but differ at the edges: the **empty-`✓` state is entry-point-conditional** — auto self-suppresses (zero widgets, proceed to menu); manual offers Adjust/Cancel (the user explicitly asked for a review).

## Technical Approach

### Architecture

- **One engine, two entry points.** review-plan.md is the engine and the owner of the auto-invoke contract. plan.md Step 7 is a consumer that invokes the engine in auto mode.
- **Plan-anchor grammar (the foundational decision).** A reviewer's bullet anchor is one of three forms, written verbatim as the bold token: a **section heading** (e.g. `**Overview**`), a `### U<n>` key (e.g. `**U3**`), or a keyed AC (e.g. `**AC2**`). Matching against the plan is **case-insensitive exact** on the normalized heading text / key string. A struck (`strike-don't-renumber`) `U<n>` does **not** resolve. Non-resolving anchors are dropped and counted in `dropped_off_plan`. This replaces review.md's `**<path>:<line>**` + `git ls-files` mechanism; line numbers do not appear (plans are edited freely and line anchors would rot).
- **Dedup fingerprint** = the normalized anchor string. A section heading and a `U<n>` nested under it are **distinct** fingerprints (different granularity, different anchor) — they do not merge.
- **Severity rank for merge/gate**: Must-Address (2) > Consider (1); Looks-Good is a separate bucket, exempt from anchor/confidence/gate (mirrors review.md's Looks-Good carve-out).

### Alternative Approaches Considered

- **Pure-inline review (couple plan generation to review, non-optional gate)** — rejected in the brainstorm: makes the gate mandatory and couples generation to review. The self-suppressing auto-score captures the value without the coupling.
- **Judge externals too (keep discovery, score them)** — rejected: externals are empirically never picked here and plans are code-light; paying the Glob sweep to surface reviewers nobody picks is speculative flexibility (YAGNI).
- **Fuzzy anchor matching** — rejected: fuzzy tolerance is unbounded and risks wrong merges. Case-insensitive exact on normalized heading/key, with a surfaced `dropped_off_plan` counter, keeps over-drop visible rather than silent.

## Implementation Phases

### Phase 1: review-plan.md engine rewrite

**File**: `commands/ba/review-plan.md`

##### U1 — Replace discovery + cold menu with judged section-scoring ledger

Rewrite Step 1 and Step 2. Delete Step 1b external discovery (the nine-directory Glob sweep, `review-plan.md:54–90`) and the "No external reviewers found in …" line (`:122`). Keep the 7 built-ins table. Port review.md's Step 2c judge (`review.md:281–314`) adapting the central question from *"Does this diff contain substantive work in this reviewer's domain?"* to **"Does this plan have a weak or risky section in this reviewer's domain?"** — score sections, target the weak ones. Carry over the five judge sub-rules (meaningful-work bar, overlap, uncertainty, reason quality, no-state) verbatim-in-spirit; **drop** the "uniform built-in/external pass" rule (no externals to judge). Port the ledger presentation (`review.md:316–341`) — full roster of 7 enumerated, `✓`/`○` with reasons that cite the **weak section** (for `✓`) or the **absent weak surface** (for `○`). Port the empty-set vs non-empty-set confirm branches and the **never-dispatch-empty-set** invariant (`review.md:347–402`), plus the Adjust pick-list with the "Other" free-text option. The ledger footer carries **no** discovery note (AC2). State the **entry-point-conditional empty-`✓`** rule as a named invariant: on the manual path an empty `✓` set offers Adjust/Cancel; on the auto path it self-suppresses (resolved in U6/U7).

Test scenarios:
- Running `/ba:review-plan` on a plan with one weak section shows a 7-row ledger with that reviewer `✓` and the rest `○`, each reasoned (Covers AC1)
- A user-typed "Other" name appears as a selectable Adjust option and is reachable (Covers AC1)
- review-plan contains no Glob discovery sweep and no "No external reviewers found" footer (Covers AC2)
- Deselecting all reviewers in Adjust routes to the forced Adjust/Cancel choice, never a silent run (Covers AC1)

Verify: `grep -q 'selection ledger' commands/ba/review-plan.md && grep -qi 'weak.*section\|section.*weak\|risky.*section' commands/ba/review-plan.md && ! grep -q 'Glob(' commands/ba/review-plan.md`

##### U2 — Define the plan-anchor grammar and bullet format

Add a grammar section (in the Step 3 dispatch instructions and the Step 4 parse rules) defining the three anchor namespaces — **section heading**, `### U<n>`, keyed `AC<n>` — and the literal bullet format reviewers must emit: `- **<anchor>** *(confidence: N)* — <body>` where `<anchor>` is a section heading text, a `U<n>` key, or an `AC<n>` key, and `N ∈ {0,25,50,75,100}`. State the matching rule: case-insensitive exact on the normalized heading/key; struck `U<n>` does not resolve; non-resolving anchors are dropped and counted in `dropped_off_plan`. The drop reason must distinguish **not-found** ("anchor names no heading/U-ID/AC-key in the plan") from **struck** ("anchor names a struck/superseded `U<n>`") so the surfaced counter message tells the reader which, rather than forcing a manual re-scan. State that review-plan **consumes** the `### U<n>` grammar (owned by `execute.md`) and the keyed-`AC<n>` grammar (owned by `plan.md`) — it does not mint or redefine them.

**Code-shape decision:** the anchor/confidence bullet grammar is a parser contract — a reviewer and the Step 4 parser must agree on it exactly, and re-deriving it from prose would plausibly produce a divergent token shape (line-numbered vs key-based) that the parser silently drops. The literal grammar lives in review-plan.md as the authority; it anchors to the brainstorm's Decision 5 (anchor = section heading + keyed anchors, consume-not-redefine) and to review.md's bullet grammar (`review.md:574`) it adapts.

Test scenarios:
- A reviewer bullet anchored `**U3**` on a plan that has a `### U3` resolves and is kept (Covers AC4)
- A reviewer bullet anchored to a non-existent section is dropped and reflected in the `dropped_off_plan` counter (Covers AC4)
- A bullet anchored to a struck `### U2` does not resolve (Covers AC4)

Verify: `grep -q 'U<n>' commands/ba/review-plan.md && grep -q 'AC<n>' commands/ba/review-plan.md && grep -qi 'section heading' commands/ba/review-plan.md && grep -qi 'dropped_off_plan\|does not resolve' commands/ba/review-plan.md`

##### U3 — Port the parse→validate→group→merge→gate→render pipeline (plan-native)

Replace Step 4's flat summary with the ported pipeline (`review.md:562–709`). Adaptations: (a) **parse** keys on `## Must Address` / `## Consider` / `## Looks Good` as the *native* headings (the four-level ladder, if a reviewer emits it, maps in as the foreign vocabulary: `Critical/High → Must Address`, `Medium/Low → Consider`); (b) **validate** replaces the `git ls-files` file-existence check with the U2 anchor-resolution check (drop + `dropped_off_plan`), keeps confidence snapping to `{0,25,50,75,100}`; (c) **group** by normalized-anchor fingerprint (U2); (d) **merge** keeps the `max(c_i>0) + 25×(count−1)` capped-at-100 promotion and severity-max over the 2-rung rank; (e) **gate** uses per-tier floors **Must-Address ≥ 50, Consider ≥ 75**, below-floor → `## Suppressed (low confidence)` bucket; (f) **render** the consolidated summary with header warning counters and the merged-finding attribution template. Looks-Good stays a separate exempt bucket.

**Surviving warning counters** (do **not** copy review.md's full counter block verbatim — most are diff/ladder-specific). Keep: `dropped_off_plan` (anchor did not resolve — not-found or struck, per U2), `dropped_no_fileline` → renamed `dropped_no_anchor` (malformed bullet, no parseable anchor), `coerced` (severity/body salvage), `snapped` (confidence snapped to nearest anchor), and `critical_suppressed` → renamed `must_address_suppressed` (a Must-Address finding fell below its floor — surfaced so high-stakes findings aren't buried). Drop: `legacy_format` / `mixed_format` (Must-Address/Consider **is** the native vocabulary here, not a legacy format — there is nothing to flag), `off_diff` and `dropped_file_not_in_repo` (no diff, no repo-file check).

Test scenarios:
- Two reviewers flag the same `U3` at confidence 50/50 → merged finding at confidence 75 (Covers AC3)
- A Consider-tier finding at confidence 50 lands in the Suppressed bucket, not lost (Covers AC3)
- A Must-Address finding at confidence 50 renders in the main section (floor 50) (Covers AC3)

Verify: `grep -qE 'parse *(→|->) *validate' commands/ba/review-plan.md && grep -q '0, 25, 50, 75, 100' commands/ba/review-plan.md && grep -qi 'Must-Address ≥ 50\|Must Address.*50' commands/ba/review-plan.md && grep -qi 'Suppressed' commands/ba/review-plan.md`

##### U4 — Port Step 3 dispatch: built-in + user-typed, plan-framed, with protected-artifacts guard

Rewrite Step 3 to dispatch each selected reviewer in its own subagent. Keep the existing built-in-vs-external dispatch convention (`dev-workflow:<name>` for built-ins; bare name for typed externals). Port review.md's **user-typed reviewer resolution** (`review.md:504–554`: normalize → match skill → match agent suffix → fall back to `general-purpose` custom dimension) so the Adjust "Other" path works — reframed from "review these code changes" to **"review this plan, not finished code."** Dedup a typed name against the already-selected built-in set (no double-dispatch). Embed the **protected-artifacts guard** verbatim from `review.md:445` in every dispatch template — load-bearing here because the reviewed plan lives under `docs/plans/`, itself a protected artifact; the guard's carve-out ("review changes/contents, never propose deleting/relocating") is what lets a reviewer flag plan content without proposing to move the plan. Dispatch every reviewer with the U2 anchor/confidence bullet contract. Two dispatch-instruction rules apply to **all** templates (built-in, skill, user-typed/"Other", custom dimension): (1) **native vocabulary** — instruct reviewers to emit `## Must Address` / `## Consider` / `## Looks Good` as the primary heading vocabulary; the parser accepts the four-level Critical/High/Medium/Low ladder only as a compatibility alias (U3), so without this instruction every reviewer defaults to code-review headings and every run needlessly exercises the fallback-mapping path; (2) **anchor specificity** — instruct reviewers to anchor each finding to the **most specific applicable key** (`U<n>` > `AC<n>` > section heading), because a section heading and a `U<n>` nested under it are distinct dedup fingerprints (U2/U3): two reviewers flagging the same concern at different granularity will not merge, silently losing corroboration lift.

Test scenarios:
- An "Other" typed name matching a skill dispatches as a skill-based reviewer with plan framing (Covers AC1)
- Every dispatch template instructs native Must-Address/Consider vocabulary and most-specific-key anchoring (Covers AC1, AC4)
- An "Other" typed name matching no skill/agent dispatches as a general-purpose custom-dimension reviewer (Covers AC1)
- No dispatched reviewer suggests deleting or relocating the plan file (Covers AC1)

Verify: `grep -q 'Protected artifacts' commands/ba/review-plan.md && grep -qi 'user-typed\|general-purpose' commands/ba/review-plan.md && grep -qi 'this plan, not finished code\|not finished code' commands/ba/review-plan.md`

##### U5 — Keep plan-native Step 5 resolution; exclude Suppressed; govern merged classification

Keep review-plan's existing apply-fixes menu (Apply all / Apply must-address only / Review one by one / Done) and the spec-decision vs implementation-decision classification (`review-plan.md:178–204`) — explicitly do **not** drag in review.md's auto-revert/reconciliation/baseline-test harness (no tests on a `.md`). Extend: (a) **Suppressed findings are excluded** from all apply options (surfaced for visibility only, mirroring `review.md:933`); (b) when a merged finding has contributing findings of mixed class, the merged finding is treated as a **spec decision** if *any* contributor is a spec decision (the stricter, safer classification); (c) add the applier-facing protected-artifacts note (`review.md:928–931`) — the applier may edit plan content but never apply a finding that deletes/relocates/renames the plan; (d) **caller-context-aware exit** — the resolution menu's "Done" must return control to the caller. When review-plan was invoked standalone (`/ba:review-plan`), "Done" ends the command as today. When invoked from the `/ba:plan` auto path (the auto-invoke contract, U6), "Done" returns control to `plan.md` Step 7's handoff menu rather than ending — this is the mechanism that honors U7's "→ proceed to the handoff menu". Without this hook the auto path strands in resolution and never shows the handoff menu.

Test scenarios:
- "Apply all" applies main-section Must-Address + Consider findings but skips Suppressed ones (Covers AC3)
- Resolution "Done" entered from the auto path returns to the Step 7 handoff menu; entered standalone it ends the command (Covers AC6)
- A merged finding with one spec-decision contributor is routed through the spec-decision resolution (decide-now / iterate), never written as an open question (Covers AC1)

Verify: `grep -q 'Spec decision' commands/ba/review-plan.md && grep -qi 'suppressed' commands/ba/review-plan.md && grep -qi 'applier' commands/ba/review-plan.md`

##### U6 — Declare the auto-invoke entry contract (owner) and remove the divergence note

Add an **## Auto-invoke contract** section to review-plan.md declaring how `/ba:plan` invokes the engine in auto mode and, critically, **how it signals the verdict back** (review-plan is invoked as a command, not a typed function — the channel must be explicit or two implementors will invent it differently). Define a verdict signal: the auto-mode pass ends by printing exactly one sentinel line — `[AUTO-SCORE: clean]` when the judge marks no section weak (empty `✓`), or `[AUTO-SCORE: weak — <reviewer list>]` otherwise — which `plan.md` Step 7 reads to pick its branch. The flow: run the section-scoring judge against the just-written plan; **clean** (empty `✓`) → emit zero widgets, print `[AUTO-SCORE: clean]` + a one-line "no weak sections" status, return control to the caller; **weak** (non-empty `✓`) → print `[AUTO-SCORE: weak …]`, surface the ledger and ask before dispatching; on dispatch, run the pipeline + resolution (U5), then return control to the caller via U5's caller-context-aware exit. State that review-plan **owns** this contract and plan.md Step 7 **cites** it. Delete the divergence note at `review-plan.md:52` (the ledger replaces the cold menu its rationale defended). Name review-plan.md as the new third sync site for the never-hide ledger convention (cross-reference, the CLAUDE.md/README edits land in U8/U9).

Test scenarios:
- review-plan.md declares an auto-invoke contract distinguishing the clean (zero-widget) and weak (ask-first) branches (Covers AC5, AC6)
- The divergence note is gone (Covers AC2)

Verify: `grep -qi 'auto-invoke' commands/ba/review-plan.md && grep -q 'no weak sections' commands/ba/review-plan.md && ! grep -q 'Divergence note' commands/ba/review-plan.md`

> **Phase gate:** All Phase 1 units reach `done` via `Verify:` or a U-tagged commit → automated checkpoint proceeds automatically. No manual pause.

---

### Phase 2: plan.md auto-run integration

**File**: `commands/ba/plan.md`

##### U7 — Insert the self-suppressing section-scoring pass into Step 7

Insert the auto-score pass into Step 7 **after** the disk-write (`plan.md:501`) and **before** the handoff-menu AskUserQuestion (`plan.md:505`). It cites review-plan.md's auto-invoke contract (U6) as the authority — it does not restate the judge/pipeline. Define the state machine explicitly so every branch converges on the existing handoff menu:

1. Write plan to disk (existing).
2. Run review-plan's section-scoring pass on the written plan (cite the contract); read the verdict from its sentinel line (U6: `[AUTO-SCORE: clean]` / `[AUTO-SCORE: weak …]`).
3. **Clean (`[AUTO-SCORE: clean]`):** **do NOT ask** — print a one-line "no weak sections — plan looks solid" status (no AskUserQuestion widget; a courtesy "proceed?" confirm here would violate AC5) → proceed to the handoff menu.
4. **Weak (`[AUTO-SCORE: weak …]`):** surface the ledger → ask before dispatching.
   - **User declines / cancels:** → proceed to the handoff menu.
   - **User dispatches:** run pipeline + resolution (apply fixes per U5; U5's caller-context-aware exit returns here) → proceed to the handoff menu.

Reconcile the handoff menu (AC6): keep option 3 but **relabel** it to a force-full-re-review (e.g. "Re-review plan (full pass)") and note that an auto-score pass already ran, so it no longer reads as a redundant first review. Update option 3's stale "(copy, complexity, tests, code review)" parenthetical (`plan.md:512`) — those described external discovery, now stripped. The embedded resolution edits only the plan `.md` (consistent with plan.md's "never write code" rule — editing a planning artifact, not code).

Test scenarios:
- Planning a clean plan emits zero AskUserQuestion widgets for the auto-score and proceeds straight to the handoff menu reporting "no weak sections" (Covers AC5)
- Planning a weak plan surfaces the ledger and asks before dispatching; declining returns to the handoff menu (Covers AC5, AC6)
- After a weak-plan dispatch-and-resolve, control returns to the handoff menu (Covers AC6)

Verify: `grep -q 'no weak sections' commands/ba/plan.md && test "$(grep -li 'auto-invoke\|section-scoring' commands/ba/plan.md commands/ba/review-plan.md | wc -l | tr -d ' ')" -ge 2 && grep -qi 're-review plan\|full pass' commands/ba/plan.md`

> **Phase gate:** Both files reference the contract (producer + consumer) → checkpoint proceeds.

---

### Phase 3: Documentation sync sites + version bump

##### U8 — CLAUDE.md: never-hide third mirror, guard names both commands, U-ID consumer cite, description

**File**: `CLAUDE.md`

Four edits: (1) `:15` — change the `/ba:review-plan` description from "Discovery-based plan review with available agents and skills" to reflect the judged ledger + confidence machinery over built-ins. (2) `:78` — the never-hide ledger sync clause must name `commands/ba/review-plan.md` as a third mirror site (alongside `README.md` and `review.md` Step 2). (3) `:79` — the protected-artifacts guard convention must name **both** `/ba:review` and `/ba:review-plan` as commands that dispatch with the guard. (4) `:81` — add `commands/ba/review-plan.md` to the U-ID convention's citation-site list as a **reader/consumer** (mirroring `handoff.md`, also a reader), and update the count from "all **four** citation sites" to "all **five** citation sites" — leaving a new reader off a list that explicitly enumerates readers is exactly the drift this plan fixes. (User decision: keep this edit, going one step beyond the brainstorm's "state that it consumes" obligation, and assert the count update in Verify.)

Test scenarios:
- CLAUDE.md:78's sync clause lists review-plan.md as a mirror site (Covers AC7)
- CLAUDE.md:79 names both review and review-plan (Covers AC7)
- CLAUDE.md:81 lists review-plan.md as a U-ID/AC grammar consumer and the citation-site count reads "five" (Covers AC7)

Verify: `grep -q 'never-hide convention is mirrored' CLAUDE.md && grep 'never-hide convention is mirrored' CLAUDE.md | grep -q 'review-plan' && ! grep -q 'Discovery-based plan review' CLAUDE.md && grep -q 'all five citation sites' CLAUDE.md && ! grep -q 'all four citation sites' CLAUDE.md`

##### U9 — README.md: replace discovery/two-bucket language with ledger + confidence

**File**: `README.md`

Rewrite the `/ba:review-plan` section (`README.md:109–118`): drop "discovery-based reviews" and the "Discovery-based — works with whatever review tools are installed" bullet; drop the "Must Address / Consider / Looks Good (the older two-bucket vocabulary)" line (`:118`). Add bullets describing the judged ledger over built-ins (model it on the review ledger bullet at `:146`), the confidence soft gate with per-tier floors, plan-section/U-ID/AC anchoring, and the auto-run-on-weak-sections behavior in `/ba:plan`. Keep "Auto-detects the latest plan" and "Plan-aware framing."

Test scenarios:
- README review-plan section no longer says "discovery-based reviews against a plan" or "older two-bucket vocabulary" (Covers AC7)
- README review-plan section describes the judged ledger and confidence gate (Covers AC7)

Verify: `! grep -q 'discovery-based reviews against a plan' README.md && ! grep -q 'older two-bucket vocabulary' README.md && grep -qi 'section-scoring\|weak section' README.md`

##### U10 — Version bump

**File**: `.claude-plugin/plugin.json`

Bump `version` from `0.28.0` to `0.29.0` (the auto-update cache key — every shipped change needs a bump; don't defer).

Test scenarios:
- plugin.json version reads 0.29.0 (Covers AC7)

Verify: `grep -q '"version": "0.29.0"' .claude-plugin/plugin.json && ! grep -q '0.28.0' .claude-plugin/plugin.json`

> **Phase gate:** All sync sites updated + version bumped → done.

## System-Wide Impact

### Interaction Graph
`/ba:plan` Step 7 → (new) auto-invoke → `/ba:review-plan` engine → 7 built-in reviewer subagents (parallel) → consolidation pipeline → resolution (edits the plan `.md`) → back to `/ba:plan` Step 7 handoff menu. The manual `/ba:review-plan [path]` entry hits the same engine without the plan.md wrapper.

### Error & Failure Propagation
A reviewer subagent that fails or returns empty is noted in the consolidation Coverage block and does not block others (existing behavior). A bullet with a non-resolving anchor is dropped at validate and counted in `dropped_off_plan` (surfaced in the header) — never silently lost in a way the user can't see. On the auto path, a failed pass must still hand control to the handoff menu (never strand `/ba:plan` without its menu).

### State Lifecycle Risks
review-plan writes **no** selection state (the judge is recomputed every run, per review.md's no-state rule). The only mutation is editing the plan `.md` during resolution. Applying fixes can shift/rename section headings mid-batch, invalidating a later finding's anchor in the same apply batch — apply order matters; re-validate anchors against the post-edit plan, and treat a residual mismatch as expected noise the user can dismiss (no auto re-score).

### API Surface Parity
Two commands now expose a judged ledger: `/ba:review` (code/diff) and `/ba:review-plan` (plan). The never-hide ledger convention (`CLAUDE.md:78`) and the protected-artifacts guard (`CLAUDE.md:79`) must name both — handled in U8.

### Integration Test Scenarios
1. Manual `/ba:review-plan` on a clean plan → empty `✓` → Adjust/Cancel offered (manual path), no silent run.
2. `/ba:plan` on a clean plan → empty `✓` → zero widgets, "no weak sections", straight to handoff menu.
3. `/ba:plan` on a weak plan → ledger surfaced → user declines → handoff menu (no dispatch).
4. Two reviewers corroborate the same `U<n>` → confidence promotion lifts a Consider finding past its floor (50→75), rendering in the main section instead of Suppressed.
5. A reviewer cites a section heading that was renamed by an earlier applied fix → anchor drops at re-validate, counted, surfaced.

## Risk Analysis & Mitigation

- **Risk: ported parser drops every finding** (plan anchors aren't `path:line`). *Mitigation:* U2 pins the literal anchor token + matching rule as a Code-shape decision; integration scenario 1/5 exercise resolve + drop.
- **Risk: empty-`✓` handling collapses to one behavior and breaks the other path.** *Mitigation:* U1 names the entry-point-conditional invariant; U7 makes the auto path self-suppress explicitly; integration scenarios 1 & 2 are the two opposite behaviors.
- **Risk: auto path strands `/ba:plan` without its handoff menu.** *Mitigation:* U7 state machine makes every branch converge on the menu; integration scenario 3.
- **Risk: handoff-menu option 3 reads as a redundant second review.** *Mitigation:* U7 relabels it to a force-full re-review and notes the prior auto-score.
- **Risk: keep-in-sync obligations missed.** *Mitigation:* U8/U9/U10 enumerate all four sync sites + version; the convention-compliance section tracks each.
- **Risk: a "clean" auto-score is a judgment, not a deterministic guarantee.** The section-scoring judge can disagree run-to-run (model sampling), so `[AUTO-SCORE: clean]` does not prove the plan has no weak section. *Mitigation:* the Step 7 handoff menu's force-full re-review option (U7) is the deliberate manual re-loop for exactly this; the auto-score is a cheap first pass, not the last word.

## Testing Strategy

This is a prompt-only change; "tests" are the per-unit `Verify:` greps against the edited markdown plus a manual dry-run of both entry points (manual `/ba:review-plan` and `/ba:plan` auto-score) on a sample weak plan and a sample clean plan. Per repo convention, prompt-only changes ship on a dry-run; a real-harness integration test is not a merge gate.

## Documentation Plan

CLAUDE.md (U8) and README.md (U9) are updated as part of the change. The plugin version bump (U10) is the release marker.

## Sources & References

### Origin
- Brainstorm: docs/brainstorms/2026-06-24-review-plan-parity-brainstorm.md — Key decisions carried forward: hybrid command with self-suppressing auto-score (Decision 1), full-strip to built-ins (Decision 2), port the judged ledger + consolidation adapted to sections (Decision 3), plan-native severity + new confidence machinery (Decision 4), anchor = section heading + keyed anchors, consume-not-redefine (Decision 5).

### Internal References
- Judge + ledger to port: commands/ba/review.md:281–403
- Consolidation pipeline to port: commands/ba/review.md:562–709
- User-typed resolution to port: commands/ba/review.md:504–554
- Protected-artifacts guards: commands/ba/review.md:445 (dispatch), :928–931 (applier)
- plan.md Step 7 handoff menu: commands/ba/plan.md:493–527
- Sync sites: CLAUDE.md:15,78,79,81; README.md:109–118,146; .claude-plugin/plugin.json
- Convention authorities: never-hide ledger (CLAUDE.md:78), protected-artifacts (CLAUDE.md:79), U-ID grammar owner execute.md (CLAUDE.md:81), AC-key grammar owner plan.md templates

## Convention Compliance

- [x] **Planning command never writes code** — review-plan edits only the plan `.md`; the auto-score in plan.md edits only the plan `.md`. Documenting, not coding — aligned.
- [x] **Never-hide ledger gains a third mirror site** — U6 (review-plan.md) + U8 (CLAUDE.md:78, README.md) — aligned.
- [x] **Protected-artifacts guard ports + convention names both commands** — U4 (dispatch + applier guards) + U8 (CLAUDE.md:79) — aligned.
- [x] **Anchor grammar consumed, not redefined** — U2 states consume-only; U8 adds review-plan as a U-ID/AC consumer citation (CLAUDE.md:81) — aligned.
- [x] **New plan↔review-plan coupling has a declared owner + citation site** — U6 (owner: review-plan.md) + U7 (cite: plan.md Step 7), reconciled with the handoff menu (AC6) — aligned.
- [x] **Version bump** — U10 bumps plugin.json to 0.29.0 — aligned.
- [x] **"Discovery-based"/"two-bucket" descriptions updated** — U8 (CLAUDE.md:15) + U9 (README.md) — aligned.
- [x] **Justified override: full-strip of external discovery** — a deliberate, stated divergence from `/ba:review` (which keeps discovery). Justified: externals are never picked in review-plan and plans are code-light — aligned with brainstorm Decision 2.
