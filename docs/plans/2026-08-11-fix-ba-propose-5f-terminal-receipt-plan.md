---
title: /ba-propose terminal capture receipt — hoist the 5f predicate into 5e
type: fix
plan_schema: 2
status: active  # human-authored only — /ba-execute ignores this for control flow; progress is git-derived
date: 2026-08-11
origin: docs/brainstorms/2026-08-11-ba-propose-5f-terminal-receipt-brainstorm.md
detail_level: standard
tags: [ba-propose, ba-compound, prompt-authoring, observability]
---

# /ba-propose terminal capture receipt Implementation Plan

## Overview

`/ba-propose` Step 5f — the ship-time `/ba-compound` capture offer — is specified as a required
terminal step but routinely does not run, and its own four trace lines cannot witness the skip
because they are printed by the prose being skipped. The fix moves the fire/suppress predicate into
Step 5e and merges its outcome into a single three-line terminal receipt, so the capture disposition
rides the line the run exists to emit instead of trailing it as an optional step.

**The experiment runs before the rewrite.** U1 scores the proposed mechanism against a one-sentence
alternative; U2's rewrite is gated on that verdict. Building U2 first would authorize discarding it
after it was already built.

Resolves #85. Standalone from #81.

## Current State

- `skills/ba-propose/SKILL.md:720-733` — **5e** prints a self-contained two-line block
  (`✓ <title>` / `  <url>`) plus an unparseable-URL guard that hands 5f a trace obligation.
- `:735-887` — **5f**, ~150 lines: a two-part gate, four ordered silence preconditions each emitting
  `5f: capture offer suppressed — <token>`, a best-effort assessment, the offer, and a `try` around
  assessment + prompt + invoke.
- `:884-887` — the self-referential closing claim: each silent path "leaves a one-line reasoned
  trace, so a **skip** … is distinguishable from a **correct silence**."
- `:30` — asserts 5f "gates on its own predicate (5e printed `✓ <url>` and
  `ACTION == commit_push_create`)" and "Step 5 is not complete until 5f has *run*".
- `:572` — the Step 5 action table renders `5e (output) → 5f (capture offer)` as two output stages.
- `:875` — claims "the `try` boundary is unchanged … it still wraps only the assessment, prompt, and
  invoke".
- `:876-883` — the print-infallibility model, justified by 5e having "already wrote to it
  microseconds earlier".
- `README.md:169` — "otherwise it **stays quiet**, emitting a one-line suppression trace naming why".
- `README.md:208` — "**silent** on routine, uncertain, already-captured, and non-interactive ships".
- `.claude-plugin/plugin.json` — `0.45.0`. Working tree carries an uncommitted
  `skills/ba-review/SKILL.md` sanitization (external-reviewer example renamed off a private-repo
  agent name) awaiting this ship's bump.
- No Claude Code hooks exist in this repo; automation is CI-only via `scripts/check-invariants.mjs`
  (six checks).

## Acceptance Criteria

- AC1: Every route that prints a 5e success line emits a contiguous three-line block whose third
  line is `capture: <value>`, where `<value>` is one of exactly six literals.
  - When the URL is unresolved, the URL line is omitted and the block is two lines — the `✓` line and
    the `capture: suppressed — ship-url-unresolved` line. This is the one legitimate sub-three-line
    receipt, and it is distinguished from a partial print by the `capture:` line being **present**: a
    genuine partial print emits the `✓` line alone.
- AC2: The six-value enum is closed and exhaustive: `judged-reusable`,
  `suppressed — ship-url-unresolved`, `suppressed — non-interactive`,
  `suppressed — already-captured`, `suppressed — judged-not-reusable`, `unavailable`.
- AC3: The offer path's line 3 states a decision already made (`judged-reusable`), never a
  prediction — so no later failure of the `AskUserQuestion` or the `/ba-compound` invoke can
  contradict a receipt already flushed.
- AC4: A resolver exception prints `capture: unavailable`, still prints the `✓` line, and leaves the
  ship's exit status zero. The ground for the exit-status guarantee is that **exit status is already
  determined before 5e runs at all** — 5c's push and 5d's create decide it, and 5e/5f contain no
  statement that can alter it. The retired circular ground (5e's earlier write proves stdout healthy)
  is not restated.
- AC5: The retired token `5f: capture offer suppressed` appears nowhere in `skills/`.
- AC6: All five in-file mirror sites are changed in one unit, so no intermediate commit states two
  contradictory predicate owners: `:30`, `:572`, `:720-733`, `:737-742`, `:744-752`.
- AC7: `:729-733`'s standard is amended to scope its observability guarantee to routes that reach
  5e, so the file stops asserting a guarantee the `HOST=unknown` route does not satisfy.
- AC8: `README.md:169` and `:208` no longer describe suppression as staying quiet or being silent.
  `README.md:145` ("stays silent", about `/ba-review-plan`) is untouched.
- AC9: `.claude-plugin/plugin.json` reads `0.46.0` — one bump for this ship, covering the co-shipped
  `skills/ba-review/SKILL.md` sanitization.
- AC10: `node scripts/check-invariants.mjs` reports PASS on all six checks.
- AC11: The three-arm fixture A/B produces a recorded score table with a **pre-committed decision
  rule**: the one-sentence arm wins if it produces the `capture:` line on all four fixtures while
  touching ≤ 2 lines of prose; the hoisted arm wins if the one-sentence arm misses the line on any
  fixture. Any other outcome is inconclusive and returns to a decision round rather than defaulting
  to either arm.
- AC12: The A/B's score table is captured somewhere durable — the ship's PR/MR body — so AC11 stays
  checkable by a later reader rather than living only in an agent's ephemeral output.
- AC13: The rewrite unit does not begin until AC11's verdict is recorded.

## What We're NOT Doing

Inherited from the origin brainstorm:

- Changing the assessment's signals or weights (`:828-839`). Precision stays the accepted residual.
- #58's removal of same-turn self-verification.
- Any Claude Code hook.
- Relocating 5f's prose into a reference file (#81).
- A CI check for the receipt — `load-site-mirror` needs two byte-identical blocks and there is one
  emitter.
- The edit paths. `commit_push_edit`, `edit_only`, `describe_only` stay traceless.
- Reopening which command hosts the offer (#52 settled it).

Decided during planning:

- **No Failure Modes row.** Spec-flow proposed adding one; the origin never asked for it, its
  recovery text already exists verbatim at `:874`, and `## Failure Modes:894` already carries a
  `HOST=unknown` row. Dropped as scope growth rather than folded in silently.
- **No new `CLAUDE.md` bullet for the enum.** Review pushed back that the "single emitter" reasoning
  answers the wrong question — the risk is single-*description*-site, and AC6 proves there are seven.
  The bullet still isn't the remedy; the fan-out is instead named as a recorded cost in
  Dependencies & Risks, and U2 carries an in-file pointer naming 5e as canonical.
- **`HOST=unknown` stays un-receipted.** The route never reaches 5e and #52 deliberately excluded
  unknown-host ships. AC7 amends the prose rather than adding a fifth token.
- **A resolver exception forecloses capture for that ship**, with no retry. Accepted as the cost of
  graceful degradation; manual `/ba-compound` is the escape hatch.

## Proposed Solution

Resolve the predicate in **5e only** — not "5d/5e". `ship-url-unresolved` is unknowable in 5d, whose
contract ends at "create exited 0 and `CREATED_PR_URL` was captured"; the empty-or-malformed judgment
belongs to 5e's existing guard. One resolver, one emit site, one contiguous block.

What the change actually buys, stated precisely so no acceptance criterion overclaims: **co-location,
not a guarantee.** A three-line block printed by 5e prose is still absent if that prose is skipped.
The gain is that line 3 rides the URL line the model reliably prints, so the predicted failure shifts
from "an entire terminal step vanished with no trace" to "printed 2 of 3 lines" — externally
detectable, and the thing AC1 pins.

That admission is also why U1 runs first. If a single sentence achieves the same co-location, the
resolver, the second isolation boundary and the five-site rewrite are unearned.

## Technical Considerations

**Ordering.** Every assessment input is settled well before 5e: `deviation_trailers` (2f), `risk`
(2h), `proof` (2e), `sensitive_paths_touched` (2g), `solutions` (2c), commit type (Step 3), and the
conversation arc (ambient, only grows). No input is read before it materializes.

**Accepted on the record:** the resolver now sits between PR creation and the user seeing the URL, so
a slow assessment delays the printed URL. The `try` guards a *thrown* exception, not a hung
assessment — there is no timeout, and a hang stalls the whole receipt rather than just line 3.
Accepted rather than mitigated: a timeout is machinery this defect does not justify, and the
assessment reads only already-materialized state.

**`already-captured` is keyed on a user choice, not a fact.** `solutions` holds the entries the user
*accepted* at 2c; choosing "Skip all" yields an empty tuple even when `docs/solutions/` files ride
the PR. Pre-existing, unchanged here, but now printed on every affected ship. Noted, not fixed.

**`proof=visual` and 5d's re-extract** are inert on the create path — 2d sets `preserved_blocks = ()`
for `commit_push_create` with no open PR (`:288`) — so the resolver sitting on the same side of 5d as
the re-extract introduces no staleness.

## System-Wide Impact

- **Interaction graph**: 5e gains a resolver; 5f becomes its consumer. `/ba-compound` stays invoked
  from 5f, which keeps `CLAUDE.md`'s in-run-continuation criterion true and `:908`'s hand-off pointer
  accurate — so no `disable-model-invocation` flag moves.
- **Error propagation**: two isolation boundaries now exist where one did. The resolver's exception
  degrades to `capture: unavailable`; 5f's existing `try` still degrades the prompt/invoke path to
  "PR is live; capture failed". URL validity is checked **outside** the resolver's boundary so
  `ship-url-unresolved` always wins over `unavailable` — and because that check returns before the
  `try`, the two cannot both fire, making the precedence structural rather than a tie-break rule.
- **State lifecycle risks**: none. The resolver is read-only and mutates nothing; no git-derived
  state is added, so neither the U-ID nor the stack-base axis is touched.

## Implementation Approach

### Changes Required

### U1 — Run the three-arm fixture A/B, and record the verdict

Per `.claude/agent_docs/prompt-authoring.md:73-93`: four fixtures with planted ground truth covering
the create-offer, create-suppressed, unparseable-URL, and `HOST=unknown` routes; three conditions
(`main` / the hoisted receipt / the one-sentence arm that states the receipt contract once in the
Step 5 dispatch table and changes nothing structural); one subagent per cell at the session model,
given the spec excerpt only and no repo access; scored on what it fixes **and** what it costs.

Decision rule is pre-committed per AC11 — the one-sentence arm wins on all four fixtures at ≤ 2 lines
of prose; the hoisted arm wins if the one-sentence arm misses any fixture; anything else is
inconclusive and returns to a decision round. Score table lands in the ship's PR/MR body (AC12).

Per `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`,
attribute every verdict to a specific source sentence or mark the cell inconclusive — the caller's
global `CLAUDE.md` loads into subagents and has already contaminated one baseline in this repo.

**If the one-sentence arm wins, U2 is not built.** Ship the sentence, keep U3 and U4, and record the
outcome on #85.

**This unit is commit-tag-only.** No code-matchable, read-only `Verify:` exists: the A/B is a runtime
procedure over subagents with no repo access, its output is a score table, and no fixtures are
committed to this repo. It resolves to `done` only via its `U1` commit subject.

Test scenarios:
- The hoisted arm emits the `capture:` line on fixtures where `main` omits it entirely (Covers AC11)
- The one-sentence arm is scored on the same four fixtures against the pre-committed rule, not assumed to lose (Covers AC11)
- Each cell's verdict cites the sentence that produced it, or is marked inconclusive (Covers AC11)
- The score table is readable in the PR/MR body after the fact (Covers AC12)

**File**: `skills/ba-propose/SKILL.md`

### U2 — Move the predicate to 5e and make the receipt its third line

Gated on U1's verdict (AC13). One unit owns every site in this file, because AC6 forbids an
intermediate commit in which the file names two predicate owners. Concretely:

- **5e (`:720-733`)** — replace the two-line block with the three-line receipt; `✓ <title>` first,
  URL second, `capture:` third. State the enum as closed. Amend the guard paragraph per AC7 so its
  observability standard applies to routes reaching 5e. Carry a one-line pointer naming 5e as the
  canonical enum site and listing its restatements (`:30`, `:572`, `:737-742`, `:744-752`,
  `README.md:169`/`:208`) so a maintainer landing elsewhere can find the source.
- **5f (`:735-887`)** — shrink to a dispatch: on `judged-reusable`, fire the existing
  `AskUserQuestion` and keep the existing accept-path outcome lines (`:789-792`) unchanged. **Every
  other resolved value, including the unresolved-URL route's, is a no-op** — one branch, not five.
  Delete the four `5f: capture offer suppressed` emit sites (the resolver now owns them) and the
  self-referential closing paragraph at `:884-887`. Reverse the offer-path rule at `:780`/`:841-855`:
  the widget is no longer its own trace.
- **Rewrite the `**Code-shape decision:**` block (`:744-752`)** — its justification ("the exact
  predicate + ordering + per-path trace is fixed by this sketch") stops describing 5f once the
  predicate leaves. The label string stays byte-identical; only the rationale and sketch change.
- **Repair two now-invalid arguments** — `:875`'s "the `try` boundary is unchanged" is false once the
  assessment moves out. `:876-883`'s print-infallibility rests on 5e having already written to
  stdout, which is circular once the receipt *is* the first write; replace it with AC4's ground —
  exit status is fixed by 5c/5d before 5e runs, so no print in 5e or 5f can alter it.
- **`:30`** — remove "gates on its own predicate"; the invariant becomes "the receipt printed", not
  "5f has run". **`:572`** — the action table stops rendering 5e and 5f as two output stages.
- **`:908`** — confirmed unchanged (the `/ba-compound` invocation stays in 5f).
- Record `interactive_session()` as deliberately model-judged: per the trust gradient this is
  steering, not a machine boundary, and one line saying so prevents a future reviewer flagging it as
  a dead branch under `prompt-authoring.md:59-60`.

**Code-shape decision:** the resolver's ordering is the load-bearing decision and re-deriving it from
prose plausibly produces a wrong structure — URL validation inside the exception boundary (making
`ship-url-unresolved` unreachable and `unavailable` win), the interactivity check after the
assessment (paying for a judgment that cannot be offered), or `judged-reusable` restored as a
forward-looking promise. Anchors to the origin brainstorm's receipt contract; the enum literals are
that contract and are not paraphrased.

```
# 5e. Output — one contiguous receipt. Line 3's value set is CLOSED (six literals).
# CANONICAL SITE for the enum. Restated at :30, :572, :737-742, :744-752, README:169/:208 —
# update together; no CI check pins this.
print(f"✓ {title}")
if is_url(CREATED_PR_URL): print(f"  {CREATED_PR_URL}")

# Validity is judged HERE — empty OR malformed — outside the resolver's exception boundary, and it
# RETURNS before the try, so ship-url-unresolved and unavailable can never both fire.
if not is_url(CREATED_PR_URL):
    print("  capture: suppressed — ship-url-unresolved"); goto 5f_dispatch(decision=None)

try:                                     # resolver boundary #1 → degrades to `unavailable`
    if not interactive_session():         # model-judged; deliberately unspecified (steering)
        decision = "suppressed — non-interactive"
    elif solutions:                       # 2c: entries the user ACCEPTED, not files on disk
        decision = "suppressed — already-captured"
    elif not assess_reusable_learning(deviation_trailers, conversation_arc,
                                      commit_type, risk, proof):
        decision = "suppressed — judged-not-reusable"   # negative OR uncertain → lean-silent
    else:
        decision = "judged-reusable"      # a DECISION, not a promise: no later failure falsifies it
except Exception:
    decision = "unavailable"              # exit status was fixed by 5c/5d; nothing here alters it
print(f"  capture: {decision}")
# 5f dispatch: judged-reusable → fire the offer. Every other value → no-op.
```

Test scenarios:
- A create ship with a reusable learning prints `capture: judged-reusable`, then the offer appears (Covers AC1, AC2, AC3)
- The `AskUserQuestion` throws after line 3 flushed; the receipt is still true and the ship exits zero (Covers AC3, AC4)
- A create ship whose URL is non-empty but malformed takes the `ship-url-unresolved` branch, not the resolver (Covers AC1, AC2)
- A resolver exception prints `capture: unavailable` with the `✓` line intact and exit status zero (Covers AC4)
- The five silent routes — `HOST=unknown`, post-push create failure, and the three edit paths — emit no receipt fragment (Covers AC7)
- Reading the file end-to-end, no passage claims 5f owns the predicate or grounds exit status on 5e's earlier write (Covers AC5, AC6, AC7)

Verify: `grep -q 'capture: {decision}' skills/ba-propose/SKILL.md && ! grep -q '5f: capture offer suppressed' skills/ba-propose/SKILL.md && ! grep -q 'gates on its own predicate' skills/ba-propose/SKILL.md && awk '/capture: \{decision\}/{r=NR} /Document this learning/{p=NR} END{exit !(r && p && r < p)}' skills/ba-propose/SKILL.md`

**File**: `README.md`

### U3 — Correct the two user-facing claims that suppression is silent

`:169` (under `/ba-compound`) and `:208` (under `/ba-propose`) both describe the offer as staying
quiet or silent with a trace. Under receipt-always the disposition prints on every create ship, so
both become one-line statements that the terminal receipt names the capture disposition.
`README.md:145` ("stays silent") belongs to `/ba-review-plan` and must not be touched.

Test scenarios:
- Reading the `/ba-propose` feature list, a user learns the receipt always reports the capture disposition (Covers AC8)
- `/ba-review-plan`'s description is byte-identical to before (Covers AC8)

Verify: `grep -q 'receipt names the capture disposition' README.md && ! grep -q 'stays quiet' README.md && ! grep -q 'silent on routine' README.md && grep -q 'stays silent' README.md`

**File**: `.claude-plugin/plugin.json`

### U4 — One version bump for this ship

`0.45.0` → `0.46.0`. Covers this change and the `skills/ba-review/SKILL.md`
external-reviewer-example sanitization already in the working tree. One bump per ship — do not add a
second if the branch already carries one.

Test scenarios:
- A fresh `--plugin-dir` load picks up the new bodies rather than the cached 0.45.0 (Covers AC9)

Verify: `grep -q '"version": "0.46.0"' .claude-plugin/plugin.json && ! grep -rqi 'dragon' skills/ README.md CLAUDE.md && node scripts/check-invariants.mjs`

## Dependencies & Risks

- **Prompt-only change; cannot be dry-run in the session that writes it.** A session executes the
  body it loaded at start. Verification is U1's fixture A/B plus a fresh-session
  `claude --plugin-dir <repo>` run. Per the standing preference, the merge is not gated on the
  real-harness run.
- **The live check requires a real ship.** `describe_only` never reaches 5e, so the only route that
  exercises the receipt end-to-end is an actual `commit_push_create`. In practice this change's own
  ship is its first live test.
- **U2 may not be built at all.** If U1's one-sentence arm wins, U2 is dropped and U3/U4 still ship.
  Plan for that outcome rather than treating it as failure.
- **U2 is a large single unit by design.** AC6 forces it; splitting to shrink the diff reintroduces
  the contradictory-intermediate-commit problem the "together" wording exists to prevent.
- **The receipt is a seven-site hand-maintained fan-out.** Five sites in `skills/ba-propose/SKILL.md`
  plus two in `README.md` restate the enum, with no CI check (declined above) pinning them. AC6
  solves this landing; it does not reduce the steady-state cost. **Any future enum change — a seventh
  literal, a renamed token — pays the seven-site tax again.** U2's canonical-site pointer is the only
  mitigation; recorded here so the next maintainer inherits a stated trade rather than a discovery.
- **The receipt is a CI-unpinnable machine-boundary contract.** Recorded knowingly. If a second
  participant ever appears (a parser, a persisted run artifact), `load-site-mirror` becomes
  applicable and should be revisited.
- **#81 inherits this.** Any later relocation of 5f must carry AC1 as a stated acceptance criterion,
  or the receipt regresses behind a load the model must also decide to perform.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-08-11-ba-propose-5f-terminal-receipt-brainstorm.md` — carried
  forward: receipt-always as the success condition (precision stays the residual); the three-line
  invariant on every path including the offer; the receipt classified as a machine-boundary contract
  specified to the character with its CI-unpinnability recorded; `/ba-compound` stays invoked from
  5f; standalone from #81.

### Internal References
- `skills/ba-propose/SKILL.md:30`, `:572`, `:720-733`, `:735-887`, `:875`, `:876-883`, `:908`
- `skills/ba-review-plan/SKILL.md:617-660` and `skills/ba-plan/SKILL.md:667-692` — the repo's only
  hard binding mechanism (a sentinel with a second process waiting on it), and why the receipt cannot
  be one
- `skills/ba-review/SKILL.md:213`, `skills/ba-execute/SKILL.md` `resolve-stack-base` — the
  resolve-early-carry-forward precedent this follows
- `.claude/agent_docs/prompt-authoring.md:9-23` (trust gradient), `:53-55` (authoring residue),
  `:59-63` (unevaluable conditions; verification that only proves text exists), `:73-93` (fixture A/B)
- `docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md` —
  "the absence is quiet"
- `docs/solutions/prompt-authoring/2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md` —
  a session cannot test the body it loaded
- `docs/research/2026-07-26-opus5-context-engineering-fit-research.md` — the Every datapoint behind
  U1's third arm, and the reason U1 precedes U2
- `#79 (comment, Item 4)` — the STANDARD template mints `#### U1`; this plan mints `### U<n>` per the
  grammar owner

## Convention Compliance

- [x] U-ID anchor grammar — aligned. `### U<n> — <title>` per the owner in
  `skills/ba-execute/SKILL.md` (restated `skills/ba-plan/SKILL.md:475`,
  `references/plan-sections.md:97`), deliberately not the STANDARD template's `#### U1`
  (`skills/ba-plan/SKILL.md:336`), which is the open defect in `#79 (comment, Item 4)`.
- [x] `**Code-shape decision:**` label — aligned. `skills/ba-propose/SKILL.md:744` is a borrowed
  usage, not one of the four pinned mirror sites; the label string stays byte-identical.
- [x] Trust gradient — aligned. The enum is a machine-boundary contract specified exactly;
  `interactive_session()` is steering and stays a stated goal.
- [x] Mirror-site discipline — aligned. All five in-file sites in one unit (AC6); README's two sites
  in U3; `README.md:145` explicitly excluded; the fan-out cost recorded in Dependencies & Risks.
- [x] Version bump — aligned. One bump, AC9.
- [x] `Verify:` minting — aligned. U2's check asserts **ordering** (receipt precedes the offer
  prompt), not presence, so literals stranded in old 5f prose fail it; U3 anchors to a full phrase
  unique to the intended sentence and asserts `:145` survives; U1 declares itself commit-tag-only.
- [x] Experiment before mechanism — aligned with `prompt-authoring.md:73-93` and the Opus-5 evidence;
  U1 precedes U2 and AC13 gates it.
- [x] Requirement reconciliation — 13 requirements, all mapped to AC1–AC13. Exclusions all
  provenance-tagged `inherited` except four `plan-introduced` ones, each recorded above: no Failure
  Modes row, no `CLAUDE.md` bullet, `HOST=unknown` un-receipted, no assessment timeout.
- [x] Public-safe — in-repo paths and issue numbers only.
- [x] Planning skill writes no code — the code-shape block is a labeled shape sketch in a prose spec.
- [x] Prompt weight — aligned. 5f shrinks from ~150 lines to a dispatch.
