---
title: Plan-driven Requirements Completeness check, slice-aware (C3)
type: feat
status: shelved
date: 2026-05-17
shelved_date: 2026-06-03
origin: https://github.com/azevedo/dev-workflow/issues/6
detail_level: standard
iteration_count: 2
tags: [ba-review, requirements-completeness, slice-aware, ousterhout-roadmap, c3]
---

# Plan-driven Requirements Completeness check, slice-aware (C3) Implementation Plan

> **Shelved 2026-06-03 — deferred, not abandoned.** The feature only fires when a fresh
> (≤7-day) plan sits in `docs/plans/`, which leaves it no-op on the dominant review case —
> other people's MRs, which carry no linked plan and no `docs/plans/` folder. For self-authored
> `ba:`-workflow code there is a real gap (nothing today verifies `/ba:execute` covered every
> `/ba:plan` behavior), but it is marginal: a fuzzy LLM re-verification of a loop that was
> already produced under discipline. That marginal gain does not justify the cost — ~10 edits to
> `review.md`, two new flags, a new Step 4g with an extra LLM call on **every** `/ba:review`,
> four counters, and permanent coupling between `review.md` and both `plan.md`'s heading
> structure and `slice.md`'s marker grammar. Revisit if review traffic shifts toward
> plan-linked, self-authored diffs, or if the extraction coupling can be made cheap. The full
> design below is preserved as the record of that decision.

## Overview

Add a `## Requirements Completeness` section to `/ba:review`'s consolidated output that maps the captured diff against acceptance criteria / "Behaviors to Test" extracted from the most-recent plan in `docs/plans/`. The section closes the workflow loop opened by `/ba:plan` (declares behaviors) and `/ba:execute` (implements against them): `/ba:review` now verifies that the implementation actually covers what the plan promised. Two new flags (`--plan <path>`, `--slice N`) make the input explicit; auto-discovery preserves current ergonomics. Implemented as orchestrator-level logic in `commands/ba/review.md`, sequenced after reviewer consolidation but not part of the reviewer record pipeline — **not** an eighth reviewer agent.

## Current State

- `commands/ba/review.md:191-199` already discovers the latest plan via `ls -t docs/plans/*.md | head -1` within a 7-day mtime window and passes its Overview + Acceptance Criteria as context to reviewers. The context flows in; no completeness verdict flows out.
- `commands/ba/review.md:15-29` parses one flag today (`--persist`). The pattern of "strip recognized flags, then classify scope" is the precedent new flags must extend.
- `commands/ba/execute.md:15-22` defines the canonical `--slice N` parser shape: scan token → take next token → validate positive integer → emit precise errors for missing/zero/float/non-numeric → strip both tokens. Mirror this exactly.
- `commands/ba/execute.md:57-65` defines the canonical slice-vs-plan validation chain: `1 <= N <= slice_count`; marker lookup; warn-and-stop when markers exist but `sliced: true` is absent; stop when no markers and `--slice N` was provided. Mirror this.
- `commands/ba/plan.md:214,256,325` defines the `## Behaviors to Test *(optional)*` section identically across MINIMAL / STANDARD / COMPREHENSIVE templates with the audience note "review (does the implementation cover every claim)" — an explicit consumer hook.
- `commands/ba/plan.md:205` defines `## Acceptance Criteria` (MINIMAL only); STANDARD / COMPREHENSIVE use `### Success Criteria` / `#### Success Criteria` under "Implementation Approach" / "Implementation Phases" instead (`plan.md:289-295, 357-361`). Heading levels differ; COMPREHENSIVE repeats per phase.
- `commands/ba/slice.md:140-145` defines the slice marker grammar `<!-- slice:N "name" -->`. `slice.md:154-177` shows markers also partition the `## Behaviors to Test` section. `slice.md:192` requires slice markers in Behaviors to match the set in implementation sections.
- `commands/ba/review.md:511-568` is the Step 4f render block (post-pipeline) — produces the `## Code Review Summary` header, severity sections, Suppressed block, and `## Coverage`. Header warning lines for `critical_suppressed`, `coerced`, `snapped`, etc. live at `review.md:559-568`.
- `commands/ba/review.md:656-700` is the persist `summary.md` template; line 678 already records "Plan context" verbatim. Extension point for completeness rendering on persist.
- Hard dependency met: issue #5 (B4+B5+B6+C2 bundle — severity ladder, confidence anchors `{0, 25, 50, 75, 100}`, dedup, light structuring) is CLOSED.
- `.claude-plugin/plugin.json:3` currently reads `"version": "0.19.0"`. Must bump on this release. (Plan was drafted at `0.16.0` on 2026-05-17; the file moved on after subsequent releases. The implementer must re-derive the bump target at implementation time — the version pinned below is correct as of plan-revision 2026-05-25.)
- README.md at lines 151-196 documents `/ba:review`; the feature list at 164-170 mentions persist but not completeness.

## What We're NOT Doing

- **No scope-creep detection.** v1 does not flag code in the diff that doesn't correspond to any criterion. Too noisy on legitimate adjacent changes (refactors, dep bumps). (Per issue #6 §Out.)
- **No checkbox-state contradiction flagging.** `[ ]` / `[x]` state in plan source is ignored in v1 — verdicts are computed from diff vs. criterion text only. (Per issue #6 §Other scoping decisions.)
- **No MR description as a completeness source.** `MR_DESCRIPTION` continues to flow to reviewers as context via the existing `commands/ba/review.md:191-199` path, unchanged. Tracked separately as future enhancement issue #11. (Per issue #6 §MR description handling.)
- **No re-verifying `/ba:tdd`-style test execution.** That command was retired; not C3's concern. (Per issue #6 §Out.)
- **No stale-plan detection beyond surfacing dates.** The section header surfaces the plan's date verbatim; the reader judges staleness themselves. No threshold, no comparison against diff commit dates, no boolean state.
- **No severity escalation of other reviewers' findings.** Completeness gaps do **not** raise the severity of any item in the existing severity buckets. The two surfaces stay independent. (Per issue #6 §Other scoping decisions.)
- **No new agent in `agents/`.** Completeness is orchestrator-level LLM judgement against the captured diff, sequenced after reviewer consolidation but not part of the reviewer record pipeline. (Per issue #6 §Decision.)
- **No schema lift-out from `commands/ba/review.md` §4.** The May 17 consolidation rework deferred the schema lift-out "until a second command consumes it." C3 produces a *different* record shape (criterion, verdict, confidence) — it consumes only the diff and the plan, not reviewer records — so lift-out is still deferred.
- **No mutation of the plan file.** C3 reads plans; it never writes to them. The protected-artifacts guard already in place at `review.md:331, 375, 425` covers this implicitly for reviewers; the orchestrator must not Edit/Write under `docs/plans/` either.
- **No structured YAML records in `summary.md` frontmatter.** v1 renders completeness as a prose section inside `summary.md` body; a structured frontmatter array is YAGNI until a downstream consumer needs it. (Aligned with May 17 plan's lift-out posture.)

## Behaviors to Test

A Kent C. Dodds-style checklist of user-observable behaviors this plan must satisfy. Each line is a candidate test case — what `/ba:review` does for the user, not how.

- [ ] When the latest plan in `docs/plans/` is within 7 days, `/ba:review` (no flag) renders a `## Requirements Completeness` section above the severity sections, listing each criterion with a verdict glyph.
- [ ] When `--plan <path>` points to an existing plan file, the section uses that plan regardless of mtime or 7-day window.
- [ ] When `--plan <path>` points to a missing or unreadable file, `/ba:review` stops with an explicit error message naming the path.
- [ ] When the latest plan is older than 7 days and `--plan` is not provided, the section renders a one-line skip note and does not block the review.
- [ ] When no plan exists in `docs/plans/` at all, `/ba:review` proceeds normally and renders a one-line skip note in the section header — the rest of the review is unaffected.
- [ ] When the plan contains `## Behaviors to Test`, the section uses those entries; `## Acceptance Criteria` / `### Success Criteria` are ignored, and a footnote records the precedence.
- [ ] When the plan contains only `## Acceptance Criteria` (MINIMAL plan), the section falls back to those entries.
- [ ] When the plan contains only `### Success Criteria` / `#### Success Criteria` (STANDARD / COMPREHENSIVE), the section falls back to the union of those blocks.
- [ ] When the plan contains none of the above headings, the section renders a one-line skip note.
- [ ] When `--slice N` is provided and the plan is sliced (`sliced: true` + `<!-- slice:N -->` markers), the section uses only behaviors between marker N and marker N+1 in `## Behaviors to Test`.
- [ ] When `--slice N` is provided but the plan has no markers and no `sliced: true`, `/ba:review` stops with the same error message shape as `/ba:execute --slice N` on a non-sliced plan.
- [ ] When `--slice N` is provided and `N` is out of range vs. `slice_count`, `/ba:review` stops with an out-of-range error matching `/ba:execute`'s wording.
- [ ] When `--slice N` is provided with missing / zero / float / non-numeric `N`, `/ba:review` stops with the same error wording as `/ba:execute`.
- [ ] Each criterion in the section carries one of four verdicts: `✓` (Satisfied, confidence 100), `⚠` (Partially satisfied, confidence 75), `✗` (Not implemented, confidence 50), or `—` (Cannot determine; rendered as a caveat in the section header, not as a per-criterion confidence).
- [ ] When the LLM verdict pass returns a verdict for a criterion text not in the input list, the orchestrator drops that verdict and increments `completeness_unmatched`.
- [ ] When the LLM verdict pass omits a criterion present in the input list, the orchestrator auto-fills `Cannot determine` and increments `completeness_undetermined`.
- [ ] A single header warning line `⚠ <K> requirements not satisfied or partial — see Requirements Completeness above` appears in the consolidation header when `completeness_unsatisfied + completeness_partial >= 1`, ordered after the existing `critical_suppressed` line. The non-actionable drift counters (`completeness_unmatched`, `completeness_undetermined`) are visible in the section header line, not in the warning stack.
- [ ] When `--persist` is passed, the rendered section appears verbatim in `summary.md` under its own `## Requirements Completeness` heading.
- [ ] When `--persist` is **not** passed, behavior outside chat output is unchanged — no files are written for completeness.
- [ ] The Step 5 resolution menu is unchanged. A single footer line under the menu prints `Note: <K> requirements unsatisfied or partial — re-run /ba:execute --slice <SLICE_N> <plan>` (slice variant when SLICE_N is set, otherwise `re-run /ba:execute <plan>`) when `completeness_unsatisfied + completeness_partial > 0`.
- [ ] The protected-artifacts guard remains in force: the orchestrator never modifies any plan file when computing completeness.
- [ ] The section header surfaces the plan's `PLAN_DATE` verbatim so a reader can judge staleness without any threshold computation.

## Proposed Solution

Extend `commands/ba/review.md` with a verdict pipeline sequenced after reviewer consolidation but not part of the reviewer record pipeline. Five concerns added in order:

1. **Flag parsing** (Parse Arguments): scan and strip `--plan <path>` and `--slice N`, with exact error wording mirrored from `commands/ba/execute.md:15-22, 57-65`.
2. **Plan resolution & criteria extraction** (extend Step 1e → new Step 1e+): chain `--plan` > `ls -t … | head -1` (7-day window) > silent skip; extract criteria from `## Behaviors to Test` > `## Acceptance Criteria` (MINIMAL) > `### Success Criteria` union (STANDARD/COMPREHENSIVE); apply slice filter when `--slice N` is active.
3. **Verdict assignment** (new Step 4g, sequenced after Step 4f reviewer consolidation and before Step 4.5 persist; numbered as a sub-step of Step 4 to preserve the lexicographic order `4a … 4f, 4g, then 4.5`): single LLM call against `FULL_DIFF + CHANGED_FILES + extracted criteria` returning one verdict per criterion plus a one-line evidence pointer; deterministic validator pass to handle unmatched / missing verdicts.
4. **Rendering** (extend Step 4f): inject the `## Requirements Completeness` section above the `## Code Review Summary` header (per issue #6: "top of consolidated summary, before severity-ranked findings"); add one new header warning line consolidating `completeness_unsatisfied + completeness_partial`.
5. **Persistence & resolution menu** (extend Step 4.5d and Step 5): include section verbatim in `summary.md` body; add a one-line footer to the resolution menu when gaps exist.

The verdict pass is LLM-driven (issue #6: "Plan-vs-diff comparison is fuzzy"), matching the precedent set by the existing parse-validate-merge-gate-render pipeline (`commands/ba/review.md:593` documents this LLM-driven posture: "the parser is LLM-driven, not regex-driven … non-determinism is bounded but real"). Bounding mitigations: the LLM returns only a verdict name (one of `Satisfied | Partial | NotImplemented | CannotDetermine`), and the orchestrator assigns the confidence anchor from the canonical vocabulary block in Step 4g (drawn from the existing `{0, 25, 50, 75, 100}` set); a deterministic validator surfaces drift (unmatched / undetermined counters) rather than silently dropping; a single combined header warning makes actionable drift visible above the fold while non-actionable validator-quality counters stay in the section header.

## Technical Considerations

- **Architecture impact:** localised to `commands/ba/review.md`. No new agent, no new command, no new artifact path. Coupling to `commands/ba/plan.md` heading structure and `commands/ba/slice.md` marker grammar is intentional — the value of C3 *is* this coupling.
- **Performance:** one additional LLM call per `/ba:review` invocation (the verdict pass). Runs after reviewer parallel fan-out completes; does not extend critical path significantly.
- **Security:** reads from `docs/plans/` and the captured diff; no external network. No new attack surface. The orchestrator must not Edit/Write under `docs/plans/` (protected by the existing guard rationale at `review.md:331, 375, 425`).
- **Backwards compatibility:** invocations without `--plan` / `--slice` retain current behavior plus the new section. Invocations with no resolvable plan render a one-line skip note and otherwise produce identical output to today. The Step 5 menu retains identical option ordering.
- **Coupling fragility:** changes to plan template heading levels (`### Success Criteria` → `## Success Criteria`, for instance) or to slice marker grammar would break extraction. Mitigation: the extractor matches on permissive regex (`^## Behaviors to Test(\s*\*\(optional\)\*)?\s*$`) and falls back gracefully through the source hierarchy.

## System-Wide Impact

- **Interaction graph.** `/ba:review` → (existing) plan discovery → (new) criteria extraction → (existing) reviewer fan-out → (new) verdict pass → (new) section render → (existing) persist + Step 5 menu. The new pipeline is sequential after reviewer consolidation, not interleaved. No callbacks or middleware affected.
- **Error propagation.**
  - `--plan` missing/unreadable → hard error, stop before reviewer dispatch (explicit user intent → loud failure).
  - `--slice N` malformed / out of range / against non-sliced plan → hard error, stop before reviewer dispatch (mirror `/ba:execute`'s tone for consistency).
  - Auto-discovered plan missing / older than 7 days / has no extractable criteria → silent skip with single-line header note; review proceeds normally.
  - LLM verdict pass throws → log a single line `⚠ Requirements check skipped — verdict pass failed (<reason>)` in the section header; review proceeds (graceful degradation).
- **State lifecycle risks.** The orchestrator reads the plan once at Step 1e+; no caching across reviewer dispatch. Race window where the plan disappears between resolve and verdict pass is folded into the generic verdict-pass-failure path (`COMPLETENESS_FAILED=true`, `<reason>` field carries the "plan file unreadable" distinction in the skip-line). No state is persisted between runs except `summary.md` on `--persist`, which is opt-in and downstream of all decisions.

## Implementation Approach

### Changes Required

#### 1. Argument hint

**File:** `commands/ba/review.md` (line 4)

Replace:

```yaml
argument-hint: "[MR URL, !N, #N, git ref range, --local, or empty]"
```

with:

```yaml
argument-hint: "[MR URL, !N, #N, git ref range, --local, or empty] [--persist] [--plan <path>] [--slice N]"
```

#### 2. Parse Arguments — extend flag block

**File:** `commands/ba/review.md` (insert after the `--persist` bullet at line 19, before the "Everything else" bullet at line 27)

```markdown
- **`--plan <path>`**: Scan for the token `--plan` followed by the next whitespace-delimited token. Treat that token as a path to a plan file. Strip both tokens from the argument string. Validate **here**, before Step 1a, so `--plan` errors surface before reviewer dispatch (explicit user intent → loud failure). If `--plan` is the last token with nothing after it, announce: "Missing path after `--plan`. Use `--plan <path>` (e.g., `--plan docs/plans/2026-05-17-feat-x-plan.md`)." and stop. If the path does not resolve to a readable regular file (or symlink to one), announce: "Plan file not found or not readable: `<path>`." and stop. Set `PLAN_PATH=<resolved path>` and `PLAN_EXPLICIT=true`.

- **`--slice N`**: Scan for the token `--slice` followed by the next whitespace-delimited token. Validate that token as a positive integer (mirror `commands/ba/execute.md:19` exactly). If valid, set `SLICE_N=<integer>` and strip both tokens. If `--slice` is the last token with nothing after it, announce: "Missing slice number after `--slice`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop. If the token is zero, negative, a float, or non-numeric, announce: "Invalid slice number: `<raw token>`. Use `--slice N` where N is a positive integer (e.g., `--slice 1`)." and stop. Range validation against `slice_count` happens in Step 1e+ once the plan is resolved.

**Validation timing note.** `--plan` is fully validated here in Parse Arguments (path existence + readability) because the path is self-contained. `--slice N` is *syntactically* validated here (positive integer) but *semantically* validated in Step 1e+ — its range check requires `slice_count` from the plan's frontmatter, which is unknown until the plan is read. A user who passes `--plan /valid.md --slice 99` therefore sees the `--plan` error path immediately and the slice range error later in Step 1e+. This asymmetry is intentional and not a bug.
```

Also update the "Everything else" bullet (line 27) to read:

```markdown
- **Everything else** after stripping `--persist`, `--plan <path>`, and `--slice N`: treat as the scope argument and proceed to Step 1a classification. The remaining string may still contain `--staged` or `--local` (scope tokens) or be empty (local-auto).
```

Update the Note at line 29 to drop "explicit unknown-flag validation is out of scope for this change" and instead acknowledge the three recognized flags:

```markdown
**Note:** Unknown flags (e.g., `--persists`, `-persist`, `--plans`) are not recognized — they fall through to scope classification and will produce a downstream error (`git diff` reporting an unknown revision). This matches existing behavior; explicit unknown-flag validation remains out of scope.
```

#### 3. Plan resolution and criteria extraction — replace Step 1e

**File:** `commands/ba/review.md` (replace lines 191-199 in their entirety)

```markdown
### 1e. Resolve plan and extract criteria

This step now serves two consumers: reviewer context (existing) and the Requirements Completeness section (new). Run the chain below.

**Plan resolution (chain).** Walk this order; stop at the first hit:

1. If `PLAN_EXPLICIT` is `true` (set in Parse Arguments when `--plan <path>` was given), `PLAN_PATH` is already populated — skip the 7-day staleness check, explicit intent overrides recency.
2. Otherwise, run:

   ```bash
   ls -t docs/plans/*.md 2>/dev/null | head -1
   ```

   If a file is returned and its mtime is within the last 7 days, set `PLAN_PATH` to that path. Older or missing → fall through.
3. Otherwise, set `PLAN_PATH=""`. Requirements Completeness will silent-skip with a header note.

If `PLAN_PATH` resolved, capture `PLAN_DATE` = mtime of the plan file (`stat -f %Sm -t %Y-%m-%d <path>` on macOS, `stat -c %y <path> | cut -d' ' -f1` on Linux — try macOS form first, fall back). `PLAN_DATE` is surfaced verbatim in the section header so the reader can judge staleness themselves; no threshold is computed.

**Slice validation (only when `SLICE_N` is set).** Mirror `commands/ba/execute.md:57-65`:

- If no plan resolved → announce: "`--slice N` requires a plan. Pass `--plan <path>` or ensure `docs/plans/*.md` has a recent sliced plan." and stop.
- Read the plan's frontmatter and check for `sliced: true` and `slice_count: <K>`.
- **Plan sliced AND `1 <= SLICE_N <= K`:** find the `<!-- slice:SLICE_N "..." -->` marker in the implementation section. If missing, announce: "Slice `SLICE_N` marker not found in the plan file. The plan may need re-slicing — run `/ba:slice` to fix." and stop.
- **Plan sliced AND `SLICE_N` out of range:** announce: "Slice `SLICE_N` does not exist. This plan has `K` slices. Use `--slice 1` through `--slice K`." and stop.
- **Plan NOT sliced AND markers exist in file:** announce: "Plan has slice markers but `sliced: true` is not set in frontmatter. Run `/ba:slice` to fix, or add `sliced: true` manually." and stop.
- **Plan NOT sliced AND no markers:** announce: "This plan is not sliced. Run `/ba:slice` first, or remove `--slice N` to review the full plan." and stop.

**Reviewer context (existing path, unchanged behavior).** If `PLAN_PATH` resolved, read the plan's Overview and Acceptance Criteria sections (existing rule). For MR scope, also use `MR_DESCRIPTION` as context. Pass to reviewers in Step 3.

**Criteria extraction for Requirements Completeness.** Apply this hierarchy in order; stop at the first non-empty result:

1. **`## Behaviors to Test`** — match heading regex `^## Behaviors to Test(\s*\*\(optional\)\*)?\s*$`. Take all task-list bullets (`^- \[[ xX]\]\s+`) under this section. A bullet's text spans from the bullet marker to either the next bullet, the next `##` / `###` heading, or end of file. Code fences inside a bullet are preserved verbatim. Strip the `[ ]` / `[x]` glyph from the text (state ignored in v1) and trim whitespace. Set `CRITERIA_SOURCE="behaviors"`.

   **Slice filter (when `SLICE_N` is set):** within the Behaviors block, find `<!-- slice:SLICE_N "..." -->` and `<!-- slice:(SLICE_N+1) "..." -->` markers (regex `^<!-- slice:(\d+) "[^"]*" -->$`). Take only bullets between those two markers (or between marker `SLICE_N` and the next `##`/`###` heading if there is no `SLICE_N+1` marker). If marker `SLICE_N` is absent in the Behaviors section but present in the implementation section, log a header note: "Slice marker present in implementation but missing from Behaviors to Test — slice-scoped criteria may be incomplete." and continue with what is found.

2. **`## Acceptance Criteria`** — if step 1 yielded nothing, match heading regex `^## Acceptance Criteria\s*$` and take all task-list bullets under it (same bullet rules as step 1). Set `CRITERIA_SOURCE="acceptance"`. Slice filter does not apply (this heading exists only in MINIMAL plans, which are not normally sliced).

3. **`### Success Criteria` / `#### Success Criteria`** — if both above yielded nothing, scan all headings matching `^#{3,4} Success Criteria\s*$` and union their bullets. Inside each such block, sub-headings matching `^#{4,5} Automated:\s*$` and `^#{4,5} Manual:\s*$` are *not* used as section breaks — bullets under both feed into the unioned list. Set `CRITERIA_SOURCE="success"`. Note: COMPREHENSIVE plans repeat per phase, so the union may produce a superset broader than the diff scope; this is acceptable for v1.

4. **None of the above** — set `CRITERIA=[]` and `CRITERIA_SOURCE=""`. Requirements Completeness will skip with header note "plan found but no criteria extracted (`<path>`)".

If both `## Behaviors to Test` and `## Acceptance Criteria` produce non-empty lists in the same plan, prefer Behaviors and emit a section footnote: "Acceptance Criteria present but Behaviors to Test took precedence."

Persist for later steps: `PLAN_PATH` (resolved path or empty), `PLAN_DATE`, `PLAN_EXPLICIT` (boolean — `true` only when `--plan <path>` was given), `CRITERIA` (list of trimmed strings), `CRITERIA_SOURCE`, `SLICE_N` (or unset), and any header notes accumulated above.
```

#### 4. Store captured data — extend Step 1f

**File:** `commands/ba/review.md` (extend the bullet list at lines 204-206)

Replace lines 204-206:

```markdown
- **STAT** — file-level change summary
- **CHANGED_FILES** — list of affected file paths
- **FULL_DIFF** — the complete unified diff
```

with:

```markdown
- **STAT** — file-level change summary
- **CHANGED_FILES** — list of affected file paths
- **FULL_DIFF** — the complete unified diff
- **PLAN_PATH**, **PLAN_DATE**, **CRITERIA**, **CRITERIA_SOURCE**, **PLAN_EXPLICIT**, **SLICE_N** — plan context for the Requirements Completeness section in Step 4g. May be empty / unset; the section gracefully skips in that case.
- **COMPLETENESS_RECORDS** — list of validated verdict records, one per `CRITERIA` entry, in `CRITERIA` order. Each record is `{criterion_text: string, verdict: Satisfied | Partial | NotImplemented | CannotDetermine, confidence: 100 | 75 | 50 | null, evidence: string}`. `confidence` is `null` for `CannotDetermine`; `evidence` is `""` when absent. Initialized to `[]` when the verdict pass is skipped (see Step 4g skip rule).
- **completeness_unsatisfied**, **completeness_partial**, **completeness_unmatched**, **completeness_undetermined** — counters used by Step 4f header warnings and Step 5 footer. Initialized to `0` when the verdict pass is skipped.
- **COMPLETENESS_FAILED**, **COMPLETENESS_FAILURE_REASON** — boolean and free-form one-line string (see Step 4g.c). Initialized to `false` and `""`.
```

#### 5. Verdict pass — new Step 4g (after Step 4f, before Step 4.5)

**File:** `commands/ba/review.md` (insert a new heading after Step 4f's `---` at line 595, before Step 4.5 begins at line 597)

```markdown
## Step 4g: Requirements Completeness Verdict Pass

> **Skipped entirely when `CRITERIA` is empty.** A skip header note is rendered in Step 4f; no verdict pass runs. **Initialize the downstream state explicitly so Step 4f, Step 4.5d, and Step 5 always read defined values:**
>
> ```
> COMPLETENESS_RECORDS = []
> completeness_unsatisfied = 0
> completeness_partial = 0
> completeness_unmatched = 0
> completeness_undetermined = 0
> COMPLETENESS_FAILED = false
> COMPLETENESS_FAILURE_REASON = ""
> ```

When `CRITERIA` is non-empty, the orchestrator issues one targeted LLM call to assign a verdict to each criterion against `FULL_DIFF + CHANGED_FILES`. Verdict assignment is LLM-driven (not regex-driven) — plan-vs-diff comparison is fuzzy and prose-shaped. The validator step below bounds drift the same way Step 4b bounds reviewer-output drift.

### Verdict vocabulary (canonical reference — single source of truth)

All downstream sites (Step 4g.a prompt, Step 4g.b validator, Step 4f render, Step 4.5d persist, Step 5 footer) reference this block by name. Do not duplicate the table — cite it.

| Name | Symbol | Confidence anchor | Meaning |
|---|---|---|---|
| `Satisfied` | `✓` | `100` | Implementation found in the diff that fully addresses the criterion. |
| `Partial` | `⚠` | `75` | Implementation present in the diff but incomplete, or diverges from the plan's approach. |
| `NotImplemented` | `✗` | `50` | No matching implementation found in the diff. Lower confidence — absence is harder to verify than presence. |
| `CannotDetermine` | `—` | `null` | Criterion is ambiguous, out of scope of the diff, or otherwise impossible to judge. Do not invent. |

**Confidence anchor ownership.** The anchor column is for the **orchestrator**, not the LLM. The LLM-facing prompt in 4g.a does **not** show the anchor numbers — the orchestrator assigns them in 4g.b after the LLM returns a verdict label. This avoids a no-op round-trip where the LLM is told "return 100" and the validator immediately snaps to 100.

### 4g.a. Issue the verdict call

Dispatch a fresh `general-purpose` subagent with this prompt template (confidence numbers deliberately omitted — see vocabulary block above):

- Task general-purpose("Map each plan criterion below against the diff. For each criterion, return one verdict and one one-line evidence pointer (file:line if available, otherwise a short prose locator).

**Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming, archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These directories are intentional workflow outputs. You are judging implementation completeness against a plan — never propose modifying the plan file itself or any other artifact under the protected roots.

**Verdict vocabulary (use the canonical names below — symbols and confidence are assigned by the caller, not by you):**

| Name | Symbol | Meaning |
|---|---|---|
| `Satisfied` | `✓` | Implementation found in the diff that fully addresses the criterion. |
| `Partial` | `⚠` | Implementation present in the diff but incomplete, or diverges from the plan's approach. |
| `NotImplemented` | `✗` | No matching implementation found in the diff. |
| `CannotDetermine` | `—` | Criterion is ambiguous, out of scope of the diff, or otherwise impossible to judge. Do not invent. |

**Return format (exact, one record per criterion):**

```
- **<criterion text, verbatim>** — <verdict-name> *(evidence: <file>:<line>)*
  <optional one-line elaboration>
```

For `CannotDetermine`, omit the `(evidence: ...)` parenthetical. Return only the verdict name (`Satisfied` / `Partial` / `NotImplemented` / `CannotDetermine`) — do not include a confidence number.

**Do not invent criteria.** Return exactly one record per input criterion. Match criterion text verbatim — the orchestrator validates by exact-string match (after whitespace normalization).

**Criteria to judge:**
<one bullet per CRITERIA entry, fenced in a markdown code block to preserve exact text>

**Plan source:** `<PLAN_PATH>` (criteria extracted from `<CRITERIA_SOURCE>` section)
**Slice scope:** <`SLICE_N` if set, else `whole plan`>

**Diff:**
<FULL_DIFF>

**Changed files:** <CHANGED_FILES>

You are judging implementation completeness, not code quality. Severity / style / security issues belong to other reviewers — do not duplicate that work here.")

### 4g.b. Validate verdict records

The subagent's return text is parsed once into records `(criterion_text, verdict, evidence)`. The orchestrator then assigns the `confidence` column from the canonical verdict vocabulary anchor (not from the LLM).

| Check | Action on failure | Counter |
|---|---|---|
| Verdict ∈ {Satisfied, Partial, NotImplemented, CannotDetermine} (per vocabulary block above) | Coerce to `CannotDetermine` silently *(no counter: invalid-verdict-label coercion is expected to be rare in v1; introduce `completeness_coerced` if observed)* | (none — internal) |
| `criterion_text` matches an entry in `CRITERIA` after whitespace normalization (collapse runs of whitespace; trim) | Drop record | `completeness_unmatched` |
| Every entry in `CRITERIA` has a returned record | For missing entries, synthesize `(criterion, CannotDetermine, "")` | `completeness_undetermined` |

After validation, assign `confidence` to each record from the anchor in the canonical vocabulary block: `Satisfied → 100`, `Partial → 75`, `NotImplemented → 50`, `CannotDetermine → null`. (No snapping happens — the LLM never returned a number to snap from.)

**Counter definitions** (all four are initialized to `0` in the Step 4g skip-init block above; this step recomputes them when the verdict pass actually ran):

- `completeness_unsatisfied` = count of records with verdict `NotImplemented`.
- `completeness_partial` = count of records with verdict `Partial`.
- `completeness_unmatched` = count of verdict records dropped because the criterion text did not match any input.
- `completeness_undetermined` = count of criteria with no returned verdict (auto-filled `CannotDetermine`).

Persist `COMPLETENESS_RECORDS` (the validated list, in the same order as `CRITERIA`; record shape `{criterion_text, verdict, confidence, evidence}`) and the four `completeness_*` counters for Step 4f and Step 4.5.

### 4g.c. Failure handling

If the verdict subagent fails (timeout, empty return, parse exception, plan-file disappearance during the call), do **not** retry and do **not** block the review. Set `COMPLETENESS_FAILED=true` and `COMPLETENESS_FAILURE_REASON=<one-line free-form string>`.

**`COMPLETENESS_FAILURE_REASON` is a free-form human-readable string** — not an enum. The render layer interpolates it verbatim into the skip-note. Canonical example values used by the implementation: `"LLM timeout"`, `"plan file unreadable"`, `"parse exception"`, `"empty return"`. Implementers may add new strings without changing the render contract.

Step 4f renders a single skip note: `"Requirements check: skipped — verdict pass failed (<COMPLETENESS_FAILURE_REASON>)."`
```

#### 6. Render — extend Step 4f

**File:** `commands/ba/review.md` (extend Step 4f's render template at lines 515-555)

Replace the opening of the template (line 515 `## Code Review Summary` block) so that the Requirements Completeness section is rendered **above** the Code Review Summary header. The new template opens:

````markdown
## Requirements Completeness

<conditional header line — see decision table below>

- ✓ **<criterion text>** — *(evidence: <file>:<line>)*
- ⚠ **<criterion text>** — *(evidence: <file>:<line>)*
  <one-line elaboration if present>
- ✗ **<criterion text>** *(confidence: 50)*
- — **<criterion text>** — cannot determine

<conditional footnote: "Acceptance Criteria present but Behaviors to Test took precedence." — only when both sections were non-empty>

---

## Code Review Summary

…(existing template continues unchanged)
````

**Section header decision table.** Decompose into one binary base-state, plus one optional modifier. The base-state determines whether bullets render at all; the modifier appends ` · slice <SLICE_N>` to the show-rows only.

| Base state | Condition | Header line | Bullets render? |
|---|---|---|---|
| `show — pass` | `CRITERIA` non-empty, verdict pass succeeded, all verdicts `Satisfied` | `Plan: <basename(PLAN_PATH)> (<PLAN_DATE>) · <count> criteria from <CRITERIA_SOURCE> — all satisfied ✓` | yes |
| `show — mixed` | `CRITERIA` non-empty, verdict pass succeeded, any verdict non-`Satisfied` | `Plan: <basename(PLAN_PATH)> (<PLAN_DATE>) · <count> criteria from <CRITERIA_SOURCE> · <NotImplemented> not implemented · <Partial> partial · <CannotDetermine> cannot determine` | yes |
| `skip — no plan` | `PLAN_PATH=""` | `Requirements check: skipped — no plan found.` | no |
| `skip — no criteria` | `PLAN_PATH` resolved, `CRITERIA=[]` | `Requirements check: skipped — plan `<basename>` has no extractable criteria.` | no |
| `skip — failed` | `COMPLETENESS_FAILED=true` | `Requirements check: skipped — verdict pass failed (<COMPLETENESS_FAILURE_REASON>).` | no |

**Slice modifier** (applies only to `show — pass` and `show — mixed` rows, never to skip rows): when `SLICE_N` is set, append ` · slice <SLICE_N>` to the header line. Skip rows are unaffected by `SLICE_N` — a skipped pass is skipped regardless of slice scope.

The plan date is surfaced verbatim in the header so the reader can judge staleness without any threshold computation.

**New header warning line** (extend the block at lines 559-568). Insert one line after the existing `critical_suppressed` line and before the `Defaults applied` line — render only when `completeness_unsatisfied + completeness_partial >= 1`:

```
⚠ <K> requirements not satisfied or partial — see Requirements Completeness above
```

`<K>` substitutes `completeness_unsatisfied + completeness_partial`.

**Rationale for the single-line collapse.** The four-line variant (one warning per counter) duplicated information already visible in the section header (which lists `<NotImplemented>` / `<Partial>` / `<CannotDetermine>` counts inline). The two non-actionable drift counters (`completeness_unmatched`, `completeness_undetermined`) are validator-quality signals, not review-action signals — they belong in the section itself, not in the top-level warning stack. Keep them visible in the section header line but not in the warning stack.

The Requirements Completeness section itself remains above the summary header per issue #6 ("top of consolidated summary, before severity-ranked findings").

#### 7. Persistence — extend Step 4.5d

**File:** `commands/ba/review.md` (extend the `summary.md` template at lines 656-700)

Insert a new bullet after line 678 ("Plan context …") inside the `## Scope` section:

```markdown
- Requirements completeness: <`CRITERIA_SOURCE`> criteria from `<basename(PLAN_PATH)>` (<PLAN_DATE>) — <Satisfied>✓ / <Partial>⚠ / <NotImplemented>✗ / <CannotDetermine>—; or `skipped` with one-line reason if no completeness pass ran
```

Insert a new section after `## Consolidated Findings` (after line 690) and before `## Validator Warnings`:

```markdown
## Requirements Completeness

[The full Step 4f Requirements Completeness section verbatim — section header line, per-criterion bullets, footnote.]
```

When `COMPLETENESS_RECORDS` is empty (skip cases), render the section heading followed by the skip note from the decision table — same as in the chat output. Do not omit the heading; readers diffing two `summary.md` files benefit from a consistent structural skeleton.

#### 8. Resolution menu footer — extend Step 5

**File:** `commands/ba/review.md` (insert after both menus, before the section closes at line 805)

After the local-scope menu block and the MR-scope menu block, add a shared footer paragraph that prints only when `completeness_unsatisfied + completeness_partial > 0`:

```markdown
**Note (after either menu):** When `completeness_unsatisfied + completeness_partial > 0`, print one line after the AskUserQuestion prompt:

> When `SLICE_N` is set:
> "Note: <K> criteria unsatisfied or partial. Re-run `/ba:execute --slice <SLICE_N> <PLAN_PATH>` to address the gaps before merge."
>
> When `SLICE_N` is unset:
> "Note: <K> criteria unsatisfied or partial. Re-run `/ba:execute <PLAN_PATH>` to address the gaps before merge."

`<K>` substitutes `completeness_unsatisfied + completeness_partial`. This line does not add an option to the menu — completeness gaps are *plan-versus-implementation* drift, not reviewer findings, and they belong to `/ba:execute`, not to the apply-fix machinery.
```

#### 9. README update

**File:** `README.md`

Update line 151's `/ba:review [ref range]` heading to `/ba:review [ref range] [--persist] [--plan <path>] [--slice N]`.

Add to the feature bullets between lines 164-170:

```markdown
- **Plan-driven completeness check** — extracts acceptance criteria / Behaviors to Test from the most-recent plan in `docs/plans/` and assigns per-criterion verdicts (`✓` Satisfied / `⚠` Partial / `✗` Not implemented / `—` Cannot determine). Pass `--plan <path>` to override the auto-discovery; pass `--slice N` to scope to a single slice using existing slice markers. Skips gracefully (one-line header note, review continues) when no plan resolves.
```

Optionally, extend the "Severity ladder and confidence anchors" section header (line 172) to also include a "Requirements Completeness" subsection that documents the four verdict glyphs and confidence anchors — defer this if it bloats the README; the command file is authoritative.

#### 10. Version bump

**File:** `.claude-plugin/plugin.json` (line 3)

Change:

```json
"version": "0.19.0"
```

to:

```json
"version": "0.20.0"
```

Minor bump: feature addition, no breaking changes to existing flags or output. **Version is at-implementation-time.** If the file has moved on by the time this slice lands, re-derive the bump (current → current + 0.01.0). The automated success criterion below is keyed to `0.20.0` as of plan-revision 2026-05-25.

### Success Criteria

#### Automated:

- [ ] `grep -n "argument-hint:" commands/ba/review.md` returns the updated hint string that includes `--plan` and `--slice N`.
- [ ] `grep -n "PLAN_EXPLICIT" commands/ba/review.md` returns matches in Parse Arguments and Step 1e+.
- [ ] `grep -n "SLICE_N" commands/ba/review.md` returns matches in Parse Arguments and Step 1e+.
- [ ] `grep -n "## Requirements Completeness" commands/ba/review.md` returns matches in Step 4f render block and Step 4.5d persist template.
- [ ] `grep -n "completeness_unsatisfied" commands/ba/review.md` returns at least three matches (Step 4g skip-init, Step 4g.b counter definitions, Step 4f header warning, Step 5 footer).
- [ ] `grep -n "completeness_unmatched\|completeness_undetermined" commands/ba/review.md` returns matches in Step 4g.b *and* Step 4f section header decision table (validator-quality counters surface in the section header line, not in the warning stack).
- [ ] `grep -n "COMPLETENESS_RECORDS\s*=\s*\[\]" commands/ba/review.md` returns at least one match in the Step 4g skip-init block (defined state for downstream consumers).
- [ ] `grep -n "Verdict vocabulary (canonical reference" commands/ba/review.md` returns exactly one match (single source of truth lives in Step 4g, not duplicated).
- [ ] `grep -n "PLAN_STALE\|30 days\|30d" commands/ba/review.md` returns **zero** matches (the staleness heuristic was dropped during plan iteration).
- [ ] `jq -r .version .claude-plugin/plugin.json` returns `0.20.0` (re-derive if the file has moved on by implementation time — bump is current → current + 0.01.0).
- [ ] `grep -n "Plan-driven completeness check" README.md` returns one match.
- [ ] No new agent file under `agents/review/` or `agents/workflow/` (the change is orchestrator-level only): `git status agents/` shows no additions.
- [ ] `git diff --name-only` shows changes only to `commands/ba/review.md`, `README.md`, and `.claude-plugin/plugin.json`.

#### Manual:

- [ ] Run `/ba:review --local` against a branch where `docs/plans/*.md` has a fresh plan: section appears above the Code Review Summary header with one bullet per criterion.
- [ ] Run `/ba:review --plan docs/plans/<old-plan>.md --local`: section uses that plan regardless of mtime.
- [ ] Run `/ba:review --plan /nonexistent/path.md --local`: command stops with explicit error before reviewer dispatch.
- [ ] Run `/ba:review --slice 1 --local` against a sliced plan: section shows only slice-1 behaviors; `--slice 99` produces out-of-range error.
- [ ] Run `/ba:review --slice 1 --local` against a non-sliced plan: command stops with the same error wording as `/ba:execute --slice 1 <non-sliced-plan>`.
- [ ] Run `/ba:review --local` in a repo with no `docs/plans/` directory: section renders the skip line; review proceeds normally; exit code unchanged.
- [ ] Run `/ba:review --persist --local` and verify `summary.md` contains the Requirements Completeness section verbatim.
- [ ] Run `/ba:review --local` against a plan with **both** `## Behaviors to Test` and `## Acceptance Criteria`: section uses Behaviors and renders the precedence footnote.
- [ ] Run `/ba:review --local` against a MINIMAL plan (only `## Acceptance Criteria`): section uses Acceptance Criteria; `CRITERIA_SOURCE` in `summary.md` says `acceptance`.
- [ ] Run `/ba:review --local` against a STANDARD plan (only `### Success Criteria`): section uses the unioned Success Criteria; `CRITERIA_SOURCE` says `success`.
- [ ] When `NotImplemented` count ≥ 1, the Step 5 menu prints the footer note pointing to `/ba:execute`.
- [ ] Inspect a single review run end-to-end: chat output, persisted `summary.md`, and per-reviewer files. Per-reviewer files do **not** contain Requirements Completeness content (it is orchestrator-level, not reviewer-level).

## Dependencies & Risks

- **Hard dependency (met):** issue #5 (B4+B5+B6+C2) is CLOSED. C3 uses the confidence anchor set `{0, 25, 50, 75, 100}` from B5 and the structured-records posture from C2.
- **Soft dependency:** plan template stability. If `/ba:plan` reshapes its templates (heading levels for `### Success Criteria`, removal of `*(optional)*` tag on `## Behaviors to Test`), the extractor needs updating. Mitigation: extractor regexes are permissive; fallback chain degrades gracefully to silent skip rather than crashing the review.
- **Risk: LLM verdict drift.** Unmatched / hallucinated / dropped criteria. Mitigation: deterministic post-validator with `completeness_unmatched` and `completeness_undetermined` counters surfaced as header warnings. No silent loss.
- **Risk: noisy false-positive `NotImplemented` on legitimate refactors.** A criterion phrased as a target state may be unchanged in the diff because it was already implemented in an earlier slice / branch / merge. Mitigation: the verdict pass receives `FULL_DIFF` + `CHANGED_FILES` but is instructed that absence is harder to verify than presence; lower confidence (50) for `NotImplemented` reflects this. The `30-day plan-stale` note nudges the user to sanity-check.
- **Risk: section position pushes severity findings down.** Per issue #6 the section sits above the Code Review Summary header. For repos with many criteria this can mean scrolling past the section to reach Critical findings. Mitigation: header warning lines (`⚠ <K> requirements not implemented`) inside the existing Code Review Summary header warning stack mirror the section above the header, so a reader scanning warnings still catches gaps without scrolling back up.
- **Risk: race window where plan file disappears between resolve and verdict-pass read.** Mitigation: folded into the generic verdict-pass-failure skip; the `<reason>` field surfaces "plan file unreadable" so the user can distinguish from an LLM failure. Review continues.
- **Risk: tighter coupling between `/ba:review` and `/ba:plan` output.** This coupling is the point — value comes from closing the workflow loop. Accept it; document in command file body that the heading regexes track plan template structure.

## Sources & References

- **Origin issue:** https://github.com/azevedo/dev-workflow/issues/6
- **Hard dependency (closed):** issue #5 — `docs/plans/2026-05-17-feat-ba-review-consolidation-rework-plan.md` (B4+B5+B6+C2 bundle)
- **Related future-work issues:** #11 (MR-description completeness fallback — separate enhancement)
- **Mirrored pattern (slice flag):** `commands/ba/execute.md:15-22` (parsing), `commands/ba/execute.md:57-65` (validation + error wording)
- **Source-of-truth files:**
  - `commands/ba/review.md:4` — argument hint
  - `commands/ba/review.md:11-29` — Parse Arguments
  - `commands/ba/review.md:191-199` — current plan discovery (Step 1e)
  - `commands/ba/review.md:201-210` — captured-data manifest (Step 1f)
  - `commands/ba/review.md:444-593` — Step 4 consolidation pipeline
  - `commands/ba/review.md:511-568` — Step 4f render block + header warnings
  - `commands/ba/review.md:597-712` — Step 4.5 persist
  - `commands/ba/review.md:716-805` — Step 5 resolution menus
  - `commands/ba/plan.md:205, 214, 256, 289, 325, 357` — criteria source headings
  - `commands/ba/slice.md:140-145, 154-177, 192` — slice marker grammar and Behaviors partitioning
- **Convention reference:** `CLAUDE.md` (project root) — command prefix, version bump rule, README update rule, protected-artifacts list

## Convention Compliance

- [x] **Command prefix `ba:`** — extending existing `/ba:review` command, no new command added. Aligned.
- [x] **Agent naming conventions** — no new agents introduced; implementation is orchestrator-level inside `commands/ba/review.md`. N/A.
- [x] **YAML frontmatter required on all artifacts** — present (title, type, status, date, origin, detail_level, iteration_count, tags). Aligned.
- [x] **Version bump in `.claude-plugin/plugin.json` for every release** — included as change #10 (0.16.0 → 0.17.0). Aligned.
- [x] **README update on command/agent/artifact-path changes** — included as change #9. Aligned.
- [x] **Planning vs. execution vs. review classification** — `/ba:review` correctly identified as a quality command; the plan extends review without touching plan or execute. Aligned.
- [x] **Convention-compliance check mandatory before writing planning artifacts** — satisfied by this very check. Aligned.
- [x] **All built-in reviewers always appear as options in `/ba:review`** — unchanged by this plan; completeness pass is sequenced after reviewer consolidation, not part of the reviewer record pipeline. Aligned.
- [x] **`/ba:review` dispatches reviewer subagents with a protected-artifacts guard** — initially missing from Step 4g.a verdict-pass dispatch; resolved during convention check by adding the same guard wording used at `commands/ba/review.md:331, 375, 425`. Aligned.
- [x] **Artifact path for plans** — `docs/plans/2026-05-17-feat-ba-review-requirements-completeness-plan.md` matches `docs/plans/YYYY-MM-DD-<type>-<name>-plan.md`. Aligned.
- [x] **Simplicity First (global)** — one LLM call + deterministic validator; five explicit "What We're NOT Doing" scope guards. Aligned.
- [x] **Surgical Changes (global)** — three files touched (`commands/ba/review.md`, `README.md`, `.claude-plugin/plugin.json`); no adjacent cleanups. Aligned.
- [x] **Goal-Driven Execution (global)** — every Automated success criterion is a runnable `grep`/`jq`/`git` command; every Manual criterion names an invocation and an observable check. Aligned.
