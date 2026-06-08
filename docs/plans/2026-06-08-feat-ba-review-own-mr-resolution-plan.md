---
title: "/ba:review Own-MR Resolution Pipeline (route → walk → guard)"
type: feat
status: completed
date: 2026-06-08
origin: docs/brainstorms/2026-06-07-ba-review-own-mr-resolution-pipeline-brainstorm.md
detail_level: standard
iteration_count: 1
tags: [ba-review, resolution, authorship-routing, disposition-recommendation, execution-guardrails]
---

# `/ba:review` Own-MR Resolution Pipeline (route → walk → guard)

## Overview

Add a coherent pipeline for resolving `/ba:review` findings on your **own** MR, landing entirely
inside **Step 5 (Resolution)** of `commands/ba/review.md`. Three composing items: **Route** (detect
MR authorship; offer "Fix locally" on your own MR), **Walk** (pre-attach a recommended disposition —
Apply / Skip / Modify — to each finding in the fix-local walk), and **Guard** (after applying, run
bidirectional reconciliation + verify-then-keep auto-revert-and-resurface). Reviewer dispatch and
consolidation (Steps 1–4) are untouched except for one added metadata field. This is a markdown-prompt
behavioral change — no application code — and the human stays the decider throughout
(see brainstorm: `docs/brainstorms/2026-06-07-ba-review-own-mr-resolution-pipeline-brainstorm.md`).

## Current State

Step 5 splits by **scope**, not authorship:

- **Local scopes** (`review.md:818-859`) get a fix menu: `Apply all fixes` / `Apply Critical + High +
  Med-conf-100` / `Review one by one` / `Done` (`review.md:825-828`). The one-by-one walk
  (`review.md:830-839`) uses options **Agree / Skip / Modify** with stale *posting* framing ("Agree —
  Include this in the review comments"; "Modify — … before posting") — even though local scope applies
  fixes, it does not post. The post-apply block (`review.md:841-844`) runs targeted tests, reports the
  likely cause on failure, and returns to the menu — it **never reverts** and **never reconciles**.
- **MR/PR scope** (`review.md:861-905`) is **posting-only**: `Post inline comments` / `Post Critical +
  High + Med-conf-100` / `Review one by one` (for discussion) / `Done` (`review.md:867-871`). No
  authorship detection, no fix-local option.

Supporting facts:

- The MR metadata fetch omits author/head-SHA: `gh pr view <N> --json
  title,body,baseRefName,headRefName,additions,deletions,changedFiles,files` (`review.md:79`) and
  `glab mr view <N> --output json` (`review.md:87`). Nothing in the repo detects MR authorship or the
  current user today.
- **Step 1f STOP rule** (`review.md:202-208`): once the diff is captured, no further `git diff` / `gh
  pr diff` / `glab mr diff` — the captured remote diff is the **sole review input**.
- **Protected-artifacts guard** appears verbatim in the three reviewer-dispatch templates
  (`review.md:425`, `:471`, `:523`): "the guard protects the file's existence and location, not its
  contents." It is **reviewer-facing** ("Do not *suggest* …"); there is no applier-facing copy.
- **never-hide convention** (`CLAUDE.md:80`, `README.md:163`, `review.md` Step 2) is scoped to
  **reviewer selection** (the selection ledger), and its parenthetical names a 3-file sync contract.
- `README.md:166` "Fix application" bullet describes local-only apply (and drifts: says "Accept/Skip"
  vs the command's "Agree/Skip/Modify"). `plugin.json:3` is `"version": "0.21.0"`.

## What We're NOT Doing

Carried from the brainstorm's Scope Boundaries:

- **No independent validator / Stage-5b** — deferred to a future autonomous-action path
  (`docs/research/2026-06-07-verify-fix-precondition-frequency-research.md`). This pipeline is
  human-in-the-loop.
- **No auto-apply without confirm.** The lever is pre-qualifying and reconciling the walk, never
  deciding substance for the user.
- **No change to the posting channel** — others'-MR posting (Conventional Comments, non-blocking
  default, existing `Critical+High+Med-conf-100` filter) is untouched; Item 5's recommendation does
  not apply to the posting walk. No softened framing on others' MRs; no posting-volume curation.
- **No restructure of Steps 1–4** — only the `author` / head-SHA / fork fields are added to the Step 1b
  metadata fetch.
- **No rewording of the selection-ledger never-hide statements** (`CLAUDE.md:80` / `README.md:163` /
  `review.md` Step 2). Resolution-never-hiding is a *sibling* principle, kept conceptually separate; the
  3-file sync triple stays selection-only (per convention check, advisory 1). No CLAUDE.md edit.
- **Protected-artifacts identity guard holds** — fix-local apply may edit the *content* of files under
  `docs/{brainstorms,plans,solutions,research,reviews}/` when a finding targets them, but never their
  existence or path.

## Behaviors to Test

This is a prompt-only change, so these are **manual dry-run scenarios** (per the prompt-only-ships-on-
dry-run practice), not automated unit tests. Each is a single observable behavior.

- [ ] Reviewing my own MR by URL surfaces "authored by you" and a **Fix locally** option in the menu.
- [ ] Reviewing someone else's MR surfaces "authored by `<name>`" and a **posting-only** menu (today's).
- [ ] Authorship that can't be resolved (auth failure + inconclusive fallback) surfaces "could not
      confirm authorship" and routes to the posting-only menu — never silently to fix-local.
- [ ] Selecting **Fix locally** when on the right branch, at the reviewed head SHA, with clean changed
      files, enters the fix-local sub-menu.
- [ ] Selecting **Fix locally** when NOT on the head commit surfaces the specific reason and offers
      Checkout / Post comment / Patch — it never edits the working tree.
- [ ] Selecting **Fix locally** with uncommitted edits to a reviewed file surfaces "dirty changed
      files" and offers Stash-or-commit / Post comment / Patch.
- [ ] Selecting **Fix locally** on a fork MR (head not local) surfaces a not-checked-out reason naming the
      fork and offers Checkout / Post comment / Patch.
- [ ] Each finding in the fix-local walk leads with a recommended disposition (Apply / Skip / Modify)
      and a one-line reason; the recommendation is first and pre-selected (one-step confirm).
- [ ] A clean Medium recommends **Apply**; a High taste-call recommends **Skip** (judgment over severity).
- [ ] The others'-MR posting walk shows **no** disposition recommendation.
- [ ] After applying, an accepted finding with no corresponding edit is reported (under-application).
- [ ] After applying, an edit touching a Skipped finding's region is reported (over-application).
- [ ] A fix that breaks targeted tests is auto-reverted and resurfaced as an open finding; it is not
      left broken and not silently dropped.
- [ ] When no test command can be determined, applied fixes are kept but flagged "NOT verified".
- [ ] Tests already failing before applying (or failing for environmental reasons) are not blamed on the
      fixes — the fixes are kept and flagged for manual review, not reverted.
- [ ] A resurfaced finding re-enters at the menu (not auto-re-walked) and its recommendation flips to
      Skip/Modify with the prior-revert reason shown.
- [ ] No Step 5 path re-runs `gh pr diff` / `glab mr diff` / `git diff` (STOP-rule held).
- [ ] `README.md` "Fix application" bullet and `plugin.json` version reflect the change.

## Proposed Solution

**Route — scope stays primary; *add* a Fix-locally option on own MRs** (chosen over an authorship
re-route; see brainstorm). The only genuinely new case is *reviewing my own MR by URL and fixing it
locally*. We detect authorship for MR scope only, announce it, and when the MR is mine, the MR menu
gains **Fix locally**. Local scope is assumed-yours (you have it checked out) and is unchanged by
routing.

**Walk — one unified fix-local walk** reached by *both* local-scope "Review one by one" and own-MR
"Fix locally" (decision this session: unify). Each finding leads with a recommended disposition —
**Apply / Skip / Modify** — listed first and pre-selected, with a one-line reason. The recommendation
is a fix-quality judgment that can override severity. This relabels the local walk's stale **Agree →
Apply** and adds the recommendation; the others'-MR posting walk is untouched.

**Guard — verify-then-keep, on the whole fix-local path.** Replacing the report-only post-apply block,
the guard does (1) bidirectional reconciliation (accepted-but-no-edit + skipped-but-edited, both
surfaced) and (2) verify-then-keep: run targeted tests; on failure, auto-revert the offending fix and
resurface it as an open finding ("an unverified fix is not finished"). The resurfacing *is* the
surfacing — auto-revert never becomes a silent drop. Runs on every fix-local apply (bulk + walk); the
posting path applies nothing and is unaffected.

## Technical Considerations

- **STOP-rule safety.** The precondition compares SHAs and reads `git status` (not a diff); the guard
  runs tests (not a diff). The captured remote diff stays the sole review *input*. The precondition uses
  the `MR_HEAD_SHA` captured in Step 1b — it does **not** re-fetch.
- **AskUserQuestion 4-option ceiling (harness-enforced).** The own-MR menu must fit 4 options — a hard
  harness limit, not a style choice. Adding "Fix locally" forces the standalone "Review one by one for
  discussion" out of the own-MR menu (kept on others'-MR). This is justified by the same "thin on your
  own MR" logic the brainstorm used to drop a "Discuss" disposition; the one-by-one *fix* walk is still
  reachable via Fix locally. (Convention check: justified override, no convention mandates a fixed menu.)
- **Identity-space mismatch in the fallback.** The primary comparison is login-to-login
  (`author.login` vs `gh api user`); the git-config fallback compares name/email to the MR author's
  name/email — a best-effort, frequently-inconclusive comparison whose safe result is *undetermined*.
- **Test-runner discovery is best-effort.** A generic plugin can't assume a test command. The guard
  detects one from repo conventions; when none is found, "could-not-verify" is a named, surfaced outcome
  distinct from "verified passing."

## System-Wide Impact

- **Interaction graph.** Step 1b fetch → (new) `MR_AUTHOR`, `MR_HEAD_SHA`, `IS_FORK`, `CURRENT_USER` →
  Step 5 authorship determination → menu route → (own MR) Fix-locally precondition → unified walk → guard.
  The route→walk seam: Fix-locally lands on the *same* fix-local sub-menu local scope already uses. The
  walk→guard seam: "accepted dispositions" = Apply + Modify findings (region-based), reconciled against
  actual edits.
- **Error propagation.** Authorship/user fetch failure degrades gracefully to *undetermined → posting-
  only* (review still completes). Precondition failure routes to surfaced fallbacks, never a silent edit.
  Guard test failure routes to auto-revert + resurface; non-attributable failure (pre-existing /
  environmental, caught by a pre-apply baseline) keeps the fixes and surfaces a manual-review notice.
- **State lifecycle risks.** Auto-revert is the only sanctioned reversal and always resurfaces, so a
  partial apply can't leave a silently-broken tree. A resurfaced finding returns to the menu (not auto-
  re-walked) and its recommendation flips to Skip/Modify, bounding any re-apply loop.
- **Protected artifacts.** A new actor (the applier) edits files; it gets an applier-facing identity
  guard at the Step 5 site (the existing guards are reviewer-facing).
- **`--persist` (Step 4.5)** runs before Step 5 and captures the *review*, not resolution actions —
  unchanged; resurfaced findings and reconciliation are not persisted (consistent with today).

## Implementation Approach

The plan delivers exact replacement prose for `commands/ba/review.md`. Order the work **Item 6 → Item 5
→ Item 7**: Route enables Fix-locally, the Walk operates within it, the Guard runs after apply. Each
item below gives the *Changes Required* (the prose to land) and *Success Criteria*.

> All line numbers reference the current `commands/ba/review.md` as mapped in Current State.

---

### Phase 1 — Item 6: Authorship routing (Route)

#### Changes Required

**1a. Extend the Step 1b GitHub fetch** — replace `review.md:79`:

```bash
gh pr view <N> --json title,body,baseRefName,headRefName,additions,deletions,changedFiles,files,author,headRefOid,isCrossRepository
```

**1b. Capture the current user** — add immediately after the Step 4 extraction list (both platforms), Step 1b:

````markdown
**Step 4b — Capture the current user (for Step 5 authorship routing):**

GitHub:
```bash
gh api user --jq .login
```
GitLab:
```bash
glab api user --jq .username
```

If the user call fails (auth error), do **not** error out — record `CURRENT_USER` as unavailable; Step 5
will fall back to a best-effort `git config user.name` / `user.email` comparison. The review proceeds;
only own-MR fix-local routing is affected.
````

**1c. Extend the Step 4 extraction list** (`review.md:90-96`) with:

- **MR_AUTHOR** — `author.login` (GitHub) / `author.username` (GitLab); also keep `author.name` (+ email
  if present) for the fallback.
- **MR_HEAD_SHA** — `headRefOid` (GitHub) / `.diff_refs.head_sha` (GitLab; `.sha` is the alias).
- **IS_FORK** — `isCrossRepository` (GitHub) / `source_project_id != target_project_id` (GitLab).

(`CURRENT_USER` is **not** extracted here — it comes from the separate Step 4b call, not the MR-metadata
fetch. The Step 4 extraction list gains only `MR_AUTHOR` / `MR_HEAD_SHA` / `IS_FORK`.)

**1d. Insert authorship determination + announce** before the MR menu (new, ahead of `review.md:863`):

````markdown
**Authorship determination (Item 6).** Before showing the menu, determine whether this MR is yours.
Compare `MR_AUTHOR` to `CURRENT_USER`, trimming whitespace — **case-insensitively for GitHub** (logins
are case-insensitive) and **case-sensitively for GitLab** (usernames are case-sensitive) (GitHub
`author.login` vs `gh api user --jq .login`; GitLab `author.username` vs `glab api user --jq .username`).
If `CURRENT_USER` is unavailable, fall back to comparing `git config user.name` against `MR_AUTHOR`'s
name — email is usually absent from both `gh`/`glab` MR-view author objects, so this is a best-effort
name comparison, and a name rarely matches a login cleanly → an inconclusive fallback yields
**undetermined**. If `CURRENT_USER` is unavailable **and** git config has no identity (fresh clone, CI),
there is nothing to compare → **undetermined**, reason "no local git identity configured".

Set `MR_AUTHORSHIP`:
- **mine** — author matches current user.
- **theirs** — author is a different, known user. A bot-opened MR (Dependabot, release bot) is *theirs*
  — you can still review it `--local` on a checked-out branch.
- **undetermined** — identity could not be resolved (auth failure + inconclusive fallback).

Announce one line before the menu:
- mine → "This MR is authored by you — fixing locally is available."
- theirs → "This MR is authored by `<MR_AUTHOR>` — resolution is posting-only."
- undetermined → "Could not confirm MR authorship (`<reason>`) — treating as not-yours; to fix locally,
  re-run `/ba:review --local` on the checked-out branch."
````

**1e. Replace the MR menu** (`review.md:863-873`) with two branches:

````markdown
**When `MR_AUTHORSHIP == mine`**, use **AskUserQuestion** — "How would you like to handle the findings?"
1. **Fix locally** *(Recommended — it's your MR)* — Apply fixes to your local checkout
   (precondition-gated; see below). Leads to the fix-local resolution sub-menu.
2. **Post inline comments** — Post all displayed (post-gate) findings as inline comments (e.g., notes
   for later or for co-reviewers).
3. **Post Critical + High + Med-conf-100** — Same posting flow, pre-filtered.
4. **Done** — Acknowledge findings without further action.

(The standalone "Review one by one for discussion" walk is **not** offered on your own MR — a discussion
walk is thin with no second party. The one-by-one *fix* walk is reached via **Fix locally**. **AskUserQuestion
allows at most 4 options — a harness limit, not a style choice** — so a fifth option can't be added without
removing one.)

**When `MR_AUTHORSHIP == theirs` or `undetermined`**, use **AskUserQuestion** — today's posting-only menu,
unchanged: 1. **Post inline comments** … 2. **Post Critical + High + Med-conf-100** … 3. **Review one by
one** (for discussion) … 4. **Done**.
````

**1f. Insert the precondition check** as a sub-section under Fix locally:

````markdown
#### Fix locally — precondition check (Item 6)

Selecting **Fix locally** does NOT immediately edit files. First confirm the local tree IS the reviewed
tree, so the remote diff's `file:line` anchors apply. Use the `MR_HEAD_SHA` captured in Step 1b — do
**not** re-fetch it (Step 1f STOP rule: the precondition compares SHAs and reads `git status`; it does
not re-diff). Check, in order; each failure surfaces a SPECIFIC reason — never edit a misaligned tree:

1. **Head aligned** — `git rev-parse HEAD` equals `MR_HEAD_SHA` (captured Step 1b). A detached HEAD at
   the right SHA **passes** — alignment, not branch name, is the gate. To **classify** an alignment
   failure (so the right fallback is offered), read two more primitives: `git branch --show-current` and
   whether the head branch exists locally (`git branch --list <HEAD_BRANCH>`). Empty current branch **or**
   absent head branch → **not checked out**; on the head branch but SHA differs → **head moved** (rebased
   / squashed / updated since review). If `IS_FORK`, name that as context in the reason — the head likely
   isn't local and a checkout will fetch it.
2. **Changed files clean** — `git status --porcelain -- <CHANGED_FILES>` is empty. Uncommitted edits to
   reviewed files would shift anchors and confound the guard's test attribution.

(`IS_FORK` is **not** an independent gate: at the reviewed SHA the anchors are valid regardless of fork;
if you're not at it, "fork" is merely *why* — so it annotates the not-aligned reason rather than failing
its own check.)

On failure, surface the reason and offer reason-specific fallbacks (each via AskUserQuestion):
- **Not checked out** (empty/other current branch, or the head branch — possibly a fork — isn't local) →
  **Checkout** (`gh pr checkout <N>` / `glab mr checkout <N>`, which fetches a fork too; then re-run the
  precondition) / **Post comment** / **Patch** (emit accepted fixes as a `git apply`-able patch).
- **Head moved** (on the branch but SHA ≠ reviewed; rebased/squashed/updated) → do **not** silently
  checkout onto a stale diff. **Re-review** (`/ba:review <N>` to capture a fresh diff against the current
  head) / **Post comment** / **Patch**.
- **Dirty changed files** → **Stash or commit** the changed files then re-run / **Post comment** / **Patch**.

After any **Checkout**, re-run the precondition (both checks). If alignment still can't be reached, the
only safe applying path is **Re-review**; otherwise **Post comment** / **Patch**.

Then proceed to the fix-local resolution sub-menu (see **For local scopes** — the same Apply-all /
Critical+High+Med-conf-100 / one-by-one walk / Done options, the same guard).
````

#### Success Criteria

**Automated:**
- [x] `grep -n 'author,headRefOid,isCrossRepository' commands/ba/review.md` — fetch extended.
- [x] `grep -n 'MR_AUTHORSHIP' commands/ba/review.md` — determination present.
- [x] `grep -nE 'gh api user|glab api user' commands/ba/review.md` — current-user capture present.

**Manual:**
- [ ] Dry-run own MR → "authored by you" + Fix-locally option appears.
- [ ] Dry-run others' MR → "authored by `<name>`" + posting-only menu.
- [ ] Dry-run with simulated auth failure → "could not confirm authorship" → posting-only.
- [ ] Each precondition failure (wrong commit / dirty / fork) surfaces its specific reason + fallbacks.

> **Phase gate:** automated greps pass; manual route walkthroughs confirmed before Phase 2.

---

### Phase 2 — Item 5: Disposition recommendation (Walk)

#### Changes Required

**2a. Replace the local walk question + options** (`review.md:834-839`). Drop the "Agree?" / posting
framing; relabel **Agree → Apply**; lead with a recommendation:

````markdown
**Question format:** `"Finding [N]/[total]: [title]\n\nFiles: [file:line references]\n\n[code snippet or
description]\n\nDisposition?"` — include enough context to decide without scrolling up.

**Options** (recommended disposition listed first and pre-selected — confirming is one step):
1. **Apply** — Mechanically apply the suggested fix to the local working tree.
2. **Skip** — Don't apply (a taste call, or not worth it on your own code).
3. **Modify** — Apply with edits: you describe the adjustment, then it's applied.

Lead each finding with a **recommended disposition** and a one-line reason, e.g.
`(Recommended — Apply: clean mechanical fix, no taste call)` or `(Recommended — Skip: stylistic, your
call)`. The recommendation is a **fix-quality judgment**, not a severity threshold — a clean Medium may
be Apply; a High taste-call may be Skip. The recommended option is first and pre-selected; overriding it
costs exactly one interaction. No finding is hidden or pre-decided beyond the default selection.

For a finding **resurfaced by the guard** (Item 7), show its prior-revert marker and recommend **Skip**
or **Modify** (not Apply) — re-applying the identical reverted fix would just re-fail.
````

**2b. Note the unification** at the top of the local-scope section (`review.md:818`) and confirm the
own-MR Fix-locally path reuses it (cross-reference added in 1f). State precisely what changes vs is
preserved (convention check, advisory 2):
- **Changes:** option labels (Agree→Apply), the pre-attached recommendation, and the guard (Phase 3)
  now apply here.
- **Preserved:** the fix-local behavior itself (still applies locally, assumed-yours), the four menu
  options, and the filter semantics. **Nominate `review.md:846` (the local-scope menu) as the single
  source of truth for the `Critical + High + Med-conf-100` predicate** — the new own-MR menu option and
  the README bullet reference it by name rather than restating the predicate, so the filter isn't copied
  to a new place.

**2c. Leave the others'-MR posting walk** (`review.md:875`) unchanged — explicitly note it shows **no**
disposition recommendation (still "for discussion").

#### Success Criteria

**Automated:**
- [x] `grep -nE '\*\*Apply\*\*|Recommended —' commands/ba/review.md` — relabel + recommendation present.
- [x] `grep -c 'Include this in the review comments' commands/ba/review.md` returns `0` — stale framing gone.

**Manual:**
- [ ] Dry-run fix-local walk: each finding leads with a pre-selected recommendation + one-line reason.
- [ ] A clean Medium recommends Apply; a High taste-call recommends Skip.
- [ ] Others'-MR walk shows no recommendation.

> **Phase gate:** the walk renders recommendations correctly for both entry points before Phase 3.

---

### Phase 3 — Item 7: Execution guardrails (Guard)

#### Changes Required

**3a. Replace the post-apply block** (`review.md:841-844`) with the guard. It runs on **every fix-local
apply** — matching the existing "applies to…" list: `Apply all fixes`, `Apply Critical + High +
Med-conf-100`, and per-finding Apply/Modify from the walk — on the fix-local path only; the posting path
applies nothing and is unaffected (convention check, advisory 3):

````markdown
**After applying accepted dispositions (the guard — Item 7).** Replaces the old report-only test step.
Runs on every fix-local apply (`Apply all fixes`, `Apply Critical + High + Med-conf-100`, and per-finding
Apply/Modify). If the accepted set is empty (all Skipped, or a filter that matched zero), apply nothing,
note "nothing applied," and return to the menu — no reconciliation, no test run.

**1. Bidirectional reconciliation.** Map findings to edits by **target region** (file + line range),
many-to-many — one edit may satisfy several findings; one finding may need edits across files:
- **Under-application** — an accepted (Apply/Modify) finding whose target region was NOT changed.
  Surface: "Finding <N> was accepted but no edit landed." Never silently resolve.
- **Over-application** — an edit to a region NO accepted finding targets (e.g., a Skipped finding's
  region). Surface: "An edit touched <file:line> but no accepted finding targets it." Never silently
  resolve.
- A **Modify** satisfies its finding via the modified edit. For both Apply and Modify, "target region"
  means the **applied edit's actual diff region** (not the suggested fix's text), so a legitimately wider
  Modify is not flagged as over-application. A multi-file finding counts as **applied** when any of its
  targeted regions is edited — a partial Modify is the user's choice, not under-application.

**2. Verify-then-keep (auto-revert + resurface).** Detect the project's targeted test/compile command
for the affected files (from repo conventions — `package.json` scripts, Makefile target, language
default, or a command documented in CLAUDE.md/README):
- **Could not verify** (no runnable test/compile command for the affected files) → keep the fixes but
  surface: "applied fixes were NOT verified (no runnable tests for the affected files) — review
  manually." Unverified is distinct from passing.
- Otherwise, note whether the targeted tests **already pass before applying** (a cheap baseline run; if a
  baseline can't be established, treat the pre-state as unknown). Apply, then re-run:
  - **Green** → keep the fixes.
  - **Newly red** (passed at baseline, fail after applying) → **auto-revert and resurface**: when the
    test output *clearly* implicates a specific fix's file(s), revert that fix; otherwise revert **all**
    fixes from this apply batch — never guess the culprit, never leave a newly-failing tree. Resurface
    each reverted finding as an open finding ("an unverified fix is not finished"). Reverting the whole
    batch when attribution is unclear also avoids cascade / half-state issues between dependent fixes.
  - **Already red / environmental** (failing at baseline, or failing for env reasons — missing deps, no
    services, no DB) → the failure is **not attributable** to the applied fixes: keep the fixes and
    surface "tests failing independently of the applied fixes — review manually." Do **not** revert good
    work for a broken environment.

Auto-revert is the **only** sanctioned reversal; it is never a silent drop because the resurfacing IS
the surfacing.

**3. Return to the menu** with the reconciliation report (if any), the verify outcome, and any
resurfaced findings listed as **open**. A resurfaced finding re-enters at the menu, **not** auto-re-walked;
re-attempting is user-driven, and the walk recommends Skip/Modify for it (Phase 2) so a broken fix can't
loop. No skipped finding is ever applied; no accepted finding is reversed except via this surfaced revert.

**Protected artifacts (applier-facing).** The applier may edit the **content** of files under
`docs/{brainstorms,plans,solutions,research,reviews}/` when a finding targets them, but must never apply
a finding that deletes, relocates, or renames them — consistent with the reviewer-dispatch guard
(identity protected, contents not).
````

#### Success Criteria

**Automated:**
- [x] `grep -nE 'reconciliation|auto-revert|resurface' commands/ba/review.md` — guard present.
- [x] `grep -n 'NOT verified' commands/ba/review.md` — could-not-verify outcome present.
- [x] `grep -n 'applier' commands/ba/review.md` — applier-facing protected-artifacts note present.

**Manual:**
- [ ] Dry-run: accepted-but-no-edit and skipped-but-edited each get reported.
- [ ] Dry-run a fix that fails tests → auto-revert + resurface as open finding.
- [ ] Dry-run with no test command → fixes kept + "NOT verified" notice.
- [ ] Resurfaced finding returns to menu (not auto-re-walked); recommendation flips to Skip/Modify.

> **Phase gate:** all guard outcomes (green / red-attributable / red-non-attributable / could-not-verify)
> exercised in dry-run before shipping.

---

### Phase 4 — Docs & version (ship discipline)

#### Changes Required

**4a. Rewrite `README.md:166`** (the "Fix application" bullet), summarizing and pointing to the source
of truth (mirrors the §4-rubric precedent at `README.md:217`):

```markdown
- **Fix application & own-MR resolution** — for local scopes and your **own** MR (authorship detected
  from `gh`/`glab`), apply fixes locally: apply-all, Critical + High + Med-conf-100, or a one-by-one walk
  where each finding leads with a recommended disposition (**Apply / Skip / Modify**). A precondition
  check confirms the local tree matches the reviewed diff before editing; a verify-then-keep guard runs
  targeted tests after applying and **auto-reverts + resurfaces** any fix that fails, with bidirectional
  reconciliation of accepted-vs-applied. Reviewing **someone else's** MR stays posting-only. See
  `commands/ba/review.md` §5 for the authoritative resolution flow.
```

**4b. Bump `.claude-plugin/plugin.json:3`** — `"version": "0.21.0"` → `"version": "0.22.0"`.

**4c. Leave `CLAUDE.md` unchanged** — the never-hide selection bullet stays selection-scoped; do NOT
fold resolution-never-hiding into it (convention check, advisory 1).

#### Success Criteria

**Automated:**
- [x] `grep -n '0.22.0' .claude-plugin/plugin.json` — version bumped.
- [x] `grep -n 'own-MR resolution' README.md` — bullet rewritten.
- [x] `git diff --name-only CLAUDE.md` empty for this change — no CLAUDE.md edit.

**Manual:**
- [ ] README bullet reads accurately against the final Step 5 behavior.

## Dependencies & Risks

- **`gh` / `glab` field availability.** `headRefOid` / `isCrossRepository` (GitHub) and
  `diff_refs.head_sha` / `source_project_id` (GitLab) must exist in the installed CLI versions. *Mitigation:*
  a missing field degrades to *undetermined* (posting-only) or a precondition failure with a surfaced
  reason — never a silent wrong-tree edit.
- **Test-runner detection variance.** No universal way to run "targeted tests" across arbitrary repos.
  *Mitigation:* the named "could-not-verify" outcome keeps fixes but flags them unverified.
- **Attribution ambiguity** when many fixes touch one failing test. *Mitigation:* a pre-apply baseline
  distinguishes fix-introduced failures from pre-existing / environmental ones (those keep the fixes +
  surface "review manually"); for fix-introduced failures, revert the clearly-implicated fix or, when
  unclear, the whole batch — never guess, never leave a newly-failing tree, never silently over-revert.
- **No real-harness integration test this slice.** Prompt-only change ships on a dry-run; a real-harness
  exercise of the `gh`/`glab` plumbing is deferred to a follow-up (per the prompt-only-ships-on-dry-run
  practice). Don't gate the merge on it.
- **Menu-ceiling trade-off** (dropping the own-MR discussion walk) is a deliberate, documented override;
  revisit if users miss selectively posting from their own MR.

## Convention Compliance

- [x] **Artifact path & frontmatter** — `docs/plans/2026-06-08-feat-…-plan.md`, full YAML frontmatter — aligned.
- [x] **planning-commands-never-write-code** — plan documents replacement prose; `/ba:execute` implements — aligned.
- [x] **Update README when commands change** — Phase 4a — aligned (explicit step).
- [x] **Bump plugin.json version** — Phase 4b, `0.21.0 → 0.22.0` — aligned (explicit step, not deferred).
- [x] **never-hide sync triple stays selection-scoped** — no edit to the 3 synced statements; resolution-
      never-hiding kept separate — aligned (convention check, advisory 1).
- [x] **Protected-artifacts guard** — applier-facing identity-not-contents note added at the Step 5 site — aligned (advisory 4).
- [x] **Public-safe / Item N** — generic CLI + examples; "Issue 28" without `#`; "Item 5/6/7" — aligned.
- [x] **Justified override — own-MR menu drops the discussion walk** — forced by the AskUserQuestion
      4-option ceiling; justified by the brainstorm's "thin on your own MR" logic; discussion walk kept on
      others'-MR. Documented in Technical Considerations.
- [x] **STOP rule (`review.md:208`)** — precondition uses SHA/`git status`, guard uses tests; no re-diff —
      aligned (carried as a Behaviors-to-Test item).

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-06-07-ba-review-own-mr-resolution-pipeline-brainstorm.md` — key
  decisions carried forward: scope-stays-primary + add Fix-locally; authorship net-new MR-only;
  fix-local precondition-gated; Apply/Skip/Modify recommendation-first; disposition-overrides-severity;
  bidirectional reconciliation + verify-then-keep auto-revert-and-resurface; independent validator deferred.

### Internal References
- Change site: `commands/ba/review.md` — Step 1b fetch (`:79`, `:87`, `:90-96`), Step 1f STOP rule
  (`:202-208`), Step 5 Resolution (`:814-905`), local walk (`:830-844`), MR menu (`:867-871`),
  protected-artifacts guards (`:425`, `:471`, `:523`).
- `README.md:163` (selection-ledger never-hide, untouched), `README.md:166` (Fix-application bullet, rewritten).
- `.claude-plugin/plugin.json:3` (version).
- `CLAUDE.md:74/80/81/82` (version bump, never-hide scope, protected-artifacts, README-update conventions).

### Deferral basis
- `docs/research/2026-06-07-verify-fix-precondition-frequency-research.md` — why the independent validator
  stays parked until an autonomous-action path is added (this pipeline keeps the human as decider).
