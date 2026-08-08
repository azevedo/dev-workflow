---
title: Extract ba-review's --persist procedure behind a probed load site
type: refactor
plan_schema: 2
status: active
date: 2026-08-08
origin: docs/brainstorms/2026-08-08-prompt-surface-shrink-slice-2-brainstorm.md
detail_level: comprehensive
tags: [prompt-surface, references, ba-review, progressive-disclosure]
---

# Extract ba-review's `--persist` Procedure Behind a Probed Load Site

## Overview

Slice 2 of issue #59. Extract the one genuinely conditional block in `skills/ba-review/SKILL.md` —
the `--persist` run-artifact procedure, 110 lines, default off — into a skill-local reference file
loaded at named load sites.

**The probe is the real deliverable.** 110 lines out of 1115 is a modest shrink, and two larger
targets were dropped (below). What this slice buys is a proven answer to two questions every future
extraction depends on: does a bare-relative skill-local citation resolve, and is the file *skipped*
when its branch isn't taken. Paying that cost once, on the smallest safe target, is the point.

## Current State

`skills/ba-review/SKILL.md` is **1115 lines**, all resident on every invocation.

| Block | Lines | Reached when |
|---|---|---|
| `## Step 4.5` heading + `PERSIST=false` gate + `.gitignore` cross-ref | 688–692 | always parsed |
| `### 4.5a`–`### 4.5e` (the procedure) | **694–803** | `PERSIST=true` only |

`:690` states the conditionality outright: *"Skipped entirely when `PERSIST=false`. This step has no
effect on the default flow."*

**Four resident satellites** depend on the procedure: `:20-26` (parse-time `TIMESTAMP` capture, with
`:26` explaining that deferring it produces announce-vs-write skew), `:192` (`NO_CHANGES` takes
precedence over persistence), `:203` (announces the resolved persist target *before Step 2* "so the
user can `^C` if the target path looks wrong" — and forward-references "Step 4.5a's table"), and
`:973`/`:1035` (two byte-identical "Persisted to …" Done lines).

`:799-801` defines write failure as an **all-or-nothing three-way** verdict — `mkdir`, per-reviewer
Write, or `summary.md` Write — and `:803` says *"Continue to Step 5 regardless. The chat output is the
source of truth on failure."*

No `skills/*/references/` directory exists. All 22 bundled-file citations in the repo are
`${CLAUDE_PLUGIN_ROOT}`-anchored; **bare-relative skill-local citation has zero precedent**.
`.claude-plugin/plugin.json` is at `0.42.0`; HEAD (`a83d855`) already bumped `0.41.0 → 0.42.0`.

## Acceptance Criteria

- AC1: On a fresh-session `/ba-review` run **without** `--persist`, `skills/ba-review/references/review-persist.md` appears in no Read call. This is the savings premise; if it fails, the extraction delivers nothing.
- AC2: On a fresh-session `/ba-review --persist` run, the transcript shows a Read whose **resolved path** is `skills/ba-review/references/review-persist.md` — path identity, not merely read-success — and the run creates a directory matching `docs/reviews/<TIMESTAMP>-<scope-ref>/`.
- AC3: On a `--persist` run, the persist target is announced before reviewer selection, so a wrong path can be interrupted before reviewers run.
- AC4: On a `--persist` run where any of the three write operations fails, the run warns once and does **not** print "Persisted to …" at Done.
- AC5: On a run where the load-site read **fails** (reference file absent or unreadable), the persist step aborts and creates **no** directory under `docs/reviews/` — no improvised path from an unsanitized `SCOPE_REF` — and the review findings are still presented.
- AC6: The two load-site sentences are byte-identical to each other, and the Step 1d site precedes Step 2's reviewer selection.
- AC7: `agents/convention-checker.md`, run against this slice's own diff, does not flag the new skill-local file or its bare-relative citation as a convention violation.
- AC8: `node scripts/check-invariants.mjs` passes all five checks, and the `sentinels` subject count is higher than today's 4 — confirming the new file entered the corpus rather than assuming it.
- AC9: `skills/ba-review/SKILL.md`'s resident line count drops by a measured amount, reported with both endpoints derived by the same method (`wc -c` ÷ 4, matching how the original ~17.8k figure was derived).
- AC10: `.claude-plugin/plugin.json` shows exactly one version change in this slice, `0.42.0 → 0.43.0`.
- AC11: `CLAUDE.md` and `README.md` both name where a skill-local reference lives and which citation form it takes.
- AC12: Issue #59 records both deferrals with the always-reached rationale and a revisit trigger; the origin brainstorm no longer asserts a three-target slice.

## What We're NOT Doing

- **Target 2 — `ba-review`'s Step 5 resolvers (296 ln). Deferred.** `## Step 5: Resolution` is reached
  on every run past the `NO_CHANGES` exit, so one file holding both mutually-exclusive branches would
  be read every run: shrunken body **plus** the whole file **plus** load overhead — a net increase.
  Restoring conditionality means splitting by branch, which the origin lock forbids ("moves whole —
  never split") and which duplicates the ~51-line post-apply guard reachable from both. Also found
  while planning: option labels and their routed action text share a line, so this is a rewrite not a
  relocation; and there are **six** menu families in the range, not five (three more at `:1060-1067`).
  Needs its own brainstorm.
- **Target 3 — `ba-plan`'s three detail-level templates (222 ln). Deferred.** Same defect: Step 4 is
  reached on every `/ba-plan` run. The brainstorm rejected Design A partly *because* it made these an
  always-fired read; Design B has the identical property for the same target.
- **`ba-review-plan`'s dispatch drift and the `rubric-mirror` hardening.** Split out to
  `docs/plans/2026-08-08-fix-ba-review-plan-dispatch-drift-plan.md` — a live defect with no dependency
  on this extraction, which should not wait behind a probe gate.
- **`ba-propose` Step 3 (171 ln).** Always-reachable; excluded on the same test.
- **Driving `ba-review`'s two `general-purpose` dispatch templates.** They fire only for a skill-based
  or user-typed reviewer; no run here reaches them. "The inline copy is enough" stays a hypothesis for
  those paths.
- **A preventive sandbox for the probe.** The isolation controls in U2 are *detective* — they catch an
  escape at scoring time, not before it. Accepted for a throwaway fixture repo; recorded rather than
  implied.
- **Licensing bare-relative citation for an installed plugin.** The probe runs `--plugin-dir`, where
  plugin-root and cwd coincide — the least discriminating configuration. U2 records this as residual
  unproven behavior rather than claiming it.

## Proposed Solution

Extract only the procedure body (`694-803`), leaving the step heading, the `PERSIST=false` gate
blockquote, and the `.gitignore` cross-reference resident. That boundary matters: the load site must
sit *inside* a conditional branch, and cutting from 688 would have removed the branch itself.

Two load sites, both gated on `PERSIST=true` — Step 1d needs `SCOPE_REF` before Step 2 to keep the
`^C` affordance, Step 4.5 needs the write procedure. Disclosed override of the brainstorm's "exactly
one `LOAD-SITE` per extracted region", taken over silently destroying the early announce. No savings
are lost; both sites are behind the same flag.

One named fact crosses the new file boundary in each direction: the load-site sentence going in, and
`PERSIST_WRITE_OK` coming back out.

## Technical Approach

### Architecture

**Code-shape decision:** the load-site wording is the contract — three clauses each counter a
documented failure mode (suppression, improvisation, positional reference), so re-deriving it from
prose would plausibly drop one. Anchors to the origin brainstorm's `## Locked Design` `### Interface`,
extended with its stated error mode.

```
**Load site — persist run artifacts.** Read `references/review-persist.md` now and follow
it. Everything this step does lives there; do not act on this step from memory or from
this body's description of it — that file is the only authority. If the read fails, skip
the persist work entirely, say so, and continue to Step 5 — never improvise a directory
name or any part of the procedure from this sentence.
```

The abort clause says **skip and continue**, not "abort the run": at Step 4.5 the reviewers have
already produced findings the user came for, matching `:803`'s existing "Continue to Step 5
regardless."

Satellites keep the form `(satellite of `references/review-persist.md`)` — a fact, never a restated
procedure.

### Alternative Approaches Considered

- **Repo-root placement.** Rejected: single consumer, so `CLAUDE.md:72`'s stated reason for root
  placement does not reach it. Skill-local also enters the recursive `sentinels` corpus.
- **Keeping the scope-ref table resident** to preserve one load site. Rejected: makes a satellite
  restate a procedure, saves 12 fewer lines.
- **Dropping the Step 1d announce.** Rejected: a real UX regression on exactly the path where the path
  is wrong.

## Implementation Phases

### Phase 1: Convention First, Then Prove the Mechanism

#### Changes Required

**File**: `CLAUDE.md`

##### U1 — Rewrite the `references/` placement bullet before any extraction

Replace `CLAUDE.md:72` so it states placement by **shareability**: single-consumer references live at
`skills/<name>/references/` cited by bare relative path; multi-consumer references stay at the repo
root, cited `${CLAUDE_PLUGIN_ROOT}`-anchored from a skill and bare from an agent. Preserve two things
the current bullet owns — the prohibition on normalising the spellings, and the mechanism sentence
explaining that a skill resolves bundled paths relative to its own `SKILL.md` (that sentence is *why*
bare-relative works; the rewrite inverts its conclusion rather than deleting it).

Add the migration note the rule now requires: placement depends on consumer count, which can change.
State that before adding a second consumer to a skill-local reference, `grep -rn "references/<basename>"
skills/ agents/` enumerates the citers that must be relocated and re-spelled. Without this, gaining a
second consumer is a silent file-move-plus-N-citation-edits with no way to find the N.

Lands **before U3**: `agents/convention-checker.md` is a mandatory gate that reads `CLAUDE.md`, and the
old bullet would make it flag every new file in this slice's own diff.

Test scenarios:
- A convention-checker run on a diff adding `skills/ba-review/references/foo.md` with a bare-relative citation reports no placement violation (Covers AC7)
- The bullet still forbids normalising the citation spellings to one
- A reader can find how to locate all citers before promoting a reference to multi-consumer

Verify: `grep -q 'skills/<name>/references/' CLAUDE.md && grep -q 'do not normalise' CLAUDE.md && grep -q 'grep -rn' CLAUDE.md`

---

**File**: probe harness (throwaway fixture repos, not committed)

##### U2 — Three-arm live probe: does the load site fire, is it skipped, does it fail safely

Build byte-identical working-tree copies differing only in the extraction under test, per the harness
spec at `docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md:36-48`:
`claude --plugin-dir <arm> --settings <hook.json> --permission-mode dontAsk -p "<cue>"
--output-format stream-json --verbose`, one fresh non-interactive session per repetition, each in a
per-run fixture directory created from `git archive`.

**The three arms answer different kinds of question, and get different rigor:**

| Arm | Cue | Question | Kind | Trials |
|---|---|---|---|---|
| A | `/ba-review --persist` | does bare-relative resolve, and to which path | deterministic fact | one confirmed run suffices |
| B | `/ba-review` (no flag) | is the file skipped when unreached | behavioral | multiple trials, void handling, positive control |
| C | `/ba-review --persist`, reference file removed | does it skip-and-continue rather than improvise | behavioral | multiple trials |

Arm B is the savings gate. Arm C tests the abort clause — the one behavior the plan calls decisive,
which would otherwise ship untested (Covers AC5).

Pre-register **before the run**, because none of it can be decided honestly afterwards: trials per arm
and the minimum non-void count; the mechanism assertions (which tools must appear for a cell to be
scorable — a cell failing one is **void, not a data point**); a **blocking positive control** that must
be non-zero, through the identical capture path, with scoring refusing to emit a matrix if it fails;
and the void condition, written down before the zero arrives.

Controls against the three documented instrument-failure axes:
- **Path identity, not read-success.** Assert the resolved path in the transcript. Run from a cwd that
  is neither the repo root nor the skill directory, and confirm no `review-persist.md` exists under the
  top-level `references/` — otherwise a cwd-relative resolution reads the wrong file and scores as
  success.
- **Arm distinctness.** Ask each arm to quote back the load-site sentence it sees and diff them before
  spending budget. An empty diff means there is no experiment.
- **Global instructions.** Record or neutralise the caller's global config; it loads into a live session
  and outranks the skill body.
- **Isolation tripwire.** Snapshot each fixture's file list before the run; assert at scoring time that
  no run saw a file it did not create. This is detective, not preventive — see `## What We're NOT Doing`.

Read the transcript for every miss. Record that `--plugin-dir` collapses plugin-root onto cwd, so a
pass does not generalise to an installed plugin. Record that this is a **point-in-time proof with no
regression detector**: nothing re-verifies on future invocations that the model still performs the
Read, so re-run Arms A and B on any model bump that changes `/ba-review` behavior.

No extraction commit lands until Arms A, B, and C pass.

Test scenarios:
- Arm A's transcript contains a Read resolving to `skills/ba-review/references/review-persist.md` (Covers AC2)
- Arm B's transcript contains no Read of that file (Covers AC1)
- Arm C creates no directory under `docs/reviews/` and still presents findings (Covers AC5)
- The positive control is non-zero; if it is zero, no matrix is emitted
- Arm distinctness diff is non-empty before scoring begins
- A cell failing a mechanism assertion is recorded void and excluded from the count

Verify: *(commit-tag-only — a probe run produces no repo state, and any grep here would confirm authorship rather than behavior)*

> **Phase gate:** All units in this phase reach `done` via `Verify:` or a U-tagged commit → automated checkpoint proceeds automatically. No manual pause.

---

### Phase 2: Extract the Procedure

#### Changes Required

**File**: `skills/ba-review/references/review-persist.md` (new)

##### U3 — Move the procedure body, not the gate

Create the file holding `skills/ba-review/SKILL.md:694-803` verbatim: `### 4.5a` (the `SCOPE_TYPE` →
`SCOPE_REF` table, the `sanitize(s)` grammar with its `[A-Za-z0-9._-]` character class and `unknown`
fallback, the `-2`/`-3` collision rule) through `### 4.5e`. Lines 688–692 stay resident.

The preamble must carry **both** the inputs and the reason for one of them: it names its single
consumer, its two load sites, that `TIMESTAMP` arrives already captured at argument-parse time, **and
why** — deferring the capture produces announce-vs-write skew (`SKILL.md:26`). Without the rationale
travelling with the fact, an editor working inside this file alone has no local signal against
re-deriving `TIMESTAMP` closer to the write.

State that 4.5e sets `PERSIST_WRITE_OK` — true only when all three write operations succeeded, per
`:799`'s existing all-or-nothing enumeration — and that the resident Done lines read it.

Preserve to the character: the path contract `docs/reviews/<TIMESTAMP>-<scope-ref>/`, the frontmatter
value sets (`scope`, `source`, `status`), and the `sanitize(s)` grammar. While relocating the
`SCOPE_TYPE` table, add a one-line assertion that `mr` scope's `N` is numeric — that row interpolates
`mr-<N>` without passing through `sanitize()`, and this relocation is the moment the assumption gets
copied forward rather than re-verified.

Test scenarios:
- The moved region contains no `[AUTO-SCORE:` sentinel and no heredoc opener, so no CI corpus coverage is lost (Covers AC8)
- Every fenced code block in the moved range is balanced, and so is the remaining body
- An editor reading only this file learns why `TIMESTAMP` must not be re-derived

Verify: `test -f skills/ba-review/references/review-persist.md && grep -q 'A-Za-z0-9._-' skills/ba-review/references/review-persist.md && grep -q 'skew' skills/ba-review/references/review-persist.md && grep -q 'PERSIST_WRITE_OK' skills/ba-review/references/review-persist.md && ! grep -q '### 4.5a' skills/ba-review/SKILL.md`

---

**File**: `skills/ba-review/SKILL.md`

##### U4 — Two load sites, byte-identical, both behind `PERSIST=true`

Place the load-site sentence from `## Technical Approach` after `:692`, inside the existing branch, and
a second at Step 1d (`:203`). Repoint `:203`'s dangling `(see Step 4.5a's table)` at the new file by
name, never by position.

**Both copies must be byte-identical to each other.** This is the same drift hazard the per-`Task`-block
work in the split-out plan exists to close — a total-occurrence count cannot detect two copies diverging.
The `Verify:` below asserts identity, not presence.

State the per-site failure semantics explicitly, since "abort this step" means different things at the
two sites:
- **Step 1d read fails** → skip the announce, say so, and treat `PERSIST` as **off for the remainder of
  the run**. Do not let Step 4.5 retry: a persist directory created without the announce defeats AC3's
  `^C` guarantee.
- **Step 4.5 read fails** (only reachable if 1d succeeded) → skip the persist work, say so, retract the
  earlier announcement by name, and continue to Step 5. Review findings are never discarded.

Disclosed override: the brainstorm locked "exactly one `LOAD-SITE` per extracted region." Two are used
to keep the `^C` affordance; both are gated on the same flag, so no savings are lost.

Test scenarios:
- A `--persist` run announces the resolved target before reviewer selection (Covers AC3)
- A `PERSIST=false` run reaches neither load site (Covers AC1)
- A 1d read failure suppresses both the announce and the later write, with no directory created (Covers AC5)
- A 4.5 read failure retracts the announcement and still shows findings (Covers AC5)
- Neither load site cites the file by position

Verify: `test "$(grep -c 'that file is the only authority' skills/ba-review/SKILL.md)" = 2 && test "$(grep -n 'references/review-persist.md' skills/ba-review/SKILL.md | head -1 | cut -d: -f1)" -lt "$(grep -n '^## Step 2' skills/ba-review/SKILL.md | cut -d: -f1)" && ! grep -q "Step 4.5a's table" skills/ba-review/SKILL.md`

##### U5 — Repoint the satellites and gate the Done lines on `PERSIST_WRITE_OK`

`:20-26` and `:192` stay as facts, each tagged `(satellite of `references/review-persist.md`)`.

`:973` and `:1035` currently print "Persisted to …" unconditionally on `PERSIST=true`, even when 4.5e
already warned that a write failed. Gate both on **`PERSIST_WRITE_OK`** — the named fact U3 has 4.5e
set, using `:799`'s existing all-or-nothing three-way definition (`mkdir`, per-reviewer Write, or
`summary.md` Write). Do not invent a narrower condition that checks only `mkdir`.

Naming the carrier is the point: the verdict is computed inside the extracted file and consumed by
resident text many turns later, in two different scope branches. Without a named fact this is stated at
the wrong altitude to implement consistently — the same reason `:26` names `TIMESTAMP`'s single-capture
rule explicitly.

Test scenarios:
- A `--persist` run whose `mkdir` fails warns once and prints no "Persisted to …" line (Covers AC4)
- A run whose `summary.md` write fails behaves identically to a `mkdir` failure (Covers AC4)
- A successful run still prints the line on both the local and MR Done paths
- Each satellite states a fact and restates no procedure

Verify: `test "$(grep -c 'PERSIST_WRITE_OK' skills/ba-review/SKILL.md)" -ge 2 && test "$(grep -c 'satellite of `references/review-persist.md`' skills/ba-review/SKILL.md)" -ge 2 && test "$(grep -c 'Persisted to' skills/ba-review/SKILL.md)" = 2`

> **Phase gate:** All units in this phase reach `done` via `Verify:` or a U-tagged commit → automated checkpoint proceeds automatically. No manual pause.

---

### Phase 3: Record, Measure, Ship

#### Changes Required

**File**: `CLAUDE.md`, `README.md`

##### U6 — Record the new path in both artifact-path tables

Add `skills/<name>/references/` to `CLAUDE.md:66` and `README.md:303` alongside the repo-root row. U1
states the *rule*; a reader of the tables must still be able to find where a skill-local reference
lives. Reword both rows, which currently read "Format-rendering references + per-skill section
contracts" and no longer describe the contents.

Test scenarios:
- Both artifact-path tables name both reference locations with their citation forms (Covers AC11)

Verify: `grep -q 'skills/<name>/references/' README.md && grep -q 'skills/<name>/references/' CLAUDE.md`

---

**File**: none (measurement)

##### U7 — Measure the shrink and confirm the CI corpus grew

Report `skills/ba-review/SKILL.md`'s before and after resident weight with both endpoints derived by
`wc -c` ÷ 4 — the method behind the original ~17.8k figure, and a deliberate underestimate on
table-heavy files. Do not mix methods across endpoints.

Run `node scripts/check-invariants.mjs` in full and confirm the `sentinels` subject count rose above 4,
evidencing that the new file entered the corpus rather than assuming it. Note that
`listReferenceFiles` stays top-level-only, so the new file is not a subject of the `references`
cited-at-least-once check — its citation is covered by U4's `Verify:` instead. Extending that walker is
deliberately out of scope: the recursive `loadCorpus` already means a root reference cited *only* from
inside a skill-local reference would pass while being unreachable from any resident body, and fixing
the subject list without narrowing the corpus would leave that hole open while implying it was closed.

Test scenarios:
- Both line-count endpoints are derived by the same method and both are stated (Covers AC9)
- `sentinels` reports more than 4 subjects (Covers AC8)

Verify: `node scripts/check-invariants.mjs && test "$(node -e "process.stdout.write(String(Math.round(require('fs').statSync('skills/ba-review/SKILL.md').size/4)))")" -lt 17000`

---

**File**: `docs/brainstorms/2026-08-08-prompt-surface-shrink-slice-2-brainstorm.md`, issue #59

##### U8 — Amend the origin and record the deferrals on the roadmap

Add an amendment note to the brainstorm recording the always-reached finding, the two deferrals, the
corrected extraction boundary (694 not 688), the two-load-site override, and the Phase-3 split. The
artifact currently claims a scope that planning invalidated.

On issue #59: record both extraction targets as deferred with the always-reached rationale and a
revisit trigger, and mark the follow-up `needs-brainstorm`. Link the split-out plan.

Test scenarios:
- The brainstorm states the narrowed scope and the always-reached rationale (Covers AC12)
- Issue #59 carries both deferrals with a revisit trigger (Covers AC12)

Verify: *(commit-tag-only — the brainstorm edit and the issue comment are both text this unit authors, so any grep here would confirm authorship rather than behavior)*

---

**File**: `.claude-plugin/plugin.json`

##### U9 — One version bump for the slice

`0.42.0 → 0.43.0`. HEAD already bumped `0.41.0 → 0.42.0`, so this is a new bump. Three phases are three
chances to re-bump; bump exactly once, here.

Test scenarios:
- `version` changes exactly once across the slice (Covers AC10)
- `version-bump` passes, since `skills/` paths changed

Verify: `grep -q '"version": "0.43.0"' .claude-plugin/plugin.json && node scripts/check-invariants.mjs --only version-bump`

> **Phase gate:** All units in this phase reach `done` via `Verify:` or a U-tagged commit → automated checkpoint proceeds automatically. No manual pause.

## System-Wide Impact

### Interaction Graph

`/ba-review --persist` → Parse Arguments captures `TIMESTAMP` (`:20-26`, resident) → Step 1d loads
`review-persist.md` for `SCOPE_REF`, announces → Step 2 reviewer selection → Step 4.5 loads it again
for the write procedure, sets `PERSIST_WRITE_OK` → Step 5 Done prints "Persisted to …" only if that
fact is true. A `PERSIST=false` run touches neither load site.

`agents/convention-checker.md` reads `CLAUDE.md` on every brainstorm and plan write — why U1 precedes U3.

### Error & Failure Propagation

Two failure paths where there was one, and the plan names how they agree rather than asserting it:

| Failure | Handling | Set by |
|---|---|---|
| Read fails at Step 1d | skip announce, treat `PERSIST` as off for the run, no directory | U4 |
| Read fails at Step 4.5 | skip persist, retract the announcement, continue to Step 5 | U4 |
| Any of three writes fails | warn once, `PERSIST_WRITE_OK=false`, continue to Step 5 | U3 (4.5e) / U5 |

`PERSIST_WRITE_OK` is the single carrier the Done lines consult, so "the two must not disagree" is
enforced by there being one fact rather than two prose claims. Arm C tests the read-failure path;
AC4's scenarios test the write path.

### State Lifecycle Risks

`TIMESTAMP` is captured at parse time and must survive unchanged to Step 4.5 — and its rationale now
travels into the reference file (U3), not only `:26`. `SCOPE_REF` is derived at Step 1d and again at
Step 4.5 from the same table; deriving it twice from the table is safe, deriving it from memory the
second time is not, which is what the anti-summary clause targets. `PERSIST_WRITE_OK` must survive from
4.5e to whichever Done branch runs.

### API Surface Parity

`docs/reviews/<TIMESTAMP>-<scope-ref>/` is mirrored in `CLAUDE.md:65` and `README.md:302`, and is one of
five protected-artifact roots. The path contract does not change; only its owning file does.

### Integration Test Scenarios

1. `--persist` × `mr` scope × Done — both load sites fire, `SCOPE_REF` crosses from Step 1d to 4.5.
2. `--persist` × `mkdir` failure × Done — one warning, `PERSIST_WRITE_OK=false`, no "Persisted to …".
3. No `--persist` × any scope — neither load site fires (AC1).
4. `NO_CHANGES` × `--persist` — exits at `:192` before either load site; the resident precedence fact
   still holds and no load is attempted.
5. `--persist` × reference file removed — skip-and-continue, no directory, findings still shown (AC5).

## Risk Analysis & Mitigation

| Risk | Mitigation |
|---|---|
| Bare-relative citation does not resolve | U2 Arm A, path identity asserted. Gate |
| File read even when unreached, so savings are zero | U2 Arm B, the negative control |
| Failed read → improvised, unsanitized directory path | U2 Arm C + AC5; the skip-and-continue clause |
| Probe passes for the wrong reason (cwd resolution) | Non-root cwd, basename-collision check, resolved-path assertion |
| Result does not generalise to installed plugins | Recorded as residual unproven behavior, not claimed |
| Broken instrument reads as a clean null | Blocking positive control; scoring refuses to emit a matrix |
| **No regression detector after landing** | Recorded in U2: re-run Arms A and B on any model bump. There is no standing check that the Read still happens |
| Two load-site copies drift apart | U4's `Verify:` asserts byte-identity, not presence |
| **Satellite states a stale claim about moved content** | **Not mitigated.** U8's convention names the parent file, but nothing detects that a satellite's *claim* about that file's procedure went stale — `:203`'s table reference and `:192`'s ordering precedence are both content claims. Accepted residual gap |
| Convention gate fights the refactor | U1 lands first |
| Re-bumping the version across three phases | Single bump confined to U9 |
| Consumer count changes, forcing a citation-form migration | U1's `grep -rn` note is the only mechanism; no CI check enumerates citers |

## Testing Strategy

Three layers. **CI** (`check-invariants`) pins string identity and structure — never meaning. **The
three-arm probe** answers what no static check can: path resolution (Arm A), non-read on the untaken
branch (Arm B), and safe failure (Arm C). **Verify lines** assert wiring, not presence — U4 checks
byte-identity and ordering rather than an occurrence count, and U2/U8 decline to mint a `Verify:` at all
rather than grep for text they wrote.

The abort clause is no longer untested — Arm C is its experiment. What still ships without one is the
**anti-summary clause** ("do not act from this body's description of it"). That is steering, and the
settling experiment is three fixtures × two arms on the load-site sentence with and without the clause,
scoring whether the model re-derives the procedure instead of reading. Deferred, not dismissed.

## Documentation Plan

`CLAUDE.md` (placement bullet with migration note, artifact-path row), `README.md` (artifact-path row),
the origin brainstorm (amendment), issue #59 (deferrals plus revisit trigger, link to the split-out
plan). The new reference file carries its own preamble naming its consumer, its load sites, the
`TIMESTAMP` rationale, and `PERSIST_WRITE_OK`.

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-08-08-prompt-surface-shrink-slice-2-brainstorm.md` — carried
  forward: placement by shareability with bare-relative skill-local citation; the load-site sentence
  including the anti-summary clause; probe-before-extract sequencing.
- Split-out sibling: `docs/plans/2026-08-08-fix-ba-review-plan-dispatch-drift-plan.md`

### Internal References

- `docs/solutions/prompt-authoring/2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md` — the
  runtime-observable AC rule and the per-occurrence CI pattern.
- `docs/solutions/prompt-authoring/2026-07-31-probe-instrument-validation-false-zeros.md` — blocking
  positive control, `PreToolUse` rig, fixture isolation.
- `docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md` —
  mechanism assertions, void-not-data-point, global-instruction neutralisation.
- `docs/research/2026-07-30-ba-skill-trigger-scoping-probe-research.md:36-48` — the reusable harness
  spec and the arm-distinctness trick.
- `docs/plans/2026-08-02-refactor-prompt-surface-shrink-slice-1-plan.md:552-588` — precedent for a
  commit-tag-only dry-run unit.
- `.claude/agent_docs/prompt-authoring.md:25-29` (weight as cost), `:73-93` (fixture A/B protocol).

## Convention Compliance

- [x] Weight is a first-class cost — aligned. Only branch-only material is extracted; two targets were
  dropped once shown always-reached.
- [x] `references/` placement — **justified override**, rewritten rather than broken. U1 preserves the
  no-normalising prohibition and the resolution-mechanism sentence, and adds the migration note.
- [x] One version bump per ship — aligned. `0.42.0 → 0.43.0`, confined to U9.
- [x] U-ID and stack-base axes — not disturbed. The moved range contains no `<base>` derivation and no
  `derive-state` call.
- [x] `**Code-shape decision:**` mirror list — no change needed; the three `ba-plan` sites are in the
  deferred target-3 range.
- [x] Protected-artifacts guard — untouched; nothing here edits a reviewer dispatch template.
- [x] Hyphen never colon outside `docs/` — aligned; `retired-invocations` scans the new file's directory.
- [x] README updated for a new artifact path — aligned via U6.
- [x] Machine-boundary vs steering — aligned and explicit. The load-site sentence and `sanitize(s)` are
  specified to the character; the anti-summary clause is named as steering with its settling A/B
  described.
- [ ] **Locked-design invariant override — disclosed debt.** The brainstorm locked one load site per
  region; U4 uses two. Surfaced conversationally and approved before landing; recorded in U8's
  amendment. Both sites behind the same flag, so the savings claim is unaffected.
- [ ] **Anti-summary clause ships without an A/B — disclosed debt.** Experiment specified in
  `## Testing Strategy`, deferred.
- [ ] **Satellite content-drift has no detector — accepted residual gap.** Recorded in
  `## Risk Analysis & Mitigation` rather than implied closed.
