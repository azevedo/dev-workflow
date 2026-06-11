---
title: "fix: restore lean-body editorial discipline to ba:propose Step 3"
type: fix
status: active
date: 2026-06-11
origin: docs/brainstorms/2026-06-11-ba-propose-lean-body-brainstorm.md
detail_level: minimal
iteration_count: 0
tags: [ba-propose, body-composition, leanness, editorial-discipline]
---

# fix: restore lean-body editorial discipline to ba:propose Step 3

`ba:propose` ported Lynch's section *menu* but dropped CE's editorial *discipline* during the port: the "match weight to weight / shorter wins / a larger diff earns more selectivity, not more content" principle, the per-size shape targets, and Lynch's explicit "leave out" list. The result is an additive section registry braked only by a single 150-line warning that fires after ~5 screens. This plan restores that discipline — entirely inside the composition seam, leaving the `compose_body` pure-function contract untouched.

All edits land in one file: `commands/ba/propose.md` (Step 3 composition spec, Step 4 preview text, Important Guidelines footer). No new command, agent, artifact path, tier, section, or flag (see brainstorm: *Scope Boundaries*).

## Acceptance Criteria

- [ ] Step 3's invariants list carries a selectivity invariant phrased as "shorter wins / more selectivity, not more content," beside the existing "never restate the diff verbatim."
- [ ] A new `3.1a Per-tier shape targets` table gives each tier a soft target (typo / small / medium / large / perf), explicitly non-binding ("user decides", no auto-trim).
- [ ] A new `3.2a Leave out` block encodes the cross-cutting anti-bloat rules (no what-changed play-by-play; "no headers unless two distinct concerns").
- [ ] Registry rows #9 (Testing), #12 (Alternatives), #14 (Screenshots) carry their row-specific lean rule (manual path not unit enumeration; cap ~2–3 notes; `<details>` + one-line captions).
- [ ] `ComposedBody.size_warning` is retyped `bool` → `str or None` (mirrors `rewritten_from`); 3.6 emits a per-tier overshoot phrase that names the *target shape*, never the tier *label*.
- [ ] Step 4 preview (lines 403, 415) prints the per-tier phrase verbatim; the single global 150-line warning is gone; the "tier never named at call site" invariant (propose.md:410) still holds.
- [ ] One leanness bullet added to the Important Guidelines footer.
- [ ] `compose_body` contract semantics, the orchestrator (Steps 0–2, 5), and all Step 2 gather logic are unchanged — confirmable by diffing the edit and seeing it confined to Step 3, the Step 4 preview text, and the footer.

## What We're NOT Doing

- Not touching the `compose_body` pure-function contract or the opaque-input philosophy (synthesis-locked — see brainstorm: *Why This Approach*).
- Not adding a new tier, section, config knob, or `--lean` flag (preview's Edit affordance already covers ad-hoc trimming).
- Not auto-trimming bodies — the size signal warns; the user decides (unchanged from 3.6).
- Not touching the orchestrator, branch routing, host dispatch, or the preserved-block / Linear / `docs/solutions/` plumbing.
- Not re-adding rejected-design elements (Design B `overrides`, Design C I/O ports).
- Not updating README.md / CLAUDE.md — no command/agent/artifact-path change. (The `plugin.json` bump is a ship-time task below, not a doc change.)

## Behaviors to Test

Verified by composing sample bodies via the `--describe-only` dry run on fabricated diffs (no Dragon material).

- [ ] A **small** fabricated change (e.g. a one-line null-guard fix) composes to a few sentences, **no `##` headers**, under ~300 chars.
- [ ] A **medium** fabricated change composes to roughly one screen with **≤2 `H2`** sections; what/why read as prose, not two headed sections.
- [ ] A change that re-narrates the diff in prose ("renamed X, moved Y, extracted Z") is **not** produced — the play-by-play is absent.
- [ ] A change with screenshots wraps them in `<details>` with one-line captions, not an inline image wall.
- [ ] A **large** fabricated change still emits required safety sections when their input is present (breaking change, dependency justification, cross-ref) — selectivity trims *prose and optional/narrative* sections, it does **not** suppress required sections.
- [ ] When a composed body overshoots its tier's target, the Step 4 preview shows a phrase naming the **target shape** (e.g. "~one screen for a change this size"); the words "small/medium/large/typo/perf" never appear in preview output.
- [ ] When a body is within target, `size_warning` is `None` and no warning prefix prints.

## Context

- **Edit target:** `commands/ba/propose.md` — Step 3 "Compose body (the seam)" at lines 265–392; Step 4 preview at 394–428; Important Guidelines at 602–614.
- **Source material the discipline came from:** `docs/research/2026-05-17-shipping-skill-source-material-research.md` — CE Step A size table ("Match weight to weight. When in doubt, shorter wins… Large PRs need more selectivity, not more content") and Lynch's "Leave out" list (Source 4). These are what the port under-carried.
- **Lock boundary:** `docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md` `## Locked Design`. The `compose_body` pure-function contract is locked; the tier→section mapping and editorial rules are "explicitly seam-hidden… not as a frozen contract" (that brainstorm's internal-sketch note). **The shipped `ComposedBody` already carries four fields (`title`, `body`, `rewritten_from`, `size_warning`) versus the locked design's two** — i.e. the contract was already extended within the lock during the original execute, framed at propose.md:293 as "declared output fields so the orchestrator's preview reads them by name." Retyping `size_warning` from `bool` to `str or None` is a *type refinement of an already-extended preview-support field*, mirroring its sibling `rewritten_from: str or None` on the adjacent line — **not** a new contract surface and **not** a lock breach.
- **The needle to thread (per brainstorm AC + propose.md:410):** the per-tier warning must *name the tier's target* while *never naming the tier*. Resolved by carrying a size-descriptor phrase ("~300 chars", "about one screen") rather than a tier label ("small"/"medium") — a size descriptor is what the user should see; the tier vocabulary stays seam-internal.

## MVP

All edits are to `commands/ba/propose.md`.

### Edit 1 — add the selectivity invariant (after line 299)

Insert a new bullet immediately after the `body never restates the diff verbatim` bullet in `### Invariants`:

```markdown
- Match weight to weight: when in doubt, shorter wins, and a larger diff earns *more selectivity, not more content*. Default to the smallest body that still saves the reviewer a round-trip. This governs prose verbosity and optional/narrative sections — it never suppresses a required section (breaking changes, dependency justifications, cross-refs still appear when their input is present). See the per-tier shape targets (3.1a) and the leave-out list (3.2a).
```

### Edit 2 — add subsection `3.1a Per-tier shape targets` (after the 3.1 tier table, before `#### 3.2`)

```markdown
#### 3.1a Per-tier shape targets

The tier from 3.1 sets a **soft** target shape. These are editorial guidance, not gates — do not auto-trim; the user decides (same stance as 3.6). 3.6 warns only when a body overshoots its own tier's target.

| Tier | Target shape |
|---|---|
| typo | One line. No body. |
| small | Prose, no `##` headers unless two genuinely distinct concerns. ~300 characters. |
| medium | Narrative frame, then what-and-why. At most two `H2` sections (~one screen). |
| large | Narrative + 3–5 design-decision callouts + brief test summary. ~150 lines as a backstop; a summary table beats an `H3` per mechanism. |
| perf | Before/after table + short narrative (size-independent — see the 3.1 perf-modifier note). |

"No headers unless two distinct concerns" is what folds impact (#2) and motivation (#3) into one prose paragraph at small/medium tier; they become separate headed sections only at large tier.
```

### Edit 3 — add subsection `3.2a Leave out` (after the 3.2 registry table + its perf note, before `#### 3.3`)

```markdown
#### 3.2a Leave out (the anti-bloat list)

Cross-cutting omissions that apply regardless of which sections activate (Lynch's "Leave out"). These are instances of the selectivity invariant:

- **No what-changed play-by-play.** Do not re-narrate the diff in prose ("renamed X, moved Y, extracted Z, updated the tests"). The diff already shows the mechanism; the body explains what the diff cannot. This is the single biggest source of bloat on small diffs.
- **No file list / change-size enumeration.** Obvious from the diff.
- **One what/why, not two headed sections** at small/medium tier (governed by the per-tier shape targets in 3.1a).
- **Short-term discussion and tooling artifacts stay out** — preview URLs, build links, "I'll address comments below."
```

### Edit 4 — tighten three registry row body-rules (in the 3.2 table)

Append the row-specific lean rule to each `Body rule` cell:

- **Row #9 (Testing instructions)** — current: `Spell out the manual verification path.` → append: ` Give the manual path, not an enumeration of every unit case — "unit-covered; manual checks below" is enough.`
- **Row #12 (Alternatives considered)** — current: `Brief notes on rejected approaches.` → append: ` Cap at ~2–3 notes; include only those that pre-empt a likely reviewer flag. Fold a lone note into Impact/Scope rather than giving it its own section.`
- **Row #14 (Screenshots / Demo)** — current ends `…For perf tier, render as a before/after table.` → append: ` Wrap screenshot/demo blocks in a `<details>` element with one-line captions — a supplement, not an image wall.`

### Edit 5 — retype `ComposedBody.size_warning` (line 290)

```markdown
  size_warning       # str or None — when the body overshoots its tier's soft target (3.1a), a ready-to-print phrase naming that target shape (e.g. "~one screen for a change this size"); None when within target. Mirrors rewritten_from's None-or-value shape. The phrase names the target SHAPE, never the tier label — the tier stays seam-internal (Step 4 invariant).
```

(The line-293 sentence — "`rewritten_from` and `size_warning` are declared output fields so the orchestrator's preview reads them by name" — stays as-is; it already covers the retyped field.)

### Edit 6 — rewrite 3.6 for per-tier overshoot (lines 386–388)

```markdown
#### 3.6 Soft size-target warning

After full composition, compare `body` against its tier's soft target shape (3.1a):

- small — warn if the body exceeds ~300 characters or introduces `##` headers without two distinct concerns.
- medium — warn if the body exceeds ~one screen or more than two `H2` sections.
- large — warn if the body exceeds ~150 lines (backstop).
- typo / perf — no size warning (typo is one line; perf is shaped by its table).

When a tier overshoots, set `ComposedBody.size_warning` to a short phrase naming the *target shape* for a change this size (never the tier label). Otherwise `size_warning = None`. Do not auto-trim — the user decides. The preview at Step 4 reads `size_warning` by name; composition never side-channels state to the orchestrator.
```

### Edit 7 — update Step 4 preview to print the phrase (lines 403 and 415)

- **Line 403** — current: `Body lines: <N>                                       (size warning prefix if result.size_warning)` → replace the parenthetical with: `(size-target prefix if result.size_warning is not None)`
- **Line 415** — replace the global-150 warning with the tier-target phrase, printed verbatim:

```markdown
- `⚠ <result.size_warning>` (printed verbatim when `result.size_warning is not None` — e.g. `⚠ Composed body is longer than typical for a change this size (target: ~one screen) — consider trimming`. The phrase names the target shape only; it never surfaces the tier label or the "Lynch's soft cap" source vocabulary.)
```

### Edit 8 — add a leanness bullet to Important Guidelines (within lines 602–614)

```markdown
- Match weight to weight — shorter wins; a bigger diff earns more selectivity, not more content. No what-changed play-by-play, no unit-test enumeration, screenshots in `<details>`. Required safety sections (breaking changes, dep justifications) are exempt from trimming.
```

## Ship-time checklist (execute stage, not now)

- [ ] Bump `.claude-plugin/plugin.json` version **0.22.0 → 0.23.0** in the same commit as the `propose.md` edit — it is the auto-update cache key; do not defer (see CLAUDE.md *Conventions*).
- [ ] Confirm the diff touches only `commands/ba/propose.md` + `.claude-plugin/plugin.json`.

## Convention Compliance

Convention-checker run 2026-06-11 against this plan: 9 checked, **0 violations**, 2 confirm-items (both addressed below).

- [x] **planning-commands-never-write-code** — aligned. Editing a command's markdown prose-spec is documentation, not code (precedent: the 2026-05-19 propose plan edited the same prose-contract).
- [x] **synthesis-lock** — aligned. Edits are seam-internal; the `compose_body` contract is untouched. The `size_warning` retype is a type-refinement of an already-extended preview-support field (reasoning written into *Context* above per checker Risk 1).
- [x] **public-safe artifacts** — aligned. All examples are fabricated; `compose_body`/`ComposedBody`/`size_warning` are plugin-internal seam names (public-safe precedent), no Dragon material, no tier-label leak into preview output (per checker Risk 2).
- [x] **surgical changes** — aligned. One file, eight named edits, each pinned to a line range; no adjacent-code cleanup.
- [x] **frontmatter + filename** — aligned (`origin:` set; `type: fix`).
- [x] **plugin.json version bump** — handled as a concrete named ship-time task (0.22.0 → 0.23.0), not deferred loosely.
- [x] **README/CLAUDE.md** — aligned; no command/agent/artifact-path change, no update triggered.

## Sources

- Origin brainstorm: `docs/brainstorms/2026-06-11-ba-propose-lean-body-brainstorm.md` — carried forward: restore-discipline scope, selectivity-as-invariant, per-tier targets with overshoot warnings, the Impact/Motivation "no headers unless two concerns" resolution.
- Editorial source material: `docs/research/2026-05-17-shipping-skill-source-material-research.md` (CE Step A size table; Lynch "Leave out" list, Source 4).
- Lock context: `docs/brainstorms/2026-05-19-ba-propose-shipping-skill-brainstorm.md` `## Locked Design`.
- Edit target: `commands/ba/propose.md:265-428` (Step 3 + Step 4), `:602-614` (Important Guidelines).
