---
date: 2026-06-21
topic: reconcile-acceptance-verification-schema
status: approved
triage_level: full
tags: [plan-template, acceptance-criteria, behaviors-to-test, verification, immutable-plans, issue-35, issue-31]
---

# Reconcile Acceptance Criteria vs Behaviors-to-Test — a 3-role verification schema for plans

## What We're Building

A single, coherent **verification schema** for the `/ba:plan` template that resolves the long-standing overlap between "Acceptance Criteria" and "Behaviors to Test", fixes the inconsistency where those sections differ across the three plan tiers, and composes cleanly with #31's immutable-plan + stable-U-ID direction. The schema is the contract that `/ba:plan` authors and that `/ba:execute` and `/ba:review` consume.

The insight that reframed the issue: this is not a two-section problem (AC *vs* Behaviors). It is a **three-role** problem, and the current template conflates or misplaces all three roles. The fix names the three roles, gives each a home, and renders the whole thing **checkbox-free** so the plan stays a read-only decision artifact.

This brainstorm **locks the model** and unblocks #31 (which was paused pending this decision). It is scoped to *what* the schema is; the per-unit wiring lands with #31's U-IDs (see Scope Boundaries).

## Why This Approach

The current template is genuinely broken, not just redundant:

- `## Acceptance Criteria` exists **only** in the MINIMAL tier (unkeyed). STANDARD/COMPREHENSIVE have no acceptance section — they use `### Success Criteria` (Automated/Manual). Yet `/ba:execute`, `/ba:review`, and the brainstorm→plan handoff all assume an acceptance section exists. So on STANDARD/COMPREHENSIVE plans, `/ba:review` silently gets **no acceptance context** — a present-day defect.
- `## Behaviors to Test` is **write-only**: authored in all three tiers, consumed by nothing (execute doesn't task off it; review doesn't check the diff against it).

We grounded the design against a comparable working system (the compound-engineering plugin, referenced as evidence in #35/#31 and `docs/research/2026-06-17-plan-execute-vs-ce-comparison.html`). That system proves a flow where: acceptance is a plan-level keyed contract; per-unit test scenarios are the implementer's working checklist (expected incomplete, supplemented before writing tests); a per-unit verification field is the "done" signal; and the plan is **never mutated during execution** — progress lives in git (unit-ID commit subjects) and the harness task tracker. We adopt the *shape* of that model without copying it, tuned to our YAGNI culture and our hard constraint (artifacts are uncommitted in a large work repo, origins are usually Linear tickets with loose/absent AC).

Three candidate interface designs were generated under different constraints (deepest-module, common-case, info-hiding). The chosen design is a **Hybrid** — see `## Locked Design` and `## Rejected Designs`.

## Key Decisions

- **Three roles, named and homed.** (1) plan-level **Acceptance Criteria** = what "done" means; (2) per-unit **Test scenarios** = the implementer's testable-behavior checklist (this is where Behaviors-to-Test's QA-plan / agent-browser value goes); (3) per-unit **Verify** = the code-matchable "is this unit done" signal.
- **Acceptance Criteria become consistent across all three tiers** and keyed (`AC<N>`), plain-bullet, plan-owned (minted by `/ba:plan`, never inherited from the origin). Fixes the review-context defect. AC-IDs are **plan-internal** anchors (for `Covers` links + review context) — they carry **no** stability/strike discipline; a (re)planning pass may rewrite or renumber the list freely. Stability discipline (struck-never-renumbered) stays **only on U-IDs** (#31), which alone are stamped into durable external state (commit subjects).
- **Retire the floating `## Behaviors to Test`.** Its content descends to per-unit `Test scenarios:`, which finally gives it a consumer (execute tasks off it; the implementer writes tests from it).
- **Checkbox-free.** No `[ ]`/`[x]` anywhere in these sections — plain bullets only. The plan is a read-only decision artifact; it carries **zero** mutable progress affordance.
- **`Verify:` is the sole done-authority** — a per-unit, code-matchable predicate evaluated against the working tree, never a checkbox. This is #31's resume-fallback signal.
- **`### Success Criteria (Automated/Manual)` is retired** (resolves SYNC-3 at the model level, not just mechanically). The per-unit `Verify:` **subsumes the *Automated* criteria** — same thing at a finer altitude. **Phase gates become the conjunction of the phase's units' `Verify:`** — a COMPREHENSIVE phase completes when *every unit in it verifies* (so `/ba:execute`'s "Automated verification must pass" becomes "all units in this phase verify"). **Manual checks fold into per-unit `Test scenarios:`** — their natural home (the agent-browser / human-QA value); `/ba:execute` may surface a phase's manual-flavored scenarios interactively at the gate (as today), but nothing is persisted to the read-only plan. Net: no separate verification section survives, and the done-signal semantics are settled here, not passed to #31.
- **Immutability is locked on a durability rationale, not purity** (see below). Source: design-it-twice Hybrid (B+C); user direction *"Lock immutability, schema goes checkbox-free."*
- Design-it-twice mode fired (new interface surface); three designs generated and contrasted; user picked a Hybrid of Design B + Design C.

### Why immutability — the honest defense

The value of "don't mutate the plan" is **not** cleanliness. It is that **state in an uncommitted file is not durable** (lost across machines, worktrees, parallel sessions; invisible to teammates), whereas state in git commits *is*. Our plans are uncommitted in a large work repo, so a mutated plan is a fragile state store. This also rules out the tempting middle path of a separate `.dev-workflow/state.json` journal — it would be just as uncommitted and fragile. Given the constraint, the real choice is *mutable-uncommitted-file* (fragile) vs *git-derived* (durable); git-derived wins. Two costs accepted with open eyes: (1) the harness task tracker becomes mandatory/load-bearing for in-session progress; (2) resume quality rides **entirely** on the per-unit `Verify:` signal quality — which is exactly why #35 gates #31.

## Locked Design

**Source:** Hybrid — Design B (Common case) base + Design C (Info hiding) invariants. User direction, verbatim: *"Lock immutability, schema goes checkbox-free."* Design B supplies the asymmetric-ceremony model (plain criteria; conditional examples and `Covers` links opt-in); Design C supplies the load-bearing invariants (`Verify:` is the done-authority, not a checkbox; acceptance IDs stable/struck-never-renumbered; one-way links). Design A's one good idea (the verify signal must be code-matchable) is kept; A's core move (deriving test scenarios instead of authoring them) is rejected.

### Interface

Markdown schema in the `/ba:plan` template, consumed by the author, `/ba:execute`, and `/ba:review`. All three constructs are **read-only decisions** — none is a progress store.

**1. `## Acceptance Criteria` (plan-level, keyed, present at every tier):**

```markdown
## Acceptance Criteria

- AC1: <user-observable "done" statement>
- AC2: <…>
  - When <state-dependent condition>, <expected observable outcome>   ← conditional example, opt-in/rare
```

- ID scheme: `AC<N>`, plan-local, monotonic from 1, **minted by `/ba:plan`** (never sourced from the Linear/brainstorm/prompt origin; origin attribution lives in `## Sources`).
- Plan-internal: AC-IDs anchor the in-plan `Covers` links and review context only — they are not referenced from durable external state, so a re-plan may rewrite/renumber the list freely (renumbering the `Covers` links with it). **No** strike-never-renumbered rule (that discipline is U-ID-only — U-IDs alone live in commit subjects). Any AC change is a re-planning act; `/ba:execute` never edits the plan.
- Default form is the plain statement. A conditional "When X, Y" example is appended **indented under** its AC only when prose alone leaves edge-case ambiguity. The example shares its parent AC's identity — we deliberately do **not** adopt CE's separately-keyed *Acceptance Example* (`AE<N>`) namespace that issue #35 references, since a second ID space to mint and cross-reference earns nothing here.
- Invariant: ≥1 AC required (forces the planner to author acceptance even from a loose Linear ticket).

**2. Per-unit `Test scenarios:` (the implementer's checklist, plain bullets):**

```markdown
Test scenarios:
- <scenario — what to test for this unit, user-observable>
- <scenario>   (Covers AC2)
```

- Hung off each implementation unit. Plain bullets, no checkbox.
- `(Covers AC<N>)` is **opt-in** — appended only when a scenario is the thing that proves an AC; multiple allowed (`(Covers AC1, AC3)`). Links point *up* (scenario → AC); ACs never enumerate their covering scenarios (coverage is derived by consumers).
- Expected **incomplete**: the implementer supplements from the unit's context (happy / edge / error / integration categories) before writing tests.

**3. Per-unit `Verify:` (the sole done-authority, code-matchable):**

```markdown
Verify: <code-matchable signal>   → covers AC1, AC2
```

- One line per unit. Signal is a runnable command (backtick-wrapped), a grep-able symbol/path assertion, or a file-existence claim — **evaluable against the current working tree with no plan mutation**.
- This — not any checkbox — answers "is this unit done?". It is #31's resume-fallback predicate.
- Optional `→ covers AC<N>` ties the unit's done-signal to acceptance. A dangling `covers` (no such AC) is a convention-check error.

**Tier scaling:** identical schema across MINIMAL/STANDARD/COMPREHENSIVE; only *ceremony* scales (count of ACs/units; likelihood of conditional examples and `Covers` links), not structure.

### Usage example

STANDARD-tier plan from a loose Linear ticket — "let users reset their password by email", three units, no conditional edge cases:

```markdown
## Acceptance Criteria

- AC1: A user can request a reset link from the login page
- AC2: The reset link sets a new password and invalidates the old one
- AC3: A reset link is single-use

## Implementation Approach

### U1 — Reset-token creation
**File**: `src/auth/reset.ts`
Test scenarios:
- Generates a token bound to the user id
- Token carries a TTL   (Covers AC3)
Verify: `npm test -- reset.spec` green   → covers AC3

### U2 — Reset API routes
**File**: `src/api/reset-routes.ts`
Test scenarios:
- POST /reset/request issues a link   (Covers AC1)
- POST /reset/confirm updates the password   (Covers AC2)
- Rejects an already-consumed token   (Covers AC3)
Verify: `npm test -- reset-routes.spec` green   → covers AC1, AC2

### U3 — Password update
**File**: `src/auth/password.ts`
Test scenarios:
- Old password no longer authenticates after reset   (Covers AC2)
Verify: `grep -q "invalidateOldPassword" src/auth/password.ts`   → covers AC2
```

What the common case did *not* require: no `AE` IDs, no Given/When/Then tables, no Automated/Manual split, no floating behavior list, no checkboxes.

### What's hidden behind the seam

- The done-detection mechanism (run a command vs grep an assertion vs stat a file) is hidden behind the single `Verify:` field — `/ba:execute`'s resume strategy can change without touching the schema.
- Coverage topology (which scenarios cover which AC) is derived, not authored — renumbering or splitting units never edits the acceptance list.
- The upstream origin format (Linear vs brainstorm vs bare prompt) is invisible; the plan's minted `AC<N>` are the only acceptance identity any consumer sees.
- Whether an AC is plain or conditional is hidden — the ID is stable either way, so a plain AC can gain a conditional example later with zero link churn.

### Dependency strategy

The schema is **additive over #31's U-IDs and does not own them.** U-IDs identify units; the schema *reads* the U-ID as the anchor for `Test scenarios:` and `Verify:`, and introduces a disjoint `AC<N>` namespace (prefixes differ — `U*` vs `AC*` — so no collision). Linkage is one-way (`Covers AC<N>` / `→ covers AC<N>`), so the acceptance list and the units never perturb each other. What `/ba:execute` must know: read `## Acceptance Criteria` for the keyspace; per unit, evaluate `Verify:` against code as the done-authority (it does **not** read checkboxes as state); progress lives in git + the task tracker. What `/ba:review` must know: read `## Acceptance Criteria` as the diff-judgment context (now present at every tier) and resolve `Covers` links to report covered/uncovered ACs.

### Trade-offs

- **Pays off:** the dominant STANDARD-from-loose-ticket plan authors only plain ACs + two cheap per-unit fields; conditional examples and `Covers` links are reachable but never mandatory. Collapsing `AE` into a subordinate example removes an entire ID namespace from the common path.
- **Pays off:** `Verify:`-as-authority gives #31's code-derived resume a single, mutation-free done-signal, anchored on the stable **U-ID** keyspace (AC-IDs stay plan-internal and need no stability discipline of their own).
- **Cost:** the inverse "which scenarios cover AC2?" view is not authored — a coverage audit must scan units.
- **Cost:** an AC uncovered by any test scenario is *legal* (some acceptance is judged by `/ba:review` reading the diff, not by a unit test), so "fully test-covered acceptance" is not enforceable from the schema alone — it depends on `/ba:review` flagging it.
- **Cost:** the `Verify:` signal's matchability is author-discipline, not schema-enforced — an aspirational/unmatchable signal silently degrades resume. Mitigation deferred to plan time: a convention-check that `Verify:` lines look code-matchable.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`). Plan and execute may refine it within the bounds of the lock; they may not re-add elements from the rejected designs below.

## Rejected Designs

### Design A — Deepest module (rejected)
- **Interface summary:** two constructs only — a keyed `## Acceptance` block whose ACs carry a `· units:` rollup, and a single per-unit `Verify: <signal> · covers <AC-IDs>` line. **Test scenarios are not authored — `/ba:execute` derives the test checklist from the `Verify:` signal.**
- **Why rejected:** deriving rather than authoring test scenarios discards the testable-behaviors list the issue explicitly says to keep (its QA-plan / agent-browser value), and removes any place for the author to enumerate per-unit edge cases — directly contrary to the test-generation goal. The denormalized `· units:` rollup also invites drift. Its one good idea (the verify signal must be code-matchable) was incorporated into the Locked Design.

### Design B — Common case (incorporated as the Hybrid base)
- **Interface summary:** three roles with asymmetric ceremony — plain keyed ACs, conditional examples opt-in (indented under the AC, no `AE` namespace), per-unit `Verification:` + `Test scenarios:` with opt-in `(Covers AC<N>)`.
- **What was incorporated:** the entire ceremony model (plain default, rare-case opt-in) and the conditional-example-only-when-needed rule. **What was not:** B's fuzziness on what is authoritative for done-ness and on ID stability — sharpened by grafting Design C's invariants.

### Design C — Info hiding (invariants incorporated into the Hybrid)
- **Interface summary:** three consumer-scoped seams — acceptance list for review, per-unit `Verify:` for execute, per-unit `Test scenarios:` for the implementer — with stable struck-never-renumbered ACs and `Verify:` as the done-authority while checkboxes are at most cosmetic.
- **What was incorporated:** the load-bearing invariants — `Verify:` is the sole done-authority; links are one-way. **What was not:** C's struck-never-renumbered AC stability (dropped — AC-IDs are plan-internal, see Key Decisions; that discipline applies only to #31's U-IDs), and C's mandatory verbosity (every unit pays `Verify:` + `Test scenarios:` even at MINIMAL) — softened by B's asymmetric ceremony. The checkbox-free rendering (locked separately) makes C's "checkboxes cosmetic" stance moot by removing them entirely.

## Scope Boundaries

- **#35 (this work) locks the full model and ships the genuinely standalone part:** making `## Acceptance Criteria` consistent and keyed (`AC<N>`) across all three tiers (fixes the review-context defect), with the existing `[ ]` checkbox style **retained**.
  - **Scope correction (plan-time, 2026-06-21 — justified override of this lock, confirmed with the user):** checkbox-free rendering and the `Covers AC<N>` link syntax were *originally* slotted into #35 here, but planning showed both are **gated on #31**: going checkbox-free breaks `/ba:execute`'s checkbox-based MINIMAL task-derivation + `[x]` resume scan (the SYNC-4 precondition — "execute no longer reads checkboxes as state" — is unmet pre-#31), and `Covers AC<N>` is dangling until per-unit `Test scenarios:` exist. Both moved to #31. The schema's **end state** (checkbox-free; see this section's Acceptance Criteria below) is unchanged — only *which issue ships it* moved.
- **#31 lands the per-unit wiring:** stable U-IDs on units, the per-unit `Test scenarios:` + `Verify:` fields (they ride on U-IDs), read-only-plan enforcement in `/ba:execute`, git-derived + Verify-fallback resume, and deviation routing. **The floating `## Behaviors to Test` is not physically deleted until per-unit `Test scenarios:` exist** (#31) — do not retire one before the other lands, or its content has nowhere to live. Per the plan-time scope correction above, #31 **also** owns: checkbox-free rendering across the schema, the `Covers AC<N>` link syntax, and the `### Success Criteria` retirement + phase-gate rewrite (SYNC-3) — all gated on execute's git-derived rework / per-unit `Verify:`.
- **Not deciding here:** deviation-storage mechanics (#31 + #34), and whether to commit dev-workflow artifacts (considered and set aside — immutability is the chosen answer to durability). (The `### Success Criteria` / phase-gate reconciliation was previously deferred here; it is now **resolved at the model level** — see Key Decisions and SYNC-3 — leaving only mechanical edits.)
- **No code is written by this brainstorm.**

## Acceptance Criteria

- The plan template defines exactly three verification roles (acceptance / per-unit test scenarios / per-unit verify) with no remaining overlap between "Acceptance Criteria" and "Behaviors to Test".
- `## Acceptance Criteria` is present, keyed (`AC<N>`), and plain-bullet in all three tiers; `/ba:review` receives acceptance context on STANDARD/COMPREHENSIVE plans, not just MINIMAL.
- No `[ ]`/`[x]` checkbox appears in the acceptance, test-scenario, or verify constructs.
- The per-unit `Verify:` signal is documented as the sole done-authority and is code-matchable.
- #31 can build its resume-fallback against the `Verify:` contract and its own stable U-ID keyspace without re-litigating this model.

## Open Questions

None. (Resolved during this session: the AC-vs-Behaviors relationship → 3-role model; the per-unit-vs-plan-level verification altitude → per-unit; the immutability stance → locked on durability grounds, schema checkbox-free; the `## Acceptance Criteria` heading → kept, not renamed; AC-ID stability → dropped (plan-internal, no strike rule — stability is U-ID-only), which also removed the only post-approval-write smell in the schema.)

## Convention Compliance

Checked by `convention-checker` — **0 violations**; compliant as a planning artifact (captures a schema, writes no code; uses `## Locked Design`/`## Rejected Designs` correctly per the synthesis-lock rule; brainstorm artifact referenced from #35, not a competing roadmap doc; frontmatter present). README needs **no** update — this changes plan *template internals*, not a command/agent/artifact-path; README's `/ba:plan` description (the `**Code-shape decision:**` label) is untouched.

Four **sync obligations** recorded for the downstream plan (these are mirror maps, not defects):

- **SYNC-1 — Behaviors-to-Test triplication.** `## Behaviors to Test` appears in all three templates (plan.md MINIMAL/STANDARD/COMPREHENSIVE). Retire all three together, not one.
- **SYNC-2 — Acceptance section across tiers.** Today only MINIMAL has `## Acceptance Criteria`; STANDARD/COMPREHENSIVE have none. The plan must add it to both and keep the heading name `## Acceptance Criteria` (decision: keep, do not rename to `## Acceptance`).
- **SYNC-3 — Success Criteria / phase-gate (model RESOLVED; mechanical edits remain).** The design question — does `Verify:` subsume Automated? do phase gates aggregate per-unit `Verify:`? — is decided in Key Decisions, *not* passed to #31. The plan **implements** that resolution: (a) remove `### Success Criteria (Automated/Manual)` from the STANDARD + COMPREHENSIVE templates; (b) rewrite `/ba:execute`'s COMPREHENSIVE phase gate from "Automated verification must pass" to "every unit in the phase has a passing `Verify:`"; (c) route Manual checks into per-unit `Test scenarios:`, with execute surfacing a phase's manual-flavored scenarios interactively at the gate. The plan implements; it does not re-decide.
- **SYNC-4 — Checkbox-free vs execute progress model.** Current templates use `- [ ]` pervasively, and `/ba:execute` resume scans `[x]` marks as state. The plan must confirm execute no longer reads plan checkboxes as state (intersects #31's U-ID/git-derived model) before removing them.

The `**Code-shape decision:**` mirror surface is confirmed **untouched** by this schema.

## Notes for #31 (downstream — surfaced here, not decided here)

Recorded so #31's brainstorm starts with these in hand (deviation-storage is #31's call — scoped out under `## Scope Boundaries` — but the team's **squash-merge** reality already constrains it):

- **Deviations → the Linear ticket / PR-MR description, not commit trailers.** Squash-merge flattens per-unit commits, so trailers (`Deviation:`, `Covers: AC<N>`) don't survive into mainline; the Linear ticket is durable across squash. This settles the open either/or in #31's body toward the ticket.
- **Commit U-ID subjects = a pre-merge resume fast-path only**, not a permanent record — the per-unit commits exist on the feature branch during work and collapse at merge (after the work is done, so resume is unaffected by squash).
- **`Verify:`-against-code is the squash-proof done-detection backstop** — it reads code state, not git history, so done-detection survives any rebase/squash.

Full reasoning is on the #31 issue (comment dated 2026-06-21).

## Next Steps

→ `/ba:plan` to turn this locked schema into the `/ba:plan` template + `/ba:review` plan-context changes that #35 ships standalone, honoring SYNC-1..4. The per-unit `Test scenarios:`/`Verify:` wiring and `## Behaviors to Test` retirement sequence with #31. Then return to #31's brainstorm with this contract in hand.
