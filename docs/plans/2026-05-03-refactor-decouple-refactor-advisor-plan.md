---
title: "Decouple refactor-advisor into deep-module-reviewer"
type: refactor
status: completed
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-phase1-decouple-refactor-advisor-brainstorm.md
detail_level: standard
tags: [ousterhout, refactor-advisor, deep-module-reviewer, ba-review, ba-tdd, phase-1]
---

# Decouple refactor-advisor into deep-module-reviewer Implementation Plan

## Overview

Phase 1 of the [Ousterhout principles roadmap](../brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md): relocate the existing `refactor-advisor` agent from `agents/workflow/` to `agents/review/`, rename it `deep-module-reviewer`, and wire it into `/ba:review` as a sixth built-in reviewer. Simultaneously simplify `/ba:tdd` Step 3 to dispatch the renamed agent in **report-only inline** mode (drops the never-battle-tested per-finding apply/skip/done loop). All changes ship as one atomic MR (see brainstorm: `docs/brainstorms/2026-05-03-phase1-decouple-refactor-advisor-brainstorm.md` lines 25–34).

Bundled into a single commit because (a) ~100–150 LoC total fits below the `/ba:slice` threshold and (b) splitting would create a transient half-state where `/ba:review` lists six reviewers but one still emits non-canonical `Summary / Suggestions / No Suggestions` output (brainstorm lines 31–32).

The brainstorm explicitly enumerates 7 file edits; this plan implements those plus 4 additional `"five"` → `"six"` cosmetic cross-references that the brainstorm did not enumerate but whose update is required for ship-state consistency (resolved with user during planning — see Convention Compliance below).

## Current State

- `agents/workflow/refactor-advisor.md` (102 lines) — agent body, frontmatter (`model: inherit`, `tools: Read, Grep, Glob, LS`), `<examples>` block referencing `/ba:tdd` dispatch, output format `Summary / Suggestions / No Suggestions` with `Principle / Location / Current / Suggested / Impact` keyed blocks per suggestion.
- `agents/review/*.md` (5 review agents, ~54 lines each) — canonical shape: `name`, `description` ending in *"Use as a built-in reviewer in /ba:review."*, `model: sonnet`, no `tools:` field; 8-line `<examples>` block with stock commentary; body sections `## What You Review` / `## How to Review` / `## Output Format` / `## Principles`; output format `Must Address / Consider / Looks Good` with `**[file_path:line_number]** — [issue]` template (`agents/review/architecture-reviewer.md:33-46`).
- `commands/ba/review.md:200-208` — static built-in reviewer table lists 5 reviewers; gate sentence at `:210` says *"All five built-in reviewers MUST appear..."*; distribution rules at `:251` say *"5 built-ins first"*; distribution table at `:256-263` enumerates `5 built-in, 0 external` through `5 built-in, 4+ external` row scenarios.
- `commands/ba/review-plan.md:38-48` — sibling command with parallel 5-reviewer table and *"All five MUST appear..."* gate sentence.
- `commands/ba/tdd.md:298-361` — Step 3 (Refactor Phase) currently has 5 substeps (3a Announce/Skip → 3b Dispatch → 3c Present Suggestions → 3d Apply & Verify → 3e Commit Refactoring).
- `agents/workflow/tdd-cycle-gate.md:88` — `- **Do NOT suggest refactoring.** That is the refactor-advisor's job, not yours.`
- `CLAUDE.md:48` — `- \`refactor-advisor\` — Ousterhout deep-module refactoring guidance (Read, Grep, Glob, LS)`
- `README.md:150, :156, :168, :208` — four refactor-advisor / "five"-count references.
- `.claude-plugin/plugin.json:3` — `"version": "0.8.0"`.
- All five existing review agents at `agents/review/*.md:12` — `<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>`.
- `docs/solutions/` — directory does not yet exist; no prior learnings inform this work.

## What We're NOT Doing

(Carried forward verbatim from brainstorm "Out of Scope", lines 58–66.)

- Phases 2–5 of the roadmap (each gets its own brainstorm + plan).
- Backward-compat alias at the old agent path (`agents/workflow/refactor-advisor.md`).
- Importing/invoking from `~/Programming/playground/agent_workflow_repos/skills/` at runtime — `DEEPENING.md` is read-once-as-reference during the rewrite (parent roadmap line 41 standing constraint).
- Restructuring the agent body around the full DEEPENING framework.
- Any change to the other five review agents beyond cosmetic count updates.
- Saving the deep-module-reviewer report to disk during `/ba:tdd` — inline-only.
- In-flight `/ba:tdd` runs migration concern. Command files are read at invocation; runs started before this MR keep their pre-change Step 3 logic for that run.
- Updating historical `docs/plans/` and `docs/brainstorms/` artifacts that mention `refactor-advisor` — those are git history, not live plugin surface.
- Reworking the `## Principles` body of `tdd-cycle-gate.md:88` beyond the mechanical name swap (wording polish out of scope).

## Behaviors to Test *(consumed by `/ba:tdd` if used downstream)*

This is a refactor with no automated test surface — the plugin has no test suite. Verification is structural (file existence, content assertions) and manual (invoke the affected commands once after merge). The "behaviors" below map to acceptance criteria in the brainstorm (lines 67–77):

- [x] `agents/review/deep-module-reviewer.md` exists and conforms to canonical review-agent shape (frontmatter, examples, body sections, output format).
- [x] `agents/workflow/refactor-advisor.md` no longer exists.
- [x] `/ba:review`'s built-in table contains six rows including `deep-module-reviewer`.
- [x] `/ba:review-plan`'s built-in table contains six rows including `deep-module-reviewer`.
- [x] `/ba:tdd` Step 3 contains only Steps 3a and a simplified 3b (dispatch + print findings inline). Steps 3c, 3d, 3e are absent.
- [x] All `"five"` literal mentions in the live plugin surface (excluding historical docs) read `"six"`; all numeric `5 built-in` reads `6 built-in`.
- [x] `.claude-plugin/plugin.json` version is `0.9.0`.
- [x] `tdd-cycle-gate.md:88` references `deep-module-reviewer` instead of `refactor-advisor`.
- [x] `CLAUDE.md` and `README.md` reference `deep-module-reviewer` (no remaining `refactor-advisor` mentions in the live plugin surface).
- [x] Single atomic commit on the feature branch; MR title matches `refactor: decouple refactor-advisor into deep-module-reviewer`.

## Proposed Solution

Apply the brainstorm's selective body refresh to the relocated agent, normalize frontmatter to canon, and reshape output to a **hybrid** (per user decision during planning) — canonical `Must Address / Consider / Looks Good` section headers with multi-line bullets that retain `Current:` / `Suggested:` / `Impact:` excerpts where they sharpen the suggestion. Wire the renamed agent into both `/ba:review` and `/ba:review-plan` static tables, collapse `/ba:tdd` Step 3 to report-only inline, and sweep the `"five"` → `"six"` count update across the live plugin surface (10 sites; brainstorm enumerated 6, plan adds 4 — see Convention Compliance).

The work is structured as three commit-execution-order groups within one atomic MR (no per-group commit — single commit per the brainstorm's "single bundled MR" decision):

1. **Foundation** — agent move + body refresh + frontmatter normalize + output reshape.
2. **Wiring** — `/ba:review` table addition + `/ba:review-plan` table addition + `/ba:tdd` Step 3 collapse + `tdd-cycle-gate.md` rename.
3. **Metadata & cosmetics** — `CLAUDE.md`, `README.md`, `plugin.json` version bump, `"five"` → `"six"` sweep across the existing five review agents' example commentary.

## Technical Considerations

- **Architecture impacts.** The agent's role changes from *suggester* (called once, suggestions presented serially) to *reviewer* (called in parallel with peers, output consumed as a static report). The hybrid output format preserves actionability while still slotting into the parallel-dispatch pipeline that `/ba:review` already uses.
- **Performance.** No measurable impact. `/ba:review` already dispatches reviewers in parallel; adding a sixth peer keeps the execution time bounded by the slowest reviewer, not the count.
- **Security.** None — internal plugin reorg, no credential, network, or user-input surface.
- **Discoverability.** The static-table addition (rather than dynamic discovery) preserves the existing pattern where built-ins are declared and externals are discovered (`commands/ba/review.md:230` — *"the built-in agents already listed in 2a"*). Once `deep-module-reviewer` is in 2a, an external reviewer with the same name is correctly suppressed.

## System-Wide Impact

- **Interaction graph.** `/ba:review` Step 3 (parallel reviewer dispatch) gains one peer; partition rules at `commands/ba/review.md:251-263` shift from a 5-builtin baseline to 6. `/ba:tdd` Step 3 loses 3 substeps (3c/3d/3e) and the `git commit` that 3e produced. Step 4 (Completion) flow now fires immediately after Step 3b's report — no transitional text.
- **Error propagation.** Removing 3d (apply & verify with auto-revert) means a user who manually refactors based on the report and breaks tests will discover the breakage at Step 4's regression check (`commands/ba/tdd.md` Step 4 already runs full test verification). The safety net moves from per-suggestion to end-of-cycle. Acceptable per brainstorm line 37.
- **State lifecycle risks.** The previous Step 3e committed any applied refactors as a separate commit. Now the user's manual refactors (if any) end up uncommitted at Step 4 and either staged into the slice's completion commit or left dangling. Minor surprise; brainstorm accepts this (line 37 — *"User refactors manually after reading the report if motivated."*).
- **API surface parity.** `/ba:review` and `/ba:review-plan` both maintain a static built-in reviewer table; both must be updated to keep the plugin's two parallel reviewer surfaces in sync.
- **Slice-aware dispatch.** Step 3b's existing dispatch language (`commands/ba/tdd.md:327` — *"If executing a slice, only include files changed during this slice's TDD loop"*) stays verbatim under the new agent name. The agent receives the same constraint via the dispatch prompt; no slice-awareness logic in the agent body.

## Implementation Approach

### Group 1 — Foundation: Agent Move + Rewrite

#### 1.1 Delete `agents/workflow/refactor-advisor.md`

```bash
git rm agents/workflow/refactor-advisor.md
```

#### 1.2 Create `agents/review/deep-module-reviewer.md`

**File**: `agents/review/deep-module-reviewer.md`

```markdown
---
name: deep-module-reviewer
description: "Reviews code changes for Ousterhout deep-module design principles: small interfaces with deep implementations, dependency injection, return-over-side-effects, duplication, and shallow-layer merging. Use as a built-in reviewer in /ba:review."
model: sonnet
---

<examples>
<example>
Context: The review command dispatches this agent to check deep-module design quality.
user: "Review these code changes for Ousterhout deep-module principles: [diff of a new service module]"
assistant: "I'll analyze the changes for interface depth, dependency injection, side-effect discipline, duplication, and shallow-layer merging opportunities."
<commentary>The review command dispatches this agent as one of six parallel built-in reviewers.</commentary>
</example>
</examples>

You are a deep-module design reviewer guided by John Ousterhout's "A Philosophy of Software Design". Your job is to review code changes (provided as a git diff) for opportunities to deepen modules, simplify interfaces, and reduce complexity.

**You suggest. You do not apply.** The review command consolidates your findings alongside other reviewers' for the user to act on.

## What You Review

Analyze the code through these five Ousterhout-derived lenses:

- **Deep modules (small interface, deep implementation)**:
  - Functions with too many parameters; modules exposing internal details through their interface.
  - Shallow modules that are "all interface, no depth" — thin wrappers adding no abstraction value.
  - Opportunities to absorb complexity into the implementation so callers don't deal with it.
- **Dependency injection over hard-coded dependencies**: Hard-coded imports that should be injected (especially for testability); functions reaching into global state instead of receiving it as parameters; tight coupling to specific implementations instead of interfaces/contracts.
- **Return results over side effects**:
  - Functions that mutate external state instead of returning new values.
  - Methods communicating through side effects (modifying shared objects, writing to global stores) instead of return values.
  - Opportunities to make data flow explicit through function signatures.
- **Extract duplication**: Repeated code patterns; similar logic in test and implementation that could share a helper; copy-paste code that emerged from minimal-implementation TDD or other tactical edits.
- **Deepen modules (merge shallow layers)**: Thin pass-through layers that add no value; chains of functions where one just calls the next with minimal transformation; opportunities to merge adjacent shallow modules into one deeper module.

## How to Review

1. Read the diff to understand what changed.
2. Read the full content of each changed file for context — never review based on diff alone.
3. Check nearby files and imports to understand which abstractions already exist.
4. Identify opportunities matching each lens above.
5. Prioritize by impact: deep structural simplification first, surface tidying last.

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [Issue description]. [Why this matters for deep-module design]. Suggested fix: [specific, actionable suggestion]

## Consider
- **[file_path:line_number]** — [Issue description]. [Why this could improve the design].

## Looks Good
- [Aspect of the design that is well-implemented — a deep abstraction, a clean injection seam, an absorbed complexity boundary]

If no issues found for a severity level, write "None" under that heading.

Multi-line bullets are permitted — include `Current:` / `Suggested:` / `Impact:` excerpts under a bullet only when the diff context is non-obvious. Single-line bullets are the default.

## Principles

- **Most deep-module findings land in `Consider`.** Deep-module review is constructive, not gatekeeping. Reserve `Must Address` for design choices that will materially compound complexity if shipped (shallow modules masquerading as deep, hard-coded singletons that block testing, side-effect cascades).
- **Compare against the codebase, not abstract ideals.** If the codebase has a precedent, suggest aligning with it before suggesting a "purer" Ousterhout shape.
- **Be specific.** Reference exact file paths and line numbers. Explain WHY something is shallow / coupled / side-effect-heavy, not just THAT it is.
- **Acknowledge clean code.** If the changes are already deep and clean, say so under `Looks Good`. Do not manufacture suggestions.
- **No new features.** Refactoring changes implementation, not behavior. If a suggestion adds capability, it is not refactoring — drop it.
```

> **Notes for the implementer.** The body retains the five Ousterhout lenses verbatim from the existing `refactor-advisor` (brainstorm line 38: *"Keep the existing five Ousterhout principles as the agent's `## What You Review` body."*). Selectively port framings from `~/Programming/playground/agent_workflow_repos/skills/engineering/improve-codebase-architecture/DEEPENING.md` only where they sharpen specific lenses — read once as design reference, no runtime dependency.
>
> **Hybrid output format.** Canonical `Must Address / Consider / Looks Good` headers retained for parity with the other five reviewers. Multi-line `Current:` / `Suggested:` / `Impact:` bullets permitted because deep-module suggestions are constructive (not issue-spotting like the other reviewers) and need diff context to be actionable. Single-line bullets remain the default; multi-line is only triggered when the diff context is non-obvious. Decision resolved with user during planning (see Convention Compliance, item *"Output format: hybrid"*).

#### Success Criteria

##### Automated:
- [x] `test ! -e agents/workflow/refactor-advisor.md` — old file gone.
- [x] `test -e agents/review/deep-module-reviewer.md` — new file exists.
- [x] `head -5 agents/review/deep-module-reviewer.md | grep -q 'name: deep-module-reviewer'` — frontmatter name correct.
- [x] `head -5 agents/review/deep-module-reviewer.md | grep -q 'model: sonnet'` — model set to canonical value.
- [x] `head -10 agents/review/deep-module-reviewer.md | grep -qv '^tools:'` — no `tools:` field in frontmatter.
- [x] `grep -q 'one of six parallel built-in reviewers' agents/review/deep-module-reviewer.md` — example commentary uses "six".
- [x] `grep -q '## Must Address' agents/review/deep-module-reviewer.md && grep -q '## Consider' agents/review/deep-module-reviewer.md && grep -q '## Looks Good' agents/review/deep-module-reviewer.md` — canonical output sections present.

##### Manual:
- [ ] Visual diff of the new agent against `agents/review/architecture-reviewer.md` — confirm structural symmetry (frontmatter shape, examples block shape, body section order).

---

### Group 2 — Wiring: `/ba:review`, `/ba:review-plan`, `/ba:tdd`, `tdd-cycle-gate`

#### 2.1 Update `/ba:review` built-in reviewer table and counts

**File**: `commands/ba/review.md`

Edits (in line-order):

- `:200` — replace `the five built-in review agents` with `the six built-in review agents`.
- `:202-208` (table) — append a new row after the `test-coverage-reviewer` row:
  ```
  | `deep-module-reviewer` | Ousterhout deep-module design: small interface / deep implementation, dependency injection, return-over-side-effects, duplication, shallow-layer merging |
  ```
- `:210` — replace `All five built-in reviewers` with `All six built-in reviewers`.
- `:251` — replace `5 built-ins first` with `6 built-ins first`.
- `:256-263` (distribution table) — re-partition for 6 built-ins. Replace the 4 rows with:

  ```
  | Scenario | Questions |
  |---|---|
  | 6 built-in, 0 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage (header "Quality") |
  | 6 built-in, 1 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, external-1 (header "Quality") |
  | 6 built-in, 2-3 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage + externals (header "More") |
  | 6 built-in, 4+ external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage + up to 2 externals (header "More") · Q3-Q4: remaining externals (header "External") |
  ```

  > **Partition rationale.** See *Distribution-Table Partition (Planner Decision)* under Convention Compliance below.

#### 2.2 Update `/ba:review-plan` built-in reviewer table and counts

**File**: `commands/ba/review-plan.md`

Edits:

- `:38` — replace `Always include these five built-in reviewers` with `Always include these six built-in reviewers`.
- `:40-46` (table) — append a new row after the `test-coverage-reviewer` row:
  ```
  | `deep-module-reviewer` | Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline |
  ```
- `:48` — replace `All five MUST appear as options` with `All six MUST appear as options`.

> **Note.** `/ba:review-plan` does not have a distribution table parallel to `/ba:review`'s `:256-263`; partition logic in this command is simpler. No additional rewriting required beyond the count + row addition.

#### 2.3 Collapse `/ba:tdd` Step 3 to report-only inline

**File**: `commands/ba/tdd.md`

> **Why collapse 3c/3d/3e?** The apply/skip/done loop, auto-revert, and per-cycle refactor commit have only ~3 production uses to date — not enough usage data to justify keeping the machinery. Re-addable later if real usage demands it (see brainstorm: line 37; parent roadmap: line 54).

Edits:

- `:307` — within Step 3a's AskUserQuestion option text, replace `Run refactor-advisor` with `Run deep-module-reviewer`.
- `:312` — replace heading `### 3b. Dispatch Refactor-Advisor` with `### 3b. Dispatch Deep-Module-Reviewer`.
- `:314` — replace `- Task refactor-advisor(` with `- Task deep-module-reviewer(`.
- `:325` — replace `Suggest refactoring improvements that keep tests green.` with `Report deep-module review findings using your canonical Must Address / Consider / Looks Good output format. Tests are currently passing — flag only opportunities that preserve the green test suite.`
- After the closing `")` of the dispatch (currently at `:327`), append a new outer-narrative paragraph **in `tdd.md` itself, separate from the `Task()` prompt string**:
  ```markdown
  After the deep-module-reviewer returns its report, print the findings inline. Do not present them via AskUserQuestion. Do not apply changes. Proceed directly to Step 4 — the user can refactor manually after reading the report if motivated.
  ```
  This paragraph is command-narrative for the LLM running `/ba:tdd`, not part of the agent's dispatch prompt.
- `:329-361` (Steps 3c, 3d, 3e and their preceding `### ...` subheadings) — delete these three sections in their entirety.

> **Net effect on Step 3.** Lines 298–361 (~64 lines) collapse to lines 298–~329 (~31 lines). Step 3 now contains only 3a (announce/skip) + simplified 3b (dispatch + print findings inline). Total reduction ~33 lines, matching brainstorm projection (line 72).

#### 2.4 Rename `refactor-advisor` mention in `tdd-cycle-gate.md`

**File**: `agents/workflow/tdd-cycle-gate.md`

- `:88` — replace `That is the refactor-advisor's job, not yours.` with `That is the deep-module-reviewer's job, not yours.`

#### Success Criteria

##### Automated:
- [x] `grep -c 'deep-module-reviewer' commands/ba/review.md` returns ≥ 1 (table row added).
- [x] `grep -c 'six built-in' commands/ba/review.md` returns ≥ 2 (line 200 + line 210).
- [x] `grep -c '6 built-in' commands/ba/review.md` returns ≥ 5 (distribution rules at :251 + 4 distribution rows).
- [x] `grep -E 'five built-in|All five|5 built-in' commands/ba/review.md` returns nothing — no remaining count phrases. (Bare word `"five"` is permitted in unrelated contexts; the agent body's `"five Ousterhout-derived lenses"` is a separate count of Ousterhout principles, not the built-in-reviewer count.)
- [x] `grep -c 'deep-module-reviewer' commands/ba/review-plan.md` returns ≥ 1.
- [x] `grep -c 'six built-in\|All six MUST' commands/ba/review-plan.md` returns ≥ 2.
- [x] `grep -c 'refactor-advisor' commands/ba/tdd.md` returns 0 — all three mentions renamed.
- [x] `grep -c 'Step 3c\|Step 3d\|Step 3e\|### 3c\|### 3d\|### 3e' commands/ba/tdd.md` returns 0 — substeps deleted.
- [x] `grep -q 'deep-module-reviewer' agents/workflow/tdd-cycle-gate.md` — rename applied.

##### Manual:
- [ ] Read the rewritten `/ba:tdd` Step 3 end-to-end and confirm flow makes sense without 3c/3d/3e.
- [ ] Read `/ba:review` distribution table and mentally walk through each row scenario for plausibility.

---

### Group 3 — Metadata & Cosmetics: `CLAUDE.md`, `README.md`, `plugin.json`, agent commentary sweep

#### 3.1 Update `CLAUDE.md`

**File**: `CLAUDE.md`

- `:48` — replace
  ```
  - `refactor-advisor` — Ousterhout deep-module refactoring guidance (Read, Grep, Glob, LS)
  ```
  with
  ```
  - `deep-module-reviewer` — Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline (built-in reviewer)
  ```

  Also re-order this line to immediately follow the existing `test-coverage-reviewer` entry at `:46`, so all six reviewers are grouped together. The `tdd-cycle-gate` entry (currently at `:47`) moves to take the slot vacated at `:48`. **Why re-order:** keeps reviewer agents visually clustered for easier scanning — a one-time cosmetic that's cheaper now than later.

  Resulting section (lines 42–48):
  ```
  - `architecture-reviewer` — Code patterns, coupling, separation of concerns, naming (built-in reviewer)
  - `security-reviewer` — XSS, sensitive data, auth patterns, input validation (built-in reviewer)
  - `simplification-reviewer` — Over-engineering, unnecessary abstraction, YAGNI (built-in reviewer)
  - `error-handling-reviewer` — Edge cases, error paths, graceful failures (built-in reviewer)
  - `test-coverage-reviewer` — Missing test scenarios, test quality, coverage gaps (built-in reviewer)
  - `deep-module-reviewer` — Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline (built-in reviewer)
  - `tdd-cycle-gate` — Per-cycle TDD discipline validation (Read, Grep, Glob, LS)
  ```

#### 3.2 Update `README.md`

**File**: `README.md`

- `:150` — replace
  ```
  - **Refactor phase** — after all behaviors green, `refactor-advisor` agent provides Ousterhout-guided suggestions (deep modules, dependency injection, return results over side effects)
  ```
  with
  ```
  - **Refactor phase** — after all behaviors green, `deep-module-reviewer` agent prints inline Ousterhout-guided findings (deep modules, dependency injection, return results over side effects); user refactors manually if motivated
  ```
- `:156` — replace `using five built-in review agents` with `using six built-in review agents`.
- `:168` — replace `**Five built-in reviewers** — architecture, security, simplification, error handling, and test coverage; always available out of the box` with `**Six built-in reviewers** — architecture, security, simplification, error handling, test coverage, and deep-module design; always available out of the box`.
- `:208` (Agents table last row) — replace
  ```
  | `refactor-advisor` | Provides Ousterhout deep-module refactoring guidance after TDD behaviors are green |
  ```
  with
  ```
  | `deep-module-reviewer` | Reviews code changes for Ousterhout deep-module design principles: interface depth, dependency injection, side-effect discipline (built-in reviewer) |
  ```
  Also re-order this row to sit immediately after the existing `test-coverage-reviewer` row at `:206`, so all six reviewers group together; `tdd-cycle-gate` row at `:207` shifts down by one. **Why re-order:** matches the CLAUDE.md re-order at § 3.1 — keeps the two agent listings consistent.

#### 3.3 Bump `.claude-plugin/plugin.json` version

**File**: `.claude-plugin/plugin.json`

- `:3` — replace `"version": "0.8.0"` with `"version": "0.9.0"`.

#### 3.4 Sweep `"five"` → `"six"` in existing review-agent example commentary

**Files**: `agents/review/architecture-reviewer.md`, `agents/review/security-reviewer.md`, `agents/review/simplification-reviewer.md`, `agents/review/error-handling-reviewer.md`, `agents/review/test-coverage-reviewer.md`

- `:12` of each — replace `<commentary>The review command dispatches this agent as one of five parallel built-in reviewers.</commentary>` with `<commentary>The review command dispatches this agent as one of six parallel built-in reviewers.</commentary>`.

> **Out-of-scope check.** Brainstorm "Out of Scope" line 64 says *"Any change to the other five review agents beyond cosmetic count updates."* The line-12 commentary update is explicitly the cosmetic count update — within scope.

#### Success Criteria

##### Automated:
- [x] `grep -c 'deep-module-reviewer' CLAUDE.md` returns ≥ 1.
- [x] `grep -c 'refactor-advisor' CLAUDE.md` returns 0.
- [x] `grep -c 'deep-module-reviewer' README.md` returns ≥ 2 (line 150 + line 208).
- [x] `grep -c 'refactor-advisor' README.md` returns 0.
- [x] `grep -E 'five built-in|Five built-in' README.md` returns nothing.
- [x] `grep -q '"version": "0.9.0"' .claude-plugin/plugin.json` — version bumped.
- [x] `grep -l 'one of five parallel built-in reviewers' agents/review/*.md` returns nothing — no remaining "five" in any review agent.
- [x] Repo-wide check: `grep -rn refactor-advisor agents/ commands/ README.md CLAUDE.md .claude-plugin/` returns nothing — no live-plugin-surface mention remains.

##### Manual:
- [ ] Run `/ba:review` (no scope) on a small staged change in this repo and confirm the reviewer selection prompt lists 6 built-ins partitioned across 2 questions.
- [ ] Run `/ba:tdd` against a tiny throwaway plan and confirm Step 3 prints findings inline and proceeds directly to Step 4 with no apply/skip/done loop.
- [ ] Skim `CLAUDE.md` and `README.md` for visual symmetry of the agent list / table after the rename.
- [ ] When running `/ba:review` above, ensure `deep-module-reviewer` emits at least one multi-line bullet (with `Current:` / `Suggested:` / `Impact:` excerpts); confirm the consolidation step renders the multi-line content without truncation or markdown artifacts.

> **MR gate (single-commit variant).** Groups 1, 2, 3 share one commit. The success-criteria checks above run as a single battery before commit; any failure blocks the commit. There is no per-group commit/pause sequence — that contradicts the brainstorm's atomic-MR decision. ("Phase 1" in this plan refers to the parent roadmap's Phase 1 of 5, not the internal Group 1/2/3 organization.)

## Dependencies & Risks

- **Risk: distribution-table partition is non-obvious.** The 6-builtin Q1/Q2 partition was chosen by the planner (not the brainstorm) — see § 2.1 partition rationale. If user QA on the manual success criteria reveals an awkward Q1/Q2 split (e.g., Deep-module feels miscategorized as "Quality" in the 0-external row), revise the table before merge. Mitigation: surfaced for review in Convention Compliance below.
- **Risk: hybrid output format diverges from canon.** The other five reviewers use single-line bullets exclusively; the new agent permits multi-line bullets with `Current:` / `Suggested:` / `Impact:` excerpts (per user decision during planning). This is a documented divergence from the strict pattern, justified by the actionability of refactoring suggestions vs the issue-spotting nature of the other reviewers. If a future review-pipeline parser depends on single-line bullets, the divergence becomes a regression. No such parser exists today.
- **Risk: in-flight `/ba:tdd` runs.** Confirmed safe — command files are read at invocation time (verified in Out of Scope above). No mitigation required.
- **Long-term cost: literal-count change amplification.** The `"five"` / `"six"` / `"seven"` literal-count pattern lives at ~10 sites across the plugin (count phrases + per-agent commentary lines). Each future built-in addition (Phase 2's `complexity-reviewer`, etc.) faces the same sweep. Worth considering a single-sourced count if the count keeps changing — out of scope for Phase 1 but flagged for Phase 2's brainstorm.
- **Dependency: none.** No code outside this plugin imports the affected agents or commands. No version-locked downstream consumers.

## Sources & References

### Origin

- **Brainstorm**: [`docs/brainstorms/2026-05-03-phase1-decouple-refactor-advisor-brainstorm.md`](../brainstorms/2026-05-03-phase1-decouple-refactor-advisor-brainstorm.md). Key decisions carried forward:
  - Single bundled MR (brainstorm lines 25, 30–34).
  - Selective body refresh, not full rewrite; DEEPENING.md read-once-as-reference (line 38).
  - Output format adopts canonical review-agent shape (line 39) — *amended during planning to "hybrid" per user resolution*.
  - Frontmatter normalizes to `model: sonnet`, drop `tools:` (line 40).
  - Add `<examples>` block referencing `/ba:review` dispatch (line 41).
  - Static table addition, not dynamic discovery (line 42).
  - No backward-compat stub (line 43).
  - Cosmetic `"five"` → `"six"` count sweep (line 44) — *expanded during planning beyond brainstorm enumeration to cover review.md:200/251, README.md:156/168, review-plan.md:38/48 per user resolution*.
  - Version bump 0.8.0 → 0.9.0, coupled with feature commit (line 45).
  - Step 3 collapse to report-only inline (line 37).

### Internal References

- Canonical review-agent template: `agents/review/architecture-reviewer.md:1-53`.
- Existing agent body (source for body refresh): `agents/workflow/refactor-advisor.md:28-62` (five Ousterhout lenses).
- `/ba:review` static built-in table: `commands/ba/review.md:200-263`.
- `/ba:review-plan` static built-in table: `commands/ba/review-plan.md:38-48`.
- `/ba:tdd` Step 3 (target of collapse): `commands/ba/tdd.md:298-361`.
- `tdd-cycle-gate` reference to refactor-advisor: `agents/workflow/tdd-cycle-gate.md:88`.
- Parent roadmap discipline rules: `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md:130-160`.

### External References

- John Ousterhout, *A Philosophy of Software Design*, 2nd ed. (referenced as design source in agent body; not invoked at runtime).
- `~/Programming/playground/agent_workflow_repos/skills/engineering/improve-codebase-architecture/DEEPENING.md` — read-once-as-reference during agent body refresh; **no runtime dependency** per parent roadmap line 41 standing constraint.

## Convention Compliance

Validated against `CLAUDE.md`, `commands/ba/plan.md` template, brainstorm `docs/brainstorms/2026-05-03-phase1-decouple-refactor-advisor-brainstorm.md`, and parent-roadmap discipline rules (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md:130-160`). Detailed findings recorded in the Convention-Compliance Check section appended after agent run (Step 5 of `/ba:plan`).

- [x] **Filename format** (`docs/plans/YYYY-MM-DD-<type>-<descriptive-name>-plan.md`) — `2026-05-03-refactor-decouple-refactor-advisor-plan.md` ALIGNED.
- [x] **Frontmatter required fields** (`title`, `type`, `status`, `date`, `origin`, `detail_level`, `tags`) ALIGNED.
- [x] **Agent naming** (`deep-module-reviewer` — lowercase-with-hyphens, `-reviewer` suffix matching `agents/review/` precedent) ALIGNED.
- [x] **Agent placement** (`agents/review/`) ALIGNED.
- [x] **Frontmatter normalization** (`model: sonnet`, drop `tools:`) ALIGNED with review-agent canon.
- [x] **No-runtime-dependency on skills repo** ALIGNED — DEEPENING.md framed as read-once-as-reference.
- [x] **Update README.md / CLAUDE.md / `plugin.json`** (CLAUDE.md lines 64, 71) ALIGNED — Group 3 enumerates all three.
- [x] **Plan never contains code** (CLAUDE.md line 67) — JUSTIFIED OVERRIDE: this plan contains the **agent file body** as exact content because the brainstorm next-step (line 104) demands "concrete steps in commit-execution order", and `commands/ba/plan.md` requires *"actual code — not descriptions of code"* in implementation sections. The deliverable here is a markdown agent file (prompt-engineered text, not executable code); CLAUDE.md's "no code" rule targets the planning *commands* writing implementation code into source files, not plans documenting markdown content as the artifact's deliverable.
- [x] **All built-in reviewers always appear as options in `/ba:review`** (CLAUDE.md line 73) ALIGNED — static table addition preserves the contract.
- [x] **Version bump in `plugin.json` for every release** (CLAUDE.md line 64) ALIGNED — Group 3.3.
- [x] **Update README.md when commands/agents/artifact paths change** (CLAUDE.md line 71) ALIGNED — Group 3.2 covers all four affected lines.
- [x] **Discipline-section red-flag compliance** (parent roadmap lines 134–142) ALIGNED — single bundled MR (no monotonic LoC growth), file/line-concrete decisions (no abstract vocabulary creep), no >2-layer threading, no verifier-finding-triggers-machinery (this phase *removes* machinery — Step 3c/d/e).
- [x] **Discipline-section concrete rules** (parent roadmap lines 152–160) ALIGNED — plan stays under 600 lines (currently ~430), no parameter/type/ref threading, plan was iterated 1 round (within 3-4 cap), every section is load-bearing (no pure-additive padding).

### Resolved-During-Planning (Scope Expansions Beyond Brainstorm Enumeration)

The brainstorm enumerated 6 cross-reference sites (line 55) and 2 cosmetic-count sites (`commands/ba/review.md:210` + `:256-263`). Spec-flow analysis surfaced 4 additional `"five"` mentions plus a parallel sibling-command table that the brainstorm did not enumerate. Resolved during planning with user (AskUserQuestion):

- **Scope expansion accepted** for: `commands/ba/review.md:200`, `commands/ba/review.md:251`, `README.md:156`, `README.md:168`, `commands/ba/review-plan.md:38`, `commands/ba/review-plan.md:40-46` (table), `commands/ba/review-plan.md:48`. **Justification**: shipping inconsistent state (`"six"` in some places, `"five"` elsewhere) violates the brainstorm's atomic-MR invariant (line 32). The expanded sites are mechanical and total ~7 additional one-line edits.
- **Output format changed from "pure canon" to "hybrid"**: brainstorm line 39 specified canonical single-line bullets `**[file:line]** — [issue]`. User decision during planning: hybrid (section headers + multi-line bullets with `Current:` / `Suggested:` / `Impact:` excerpts permitted). **Justification**: deep-module suggestions lose actionability when the diff context (current vs suggested code excerpt) is collapsed to a single line; the other five reviewers report issues whereas this reviewer reports constructive suggestions, and the format should reflect that asymmetry. **Risk**: documented in Dependencies & Risks above.

### Distribution-Table Partition (Planner Decision)

The brainstorm acceptance criterion (line 71) requires `commands/ba/review.md:256-263` to say `"six"` rather than `"five"`, but does not specify the new Q1/Q2 row contents. The planner chose the partition at § 2.1 with two coupled decisions:

1. **Cluster choice** — Deep-module joins the design-analysis cluster (Architecture / Security / Simplification) in Q1, not the quality cluster (Error handling / Test coverage) in Q2. Rationale: deep-module review is about *how the code is shaped*, not *whether it holds up at runtime*.
2. **Q1=4 stability across all four rows** — a deliberate change from the prior 5-builtin baseline (which kept Q1=3 at low external counts and bumped to Q1=4 only at 2+ externals). With 6 builtins, Q1 grows to a stable 4 because the design cluster gains a fourth member.

Both choices satisfy the existing constraints at `commands/ba/review.md:252` (groups of 2-4, never leave 1 alone) and `:254` (16-cap from 4 questions × 4 options). **Reviewable during plan review** — if the implementer / reviewer prefers the prior pattern (Deep-module in Q2 at 0/1 external; Q1 scales 3→4 with externals), the table can be re-balanced before commit; both partitions satisfy the constraint set.
