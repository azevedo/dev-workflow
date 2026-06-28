---
date: 2026-06-27T00:00:00Z
researcher: Claude
git_commit: 383922d40b9d2d57c7f6b56220c55403bfff0504
branch: main
repository: dev-workflow
topic: "HTML output mode for plans (and brainstorms) — what to build, modeled on compound-engineering"
tags: [research, html-output, ba-plan, ba-brainstorm, ba-execute, compound-engineering, output-mode, section-contract, rendering-reference, issue-33]
status: complete
last_updated: 2026-06-27
---

# Research: HTML output mode for plans (and brainstorms), modeled on compound-engineering

**Date**: 2026-06-27
**Git Commit**: 383922d40b9d2d57c7f6b56220c55403bfff0504
**Branch**: main
**Repository**: dev-workflow

## Research Question

Build the thing in [issue #33](https://github.com/azevedo/dev-workflow/issues/33) — an HTML output mode for plans: a single self-contained, agent-consumable HTML artifact (not a markdown→HTML export). Research everything needed to build it.

Additionally: the compound-engineering (CE) plugin renders HTML for **ce-ideate, ce-brainstorm, and ce-plan** — not just plans. Capture what the relationship between these is, because the user wants an HTML artifact in `/ba:brainstorm` too, not only `/ba:plan`.

## Summary

**The single most important finding answers the user's add-on question directly: in CE, HTML rendering is _not_ a plan feature. It is a format layer orthogonal to the producing skill.** The three skills that produce documents (ce-ideate, ce-brainstorm, ce-plan) each ship a `references/html-rendering.md`, and **all three files are byte-identical**. HTML is a shared rendering reference paired per-skill with a *section contract* that defines what the artifact contains. So "HTML for plans" and "HTML for brainstorms" are not two features — they are one rendering reference applied to two section contracts. Adding HTML to `/ba:brainstorm` alongside `/ba:plan` is the natural shape, not scope creep.

CE's design factors cleanly into **three orthogonal layers**:

1. **Output-mode resolution** (per-skill, near-identical logic) — a "Phase 0.0 Resolve Output Mode" with a precedence stack (in-prompt request > user preference > config > default), exclusive mode (md OR html, never both), and a pipeline-mode override forcing `md`.
2. **Section contract** (per-skill, distinct) — `plan-sections.md` / `brainstorm-sections.md` / `ideation-sections.md`: *what* the artifact contains (sections, ID registries, frontmatter fields, "is a doc even warranted" gates).
3. **Format-rendering reference** (per-format, shared across skills) — `html-rendering.md` / `markdown-rendering.md`: *how* the format presents any artifact. Content is identical across formats; only presentation differs.

**Issue #33's blocker (#31) has shipped** (issue closed; landed as commit `d1d47aa` "decouple /ba:execute state from the plan file into git" + the U-ID convention). #33 is now unblocked. The comparison evidence doc the issue cites explicitly framed HTML as the "bigger play once the foundation lands" — the foundation has landed.

**The hard part is not generating HTML — it's making the HTML plan agent-consumable by dev-workflow's existing markdown-coupled consumers.** `/ba:execute` and `/ba:review-plan` locate and enumerate plan units by grepping markdown structure: `docs/plans/*.md` glob, a leading YAML `---` frontmatter block (`plan_schema: 2`), `## ` section-heading text, and literal `### U<n> — <title>` headings. CE's HTML invariant *forbids* YAML frontmatter (metadata is visible text instead). So an HTML plan breaks all four of those reads unless they're taught to route on file extension and read HTML's semantic structure. CE solved exactly this with "routing keyed on file extension first, then frontmatter" and "treat the visible-header metadata as the frontmatter equivalent." `/ba:propose` is already format-agnostic (it reads git commit trailers, never the plan file); `/ba:handoff` is coupled only through `plan_schema: 2` detection + delegation to `derive-state`.

**dev-workflow has no config mechanism** (no `.compound-engineering/config.local.yaml` equivalent). CE's precedence stack assumes a config tier; in dev-workflow that tier simply collapses out, leaving: in-prompt request > in-session/memory preference > default (`md`).

## Detailed Findings

### CE's three-layer architecture (the relationship the user asked about)

#### Layer 1 — Output-mode resolution (per-skill, near-identical)

Each producing skill opens with a "Phase 0.0 Resolve Output Mode" block. They are structurally identical, differing only in default:

- `ce-plan/SKILL.md:62-86` — default `md`.
- `ce-brainstorm/SKILL.md:66-97` — default `md`.
- `ce-ideate/SKILL.md:64-113` — **default `html`** ("ideation docs are human-facing, so HTML is the default").

The shared precedence stack (highest to lowest):

1. **In-prompt request** — an `output:` shorthand token or plain language ("make this a webpage", "I want this in HTML"). Critically distinguishes a *format request* from a *subject-matter mention*: "plan the HTML export feature" is the work, not a doc-format switch (`ce-plan/SKILL.md:73`). Unknown `output:` values (e.g. `output:pdf`) are dropped with a one-line note (`ce-plan/SKILL.md:75`).
2. **User-stated preference** — a format preference already present in session/memory/instructions; overrides config (`ce-plan/SKILL.md:76`).
3. **Config** — `.compound-engineering/config.local.yaml` keys `plan_output` / `brainstorm_output` / `ideate_output`, each `md | html` (`ce-setup/references/config-template.yaml:44-46`).
4. **Default** — `md` (plan, brainstorm) / `html` (ideate).
5. **Pipeline override** — when invoked from LFG / any `disable-model-invocation` context, force `md` regardless of 1-4: downstream automation parses markdown reliably (`ce-plan/SKILL.md:79`).

Exclusive mode: the artifact is written as **either** `.md` **or** `.html`, never both (`ce-plan/SKILL.md:64`). Resume preserves the existing artifact's format unless an explicit `output:` arg switches it; the original file is left in place (`ce-plan/SKILL.md:113`, `ce-brainstorm/SKILL.md:97`, `ce-ideate/SKILL.md:113`).

Key efficiency note CE is careful about: **resolve the format at Phase 0.0 but defer loading the 600-line rendering reference until compose time** (`ce-plan/SKILL.md:83-86`, `ce-brainstorm/SKILL.md:87`). Loading it during Phase 0 would carry 200+ lines through the entire dialogue for no benefit.

#### Layer 2 — Section contract (per-skill, distinct)

This is the "what the artifact contains" layer, and it is where the three skills genuinely differ:

- `ce-plan/references/plan-sections.md` — the unified-plan contract: `artifact_contract: ce-unified-plan/v1`, `artifact_readiness` (requirements-only → implementation-ready), `product_contract_source`, `execution` (code / knowledge-work); a Section ID Registry; size-aware wayfinding; a "decide whether a plan doc is warranted at all" gate (`plan-sections.md:22-156`).
- `ce-brainstorm/references/brainstorm-sections.md` — the *requirements-only* unified plan (brainstorm writes a skeleton with `artifact_readiness: requirements-only`, `product_contract_source: ce-brainstorm`, under `docs/plans/`); Product Contract hard floor; "prose economy" rules; R-IDs (`brainstorm-sections.md:23-141`). **Note CE merged brainstorm output into the same `docs/plans/` unified-plan lineage** — brainstorm produces the requirements-only front half that ce-plan later enriches.
- `ce-ideate/references/ideation-sections.md` — a different artifact entirely (`docs/ideation/`): Ranked Ideas with confidence/complexity, Topic Axes, Rejection Summary (`ideation-sections.md:13-142`).

#### Layer 3 — Format-rendering reference (per-format, shared)

`html-rendering.md` is **byte-identical** across all three skills (verified: `diff -q` reports identical for ce-plan vs ce-brainstorm; zero diff ce-plan vs ce-ideate). Its own opening states the contract: *"This is a format-rendering reference — it describes how to render any artifact in HTML, independent of which skill is producing it. It is paired with a section contract … that describes what the artifact contains."* (`html-rendering.md:3-9`).

The same pairing exists for markdown: `markdown-rendering.md` is the markdown sibling, also shared, also paired with the section contract (`ce-brainstorm/references/markdown-rendering.md:1-9`).

**This is the architectural insight to copy.** The reason HTML "for plans" and HTML "for brainstorms" is one feature: the rendering reference is format-scoped and skill-agnostic. You write/port it once; each skill that wants HTML loads it at compose time and pairs it with its own section contract.

### What `html-rendering.md` actually specifies (the build spec)

This 632-line reference is the bulk of what "build this thing" means. Its load-bearing parts:

**Hard invariants** (`html-rendering.md:19-68`) — hold regardless of producing skill:
- **Single self-contained HTML5 file.** No companion `.css`/`.js`/`.svg`. CSS in `<style>`, SVG inline, images as base64 data URIs. Sole exception: a `<link>` to a CDN webfont CSS endpoint, with an offline fallback font stack.
- **All metadata is visible text — single source of truth.** No hidden machine-readable copy: no `<script type="application/json">` frontmatter, no `data-*` mirror, no `<meta name="...">` duplicating the visible header. This is the rule that **collides head-on with dev-workflow's `plan_schema: 2` frontmatter detection** (see consumer section).
- **Stable IDs as both `id=""` and visible text.** Every ID-bearing item (U-IDs, R-IDs, AC-IDs…) gets `id="u1"` *and* renders the text "U1." inside the element — "downstream agents find the ID in source the same way they find it in markdown" (`:42-46`). This is the bridge that makes the visible-text-metadata rule safe.
- **Source/composition signal** — a visible footer naming compose timestamp + source (e.g. `Composed 2026-05-17T14:23Z by ce-plan from docs/brainstorms/…`) (`:47-55`).
- **Visible navigation region** linking stable section anchors (`goal-capsule`, `implementation-units`, etc.) (`:58-64`).

**Precedence stack for style** (`:70-175`) — in-session > preferred-stylesheet-in-AGENTS/CLAUDE.md > `DESIGN.md` discovered on disk > opinionated fallback default. Extensive `DESIGN.md` handling: take scale-independent brand identity (palette, font weight/style) literally; own scale-dependent layout (type sizes, spacing) yourself; skip decoration; never load a proprietary brand face. **dev-workflow has no `DESIGN.md` convention today** — this tier can be ported as-is or trimmed.

**Format principles** (`:177-319`) — readable measure (~70ch prose, 820-960px container); "markdown source is content, not design" (re-choose bullet-vs-table per content shape); prose is authoritative over any visualization; hyperlink the reference index (resolve `git remote get-url origin`, link repo-relative paths / GH PRs / issues, **never invent URLs** — leave non-GitHub remotes as text); stable section anchors; local text-contrast discipline; no accent-colored body `<strong>`; uniform chip shapes; **no JS framework runtimes** (a small inline `<script>` for TOC/anchor behavior is the only allowed JS).

**Section anatomy** (`:321-371`) — how section types render: Requirements as `<table>` at 5+ uniform items; **Implementation Units as repeating `<article>` cards with an ID chip, a `<dl>` metadata strip (Goal/Files/Dependencies), and secondary content in default-closed `<details>` collapsibles** (the collapsible-cards idiom is CE's answer to "big plans" — readability over decomposition); KTDs as flat cards; Risks/Scope as tinted callout cards.

**Diagrams** (`:373-464`) — inline SVG, agent picks shape, complements-never-replaces prose, with a detailed hand-authored-SVG legibility checklist (no stroke through labels, halo widths, label placement in skewed shapes).

**Wireframe mockups (requirements docs only)** (`:466-500`) — **directly relevant to the brainstorm-HTML ask.** When a brainstorm *requirement* describes a UI surface, the HTML may include a low-fidelity wireframe (gray boxes, placeholder copy) with a **mandatory "directional, not the spec" caption**. Scoped to requirements-only artifacts (what brainstorm produces), excluded for non-visual requirements (which get a conceptual diagram instead). This is an HTML-only affordance brainstorm gains that markdown can't express.

**Agent-consumability rules** (`:544-587`) — the spec's thesis: *"the semantic structure is the extraction contract."* Use semantic HTML over `<div>` soup (`<article>` per unit, `<dl>` for metadata, `<table>`, `<details>`/`<summary>`, `<section>`); render field labels as visible text not attributes (`<dt>GOAL</dt>`, not `data-field="goal"`); keep U-IDs/R-IDs as visible text; **match section heading vocabulary to the section contract** (downstream agents grep these); stable structure is the public API.

**Post-compose audit** (`:589-632`) — a checklist the agent self-runs before returning.

### dev-workflow's current structure (where HTML mode would plug in)

#### `/ba:plan` and `/ba:brainstorm` — templates are inline, no layering exists

- **No section-contract/format-rendering separation.** Both commands fuse "what the artifact contains" and "how it's formatted (markdown)" into inline fenced ` ```markdown ` template blocks. There is no abstract section contract a renderer consumes — the templates *are* both the contract and the markdown rendering (`brainstorm.md:89-108`, `:226-261`; `plan.md:184-197`, `:201-238`, `:242-306`, `:310-420`).
- **No output-format / mode logic anywhere.** The only "mode"-like branches are content branches: brainstorm triage (FAST-TRACK/STANDARD/FULL, `brainstorm.md:21-62`) and plan detail levels (MINIMAL/STANDARD/COMPREHENSIVE, `plan.md:142-162`) — these select *which sections*, not *which format*. `.md` and markdown are hardcoded into every path reference.
- **Write sites:** brainstorm writes at `brainstorm.md:83-108` (FAST-TRACK) and `:218-261` (STANDARD/FULL), no named tool; plan writes via the Write tool at `plan.md:493-503` (`docs/plans/YYYY-MM-DD-<type>-<name>-plan.md`).
- **Convention-compliance gate precedes every write** (`brainstorm.md:309-327` Phase 3.5; `plan.md:447-471` Step 5) — dispatches `dev-workflow:convention-checker`, must resolve all violations before disk write. **An HTML artifact must still pass this gate** — and the gate itself may need to learn HTML (e.g. the all-artifacts-need-YAML-frontmatter convention contradicts CE's HTML no-frontmatter invariant; see Open Questions).
- **U-ID minting:** plan mints `### U<n> — <title>` headings (monotonic, strike-don't-renumber) per the grammar owned by `execute.md`; plan is a citation site (`plan.md:424-435`). The "decisions not code / Code-shape decision" convention is embedded in all three plan templates and "Key rules" (`plan.md:424-433`).

#### Plan consumers — what assumes markdown

`/ba:execute` (`commands/ba/execute.md`) is the primary consumer and is heavily markdown-coupled:
- Auto-detect glob `docs/plans/*.md` — won't match `.html` (`execute.md:24`).
- Frontmatter parse assumes a leading YAML `---` block; "a file with no `---` block is the absent case" (`execute.md:36`). HTML has no leading `---`, so `plan_schema` validation treats an HTML plan as absent and stops (`execute.md:37`).
- Preflight probes for literal markdown tokens `## Acceptance Criteria` and `### U<n>` (`execute.md:37`).
- Detail-level inference keys off `## ` heading text (`execute.md:43-46`).
- Unit extraction matches the literal `### U<n> — <title>` heading (`execute.md:51-53`, `:68-72`).

The **U-ID & Git-Derived State Convention** (`execute.md:61-142`) — the keystone #31 shipped — is mostly format-agnostic because it reads git, not the plan: commit-subject grammar `<type>(<scope>): U<n> <description>` (`:75-79`), and `derive-state(plan, git, run_verify)` scanning `git log --format=%s <base>..HEAD | grep -E ': U<n>( |$)'` (`:88-103`). **The only markdown coupling is "iterate the plan's current unit set" (`:84)` — it must locate the `### U<n>` headings in the plan to know which units exist / are struck.** Everything downstream of that (subject scan, merge-base, Verify execution) is format-blind.

Other consumers:
- `/ba:review-plan` (`review-plan.md`) — same `docs/plans/*.md` glob (`:30`); reads whole plan as text; anchors findings to section-heading / `### U<n>` / keyed `AC<n>` via a Plan-Anchor grammar that assumes markdown headings (`:191-220`, parser at `:330-332`); applies fixes by editing the `.md` directly (`:483`, `:525`).
- `/ba:propose` (`propose.md`) — **format-agnostic.** Reads only `Deviation (U<n>):` commit-body trailers from git over `DIFF_BASE..HEAD` (`:267-270`); never opens the plan file. Unaffected by HTML.
- `/ba:handoff` (`handoff.md`) — coupled only via `plan_schema: 2` detection (`:33`) and delegation to `derive-state(…, run_verify: false)` (`:34-35`); inherits the markdown coupling through derive-state but adds none of its own.

### How CE reconciled the HTML/consumer collision (the pattern to copy)

CE hit the identical problem — its HTML plans have no YAML frontmatter, yet ce-work and ce-plan-resume must consume them. CE's resolution (`ce-plan/SKILL.md:102-103`):

> **"Routing is keyed on file extension first, then frontmatter.** HTML plans (`.html`) are always software plans — the html-rendering invariant forbids YAML frontmatter, so frontmatter absence is not a non-software signal for HTML. Treat the visible-header metadata (title, date) as the frontmatter equivalent."

And `.html` discovery is woven into globs as `docs/plans/*.{md,html}` (`ce-plan/SKILL.md:149`). The agent-consumability rules (visible-text IDs, semantic `<article>`/`<dl>`, contract-matched heading vocabulary) are precisely what let a text-reading consumer enumerate units from HTML the way it does from markdown.

CE also documents one **known gap**: `ce-doc-review`'s mutation mechanics are markdown-only, so HTML plans skip the doc-review pass (`html-rendering.md:11-17`, `ce-plan/SKILL.md:748`). dev-workflow's parallel is `/ba:review-plan` Step 5 "Apply Fixes" editing the `.md` directly — fix-application into HTML is the analogous hard part.

### What the cited evidence doc actually concluded

`docs/research/2026-06-17-plan-execute-vs-ce-comparison.html` (the HTML artifact #33 and #31 both cite — itself a working example of an agent-authored single-file HTML doc in this repo) reached these relevant verdicts:
- The **spine** is "decouple plan-state from the plan file (stable U-IDs + code/git-derived progress + read-only plan)" — it "unlocks the HTML bigger-play." That spine = #31, now shipped.
- On HTML specifically: *"HTML export cheap-win → dropped; wait for the bigger play once the foundation lands."* The intent was always to do HTML *as* the artifact (not a cheap md→HTML export) only after the state-decoupling foundation existed. It now does.
- On the output/rendering dimension, CE scored ahead partly on "dual-format output"; dev-workflow had none.
- Adjacent signal: review-plan was already being reconsidered ("plans are now code-light"), and `/ba:slice` + the plan-LoC gate were retire candidates because "CE solves 'big plan' via readability (collapsible unit cards) + altitude, not decomposition" — i.e. the HTML collapsible-`<details>` unit cards are part of the same thesis.

## Code References

CE plugin (repo: compound-engineering-plugin):
- `skills/ce-plan/references/html-rendering.md` — the rendering spec (identical to ce-brainstorm's and ce-ideate's copies); invariants `:19-68`, agent-consumability `:544-587`, wireframes `:466-500`, audit `:589-632`.
- `skills/ce-plan/SKILL.md:62-86` — Phase 0.0 output-mode resolution (default md).
- `skills/ce-plan/SKILL.md:102-103` — extension-first routing for HTML plans (the consumer-collision fix).
- `skills/ce-brainstorm/SKILL.md:66-97` — brainstorm output-mode (default md; brainstorm writes requirements-only unified plan under `docs/plans/`).
- `skills/ce-ideate/SKILL.md:64-113` — ideate output-mode (**default html**).
- `skills/ce-setup/references/config-template.yaml:44-46` — `plan_output` / `brainstorm_output` / `ideate_output` config keys.
- `skills/ce-plan/references/plan-sections.md`, `ce-brainstorm/references/brainstorm-sections.md`, `ce-ideate/references/ideation-sections.md` — the three distinct section contracts.
- `skills/ce-brainstorm/references/markdown-rendering.md:1-9` — markdown sibling reference (shared, format-scoped).

dev-workflow (this repo):
- `commands/ba/plan.md:184-197`, `:201-420`, `:447-471`, `:493-503` — inline templates, convention gate, write site.
- `commands/ba/brainstorm.md:89-108`, `:226-261`, `:309-327` — inline templates, convention gate.
- `commands/ba/execute.md:24`, `:36-53`, `:61-142` — markdown-coupled plan reads + the U-ID/git-derived-state convention.
- `commands/ba/review-plan.md:30`, `:191-220`, `:330-332`, `:483` — markdown-coupled anchor grammar + fix application.
- `commands/ba/propose.md:267-273` — format-agnostic (git trailers only).
- `commands/ba/handoff.md:33-35` — `plan_schema:2` detection + derive-state delegation.
- `docs/research/2026-06-17-plan-execute-vs-ce-comparison.html` — the cited evidence/example HTML artifact.

## Architecture Insights

1. **Copy CE's three-layer split, don't fuse like today.** The reason HTML is cheap to extend across skills in CE is the orthogonality: one shared `html-rendering.md`, per-skill section contracts, per-skill output-mode resolution. dev-workflow currently fuses all three into inline templates. The refactor that makes HTML tractable for *both* plan and brainstorm is extracting a shared rendering reference + per-command section contracts first. This is a larger change than "add an HTML branch" — but it is what makes the brainstorm ask free rather than a second implementation.

2. **The collision to design around is metadata location.** CE's HTML invariant (visible-text metadata, no frontmatter) vs. dev-workflow's detection (YAML `plan_schema: 2`, `*.md` glob, literal heading grep). The fix is CE's: route on extension first, treat visible-header metadata as the frontmatter equivalent, and lean on the visible-text-ID + semantic-structure rules so `derive-state`'s "iterate the plan's current unit set" can find `U<n>` in `<h3 id="u3">U3. …</h3>` the way it finds `### U3` today. This touches `execute.md`, `review-plan.md`, and `handoff.md` (via derive-state); `propose.md` is untouched.

3. **dev-workflow's CLAUDE.md "all artifacts require YAML frontmatter" convention contradicts the HTML invariant.** This is a real convention conflict the convention-checker enforces. Either HTML plans are exempted (mirroring CE's visible-metadata stance) or the convention is amended. Must be resolved before the convention gate will let an HTML artifact reach disk.

4. **Brainstorm gains a genuinely HTML-only capability: wireframes.** The wireframe-mockup affordance is scoped to requirements-only docs (what brainstorm produces) and UI-shaped requirements — something markdown can't express. This is the concrete payoff for "HTML in brainstorm too," beyond aesthetics.

5. **Collapsible unit cards are the "big plan" answer.** CE's default-closed `<details>` unit cards (and the broader readability-over-decomposition thesis) are why the comparison doc flagged `/ba:slice` + the plan-LoC gate as retire candidates. HTML output and those retirements are part of one arc.

6. **No config tier in dev-workflow.** CE's precedence stack tier 3 (config) has no equivalent here. The ported stack collapses to: in-prompt `output:` request > in-session/memory preference > default `md`. (Whether to introduce a config mechanism is a separate, larger decision — not required for #33.)

## Historical Context (from docs/research/)

- `docs/research/2026-06-17-plan-execute-vs-ce-comparison.html` — the capability comparison; established the "spine unlocks the HTML bigger-play" framing and deferred HTML until #31 landed.
- `docs/research/2026-06-13-plan-verbosity-research.md` and `docs/research/2026-06-14-plan-verbosity-consolidated-research.md` — diagnose where review cost lives in plan *form*. Relevant because CE's HTML readability affordances (collapsible cards, tables, wayfinding) are a form-level answer to the same verbosity problem.
- `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md`, `2026-05-09-ce-review-benchmark-methodology-research.md`, `2026-05-17-shipping-skill-source-material-research.md` — prior CE-vs-dev-workflow comparisons; precedent for porting CE patterns adapted (not verbatim) into dev-workflow.

No prior research doc covers U-IDs / git-derived state directly — that convention lives in `commands/ba/execute.md`, not `docs/research/`.

## Related Research

- [2026-06-17 plan-execute vs CE comparison](2026-06-17-plan-execute-vs-ce-comparison.html)
- [2026-06-13 plan verbosity](2026-06-13-plan-verbosity-research.md)
- [2026-06-14 plan verbosity consolidated](2026-06-14-plan-verbosity-consolidated-research.md)

## Open Questions

1. **Scope: plan-only (issue title) or plan + brainstorm (user's stated want)?** The architecture makes brainstorm nearly free once the shared rendering reference exists. Recommend building the shared layer and wiring both. (ce-ideate has no dev-workflow analog — `/ba:research` is the closest but produces a different artifact; out of scope.)
2. **YAML-frontmatter convention conflict.** Exempt HTML artifacts from the "all artifacts require YAML frontmatter" CLAUDE.md convention, or amend it? The convention-checker enforces this and will block otherwise.
3. **How far to port the style precedence stack?** CE's `DESIGN.md` discovery + AGENTS.md/CLAUDE.md stylesheet tier is substantial. dev-workflow has no `DESIGN.md` convention. Port the full stack (introducing the convention), a trimmed version (in-session + fallback only), or just the opinionated fallback default?
4. **Fix-application into HTML for `/ba:review-plan`.** CE punted (doc-review is markdown-only for HTML plans). Does dev-workflow accept the same gap (review-plan applies fixes only to `.md` plans, surfaces findings read-only for `.html`), or build HTML-aware editing?
5. **`derive-state` unit enumeration in HTML.** Confirm the exact read change: from grepping `### U<n>` to locating `U<n>` in visible-text-+-`id` HTML headings. Single-source-of-truth and strike-don't-renumber must survive the format change.
6. **Single shared `html-rendering.md` location.** Where does a shared reference live in a *command*-based plugin (vs CE's skill `references/` dirs)? dev-workflow commands have no `references/` convention today — this is a new structural decision.
7. **No config tier — acceptable?** Confirm the collapsed precedence stack (in-prompt > preference > default) is sufficient, or whether #33 should also introduce a config mechanism (larger scope).
