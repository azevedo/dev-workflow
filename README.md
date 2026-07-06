# dev-workflow

A Claude Code plugin that adds structured research, brainstorm, plan, and execute commands to your development workflow.

## Why

The #1 failure mode in AI-assisted development is jumping straight to implementation. This plugin enforces a think-first workflow: investigate the codebase (`/ba:research`), explore what to build (`/ba:brainstorm`), define how to build it (`/ba:plan`), review before writing code (`/ba:review-plan`), then implement (`/ba:execute`). Post-implementation review (`/ba:review`) and knowledge compounding (`/ba:compound`) close the loop so the same mistakes aren't repeated.

The design synthesizes patterns from three production agent workflow systems ([compound-engineering](https://github.com/EveryInc/compound-engineering-plugin), [humanlayer](https://github.com/humanlayer/12-factor-agents), [superpowers](https://github.com/obra/superpowers)), taking the best ideas from each and closing gaps they all share.

## Position on the SDD ladder

In Birgitta Böckeler's [framing of spec-driven development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html), SDD tools sit at one of three levels: **spec-first** (write the spec before the code), **spec-anchored** (keep the spec in sync with the code after shipping, and use it to drive evolution), and **spec-as-source** (the spec is the only thing humans edit; code is fully derived output).

`dev-workflow` is firmly spec-first. Plans drive implementation and are read-only at execute time — progress is git-derived (U-tagged commit subjects + per-unit `Verify:` checks), not tracked by mutating the plan file. There is no regeneration step and no drift detection between plan and code. Durable knowledge survives via `/ba:compound` to `docs/solutions/` rather than by keeping old plans live. This is a deliberate cost trade-off: spec-anchored and spec-as-source tooling is heavy, and most of the maintenance value can be captured with named learnings surfaced by `learnings-researcher` in the next plan. The plugin's answer to Böckeler's main critique (review overload for small features) is the triage tiers in `/ba:brainstorm` and `/ba:plan` — not a spec-as-source escape hatch.

## Facts vs. specs

A competing critique ([Wasowski](https://medium.com/@wasowski.jarek/stop-writing-specs-start-writing-facts-the-entire-sdd-movement-is-already-obsolete-9045f7061e26)) argues that an executable test survives model upgrades unchanged while a prose spec gets reinterpreted on every regeneration. `dev-workflow`'s prose artifacts are deliberately ephemeral (see the SDD-ladder note above), but acceptance criteria in plans are still prose rather than executable assertions — so the plan-to-code handoff currently relies on reinterpretation. Worth knowing if regeneration stability matters to you.

## Install

```bash
claude plugin marketplace add azevedo/dev-workflow
claude plugin install dev-workflow
```

### Updating

Updates are pulled automatically from the marketplace; no manual step required.

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

After planning, implement with /ba:execute.
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

Brainstorm docs are saved to `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` (default) or `.html`.

**HTML output:** pass `output:html` in the brainstorm request to produce a self-contained HTML5 file instead. For UI-shaped requirements, the HTML path adds a wireframe affordance (low-fidelity gray-box layout with a mandatory "directional, not the spec" caption). See "Choosing `md` vs `html`" below.

### `/ba:plan [feature]`

Transforms feature descriptions into implementation plans with exact file paths and decisions (literal code only under a `**Code-shape decision:**` label, where the code's shape is the design decision).

- **Auto-detects brainstorms** — searches `docs/brainstorms/` for recent (14-day) topic-matched docs and carries forward all decisions
- **Parallel research** — dispatches agents to analyze codebase patterns and search prior learnings
- **Conditional external research** — risk-based: security/payments always research externally; known patterns skip it
- **Three detail levels** — MINIMAL (simple bugs), STANDARD (most features), COMPREHENSIVE (major features with phased implementation and phase gates)
- **SpecFlow analysis** — agent maps all user flows, identifies edge cases and gaps before plan is finalized
- **"What We're NOT Doing"** — every plan includes explicit scope boundaries

Plans are saved to `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` (default) or `.html`.

**HTML output:** pass `output:html` in the plan request to produce a self-contained HTML5 file. HTML plans render implementation units as collapsible `<details>` cards — useful for large plans with many units. See "Choosing `md` vs `html`" below.

#### Choosing `md` vs `html`

The deciding axis is **how humans touch the artifact** — agents read either format equally (the design intent).

Prefer **`md`** (and keep it the default) when:
- The artifact is reviewed in a git diff or PR — HTML diffs are noise.
- The artifact will be hand-edited inline.
- The plan is small/linear (a few units, no need for collapsible cards).
- Running in automation or default paths.

Prefer **`html`** when:
- The plan is large and read-mostly — collapsible unit cards + navigation solve the wall-of-text problem.
- A brainstorm has UI-shaped requirements (wireframes are an HTML-only affordance).
- The plan includes diagrams worth inline SVG.
- The audience is primarily browser-reading humans.

**The mode is exclusive:** `md` and `html` are mutually exclusive per artifact — never both. The format is locked on first write and preserved on resume. HTML *fixes reading* but *worsens git review* — choose per artifact.

### `/ba:review-plan [path]`

Runs a judged section-scoring review against a plan before implementation. The judge scores the plan's sections and targets the weak or risky ones, presenting a **selection ledger** over the seven built-in reviewers — no environment discovery.

This catches issues at plan time — where fixing things is cheap — instead of after code is written.

- **Auto-detects the latest plan** if no path is given
- **Judged selection ledger** — scores the plan against the 7 built-in reviewers and presents the full roster (selected + set aside, each with a one-line reason citing the weak section); every reviewer reachable via Adjust (including an "Other" free-text external), nothing hidden, no state persisted
- **Confidence soft gate** — per-finding confidence with cross-reviewer dedup and per-tier floors (Must-Address ≥ 50, Consider ≥ 75); below-floor findings move to a separate `Suppressed` section, not lost
- **Plan-anchored findings** — each finding anchors to a plan **section heading**, a `### U<n>` unit, or a keyed `AC<n>`; anchors that don't resolve in the plan are dropped and counted
- **Plan-aware framing** — tells each reviewer it's evaluating a proposal, not finished code
- **Auto-runs in `/ba:plan`** — at the end of planning, a self-suppressing section-scoring pass runs automatically: on a clean plan it stays silent (no widgets, "no weak sections"); on weak sections it surfaces the ledger and asks before dispatching

### `/ba:execute [plan]`

Implements an approved plan systematically: code changes, targeted testing, progress tracking, deviation reporting, and atomic commits.

- **Auto-detects the latest `plan_schema: 2` plan** if no path is given; refuses plans without the schema discriminator with re-plan guidance
- **Three plan detail levels** — MINIMAL (per unit), STANDARD (per unit), COMPREHENSIVE (per phase with automated checkpoints)
- **Targeted tests per task** — runs tests related to changed files, not the full suite; defers full suite + lint to completion or CI
- **Resume across sessions via git** — U-ID commit subjects + per-unit `Verify:` against code; no plan-file mutations
- **Deviation handling** — reports in Expected/Found/Why format, asks before proceeding; deviations surface in the MR/PR body and Linear ticket via `Deviation (U<n>):` commit trailers rolled up by `/ba:propose`, never the plan file
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
- **Smart selection** — discovers external review agents and skills, then reads the diff and judges which reviewers have real work; presents the full roster as a **selection ledger** (selected + set aside, each with a one-line reason, overlaps named) for a one-step confirm or adjust. Nothing hidden, every reviewer reachable, no state persisted
- **Parallel dispatch** — all selected reviewers run simultaneously as independent subagents for unbiased analysis
- **Structured findings** — Critical / High / Medium / Low / Looks Good with per-finding confidence anchors, `file:line` references, cross-reviewer dedup, and a soft confidence gate that moves high-noise findings into a separate `Suppressed` section
- **Fix application & own-MR resolution** — for local scopes and your **own** MR (authorship detected
  from `gh`/`glab`), apply fixes locally: accept all recommendations, Critical + High + Med-conf-100, or a one-by-one walk
  where each finding leads with a recommended disposition (**Apply / Skip / Modify**). A precondition
  check confirms the local tree matches the reviewed diff before editing; after applying, a guard runs
  **bidirectional reconciliation** of accepted-vs-applied and then a **verify-then-keep** targeted-test
  pass that **auto-reverts + resurfaces** any fix that fails. Reviewing **someone else's** MR stays
  posting-only. See
  `commands/ba/review.md` §5 for the authoritative resolution flow.
- **Optional persistence** — pass `--persist` to write per-reviewer outputs and a `summary.md` to a dated `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` directory. The command does **not** modify your repo's `.gitignore`; if you want persisted runs kept out of version control, ignore `docs/reviews/` yourself (e.g. via `.git/info/exclude`, a global gitignore, or your repo's own `.gitignore`). Default behavior (no flag) is unchanged

### /ba:propose [--describe-only] [--review] [--issue <ID>]

Commit, push, and open a PR/MR with a composed title and body.

- Pure-function body composition: orchestrator gathers inputs (diff, branch, Linear, docs/solutions, preserved blocks, proof, risk, focus areas) → composition reads value objects and returns title + body
- Host-detected dispatch: GitHub `gh`, GitLab `glab`, graceful fallback for unknown hosts (compose + push only)
- Body composition selects from Michael Lynch's 16-section menu, sized to the diff — the size-tier vocabulary is hidden behind the composition seam (no flag, no preview surface)
- **U-ID preservation** — never strips or rewrites `/ba:execute`'s U-tagged commit subjects (`U<n>` per the convention in `execute.md`); PR/MR title is U-ID-free by design
- **Proof** — always-on one-line signal, auto-detected from the diff (test file touched, visual evidence preserved from the PR body, docs-only, or pending); no blocking question
- **Risk lead-line** — an always-on, un-headed `**Risk:** low/medium/high — <reason>` line at the top of the body, deterministically derived from sensitive paths, size, and breaking-change signals; absent at typo tier
- **Where to look** — an earned `## Where to look` section naming 1–2 hotspot areas on medium+ diffs, omitted when there's no dominant hotspot
- **Deviation fold** — scans `DIFF_BASE..HEAD` commit bodies for `Deviation (U<n>):` trailers and folds genuinely reviewer-relevant substance into the Impact prose (no standalone header, no `U<n>` shown); the commit trailer and Linear ticket rollup (when linked) are unchanged; warns on near-matches at preview
- Linear MCP optional with diff-derived fallback; clear preview warning when MCP is unavailable
- `docs/solutions/` auto-detection on current-branch-touched entries; per-entry confirm to splice as "What I learned"
- Cursor BugBot block and existing `## Demo` / `## Screenshots` preserved byte-identical
- Commit message and PR/MR body share the same composed markdown — no separate render path
- `--body-file` discipline (temp file + quoted-sentinel heredoc); no `git add -A`/`.`; no `--no-verify`; `--force-with-lease` only
- **Apply-by-default** — every `ACTION` applies without a confirmation prompt by default; pass `--review` (alias `--interactive`) or set `BA_PROPOSE_REVIEW=1` to restore the Apply / edit / regenerate-with-hint / exit menu and the Step 0b edit-only confirm

### `/ba:handoff [focus]`

Compacts the current conversation into a handoff document saved to your OS temp directory (`$TMPDIR`), so a fresh or parallel session can pick up the work without re-reading the transcript.

- **Git-state aware** — records branch, dirty/clean, and pushed/unpushed so the next session knows where the code stands
- **References, doesn't restate** — points at in-repo artifacts by path (`docs/brainstorms/`, `docs/plans/`, `docs/research/`, `docs/solutions/`, `docs/reviews/`) instead of duplicating them
- **Execution-aware** — if you're mid-`/ba:execute`, names the plan path and narrates U-resolution via `derive-state` (subject scan only, no `Verify:` side effects): units are `done-via-subject` (committed) or `pending`
- **Suggested next steps** — lists exact slash invocations for the next agent to run, not prose hints
- **Verified facts only** — redacts secrets and never fabricates paths, IDs, or test results

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

### U-ID & git-derived state convention

The **U-ID & Git-Derived State Convention** (owned by the `## U-ID & Git-Derived State Convention` section in `commands/ba/execute.md`) is the single source of the implementation-unit anchor grammar, commit-subject grammar, and `derive-state` operation. The grammar is **format-neutral**: a unit anchor is a `### U<n> — <title>` heading in markdown or an HTML `U<n>` visible-text heading with a matching `id=""` attribute. All five citation sites must be updated together when the convention changes: `commands/ba/plan.md` (mints unit anchors), `commands/ba/execute.md` Step 2e (applies the grammar), `commands/ba/propose.md` (preserves U-tagged subjects + rolls up `Deviation (U<n>):` trailers), `commands/ba/handoff.md` (calls `derive-state` with `run_verify: false`), `commands/ba/review-plan.md` (anchors findings to U-IDs and keyed `AC<n>`).

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
| `interface-design-generator` | Generates one alternative interface design under a named Ousterhout-flavored constraint (deepest-module / common-case / info-hiding); dispatched in parallel by `/ba:brainstorm` Phase 2 when the brainstorm proposes a new module or interface |

## Knowledge Compounding

The plugin includes a `docs/solutions/` knowledge base and the `/ba:compound` command to populate it. When you solve a problem, run `/ba:compound` (or let it auto-trigger) to document the solution. The `learnings-researcher` agent surfaces relevant learnings during future brainstorm and plan sessions, so the same mistakes aren't repeated.

Research docs in `docs/research/` form a second, ephemeral layer: raw investigations that inform current work. Findings worth keeping permanently graduate to `docs/solutions/` via `/ba:compound`.

## Artifact Paths

| Artifact | Path |
|---|---|
| Research docs | `docs/research/YYYY-MM-DD-<description>-research.md` |
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` or `.html` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` or `.html` |
| Learnings | `docs/solutions/<category>/<filename>.md` |
| Review run artifacts (opt-in via `--persist`; not auto-ignored — user-managed) | `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` |
| Format-rendering references + per-command section contracts | `references/` |

## Roadmap

The roadmap lives in **GitHub issues**, hubbed by **[#29 — dev-workflow roadmap](https://github.com/azevedo/dev-workflow/issues/29)** — the "where do I start?" map (not the raw issue list). Items use a `[roadmap]` title prefix, `cluster:*` lanes (autonomy / polish / review-quality / infra) and `ready` / `deferred` / `declined` / `needs-brainstorm` states; deferred and declined items carry a documented revisit trigger. See [`.claude/agent_docs/roadmap-management.md`](.claude/agent_docs/roadmap-management.md) for the full convention.

## License

MIT
