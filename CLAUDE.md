# dev-workflow Plugin

Claude Code plugin providing brainstorm and plan commands with triage, convention compliance, and knowledge compounding.

## Commands

### Research Commands (investigate and document — never write code)

- `/ba:research [question]` — Conduct comprehensive codebase research with parallel sub-agents

### Planning Commands (research and document — never write code)

- `/ba:brainstorm [idea]` — Explore requirements and approaches before planning
- `/ba:plan [feature]` — Create implementation plans from feature descriptions
- `/ba:slice [plan]` — Decompose plans into MR-sized slices for incremental delivery
- `/ba:review-plan [path]` — Discovery-based plan review with available agents and skills

### Execution Commands (implement approved plans)

- `/ba:execute [plan]` — Execute an approved implementation plan

### Quality Commands (review code — never write production code, only apply review fixes)

- `/ba:review [ref range]` — Post-implementation code review with built-in and discovered reviewers

### Knowledge Commands (capture and document — never write code)

- `/ba:compound [context]` — Document solved problems to `docs/solutions/` for future learnings

### Git Workflow Commands (ship code — commit, push, open PR/MR)

- `/ba:propose [--describe-only] [--issue <ID>]` — Commit, push, and open PR/MR with a composed title and body

## Agents

- `repo-researcher` — Codebase structure, patterns, and CLAUDE.md conventions
- `learnings-researcher` — Search `docs/solutions/` for prior learnings
- `spec-flow-analyzer` — User flow completeness and gap identification
- `convention-checker` — Validate artifacts against project conventions
- `codebase-locator` — Find WHERE files and components live (no Read — Grep, Glob, LS only)
- `codebase-analyzer` — Understand HOW specific code works (Read, Grep, Glob, LS)
- `codebase-pattern-finder` — Find SIMILAR implementations and existing patterns (Read, Grep, Glob, LS)
- `research-locator` — Discover relevant docs in `docs/research/` (Grep, Glob, LS only)
- `research-analyzer` — Extract insights from research documents (Read, Grep, Glob, LS)
- `architecture-reviewer` — Code patterns, coupling, separation of concerns, naming (built-in reviewer)
- `security-reviewer` — XSS, sensitive data, auth patterns, input validation (built-in reviewer)
- `simplification-reviewer` — Over-engineering, unnecessary abstraction, YAGNI (built-in reviewer)
- `error-handling-reviewer` — Edge cases, error paths, graceful failures (built-in reviewer)
- `test-coverage-reviewer` — Missing test scenarios, test quality, coverage gaps (built-in reviewer)
- `deep-module-reviewer` — Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline (built-in reviewer)
- `complexity-reviewer` — Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns (built-in reviewer)
- `plan-iteration-gate` — Per-round plan-iteration discipline validation, dispatched by `/ba:review-plan` Step 5.5 (Read, Grep, Glob, LS)
- `interface-design-generator` — Generates one alternative interface design under a named Ousterhout-flavored constraint, dispatched in parallel by `/ba:brainstorm` Phase 2 design-it-twice mode (Read, Grep, Glob, LS)

## Artifact Paths

| Artifact | Path |
|---|---|
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` |
| Learnings | `docs/solutions/<category>/<filename>.md` |
| Research docs | `docs/research/YYYY-MM-DD-<description>-research.md` |
| Review run artifacts | `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` |

## Conventions

- Command prefix: `ba:`
- Agent names: lowercase-with-hyphens; suffix names the role (`-reviewer` for `agents/review/`; `-checker`, `-gate`, `-analyzer`, `-generator` for `agents/workflow/`)
- All artifacts require YAML frontmatter
- Bump `version` in `.claude-plugin/plugin.json` for every release
- Planning commands (brainstorm, plan, slice, review-plan) must never write code — only research and document
- Execution commands (execute) implement approved plans — the plan is the authority on what to build
- Convention-compliance check is mandatory before writing planning artifacts (brainstorms, plans) to disk — slice annotations to existing plans are exempt (they annotate delivery structure, not content)
- Research docs (`docs/research/`) are exempt — they are pre-convention ephemeral artifacts
- Agents may declare `tools` in frontmatter to restrict available tools (e.g., locator agents use Grep, Glob, LS only — no Read)
- All built-in reviewers always appear as options in `/ba:review` — external reviewers are shown alongside them with overlap notes, never hidden or replaced
- `/ba:review` dispatches reviewer subagents with a protected-artifacts guard naming `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, and `docs/reviews/` — reviewers must not suggest deleting, relocating, or otherwise removing files under these roots (content review is unaffected)
- Update README.md whenever commands, agents, or artifact paths are added or changed
- Git workflow commands (`ba:propose`) commit, push, and open PR/MR — they never modify source files outside the staged diff
