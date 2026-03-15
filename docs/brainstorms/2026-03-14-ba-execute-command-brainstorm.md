---
date: 2026-03-14
topic: ba-execute-command
status: approved
triage_level: standard
tags: [execute, implementation, workflow, command]
---

# /ba:execute Command Design

## What We're Building

A new command `/ba:execute` that handles the implementation/execution phase of the dev-workflow plugin. It takes a plan file produced by `/ba:plan` and executes it systematically -- implementing code changes, running tests continuously, tracking progress via plan checkboxes, handling deviations from the plan, and committing at logical boundaries.

This is the critical missing piece between planning (`/ba:plan`, `/ba:review-plan`) and post-implementation commands (future `/ba:validate`, `/ba:compound`).

V1 targets the core execution loop with a single execution mode (continuous). Batch mode and subagent-driven mode are deferred to future versions.

## Why This Approach

**Structure chosen: Single comprehensive command file (~300-350 lines)**

Three structural approaches were considered:

1. **Lean command** (~150 lines, rely on agent intelligence) -- Rejected because inconsistent behavior results; the agent won't always remember to update checkboxes, check for deviations, or run fresh verification without explicit instructions.

2. **Command + reference docs** (modular files for each phase) -- Deferred to V3 when subagent-driven mode needs implementer/reviewer prompt templates. Not needed for V1.

3. **Comprehensive single command file** -- Chosen because it matches existing brainstorm.md (285 lines) and plan.md (~470 lines) patterns. Every behavioral expectation is explicit. Proven format in this plugin.

**Execution mode chosen: Continuous with phase gates**

Three execution strategies were analyzed across compound-engineering, humanlayer, and superpowers (see research docs 07-10):

- Continuous (CE-style): Sequential tasks, test continuously, commit at boundaries. Best balance of autonomy and safety.
- Batch (SP-style): Execute N tasks, report, wait for feedback. More human control but slower.
- Subagent-driven (SP-style): Fresh agent per task + two-stage review. Highest quality but highest overhead.

V1 implements continuous mode only. Batch and subagent modes deferred to V3.

## Key Decisions

- **V1 scope (core loop only):** Sequential execution, continuous testing, plan checkboxes for resume, atomic commits, deviation reporting, evidence-based completion. No subagents, no batch mode.

- **Update CLAUDE.md:** Distinguish planning commands (brainstorm, plan, review-plan: never write code) from execution commands (execute: implements approved plans). Not a convention violation -- a convention refinement.

- **Branch setup -- offer inline:** At initialization, check current branch. If on main/master, offer to create a feature branch. If already on feature branch, confirm and proceed. Don't force anything.

- **TDD -- follow the plan:** No TDD machinery baked into the command. If the plan specifies TDD steps, execute follows them. If not, implement and test normally. The plan is the authority on testing approach.

- **Commits yes, PR separate:** Execute makes incremental commits (atomic units, tests passing). PR creation is left to the user or a future command. Clean separation of concerns.

- **System-wide check -- lightweight guidance:** Include the 5-question check (what fires? real chain tested? orphaned state? other interfaces? error alignment?) as a self-review prompt after each task, not a formal gate. Cheap to include, prevents integration bugs.

- **Completion -- summary + options menu:** Show what was done, deviations, test results. Offer next steps: continue working, capture learnings, create handoff, done. Mirrors handoff pattern from brainstorm and plan commands.

- **No new agents for V1:** Main agent handles all work. New agents (implementer, spec-reviewer, code-quality-reviewer) deferred to V3.

- **Plan file is the progress tracker:** Update `[ ]` to `[x]` in the plan file as tasks complete. This enables resume from partial completion across sessions.

- **Convention-compliance check: skip for source code.** The convention-checker gate validates document artifacts (brainstorms, plans). Source code follows the plan, which already went through convention-checking. Tests and linting serve as the quality gate for code. The CLAUDE.md convention about mandatory convention-compliance checks applies to planning artifacts, not implementation output.

## Scope Boundaries

What we're NOT doing in V1:

- **No batch mode** -- deferred to V3
- **No subagent-driven mode** -- deferred to V3
- **No parallel/swarm execution** -- deferred to V4
- **No PR creation** -- separate concern, future command or user action
- **No knowledge capture** -- future `/ba:compound` command
- **No formal handoff documents** -- plan checkboxes provide resume; formal handoff is future `/ba:handoff`
- **No review agent dispatch** -- future `/ba:review` command (post-implementation code review)
- **No worktree management** -- offer to create a branch, but don't manage worktrees
- **No convention-checker during execution** -- tests and linting serve as code quality gates

## Acceptance Criteria

- Command file `commands/ba/execute.md` follows existing plugin patterns (frontmatter, argument capture, agent dispatch syntax, handoff)
- Can consume any plan file produced by `/ba:plan` (MINIMAL, STANDARD, or COMPREHENSIVE detail levels)
- Auto-detects latest plan if no argument given (like review-plan auto-detects plans)
- Detects and resumes from partially-completed plans (existing `[x]` marks)
- Updates plan checkboxes `[ ]` to `[x]` as tasks complete
- Makes atomic commits at logical boundaries with conventional messages
- Reports deviations in Expected/Found/Why format and asks user before proceeding
- Runs fresh verification before claiming completion (evidence-based)
- Offers structured next-steps menu at completion
- CLAUDE.md updated to distinguish planning vs execution commands
- `.claude-plugin/plugin.json` version bumped on release

## Convention Compliance

**Checked by convention-checker agent. Results:**

- **5 aligned:** ba: prefix, agent naming, YAML frontmatter, command structural patterns, plan artifact path
- **1 justified override:** "Commands must never write code" -- resolved by updating CLAUDE.md to distinguish planning commands from execution commands
- **2 violations resolved:**
  1. Convention-compliance check for artifacts: skipped for source code (plan already validated; tests/linting serve as code quality gates)
  2. Plugin version bump: acknowledged as a shipping step in acceptance criteria

## Next Steps

-> `/ba:plan` to create implementation plan
