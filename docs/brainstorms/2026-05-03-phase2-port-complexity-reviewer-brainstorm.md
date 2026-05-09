---
date: 2026-05-03
topic: phase2-port-complexity-reviewer
status: approved
triage_level: standard
tags: [ousterhout, assess-complexity, complexity-reviewer, ba-review, phase-2]
---

# Phase 2: Port `assess-complexity` as `complexity-reviewer`

> **Roadmap parent:** [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](2026-05-02-ousterhout-principles-roadmap-brainstorm.md)
>
> **Standing discipline rules:** This brainstorm is governed by the **Discipline Rules** section of the parent roadmap (lines 130–160). Red flags, stop points, and concrete rules apply to any iteration of this brainstorm or its downstream plan.

## What We're Building

The second phase of the Ousterhout principles roadmap: a new `agents/review/complexity-reviewer.md` agent organized around Ousterhout's three complexity manifestations — **cognitive load**, **change amplification**, and **obscurity / unknown-unknowns** — wired into `/ba:review` as a seventh built-in reviewer alongside the six shipped in Phase 1.

The agent is a focused rewrite, not a verbatim port: it draws content from `~/.claude/skills/assess-complexity/SKILL.md` (the user-installed source skill, outside the skills-repo constraint), but narrows the source's three-framework treatment (Ousterhout + Beck + Dodds) down to Ousterhout's three manifestations as the spine, with two non-overlapping Dodds salvages folded in. The standalone source skill stays as backup; no decision yet on deletion or promotion.

## Why This Approach

### Approaches Considered

1. **Single bundled MR (chosen)** — All Phase 2 changes in one atomic commit (~120–180 LoC across ~10 files). New agent + `/ba:review` table row + cosmetic "six → seven" updates. Below `/ba:slice`'s 150-LoC threshold or just over; either way no half-state where the table lists seven but the gate sentence still says "six".
2. **Two-MR split (agent first, wiring second)** — Rejected: same ceremony argument as Phase 1. The wiring is mechanical and atomicity-preserving.
3. **Three-MR split** (agent / wiring / count-cosmetics) — Rejected: overkill for ~150 LoC, ratchet risk.

### Why Single Bundled Wins

- **Footprint matches Phase 1.** Same shape (one new agent + one table row + count cosmetics + metadata bump). Phase 1 shipped at this size cleanly; replicating the pattern is the lowest-risk choice.
- **Atomic delivery preserves invariants.** A seven-row table with a gate sentence saying "six" is incoherent; same logic as Phase 1.
- **Roadmap intent.** Phase 2 was framed as "same shape as Phase 1, compounds with it." Splitting fights that framing.

## Key Decisions

- **Three lenses, organized around Ousterhout's complexity manifestations.** `## What You Review` is structured as exactly three top-level lenses:
  - **Cognitive load**: how much a developer must hold in their head to understand or modify the code.
  - **Change amplification**: a simple change requires modifications in many places.
  - **Obscurity / unknown-unknowns**: vital information is hidden or non-obvious; readers can't tell what they need to know to make a change safely.
- **Two non-overlapping Dodds salvages folded in.** From the source skill's Dodds section:
  - **Simplicity vs Familiarity** ("genuinely simple or just familiar?") folds into the cognitive-load lens — orthogonal to anything other reviewers cover.
  - **Explicit vs Implicit** ("behavior obvious, or hidden behind magic?") folds into the obscurity lens — distinct from `deep-module-reviewer`'s interface-depth focus.
  No new top-level lens introduced; both salvages appear as sub-bullets under their parent lens.
- **Source-skill content explicitly dropped.** The Phase 2 agent does NOT reproduce:
  - The source skill's **Module Depth Assessment** section — covered by `deep-module-reviewer` (Phase 1).
  - The source skill's **Strategic vs Tactical** section — overlaps with `simplification-reviewer` (YAGNI) and `architecture-reviewer` (patterns).
  - The full **Beck "Tidy First?"** framework (coupling/cohesion/tidying/economics) — coupling/cohesion are covered by `architecture-reviewer`; tidying/dead-code/YAGNI by `simplification-reviewer`; Beck's "comments-that-should-be-code" angle is **currently unowned** — `interface-comment-reviewer` (today user-level only) scopes to JSDoc / docstring leaks on **exported symbols** (interface-vs-implementation separation), not the general Beck framing of "if a comment restates the code, the code should be clearer." The parent roadmap defers broader comment-quality coverage to a possible future port (line 125): either as a new `agents/review/comment-reviewer.md` or as a lens inside `complexity-reviewer`. Phase 2 does **not** claim this territory — flagging it explicitly so the deferred port's scope question stays honest.
  - Most of the **Dodds Epic Web** content (Composition over Inheritance, Right Tool, Pragmatism, Fail Fast, Debugging Experience, Testing Alignment) — covered by `architecture-reviewer`, `error-handling-reviewer`, and `test-coverage-reviewer`.
- **No discovery phase inside the agent.** The source skill has a "Phase 1: Initial Code Discovery & Context" step that uses Glob/Grep/Read to locate the scope. The new agent receives the diff context from `/ba:review`'s dispatcher and reads files directly — same as the other six review agents. Discovery for external skills remains owned by `/ba:review` and `/ba:review-plan`.
- **Output format adopts the canonical review-agent shape.** `Must Address / Consider / Looks Good` with `**[file_path:line_number]** — [issue description]. [Why this matters for complexity]. Suggested fix:` bullets. Each bullet tagged with the relevant lens (`cognitive load` / `change amplification` / `obscurity`) inline in the description. Replaces the source skill's heavy 5-section report (Executive Summary / Detailed Findings / Prioritized Recommendations / Tidying Sequence / Long-term Architecture Notes), which is incompatible with `/ba:review`'s consolidation step.
- **Frontmatter matches review-agent canon.** `name: complexity-reviewer`, single-sentence `description:` ending "Use as a built-in reviewer in /ba:review.", `model: sonnet`, no `tools:` declaration.
- **`<examples>` block added.** Mirrors the other six review agents — shows `/ba:review` dispatch context with one example.
- **`/ba:review` only — not `/ba:tdd` Step 3.** Cognitive load, change amplification, and obscurity are properties of accumulated code structure, not the small post-green refactor window. `deep-module-reviewer` fits Step 3b because shallow modules are something you can rework on the spot; complexity manifestations need broader context. Defers `/ba:tdd` integration as a possible Phase 2.5 if review-time usage validates that the lenses fire on cycle-sized diffs.
- **Static table addition, not dynamic discovery.** New row added to `commands/ba/review.md:200-210`. Matches Phase 1's pattern.
- **Cosmetic update: "six" → "seven".** Update `commands/ba/review.md:200` & `:211`, `README.md:156` & `:168` (and the bullet enumeration of reviewers), and the example commentary inside every review agent's `<examples>` block (currently says "six parallel built-in reviewers").
- **Standalone skill stays as backup.** `~/.claude/skills/assess-complexity/SKILL.md` is not modified, deleted, or referenced by the new agent. Decision deferred — revisit after the ported agent has been used in `/ba:review` enough times to validate the narrowing.
- **Version bump: 0.9.0 → 0.10.0.** Matches the framing "adds a seventh built-in reviewer." Coupled with the feature commit per the established precedent.

## Scope Boundaries

### In Scope

- New `agents/review/complexity-reviewer.md` with the three-lens body, two Dodds salvages folded in, canonical output format, `<examples>` block, and review-agent-canon frontmatter.
- Add `complexity-reviewer` row to `/ba:review` built-in reviewer table at `commands/ba/review.md:200-210`.
- Update "six" → "seven" wherever it appears: `commands/ba/review.md:200` & `:211`, `README.md:156` & `:168`, and the example commentary inside all seven review agents' `<examples>` blocks.
- Add `complexity-reviewer` to the agent enumeration in `CLAUDE.md` (under the review-agent list).
- Bump `.claude-plugin/plugin.json` version 0.9.0 → 0.10.0.
- Single atomic MR.

### Out of Scope

- Phases 3–5 of the roadmap (each gets its own brainstorm + plan).
- Modifying, deleting, or promoting `~/.claude/skills/assess-complexity/SKILL.md` (deferred decision per parent roadmap).
- Adding `complexity-reviewer` to `/ba:tdd` Step 3 (deferred — review-only for Phase 2).
- Importing/invoking from the skills repo at runtime (parent-roadmap constraint).
- Reproducing the source skill's discovery phase, heavy 5-section report, Beck framework, or non-salvaged Dodds content (each explicitly dropped above with rationale).
- Any change to the other six review agents beyond the cosmetic "six → seven" example-commentary update.
- A "Module Depth Assessment" section in the new agent — that's `deep-module-reviewer`'s territory (Phase 1).

## Acceptance Criteria

- `agents/review/complexity-reviewer.md` exists with `name: complexity-reviewer`, `model: sonnet`, no `tools:` field, an `<examples>` block referencing `/ba:review` dispatch, `## What You Review` containing exactly three top-level lenses (cognitive load, change amplification, obscurity / unknown-unknowns), and `## Output Format` containing `Must Address` / `Consider` / `Looks Good`.
- The cognitive-load lens body includes a "simplicity vs familiarity" sub-bullet; the obscurity lens body includes an "explicit vs implicit / hidden behind magic" sub-bullet. No "Module Depth", "Strategic vs Tactical", "Coupling/Cohesion", or "Composition over Inheritance" subsections appear.
- `commands/ba/review.md`'s built-in reviewer table contains seven rows with `complexity-reviewer` listed alongside the six from Phase 1. The gate sentence at `:211` says "seven" rather than "six". The list-introducing sentence at `:200` says "seven".
- `README.md:156` and `:168` say "seven built-in reviewers" / list `complexity-reviewer` alongside the six existing reviewers.
- `CLAUDE.md` agent enumeration lists `complexity-reviewer` with a one-line description matching the convention used for the other six review agents.
- The "one of six parallel built-in reviewers" example commentary in every review agent's `<examples>` block says "seven" (or generalized).
- `.claude-plugin/plugin.json` version is `0.10.0`.
- Single atomic commit/MR.
- `~/.claude/skills/assess-complexity/SKILL.md` is unchanged.

## Open Questions

None. All scope decisions resolved during this brainstorm.

### Resolved Questions

- **Q: Pure-Ousterhout, Ousterhout + salvage, or all three frameworks?** → Ousterhout + salvage non-overlapping Dodds bits (Simplicity vs Familiarity, Explicit vs Implicit) as sub-bullets under the parent lenses. Beck dropped entirely.
- **Q: Heavy 5-section report or peer-reviewer 3-bucket format?** → Peer-reviewer canon (`Must Address / Consider / Looks Good`).
- **Q: Wire into `/ba:tdd` Step 3a alongside `deep-module-reviewer`?** → No, `/ba:review` only for Phase 2. Possible later phase if review-time usage justifies it.

## Convention Compliance

**Checked against `CLAUDE.md`, the brainstorm template (`commands/ba/brainstorm.md`), and the parent roadmap's Discipline section on 2026-05-03 by `convention-checker`.**

- **Filename format** (`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`): ALIGNED.
- **Frontmatter required fields** (`date`, `topic`, `status`, `triage_level`, `tags`): ALIGNED.
- **Agent naming** (`complexity-reviewer` — lowercase-with-hyphens, `-reviewer` suffix): ALIGNED.
- **Agent placement** (`agents/review/`): ALIGNED.
- **Frontmatter normalization** (`model: sonnet`, no `tools:`) matches review-agent canon: ALIGNED.
- **No-runtime-dependency on skills repo**: ALIGNED — `~/.claude/skills/assess-complexity/` is user-installed (not skills-repo); the skills repo is explicitly out of scope.
- **README.md / CLAUDE.md / plugin.json updates** (CLAUDE.md lines 64, 71): ALIGNED — Phase 2 enumerates all three (README.md:156 & :168, CLAUDE.md agent list, plugin.json 0.9.0 → 0.10.0).
- **No code in brainstorm**: ALIGNED.
- **Open Questions empty before handoff**: ALIGNED (none — three resolved questions captured).
- **Acceptance Criteria measurability**: ALIGNED — file existence, content, and numeric assertions.
- **All built-in reviewers always appear as options in `/ba:review`** (CLAUDE.md line 73-74): ALIGNED — static table addition makes `complexity-reviewer` a permanent built-in alongside the existing six.
- **Triage level `standard`**: ALIGNED — exceeds FAST-TRACK's ≤3-files threshold (~10 files), follows established Phase 1 precedent, no architectural decisions, no security/payments/external-API surface.
- **Discipline-section reference** (parent roadmap line 132): ALIGNED — referenced explicitly in the front-matter callout above this section.
- **Discipline-section red-flag compliance**: ALIGNED on every check — no monotonic LoC growth (single bundle, footprint matches Phase 1), no abstract vocabulary creep (file/line-concrete decisions; lens names taken verbatim from Ousterhout), no >2-layer threading (none introduced), no verifier-finding-triggers-machinery (this phase actively *drops* the source skill's discovery phase, 5-section report, Beck framework, and non-salvaged Dodds content with explicit "covered by X reviewer" rationale; two Dodds salvages folded as sub-bullets, not new lenses).

## Next Steps

→ Run `/ba:plan` to translate this brainstorm into an implementation plan. The plan should enumerate the file edits in commit-execution order: agent body first (foundation), `/ba:review` table addition next (wiring), then the cosmetic "six → seven" updates across review-agent example blocks and `README.md`, and metadata last (`CLAUDE.md`, `plugin.json`).
