---
title: HTML Output Mode for Plans and Brainstorms
type: feat
plan_schema: 2
status: active
date: 2026-06-27
origin: docs/brainstorms/2026-06-27-html-output-mode-brainstorm.md
detail_level: comprehensive
tags: [html-output, ba-plan, ba-brainstorm, ba-execute, ba-review-plan, ba-handoff, output-mode, rendering-reference, section-contract, issue-33]
---

# HTML Output Mode for Plans and Brainstorms Implementation Plan

## Overview

Add a first-class HTML output mode to `/ba:plan` and `/ba:brainstorm`, modeled on the compound-engineering (CE) plugin. The HTML artifact is **the** artifact for a run — exclusive (markdown OR HTML, never both), a single self-contained HTML5 file read directly by the plan's downstream consumers (`/ba:execute`, `/ba:review-plan`, `/ba:handoff`) the same way they read markdown today. The change decomposes into CE's three orthogonal layers: a shared format-rendering reference (`references/html-rendering.md`), per-command section contracts, and per-command output-mode resolution — then adapts the markdown-coupled consumers to route on file extension and read HTML's visible-text structure (see brainstorm: `docs/brainstorms/2026-06-27-html-output-mode-brainstorm.md`).

## Current State

The producers fuse "what the artifact contains" and "how it's formatted (markdown)" into inline fenced template blocks — there is no section-contract / format-rendering separation and no output-format logic anywhere (`commands/ba/plan.md:184-420`, `commands/ba/brainstorm.md:89-261`). Writes are hardcoded to `.md`: `plan.md:493-503`, `brainstorm.md` FAST-TRACK (`:79-108`) and STANDARD/FULL (`:218-261`).

The consumers are markdown-coupled:
- `execute.md` globs `docs/plans/*.md` (`:24`), validates `plan_schema: 2` from a leading YAML `---` block ("a file with no `---` block is the absent case", `:36`), infers `detail_level` from `## ` headings (`:43-46`), and enumerates tasks from literal `### U<n> — <title>` headings (`:51-53`).
- The **U-ID & Git-Derived State Convention** (owner, `execute.md:61-142`) is mostly format-blind (it reads git subjects), but its anchor grammar item (1) defines a unit as "a `### U<n> — <title>` heading" (`:68-69`), `derive-state` "iterates the **plan's** current unit set" (`:84`), and the owner self-description lists citation sites (`:63-66`).
- `review-plan.md` globs `docs/plans/*.md` (`:30`), anchors findings to `### U<n>` / heading text (`:191-220`), resolves anchors against the plan snapshot (`:358-361`), and applies fixes by editing the `.md` (`:483`, `:525`).
- `handoff.md` keys off `plan_schema: 2` (`:33`) and delegates to `derive-state(…, run_verify: false)`.
- `propose.md` is format-agnostic — reads only git trailers/subjects (`:265-279`), never opens the plan body. Its U-ID citation text is markdown-shaped.

No `references/` directory exists; commands cite shared material by plain file-path prose (verified). `convention-checker` reads every `CLAUDE.md` at runtime (`agents/convention-checker.md:33-37`) and currently enforces "All artifacts require YAML frontmatter" (`CLAUDE.md:71`). A non-command HTML artifact already sits in `docs/plans/` (`docs/plans/2026-05-19-feat-add-ba-propose-command-plan.html`) — a legacy, non-conforming file. `plugin.json` version is `0.29.1`. Unblocked by #31 (shipped, commit `d1d47aa`). Full spec breakdown: `docs/research/2026-06-27-html-output-mode-research.md`.

## Acceptance Criteria

- AC1: `/ba:plan` and `/ba:brainstorm` each resolve an output format via the collapsed precedence stack (in-prompt `output:` request > in-session/memory preference > default `md`) and write a single self-contained `.html` when HTML is selected, `.md` otherwise — never both.
- AC2: A produced HTML artifact satisfies the rendering reference's hard invariants: single self-contained file; all metadata as visible text (no YAML frontmatter, no hidden JSON / `data-*` / `<meta>` mirror); every U-ID/AC-ID as both `id=""` and visible text; a visible composition-signal footer.
- AC3: `/ba:execute` runs an `.html` plan end-to-end — extension-first detection, unit enumeration from visible-text U-IDs, git-derived progress unchanged, `strike-don't-renumber` preserved.
- AC4: `/ba:review-plan` reviews an `.html` plan (findings anchor to U-IDs/section headings) and auto-applies fixes to the HTML, then passes the rendering reference's post-compose audit.
- AC5: `/ba:handoff` narrates U-resolution for an `.html` plan via `derive-state(…, run_verify: false)`.
- AC6: A shared `references/html-rendering.md` exists and is loaded at compose time by both commands; per-command section contracts exist; the ~600-line spec is not duplicated.
- AC7: The `CLAUDE.md` frontmatter convention is amended to cover both formats; the convention-checker passes HTML artifacts without flagging the absent YAML; `README.md` and affected command docs are updated in sync (per the repo's mirroring conventions).
- AC8: A brainstorm HTML artifact can include a wireframe for a UI-shaped requirement with the mandatory directional caption.
- AC9: Exclusive-mode is enforced at the producer — it refuses to write (and asks the user) when a same-stem twin of the other extension already exists in the target dir; an unknown `output:` value (e.g. `output:pdf`) is dropped with a one-line note; a subject-matter mention of HTML ("plan the HTML export feature") never switches the doc format — only the `output:` token does.
- AC10: A non-conforming legacy `.html` in `docs/plans/` is **not** mis-consumed — `/ba:execute`, `/ba:review-plan`, and `/ba:handoff` reject it as not-a-conforming-plan (analogous to the markdown "doesn't look like a plan" case), rather than silently enumerating zero units or refusing a valid plan.
- AC11: A format switch on resume is refused — the git-committed `U<n>` subjects stay anchored to the original artifact; resume preserves the existing artifact's format unless the user starts a fresh `/ba:plan`.
- AC12: Unit enumeration is format-neutral across the owned U-ID convention definition **and** all five citation sites **and** the README mirror — no consumer enumerates zero units from a valid HTML plan, and the five-site enumerations are reconciled to list all five sites.

## What We're NOT Doing

- No config subsystem / `.compound-engineering`-style config file (brainstorm decision 7).
- No `DESIGN.md` discovery convention (brainstorm decision 5).
- No markdown→HTML export path and no md/html dual-output — exclusive mode only (brainstorm decision 1). Markdown is **not** kept as a canonical sibling; consumers are adapted to read HTML directly.
- **No extraction of a `markdown-rendering.md` and no refactor of the existing inline markdown templates to consume the section contract.** The inline templates remain the markdown rendering as-is; the section contract is a thin per-command "what" reference that the HTML compose path pairs with `html-rendering.md`. (Intentional asymmetry — keeps the change surgical; CE extracts both, dev-workflow extracts only the HTML half it needs for #33.)
- No HTML output for `/ba:research` or other commands — `/ba:plan` and `/ba:brainstorm` only.
- No behavioral change to `/ba:propose` (already format-agnostic) — citation-text sync only.
- No new diagram/charting library — inline SVG hand-authored per the rendering reference; no JS framework runtimes.
- Not re-deciding the `/ba:slice` / plan-LoC-gate retirements (separate roadmap items).

## Proposed Solution

Copy CE's architecture, trim its heavier machinery (config tier, `DESIGN.md` discovery). Build the shared format layer first (Phase 1) so both producers and all consumers have one place that defines the HTML structure. Wire the producers (Phase 2). Then adapt the consumers and the U-ID convention in lock-step (Phase 3) — this is the load-bearing, highest-silent-mis-read-risk phase. Finish with conventions, mirrors, docs, and the release bump (Phase 4).

The decisive design move (from the brainstorm's consumer-adaptation contract): **extension-first routing**. Each consumer globs `docs/plans/*.{md,html}`, branches on extension, treats the HTML visible-text header as the frontmatter equivalent, and enumerates units by scanning the `U<n>` visible text (guaranteed by the rendering invariant to appear alongside `id=""`). The git side (subject scan, merge-base, `Verify:`) is already format-blind and is untouched.

## Technical Approach

### Architecture

Three orthogonal layers (brainstorm decisions 2, 4):
1. **Output-mode resolution** (per-command) — a precedence stack with exclusive mode, added near the top of each producer; defers loading the ~600-line rendering reference until compose time (efficiency note from CE: don't carry 200+ lines through the whole dialogue).
2. **Section contract** (per-command) — `references/plan-sections.md`, `references/brainstorm-sections.md`: the section list, ID registries (U-IDs/AC-IDs for plan; R-IDs/decision-IDs for brainstorm), and the mandatory-metadata fields rendered as the visible-text header in HTML.
3. **Format-rendering reference** (shared) — `references/html-rendering.md`: the hard invariants + style precedence + section anatomy + diagram/wireframe rules + agent-consumability rules + post-compose audit, paired at compose time with whichever section contract is producing.

The metadata-location collision (CE's visible-text-only invariant vs. dev-workflow's `plan_schema: 2` YAML detection) is resolved exactly as CE did: route on extension first, treat the visible-text header as the frontmatter equivalent, lean on the visible-text-ID + semantic-structure invariants so a text-reading consumer enumerates units from HTML the way it does from markdown.

### Alternative Approaches Considered

- **HTML as a human-facing-only export, markdown stays executable** — rejected in the brainstorm (decision 1): contradicts issue #33's "executable, agent-consumable" intent and re-introduces dual-maintenance friction.
- **Keep markdown canonical, write HTML as a derived sibling** — surfaced by repo research as a way to avoid touching consumers, but it directly contradicts brainstorm decision 1 (exclusive mode) and would leave the md/html-twin ambiguity permanently live. Rejected.
- **Per-command duplication of the rendering reference (CE's literal pattern)** — rejected (decision 4): invites drift; one shared repo-level reference instead.
- **Full style precedence port with `DESIGN.md` discovery** — rejected (decision 5): a new filesystem convention out of scope for #33.

## Implementation Phases

### Phase 1: Shared format layer (foundation)

#### Changes Required

**File**: `references/html-rendering.md` (new), `references/plan-sections.md` (new), `references/brainstorm-sections.md` (new)

##### U1 — Create the shared `references/html-rendering.md`

Author the shared, skill-agnostic HTML rendering reference (repo-level `references/` dir — a new structural location, documented in U9). Source the spec from `docs/research/2026-06-27-html-output-mode-research.md` (its section-by-section breakdown of CE's 632-line reference) and the brainstorm's hard invariants — CE's source is not on disk, so author from the documented spec rather than copy bytes. The file opens by stating its own contract: it describes how to render *any* artifact in HTML, independent of which command produced it, and is paired with a section contract that says *what* the artifact contains.

Decisions the reference must encode:
- **Hard invariants:** single self-contained HTML5 file (CSS in `<style>`, SVG inline, images as base64; sole exception a `<link>` to a CDN webfont with an offline fallback stack); all metadata as visible text — **no** YAML frontmatter, **no** hidden `<script type="application/json">`, `data-*` mirror, or `<meta>` duplicating the header; every ID-bearing item (U-IDs, AC-IDs, R-IDs) rendered as both `id="u1"` and the visible text "U1" inside the element; a visible composition-signal footer naming compose timestamp + source; a visible navigation region linking stable section anchors.
- **`strike-don't-renumber` in HTML:** a struck unit is shown with a **visible** marker (e.g. `<del>` on the heading text or a "(superseded)" caption) — never a hidden attribute (would violate the no-hidden-`data-*` invariant). The visible marker is the signal `/ba:review-plan`'s "a struck `U<n>` does not resolve" rule reads.
- **Style precedence** (decision 5, trimmed): in-session direction > stylesheet named in loaded `CLAUDE.md`/`AGENTS.md` > opinionated fallback default. No `DESIGN.md` discovery.
- **Format principles & section anatomy:** readable measure (~70ch / 820-960px container); prose authoritative over visualization; Implementation Units as repeating `<article>` cards with an ID chip, a `<dl>` metadata strip, and secondary content in default-closed `<details>`; semantic HTML over `<div>` soup; field labels as visible `<dt>` text not attributes; **section heading vocabulary matches the section contract** (downstream agents grep these).
- **Diagrams:** inline hand-authored SVG, complements-never-replaces prose, with the legibility checklist.
- **Wireframe mockups (requirements docs only):** low-fidelity gray-box wireframe permitted when a requirement describes a UI surface, with a **mandatory directional ("not the spec") caption**; scoped to requirements-only artifacts (what brainstorm produces).
- **Post-compose audit:** a self-run checklist the producing agent executes before returning (verifies every invariant above, incl. id/visible-text pairing and the footer).
- **Canonical load-site pattern (named — cited by U3/U4/U6):** the reference defines one named instruction — *"Read `references/html-rendering.md` at compose time, before emitting any HTML"* — that every producer/editor cites by name rather than each inventing its own load step. A command that omits the load still runs but silently produces non-conforming HTML; naming the pattern makes the load contract explicit and greppable.
- **Named HTML conformance preflight (single source — cited by U5/U6/U7):** the reference defines the preflight **once**, as a three-signal conjunction: an `.html` is a *conforming plan* iff it has (1) the visible-text header block, (2) ≥1 `U<n>` visible-text heading with a matching `id=""`, **and** (3) the composition-signal footer. All three consumers cite this named definition — none re-derives it — so the signal list cannot drift (e.g. a footer-less legacy `.html` is rejected uniformly).

**Code-shape decision:** none — this is a prose specification, not code; the literal HTML idioms it prescribes (`<article>`, `<dl>`, `id=""`) are illustrative examples within the spec, owned by U1's authored content.

Test scenarios:
- The reference states the single-self-contained-file invariant and the no-hidden-metadata invariant (Covers AC2)
- The reference specifies every ID as both `id=""` and visible text (Covers AC2, AC12)
- The reference specifies the visible struck-unit marker (Covers AC3)
- The reference includes the wireframe affordance with a mandatory directional caption (Covers AC8)
- The reference includes a post-compose audit checklist (Covers AC4)
- The reference defines the named load-site pattern and the named three-signal conformance preflight (Covers AC6, AC10)

Verify: `test -f references/html-rendering.md && grep -qi 'self-contained' references/html-rendering.md && grep -q 'id="[uU]' references/html-rendering.md && grep -qi 'wireframe' references/html-rendering.md && grep -qi 'conformance preflight' references/html-rendering.md`

##### U2 — Create the per-command section contracts

Create `references/plan-sections.md` and `references/brainstorm-sections.md` — thin per-command "what the artifact contains" references (decision 4). Each enumerates: the ordered section list, the ID registries (plan: `AC<N>` acceptance criteria + `U<n>` implementation units + the `**Code-shape decision:**` label as preserved visible-text plan content; brainstorm: key-decision IDs, scope boundaries, R-IDs where applicable), and the mandatory metadata fields that render as the HTML visible-text header (the frontmatter equivalent — title, type, schema, date, origin, detail_level/triage_level, tags). The contract names the stable section-heading vocabulary consumers grep, and is what `html-rendering.md` pairs with at compose time. It does **not** restate the rendering rules (those live in U1) and does **not** duplicate the ~600-line spec.

**Governing decision — authority & sync obligation (resolves the two-sources-of-truth drift risk):** the section contract is **authoritative for the HTML path only**. The existing inline markdown templates in `plan.md` / `brainstorm.md` remain the **canonical source for the markdown path** (consistent with "What We're NOT Doing" — they are not refactored to consume the contract). When the section *set* changes in the future (a section added/removed/renamed), **both** the relevant inline template **and** its section contract must be updated together — this is the explicit sync obligation, called out here so the parallel specs cannot silently drift. The contract deliberately captures only the section list + ID registries + header fields (the slow-changing skeleton), not prose, to keep the sync surface minimal.

Test scenarios:
- Both contract files exist and enumerate the section list + ID registries for their command (Covers AC6)
- The plan contract names `U<n>` and `AC<N>` registries and the visible-text header fields (Covers AC6, AC12)
- The brainstorm contract marks itself a requirements-only artifact (enables the wireframe affordance) (Covers AC8)

Verify: `test -f references/plan-sections.md && test -f references/brainstorm-sections.md && grep -q 'U<n>' references/plan-sections.md`

> **Phase gate:** All units in this phase reach `done` via `Verify:` or a U-tagged commit → automated checkpoint proceeds automatically. No manual pause.

---

### Phase 2: Producers gain HTML output

#### Changes Required

**File**: `commands/ba/plan.md`, `commands/ba/brainstorm.md`

##### U3 — Add output-mode resolution + HTML compose/write to `plan.md`

Add an output-mode resolution step near the top of `plan.md` (a "Resolve Output Format" step, before the dialogue/templates) and wire HTML compose/write at the existing Step 7 write site (`plan.md:493-503`). Patterns to follow: CE's Phase 0.0 (resolve early, defer loading the rendering reference until compose time).

Decisions:
- **Precedence stack** (decision 7, collapsed): in-prompt `output:` token > in-session/memory preference > default `md`. **Format-vs-subject heuristic:** only the `output:` token (or unambiguous plain-language format request like "make this a webpage") controls format; a subject-matter mention ("plan the HTML export feature") never does (AC9). **Unknown `output:` value** (e.g. `output:pdf`) is dropped with a one-line note, falling through to the next tier (AC9). **In-session preference** = an `output:` used earlier this conversation; **memory** = only if a slug exists.
  - *Tier-structure decision (do not collapse further):* this **output-mode** stack (decision 7) is distinct from the **style-precedence** stack in U1 (decision 6: in-session > stylesheet-in-CLAUDE.md/AGENTS.md > fallback) — they are two separate stacks, both deliberately resolved in the origin brainstorm. The in-session/memory output tier is **not** the rejected config subsystem (decision 7 rejected a config *file*); it is a zero-infrastructure read of conversation/memory state and is kept. U4's brainstorm resolution is **identical** to this one (same tiers, same heuristic) — the only brainstorm-specific addition is the wireframe affordance.
- **Exclusive-mode enforcement** (AC9): before writing, check the target dir for a same-stem twin of the *other* extension (`docs/plans/<stem>.md` vs `<stem>.html`). If one exists, **refuse and ask the user** which to keep — do **not** delete (the protected-artifacts guard forbids removing `docs/plans/` files). Never write both.
- **Resume format continuity** (AC11): resume preserves the existing artifact's format; a mid-run format switch is refused (git-committed `U<n>` subjects stay anchored; a fresh `/ba:plan` is required to re-emit in another format).
- **Compose:** when HTML is selected, follow U1's **canonical load-site pattern** (Read `references/html-rendering.md` at compose time) and load `references/plan-sections.md`, then produce a single self-contained `.html` (`YYYY-MM-DD-<type>-<name>-plan.html`) with the visible-text header, IDs as `id=""` + visible text, and the composition-signal footer. The existing convention-compliance gate (Step 5) still runs before the write and must pass the HTML artifact (U11 teaches the checker).
- **Frontmatter instruction neutralized:** retitle/reword the "### YAML Frontmatter (all levels)" block (`plan.md:184`) to "structured metadata — YAML frontmatter for markdown, a visible-text header block for HTML" so the producer body stops instructing unconditional YAML.
- **U-ID citation sync:** update plan.md's U-ID minting citation so it reads format-neutral — markdown mints `### U<n> — <title>`; HTML emits `<h3 id="un">U<n> — <title></h3>` per the rendering invariant (cite the owner section in `execute.md`).

Test scenarios:
- Running `/ba:plan output:html …` writes a single `.html`, no `.md` twin (Covers AC1)
- Running `/ba:plan` with no format token writes `.md` (default) (Covers AC1)
- `/ba:plan output:pdf …` drops the unknown value with a note and falls through to default (Covers AC9)
- `/ba:plan plan the HTML export feature` produces a `.md` plan about HTML, not an HTML-format plan (Covers AC9)
- A pre-existing `<stem>.md` blocks an HTML write of the same stem until the user resolves it (Covers AC9)

Verify: `grep -q 'references/html-rendering.md' commands/ba/plan.md && grep -q 'references/plan-sections.md' commands/ba/plan.md && grep -qi 'output:' commands/ba/plan.md`

##### U4 — Add output-mode resolution + HTML compose/write + wireframe to `brainstorm.md`

Mirror U3 in `brainstorm.md`: add the same "Resolve Output Format" step and wire HTML compose/write at both write sites (FAST-TRACK `:79-108`, STANDARD/FULL `:218-261`). Same precedence stack, format-vs-subject heuristic, unknown-value drop, exclusive-mode same-stem refusal, and resume continuity as U3 (the resolution is identical — see U3's tier-structure decision). Follow U1's **canonical load-site pattern** (Read `references/html-rendering.md` at compose time) and load `references/brainstorm-sections.md`; write `YYYY-MM-DD-<topic>-brainstorm.html`. Because brainstorm produces a requirements-only artifact, the HTML path may include a **wireframe with a mandatory directional caption** for a UI-shaped requirement (AC8). Neutralize the embedded frontmatter instruction in the brainstorm templates the same way (YAML for md, visible-text header for HTML). The Phase 3.5 convention-compliance gate still runs before the write.

Test scenarios:
- `/ba:brainstorm output:html …` writes a single self-contained `.html` brainstorm with a visible-text header (Covers AC1, AC2)
- A UI-shaped requirement renders a wireframe with the directional caption (Covers AC8)
- Default (no token) still writes `.md` (Covers AC1)

Verify: `grep -q 'references/html-rendering.md' commands/ba/brainstorm.md && grep -q 'references/brainstorm-sections.md' commands/ba/brainstorm.md && grep -qi 'wireframe' commands/ba/brainstorm.md`

> **Phase gate:** All units `done` → automated checkpoint proceeds automatically.

---

### Phase 3: Consumer adaptation + U-ID convention (load-bearing)

This phase carries the highest silent-mis-read risk (spec-flow Gaps C/F/G/L). The enumeration change to the owned U-ID convention and its five citation sites must land coherently — a missed site means a consumer enumerates zero units from a valid HTML plan and reports "already complete."

#### Changes Required

**File**: `commands/ba/execute.md`, `commands/ba/review-plan.md`, `commands/ba/handoff.md`, `commands/ba/propose.md`

##### U5 — Make `execute.md` format-neutral: U-ID convention owner + extension-first routing + HTML preflight

Edit `execute.md` in four distinct, co-located spots (all must land together — this is the owner edit + its in-file consumers):
- **Owned U-ID anchor grammar item (1)** (`:68-69`): redefine a unit anchor as format-neutral — a markdown `### U<n> — <title>` heading **or** an HTML `U<n>` visible-text heading with a matching `id=""`. Keep monotonic / strike-don't-renumber / plan-scoped clauses unchanged.
- **`derive-state` "Iterates the plan's current unit set"** (`:84`): state that locating the plan's units is format-neutral (markdown `### U<n>` heading or HTML visible-text `U<n>` + `id`). The git side (subject scan `:88-103`, merge-base, `Verify:`) is explicitly unchanged.
- **Owner self-description** (`:63-66`): reconcile to list **all five** citation sites (currently omits `review-plan.md` — add it) and note the grammar is format-neutral.
- **Step-0 task-list enumeration** (`:50-53`): restate "Each `### U<n> — <title>` unit is a task" format-neutrally for all three detail levels (markdown `### U<n>` heading or HTML `U<n>` visible-text heading + `id`).

Then add **extension-first routing** to the detect/validate ladder:
- Auto-detect glob → `docs/plans/*.{md,html}` (`:24`, the `ls -t` locate step — a **distinct spot** from the `:50-53` task enumeration; both must change).
- Branch on extension. `.md` keeps the YAML `plan_schema: 2` + `detail_level` ladder (`:27`, `:36-39`, `:43`). `.html` reads the **visible-text header** as the frontmatter equivalent for `plan_schema`/`detail_level`.
- **HTML conformance preflight** (AC10): apply U1's **named three-signal conformance preflight** (visible-text header + ≥1 `U<n>` visible-text heading with matching `id=""` + composition footer) — cite it by name, do not re-derive the signal list here. A non-conforming `.html` (e.g. the legacy `docs/plans/2026-05-19-…-plan.html`) is rejected with the "doesn't look like a plan" message — **not** silently enumerated as zero units and **not** refused as "predates the execution model" (that message is the markdown-absent case only).

**Co-dependency note (load-bearing — the plan's #1 silent-failure guard):** the glob change (`:24`/`:50-53` → `*.{md,html}`) and the **format-neutral enumeration** change (the actual logic that extracts `U<n>` from an HTML visible-text heading, not just the wording) are **co-dependent — apply them in a single edit**. Any intermediate state that globs `.html` but still extracts `### U<n>` markdown headings is exactly the dangerous zero-unit enumeration ("already complete, 0 pending"). Use identical format-neutral wording at the grammar definition (`:68-69`) and the Step-0 consumer (`:50-53`) so the file reads as one consistent definition + application.

Test scenarios:
- `/ba:execute` on a conforming `.html` plan enumerates its units and runs end-to-end; git-derived progress and strike-don't-renumber behave identically to markdown (Covers AC3)
- `/ba:execute` auto-detect picks up an `.html` plan via the `*.{md,html}` glob (Covers AC3)
- The legacy non-conforming `docs/plans/*.html` is rejected as not-a-plan, not executed (Covers AC10)
- A conforming HTML plan is **not** refused as "predates the git-derived execution model" (Covers AC10)
- A struck HTML U-ID (e.g. `<del>U3 — …</del>` / `(superseded)`) is inert during enumeration and its `<n>` is never reused — `strike-don't-renumber` holds on the HTML path (Covers AC3)
- The owner self-description (`:63-66`) lists all five citation sites, including `review-plan.md` (Covers AC12)

Verify: `grep -q '{md,html}' commands/ba/execute.md && grep -qi 'visible-text' commands/ba/execute.md && grep -qi 'conformance preflight' commands/ba/execute.md && grep -Eqi 'extract|enumerate' commands/ba/execute.md && grep -q 'review-plan' commands/ba/execute.md`

> The `extract|enumerate` term fails if `visible-text` appears only as commentary while the enumeration logic stays markdown-only; the `review-plan` term catches the self-description five-site reconciliation. Together they tighten the falsifiability past a presence-only grep.

##### U6 — Adapt `review-plan.md`: extension-first + HTML anchors/strike + auto-apply to HTML

Edit `review-plan.md`:
- **Locate the Plan** glob → `docs/plans/*.{md,html}` (`:30`, the `ls -t` auto-detect line); apply U1's **named conformance preflight** (cite by name, do not re-derive).
- **Plan-Anchor grammar** (`:191-220`) + §4b resolution (`:343-361`): define the HTML anchor token shape — a finding resolves against the **normalized `<hN>` inner text or the `id=""`** (either, normalized); a struck unit is read from the **visible struck marker** defined in U1 (so "a struck `U<n>` does not resolve" still holds). Keep the markdown behavior intact under the `.md` branch.
- **Apply Fixes** (decision 6; `:481-525`): auto-apply fixes to HTML plans via agent `Edit`, guided by `references/html-rendering.md`. Prose fixes edit visible text in place. **Structural fixes** (add/reorder/strike a unit) get the caution review-plan already gives risky markdown fixes, plus an **HTML-specific post-apply re-validation**: re-run the rendering reference's post-compose audit, asserting the `id=""`/visible-text pairing stays in sync and the footer is regenerated. The no-duplicate-metadata invariant guarantees a fix never lands in two places.
- Do **not** reword the adjacent never-hide-ledger or protected-artifacts mirror blocks (mirroring obligation 5) — an HTML plan under `docs/plans/` inherits the same protection.

Test scenarios:
- `/ba:review-plan` on an `.html` plan produces findings anchored to U-IDs/section headings (Covers AC4)
- A prose fix is auto-applied to the HTML and the post-compose audit passes (Covers AC4)
- A structural fix preserves the `id=""`/visible-text pairing (post-apply re-validation) (Covers AC4)
- A struck unit in the HTML does not resolve as a live anchor (Covers AC3, AC4)

Verify: `grep -qF 'docs/plans/*.{md,html}' commands/ba/review-plan.md && grep -qi 'post-compose audit' commands/ba/review-plan.md` — the `-F` literal match on the auto-detect glob fails if `{md,html}` was added elsewhere but the `ls -t` line (`:30`) was left `*.md`.

##### U7 — Adapt `handoff.md`: extension routing + HTML plan recognition

Edit `handoff.md` so the `/ba:execute` progress section (`:33-37`) recognizes an in-flight HTML plan: route on extension and read the visible-text header schema-equivalent instead of keying solely off the YAML `plan_schema: 2` field. **Explicit behavior on a `.html` with no YAML block:** handoff recognizes the plan via the header schema-equivalent and **still narrates the execute-progress section** — it must **not** fall through to "no plan found" and silently drop the section (a quiet context loss for the next session). `derive-state(plan, git, run_verify: false)` then narrates U-resolution on the HTML plan (subject scan only — side-effect-free, format-blind). Apply U1's **named conformance preflight** (cite by name) so a non-conforming `.html` is not mistaken for an in-flight plan (AC10).

Test scenarios:
- `/ba:handoff` during an in-flight `.html` execution names the plan path and narrates `done-via-subject` / `pending` units (Covers AC5)
- Handoff does not drop the progress section for a conforming HTML plan (Covers AC5)
- `run_verify: false` remains side-effect-free on HTML (no `Verify:` execution) (Covers AC5)
- A `.html` plan with no YAML block is recognized and its progress section is narrated, not dropped (Covers AC5)

Verify: `grep -q '\.html' commands/ba/handoff.md && grep -qi 'visible-text header' commands/ba/handoff.md`

##### U8 — Sync `propose.md` U-ID citation text (behaviorally unchanged)

`propose.md` is format-agnostic — it reads git subjects/trailers over `<base>..HEAD`, never the plan body (verified `:265-279`). No behavioral change. Apply only a **citation sync touch**: update its U-ID convention citation so the grammar wording is format-neutral (not literally `### U<n>`), and note the plan it preserves U-IDs against may be `.md` or `.html` (irrelevant to propose's git-only reads). This keeps the five-site mirror coherent (mirroring obligation 1).

Test scenarios:
- `/ba:propose` behavior is unchanged for both `.md` and `.html` plans (still reads git trailers only) (Covers AC12)
- propose.md's U-ID citation no longer hardcodes the markdown `### U<n>` form (Covers AC12)

Verify: `grep -qi 'md.*html\|format-agnostic\|format-neutral\|\.html' commands/ba/propose.md`

> **Phase gate:** All units `done` → automated checkpoint proceeds automatically.

---

### Phase 4: Conventions, mirrors, docs, release

#### Changes Required

**File**: `CLAUDE.md`, `README.md`, `agents/convention-checker.md`, `.claude-plugin/plugin.json`

##### U9 — Amend `CLAUDE.md`: frontmatter convention, `references/` file kind, U-ID bullet sync

Edit `CLAUDE.md`:
- **Frontmatter convention** (`:71`): "All artifacts require YAML frontmatter" → "Artifacts require structured metadata — YAML frontmatter for markdown, a visible-text header block for HTML." Phrase it so a runtime read by the convention-checker yields the visible-text-header equivalence as a verifiable rule (mirroring obligation 4).
- **New `references/` file kind:** document that `references/` holds shared format-rendering references + per-command section contracts (a new file kind — neither a dated artifact nor a command/agent). Add to the Artifact Paths table (or a note beside it).
- **Artifact Paths table:** allow `.md` **or** `.html` for plan and brainstorm artifacts.
- **U-ID convention bullet** (`:81`): sync to format-neutral enumeration wording (the bullet already lists all five citation sites — keep them; just neutralize the `### U<n>` phrasing).

**Ordering / coupling note (U9 + U11 are a prerequisite pair for HTML production):** the convention-checker reads `CLAUDE.md` at runtime, so amending the frontmatter bullet here (U9) is what *primarily* teaches it the visible-text-header equivalence; U11 hardens that against the checker's markdown-shaped examples. The pair is **coupled and must be coherent together** — U11 must not land alone (it would explicitly allow HTML while `CLAUDE.md` still says YAML-required). More importantly, although U9/U11 sit in Phase 4, they are a **functional prerequisite for U3/U4**: the producers' convention-compliance gate (plan Step 5 / brainstorm Phase 3.5) runs *before* writing, so the first HTML artifact a producer tries to write will be flagged unless U9+U11 are already in place. Land U9+U11 before HTML production is exercised end-to-end (they may be implemented in any order relative to Phase 1–2, but must be coherent before the first real HTML write).

Test scenarios:
- The frontmatter bullet names both YAML and the visible-text header (Covers AC7)
- `references/` is documented as a file kind / artifact location (Covers AC6, AC7)
- The U-ID bullet enumeration is format-neutral (Covers AC12)

Verify: `grep -qi 'visible-text header' CLAUDE.md && grep -q 'references/' CLAUDE.md`

##### U10 — Update `README.md`: HTML output mode, artifact paths, U-ID mirror

Edit `README.md`:
- `/ba:plan` and `/ba:brainstorm` blocks: document the HTML output mode and the `output:` precedence stack.
- **"Choosing `md` vs `html`" guidance** (a short rule-of-thumb block beside the output-mode docs): the deciding axis is **how humans touch the artifact** (agents read either equally — that is the design). Prefer **`md`** when the artifact is reviewed in a git diff/PR (HTML diffs are noise), hand-edited, small/linear, or in default/automation paths — and keep it the **repo default** since these artifacts live in git and get reviewed. Prefer **`html`** when the plan is large and read-mostly (collapsible `<details>` unit cards + wayfinding solve the wall-of-text problem), a brainstorm has UI-shaped requirements (wireframes), there are diagrams worth inline SVG, or the audience is browser-reading humans. Name the tension explicitly: HTML *fixes reading* but *worsens git review*, and the mode is exclusive — so choose per artifact.
- **Artifact Paths table** (`:260-268`): allow `.md` or `.html` for plans/brainstorms.
- **U-ID git-derived-state mirror block** (`:228-230`): sync to format-neutral enumeration **and** reconcile the citation-site list to all **five** sites (it currently lists only four — add `review-plan.md`).

Test scenarios:
- README documents HTML output for plan/brainstorm (Covers AC7)
- README carries the "choosing md vs html" rule-of-thumb guidance (Covers AC7)
- The artifact-path text allows `.html` (Covers AC7)
- The U-ID mirror block lists five citation sites, format-neutral (Covers AC12)

Verify: `grep -qi 'html' README.md && grep -q '\.html' README.md && grep -q 'review-plan.md' README.md && grep -qi 'choosing.*html\|md vs.*html\|vs .*html' README.md`

##### U11 — Teach `convention-checker.md` the visible-text-header equivalence

Edit `agents/convention-checker.md` to state explicitly (decision, not implicit — mirroring obligation 4) that an HTML artifact carries its metadata as a visible-text header block in lieu of YAML frontmatter, so the absence of a `---` block in an `.html` artifact is **not** a violation. The agent already reads `CLAUDE.md` at runtime (`:33-37`), so the amended `CLAUDE.md` bullet (U9) is the primary teach; this unit makes the equivalence robust against the checker's markdown-shaped examples.

Test scenarios:
- The convention-checker passes a sample HTML artifact (no YAML frontmatter) without flagging missing frontmatter (Covers AC7)
- A markdown artifact missing frontmatter is still flagged (no regression) (Covers AC7)

Verify: `grep -qi 'visible-text header\|html' agents/convention-checker.md`

##### U12 — Bump `plugin.json` version

Bump `version` in `.claude-plugin/plugin.json` **forward** of `0.29.1` (e.g. `0.29.2` or `0.30.0` — the auto-update cache key; every shipped change needs a bump, and the bump must increase, never downgrade). Owned at release time; included here for completeness.

Test scenarios:
- The version differs from `0.29.1` and is a forward bump, not a downgrade (Covers AC7)

Verify: `grep '"version"' .claude-plugin/plugin.json | grep -qv '0.29.1'` (presence of a changed version; a downgrade is a forward-bump violation caught at release review)

> **Phase gate:** All units `done` → automated checkpoint proceeds automatically.

## System-Wide Impact

### Interaction Graph
The producers (`/ba:plan`, `/ba:brainstorm`) now emit one of two formats; every plan consumer (`/ba:execute`, `/ba:review-plan`, `/ba:handoff`) and the `convention-checker` gate fire on the chosen format. `derive-state` is the shared choke point — it is invoked by execute (run_verify:true) and handoff (run_verify:false); its only format-coupled part is "iterate the plan's current unit set" (U5). `/ba:propose` fires on git only (unaffected).

### Error & Failure Propagation
The dangerous failures are **silent mis-reads**, not exceptions: (a) a consumer globs `.html` but still greps `### U<n>` → zero units → "already complete" (mitigated by U5's format-neutral enumeration landing with the glob change); (b) a conforming HTML plan trips the YAML-absent "predates the model" branch (mitigated by U5's extension branch); (c) md/html same-stem twin → `head -1` picks the stale one (mitigated by U3/U4 producer refusal — the twin never gets created). The HTML conformance preflight (U5/U6/U7) converts a would-be silent mis-read of the legacy `.html` into a loud "doesn't look like a plan."

### State Lifecycle Risks
`strike-don't-renumber` and git-committed `U<n>` subjects must stay anchored to the original artifact across a resume — hence the refuse-format-switch-on-resume rule (U3/U4, AC11). A structural HTML fix (U6) risks desyncing `id=""` from visible text — mitigated by the post-apply re-validation.

### API Surface Parity
Five interfaces expose plan enumeration: the owned convention + plan/execute/propose/handoff/review-plan citations + the README mirror. U5/U8/U9/U10 (plus U3's plan.md citation and U6/U7's reads) update all of them in lock-step (mirroring obligation 1).

### Integration Test Scenarios
1. End-to-end: `/ba:plan output:html` → `/ba:execute` (enumerate, commit a U-tagged unit, resume) → `/ba:review-plan` (auto-apply a fix) → `/ba:handoff` (narrate progress) — all on the same `.html` artifact.
2. Legacy `.html` rejection across all three consumers.
3. Same-stem twin refusal at the producer, then a clean single-format write after the user resolves.
4. Format-vs-subject: `/ba:plan plan the HTML export feature` yields a `.md` plan.
5. Resume continuity: start `.html`, attempt `output:md` on resume → refused, original format preserved.
6. Partial-complete HTML-plan resume: a conforming `.html` plan with some units `done-via-subject` and the rest pending → `/ba:execute` resumes at the first pending unit, exercising `derive-state`'s visible-text U-ID enumeration mid-flight (the highest-risk real-world path — a returning user's first HTML resume).

## Risk Analysis & Mitigation

- **Missed mirror site (highest risk).** A citation site left markdown-only silently breaks HTML enumeration. *Mitigation:* U5 reconciles the owner + self-description to five sites; U9/U10 reconcile both mirrors; U8 syncs propose; Phase 3 lands the consumer reads together. The brainstorm cross-check below re-verifies all five + README.
- **Authoring `html-rendering.md` from spec (CE not on disk).** *Mitigation:* the research doc captured the 632-line reference section-by-section; the brainstorm ACs enumerate the hard invariants; U1's Verify + the post-compose audit catch invariant omissions.
- **Scope creep into a markdown-rendering extraction.** *Mitigation:* explicitly out of scope (What We're NOT Doing) — the inline markdown templates stay; only the HTML half is extracted.

## Testing Strategy

These are prompt/doc files; "tests" are agent-execution behaviors. Per-unit `Verify:` lines assert the textual wiring (cross-references between commands and the new references, the glob/extension changes, the convention amendments). The integration scenarios above are the manual end-to-end validation — exercised in a fresh session (prompt-only changes ship on a dry-run; full real-harness integration may follow in a later slice).

## Documentation Plan

`README.md` (U10) and `CLAUDE.md` (U9) carry the user-facing + convention docs. The `references/` files (U1/U2) are themselves the spec docs. No separate docs needed.

## Sources & References

### Origin
- Brainstorm: `docs/brainstorms/2026-06-27-html-output-mode-brainstorm.md` — Key decisions carried forward: HTML as the exclusive executable artifact (decision 1); scope = plan + brainstorm via a shared rendering layer (decisions 2, 4); amend the frontmatter convention (decision 3); trimmed style precedence and no config tier (decisions 5, 7); review-plan auto-applies HTML fixes (decision 6); the consumer-adaptation contract (extension-first routing); the five mirroring obligations.

### Internal References
- Research (full spec breakdown): `docs/research/2026-06-27-html-output-mode-research.md`
- U-ID & Git-Derived State Convention (owner): `commands/ba/execute.md:61-142`
- Markdown-coupled consumer reads: `commands/ba/execute.md:24,36-53`; `commands/ba/review-plan.md:30,191-220,358-361,481-525`; `commands/ba/handoff.md:33-37`
- Format-agnostic propose: `commands/ba/propose.md:265-279`
- Convention-checker runtime CLAUDE.md read: `agents/convention-checker.md:33-37`
- Existing non-conforming HTML artifact: `docs/plans/2026-05-19-feat-add-ba-propose-command-plan.html`

## Convention Compliance
- [x] Planning-commands-never-write-code — aligned: only prompt/doc files edited (`commands/`, `agents/`, `references/`, `CLAUDE.md`, `README.md`, `plugin.json`); no production code.
- [x] U-ID convention five-site + README mirror rule — aligned: U5 (owner + self-description, reconciled to five sites), U3 (plan.md citation), U6 (review-plan), U7 (handoff), U8 (propose), U9 (CLAUDE.md bullet), U10 (README mirror, reconciled to five sites).
- [x] Update README when commands/agents/artifact-paths change — aligned: U10.
- [x] Convention-compliance gate before writing artifacts — aligned/reinforced: U11 teaches the checker the HTML equivalence.
- [x] Protected-artifacts guard — aligned: U6 does not weaken it; producer refuses to delete a same-stem twin (U3/U4).
- [x] Code-shape-decision label preserved — aligned: U1/U2 keep the `**Code-shape decision:**` label as visible-text plan content; no label-wording change.
- [x] Bump plugin.json version — aligned: U12.
- [x] Frontmatter convention amended to dual-format — justified intentional change (decision 3): surfaced, U9; in-body producer instructions neutralized in U3/U4; consumer reads neutralized in U5/U7.
- [x] New `references/` location/file-kind — justified intentional change (decision 4): surfaced, documented in U9.
