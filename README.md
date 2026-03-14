# dev-workflow

A Claude Code plugin that adds structured brainstorm and plan commands to your development workflow.

## Why

The #1 failure mode in AI-assisted development is jumping straight to implementation. This plugin enforces a think-first workflow: explore what to build (`/ba:brainstorm`), then define how to build it (`/ba:plan`), then implement.

The design synthesizes patterns from three production agent workflow systems ([compound-engineering](https://github.com/EveryInc/compound-engineering-plugin), [humanlayer](https://github.com/humanlayer/12-factor-agents), [superpowers](https://github.com/obra/superpowers)), taking the best ideas from each and closing gaps they all share.

## Install

```bash
claude plugin marketplace add azevedo/dev-workflow
claude plugin install dev-workflow
```

### Updating

The plugin is installed from a cached snapshot. To pull the latest version:

```bash
claude plugin marketplace remove dev-workflow
# Install again
claude plugin marketplace add azevedo/dev-workflow
claude plugin install dev-workflow
```

## Commands

### `/ba:brainstorm [idea]`

Explores requirements and approaches through collaborative dialogue before planning.

**Key feature: three-level triage.** Not every idea needs the same depth of exploration.

| Level | When | What happens | Output |
|---|---|---|---|
| **FAST-TRACK** | Clear requirements, single approach, ≤3 files | Quick confirmation, auto-chains to plan | Minimal brainstorm doc |
| **STANDARD** | Mostly clear, 2-3 approaches, needs validation | Codebase research, 2-4 questions, propose approaches | Brief brainstorm doc |
| **FULL** | Vague requirements, architectural decisions, security/payments | Deep research, extended dialogue, full design | Comprehensive brainstorm doc |

Triage level escalates automatically if complexity is discovered mid-conversation. Security, payments, and external API topics always trigger FULL.

Brainstorm docs are saved to `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`.

### `/ba:plan [feature]`

Transforms feature descriptions into implementation plans with exact file paths and code.

- **Auto-detects brainstorms** — searches `docs/brainstorms/` for recent (14-day) topic-matched docs and carries forward all decisions
- **Parallel research** — dispatches agents to analyze codebase patterns and search prior learnings
- **Conditional external research** — risk-based: security/payments always research externally; known patterns skip it
- **Three detail levels** — MINIMAL (simple bugs), STANDARD (most features), COMPREHENSIVE (major features with phased implementation and phase gates)
- **SpecFlow analysis** — agent maps all user flows, identifies edge cases and gaps before plan is finalized
- **"What We're NOT Doing"** — every plan includes explicit scope boundaries

Plans are saved to `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md`.

### `/ba:review-plan [path]`

Runs discovery-based reviews against a plan before implementation. Automatically finds review agents and skills available in your environment (copy auditors, code reviewers, complexity assessors, test strategy reviewers) and offers to run them against the plan.

This catches issues at plan time — where fixing things is cheap — instead of after code is written.

- **Auto-detects the latest plan** if no path is given
- **Discovery-based** — works with whatever review tools are installed (personal agents in `~/.claude/agents/`, project agents, plugin skills)
- **Plan-aware framing** — tells each reviewer it's evaluating a proposal, not finished code
- **Consolidated findings** — presents results as Must Address / Consider / Looks Good

## Convention Compliance

Both commands run a **mandatory convention-compliance check** before writing artifacts to disk. This closes a gap shared by all three reference systems: no explicit step that compares output against project rules.

The `convention-checker` agent reads your CLAUDE.md and project conventions, compares them against the draft, and classifies each as:

- **ALIGNED** — convention followed
- **JUSTIFIED** — convention overridden with stated rationale
- **VIOLATION** — convention not followed (must resolve before saving)
- **NOT APPLICABLE** — convention doesn't apply

Violations are presented to you with options: comply, justify the override, or flag as known debt.

## Agents

| Agent | Purpose |
|---|---|
| `repo-researcher` | Analyzes codebase structure, patterns, and CLAUDE.md conventions |
| `learnings-researcher` | Searches `docs/solutions/` for prior learnings and gotchas |
| `spec-flow-analyzer` | Maps user flows, discovers edge cases, identifies spec gaps |
| `convention-checker` | Validates artifacts against project conventions |

## Knowledge Compounding

The plugin supports a `docs/solutions/` knowledge base. When you solve a problem, document it there. The `learnings-researcher` agent surfaces relevant learnings during future brainstorm and plan sessions, so the same mistakes aren't repeated.

## Artifact Paths

| Artifact | Path |
|---|---|
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` |
| Learnings | `docs/solutions/<category>/<filename>.md` |

## Roadmap

- `/ba:execute` — hybrid plan execution (continuous with phase gates, opt-in batch mode, opt-in swarm for parallel tasks)
- `/ba:validate` — post-implementation validation against plan
- `/ba:compound` — capture solved problems to `docs/solutions/`
- `/ba:handoff` — session continuity for multi-session work

## License

MIT
