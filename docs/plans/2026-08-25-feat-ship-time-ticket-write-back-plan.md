---
title: Ship-Time Ticket Write-Back
type: feat
plan_schema: 2
status: active  # human-authored only — /ba-execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-08-25
origin: docs/brainstorms/2026-08-25-ship-time-ticket-write-back-brainstorm.md
detail_level: standard
tags: [ba-propose, tracker-write-back, linear, github-issues, receipt-enum]
---

# Ship-Time Ticket Write-Back Implementation Plan

## Overview

`/ba-propose` gains a second outward effect: after the PR/MR is open, Step 5e posts one append-only
comment to the origin ticket carrying the shipped PR URL and the deviation-trailer texts gathered in
Step 2f. Today the flow reads the origin ticket, legitimately drifts from it, and lands that drift in
`docs/` artifacts and a PR body — while the ticket, which is what the team actually reads, stays as it
was written (see brainstorm: `## What We're Building`).

The work is a new owned operation, `record-ship(ship, opts) → record`, specified inline in
`skills/ba-propose/SKILL.md` and called once from 5e, plus the read-path change that makes its GitHub
half reachable, plus the six documented lines across three files that already *claim* this feature
exists (issue #91, which folds in here).

Roadmap: issue #91 (`bug`, `ready`, `cluster:infra`, hub #29). Adjacent: #87 (the capture enum's
presence-only CI pin, which this ship's new enum inherits), #34 (planning-time tracker writes).

## Current State

- **Step 5e** (`skills/ba-propose/SKILL.md:720-823`) prints a three-line receipt — `✓ <title>`, the
  `CREATED_PR_URL` captured in 5d, and `capture: <value>` over a **closed six-literal** enum
  (`:731-733`). Lines 2-4 are indented two spaces. An unparseable-URL guard (`:744-751`) prints a
  two-line receipt and **returns before the resolver** (`:766-768`). A bare `✓` line alone is the
  sole signature of a genuine partial print.
- **Step 5f** (`:825-893`) is a pure consumer of 5e's disposition, one branch, non-blocking and
  mode-independent. It prints its own lines *after* the receipt.
- **Step 2b** (`:195-226`) is Linear-only: `--issue <ID>` (documented at `:24` as binding "a **Linear**
  issue ID") or a branch-name `[A-Z]{2,5}-[0-9]+` extract, then `mcp__claude_ai_Linear__get_issue`
  (`:206`) — the **only** MCP call by name in the entire prompt surface. On failure it sets
  `issue_context = None` **and** `mcp_unavailable = True` (`:222`); `:226` guarantees
  `mcp_unavailable` is orchestrator-side only, its sole consumer the Step 4 preview warning at `:542`.
- **Step 2f** (`:301-315`) gathers `deviation_trailers` as a tuple of unique trailer **texts** with the
  `U<n>` label deliberately stripped at gather time (`:309`) — "plan-scoped state a reviewer cannot
  decode".
- **Composition** reads `issue_context` at exactly three rows: #3 Motivation (`:445`, gated on the
  context being **present**), #7 Cross-refs (`:448`, gated on `.ref`), #8 Bug summaries (`:449`, gated
  on `.body_text`). Row 13 (`:454`) names a **non-existent** "Linear rollup" as typo tier's only
  deviation safety net.
- **`REPO_SLUG` does not exist anywhere in the repo.** Step 0a parses `REMOTE_URL` to classify `HOST ∈
  {github, ghes, gitlab, gitlab-self, unknown}` (`:36-56`) and discards it.
- **CI** (`scripts/check-invariants.mjs`, 8 checks, baseline green) pins none of the enum. `version-bump`
  fires on any `skills/` change; `retired-invocations` fails on any `/ba:` colon spelling; `sentinels`
  requires every `<<'TOKEN'` heredoc opener to sit inside a fenced block with **exactly one** matching
  terminator in that fence (2 openers today).

## Acceptance Criteria

- AC1: A ship whose ref routes to Linear, with a Linear comment-write MCP tool present, leaves one
  comment on that ticket containing the PR URL, and receipt line 4 names `posted` and the target.
- AC2: A ship whose ref is `#123` or a bare number, on a GitHub host, leaves one comment on that issue
  via `gh issue comment` with an explicit `-R <REPO_SLUG>`, and the same receipt line shape.
- AC3: A ship with no usable ticket ref prints `ticket: skipped — no-ticket-ref` — a present line,
  never an absent one. "No usable ref" covers three cases: no ref at all, a ref whose shape routes
  nowhere, and a GitHub-route ref that cannot be *confirmed* to name an issue rather than a pull
  request.
- AC4: A ref present with no reachable writer prints `ticket: skipped — tracker-unconfigured` and
  attempts no write. The pre-check that decides this makes **no network call** — it observes local
  presence only, and an auth failure is `failed — tracker-rejected`, never `unconfigured`.
- AC5: A tracker that passes the pre-check and rejects, times out, or returns an unparseable result
  prints `ticket: failed — tracker-rejected`; the ship's exit status is unchanged and the PR URL is
  still printed. `posted` is printed only on a confirmed write.
- AC6: The comment fires at every size tier, demonstrated at **typo tier with non-empty trailers** —
  the exact hole `skills/ba-propose/SKILL.md:454` claims as its guarantee.
- AC7: Step 2b returns a populated `IssueContext` with `resolution: ref-only` on read failure, and
  `resolution: linked` is reachable on both the Linear and the GitHub branch.
- AC8: No composition row reads `.resolution`. Each row that reads `issue_context` is gated on **the
  field it renders being non-empty**, so a `ref-only` context cannot make Motivation lead with nothing.
- AC9: The receipt is four lines normally and **three** on the unresolved-URL guard, with the bare `✓`
  line remaining the only partial-print signature.
- AC10: A `ref-only` context leaves the composed PR body byte-identical to `main` for every row except
  Cross-refs, whose widening is recorded as a deliberate decision.
- AC11: The six #91 lines describe behavior that now happens, worded against the disposition set and
  without naming Linear as the only tracker — including the two `/ba-execute` reminder strings, whose
  "not durable until then" promise stays false on every non-create route.
- AC12: Every claim in the repo about the receipt's line count or a line's number moves together (six
  sites, including `:735`'s definite article), and every prose cardinal naming an enum's size says
  **which** enum. **This is a hand-audit obligation, not a checkable criterion** — nothing can verify
  the second half, and U6 already carries the site list operationally. It is kept here as a named
  residual rather than deleted, and it is deliberately *not* claimed as verified; see
  Dependencies & Risks.
- AC13: The three sync-declared "beyond the staged diff" sites name the second outward effect.
- AC14: Interpolated trailer prose cannot autolink an unrelated issue, mention a person, or pair a
  closing keyword with a ref on either tracker.
- AC15: The seam never retries a write on its own.
- AC16: A fixture A/B over at least four planted cases, across `main` and the proposed body, scored in
  both directions for what the change fixes and what it costs.
- AC17: `posted` and `failed — tracker-rejected` are each observed at least once against a scratch
  ticket in a fresh session before the ship, since the fixture A/B structurally cannot reach them.
- AC18: One version bump, `0.47.0` → `0.48.0`.
- AC19: The Step 4 preview names the resolved ref, the tracker it will be written to, **and the
  sanitized trailer texts the comment will carry**, before the confirm, on both routes — and `none`
  when no usable ref resolved.
- AC20: No write ever reaches a repository or ticket the user did not name. Specifically: the slug
  comes from the resolved PR target and never from `origin`; a `ghes` target is host-qualified or the
  run degrades; and a Linear ref extracted from a branch name is written only after the read
  confirmed it exists.
- AC21: Every literal in the ticket disposition set has either a demonstrated production path or an
  explicit statement that it is a defensive catch-all — no literal ships with an undiscoverable cause.

## What We're NOT Doing

Carried forward from the brainstorm's Scope Boundaries:

- **Plan-time write-back.** Handed to #34. `/ba-plan` forbids tracker API calls by name and no ticket
  ID survives it.
- **Upsert or description-edit.** Append-only, one comment per ship.
- **A third tracker.** `glab issue note` is not added: a numeric ref on a GitLab host resolves to
  `skipped — tracker-unconfigured`, not a GitLab write.
- **Cross-repo refs.** `org/repo#N` is an unroutable shape (AC3), not a supported target.
- **Composition row 7's unconditional `Fixes <ref>` closing keyword.** A separate latent defect; needs
  its own issue.
- **CI pinning of the new enum.** Hand-maintained, exactly as `capture:` shipped; inherits #87.
- **No `CLAUDE.md` owned-operation bullet and no entry in the U-ID / stack-base grid.** `record-ship`
  is single-file with one caller and touches neither `<base>` derivation nor unit anchors.

Added by this plan, with reasons:

- **No off switch.** A repo with Linear-shaped branch names but no Linear workspace would see a
  standing `failed — tracker-rejected`. The local-presence pre-check (AC4) makes the common form of
  this quiet (`tracker-unconfigured`), and "no new gate" is locked. Recorded as a residual and a
  candidate follow-up issue rather than new surface.
- **No rename of `unavailable`.** It reads in plain English as "the tracker was unavailable" but means
  "the seam threw" — the same meaning the `capture:` enum already gives it. Consistency inside the
  file beats plain-English precision; the literal is locked.
- **No numeric extraction from branch names.** See U3.

## Proposed Solution

One new owned operation, specified inline in `skills/ba-propose/SKILL.md` as a top-level section
placed after 5f and before `## Failure Modes`, cited **by name** from 5e. Inline rather than a
reference file per the brainstorm's placement decision (#59 slice 2 measured extraction costing ~1318
estimated tokens *more* on the conditional path than it saved resident). Named
`## Ship-Time Ticket Write-Back` without a "Convention" suffix — in this repo that suffix signals a
cross-file mirror obligation, which the brainstorm explicitly excluded.

**Why after 5f rather than before Step 5.** `skills/ba-execute/SKILL.md` front-loads both its owned
operations ahead of Step 1, and that is right for *those*: each has several cross-file consumers, so
a reader arrives at them from any of four skills. `record-ship` has exactly one caller in one file,
and dropping ~70 lines of spec between Step 4 and Step 5 would break the 0→1→2→3→4→5 reading order
`ba-propose` otherwise keeps. 5e cites the section **by name**, per the prompt-authoring rule to cite
by name and never by position, so a forward reference costs a reader nothing.

The call site gains two lines and zero branches:

```
print(f"  capture: {decision}")     # line 3, unchanged
record = record-ship(...)           # the network round-trip lands HERE
print(record.receipt_line)          # line 4, verbatim
```

Everything else is the read path that makes the operation's GitHub half reachable, and the mirror
edits that make six existing claims true.

### The three findings that changed the locked design

The brainstorm's `## Locked Design` is refined, not re-litigated, at three points where it is not
implementable as written:

1. **`skipped — ship-url-unresolved` was a dead literal.** 5e judges URL validity and `return`s at
   `:766-768`, before the call site. The locked design says `url` is "unvalidated — the seam judges
   it", so there were two independent judgments of the same value with the existing one
   short-circuiting first. Resolved by making the guard fall through to the call: three lines, not two
   (AC9). This is the mirror image of the hazard 5e's own Code-shape decision block already names.
2. **`ship.repo_slug` was never materialized** (U2).
3. **The comment cannot carry `U<n>`.** Step 2f strips the label at gather time by design, and the
   locked design passes `deviation_trailers` unchanged. The comment carries trailer *texts*. 2f's
   stated rationale — plan-scoped state the reader cannot decode — applies **more** strongly to a
   ticket audience than to a reviewer, so no 2f change is warranted.

## Technical Considerations

- **Machine boundary vs steering** (`.claude/agent_docs/prompt-authoring.md:7-23`). Specified to the
  character: the six disposition literals, receipt line 4's rendered shape and two-space indent, the
  ref-shape routing predicate, `resolution`'s two legal values, the sanitization rules, the
  pre-check's ordering, and the no-retry rule. Left as steering: the comment's prose only. Precedent
  for the split is `:787-789`'s treatment of `interactive_session()`. There is deliberately **no**
  "is this deviation worth posting" judgment: composition row 13 filters for reviewer-relevance
  because a PR body matches weight to weight, but the ticket comment is an archive and posts every
  trailer 2f gathered. A steering item with no branch behind it would be a dead condition.
- **Weight.** `skills/ba-propose/SKILL.md` is already 924 lines and loads whole on every invocation,
  so placement inside 5e versus a sibling section changes nothing resident. Keep the new section
  tight; it is single-caller and should be a fraction of `resolve-stack-base`'s 192 lines.
- **The pre-check must not become the probe ladder this file already rejected.** `:52-54` rejected
  host auto-detection because "the probes have unspecified failure semantics (CLI-missing vs
  probe-error)". `gh auth status` is exactly that shape. Hence AC4's no-network rule.
- **`mcp__claude_ai_Linear__save_comment` is a user-specific tool name** — that prefix is one user's
  server naming. The pre-check is spelled as a capability ("a Linear comment-write MCP tool, any
  server prefix"), not a literal. The existing `:206` literal carries the same latent fragility;
  noted, not changed.
- **Two body composers now live in one file.** The ticket comment is **not** `ComposedBody.body` and
  Step 3's purity and seam invariants do not apply to it.
- **What the `Verify:` lines do and do not claim.** In a prompt repo the shipped artifact *is* prose,
  so every `Verify:` here is necessarily a read over that prose. They are therefore written as
  **wiring conjunctions** (declaration AND producer AND consumer) or as **ordering assertions**, per
  `skills/ba-plan/SKILL.md`'s minting rules and the ordering `awk` the 5f-receipt ship already
  shipped — never as a presence-only grep, which would pass the moment the text is typed. What they
  cannot establish is that the model *behaves* differently; that claim belongs to U1's fixture A/B
  and U9's live run, and those two units carry it deliberately.

## System-Wide Impact

- **Interaction graph.** 5d produces `CREATED_PR_URL` → 5e prints lines 1-3 → `record-ship` → line 4
  → 5f dispatches on the *capture* disposition (unchanged; it never reads the ticket disposition).
  Step 2b now feeds two consumers, composition and the seam.
- **Error propagation.** Every internal throw collapses to `unavailable` inside the seam; exit status
  is fixed by 5c/5d before 5e runs, so nothing here can alter it. A hung call is not a throw — hence
  the bounded wait in U5.
- **State lifecycle risks.** The write is append-only and irreversible. At-most-once rests on 5d
  creating at most one PR, *plus* U5's explicit no-retry rule. A session that dies between 5d and 5e
  loses the write-back permanently: the next run resolves to `commit_push_edit`/`edit_only`, which
  never reach 5e. This is the honest scope of the feature and AC11's rewording must say so.
- **Contiguity.** 5e's "one contiguous block" claim (`:722`) stops being literally true: a tool call
  between lines 3 and 4 can interleave rendering. The brainstorm's Trade-offs already accepted the
  stall there ("between lines 3 and 4"), chosen over calling before line 1 so the URL still prints
  fast. The claim is amended to "four lines in fixed order" rather than the ordering being changed.

## Implementation Approach

### Changes Required

#### U1 — Decide the change by fixture A/B before building it

Per `.claude/agent_docs/prompt-authoring.md:73-93` and `CLAUDE.md`'s prompt-change convention: a
prompt change is decided by fixture A/B, and a session cannot dry-run the body it loaded at start.

Seven fixtures with planted ground truth, each a `commit_push_create` ship: (a) no ticket ref, (b) a
`TO-`-shaped ref whose read failed, (c) a GitHub numeric ref passed via `--issue`, (d) typo tier with
non-empty trailers, (e) a `ref-only` context scored for **composed-body equality against `main`** —
the instrument AC10 otherwise lacks, (f) `HOST=ghes` with a numeric ref, and (g) `HOST=unknown`. Two conditions: `main`, and the proposed 5e + `record-ship` body. One subagent
per cell at the session model, given the spec excerpt and the fixture only, **no repo access**.

Score both directions: what the change fixes (a printed `ticket:` line on every cell; the typo-tier
deviation reaching somewhere) and what it costs (receipt lines the change suppresses, a disposition
chosen off-enum, a cell that invents a gate). **Cell (e) additionally scores whether the composed PR
body differs from `main`'s** — that is AC10's only falsifiable check, since U4's `Verify:` can read
the gating predicate's text but cannot diff a composed body. **Cells (f) and (g) exist because an
implementer who hardcodes `HOST == "github"` instead of `HOST ∈ {github, ghes}` would otherwise pass
every scenario in this plan.**

Pre-committed decision rule: the proposed arm must produce an on-enum disposition on all seven cells,
suppress nothing `main` printed, and leave cell (e)'s composed body unchanged. Anything else is
inconclusive and returns to a decision round rather than shipping.

Per `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`,
attribute every verdict to a specific source sentence or mark the cell inconclusive — the caller's
global `CLAUDE.md` loads into subagents and has already contaminated one baseline in this repo. Per
`docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md`,
assert the mechanism ran before scoring anything, and treat arm agreement as suspicious rather than
reassuring.

Verdict lands in `docs/research/2026-08-25-ship-time-write-back-ab-research.md`. The fixtures
themselves are not committed — they are prompt text handed to subagents — but the score table and the
per-cell attribution are, so this unit does have a code-matchable artifact and is **not**
commit-tag-only.

Test scenarios:
- The proposed arm prints an on-enum `ticket:` line on all four cells where `main` prints none (Covers AC16)
- The typo-tier cell surfaces the deviation somewhere, which `main` does not (Covers AC6, AC16)
- Each cell's verdict cites the sentence that produced it, or is marked inconclusive (Covers AC16)
- No cell invents a confirmation gate the spec does not contain (Covers AC16)

Verify: `test -f docs/research/2026-08-25-ship-time-write-back-ab-research.md && [ "$(grep -c '^| ' docs/research/2026-08-25-ship-time-write-back-ab-research.md)" -ge 8 ] && grep -qE 'verdict|inconclusive' docs/research/2026-08-25-ship-time-write-back-ab-research.md` — existence **plus** a score table of at least the seven cells' rows plus a header, **plus** a recorded verdict. Bare `test -f` would pass on a doc that says nothing; this is the load-bearing behavioral gate for the whole feature, so it earns a structural check rather than a file-existence claim.

---

**File**: `skills/ba-propose/SKILL.md`

#### U2 — Materialize `REPO_SLUG` in Step 0a

Without an explicit `-R`, `gh issue comment` resolves the repo from the cwd's remotes, which can
prompt interactively and hang. But **`origin` is the wrong source for the slug**, and the fork
workflow this unit exists to protect is exactly where it breaks: `gh pr create` opens the PR on
upstream while `origin` is the fork, so an `--issue 123` naming an *upstream* issue would be pinned
to the fork. If the fork has issues enabled, `123` confirms as a valid issue and the write lands on
the wrong repository, reported as `posted`.

**So derive `REPO_SLUG` from the resolved PR target repo** — the same value 5d passes to
`gh pr create` — not from `REMOTE_URL`. When that value is not available at 5e, resolve to
`skipped — no-ticket-ref` rather than falling back to `origin`: a target we cannot name is not a
usable one. (The brainstorm rejected Design C's "derive from the PR URL"; the PR *target* is a
different and already-settled input, not a re-derivation from URL shape.)

**`ghes` needs the fully-qualified form.** `gh --repo` accepts `[HOST/]OWNER/REPO`, and a bare
`owner/repo` resolves against **github.com** whenever `GH_HOST` is unset or points elsewhere. Since
`gh` needs no write permission to comment on a public repo's issue, a bare internal slug can publish
the PR URL and the deviation prose to an unrelated public tracker. On the `ghes` route pass
`-R "$GH_HOST/owner/repo"`, and when `HOST=ghes` with no host available resolve to
`skipped — tracker-unconfigured` — a missing host is a **local-presence** fact, so this stays inside
AC4's no-network rule. Deferring to `:51`'s "caller's responsibility" was proportionate when the
consequence was a failed read; it is not when the consequence is an irreversible cross-organization
publish.

**How this value crosses tool-call boundaries — state it, do not let it be inferred.** Each Bash tool
call is a fresh shell, so `REPO_SLUG` and `CREATED_PR_URL` are **model-held values re-interpolated as
literals into each new call**, never referenced as `$VAR` across calls. This must be said explicitly:
5d's `$BODY_FILE` gets a whole paragraph *because* it does not survive, and a reader who copies that
notation for `REPO_SLUG` without the same warning builds a seam that silently loses the value.

Also state the host set explicitly where the routing table reads it: `ghes` is a fifth `HOST` value
and is the one host where the numeric route targets a non-github.com tracker (`:51`).

Test scenarios:
- In a fork workflow, the slug names the **upstream** PR target, not `origin` (Covers AC2, AC20)
- With no resolvable PR target repo, the run reports `skipped — no-ticket-ref` and writes nothing (Covers AC3, AC20)
- On `HOST=ghes` with `GH_HOST` set, the `-R` value carries the host prefix (Covers AC20)
- On `HOST=ghes` with no host available, the run reports `skipped — tracker-unconfigured` and writes nothing (Covers AC4, AC20)
- On a GitLab remote, the GitHub tracker route is unreachable (Covers AC2, AC4)

Verify: `grep -q 'REPO_SLUG' skills/ba-propose/SKILL.md && grep -q 'GH_HOST/' skills/ba-propose/SKILL.md && grep -q 're-interpolated' skills/ba-propose/SKILL.md` — the slug exists, the `ghes` fully-qualified form is spelled, and the cross-tool-call rule is stated, as one conjunction. All three clauses fail today. The producer is no longer asserted inside Step 0a: the slug now comes from the resolved PR target, so pinning it to a section would encode the wrong source.

#### U3 — Make Step 2b two-tracker, and give it a `resolution`

Four changes, all inside `:195-226`, plus the heading (which currently reads "Linear issue context").

1. **`--issue` binds either tracker.** Redocument `:24` and the ID-resolution list: `--issue` accepts
   a `TO-1234` shape, a `#123` shape, or a bare number. The **branch-name regex stays
   `[A-Z]{2,5}-[0-9]+`, unchanged** — no numeric extraction is added. `feature/123-add-thing`,
   `fix/500-error`, `release/2024-01` and `bru/1234-x` all over-match any plausible numeric branch
   pattern, and after this change a mis-guessed ref is an un-retractable comment on an unrelated
   issue reported as `ticket: posted`. A numeric ref is therefore accepted **only** from an explicit
   `--issue`.

   **The same argument applies to the uppercase regex — which this plan initially failed to apply it
   to.** That regex is the system's *only* guessing ref source, it feeds the Linear route, and the
   Linear route has no confirmation requirement, so it is the guess with the least protection. It
   matches real branch names: `fix/UTF-8-encoding` → `UTF-8`, `bru/ISO-8601-dates` → `ISO-8601`,
   `feat/RFC-7231-compliance` → `RFC-7231`, `spike/GH-1234-repro` → `GH-1234`,
   `chore/AES-256-rotate` → `AES-256`. Today a mis-guess costs a failed read, which is why the regex
   has been harmless; after this change it costs a write.

   **Rule — provenance decides whether an unconfirmed Linear ref may be written.** A ref from an
   explicit `--issue` is a human assertion and may write on `resolution: ref-only`. A ref
   **extracted from a branch name** requires `resolution == linked` before any write; unconfirmed, it
   resolves to `skipped — no-ticket-ref`. The regex itself stays unchanged — narrowing it would
   silently drop real Linear keys, and provenance is the honest discriminator, not spelling. This is
   an orchestrator/seam rule: no composition row reads `.resolution`, so AC8 is untouched.
2. **`IssueContext` gains `resolution ∈ {linked, ref-only}`.** `linked` means the tracker read
   succeeded. `ref-only` means a ref was extracted but the read failed, leaving `summary` and
   `body_text` empty. "No ref at all" stays `issue_context = None` — the three states are distinct,
   and collapsing any two of them reproduces the `proof: pending` defect documented in
   `docs/solutions/prompt-authoring/2026-08-02-path-heuristics-misread-prompt-repo-filenames.md`
   ("absent evidence is not negative evidence").
3. **The failure branch returns a populated context.** Today `:222` discards the ref; without this,
   `ref-only` is unreachable and the branch is dead. **Specify what `ref` holds on that branch**: the
   read that would normalize it did not run, so `ref` carries the extracted-or-passed string exactly
   as obtained, with no normalization claimed. This matters only for the Linear route — the GitHub
   route refuses to write unconfirmed — and it is the Linear write target, so leaving it unstated
   would make `--issue to-1234` on a failed read write to an unspecified value. `resolution` supersedes `mcp_unavailable`, which
   is **retired**: its user-facing string names Linear on a run whose read was `gh issue view`, so it
   has to change regardless, and keeping two representations of one fact invites drift. State
   explicitly that the **orchestrator** may read `.resolution` — the ban in AC8 is on composition
   only. Without that sentence a reader over-applies AC8 and keeps the duplicate flag.
4. **Add the GitHub read.** `gh issue view <N> -R "$REPO_SLUG" --json title,body,state` guarded on
   `HOST ∈ {github, ghes}`, following Step 0b's existing `gh pr view --json ... -q ...` shape. This
   makes `resolution: linked` reachable on the GitHub branch and composition rows 3 and 8 real for
   GitHub-tracker users. It also earns a safety check the Linear route does not need: **GitHub numbers
   issues and PRs in one sequence**, and `gh issue comment <PR-number>` succeeds because PRs are
   issues to that endpoint. The read confirms the target is an issue, not a PR, before any write.

   **And the confirmation is required, not merely available.** The check only runs when the read
   succeeds, so on `resolution: ref-only` — the state item 3 exists to create — it never ran. On the
   GitHub route an unconfirmed target therefore resolves to `skipped — no-ticket-ref` under AC3's
   third case, and **no write is attempted**: a ref we cannot establish names an issue is not a
   usable ticket ref. Without this rule, the one path this change newly makes writable is the one
   path with no PR-vs-issue guard. The Linear route has no equivalent hazard — a `TO-1234` key cannot
   be a pull request — so `ref-only` there still writes, and that asymmetry is stated where the rule
   is.

Test scenarios:
- `--issue TO-1234` on a GitLab-hosted repo yields `resolution: linked` via the Linear read (Covers AC7)
- `--issue '#123'` and `--issue 123` on a GitHub host both yield the same normalized target (Covers AC2)
- A branch named `fix/500-error` with no `--issue` yields `issue_context = None`, not a numeric ref (Covers AC3)
- A Linear read that times out yields `resolution: ref-only` with the ref intact and `summary` empty (Covers AC7)
- A `--issue` naming a PR number resolves as unroutable rather than commenting on a PR (Covers AC3)

Verify: `grep -q 'ref-only' skills/ba-propose/SKILL.md && grep -q 'gh issue view' skills/ba-propose/SKILL.md && ! grep -q 'mcp_unavailable' skills/ba-propose/SKILL.md` — the new state, its GitHub producer, and the retirement of the flag it replaces, as one conjunction.

#### U4 — Re-gate the three composition rows and the preview

The `None` → populated change silently re-gates every row that reads `issue_context`. This is a
regression **this change causes**, so it cannot be left to the row-7 defect scoped out above.

- **Row 3 (Motivation, `:445`)** gates on the context being *present*, so a `ref-only` context takes
  the "lead with `issue_context.summary`" branch and leads with **nothing** — the
  `else derive from diff.commit_log` fallback is no longer reached. Re-gate on `.summary` being
  non-empty.
- **Row 8 (Bug summaries, `:449`)** gates on `.body_text` "present", newly ambiguous for a field that
  exists but is empty. Re-gate on non-empty.
- **Row 7 (Cross-refs, `:448`)** gates on `.ref`, which a `ref-only` context now satisfies — so
  `Fixes <ref>` starts appearing at medium/large tier for a ref whose read failed. Gating it on
  `resolution == linked` would violate AC8. **Decision: accept the widening**, recorded here. The
  ref came from an explicit `--issue` or a branch name the author chose; a transient read failure
  makes `Fixes <ref>` correct, and a genuinely bogus ref makes it inert. This is escalated at the
  pre-write gate rather than resolved silently, because it changes a public PR body.
- **Step 4's preview** (`:542`) hardcodes "Linear MCP unavailable". Derive it from
  `resolution == ref-only` with tracker-neutral wording.
- **Add one preview line** — `Ticket: <resolved ref> → <tracker>` (or `none`). Step 4 is the only
  pre-write moment a human sees, and the block already prefixes warnings for MCP, stack-base and
  size, so this makes a mis-route visible before an irreversible write at zero gating cost. It does
  not touch the locked "no new gate" decision: a printed line is not a confirmation.

  **And it renders the payload, not just the target.** Naming the ref tells you *where* the comment
  goes; it does not tell you *what it says*. At typo tier the trailer texts appear nowhere in the PR
  body, so the comment is the only place that prose is published — making it the single artifact with
  the widest reach and the only published output that would skip Step 4 entirely. Every other thing
  `/ba-propose` publishes goes through this preview. So the line renders the sanitized trailer texts
  too (AC19).

  **This is an addition no origin requirement asked for.** It was escalated at the pre-write gate
  rather than decided inside this artifact, and **kept** — minting AC19. Extending it to the payload
  is a second, related widening, recorded here for the same reason. Both stay inside the locked "no
  new gate" decision on the plan's own reading: a printed line is not a confirmation.

Test scenarios:
- A `ref-only` context renders Motivation from `diff.commit_log`, exactly as `main` does (Covers AC8, AC10)
- A `ref-only` context renders no Bug summaries section (Covers AC8, AC10)
- The preview names the resolved ref and tracker before the confirm, on both tracker routes (Covers AC19)
- The preview reads `none` when no usable ref resolved (Covers AC19)
- No composition row names `.resolution` (Covers AC8)

Verify: `awk -F'|' '/^\| 3 \|/{print $6}' skills/ba-propose/SKILL.md | grep -q 'non-empty' && awk -F'|' '/^\| 8 \|/{print $5}' skills/ba-propose/SKILL.md | grep -q 'non-empty' && [ "$(awk '/#### 3.2 Section registry/,/#### 3.2a/' skills/ba-propose/SKILL.md | grep -c 'resolution')" -eq 0 ]` — rows 3 and 8 asserted **individually**, each on the cell that actually holds its gate, plus the guard that composition still cannot see `.resolution`.

Three things this shape gets right that a looser one does not. Row 3's gate is in its **body-rule** cell (`$6`), not its required-input cell: its required input is legitimately `—` because Motivation always renders and *falls back* to `diff.commit_log`, so asserting on `$5` would push an implementer to make the section droppable — a different and wrong behavior. Row 8's gate **is** its required input (`$5`). And a range-based count over rows 3–8 would go green if the implementer re-gated row 7, which AC10 says must stay gated on `.ref`. The third clause is already true today, so it is a guard, not a progress signal.

#### U5 — Specify `record-ship`

A new top-level `## Ship-Time Ticket Write-Back` section after 5f, before `## Failure Modes`,
imitating the shape of `## Stack-Base Resolution Convention` in `skills/ba-execute/SKILL.md:175-366`:
an ownership paragraph naming its single caller, a `**Interface**` line with the signature, `ship` /
`opts` / `record` as bullets with per-field contracts, then bolded-label rules, a decision table of
**observable conditions**, an `**Invariants.**` paragraph, and a literal block only under a
`**Code-shape decision:**` label.

**Signature.** `record-ship(ship, opts) → record`, per the locked design. `ship` is
`{url, repo_slug, host, trailers}`; `host` is an explicit parameter and is never derived from the PR
URL. `opts` is `{issue_context}` — see the next paragraph for why the locked `ref_override` field is
dropped.

**`opts` is `{issue_context}` — `ref_override` is dropped.** The brainstorm's Locked Design listed
`ref_override` (the `--issue` argument verbatim), and this plan initially kept it by assigning it the
job of supplying the spelling the router matches on. That job is not real: the routing table's Linear
row is case-insensitive and its GitHub row accepts both `#123` and `123`, so no input exists where
routing on the verbatim value picks a different tracker than routing on `issue_context.ref`. The only
divergence is ever in the *write target*, which is `issue_context.ref` in every case.

A field that cannot change any decision is a dead condition — the exact class the prompt-authoring
checklist flags as "reads as specified behavior; is dead." **This narrows the locked signature by one
field**, which is why it was escalated rather than resolved silently. Step 2b remains the sole
minting site for every tracker's handle, so nothing else moves.

**Routing table** (matched against the verbatim form when present):

| Ref shape | Route | Reachable when |
|---|---|---|
| `[A-Z]{2,5}-[0-9]+`, case-insensitive | Linear, `save_comment` | always |
| `#<digits>` or bare `<digits>` | GitHub issue, `gh issue comment` | `HOST ∈ {github, ghes}` |
| anything else, `org/repo#N` included | unroutable | — |

An unroutable shape is `skipped — no-ticket-ref`, whose definition is therefore **"no *usable*
ticket ref"** — covering both no ref and a ref that routes nowhere. Stated explicitly, or an
implementer picks arbitrarily and the receipt lies. A numeric ref on a GitLab host is
`skipped — tracker-unconfigured`: `#123` there means a *GitLab* issue, and `glab issue note` is a
third tracker the scope excludes.

**Disposition table — evaluated in order, first match wins.** The ordering is load-bearing: the URL
check runs first, mirroring 5e's existing precedence, and the pre-check runs before any write so
`tracker-unconfigured` and `tracker-rejected` can never collide.

| Observable condition | `disposition` | `target` |
|---|---|---|
| `ship.url` empty or not a URL | `skipped — ship-url-unresolved` | null |
| No usable ticket ref | `skipped — no-ticket-ref` | null |
| Linear route; no Linear comment-write MCP tool in the session | `skipped — tracker-unconfigured` | null |
| GitHub route; `HOST ∉ {github, ghes}` or no `gh` on `PATH` | `skipped — tracker-unconfigured` | null |
| GitHub route; target not confirmed to be an issue | `skipped — no-ticket-ref` | null |
| Pre-check passed; write **confirmed** | `posted` | the resolved ref |
| Pre-check passed; rejected, timed out, or outcome unknown | `failed — tracker-rejected` | null |
| Any internal throw | `unavailable` | null |

**`unavailable` is a defensive catch-all with no expected production path — say so.** Every named
failure above resolves to its own literal *before* a throw can occur: the pre-check is local and
cannot fail, an auth rejection is `tracker-rejected`, an expiry is `tracker-rejected`. What is left
is genuinely unexpected — a `mktemp` failure, a malformed MCP schema, a bug in the sanitization pass.
The plan states this explicitly rather than leaving a reader to hunt for a trigger, applying the same
honesty the `capture:` enum's residuals already get. Without that sentence the literal reads as
specified behavior with an undiscoverable cause — and this plan already caught one dead literal
(`skipped — ship-url-unresolved`) by asking exactly this question.

**Auth failure must be routed mechanically, not by intent.** "An auth failure is `tracker-rejected`"
is not implementable if an expired token surfaces to the model as a thrown exception — it would fall
into the generic catch-all and print `unavailable`, missing AC4 and AC5. So the rule is: a throw
whose diagnostic names authentication, permission, or credentials resolves to
`failed — tracker-rejected`; `unavailable` is reached **only** by a throw that does not. Classify on
the throw, not on intent.

**"Confirmed" is the one predicate that must not be left to re-derivation.** `posted` is a claim about
an irreversible external effect, so define its observable per route rather than leaving the word to
carry it: the call exits zero **and** the response carries a comment id or URL → `posted`. Anything
else — a non-zero exit, a zero exit with no parseable id, a timeout after the request was sent —
is `failed — tracker-rejected`. This under-reports on an ambiguous success and never lies, which is
the correct direction for an append-only write: a spurious `failed` costs a manual check, a spurious
`posted` costs a silently lost record.

**The pre-check observes local presence only, and makes no network call.** For Linear, whether a
Linear comment-write MCP tool is in the session's own tool list — a capability, not the literal
`mcp__claude_ai_Linear__save_comment`, since that prefix is one user's server naming. **Name the
operation shape, not just "a write tool":** creating a *comment* on an *issue* — explicitly **not** an
issue-description update (the same server exposes one, and it is the design the brainstorm rejected),
not a diff/inline comment, and not a comment deletion. A prose capability predicate is matched by a
model, so the predicate must exclude the neighbours it would otherwise accept. For GitHub,
`HOST ∈ {github, ghes}` and `gh` on `PATH`. The shipped prose says
"Do not use `gh auth status` — its exit code conflates not-logged-in with network-down"; the fact
that `:52-54` rejected the host-probe ladder on exactly that ground is the *plan's* reason for the
rule and does **not** ship into the skill, per the prompt-authoring checklist's authoring-residue
rule. An **auth** failure is `tracker-rejected`, not `unconfigured` — say so where the literal is
defined, because a reader will read "unconfigured" as "go set up your token" when it means "no writer
at all".

**Bounded wait, and never interactive.** 5e's "There is no timeout — accepted, since the assessment
reads only already-materialized state" (`:823`) and "the `try` guards a *thrown* exception, not a hung
one" (`:821`) both stop being true the moment network I/O lands between lines 3 and 4. State a bounded
wait whose expiry maps to `failed — tracker-rejected` — the honest literal, since the outcome is
unknown and `posted` must never be printed on an unknown outcome. Every CLI invocation in the seam is
non-interactive: `gh issue comment` prompts for the body when no body flag is given, and `--body-file`
rather than `-b` is required by the existing discipline at `:917` ("Never `--body "$(cat ...)"`, never
stdin, never pipes").

**Name the bound's mechanism per route, because asserting a bound is not making one.** The `gh` route
is wrapped in `timeout <N>` (present on this platform; a missing `timeout` binary degrades to
unbounded and is itself a local-presence fact the pre-check can see). The **MCP route exposes no
timeout knob at all**, so its bound is explicitly **best-effort** — state that rather than let the
invariant read as stronger than it is. A contract with no mechanism on one of its two routes is where
the hang that `:821`/`:823` correctly flags would survive.

**The temp file obeys the single-call invariant.** The `mktemp`, the quoted-sentinel heredoc write and
the `gh issue comment -F` run in **one** Bash tool call, citing `skills/ba-propose/SKILL.md:677` by
name rather than restating its reasoning. Each call is a fresh shell, so `$BODY_FILE` does not
survive, and recovering a temp path by `find`/`ls` over `$TMPDIR` is recorded there as "a confirmed,
repeated production incident" — it can pick up another session's file and post the wrong content.
5d's own body file is never reused: the seam writes a fresh one under a **distinct** sentinel token.

**Never retry.** Mirror 5d's existing wording — "Do not retry automatically". This is a prose spec
executed by a model, and a write that appears to fail is exactly where a model helpfully tries again;
append-only makes a double-post permanent. At-most-once rests on 5d creating one PR *plus* this rule.

**Comment body, and the sanitization contract.** The body is the PR URL plus, when `trailers` is
non-empty, the trailer texts as a list. Empty trailers still post, with the PR URL as the payload.
The body is **not** `ComposedBody.body`; Step 3's purity and seam invariants do not apply to it.

**The trust boundary, stated once.** Step 2f reads **every** commit body in the `DIFF_BASE..HEAD`
window regardless of author — a shared branch, a rebased-in colleague's commits, a cherry-pick, or a
bot commit all contribute trailers. So this is not the author's own prose being tidied; it is
**untrusted input being rendered into a comment posted under the shipper's identity**. That is the
difference between typo hygiene and sanitization, and it is why the rules below are a
machine-boundary contract specified to the character rather than steering.

**Escape first, then wrap — the ordering is load-bearing.** A wrap-only contract is defeated by a
single unbalanced backtick in the trailer text: `renamed \`foo, see #42` wraps to an odd backtick
count, markdown pairs code-span runs left-to-right, the span closes early and `#42` autolinks live.
The same escape defangs the mention and closing-keyword rules. So:

- **Step 1 — neutralize the escape hatch.** Escape backticks and backslashes in the interpolated
  text **before** any wrap rule runs. A wrap applied to text that can still open or close a code span
  is not a contract.
- **Step 2 — then apply the three token rules**, each to the interpolated text only:
  - `#` immediately followed by a digit → wrap in backticks. A bare `#42` autolinks and
    cross-references an unrelated issue; the file already carries this rule for the PR body at `:448`.
  - `@` immediately followed by an alphanumeric → wrap in backticks. Linear's comment API resolves
    `@displayName` to a real mention, and GitHub notifies.
  - A closing keyword (`close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved`) immediately
    followed by a ref-shaped token → wrap **the ref**, breaking the keyword-ref pair on both
    trackers. A trailer reading "fixes TO-999" must not move another issue's state.
- **Step 3 — extend rule 1 to ref-*shaped* tokens generally, not the `#N` spelling.** A bare
  `TO-999`, an `org/repo#N`, or a full issue URL stays inert under the rules above but still
  autolinks and creates a **backlink on the target issue**. Cross-referencing an unrelated ticket is
  a real effect, so ref-shaped tokens and issue URLs are wrapped too.
- **Step 4 — markdown links and raw HTML.** `[looks official](https://…)` and GitHub's allowed raw-HTML
  subset survive every rule above and render normally under the shipper's identity. Neutralize `[`,
  `]` and `<` in the interpolated text as part of Step 1.
- **Never emit interpolated text at line-start unprefixed.** Every trailer renders as a `- ` list
  item. This also forecloses a heredoc-terminator collision: a trailer whose text is exactly the
  sentinel cannot end the heredoc early if it can never begin a line. Today the bullet prefix
  achieves this incidentally; stating it makes it structural rather than accidental.

At typo tier the trailer text appears **nowhere** in the PR body but does reach the ticket, so the
comment is the first place that prose is published — possibly to a wider audience than the repo's.
That is a consequence of AC6, not a defect, and it is why the sanitization rules are not optional.

**Invariants.** Never raises — any internal throw resolves to `unavailable`. Never alters exit status,
which 5c/5d fix before 5e runs. Called exactly once per run, only on routes that reach 5e. Degrade is
decided by the pre-check before any write. `record.target` is non-null **exactly when**
`disposition == posted`. `record.receipt_line` is pre-rendered and printed verbatim, and **carries the
two-space indent** lines 2-4 already use, so the caller does no formatting. On the composition /
`.resolution` boundary this section is a **pointer, not a copy** — it defers to the rule stated once
at the Step 2b normalizer (U3), borrowing the canonical-site vocabulary `:735-742` already uses. Two
unpinned copies of one rule in one file is the defensive duplication the prompt-authoring checklist
flags.

**Receipt line 4 renders the basis, not just the verdict** — `ticket: posted — TO-1234`,
`ticket: posted — org/repo#123`, and the bare literal on every non-`posted` value. This is the
standing rule the brainstorm invoked when rejecting Design C's four opaque literals, and it is what
makes `record.target` observable rather than dead state carried and never read.

Test scenarios:
- A trailer containing `#42`, `@someone` and `fixes TO-9` renders all three inert on both trackers (Covers AC14)
- Empty trailers still post a comment whose payload is the PR URL (Covers AC1)
- A Linear route with no comment-write tool attempts no write and reports `tracker-unconfigured` (Covers AC4)
- An expired Linear token reports `tracker-rejected`, not `tracker-unconfigured` (Covers AC4, AC5)
- A write whose response is unparseable reports `tracker-rejected`, never `posted` (Covers AC5)
- A first write that fails is not followed by a second attempt (Covers AC15)
- A numeric ref on a GitLab host reports `tracker-unconfigured` and writes nothing (Covers AC4)
- A trailer containing an **unbalanced** backtick still renders `#42` inert (Covers AC14)
- A trailer containing `[text](url)`, raw HTML, a bare `TO-999` and an issue URL renders all inert (Covers AC14)
- A trailer whose entire text equals the heredoc sentinel cannot terminate the heredoc (Covers AC14)
- An unexpected internal throw reports `unavailable`; an auth-named throw reports `tracker-rejected` (Covers AC21)
- A Linear-shaped ref extracted from a branch name is not written unless the read confirmed it (Covers AC20)

Verify: `[ "$(awk '/^## Ship-Time Ticket Write-Back/,/^## Failure Modes/' skills/ba-propose/SKILL.md | grep -o -e 'skipped — no-ticket-ref' -e 'skipped — tracker-unconfigured' -e 'skipped — ship-url-unresolved' -e 'failed — tracker-rejected' -e 'unavailable' -e 'posted' | sort -u | wc -l | tr -d ' ')" -eq 6 ]` — `grep -o | sort -u` counts **distinct** literals present inside the owning section, so all six must be there and a literal living only in a mirror fails. Two weaker forms were rejected: `grep -c` with multiple `-e` counts *lines*, so six lines all naming `posted` would pass and the 7-row disposition table alone clears the threshold; and a `for` loop using `exit 1` is not composable — the `exit` kills the surrounding command substitution rather than the test.

#### U6 — Wire 5e, and move every line-count claim with it

The call site is two lines and zero branches, placed **after** `capture:` prints so the network
round-trip delays only line 4 — preserving 5e's existing guarantee that a slow step "delays only the
`capture:` line, never the URL".

The unresolved-URL guard's `return` at `:769` **falls through to the call instead of returning**, so
`skipped — ship-url-unresolved` is reachable and the guard's receipt is three lines. Amend `:722`'s
"one contiguous block" to "four lines in fixed order": a tool call between lines 3 and 4 can
interleave rendering, which the brainstorm's Trade-offs accepted when it placed the stall there.

Five sites claim a line count or a line number and must move together — `:572` ("three lines, or
two"), `:723` ("line 3 the capture disposition"), `:746-749` ("line 2 of a two-line receipt", "the one
legitimate sub-three-line receipt"), `:791` ("Line 3 states a decision"), and `README.md:211`
("line 3, or line 2 when the ship URL is unresolved"). The bare `✓` line stays the sole partial-print
signature.

The new enum gets its own canonical-site paragraph naming its own mirror sites, mirroring `:735-742`.
And 5e now holds **two** closed enums of exactly six literals, so two kinds of reference become
ambiguous at once: `:30`'s pointer to "the closed six-value enum" (a **cardinal**) and `:735`'s
"**This section is the canonical site for the enum**" (a **definite article**, sitting immediately
beside the new paragraph). Both must name which enum — `:735` becomes "the canonical site for the
**capture** enum". That makes six line-and-reference sites in this file, not five.
This is the co-reference hazard documented in
`docs/solutions/prompt-authoring/2026-08-11-absence-grep-proves-spelling-not-concept-removed.md`,
where a retired token survived at two sites that named it by cardinal rather than by spelling.

If any heredoc is shown in the seam's code block, it takes a **distinct** token
(`__BA_PROPOSE_TICKET_END__`), inside its own fence, with exactly one bare terminator line — the
`sentinels` check asserts one terminator per opener per fence and is the one realistic new-FAIL risk
in this change.

Test scenarios:
- A normal create ship prints four lines in order, the fourth naming the ticket disposition (Covers AC9)
- An unresolved-URL ship prints three lines, the third naming `skipped — ship-url-unresolved` (Covers AC9)
- A genuine partial print still emits the `✓` line alone (Covers AC9)
- 5f still dispatches on the capture disposition, unaffected by line 4 (Covers AC9)
- No prose in the file names an enum size without saying which enum (Covers AC12)

Verify: `awk '/capture: \{decision\}/{c=NR} /record-ship\(/{if(c&&NR>c&&!t) t=NR} /Document this learning/{if(t&&NR>t) ok=1} END{exit ok?0:1}' skills/ba-propose/SKILL.md` — asserts the ordering `capture:` print → the `record-ship` call → 5f's offer, extending rather than replacing the ordering assertion the 5f-receipt ship already shipped. **The exit status is set by a flag read in `END`, never by an `exit 0` inside a rule**: `exit` in a rule jumps to `END`, so an `END{exit 1}` overrides it and the check can never pass. The first draft of this line had exactly that shape and was caught at execution time — "fails pre-change" is satisfied vacuously by a check that always fails, so a **positive** control is required too, and both are recorded in the A/B research doc. The middle needle is the **call**, not the literal `ticket:`: the call site renders `record.receipt_line`, so `ticket:` need not appear there at all, and matching it would make the check depend on unrelated 5e prose happening to contain the word.

#### U7 — The in-file consumers of the new guarantee

- **Row 13 (`:454`)** names a non-existent "Linear rollup" as typo tier's only deviation safety net.
  Reword against the disposition set: the guarantee is now the commit trailer **and** the ticket
  comment when a usable ref resolved and a writer was reachable — conditionally true, and the
  condition stated. Drop "Linear", since the path is two-tracker.
- **`## Failure Modes` (`:897-908`)** gains rows for a tracker with no reachable writer, a rejected
  write, and a hung write, each naming where it surfaces (5e) and its recovery (the PR is live; post
  by hand). Its **existing** row at `:902` — "Linear MCP failure with ID present | Step 2b | Warn at
  preview; fall back to diff-derived motivation" — describes the `mcp_unavailable` warning U3 retires
  and covers no GitHub read at all; reword it as one read-side row over both trackers rather than
  leaving it stale beside three new write-side rows.
- **`## Important Guidelines`** gains the second outward effect at `:914`, alongside the
  `/ba-compound` hand-off exception. Its neighbour at `:919` — "Linear is optional. Failure ≠
  absence — warn at preview when MCP failed" — is two-thirds wrong after U3: the read path is no
  longer Linear-only and the warning derives from `resolution`, not from an MCP flag.

Test scenarios:
- Row 13's typo-tier sentence names no guarantee the file does not implement (Covers AC6, AC11)
- Each new failure mode names its surfacing step and a recovery (Covers AC5)

Verify: `awk -F'|' '/^\| 13 \|/{print $6}' skills/ba-propose/SKILL.md | grep -q 'ticket' && ! awk -F'|' '/^\| 13 \|/{print $6}' skills/ba-propose/SKILL.md | grep -q 'Linear rollup'` — the row names the real mechanism and no longer the phantom.

---

**Files**: `skills/ba-execute/SKILL.md`, `README.md`, `CLAUDE.md`

#### U8 — The cross-file mirrors, all in one pass

Three obligations, none CI-pinned, all walked by hand together. Per
`docs/solutions/prompt-authoring/2026-08-09-per-dispatch-block-ci-catches-template-drift.md`, the
surface without an observable is the one that stays broken, and a documented residual gap does not
self-close.

1. **The six #91 lines.** `skills/ba-propose/SKILL.md:454` (U7), `skills/ba-execute/SKILL.md:535`,
   `:537`, `:559`, `README.md:157`, `README.md:203`. Note that `:537` and `:559` are *reminder
   strings* — "Run `/ba-propose` to persist N deviation(s) to the MR/ticket; they are not durable
   until then" — which stay false on every non-create route, since only `commit_push_create` reaches
   5e. Their rewording must carry that condition, not just drop the word "Linear".
2. **The three sync-declared "beyond the staged diff" sites**: `CLAUDE.md:104`,
   `skills/ba-propose/SKILL.md:914` (U7), `README.md:211`. Each admits exactly one exception today,
   scoped to `docs/solutions/`; each gains the second outward effect.
3. **`README.md`'s `/ba-propose` feature list** gains a bullet for the write-back and a restatement of
   the new enum, and `:211`'s receipt line-count claim moves with U6's other sites. `README.md:205` —
   "Linear MCP optional with diff-derived fallback; clear preview warning when MCP is unavailable" —
   is the user-facing statement of exactly the flag U3 retires, and is in the same feature list; it
   moves in this pass rather than being left as the one surface with no observable.

**Add one CI needle so a retired claim cannot come back.** This unit's own history is the argument:
the documented one-pass mirror walk under-counted by four sites during this planning round, caught by
a review gate rather than by the walk itself. That is not a self-correcting method at ~10 unpinned
sites. `scripts/check-invariants.mjs`'s existing `retired-invocations` check already takes a needle
list and already scans `skills/`, `README.md` and `CLAUDE.md` — add `Linear rollup` to it (plus the
matching `selfcheck-invariants.mjs` entry, per the repo's check+selfcheck pattern). This does **not**
pin the new enum, which the brainstorm scoped out; it pins the *retired false claim*, so a future
edit that reintroduces it fails the build instead of depending on another review pass catching it.
**This is new CI surface the brainstorm did not ask for**, which is why it was escalated.

Two adjacent lines are **accurate today and need no rewording** — `skills/ba-execute/SKILL.md:598`
and `README.md:266` claim body-rollup only — but they sit beside lines that do, so a hand-walk will
encounter them. `CLAUDE.md:96`'s grid row says "deviation rollup" meaning the 2f gather; a reviewer
may misread it as a seventh site.

Neither retired needle may appear in any new prose — `retired-invocations` forbids **both** `/ba:`
and `commands/ba/`, and scans `README.md` and `CLAUDE.md` alongside `skills/`.

Test scenarios:
- No line in the repo claims a Linear rollup that does not happen (Covers AC11)
- The two reminder strings state the create-only condition (Covers AC11)
- All three "beyond the staged diff" sites name two outward effects (Covers AC13)

Verify: `! grep -rq 'Linear rollup\|Linear ticket when linked\|and Linear ticket' skills/ README.md CLAUDE.md && grep -q 'origin ticket' CLAUDE.md && grep -q 'origin ticket' README.md && grep -q 'origin ticket' skills/ba-propose/SKILL.md && [ "$(grep -c 'not durable until then' skills/ba-execute/SKILL.md)" -eq 0 ]`

Four clauses, because three of the six #91 lines are invisible to the obvious check. The absence
needles reach only `README.md:157`, `:203` and `skills/ba-propose/SKILL.md:454`;
`skills/ba-execute/SKILL.md:537` and `:559` say "persist … to the **MR/ticket**", which matches no
"Linear" needle at all — both could ship unreworded on an absence-only check. The final clause pins
them by the phrase whose *promise* is the defect ("not durable until then" is false on every
non-create route), and `grep -c` confirms it currently returns **2**, so the clause fails before the
change. `origin ticket` appears zero times in all three mirror files today, so those clauses fail
too; an absence grep alone would pass on a file that deleted a claim and added nothing.

---

#### U9 — Observe `posted` and `failed` before shipping

The brainstorm concedes the fixture A/B "reaches only the two `skipped` values, never `posted` or
`failed`", so AC1, AC2 and AC5 are unverifiable by AC16 alone. A prompt change also cannot be
dry-run in the session that wrote it (`.claude/agent_docs/prompt-authoring.md:75`).

In a fresh session via `claude --plugin-dir <repo>`, on a scratch branch of this repo, ship a trivial
diff twice against a **freshly created scratch GitHub issue in this repo** — once to observe `posted`,
once with the writer made unreachable to observe the pre-check's `tracker-unconfigured`. Per
`docs/solutions/prompt-authoring/2026-07-31-probe-instrument-validation-false-zeros.md`, the write
side effect makes runs non-independent: use a **new** scratch issue per run, never a shared target,
and before trusting a zero, prove the instrument can produce a non-zero.

Never post to a third-party ticket to test this.

**Record what the run showed, or AC17 is unfalsifiable after the fact.** A `U9` token in a commit
subject proves a commit happened, not that `posted` and `tracker-unconfigured` were observed, nor
against which issue. Append the observed receipt lines and the scratch-issue URLs to U1's research
doc — the same file, since both are evidence for the same change. Without that, the one unit covering
the two dispositions no other instrument can reach leaves nothing a later reader can check.

Test scenarios:
- `ticket: posted — <owner>/<repo>#N` appears on the receipt and the comment exists on the issue (Covers AC17)
- The observed receipt lines and scratch-issue URLs are recorded in the research doc (Covers AC17)
- The comment carries the PR URL and the deviation text, with hazardous tokens inert (Covers AC14, AC17)
- With the writer unreachable, no write is attempted and the pre-check reports it (Covers AC4, AC17)
- The scratch issue for run 2 is distinct from run 1's (Covers AC17)

Verify: `grep -q 'ticket: posted' docs/research/2026-08-25-ship-time-write-back-ab-research.md` — the observed `posted` receipt line is recorded. Recording the evidence is what turns this from a commit-tag-only unit into a checkable one; the live run itself remains manual, but its result is no longer only in someone's memory.

**File**: `.claude-plugin/plugin.json`

#### U10 — One version bump

`0.47.0` → `0.48.0`. HEAD (`2efeee6`) already spent its bump on the previous ship. One bump for the
whole ship however many commits it spans; a mid-branch local `version-bump` FAIL is expected output,
not a reason to add a second (`.claude/agent_docs/prompt-authoring.md:144-164`).

The brainstorm and this plan ship in the same commit as the implementation.

Test scenarios:
- The PR's cumulative diff carries exactly one bump (Covers AC18)

Verify: `grep -q '"version": "0.48.0"' .claude-plugin/plugin.json`

## Dependencies & Risks

- **The A/B could come back inconclusive** (U1). The pre-committed rule sends it back to a decision
  round rather than shipping on a tie, per `CLAUDE.md`'s prompt-change convention.
- **`posted` is only ever observed manually** (U9). No automated path reaches it, and none is added —
  the seam has no injectable port by deliberate design (brainstorm Trade-offs).
- **AC12 is a hand-audit obligation, not a verified criterion.** Nothing can check "every prose
  cardinal says which enum". It is named rather than deleted so the gap is visible, but it must not be
  read as tested — that would be the exact failure U8 quotes ("the surface without an observable is
  the one that stays broken").
- **The declined injectable port is a known trade, revisited and kept.** `deep-module-reviewer`
  argued a tracker-neutral optional `write_port` would keep the call site at two lines while letting
  the fixture A/B reach `posted` and `failed` — and that the locked rationale ("every injectable is a
  hole through which Linear or `gh` vocabulary leaks into 5e") conflates a vocabulary leak with a
  capability seam. That is a fair challenge, but an adapter port is an element of rejected Design C
  and the brainstorm's lock forbids re-adding it. It stays out; U9 carries the cost. **If the
  testability cost proves worse than expected, this is a brainstorm-lock question, not a plan edit.**
- **Two residuals in the same class as the session-death gap.** An ambiguous-success `failed` is
  indistinguishable from a genuine failure on the receipt, so a human who posts by hand can duplicate
  the comment — the no-retry rule binds the seam, not the person. And `tracker-unconfigured` covers
  three situations a maintainer would want distinguished, of which "this route does not exist for your
  host" is the most surprising: a GitLab user with `gh` fully configured still reads "unconfigured".
- **The new enum is unpinned** and inherits #87. A rename or an added literal will report green while
  a stale mention survives elsewhere; the co-reference hazard is worse here than for `capture:`,
  because both enums now have exactly six literals.
- **The session that writes this cannot test it.** Every verification is either a fixture A/B over
  subagents or a fresh-session run.
- **Wrong-target writes are the irreversible failure mode**, and each mitigation covers a different
  path — none is a general guard. Numeric refs only from an explicit `--issue` (U3) removes the
  branch-name guess entirely. The issue-not-PR read (U3) covers only `resolution: linked`, since a
  failed read cannot confirm anything — which is exactly why U3 also refuses to write on an
  unconfirmed GitHub target rather than listing the read as protection it does not provide there. The
  Step 4 preview line (U4) is the only mitigation that covers *every* path, which is why it was kept
  at the gate. `ref-only` GitHub refs are additionally protected by refusal rather than by
  inspection, and Linear refs by the fact that a `TO-` key cannot name a pull request.

## Convention Compliance

`convention-checker` raised 13 findings across 5 of 10 categories; all 13 were resolved before this
artifact was written. Four scope conditions were escalated to a pre-write decision round.

- [x] STANDARD section set and frontmatter (`references/plan-sections.md`) — aligned
- [x] `Verify:` minting rules — **5 findings fixed.** U8's second conjunct could never fail (`-l`
      overrides `-c`) and its absence needles reached only 4 of the 6 #91 lines; U5's `grep -c` with
      multiple `-e` counted lines rather than distinct literals; U6's middle needle was `ticket:`
      where the call site renders `record.receipt_line`; U4's row range would have gone green on a
      re-gated row 7; U2's producer grep was unscoped. All nine lines now fail pre-change, verified
      by execution, and U5 additionally has a positive control.
- [x] Unit anchors — **2 fixed.** U1 was wrongly declared commit-tag-only despite writing a research
      doc; U9 sat under the wrong `**File**:` header.
- [x] `**Code-shape decision:**` label — aligned; neither table needs it, matching `:569-575`.
- [x] Prompt-authoring review checklist — **3 fixed.** Provenance clauses and a plan-scoped `AC6`
      reference were prescribed into shipped prose; the composition/`.resolution` rule was stated
      twice in one file; the `:677` single-call temp-file invariant was cited in Sources but acted on
      by no unit.
- [x] Machine boundary vs steering — **2 fixed.** "Is this deviation worth posting" was listed as
      steering with no branch behind it (deleted — the ticket comment is an archive and posts every
      trailer); the `posted`-vs-`failed` observable was left as the word "confirmed" and is now
      defined per route.
- [x] Mirror-site obligations — **4 missed sites added**: `:902` (stale read-side Failure Modes row),
      `:919` (Guidelines "Linear is optional"), `README.md:205` (user-facing statement of the retired
      flag), and `:735`'s definite article "the canonical site for the enum", which becomes ambiguous
      once 5e owns two six-literal enums. Six line-and-reference sites in the file, not five.
- [x] CI interaction — aligned; `retired-invocations` forbids **both** `/ba:` and `commands/ba/`.
- [x] Naming — aligned; the dropped "Convention" suffix and the after-5f placement are both now
      justified in Proposed Solution.
- [x] Scope discipline — **1 fixed.** U4's preview line was an unrequested addition given reasons but
      no escalation, inconsistent with the row-7 widening in the same unit. Escalated and kept as
      AC19. Retiring `mcp_unavailable` and the issue-not-PR check were judged caused-by-this-change,
      not adjacent improvement.

**Resolved at the pre-write gate**, all four as recommended:

- Three-line receipt on the unresolved-URL guard — keeps all six literals reachable; AC9 reworded
  from the brainstorm's "two".
- Row 7's `Fixes <ref>` widening on `ref-only` — accepted, AC8 left intact.
- Numeric refs from `--issue` only; branch-name extraction stays Linear-only.
- The Step 4 preview line kept, minting AC19.

## Plan Review Resolution

A judged section-scoring pass ran 6 of the 7 built-in reviewers (architecture set aside as overlapping
deep-module). 38 raw findings → 19 after dedup: 15 Must Address, 4 Consider, 0 suppressed
Must-Address. All 19 were applied. Two findings were independently corroborated by two reviewers each
and merged to confidence 100 (`unavailable`'s missing coverage; AC12's missing observable).

**The five security findings, all applied** — each was a path to writing somewhere the user did not name:

1. `REPO_SLUG` derived from `origin` is the **fork** in the very fork workflow U2 cited as its
   motivation; the write could land on the wrong repo as `posted`. Now derived from the resolved PR
   target.
2. On `ghes`, a bare `-R owner/repo` resolves against **github.com**, and `gh` needs no write
   permission to comment on a public issue — an internal slug could publish to a stranger's tracker.
   Now host-qualified, degrading to `tracker-unconfigured` when no host is available.
3. A single **unbalanced backtick** in trailer prose defeated all three sanitization rules at once
   (verified: the code span closes early and `#42` autolinks). Now escape-first with a stated ordering.
4. The **uppercase branch regex** is the system's only guessing ref source and feeds the one route with
   no confirmation requirement; it matches `UTF-8`, `ISO-8601`, `RFC-7231`, `GH-1234`, `AES-256`
   (verified). The plan had used exactly this argument to reject numeric extraction and failed to
   apply it here. Now gated on provenance.
5. The preview showed the target but never the **payload** — the artifact with the widest reach was the
   only published output skipping Step 4.

**Four spec decisions**, escalated rather than folded in, all resolved as recommended: `ref_override`
dropped from the locked signature; `Linear rollup` added to the existing `retired-invocations` needle
list; AC12 demoted to a named hand-audit residual; AC19 extended to the payload.

**One substantive gap the checker found in the plan's own reasoning**, now closed: the issue-not-PR
read only runs when the read *succeeds*, so on `resolution: ref-only` — the state U3 exists to create
— it never ran, and nothing conditioned the write on `linked`. The GitHub route now refuses to write
an unconfirmed target rather than listing a mitigation it does not provide there.

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-08-25-ship-time-ticket-write-back-brainstorm.md` — carried
  forward: exactly one ship-time write site inside Step 5e; append-only, one comment per ship, no
  read-before-write; no new gate; two trackers routed by ref shape; a `gh issue view` read so GitHub
  is first-class; fires at every size tier including typo; the disposition is an outcome so the write
  precedes the receipt line; #91 folds in; the spec lives inline rather than in `references/`.

### Internal references

- `skills/ba-execute/SKILL.md:175-366` — `## Stack-Base Resolution Convention`, the owned-operation
  shape `record-ship` imitates
- `skills/ba-propose/SKILL.md:720-823` — Step 5e, the call site and the receipt
- `skills/ba-propose/SKILL.md:195-226` — Step 2b, the read path
- `skills/ba-propose/SKILL.md:52-54` — the rejected host-probe ladder, the precedent for AC4's
  no-network pre-check
- `skills/ba-propose/SKILL.md:677` — the single-call heredoc invariant
- `.claude/agent_docs/prompt-authoring.md` — machine boundary vs steering, the review checklist, the
  fixture A/B method, the one-bump rule
- `docs/solutions/prompt-authoring/2026-08-11-absence-grep-proves-spelling-not-concept-removed.md` —
  cardinal co-reference, ordering assertions over absence greps, surgical vs wholesale
- `docs/solutions/prompt-authoring/2026-08-02-path-heuristics-misread-prompt-repo-filenames.md` —
  absent evidence is not negative evidence; render the basis, not just the verdict
- `docs/solutions/prompt-authoring/2026-07-31-probe-instrument-validation-false-zeros.md` — a
  behavior under test that writes makes runs non-independent
- `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md` — global
  `CLAUDE.md` contaminates subagent baselines
- `docs/solutions/prompt-authoring/2026-08-09-per-dispatch-block-ci-catches-template-drift.md` — the
  surface without an observable stays broken
- `docs/plans/2026-08-11-fix-ba-propose-5f-terminal-receipt-plan.md` — the A/B-first unit shape and
  the commit-tag-only pattern
