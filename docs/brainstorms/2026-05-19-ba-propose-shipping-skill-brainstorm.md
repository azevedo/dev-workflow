---
date: 2026-05-19
topic: ba-propose-shipping-skill
status: approved
triage_level: full
tags: [skill, dev-workflow, commit, pull-request, merge-request, body-composition, design-it-twice]
---

# `ba:propose` — Shipping Skill (commit + push + open PR/MR)

## What We're Building

A new `ba:propose` command for the `dev-workflow` plugin that handles commit, push, and open-PR/MR with a good commit message. It belongs to a new **Git workflow** category in CLAUDE.md (mirroring CE/Every's vocabulary), distinct from the existing Research / Planning / Execution / Quality / Knowledge buckets. Replaces Bruno's local `mr` skill (`~/.claude/skills/mr/SKILL.md`) — specifically dropping its rigid `Impact` / `Motivation` / `Implementation Notes` three-heading template in favor of size-tiered scaffolds that select from Michael Lynch's menu of optional sections. Modeled on EveryInc's `ce-commit-push-pr` skill (mode dispatch, branch routing, `--body-file` safety, preview-then-apply), informed by Lynch's *How to Write Useful Commit Messages*, but scoped tighter than CE: no automated evidence capture, no autonomous shipping framing.

The command lives at `commands/ba/propose.md`, under the `ba:` prefix alongside `ba:execute` / `ba:review` / `ba:compound`. A single command detects the remote host (`github.com` / `gitlab.com` / GHES / self-hosted GL) and dispatches to `gh` or `glab` accordingly — shared composition logic, thin platform-adapter for branch routing, push, and create-PR/MR commands. Evidence handling accepts user-supplied screenshot URLs and Loom links only; the CE `ce-demo-reel` automated-capture flow is explicitly out (dev-server cost, flag-gated UI states, brittle selectors are the wrong trade-off for Bruno's day-to-day workflow). Linear MCP integration is optional — when an issue ID is supplied or detected from the branch name, motivation pulls from MCP; otherwise it derives from the diff and recent commits.

## Why This Approach

Three vocabularies for body composition were on the table: CE's adaptive size tiers (typo/small/medium/large/perf), Lynch's menu of ~16 optional sections, and the `mr` skill's fixed three-heading template (being dropped). The initial lean was "size-tiered scaffolds that select from Lynch's menu" — but at least one credible alternative was needed before locking, because the choice shapes every downstream interface.

Phase 2 dispatched three `interface-design-generator` agents in parallel under Ousterhout-flavored constraints — deepest-module (A), common-case (B), info-hiding (C). The contrast: A makes composition a pure function with materialized inputs; B optimizes for the 80% medium-PR case with a public `overrides` taxonomy as escape hatch; C goes maximum-future-proof with composition owning its own diff/issue/solutions ports.

The locked design is a **hybrid of A and C**: A's pure-function composition (orchestrator materializes inputs, composition reaches out to nothing) with C's opaque value-object inputs (`IssueContext.raw: Mapping[str, Any]`, generic `PreservedBlock`, generic `EvidenceItem`). Rationale: pure composition stays deterministic, testable, and preview-symmetric; opaque inputs absorb Linear MCP schema drift without coupling the seam to it; B's public `overrides` record was rejected as a YAGNI trap because preview-then-apply already covers ad-hoc overrides (just edit the preview).

## Key Decisions

- **Command name: `ba:propose`** — frames the act as "proposing changes for review" (echoes Lynch's first purpose: help the code reviewer). Other names considered: `ba:ship` (rejected — too broad), `ba:submit`, `ba:pr`, `ba:open`.
- **New "Git workflow" command category** in CLAUDE.md / README, mirroring CE/Every's vocabulary. `ba:propose` belongs here rather than under Execution (which is plan-authoritative) or Quality (which is review-only). Plan must update CLAUDE.md `## Conventions` and README accordingly. Leaves room for future siblings if any ever arise.
- **Single command, host-detected dispatch** for GitHub (`gh`) and GitLab (`glab`). Composition logic is shared in a references file; branch routing, push, and create-PR/MR commands diverge in a thin platform-adapter layer.
- **Linear MCP integration is optional** — when an issue ID is supplied or detected from the branch name, motivation pulls from MCP; when absent, motivation derives from the diff and recent commits. Linear is never a hard dependency.
- **`docs/solutions/` auto-detection** — scan entries touched on the current branch since the last merge to `origin/HEAD`; offer to splice their summaries as a "What I learned" section per Lynch's menu. User confirms before splicing. This is the natural bridge to `/ba:compound`.
- **Commit body and PR description aligned by default** — same markdown feeds `git commit -F <file>` and `gh pr create --body-file <file>`. No `--diverge` flag; see *2026-05-19 Addendum — `--diverge` dropped* at the bottom of this brainstorm for the post-capture reconsideration. The common-case default plus the preview's Edit affordance cover ad-hoc divergence without a knob.
- **Body composition uses size-tiered scaffolds selecting from the Lynch menu** — but this vocabulary is hidden behind the composition seam (see `## Locked Design`). Future authors can swap to pure-Lynch, pure-CE, or a continuous-score scheme without changing the call site.
- **Evidence handling accepts user-supplied URLs only.** Two answers to the evidence prompt: "Use existing evidence" (paste URL / markdown embed → splice `## Demo`) or "Skip." No automated capture.
- **Carry over from `mr` skill verbatim:** Linear MCP motivation gathering (optional), Cursor BugBot block preservation (`<!-- CURSOR_SUMMARY --> … <!-- /CURSOR_SUMMARY -->`), Lynch's "title = effect, not mechanism" worked-examples table.
- **Drop from `mr` skill:** fixed three-heading template, hardcoded `time-off` scope, 50-char title cap, GitLab-only orientation.
- **Carry over from CE verbatim:** mode dispatch (description-only / description-update / full workflow), four-way branch-state decision tree, file-level commit splitting (no `git add -A`/`git add .`), `--body-file` discipline with temp file + quoted-sentinel heredoc, preview-then-apply with title/length/lead-sentence summary, `fix:` vs `feat:` ambiguity rule, GitHub `#`-list-prefix gotcha.
- **Drop from CE:** the Compound Engineering badge, the `ce-demo-reel` automated-capture flow entirely.

## Locked Design

**Source:** Hybrid: A's pure-function composition + C's opaque value-object inputs

### Interface

```python
def compose_body(inputs: CompositionInputs) -> ComposedBody: ...

@dataclass(frozen=True)
class CompositionInputs:
    diff: Diff                              # opaque; carries range + file stats + hunks
    branch: BranchMetadata                  # name, base ref, author, last-merge SHA
    issue_context: IssueContext | None      # opaque (from C — absorbs MCP schema drift)
    solutions: tuple[SolutionEntry, ...]    # opaque; auto-detected docs/solutions/ entries
    preserved_blocks: tuple[PreservedBlock, ...]   # opaque (kind, raw_markdown)
    evidence: tuple[EvidenceItem, ...]      # opaque; user-supplied URLs / embeds

@dataclass(frozen=True)
class IssueContext:
    raw: Mapping[str, Any]                  # whatever MCP returned — composition reads what it needs

@dataclass(frozen=True)
class ComposedBody:
    title: str                              # effect-phrased, ≤72 chars, no trailing period
    body: str                               # final markdown — feeds both commit and PR/MR
```

**Invariants the seam guarantees:**

- `body` never restates the diff verbatim — CE's "the diff is already visible" principle is enforced inside.
- `title` is effect-phrased (Lynch); mechanism-only titles are rewritten inside before return.
- Preserved blocks appear exactly once, byte-identical to input, in the position composition chose.
- Section order follows Lynch's priority order (descriptive title → impact → motivation → breaking changes → …).
- Empty inputs (no Linear, no solutions, no preserved blocks, tiny diff) still produce a valid minimal body — no exceptions, no `None`.
- Stateless; deterministic given identical inputs.

Errors collapse to `CompositionInputError` (raised only when the diff itself is unreadable or empty). All other "missing" inputs are normal cases absorbed silently.

### Usage example

```python
# Inside commands/ba/propose.md orchestrator, after gathering inputs:
result = compose_body(CompositionInputs(
    diff=collected_diff,
    branch=branch_meta,
    issue_context=linear_ctx,             # or None
    solutions=detected_solutions,          # tuple, possibly empty
    preserved_blocks=detected_blocks,      # BugBot, Demo, Screenshots
    evidence=evidence_items,               # user-supplied URLs/embeds
))

commit_message = f"{result.title}\n\n{result.body}"
pr_body        = result.body               # same body; --diverge handled upstream
preview(result.title, result.body)
```

That is the full caller surface. No tier flag, no section list, no template selector, no ordering hint.

### What's hidden behind the seam

- **Size-tier decision** — typo / small / medium / large / perf computed inside from diff stats; tier never named at call site.
- **Section vocabulary choice** — CE tiers, Lynch menu, or hybrid is an internal choice. Swappable later with zero caller change.
- **Section selection rules** — which optional Lynch sections appear (Motivation, Alternatives, Risk, Rollout, Testing notes, Screenshots, What I learned, Searchable artifacts, Dependency justifications, …) decided from inputs.
- **Section ordering** — Lynch's priority order enforced internally.
- **Splice positions for preserved blocks** — where `<!-- CURSOR_SUMMARY -->`, `## Demo`, `## Screenshots` land relative to generated sections.
- **Title rewriting policy** — "effect, not mechanism" applied inside.
- **Diff-restatement suppression** — file-list pruning, hunk-summarization thresholds.
- **Linear-issue rendering** — whether the Linear context becomes a "Context" section, a one-line lede reference, or is dropped entirely for typo-tier changes.
- **Solutions-linkage rendering** — whether `docs/solutions/` entries become a "What I learned" section, inline links, or are suppressed at small tier.
- **GitHub vs GitLab markdown dialect quirks** — heading levels, autolink avoidance for `#`-prefixed list items, etc.

### Internal sketch — current tier→section mapping (seam-hidden, swappable)

This is the first implementation's mapping from CE-derived tiers to Lynch's 16-item menu. It is **explicitly seam-hidden** — listed here so the plan and reviewers have a concrete starting point, not as a frozen contract. A future author can rewrite this table, add a tier (e.g., "migration"), or replace the tier system entirely with a continuous score, all without changing the orchestrator call site.

| Tier | Default Lynch sections | Typical shape |
|---|---|---|
| **typo** | #1 (title) | 1 line. No body. |
| **small** | #1, #2 (impact), conditionally #3 (motivation) if non-obvious | Title + 1–3 sentences. No headers. |
| **medium** | #1, #2, #3, #7 (cross-refs), conditionally #9 (testing instr), #14 (screenshots), #11 (learnings if `docs/solutions/` hits) | Title + narrative + 1–2 H2 sub-sections. |
| **large** | #1, #2, #3, #4 (breaking if any), #6 (dep justifications if any), #7, #8 (bug summaries), #9, #10 (testing limits), #11, #12 (alternatives), #14 | Title + narrative + 3–5 H2 design-decision callouts + test summary. ~100 lines, cap ~150. |
| **perf** | #1, #2, #3, #14 (before/after table as visual aid) | Title + before/after table + narrative. |

Lynch section numbers reference `docs/research/2026-05-17-shipping-skill-source-material-research.md` Source 4 ("Menu of sections — NOT a fixed template").

After tier selection, a second-pass filter drops any default section whose source-of-content is missing:

- No Linear issue context → drop the "Motivation from issue" sub-section (or derive from diff instead — see Linear MCP integration decision).
- No `docs/solutions/` entries on the current branch → drop #11.
- No detected breaking change in the diff → drop #4.
- No lockfile / dependency-manifest changes → drop #6.
- No user-supplied evidence → drop #14.

Worked example (same change, three tiers) — single-row regression "Prevent duplicate session tokens during simultaneous sign-ups":

- **small** — title + a single sentence explaining the race + `Fixes #1234`.
- **medium** — title + narrative paragraph + `## What changed` + `## Testing` + `Fixes #1234`.
- **large** — title + narrative + `## Alternatives considered` + `## What I learned` (auto-pulled from `docs/solutions/`) + `## Testing limitations` + `Fixes #1234`.

### Dependency strategy

Pure construction. Composition receives every dependency's *result* through `CompositionInputs` and reaches out to nothing itself — no MCP calls, no `gh`/`glab` calls, no filesystem reads, no git invocations. The orchestrator (`commands/ba/propose.md`) is responsible for fetching the Linear payload via MCP, running git diff, scanning `docs/solutions/` for branch-touched entries, extracting preserved blocks from any existing PR/MR description, and gathering user-supplied evidence URLs. This keeps the seam deep (composition owns every editorial decision) without making composition own I/O — which is the side of the line most likely to churn (MCP schema changes, `gh` vs `glab` divergence, Linear API shape).

Every value crossing the seam is deliberately schema-light: `IssueContext.raw` is `Mapping[str, Any]`, `PreservedBlock` and `EvidenceItem` are generic record types. Composition decides what fields to read from each opaque payload. Linear API drift, MCP schema changes, or a future migration to a different issue tracker land in orchestrator-side adapters — never in composition.

Internally, composition may split into private helpers (tier classifier, section selector, splicer, title rewriter), but none are exported and none are injectable from the caller. Tests substitute inputs, not collaborators.

### Trade-offs

- **High leverage:** orchestrator stays trivial — gather inputs, call `compose_body`, preview, apply. All editorial judgment lives in one place, behind one call.
- **High leverage:** vocabulary lock-in deferred — the size-tiered-scaffolds-selecting-from-Lynch-menu approach ships as the first implementation; switching to pure-Lynch or pure-CE later costs nothing outward.
- **High leverage:** preview/apply symmetry is free — because composition is pure and returns the final string, the preview flow is "show `result.body`, then write it" with no risk of drift between preview and apply.
- **High leverage:** Linear/MCP schema drift absorbed by opaque inputs — a typed `LinearIssue` would have required coordinated changes every time MCP added a field.
- **Thin leverage:** no fine-grained overrides — forcing a specific section ("always include Demo") requires widening the input record (additive but dilutes the "one input record, all decisions inside" purity). Escape hatch in the meantime: edit the preview.
- **Thin leverage:** section-choice debugging requires reading composition source — no diagnostic field exposed. Mitigation deferred: a `ComposedBody.trace` field can be added later if observability becomes a real pain point.

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`). Plan and execute may refine this design within the bounds of the lock; they may not re-add elements from the rejected designs below.

## Rejected Designs

### Design B — Common case (rejected)

- **Interface summary:** Three required fields (`diff`, `branch`, `preserved?`) cover ~80% of PRs; composition fetches Linear and scans `docs/solutions/` itself via injected clients; public `overrides` record exposes `tier`, `sections`, `issue`, `learnings` as escape hatches; returns `tier` and `sectionsUsed` for preview UI observability.
- **Why rejected:** The public `overrides` taxonomy locks tier and section vocabulary at the seam — it *will* drift as the menu evolves, forcing coordinated changes at every call site. Composition owning Linear / `docs/solutions/` I/O via injected clients pushes infrastructure concerns into the editorial module. B's `sectionsUsed` observability hook is a fair point but can be added to the hybrid as a `ComposedBody.trace` field later if it proves needed — capturing it now would over-fit to a need that hasn't materialized.

### Design C — Info hiding (rejected as-pure; partially incorporated)

- **Interface summary:** Composition receives raw signals only (`diff_ref_range`, `repo_root`, `branch_name`) and owns three internal ports (`DiffReader`, `IssueResolver`, `SolutionsScanner`). Maximum future-proofing; orchestrator never changes when adapters are swapped.
- **Why rejected:** Composition owning I/O ports is over-investing in future-proofing for a skill the orchestrator already drives. Testability of the public contract is weakest (must mock at internal port boundary via test-only entry). Observability is worst (cannot see what the diff range expanded to from the call site). **However, C's opaque-value philosophy for inputs was kept in the hybrid** — `IssueContext.raw`, generic `PreservedBlock`, generic `EvidenceItem` — exactly the parts that absorb schema drift without paying C's I/O ownership cost.

## Scope Boundaries

- **Not deploy.** Not merge. Not auto-approve.
- **No automated evidence capture.** Accepts user-supplied screenshot URLs / Loom links only. The CE `ce-demo-reel` flow is explicitly out.
- **No autonomous shipping.** Preview-then-confirm is mandatory before any `gh pr create` / `glab mr create` or any commit/push that creates new history.
- **No code review.** That is `/ba:review`'s job, run separately.
- **No automatic `ba:review` chaining.** User decides when to run review; the skill never triggers it implicitly.
- **No squash-merge interpretation.** The skill writes commit and PR bodies; how the platform squashes is the platform's concern. `--diverge` is the only divergence path between commit and PR body.
- **No `git add -A` / `git add .`** — explicit paths only, to avoid sweeping `.env`, build artifacts, and generated files.
- **No `--no-verify` or hook-bypass flags** ever, unless user explicitly requests.
- **The command does exactly three things:** commit, push, open PR/MR with a good message. Everything else is out.

## Acceptance Criteria

- A user on a feature branch can run `ba:propose`, see a previewed title and body, confirm, and have commits pushed and a PR/MR opened.
- Branch routing handles all four CE cases: detached HEAD, default branch with uncommitted work, default branch with no work, feature branch.
- Composition is host-agnostic; the same `compose_body` output feeds both `gh pr create --body-file` and `glab mr create --description-file`.
- Cursor BugBot block (`<!-- CURSOR_SUMMARY --> … <!-- /CURSOR_SUMMARY -->`) and existing `## Demo` / `## Screenshots` blocks are preserved byte-identical when rewriting an existing PR/MR description.
- Linear MCP integration: when an issue ID is supplied (or detected from branch name), motivation pulls from MCP; when absent, motivation derives from diff and recent commits — the command never errors on missing Linear.
- `docs/solutions/` entries touched on the current branch since last merge are detected and offered for inclusion; user confirms before splicing.
- `--body-file` discipline enforced: temp file + quoted-sentinel heredoc; never stdin, pipes, or `--body "$(cat ...)"`.
- Commit body and PR/MR description share the same composed markdown — no separate commit-vs-PR rendering path.
- The command never sweeps `.env` / build artifacts (no `git add -A` / `git add .`).
- Title is effect-phrased — mechanism-only titles ("add a mutex to guard X") are rewritten to effect form ("prevent X during simultaneous Y") inside composition.
- Description-only mode (`ba:propose --describe-only` or equivalent) prints the body without committing or pushing — for refreshing an existing PR description.

## Open Questions

*(All resolved before capture — see Resolved Questions.)*

## Resolved Questions

- **Namespace.** → `ba:propose` (under `ba:` prefix, alongside `ba:execute` / `ba:review` / `ba:compound`).
- **Multi-platform.** → Single skill with host-detected dispatch (GitHub `gh` + GitLab `glab`); composition logic shared, branch routing / push / create diverge in a thin platform-adapter layer.
- **Linear MCP integration.** → Optional source with diff-derived fallback when no issue is supplied or detected.
- **`docs/solutions/` integration.** → Auto-detect entries touched on the current branch since last merge; offer to splice as "What I learned"; user confirms.
- **Commit ↔ PR alignment.** → Aligned by default. (Originally proposed `--diverge` for squash-merge cases; dropped post-capture — see *2026-05-19 Addendum — `--diverge` dropped*.)
- **Body composition design.** → Hybrid: A's pure-function composition + C's opaque value-object inputs (see `## Locked Design`).
- **Command name.** → `ba:propose` (rejected: `ba:ship`, `ba:submit`, `ba:pr`, `ba:open`).
- **CLAUDE.md command category.** → New **"Git workflow"** category, mirroring CE/Every's vocabulary. Plan must update CLAUDE.md `## Conventions` and README.
- **Artifact terminology.** → "Command" (not "skill") throughout the brainstorm, matching dev-workflow's own vocabulary in `commands/ba/*.md`.

## Convention Compliance

Convention-checker run on 2026-05-19. Summary: 14 conventions checked, 8 aligned, 1 justified override (empty `## Open Questions` per template's expected pattern), 0 hard violations, 4 risks flagged.

**Resolved during capture:**

- **Terminology** (`ba:propose` referred to as "skill" in initial draft) — unified to "command" throughout to match the repo's own vocabulary (CLAUDE.md, README, `commands/ba/*.md` layout). `mr` and CE references retain "skill" because that's the source vocabulary of those artifacts.
- **Command category** — `ba:propose` does not fit cleanly into any of CLAUDE.md's five existing buckets (Research / Planning / Execution / Quality / Knowledge). Added a Key Decision establishing a new **"Git workflow"** category, mirroring Every/CE's vocabulary. Plan is responsible for updating CLAUDE.md `## Conventions` and README accordingly.
- **Orchestrator file references** — replaced placeholder `SKILL.md` references in `## Locked Design` with `commands/ba/propose.md`, matching the dev-workflow command-file convention.

**Informational (no action):**

- **Python type signatures in `## Locked Design`** — template-sanctioned (the brainstorm command's design-it-twice template at `commands/ba/brainstorm.md` explicitly expects entry points and signatures in `### Interface`). A stricter reading of CLAUDE.md's "planning commands must never write code" rule could flag the snippets, but they document a contract, not implementation.
- **`Source:` line wording** — `"Hybrid: A's pure-function composition + C's opaque value-object inputs"` is the verbatim label of the option the user selected in the Phase 2 hybrid-phrasing AskUserQuestion. Lock-bound per the synthesis-lock rule.

**Aligned (no action):**

filename + frontmatter shape + required-section presence + design-it-twice template sections (Interface / Usage / What's hidden / Dependency strategy / Trade-offs) + `## Rejected Designs` shape + synthesis-lock paragraph + `ba:` command-prefix convention + scope-boundary explicitness.

## Next Steps

→ `/ba:plan` to create the implementation plan for `ba:propose`.

---

## 2026-05-19 Addendum — `--diverge` dropped

**Captured during `/ba:plan` review (same day as brainstorm).** User pushed back: do we really need `--diverge`?

**Resolution: drop it.**

**Rationale (three reasons):**

1. **The default (commit body = PR body) covers both squash and non-squash repos.** On squash-merge, the per-commit message is discarded at merge anyway — but Claude is generating it, not a human typing, so the "tighter commit body" optimization saves no human effort. The waste is conceptual, not real.

2. **Preview-then-apply already covers ad-hoc divergence.** This brainstorm rejected Design B's public `overrides` taxonomy with exactly this reasoning (see `## Locked Design` rationale, line 23): *"preview-then-apply already covers ad-hoc overrides (just edit the preview)."* `--diverge` is the same class of feature — a flag that exists to express something the preview's Edit affordance already expresses. By Design B's logic, `--diverge` is a YAGNI trap.

3. **The cost is disproportionate to the value.** `--diverge` would bring: a flag, a `.git/dev-workflow/propose-config` cache file, merge-flags hash invalidation, auto-prompt on squash-merge-only repos, a "settings changed" warning path, a dual-render (small-tier commit body + natural-tier PR body) inside composition, two paths through the preview. For a knob whose primary purpose is to make discarded content shorter.

**Counter-case considered.** Multi-commit PRs where short per-commit checkpoint messages + a comprehensive PR description might be wanted. Resolution: the plan's multi-commit grouping (Step 5a) handles this naturally — each subset diff tier-classifies as "small" on its own, producing short per-commit bodies without a flag.

**What this changes in the locked design.** Nothing in the `compose_body` contract. `--diverge` was always an orchestrator-side option applied as a final-step transform on the body; removing it just deletes that branch. The composition seam is unaffected.

**What this changes in scope.** Removed from Key Decisions, Acceptance Criteria, and Resolved Questions. Plan (`docs/plans/2026-05-19-feat-add-ba-propose-command-plan.md`) updated in tandem.

**Audit trail.** This addendum exists so a future reader can see that the brainstorm-time list of decisions was not silently rewritten — the original `--diverge` decision was made, then publicly retracted with a stated reason. The synthesis-lock rule (see `docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` *Concrete rules*) is honored: locked decisions are not silently re-opened, but they may be retracted via an explicit, dated addendum that names what was dropped and why.
