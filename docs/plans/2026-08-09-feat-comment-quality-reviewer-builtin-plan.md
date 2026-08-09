---
title: Add comment-quality-reviewer as the eighth built-in reviewer
type: feat
plan_schema: 2
status: active  # human-authored only — /ba-execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-08-09
origin: docs/brainstorms/2026-08-09-comment-quality-reviewer-builtin-brainstorm.md
detail_level: standard
tags: [ba-review, reviewers, agents, comment-quality, issue-55]
---

# Add comment-quality-reviewer as the Eighth Built-In Reviewer

Roadmap: issue #55 (`cluster:review-quality`, hub #29). Related: #44 (gate recalibration).

## Overview

Port the maintainer's user-level `comment-quality-reviewer` into the plugin as the eighth built-in
reviewer, justified by measured residual coverage across 36 production runs (~78% sole-attribution,
3.3% exact-anchor overlap with the four nearest built-ins). The port removes the measured-unsupported
signature-blind read-ordering rule, converts the agent to the house four-level ladder, and repairs a
live routing bug that points at it today. Its `/ba-review-plan` counterpart is deliberately **not**
added — see What We're NOT Doing.

## Current State

- **The port source** is `~/.claude/agents/comment-quality-reviewer.md`, 179 lines, outside the repo.
  It carries `model: inherit`, `tools: Read, Grep, Glob`, no `<examples>` block, the native
  `## Must Address` / `## Consider` / `## Looks Good` vocabulary (in headings *and* in rule text at
  source lines 71, 75, 87, 96), nested treatment sub-bullets, a `**Verdict:**` line with three
  defining paragraphs, and `/ba:` three times (lines 3, 15, 158).
- **House reviewer anatomy** (`agents/deep-module-reviewer.md`, `agents/complexity-reviewer.md`):
  frontmatter `name` / `description` / `model: sonnet` with no `tools` key; `<examples>` block at
  lines 7–14 with the `<commentary>` at line 12; charter sentence at line 16; `**You suggest. You do
  not apply.**` at line 18 (Ousterhout agents only); `## What You Review`; `## How to Review`;
  `## Output Format`; three rubric paragraphs; `## Principles`.
- **The dangling routing bug**: `agents/complexity-reviewer.md:70` routes "unclear comments" to
  `architecture-reviewer` — where the word "comment" appears nowhere — and to "the deferred
  comment-quality reviewer", which does not exist in-repo.
- **Roster tables are hardcoded**: `skills/ba-review/SKILL.md:244-252` (Step 2a). An agent file with
  no roster row is unreachable — Step 2b globs `.claude/` and `~/.claude/`, never the plugin's own
  `agents/`.
- **CI**: `scripts/check-invariants.mjs:110-111` auto-enrols `agents/*-reviewer.md` by suffix into
  `rubric-mirror`; `:114` demands the byte-exact literal; `:610` demands the citation string; `:89`
  bans `/ba:` and `commands/ba/` across `agents/`. `.claude-plugin/plugin.json` is at `0.44.0`,
  already shipped by `bc842fa`.
- **No per-reviewer dispatch template exists** — all built-ins share one agent-based `Task` template
  that already carries the bullet grammar and protected-artifacts guard inline.

## Acceptance Criteria

- AC1: `agents/comment-quality-reviewer.md` exists with `name:` equal to its basename, and
  `node scripts/check-invariants.mjs` passes — including `rubric-mirror`, which enrols the file
  automatically on its `-reviewer.md` suffix.
  - A `name:` mismatch does not error. The agent silently fails to register and the roster row
    points at nothing. No CI check reads agent frontmatter `name:`.
- AC2: The agent body references `/ba-review` and contains neither `/ba:` nor `commands/ba/`.
  Stated positively: two of the source's three colon occurrences sit inside sentences other criteria
  delete, so a zero count is reachable while the intended references vanish with them.
- AC3: The read-ordering rule and the "signature-blind pass no other reviewer performs" claim are
  absent from the description and the body (source lines 15–17 and the restatement at line 47),
  **and** the retained two-pass scope split is present — interface pass over doc comments on
  declarations with callers, implementation pass over inline comments in bodies. Both clauses, one
  criterion: the removal target is physically interleaved with content that stays, and paraphrase
  ("prefer to consider the signature first") satisfies removal while restoring the behaviour.
- AC4: `/ba-review` dispatches the reviewer and it appears in the Step 2a roster and the Step 2d
  ledger, selected or set aside on the merits.
- AC5: A fresh-session dry-run produces **at least one rendered finding anchored to a changed file**,
  and `summary.md` reports `legacy_format`, `mixed_format`, `snapped`, `dropped`, and
  `confidence_default` all zero. Both clauses: a reviewer returning nothing makes every counter zero,
  so the counters alone cannot distinguish a clean port from a silent no-op.
- AC6: The dry-run's raw per-reviewer artifact proves the **ported built-in** answered — no
  `**Verdict:**` line and no `/ba:` string in the raw text. The user-level source is still installed
  during the dry-run and `comment-quality-reviewer` resolves as a registered agent type, so a
  dispatch can succeed against the unported file and pass for the wrong reason.
- AC7: `agents/complexity-reviewer.md:70` routes comment findings to `comment-quality-reviewer`,
  retains `architecture-reviewer` for naming and coupling, and preserves the three other routings
  (`deep-module-reviewer`, `simplification-reviewer`, `error-handling-reviewer`) verbatim.
- AC8: All eight `agents/*-reviewer.md` files carry the count-free `<commentary>` wording, and the
  string `one of seven parallel built-in reviewers` appears nowhere under `agents/`.
- AC9: `skills/ba-review/SKILL.md` states eight built-ins at every count site — including the bare
  `7` in the pre-judgment arithmetic at line 350 and `7 built-ins first` at line 388 — and its ledger
  example enumerates eight.
- AC10: `skills/ba-review-plan/SKILL.md:53` no longer claims seven reviewers "live flat in `agents/`"
  (eight files now do) and states the roster asymmetry once. Every other count in that file stays
  **seven**.
- AC11: `.claude-plugin/plugin.json` reads `0.45.0`, bumped exactly once.

## What We're NOT Doing

- **Not adding a `/ba-review-plan` roster row.** That skill scores plan documents, which contain no
  doc comments or inline code comments, so the row would be set aside on essentially every run. This
  **narrows the origin brainstorm's acceptance criterion**, which asked for rows in both skills; the
  reduction was surfaced and approved before this plan was written. Omission does not hide the
  reviewer — `skills/ba-review-plan/SKILL.md:69-72` documents that the skill runs no discovery and
  that a plan-relevant reviewer stays reachable via Adjust → Other. It also avoids editing the
  agent's own `file:line` anchoring rule, which contradicts that skill's line-number-free grammar.
- **Not touching the confidence gate.** `/ba-review`'s floors, merge math, and Med-conf-100 filter
  belong to #44. Consequence to state plainly: the source rates most missing-caller-contract findings
  at confidence 50 against a Medium floor of 75, so that tier ships **structurally suppressed on day
  one**. It is a category the coverage argument partly rests on, and the dry-run will show the
  reviewer contributing less than 36 runs of external use suggested.
- **Not adding staleness detection.** Declared out of charter; the hole is documented, not filled.
- **Not creating a `references/` file.** One consumer, so the shareability rule says none.
- **Not adding a dispatch-template clause.** The shared agent-based template already carries the
  grammar and guard; a per-reviewer clause would pin criteria into a consumer file.
- **Not deleting the user-level agent in this diff.** It moves to `~/.claude/graveyard/` post-merge —
  a manual, out-of-repo step no commit can perform. Until then the ledger may list the name twice.

## Proposed Solution

Author one new agent file shaped to house anatomy, repair one routing line, and update the count and
roster sites that `/ba-review` reads. The agent's criteria stay entirely inside its own file so that
changing what counts as a bad comment touches one place; only pointers live in the skill.

**Landing.** All units land as a **single squashed commit**, per repo convention. This is
load-bearing, not stylistic: `versionBumpCheck` (`scripts/check-invariants.mjs:449-501`) diffs
`HEAD~1..HEAD` and fails any commit touching `skills/` or `agents/` without a version bump, so
per-unit commits would each fail and invite the per-unit re-bumping that the one-bump rule exists to
prevent.

## Technical Considerations

- **Vocabulary mapping.** Adopt `/ba-review`'s own legacy mapping (`skills/ba-review/SKILL.md:558`):
  Must Address → **High**, Consider → **Medium**. Leaks are High; missing caller-visible contracts are
  Medium; verbosity trims and nits are **Low**, which the three-tier source has no equivalent for.
  `## Critical` is unreachable for a comment defect and should read `None` — say so in the body,
  because Critical's gate floor is 50 against H/M/L's 75, so a finding mis-filed as Critical is *more*
  likely to survive the gate than a correctly-filed High. The 36-run corpus was already emitting this
  ladder under the dispatch override, which substantially de-risks the conversion.
- **Model.** Ships `model: sonnet` to match the house. The evidence corpus was produced under
  `model: inherit`, so shipped behaviour is unvalidated at that tier — see Dependencies & Risks.
- **Tools.** `tools: Read, Grep, Glob` is expressly permitted by convention (six agents already
  restrict). It makes this the first reviewer with a `tools` key, so a future "all reviewers get X"
  change has one file that behaves differently — a one-sentence note, not an exception.
- **Charter edges.** Test-file comments are **in charter**, with no file-type special-casing: test
  helpers are declarations with callers, and this matches the scoping the corpus was measured under.
  Prose/markdown diffs are **out of charter** — this repo's own markdown carries fenced code blocks
  and agent bodies that are literally prose *about* comments, and findings anchored into `.md` at real
  line numbers pass every downstream validation check and render as legitimate.

## System-Wide Impact

- **Interaction graph**: Step 2a roster → 2c judgment → 2d ledger → Step 3 shared agent template →
  Step 4a–4f normalisation → Step 5 disposition. No parser branch, no template branch, no CI edit.
- **Error propagation**: `skills/ba-review/SKILL.md` Step 3 reports a reviewer that "fails **or
  returns empty**" identically. A presence-gated reviewer hits the honest-empty case far more than the
  other seven, so an all-`None` return will read as a failure in the summary. Pre-existing; noted, not
  fixed here.
- **State lifecycle risks**: none — the change is prompt text plus a version bump.
- **Partial-landing risk**: the dangerous state is **agent file present, roster row absent**. CI stays
  green (`rubric-mirror` enrols it), and the reviewer is silently unreachable forever. The single-commit
  landing rule is what prevents it; treat the mirror set as atomic.

## Implementation Approach

### Changes Required

**File**: `agents/comment-quality-reviewer.md` (new)

#### U1 — Author the ported reviewer

Compose to house anatomy, sourcing content from `~/.claude/agents/comment-quality-reviewer.md`.
Frontmatter: `name: comment-quality-reviewer`, a double-quoted one-line `description` naming the
dimension and ending in the house sentence, `model: sonnet`, `tools: Read, Grep, Glob`. Add an
`<examples>` block in the house shape, with its `<commentary>` line carrying the count-free wording
minted in U3.

Carry over from the source: the two-pass scope split, the verbosity/earning tests, the two-documents
principle, the form-follows-role and one-comment-one-declaration rules, the leak taxonomy, the
implementation-pass rules, and the confidence calibration section **including its restatement→75-not-50
rule and stated rationale**. Convert `Must Address` / `Consider` to ladder vocabulary in **rule text**
as well as headings.

Remove: the read-ordering rule and its two restatements, the `**Verdict:**` line and its three defining
paragraphs, the description's presence-test self-exemption, the nested treatment sub-bullets in the
output template, and — added at plan review — **the input-shape pass selector**. The source branches
between "a single symbol, signature, or one diff hunk → interface pass only" and "a multi-file diff →
both passes"; with no `/ba-review-plan` roster row the sole consumer always supplies a multi-file diff,
so the single-symbol branch is permanently unreachable and costs tokens on every dispatch for a decision
whose answer never varies. Replace the conditional with a flat statement that both passes always run.

Demote the comment-to-code ratio check to an internal `## How to Review` step that surfaces as an
ordinary Medium or Low bullet. Move the Delete/Substitute/Relocate/Add taxonomy to `## Principles` as one
steering sentence — the four-way ordering (Delete by default, then Substitute, then Relocate) is stated
**there and nowhere else**; `## Output Format` names a treatment label per finding and does not restate
the ordering rationale. Add out-of-charter lines for staleness and for prose/markdown-only diffs, and a
line stating Critical is unreachable.

The `<commentary>` wording is a forward reference to U3, so U1's `Verify:` pins the phrase directly —
an interrupted run cannot leave the new file and the seven reworded ones out of sync.

**Code-shape decision:** the three rubric paragraphs are reproduced byte-exact rather than paraphrased,
because `scripts/check-invariants.mjs:114` matches the literal `N ∈ {0, 25, 50, 75, 100}` exactly and
`:117`'s diagnostic regex fails any near-spelling at its own line — a paraphrase is a hard CI failure,
not a style difference. Copy the three paragraphs verbatim from `agents/deep-module-reviewer.md:67,69,71`
(anchor: brainstorm `## Locked Design`, "Invariants carried verbatim"). Everything else in this unit is
prose the executing agent composes.

Test scenarios:
- A diff adding a JSDoc block that restates a typed parameter yields a Medium at confidence 75 (Covers AC1, AC5)
- A diff with code but zero comments yields no *existing-comment* findings — `None` under every
  severity heading, except that a missing caller-visible contract on a non-trivial declaration may
  still surface as a Medium/`Add` (Covers AC4)
- A markdown-only diff produces no findings anchored into `.md` files (Covers AC4)

Verify: `test -f agents/comment-quality-reviewer.md && grep -q '^name: comment-quality-reviewer$' agents/comment-quality-reviewer.md && grep -q 'N ∈ {0, 25, 50, 75, 100}' agents/comment-quality-reviewer.md && grep -q 'Code-Anchor & Confidence Grammar' agents/comment-quality-reviewer.md && grep -q '/ba-review' agents/comment-quality-reviewer.md && grep -q 'interface pass' agents/comment-quality-reviewer.md && grep -q 'implementation pass' agents/comment-quality-reviewer.md && grep -q 'parallel built-in reviewers' agents/comment-quality-reviewer.md && grep -qE '^## (Critical|High|Medium|Low)$' agents/comment-quality-reviewer.md && ! grep -qE '^## (Must Address|Consider)$' agents/comment-quality-reviewer.md && ! grep -qE '/ba:|commands/ba/' agents/comment-quality-reviewer.md && ! grep -q 'Verdict:' agents/comment-quality-reviewer.md && node scripts/check-invariants.mjs`

The conjunction is deliberately two-sided: the absence conjuncts alone are all satisfiable by deleting
the interleaved section wholesale, which would take AC3's retained two-pass split with it. The
`interface pass` / `implementation pass` and ladder-heading conjuncts are what make that state fail.

---

**File**: `agents/complexity-reviewer.md`

#### U2 — Repair the dangling deferral

Line 70's `Defer overlapping concerns` bullet currently reads, in part: "Naming, coupling, and lexical
obscurity (bad names, unclear comments) → `architecture-reviewer` and the deferred comment-quality
reviewer." Split the clause so naming and coupling stay with `architecture-reviewer` and comment
findings route to `` `comment-quality-reviewer` ``, backticked like every other real target. Preserve
the three other routings verbatim — deleting the bullet wholesale satisfies "no longer routes comments
to architecture-reviewer" while destroying correct routing.

Before editing, grep the reciprocal direction to confirm no sibling claims comment findings:
`grep -rniE 'comment' agents/architecture-reviewer.md agents/deep-module-reviewer.md`. Record the
result in the commit body; if a symmetric claim exists, it is in scope for this unit.

Test scenarios:
- A diff with both a bad name and a restating doc comment produces one complexity finding routed away, not two overlapping ones (Covers AC7) — exercised end-to-end by the Validation dry-run's planted naming defect, since a grep cannot observe abstention

Verify: `! grep -q 'the deferred comment-quality reviewer' agents/complexity-reviewer.md && grep -q 'comment-quality-reviewer' agents/complexity-reviewer.md && grep -q 'architecture-reviewer' agents/complexity-reviewer.md && grep -q 'deep-module-reviewer' agents/complexity-reviewer.md && grep -q 'simplification-reviewer' agents/complexity-reviewer.md && [ "$(grep -c 'comment-quality-reviewer' agents/complexity-reviewer.md)" -eq 1 ] && grep -qE 'Naming.*architecture-reviewer' agents/complexity-reviewer.md`

The last two conjuncts are what distinguish a correct split from both concerns pointed at one target:
the naming clause must still resolve to `architecture-reviewer` on its own line, and a single
`comment-quality-reviewer` mention rules out a blanket rewrite that routes everything to the new agent.

---

**File**: all eight `agents/*-reviewer.md`

#### U3 — Make the reviewer count count-free

Line 12 of each existing reviewer carries the byte-identical `<commentary>The review command dispatches
this agent as one of seven parallel built-in reviewers.</commentary>`. Replace `seven` with a count-free
word so a ninth reviewer costs zero edits here. U1's new file carries the same reworded line.

Test scenarios:
- Adding a hypothetical ninth reviewer would require no edit to any existing agent's commentary (Covers AC8)

Verify: `[ "$(grep -l 'parallel built-in reviewers' agents/*-reviewer.md | wc -l)" -eq 8 ] && ! grep -rq 'one of seven parallel built-in reviewers' agents/`

---

**File**: `skills/ba-review/SKILL.md`

#### U4 — Roster row and every count site

Append an eighth row after line 252 in the Step 2a table, matching the existing `| \`agent\` | Focus |`
shape. **Phrase the Focus cell as present surfaces, not defects** — Step 2c judges built-ins against
this cell and a set-aside reason must cite the *absent* surface, which a defect-phrased cell gives the
judge nothing to negate. Name doc comments on declarations with callers and inline comments in changed
bodies.

This knowingly makes the eighth row read differently from the seven existing defect-phrased cells
(`XSS, sensitive data, auth patterns`; `Over-engineering, unnecessary abstraction, YAGNI`). The split is
accepted rather than resolved: retro-fitting surface-phrasing onto the other seven is a change to how
every reviewer is judged, which is out of scope here and belongs with #44's selection work. Note the
divergence in the commit body so it reads as deliberate, not as a drafting slip in a table CI never
checks.

Update every count: line 242 (roster intro), 254 (the never-hide invariant), 296, 329, 350 (the bare
`7` in `7 (built-ins from 2a) + count(...)` — no count word nearby, easy to miss), 388. Add an eighth
row to the ledger example at 335-342.

Test scenarios:
- A run's ledger header reports eight built-ins and the pre-judgment total arithmetic agrees (Covers AC9)

Verify: `grep -q 'comment-quality-reviewer' skills/ba-review/SKILL.md && grep -q '8 (built-ins from 2a)' skills/ba-review/SKILL.md && grep -q '8 built-ins first' skills/ba-review/SKILL.md && ! grep -q 'seven built-in' skills/ba-review/SKILL.md && ! grep -q '7 (built-ins from 2a)' skills/ba-review/SKILL.md && ! grep -q '7 built-ins first' skills/ba-review/SKILL.md`

Absence conjuncts alone would pass on any wrong replacement value — `9 (built-ins from 2a)` satisfies
"the old string is gone." The positive conjuncts pin the intended number.

---

**File**: `skills/ba-review-plan/SKILL.md`

#### U5 — State the roster asymmetry once

Line 53 currently reads "These seven built-in reviewers live flat in `agents/` and are always
available" — a claim about the *directory*, which now holds eight files, so it becomes false even
though this skill's roster stays seven. Rewrite it to state that seven of the eight built-ins are on
this roster, that `comment-quality-reviewer` reviews code comments and has no plan-document surface,
and that it stays reachable via Adjust → Other. **Every other count in this file stays seven** —
lines 9, 65, 70, 76, 106, 110, 162, 168, 501 are unchanged.

Test scenarios:
- A plan review's ledger still enumerates seven built-ins, with no set-aside comment-quality row (Covers AC10)

Verify: `! grep -q 'These seven built-in reviewers live flat' skills/ba-review-plan/SKILL.md && grep -q 'comment-quality-reviewer' skills/ba-review-plan/SKILL.md && [ "$(grep -c 'seven built-ins\|seven built-in reviewers\|7 built-ins' skills/ba-review-plan/SKILL.md)" -ge 5 ]`

---

**File**: `README.md`, `CLAUDE.md`

#### U6 — Documentation, split by which skill each count describes

`README.md:159` and `:172` are **`/ba-review`** counts and become eight; `:172` also names all seven
reviewers and gains the eighth. `README.md:134` and `:139` are **`/ba-review-plan`** counts and stay
seven. Add an agents-table row after line 285, keeping reviewer rows contiguous before
`interface-design-generator` at 286.

`CLAUDE.md:15` and `:82` are both **`/ba-review-plan`** counts and stay seven. Add an agents-list bullet
after line 54 in the house format, with the trailing `(built-in reviewer)` marker every reviewer bullet
carries.

**Make the divergence legible where readers actually are.** This is the first time the two counts differ
inside one file, and the only disambiguator is which heading a sentence sits under. Add a short
parenthetical at `README.md:134` stating that `/ba-review-plan`'s roster is intentionally smaller because
plan documents carry no code comments — the same reasoning already going into
`skills/ba-review-plan/SKILL.md:53` — and one line to `CLAUDE.md`'s conventions list naming the split
sites, so a future editor does not read "the reviewer count" as a single fact. This is structurally the
drift trap that produced `CLAUDE.md`'s U-ID / stack-base grid; it gets the same treatment at lower cost.

Test scenarios:
- README's reviewer list names eight and its review-plan description still says seven, with the reason stated adjacent (Covers AC10)

Verify: `grep -q 'comment-quality-reviewer' README.md && grep -q 'comment-quality-reviewer' CLAUDE.md && grep -q 'Eight built-in reviewers' README.md && ! grep -q 'seven built-in review agents' README.md && ! grep -q 'Seven built-in reviewers' README.md && grep -q '7 built-in reviewers' CLAUDE.md && grep -q 'seven built-in reviewers' README.md`

The two negative conjuncts are the ones that matter: without them, adding the new name at `:172` while
leaving `:159`'s prose sentence stale passes, shipping a paragraph that contradicts itself. The final
positive conjunct asserts the `/ba-review-plan` count at `:134` was *not* swept up in the same edit.

---

**File**: `.claude-plugin/plugin.json`

#### U7 — Version bump

`0.44.0` → `0.45.0`, once, in the same squashed commit as U1–U6. `0.44.0` was shipped by `bc842fa`, so
this is not a re-bump of an unshipped version.

Test scenarios:
- `check-invariants` version-bump check passes on the squashed commit (Covers AC11)

Verify: `grep -q '"version": "0.45.0"' .claude-plugin/plugin.json`

---

## Validation

The dry-run is **not** a unit: it is interactive, it mutates the tree by writing under `docs/reviews/`,
and it cannot be automated — so it fails the read-only and code-matchable requirements for a `Verify:`
line, and as a commit-tag-only unit it would sit `pending` forever.

Run it in a **fresh session** — `.claude/agent_docs/prompt-authoring.md` records that a prompt change
cannot be dry-run in the session that wrote it, because a running session executes the body it loaded
at start:

**Pass A — the positive case.**

1. `claude --plugin-dir <repo>` in a fresh session, on a small planted diff containing a restating
   JSDoc block on an exported declaration, an inline comment that narrates its own branch, **and a
   poorly-named local** (the naming defect exists so U2's routing scenario is observable: complexity- and
   architecture-reviewer should take the name while comment-quality takes the comments).
2. Run `/ba-review --persist`. Confirm the reviewer appears in the Step 2a roster and Step 2d ledger.
3. Open the raw per-reviewer artifact under `docs/reviews/<TIMESTAMP>-<scope-ref>/`. Assert: findings of
   **both kinds** — at least one on the doc comment and at least one on the inline comment, so a port
   that silently dropped one pass fails; every confidence value in the legal set **in the raw text,
   before snapping**; no `**Verdict:**` line; no `/ba:` string (AC5, AC6).
4. Read `summary.md`: `legacy_format`, `mixed_format`, `snapped`, `dropped`, `confidence_default` all
   zero.
5. Confirm complexity-reviewer did **not** also file the comment findings (AC7's routing repair).

**Pass B — the charter boundaries.** Both are `(Covers AC4)` scenarios with no grep-matchable check, so
without these passes a port that fires on every diff regardless of content ships unnoticed.

6. Re-run on a diff with code changes and **zero comments**: the reviewer returns `None` under every
   severity heading, **or** is set aside at Step 2c, **or** returns only missing-caller-contract
   findings (Medium, `Treatment: Add`) on non-trivial declarations. Any finding about an *existing*
   comment is the failure — there are none to review.

   **Loosened after the first dry-run**, which returned exactly one such finding
   (`drainAcross` returns `[]` rather than a partial plan, a contract the signature does not carry;
   Medium/50, correctly suppressed by the Medium floor). The original criterion — findings-none, full
   stop — contradicted U1's own instruction to carry over leak-taxonomy item 7 ("missing caller-visible
   contracts", Medium, `Add`). A reviewer that can flag a missing contract will fire on a zero-comment
   file that has one; the two cannot both hold. The finding was judged correct and the criterion wrong.
7. Re-run on a **markdown-only** diff: no findings anchored into `.md` files. This repo's own diffs are
   the common case for this boundary, and its agent bodies are literally prose about comments.

8. Post-merge, move `~/.claude/agents/comment-quality-reviewer.md` to `~/.claude/graveyard/`.

## Dependencies & Risks

- **The evidence corpus was collected at a different model tier.** The 78%-sole-attribution and
  3.3%-overlap measurements that justify this port were produced with `model: inherit`. Shipping
  `model: sonnet` matches the house but ships a configuration the evidence never validated, and the
  coverage argument is the entire justification. The dry-run is the only evidence for shipped
  behaviour; if its findings are visibly thinner than the external agent's, revisit the model choice
  before merge.
- **The dry-run can pass for the wrong reason.** The user-level agent is still installed and
  `comment-quality-reviewer` already resolves as a registered agent type, so a dispatch may answer from
  the unported source. AC6's raw-artifact assertions are the guard; without them the dry-run proves
  nothing.
- **Missing-contract findings ship suppressed** (confidence 50 against a Medium floor of 75). Expected,
  deferred to #44, and stated so the dry-run's thinness is not misread as a broken port.
- **`rubric-mirror` pins string identity, never meaning.** A green build does not mean the eight agents
  agree on what a severity means. The ladder wording in U1 must be read against the existing seven by
  hand.
- **Local CI fails mid-branch by design.** `versionBumpCheck` is per-commit locally and per-PR in CI.
- **`/ba-propose` will misread this diff.** Its Step 2e proof detection matches only `*_test.*`-shaped
  paths, so a dry-run-verified prompt change renders `Proof: pending`. Override only if the rendered
  statement is false, and disclose the override with its reasoning before composing.

## Requirement Reconciliation

- "agent file exists, `name` = basename, check-invariants passes" → AC1
- "every `/ba:` rewritten to `/ba-`" → AC2
- "read-ordering rule and signature-blind claim absent" → AC3
- "roster rows added at `ba-review` Step 2a **and** `ba-review-plan` Step 1a" → AC4, AC9 (ba-review half);
  **EXCLUDED (plan-introduced)**: the `ba-review-plan` half — no plan-document surface; surfaced and
  approved before writing; asymmetry stated at AC10
- "counts updated to eight at every mirror site" → AC9, AC10 — scoped to `/ba-review` sites only, per the
  exclusion above
- "Adjust partition worked example re-split for eight" → **EXCLUDED (inherited)**: the example lives in
  `ba-review-plan:171-172`, whose roster is unchanged
- "`plugin.json` bumped exactly once to 0.45.0" → AC11
- "`complexity-reviewer.md:70` repaired" → AC7
- "dry-run in a fresh session; ladder; counters zero" → AC5, AC6
- Scope boundaries (gate stays #44, no staleness, no `references/`, no charter changes, no dispatch
  clause) → carried verbatim into What We're NOT Doing

## Convention Compliance

- [x] Agent naming and placement — `-reviewer` suffix, flat in `agents/`; the suffix is load-bearing as
  the `rubric-mirror` enrolment key
- [x] `name:` = basename — hand-maintained, not CI-verified; failure mode stated in AC1
- [x] Reference-file placement — one consumer, so no `references/` file; adding one would also fall
  outside the top-level-only CI walk
- [x] Version bump — one bump per ship, `0.45.0`
- [x] Prompt-authoring trust gradient — machine-boundary contracts (the rubric literal, the citation
  string, frontmatter keys, ladder headings) specified to the character; the reviewer's judgment surface
  stated as goals
- [x] Planning skills never write code — the one literal block carries a `**Code-shape decision:**` label
  with its why
- [x] Never-hide ledger — justified override: the `ba-review-plan` roster omission is out-of-scope, not
  hidden; reachable via Adjust → Other, and the asymmetry is stated at its roster site
- [x] Planning artifacts ship with the implementation — brainstorm and plan land in the same commit
- [ ] Known debt: `tools: Read, Grep, Glob` makes this the only reviewer with a `tools` key; a future
  "all reviewers get X" change must remember it
- [ ] Known debt: **the skill- and doc-side reviewer counts stay hand-maintained.** U3 closes the
  agent-side half by making the `<commentary>` count-free, but roughly a dozen literal numerals remain
  across `skills/ba-review/SKILL.md` (6 sites), `skills/ba-review-plan/SKILL.md` (1 changed, 9 that must
  stay seven), `README.md` (4), and `CLAUDE.md` (2) — behind no single source of truth and pinned by no
  CI check. A ninth reviewer repeats this plan's manual line-hunt, and nothing verifies the hunt was
  exhaustive beyond the strings each `Verify:` happens to name. Accepted rather than fixed: pinning them
  is a `scripts/check-invariants.mjs` change, out of scope here
- [ ] Known debt: the eighth roster row's Focus cell is surface-phrased while the seven existing cells
  are defect-phrased — deliberate (see U4), unresolved at the table level

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-08-09-comment-quality-reviewer-builtin-brainstorm.md` — carried
  forward: justification on measured residual rather than signature-blindness; removal of the
  read-ordering rule with the two-pass scope split retained; verbatim port of the confidence anchors
  with the gate left to #44.

### Internal References
- Port source: `~/.claude/agents/comment-quality-reviewer.md` (outside the repo)
- House anatomy: `agents/deep-module-reviewer.md:7-14,16,18,44-65,67-71`
- Routing repair target: `agents/complexity-reviewer.md:70`
- Roster and counts: `skills/ba-review/SKILL.md:244-252,242,254,296,329,350,388,335-342`
- Legacy mapping: `skills/ba-review/SKILL.md:558`; gate floors `:605-608`
- Roster asymmetry site: `skills/ba-review-plan/SKILL.md:53`; Adjust escape hatch `:69-72`
- CI: `scripts/check-invariants.mjs:89,110-111,114,117,449-501,610`
- Learnings: `docs/solutions/prompt-authoring/2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md`,
  `2026-08-09-per-dispatch-block-ci-catches-template-drift.md`,
  `2026-08-02-path-heuristics-misread-prompt-repo-filenames.md`
