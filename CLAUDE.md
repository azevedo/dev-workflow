# dev-workflow Plugin

Claude Code plugin providing brainstorm and plan commands with triage, convention compliance, and knowledge compounding.

## Commands

- `/ba:brainstorm [idea]` — Explore requirements and approaches before planning
- `/ba:plan [feature]` — Create implementation plans from feature descriptions
- `/ba:review-plan [path]` — Discovery-based plan review with available agents and skills

## Agents

- `repo-researcher` — Codebase structure, patterns, and CLAUDE.md conventions
- `learnings-researcher` — Search `docs/solutions/` for prior learnings
- `spec-flow-analyzer` — User flow completeness and gap identification
- `convention-checker` — Validate artifacts against project conventions

## Artifact Paths

| Artifact | Path |
|---|---|
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` |
| Learnings | `docs/solutions/<category>/<filename>.md` |

## Conventions

- Command prefix: `ba:`
- Agent names: lowercase-with-hyphens
- All artifacts require YAML frontmatter
- Bump `version` in `.claude-plugin/plugin.json` for every release
- Commands must never write code — only research and document
- Convention-compliance check is mandatory before writing any artifact to disk
