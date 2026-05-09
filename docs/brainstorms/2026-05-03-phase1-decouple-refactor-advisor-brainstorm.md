---
date: 2026-05-03
topic: phase1-decouple-refactor-advisor
status: approved
triage_level: standard
tags: [ousterhout, refactor-advisor, deep-module-reviewer, ba-review, ba-tdd, phase-1]
---

# Phase 1: Decouple `refactor-advisor` into a Review Agent

> **Roadmap parent:** [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](2026-05-02-ousterhout-principles-roadmap-brainstorm.md)
>
> **Standing discipline rules:** This brainstorm is governed by the **Discipline Rules** section of the parent roadmap (lines 130–160). Red flags, stop points, and concrete rules apply to any iteration of this brainstorm or its downstream plan.

## What We're Building

The first and smallest phase of the Ousterhout principles roadmap: relocate the existing `refactor-advisor` agent from `agents/workflow/` to `agents/review/`, rename it `deep-module-reviewer`, and wire it into `/ba:review` as a sixth built-in reviewer. Simultaneously simplify `/ba:tdd` Step 3 to dispatch the renamed agent in **report-only inline** mode — drops the never-battle-tested per-finding apply/skip/done loop.

The motivation in one line: Ousterhout deep-module review is currently locked to `/ba:tdd` Step 3, which Bruno uses less often than `/ba:execute`. Decoupling makes the lens available wherever review happens, without changing the lens itself.

## Why This Approach

### Approaches Considered

1. **Single bundled MR (chosen)** — All Phase 1 changes in one atomic commit (~80–150 LoC across 7 files). Below `/ba:slice`'s 150-LoC threshold. No half-state where `/ba:review` lists six reviewers but one still emits non-canonical output.
2. **Two-MR split (plumbing then behavior)** — Rejected: ceremony for ~100 LoC. Phase 1 was deliberately scoped as the smallest phase to build the multi-phase pattern; splitting it works against that framing.
3. **Three-MR split** (rename / output reformat / Step 3 collapse) — Rejected: overkill at this size.

### Why Single Bundled Wins

- **Footprint is genuinely small.** 7 files, mostly mechanical (cross-reference updates, frontmatter normalization, table row addition). The substantive changes are localized: agent body and `/ba:tdd` Step 3.
- **Atomic delivery preserves invariants.** A six-reviewer `/ba:review` shouldn't briefly point at an agent emitting `Summary / Suggestions / No Suggestions` while the other five emit `Must Address / Consider / Looks Good`.
- **Roadmap intent.** Phase 1 was framed as "smallest scope, well-defined, builds the pattern." Splitting fights that framing.

## Key Decisions

- **`/ba:tdd` Step 3 becomes report-only inline.** Step 3a (announce/skip prompt) stays. Step 3b dispatches the renamed agent and prints findings inline. Steps 3c (apply/skip/done loop), 3d (apply & verify with auto-revert), and 3e (refactor commit) are removed. User refactors manually after reading the report if motivated.
- **Selective body refresh, not full rewrite.** Keep the existing five Ousterhout principles as the agent's `## What You Review` body. Selectively port framings from `skills/engineering/improve-codebase-architecture/DEEPENING.md` only where they sharpen specific lenses. **Read-as-reference, no runtime dependency.** No restructuring around the full DEEPENING framework — that would risk the planning ratchet the parent roadmap warns against.
- **Output format adopts the canonical review-agent shape.** `Must Address / Consider / Looks Good` replaces `Summary / Suggestions / No Suggestions`. Each finding uses the same `**[file_path:line_number]** — [issue]` template as the other five reviewers. Most deep-module findings will land in `Consider` — that's correct.
- **Frontmatter normalizes to review-agent canon.** `model: sonnet` (was `inherit`); drop `tools:` declaration entirely (review agents inherit defaults).
- **Add `<examples>` block.** Mirrors the other five review agents — shows `/ba:review` dispatch context (replacing the current `/ba:tdd`-coupled framing).
- **Static table addition, not dynamic discovery.** New row added to the static table at `commands/ba/review.md:200-210`. Matches the existing pattern; the discovery layer remains focused on external reviewers.
- **No backward-compat stub at the old path.** Internal plugin reorg, not public API. Update all 9 cross-reference lines mechanically; no alias.
- **Cosmetic update: "five" → "six".** Update review-count mentions at `commands/ba/review.md:210` and `:256-263`, plus the example commentary in all six review agents.
- **Version bump: 0.8.0 → 0.9.0.** Minor bump matches the framing "adds a sixth built-in reviewer + simplifies `/ba:tdd` Step 3." Coupled with the feature commit per recent precedent.

## Scope Boundaries

### In Scope

- Move `agents/workflow/refactor-advisor.md` → `agents/review/deep-module-reviewer.md`; rename `name:` field.
- Selective body refresh from DEEPENING.md framings; frontmatter normalize; output format reshape; add `<examples>` block.
- Add `deep-module-reviewer` row to `/ba:review` built-in table; update "five" → "six" wherever it appears (command file + agent example commentary).
- Collapse `/ba:tdd` Step 3 to report-only inline (3a + simplified 3b only).
- Update cross-references at: `commands/ba/tdd.md` (3 mentions), `commands/ba/review.md` (table + counts), `agents/workflow/tdd-cycle-gate.md:88`, `CLAUDE.md:48`, `README.md:150` & `:208`, `.claude-plugin/plugin.json` (version 0.8.0 → 0.9.0).
- All Phase 1 changes ship as one atomic MR.

### Out of Scope

- Phases 2–5 of the roadmap (each gets its own brainstorm + plan).
- Backward-compat alias at the old agent path.
- Importing/invoking from the skills repo at runtime (DEEPENING.md is read-once-as-reference during the rewrite, per the parent roadmap's standing constraint).
- Restructuring the agent body around the full DEEPENING framework.
- Any change to the other five review agents beyond cosmetic count updates.
- Saving the deep-module-reviewer report to disk during `/ba:tdd` (inline-only).

## Acceptance Criteria

- `agents/review/deep-module-reviewer.md` exists with `name: deep-module-reviewer`, `model: sonnet`, no `tools:` field, an `<examples>` block referencing `/ba:review` dispatch, and `Must Address / Consider / Looks Good` output sections.
- `agents/workflow/refactor-advisor.md` no longer exists.
- `commands/ba/review.md`'s built-in reviewer table contains six rows with `deep-module-reviewer` listed alongside the original five. Both the gate sentence at `:210` and the distribution table at `:256-263` say "six" rather than "five".
- `commands/ba/tdd.md` Step 3 contains only Steps 3a (announce/skip) and a simplified 3b (dispatch + print findings). 3c, 3d, 3e are absent. Total Step 3 LoC reduced by ~33.
- `agents/workflow/tdd-cycle-gate.md:88` references `deep-module-reviewer` instead of `refactor-advisor`.
- `CLAUDE.md` and `README.md` reference `deep-module-reviewer` in the agent list (and remove `refactor-advisor` from any place that listed it as a workflow agent).
- `.claude-plugin/plugin.json` version is `0.9.0`.
- The "one of five parallel built-in reviewers" example commentary in every review agent says "six" (or generalized).
- Single atomic commit/MR.

## Open Questions

None. All scope decisions resolved during this brainstorm.

## Convention Compliance

**Checked against `CLAUDE.md`, the brainstorm template (`commands/ba/brainstorm.md`), and the parent roadmap's Discipline section on 2026-05-03 by `convention-checker`.**

- **Filename format** (`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`): ALIGNED.
- **Frontmatter required fields** (`date`, `topic`, `status`, `triage_level`, `tags`): ALIGNED.
- **Agent naming** (`deep-module-reviewer` — lowercase-with-hyphens, `-reviewer` suffix): ALIGNED.
- **Agent placement** (`agents/review/`): ALIGNED.
- **Frontmatter normalization** (`model: sonnet`, drop `tools:`) matches review-agent canon: ALIGNED.
- **No-runtime-dependency on skills repo**: ALIGNED — DEEPENING.md framed explicitly as read-once-as-reference.
- **README.md / CLAUDE.md / plugin.json updates** (CLAUDE.md lines 64, 71): ALIGNED — Phase 1 enumerates all three.
- **No code in brainstorm**: ALIGNED.
- **Open Questions empty before handoff**: ALIGNED (none).
- **Acceptance Criteria measurability**: ALIGNED — file existence and content assertions are testable.
- **All built-in reviewers always appear as options in `/ba:review`** (CLAUDE.md line 73): ALIGNED — static table addition preserves the contract; the new reviewer becomes a permanent built-in.
- **Triage level `standard`**: ALIGNED — scope exceeds FAST-TRACK's ≤3-files threshold, no architectural impact.
- **Discipline-section reference** (parent roadmap line 132): ALIGNED — referenced explicitly in the front-matter callout above this section.
- **Discipline-section red-flag compliance**: ALIGNED on every check — no monotonic LoC growth (single bundle), no abstract vocabulary creep (file/line-concrete decisions), no >2-layer threading (none introduced), no verifier-finding-triggers-machinery (this phase actively *removes* machinery — Step 3c/d/e — with rationale taken from the parent roadmap's "not battle-tested at 3 uses" framing).

## Next Steps

→ Run `/ba:plan` to translate this brainstorm into an implementation plan. The plan should enumerate the 7 file edits as concrete steps in commit-execution order, with the agent move + frontmatter + output reshape grouped first (agent foundation), `/ba:review` table + `/ba:tdd` Step 3 collapse next (wiring), and metadata updates (CLAUDE.md, README.md, plugin.json, cosmetic count updates) last.
