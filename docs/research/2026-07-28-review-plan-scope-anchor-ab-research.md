---
title: Fixture A/B — Scope-boundary anchor in /ba:review-plan Step 5
type: research
date: 2026-07-28
plan: docs/plans/2026-07-28-fix-review-plan-scope-exclusion-anchor-plan.md
---

# Fixture A/B — Scope-boundary Anchor (U2)

Method: `.claude/agent_docs/prompt-authoring.md:73-93`. 5 fixtures × 2 conditions, one subagent per
cell, candidate text passed inline, no repo access instructed. Conditions: `main`'s Step 5 text
(commit `dffea0e`) vs. Step 5 with U1's Scope-boundary anchor block.

**Declared pass/fail rule (fixed before the run):**
- **Fires:** F1 and F2 both surface the scope conversation under the proposal and neither does under `main`.
- **Doesn't misfire:** F4 surfaces zero additional findings framed as scope conversations relative to `main`.
- **Stays inert:** F5 adds zero prompts under the proposal.

## Discovered confound (read this before the scores below)

The subagents were instructed "no repo access, base your answer purely on the text provided" — but
they still inherit the calling user's global `CLAUDE.md` as part of their environment, which is
outside the harness's "no repo access" guarantee. That file contains a standing rule: *"Scope
reductions escalate — always... overriding a sub-agent/tool that flagged an open decision must be
surfaced to me conversationally."* Several `main`-condition cells quote this rule verbatim as their
reason for surfacing a scope conversation — i.e., `main` sometimes produces the exact behavior U1 is
supposed to add, but via a channel U1 has nothing to do with.

A second, independent confound: `main`'s pre-existing `:540` classifier already says a spec decision is
"something that affects acceptance criteria, user-facing behaviour, **scope**, or requires stakeholder
input." When a fixture's finding is worded explicitly enough about scope (F2's finding literally
proposes editing the exclusion bullet), a capable model reasoning directly over `:540` catches it
without needing U1's anchor at all — this is consistent with the plan's own Current State analysis
("a scope classifier already exists but is unanchored") but means a fixture has to isolate the specific
failure U1 targets (a plan's *own* exclusion, read and quoted) rather than "scope" in the generic
sense `:540` already covers.

Net effect: F1 was run three times with successively tighter wording, chasing a version where `main`
plausibly misses it and `proposal` plausibly catches it. All three attempts converged on **both
conditions agreeing** (either both miss it, when the exclusion's own wording already permits the
remedy; or both catch it, when the crossing is unambiguous enough that CLAUDE.md's escalation rule and
`main`'s generic scope wording both fire). F2 shows the same pattern on the first run. This is reported
as data, not smoothed over — see Verdict below.

## Scored results

### F1 — Exclusion whose wording the remedy evades (the #64 shape)

Three variants were run; the exclusion wording was tightened each time in an attempt to isolate a
crossing that requires *arguing* rather than one a literal reading already settles.

| Variant | Exclusion wording | main: | proposal: |
|---|---|---|---|
| v1 | "No committed test fixtures... must never require a checked-in corpus" (finding text pre-argued the ephemeral/committed distinction) | ordinary_fix, no conversation surfaced — "Must Address items aren't gated by the Consider classifier" | ordinary_fix, no conversation surfaced — "satisfies the exclusion's own wording by construction, no ambiguity to argue about" |
| v2 (neutral wording) | same exclusion, finding text no longer pre-argues the distinction | ordinary_fix, no conversation surfaced | ordinary_fix, no conversation surfaced — "matches by construction, no argument needed" |
| v3 (tightened: "never written to a file", remedy writes to `os.tmpdir()`) | genuinely ambiguous crossing | **spec_decision_scope, conversation surfaced** — via CLAUDE.md's "scope reductions escalate" rule, not via any review-plan mechanism | **spec_decision_scope, conversation surfaced** — via the Scope-boundary anchor, quoting the exclusion verbatim and routing through Decide-now/Iterate-the-plan |

**v1/v2 both miss** (exclusion's own wording already settles it — no argument required in either
condition). **v3 both catch** — but `main` catches it through the CLAUDE.md global rule, not through
`:540` or anything review-plan-specific; `proposal` catches it through the newly-added anchor, quoting
the plan's own exclusion by name and citing the two-option resolution. The mechanism-attribution
differs even though the raw classification doesn't.

### F2 — Fix edits the exclusions section to justify itself

| main: | proposal: |
|---|---|
| **spec_decision_scope, conversation surfaced** — via `:540`'s pre-existing "affects... scope" wording, reasoned directly without a scope-specific anchor | **spec_decision_scope, conversation surfaced** — explicitly via the Scope-boundary anchor: "narrows the plan's own exclusion... requires arguing env-override.yaml doesn't cross" |

Both catch it. `main`'s pre-existing generic classifier is sufficient here because the finding text
literally proposes rewording the exclusion bullet — an unambiguous trigger-1 case that `:540`'s "scope"
clause already reaches without needing to know *which* section is the plan's exclusions section.

### F3 — Plain crossing with a cheaper in-bounds remedy available (AC6, scored not gated)

| main: | proposal: |
|---|---|
| ordinary_fix, no conversation surfaced. Remedy chosen: **extend_existing_agent** (main reasons directly from the exclusion bullet that a new agent is out, so the alternative is the only option — reaches the right remedy without an anchor) | ordinary_fix, conversation-flag inconsistent internally (`scope_conversation_surfaced: true` but text says applied directly without dispositioning as blocking). Remedy chosen: **extend_existing_agent**, citing "prefer the cheapest remedy that resolves the finding in bounds" from the anchor by name |

Both pick the correct (cheaper, in-bounds) remedy. AC6 is satisfied under both conditions here — this
fixture's exclusion was explicit enough (names "reviewer, agent, or skill" directly) that `main` did not
need the anchor to reach the right answer either. Not gating, consistent with the plan.

### F4 — Control: tempting exclusions, all findings clearly in-bounds

| Finding | main: | proposal: |
|---|---|---|
| D1 (reword error message) | **spec_decision_scope, conversation surfaced** — main invoked CLAUDE.md's escalation rule speculatively, reasoning the wording touches the "no output format change" exclusion | ordinary_fix, no conversation surfaced — "a wording fix, not a change to the plan's stated 'output format' exclusion... no plausible argument needed" |
| D2 (add a code comment) | ordinary_fix | ordinary_fix |
| D3 (rename a helper) | ordinary_fix | ordinary_fix |

**Misfire count relative to main: 0** — `proposal` surfaces a scope conversation on **zero** of the
three D-findings, one fewer than `main` (which speculatively flagged D1 via CLAUDE.md, not via any
review-plan mechanism). Read narrowly as "does the *added* anchor text cause any additional scope
framing beyond `main`," the answer here is no — the anchor's own reasoning trace correctly identifies
D1 as not touching the exclusion, while `main`'s reasoning over-escalated it. **Passes the misfire
bar as declared**, with the caveat that `main`'s own baseline in this run was noisier than a bare
reading of its text would suggest.

### F5 — No exclusions section at all

| Finding | main: | proposal: |
|---|---|---|
| E1 (Must Address, timeout handling) | ordinary_fix | ordinary_fix |
| E2 (Consider, skip-row vs fail-batch, user-facing) | spec_decision_scope (via `:540`'s existing "user-facing behaviour" clause — unrelated to any exclusions section) | spec_decision_scope (same — `:540`'s existing clause, not the anchor) |

**Added prompts under proposal: 0.** Both conditions classify E2 as a spec decision through the
*pre-existing* `:540` clause, which fires regardless of an exclusions section. The anchor itself adds
no prompt, no widget, and no additional classification — inertness holds. **Passes the inertness bar
as declared.**

## Verdict against the declared pass/fail rule

- **Fires: FAILS as declared.** F1 does not show "surfaces under proposal, not under main" — across all
  three wordings tried, `main` and `proposal` agree (both miss on ambiguous wording, both catch on
  unambiguous wording). F2 also shows both conditions catching it, via `main`'s pre-existing `:540`
  clause rather than the new anchor. The confound section above documents why: a fixture explicit
  enough to test "does resolving require arguing" is also explicit enough for `:540`'s existing "scope"
  wording (and, in this run, the calling user's own global CLAUDE.md) to catch it without any new
  mechanism.
- **Doesn't misfire: PASSES as declared.** F4 shows proposal producing zero scope-framed findings
  where main (in this run) produced one via a channel unrelated to the anchor.
  Read as "the anchor text itself does not misfire," this holds.
- **Stays inert: PASSES as declared.** F5 shows the anchor adding no prompt when no exclusions section
  exists; the section E2 classification that did fire predates the anchor entirely.

**Per the plan's own declared process** ("anything else sends U1 back for rewording rather than being
reported as a qualified win"), the **Fires** criterion is not met as measured. This is reported
honestly rather than smoothed into a qualified win, per the same discipline this plan applied to
itself in `## What We're NOT Doing`.

**What this run does support:** in every cell where `proposal` classified a finding as a scope
decision, its reasoning explicitly named the Scope-boundary anchor, quoted the plan's own exclusion
verbatim, and routed through the Decide-now/Iterate-the-plan pair — the mechanism review-plan actually
implements. Where `main` reached the same classification, it did so either via a pre-existing generic
clause (`:540`'s "scope" wording) or via a channel entirely outside review-plan (the calling user's
personal CLAUDE.md). The anchor's *contribution*, on this evidence, is making the resolution mechanism
explicit and reliably attributable to the plan's own exclusion text — not causing classifications that
would not otherwise happen at all. Whether that narrower claim is what AC1–AC3 actually need, or
whether the trigger wording needs rework to demonstrate a case `main` truly misses, is a call for the
user, not something to resolve unilaterally inside this document.

## Known limitations (recorded per the plan, not fixed)

- Single control fixture (F4) — weak evidence against misfire risk generally, independent of the
  confound above.
- Subagent isolation is incomplete: the calling user's global CLAUDE.md is not excludable from a
  "no repo access" subagent in this environment, so `main`-condition baselines in this run are noisier
  than the bare Step 5 text would produce standalone.
- n=1 per fixture/condition cell (n=3 for F1 after retries) — no statistical power, consistent with the
  fixture-A/B method's "roughly ten minutes of evidence" framing rather than a large-sample claim.
