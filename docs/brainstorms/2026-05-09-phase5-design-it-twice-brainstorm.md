---
date: 2026-05-09
topic: phase5-design-it-twice
status: approved
triage_level: full
tags: [phase-5, ba-brainstorm, design-it-twice, parallel-sub-agents, ousterhout-roadmap, interface-design]
---

# Phase 5 — Design-It-Twice as Conditional Phase 2 Mode in `ba:brainstorm`

> **Roadmap parent:** [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](2026-05-02-ousterhout-principles-roadmap-brainstorm.md)
>
> **Standing discipline rules:** This brainstorm is governed by the **Discipline Rules** section of the parent roadmap (lines 127–158). Synthesis-creep — bolting rejected pieces back onto a chosen design after Phase 3 capture — is the design-alternative analog of the rule "verifier finding answered with new plan/machinery instead of removal." A new rule extending that section is in scope for this phase (see In Scope, below).

## What We're Building

Upgrade Phase 2 (Explore Approaches) of `ba:brainstorm` with a conditional **parallel-sub-agent mode**. When the brainstorm is proposing a new module / interface / public API surface, Phase 2 dispatches three sub-agents in parallel — each constrained to a different Ousterhout-flavored design pressure — to generate alternative interface shapes. The user picks (with explicit hybrid allowed at pick time, locked thereafter). When the trigger doesn't fire (refactors, modifications, bug fixes), Phase 2 runs as today.

This is an **upgrade**, not an addition. Phase 2 already proposes 2-3 approaches with pros/cons and a recommendation. The upgrade swaps the single-LLM enumeration for parallel sub-agent dispatch when commitment is cheap (no callers yet) and the design choice is structural (interface shape, not implementation tactic).

## Why This Approach

### Approaches Considered

1. **Conditional Phase 2 mode with three Ousterhout-flavored sub-agents (chosen).** Phase 2 today already serves the purpose; replacing rather than duplicating keeps the surface flat. Three constraints — *deepest module* / *optimize common case* / *maximize information hiding* — anchor to the principles this roadmap is about and force genuine divergence rather than three flavors of the same idea.

2. **New Phase 2.5 sub-step after approach pick.** Rejected: creates a two-tier pick (strategy first, then interface shape) that overlaps with Phase 2's existing recommendation flow and adds a new phase number without earning it.

3. **Sub-step inside Phase 2 (2a + 2b).** Rejected: similar duplication concern. Phase 2 already does approach enumeration; turning it into approach + interface as nested steps blurs the role of Phase 2.

4. **Reference pattern verbatim (minimize / maximize-flexibility / common-case).** Rejected for the constraint set in favor of Ousterhout-flavored constraints because the roadmap is explicitly about deepening Ousterhout discipline. "Maximize flexibility" tends to surface YAGNI-violating designs; "deepest module" forces the discipline this plugin is trying to install.

5. **User-explicit invocation only.** Rejected: Bruno already short-circuits Phase 2's existing N-approaches generation in practice; an opt-in command would inherit that skip rate. The retros provide enough validation to fire automatically when criteria match.

6. **Aggressive default with skip option.** Rejected: friction in the common case where the brainstorm isn't proposing a new boundary (most STANDARD-triage brainstorms). Trigger-driven activation is the right default.

### Why Conditional Phase 2 Mode Wins

- **Reuses the existing flow.** AskUserQuestion to pick, recommendation framing, and Phase 3 capture all stay identical. Only the *generator* of alternatives changes.
- **Trigger-gated cost.** The expensive step (parallel dispatch) only happens when it has design-quality lift. Refactors and bug fixes pay zero overhead.
- **Concrete validation from prior retro.** The DisplayNamesEditor retro shows the cost of skipping this step on real work: an imperative-handle interface born of a lint workaround calcified into ~15 minutes of conflict-resolution overhead, where a pre-commit "imperative vs callback vs controlled" sub-agent triplet would have surfaced the simpler shape before it locked in.

## Key Decisions

- **Integration:** Conditional mode inside `ba:brainstorm` Phase 2 (Explore Approaches). Not a new phase, not a new command. Trigger gates which mode of Phase 2 runs.
- **Trigger:** LLM-judged with five explicit criteria. Fires when ANY of:
  - new file/directory/module being proposed,
  - new exported function/class/component,
  - new public interface or API surface,
  - new agent / command / skill,
  - new public type that callers depend on.
  Does NOT fire for: modifications to existing modules, bug fixes, parameter additions, internals, refactors that preserve external shape.
- **Constraint set (3 sub-agents):**
  - **Agent A — "Deepest module":** smallest interface, most hidden behind it; 1-3 entry points max.
  - **Agent B — "Optimize common case":** the default path is trivial; caller writes minimum; edge cases possible but pay extra cost.
  - **Agent C — "Maximize information hiding":** hide implementation choices most likely to change; stability of the seam wins.
- **Per-agent output contract (5 parts, sourced from `INTERFACE-DESIGN.md` as design reference):** Interface (entry points + signatures + invariants/ordering/error modes); Usage example (most common caller); What's hidden behind the seam; Dependency strategy; Trade-offs.
- **Synthesis policy:** Hybrid allowed at pick time, locked after Phase 3 capture. User may pick "A's interface but B's error model"; brainstorm captures the explicit hybrid as THE chosen design. Plan/execute may refine, but cannot re-add rejected pieces from A/B/C.
- **Single-shot per brainstorm:** one design-it-twice dispatch per brainstorm session. If the user wants another round, that's a fresh brainstorm — keeps the roadmap's iteration cap honest.
- **Skip silently** when the trigger doesn't fire — no announcement. Matches the parent roadmap's explicit instruction and the existing iteration-gate UX.
- **Recommendation framing.** Brainstorm presents alternatives sequentially, contrasts on depth / locality / seam placement / who pays the trade-offs, then **leads with a recommendation**. "Be opinionated — strong read, not a menu" (carried over from existing Phase 2).
- **No runtime dependency on the skills repo.** The 5-part output contract and constraint vocabulary are reimplemented in-tree. `INTERFACE-DESIGN.md` is read as design reference only (consistent with the roadmap's standing constraint).
- **Agent file shape and naming deferred to plan.** Whether Phase 5 ships one agent that takes a constraint as input or three separate agent files (one per constraint) is a coupled decision with the `agents/workflow/` suffix question (no `-designer`/`-generator` precedent exists today). Both questions resolve together at plan time.

## Scope Boundaries

### In Scope

- Adding the conditional parallel-sub-agent mode to `ba:brainstorm` Phase 2.
- A new sub-agent (or sub-agents) under `agents/workflow/` capturing the constraint-driven design-generation pattern. Exact filename, shape, and suffix decided in the plan.
- Trigger criteria documented inline in `commands/ba/brainstorm.md`.
- Updates to `README.md`, `CLAUDE.md` (root), and a version bump in `.claude-plugin/plugin.json`.
- A new discipline rule in the standing roadmap Discipline section: **"Hybrid alternatives are locked at brainstorm capture; no bolting rejected pieces back during plan/execute."** The parent roadmap is updated atomically with this phase so other phases see the rule.

### Out of Scope

- A `ba:plan`-side equivalent. Phase 5 is brainstorm-only; alternatives are cheap before commitment, awkward after.
- Re-firing the alternative dispatch within a single brainstorm session.
- Trigger detection for FAST-TRACK paths. FAST-TRACK by definition excludes new patterns / architectural impact (Phase 0 Q3, Q4 in `ba:brainstorm`); the trigger cannot reach a FAST-TRACK brainstorm.
- Free synthesis throughout brainstorm/plan/execute (rejected explicitly — synthesis-creep risk).
- Porting `interface-comment-reviewer` (deferred candidate per parent roadmap).
- Importing or invoking skills from the skills repo (standing constraint).

## Acceptance Criteria

- `commands/ba/brainstorm.md` Phase 2 has a conditional sub-flow describing the trigger, the parallel-dispatch pattern, the per-agent output contract, and the synthesis policy.
- The new sub-agent file(s) under `agents/workflow/` conform to plugin agent conventions (frontmatter, examples block, output format) and use a suffix decided at plan time.
- `README.md` lists the new agent.
- The parent roadmap's standing Discipline section is amended with the synthesis-lock rule, in the same change that ships Phase 5.
- The `ba:brainstorm` doc instructs the model to skip the dispatch silently when the trigger criteria don't match.
- `.claude-plugin/plugin.json` version bumped.
- A live exercise on a real new-module brainstorm (likely a future per-phase brainstorm or a domain feature) confirms: (a) trigger fires when expected, (b) outputs are readably different, (c) hybrid pick captures cleanly into the brainstorm doc.

## Open Questions

None blocking handoff to `/ba:plan`. Implementation-level questions — one agent file with a constraint parameter vs. three separate files; the resolved `-designer` / `-generator` / other suffix question; exact prompt phrasing per constraint; whether the trigger criteria appear in `brainstorm.md` as a bullet list or prose — are plan-time decisions, not brainstorm-blocking.

## Convention Compliance

**Checked against `CLAUDE.md`, the brainstorm template, and the parent roadmap on 2026-05-09 by `convention-checker`.**

- **Filename pattern** (`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`): ALIGNED.
- **YAML frontmatter shape** (`date`, `topic` kebab-case, `status`, `triage_level`, `tags`): ALIGNED.
- **Triage level documented**: ALIGNED — `full`.
- **Agent placement (`agents/workflow/` for non-reviewer agents)**: ALIGNED — generator-style agent belongs alongside `convention-checker`, `spec-flow-analyzer`, `plan-iteration-gate`. `agents/review/` is reserved for the review pipeline.
- **Agent name lowercase-with-hyphens**: WILL BE ALIGNED — exact name deferred to plan.
- **Agent suffix matches existing precedent (`-checker`, `-gate`, `-analyzer` in `agents/workflow/`)**: RESOLVED BY DEFERRAL — no `-designer`/`-generator` precedent exists today. The plan resolves the suffix question (either pick a precedent-fitting name, establish a new suffix and document it in the parent roadmap and root `CLAUDE.md`, or merge to one of the existing suffixes by reframing the agent's role). Brainstorm does not commit a name now.
- **Planning commands must never write code**: ALIGNED — no implementation code; only WHAT-level decisions on integration, trigger, constraints, output contract, synthesis policy.
- **Open Questions empty-before-handoff hard gate**: ALIGNED — section contains only deferred-to-plan items, none of which block `/ba:plan`.
- **Parent-roadmap citation requirement** (parent roadmap line 129): ALIGNED — roadmap parent and Discipline Rules section linked at the top of this doc.
- **Per-phase plan deliverables include README/CLAUDE.md/plugin.json bumps** (parent roadmap line 166): ALIGNED — all three listed in In Scope.
- **No runtime dependency on the skills repo** (parent roadmap lines 39-44): ALIGNED — `INTERFACE-DESIGN.md` referenced as design reference only; pattern reimplemented in-tree.
- **Built-in reviewer always-shown rule**: NOT APPLICABLE — Phase 5 does not modify `/ba:review`.

## Next Steps

→ `/ba:plan` to create the implementation plan for Phase 5.
