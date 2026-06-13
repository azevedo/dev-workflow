---
title: Where the review cost lives in /ba:plan output — a verbosity diagnosis
type: research
status: complete
date: 2026-06-13
tags: [plan, verbosity, review-cost, form, dev-workflow]
scope: form (how/where plan content is presented for review) — NOT purpose (what a plan is for)
evidence: 24 plan docs, plan.md + sibling command specs, 1 session transcript, 7 PRs
---

> **Scope of this pass (read first).** This is the **md-only-repo pass**, run against the
> `dev-workflow` plugin repo itself — whose deliverable *is* markdown, so plan "code blocks" are
> command specs (see Finding 3). It did **not** have access to: a real code (non-md) repo, a larger
> plan corpus, actual execution transcripts, or inline PR review comments. A separate **code-repo
> pass** is planned on another machine and will be pushed to this branch for consolidation.
> Treat the volume findings as solid (measured), but treat every **review-value** judgment as a
> hypothesis to validate against the code-repo pass's transcripts and PR comments — that is the
> evidence this pass had to infer around (see "Honest gap").

## Summary

**Problem (fixed):** reviewing a `/ba:plan` doc costs too much to read.

**Diagnosis:** The cost is **not** the code blocks (kept on purpose, ~40% of volume) and **not**
the core review payload (scope, behaviors-to-test, success criteria, the exact file changes). The
cost is a **framing tax that the template imposes by level**: COMPREHENSIVE plans mandate ~10 prose
sections, several of which restate the same thing at different altitudes (Overview vs Proposed
Solution vs Technical Approach), duplicate content that already lives elsewhere in the same doc
(Documentation Plan, Testing Strategy), or re-host decision framing the **brainstorm already owns**
(scope rationale, alternatives considered). The pain concentrates almost entirely at the
COMPREHENSIVE level (avg 1,040 lines; worst 1,151), is mild at STANDARD (avg 510), and is absent at
MINIMAL (avg 179 — already near-ideal).

**Recommended direction (not a blanket trim):** a **targeted restructure + selective demotion**,
concentrated at COMPREHENSIVE — (1) put the high-scrutiny "review spine" up top in a fixed order,
(2) demote low-scrutiny framing to a collapsed appendix, (3) collapse the 3–4 overlapping "approach"
sections into one, (4) pointer-ize (not restate) the brainstorm→plan decision duplication, and
(5) make code blocks *cheaper to scan* (per-file intent headers), never removed. A read-optimized
companion view is a real option — the user already hand-built one (PR #15's HTML render) — but it
treats the navigation symptom, not the content cause.

**Proposed target:** cut the non-code framing tax ~40–50% so COMPREHENSIVE lands at ~650–750 lines
and STANDARD at ~400, **without removing a single line of code, acceptance criterion, behavior, or
scope boundary.** MINIMAL is left alone.

---

## Evidence base & method

| Source | What it gave | Reliability |
|---|---|---|
| 24 plan docs in `docs/plans/` (55–1,151 lines, 12,340 total) | Volume by level, by section, code-vs-prose split | **High** — the actual output |
| `commands/ba/plan.md` + `brainstorm.md`, `slice.md`, `review-plan.md` | Template structure; division of labor; duplication seams | **High** |
| Session transcript (`2de4a809-…jsonl`) | — | **None** — it is *this* research session; self-referential, no plan-review behavior captured |
| 7 PRs (#2–#18) incl. plan-bearing #12, #15 | Behavioral workaround signals from PR bodies | **Medium** — no inline review comments exist (solo repo; review happens in-session) |

**Honest gap:** the handoff's best-hoped evidence — the user's actual skim-vs-scrutinize behavior —
is **not directly observable** here. No usable transcript, no PR review comments. Review-value below
is therefore **inferred** from three indirect signals, flagged as such:
1. The user's one hard stated criterion (keep code blocks — getting code roughly right at plan time
   prevents rewrites later).
2. A **behavioral workaround**: for PR #15's 1,063-line plan the user hand-built a companion HTML
   render ("sticky TOC, scrollspy, phase-gate callouts") and told reviewers "HTML render recommended
   for the 1063-line scroll." → review cost is dominated by **navigation/scroll of large docs**.
3. The system **already encodes "plan growth is bad"**: `/ba:review-plan` Step 5.5 runs a
   `plan-iteration-gate` that tracks plan-body LoC delta across review rounds and fires a reminder at
   iteration ≥ 3. Verbosity is already a recognized failure mode internally.

---

## Finding 1 — Volume map: where the lines are

### By detail level

| Level | n | avg total | avg code | code % |
|---|---|---|---|---|
| MINIMAL | 6 | **179** | 38 | 22% |
| STANDARD | 16 | **510** | 202 | 40% |
| COMPREHENSIVE | 3 | **1,040** | 450 | 43% |

The cost curve is steep and level-driven. MINIMAL is already cheap. The review pain the handoff
describes is a COMPREHENSIVE (and high-end STANDARD) phenomenon.

### By section (aggregate lines across all 24 docs; code vs prose split)

| Section | docs | total | code | prose |
|---|---|---:|---:|---:|
| Changes Required | 10 | 2,244 | 1,412 | 832 |
| Phase N bodies | 4 | 2,217 | 1,339 | 878 |
| Convention Compliance | **25** | 359 | 0 | 359 |
| Behaviors to Test | 14 | 351 | 22 | 329 |
| Success Criteria | 15 | 293 | 0 | 293 |
| What We're NOT Doing | **25** | 277 | 0 | 277 |
| Current State | 19 | 242 | 0 | 242 |
| Proposed Solution | 19 | 207 | 0 | 207 |
| Dependencies & Risks | 18 | 159 | 0 | 159 |
| System-Wide Impact | 19 | 135 | 0 | 135 |
| Technical Considerations | 16 | 126 | 0 | 126 |
| Overview | 19 | 92 | 0 | 92 |
| Sources / Internal References | 19 | 188 | 0 | 188 |

Two-thirds of total volume is the **implementation body** (Changes Required + Phase bodies), and it
is ~60% code. The remaining third is a **long tail of recurring prose sections present in nearly
every doc** — that tail is where the cheap wins are.

---

## Finding 2 — Review-value: high-scrutiny payload vs skim-tax (inferred)

Bucketing each recurring section by *inferred* review-value (criteria above; honest about the gap):

**HIGH value — the review spine (the user must read these to trust the plan):**
- **The implementation body** — Changes Required / Phase bodies. The exact file paths + actual
  code/markdown. This is the user's stated keep-criterion. *Keep; make cheaper to scan.*
- **Behaviors to Test** + **Success Criteria** + **Acceptance Criteria** — the testable contract;
  concrete and checkable. *Keep.*
- **What We're NOT Doing** — scope boundary; checkable. *Keep — but see Finding 4 (duplicated from
  brainstorm).*

**LOW value — skim-tax (template-mandated prose that rarely earns its space):**
- **Overview / Proposed Solution / Technical Approach / Architecture** — in a COMPREHENSIVE plan you
  get 3–4 sections narrating the same approach at different altitudes before any code appears.
  Collapsible to one short "Approach."
- **Risk Analysis & Mitigation** *vs* **Dependencies & Risks** — two risk sections saying
  overlapping things.
- **System-Wide Impact** (5 mandated subsections at COMPREHENSIVE: Interaction Graph, Error
  Propagation, State Lifecycle, API Surface Parity, Integration Test Scenarios) — high prose, often
  speculative; rarely all 5 apply.
- **Testing Strategy** / **Documentation Plan** — frequently *pure duplication*: the propose plan's
  Documentation Plan just re-lists files already in the implementation body; its Testing Strategy
  says "this repo has no test harness" and points back to scenarios listed above.
- **Convention Compliance** — in all 25 docs (~14 lines each); an audit checklist with low
  *ongoing* review value once resolved.
- **Sources / Internal References** — reference apparatus, skimmed.

The skim-tax group (Overview + Proposed Solution + Technical Considerations + Current State +
System-Wide Impact + Dependencies/Risk + Convention Compliance + Sources) totals **~1,500 prose
lines across the corpus** — roughly **60–80 low-scrutiny prose lines per STANDARD/COMPREHENSIVE doc,
none of it code.** That is the target.

---

## Finding 3 — The repo-specific twist: "code %" undercounts the payload

This plugin's *deliverable is markdown* (command specs). So a plan's "code blocks" are often
markdown, and large stretches of the implementation body that *look* like prose (e.g. the propose
plan's `## Important Guidelines`, 143L, and its embedded `Step 2/3/5` bodies, ~160L each) are
actually the **to-be-written command text** — exactly the content the user keeps on purpose to avoid
rewrites. **Implication: a naïve prose-trim would hit the highest-value content.** The fix must
distinguish *deliverable payload* (the command text being authored — keep) from *meta-framing about
the deliverable* (Overview, Risk Analysis, Documentation Plan — demote/merge). The lever is the
framing, not the body.

---

## Finding 4 — Duplication at the brainstorm→plan seam

Decision framing is **owned by `/ba:brainstorm`** (`## Why This Approach`, `## Scope Boundaries`,
`## Key Decisions`, `## Rejected Designs`/Locked Design). But `plan.md` **re-hosts it**:

- Step 0 (`plan.md:39–49`): "Extract and carry forward **ALL** … Scope boundaries (What We're NOT
  Doing) … Chosen approach and why alternatives were rejected … Acceptance criteria."
- Step 6 cross-check (`plan.md:457–471`) forces every brainstorm decision back into the plan body.
- COMPREHENSIVE's `### Alternative Approaches Considered` is a near-verbatim re-derivation of the
  brainstorm's `## Why This Approach` / `## Rejected Designs`.

Step 0 says to reference decisions via `(see brainstorm: …)` and *not paraphrase* — but Step 6's
"every decision must be reflected" pushes toward **restating**. The net effect: scope, alternatives,
and acceptance criteria are written twice (brainstorm + plan). For a brainstorm-originated
COMPREHENSIVE plan this is a meaningful, avoidable chunk of the framing tax — and `slice`/`review-plan`
already prove the repo's "one source of truth" instinct (slice annotates in place; review-plan edits
in place). The plan should **pointer-ize** carried decisions, not re-narrate them.

---

## Where the cost actually lives (the verdict)

1. **Level inflation** is the biggest single driver: COMPREHENSIVE is 2× STANDARD and 6× MINIMAL.
   The template offers no middle demotion path, so plans land COMPREHENSIVE and absorb all ~10 prose
   sections.
2. **Altitude redundancy**: 3–4 sections narrate the approach before the code; 2 sections narrate
   risk; 5 mandated System-Wide-Impact subsections.
3. **Intra-doc duplication**: Documentation Plan / Testing Strategy restate the implementation body.
4. **Cross-doc duplication**: scope + alternatives + acceptance criteria restated from the brainstorm.
5. **Navigation**: even well-structured, a 1,000-line doc is costly to scroll — the user's HTML
   workaround targets exactly this.

Code blocks are **not** in this list. They are not the problem.

---

## Solution options (open) — with recommendation

Ranked by leverage-to-risk. These are **form** changes (presentation/structure), not purpose changes.

1. **★ Restructure into a "review spine" + demoted appendix (recommended core).** Fixed top-of-doc
   order: scope (What We're NOT Doing) → Behaviors to Test → the file-by-file changes (code) →
   Success Criteria. Everything low-scrutiny (Risk Analysis, Testing Strategy, Documentation Plan,
   full System-Wide Impact, Sources, Convention Compliance) moves below a `<details>`-collapsed
   "Appendix / supporting analysis" fold. Nothing is deleted; the *first screenful* becomes the
   review surface. Mirrors the already-shipped collapsed-section pattern
   (`2026-06-07-feat-preexisting-collapsed-section`).
2. **★ Collapse overlapping framing (recommended).** Merge Overview + Proposed Solution + Technical
   Approach → one short **Approach** (≤8 lines). Merge Dependencies & Risks + Risk Analysis → one
   **Risks** table. Make System-Wide Impact's 5 subsections *include-only-if-it-applies* instead of
   always-5. Drop Documentation Plan + Testing Strategy when they only restate the body.
3. **★ Pointer-ize brainstorm duplication (recommended).** When `origin:` is set, the plan cites
   `(see brainstorm: …#section)` for alternatives/scope rationale and keeps only the one-line scope
   checklist — relax Step 6 from "reflect every decision" to "link every decision."
4. **★ Make code cheaper to scan, not removed (recommended — honors the hard constraint).** Precede
   each code block with a one-line `**File** — intent` header and order changes consistently so the
   user scans diff-shaped content fast. This is the only change that touches the body, and it *adds*
   scannability without cutting.
5. **Demote COMPREHENSIVE itself.** Add guidance/tripwire steering toward STANDARD unless 10+ files
   *and* phasing are genuinely needed; most current COMPREHENSIVE plans would survive as STANDARD.
6. **Companion read-optimized view (secondary).** Auto-generate the HTML/TOC render the user already
   builds by hand. Real value for navigation, but a band-aid: it leaves the full doc's content cost
   intact and adds a generated artifact to maintain. Do this only *after* 1–4.
7. **Do nothing / "cost is elsewhere" (rejected).** The evidence does not support this: the framing
   tax is real, measured, and concentrated.

**Division-of-labor check (per handoff):** none of 1–6 duplicates a sibling. brainstorm still owns
decision framing (option 3 *reduces* plan's encroachment); slice still owns delivery order;
review-plan still owns verdicts + the iteration/LoC gate (options 1–3 would *lower* the LoC the gate
polices). No new responsibility is invented.

---

## Proposed target

| Level | now (avg) | target | how |
|---|---|---|---|
| MINIMAL | 179 | **leave as-is** | already near-ideal |
| STANDARD | 510 | **~400** | options 2–4 |
| COMPREHENSIVE | 1,040 | **~650–750** | options 1–4 (spine + fold + merge + pointer-ize) |

Hard floor: **no code, acceptance criterion, behavior, or scope line is removed** — the reduction is
entirely framing collapse, intra/cross-doc de-duplication, and demotion below a fold. Success is
"the review spine fits in the first 1–2 screens; the rest is reachable but folded," not a raw line
count.

---

## Explicitly out of scope / constraints respected

- **Purpose untouched.** No redefinition of what a plan is for; only how/where content is presented.
- **Code blocks preserved.** Made cheaper to scan (option 4), never cut.
- **No new sibling responsibility.** Decision framing stays in brainstorm.

## Suggested next step

A `/ba:plan` template-revision plan implementing options 1–4 (spine + fold + section merges +
pointer-ize the brainstorm seam + per-file intent headers), with option 5 (COMPREHENSIVE-demotion
nudge) as a small add and option 6 (auto companion view) parked as a follow-up. Validate by
re-rendering 2–3 existing COMPREHENSIVE plans under the new structure and confirming the review spine
lands in the first 1–2 screens.
