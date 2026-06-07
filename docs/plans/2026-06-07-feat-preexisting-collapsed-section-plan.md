---
title: "feat: Pre-existing collapsed section for /ba:review"
type: feat
status: deferred
date: 2026-06-07
origin: docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md
detail_level: standard
iteration_count: 1
tags: [ba-review, consolidation, pre-existing, hunk-classification, findings-routing]
---

# Pre-existing Collapsed Section for `/ba:review` — Implementation Plan

> **Deferred (2026-06-07).** A measurement of how often `/ba:review` findings actually land on
> pre-existing lines found the friction rare (~4% of findings, 1 of 26), the clearest instance
> already absorbed by the existing confidence gate, and the proposed hunk-level rule prone to
> *mis-collapsing* findings that are about the change (citation drift). Net negative on the sample.
> Full data and rationale: `docs/research/2026-06-07-preexisting-finding-frequency-research.md`.
> The plan below is preserved as the as-if-building design; revisit only if real code review shows
> a higher rate (and prefer the reviewer-self-tag variant noted in the research doc).

## Overview

Add a hunk-level **pre-existing** axis to `/ba:review`'s consolidation pipeline. A finding whose cited line was **not introduced by the author's change** (a context/unchanged line inside a changed file, or a line outside any hunk) is routed to a new default-collapsed `Pre-existing` section — mirroring today's collapsed `Suppressed` section — while author-introduced findings keep rendering inline. Off-diff findings (file outside the diff) stay annotated `(off-diff)` inline and are **never** filtered (hard regression guard). This is item **#3** of the `/ba:review` automation roadmap (see brainstorm: `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md`); item #1 (smarter reviewer selection) has already shipped.

The change is entirely command-prose: `commands/ba/review.md` Step 4 (consolidation) and Step 5 (resolution), plus a `README.md` summary sync and a version bump. No application code, no persistence, no config — recomputed fresh each run from the already-captured `FULL_DIFF`.

## Current State

The consolidation pipeline runs `parse → validate → group → merge → gate → render` (`commands/ba/review.md:691`). Key landing points for this feature:

- **Diff capture (Step 1)** — `FULL_DIFF`, `CHANGED_FILES` (file paths), and `STAT` are captured **once** (`review.md:201-208`). `CHANGED_FILES` is **file-level only**; no step today computes changed-*line* granularity, though `FULL_DIFF` already contains the hunk headers needed to derive it. A STOP rule forbids any fresh `git diff` after capture (`review.md:208`).
- **`4b. Validate` (`review.md:566-580`)** — per-record checks against a table. The last row applies the **`(off-diff)`** annotation: when a record's file is absent from `CHANGED_FILES`, the record is **kept** and `(off-diff)` is appended to its body; informational counter `off_diff` (`review.md:576-578`). `Looks Good` records skip all checks (`review.md:580`).
- **`4d. Merge` (`review.md:586-594`)** — groups at the same `file:line` merge; confidence corroboration adds `+25` per extra reviewer.
- **`4e. Apply soft gate` (`review.md:596-607`)** — below-floor findings route to the collapsed `Suppressed (low confidence)` bucket; `critical_suppressed` is incremented and surfaced in the header "so high-stakes findings are not buried" (`review.md:607`).
- **`4f. Render` (`review.md:609-691`)** — the `Suppressed` block is a collapsed `<details>` with the count in its `<summary>`, inner `#### <severity> *(suppressed)*` H4 sub-headings (`review.md:636-646`); the header-warning block is **strictly ordered** for line-for-line diffability (`review.md:655-666`); merged-finding template at `review.md:670-689`; `displayed_count` is the post-dedup total reported as `Findings: <raw> raw → <displayed> after dedup` (`review.md:618`, `:668`).
- **Step 5 resolution** — four eligibility filters operate on the displayed (non-Suppressed) findings: local Apply-all (`review.md:825`), local Apply-CHM100 (`review.md:846`, "rendered (post-gate) findings only — *not* the `Suppressed` section"), MR Post-all (`review.md:868`), MR Post-CHM100 (`review.md:869`, "the Suppressed section is never eligible").
- **Persist (Step 4.5d)** — `summary.md` embeds the full Step 4 output verbatim (`review.md:788`) and a per-reviewer Validator-Warnings clause that already itemizes `(off-diff)` counts (`review.md:792-795`).
- **Cross-references that move with a renumber** — the merged-template pointer `see 4f` at `review.md:592`; the pipeline string at `review.md:691`.
- **Sync points** — `README.md:165` ("Structured findings" bullet) names only the collapsed `Suppressed` section; `CLAUDE.md:80` documents the never-hide *selection* guarantee with a "mirrored in README.md and review.md — keep in sync" note; version is `0.21.0` (`.claude-plugin/plugin.json:3`). The protected-artifacts guard (reviewer-dispatch templates) is unaffected — this feature lives downstream at consolidation.
- `docs/solutions/` is empty — no prior learnings to draw on.

## What We're NOT Doing

- **No persistence / config / profile file** — classification is recomputed each run from `FULL_DIFF`; stateless, per repo culture.
- **No repurposing of the off-diff flag.** Off-diff (file outside the diff) is an *intentional* one-hop traversal signal for complexity-/deep-module-reviewers; it stays annotated inline, never filtered. Pre-existing is a new, orthogonal hunk-level axis (see brainstorm: *Why This Approach → #3*).
- **No fresh `git diff`.** Hunk ranges come from the already-captured `FULL_DIFF`; the Step 1f STOP rule is honored. Step 1 is left untouched.
- **No auto-apply of fixes** anywhere; pre-existing findings are *excluded* from apply/post eligibility (they are about code the author didn't touch).
- **Not changing `0`-confidence semantics**, the soft-gate floors, the merge math, or the off-diff×gate interaction (an off-diff finding below floor still lands in `Suppressed`, as today).
- **Not item #1 (shipped) or #2 (deferred).** #2 (verify fix + precondition) is sequenced after #3 (see brainstorm: *Roadmap follow-ons*).
- **Off-diff inline-posting gap (pre-existing, deferred).** Off-diff findings stay apply/post-eligible (unchanged); posting one as an inline MR comment on a line outside the diff can be rejected by the platform (e.g. GitHub 422). This pre-dates #3 and is not introduced here — left for a follow-up.

## Behaviors to Test

User-observable behaviors of the consolidated review output this plan must satisfy (derived from the brainstorm's #3 acceptance criteria, `brainstorm:231-242`, plus SpecFlow edge cases):

- [ ] A finding on an author-added (`+`) line of a changed file renders **inline** in its severity section.
- [ ] A finding on a **context (unchanged) line within a changed file's hunk** is routed to the collapsed `Pre-existing` section.
- [ ] A finding on a line in a changed file but **outside every hunk** is routed to `Pre-existing`.
- [ ] An **off-diff** finding (file not in `CHANGED_FILES`) renders **inline, annotated `(off-diff)`**, and is **never** in `Pre-existing` (regression guard — complexity-/deep-module one-hop traversal still surfaces).
- [ ] A finding on a **newly-added file** (all `+` lines) renders inline — never collapsed into `Pre-existing`.
- [ ] The `Pre-existing` section is a collapsed `<details>` whose `<summary>` reports the count; it is **omitted entirely when the count is zero**.
- [ ] A **low-confidence** pre-existing finding appears in `Pre-existing`, **not** `Suppressed` (pre-existing is split before the gate).
- [ ] **No finding disappears:** every finding is inline, or in `Suppressed`, or in `Pre-existing`, or in `Looks Good` — and `inline + Suppressed + Pre-existing + Looks Good == displayed_count`.
- [ ] A pre-existing finding is **not eligible** for Apply-fixes / Post-inline-comments / the one-by-one walk (excluded like `Suppressed`).
- [ ] `Looks Good` items (no `file:line`) are never hunk-classified — always render in their own bucket.
- [ ] Classification uses no fresh `git diff` (STOP rule honored).

## Proposed Solution

Introduce the pre-existing axis as a **tag computed in validation** and a **split applied before the soft gate**, then render a collapsed section that mirrors `Suppressed`:

1. **Tag in `4b`** — for each non-`Looks Good` record on a changed file, decide whether its cited line is author-introduced by walking the file's hunks in `FULL_DIFF`. If not author-introduced → tag `pre_existing`. Off-diff records are skipped (terminal). This co-locates the new location check next to the existing off-diff check.
2. **Split in a new `4e`** — after merge, lift `pre_existing`-tagged records into the Pre-existing bucket; they **skip the gate** (pre-existing routing takes precedence over confidence suppression). The remaining records (author-introduced + off-diff) flow to the gate. Renumber the gate `4e→4f` and render `4f→4g`.
3. **Render in `4g`** — emit a collapsed `Pre-existing` `<details>` after the `Suppressed` block, with the count in its `<summary>`.
4. **Exclude from resolution** — pre-existing findings are not apply/post-eligible.
5. **Sync** — update `README.md:165` and bump `plugin.json` to `0.22.0`.

### Design decisions (genuine forks — recommendations stated)

- **Precedence: pre-existing is split _before_ the gate (RECOMMENDED).** A pre-existing finding goes to `Pre-existing` regardless of confidence, rather than a low-confidence pre-existing finding landing in `Suppressed`. *Rationale:* scope ("is this about the author's change?") is the first cut; confidence gating applies to in-scope findings. Burying a pre-existing finding in `Suppressed` would hide the more useful fact that it is *pre-existing*, and it keeps the section count clean (`Pre-existing` = all not-author-introduced findings). *Alternative (rejected):* gate first, pre-existing only on survivors — splits pre-existing findings across two collapsed sections by confidence, muddier. The SpecFlow analysis concurs.
- **No Critical-on-pre-existing alert (cut in plan review).** An earlier draft added a `critical_preexisting` counter + header line mirroring `critical_suppressed`. Cut: the two are not parallel — `critical_suppressed` protects a finding that *was* going inline from being silently demoted below the fold, whereas a pre-existing finding was never going inline; it is deliberately routed to a visible, labelled section whose `<summary>` already reports the count. The brainstorm's #3 criteria ask only that "the header reports the count" (the `<summary>` satisfies this). Cutting it also removes the new counter and the strict-ordering-block churn.
- **Path keying for the hunk lookup.** The pre-existing classifier matches the finding's file to its diff section via the `+++ b/<path>` header (leading `b/` stripped), independent of how `CHANGED_FILES` was sourced (MR-scope API `files` field vs. local `--name-only`). A file that *is* in `CHANGED_FILES` but has no matching `+++ b/` hunk content (e.g. a pure rename) → **conservative fallback: pre-existing**.

## Technical Considerations

- **LLM-executed arithmetic — the headline risk.** This pipeline is executed by the orchestrator model reasoning over `FULL_DIFF`, not by a parser. Hand-walking `@@` headers and counting `+`/space/`-` lines across multi-hunk diffs is exactly the bookkeeping LLMs do unreliably, and the STOP rule removes the option to re-run `git` to verify. Mitigation: (a) the recurrence is written out explicitly and minimally, with a worked trace; (b) a **conservative fallback** routes any case with no parseable hunk to `Pre-existing`; (c) classification is computed **once per distinct `file:line`** (not per record), keeping each decision local and making merge groups homogeneous by construction.
- **Asymmetric failure modes (stated in the spec).** The two misclassification directions are not equally safe. *Ambiguous → pre-existing* (the conservative fallback) is safe: the finding is demoted to a reachable collapsed section, nothing is lost. The *opposite* — a pre-existing finding miscounted as author-introduced — is the riskier direction: it surfaces inline and becomes **apply/post-eligible**, so a fix could be applied to code the author did not write. There is no runtime signal distinguishing a correctly-classified inline finding from a miscounted one, so the recurrence must be followed precisely; the explicit recurrence + worked trace + per-`file:line` locality are the mitigations.
- **Classification is keyed on `file:line`.** The `pre_existing` tag is a function of the distinct `file:line` location, evaluated **once per location** — so every 4d merge group (all records sharing one `file:line`) inherits a single classification. No mixed-tag groups arise and no tie-break rule is needed.
- **Off-diff terminal guard.** Off-diff (file ∉ `CHANGED_FILES`) and pre-existing (file ∈ `CHANGED_FILES`, line not added) are mutually exclusive by construction; the spec states explicitly that an `(off-diff)`-annotated record is never hunk-classified.

## System-Wide Impact

- **Interaction graph.** New `4e` split sits between merge and gate; the gate (`4f`) now receives only non-pre-existing records; `critical_suppressed` accounting is unchanged (pre-existing findings never reach the gate). No new header counter is introduced.
- **Conservation / counts.** `displayed_count` continues to mean the post-dedup total, now spanning four buckets: `inline (main severity) + Suppressed + Pre-existing + Looks Good == displayed_count`. The `Findings: <raw> raw → <displayed> after dedup` line and its `(no overlap)` branch are unchanged in form; the `displayed_count` *definition* is updated to enumerate the buckets so nothing can silently vanish.
- **Header ordering.** The strictly-ordered warning block (`review.md:657-666`) is **unchanged** — no new warning line (the pre-existing count lives in the section `<summary>`, mirroring how `Suppressed` reports its own count).
- **Resolution parity.** All four Step-5 filters and the one-by-one walk exclude `Pre-existing` (alongside `Suppressed`). The `846/868/869` "post-gate" wording is reworded to "inline findings" (pre-existing never passed the gate); the one-by-one `[total]` denominator counts the inline set only.
- **Persist parity.** `summary.md` inherits the `Pre-existing` section verbatim; the per-reviewer Validator-Warnings clause gains a pre-existing count parallel to the existing off-diff clause.
- **In-file cross-reference.** The renumber updates `see 4f → see 4g` at `review.md:592` and the pipeline string at `:691`.
- **Docs.** `README.md:165` summary names the new section (mechanics stay authoritative in review.md §4 per `README.md:217`); the never-drop invariant is stated in review.md §4 itself. **No `CLAUDE.md` bullet** — the mirrored `Suppressed` section carries no CLAUDE.md convention, so Pre-existing matches that precedent.

## Implementation Approach

### Change 1 — `commands/ba/review.md` 4b: tag pre-existing

**Add a row to the validation table** (after the off-diff row at `review.md:576`):

```markdown
| Cited line is author-introduced — evaluated ONLY when the file is in `CHANGED_FILES` (off-diff records are skipped) | *(deferred — routed in 4e)* If the line is NOT an added (`+`) line in the file's diff hunks, tag the record `pre_existing`; author-introduced lines are left untagged | `pre_existing` (informational, not a warning) |
```

**Add an explanatory note after the table** (after the off-diff/coerced note at `review.md:578-580`):

```markdown
**Author-introduced classification (hunk-level).** A finding is *author-introduced* when its
cited `<line>` is a line the diff **adds**. Compute this from the already-captured `FULL_DIFF` —
do **not** run `git diff` or any diff command (the Step 1f STOP rule still binds). The tag is a
function of the distinct `<file>:<line>` — evaluate it **once per location** (so every 4d merge
group inherits one classification). Match the finding's file to its diff section by the
`+++ b/<path>` header (strip the leading `b/`) and walk that section's hunks, tracking the
**new-file line number**:

- A hunk header `@@ -a,b +c,d @@` sets the new-file counter to `c`, resetting at every hunk (the
  `+c` form with no comma means count 1; ignore any function/context text trailing the second `@@`).
- A line beginning with `+` is **added**: record the current counter as author-introduced, **then**
  increment it.
- A line beginning with a space (context) is unchanged: increment the counter, do not record it.
- A line beginning with `-` (removed) has no new-file line: do **not** increment, do **not** record.

*Worked trace* — two consecutive `+` lines under `@@ -4,2 +5,2 @@`: counter starts at 5 → record 5,
increment → record 6, increment → author-introduced set `{5, 6}`. (Record **before** increment, or
consecutive additions come out off by one — this is the single most likely misexecution point.)

A finding whose `<line>` is in the recorded author-introduced set renders inline. Otherwise — a
context line, a line between or outside hunks, or a line mapping to a removed line — it is
**pre-existing**: tag it for Step 4e.

**Off-diff is terminal and separate.** A record already annotated `(off-diff)` (its file is not in
`CHANGED_FILES`) is **never** hunk-classified and **never** routed to Pre-existing — it renders
inline with its `(off-diff)` annotation. This preserves intentional one-hop traversal findings
(complexity-/deep-module-reviewer citing an unchanged neighbour file).

**Diff-shape fallback.** A newly-added file (`@@ -0,0 +1,N @@`) has every line author-introduced →
all its findings render inline (the common new-module case). For everything else, one rule covers
the long tail: a file that *is* in `CHANGED_FILES` but has **no parseable `@@` hunk for the cited
line** — pure rename, mode-only change, combined `@@@` merge diff, truncated or missing hunk —
falls back to **pre-existing** (conservative: collapse rather than fabricate author-introduced).

**`Looks Good` is exempt** — it carries no `file:line`, so it is never hunk-classified (the same
exemption it already has from off-diff and the gate); it always renders in its own bucket.
```

### Change 2 — `commands/ba/review.md` new 4e (split), renumber gate→4f, render→4g

**Insert a new step between `4d. Merge` and the soft gate:**

```markdown
### 4e. Split out pre-existing findings

Each merged record enters 4e in one of two states: **tagged `pre_existing`** (from 4b) → lift it
into the **Pre-existing bucket**; **otherwise** (author-introduced or off-diff) → pass it to the
soft gate (4f). Partition accordingly:

- Pre-existing records **skip the soft gate entirely** — a pre-existing finding renders in the
  Pre-existing section **regardless of confidence**. Scope ("is this about the author's change?")
  is the primary cut; confidence gating is a secondary quality filter that applies only to in-scope
  findings — routing a pre-existing finding to Suppressed would hide that it is pre-existing. They
  are still merged and attributed (4d) among themselves.
- All remaining records (author-introduced **and** off-diff) continue to the soft gate (4f).

Let `P` = the number of (post-merge) findings in the Pre-existing bucket — reported in the section
`<summary>` at render.
```

**Renumber** the existing `### 4e. Apply soft gate` → `### 4f. Apply soft gate` and **lead its body with the subset constraint as a standalone first sentence** (not a parenthetical, so a future editor cannot re-expand its scope): "**This gate operates only on the records passed through from 4e — author-introduced and off-diff. Pre-existing findings are already removed.**" The existing floor-comparison text follows unchanged. Renumber `### 4f. Render` → `### 4g. Render`. Update the merged-template pointer at `review.md:592` from `(see 4f)` to `(see 4g)`. Update the pipeline string at `review.md:691` to:

```
The pipeline operates as `parse → validate → group → merge → split-pre-existing → gate → render`:
pre-existing findings are lifted out before the gate (so they route by scope, not confidence), and
dedup still happens before the gate so corroboration can promote an in-scope finding past its floor.
```

### Change 3 — `commands/ba/review.md` 4g: render the Pre-existing section

**Add the collapsed block to the render template, immediately after the `Suppressed` `<details>` (after `review.md:644`) and before `## Coverage`:**

````markdown
<details>
<summary><strong>Pre-existing — <P> findings (on code not introduced by this change)</strong></summary>

#### Critical *(pre-existing)*
- **<file>:<line>** *(confidence: <N>)* — <body or merged template>

#### High *(pre-existing)*
- ...
</details>
````

With a note: **omit the entire `<details>` block when `P == 0`** (matching empty-Suppressed behavior); use the same merged-finding template; inner H4 sub-headings for the same heading-level reason as Suppressed (`review.md:646`). The strictly-ordered header-warning block (`review.md:657-666`) is **not touched** — the pre-existing count lives in the section `<summary>`, exactly as `Suppressed` reports its own count.

**Update the `displayed_count` definition** at `review.md:668` so the never-drop invariant is stated in §4 itself: every post-dedup finding lands in exactly one bucket — an inline severity section, `Suppressed`, `Pre-existing`, or `Looks Good` — so `inline + Suppressed + Pre-existing + Looks Good == displayed_count` and nothing is silently dropped. This is the **authoritative** statement of the findings-routing guarantee (`README.md` carries only the summary).

### Change 4 — `commands/ba/review.md` Step 5: exclude Pre-existing from resolution

- **`review.md:825`** (local Apply-all) — append: "(Low excluded — nit/style is not auto-applied; the collapsed `Suppressed` and `Pre-existing` sections are never eligible)".
- **`review.md:846`** (local Apply-CHM100) — change "From the **rendered (post-gate) findings only** — *not* the `Suppressed (low confidence)` section" to "From the **inline findings only** (the main severity sections) — **not** the collapsed `Suppressed` or `Pre-existing` sections".
- **`review.md:868`** (MR Post-all) — change to "Post all **inline** findings (main severity sections only — the collapsed `Suppressed` and `Pre-existing` sections are never eligible) as inline comments".
- **`review.md:869`** (MR Post-CHM100) — change "operating on the rendered (post-gate) findings only — the Suppressed section is never eligible" to "operating on the **inline** findings only — the `Suppressed` **and `Pre-existing`** sections are never eligible".
- **One-by-one walk** (`review.md:830`/`:875`) — add a one-liner that the walk covers the same inline set the apply/post filters use (excludes `Suppressed` and `Pre-existing`), and that the `Finding [N]/[total]` denominator counts **that inline set only** — not `displayed_count`.

### Change 5 — `commands/ba/review.md` Step 4.5d: persist parity

- **`review.md:788`** — add "the pre-existing section" to the verbatim-output list ("… the suppressed section, **the pre-existing section,** and the header warning counters").
- **`review.md:792-795`** — extend the per-reviewer Validator-Warnings clause with "`<K>` findings classified pre-existing", parallel to the existing "`<K>` findings annotated `(off-diff)`".

### Change 6 — `README.md:165` (summary only)

Extend the "Structured findings" bullet's tail:

```markdown
… and a soft confidence gate that surfaces high-noise findings in a collapsed `Suppressed` section,
plus a hunk-level pre-existing axis that routes findings on code the change did not introduce into a
collapsed `Pre-existing` section (off-diff findings stay annotated inline, never filtered)
```

Keep it a summary — the recurrence, fallback, and diff-shape rules stay authoritative in review.md §4 (`README.md:217`).

### Change 7 — `.claude-plugin/plugin.json`

Bump `version` `0.21.0` → `0.22.0` (`:3`). Required — it is the auto-update cache key; do not defer.

## Success Criteria

### Automated

- [ ] `python3 -c "import json,sys; d=json.load(open('.claude-plugin/plugin.json')); sys.exit(0 if d['version']=='0.22.0' else 1)"` — version bumped and JSON valid.
- [ ] `grep -q "split-pre-existing" commands/ba/review.md` — pipeline string updated.
- [ ] `grep -q "### 4e. Split out pre-existing findings" commands/ba/review.md` and `grep -q "### 4g. Render" commands/ba/review.md` — new step + renumber present.
- [ ] `! grep -q "(see 4f)" commands/ba/review.md` — no dangling old cross-reference.
- [ ] `! grep -q "post-gate" commands/ba/review.md` — the imprecise "post-gate" wording is fully removed from the Step-5 filters.
- [ ] `grep -q "Pre-existing" commands/ba/review.md` **and** `grep -q "Pre-existing" README.md` — section present and user-facing summary synced.
- [ ] `grep -c "Pre-existing" commands/ba/review.md` returns ≥ 4 — present in the 4b note, 4e, the 4g render block, and the four Step-5 filters.

### Manual

- [ ] **Dry-run reasoning trace** on a crafted diff (one finding on a `+` line, one on a context line within the same hunk, one off-diff, one on a new file): confirm routing is inline / Pre-existing / inline-annotated / inline respectively, and `inline + Suppressed + Pre-existing == displayed_count`.
- [ ] Confirm a low-confidence pre-existing finding lands in `Pre-existing`, not `Suppressed`; confirm a Critical pre-existing finding emits the header line.
- [ ] Confirm `Pre-existing` `<details>` is omitted when no findings qualify.
- [ ] **Real-harness `/ba:review` run** verifying the above end-to-end — deferred to the follow-up per the repo's "prompt-only changes ship on a dry-run" practice; the dry-run trace above is sufficient to ship this slice.

## Dependencies & Risks

- **LLM line-number reliability** (see Technical Considerations → *Asymmetric failure modes*) — mitigated by the explicit recurrence + worked trace + conservative fallback + per-`file:line` evaluation. The safe direction (ambiguous → `Pre-existing`) only attention-demotes a reachable finding; the riskier direction (a pre-existing finding miscounted as author-introduced → inline → apply-eligible) has no runtime signal, so the recurrence must be followed precisely. Acceptable for a stateless best-effort classifier.
- **Path-form mismatch** between `CHANGED_FILES` (API metadata in MR scope) and `+++ b/` hunk paths — handled by the conservative fallback (no hunk match for a changed file → pre-existing).
- **Renumber ripple** — the only known internal pointer is `see 4f` at `review.md:592`; covered by an automated grep guard above.
- No external dependencies; no new tooling; no test harness exists for command prose (verification is grep + dry-run trace).

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md` — #3 design (`:70-72`, `:132-138`, `:181-183`), acceptance criteria (`:231-242`), forward-looking notes (`:300-310`), build order #1→#3→#2 (`:76`).
- **Command under change:** `commands/ba/review.md` — pipeline (`:542-691`), off-diff (`:576-578`), gate (`:596-607`), render/Suppressed (`:609-691`), header ordering (`:655-666`), Step 5 filters (`:825`/`:846`/`:868`/`:869`), persist (`:788`/`:792-795`), cross-refs (`:592`/`:691`).
- **Sync targets:** `README.md:165` (+ `:217` source-of-truth note), `.claude-plugin/plugin.json:3`. (No `CLAUDE.md` change — Pre-existing matches the `Suppressed` precedent, which carries no CLAUDE.md convention bullet.)

## Convention Compliance

Checked via `convention-checker` against `CLAUDE.md`, `README.md`, and `commands/ba/review.md` — **no violations**. Three warnings folded into the plan:

- [x] **Planning-commands-never-write-code** — aligned; edits are command prose + docs + version only.
- [x] **Mandatory convention gate before write** — aligned; run before this plan was written to disk.
- [x] **Artifact path + YAML frontmatter** — aligned (`docs/plans/2026-06-07-feat-…-plan.md`, full frontmatter).
- [x] **Version bump required** — aligned (Change 7, `0.21.0→0.22.0`).
- [x] **Update README when command behavior changes** — aligned (Change 6); kept a summary, mechanics stay in review.md §4 per `README.md:217`.
- [x] **Never-silently-drop invariant stated, not over-documented** — the findings-routing guarantee is authoritative in `review.md` §4 (Change 3) with a `README.md` summary; **no** new `CLAUDE.md` bullet, matching the mirrored `Suppressed` section (which carries none). Plan-review decision over the earlier convention-checker suggestion, on simplicity + every-session context-cost grounds.
- [x] **Off-diff regression guard** — aligned; off-diff stays annotated inline, terminal, never routed to Pre-existing.
- [x] **Protected-artifacts guard untouched** — aligned; feature is downstream of reviewer dispatch.
- [x] **No new agents / no new artifact paths / stateless-no-config** — aligned; recomputed per run from `FULL_DIFF`.
- [x] **Renumber cross-reference fidelity** — addressed; `see 4f → see 4g` at `review.md:592` is an explicit deliverable with a grep guard.
