---
title: /ba:propose — reviewer signals & apply-by-default
type: feat
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-propose-reviewer-friction-brainstorm.md
detail_level: standard
tags: [propose, reviewer-signals, proof, risk-tier, where-to-look, apply-by-default, deviations]
---

# /ba:propose — Reviewer Signals & Apply-by-Default Implementation Plan

## Overview

Six coupled changes to `/ba:propose` that (a) reduce interaction friction so the command
runs closer to fire-and-forget, and (b) add the two reviewer-facing signals from Addy
Osmani's *Code Review in the Age of AI* checklist that `propose` doesn't yet carry —
**proof-of-work** and **risk + review-focus** — without bloating the body. All edits are
confined to `commands/ba/propose.md` (Steps 0/2/3/4) plus doc-sync (`README.md`,
`CLAUDE.md`, `plugin.json`). No production code; this is a prompt-spec change.
(see brainstorm: `docs/brainstorms/2026-07-05-propose-reviewer-friction-brainstorm.md`)

## Current State

`commands/ba/propose.md` already ports Lynch's full section menu and the 2026-06-11
lean-body discipline (per-tier shape targets **3.1a**, "leave out" list **3.2a**, per-tier
overshoot warning **3.6**). Relevant anchors to be edited:

- **Frontmatter** `argument-hint` (`propose.md:4`) and the **Arguments** parse block (`propose.md:15-24`).
- **Step 0b** edit-only confirmation prompt (`propose.md:79-82`, the `ask "Nothing to push..."`).
- **Step 2e** — the *blocking* evidence HITL (`propose.md:250-263`), producer of the `evidence` input.
- **Step 2f** — deviation-trailer gather (`propose.md:265-279`); unchanged mechanism.
- **CompositionInputs** contract (`propose.md:289-298`) and **ComposedBody** outputs (`propose.md:302-308`).
- **Step 3.1a** shape targets (`propose.md:349-361`), **3.2** section registry (`propose.md:363-387`, row #13 Deviations at line 382, row #14 Screenshots/Demo at line 383), **3.6** size warning (`propose.md:430-439`), and the Lynch-order **invariant list** (`propose.md:320`).
- **Step 4** the `Apply?` `AskUserQuestion` gate (`propose.md:470-479`).

Doc-sync surfaces: `README.md:183` (heading + arg-hint), `README.md:191` (Deviation-rollup
bullet — describes the `## Deviations` section being removed), `README.md:197`
(preview-then-confirm-always bullet — no longer "always"); `CLAUDE.md:35` (propose
one-liner + arg-hint mirror); `.claude-plugin/plugin.json:3` (`0.30.0`).

`docs/solutions/` does not exist (Step 2c is dormant — unchanged). Issues #46/#48/#20 are
GitHub roadmap items (hubbed by #29), referenced only in brainstorms — reconciliation is a
ship-time issue update, not a repo-file edit (see Dependencies & Risks).

## Acceptance Criteria

- AC1: Running `/ba:propose` on a diff with **no** proof present asks **no** evidence question and renders a single `**Proof:** _pending — add tests / QA notes / screenshots before merge_` line; the old Step 2e blocking prompt is gone.
- AC2: A diff containing new/changed test files renders a one-line Proof pointer naming a test file (e.g. `**Proof:** unit-covered — orders_test.rb`); no CI status or raw test output appears in the body.
- AC3: Every non-typo run renders an un-headed `**Risk:**` lead-line (low/med/high + short reason) at the top of the body; it is absent at typo tier (absolute suppression, matching the brainstorm) and there is no `## For reviewers` wrapper header.
- AC4: A `## Where to look` section names 1–2 areas on medium+ diffs when a hotspot exists, and is omitted when there is no hotspot; it never repeats an area the Risk line already named.
- AC5: `/ba:propose` with no flags **applies without a confirmation prompt** for every ACTION; `--review` (alias `--interactive`) **or** `BA_PROPOSE_REVIEW=1` restores both the Step 4 menu and the Step 0b edit-only confirm.
- AC6: The apply-by-default flip touches **only** the Step 4 gate and the Step 0b edit-only confirm; the Step 5b hook-failure exit (never `--no-verify`), the Step 5c non-fast-forward `--force-with-lease` confirm, and the `describe_only` short-circuit are unchanged.
- AC7: No MR/PR body contains a standalone `## Deviations` header; reviewer-relevant deviation substance (when any) appears folded into the Impact prose with no "plan" reference and no `U<n>`.
- AC8: The `Deviation (U<n>):` commit trailer, the Step 2f gather, and the Linear-ticket rollup are unchanged; `execute.md` is unchanged (the 5-citation-site U-ID sync is **not** triggered — the fold is render-side only).
- AC9: A typical medium `execute`→`propose` body stays within the one-screen 3.1a target with the new sections present (verifiable via `--describe-only`); the always-on Risk/Proof lines and the `## Where to look` section are excluded from the 3.6 size budget.
- AC10: The `evidence` `CompositionInputs` field is removed; row #14 (Screenshots/Demo) keys only on `preserved_blocks`; the Proof "Visual" value is a pointer to the preserved `## Screenshots`/`## Demo` `<details>`, never an embedded dump.

## What We're NOT Doing

- **NOT** touching the `compose_body` contract's purity, the opaque-input philosophy, or the orchestrator's host-dispatch / branch-routing plumbing (synthesis-locked).
- **NOT** changing execute's `Deviation (U<n>):` trailer grammar, the `U<n>` commit-subject grammar, or `derive-state` — the resume mechanism is untouched; `execute.md` gets no edit.
- **NOT** pasting CI logs, test output, or the test files into the body (references, never dumps).
- **NOT** adding AI-role attribution or commit-splitting.
- **NOT** auto-trimming — the size signal still only warns; the user decides (unchanged).
- **NOT** making risk derivation clever/ML — it is a deterministic path+size+breaking heuristic.
- **NOT** making the apply gate risk-aware — apply-by-default is **unconditional** (user decision, 2026-07-05); the Risk line is display-only.
- **NOT** editing GitHub issues in this plan's code changes — issue-46/48/20 reconciliation is a ship-time issue update (Dependencies & Risks).

## Proposed Solution

Two surfaces change. On the **orchestration surface** (Steps 0b/4) the confirmation model
flips to apply-by-default with an `--review`/env opt-in. On the **composition surface**
(Steps 2/3) three new reviewer-routing elements are added and one is reshaped:

1. **Proof** — always-on one-line element, auto-detected from the diff, non-blocking (replaces the Step 2e prompt).
2. **Risk** — always-on un-headed lead-line at the top of the body, deterministically derived.
3. **Where to look** — earned `## Where to look` section at medium+ when a hotspot exists.
4. **Deviations** — the standalone `## Deviations` header is dropped; substance folds into Impact prose.

The design rule that keeps items 1–3 safe (from the brainstorm): **"always-on vs earned"
is one decision** — Risk and Proof are always-on (one line each, both **absolutely
suppressed at typo tier**, matching the brainstorm's load-bearing decision); Where-to-look
is earned (medium+). All new inputs (`proof`, `risk`, `focus_areas`) are **gathered in
Step 2 and passed across the pure seam**; the `compose_body` contract stays pure and the
"tier never named at call site" invariant is preserved. New sections are **Step 3.2
registry rows**.

**Shared classification fact (review: U4 DRY):** the "is this path sensitive / does this
diff look breaking" judgment is computed **once** in a Step 2 gather sub-step as
`sensitive_paths_touched` (the matched sensitive-class names) and `breaking_signal` (bool),
and **read by three consumers** — the existing Breaking-changes row #4, Risk (U4), and
Where-to-look (U5). No consumer re-derives it; this bounds the maintenance surface and
prevents the three heuristics from drifting apart.

**Determinism guard (spec-flow I4):** the Risk *level + reason* is materialized in Step 2
gather as a fixed string on `CompositionInputs` (`risk = (level, reason)`) — never
free-text model output generated inside composition — because it feeds a structured
lead-line that Step 5d's fetch-before-write re-composition must re-derive byte-identically.
The **deviation fold** (U6) is **not** pre-rendered in Step 2: Step 2f keeps its existing
job (capture raw, deduped trailer text), and the prose fold stays composition's job like
every other narrative section (Motivation, Impact), governed by composition's existing
determinism invariant. Pre-rendering the fold in gather would relocate a synthesis step
without simplifying anything.

## Technical Considerations

- **Heuristics are deterministic tables, not model judgment** (spec-flow I1/I2/I5). Risk-level derivation, sensitive-path classes (segment/word-boundary matched, not substring), and test-file globs are all specified as decision tables in the units below so re-derivation is stable and false positives are bounded.
- **Typo suppression is absolute (review: dropped C2 carve-out).** A one-line change classified as `is_typo` renders neither Risk nor Proof — matching the brainstorm's load-bearing decision. The plan review found the earlier sensitive-path carve-out reversed that approved decision for marginal value (`is_typo` is already so narrow — 1 file, ≤4 lines, pure string/comment, no operators/calls — that a qualifying change is almost never truly risky) while creating two internal contradictions. The residual (a rare sensitive one-line string flip shows no risk cue) is documented in Dependencies & Risks, not coded around.
- **`Proof: n/a` for no-runtime-surface diffs (spec-flow I6):** a docs-only / `*.md` / config-only change gets `**Proof:** n/a` rather than a shaming `pending`, so the line doesn't train authors to ignore it.
- **Purity check at the seam (convention W4):** Step 4's preview reads any new orchestrator-facing value **by name** (the `size_warning`/`rewritten_from` pattern), never via a composition side-channel.

## System-Wide Impact

- **Interaction graph**: the apply-by-default flip removes the Step 4 human checkpoint between invocation and public side effects (commit authored, branch pushed, PR/MR created or overwritten). The `describe_only`, Step 5b hook-failure, and Step 5c force-push confirmations remain as independent guards (AC6).
- **Error propagation**: unchanged — `CompositionInputError` is still raised only by Step 2; composition does not raise. Proof/Risk/focus gather steps must not raise (empty/unreadable → safe defaults: `proof=pending`, `risk` still derivable from size, `focus_areas=()`).
- **State lifecycle risks**: `edit_only` now silently overwrites a live PR description with zero confirmation by default (accepted per user decision; documented residual). The Step 5d fetch-before-write re-composition still guarantees preserved blocks survive; determinism guard above keeps preview ≈ publish for the new lines.

## Implementation Approach

**File**: `commands/ba/propose.md` (all units except U7's README/CLAUDE.md/plugin.json edits)

### U1 — `--review`/`--interactive` flag + `BA_PROPOSE_REVIEW` env var

Add flag parsing to the **Arguments** section (`propose.md:19-24`) and update the frontmatter
`argument-hint` (`propose.md:4`). Decisions:

- Recognize `--review` (alias `--interactive`) as a stripped flag alongside `--describe-only`/`--issue`.
- Recognize `BA_PROPOSE_REVIEW=1` env var (set-once-in-profile) as an equivalent persistent opt-in.
- **Semantics are OR, not AND** (spec-flow C1): `REVIEW_MODE = (--review present) OR (BA_PROPOSE_REVIEW is set to a non-empty, non-`0` value)`. A flag alone must **never** be silently ignored — silently dropping an explicit safety opt-in on a now-irreversible command is the worst failure mode. `BA_PROPOSE_REVIEW=0` and empty are treated as unset.
- `argument-hint` becomes `"[--describe-only] [--review] [--issue <ID>] [optional: free-text hint]"`.
- `REVIEW_MODE` is orchestrator-side run-local state (alongside `ACTION`, `HOST`); it never enters `CompositionInputs`.

Test scenarios:
- `/ba:propose --review` sets `REVIEW_MODE=true`; the free-text hint after stripping is unchanged (Covers AC5)
- `--interactive` behaves identically to `--review` (Covers AC5)
- `BA_PROPOSE_REVIEW=1` with no flag sets `REVIEW_MODE=true`; `BA_PROPOSE_REVIEW=0` does not (Covers AC5)

Verify: `grep -c -- '--review' commands/ba/propose.md` returns ≥2 (Arguments parse **and** Step 4/0b consumer) AND `grep -Eq 'argument-hint:.*--review' commands/ba/propose.md` AND `grep -q 'BA_PROPOSE_REVIEW' commands/ba/propose.md`

### U2 — Apply-by-default (unconditional)

Flip the default in **Step 0b** (`propose.md:79-82`) and **Step 4** (`propose.md:470-479`):

- **Step 4**: when `REVIEW_MODE` is false (default), skip the `Apply?` `AskUserQuestion` and proceed straight to Step 5. The preview block still **prints** (observability) — it becomes a receipt, not a gate. When `REVIEW_MODE` is true, present the existing Apply / Edit body / Regenerate / Exit menu unchanged. The `describe_only` short-circuit is untouched (prints and exits before any menu).
- **Step 0b**: the `ask "Nothing to push. Update the PR description only?"` edit-only confirmation is auto-confirmed to `ACTION=edit_only` when `REVIEW_MODE` is false; it is asked (current behavior) only when `REVIEW_MODE` is true.
- **Preserve independent guards (convention W1 / spec-flow C4):** state explicitly in the edited steps that this flip changes only these two confirmations. The Step 5b hook-failure surface-and-exit (never `--no-verify`), the Step 5c non-fast-forward `--force-with-lease` confirmation, and the `describe_only` short-circuit are unaffected.

**Documented residual (spec-flow C3/C4/I3):** with no gate, a mis-composed title/body ships to a public PR before a human reads it, and `edit_only` overwrites a live PR description with no abort point. Accepted per user decision (fire-and-forget); mitigation is `--describe-only` (dry run) or `--review` for risky work. Recorded in Dependencies & Risks.

Test scenarios:
- `commit_push_create` with no flags proceeds through Step 5 without an Apply prompt (Covers AC5)
- `edit_only` with no flags auto-confirms in Step 0b and edits the PR description without a prompt (Covers AC5)
- `--review` restores the Step 4 menu and the Step 0b edit-only confirm (Covers AC5)
- A commit hook failure under apply-by-default still surfaces the hook output and exits without `--no-verify` (Covers AC6)

Verify: `grep -c 'BA_PROPOSE_REVIEW' commands/ba/propose.md` returns ≥2 (Arguments **and** the Step 0b/Step 4 consumers) AND `grep -q 'force-with-lease' commands/ba/propose.md` AND `grep -q -- '--no-verify' commands/ba/propose.md` (Step 5b/5c safety guards still present)

### U3 — Proof section (replace Step 2e; retire `evidence`)

Replace the blocking evidence HITL at **Step 2e** with a non-blocking Proof gather, add a
`proof` field to `CompositionInputs`, add a Proof registry row, and **remove** the now-dead
`evidence` field.

- **Step 2a extension (review: U3 change-amplification):** `--numstat` gives line-count deltas per path but **not** add/modify/delete status, so a deleted test file can't be distinguished from a modified one. Add `git diff --name-status "$DIFF_BASE..HEAD"` to Step 2a's gather block and capture it as `diff.file_status`; Proof detection reads it to exclude deletions. (Step 2a is the one existing anchor this unit *extends* rather than only reads.)
- **New Step 2e (Proof detection — non-blocking, no question):** scan `diff.file_stats` + `diff.file_status` and derive `proof`:
  - **Automated** — one or more test files with `A`/`M` status in `diff.file_status` (deletions excluded) → `proof = ("automated", "<first test file path>")`. Test-file globs (spec-flow I5): a path matching `*_test.*`, `*.test.*`, `*_spec.*`, `*.spec.*`, `test_*.*`, or under a `test/`, `tests/`, `spec/`, or `__tests__/` segment. Presence only — quality is not asserted (documented caveat: a weakening diff still trips this).
  - **Visual** — `preserved_blocks` contains `demo`/`screenshots` → `proof = ("visual", <pointer to the Screenshots/Demo section>)`. A pointer, not an embed (references, never dumps).
  - **n/a** — no runtime surface: every changed path is docs (`*.md`, `docs/`) or config-only → `proof = ("na", None)`.
  - **pending** — otherwise → `proof = ("pending", None)`.
  - `Manual` (repro/QA notes) is **non-materializing** (review: U3): no gather ever sets `proof.kind = manual`. It exists only as help/prose vocabulary describing what a human may add by hand via the `--review` Edit-body path — it is **not** a code-representable `proof` value. Do not wire a `manual` code path or registry branch; the enum below omits it.
- **CompositionInputs**: add `proof # (kind, pointer) — kind ∈ {automated, visual, na, pending}` (no `manual` — see above). **Remove** `evidence` (its only producer, the 2e prompt, is gone — spec-flow C3).
- **Registry (Step 3.2)**: add a **Proof** row as **row #15** (Lynch numbers are identifiers, not positions — existing rows already carry a #5 gap; new rows take the next free numbers and declare their render position separately). Activates at `small` (i.e. every non-typo tier, absolutely suppressed at typo), required input none (always renders), body rule renders one compact line by kind:
  - automated → `**Proof:** unit-covered — <test file>`
  - visual → `**Proof:** screenshots below` (pointer to the `<details>` from row #14)
  - na → `**Proof:** n/a`
  - pending → `**Proof:** _pending — add tests / QA notes / screenshots before merge_`
  Placement: after the testing rows (#9/#10), before What-I-learned (#11); standalone line when those rows are absent.
- **Rekey row #14** (Screenshots/Demo, `propose.md:383`): drop the `evidence` OR-clause; the row now keys on `preserved_blocks` containing `demo`/`screenshots` only. The `<details>` wrapper and Step 3.4 splice are unchanged.

**Accepted tradeoff (spec-flow C3):** a net-new user-visible PR no longer has a proactive
screenshot-capture prompt — Visual proof comes from `preserved_blocks` (edit path) or, later,
issue-20's auto-capture. Consistent with fire-and-forget; recorded in Dependencies & Risks.

Test scenarios:
- A diff touching `orders_test.rb` renders `**Proof:** unit-covered — orders_test.rb`, no CI/test output (Covers AC2)
- A diff with no tests and a runtime surface renders the single `**Proof:** _pending…_` line, no question asked (Covers AC1)
- A docs-only diff renders `**Proof:** n/a` (Covers AC1)
- Editing a PR whose body has `## Screenshots` renders `**Proof:** screenshots below` pointing at the preserved `<details>`, not an embed (Covers AC10)

Verify: `grep -c -i 'proof' commands/ba/propose.md` returns ≥3 (Step 2 gather producer **and** `CompositionInputs` field **and** registry row) AND the contract no longer lists an evidence field (`! grep -q 'evidence.*tuple of (kind, raw)' commands/ba/propose.md`)

### U4 — Risk lead-line

Add a Step 2 risk-derivation gather, a `risk` field on `CompositionInputs`, and a Risk
lead-line registry row rendered as the first line of the body.

- **Shared-fact gather sub-step (review: U4 DRY) — runs first:** materialize `sensitive_paths_touched` (matched sensitive-class names, possibly empty) and `breaking_signal` (bool, reusing row #4's API-removal/schema-change detector) **once** in Step 2, before the Risk and focus-area sub-steps. **Sensitive path classes** (segment/word-boundary match, **not** substring — spec-flow I2, so `AuthorList.tsx` does not match `auth`): payments (`payment`, `billing`, `charge`, `invoice`), auth (`auth`, `session`, `token`, `login`, `credential`, `password`), migrations (`migrate`, `migration`, `schema`, `db/`), security (`crypto`, `secret`, `permission`, `acl`, `security`). Row #4 (Breaking), Risk (U4), and Where-to-look (U5) all **read** these two values — none re-derives them.
- **New Step 2 sub-step (Risk derivation — deterministic):** materialize `risk = (level, reason)` from `sensitive_paths_touched` + size + `breaking_signal`. Level table (first match wins) — combine as `max(path_risk, size_risk, breaking_risk)`; the `reason` names the dominant contributor (spec-flow I1):

  | level | condition |
  |---|---|
  | high | `breaking_signal` is true OR `sensitive_paths_touched` is non-empty |
  | medium | `large` tier by size, OR a sensitive-adjacent path with notable size |
  | low | otherwise |

  Reason string is drawn from `sensitive_paths_touched` / the breaking signal (e.g. `medium — touches auth, DB migration`). Materialized as a fixed string (determinism guard).
- **CompositionInputs**: add `risk # (level, reason) — level ∈ {low, medium, high}; materialized string`.
- **Registry (Step 3.2)**: add a **Risk lead-line** row as **row #16** (renders at the top, above Impact #2). Activates at `small` (every non-typo tier); **absolutely suppressed at typo tier** (no carve-out — matches the brainstorm). Body rule: `**Risk:** <level> — <reason>` as an un-headed line, first line of the body. No `## For reviewers` wrapper.

Test scenarios:
- A medium diff touching `app/auth/session.rb` + a migration renders `**Risk:** high — touches auth, DB migration` as the first body line (Covers AC3)
- A small docs diff renders `**Risk:** low — …`; no `## For reviewers` header anywhere (Covers AC3)
- A typo-tier diff (including a one-line string flip) renders **no** Risk line — typo suppression is absolute (Covers AC3)
- A path named `AuthorList.tsx` does not classify as auth-sensitive (Covers AC3)

Verify: `grep -c -i 'risk' commands/ba/propose.md` returns ≥3 (Step 2 gather **and** `CompositionInputs` field **and** lead-line registry row) AND `grep -q '\*\*Risk:\*\*' commands/ba/propose.md` AND `! grep -q 'For reviewers' commands/ba/propose.md`

### U5 — `## Where to look`

Add a Step 2 focus-area gather, a `focus_areas` field, and a `## Where to look` registry row.

- **New Step 2 sub-step (focus-area selection — deterministic) — runs after the shared-fact and Risk sub-steps:** materialize `focus_areas` (a tuple of 1–2 short strings) from diff hotspots. It reads the shared `sensitive_paths_touched` / `breaking_signal` fact (U4) and the already-materialized `risk` — hence the ordering constraint (shared fact → Risk → focus areas, all within Step 2). **Hotspot rule** (spec-flow M3): the top 1–2 files by churn (`additions + deletions` from `--numstat`) that also carry a breaking or sensitive signal, plus any breaking-change surface. **Dedup vs Risk basis** (review: U5): dedup on the **matched sensitive-class name** already named in `risk.reason` (e.g. drop a `payments/…` hotspot when `risk.reason` already says "touches payments") — not a raw-path string compare. If no file clearly dominates and no breaking/sensitive signal exists, `focus_areas = ()` (no hotspot).
- **CompositionInputs**: add `focus_areas # tuple of short strings, possibly empty`.
- **Registry (Step 3.2)**: add a **Where to look** row as **row #17** (renders after Impact/Motivation #2/#3, before Breaking changes #4). Activates at `medium`+ AND `focus_areas` non-empty. Body rule: a `## Where to look` section with 1–2 bullets naming each area. Per the brainstorm's header discipline, at `medium` with a single trivial area the content **may** fold into the impact prose instead of earning its own header; at `large` it always renders as the `## Where to look` section.
- **Step 3.1a / 3.6 rule (spec-flow I8; review: specify the computation):** the always-on Risk and Proof lines and the `## Where to look` section are **routing chrome**. Make 3.6 concrete: before comparing `body` length to the tier's char/line target, **subtract** the Risk lead-line, the Proof line, and the `## Where to look` section (heading + bullets) from the measured length — so mandatory chrome never self-triggers a small-tier overshoot warning. State this as a subtraction step in 3.6, not a bare "excluded" assertion.

Test scenarios:
- A medium diff with a dominant `payments/charge.rb` hotspot renders `## Where to look` naming it (Covers AC4)
- A medium diff with uniform churn and no sensitive/breaking file omits the section entirely (Covers AC4)
- An area already named in the Risk line is not repeated under `## Where to look` (Covers AC4)
- A small diff never renders `## Where to look` (Covers AC4)

Verify: `grep -c 'focus_areas' commands/ba/propose.md` returns ≥3 (Step 2 gather **and** `CompositionInputs` field **and** registry row) AND `grep -q '## Where to look' commands/ba/propose.md`

### U6 — Deviations reviewer-neutral fold

Reshape registry row #13 (`propose.md:382`) to render-side folding, and update the ordering
invariants. Step 2f gather and the Linear rollup are **unchanged**.

- **Row #13 rewrite**: drop the `## Deviations` header. When `deviation_trailers` is non-empty, fold any **genuinely reviewer-relevant** substance into the **Impact** prose (#2), rewritten in plain change terms with **no "plan" reference and no `U<n>`** — e.g. "reporting-skill left unedited on purpose; its `page_size: 50` is a legitimate large-page case." **Composition owns the fold** (review: U6): Step 2f keeps its existing job (capture the raw, deduped, U-ID-stripped trailer text); the prose fold happens in composition like every other narrative section (Motivation, Impact), under composition's existing determinism invariant. Do **not** pre-render the fold in Step 2 — that would relocate a synthesis step without simplifying anything. Non-reviewer-relevant trailers are simply not surfaced in the body.
- **Typo-tier behavior (spec-flow I7):** at typo tier there is no Impact section and Risk/Proof are suppressed — a deviation surfaces **nowhere** in the reviewer body; the durable `Deviation (U<n>):` commit trailer and the Linear rollup are the guarantee. State this explicitly.
- **Fold target correction (spec-flow I7):** the brainstorm named "Impact / What-changed" but there is no What-changed section and 3.2a bans a play-by-play. The fold target is **Impact (#2) only**; keep it to one clause so it does not bloat the one-sentence Impact.
- **Ordering updates (spec-flow M1; review: U6 change-amplification):** two order statements must be updated **consistently** — the prose Lynch-order **invariant list** (`propose.md:320`) and the numeric **3.2 ordering sequence** (`propose.md:385`). They use **different vocabularies** and are already partially mismatched today (320's prose lists concepts like "rants"/"tempted-to-explain" that have no numbered 3.2 row), so update each in its own vocabulary rather than assuming a 1:1 map: in both, remove `## Deviations` (#13) as a standalone section and insert Risk (top, above #2), the Proof line (near #9/#10), and `## Where to look` (after #2/#3). Verify the two lists agree after editing.
- **Unit-sequencing dependency (review: U6):** these ordering-invariant edits presuppose U3/U4/U5 have already added their registry rows (#15/#16/#17). Land **U6 after U3–U5** — since `/ba:execute` commits per unit, running U6's order edits before those rows exist would leave the invariant text referencing sections absent from the table in intermediate commits.
- **Render-side only (convention W2):** the `Deviation (U<n>):` trailer grammar, the Step 2f scan, `derive-state`, and `execute.md` are untouched — the 5-citation-site U-ID sync is **not** triggered (same basis as the 2026-06-26 rendering brainstorm; precedent commit `383922d` touched only `propose.md` + `plugin.json` + artifacts).

Test scenarios:
- A branch with `Deviation (U3): reporting-skill left unedited…` trailers renders no `## Deviations` header; the substance appears as a clause in the Impact prose with no `U3`/plan reference (Covers AC7)
- The `Deviation (U<n>):` commit trailer and the Linear ticket rollup are unchanged; `execute.md` is not edited (Covers AC8)
- A typo-tier diff with a deviation trailer surfaces it only in the commit trailer / Linear, not the body (Covers AC7)

Verify: `! grep -q '## Deviations' commands/ba/propose.md` (standalone header gone) AND `grep -q 'Deviation (U' commands/ba/propose.md` (Step 2f trailer scan + grammar reference preserved)

### U7 — Doc-sync (README, CLAUDE.md, plugin.json)

**File**: `README.md`, `CLAUDE.md`, `.claude-plugin/plugin.json`

- `README.md:183` heading → `### /ba:propose [--describe-only] [--review] [--issue <ID>]`.
- `README.md:191` "Deviation rollup" bullet (convention W3) → rewrite from "renders them as a `## Deviations` section" to the folded, header-less behavior (substance folded into Impact prose; commit trailer + Linear rollup unchanged).
- `README.md:197` "Preview-then-confirm always" bullet (convention W3) → rewrite to apply-by-default + `--review`/`BA_PROPOSE_REVIEW=1` opt-in.
- Add `README.md` bullets for the new command behaviors: Proof line, Risk lead-line, `## Where to look`.
- `CLAUDE.md:35` propose one-liner → add `--review` to the mirrored arg-hint.
- `.claude-plugin/plugin.json:3` → bump `version` `0.30.0` → `0.31.0` (the auto-update cache key — see memory `project_version_bump_is_autoupdate_cache_key`).

Test scenarios:
- README `/ba:propose` section documents `--review`, apply-by-default, Proof, Risk, and Where-to-look; no longer claims a `## Deviations` section is rendered (Covers AC5, AC7)
- `plugin.json` version is bumped past `0.30.0` (Covers AC5)

Verify: `grep -q '"version": "0.31' .claude-plugin/plugin.json` AND `grep -q -- '--review' README.md` AND `grep -q -- '--review' CLAUDE.md` AND `! grep -q 'renders them as a `## Deviations` section' README.md`

## Dependencies & Risks

- **Ship-time roadmap reconciliation (GitHub issues, not repo edits — convention W9):** per the roadmap convention (issues hubbed by #29), converge in issues, never a competing doc. In GitHub prose use the `issue-46` style, not the hash form (memory `feedback_github_hash_number_autolinks`):
  - **issue-46** — flip its proposed `--yes`/`BA_PROPOSE_YES` *opt-in* to reflect the shipped `--review`/`BA_PROPOSE_REVIEW` *opt-out* default.
  - **issue-48** — close/supersede (the Deviations fold drops the header, superseding the 2026-06-26 U-ID-strip-only fix).
  - **issue-20** (`/ba:prove`) — recommend closing as folded-in (subsumed as the Visual row of the Proof taxonomy), or narrowing to "auto-capture screenshots to fill the Visual row."
- **Documented residual — unreviewed public side effects (spec-flow C3/C4/I3):** unconditional apply-by-default ships a model-composed title/body to a public PR and silently overwrites `edit_only` descriptions with no gate. Accepted per user decision (2026-07-05, "Never ask"); mitigation is `--describe-only` / `--review`. May revisit if it misfires in practice.
- **Documented residual — net-new-UI-PR screenshot regression (spec-flow C3):** removing the Step 2e prompt means fresh UI PRs get no proactive screenshot capture; Visual proof comes from preserved blocks or issue-20 later.
- **Heuristic caveats (spec-flow I2/I5):** risk path-matching is a bounded heuristic that can still mis-signal on unusual repo layouts; test-file detection asserts presence, not quality. Both are deterministic and refinable later per the brainstorm's "refine if it misfires" stance.
- **Documented residual — sensitive one-line-typo blind spot (spec-flow C2, carve-out dropped at review):** a one-line string flip classified as `is_typo` in a sensitive path (e.g. `"user"→"admin"` under `app/auth/`) renders no Risk cue, because typo suppression is absolute (matching the approved brainstorm). Judged acceptable — `is_typo` is narrow enough that such changes are rare — rather than reintroduce the carve-out that reversed the brainstorm and created internal contradictions. Revisit only if it misfires in practice.
- **Live-test limitation:** prompt-only change — ships on a `--describe-only` dry-run per memory `feedback_ship_prompt_changes_on_dryrun`; a running session runs the old body until reload (memory `feedback_reload_plugins_stale_in_session`), so dry-run in a fresh session. Real-harness integration test deferred to the next slice.

## Convention Compliance

- [x] **Git-workflow-commands (never modify source outside staged diff)** — aligned. Editing `propose.md` is a command-definition change, not runtime file-touching; Step 5a explicit-path staging is out of scope.
- [x] **U-ID 5-citation-site sync** — aligned / **not triggered**. The Deviations fold (U6) is render-side only; the `Deviation (U<n>):` trailer grammar, `derive-state`, and `execute.md` are unchanged (confirmed against `execute.md` ownership + precedent commit `383922d`).
- [x] **README + CLAUDE.md update** — aligned; U7 hits the exact stale lines (README 183/191/197 + new bullets; CLAUDE.md 35).
- [x] **plugin.json version bump** — aligned; U7 bumps `0.30.0` → `0.31.0`.
- [x] **Planning-command-never-writes-code** — aligned; this artifact documents WHAT, no code.
- [x] **Composition pure-seam invariant** — aligned; `proof`/`risk`/`focus_areas` gathered in Step 2, passed across the seam; Step 4 preview reads new values by name; tier never named at call site.
- [x] **Public-safe artifact** — aligned; all examples are generic (`orders_test.rb`, `auth/session.rb`, `page_size: 50`).
- [x] **Plan code-shape-decision gate** — aligned; heuristics are expressed as decision tables (decisions), not literal code blocks — no `**Code-shape decision:**` label required.
- [x] **Artifact structured-metadata** — aligned; this `.md` plan carries `plan_schema: 2` frontmatter.
- [x] **Brainstorm typo-suppression (AC3 "Risk absent at typo tier")** — aligned; typo suppression is **absolute**, matching the brainstorm's load-bearing decision. (An earlier sensitive-path carve-out was dropped at plan-review — it reversed the approved decision for marginal value and created internal contradictions; the rare blind spot is a documented residual, not a coded exception.)

## Sources & References

- Origin brainstorm: `docs/brainstorms/2026-07-05-propose-reviewer-friction-brainstorm.md` — carried forward: proof default-on/non-blocking, risk un-headed lead-line, no `## For reviewers` wrapper, apply-by-default (unconditional), Deviations reviewer-neutral fold, anti-bloat as governing constraint.
- Current spec: `commands/ba/propose.md` (Steps 0b/2e/2f/3.1a/3.2/3.6/4; CompositionInputs/ComposedBody contract).
- Convention ownership: `commands/ba/execute.md` `## U-ID & Git-Derived State Convention`; precedent render-side commit `383922d`.
- Doc-sync surfaces: `README.md:183/191/197`, `CLAUDE.md:35`, `.claude-plugin/plugin.json:3`.
- Superseded/related brainstorms: `docs/brainstorms/2026-06-26-propose-deviation-rendering-brainstorm.md` (render decision superseded), `docs/brainstorms/2026-06-11-ba-propose-lean-body-brainstorm.md` (anti-bloat governing constraint).
