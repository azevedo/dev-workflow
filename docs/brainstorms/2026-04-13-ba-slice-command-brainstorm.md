---
date: 2026-04-13
topic: ba-slice-command
status: approved
triage_level: full
tags: [ba-slice, execution, mr-splitting, delivery]
---

# ba:slice — Decompose Plans into MR-Sized Slices

## What We're Building

A new Planning Command (`ba:slice`) that reads an approved plan and decomposes it into self-contained, MR-sized slices of ≤150 LoC (excluding tests). Each slice represents one merge request's worth of work with clear scope, acceptance criteria, and dependencies on prior slices.

The command sits between `ba:plan` and `ba:execute` in the pipeline, making the full flow: **brainstorm → plan → slice → execute (per slice) → review (per slice)**. It is optional — small features that fit in a single MR skip it entirely.

This addresses three problems simultaneously:
- **Review quality**: Small, focused MRs get meaningful reviews (research shows effectiveness drops sharply above 200 LoC)
- **Execution reliability**: Fresh Claude context per slice avoids quality degradation in long sessions
- **Incremental delivery**: Each MR is independently mergeable and shippable

## Why This Approach

### Approaches Considered

1. **New ba:slice command (chosen)** — Separate command between plan and execute. Reads a plan, decomposes into slices, annotates the plan inline.
2. **Enhanced ba:plan with delivery mode** — ba:plan gains size awareness and produces sliced plans. Rejected: adds too much responsibility to an already complex command (534 lines), mixes "how to build" with "how to ship."
3. **Multi micro-plans** — A command decomposes one plan into N independent plan files. Rejected: overloads the "plan" abstraction, creates artifact management overhead, needs cross-plan dependency tracking.
4. **Post-execution splitting** — Execute everything, split commits into MRs after. Rejected: defeats the fresh-context goal and can't guarantee clean separation.

### Why ba:slice Wins

- **Single Responsibility**: ba:plan answers "how to build", ba:slice answers "how to ship"
- **Optional step**: Small features skip it. No overhead for simple changes.
- **Re-runnable**: If LoC estimates are off mid-execution, re-slice the remaining work with `--reslice`
- **Works with existing plans**: Can slice any plan, including old ones
- **Plan stays the authority**: Slices are a lens/filter over the plan, not a new authority. `--slice N` means "execute only the tasks within slice N's boundaries."

## Key Decisions

- **Command category**: Planning Command (research and document — never write code). ba:slice annotates a plan with delivery structure; it does not implement anything.
- **Artifact location**: Slices are annotated inline in the plan file using HTML comments and sections. One file, one source of truth. No separate manifest.
- **LoC targets**: 150 LoC target (excluding tests), 200 LoC warning threshold. Soft limit — warn and continue, because logical seams matter more than exact counts.
- **Dependency model**: Sequential (stacked) MRs by default. Slice N+1 depends on slice N. Independent when the feature naturally decomposes that way.
- **Execution UX**: After completing a slice, ba:execute auto-creates the branch and suggests starting a fresh session for the next slice. The user can continue in the same session if they prefer.
- **Plan authority preserved**: `--slice N` is a subset view of the same plan. The plan defines WHAT to build; slices define delivery order and boundaries. Checkboxes still track progress in the plan file.
- **LoC overflow handling**: When a slice exceeds 200 LoC during execution, warn and complete the slice (logical unit > exact count). Offer `--reslice` for remaining work.

## Scope Boundaries

### In Scope (V1)

- `ba:slice` command: reads a plan, decomposes into ≤150 LoC slices, annotates plan inline
- Plan frontmatter extensions: `sliced: true`, `slice_count: N`, `max_loc: 150`
- Inline slice markers: HTML comments with metadata (`<!-- slice:1 "name" depends:none est:80 -->`)
- `ba:execute --slice N`: execute one slice per invocation
- Fresh-context suggestion between slices
- Warn-and-continue at 200 LoC threshold
- `--reslice` flag to re-decompose remaining unfinished slices
- Pipeline chaining: ba:plan completion menu offers ba:slice as next step

### Out of Scope (V1) — Deferred to Roadmap

**Stacked MR management** — V1 creates sequential branches but does not manage rebases. When slice 1's branch is updated (e.g., review feedback), the user manually rebases slice 2's branch. V2 should auto-detect when a parent slice's branch has new commits and offer to rebase dependent slices. Consider integration with tools like Graphite or git-town for stacked PR workflows.

**ba:tdd integration** — V1 slicing only works with ba:execute. ba:tdd shares execution infrastructure (plan parsing, checkpoint tracking, commit discipline) but adds the red-green-refactor loop which needs per-behavior slice awareness. V2 should make ba:tdd slice-aware: each slice's behaviors are extracted, TDD loop runs per slice, same fresh-context suggestion applies. The slice marker format should be designed to not prevent this.

**Auto-MR creation** — V1 relies on the existing ba:execute completion menu for MR creation (or manual `gh pr create` / `glab mr create`). V2 should auto-create the MR after each slice completes, using the slice name as MR title and slice acceptance criteria as description. Should detect VCS platform and available MR skills (like `/mr`). Consider auto-populating "Depends on: !previous-mr" in the MR description.

**Real-time LoC counting during execution** — V1 trusts the slice boundaries from ba:slice. No real-time LoC tracking during implementation. V2 should count LoC as code is written and warn proactively when approaching the threshold (e.g., "You're at 140/150 LoC with 2 tasks remaining in this slice"). This requires hooking into the execution loop's file-write tracking.

**Parallel slice execution** — V1 executes slices sequentially. V3 could explore parallel execution of independent slices using worktrees, where slices with no dependency relationship are implemented concurrently by separate agents.

**Slice-aware ba:review** — V1 uses ba:review as-is on per-slice diffs. V2 could make ba:review aware of the slice context, showing reviewers how this slice fits into the larger plan and what depends on it.

## Acceptance Criteria

- ba:slice reads a plan file and annotates it with slice boundaries (inline HTML comments + sections)
- Each slice has: name, scope, estimated LoC, dependencies, acceptance criteria
- Slices target ≤150 LoC (excluding tests) with a 200 LoC warning threshold
- ba:execute accepts `--slice N` to execute a single slice
- After completing a slice, ba:execute suggests a fresh session for the next slice
- ba:execute warns (but continues) when a slice exceeds 200 LoC
- Plan frontmatter gains `sliced`, `slice_count`, and `max_loc` fields
- Pipeline chains correctly: ba:plan → ba:slice → ba:execute (per slice) → ba:review
- CLAUDE.md updated with ba:slice in Planning Commands section
- README.md updated with ba:slice in Commands section and how-to/flow documentation
- plugin.json version bumped

## Resolved Questions

- **Should splitting be part of ba:plan?** — No. Separate ba:slice command. Single responsibility: ba:plan answers "how to build", ba:slice answers "how to ship."
- **Is ba:execute the right tool for sliced execution?** — Yes, enhanced with `--slice N`. The plan remains the authority; slices are a lens.
- **Single plan or multi micro-plans?** — Single plan, annotated inline. Avoids artifact proliferation and keeps one source of truth.
- **Where do slices live?** — Inline in the plan file. HTML comments for metadata, sections for human readability.
- **What LoC target?** — 150 LoC target, 200 LoC warning. Research shows review effectiveness drops sharply above 200 LoC. 150 keeps us firmly in the high-quality zone.
- **Sequential or independent MRs?** — Sequential by default (stacked). Independent when the feature naturally decomposes that way.
- **What about LoC overflow?** — Warn and continue. Logical seams > exact counts. Offer `--reslice` for remaining work.
- **Command category?** — Planning Command. ba:slice documents delivery structure; it never writes code.
- **Does slicing change the plan's authority?** — No. Slices are a subset view of the same plan.

## Convention Compliance

**Checked against CLAUDE.md conventions on 2026-04-13.**

- **ba: prefix**: ALIGNED — command uses `ba:slice`
- **Agent naming**: NOT APPLICABLE — no new agents proposed
- **Artifact paths**: ALIGNED — slices live inline in existing plan files, no new artifact type
- **Command category**: ALIGNED — classified as Planning Command (never writes code)
- **Plan frontmatter extension**: JUSTIFIED OVERRIDE — new fields (`sliced`, `slice_count`, `max_loc`) are metadata additions consistent with how other commands add state to plans (e.g., `status: in-progress`). Does not conflict with existing frontmatter consumers.
- **CLAUDE.md update**: REQUIRED — add ba:slice to Planning Commands section
- **README.md update**: REQUIRED — add ba:slice to Commands section and update how-to/flow documentation
- **plugin.json version bump**: REQUIRED — bump on release
- **Plan authority preserved**: ALIGNED — `--slice N` is a lens, not a new authority

## Next Steps

→ `/ba:plan` to create implementation plan for ba:slice command and ba:execute enhancements
