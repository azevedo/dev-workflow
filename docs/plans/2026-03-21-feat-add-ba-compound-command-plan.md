---
title: "feat: Add /ba:compound knowledge documentation command"
type: feat
status: in-progress
date: 2026-03-21
origin: docs/brainstorms/2026-03-21-ba-compound-brainstorm.md
detail_level: standard
tags: [compound, knowledge, learnings, docs/solutions, ba]
---

# `/ba:compound` Implementation Plan

## Overview

Add a new `/ba:compound` command that documents solved problems into `docs/solutions/` so the `learnings-researcher` agent can discover them in future `/ba:brainstorm` and `/ba:plan` sessions. Without this command, `docs/solutions/` stays perpetually empty — the learnings loop that `learnings-researcher` depends on never closes.

The command uses 5 parallel inline subagents to analyze context, extract the solution, find related docs, develop prevention strategies, and classify a category — then the orchestrator assembles and writes a single output file (see brainstorm: `docs/brainstorms/2026-03-21-ba-compound-brainstorm.md`).

## Current State

- No `/ba:compound` command exists
- `docs/solutions/` directory does not exist — `learnings-researcher` always returns "No documented solutions found" (`agents/research/learnings-researcher.md:34-36`)
- 6 existing commands in `commands/ba/` follow identical structure: YAML frontmatter (`name`, `description`, `argument-hint`), `#$ARGUMENTS` capture, numbered steps, Important Guidelines footer
- No existing command uses inline subagent definitions — all current commands reference named agents in `agents/`. Inline subagents are a justified first for this plugin (see brainstorm: convention compliance)
- compound-engineering plugin's `/ce:compound` (`compound-engineering-plugin/plugins/compound-engineering/commands/ce/compound.md`) provides the reference implementation for inline subagents, `<auto_invoke>` blocks, and `<critical_requirement>` tags
- `plugin.json` version: `0.4.0`
- README.md roadmap lists `/ba:compound` as planned (line 186)

## What We're NOT Doing

(Carried forward from brainstorm — see brainstorm: Scope Boundaries)

- **Not** adding an `/lfg` or pipeline meta-command
- **Not** adding named agent files — all agent logic stays inline in the command
- **Not** adding a schema.yaml validation layer
- **Not** modifying existing commands — pure addition to the `ba:` suite (no changes to execute/review completion flows)
- **Not** running a convention-checker gate on `docs/solutions/` output (knowledge artifact, not planning artifact — see brainstorm: Key Decisions)
- **Not** adding automated sensitive data filtering (V1 — add warning in guidelines instead)
- **Not** adding a fixed category enumeration (freeform kebab-case in V1; constrain in V2 once patterns emerge)

## Proposed Solution

A single command file at `commands/ba/compound.md` containing:

1. **Standard command frontmatter** matching the pattern of all 6 existing commands
2. **Argument capture** (`<context_hint> #$ARGUMENTS </context_hint>`) before numbered steps, matching existing convention
3. **Auto-trigger block** using `<auto_invoke><trigger_phrases>` pattern from compound-engineering
4. **Pre-flight check** — verifies sufficient conversation context, then gates on trigger type (auto-trigger shows confirmation with problem summary; explicit invocation proceeds directly)
5. **Two-phase orchestration**: Phase 1 dispatches 5 parallel subagents via explicit `Task general-purpose("...")` calls (text-only returns); Phase 2 assembles and writes the single output file
6. **File collision handling** — appends `-2`, `-3` suffixes if file already exists (ported from `/ba:research` pattern at `commands/ba/research.md:100`)

## Technical Considerations

- **Inline subagent dispatch**: Since these are inline (not named agent files), dispatch uses explicit `Task general-purpose("...")` calls with role-specific prompts. Each subagent receives a clear mission, output format, and the constraint that it must return text only — no file writes. This differs from `ce:compound`'s narrative-markdown approach but removes dispatch ambiguity for the implementer.
- **Why 5 subagents (not 3)**: Maintains 1:1 parity with the `ce:compound` reference implementation for familiarity. Each subagent has a clear single responsibility. The marginal cost of inline definitions is low (just text in the command markdown). Context Analyzer and Category Classifier were considered for merging but kept separate: Context Analyzer focuses on conversation analysis while Category Classifier focuses on the `docs/solutions/` taxonomy and file system checks.
- **Auto-trigger mechanism**: The `<auto_invoke>` block with `<trigger_phrases>` is a pattern established by compound-engineering. Claude Code's skill matching uses the command's `description` field to decide when to activate, so the description must mention the trigger behavior.
- **Auto-trigger suppression**: Auto-trigger should only fire during freeform conversation, not inside active `/ba:` command sessions. The command should note this in its guidelines.
- **Frontmatter schema expansion**: The brainstorm specified minimum frontmatter as `date`, `category`, `problem`, `tags`. This plan adds `module` and `symptom` fields — justified enhancement based on `learnings-researcher`'s actual search contract (`agents/research/learnings-researcher.md:43` scans for `tags`, `category`, `module`, `symptom`). Field names match the consumer's exact keys. Frontmatter contains searchable metadata only; narrative content belongs in document sections. This is additive, not a contradiction of the brainstorm's minimum.
- **Subagent failure policy**: Context Analyzer + Solution Extractor + Category Classifier are required (abort if any fail). Related-Docs Finder + Prevention Strategist are optional (degrade gracefully with a "Not available" note in that section).
- **Sensitive data risk**: Debugging sessions may involve secrets or PII. V1 adds a warning in the Important Guidelines section reminding the orchestrator to avoid writing secrets. Automated filtering deferred to future versions.

## System-Wide Impact

- **Interaction graph**: Command writes to `docs/solutions/[category]/`. `learnings-researcher` agent reads from `docs/solutions/**/*.md` via Glob. No callbacks or middleware — pure file-based coupling.
- **Error propagation**: Subagent failures are contained. Required-agent failure aborts the command and reports to user. Optional-agent failure produces a degraded but valid output file. File write failure shows the assembled content to the user so it's not lost.
- **State lifecycle risks**: No partial-state risk. The orchestrator assembles the complete file in memory, then writes atomically. Either the file exists or it doesn't. `mkdir -p` is idempotent.

## Implementation Approach

### Changes Required

**File 1 (NEW)**: `commands/ba/compound.md`

The command file follows the established pattern with these sections:

```markdown
---
name: ba:compound
description: "Document a recently solved problem to compound team knowledge. Use when a problem is solved -- auto-triggers on phrases like 'that worked', 'it's fixed', 'problem solved'."
argument-hint: "[optional: brief context about the fix]"
---

# Knowledge Compounding

[Intro paragraph explaining the command's purpose]

<context_hint> #$ARGUMENTS </context_hint>

## Auto-Invoke

<auto_invoke>
<trigger_phrases>
- "that worked"
- "it's fixed"
- "working now"
- "problem solved"
- "fixed it"
- "got it working"
</trigger_phrases>
</auto_invoke>

## Step 0: Pre-flight Check

Check conversation context first, then gate on trigger type:

1. Scan conversation for a problem/solution pair (at minimum: a problem statement
   and a resolution/fix). Use the context hint from arguments if provided.
2. If insufficient context: ask the user to provide more detail or a context hint.
   Do not proceed until a problem/solution pair is identifiable.
3. If auto-triggered: present a confirmation using AskUserQuestion that proves
   sufficient context exists:
   "I detected a solved problem: [brief problem summary]. Want me to document it?"
   Options: Yes (proceed) / No (cancel)
   If No: stop, do not dispatch subagents.
4. If explicitly invoked via `/ba:compound`: proceed directly (context already verified).

## Step 1: Phase 1 — Parallel Research

<critical_requirement>
Only ONE file gets written — the final documentation.
Phase 1 subagents return TEXT DATA to the orchestrator. They must NOT use Write,
Edit, or create any files. Only the orchestrator (Phase 2) writes the final file.
</critical_requirement>

<parallel_tasks>
Launch these 5 subagents IN PARALLEL using explicit Task calls:

- Task general-purpose("You are a **Context Analyzer**. Extract conversation history context: problem type, component/module, symptom (error messages, observable behavior), what was tried first. Return a YAML frontmatter skeleton with fields: date, category, problem (one-line), tags, module, symptom. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Solution Extractor**. Analyze all investigation steps in the conversation. Identify the root cause, what didn't work and why, and the working fix. Return a solution content block with code snippets formatted as markdown. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Related-Docs Finder**. Scan `docs/solutions/` for existing entries that overlap with this problem. Use Glob: `docs/solutions/**/*.md`. If the directory doesn't exist or is empty, return 'No existing docs found'. Return a list of related file paths with one-line descriptions. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Prevention Strategist**. Develop strategies to prevent this class of problem in the future. Consider: code patterns, testing, linting, documentation. Return a prevention/best-practices content block. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Category Classifier**. Determine the optimal `docs/solutions/` category and filename. Category: kebab-case slug (e.g., auth, database, testing, performance, tooling, build-errors, runtime-errors, integration-issues). Filename: YYYY-MM-DD-[3-8 word kebab-case slug].md. Check if file already exists at target path; if so, append -2, -3, etc. Return the final category and filename. Return TEXT ONLY — do not write any files.")

</parallel_tasks>

## Step 2: Subagent Failure Check

**WAIT for all Phase 1 subagents to complete.**

Required subagents (abort if any fail or return empty required fields):
- Context Analyzer — must return non-empty `category`, `problem`, `module`
- Solution Extractor — must return non-empty solution content
- Category Classifier — must return non-empty category slug and filename

Optional subagents (degrade gracefully if fail):
- Related-Docs Finder → omit "Related Documentation" section
- Prevention Strategist → omit "Prevention" section

If a required subagent fails or returns empty required fields, treat it as a failure: report it and ask the user for more context. Show any partial results collected so far.

## Step 3: Phase 2 — Assembly & Write

<sequential_tasks>

1. Collect all text results from Phase 1 subagents
2. Assemble complete markdown file:

[Output template with frontmatter and sections:
  - YAML frontmatter: date, category, problem, tags, module, symptom
  - # [Problem Title]
  - ## Problem (symptom, observable behavior, error messages)
  - ## Investigation (what was tried, what didn't work)
  - ## Root Cause (technical explanation)
  - ## Solution (step-by-step fix with code examples)
  - ## Prevention (strategies to avoid in future) — omit if Prevention Strategist failed
  - ## Related Documentation (links to overlapping docs/solutions/ entries) — omit if Related-Docs Finder failed or found nothing]

3. Validate:
   - YAML frontmatter is well-formed
   - Category slug is kebab-case, no special characters
   - Filename matches YYYY-MM-DD-[slug].md pattern
4. Create directory: `mkdir -p docs/solutions/[category]/`
5. Write the single file: `docs/solutions/[category]/[filename].md`

</sequential_tasks>

## Step 4: Present Summary

[Success output showing:
  - Subagent results (which succeeded, which degraded)
  - File path created
  - Brief content summary
  - Next steps: Continue working / View documentation / Other]

## Important Guidelines

- Only the orchestrator writes files — subagents return text data only
- Do not run a convention-checker gate — docs/solutions/ entries are knowledge artifacts
- Auto-trigger only fires during freeform conversation — suppress during active /ba: command flows
- CAUTION: Review extracted code snippets for secrets, API keys, tokens, or PII before writing
- If file write fails, show the assembled content to the user so it is not lost
- Follow YAML list format for tags: `tags: [tag1, tag2, tag3]`
- Category slugs must be kebab-case (lowercase, hyphens, no special characters)

NEVER CODE! Just document the solved problem.
```

---

**File 2 (UPDATE)**: `.claude-plugin/plugin.json`

```json
{
  "name": "dev-workflow",
  "version": "0.5.0",
  "description": "Research, brainstorm, plan, execute, review, and compound commands with triage, convention compliance, and knowledge compounding",
  "author": {
    "name": "Bruno Azevedo"
  },
  "license": "MIT",
  "keywords": [
    "research",
    "brainstorm",
    "planning",
    "execute",
    "workflow",
    "conventions",
    "review",
    "compound",
    "knowledge"
  ]
}
```

Changes: version `0.4.0` → `0.5.0`, added "compound" to description, added `compound` and `knowledge` keywords.

---

**File 3 (UPDATE)**: `CLAUDE.md`

Add to Commands section, after "Quality Commands":

```markdown
### Knowledge Commands (capture and document — never write code)

- `/ba:compound [context]` — Document solved problems to `docs/solutions/` for future learnings
```

No other CLAUDE.md changes. The Agents section stays the same (inline agents, not named). The Artifact Paths table already includes the `docs/solutions/` path.

---

**File 4 (UPDATE)**: `README.md`

Three changes:

1. **Commands section** — add after `/ba:review` entry (around line 132):

```markdown
### `/ba:compound [context]`

Documents solved problems into `docs/solutions/` so the `learnings-researcher` agent surfaces them in future brainstorm and plan sessions. Closes the knowledge compounding loop.

- **5 parallel subagents** — Context Analyzer, Solution Extractor, Related-Docs Finder, Prevention Strategist, Category Classifier
- **Auto-trigger** — fires on solution-confirmation phrases ("that worked", "it's fixed", "problem solved") with a brief confirmation prompt
- **Explicit invocation** — `/ba:compound` or `/ba:compound [context hint]` for immediate documentation
- **Structured output** — YAML frontmatter with `category`, `tags`, `module`, and `symptom` for maximum discoverability by `learnings-researcher`
```

2. **Knowledge Compounding section** (line 168-172) — update to reference the command:

```markdown
## Knowledge Compounding

The plugin includes a `docs/solutions/` knowledge base and the `/ba:compound` command to populate it. When you solve a problem, run `/ba:compound` (or let it auto-trigger) to document the solution. The `learnings-researcher` agent surfaces relevant learnings during future brainstorm and plan sessions, so the same mistakes aren't repeated.

Research docs in `docs/research/` form a second, ephemeral layer: raw investigations that inform current work. Findings worth keeping permanently graduate to `docs/solutions/` via `/ba:compound`.
```

3. **Roadmap** (line 186) — mark as done:

```markdown
- `/ba:compound` — capture solved problems to `docs/solutions/` ✅
```

### Success Criteria

#### Automated:
- [x] `ls commands/ba/compound.md` — file exists
- [x] `grep "name: ba:compound" commands/ba/compound.md` — correct frontmatter
- [x] `grep "auto_invoke" commands/ba/compound.md` — auto-trigger block present
- [x] `grep "parallel_tasks" commands/ba/compound.md` — parallel subagent dispatch present
- [x] `grep "critical_requirement" commands/ba/compound.md` — hard behavioral constraint present
- [x] `grep '"0.5.0"' .claude-plugin/plugin.json` — version bumped
- [x] `grep "ba:compound" CLAUDE.md` — command listed in CLAUDE.md
- [x] `grep "ba:compound" README.md` — command documented in README
- [x] `grep "✅" README.md | grep compound` — roadmap item marked done

#### Manual:
- [ ] Invoke `/ba:compound` after solving a test problem — verify file written to `docs/solutions/[category]/YYYY-MM-DD-[slug].md`
- [ ] Verify output file has correct YAML frontmatter: `date`, `category`, `problem`, `tags`, `module`, `symptom` (singular, matching learnings-researcher key)
- [ ] Say "that worked" in freeform conversation — verify auto-trigger fires with confirmation prompt
- [ ] Decline the auto-trigger confirmation — verify no file is written
- [ ] Invoke `/ba:compound` in a fresh session with no context — verify context guard asks for more detail
- [ ] Run `/ba:brainstorm` or `/ba:plan` after compounding — verify `learnings-researcher` discovers the file

## Dependencies & Risks

- **Risk: Auto-trigger false positives.** "That worked" is a common phrase. Mitigation: confirmation prompt on auto-trigger invocations filters false positives.
- **Risk: Category taxonomy drift.** Freeform categories may produce inconsistent slugs over time (e.g., `auth` vs `authentication`). Mitigation: examples in the Category Classifier prompt guide toward common slugs. V2 can add a fixed enumeration once patterns emerge.
- **Risk: Subagent quality variance.** 5 parallel agents analyzing conversation context may produce inconsistent or low-quality output. Mitigation: required/optional subagent policy ensures minimum viable output; orchestrator validates frontmatter before writing.
- **Risk: Sensitive data in output.** Debugging sessions may contain secrets. Mitigation: warning in Important Guidelines; no automated filtering in V1.
- **Dependency: None.** Pure addition — no changes to existing files except version, README, and CLAUDE.md.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-03-21-ba-compound-brainstorm.md` — Key decisions carried forward: inline subagents (not named files), auto-trigger + explicit invocation, no convention-checker gate on output, output path and frontmatter schema

### Internal References
- Reference implementation: `compound-engineering-plugin/plugins/compound-engineering/commands/ce/compound.md` — inline subagent pattern, `<auto_invoke>`, `<critical_requirement>`, `<parallel_tasks>` tags
- Command structure pattern: `commands/ba/research.md:1-5` — YAML frontmatter, and `:100` for file collision `-2, -3` suffix
- Learnings consumer: `agents/research/learnings-researcher.md:29-47` — expected `docs/solutions/` structure, frontmatter field scanning (`tags`, `category`, `module`, `symptom`)
- Current version: `.claude-plugin/plugin.json:2` — `0.4.0`
- Roadmap entry: `README.md:186`

## Convention Compliance

- [x] Command prefix `ba:` — aligned (CLAUDE.md line 53)
- [x] Command file path `commands/ba/compound.md` — aligned (existing pattern)
- [x] All artifacts require YAML frontmatter — aligned (CLAUDE.md line 55)
- [x] Bump version in `plugin.json` — aligned: 0.4.0 → 0.5.0 (CLAUDE.md line 56)
- [x] Update README.md — aligned (CLAUDE.md line 63)
- [x] Update CLAUDE.md — aligned: new "Knowledge Commands" category after Quality, closing the workflow loop
- [x] Learnings artifact path `docs/solutions/<category>/<filename>.md` — aligned (CLAUDE.md line 48)
- [x] Inline subagents instead of named agent files — justified override: compound-specific orchestration, no reuse outside this command (see brainstorm: convention compliance)
- [x] No convention-checker gate on `docs/solutions/` output — justified override: knowledge artifact, not planning artifact; CLAUDE.md convention 7 gates planning artifacts only (see brainstorm: convention compliance)
- [x] Frontmatter fields `module` + `symptom` added beyond brainstorm minimum — justified enhancement: field names match `learnings-researcher`'s exact search keys (`agents/research/learnings-researcher.md:43`), not a contradiction of brainstorm's minimum schema
