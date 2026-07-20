---
title: "/ba:compound Ship-Time Capture — Fire at the Right Moment"
type: feat
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow; progress is git-derived
date: 2026-07-20
origin: docs/brainstorms/2026-07-19-ba-compound-ship-time-capture-brainstorm.md
detail_level: standard
tags: [compound, propose, knowledge, triggering, ship-time-capture, roadmap-52]
---

# /ba:compound Ship-Time Capture Implementation Plan

## Overview

`/ba:compound` never runs unless typed by hand, so compounding opportunities are lost —
`docs/solutions/` has never once been created in this repo. This plan lands three
coordinated, **triggering-only** changes: (1) strip the inert auto-trigger machinery and
friction gate from `compound.md`, (2) tell the truth about triggering in the frontmatter
and README, and (3) add an assessment-gated, lean-silent knowledge-capture offer to
`/ba:propose` at the exact ship moment the user says they never revisit. No hooks, no
corpus-quality rework, no change to propose's compose/commit/push logic beyond the
post-create offer (see brainstorm: `docs/brainstorms/2026-07-19-ba-compound-ship-time-capture-brainstorm.md`).

## Current State

- `commands/ba/compound.md:13-24` — inert `<auto_invoke><trigger_phrases>` body block (Claude
  Code never reads a command body before invocation; nothing scans conversation text — the
  block does nothing).
- `commands/ba/compound.md:34-38` — the Step 0 auto-path `AskUserQuestion` confirmation gate
  (friction on a path that can't actually fire).
- `commands/ba/compound.md:32-33` — the insufficient-context guard (correctness — **kept**).
- `commands/ba/compound.md:3` — frontmatter `description` falsely promising "auto-triggers on
  phrases like 'that worked'…".
- `commands/ba/compound.md:158` — stale guideline "Auto-trigger only fires during freeform
  conversation…".
- `README.md:164` — "Auto-trigger" bullet; `README.md:286` — "(or let it auto-trigger)" claim.
- `commands/ba/propose.md:713-720` — Step 5e Output (the `✓ <title> / <URL>` success print);
  `describe_only` already exits at `commands/ba/propose.md:545` (Step 4) before Step 5.
- `commands/ba/propose.md` Step 2 already materializes the exact signals the assessment needs:
  `proof` (2e, L289), `deviation_trailers` (2f, L300), `sensitive_paths_touched`/`breaking_signal`
  (2g, L316), `risk` (2h, L327), and `solutions` (2c, L227).
- `commands/ba/propose.md:29` — the "REVIEW_MODE touches exactly two confirmations" invariant
  (will be false once the offer adds a third interactive prompt in the default flow).
- `CLAUDE.md:96` — "Git workflow commands (`ba:propose`) … never modify source files outside
  the staged diff" (the sole verbatim location; propose.md expresses it only operationally).
- `.claude-plugin/plugin.json:3` — `"version": "0.33.0"`.
- `docs/solutions/` — **does not exist** (verified). The cold loop has never closed.

## Acceptance Criteria

- AC1: `commands/ba/compound.md` contains no `<auto_invoke>`/`<trigger_phrases>` block and no
  Step 0 auto-path `AskUserQuestion` confirmation gate; a deliberate invocation proceeds with no
  blocking confirmation. The insufficient-context guard remains.
- AC2: `commands/ba/compound.md` frontmatter `description` no longer claims phrase
  auto-triggering and is reframed for honest model-proactive use.
- AC3: `README.md:164` and `README.md:286` no longer promise auto-triggering; wording matches
  actual behavior.
- AC4: After a successful PR/MR **create** — and only then — `/ba:propose` runs the
  reusable-learning assessment and surfaces the capture offer **only** on a positive judgment; it
  is silent on routine, uncertain, already-captured, and **non-interactive** (scripted/headless,
  no answerer) ships. It never offers on `describe_only`, `edit_only`, `commit_push_edit`,
  `HOST=unknown`, or any commit/push/create failure.
    When 5d created a PR/MR and returned a URL (`ACTION == commit_push_create`), the offer is
    reachable; in every other terminal state it is unreachable. The offer adds the first
    `AskUserQuestion` to the default (`--review`-absent) flow, which is prompt-free/scriptable today —
    so a missing interactive answerer is a silence precondition, never a hang.
- AC5: Accepting the offer invokes `/ba:compound` (explicit path) in-session with a seeded
  context hint; the accept path then surfaces `/ba:compound`'s **own** completion summary **and its
  own Step 4 menu** (Continue/View/Other — unchanged by U1; a second, harmless prompt), and — if the
  seeded hint is judged thin — may hit compound's retained Step 0 insufficient-context guard (a
  possible second round-trip). Declining propose's offer is a single keystroke and proceeds to normal
  completion. A `/ba:compound` failure — or any exception anywhere in the offer block — never changes
  the ship's reported success or exit status.
- AC6: The assessment's signals and lean-silent posture are documented in `commands/ba/propose.md`
  — including that manual `/ba:compound` is the false-negative escape hatch — and the
  `propose.md:29` invariant is updated to classify the offer as non-blocking, mode-independent
  post-completion chrome (not a confirmation gate).
- AC7: `.claude-plugin/plugin.json` `version` is bumped to `0.34.0`.
- AC8: The `CLAUDE.md:96` "never modify source files outside the staged diff" convention line and
  a new `commands/ba/propose.md` Guidelines bullet both carry the explicit `/ba:compound`
  hand-off exception, so behavior and convention agree.
- AC9 (manual, post-merge): Verified once end-to-end that an accepted offer (or a manual run)
  creates `docs/solutions/<category>/<file>.md`, closing the cold loop for the first time. Scope: this
  live run covers only the file-creation behavior — the offer's *reachability and gating* are a static
  read-only property already asserted by U3's `Verify:` (ordering + windowed gate), not deferred here.

## What We're NOT Doing

- **No hooks / lifecycle wiring** — phrase detection is mechanically impossible; no `Stop`/`SessionEnd`
  nudge hook.
- **No offer on `/ba:review`, and not on both** — propose only for v1 (avoids the double-offer when
  you review then propose the same work).
- **No offer on `commit_push_edit` / `edit_only` / `HOST=unknown` / `describe_only`** — the offer is
  create-only. `edit_only` ships no code; `commit_push_edit` re-ships to an existing PR and would
  re-offer across iterative runs (the intra-command echo of the double-offer risk the brainstorm
  cited); `HOST=unknown` produces no PR URL. All edit/unknown ships stay covered by the
  now-frictionless manual `/ba:compound`.
- **No offer on every propose run** — assessment-gated, silent when negative/uncertain/already-captured.
- **No fully-headless auto-capture** — the single human accept is the gate.
- **No corpus-quality rework** — the two deterministic validators (path/frontmatter), Bug/Knowledge
  track split, overlap-aware update-vs-create, lightweight single-pass mode, CONCEPTS.md vocabulary,
  and auto-memory scan are all deferred to separate `#29` roadmap issues.
- **No command→skill conversion** of compound.
- **No suppression machinery inside compound's own Step 4 menu** — the accept hand-off surfaces
  `/ba:compound`'s own completion summary (its Step 4). We do not add a programmatic-invocation flag
  to compound in this slice.
- **No change to propose's compose/commit/push logic** beyond adding the post-create offer, and
  **no touching Steps 2a/2f/3.3** — the edit is confined to the end of Step 5 (plan-phase guard from
  the brainstorm's convention analysis).

## Proposed Solution

Three independent prompt-file edits plus release hygiene. `compound.md` and the README changes are
pure deletions/reframes. The load-bearing change is the `/ba:propose` offer: a terminal,
non-blocking block appended **after** Step 5e's success print, gated to the create path by the one
signal that already proves a successful create — the PR/MR URL 5d returned. It reads
already-materialized orchestrator state **read-only** (`deviation_trailers`, `risk`, `proof`,
`solutions`), makes a cheap best-effort "did this carry a reusable learning?" judgment, and — only on
a positive judgment — surfaces one 2-option nudge. Accepting invokes `/ba:compound` on its explicit
(proceed-directly) path with a seeded context hint; declining is one keystroke. The assessment is the
only non-deterministic element in an otherwise deterministic command, so it is quarantined to
post-completion chrome that never feeds `CompositionInputs` and never affects the ship.

## Technical Considerations

- **Gate on the 5d URL, not the word "create".** Binding the offer to "5d emitted a PR/MR URL and
  `ACTION == commit_push_create`" is more robust than re-checking HOST/ACTION separately: it
  automatically excludes `HOST=unknown` (no URL) and every failure exit (non-zero, no URL).
- **Assessment is best-effort and read-only.** It reads orchestrator-side state materialized in Step
  2 and the conversation; it mutates nothing and is never referenced by composition. This is the
  containment that makes a fuzzy judgment tolerable inside a determinism-first command.
- **Context-hint seeding closes the resumed-session gap.** The assessment can fire positive on a
  git-derived signal (a `Deviation (U<n>)` trailer) whose narrative is absent from the current
  conversation — exactly the handoff/resumed session this feature targets. propose passes what it
  already holds (composed motivation, deviation-trailer texts, `risk`/`proof`, diff summary) as
  `/ba:compound`'s context hint so compound's insufficient-context guard passes.
- **Failure isolation.** The offer runs after the PR is open and success has printed. Nothing past
  Step 5e may change the ship's exit status; an accepted-but-failed compound degrades to "PR is live;
  capture failed — run `/ba:compound` manually."

## System-Wide Impact

- **Interaction graph**: The offer is terminal chrome after Step 5e. It reads orchestrator state
  read-only (`deviation_trailers` 2f, `risk` 2h, `proof` 2e, `solutions` 2c) and, on accept, invokes
  `/ba:compound`, which dispatches its 5 parallel subagents and writes one file under
  `docs/solutions/`. The accept path is therefore two chained prompts, not one: propose's Yes/No, then
  `/ba:compound`'s own Step 4 menu (and, if the seeded hint is thin, compound's Step 0 guard) — see AC5.
- **Error propagation**: `/ba:compound` failure is isolated — surfaced as a degraded note, never
  unwinding the push/PR or changing exit status (AC5).
- **State lifecycle risks**: The captured doc is written **after** the push, so it is an untracked
  file not in the just-opened PR. On the *next* `/ba:propose`, Step 5a stages files from the diff vs
  base and would sweep it into an unrelated PR — so the post-hoc summary must explicitly tell the user
  the file is uncommitted and not in this PR (see U3 Test scenarios). This is the brainstorm's
  documented residual made observable.
- **Citation axes (U-ID / stack-base / never-hide-ledger)**: No citation site on any axis needs
  updating. The offer lives at Step 5e and only *reads* already-materialized `deviation_trailers`; it
  mints/redefines nothing (confirmed by the brainstorm's convention analysis and the convention-checker).
  Plan-phase guard: if the propose edit ever drifts into Step 2a/2f/3.3 it re-enters those axes — keep
  it at the end of Step 5.
- **propose.md:29 internal invariant**: becomes false without amendment (the offer is a third
  interactive `AskUserQuestion` in the default, `--review`-absent flow). U3 updates it to carve out the
  non-blocking, mode-independent post-completion offer.

## Implementation Approach

### Changes Required

**File**: `commands/ba/compound.md`

#### U1 — Strip inert auto-trigger, drop the friction gate, reframe the description

- Delete the entire `## Auto-Invoke` section and its `<auto_invoke><trigger_phrases>` body block
  (currently L13–24).
- In `## Step 0: Pre-flight Check`, delete item 3 (the "If auto-triggered: present a confirmation
  using AskUserQuestion…" gate, currently L34–38). **Keep** items 1–2 (the scan + insufficient-context
  guard) verbatim. Simplify item 4 so it reads as the single path: a deliberate invocation (manual or
  offer-driven) proceeds directly once a problem/solution pair is identifiable.
- Delete the now-stale guideline "Auto-trigger only fires during freeform conversation — suppress
  during active /ba: command flows" (currently L158).
- Reframe the frontmatter `description` (L3) away from the false phrase-trigger promise toward honest,
  model-proactive wording. Decision (not literal file text): a single sentence in the shape of "Document
  a recently solved problem to `docs/solutions/` so future brainstorm/plan sessions can reuse it; use
  after solving a non-trivial, verified problem." No "auto-triggers on phrases" clause.

Test scenarios:
- A deliberate `/ba:compound` run with sufficient context dispatches subagents immediately, with no
  intervening confirmation prompt (Covers AC1).
- A `/ba:compound` run with no identifiable problem/solution pair still stops and asks for a context
  hint (guard retained) (Covers AC1).
- The rendered command listing description no longer advertises phrase auto-triggering (Covers AC2).

Verify: `test $(grep -Eic 'auto[_-]?invoke|trigger_phrases|auto-trigger(ed|s)?|if auto-triggered' commands/ba/compound.md) -eq 0 && grep -q 'insufficient context' commands/ba/compound.md`
(The broadened pattern also catches "auto-**triggered**" in the Step 0 gate AC1 removes and
"Auto-trigger only fires" in the stale guideline — the narrow three-alternative pattern let a
half-edit leaving both pass as green.)

---

**File**: `README.md`

#### U2 — Correct the auto-trigger claims

- Rewrite the "Auto-trigger" bullet (L164) into an honest line, e.g. a "Model-proactive /
  frictionless manual" bullet describing that a deliberate run proceeds directly and that ship-time
  `/ba:propose` may offer capture — no phrase-trigger promise. Keep the "Explicit invocation" bullet
  (L165) as-is.
- In the Knowledge Compounding narrative (L286), remove "(or let it auto-trigger)" so the sentence
  reads as run-`/ba:compound`-when-you-solve-something, optionally offered at ship-time by
  `/ba:propose`.
- Add a bullet to the `/ba:propose` feature list (README:183–201) for the new user-visible behavior,
  e.g. "**Ship-time capture offer** — after a successful create, a best-effort check may offer to run
  `/ba:compound`; silent otherwise." Without it, a reader scanning propose's own feature list for
  "does this ever prompt me about something extra?" won't find it (the change-amplification miss the
  "update README when commands change" convention exists to catch).

Test scenarios:
- README no longer contains the string "auto-trigger" in the compound context; the `/ba:compound`
  section and knowledge-compounding narrative still describe how capture happens (Covers AC3).
- The `/ba:propose` feature list carries a ship-time-capture-offer bullet (Covers AC3).

Verify: `test $(grep -ci 'auto-trigger' README.md) -eq 0 && grep -qi 'ship-time capture\|capture offer' README.md`

---

**File**: `commands/ba/propose.md`

#### U3 — Add the assessment-gated ship-time capture offer after Step 5e

Append a new terminal block (a `### 5f. Ship-time capture offer` subsection, physically last in Step 5,
after 5e's `✓/URL` print) that:

1. **Gates** on: 5d emitted a PR/MR URL AND `ACTION == commit_push_create`. Unreachable for
   `describe_only` (exits Step 4), `edit_only`/`commit_push_edit` (edit paths), `HOST=unknown` (no URL),
   and every failure exit. State the predicate explicitly as "offer iff 5e printed a `✓ <url>` and the
   action created a new PR/MR."
2. **Silence preconditions** (any true → stay completely silent, no output): the session is
   non-interactive (scripted/headless, no answerer — checked first, so the added prompt never hangs a
   default-mode scripted ship); the change is routine; the judgment is uncertain; or `solutions`
   (Step 2c) is non-empty (the learning is already documented and in the PR — a high-precision negative
   signal that costs nothing).
3. **Assessment** (best-effort, blended — not a rigid rubric; read-only over orchestrator state +
   conversation): weigh (a) `deviation_trailers` from 2f (strongest — "reality diverged from the plan,
   here's why"); (b) a problem→investigation→fix arc in the conversation; (c) commit type/motivation (a
   `fix:` for a gotcha/workaround vs a clean `feat:` or docs/config-only change); (d) lightly,
   `risk`/`proof`/`sensitive_paths_touched`. Lean **silent** — precision over recall.
4. **Offer** (only on positive judgment): a 2-option `AskUserQuestion` "Document this learning?"
   (Yes / No, No recommended-neutral). Accept → invoke `/ba:compound` on its explicit path, passing a
   **seeded context hint** (composed motivation + deviation-trailer texts + `risk`/`proof` + one-line
   diff summary) so compound's insufficient-context guard passes in resumed sessions. Decline → one
   keystroke, proceed to normal completion (nothing remains — success already printed).
5. **Failure isolation**: a `/ba:compound` failure (subagent failure, insufficient context, write
   failure) leaves the ship reported successful (exit unchanged); degrade to "PR is live; capture failed
   — run `/ba:compound` manually."
6. **Post-hoc summary** on accept: surface `/ba:compound`'s own completion summary, and explicitly note
   the created doc is **uncommitted and not in this PR** (commit separately or it rides your next
   `/ba:propose`).
7. **Document** the signals, the lean-silent posture, and that manual `/ba:compound` is the
   false-negative escape hatch. **Amend `propose.md:29`** ("REVIEW_MODE touches exactly two
   confirmations") to carve out this offer as non-blocking, mode-independent post-completion chrome — not
   a REVIEW_MODE-gated confirmation.

**Code-shape decision:** the gate/silence/offer control flow is the load-bearing decision of this
plan, and re-deriving it from prose alone plausibly produces a *wrong* structure (firing on edit paths,
gating on the word "create", or letting a compound failure taint the ship). The exact predicate +
ordering is anchored to the brainstorm's Key Decisions and the spec-flow gating matrix:

```
# 5f. Ship-time capture offer — runs only after 5e printed "✓ <url>".
# The ENTIRE block is failure-isolated: any exception anywhere below degrades to the
# "PR is live" message; nothing here can change the ship's exit status.
if ACTION != commit_push_create or created_pr_url is None:
    return                      # edit_only / commit_push_edit / describe_only / HOST=unknown → unreachable
if not interactive_session():   # AC4: default-mode propose may run scripted/headless
    return                      # no answerer for the offer → silent, never hang
try:
    if solutions:               # Step 2c non-empty → already documented & in the PR
        return                  # silent
    if not assess_reusable_learning(deviation_trailers, conversation_arc,
                                    commit_type, risk, proof):
        return                  # routine or uncertain → silent (lean-silent = precision)
    answer = AskUserQuestion("Document this learning?", options=[Yes, No])  # No = one keystroke
    if answer != Yes:
        return                  # decline → normal completion; ship already succeeded
    run("/ba:compound", context_hint=seed(motivation, deviation_trailers, risk, proof, diff_summary))
    # NOTE: compound prints its OWN completion summary AND its own Step 4 menu (see AC5) —
    # a possible second insufficient-context prompt is also compound's, not propose's.
    print("captured — doc is uncommitted and NOT in this PR")
except Exception:
    print("PR is live; capture failed — run /ba:compound manually.")   # ship stays successful
```

This is a shape sketch, not literal command text — the file is a prose spec; the block fixes the
branch/return ordering and, critically, draws the failure-isolation boundary around the **whole** 5f
body (assessment + prompt + invoke), not just the `/ba:compound` call — an exception in the
assessment or the `AskUserQuestion` itself must degrade identically, since the PR is already open.

Test scenarios:
- A `commit_push_create` run that opened a PR, on a change with a deviation trailer / a clear
  problem→fix arc, surfaces exactly one "Document this learning?" 2-option prompt after the `✓/URL`
  line (Covers AC4).
- A routine `feat:`/docs-only `commit_push_create` produces no offer and no extra output (silent)
  (Covers AC4).
- A `--describe-only` run prints the preview and exits at Step 4 with no offer (Covers AC4).
- An `edit_only` run (description-only rewrite, no code) and a `commit_push_edit` run reach the end
  with no offer (Covers AC4).
- A `HOST=unknown` ship (commit+push succeed, body printed for manual paste) produces no offer
  (Covers AC4).
- Accepting the offer invokes `/ba:compound` with a seeded context hint and returns a summary that
  names the uncommitted, not-in-PR doc; declining takes one keystroke and completes normally (Covers AC5).
- A `commit_push_create` where Step 2c `solutions` is non-empty stays silent (already captured)
  (Covers AC4).
- An accepted offer whose `/ba:compound` fails still reports the ship as successful and tells the user
  to run compound manually (Covers AC5).
- A genuinely ambiguous change (a `fix:` with no deviation trailer and no clear problem→fix arc) is
  judged **uncertain** and stays silent — the hardest of the three silence branches to get right under
  the lean-silent posture (Covers AC4).
- A default-mode (`--review`-absent) scripted/headless `commit_push_create` produces no offer and
  never hangs waiting for an answer (Covers AC4).

Verify: `B=$(grep -A40 '^### 5f' commands/ba/propose.md); printf '%s' "$B" | grep -q 'Document this learning' && printf '%s' "$B" | grep -q 'commit_push_create' && grep -Eq 'lean.silent' commands/ba/propose.md && grep -q 'post-completion chrome' commands/ba/propose.md && [ "$(grep -n '^### 5f' commands/ba/propose.md | head -1 | cut -d: -f1)" -gt "$(grep -n '^### 5e' commands/ba/propose.md | head -1 | cut -d: -f1)" ]`
(Block-scoped + ordering-aware: captures the `### 5f` block and asserts the offer prompt **and** the
`commit_push_create` gate both live **inside it** (co-located regardless of line order), plus the
lean-silent posture and the amended `propose.md:29` invariant ("post-completion chrome") globally, and
a `### 5f` heading placed **after** `### 5e`. A mis-gated, ungated, or mis-placed offer fails instead
of passing on bare string presence.)

---

**File**: `CLAUDE.md` and `commands/ba/propose.md` (Guidelines)

#### U4 — Document the `/ba:compound` hand-off convention exception

- Amend `CLAUDE.md:96` so the "never modify source files outside the staged diff" line states the
  exception: propose *itself* never writes source; the sole exception is the post-create,
  user-accepted `/ba:compound` **hand-off**, which writes only to `docs/solutions/`, after the PR is
  open, and never as part of the pushed diff. Word it as "the user-accepted `/ba:compound`
  **hand-off exception**", and append the file's own house-style self-announcing clause — "(mirrored
  in `commands/ba/propose.md` Guidelines — keep in sync)" — matching how every other mirrored
  convention in CLAUDE.md (never-hide-ledger, U-ID/stack-base axes, code-shape label) declares its
  mirror at the point of edit, rather than relying on a future editor knowing the grep token.
- Add a mirrored bullet to `commands/ba/propose.md`'s `## Important Guidelines` (currently L737–751)
  carrying the same `/ba:compound` **hand-off exception** carve-out, so behavior and convention agree
  in both places.
- Use the distinctive backtick-free phrase "hand-off exception" verbatim in both edits (not a loose
  two-word `compound … hand-off` co-occurrence) so the carve-out is precisely greppable and the two
  sites stay findable together.

Test scenarios:
- Both `CLAUDE.md` and `commands/ba/propose.md` describe the `/ba:compound` hand-off exception as the
  one permitted source-write exception for propose, and the CLAUDE.md line self-announces its mirror
  (Covers AC8).

Verify: `grep -qi 'hand-off exception' CLAUDE.md && grep -qi 'hand-off exception' commands/ba/propose.md`

---

**File**: `.claude-plugin/plugin.json`

#### U5 — Bump the plugin version

- Bump `version` from `0.33.0` to `0.34.0` (the auto-update cache key — every shipped change needs a
  bump).

Test scenarios:
- `.claude-plugin/plugin.json` reports version `0.34.0` (Covers AC7).

Verify: `grep -q '"version": "0.34.0"' .claude-plugin/plugin.json`

## Dependencies & Risks

- **U1 must land with U3.** propose's accept path invokes `/ba:compound` on its explicit
  (proceed-directly) path; if U1 (removal of the auto-path confirmation gate) did not land in the same
  change, an accept could double-prompt. Because both edits ship in one PR, ordering within the PR is
  irrelevant — but they must not be split across releases.
- **Prompt-only, no runtime harness.** These are command-prompt edits; there is no test suite. Per
  established practice, prompt-only changes ship on a dry-run (`/ba:propose --describe-only`); the full
  live end-to-end run (AC9) is a manual, post-merge acceptance in a fresh session (a running session
  executes the command body captured at session start, so live behavior must be checked after reload in
  a new session).
- **Assessment quality is inherently fuzzy and unobservable.** A true negative (correct silence) is
  indistinguishable from a missed positive; there is no preview/trace for the silent path (mirror of
  Step 3's deliberate no-`trace` trade-off). Accepted — the manual escape hatch bounds the downside.

## Documented Residuals

- An accepted offer still fires compound's 5 subagents (heavier), acceptable for a deliberate
  one-click accept until lightweight single-pass mode lands (deferred to `#29`).
- The `docs/solutions/` entry is created *after* the PR is open, so it is not in that PR; it rides a
  follow-up commit or the next `/ba:propose` (whose Step 5a would stage it). The summary names this.
- `HOST=unknown` ships (no PR URL) get no offer — a silent capability hole for self-hosted-without-
  escape-hatch users, covered by manual `/ba:compound`.
- Resumed/handoff sessions: a git-derived signal may fire the assessment positive while the
  conversation arc is absent, yielding a thin doc even on a correct judgment. Context-hint seeding is
  the partial mitigation.
- The assessment is intentionally non-deterministic and the silent path is unobservable.

## Convention Compliance

- [x] Auto-trigger removal completeness (all six live references covered) — aligned
- [x] README sync on changed command behavior — aligned (U2)
- [x] `plugin.json` version bump — aligned (U5)
- [x] U-ID / stack-base / never-hide-ledger citation axes — aligned (no citation site changes; offer
  only reads already-materialized `deviation_trailers` at Step 5e)
- [x] `propose.md:29` internal invariant kept self-consistent — aligned (U3 carves out the offer)
- [x] AskUserQuestion 4-option limit — aligned (offer is 2-option)
- [x] Plan artifact path/filename convention — aligned
- [x] Each unit carries Test scenarios + one code-matchable read-only `Verify:` — aligned
- [x] "Git workflow commands never modify source files outside the staged diff" — **justified
  override**: the accepted `/ba:compound` hand-off writes only to `docs/solutions/`, after the PR is
  open, never in the pushed diff; documented at the owning site (`CLAUDE.md:96`) and mirrored in
  propose.md Guidelines (U4)
- [x] "Planning commands never write code" — N/A (this plan documents edits applied by `/ba:execute`;
  the targets are command prompts)

## Sources & References

- Origin brainstorm: `docs/brainstorms/2026-07-19-ba-compound-ship-time-capture-brainstorm.md` — key
  decisions carried forward: host=`/ba:propose` at ship-time after a successful create; nudge → single
  human accept runs compound → summary; assessment-gate + lean-silent posture; the four blended signals;
  triggering-only scope with corpus-quality deferred; documented convention exception.
- Research: `docs/research/2026-07-18-ba-compound-auto-trigger-and-ce-capture-research.md` — why
  auto-trigger is mechanically impossible; how `ce-compound` retreated to frictionless-manual +
  human-gated capture offers.
- `commands/ba/compound.md:3,13-24,32-38,158` — targets for U1/U2.
- `commands/ba/propose.md:29,227,289-337,545,713-720,737-751` — Step 2 signal sources, describe_only
  exit, Step 5e, Guidelines, and the invariant amended by U3/U4.
- `CLAUDE.md:96` — convention line amended by U4.
- `.claude-plugin/plugin.json:3` — version bumped by U5.
