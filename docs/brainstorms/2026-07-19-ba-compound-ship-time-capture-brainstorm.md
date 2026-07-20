---
date: 2026-07-19
topic: ba-compound-ship-time-capture
status: approved
triage_level: full
tags: [compound, propose, knowledge, triggering, ship-time-capture, ba, roadmap-52]
---

# `/ba:compound` — Fire at the Right Moment (Ship-Time Capture)

## What We're Building

A fix for the felt problem that `/ba:compound` never actually runs unless typed by
hand, so compounding opportunities are lost because nobody revisits a finished session
to capture them. Three coordinated, **triggering-only** changes:

1. **Drop the auto-path friction in `compound.md`.** Remove the inert
   `<auto_invoke><trigger_phrases>` body block and the Step 0 auto-path
   `AskUserQuestion` confirmation gate, so a deliberate run — manual or offer-driven —
   proceeds directly with no blocking questions. The insufficient-context guard stays
   (that is correctness, not friction).

2. **Tell the truth in the frontmatter description and README.** Reframe the
   description away from the false "auto-triggers on phrases like 'that worked'" promise
   (the mechanism does not exist) toward an honest, model-proactive-friendly line ("use
   after solving a non-trivial problem to capture a reusable learning"). Correct the
   aspirational README wording at `README.md:164–165` and the "or let it auto-trigger"
   claim at `README.md:286`.

3. **Add an assessment-gated capture offer to `/ba:propose`.** After a *successful*
   PR/MR create (Step 5e — never on the `--describe-only` dry-run path, never on
   failure), propose makes a cheap best-effort judgment of whether the shipped change
   carried a **reusable learning**. Only when the judgment is positive does it surface a
   single nudge ("Document this learning?"); accepting runs `/ba:compound` in-session
   and returns a post-hoc summary. When the change is routine — or the judgment is
   uncertain — propose stays completely **silent**. Declining is one keystroke. The
   single human accept is the gate.

This is for a solo maintainer who ships via `/ba:propose` and has never once closed the
compounding loop (`docs/solutions/` does not exist in the repo today).

## Why This Approach

**Auto-fire is mechanically impossible, not just unwired.** Claude Code reads only a
command's frontmatter before invocation, so the `<auto_invoke>` body block is inert; and
hooks fire on lifecycle events only — they cannot read conversation text for phrases
like "that worked". Confirmed: the repo ships **zero hooks**. So a phrase trigger cannot
be built.

**The ecosystem already tried and retreated.** The evolved sibling `ce-compound` ships
no hooks, has no compound step in its autopilot, and *removed* the trigger-phrase
language `ba:compound` still carries. It invested instead in (a) frictionless deliberate
runs and (b) human-gated capture offers hung off the natural end of work
(`ce-pov`/`ce-debug`/`ce-optimize`). We follow the same path.

**Ship-time is the truest "solved and verified" beat.** `/ba:propose` runs at the exact
moment the user says they never return to — the change is committed, pushed, and the PR
is open. Propose already holds rich material (the full conversation, the composed PR
body, the diff) and already computes structured signals we can lean on. Crucially, the
decision it makes is low-stakes: whether to show *one extra option in a menu context we
are already at*. A false positive costs one keystroke; a false negative just means no
offer (same as today), and manual `/ba:compound` — now frictionless — is the escape
hatch. That asymmetry is why a best-effort assessment is trustworthy here even though the
same best-effort judgment failed as a cold conversational auto-trigger.

**Assessment-gate + lean-silent avoids banner-blindness.** Offering on every ship would
train reflexive dismissal — the exact "banner-blindness" caveat the issue names — which
kills the feature as surely as never firing. So the offer is gated on a plausible
learning and leans silent when uncertain (precision over recall).

Rejected / deferred alternatives:

- **Host on `/ba:review` (or both).** Review isn't always the terminal act (you often
  review, fix, then keep working), and hosting on both doubles the surface and risks a
  double-offer when you review then propose the same work. Deferred; propose is the
  single terminal moment for v1.
- **Fully headless auto-capture** (no gate). Tolerates over-capture and documenting
  unverified fixes — the failure `ce-compound`'s gate exists to prevent. Rejected.
- **A `Stop`/`SessionEnd` hook that nudges.** Cannot detect "we solved something" (git
  state ≠ a learning); a reminder every turn-end is banner-blindness with token cost.
  Rejected.
- **Structured-signals-only assessment** (fire only on deviation trailers / risk=high).
  Highest precision but misses prompt-engineering learnings that never went through
  `/ba:execute` — most of this repo's gnarly fixes. Rejected in favor of a blended
  lean-silent judgment.
- **Run compound *before* PR create so the learning splices into the PR body via
  propose's existing Step 2c "What I learned" machinery.** Tempting coherence win, but it
  inverts the "capture after it's shipped" framing, delays the ship behind subagents, and
  is more invasive than a triggering-only slice. Noted as a possible future refinement,
  not v1.

## Key Decisions

- **Host:** `/ba:propose` only, at ship-time, after a successful create (Step 5e).
- **Placement guard:** the offer must sit *after* PR/MR creation and must **not** appear
  on the `--describe-only` dry-run path, honoring propose's rule that a dry-run never
  gates behind a menu.
- **Interaction:** nudge → a single human accept runs `/ba:compound` in-session, then a
  post-hoc summary; declining is one keystroke and proceeds to normal completion.
- **Assessment gate:** propose performs a cheap best-effort "did this carry a reusable
  learning?" judgment; the offer appears only on a positive judgment and is **silent**
  otherwise.
- **Posture:** lean silent (precision). Silent when routine *and* when uncertain. The
  false-negative escape hatch is the now-frictionless manual `/ba:compound`.
- **Assessment signals** (best-effort, blended — not a rigid rubric):
  - Deviation trailers from Step 2f (`Deviation (U<n>): …` recorded by `/ba:execute`) —
    the strongest structured signal: "reality diverged from the plan, here's why."
  - A problem → investigation → fix arc in the conversation.
  - Commit type / motivation: a `fix:` for a gotcha or workaround vs. a clean `feat:` or
    a docs/config-only change.
  - Lightly, the `risk` / `proof` / `sensitive_paths_touched` facts propose already
    materializes.
- **Scope:** triggering only. Corpus-quality improvements are explicitly out (see Scope
  Boundaries) and belong to separate `#29` roadmap issues.
- **Preserve the internal design:** the 5-subagent compound flow from the
  `2026-03-21-ba-compound-brainstorm.md` design is unchanged; this brainstorm revises
  only that brainstorm's *triggering* decisions (auto-trigger-on-phrases + auto-path
  confirmation), which are now known to be inert / friction-first.
- **Release hygiene:** bump `.claude-plugin/plugin.json` `version` (currently `0.33.0`);
  update `README.md`.
- **Documented convention exception:** amend the CLAUDE.md "Git workflow commands
  (`ba:propose`) … never modify source files outside the staged diff" line (and mirror
  the carve-out in `propose.md`'s Guidelines) to state: propose *itself* never writes
  source; the sole exception is the post-create, user-accepted `/ba:compound` hand-off,
  which writes only to `docs/solutions/`, after the PR is open, and never as part of the
  pushed diff. This keeps the chosen "accept runs it" design and removes the
  contradiction the convention-checker flagged.
- Design-it-twice was **not** dispatched — the change is modifications to existing
  commands (no new module/interface/command), so the trigger did not fire; the approach
  was settled through Phase 1 dialogue.

## Scope Boundaries

Explicitly **not** in this issue (#52):

- **No hooks / lifecycle wiring** — impossible for phrase detection; no Stop-hook nudge.
- **No offer on `/ba:review`, and not on both** — propose only for v1.
- **No offer on every propose run** — assessment-gated.
- **No fully-headless auto-capture** — the human accept stays.
- **No corpus-quality rework** — the two deterministic validators (path/frontmatter),
  Bug/Knowledge track split, overlap-aware update-vs-create, lightweight single-pass
  mode, CONCEPTS.md vocabulary, and auto-memory scan are all deferred to separate `#29`
  roadmap issues. (These are real and valuable; they are a *corpus-quality* concern,
  distinct from this issue's *triggering* concern.)
- **No command→skill conversion** of compound (marginal; both are model-invocable).
- **No change to propose's compose/commit/push logic** beyond adding the post-create
  offer.

## Acceptance Criteria

- `compound.md` no longer contains the `<auto_invoke>`/`<trigger_phrases>` block, and the
  Step 0 auto-path `AskUserQuestion` confirmation gate is gone; a deliberate invocation
  proceeds with no blocking confirmation (the insufficient-context guard remains).
- `compound.md` frontmatter description no longer claims phrase auto-triggering and is
  reframed for honest model-proactive use.
- `README.md:164–165` and `README.md:286` no longer promise auto-triggering; wording
  matches actual behavior.
- `/ba:propose`, after a successful create **and only then** (never on `--describe-only`,
  never on a create/push failure), runs the reusable-learning assessment and surfaces the
  capture offer **only** on a positive judgment; it is silent on routine and uncertain
  ships.
- Accepting the offer runs `/ba:compound` in-session and returns a summary; declining is
  a single keystroke and proceeds to normal completion.
- The assessment's signals and its lean-silent posture are documented in `propose.md`,
  including that manual `/ba:compound` is the false-negative escape hatch.
- `.claude-plugin/plugin.json` `version` is bumped.
- The CLAUDE.md "never modify source files outside the staged diff" convention line and
  `propose.md`'s Guidelines carry the explicit `/ba:compound` hand-off exception, so
  behavior and convention agree.
- Verified once end-to-end that an accepted offer (or a manual run) creates
  `docs/solutions/<category>/<file>.md`, closing the cold loop for the first time.

## Open Questions

(none — all four design forks resolved in Phase 1 dialogue)

### Resolved Questions

- **Which command hosts the offer?** → `/ba:propose` (ship-time).
- **Nudge vs. headless?** → Nudge → one human accept runs it.
- **Scope: how much of the rework?** → Triggering only; corpus-quality deferred.
- **Offer every run, or after an assessment?** → Assessment-gated, silent when negative.
- **Posture when uncertain?** → Lean silent (precision).

## Documented Residuals

- Without lightweight single-pass mode (deferred), an accepted offer still fires
  compound's 5 subagents — heavier, but it is a deliberate one-click accept, acceptable
  for v1.
- The `docs/solutions/` entry is created *after* the PR is already open, so it will not
  be part of that PR; it can ride a follow-up commit or the next `/ba:propose`. (See the
  rejected "run compound before create" alternative for the coherence trade-off.)

## Convention Compliance

Checked 10 conventions — 7 aligned, 2 not-applicable/minor, 1 tension resolved.

- `ba:` command namespace, artifact paths, brainstorm section contract: **ALIGNED**
- Dry-run must not gate behind a menu (`propose.md:545`) — offer sits at Step 5e,
  `describe_only` exits at Step 4 before it: **ALIGNED**
- Apply-by-default posture — offer is additive, strictly post-completion, never gates the
  ship: **ALIGNED**
- Update README when commands/paths change; bump `plugin.json` version: **ALIGNED** (in AC)
- convention-checker gate is for brainstorms/plans, not `docs/solutions/` output — draft
  neither imposes nor drops a gate wrongly: **ALIGNED**
- AskUserQuestion 4-option limit — capture offer is a 2-option accept/decline: **ALIGNED**
- never-hide-ledger / U-ID / stack-base citation axes — offer lives at Step 5e and only
  *reads* the already-materialized `deviation_trailers`; no citation site on either axis
  needs updating: **ALIGNED.** (Plan-phase guard: keep the `propose.md` edit confined to
  Step 5e — if it drifts into Step 2a/2f/3.3 it re-enters both axes.)
- "Planning commands never write code" / "Documented Residuals" extra section: **N/A /
  minor** (additive prose section is permitted by the section contract).
- "Git workflow commands never modify source files outside the staged diff": **TENSION —
  RESOLVED.** The post-create, user-accepted `/ba:compound` hand-off writes to
  `docs/solutions/`. Resolved by user decision to **document the exception**: amend the
  CLAUDE.md convention line and mirror the carve-out in `propose.md`'s Guidelines (see the
  "Documented convention exception" decision and its acceptance criterion). Behavior and
  convention will agree; the chosen "accept runs it" design is preserved.

## Next Steps

→ `/ba:plan` to create the implementation plan
