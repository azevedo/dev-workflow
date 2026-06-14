---
title: Where the review cost lives in /ba:plan output — consolidated diagnosis
type: research
status: complete
date: 2026-06-14
tags: [plan, verbosity, review-cost, form, dev-workflow, consolidated]
scope: form (how/where plan content is presented for review) — NOT purpose (what a plan is for)
consolidates:
  - docs/research/2026-06-13-plan-verbosity-research.md   # md-only pass (plugin repo)
  - "[internal] code-repo pass, 2026-06-14"               # real code repo; local-only, withheld
sanitization: SANITIZED — generic section names, ratios, and line counts only. No internal repo/file/
  feature/ticket names and no verbatim transcript or review-comment quotes. Findings that can only be
  supported by an internal specific are marked "[internal evidence, withheld]". Safe to push.
---

> **What this is.** A single reconciliation of two prior passes that asked the same question — *why
> does reviewing a `/ba:plan` doc cost too much to read?* Pass A (**md-only**) ran against a
> markdown-deliverable repo: volume was measured but review-value was **inferred**. Pass B
> (**code-repo**) ran against a real code repo with execution transcripts: review-value is
> **observed behavioral evidence**. Where B confirms A, the claim is promoted to a finding. Where B
> contradicts A, A's claim is dropped or revised and the overturning evidence is named.
>
> **Sensitivity.** The code-repo pass contains company-internal data. This consolidated doc is the
> sanitized public-safe version: ratios, line counts, and patterns only. The internal source doc is
> kept local and must not be pushed.

## Summary

**Problem (fixed):** reviewing a `/ba:plan` doc costs the reviewer too much to read. This is about
the **form** of plan output (how/where content is presented), not its **purpose**. Code blocks are
kept on purpose and are never proposed for cutting — at most made cheaper to scan.

**Reconciled diagnosis.** The two passes agree on *what is skimmed* and disagree on *where the volume
is* — and the disagreement is fully explained by the deliverable type.

1. **Both passes agree the standalone framing sections are low-scrutiny skim-tax.** The md-only pass
   inferred it; the code-repo transcripts **confirm it on direct evidence** — the reviewer never
   engages Overview / Proposed Solution / Technical Considerations / Risk Analysis / Testing Strategy
   / Documentation Plan / System-Wide Impact / Sources / Convention Compliance as content during
   review.
2. **The code-repo pass overturns the md-only headline that framing is the *volume*.** In a real code
   repo the framing sections are only **~5% of a COMPREHENSIVE doc and ~14% of a STANDARD doc**. The
   volume the reviewer pays to read is the **implementation body** (60–80% of every painful plan) —
   code plus the prose interleaved *with* the code.
3. **The dominant, previously-invisible cost is prose *inside* the code blocks** — comment/JSDoc
   verbosity. This was undetectable in a markdown repo (its "code" was command specs) and is the #1
   recurring review-cost complaint in the real-repo transcripts.
4. **Design-tension rationale is under-served** — the one place the reviewer wants *more* prose, not
   less. Verbosity is not uniformly the enemy.

**Recommended fix direction (re-derived, not averaged):** the lever is **inside the body, not the
framing**. Restructure to a review-spine + progressively disclose (fold) the skimmed framing;
**compress the prose inside the kept code** (lean why-only comments); make the body **scannable**
(per-change intent headers + consistent ordering); **expand** design-tension rationale and
pointer-ize the brainstorm duplication; reserve a companion read-view for the rare phase-heavy giant.
**Reframe the target from line count to read-time / scannability** — a framing trim cannot make a
code-heavy plan cheap, because the residue is code kept on purpose.

---

## Evidence base & method

| Pass | Corpus | Review-value signal | Reliability of review-value |
|---|---|---|---|
| **A — md-only** (markdown-deliverable repo) | 24 plan docs; template + sibling specs | No usable transcripts, no inline review comments | **Inferred** (hypothesis) |
| **B — code-repo** (real TypeScript/React repo) | 35 plan docs; template + sibling specs; 11 plan-on-screen execution/authoring transcripts; 1 hand-built HTML companion | What the reviewer reacts to vs skims with a plan on screen | **Observed** (behavioral) |

Both passes used the **same section × (volume, code-vs-prose) taxonomy**, so the volume maps merge
directly. "Code" = lines inside ` ``` ` fences; "prose" = non-blank lines outside fences. Neither
pass mined PR/MR review threads — in both repos the plan docs are local and never appear in MRs, so
review-comment data is an *unresolved* source (see the reconciled table). The code-repo pass's 11
plan-on-screen transcripts were the decisive direct signal and stand on their own.

---

## (a) Combined volume map

### By detail level

| Level | n (A / B) | avg lines (A / B) | code % (A / B) | reconciled reading |
|---|---|---|---|---|
| MINIMAL | 6 / 10 | 179 / 251 | 22% / **51%** | near-ideal in both; mostly spine |
| STANDARD | 16 / 23 | 510 / 568 | 40% / **57%** | the workhorse level; majority code in a real repo |
| COMPREHENSIVE | 3 / 2 | 1,040 / 1,532 | 43% / 42% | rare; dominated by code-bearing phase bodies |

**The code ratio flips, exactly as the reconciliation rule predicted (md-only undercounts real
code).** At the two common levels the real repo is **majority code** (51% / 57%) where the md-only
repo read as ~22% / 40% — because the md-only "code" was prose-like command specs. **Consequence: the
prose actually available to trim at the dominant level (STANDARD) is only ~150 lines total, roughly
half of it review-spine.**

**`detail_level` does not predict volume (code-repo only — A could not see this).** STANDARD spanned
99 → 1,722 lines (17×); the largest STANDARD plans were 70–72% code and exceeded the md-only pass's
COMPREHENSIVE *average*. Level inflation runs the **opposite** way from A's claim: plans don't
over-select COMPREHENSIVE and absorb framing — they *under*-select it and cram comprehensive-scale
**code** into STANDARD.

### By section (merged taxonomy)

The striking merge result: **the standalone framing prose budget is roughly constant in absolute
lines across both repos (~80–100 lines/doc).** What changes is the denominator — in a code repo the
body dwarfs it. Both passes measured framing correctly; they only disagreed on its *share*.

| Section | Bucket | Pass A signal (prose-ish) | Pass B per-doc prose (MIN / STD / COMP) |
|---|---|---|---|
| Changes Required / Phase bodies (impl body) | **SPINE** (code + impl prose) | ~⅔ of total volume, ~60% code | 15 / 45 / 362 **(+ code; 60–80% of painful plans)** |
| Behaviors to Test | **SPINE** | 351 ln / 14 docs | 10 / 14 / 47–93 |
| Success / Acceptance Criteria | **SPINE** | 293 ln / 15 docs | 9 / (nested) / (nested) |
| What We're NOT Doing | **SPINE** (scope) | 277 ln / all docs | 6 / 9 / 10 |
| Technical Approach / Considerations | framing | 126 ln / 16 docs | — / 18 / 32 |
| Current State | framing | 242 ln / 19 docs | — / 13 / 25 |
| Proposed Solution | framing (altitude-dup) | 207 ln / 19 docs | — / 9 / 11 |
| Overview | framing | 92 ln / 19 docs | — / 3 / 3 |
| Risk Analysis / Dependencies & Risks | framing | 159 ln / 18 docs | 3 / 6 / 12 |
| System-Wide Impact | framing (5 subs, mostly vestigial) | 135 ln / 19 docs | — / 5 / 14 |
| Testing Strategy / Documentation Plan | framing (often restates body) | in skim group | — / — / 15 |
| Convention Compliance | framing (audit artifact, all docs) | 359 ln / all docs | 10 / 12 / 19 |
| Sources / References | framing | 188 ln / 19 docs | 6 / 16 / 22 |

**Trimmable framing budget (code-repo, measured):** ≈ **82 prose lines on a STANDARD doc** (~14%) and
≈ **98 on a COMPREHENSIVE doc** (~5% of a ~1,976-line plan). The md-only pass's own skim-tax estimate
was ~60–80 prose lines/doc — **the same order of magnitude.** The passes never actually disagreed on
how big the framing is; they disagreed on whether collapsing it solves the problem.

### What generalizes vs what was a plugin-repo artifact

| md-only claim | Generalizes? |
|---|---|
| "Code ≈ 40% of volume" | **Plugin artifact** — real code is 51–57% at MIN/STD; the figure held only because md "code" was specs |
| "Cost is framing, not code" (headline) | **Plugin artifact** — re-tested against real code blocks, the body *is* the cost |
| "COMPREHENSIVE-level inflation is the dominant driver" | **Plugin artifact** — small COMP sample + a repo habit of landing COMPREHENSIVE; inflation actually runs into STANDARD |
| "Target COMPREHENSIVE 1040→650–750 via framing collapse" | **Plugin artifact** — the math does not reach it once code blocks are real |
| Framing sections are low-scrutiny skim-tax | **Generalizes** (now observed) |
| Code/payload is kept on purpose; don't cut it | **Generalizes** |
| brainstorm→plan duplication of scope/alternatives | **Generalizes** |
| review-plan already polices plan-body LoC growth | **Generalizes** |
| MINIMAL is near-ideal; leave it | **Generalizes** |
| Review-spine-first + fold; pointer-ize brainstorm; intent headers | **Generalizes** (helps first-screen in both) |

---

## (b) Reconciled review-value table

Each prior claim marked **corroborated** (behavioral evidence confirms the inference),
**overturned** (behavioral evidence / real code contradicts it), or **unresolved**.

| Claim | Status | What decided it |
|---|---|---|
| Code blocks are kept on purpose — don't cut them | **Corroborated** | Behavioral; and the constraint *extends* — the trim target is the prose/comments *inside* the code, not the code |
| Standalone framing sections are low review-value / skimmed | **Corroborated** | Observed in transcripts: framing is never engaged as content in any plan-on-screen session [internal evidence, withheld for specifics] |
| MINIMAL is near-ideal — leave it | **Corroborated** | Mostly code + ~75 spine prose lines; both repos |
| review-plan already polices plan-body LoC | **Corroborated** | Step 5.5 iteration/LoC gate confirmed in both repos |
| brainstorm→plan duplication of scope / alternatives / acceptance criteria | **Corroborated** | Step 0 ("carry forward ALL…") + Step 6 ("reflect every decision") force restatement; majority of plans are brainstorm-originated |
| **Cost lives in the framing tax (~10 prose sections)** | **Overturned** | Framing is ~5% of a COMP doc / ~14% of STANDARD — skimmed, but **not the volume** |
| **COMPREHENSIVE-level inflation is the dominant driver** | **Overturned** | Inflation runs *into* STANDARD (comprehensive-scale code crammed into STANDARD); COMP is rare |
| **Target: COMPREHENSIVE 1040→650–750 via framing collapse** | **Overturned** | Framing collapse buys ~5% on COMP / ~14% on STANDARD; the residue is code kept on purpose. Wrong target metric |
| Navigation (HTML companion) is a primary cost signal | **Revised (partially overturned)** | Real, but a single instance, on a ~489-line STANDARD plan — a read-comfort nicety, not a giant-doc rescue; secondary |
| Comment / JSDoc verbosity *inside* the code blocks is a cost | **New & dominant** | The #1 recurring review-cost friction in transcripts; structurally invisible to a markdown-deliverable repo [internal evidence, withheld for specifics] |
| Design-tension rationale is under-served (wants *more*) | **New** | The reviewer interrogates approach / alternatives in essentially every painful session; the template gives it ~5 prose lines |
| PR/MR review-comment behavior | **Unresolved** | Neither pass has it — A had none; B did not mine MRs and the plan docs are local. Likely low-impact for a local-doc workflow, but untested |
| Does the comment-verbosity lever generalize to non-code deliverables? | **Unresolved** | In a markdown repo the analog is verbose prose inside command specs; plausible but unmeasured. Stated as "lean prose inside the kept payload" |

---

## (c) Where the review cost actually lives — final diagnosis

1. **The implementation body is 60–80% of every painful plan, and it is code kept on purpose.** Line
   count is intrinsic to the work; it cannot be trimmed away. *(Overturns A's "framing is the
   volume.")*
2. **Comment / JSDoc verbosity inside that body is the #1 recurring review friction.** This is the
   reconciliation of "don't cut code" with "cheaper to read": tighten the *prose in the code*, not
   the code. *(New; invisible to the md-only pass.)*
3. **The standalone framing sections are genuinely skimmed but small (~5–14%).** Folding them improves
   the first-screen review surface; trimming them does **not** solve the read-cost problem.
   *(Corroborates A's review-value inference; overturns A's volume thesis.)*
4. **Design-tension rationale is thin and repeatedly demanded** — an *expansion* target, the one place
   more prose lowers total review cost (it shortens the interrogation loop). *(New.)*
5. **Navigation of phase-heavy giant plans** is a real but occasional pain — secondary. *(Revises A.)*

Code blocks are not the thing to cut — both passes agree. But unlike the md-only pass, the dominant
lever is **inside the body** (comments + scannability), not the framing around it.

---

## (d) Recommended fix direction & evidence-based targets

**Direction: restructure + progressive disclosure + compress-in-body + scannability + expand-rationale.**
Not a blanket trim, not a demotion nudge, not a line-count target. Ranked by leverage; all are
**form** changes; none cuts code, criteria, behaviors, or scope.

1. **★ Compress the prose inside the authored code — lean, why-only comments (highest leverage; new
   from code-repo).** Bake comment hygiene into the code the command emits: why-only, no branch
   enumeration, no restating the renderer/contract, concise prose. Directly kills the #1 repeated
   friction. *Target:* zero post-plan "your comment is too verbose" review turns.
2. **★ Per-change intent headers + consistent file ordering in the body.** The body is 60–80% of the
   doc; a one-line `**File** — intent` per block and a fixed change order make it scan fast without
   removing a line. *Target:* body becomes diff-shaped; read-*time* down with line-count ~flat.
3. **★ Review-spine-first + fold the skimmed framing (progressive disclosure).** Fixed top order:
   `What We're NOT Doing` → `Behaviors to Test` → file-by-file changes → `Success Criteria`. Move
   Risk / Testing Strategy / Documentation Plan / full System-Wide Impact / Sources / Convention
   Compliance below a `<details>` fold. *Target:* spine in the first 1–2 screens; ~82 (STANDARD) /
   ~98 (COMP) framing lines demoted, **not deleted**.
4. **★ Expand design-tension rationale; pointer-ize the brainstorm duplication.** Replace the
   three-altitude Overview / Proposed Solution / Technical Approach narration with one short
   **Approach** *plus* a real **design-tension** note (the fork actually taken and why). When a plan
   is brainstorm-originated, cite the brainstorm section instead of re-deriving it — relax Step 6 from
   "reflect every decision" to "link every decision." *Target:* fewer "what alternatives did you
   consider?" turns.
5. **Auto-generate an HTML companion for phase-heavy giant plans only.** Reproduce the read-view the
   reviewer hand-built, gated to ~1,000+ line / multi-phase plans. Secondary; navigation only.

**Explicitly rejected:** (a) a blanket framing *trim* as the headline fix — it touches ~5–14% and
leaves the cost intact; (b) a COMPREHENSIVE→STANDARD demotion nudge — inflation runs the other way,
this would make it worse; (c) any line-count target premised on framing collapse — the math does not
reach it once code blocks are real.

### Re-derived per-level targets (combined evidence, not an average of the two passes)

| Level | Prior A target | **Reconciled target** | Reasoning |
|---|---|---|---|
| MINIMAL | leave as-is | **leave as-is** | Both passes agree — mostly code, ~75 spine prose lines, near-ideal |
| STANDARD | 510 → ~400 lines | **line count ~flat; first-screen surface ≈ spine only; in-code comments lean** | Trimmable framing is only ~14%; the real win is fold + lean comments + scannable body. A line target misrepresents it |
| COMPREHENSIVE | 1,040 → 650–750 lines | **No framing-collapse line target. Measure read-time. Fold ~98 framing lines; lean comments cut a meaningful share of the ~500 impl-adjacent prose lines on a giant plan; HTML companion for navigation** | 80% of a giant plan is code-bearing phase bodies kept on purpose. A ~2,000-line plan stays large; comment hygiene + scannability + fold lower read-cost without cutting code (~10–20% off via comment hygiene, not ~35%) |

**Success metric:** "the review spine and a scannable body land first; comments are why-only; framing
is folded; design-tension is surfaced up front" — measured by **re-read time and post-plan correction
turns**, not raw line count.

---

## Sibling division-of-labor check (carried from both passes — no new responsibility invented)

- **brainstorm** owns decision framing: *Why This Approach*, *Key Decisions*, *Scope Boundaries*,
  *Acceptance Criteria*, *Rejected Designs* / *Locked Design*, *Convention Compliance*. Fix #4
  *reduces* `plan`'s encroachment here (link, don't re-derive).
- **slice** owns delivery order / LoC counting / slice markers — annotates the plan **in place**.
- **review-plan** owns reviewer discovery/run/consolidate **and** the Plan-Iteration Discipline Check
  (Step 5.5): it polices plan-body LoC *growth across rounds*, not *birth verbosity*. Fixes #1–#3
  *lower* the LoC it polices. Verbosity is already a recognized internal failure mode — these fixes
  attack it at authoring time, where the gate cannot reach.

All five fixes stay inside `plan`'s lane; none duplicates a sibling.

---

## (e) Provenance — what each pass contributed, and where they disagreed

**Pass A (md-only) contributed:**
- The reusable **section × volume × code/prose taxonomy** (both maps merge because of it).
- The **volume-by-section map** and the per-level cost curve.
- The **brainstorm→plan duplication** analysis (Step 0 + Step 6 seam) and the pointer-ize fix.
- The **review-spine + fold + intent-header** structural options.
- The "code kept on purpose" constraint framing and the sibling division-of-labor check.
- *Limitation:* review-value was **inferred** (no transcripts); its "code" was prose-like specs, so
  it undercounted real code and over-weighted framing as the volume.

**Pass B (code-repo) contributed:**
- **Behavioral confirmation** of review-value from transcripts (framing is skimmed; spine is
  scrutinized) — turning A's hypotheses into findings.
- The **real code/prose ratio** (code share flips to majority at MIN/STD).
- The **comment/JSDoc-verbosity finding** — the #1 recurring friction, invisible to a markdown repo.
- The **design-rationale-under-served** finding (an expansion target).
- The **level-inflation-runs-into-STANDARD** correction and the "`detail_level` doesn't predict
  volume" observation.
- The **navigation-is-rare** correction.
- *Limitation:* did not mine MR review threads (plans are local); single-instance HTML-companion data.

**Where they disagreed (and who won):**
- *Is framing the volume?* A: yes. B: no (~5–14%). **B wins** — direct measurement on real code.
- *Is COMPREHENSIVE-inflation the driver?* A: yes. B: no, it runs into STANDARD. **B wins** — larger,
  level-spanning corpus.
- *Is the 650–750 line target right?* A: yes. B: unachievable. **B wins** — the residue is code.
- *Is navigation a primary cost?* A: yes. B: secondary/occasional. **B wins** — single instance.
- *Are framing sections skim-tax?* Both: yes. **No conflict** — A inferred, B observed; promoted.

---

## Constraints respected / out of scope

- **Purpose untouched.** Only how/where content is presented; no redefinition of what a plan is for.
- **Code blocks preserved.** Made cheaper to *scan* (#2) and cheaper to *read* via lean comments
  (#1); never cut.
- **No new sibling responsibility.** brainstorm still owns decision framing; slice still owns delivery
  order; review-plan still owns the LoC/iteration gate.
- **Sanitization.** No internal repo/file/feature/ticket names; no verbatim transcript or
  review-comment quotes. Internal-only support points are marked "[internal evidence, withheld]".

## Suggested next step

A `/ba:plan` template-revision plan implementing #1–#4 — comment-hygiene for authored code → body
intent-headers + consistent ordering → review-spine + fold → expand-rationale / pointer-ize the
brainstorm seam — with #5 (auto HTML companion for the rare phase-heavy giant) parked as a follow-up.
**Validate by re-rendering one giant COMPREHENSIVE plan and one mid STANDARD plan under the new
structure and timing a re-read — not by counting lines.**
