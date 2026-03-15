# dev-workflow

A Claude Code plugin that adds structured research, brainstorm, plan, and execute commands to your development workflow.

## Why

The #1 failure mode in AI-assisted development is jumping straight to implementation. This plugin enforces a think-first workflow: investigate the codebase (`/ba:research`), explore what to build (`/ba:brainstorm`), define how to build it (`/ba:plan`), review before writing code (`/ba:review-plan`), then implement against the approved plan (`/ba:execute`).

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

### `/ba:research [question]`

Conducts comprehensive codebase investigation using 5 parallel specialized agents, then writes a persistent research document.

- **Parallel sub-agents** — all 5 agents run simultaneously; each has strict tool restrictions enforcing a "find before read" discipline
- **Persistent docs** — results saved to `docs/research/` with YAML frontmatter and GitLab permalinks, surviving context resets
- **Follow-up support** — additional questions append to the same document with timestamps; prior research detected across sessions
- **Auto-detected by brainstorm/plan** — matching research docs within 14 days are surfaced as supplementary context automatically

Research docs are gitignored ephemeral artifacts. Findings worth preserving permanently graduate to `docs/solutions/` via `/ba:compound`.

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

### `/ba:execute [plan]`

Implements an approved plan systematically: code changes, targeted testing, progress tracking, deviation reporting, and atomic commits.

- **Auto-detects the latest actionable plan** if no path is given; skips `status: completed` plans
- **Three plan detail levels** — MINIMAL (per acceptance criterion), STANDARD (per file block), COMPREHENSIVE (per phase with phase gates)
- **Targeted tests per task** — runs tests related to changed files, not the full suite; defers full suite + lint to completion or CI
- **Resume across sessions** — updates plan checkboxes `[ ]` → `[x]` as tasks complete; detects and resumes from partial progress
- **Deviation handling** — reports in Expected/Found/Why format, asks before proceeding, persists deviations in the plan file
- **VCS-agnostic completion** — detects GitHub/GitLab from git remote; discovers available MR/PR tools in the environment

## Convention Compliance

Both brainstorm and plan commands run a **mandatory convention-compliance check** before writing artifacts to disk. This closes a gap shared by all three reference systems: no explicit step that compares output against project rules.

The `convention-checker` agent reads your CLAUDE.md and project conventions, compares them against the draft, and classifies each as:

- **ALIGNED** — convention followed
- **JUSTIFIED** — convention overridden with stated rationale
- **VIOLATION** — convention not followed (must resolve before saving)
- **NOT APPLICABLE** — convention doesn't apply

Violations are presented to you with options: comply, justify the override, or flag as known debt.

Research docs (`docs/research/`) are exempt from compliance checks — they are pre-convention ephemeral artifacts.

## Agents

| Agent | Purpose |
|---|---|
| `repo-researcher` | Analyzes codebase structure, patterns, and CLAUDE.md conventions |
| `learnings-researcher` | Searches `docs/solutions/` for prior learnings and gotchas |
| `spec-flow-analyzer` | Maps user flows, discovers edge cases, identifies spec gaps |
| `convention-checker` | Validates artifacts against project conventions |
| `codebase-locator` | Finds WHERE files and components live (Grep/Glob/LS only — no file reading) |
| `codebase-analyzer` | Understands HOW specific code works, with precise file:line references |
| `codebase-pattern-finder` | Finds SIMILAR implementations and existing patterns with code examples |
| `research-locator` | Discovers relevant docs in `docs/research/` (Grep/Glob/LS only) |
| `research-analyzer` | Extracts high-value insights from research documents |

## Knowledge Compounding

The plugin supports a `docs/solutions/` knowledge base. When you solve a problem, document it there. The `learnings-researcher` agent surfaces relevant learnings during future brainstorm and plan sessions, so the same mistakes aren't repeated.

Research docs in `docs/research/` form a second, ephemeral layer: raw investigations that inform current work. Findings worth keeping permanently graduate to `docs/solutions/`.

## Artifact Paths

| Artifact | Path |
|---|---|
| Research docs | `docs/research/YYYY-MM-DD-<description>-research.md` |
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` |
| Learnings | `docs/solutions/<category>/<filename>.md` |

## Roadmap

- `/ba:validate` — post-implementation validation against plan
- `/ba:compound` — capture solved problems to `docs/solutions/`
- `/ba:handoff` — session continuity for multi-session work
- `/ba:execute` V3 — batch mode and subagent-driven execution

## License

MIT
