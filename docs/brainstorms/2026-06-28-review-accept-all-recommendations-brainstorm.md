---
date: 2026-06-28
topic: review-accept-all-recommendations
status: approved
triage_level: standard
tags: [ba-review, resolution-menu, disposition, github-issue-43]
---

# /ba:review — "Accept all recommendations" bulk action

## What We're Building

A new bulk action — **"Accept all recommendations"** — in `/ba:review`'s post-review
resolution menu. For each finding it executes the reviewer's per-finding recommended
action (apply where recommended **Apply**, skip where recommended **Skip**, pause only
where recommended **Modify**), collapsing the N-prompt "Review one by one" walk to a
single confirmation for the common case: *"I trust the reviewer — do what it recommends."*

It is for anyone running a multi-finding review who agrees with the reviewer's per-finding
judgment and doesn't want to press Enter N times. Surfaced on a 21-finding local review
(branch `33-html-artifact`, 17 applied) — GitHub issue #43. This is a prompt/control-flow
change to `commands/ba/review.md` only: no new schema, no new output format.

## Why This Approach

The resolution menu is already at the 4-option AskUserQuestion cap with **two**
severity/confidence-based bulk modes ("Apply all fixes", "Apply Critical+High+Med-conf-100"),
neither of which applies the reviewer's *recommended disposition*. That recommendation —
a fix-quality + taste judgment ("clean Medium → Apply, High taste-call → Skip") — is
computed inside the walk at presentation time (`review.md:865–869`), not stored on the
finding. #43 promotes that judgment into a bulk action.

**Rejected:** collapsing *both* bulk modes into one disposition-based option (cleaner, but a
bigger behavior change that drops the confidence-filtered escape hatch). **Chosen:** replace
only "Apply all fixes" — keep the confidence filter as an escape hatch. This matches the
issue's literal suggestion and the standing intent in auto-memory (`/ba:review` "Apply all"
*should* apply recommended dispositions — which today's "Apply all fixes" does not).

"Dispositions" was rejected as user-facing jargon in favor of plain **"Accept all
recommendations"** — *accepting* a recommended Skip correctly means skipping it.

## Key Decisions

- **Rename, don't add:** replace the local-scope menu option "Apply all fixes" →
  "Accept all recommendations". Keep "Apply Critical+High+Med-conf-100", "Review one by one",
  "Done". Stays at the 4-option cap.
- **Label:** "Accept all recommendations" (plain language; no "disposition" in user-facing text).
- **Recommendation source:** reuse the existing per-finding fix-quality judgment from the walk
  (`review.md:865–869`). No new stored field on the finding schema.
- **Single confirmation:** selecting the option *is* the confirmation. The loop runs silently —
  applies recommended-Apply, skips recommended-Skip — and pauses only at each recommended-Modify
  finding to collect the user's edit, then continues. No extra up-front prompt.
- **All-Modify edge case:** degenerates into the walk (every finding pauses). Acceptable; no
  special handling.
- **Guard composition:** the applied set funnels through the **existing** post-apply guard —
  reconciliation + verify-then-keep with auto-revert (`review.md:876–931`) — same as the other
  bulk modes. The end summary renders *after* the guard, so it reflects any auto-reverted /
  resurfaced findings.
- **End summary:** compact tally — "Applied N, skipped M, paused for K" (reflecting guard outcomes).
- **Own-MR fix-local sub-menu:** inherits the change automatically — it reuses the local-scope
  menu definition (`review.md:1047–1048`). No separate edit needed.
- **Own-MR top menu:** promote "Accept all recommendations" to a direct, **precondition-gated**
  shortcut, replacing the top-menu "Fix Critical+High+Med-conf-100" shortcut. Final own-MR top
  menu: *Fix locally / Accept all recommendations / Walk one by one / Done*. The confidence
  filter stays reachable via Fix locally → sub-menu. The new shortcut joins the precondition list
  at `review.md:990`.
- **Protected-artifacts guard:** still honored during silent apply — the applier-facing guard
  (`review.md:928–931`) must never apply a finding that deletes/relocates/renames protected docs.

_Design-it-twice mode did not fire: this modifies an existing command's menu — no new module,
interface, command, or public type._

## Scope Boundaries

NOT doing:
- No change to the **others'-MR posting menu** (discussion-only; shows no disposition recommendation).
- No new **disposition field** on the finding schema — recommendation stays computed at presentation time.
- No change to the **confidence-filter behavior** itself.
- No **headless / non-interactive** operation — that's roadmap item #10. This stays interactive
  (user initiates the action and reviews the summary).
- No change to the **guard's** reconcile / verify-then-keep logic.
- Do **not** touch `review-plan.md`'s separate "Apply all fixes" (`:515/521/553`) — different command.

## Acceptance Criteria

- The local-scope resolution menu offers "Accept all recommendations" in place of "Apply all
  fixes"; the other three options are unchanged.
- Selecting it iterates findings with no per-finding confirmation: applies recommended-Apply,
  skips recommended-Skip, pauses only at recommended-Modify to collect the edit.
- After the loop, the applied set passes through the existing reconciliation + verify-then-keep
  guard.
- A compact summary is shown: Applied N / Skipped M / Paused K, reflecting any auto-reverted +
  resurfaced findings.
- The own-MR fix-local sub-menu shows "Accept all recommendations" (inherited).
- The own-MR top menu shows "Accept all recommendations" as a direct, precondition-gated
  shortcut, replacing the top-menu confidence-filter shortcut; the confidence filter remains
  reachable via Fix locally.
- The protected-artifacts applier guard is honored during silent apply.

### Sync requirements for the plan/execute phase (from convention check)

These are not brainstorm violations — they are downstream obligations so the rename stays consistent:

- **Literal references to rename** beyond the menu definition (`review.md:849`):
  `review.md:873` (prior-revert-skip rule), `:877` (guard's bulk-apply list), `:893`
  (reconciliation bulk-apply line), `:1048` (sub-menu inheritance pointer). Plus `README.md:174`.
- **SSOT-note wording:** removing the own-MR *top-menu* confidence-filter shortcut means
  `review.md:841` (which enumerates the own-MR menu among the filter's referencing sites) should
  be re-verified — the filter is still reachable via Fix locally → sub-menu, so the note likely
  stays true, but confirm the wording.
- **Version bump:** bump `.claude-plugin/plugin.json` (currently `0.30.0`) on release —
  it's the auto-update cache key.

## Open Questions

(none)

## Convention Compliance

Convention-checker run on 2026-06-28: **0 violations.** Confirmed unaffected — the never-hide
selection-ledger (lives in Step 2 selection, not Step 5 resolution). Confirmed honored — the
protected-artifacts applier guard and the "Apply Critical+High+Med-conf-100" single-source-of-truth
(only the *other* bulk option is renamed; the filter definition at `review.md:933` and SSOT note at
`:838–842` are untouched). Three sync requirements captured above (extra mirror sites, SSOT-note
re-verification, plugin.json bump) for the plan/execute phase. Artifact is a planning document — no
code written.

## Next Steps
→ `/ba:plan` to create implementation plan
