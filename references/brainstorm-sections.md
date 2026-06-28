# Brainstorm Section Contract

This is the section contract for `/ba:brainstorm` — it defines **what** a brainstorm artifact
contains. It is paired at compose time with `references/html-rendering.md` which defines
**how** the artifact is rendered in HTML. This file is authoritative for the HTML path only.
The existing inline markdown templates in `commands/ba/brainstorm.md` remain the canonical
source for the markdown path.

**Artifact type:** `/ba:brainstorm` produces a **requirements-only** artifact. This is a
brainstorm document, not an implementation plan. Brainstorm artifacts live in
`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md` (`.md`) or
`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.html` (`.html`).

**Sync obligation:** when the section set changes (a section added, removed, or renamed), both
this contract and the corresponding inline template in `commands/ba/brainstorm.md` must be
updated together. This file captures only the slow-changing skeleton (section list + ID
registries + header fields) to keep the sync surface minimal.

**Wireframe affordance:** because brainstorm is a requirements-only artifact, its HTML path
may include a wireframe mockup for UI-shaped requirements. See
`references/html-rendering.md` "Wireframe Mockups" for the rules and the mandatory directional
caption requirement. This affordance is absent from implementation plan HTML artifacts.

---

## Mandatory Metadata Fields (Visible-Text Header)

These fields render as the visible-text header block in HTML artifacts (the frontmatter
equivalent — see `references/html-rendering.md` Section Anatomy). Required fields:

| Field | Values |
|---|---|
| `date` | `YYYY-MM-DD` |
| `topic` | kebab-case topic string |
| `status` | `approved` \| `draft` |
| `triage_level` | `fast-track` \| `standard` \| `full` |
| `tags` | Array of component name strings |

---

## Section List

Sections in canonical order. The heading text is the **authoritative vocabulary** for HTML
`id=""` anchors and agent heading-scan matching.

### FAST-TRACK sections

| Section heading | `id=""` anchor | Notes |
|---|---|---|
| *(visible-text header)* | `header` | Metadata block |
| `What We're Building` | `what-were-building` | 2–3 sentence understanding |
| `Key Decisions` | `key-decisions` | Decisions from the confirmation |
| `Acceptance Criteria` | `acceptance-criteria` | Testable criteria |
| *(composition footer)* | *(footer element)* | Compose timestamp + source |

### STANDARD / FULL sections

| Section heading | `id=""` anchor | Notes |
|---|---|---|
| *(visible-text header)* | `header` | Metadata block |
| *(navigation)* | *(nav element)* | Links to major sections |
| `What We're Building` | `what-were-building` | 1–2 paragraphs |
| `Why This Approach` | `why-this-approach` | Approaches considered, rationale |
| `Key Decisions` | `key-decisions` | Decision + rationale pairs |
| `Locked Design` | `locked-design` | Present only when design-it-twice fired |
| `Rejected Designs` | `rejected-designs` | Present only when design-it-twice fired |
| `Scope Boundaries` | `scope-boundaries` | What we're NOT doing |
| `Acceptance Criteria` | `acceptance-criteria` | Measurable criteria |
| `Open Questions` | `open-questions` | Must be empty before handoff to plan |
| `Convention Compliance` | `convention-compliance` | Appended by convention-checker |
| `Next Steps` | `next-steps` | Pointer to `/ba:plan` |
| *(composition footer)* | *(footer element)* | Compose timestamp + source |

---

## ID Registries

### R-IDs — Research / decision references (optional)

When a brainstorm cites numbered research items or tracks decision IDs, render them with the
same `id=""` + visible-text pattern as U-IDs:

- **Format:** `R<n>` where `<n>` is a positive integer, monotonic from 1.
- **HTML rendering:** `<span id="r<n>" class="id-chip">R<n></span>` inline, or as a list item
  `<li id="r<n>">` in a reference list.
- Not all brainstorms use R-IDs — they are optional.

### Acceptance criteria in brainstorms

Brainstorm acceptance criteria are written as a flat list (not keyed `AC<N>` — that registry
belongs to the plan). In HTML, render as a plain `<ol>` under `<section id="acceptance-criteria">`.

---

## Notes for HTML Compose

- The wireframe affordance is scoped to this artifact type (requirements-only). Implementation
  plan HTML artifacts must not include wireframes.
- The `Locked Design` and `Rejected Designs` sections are conditional — include them only when
  the design-it-twice path fired in `/ba:brainstorm` Phase 2.
- The `Open Questions` section must be empty (or contain only resolved items under a
  "Resolved Questions" sub-section) before the artifact is valid for handoff to `/ba:plan`.
- The `references/html-rendering.md` post-compose audit applies in full, including the
  mandatory directional caption on any wireframe.
