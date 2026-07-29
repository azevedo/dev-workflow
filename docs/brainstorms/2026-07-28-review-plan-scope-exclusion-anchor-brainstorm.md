---
date: 2026-07-28
topic: review-plan-scope-exclusion-anchor
status: approved
triage_level: standard
tags: [review-plan, scope-exclusions, cluster-review-quality, issue-66]
---

# Anchor `/ba:review-plan` resolution to the plan's own scope exclusions

## What We're Building

A short scope-anchor rule in `/ba:review-plan` Step 5 (the resolution menu and the one-by-one
walk) so that resolution reads the reviewed plan's own scope-boundaries section and treats a
remedy that re-enters a stated exclusion as a **scope-change conversation**, not a fix to apply.
For the plan author running `/ba:review-plan` — standalone or embedded via `/ba:plan` Step 7's
auto-score path.

Origin: GitHub issue #66, observed twice while planning #64 (2026-07-27, 2026-07-28). Measured
effect on the 2026-07-28 run: the plan grew 410 → 567 lines and 5 → 6 units entirely downstream
of review, and the added unit carries a defensive paragraph arguing against its own plan's
`## What We're NOT Doing` entry.

## Why This Approach

**The issue's premise needed correcting first.** #66 reports that review-plan "marked
(Recommended)" the scope-increasing option. It has no such mechanism: `commands/ba/review-plan.md`
contains one `recommend` hit (`:170`), about the Adjust pick-list default, not findings. Step 5
(`:510-518`) specifies only a flat four-option menu. The `(Recommended — Apply/Skip/Modify)`
disposition lives solely in `commands/ba/review.md:849-857`, and its axis is **fix quality**,
explicitly not scope. The per-finding option triple observed in the #64 run was therefore
*improvised* — Step 5 says nothing about composing per-finding option sets.

So the defect is not "an existing recommendation rule lacks a scope clause". It is **under-
specified option composition, whose improvisation drifts toward inflation**.

Considered and rejected:

- **Port review.md's per-finding disposition and add scope as a second axis.** Rejected: adds a
  mechanism review-plan does not have, grows an already-618-line unconditionally-resident file
  against the `#59` weight-reduction lane, and creates a new mirror-site pair to keep in sync.
- **Reviewer-self-tagging** — widen the Step 3 dispatch context (today `Overview + Acceptance
  Criteria`, `:293`) and have reviewers tag exclusion-crossing remedies themselves. This is what
  `docs/research/2026-06-07-preexisting-finding-frequency-research.md` recommends over
  orchestrator-side classification, and it remains the better shape *if* the chosen approach
  proves too weak. Rejected for now: touches the owned parser contract (`:188-232`) and every
  reviewer prompt, for a defect that lives in resolution.

## Key Decisions

- **Steering, not a machine-boundary contract.** "Does this remedy cross a stated exclusion?" is
  a qualitative call, so per `.claude/agent_docs/prompt-authoring.md` it earns a sentence, not a
  rubric, scoring table, or threshold. The only character-specified part is the *locator* for the
  exclusions section.
- **Locate by the owned vocabulary token, sourced not restated.** The heading/`id` pair is a
  cross-process anchor agreement (`plan.md` emits, `review-plan.md` reads), so it *is* the one
  character-level part. But review-plan must **point at `references/plan-sections.md:47`** — which
  already carries both forms in one row (`| What We're NOT Doing | scope-boundaries | … |`) — rather
  than hardcoding the heading string. Restating it would create an uncited coupling that a future
  template rename breaks silently, which is the exact failure `review-plan.md:190` warns about for
  its own parser contract.
- **The brainstorm-heading variant (`Scope Boundaries`, `references/brainstorm-sections.md:67`) is
  rationale only.** Given the no-origin-read decision, review-plan never reads a brainstorm — this
  note must not travel into the shipped prompt text, where it would be authoring residue.
- **Applies to both Must Address and Consider**, not just Consider. A finding whose only remedy is
  a scope increase is a scope-change conversation regardless of its bucket.
- **Menu stays at four options.** No new option, no new stored field on the finding schema — the
  4-option AskUserQuestion cap and the compute-at-presentation-time rule are both recorded
  decisions (`docs/brainstorms/2026-06-28-review-accept-all-recommendations-brainstorm.md`).
- **One site covers both paths.** `/ba:plan` Step 7's auto-score path delegates resolution to
  review-plan Step 5, so a Step 5 change reaches the embedded path with no second edit.
- **Prefer the cheapest in-bounds remedy.** In the #64 run, option 3 ("wire `--root`, no self-check
  unit") resolved the objection at near-zero cost; option 1 added a unit. The rule must bias toward
  the former and, when no in-bounds remedy exists, present the exclusion conflict *as* the decision
  rather than burying it in an option description.
- **Verification gates the merge:** fixture A/B, not argument (see Acceptance Criteria).

## Scope Boundaries

- **No origin read.** #66's filed fix direction asks review-plan to also read the origin's
  out-of-scope section when `origin:` is present. Dropped deliberately: it reverses the recorded
  "review-plan is deliberately not given the origin — that is issue #6, separate" decision, pulls
  #6's deferred surface forward, and would have been **inert on the #64 run that motivated the
  issue** (a ticket-origin plan has no `origin:`; the field only ever points at a brainstorm and is
  optional). The in-plan section is always present and format-neutral. *(User decision, surfaced
  conversationally — not narrowed inside this artifact.)*
- No change to the reviewer prompts, the Step 3 dispatch context, or the Plan-Anchor & Confidence
  Grammar parser contract.
- No change to `/ba:review` (the diff-review sibling). A diff has no stated scope boundary; a plan
  does. The divergence is deliberate.
- No new reviewer, agent, or skill. Anything discoverable under `.claude/agents/` becomes permanent
  never-hide-ledger noise on every run (precedent: commit `73f9276`).
- No confidence-floor, gate-arithmetic, or Suppressed-bucket changes.
- No scope-governor state machine (diff-growth multipliers, patch-cycle counters) of the kind
  `docs/research/2026-07-21-autoreview-skill-vs-ba-review-research.md` describes.

## Acceptance Criteria

- Step 5 resolution names, in its option or finding text, which exclusion a scope-increasing remedy
  crosses — quoting the plan's own wording — rather than presenting it as an ordinary fix.
- A finding whose only remedy is a scope increase is routed as a scope-change decision, never
  auto-applied under "Apply all fixes" or "Apply must-address only".
- When an in-bounds remedy exists, it is the one preferred; the scope-increasing alternative is
  never the endorsed default.
- **The rule is inert when it should be:** a plan with an empty or absent scope-boundaries section
  produces no added prompt, no added widget, and no behavior change. (Guards the documented
  dead-gate failure: a first draft of the analogous `/ba:plan` ledger gate surfaced nothing on 2 of
  3 fixtures because its trigger was coverage-shaped.)
- Detection works on both `.md` and `.html` plans via the heading text and the `scope-boundaries`
  `id` respectively.
- **Fixture A/B per `.claude/agent_docs/prompt-authoring.md` before merge:** 3 fixtures with planted
  ground truth (a plan with a tempting exclusion plus a finding whose obvious remedy crosses it),
  ≥2 conditions (current `main` + the proposal), one subagent per cell at the session model, no repo
  access. Scored **in both directions** — exclusion-crossings correctly named, *and* units/lines/ACs
  added, the metric that produced the reconciliation ledger's 9/8/8-vs-12/12/13 result. A run in a
  fresh session; a prompt change cannot be dry-run in the session that wrote it.
- **Weight budget honoured:** the addition to `commands/ba/review-plan.md` (618 lines, fully resident
  on every invocation) stays within ~12 added lines. Anything larger belongs in `references/` behind a
  named load site, per `.claude/agent_docs/prompt-authoring.md`.
- `README.md`'s `/ba:review-plan` bullet list documents the new resolution behavior. The existing list
  already describes Step-5-level user-visible facts (`README.md:140`, the Suppressed-bucket rule), so a
  change to what resolution will and won't auto-apply belongs there too.
- `.claude-plugin/plugin.json` version bumped.

## Open Questions

_None._

### Resolved Questions

- **Which mechanism, given no recommendation machinery exists?** → Constrain the existing menu with
  a scope-anchor rule. (Rejected: porting review.md's disposition; reviewer-self-tagging.)
- **Read the origin's out-of-scope section too?** → No. In-plan section only; see Scope Boundaries.
- **Fixture A/B or ship-on-dry-run?** → A/B gates the merge. The near-identical gate in `/ba:plan`
  is on record as having fired on nothing in a first draft, which no static read caught.

## Convention Compliance

`dev-workflow:convention-checker`, 2026-07-28: **0 violations, 4 warnings, 12 aligned.**

Verified aligned: machine-boundary-vs-steering classification correct; **no mirror-site obligation
fires** — the never-hide-ledger sites (`README.md`, `review.md` Step 2, `review-plan.md` Step 2) govern
*reviewer selection*, not Step 5 resolution, and `review-plan.md` is reader-only on the U-ID axis and
grammar-only on the stack-base axis per the CLAUDE.md 2-axis grid; the "one site covers both paths"
claim confirmed against `plan.md:671,683-684` (Step 7 reads only the verdict sentinel and composes no
resolution options, so no second edit); artifact path, all five mandatory frontmatter fields, STANDARD
section set, and no-code rule all satisfied; both cited precedents check out (4-option cap at
`docs/brainstorms/2026-06-28-review-accept-all-recommendations-brainstorm.md:26,46,77`; the no-origin
decision at `docs/brainstorms/2026-07-24-plan-requirement-reconciliation-ledger-brainstorm.md:108`,
which this proposal preserves rather than reverses).

All four warnings resolved into this document: locator sourced from `references/plan-sections.md`
rather than restated (W2); a ~12-line weight budget and a README bullet added to Acceptance Criteria
(W3, W1); the brainstorm-heading variant marked rationale-only so it cannot become authoring residue
in the shipped prompt (W4).

## Next Steps
→ `/ba:plan` to create implementation plan

**Revised at plan-time** (2026-07-28, both surfaced and approved — see
`docs/plans/2026-07-28-fix-review-plan-scope-exclusion-anchor-plan.md` Sources for the reasoning):
the trigger shape above ("when a finding's remedy re-enters a stated exclusion") is **superseded** —
it is dead on the #64 case, since that plan's exclusion bullet was edited to pre-justify the remedy;
and the A/B's "fresh session" requirement was imprecise (inline text to subagents runs in-session).
The plan is authoritative on both.
