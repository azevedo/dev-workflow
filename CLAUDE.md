# dev-workflow Plugin

Claude Code plugin providing brainstorm and plan skills with triage, convention compliance, and knowledge compounding.

## Skills

### Research Skills (investigate and document — never write code)

- `/ba-research [question]` — Conduct comprehensive codebase research with parallel sub-agents

### Planning Skills (research and document — never write code)

- `/ba-brainstorm [idea]` — Explore requirements and approaches before planning
- `/ba-plan [feature]` — Create implementation plans from feature descriptions
- `/ba-review-plan [path]` — Judged section-scoring plan review: a selection ledger over the 7 built-in reviewers with per-finding confidence and a soft gate (no external discovery)

### Execution Skills (implement approved plans)

- `/ba-execute [plan]` — Execute an approved implementation plan

### Quality Skills (review code — never write production code, only apply review fixes)

- `/ba-review [ref range]` — Post-implementation code review with built-in and discovered reviewers

### Knowledge Skills (capture and document — never write code)

- `/ba-compound [context]` — Document solved problems to `docs/solutions/` for future learnings

### Session Skills (capture context for handoff — never write code)

- `/ba-handoff [focus]` — Compact the current conversation into a handoff document (git state, in-repo artifact paths, suggested next steps) saved to `$TMPDIR` for a fresh or parallel session

### Git Workflow Skills (ship code — commit, push, open PR/MR)

- `/ba-propose [--describe-only] [--review] [--issue <ID>]` — Commit, push, and open PR/MR with a composed title and body

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
- `interface-design-generator` — Generates one alternative interface design under a named Ousterhout-flavored constraint, dispatched in parallel by `/ba-brainstorm` Phase 2 design-it-twice mode (Read, Grep, Glob, LS)

## Artifact Paths

| Artifact | Path |
|---|---|
| Brainstorm docs | `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` or `.html` |
| Plan docs | `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md` or `.html` |
| Learnings | `docs/solutions/<category>/<filename>.md` |
| Research docs | `docs/research/YYYY-MM-DD-<description>-research.md` |
| Review run artifacts | `docs/reviews/YYYY-MM-DD-HHMMSS-<scope-ref>/` |
| Format-rendering references + per-skill section contracts | `references/` |

## Conventions

- Skill layout and naming: the nine live at `skills/ba-<name>/SKILL.md` and invoke as `/ba-<name>` (full form `/dev-workflow:ba-<name>`). Each skill's frontmatter `name:` **must equal its directory basename** — the loader resolves a skill by its frontmatter `name`, so a mismatch silently unregisters it. **This is hand-maintained, not CI-verified** — no check reads skill frontmatter. The `ba` identity lives in the skill name itself, not in a directory-derived namespace, and the separator is a hyphen and never a colon: a colon is resolved only by upstream's namespace parser, which proved it can change under us, and colons in skill names break Windows paths. Nearly all of `docs/` predates the change and still spells the retired colon form; read a colon there as today's hyphen. Outside `docs/` the colon form must not appear at all — CI fails on it, with `scripts/` the single exception, since the checker and its selfcheck must name the string they forbid
- `disable-model-invocation: true` is carried by every skill **except** `ba-plan`, `ba-review-plan`, and `ba-compound`. The criterion, so the split is derivable rather than memorised: *a skill omits the flag if and only if another skill must invoke it to continue its own run.* The three in-run continuations are `ba-plan` → `ba-review-plan --auto` (Step 7 reads the verdict sentinel before proceeding), `ba-brainstorm` FAST-TRACK → `ba-plan` ("do NOT ask the user to run it manually"), and `ba-propose` Step 5f → `ba-compound` (fires on an accepted offer, mid-flow). **An end-of-run handoff is not an in-run continuation** — a Next-Steps menu has finished its work, so it prints the invocation for the user to type. That distinction is what lets the three destructive skills keep the flag: `ba-propose` pushes and opens PRs, `ba-execute` writes code and commits, `ba-review` mutates the tree applying fixes, and all three are reachable from a handoff menu. Getting this backwards is a real failure mode, not a hypothetical: three menu branches shipped claiming `Invoke /ba-review` / `/ba-propose` / `/ba-execute` directly, and the `Skill` tool refused every one at runtime
- `references/` stays at the **repo root**, shared by both `skills/` and `agents/` — it is not relocated to skill-local `skills/*/references/`, because a skill-local copy cannot serve `agents/convention-checker.md` and would force `html-rendering.md` to be duplicated across five skills, which that file's own single-source rule forbids. The two reader classes cite it in **two different forms, both correct**: skill bodies use the plugin-root-anchored `${CLAUDE_PLUGIN_ROOT}/references/<file>.md` (a skill resolves bundled paths relative to its own `SKILL.md`, so a bare path would resolve inside `skills/ba-<name>/` and miss), while `agents/convention-checker.md` cites it bare — do **not** add the plugin-root prefix there. Both spellings are correct for their reader; do not normalise them to one
- Agent names: lowercase-with-hyphens; suffix names the role — `-reviewer` for review agents; `-checker`, `-analyzer`, `-generator` for workflow agents; `-researcher`, `-locator`, `-finder` for research agents. All agents live flat in `agents/`; the research/review/workflow grouping is conceptual only.
- Artifacts require structured metadata — YAML frontmatter for markdown artifacts (`.md`), a visible-text header block for HTML artifacts (`.html`). The visible-text header block carries the same fields as the YAML frontmatter (title, type, schema version, date, etc.) rendered as readable `<dt>`/`<dd>` pairs — no `---` block and no hidden `data-*` attributes. An `.html` artifact without a YAML block is **not** a convention violation. See `references/plan-sections.md` and `references/brainstorm-sections.md` for the exact header fields per artifact type.
- Bump `version` in `.claude-plugin/plugin.json` for every release
- Planning skills (brainstorm, plan, review-plan) must never write code — only research and document
- Execution skills (execute) implement approved plans — the plan is the authority on what to build
- Convention-compliance check is mandatory before writing planning artifacts (brainstorms, plans) to disk. Both skills enforce the ordering by composing in context and naming a single write site after the gate: `ba-plan` Steps 4 → 5 → 7, `ba-brainstorm` Phases 3 → 3.5 → 3.6. Nothing before those write sites instructs a disk write, and the `## Convention Compliance` section is filled into the draft rather than appended to a file. **One deliberate exception:** `ba-brainstorm`'s FAST-TRACK path writes a minimal artifact with no gate at all — that is a *missing* gate by design (speed), not a mis-ordered one, and its template has no `## Convention Compliance` section to fill.
- Research docs (`docs/research/`) are exempt — they are pre-convention ephemeral artifacts
- Agents may declare `tools` in frontmatter to restrict available tools (e.g., locator agents use Grep, Glob, LS only — no Read)
- `/ba-review` selection is a stateless per-diff judgment — every reviewer (built-in and discovered external) appears in the **selection ledger** each run, selected or set aside with a one-line reason, and is reachable via **Adjust**. Reviewers are never silently dropped; no selection state is persisted. (This never-hide convention is mirrored in `README.md`, `skills/ba-review/SKILL.md` Step 2, and `skills/ba-review-plan/SKILL.md` (Step 2, judged section-scoring ledger over the 7 built-ins) — keep them in sync.)
- `/ba-review` and `/ba-review-plan` dispatch reviewer subagents with a protected-artifacts guard naming `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, and `docs/reviews/` — reviewers must not suggest deleting, relocating, or otherwise removing files under these roots (content review is unaffected). The guard is load-bearing for `/ba-review-plan` because the reviewed plan itself lives under `docs/plans/`.
- The reviewer rubric — the severity ladder and the confidence anchor set — is owned by the `## Code-Anchor & Confidence Grammar` section of `skills/ba-review/SKILL.md`; `skills/ba-review/SKILL.md` §4 (Step 4) owns the floors, merge math, and legacy mapping, and `README.md` carries only a user-facing summary of both. **CI pins two things and no more** — the legal-value literal and each reviewer agent's citation of the section title (see the `rubric-mirror` check in `scripts/check-invariants.mjs`, which owns the exact literal and the file list; don't restate them here). So renaming the section without updating the agents is a CI failure rather than a silent dangling citation — but **the ladder wording and the per-anchor meanings are still hand-mirrored across the `agents/*-reviewer.md` files and unchecked**. Change a severity's meaning and you must propagate it by hand; a green build does not mean the agents agree.
- Plan documents default to **decisions** (approach, exact file paths, patterns, pseudo-code for shape, test scenarios); a literal code block is permitted only under a `**Code-shape decision:** <why>` label. The label wording is mirrored across `skills/ba-plan/SKILL.md` ("Key rules for all templates" trigger block **and** the three template placeholders), `skills/ba-execute/SKILL.md` (Step 2b), and `README.md` (`/ba-plan` description) — keep them in sync. (This convention covers the *label* only; the `## Locked Design` anchor it references is owned by `skills/ba-brainstorm/SKILL.md`.)
- The **U-ID & git-derived state convention** is owned by the `## U-ID & Git-Derived State Convention` section in `skills/ba-execute/SKILL.md` (the single source of the U-ID anchor grammar, commit-subject grammar, and `derive-state` operation). The grammar is **format-neutral**: a unit anchor is a `### U<n> — <title>` heading in markdown or an HTML `U<n>` visible-text heading with a matching `id=""` attribute. Citation sites are every file marked ✓ in the **U-ID axis** column of the grid below — the grid is the single inventory, not restated here. Mirroring the never-hide-ledger pattern: any change to the convention must update all of them together.
- The **`resolve-stack-base` owned operation** is owned by the `## Stack-Base Resolution Convention` section in `skills/ba-execute/SKILL.md` — the single source of `resolve-stack-base(git, opts) → resolution`. It owns `<base>` derivation and the degrade/abort ladder (relocated from the U-ID convention) and makes the `ba-*` family correct on **stacked branches** by narrowing `<base>` to the detected stack parent. Its citation sites form a **distinct axis** from the U-ID list — any change to *either* convention must update all sites **on that axis together**. The two axes overlap on 3 files and differ at the edges (a drift trap if kept as two prose lists), so they are rendered as one grid instead:

  | File | U-ID axis | Stack-base axis |
  |---|---|---|
  | `skills/ba-plan/SKILL.md` | ✓ mints unit anchors | — grammar-only (no `<base>`) |
  | `skills/ba-execute/SKILL.md` | ✓ owner (grammar + `derive-state`) | ✓ owner (`resolve-stack-base` + `<base>`) |
  | `skills/ba-handoff/SKILL.md` | ✓ reader (`run_verify: false`) | ✓ consumer (git-first; persists `warning`) |
  | `skills/ba-propose/SKILL.md` | ✓ U-ID preserve + deviation rollup | ✓ consumer (`DIFF_BASE` + target; layers `host_signal`) |
  | `skills/ba-review/SKILL.md` | — | ✓ consumer (branch-base detection) |
  | `skills/ba-review-plan/SKILL.md` | ✓ reader (anchors findings to U-IDs) | — grammar-only (no `<base>`) |
  | `references/plan-sections.md` | ✓ names the owner + minter/consumer | — not on this axis |

  `ba-review` is on the stack-base axis but **not** the U-ID axis; `ba-review-plan` and `ba-plan` are on the U-ID axis but grammar-only for stack-base (they reference neither `<base>` nor a based `derive-state` call). `references/plan-sections.md` is the one non-skill file on either axis.
- Update README.md whenever skills, agents, or artifact paths are added or changed
- Git workflow skills (`ba-propose`) commit, push, and open PR/MR — they never modify source files outside the staged diff. The sole exception is the user-accepted `/ba-compound` **hand-off exception**: after the PR/MR is open, an accepted Step 5f capture offer hands off to `/ba-compound`, which writes only to `docs/solutions/` — after the push, never as part of the pushed diff (this convention line and `skills/ba-propose/SKILL.md` Guidelines are the two authoritative mirror sites; `README.md`'s `/ba-propose` feature list carries a user-facing summary of the same behavior — keep all three in sync)
- This repo's product is prompt text, so a rule added to a skill, agent, or reference file is a runtime change. Before adding one, decide which kind it is: a **machine-boundary contract** (a sentinel, parser grammar, anchor format, ordering or path invariant — anything two processes must agree on) is specified to the character; **steering for the model's own judgment** states the goal and stops. Only the first earns literal specification. Prompt changes are decided by fixture A/B, not by argument — there is no automated suite, and a session cannot dry-run the body it loaded at start. Full convention, including the review checklist for prompt-touching diffs: `.claude/agent_docs/prompt-authoring.md` — read it when a diff touches `skills/`, `agents/`, or `references/`
- The roadmap lives in **GitHub issues**, hubbed by **#29** (`[meta] dev-workflow roadmap` — the "where do I start" map, not the raw issue list). Items use `[roadmap]`-prefixed titles, `cluster:*` lanes, `ready`/`deferred`/`declined`/`needs-brainstorm` states, and a documented revisit trigger for deferred/declined. Research/comparison docs are linked from issues as evidence — never spun into a competing roadmap doc (converge in issues). Full convention: `.claude/agent_docs/roadmap-management.md`
