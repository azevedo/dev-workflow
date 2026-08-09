---
date: 2026-08-09
topic: comment-quality-reviewer-builtin
status: approved
triage_level: full
tags: [ba-review, reviewers, agents, comment-quality, issue-55]
---

# Comment-Quality Reviewer as the Eighth Built-In

## What We're Building

Port the maintainer's user-level `comment-quality-reviewer` into this plugin as the eighth built-in
reviewer at `agents/comment-quality-reviewer.md`. Its domain is comment quality under Ousterhout's
interface-vs-implementation separation: doc comments (JSDoc, docstrings) on declarations that have
callers, and inline `//` comments inside function bodies.

This is a **portability** change, not a new capability. `/ba-review` Step 2b discovery already finds
the external agent and ledgers it on any machine that has it. Bringing it in-repo makes the
capability travel with the plugin and guarantees a ledger row everywhere, and it closes a routing
bug that exists today regardless of this port (see Key Decisions, D6).

## Why This Approach

**Rejected: the procedural argument.** Issue #55 was re-framed to rest on a signature-blind
interface pass — read declarations and reach a verdict *before* opening any function body — as the
property no diff-reading reviewer could replicate. An evidence sweep over 36 distinct runs across
three real-code repositories does not support it. Zero runs show a verdict reached from a signature
alone. Eight runs state the opposite ordering explicitly before emitting any interface finding, and
many interface findings are justified by body text that is only available after reading it. Sixteen
runs narrate the rule, which is the agent quoting its own instructions. **The property is
unobservable at best and contradicted at worst**, so it cannot carry the ticket.

**Accepted: the coverage argument.** Two independent instruments over the same corpus agree. The
consolidator's own dedup ledger over 130 attributed findings shows ~78% sole-attribution, ~22%
merged, and only ~12% co-signed by architecture / complexity / deep-module / simplification. Raw
anchor collision over 213 anchors shows 3.3% exact same-`file:line` overlap with those four. Of 16
exact collisions read individually, roughly four were true duplicates and four were the same comment
critiqued for a *different* defect — complementary rather than redundant. The residual is real, and
it is a rubric residual rather than a procedural one.

**Rejected: the ledger-noise objection.** `.claude/agents/prompt-surface-reviewer.md` was added and
reverted three commits later because "discovery is not free; anything discoverable is permanently in
the ledger." That failure mode does not apply here: across observed ledgers this reviewer was
selected 37/37 times with reasons citing real domain presence, and was correctly set aside on the one
prose-only diff in this repo. It is not a lens that fires on unrelated work.

## Key Decisions

- **D1 — Eighth built-in, justified on measured residual.** Not on signature-blindness. Rationale:
  the 78% sole-attribution and 3.3% anchor overlap are the strongest evidence in the corpus, and they
  argue coverage, not method.
- **D2 — The read-ordering rule is removed, not merely demoted.** Rationale: it is measured
  unsupported, and a rule the model does not follow is prompt surface every dispatch pays for. The
  two-pass **scope** split — interface comments, then implementation comments — is supported and is
  retained as steering in `## How to Review`.
- **D3 — The description drops the presence-test self-exemption.** The source instructs that "small
  surface is never a reason to set it aside," which competes with Step 2c's authority to judge every
  reviewer against the diff. Rationale: 37/37 was an observation of how the judgment lands, not a
  licence to hardcode the outcome; the house pattern is a dimension sentence ending "Use as a
  built-in reviewer in /ba-review."
- **D4 — Its own confidence anchors port verbatim**, including the restatement→75-not-50 rule and
  its stated rationale. Rationale: that rule already exists precisely because findings at 50 were
  being buried, and porting it is faithful translation rather than gate surgery.
- **D5 — `**Verdict:** Ready | Needs revision` is dropped** despite firing in 30/36 runs. Rationale:
  no Step 4a–4f consumer parses it, and one reviewer emitting a readiness token the other seven do
  not creates a second gate surface competing with Step 4's.
- **D6 — Repair the dangling deferral at `agents/complexity-reviewer.md:70`.** It routes "unclear
  comments" to `architecture-reviewer`, where the word "comment" appears nowhere, and to "the
  deferred comment-quality reviewer", which does not exist in-repo. Rationale: this is a live routing
  bug today and is repaired by this work regardless of the rest.
- **D7 — Reword `one of seven parallel built-in reviewers` to `one of several`** in the seven
  existing agents' `<commentary>` blocks, while the two skills' counts become the exact number
  **eight**. Rationale: the agent-side count is an implementation constant leaking into seven files;
  the skill-side counts are enumeration guarantees the ledger invariant depends on and must stay
  exact.
- **D8 — Keep `tools: Read, Grep, Glob`** from the source rather than the house default of no `tools`
  key. Rationale: the convention permits restriction, and a reviewer that cannot write is a stronger
  guarantee than a prose instruction not to.
- **D9 — Design-it-twice fired**; three constraint-anchored designs were generated and contrasted.
  See `## Locked Design`.

## Locked Design

**Source:** Hybrid — "C base + B's staleness call". Design C (info-hiding) supplies the interface;
Design B supplies the staleness treatment, replacing C's staleness lens with an explicit
out-of-charter line. The two differ precisely there, so the hybrid is not C unmodified.

### Interface

Three public slots; everything else in the agent file is private and free to churn.

1. **The roster Focus cell** — `skills/ba-review/SKILL.md` Step 2a and `skills/ba-review-plan/SKILL.md`
   Step 1a are hardcoded tables, and the **Focus column is what Step 2c judges a built-in against**.
   The frontmatter `description` is read by Step 2b for *discovered externals* only. The Focus cell,
   not the description, is the selection surface that matters here; both are specified, and neither
   enumerates criteria.
2. **The dispatch fill-in** — one `[dimension focus]` value in the existing agent-based `Task`
   template. It may narrow scope; it must never enumerate criteria, because a dispatch literal beats
   an agent-local one and criteria pinned into a consumer file cannot then change in one place.
3. **The findings block** — the four-level ladder plus `## Looks Good`, with the house bullet shape
   `- **<path>:<line>** *(confidence: N)* — <body>`. Nothing precedes `## Critical`.

Invariants carried verbatim: the three shared rubric paragraphs, including the byte-exact literal
`N ∈ {0, 25, 50, 75, 100}` and the citation string `Code-Anchor & Confidence Grammar`. These are
machine-boundary contracts — `rubric-mirror` auto-enrols any `agents/*-reviewer.md` by filename
suffix and asserts both.

### Usage example

`/ba-review` gains one roster row and one dispatch member. Step 4a–4f normalises eight result sets
exactly as it normalised seven — no reviewer-specific branch, no parser change.

### What's hidden behind the seam

- **The criteria set.** Changing what counts as a bad comment edits one file: no roster row, no CI
  literal, no description word.
- **The treatment taxonomy** (`Delete | Substitute | Relocate | Add`) lives in `## Principles` as
  steering, following `agents/complexity-reviewer.md`'s lens-tag placement exactly — present in
  Principles, absent from the `**Legal values and position.**` paragraph, which stays confined to the
  machine-boundary literal. It is body text, never parser structure.
- **The comment-to-code ratio pre-check** is an internal `## How to Review` step surfacing only as an
  ordinary Medium or Low bullet. A block emitted before `## Critical` would be a second output
  grammar the normaliser must learn permanently.
- **The two-pass scope split**, as attention-ordering rather than promised output ordering.

### Dependency strategy

Three inbound edges, all by citation, no new artifact. The rubric is cited in the same
three-paragraph form the other seven carry. CI enrolment is by filename suffix, so naming the file
correctly *is* the integration — no checker edit. **No `references/` file is created**: with one
consumer the shareability rule says skill-local or nothing, and a top-level file would add a
CI-checked citation edge plus a second home the dispatched subagent is not guaranteed to load.

### Trade-offs

Criteria churn is contained to one file, which matches the evidence that after 36 runs the criteria
are still moving. The count-free `<commentary>` rewording converts a recurring seven-file edit into a
one-time one. Against that: constraint (1) defeats hiding exactly where binding is needed, so
criteria are advisory by construction — if one ever proves it must bind, this seam has nowhere to put
it without leaking into the dispatch template. `Treatment` survives only as unparsed body text, so
nothing downstream can group by it. And the seam does nothing about the remaining hand-maintained
mirror sites, which no interface choice can shrink.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule
(`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`).
Plan and execute may refine within the lock; they may not re-add elements from the rejected designs.

## Rejected Designs

### Design A — Deepest module (rejected)

- **Interface summary:** three entry points with **no agent-specific dispatch delta at all** — the
  existing template dispatches it unmodified — reusing complexity-reviewer's tag slot for
  `[interface]` / `[inline]`, with the ratio check retained as internal calibration that raises
  confidence but never prints.
- **Why rejected:** it designs out the constraint-1 hazard elegantly, but pays by being unable to
  enforce anything the shared template does not already enforce, and hiding the ratio check makes its
  contribution permanently unfalsifiable — a future A/B on whether it helps would have nothing to
  measure. It also ships a staleness lens the evidence does not support.

### Design B — Common case (partially incorporated)

- **Interface summary:** shaped byte-for-byte like `deep-module-reviewer.md` and optimised for the
  measured modal finding (186 of 207 bullets are a single-line Medium or Low), with `Treatment`
  demoted to opt-in on form and High bullets, and the ratio pre-check relocated into the dispatch
  template where it actually binds.
- **Incorporated:** its staleness call — declared out of charter in one line and documented as a
  measured hole. **Not incorporated:** the opt-in `Treatment` rule, which adds a conditional the
  reader must hold, and the dispatch-template relocation of the ratio check, which puts a criteria
  literal in a consumer file against the locked design's rule (2).

### Design C — Info hiding (chosen as base, one element replaced)

- **Replaced element:** its staleness lens. **Why:** this reviewer produced no staleness finding
  across 36 runs while built-ins caught a factually wrong doc comment twice, so shipping the lens
  would assert a capability the evidence does not support.

## Scope Boundaries

- **Gate calibration stays with issue #44** (confirmed open: "recalibrate the Med-conf-100
  posting/apply filter for taste-domain reviewers"). The measured burial — modal confidence 50, being
  85 of 198 anchors, below the H/M/L render floor of 75 — is recorded here as evidence for that
  ticket, not fixed here. `/ba-review`'s floors, merge math, and Med-conf-100 filter are untouched.
- **No staleness detection.** Declared out of charter; the hole is documented, not filled.
- **No `references/` extraction** of the rubric.
- **No charter changes to the other seven** beyond the D7 count rewording and the D6 repair.
- **No new dispatch-template clause** carrying criteria.

## Acceptance Criteria

- `agents/comment-quality-reviewer.md` exists, `name:` equals the basename, and
  `node scripts/check-invariants.mjs` passes with it auto-enrolled in `rubric-mirror` — byte-exact
  `N ∈ {0, 25, 50, 75, 100}` and the `Code-Anchor & Confidence Grammar` citation both present.
- **Every `/ba:` occurrence in the ported text is rewritten to `/ba-`.** The source contains the
  string three times, including in its frontmatter description; `retired-invocations` bans it outside
  `docs/` with `scripts/` the only exception, so a verbatim port is a hard CI failure.
- The read-ordering rule and the "signature-blind pass no other reviewer performs" claim are absent
  from both the description and the body.
- Roster rows added at `skills/ba-review/SKILL.md` Step 2a and `skills/ba-review-plan/SKILL.md`
  Step 1a; counts updated to **eight** at every mirror site listed under Convention Compliance; the
  `ba-review-plan` Adjust partition worked example re-split for eight.
- `.claude-plugin/plugin.json` bumped exactly once, `0.44.0` → `0.45.0`. `0.44.0` is already shipped
  at HEAD, so no re-bump mid-branch.
- `agents/complexity-reviewer.md:70` names `comment-quality-reviewer` and no longer routes comment
  findings to `architecture-reviewer`.
- **Dry-run in a fresh session** via `claude --plugin-dir <repo>` — a running session executes the
  body it loaded at start, so this cannot be verified in-session. The reviewer appears in the Step 2a
  ledger, returns findings in the four-level ladder, and `summary.md` reports `legacy_format`,
  `mixed_format`, `snapped`, and `dropped` all zero.

## Open Questions

None. All questions raised during this brainstorm were resolved with the user; see Resolved
Questions.

### Resolved Questions

- **Does the signature-blind method survive dispatch?** No — resolved by evidence sweep rather than
  by the fixture A/B originally planned. The ticket's justification moved to measured residual
  coverage.
- **Does this ticket absorb the confidence-burial fix?** No. The agent's own anchors port verbatim;
  `/ba-review`'s gate stays with #44.
- **Keep `**Verdict:**`?** Dropped, deliberately, with rationale recorded (D5).
- **Keep the description's never-set-aside clause?** Dropped in favour of the house pattern (D3).
- **Staleness lens or documented hole?** Documented hole — surfaced and confirmed as a deliberate
  scope reduction before capture.

## Convention Compliance

Checked by `convention-checker`; four violations and seven warnings raised, all resolved before this
artifact was written.

- **Mirror-site inventory completed.** The load-bearing omission was the two hardcoded roster tables
  — `skills/ba-review/SKILL.md:242` and `skills/ba-review-plan/SKILL.md:53` — without which the agent
  file exists but is unreachable, which the never-hide-ledger convention forbids. Full inventory now
  in Acceptance Criteria: those two tables, plus counts at `ba-review` 254/296/329, `ba-review-plan`
  9/65/76/106/162/168 including the Adjust partition example at 168–170, `README.md` 134/139/159/172
  and the agents table at 279–285, `CLAUDE.md`'s agents list, and the seven `<commentary>` lines.
- **Selection surface corrected.** The frontmatter `description` is read by Step 2b for discovered
  externals; a built-in is judged against its roster **Focus** cell. The locked design specifies both.
- **Treatment taxonomy reclassified as steering**, in `## Principles` only, matching
  `complexity-reviewer`'s placement — not in the bullet-grammar line, which stays a machine-boundary
  contract.
- **`retired-invocations` risk caught** — the source carries `/ba:` three times; rewriting is now an
  acceptance criterion rather than an assumption.
- **Authoring residue excluded** — the three-slot rule is guidance for whoever writes the agent, not
  for the model executing it, and stays in this brainstorm and the plan rather than shipping inside
  the agent file.
- **Version bump made explicit** — one bump, `0.45.0`, per the one-bump-per-ship rule.
- Passes: agent naming (`-reviewer` suffix, flat in `agents/`, and load-bearing as the CI enrolment
  key); reference placement (no file, correct at one consumer); protected-artifacts guard untouched,
  since it lives in the skills' dispatch templates; the D7 reword conflicts with no CI check, as
  `<commentary>` is not a `- Task ` dispatch block.
- Altitude note: this repo's product is prompt text, so parts of the locked design necessarily name
  literals. Machine-boundary contracts are specified exactly; wording for the reword, the Focus cell,
  and the taxonomy is left for `/ba-plan` to mint.

## Next Steps

→ `/ba-plan` to create implementation plan
