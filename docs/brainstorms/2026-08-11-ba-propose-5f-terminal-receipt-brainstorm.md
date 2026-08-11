---
date: 2026-08-11
topic: ba-propose-5f-terminal-receipt
status: approved
triage_level: full
tags: [ba-propose, ba-compound, prompt-authoring, observability, cluster:compound, cluster:model-fit]
---

# `/ba-propose` Step 5f — make the capture disposition a field of the terminal receipt

Resolves #85. Standalone from #81.

## What We're Building

`/ba-propose`'s `commit_push_create` chain currently ends in two independent emissions: Step 5e
prints a self-contained two-line success block (`✓ <title>` / `<url>`, `skills/ba-propose/SKILL.md:720-733`),
and Step 5f (`:735-887`) then prints a capture offer or a one-line suppression trace. In practice 5f
routinely does not run, and because 5e's block is already well-formed without it, a skip is
byte-identical to a clean finish.

The fix moves the fire/suppress predicate **up** into 5d/5e, where `CREATED_PR_URL` is already in
hand, and merges its outcome into a single three-line terminal receipt:

```
✓ <title>
  <url>
  capture: offer follows | suppressed — <reason-token> | unavailable
```

5f shrinks from ~150 lines of judgment to a short dispatch: when the resolved decision is *offer*,
fire the existing `AskUserQuestion` and keep the existing accept-path outcome line. The four reason
tokens (`ship-url-unresolved`, `non-interactive`, `already-captured`, `judged-not-reusable`) are
preserved verbatim as the suppression vocabulary.

This is for anyone shipping through `/ba-propose` who cannot tell, from the output alone, whether a
learning was judged not worth capturing or the judgment never happened. The primary environment is a
large shared work repository — many contributors, a shared `docs/solutions/` corpus — not the
plugin's own repo. That cuts two ways worth stating: a lost capture is invisible to everyone, not
just to the author, and a spurious one lands in a tree other people read. Both push the same
direction as the design below (observability first, lean-silent precision retained), so the
environment sharpens the motivation without changing the approach.

## Why This Approach

**The defect is that the trace has no reader.** #85's own framing is precise: 5f's four trace lines
are printed *by the prose being skipped*, so the mechanism built to distinguish a skip from a correct
silence works only in the case where it isn't needed. The repo has exactly one hard mechanism for
making a step binding — the `[AUTO-SCORE: …]` verdict sentinel (`skills/ba-review-plan/SKILL.md:617-660`,
read by `skills/ba-plan/SKILL.md:667-692`) — and it works because a *second process waits on the
line*. 5f has no waiter, so the same string cannot be load-bearing there by construction.

Hoisting supplies the missing structural pressure without inventing a waiter: the capture line
becomes a **field of the one block the entire run exists to emit**. A dropped field makes 5e's own
success output visibly malformed, where today a dropped step makes nothing look wrong. It also
follows the repo's established hoist precedent — `ACTION` resolved once at Step 0b with `:104`
forbidding downstream re-derivation, `PERSIST=false` set for the remainder of a run
(`skills/ba-review/SKILL.md:213`), and `resolve-stack-base`'s "call once, early" invariant.

**Rejected — one terminal composite block emitted from 5f.** Loudest possible signal, but it makes
the `✓` success line an output of 5f, so a skip could suppress the visible success output entirely.
That is the exact inversion #52 engineered against when it made capture failure-isolated. Trading a
silent miss for an invisible successful ship is a worse failure.

**Rejected as the build, retained as an experiment — the one-sentence variant.** State the receipt
contract once in the Step 5 dispatch table (`:566-577`, read before any work happens) and change
nothing structural. This is a live hypothesis, not a straw man:
`docs/research/2026-07-26-opus5-context-engineering-fit-research.md` carries the Every datapoint that
scaffolding "did not prevent early stopping and instruction-missing, it contributed to them," which
makes 150 lines of terminal prose a candidate *cause* of the skip. It is retained as the cheap third
arm the fixture-A/B convention requires (`.claude/agent_docs/prompt-authoring.md:82-84`), and it is
allowed to win.

**Rejected — a hook.** This repo runs no Claude Code hooks today (CI-only automation), and per #52's
evidence hooks cannot read conversation content, so the assessment would lose its two conversational
signals and degrade to trailers-plus-diff.

## Key Decisions

- **Success condition is receipt-always, not offer-accuracy.** The assessment's false-negative rate
  stays the accepted residual the spec already names at `:884-887`. Rationale: one behavioral claim
  to verify instead of two, and the observability gap is the defect actually reported.
- **The three-line receipt holds on every path, including the offer path.** This reverses today's
  rule that "the `AskUserQuestion` **is** this path's trace" (`:780`, `:841-855`). Rationale: a
  conditional invariant cannot be greped, and would cover only the paths that already trace.
- **The receipt is a machine-boundary contract, specified to the character.** Participants are the
  skill body as emitter and the acceptance criterion / A-B scorer as reader. Line count and the
  third-line token vocabulary are fixed literals. Rationale: the receipt's shape *is* the runtime
  observable this change exists to create, and `.claude/agent_docs/prompt-authoring.md:61-63` rejects
  verification that only proves text exists. **CI cannot pin it today** — the two-participant rule
  lives in `load-site-mirror` (`prompt-authoring.md:130-136`) and needs two byte-identical blocks,
  which a single emitter does not provide. Recorded as a knowingly-unpinned assertion, the same
  status the protected-artifacts guard already carries.
- **Failure isolation is preserved unchanged.** An exception in the hoisted resolver prints
  `capture: unavailable` and the ship's exit status is untouched. Nothing on the capture path can
  fail a ship that already succeeded.
- **The `/ba-compound` invocation stays inside 5f.** Rationale: it keeps `CLAUDE.md`'s in-run
  continuation criterion true, so `ba-compound` continues to justify omitting
  `disable-model-invocation`, and `:908`'s hand-off pointer stays accurate.
- **Standalone from #81.** #81's relocation of 5f inherits the receipt invariant as a stated
  acceptance criterion. Rationale: the hoist leaves a short terminal block, which is what makes that
  later extraction cheap rather than a rewrite.
- **The `**Code-shape decision:**` block at `:744-752` is rewritten, not trimmed.** Its rationale
  earns the sketch on the grounds that "the exact predicate + ordering + per-path trace is fixed by
  this sketch" — untrue once the predicate lives in 5d/5e. Leaving it verbatim ships stale
  justification (`prompt-authoring.md:53-55`).

## Scope Boundaries

Not doing:

- Changing the assessment's signals or their weights (`:828-839`). Precision is out of scope by the
  first key decision.
- #58's removal of same-turn self-verification. Same cluster, separate ship.
- Any Claude Code hook.
- Reopening which command hosts the capture offer. #52 settled this (`/ba-propose` only — not
  `/ba-review`, not both) and is closed; the frontmatter-`description` trigger surface shipped in the
  same slice and was probed by `docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md`.
  No open issue owns further triggering work, so this is a settled decision this brainstorm inherits,
  not deferred scope. Corpus quality is #53; corpus maintenance is #54 (deferred).
- Relocating 5f's prose into a reference file (#81).
- Adding a CI check for the receipt — no second participant exists to compare against.
- The edit paths. `commit_push_edit`, `edit_only`, and `describe_only` stay traceless by
  construction, as does `HOST=unknown` (exits in 5d).

## Acceptance Criteria

1. Every `commit_push_create` run that reaches 5e emits exactly three lines, the third matching
   `capture: (offer follows|suppressed — (ship-url-unresolved|non-interactive|already-captured|judged-not-reusable)|unavailable)`.
2. The offer path emits `capture: offer follows` **before** the `AskUserQuestion`, and the existing
   accept-path outcome lines (`:789-792`) are unchanged.
3. An exception anywhere in the hoisted resolver yields `capture: unavailable` and a zero exit; the
   `✓` line and URL still print.
4. `README.md:169` and `README.md:208` no longer describe suppression as the offer "staying quiet"
   or being "silent".
5. All five in-file mirror sites are updated together: `:30` (predicate ownership), `:572` (action
   table), `:720-733` (5e output contract), `:737-742` (completeness framing), `:744-752`
   (code-shape rationale). `:908` is explicitly confirmed unchanged.
6. `.claude-plugin/plugin.json` carries exactly one bump (`0.45.0` → `0.46.0`) for this ship,
   covering the co-shipped `skills/ba-review/SKILL.md` external-reviewer-example sanitization.
7. `node scripts/check-invariants.mjs` reports PASS on all six checks.
8. Fixture A/B over three arms (`main` / hoisted receipt / one-sentence) shows the receipt line
   present in the hoisted arm on fixtures where `main` drops it. Per
   `.claude/agent_docs/prompt-authoring.md:73-93`, fixtures plant the failure being prevented, and
   per `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md` each
   verdict is attributed to a specific source sentence or the cell is inconclusive.
9. Post-merge, in a fresh session: the first real `commit_push_create` ship emits the three-line
   receipt. This is the live check and, per
   `docs/solutions/prompt-authoring/2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md`, it
   cannot be run from the session that writes the change.

## Open Questions

None.

### Resolved Questions

- *What counts as fixed?* → Receipt-always; assessment precision stays the accepted residual.
- *Relationship to #81?* → Fix #85 standalone first; #81 inherits the invariant as an AC.
- *Does the offer path carry a capture line?* → Yes. The three-line block is unconditional.
- *Is the receipt a machine-boundary contract or steering?* → Machine-boundary, specified exactly,
  with its CI-unpinnability recorded.

## Convention Compliance

Convention-checker run before this artifact reached disk. 14 conventions checked: 5 aligned,
1 justified override, 5 violations (all resolved), 3 not applicable.

- **README sync** (violation, resolved) — `README.md:169` and `:208` assert 5f "stays quiet" /
  is "silent"; contradicted by receipt-always. Now an in-scope deliverable and AC4.
- **Mirror-site enumeration** (violation, resolved) — four disturbed sites were missing from the
  draft (`:30`, `:572`, `:737-742`, `:908`). Now enumerated in AC5.
- **Trust gradient** (violation, resolved) — the draft specified a literal format while arguing no
  second process reads it. Resolved by classifying the receipt as a machine-boundary contract with
  emitter and AC-scorer as its two participants, and recording that CI cannot pin it.
- **Misattributed CI rule** (violation, resolved) — the ≥2-participant rule belongs to
  `load-site-mirror`, not `sentinels`. Corrected in Key Decisions.
- **Version bump** (violation, resolved) — one bump to `0.46.0`, AC6.
- **Justified override** — retaining rejected approach C as an A/B arm is what
  `prompt-authoring.md:82-84` asks for; it stays in this brainstorm as an experimental condition and
  is not carried into shipped prompt prose.
- **Not applicable** — the U-ID and stack-base axis grid is untouched (5e/5f read no `<base>` and no
  U-ID anchor, and the receipt adds no git-derived state); the `**Code-shape decision:**` *label*
  convention is scoped to plan documents, so rewriting `:744`'s borrowed usage disturbs no mirror
  site.
- **Aligned** — public-safe artifact (in-repo paths and issue numbers only); planning skill writes no
  code; fixture A/B is the deciding instrument; prompt weight decreases.

## Next Steps
→ `/ba-plan` to create implementation plan
