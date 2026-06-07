---
date: 2026-06-07
topic: verify-fix-precondition-assessment
status: complete
tags: [ba-review, verification, autonomy, defer, ce-precedent]
relates_to:
  - docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md
  - docs/research/2026-06-07-preexisting-finding-frequency-research.md
---

# Should `/ba:review` verify fix + precondition (#2)? — assessment

## Question

Item #2 of the `/ba:review` automation roadmap proposed attaching inline "verification evidence"
to claim-bearing findings — confirming the proposed **fix** grounds out and the **premise** holds.
Before building: is the friction frequent enough to justify a per-finding verification pass — and
is the design sound, especially given the longer-term goal of running `/ba:review` **autonomously**?

## Method

Two inputs, each kept appropriately:

- An **out-of-repo transcript census** of real `/ba:review` usage (private, per this roadmap's
  privacy stance — only the qualitative conclusion is recorded here; raw counts, dates, paths, and
  quotes stay out of the repo). Pre-registered four questions and a decision rule before looking at
  the data: interrogation frequency, hit rate, gate overlap, and fix-vs-premise split.
- A study of the external **CE `ce-code-review`** skill, which already ships a verification step —
  the proven precedent the brainstorm cited.

## Verdict: DEFER (as an immediate friction-reduction feature)

The census found genuine fix/premise errors **rare** — they occur in only a small minority of runs
and a tiny fraction of findings; the dominant post-findings action is accept / filter-for-posting,
not interrogation. The pre-registered rule's first branch (rare → defer) fires. Two reinforcing
notes:

- The rare errors sit **above** the confidence floor, so gate-tuning wouldn't catch them either —
  there is no cheaper consolation build.
- **Verification theater is now evidenced, not theorized.** In the clearest error (a finding
  asserting an issue was "introduced by this change" when it actually pre-existed), the agent
  reached the wrong conclusion *itself* and only corrected when the human ran the check the agent
  had skipped. A same-agent verification step would have rubber-stamped it. The brainstorm's
  #2-as-conceived (the agent vouching for its own findings) would have been **worse than nothing**
  in exactly its highest-value case.

## What CE does, and why the complexity is worth it for them

CE does **not** do same-agent inline evidence. It runs a layered system; the load-bearing piece is
**Stage 5b — one independent validator subagent per surviving finding**:

- **Independent** — a fresh context with no commitment to the finding ("false positives are common;
  when in doubt, reject"). Independence is the whole point: an agent cannot filter its own bias;
  only a fresh second opinion culls false positives.
- It answers three questions: *is the issue real in the code as written?*, *is it introduced by THIS
  diff?* (via `git blame`), *is it handled elsewhere?* (caller guards, middleware, framework
  defaults). So **CE's validator subsumes both #2 (premise/fix) and #3 (pre-existing) in one pass**,
  and decides pre-existing by **blame**, not orchestrator-side hunk arithmetic.
- Cost is bounded surgically: runs only on **post-gate survivors**, **capped** (≤15; P0/P1 never
  dropped from validation), and a mechanically-checkable *fact* is verified by the orchestrator
  directly while the expensive independent wave is reserved for *judgment calls*. Fix-correctness is
  checked **empirically** (apply → run tests → revert if red), never by static reasoning.

That is how the complexity is "worth it" for CE: cheap layers do the easy work (reviewer
self-anchored confidence + the gate), and the one expensive layer is tightly bounded and buys the
single thing nothing cheaper can — **independence**.

## The autonomy reframe (why this is parked, not closed)

The deferral answers the *interactive-friction* question. The longer-term goal — running
`/ba:review` **autonomously** — is a different question, because headless operation removes the
human who currently catches the rare error cheaply. The census reshapes (not kills)
verification-for-autonomy:

1. **Independence is mandatory.** The theater finding proves same-agent verification manufactures
   false confidence — the worst property for autonomy. For a headless path, verification must be
   CE's independent validator, never the inline self-evidence line.
2. **The real headless-danger failure mode is narrower than "verify everything":
   merge-corroboration–manufactured confidence.** The genuine errors were elevated to top
   confidence by the consolidation math (`commands/ba/review.md` Stage 4d:
   `max(c_i>0) + 25·(n−1)`), where individually sub-floor reviewer votes corroborate to 100.
   Corroboration is *supposed* to be a trust signal, but here it amplified **correlated reviewer
   errors** (shared blind spots) into maximum confidence. Interactive: the human catches it.
   Headless: conf-100 is exactly what an autonomous actor acts on most readily. (Low-n — a
   hypothesis to watch, not a proven law.)
3. **The trigger condition.** The human is still the verification layer, and it works. The
   validator's value flips from marginal to load-bearing the moment an **autonomous-action path**
   (auto-apply / auto-post with no confirm) is added. Build it then, gated to that path so
   interactive runs stay untaxed, CE-scoped.

## Recommendation

- **Defer** #2 as a near-term build.
- **Pre-commit the design:** when an autonomous-action path is added, build CE's **independent
  validator** (subsuming #2 **and** #3) — post-gate, capped, `git blame` for pre-existing, gated to
  the autonomous path.
- **Cheap de-risk available now:** scrutinise the merge-corroboration → 100 promotion
  (`commands/ba/review.md` Stage 4d) — the failure mode that turns dangerous headless. Capping or
  flagging corroboration-elevated 100s is a small change; treat as a hypothesis to confirm with more
  data before building.
- **Keep the calibration practice.** Auditing the agent's *confident* decisions against ground truth
  (as this assessment did) is the highest-leverage autonomy-readiness work — cheaper and more
  load-bearing than building verification machinery before it is needed. The measurement itself was
  the more valuable autonomy step.

## Pointers

- Origin brainstorm: `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md` (Item #2)
- Sibling assessment: `docs/research/2026-06-07-preexisting-finding-frequency-research.md` (Item #3)
- Precedent studied: external CE `ce-code-review` skill — Stage 5b independent validator + the
  findings-schema confidence anchors (which bake honest self-verification into the reviewer).
- Underlying transcript census: private, out-of-repo (per this roadmap's privacy stance).
