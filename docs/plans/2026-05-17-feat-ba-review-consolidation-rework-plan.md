---
title: Adopt severity ladder + confidence + dedup + light structuring in /ba:review consolidation
type: feat
status: completed
date: 2026-05-17
origin: https://github.com/azevedo/dev-workflow/issues/5
detail_level: comprehensive
iteration_count: 1
tags: [ba-review, consolidation, severity-ladder, confidence, dedup, validator, reviewer-agents]
---

# Adopt severity ladder + confidence + dedup + light structuring in /ba:review consolidation

## Overview

Replace `/ba:review`'s current two-bucket consolidation (`Must Address` / `Consider` / `Looks Good`) with a four-level severity ladder, per-finding confidence anchors, cross-reviewer `file:line` dedup, and an internal parser-plus-validator pass. Reviewers continue to emit prose; consolidation operates on extracted structured records; the user still sees prose. This is the implementation of GitHub issue #5 — a single coordinated change spanning `commands/ba/review.md`, all seven `agents/review/*.md`, `README.md`, and `.claude-plugin/plugin.json`. The bundle adapts `ce-code-review`'s rigour into the prose-output era of `/ba:review` while preserving its conversational UX.

## Current State

- `commands/ba/review.md` is at 613 lines; key sections:
  - Step 3 dispatch templates: agent-based (`commands/ba/review.md:301-317`), skill-based (`commands/ba/review.md:319-334`), user-typed (`commands/ba/review.md:336-358`). All three close with the same sentence: `Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.`
  - Step 4 consolidation (`commands/ba/review.md:366-401`): renders each reviewer's prose under its own heading; flags `⚠ Conflicting` when two reviewers' advice at the same `file:line` differs.
  - Step 4.5 persistence (`commands/ba/review.md:404-510`): per-reviewer file writes the reviewer's **raw return text** verbatim (line 453); `summary.md`'s template body at line 497 reads `[The full Step 4 output verbatim — every reviewer's Must Address / Consider / Looks Good blocks, with conflict annotations.]`.
  - Step 5 downstream consumers reference the old vocabulary: apply-fixes options (`commands/ba/review.md:525-526`), Conventional Comments mapping table (`commands/ba/review.md:584-588`).
- All seven `agents/review/*.md` follow the same `Output Format` shape — `## Must Address` / `## Consider` / `## Looks Good`, with `If no issues found for a severity level, write "None" under that heading.`
  - `architecture-reviewer.md:33-46`, `security-reviewer.md:36-48`, `simplification-reviewer.md:34-46`, `error-handling-reviewer.md:34-47`, `test-coverage-reviewer.md:34-47`, `deep-module-reviewer.md:44-59`, `complexity-reviewer.md:39-52`.
  - Two reviewers have extra rules to preserve: `deep-module-reviewer.md:59` permits multi-line `Current:` / `Suggested:` / `Impact:` continuation; `complexity-reviewer.md:44, 57` requires every bullet to open with `[cognitive load | change amplification | obscurity]`.
  - `deep-module-reviewer.md:63` carries `**Most deep-module findings land in `Consider`.**` — needs to map to the new ladder (`Most ... land in Medium or Low.`).
- `README.md:168` advertises the current ladder: `**Structured findings** — Must Address / Consider / Looks Good with file:line references and conflict detection across reviewers`. There is no severity-ladder or confidence-rubric section to update — the bundle adds new content.
- `.claude-plugin/plugin.json:3` reports `version: 0.15.0`.
- **Already shipped (do NOT re-land):**
  - **A1 — protected-artifacts guard.** Verified at `commands/ba/review.md:305, 323, 347` and documented in `CLAUDE.md:73`. The new dispatch-template prepend sits alongside the existing A1 paragraph in each of the three templates.
  - **#4 — `--persist` flag.** Per-reviewer files preserve raw reviewer return text verbatim (`commands/ba/review.md:453`); the new prose format flows through unchanged. Only the description text at line 497 needs to track the new consolidation shape.
- Origin research lives at `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md`. Source vocabulary mapping (ce → this plan): P0/P1/P2/P3 → Critical/High/Medium/Low; ce confidence anchors {0,25,50,75,100} copied verbatim; ce dedup on file:line copied verbatim.

## What We're NOT Doing

- **Inline severity tags per finding (replacing section headings).** Deferred until structured output (Shape C). Severity stays section-heading-driven.
- **Full structured JSON output to stdout.** Deferred to C1 (non-interactive modes).
- **Hard confidence gate.** Soft initially — low-confidence findings move to a collapsed `## Suppressed (low confidence)` section, not dropped. Tighten to hard gate after observation runway.
- **Per-reviewer confidence-rubric tuning.** Same rubric for all reviewers initially; calibration is a follow-up if real-world output shows reviewer-specific bias.
- **Evidence-match content check (read-around-line content verification).** Declined separately (B7).
- **Schema versioning.** The internal record schema lives inline in `commands/ba/review.md`. No version field; add when first breaking change is needed.
- **Schema lift-out.** The schema stays inline in `commands/ba/review.md` until a second command consumes it (e.g., C3 — Requirements Completeness check).
- **Calibration diagnostics in user-facing output.** Beyond the warnings header, no per-reviewer accuracy metrics or confidence-distribution charts.
- **Re-landing A1 or `--persist`.** Both already shipped — see Current State.
- **`/ba:review-plan` adoption.** The sibling command's consolidation prose (`README.md:137`) keeps the old vocabulary; updating it is a separate follow-up if desired. **Cross-command consequence acknowledged:** `/ba:review-plan` dispatches the same built-in reviewer agents that Phase 1 updates. After Phase 1, those agents will emit the new four-level ladder + confidence markers when invoked by `/ba:review-plan` too — even though `/ba:review-plan`'s consolidation step still describes the old vocabulary. This is acceptable because `/ba:review-plan` does not run a structured consolidation pipeline (it renders each reviewer's prose under its own heading and lets the user decide); the new format flows through as plain Markdown without breaking anything. The two commands will simply describe their output differently until `/ba:review-plan` is updated. No fix to `/ba:review-plan` is in scope for this bundle.
- **Flag-gating the new behaviour.** Always on. No `--severity-ladder` or `--legacy-format` opt-in.

## Behaviors to Test

A Kent C. Dodds-style checklist of user-observable behaviors this plan must satisfy. Each is concrete enough to write a single test or manual verification step against. Grouped by where in the pipeline the behavior surfaces so implementers can verify the core pipeline first and edge-case handling second.

### Output format — happy path

- [ ] A `/ba:review` run with all seven built-in reviewers emits findings under `## Critical` / `## High` / `## Medium` / `## Low` / `## Looks Good` headings — not the old `## Must Address` / `## Consider`.
- [ ] Each non-`Looks Good` finding line shows `*(confidence: N)*` immediately after `**file:line**`, with `N ∈ {0, 25, 50, 75, 100}`.
- [ ] The consolidation header always shows `Findings: X raw → Y after dedup` (or `Findings: X (no overlap)` when no merging occurred); other warning counters appear only when their value is ≥ 1.
- [ ] `Looks Good` bullets keep the old format `- [Validated aspect]` (no `file:line`, no confidence marker) and never merge with non-`Looks Good` findings at the same line.

### Dedup, merge, promotion

- [ ] When two reviewers flag the same `file:line`, the consolidated output shows one merged finding with both reviewers' bullets attributed underneath — not two separate findings under separate reviewer headings.
- [ ] Confidence on a merged finding is promoted by `+25` per additional reviewer beyond the first, capped at 100. Three reviewers at 75/50/50 yields 100 (`75 + 25 × 2 = 125 → 100`).
- [ ] Two reviewers at 50/50 yields 75 (`50 + 25 × 1`). Three reviewers at 50/50/50 yields 100 (`50 + 25 × 2`). The step size is always `+25`.
- [ ] A reviewer that confidence-rates a finding at 0 does NOT contribute to the promotion math (a `0` means "consider this and suppress"; the formula excludes them from both `max(·)` and the count).
- [ ] In a merged finding, per-reviewer attribution lines show `(own_severity, conf own_conf)` ONLY when the reviewer's own severity OR confidence differs from the merged values. When a reviewer agrees on both, only the reviewer name appears.
- [ ] Single-reviewer findings render without any `(via reviewer-name)` attribution suffix; reviewer identity is recoverable from the Coverage block.

### Soft gate (suppression)

- [ ] A `Critical` finding at confidence 25 (below the Critical-floor of 50) is displayed in the Suppressed (low confidence) collapsed block AND surfaced separately in the consolidation header with `⚠ N Critical findings suppressed by confidence gate`.
- [ ] A `High`/`Medium`/`Low` finding at confidence 50 (below the floor of 75) is displayed in Suppressed without the special Critical surfacing.

### Validator coercions and warnings

- [ ] A reviewer that emits `confidence: 60` (non-canonical) has its finding snapped to the nearest canonical anchor (`50`) and a `(snapped: N findings)` note in the header.
- [ ] A reviewer that emits `confidence: high` (non-numeric) has its finding defaulted to the section severity's floor (`Critical → 50`, `H/M/L → 75`) and counted in the `missing confidence` bucket.
- [ ] A non-`Looks Good` bullet with no `*(confidence: N)*` marker is defaulted to the section severity's floor (not silently to 50, which would be below the H/M/L floor).
- [ ] An external reviewer that emits ONLY the old `## Must Address` / `## Consider` headings has its findings displayed under `## High` / `## Medium` respectively (legacy mapping), and the header shows `(legacy-format detected: N reviewers)`.
- [ ] An external reviewer that emits a MIX of old and new headings has its findings parsed heading-by-heading and the header shows `(mixed-format detected: N reviewers)` — distinct from `legacy_format`.
- [ ] A reviewer cites a file not in `CHANGED_FILES` but present in the repo (e.g., complexity-reviewer follows imports one hop, or architecture-reviewer traces an import chain): the finding is kept with `(off-diff)` annotation. The annotation is informational, not a warning.
- [ ] A reviewer cites a file that does NOT exist in the repo: the finding is dropped and counted in the `(dropped: N findings)` warning.

### Downstream consumers (Step 5)

- [ ] Step 5 menu reads `Apply Critical + High + Medium items` / `Apply Critical + High only` (the new ladder vocabulary). No mention of `Must Address` or `Consider`.
- [ ] Step 5 MR/PR inline-comment posting maps `Critical → issue (blocking):`, `High → issue:`, `Medium → suggestion (non-blocking):`, `Low → nitpick (non-blocking):`, `Looks Good → praise:` per the new Conventional Comments table.

### Persistence (`--persist`)

- [ ] Per-reviewer files under `docs/reviews/<TIMESTAMP>-<SCOPE_REF>/` preserve the reviewer's raw output verbatim — new format readable as standalone Markdown.
- [ ] `summary.md` under `docs/reviews/<TIMESTAMP>-<SCOPE_REF>/` shows the consolidated output AND a `## Validator Warnings` section listing any dropped, coerced, or suppressed findings with reviewer attribution.

### Per-reviewer structural rules

- [ ] A complexity-reviewer finding emits `- **file:line** *(confidence: N)* — [cognitive load] ...`; the `[lens]` tag is preserved inside body and the bullet still parses.
- [ ] A deep-module-reviewer finding may emit `Current:` / `Suggested:` / `Impact:` continuation lines; the parser treats them as body continuation of the parent bullet, not separate findings.
- [ ] A reviewer that returns all `## Critical\nNone` / `## High\nNone` ... emits zero records to consolidation; the parser does not create a record with `body = "None"`.

## Proposed Solution

A single coordinated change to `commands/ba/review.md` (Step 3 dispatch prepend, Step 4 consolidation pipeline, Step 4.5 `summary.md` template, Step 5 menus and CC table), all seven `agents/review/*.md` output-format sections, `README.md` (vocabulary + new severity/confidence sections), and `.claude-plugin/plugin.json` (version bump). The change is **always-on; no flag gating.**

### Severity ladder (B4)

The user-visible vocabulary becomes a 4-level ladder + a positive-observations bucket.

| Section heading | Maps to ce's | Meaning |
|---|---|---|
| `## Critical` | P0 | Correctness/security/production-breaking; must fix before merge |
| `## High` | P1 | Significant defect or risk; strongly recommended before merge |
| `## Medium` | P2 | Clear improvement, not blocking |
| `## Low` | P3 | Nit / style / micro-improvement |
| `## Looks Good` | — | Positive observations (orthogonal to severity ladder) |

Defaults: a finding under no recognised section heading is treated as `Low`; the header surfaces the count.

**Legacy mapping** (the bundle's biggest backwards-compat surface): if a reviewer's output contains `## Must Address` or `## Consider` and **no** new-ladder headings, treat the entire output as legacy and map heading-by-heading:

| Old heading | New heading |
|---|---|
| `## Must Address` | `## High` |
| `## Consider` | `## Medium` |
| `## Looks Good` | `## Looks Good` |

Two distinct conditions, two distinct counters:

- **Pure legacy** (all headings are `## Must Address` / `## Consider` / `## Looks Good`, no new-ladder headings present): the reviewer is wholly non-compliant. Increment `legacy_format`; header shows `(legacy-format detected: N reviewers)`.
- **Mixed format** (output has at least one legacy heading AND at least one new-ladder heading): the reviewer is partially compliant. Increment `mixed_format`; header shows `(mixed-format detected: N reviewers)`. Parsing is heading-by-heading either way — only the old headings get mapped.

Splitting the two avoids misrepresenting a partially-compliant reviewer as "legacy" and gives a clearer signal for follow-up updates.

### Per-finding confidence (B5)

Each non-`Looks Good` bullet now reads:

```
- **<path>:<line>** *(confidence: N)* — <body>
```

`N` is drawn from discrete anchors **{0, 25, 50, 75, 100}**. The confidence marker placement is **after the `**file:line**` marker and before the `— ` separator** — *this diverges from the issue body's "end of finding body" wording*. Rationale: the body of a complexity-reviewer bullet already begins with `[cognitive load | change amplification | obscurity]`; trailing the confidence marker after a multi-line body (allowed for deep-module-reviewer) makes parsing fragile. Placement immediately after `**file:line**` is unambiguous and trivially extractable. This decision is recorded as a deliberate plan-level override in **Convention Compliance**.

**Rubric (added to dispatch prepend AND to each agent's Output Format section):**

| Anchor | Meaning |
|---|---|
| `100` | Certain. The finding is unambiguous; identical code anywhere would draw the same flag. |
| `75` | High confidence; minor context risk could change the call. The default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. Hedge when you can see how the author might be right. |
| `25` | Speculative; only flag when the cost of missing it is high (e.g., a possible security issue you can't fully verify). |
| `0` | Suppress — record the consideration but do not surface to the user. Counts as "considered" in raw output. |

**Soft gate at consolidation:**
- `Critical` retained at `confidence ≥ 50`
- `High`, `Medium`, `Low` retained at `confidence ≥ 75`
- Below threshold → move to `## Suppressed (low confidence)`, NOT dropped.

**Default when a non-`Looks Good` bullet has no `*(confidence: N)*` marker:** match the missing marker's section severity against its floor — `Critical` defaults to `50` (at-floor), `High` / `Medium` / `Low` default to `75` (at-floor). This prevents a built-in reviewer that omits a marker during the transition window from being silently suppressed by the soft gate. Header counter `(N findings missing confidence → defaulted)` fires when N ≥ 1, and the warning text breaks the count down by severity so the user can see which findings were defaulted to which value.

**Non-canonical numeric values** (e.g., `confidence: 60`, `confidence: 80`): snap to nearest canonical anchor; header counter `(snapped: N findings)` when N ≥ 1. Ties (e.g., `confidence: 62`) snap **up**.

**Non-numeric values** (e.g., `confidence: high`): default to the section severity's floor (same rule as missing markers) and count in the same `missing confidence` bucket.

### Fingerprint dedup (B6)

- **Fingerprint:** exact `<path>:<line>` match across reviewers.
- **Grouping:** records sharing a fingerprint form a merge group. `Looks Good` records are excluded — they only merge among themselves.
- **Merge rules** (when group size ≥ 2):
  - **Severity:** `max(group)` using rank `Critical > High > Medium > Low`.
  - **Confidence:** `max(confidence_i for i in group where confidence_i > 0) + 25 × (count of contributors with confidence_i > 0 − 1)`, capped at 100. Each "anchor step" is `+25` — the distance between adjacent anchors in the discrete set `{0, 25, 50, 75, 100}`. A reviewer voting `0` is excluded from both the `max(·)` and the count: a zero records the consideration but does not contribute to corroboration, because `0` means "consider but suppress" rather than "weak agreement."
  - **Prose:** preserve every reviewer's bullet under one merged finding with per-reviewer attribution (template below).
- **Single-reviewer findings** pass through with no merge layout and no attribution suffix — the Coverage block already lists which reviewers ran, and per-line attribution adds no signal when there is only one source. Attribution is reserved for merged (≥2 reviewer) findings.
- **Consolidation header includes a dedup stat:** `Findings: 32 raw → 19 after dedup` (or `Findings: 32 (no overlap)` when raw equals after-dedup).
- **`⚠ Conflicting` annotation is REMOVED.** The merge layout's per-reviewer attribution IS the agreement/disagreement signal — readers see two reviewers' framings side-by-side at the same `file:line`.

**Merged finding render template:**

Per-reviewer attribution annotations are shown **only when the reviewer's own severity or confidence differs from the merged values**. When all contributors agree (same severity, same confidence as the merged record), the attribution line omits the `(own severity, own conf)` parenthetical — only the reviewer name remains. This keeps the dense `(own severity, own conf)` metadata reserved for cases where it carries real information (divergence), and prevents readers from reconciling two confidence numbers and two severities on every merged finding.

Example with disagreement (own severity / confidence differ from merged):

```markdown
### Critical *(confidence: 100, merged from 3 reviewers)*
- **src/auth.ts:42** — SQL injection via untrusted user input.
  - *security-reviewer (Critical, conf 75):* User input from `req.body.email` is concatenated into the raw query at line 42. Suggested fix: parameterise with `db.query("... WHERE email = $1", [email])`.
  - *architecture-reviewer (Medium, conf 50):* This line also couples the controller to the persistence layer.
  - *deep-module-reviewer (High, conf 50):* The query construction is a shallow leak from the persistence module.
```

Example with agreement (all reviewers emit the merged severity at the merged confidence):

```markdown
### High *(confidence: 100, merged from 2 reviewers)*
- **src/utils/parse.ts:88** — Unbounded recursion on malformed input.
  - *error-handling-reviewer:* The recursion base case fires only on `null`; non-null malformed input loops indefinitely.
  - *complexity-reviewer:* [obscurity] Recursion depth is not bounded; no comment explains why this is safe.
```

The merged-finding **summary line** is the highest-severity reviewer's body, condensed to one sentence. Per-reviewer expansions sit underneath. The displayed severity heading reflects the merged severity; reviewers whose own severity matches it have no parenthetical, reviewers who diverge keep `(own severity, own conf)` so readers see the disagreement directly.

### Validator pass (C2 — Shape B: light structuring)

The orchestrator runs an internal `parse → validate → group → merge → gate → render` pipeline. Records are internal to consolidation; user-facing output remains prose. **The user sees prose; the orchestrator's internals operate on records.**

**Pipeline ordering** (deliberate; spec-flow Critical Q2):

1. **Parse** each reviewer's raw return text into records `(severity, file, line, confidence, body, reviewer_name)`.
2. **Validate** each record; coerce-with-warning where recoverable; drop only when no `file:line` is recoverable at all.
3. **Group by `file:line`** to form merge groups.
4. **Merge** each group (severity = max; confidence = max + promotion math; prose = preserved per-reviewer).
5. **Apply soft gate**: compare the merged record's *merged confidence* against the *merged severity's* floor. Survivors go to the main render; below-floor go to `## Suppressed (low confidence)`.
6. **Render** as prose with severity sections, merged-finding template above, and the suppressed section.

The dedup-then-gate ordering (group + merge **before** gate) is what makes the `+25 per extra reviewer` promotion math useful — corroboration can lift a finding past the floor.

**Parser grammar (permissive, documented in dispatch prepend):**

| Token | Rule |
|---|---|
| Severity section | `^## ` followed by a recognised label (case-insensitive): `Critical`, `High`, `Medium`, `Low`, `Looks Good`, `Must Address` (legacy), `Consider` (legacy). Trailing text after the label is allowed (`## Critical Issues` → matches `Critical`). |
| Bullet anchor | `^- \*\*<path>:<line>\*\*` where `path` is non-empty and `line` is a positive integer. The **first** bullet-position bold marker matching `path:line` shape is the anchor; subsequent bold markers are body content. |
| Confidence marker | After the anchor, an optional `\*\(confidence:\s*<N>\s*\)\*` (case-insensitive on `confidence`). Captures `N` as an integer. |
| Em-dash separator | One of `—`, `–`, `--`, optionally surrounded by whitespace. |
| Body | Everything after the separator until the next bullet (`^- \*\*`) or next heading (`^## `). Continuation lines (non-bullet, non-heading) are part of body. |
| `None` token | A heading whose only content is the literal `None` (case-insensitive, optionally in `_None_` or `*None*`) emits zero records under that heading. No warning. |
| `Looks Good` bullet | Format stays `- [Validated aspect]` — no `file:line`, no confidence. Parser tags severity = `Looks Good`. This is a **separate bucket**, not a fifth rung on the Critical/High/Medium/Low ladder — the confidence floor does not apply, dedup does not run across `Looks Good` and other severities, and the merge/promotion math is irrelevant. Treat `Looks Good` as an orthogonal accumulator. |

**Validator checks per record:**

| Check | Action on failure |
|---|---|
| Severity ∈ {Critical, High, Medium, Low, Looks Good} | Default to `Low`; increment shared `coerced` counter. |
| File path non-empty | Drop record; increment `dropped (no file:line)` counter. |
| Line is positive integer | Drop record; same counter as above. |
| Confidence ∈ {0, 25, 50, 75, 100} | Snap to nearest canonical anchor; non-numeric or missing → default to the section severity's floor (`Critical → 50`, `H/M/L → 75`); increment `snapped` or `confidence-default` counter. |
| Body non-empty | Coerce body to `(no description)`; increment shared `coerced` counter. |
| File exists somewhere in the repo (`git ls-files` check) | Drop record; increment `dropped (file not in repo)` counter. |
| File present in `CHANGED_FILES` | If absent, keep record but append `(off-diff)` to the body; increment `off-diff` counter. |

The `off-diff` annotation is **informational, not a warning** — it applies to any reviewer that intentionally cites a file outside `CHANGED_FILES` (e.g., complexity-reviewer's documented one-hop traversal at `agents/review/complexity-reviewer.md:34`, or an architecture-reviewer tracing an import path to explain a coupling smell). Kept rather than dropped because the citation is structurally useful; annotated so the reader can see at a glance that the file is off-diff and is being referenced for context. Severity and confidence are otherwise unchanged. The `severity-default` and `coerced empty body` failures share a single `coerced` counter because both fire rarely and signal the same thing — the reviewer's output needed light salvaging — so granular counters would be noise.

**Consolidation header template** (visible at the top of Step 4 output):

```markdown
## Code Review Summary

Scope: <scope description from Step 1d>
Reviewers: <N> ran, <N> succeeded, <N> failed
Findings: <raw_count> raw → <displayed_count> after dedup
<conditional warnings each on its own line, omitted when zero>
⚠ <K> Critical findings suppressed by confidence gate — see Suppressed section
⚠ Defaults applied: <C> missing confidence (→ section floor: Critical=50, H/M/L=75)
⚠ Snapped: <P> findings to nearest confidence anchor
⚠ Coerced: <X> findings (severity defaulted to Low, or body coerced to "(no description)")
⚠ Dropped: <D> findings (no file:line) + <F> findings (file not in repo)
⚠ Off-diff: <O> findings reference files outside the diff (informational, not a warning)
⚠ Legacy-format detected: <L> reviewers
⚠ Mixed-format detected: <M> reviewers
```

When `raw_count == displayed_count`, render `Findings: <count> (no overlap)` instead of `<count> raw → <count> after dedup`. All `⚠ ...` lines omit when their counter is 0.

### Step 5 downstream consumers

The new ladder forces updates to the apply-fixes menu and the Conventional Comments mapping:

**Apply-fixes options** (`commands/ba/review.md:525-526`):

| Option | New label | Applies to |
|---|---|---|
| 1 | Apply all fixes | Critical + High + Medium (Low excluded — nit/style is not auto-applied) |
| 2 | Apply Critical + High only | Critical + High (was "Apply must-address only") |
| 3 | Review one by one | (unchanged behaviour) |
| 4 | Done | (unchanged) |

**Conventional Comments mapping** (`commands/ba/review.md:584-588`) becomes:

| Internal severity | CC format |
|---|---|
| Critical | `issue (blocking): <subject>` |
| High | `issue: <subject>` |
| Medium | `suggestion (non-blocking): <subject>` |
| Low | `nitpick (non-blocking): <subject>` |
| Looks Good | `praise: <subject>` |

The optional CC labels (`question:`, `thought:`, `todo:`) at `commands/ba/review.md:592-595` remain unchanged.

### Suppressed section layout

```markdown
<details>
<summary><strong>Suppressed (low confidence) — <N> findings</strong></summary>

#### Critical *(suppressed)*
- **file:line** *(confidence: 25)* — <body>

#### High *(suppressed)*
- **file:line** *(confidence: 50)* — <body>

#### Medium *(suppressed)*
- ...

#### Low *(suppressed)*
- ...

</details>
```

Heading-level rationale: the consolidation header is `## Code Review Summary` (H2); the main severity sections are `### Critical` / `### High` / ... (H3). GitHub does not render Markdown headings inside `<summary>`, so the wrapper uses `<strong>` bold instead — same visual weight without leaving a stray literal `##`. The inner suppressed sub-headings are H4 (`####`) so they nest one level deeper than the main sections, preserving hierarchy: H2 summary → H3 main severities → H4 suppressed severities.

The HTML `<details>` wrapper renders collapsed in GitHub/GitLab and in most Markdown previewers; raw Markdown readers still see the content. Inner severity sub-headings preserve scannability. Merged findings that fall to suppressed keep their merge layout.

### Persist (`--persist`) interaction

Per-reviewer files at `docs/reviews/<TIMESTAMP>-<SCOPE_REF>/<reviewer>.md` are unchanged in mechanism — they preserve raw reviewer return text verbatim (`commands/ba/review.md:453`). The new format flows through as Markdown.

`summary.md` updates:

1. The Step 4 output block (currently at `commands/ba/review.md:497`) is replaced verbatim by the new consolidation render.
2. A new `## Validator Warnings` section is appended **after** Consolidated Findings:

```markdown
## Validator Warnings

The internal validator coerced or dropped the following records during consolidation. Per-reviewer files contain the raw output for reference.

- *security-reviewer*: dropped 1 finding (no file:line in `- **** —`).
- *architecture-reviewer*: snapped 2 confidence values to nearest anchor (`60 → 50`, `80 → 75`).
- *complexity-reviewer*: 3 findings annotated `(off-diff)` — see `complexity-reviewer.md` for raw context.
```

When the validator produced zero warnings, omit the section. The note at the top of `summary.md` clarifies that per-reviewer files may include findings that were dropped, suppressed, or merged in the consolidated view.

## Technical Approach

### Architecture

This is **prompt-engineering and orchestration logic, not code.** Every change lives in Markdown — either prompt text for subagents (`agents/review/*.md`) or prose instructions for the orchestrator (`commands/ba/review.md`). The parser, validator, dedup, and render pipeline are described as a sequence of natural-language instructions the orchestrating LLM follows when running consolidation — there is no shell script, no helper file, no new dependency. The phases are ordered so each can be tested by running `/ba:review` against a small diff and inspecting the output.

The single non-Markdown change is `.claude-plugin/plugin.json` (version bump).

### Alternative Approaches Considered

- **Lift the schema into a separate file** (e.g., `schemas/finding.md`). Rejected: only one command consumes it today (`/ba:review`). Lift when a second command (likely C3 — Requirements Completeness) joins. CLAUDE.md's "Don't add features beyond what the task requires" reinforces this.
- **Hard confidence gate (drop sub-floor findings).** Rejected per the issue: soft gate gives observation runway before tightening; users can still scan the suppressed section.
- **Keep `⚠ Conflicting` alongside dedup.** Rejected: merge layout makes per-reviewer divergence directly visible; an explicit annotation needs a heuristic for "materially different advice" that the prose-output era can't deliver deterministically.
- **Place `*(confidence: N)*` at the end of the finding body (per the issue body's literal wording).** Rejected for parsing fragility — deep-module-reviewer's multi-line bullets and complexity-reviewer's lens-tagged bodies make trailing markers ambiguous. Placement immediately after `**file:line**` is unambiguous. This is a deliberate plan-level override of the issue's "end of body" phrasing — see Convention Compliance.
- **Flag-gate the new behaviour (`--severity-ladder`).** Rejected: every reviewer subagent runs with the dispatch template, so a flag would require maintaining two parallel templates. The issue says always-on.

## Implementation Phases

> **Phase ordering rationale:** Phase 1 updates the reviewer agents in isolation (they can be tested standalone via direct `Task` dispatch with a sample diff). Phase 2 wires the dispatch prepend so the orchestrator broadcasts the new format uniformly to all reviewers. Phase 3 implements the consolidation pipeline — the heaviest change, isolated from agent edits so failures point at orchestration logic, not reviewer prompts. Phase 4 cleans up downstream consumers. Phase 5 ships docs and version.

---

### Phase 1: Update the seven reviewer Output Format sections

#### Changes Required

Each of the seven `agents/review/*.md` files gets its `Output Format` section replaced. Common new template:

```markdown
## Output Format

Return findings using EXACTLY this structure:

## Critical
- **[file_path:line_number]** *(confidence: N)* — [Issue description]. [Why this matters for <dimension>]. Suggested fix: [specific, actionable suggestion]

## High
- **[file_path:line_number]** *(confidence: N)* — [Issue description]. [Why this matters]. Suggested fix: [specific, actionable suggestion]

## Medium
- **[file_path:line_number]** *(confidence: N)* — [Issue description]. [Why this could improve <dimension>].

## Low
- **[file_path:line_number]** *(confidence: N)* — [Nit / style / micro-improvement]. [Why].

## Looks Good
- [Aspect of <dimension> that is well-implemented]

If no issues found for a severity level, write "None" under that heading.

### Severity ladder

- **Critical** — Correctness, security, production-breaking, data-loss risk. Must fix before merge. Rare.
- **High** — Significant defect or risk. Strongly recommended before merge.
- **Medium** — Clear improvement, not blocking.
- **Low** — Nit, style, micro-improvement.
- **Looks Good** — Positive observation (orthogonal to severity).

### Confidence anchors (required on every Critical/High/Medium/Low bullet)

- **100** — Certain. Identical code anywhere would draw the same flag.
- **75** — High confidence; minor context risk. Default for clearly-applicable findings.
- **50** — Moderate; could plausibly be a false positive.
- **25** — Speculative; only flag when missing it would be costly.
- **0** — Suppress. Record the consideration; do not surface.

Confidence sits between `**file:line**` and `— body`. Do not place it elsewhere.

> **Source of truth for the rubric:** `commands/ba/review.md` §4 (the consolidation pipeline). The severity ladder and confidence anchors are duplicated here for defence-in-depth — a reviewer reading only its own agent file still sees the rubric — but any change to the ladder, the anchor set, the floors, or the merge math MUST be made in `commands/ba/review.md` first and propagated here verbatim. If you find this file's rubric diverging from `commands/ba/review.md`, treat `commands/ba/review.md` as authoritative.
```

**Per-reviewer body wording** substitutes `<dimension>` with that reviewer's focus (architecture, security, simplification, error handling, test coverage, deep-module design, complexity). The italicised body text on each bullet is the existing reviewer-specific phrasing — preserve it.

**Per-reviewer special rules to preserve:**

- **`agents/review/architecture-reviewer.md:53`** — Principles bullet `**Severity matters.** Only "Must Address" issues that would cause real problems if shipped. "Consider" is for improvements.` → rewrite to `**Severity matters.** Reserve **Critical** for correctness/security failures, **High** for significant defects. **Medium** is for improvements; **Low** for nits.`
- **`agents/review/deep-module-reviewer.md:59`** — Keep the multi-line bullet permission: `Multi-line bullets are permitted — include `Current:` / `Suggested:` / `Impact:` excerpts under a bullet only when the diff context is non-obvious.` Append: `The parser treats continuation lines as body of the parent bullet.`
- **`agents/review/deep-module-reviewer.md:63`** — `**Most deep-module findings land in `Consider`.**` → `**Most deep-module findings land in `Medium` or `Low`.**` Update the body so `Consider` and `Must Address` references map to the new ladder consistently.
- **`agents/review/complexity-reviewer.md:44, 47`** — Keep the inline `[cognitive load | change amplification | obscurity]` lens-tag rule. The tag goes inside the body, immediately after the `— ` separator: `- **file:line** *(confidence: N)* — [cognitive load] Issue description...`. The lens tag is informational prose — not parsed as a separate field.
- **`agents/review/complexity-reviewer.md:57`** — Principles bullet `**Tag the lens.** Every `Must Address` and `Consider` bullet must open with one of ...` → `**Tag the lens.** Every `Critical`, `High`, `Medium`, and `Low` bullet must open with one of `[cognitive load]` / `[change amplification]` / `[obscurity]` immediately after the em-dash, so the consolidation step can group complexity findings cleanly.`

#### Success Criteria

##### Automated:
- [x] `grep -L "## Critical" agents/review/*.md` returns no files (every reviewer file now contains the new heading).
- [x] `grep -L "*(confidence:" agents/review/*.md` returns no files.
- [x] `grep -l "## Must Address" agents/review/*.md` returns no files (old headings fully removed from reviewer specs).
- [x] `grep -l "\[cognitive load\]" agents/review/complexity-reviewer.md` still matches (lens tag preserved).
- [x] `grep -l "Current:\|Suggested:\|Impact:" agents/review/deep-module-reviewer.md` still matches (multi-line continuation rule preserved).
- [x] `grep -L "Source of truth for the rubric" agents/review/*.md` returns no files (every agent file points to `commands/ba/review.md` as authoritative).

##### Manual:
- [ ] Run `Task architecture-reviewer("Review these code changes for architecture. Diff: <small sample diff>")` directly (no orchestrator). Confirm the agent's output uses the new ladder + confidence markers.
- [ ] Repeat for one Ousterhout reviewer (`deep-module-reviewer` or `complexity-reviewer`) — confirm the lens tag / multi-line bullets still render under the new format.

> **Phase gate:** All six `grep` checks must pass. Pause for manual verification on at least two reviewer agents before Phase 2.

---

### Phase 2: Add dispatch-template prepend in `commands/ba/review.md`

#### Changes Required

The dispatch templates at `commands/ba/review.md:301-358` get a new prepend block — the severity ladder, confidence rubric, parser-format example, and a note about the `## Suppressed` section. The prepend sits **immediately above** the existing Protected-Artifacts paragraph in each of the three templates.

**File**: `commands/ba/review.md` (insert before line 305, line 323, line 347 — three identical insertions)

```markdown
**Severity ladder and confidence.** Return findings under the four-level ladder + `Looks Good`. Each non-`Looks Good` bullet must include a confidence anchor between the file:line marker and the body.

Bullet format (exact):

`- **<path>:<line>** *(confidence: N)* — <body>`

where `N ∈ {0, 25, 50, 75, 100}`.

| Heading | Meaning |
|---|---|
| `## Critical` | Correctness, security, production-breaking. Must fix before merge. |
| `## High` | Significant defect or risk. Strongly recommended. |
| `## Medium` | Clear improvement, not blocking. |
| `## Low` | Nit, style, micro-improvement. |
| `## Looks Good` | Positive observation. No file:line, no confidence. Format: `- [Validated aspect]`. |

| Confidence | Meaning |
|---|---|
| `100` | Certain. |
| `75` | High; minor context risk. Default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. |
| `25` | Speculative; flag only when missing it would be costly. |
| `0` | Suppress. Records the consideration; will not be displayed. |

If no issues at a severity, write `None` under that heading. Do not invent placeholder bullets.
```

The closing instruction sentences at `commands/ba/review.md:317, 334, 358` get updated:

- Was: `Return findings in the standard format: Must Address / Consider / Looks Good with file:line references.`
- Becomes: `Return findings in the standard format described above (Critical / High / Medium / Low / Looks Good with confidence anchors and file:line references).`

The Protected-Artifacts paragraph is untouched (it sits between the new prepend and the closing sentence).

#### Success Criteria

##### Automated:
- [x] `grep -c "Severity ladder and confidence" commands/ba/review.md` returns `3` (one per dispatch template).
- [x] `grep -c "Must Address / Consider / Looks Good with file:line" commands/ba/review.md` returns `0` (old closing sentences replaced).
- [x] `grep -c "Protected artifacts" commands/ba/review.md` still returns `3` (A1 guard intact).

##### Manual:
- [ ] Dry-run `/ba:review --local` against a small staged change. Inspect each reviewer's raw return text — confirm the new format flows through.
- [ ] Verify the three dispatch templates remain visually parallel (same prepend wording, same order of blocks).

> **Phase gate:** All three `grep` checks pass. Pause for manual verification of the dry-run output before Phase 3.

---

### Phase 3: Replace Step 4 consolidation with the parse → validate → dedup → render pipeline

#### Changes Required

**File**: `commands/ba/review.md` — replace the entire Step 4 (lines 366-401) with the new pipeline. The new Step 4 reads:

```markdown
## Step 4: Consolidate & Present Findings

After all reviewers complete, the orchestrator runs a five-step internal pipeline. Reviewers emit prose; the orchestrator extracts records; the user sees re-rendered prose. **The user-visible output is prose. The records are internal to consolidation.**

### 4a. Parse each reviewer's raw return text

For each reviewer's return text, extract records using this grammar (permissive):

| Token | Rule |
|---|---|
| Severity section | `^## ` followed by a recognised label (case-insensitive): `Critical`, `High`, `Medium`, `Low`, `Looks Good`. Trailing text after the label is allowed (`## Critical Issues` matches `Critical`). |
| Legacy section | `^## ` followed by `Must Address` or `Consider` — map `Must Address → High`, `Consider → Medium`. A reviewer whose output contains **only** legacy headings (no new-ladder headings) increments `legacy_format`. A reviewer whose output mixes legacy headings with at least one new-ladder heading increments `mixed_format` instead. The two counters reflect distinct conditions: `legacy_format` flags reviewers needing wholesale updates; `mixed_format` flags reviewers that are partially compliant. |
| Bullet anchor | `^- \*\*<path>:<line>\*\*` — `path` non-empty; `line` is a positive integer. First `**…**` matching `path:line` shape on the line is the anchor; subsequent bold markers are body content. |
| Confidence marker | After the anchor, optional `\*\(confidence:\s*<N>\s*\)\*` (case-insensitive on `confidence`). |
| Em-dash separator | `—`, `–`, or `--`, optionally surrounded by whitespace. |
| Body | Everything after the separator until the next bullet (`^- \*\*`) or next heading (`^## `). Non-bullet, non-heading lines are body continuation of the parent bullet. |
| `None` token | A heading whose only content is the literal `None` (case-insensitive, possibly `_None_` / `*None*`) emits zero records under that heading. No warning. |
| `Looks Good` bullet | Format stays `- [Validated aspect]`. No file:line, no confidence. Record severity = `Looks Good`; skip anchor/confidence extraction. **Separate bucket — not a rung on the Critical/H/M/L ladder.** Confidence floor does not apply; dedup does not cross `Looks Good` and other severities; merge/promotion math is irrelevant. |

Produce a list of records `(severity, file, line, confidence, body, reviewer_name)` per reviewer.

### 4b. Validate each record

For each non-`Looks Good` record, run these checks. Increment the named counter on failure.

| Check | Action on failure | Counter |
|---|---|---|
| Severity ∈ {Critical, High, Medium, Low} | Default to `Low` | `coerced` (shared) |
| File path non-empty AND line is positive integer | Drop record | `dropped_no_fileline` |
| Confidence ∈ {0, 25, 50, 75, 100} | If numeric: snap to nearest anchor (ties go up). If non-numeric or missing: default to the section severity's floor (`Critical → 50`, `H/M/L → 75`). | `snapped` or `confidence_default` |
| Body non-empty | Coerce body to `(no description)` | `coerced` (shared) |
| File exists somewhere in the repo (`git ls-files \| grep -Fx "<path>"`) | Drop record | `dropped_file_not_in_repo` |
| File present in `CHANGED_FILES` from Step 1 | If absent, keep record; append `(off-diff)` to body | `off_diff` (informational, not a warning) |

The `coerced` counter is shared between severity-default and empty-body coercions — both signal "the reviewer's output needed light salvaging" and both fire rarely, so a single counter is enough signal without inflating the warning list. The `off_diff` counter is informational: an off-diff citation is not an error. Any reviewer that intentionally traces beyond `CHANGED_FILES` (complexity-reviewer's one-hop traversal, an architecture-reviewer following an import chain, etc.) receives the annotation so the reader can see at a glance that the cited file is off-diff and referenced for context.

`Looks Good` records skip every check above. They proceed only with severity = `Looks Good` (a separate bucket, not a rung on the Critical/H/M/L ladder — confidence floor does not apply) and a non-empty body.

### 4c. Group records by `file:line` fingerprint

Group all non-`Looks Good` records by exact `<file>:<line>` match. `Looks Good` records are grouped separately — they only merge among themselves.

### 4d. Merge each group

For groups of size ≥ 2:

- **Severity** = `max(group)` using rank `Critical (4) > High (3) > Medium (2) > Low (1)`.
- **Confidence** = `max(c_i for i where c_i > 0) + 25 × (count(c_i > 0) − 1)`, capped at 100. The anchor step size is **25** (the gap between adjacent anchors in `{0, 25, 50, 75, 100}`). Reviewers with `c_i = 0` are excluded from both the `max(·)` and the count — a zero vote records the consideration in attribution but does not corroborate the finding, because `0` means "consider but suppress." Worked examples: two reviewers at 50/50 → `50 + 25 × 1 = 75`; three reviewers at 50/50/50 → `50 + 25 × 2 = 100`; three reviewers at 75/50/50 → `75 + 25 × 2 = 125 → 100` (capped); two reviewers at 75/0 → `75 + 25 × 0 = 75` (the zero contributes nothing).
- **Body** = render the merged-finding template (see 4f). Keep every reviewer's bullet with attribution.

For groups of size 1, pass through with no attribution suffix — the single reviewer's identity is already discoverable from the Coverage block, and the omission keeps single-reviewer findings to one tight line. Reviewer attribution is reserved for merged findings where it carries real information.

### 4e. Apply soft gate

Compare each merged record's *merged confidence* against the *merged severity*'s floor:

| Merged severity | Confidence floor |
|---|---|
| Critical | ≥ 50 |
| High / Medium / Low | ≥ 75 |

Below-floor records move to the `## Suppressed (low confidence)` bucket. Above-floor records render in the main severity sections.

When a `Critical` finding falls below its floor, increment `critical_suppressed`. This counter is surfaced in the consolidation header so high-stakes findings are not buried.

### 4f. Render

Render the consolidated output:

\`\`\`markdown
## Code Review Summary

Scope: <scope description from Step 1d>
Reviewers: <N> ran, <N> succeeded, <N> failed
Findings: <raw_count> raw → <displayed_count> after dedup
<conditional warning lines — see header template below>

### Critical
- **<file>:<line>** *(confidence: <N>)* — <body or merged template>

### High
- ...

### Medium
- ...

### Low
- ...

### Looks Good
- <validated aspect>

<details>
<summary><strong>Suppressed (low confidence) — <K> findings</strong></summary>

#### Critical *(suppressed)*
- **<file>:<line>** *(confidence: <N>)* — <body>

#### High *(suppressed)*
- ...
</details>

(Heading levels: outer summary uses `<strong>` because GitHub does not render Markdown headings inside `<summary>`; the inner severity sub-headings use H4 / `####` so they nest one level deeper than the main `### Critical` / `### High` / etc. sections above.)

## Coverage

- Files reviewed: <list>
- Files skipped (binary): <list, if any>
- Reviewers that failed: <list, if any>
\`\`\`

**Header warning lines** — each `⚠ ...` line is emitted only when its counter is ≥ 1:

\`\`\`
⚠ <K> Critical findings suppressed by confidence gate — see Suppressed section
⚠ Defaults applied: <C> missing confidence (→ section floor: Critical=50, H/M/L=75)
⚠ Snapped: <P> findings to nearest confidence anchor
⚠ Coerced: <X> findings (severity defaulted to Low, or body coerced to "(no description)")
⚠ Dropped: <D> findings (no file:line) + <F> findings (file not in repo)
⚠ Off-diff: <O> findings reference files outside the diff (informational, not a warning)
⚠ Legacy-format detected: <L> reviewers
⚠ Mixed-format detected: <M> reviewers
\`\`\`

When `raw_count == displayed_count`, render `Findings: <count> (no overlap)` instead of `<count> raw → <count> after dedup`.

**Merged-finding template:**

Show `(own_severity, conf own_conf)` only when the reviewer's own severity OR confidence differs from the merged values. When a reviewer agrees on both, the attribution line drops the parenthetical entirely:

\`\`\`markdown
- **<file>:<line>** *(confidence: <merged_conf>, merged from <K> reviewers)* — <highest-severity reviewer's one-sentence summary>
  - *<reviewer-1> (<own_severity>, conf <own_conf>):* <full body>   ← shown only when diverging from merged
  - *<reviewer-2>:* <full body>                                       ← own_severity AND own_conf match merged
  - ...
\`\`\`

This reserves the dense `(severity, conf)` metadata for cases where divergence matters — typically the most useful signal in a merged finding.

For single-reviewer findings (no merge layout), pass through without attribution:

\`\`\`markdown
- **<file>:<line>** *(confidence: <N>)* — <body>
\`\`\`

The reviewer identity is recoverable from the Coverage block; per-line attribution is reserved for merged findings.
```

The Coverage block (currently lines 396-401) is preserved as-is — files reviewed / binary skips / reviewer failures.

The `⚠ Conflicting` annotation logic at line 395 is **removed entirely**. No replacement.

#### Success Criteria

##### Automated:
- [x] `grep -c "## Step 4: Consolidate" commands/ba/review.md` returns `1` (no duplicate Step 4).
- [x] `grep -c "⚠ Conflicting" commands/ba/review.md` returns `0` (annotation fully removed).
- [x] `grep -c "parse → validate" commands/ba/review.md` returns `1` (pipeline named).
- [x] `grep -c "## Suppressed" commands/ba/review.md` returns `≥1` (suppressed section present).
- [x] `grep -c "merged from" commands/ba/review.md` returns `1` (merged-finding template present).

##### Manual:
- [ ] Run `/ba:review --local` against a real diff with at least 4 reviewers selected. Inspect the consolidated output: confirm the new headers, merged-finding layout when multiple reviewers flag the same line, suppressed section behaviour when a finding lands below floor, and at least one warning counter firing (force this by including a non-canonical confidence in a test reviewer's prompt).
- [ ] Force a legacy-format external reviewer (e.g., manually craft an old-format output and pipe it through Step 4 in a dry-run): confirm `## Must Address` → `## High`, header counter `legacy-format detected` fires.
- [ ] Confirm `Looks Good` bullets retain the old `- [Validated aspect]` form and do not pick up a confidence marker.

> **Phase gate:** All five `grep` checks pass. Manual verification covers at least one real diff with multi-reviewer overlap, one synthetic legacy-format injection, and one `Looks Good`-only reviewer return.

---

### Phase 4: Update Step 5 downstream consumers and `summary.md` template

#### Changes Required

**File**: `commands/ba/review.md` — three localised edits.

**Edit 1: Step 4.5d `summary.md` template** (line 497):

- Was: `[The full Step 4 output verbatim — every reviewer's Must Address / Consider / Looks Good blocks, with conflict annotations.]`
- Becomes: `[The full Step 4 output verbatim — the consolidation summary with severity sections, merged findings, the suppressed section, and the header warning counters.]`

**Edit 2: Step 4.5d — add a new `## Validator Warnings` section to the `summary.md` template** (insert after the Consolidated Findings block):

```markdown
## Validator Warnings

The internal validator coerced or dropped the following records during consolidation. Per-reviewer files (`<reviewer>.md` in this directory) contain the raw reviewer output for reference.

<one bullet per reviewer with at least one warning, e.g.:>
- *<reviewer-name>*: dropped <N> findings (no file:line); snapped <M> confidence values; <K> findings annotated `(off-diff)`.

When no warnings fired, omit this section entirely.
```

**Edit 3: Step 5 local-scope apply-fixes options** (lines 525-526):

- Option 1 was: `**Apply all fixes** — Apply all Must Address + Consider items with suggested fixes (skip conflicting pairs)`
- Becomes: `**Apply all fixes** — Apply all Critical + High + Medium items with suggested fixes (Low excluded — nit/style is not auto-applied)`
- Option 2 was: `**Apply must-address only** — Fix only Must Address items`
- Becomes: `**Apply Critical + High only** — Fix only Critical and High severity items`

**Edit 4: Step 5 MR/PR scope Conventional Comments mapping table** (lines 584-588). Replace the entire table:

```markdown
| Internal severity | CC format | When |
|---|---|---|
| Critical | `issue (blocking): <subject>` | Correctness, security, data-loss risk. Would cause real problems if shipped. |
| High | `issue: <subject>` | Significant defect or risk. Strongly recommended before merge. |
| Medium | `suggestion (non-blocking): <subject>` | Improvement the author can take or leave. |
| Low | `nitpick (non-blocking): <subject>` | Style, naming, formatting, micro-improvements. |
| Looks Good | `praise: <subject>` | Positive reinforcement. |
```

The "Default to non-blocking" note at `commands/ba/review.md:590` and the optional CC labels block at lines 592-595 (`question:`, `thought:`, `todo:`) remain unchanged.

#### Success Criteria

##### Automated:
- [x] `grep -c "Must Address / Consider / Looks Good blocks" commands/ba/review.md` returns `0` (old summary.md wording replaced).
- [x] `grep -c "## Validator Warnings" commands/ba/review.md` returns `1`.
- [x] `grep -c "Apply all Must Address" commands/ba/review.md` returns `0`.
- [x] `grep -c "Apply Critical + High" commands/ba/review.md` returns `1`.
- [x] `grep -c "issue (blocking)" commands/ba/review.md` returns `1` (CC table updated).

##### Manual:
- [ ] Run `/ba:review --local --persist` against a real diff. Inspect the generated `docs/reviews/<TIMESTAMP>-<SCOPE_REF>/summary.md`: confirm the body of Consolidated Findings matches the new render, and `## Validator Warnings` either appears with bullet content (if warnings fired) or is omitted entirely.
- [ ] Walk through Step 5's local-scope menu: confirm the new option labels appear; select "Apply all fixes" and confirm the orchestrator targets Critical + High + Medium (not Low) records.
- [ ] Dry-run posting a CC comment for a Critical, a High, a Medium, a Low, and a Looks Good finding (synthetic). Confirm the labels match the new mapping table.

> **Phase gate:** All five `grep` checks pass. At least one real `--persist` run is inspected end-to-end.

---

### Phase 5: README + version bump

#### Changes Required

**File**: `README.md` (line 168) — replace the bullet:

- Was: `**Structured findings** — Must Address / Consider / Looks Good with file:line references and conflict detection across reviewers`
- Becomes: `**Structured findings** — Critical / High / Medium / Low / Looks Good with per-finding confidence anchors, `file:line` references, cross-reviewer dedup, and a soft confidence gate that surfaces high-noise findings in a collapsed `Suppressed` section`

**File**: `README.md` — add a new sub-section under the `/ba:review` description (after line 170, before `## Convention Compliance` at line 172):

```markdown
### Severity ladder and confidence anchors (`/ba:review`)

All `/ba:review` reviewers — built-in and external — emit findings under a four-level ladder + a positive bucket:

| Heading | Meaning |
|---|---|
| `## Critical` | Correctness, security, production-breaking. Must fix before merge. |
| `## High` | Significant defect or risk. Strongly recommended. |
| `## Medium` | Clear improvement, not blocking. |
| `## Low` | Nit, style, micro-improvement. |
| `## Looks Good` | Positive observation. |

Each non-`Looks Good` finding carries a confidence anchor from `{0, 25, 50, 75, 100}`:

| Anchor | Meaning |
|---|---|
| `100` | Certain. |
| `75` | High; minor context risk. Default for clearly-applicable findings. |
| `50` | Moderate; could plausibly be a false positive. |
| `25` | Speculative; flag only when missing it would be costly. |
| `0` | Suppress; records the consideration without surfacing. |

A **soft confidence gate** at consolidation suppresses (not drops) findings below `Critical@50` and `High`/`Medium`/`Low@75`. Cross-reviewer agreement at the same `file:line` merges findings and promotes confidence by `+25` per additional reviewer (capped at 100), so corroboration can lift a finding past the gate. Legacy `Must Address` / `Consider` outputs from external reviewers are mapped to `High` / `Medium`.

> **Source of truth for the rubric:** `commands/ba/review.md` §4 is authoritative for the ladder, the anchor set, the floors, the merge math, and the legacy mapping. This README section is a user-facing summary — when in doubt, consult the command file.
```

**File**: `.claude-plugin/plugin.json` (line 3): bump `"version": "0.15.0"` → `"version": "0.16.0"`. This is a feature release (new severity vocabulary user-visible) — minor bump per semver.

#### Success Criteria

##### Automated:
- [x] `grep -c "Critical / High / Medium / Low" README.md` returns `≥1`.
- [x] `grep -c "Must Address / Consider / Looks Good" README.md` returns `0` for the `/ba:review` block (line 137's `/ba:review-plan` mention is untouched and not in this bundle's scope).
- [x] `grep -c "Severity ladder and confidence" README.md` returns `1`.
- [x] `grep -c "Source of truth for the rubric" README.md` returns `1` (README points to `commands/ba/review.md` as authoritative).
- [x] `jq -r .version .claude-plugin/plugin.json` returns `0.16.0`.

##### Manual:
- [ ] Render `README.md` in a Markdown previewer; visually confirm the new severity-ladder + confidence-rubric tables render correctly and the `/ba:review` section reads cleanly.
- [ ] Sanity-check `.claude-plugin/plugin.json` JSON is still valid (`jq -e . plugin.json`).

> **Phase gate:** All five `grep`/`jq` checks pass. Pause for the manual Markdown render and `jq` JSON-validity checks before declaring the bundle shipped.

---

## System-Wide Impact

### Interaction Graph

- **Dispatch templates** (`commands/ba/review.md:301-358`) → every selected reviewer subagent receives the new ladder + rubric. The three templates (agent/skill/user-typed) all carry the same prepend.
- **Reviewer agents** (`agents/review/*.md`) → emit prose under the new format. Built-in reviewers self-document the same rubric (defence-in-depth: a reviewer reading its own agent file gets the same instructions as a reviewer reading only the dispatch prepend).
- **Step 4 consolidation** → consumes raw reviewer return text; produces consolidated prose + a warnings header. The parser/validator/dedup/render pipeline replaces the old per-reviewer-block layout.
- **Step 4.5 persist** → per-reviewer file is unaffected (raw verbatim); `summary.md` consumes Step 4 output + adds Validator Warnings section.
- **Step 5 resolution** → consumes Step 4's rendered output; menus and CC mapping reference the new ladder.
- **External reviewers (skills + user-installed agents)** → receive the new dispatch prepend. Compliance is soft — non-compliant output triggers the legacy mapping (`Must Address` → `High`, `Consider` → `Medium`) and a header counter, so findings are never silently lost.

### Error & Failure Propagation

- **Reviewer subagent emits empty body / no findings** → parser produces zero records; render shows `None` under each section (Step 4.5c per-reviewer file shows `_Reviewer returned no findings._` per existing logic at `commands/ba/review.md:456`).
- **Reviewer subagent fails (exception, timeout)** → existing Step 3 behaviour preserved: note for summary; do not block other results (`commands/ba/review.md:362`). The failed reviewer appears in the Coverage section's `Reviewers that failed` list. No records contributed to consolidation.
- **Reviewer emits malformed bullet (no `file:line`)** → validator drops the record; increment `dropped_no_fileline`; emit warning in header. Reviewer's raw output still persists in Step 4.5c file.
- **Reviewer emits file path not in repo** → validator drops; `dropped_file_not_in_repo` counter. Header warning surfaces it.
- **Reviewer emits non-canonical confidence (`80`)** → validator snaps to nearest anchor; `snapped` counter. Finding still renders.
- **Reviewer emits legacy `## Must Address`** → parser remaps to `## High`; `legacy_format` counter. Finding still renders.
- **All reviewers fail** → Step 4 emits a `Findings: 0` summary with all failures in Coverage. Step 5 menu still presents resolution options ("Done" is the natural choice).
- **`Critical` suppressed by confidence gate** → moves to `<details>` block; `critical_suppressed` counter surfaces specifically in the header so the user is alerted to the high-stakes case.

### State Lifecycle Risks

- **No persistent state.** The consolidation pipeline is in-memory within a single `/ba:review` run.
- **`--persist` writes are independent of the pipeline.** Per-reviewer files (raw) and `summary.md` (consolidated) can diverge — by design. The `## Validator Warnings` section in `summary.md` is the bridge that lets a future reader reconcile per-reviewer raw output against the consolidated view without scrolling chat history.
- **No backwards-incompatible artifact format change.** Existing `docs/reviews/<TIMESTAMP>-<SCOPE_REF>/` directories from prior `--persist` runs remain readable — the new `summary.md` template is additive (adds Validator Warnings section), and per-reviewer file shape (frontmatter + raw text) is unchanged.

### API Surface Parity

- **No external API.** `/ba:review` is an interactive command; there is no programmatic interface to keep parallel.
- **External reviewer contract** (the closest thing to an API) is preserved: any external reviewer that emits prose under recognised headings will be parsed correctly. The new bundle is strictly additive — it accepts the new ladder, the legacy ladder, and degrades gracefully when neither matches (everything → `Low`).
- **Sibling command parity.** `/ba:review-plan` (`README.md:137`) still uses the old vocabulary and is **not** in scope for this bundle. If desired later, the parser + render code can be lifted into a shared block; for now, the two commands diverge.

### Integration Test Scenarios

Scenarios that single-phase verification would miss:

1. **Three-reviewer agreement merge with confidence promotion.**
   - Setup: synthetic diff with one obvious line-level issue at `src/foo.ts:10`. Run with `architecture-reviewer`, `security-reviewer`, `complexity-reviewer`.
   - Expectation: all three flag the line; consolidation shows ONE merged finding under the highest severity emitted; merged confidence = `max(c_i) + 2` (two extra reviewers), capped at 100; per-reviewer attribution visible inside the merged bullet.

2. **Legacy + new mixed run.**
   - Setup: one external skill emitting `## Must Address` / `## Consider`; one built-in emitting the new ladder. Both flag overlapping lines.
   - Expectation: legacy reviewer's findings render under `## High` / `## Medium` (mapped); dedup correctly merges across legacy and new at shared `file:line`; header shows `Legacy-format detected: 1 reviewer`.

3. **Critical suppressed by confidence gate.**
   - Setup: a reviewer flags a security issue at confidence 25 (below Critical's 50 floor).
   - Expectation: finding lands in `## Suppressed (low confidence)` → `Critical (suppressed)` subsection; consolidation header shows `⚠ 1 Critical finding suppressed by confidence gate`. User must explicitly open the `<details>` block to see it.

4. **Complexity-reviewer off-diff one-hop reference.**
   - Setup: complexity-reviewer flags a change-amplification issue in a file imported by a changed file but not itself changed (file is in repo but not in `CHANGED_FILES`).
   - Expectation: finding renders with `(off-diff)` annotation appended to body; header shows `Off-diff: 1 finding`. Finding is NOT dropped.

5. **Deep-module multi-line bullet through dedup.**
   - Setup: two reviewers flag the same line; deep-module-reviewer emits a multi-line bullet with `Current:` / `Suggested:` / `Impact:` continuation; the other reviewer emits a single-line bullet.
   - Expectation: parser captures deep-module's full multi-line body as one record; dedup merges with the other reviewer's record; merged bullet renders both reviewers' attribution; deep-module's multi-line body appears under its attribution line, preserved.

6. **All-`None` reviewer.**
   - Setup: a reviewer returns `## Critical\nNone\n## High\nNone\n## Medium\nNone\n## Low\nNone\n## Looks Good\nNone`.
   - Expectation: zero records emitted to consolidation; no validator warnings triggered; reviewer appears in Coverage as succeeded with `_Reviewer returned no findings._` in its per-reviewer file.

7. **Persist + warnings interaction.**
   - Setup: enable `--persist`; one reviewer emits a malformed bullet (no file:line) and one valid bullet.
   - Expectation: per-reviewer file shows BOTH bullets verbatim; `summary.md`'s Consolidated Findings shows ONLY the valid bullet; `summary.md`'s `## Validator Warnings` section names the reviewer and the dropped finding.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM self-confidence is poorly calibrated; reviewers emit `75`s indiscriminately. | High | Medium | Discrete anchors (5 levels, not continuous); explicit rubric in both dispatch prepend and agent files (defence-in-depth); soft gate (suppressed-but-visible); cross-reviewer promotion as a calibration check — disagreement and corroboration both surface in the merged layout. |
| Parser misbehaves on real-world reviewer prose (smart quotes, capitalization variants, stray markup). | Medium | High | Permissive grammar (case-insensitive headings, multiple em-dash variants, optional whitespace); validator coerces rather than drops on most failures; `dropped` and `coerced` counters in header so silent failures are visible. |
| External reviewers (skills) ignore the new dispatch prepend. | High | Medium | Legacy-format mapping: `Must Address → High`, `Consider → Medium` preserves their findings. `legacy_format` counter in header flags non-compliance for follow-up. |
| Critical findings get buried in `## Suppressed`. | Medium | High | Special `⚠ N Critical findings suppressed by confidence gate` header counter — high-stakes findings are always surfaced even when collapsed in the body. |
| Output-format clutter (heading + confidence + attribution) hurts readability. | Medium | Medium | Confidence is short and italic; section headings carry severity weight; merged-finding template uses nested bullets (visual hierarchy); single-reviewer findings drop attribution entirely (one tight line); merged-finding per-reviewer `(own_severity, conf own_conf)` is shown only on disagreement, so the dense metadata is reserved for cases where it carries real information. |
| `<details>` collapsed Suppressed section degrades in non-GitHub renderers. | Medium | Low | GitHub and GitLab render `<details>`/`<summary>` natively. Terminal Markdown viewers (`glow`), Slack pastes, CI log aggregators, and RSS feed readers may strip the HTML or render it as literal markup, making Suppressed findings effectively invisible. Mitigation: (a) the header counter `⚠ N Critical findings suppressed` always fires above-the-fold regardless of renderer, so the *existence* of suppressed Critical findings is never hidden; (b) `--persist` writes the full consolidated view (including the inner Suppressed content as plain Markdown) to `summary.md` so anyone reading the persisted artifact sees it inline; (c) consumers running output through pure-Markdown pipelines should treat the Suppressed block as plain content following the `<summary>` line. If non-GitHub consumption becomes the dominant flow, drop `<details>` and ship a flat `## Suppressed` section. |
| Gate thresholds (50/75) copied verbatim from ce; not calibrated locally. | High | Low | Soft gate gives observation runway. Adjust thresholds in a follow-up after observing real runs (issue C3 likely territory). |
| Reviewer compliance is soft; built-in agents' Output Format and dispatch prepend can drift apart over time. | Low | Medium | Both locations carry the rubric verbatim (Phase 1 and Phase 2). Each agent file and the README sub-section carry an explicit **"Source of truth for the rubric: `commands/ba/review.md` §4"** pointer, so a maintainer touching any copy knows where the normative text lives and that their edit must propagate. Phase 1's grep gate (`grep -L "Source of truth for the rubric" agents/review/*.md`) confirms the pointer is present in every agent file. A future CLAUDE.md convention check could additionally grep for the rubric text in both. |
| Multi-line bullets (deep-module-reviewer) confuse the parser. | Medium | Medium | Continuation rule explicitly documented: lines not matching `^- \*\*` or `^## ` are body of the parent bullet. Phase 1 grep checks confirm `Current:` / `Suggested:` / `Impact:` keywords still permitted. |
| The plan's confidence-marker placement (after `**file:line**`, before body) diverges from the issue body's literal "end of body" wording. | Low | Low | Documented as a deliberate plan-level override in Convention Compliance, with rationale (parser robustness against multi-line bodies and complexity-reviewer lens tags). Reviewer agent files and dispatch prepend both carry the corrected placement. |

## Testing Strategy

There is no Jest/Vitest equivalent for the dev-workflow plugin — these are Markdown prompt instructions executed by Claude Code as an LLM-driven runtime. Verification is a mix of `grep`-based static checks (phase gates) and **live `/ba:review` runs** against representative diffs.

### Automated Static Checks (per phase)

Each phase gate is a small set of `grep`/`jq` invocations confirming the textual changes landed. Listed in each phase's Success Criteria.

### Manual Functional Verification

After all five phases, run an end-to-end scenario matrix:

| # | Scenario | Inputs | Expected |
|---|---|---|---|
| 1 | Single reviewer, all-pass | 1 built-in, clean diff | New format renders; no warnings in header |
| 2 | Multi-reviewer agreement | 3 built-ins flag same line | Merged finding with attribution; confidence promoted |
| 3 | Critical suppression | Reviewer emits Critical@25 | Finding in Suppressed; header `⚠ 1 Critical suppressed` |
| 4 | Legacy external reviewer | Mock skill emits `## Must Address` | Mapped to `## High`; header `Legacy-format detected: 1 reviewer` |
| 5 | Malformed bullet | Reviewer emits `- ** —` | Dropped; header `Dropped: 1 finding` |
| 6 | Non-canonical confidence | Reviewer emits `confidence: 60` | Snapped to 50; header `Snapped: 1 finding` |
| 7 | `--persist` end-to-end | Scenarios 2 + 5 | `summary.md` consolidated view; per-reviewer files preserve raw; `## Validator Warnings` lists the dropped finding |
| 8 | Off-diff reference | Complexity-reviewer flags a one-hop file | Finding kept with `(off-diff)`; header `Off-diff: 1 finding` |
| 9 | All-`None` reviewer | Reviewer returns all `None` | Zero records; no warnings |
| 10 | Mixed legacy + new in one reviewer | One reviewer emits `## Must Address` + `## Critical` | Both render correctly; legacy counter increments for that reviewer only |

### No Unit-Test Infrastructure

The plugin has no test runner. The phase gates + manual matrix above are the full verification surface. This is consistent with the rest of the plugin's commands (none have automated tests).

## Documentation Plan

| Doc | Change |
|---|---|
| `README.md` (line 168) | Update bullet to reference new ladder; add severity-ladder + confidence-rubric sub-section (Phase 5). |
| `CLAUDE.md` | No change — the convention statements at line 72-73 (built-in reviewers always appear; protected-artifacts guard) remain accurate. The new ladder is implementation detail, not a convention. |
| `commands/ba/review.md` | Self-documenting (Phases 2-4). The new Step 4 includes the parser grammar and validator rules inline. |
| `agents/review/*.md` | Self-documenting (Phase 1). Each agent's Output Format section now includes the rubric. |
| `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md` | No change — research doc is historical. |
| Optional: a `docs/solutions/` post-ship learning | After the bundle ships and we observe real-world output, run `/ba:compound` to capture: reviewer-compliance issues, parser edge cases hit in the wild, confidence calibration drift across reviewer types. Out of scope for this plan but flagged in Phase 5 success criteria as a follow-up candidate. |

## Dependencies & Risks

- **No external dependencies.** All changes are to in-repo Markdown.
- **Cross-feature ordering already resolved.** A1 (protected-artifacts guard) and `--persist` are both already shipped — no coordination required.
- **C3 (Requirements Completeness check) builds on this bundle's structured records.** Not in scope; lands after.
- **The parser is LLM-driven, not regex-driven.** The "grammar" tables in Step 4 are instructions to the orchestrating LLM, not literal regular expressions. Non-determinism is bounded but real — the soft gate, the legacy mapping, and the validator warnings together ensure no finding is *silently* lost. The deferred move to genuine structured output (Shape C) eliminates this class of risk; this bundle is the bridge.
- **Plugin version bump from 0.15.0 → 0.16.0.** Per `CLAUDE.md:66`. Minor (not major) because the user-facing vocabulary changes are additive in the sense that legacy formats are mapped, not rejected.

## Sources & References

### Origin

- GitHub issue: https://github.com/azevedo/dev-workflow/issues/5 — Status `Accepted`, labels `accepted, candidate`.
- Issue body decisions carried forward verbatim: severity ladder mapping table, confidence anchors {0,25,50,75,100} from ce, dedup fingerprint = exact `file:line`, promotion `+25 per extra reviewer (cap 100)` (step size made explicit during plan review — "1 anchor" was ambiguous), validator's "coerce-with-warning; drop only for no file:line", schema location (inline), schema versioning (none), gate thresholds (Critical ≥50, others ≥75).
- Origin research: `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md` — ce stages 4 (JSON contract), 5 (merge/dedup), 5b (validator) are the source material for B4 + B5 + B6 + C2.
- Origin research (companion): `docs/research/2026-05-09-ce-review-benchmark-methodology-research.md`.

### Internal References

- Dispatch templates: `commands/ba/review.md:301-317` (agent), `319-334` (skill), `336-358` (user-typed)
- A1 protected-artifacts guard (already shipped): `commands/ba/review.md:305, 323, 347`
- Step 4 consolidation (replaced in Phase 3): `commands/ba/review.md:366-401`
- Step 4.5 persistence: `commands/ba/review.md:404-510` (per-reviewer file at line 453; `summary.md` body at line 497)
- Step 5 apply-fixes options (replaced in Phase 4): `commands/ba/review.md:525-526`
- Step 5 CC mapping table (replaced in Phase 4): `commands/ba/review.md:584-588`
- Reviewer Output Format sections (replaced in Phase 1):
  - `agents/review/architecture-reviewer.md:33-46` (+ Principles bullet at line 53)
  - `agents/review/security-reviewer.md:36-48`
  - `agents/review/simplification-reviewer.md:34-46`
  - `agents/review/error-handling-reviewer.md:34-47`
  - `agents/review/test-coverage-reviewer.md:34-47`
  - `agents/review/deep-module-reviewer.md:44-59` (+ "most findings → Consider" bullet at line 63)
  - `agents/review/complexity-reviewer.md:39-52` (+ "Tag the lens" bullet at line 57)
- README `/ba:review` advertisement: `README.md:168`
- Plugin version: `.claude-plugin/plugin.json:3`
- Conventions: `CLAUDE.md:66` (version bump mandate), `CLAUDE.md:72-74` (reviewer/guard/README conventions)

### External References

- ce-code-review skill — `https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/skills/ce-code-review` (referenced in issue body; not consulted directly for this plan — the local research doc at `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md` is the canonical summary).
- Conventional Comments — https://conventionalcomments.org/ (already referenced in `commands/ba/review.md:578` and unchanged in scope).

## Convention Compliance

- [x] **Plugin version bump** (`CLAUDE.md:66`) — Phase 5 bumps `.claude-plugin/plugin.json` from 0.15.0 → 0.16.0. Minor bump for user-visible vocabulary change.
- [x] **README update on command/agent change** (`CLAUDE.md:74`) — Phase 5 updates `README.md:168` and adds a severity-ladder + confidence-rubric sub-section.
- [x] **All built-in reviewers always appear as options** (`CLAUDE.md:72`) — No change to Step 2c reviewer-selection logic; the seven built-ins all continue to appear as options.
- [x] **Protected-artifacts guard preserved** (`CLAUDE.md:73`) — Phase 2's dispatch prepend sits **above** the existing A1 paragraph in each of the three templates; A1 wording untouched.
- [x] **Reviewers must not suggest modifying `docs/` artifact paths** (`CLAUDE.md:73`) — Plan does not alter reviewer behaviour beyond format; A1 guard remains the enforcement mechanism.
- [x] **Agent naming convention** (`CLAUDE.md:64`) — Plan does not add or rename any agent.
- [x] **No new dependencies** — Plan is Markdown-only edits.
- [x] **Convention-compliance check exempt for `/ba:review` runtime output** (`commands/ba/review.md:613`) — Plan does not introduce a runtime convention-check; review output is reviewed code, not a planning artifact.
- [x] **Plan command convention-compliance check** (`CLAUDE.md:66` — implied by the plan workflow) — This plan was validated via Step 5's convention-checker dispatch before write.
- [x] **Always-on (no flag gating)** — Bundle ships always-on per the issue body. Matches the existing plugin pattern (no flag-gated commands).
- [x] **Bundled change rather than four separate MRs** — Justified by the issue body: B4 + B5 + B6 + C2 share file edits across the same three template variants and seven reviewer files; landing them separately would re-edit the same files four times. This is a deliberate override of any preference for atomic MRs.
- [x] **Confidence-marker placement diverges from issue body** — Plan places `*(confidence: N)*` AFTER `**file:line**` and BEFORE the body, NOT at "end of finding body" as the issue's B5 section states. Justified: parser robustness against multi-line bodies (deep-module-reviewer) and lens-tagged bodies (complexity-reviewer). Documented as a deliberate plan-level override; the issue's B5 wording is treated as advisory on this point. Reviewer agent files and dispatch prepend both carry the corrected placement consistently.

## Deviations

### Phase 3 — Step 4.5c per-reviewer template `⚠ Conflicting` reference
- **Expected**: Plan only specified rewriting Step 4 (lines 366-401); the `⚠ Conflicting` annotation logic was to be "removed entirely. No replacement."
- **Found**: A stale reference to `⚠ Conflicting` survived in the Step 4.5c per-reviewer file template (around line 644 post-Phase 2). The Phase 3 grep check `grep -c "⚠ Conflicting" commands/ba/review.md` returned `1` instead of `0`.
- **Why**: The plan focused on Step 4's render code path; the per-reviewer file template's stale conflict cross-reference text was not enumerated.
- **Resolution**: Cleaned up alongside the Phase 3 commit — replaced the cross-reference sentence with a note that cross-reviewer merges, suppression, and validator coercions now live only in `summary.md` so per-reviewer files stay raw. Grep gate then passed.

### Phase 5 — README line 169 stale `must-address only` reference
- **Expected**: Plan only specified replacing line 168's `Structured findings` bullet and adding a new sub-section before `## Convention Compliance`.
- **Found**: Line 169's `apply all fixes, must-address only, or one-by-one with Accept/Skip` referenced the menu option `Apply must-address only`, which Phase 4 renamed to `Apply Critical + High only`.
- **Why**: Plan-level omission — the README bullet was a downstream consumer of Phase 4's menu rename and was not enumerated in Phase 5's Changes Required.
- **Resolution**: Updated line 169 to `apply all fixes, Critical + High only, or one-by-one with Accept/Skip` as part of the Phase 5 commit. Surgical cleanup of state orphaned by our own changes (per CLAUDE.md's "Remove imports/variables/functions that YOUR changes orphaned").
