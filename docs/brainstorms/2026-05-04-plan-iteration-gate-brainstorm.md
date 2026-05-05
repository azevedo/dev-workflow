---
date: 2026-05-04
topic: plan-iteration-gate
status: approved
triage_level: full
tags: [ousterhout, plan-iteration, ba-review-plan, planning-discipline, phase-3]
---

# Phase 3: Plan-Iteration Discipline Gate

> **Roadmap parent:** [`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md`](2026-05-02-ousterhout-principles-roadmap-brainstorm.md)
>
> **Standing discipline rules:** This brainstorm is governed by the **Discipline Rules** section of the parent roadmap (lines 130–160). Red flags, stop points, and concrete rules apply to any iteration of this brainstorm or its downstream plan.

## What We're Building

A new workflow gate agent — `plan-iteration-gate` — modeled on the existing `tdd-cycle-gate`, dispatched by `/ba:review-plan` after the Apply Fixes step. The gate watches for the confidence-chasing ratchet documented in the 2026-04-23 planning-YAGNI retro: monotonic LoC growth across rounds, abstract vocabulary creeping into a previously concrete plan, threading depth, soft line cap, repeated mentions of the same concern, and verifier-finding-triggers-machinery.

The gate is **silent when iteration is clean and vocal when red flags fire**. It does **not block** `/ba:review-plan` and never refuses to apply fixes. At iteration count 3+ it emits a salient warning quoting the standing discipline rule "default to ship or delete after round 4" — but the user keeps full agency.

The motivation in one line: the deepest pain in the parent roadmap (the planning-YAGNI ratchet) is currently enforced only at Level-2 (the standing Discipline Rules section, manually re-read by future-Bruno). Phase 3 promotes it to Level-3 — automated, runs every iteration, surfaces evidence the user can act on without re-reading the retro.

## Why This Approach

### Approaches Considered

1. **`tdd-cycle-gate`-modeled, dispatched from `/ba:review-plan` only (chosen)** — silent-vocal report-only agent at `agents/workflow/plan-iteration-gate.md`. Single dispatch site. Mechanical signals (LoC, threading, line cap, iteration count) plus three LLM-judged signals (vocabulary, repeat-concern, verifier-feeds-machinery). Inputs: snapshot from start of session, current plan content, iteration count, prior review findings.
2. **Multi-dispatch (review-plan + ba:plan refine loop + standalone command)** — Rejected: the retro pain centered on the verifier-find→add→re-verify loop owned by `/ba:review-plan`. `ba:plan`'s "Review and refine" option and free-form dialogue refinement remain governed at Level-2 by the standing Discipline Rules; promoting them to Level-3 multiplies surface area before evidence justifies it. Re-addable later if the same ratchet recurs outside review-plan.
3. **Hard-stop / refusal mode at iteration 4** — Rejected: breaks the report-only contract that `tdd-cycle-gate` established and that's worked cleanly across many cycles. Risks frustrating genuine architectural rethinks. The report-only contract scales; refusal doesn't.
4. **Confidence as a first-class plan field (`confidence: <N>` in frontmatter)** — Rejected: heavyweight. The retro's "confidence climbing while LoC climbs" red flag is a *correlation* — the LoC half is the durable mechanical signal; confidence was always a conversational construct surfaced ad-hoc. Tracking it in the plan doc forces every plan to carry a number that's only meaningful in dialogue.

### Why the Chosen Approach Wins

- **Reuses an established pattern.** `tdd-cycle-gate` is the only existing dev-workflow gate; copying its shape (silent-on-clean, vocal-with-evidence, report-only) keeps the gate vocabulary consistent across the plugin and skips a class of UX-design questions.
- **Matches the actual retro pattern.** The 2026-04-23 retro's painful loop was specifically `/ba:review-plan` → "apply fixes" → verifier finds something → "build around it" → re-review. That loop is exactly where the gate fires. Other iteration paths (standalone refinement, brainstorm-stage tweaks) had no documented ratchet.
- **Mechanical signals first.** Five of the six triggers (LoC growth, threading depth, line cap, iteration count, the existence of the most-recent review findings to compare against) are observable without LLM judgment. The three semantic triggers (vocabulary, repeat-concern, verifier-feeds-machinery) are LLM-judged but bounded — they ride on prior-round findings the dispatcher already has.
- **Small blast radius.** One new agent file; one section edited in `commands/ba/review-plan.md`; metadata updates. No new commands, no new skills, no plan-template changes.

## Key Decisions

- **Agent path: `agents/workflow/plan-iteration-gate.md`.** Lowercase-with-hyphens; `-gate` suffix matches `tdd-cycle-gate`. Workflow-bucket placement (not review-bucket) because gates emit silent-when-clean diagnostic output, distinct from the `Must Address / Consider / Looks Good` review-agent canon.
- **Frontmatter mirrors `tdd-cycle-gate`.** `tools: Read, Grep, Glob, LS` (no Edit/Write — gates don't mutate). `model: inherit`. Description states it validates plan-iteration discipline and is dispatched by `/ba:review-plan`, surfacing only violations.
- **Single dispatch site: `commands/ba/review-plan.md` Step 5, after Apply Fixes.** Fires once per `/ba:review-plan` invocation, after fixes have been written to the plan. The post-fix vantage point is correct — the gate evaluates the *outcome* of this iteration, not the input.
- **Four inputs from the dispatching command.** (a) plan content snapshot from the start of the current `/ba:review-plan` session; (b) current plan content after fixes; (c) iteration count integer; (d) prior round's review findings classified as Must Address / Consider / Looks Good. The MECHANISM for persisting iteration count and the original snapshot across multiple `/ba:review-plan` invocations is deliberately deferred to the Phase 3 plan — candidates include in-memory only, `.dev-workflow/state/<plan-hash>.json`, or a `iteration_count:` field in plan frontmatter, each with trade-offs.
- **Six trigger categories.** Three mechanical: monotonic LoC growth (current > snapshot); threading >2 component layers (LLM judgment over the diff); plan exceeds ~600-line soft cap (matches Discipline Rules concrete rule). Three semantic (LLM-judged over current plan + prior findings): abstract vocabulary creeping in (named examples: "orchestrator", "coordinator", "lifecycle boundary"); third mention of the same concern; verifier-finding-triggers-machinery (a finding that should have *contracted* the plan but instead expanded it).
- **Vocal warning at iteration count ≥ 3, no hard stop.** Independent of whether any other trigger fires, the gate emits a `Discipline rule reminder: round N — default to ship or delete after round 4` warning when iteration ≥ 3. Always advisory; `/ba:review-plan` continues.
- **"Confidence" is not gate input.** The gate observes LoC growth alone. The "confidence >80 ceiling" rule remains conversational discipline in the standing Discipline Rules; no plan-frontmatter change.
- **Output contract matches `tdd-cycle-gate`.** Silent → `No discipline violations detected.` Vocal → markdown report listing each violation with `**Trigger**`, `**Evidence**` (file/line/diff excerpt), `**Why this matters**`, `**Suggestion**` fields, then a final `Discipline rule reminder` line if iteration ≥ 3.
- **No CRUD on the plan.** Gate is read-only: it reports patterns and exits. The user (or `/ba:review-plan`) decides what to do with the report. This is an explicit anti-feature — the gate must never propose specific edits, only flag patterns.
- **Brainstorm-iteration sibling explicitly NOT built.** Standing Discipline Rules at Level-2 remain sufficient for brainstorm-stage iteration until evidence justifies promotion. Re-evaluate post-Phase-3 ship.
- **`.claude-plugin/plugin.json` version bumps when Phase 3 ships.** README.md and root CLAUDE.md updated to list the new agent.

## Scope Boundaries

### In Scope

- Create `agents/workflow/plan-iteration-gate.md` with `<examples>` block, validation checklist (six trigger categories), output-format spec matching `tdd-cycle-gate`'s contract, and `tools: Read, Grep, Glob, LS` restriction.
- Edit `commands/ba/review-plan.md` Step 5 to dispatch `plan-iteration-gate` after the Apply Fixes flow, passing the four inputs (snapshot, current, iteration count, prior findings).
- Decide and document the iteration-count + snapshot persistence mechanism in the Phase 3 *plan* (this brainstorm leaves it open as an implementation detail).
- Update `README.md` and root `CLAUDE.md` agent lists to include `plan-iteration-gate`.
- Bump `.claude-plugin/plugin.json` version (concrete number set in plan).
- All Phase 3 changes ship as one atomic MR.

### Out of Scope

- Phases 1, 2, 4, and 5 of the parent roadmap.
- Dispatching `plan-iteration-gate` from `/ba:plan`'s "Review and refine" loop, `/ba:brainstorm`'s refine path, or any other command.
- A standalone `/ba:plan-iteration-gate` command for ad-hoc invocation.
- Hard-stop or refusal-to-continue mode at any iteration count.
- Adding `confidence:` (or any new field) to the plan frontmatter template.
- A brainstorm-iteration sibling gate (deferred per parent roadmap).
- Importing or invoking anything from `~/Programming/playground/agent_workflow_repos/skills/` at runtime.
- Mutation of the plan file by the gate (read-only by design).
- Calibrating the soft line cap to a value other than ~600 (matches Discipline Rules baseline; tunable later if false-positive rate warrants it).

## Acceptance Criteria

- `agents/workflow/plan-iteration-gate.md` exists with `name: plan-iteration-gate`, `model: inherit`, `tools: Read, Grep, Glob, LS`, an `<examples>` block referencing `/ba:review-plan` dispatch, a validation checklist enumerating the six trigger categories, and an output-format section matching `tdd-cycle-gate`'s silent-vocal contract.
- `commands/ba/review-plan.md` Step 5 contains an explicit dispatch step that runs `plan-iteration-gate` after Apply Fixes, with the four inputs documented in the prose.
- The gate's silent-clean output is the exact string `No discipline violations detected.` (parallels `tdd-cycle-gate`'s "No violations detected.").
- The gate's vocal output, on at least one trigger, includes a markdown section per violation with `**Trigger**`, `**Evidence**`, `**Why this matters**`, `**Suggestion**` fields.
- When iteration count ≥ 3, the gate's vocal output ends with a `Discipline rule reminder: round N — default to ship or delete after round 4` line, regardless of whether other triggers fire.
- The gate never edits the plan file (verified by `tools:` restriction excluding Edit/Write).
- `README.md` lists `plan-iteration-gate` under workflow agents alongside `tdd-cycle-gate`.
- Root `CLAUDE.md` agent table includes `plan-iteration-gate` with a one-line description.
- `.claude-plugin/plugin.json` version is bumped (concrete number set in plan).
- Single atomic commit/MR.

## Open Questions

None. All scope decisions resolved during this brainstorm. Implementation-detail decisions (iteration-count persistence mechanism, exact prompt wording, version-bump number) are deferred to the Phase 3 plan, not parked as blocking questions.

### Resolved Questions

- **Dispatch site** — `/ba:review-plan` only. Multi-dispatch deferred until evidence justifies it.
- **Input contract** — snapshot + iteration count + prior review findings. Mechanism for cross-invocation persistence deferred to plan.
- **Hard cap mode** — vocal warning at iteration ≥ 3, no hard stop. Matches `tdd-cycle-gate` report-only contract.
- **Confidence handling** — LoC growth alone. No new plan-frontmatter field.

## Convention Compliance

**Checked against `CLAUDE.md`, the brainstorm template (`commands/ba/brainstorm.md`), and the parent roadmap's Discipline section on 2026-05-04 by `convention-checker`.**

- **Filename format** (`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`): ALIGNED.
- **Frontmatter required fields** (`date`, `topic`, `status`, `triage_level`, `tags`): ALIGNED.
- **Agent naming** (`plan-iteration-gate` — lowercase-with-hyphens, `-gate` suffix matches `tdd-cycle-gate`): ALIGNED.
- **Agent placement** (`agents/workflow/`): ALIGNED — gates live in `workflow/`, distinct from `review/`.
- **Tool restriction** (`Read, Grep, Glob, LS`): ALIGNED — exact match with `tdd-cycle-gate`'s frontmatter; no Edit/Write so the gate cannot mutate plans.
- **Report-only contract** (CLAUDE.md line 67 — planning commands never write code; `tdd-cycle-gate` line 87 — gates do not block): ALIGNED — `plan-iteration-gate` is read-only and reports without blocking.
- **No code in brainstorm**: ALIGNED.
- **README.md / root CLAUDE.md / plugin.json updates** (CLAUDE.md lines 64, 71; parent roadmap In Scope): ALIGNED — Phase 3 enumerates all three.
- **No-runtime-dependency on skills repo** (parent roadmap lines 39–44, 176): ALIGNED — no skill imported, no skill invoked.
- **Discipline-section reference** (parent roadmap line 132): ALIGNED — `@`-referenced in the front-matter callout above.
- **Open Questions empty before handoff**: ALIGNED (none; resolved questions parked under sub-heading).
- **Acceptance Criteria measurability**: ALIGNED — file existence, frontmatter field assertions, exact-string output checks, dispatch-line presence in `commands/ba/review-plan.md` are all testable.
- **All built-in reviewers always appear as options in `/ba:review`** (CLAUDE.md line 73): NOT APPLICABLE — `plan-iteration-gate` is a workflow gate, not a reviewer; lives in `agents/workflow/`, not `agents/review/`.
- **Triage level `full`**: ALIGNED — medium-risk per parent roadmap (gate UX is delicate); multiple design decisions resolved (dispatch site, input contract, hard-cap mode, confidence handling); justifies full exploration over standard.
- **Discipline-section red-flag self-check**: ALIGNED on every check — the brainstorm itself avoids the very ratchet the gate watches for. Single dispatch site (no scope creep to multi-dispatch), mechanical signals first (no abstract-vocabulary creep), no new state directory or plan-frontmatter field threaded through layers, no verifier-finding-triggers-machinery (the rejected approaches list explicitly *contracts* scope rather than expanding it). Brainstorm length is well under the 600-line soft cap. One round of design dialogue (four AskUserQuestions); no re-iteration ratchet.

## Next Steps

→ Run `/ba:plan` to translate this brainstorm into an implementation plan. The plan should resolve the deferred implementation-detail decisions: (1) how iteration count + initial snapshot persist across multiple `/ba:review-plan` invocations on the same plan; (2) the exact agent prompt body, including how the six triggers are framed for the LLM; (3) the version-bump number for `plugin.json`; (4) the precise edit shape in `commands/ba/review-plan.md` Step 5 — whether the gate dispatch lives at the end of Step 5 or as a new Step 5.5.
