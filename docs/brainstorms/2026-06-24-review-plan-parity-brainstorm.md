---
date: 2026-06-24
topic: review-plan-parity
status: approved
triage_level: full
tags: [review-plan, review, deepening, confidence-gating, ba-commands]
---

# Bring `/ba:review-plan` Up to Parity with `/ba:review`

## What We're Building

`/ba:review-plan` has drifted behind `/ba:review`: it runs a cold multiselect menu and emits a flat
Must-Address / Consider / Looks-Good summary, while `/ba:review` has gained a judged selection ledger,
a confidence/severity ladder, and a parse→validate→group→merge→gate→render consolidation pipeline.
This brings `review-plan` to parity in *mechanism* while keeping it plan-native in *vocabulary* — because
a plan finding (gap, ambiguity, missing acceptance criterion, risky sequencing) is a different animal from
a `file:line` code finding.

The shape is a **hybrid**: `/ba:review-plan` stays a standalone command, but `/ba:plan` auto-runs a cheap
section-scoring pass at the end of planning that is **self-suppressing** — it only escalates to a reviewer
dispatch when sections actually score weak. This is dev-workflow's adaptation of CE's confidence-scored
deepening (ce-plan's `deepening-workflow.md`), grounded in `docs/research/2026-06-17-plan-execute-vs-ce-comparison.html`.

## Why This Approach

The direction was settled in issue #27's comment (the research pass the issue asked for) and validated
against the CE comparison doc. Four design forks were resolved collaboratively:

- **Hybrid over pure-standalone or pure-inline.** Pure-inline (#2) was rejected: it couples plan
  *generation* to review and makes the gate non-optional. Pure-standalone already integrates via
  `/ba:plan`'s handoff menu, so the only real question was opt-in vs opt-out. The **confidence gate
  dissolves the cost objection** — a scored pass that dispatches zero reviewers on a clean plan is cheap
  enough to run by default, and auto-running is how we actually capture the value CE gets instead of
  relying on the user remembering to invoke review. The empirical signal that `review-plan` is under-used
  (externals never picked) is itself an argument for auto-running it.

- **Full-strip of external discovery over judge-externals-too.** Externals are empirically never picked in
  `review-plan`; the external population is code-focused and plans are now code-light (post-#30
  justification gate), so discovery surfaces mostly-irrelevant reviewers. Paying the Glob-sweep cost on
  every run to auto-surface reviewers nobody picks is exactly the speculative flexibility to cut (YAGNI).
  Discovery **stays in `/ba:review`**, where code externals are the point. The research doc calls this
  "the simpler alternative."

- **Plan-native severity over a verbatim Critical/High/Medium/Low port.** "Critical / data-loss /
  production-breaking" rarely maps to a plan document, so a literal port would leave the top rung dead and
  invite mis-binning. Keeping Must-Address / Consider / Looks-Good preserves the plan-native
  spec-decision vs implementation-decision classification already in review-plan Step 5, while the *new*
  machinery (confidence, dedup/merge, soft gate) ports underneath it.

## Key Decisions

- **Decision 1 — Hybrid command, auto-score with gated dispatch.** `/ba:review-plan` remains standalone.
  `/ba:plan` always runs the cheap section-scoring pass at the end of planning. If sections score weak,
  it surfaces the judged ledger and asks before dispatching reviewers; if nothing scores weak, it reports
  "no weak sections" and proceeds to the existing handoff menu. Opt-out only matters when there is real
  work — zero friction on clean plans. *Rationale:* captures CE's automatic-deepening value without
  imposing dispatch cost on every plan.

- **Decision 2 — Full-strip to built-ins.** Drop review-plan's external-reviewer discovery (the Glob
  sweep, current `review-plan.md:54–90`) entirely. The judged ledger scores only the 7 built-in reviewers
  against plan sections. A rare plan-relevant external stays reachable via Adjust's "Other" free-text.
  *Rationale:* externals are never picked here; discovery is pure friction on code-light plans.

- **Decision 3 — Port the judged ledger + consolidation, adapted to sections.** Replace the cold
  multiselect menu with `/ba:review`'s judged-ledger model (`✓` selected / `○` set-aside-with-reason,
  full roster enumerated, Adjust reachable). The judgment adapts from "does this diff contain substantive
  work in this reviewer's domain?" to **"does this plan have a weak or risky section in this reviewer's
  domain?"** — i.e. score sections, target the weak ones. Port the
  parse→validate→group→merge→gate→render pipeline, with the validator's "file exists in repo" check
  becoming "section exists in the plan." *Rationale:* this is the parity the issue asks for, and it is
  the same idea as CE's confidence-scored deepening.

- **Decision 4 — Plan-native severity + new confidence machinery.** Keep Must-Address / Consider /
  Looks-Good. Layer on per-finding confidence `{0, 25, 50, 75, 100}`, cross-reviewer dedup/merge, and a
  soft gate with a per-tier confidence floor (Must-Address floor higher, Consider lower). Preserve the
  existing spec-decision vs implementation-decision classification in resolution. *Rationale:* parity in
  mechanism, plan-native in vocabulary.

- **Decision 5 — Anchor = section heading + keyed anchors.** Findings anchor to the plan section heading,
  and to the plan's existing keyed anchors (`### U<n>` U-IDs / keyed Acceptance Criteria) when a finding
  lands on one. review-plan **consumes** the existing anchor grammar (owned by `execute.md`, minted by
  `plan.md`) — it does not mint or redefine it. *Rationale:* the plan-domain analog of `file:line`, using
  keys the plan already produces.

- **Decision 6 — Plan-LoC iteration gate: no action.** Already retired in commit `be1ea92` (#32).

- Design-it-twice dispatch did not fire — this modifies existing commands (`review-plan.md`, `plan.md`)
  with no new module, interface, or agent.

## Scope Boundaries

- **Not** porting `/ba:review`'s diff-capture, MR/PR fetch, persist (`--persist`), or
  posting-to-MR/authorship machinery — review-plan reviews a plan document, not a code diff.
- **Not** adding external-reviewer discovery to review-plan (Decision 2 removes it).
- **Not** introducing a new severity ladder (Decision 4 keeps the existing one).
- **Not** redefining the U-ID / keyed-AC anchor grammar — review-plan is a reader only (Decision 5).
- **Not** building the CE residual-work gate or tiered size-based escalation here — those map to
  *code* review (`/ba:review`), per the research doc's correction note, and are out of scope.

## Acceptance Criteria

- AC1: `/ba:review-plan` presents a judged ledger (`✓`/`○` with one-line reasons) over the 7 built-in
  reviewers, scored against plan sections, with every reviewer enumerated and an Adjust path that keeps
  all reviewers (and an "Other" free-text external) reachable — never silently dropped.
- AC2: review-plan no longer runs the external-discovery Glob sweep; the divergence note at
  `review-plan.md:52` is removed (its "no diff to judge against" rationale is retired by section scoring).
- AC3: Findings carry per-finding confidence `{0,25,50,75,100}`, are deduped/merged across reviewers, and
  pass through a soft gate with per-tier floors; below-floor findings are surfaced as suppressed, not lost.
- AC4: Findings anchor to a plan section heading or a `### U<n>` / keyed-AC anchor that exists in the plan;
  anchors that don't resolve in the plan are dropped by consolidation.
- AC5: `/ba:plan` auto-runs the section-scoring pass at the end of planning; on a plan with no weak
  sections it dispatches zero reviewers and reports "no weak sections" before the handoff menu; on weak
  sections it surfaces the ledger and asks before dispatching.
- AC6: The plan↔review-plan auto-invoke coupling has a declared owner and citation site, reconciled with
  the existing `/ba:plan` Step 7 handoff menu (today a menu option; the design makes it auto-run on weak
  sections — the two must not contradict).
- AC7: All six mirrored-site / keep-in-sync obligations below are addressed.

## Open Questions

(none — all design forks resolved)

## Convention Compliance

Convention-checker found **no design-level violations**. The hybrid shape, full-strip, ported ledger, and
plan-native severity are all internally convention-consistent, and the planning-command "never write code"
rule holds (review-plan only edits the plan `.md` — documenting, not coding). One justified override:
full-strip of external discovery is a deliberate, stated divergence from `/ba:review` (which keeps
discovery).

Six keep-in-sync obligations the plan **must** carry as explicit work items:

1. **Never-hide ledger gains a third mirror site.** Once review-plan adopts the judged ledger, the
   convention at `CLAUDE.md:78` (mirrored in `README.md` + `review.md` Step 2) must name
   `commands/ba/review-plan.md` as a third sync site, and the divergence note at `review-plan.md:52` must
   be removed.
2. **README + CLAUDE.md "discovery-based" descriptions go stale.** `README.md:111,116,118` and
   `CLAUDE.md:15` describe review-plan as "discovery-based" with the "older two-bucket vocabulary" — both
   Decision 2 (full-strip) and Decision 4 (confidence machinery) contradict those lines; update them.
3. **New plan↔review-plan coupling needs a declared owner.** Per house style, the entry contract should be
   owned by `review-plan.md` and cited by `plan.md` Step 7 (`plan.md:512`), reconciled with the existing
   handoff menu option (see AC6).
4. **Version bump.** Bump `.claude-plugin/plugin.json` (currently `0.28.0`) when shipping — don't defer.
5. **Anchor grammar is cited, not redefined.** State that review-plan *consumes* the `### U<n>` / keyed-AC
   grammar owned by `execute.md`; it does not mint or redefine it.
6. **Protected-artifacts guard ports along with the ledger.** review-plan dispatches reviewers against a
   plan under `docs/plans/`; carry the same protected-artifacts guard `/ba:review` uses (`review.md:445`)
   so plan reviewers don't suggest relocating/deleting the plan.

## Next Steps
→ `/ba:plan` to create implementation plan
