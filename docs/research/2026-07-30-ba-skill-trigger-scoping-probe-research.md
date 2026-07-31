---
date: 2026-07-31T00:00:00+0100
researcher: Claude
git_commit: 10fe9a803bbd5d176654882b352895ba3c1761f3
branch: ba-plan-desc
repository: dev-workflow
topic: "Live-harness fire/no-fire probe for the trigger-scoped ba-plan / ba-review-plan / ba-compound descriptions"
tags: [research, skills, model-invocation, prompt-authoring, live-harness, probe, cluster:model-fit]
status: complete
last_updated: 2026-07-31
---

# Trigger-scoping probe: does the rewrite change autonomous firing?

U6 of `docs/plans/2026-07-30-fix-ba-skill-trigger-scoping-plan.md`. The plan's text `Verify:`
lines prove authorship only; this is the behavioral check.

## Headline

**Null on the direction the change targets, with true-positive firing confirmed held.**

The plan's win condition was "false-positive rates drop **and** true-positive rates hold." Only
half of it is testable against this cue set: the **baseline false-positive rate was already 0/3 on
all three ambiguous cues**, so there was nothing for the rewrite to reduce. True-positive rates
held or rose in every cell.

The honest claim, stated at the strength the evidence supports: *this run is consistent with the
rewrite preserving wanted firing, and provides no evidence either way on unwanted firing, because
the baseline never fired on these cues.* It is **not** "the rewrite lowers false firing."

One result is stronger than a null and worth naming: on `tp2` the **old** description lost the job
to the model's own hands (0/3 — it hand-wrote a plan with `Write` instead of invoking the skill),
while the rewrite recruited the skill 2/3. That is the enumerated "Use when …" trigger list doing
work the capability blurb did not.

## Instrument

- **Arms.** **Arm A** = the three descriptions as on `main` (`c65387c`). **Arm B** = the U1–U3
  rewrites. Both arms are otherwise byte-identical copies of the working tree, including Arm A
  having the `ba-brainstorm` FAST-TRACK pointer removed.
- **Harness.** `claude --plugin-dir <arm> --settings <hook.json> --permission-mode dontAsk -p
  "<cue>" --output-format stream-json --verbose`, one fresh non-interactive session per repetition.
- **Fixture.** A throwaway repo (`README.md`, a 2-line `src/api.js`, and one decoy
  `plan_schema: 2` file in `docs/plans/`) so the auto-detect target exists and a fire is
  consequential.
- **Scoring.** A cell **fired** if a `Skill` tool_use appears in that session's stream. Rates are
  per cue per arm over 3 repetitions.

### `--plugin-dir` works — the plan's fallback was not needed

The plan hedged that `--plugin-dir` might not surface the working copy, since the live plugin is
served from an `origin/main`-derived cache. It does surface it. Verified directly by asking each arm
to quote the listing text it was given:

- Arm A returned `Transform feature descriptions into well-structured implementation plans…`
- Arm B returned `Produce a dated implementation plan in docs/plans/…`

No duplicate `dev-workflow:ba-plan` from the installed 0.39.0 cache appeared. The arms are
confirmed distinct **at the listing surface** — the exact pre-invocation surface this change targets.

Incidentally confirmed: the model-visible listing contains exactly `dev-workflow:ba-compound`,
`dev-workflow:ba-plan`, `dev-workflow:ba-review-plan`. The six flagged skills are absent from the
listing entirely. This is the plan's load-bearing observation, reproduced under the harness.

### The attempt-capture mechanism the plan specified does not work

The plan said to "configure permissions to **deny** the Skill invocation, so the *attempt* is
recorded without paying the cost of a real run." Two ways of doing that are broken, in a way that
would have produced a **silent false negative across every cell**:

- `--disallowed-tools Skill` removes the `Skill` tool *and the skills listing* from the session
  entirely. With no tool in the list, no attempt can be made, so every cell scores 0/3 in both
  arms — an instrument that always "proves" no-fire.
- A `permissions.deny: ["Skill"]` rule in `--settings` has the same effect: the tool is dropped
  rather than call-time-rejected.

What works is a **`PreToolUse` hook** matching `Skill` that returns
`permissionDecision: "deny"`. The tool stays in the list, the model can attempt it, and the
attempt is recorded and blocked before the body loads.

**Positive control (required, and passed):** an explicit "invoke the dev-workflow:ba-plan skill
now" prompt produced `TOOL: Skill {"skill":"dev-workflow:ba-plan"}` and a blocked result. Without
this control, every 0/3 in the table below would be uninterpretable — a broken hook and a genuine
no-fire look identical.

### A first matrix was run, contaminated, and discarded

The first full 36-session matrix was run with all sessions sharing **one repo directory, in
parallel**. They raced on `docs/plans/`, and sessions that fired wrote real plan files that later
sessions then read. Two apparent true-positive misses were traced to exactly this and to nothing
about the descriptions:

- one session declined because the on-disk artifact did not match the feature description it was
  handed;
- another declined because "a plan for this already exists."

That matrix is discarded, not reported. The results below come from a re-run in which **each
session gets its own pristine copy** of the fixture repo. Recorded here because the failure is
invisible in the output — the contaminated matrix looked like a clean, plausible result with a
`tp3` regression signal in it.

## Results

Six cues × two arms × three repetitions = 36 sessions. Twelve cells, raw counts, both directions.

### False-positive cues (should **not** fire)

| Cue | Text | Arm A | Arm B |
|---|---|---|---|
| `fp1` | "what would it take to add rate limiting here?" | 0/3 | 0/3 |
| `fp2` | "how would we do offline sync?" | 0/3 | 0/3 |
| `fp3` | "is it worth adding a cache layer?" | 0/3 | 0/3 |

**Floor effect — this is the probe's central limitation.** The baseline does not false-fire on
these cues, so they cannot measure a reduction. Any "improvement" here would be unmeasurable by
construction.

The rewrite is nonetheless demonstrably *read*: in `armB fp1` the model's own words were
"Answering directly rather than writing a plan — this is a 'what would it take' question," which
tracks the shed's phrasing. That is a mechanism trace, **not** a rate difference, and it does not
upgrade the null.

### True-positive cues (should still fire)

| Cue | Text | Arm A | Arm B |
|---|---|---|---|
| `tp1` | "plan the rate-limiting feature" | 2/3 | 2/3 |
| `tp2` | "write an implementation plan for offline sync" | 0/3 | 2/3 |
| `tp3` | FAST-TRACK-shaped body-directed chain + "just do it" | 2/3 | 3/3 |

No true-positive cell dropped. `tp2` rose from 0/3 to 2/3; in all three Arm A `tp2` sessions the
model hand-wrote a plan file itself rather than invoking the skill.

**The FAST-TRACK reasoning is falsifiable here and was not falsified.** The plan argued that
scoping the shed to the *cue* ("in conversation") leaves a body-directed FAST-TRACK invocation
outside it by construction, which is why no exemption clause was duplicated at the call site.
`tp3` went 2/3 → 3/3, so the shed did not disclaim the body-directed chain.

## Limitations

- **The false-positive direction is untested, not passed.** Baseline 0/3 across all three cues.
- **Cue-set bias.** All six cues were authored alongside the change they test, and the
  false-positive set leans on near-synonymous "how would we / what would it take / is it worth"
  phrasing — the exact phrasings the shed names. A pass would be evidence against *these*
  phrasings, not against the space of ambiguous cues. It is not even that here, given the floor.
- **n = 3 per cell.** The picker is stochastic. A 2/3-vs-3/3 or 0/3-vs-2/3 difference is a weak
  signal, not an effect size. Reading `tp2` as a real improvement would need more repetitions.
- **`tp3` is an approximation of the real chain, not the chain.** `ba-brainstorm` carries
  `disable-model-invocation: true` and is absent from the listing, so a model cannot enter
  FAST-TRACK autonomously. The cue reproduces the *shape* of the body-directed instruction rather
  than running `ba-brainstorm`'s body, which would cost a full brainstorm per repetition.
- **`dontAsk` grants `Write`.** The model can always satisfy a plan request by hand, which is a
  faithful reflection of a real session but means a no-fire can be "did it myself" rather than
  "declined to plan." `tp2` Arm A is exactly that case.
- **Only `ba-plan` was probed behaviorally.** `ba-review-plan` and `ba-compound`'s rewrites carry
  the same shape but no cue set of their own.

## Bottom line for the plan

U6 is **run, not blocked** — `--plugin-dir` worked, so the plan's "ship labeled unverified + file a
follow-up issue" fallback does not apply. The change ships with true-positive firing measured and
held, the false-positive claim explicitly **not** made, and the FAST-TRACK carve-out reasoning
tested rather than asserted.

A cue set drawn from real transcripts rather than authored here would be needed to say anything
about false firing. That is the follow-up worth filing.
