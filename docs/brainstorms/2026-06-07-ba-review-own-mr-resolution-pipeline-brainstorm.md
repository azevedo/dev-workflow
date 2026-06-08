---
date: 2026-06-07
topic: ba-review-own-mr-resolution-pipeline
status: approved
triage_level: full
tags: [ba-review, resolution, authorship-routing, disposition-recommendation, execution-guardrails]
---

# `/ba:review` Own-MR Resolution Pipeline (route → walk → guard)

## What We're Building

Issue #28's downstream half of the `/ba:review` automation roadmap: a coherent pipeline
for resolving findings on your **own** MR — *how findings are walked and applied* once the
review has produced them. It lands entirely inside **Step 5 (Resolution)** of
`commands/ba/review.md`; reviewer dispatch and consolidation (Steps 1–4) are untouched.

Three composing items, treated as **hypotheses, not specs**:

- **Item 6 — Route.** Pick the channel by authorship: my MR → fix locally; someone else's →
  post a comment.
- **Item 5 — Walk.** In the fix-local walk, pre-attach a recommended disposition + one-line
  reason to each finding so the one-by-one walk becomes *confirm-or-override* instead of
  cold-deciding every finding.
- **Item 7 — Guard.** When applying accepted dispositions, apply exactly what was accepted —
  never reverse or exceed a decision, never silently skip an accepted fix that won't
  apply/compile.

## Why This Approach

Today Step 5 splits by **scope** (local → fix-local menu; remote MR → post-comment menu),
and the MR path forbids local state entirely (`review.md:55`, `:208`). Authorship and scope
already coincide in the common cases — my local branch is fixable-and-mine; someone else's
MR-by-URL is comment-and-theirs. The **only** genuinely new behavior Item 6 introduces is
*reviewing my own MR by URL and fixing it locally*, which collides with the "local state is
irrelevant" rule.

**Route — scope stays primary; add a fix-local option (chosen over a full authorship
re-route).** Rather than restructure Step 5 around authorship, keep the scope split and, when
the reviewed MR is **mine**, *add* a Fix-locally option to the MR resolution menu. Lower-risk
and surgical; the routing is an added channel, not a rewrite. Rejected: (a) full
authorship-as-channel-selector — more restructuring than the single divergent case warrants;
(c) local-scope-only detection — would nearly no-op Item 6, since local+mine already fixes
today.

**Walk — Apply / Skip / Modify (chosen over the issue's literal Apply/Skip/Discuss).** Reuse
the walk's existing actions; relabel Agree→Apply for the fix-local context; pre-select the
recommended disposition with a one-line reason. "Discuss" is dropped: it is semantically thin
on your *own* MR (no second party), and Apply-or-Skip plus Modify already covers own-code
decisions. The recommendation is a **judgment** (clean mechanical fix → Apply; taste call →
Skip; apply-with-edits → Modify) that can override severity — finer than the blunt
`Critical+High+Med-conf-100` filter. A wrong recommendation costs one cold decision; you stay
the decider.

**Guard — verify-then-keep with auto-revert + resurface (chosen over confirm-first).** The
existing post-apply test run (`review.md:841-844`) reports failures and returns to the menu —
it neither reverts nor catches a *silently-dropped* accepted fix (tests pass when the missing
change isn't covered). Item 7 adds a **bidirectional reconciliation** (accepted-but-no-edit
*and* skipped-but-edited) plus CE's verify-then-keep: on test/compile failure, auto-revert
that fix and resurface it as an open finding ("an unverified fix is not finished"). The
resurfacing *is* the surfacing — auto-revert never becomes a silent drop, so it satisfies the
issue's "surface and confirm" while removing a confirm in the common case. CE precedent:
`ce-code-review/SKILL.md` ("apply clear improvements… after applying, run tests/lint; if they
fail, revert that fix and report it as a finding"; "never silently drop").

**Design-it-twice did not fire** — all three items modify existing `/ba:review` Step 5 prose;
no new file, module, agent, command, exported symbol, or public interface is proposed
(matching the precedent set by `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md`).

## Key Decisions

- **Route: scope stays primary; add a Fix-locally option on own MRs.** — Only one case
  diverges (own MR by URL); adding an option is surgical where a re-route is not.
- **Authorship detection is net-new and MR-scope-only.** — Add `author` to the
  `gh pr view --json` / `glab mr view` fetch (`review.md:79`) and compare to the current user
  (`gh api user` / `glab api user`, git-config fallback). Nothing in the repo detects
  authorship today, so there is nothing to contradict. Local scope is assumed-yours (you have
  it checked out).
- **Fix-local is precondition-gated.** — Requires the MR head branch checked out *and* aligned
  with the reviewed diff. Alignment has a second payoff: it is what makes the remote diff's
  `file:line` anchors valid for local application. Precondition fails (branch absent / diverged
  / fork) → surface and offer checkout / post-comment / patch; never silently fix the wrong
  tree or do nothing. This is Item 7's never-silently philosophy applied to Item 6.
- **Walk vocabulary: Apply / Skip / Modify**, recommendation listed first with
  `(Recommended — <reason>)`. — Reuses existing actions; no new "Discuss" disposition.
- **Disposition is a judgment that can override severity.** — A clean Medium can be Apply; a
  High taste-call can be Skip. Not a severity threshold.
- **Item 5 is fix-local only.** — The posting walk (others' MR) keeps today's behavior; the
  `Critical+High+Med-conf-100` filter already curates posting volume (declined item c).
- **Guard: bidirectional reconciliation + verify-then-keep auto-revert-and-resurface.** —
  Catches both under-application (accepted, no edit) and over-application (skipped, edited);
  the only sanctioned reversal is the verify revert, always resurfaced as an open finding.
- **Item 7 is the cheapest autonomy down-payment; the independent validator stays deferred.** —
  Faithful execution is a prerequisite for any future autonomous-apply path, but the
  independent-validator design remains parked until an autonomous-action path is added (per
  `docs/research/2026-06-07-verify-fix-precondition-frequency-research.md`). This pipeline keeps
  the human as decider throughout.

## Scope Boundaries

**Not doing:**
- **No independent validator / Stage-5b** — deferred to the autonomous-action path (research
  doc above). This pipeline is human-in-the-loop.
- **No auto-apply without confirm** — the lever is pre-qualifying and reconciling the walk,
  never deciding substance for the user.
- **No softened framing on others' MRs (declined b)** and **no volume curation (declined c).**
- **No change to the posting channel** — others'-MR posting (Conventional Comments,
  non-blocking default, existing filter) is untouched; Item 5's recommendation does not apply
  to the posting walk.
- **No change to local-scope fix behavior** — it already fixes-local and is assumed-yours.
- **No restructure of Steps 1–4** — reviewer selection, dispatch, and consolidation are
  out of scope; only the `author` field is added to the Step 1b metadata fetch.
- **Protected-artifacts guard holds** — fix-local apply may edit *content* of files under
  `docs/{brainstorms,plans,solutions,research,reviews}/` when a finding targets them, but never
  their existence or path (consistent with the existing guard, which protects identity, not
  content).

## Acceptance Criteria

### Item 6 — Authorship routing
- For MR scope, the resolution step fetches and compares the MR author against the current
  `gh`/`glab` user; the determination (mine / theirs) is stated before the menu.
- When the MR is **mine**, the resolution menu offers **Fix locally** alongside the post
  options; when it is **someone else's**, the menu is posting-only (today's behavior).
- Selecting **Fix locally** runs a precondition check (head branch checked out + aligned with
  the reviewed diff). On failure it surfaces the specific reason and offers checkout /
  post-comment / patch — it never edits a misaligned or wrong working tree silently.
- Local-scope behavior is unchanged.

### Item 5 — Disposition recommendation (fix-local walk)
- Each finding in the fix-local one-by-one walk leads with a recommended disposition
  (**Apply / Skip / Modify**) and a one-line reason; the recommended option is first/selectable
  so confirming is one step.
- The recommendation reflects fix-quality judgment, not severity alone (a clean Medium may be
  Apply; a High taste-call may be Skip).
- Overriding the recommendation costs exactly one interaction; no finding is hidden or
  pre-decided beyond the default selection.
- The posting walk (others' MR) shows no disposition recommendation.

### Item 7 — Execution guardrails
- After applying accepted dispositions, a reconciliation reports any **accepted finding with no
  corresponding edit** (under-application) and any **edit made for a skipped finding**
  (over-application); both are surfaced, never silently resolved.
- On targeted-test/compile failure, the offending fix is **auto-reverted and resurfaced** as an
  open finding (not left broken, not silently dropped).
- No skipped finding is applied; no accepted finding is reversed except via the surfaced
  verify-then-keep revert.
- The guard runs on the fix-local path; the posting path is unaffected.

## Open Questions

*(none — all three design forks resolved this session; see Resolved Questions)*

### Resolved Questions
- **Route structure?** Scope stays primary; add a Fix-locally option on own MRs (not a full
  authorship re-route, not local-scope-only).
- **Walk vocabulary?** Apply / Skip / Modify (reuse existing actions); "Discuss" dropped as
  thin on own MRs.
- **Guard depth?** Bidirectional reconciliation + CE-style verify-then-keep auto-revert and
  resurface (not confirm-first, not coverage-check-only).

## Convention Compliance

Checked against `CLAUDE.md`, `commands/ba/review.md`, `README.md`, and `plugin.json`.
**No violations** — the artifact is convention-clean. Aligned on: frontmatter + artifact
path/naming, planning-commands-never-write-code (stays WHAT-not-HOW; exact command syntax is
deferred to the plan), the never-hide convention (the design extends it — auto-revert resurfaces,
reconciliation surfaces both under/over-application, precondition failures surface a reason),
the protected-artifacts guard (content-editable, identity/path-protected — faithful to
`review.md:425/471/523`), public-safe artifact rule, and "Item N" enumeration.

**Forward-looking notes (plan/execute deliverables, not brainstorm-blocking):**
- **Update `README.md`** — the `/ba:review` "Fix application" bullet (`README.md:166`) goes stale
  once the own-MR fix-local path, the Apply/Skip/Modify vocabulary, and authorship routing land.
  Verify the never-hide summary (`README.md:163`) stays in sync with `review.md` Step 2 and the
  `CLAUDE.md` never-hide bullet if resolution-path framing touches never-hide.
- **Bump `plugin.json` version** (currently `0.21.0`) — the auto-update cache key; a behavioral
  `/ba:review` change is a shipped change. Carry as an explicit plan step; do not defer.

## Next Steps
→ `/ba:plan` to create the implementation plan for the route → walk → guard pipeline.
