---
title: Anchor /ba:review-plan resolution to the plan's own scope exclusions
type: fix
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-07-28
origin: docs/brainstorms/2026-07-28-review-plan-scope-exclusion-anchor-brainstorm.md
detail_level: standard
tags: [review-plan, scope-exclusions, cluster-review-quality, issue-66, prompt-text]
---

# Anchor `/ba:review-plan` Resolution to the Plan's Own Scope Exclusions

## Overview

`/ba:review-plan` Step 5 resolves review findings with no awareness of what the reviewed plan
explicitly put out of scope, so a reviewer's remedy can grow the plan past its own stated bounds.
This adds a short steering rule that makes the plan's exclusions section a bound on what resolution
may apply, and routes a scope-increasing remedy through the spec-decision path that already exists
rather than applying it as an ordinary fix. Fixes GitHub issue #66.

## Current State

- `commands/ba/review-plan.md` is 618 lines, fully resident on every invocation. Step 5 spans
  `:493-562`.
- **The menu is static and scope-blind** — four options at `:515-518`; the Suppressed carve-out at
  `:520-523`; merged-finding classification at `:530-532`; the implementation-vs-spec-decision
  classifier at `:534-546`.
- **No per-finding recommendation mechanism exists.** The file's only `recommend` hit is `:170`
  (the Adjust pick-list default). `(Recommended — Apply/Skip/Modify)` lives solely in
  `commands/ba/review.md:849-857`, on a **fix-quality** axis that never considers scope. The
  per-finding option triple observed in the #64 run was improvised, not specified.
- **A scope classifier already exists but is unanchored.** `:540` defines a spec decision as
  something affecting "acceptance criteria, user-facing behaviour, **scope**, or … stakeholder
  input", with a two-option resolution at `:542-545`. It never tells the model to read the plan's
  exclusions section — which is why #64 slipped past a classifier that was already there. It is
  also **Consider-only** (`:536` opens "Before writing any \"Consider\" fix"), so Must Address
  never reaches it.
- **The locator is already an owned row.** `references/plan-sections.md:47` carries both forms in
  one line: `| What We're NOT Doing | scope-boundaries | Explicit scope exclusions |`. The anchor
  matching rule at `review-plan.md:208-211` already resolves on normalized heading text **or** the
  `id=""` value, and treats struck anchors as non-resolving.
- **How #64 actually failed.** The plan's exclusion bullet was *edited to pre-justify the remedy*:
  `docs/plans/2026-07-28-feat-structural-invariant-checks-plan.md:91-95` now reads "…the
  self-check's negative-path cases are built in `os.tmpdir()` at run time and deleted after —
  nothing is checked in… That is the distinction from the rejected 8-fixture corpus." Resolution
  negotiated with the boundary and wrote the negotiation into it. Measured cost: 410→567 lines,
  5→6 units.
- `/ba:plan` Step 7 (`plan.md:665-690`) delegates resolution to this same Step 5 — one edit site
  covers both paths. Confirmed at `plan.md:671` ("review-plan **owns** every widget on the auto
  path") and `:683-684`.

## Acceptance Criteria

- AC1: A remedy that crosses a stated exclusion is classified a **spec decision regardless of
  bucket** — Must Address as well as Consider — and resolved through the existing pair at `:542-545`.
- AC2: A fix that adds to, narrows, or qualifies the plan's scope-boundaries section is never an
  ordinary applied fix.
- AC3: When resolution requires *arguing* that a remedy does not cross an exclusion, that argument
  is surfaced as the scope-change conversation, not written into the plan.
- AC4: Under "Apply all fixes" and "Apply must-address only" a scope-crossing finding is
  dispositioned before the bulk apply and named in the `:548` confirmation — never silently skipped.
- AC5: The rule quotes the exclusion in the plan's own words and never adjudicates whether it was
  user-approved or self-minted.
- AC6: Where an in-bounds remedy exists it is the preferred one; the scope-increasing alternative is
  never the endorsed default. Where none exists, the conflict itself is the decision.
- AC7: The rule is **inert** when the exclusions section is absent, empty, or too vague for any
  remedy to be objectively said to cross it — no added prompt, no added widget, no behavior change.
- AC8: Detection works on `.md` (heading text) and `.html` (`id="scope-boundaries"`) via either
  signal, tolerates prose-only sections with no bullets, and does not constrain from a struck
  exclusion.
- AC9: A Suppressed finding is never resurrected by this rule — the `:520-523` carve-out wins.
- AC10: A merged finding is classified from its **contributing bodies**, not the merged summary line
  rendered per `:484`.
- AC11: On the `--auto` path the rule is live — Step 5 is reachable only via the weak branch, where
  widgets are already review-plan's, so the inertness criterion must not be over-read into
  suppressing the rule on the auto path. An "Iterate the plan" resolution surfaces the blocker in the
  resolution conversation itself. *(Reworded during review: the original required the blocker to be
  visible at `plan.md`'s handoff menu, which no existing channel can deliver — Step 5's exit threads
  control only, and the auto-invoke contract's three sentinels cannot encode it. Carrying blocked
  state back to Step 7 would extend that contract, and this plan classes the gap as pre-existing and
  out of scope. The cheapest in-bounds criterion is the one stated here.)*
- AC12: The inserted block is ≤15 lines, plus one clause on option 1 at `:515` and one clause on
  `:536`. *(Raised from ≤12 during review to absorb AC4's ordering-and-confirmation requirement;
  15 lines in a 618-line file leaves the resident-weight judgment unchanged.)*
- AC13: A fixture A/B is run and scored before merge: 5 fixtures × 2 conditions, scored in both
  directions, with planted ground truth recorded in the research doc and the scored result also in
  the commit body.
- AC14: `README.md`'s `/ba:review-plan` bullet list documents the new resolution behavior, and
  `.claude-plugin/plugin.json` is bumped from `0.37.0`.

## What We're NOT Doing

Carried from the brainstorm (`:76-95`), unchanged:

- **No origin read.** #66's filed direction asks review-plan to also read the origin's out-of-scope
  section. Dropped by user decision: it reverses the recorded "review-plan is deliberately not given
  the origin — that is issue #6, separate" boundary, pulls #6's deferred surface forward, and would
  have been **inert on the #64 run that motivated the issue** (a ticket-origin plan has no `origin:`;
  the field only ever points at a brainstorm and is optional).
- No change to reviewer prompts, the Step 3 dispatch context (`:293`), or the Plan-Anchor &
  Confidence Grammar parser contract (`:188-232`).
- No change to `/ba:review`. A diff has no stated scope boundary; a plan does. The divergence is
  deliberate.
- No new reviewer, agent, or skill — anything discoverable under `.claude/agents/` becomes permanent
  never-hide-ledger noise on every run (precedent: commit `73f9276`).
- No confidence-floor, gate-arithmetic, or Suppressed-bucket changes.
- No scope-governor state machine (diff-growth multipliers, patch-cycle counters).
- **No committed fixtures.** The A/B fixtures live in the session scratchpad; their planted ground
  truth is reproduced in the research doc instead. `git ls-files | grep -i fixture` is empty — this
  repo has never committed a corpus.
- No new menu option and no new field on the finding schema — the four-option cap and the
  compute-at-presentation-time rule are recorded decisions
  (`docs/brainstorms/2026-06-28-review-accept-all-recommendations-brainstorm.md:26,46,77`).

## Proposed Solution

Extend the **existing spec-decision class** rather than building a parallel mechanism. `:540`
already routes anything affecting scope to a spec decision; it simply lacks an anchor and is
Consider-only. So the change supplies the anchor, lifts the bucket restriction, and inherits
`:542-545` for resolution and `:530-532` for merges at zero added machinery.

**The trigger shape is the load-bearing decision.** A literal "does this remedy re-enter a stated
exclusion?" test — the brainstorm's original wording — is dead on the case that motivated the issue:
the excluded thing was a *committed* corpus and the remedy was ephemeral `mktemp`, so the honest
answer is "no". Worse, asking it of the same context that wants the fix reliably returns "no", which
is verbatim what #64's plan now argues at `:91-95`. Two triggers that do fire replace it (approved
at plan-time — see Sources):

1. **A fix that edits the boundary section is always a scope-change decision.** Objectively
   detectable, immune to negotiation, and would have caught #64 on its own.
2. **The argument is the signal.** If resolving a finding requires arguing the remedy does not cross
   an exclusion, that argument *is* the conversation.

Placement: one block immediately after `:532`, which already forward-references "the spec-decision
resolution below" — so the forward reference follows an established shape rather than inventing one.
The block presents its two triggers as cases of `:540`'s existing spec-decision test rather than as a
second, separately-named test, and `:536`'s Consider-only framing is widened in the same change so the
routing target does not contradict the routing rule.

## Technical Considerations

- **Steering, not a machine-boundary contract.** "Does this remedy cross a stated exclusion?" is a
  qualitative call, so per `.claude/agent_docs/prompt-authoring.md:9-20` it earns prose, not a rubric,
  scoring table, or threshold arithmetic. The single cross-process agreement — the locator — is
  specified by *citation* to `references/plan-sections.md:47` rather than restated, so a template
  rename cannot silently break detection.
- **Weight.** ≤15 lines added to a 618-line fully-resident file; no `references/` offload needed at
  that size. Keep the brainstorm-heading variant (`Scope Boundaries`) out of shipped text — with no
  origin read, review-plan never reads a brainstorm, so it would be authoring residue.
- **The behavioral claim lives in U2, not in U1's `Verify:`.** A grep over prose the same change just
  wrote confirms authorship, not behavior (`prompt-authoring.md:61-63`). U1's `Verify:` asserts the
  three edit sites are coupled; U2 is the evidence.

## System-Wide Impact

- **Interaction graph.** Step 5 is entered from two callers: a manual `/ba:review-plan` run, and
  `/ba:plan` Step 7's `--auto` invocation. One edit reaches both. Within Step 5 the rule composes
  with three existing mechanisms: the Suppressed carve-out (`:520-523`, which **dominates**), the
  merged-finding stricter classification (`:530-532`, which the rule inherits by being a spec-decision
  subtype), and the spec-decision resolution pair (`:542-545`, which it reuses).
- **Error propagation.** The rule's failure mode is not an exception but silence — a dead clause that
  never fires. That is why AC7 asserts inertness *and* U2 tests a no-section fixture: the analogous
  `/ba:plan` ledger gate's first draft surfaced nothing on 2 of 3 fixtures because its trigger was
  coverage-shaped.
- **State lifecycle risk.** The pre-existing "Iterate the plan" resolution (`:544`) carries no
  blocked state back to `plan.md` Step 7, whose handoff menu offers "Start implementation" first
  (`plan.md:697`). This rule materially raises that path's firing rate on the auto path — precisely
  where the plan just minted its own exclusions. **No existing channel can carry that blocked state**:
  Step 5's exit threads control only, and the auto-invoke contract's three sentinels cannot encode it.
  Closing the gap means extending that contract, which this plan holds out of scope, so AC11 was
  reworded during review to the in-bounds criterion the mechanism can actually meet. The residual risk
  is real and stated: a user who has just judged the plan blocked is still offered "Start
  implementation" first at the handoff menu.
- **No mirror-site obligation fires.** `review-plan.md` is reader-only on the U-ID axis and
  grammar-only on the stack-base axis per the CLAUDE.md 2-axis grid; the never-hide-ledger sites
  govern reviewer *selection*, not resolution. `README.md` is required separately (see U3).

## Implementation Approach

### Changes Required

**File**: `commands/ba/review-plan.md`

#### U1 — Scope-boundary anchor in Step 5

**Three coupled edit sites.** Insert one block immediately after the merged-finding classification
(`:530-532`, ending at `:532`), before the `### Handling "Consider" items` subsection at `:534`; amend
option 1's text at `:515`; and amend `:536` so the classifier it introduces is no longer
Consider-only. All three land together — the block routes findings into a subsection that, unamended,
declares itself out of scope for them.

**Code-shape decision:** the shipped artifact *is* the wording, and U2's A/B scores this exact text —
re-deriving it from a prose description would invalidate the evidence.

Site 1 — the block, after `:532`:

```markdown
**Scope-boundary anchor.** The plan's own exclusions section (the `What We're NOT Doing` /
`scope-boundaries` row in `references/plan-sections.md`, matched by heading text or `id=""` per the
anchor rule above) bounds what resolution may apply. Two things are a **spec decision** in the sense
of the classifier below — regardless of bucket, Must Address included: a fix that **adds to, narrows,
or qualifies that section**; and any finding whose resolution requires **arguing** that its remedy
does not cross a stated exclusion — that argument *is* the scope-change conversation, so surface it
rather than writing it into the plan. Disposition these **before** any bulk apply, and name them in
the "Plan updated" confirmation so a skipped finding is never silently absent. Quote the exclusion in
the plan's own words; never adjudicate whether it was user-approved or self-minted. Prefer the
cheapest remedy that resolves the finding in bounds; where none exists, the conflict is itself the
decision. Classify a merged finding from its contributing bodies, not its summary line. Absent,
empty, or unfalsifiably vague exclusions do not fire this rule and add no prompt; Suppressed findings
stay suppressed.
```

Site 2 — at `:515`, append the exception clause (the block sits **below** this line):

```markdown
1. **Apply all fixes** — Update the plan with all main-section Must Address + Consider items, except any routed as a scope decision by the Scope-boundary anchor below
```

Site 3 — at `:536`, widen the classifier's own scope so a Must Address finding routed by the block
actually reaches it:

```markdown
Before writing any "Consider" fix — or any fix routed here by the Scope-boundary anchor above — into the plan, classify it:
```

Test scenarios:
- A finding whose fix edits `## What We're NOT Doing` is routed to the spec-decision pair, not
  applied (Covers AC2)
- A Must Address finding crossing an exclusion routes as a spec decision (Covers AC1)
- "Apply all fixes" on a set containing one scope-crossing finding dispositions it first and names it
  in the confirmation (Covers AC4)
- An `.html` plan whose `scope-boundaries` `id` is present but heading text differs still resolves
  (Covers AC8)
- A plan with a prose-only exclusions section and no bullets still resolves (Covers AC8)
- A plan with no exclusions section produces no added prompt or widget (Covers AC7)
- A suppressed scope-crossing finding stays suppressed (Covers AC9)
- A merged finding with one scope-crossing contributor at Consider and one in-bounds contributor at
  Must Address classifies as a scope decision from the contributor bodies, not from the merged
  summary line rendered per `:484` (Covers AC10)
- When the rule fires, the surfaced text **quotes** the exclusion verbatim from the plan and makes no
  claim about whether it was user-approved or self-minted (Covers AC5)
- A Must Address finding routed by the block reaches the classifier at `:536` without hitting its
  Consider-only framing (Covers AC1)
- Inserted block is ≤15 lines (Covers AC12)

Verify: `grep -q 'Scope-boundary anchor' commands/ba/review-plan.md && grep -q 'plan-sections.md' commands/ba/review-plan.md && grep -q 'scope-boundaries' commands/ba/review-plan.md && grep -q 'routed as a scope decision by the Scope-boundary anchor below' commands/ba/review-plan.md && grep -q 'routed here by the Scope-boundary anchor above' commands/ba/review-plan.md && grep -q 'before\*\* any bulk apply' commands/ba/review-plan.md` — six conjuncts spanning all three edit sites plus the boundary-edit trigger and the ordering clause. **Post-ship narrowing (see closing note below): the seventh conjunct, `requires **arguing**`, was dropped along with trigger 2 itself** — the A/B in U2 could not show it fires beyond what pre-existing mechanisms already caught, so it was removed as unproven prompt weight rather than shipped on the strength of the objection alone. Fails on a partial edit or on one that drops the bulk-apply ordering requirement. Behavioral evidence lives in U2, not here — a grep over prose this change just wrote confirms authorship, not behavior.

---

**File**: `docs/research/2026-07-28-review-plan-scope-anchor-ab-research.md`

#### U2 — Fixture A/B, scored before merge

Five fixtures × two conditions = ten subagent cells, one subagent per cell, **no repo access**, the
candidate Step 5 text passed **inline** (this is what makes the method valid in the session that
wrote the change — the subagents never load the repo's copy). Conditions: `main`'s Step 5 text vs
Step 5 with U1's block.

| Fixture | Planted ground truth | Measures |
|---|---|---|
| F1 | Exclusion whose literal wording the remedy evades — the #64 shape (excluded "committed corpus", remedy uses ephemeral temp dirs) | Does trigger 2 fire where a literal test would not |
| F2 | A finding whose fix edits the exclusions section to justify itself | Does trigger 1 fire |
| F3 | Exclusion crossed plainly, with a cheaper in-bounds remedy available | AC6 — is the in-bounds remedy preferred |
| F4 | **Control**: real, tempting exclusions section; all findings clearly in-bounds | False-positive rate — the rule's main cost |
| F5 | **No exclusions section at all** | AC7 inertness — the dead-gate guard |

Score in both directions per `.claude/agent_docs/prompt-authoring.md:73-93`: crossings surfaced, and
units/ACs/lines added per cell (the metric that produced the reconciliation ledger's 9/8/8-vs-12/12/13
result), plus F4 misfires and F5 added prompts. Record each fixture's planted ground truth in the
research doc so the run is reproducible without committed fixtures. Copy the scored result into the
commit body, matching commit `247a863`.

Record every cell as a `main:` / `proposal:` line pair per fixture, so a partially-run A/B is visible
as missing pairs rather than narrated as complete.

**Declared pass/fail rule — fixed before the run, not after.** The proposal passes only if all three
hold; anything else sends U1 back for rewording rather than being reported as a qualified win:
- **Fires:** F1 and F2 both surface the scope conversation under the proposal and neither does under
  `main`. (F1 and F2 are the two triggers; one firing is not enough.)
- **Doesn't misfire:** F4 surfaces **zero** additional findings framed as scope conversations relative
  to `main`. Any nonzero count is a fail, not a judgment call — this replaces the unfalsifiable "no
  material increase".
- **Stays inert:** F5 adds **zero** prompts under the proposal.

F3 is scored and reported but does not gate: remedy *preference* (AC6) is a softer signal than firing
and inertness, and gating on it would let a taste call block a fix whose triggers work.

**Known limitation to record in the doc, not fix:** one control fixture is weak evidence against the
misfire risk. A second control variant was proposed during review and set aside — it grows the A/B
past the 5 approved fixtures, and the in-bounds alternative is to state this limit plainly.

Test scenarios:
- F1/F2 surface the scope conversation under the proposal and not under `main` (Covers AC3)
- F4 surfaces zero additional scope-framed findings (Covers AC7)
- F5 shows zero added prompts under the proposal (Covers AC7)
- Each of F1–F5 carries both a `main:` and a `proposal:` scored line (Covers AC13)
- The pass/fail rule is stated in the doc before the results section (Covers AC13)

Verify: `f=docs/research/2026-07-28-review-plan-scope-anchor-ab-research.md; test -f "$f" && for k in F1 F2 F3 F4 F5; do grep -q "$k" "$f" || exit 1; done && [ "$(grep -c 'main:' "$f")" -ge 5 ] && [ "$(grep -c 'proposal:' "$f")" -ge 5 ] && grep -qi 'control' "$f" && grep -qiE 'pass/fail|passes only if' "$f"` — five independent fixture conjuncts (no ordered chain, no alternation), ≥5 scored pairs in each condition so a partial run fails, plus the control and the pre-declared threshold.

---

**Files**: `README.md`, `.claude-plugin/plugin.json`

#### U3 — Mirror updates

Add a `/ba:review-plan` bullet to `README.md` describing the new resolution behavior, alongside the
existing Step-5-level bullet at `README.md:140` (the Suppressed-bucket rule) — same class of
user-visible fact, and required by the "update README whenever commands are changed" convention.
Bump `.claude-plugin/plugin.json` from `0.37.0`; this is now CI-enforced by the invariant checker
shipped in `9fab557`.

Test scenarios:
- README describes that a scope-increasing remedy is not auto-applied (Covers AC14)
- The invariant checker's version-bump check passes (Covers AC14)

Verify: `grep -qi 'scope' README.md && grep -q 'review-plan' README.md && ! grep -q '"version": "0.37.0"' .claude-plugin/plugin.json`

## Dependencies & Risks

- **U2 gates the merge, U1 is its subject.** U1 must land in the working tree before U2 runs; U2's
  result can send U1 back for rewording. Sequence U1 → U2 → U3.
- **Primary risk: dead text.** The rule fires on nothing, exactly as the analogous `/ba:plan` gate's
  first draft did on 2 of 3 fixtures. Mitigated by F1/F2 (which encode the #64 shape) and by choosing
  triggers that are objectively detectable rather than self-queried.
- **Secondary risk: misfire.** Every "add a test scenario" finding gets framed as a scope
  conversation because some adjacent exclusion exists. Mitigated by F4 and by the
  unfalsifiably-vague default (in doubt → ordinary fix).
- **Live-harness confirmation is post-merge.** A running session executes the command body it loaded
  at start, so the shipped behavior can only be confirmed in a later session. The A/B is the
  pre-merge evidence; the first real `/ba:review-plan` run is the confirmation.
- Pre-existing, inherited not introduced: Step 5's "Iterate the plan" has no blocked-state channel
  back to `plan.md` Step 7. AC11 was reworded during review to stop asserting a guarantee no mechanism
  provides; the residual risk is recorded in System-Wide Impact rather than closed here.
- **U3's `Verify:` is knowingly weak.** Two of its three conjuncts pass at HEAD (README already
  carries 7 "scope" hits and 3 "review-plan" hits), so only the version-bump negation has signal. The
  finding was left unapplied under "Apply must-address only" — a run that bumps the version but never
  adds the README bullet will pass U3's check. Tighten to a behavior-specific phrase if U3 is revisited.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-07-28-review-plan-scope-exclusion-anchor-brainstorm.md` — carried
  forward: constrain the existing menu rather than porting review.md's disposition; locator sourced
  not restated; no origin read (user decision); steering not a rubric; A/B gates the merge.

**Two brainstorm decisions revised at plan-time, both surfaced and approved:**
1. **Trigger shape.** The brainstorm's "when a finding's remedy re-enters a stated exclusion" is
   replaced by the boundary-edit and argument-is-the-signal triggers — the original is dead on the
   #64 case, per `docs/plans/2026-07-28-feat-structural-invariant-checks-plan.md:91-95`.
2. **A/B framing.** The brainstorm's "fresh session" requirement was imprecise. The A/B passes
   candidate text inline to subagents with no repo access, so it runs in-session; a fresh session is
   needed only for the post-merge live-harness confirmation. Fixture count also grew 3 → 5 (control +
   no-section).

### Internal References
- Target: `commands/ba/review-plan.md:493-562` (Step 5), `:515`, `:520-523`, `:530-532`, `:540`,
  `:542-545`, `:548`, `:208-211` (anchor matching), `:484` (merged template)
- Locator contract: `references/plan-sections.md:47`
- Precedent (working analogue): `commands/ba/plan.md:496-559` (Step 4.6), `:563-615` (Step 5 gate)
- Auto path: `commands/ba/plan.md:665-690`, esp. `:671`, `:683-684`
- Non-precedent: `commands/ba/review.md:849-857` (fix-quality disposition, scope-blind)
- Method: `.claude/agent_docs/prompt-authoring.md:9-20` (trust gradient), `:73-93` (fixture A/B)
- Evidence precedent: commit `247a863` (A/B result in commit body; scope-inflation damping metric)
- Issue: GitHub #66

## Convention Compliance

- [x] Prompt change classified machine-boundary vs steering; only the locator is character-specified,
  by citation — aligned
- [x] No mirror-site obligation on the U-ID or stack-base axis; never-hide-ledger sites untouched —
  aligned (verified against the CLAUDE.md 2-axis grid)
- [x] README + `plugin.json` bump included (U3) — aligned
- [x] `plan_schema: 2`, keyed `AC<n>`, `### U<n> — <title>` anchors, artifact naming — aligned
- [x] Literal code only under a `**Code-shape decision:**` label (U1) — aligned; justified because the
  wording is the deliverable and the A/B scores that exact text
- [x] Planning command writes no production code — aligned
- [x] Brainstorm AC "inert when it should be" restored as AC7 + fixture F5 after being flagged as a
  dropped requirement — resolved, user chose to comply
- [x] Two brainstorm revisions (trigger shape, A/B framing) surfaced conversationally and approved,
  recorded in Sources rather than settled silently — aligned
- [x] `docs/research/` is an accepted home for A/B evidence (`prompt-authoring.md:92-93`), with the
  scored result also in the commit body per `247a863` — aligned
- [x] Fixtures uncommitted, ground truth recorded in the research doc — aligned with actual practice
  (`git ls-files | grep -i fixture` is empty)

**Review round (`/ba:review-plan --auto`, 4 reviewers, 23 raw → 12 findings).** Resolution: *Apply
must-address only.* Applied — U2's `Verify:` regex (alternation made it pass on `F5` alone; replaced
with five independent conjuncts plus paired `main:`/`proposal:` counts, both **tested**); a declared
pass/fail rule for the A/B replacing the unfalsifiable "no material increase"; U1's `above` → `below`
inversion; a **third edit site** at `:536` so a Must Address finding actually reaches the classifier
the block routes it to; the two triggers framed as cases of `:540` rather than a parallel test; the
bulk-apply ordering and confirmation-naming requirement AC4 needs; scenarios for AC5 and AC10; and a
7-conjunct `Verify:` (**tested**: fails at HEAD, fails when trigger 2 is dropped).

Two recommended remedies **crossed this plan's own `## What We're NOT Doing`** and were resolved with
the cheapest in-bounds alternative instead — the behavior this plan exists to add, applied to itself:
- AC11's "add a fourth sentinel value" would extend the auto-invoke contract, a gap this plan holds
  out of scope. **Reworded AC11** to what the mechanism can deliver; residual risk recorded.
- "Add a second control fixture" grows the A/B past the 5 approved. **Recorded the single-control
  limitation** in U2 instead.

Left unapplied by the chosen resolution: U3's README `Verify:` false-green (Consider — 2 of 3
conjuncts pass at HEAD, **verified**; recorded in Dependencies & Risks) and 5 suppressed findings.

**Post-ship narrowing (after PR #68 was opened).** U2's A/B (`docs/research/2026-07-28-review-plan-scope-anchor-ab-research.md`)
could not demonstrate trigger 2 ("resolution requires **arguing** the remedy doesn't cross a stated
exclusion") fires in any case that `main`'s pre-existing mechanisms (the `:540` generic spec-decision
clause, or general escalation habit) didn't already catch, across three fixture attempts. Surfaced to
the user as a scope decision rather than resolved unilaterally; the user chose to strip trigger 2 and
ship only trigger 1 (editing the exclusion section — the mechanically-verified case that matches the
actual incident this plan fixes), on the grounds that unproven prompt weight has a real cost per
`.claude/agent_docs/prompt-authoring.md`. **AC3 is dropped** (it existed solely to cover trigger 2).
**AC1 is narrowed**: "a remedy that crosses a stated exclusion" now means specifically "a remedy that
edits/narrows/qualifies the exclusion section," not the broader "requires arguing" case. U1's `Verify:`
and README bullet were both amended to match; U2's research doc stands as the record of why.
