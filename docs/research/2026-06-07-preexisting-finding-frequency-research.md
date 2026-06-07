---
date: 2026-06-07
topic: preexisting-finding-frequency
status: complete
tags: [ba-review, pre-existing, measurement, build-vs-defer]
relates_to:
  - docs/plans/2026-06-07-feat-preexisting-collapsed-section-plan.md
  - docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md
---

# How often do `/ba:review` findings land on pre-existing code?

## Question

Item #3 of the `/ba:review` automation roadmap (the brainstorm's "pre-existing collapsed section")
routes findings about code the author did **not** introduce into a default-collapsed `Pre-existing`
section. Before building it, measure the friction it targets: across real reviewer findings, how
often is a finding actually about a pre-existing (not-author-changed) line — and how reliably can
the proposed hunk-level rule classify them?

## Method

Classify real reviewer findings by the exact rule Item #3 would use: a finding is
**author-introduced** iff its cited `<file>:<line>` is an added (`+`) line in the diff; otherwise it
is **pre-existing**. Two independent in-repo samples:

1. **Persisted run, censused from disk** — `docs/reviews/2026-05-25-003929-mr-17/` (MR #17,
   `ba-propose`), 11 findings, architecture-reviewer.
2. **Fresh max-surface run** — the smallest recent diff (22 lines) into the largest file (the
   916-line `commands/ba/review.md`), range `65f793f^..HEAD`, four reviewers (architecture,
   simplification, complexity, error-handling), each instructed — as the real command does — to
   "review the diff AND read the full content of the changed files." A tiny change inside a large
   file is the **best case** for pre-existing findings to appear.

Each finding's cited line was checked against the range's author-introduced line map (computed from
`git diff <range>`).

## Results

| Sample | Findings | Author-introduced | Pre-existing (genuine) | Mis-collapsed by the rule (citation drift) |
|---|---|---|---|---|
| MR-17 (persisted, 1 reviewer) | 11 | 10 | 1 — already gated to `Suppressed` | 0 |
| `65f793f^..HEAD` (fresh, 4 reviewers) | 15 | 12 | 0 | 3 |
| **Total** | **26** | **22** | **1 (~4%)** | **3** |

### Findings

1. **Genuine pre-existing findings are rare — 1 of 26 (~4%).** The single instance
   (`README.md:165`, "Pre-existing formatting issue … not introduced by this PR") arrived at
   confidence 50, so the **existing soft confidence gate already routed it to `Suppressed`.**
   Item #3 would not have changed its handling.

2. **At maximum surface, zero genuine pre-existing findings.** Four reviewers read the entire
   916-line file behind a 22-line change and **stayed on the change** — none roamed into the ~894
   untouched lines to flag unrelated issues. This contradicts the assumption that reading the full
   file produces a meaningful stream of pre-existing findings.

3. **The proposed rule would misfire on citation drift.** Three of the fresh run's 15 findings
   cited a **context line adjacent to** the lines they were actually about (reviewers cite
   approximate line numbers). Item #3's hunk-level classifier would confidently route all three to
   `Pre-existing` — i.e., **hide findings that are about the author's change.** On this sample the
   `Pre-existing` section would hold 4 findings: 3 wrongly-hidden findings-about-the-change and 1
   true positive that the gate already handled. Net negative.

## Corroboration

A separate, out-of-repo usage analysis (kept private per the brainstorm) independently indicates
that scope-related friction (defer / off-diff / pre-existing) is a small share of review
interactions — consistent with the low in-repo rate measured here.

## Caveats

- **Substrate.** This repo is markdown command-prose, not a large application codebase. Larger code
  files with more surrounding logic could raise the genuine rate; however, the out-of-repo analysis
  (which reflects code-review usage) points the same low direction, so the in-repo number
  corroborates rather than contradicts it.
- **Sample size.** 26 findings across one persisted MR and one fresh range — directional, not
  definitive.
- **Drift in code vs prose.** Citation drift may behave differently in code than in prose, in either
  direction.

## Recommendation

**Defer Item #3.** The friction is real but rare, the clearest instance is already absorbed by the
confidence gate, and the proposed hunk-level cure has a measurable *false-collapse* failure mode
driven by imprecise citations — on this sample it would hide more relevant findings than it
correctly files.

If the need resurfaces (e.g. real code review shows a higher rate):
- **Cheapest:** do nothing structural — the existing confidence gate + `(off-diff)` annotation
  already catch the clearest cases (reviewers self-assign low confidence to tangential/pre-existing
  findings, as MR-17 shows).
- **If building anyway:** prefer a **reviewer-self-tag** design (each reviewer marks whether its
  finding is about the change) over orchestrator-side hunk arithmetic — it sidesteps the
  citation-drift fragility this measurement exposed.

## Pointers

- Plan (now deferred): `docs/plans/2026-06-07-feat-preexisting-collapsed-section-plan.md`
- Origin brainstorm: `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md` (Item #3)
