---
title: "fix: Trim own-MR resolution menu to fix-only options"
type: fix
status: completed
date: 2026-06-19
detail_level: minimal
iteration_count: 0
tags: [review, resolution-menu, own-mr, ux]
---

# fix: Trim own-MR resolution menu to fix-only options

When reviewing your own MR, the resolution menu shows "Post inline comments" and "Post Critical + High + Med-conf-100" — options the author never uses. Replace both with "Walk one by one" (direct path to the per-finding fix walk) and "Fix Critical + High + Med-conf-100" (direct filtered-fix path, no sub-menu).

## Acceptance Criteria

- [x] own-MR menu shows exactly: Fix locally / Walk one by one / Fix Critical + High + Med-conf-100 / Done
- [x] "Walk one by one" is precondition-gated (same HEAD + clean-tree check as Fix locally); on pass, skips the fix-local sub-menu and goes directly to the per-finding Apply/Skip/Modify walk
- [x] "Walk one by one" with zero post-gate findings: display "No findings to walk." and return to menu (not treated as Done)
- [x] "Fix Critical + High + Med-conf-100" is precondition-gated; on pass, applies the existing filter (line 932) and runs fixes without opening the sub-menu
- [x] "Fix Critical + High + Med-conf-100" with 0 matches: report and return to menu (same as existing sub-menu behavior)
- [x] Precondition failure on either new option reuses the existing failure flow verbatim (lines 1023–1034), including the one-Checkout limit; the "Post comment" fallback always posts all findings regardless of which option triggered it
- [x] The explanatory parenthetical (lines 982–985) is updated: drop the post-justification, add a note that "Walk one by one" and "Review one by one" (sub-menu) reach the same underlying walk
- [x] The guard scope note (around line 877) is updated to cover any per-finding Apply/Modify disposition regardless of entry point (Fix locally sub-menu or direct Walk one by one)
- [x] theirs-MR menu is unchanged
- [x] plugin.json version bumped from 0.24.1

## What We're NOT Doing

- Not changing the fix-local sub-menu ("For local scopes" — Apply all / Apply Critical + High + Med-conf-100 / Review one by one / Done stays unchanged)
- Not defining a new walk implementation — "Walk one by one" delegates to the existing "Review one by one" fix walk
- Not renaming "Review one by one" in the sub-menu — both labels coexist; a disambiguation note covers the cross-reference
- Not changing theirs-MR menu
- Not changing the filter predicate at line 932 — same Crit OR High OR (Med AND conf=100) definition, new entry point only
- Not updating README.md content — lines 166–167 describe the fix-local sub-menu options, which are unchanged; verify before skipping

## Context

**Files:**
- `commands/ba/review.md` — primary change
- `.claude-plugin/plugin.json` — version bump

**Key line references in `commands/ba/review.md`:**

| What | Lines |
|---|---|
| own-MR menu block | 974–985 |
| Fix locally precondition check | 1002–1034 |
| Fix-local sub-menu ("For local scopes") | 848–853 |
| Per-finding fix walk ("Review one by one" flow) | 854–869 |
| Guard behavior | 876–895 |
| Guard verify-then-keep step | 896–899+ |
| Critical + High + Med-conf-100 filter definition (single source) | 932 |
| Single-source-of-truth anchor note (own-MR, theirs-MR, README bullet) | 840–841 |
| theirs-MR menu | 988–997 |

**Filter note:** The filter at line 932 is already referenced by name from the theirs-MR menu (line 994). The new "Fix Critical + High + Med-conf-100" option references the same predicate the same way — no redefinition needed.

## MVP

### `commands/ba/review.md`

**1. Replace own-MR menu options (lines 974–980)**

Remove options 2 and 3 (Post inline comments, Post Critical + High + Med-conf-100). Replace with:

- **Walk one by one** — precondition-gated (same HEAD + clean-tree check as Fix locally, lines 1002–1034). On pass, skip the fix-local sub-menu and go directly to the per-finding fix walk (Apply / Skip / Modify with embedded finding context and disposition recommendation — same walk defined under "Review one by one" flow, lines 854–869). If zero post-gate findings exist, display "No findings to walk." and return to this menu.
- **Fix Critical + High + Med-conf-100** — precondition-gated. On pass, apply the **Filter for `Apply Critical + High + Med-conf-100`** (line 932) and run fixes without opening the sub-menu. If 0 findings match, report "0 findings matched the filter (Critical + High + Med-conf-100)." and return to this menu. Prior-revert-marked findings within the matched set are skipped per the existing rule; if all matches are prior-revert-marked, surface "N findings matched the filter; all are prior-revert-marked and were skipped." before returning to menu.

Precondition failure for both new options: reuse the existing failure flow verbatim (lines 1023–1034), including the one-Checkout limit. The "Post comment" fallback always posts all findings regardless of which option triggered the precondition check.

**2. Update parenthetical (lines 982–985)**

Replace current text (which explains why posting options exist due to the 4-option limit) with:

> (The discussion-only "Review one by one" walk is not offered on own-MR — thin with no second party. "Walk one by one" here is a direct-path shortcut to the per-finding fix walk; Fix locally reaches the same walk via its sub-menu. **AskUserQuestion allows at most 4 options — a harness limit, not a style choice.**)

**3. Update guard scope note (around line 877)**

The guard currently scopes to "fix-local apply." Broaden the header/description to read "any per-finding Apply/Modify or bulk apply disposition" so it unambiguously covers both the Fix locally sub-menu walk and the direct "Walk one by one" entry point.

### `.claude-plugin/plugin.json`

Bump `version` from `0.24.1` to `0.24.2`.

## Sources

- `commands/ba/review.md:974–985` — own-MR menu (current)
- `commands/ba/review.md:848–869` — fix-local sub-menu and per-finding walk
- `commands/ba/review.md:876–899` — guard behavior
- `commands/ba/review.md:932` — filter definition (single source of truth)
- `commands/ba/review.md:1002–1034` — Fix locally precondition check and failure flow
- `commands/ba/review.md:840–841` — single-source-of-truth anchor note

## Convention Compliance

- [x] Filename convention `YYYY-MM-DD-<type>-<name>-plan.md` — aligned
- [x] YAML frontmatter required fields — aligned
- [x] "What We're NOT Doing" section present — aligned
- [x] No code blocks without `**Code-shape decision:**` label — aligned (prompt-only change)
- [x] Planning command writes no code — aligned
- [x] plugin.json bump included in plan scope — aligned
- [x] README.md sync — verified not applicable: lines 166–167 describe fix-local sub-menu options (unchanged); own-MR top-level menu options were not enumerated in README
