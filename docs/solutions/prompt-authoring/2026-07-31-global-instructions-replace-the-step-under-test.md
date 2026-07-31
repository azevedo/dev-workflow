---
date: 2026-07-31
category: prompt-authoring
problem: a two-arm live-harness dry run of a workflow step produced a clean directional result while neither arm actually executed the step under test — the caller's global CLAUDE.md replaced its subagent dispatch with an inline substitute, identically in both arms, so the substitution never showed up as arm asymmetry
tags: [fixture-ab, live-harness, global-claude-md, instrument-validation, mechanism-assertion, floor-effect, non-interactive-mode, contamination]
module: live-harness dry-run instrumentation (claude -p --plugin-dir, PreToolUse tool-call logging, per-run fixture repos); skills/ba-plan/SKILL.md Step 5 (Pre-Write Decision Gate)
symptom: baseline arm wrote a plan file at +125s and the treatment arm wrote none — the predicted direction — but the tool log showed zero Task calls in either arm, and each arm's own prose said it had done the gate's research inline instead of dispatching the four subagents the step specifies
---

# A global instruction can replace the workflow step you are measuring

## Problem

A wording fix to `skills/ba-plan/SKILL.md` removed a self-contradiction about when the plan
file is written to disk (issue #65: Step 5 is a "Pre-Write Decision Gate" that says "run
before writing the plan to disk", while Step 4 said a bare "Write the plan" and Step 5's own
item 5 said "Append compliance summary to the plan's end"). The fix was a coherence change,
but the *purpose* of the change is to alter how a model sequences its work, so a dry run was
run to see whether the write actually moved after the gate.

Two arms, one prompt, isolated fixtures:

| Arm | Plugin dir | Wrote a plan file? |
|---|---|---|
| baseline (pre-fix commit) | worktree at the parent commit | **yes**, at +125s |
| treatment (post-fix commit) | working copy | **no** — stopped and asked two questions |

The result points exactly the way the fix predicts. It is not evidence, and the tool log is
what says so: **zero `Task` calls in either arm.**

`skills/ba-plan/SKILL.md` Step 5 specifies dispatching `convention-checker`; Steps 1 and 3
specify `repo-researcher`, `learnings-researcher`, and `spec-flow-analyzer`. None of the four
ran. The gate mechanism under test was replaced, in both arms, by an inline substitute — one
step *upstream* of the behavior being measured.

## Investigation

**The instrument was validated first, and passed.** Every check the prior entries prescribe
was run before the arms:

- A `PreToolUse` hook logging `tool_name` + `file_path`/`subagent_type` + wall-clock to a file.
- A positive control: a throwaway "write a file and read it back" session, confirming the hook
  fires and logs both calls. (Without this, "no `Write` logged" is indistinguishable from "hook
  silently broken.")
- Per-run fixture directories, never a shared checkout, per the parallel-session race in
  [`2026-07-31-probe-instrument-validation-false-zeros.md`](2026-07-31-probe-instrument-validation-false-zeros.md).
- `--plugin-dir` confirmed to surface each arm's actual text, by asking each arm to quote back
  verbatim the line that differs between them. The treatment arm quoted the post-fix wording;
  the baseline worktree was grepped and carried all three pre-fix lines.

So the instrument was sound in every dimension the two prior entries cover. The failure was
somewhere those entries do not reach.

**What the arms actually did.** Both arms named their own deviation, in prose, unprompted. The
baseline's closing paragraph:

> "Two workflow deviations, per your standing 'no AgentTool unless requested': I did Steps
> 1/3/5 research inline instead of dispatching repo-researcher, learnings-researcher,
> spec-flow-analyzer, and convention-checker, and I skipped the auto-score pass. […] No
> `AskUserQuestion` tool is available in this session, so the gate ran on the non-interactive
> path — no violation was left unresolved, which is why the write proceeded."

Two independent confounds in one paragraph, both invisible in the tool log alone:

1. **A global instruction suppressed the dispatch.** The calling user's global `CLAUDE.md`
   carries "Do not call the AgentTool unless the user requested it." That instruction loads
   into the live CLI session and outranks the skill body's dispatch steps. The model substituted
   inline `Bash`/`Read` research for four subagent calls.
2. **The harness mode removed a tool the step depends on.** `claude -p` exposes no
   `AskUserQuestion`, so Step 5's interactive branch is unreachable and the run silently takes
   the no-interactive-answerer fallback. The interactive gate — the thing whose ordering was
   under test — could not run in either arm.

**Why the direction still looked clean.** The two arms differed in outcome (wrote vs. didn't)
for a reason unrelated to the fix: each made its own judgment about whether the convention
violation the fixture planted was user-resolvable. The baseline resolved it itself "by
compliance" and proceeded; the treatment arm escalated it. That is one coin flip at n=1, not a
measured effect.

**The floor effect, confirmed rather than asserted.** The deeper finding is that the baseline
**did not reproduce the bug at all.** It wrote at +125s, but *after* completing its convention
check — its own words: "no violation was left unresolved, which is why the write proceeded."
That is correct ordering. The failure this fix targets never occurred in the arm that was
supposed to exhibit it, so there was nothing for the treatment to prevent. This had been
predicted in advance from n=1 evidence (the origin issue recorded that both of its own
pre-merge runs sequenced correctly); the run's actual contribution was converting "suspected
undetectable" into "the design could not have detected this."

## Root Cause

The two prior entries in this family both describe contamination of the *measurement*: the
baseline's reasoning is fed from an unintended source, or the capture mechanism reports a false
zero. This is a different failure: contamination of the *subject*.

A live-harness dry run executes the real agent loop, so everything that normally shapes that
loop applies — the user's global instructions, the project's `CLAUDE.md`, the harness mode's
tool inventory. Any of those can **replace a step of the workflow under test with a different
step**, and the run will then measure the substitute while appearing to measure the original.

Two properties make it hard to catch:

- **It is symmetric.** A global instruction applies to both arms equally, so it produces no
  arm asymmetry, no outlier, and no signal in a between-arms comparison. Agreement between arms
  reads as robustness when it may mean both arms bypassed the mechanism.
- **The absence is quiet.** A step that did not run emits nothing. The tool log looked merely
  sparse (5 calls in one arm, 4 in the other); nothing in it says "four expected dispatches are
  missing." The evidence was in the arms' *prose*, which a verdict-field-only or log-only
  scoring pass would have discarded.

A subagent-based fixture A/B is less exposed to the first property, because a subagent is given
only the excerpt under test and does not execute a multi-step workflow. A live-harness run is
exposed precisely because its realism is the point.

## Solution

There is no fix that rescues this run — it is reported as "the design could not have detected
this", and the change it was meant to validate was merged on the strength of the coherence
argument alone, with the commit message making no behavioral claim. What follows is the
protocol for the next one.

**1. Assert the mechanism ran, before scoring anything.** Enumerate what the step under test is
specified to do — which subagents it dispatches, which tools it calls, which sentinel it emits —
and make each a pre-registered assertion on the log. If Step 5 is supposed to dispatch
`convention-checker`, then `Task(convention-checker) ≥ 1` is a precondition for the cell being
scorable at all. A cell that fails a mechanism assertion is **void**, not a data point.

**2. Treat arm agreement as suspicious, not reassuring.** When both arms behave the same, the
first hypothesis is that neither ran the mechanism. Check the assertions from (1) before
concluding the change had no effect.

**3. Neutralize or record the caller's global instructions.** They load into a live session and
outrank the skill body. Options, in descending strength: run with a clean or overridden global
config; or explicitly grant what the step needs in the prompt ("dispatch the subagents the skill
specifies; the standing no-AgentTool rule does not apply to this run"); or, weakest, record which
global rules were live so the result can be reinterpreted later. Do not assume a plugin-scoped
run is isolated from user-scoped instructions — it is not.

**4. Check the harness mode against the step's tool requirements.** `-p` has no
`AskUserQuestion`. Any step whose behavior depends on an interactive widget is unreachable
non-interactively and will take a fallback path instead — often a fallback whose own text admits
it is unevaluable. If the step needs a tool the mode does not provide, the mode is wrong for the
test, not merely inconvenient.

**5. Capture and read each arm's self-report.** Both arms here volunteered their deviation in
prose while the tool log showed only silence. Persist full stdout per cell and read it. This is
the log-level analogue of the prior entry's "read the reasoning trace, don't score the verdict
field."

**6. Pilot the baseline arm alone, and honor the pilot's answer.** This run did follow that
prescription and it paid: the baseline's failure to reproduce the bug is the single most useful
thing learned. The discipline is to stop there — "the baseline does not exhibit the failure" ends
the design, and the correct report is that the criterion could not be evaluated, not a
fixture-wording iteration until separation appears.

**7. Distinguish the two claims a coherence fix can make.** "This text no longer contradicts
itself" is verifiable by reading and needs no run. "This text changes how the model sequences its
work" is a behavioral claim and needs one. Ship the first on a read; do not let a passing dry run
of the first be reported as evidence for the second.

## Prevention

- **Pre-register the mechanism assertions in the same breath as the pass/fail criterion.** The
  existing discipline is to write down the claim sentence with its numbers before running. Extend
  it: write down what must appear in the log for a cell to count. Both halves belong to the
  design, and both are cheap before the run and impossible after.
- **Keep a standing confound checklist for live-harness runs**, since this family now has three
  distinct members and they are not deducible from one another: context contamination (global
  instructions reaching a subagent's reasoning), mechanism/filesystem contamination (a capture
  tool that removes what it measures; shared fixtures), and subject substitution (a global
  instruction or harness mode replacing the step under test). Check all three; a clean bill on
  one says nothing about the others.
- **Prefer a step-local probe to an end-to-end run when the question is step-local.** The
  question here was "does the write happen before or after the gate." An end-to-end
  `/ba-plan` run brings in every other step's confounds for no added information. A narrower
  harness that exercises Steps 4–7 with the gate's dispatch forced would have been both cheaper
  and less contaminable.
- **When the instrument defeats the question, say so and stop.** The failure mode this family
  keeps producing is a fully populated, plausible, wrong result. "Could not have detected this"
  is a weaker but honest finding, and it is the one that protects the next reader.

## Related Documentation

- [`2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`](2026-07-28-fixture-ab-subagent-claude-md-inheritance.md)
  — the caller's global `CLAUDE.md` reaches every subagent regardless of "no repo access",
  contaminating the baseline's *reasoning*. Same root ingredient as this entry (global
  instructions leaking into a run believed isolated), different casualty: there it changed what a
  cell concluded, here it changed which workflow step executed. Its "attribute the verdict to a
  specific source sentence, or treat the cell as inconclusive" generalizes directly into this
  entry's mechanism assertions.
- [`2026-07-31-probe-instrument-validation-false-zeros.md`](2026-07-31-probe-instrument-validation-false-zeros.md)
  — the deny mechanism removed the tool whose invocation it measured, and parallel sessions shared
  one fixture directory. Its positive-control and per-run-isolation prescriptions were both
  followed here and both held; its floor-effect prescription ("pilot the baseline arm alone")
  was followed here for the first time and produced this run's only durable result. Read the three
  together as one checklist: that entry covers **mechanism and filesystem** contamination, the
  2026-07-28 entry covers **context** contamination, and this one covers **subject** substitution.
