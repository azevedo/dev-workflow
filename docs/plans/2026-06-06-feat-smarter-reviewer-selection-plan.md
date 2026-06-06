---
title: "feat: Smarter reviewer selection for /ba:review"
type: feat
status: completed
date: 2026-06-06
origin: docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md
detail_level: standard
iteration_count: 1
tags: [ba-review, reviewer-selection, selection-ledger, automation]
---

# Smarter Reviewer Selection for `/ba:review` Implementation Plan

## Overview

`/ba:review` currently presents a cold reviewer menu every run — the user re-picks
the whole set from scratch from a blank multi-select. This slice replaces that with
**diff-judged smart selection**: the orchestrator reuses the diff it already read in
Step 1 to judge which reviewers have substantive work, prints a **selection ledger**
(full roster, `✓ selected` / `○ set aside`, each with a one-line reason), and asks for
**one confirm** — Run the ✓ set, Adjust, or Cancel. This is slice 1 (#1) of the
ba-review-automation brainstorm; #2 and #3 are deferred and #4 was declined (see
brainstorm: `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md`).

The change is prompt-level only — no scoring engine, no new agent, no persisted state.
Steps 3 (dispatch), 4 (consolidation), 4.5 (persist), and 5 (resolution) are untouched.

## Current State

- **`commands/ba/review.md` Step 2** (`commands/ba/review.md:214-294`) — "Discover & Select
  Reviewers":
  - `2a` gathers the seven built-ins (`:216-230`); `:230` asserts they "MUST appear as
    options in Step 2c."
  - `2b` discovers external reviewers via parallel Globs + frontmatter keyword match
    (`:232-259`) — unchanged by this slice.
  - `2c` presents a cold `AskUserQuestion` `multiSelect` menu (`:261-293`): never-bundle
    rule at `:263`, never-hide rule at `:265`, the 16-cap with text overflow at `:274`,
    and the empty-selection guard at `:293`.
- **Diff already captured in Step 1** — `FULL_DIFF`, `CHANGED_FILES`, `STAT` are stored by
  Step 1f (`commands/ba/review.md:201-208`) and are the sole source of truth. The judgment
  pass reuses these; it must **not** re-run any git/diff command (the Step 1 STOP rule at
  `:208` still binds).
- **Never-hide convention, five locations** (confirmed complete — no sixth):
  `commands/ba/review.md:230`, `:263`, `:265`; `CLAUDE.md:80`; `README.md:163`.
- **`README.md:162`** ("Seven built-in reviewers … always available out of the box") — still
  accurate after the change (the seven always appear in the ledger); left unchanged.
- **Step 5 already uses "Done"** to mean "acknowledge findings without changes"
  (`commands/ba/review.md:736`, `:765`, `:779`) — drives the third-option rename below.
- **`.claude-plugin/plugin.json`** version is `0.20.1`.
- **No `docs/solutions/` learnings exist yet** — no prior gotchas to carry forward.

## What We're NOT Doing

- **Not building #2 (verify fix + precondition) or #3 (pre-existing collapsed section)** —
  designed and deferred to later slices (see brainstorm: Roadmap follow-ons).
- **Not building #4 (taste injection into reviewers)** — declined as conceived; a separate
  house-rule compliance reviewer is noted as a future candidate, not part of this slice.
- **No persistence / config / profile file / "remember my skips"** — selection is recomputed
  fresh every run. The stateful "remember my skips" idea is a possible slice 2, deferred.
- **No scoring engine and no numeric overlap threshold** — overlap is a stated judgment, not
  a computed percentage.
- **No changes to Steps 3, 4, 4.5, 5** — dispatch, consolidation, persistence, and resolution
  are untouched. The protected-artifacts guard (`:333`/`:379`/`:431`) is not touched.
- **No *behavioral* changes to `/ba:review-plan`** (the convention twin with an identical cold
  menu) — its selection UX is out of scope; a candidate for the same treatment later. This slice
  adds only a one-line documentation comment marking the divergence.
- **No auto-apply of fixes** — the lever is shrinking and pre-qualifying the walk, never
  deciding for the user.

## Behaviors to Test

- [ ] On a diff that adds untested exported logic, the ledger marks test-coverage and
      architecture `✓` and marks security/error-handling `○` with reasons that cite the
      absent surface.
- [ ] The ledger lists **every** candidate (built-in + discovered external) exactly once,
      each with a one-line reason; the printed count equals `built-ins + externals`.
- [ ] Accepting the default `✓` set requires exactly **one** `AskUserQuestion` between the
      ledger and dispatch.
- [ ] A `○` reviewer is re-selectable via **Adjust** without re-running discovery.
- [ ] An overlap-driven `○` names the surviving reviewer as its reason.
- [ ] A CSS-only diff does not select security or error-handling.
- [ ] An empty set — whether from the judge (docs-only/binary-only diff) or from deselecting
      everything in **Adjust** — never runs silently; it routes to Adjust-or-cancel.
- [ ] A discovered external can be `✓` while a built-in is `○` by overlap (no built-in/external
      caste).
- [ ] **Cancel review** exits without running any reviewer and produces no findings.
- [ ] A review run writes no persisted file (stateless).
- [ ] When discovery finds no externals, the ledger still prints the "No external reviewers
      found …" notice so an all-built-in ledger is distinguishable from a failed discovery.

## Proposed Solution

Restructure Step 2 into four sub-steps:

- **2a** (built-in roster) and **2b** (external discovery) — keep current behavior; only the
  `:230` "must appear as options" wording is reworded to "must appear in the ledger."
- **2c — Judge each candidate against the diff** (new): reuse the captured diff to decide,
  per reviewer, "does this diff contain substantive work in this reviewer's domain?" Judgment,
  not scoring; built-in and external judged uniformly; overlap as stated judgment; uncertainty
  defaults to `○` with an honest reason; writes no state.
- **2d — Present the selection ledger and confirm** (new): print the full roster as plain text
  (every candidate `✓`/`○` + reason + asserted count), then one `AskUserQuestion`: **Run the ✓
  set · Adjust · Cancel review**. Adjust opens the full per-reviewer pick-list (never bundled,
  no re-discovery, paginated past 16, empty-set guarded).

The judgment is deliberately *judgment, not a recipe* — it reads the surfaces actually present
in the diff and never applies a fixed category→reviewer mapping (see brainstorm: Slice 1, "The
'meaningful work' bar").

## Technical Considerations

- **Never-hide becomes a rendering guarantee, not a structural one.** Today every reviewer is
  mechanically its own option, so it cannot be hidden. Under the ledger, reachability depends
  on the orchestrator faithfully printing **every** candidate and carrying the same set into
  Adjust. The plan defends this with (a) an asserted candidate count in the ledger header, (b)
  an explicit "no elision, list all N" instruction, and (c) "Adjust contains exactly the ledger
  set — no judgment re-filtering."
- **`AskUserQuestion` limits** (1-4 questions, 2-4 options each) cap one call at 16 selectable
  reviewers. Past 16, Adjust spills into consecutive calls so every reviewer stays selectable
  rather than degrading to a non-selectable text overflow (the current `:274` behavior). This path
  is rare (7 built-ins + 10+ matched externals) — the rule is one sentence, not a state machine; it
  exists only to keep the never-bundle/never-hide intent intact at the boundary.
- **Determinism.** A judgment can differ run-to-run; the ledger makes the call visible and the
  reasons legible, and Adjust makes any correction one toggle away. Re-running (Step 5 "Re-run
  review") recomputes judgment fresh — correct under the stateless invariant.

## System-Wide Impact

- **Interaction graph**: Step 2d's confirmed set feeds Step 3 dispatch exactly as the old menu
  did — Step 3's per-reviewer dispatch templates are unchanged. Step 5 "Re-run review" re-enters
  Step 2 → fresh judgment + fresh ledger (no remembered selection). **"Cancel review" from a
  Step-5-triggered re-run terminates the command entirely** (same semantics as a top-level cancel);
  to stay in the resolution menu the user picks Step 5's own "Done", not the re-run's "Cancel review".
- **Error propagation**: the judgment is best-effort. If the orchestrator cannot confidently
  judge a reviewer, it defaults to `○` with a reason — never drops the reviewer from the ledger.
  External discovery remains best-effort (missing externals are not errors).
- **State lifecycle risks**: none — the slice writes no state, so there is no partial-failure
  inconsistency to manage. `--persist` (Step 4.5) still records the *roster that ran* after the
  fact; it is unaffected.

## Implementation Approach

### Changes Required

#### 1. `commands/ba/review.md` — replace Step 2 (`:214-294`)

Replace the entire `## Step 2` block (sub-steps 2a-2c) with the following. 2a's roster table
and 2b's discovery logic are carried over verbatim except where noted; 2c and 2d are new.

````markdown
## Step 2: Discover, Judge & Select Reviewers

### 2a. Gather built-in reviewers

List the seven built-in review agents from `agents/review/`:

| Agent | Focus |
|---|---|
| `architecture-reviewer` | Codebase patterns, coupling, separation of concerns, naming |
| `security-reviewer` | XSS, sensitive data, auth patterns |
| `simplification-reviewer` | Over-engineering, unnecessary abstraction, YAGNI |
| `error-handling-reviewer` | Edge cases, error paths, graceful failures |
| `test-coverage-reviewer` | Missing test scenarios, test quality |
| `deep-module-reviewer` | Ousterhout deep-module design: small interface / deep implementation, dependency injection, return-over-side-effects, duplication, shallow-layer merging |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |

**All seven built-in reviewers MUST appear in the selection ledger (Step 2d) — selected (`✓`)
or set aside (`○`), each with a reason. Never omit a reviewer from the ledger or from the
Adjust pick-list.**

### 2b. Discover external reviewers

**This step is mandatory.** Do not skip it or substitute it with a curated list. Run all Glob calls in parallel:

```
Glob("**/*.md", path="~/.claude/agents/")
Glob("**/*.md", path="~/.claude/skills/")
Glob("**/*.md", path="~/.claude/commands/")
Glob("**/*.md", path=".claude/agents/")
Glob("**/*.md", path=".claude/commands/")
Glob("**/*.md", path=".agents/")
Glob("**/*.md", path=".agents/agents/")
Glob("**/*.md", path=".agents/skills/")
Glob("**/*.md", path=".agents/commands/")
```

Read each discovered file's frontmatter (first 15 lines). The frontmatter is the authoritative source — it may be richer than the system-reminder summary. Include the file if its `name`, `description`, or any frontmatter field contains any of: "review", "code-review", "reviewer", "quality", "lint", "audit", "assess", "guidelines", "compliance", "pattern", "architecture", "composition".

**If a file matches the keywords above, include it.** Only exclude if it is one of these specific categories: plan writers (`ba:plan`, `ba:brainstorm`), execution commands (`ba:execute`), fixer skills that modify code rather than producing read-only findings (`simplify`), or the built-in agents already listed in 2a. When in doubt, include — let the user decide.

**Also scan the system-reminder skills list** as a fallback for skills not stored as files. Include any skill whose name or description matches the same keywords above. Exclude: `ba:review`, `ba:review-plan`, fixer skills (`simplify`), and other orchestration skills. Fixer skills modify code rather than producing read-only findings — they violate the reviewer contract and risk mutating the working tree during parallel review execution.

**Skills and commands are valid reviewers regardless of which directory they live in.** A skill that performs code review, audit, or quality assessment should be included.

For each discovered external reviewer, record:
- **name**: from frontmatter
- **description**: from frontmatter
- **source**: "agent" or "skill"

### 2c. Judge each candidate against the diff

You already captured `FULL_DIFF` and `CHANGED_FILES` in Step 1. **Reuse that read — do NOT run
`git diff`, `glab mr diff`, `gh pr diff`, or any diff command here** (the Step 1f STOP rule still
binds). For **each** candidate reviewer — the seven built-ins **and** every discovered external,
judged uniformly with no built-in/external precedence — answer one question:

> **Does this diff contain substantive work in this reviewer's domain?**

This is a judgment call on the **surfaces actually present in the diff** — UI markup/styles,
exported symbols, untested logic, error/IO paths, auth/input handling, abstraction/coupling, test
files, and so on. It is **not** a scoring rubric and **not** a category→reviewer mapping. Judge
what the diff actually does. *(A fixed category→reviewer table is rejected on purpose: it
over-selects on shallow file-extension matches and under-selects on cross-cutting changes. Reading
the diff surfaces directly avoids both — do not regress this step into a lookup table.)*

- **Meaningful-work bar.** Select (`✓`) a reviewer only when the diff has substantive work in its
  domain — not a token file match, not merely a "safe pair." Otherwise set it aside (`○`).
- **Uniform pass.** Built-in and discovered-external reviewers clear the same bar. An external
  earns `✓` on merit; a built-in may be set aside.
- **Overlap.** When two otherwise-selected reviewers are largely redundant *on this diff*, keep
  the deeper one and set the other aside (`○`), naming the **surviving** reviewer as the reason.
  Keep both when each contributes a distinct part worth having. No numeric threshold — this is a
  stated judgment, recorded in the ledger. A built-in may be set aside by overlap with an external
  (and vice versa); name the survivor either way. For a three-way overlap, keep one and name it as
  the survivor for the other two.
- **Uncertainty.** When the call is genuinely 50/50, set aside (`○`) with a reason that names the
  **absent or ambiguous surface** — the ledger + Adjust make a wrong set-aside one toggle away to
  correct. (This is why `○` reasons must cite the missing surface, not say "not relevant": the
  honest reason is what lets the user spot a wrong call.)
- **Reason quality.** Every `✓` reason cites the **present** surface; every `○` reason cites the
  **absent** surface or the overlapping reviewer.

This judgment writes **no state** — it is recomputed fresh on every run.

### 2d. Present the selection ledger and confirm

Print the **full roster** as plain text (not a widget) in stable order — the seven built-ins
first, then discovered externals — every candidate on its own line:

```
Reviewer selection — <T> candidates (<S> ✓ selected, <A> ○ set aside)

✓ architecture-reviewer — new module with cross-cutting exports; structure worth a look
✓ simplification-reviewer — ~200-line addition; check for over-engineering
✓ test-coverage-reviewer — new exported logic arrives with no tests
○ security-reviewer — no auth, input-handling, or sensitive-data surface in this diff
○ error-handling-reviewer — no new IO or error paths
○ deep-module-reviewer — overlaps with architecture-reviewer here; architecture covers the structure
○ complexity-reviewer — diff is small and linear; no cognitive-load surface
○ dragon-test-reviewer (agent) — overlaps with test-coverage-reviewer on this diff
```

**No elision.** The real guarantee is the **enumeration**: every candidate appears on its own line
exactly once. The header count is a sanity aid on top of that, not the mechanism — derive `<T>` as
`7 (built-ins from 2a) + count(all externals discovered in 2b)`, the **pre-judgment** total. It
counts every discovered candidate, including borderline keyword matches kept under 2b's "when in
doubt, include" rule — it is **not** the `✓` count. Never truncate, summarize ("…and N others"), or
drop a low-relevance reviewer — a candidate missing from the ledger is unreachable, which violates
the never-hide guarantee. If discovery (2b) found no externals, append after the roster: "No
external reviewers found in ~/.claude/agents/, ~/.claude/skills/, ~/.claude/commands/,
.claude/agents/, .claude/commands/, .agents/, .agents/agents/, .agents/skills/, .agents/commands/."
so an all-built-in ledger is distinguishable from a discovery that silently failed.

Then confirm with a single **AskUserQuestion**. The branch depends on whether the `✓` set is empty.

**When the `✓` set is non-empty** — question: "Run the selected reviewers, or adjust the set?"
1. **Run the ✓ set** — dispatch the selected reviewers (Step 3).
2. **Adjust** — open the full pick-list to change the set.
3. **Cancel review** — exit without running any reviewer (no findings produced).

**When the `✓` set is empty** (no reviewer judged to have substantive work, e.g. a docs-only or
binary-only diff) — question: "No reviewer was judged to have substantive work in this diff. Pick
reviewers manually, or cancel?" Drop the "Run" option (per the never-dispatch-empty-set invariant
below); the options are exactly `1 = Adjust`, `2 = Cancel review` — no hidden "Run" at position 1.
1. **Adjust** — pick reviewers manually from the full list.
2. **Cancel review** — exit without running any reviewer.

> The third option is **Cancel review**, not "Done." This refines the brainstorm's shorthand
> "Done" to avoid colliding with Step 5's "Done" (acknowledge findings) and the misread "I'm done,
> proceed." It runs nothing and produces no findings.

**Common-case guarantee:** when the user accepts the default `✓` set ("Run the ✓ set"), exactly
**one** AskUserQuestion appears between the ledger and dispatch.

#### Adjust — full pick-list

Present **every** candidate from the ledger (built-in and external — the identical set, with **no**
judgment re-filtering) as an individual, selectable option via **AskUserQuestion** with
`multiSelect: true`. **Each reviewer gets its own option — never bundle multiple reviewers into a
single option.**

Apply these distribution rules:

1. Collect all reviewers into an ordered list: 7 built-ins first, then discovered externals.
2. Partition into groups of 2-4. Prefer groups of 3-4 to minimize questions. Never leave 1
   reviewer alone in a group — merge it into the adjacent group (keeping that group at ≤4).
3. Use short `header` values (max 12 chars), e.g. `"Analysis"`, `"Quality"`, `"External"`.
4. The reviewers marked `✓` in the ledger are the recommended default. **If the entering `✓` set
   is empty** (an all-`○` ledger), open Adjust with **nothing** pre-checked — do not fall back to
   the `○` set as a default.
5. **If candidates exceed 16** (the `AskUserQuestion` 4×4 ceiling), present them across consecutive
   `AskUserQuestion` calls (≤16 each), accumulating the picks in the orchestrator's turn context
   only (never persisted), so every reviewer stays individually selectable — never a non-selectable
   text list. Cancelling any round is a **Cancel review** (the invariant below).

The **"Other"** free-text option still accepts a reviewer name not in the roster; typed names
resolve via Step 3's user-typed handling, which is **self-contained in Step 3** (`:392-399`,
unchanged) and does not depend on any logic removed from the old menu.

**Invariant — never dispatch an empty set.** At any confirm or Adjust step, an empty resulting set
routes to a forced choice, never a silent run:
- **Non-empty** result → proceed to Step 3 with that set.
- **Empty** result (the judge selected none, or the user deselected everything) → ask "No reviewers
  selected. Adjust again or cancel?" Looping re-opens the pick-list; **cancel here is identical to
  "Cancel review"** at the confirm step — no reviewers run, no findings, no persist directory created.

Discovery (2b) is **not** re-run on Adjust or on any loop — the roster is fixed for the run.
````

#### 2. `CLAUDE.md` — reword the never-hide bullet (`:80`)

**Replace:**
```markdown
- All built-in reviewers always appear as options in `/ba:review` — external reviewers are shown alongside them with overlap notes, never hidden or replaced
```
**With:**
```markdown
- `/ba:review` selection is a stateless per-diff judgment presented as a **selection ledger**: every reviewer (built-in and discovered external) appears each run — selected or set aside, each with a one-line reason — and every reviewer is reachable via **Adjust**. Reviewers are never silently dropped; the ledger over-satisfies the never-hide intent (visible, reasoned, reachable). No selection state is persisted.
```

#### 3. `README.md` — reword the "Extensible" bullet (`:163`)

`README.md:162` ("Seven built-in reviewers … always available out of the box") stays — still
accurate. Reword only `:163`.

**Replace:**
```markdown
- **Extensible** — discovers external review agents and skills; shows all reviewers (built-in and external) with overlap notes so you choose
```
**With:**
```markdown
- **Smart selection** — discovers external review agents and skills, then reads the diff and judges which reviewers have real work; presents the full roster as a **selection ledger** (selected + set aside, each with a one-line reason, overlaps named) for a one-step confirm or adjust. Nothing hidden, every reviewer reachable, no state persisted
```

#### 4. `.claude-plugin/plugin.json` — version bump

**Replace** `"version": "0.20.1"` **with** `"version": "0.21.0"` (feature; the auto-update cache key).

**Also (documentation only):** add a one-line HTML comment at `commands/ba/review-plan.md` Step 2
(near `:50`/`:88`) noting the divergence — `/ba:review` uses the ledger; `/ba:review-plan` keeps its
cold menu (no diff to judge); the two need not match. No behavior change.

### Success Criteria

#### Automated:
- [x] `grep -n 'Cancel review' commands/ba/review.md` — the third confirm option is present.
- [x] `awk '/^## Step 2/,/^## Step 3/' commands/ba/review.md | grep -n '\bDone\b'` returns **no**
      matches — "Done" does not leak into Step 2's confirm (it stays a Step 5 / resolution word).
      Scoped to the Step 2 span so a future Step 5 wording change can't false-trip it.
- [x] `grep -n 'selection ledger\|set aside\|✓ selected' commands/ba/review.md` — ledger mechanic
      documented in Step 2d.
- [x] `grep -n 'never bundle\|individual option' commands/ba/review.md` — never-bundle rule present
      in the Adjust pick-list.
- [x] `python3 -c "import json;print(json.load(open('.claude-plugin/plugin.json'))['version'])"` →
      prints `0.21.0`.
- [x] `grep -rn 'always appear as options' CLAUDE.md README.md commands/ba/review.md` returns
      **no** matches (all five never-hide locations reworded; the old phrasing is gone).
- [x] `grep -n 'shows all reviewers' README.md` returns no matches (`:163` reworded).

#### Manual:
- [x] Read the reworded Step 2 end-to-end: 2a→2b→2c→2d flows; the ledger example renders; the
      empty-`✓`-set branch and the empty-Adjust guard are both present and unambiguous.
- [x] Confirm the reworded `CLAUDE.md:80` and `README.md:163` still assert "every reviewer visible,
      reasoned, reachable, never silently dropped" (intent survives the mechanic change).
- [x] Dry-run mentally against a docs-only diff (empty `✓` → Adjust-led menu) and a
      new-module-with-exports diff (architecture/simplification/test-coverage `✓`,
      security/error-handling `○`).

## Dependencies & Risks

- **Risk: never-hide degrades from mechanical to best-effort.** Mitigated by the asserted count,
  the explicit "no elision" instruction, and "Adjust = exactly the ledger set." This is the single
  most important guard — call it out in `/ba:review` testing.
- **Risk: judgment non-determinism** (same diff, different set across runs). Accepted and made
  visible by the ledger + reasons; Adjust corrects in one toggle. No mitigation beyond legibility.
- **Risk: >16-reviewer Adjust spill is the least-exercised path.** Realistically rare; kept to a
  one-sentence rule (consecutive calls) rather than a state machine, so it stays testable without
  pre-building machinery for a case that may never fire.
- **Dependency: none external.** No new agents, files, or config; the change touches `review.md`,
  `CLAUDE.md`, `README.md`, `plugin.json`, and a one-line comment in `review-plan.md`. Step 3+
  depends only on receiving a selected set, which 2d still provides.
- **Follow-on note (not this slice):** `/ba:review-plan` carries the same cold-menu pattern and is
  the natural next candidate for the ledger treatment — out of scope here beyond the divergence marker.

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md` — key
  decisions carried forward: slice 1 = #1 only (stateless, no scoring engine); selection ledger
  (full roster, in & out, with reasons); overlap as stated judgment, not a numeric threshold;
  never-hide reworded in all five locations as an *intent-based* convention; version bump as an
  explicit slice-1 deliverable.
- **Command under change:** `commands/ba/review.md:214-294` (Step 2); never-hide `:230`/`:263`/
  `:265`; "Done" semantics `:736`/`:765`/`:779`; protected-artifacts guard `:333`/`:379`/`:431`
  (untouched).
- **Supporting files:** `CLAUDE.md:80`; `README.md:162-163`; `.claude-plugin/plugin.json` (0.20.1).
- **Spec-flow analysis (this plan):** drove the "Cancel review" rename, the empty-`✓`-set and
  empty-Adjust guards, the no-elision count assertion, and the >16 Adjust spill rule.
- **Plan review (complexity, simplification, architecture, error-handling — this plan):** added the
  empty-`✓` Adjust pre-selection rule and the unified "never dispatch an empty set" invariant
  (cancel ≡ Cancel review), the explicit `<T>` derivation, the in-2c "judgment not a lookup table"
  rationale, the empty-branch question text, the Step-5-re-run cancel semantics, the robust Step-2
  "Done"-scope check, and the `review-plan.md` divergence marker.

## Convention Compliance

- [x] **Planning-vs-execution** — this is a plan document; it describes prompt-level changes for
  `/ba:execute` to implement. Aligned.
- [x] **Never-hide convention (five locations, lockstep)** — reworded in all of `review.md` (2a
  line, 2c overlap, 2d ledger), `CLAUDE.md:80`, and `README.md:163`; intent (visible/reasoned/
  reachable/never-silently-dropped) preserved and over-satisfied. `README.md:162` reviewed and
  left unchanged (still accurate). Aligned per the brainstorm's intent-based resolution.
- [x] **Never-bundle (`:263`)** — carried into the Adjust pick-list; past 16, Adjust spills into
  consecutive calls rather than degrading to non-selectable text. Aligned.
- [x] **Surgical scope** — `review-plan.md` gets a documentation-only comment; no behavior touched. Aligned.
- [x] **Stateless / no-config culture** — 2c and 2d write no state; persistence explicitly deferred.
  Aligned.
- [x] **Version bump not deferred** — `0.20.1 → 0.21.0` (minor; feature). Aligned.
- [x] **Update README.md whenever commands change** — README reviewer bullets updated. Aligned.
- [x] **No new agents / artifact paths / protected-artifacts-guard change** — none introduced;
  Step 3 (guard) untouched. Aligned.
- [x] **Artifact path + frontmatter** — written to `docs/plans/2026-06-06-feat-smarter-reviewer-selection-plan.md`
  with required YAML frontmatter. Aligned.
- [x] **Third-option rename ("Done" → "Cancel review")** — justified refinement of the brainstorm's
  shorthand; confirmed by the user. Documented in 2d as an inline deviation note. Justified override.
