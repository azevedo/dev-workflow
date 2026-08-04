---
title: Shrink Prompt Surface — Slice 1 (De-duplication & Residue)
type: refactor
plan_schema: 2
status: active  # human-authored only — /ba-execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-08-02
origin: docs/brainstorms/2026-08-02-prompt-surface-shrink-slice-1-brainstorm.md
detail_level: standard
tags: [prompt-weight, ba-review, ba-propose, ba-execute, reviewer-agents, ci-invariants, issue-59]
---

# Shrink Prompt Surface — Slice 1 (De-duplication & Residue) Implementation Plan

## Overview

Issue #59's checklist holds 7 items; this plan lands **slice 1 — the de-duplication and residue
half**, where in-body hoisting and deletion are the right instrument and no new `references/` load
site is needed. Three source items: de-triplicate `skills/ba-review/SKILL.md` Step 3, collapse the
rubric duplicated into all 7 built-in reviewer agents, and purge authoring residue from
`ba-execute` / `ba-propose`. The `references/` load-site extractions — the larger token prize — are
deferred to a slice 2 brainstorm (see brainstorm `## Scope Boundaries`).

Because this repo's product *is* prompt text, every edit here is a runtime change. The plan's
governing claim is **behavioral neutrality on the orchestrated path**: the composed dispatch prompt
`ba-review` sends to each reviewer must be unchanged. Three spec-flow findings showed the
brainstorm's version of that claim was overstated; the units below are scoped so it becomes
literally true.

## Current State

- **`skills/ba-review/SKILL.md`** — 1141 ln / ~17.9k tok. Step 3 (`:408-560`) holds three dispatch
  templates: agent-based (`:414-458`), skill-based (`:460-503`), user-typed (`:505-555`, with a
  resolution ladder at `:507-512` sitting *above* the template). Each embeds a **byte-identical
  29-line block** — severity ladder, bullet grammar, anchor-scope paragraph, Heading/Meaning and
  Confidence/Meaning tables, `None` rule, protected-artifacts guard. Whole-block identity verified,
  not just the `:426 ≡ :472 ≡ :524` / `:446 ≡ :492 ≡ :544` spot-check.
- **Per-template tails are *not* identical** (this is what the brainstorm missed): `MR context:
  [MR title + description, if MR scope]` exists **only** at `:450` (agent-based); `Review the diff
  AND read the full content of changed files for context.` exists at `:458` and `:555` but **not**
  at `:503`. Confirmed by grep: 1 hit and 2 hits respectively.
- **`ba-review/SKILL.md:412`** — the never-hide disclaimer ("the selection ledger shows bare display
  names … does not affect ledger presence or the never-hide convention") sits *inside* the range
  being rewritten. `CLAUDE.md` makes it a mirrored convention.
- **`ba-review/SKILL.md:392`** — says user-typed names "resolve via Step 3's user-typed handling,
  which is **self-contained in Step 3**". Hoisting the grammar out of Step 3 falsifies that phrase.
- **`ba-review/SKILL.md:594`** — Step 4 **snaps** any out-of-set numeric `N` to the nearest anchor
  and defaults a missing one to the section floor. Consequence: consolidated output carries legal
  values *by construction*, so grammar must be asserted against **raw** reviewer text.
- **The 7 built-in reviewer agents** — `agents/{architecture,simplification,security,error-handling,test-coverage,complexity,deep-module}-reviewer.md`
  each carry an identical 19-line block (verified md5-identical) plus a 1-line hedge blockquote.
  The block holds **three** things: severity-ladder *definitions*, confidence-anchor *meanings*, and
  the position rule. Each agent separately retains `## Output Format` (`:37-54`) with literal bullet
  templates — which is why bullet shape alone cannot verify this refactor.
- **No agent carries the set literal today.** `grep -l 'N ∈ {0, 25, 50, 75, 100}' agents/*-reviewer.md`
  returns **0 files**; the agents enumerate anchors one per line instead (e.g.
  `agents/architecture-reviewer.md:67` — `- **25** — Speculative; only flag when missing it would be
  costly.`). So U3 **introduces** the literal to 7 files rather than normalising existing copies —
  which is what makes U3 a hard prerequisite of U6 (see `## Technical Considerations`).
- **The hedge blockquote** carries two clauses: a false "defence-in-depth" premise (both dispatchers
  always inject the rubric) **and** a real propagation rule ("any change … MUST be made in
  `skills/ba-review/SKILL.md` first and propagated here verbatim").
- **`skills/ba-review-plan/SKILL.md:192-323`** — the precedent shape: `## Plan-Anchor & Confidence
  Grammar` (`:192`, self-described at `:194-196` as "a parser contract … the literal authority — do
  not re-derive it from prose elsewhere"), `### Dispatch instructions — apply to ALL templates`
  (`:252`), slim `### Templates` (`:283`). Its mandatory stub phrase is "Apply all the dispatch
  instructions in the section above" (`:288`, `:302`, `:321`). Its `:197` cites `ba-review`'s bullet
  grammar file-level only.
- **Literal spelling diverges today**: `N ∈ {0, 25, 50, 75, 100}` (spaced) ×3 in `ba-review`;
  `N ∈ {0,25,50,75,100}` (unspaced) ×1 at `ba-review-plan:293`.
- **`README.md:241`** — asserts `ba-review` §4 is authoritative for "the ladder, the anchor set, the
  floors, the merge math, and the legacy mapping". `README.md:219-238` carries a deliberate,
  labeled user-facing summary of both tables. Note `floors` also appears at `README.md:140`, outside
  the sentence being changed.
- **Residue sites.** `skills/ba-execute/SKILL.md:410-415` (six-line "Five-site walk" blockquote, in
  `## Step 1: Initialize` — *not* inside either owned convention section; already stale, says "five
  citation sites" where `README.md:264` gives six and four). `skills/ba-propose/SKILL.md:30`,
  `:296`, `:507` (`Review fix:` sites). `skills/ba-execute/SKILL.md:227`, `:275`, `:282` and the
  **two adjacent-but-distinct** residuals at `:144` and `:145`.
- **The residue needles are narrower than they look.** `grep -c 'Residual (documented)'` returns
  **1**, not 3: `:275` reads `Residual (documented, safe-side)` and `:282` reads
  `Residual (documented, numeric-collision proxy only)`. And `one-in-flight-plan-per-branch` is
  **line-wrapped** across `:146-147`, so no single-line grep can match that occurrence; a
  non-wrapped occurrence exists at `:270`, outside the text being restated.
- **CI.** `scripts/check-invariants.mjs` `CHECKS` (`:474-479`) = `sentinels`, `references`,
  `retired-invocations`, `version-bump`. Three-valued verdicts (`PASS`/`FAIL`/`UNKNOWN` → exit
  0/1/2, FAIL outranking UNKNOWN), every verdict line printing a mandatory reason so a PASS cannot
  read as vacuously green. `VERSION_BUMP_WATCHED_PREFIXES` (`:84`) = `skills/`, `agents/`,
  `references/`, diffed over `HEAD~1..HEAD`. Corpora are module-level constants with why-comments
  (`:83`, `:84`, `:85`, `:89`, `:91`, `:92`). `scripts/selfcheck-invariants.mjs` `CASES` (`:48`)
  drives per-check fixtures in a temp root, asserting exit code + stdout substrings;
  `checkStdlibImportsOnly` pins stdlib-only imports; `:424` is a cross-check case named
  `'no --only: all four checks run …'`. Current version `0.41.0`.
- **No documented convention exists for adding a check** — no `scripts/README`, nothing in
  `.claude/agent_docs/`, and `CLAUDE.md` carries no check inventory. The de-facto contract lives in
  the source and is enumerated in U6.
- **Nothing parses the moved text.** Verified end-to-end: no script reads severity, confidence, or
  dispatch templates. `sentinels` is unexposed (zero `[AUTO-SCORE: …]` tokens, heredocs, or fences
  in `ba-review:400-565` and in all 7 agents). `references` is unexposed (`ba-review/SKILL.md`
  contains no `references/` citation at all).

## Acceptance Criteria

- AC1: `skills/ba-review/SKILL.md` states the shared 29-line grammar block exactly once in full, in
  a new top-level `## Code-Anchor & Confidence Grammar` section. The three dispatch templates carry
  no copy of the *block*, but each **must** retain, in one sentence each, the bullet-format line and
  the protected-artifacts guard.
    - **Amended 2026-08-04 after the AC13 dry-run.** The original wording ("the three dispatch
      templates carry no copy of it") was implemented literally and was wrong. The templates ended up
      shipping only the apply-phrase pointer, and a dispatched subagent has neither this file nor the
      section in its context. Verified at the time: 0 of 7 `agents/*-reviewer.md` carried the guard or
      the anchor-scope rule, and the two `general-purpose` templates have no agent definition behind
      them, so a literal transcription reached the subagent with **no grammar and no guard**.
      `skills/ba-review-plan/SKILL.md` — the precedent this unit claimed to mirror — keeps both inline
      after its own apply-phrase. The parser contract and the safety guard are deliberate redundancy;
      do not de-duplicate them away again.
- AC2: All three dispatch stubs explicitly instruct the reviewer to apply the hoisted section, using
  an apply-phrase that **names the section by title** — so no stub is a dangling reference.
    - **Amended 2026-08-04.** Originally "the same mandatory phrase `ba-review-plan` uses", i.e.
      "Apply all the dispatch instructions in the section above". Dropped: "above" is a position in a
      file the dispatched subagent does not have. The phrase now names
      `## Code-Anchor & Confidence Grammar` explicitly. This diverges from `ba-review-plan`'s wording
      on purpose; `ba-review-plan` has the same latent weakness and is out of scope here.
- AC3: Each of the three per-template tails survives verbatim. Specifically the agent-based
  `MR context:` line is still present exactly once, and the read-full-files instruction is still
  present exactly twice (agent-based + user-typed, still absent from skill-based).
- AC4: `skills/ba-review/SKILL.md`'s never-hide disclaimer survives the Step 3 rewrite, as Step 3
  preamble rather than carried into a stub.
- AC5: The 7 built-in reviewer agents each carry a bare citation of the new section plus a compact
  line preserving ladder semantics, anchor calibration, the legal value set, and the position rule —
  and carry no severity-ladder block, no confidence-anchor block, and no defence-in-depth hedge.
- AC6: The section title cited by the agents resolves to a real `## ` heading in
  `skills/ba-review/SKILL.md` — the citation is not dangling — and that resolution is asserted
  mechanically by CI, not only by inspection.
- AC7: The legal-value literal is spelled identically everywhere it appears, and a CI invariant
  check fails when any one copy diverges, including divergence only in whitespace.
- AC8: `README.md` makes exactly one source-of-truth claim per contract element: the new section
  owns the ladder and anchor set; §4 keeps floors, merge math, and legacy mapping. The labeled
  user-facing summary tables at `README.md:219-238` are untouched.
- AC9: `skills/ba-execute/SKILL.md` contains no "Five-site walk" blockquote and no
  `Residual (documented` string in any of its three spellings, and `skills/ba-propose/SKILL.md`
  contains no `Review fix:` string.
- AC10: Every clause enumerated in U5's `must still assert:` lists is still present after the residue
  restatements — no contract limit is lost with its authoring frame.
- AC11: `CLAUDE.md` documents the new invariant: its check id, the pinned literal, the owning
  section, and the corpus it guards.
- AC12: `.claude-plugin/plugin.json` `version` differs from the pre-change value, and both invariant
  scripts exit 0 **when run against the squashed commit** (not against a mid-branch HEAD).
- AC13: A fresh-session `/ba-review --persist` dry-run shows reviewers actually dispatched and
  **raw** per-reviewer return text carrying the legal bullet grammar.
    - When fewer than 3 of the 7 built-ins dispatched, or when zero dispatched, the run is **void** —
      not a pass.
    - When the fixture diff includes a file under `docs/`, no reviewer proposes deleting or
      relocating it (exercises the protected-artifacts guard).

## What We're NOT Doing

- **The `references/` load-site extractions** — `ba-review`'s `--persist` step (`:714-831`) and its
  two resolvers (`:837-1132`), `ba-propose`'s Step 5f (`:735-887`) and Step 3 composition spec
  (`:350-520`), `ba-plan`'s three detail-level templates (`:249-470`). Deferred to a slice 2
  brainstorm: they make genuine behavioral claims and need their own verification bar.
- **Extracting the bullet grammar to `references/`** — it loads on every dispatch, so it is not
  branch-only material (`.claude/agent_docs/prompt-authoring.md:25-29`).
- **Collapsing the three dispatch templates onto a shared context block.** Deliberately declined
  (spec-flow SN-2). Collapsing onto the skill-based shape would stop agent-based reviewers — i.e.
  all 7 built-ins — from receiving MR title + description on MR-scope reviews. **Consequence
  accepted:** Step 3 lands at ~55-60 lines rather than the brainstorm's ~45, because each stub keeps
  its own opener and tail. Behavioral neutrality is worth the 10-15 lines.
- **Fixing the skill-based template's missing `MR context:` and read-full-files instruction.** It
  looks like a latent bug, but fixing it is a behavior change and would invalidate this slice's
  neutrality claim. Preserved as-is, on the record here.
- **Adding `references/` to `ba-propose:296`'s prompt-surface path list.** The list names
  `commands/`, `agents/`, `skills/` but not `references/`, even though
  `scripts/check-invariants.mjs:83-84` treats `references/` as prompt surface. Adding it changes
  which diffs get the pending/QA nudge — a behavior change, out of scope for a de-duplication slice.
  U5 restates the frame only and preserves the current path list exactly.
- **Widening `PROMPT_SURFACE_DIRS`** to serve the new check's corpus. That constant
  (`scripts/check-invariants.mjs:83`) is shared by `sentinels`, `references`, and — via spread —
  `retired-invocations`; widening it would silently change three existing corpora. U6 declares its
  own constants instead.
- **Reformatting the grammar block into a fenced code block.** The existing text uses inline
  backticks; a new fence risks a `heredocFencePairing` `UNKNOWN` for zero benefit.
- **Fixing the `#### U<n>` vs `### U<n>` template/owner disagreement.** `skills/ba-plan/SKILL.md:336`
  and `:406` mint four hashes while the grammar owner (`skills/ba-execute/SKILL.md:98`,
  `references/plan-sections.md:97`, `README.md:262`) specifies three. Pre-existing across all prior
  plans; `derive-state`'s substring scan still matches. Worth its own issue, not this slice.
- **Loosening any machine-boundary contract** — sentinels, the bullet grammar, the U-ID grammar,
  `resolve-stack-base`, and the single-Bash-call heredoc invariant all stay specified to the
  character (issue #59's own caution).

## Proposed Solution

Mirror `ba-review-plan:192-323`'s two-section shape in `ba-review`, but **hoist only the verified
byte-identical block** and leave each template's opener and tail in place. That keeps the composed
prompt byte-for-byte unchanged on all three paths, which is the whole basis for shipping on a
dry-run instead of a fixture A/B.

For the 7 agents, replace 19 lines with 3: a bare citation, a compact ladder/calibration line, and
the legal-value + position literal. This was revised up from 2 lines mid-planning — the 19-line
block carried ladder *definitions* and anchor *meanings* as well as the position rule, and dropping
those would have been a real capability loss on standalone dispatch, contradicting the brainstorm's
own scope boundary.

Deleting the hedge removes a real propagation rule alongside its false premise. Rather than
hand-maintain a mirror inventory, a **fifth CI invariant check** pins the legal-value literal across
`ba-review`, `ba-review-plan`, and the 7 agents, and asserts the agents' cited section resolves.
This is a deliberate widening of the slice past "free wins" — it adds script code — chosen because
mechanical enforcement beats a hand-maintained convention line for a machine-boundary literal. A
single `CLAUDE.md` line then documents the mechanism, so a future author who renames the section
learns the obligation from a doc rather than from a red CI run.

Residue splits by whether text addresses the repo's history (delete) or states a real contract limit
(restate, frame dropped). Because "keep the substance" is judgment-shaped steering applied to
contract text, U5 carries an explicit `must still assert:` clause list per site, making verification
a checklist rather than a re-reading.

## Technical Considerations

- **Ordering is load-bearing: U1 → U3 → U6 → U7.** U3's citation targets the section U1 creates.
  U6's literal-agreement assertion is **unsatisfiable until U3 lands**, because no agent carries the
  set literal today — running U6 before U3 makes CI FAIL rather than pass. U7 squashes and verifies
  last. Nothing in CI validates that a cited *section* exists (`referencesCheck` only covers
  `references/<file>` needles), which is why U6 carries that assertion explicitly.
- **The squash is load-bearing, not cosmetic.** `versionBumpCheck` reads `HEAD~1..HEAD`; landing
  units as separate commits makes every commit that touches `skills/`/`agents/` without its own bump
  FAIL. All units land as **one squashed commit on `main`** with the bump inside it. AC12 must be
  evaluated after the squash — run pre-commit it compares `8983706..2c1d53d`, which already bumped
  `0.40.1 → 0.41.0` and would give a vacuous PASS saying nothing about this change.
- **Literal spelling is pinned to the spaced form** `N ∈ {0, 25, 50, 75, 100}` everywhere, including
  correcting `ba-review-plan:293`'s unspaced copy. U6 compares exact strings rather than normalising
  whitespace — normalising would let spacing drift pass silently — and a dedicated selfcheck case
  pins that choice.
- **`§N` numbering is safe.** `§N` in these files means "Step N"; the new section is unnumbered and
  inserted between Step 2 and Step 3, so `README.md:183` (§5), `ba-review:601` (§4a), and
  `ba-review-plan:381`/`:417` need no renumbering. Recorded so a reviewer does not re-raise it.
- **`retired-invocations` trap in U5.** `ba-propose:296` currently spells `commands/*.md`, which is
  *not* a CI needle and passes today. "Modernising" it to `commands/ba/*.md` would **newly fail**
  CI. The restatement must not touch that spelling.
- **U5 changes no contract text.** The restated sites at `:227`, `:275`, `:282`, `:144`, `:145` sit
  inside `ba-execute`'s owned U-ID convention section and the `FOREIGN_UID_IN_WINDOW` guard, but
  every clause is preserved verbatim in substance — only the authoring frame is dropped. No axis-wide
  propagation on `CLAUDE.md:100-110`'s two-axis grid is triggered.
- **Verification coverage limit, on the record.** All 7 built-ins are agent-based, so a default
  `/ba-review` run composes only the agent-based template. The skill-based and user-typed stubs are
  covered by inspection (AC2, AC3), not by the dry-run.

## System-Wide Impact

- **Interaction graph.** `ba-review` Step 2 (selection ledger) → Step 3 (compose + dispatch) → Step
  4 (parse, validate, merge, snap, gate, render) → Step 4.5 (`--persist`) → Step 5 (resolution). U1
  changes only how Step 3's prompt text is *assembled*; the text delivered is unchanged. Step 4's
  parser reads reviewer output, not the templates, so it is untouched.
- **Error propagation.** A dangling stub citation would not raise an error — reviewers would emit
  plausibly-shaped bullets anyway from their own `## Output Format` (`:37-54`), and Step 4's snap at
  `:594` would legalise any stray value. Both failure paths are silent, which is precisely why AC2,
  AC6, and AC13's raw-text requirement exist.
- **State lifecycle.** No persisted state changes. `--persist` writes under `docs/reviews/`; U7 reads
  those artifacts read-only. The protected-artifacts guard covering `docs/` roots is preserved
  inside the hoisted section and exercised by AC13's fixture.
- **Cross-skill blast radius.** `ba-review-plan` shares the grammar's *shape* but owns its own
  section; U2 tightens its `:197` citation and normalises its literal, and U6 enrols it in the new
  check. `ba-execute` and `ba-propose` changes are prose-local.
- **CI surface.** Adding a fifth check changes the aggregate verdict fold, so
  `scripts/selfcheck-invariants.mjs:424`'s cross-check case ("all four checks run") must be updated
  or it silently stops proving full coverage — its expected exit still holds because FAIL outranks
  UNKNOWN.

## Implementation Approach

### Changes Required

**File**: `skills/ba-review/SKILL.md`

#### U1 — Hoist the shared grammar block out of Step 3's three templates

Insert a new top-level `## Code-Anchor & Confidence Grammar` section **between Step 2 and Step 3**
(unnumbered, so no `§N` renumbering). Name chosen for parallelism with
`skills/ba-review-plan/SKILL.md:192`'s `## Plan-Anchor & Confidence Grammar` — the anchor is a code
location, not a reviewer.

Move into it, verbatim and exactly once, the 29-line block currently triplicated at `:418-446` /
`:464-492` / `:516-544`: the severity-ladder-and-confidence preamble, the bullet-format line, the
anchor-scope paragraph with its `src/Button.tsx:42` and `web-interface-guidelines` example, the
Heading/Meaning table, the Confidence/Meaning table, the write-`None` rule, and the full
protected-artifacts paragraph naming all five `docs/` roots. Keep inline backticks for the format
line — do **not** convert to a fenced block.

Open the section with the same strength claim `ba-review-plan:194-196` makes: a parser contract, the
literal authority, not to be re-derived from prose elsewhere.

Then add `### Dispatch instructions — apply to ALL templates` inside Step 3 for the shared framing,
and reduce each template to a stub. Each stub keeps, verbatim:

- its own opener — `Task <reviewer-agent>("Review these code changes for [dimension focus].` /
  `Task general-purpose("Use the \`[skill-name]\` skill to review these code changes.` /
  `Task general-purpose("You are a code reviewer specializing in **[user-typed name]**. Review these code changes through that lens.`
- **agent-based only**: the `- MR context: [MR title + description, if MR scope]` line
- **agent-based and user-typed only**: the `Review the diff AND read the full content of changed
  files for context. …` closing line
- the mandatory apply-phrase, spelled exactly as `ba-review-plan:288` spells it: **"Apply all the
  dispatch instructions in the section above"**

Preserve `:412`'s never-hide disclaimer as Step 3 preamble — it is dispatch framing, not template
body. Leave the user-typed resolution ladder (`:507-512`) where it is; it sits above the template.
Pin every legal-value literal to the spaced spelling `N ∈ {0, 25, 50, 75, 100}`.

Test scenarios:
- A default `/ba-review` run against a local diff dispatches agent-based reviewers and they return
  bullets in the legal grammar (Covers AC1, AC2, AC13)
- An MR-scope run still supplies MR title + description to agent-based reviewers (Covers AC3)
- A run whose diff includes a file under `docs/plans/` draws no delete/relocate suggestion
  (Covers AC13)
- The never-hide disclaimer reads as Step 3 preamble, above the three stubs, not inside one
  (Covers AC4)
- The selection ledger still shows every reviewer, selected or set aside (Covers AC4)

Verify: `test "$(grep -c 'N ∈ {0, 25, 50, 75, 100}' skills/ba-review/SKILL.md)" = 4 && test "$(grep -c 'docs/brainstorms/' skills/ba-review/SKILL.md)" = 4 && test "$(grep -c 'Apply all the dispatch instructions in the ' skills/ba-review/SKILL.md)" = 3 && test "$(grep -c 'MR context' skills/ba-review/SKILL.md)" = 1 && test "$(grep -c 'Review the diff AND read the full content' skills/ba-review/SKILL.md)" = 2 && grep -q '^## Code-Anchor & Confidence Grammar' skills/ba-review/SKILL.md && grep -q 'never-hide convention' skills/ba-review/SKILL.md`

> **Verify amended 2026-08-04.** The counts were `1` for both the value-set literal and the guard,
> encoding the AC1 defect above — a literal reading of the old `Verify:` would re-strip the templates.
> Both are now `4` (one full statement in the hoisted section + one one-sentence copy per template).
> The apply-phrase needle is also truncated: the phrase now names the section explicitly
> (`in the \`## Code-Anchor & Confidence Grammar\` section`) rather than saying "above", because a
> dispatched subagent cannot resolve a relative position it has no file for.

#### U2 — Repair the two stale self-descriptions the hoist creates

`skills/ba-review/SKILL.md:392` says user-typed names resolve via handling "self-contained in Step
3" — false once the grammar leaves Step 3. Restate as resolving via Step 3's user-typed handling,
with the grammar supplied by the hoisted section.

`skills/ba-review-plan/SKILL.md:197` cites `ba-review`'s bullet grammar file-level only; tighten it
to name `## Code-Anchor & Confidence Grammar`, making the two skills mutually navigable. In the same
file, correct `:293`'s unspaced `N ∈ {0,25,50,75,100}` to the pinned spaced form.

Test scenarios:
- Reading `ba-review:392` no longer claims Step 3 is self-contained (Covers AC1)
- Reading `ba-review-plan:197` names the new section by title (Covers AC6)

Verify: `! grep -q 'self-contained in Step 3' skills/ba-review/SKILL.md && grep -q 'Code-Anchor & Confidence Grammar' skills/ba-review-plan/SKILL.md && test "$(grep -c 'N ∈ {0,25,50,75,100}' skills/ba-review-plan/SKILL.md)" = 0`

---

**File**: `agents/architecture-reviewer.md`, `agents/simplification-reviewer.md`,
`agents/security-reviewer.md`, `agents/error-handling-reviewer.md`,
`agents/test-coverage-reviewer.md`, `agents/complexity-reviewer.md`,
`agents/deep-module-reviewer.md`

#### U3 — Replace the 19-line rubric block with three lines in all 7 agents

In each file, delete the `### Severity ladder` block, the `### Confidence anchors …` block, and the
hedge blockquote (ranges: `architecture` `:54-72`, `simplification` `:54-72`, `security` `:56-74`,
`error-handling` `:55-73`, `test-coverage` `:55-73`, `complexity` `:60-78`, `deep-module` `:67-85`).
`## Principles` follows in each and must remain.

Replace with three lines, identical across all 7:

1. A **bare** citation (no `${CLAUDE_PLUGIN_ROOT}` prefix — this targets another skill's body, not a
   bundled path) of `skills/ba-review/SKILL.md`'s `## Code-Anchor & Confidence Grammar` as the
   authority for the ladder and anchor set.
2. A compact ladder + calibration line preserving the semantics the deleted blocks carried:
   Critical = correctness/security/production-breaking/data-loss; High = significant defect; Medium
   = clear improvement, not blocking; Low = nit; `Looks Good` orthogonal to severity — and 100 =
   certain, 75 = default for clearly-applicable findings, 50 = could plausibly be a false positive,
   25 = speculative, 0 = suppress.
3. The literal `N ∈ {0, 25, 50, 75, 100}` plus the position rule: confidence sits between
   `**file:line**` and `— body`.

Rationale for three lines rather than two (revised from the brainstorm): the deleted block held
ladder definitions and anchor meanings as well as the position rule, and these 7 agents are
independently registered dispatch targets invocable outside both review skills, where no
orchestrator supplies them and no consolidation pipeline snaps stray values. Dropping calibration
would have contradicted the brainstorm's own "not dropping standalone dispatch" boundary.

Note line 3 **introduces** the set literal — no agent carries it today. U6 depends on this unit.

Leave each agent's `## Output Format` section (`:37-54`) untouched.

Test scenarios:
- A directly-dispatched `dev-workflow:security-reviewer` still returns severity-graded bullets with
  a legal confidence value (Covers AC5)
- A `/ba-review` run is unaffected, since Step 3 injects the grammar regardless (Covers AC13)

Verify: `test "$(grep -l 'Severity ladder' agents/*-reviewer.md | wc -l | tr -d ' ')" = 0 && test "$(grep -l 'defence-in-depth' agents/*-reviewer.md | wc -l | tr -d ' ')" = 0 && test "$(grep -l 'Code-Anchor & Confidence Grammar' agents/*-reviewer.md | wc -l | tr -d ' ')" = 7 && test "$(grep -l 'N ∈ {0, 25, 50, 75, 100}' agents/*-reviewer.md | wc -l | tr -d ' ')" = 7`

---

**File**: `README.md`

#### U4 — Re-split the rubric source-of-truth claim

`README.md:241` currently claims §4 owns "the ladder, the anchor set, the floors, the merge math,
and the legacy mapping". After U1 that is two competing claims for one contract. Re-split it: the
new `## Code-Anchor & Confidence Grammar` section owns the **ladder and anchor set**; §4 keeps the
**floors, merge math, and legacy mapping**.

Scope guard: only the `:241` blockquote sentence changes. `README.md:219-238`'s ladder and
confidence tables are a deliberate, self-labeled user-facing summary and stay exactly as they are —
"exactly one source-of-truth claim per contract element" is about the authority sentence, not about
pruning the summary. Note `floors` also occurs at `README.md:140`, which is untouched, so the
`Verify:` below asserts the full replacement phrase rather than the bare word.

Test scenarios:
- Reading `README.md:217-241` yields one unambiguous owner per contract element (Covers AC8)
- The ladder and confidence summary tables are byte-unchanged (Covers AC8)

Verify: `grep -q 'Code-Anchor & Confidence Grammar' README.md && grep -q 'floors, merge math, and legacy mapping' README.md && test "$(grep -c 'is authoritative for the ladder, the anchor set, the floors' README.md)" = 0`

---

**File**: `skills/ba-execute/SKILL.md`, `skills/ba-propose/SKILL.md`

#### U5 — Purge authoring residue: delete history-facing text, restate contract limits

**Delete outright:**

- `skills/ba-execute/SKILL.md:410-415` — the six-line "Five-site walk (U-ID convention edit)"
  blockquote. It sits in `## Step 1: Initialize`, not inside either owned convention section, so
  neither the U-ID nor the stack-base axis loses anything. It is also already stale (says "five
  citation sites"; `README.md:264` gives six on the U-ID axis and four on stack-base) and restates
  the mirror grid `CLAUDE.md:100-110` now owns.
- `skills/ba-propose/SKILL.md:30` — the `(Review fix: this list previously lived as two independent
  near-verbatim copies …)` parenthetical.

**Restate — drop the authoring frame, keep every clause below.** For each site the `must still
assert:` list is the acceptance checklist; a restatement that loses any listed clause fails AC10.

- `skills/ba-propose/SKILL.md:507` — **highest care.** The `Review fix:` sentence and the sentence
  after it are welded by an anaphoric "It also resolves". Deleting "from `Review fix:` to end of
  paragraph" — the obvious mechanical reading — would take the fold rule with it.
  *must still assert:* (a) narrative-only is measured up front rather than measuring the rendered
  body and subtracting chrome; (b) when Where-to-look folds into Impact prose it **is** narrative at
  that point and is measured as ordinary Impact prose, not excluded.
- `skills/ba-propose/SKILL.md:296` — *must still assert:* (a) `skills/`, `agents/` paths are
  executable prompt logic, not passive documentation, and fall through to **pending** rather than
  `n/a`; (b) the `README.md`/`CLAUDE.md`/`CHANGELOG.md` exclusion is **repo-root-scoped**. Keep the
  existing `commands/*.md` spelling untouched — it is not a CI needle, and "modernising" it to
  `commands/ba/*.md` would newly fail `retired-invocations`. Do not add `references/` to the list
  (see `## What We're NOT Doing`).
- `skills/ba-execute/SKILL.md:227` — *must still assert:* (a) the winner-only-fetch trade; (b) the
  winner-fetch-failure re-selection fallback. A restatement that stops at (a) truncates the contract.
- `skills/ba-execute/SKILL.md:275` — *must still assert:* (a) the proxy assumes exactly one commit
  per unit; (b) the **revisit trigger** — if same-unit re-tagging becomes a supported flow, the proxy
  must be revisited. (b) reads like frame but is a real trigger of the kind `CLAUDE.md` requires.
- `skills/ba-execute/SKILL.md:282` — *must still assert:* (a) `FOREIGN_UID_IN_WINDOW` is a
  numeric-collision proxy, not a general foreign-window detector; (b) correct base **detection**,
  not this guard, is what narrows the base for the diff-scoping case.
- `skills/ba-execute/SKILL.md:144` **and** `:145` — these are **two distinct residuals on adjacent
  lines**, not one (the brainstorm called it "the fourth note", singular). *must still assert:*
  (a) `:144` — alternate revert subject forms (`revert:`, `chore(revert):`) do not match the
  `^Revert` exclusion and need manual re-tagging; a reverted unit reads `pending` until re-tagged;
  (b) `:145` — a description coincidentally containing `: U<n>` mid-subject is a false-positive
  match, acceptable **under the one-in-flight-plan-per-branch assumption**. That assumption is the
  shared premise `:270`, `:275`, and `:282` all rest on and must survive by name. **Rewrap so the
  assumption name lands on a single line** — it is currently split across `:146-147`, which makes it
  invisible to any line-oriented check.

Test scenarios:
- Reading `ba-execute`'s two owned convention sections still yields every stated limit (Covers AC10)
- Reading `ba-propose` Step 3's size-warning spec still resolves the folded Where-to-look case
  (Covers AC10)
- The `:275` revisit trigger and the `:282` base-detection pointer both survive (Covers AC10)

Verify: `test "$(grep -c 'Five-site walk' skills/ba-execute/SKILL.md)" = 0 && test "$(grep -c 'Review fix:' skills/ba-propose/SKILL.md)" = 0 && test "$(grep -c 'Residual (documented' skills/ba-execute/SKILL.md)" = 0 && grep -q 'chore(revert)' skills/ba-execute/SKILL.md && grep -q 'false-positive match' skills/ba-execute/SKILL.md && grep -q 'commands/\*.md' skills/ba-propose/SKILL.md`

> Needle notes, both learned by running the greps against the current tree. The brainstorm's
> `'Residual (documented)'` needle matches only `:227` — `:275` and `:282` carry parenthetical
> qualifiers — so the closing paren is dropped above. And `one-in-flight-plan-per-branch` is a poor
> assertion target: it occurs twice, the untouched `:270` copy satisfies any `grep -q` before the
> edit even happens, and the copy U5 cares about is line-wrapped. The `Verify:` asserts unwrapped
> strings unique to `:144-145` instead.

---

**File**: `scripts/check-invariants.mjs`, `scripts/selfcheck-invariants.mjs`

#### U6 — Add a fifth invariant check pinning the confidence literal and the cited section

Deleting the hedge removes its propagation rule ("any change … MUST be made in `ba-review` first and
propagated here verbatim"), which would leave 7 unguarded literal copies of a machine-boundary
contract. Replace hand-maintained mirroring with a mechanical check. **Depends on U1 and U3** — the
literal-agreement assertion is unsatisfiable until U3 introduces the literal to the agents.

Add `rubricMirrorCheck` to `CHECKS` (`scripts/check-invariants.mjs:474-479`) as a fifth entry with
id `rubric-mirror`. Follow `referencesCheck` (`:297-350`) as the structural model: build a corpus,
emit `makeRecord` verdicts, return `{subjectCount, subjectNoun, reason, records}`, print a mandatory
reason, and keep imports stdlib-only.

Declare module-level constants alongside the existing corpora (`:83-92`), each with a why-comment —
**not** by widening `PROMPT_SURFACE_DIRS`, which three other checks share:

- `RUBRIC_MIRROR_FILES` — `skills/ba-review/SKILL.md`, `skills/ba-review-plan/SKILL.md`
- `RUBRIC_AGENT_SUFFIX` — `-reviewer.md`, filtered over a `walkMarkdown('agents')` listing, since
  `loadCorpus(dirs)` cannot express a glob
- `RUBRIC_VALUE_SET_LITERAL` — the exact spaced string `N ∈ {0, 25, 50, 75, 100}`
- `RUBRIC_SECTION_HEADING` — `## Code-Anchor & Confidence Grammar`

Two assertions over that corpus:

1. **Literal agreement** — `RUBRIC_VALUE_SET_LITERAL` appears in every corpus file; a file carrying
   a divergent spelling of the value set is a `FAIL` naming the file and line. Exact-string
   comparison, not whitespace-normalised.
2. **Citation resolution** — `RUBRIC_SECTION_HEADING` is present as a heading in
   `skills/ba-review/SKILL.md`, and every `-reviewer.md` agent cites that title. A missing heading
   or a non-citing agent is a `FAIL`. This is the mechanical half of AC6 that no existing check and
   no dry-run can provide.

Three-valued verdicts per the existing harness: `UNKNOWN` when the corpus is empty, when the
reviewer-agent listing matches zero files, or when `skills/ba-review/SKILL.md` is absent or
unreadable — so the check cannot go vacuously green.

Add `CASES` entries to `scripts/selfcheck-invariants.mjs` (`:48`), each building a temp root and
asserting exit code + stdout substring, matching the existing case shape:

- `rubric-mirror FAIL — one agent carries a divergent value set`
- `rubric-mirror FAIL — value set differs only in whitespace` (fixture carries the unspaced
  `N ∈ {0,25,50,75,100}`). This pins the exact-string choice; a value-set-only fixture would also
  pass under a normalising implementation, so it would not. Direct analogue of the
  missing-leading-backtick case at `scripts/selfcheck-invariants.mjs:174-185`.
- `rubric-mirror FAIL — cited section absent from ba-review`
- `rubric-mirror PASS — all copies agree and the section resolves`
- `rubric-mirror UNKNOWN — no reviewer agents in the corpus`
- `rubric-mirror UNKNOWN — ba-review/SKILL.md absent or unreadable`

Also update the existing cross-check case at `scripts/selfcheck-invariants.mjs:424` — named
`'no --only: all four checks run …'` with three verdicts in its `expectSubstrings` (`:437`). Adding
a fifth check rots the name and silently weakens the case: `rubric-mirror` would go UNKNOWN on that
fixture, and because FAIL outranks UNKNOWN the expected exit `1` still holds, so the case would pass
while no longer proving full coverage. Rename to five and add the fifth verdict substring.

Finally, add one line to `CLAUDE.md` documenting the new invariant — check id, the pinned literal,
the owning section, and the corpus — since U3 deletes the only prose statement of the propagation
obligation. `CLAUDE.md` is this repo's registry of mirror obligations; without a line, a future
author renaming the section learns of it from a red CI run with nothing to consult.

Test scenarios:
- Changing `agents/security-reviewer.md`'s value set to `{0,50,100}` makes CI fail (Covers AC7)
- Changing one copy to the unspaced spelling makes CI fail (Covers AC7)
- Renaming `## Code-Anchor & Confidence Grammar` without updating the agents makes CI fail
  (Covers AC6)
- A clean tree passes with a printed reason naming the subject count (Covers AC7)
- `node scripts/selfcheck-invariants.mjs` exercises all six new cases and the updated cross-check
  case (Covers AC7)
- Reading `CLAUDE.md` tells a future author which check guards the literal and what it covers
  (Covers AC11)

Verify: `grep -q "id: 'rubric-mirror'" scripts/check-invariants.mjs && grep -q 'rubricMirrorCheck' scripts/check-invariants.mjs && grep -q 'RUBRIC_VALUE_SET_LITERAL' scripts/check-invariants.mjs && test "$(grep -c 'rubric-mirror' scripts/selfcheck-invariants.mjs)" -ge 6 && test "$(grep -c 'all four checks run' scripts/selfcheck-invariants.mjs)" = 0 && grep -q 'rubric-mirror' CLAUDE.md && node scripts/check-invariants.mjs --only rubric-mirror`

---

**File**: `.claude-plugin/plugin.json`

#### U7 — Bump the version, squash, and run the dry-run verification

Bump `version` from `0.41.0`. All units land as **one squashed commit on `main`** with the bump
inside it — `versionBumpCheck` reads `HEAD~1..HEAD`, so a separate follow-up bump commit leaves the
change's own commit failing.

Then run the behavioral verification in a **fresh session** (a running session executes the skill
body it loaded at start, so this cannot be self-tested): `claude --plugin-dir <repo>`, then
`/ba-review --persist` against a fixture diff that includes at least one file under `docs/`.

Assert, in this order — a failure at any step voids the run rather than scoring it:

1. Reviewer subagents actually dispatched, and **≥3 of the 7** built-ins ran. Zero dispatches is
   void; fewer than 3 barely exercises the parallel path and is also void.
2. **Raw** per-reviewer return text (from the `--persist` artifacts under `docs/reviews/`, written
   per `ba-review:750-763`) carries `- **<path>:<line>** *(confidence: N)* — <body>` with
   `N ∈ {0, 25, 50, 75, 100}`. Read raw, never the consolidated output — Step 4's snap at `:594`
   legalises stray values by construction, which would make this assertion a tautology.
3. No reviewer proposed deleting or relocating the `docs/` file in the fixture diff.

Record the coverage limit: this exercises the agent-based template only. The skill-based and
user-typed stubs are covered by inspection via AC2 and AC3.

This unit is deliberately **commit-tag-only** — it carries no `Verify:` line. Both facts it asserts
come into existence only *after* the squash and *outside* this session: "the bump is in the same
commit as the prompt edits" does not exist until the squash, and a `version != "0.41.0"` check would
rot into a tautology the moment any later release bumps past it. Resume resolves this unit from its
`U7` commit subject.

Test scenarios:
- Fresh session, `/ba-review --persist` on a fixture diff → ≥3 built-ins dispatch and raw bullets
  parse (Covers AC13)
- Fixture diff contains `docs/plans/<file>.md` → no delete/relocate suggestion (Covers AC13)
- `git show --stat HEAD` on the squashed commit shows the version bump alongside the prompt edits
  (Covers AC12)
- `node scripts/selfcheck-invariants.mjs && node scripts/check-invariants.mjs` exits 0 against the
  squashed commit (Covers AC12)

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Naive template collapse silently drops `MR context` from all 7 built-ins on MR reviews | U1 preserves tails verbatim; AC3 pins the grep counts at 1 and 2 |
| Dangling stub citation → grammar absent from composed prompt, undetected because agents self-supply bullet shape from `## Output Format` | AC2 pins the mandatory apply-phrase count at 3; U6 assertion 2 pins citation resolution mechanically |
| U6 executed before U3 → CI FAILs, since no agent carries the literal yet | Ordering chain U1 → U3 → U6 → U7 stated in `## Technical Considerations` and in U6's opening |
| Dry-run reads consolidated output → tautological pass via `:594` snapping | U7 requires `--persist` and raw per-reviewer text |
| Protected-artifacts guard lost in the hoist → invisible (bullets still legal) | Guard moves verbatim into the hoisted section; AC13 fixture includes a `docs/` file and asserts no delete/relocate |
| Residue restatement drops a contract limit with its frame | U5 carries per-site `must still assert:` clause lists; AC10 checks them |
| Residue `Verify:` greps pass vacuously (needle too narrow, or target line-wrapped) | Needles corrected against the live tree; positive assertions use unwrapped strings unique to the restated sites, and U5 requires rewrapping the assumption name onto one line |
| `ba-propose:296` restatement "modernises" `commands/*.md` → new `retired-invocations` FAIL | Explicit instruction to leave that spelling untouched; `Verify:` asserts it survives |
| Per-unit commits make `versionBumpCheck` FAIL mid-branch | Single squashed commit is a stated requirement in U7; AC12 is evaluated post-squash only |
| Pre-commit invariant run gives a vacuous PASS against the prior commit's bump | AC12 explicitly scopes the run to the squashed commit; U7 carries no `Verify:` for this reason |
| Adding a 5th check silently weakens `selfcheck:424`'s coverage case | U6 requires renaming it and adding the fifth verdict substring; `Verify:` asserts the old name is gone |
| Widening `PROMPT_SURFACE_DIRS` would change three existing corpora | U6 declares its own constants; explicitly excluded in `## What We're NOT Doing` |
| U6 widens the slice past "free wins" with new script code | Isolated in one unit with six selfcheck cases; follows `referencesCheck`'s existing structure |
| New fenced code block in the hoisted section trips `heredocFencePairing` → `UNKNOWN` | U1 keeps inline backticks; converting to a fence is explicitly out of scope |
| Session cannot self-verify its own prompt changes | U7 mandates a fresh session via `claude --plugin-dir <repo>` |

## Convention Compliance

- [x] **Prompt-authoring trust gradient** (`.claude/agent_docs/prompt-authoring.md:7-24`) — aligned.
  Machine-boundary contracts (bullet grammar, legal value set, position rule, protected-artifacts
  guard, apply-phrase) stay specified to the character; nothing is loosened. U6 adds *mechanical*
  enforcement where prose enforcement is being deleted.
- [x] **Weight is a first-class cost** (`:26-34`) — aligned. In-body hoist chosen over a
  `references/` load site because the grammar loads on every dispatch and is therefore not
  branch-only. Authoring residue removed per `:31-34`.
- [x] **Fixture-A/B-vs-dry-run** (`CLAUDE.md`) — justified override. `CLAUDE.md` says prompt changes
  are decided by fixture A/B; this ships on a fresh-session dry-run because U1's composed prompt is
  byte-identical and U3's replacement preserves every clause the deleted block carried. The
  spec-flow finding that broke the brainstorm's version of this claim (collapsed tails) is resolved
  by preserving tails, so the neutrality claim is now literally true rather than approximately true.
  Consistent with the standing "prompt-only changes ship on a dry-run" preference.
- [x] **Never-hide selection ledger** — aligned. Lives in `ba-review` Step 2, untouched; `README.md`
  and `ba-review-plan` Step 2 untouched; the Step 3 disclaimer is preserved by AC4 and U1.
- [x] **Two-axis U-ID / stack-base grid** (`CLAUDE.md:100-110`) — aligned. U5's only deletion sits in
  `## Step 1: Initialize`, outside both owned convention sections. The restatements *are* inside the
  U-ID section but change no contract text — every clause is preserved — so no axis-wide propagation
  fires. Stated explicitly in `## Technical Considerations`.
- [x] **Protected-artifacts guard** — aligned. Moved verbatim into the hoisted section, naming all
  five `docs/` roots; AC13's fixture exercises it.
- [x] **`retired-invocations` CI check** — aligned. No `/ba:` or `commands/ba/` string is introduced
  into any watched path. The `ba-propose:296` trap is defended in three places, and U5's `Verify:`
  positively asserts the safe `commands/*.md` spelling survives.
- [x] **`references/` citation check** — not applicable; no new `references/` file, and
  `ba-review/SKILL.md` contains no `references/` citation to orphan.
- [x] **`sentinels` check** — aligned. Unexposed: zero `[AUTO-SCORE: …]` tokens, heredocs, or fences
  in the rewritten ranges. U1 explicitly declines to introduce a fence.
- [x] **Version bump for every release** (`CLAUDE.md`) — aligned. U7 bumps inside the squashed
  commit; the reason the bump cannot be a follow-up commit is stated.
- [x] **Planning skills never write code** — aligned. This plan *describes* changes to `scripts/`;
  `/ba-execute` implements them. Direct precedent:
  `docs/plans/2026-07-28-feat-structural-invariant-checks-plan.md` plans these same two scripts.
- [x] **`**Code-shape decision:**` label** — aligned by *absence*. The plan contains no literal code
  block, so it carries no label. An earlier draft used the label to say "not applicable", which is a
  misuse: `skills/ba-execute/SKILL.md:450` reads the label's mere presence as a classifier over the
  whole document ("an unlabeled fence in a plan that has at least one such label is pseudo-code"),
  so a decorative label would silently reclassify any fence added during execution. Removed.
- [x] **`## Convention Compliance` section required** (`skills/ba-plan/SKILL.md` Step 5.5) — aligned.
  This section. Note `references/plan-sections.md:86` lists it only under COMPREHENSIVE while Step
  5.5 requires it unconditionally; the two disagree, and every recent plan carries it. Worth its own
  issue.
- [ ] **Detail level** — known judgment call. Strictly counted this touches 15 paths against
  STANDARD's stated 4-10. Collapsing the 7 md5-identical agents (one identical edit, one U-ID) lands
  at 9, inside STANDARD, and precedent supports it — only the 11-unit commands→skills refactor went
  COMPREHENSIVE. The one thing COMPREHENSIVE would buy is making the U1 → U3 → U6 → U7 ordering
  mechanical via phase gates rather than prose; that is mitigated by stating the full chain in
  `## Technical Considerations`, in U6's opening, and in the risk table.
- [ ] **`#### U<n>` vs `### U<n> — <title>`** — known debt, pre-existing and repo-wide.
  `skills/ba-plan/SKILL.md:336`/`:406` mint four hashes; the grammar owner
  (`skills/ba-execute/SKILL.md:98`, `references/plan-sections.md:97`, `README.md:262`) specifies
  three. `derive-state`'s substring scan still matches, so this plan follows the template like all
  prior plans. Fixing the template/owner disagreement is its own issue, excluded here.

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-08-02-prompt-surface-shrink-slice-1-brainstorm.md`. Decisions
  carried forward: slice the "free wins" from the `references/` load-site extractions; in-body
  hoist rather than a new reference file; full two-section mirror of `ba-review-plan`'s shape;
  section named for parallelism (`Code-Anchor`, not `Reviewer-Anchor`); cut the authoring frame but
  keep contract substance in residue; ship on a fresh-session dry-run with a mechanism-ran
  assertion rather than a fixture A/B.
- **Three decisions revised against the brainstorm during planning**, each on verified evidence, so
  the brainstorm now contradicts this plan in four places and should be amended or marked
  superseded: (1) the agents get 3 lines not 2 — brainstorm `:71`, `:104-107`, because ladder
  definitions and anchor meanings were also in the deleted block; (2) template tails are preserved
  rather than collapsed, so Step 3 lands at ~55-60 lines not the brainstorm's `:91` "~45", because
  `MR context` is agent-based only; (3) the deleted propagation rule is replaced by a CI check
  rather than accepted as unguarded — brainstorm `:243`/`:263` assert the hedge deletion leaves no
  gap, which is why U6 exists. Additionally brainstorm `:140` calls `ba-execute:145` the "fourth
  residual note, singular"; `:144` and `:145` are two distinct residuals.

### Internal References

- Precedent shape: `skills/ba-review-plan/SKILL.md:192-323` (`:194-196` parser-contract framing,
  `:252-281` dispatch instructions, `:288` mandatory apply-phrase, `:283-323` slim templates)
- Triplicated source: `skills/ba-review/SKILL.md:408-560`; snap behavior at `:594`; raw-text
  persistence at `:750-763`
- Convention authority: `.claude/agent_docs/prompt-authoring.md` — trust gradient (`:7-24`), weight
  as first-class cost (`:26-34`), review checklist (`:36-71`), fixture A/B protocol (`:73-93`)
- CI harness: `scripts/check-invariants.mjs:83-92` (corpus constants), `:297-350`
  (`referencesCheck` as structural model), `:352-392` (`retired-invocations` needles), `:419-472`
  (`versionBumpCheck`), `:474-479` (`CHECKS`); `scripts/selfcheck-invariants.mjs:48` (`CASES`),
  `:174-185` (the needle-pinning case U6's whitespace case mirrors), `:424` (the cross-check case
  U6 must update)
- Mirror sites: `README.md:219-238` (summary tables, untouched), `:241` (authority sentence),
  `:264` (U-ID/stack-base site counts); `CLAUDE.md:100-110` (two-axis grid)
- Instrument-failure learnings: `docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md`
  (assert the mechanism ran; a step that did not run emits nothing),
  `2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`,
  `2026-07-31-probe-instrument-validation-false-zeros.md`
- Evidence base: `docs/research/2026-07-26-opus5-context-engineering-fit-research.md` (Findings 2
  and 3); issue #59 and its two sequencing comments
