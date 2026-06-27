---
date: 2026-06-26
topic: propose-deviation-rendering
status: approved
triage_level: standard
tags: [propose, deviations, u-id, mr-body]
---

# Reviewer-Facing Deviation Rendering in `/ba:propose`

## What We're Building
`/ba:propose` Step 2f gathers `Deviation (U<n>):` trailers from execute's per-unit
commits and Step 3 (row #13) renders them into the MR/PR `## Deviations` section —
today as "one bullet per `(u_id, text)`", mirrored to the Linear ticket. This change
makes that section **reviewer-facing**: it renders the trailer text only, with the
`U<n>` label stripped, and collapses duplicate-text trailers to a single bullet.

The fix is scoped to `commands/ba/propose.md` only. Execute's per-commit
`Deviation (U<n>):` trailer grammar and the U-ID convention it cites are the
git-derived-resume mechanism and are left untouched.

## Why This Approach
U-IDs are plan-scoped execute state. They live only in the plan file and commit
metadata — a reviewer reading the MR/PR body has no key to decode `U2/U4/U6`, so in
the body and Linear mirror they are pure noise. Worse, because `derive-state` is
per-unit, one conceptual deviation that recurs across three units produces three
trailers and renders as three bullets, inflating one issue into three.

Rejected alternatives (settled in brainstorm dialogue):
- **Keep `u_id` for fuzzy/near-identical merging** — rejected; bakes fuzzy matching
  into the composition contract and relies on semantic judgment. Exact-text dedup is
  deterministic and sufficient.
- **Scrub all `U<n>` tokens including in-prose mentions** — rejected; risks mangling
  legitimate text. Stripping the leading label only matches the trailer grammar.
- **Add a clarifying clause to execute.md** — rejected; execute.md's existing wording
  ("rolls these trailers up into the MR/PR body", "deviation-trailer rollup window")
  is already neutral and never claimed U-IDs reach the reader, so no change is needed.

## Key Decisions
- **Dedup strategy**: Step 2f drops `u_id` from the tuple and dedups on exact trailer
  text. `deviation_trailers` becomes a tuple of `(text,)`, deduped. Rationale: simplest,
  deterministic, no `u_id` reaches any rendered output.
- **Strip scope**: strip only the `Deviation (U<n>):` leading label; in-prose mentions
  (rare) are left as authored. Rationale: predictable, matches the trailer grammar.
- **Single-file scope**: `commands/ba/propose.md` only — execute.md untouched.
  Rationale: the U-ID grammar/convention is unchanged, so the 4-citation-site mirroring
  rule is not triggered; execute.md's wording is already accurate.

## Scope Boundaries
- NOT changing execute's `Deviation (U<n>):` per-commit trailer format or the U-ID
  commit-subject grammar — those are the resume mechanism.
- NOT touching execute.md (no wording change needed).
- NOT adding fuzzy/semantic dedup — exact-text only.
- NOT scrubbing in-prose U-ID mentions — leading label only.
- NOT rewriting the commit body — the label strip is strictly **render-side** (done
  in-memory during Step 3 composition). The `Deviation (U<n>):` token stays intact in
  the commit body so `derive-state`'s subjects-only scan (execute.md:90-92) is unaffected.

## Acceptance Criteria
- Step 2f description captures trailer **text only** (no `u_id` in the tuple) and dedups
  on exact text; the `(u_id, text)` example becomes `(text,)`.
- `CompositionInputs.deviation_trailers` is documented as a deduped tuple of `(text,)`.
- Row #13 renders the `## Deviations` section as one bullet per unique trailer text with
  the `U<n>` label stripped; no `U<n>` appears in the MR/PR body or the Linear mirror.
- Recurring identical-text trailers across multiple units render as a single bullet.
- All in-file examples/snippets that previously showed a `U<n>` in rendered output
  (Step 2f example at the `(u_id, text)` capture, the `CompositionInputs` illustration,
  the row #13 example) are updated to the U-ID-free, deduped shape.
- execute.md is unchanged.

## Open Questions
- (none — resolved in brainstorm dialogue)

## Convention Compliance
No violations. The central claim — that this change does **not** trigger the
U-ID four-citation-site mirroring rule because it touches propose's *rendering* of
trailers, not the U-ID grammar / anchor / `derive-state` — was confirmed correct.
Two warnings, both PASSes today, carried forward as plan-time guards:
- execute.md:292 ("rolls these trailers up into the MR/PR body") stays behavior-agnostic
  and needs no edit; confirm at plan time it is not tightened.
- Keep the label-strip strictly render-side (see Scope Boundaries) so it never tempts a
  commit-body rewrite that would break `derive-state`'s subjects-only scan.

## Next Steps
→ `/ba:plan` to create implementation plan
