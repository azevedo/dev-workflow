---
date: 2026-08-25
topic: ship-time-ticket-write-back
status: approved
triage_level: full
tags: [ba-propose, tracker-write-back, linear, github-issues, receipt-enum, cluster-autonomy]
---

# Ship-Time Ticket Write-Back

## What We're Building

`/ba-propose` gains one new outward effect: after the PR/MR is open, it posts a single comment to
the origin ticket carrying the shipped PR URL and the `Deviation (U<n>):` trailers gathered in
Step 2f. Today the flow reads the origin ticket, legitimately drifts from it, and lands that drift
in `docs/` artifacts and a PR body — while the ticket stays as it was written, usually before
anyone looked at the codebase.

The gap is sharpest in a consuming repo that gitignores `docs/`. There the plan, the brainstorm,
the Step 4.6 reconciliation ledger and the review runs are all session-local, so the durable record
collapses to commits plus the PR body — and the ticket, which is what the team actually reads,
becomes permanently stale. This is the natural setup for anyone who does not want generated
planning artifacts in code review, not a niche configuration.

Two adjacent facts shaped the scope. First, the plumbing really is assembled: by Step 5d,
`issue_context`, `deviation_trailers`, the composed body and `CREATED_PR_URL` are all live in one
scope, so this is a new sub-step rather than new gathering. Second, three documents across six lines
already *claim* this feature exists (issue #91) — and `skills/ba-propose/SKILL.md:454` names the
non-existent Linear rollup as its own typo-tier safety net. Implementing write-back is what makes
those six lines true, so #91 folds in here rather than being struck separately.

## Why This Approach

Three shapes were weighed for how the ticket learns: an appended comment, an upserted
marker-delimited comment, and an edit of the ticket description.

The description edit was rejected on cost. It needs the full three-part discipline Step 2d uses for
preserved blocks — two-phase extract at read and at apply, last-read-wins, and splice-by-
re-composition — against a body humans edit concurrently. Neither this repo nor the
compound-engineering plugin has ever done a read-modify-write against an external body, and this is
the family's first outbound write of any kind.

The upsert was rejected on contract weight. Keeping one comment current means a marker string
becomes a machine-boundary contract needing character-level specification, plus a read path and an
answer to "a human edited our comment" that nothing else in the family has had to give.

Append-only won because each ship is a genuinely distinct event: N comments for N ships is the
honest record rather than a defect, nothing existing can be clobbered, and no read-before-write is
required. It is also the safest possible posture for a first outbound write.

The comparison against compound-engineering was decisive on a second axis. CE also never writes to
an origin ticket — it delegates linkage to the tracker's own PR integration via magic words
(`Fixes ENG-123`), and its ~200-line `tracker-defer` subsystem *creates* new tickets rather than
updating one. That confirmed linkage and discovered-content are two separable payloads: magic words
carry the first and structurally cannot carry the second. This feature owns only the second.

## Key Decisions

- **Exactly one write site — ship-time, post-PR, inside Step 5e**: everything needed is already in
  scope there. Plan-time write-back (posting the Step 4.6 reconciliation ledger) is explicitly out;
  see Scope Boundaries.
- **Append-only comment, one per ship**: no upsert, no description edit, no read-before-write.
- **No new gate**: fires automatically once the ship succeeds, mirroring Step 5f's capture dispatch —
  non-blocking, mode-independent, not governed by `REVIEW_MODE`, and unable to change the ship's exit
  status. `REVIEW_MODE`'s documented "exactly two confirmations" scope is unchanged. This also keeps
  the path headlessly testable, since `claude -p` exposes no `AskUserQuestion`.
- **Two trackers, routed by ref shape**: `TO-1234` → Linear via MCP `save_comment`; `#123` or bare
  numeric → GitHub issue on the PR's own repo via `gh issue comment`. The git host and the tracker
  stay decoupled, as they are today.
- **A `gh issue view` read lands alongside the write**: GitHub refs become first-class rather than
  write-only, so `resolution: linked` is reachable on both branches and composition rows 3 and 8 get
  real content for GitHub-tracker users. This deliberately widens the change beyond pure write-back.
- **Fires at every PR size tier, including typo**: unlike composition row 7's `Fixes <ref>` magic
  words, which are medium/large only. This is precisely what closes the typo-tier hole that
  `skills/ba-propose/SKILL.md:454` names as its guarantee.
- **The disposition is an outcome, not a decision**: unlike `capture:`, which records a verdict no
  later failure can falsify, `ticket: posted` must mean the write happened — so the write executes
  before the receipt prints.
- **Issue #91 folds into this change**: the same change implements write-back and rewords the six
  claiming lines. After this ships they are not false but *conditionally* true, so they need
  rewording to match the disposition set — and "Linear" must come out, since the path is two-tracker.
- **The specification lives inline in `skills/ba-propose/SKILL.md`**, not in `references/`. The
  repo's own measurement argues for it: #59 slice 2 extracted a conditional region for a 3.6%
  resident saving while costing roughly 1318 estimated tokens *more* on the conditional path.

## Locked Design

**Source:** Hybrid — selected as offered rather than free-typed: "A's `record-ship(ship, opts) →
record` with its six-literal enum, explicit HOST parameter, pre-check-decides-degrade invariant and
pre-rendered receipt line; C's `IssueContext.resolution ∈ {linked, ref-only}` replaces A's internal
ref re-resolution so Step 2b stays the single minting site."

### Interface

A new owned operation in `skills/ba-propose/SKILL.md`, in the shape of
`resolve-stack-base(git, opts) → resolution`:

`record-ship(ship, opts) → record`

- `ship` — `{url, repo_slug, host, trailers}`. All fields settled before the call: `url` is 5d's
  `CREATED_PR_URL` (unvalidated — the seam judges it), `host` is the Step 0a value, `trailers` is
  Step 2f's `deviation_trailers`, possibly empty. `host` is an explicit parameter and is **not**
  derived from the PR URL, which would make the seam depend invisibly on URL shape.
- `opts` — `{ref_override, issue_context}`. `ref_override` is the `--issue <ID>` argument verbatim.
- `record.disposition` — a **CLOSED** set, exactly six literals: `posted`,
  `skipped — no-ticket-ref`, `skipped — tracker-unconfigured`, `skipped — ship-url-unresolved`,
  `failed — tracker-rejected`, `unavailable`.
- `record.target` — non-null **exactly when** `disposition == posted`.
- `record.receipt_line` — pre-rendered, printed verbatim by the caller.

`IssueContext` gains one field, `resolution ∈ {linked, ref-only}`. `linked` means the tracker read
succeeded; `ref-only` means a ref was extracted but the read failed, leaving `summary` and
`body_text` empty. Both are writable targets. This requires a matching change at Step 2b, which
today discards the ref on failure — the failure branch must return a populated `IssueContext`
instead of `None`, or both enum values are unreachable and the branch is dead.

**Invariants.** Never raises — any internal throw resolves to `unavailable`. Never alters exit
status, which 5c/5d fix before 5e runs. Called exactly once per run, only on routes that reach 5e.
Degrade is decided by a pre-check **before** any write, so `tracker-unconfigured` and
`tracker-rejected` can never collide. Composition **must never read** `.resolution` — it is
orchestrator-side state, and the guarantee at `skills/ba-propose/SKILL.md:226` depends on it.

### Usage example

```
record = record-ship(
    ship(url=CREATED_PR_URL, repo_slug=REPO_SLUG, host=HOST, trailers=deviation_trailers),
    opts(ref_override=ISSUE_ARG, issue_context=issue_context),
)

print(f"  capture: {decision}")     # line 3, unchanged
print(record.receipt_line)          # line 4, verbatim — no branching, no formatting
```

The receipt becomes four lines normally, or two on the unresolved-URL guard. The bare `✓` line
remains the sole signature of a genuine partial print, so "nothing to report"
(`skipped — no-ticket-ref`, a printed line) can never render as the absent line that means the step
never ran.

### What's hidden behind the seam

Tracker routing by ref shape; transport per tracker (MCP `save_comment` versus a `gh issue comment`
subprocess); the per-tracker pre-check and its meaning; comment body composition, including the bare
`#N` autolink hazard on the GitHub route; the empty-trailers case, which still posts with the PR URL
as the payload; and the entire failure surface — timeouts, auth expiry, a deleted ticket, a rejected
permission — all collapsing to one of two literals before returning.

### Dependency strategy

Both tracker ports are constructed internally and resolved by the ref-shape router; neither appears
in the signature. This is a deliberate trade against `resolve-stack-base`, which names `git` as a
parameter and offers an injectable `host_signal`: there, injection buys a structural git-first
guarantee the caller can inspect, whereas here every injectable is a hole through which Linear or
`gh` vocabulary leaks into 5e. The one thing the caller passes is the already-settled `ship` bundle,
because those are 5d/2f outputs the seam must not re-derive. Step 2b remains the sole minting site
for every tracker's handle, read and write alike.

### Trade-offs

- **Leverage is high at the call site.** 5e gains two lines and zero branches for a feature spanning
  two trackers, four hosts, a pre-check and six outcomes. The specification grows in one owned
  section rather than in scattered conditionals.
- **Leverage is high on the degrade/failure split.** Folding the pre-check inside the seam is what
  makes "degrade is not failure" structurally true rather than caller discipline. Exposing a separate
  availability call would let a future caller skip it and fall back to exit-code inspection.
- **Leverage is thin on observability of the middle.** One literal covers every rejection cause; a
  reader wanting to know *why* must read the seam's own diagnostic, not the receipt. Chosen
  deliberately — a wider enum is a wider parse contract.
- **Leverage is thin on testability.** With no injectable port, a fixture run reaches only the two
  `skipped` values, never `posted` or `failed`. Mitigated by scoring the composed comment and
  disposition rather than executing a real post.
- **Leverage is thin on latency and at-most-once.** The receipt now stalls on a network round-trip
  between lines 3 and 4. And one-comment-per-ship is guaranteed by 5d creating at most one PR, not by
  the seam — which is acceptable only because append-per-ship is the locked intent.
- **The graft is not purely additive.** Taking `resolution` from Design C means Step 2b's failure
  branch and its `None` contract both change, so write-back cannot land without touching the read
  path.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule
(`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`).
Plan and execute may refine this design within the bounds of the lock; they may not re-add elements
from the rejected designs below.

## Rejected Designs

### Design B — Common case (rejected)

- **Interface summary:** `notify-ticket(issue_context, ship) → notice` plus a second
  `notify-ticket.preview(...)` entry point, tuned for the dominant run where no ticket ref exists at
  all. Eight per-tracker literals, a pre-rendered `line`, and an `opts` carrying `tracker_override`,
  `body_override` and `dry_run`.
- **Why rejected:** the pre-rendered line gives receipt formatting two owners — 5e keeps `capture:`
  while the operation owns `ticket:` — a new hand-mirrored seam in a repo that has already shipped
  drift from exactly that shape. `opts` and the preview entry point are surface no locked decision
  asked for, which the simplicity convention treats as speculative configurability. **Incorporated:**
  the pre-rendered `receipt_line` idea survives in the chosen design, but owned by the operation with
  the label fixed in the enum rather than composed at the call site. **Not incorporated:** the
  eight-literal per-tracker split, `opts`, and the preview entry point.

### Design C — Info hiding (partially incorporated)

- **Interface summary:** `notify-origin-ticket(origin, note) → notice` — two parameters, no `opts`. A
  structured `ShipNote` payload instead of a rendered body, four tracker-neutral literals
  (`posted` / `none` / `no-writer` / `rejected`), `HOST` absent from the signature with the repo
  derived from the PR URL, and adapters behind a `can-write` / `write` port so a third tracker costs
  one subsection.
- **Why rejected as a whole:** it pays now for portability the locked scope excluded. Deriving the
  repo from the PR URL makes the seam depend silently on URL shape, failing invisibly with `rejected`
  as the only symptom. Routing has no override, so an ambiguous ref routes wrong with no escape
  hatch. And its four opaque literals are too hidden for a first-of-kind outbound write with no CI
  pin — `unconfigured — linear` earns its extra literal under the standing rule to render the basis
  and not just the verdict. **Incorporated:** `IssueContext.resolution ∈ {linked, ref-only}`, which
  fixes at its source the conflation of "no ticket" with "read failed", and keeps Step 2b the single
  minting site. **Not incorporated:** the structured note payload, the tracker-neutral enum, the
  adapter port, and the absent `HOST` parameter.

## Scope Boundaries

- **Plan-time write-back is out.** Posting the Step 4.6 reconciliation ledger to the ticket is not in
  this change. `/ba-plan` forbids tracker API calls by name at `skills/ba-plan/SKILL.md:510-511`, and
  no ticket ID survives `/ba-plan` at all — `origin:` frontmatter is a brainstorm path. A plan-time
  site therefore needs a new binding *and* a prohibition reversal. It is handed to **#34**, which was
  raised to High on the **#29** roadmap hub on 2026-08-25 and now owns all planning-time tracker
  writes.
- **Upsert and description-edit are out**, per Key Decisions. Adding deduplication later is an
  internal change to the seam.
- **A third tracker is out.** Two are locked; the compound-engineering `tracker-defer` detection
  subsystem was considered and rejected as unneeded for one comment on one already-identified ticket.
- **Row 7's unconditional `Fixes <ref>` is out — and is a separate latent defect.** Composition row 7
  emits a closing keyword with no closing-versus-related distinction, so a partial PR auto-closes its
  ticket on merge; it also fires only at medium and large tiers. This was found during this
  brainstorm and is not fixed here. It deserves its own issue.
- **Obliged mirror edits, in scope:** `CLAUDE.md:104`, `skills/ba-propose/SKILL.md` Guidelines
  (~`:914`), and `README.md`'s `/ba-propose` feature list — the three sync-declared sites describing
  what `/ba-propose` does beyond the staged diff, which this change adds a second outward effect to.
  Plus the six #91 lines and a `README.md` restatement of the new enum.
- **No `CLAUDE.md` owned-operation bullet and no entry in the U-ID / stack-base grid.**
  `record-ship` is single-file with one caller and touches neither `<base>` derivation nor unit
  anchors; `resolve-stack-base` earned its bullet because it has cross-file consumers.
- **CI pinning is out; `ticket:` inherits #87.** The new enum is hand-maintained and unpinned,
  exactly as `capture:` shipped. #87 (presence-only pin for the capture enum) is recorded here as
  covering both.

## Acceptance Criteria

- A ship whose ref resolves to Linear, with the MCP write tool present, leaves one comment on that
  ticket containing the PR URL, and the receipt's line 4 reads `ticket: posted`.
- A ship whose ref is `#123` or bare numeric leaves one comment on that issue in the PR's own repo
  via `gh issue comment`, with the same receipt line.
- A ship with no ticket ref prints `ticket: skipped — no-ticket-ref` — a present line, never an
  absent one.
- A ref present with no reachable writer prints `ticket: skipped — tracker-unconfigured`, and no
  write is attempted. Verified by the pre-check running first, not by inspecting an exit code.
- A tracker that passes the pre-check and rejects the write prints `ticket: failed — tracker-rejected`;
  the ship's exit status is unchanged and the PR URL is still printed.
- The comment fires at every size tier, demonstrated at typo tier — where no Impact section exists
  and the deviation currently surfaces nowhere.
- Step 2b returns a populated `IssueContext` with `resolution: ref-only` on read failure, and
  `resolution: linked` is reachable on both the Linear and GitHub branches.
- No composition row reads `.resolution`.
- The receipt is four lines normally and two on the unresolved-URL guard, with the bare `✓` line
  remaining the only partial-print signature.
- The six #91 lines describe behavior that now happens, worded against the disposition set and
  without naming Linear as the only tracker.
- A fixture A/B over at least four planted cases — no ref, a `TO-` ref whose read failed, a GitHub
  numeric ref, and a typo-tier ship — across `main` and the proposed body, scored in both directions
  for what the change fixes and what it costs.

## Open Questions

None — all resolved during this session.

### Resolved Questions

- *How many write sites?* One, ship-time. Plan-time handed to #34.
- *Comment versus description edit?* Append-only comment per ship.
- *Host neutrality?* Two trackers routed by ref shape, plus a `gh issue view` read so GitHub is
  first-class rather than write-only.
- *Gating?* None — mirrors 5f's non-blocking, mode-independent dispatch.
- *Failure posture?* A closed six-literal disposition on the receipt, with degrade decided by a
  pre-check before any write.
- *Does write-back fire on the edit-only routes?* No. It inherits 5e's existing scope exactly, so no
  new rule is needed.
- *Does a re-ship post a second comment?* Yes, and that is the intent of append-per-ship.

## Convention Compliance

Checked by `convention-checker` against `CLAUDE.md` and `.claude/agent_docs/prompt-authoring.md`:
23 conventions checked, 9 aligned, 1 justified override, 5 violations — all five resolved before
this artifact was written.

- **`resolution` was an unevaluable condition** — Step 2b discards the ref on failure, so neither
  enum value was reachable. Resolved by specifying the Step 2b change, and by adding a `gh issue view`
  read so `linked` is reachable on the GitHub branch too (user decision; widens scope).
- **`resolution` crossed a declared-closed seam** — `issue_context` is a `CompositionInputs` field,
  so read-failure state on it crosses the line `:226` exists to hold. Resolved by an explicit
  "composition must never read `.resolution`" rule stated at the normalizer.
- **No placement decision for new prompt weight** — resolved: inline in `skills/ba-propose/SKILL.md`,
  on #59 slice 2's measured evidence that extraction cost more on the conditional path than it saved
  resident.
- **Mirror sites unnamed** — resolved: `CLAUDE.md:104`, `skills/ba-propose/SKILL.md` Guidelines and
  `README.md`'s `/ba-propose` feature list are named in Scope Boundaries.
- **No verification story** — resolved: a fixture A/B is an acceptance criterion, scoring the composed
  comment and disposition rather than executing a real post.

**Justified override:** signatures and a closed enum appear in a brainstorm, which never writes code.
Sanctioned by the `## Locked Design` template itself, which requires entry points, signatures and
invariants. The `**Code-shape decision:**` label is a plan convention and must be applied downstream
to any literal block the plan carries.

**Carried forward:** #81's premise is stale — #85 rewrote Step 5f, which is now roughly 70 lines
rather than the ~150 that item sized; re-measure before citing it. One bump of `version` in
`.claude-plugin/plugin.json` per ship. This artifact ships in the same commit as the implementation.

## Next Steps

→ `/ba-plan` to create implementation plan
