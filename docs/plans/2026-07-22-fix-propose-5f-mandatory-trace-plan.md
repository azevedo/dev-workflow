---
title: "fix: /ba:propose Step 5f mandatory trace + required-terminal-step reframe"
type: fix
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-07-22
detail_level: minimal
tags: [propose, ship-time-capture, observability, prompt-spec]
---

# fix: `/ba:propose` Step 5f mandatory trace + required-terminal-step reframe

Step 5f (the ship-time `/ba:compound` capture offer) is **mandatory-but-self-silencing**, yet
it recurrently gets skipped after 5e prints `✓ <url>`: a *correct* silence and a *total skip*
produce byte-identical output (nothing at all), and the "post-completion chrome" framing reads
as optional garnish after an already-done command. This fix makes 5f observable and reframes it
as a required terminal step, without changing its assessment heuristics, its non-blocking
nature, or the ship's exit status.

Three complementary fixes (all selected):

- **(A) Mandatory trace** — every *reachable* 5f path emits exactly one line. The offer path's
  `AskUserQuestion` is its own trace; each reachable silence prints one
  `5f: capture offer suppressed — <reason>` line.
- **(B) Reframe** — drop "post-completion chrome"; 5f is a required terminal step ("Step 5 is
  not complete until 5f has **run**"), keeping "non-blocking / mode-independent / never changes
  exit status."
- **(C) Table row** — add `→ 5e (output) → 5f (capture offer)` to the Step 5 action-plan table's
  `commit_push_create` row.

This is a **prompt-spec change only** — the sole edited runtime-affecting file is
`commands/ba/propose.md` (a prose spec). No production source is touched.

## Acceptance Criteria

- AC1: A successful `commit_push_create` that meets the 5f gate and carries a positive learning
  signal reaches the "Document this learning?" offer with **no user nudge**.
- AC2: Every **reachable-but-silent** 5f path prints exactly one
  `5f: capture offer suppressed — <reason>` line, so a genuine skip (which prints nothing) is
  never indistinguishable from a correct silence.
- AC3: Genuinely-**unreachable** actions (`edit_only`, `commit_push_edit`, `describe_only`,
  `HOST=unknown`, and pre-5f failure exits) stay traceless — 5f prints nothing there.
- AC4: The **offer** path emits the `AskUserQuestion` as its trace, followed on accept by exactly
  one bounded outcome line (`captured` | `no doc written`); a **decline** emits no closing line
  (the offer already fired, so it is not a silent path).
- AC5: "post-completion chrome" appears **nowhere** in `commands/ba/propose.md`; 5f is framed as a
  required terminal step keyed on "**run**", not "succeeded", and the exit-status /
  non-blocking / mode-independent properties are explicitly retained.
- AC6: The Step 5 action-plan table's `commit_push_create` row names both **5e** and **5f**.
- AC7: `README.md` line ~203 notes that the silent paths now emit a one-line suppression trace;
  `.claude-plugin/plugin.json` `version` is bumped.

## What We're NOT Doing

- **Not** making 5f blocking or `REVIEW_MODE`-gated — it stays non-blocking and mode-independent
  (handoff non-goal).
- **Not** changing the assessment heuristics (deviation-trailer-weighted, lean-silent). Only its
  *observability* and the *framing* that let it be skipped. The assessment stays a best-effort
  read-only bool; we do not split it into a routine-vs-uncertain confidence result — the single
  `judged-not-reusable` reason honestly covers both negative and uncertain outcomes.
- **Not** restructuring the failure-isolation `try` boundary (handoff non-goal). The `try` keeps
  wrapping assessment + prompt + `/ba:compound` invoke exactly as today. The one consequence —
  an `already-captured`/`judged-not-reusable` trace `print` that itself throws (EPIPE on a broken
  stdout) would be caught and relabeled as a capture-failure line — is an **accepted extreme-edge
  residual**: if stdout were broken, 5e's own `✓ <url>` print microseconds earlier already
  failed, so this path is not reachable in practice. (Considered and rejected: moving all
  suppression traces outside the `try` to make them uncatchable — it would narrow the protected
  boundary the non-goal fixes.)
- **Not** retro-amending the historical feature artifacts
  (`docs/plans/2026-07-20-feat-ba-compound-ship-time-capture-plan.md`,
  `docs/brainstorms/2026-07-19-ba-compound-ship-time-capture-brainstorm.md`) that assert the now-
  reversed "no trace / unobservable silent path — accepted" decision. Those are point-in-time
  artifacts under the protected-artifacts guard; the plugin norm is that prose artifacts are
  ephemeral and knowledge graduates to `docs/solutions/`. The completed plan's stale U3 `Verify:`
  (which greps for "post-completion chrome") is acceptable — that plan is git-derived-complete and
  is not re-run.
- **Not** touching the unrelated "routing chrome" at `propose.md:506` (Risk/Proof/Where-to-look
  composition lines — a different meaning of "chrome").
- **Not** adding a 5e-output step to the edit-path rows of the Step 5 table (pre-existing quirk,
  out of scope).

## Context

Current 5f lives at `commands/ba/propose.md:733–846`. Load-bearing sites (verified this session):

- **`propose.md:29`** — consolidated `REVIEW_MODE` invariant; calls 5f "post-completion chrome"
  (mirror site #1 of the "chrome" framing).
- **`propose.md:733–846`** — the `### 5f. Ship-time capture offer` section, including the
  `**Code-shape decision:**` control-flow sketch (748–779) and mirror site #2 at 735–736.
- **`propose.md:730`** — 5e's unparseable-URL guard: "…so it stays silent rather than firing on a
  placeholder." (Must change: it no longer stays fully silent.)
- **`propose.md:846`** — the exact sentence this fix reverses: "…a correct silence is
  indistinguishable from a missed positive, and the silent path has no trace — accepted."
- **`propose.md:569–576`** — the Step 5 action-plan table; `commit_push_create` row at 571 stops
  at 5d (neither 5e nor 5f listed).
- **`README.md:203`** — user-facing `/ba:propose` feature bullet enumerating the silent paths
  (the sync target for AC7). Lines 165/288 stay as-is (high-level summaries).
- **`.claude-plugin/plugin.json`** — `version` currently `0.34.0`.
- **CLAUDE.md hand-off-exception trio** (`CLAUDE.md` convention line, `propose.md:867`,
  `README.md:203`) constrains 5f's *write-location* semantics, **not** its trace/framing — no
  change needed there (this fix does not alter the hand-off exception).

The four reachable-silence trace reasons (AC2): `non-interactive`, `already-captured`,
`judged-not-reusable`, `ship-url-unresolved` (the last resolves spec-flow gap G1).

## MVP

### U1 — Rewrite Step 5f control flow for mandatory trace

**File:** `commands/ba/propose.md` (§5f, lines 733–846; plus 5e guard at 730).

Decisions:

1. **Split the first guard** (resolves G1). Separate the genuinely-unreachable enum check
   (traceless) from the reachable empty-URL case (traced). Today's single disjunction
   `if ACTION != commit_push_create or not CREATED_PR_URL: return` silently swallows a
   *successful* `commit_push_create` whose URL 5e couldn't parse.
2. **Add a trace print to each of the reachable silence returns.** Reasons: `non-interactive`,
   `already-captured`, `judged-not-reusable`, `ship-url-unresolved`. Format string:
   `5f: capture offer suppressed — <reason>`.
3. **Keep the `try` boundary exactly as-is** (assessment + prompt + invoke). The `already-captured`
   and `judged-not-reusable` traces stay inside the `try` where their returns already are; the
   `non-interactive` and `ship-url-unresolved` traces sit above it with their guards. Document the
   EPIPE-relabel residual (see "What We're NOT Doing").
4. **Rescope the "exactly one line" invariant in prose** (resolves G2): "exactly one
   `5f: capture offer suppressed — <reason>` line on each of the **three-plus** reachable silence
   paths; the **offer** path's `AskUserQuestion` is its trace, followed on accept by exactly one
   bounded outcome line (`captured` | `no doc written`); `/ba:compound`'s own summary/menu are
   compound's, not 5f's." State explicitly that **decline** needs no closing line (G7).
5. **Update the reversed decision line (846).** Replace "the silent path has no trace — accepted"
   with: each reachable silent path now leaves a one-line reasoned trace, so a skip is
   distinguishable from a correct silence; manual `/ba:compound` remains the escape hatch for a
   **false-negative judgment** (a `judged-not-reusable` trace that should have been an offer) —
   the assessment's precision, not its observability, is the residual.
6. **Update 5e's guard prose (730):** the empty-URL case no longer "stays silent" — it emits the
   `ship-url-unresolved` suppression trace rather than firing the offer on a placeholder.

**Code-shape decision:** the 5f gate/silence/offer control flow is the load-bearing decision of
this change (the existing spec already carries it under a `**Code-shape decision:**` label), and
re-deriving it from prose plausibly produces a *wrong* structure — tracing the unreachable enum
guard, collapsing the reachable empty-URL case into the traceless bucket, or moving traces out of
the `try` and breaking the boundary non-goal. Anchor: this plan's Context + the spec-flow analysis
(no brainstorm origin for this fix). The revised sketch (shape only, not literal command text):

```
# 5f. Ship-time capture offer — runs only after 5e printed "✓ <url>".
# Invariant: every REACHABLE path emits exactly one 5f-owned line.
#   - three-plus silence paths: one `5f: capture offer suppressed — <reason>` line
#   - offer path: the AskUserQuestion IS the trace (on accept, + one bounded outcome line)
# Genuinely-unreachable actions stay traceless. The try boundary is unchanged.

if ACTION != commit_push_create:
    return                       # unreachable action (edit_only / commit_push_edit /
                                 # describe_only / HOST=unknown) → traceless, 5f not meant to run
if not CREATED_PR_URL:           # reachable: successful create, 5e couldn't parse URL (5e guard)
    print("5f: capture offer suppressed — ship-url-unresolved")
    return
if not interactive_session():    # no answerer for the offer → silent, never hang
    print("5f: capture offer suppressed — non-interactive")   # a static stdout write cannot hang
    return
try:
    if solutions:                # Step 2c non-empty → already documented & in the PR
        print("5f: capture offer suppressed — already-captured")
        return
    if not assess_reusable_learning(deviation_trailers, conversation_arc,
                                    commit_type, risk, proof):
        print("5f: capture offer suppressed — judged-not-reusable")  # negative OR uncertain
        return
    answer = AskUserQuestion("Document this learning?", options=[Yes, No])  # the offer = its trace
    if answer != Yes:
        return                   # decline → no closing line; offer already fired (not silent)
    result = run("/ba:compound", context_hint=seed(motivation, deviation_trailers,
                                                    risk, proof, diff_summary))
    if result.wrote_file:
        print("captured — doc is uncommitted and NOT in this PR")
    else:
        print("no doc written (compound aborted, e.g. insufficient context) — run /ba:compound manually.")
except Exception:
    print("PR is live; capture failed — run /ba:compound manually.")   # ship stays successful
```

Test scenarios:
- Positive-signal `commit_push_create` (deviation trailers present, clear problem→fix arc),
  interactive → the "Document this learning?" offer fires with no nudge. (Covers AC1, AC4)
- Routine `commit_push_create` (clean `feat:`, no trailers), interactive → one line
  `5f: capture offer suppressed — judged-not-reusable`; nothing else. (Covers AC2)
- `solutions` non-empty (a learning already rode this PR) → one line `— already-captured`. (Covers AC2)
- Scripted/headless `commit_push_create` → one line `— non-interactive`; no hang. (Covers AC2)
- `commit_push_create` where 5e printed `✓` without a parseable URL → one line
  `— ship-url-unresolved` (not a silent skip). (Covers AC2)
- `edit_only` / `commit_push_edit` / `describe_only` / `HOST=unknown` → 5f prints nothing. (Covers AC3)
- Offer accepted, `/ba:compound` writes a doc → exactly one bounded outcome line
  ("captured — … NOT in this PR"); soft-fail → the "no doc written" line, never "captured". (Covers AC4)
- Offer declined → no closing line printed. (Covers AC4)

Verify: `grep -q 'capture offer suppressed' commands/ba/propose.md && ! grep -q 'silent path has no trace' commands/ba/propose.md`
(the trace template was added **and** the contradicting "no trace — accepted" claim was removed —
a half-done edit that adds the trace but leaves the old claim fails this conjunction).

### U2 — Reframe 5f from "chrome" to a required terminal step

**File:** `commands/ba/propose.md` — **both** mirror sites: line 29 (the `REVIEW_MODE` invariant)
and lines 735–736 (the §5f header).

Decisions:
- Remove "post-completion chrome" from both sites (resolves G3's drift risk — a whole-file grep is
  the guard).
- Reframe as: "Step 5 is not complete until 5f has **run**" — keyed on *run*, never *succeeded*, so
  it does not collide with the retained "never changes the ship's exit status" property (the
  exception path already guarantees run-but-fail ≠ ship-fail).
- **Retain** the true and load-bearing properties at both sites: non-blocking, mode-independent
  (not `REVIEW_MODE`-gated, fires identically with/without `--review`), never feeds
  `CompositionInputs`, gates on its own predicate, and never changes exit status. Keep line 29's
  "stated once here instead" consolidation note intact.

Test scenarios:
- Line 29 and 735–736 both describe 5f as a required terminal step, not "chrome". (Covers AC5)
- The retained properties (non-blocking / mode-independent / exit-status-neutral) still read at
  both sites. (Covers AC5)
- The reframe says "run", not "succeeded", anywhere it states the completion condition. (Covers AC5)

Verify: `! grep -q 'post-completion chrome' commands/ba/propose.md`
(a whole-file grep — if only one of the two mirror sites is updated, the other still matches and the
check fails, enforcing the sync).

### U3 — Add 5e/5f to the Step 5 action-plan table

**File:** `commands/ba/propose.md`, Step 5 table (569–576), `commit_push_create` row (571).

Decisions:
- Extend the `commit_push_create` row from `… → 5d (create PR/MR)` to
  `… → 5d (create PR/MR) → 5e (output) → 5f (capture offer)` so a model dispatching off the table
  sees 5f as part of the action (resolves root-cause #3).
- Only the `commit_push_create` row changes — 5f is unreachable for the other rows (consistent with
  the gate). Edit rows are left as-is (see "What We're NOT Doing").

Test scenarios:
- The `commit_push_create` row lists 5a→5b→5c→5d→5e→5f. (Covers AC6)
- The `edit_only` / `commit_push_edit` / `describe_only` rows are unchanged. (Covers AC6)

Verify: `grep -q '5f (capture offer)' commands/ba/propose.md`

### U4 — README sync + version bump

**Files:** `README.md` (line ~203), `.claude-plugin/plugin.json`.

Decisions:
- **README:** minimally reword line 203 so the enumerated silent paths note the new trace, e.g.
  append "(each now emits a one-line suppression trace naming why)" to the "silent on routine,
  uncertain, already-captured, and non-interactive ships" clause. Leave lines 165 and 288 (high-
  level summaries) untouched. The user-facing prose does not name the internal reason tokens.
- **Version:** bump `.claude-plugin/plugin.json` `version` `0.34.0` → `0.35.0` (the plugin auto-
  update cache key; every shipped change needs a bump). A user-observable behavior change (traces
  now print) justifies a minor bump; `0.34.1` is acceptable if patch semantics are preferred.

Test scenarios:
- README line 203 mentions the suppression trace; 165/288 unchanged. (Covers AC7)
- `plugin.json` version is no longer `0.34.0`. (Covers AC7)

Verify: `! grep -q '"version": "0.34.0"' .claude-plugin/plugin.json && grep -q 'suppression trace' README.md`
(asserts the version moved off `0.34.0` — robust to either a `0.35.0` minor or a `0.34.1` patch bump — and the README trace clause landed.)

## Sources

- Origin: handoff doc `handoff-ba-propose-step5f-skip.md` (execution-miss report + proposed fixes
  A/B/C + acceptance criteria + non-goals).
- Feature being fixed: `commands/ba/propose.md:733–846` (§5f, shipped in commit 579f12b
  "feat(compound): ship-time knowledge capture").
- Reversed decision: `commands/ba/propose.md:846`;
  `docs/plans/2026-07-20-feat-ba-compound-ship-time-capture-plan.md:381–383,396` (the
  "no trace — accepted" residual this fix overturns).
- Spec-flow analysis (this session): gaps G1 (guard split), G2 (invariant rescope), G3 (mirror +
  run-not-succeeded), G4 (EPIPE residual), G6 (`judged-not-reusable` label), G7 (decline trace).
- Mirror sites: `propose.md:29` & `:735–736` (chrome framing); `:569–576` (Step 5 table);
  `README.md:203`; `.claude-plugin/plugin.json`.

## Convention Compliance

- [x] Planning command writes no code — this plan only documents a prompt-spec edit; the literal
  block in U1 is under a `**Code-shape decision:**` label (permitted). Aligned.
- [x] Version bump required for every release (U4). Aligned.
- [x] "Update README.md whenever commands … change" — U4 syncs README. Aligned.
- [x] Mirror-in-sync conventions — U2's whole-file `Verify:` grep enforces the two "chrome" mirror
  sites move together; the CLAUDE.md hand-off-exception trio is untouched (this fix does not alter
  hand-off semantics). Aligned.
- [x] Protected-artifacts guard — historical brainstorm/plan artifacts are left as-of-date, not
  edited or removed (see "What We're NOT Doing"). Aligned.
- [x] Each unit carries `Test scenarios:` + exactly one read-only, code-matchable `Verify:`. Aligned.
