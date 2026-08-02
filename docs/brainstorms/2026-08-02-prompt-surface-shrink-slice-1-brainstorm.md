---
date: 2026-08-02
topic: prompt-surface-shrink-slice-1
status: approved
triage_level: full
tags: [prompt-weight, ba-review, ba-propose, ba-execute, reviewer-agents, issue-59]
---

# Prompt-Surface Shrink — Slice 1 (De-duplication & Residue)

## What We're Building

Issue #59 asks for the always-resident prompt surface of the `ba-*` family to shrink, using
progressive disclosure. Its checklist holds 7 items across 12 runtime files, ranging from
zero-risk deletions to a 295-line resolver split behind a new load site. This brainstorm scopes
**slice 1: the free wins only** — the three items that reduce weight by *de-duplicating* and
*deleting*, with no new `references/` file, no new load site, and no branch made
conditionally-loaded.

Slice 1 covers `skills/ba-review/SKILL.md` Step 3, the rubric duplicated into all 7 built-in
reviewer agents, and authoring residue in `skills/ba-execute/SKILL.md` and
`skills/ba-propose/SKILL.md`. The load-site extractions — the larger token prize — are
deliberately deferred to a slice 2 brainstorm.

## Why This Approach

**Two different "fixes" were conflated in the issue's checklist.** The checklist cites
`skills/ba-review-plan/SKILL.md:252-281` as the model fix for `ba-review`'s triplicated dispatch
templates. That precedent hoists shared text into a named in-body section — three templates in 41
lines versus `ba-review`'s 148. It kills *duplication* but keeps everything resident. Only a
`references/` load site actually removes weight, and `.claude/agent_docs/prompt-authoring.md:28-29`
endorses only the latter as a weight fix. So each checklist item needs a *technique* chosen, not
just a target. Slice 1 is defined as exactly the items where in-body de-duplication or deletion is
the right instrument.

**Slicing was chosen over a single 7-item plan** because the two halves make different claims.
Slice 1's changes leave the composed dispatch prompt byte-identical, so they carry no behavioral
delta for an A/B to measure. The deferred load-site extractions *do* make behavioral claims — and
`docs/solutions/prompt-authoring/` records three independent cases where a prompt A/B produced a
confident wrong answer. Mixing the two into one diff would force the whole slice onto the stricter
verification bar for no gain.

**Rejected:** *load-site extractions first* (highest token payoff, but front-loads the risky half
before the cadence is proven). *Per-file, biggest first* (keeps each diff reviewable against one
whole body, which `prompt-authoring.md:39-41` requires anyway — but splits the reviewer-rubric item
across a skill and 7 agents that must change together). *All 7 items in one plan* (mixes claim
types, as above).

**Honest accounting:** slice 1's *resident* win on `ba-review` is modest — roughly 100 of 1141
lines (~1.5k of ~17.9k tokens). The 7-agent rubric win (~119 lines) is per-dispatch, not resident.
The real resident prize is slice 2's ~900 unreachable lines. Slice 1 is worth taking first because
it is free, not because it is large.

## Key Decisions

- **Scope: three items, one squashed commit on `main`** — de-triplicate `ba-review` Step 3, replace
  the 7-agent rubric, purge residue. Rationale: all three are deletion-or-hoist with no behavioral
  delta; they share one verification run and one version bump.
- **Technique: in-body hoist, no new `references/` file** — the bullet grammar loads on *every*
  dispatch in Step 3, so it is not branch-only material.
  `.claude/agent_docs/prompt-authoring.md:25-29` sends only branch-only material to `references/`.
  This also avoids inheriting the `referencesCheck` citation obligation.
- **Hoist shape: full mirror of `ba-review-plan`'s two-section structure** — a top-level grammar
  section hoisted *out* of Step 3, plus `### Dispatch instructions — apply to ALL templates`, plus
  citing stubs. Rationale: it is the cited precedent, it makes the two review skills readable side
  by side, and it pre-positions the grammar as one block slice 2 could relocate.
- **Section name: `## Code-Anchor & Confidence Grammar`** — parallel to
  `skills/ba-review-plan/SKILL.md:192`'s `## Plan-Anchor & Confidence Grammar`. An earlier draft
  said `Reviewer-Anchor`; that names the wrong thing, since the anchor is a code location.
- **The 7 agents get citation + ladder/calibration line + literal legal values, not citation alone**
  — three lines per agent, not one. Rationale in `## Scope Boundaries`; this was a deliberate
  reversal mid-brainstorm, then revised again at plan time (see the amendment note at the end of
  this document) once it was verified that the deleted block carried ladder *definitions* and
  anchor *meanings* as well as the position rule.
- **The rubric's "defence-in-depth" hedge is removed, not preserved** — its stated premise ("a
  reviewer reading only its own agent file still sees the rubric") is false under both current
  dispatchers, which always inject the rubric. It also names §4 as authoritative while the copied
  text actually tracks Step 3's templates.
- **Residue: cut the authoring frame, keep the substance** — delete text that addresses the repo's
  history; restate text that states a real contract limit as a plain limit.
- **Verification: one fresh-session dry-run asserting the mechanism ran** — not a 9-cell fixture
  A/B. Justified in `## Convention Compliance` (J2).
- **`.claude-plugin/plugin.json` bumps from `0.41.0` inside the same squashed commit** — `skills/`
  and `agents/` are both in `VERSION_BUMP_WATCHED_PREFIXES`, and the checker reads `HEAD~1..HEAD`.

### Item 1 — De-triplicate `skills/ba-review/SKILL.md` Step 3 (`:408-560`)

Three dispatch templates (agent-based `:414-458`, skill-based `:460-503`, user-typed `:505-555`)
each embed a byte-identical 29-line block: the severity ladder, the bullet grammar
`- **<path>:<line>** *(confidence: N)* — <body>` with `N ∈ {0, 25, 50, 75, 100}`, the anchor-scope
paragraph, the Heading/Meaning and Confidence/Meaning tables, and the protected-artifacts guard.
Identity verified at `:426` ≡ `:472` ≡ `:524` and `:446` ≡ `:492` ≡ `:544`.

Target: ~148 lines → ~55-60. (This document originally said ~45, which assumed the three templates
could collapse onto a shared context block. They cannot — see the amendment note at the end.) Two
constraints on the rewrite:

- **`:412` must survive.** The never-hide disclaimer ("the selection ledger shows bare display
  names … this does not affect ledger presence or the never-hide convention") sits inside the
  range. It is dispatch preamble, not template body.
- **The new section carries `ba-review-plan:194-196`'s framing** — "parser contract … the literal
  authority — do not re-derive it from prose elsewhere" — so both halves of the mirror assert the
  same strength. `skills/ba-review-plan/SKILL.md:197`'s file-level citation is tightened to name
  the new section.

### Item 2 — Replace the rubric in all 7 built-in reviewer agents

`agents/{architecture,simplification,security,error-handling,test-coverage,complexity,deep-module}-reviewer.md`
each carry an identical 19-line block plus the hedge blockquote — 133 lines total. Replaced by three
lines per agent: a bare citation of `skills/ba-review/SKILL.md`'s new grammar section; a compact line
preserving the ladder definitions and confidence-anchor calibration the block carried; and the
literal `N ∈ {0, 25, 50, 75, 100}` and the position rule ("confidence sits between `**file:line**`
and `— body`"). Recovers ~112 lines.

Note the literal is **introduced** to these files, not normalised — no agent carries it today; they
enumerate anchors one per line instead.

Citation form is **bare**, with no `${CLAUDE_PLUGIN_ROOT}` prefix — the prefix exists because a
skill resolves *bundled* paths relative to its own `SKILL.md`, and a repo-relative path to another
skill's body is not a bundled path. Consistent with all 7 agents' existing bare citations and with
`skills/ba-review-plan/SKILL.md:197`.

### Item 3 — Purge authoring residue

**Delete outright** — text addressing the repo's history rather than the model executing it:

- `skills/ba-execute/SKILL.md:410-415` — the 6-line "Five-site walk (U-ID convention edit)"
  blockquote. Cites retired `plan.md`/`review-plan.md` paths and shipped plan unit IDs (U3/U4/U6),
  and restates the mirror-site grid `CLAUDE.md:100-110` now owns. Already stale: it says "five
  citation sites" while `README.md:264` correctly gives six on the U-ID axis and four on
  stack-base. It sits in `## Step 1: Initialize`, not inside either owned convention section, so
  neither axis loses anything.
- `skills/ba-propose/SKILL.md:30` — `(Review fix: this list previously lived as two independent
  near-verbatim copies …)`.

**Restate, keeping the substance, dropping the authoring frame:**

- `skills/ba-propose/SKILL.md:507` — the unparenthesised `Review fix: measuring narrative-only up
  front …` sentence.
- `skills/ba-propose/SKILL.md:296` — third `Review fix:` site, found by the convention check. Its
  frame goes, but the substance is load-bearing (prompt-spec files under `skills/`, `agents/` are
  executable logic, not passive docs, so they must fall through to **pending**). It additionally
  spells the retired `commands/*.md` layout as if live, which the restatement fixes.
- `skills/ba-execute/SKILL.md:227`, `:275`, `:282` — the three `Residual (documented):` notes. The
  `(documented)` frame is the residue; the limits are contract. `:227` documents the winner-only
  fetch trade and its re-selection fallback; `:275` and `:282` bound what `FOREIGN_UID_IN_WINDOW`
  can detect, and `:282` in particular is what stops a reader concluding the guard is a general
  foreign-window detector.
- `skills/ba-execute/SKILL.md:144` **and** `:145` — two further residual notes, found by the
  convention check. (This document originally described `:145` as "the fourth residual note",
  singular; they are two distinct limits on adjacent lines — see the amendment note at the end.)
  Both sit inside the owned `## U-ID & Git-Derived State Convention` section, so they get the same
  treatment as the other three by the criterion already chosen.

## Scope Boundaries

**Deferred to a slice 2 brainstorm — the `references/` load-site extractions.** These are the
larger prize and carry a genuine behavioral claim, so they get their own scoping and their own
verification bar:

- `skills/ba-review/SKILL.md:714-831` — the `--persist` step (118 ln), which says at `:716` that it
  "has no effect on the default flow" yet loads every run.
- `skills/ba-review/SKILL.md:837-1132` — the local-scope (`:837-999`) and MR-scope (`:1001-1132`)
  resolvers, 295 lines of which exactly one runs per invocation. Plus the 1b/1c diff-capture pair
  (`:54-121`, `:123-194`, 140 ln).
- `skills/ba-propose/SKILL.md:735-887` — Step 5f (153 ln), reachable only on
  `ACTION == commit_push_create` after a successful push.
- `skills/ba-propose/SKILL.md:350-520` — the Step 3 composition spec (171 ln).
- `skills/ba-plan/SKILL.md:249-470` — the three detail-level templates (220 ln, of which 107–180
  are dead per run). Note this touches the `**Code-shape decision:** <why>` mirror obligation.

**Not doing: extracting the bullet grammar to `references/`.** It loads on every dispatch, so it is
not branch-only material. `prompt-authoring.md:25-29` does not endorse `references/` for
always-reached text, and it would add a `referencesCheck` citation obligation for no weight gain.

**Not doing: citation-only in the 7 agents.** This reverses an earlier decision in this
brainstorm, on a convention-check finding. The 19-line block is the only place the legal confidence
values and the position rule are enumerated inside the agent's own context. Under `/ba-review` that
is harmless — the orchestrator injects them, and `skills/ba-review/SKILL.md:594` snaps an
out-of-set `N` to the nearest anchor. But these 7 agents are independently registered dispatch
targets (`dev-workflow:security-reviewer` et al.), invocable outside both review skills, where no
consolidation pipeline exists to snap anything. Trading 7 lines to keep a machine-boundary contract
specified to the character is the right side of that call, and it removes the need for a second
standalone-dispatch verification arm.

**Not doing: dropping standalone dispatch as a supported path.** It was considered as a way to take
the full 126-line win. Declined — it is a real capability reduction for 7 lines.

**Not doing: relaxing any machine-boundary contract.** Per issue #59's own caution: sentinels, the
reviewer bullet grammar, the U-ID grammar, `resolve-stack-base`, and the single-Bash-call heredoc
invariant all stay specified to the character.

## Acceptance Criteria

- `skills/ba-review/SKILL.md` Step 3 contains the 29-line shared block **exactly once**, in a
  top-level `## Code-Anchor & Confidence Grammar` section; the three dispatch templates cite it and
  contain no copy. Verify: `grep -c 'N ∈ {0, 25, 50, 75, 100}' skills/ba-review/SKILL.md` returns
  `1`.
- `skills/ba-review/SKILL.md:412`'s never-hide disclaimer is still present after the rewrite.
  Verify: grep for `never-hide convention` in the Step 3 preamble.
- Each of the 7 reviewer agents contains a bare citation of the new section plus the literal legal
  value set, and **no** severity-ladder or confidence-anchor block and **no** defence-in-depth
  hedge. Verify: `grep -L 'Severity ladder' agents/*-reviewer.md` lists all 7; `grep -c 'N ∈'` on
  each returns `1`.
- `README.md:241` no longer claims §4 owns the ladder and anchor set. The new grammar section owns
  ladder + anchor set; §4 keeps floors, merge math, and legacy mapping. Verify: read `README.md`
  :217-241 and confirm exactly one source-of-truth claim per contract element.
- `skills/ba-execute/SKILL.md` contains no "Five-site walk" blockquote and no
  `Residual (documented)` string; the four residual *limits* are still stated as plain limits.
  Verify: `grep -c 'Residual (documented)\|Five-site walk' skills/ba-execute/SKILL.md` returns `0`,
  and read `:227`/`:275`/`:282`/`:145` to confirm the substance survives.
- `skills/ba-propose/SKILL.md` contains no `Review fix:` string; the `:296` substance (prompt-spec
  paths fall through to **pending**) still reads correctly. Verify:
  `grep -c 'Review fix:' skills/ba-propose/SKILL.md` returns `0`.
- `.claude-plugin/plugin.json` `version` differs from `0.41.0` in the same commit. Verify:
  `node scripts/selfcheck-invariants.mjs && node scripts/check-invariants.mjs` exits `0`.
- **Behavior:** one fresh-session dry-run — `claude --plugin-dir <repo>`, then `/ba-review` against
  a fixture diff — in which (a) reviewer subagents are actually dispatched, and (b) returned bullets
  match `- **<path>:<line>** *(confidence: N)* — <body>` with `N ∈ {0, 25, 50, 75, 100}`. A run
  where no reviewer dispatched is **void**, not a pass. Rationale: `docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md`
  records a clean two-arm result in which neither arm executed the step under test.

## Open Questions

None — all resolved during Phase 1.2 dialogue and the Phase 3.5 convention check.

### Resolved Questions

- *All 7 checklist items or a slice?* → Slice: free wins first.
- *Delete the 7 agent rubrics, cite, or extract to `references/`?* → Cite; then revised to
  cite + literal legal values on the W1 finding.
- *Fixture A/B or dry-run?* → Fresh-session dry-run with a mechanism-ran assertion.
- *Cut the `Residual (documented)` notes or keep them?* → Cut the frame, keep the substance.
- *Mirror `ba-review-plan`'s two-section shape, or a minimal hoist?* → Full two-section mirror.

## Convention Compliance

Convention-checker reported 14 conventions checked: 7 aligned, 2 justified overrides, 3 violations,
5 warnings. All violations and warnings are resolved in this document.

**Violations resolved:**

- **V1 — README mirror drift.** `README.md:241` asserts §4 owns "the ladder, the anchor set, the
  floors, the merge math, and the legacy mapping". Item 1 makes the new section the authority for
  the ladder and anchor set, which would leave two competing source-of-truth claims for one
  machine-boundary contract. Resolved: `README.md:241` is re-split in the same commit, and this is
  now an acceptance criterion.
- **V2 — missing version bump.** Resolved: the bump from `0.41.0` is a named Key Decision and an
  acceptance criterion, explicitly *inside* the squashed commit.
- **V3 — incomplete residue inventory.** A third `Review fix:` site exists at
  `skills/ba-propose/SKILL.md:296`. Resolved: added to item 3, as a restatement rather than a
  deletion, since its substance is load-bearing.

**Warnings resolved:** W1 → reversed to citation + literal legal values (see `## Scope
Boundaries`), and revised again at plan time to add the ladder/calibration line, since the legal
values alone did not close the gap. W2 → section renamed to `## Code-Anchor & Confidence Grammar`. W3 → new section
carries `ba-review-plan:194-196`'s parser-contract framing; its `:197` citation is tightened. W4 →
`ba-review:412` preservation is an explicit constraint and an acceptance criterion. W5 → fourth
residual note at `skills/ba-execute/SKILL.md:145` added to item 3.

**Justified overrides:**

- **J1 — keeping the residual-limitation notes.** `prompt-authoring.md:53-55` names
  "residual-limitation notes" as authoring residue *by category*. Override: the four notes in
  `skills/ba-execute/SKILL.md` sit inside the two owned convention sections and each states a real
  limit of the contract, so they address the model executing the text rather than the repo's
  history. The `(documented)` frame is the residue; the limits are the contract. Accepted by the
  checker, which independently verified the substance of each.
- **J2 — dry-run instead of a fixture A/B.** `CLAUDE.md` says prompt changes are decided by fixture
  A/B, not by argument. Override: all three items are byte-identical de-duplications or deletions
  of history-facing text — the composed dispatch prompt is unchanged, so there is no behavioral
  delta for an A/B to measure. Consistent with the standing "prompt-only changes ship on a dry-run"
  preference. The W1 reversal closes the one hole the checker identified in this override — but only
  as revised at plan time: retaining the legal values *alone* still dropped ladder definitions and
  anchor calibration from standalone dispatch. With the third line added, the standalone-dispatch
  path is genuinely unchanged and no second verification arm is needed. The override also depends on
  the templates' per-template tails being preserved rather than collapsed; see the amendment note.

**Passes worth recording:** the never-hide selection-ledger convention is untouched (it lives in
Step 2, not Step 3). The `ba-execute:410-415` deletion removes nothing either axis of
`CLAUDE.md:100-110`'s two-axis grid requires. Citation form is correctly bare. No new `references/`
file, so no `referencesCheck` obligation. `retired-invocations` is clear — no item introduces
`/ba:` or `commands/ba/`. `sentinelsCheck` is unexposed: zero `[AUTO-SCORE: …]` tokens, heredocs,
or fences in `ba-review:408-562` or in any of the 7 agent files. Agent naming, `tools` frontmatter,
and the `CLAUDE.md`/`README.md` agent inventories are unaffected by item 2.

## Amendments (2026-08-02, at plan time)

Planning surfaced three findings that contradicted decisions recorded above. All three were verified
against the tree and approved before the plan was written; the sections above are amended in place,
and this note is the single record of what changed and why. The authority for slice 1 is now
`docs/plans/2026-08-02-refactor-prompt-surface-shrink-slice-1-plan.md`.

1. **Agents get three lines, not two.** The 19-line block carried *three* things, not one: the legal
   value set + position rule (which the W1 reversal retained), **plus** the severity-ladder
   definitions, **plus** the confidence-anchor meanings (`75` = default for clearly-applicable,
   `0` = suppress). Since these 7 agents are independently registered dispatch targets invocable
   outside both review skills — where no orchestrator injects the rubric and no consolidation
   pipeline snaps stray values — the two-line form dropped calibration guidance, contradicting this
   document's own "not dropping standalone dispatch as a supported path" boundary. A third compact
   ladder/calibration line restores it. Recovery drops from ~119 to ~112 lines.

2. **The three dispatch templates keep their own tails; Step 3 lands at ~55-60 lines, not ~45.**
   The ~45 target assumed the templates could collapse onto a shared context block the way
   `ba-review-plan:303`/`:323` does. They cannot: `MR context: [MR title + description, if MR scope]`
   exists **only** in the agent-based template (`ba-review:450`), and the read-full-files instruction
   exists in agent-based and user-typed but **not** skill-based (`:458`, `:555`, absent at `:503`).
   All 7 built-ins are agent-based, so collapsing onto the skill-based shape would have stopped every
   MR review from receiving the MR title and description. Only the verified byte-identical 29-line
   block is hoisted. The 10-15 lines are the price of the neutrality claim being literally true.

3. **The deleted hedge took a real propagation rule with it, so a CI check replaces it.** This
   document rebutted the hedge's "defence-in-depth" premise correctly, but the same blockquote also
   carried *"any change to the ladder, the anchor set, the floors, or the merge math MUST be made in
   `skills/ba-review/SKILL.md` first and propagated here verbatim."* Deleting it would have left 7
   unguarded literal copies of a machine-boundary contract with no sync obligation and no CI check.
   Resolved by a fifth invariant check (`rubric-mirror`) pinning the literal across `ba-review`,
   `ba-review-plan`, and the 7 agents and asserting the agents' cited section resolves, plus one
   `CLAUDE.md` line documenting it. This is a deliberate widening of the slice past "free wins" — it
   adds script code — chosen because mechanical enforcement beats a hand-maintained convention line.

Two smaller corrections, folded in above: `ba-execute:144` and `:145` are **two** distinct residual
limits on adjacent lines, not one; and the legal-value literal is **introduced** to the 7 agents
rather than normalised, since none carries it today — which makes the agents' edit a hard
prerequisite of the CI check.

## Next Steps
→ Planned: `docs/plans/2026-08-02-refactor-prompt-surface-shrink-slice-1-plan.md` (7 units, 13 ACs).
Read the amendment note above before treating any decision in this document as current.
