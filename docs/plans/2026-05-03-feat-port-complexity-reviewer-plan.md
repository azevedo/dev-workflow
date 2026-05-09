---
title: "feat: Add complexity-reviewer (port assess-complexity)"
type: feat
status: completed
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-phase2-port-complexity-reviewer-brainstorm.md
detail_level: standard
tags: [ousterhout, assess-complexity, complexity-reviewer, ba-review, phase-2]
---

# feat: Add complexity-reviewer (port assess-complexity) Implementation Plan

## Overview

Phase 2 of the Ousterhout principles roadmap (see brainstorm: `docs/brainstorms/2026-05-03-phase2-port-complexity-reviewer-brainstorm.md`). Add a new `agents/review/complexity-reviewer.md` organized around Ousterhout's three complexity manifestations — cognitive load, change amplification, and obscurity / unknown-unknowns — with two non-overlapping Dodds salvages folded in as sub-bullets. Wire it into `/ba:review` and `/ba:review-plan` as the seventh built-in reviewer alongside the six shipped in Phase 1. Single atomic MR mirroring Phase 1's footprint (`c470a81`).

## Current State

- **Six built-in reviewers** under `agents/review/` (`architecture-reviewer.md`, `security-reviewer.md`, `simplification-reviewer.md`, `error-handling-reviewer.md`, `test-coverage-reviewer.md`, `deep-module-reviewer.md` — Phase 1). All share an identical structural template: frontmatter (`name`, `description` ending "Use as a built-in reviewer in /ba:review.", `model: sonnet`, no `tools:`), `<examples>` block with `<commentary>The review command dispatches this agent as one of six parallel built-in reviewers.</commentary>` on line 12, role paragraph, `## What You Review`, `## How to Review`, `## Output Format` (Must Address / Consider / Looks Good), `## Principles`. Sizes: 53–67 lines.
- **`/ba:review` dispatcher** (`commands/ba/review.md`): the built-in reviewer table lives at `:200-211` with the gate sentence at `:200` ("six built-in review agents") and `:211` ("All six built-in reviewers MUST appear..."). The distribution rules at `:248-264` partition reviewers across AskUserQuestion calls (1–4 questions × 2–4 options); the count appears at `:252` ("6 built-ins first") and the scenario table at `:261-264` enumerates Q-splits for `6 built-in, {0, 1, 2-3, 4+} external`.
- **`/ba:review-plan` dispatcher** (`commands/ba/review-plan.md`): the built-in reviewer table at `:38-49` was updated to six in Phase 1 (`:38` "six built-in", `:49` "All six MUST appear"), but the distribution rules at `:99` still say `5 built-ins first` and the scenario table at `:108-111` is keyed by `5 built-in` rows — Phase 1 left this stale. Phase 2 must fix this two-step (5 → 7) for `/ba:review-plan` to be internally coherent post-ship.
- **`README.md`**: line 156 says "six built-in review agents"; line 168 lists "Six built-in reviewers — architecture, security, simplification, error handling, test coverage, and deep-module design"; the agent table at `:191-208` lists 16 agents, with `deep-module-reviewer` at `:207`.
- **`CLAUDE.md`**: agent enumeration at `:42-48` lists the six review agents in chronological order ending with `deep-module-reviewer` at `:47` followed by `tdd-cycle-gate` at `:48`.
- **`.claude-plugin/plugin.json`**: version `0.9.0` at `:3`. Phase 1 bumped 0.8.0 → 0.9.0 in commit `c470a81`.
- **Source skill**: `~/.claude/skills/assess-complexity/SKILL.md` (295 lines). User-installed, outside the skills-repo constraint. Brainstorm explicitly defers any decision to delete or promote — Phase 2 reads it as input, doesn't modify it.

## What We're NOT Doing

(Carried forward from brainstorm `:60-79`, with two additions surfaced during planning.)

- Phases 3–5 of the roadmap.
- Modifying, deleting, or promoting `~/.claude/skills/assess-complexity/SKILL.md`.
- Adding `complexity-reviewer` to `/ba:tdd` Step 3 — review-only for Phase 2.
- Importing or invoking from the skills repo.
- Reproducing the source skill's discovery phase (`SKILL.md:28-40`), heavy 5-section report (`SKILL.md:188-239`), Beck framework (`SKILL.md:71-100`), or non-salvaged Dodds content (`SKILL.md:108-136` outside the two salvages).
- Adding a "Module Depth Assessment" section — `deep-module-reviewer`'s territory (Phase 1).
- Any change to the other six review agents beyond the cosmetic `<commentary>` line-12 flip ("six → seven").
- **Fixing the `README.md:170` "unbiased, unbiased" duplicate-word typo** — out of scope. Defer to a separate one-line commit.
- **Adding a suppression list** for the user's standalone `~/.claude/skills/assess-complexity/SKILL.md` — `/ba:review` will list it as an external option with `(overlaps with complexity-reviewer)` per the existing convention at `commands/ba/review.md:246`. No special-casing.

## Behaviors to Test

(Optional — consumed by `/ba:tdd`. Phase 2 is content-only; "tests" here are content assertions verifiable against the written file.)

- [ ] `/ba:review` lists exactly seven built-in reviewers, with `complexity-reviewer` last.
- [ ] `/ba:review-plan` lists exactly seven built-in reviewers, with `complexity-reviewer` last.
- [ ] When `complexity-reviewer` is selected, the dispatcher fans it out via the same Agent-tool path as the other six (no agent-specific dispatch logic).
- [ ] `complexity-reviewer`'s output uses the canonical `Must Address / Consider / Looks Good` shape with each bullet inline-tagged by lens (`[cognitive load]` / `[change amplification]` / `[obscurity]`).
- [ ] When the user's standalone `~/.claude/skills/assess-complexity/SKILL.md` is present, `/ba:review`'s discovery surfaces it as an external option annotated `(overlaps with complexity-reviewer)`.
- [ ] AskUserQuestion partitioning at the new 7-built-in count never produces a question with >4 options for any external-count band (0, 1, 2–4, 5+).

## Proposed Solution

A focused rewrite (not a verbatim port) of `~/.claude/skills/assess-complexity/SKILL.md` into a new review agent, narrowed from the source's three-framework treatment (Ousterhout + Beck + Dodds) down to Ousterhout's three complexity manifestations as the spine, with two non-overlapping Dodds salvages folded as sub-bullets. The agent adopts the canonical review-agent shape (frontmatter, `<examples>` block, `## What You Review` / `## How to Review` / `## Output Format` / `## Principles`) and is wired into `/ba:review` and `/ba:review-plan` via static table addition + count cosmetic sweep. Single atomic commit.

**Source-skill content mapping** (see brainstorm `:36-49`):

| Target lens | Primary source | Folded salvage |
|---|---|---|
| Cognitive load | `SKILL.md:50-54` (A.1: "How much must a developer know to understand/modify?") | `SKILL.md:104-107` Dodds C.1 — *Simplicity vs Familiarity* |
| Change amplification | `SKILL.md:50-52` (A.1: "Does a simple change require modifications in many places?") | — |
| Obscurity / unknown-unknowns | `SKILL.md:50-60` (A.1 unknown-unknowns + A.2 "vital information hidden or non-obvious") | `SKILL.md:127-131` Dodds C.5 — *Explicit vs Implicit* |

**Explicitly dropped** (`SKILL.md` sections, with the reviewer that owns each topic):

- `## Phase 1: Initial Code Discovery & Context` (`SKILL.md:28-40`) — `/ba:review` already passes diff context.
- `### A.3 Module Depth Assessment` (`:62-65`) → `deep-module-reviewer` (Phase 1).
- `### A.4 Strategic vs Tactical Design` (`:67-70`) → `simplification-reviewer` + `architecture-reviewer`.
- `### B Beck "Tidy First?"` (`:71-100`) — coupling → `architecture-reviewer`; tidying / dead code → `simplification-reviewer`; **cohesion (B.2) is only partially covered** — `architecture-reviewer`'s "Separation of concerns" asks the inverse question (are responsibilities separated?), not the cohesion question (are functionally related responsibilities grouped?). Acknowledged gap, parallel to the comment-quality acknowledgement below; comments-as-code framing currently unowned, deferred per parent roadmap line 125.
- `### C Dodds Epic Web` outside the two salvages (`:108-136`) — covered by `architecture-reviewer`, `error-handling-reviewer`, `test-coverage-reviewer`.
- `### D Comment Quality` (`:138-186`) — deferred to a possible future `comment-reviewer` per parent roadmap.
- `### Phase 3 Complexity Report` (`:188-239`) — replaced by canonical Must Address / Consider / Looks Good.

**Collision avoidance.** The obscurity lens narrows to **structural** obscurity (implicit ordering constraints, hidden state, behavior inferred from cross-file context, undocumented invariants). **Lexical** obscurity (bad names, unclear comments) is explicitly deferred to `architecture-reviewer` and the future `comment-reviewer`. This keeps `/ba:review`'s consolidation-step conflict detection at `commands/ba/review.md:370` from spuriously flagging same file:line findings as `⚠ Conflicting` when complexity-reviewer and architecture-reviewer would otherwise both fire on the same naming issue.

**Cross-file analysis instruction.** Change amplification frequently manifests in files **not in the diff** — a fragmented concern only reveals its amplification when you read the upstream callers or downstream consumers. `## How to Review` includes an explicit step instructing the agent to read files referenced via imports / call sites, even outside the diff, when assessing amplification. This is Phase-2-specific guidance; it does not leak into the other reviewers.

## Technical Considerations

- **Architecture impacts**: zero new dispatch logic. The new agent flows through `/ba:review` Step 3 (`commands/ba/review.md:278-337`) and Step 4 consolidation (`:341-376`) unchanged. Only static content (table rows, count words, distribution-table arithmetic) changes.
- **Performance implications**: one additional parallel sub-agent dispatch when the user selects all built-ins. Latency is bounded by the slowest reviewer; the seventh runs in the same fan-out.
- **Security considerations**: none. New review agent reads diff + files; no network, no external calls.
- **Discoverability of the source skill.** `commands/ba/review.md:229` keyword filter includes `assess` and `complexity`. The user's `~/.claude/skills/assess-complexity/SKILL.md` will be discovered by Glob and surfaced in `/ba:review`'s external-reviewer list with `(overlaps with complexity-reviewer)` per the existing pattern at `:246`. **No suppression added.** This honors the brainstorm decision at `:57` to keep the standalone skill as backup and the convention at `CLAUDE.md:73-74` ("external reviewers are shown alongside them with overlap notes, never hidden or replaced").

## System-Wide Impact

- **Interaction graph**: `/ba:review` Step 2c presents the new reviewer in `AskUserQuestion`; if selected, Step 3 dispatches it via the Agent tool in parallel with other selections; Step 4 consolidates its findings under `### Complexity Reviewer (built-in)`. Same path for `/ba:review-plan`. No callbacks, no middleware, no observers.
- **Error propagation**: agent failures surface in Step 4's per-reviewer section like any other reviewer. No new error path.
- **State lifecycle risks**: none. The agent is stateless within a dispatch.
- **AskUserQuestion partition arithmetic.** Going from six built-ins to seven changes the Q-split shape:

  | Externals | Total | Split (Q1=4, Q2=≤4, Q3=≤4, Q4=≤4) |
  |---|---|---|
  | 0 | 7 | Q1=4, Q2=3 |
  | 1 | 8 | Q1=4, Q2=4 |
  | 2 | 9 | Q1=4, Q2=3, Q3=2 |
  | 3 | 10 | Q1=4, Q2=3, Q3=3 |
  | 4 | 11 | Q1=4, Q2=3, Q3=4 |
  | 5 | 12 | Q1=4, Q2=4, Q3=4 |
  | 6 | 13 | Q1=4, Q2=4, Q3=3, Q4=2 *(no orphan)* |
  | 7 | 14 | Q1=4, Q2=4, Q3=3, Q4=3 |
  | 8 | 15 | Q1=4, Q2=4, Q3=4, Q4=3 |
  | 9 | 16 | Q1=4, Q2=4, Q3=4, Q4=4 |
  | 10+ | 17+ | Truncate to 16; remainder in follow-up text per `:255` |

  The 4-row scenario table maps to bands `7+0`, `7+1`, `7+2-4`, `7+5+`. **Banding rule:** rows collapse all totals that share a Q-shape — 7+0 yields 2 questions; 7+1 yields 2; 7+{2,3,4} all yield 3; 7+5+ yields 4. (Same shape, same banding, applied to `/ba:review-plan.md:108-111`.)

## Implementation Approach

Commit-execution order: agent body first (foundation), `/ba:review` table + arithmetic next (primary wiring), then `/ba:review-plan` (secondary wiring, includes Phase-1-debt 5→7 fix), then cosmetic line-12 sweep across the six existing reviewers, then user-facing docs (`README.md`, `CLAUDE.md`), then version bump. Single atomic commit.

### Changes Required

#### File 1: `agents/review/complexity-reviewer.md` (new file, ~65 lines)

```markdown
---
name: complexity-reviewer
description: "Reviews code changes for Ousterhout's three complexity manifestations: cognitive load, change amplification, and obscurity / unknown-unknowns. Use as a built-in reviewer in /ba:review."
model: sonnet
---

<examples>
<example>
Context: The review command dispatches this agent to check complexity manifestations of code changes.
user: "Review these code changes for complexity: [diff that touches three files for one conceptual change]"
assistant: "I'll analyze the changes for cognitive load, change amplification, and obscurity / unknown-unknowns."
<commentary>The review command dispatches this agent as one of seven parallel built-in reviewers.</commentary>
</example>
</examples>

You are a code complexity reviewer guided by John Ousterhout's "A Philosophy of Software Design". Your job is to review code changes (provided as a git diff) for the three manifestations of complexity: cognitive load, change amplification, and obscurity / unknown-unknowns.

**You suggest. You do not apply.** The review command consolidates your findings alongside other reviewers' for the user to act on.

## What You Review

Three lenses, taken from Ousterhout's complexity framework:

- **Cognitive load** — how much a developer must hold in their head to understand or modify the code. Flag deeply nested conditionals, parameter explosions, multi-purpose functions, and abstractions that obscure rather than clarify.
  - *Simplicity vs familiarity*: a pattern that feels easy because it is well-known is not necessarily simple. Flag where familiarity is being mistaken for genuine simplicity. Conversely, flag where an unfamiliar pattern is being avoided even though it would be simpler than the familiar workaround the diff chose.
- **Change amplification** — a simple conceptual change requires modifications in many places. Flag fragmented concerns split across modules, parallel hierarchies that must be kept in sync, and behavior whose conceptual locus is spread thin. Change amplification often manifests across files **not in the diff** — when a change touches a fragmented concern, read the upstream callers and downstream consumers referenced via imports or call sites to see whether the same conceptual change forces parallel modifications elsewhere.
- **Obscurity / unknown-unknowns** — vital information is hidden or non-obvious; readers can't tell what they need to know to make a change safely. Focus on **structural** obscurity: implicit ordering constraints, hidden state machines, behavior that must be inferred from cross-file context, control-flow that depends on undocumented invariants.
  - *Explicit vs implicit*: flag where behavior is hidden behind magic (decorators, metaprogramming, framework lifecycle hooks, side-effect-on-import patterns) when an explicit form would communicate intent.

## How to Review

1. Read the diff to understand what changed.
2. Read the full content of each changed file for context — never review based on diff alone.
3. For change amplification: trace imports and call sites referenced by the diff. Read upstream/downstream files even when they are not in the diff to detect parallel modifications a fragmented concern is forcing elsewhere. One hop is sufficient unless a finding at the first hop suggests further spread.
4. For each changed function or module, ask: how much must a reader hold in their head to understand or modify this? (cognitive load)
5. Identify what a reader cannot see from the code alone: implicit invariants, hidden state, ordering constraints, side-effect-on-import patterns (obscurity).
6. Compare against the existing codebase — some complexity is essential to the problem domain. Focus on accidental complexity.

## Output Format

Return findings using EXACTLY this structure:

## Must Address
- **[file_path:line_number]** — [cognitive load | change amplification | obscurity] [Issue description]. [Why this matters for complexity]. Suggested fix: [specific, actionable suggestion]

## Consider
- **[file_path:line_number]** — [cognitive load | change amplification | obscurity] [Issue description]. [Why this could reduce complexity].

## Looks Good
- [Aspect of complexity that is well-handled — a deep abstraction that genuinely reduces cognitive load, a well-localized concern that resists amplification, an explicit form chosen over a magic alternative]

If no issues found for a severity level, write "None" under that heading.

## Principles

- **Some complexity is essential.** Focus on accidental complexity, not problem-domain difficulty.
- **Tag the lens.** Every `Must Address` and `Consider` bullet must open with one of `[cognitive load]` / `[change amplification]` / `[obscurity]` so the consolidation step can group findings cleanly. Without it, complexity findings blur into the other reviewers' territory.
- **Defer overlapping concerns.** Module-depth findings → `deep-module-reviewer`. Naming, coupling, and lexical obscurity (bad names, unclear comments) → `architecture-reviewer` and the deferred comment-quality reviewer. Dead code and YAGNI → `simplification-reviewer`. Error handling → `error-handling-reviewer`.
- **Be specific.** Reference exact file paths and line numbers. Explain WHY the finding lands under this lens, not just THAT it is complex.
- **Acknowledge clean code.** When the diff actively reduces complexity (e.g., consolidates a fragmented concern, makes implicit behavior explicit), say so under `Looks Good`. Do not manufacture findings.
```

#### File 2: `commands/ba/review.md` — table addition + count flips + scenario rebuild

**Change at `:200`** — flip `six` → `seven`:

```markdown
List the seven built-in review agents from `agents/review/`:
```

**Change at `:209`** — insert new row after `deep-module-reviewer`:

```markdown
| `deep-module-reviewer` | Ousterhout deep-module design: small interface / deep implementation, dependency injection, return-over-side-effects, duplication, shallow-layer merging |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |
```

**Change at `:211`** — flip `six` → `seven`:

```markdown
**All seven built-in reviewers MUST appear as options in Step 2c. Do not filter or omit any.**
```

**Change at `:252`** — flip `6` → `7`:

```markdown
1. Collect all reviewers into an ordered list: 7 built-ins first, then discovered externals.
```

**Change at `:261-264`** — rebuild scenario table for 7-built-in arithmetic. The 4-row banding maps `7+0`, `7+1`, `7+2-4`, `7+5+`. Replace the existing four rows verbatim with:

```markdown
| 7 built-in, 0 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") |
| 7 built-in, 1 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") |
| 7 built-in, 2-4 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") · Q3: 2-4 externals (header "External") |
| 7 built-in, 5+ external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") · Q3-Q4: remaining externals partitioned to never leave 1 alone (header "External") |
```

#### File 3: `commands/ba/review-plan.md` — table addition + count flips (5→7) + scenario rebuild

**Change at `:38`** — flip `six` → `seven`:

```markdown
Always include these seven built-in reviewers — they live in `agents/review/` and are always available:
```

**Change at `:48`** — insert new row after `deep-module-reviewer`:

```markdown
| `deep-module-reviewer` | Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |
```

**Change at `:49`** — flip `six` → `seven`:

```markdown
**All seven MUST appear as options in Step 2. Do not filter or omit any.**
```

**Change at `:99`** — flip `5 built-ins` → `7 built-ins` *(this is a 5→7 flip, not 6→7; Phase 1 left this stale — see Convention Compliance for justification)*:

```markdown
1. Collect all reviewers into an ordered list: 7 built-ins first, then discovered externals (with overlap notes if applicable).
```

**Change at `:108-111`** — rebuild scenario table to match `commands/ba/review.md:261-264`'s 4-row banding:

```markdown
| 7 built-in, 0 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") |
| 7 built-in, 1 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") |
| 7 built-in, 2-4 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") · Q3: 2-4 externals (header "External") |
| 7 built-in, 5+ external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") · Q3-Q4: remaining externals partitioned to never leave 1 alone (header "External") |
```

#### File 4: `<commentary>` line-12 flip across all six existing reviewers

For each of the six files below, change line 12 from:

```markdown
<commentary>The review command dispatches this agent as one of six parallel built-in reviewers.</commentary>
```

to:

```markdown
<commentary>The review command dispatches this agent as one of seven parallel built-in reviewers.</commentary>
```

Files: `agents/review/architecture-reviewer.md`, `agents/review/security-reviewer.md`, `agents/review/simplification-reviewer.md`, `agents/review/error-handling-reviewer.md`, `agents/review/test-coverage-reviewer.md`, `agents/review/deep-module-reviewer.md`.

#### File 5: `README.md` — three hunks

**Change at `:156`** — flip `six` → `seven`:

```markdown
Runs post-implementation code review using seven built-in review agents plus any additional reviewers discovered in the environment.
```

**Change at `:168`** — flip `Six` → `Seven` and append `complexity` to the enumeration:

```markdown
- **Seven built-in reviewers** — architecture, security, simplification, error handling, test coverage, deep-module design, and complexity; always available out of the box
```

**Change at `:207`** — insert new agent table row after `deep-module-reviewer`:

```markdown
| `deep-module-reviewer` | Reviews code changes for Ousterhout deep-module design principles: interface depth, dependency injection, side-effect discipline (built-in reviewer) |
| `complexity-reviewer` | Reviews code changes for Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns (built-in reviewer) |
```

#### File 6: `CLAUDE.md` — agent enumeration insert

**Change at `:47`** — insert new bullet after `deep-module-reviewer`:

```markdown
- `deep-module-reviewer` — Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline (built-in reviewer)
- `complexity-reviewer` — Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns (built-in reviewer)
```

#### File 7: `.claude-plugin/plugin.json` — version bump

**Change at `:3`**:

```json
  "version": "0.10.0",
```

#### Commit message

```
feat: add complexity-reviewer (port assess-complexity)

Add a seventh built-in review agent at agents/review/complexity-reviewer.md
organized around Ousterhout's three complexity manifestations
(cognitive load, change amplification, obscurity / unknown-unknowns)
with two non-overlapping Dodds salvages folded as sub-bullets
(simplicity vs familiarity, explicit vs implicit). Wire it into
/ba:review and /ba:review-plan as a permanent built-in alongside the
six from Phase 1; rebuild the AskUserQuestion partition tables for
the new 7-built-in count; sweep "six" → "seven" across all six
existing reviewers' <commentary> lines and the README/CLAUDE.md count
references. Fix Phase-1 stale "5 built-ins" debt at
commands/ba/review-plan.md:99 and :108-111 in the same diff to keep
/ba:review-plan internally coherent.

Source skill ~/.claude/skills/assess-complexity/SKILL.md is unchanged
and stays as backup per the brainstorm's deferred decision.

Plan:       docs/plans/2026-05-03-feat-port-complexity-reviewer-plan.md
Brainstorm: docs/brainstorms/2026-05-03-phase2-port-complexity-reviewer-brainstorm.md
Roadmap:    docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md

Version bump 0.9.0 → 0.10.0.
```

### Success Criteria

#### Automated:

- [x] `test -f agents/review/complexity-reviewer.md` — file exists.
- [x] `head -5 agents/review/complexity-reviewer.md | grep -E '^(name|description|model):'` — frontmatter has `name`, `description`, `model`. **No `tools:` line in the first 10 lines.**
- [x] `grep -c '^## ' agents/review/complexity-reviewer.md` — exactly four `##` sections (`What You Review`, `How to Review`, `Output Format`, `Principles`); plus the three `Must Address` / `Consider` / `Looks Good` `##` headings inside `Output Format` (so total = 7). The agent body contains no section named `Discovery`, `Phase 1`, `Phase 2`, `Executive Summary`, `Detailed Findings`, `Prioritized Recommendations`, `Tidying Sequence`, `Long-term Architecture Notes`, `Module Depth`, `Strategic vs Tactical`, `Coupling`, `Cohesion`, or `Composition over Inheritance` — verified by `grep -Ei` returning empty.
- [x] `grep -c 'Use as a built-in reviewer in /ba:review.' agents/review/complexity-reviewer.md` returns `1`.
- [x] `grep 'one of seven parallel built-in reviewers' agents/review/*.md | wc -l` returns `7` (one per agent, including the new file).
- [x] `grep -c 'one of six parallel built-in reviewers' agents/review/*.md` returns `0`.
- [x] `grep -n 'seven built-in' commands/ba/review.md` matches lines `:200` and `:211`.
- [x] `grep -n 'seven' commands/ba/review-plan.md` matches at `:38` and `:49`.
- [x] `grep -n '7 built-ins' commands/ba/review.md commands/ba/review-plan.md` matches at `commands/ba/review.md:252` and `commands/ba/review-plan.md:99`. **No `5 built-ins` or `6 built-ins` remains in either file.**
- [x] `grep -nE '^\| [0-9] built-in,' commands/ba/review.md commands/ba/review-plan.md | grep -v '^.*:.*7 built-in'` returns empty (every scenario-table row keys on `7 built-in`).
- [x] `grep '"version"' .claude-plugin/plugin.json` returns `"version": "0.10.0",`.
- [x] `grep -c 'complexity-reviewer' README.md` returns at least `1` — NOTE: plan's parenthetical "(line 168 enumeration + line 208)" is a description error; line 168 uses "complexity" (not "complexity-reviewer") consistent with "deep-module design" style. Implementation spec is authoritative; 1 match is correct.
- [x] `grep -c 'complexity-reviewer' CLAUDE.md` returns at least `1` (agent-enumeration bullet).
- [x] `grep -c 'six built-in\|Six built-in' README.md` returns `0`.
- [x] `git diff --stat` for the commit shows ~10 files changed (1 new agent, 6 existing reviewers, `commands/ba/review.md`, `commands/ba/review-plan.md`, `README.md`, `CLAUDE.md`, `.claude-plugin/plugin.json` = 12 files). Actual: 13 files (includes two brainstorm docs that were pre-staged).
- [x] `git log --oneline -1` shows a single `feat: add complexity-reviewer (port assess-complexity)` commit (atomic delivery).
- [x] `~/.claude/skills/assess-complexity/SKILL.md` is **not** modified — confirmed by `git status` showing only files inside the `dev-workflow` directory.

#### Manual:

- [ ] Read the new `complexity-reviewer.md` end-to-end. Confirm: three top-level lenses; cognitive-load lens body includes a "Simplicity vs Familiarity" sub-bullet covering both directions (familiarity-as-simplicity AND avoidance-of-unfamiliar-but-simpler); obscurity lens body includes an "Explicit vs Implicit / hidden behind magic" sub-bullet; `## How to Review` step #3 instructs reading files outside the diff for change-amplification analysis with a one-hop default; `## Output Format` bullet template shows inline lens tagging (`[cognitive load]` / `[change amplification]` / `[obscurity]`); `## Principles` explicitly defers overlapping concerns to the relevant sibling reviewers.
- [ ] Run `/ba:review` against a small test diff (e.g., the Phase 2 commit itself). Confirm: the seventh option appears in the AskUserQuestion partition; selecting "complexity-reviewer" dispatches it; output appears in Step 4 consolidation under `### Complexity Reviewer (built-in)`.
- [ ] Confirm the user's standalone `~/.claude/skills/assess-complexity/SKILL.md` appears in `/ba:review` Step 2b's external-reviewer list with `(overlaps with complexity-reviewer)` annotation.
- [ ] Run `/ba:review-plan` against a small test plan. Confirm: the partition table renders correctly for "7 built-in, 0 external" and "7 built-in, 1 external" cases (no orphan options, no question with >4 options).
- [ ] `README.md`'s "Six built-in" → "Seven built-in" update keeps the chronological enumeration order (no alphabetical re-sort of the bullet at `:168`).

## Dependencies & Risks

- **Phase 1's stale `commands/ba/review-plan.md:99` and `:108-111` debt.** Fixing this two-step (5 → 7) is bundled into the Phase 2 commit (justified override — see Convention Compliance). Risk: implementer mistakes the flip for a 6 → 7 mechanical edit and leaves the file inconsistent. **Mitigation:** the Implementation Approach section spells out the exact replacement strings and the automated success criteria assert no `5 built-ins` or `6 built-ins` substring remains.
- **Distribution-table arithmetic.** Naïve "Q1=4, Q2=Test+Coverage+externals" partitioning at 7+3 yields Q2=5, violating the AskUserQuestion 2-4-options-per-question constraint at `commands/ba/review.md:248`. **Mitigation:** the System-Wide Impact section enumerates each band's exact split, and the Implementation Approach section spells out the verbatim row content for both `commands/ba/review.md:261-264` and `commands/ba/review-plan.md:108-111`.
- **Conflict-detection collisions** (`commands/ba/review.md:370`). Three reviewers (complexity, deep-module, architecture) could fire on the same file:line. **Mitigation:** the new agent's `## Principles` section explicitly defers naming/coupling, module-depth, dead-code, and comment-quality. Plan does not modify `:370`.
- **Source-skill self-discovery.** `~/.claude/skills/assess-complexity/SKILL.md` will appear in `/ba:review`'s external-reviewer list. **Mitigation:** rely on the existing `(overlaps with [built-in name])` annotation at `:246`. No suppression. The brainstorm at `:57` keeps the standalone as backup; promoting or deleting it is deferred.
- **Source-skill content drift.** If the user updates `~/.claude/skills/assess-complexity/SKILL.md` post-Phase-2, the new agent and the source diverge. **Acceptance**: this is the brainstorm's deferred decision (`:57`); revisit after the ported agent has been used in `/ba:review` enough times to validate the narrowing.
- **Knowledge-compounding gap.** `docs/solutions/` does not exist (verified by `learnings-researcher`); Phase 1 shipped without a `/ba:compound` capture. **Suggested follow-up (not in this MR):** after Phase 2 ships, run `/ba:compound` to document (a) the SKILL.md → review-agent port recipe, (b) the dispatcher count-update checklist, and (c) the AskUserQuestion partition arithmetic so Phase 3+ has the precedent both Phases 1 and 2 lacked.
- **Long-term: built-in count is replicated across ~16 synchronized encodings.** The count-of-built-ins lives in (a) two dispatcher count words, (b) two dispatcher gate sentences, (c) two dispatcher distribution-rule numerals, (d) two dispatcher scenario-table cardinalities, (e) one README count word, (f) one README enumeration bullet, (g) one CLAUDE.md enumeration, (h) one `<commentary>` string per agent file (now seven). Phase 1 already left two stale (the `commands/ba/review-plan.md:99` and `:108-111` 5→6 misses this plan now fixes 5→7). The plan's automated success criteria at the `grep -c 'one of six'` and `grep -nE '^\| [0-9] built-in,'` checks make the amplification *detectable*; they do not make it *go away*. **Suggested follow-up (not in this MR):** before Phase 8 ships an 8th reviewer, consolidate the count into a single source of truth — e.g., a generated table the dispatchers `cat`-include, or promote the existing greps to a pre-commit invariant. The new agent's change-amplification lens is meant to flag exactly this kind of cross-file count replication.
- **Coupling: `## Principles` names sibling reviewers by identifier.** The "Defer overlapping concerns" principle hard-codes `deep-module-reviewer`, `architecture-reviewer`, `simplification-reviewer`, `error-handling-reviewer` by name. If any of these reviewers are renamed in a future phase, this principle silently rots — the agent won't error, but the deferral instruction points nowhere. **Mitigation:** any reviewer-rename PR must also touch `agents/review/complexity-reviewer.md`'s `## Principles` block. Acceptable maintenance cost given the precision the named-agent form gives the dispatcher.

## Sources & References

### Origin

- **Brainstorm**: `docs/brainstorms/2026-05-03-phase2-port-complexity-reviewer-brainstorm.md` — every key decision in this plan traces back to a brainstorm decision: three-lens spine (`:36-44`), Dodds salvages folded as sub-bullets (`:42-44`), source content explicitly dropped (`:45-49`), no discovery phase (`:50`), canonical Must Address / Consider / Looks Good output (`:51`), `/ba:review` only (`:54`), single bundled MR (`:25`), version bump 0.9.0 → 0.10.0 (`:58`).
- **Roadmap parent**: `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` — Phase 2 scope (`:60-73`), Discipline Rules (`:130-160`).

### Internal references

- Phase 1 commit (precedent for shape and atomicity): `c470a81 refactor: decouple refactor-advisor into deep-module-reviewer`.
- Existing reviewer canon: `agents/review/deep-module-reviewer.md:1-67` (most recent, includes the optional multi-line-bullet clause); `architecture-reviewer.md:1-53` (canonical short shape).
- `/ba:review` dispatcher: `commands/ba/review.md:200-211` (table), `:248-264` (distribution rules), `:278-337` (Step 3 dispatch), `:341-376` (Step 4 consolidation), `:370` (conflict detection).
- `/ba:review-plan` dispatcher: `commands/ba/review-plan.md:38-49` (table), `:99-111` (distribution rules + scenario table — Phase-1-stale).
- Source skill: `~/.claude/skills/assess-complexity/SKILL.md:50-60` (Ousterhout manifestations), `:104-107` (Dodds C.1 simplicity vs familiarity), `:127-131` (Dodds C.5 explicit vs implicit).

### External references

- John Ousterhout, *A Philosophy of Software Design* — complexity manifestations (cognitive load, change amplification, unknown-unknowns); deferred module-depth content.
- Kent C. Dodds, *Epic Web* principles — only the two non-overlapping salvages are folded.

## Convention Compliance

Validated by `convention-checker` on 2026-05-03 against `CLAUDE.md`, `commands/ba/plan.md`, and the parent roadmap's Discipline Rules (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md:130-160`).

- [x] **Filename format** `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` — aligned (`2026-05-03-feat-port-complexity-reviewer-plan.md`).
- [x] **Plan YAML frontmatter** — aligned (`title`, `type`, `status`, `date`, `origin`, `detail_level`, `tags`).
- [x] **Detail level STANDARD** — aligned with brainstorm `triage_level: standard` and the ~10-file footprint.
- [x] **Type prefix `feat`** — justified: Phase 2 adds a brand-new agent file and a new selectable reviewer. Source skill stays. From the user's perspective this IS a new capability. (Phase 1 used `refactor:` because it relocated and dropped functionality — different shape.)
- [x] **Agent naming** (`complexity-reviewer` — lowercase-with-hyphens, `-reviewer` suffix) — aligned (`CLAUDE.md:62`).
- [x] **Agent placement** (`agents/review/`) — aligned.
- [x] **Agent frontmatter shape** (`name`, `description` ending "Use as a built-in reviewer in /ba:review.", `model: sonnet`, no `tools:`) — aligned with the canon used by all six existing reviewers.
- [x] **All built-in reviewers always appear as options** (`CLAUDE.md:73-74`) — aligned: static table addition makes `complexity-reviewer` a permanent built-in in both `/ba:review` and `/ba:review-plan`.
- [x] **README.md / CLAUDE.md / `plugin.json` updates** (`CLAUDE.md:64`, `:71`) — aligned.
- [x] **No code in planning-only commands** (`CLAUDE.md:65`) — N/A; this is a plan, plans require exact code per `commands/ba/plan.md` Step 4.
- [x] **No monotonic LoC growth** — aligned: footprint matches Phase 1 (one new agent + table row + count cosmetics + metadata bump).
- [x] **No abstract vocabulary creep** — aligned: lens names taken verbatim from Ousterhout (cognitive load, change amplification, obscurity / unknown-unknowns).
- [x] **No >2-layer threading** — aligned: zero new dispatch logic; the new agent flows through existing Step 3 / Step 4 paths unchanged.
- [x] **No verifier-finding-triggers-machinery** — aligned: this phase actively *drops* the source skill's discovery phase, 5-section report, Beck framework, and non-salvaged Dodds content with explicit "covered by X reviewer" rationale.
- [x] **Every plan iteration must either delete a section or produce a commit** (parent roadmap `:158`) — aligned: single atomic commit produced.
- [x] **Brainstorm Open Questions empty before plan handoff** — aligned (brainstorm `:93-95` lists none; three resolved questions captured at `:97-101`).
- [x] **Discipline-section reference** (parent roadmap `:132`) — aligned: brainstorm references it explicitly in the front-matter callout above its Discipline section.
- [⚠] **Phase-1 stale `commands/ba/review-plan.md:99` and `:108-111` debt** — JUSTIFIED OVERRIDE. `convention-checker` flagged bundling the 5→7 fix into Phase 2 as scope creep. Override rationale: shipping Phase 2 with `/ba:review-plan` showing a 7-row table while the distribution rules still reference 5 (or 6) built-ins is internally incoherent — strictly worse than Phase 1's 5/6 inconsistency. Splitting into a separate pre-MR was offered and declined for ceremony reasons. The Phase-2 commit message names the debt fix explicitly so the change archaeology stays honest.
- [x] **README.md `:170` "unbiased, unbiased" typo** — DEFERRED. Convention-checker correctly flagged including this as scope creep. Out-of-scope for Phase 2; address in a separate one-line commit.
- [x] **Acceptance criteria measurability** — aligned: every Automated success criterion is a runnable `grep` / `test` / `git` command; every Manual criterion is a single human-verifiable assertion.
