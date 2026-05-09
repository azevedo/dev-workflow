---
date: 2026-05-02
topic: ousterhout-principles-roadmap
status: approved
triage_level: full
tags: [ousterhout, roadmap, refactor-advisor, complexity-reviewer, planning-discipline, ba-tdd, ba-execute, design-it-twice]
---

# Incorporate Ousterhout Principles More Broadly into dev-workflow

## What We're Building

A multi-phase, additive expansion of Ousterhout-flavored discipline across `dev-workflow`, beyond its current narrow surface (`refactor-advisor` dispatched only by `ba:tdd` Step 3b). Each phase ships independently and is followed by its own focused brainstorm + plan session — **this document is the roadmap, not an implementation plan**.

The motivation comes from five lived retros:

- ba-tdd-vs-ba-execute decision framework
- DisplayNamesEditor retro (ba-tdd retro slice 4)
- React TDD form mutation pitfalls
- YAGNI violations form-TDD
- Planning-YAGNI / confidence-chasing retro

The retros converge on three patterns: (1) Ousterhout's deep-module refactor phase pays when triggered, but is currently locked to `ba:tdd`; (2) `ba:tdd` is often miscast for slices that need execute-mode, suggesting routing logic is missing; (3) the planning phase itself ratchets toward over-engineering when confidence is treated as a target.

## Why This Approach

### Approaches Considered

1. **Multi-phase additive (chosen)** — Five phases, each shippable independently, ordered by (pain × confidence-it-works). Per-phase brainstorm + plan in their own sessions. Roadmap doc is the spine; each phase is a separate change.
2. **Single big rewrite** — Rejected: too large for one session, likely to relive the planning-YAGNI ratchet on the very work designed to prevent it.
3. **Defer indefinitely / status quo** — Rejected: the retros provide enough validation data to act now. `refactor-advisor` is locked to `ba:tdd`, which Bruno uses less than `ba:execute`; the deep-module pass is being skipped on the path he uses most.

### Why Multi-Phase Additive Wins

- **Compounding without lock-in.** Phases 1–2 build the "review agent" muscle that Phase 3's gate also needs. Phases 1–2 don't depend on Phase 3–5.
- **Each phase has small blast radius.** Phase 1 is the smallest, well-defined, builds the pattern. Failure or course-correction on any phase doesn't unwind earlier ones.
- **Brainstorm overhead is paid per phase, not all at once.** Avoids the planning-YAGNI ratchet that hit the TATO-2349 plan iteration session.

## Constraint: No Runtime Dependency on the Skills Repo

`dev-workflow` does not import, invoke, or reference any skill from the skills repo. That repo is a design **reference** (e.g., `INTERFACE-DESIGN.md` for Phase 5's parallel-sub-agent pattern; `DEEPENING.md` for Phase 1's deepening framings), but anything ported is rewritten in-tree as a `dev-workflow` agent or command.

This applies to every phase. The user-level skill `~/.claude/skills/assess-complexity/` (Phase 2's source) is user-installed, not skills-repo, so it is fine to read and port.

## Phases

### Phase 1 — Decouple `refactor-advisor` into a review agent

**Goal:** Make Ousterhout deep-module review available beyond `ba:tdd`.

**Scope hooks:**
- Move/rename `agents/workflow/refactor-advisor.md` → `agents/review/deep-module-reviewer.md`.
- Wire into `ba:review` as a peer of the existing five review agents.
- `ba:tdd` Step 3b dispatches the new `deep-module-reviewer` with the same report-only output as in `ba:review`. The prior interactive apply/skip/done loop is dropped — not battle-tested at 3 uses, and re-addable later if real usage demands it.
- During the rewrite, read `DEEPENING.md` in the skills repo as background; copy framings selectively if they sharpen the lenses.

**Why first:** smallest scope, well-defined, builds the pattern. Un-locks Ousterhout from TDD-only — directly addresses the gap where `ba:execute` (the path Bruno uses more) loses Ousterhout entirely.

**Risk:** very low.

### Phase 2 — Port `assess-complexity` as `complexity-reviewer`

**Goal:** Add cognitive-load / change-amplification / obscurity lenses to `ba:review`.

**Scope hooks:**
- New `agents/review/complexity-reviewer.md`.
- Lenses: cognitive load, change amplification, obscurity / unknown-unknowns. **3 lenses, narrowed from 4** because comment-quality is owned by the deferred `interface-comment-reviewer` candidate and Tidy First / YAGNI are already covered by `simplification-reviewer`.
- Standalone `~/.claude/skills/assess-complexity/` stays as backup until the ported agent is validated. After validation, decide whether to delete it or promote into a `dev-workflow` skill (no decision now).
- No discovery phase inside the agent itself — `ba:review` and `ba:review-plan` keep their existing skill-discovery passes for external repos.

**Why second:** same shape as Phase 1, compounds with it (both new review agents). Rounds out the review pipeline with the lenses Bruno already trusts.

**Risk:** low.

### Phase 3 — Plan-iteration discipline gate

**Goal:** Prevent the confidence-chasing ratchet documented in the 2026-04-23 planning-YAGNI retro.

**Scope hooks:**
- New agent (likely `agents/workflow/plan-iteration-gate.md`), modeled on `tdd-cycle-gate` — silent when clean, vocal on red-flag patterns.
- Watches for: monotonic LoC growth per confidence bump; abstract vocabulary appearing in a previously-concrete plan; threading >2 component layers without running code; plan exceeding a soft line cap; third mention of the same concern; verifier-finding-triggers-machinery.
- Possibly a hard cap on iterations (3–4 rounds, then default to "ship or delete").
- Brainstorm-iteration sibling **explicitly deferred** — Level-2 discipline via the standing Discipline section is sufficient until Level-3 automation is justified by evidence.

**Why third (despite being the worst documented pain):** highest-impact, medium-risk. Phases 1–2 are easy wins that build confidence in the multi-phase approach itself before tackling something harder. The silent-gate pattern is already established by `tdd-cycle-gate`, so Phase 3 reuses that shape rather than inventing it.

**Risk:** medium. UX needs care to avoid being annoying.

### Phase 4 — Retire `ba:tdd`; keep "Behaviors to Test" as a standalone artifact

**Goal:** Remove `ba:tdd` and `tdd-cycle-gate` from the plugin surface. Retain "Behaviors to Test" as a Kent C. Dodds-style testing-checklist artifact in plan templates.

**Outcome (settled by the Phase 4 brainstorm 2026-05-09):** The original (a)–(d) routing/merge menu is superseded by **option (e): retire `ba:tdd` entirely**. Empirical inspection of recent plans (notably the TATO-2349 default-leave-types plan Slice 4 — the well-cast TDD case) showed all of Bruno's plans carry destination code in detail. Routing presumes both modes have validated value; the data shows only one mode (execute) does. The roadmap's open question — *"Does the data justify the V2 merge now?"* — is answered with *"merge isn't the right framing; deletion is."*

**Brainstorm:** [`docs/brainstorms/2026-05-09-phase4-retire-ba-tdd-brainstorm.md`](2026-05-09-phase4-retire-ba-tdd-brainstorm.md).
**Plan:** [`docs/plans/2026-05-09-refactor-retire-ba-tdd-plan.md`](../plans/2026-05-09-refactor-retire-ba-tdd-plan.md).

**4a/4b sub-phase split dissolves.** No second mode to merge — retirement accomplishes the merge.

**`ba:execute` is unchanged in this phase.** No behavior-verification check is added now; whether and where verification logic eventually lives (most likely `ba:review`) is **TBD and out of scope** for Phase 4.

**Why fourth:** depends on Phase 3's discipline gate to avoid its own brainstorm ratcheting. Phase 3's gate caught the "verifier finding answered with >20 lines of new plan" pattern in real time during the brainstorm dialogue, supporting the retirement decision.

**Risk:** very low. This phase *removes* machinery rather than adding it — directly opposite of the verifier-finding-triggers-machinery anti-pattern.

### Phase 5 — Design-It-Twice as conditional sub-step in `ba:brainstorm`

**Goal:** Generate alternative interface shapes before committing, when brainstorm proposes a new module/interface.

**Scope hooks:**
- Sub-step inside `ba:brainstorm`, **not `ba:plan`** — alternatives are cheap before commitment, awkward after.
- Trigger condition: brainstorm introduces a new module or interface boundary. Skip silently for bug fixes, modifications, or refactors of existing interfaces.
- Pattern: 2–3 parallel sub-agents producing alternative designs, then user picks.
- Reimplement the parallel-sub-agent pattern from `INTERFACE-DESIGN.md` in the skills repo in-tree (no runtime dependency).
- **Resolved at plan time (2026-05-09):** the Phase 5 plan establishes `-generator` as a new `agents/workflow/` suffix and ships `interface-design-generator` as one parameterized agent (constraint passed as input) rather than three siblings. Suffix is documented in root `CLAUDE.md` "Conventions". See `docs/plans/2026-05-09-feat-add-design-it-twice-mode-plan.md`.

**Why last:** lowest pain, highest design-quality lift. Most appropriate to add when the plumbing (Phases 1–3) is in place and the routing question (Phase 4) is settled.

**Risk:** medium. Trigger condition is easy to mis-tune.

## Deferred Candidates

- **`interface-comment-reviewer` port** (post battle-testing). Currently a recent user-level agent at `~/.claude/agents/interface-comment-reviewer.md`. After several weeks of use, revisit: either as a new review agent (`agents/review/comment-reviewer.md`) or as a new lens inside `complexity-reviewer`.
- **Plan-size split** (roadmap line 234 — short decision-doc + per-slice mechanical briefs). Decide in Phase 4 brainstorm whether to absorb or keep separate.
- **Brainstorm-iteration discipline gate.** Sibling of Phase 3's plan-iteration gate. Deferred — discipline rules in the standing Discipline section below are Level-2 enforcement (manual + standing reference) and may be sufficient. Revisit if the ratchet recurs in brainstorm sessions despite the standing rules.
- **Full Ousterhout glossary enforcement** (à la `improve-codebase-architecture/LANGUAGE.md`). Out of scope unless vocabulary disagreement becomes a recurring review pain.

## Discipline Rules (Standing — referenced by every per-phase brainstorm)

Derived from the 2026-04-23 planning-YAGNI / confidence-chasing retro. **Every per-phase brainstorm in this roadmap must `@`-reference this section.** These rules apply to brainstorm and plan iteration in this roadmap's phases.

### Red flags (stop and reassess if any appear)

- Confidence climbing while LoC climbs (monotonic ratchet).
- Sub-agent finding triggering "build around it" instead of "drop the dependent feature".
- Surgical edits accumulating compound complexity (3-line diffs each, two new dependency-graph nodes overall).
- Abstract vocabulary creeping in ("orchestrator", "coordinator", "lifecycle boundary") in a previously-concrete plan.
- User language shifts ("we're working on the void", "this feels speculative", "do we actually need X?").
- Plan exceeds ~600–800 lines without a single commit.
- Rollback anxiety — reluctance to delete because "we spent time on it".

### Stop points

- Asked to push confidence past 80 → respond: "further confidence requires running code, not more plan."
- About to add a parameter / type / ref to address a theoretical failure mode → stop. Either it's real (write a test) or speculation (delete the mitigation).
- Verifier finding answered with >20 lines of new plan → wrong direction. Drop the dependent feature, accept the risk, or spike.
- Third mention of the same concern → ship a spike.
- Rollback of a plan section feels expensive → the plan is over-committed. That feeling is the bug.

### Concrete rules

- 3–4 iteration cap on brainstorm/plan rounds. Default to "let's write it" after round 4.
- No ref / context / param threading >2 component layers in a plan without running code to validate.
- Confidence >80 without running code is a ceiling, not a floor.
- One verifier round per plan version. Second round means implement, don't re-plan.
- Every plan iteration must either delete a section or produce a commit — no pure-additive rounds.
- If user questions necessity twice, the feature is cut — don't defend, delete.
- Plan documents cap at ~600 lines; beyond that, split into shipped milestones.
- **Synthesis lock at brainstorm capture.** Hybrid alternatives are locked at brainstorm capture; no bolting rejected pieces back during plan/execute. The brainstorm's `## Locked Design` and `## Rejected Designs` sections (when present) define the bound; refinement inside the lock is fine, re-adding rejected pieces is the synthesis-creep ratchet that this rule names. Origin: Phase 5 brainstorm `docs/brainstorms/2026-05-09-phase5-design-it-twice-brainstorm.md`.

## Scope Boundaries

### In Scope

- Phases 1–5 as outlined, each as its own brainstorm + plan + execute cycle.
- Standing discipline rules referenced by all per-phase brainstorms.
- A thin GH issue tracking phase status (links to this brainstorm and per-phase artifacts).
- Each per-phase plan updates `README.md`, `CLAUDE.md` (root), and bumps `.claude-plugin/plugin.json` version when shipping.

### Out of Scope

- Building the brainstorm-iteration discipline gate (deferred — Level-2 enforcement via this doc).
- Porting `interface-comment-reviewer` (deferred until battle-tested).
- Full Ousterhout vocabulary enforcement (deferred — no observed pain).
- Importing or invoking skills from the skills repo (constraint).
- Plan-size split (deferred to Phase 4 brainstorm decision).

## Acceptance Criteria

- This brainstorm doc exists at `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`.
- Doc captures all five phases with scope hooks, deferred candidates, discipline rules.
- A GH issue is opened (post-approval) linking to this doc with a phase checklist.
- Per-phase brainstorms (Phase 1 onward) cite this doc as the roadmap source of truth and the Discipline section as standing rules.
- Phase status is tracked in the GH issue, updated when each phase's MR ships.

## Open Questions

None blocking this brainstorm. Per-phase deferred decisions are documented inline within each phase's scope hooks (notably Phase 4's merge-or-not, plan-size split absorption, and Phase 5's trigger-condition reliability).

## Convention Compliance

**Checked against `CLAUDE.md` and the brainstorm template on 2026-05-02.**

- **Frontmatter shape**: ALIGNED — `date`, `topic` (kebab-case), `status`, `triage_level`, `tags`.
- **Filename**: ALIGNED — `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`.
- **No code in brainstorm**: ALIGNED — planning-command rule honored.
- **Agent naming (`deep-module-reviewer`, `complexity-reviewer`, `plan-iteration-gate`)**: ALIGNED — lowercase-with-hyphens, suffixes match existing precedent (`-reviewer` in `agents/review/`, `-gate` in `agents/workflow/`).
- **Agent placement**: ALIGNED — `agents/review/` for reviewers, `agents/workflow/` for gates/advisors.
- **No-runtime-dependency on skills repo**: ALIGNED — references are read-as-design only; user-level `~/.claude/skills/assess-complexity/` correctly distinguished.
- **README.md / CLAUDE.md / `plugin.json` updates** (CLAUDE.md lines 64, 71): RESOLVED — added bullet to In Scope: "Each per-phase plan updates `README.md`, `CLAUDE.md` (root), and bumps `.claude-plugin/plugin.json` version when shipping." Each phase carries the deliverable in its own plan.
- **Open Questions empty-before-handoff** (brainstorm template HARD GATE): JUSTIFIED OVERRIDE — this roadmap doc has no direct `/ba:plan` handoff; each phase will get its own brainstorm whose Open Questions section will be empty at its own handoff. Per-phase deferred decisions are documented inline within phase scope hooks, not as blocking open questions for this doc.
- **Acceptance Criteria measurability**: NOT APPLICABLE — meta-doc; criteria are scoped to the doc's existence and the phase-tracking contract, not to a single feature.
- **Standard "Key Decisions" flat list**: NOT APPLICABLE — decisions encoded in per-phase scope hooks (rationale embedded with each phase) rather than a separate list. Underlying convention (decisions documented with rationale) is satisfied throughout.

## Next Steps

1. Approve this brainstorm.
2. Open a thin GH issue tracking the five phases (link to this doc).
3. Run `/ba:brainstorm` for Phase 1 (decouple `refactor-advisor`).
4. Each subsequent phase: `/ba:brainstorm` → `/ba:plan` → `/ba:slice` (if ≥150 LoC) → `/ba:execute` or `/ba:tdd` → `/ba:review`.
