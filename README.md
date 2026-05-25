# dev-workflow

A Claude Code plugin that adds structured research, brainstorm, plan, and execute commands to your development workflow.

## Why

The #1 failure mode in AI-assisted development is jumping straight to implementation. This plugin enforces a think-first workflow: investigate the codebase (`/ba:research`), explore what to build (`/ba:brainstorm`), define how to build it (`/ba:plan`), decompose into MR-sized slices (`/ba:slice`), review before writing code (`/ba:review-plan`), then implement (`/ba:execute`). Post-implementation review (`/ba:review`) and knowledge compounding (`/ba:compound`) close the loop so the same mistakes aren't repeated.

The design synthesizes patterns from three production agent workflow systems ([compound-engineering](https://github.com/EveryInc/compound-engineering-plugin), [humanlayer](https://github.com/humanlayer/12-factor-agents), [superpowers](https://github.com/obra/superpowers)), taking the best ideas from each and closing gaps they all share.

## Position on the SDD ladder

In Birgitta Böckeler's [framing of spec-driven development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html), SDD tools sit at one of three levels: **spec-first** (write the spec before the code), **spec-anchored** (keep the spec in sync with the code after shipping, and use it to drive evolution), and **spec-as-source** (the spec is the only thing humans edit; code is fully derived output).

`dev-workflow` is firmly spec-first. Plans drive implementation, then flip to `status: completed` and stop driving anything — there is no regeneration step and no drift detection between plan and code. Durable knowledge survives via `/ba:compound` to `docs/solutions/` rather than by keeping old plans live. This is a deliberate cost trade-off: spec-anchored and spec-as-source tooling is heavy, and most of the maintenance value can be captured with named learnings surfaced by `learnings-researcher` in the next plan. The plugin's answer to Böckeler's main critique (review overload for small features) is the triage tiers in `/ba:brainstorm` and `/ba:plan` plus MR-sized decomposition in `/ba:slice` — not a spec-as-source escape hatch.

## Facts vs. specs

A competing critique ([Wasowski](https://medium.com/@wasowski.jarek/stop-writing-specs-start-writing-facts-the-entire-sdd-movement-is-already-obsolete-9045f7061e26)) argues that an executable test survives model upgrades unchanged while a prose spec gets reinterpreted on every regeneration. `dev-workflow`'s prose artifacts are deliberately ephemeral (see the SDD-ladder note above), but acceptance criteria in plans are still prose rather than executable assertions — so the plan-to-code handoff currently relies on reinterpretation. Worth knowing if regeneration stability matters to you.

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
    Otherwise?                                               → /ba:execute
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
- **Consolidated findings** — presents results as Must Address / Consider / Looks Good (the older two-bucket vocabulary; `/ba:review` uses the four-level ladder described below)

### `/ba:execute [plan]`

Implements an approved plan systematically: code changes, targeted testing, progress tracking, deviation reporting, and atomic commits.

- **Auto-detects the latest actionable plan** if no path is given; skips `status: completed` plans
- **Three plan detail levels** — MINIMAL (per acceptance criterion), STANDARD (per file block), COMPREHENSIVE (per phase with phase gates)
- **Targeted tests per task** — runs tests related to changed files, not the full suite; defers full suite + lint to completion or CI
- **Resume across sessions** — updates plan checkboxes `[ ]` → `[x]` as tasks complete; detects and resumes from partial progress
- **Deviation handling** — reports in Expected/Found/Why format, asks before proceeding, persists deviations in the plan file
- **Pre-slice scope check** — projects files-to-touch and LoC before coding; pauses via deviation handling when projection exceeds the slice's `Est. LoC` threshold.
- **Slice-aware execution** — `--slice N` executes a single slice; auto-detects next incomplete slice on sliced plans; suggests fresh context between slices
- **VCS-agnostic completion** — detects GitHub/GitLab from git remote; discovers available MR/PR tools in the environment

### `/ba:review [ref range]`

Runs post-implementation code review using seven built-in review agents plus any additional reviewers discovered in the environment.

### `/ba:compound [context]`

Documents solved problems into `docs/solutions/` so the `learnings-researcher` agent surfaces them in future brainstorm and plan sessions. Closes the knowledge compounding loop.

- **5 parallel subagents** — Context Analyzer, Solution Extractor, Related-Docs Finder, Prevention Strategist, Category Classifier
- **Auto-trigger** — fires on solution-confirmation phrases ("that worked", "it's fixed", "problem solved") with a brief confirmation prompt
- **Explicit invocation** — `/ba:compound` or `/ba:compound [context hint]` for immediate documentation
- **Structured output** — YAML frontmatter with `category`, `tags`, `module`, and `symptom` for maximum discoverability by `learnings-researcher`

- **Smart scope detection** — auto-detects feature branch vs. main, staged changes, or recent commits when no ref range is given
- **Seven built-in reviewers** — architecture, security, simplification, error handling, test coverage, deep-module design, and complexity; always available out of the box
- **Extensible** — discovers external review agents and skills; shows all reviewers (built-in and external) with overlap notes so you choose
- **Parallel dispatch** — all selected reviewers run simultaneously as independent subagents for unbiased, unbiased analysis
- **Structured findings** — Critical / High / Medium / Low / Looks Good with per-finding confidence anchors, `file:line` references, cross-reviewer dedup, and a soft confidence gate that surfaces high-noise findings in a collapsed `Suppressed` section
- **Fix application** — apply all fixes, Critical + High + Med-conf-100 (Critical + High at displayed confidence plus Medium only when confidence == 100), or one-by-one with Accept/Skip per finding; runs targeted tests after applying
- **Optional persistence** — pass `--persist` to write per-reviewer outputs and a `summary.md` to a dated `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` directory. The command does **not** modify your repo's `.gitignore`; if you want persisted runs kept out of version control, ignore `docs/reviews/` yourself (e.g. via `.git/info/exclude`, a global gitignore, or your repo's own `.gitignore`). Default behavior (no flag) is unchanged

### /ba:propose [--describe-only] [--issue <ID>]

Commit, push, and open a PR/MR with a composed title and body.

- Pure-function body composition: orchestrator gathers inputs (diff, branch, Linear, docs/solutions, preserved blocks, evidence) → composition reads value objects and returns title + body
- Host-detected dispatch: GitHub `gh`, GitLab `glab`, graceful fallback for unknown hosts (compose + push only)
- Body composition selects from Michael Lynch's 16-section menu, sized to the diff — the size-tier vocabulary is hidden behind the composition seam (no flag, no preview surface)
- Linear MCP optional with diff-derived fallback; clear preview warning when MCP is unavailable
- `docs/solutions/` auto-detection on current-branch-touched entries; per-entry confirm to splice as "What I learned"
- Cursor BugBot block and existing `## Demo` / `## Screenshots` preserved byte-identical
- Commit message and PR/MR body share the same composed markdown — no separate render path
- `--body-file` discipline (temp file + quoted-sentinel heredoc); no `git add -A`/`.`; no `--no-verify`; `--force-with-lease` only
- Preview-then-confirm always — apply / edit / regenerate-with-hint / exit

### Severity ladder and confidence anchors (`/ba:review`)

All `/ba:review` reviewers — built-in and external — emit findings under a four-level ladder + a positive bucket:

| Heading | Meaning |
|---|---|
| `## Critical` | Correctness, security, production-breaking, data-loss risk. Must fix before merge. |
| `## High` | Significant defect or risk. Strongly recommended. |
| `## Medium` | Clear improvement, not blocking. |
| `## Low` | Nit, style, micro-improvement. |
| `## Looks Good` | Positive observation. |

Each non-`Looks Good` finding carries a confidence anchor from `{0, 25, 50, 75, 100}`:

| Anchor | Meaning |
|---|---|
| `100` | Certain. |
| `75` | High; minor context risk. Default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. |
| `25` | Speculative; flag only when missing it would be costly. |
| `0` | Suppress; records the consideration without surfacing. |

A **soft confidence gate** at consolidation suppresses (not drops) findings below `Critical@50` and `High`/`Medium`/`Low@75`. Cross-reviewer agreement at the same `file:line` merges findings and promotes confidence by `+25` per additional reviewer (capped at 100), so corroboration can lift a finding past the gate. Legacy `Must Address` / `Consider` outputs from external reviewers are mapped to `High` / `Medium`.

> **Source of truth for the rubric:** `commands/ba/review.md` §4 is authoritative for the ladder, the anchor set, the floors, the merge math, and the legacy mapping. This README section is a user-facing summary — when in doubt, consult the command file.

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
| `deep-module-reviewer` | Reviews code changes for Ousterhout deep-module design principles: interface depth, dependency injection, side-effect discipline (built-in reviewer) |
| `complexity-reviewer` | Reviews code changes for Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns (built-in reviewer) |
| `plan-iteration-gate` | Validates each `/ba:review-plan` round against the planning-YAGNI / confidence-chasing ratchet — silent when iteration is clean, vocal on six trigger categories, advisory only |
| `interface-design-generator` | Generates one alternative interface design under a named Ousterhout-flavored constraint (deepest-module / common-case / info-hiding); dispatched in parallel by `/ba:brainstorm` Phase 2 when the brainstorm proposes a new module or interface |

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
| Review run artifacts (opt-in via `--persist`; not auto-ignored — user-managed) | `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` |

## Roadmap

- `/ba:review` — post-implementation code review (built-in + discovered reviewers) ✅
- `/ba:compound` — capture solved problems to `docs/solutions/` ✅
- `/ba:slice` — plan decomposition into MR-sized slices for incremental delivery ✅
- `/ba:handoff` — session continuity for multi-session work
- `/ba:execute` V3 — batch mode and subagent-driven execution
- Plan size vs human-review tax — investigate splitting `/ba:plan` output into a short decision doc (human-reviewed, ~200 lines: scope, architecture, risks, phases, slice table) + per-slice mechanical briefs (types, code stubs, test lists) generated fresh at `/ba:execute` time. Motivation: plans routinely grow past human-reviewable size (1000+ LoC) because one artifact serves both human reviewers and implementation agents; fresh per-slice briefs also catch mechanical drift (stale imports, renamed types, hallucinated helpers) that a plan-time snapshot accumulates before execution. Open questions: does the decision doc stay coherent across slices if kept that thin; can brief generation stay deterministic enough that slice N doesn't contradict slice N-1.

## License

MIT
