---
date: 2026-06-21
topic: comment-guard-hook-personal-setup
status: approved
triage_level: standard
tags: [hooks, comment-guard, settings, personal]
---

# Comment-Guard Hook: Fully Personal Setup

## What We're Building
A PostToolUse hook that fires after any Edit/Write/MultiEdit: if the edit added ≥2 full-line comments to a code file, inject a system reminder listing those lines and re-assert the why-comments-only convention. Script lives at `~/.claude/hooks/comment-guard.sh`, wired globally in `~/.claude/settings.json`. Not tied to any plugin.

## Why This Approach
Two sessions produced conflicting designs. The tensions were hook timing (PreToolUse block vs PostToolUse warn) and scope (plugin vs personal).

**Timing.** PostToolUse wins. The comment has already landed, but the hook fires on the small fresh diff at the exact moment the reminder is salient and cheap to act on. Never blocks a legitimate edit. PR #39 already built this correctly.

**Scope.** Three plugin-adjacent options were evaluated and rejected:
- *Plugin-scoped (dev-workflow `hooks/hooks.json`)* — the hook auto-applies to all consumers; a personal style preference shouldn't be imposed on others.
- *Separate marketplace plugin* — maintenance overhead of a new repo for a single personal hook is not worth it.
- *Global settings.json + script in plugin* — awkward split ownership; script lives in the plugin but wiring is personal.

Fully personal wins: script and wiring both in `~/.claude/`. Self-contained, zero plugin involvement.

## Key Decisions
- **PostToolUse hook**: fires immediately after the edit, on the fresh diff — salient and non-blocking
- **Personal scope**: `~/.claude/settings.json` for wiring, `~/.claude/hooks/comment-guard.sh` for the script
- **Script source**: extract from PR #39's `scripts/comment-guard.sh` as starting point — extension-aware, tunable threshold, fail-safe exits already implemented
- **PR #39**: close without merging — wrong scope; the script is a reference implementation only

## Scope Boundaries
- Not shipping anything in the dev-workflow plugin
- No `hooks/hooks.json`, no `scripts/` changes in the plugin repo
- No CLAUDE.md, README.md, or `plugin.json` changes to dev-workflow
- Implementation is entirely in `~/.claude/`

## Acceptance Criteria
- `~/.claude/hooks/comment-guard.sh` exists and is executable
- `~/.claude/settings.json` has a PostToolUse matcher for `Edit|Write|MultiEdit` pointing to the script
- Hook fires after editing a code file that added ≥2 full-line comment lines; lists those lines in a system reminder; silent otherwise
- Hook exits 0 silently for `.md`, `.json`, `.yaml`, and unrecognized extensions
- Works in any Claude Code session regardless of which project or plugin is active

## Open Questions
(none)

## Convention Compliance
No plugin conventions apply — implementation is entirely in `~/.claude/`. No dev-workflow plugin files are modified. Convention check confirmed: no violations.

## Next Steps
→ `/ba:plan` to create implementation plan (close PR #39, copy script to `~/.claude/hooks/`, wire via `update-config`)
