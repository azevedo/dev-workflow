---
title: Flatten agents/ to collapse the plugin-agent namespace
type: refactor
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-06-24
detail_level: standard
tags: [infra, plugin, agents, namespacing]
---

# Flatten agents/ to collapse the plugin-agent namespace

## Overview

Claude Code namespaces plugin agents as `<plugin>:<subdir>:<agent-name>`. The plugin's 17 agents live in `agents/research/`, `agents/review/`, and `agents/workflow/`, so they resolve as three-segment IDs (`dev-workflow:research:*`, `dev-workflow:review:*`, `dev-workflow:workflow:*`). Command files dispatch by **bare** name (`Task spec-flow-analyzer(...)`), forcing the model to reconstruct the middle subdir segment at dispatch time — which it guesses, often wrong, burning a round-trip and looking broken.

The fix (chosen in issue #26): **flatten `agents/`** — move all 17 files into `agents/` directly so the namespace collapses to single-segment `dev-workflow:<name>` (nothing to guess), and **fully-qualify every internal dispatch** to `dev-workflow:<name>` for determinism.

## Current State

- **17 agent files** across three subdirs (verified — 7 research + 7 review + 3 workflow; the issue says "18" but the actual count is 17). All filenames are unique across subdirs, so the flatten has **no collisions**.
- Agent `.md` frontmatter `name:` is already bare (e.g. `name: repo-researcher`) — it does **not** change; Claude Code derives the invocable ID from plugin + path + name.
- `.claude-plugin/plugin.json` declares no agents path/glob — Claude Code auto-discovers `agents/**`, so the flatten needs no manifest change beyond the version bump.
- Internal dispatch sites (verified):
  - `commands/ba/plan.md:74,75,170,452` — 4 `Task` dispatches.
  - `commands/ba/brainstorm.md:71,124,125,185,186,187,314` — **7** `Task` dispatch lines (the `:71` FAST-TRACK `repo-researcher` is the easily-missed 7th).
  - `commands/ba/research.md:61,62,63,67,68` — 5 prose dispatch instructions ("Use the **codebase-locator** agent…") with no separate `Task` line; the prose **is** the dispatch directive.
  - `commands/ba/review.md` — built-in reviewer table at L240–246 (bare names), the `Task <reviewer-agent>(...)` placeholder template at L413, and the user-typed resolver at L504–509.
  - `commands/ba/review-plan.md` — built-in reviewer table at L42–48; Step 3 (L126–142) has **no** literal agent dispatch template (only a skill template + per-reviewer focus prose).
- Stale subdir **path** references in live files: `commands/ba/review.md:236`, `commands/ba/review-plan.md:38`, `CLAUDE.md:70`, and the **body** of `agents/workflow/interface-design-generator.md:11` (two `agents/workflow/` occurrences on that one line, including a restatement of the suffix→role mapping).
- Not affected (verified): `commands/ba/{execute,handoff,propose}.md` (no plugin-agent dispatches); `commands/ba/compound.md` (dispatches only `general-purpose`); `marketplace.json` version (separate, already-stale `0.1.0`); README agent table (already bare + flat); README `~/.claude/agents/` mentions (external discovery dirs — must NOT change).

## Acceptance Criteria

- AC1: All 17 plugin agents resolve as single-segment `dev-workflow:<name>` IDs — the three `agents/{research,review,workflow}/` subdirs no longer exist.
- AC2: Every internal/built-in agent dispatch in the command files is fully-qualified `dev-workflow:<name>`; no bare-name internal `Task` dispatch or bare prose dispatch directive remains.
- AC3: Discovered **external** reviewers (e.g. `code-reviewer`, `dragon-test-reviewer`) still dispatch by their own discovered name — never prefixed with `dev-workflow:`.
- AC4: A user-typed built-in reviewer name in `/ba:review` resolves by matching the suffix of a registered `dev-workflow:<name>` ID and dispatches the full ID; the existing self-contained normalize→skill→agent→general-purpose ladder is preserved.
- AC5: No live file (commands, `CLAUDE.md`, `README.md`, agent bodies, plugin manifest) references the retired `agents/{research,review,workflow}/` subdir paths.
- AC6: `.claude-plugin/plugin.json` `version` is bumped; `marketplace.json` is untouched.
- AC7: All `docs/` historical artifacts are left unchanged.

## What We're NOT Doing

- **Not** editing `docs/` historical artifacts (brainstorms, plans, reviews) — they record what was true when written and are protected by the artifact-immutability convention, even though they contain bare names and old subdir paths.
- **Not** touching the `~/.claude/agents/` / `.claude/agents/` **external discovery** path mentions in `commands/ba/review.md`, `review-plan.md`, and `README.md` — those are correct and refer to the user/project agent dirs, not the plugin's subdirs.
- **Not** changing agent frontmatter `name:` fields (already bare).
- **Not** bumping `marketplace.json` version.
- **Not** namespacing conceptual prose **mentions** of agent names that are *not* dispatch directives (`commands/ba/compound.md:9`; the `brainstorm.md:183` / `plan.md:451` lead-in sentences that precede an explicit `Task` line). The bare name is the agent's identity and stays valid; only the dispatch site and stale paths change.
- **Not** adding a bare-name→ID mapping table per command (issue's rejected alternative C) — flattening + qualified dispatch is the deterministic choice.

## Proposed Solution

Two coordinated moves: (1) physically flatten `agents/` so the runtime ID becomes single-segment; (2) make every place that *drives* a dispatch name the full `dev-workflow:<name>` ID, while leaving display strings, external-reviewer names, and conceptual prose mentions bare. The dispatch-driving site differs by file: a `Task X(...)` line in plan/brainstorm; a prose "Use the **X** agent" instruction in research.md; a placeholder-fill rule in review.md/review-plan.md. Stale subdir *paths* are corrected wherever they appear in live files (including one agent body).

**Dispatch-form rule (applied consistently):** qualify the agent ID at whatever site actually drives the dispatch; fix stale subdir paths everywhere in live files; leave bare agent-name prose mentions that are not dispatch directives alone.

## Technical Considerations

- **Built-in vs external asymmetry (review.md / review-plan.md):** the new "qualify to `dev-workflow:<name>`" rule applies to **built-ins only**. External discovered agents are registered under their own namespace and must dispatch by their discovered name. The shared dispatch template must carry both rules, or over-generalization will break every external reviewer.
- **Ledger display vs dispatch ID:** the selection ledger keeps **bare** display names (readability); the dispatch resolves to `dev-workflow:<name>`. This does **not** violate the never-hide-ledger convention — that convention governs a reviewer's *presence and reachability* in the ledger/Adjust list and the `7 + count(externals)` tally, none of which the display string affects.
- **Version increment:** bump to `0.28.0` (next minor). It is the auto-update cache key; the exact increment is a minor judgment call, but it must change.

## System-Wide Impact

- **Interaction graph:** the only consumers of the agent IDs are the command files' dispatch sites; flattening + qualifying both ends (file location → registered ID, and dispatch string → that ID) keeps producer and consumer connected. No runtime code, no hooks, no MCP wiring involved.
- **Error propagation:** this is a prompt-only plugin — a wrong dispatch ID does not throw; it silently burns a round-trip (the exact symptom being fixed). There is no compiler/test gate, so static greps are the verification (see each `Verify:` line and Dependencies & Risks).
- **State lifecycle risks:** none — no persisted state. The change ships as one squashed commit, so there is no broken intermediate published state.

## Implementation Approach

### U1 — Flatten the agents/ directory and fix the one stale agent body

`git mv` all 17 files from `agents/{research,review,workflow}/*.md` into `agents/` (preserves history); confirm the three subdirs are gone (no stray files left). Edit the **body** of the moved `agents/interface-design-generator.md` line 11: replace **both** `agents/workflow/` occurrences with `agents/`, and reword the "`agents/workflow/` has -checker, -analyzer, -generator suffixes" example so it tracks the new flat naming rule (keep it consistent with U6's rewritten convention). Frontmatter `name:` fields are untouched.

Test scenarios:
- All 17 agents still present, now at `agents/<name>.md` (Covers AC1)
- `git status` shows 17 renames, nothing under the old subdirs (Covers AC1)
- The generator's example prose no longer references a defunct subdir path (Covers AC5)

Verify: `test $(find agents -mindepth 2 -name '*.md' | wc -l) -eq 0 && test $(find agents -maxdepth 1 -name '*.md' | wc -l) -eq 17 && ! grep -rq 'agents/research/\|agents/review/\|agents/workflow/' agents/`

### U2 — Fully-qualify Task dispatches in plan.md and brainstorm.md

Rewrite each `Task <name>(...)` to `Task dev-workflow:<name>(...)` at `plan.md:74,75,170,452` (4 lines) and `brainstorm.md:71,124,125,185,186,187,314` (7 lines — do not miss the FAST-TRACK `:71`). Leave the `brainstorm.md:183` / `plan.md:451` prose lead-ins bare (they are not the dispatch site).

Test scenarios:
- Each of the 4 plan.md and 7 brainstorm.md dispatches names a `dev-workflow:`-qualified ID (Covers AC2)
- No bare-name internal `Task` dispatch survives in either file (Covers AC2)

Verify: `test $(grep -c 'Task dev-workflow:' commands/ba/plan.md) -ge 4 && test $(grep -c 'Task dev-workflow:' commands/ba/brainstorm.md) -ge 7 && ! grep -qE 'Task (repo-researcher|learnings-researcher|spec-flow-analyzer|convention-checker|interface-design-generator)\(' commands/ba/plan.md commands/ba/brainstorm.md`

### U3 — Namespace the prose dispatch instructions in research.md

At `research.md:61,62,63,67,68`, change "Use the **codebase-locator** agent…" → "Use the **dev-workflow:codebase-locator** agent…" for all five (codebase-locator, codebase-analyzer, codebase-pattern-finder, research-locator, research-analyzer). These are the actual dispatch directives (no separate `Task` line exists).

Test scenarios:
- All five research/codebase agent dispatch directives carry the `dev-workflow:` prefix (Covers AC2)
- No bare "the **codebase-locator** agent"-style dispatch directive remains (Covers AC2)

Verify: `test $(grep -coE 'dev-workflow:(codebase-(locator|analyzer|pattern-finder)|research-(locator|analyzer))' commands/ba/research.md) -ge 5 && ! grep -qE 'the \*\*(codebase-locator|codebase-analyzer|codebase-pattern-finder|research-locator|research-analyzer)\*\* agent' commands/ba/research.md`

### U4 — review.md: flat path + built-in/external dispatch rules + user-typed resolver

Three edits, scoped:
1. **L236** — flatten "List the seven built-in review agents from `agents/review/`" (drop the subdir path).
2. **Step 3 dispatch template (around L413)** — add an explicit rule: built-in reviewers dispatch with `subagent_type: dev-workflow:<name>` (the ledger keeps the bare display name); **discovered external** reviewers dispatch by their own discovered name, **never** prefixed with `dev-workflow:`. State that the bare/qualified split does not affect ledger presence (never-hide).
3. **User-typed resolver (L504–509, self-contained in Step 3)** — fix step "Match against agent types" (L508) so a typed bare name matches the **suffix** of a registered `dev-workflow:<name>` ID and dispatches the full ID. Preserve the existing 4-step normalize→skill→agent→general-purpose ladder; do not introduce a parallel resolution path.

Test scenarios:
- Built-in reviewers resolve to `dev-workflow:<name>` at dispatch; ledger still shows bare names (Covers AC2)
- An external reviewer name (e.g. `code-reviewer`) dispatches unprefixed (Covers AC3)
- Typing `security-reviewer` resolves to and dispatches `dev-workflow:security-reviewer` (Covers AC4)
- No `agents/review/` subdir path remains in the file (Covers AC5)

Verify: `grep -q 'dev-workflow:' commands/ba/review.md && ! grep -q 'agents/review/' commands/ba/review.md`

### U5 — review-plan.md: flat path + add built-in qualification instruction

1. **L38** — flatten "they live in `agents/review/`".
2. **Step 3 (L126–142)** — *add* a built-in qualification instruction (none exists to edit): when dispatching a built-in reviewer via the Agent tool, use `subagent_type: dev-workflow:<name>`; external reviewers dispatch by their discovered name, unprefixed.

Test scenarios:
- Built-in reviewers in `/ba:review-plan` dispatch as `dev-workflow:<name>` (Covers AC2)
- No `agents/review/` subdir path remains in the file (Covers AC5)

Verify: `grep -q 'dev-workflow:' commands/ba/review-plan.md && ! grep -q 'agents/review/' commands/ba/review-plan.md`

### U6 — CLAUDE.md naming convention + README verification

1. **CLAUDE.md:70** — rewrite the agent-naming convention so the suffix→role mapping no longer derives from `agents/review/` / `agents/workflow/` subdirs; express it as a flat-layout rule (e.g. role suffixes `-reviewer`, `-checker`, `-analyzer`, `-locator`, `-finder`, `-researcher`, `-generator`) and add a brief note that the research/review/workflow grouping is now **conceptual only** — all agents live flat in `agents/`. Keep this consistent with the U1 generator-body reword.
2. **README.md** — verify (and it holds) that README contains **no** internal `agents/{research,review,workflow}/` path mentions; the agent table is already bare + flat. Leave the `~/.claude/agents/` external-discovery mention (L116) untouched. No table edit expected.

Test scenarios:
- CLAUDE.md naming convention reads correctly under the flat layout (Covers AC5)
- Neither CLAUDE.md nor README references any retired subdir path (Covers AC5)

Verify: `! grep -qE 'agents/(research|review|workflow)/' CLAUDE.md README.md`

### U7 — Bump plugin.json version

Bump `.claude-plugin/plugin.json` `version` `0.27.0` → `0.28.0`. Leave `marketplace.json` untouched.

Test scenarios:
- plugin.json version differs from the prior release (auto-update cache key changes) (Covers AC6)
- marketplace.json version unchanged (Covers AC6)

Verify: `grep -q '"version": "0.28.0"' .claude-plugin/plugin.json && grep -q '"version": "0.1.0"' .claude-plugin/marketplace.json`

## Dependencies & Risks

- **Final integration sweep (cross-file, run after all units):** prove no dangling bare dispatch or stale subdir path remains in live files only:
  - `grep -rn 'agents/research/\|agents/review/\|agents/workflow/' commands CLAUDE.md README.md .claude-plugin agents` → must be empty (the `agents` scope catches the U1 body fix; `docs/` is deliberately excluded).
  - `grep -rnE 'Task [a-z]' commands` → every hit must be `Task dev-workflow:<name>` or `Task general-purpose` (compound.md, skill dispatchers, custom-dimension fallback); per-file internal-dispatch counts: plan.md 4, brainstorm.md 7.
- **Runtime confirmation (manual, not a `Verify:` — requires a fresh session):** after the move, re-read the "Available agent types" system-reminder and confirm the 17 agents now appear as single-segment `dev-workflow:<name>`. Static greps prove the source is clean; only the registry proves the runtime ID. This is the same evidence source that confirmed the original three-segment problem.
- **Risk — external-reviewer over-prefixing:** if the executor applies `dev-workflow:` to *all* reviewers (not just built-ins), every external reviewer dispatch breaks. Mitigated by the explicit asymmetry rule in U4/U5.
- **Risk — hardcoding the plugin name:** fully-qualified dispatches couple command text to the `dev-workflow` plugin name. Accepted: the plugin name is stable (the `ba:` command namespace already depends on the directory), and determinism is the goal of issue #26.
- **Ship as one squashed commit** on `main` (repo convention), so there is no broken intermediate state where files have moved but dispatches still name old IDs.

## Sources & References

- Origin issue: #26 — "Flatten agents/ to collapse the plugin-agent namespace" (chosen fix: flatten; rejected alternatives A fully-qualify-with-subdirs and C bare-name→ID table).
- Stale agent body: `agents/workflow/interface-design-generator.md:11`
- Built-in dispatch placeholder: `commands/ba/review.md:413`; user-typed resolver: `commands/ba/review.md:504-509`
- Convention source for naming: `CLAUDE.md:70`; version-bump: `.claude-plugin/plugin.json:3`

## Convention Compliance

- [x] Version bump (plugin.json as auto-update cache key) — U7 bumps it; marketplace.json left alone (correct — separate, non-cache-key field)
- [x] Protected-artifacts / docs-immutability — refactor touches only `agents/` and `commands/`; `docs/` untouched (AC7)
- [x] README-update convention — U6 verifies README has no internal subdir path mentions (not merely "table is flat"), per convention-checker feedback
- [x] Never-hide selection ledger — ledger keeps bare display names; the bare/qualified dispatch split does not affect presence, reachability, or the reviewer tally (convention-checker confirmed: no conflict)
- [x] U-ID `### U<n>` minting + read-only code-matchable Verify lines — every unit carries `Test scenarios:` + one read-only grep/test `Verify:`
- [x] Planning-commands-never-write-code — this is a plan document (decisions + paths + Verify), no literal code blocks; no `**Code-shape decision:**` label needed for a mechanical mv/edit refactor
