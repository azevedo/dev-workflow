---
date: 2026-07-28
category: prompt-authoring
problem: general-purpose subagents dispatched with "no repo access" for a fixture A/B still inherit the calling user's global CLAUDE.md, contaminating the baseline condition
tags: [fixture-ab, prompt-authoring, subagent-isolation, global-claude-md, contamination, false-positive-baseline]
module: .claude/agent_docs/prompt-authoring.md (fixture A/B method); commands/ba/review-plan.md (":540" spec-decision clause)
symptom: "main"-condition (baseline) subagent runs in a fixture A/B surfaced a target behavior (a scope-conversation flag) that the baseline prompt text under test does not itself specify
---

# Fixture A/B baselines can be contaminated by the caller's global CLAUDE.md

## Problem

While running the fixture A/B method from `.claude/agent_docs/prompt-authoring.md` for a
Step 5 change to `commands/ba/review-plan.md` (a new "Scope-boundary anchor" rule), several
"main"-condition (baseline / unmodified-prompt) subagent runs surfaced the exact behavior the
new rule was meant to add — even though the baseline prompt text under test contains no such
rule. The method's isolation instruction ("no repo access, base your answer purely on the text
provided") did not prevent this.

Full run and worked cells: `docs/research/2026-07-28-review-plan-scope-anchor-ab-research.md`
(fixtures F1/F2).

## Investigation

Fixture F1 (an exclusion whose literal wording arguably permits a remedy, so resolving it
requires "arguing" one way or the other) was run three times with progressively tightened
exclusion wording, trying to reach a version where the baseline missed it and the proposal
caught it — the separation the A/B's declared pass/fail rule needed. Every attempt showed
both conditions agreeing instead: v1/v2 both missed it (the exclusion's own wording already
settled the question), v3 both caught it (tightened to an unambiguous crossing).

Tightening the fixture wording treated "no separation observed" as a fixture-calibration
problem. It wasn't — reading the "main" condition's full reasoning trace (not just its
structured verdict field) showed several cells quoting, near-verbatim, a rule from the
calling user's personal `~/.claude/CLAUDE.md`: *"Scope reductions escalate — always...
overriding a sub-agent/tool that flagged an open decision must be surfaced to me
conversationally."* That rule has nothing to do with `review-plan.md`'s Step 5 text under
test. Fixture F2 showed a second, independent confound: the baseline caught it via the
plan's own **pre-existing** generic classifier clause (`:540`, "affects... scope"), which
already existed before the new mechanism and can catch an explicit-enough fixture on its own.

## Root Cause

The "no repo access" instruction only blocks *tool-mediated* repo access (Read/Grep/Glob/
Bash). It does not and cannot exclude the calling user's global CLAUDE.md, which is loaded
into every general-purpose subagent's context automatically as part of environment setup —
independent of, and prior to, any tool-access restriction. A "no repo access" cell is
therefore not a clean-room text-only cell; it's "the text under test plus whatever global
instructions happen to be loaded," and that confound is invisible in the structured verdict
alone (e.g. `spec_decision_scope: true` looks identical whether it came from the mechanism
under test or from an unrelated global rule). It only surfaces in the subagent's stated
reasoning trace.

A second, independent confound: a fixture explicit enough to trigger the new mechanism can
also be explicit enough to trigger a pre-existing generic clause already present in the
artifact under test — so "does the baseline miss it" needs a fixture that isolates the
*specific* new mechanism, not "scope" (or whatever category) in the generic sense.

## Solution

1. **Read each subagent's full reasoning trace, not just its structured verdict field**, and
   explicitly attribute the verdict to a specific source sentence or rule.
2. **When a "main"/baseline cell's positive hit cites text outside the fixture under test** —
   a global CLAUDE.md instruction, or a pre-existing generic clause already in the base
   document — treat that cell as confounded, not as evidence the new mechanism is
   unnecessary or that separation failed to appear.
3. **Report the honest outcome**, including "declared pass/fail criterion not met" when that's
   what happened, rather than iterating fixture wording until it happens to produce
   separation by leaning on the confound.

Attribution-check example to add to an A/B write-up:

```
Condition: main (baseline)
Verdict: spec_decision_scope = true
Reasoning excerpt: "...Scope reductions escalate — always... must be
  surfaced to me conversationally..." [quotes the user's global CLAUDE.md]
Attribution: CONFOUNDED — cites a global instruction, not the Step 5 text
  under test. Do not count this cell as "baseline misses it."
```

## Prevention

**Design the fixture to isolate the specific gap, not the general category.**
- Before writing a fixture, name in one sentence what the new mechanism adds that nothing
  else in the prompt/plan already covers. If that delta can't be named, there is no testable
  claim yet.
- Read every existing classifier/escalation clause in the artifact under test first, and
  build the fixture to sit inside the new mechanism's trigger but outside every existing
  generic clause's trigger.
- If no such fixture exists (the new mechanism's coverage is a strict subset of an existing
  clause), that is itself a finding — report it, rather than forcing a wording that "happens
  to separate."
- A useful minimal-pair structure: fixture A inside both the old generic clause and the new
  mechanism (sanity check — expected to fire under both conditions), fixture B inside the new
  mechanism only (the actual discriminating test).

**Don't rely on "no repo access" alone to isolate the calling user's global CLAUDE.md.**
- Treat "repo conventions" and "the user's global CLAUDE.md" as two independent
  contamination axes; "no repo access" only isolates the first.
- Where practical, instruct the subagent explicitly to evaluate only against the rules in
  the attached fixture text and to disregard any other personal or project conventions —
  weaker than true isolation (models don't always comply), but a cheap first line of
  defense, and worth stating as standard fixture boilerplate.
- Record which isolation approach was used in the A/B write-up, since it's part of what
  makes the result trustworthy.

**Require the discriminating evidence to live in the trace, not just the verdict.**
- Ask each subagent for (a) a verdict, (b) the exact clause/sentence it relied on, (c)
  confidence. If it can't quote a specific clause from the artifact under test, treat the
  result as inconclusive rather than a clean pass for either condition.
- Tells of a confounded cell: the rationale cites a rule not present in the fixture text; the
  rationale cites a broad/general clause instead of the specific new one being tested; a
  baseline cell independently reconstructs the treatment's reasoning chain in different
  words (convergent reasoning is a stronger confound signal than convergent labels).

**Report confound-suspected results as inconclusive, explicitly.** "Baseline flagged fixture
B, but its rationale relied on [external rule / pre-existing clause], not on [the new
mechanism]. Cannot confirm or deny effect without a fixture that sits outside both" is a
complete, legitimate A/B finding — not a failure to find one clean fixture wording.

## Related Documentation

Written first; two later entries extend it into a family of three instrument-failure axes.

- [`2026-07-31-probe-instrument-validation-false-zeros.md`](2026-07-31-probe-instrument-validation-false-zeros.md)
  — **mechanism and filesystem** contamination: a capture mechanism that removed the very tool
  whose invocation it was measuring (every cell a false zero, in both arms), and parallel sessions
  sharing one fixture directory and reading each other's output. Also supplies the positive-control
  and per-run-isolation prescriptions, and the floor-effect rule that generalizes this entry's
  "report the criterion as not met rather than iterating the fixture until it separates."
- [`2026-07-31-global-instructions-replace-the-step-under-test.md`](2026-07-31-global-instructions-replace-the-step-under-test.md)
  — **subject** substitution: the same global-`CLAUDE.md` leak documented here, but in a live-harness
  run, where it replaced a *workflow step* rather than biasing a conclusion. Symmetric across arms,
  so it left no asymmetry to spot; the evidence was in the arms' own prose, not the tool log — the
  log-level analogue of this entry's "read the reasoning trace, don't score the verdict field."

Check all three axes on any prompt-behavior run; a clean bill on one says nothing about the others.
