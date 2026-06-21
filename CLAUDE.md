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

### Session Commands (capture context for handoff — never write code)

- `/ba:handoff [focus]` — Compact the current conversation into a handoff document (git state, in-repo artifact paths, suggested next steps) saved to `$TMPDIR` for a fresh or parallel session

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

- Command namespace: `ba:` comes from the `commands/ba/` directory — every command invokes as `/ba:<name>` (full form `/dev-workflow:ba:<name>`). This namespace is command-only; plugin skills (if any are ever added) are namespaced by the plugin name (`/dev-workflow:<skill>`), not `ba:`
- Agent names: lowercase-with-hyphens; suffix names the role (`-reviewer` for `agents/review/`; `-checker`, `-gate`, `-analyzer`, `-generator` for `agents/workflow/`)
- All artifacts require YAML frontmatter
- Bump `version` in `.claude-plugin/plugin.json` for every release
- Planning commands (brainstorm, plan, slice, review-plan) must never write code — only research and document
- Execution commands (execute) implement approved plans — the plan is the authority on what to build
- Convention-compliance check is mandatory before writing planning artifacts (brainstorms, plans) to disk — slice annotations to existing plans are exempt (they annotate delivery structure, not content)
- Research docs (`docs/research/`) are exempt — they are pre-convention ephemeral artifacts
- Agents may declare `tools` in frontmatter to restrict available tools (e.g., locator agents use Grep, Glob, LS only — no Read)
- `/ba:review` selection is a stateless per-diff judgment — every reviewer (built-in and discovered external) appears in the **selection ledger** each run, selected or set aside with a one-line reason, and is reachable via **Adjust**. Reviewers are never silently dropped; no selection state is persisted. (This never-hide convention is mirrored in `README.md` and `commands/ba/review.md` Step 2 — keep them in sync.)
- `/ba:review` dispatches reviewer subagents with a protected-artifacts guard naming `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, and `docs/reviews/` — reviewers must not suggest deleting, relocating, or otherwise removing files under these roots (content review is unaffected)
- Plan documents default to **decisions** (approach, exact file paths, patterns, pseudo-code for shape, test scenarios); a literal code block is permitted only under a `**Code-shape decision:** <why>` label. The label wording is mirrored across `commands/ba/plan.md` ("Key rules for all templates" trigger block **and** the three template placeholders), `commands/ba/execute.md` (Step 2b + Step 1.5b LoC projection), `commands/ba/slice.md` (LoC Counting Rules), and `README.md` (`/ba:plan` description) — keep them in sync. (This convention covers the *label* only; the `## Locked Design` anchor it references is owned by `commands/ba/brainstorm.md`.)
- Update README.md whenever commands, agents, or artifact paths are added or changed
- Git workflow commands (`ba:propose`) commit, push, and open PR/MR — they never modify source files outside the staged diff
- The roadmap lives in **GitHub issues**, hubbed by **#29** (`[meta] dev-workflow roadmap` — the "where do I start" map, not the raw issue list). Items use `[roadmap]`-prefixed titles, `cluster:*` lanes, `ready`/`deferred`/`declined`/`needs-brainstorm` states, and a documented revisit trigger for deferred/declined. Research/comparison docs are linked from issues as evidence — never spun into a competing roadmap doc (converge in issues). Full convention: `.claude/agent_docs/roadmap-management.md`
