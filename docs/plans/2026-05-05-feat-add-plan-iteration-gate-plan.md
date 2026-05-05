---
title: Add plan-iteration-gate
type: feat
status: completed
date: 2026-05-05
origin: docs/brainstorms/2026-05-04-plan-iteration-gate-brainstorm.md
detail_level: standard
iteration_count: 1
tags: [ousterhout, plan-iteration-gate, ba-review-plan, planning-discipline, phase-3]
---

# Add plan-iteration-gate Implementation Plan

## Overview

Phase 3 of the Ousterhout-principles roadmap. Add `agents/workflow/plan-iteration-gate.md` — a silent-when-clean, vocal-on-violation discipline gate dispatched by `/ba:review-plan` after the Apply Fixes step. The gate watches for the planning-YAGNI / confidence-chasing ratchet documented in the 2026-04-23 retro: monotonic LoC growth, threading depth, soft line cap, abstract vocabulary creep, repeat-concern, and verifier-finding-triggers-machinery. Iteration count is persisted as a frontmatter field; a vocal warning fires at iteration ≥ 3 quoting the standing "default to ship or delete after round 4" rule.

The brainstorm (`docs/brainstorms/2026-05-04-plan-iteration-gate-brainstorm.md`) is the authority on what to build and why. This plan resolves the four implementation-detail decisions the brainstorm deferred (lines 122): persistence mechanism, agent prompt body, version-bump number, and exact edit shape in `commands/ba/review-plan.md`.

## Current State

- `agents/workflow/` contains exactly three files: `convention-checker.md`, `spec-flow-analyzer.md`, `tdd-cycle-gate.md`. The gate goes here as the fourth.
- `agents/workflow/tdd-cycle-gate.md:1-89` is the canonical silent-vocal gate pattern — frontmatter shape, `<examples>` block, validation checklist, output contract, important-rules section. The new gate mirrors this structure.
- `commands/ba/review-plan.md:174-200` is the existing Step 5 (Apply Fixes); line 200 is the "Plan updated at `[path]`" confirmation; line 204 begins `## Important Guidelines`. The new dispatch lands as **Step 5.5** between line 200 and line 204.
- `commands/ba/tdd.md:212-239` is the dispatch precedent — `Task tdd-cycle-gate("...")` with multi-line prompt, silent-handling branch (no announcement), vocal-handling branch (present to user). Plan-iteration-gate uses the same shape but the vocal branch is **report-only — no AskUserQuestion loop, no apply-fix flow** (the gate is read-only by design and `/ba:review-plan`'s next-steps menu already exists).
- `commands/ba/plan.md:185-194` defines the shared YAML frontmatter block used by all three plan detail levels. Adding `iteration_count: 0` here threads the field through every new plan.
- Plan-frontmatter mutation is well-established — eight existing call sites in `execute.md`, `tdd.md`, and `slice.md` mutate `status`, `sliced`, and `slice_count` via targeted Edit-tool calls. Adding `iteration_count` is non-colliding.
- No state directory (`.dev-workflow/`, `state/`, `cache/`) exists in the repo; no JSON state files are referenced anywhere. Frontmatter is the only existing persistence surface.
- Current `.claude-plugin/plugin.json:3` is `"version": "0.10.0"`. Recent cadence (per `git log`) is minor bumps (`0.x.0`) for feature additions; this plan ships as `0.11.0`.
- `.claude-plugin/marketplace.json` carries its own static `version: 0.1.0` that has not tracked plugin.json — leave it untouched.

## What We're NOT Doing

- **No multi-dispatch.** Gate dispatches only from `/ba:review-plan` Step 5.5. Other iteration surfaces (`/ba:plan` review-and-refine loop, `/ba:brainstorm` refine path) remain governed by the standing Discipline Rules.
- **No hard stop, no refusal mode, no escalation.** The vocal warning at iteration ≥ 3 is advisory and identical at every count beyond 3.
- **No state directory and no JSON state files.** All persistence is via the existing frontmatter surface.
- **No CRUD on the plan from the gate.** Gate is read-only; `tools: Read, Grep, Glob, LS` enforces this. Iteration-count incrementing is done by the dispatching command, not the gate.
- **No persistence of prior round's findings.** Gate input #4 ("review findings") is the *current invocation's* findings from Step 4, not a cross-session history. Trigger 6 (verifier-finding-triggers-machinery) is rescoped to "did this round's findings cause this round's apply-fixes step to expand machinery instead of contracting it?"

## Behaviors to Test *(consumed by `/ba:tdd` if executed via TDD)*

- [x] Gate file exists at `agents/workflow/plan-iteration-gate.md` with frontmatter `name: plan-iteration-gate`, `model: inherit`, `tools: Read, Grep, Glob, LS`.
- [x] Gate's silent-clean output is exactly the literal string `No discipline violations detected.` (one line, no trailing whitespace).
- [x] Gate's vocal output, when at least one trigger fires, contains a markdown section per violation with `**Trigger**`, `**Evidence**`, `**Why this matters**`, `**Suggestion**` fields.
- [x] When passed `iteration_count: 3` (or any integer ≥ 3), the gate's vocal output ends with the line `Discipline rule reminder: round 3 — default to ship or delete after round 4` (round number reflects the value passed in).
- [x] `commands/ba/review-plan.md` Step 5.5 dispatches `plan-iteration-gate` after the Step 5 Apply Fixes confirmation, passing the four documented inputs.
- [x] `commands/ba/review-plan.md` Step 5.5 increments `iteration_count` in the plan's frontmatter via a targeted Edit-tool call before the gate dispatches.
- [x] `commands/ba/plan.md` shared YAML frontmatter block lists `iteration_count: 0` so newly-written plans carry the field at value 0.
- [x] `README.md` agent table includes a `plan-iteration-gate` row.
- [x] Root `CLAUDE.md` agents list includes `plan-iteration-gate` with one-line description and tool restriction in parentheses, matching the `tdd-cycle-gate` row format.
- [x] `.claude-plugin/plugin.json` version is `0.11.0`.

## Proposed Solution

Five-file diff, single atomic MR:

1. **NEW** `agents/workflow/plan-iteration-gate.md` — silent-vocal gate definition, six trigger categories, output contract identical in shape to `tdd-cycle-gate`. (See "Implementation Approach → File 1" for full content.)
2. **EDIT** `commands/ba/review-plan.md` — add **Step 5.5** between current Step 5 (line 200) and `## Important Guidelines` (line 204). Step 5.5 increments `iteration_count` in the plan's frontmatter, then dispatches the gate with the four documented inputs.
3. **EDIT** `commands/ba/plan.md` — add `iteration_count: 0` to the shared YAML frontmatter block (line 185-194) so all newly-written plans carry the field. This also keeps `iteration_count` from being silently dropped if a user re-runs `/ba:plan` against an existing plan path.
4. **EDIT** `README.md` and `CLAUDE.md` (root) — add `plan-iteration-gate` to the agent table / agent list.
5. **EDIT** `.claude-plugin/plugin.json` — bump `0.10.0` → `0.11.0`.

### Persistence design

The two values to persist across `/ba:review-plan` invocations are conceptually different:

- **Iteration count** — small monotonic integer. Persisted as `iteration_count: N` in the plan's YAML frontmatter. Defaults to `0` (set by `/ba:plan` template). Incremented by `/ba:review-plan` Step 5.5a *before* dispatching the gate; the gate therefore receives the count of the iteration it is evaluating. Frontmatter is the right surface because plan-frontmatter mutation is already an established pattern (`status`, `sliced`, `slice_count`); adding one integer field reuses that surface with no new infrastructure.
- **Plan content snapshot** — the full plan body captured at the start of the invocation, before any fix is written. Passed to the gate as input #1; the post-fix content is input #2. Lives in-memory only; no cross-session persistence.

### Plan-LoC counting rule

> **Plan body LoC** = total lines in the plan file, excluding the YAML frontmatter span (the lines from the opening `---` through the closing `---` inclusive). Blank lines are counted. Code fences and their contents are counted. The `## Slices` table inserted by `/ba:slice` is counted (no special-casing).

### Step 5.5 dispatch shape

`/ba:review-plan` Step 5.5 runs unconditionally — even when the user picks "Done" in Step 5 and no fixes were applied. Every `/ba:review-plan` invocation is one round. The dispatching command:

1. Increments `iteration_count` in the plan frontmatter via a targeted Edit-tool call (read current value → add 1 → write back). Default to 0 if the field is absent or malformed.
2. Computes the plan-body LoC for the start-of-session snapshot (already in memory) and the current plan content (Read the plan file post-fix).
3. Dispatches the gate via `Task plan-iteration-gate("...")` with four labeled inputs: snapshot content, current content, iteration count, this round's review findings (Must Address / Consider / Looks Good).
4. On gate success — silent or vocal — display the gate's output verbatim under a `## Plan-iteration discipline check` heading, then conclude Step 5.5.
5. On gate error or timeout — display a one-line non-blocking note `Plan-iteration gate failed (non-blocking): [error]` and exit. Iteration count is *not* rolled back (the round happened).

Acceptance: the gate dispatch never blocks `/ba:review-plan`, never requires user input, and never proposes specific edits.

## Technical Considerations

- **Backward compatibility with existing plans.** Plans written before this change have no `iteration_count` field. Step 5.5's increment logic treats absent/malformed values as 0, then writes `iteration_count: 1`. No migration needed.
- **Concurrency.** Two `/ba:review-plan` invocations against the same plan in parallel is a last-write-wins race on the `iteration_count` field. Not addressed in v1 — known acceptable behavior for an advisory gate.
- **Soft-cap line count.** Triggers 1 and 3 share the plan-body-LoC rule above for consistency; the ~600 cap is on plan-body-LoC, not raw `wc -l`.

## System-Wide Impact

- **Interaction graph.** `/ba:review-plan` gains one new dispatch (`plan-iteration-gate`) and one new mutation site (frontmatter increment). No other command changes behavior. `/ba:execute`, `/ba:tdd`, `/ba:slice` continue mutating their own frontmatter fields independently — fields do not collide because all mutations are targeted Edits, not full rewrites.
- **Error propagation.** Gate failures are caught locally in Step 5.5 and surfaced as a one-line non-blocking note. Gate failures do not propagate to `/ba:review-plan`'s exit status, do not abort apply-fix outcomes, and do not roll back the iteration-count increment.
- **State lifecycle risks.** The only persistent state is `iteration_count` in plan frontmatter. Lifecycle: `0` (set by `/ba:plan`) → `N` (monotonically incremented by `/ba:review-plan`) → effectively frozen once `status: completed` (no further `/ba:review-plan` runs expected). Reset is manual. No orphan-state risk; no cache-invalidation risk.

## Implementation Approach

### File 1 (NEW): `agents/workflow/plan-iteration-gate.md`

*Output string note*: the silent-clean string is `"No discipline violations detected."` (not `tdd-cycle-gate`'s `"No violations detected."`). The longer form is intentional — output always surfaces under a `## Plan-iteration discipline check` heading, making `"discipline"` load-bearing for domain context.

*Field naming note*: the vocal output uses `**Trigger**` where `tdd-cycle-gate` uses `**Criterion**`. This is an intentional domain-specific adaptation — `"Trigger"` maps cleanly to the gate's six named trigger categories.

````markdown
---
name: plan-iteration-gate
description: "Validates each plan-iteration round for discipline compliance. Dispatched by /ba:review-plan after the Apply Fixes step. Surfaces only violations — silent when iteration is clean."
model: inherit
tools: Read, Grep, Glob, LS
---

<examples>
<example>
Context: The /ba:review-plan command has just applied fixes to a plan and is dispatching the gate to evaluate the round.
user: "Validate this plan-iteration round. Plan path: docs/plans/2026-05-05-feat-add-foo-plan.md. Iteration count: 2. Snapshot LoC (start of session): 240. Current LoC (after fixes): 285. Review findings (this round): Must Address 2, Consider 4, Looks Good 1 (details attached)."
assistant: "I'll evaluate this round against the six trigger categories and check whether the iteration count warrants a discipline reminder."
<commentary>The /ba:review-plan command dispatches this gate after Step 5 (Apply Fixes). The gate compares the snapshot to the current plan, weighs the findings against the diff, and reports only violations.</commentary>
</example>
<example>
Context: The /ba:review-plan command has just completed its third invocation against the same plan; no fixes were applied this round.
user: "Validate this plan-iteration round. Plan path: docs/plans/2026-05-05-feat-add-bar-plan.md. Iteration count: 3. Snapshot LoC: 410. Current LoC: 410. Review findings (this round): Must Address 0, Consider 1, Looks Good 6 (details attached)."
assistant: "I'll evaluate this round. With iteration count 3, the discipline reminder fires regardless of other triggers."
<commentary>Iteration count ≥ 3 always emits the standing-rule reminder line, even when no other trigger fires. The reminder is advisory; /ba:review-plan continues normally.</commentary>
</example>
</examples>

You are a plan-iteration discipline validator. Your mission is to verify that each `/ba:review-plan` round follows the standing Discipline Rules from the Ousterhout-principles roadmap and to detect the planning-YAGNI / confidence-chasing ratchet documented in the 2026-04-23 retro.

**You validate silently. Report ONLY violations. If iteration is clean, return "No discipline violations detected."**

## Inputs

You receive from the `/ba:review-plan` command:

1. **Plan content snapshot** — the full plan body at the start of the current `/ba:review-plan` invocation (before Step 5 fixes were applied).
2. **Current plan content** — the full plan body after Step 5 fixes were applied (or unchanged if the user picked "Done").
3. **Iteration count** — integer N representing "this is the Nth `/ba:review-plan` round against this plan." N ≥ 1 on the first invocation.
4. **Review findings (this round)** — the Step 4 findings from this `/ba:review-plan` invocation, classified as Must Address / Consider / Looks Good.

## Plan body LoC — counting rule

For triggers 1 and 3, "plan body LoC" is the total lines in the plan file **excluding the YAML frontmatter span** (the lines from the opening `---` through the closing `---` inclusive). Blank lines, code fences, code-fence contents, and any inserted `## Slices` table are all counted. Apply this rule consistently to both the snapshot and the current plan content.

## Validation Checklist

Evaluate each of the six trigger categories. Fire a violation only when the criterion clearly applies — false positives erode the gate's signal.

### 1. Monotonic LoC growth (mechanical)
Compute plan-body LoC for the snapshot and the current plan. Fire if **current > snapshot** — this round's apply-fixes step net-added lines instead of contracting. Cite the delta.

### 2. Threading depth (LLM-judged over the diff)
Examine the diff between snapshot and current. Fire if a single concern is now threaded through more than two component layers (e.g., a new parameter passed through three+ files, a new ref/context propagated across three+ component boundaries, a new interface field touched in three+ call sites). One layer is one file or one component boundary; cite the specific layers.

### 3. Soft line cap (mechanical)
Fire if current plan-body LoC exceeds 600. Cite the exact count.

### 4. Abstract vocabulary creeping in (LLM-judged)
Fire if the diff introduces abstract architectural vocabulary that was not present in the snapshot. Watch specifically for: "orchestrator", "coordinator", "lifecycle boundary", "subsystem", "framework", "manager" used as a noun for a new module. Cite the exact phrases and line numbers; the trigger fires only when the vocabulary creeps in mid-iteration, not when it was present from the brainstorm.

### 5. Repeat-concern (LLM-judged)
Fire if the same concern (a specific design question, edge case, or risk) is discussed in three or more sections of the current plan. Cite each occurrence. Repeated mention is a signal the concern needs a spike, not more plan.

### 6. Verifier-finding-triggers-machinery (LLM-judged)
Compare this round's review findings (input #4) to the current diff (snapshot vs current). Fire if a Must Address or Consider finding that should have *contracted* the plan (e.g., "this section is over-engineered", "this edge case is speculative", "drop this dependency") instead caused the plan to *expand* (new section, new parameter, new dependency added in response). Cite the finding and the corresponding additive edit.

## Iteration-count reminder (always advisory)

Independently of whether any of the six triggers fired: if **iteration count ≥ 3**, append the following line as the final line of the vocal output:

```
Discipline rule reminder: round N — default to ship or delete after round 4
```

(replace `N` with the actual iteration count).

When iteration count ≥ 3 but no other trigger fired, the entire output is just the reminder line under the `## Plan-iteration discipline check` heading — i.e., the report is non-empty even when triggers are clean.

## Output Format

**When no triggers fired AND iteration count < 3:**

```
No discipline violations detected.
```

(Exact literal string. No trailing whitespace, no preamble, no congratulations.)

**When at least one trigger fired (with or without iteration ≥ 3):**

```markdown
## Plan-iteration discipline check

### [Violation Title]
- **Trigger**: [which of the six categories]
- **Evidence**: [specific reference — file:line, diff excerpt, LoC count, exact phrase]
- **Why this matters**: [one-sentence connection to the standing Discipline Rule it violates]
- **Suggestion**: [a contracting move — drop, spike, accept-and-ship — never a "build around it" suggestion]

### [Next Violation Title]
...

Discipline rule reminder: round N — default to ship or delete after round 4
```

(The reminder line appears only when iteration count ≥ 3.)

**When no triggers fired but iteration count ≥ 3:**

```markdown
## Plan-iteration discipline check

Discipline rule reminder: round N — default to ship or delete after round 4
```

## Important Rules

- **Silent on success.** Do not congratulate or summarize clean rounds. The exact string is `No discipline violations detected.` — nothing else.
- **Evidence-based.** Every violation cites a specific line, diff excerpt, LoC count, or exact phrase. No vague warnings.
- **Suggestions contract, never expand.** Every suggestion field must propose a contracting move — drop the dependent feature, spike, accept the risk, ship as-is. Never propose new sections, new abstractions, new parameters, new state, or new files. The gate exists to fight the ratchet, not feed it.
- **Read-only.** You have `Read, Grep, Glob, LS` only. You cannot edit the plan; you cannot mutate frontmatter. The dispatching command handles all state changes.
- **Do NOT block the round.** You report patterns; `/ba:review-plan` continues regardless. There is no Apply/Skip flow, no AskUserQuestion follow-up.
- **Do NOT propose specific edits.** Surface the pattern; let the user decide. Specific edits are the user's call (or a future round's job).
- **The iteration-count reminder is unconditional at N ≥ 3.** Never suppress it because other triggers also fired or because the plan looks fine on other axes — the round-count is itself a signal.
````

### File 2 (EDIT): `commands/ba/review-plan.md`

Insert a new section **between line 200 and line 204** (between the existing "Plan updated at `[path]`" confirmation that closes Step 5 and the `## Important Guidelines` fence). Do not modify Step 5's body or the existing `## Important Guidelines` content.

```markdown
---

## Step 5.5: Plan-Iteration Discipline Check

After Step 5 completes (regardless of whether fixes were applied), run the plan-iteration discipline gate. This step is unconditional — every `/ba:review-plan` invocation is one round, even when the user picked "Done" and no fixes were applied.

### 5.5a. Increment iteration count

Read the plan's YAML frontmatter. If `iteration_count:` is present and a non-negative integer, increment it by 1. If it is absent, malformed, or negative, treat it as 0 and write `iteration_count: 1`. Use a targeted Edit-tool call on the frontmatter field — do not rewrite unrelated fields.

After the Edit, the plan's `iteration_count` reflects the round being evaluated by the gate.

### 5.5b. Compute plan-body LoC

Plan body LoC excludes the YAML frontmatter span (the lines from the opening `---` through the closing `---` inclusive). Blank lines, code fences, and any `## Slices` table are counted.

You already have the start-of-session snapshot in memory (captured when `/ba:review-plan` was invoked, before any fix was written). Read the current plan file post-fix and compute current LoC against the same rule.

### 5.5c. Dispatch the gate

Dispatch `plan-iteration-gate` once, passing the four labeled inputs:

- Task plan-iteration-gate("Validate this plan-iteration round.

Plan path: [absolute path]

Iteration count: [N from 5.5a]

Snapshot LoC (start of session): [from 5.5b]
Current LoC (after fixes): [from 5.5b]

Plan content snapshot (start of session):
[snapshot body — frontmatter excluded]

Current plan content (after fixes):
[current body — frontmatter excluded]

Review findings (this round):
- Must Address: [list from Step 4, or 'none']
- Consider: [list from Step 4, or 'none']
- Looks Good: [list from Step 4, or 'none']

Apply the six-trigger checklist and the iteration-count reminder rule. Return only violations.")

### 5.5d. Surface the gate output

**If the gate returned `No discipline violations detected.`** (the exact literal string and iteration count < 3): print the line verbatim under a `## Plan-iteration discipline check` heading. Exit Step 5.5.

**If the gate returned a markdown report** (one or more violations, or iteration ≥ 3 with the reminder line): print the report verbatim. Do not present the findings via `AskUserQuestion`. Do not offer fix application. The gate is advisory; the user reads the report and decides what to do next outside this command.

**If the gate dispatch errored or timed out**: print a one-line note `Plan-iteration gate failed (non-blocking): [error]` and continue. The iteration-count increment from 5.5a is **not** rolled back — the round happened regardless of gate availability.

After Step 5.5 completes, `/ba:review-plan` exits.
```

### File 3 (EDIT): `commands/ba/plan.md`

Modify the shared YAML frontmatter block at lines 185-194. Add `iteration_count: 0` after `detail_level:`:

```yaml
---
title: [Descriptive Title]
type: feat | fix | refactor
status: active
date: YYYY-MM-DD
origin: docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md  # if originated from brainstorm, otherwise omit
detail_level: minimal | standard | comprehensive
iteration_count: 0
tags: [feature, component-names]
---
```

No other edits to `commands/ba/plan.md`.

### File 4 (EDIT): `README.md`

Append one row to the agent table at line 191-209, immediately after the `tdd-cycle-gate` row:

```markdown
| `plan-iteration-gate` | Validates each `/ba:review-plan` round against the planning-YAGNI / confidence-chasing ratchet — silent when iteration is clean, vocal on six trigger categories, advisory only |
```

No other edits to `README.md`.

### File 5 (EDIT): `CLAUDE.md` (root)

Append one bullet to the Agents list at lines 33-49, immediately after the `tdd-cycle-gate` line (line 49):

```markdown
- `plan-iteration-gate` — Per-round plan-iteration discipline validation, dispatched by `/ba:review-plan` Step 5.5 (Read, Grep, Glob, LS)
```

No other edits to `CLAUDE.md`.

### File 6 (EDIT): `.claude-plugin/plugin.json`

Bump version:

```json
{
  "name": "dev-workflow",
  "version": "0.11.0",
  "description": "Research, brainstorm, plan, slice, execute, TDD execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
  "author": {
    "name": "Bruno Azevedo"
  },
  "license": "MIT",
  "keywords": [
    "research",
    "brainstorm",
    "planning",
    "slice",
    "execute",
    "tdd",
    "workflow",
    "conventions",
    "review",
    "compound",
    "knowledge"
  ]
}
```

Only the `version` field changes. `marketplace.json` is left untouched.

### Success Criteria

#### Automated:
- [x] `test -f agents/workflow/plan-iteration-gate.md` exits 0.
- [x] `head -6 agents/workflow/plan-iteration-gate.md | grep -E "^(name|model|tools):"` shows the three expected lines.
- [x] `grep -c "tools: Read, Grep, Glob, LS" agents/workflow/plan-iteration-gate.md` returns 1.
- [x] `grep -q "Step 5.5" commands/ba/review-plan.md` exits 0.
- [x] `grep -q "plan-iteration-gate" commands/ba/review-plan.md` exits 0.
- [x] `grep -q "iteration_count: 0" commands/ba/plan.md` exits 0.
- [x] `grep -q "plan-iteration-gate" README.md` exits 0.
- [x] `grep -q "plan-iteration-gate" CLAUDE.md` exits 0.
- [x] `grep -q '"version": "0.11.0"' .claude-plugin/plugin.json` exits 0.
- [x] `grep -q "No discipline violations detected." agents/workflow/plan-iteration-gate.md` exits 0 (silent-clean exact-string).

#### Manual:
- [ ] Run `/ba:review-plan` against a fresh plan (iteration 1, no fixes). Verify the gate runs and prints `No discipline violations detected.` under a `## Plan-iteration discipline check` heading.
- [ ] Run `/ba:review-plan` three times against the same plan (iteration_count climbs 1 → 2 → 3). Verify the third run's output ends with `Discipline rule reminder: round 3 — default to ship or delete after round 4` regardless of whether other triggers fired.
- [ ] Run `/ba:review-plan` against a plan with intentional ratchet (apply-fixes adds a section that grows the plan). Verify trigger 1 (monotonic LoC growth) fires with the LoC delta cited as evidence.
- [ ] Run `/ba:plan` to write a new plan. Verify the YAML frontmatter contains `iteration_count: 0`.
- [ ] Confirm the gate output never includes an `AskUserQuestion` prompt or fix-application loop — read-only.
- [ ] Confirm `/ba:execute` and `/ba:tdd` continue to mutate `status` correctly on a plan that also has `iteration_count` (no frontmatter collision).

## Dependencies & Risks

- **Risk: gate is too noisy and gets ignored.** Mitigation: silent-on-clean is the default; vocal output requires at least one trigger or iteration ≥ 3. Suggestions are limited to contracting moves so the gate cannot become its own ratchet.
- **Risk: trigger 6 (verifier-finding-triggers-machinery) is hard to LLM-judge consistently.** Mitigation: gate input includes the diff and the findings together; cite-and-ship is the rule. False negatives are acceptable v1; false positives are corrected by the report-only contract (user reads, decides).
- **Risk: `iteration_count` accumulates indefinitely and the round-3 reminder loses meaning.** Mitigation: documented as v1 behavior, manual reset is the user's escape hatch. Revisit with evidence.
- **Risk: `/ba:plan` regeneration resets `iteration_count` to 0.** Mitigation: this is a feature — a regeneration is a fresh design pass and the round counter should reset. No code change needed.
- **Risk: parallel `/ba:review-plan` invocations race on the increment.** Mitigation: known last-write-wins behavior; not addressed in v1. Out of scope.
- **No external dependencies.** Pure documentation/agent additions. No new packages, no runtime dependencies, no skills-repo imports.

## Convention Compliance

- [x] **Filename format** (`docs/plans/YYYY-MM-DD-<type>-<descriptive-name>-plan.md`): aligned — `2026-05-05-feat-add-plan-iteration-gate-plan.md`.
- [x] **Frontmatter required fields** (`title`, `type`, `status`, `date`, `detail_level`, `tags`): aligned. `origin:` populated. `iteration_count: 0` proactively included in this plan's own frontmatter (the very field this plan introduces).
- [x] **Brainstorm Out-of-Scope L70 — "Adding `confidence:` (or any new field) to the plan frontmatter template"**: justified override, user-confirmed on 2026-05-05. The narrow reading of L70 prevails: the "any new field" clause is scoped to `confidence:`-style conversational fields, while brainstorm L44 explicitly enumerates `iteration_count: in plan frontmatter` as one of three candidate persistence mechanisms. Switching to in-memory-only would defeat trigger 1 (cross-round LoC growth) and the round-3 reminder; switching to `.dev-workflow/state/<plan-name>.json` would introduce a brand-new state-directory pattern with zero repo precedent. Frontmatter persistence reuses the established `status`/`sliced`/`slice_count` mutation surface.
- [x] **Agent naming** (`plan-iteration-gate` — lowercase-with-hyphens, `-gate` suffix matches `tdd-cycle-gate`): aligned.
- [x] **Agent placement** (`agents/workflow/`): aligned — gates live in `workflow/`, distinct from `review/`.
- [x] **Tool restriction** (`Read, Grep, Glob, LS`): aligned — exact match with `tdd-cycle-gate`'s frontmatter; no Edit/Write so the gate cannot mutate plans.
- [x] **Planning-commands-never-write-code rule** (CLAUDE.md line 66): aligned — `/ba:review-plan` Step 5.5 mutates plan frontmatter (an artifact under `docs/plans/`), not source code. Frontmatter mutation is an established pattern (`status`, `sliced`, `slice_count`).
- [x] **Bump `.claude-plugin/plugin.json` version** (CLAUDE.md line 65): aligned — `0.10.0` → `0.11.0`.
- [x] **Update README.md** (CLAUDE.md line 72): aligned — agent table extended.
- [x] **CLAUDE.md agent list** (CLAUDE.md lines 33-49): aligned — new agent appended.
- [x] **All built-in reviewers always appear as options in `/ba:review`** (CLAUDE.md line 71): not applicable — `plan-iteration-gate` is a workflow gate, not a reviewer.
- [x] **Convention-compliance check before writing planning artifacts** (CLAUDE.md line 68): aligned — this Convention Compliance section satisfies the gate.
- [x] **No-runtime-dependency on skills repo** (parent roadmap lines 39-44, 176): aligned — no skill imported, no skill invoked.
- [x] **Standing Discipline Rules self-check** (parent roadmap lines 130-160): aligned — single dispatch site, mechanical signals first, no new state directory, no new frontmatter field beyond the one explicitly enumerated as a candidate in the brainstorm (line 44), no verifier-finding-triggers-machinery (the spec-flow analyzer's recommendations were filtered to the small/critical items; the larger machinery proposals — sliced-plan special-casing, completed-plan guard, prior-findings persistence, error-handling subsection, observability log — were explicitly contracted into "What We're NOT Doing" rather than expanded into the plan body). Plan body is well under the 600-line soft cap. One round of design dialogue (brainstorm + research + analyzer); no re-iteration ratchet.

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-05-04-plan-iteration-gate-brainstorm.md` — all six triggers, dispatch site, input contract, scope boundaries carried forward verbatim.
- **Parent roadmap:** `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` — Phase 3 entry (lines 75-87); standing Discipline Rules referenced (lines 130-160); skills-repo runtime constraint (lines 39-44).
- **Pattern source — silent-vocal gate:** `agents/workflow/tdd-cycle-gate.md:1-89` (frontmatter shape, `<examples>` block, validation checklist, output contract, important-rules section).
- **Pattern source — gate dispatch:** `commands/ba/tdd.md:212-239` (`Task tdd-cycle-gate("...")` shape, silent-handling and vocal-handling branches).
- **Dispatch site:** `commands/ba/review-plan.md:174-204` (Step 5 Apply Fixes; line 200 confirmation; line 204 `## Important Guidelines` fence).
- **Plan template frontmatter:** `commands/ba/plan.md:185-194` (shared YAML block).
- **Frontmatter mutation precedents:** `commands/ba/execute.md:94`, `execute.md:286`, `execute.md:315`, `tdd.md:98`, `tdd.md:391`, `tdd.md:365`, `slice.md:46`, `slice.md:118`.
- **Version registry:** `.claude-plugin/plugin.json:3` (current `0.10.0`); `marketplace.json` static at `0.1.0`, decoupled from plugin.json by repo convention.
