---
title: Wire /ba:execute completion menu to /ba:propose
type: feat
status: completed
date: 2026-06-05
detail_level: minimal
iteration_count: 0
tags: [ba-execute, ba-propose, completion-menu, cross-command-reference]
---

# Wire /ba:execute completion menu to /ba:propose

`/ba:execute`'s post-implementation completion menus offer a "Create MR/PR" option that detects the VCS platform from the git remote and delegates to `gh pr create` / `glab mr create` ad-hoc — asking the user which tool to use when unclear. Now that `/ba:propose` has shipped (v0.18.0+) as the plugin's blessed commit + push + open-PR/MR command (composed title and reviewer-first body, host-detected GitHub/GitLab dispatch, preserved-block handling, create-or-update), the menu should suggest `/ba:propose` as the preferred path and keep the manual CLI as a fallback.

Without this cross-reference, two paths to the same outcome (open a PR/MR) exist in the plugin without users knowing the second is richer — a permanent-drift risk the architecture-reviewer flagged during `/ba:review-plan` on 2026-05-19. This is the deferred follow-up the `/ba:propose` plan explicitly scoped out of v0.18.0 to avoid blast-radius coupling between command files (see `docs/plans/2026-05-19-feat-add-ba-propose-command-plan.md:47`), tracked as [azevedo/dev-workflow#13](https://github.com/azevedo/dev-workflow/issues/13).

## Acceptance Criteria

- [x] The standard "Next Steps" menu's **Create MR/PR** based-on-selection (`commands/ba/execute.md:434`) prefers `/ba:propose`, with the manual `gh pr create` / `glab mr create` path (or a project/personal PR command) kept as an explicit, fully-spelled-out fallback.
- [x] The slice-aware menu's **Create MR/PR** based-on-selection (`commands/ba/execute.md:414`) is re-anchored to the standard step (prefer `/ba:propose`); its `[Slice N/M] [slice name]` prefix is passed as the `/ba:propose` free-text hint, with the manual fallback noted for an exact prefix.
- [x] The phrase "ask the user which tool to use" (and the host-detection ambiguity it resolved) no longer appears in either Create MR/PR instruction.
- [x] No dangling "Same as existing behavior" reference survives in the slice menu pointing at the rewritten standard text.
- [x] Both edited lines reference `/ba:propose` (full form `/dev-workflow:ba:propose`); neither introduces a bare `propose` token.
- [x] Each menu line keeps its existing local punctuation style: line 434 uses em-dash `—` / arrow `→`; line 414 uses double-hyphen `--` / ASCII arrow `->`.
- [x] `version` in `.claude-plugin/plugin.json` is bumped `0.20.0` → `0.20.1` so the change actually reaches installed users via auto-update (the version string is the auto-update cache key; pushing commits without a bump is a no-op for users).

## What We're NOT Doing

- **No change to `/ba:propose` itself** — its arguments, composition, and dispatch are unchanged (out of scope per the issue).
- **No change to `commands/ba/review.md` or any other command file** — only `commands/ba/execute.md` is touched (out of scope per the issue).
- **No README.md or CLAUDE.md change.** Out of scope per the issue. `README.md:146` ("VCS-agnostic completion — detects GitHub/GitLab from git remote; discovers available MR/PR tools in the environment") remains broadly accurate under the new menu — `/ba:propose` still detects the host and the fallback still surfaces project/personal PR tools — so it is not made wrong, only less specific. Naming `/ba:propose` there is deferred.
- **No plan acceptance-criteria / overview / completion-summary auto-injection into the PR body.** *(Deliberate narrowing.)* The current menus inject this content; `/ba:propose` composes its body from the diff and any linked issue, with no channel for plan content. Delegating accepts Propose's diff-driven body. Users needing exact body content can use the manual fallback.
- **No guaranteed `[Slice N/M]` slice-title prefix.** *(Deliberate narrowing.)* `/ba:propose` composes an effect-phrased, conventional-commits title and rewrites mechanism-style noise, so the literal bracket prefix passed via the hint is best-effort, not guaranteed. The manual `gh`/`glab` fallback remains the way to force an exact title.
- **No change to `marketplace.json`.** Its `version` field is a vestigial `0.1.0` that the auto-update resolver ignores (it reads `plugin.json`'s `version` first); it has been left at `0.1.0` across all prior releases. Leaving it untouched matches the established pattern — out of scope to "fix."

## Behaviors to Test

These are grep-able / readable assertions about the resulting `commands/ba/execute.md` text (this is a command-spec change, not application code).

- [ ] The standard Create MR/PR instruction (line ~434) names `/ba:propose` as the preferred path before naming any manual CLI.
- [ ] A `gh pr create` / `glab mr create` fallback is still present and self-contained in the standard menu (so the path survives when `/ba:propose` is unavailable or the user wants a one-off ad-hoc PR).
- [ ] The fallback retains an escape hatch for a project/personal PR command (does not silently erase the prior "available MR/PR skills or custom commands" discovery).
- [ ] Neither Create MR/PR instruction contains the string "ask the user which tool".
- [ ] The slice Create MR/PR instruction (line ~414) references the standard step and `/ba:propose`, and does not contain "Same as existing behavior".
- [ ] No bare-word `propose` (without the `/ba:` prefix) is introduced by the edit.

## Context

- **Target files:** `commands/ba/execute.md` — two single-line edits, lines 414 and 434; plus `.claude-plugin/plugin.json` — one-line `version` bump so the change ships.
- **Standard "Next Steps" menu** lives at `commands/ba/execute.md:419-437`; the Create MR/PR option label is line 427, its based-on-selection action is line 434. Punctuation style: em-dash `—`, arrow `→`.
- **Slice-aware completion menu** lives at `commands/ba/execute.md:399-417`; the Create MR/PR option label is line 407, its based-on-selection action is line 414. Punctuation style: double-hyphen `--`, ASCII arrow `->`. The slice menu adds the `[Slice N/M] [slice name]` title-prefix convention for ordering a stack of slice MRs.
- **`/ba:propose` contract** (`commands/ba/propose.md`): invoked as `/ba:propose`; accepts an optional free-text **positional hint** (seeds title drafting only, not the body) plus `--describe-only` and `--issue <ID>` flags. Detects `github`/`gitlab`/`unknown` from `git remote get-url origin` (`propose.md:28-48`); for an unknown host it commits + pushes and prints the body for manual paste. Resolves a single `ACTION` enum (`commit_push_create` / `commit_push_edit` / `edit_only` / `describe_only`) so it **creates or updates** an existing open PR/MR (`propose.md:50-89`). Composes an effect-phrased title (≤72 chars) and a reviewer-first body from the diff, branch, linked issue, `docs/solutions/`, and preserved blocks (`propose.md:271-281`); preserves `CURSOR_SUMMARY` / `## Demo` / `## Screenshots` blocks; previews with confirm/edit/regenerate before publishing.
- **Cross-command-reference convention** (observed across the plugin): completion menus use `AskUserQuestion` with bold-label options and a `**Based on selection:**` block; cross-command suggestions name the target in backticks and either "Invoke `<cmd> <args>` directly" or "Tell the user: Run `/clear` then `<cmd> <args>`". Examples: `/ba:plan` → `/ba:slice` (`commands/ba/plan.md:502`), `/ba:brainstorm` → `/ba:plan` (`commands/ba/brainstorm.md:343`), `/ba:slice` → `/ba:execute` (`commands/ba/slice.md:229`).
- **No prior learnings** — `docs/solutions/` does not exist yet.

## MVP

### commands/ba/execute.md — line 414 (slice-aware menu, Create MR/PR)

Current:

```markdown
- **Create MR/PR** -> Same as existing behavior. Use the slice name as MR title prefix: "[Slice N/M] [slice name]". Include slice acceptance criteria in description.
```

Replace with:

```markdown
- **Create MR/PR** -> Same as the standard Create MR/PR step below (prefer `/ba:propose`). Pass `[Slice N/M] [slice name]` as the `/ba:propose` hint so the composed title reflects the slice -- best-effort, since `/ba:propose` composes an effect-phrased title; if you need the exact "[Slice N/M]" prefix, use the manual `gh`/`glab` fallback.
```

### commands/ba/execute.md — line 434 (standard "Next Steps" menu, Create MR/PR)

Current:

```markdown
- **Create MR/PR** → Detect VCS platform from git remote (GitHub → `gh pr create`, GitLab → `glab mr create`). Also check for available MR/PR skills or custom commands in the environment. If unclear, ask the user which tool to use. Use the plan title and overview + completion summary as the description.
```

Replace with:

```markdown
- **Create MR/PR** → Prefer `/ba:propose` — it composes the title and a reviewer-first body, detects GitHub/GitLab from the git remote, preserves protected PR/MR blocks, and creates or updates the PR/MR as appropriate. Invoke `/ba:propose` directly. It composes the body from the diff and any linked issue, so the plan's overview and acceptance criteria are not auto-injected. **Fallback** — if `/ba:propose` is unavailable or the user wants a one-off ad-hoc PR: detect the platform from the git remote (GitHub → `gh pr create`, GitLab → `glab mr create`), or use a project/personal PR command the user prefers.
```

### .claude-plugin/plugin.json — version bump

`version` is the auto-update cache key. Because it is set explicitly, installed users will **not** receive the `execute.md` change until this string changes — pushing commits alone is a no-op for them. This is a patch-level change (wording tweak to an existing command, no new command/agent/path), so bump the patch component.

Current:

```json
  "version": "0.20.0",
```

Replace with:

```json
  "version": "0.20.1",
```

### Verify

```bash
# Both Create MR/PR lines now reference /ba:propose
grep -n 'Create MR/PR' commands/ba/execute.md            # → expect /ba:propose in both based-on-selection lines

# The ambiguity is gone
grep -n 'ask the user which tool' commands/ba/execute.md  # → expect no matches

# No dangling reference
grep -n 'Same as existing behavior' commands/ba/execute.md  # → expect no matches

# No bare-word `propose` introduced (every mention should be /ba:propose)
grep -nE '(^|[^:a-z])propose' commands/ba/execute.md      # → expect only `/ba:propose` matches

# Version bumped so the change reaches users on auto-update
grep -n '"version"' .claude-plugin/plugin.json            # → expect "0.20.1"
```

## Convention Compliance

- [x] **Command namespace** — references `/ba:propose` (full form `/dev-workflow:ba:propose`), never bare `propose`; matches how `execute.md` already references `/ba:review`. Aligned.
- [x] **Plan filename / frontmatter** — `2026-06-05-feat-wire-execute-menu-to-propose-plan.md` with full YAML frontmatter; `origin` omitted because this originated from issue #13, not a brainstorm. Aligned.
- [x] **Execution commands implement approved plans** — editing the post-implementation completion menu (next-steps flow) does not change what an executed plan builds; "the plan is the authority" is unaffected. Aligned.
- [x] **Convention-compliance check mandatory before write** — convention-checker run with 0 violations. Aligned.
- [x] **Bump `version` in `.claude-plugin/plugin.json` for every release (CLAUDE.md:74)** — `0.20.0` → `0.20.1`. Required, not optional: the version string is the auto-update cache key, so without it the change never reaches installed users. Aligned. (The convention-checker initially marked this N/A by treating the version bump as a separate release-time concern — that was a miss; it is in-scope here because nothing else in the workflow bumps it.)
- [x] **Surgical changes** — two files: `commands/ba/execute.md` (two lines) + `.claude-plugin/plugin.json` (version bump); `/ba:propose`, `review.md`, README, CLAUDE.md, `marketplace.json` all explicitly out of scope. Aligned.
- [x] **README update requirement (CLAUDE.md:82)** — justified non-update: the change adds no command/agent/artifact-path, so the rule does not trigger; `README.md:146` remains broadly accurate. README naming of `/ba:propose` deferred per the issue's explicit out-of-scope.
- [x] **PR-body / slice-prefix narrowing** — justified override: documented in "What We're NOT Doing"; consistent with how `/ba:propose` composes bodies and titles, and with the user's decision to delegate and document the narrowing.

## Sources

- Origin issue: [azevedo/dev-workflow#13](https://github.com/azevedo/dev-workflow/issues/13) — "[roadmap] update /ba:execute MR/PR completion menu to suggest /ba:propose"
- Deferral source: `docs/plans/2026-05-19-feat-add-ba-propose-command-plan.md:47` (What We're NOT Doing — scoped this menu update out of v0.18.0, tracked as #13)
- Target: `commands/ba/execute.md:414` (slice menu), `commands/ba/execute.md:434` (standard menu)
- `/ba:propose` contract: `commands/ba/propose.md:13` (positional hint), `:28-48` (host detection), `:50-89` (ACTION / create-or-update), `:271-281` (body composition inputs)
- Cross-command-reference patterns: `commands/ba/plan.md:502`, `commands/ba/brainstorm.md:343`, `commands/ba/slice.md:229`
