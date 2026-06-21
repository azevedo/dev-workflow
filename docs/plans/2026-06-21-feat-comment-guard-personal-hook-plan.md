---
title: "feat: Comment-guard personal PostToolUse hook"
type: feat
status: completed
date: 2026-06-21
origin: docs/brainstorms/2026-06-21-comment-guard-hook-personal-setup-brainstorm.md
detail_level: minimal
iteration_count: 0
tags: [hooks, comment-guard, settings, personal]
---

# feat: Comment-guard personal PostToolUse hook

Install a `PostToolUse` hook in the personal `~/.claude/` setup that fires after any `Edit`/`Write`/`MultiEdit`. When the edit added ≥2 full-line comment lines to a *code* file, it injects a system reminder listing those exact lines and re-asserts the why-comments-only convention; it stays silent otherwise. The script and its wiring both live in `~/.claude/` — nothing ships in the dev-workflow plugin (see brainstorm: `docs/brainstorms/2026-06-21-comment-guard-hook-personal-setup-brainstorm.md`).

The implementation script is extracted, near-verbatim, from PR #39's reviewed reference `scripts/comment-guard.sh`. PR #39 itself is closed without merging — it was built at the wrong scope (plugin-wide); the script is a reference implementation only (see brainstorm: Key Decisions).

## Acceptance Criteria

- [x] `~/.claude/hooks/comment-guard.sh` exists and is executable (`chmod +x`)
- [x] `~/.claude/settings.json` has a `PostToolUse` matcher for `Edit|Write|MultiEdit` pointing to the script via absolute path
- [x] Editing a code file that added ≥2 full-line comment lines fires the hook, listing those lines in a system reminder
- [x] The hook is silent when fewer than `COMMENT_GUARD_MIN_COMMENTS` (default 2) comment lines were added
- [x] The hook exits 0 silently for `.md`, `.json`, `.yaml`, and unrecognized extensions
- [x] Works in any Claude Code session regardless of active project or plugin
- [x] PR #39 is closed (not merged) with a comment explaining the scope change
- [x] No dev-workflow plugin file is modified (only the plan doc itself is written to the repo)

## What We're NOT Doing

- Not shipping anything in the dev-workflow plugin — no `hooks/hooks.json`, no `scripts/` changes, no `CLAUDE.md` / `README.md` / `plugin.json` edits (see brainstorm: Scope Boundaries)
- Not creating a separate marketplace plugin for the hook
- Not handling block comments (`/* */`, `<!-- -->`) — out of scope, inherited from the reference script
- Not changing the detection logic, extension map, threshold mechanism, or fail-safe behavior of the reference script — those are carried over as-is
- Not merging PR #39

## Behaviors to Test

- [x] Editing a `.ts` file that adds 2+ full-line `//` comments → reminder fires listing those lines
- [x] Editing a `.py` file that adds 2+ full-line `#` comments → reminder fires (and a leading `#!` shebang is not counted)
- [x] Editing a code file that adds only 1 comment line → silent (below default threshold)
- [x] Editing a `.md` / `.json` / `.yaml` file with comment-like lines → silent (skipped extension)
- [x] An inline trailing comment (`x = 1  # note`) or a marker inside a string/URL (`"https://..."`) does NOT count as a full-line comment
- [x] `jq` unavailable or malformed hook input → exits 0, no output, edit undisturbed
- [x] Editing a `.ex`/`.exs` (Elixir) file that adds 2+ full-line `#` comments → reminder fires

## Context

**Reference script (source of truth for the body):** PR #39 `scripts/comment-guard.sh` (98 lines) — extension-aware full-line comment detection via `awk`, `COMMENT_GUARD_MIN_COMMENTS` tuning (default 2), 10-line quoted listing cap, fail-safe `exit 0` on missing `jq` / empty input / unlisted extension, `jq -n` emitting `hookSpecificOutput.additionalContext`. View with: `gh pr diff 39`.

**Current `~/.claude/settings.json` `hooks` block** has only a `Stop` entry. The new `PostToolUse` key is added as a sibling. Existing user hooks (`Stop`, `statusLine`) use absolute paths (`/Users/bruno.azevedo/.claude/...`), so the new wiring follows suit — there is no `${CLAUDE_PLUGIN_ROOT}` for a personal hook.

**Why-comments convention:** this is Bruno's personal cross-project preference, so the reminder text is framed as a comment convention, not a single project's rule.

## MVP

### `~/.claude/hooks/comment-guard.sh`

Copy PR #39's `scripts/comment-guard.sh` verbatim, then apply two surgical message-text edits (the detection/fail-safe logic is unchanged) and make it executable:

1. **Drop the plugin attribution** in the reminder header. The reference reads `Comment-style check (dev-workflow) — this edit to ${file_path} ...`. For a personal hook with no plugin involvement, remove the `(dev-workflow)` tag → `Comment-style check — this edit to ${file_path} ...`.
2. **Reframe the convention label** from project-specific to personal. The reference reads `Project convention: comments are why-comments only.` → `Comment convention: comments are why-comments only.` (rest of the sentence unchanged).
3. `chmod +x ~/.claude/hooks/comment-guard.sh`.

Everything else — the `set -u` (no `set -e`) preamble, `command -v jq` guard, the `jq` extraction of `content`/`new_string`/`file_text`/`edits[].new_string`, the lowercased-extension `case` map, the `awk` full-line-comment collector (trim leading whitespace, skip blank lines, skip `#!` shebang, prefix-match on the trimmed line), the `min_comments` threshold gate, the `head -10` listing cap with "… and N more", and the `jq -n` `hookSpecificOutput` emission — is carried over unchanged.

**Code-shape decision:** the reminder-message string is the one piece whose exact wording is a decision (it's user-facing and the personal-vs-plugin framing matters), and it's embedded inside a multi-line `printf` in the copied script. Reproducing the target lines verbatim removes ambiguity about what "adapt the attribution" means during execution. Anchor: PR #39's reference script (the brainstorm has no `## Locked Design`).

```sh
# Target wording after the two edits (the surrounding printf/script is copied as-is):
msg="$(printf '%s' "Comment-style check — this edit to ${file_path} added ${count} comment line(s):

${listing}${extra}

Comment convention: comments are why-comments only. Keep non-obvious rationale, workarounds, and invariant explanations; delete anything that merely restates what the code already says. Re-read the comment lines above now and remove the redundant ones before continuing.")"
```

### `~/.claude/settings.json`

Add a `PostToolUse` key alongside the existing `Stop` entry in the `hooks` object. Use the `update-config` skill to apply the edit (per brainstorm Next Steps), preserving the rest of the file.

Decisions:
- Matcher: `"Edit|Write|MultiEdit"`
- Single command hook: `bash /Users/bruno.azevedo/.claude/hooks/comment-guard.sh` (absolute path — no `${CLAUDE_PLUGIN_ROOT}` for personal scope)
- `"timeout": 10` (matches the reference `hooks.json`)
- Not `async` — the reminder must be injected into the same turn's context to be salient (unlike the `Stop` sound, which is fire-and-forget)

```json
// Shape of the PostToolUse entry added under "hooks" (sibling of "Stop"):
"PostToolUse": [
  {
    "matcher": "Edit|Write|MultiEdit",
    "hooks": [
      {
        "type": "command",
        "command": "bash /Users/bruno.azevedo/.claude/hooks/comment-guard.sh",
        "timeout": 10
      }
    ]
  }
]
```

**Code-shape decision:** the settings.json hook object has a precise required shape (`matcher` + `hooks[].type/command`); an approximate paraphrase risks a malformed entry that silently fails to fire. Anchor: existing `Stop` hook shape in the same file + the reference `hooks/hooks.json` from PR #39.

### Close PR #39

`gh pr close 39` with a brief comment: closed without merging — built at plugin scope, which imposes a personal style preference on all consumers; the script was extracted into a personal `~/.claude/` hook instead (see brainstorm decision). Do not delete the branch reference if it's the only copy of the script until the personal script is confirmed in place.

## Verification

### Automated
- [x] `test -x ~/.claude/hooks/comment-guard.sh` — exits 0
- [x] `jq '.hooks.PostToolUse[0].matcher' ~/.claude/settings.json` → `"Edit|Write|MultiEdit"`
- [x] `jq -e . ~/.claude/settings.json >/dev/null` — settings.json is still valid JSON after the edit
- [x] Pipe a synthetic `Write` payload (a `.ts` file with 2 full-line `//` comments) into the script → emits `hookSpecificOutput.additionalContext` listing both lines
- [x] Same payload with a `.md` file path → no output, exit 0
- [x] `gh pr view 39 --json state` → `"CLOSED"`

### Manual
- [x] Confirm the reminder text reads "Comment-style check —" (no `(dev-workflow)` tag) and "Comment convention:" — verified via the script's emitted `additionalContext`
- [x] Confirm a normal edit with no added comments produces no reminder — verified (1-comment and skipped-extension cases emit nothing)
- [ ] In a fresh Claude Code session in an unrelated project, edit a code file adding 2+ comment lines → the system reminder appears in-context *(requires a new session to pick up the settings.json change; cannot be verified from within the session that wrote it)*

## Sources

- Origin brainstorm: `docs/brainstorms/2026-06-21-comment-guard-hook-personal-setup-brainstorm.md` — carried-forward decisions: PostToolUse timing, fully-personal scope, PR #39 as reference-only / close-without-merge
- Reference implementation: PR #39 `scripts/comment-guard.sh` and `hooks/hooks.json` (`gh pr diff 39`)
- Wiring target: `~/.claude/settings.json` (`hooks` block, currently `Stop`-only)

## Convention Compliance

The brainstorm completed the convention-compliance check with an explicit finding: **no dev-workflow plugin conventions apply** because the implementation lives entirely in `~/.claude/` and modifies zero plugin files (brainstorm § Convention Compliance). This plan does not change that — the only repo write is this plan document itself.

- [x] Planning command writes a documentation artifact only (no code written by `/ba:plan`) — aligned
- [x] Plan doc has YAML frontmatter with `origin` pointing to the brainstorm — aligned
- [x] Plan defaults to decisions; the two literal blocks are each under a `**Code-shape decision:**` label (user-facing message wording; required settings.json hook shape) — aligned
- [x] No dev-workflow plugin file is added or changed (no `hooks/hooks.json`, `scripts/`, `CLAUDE.md`, `README.md`, `plugin.json`) — aligned, by design
- [x] No `plugin.json` version bump needed — nothing ships in the plugin — aligned (the bump convention applies to plugin changes; this is none)
