---
date: 2026-06-27
topic: html-output-mode
status: approved
triage_level: full
tags: [html-output, ba-plan, ba-brainstorm, ba-execute, ba-review-plan, ba-handoff, output-mode, rendering-reference, section-contract, issue-33]
---

# HTML Output Mode for Plans and Brainstorms

## What We're Building

A first-class HTML output mode for `/ba:plan` and `/ba:brainstorm`, modeled on the compound-engineering (CE) plugin. The HTML artifact is **the** artifact for a run (exclusive: markdown OR HTML, never both) — a single self-contained, agent-consumable HTML5 file, not a markdown→HTML export. It is read directly by the plan's downstream consumers (`/ba:execute`, `/ba:review-plan`, `/ba:handoff`) the same way they read markdown today.

The work decomposes into three orthogonal layers borrowed from CE:
1. **Output-mode resolution** — a per-command "resolve output format" step with a precedence stack and exclusive mode.
2. **Section contract** (per-command) — what the artifact contains, separated from how it's formatted.
3. **Format-rendering reference** (shared) — a single `references/html-rendering.md` describing how any artifact renders in HTML, paired at compose time with each command's section contract.

This is for the dev-workflow plugin author (Bruno) and anyone using the plugin who wants a richer, browser-readable, still-agent-consumable plan/brainstorm artifact. Full research and the consumer map: `docs/research/2026-06-27-html-output-mode-research.md`. Unblocked by #31 (shipped, commit `d1d47aa`).

## Why This Approach

CE's key insight, confirmed by research: **HTML is a format layer orthogonal to the producing skill, not a plan feature.** CE's three `html-rendering.md` files (ce-ideate / ce-brainstorm / ce-plan) are byte-identical. So "HTML for plans" and "HTML for brainstorms" are one rendering reference applied to two section contracts — making the brainstorm scope nearly free once the shared layer exists, and giving brainstorm a unique payoff (the wireframe affordance for UI-shaped requirements).

The decisive constraint is the **consumer collision**: CE's HTML invariant forbids YAML frontmatter (metadata is visible text), but dev-workflow's `/ba:execute` and `/ba:review-plan` locate/enumerate plan units by grepping `docs/plans/*.md`, a leading `---` YAML block, `## ` heading text, and literal `### U<n>` headings. The fix is CE's proven one: route on file extension first, then treat the visible-text header as the frontmatter equivalent, and lean on the visible-text-ID + semantic-structure invariants so consumers enumerate units from HTML the same way they do from markdown.

Rejected alternatives are recorded per-decision below. The throughline: copy CE's architecture (three-layer split, extension-first routing, visible-text single-source-of-truth), but trim CE's heavier machinery (config subsystem, DESIGN.md discovery) that dev-workflow has no foundation for and #33 doesn't need.

## Key Decisions

1. **HTML is the executable, exclusive artifact** — md OR html per run, never both; consumers read HTML directly. *Rationale:* issue #33's explicit intent ("executable, agent-consumable"); md→HTML export was explicitly rejected for dual-maintenance friction. *Rejected:* HTML as a human-facing-only export with markdown staying executable — lower effort but contradicts the issue and re-introduces the export friction it rejected.

2. **Scope covers both `/ba:plan` and `/ba:brainstorm`** — extract the shared rendering layer once, wire both. *Rationale:* the rendering reference is byte-identical across CE skills, so brainstorm is near-free atop the shared layer; brainstorm uniquely gains wireframes. Matches the user's stated want. *Rejected:* plan-only — would re-open the shared-layer wiring later for no saving.

3. **Amend the "all artifacts require YAML frontmatter" convention** to "artifacts require structured metadata — YAML frontmatter for markdown, a visible-text header block for HTML." *Rationale:* adopts CE's single-source-of-truth stance; one convention spans both formats. *Rejected:* a narrow `.html`-exempt clause — leaves the convention implying markdown as the norm and reads as a carve-out rather than a principle.

4. **A single shared `references/html-rendering.md`** (repo-level) + per-command section contracts; `plan.md` and `brainstorm.md` load it at compose time. *Rationale:* avoids CE's byte-identical duplication; one place to maintain the ~600-line spec. This introduces a `references/` location dev-workflow doesn't have today (a new structural convention). *Rejected:* per-command duplication (CE's pattern — invites drift); inlining ~600 lines into each command (bloats commands, duplicates).

5. **Trimmed style precedence stack:** in-session direction > stylesheet reference named in loaded `CLAUDE.md`/`AGENTS.md` > opinionated fallback default. *Rationale:* honors explicit prefs cheaply without inventing a filesystem convention. *Rejected:* full port with DESIGN.md discovery (new filesystem convention, separate feature); fallback-only (ignores a house style already named in `CLAUDE.md`).

6. **`/ba:review-plan` auto-applies fixes to HTML plans**, via agent `Edit` guided by the rendering reference + the reference's post-compose audit as a safety net; rare structural fixes (add/reorder a unit) get the same caution review-plan already gives risky markdown fixes. *Rationale:* review-plan applies fixes via an agent editing text, not a markdown-only parsing tool — so HTML text edits are as feasible as markdown ones (CE punted only because *its* `ce-doc-review` tool is markdown-coupled machinery; that limitation doesn't transfer). The no-duplicate-metadata invariant means a fix never lands in two places, and findings anchor to visible-text U-IDs/headings. *Rejected:* punt to manual HTML editing (worse UX, flagged by user); prose-only auto-apply with structural surfaced (adds a classification step for little gain).

7. **No config tier** — collapse the precedence stack to: in-prompt `output:` request > in-session/memory preference > default `md`. *Rationale:* dev-workflow has zero config infrastructure; building it is a separate, much larger feature. YAGNI for #33. *Rejected:* introduce a config file + keys — brand-new subsystem far beyond #33.

**Consumer-adaptation contract (cross-cutting, follows from decisions 1 & 3):** `/ba:execute`, `/ba:review-plan`, and `/ba:handoff` adopt **extension-first routing** — glob `docs/plans/*.{md,html}`, branch on extension, treat the HTML visible-text header as the frontmatter equivalent, and enumerate units by scanning the `U<n>` visible text (guaranteed by the rendering invariant to appear alongside `id=""`). `derive-state`'s "iterate the plan's current unit set" changes from grepping `### U<n>` to locating the `U<n>` visible-text heading; the git side (subject scan, merge-base, Verify) is already format-blind. `/ba:propose` needs no change (it reads git commit trailers, never the plan file). `strike-don't-renumber` survives the format change.

**Process note — design-it-twice:** Phase 2's trigger technically fired (decision 4 proposes a new `references/` file + per-command section contracts). I deliberately did **not** dispatch the three `interface-design-generator` agents: their Ousterhout lenses (deepest-module / common-case / info-hiding) return code interfaces with function signatures and caller examples, which don't map to a prompt/documentation-architecture question (where a reference file lives, how commands cite it). The structural choice was instead resolved as concrete options in the Phase 1 dialogue (decision 4). No `## Locked Design` section is written.

## Scope Boundaries

**Not doing:**
- No config subsystem / `.compound-engineering`-style config file (decision 7).
- No `DESIGN.md` discovery convention (decision 5).
- No markdown→HTML export path or md/html dual-output — exclusive mode only (decision 1).
- No HTML output for `/ba:research` or other commands — `/ba:plan` and `/ba:brainstorm` only (the research doc notes ce-ideate has no dev-workflow analog).
- No change to `/ba:propose` (already format-agnostic).
- No new diagram/charting library — inline SVG hand-authored per the rendering reference; no JS framework runtimes.
- Not re-deciding the `/ba:slice` / plan-LoC-gate retirements that the comparison doc flagged — separate roadmap items, even though HTML's collapsible unit cards relate.

## Acceptance Criteria

- `/ba:plan` and `/ba:brainstorm` each resolve an output format via the collapsed precedence stack (in-prompt `output:` > in-session/memory preference > default `md`) and write a single self-contained `.html` when HTML is selected, `.md` otherwise — never both.
- A produced HTML plan satisfies the rendering reference's hard invariants: single self-contained file, all metadata as visible text (no YAML frontmatter, no hidden JSON/`data-*`/`<meta>` mirror), every U-ID/AC-ID as both `id=""` and visible text, a visible composition-signal footer.
- `/ba:execute` runs an `.html` plan end-to-end: extension-first detection, unit enumeration from visible-text U-IDs, git-derived progress unchanged, `strike-don't-renumber` preserved.
- `/ba:review-plan` reviews an `.html` plan (findings anchor to U-IDs/section headings) and auto-applies fixes to the HTML, then passes the rendering reference's post-compose audit.
- `/ba:handoff` narrates U-resolution for an `.html` plan via `derive-state(..., run_verify: false)`.
- A shared `references/html-rendering.md` exists and is loaded at compose time by both commands; per-command section contracts exist; the ~600-line spec is not duplicated.
- The `CLAUDE.md` frontmatter convention is amended to cover both formats; the convention-checker passes HTML artifacts; `README.md` and affected command docs are updated in sync (per the repo's mirroring conventions).
- A brainstorm HTML artifact can include a wireframe for a UI-shaped requirement with the mandatory directional caption.

## Mirroring Obligations (for the plan to honor)

The convention-checker confirmed no violations, but flagged five sync duties this change triggers. The plan must turn each into an explicit, individually-verifiable unit:

1. **U-ID & Git-Derived State Convention — owner + 5 citation sites + README mirror (CRITICAL).** Changing unit enumeration from markdown `### U<n>` to HTML visible-text `U<n>` + `id=""` edits the *owned definition* (`execute.md` §U-ID convention, grammar item 1 and `derive-state` step 3a). Per CLAUDE.md, any change to the convention must update all five citation sites — `plan.md`, `execute.md`, `propose.md`, `handoff.md`, `review-plan.md` — **plus** README.md's own mirror block (effectively a sixth site). Skipping any site silently breaks `derive-state` on resume for HTML plans. `propose.md` is behaviorally unchanged (git-subject scan only) but its citation text may need a sync touch.
2. **README.md update rule.** Update README for: the new HTML output mode on plan/brainstorm, the U-ID convention mirror block, and any artifact-path/format text that assumes markdown.
3. **Code-shape-decision label fidelity.** The HTML section contract + rendering reference must preserve the `**Code-shape decision:** <why>` label semantics (format-independent plan content); HTML invariants must not drop plan-content labels.
4. **Convention-checker amendment.** Amending the CLAUDE.md frontmatter bullet must actually teach the convention-checker the visible-text-header equivalence (the agent reads CLAUDE.md at runtime, so amending the bullet likely suffices — but state it as a decision, not an implicit).
5. **Don't disturb adjacent mirrors when editing `review-plan.md`.** The never-hide-ledger pattern and protected-artifacts guard are format-independent; auto-applying HTML content fixes is content review (not removal/relocation), so it's compatible — but the edits must not incidentally reword those mirrored blocks. Also document the new `references/` file's status in CLAUDE.md (it's neither a dated artifact nor a command/agent — a new file kind).

## Open Questions

(none — all seven resolved in this session)

### Resolved Questions
All seven research-doc open questions were resolved as Key Decisions 1–7 above; the consumer-adaptation contract resolves the `derive-state`/enumeration question (research-doc Q5).

## Convention Compliance

Convention-checker run (Phase 3.5): **0 genuine violations.** 4 aligned, 2 intentional convention changes (correctly surfaced), 5 downstream mirroring obligations (captured above).

- **Intentional change — frontmatter:** "All artifacts require YAML frontmatter" → amended to cover both formats (Key Decision 3). Surfaced, not silently violated.
- **Intentional change — new `references/` location:** dev-workflow has no `references/` dir today (Key Decision 4). Surfaced as a new structural convention; the new file kind should be documented in CLAUDE.md.
- **Aligned:** planning-commands-never-write-code (prompt/doc changes only); `/ba:propose` format-agnostic (verified — reads git trailers/subjects, never the plan body); this brainstorm itself carries valid YAML frontmatter; convention-compliance gate honored.
- **Mirroring obligations:** see the `## Mirroring Obligations` section — Obligation 1 (U-ID convention five-site + README mirror) is load-bearing.
- **Not applicable:** plugin.json version bump (release-time, owned by execute/propose); agent-naming and roadmap conventions (untouched); design-it-twice `## Locked Design` (process note explains non-dispatch).

## Next Steps
→ `/ba:plan` to create implementation plan
