---
date: 2026-08-08
topic: prompt-surface-shrink-slice-2
status: approved
triage_level: full
tags: [prompt-surface, references, ba-review, ba-plan, progressive-disclosure]
---

# Prompt-Surface Shrink, Slice 2 — Conditional Prose Behind Named Load Sites

## Amendment — 2026-08-08 (post-planning, post-implementation)

**This document below still describes a three-target slice. Planning invalidated that scope, and
implementation narrowed it further. Read this section first; where it conflicts with the body, this
section wins.** Plan:
`docs/plans/2026-08-08-refactor-prompt-surface-shrink-slice-2-plan.md`.

**Only Target 1 was extracted.** Targets 2 and 3 are **deferred**, for the same defect found while
planning: both are **reached on every run**, so relocating them makes the body *heavier*, not
lighter.

- **Target 2 — `ba-review` Step 5 resolvers (296 ln).** `## Step 5: Resolution` is reached on every
  run past the `NO_CHANGES` exit, so one file holding both mutually-exclusive branches is read every
  run: shrunken body **plus** the whole file **plus** load overhead. Restoring conditionality means
  splitting by branch, which this document's own `## Locked Design` forbids ("moves whole — never
  split"), and which duplicates the ~51-line post-apply guard reachable from both. Also found while
  planning: option labels and their routed action text share a line, so this is a **rewrite, not a
  relocation**; and there are **six** menu families in the range, not five. Needs its own brainstorm.
- **Target 3 — `ba-plan`'s three detail-level templates (222 ln).** Same defect: Step 4 is reached on
  every `/ba-plan` run. This document rejected Design A partly *because* it made these an
  always-fired read; Design B has the identical property for the same target.

**Corrected extraction boundary.** The table below says `688-804`. The extraction took **694–803**.
Lines 688–692 (step heading, `PERSIST=false` gate blockquote, `.gitignore` cross-reference) stay
resident — the load site must sit *inside* a conditional branch, and cutting from 688 would have
removed the branch itself.

**Locked-design override — two load sites, not one.** `## Locked Design` locked "exactly one
`LOAD-SITE` per extracted region." The implementation uses **two**, because Step 1d needs `SCOPE_REF`
before Step 2 to preserve the `^C` affordance and Step 4.5 needs the write procedure. Both are gated
on the same flag, so no savings are lost. Surfaced and approved before landing.

**Phase-3 split.** `ba-review-plan`'s dispatch drift and the `rubric-mirror` hardening were split out
to `docs/plans/2026-08-08-fix-ba-review-plan-dispatch-drift-plan.md` — a live defect with no
dependency on this extraction, which should not wait behind a probe gate.

**The probe passed; it was the real deliverable.** Three arms, 7 cells, 0 void, all pre-registered:
bare-relative skill-local citation **resolves** to the skill-local path (Arm A); the file is **not
read** on a run that does not take the branch (Arm B, 3/3, each having reached Step 5); and a missing
reference file makes the run **skip and continue without improvising** a directory (Arm C, 3/3).

**Measured shrink, and its honest limit.** Resident weight fell 70161 → 67641 bytes (~17540 → ~16910
est tokens, 95 lines, 3.6%), both endpoints by `wc -c` ÷ 4. But the extracted file is ~1948 est
tokens, so a `--persist` run now costs **~1318 est tokens more** than before. Conditionality was
bought at a cost on the conditional path.

**Residuals not closed.** `--plugin-dir` collapses plugin-root onto cwd, so the probe does not
generalise to an installed plugin. There is **no regression detector** — nothing re-verifies that the
model still performs the Read; re-run Arms A and B on any model bump that changes `/ba-review`
behavior. The anti-summary clause still ships without an A/B.

## What We're Building

Slice 2 of issue #59. Slice 1 landed the three "near-free" items (−213 lines) by de-duplicating
and purging. Slice 2 does the harder half: relocating **conditionally-reachable** prose out of
always-resident skill bodies into `references/` files, loaded at named load
sites. Three targets, ~635 lines of body, of which ~400 are dead on any given run.

Unlike slice 1 these make a genuine behavioral claim — that a named load site actually gets read —
and that claim has never been tested in this repo. So slice 2 is sequenced probe-first: prove the
mechanism on one target before extracting the rest.

| # | Target | Lines | Fires when |
|---|---|---|---|
| 1 | `skills/ba-review/SKILL.md:688-804` — `--persist` run artifacts | 117 | `PERSIST=true` (may not fire at all) |
| 2 | `skills/ba-review/SKILL.md:811-1106` — the two Step 5 resolvers | 296 | one-of-2, mutually exclusive |
| 3 | `skills/ba-plan/SKILL.md:249-470` — three detail-level templates | 222 | one-of-3, mutually exclusive |

## Why This Approach

**A fourth target was dropped.** Issue #59's checklist names `skills/ba-propose/SKILL.md:350-520`
(the Step 3 composition spec, 171 ln). It **runs on every invocation**, including `--describe-only`,
so it fails the unreachable-weight test. Its only case would be cohesion/read-once, which
`.claude/agent_docs/prompt-authoring.md:66` explicitly rejects as a finding on its own ("a long
section that is all load-bearing is fine"). Slice 2 keeps one coherent argument; #59 should record
why this bullet is not simply pending.

**The external precedent was decisive.** A separately-studied Claude Code plugin (the
compound-engineering plugin, reviewed locally) runs this pattern at scale — 32 skills, 8,318
resident lines against 208 reference files / 25,036 lines, 286 load sites — and has written doctrine
plus CI enforcement for it. Two findings shaped this design:

1. Their extraction test (`AGENTS.md:144-149`): extract when a block is **conditional AND
   late-sequence AND ~20%+** of the skill; replace it with a 1–3 line condition plus a backtick
   path. Also: *"Do not inline a summary complete enough to suppress loading the authoritative
   reference"* — an agent holding a workable summary judges it has enough and never opens the file.
2. Their post-mortem (`docs/solutions/skill-design/post-menu-routing-belongs-inline.md`): `ce-plan`
   extracted an interactive menu's per-option routing into a reference, and agents **rendered the
   menu, captured the selection, and stopped without firing the action**. Root cause was two
   compounding failures — the reference never loaded, and even when loaded the routing language
   didn't name the platform's invocation primitive.

Finding 2 lands directly on target 2: the Step 5 resolvers *are* AskUserQuestion menus with
per-option routed actions. That is why the design keeps menus resident and moves only action bodies.

**Rejected: uniform treatment of all targets.** Target 2's interactive nature makes the default
one-sentence load site unsafe there. Rather than hardening the default for every site, the design
prices an escape hatch locally.

**Reference home is decided by shareability, not by a default location.** A single-consumer file
lives skill-local (`skills/ba-review/references/`) and is cited by the **bare relative** path; a
multi-consumer file stays at the repo root and is cited `${CLAUDE_PLUGIN_ROOT}`-anchored from skills
and bare from agents. Rationale: the `${CLAUDE_PLUGIN_ROOT}` prefix exists *only* because a root file
is outside the skill's own directory — `CLAUDE.md` states that a skill resolves bundled paths
relative to its own `SKILL.md`, so skill-local is the native form and root is the workaround.
`CLAUDE.md`'s root rationale is specifically that a skill-local copy cannot serve
`agents/convention-checker.md` and would duplicate `html-rendering.md` across five skills — neither
applies to a file with one consumer. Verified bonus: `walkMarkdown` (`scripts/check-invariants.mjs:59`)
recurses `skills/`, so skill-local reference files land in the `sentinels` and `retired-invocations`
corpora and in `version-bump` via the `skills/` prefix. The repo-root layout leaves that gap open.

**Rejected: mandated per-skill duplication.** The external plugin forbids cross-skill references
outright, paying with byte-duplicated files and five parity tests. Shareability-based placement takes
the colocation benefit without that tax.

## Key Decisions

- **Scope is the three conditional targets; `ba-propose` Step 3 is out.** It is always-reachable, so
  it fails the test the slice is built on.
- **Design B (Common case) is locked** — see `## Locked Design`.
- **Reference home follows shareability, not a default location.** Single-consumer files go
  skill-local (`skills/ba-review/references/`, bare relative citation); multi-consumer files stay at
  the repo root. This overrides Design B's as-generated all-at-root layout and post-dates the
  convention gate — see the amendment note in `## Convention Compliance`. It also closes the
  `sentinels` blind spot that root placement would have inherited.
- **The default load-site sentence carries an anti-summary clause**, grafted from Design C: *"do not
  act on this step from memory or from this body's description of it — that file is the only
  authority."* Rationale: it is the mechanical countermeasure to the post-mortem's second failure
  mode, and B's own sentence did not state it.
- **Probe before extract.** A fresh-session `claude --plugin-dir <repo>` run proves the load site
  fires before any extraction lands, with a **pre-registered mechanism assertion** so a null run is
  void rather than a data point. This follows the three documented instrument-failure axes
  (`docs/solutions/prompt-authoring/`: subagent CLAUDE.md inheritance, probe false zeros, and
  global instructions replacing the step under test). Slice 1's "ship on a dry-run" override does
  **not** transfer — it rested on the composed prompt being byte-identical, which is exactly the
  claim that broke, and slice 2's changes are not byte-neutral.
- **Probe target is target 1** (`--persist`): smallest, strongest conditionality, and the only one
  with no menu routing to confound the result. Assumption for the plan to confirm.
- **Target 1 is kept despite being 10% of the body** (117/1115), below the borrowed ~20% size bar.
  Justification: it has the strongest conditionality of the three — it may not fire at all — and the
  bar is an external heuristic, not a repo convention. Recorded as a deliberate, disclosed deviation.
- **Both resolvers share one file.** One load site therefore pulls in the not-taken branch
  (~132 or ~164 wasted lines per run). Accepted: 296 lines become conditional on reaching Step 5 at
  all, and the ~56-line post-apply guard is genuinely reachable from both branches, which is what
  forbids splitting them. Recorded as chosen, not assumed.
- **Target 3 absorbs its four dragged obligations in the same commit** — see
  `## Convention Compliance`.
- `references/` is in `VERSION_BUMP_WATCHED_PREFIXES`, so **exactly one** `plugin.json` bump for the
  whole slice, after checking the branch has not already bumped.

## Locked Design

**Source:** Design B — Common case, with the anti-summary clause from Design C added to the default
load-site sentence (a separately confirmed decision, not part of B as generated).

### Interface

Three files, one of them pre-existing.

| File | Owns | New? |
|---|---|---|
| `skills/ba-review/references/review-persist.md` | The whole `--persist` procedure: directory naming, per-file writes, the scope-ref table, the manifest/summary shape. Single consumer → skill-local | new |
| `skills/ba-review/references/review-resolvers.md` | The *action bodies* of both Step 5 resolvers, plus the shared post-apply reconciliation guard and the Apply-filter predicate (moves whole — never split). Single consumer → skill-local | new |
| `references/plan-sections.md` (repo root) | Extended, not joined by a sibling: the three detail-level templates land here. Four consumers → stays at root. No fourth file, so no competing canonical source | extended |

**Entry point 1 — `LOAD-SITE` (the default).** Written where the conditional prose used to begin,
immediately *after* the already-resident gate condition:

> **Load site — `<step name>`.** Read `references/<file>.md` now and follow
> it. Everything this step does lives there; do not act on this step from memory or from this
> body's description of it — that file is the only authority.

Invariants: exactly one `LOAD-SITE` per extracted region; it sits **inside** the conditional branch,
never above it; and the citation form follows the file's home — **bare relative** for a skill-local
file (it resolves against the skill's own directory), `${CLAUDE_PLUGIN_ROOT}`-anchored for a
repo-root file cited from a skill, bare for a repo-root file cited from `agents/`. Error mode: if the
read fails, abort the step and say so — never improvise the procedure from the gate sentence.

Note the CI consequence: the `references` orphan check reads the repo-root directory only
(`listReferenceFiles`, `scripts/check-invariants.mjs:307`, top-level by construction), so the two
skill-local files are **not** covered by it. Either extend that walker to `skills/*/references/` or
accept the gap knowingly — do not assume the check covers them.

**Entry point 2 — `LOAD-SITE(interactive)` (escape hatch, target 2 only).** Required because the
post-mortem forbids the default shape for a rendered menu. Three parts, in this order:

(a) a **resident** bare option list — labels and order only, no action text, so nothing resident is
complete enough to act on; (b) a read instruction that fires **strictly before** the
AskUserQuestion call, stating that the per-option action bodies live in the reference and the list
is not actionable without them; (c) after the answer, an instruction to fire the chosen option's
action body from the loaded reference, stating that **rendering the menu is not the step's
completion**. Per-option routed actions stay resident.

**Entry point 3 — `SATELLITE` (resident stub).** For target 1's four satellites and the
cross-branch Apply-filter citation. Each stays resident, one line, and names its parent:
`(satellite of `references/review-persist.md`)`. A satellite **may state a fact** (the parse-time
timestamp capture, the NO_CHANGES precedence) but **must not restate a procedure**.

### Usage example

The common case, at `skills/ba-review/SKILL.md` old line 688 — three lines replace 117:

**Code-shape decision:** the load-site sentence is a literal to be reproduced character-for-character
at every site, so it is shown as text rather than described.

```
If PERSIST=true:

**Load site — persist run artifacts.** Read
`references/review-persist.md` now and follow it. Everything this
step does lives there; do not act on this step from memory or from this body's
description of it — that file is the only authority.
```

Satellites elsewhere in the body, unchanged in position:

```
- Capture TIMESTAMP at argument-parse time (satellite of `references/review-persist.md`).
- Done line: "Persisted to `<run dir>`" (satellite of `references/review-persist.md`).
```

### What's hidden behind the seam

- **Run-artifact layout** — directory naming, file split, scope-ref table rows. A change to the
  on-disk shape touches only `references/review-persist.md`.
- **Resolver action bodies** — the two near-parallel procedures and the shared guard. The seam lets
  them converge into one parameterised procedure with no skill-body edit.
- **The Apply-filter predicate's rule text** — its *name* stays visible on both sides of the branch
  boundary, since it is cited by name; the rule text does not.
- **Detail-level template bodies** — the heading strings remain a parser contract, but they are now
  contracted from one file; template prose is free to change.
- **Which prose is resident at all** — the load site's shape is identical whether the file is 20
  lines or 300, so future extractions reuse the same one-sentence surface.

### Dependency strategy

Import-by-path, resolved at read time by the Read tool, never injected. No adapter: `references/` is
the sanctioned port; the two new single-consumer files sit inside `skills/ba-review/`, while
`plan-sections.md` stays at the repo root because four consumers — including
`agents/convention-checker.md` — cite it, and moving it would force the duplication that root
placement exists to prevent. `skills/ba-execute/SKILL.md:70-72`
stays a **direct, unmediated** dependency on heading text — it reads the produced plan artifact, not
the reference — so extending `plan-sections.md` keeps its existing sync obligation as the only one.
CI's citation check is a build-time consumer of the same string the runtime uses, so one sentence
serves both dependents. Neither new file reads another reference file at run time.

### Trade-offs

- **High leverage: the default load site.** One sentence, one slot, and it simultaneously fires the
  read and satisfies CI. Two of three targets need nothing else, and the next extraction is free.
- **High leverage: no new file for target 3.** Extending `plan-sections.md` avoids a competing
  canonical source, a second CI needle, and a second sync obligation — at the cost of a larger
  reference file that `ba-plan` already loads on the HTML path.
- **Thin leverage: target 2 pays the escape hatch in full.** Roughly 15 resident lines instead of 3.
  The common-case constraint makes that cost explicit and local rather than inflating the default
  form for everyone.
- **Thin leverage: satellites are hand-maintained.** `SATELLITE` is a naming convention with no
  enforcement; nothing detects a satellite whose parent file's procedure drifted, and target 1's
  four satellites are exactly where a silent break would land.
- **Residual risk the seam cannot cover:** an unfired read looks like a skipped step, not an error.
  "Do not act from memory" is steering, not a machine contract — which is why the probe gates the
  slice rather than a CI check.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule
(`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`).
Plan and execute may refine this design within the bounds of the lock; they may not re-add elements
from the rejected designs below.

## Rejected Designs

### Design A — Deepest module (rejected)

- **Interface summary:** two new files with one named entry point each —
  `finalize-review(run_ts, persist, scope, findings, selection, chosen_ids) -> outcome` absorbing
  everything after a Step 5 option is chosen, and `render-plan-template(detail_level)` taking over
  markdown canonicity from `plan-sections.md`.
- **Why rejected:** its depth is real — three of target 1's four satellites collapse into fields of
  one return value, and the cross-branch coupling that makes the resolvers hard to split is exactly
  what a single entry point absorbs. But two of its costs cut against the slice's own goal. It makes
  the plan templates an **always-fired read**, converting resident bytes into a guaranteed read
  rather than removing cost (its own trade-off list concedes this). And it delivers the least
  resident-line reduction on the largest target. Its read-before-render barrier also sits above the
  branch split, which is the exact sequencing that failed in the external post-mortem.

### Design C — Info hiding (rejected)

- **Interface summary:** three files behind a uniform `## Contract: <id>` directive carrying named
  inputs and outputs, with an opaque `scope_kind: "local" | "hosted"` as the only branch information
  crossing the seam; menus resident by rule; plan heading vocabulary left declared in
  `plan-sections.md` under a new anchor cited by both sides.
- **Why rejected:** the most disciplined decomposition, and honest that the two things most likely to
  be read from outside — the routing table and the plan headings — cannot hide. Rejected on resident
  cost: threading named inputs at every load site is more resident text than a bare pointer, and it
  splits target 3 across two files, which is the most correct decomposition and the most places to
  look. **One element was incorporated:** its anti-summary clause is now part of the locked default
  load-site sentence.

## Scope Boundaries

- **Not** `skills/ba-propose/SKILL.md:350-520` (Step 3) — always-reachable; excluded with rationale
  recorded on #59.
- **Not** the AskUserQuestion menus, option labels, option order, or per-option routed actions —
  resident by rule, per the external post-mortem.
- **Not** the `--persist` satellites: the parse-time timestamp capture, NO_CHANGES precedence, and
  the two "Persisted to …" Done lines stay resident as one-line stubs.
- **Not** the reviewer bullet grammar or the protected-artifacts guard in dispatch templates — slice
  1 established these are deliberate redundancy on a dispatch path; the transcribed copies stay.
  De-duplicating them away again is the regression to watch for.
- **Not** relocating the three existing repo-root reference files. `html-rendering.md`,
  `plan-sections.md`, and `brainstorm-sections.md` all have multiple consumers and stay put.
- **Not** a CI check for whether a load site actually fired (unenforceable — that is the probe's job).
- **Not** `ba-propose` Step 2e/2g's `proof: pending` / `Risk: high` misreads on this repo's own
  diffs. Known, fix identified and unlanded; a slice-2 `/ba-propose` run will reproduce both and
  needs the same disclosed override.
- **Not** closing the `sentinels` blind spot on the **repo-root** `references/`. Skill-local placement
  resolves it for the two new `ba-review` files — they sit under `skills/`, which `walkMarkdown`
  recurses, so they are genuinely in the corpus. It remains open for repo-root files including
  `plan-sections.md`: a future slice that moves a sentinel or heredoc there would silently drop it.
  Moot for slice 2 (no sentinel or heredoc sits in any of the three ranges), and now a narrower gap
  than the all-at-root layout would have left.

## Acceptance Criteria

- A fresh-session `claude --plugin-dir <repo>` probe on target 1 shows the load site firing, with
  the mechanism assertion pre-registered before the run and a null result recorded as **void**, not
  as evidence. Both arms' transcripts read, not just their outputs.
- No extraction commit lands before that probe result is recorded.
- Each new reference file is cited from its consuming skill in the form its home requires (bare
  relative for the two skill-local files; `${CLAUDE_PLUGIN_ROOT}`-anchored for repo-root), and
  `node scripts/check-invariants.mjs` passes every check — `sentinels`, `references`,
  `retired-invocations`, `rubric-mirror`, `version-bump`.
- The `sentinels` corpus demonstrably includes the two new skill-local files (they sit under
  `skills/`, which `walkMarkdown` recurses) — confirmed by the check's own subject count, not assumed.
- A decision is recorded on whether `listReferenceFiles` is extended to `skills/*/references/` or the
  orphan-check gap is accepted; it is not left implicit.
- `skills/ba-review/SKILL.md` and `skills/ba-plan/SKILL.md` line counts drop by a measured amount,
  reported with both endpoints derived the same way (`wc -c` ÷ 4, the method used for the original
  ~17.8k figure — a deliberate underestimate on table-heavy files).
- Target 2's resident option lists carry **no** action text, and each resolver's read instruction
  precedes its AskUserQuestion call.
- `Changes Required` has a row in `references/plan-sections.md`'s section vocabulary, and
  `skills/ba-execute/SKILL.md:70-72` still detects all three detail levels from a plan produced by
  each moved template.
- `CLAUDE.md:84`'s `**Code-shape decision:**` mirror list and both U-ID grid rows name the files
  that are true after the move.
- `README.md:303`'s `references/` row describes procedure-body references, not only format
  references and section contracts.
- Exactly one `version` bump in `.claude-plugin/plugin.json` for the slice.

## Open Questions

*(none — all resolved during Phase 1.2 dialogue and the Phase 3.5 gate)*

### Resolved Questions

- **Scope, given Step 3 is not branch-only** → three conditional targets only; Step 3 dropped with
  rationale to be recorded on #59.
- **Verification bar** → live-harness probe first, then extract.
- **Design** → Design B (Common case).
- **Anti-summary clause in the default load-site sentence** → yes, added.
- **Target 3's four dragged obligations** → extend `plan-sections.md` and absorb all four in the
  same commit.

## Convention Compliance

Convention-checker run: 14 conventions checked — 6 aligned, 1 justified override, 5 violations
(all resolved), 2 not applicable.

**Resolved violations.** All four remaining violations shared one root cause — target 3's move drags
obligations the draft had not named. Resolution: **extend `plan-sections.md` and absorb all four in
the same commit as the move.**

1. `CLAUDE.md:84`'s `**Code-shape decision:**` mirror list — three of its four named sites
   (`ba-plan:276`, `:339`, `:407`) sit inside the moved range. The mirror list is updated.
2. `references/plan-sections.md:5-7` declares itself **authoritative for the HTML path only**, with
   `ba-plan`'s inline templates canonical for markdown. Design B's rationale had this inverted.
   Corrected: `:5-7` and `:9-12` are rewritten to take markdown canonicity, rather than inherited.
3. The sync obligation at `:9-12` would otherwise name one file twice. Rewritten with the move.
4. Every unit-anchor minting site (`:273`, `:336`, `:404`) moves, so both `CLAUDE.md` U-ID grid rows
   — `skills/ba-plan/SKILL.md` "✓ mints unit anchors" and `references/plan-sections.md` "✓ names the
   owner + minter/consumer" — are updated. The format-neutral anchor rule at `ba-plan:475` falls
   outside the range and stays resident.
5. `Changes Required` is a parser heading (`ba-execute:71`) with **no row** in `plan-sections.md`'s
   authoritative vocabulary (`:36-38`), which calls deviation "a silent extraction failure." A row
   is added.

**Justified override.** Target 1 is 10% of its body, below the external ~20% extraction bar. Kept on
the strength of its conditionality; the bar is a borrowed heuristic, not a repo convention.

**Amended after the gate — reference placement.** The convention-checker validated an
all-at-repo-root layout and passed it. That layout was then overridden by the user: reference home is
now decided by **shareability**, so the two single-consumer files go skill-local under
`skills/ba-review/references/` with bare relative citations, and only `plan-sections.md` stays at
root. This makes `CLAUDE.md`'s `references/`-stays-at-repo-root bullet wrong as written — it must be
rewritten to state the shareability rule and the resulting three citation forms, in this slice. The
bullet's existing prohibition on normalising the spellings still holds.

**Aligned.** The citation-form split (skill bodies never use a bare path for a repo-root file, and no
`agents/` citation is added); the CI citation needle, which the default
sentence satisfies; `retired-invocations`, which scans both source and destination so colon-form
coverage is preserved; `rubric-mirror`, whose four literal occurrences all sit before line 688;
`sentinels`, whose `references/` blind spot costs nothing here because no sentinel or heredoc is in
range; and the never-hide selection ledger plus dispatch-side protected-artifacts guard, all outside
both `ba-review` ranges (the applier-side guard at `:880-881` is in range and travels with the
resolver it guards).

**Not applicable.** Planning-skills-never-write-code and the convention-gate-before-write ordering —
this slice relocates prose and changes no write ordering. The stack-base axis — no target range
contains `<base>` derivation or a based `derive-state` call.

**Also folded in.** `README.md:303` needs rewording, and `references/` being a watched prefix means
exactly one `plugin.json` bump.

## Next Steps
→ `/ba-plan` to create implementation plan
