---
title: Make /ba:propose render deviations reviewer-facing
type: fix
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-06-26
origin: docs/brainstorms/2026-06-26-propose-deviation-rendering-brainstorm.md
detail_level: minimal
tags: [propose, deviations, u-id, mr-body]
---

# Make /ba:propose render deviations reviewer-facing

`/ba:propose` renders the `## Deviations` section of the MR/PR body (and its Linear
mirror) from `Deviation (U<n>):` trailers as "one bullet per `(u_id, text)`". The
`U<n>` labels are plan-scoped execute state that a reviewer cannot decode — they live
only in the plan file and commit metadata — so in reviewer-facing output they are pure
noise. And because `derive-state` is per-unit, one deviation recurring across three
units produces three trailers that render as three bullets, inflating one issue into
three. This fix makes the section render trailer **text only** (label stripped),
deduped on exact text, scoped to `commands/ba/propose.md` only.

(see brainstorm: docs/brainstorms/2026-06-26-propose-deviation-rendering-brainstorm.md)

## Acceptance Criteria

- AC1: The rendered `## Deviations` section (MR/PR body and Linear mirror) contains no
  `U<n>` label — only reviewer-facing trailer text.
- AC2: Multiple trailers with identical text render as a single bullet, not one per
  execution unit.
- AC3: Differently-worded trailers each render as their own bullet (dedup is
  exact-text, not fuzzy).
- AC4: When no trailers exist, the section is omitted entirely (no empty header) —
  behavior unchanged.
- AC5: The `deviation_trailers` contract in Step 2f and `CompositionInputs` documents a
  deduped tuple of `(text,)` — no `u_id` field.
- AC6: `commands/ba/execute.md` is unchanged; the per-commit `Deviation (U<n>):` trailer
  grammar and `derive-state`'s subjects-only scan are untouched.

## What We're NOT Doing

- NOT changing execute's per-commit `Deviation (U<n>):` trailer grammar or the U-ID
  commit-subject convention (execute's git-derived-resume mechanism).
- NOT touching `commands/ba/execute.md` — its wording ("rolls these trailers up into the
  MR/PR body", "deviation-trailer rollup window") is already neutral and never claimed
  U-IDs reach the reader.
- NOT rewriting the commit body — the label strip is strictly **render-side** (in-memory
  during Step 3 composition). The `Deviation (U<n>):` token stays intact in the commit
  body so `derive-state`'s subjects-only scan (execute.md:90-92) is unaffected.
- NOT adding fuzzy/semantic dedup — exact-text only.
- NOT scrubbing in-prose `U<n>` mentions inside trailer text — leading label only.
- NOT changing the source-side trailer matching (the `git log … grep -E '^Deviation
  \(U[0-9]+\):'` at propose.md:270 and the near-match grammar at :277) — those read the
  unchanged commit-body trailers.

## Context

All edits are in `commands/ba/propose.md`. Three sites currently expose a U-ID in
rendered output or the composition contract:

- **propose.md:273-275** — Step 2f capture rule: "capture `(u_id, text)`" with example
  `deviation_trailers = ((u_id="U4", text="…"), …)`.
- **propose.md:297** — `CompositionInputs` field: `deviation_trailers # tuple of (u_id, text), possibly empty`.
- **propose.md:382** — Step 3 section-registry row #13: "render … as a `## Deviations`
  section, one bullet per `(u_id, text)`."

Sites that legitimately reference the U-ID source grammar and MUST stay unchanged:
propose.md:270 (gather grep), :277 (near-match grammar), :400 (U-ID-preservation note).

## MVP

### U1 — Strip U-ID and dedup deviations in propose.md rendering

Edit `commands/ba/propose.md` at the three rendered-output/contract sites so deviations
render reviewer-facing text only, deduped on exact text. Decisions per site:

- **Step 2f (lines 273-275)** — change the capture rule from `(u_id, text)` to capturing
  the trailer **text only** (the content after the `Deviation (U<n>):` label), deduped
  on exact text so recurring identical trailers collapse to one entry. Update the example
  line from `deviation_trailers = ((u_id="U4", text="…"), …)` to a text-only,
  deduped form, e.g. `deviation_trailers = ("<what diverged and why>", …) or ()`. State
  explicitly that the `u_id` is read for matching but not carried into the tuple, and that
  the label is stripped at this gather step (render-side, never altering the commit body).

- **`CompositionInputs` (line 297)** — change the field comment from
  `deviation_trailers # tuple of (u_id, text), possibly empty` to
  `deviation_trailers # tuple of (text,), deduped on exact text, possibly empty`.

- **Row #13 (line 382)** — change "one bullet per `(u_id, text)`" to render one bullet
  per unique trailer text **with the `U<n>` label stripped** — the reader never sees a
  U-ID. Keep the existing parenthetical naming the *source* grammar (`Deviation (U<n>):`
  trailers over the `DIFF_BASE..HEAD` window) since that describes the input, not the
  output. Keep the Linear-mirror clause and the empty-section omission rule (AC4) intact.

No literal code block is warranted — these are prose-spec edits to a command document;
the new render rule re-derives unambiguously from the decisions above (no state machine,
ordering, or tricky shape). The brainstorm has no `## Locked Design` (it modifies an
existing command), so there is no signature to anchor.

Test scenarios:
- Two trailers with identical text → one bullet, no `U<n>` in the body or Linear mirror (Covers AC1, AC2)
- Two trailers with different text → two bullets, neither showing a `U<n>` (Covers AC1, AC3)
- Zero trailers → section omitted entirely (Covers AC4)
- `CompositionInputs` and Step 2f read as a deduped `(text,)` tuple with no `u_id` (Covers AC5)
- `commands/ba/execute.md` has no diff after the change (Covers AC6)

Verify: `grep -q 'label stripped' commands/ba/propose.md && ! grep -qE '\(u_id, text\)|u_id=' commands/ba/propose.md`

## Sources

- Origin brainstorm: docs/brainstorms/2026-06-26-propose-deviation-rendering-brainstorm.md
  — decisions carried forward: exact-text dedup with `u_id` dropped; strip leading label
  only; single-file scope (execute.md untouched); strip stays render-side.
- Edit sites: commands/ba/propose.md:273-275 (Step 2f), :297 (CompositionInputs), :382 (row #13)
- Must-not-touch: commands/ba/propose.md:270, :277, :400; commands/ba/execute.md:90-92, :292

## Convention Compliance

- [x] Frontmatter / plan_schema: 2 / origin / status comment — aligned
- [x] AC keying (AC1-AC6 monotonic, plan-owned, user-observable) — aligned
- [x] U-ID four-citation-site mirroring rule — not triggered (change is to propose's
  *rendering* of trailers, not the U-ID grammar/anchor/derive-state); verified correct
- [x] U1 `Verify:` line — code-matchable, read-only, source-state, falsifiable conjunction
- [x] Planning-commands-never-code — aligned (edits a markdown command spec, not source)
- [x] Code-shape-decision label — correctly omitted (prose-spec edits, no literal code)
- [x] Single-file scope + artifact path/naming — aligned
