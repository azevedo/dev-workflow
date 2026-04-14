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
claude plugin marketplace remove dev-workflow && claude plugin marketplace add azevedo/dev-workflow && claude plugin install dev-workflow
```

## Commands

### Starting a flow

Two valid entry points — choose based on how well you understand the codebase area you're about to design in:

```
Do you understand the codebase area well enough to start a design conversation?
    YES → /ba:brainstorm   (runs its own research internally)
    NO  → Why not?

        Unfamiliar or large codebase area?               → /ba:research first
        Findings needed independently (team/stakeholders)?→ /ba:research first
        Same research will feed multiple features?       → /ba:research first
        Just need to explore an idea?                    → /ba:brainstorm (it'll guide you)

After planning, choose your execution mode:
    Plan is large (multiple MRs worth of work)?              → /ba:slice first
    Plan has testable behaviors / want test-first discipline? → /ba:tdd
    Straightforward implementation?                          → /ba:execute
    Plan is sliced?                                          → /ba:execute --slice N
```

`/ba:brainstorm` always runs lightweight internal research (repo-researcher + learnings-researcher). Use `/ba:research` first when you need the full 5-agent parallel investigation — or when the findings should live outside the design conversation. Research docs within 14 days are auto-detected and carried forward as supplementary context by both brainstorm and plan.

**After `/ba:research`, should you brainstorm or plan next?**

```
After reading the research doc, do you know exactly what to do?
    YES → /ba:plan   (plan also auto-detects the research doc)
    NO  → /ba:brainstorm first

        Research surfaced multiple approaches?           → /ba:brainstorm (pick one)
        Scope or acceptance criteria still unclear?      → /ba:brainstorm (define them)
        Single obvious fix, no design decisions?         → /ba:plan directly
```

Brainstorm produces scope boundaries and acceptance criteria that plan relies on. For a clear, single-approach fix that's well-understood, plan can consume the research doc directly and those artifacts aren't needed.

---

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

### `/ba:slice [plan]`

Decomposes an approved plan into MR-sized slices for incremental delivery. Each slice targets <=150 LoC (excluding tests) and represents one merge request's worth of work.

- **Auto-detects the latest plan** if no path is given; reads plan structure and estimates LoC per task
- **Inline annotations** -- slices live as HTML comment markers in the plan file (one file, one source of truth)
- **Three detail levels** -- handles MINIMAL, STANDARD, and COMPREHENSIVE plans; respects phase boundaries in COMPREHENSIVE
- **Re-sliceable** -- run ba:slice again and choose "Re-slice from scratch" to re-decompose when estimates prove wrong
- **Pipeline chaining** -- completion menu offers to start slice 1 immediately or with fresh context

After slicing, execute one slice at a time with `/ba:execute --slice N`. Each slice gets its own branch and MR.

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
- **Slice-aware execution** — `--slice N` executes a single slice; auto-detects next incomplete slice on sliced plans; suggests fresh context between slices
- **VCS-agnostic completion** — detects GitHub/GitLab from git remote; discovers available MR/PR tools in the environment

### `/ba:tdd [plan]`

Executes an approved plan using test-driven development discipline: one failing test, minimal implementation, per-cycle validation, repeat. After all behaviors are green, a dedicated refactor phase with Ousterhout deep-module principles.

- **Behaviors from the plan** — extracts "Behaviors to Test" section, falls back to acceptance criteria, or asks interactively
- **Tracer-bullet loop** — RED (write failing test) → confirm RED → GREEN (minimal implementation) → confirm GREEN → regression check → cycle gate → repeat
- **Per-cycle gate** — `tdd-cycle-gate` agent validates each cycle silently; surfaces only violations (test describes behavior, uses public interface, code is minimal, no test mutation)
- **LLM-specific anti-patterns** — detects tests mutated during GREEN phase and tests not responsive to prior implementation cycle
- **Refactor phase** — after all behaviors green, `refactor-advisor` agent provides Ousterhout-guided suggestions (deep modules, dependency injection, return results over side effects)
- **Same infrastructure as `/ba:execute`** — branch check, resume detection, targeted testing, checkpoint tracking, commit discipline, completion menu

### `/ba:review [ref range]`

Runs post-implementation code review using five built-in review agents plus any additional reviewers discovered in the environment.

### `/ba:compound [context]`

Documents solved problems into `docs/solutions/` so the `learnings-researcher` agent surfaces them in future brainstorm and plan sessions. Closes the knowledge compounding loop.

- **5 parallel subagents** — Context Analyzer, Solution Extractor, Related-Docs Finder, Prevention Strategist, Category Classifier
- **Auto-trigger** — fires on solution-confirmation phrases ("that worked", "it's fixed", "problem solved") with a brief confirmation prompt
- **Explicit invocation** — `/ba:compound` or `/ba:compound [context hint]` for immediate documentation
- **Structured output** — YAML frontmatter with `category`, `tags`, `module`, and `symptom` for maximum discoverability by `learnings-researcher`

- **Smart scope detection** — auto-detects feature branch vs. main, staged changes, or recent commits when no ref range is given
- **Five built-in reviewers** — architecture, security, simplification, error handling, and test coverage; always available out of the box
- **Extensible** — discovers external review agents and skills; shows all reviewers (built-in and external) with overlap notes so you choose
- **Parallel dispatch** — all selected reviewers run simultaneously as independent subagents for unbiased, unbiased analysis
- **Structured findings** — Must Address / Consider / Looks Good with file:line references and conflict detection across reviewers
- **Fix application** — apply all fixes, must-address only, or one-by-one with Accept/Skip per finding; runs targeted tests after applying

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
| `architecture-reviewer` | Reviews code changes for architectural consistency, coupling, separation of concerns, and naming conventions |
| `security-reviewer` | Reviews code changes for security issues: XSS, sensitive data handling, auth patterns, and input validation |
| `simplification-reviewer` | Reviews code changes for over-engineering, unnecessary abstraction, dead code, and YAGNI violations |
| `error-handling-reviewer` | Reviews code changes for edge cases, error paths, graceful failures, and loading/error states |
| `test-coverage-reviewer` | Reviews code changes for test coverage gaps, missing test scenarios, and test quality |
| `tdd-cycle-gate` | Validates each TDD red-to-green cycle for discipline compliance and LLM anti-patterns |
| `refactor-advisor` | Provides Ousterhout deep-module refactoring guidance after TDD behaviors are green |

## Knowledge Compounding

The plugin includes a `docs/solutions/` knowledge base and the `/ba:compound` command to populate it. When you solve a problem, run `/ba:compound` (or let it auto-trigger) to document the solution. The `learnings-researcher` agent surfaces relevant learnings during future brainstorm and plan sessions, so the same mistakes aren't repeated.

Research docs in `docs/research/` form a second, ephemeral layer: raw investigations that inform current work. Findings worth keeping permanently graduate to `docs/solutions/` via `/ba:compound`.

## Artifact Paths

| Artifact | Path |
|---|---|
| Research docs | `docs/research/YYYY-MM-DD-<description>-research.md` |
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` |
| Learnings | `docs/solutions/<category>/<filename>.md` |

## Roadmap

- `/ba:review` — post-implementation code review (built-in + discovered reviewers) ✅
- `/ba:compound` — capture solved problems to `docs/solutions/` ✅
- `/ba:tdd` — TDD execution discipline with per-cycle validation and deep-module refactoring ✅
- `/ba:slice` — plan decomposition into MR-sized slices for incremental delivery ✅
- `/ba:handoff` — session continuity for multi-session work
- `/ba:execute` V3 — batch mode and subagent-driven execution
- Merge `/ba:tdd` into `/ba:execute` as an execution mode — after `/ba:tdd` is validated through real usage

## License

MIT
