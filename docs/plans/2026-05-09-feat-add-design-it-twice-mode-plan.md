---
title: Add design-it-twice mode to ba:brainstorm Phase 2
type: feat
status: completed
date: 2026-05-09
origin: docs/brainstorms/2026-05-09-phase5-design-it-twice-brainstorm.md
detail_level: standard
iteration_count: 0
tags: [ousterhout, design-it-twice, ba-brainstorm, interface-design, parallel-sub-agents, phase-5]
---

# Add Design-It-Twice Mode to `ba:brainstorm` Phase 2 Implementation Plan

## Overview

Phase 5 of the Ousterhout-principles roadmap. Upgrade `commands/ba/brainstorm.md` Phase 2 (Explore Approaches) with a conditional **design-it-twice mode**: when the brainstorm proposes a new module / interface / public API surface, Phase 2 dispatches three `interface-design-generator` agents in parallel, each anchored to a different Ousterhout-flavored constraint (deepest-module / common-case / info-hiding), generates three alternative interface shapes, and lets the user pick (with explicit hybrid allowed at pick time, locked at Phase 3 capture). When the trigger does not fire, Phase 2 runs as today.

The brainstorm (`docs/brainstorms/2026-05-09-phase5-design-it-twice-brainstorm.md`) is the authority on what to build and why. This plan resolves the implementation-detail decisions deferred there: the agent file shape (one parameterized agent vs. three siblings), the agent suffix (no `-designer`/`-generator` precedent), the hybrid pick UX, the canonical capture shape, and the failure-mode contract.

## Current State

- `commands/ba/brainstorm.md:159-170` is Phase 2 today — twelve lines that propose 2-3 approaches with pros/cons, lead with a recommendation, then `AskUserQuestion` to pick. The conditional sub-flow inserts here (see brainstorm: `2026-05-09-phase5-design-it-twice-brainstorm.md:39, 61` — the recommendation framing and AskUserQuestion at `:170` are reused on both paths; only the *generator* of alternatives changes).
- `commands/ba/brainstorm.md:172-215` is Phase 3 (Capture the Design) with the brainstorm-doc template. New `## Locked Design` and `## Rejected Designs` sections are appended only when design-it-twice mode fired in Phase 2 — the existing template is unchanged for the default path.
- `agents/workflow/` contains `convention-checker.md`, `spec-flow-analyzer.md`, `plan-iteration-gate.md`. New file `interface-design-generator.md` joins as the fourth.
- Suffix precedent in `agents/workflow/`: `-checker`, `-gate`, `-analyzer`. **No `-designer`/`-generator` precedent exists.** Per brainstorm `:107` resolution path (b), this plan establishes `-generator` as a new suffix and documents it in root `CLAUDE.md` and the parent roadmap.
- `commands/ba/research.md:55-87` is the canonical parallel-sub-agent dispatch precedent: a header sentence, a bulleted list of `Task <agent>("...")` invocations, and a "Wait for all sub-agents" trailing instruction. Phase 2 design-it-twice mode follows the same shape with three dispatches against the same agent file but with different constraints.
- `INTERFACE-DESIGN.md` at `~/Programming/playground/agent_workflow_repos/skills/skills/engineering/improve-codebase-architecture/INTERFACE-DESIGN.md` is the design reference (read-only, per parent roadmap `:39-44`). The 5-part output contract and the constraint vocabulary are reimplemented in-tree in `agents/workflow/interface-design-generator.md`; nothing is imported.
- Parent roadmap Discipline Rules at `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md:127-157`. The `### Concrete rules` block at `:149-157` gains one new bullet (the synthesis-lock rule) atomically with this MR.
- Current `.claude-plugin/plugin.json:3` is `"version": "0.12.0"`. Recent cadence (per `git log` on 0.10.0 → 0.11.0 → 0.12.0) is one minor bump per shipped phase. This plan ships as `0.13.0`.

## What We're NOT Doing

Each item is an explicit decline. Several were proposed by spec-flow-analyzer in service of edge cases the brainstorm already accepted as out-of-scope; declining them honors the standing Discipline Rules ("verifier finding answered with >20 lines of new plan → wrong direction").

- **No `/ba:plan`-side enforcement hook for the synthesis-lock.** Brainstorm `:76-77` explicitly out-of-scopes a `ba:plan` equivalent. Lock enforcement is Level-2: the standing Discipline Rule + the `## Locked Design` / `## Rejected Designs` sections in the brainstorm doc. Plan reads brainstorm and respects it as it does today.
- **No timeout cap, no collision detection, no per-agent output validator with re-rolls.** Brainstorm decision `:39, 61` is "only the *generator* of alternatives changes." Adding orchestration around the dispatch is machinery — three sub-agents in parallel, wait for all three, fall back to default Phase 2 on hard error or empty output. That's it.
- **No frontmatter `parallel_dispatch_fired: true` marker.** The presence of `## Locked Design` in the captured brainstorm doc is the state. A new field would duplicate that signal and adds a frontmatter mutation surface for one boolean.
- **No force-fire / force-skip override flags for the trigger.** Brainstorm `:46-52` defines five LLM-judged criteria with prefer-firing on ambiguity; that is the contract. Override flags would invite gaming the trigger and undercut the calibration the brainstorm chose.
- **No re-roll, no re-dispatch within a single brainstorm session.** Brainstorm `:59` is binding — single-shot per brainstorm. If the user wants different alternatives, that is a fresh brainstorm.
- **No extension of `convention-checker` to validate the new sections.** The 5-part output is design vocabulary, not a project convention. Convention-checker continues to validate filename pattern, frontmatter shape, agent placement, and the like — it does not opine on whether a chosen design is "deep enough."
- **No new `brainstorm-iteration-gate` agent.** Parent roadmap `:124` defers this; nothing in this plan changes that calculus.
- **No port of `interface-comment-reviewer`.** Parent roadmap `:122` defers this; out of Phase 5 scope per brainstorm `:81`.

## Behaviors to Test

- [x] `agents/workflow/interface-design-generator.md` exists with frontmatter `name: interface-design-generator`, `model: inherit`, `tools: Read, Grep, Glob, LS`.
- [x] The agent body documents all three constraints (deepest-module / common-case / info-hiding) as parameter values and specifies the 5-part output contract (Interface, Usage example, What's hidden, Dependency strategy, Trade-offs).
- [x] `commands/ba/brainstorm.md` Phase 2 contains a trigger-criteria block listing the five criteria from brainstorm `:46-52` verbatim and the explicit "skip silently" instruction when the trigger does not fire.
- [x] `commands/ba/brainstorm.md` Phase 2 contains a design-it-twice sub-flow that dispatches three parallel `Task interface-design-generator(...)` calls — one per constraint — and falls back to the default-mode flow when any dispatch errors or returns empty output.
- [x] `commands/ba/brainstorm.md` Phase 2 specifies a four-option `AskUserQuestion` ([A / B / C / Hybrid]) with a free-text follow-up prompt when the user picks Hybrid.
- [x] `commands/ba/brainstorm.md` Phase 3 documents the conditional `## Locked Design` and `## Rejected Designs` sections to append after `## Key Decisions` when design-it-twice mode fired.
- [x] Parent roadmap `### Concrete rules` block (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md:149-157`) gains the synthesis-lock bullet verbatim.
- [x] Parent roadmap Phase 5 entry (`:106-118`) is amended with a one-line note resolving the agent-suffix decision.
- [x] Root `CLAUDE.md` agent-list bullet for `interface-design-generator` is appended after the `plan-iteration-gate` bullet, matching the existing one-line role-plus-tools format.
- [x] Root `CLAUDE.md` "Agent names: lowercase-with-hyphens" convention bullet is amended to enumerate the role suffixes (`-reviewer`, `-checker`, `-gate`, `-analyzer`, `-generator`).
- [x] `README.md` agent table includes an `interface-design-generator` row.
- [x] `.claude-plugin/plugin.json` version is `0.13.0`.

## Proposed Solution

Six-file diff, single atomic MR:

1. **NEW** `agents/workflow/interface-design-generator.md` — one parameterized agent. Constraint passed as input; the body defines all three constraint shapes and the 5-part output contract once, in one place.
2. **EDIT** `commands/ba/brainstorm.md` — replace Phase 2 (`:159-170`) with a trigger-block + two-mode sub-flow (default mode = today's content; design-it-twice mode = parallel dispatch + present + 4-option pick + hybrid follow-up + capture). Append a "When design-it-twice mode fires" subsection at the end of Phase 3 documenting the `## Locked Design` and `## Rejected Designs` capture sections.
3. **EDIT** `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` — append the synthesis-lock rule to `### Concrete rules` (`:149-157`); amend the Phase 5 entry to record the suffix-decision resolution.
4. **EDIT** `README.md` — append `interface-design-generator` row to the agent table.
5. **EDIT** `CLAUDE.md` (root) — append `interface-design-generator` bullet to the Agents list; amend the "Agent names" convention bullet to enumerate role suffixes.
6. **EDIT** `.claude-plugin/plugin.json` — bump `0.12.0` → `0.13.0`.

### Agent file shape: one parameterized agent

The brainstorm `:63, 107` deferred the choice between one parameterized agent and three siblings to plan time. Plan resolves to **one parameterized agent** for two reasons:

1. **Single source of truth for the 5-part output contract.** The contract (Interface / Usage example / What's hidden / Dependency strategy / Trade-offs) is identical across the three constraints. Three siblings would replicate it three times — change-amplification on every contract revision.
2. **Deeper module by Ousterhout's own definition.** The agent's interface (input: brainstorm context + constraint identifier; output: 5-part design) is narrower than three siblings each exposing the same surface. The roadmap's whole motivation is installing this discipline; the Phase 5 deliverable should embody it.

The agent body documents all three constraint identifiers (`deepest-module`, `common-case`, `info-hiding`) and what each instructs the generator to optimize for. The dispatching command in `brainstorm.md` calls the agent three times in parallel, each with a different constraint.

### Agent suffix: `-generator`, established as new

Brainstorm `:107` left three resolution paths. Plan picks **(b) establish a new suffix and document it.** The agent generates an artifact (an alternative interface design under a constraint) — same role-noun shape as the existing suffixes (`-checker` checks; `-gate` validates per round; `-analyzer` extracts insight; `-reviewer` reviews; `-generator` produces). The change to root `CLAUDE.md` enumerates the role suffixes on one line. The change to the parent roadmap Phase 5 entry records the resolution so future per-phase plans see it.

### Trigger evaluation, ambiguity, and skip-silently

The five criteria from brainstorm `:46-52` go inline in `commands/ba/brainstorm.md` Phase 2 verbatim. The trigger fires when ANY criterion clearly applies. **Ambiguity tiebreaker: prefer firing.** The cost of one unnecessary parallel dispatch is one round of LLM time; the cost of skipping a needed one is the DisplayNamesEditor calcification cost (see `~/Programming/dragon/docs/learnings/2026-04-24-ba-tdd-retro-slice-4-displaynameseditor.md:33-39, 55-60` — ~15 minutes of conflict-resolution overhead from a lint-driven `useImperativeHandle` that a deepest-module agent would have rejected). The asymmetry favors firing.

When the trigger does not fire, Phase 2 runs as today and **announces nothing about the trigger** — matches brainstorm `:60` "skip silently" and matches the existing iteration-gate UX pattern.

Mixed-scope brainstorms (new module + refactor) fire if any portion proposes a new boundary; the dispatched sub-agents are scoped to the new portion only. Single bullet in the trigger block; no extra logic.

### Failure-mode contract

The dispatching command in `commands/ba/brainstorm.md` Phase 2 design-it-twice sub-flow does the minimum:

- Dispatch all three `Task interface-design-generator(...)` calls in parallel.
- Wait for all three. No timeout cap.
- If any dispatch returns an error, an empty output, or output missing one of the five contract parts: **fall back to the default-mode flow** (propose 2-3 approaches via single-LLM enumeration). Note the fallback in Phase 3 capture as: `Design-it-twice dispatch attempted; fell back to default Phase 2 enumeration because [agent X errored / returned empty / output missing parts].`
- Successful outputs are presented and picked from even when the fallback path is taken on a different agent — i.e., no all-or-nothing enforcement. (Out of scope for v1: the fallback is wholesale, not per-agent. Acceptable simplification — we do not yet have evidence that partial successes are common enough to engineer around.)

### Pick UX: 4 options with hybrid free-text follow-up

After presenting the three designs sequentially with prose contrast and a recommendation, the brainstorm command issues `AskUserQuestion` with exactly four options: `Design A — Deepest module`, `Design B — Common case`, `Design C — Info hiding`, `Hybrid`. If the user picks `Hybrid`, a second `AskUserQuestion` follow-up requests a one-or-two-sentence free-text description of the hybrid (e.g., *"A's interface but B's error model"*). The exact wording the user supplies is captured verbatim in the brainstorm doc's `## Locked Design > Source` line. No structured per-axis sub-questions — the hybrid is captured as a single quote, and refinement happens at plan time within the bounds of the lock.

If the user explicitly rejects all four options, that is signal that the parallel dispatch missed the right shape. The brainstorm command surfaces the misfire to the user and offers two paths: (a) accept one of A/B/C as a starting point and refine in plan, (b) end the brainstorm and start a fresh one. **Re-dispatching is forbidden** by the single-shot rule (brainstorm `:59`).

### Canonical capture shape

When design-it-twice mode fired, Phase 3 capture writes two new sections after `## Key Decisions`:

- `## Locked Design` — five subsections matching the per-agent contract (`### Interface`, `### Usage example`, `### What's hidden behind the seam`, `### Dependency strategy`, `### Trade-offs`), preceded by a `**Source:**` line identifying which design (`Design A | Design B | Design C | Hybrid: <verbatim user description>`). Closes with one-line text noting the lock and pointing to the standing Discipline Rule.
- `## Rejected Designs` — three subsections (one per unchosen design, or two when a hybrid uses two), each with a one-or-two-sentence interface summary and a one-or-two-sentence "why rejected" line. The rejected designs are inspectable so plan/execute can see the surface area the lock excludes.

When design-it-twice mode did NOT fire, neither section is written. The existing brainstorm template at `commands/ba/brainstorm.md:178-215` is unchanged for the default path.

## Technical Considerations

- **`AskUserQuestion` four-option ceiling.** The pick UX uses the full ceiling exactly. Adding a fifth ("none of these") would compete with `Hybrid` for the recovery slot — declined for v1; the misfire path uses post-pick conversation, not a fifth option.
- **Agent prompt size.** The dispatching command pastes a brainstorm-context summary into each `Task interface-design-generator(...)` call. Three parallel calls each carry the same context — this is acceptable token cost for the design-quality lift the brainstorm validates against the DisplayNamesEditor retro.
- **Single-shot enforcement is LLM-honor.** The brainstorm command checks whether `## Locked Design` already exists in the brainstorm doc before dispatching. If it does, the dispatch is skipped and the user is told the dispatch already ran. Re-running `/ba:brainstorm` against an existing brainstorm doc is the only realistic re-fire path; the section-presence check covers it.
- **No state directory, no JSON state files.** All persistence is via the brainstorm doc's section presence. Same minimalism that `plan-iteration-gate` chose for its own state.

## System-Wide Impact

- **Interaction graph.** `commands/ba/brainstorm.md` Phase 2 gains one conditional dispatch site (three parallel `interface-design-generator` calls) and one new template addendum (the `## Locked Design` / `## Rejected Designs` capture sections). No other command changes behavior. `/ba:plan`, `/ba:slice`, `/ba:execute`, `/ba:review-plan`, `/ba:review` continue as before; they read the brainstorm doc and respect whatever capture shape they find.
- **Error propagation.** Parallel-dispatch failures are caught locally in Phase 2 and surfaced as the default-mode fallback with a one-line note in Phase 3 capture. Failures do not propagate to `/ba:brainstorm`'s exit status, do not block Phase 3.5 (Convention-Compliance Check), and do not require user input mid-Phase-2.
- **State lifecycle risks.** The only persistent state is the presence of `## Locked Design` in the captured brainstorm doc. Lifecycle: absent (default-mode path) or present (design-it-twice mode fired). No mutation post-capture by any command in the plugin. Reset is "start a fresh brainstorm." No orphan-state risk; no cache-invalidation risk.

## Implementation Approach

### File 1 (NEW): `agents/workflow/interface-design-generator.md`

Full file content:

````markdown
---
name: interface-design-generator
description: "Generates one alternative interface design under a named Ousterhout-flavored constraint (deepest-module / common-case / info-hiding). Dispatched in parallel by /ba:brainstorm Phase 2 when the brainstorm proposes a new module or interface."
model: inherit
tools: Read, Grep, Glob, LS
---

<examples>
<example>
Context: The /ba:brainstorm command is in Phase 2 and the brainstorm proposes a new agent file. The dispatching command fires three parallel calls — this one anchored to the deepest-module constraint.
user: "Constraint: deepest-module. Brainstorm context: a new agents/workflow/ agent that watches /ba:execute slices for slice-creep — fires when slice scope grows mid-execution. Existing constraint set: agents/workflow/ has -checker, -gate, -analyzer suffixes. The agent dispatches read-only, surfaces violations only, never blocks. Dependencies: must read plan frontmatter; must compare slice diffs across rounds."
assistant: "I'll generate an alternative interface design under the deepest-module constraint — smallest surface, 1-3 entry points max, most behavior hidden behind the seam — and produce the 5-part output."
<commentary>The agent receives a constraint identifier and a brainstorm context summary. It produces exactly the 5-part output contract — no commentary, no recommendation, no comparison to other constraints. The dispatching command compares across the three returned designs.</commentary>
</example>
<example>
Context: The same brainstorm dispatches a second parallel call anchored to the common-case constraint.
user: "Constraint: common-case. Brainstorm context: [same context as above]."
assistant: "I'll generate an alternative interface design under the common-case constraint — the default path is trivial, the caller writes the minimum, edge cases possible but pay extra cost — and produce the 5-part output."
<commentary>The constraint identifier (common-case) drives a different design shape than the parallel deepest-module call. Each constraint should produce a meaningfully different interface; the dispatching command surfaces the divergence to the user.</commentary>
</example>
</examples>

You are an interface designer generating one alternative design for a proposed new module under a named Ousterhout-flavored constraint. You produce exactly the 5-part output contract below — nothing more, nothing less.

Your design reference (read-only context) is the "Design It Twice" pattern in the upstream skills repo at `~/Programming/playground/agent_workflow_repos/skills/skills/engineering/improve-codebase-architecture/INTERFACE-DESIGN.md`. The 5-part contract and constraint vocabulary are reimplemented here in-tree per the dev-workflow plugin's no-runtime-dependency rule (parent roadmap `:39-44`); you do not need to read that file.

## Inputs

You receive from the dispatching command:

1. **Constraint** — exactly one of: `deepest-module`, `common-case`, `info-hiding`. The constraint anchors your design pressure (definitions below).
2. **Brainstorm context** — a 3-8 sentence summary of what is being designed: the proposed module's purpose, where it lives in the codebase, the dependencies it would need, and any constraints already established by the brainstorm dialogue. The summary may include relevant file:line references or a small illustrative code sketch.

## Constraints (definitions)

Work under exactly one. The dispatching command guarantees you receive a valid constraint identifier; you do not need to validate it.

### `deepest-module`
Smallest interface, most hidden behind it. Aim for 1-3 entry points maximum. Maximize the work done per entry point ("leverage"). Prefer one well-named function with strong invariants over three thin getters. Hide every implementation choice that does not need to leak. Default state: state lives behind the seam, not in the caller.

### `common-case`
The default path is trivial. The caller writes the minimum to do the most common thing. Edge cases are reachable but pay extra cost — opt-in parameters, escape-hatch entry points, or a separate API call. Optimize the line count and cognitive load of the default usage example, not the worst case.

### `info-hiding`
Hide the implementation choices most likely to change. Stability of the seam is the design goal. The interface should not betray which library, schema version, transport, or storage backend is in use. A reasonable change to any of those should require zero changes at the call site. Default state: every parameter, return type, and error type is chosen for stability under future implementation churn.

## Output Format

Produce exactly five sections, in this order, with no preamble and no closing remarks. The dispatching command parses your output by these section headers — do not rename them.

```markdown
### Interface
[Entry points + signatures (with concrete types — pick names and types that fit the brainstorm context's domain). State invariants, ordering requirements between calls, and error modes. If the language is undecided, pick one and note "[language: <X>]" on the first line.]

### Usage example
[The most common caller's code. Aim for the minimal realistic snippet — 5-15 lines. Prefer pseudocode that names the call sites and shows the data flow over real, runnable code.]

### What's hidden behind the seam
[Bulleted list of the implementation choices the seam hides. Each bullet names the choice and one concrete example (e.g., "storage backend — current sketch uses Redis; the seam allows swapping to Postgres without caller changes").]

### Dependency strategy
[How the module reaches its dependencies. Inject vs. import vs. construct internally. Adapter pattern vs. direct port. One paragraph; cite specific dependencies from the brainstorm context.]

### Trade-offs
[Bulleted list. For each trade-off, name where leverage is high (the constraint paid off) and where leverage is thin (the constraint cost something). 3-5 bullets.]
```

## Important Rules

- **Honor the constraint.** Each section's content reflects the named constraint. A `deepest-module` design with 5 entry points has not honored the constraint; a `common-case` design where the default usage example is 30 lines has not honored the constraint; an `info-hiding` design that exposes the schema version in a public type has not honored the constraint.
- **Produce all five sections.** The dispatching command parses by header. Missing sections cause the dispatching command to fall back to the default-mode Phase 2 flow.
- **No commentary, no recommendation, no comparison.** You generate one alternative under one constraint. The dispatching command compares across the three returned designs and presents the contrast to the user.
- **No code that exceeds the brainstorm's design phase.** Pseudocode and signatures are encouraged; full method bodies are not. The brainstorm is exploring WHAT to build; the plan answers HOW.
- **Read-only.** You have `Read, Grep, Glob, LS` only. You may consult existing code referenced in the brainstorm context to ground your design, but you cannot edit any file or write any artifact. The dispatching command captures your output; you write nothing.
````

### File 2 (EDIT): `commands/ba/brainstorm.md`

Two edits to this file. Both are within the existing Phase 2 / Phase 3 region; nothing else changes.

#### Edit 2a — Replace Phase 2 (lines 159-170) with the conditional sub-flow

Replace lines 159-170 (the entire current Phase 2) with the block below. Lines 158 (the FULL exit-condition line) and 172 (the Phase 3 header) bracket the replacement region; do not modify either.

```markdown
### Phase 2: Explore Approaches

Phase 2 has two modes. The trigger below decides which fires; **do not announce the evaluation either way**.

#### Trigger: design-it-twice mode

Fire design-it-twice mode (parallel constraint-anchored dispatch) when ANY of the following is true:

- a new file / directory / module is being proposed,
- a new exported function / class / component is being proposed,
- a new public interface or API surface is being proposed,
- a new agent / command / skill is being proposed,
- a new public type that callers depend on is being proposed.

Do **not** fire for: modifications to existing modules, bug fixes, parameter additions, internals, or refactors that preserve external shape.

Mixed-scope brainstorms (new module + refactor in one brainstorm): fire if any portion proposes a new boundary; the dispatched sub-agents are scoped to the new portion only.

Tie-breaker on ambiguity: prefer firing. The cost of an unnecessary parallel dispatch is one round of LLM time; the cost of skipping a needed one is calcified design.

When the trigger does **not** fire, run the default mode below silently. No announcement. Single-shot per brainstorm session: if `## Locked Design` already exists in the brainstorm doc you are about to write, do not re-dispatch — proceed to default mode and note the prior dispatch in Phase 3 capture.

#### Default mode (trigger did not fire)

Propose **2-3 concrete approaches** based on research and conversation.

For each approach, provide:
- Brief description (2-3 sentences)
- Pros and cons
- When it's best suited

**Lead with your recommendation and explain why.** Apply YAGNI — prefer the simpler solution unless complexity is justified.

Use **AskUserQuestion** to ask which approach the user prefers (or if they want to explore a different direction).

#### Design-it-twice mode (trigger fired)

Dispatch three `interface-design-generator` agents in parallel, one per constraint:

- Task interface-design-generator("Constraint: deepest-module. Brainstorm context: <3-8 sentence summary of what's being designed, including proposed module purpose, where it lives, dependencies, and constraints established in Phase 1.2 dialogue>.")
- Task interface-design-generator("Constraint: common-case. Brainstorm context: <same summary as above>.")
- Task interface-design-generator("Constraint: info-hiding. Brainstorm context: <same summary as above>.")

Wait for all three to return.

**Failure handling.** If any dispatch errors, returns empty, or returns output missing one or more of the five contract sections (`### Interface`, `### Usage example`, `### What's hidden behind the seam`, `### Dependency strategy`, `### Trade-offs`), **fall back to default mode above** for the entire pick step. Note the fallback in Phase 3 capture as: `Design-it-twice dispatch attempted; fell back to default Phase 2 enumeration because [reason].`

**Present.** Show each design sequentially with its full 5-part output (Design A — Deepest module, Design B — Common case, Design C — Info hiding). After the third presentation, contrast in prose on **depth** (leverage at the interface), **locality** (where change concentrates), **seam placement**, and **who pays the trade-offs**. **Lead with a recommendation** — a strong read, not a menu.

**Pick.** Use **AskUserQuestion** with exactly four options:
1. **Design A — Deepest module** — [one-line summary of A's interface]
2. **Design B — Common case** — [one-line summary of B's interface]
3. **Design C — Info hiding** — [one-line summary of C's interface]
4. **Hybrid** — combine elements across designs

If the user picks **Hybrid**, follow up with a second **AskUserQuestion** asking the user to describe the hybrid in one or two sentences (e.g., *"A's interface but B's error model"*). Capture the user's wording verbatim — it becomes the `**Source:**` line of `## Locked Design` in Phase 3 capture.

If the user explicitly rejects all four options, surface the misfire and offer: (a) accept one of A/B/C as a refinement starting point in plan, or (b) end this brainstorm and start a fresh one. **Do not re-dispatch within this brainstorm session** — single-shot is binding.
```

#### Edit 2b — Append capture-section instructions at the end of Phase 3 (after line 219, before the HARD GATE block at line 221)

Insert the block below between line 219 (`- **FULL**: Comprehensive — 200-300 words per section where warranted. All sections populated.`) and line 221 (`**HARD GATE:** Before proceeding to Phase 3.5...`):

```markdown

#### When design-it-twice mode fired in Phase 2

If Phase 2's trigger fired and the user picked a design (A / B / C / Hybrid), append the two sections below **after `## Key Decisions`** in the brainstorm doc. Do not write either section when the trigger did not fire — keep the default template clean.

```markdown
## Locked Design

**Source:** [Design A — Deepest module | Design B — Common case | Design C — Info hiding | Hybrid: <verbatim quote of the user's hybrid description>]

### Interface
[Entry points + signatures + invariants/ordering/error modes from the chosen design. For a hybrid, source the relevant sections from each design referenced in the user's hybrid description.]

### Usage example
[Most-common caller from the chosen design.]

### What's hidden behind the seam
[From the chosen design.]

### Dependency strategy
[From the chosen design.]

### Trade-offs
[From the chosen design — preserve verbatim. Trade-offs from rejected designs go in `## Rejected Designs` below.]

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`). Plan and execute may refine this design within the bounds of the lock; they may not re-add elements from the rejected designs below.

## Rejected Designs

### [Design A | Design B | Design C] — [Deepest module | Common case | Info hiding] (rejected)
- **Interface summary:** [1-2 sentences sourced from the unchosen design's `### Interface` section.]
- **Why rejected:** [1-2 sentences sourced from the contrast prose and the user's pick reasoning. For a hybrid, identify which elements *were* incorporated and which were not.]

### [next rejected design]
[same shape — repeat for each unchosen design]
```

If the dispatch fell back to default mode (per the failure-handling rule in Phase 2), do **not** write `## Locked Design` or `## Rejected Designs` — capture the chosen approach inside `## Key Decisions` as today, and add a one-line note: `Design-it-twice dispatch attempted; fell back to default Phase 2 enumeration because [reason].`

```

### File 3 (EDIT): `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`

Two edits, both inside this single brainstorm doc.

#### Edit 3a — Append the synthesis-lock rule to `### Concrete rules`

The current `### Concrete rules` block runs from line 149 to line 157 (line 158 is the blank line before `## Scope Boundaries` on line 159). Append one bullet immediately after line 157, preserving the blank line at 158:

```markdown
- **Synthesis lock at brainstorm capture.** Hybrid alternatives are locked at brainstorm capture; no bolting rejected pieces back during plan/execute. The brainstorm's `## Locked Design` and `## Rejected Designs` sections (when present) define the bound; refinement inside the lock is fine, re-adding rejected pieces is the synthesis-creep ratchet that this rule names. Origin: Phase 5 brainstorm `docs/brainstorms/2026-05-09-phase5-design-it-twice-brainstorm.md`.
```

#### Edit 3b — Amend Phase 5 entry to record the suffix-decision resolution

The Phase 5 entry runs from line 106 to line 118. Inside the `**Scope hooks:**` bullet list (lines 110-114), append one new bullet after line 114 (before the `**Why last:**` summary at line 116):

```markdown
- **Resolved at plan time (2026-05-09):** the Phase 5 plan establishes `-generator` as a new `agents/workflow/` suffix and ships `interface-design-generator` as one parameterized agent (constraint passed as input) rather than three siblings. Suffix is documented in root `CLAUDE.md` "Conventions". See `docs/plans/2026-05-09-feat-add-design-it-twice-mode-plan.md`.
```

No other edits to this file.

### File 4 (EDIT): `README.md`

Append one row to the agent table at lines 178-196, immediately after the `plan-iteration-gate` row (line 196):

```markdown
| `interface-design-generator` | Generates one alternative interface design under a named Ousterhout-flavored constraint (deepest-module / common-case / info-hiding); dispatched in parallel by `/ba:brainstorm` Phase 2 when the brainstorm proposes a new module or interface |
```

No other edits to `README.md`.

### File 5 (EDIT): `CLAUDE.md` (root)

Two edits.

#### Edit 5a — Append agent bullet

Append one bullet to the Agents list (lines 32-48), immediately after the `plan-iteration-gate` bullet at line 48:

```markdown
- `interface-design-generator` — Generates one alternative interface design under a named Ousterhout-flavored constraint, dispatched in parallel by `/ba:brainstorm` Phase 2 design-it-twice mode (Read, Grep, Glob, LS)
```

#### Edit 5b — Amend "Agent names" convention bullet

Replace line 62:

```markdown
- Agent names: lowercase-with-hyphens
```

with:

```markdown
- Agent names: lowercase-with-hyphens; suffix names the role (`-reviewer` for `agents/review/`; `-checker`, `-gate`, `-analyzer`, `-generator` for `agents/workflow/`)
```

No other edits to `CLAUDE.md`.

### File 6 (EDIT): `.claude-plugin/plugin.json`

Bump version `0.12.0` → `0.13.0`. Only the `version` field changes; `description`, `keywords`, and all other fields remain as-is. `marketplace.json` is left untouched (per the precedent the `plan-iteration-gate` plan established at `:30, 415`).

```json
{
  "name": "dev-workflow",
  "version": "0.13.0",
  "description": "Research, brainstorm, plan, slice, execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
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
    "workflow",
    "conventions",
    "review",
    "compound",
    "knowledge"
  ]
}
```

### Success Criteria

#### Automated:
- [x] `test -f agents/workflow/interface-design-generator.md` exits 0.
- [x] `head -6 agents/workflow/interface-design-generator.md | grep -E "^(name|model|tools):"` shows the three expected lines.
- [x] `grep -q "tools: Read, Grep, Glob, LS" agents/workflow/interface-design-generator.md` exits 0.
- [x] `grep -q "deepest-module" agents/workflow/interface-design-generator.md && grep -q "common-case" agents/workflow/interface-design-generator.md && grep -q "info-hiding" agents/workflow/interface-design-generator.md` — all three constraint identifiers present in the agent body.
- [x] `grep -q "Trigger: design-it-twice mode" commands/ba/brainstorm.md` exits 0.
- [x] `grep -q "interface-design-generator" commands/ba/brainstorm.md` exits 0.
- [x] `grep -c "Task interface-design-generator" commands/ba/brainstorm.md` returns 3 (one per constraint).
- [x] `grep -q "## Locked Design" commands/ba/brainstorm.md && grep -q "## Rejected Designs" commands/ba/brainstorm.md` exits 0.
- [x] `grep -q "Synthesis lock at brainstorm capture" docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` exits 0.
- [x] `grep -q "Resolved at plan time (2026-05-09)" docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` exits 0.
- [x] `grep -q "interface-design-generator" README.md && grep -q "interface-design-generator" CLAUDE.md` exits 0.
- [x] `grep -q '"version": "0.13.0"' .claude-plugin/plugin.json` exits 0.
- [x] `grep -q -- "-generator" CLAUDE.md` exits 0 — suffix enumerated in conventions.

#### Manual:
- [ ] Run `/ba:brainstorm` against an idea that proposes a new agent file. Verify Phase 2 fires design-it-twice mode (three parallel dispatches), presents three readably different designs, contrasts them in prose, recommends one, and offers the four-option pick.
- [ ] Run `/ba:brainstorm` against an idea that proposes a refactor to an existing module. Verify Phase 2 runs default mode silently — no announcement of trigger evaluation, no parallel dispatch.
- [ ] Pick `Hybrid` in the design-it-twice pick. Verify the follow-up `AskUserQuestion` collects free-text and that the resulting brainstorm doc's `## Locked Design > **Source:**` line quotes the user's wording verbatim.
- [ ] Pick `Design A` in the design-it-twice pick. Verify the brainstorm doc gains `## Locked Design` (sourcing Design A's 5 parts) and `## Rejected Designs` (with one-line summaries of Designs B and C).
- [ ] Run `/ba:brainstorm` again against the same brainstorm doc (single-shot test). Verify the dispatch is skipped because `## Locked Design` already exists, and Phase 3 notes the prior dispatch.
- [ ] Verify a deliberately-broken sub-agent prompt (e.g., constraint set to an unrecognized value) causes the failure-mode fallback: default-mode enumeration runs, and Phase 3 capture notes the fallback reason.
- [ ] Confirm `commands/ba/plan.md`, `commands/ba/slice.md`, `commands/ba/execute.md`, `commands/ba/review-plan.md`, `commands/ba/review.md`, `commands/ba/compound.md` are unmodified after the MR — Phase 5 is brainstorm-only.

## Dependencies & Risks

- **Risk: trigger criteria are mis-tuned and design-it-twice fires on refactors.** Mitigation: criteria are derived verbatim from brainstorm `:46-52`, validated against the DisplayNamesEditor retro. False positives cost one round of LLM time per trigger; not catastrophic. Re-tune via brainstorm if false-fire rate is high in practice.
- **Risk: three parallel sub-agents return semantically similar designs.** Mitigation: out of scope — declined as machinery in "What We're NOT Doing." If the constraints fail to force divergence in practice, that is signal for a constraint-set revision (a fresh brainstorm), not for collision-detection logic.
- **Risk: hybrid free-text capture is ambiguous to plan-time readers.** Mitigation: the user types prose; the brainstorm captures verbatim. Plan-time refinement happens within the lock's bounds — ambiguity is read by the human plan author, not by an enforcer. Acceptable for v1.
- **Risk: synthesis-lock is honor-system in plan/execute.** Mitigation: explicitly accepted (see "What We're NOT Doing"). Standing Discipline Rule + capture sections are Level-2 enforcement. Revisit if a real plan/execute session bolts a rejected piece back; that retro would justify a Level-3 enforcement gate.
- **Risk: agent file output drifts from the 5-part contract.** Mitigation: the dispatching command's failure-handling rule treats missing-section output as an error and falls back to default mode. The agent's "Important Rules" section repeats the contract; the Output Format section names the headers exactly. The contract enforcement sits in the dispatching command, not in a re-roll loop.
- **No external dependencies.** Pure documentation/agent additions. No new packages. No imports from `~/Programming/playground/agent_workflow_repos/skills/`. The `INTERFACE-DESIGN.md` reference in the agent body is a citation, not an import.

## Convention Compliance

- [x] **Filename format** (`docs/plans/YYYY-MM-DD-<type>-<descriptive-name>-plan.md`): aligned — `2026-05-09-feat-add-design-it-twice-mode-plan.md`.
- [x] **Frontmatter required fields** (`title`, `type`, `status`, `date`, `detail_level`, `tags`): aligned. `origin:` populated. `iteration_count: 0` present per the new convention introduced by the `plan-iteration-gate` plan.
- [x] **Agent naming — lowercase-with-hyphens** (`CLAUDE.md:62`): aligned — `interface-design-generator`.
- [x] **Agent naming — role suffix** (resolved by Edit 5b): the new `-generator` suffix is documented in `CLAUDE.md` as part of this MR. The agent file ships in the same change that establishes the suffix as convention. Brainstorm `:107` resolution path (b) — establish a new suffix and document it.
- [x] **Agent placement** (`agents/workflow/` for non-reviewer agents — brainstorm `:105`): aligned.
- [x] **Tool restriction** (`Read, Grep, Glob, LS`): aligned with `plan-iteration-gate` (verified: `agents/workflow/plan-iteration-gate.md:5` declares `tools: Read, Grep, Glob, LS`). The agent reads referenced code to ground its design but writes nothing — no Edit, no Write.
- [x] **Planning-commands-never-write-code rule** (`CLAUDE.md:65`): aligned — Phase 5 modifies `commands/ba/brainstorm.md` (a planning command) and adds a new agent that *generates* design alternatives in prose / pseudocode / signatures. No production code is written by either the command edits or the agent.
- [x] **Bump `.claude-plugin/plugin.json` version** (`CLAUDE.md:64`): aligned — `0.12.0` → `0.13.0`.
- [x] **Update `README.md` whenever agents are added** (`CLAUDE.md:71`): aligned — File 4 (verified: `README.md:178-196` is a markdown table with `| Agent | Purpose |` header; row appended immediately after the `plan-iteration-gate` row at `:196`).
- [x] **Convention-compliance check before writing planning artifacts** (`CLAUDE.md:67`): aligned — this Convention Compliance section satisfies the gate; convention-checker is dispatched before this plan is written to disk.
- [x] **No-runtime-dependency on skills repo** (parent roadmap `:39-44`; brainstorm `:82`): aligned — `INTERFACE-DESIGN.md` is cited as design reference in the agent body; no import, no invocation, no runtime dependency. The 5-part contract and constraint vocabulary are reimplemented in-tree.
- [x] **All built-in reviewers always appear as options in `/ba:review`** (`CLAUDE.md:70`): not applicable — `interface-design-generator` is a workflow agent, not a reviewer; Phase 5 does not modify `/ba:review` (brainstorm `:113`).
- [x] **Per-phase plan deliverables include README/CLAUDE.md/plugin.json bumps** (parent roadmap `:166`): aligned — Files 4, 5, 6.
- [x] **Brainstorm Acceptance Criteria parity** (brainstorm `:84-92`): aligned — every brainstorm acceptance criterion maps to a "Behaviors to Test" entry in this plan; the live-exercise criterion is captured in the Manual success criteria.
- [x] **Standing Discipline Rules self-check** (parent roadmap `:127-157`): aligned — declined every spec-flow-analyzer recommendation that proposed new machinery (timeout caps, collision detection, output-validation re-rolls, plan-side enforcement hook, frontmatter dispatch marker, override flags); preserved every brainstorm-binding decision verbatim. Plan body is well under the 600-line soft cap. One round of design dialogue (brainstorm + research + spec-flow-analyzer); no re-iteration ratchet.

## Sources & References

### Origin
- **Brainstorm:** `docs/brainstorms/2026-05-09-phase5-design-it-twice-brainstorm.md` — every binding decision (trigger criteria, constraint set, 5-part output contract, synthesis policy, single-shot rule, scope boundaries, deferred suffix question, deferred file-shape question) carried forward verbatim. Key decisions carried: conditional Phase 2 mode (not a new phase, not a new command); the 5-part per-agent contract; hybrid-allowed-at-pick-time-locked-thereafter; skip-silently when trigger does not fire; single-shot per brainstorm; agent file shape and suffix deferred to plan time (this plan resolves both).
- **Parent roadmap:** `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` — Phase 5 entry (`:106-118`); standing Discipline Rules referenced (`:127-157`); skills-repo runtime constraint (`:39-44`); per-phase deliverables include README/CLAUDE.md/plugin.json (`:166`).

### Internal references (pattern sources)
- **Parallel-dispatch precedent:** `commands/ba/research.md:55-87` — "Run ALL N agents in parallel" and "Wait for all sub-agents" idioms; bullet-list of `Task <agent>("...")` invocations.
- **Inline-Task dispatch idiom:** `commands/ba/brainstorm.md:122-127` (Phase 1.1 parallel research) and `commands/ba/plan.md:69-82` (Step 1 local research).
- **Multi-line `Task` prompt idiom:** `commands/ba/review.md:285-336` — multi-line prompt strings inside `Task <reviewer>("...")` calls.
- **Closest agent-shape template:** `agents/workflow/plan-iteration-gate.md:1-119` — frontmatter shape, `<examples>` block, "Inputs" + "Validation Checklist" + "Output Format" + "Important Rules" body structure.
- **`<examples>` block convention:** `agents/workflow/convention-checker.md:7-20`, `agents/workflow/spec-flow-analyzer.md:7-20`, `agents/workflow/plan-iteration-gate.md:8-21`.
- **AskUserQuestion 4-option pattern:** `commands/ba/brainstorm.md:243-254` (Phase 4 Handoff) — the closest UX precedent for the Phase 5 pick step.
- **Closest plan-shape template:** `docs/plans/2026-05-05-feat-add-plan-iteration-gate-plan.md` — six-file diff, single atomic MR, NEW/EDIT labeled file sections, automated/manual success-criteria split.

### External references (read-only design)
- `~/Programming/playground/agent_workflow_repos/skills/skills/engineering/improve-codebase-architecture/INTERFACE-DESIGN.md` — the 5-part output contract and the constraint vocabulary. Read as design reference per the parent roadmap's no-runtime-dependency rule. Not imported, not invoked.

### Validation references
- **DisplayNamesEditor retro:** `~/Programming/dragon/docs/learnings/2026-04-24-ba-tdd-retro-slice-4-displaynameseditor.md:33-39, 55-60` — concrete validation of the cost of skipping pre-commit interface-design dispatch.
- **Planning-YAGNI / confidence-chasing retro:** `~/Programming/dragon/docs/learnings/2026-04-23-planning-phase-yagni-and-confidence-chasing.md:121-122` — origin of the synthesis-lock rule (the design-alternative analog of "verifier finding answered with >20 lines of new plan → wrong direction").
- **YAGNI form-TDD violations:** `~/Programming/dragon/docs/solutions/tdd-workflow/2026-04-27-yagni-violations-form-tdd.md:22-24, 38-43, 139-145` — interface-shape patterns the constraint set is calibrated against (callback-vs-imperative, default-vs-edge-case parameters, info-hiding boundaries).
