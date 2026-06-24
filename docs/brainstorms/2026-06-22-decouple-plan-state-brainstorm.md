---
date: 2026-06-22
topic: decouple-plan-state
status: approved
triage_level: full
tags: [plan-state, execute, stable-uids, git-derived-progress, read-only-plan, issue-31, issue-35]
---

# Decouple Plan-State from the Plan File — stable U-IDs + git-derived progress

## What We're Building

`/ba:execute` currently treats the plan file *as* its state store: it flips `status:` frontmatter (`active`→`in-progress`→`completed`), checks `[ ]`→`[x]` boxes as the resume signal, and appends a `## Deviations` section. That is fragile in the real usage context (a large work repo, hundreds of devs) because **the plan artifact is usually not committed there** — so cross-session resume and traceability ride on an uncommitted, mutated file that doesn't travel across machines, worktrees, or teammates.

This work makes the **plan a read-only decision artifact** and moves all execution state into **git + code**: stable **U-IDs** on implementation units, a **git-commit-subject scan** for the fast resume path, and per-unit **`Verify:`-against-code** as the squash-proof done-authority. It is the keystone that unblocks the HTML plan mode (#33) and folds in the remainder of #35's verification-schema work (checkbox-free rendering, per-unit `Test scenarios:`/`Verify:`, `Covers AC<N>`, `### Success Criteria` retirement, `## Behaviors to Test` retirement). Scope is end-to-end: `plan.md`, `execute.md`, `propose.md`, `handoff.md`, plus a single shared U-ID/git-state convention.

## Why This Approach

Two fixed inputs were locked upstream before this design started:

1. **Verification-schema contract (#35** — `docs/brainstorms/2026-06-21-reconcile-acceptance-verification-schema-brainstorm.md`). Per-unit `Verify:` (code-matchable) is the **sole done-authority** this issue's resume-fallback reads; keyed `## Acceptance Criteria` already shipped across all tiers (v0.26.0). #35 moved its remaining template work into this issue's scope.
2. **Squash/trailer resolution (#31 comment, 2026-06-21).** The team squash-merges, so durable records cannot live in commit trailers (flattened at merge). Deviations live in the **MR/PR description + origin Linear ticket**; commit U-ID subjects are a **pre-merge resume fast-path** only; `Verify:`-against-code is the **squash-proof** done-detection backstop.

The central insight: the honest choice is not "mutate the plan vs. keep a sidecar journal" — both are *uncommitted-and-fragile* in the target repo. The only durable substrates are **git history (pre-merge), code state (squash-proof), and the MR/ticket (post-merge)**. The design routes each kind of state to the substrate that actually survives.

A design-it-twice exploration (deepest-module / common-case / info-hiding) ran for the U-ID + git-derived-state seam in the prior #31 session; the Locked Design synthesizes from it under the two fixed inputs. See `## Rejected Designs`.

## Key Decisions

1. **Read-only plan.** `/ba:execute` never mutates the plan: no `status:` transitions, no checkbox flips, no `## Deviations` append. The plan is a pure decision artifact; the plan is still the authority on *what* to build.
2. **Stable U-IDs on implementation units**, rendered as visible-text headings `### U<n> — <title>`. Visible text (not an HTML comment) so #33's future HTML mode can reuse them as `id` + visible text. Strike-don't-renumber: a U-ID survives reorder/split/delete and is never reused. U-IDs attach to **implementation units only** — never to `AC<N>` (plan-internal, no stability rule — #35) or `Test scenarios:`.
3. **Hybrid git-derived resume.** Primary: scan `git log <base>..HEAD` commit **subjects** for `U<n>` tokens → done set. Fallback: for any unit whose U-ID is absent, evaluate its per-unit `Verify:` against the working tree. Resume at the first pending unit. `Verify:` is the sole done-authority (#35).
4. **One commit-subject grammar, one owner.** `<type>(<scope>): U<n> <description>`, one U-ID per commit. A single "U-ID / git-derived-state convention" section owns the grammar and the derive-state operation; `execute.md` (Step 2f) and `propose.md` cite it, `handoff.md` reads the same derived state.
5. **Deviations → MR/PR description + Linear ticket** (system of record, squash-proof). `/ba:execute` may write an **optional transient** `Deviation (U<n>): …` commit trailer on the feature branch; `/ba:propose` rolls trailers up into the MR **body** (+ Linear ticket when linked). The MR **title** carries no U-ID. `propose` must not strip U-IDs from commit subjects.
6. **Hard cutover.** A plan frontmatter discriminator (e.g. `plan_schema: 2`) marks new-model plans; `/ba:execute` refuses old checkbox/status plans with re-plan guidance. No migration helper — single code path.
7. **#35 remainder lands here:** checkbox-free plan rendering (remove `- [ ]` everywhere in templates), per-unit `Test scenarios:` + `Verify:` fields, `Covers AC<N>` link syntax, `### Success Criteria` retirement, `## Behaviors to Test` retirement (its content descends to per-unit `Test scenarios:`).
8. **No human phase-boundary pause.** COMPREHENSIVE phase gates become **automated checkpoints**: all of a phase's units' `Verify:` satisfied → commit → proceed. The interactive manual-verification prompt is dropped; non-code/visual QA lives as per-unit `Test scenarios:` consumed by a driving agent (out of #31 scope — the `/ba:prove` #20 / `/ba:polish` #24 lane). The **content-triggered deviation pause stays** (it fires only on real divergence, where the signal is).
9. **Retire the Step 1.5 pre-execution LoC scope tripwire** (T=400) entirely. It reads `[x]` and writes `## Deviations` (both removed), effectively always no-ops, and is the last sibling of the already-retired `/ba:slice` + plan-LoC iteration gate (#32).

## Locked Design

**Source:** Synthesis of the prior design-it-twice exploration under two fixed inputs (#35 verification schema, #31 squash/trailer resolution) plus this session's fork decisions. Draws the *single derive-state operation* and *one-anchor-many-consumers* shape from Design A (deepest-module), the *resume-strategy-hidden-behind-one-verdict* invariant from Design C (info-hiding), and the *asymmetric ceremony* (trailers/links optional) from Design B (common-case). See `## Rejected Designs` for what each contributed and what was dropped.

### Interface

A shared convention plus four consuming command specs. The convention owns exactly two things; everything else is *derived*.

**1. U-ID anchor (the only thing minted, by `/ba:plan`):**
- Form: `### U<n> — <title>` heading on each implementation unit. `<n>` is a positive integer, monotonic, strike-don't-renumber.
- Each unit carries `Test scenarios:` (plain bullets, agent-consumable QA, optional `(Covers AC<N>)`) and one `Verify:` line (code-matchable: a runnable command, grep-able symbol/path, or file-existence claim).

**2. Commit-subject anchor (the only durable write during execution):**
- Form: `<type>(<scope>): U<n> <description>`, one U-ID per commit. Optional `Deviation (U<n>): …` trailer in the body (transient carrier).

**3. `derive-state(plan, git, worktree) → {done, pending}` (the only read):**
- Resolution order, total and pure: **done-via-subject** (a commit subject in `<base>..HEAD` carries the `U<n>` token) → else **done-via-verify** (the unit's `Verify:` passes against the working tree) → else **pending**. Mutates nothing; same inputs → same answer. There is no `mark_done` / `set_status` / `append_deviation` — the only "write" is committing code, which the consumer already does.
- Refuses a plan lacking the `plan_schema: 2` discriminator (hard cutover).

### Usage example

`/ba:execute` resuming a STANDARD plan:

```
# Resume detection (replaces the old "scan for [x] marks")
state = derive-state(plan, git, worktree)
#   U1,U2 subjects found in git log        -> done
#   U3 absent; Verify "npm test -- reset-routes.spec" green -> done-via-verify
#   U4 absent; Verify fails                 -> pending
announce "Resuming at U4 (3/4 done)."

# Doing U4 — the only durable write is the commit itself:
git commit -m "feat(reset): U4 single-use token guard

Deviation (U4): used a nonce table, plan assumed TTL-only"
# plan file is never touched
```

`/ba:propose` later rolls the `Deviation (U4):` trailer into the MR body (+ Linear ticket); the MR title stays a clean human summary. `/ba:handoff` narrates progress by calling the same `derive-state`.

### What's hidden behind the seam

- **Where state lives.** Callers ask `derive-state`; they never learn the answer came from a git-subject grep vs. a working-tree `Verify:` match. The hybrid resolution is internal — swapping the fallback (e.g. to `git notes` later) touches no consumer.
- **That the plan is uncommitted.** The seam refuses to read plan mtime/dirty-state as a progress signal, so "plan not committed" is structurally impossible to depend on — the motivating bug class is designed out.
- **Subject-string internals.** Conventional-commit prefix rules, trailers, the `U<n>` token position live behind the one grammar; consumers pass fields, not pre-rendered strings.
- **Squash.** Because the durable record is the MR/ticket (not trailers) and done-detection has the `Verify:` backstop (not git history), merge strategy is invisible to every consumer.

### Dependency strategy

The one hard dependency is **git + working tree**, concentrated in the single `derive-state` definition rather than scattered across `execute`/`handoff` (they invoke the named operation). The **plan is a one-way input**: `/ba:plan` mints U-IDs into it; downstream commands depend on the *U-ID namespace and `Verify:` contract*, never on re-reading the plan for state. The commit-subject grammar — today co-owned ad hoc by `execute.md` Step 2f and `propose.md` — collapses into the single convention section both cite, so the `U<n>`-first shape can never drift between them.

### Trade-offs

- **Pays off:** one anchor powers three reads (resume, deviation rollup, handoff narration) with no per-consumer interface; eliminating the plan-mutation API removes the entire "plan and git disagree" bug class.
- **Pays off:** dropping the phase-boundary human pause removes a rubber-stamp (always-approved → zero signal + alarm fatigue) and unblocks unattended runs (autonomy chain #10/#19), while the content-triggered deviation pause keeps the high-signal stop.
- **Cost:** resume quality rides entirely on `Verify:` signal quality — an aspirational/unmatchable `Verify:` silently degrades resume. Mitigation: a plan-time convention-check that `Verify:` lines look code-matchable (#35 flagged the same).
- **Cost:** uncommitted-but-implemented work reads as `pending` on the subject scan until the `Verify:` fallback catches it; the fallback is the safety net, at some evaluation cost.
- **Cost:** the optional trailer carrier is a convenience the seam can't enforce — `propose` must cooperate (roll up, don't strip). Documented, not mechanically guaranteed.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`). Plan and execute may refine it within the bounds of the lock; they may not re-add elements from the rejected designs below.

## Rejected Designs

### Design A — Deepest module (partially incorporated)
- **Interface summary:** one named convention owning the U-ID anchor + a single `state_of(U)` operation; resume/deviation/handoff all derive from the one anchor.
- **Incorporated:** the single derive-state operation and the one-anchor-many-consumers shape. **Rejected:** A's instinct to *derive* test scenarios from the `Verify:` signal instead of authoring them — that discards the agent-consumable QA list #35 deliberately keeps. Test scenarios are authored per unit.

### Design B — Common case (base for ceremony)
- **Interface summary:** asymmetric ceremony — plain anchors, with trailers and `Covers` links opt-in only when they earn their keep.
- **Incorporated:** optional `Deviation (U<n>):` trailers and optional `(Covers AC<N>)` links; the common linear-plan path costs almost nothing. **Rejected:** B's fuzziness on what is authoritative for done-ness — sharpened by C's invariant that `Verify:` is the sole authority.

### Design C — Info hiding (invariants)
- **Interface summary:** consumer-scoped seams with the resume strategy hidden behind one verdict; `Verify:` as done-authority.
- **Incorporated:** the load-bearing invariants — `Verify:` is the sole done-authority; the two-tier resume strategy is hidden behind one `{done, pending}` verdict; one-way links. **Rejected:** C's hidden-comment U-ID representation (`<!-- uid:U3 -->`) — incompatible with #33's visible-text requirement, so U-IDs are visible headings instead.

### Rejected fork alternatives (this session)
- **Q1 — drop manual verification *and* phase gates entirely:** rejected; loses the structured home for non-code QA. **Keep Success Criteria alongside `Verify:`:** rejected; reintroduces the overlap #35 killed. Chosen: `Verify:` subsumes Automated; non-code QA → `Test scenarios:`; phase gate becomes an automated checkpoint.
- **Q2 — in-session-only deviations:** rejected; lost if the session ends before `propose`. **Direct-to-Linear at deviation time:** rejected; needs a ticket + MCP write mid-run, and is noisy. Chosen: transient trailer → `propose` rolls up.
- **Q3 — keep-and-rewire the LoC tripwire:** rejected; ports machinery coupled to the very `[x]`/`## Deviations` model being removed, for a guard that always no-ops. Chosen: retire it.
- **Phase boundary — keep a human pause:** rejected on CE's evidence (`ce-work/SKILL.md` bans re-scoping into human-time phases; its human-in-loop is upfront + content-triggered, never boundary-triggered) and on the user's own experience (the pause is always rubber-stamped). Chosen: automated checkpoint, content-triggered deviation pause retained, manual interrupt always available.

## Scope Boundaries

**In scope (end-to-end):**
- `plan.md`: U-ID unit headings, checkbox-free rendering, per-unit `Test scenarios:`/`Verify:`, `Covers AC<N>`, retire `## Behaviors to Test` + `### Success Criteria`, add the `plan_schema: 2` discriminator.
- `execute.md`: read-only plan, git-derived hybrid resume, optional deviation trailers, retire Step 1.5, automated phase checkpoints, hard-cutover refusal, drop `status:`/`[x]`/`## Deviations` writes.
- `propose.md`: preserve U-ID commit subjects, roll deviation trailers into the MR body (+ Linear ticket), clean U-ID-free title.
- `handoff.md`: narrate progress via `derive-state`, not plan checkboxes.
- The shared U-ID/git-state convention section + the `CLAUDE.md` sync entry.

**Out of scope:**
- Driving `Test scenarios:` via agent-browser (the `/ba:prove` #20 / `/ba:polish` #24 lane).
- HTML output mode (#33 — this unblocks it, doesn't build it).
- Whether to commit dev-workflow artifacts in work repos (considered and set aside — immutability is the chosen answer to durability).
- No code is written by this brainstorm.

## Acceptance Criteria

- AC1: `/ba:execute` performs zero writes to the plan file (no `status:`, no checkbox, no `## Deviations`) across a full run and a resume.
- AC2: Resume is derived from git: a unit whose `U<n>` appears in a `<base>..HEAD` commit subject is `done`; a unit whose `U<n>` is absent but whose `Verify:` passes against the working tree is `done`; otherwise `pending`.
- AC3: Plan templates render checkbox-free; implementation units carry `### U<n> — <title>`, `Test scenarios:`, and one code-matchable `Verify:`; `## Behaviors to Test` and `### Success Criteria` are gone.
- AC4: `/ba:execute` refuses a plan without the `plan_schema: 2` discriminator with re-plan guidance (hard cutover).
- AC5: Deviations land in the MR/PR body (rolled up from optional trailers by `/ba:propose`) and the Linear ticket when linked; never in the plan; the MR title carries no U-ID; `propose` preserves U-IDs in commit subjects.
- AC6: COMPREHENSIVE execution runs phase→phase on automated `Verify:` checkpoints with no human manual-verification prompt; the deviation pause still fires on real divergence.
- AC7: The U-ID grammar has a single owner cited by `execute`/`propose` and read by `handoff`; a `CLAUDE.md` sync convention names the owner and citation sites.

## Open Questions

None. (Resolved this session: phase-gate pause → automated checkpoint, no human pause, on CE evidence + user experience; deviation jot → transient trailer rolled up by propose; LoC tripwire → retired; MR title → U-ID-free. Resolved upstream: deviation system-of-record → MR/ticket; done-authority → per-unit `Verify:`.)

## Convention Compliance

Checked by `convention-checker` — **0 violations** in the brainstorm. Compliant as a planning artifact: documents decisions only (writes no code), uses `## Locked Design`/`## Rejected Designs` per the synthesis-lock rule, references issue #31 (and #32/#33/#35) rather than spinning a competing roadmap doc, full frontmatter, repo-relative paths only. The `## Locked Design` anchor (owned by `brainstorm.md`) is reused, not redefined. The `**Code-shape decision:**` label survives (only checkboxes are removed) and its wording stays byte-identical across its mirror sites.

**Seven sync obligations recorded for the downstream plan** (consequences of the locked decisions, not defects):

- **SYNC-1 — `## Deviations` removal:** three owners change together — `execute.md` Step 4 (deviation handling), `execute.md` Step 1.5e/1.5f (retired with the tripwire), and `README.md` (deviation-persistence line). Deviations move to MR/PR + Linear ticket.
- **SYNC-2 — `**Code-shape decision:**` five-site rule + LoC-owner self-edit:** retiring Step 1.5 deletes the documented *sole owner of the LoC-counting rule*, so `CLAUDE.md` itself must drop that clause. The label wording survives and must stay byte-identical across `plan.md` (trigger block + three template placeholders), `execute.md` Step 2b, and `README.md`.
- **SYNC-3 — checkbox-free `[ ]`/`[x]` contract:** every `- [ ]` in `plan.md` templates and every `[x]`-scan in `execute.md` (resume, "already complete", Step 1.5 fire, Step 2e, Step 5) plus `README.md`'s checkbox-resume line are replaced by the git-derived model.
- **SYNC-4 — `### Success Criteria` + `## Behaviors to Test` retirement:** remove from `plan.md` templates; rewrite `execute.md` Step 3 phase gates that read Success Criteria; update `README.md` references → per-unit `Test scenarios:`/`Verify:`.
- **SYNC-5 — `status:` frontmatter removal from execute:** `execute.md` (`in-progress`/`completed` writes + `completed`-skip), `plan.md` frontmatter (define `plan_schema: 2`; decide whether `status:` stays an authoring field), `README.md` spec-first framing.
- **SYNC-6 — phase-gate redefinition:** `execute.md` Step 3 (interactive pause → automated `Verify:` checkpoint), `plan.md` phase-gate placeholders/notes, `README.md` phase-gate description.
- **SYNC-7 — new U-ID/git-state convention:** add a `CLAUDE.md` "Conventions" bullet naming the single owner of the U-ID grammar and its citation sites (`execute.md` Step 2f, `propose.md`, `handoff.md`), mirroring the never-hide-ledger and Code-shape-label convention pattern; update `README.md` `/ba:propose` (U-ID preservation + deviation rollup) and `/ba:handoff` (git-derived progress) descriptions.

Ship-time obligation (not a brainstorm/plan defect): bump `.claude-plugin/plugin.json` version.

## Next Steps

→ `/ba:plan` to turn this locked design into the coordinated `plan.md` / `execute.md` / `propose.md` / `handoff.md` + `CLAUDE.md` + `README.md` changes, honoring SYNC-1..7. Then update #31 (unblocked, design locked) and close the #35-gated dependency.
