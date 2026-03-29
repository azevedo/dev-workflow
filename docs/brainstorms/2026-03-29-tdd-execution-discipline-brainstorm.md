---
date: 2026-03-29
topic: tdd-execution-discipline
status: approved
triage_level: standard
tags: [tdd, execute, testing, refactoring, ousterhout, deep-modules]
---

# TDD as Core Execution Discipline

## What We're Building

A test-driven development execution workflow integrated into the dev-workflow plugin. Instead of the current "implement then test" approach in `/ba:execute`, a new `/ba:tdd` command enforces vertical-slice tracer bullets: one failing test, one minimal implementation, repeat. After all behaviors are green, a dedicated refactor phase applies Ousterhout's deep-module principles as active guidance rather than post-hoc review feedback.

This brings together Matt Pocock's TDD skill methodology and the user's existing Ousterhout principles skill into a first-class execution discipline.

## Why This Approach

### Approaches considered

1. **Default TDD in `/ba:execute` with opt-out** — TDD becomes the default execution loop. Plans can opt out with `execution_style: direct`. Pros: TDD becomes culture. Cons: adds ceremony to simple tasks, needs escape hatch anyway (opt-in in reverse).

2. **Opt-in per plan (`execution_style: tdd`)** — Plans declare TDD in frontmatter; `/ba:execute` detects and switches mode. Pros: plan stays the authority, lightweight plans unaffected. Cons: easy to forget, TDD becomes "that thing we sometimes do," two execution paths in one command.

3. **Separate `/ba:tdd` command** — Dedicated command wrapping TDD discipline, alongside existing `/ba:execute`. Pros: clean separation, iterate in isolation, easy to experiment. Cons: duplicates some execute infrastructure, two commands to maintain.

### Decision: Separate `/ba:tdd` command

Rationale: iterate and experiment in isolation. If it proves itself, consider merging into `/ba:execute` later. The current execute command's explicit design choice ("No TDD machinery baked into the command") is preserved — `/ba:tdd` is a new execution mode, not a retrofit.

### Other decisions

- **Behaviors come from the plan**: `/ba:plan` gains an optional "Behaviors to Test" section where testable behaviors are identified and user-prioritized during planning. `/ba:tdd` consumes this section for its tracer-bullet loop. This keeps the plan as the authority.

- **Per-cycle gate via dedicated agent**: A `tdd-cycle-gate` agent validates each red-to-green cycle silently and surfaces only violations. This encodes Pocock's per-cycle checklist ("test describes behavior not implementation, test uses public interface only, test would survive internal refactor, code is minimal") as an automated gate.

- **Single refactor phase at end**: After ALL behaviors are green, one refactor phase dispatches the `refactor-advisor` agent. This matches Pocock's "never refactor while RED" principle and gives Ousterhout principles a structured moment to guide design improvements.

- **Ousterhout as new agent, not external reference**: A `refactor-advisor` agent in `agents/workflow/` encodes deep-module principles (small interface + deep implementation, dependency injection, return results over side effects, extract duplication, deepen modules). This makes the principles a first-class participant in the workflow rather than an external skill invoked manually during review.

- **Command category: Execution Command**: `/ba:tdd` is classified under Execution Commands in CLAUDE.md, same behavioral contract as `/ba:execute` — "implement approved plans."

## Key Decisions

- **Separate command (`/ba:tdd`)**: Iterate in isolation, merge later if proven (rationale: experimental, don't destabilize existing execute)
- **Plan-driven behaviors**: `/ba:plan` optional "Behaviors to Test" section feeds the TDD loop (rationale: plan remains the authority)
- **`tdd-cycle-gate` agent**: Per-cycle validation, surfaces violations only (rationale: discipline without blocking flow)
- **`refactor-advisor` agent**: Ousterhout principles for refactor phase (rationale: first-class workflow participant, not afterthought review)
- **Single refactor phase at end**: Not per-cycle (rationale: matches Pocock's workflow, avoids premature optimization)
- **Execution Command category**: Same contract as `/ba:execute` (rationale: it writes code implementing approved plans)

## Scope Boundaries

- NOT replacing `/ba:execute` — the two commands coexist
- NOT modifying the existing execute command's behavior
- NOT adding new artifact types — `/ba:tdd` operates on existing plan files
- NOT enforcing TDD on plans that don't have a "Behaviors to Test" section — the command should handle this gracefully (infer from acceptance criteria or ask the user)
- NOT absorbing the full external Ousterhout skill — the `refactor-advisor` encodes the principles relevant to post-TDD refactoring

## Acceptance Criteria

- `/ba:tdd` command exists in `commands/ba/tdd.md` with YAML frontmatter
- Command reads a plan file (auto-detect or explicit path, same as `/ba:execute`)
- Command extracts "Behaviors to Test" from the plan (or falls back to acceptance criteria / interactive definition)
- Execution follows the tracer-bullet loop: one failing test → minimal implementation → gate check → repeat
- `tdd-cycle-gate` agent validates each cycle (test describes behavior, uses public interface, survives refactor, code is minimal)
- After all behaviors green, refactor phase dispatches `refactor-advisor` agent
- `refactor-advisor` agent provides Ousterhout-informed guidance (deep modules, interface simplification, duplication extraction)
- Tests must stay green throughout refactor phase
- Commits at logical boundaries (same discipline as `/ba:execute`)
- `/ba:plan` templates include optional "Behaviors to Test" section
- CLAUDE.md updated with new command and both agents
- README.md updated with new workflow documentation
- `plugin.json` version bumped

## Convention Compliance

- [x] Command prefix `ba:` — aligned
- [x] Agent naming `lowercase-with-hyphens` — aligned (`tdd-cycle-gate`, `refactor-advisor`)
- [x] Agent directory placement `agents/workflow/` — aligned
- [x] YAML frontmatter on all new files — explicitly required
- [x] Agent `tools` declarations — to be specified during planning (recommended: declare restrictions)
- [x] CLAUDE.md update — explicitly required (new command + 2 agents)
- [x] README.md update — explicitly required
- [x] `plugin.json` version bump — explicitly required
- [x] Command category — Execution Commands (same contract as `/ba:execute`)
- [x] No new artifact paths — aligned (`/ba:tdd` uses existing plan files)

## Next Steps

-> `/ba:plan` to create implementation plan covering: `/ba:tdd` command, `tdd-cycle-gate` agent, `refactor-advisor` agent, `/ba:plan` template enhancement, CLAUDE.md + README.md updates, version bump.
