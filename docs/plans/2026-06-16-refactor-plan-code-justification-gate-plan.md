---
title: Justification-Gated Code in /ba:plan
type: refactor
status: completed
date: 2026-06-16
origin: docs/brainstorms/2026-06-15-plan-code-justification-gate-brainstorm.md
detail_level: standard
iteration_count: 1
tags: [plan, execute, slice, verbosity, keep-code, code-shape-decision]
---

# Justification-Gated Code in /ba:plan Implementation Plan

## Overview

Change the dev-workflow planning pipeline so plan documents default to **decisions** (approach, exact file
paths, patterns-to-follow, pseudo-code for shape, test scenarios) and permit a **literal code block only where
the code's shape *is* the design decision** — flagged with an explicit `**Code-shape decision:** <why>` label.
This reframes the purpose of code in a plan from *rework-prevention* (unmeasured, already half-disabled by
`/ba:execute`) to *design validation* — a forcing function applied precisely where the design is non-obvious.
It is a form/contract change to existing command prompts, not a redefinition of what a plan is for (see
brainstorm: docs/brainstorms/2026-06-15-plan-code-justification-gate-brainstorm.md).

## Current State

The keep-code mandate is asserted in several independent places and consumed downstream:

- **plan.md** mandates literal code in all three template tiers and at the rule level:
  - MINIMAL detail-level description: `commands/ba/plan.md:149` — "Sections: ... context, MVP code."
  - Template placeholders: `commands/ba/plan.md:230` ("[Actual code — not descriptions of code]"),
    `:286` ("[Actual code — not descriptions]"), `:354` ("[Actual code]").
  - "Key rules for all templates": `commands/ba/plan.md:422` — "Include **actual code** — not descriptions of code".
  - "Important Guidelines": `commands/ba/plan.md:535` — "**Exact file paths and code** — never use placeholders".
  - Step 0 brainstorm carry-forward list (`commands/ba/plan.md:39-46`) does **not** name `## Locked Design`.
- **execute.md** already half-tolerates code-light plans but frames the plan as follow-exactly:
  - Step 2b: `commands/ba/execute.md:209` ("Follow the plan exactly — it has already been reviewed and approved"),
    `:211` (forks on "provides actual code" vs "describes the change without full code"),
    `:213` ("Plan code samples are structural references, not complete comment inventories").
  - Step 1.5b LoC projection: `commands/ba/execute.md:139-141` (counts literal code-block lines; estimates when "no code in plan").
  - Standing guideline: `commands/ba/execute.md:443` — "**The plan is the authority.** Follow it."
- **slice.md** sizes tasks by counting code-fence lines (`commands/ba/slice.md:66-68`, `:72`), with a graceful
  no-fence fallback at `:74` ("estimate conservatively (~30-50 LoC per described file change)").
- **README.md:101** — "Transforms feature descriptions into implementation plans **with exact file paths and code**."
- **`## Locked Design`** is authored by `commands/ba/brainstorm.md:272` (and gated at `:303`/`:305`) and already
  consumed by `commands/ba/propose.md:295,423,441`. It contains interface, signatures, invariants, error modes,
  and a usage example — the pipeline's existing decisions-only "shape" artifact.
- **No contract break needed** in `review-plan.md` or `plan-iteration-gate` — both count plan-body LoC
  shape-agnostically (`review-plan.md:216-220`, `plan-iteration-gate.md:38`); the only effect is a smaller LoC
  number when code becomes prose. `convention-checker` does **not** mandate literal code (it lists "code patterns"
  as a convention *category* at `convention-checker.md:127`, not a presence requirement) — verified, no edit needed.

## What We're NOT Doing

- **NOT** redefining what a plan is *for* — purpose untouched; form/contract only (see brainstorm: Scope Boundaries).
- **NOT** going pure decisions-only — the code-shape carve-out stays.
- **NOT** measuring rework-prevention — moot under the design-validation reframe.
- **NOT** changing `/ba:review-plan` (deferred — orthogonal, and the hybrid changes its inputs; decide its fate
  after the hybrid lands).
- **NOT** changing the MINIMAL/STANDARD/COMPREHENSIVE tier *purposes* — decisions-default applies across all tiers
  (tiers scale context/phasing, not the presence of code).
- **NOT** editing `brainstorm.md` or `propose.md` — `## Locked Design` is owned by brainstorm.md and already
  correctly consumed by propose.md; plan.md only *references* it. (Confirmed by the convention check — those files
  need no contract change.)
- **NOT** recalibrating the scope-tripwire / estimate threshold — flagged as a follow-up to observe whether
  estimate-dominated projections under-fire; out of scope here. Note the two consumers have different exposure:
  execute's tripwire (`T = 2 × N`) only degrades on decisions-only steps where estimation was already the fallback,
  whereas `/ba:slice` now estimates on the *common* path and its low fallback (`~30-50 LoC`) directly drives MR
  sizing — so slice is the more urgent recalibration candidate when this follow-up is taken up.

## Behaviors to Test

- [ ] A plan authored by `/ba:plan` defaults to decisions + exact file paths + patterns + pseudo-code + test
      scenarios, with no literal implementation code unless a `**Code-shape decision:**` label is present.
- [ ] A `**Code-shape decision:**` block appears only where re-deriving the shape from prose would plausibly
      produce a different, wrong structure; the rule's example pair makes the boundary unambiguous.
- [ ] When a brainstorm origin exists, a code-shape block names the brainstorm's `## Locked Design` as its anchor.
- [ ] When no brainstorm exists, a code-shape block is still permitted and anchors to the plan's own Proposed
      Solution / research findings (the MINIMAL/standalone case is not gutted to prose-only).
- [ ] `/ba:execute` on a **pre-change plan** (all literal code, no labels) still implements that code as written —
      no fidelity regression.
- [ ] `/ba:execute` on a **new decisions-default plan** writes code from the decisions and reuses literal code
      verbatim only where a code block is present.
- [ ] `/ba:execute` Step 1.5b and `/ba:slice` estimate diff size from the description for pseudo-code/decisions and
      line-count only literal code blocks (those preceded by a `**Code-shape decision:**` label) — the scope-tripwire
      still fires.
- [ ] `/ba:slice` on a pre-change plan (no labels anywhere, all literal code) line-counts every fenced block — it
      does not route old plans to the low estimate fallback and under-size MRs.
- [ ] The softened execute framing does not contradict "the plan is the authority": decisions remain binding,
      literal code blocks remain authoritative verbatim, and execute does not invent build choices around them.

## Proposed Solution

Invert the keep-code default everywhere it is asserted, introduce a single self-policing trigger (the
`**Code-shape decision:**` label), wire plan.md to brainstorm's `## Locked Design`, and make the downstream
consumers (execute, slice) backward-safe and pseudo-code-aware. The label is the load-bearing mechanism: it is
self-policing, works with or without a brainstorm, and simultaneously fills the under-served "design rationale"
gap the verbosity research identified (see brainstorm: Key Decisions).

**Backward-compatibility strategy (resolves the largest gap):** rather than a frontmatter flag, make execute treat
**any literal code block as binding when present**. For pre-change plans (all literal code) this preserves full
fidelity; for new plans — which under the authoring rule carry literal code *only* under a `**Code-shape
decision:**` label — "any literal code is binding" is equivalent to "code-shape blocks are binding." The two
cases unify with no version marker required.

## Technical Considerations

- **Trigger precision is the main risk.** A judgment-call label over-applies (justify everything → status quo with
  noise) or under-applies (drop a genuinely non-obvious shape → execute re-derives it wrong). Mitigation: the rule
  ships with one positive example, one negative example, and a tiebreaker ("when unsure, include + label — a
  false-positive label costs review attention; a false-negative loses the design").
- **Pseudo-code must not be line-counted as literal code** in execute Step 1.5b and slice LoC estimation, or the
  scope-tripwire projection is biased low. Route pseudo-code/decisions to estimate-from-description; line-count only
  literal code blocks.
- **Cross-file sync.** The `**Code-shape decision:**` label wording must stay identical across plan.md (author),
  execute.md (consume), and README.md (describe). Add a CLAUDE.md convention naming these mirrors, following the
  existing `/ba:review` "keep them in sync" precedent (`CLAUDE.md:80`).

## System-Wide Impact

- **Interaction graph**: `/ba:plan` (author) → plan doc → consumed by `/ba:execute` (implement), `/ba:slice`
  (size tasks), `/ba:review-plan` (review), `plan-iteration-gate` (LoC discipline). Only plan.md, execute.md,
  slice.md change behavior; review-plan and the gate are shape-agnostic and unaffected.
- **Error propagation**: the only failure mode is a mis-applied label; the example pair + tiebreaker bound it.
  No runtime/source-code error path is touched (these are prompt files).
- **State lifecycle risks**: pre-change plans on disk are the partial-state risk — addressed by the
  "literal code is binding when present" rule so old plans execute unchanged.

## Implementation Approach

All edits are to Markdown command-prompt files plus one JSON version bump. The exact target wording is itself the
deliverable — for a prompt-engineering change the wording *is* the design decision, so each edit below gives the
precise replacement text.

### Changes Required

**File**: `commands/ba/plan.md`

**Code-shape decision:** the prompt wording is the artifact; the exact phrasing of the label rule, examples, and
tiebreaker determines whether the model over/under-applies the trigger, so the literal text is the design.

1. **MINIMAL detail-level description** (`:149`) — replace "context, MVP code." with wording that makes MVP
   decisions-default: e.g. "context, MVP (decisions + pseudo-code by default; literal code only under a
   `**Code-shape decision:**` label)."
2. **Template placeholders** (`:230`, `:286`, `:354`) — replace each `[Actual code ...]` placeholder with a
   decisions-default placeholder, e.g.:
   ```
   [Decisions: approach, exact paths, patterns to follow, pseudo-code for shape, test scenarios.
   Add a literal code block only under a **Code-shape decision:** label — see "Key rules".]
   ```
3. **"Key rules for all templates"** (`:420-425`) — replace line 422 ("Include **actual code** — not descriptions
   of code") with the justification-gated rule, and append the trigger spec block immediately after the list:
   ```
   - **Default to decisions, not code** — approach, exact file paths, patterns to follow, pseudo-code for
     shape, and test scenarios. Include a literal code block ONLY under a `**Code-shape decision:** <why the
     shape is non-obvious>` label.

   **Code-shape decision rule:** Add a literal code block + label only when re-deriving the shape from a prose
   decision would plausibly produce a *different, wrong* structure (a specific reducer state machine, a
   concurrency-sensitive ordering, a tricky query window).
   - ✅ Positive: a state-machine reducer whose exact case/transition set is the decision → include it, labeled.
   - ❌ Negative: a standard CRUD handler or an obvious mapping → describe it; do not include literal code.
   - When unsure, include the code + label: a false-positive label costs a little review attention; a
     false-negative loses the design.
   - **Anchor:** when a brainstorm origin exists, a code-shape block anchors to the brainstorm's
     `## Locked Design` (interface, signatures, invariants, error modes). With no brainstorm, it anchors to the
     plan's own Proposed Solution / research findings.
   ```
4. **"Important Guidelines"** (`:535`) — soften "**Exact file paths and code** — never use placeholders" to
   "**Exact file paths and decisions** — never use placeholders; literal code only under a `**Code-shape
   decision:**` label".
5. **Step 0 carry-forward list** (`:39-46`) — add a bullet that, *when a brainstorm origin exists*, code-shape
   blocks **additionally** anchor to its `## Locked Design` (interface/signatures/invariants/error modes) — phrased
   as additive, not as a gate. A code-shape block is still permitted with no brainstorm (it anchors to the plan's
   own Proposed Solution / research). Distinguish `## Locked Design` from the prose carry-forward items already in
   the list: reference it explicitly in code-shape blocks; do not paraphrase its interface signatures.

**File**: `commands/ba/execute.md`

**Code-shape decision:** the binding-when-present rule is the backward-compat contract; its exact phrasing
determines whether old plans regress, so the literal replacement text matters.

6. **Step 2b** (`:209-213`) — soften "Follow the plan exactly — it has already been reviewed and approved" to an
   implement-to-decisions framing, and make literal code binding-when-present:
   ```
   Implement the plan's decisions for this task. Where the plan provides a literal code block, implement that
   code as specified — it captures a committed decision (a `**Code-shape decision:**` block makes this explicit;
   any literal code block in a plan is binding). Where the plan gives decisions, pseudo-code, or descriptions,
   implement to them following existing codebase patterns. Where a literal code block and prose both address the
   same file or function, the code block governs the structure; the prose is context.
   ```
   Keep `:213` (carry over WHY comments not reproduced in the plan) — it stays coherent under the new wording.
7. **Step 1.5b LoC projection** (`:139-141`) — route pseudo-code/decisions to estimate-from-description; line-count
   only literal code blocks; flip the default branch. A fenced block is **literal** only when it is immediately
   preceded by a `**Code-shape decision:**` label; any unlabeled fence is pseudo-code. Exception: if the plan has
   no `**Code-shape decision:**` labels anywhere (a pre-change plan), treat every fenced block as literal:
   ```
   - **Plan provides a literal code block for this file** (fence under a `**Code-shape decision:**` label, or any
     fence in a pre-change plan with no labels at all): count the lines of that block.
   - **Decisions/pseudo-code only, file exists**: estimate the diff size from the description; reference similar
     implementations if needed.
   - **New file, decisions only**: estimate from the closest analogue.
   ```
8. **Standing guideline** (`:443`) — reconcile "**The plan is the authority.** Follow it." with decisions-default:
   ```
   - **The plan's decisions are the authority.** Literal code blocks are authoritative verbatim; implement
     everything else to the plan's decisions. Don't add features, refactor surrounding code, or invent build
     choices the plan deliberately left as decisions.
   ```

**File**: `commands/ba/slice.md`

9. **LoC counting rules** (`:66`, `:72-74`) — clarify that pseudo-code in fences is not literal code: only literal
   code blocks (fences immediately preceded by a `**Code-shape decision:**` label) are line-counted; pseudo-code/
   decision prose uses the estimate fallback already at `:74`. **Backward-compat:** if the plan has no
   `**Code-shape decision:**` labels anywhere (a pre-change plan), treat every fenced block as literal and
   line-count it — otherwise old plans route all code to the low estimate fallback and slice under-sizes MRs.
   Mirror execute Step 1.5b's routing exactly so the two stay consistent.

**File**: `README.md`

10. **Line 101** — replace "with exact file paths and code" with "with exact file paths and decisions (literal
    code only where the code's shape is the design decision)".

**File**: `.claude-plugin/plugin.json`

11. **Version** — bump `0.23.0` → `0.24.0` (behavioral contract change; it is the auto-update cache key — do not
    defer).

**File**: `CLAUDE.md`

12. **Add a cross-file sync convention** (mirroring the `:80` precedent) naming the `**Code-shape decision:**`
    label mirror locations: `commands/ba/plan.md` ("Key rules" trigger block), `commands/ba/execute.md` (Step 2b
    and Step 1.5b), `commands/ba/slice.md` (LoC classification rule), and `README.md` (`/ba:plan` description) —
    keep them in sync. Scope this convention to the *label* only; the `## Locked Design` anchor is owned by
    `commands/ba/brainstorm.md` and is referenced, not redefined, here.

### Success Criteria

#### Automated:
- [x] `grep -n "actual code" commands/ba/plan.md` — returns nothing (mandate removed at `:230/:286/:354/:422`).
- [x] `grep -rn "Code-shape decision" commands/ba/plan.md commands/ba/execute.md commands/ba/slice.md README.md` —
      label present and identically worded in all four.
- [x] `grep -n '"version"' .claude-plugin/plugin.json` — shows `0.24.0`.
- [x] `grep -n "Locked Design" commands/ba/plan.md` — Step 0 names it as a source.
- [x] `grep -n "exact file paths and code" README.md` — returns nothing (line 101 softened).

#### Manual:
- [ ] Re-render one STANDARD and one COMPREHENSIVE plan under the new rule: code volume drops to only justified
      blocks, and the design "why" now appears where code used to (brainstorm Validation criterion).
- [ ] Dry-read execute Step 2b against an existing pre-change plan in `docs/plans/` — confirm its literal code is
      still treated as binding.
- [ ] Confirm the `**Code-shape decision:**` example pair reads unambiguously (a reviewer can classify a sample
      block correctly using only the positive/negative examples + tiebreaker).

## Dependencies & Risks

- **Risk: trigger drift.** Mitigated by the example pair + tiebreaker; revisit if re-rendered plans show
  over/under-application.
- **Risk: label fatigue.** The include-when-unsure tiebreaker biases toward applying the label, which over time can
  normalize it and weaken its signal value (if every block is labeled, the label stops marking non-obvious shape).
  Acceptable for a first version — the example pair bounds the clearest cases; named here as a known drift risk to
  watch, not mitigated with extra mechanism.
- **Risk: scope-tripwire under-fires** on estimate-dominated plans (estimates may run low vs. counted code).
  Accepted for this change; threshold recalibration is a flagged follow-up, not bundled (see What We're NOT Doing).
- **Dependency: none external.** All edits are self-contained prompt/JSON files. Prompt-only changes ship on a
  dry-run; no real-harness integration test gates this merge (per standing practice).

## Sources & References

- Origin brainstorm: `docs/brainstorms/2026-06-15-plan-code-justification-gate-brainstorm.md` — key decisions
  carried forward: hybrid (decisions-default, code-by-exception), justification-gated trigger, anchor to
  `## Locked Design`, purpose reframe to design-validation, plan stays the authority, review-plan deferred.
- Consolidated verbosity research: `docs/research/2026-06-14-plan-verbosity-consolidated-research.md` — implementation
  body is 60–80% of every painful plan; #1 review-cost driver is prose inside code.
- Current state: `commands/ba/plan.md:149,230,286,354,422,535`, `:39-46`; `commands/ba/execute.md:209-213,139-141,443`;
  `commands/ba/slice.md:66-74`; `README.md:101`; `.claude-plugin/plugin.json:3`.
- `## Locked Design` definition: `commands/ba/brainstorm.md:272,303,305`; consumers: `commands/ba/propose.md:295,423,441`.
- Sync precedent: `CLAUDE.md:80` (`/ba:review` "keep them in sync").

## Deviations

### Task 4 (README edit 10): wording adjusted to carry the label token
- **Expected**: Edit 10's illustrative text "…where the code's shape is the design decision" (no `**Code-shape decision:**` token).
- **Found**: That wording fails AC2 (label "identically worded in all four" files) and makes edit-12's sync convention — which names README as a label mirror — untruthful.
- **Why**: Edit 10's phrasing predates the review round that added README to the sync mirror set; intent (two sources) is that README carries the label.
- **Resolution**: accepted — README now reads "literal code only under a `**Code-shape decision:**` label, where the code's shape is the design decision", satisfying AC2 and the sync convention.

## Convention Compliance

- [x] **Planning commands never write code** (`CLAUDE.md:75`) — aligned; rule governs command runtime, not plan-doc
      content. A decisions-default plan is *less* code-bearing than today, so cannot newly violate it. The change
      strengthens plan.md's documenter role.
- [x] **Update README.md on behavior change** (`CLAUDE.md:81`) — aligned; edit 10 softens the one code-bearing claim.
- [x] **Bump plugin.json version** (`CLAUDE.md:79`) — aligned; edit 11 bumps `0.23.0` → `0.24.0` in the same change.
- [x] **Cross-file sync discipline** (`CLAUDE.md:80`) — aligned; edit 12 adds a convention scoped to the
      `**Code-shape decision:**` label across plan.md/execute.md/slice.md/README.md, naming section anchors per the
      precedent.
- [x] **`## Locked Design` mirror completeness** — resolved: the new sync convention is scoped to the label only;
      the anchor stays owned by brainstorm.md and consumed by propose.md (no contract change there), so the convention
      is not factually incomplete.
- [x] **No new artifact files** — all 12 edits modify existing files; frontmatter/agent-naming/namespace conventions N/A.
