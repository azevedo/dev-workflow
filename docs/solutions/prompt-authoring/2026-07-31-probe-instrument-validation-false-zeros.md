---
date: 2026-07-31
category: prompt-authoring
problem: a live-harness A/B on skill trigger behavior returned two confident, plausible, wrong matrices — the deny mechanism removed the tool whose invocation it was measuring, and parallel sessions shared one fixture directory and read each other's output
tags: [fixture-ab, skill-triggering, positive-control, test-isolation, pretooluse-hook, floor-effect, instrument-validation]
module: live-harness A/B instrumentation (claude --plugin-dir, PreToolUse Skill deny hook, per-run fixture repos); skills/ba-*/SKILL.md description fields
symptom: every cell scored 0/3 in both arms while the session reported "no Skill tool loaded"; after that was fixed, two apparent misses turned out to be sessions reading plan files written by concurrent sessions sharing one cwd
---

# A prompt-behavior probe can manufacture the result you expected

## Problem

The measurement: does rewriting a skill's `description:` change whether a model
autonomously *fires* that skill? Design — `claude --plugin-dir <arm> -p "<cue>"`, six cues
× two arms (old text / new text) × three repetitions = 36 non-interactive sessions, scoring
per session "did the model emit a `Skill` tool_use?".

Two instrument-level bugs each produced a **fully populated, plausible, wrong matrix**. In
both cases the harness artifact biased results toward "no effect / regression" while leaving
the output looking entirely normal.

## Investigation

**Attempt 1 — suppress the skill so only the decision is observed.** A real skill run costs
~10 minutes and ~270k tokens, and the experiment needs only the *decision*, not the
execution. So: deny the `Skill` invocation and count denied attempts.

- `claude --disallowed-tools Skill …` did not reject calls. It removed the `Skill` tool from
  the session **and the entire available-skills listing**. Observed symptom: the model
  replied that no `Skill` tool was loaded, then went looking for skills by globbing
  `SKILL.md` files off disk.
- `--settings` carrying `{"permissions":{"deny":["Skill"]}}` behaved identically — the tool
  is dropped from the session, not rejected at call time.

Why this is worse than a plain breakage: with no `Skill` tool in the list, no attempt is
*possible*, so every cell scores 0/3 in **both** arms. Nothing in the summary table
distinguishes "no skill fired" from "no skill could fire" — and the false reading happened
to be the "the rewrite changed nothing" answer that was already plausible.

**Attempt 2 — run all 36 sessions in parallel against one fixture repo.** Sessions that
*did* fire wrote plan files into the shared fixture's `docs/plans/`; later sessions read
them. Two apparent misses were cross-talk, not evidence about the text under test:

- one declined because the plan artifact already on disk didn't match the feature
  description it had been handed;
- one declined because "a plan for this already exists".

Why this was hard to see: the contaminated matrix looked clean and carried a *believable
regression signal* — one true-positive cue apparently dropping from 3/3 to 2/3. It was
caught only by opening an individual miss's transcript instead of reading the summary table.

## Root Cause

**Failure 1.** `--disallowed-tools` and `permissions.deny` operate at *tool-availability*
level, not at call time. Denying `Skill` unregisters the tool, and with it the skills
listing the model reads to decide whether a skill applies. The experiment's dependent
variable *is* that listing plus the resulting call, so the suppression mechanism deleted the
very surface under measurement. It was not a cheap observer; it was an unintended edit to
the independent variable.

**Failure 2.** Skill runs are not read-only — firing writes artifacts into `docs/plans/`.
With one shared cwd, session N's output became session N+1's input, and the skill's own
"does a plan already exist / does it match?" reasoning turned that output into a *reason to
decline*. Concurrency promoted a write side effect into a hidden independent variable
pushing toward fewer fires.

**The unifying principle.** Both times the harness, not the treatment, produced the result.
So: **before trusting any zero, prove the instrument can produce a non-zero, and prove each
trial is independent.**

## Solution

**1. Deny at call time with a `PreToolUse` hook, not by removing the tool.** The hook leaves
`Skill` in the tool list (so the model can still decide to use it), logs the attempt, and
denies — so no expensive body runs. Passed via `--settings`:

```json
{
  "permissions": { "allow": ["Read", "Grep", "Glob"] },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Skill", "hooks": [ { "type": "command",
        "command": "printf 'SKILL_ATTEMPT\\n' >> \"$CLAUDE_PROBE_LOG\"; printf '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"probe: skill invocation blocked\"}}'" } ] }
    ]
  }
}
```

`CLAUDE_PROBE_LOG` is set per session, so the attempt log is per-run rather than shared.

**2. Run a positive control before trusting any zero.** Issue a prompt that explicitly
demands the skill by name. A working rig produces all three of: a `Skill` tool_use in the
transcript, a blocked tool_result, and the hook's `SKILL_ATTEMPT` log line. This is the
check that catches Failure 1 in one session instead of 36.

**3. Verify arm distinctness at the exact surface under test.** Before spending the budget,
ask each arm to quote back the `description:` text it sees *in its own skills listing*, and
diff the two. This confirms cheaply that `--plugin-dir` really surfaces the working copy
(not a cached, `origin/main`-derived plugin), and that the arms differ where intended and
nowhere else.

**4. Give every session its own working directory.** Build a pristine template from the
fixture's initial commit, then hand each run a fresh copy:

```sh
# once — template from the fixture's root commit, so no earlier experiment's artifacts leak
(cd "$fixture" && git archive "$(git rev-list --max-parents=0 HEAD)") | tar -x -C "$template"

# per session — fresh copy keyed by arm/cue/rep
work="$runs/$arm-$cue-r$rep"; mkdir -p "$work"; cp -R "$template/." "$work/"
(cd "$work" && git init -q && git add -A && git -c user.email=p@p -c user.name=p commit -qm init)
```

**5. Score by parsing the event stream.** Run with `--output-format stream-json --verbose`
and count `tool_use` entries named `Skill`; the hook log is the cross-check.

**6. Read the transcript for every miss.** A miss is evidence about the prompt text only if
the transcript shows the model declined *on the merits of the cue*. Both bugs were invisible
in the aggregate and obvious in a single transcript.

## Prevention

**Ship a blocking positive control, because a broken instrument and a true null are
byte-identical.** The 0/3-everywhere matrix was equally consistent with "descriptions don't
change firing" and "the harness cannot record a firing." Make the control a cell that *must*
be non-zero, run through the identical capture path, and make the scoring step refuse to
emit a matrix when it fails — rather than emitting one a tired human then reads as data.
Write the void condition down before the run, because afterwards you will be motivated to
explain the zero away.

**Diff what the model actually received, not what you edited on disk.** For any prompt-level
manipulation the first artifact is a byte-diff of the surface as the session reports it. An
empty diff means there is no experiment, however the scores land. This same check catches
loaded-at-session-start staleness, config precedence surprises, and plugin caching — three
failure modes that all present as "my edit had no effect."

**Ask whether the instrument shrinks the choice set.** For each mechanism, enumerate what it
changes about the prompt, the tool inventory, and the skills listing. Prefer mechanisms that
fire at *invocation* time and leave pre-decision context untouched. Treat "I denied it so it
wouldn't really run" as a phrase that always earns this check: run one session with
instrumentation and one without, and confirm the reported tool/skill inventory matches.

**If the behavior under test writes anything, runs are not independent without isolation.**
Files, git history, a database, a cache, a log the agent later reads — any of these makes run
order a hidden variable. Materialize a fresh fixture per run keyed by cue/arm/rep; never a
shared checkout, and never rely on cleanup between runs when the runs are parallel. Add a
tripwire so isolation failure is loud: snapshot the fixture's file list before each run and
assert at scoring time that no run saw a file it didn't create.

**Pre-register the baseline the design needs, then pilot it.** This probe existed partly to
show the rewrite *reduces* false firing — but the baseline never false-fired (0/3 on every
ambiguous cue), leaving no room to measure a reduction. That floor effect was knowable in
advance: write down the baseline value each direction requires (to see a reduction from N/3
the baseline must sit materially above 0/3), and pilot the baseline arm alone to check.
Report a floor effect as **the design could not have detected this**, which is weaker and
different from **there was no effect**.

**Pre-commit the claim to the sample size, in writing.** At three reps the finest available
distinction is 0/3 vs 3/3, so a 2/3-vs-3/3 shift is noise on a stochastic subject — and six
cues × two arms invites reading one flipped cell as a regression. Draft the claim sentence
with the numbers already in it and hold to it. If the threshold is unreachable at an
affordable budget, that is a finding about the design, best had before the run.

**Log provenance, and treat the corrected run as the only run.** Record per run: arm, cue,
rep, working directory, resolved config/permission state, the tool and skill inventory the
session reported, and the harness version. When an instrument bug is found, discard the
earlier matrix entirely rather than patching affected cells — the contaminated cells you
*found* prove the run had an unmodeled dependency, and there is no principled way to certify
the ones you didn't check.

## Related Documentation

- [`2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`](2026-07-28-fixture-ab-subagent-claude-md-inheritance.md)
  — subagents dispatched with "no repo access" for a fixture A/B still inherit the caller's
  global `CLAUDE.md`, contaminating the baseline condition. The same failure family in the
  same measurement method: an isolation mechanism believed to hold that silently didn't, so
  every cell's number was untrustworthy. Its "verdict field looks identical whichever source
  produced it" maps onto the false-zero deny mechanism here, and its "report the criterion as
  not met rather than iterating the fixture until it separates" is exactly this entry's
  floor-effect null. Read together, that doc covers **context** contamination of the
  instrument and this one covers **mechanism and filesystem** contamination.
- [`2026-07-31-global-instructions-replace-the-step-under-test.md`](2026-07-31-global-instructions-replace-the-step-under-test.md)
  — the third member of the family, and the one that contaminates the **subject** rather than
  the instrument: the caller's global `CLAUDE.md` replaced the workflow step under test with an
  inline substitute, identically in both arms, so it produced no asymmetry to notice. It followed
  this entry's positive-control and per-run-isolation prescriptions (both held) and its
  floor-effect prescription — piloting the baseline arm alone, which is what finally established
  that the targeted failure does not reproduce. Its addition is why the "read together" pairing
  above is now a set of three; check all three axes, because a clean bill on one says nothing
  about the others.
