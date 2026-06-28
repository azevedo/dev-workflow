# HTML Rendering Reference

This is a format-rendering reference — it describes how to render **any** artifact in HTML,
independent of which command is producing it. It is paired at compose time with a **section
contract** (e.g. `references/plan-sections.md`, `references/brainstorm-sections.md`) that
describes *what* the artifact contains. This file owns the *how*.

**Canonical load-site pattern:** Read this file at compose time, before emitting any HTML.
A command that omits this load step produces non-conforming HTML and fails the post-compose
audit. Cite this
named pattern — "follow the canonical load-site pattern" — rather than inventing a per-command
load instruction.

---

## Hard Invariants

These hold regardless of which command produced the artifact. An artifact that violates any
of these is non-conforming.

1. **Single self-contained HTML5 file.** No companion `.css`, `.js`, or `.svg` files. CSS lives
   inside a `<style>` block in `<head>`. SVG is inline. Images are base64 data URIs. The sole
   exception: a `<link rel="stylesheet">` to a CDN webfont endpoint, always accompanied by an
   offline fallback font stack in the CSS.

2. **All metadata is visible text — single source of truth.** No hidden machine-readable copy:
   no YAML frontmatter (`---` blocks), no `<script type="application/json">` embedding structured
   data, no `data-*` attributes mirroring the visible header, no `<meta name="...">` tags
   duplicating the visible-text header fields. Agents read metadata from the visible text, the
   same place a human does.

3. **Every ID-bearing item has both `id=""` and visible text.** For every item that carries a
   stable identifier — implementation units (U-IDs), acceptance criteria (AC-IDs), brainstorm
   R-IDs — render both:
   - An `id=""` attribute on the containing element: `id="u1"`, `id="ac2"`, `id="r3"` (lowercase,
     no spaces).
   - The visible text of the ID inside the element: "U1", "AC2", "R3".

   Example: `<h3 id="u1"><span class="id-chip">U1</span> — Unit Title</h3>`

   Downstream agents find the ID in source the same way they find it in markdown — there is no
   extraction path that differs between a human reader and an agent reader.

4. **Composition-signal footer.** Include a visible `<footer>` naming the compose timestamp and
   source artifact. Example: `Composed 2026-06-28 by /ba:plan from
   docs/brainstorms/2026-06-28-topic-brainstorm.md`. The footer is mandatory and visible — it is
   one of the three signals in the **HTML conformance preflight** (see below).

5. **Visible navigation region.** Include a `<nav>` element linking stable section anchors
   (`#overview`, `#acceptance-criteria`, `#implementation-units`, etc.) — one link per major
   section. This is machine-readable wayfinding, not decoration.

6. **`strike-don't-renumber` in HTML.** A struck (superseded) unit is shown with a **visible**
   marker — e.g. `<del>` wrapping the heading text, or a `(superseded)` caption beside the
   heading — never a hidden attribute or CSS-only strikethrough. The visible marker is how
   `/ba:review-plan`'s "a struck `U<n>` does not resolve" rule knows the unit is inert during
   anchor resolution. A struck unit's `<n>` is never reused (monotonic rule preserved).

---

## Named HTML Conformance Preflight

**Single source — cited by `/ba:execute`, `/ba:review-plan`, and `/ba:handoff`. Do not
re-derive this signal list in any consumer; cite it by name here. Do not rename this heading
— consumers cite it by this exact title.**

An `.html` file is a **conforming plan** if and only if it satisfies all three signals as a
conjunction. **This preflight is plan-specific** — brainstorm HTML artifacts are not subject
to it (brainstorms have no U-IDs; a future brainstorm validator would use a two-signal check:
signals 1 and 3 only).

1. **Visible-text header block** — a structured metadata region at the top of the document
   (inside `<body>`) rendering the artifact's title, type, schema version, date, and other
   mandatory fields as readable text (not YAML, not hidden attributes).
2. **At least one `U<n>` visible-text heading with a matching `id=""`** — e.g.
   `<h3 id="u1">…U1…</h3>` — confirming the artifact has implementation units readable by
   agents. (Plan-only signal — brainstorm HTML artifacts do not have U-IDs and are not
   validated by this preflight.)
3. **Composition-signal footer** — a `<footer>` with visible compose-timestamp text (Hard
   Invariant 4 above).

A file missing any one of these three signals is **not a conforming plan artifact** and must be
rejected (with the "doesn't look like a plan file" message) rather than silently enumerated as
zero units. A non-conforming legacy `.html` (e.g. an arbitrary HTML file in `docs/plans/`) is
rejected uniformly by all three consumers citing this preflight.

---

## Style Precedence

Choose the visual style by resolving these tiers in order (highest wins):

1. **In-session direction** — an explicit color/font/layout directive in the current conversation.
2. **Stylesheet named in `CLAUDE.md` or `AGENTS.md`** — if a `stylesheet:` key points to a CSS
   file, load it as the primary palette/typography source. Take scale-independent brand identity
   (color palette, font-weight decisions) literally; own scale-dependent layout (type sizes,
   line-height, spacing) yourself; skip decorative patterns; never load a proprietary brand
   typeface from an external source.
3. **Opinionated fallback default** — the style described in the Format Principles section below.

No `DESIGN.md` discovery. If none of the above applies, use the fallback default.

---

## Format Principles

### Readable measure

Constrain body text to a readable measure: `max-width: 860px` on the main container, with
`padding: 0 1.5rem` on narrow viewports. Prose lines of ~70 characters are the target. Wide
tables may break out of the measure with horizontal scroll rather than word-wrapping.

### Content-first layout choices

Do not translate markdown structure to HTML literally. Choose the right HTML element for the
content shape:
- A list of 5+ uniform items → consider `<table>` for scanability.
- Nested bullet lists more than two levels deep → flatten or restructure.
- A single-sentence item → inline in prose, not a bullet.

Prose is **authoritative over any visualization**. A diagram or table that contradicts its
adjacent prose is wrong. When in doubt, drop the visual, keep the prose.

### Links and references

Resolve `git remote get-url origin` to find the canonical repo URL. Link:
- Repository-relative file paths to their GitHub/GitLab permalink (`<remote>/blob/<sha>/<path>`).
- Issue numbers to the tracker URL.
- Pull request numbers to the PR URL.

For non-GitHub/GitLab remotes, render the path as plain text — **never invent a URL**. A broken
link is worse than no link.

### Typography and color

- **No JS framework runtimes.** A small inline `<script>` for TOC scroll behavior or
  `<details>` polyfill is the only allowed JavaScript. No React, Vue, Alpine, or similar.
- **No accent-colored body `<strong>`.** Reserve color for structural chips (ID chips, status
  badges). Running text is monochrome.
- **Uniform chip shapes.** ID chips, status badges, and tags share a consistent border-radius
  and padding. A `U1` chip and an `AC2` chip look like siblings, not accidents.
- **Local contrast.** Test text against its immediate background — not just body-on-page. A
  chip with a colored background must pass WCAG AA contrast.

---

## Section Anatomy

### Visible-text header block

The first `<section>` in `<body>` (after `<nav>`) renders the artifact's structured metadata as
visible text. This block is the frontmatter equivalent for HTML artifacts — consumers read it in
lieu of a YAML `---` block. Required fields (sourced from the paired section contract):

```html
<section id="header" class="artifact-header">
  <h1>[Artifact Title]</h1>
  <dl class="metadata-strip">
    <dt>Type</dt>       <dd>[feat | fix | refactor | brainstorm]</dd>
    <dt>Schema</dt>     <dd>plan_schema: 2</dd>
    <dt>Date</dt>       <dd>YYYY-MM-DD</dd>
    <dt>Status</dt>     <dd>[active | approved | draft]</dd>
    <dt>Origin</dt>     <dd>[path to brainstorm, or "standalone"]</dd>
    <dt>Detail level</dt> <dd>[minimal | standard | comprehensive]</dd>
    <dt>Tags</dt>       <dd>[tag1, tag2]</dd>
  </dl>
</section>
```

Render **all mandatory metadata fields** from the section contract as `<dt>`/`<dd>` pairs. Do
not hide any field in a `<meta>` tag or `data-*` attribute — visible text only.

### Implementation units (plan artifacts)

Each `### U<n> — <title>` unit renders as an `<article>` card:

```html
<article id="u1" class="unit-card">
  <header>
    <span class="id-chip">U1</span>
    <h3>Unit Title</h3>
  </header>
  <dl class="unit-meta">
    <dt>Goal</dt>       <dd>[what this unit accomplishes]</dd>
    <dt>Files</dt>      <dd>[file paths affected]</dd>
    <dt>Depends on</dt> <dd>[U-IDs this unit depends on, or "—"]</dd>
  </dl>
  <div class="unit-body">
    [prose decisions, test scenarios]
  </div>
  <details class="unit-secondary">
    <summary>Verify</summary>
    <code>[verify command]</code>
  </details>
</article>
```

The `<details>`/`<summary>` collapsible holds secondary content (Verify lines, extended
rationale). Default-closed keeps the unit list scannable. The ID chip and `id=""` are both
required (Hard Invariant 3).

**Struck units:** wrap the `<header>` content in `<del>`: `<del><span class="id-chip">U3</span>
<h3>Struck title</h3></del>` and add a visible `(superseded)` note. Never use CSS-only strikethrough
without the `<del>` element — the visual marker must be in source (Hard Invariant 6).

### Acceptance criteria (plan artifacts)

```html
<section id="acceptance-criteria">
  <h2>Acceptance Criteria</h2>
  <ol>
    <li id="ac1"><span class="id-chip">AC1</span> [criterion text]</li>
    <li id="ac2"><span class="id-chip">AC2</span> [criterion text]</li>
  </ol>
</section>
```

### Requirements / decisions (brainstorm artifacts)

Render brainstorm key decisions as `<section>` blocks with `id` attributes matching the
section contract's heading vocabulary. R-IDs (where applicable) follow the same `id=""` +
visible-text pattern as U-IDs.

### Scope boundaries ("What We're NOT Doing")

Render as a `<section id="scope-boundaries">` with a bulleted `<ul>`. The heading text must
match the section contract vocabulary so consumers can locate it by heading scan.

### Risk / scope callout cards

Render risks and scope items as tinted `<aside class="callout-card">` elements — a distinct
visual treatment from body prose, but still plain semantic HTML.

---

## Diagrams

Include diagrams only when they genuinely clarify structure that prose cannot express in
comparable length. Prose is authoritative — a diagram complements, never replaces it.

**Format:** Hand-authored inline SVG only. No Mermaid runtime, no Graphviz, no external image
sources. Wrap each diagram in `<figure>` with a `<figcaption>`.

**Legibility checklist (required before including any SVG):**
- No stroke running through label text — use a halo or move the label outside the shape.
- Labels in skewed/rotated shapes: compensate the text-anchor so it reads horizontally.
- Minimum font size 11px at rendered size.
- All connector arrows have visible arrowheads.
- Color is never the sole differentiator — use shape or label as well.
- Dark-mode safe: avoid pure-white fills on light backgrounds.

---

## Wireframe Mockups (Requirements Artifacts Only)

Wireframes are permitted **only in requirements-only artifacts** (brainstorm docs). They are
excluded from implementation plans and any non-visual requirement.

When a brainstorm requirement describes a **UI surface** (a page, dialog, or component layout),
the HTML may include a low-fidelity wireframe:
- Gray-box layout only — no color fills, no real imagery, no brand assets.
- Placeholder copy: "Heading text", "Label", "Button".
- Annotate interactivity with arrows and text labels, not simulated hover states.

**Mandatory directional caption:** every wireframe `<figcaption>` **must** include the phrase
"directional" or "not the spec" — e.g. `<figcaption>Wireframe — directional, not the
spec</figcaption>`. This is a hard requirement; a wireframe without the caption is non-conforming.

The caption signals to every reader (human and agent) that the wireframe is an illustration of
the *direction*, not a pixel-precise specification. Agents must not treat the wireframe as a
binding layout contract.

---

## Agent-Consumability Rules

**The semantic structure is the extraction contract.** Downstream agents read this HTML the
same way they read markdown — by scanning structure, not by parsing a hidden data layer.

- Use semantic HTML over `<div>` soup: `<article>` per unit, `<section>` per major section,
  `<dl>` for metadata strips, `<table>` for tabular data, `<details>`/`<summary>` for
  collapsible secondary content, `<nav>` for navigation, `<footer>` for the composition signal.
- Render **field labels as visible `<dt>` text**, not as `data-field=""` attributes.
  `<dt>GOAL</dt><dd>…</dd>` — not `<div data-field="goal">…</div>`.
- Keep U-IDs, AC-IDs, and R-IDs as visible text (Hard Invariant 3). An agent that scans for
  `U1` finds it in text, not in an attribute.
- **Section heading vocabulary must match the section contract.** Agents grep heading text to
  locate sections. If `references/plan-sections.md` names a section "Acceptance Criteria",
  render `<h2>Acceptance Criteria</h2>` — not "AC List" or "Requirements". Every deviation is
  a silent extraction failure.
- Stable `id=""` values on every section and unit. Prefer `id="acceptance-criteria"` over
  `id="section-3"`. IDs must be stable across edits — they are the anchor namespace for
  `/ba:review-plan` findings.

---

## Post-Compose Audit

**Run this checklist before returning the finished HTML.** This is a self-audit — the producing
agent checks its own output. A single failed item means the artifact is non-conforming.

| # | Check | Pass condition |
|---|---|---|
| 1 | Single file | No `<link>` to local `.css`/`.js`; no `<img src="…">` with a non-data-URI |
| 2 | No hidden metadata | No YAML `---` block; no `<script type="application/json">`; no `data-*` mirroring header fields |
| 3 | ID + visible text | Every U-ID, AC-ID, R-ID has both `id="…"` and the visible text "U1" / "AC2" / "R3" inside the element |
| 4 | Composition footer | `<footer>` present and contains a visible timestamp + source path |
| 5 | Navigation region | `<nav>` present with links to major section anchors |
| 6 | Struck units visible | Any struck unit uses `<del>` or an explicit `(superseded)` text marker — no CSS-only treatment |
| 7 | Wireframe captions | Every `<figure>` containing a wireframe has a `<figcaption>` with "directional" or "not the spec" |
| 8 | Section headings match contract | Every section heading text matches the paired section contract's vocabulary |
| 9 | No invented URLs | Every `href` is either a data URI, a fragment (`#anchor`), or a URL derived from `git remote get-url origin` |
| 10 | Conformance preflight | File satisfies all three signals: visible-text header + ≥1 `U<n>` heading with `id=""` + composition footer |

**On any failed check:** correct the artifact inline, re-run the failed check to confirm it passes, then continue. Do not return a non-conforming artifact.
