---
title: "Retire reactionary plan-pipeline features (slice + plan-LoC gate)"
type: refactor
status: completed
date: 2026-06-21
detail_level: standard
iteration_count: 0
tags: [ba-slice, plan-iteration-gate, ba-execute, ba-review-plan, retirement, cluster-infra]
---

# Retire reactionary plan-pipeline features (slice + plan-LoC gate) Implementation Plan

## Overview

Remove two plan-pipeline features that accreted reactively and no longer earn their keep (GitHub issue #32): the `/ba:slice` command (decomposes plans into ≤150-LoC MR slices — unused in practice now that the code-justification gate landed, #30) and the plan-LoC iteration gate (`/ba:review-plan` Step 5.5 + the `plan-iteration-gate` agent — counts plan-body LoC as a discipline tripwire that always no-ops). The change deletes two files, de-slices `commands/ba/execute.md`, and syncs every dangling reference across commands, README, CLAUDE.md, and plugin.json. It is a prompt/docs-only change with no code.

This is **not** a blind delete: `execute.md`'s own pre-execution scope tripwire (a separate, bug-driven feature from issue-equivalent brainstorm `2026-05-18-ba-execute-scope-tripwire-brainstorm.md`) is **kept** — but collapsed from its slice-coupled form (`2× slice Est. LoC`) to its surviving non-sliced fixed-threshold form (`~400 LoC`), and renamed Pre-slice → Pre-execution.

## Current State

- `commands/ba/slice.md` — the full `/ba:slice` command (244 lines). Self-contained.
- `agents/workflow/plan-iteration-gate.md` — the gate agent (whole file).
- `commands/ba/review-plan.md:206–256` — Step 5.5, which increments `iteration_count`, computes plan-body LoC, and dispatches `plan-iteration-gate`.
- `commands/ba/execute.md` — slice machinery woven throughout: argument-hint (`:4`), `--slice N` parsing (`:15–22`), sliced-plan detection (`:57–65`), slice branch-name (`:82`), the Step 1.5 scope tripwire (`:115–199`, currently slice-phrased), sliced commit format (`:287–295`), Step 5 "Slice Completion" (`:392–421`), and the Step 1.5 binding-scope rule in Important Guidelines (`:451`).
- `iteration_count` frontmatter field is **seeded** at `commands/ba/plan.md:194` and read/written **only** by the gate flow — orphaned once the gate is gone.
- The CLAUDE.md "Code-shape decision" sync-list (`CLAUDE.md:82`) names `commands/ba/slice.md` (LoC Counting Rules) as a must-stay-in-sync mirror of `execute.md` Step 1.5b. Removing slice.md makes execute.md the sole owner of that LoC-counting rule.
- Dangling references confirmed in: README (`:7, :49, :51, :112–122, :144–145, :196, :261`), `plan.md` (`:194, :503, :512`), `handoff.md:33`, `propose.md:448`, `plugin.json` (`:3 version, :4 description, :13 keyword`), `CLAUDE.md` (`:15, :56, :75, :77, :82`).

## What We're NOT Doing

- **Not** removing `execute.md`'s scope tripwire — it is a distinct, bug-driven execution-time guard (caught a real ~310-LoC-vs-80-LoC over-implementation). It survives in fixed-threshold form.
- **Not** removing the `**Code-shape decision:**` literal/pseudo-code LoC-counting classification — it stays in `execute.md` Step 1.5b (execute.md becomes its sole owner).
- **Not** touching the convention-compliance gate — split off to issue #38, decided separately.
- **Not** migrating existing on-disk plans. Old plans may carry `sliced: true`, `slice_count`, `## Slices` tables, `<!-- slice:N -->` markers, and `iteration_count`. These become inert; execute.md reads them leniently (treats every plan as non-sliced). No migration tooling — these are user files in a docs-only plugin.
- **Not** touching incidental word-matches: `roadmap-management.md:12` ("slice the map", a verb) and `interface-design-generator.md:11` (illustrative example mentioning "slice-creep" / `-gate`). Leave both.
- **Not** adding a graceful "`--slice` was removed" message to execute.md. A user who passes `--slice N` will have it treated as part of the plan path → a clean path-not-found error. Simplicity-first; no compatibility shim for a retired flag.

## Behaviors to Test

- [ ] `/ba:slice` no longer exists as an invokable command; no file under `commands/ba/` defines it.
- [ ] `/ba:review-plan` runs end-to-end with no Step 5.5 and dispatches no `plan-iteration-gate`; its output ends cleanly at the prior step.
- [ ] `/ba:execute` on a never-sliced plan still fires the pre-execution scope tripwire at the fixed ~400 threshold and pauses via Deviation Handling when the projection meets it.
- [ ] `/ba:execute` on a plan that still contains old `## Slices` / `<!-- slice:N -->` artifacts executes the full plan without tripping, refusing, or branching on those markers.
- [ ] A newly written plan (via `/ba:plan`) carries no `iteration_count` field.
- [ ] No file in the repo references `/ba:slice`, `plan-iteration-gate`, or `--slice` except as deliberately-retained incidental prose (the two false positives above).
- [ ] `grep -rn "slice\|plan-iteration-gate"` over commands/, agents/, README.md, CLAUDE.md, plugin.json returns only the two documented incidental matches.

## Proposed Solution

Land everything as **one atomic commit** (the mirror/pointer couplings — slice.md ↔ execute.md maintainer note, gate agent ↔ Step 5.5 dispatch, gate ↔ `iteration_count` write — break under partial removal). Order: (1) delete the two files, (2) de-slice execute.md, (3) remove review-plan Step 5.5, (4) renumber plan.md menu + drop the seed, (5) sync all prose/refs + bump version.

## Technical Considerations

- **Threshold semantics after collapse.** The tripwire's three-way threshold (`2×N` sliced / `400` unparseable / `400` non-sliced) collapses to a single fixed `T = 400`. The original "AC vs LoC binding-scope" framing was per-slice (slice AC named more surfaces than the LoC budgeted). Without per-slice estimates, the reframed guard is simpler: "this run projects ≥ 400 LoC of changes — confirm the plan isn't over-scoped for one execution pass before writing code." Keep the Deviation-Handling pause and the `## Deviations` audit entry; drop the AC-contradiction sub-clause.
- **Naming.** Rename Pre-slice → Pre-execution everywhere it appears (Step 1.5 heading, the printed `Pre-slice scope check:` user string at `execute.md:159`, the `## Deviations` heading at `:182`, Important Guidelines at `:451`). The printed string is user-observable even today on non-sliced runs.
- **The post-slice 200-LoC warning** (`execute.md:398`) lived inside Step 5 Slice Completion and was slice-framed ("re-slice the remaining work"). It cannot survive intact and is dropped with that section; the pre-execution tripwire is the remaining scope guard.
- **Version bump is mandatory** — plugin.json version is the auto-update cache key.

## System-Wide Impact

- **Interaction graph**: `/ba:review-plan` loses its terminal Step 5.5 (which dispatched the gate agent). `/ba:plan` next-steps menu loses option 2. `/ba:execute` loses its sliced entry-paths but keeps the non-sliced execution path and the (reframed) scope tripwire.
- **Error propagation**: removing the gate agent + Step 5.5 together avoids a runtime dispatch-of-missing-agent error path. Removing all of Step 5.5 (not just dispatch) avoids an orphaned `iteration_count` *write* on every review-plan run.
- **State lifecycle risks**: old on-disk plans retain inert slice/iteration frontmatter and markers — explicitly read leniently, never guarded against. No partial-state risk (docs-only).

## Implementation Approach

### Changes Required

**Delete: `commands/ba/slice.md`** — remove the file entirely.

**Delete: `agents/workflow/plan-iteration-gate.md`** — remove the file entirely.

**File: `commands/ba/execute.md`** (de-slice; highest-risk edit)
- `:4` — argument-hint → `"[path to plan file]"` (drop `[--slice N]`).
- `:15–22` — remove the `### Parse Arguments` subsection (the `--slice N` parsing). `#$ARGUMENTS` is the plan path directly; drop the "only ba:execute strips `--slice N`" cross-file note.
- `:57–65` — remove item 5 "Sliced plan detection" from Read & Validate (items 1–4 stay).
- `:82` — remove the "If executing a slice (`--slice N`)" branch-naming bullet.
- `:115–199` — **keep Step 1.5 but de-slice and rename to "Pre-Execution Scope Check":**
  - Heading + intro (`:115–117`): reframe to "before any code is written for this run" and "project the size of what you're about to do against a fixed threshold." Drop `slice's Est. LoC`.
  - "When this fires" (`:119–123`): collapse to once-per-run; fresh-start fires, mid-run resume (any `[x]`) skips. Drop the "post-slice 200-LoC warning" reference (that section is removed).
  - 1.5a (`:125–133`): "this slice's tasks" → "the plan's tasks".
  - 1.5b (`:135–149`): **keep verbatim** — the literal/pseudo-code classification (the Code-shape mirror) stays; remove only the maintainer cross-ref to slice.md if present.
  - 1.5c (`:151–155`): collapse the three threshold cases to a single `T = 400`. Remove the `## Slices`-table parse and the "(2× the post-slice 200-LoC warning…)" parenthetical.
  - 1.5d (`:159`): printed string → `Pre-execution scope check: projected ~[M] LoC (threshold [T]). Proceeding.` (drop `vs Est. ~[N]`).
  - 1.5e (`:162–189`): Expected/Found block — `Expected` becomes the threshold T, not slice Est. LoC; `Why` becomes "projected M ≥ threshold (~400 LoC) — confirm scope before writing code." Drop the AC-vs-LoC binding-scope sub-clause. `## Deviations` heading (`:182`) → `### Scope tripwire: projected M ≥ threshold`.
  - 1.5f (`:191–199`): re-projection after "Update the plan" — re-project against fixed `T = 400` (drop "re-read slice Est. LoC row" / "T = 2× new N").
- `:287–295` — remove the "Sliced execution commit format" block.
- `:392–421` — remove the entire "### Slice Completion (Sliced Execution Only)" section (the standard "### Next Steps" menu at `:423` becomes the sole completion menu).
- `:451` — Important Guidelines bullet → "**Pre-execution scope check is binding** (Step 1.5). The LoC projection is the scope-creep signal — when the run projects ≥ the threshold, surface it before writing code."

**File: `commands/ba/review-plan.md`**
- Remove the entire Step 5.5 block (`:206–256`, including 5.5a–5.5d and the trailing "After Step 5.5 completes, /ba:review-plan exits" line). Verify the preceding `---` separator and the flow into the next section still read cleanly.

**File: `commands/ba/plan.md`**
- `:194` — remove the `iteration_count: 0` seed from the frontmatter template (orphaned once the gate is gone).
- `:503` — remove next-steps menu option 2 "Slice plan"; renumber options 3–7 → 2–6.
- `:512` — remove the "**Slice plan** →" handler from "Based on selection".

**File: `commands/ba/handoff.md`**
- `:33` — drop the "slice number reached (e.g. … slice 3 of 5)" example; keep "name the plan path".

**File: `commands/ba/propose.md`**
- `:448` — reword the peer-rule parenthetical to drop `/ba:slice`, keeping `/ba:review --local`.

**File: `README.md`**
- `:7` — remove `decompose into MR-sized slices (/ba:slice)` from the pipeline sentence.
- `:49, :51` — remove the `/ba:slice` and `--slice N` lines from the execution-mode decision tree.
- `:112–122` — remove the entire `### /ba:slice [plan]` section.
- `:144–145` — remove the slice-coupled `/ba:execute` feature bullets (pre-slice scope check phrased per-slice; slice-aware execution). Replace the scope-check bullet with the reframed pre-execution wording if a feature bullet is desired; otherwise drop.
- `:196` — `/ba:handoff` bullet: drop "and the slice number reached".
- `:261` — remove the `plan-iteration-gate` agent-table row.

**File: `CLAUDE.md`**
- `:15` — remove the `/ba:slice` command-list entry.
- `:56` — remove the `plan-iteration-gate` agent-list entry.
- `:75` — convention "Planning commands (brainstorm, plan, slice, review-plan)…" → drop `slice`.
- `:77` — remove the "slice annotations … exempt" clause.
- `:82` — rewrite the Code-shape sync-list to drop the `commands/ba/slice.md` (LoC Counting Rules) mirror entry; execute.md Step 1.5b/2b becomes sole owner.

**File: `.claude-plugin/plugin.json`**
- `:3` — bump `version` (0.24.2 → next).
- `:4` — remove `slice` from the description string.
- `:13` — remove `"slice"` from the keywords array.

### Success Criteria

#### Automated:
- [x] `test -f commands/ba/slice.md || echo gone` → prints `gone`; same for `agents/workflow/plan-iteration-gate.md`. **Verified — both gone.**
- [x] `grep -rn -- "--slice\|/ba:slice\|ba:slice\|plan-iteration-gate\|iteration_count\|Step 5.5" commands/ README.md CLAUDE.md .claude-plugin/plugin.json agents/` → only the intentional backward-compat note (execute.md:50) and the fictional example (interface-design-generator.md:11) remain. **Verified.**
- [x] `python3 -m json.tool .claude-plugin/plugin.json` → valid JSON; `version` 0.25.0; `keywords` has no `slice`. **Verified.**
- [x] `grep -n "Pre-slice" commands/ba/execute.md` → no matches (rename complete). **Verified.**

#### Manual:
- [ ] Read execute.md Step 1.5 end-to-end: the tripwire reads as a coherent fixed-threshold scope check with no dangling slice vocabulary, and the pause/audit/re-projection flows are internally consistent.
- [ ] Read review-plan.md around the former Step 5.5: section ordering and separators flow cleanly into the next section.
- [ ] Read plan.md next-steps menu: options renumber 1–6 with no gap and the "Based on selection" handlers match.
- [ ] CLAUDE.md `:82` sync-list and README agent table contain no reference to a deleted file.

## Dependencies & Risks

- **Risk: partial removal breaks couplings.** Mitigation — single atomic commit; the grep success-criterion catches stragglers.
- **Risk: the tripwire reframe silently changes behavior.** It does change behavior intentionally (per-slice 2× → fixed 400 for all plans), but this is the *already-existing* non-sliced path, now applied uniformly. Documented in Technical Considerations.
- **Risk: stale references missed.** Mitigation — the reference map (two independent research agents + flow analysis) is exhaustive; the automated grep is the backstop.
- Independent of issue #31 (no shared spine). Independent of #38 (convention gate, split off).

## Sources & References

- Origin issue: GitHub #32 "[roadmap] Retire reactionary plan-pipeline features (slice + plan-LoC gate)"
- Kept-feature origin: `docs/brainstorms/2026-05-18-ba-execute-scope-tripwire-brainstorm.md` + `docs/plans/2026-05-18-feat-add-execute-scope-tripwire-plan.md` (establishes the tripwire as distinct from the gate)
- Comparison evidence (per issue): `docs/research/2026-06-17-plan-execute-vs-ce-comparison.html`
- Reference inventory: this plan's Current State (file:line map verified against the working tree)

## Convention Compliance

- [x] Plan filename pattern + `type: refactor` frontmatter — aligned
- [x] Code-shape decision sync-list (CLAUDE.md:82) — plan edits the line to drop the slice.md (LoC Counting Rules) mirror; execute.md Step 1.5b becomes sole owner — aligned
- [x] Update README.md when commands/agents/paths change — covered (pipeline sentence, decision tree, `/ba:slice` section, execute bullets, handoff bullet, agent table) — aligned
- [x] Bump plugin.json version (auto-update cache key) — required in plan + success criteria — aligned
- [x] Planning commands never write code — this is a plan; documents prose edits only — aligned
- [x] Roadmap lives in GitHub issues, not competing docs — sources from #32, links research as evidence — aligned
- [x] `iteration_count: 0` retained in this plan's own frontmatter — justified: authored against the current template before the seed is removed; read leniently per "What We're NOT Doing"
- Note: README.md:101 carries the `**Code-shape decision:**` label wording (a separate mirror in the sync-list) — unaffected by slice retirement, intentionally not edited.
