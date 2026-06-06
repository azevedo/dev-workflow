---
date: 2026-06-06
topic: ba-review-automation
status: approved
triage_level: full
tags: [ba-review, automation, reviewer-selection, finding-verification, house-rule-compliance]
---

# Automating the `/ba:review` Interactive Loop

## What We're Building

`/ba:review` is heavily interactive — reviewer selection and one-by-one finding
resolution dominate each run's back-and-forth.
[GitHub issue #23](https://github.com/azevedo/dev-workflow/issues/23) proposed four
automation workstreams. Per that issue, the backing usage analysis is **privately
held and kept outside this repo**; this brainstorm tracks only the public-safe,
command-level design.

This brainstorm treated those four as **hypotheses, not specs** — they came from a
single transcript-analysis session and may have jumped to solutions. We re-derived
each from the underlying friction. Every one ended up **different from the issue's
wording**.

**Committed first slice: #1 — smarter reviewer selection.** It is the
biggest interaction win (selection is a large, near-deterministic share of every
run), the most self-contained (one command step), and stateless (no new machinery).
Of the other three, two are designed as sequenced follow-ons (#3, #2); #4 was explored
and **declined as conceived** (a separate compliance-reviewer candidate is noted in its
place). None are part of slice 1.

### Slice 1 (committed) — Smarter reviewer selection

Replace today's "pick reviewers from a blank menu every run" with "read the diff,
judge which reviewers have real work, show the full roster with reasoning, confirm
or adjust." Behaviour:

- **Judgment, not scoring.** The orchestrator already reads the diff; it reuses that
  read to decide which reviewers fit ("does this diff contain substantive work in
  this reviewer's domain?"). No scoring engine — a prompt-level change. (EveryInc's
  open-source `ce-code-review` validated this: "agent judgment, not keyword matching.")
- **One uniform pass — no built-in/external caste.** Every candidate (built-in *and*
  discovered external) is judged the same way on relevance. A discovered external
  earns its place on merit; type never decides.
- **The "meaningful work" bar.** A reviewer joins when the diff has substantive work
  in its domain — not a token file match, not just a safe pair. The signal is the
  **surfaces actually present in the diff** (UI markup/styles, exported symbols,
  untested logic, error/IO paths, auth/input handling…), judged per-diff — **not** a
  category→reviewer recipe and not a stored "preferred set." *Illustration, not a rule:*
  a diff that adds an untested UI component with new exports would tend to light
  architecture, simplification, test-coverage, ux, and interface-comment while leaving
  security/error-handling dark — but that falls out of the per-diff judgment on those
  surfaces, not from a "frontend ⇒ these reviewers" mapping.
- **Overlap is judgment, stated in the ledger.** Largely-redundant pair → keep the
  deeper, set the other aside with overlap named as its reason; keep both when the
  distinct part is worth it. No numeric threshold (false precision).
- **Selection ledger.** Before confirming, print the full roster: `✓ selected` /
  `○ set aside`, each with a one-line reason. Nothing hidden; every reviewer
  reachable via Adjust. This is what resolves the "what got left out?" worry and
  makes overlap calls visible and reversible.
- **Confirm, don't re-pick.** The question becomes **Run the ✓ set · Adjust
  (full pick-list) · Done** — the user reserves the decision, but confirms an informed
  default instead of building one from scratch.
- **Stateless.** Computed fresh each run. No persistence, no profile file, no
  `.gitignore` burden; ships to other plugin users as-is. "Remember the skips I
  always make" is a possible slice 2, deferred not dropped.

### Roadmap follow-ons (designed, deferred)

- **#3 — pre-existing filter.** Independent, cheap. Add hunk-level
  pre-existing classification → route to its own default-collapsed section (like
  today's `Suppressed`). Off-diff stays *annotated*, never filtered.
- **#2 — verify fix + precondition.** Most expensive; sequenced **after #1
  and #3** so the finding count it operates on is already shrunk.

Recommended build order: **#1 → #3 → #2.**

### Declined & separate candidates

- **#4 — taste-rule injection into reviewers — declined as conceived.** The idea was to
  forward house-style/taste into reviewer prompts so reviewers stop raising predictably-
  rejected findings and shape their fixes to taste. Dropped: it has **no precedent** (CE's
  `ce-code-review` injects house-style into exactly *one* dedicated persona, never sprays
  it across all reviewers, and uses it only to *detect* violations — not to suppress other
  findings or shape their fixes), the curation mechanism was never specified, and the
  benefit ("reviewers perform better") is **unproven** — the only one of the four whose
  payoff rests on a hypothesis rather than observed friction. Full reasoning in *Why This
  Approach*. The leftover *shape* sub-goal (a proposed fix should respect your style) does
  **not** cleanly fold anywhere — it splits: a cheap *local-style-consistency* check (don't
  introduce style the surrounding code doesn't use) could ride with **#2**, which already
  reads the surrounding code; but enforcing *personal* style rules on a fix needs an explicit
  rule set — that is the **compliance-reviewer candidate**'s territory and carries the same
  sourcing question.
- **Candidate (separate roadmap — not this one): house-rule compliance reviewer.** CE's
  actual, proven pattern — a single always-on reviewer that flags violations of
  *quotable, mechanically-checkable* rules in ancestor `CLAUDE.md` / `CLAUDE.local.md`
  (and `AGENTS.md`), scoped to the changed paths, **cite-the-rule-or-drop-the-finding**.
  It is the review-time sibling of the existing `convention-checker` (which validates only
  *planning artifacts*). Deliberately **out of scope here**: this roadmap's theme is *less
  interaction*, and a compliance reviewer *adds* findings. Its value also scales with how
  crisply rules are written down (a vague `CLAUDE.md` yields low-confidence findings that
  get suppressed). Pick up only if review-time house-rule enforcement becomes a felt
  need — it was not surfaced by the usage analysis.

## Why This Approach

Each item diverged from the issue's framing once we dug into the underlying friction:

- **#1 — judgment over a scoring rubric.** We nearly built a surface→score model;
  `ce-code-review` showed it's unnecessary because the orchestrator already reads the
  diff. The "saved profile" framing also implied persistence; we rejected that for
  slice 1 because (a) the repo culture explicitly rejects runtime config/probing as
  YAGNI and refuses to write into a consuming repo, and (b) a history-learned profile
  doesn't transfer to other users of the plugin. A stateless smart default sidesteps
  all of it.
- **#2 — "show your work," not "better detection."** Detection is already accurate —
  genuine false-positive *detections* are rare. The unreliability is the *fix*
  (wrong/non-idiomatic/doesn't-compile — the worst class of error) and the
  *precondition* a finding rests on. The product is therefore **inline verification
  evidence** that pre-empts the recurring "are you sure?" interrogation, not a
  more-accurate detector. Scope is **claim-bearing findings only** (a fix to ground,
  or a premise to confirm); advisory "Consider…" items carry nothing checkable and are
  handled by *suppression*, not verification. This overlaps the previously-**declined**
  evidence-match idea — tracked as [#8](https://github.com/azevedo/dev-workflow/issues/8)
  ("B7"). But #8 was declined as YAGNI for *anti-hallucination* (does the cited `file:line`
  exist / match the prose), a pain not felt in practice; #2 is **broader and differently
  motivated** — verifying the *fix* and the *precondition*, not citations — so it clears a
  higher bar than #8's own revisit trigger. #8 also captures reusable design for whoever
  builds #2 (run after dedup; on failure demote-don't-drop; the Tier-1 existence check
  already shipped via the consolidation rework). De-risked further by sequencing #2
  downstream of #1/#3.
- **#3 — pre-existing ≠ off-diff.** The issue said "filter off-diff." But off-diff
  (file:line outside changed files) is *intentional* one-hop traversal for
  complexity/deep-module — filtering it would blind them. The friction is the
  **pre-existing** axis (wanting only findings related to the author's actual
  changes), which the command does **not** compute today (it only has a file-level
  off-diff annotation). So #3 is new hunk-level computation routed to a collapsed
  section — not repurposing the off-diff flag.
- **#4 — declined as conceived (inject taste into every reviewer).** The hypothesis was
  that feeding taste into reviewer prompts would make reviewers suppress predictably-
  rejected findings and shape fixes to taste. Investigating the one real precedent killed
  it: CE's `ce-code-review` does the **opposite** of a spray — house-style flows to a
  *single* dedicated `project-standards` persona (a gated `<standards-paths>` block; the
  other reviewers never see it), and that persona only *detects* violations of **quotable**
  rules (cite-the-rule-or-drop) — it does **not** suppress other reviewers' findings, and
  nothing feeds taste into how other reviewers shape fixes. CE simply accepts that its
  other reviewers don't know the house-style and leans on the confidence gate + the human,
  exactly as we do today. (An aside that compounded the error: my first precedent,
  `ce-compound`, is a *knowledge-capture* skill, not a reviewer — so there is **no**
  precedent at all for feeding auto-memory into reviewers to change findings.) So the
  spray is **unprecedented**, its curation was never specified, and its benefit is
  **unproven** — the only one of the four resting on a hypothesis rather than observed
  friction. We drop it. The *shape* sub-goal splits — a cheap local-style-consistency check
  could ride with #2 (which already reads the surrounding code), but enforcing *personal*
  style rules on a fix needs an explicit rule set and is the compliance-candidate's territory
  (see Scope Boundaries). The proven CE pattern (a dedicated compliance *detector*) is
  recorded as a separate candidate above, not part of this interaction-reduction roadmap.

**Cross-cutting principles** that held across all four:
- **Stateless / no new config** — matches the repo's YAGNI culture and the documented
  refusal to write user/repo config files.
- **Never silently drop** — every mechanism *surfaces with a reason* (the ledger,
  collapsed sections, inline evidence). Nothing disappears without the user being able
  to see it and why.
- **Reserve the decision for the human** — automate the mechanical, keep the user the
  decision-maker on substance (confirm step, override paths, visible reasoning).

## Key Decisions

- **Slice 1 = #1 only.** Biggest win, self-contained, stateless. — Maximises value per
  unit of build risk; avoids "build the wrong thing" across an unproven roadmap.
- **Judgment-based selection, no scoring engine.** — Orchestrator already reads the
  diff; a rubric is maintenance burden and false precision.
- **Selection ledger (full roster, in & out, with reasons).** — Resolves transparency
  FOMO *and* makes overlap decisions visible/reversible in one artifact.
- **Overlap handled as stated judgment, not a numeric threshold.** — The agent can't
  reliably compute "% domain overlap"; visibility + one-click override is what matters.
- **#1 stays stateless; persistence deferred (possible slice 2).** — The ledger's
  "set aside" bucket is the exact seam a future stateful "remember my skips" plugs into,
  so deferring costs nothing structurally.
- **#3 computes a *pre-existing* axis (hunk-level), collapsed-section presentation;
  off-diff remains annotated.** — Matches the real ask and avoids blinding
  complexity/deep-module.
- **#2 verifies claim-bearing findings (fix + precondition); advisory items suppressed,
  not verified; sequenced after #1/#3.** — Targets the actual unreliability; bounds cost.
- **#4 (inject taste into every reviewer) — declined as conceived.** — No precedent (CE
  injects house-style into one dedicated detector, never sprays; detection-only, not
  suppression/shaping), curation unspecified, benefit unproven. *Shape* sub-goal splits
  (cheap local-style-consistency check → could ride with #2; personal style rules → the
  compliance-reviewer candidate, which needs an explicit rule set); that CE-style dedicated
  compliance reviewer is recorded as a separate candidate.
- **Design-it-twice did not fire** — all four modify existing `/ba:review` steps; no new
  module, file, exported function, or public interface is proposed.

## Scope Boundaries

- **Not in slice 1:** #2 and #3 (designed, deferred). #4 declined as conceived; a
  house-rule compliance reviewer is noted as a separate candidate (see *Roadmap*).
- **No persistence / config / profile file** anywhere in these designs.
- **No removing reviewers from reach** — the never-hide intent is preserved; only the
  *presentation* changes (see Convention Compliance).
- **If taste-handling is ever revisited, it splits across distinct consumption points** —
  worth keeping straight so a future effort doesn't re-fuse them the way the dropped #4 did:
  - compliance detection (flag violations of quotable rules) → the **house-rule compliance
    reviewer** candidate above;
  - fix-shaping (a proposed fix respects your style) → **splits**: a cheap
    local-style-consistency check could ride with **#2** (it already reads the surrounding
    code); enforcing *personal* style rules needs an explicit rule set → the
    **compliance-reviewer candidate**;
  - posting-framing (softening tone on another author's MR) and command-behaviour
    (volume-curation, scope rules) → the posting step / the command itself (**separate, future**).
- **No auto-apply** of fixes — out of scope across the board; the lever is shrinking and
  pre-qualifying the walk, never deciding for the user.

## Acceptance Criteria

### #1 — Smarter reviewer selection (slice 1)

- On a representative diff, the reviewer-selection step prints a ledger listing **every** candidate reviewer
  (built-in + discovered external) marked selected/set-aside with a one-line reason.
- The default `✓` set reflects the diff's surfaces, judged per-diff (e.g. a CSS-only diff
  would not tend to select security/error-handling; a new-module-with-exports diff would
  tend to surface architecture/deep-module/interface-comment) — an outcome of the
  judgment, not a fixed category→reviewer mapping.
- A set-aside reviewer is re-selectable via **Adjust** without re-running discovery.
- Overlap-driven set-asides state the overlapping reviewer as their reason.
- No reviewer is unreachable; no persisted state is written.
- The selection step requires **one** confirm interaction in the common case (down from
  re-picking the full set).

### #3 — Pre-existing collapsed section

- Findings are classified at **hunk granularity** — whether the finding falls on a line
  the author actually changed, not merely on a changed *file*.
- Findings about code the author did **not** introduce are routed to a default-collapsed
  `## Pre-existing` section (mirroring today's `## Suppressed`), surfaced on request; the
  header reports the count.
- On-diff, author-introduced findings still appear inline.
- **Off-diff findings remain annotated `(off-diff)`, never filtered** — a complexity- or
  deep-module-reviewer one-hop traversal finding still surfaces (regression guard).
- No finding is silently dropped: every finding is inline **or** in a labelled collapsed
  section, never gone.

### #2 — Verify fix + precondition

- A finding carrying a **concrete fix** or a **checkable factual premise** arrives with an
  inline evidence line (e.g. "✓ confirmed the referenced primitive exists at `<file:line>`" /
  "✓ read the hook source: its setter is stable, so the proposed memoization is unnecessary").
- A finding whose **premise fails** verification is dropped or demoted, not presented as-is.
- A finding whose **proposed fix references a non-existent symbol** (or plainly wouldn't
  apply) has its fix withheld or flagged — never presented as a confident fix.
- **Advisory "Consider…" findings** (no checkable claim) are **not** verified — suppression
  handles them; verification effort is not spent there.
- Verification runs on the **post-#3** finding set (pre-existing already split out), keeping
  per-finding cost bounded.
- In the common case the user no longer needs to ask "did you verify…?" — the evidence is
  already present (the metric is the disappearance of that interrogation, not detection rate).

## Open Questions

*(none open — all resolved during the session; see below)*

### Resolved Questions

- **Which of #1's three frictions are real?** All three (re-picking the core, dead-option
  clutter, hand-adding situational) — confirmed by the user.
- **Stateful vs stateless for #1?** Stateless for slice 1; persistence deferred. Auto-memory
  is recall-gated/per-repo and not a reliable config store (confirmed against CE's read-only
  usage).
- **How aggressive a default?** Dissolved into the "meaningful work" bar (avoids both
  over-lean and over-inclusive, both of which force Adjust).
- **Transparency / overlap?** Resolved by the selection ledger + stated-judgment overlap.
- **#3 axis & presentation?** Pre-existing axis, separate collapsed section.
- **#2 scope?** Fix + precondition, downstream of #1/#3.
- **#4 (taste injection)?** Declined as conceived — no precedent, unproven benefit.
  *Shape* splits (local-consistency → could ride with #2; personal style rules → the
  compliance candidate); compliance-detection recorded as a separate candidate.

## Convention Compliance

Checked against `CLAUDE.md`, `commands/ba/review.md`, and `README.md`. Aligned on:
planning-commands-never-write-code, the mandatory compliance gate, artifact path +
frontmatter, no-new-agents/config/artifact-paths, and the stateless/no-config culture.

**One violation, resolved — never-hide convention (letter vs. intent).** The rule is
written as a *mechanic* in five places (`review.md:230`, `:263`, `:265`; the `CLAUDE.md`
never-hide bullet; `README.md:163`): "each reviewer gets its own individual option …
must appear as separate options." Slice 1's ledger+confirm replaces that mechanic
(top-level options become Run ✓ / Adjust / Done; per-reviewer selection moves into
Adjust). The design satisfies the rule's **intent** (every reviewer visible with a
reason, all reachable, nothing silently dropped) but contradicts its **letter**.

*Resolution (user decision):* the convention is **intent-based** — "every reviewer is
visible, reasoned, and reachable; never silently dropped." The ledger over-satisfies
this. The slice-1 plan therefore carries, **as explicit deliverables**, rewording of all
five locations to document the ledger+Adjust mechanic, and **carries the never-bundle
rule (`:263`) into the Adjust pick-list** so Adjust exposes every reviewer individually
without re-bundling.

**Forward-looking notes for the plan/execute stages (not brainstorm-blocking):**
- **Docs to update with slice 1** (per "update README.md whenever commands change"):
  `README.md:162–163` (currently "shows all reviewers … so you choose" — inaccurate
  after the ledger) and the `CLAUDE.md` never-hide bullet, alongside `review.md`.
- **Version bump** (`plugin.json`, currently `0.20.1`) is a required slice-1 plan step —
  it is the auto-update cache key; do not defer.
- **Protected-artifacts guard:** slice 1, #2, and #3 do not touch the guard
  (`review.md:333`/`:379`/`:431`). The dropped #4 would have injected into the
  reviewer-dispatch prompt where the guard lives — that risk retires with it. A future
  house-rule compliance reviewer would be an ordinary reviewer subagent and inherits the
  existing guard unchanged.

## Next Steps

→ `/ba:plan` to create the implementation plan **for slice 1 (#1 — smarter reviewer
selection)**. The plan must treat the never-hide rewording (5 locations above) and the
`plugin.json` version bump as explicit deliverables, since the ledger changes the
reviewer-selection mechanic.
