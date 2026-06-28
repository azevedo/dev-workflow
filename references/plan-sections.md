# Plan Section Contract

This is the section contract for `/ba:plan` — it defines **what** a plan artifact contains.
It is paired at compose time with `references/html-rendering.md` which defines **how** the
artifact is rendered in HTML. This file is authoritative for the HTML path only. The
existing inline markdown templates in `commands/ba/plan.md` remain the canonical source for
the markdown path.

**Sync obligation:** when the section set changes (a section added, removed, or renamed), both
this contract and the corresponding inline template in `commands/ba/plan.md` must be updated
together. This file captures only the slow-changing skeleton (section list + ID registries +
header fields) to keep the sync surface minimal.

---

## Mandatory Metadata Fields (Visible-Text Header)

These fields render as the visible-text header block in HTML artifacts (the frontmatter
equivalent — see `references/html-rendering.md` Section Anatomy). All fields are required:

| Field | Values |
|---|---|
| `title` | Descriptive artifact title |
| `type` | `feat` \| `fix` \| `refactor` |
| `plan_schema` | `2` (integer) |
| `status` | `active` (human-authored; `/ba:execute` ignores this — progress is git-derived) |
| `date` | `YYYY-MM-DD` |
| `origin` | Path to origin brainstorm, or omit if standalone |
| `detail_level` | `minimal` \| `standard` \| `comprehensive` |
| `tags` | Array of feature/component name strings |

---

## Section List

Sections in canonical order. The heading text in this list is the **authoritative vocabulary**
for HTML `id=""` anchors and agent heading-scan matching. Deviation from this vocabulary is a
silent extraction failure.

### All detail levels

| Section heading | `id=""` anchor | Notes |
|---|---|---|
| *(visible-text header)* | `header` | Metadata block — not a heading section |
| *(navigation)* | *(nav element)* | Links to major sections |
| `Acceptance Criteria` | `acceptance-criteria` | Keyed `AC<N>` — see ID Registry |
| `What We're NOT Doing` | `scope-boundaries` | Explicit scope exclusions |

### MINIMAL additional sections

| Section heading | `id=""` anchor |
|---|---|
| `Context` | `context` |
| `MVP` | `mvp` |

### STANDARD additional sections

| Section heading | `id=""` anchor |
|---|---|
| `Overview` | `overview` |
| `Current State` | `current-state` |
| `Proposed Solution` | `proposed-solution` |
| `Technical Approach` | `technical-approach` |
| `Testing Strategy` | `testing-strategy` |
| `Implementation` | `implementation` |

### COMPREHENSIVE additional sections

| Section heading | `id=""` anchor |
|---|---|
| `Overview` | `overview` |
| `Current State` | `current-state` |
| `Acceptance Criteria` | `acceptance-criteria` |
| `What We're NOT Doing` | `scope-boundaries` |
| `Proposed Solution` | `proposed-solution` |
| `Technical Approach` | `technical-approach` |
| `Implementation Phases` | `implementation-phases` |
| `System-Wide Impact` | `system-wide-impact` |
| `Risk Analysis & Mitigation` | `risk-analysis` |
| `Testing Strategy` | `testing-strategy` |
| `Documentation Plan` | `documentation-plan` |
| `Sources & References` | `sources-references` |
| `Convention Compliance` | `convention-compliance` |
| *(composition footer)* | *(footer element)* | Compose timestamp + source |

---

## ID Registries

### U-IDs — Implementation units

- **Format:** `U<n>` where `<n>` is a positive integer, monotonic from 1.
- **Grammar owner:** `commands/ba/execute.md` — `## U-ID & Git-Derived State Convention`.
- **Minting:** each `### U<n> — <title>` heading in markdown; each `<h3 id="u<n>">U<n> — <title></h3>` in HTML.
- **Rules:** monotonic; strike-don't-renumber (a struck unit's `<n>` is never reused); plan-scoped not globally unique; attach to implementation units only — never to `AC<N>` or `Test scenarios:`.
- **HTML rendering:** `<article id="u<n>" class="unit-card">` with a visible `<span class="id-chip">U<n></span>` (see `references/html-rendering.md` Section Anatomy).
- **Struck units:** a struck unit receives a visible `<del>` marker or `(superseded)` text — never hidden.

### AC-IDs — Acceptance criteria

- **Format:** `AC<N>` where `<N>` is a positive integer, monotonic from 1.
- **Grammar owner:** `commands/ba/plan.md` (minted here); consumed by `commands/ba/review-plan.md`.
- **Minting:** each `- AC<N>:` bullet in markdown; each `<li id="ac<n>">` in HTML.
- **Rules:** plan-owned — minted here, not inherited from the origin ticket; each item is a user-observable "done" statement.

### Code-shape decision label

The `**Code-shape decision:** <why>` label is preserved as visible text in HTML plans. It is not
a structural anchor — it does not receive an `id=""` — but its presence in the HTML source must
be readable as text (not stripped). Render inside the relevant unit card's `<div class="unit-body">`.

---

## Notes for HTML Compose

- The section contract is what `/ba:plan`'s convention-compliance gate validates against when
  producing an HTML artifact.
- Every heading in the artifact's `<body>` must match the section vocabulary above or be a
  sub-heading of a listed section.
- The `references/html-rendering.md` post-compose audit item 8 ("section headings match
  contract") checks this contract.
