---
date: 2026-07-05
topic: propose-reviewer-friction
status: approved
triage_level: full
tags: [propose, reviewer-signals, proof, risk-tier, review-focus, apply-by-default, deviations, osmani]
---

# `/ba:propose` — Reviewer Signals & Interaction Friction

## What We're Building

A batch of changes to `/ba:propose` that (a) reduce interaction friction so the
command runs closer to fire-and-forget, and (b) add the two reviewer-facing signals
from Addy Osmani's *Code Review in the Age of AI* PR-description checklist that
`propose` doesn't yet carry — **proof-of-work** and **risk + review-focus** — without
bloating the body.

The audience is the `propose` author (the human running `execute` → `propose`) and,
downstream, the reviewer who reads the MR/PR. The unifying frame from Osmani: AI made
the *burden of proof* explicit — the author ships evidence and points the reviewer at
what matters; the body explains only what the platform can't already show.

Six coupled changes, all confined to `commands/ba/propose.md` (plus doc-sync):

1. **Proof section** — default-on, non-blocking, one-line-pending scaffold.
2. **"For reviewers" block** — a single block combining an always-on risk line + the
   1–2 review-focus areas.
3. **Risk signal** — always one line (low/med/high), derived from touched paths + size + breaking signals.
4. **Apply-by-default** — kill the Step 4 "Apply?" gate by default; opt-*in* escape hatch.
5. **Deviations reviewer-neutral fold** — drop the standalone `## Deviations` header; fold any reviewer-relevant substance into an existing section in plain change terms.
6. **Anti-bloat integration** — already-built (2026-06-11) discipline is the constraint the new always-on sections must fit inside, not a new workstream.

## Why This Approach

`propose` already ports Lynch's full section menu and — since the 2026-06-11 lean-body
brainstorm — a real editorial discipline (per-tier shape targets, a "leave out" list,
per-tier overshoot warnings). So the gap versus Osmani is *not* "add more sections"; it's
three specific things the menu never had: an affirmative **proof** element, a reviewer-facing
**risk** cue, and an explicit **where-to-look** pointer. Each is one compact line/block, and
each is governed by the existing selectivity invariant.

Rejected framings:
- **Dump tests/CI/logs into the body** (rejected, confirmed with Osmani's own text) — he
  wants proof *referenced*, not the raw artifact pasted. The platform already renders CI
  status and the test files; restating them violates `propose`'s standing invariant "the
  diff is visible on the platform; the body explains what the diff cannot show." Locked
  principle: **Proof references, never dumps; omit what the platform already surfaces.**
- **AI-role / authorship attribution** (cut by user) — most code here is AI-generated, so a
  "which parts are AI" line is noise, and it isn't reliably derivable from a diff.
- **Commit-splitting / incrementalism** (out of scope) — belongs to `/ba:execute`; `propose`
  already made the deliberate one-commit-per-run YAGNI call (Step 5a).
- **Two separate Risk and Review-focus sections** (rejected by user) — combined into one
  "For reviewers" block: fewer headers, one reviewer cue, less proliferation.

All new inputs (proof detection, risk derivation) are **gathered in Step 2 and passed across
the composition seam** — the `compose_body` contract stays pure (synthesis-locked in
`docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md`). New sections are
**Step 3.2 registry rows**. The "tier never named at call site" invariant is preserved.

## Key Decisions

### 1. Proof section — default-on, non-blocking, one-line-pending

- **Always rendered**, replacing the current blocking evidence HITL (Step 2e). No question is asked at run time.
- **Auto-detect** what's cheap and certain: new/changed test files in `diff.file_stats` → a
  one-line pointer (e.g. `Proof: unit-covered — orders_test.rb`). Detection happens in Step 2
  (a new gather sub-step), not in composition.
- **Empty state** (the common `execute`→`propose` case — proof comes later): a single compact
  line, `**Proof:** _pending — add tests / QA notes / screenshots before merge_`. Not a
  multi-row checklist wall.
- **Proof taxonomy** (vocabulary for what counts, not what gets pasted): Automated (tests/CI)
  · Manual (repro steps, QA-run results) · Visual (screenshots/Loom) · (none yet).
- **References, never dumps.** Compact claims + pointers only. CI status omitted (platform shows
  it); Visual evidence stays in `<details>` per the existing screenshot rule.
- **#20 (`/ba:prove`) is subsumed** as the Visual row of this taxonomy — recommend closing #20
  as folded in, or narrowing it to "auto-capture screenshots to fill the Visual row" if the
  browser-capture mechanism is still wanted later.

### 2 + 3. "For reviewers" block — combined, always-on risk line

- **One combined block**, not two sections:
  ```
  ## For reviewers
  **Risk:** medium — touches auth, DB migration
  **Look closest at:** the token-refresh path in `auth.rs`; the migration backfill
  ```
- **Risk line is always present** (low included), one word + a short "because" clause. Derived in
  Step 2 from: sensitive paths (payments / auth / migrations / security-touching files), diff
  size, and breaking-change signals → low | medium | high.
- **Review-focus** names the 1–2 areas most worth human attention (diff hotspots from
  `file_stats`, breaking signals, security paths). Activates at medium+; on a small/typo diff
  there's usually nothing to point at.
- **Typo-tier exception:** the whole block is suppressed at typo tier (typo = one line, no body
  per 3.1a) — an always-on risk line must not contradict the one-line-typo target.
- Risk derivation is a Step 2 gather concern; the block is a Step 3.2 registry row. The seam
  never sees "risk logic," only the materialized risk value + focus list on `CompositionInputs`.

### 4. Apply-by-default — flip #46's default

- **Default flips:** skip the Step 4 "Apply?" `AskUserQuestion` and proceed straight to Step 5;
  also auto-confirm the Step 0b edit-only prompt. The preview block still *prints* (observability),
  it just doesn't gate.
- **Opt-in escape hatch** for when the gate is wanted: a `--review` (alias `--interactive`) flag
  **and** a `BA_PROPOSE_REVIEW=1` env var (set-once-in-profile). This inverts #46's proposed
  `--yes`/`BA_PROPOSE_YES` opt-in — reconcile #46 to the flipped default.
- The `describe_only` short-circuit is unchanged (already prints-and-exits without a prompt).
- Edit-body / Regenerate-with-hint paths remain reachable only under `--review`.

### 5. Deviations — reviewer-neutral fold (#48)

- **Drop the standalone `## Deviations` header** from the MR/PR body. This supersedes the
  2026-06-26 rendering fix (which stripped U-IDs but *kept* the header) — issue #48, filed after,
  showed the header still reads as noise because it references a plan the reviewer can't see.
- **Fold** any genuinely reviewer-relevant substance into the relevant existing section (Impact /
  What-changed), rewritten in plain change terms with **no "plan" reference and no U-ID** — e.g.
  "reporting-skill left unedited on purpose; its `page_size: 50` is a legitimate large-page case."
- **Durable record untouched:** the `Deviation (U<n>):` commit trailer stays (git-derived resume
  mechanism), and the Linear-ticket rollup stays. Only the reviewer-facing *rendering* changes.
- **Render-side only** → the U-ID convention's 5-citation-site sync is **not** triggered (same
  reasoning the 2026-06-26 brainstorm established); `execute.md` is untouched.

### 6. Anti-bloat — the constraint, already built

- The 3.1a per-tier shape targets, 3.2a "leave out" list, and 3.6 per-tier overshoot warning
  already exist (2026-06-11). Item 6 is **confirmed already solved** — no new anti-bloat work.
- The design rule that makes items 1–3 safe: **"always-on vs earned" is one decision.** Risk line
  = always-on (one line); Proof = always-on (one line when pending); Review-focus = earned
  (medium+); the whole "For reviewers" block = suppressed at typo tier. Net effect on a typical
  `execute`→`propose` medium diff: +1 Proof line, +1 "For reviewers" block (~3 lines) — inside the
  one-screen medium target.

## Scope Boundaries

- **NOT** touching the `compose_body` contract, the opaque-input philosophy, or the orchestrator's
  host-dispatch / branch-routing plumbing (synthesis-locked).
- **NOT** changing execute's `Deviation (U<n>):` trailer grammar, the U-ID commit-subject grammar,
  or `derive-state` — the resume mechanism is untouched; `execute.md` gets no edit.
- **NOT** pasting CI logs, test output, or the test files into the body.
- **NOT** adding AI-role attribution or commit-splitting.
- **NOT** auto-trimming — the size signal still only warns; the user decides (unchanged).
- **NOT** making risk derivation clever/ML — it's a deterministic path+size+breaking heuristic;
  refine later if it misfires.

## Acceptance Criteria

- Running `/ba:propose` on a diff with **no** proof present asks **no** evidence question and
  renders a single `**Proof:** _pending…_` line; the old Step 2e blocking prompt is gone.
- A diff containing new/changed test files renders a one-line Proof pointer naming a test file; no
  CI status or raw test output appears in the body.
- Every non-typo run renders one `## For reviewers` block with an always-present `**Risk:**` line
  (low/med/high + short reason); the block is absent at typo tier.
- Review-focus names 1–2 areas on medium+ diffs and is omitted when there's no hotspot.
- `/ba:propose` with no flags **applies without a confirmation prompt**; `--review` (or
  `BA_PROPOSE_REVIEW=1`) restores the Step 4 menu and the Step 0b edit-only confirm.
- No MR/PR body contains a standalone `## Deviations` header; reviewer-relevant deviation substance
  (when any) appears folded into an existing section with no "plan"/U-ID reference.
- The `Deviation (U<n>):` commit trailer and the Linear rollup are unchanged; `execute.md` is
  unchanged (confirmable by diffing the edit — confined to `propose.md` Steps 0/2/3/4 + docs).
- A typical medium `execute`→`propose` body stays within the one-screen 3.1a target with the new
  sections present — verifiable via `--describe-only`.

## Open Questions

*(None — the four load-bearing decisions were resolved with the user: combined "For reviewers"
block · always-on one-line risk · reviewer-neutral Deviations fold · one-line-pending Proof.)*

## Convention Compliance

Convention-checker agent is not installed in this session; check run inline against `CLAUDE.md`.
**No violations.** Watch-items carried forward as plan/ship-time guards:

- **New sections = registry rows** (Step 3.2) and **new inputs gathered in Step 2, passed across
  the pure seam** — honored; the synthesis-locked `compose_body` contract is untouched and the
  "tier never named at call site" invariant is preserved.
- **U-ID 5-citation-site sync NOT triggered.** Items 5 (Deviations fold) is strictly render-side;
  the U-ID grammar, `derive-state`, and `execute.md` are unchanged — same basis the 2026-06-26
  brainstorm confirmed. Plan must keep the fold render-side (no commit-body rewrite).
- **README + CLAUDE.md update IS triggered** (item 4): the `/ba:propose` description and
  `argument-hint` change when the apply-by-default flip + `--review`/env-var land, and #46's
  `--yes` framing must be reconciled. Carry as a ship-time doc-sync item.
- **`plugin.json` version bump** applies when the `propose.md` edits ship (not at brainstorm stage).
- **Planning-command-never-writes-code** honored — this artifact documents WHAT, no code.
- **Relationship to prior brainstorms:** supersedes the *rendering* decision in
  `2026-06-26-propose-deviation-rendering-brainstorm.md` (header dropped, not just U-ID-stripped);
  builds *within* `2026-06-11-ba-propose-lean-body-brainstorm.md` (its anti-bloat controls are the
  governing constraint for the new always-on sections).

## Next Steps

→ `/ba:plan` to turn this into an implementation plan for the `commands/ba/propose.md` edits
(Steps 0/2/3/4) plus the README/CLAUDE.md doc-sync and #46 reconciliation.
