# dev-workflow Plugin

Claude Code plugin providing brainstorm and plan commands with triage, convention compliance, and knowledge compounding.

## Commands

### Research Commands (investigate and document — never write code)

- `/ba:research [question]` — Conduct comprehensive codebase research with parallel sub-agents

### Planning Commands (research and document — never write code)

- `/ba:brainstorm [idea]` — Explore requirements and approaches before planning
- `/ba:plan [feature]` — Create implementation plans from feature descriptions
- `/ba:review-plan [path]` — Discovery-based plan review with available agents and skills

### Execution Commands (implement approved plans)

- `/ba:execute [plan]` — Execute an approved implementation plan

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

## Artifact Paths

| Artifact | Path |
|---|---|
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` |
| Learnings | `docs/solutions/<category>/<filename>.md` |
| Research docs | `docs/research/YYYY-MM-DD-<description>-research.md` |

## Conventions

- Command prefix: `ba:`
- Agent names: lowercase-with-hyphens
- All artifacts require YAML frontmatter
- Bump `version` in `.claude-plugin/plugin.json` for every release
- Planning commands (brainstorm, plan, review-plan) must never write code — only research and document
- Execution commands (execute) implement approved plans — the plan is the authority on what to build
- Convention-compliance check is mandatory before writing planning artifacts (brainstorms, plans) to disk
- Research docs (`docs/research/`) are exempt — they are pre-convention ephemeral artifacts
- Agents may declare `tools` in frontmatter to restrict available tools (e.g., locator agents use Grep, Glob, LS only — no Read)
- Update README.md whenever commands, agents, or artifact paths are added or changed
