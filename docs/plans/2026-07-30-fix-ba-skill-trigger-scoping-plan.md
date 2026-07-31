---
title: Trigger-scope the three model-invocable ba-* skill descriptions
type: fix
plan_schema: 2
status: active  # human-authored only — /ba-execute ignores this for control flow; progress is git-derived
date: 2026-07-30
detail_level: standard
tags: [fix, skills, prompt-authoring, model-invocation, cluster:model-fit]
---

# Trigger-scope the three model-invocable ba-* skill descriptions Implementation Plan

## Overview

Three of the nine `ba-*` skills — `ba-plan`, `ba-review-plan`, `ba-compound` — omit
`disable-model-invocation: true` because another skill's body invokes them, which makes them the
only ones a model can fire autonomously. Their `description:` fields, carried over verbatim from
the retired command files, are capability blurbs with no boundary clause. This rewrites those three
descriptions on a three-part trigger-scoping shape and verifies the change with a live-harness
fire/no-fire probe. Origin: GitHub issue 71 (`cluster:model-fit`, `ready`).

## Current State

- Frontmatter for all nine sits at `skills/ba-<name>/SKILL.md:2-5` — `name`, `description`,
  `argument-hint`, then `disable-model-invocation: true` on line 5 for six of them.
- The three targets and their current descriptions:
  - `skills/ba-plan/SKILL.md:3` — `Transform feature descriptions into well-structured implementation plans following project conventions`
  - `skills/ba-review-plan/SKILL.md:3` — `Review a plan with available agents and skills before implementation`
  - `skills/ba-compound/SKILL.md:3` — already carries produces + trigger, no shedding clause
- The flag convention and its derivable criterion — *a skill omits the flag iff another skill's
  body invokes it* — is `CLAUDE.md:71`. The three dispatches it protects:
  `skills/ba-brainstorm/SKILL.md:148` (FAST-TRACK → `/ba-plan`), `skills/ba-plan/SKILL.md` Step 7
  (→ `/ba-review-plan --auto`), `skills/ba-propose/SKILL.md` Step 5f (→ `/ba-compound`).
- **Directly observed this session:** the model-visible skills listing contains exactly
  `dev-workflow:ba-compound`, `dev-workflow:ba-plan`, `dev-workflow:ba-review-plan`. The six flagged
  skills are absent from the listing entirely, not merely non-firing. This is the load-bearing fact
  behind the scope boundary below.
- `skills/ba-review-plan/SKILL.md:29-31` auto-detects with an unconditional
  `ls -t docs/plans/*.{md,html} | head -1`, and `:560` applies fixes by editing that plan file in
  place. Its side effect is a **write to an existing user artifact**, not a read.
- `skills/ba-execute/SKILL.md:22-38` auto-detects the most recent plan; the `plan_schema: 2` filter
  is at `:30-31`.
- CI (`.github/workflows/invariants.yml:22-23` → `scripts/check-invariants.mjs`) reads **no** skill
  frontmatter. Two checks bear on this diff: `version-bump` (`:84`, `:419-456`) fails any commit
  touching `skills/` without a `.claude-plugin/plugin.json` version change; `retired-invocations`
  (`:89-92`) fails on the `/ba:` colon form anywhere under `skills/`.
- `.claude-plugin/plugin.json:3` — `"version": "0.39.0"`.
- Authoring constraint: `.claude/agent_docs/prompt-authoring.md:15-20` — a `description:` is
  steering for model judgment, not a machine-boundary contract, so it states the goal and stops.
- The listing truncates a description at 1,536 characters and competes for a listing character
  budget; with only three of nine listed, budget pressure is low but not zero.

## Acceptance Criteria

- AC1: `ba-plan`'s description carries all three parts — what it produces, an enumerated "Use when
  …" trigger list, and a "Not for …" shedding clause naming the conversational-question case that
  should not trigger it, with `/ba-research` offered as a **user-facing suggestion** rather than a
  claimed model route.
- AC2: `ba-review-plan`'s description carries the same three parts and additionally discloses that
  it edits the plan file **in place**. The newest-file auto-detect hazard is disclosed in the
  skill's **body**, at the auto-detect step, not in the description — it is a body-behavior fact,
  not a triggering fact.
- AC3: `ba-compound`'s description gains a shedding clause; its existing produces and trigger
  clauses survive verbatim.
- AC4: The six skills carrying `disable-model-invocation: true` are untouched by this change.
- AC5: **The length budget lives here and only here** — each rewritten description stays at or under
  **350 characters**; units cite this criterion rather than restating the number. Each also spells
  any sibling invocation in the hyphen form (`/ba-research`, never `/ba:research`). Enforced
  mechanically by a byte-count conjunct in U1–U3's `Verify:`, not merely asserted.
- AC6: A live-harness probe records, per cue and per arm, whether the skill was **attempted** —
  covering a false-positive cue set (conversational "how would we do X") and a true-positive cue set
  (explicit plan requests plus a FAST-TRACK-shaped confirmation). Results land in `docs/research/`.
- AC7: `.claude-plugin/plugin.json` `version` is bumped in the same commit as the `skills/` edits.
- AC8: `README.md`'s `/ba-plan` and `/ba-review-plan` sections reflect the new routing-away
  behavior and review-plan's in-place write.
- AC9: The plan states plainly that the wrong-plan `/ba-execute` path stays open after this change,
  and that closing it is a joint call with the plan-gate work rather than a silent omission.
- AC10: `skills/ba-brainstorm/SKILL.md:148` carries a one-line **pointer** to the constraint that its
  FAST-TRACK confirmation must stay non-conversational — a discoverability trace at the site where
  the risk sits, not a restatement of `ba-plan`'s shed.

## What We're NOT Doing

- **Not rewriting the other six descriptions.** They are absent from the model-visible listing, so
  their wording cannot affect triggering. This drops the issue's third bullet ("all nine
  descriptions carried over verbatim … a skill description also has to answer 'when should a model
  reach for this'"); user-approved.
- **Not disclosing side effects in `ba-plan`'s description.** The issue suggests naming the
  `docs/plans/` write and the `ba-review-plan --auto` chain; the issue's own comment marks this as
  beyond demonstrated precedent. Disclosure is limited to `ba-review-plan`, justified by this
  repo's harm profile (it mutates an existing plan) rather than by the sibling plugin's silence.
  User-approved.
- **Not running the fixture A/B the issue specifies.** That instrument hands a subagent a
  specification excerpt and scores what it produces — post-invocation body behavior. Triggering is a
  pre-invocation picker decision over a listing under a character budget, which the A/B does not
  reproduce. Its documented confound
  (`docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`) also
  bites unusually hard here: the caller's global `CLAUDE.md` opens with "Bias toward caution over
  speed", which biases a "should I fire this expensive skill?" judgment toward the treatment's
  desired answer in *both* arms, making a baseline no-fire uninterpretable. Replaced by U6's probe.
  User-approved.
- **Not hardening either consumer.** No confirmation added to `ba-execute`'s auto-detect path, and
  no `plan_schema: 2` filter added to `ba-review-plan`'s `head -1`. User-approved as a joint call —
  see Dependencies & Risks.
- **Not making `ba-research` model-invocable** (`plan-introduced`, user-approved). Dropping its flag
  would make the routing clause a real dispatch, but adds a fourth autonomously-fireable skill with
  its own `docs/research/` write.
- **Not adding a FAST-TRACK exemption *clause*** to `skills/ba-brainstorm/SKILL.md:148` — no
  restatement of `ba-plan`'s shed at the call site, which is the defensive duplication
  `prompt-authoring.md:50-52` flags. A one-line **pointer** is added there instead (AC10, U1): the
  distinction is that a pointer names the constraint's existence without re-encoding its content, so
  there is nothing to drift. This revises the original exclusion, which barred touching the file at
  all; reopened and narrowed on review, user-approved.
- **Not touching `.claude-plugin/marketplace.json`** (`plan-introduced`, user-approved). Its
  description says "commands" and its `version` reads `0.1.0` against plugin.json's `0.39.0` —
  pre-existing drift, unrelated to this change, worth its own issue.

## Proposed Solution

Adopt the three-part shape the issue's comment extracts from `EveryInc/compound-engineering-plugin`,
which faces identical exposure and controls it entirely through description text: **(a)** one clause
on what the skill produces, **(b)** an enumerated "Use when …" trigger list instead of a capability
statement, **(c)** a shedding clause naming the adjacent case that should not trigger it.

Two wording decisions carry the weight:

**The shed targets the cue, not the origin's exploratory-ness.** `ba-plan`'s shed reads "Not for
answering 'how would we do X' … *in conversation*". FAST-TRACK is a body-directed invocation from
`skills/ba-brainstorm/SKILL.md:148`, not a conversational answer, so it falls outside the shed by
construction. This is why no exemption sentence is added at the call site: scoping the shed is
cheaper than duplicating a carve-out across two files, and U6's true-positive set includes a
FAST-TRACK-shaped cue precisely so this reasoning can be falsified rather than asserted.

**The `ba-research` mention is a suggestion, not a route.** `skills/ba-research/SKILL.md:5` carries
`disable-model-invocation: true` and `ba-research` is absent from the model-visible listing, so
"prefer `ba-research`" would promise a destination the model cannot take autonomously. Phrasing it
as something to suggest to the user preserves the issue's intent without a false promise.

Target text for the three descriptions:

**`ba-plan`**
> Produce a dated implementation plan in docs/plans/ for a scoped change the user has decided to
> build. Use when asked to plan a feature, bug fix, or refactor, or to turn a brainstorm into a
> plan. Not for answering "how would we do X" or "what would it take" in conversation — answer
> directly, or suggest /ba-research for a codebase question.

**`ba-review-plan`**
> Score a plan's sections with the built-in reviewers and, on approval, edit that plan file in
> place. Use when explicitly asked to review, critique, or strengthen a specific plan before
> implementing it. Not for general discussion of a plan or of planning.

The newest-file auto-detect hazard is **not** in this description. It describes what the skill does
*after* it is invoked, so it belongs in the body at the auto-detect step
(`skills/ba-review-plan/SKILL.md:29-31`), not in the triggering surface — and moving it buys back the
~70 characters that made this the longest of the three.

**`ba-compound`** (existing text preserved verbatim, shed appended)
> Document a recently solved problem to docs/solutions/ so future brainstorm/plan sessions can reuse
> it; use after solving a non-trivial, verified problem. Not for a problem still being diagnosed, or
> one whose fix is unverified.

## Technical Considerations

- **The `Verify:` lines below prove authorship, not behavior — deliberately.** For a description
  rewrite the artifact *is* the text, so a grep is the only mechanical check available.
  `prompt-authoring.md:61-63` flags verification that only proves the text exists; that flag is
  acknowledged rather than evaded, and U6 is the behavioral check. Each text `Verify:` is still a
  conjunction (old string absent **and** new clause present) so a half-applied edit fails.
- **`/ba-review`'s reviewer-discovery keyword filter** (`skills/ba-review/SKILL.md:269`) matches on
  `review`, `quality`, `audit`, `assess`, `compliance`, `architecture`. The whole `ba-*` family is
  already excluded by name in the **single-site** list at `skills/ba-review/SKILL.md:269`, so new
  vocabulary in these descriptions cannot create a false positive there. No mirror-site update
  needed on that axis.
- **No CI check reads frontmatter**, so a malformed edit fails silently. `CLAUDE.md:70` records the
  same hazard for `name`. This is why AC4's "six untouched" is asserted by a scoped diff check
  rather than assumed.
- **Length.** AC5 owns the number; it is not restated per-unit. The rationale: a 1,536-character
  truncation point plus listing-budget competition, and a cap so the enumerated trigger list cannot
  grow unbounded across later edits. Unlike the original draft this is **enforced**, by a byte-count
  conjunct in U1–U3's `Verify:` rather than an unchecked assertion repeated four times.
- **Commit grouping.** CI's `version-bump` check compares `HEAD~1..HEAD` locally but per-PR in CI,
  so U1–U4 belong in **one commit** — note U1 now touches `skills/ba-brainstorm/SKILL.md` too, and U2
  touches `ba-review-plan`'s body, both inside that same `skills/` commit. U5 and U6 may land
  separately. Every `Verify:` below is topology-free — none reads `HEAD~1..HEAD` — so resume stays
  correct whatever the commit split.
- **AC4's guard is a count, not an identity check.** U4's `Verify:` asserts six skills still carry
  `disable-model-invocation: true`; it would not catch a flag removed from one file and added to
  another. Accepted: U1–U3 name their files explicitly, and the six are outside their scope.

## System-Wide Impact

- **Interaction graph**: the three dispatch chains all read the changed listing text —
  `ba-brainstorm` FAST-TRACK → `ba-plan`, `ba-plan` Step 7 → `ba-review-plan --auto`,
  `ba-propose` Step 5f → `ba-compound`. None is exempt from the new wording, which is where the
  false-negative risk concentrates and what U6's true-positive set exists to measure.
- **Error propagation**: none. A description edit has no failure path; the failure mode is a wrong
  triggering decision, which is a probability shift, not an error.
- **State lifecycle risks**: a bumped `version` is the auto-update cache key, so a published bad
  description needs its own bump to roll back — a revert alone will not propagate.
- **"Model-initiated" is not a detectable condition.** `skills/ba-review-plan/SKILL.md:17-21` names
  `--auto` as the single mode signal; an autonomous fire without `--auto` is indistinguishable from
  a user-typed one. Any later "if invoked autonomously, confirm first" refinement would be an
  unevaluable condition, explicitly on `prompt-authoring.md:59-60`'s flag list. Recorded here so it
  is not added later as an apparent improvement.

## Implementation Approach

### Changes Required

**Files**: `skills/ba-plan/SKILL.md`, `skills/ba-brainstorm/SKILL.md`

#### U1 — Rewrite ba-plan's description, and leave a pointer at the FAST-TRACK call site

Replace line 3's `description:` value with the `ba-plan` target text from Proposed Solution. Quote
the value: it contains both a comma and a double-quoted phrase, so use **single-quoted** YAML. No
single-quoted precedent exists in the repo (`skills/ba-handoff/SKILL.md:3` and
`skills/ba-compound/SKILL.md:3` are both double-quoted) — single-quoting here is a deliberate
consequence of the embedded `"how would we do X"`, not a style match. Leave `name`,
`argument-hint`, and the absent `disable-model-invocation` untouched. Do not edit `ba-plan`'s body.

Then add **one line** at `skills/ba-brainstorm/SKILL.md:148`, immediately by the FAST-TRACK
auto-chain instruction. It must be a **pointer, not a restatement**: name that `ba-plan`'s
description sheds conversational cues and that this confirmation must therefore stay
non-conversational, without reproducing the shed's wording. Re-encoding the shed here is what creates
drift; naming its existence is what makes the invariant discoverable to an editor who opens only this
file. Something in the shape of: *"Keep this confirmation non-conversational — `ba-plan`'s
description sheds conversational cues, so a conversational rewrite here would silently stop this
chain from dispatching."*

Test scenarios:
- The three parts are each present and separable: produces, "Use when", "Not for" (Covers AC1)
- The shed says "in conversation", so a body-directed FAST-TRACK invocation is not disclaimed (Covers AC1)
- `/ba-research` appears in hyphen form and is phrased as a suggestion, not as "prefer" or "use" (Covers AC1)
- Description length satisfies AC5's budget (Covers AC5)
- YAML still parses — the skill remains registered and `/ba-plan` still loads its body (Covers AC1)
- The pointer at `ba-brainstorm:148` names the constraint without reproducing the shed's wording — a
  reader who never opens `ba-plan/SKILL.md` still learns the constraint exists (Covers AC10)

Verify: `! grep -q 'Transform feature descriptions into well-structured' skills/ba-plan/SKILL.md && sed -n '2,/^---$/p' skills/ba-plan/SKILL.md | grep -q 'Produce a dated implementation plan' && sed -n '2,/^---$/p' skills/ba-plan/SKILL.md | grep -q 'Use when' && sed -n '2,/^---$/p' skills/ba-plan/SKILL.md | grep -q 'Not for' && sed -n '2,/^---$/p' skills/ba-plan/SKILL.md | grep -q '/ba-research' && test "$(sed -n 's/^description: //p' skills/ba-plan/SKILL.md | head -1 | wc -c | tr -d ' ')" -le 360 && grep -q 'non-conversational' skills/ba-brainstorm/SKILL.md`

---

**File**: `skills/ba-review-plan/SKILL.md`

#### U2 — Rewrite ba-review-plan's description; move the auto-detect hazard into the body

Replace line 3's `description:` value with the `ba-review-plan` target text. The load-bearing
disclosure that stays in the description is that approved fixes **edit the plan file in place**
(`skills/ba-review-plan/SKILL.md:560`) — a fact a model needs *before* deciding to invoke.

The newest-file hazard moves to the **body**: add a caution at the auto-detect step (`:29-31`) stating
that the newest file in `docs/plans/` need not be the plan under discussion. It describes behavior
after invocation, so it is worthless in a triggering surface and it was the single largest consumer of
this description's length budget.

Test scenarios:
- The in-place write is disclosed in the description, not merely implied (Covers AC2)
- All three parts are present: produces, "Use when", "Not for" (Covers AC2)
- The newest-file hazard appears at the body's auto-detect step and **not** in the description (Covers AC2)
- The shed distinguishes "review this specific plan" from "discussing a plan" (Covers AC2)
- Description length satisfies AC5's budget, with headroom from the moved caveat (Covers AC5)

Verify: `! grep -q 'Review a plan with available agents and skills' skills/ba-review-plan/SKILL.md && sed -n '2,/^---$/p' skills/ba-review-plan/SKILL.md | grep -q "Score a plan's sections" && sed -n '2,/^---$/p' skills/ba-review-plan/SKILL.md | grep -q 'Use when' && sed -n '2,/^---$/p' skills/ba-review-plan/SKILL.md | grep -q 'in place' && test "$(sed -n 's/^description: //p' skills/ba-review-plan/SKILL.md | head -1 | wc -c | tr -d ' ')" -le 360 && sed -n '25,40p' skills/ba-review-plan/SKILL.md | grep -q 'need not be'`

---

**File**: `skills/ba-compound/SKILL.md`

#### U3 — Append a shedding clause to ba-compound's description

`ba-compound` is the in-repo template and already has produces + trigger; it lacks only part (c).
Append the shed from Proposed Solution to line 3's existing value, preserving the existing text
character-for-character so the template's provenance stays legible.

Test scenarios:
- The pre-existing produces and trigger clauses are byte-identical to before (Covers AC3)
- A shedding clause naming the still-diagnosing and unverified-fix cases is present (Covers AC3)
- Description length satisfies AC5's budget (Covers AC5)

Verify: `grep -q 'Document a recently solved problem to docs/solutions/ so future brainstorm/plan sessions can reuse it; use after solving a non-trivial, verified problem' skills/ba-compound/SKILL.md && sed -n '2,/^---$/p' skills/ba-compound/SKILL.md | grep -q 'Not for' && test "$(sed -n 's/^description: //p' skills/ba-compound/SKILL.md | head -1 | wc -c | tr -d ' ')" -le 360`

---

**File**: `.claude-plugin/plugin.json`

#### U4 — Bump the plugin version in the same commit as U1–U3

Bump `version` from `0.39.0` to `0.40.0`. It is the auto-update cache key, and
`scripts/check-invariants.mjs:419-456` fails any commit touching `skills/` without it. This unit
also carries the AC4 guard: the commit's diff must touch exactly the three target `SKILL.md` files
under `skills/`, leaving the six flagged skills byte-unchanged.

Test scenarios:
- `version` is exactly `0.40.0` — not merely different from `0.39.0`, which a wrong bump would also
  satisfy (Covers AC7)
- The `skills/` diff touches only `ba-plan`, `ba-review-plan`, `ba-compound`; exactly six skills
  still carry `disable-model-invocation: true` (Covers AC4)
- `scripts/check-invariants.mjs` passes: version-bump satisfied, no `/ba:` colon form introduced (Covers AC5, AC7)

Verify: `test "$(node -p "require('./.claude-plugin/plugin.json').version")" = "0.40.0" && test "$(grep -l 'disable-model-invocation: true' skills/*/SKILL.md | wc -l | tr -d ' ')" = 6`

---

**File**: `README.md`

#### U5 — Mirror the new boundaries in README's two skill sections

`CLAUDE.md` requires README to be updated whenever a skill changes. **Append** to each lead
paragraph; do not rewrite either one, because both carry a mirrored clause that must survive
byte-identical:

- `/ba-plan` lead (`README.md:98-100`) — add the routing-away behavior: exploratory "how would we do
  X" questions are **answered directly** rather than planned. `README.md:100` is one of three mirror
  sites for the `**Code-shape decision:**` label (`CLAUDE.md:96`); that clause stays verbatim.
- `/ba-review-plan` lead (`README.md:132-134`) — add that an approved review edits the plan file **in
  place**. `README.md:134` is one of three mirror sites for the never-hide **selection ledger**
  convention (`CLAUDE.md:87`); that sentence stays verbatim.

These are user-facing prose summaries, not verbatim copies of the frontmatter — do not paste the
description text. `CLAUDE.md`'s own `## Skills` bullets are paraphrases and none of the three is a
verbatim copy of a changed description, so they need no edit.

Test scenarios:
- README's `/ba-plan` section states that exploratory questions are answered directly, not planned (Covers AC8)
- README's `/ba-review-plan` section states the in-place write (Covers AC8)
- The `**Code-shape decision:**` clause and the `selection ledger` sentence are both still present (Covers AC8)
- Neither section pastes the frontmatter description verbatim (Covers AC8)
- No `/ba:` colon form is introduced — `retired-invocations` scans README (Covers AC5)

Verify: `grep -q 'Code-shape decision' README.md && grep -q 'selection ledger' README.md && grep -q 'in place' README.md && grep -q 'answered directly' README.md && ! grep -q '/ba:' README.md`

---

**File**: `docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md` (new)

#### U6 — Live-harness fire/no-fire probe, and record the result

The behavioral check the text `Verify:` lines cannot provide. Measure whether the rewrite lowers
autonomous firing on ambiguous cues **without** suppressing it on explicit ones.

Setup: a throwaway repo under `$TMPDIR` containing a `docs/plans/` with one decoy `plan_schema: 2`
file, so the auto-detect target exists and a fire is consequential.

Arms — **Arm A** the three descriptions as on `main`, **Arm B** the U1–U3 rewrites. Label every
recorded cell with its arm by those exact names.

Cue sets:
- *False-positive* (should not fire): "what would it take to add rate limiting here?"; "how would we
  do offline sync?"; "is it worth adding a cache layer?"
- *True-positive* (should still fire): "plan the rate-limiting feature"; "write an implementation
  plan for offline sync"; a FAST-TRACK-shaped confirmation ("just do it — add a `--dry-run` flag")
  reached through `ba-brainstorm`, which exercises the body-directed chain the shed must not
  disclaim.

Run: `claude --plugin-dir <working-copy>` so the working copy is read instead of the
`origin/main`-derived plugin cache, one fresh non-interactive session per **repetition**. Configure
permissions to **deny** the Skill invocation, so the *attempt* is recorded without paying the
~10m36s / ~270k-token cost of a real run.

**Repetitions — the picker is stochastic, so a single draw proves nothing.** Run each cue **3 times
per arm** (6 cues × 2 arms × 3 = 36 sessions) and score a *rate*, not a binary. A cue that fires 1/3
in one arm and 2/3 in the other is noise, not an effect. If cost forces fewer repetitions, then the
claim recorded in the research doc must be downgraded in the same edit — "this run is consistent
with lowered firing", never "the rewrite lowers firing". The claim and the sample size move together.

Score: fire rate per cue per arm, both directions counted. Win condition — false-positive rates drop
**and** true-positive rates hold. A rewrite that suppresses both is a regression, not a win. Record
every cell's raw count (`fired 2/3`), not a summary verdict.

**Cue-set bias is a known limitation, recorded not fixed.** All six cues are authored here, and the
false-positive set leans on near-synonymous phrasing. State that in the research doc: the probe can
falsify the rewrite, but a pass is evidence against *these* phrasings, not against the space of
ambiguous cues.

Fallback: `claude --plugin-dir` is undocumented in this repo and the commands→skills migration
recorded that the live plugin is served from a cache built off `origin/main`, making a working-copy
probe invisible to a fresh session. If `--plugin-dir` does not surface the working-copy skills, do
**not** substitute the fixture A/B. Ship labeled unverified, record the blocker in the research doc,
and **file a dedicated follow-up issue scoped to this claim** — do not fold it into the never-run
issue 41 probe, which is already stalled and would swallow this measurement without tracking it.

Write the outcome — including a null or blocked result — to
`docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md`. Research docs are
convention-exempt.

Test scenarios:
- Each of the six cues runs 3× in both arms; twelve cells recorded, each with a raw count (Covers AC6)
- The FAST-TRACK-shaped cue's true-positive rate holds in Arm B (Covers AC6)
- A blocked `--plugin-dir` is recorded as blocked, never as a clean pass, and a dedicated follow-up
  issue is filed rather than folding into issue 41 (Covers AC6)
- The doc names which arm each cell belongs to and states the cue-set bias limitation (Covers AC6)
- If repetitions were reduced below 3, the doc's claim is downgraded in the same edit (Covers AC6)

Verify: `test -f docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md && grep -q 'Arm A' docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md && grep -q 'Arm B' docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md && test "$(grep -cE '[0-9]+/[0-9]+' docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md)" -ge 12 && grep -qiE 'blocked|fired' docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md`

## Dependencies & Risks

- **The wrong-plan `/ba-execute` path stays open after this change.** A description is steering, so
  it lowers trigger probability and never reaches zero. One stray fire still leaves a well-formed
  `plan_schema: 2` file at the top of `docs/plans/`, and a later bare `/ba-execute` still targets
  it. This plan reduces stray-fire frequency; it does not close that path. Consumer-side hardening
  is deliberately out of scope (user-approved) and needs a **joint call** with
  `docs/brainstorms/2026-07-30-plan-gate-before-write-ordering-brainstorm.md`, which declines
  consumer-side guards on the reasoning "if the ordering invariant holds, no ungated plan exists to
  detect" (`:93-99`). That reasoning does not cover this issue — a spuriously triggered `ba-plan`
  produces a *fully gated*, well-formed plan. Two in-flight changes each decline consumer-side
  hardening by pointing at the other's threat model, and the union still leaves this open. File the
  joint call as its own issue; do not resolve it inside either scope. (Covers AC9)
- **A spurious plan is worse than an empty one.** `skills/ba-plan/SKILL.md` Step 0 auto-adopts any
  topic-matched `docs/brainstorms/` doc within 14 days and carries its decisions forward. A stray
  fire therefore yields a plan *seeded from an unrelated brainstorm* — more plausible to a later
  `/ba-execute`, and harder for the user to spot as spurious. This is the real failure shape.
- **The two consumers' blast radii differ.** `ba-execute` filters to `plan_schema: 2`
  (`skills/ba-execute/SKILL.md:30-31`); `ba-review-plan` takes `head -1` unconditionally
  (`skills/ba-review-plan/SKILL.md:30`). Review-plan's exposure to a stray file is strictly broader,
  so any future consumer-side guard must touch both.
- **The probe may be un-runnable** — see U6's fallback. If it is, this ships labeled unverified
  rather than backed by an instrument that cannot measure the claim.
- **Rollback needs its own version bump.** A published, cached `0.40.0` means a revert does not
  propagate on its own.
- **Pre-existing drift, out of scope, worth an issue**: `.claude-plugin/marketplace.json:10` still
  says "commands" and `:12` reads `version: 0.1.0`.

## Sources & References

- Origin: GitHub issue 71 — `[roadmap] ba-plan's description is a capability blurb, and it is now
  model-invocable` (`cluster:model-fit`, `ready`), plus its comment recording the
  `EveryInc/compound-engineering-plugin` precedent and the three-part extractable pattern.
- Flag convention and derivable criterion: `CLAUDE.md:71`
- Authoring rules: `.claude/agent_docs/prompt-authoring.md:15-20` (trust gradient), `:50-52`
  (defensive duplication), `:59-60` (unevaluable conditions), `:61-63` (verification that only
  proves text exists), `:73-93` (fixture A/B protocol)
- A/B confound: `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`
- Description-as-only-pre-invocation-surface, 1,536-char truncation, listing budget:
  `docs/research/2026-07-18-ba-compound-auto-trigger-and-ce-capture-research.md`
- Migration that carried the descriptions over verbatim:
  `docs/plans/2026-07-30-refactor-ba-commands-to-skills-plan.md:196`, executed in `c65387c`
- Consumers: `skills/ba-execute/SKILL.md:22-38` (`plan_schema: 2` filter at `:30-31`),
  `skills/ba-review-plan/SKILL.md:29-31` (`head -1` at `:30`), `:560` (in-place write)
- Mirror sites touched by U5: `CLAUDE.md:96` (`**Code-shape decision:**` label → `README.md:100`),
  `CLAUDE.md:87` (never-hide selection ledger → `README.md:134`)
- Dispatch chains: `skills/ba-brainstorm/SKILL.md:148`, `skills/ba-plan/SKILL.md` Step 7,
  `skills/ba-propose/SKILL.md` Step 5f
- CI: `scripts/check-invariants.mjs:84`, `:89-92`, `:419-456`; `.github/workflows/invariants.yml:22-23`
- Reviewer-discovery exclusion list: `skills/ba-review/SKILL.md:269`
- Joint-call counterpart: `docs/brainstorms/2026-07-30-plan-gate-before-write-ordering-brainstorm.md:93-99`

## Convention Compliance

- [x] Frontmatter completeness (`references/plan-sections.md`) — aligned; `origin` correctly omitted
      (standalone plan; origin is GitHub issue 71, recorded in Overview and Sources)
- [x] Filename `YYYY-MM-DD-<type>-<name>-plan.md` — aligned
- [x] Unit anchors `U<n> — <title>`, monotonic, each with `Test scenarios:` + exactly one `Verify:` —
      aligned (U1–U6 in ascending document order; the plugin-bump and README units were renumbered
      to keep order monotonic)
- [x] `Verify:` minting rules (code-matchable, read-only, source-state, wiring-not-presence) —
      aligned; all six executed and all six exit 1 today, so none is a false green. Each is a
      conjunction, and each is topology-free (no `HEAD~1..HEAD`) so resume is correct under any
      commit split. Strengthened on review: U1–U3 now enforce AC5's length budget by byte count and
      assert all three description parts (not just the shed), U3 pins the full preserved string, and
      U6 requires ≥12 recorded rate cells rather than passing on a near-empty stub.
- [x] Section-scoring review pass — 4 of 7 built-in reviewers dispatched (architecture,
      simplification, test-coverage, complexity); 21 raw findings → 10 after dedup; all 6
      above-floor Must-Address findings resolved, 4 low-confidence findings surfaced as suppressed.
      The scope-boundary anchor fired on the FAST-TRACK exclusion and was escalated, not
      self-resolved: the exclusion was reopened and narrowed to bar a duplicated *clause* while
      permitting a one-line pointer (AC10, U1).
- [x] `**Code-shape decision:**` label — not required: the plan contains zero fenced code blocks.
      The block-quoted description text is the artifact under change, a YAML string value that
      happens to be prose.
- [x] Retired `/ba:` colon form — aligned; the five occurrences all name the forbidden string rather
      than invoking it, and `docs/` is excluded from the CI scan by construction
      (`scripts/check-invariants.mjs:90-92`)
- [x] Never-hide selection-ledger mirror (`CLAUDE.md:87`) — aligned; U5 preserves `README.md:134`
      byte-identical
- [x] `**Code-shape decision:**` mirror (`CLAUDE.md:96`) — aligned; U5 preserves `README.md:100`
      byte-identical
- [x] U-ID axis / stack-base axis mirror grids — not applicable: those obligations fire on a change
      to the *convention*, and this diff touches only `description:` frontmatter
- [x] "Update README.md whenever skills … are changed" — aligned via U5 + AC8
- [x] Version bump in the same commit as the `skills/` edit — aligned via U4 + AC7
- [x] Scope exclusions carry provenance — aligned; all seven `## What We're NOT Doing` items are
      tagged, and the five `plan-introduced` reductions were escalated and user-approved before
      drafting
- [x] Justified override — declining the fixture A/B (`CLAUDE.md:112`): substituted by U6's
      live-harness probe, because the A/B measures post-invocation body behavior while this change's
      claim is about the pre-invocation picker decision, and the instrument's documented
      global-`CLAUDE.md` confound biases both arms toward the treatment's desired answer
- [x] Justified override — presence-only text `Verify:` lines
      (`.claude/agent_docs/prompt-authoring.md:61-63`): unavoidable when the artifact *is* the text;
      acknowledged in Technical Considerations, with U6 as the behavioral check
- [ ] Known debt — the wrong-plan `/ba-execute` path stays open (AC9). Consumer-side hardening is
      out of scope by decision and needs a joint call with the plan-gate work; file as its own issue.
- [ ] Known debt, pre-existing and unrelated — `references/plan-sections.md:97` and
      `skills/ba-execute/SKILL.md` mint markdown unit anchors as `### U<n>`, while all three
      templates in `skills/ba-plan/SKILL.md` emit `#### U<n>`. Every plan in the repo follows the
      template, so the owner text is the drifted side. Worth its own issue; not introduced here.
- [ ] Known debt, pre-existing and unrelated — `.claude-plugin/marketplace.json:10` says "commands"
      and `:12` reads `version: 0.1.0` against plugin.json's `0.39.0`. Worth its own issue.
