---
date: 2026-03-21
topic: ba-compound-knowledge-documentation
status: approved
triage_level: full
tags: [compound, knowledge, learnings, docs/solutions, ba]
---

# `/ba:compound` — Knowledge Documentation Command

## What We're Building

A new `/ba:compound` command that documents solved problems into `docs/solutions/` so the `learnings-researcher` agent can discover them in future `/ba:brainstorm` and `/ba:plan` sessions. Without this command, `docs/solutions/` stays perpetually empty — the learnings loop that `learnings-researcher` depends on never closes.

The command runs on explicit invocation (`/ba:compound`) or auto-triggers when the user confirms a problem is solved ("that worked", "it's fixed", "problem solved", "working now"). Internally it dispatches 5 parallel subagents to analyze context, extract the solution, find related existing docs, develop a prevention strategy, and classify a category — then assembles and writes a single output file.

## Why This Approach

Three approaches were considered:

- **Inline subagents in the command (chosen):** All 5 subagent roles described inside `commands/ba/compound.md`. Self-contained, no extra agent files to maintain. Consistent with compound-engineering's implementation.
- **Named agent files in `agents/workflow/`:** Each subagent gets its own file. Rejected — these agents have no reuse outside this command; naming them separately adds file overhead with no benefit.
- **Single-agent (lightweight):** One agent does everything sequentially. Rejected — user explicitly chose full parallel orchestration for richer output (prevention strategies, related-docs linking, categorization).

## Key Decisions

- **Command prefix:** `ba:compound` — follows `ba:` naming convention
- **File location:** `commands/ba/compound.md`
- **Trigger:** Both auto-trigger on solution-confirmation phrases AND explicit `/ba:compound` invocation
- **Auto-trigger phrases:** "that worked", "it's fixed", "working now", "problem solved", "fixed it", "got it working"
- **Orchestration:** 5 parallel inline subagents; all return text data only; orchestrator writes the single output file — no scattered intermediate files
- **The 5 subagents:**
  1. **Context Analyzer** — what was happening before, what code was involved, what was tried first
  2. **Solution Extractor** — exactly what was done to fix it, including code snippets
  3. **Related-Docs Finder** — scans `docs/solutions/` for existing entries that overlap
  4. **Prevention Strategist** — how to prevent this class of problem in the future
  5. **Category Classifier** — assigns a category slug (auth, database, testing, performance, tooling, etc.)
- **Output path:** `docs/solutions/[category]/YYYY-MM-DD-[slug].md`
- **Output frontmatter:** `date`, `category`, `problem` (one-line), `tags`
- **No convention-checker gate on output:** `docs/solutions/` entries are knowledge artifacts, not planning artifacts. CLAUDE.md convention 7 gates "planning artifacts (brainstorms, plans)" only. Gate does not apply.
- **Version bump:** `.claude-plugin/plugin.json` (not marketplace.json)
- **README.md** update required

## Scope Boundaries

- Does **not** add an `/lfg` or pipeline meta-command
- Does **not** add named agent files — all agent logic stays inline in the command
- Does **not** add a schema.yaml validation layer
- Does **not** modify existing commands — pure addition to the `ba:` suite
- Does **not** run a convention-checker gate on `docs/solutions/` output (by decision above)

## Acceptance Criteria

- `docs/solutions/[category]/YYYY-MM-DD-[slug].md` is written after invoking `/ba:compound` on a solved problem
- Output file has YAML frontmatter with at minimum: `date`, `category`, `problem`, `tags`
- Auto-trigger fires when user types any of the trigger phrases
- Explicit `/ba:compound` invocation also works
- Only the orchestrator writes files — subagents return text only
- `learnings-researcher` (unchanged) discovers these files in future sessions
- `.claude-plugin/plugin.json` version is bumped
- `README.md` reflects the new command

## Open Questions

(none — all resolved before handoff)

## Convention Compliance

- `ba:` prefix: **ALIGNED**
- `commands/ba/compound.md` path: **ALIGNED**
- YAML frontmatter on output: **ALIGNED**
- `docs/solutions/<category>/<filename>.md` artifact path: **ALIGNED**
- README.md update: **ALIGNED**
- Planning command never writes code: **ALIGNED**
- Inline subagents instead of named agents: **JUSTIFIED** — compound-specific orchestration, no reuse outside this command
- No convention-checker gate on `docs/solutions/`: **JUSTIFIED** — knowledge artifact, not planning artifact; CLAUDE.md convention 7 gates planning artifacts only
- Version bump target corrected to `plugin.json`: **ALIGNED** (violation found + resolved)

## Next Steps

→ `/ba:plan` to create implementation plan
