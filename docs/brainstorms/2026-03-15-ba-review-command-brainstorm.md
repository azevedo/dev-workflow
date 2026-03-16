---
date: 2026-03-15
topic: ba-review-command
status: approved
triage_level: standard
tags: [review, code-quality, post-implementation]
---

# /ba:review — Post-Implementation Code Review

## What We're Building

A post-implementation code review command that reviews actual code changes for quality, security, and design. It uses a hybrid approach: built-in review dimensions that always work out of the box, plus discovery of external review agents/skills for deeper or specialized coverage. The command is standalone (can be run anytime) but is also offered as a natural next step in execute's completion menu.

This replaces the previously roadmapped `/ba:validate` command. Plan validation (did we build what we planned?) is already handled by execute's Step 4 (Deviation Handling) and Step 5 (Completion Verification). The gap is code quality review, which this command fills.

## Why This Approach

**Approaches considered:**

1. **Discovery-based only** (mirror review-plan pattern) — Discovers available review agents/skills, user picks which to run. Lightweight but useless if no review agents are installed.
2. **Built-in only** (Superpowers-inspired) — Fixed review dimensions defined in the command. Works out of the box but not extensible.
3. **Hybrid** (chosen) — Built-in core dimensions + external discovery. Always useful, extensible, avoids token waste through deduplication.

**Why hybrid:** The command should be valuable even with zero external plugins installed. Built-in dimensions provide a baseline; external reviewers enhance it. Deduplication prevents overlap — when an external reviewer covers the same area as a built-in dimension, the external replaces the built-in (prefer specialized over generic).

**Why not plan validation:** Execute already handles plan compliance during implementation with deviation tracking and completion verification. A separate validation command would largely duplicate that work. Code quality review is the actual gap in the pipeline.

## Key Decisions

- **Code review, not plan validation**: Plan compliance is covered by execute. This command focuses on code quality, security, design, and simplification.
- **Hybrid reviewer architecture**: Built-in dimensions (always available) + discovered external reviewers (specialized, additive). External replaces overlapping built-in.
- **Smart scope fallback chain**: Plan artifact (base ref) → branch diff (vs main/master) → staged changes → recent commits. Always finds something to review.
- **Standalone + integrated**: Can be run anytime on any changes, but also offered in execute's completion menu as a natural next step.
- **Fresh subagent context per reviewer**: Each reviewer gets an unbiased view of the code (Superpowers pattern). Prevents reviewer bias from shared context.
- **Same findings pattern as review-plan**: Must Address / Consider / Looks Good severity tiers. File:line references. Apply-fix resolution options.
- **Replaces /ba:validate on roadmap**: Execute's deviation handling covers plan compliance. `/ba:review` fills the actual gap (code quality).
- **New command category**: Introduces "Quality Commands" category in CLAUDE.md (distinct from Planning and Execution commands).
- **Agent implementation deferred to plan**: Whether built-in dimensions are agent files or inline prompts is a HOW decision for `/ba:plan`.

## Built-In Review Dimensions

Five core dimensions that always run (unless replaced by a discovered external):

| Dimension | Focus |
|---|---|
| **Architecture & Patterns** | Consistency with codebase patterns, coupling, separation of concerns, naming |
| **Security Basics** | XSS, sensitive data handling, auth patterns (not full OWASP) |
| **Simplification** | Over-engineering, unnecessary abstraction, dead code, YAGNI violations |
| **Error Handling** | Edge cases, error paths, graceful failures, loading/error states |
| **Test Coverage** | Missing test scenarios, test quality, adequate coverage of changes |

These are intentionally generic/lightweight. External reviewers go deeper on specific domains.

## Deduplication Strategy

When discovering external reviewers:
1. Check if the external maps to a built-in dimension (by category/description matching)
2. If overlap: external **replaces** the built-in (prefer specialized over generic)
3. If no overlap: external is **added** as a new dimension
4. Present a unified, deduplicated list for user multi-selection

## Command Flow

1. **Determine scope** — Smart fallback chain to identify what code to review
2. **Discover & select reviewers** — List built-in + discovered externals, deduplicate, user multi-selects
3. **Run reviews in parallel** — Each selected reviewer runs as a fresh subagent with diff + full file context
4. **Consolidate findings** — Severity-ranked (Must Address / Consider / Looks Good) with file:line references
5. **Resolution** — Apply all fixes / must-address only / one-by-one / done

## Scope Boundaries

What we're NOT doing:
- No plan validation (covered by execute Steps 4-5)
- No knowledge capture (future `/ba:compound` command)
- No PR/MR creation (already in execute's completion menu)
- No CI/CD integration (out of scope for the command itself)
- No convention-compliance check on code (tests and linting serve that role; convention-checker is for document artifacts)

## Acceptance Criteria

- Command can be invoked standalone with `ba:review` and optionally accepts a git ref range
- Smart scope detection works through the fallback chain (plan → branch → staged → recent)
- Built-in review dimensions run without any external agents/skills installed
- External reviewer discovery finds and categorizes available review agents/skills
- Deduplication replaces overlapping built-in dimensions with discovered externals
- User can multi-select which reviewers to run
- Findings are presented with severity tiers and file:line references
- Resolution options allow applying fixes (all, must-address, one-by-one, or skip)
- Execute's completion menu includes "Review code" option that chains to this command
- CLAUDE.md is updated with new "Quality Commands" category
- README roadmap is updated: `/ba:validate` replaced by `/ba:review`

## Convention Compliance

Checked against CLAUDE.md conventions (2026-03-15):

- [x] **Command prefix `ba:`** — aligned (`/ba:review`)
- [x] **Agent names lowercase-with-hyphens** — aligned (no new agents declared at brainstorm level)
- [x] **YAML frontmatter on artifacts** — aligned
- [x] **Convention-compliance check mandatory** — aligned (ran before writing this artifact)
- [x] **Discovery-based reviewer pattern** — aligned (mirrors review-plan)
- [x] **Severity-ranked findings** — aligned (same Must Address / Consider / Looks Good pattern)
- [x] **Command taxonomy** — resolved: introduces "Quality Commands" third category
- [x] **Roadmap consistency** — resolved: `/ba:review` replaces `/ba:validate`
- [x] **Agent declaration** — deferred to plan phase (inline vs agent files is a HOW question)

## Next Steps

-> `/ba:plan` to create implementation plan
