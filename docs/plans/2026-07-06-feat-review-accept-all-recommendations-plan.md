---
title: "feat: /ba:review — \"Accept all recommendations\" bulk action"
type: feat
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow; progress is git-derived
date: 2026-07-06
origin: docs/brainstorms/2026-06-28-review-accept-all-recommendations-brainstorm.md
detail_level: minimal
tags: [ba-review, resolution-menu, disposition, github-issue-43]
---

# /ba:review — "Accept all recommendations" bulk action

Replace the local-scope resolution-menu option **"Apply all fixes"** with **"Accept all
recommendations"** in `/ba:review` Step 5. Instead of a severity filter that mechanically applies
all Critical+High+Medium fixes, the new option runs each finding's **per-finding recommended
disposition** (the reviewer's fix-quality judgment: Apply / Skip / Modify) with no per-finding
confirmation — pausing only at recommended-Modify to collect the user's edit. It collapses the
N-prompt "Review one by one" walk to a single confirmation for the common case: *"I trust the
reviewer — do what it recommends."* GitHub issue #43. Prompt/control-flow change only — no new
schema, no new output format. (See brainstorm: `docs/brainstorms/2026-06-28-review-accept-all-recommendations-brainstorm.md`.)

## Acceptance Criteria

- AC1: The local-scope resolution menu (`review.md` Step 5, "For local scopes") offers **"Accept
  all recommendations"** in place of "Apply all fixes"; the other three options ("Apply Critical +
  High + Med-conf-100", "Review one by one", "Done") are unchanged, staying at the 4-option cap.
- AC2: Selecting it iterates the rendered (post-gate) findings with **no per-finding
  confirmation** — applies recommended-Apply silently, skips recommended-Skip silently, and pauses
  only at each recommended-Modify finding (using the identical per-finding walk widget) to collect
  the edit, then continues. Selecting the option is the sole confirmation (no up-front prompt).
- AC3: The recommended disposition a finding gets under "Accept all recommendations" is the **same**
  disposition the "Review one by one" walk would show for that finding — it is a per-finding
  property computed for every post-gate finding, read by both modes (still computed at presentation
  time; **no** new stored field on the finding schema).
- AC4: **Prior-revert-marked** (guard-resurfaced) findings are **deferred** (not applied) to a
  deliberate one-by-one walk — same as the confidence-filter bulk mode — and are surfaced as a
  distinct "Deferred" count, never folded into "Skipped".
- AC5: After the loop, the applied set (recommended-Apply + Modify edits) passes through the
  **existing** reconciliation + verify-then-keep guard, and the **protected-artifacts applier
  guard** is honored during silent apply (never applies a finding that deletes/relocates/renames a
  protected doc).
- AC6: A **compact post-guard summary** renders that reflects guard outcomes: applied / skipped /
  modified counts, plus any **resurfaced** (auto-reverted, now open) findings, **deferred**
  (prior-revert-marked) findings, and any **Critical/High skipped-by-recommendation** — each
  surfaced distinctly so a needs-attention item is never buried.
- AC7: The **own-MR fix-local sub-menu** shows "Accept all recommendations" (inherited via the
  "see For local scopes" pointer — no separate menu definition).
- AC8: The **own-MR top menu** shows "Accept all recommendations" as a direct,
  **precondition-gated** shortcut, **replacing** the top-menu "Fix Critical + High + Med-conf-100"
  shortcut; final menu is *Fix locally / Accept all recommendations / Walk one by one / Done* (still
  4 options). The confidence filter remains reachable via **Fix locally → sub-menu**.
- AC9: Every named cross-reference to the renamed option stays in sync (`review.md` guard entry,
  prior-revert-skip rule, reconciliation bulk line, SSOT-note enumeration, sub-menu pointer;
  `README.md` bullet), and `.claude-plugin/plugin.json` version is bumped.

## What We're NOT Doing

- No change to the **others'-MR posting menu** (discussion-only; shows no disposition recommendation).
- No new **disposition field** on the finding schema — the recommendation stays computed at
  presentation time.
- No change to the **confidence-filter behavior** itself (`Apply Critical + High + Med-conf-100`,
  `review.md:933`) — only its top-menu *own-MR shortcut* is dropped; the filter definition and
  sub-menu/others'-MR/README references are untouched.
- No change to the **guard's** reconcile / verify-then-keep logic.
- **No up-front manifest / preview prompt** before the silent apply. (SpecFlow suggested one; it is
  declined — the brainstorm's binding decision is single-confirmation, and the guard is the safety
  net for test failures.)
- No **headless / non-interactive** operation — that's roadmap item #10. This stays interactive.
- Do **not** touch `review-plan.md`'s separate "Apply all fixes" (`:515/:521/:553`) — different command.

## Context

**Target file:** `commands/ba/review.md` (Step 5: Resolution). Secondary: `README.md`,
`.claude-plugin/plugin.json`.

**Current structure (verified at plan-authoring time — re-confirm before editing, numbers drift):**
- Local-scope menu options at `review.md:849–852`; option 1 `Apply all fixes` (`:849`).
- Per-finding recommended-disposition definition currently lives **only inside** the "Review one by
  one" walk (`:865–869`).
- Resurfaced-finding + bulk-mode prior-revert-skip rule (`:871–874`; the literal string
  `Apply all fixes` is on `:873`).
- Post-apply guard: reconciliation `:882`, verify-then-keep `:897`, return-to-menu `:923`; guard
  entry list names `Apply all fixes` on `:877`; reconciliation bulk line on `:893`;
  protected-artifacts applier guard `:928–931`.
- Confidence-filter definition (SSOT) `:933`; SSOT note `:838–842` (referencing-sites enumeration
  on `:841`).
- Own-MR top menu `:975–988` (option 3 = "Fix Critical + High + Med-conf-100", `:982–987`);
  precondition list `:990`; 4-option-cap note `:994–996`.
- Sub-menu inheritance pointer `:1047–1048` (uses hyphenated "Apply-all").
- Only numeric cross-ref in the file: `:980` → "lines 854–869". Both U1(a)'s extraction (reshapes
  `:865–869`) and U1(c)'s insertion (after `:874`) affect this span, so U3 **replaces it with a
  named anchor** rather than re-deriving the line number.

**Key decisions carried from the brainstorm + SpecFlow resolutions:**
- Rename-not-add; keep the 4-option cap on both menus (see brainstorm Key Decisions).
- Recommendation is a **mode-independent per-finding property** (SpecFlow C1) — hoisted so accept-all
  can read it before/without a walk; no stored schema field (brainstorm).
- Modify-pause **reuses the walk's per-finding AskUserQuestion widget** (SpecFlow I1) — inherits the
  finding-context-inside-the-question rule, and the user may Skip-instead or Apply at the pause.
- Fixes apply **sequentially** as encountered (same as today's walk); the guard's existing
  sequential-shift tolerance (`:893–895`) covers anchor drift (SpecFlow I2) — no batch-collect.
- Summary uses **outcome buckets**, not process buckets, so a guard-reverted fix is a distinct
  *resurfaced/open* outcome and prior-revert-deferred + high-severity-skipped are never buried
  (SpecFlow C3/C4/I4; consistent with the repo's never-hide discipline).

**No `docs/solutions/` learnings exist**; auto-memory `feedback_review_apply_all_dispositions`
confirms the intent ("Apply all" must honor recommended dispositions).

## MVP

### U1 — Recommendation as a mode-independent property + local-scope "Accept all recommendations" option & flow

**File:** `commands/ba/review.md`

**(a) Hoist the recommended disposition to a mode-independent property.** The per-finding
recommended disposition (currently described only inside the "Review one by one" walk, `:865–869`)
must be stated as a property computed for **every rendered post-gate finding**, read by both the
walk and the new bulk mode. Keep it computed-at-presentation (a fix-quality judgment: clean
mechanical fix → Apply; taste call → Skip; needs-adjustment → Modify) — **do not** add a stored
field to the finding schema. Concretely (this edit needs the same anchor precision as U1(c), or
the invariant is only described, not made structurally true): **extract** the "Lead each finding
with a recommended disposition…" definition (`:865–869`) into its own short micro-heading —
**"Recommended disposition (per finding)."** — positioned **before** the `**"Review one by one"
flow:**` subsection (`:854`), so it is a *prior* shared definition. Then have **both** the "Review
one by one" flow **and** the new "Accept all recommendations" flow (U1(c)) **reference it by name**
("per **Recommended disposition (per finding)** above") rather than restating the Apply/Skip/Modify
rules. This is what makes AC3's "computed once, read by both modes" invariant true rather than a
prose claim, and it is enforced by U1's Verify below (a from-scratch restatement in the accept-all
subsection would not add the reference and would fail the grep count). **Boundary note:** because
this extraction shrinks the content inside `:865–869`, the `:980` cross-ref to the walk must be
re-derived by *content boundary*, not just line number — U3 converts it to a named anchor so it
cannot rot.

**(b) Rename the local-scope menu option (`:849`).**
- From: `1. **Apply all fixes** — Apply all Critical + High + Medium items with suggested fixes (Low excluded — nit/style is not auto-applied)`
- To (decision — exact label per brainstorm): `1. **Accept all recommendations** — Apply each finding's recommended disposition (apply recommended-Apply, skip recommended-Skip); pause only at recommended-Modify to collect your edit.`
- Leave options 2–4 (`:850–852`) unchanged.

**(c) Add an "Accept all recommendations" flow subsection.** Insert **after `:874`** (after the
prior-revert-skip rule) and **before the guard header `:876`** — this preserves the `:980` "lines
854–869" cross-ref (target is upstream of the insertion). Model it on the "Review one by one flow"
block. It must specify:
- Iterate the rendered (post-gate) findings in order, executing each finding's recommended
  disposition **without a per-finding confirmation**: recommended-Apply → apply the suggested fix
  silently; recommended-Skip → skip silently; recommended-Modify → **pause at this finding only**,
  presenting the **identical per-finding walk AskUserQuestion** (finding context inside the question
  text, recommended option first/pre-selected) so the user can Modify (describe the edit), Skip, or
  Apply; then continue.
- **Prior-revert-marked (guard-resurfaced)** findings are **skipped/deferred** (never auto-applied)
  — same as the confidence-filter bulk mode — and counted as **Deferred**, not Skipped.
- **Selecting the option is the sole confirmation** — no up-front prompt/manifest.
- If **every** finding is recommended-Modify, this degenerates into the per-finding walk (a pause at
  each) — acceptable, no special handling.
- The applied set (recommended-Apply + Modify edits) funnels through the **existing** post-apply
  guard (reconciliation + verify-then-keep, `:876–931`) **and** the **protected-artifacts applier
  guard** (`:928–931`) — the silent apply must never apply a finding that deletes/relocates/renames a
  protected doc. If the accepted set is empty (all Skipped/Deferred, or zero findings), the existing
  empty-set clause (`:879–880`) applies: apply nothing and return to menu — **but first emit the AC6
  Critical/High-skipped-by-recommendation callout** if any such finding was skipped, so a bare
  "nothing applied" cannot bury a blocking-severity skip (the empty-set clause predates AC6; the
  callout must fire on this path too, not only after a non-empty apply).
- **No dedicated mid-run abort** (matches the existing bulk modes). The loop has no separate
  "cancel" control — each recommended-Modify pause is a normal per-finding decision (the user may
  Skip there). The guard runs **once, after the loop**, not per finding: if the run is interrupted
  before it completes, the recommended-Apply fixes already applied stay in the working tree
  **unverified** — the same exposure window as today's sequential bulk apply, widened only by the
  Modify pauses. State this in the flow prose so the reader knows verification is end-of-loop; do
  not add a per-finding guard (out of scope — reuse the existing guard unchanged).
- **After the guard**, render a **compact post-guard outcome summary** — e.g.
  `Applied N · Skipped M · Modified K · Resurfaced R (open) · Deferred D`. It reflects guard
  outcomes: a fix the guard auto-reverted moves out of Applied/Modified into **Resurfaced (open)**;
  **Deferred** = prior-revert-marked findings sent to a deliberate walk; additionally **call out any
  Critical/High finding that was skipped-by-recommendation** so a blocking-severity skip is never
  buried. Omit zero-count buckets to stay compact.

**Code-shape decision:** none — this is prose in a markdown command file; describe the flow as
decisions, not literal code.

Test scenarios:
- Local review with mixed recommendations → recommended-Apply findings applied, recommended-Skip skipped, one recommended-Modify pauses for an edit, then guard runs and a compact summary shows. (Covers AC1, AC2, AC5, AC6)
- A finding shows the same recommended disposition whether reached via "Review one by one" or "Accept all recommendations". (Covers AC3)
- A guard-resurfaced (prior-revert-marked) finding is deferred, not applied, and appears under "Deferred" in the summary. (Covers AC4, AC6)
- A Critical finding the reviewer recommends Skip is not applied and is explicitly surfaced in the summary as skipped-by-recommendation. (Covers AC6)
- All-Modify review → pauses at every finding (degenerate walk); empty accepted set → "nothing applied", returns to menu. (Covers AC2)

Verify: `grep -qE '^\s*1\.\s+\*\*Accept all recommendations\*\*' commands/ba/review.md && grep -q '"Accept all recommendations" flow' commands/ba/review.md && [ "$(grep -c 'Recommended disposition (per finding)' commands/ba/review.md)" -ge 3 ]` (menu option present AND flow subsection present AND the shared **Recommended disposition (per finding)** definition is referenced from ≥2 call-sites beyond its single definition — i.e. the walk *and* the accept-all flow both point at it. A from-scratch restatement of the disposition rules inside the accept-all subsection would leave the count at 2 and fail, so this mechanically enforces AC3's "computed once, read by both" rather than trusting prose.)

### U2 — Sync the named mirrors of the renamed option within review.md

**File:** `commands/ba/review.md`

Rename each remaining literal `Apply all fixes` reference to `Accept all recommendations`, and trim
the SSOT-note enumeration + sub-menu pointer:
- `:873` (prior-revert-skip rule): `Apply all fixes` → `Accept all recommendations`.
- `:877` (guard entry list): `Apply all fixes` → `Accept all recommendations`.
- `:893` (reconciliation bulk line): `Apply all fixes` → `Accept all recommendations`.
- `:841` (SSOT note): drop `the own-MR menu option,` from the filter-referencing-sites enumeration —
  after U3 the own-MR top menu no longer names the filter. New clause reads: `…is the **single
  source of truth** for that predicate — the others'-MR posting menu and the README bullet reference
  it by name rather than restating it, so the filter lives in one place.` (The filter definition
  `:933` and its reachability via Fix locally → sub-menu are untouched.)
- `:1047–1048` (sub-menu pointer): the hyphenated `the same Apply-all / Critical+High+Med-conf-100 /
  one-by-one walk / Done options` → `the same Accept all recommendations / Critical+High+Med-conf-100
  / one-by-one walk / Done options`.

Test scenarios:
- The guard, prior-revert, and reconciliation prose all name "Accept all recommendations" so the bulk mode is still covered by those rules. (Covers AC9)
- The own-MR fix-local sub-menu pointer resolves to a menu whose first option is "Accept all recommendations". (Covers AC7, AC9)
- The SSOT note no longer claims the own-MR top menu references the filter, but still names the others'-MR posting menu and README. (Covers AC9)

Verify: `! grep -q 'Apply all fixes' commands/ba/review.md && ! grep -q 'the same Apply-all' commands/ba/review.md` (zero occurrences of the old option string anywhere in review.md — proves `:849/:873/:877/:893` all renamed — and the hyphenated sub-menu pointer is updated)

### U3 — Own-MR top-menu shortcut swap (replace confidence-filter shortcut with Accept all recommendations)

**File:** `commands/ba/review.md` (own-MR menu, `:975–996`)

- Replace top-menu option 3 "Fix Critical + High + Med-conf-100" (`:982–987`) with **"Accept all
  recommendations"** as a **direct, precondition-gated shortcut** that runs the local-scope
  accept-all flow directly (without opening the sub-menu) — analogous to how the old option 3 ran
  the filter directly. Its description points to the local-scope "Accept all recommendations" flow
  (U1) for semantics (recommended dispositions, Modify-pause, prior-revert deferral, guard,
  summary); if zero post-gate findings exist, mirror the sibling "No findings to walk." behavior and
  return to the menu.
- **Reorder** so the final own-MR top menu is: `1. Fix locally` / `2. Accept all recommendations` /
  `3. Walk one by one` / `4. Done` — still **4 options** (AskUserQuestion cap; the `:994–996` cap
  note remains valid and needs no edit).
- Update the precondition-failure list (`:990`): `Precondition failure for **Walk one by one** and
  **Fix Critical + High + Med-conf-100**:` → `Precondition failure for **Accept all recommendations**
  and **Walk one by one**:` (both direct-apply shortcuts stay precondition-gated; the "Post comment"
  fallback wording is unchanged).
- **Replace** the `:980` "Walk one by one" numeric cross-ref (`lines 854–869`) with a **named
  anchor** — e.g. "the same walk as **"Review one by one"** in the sub-menu (the *"Review one by
  one" flow* subsection above)". U1(a)'s extraction and U1(c)'s insertion both shift/reshape that
  span, so a line-number reference would rot; a named anchor can't. This removes the only numeric
  cross-ref in the file.

Test scenarios:
- On an own MR, the top menu shows exactly *Fix locally / Accept all recommendations / Walk one by one / Done*; "Fix Critical + High + Med-conf-100" is gone. (Covers AC8)
- Selecting "Accept all recommendations" on the own-MR top menu runs the precondition check first (aligned tree), then the accept-all flow directly. (Covers AC8)
- The confidence filter is still reachable via Fix locally → sub-menu. (Covers AC8)

Verify: `! grep -q 'Fix Critical + High + Med-conf-100' commands/ba/review.md && grep -q 'Precondition failure for \*\*Accept all recommendations\*\*' commands/ba/review.md` (the removed shortcut string is gone everywhere AND the new shortcut is wired into the precondition gate — producer menu-option + consumer precondition-list)

### U4 — Cross-doc sync: README bullet + plugin.json version bump

**Files:** `README.md`, `.claude-plugin/plugin.json`

- `README.md:174`: in the `/ba:review` "Fix application & own-MR resolution" bullet, update the
  hyphenated shorthand `apply-all` → `accept all recommendations`. From: `…apply fixes locally:
  apply-all, Critical + High + Med-conf-100, or a one-by-one walk…` To: `…apply fixes locally: accept
  all recommendations, Critical + High + Med-conf-100, or a one-by-one walk…` (Keep "Critical + High
  + Med-conf-100" — it still references the intact filter.)
- `.claude-plugin/plugin.json`: bump `"version": "0.30.0"` → `"0.31.0"` (auto-update cache key).

Test scenarios:
- README describes the current /ba:review resolution options with the new label. (Covers AC9)
- plugin.json version is incremented so the auto-update cache invalidates. (Covers AC9)

Verify: `grep -qi 'accept all recommendations' README.md && grep -q '"version": "0.31.0"' .claude-plugin/plugin.json` (both cross-doc sites updated)

## Sources

- Origin brainstorm: `docs/brainstorms/2026-06-28-review-accept-all-recommendations-brainstorm.md`
  — carried decisions: rename-not-add at the 4-option cap; plain "Accept all recommendations" label;
  reuse the computed per-finding recommendation with no stored field; single-confirmation silent
  loop pausing only at Modify; existing guard composition; own-MR top-menu shortcut swap; sync
  requirements (mirror renames, SSOT-note re-verify, plugin.json bump).
- GitHub issue #43 (referenced in the brainstorm).
- Related code: `commands/ba/review.md:838–1048` (Step 5 Resolution), `:933` (filter SSOT),
  `README.md:173–180`, `.claude-plugin/plugin.json`.
- Auto-memory: `feedback_review_apply_all_dispositions` (intent confirmation).

## Convention Compliance

- [x] Never-hide selection-ledger (Step 2) — unaffected; all edits are Step 5 resolution. The new
  summary's "surface skipped-by-recommendation / deferred distinctly" is consistent with never-hide.
- [x] Keep-in-sync ledger mirror (README / review.md Step 2 / review-plan.md Step 2) — untouched,
  stays consistent.
- [x] Protected-artifacts applier guard — explicitly honored during the U1 silent apply.
- [x] `Apply Critical + High + Med-conf-100` single-source-of-truth — filter definition (`:933`)
  untouched; only the SSOT-note *enumeration* trimmed; filter stays reachable via Fix locally.
- [x] `review-plan.md`'s separate "Apply all fixes" — out of scope, untouched.
- [x] plugin.json version bump — U4 (`0.30.0` → `0.31.0`).
- [x] README updated for changed command behavior — U4.
- [x] Planning command writes no code — plan edits command/README prose + a JSON version string; no
  production code, no literal code blocks.
