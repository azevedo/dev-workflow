---
date: 2026-05-17T00:00:00Z
researcher: Claude
git_commit: 51d9d547b3afe0ccc921bf85d785af3076ef7195
branch: main
repository: dev-workflow
topic: "Source material for designing a shipping-automation skill in dev-workflow — synthesizing EveryInc's ce-commit-push-pr with Michael Lynch's commit-message principles and the existing local mr skill"
tags: [research, shipping-skill, commit-messages, pr-description, ce-commit-push-pr, mr-skill, refactoring-english]
status: complete
last_updated: 2026-05-17
---

# Research: Source material for a dev-workflow shipping skill

**Date**: 2026-05-17
**Git Commit**: 51d9d547b3afe0ccc921bf85d785af3076ef7195
**Branch**: main
**Repository**: dev-workflow

## Research Question

Bruno is about to brainstorm a new shipping-automation skill for the `dev-workflow` plugin, modeled on EveryInc's `ce-commit-push-pr` but with additions and removals. The brainstorm needs source material from three places:

1. The actual `SKILL.md` and references for `ce-commit-push-pr` (not the docs summary).
2. Michael Lynch's *How to Write Useful Commit Messages* (Refactoring English) — the article that influenced the existing local `mr` skill.
3. The existing local `mr` skill at `~/.claude/skills/mr/SKILL.md`, for what to carry over.

Bruno does not love the rigid inverted-pyramid template the `mr` skill imposes and wants to revisit that decision.

## Scope (decided before brainstorm)

- **What the skill does**: commit, push, create a PR with a good commit message. Nothing more. The framing "autonomous shipping" was retired; this is not deploy or merge automation.
- **Evidence handling**: the skill *accepts* manual screenshots / Loom recordings supplied by the user. It does **not** attempt automated capture. The dev-server cost and the long tail of UI/flag edge cases (features behind flags that may not be enabled) make automated capture out of scope.

## Summary

**The local `mr` skill rigidified Lynch's article into a fixed `Impact / Motivation / Implementation Notes` template.** Lynch's article does not prescribe that template — it offers a *menu* of sections and explicitly says "For a simple change, a one-line commit message could be sufficient. The more complex the change, the more detail the commit message needs." His own worked example uses prose + a bullet list, not three fixed headings.

**CE's `pr-description-writing.md` is much closer to Lynch's actual intent than the local `mr` skill is.** CE has explicit adaptive sizing (typo / small / medium / large / perf), choosing structure by change weight, and a core principle ("the diff is already visible — don't restate it") that generalizes Lynch's title rule to the whole body.

**The cleanest design for the new skill is CE's bones with Lynch's menu and the `mr` skill's preservation/iteration hooks.** Take CE's mode dispatch, Step 1–5 structure, branch-state safety, evidence decision tree, and `--body-file` discipline. Replace CE's body-composition guidance with a Lynch-derived menu of optional sections. Carry over from `mr`: Linear MCP motivation pull, Cursor BugBot block preservation, and the "title = effect, not mechanism" worked-examples table.

## Detailed Findings

### Source 1 — `ce-commit-push-pr/SKILL.md`

**Path:** `plugins/compound-engineering/skills/ce-commit-push-pr/SKILL.md` in `EveryInc/compound-engineering-plugin`.

**Frontmatter description:** "Commit, push, and open a PR with an adaptive, value-first description that scales in depth with the change. Use when the user says 'commit and PR', 'ship this', 'create a PR', or 'open a pull request'. Also handles description-only flows ('write a PR description', 'rewrite the PR body', 'describe this PR') without committing or pushing."

#### Mode dispatch (explicit)

- **Description-only** — user wants just a description. Run Step 4 only; print result. Apply only if asked.
- **Description update** — refresh/rewrite existing PR description, no commit/push. Run Step 4 in PR mode → Step 5 to preview, confirm, apply via `gh pr edit`.
- **Full workflow** — Steps 1–5 in order.

#### Context block

Uses Claude Code's `!` prefix slash-command pre-population for `git status`, `git diff HEAD`, `git branch --show-current`, `git log --oneline -10`, `git rev-parse --abbrev-ref origin/HEAD`, and `gh pr view --json url,title,state`. Provides a portability fallback (`Context fallback` shell block) for other harnesses.

#### Step 1 — branch routing

Decision tree for branch state:
- **Detached HEAD** → ask whether to create a feature branch; derive name from change content.
- **On default branch with work** → ask whether to create feature branch (no direct default-branch push).
- **On default branch with no work** → report and stop.
- **Feature branch** → continue.

Captures existing PR URL from `gh pr view` if `state: OPEN` for routing in Step 5.

#### Step 2 — conventions

Sharp opinion worth borrowing:
> "Match repo style for commit messages and PR titles (project instructions in context > recent commits > conventional commits as default). With conventional commits, default to `fix:` over `feat:` when ambiguous — adding code to remedy broken or missing behavior is `fix:`. Reserve `feat:` for capabilities the user could not previously accomplish."

#### Step 3 — commit splitting & push

- Group at **file level only** — no `git add -p`.
- 2–3 commits max when concerns are naturally distinct; one commit when ambiguous.
- **Avoid `git add -A` and `git add .`** — they sweep `.env`, build artifacts, and generated files.
- Always `git add file1 file2 file3 && git commit ...` with explicit paths.
- Push via `git push -u origin HEAD`.
- Reads `references/branch-creation.md` before continuing if branch creation is needed.

#### Step 4 — composition

Delegates to `references/pr-description-writing.md` ("You MUST read this in full"). Adds an **evidence decision tree** before composition:

1. **User explicitly asked for evidence** → proceed to capture.
2. **Agent judgment**: if the change is non-observable (internal plumbing, type-only, backend refactor without user-facing effect, docs/CI/test-only, pure refactors), skip the prompt without asking.
3. Otherwise, if the branch diff has observable behavior (UI, CLI output, API behavior with runnable code, generated artifacts, workflow output) AND evidence is not blocked (paid services, deploy-only infra, hardware), ask: "This PR has observable behavior. Capture evidence?"

Three answers: **Capture now** (loads `ce-demo-reel` → splice `## Demo` section); **Use existing evidence** (ask for URL/embed → splice `## Demo`); **Skip** (proceed without).

#### Step 5 — apply and report

- **Description-only** — print, stop unless asked to apply.
- **New PR** — `gh pr create` via `--body-file`. Report URL.
- **Existing PR** — commits already on PR from Step 3. Report URL, ask whether to rewrite description.
- **Description update / rewrite confirmed** — **preview before applying**: "New title: `<title>` (`<N>` chars). Summary leads with: `<first two sentences>`. Total body: `<L>` lines. Apply?"

#### Body-file safety (notable)

The body **must** be written to a temp file and passed via `--body-file <path>`. Never use:
- `--body-file -` (stdin)
- stdin pipes
- heredoc-to-stdin
- `--body "$(cat ...)"`

> "wrappers and stdin handling can silently produce an empty PR body while `gh` still exits 0 and returns a URL."

Pattern:
```bash
BODY_FILE=$(mktemp "${TMPDIR:-/tmp}/ce-pr-body.XXXXXX") && cat > "$BODY_FILE" <<'__CE_PR_BODY_END__'
<body markdown>
__CE_PR_BODY_END__
```
Quoted sentinel `'__CE_PR_BODY_END__'` blocks `$VAR`, backticks, and literal `EOF` expansion.

#### Asking the user

Skill specifies the platform-specific blocking-question tool for each harness (Claude Code: `AskUserQuestion`; Codex: `request_user_input`; Gemini: `ask_user`; Pi: `ask_user`). Never silently skip a question.

### Source 2 — `pr-description-writing.md` (the heart of the composition logic)

**Core principle** (quoted verbatim):
> "The diff is already visible on GitHub. The description exists to explain what the diff cannot show: what was impossible before and is now possible, what was broken and is now fixed, what shape changed. Cut any sentence a reader could reconstruct from the diff itself."

Anti-pattern example:
> Bad: "Adds `evidence-decider.ts`, modifies `ce-commit-push-pr/SKILL.md` to call it, and updates two test files."
> Good: "Evidence capture now decides automatically whether a change has observable behavior. CLI tools and libraries are now eligible alongside web UIs."

#### Pre-A — resolve range and base

Two modes (current-branch vs PR-mode). For PR mode: `gh pr view <ref> --json baseRefName,headRefOid,url,body,state,isCrossRepository,headRepositoryOwner`. Stop if not `OPEN`.

For current-branch: resolve `<base>` in priority order — caller-supplied → `git rev-parse --abbrev-ref origin/HEAD` → `gh repo view --json defaultBranchRef` → try `main`/`master`/`develop` via `git rev-parse --verify origin/<candidate>` → ask user.

Fork PRs: match base owner/repo against `git remote -v`; if no local remote matches, skip to `gh pr diff` fallback.

GHES quirk for fetching by SHA:
```bash
git fetch --no-tags <base-remote> "refs/pull/<number>/head"
PR_HEAD_SHA=$(awk '/refs\/pull\/[0-9]+\/head/ {print $1; exit}' "$(git rev-parse --git-dir)/FETCH_HEAD")
```

#### Step A — size the description

| Change profile | Description approach |
|---|---|
| Small + simple (typo, config, dep bump) | 1–2 sentences, no headers. Under ~300 characters. |
| Small + non-trivial (bugfix, behavioral change) | 3–5 sentences. No headers unless two distinct concerns. |
| Medium feature or refactor | Narrative frame, then what changed and why. Call out design decisions. |
| Large or architecturally significant | Narrative frame + 3–5 design-decision callouts + brief test summary. Target ~100 lines, cap ~150. Summary table for many mechanisms; no H3 per mechanism. |
| Performance improvement | Include before/after measurements as a markdown table. |

> "Match weight to weight. When in doubt, shorter wins. Subtract fix-up commits (review fixes, lint, rebase resolutions) when sizing — they're invisible to the reader. Large PRs need more selectivity, not more content."

#### Step B — title

`type: description` or `type(scope): description`.

- Type by intent, not file extension.
- "When `fix` and `feat` both seem to fit, default to `fix` — adding code to remedy missing behavior is `fix`. Reserve `feat` for capabilities the user could not previously accomplish."
- Description: imperative, lowercase, under 72 chars, no trailing period.
- "**Never use `!` or `BREAKING CHANGE:` without explicit user confirmation** — they trigger automated major-version bumps."

#### Step C — body

Order: opening → body sections that earn their keep → test plan if non-obvious → evidence block if present → CE badge after `---`.

- Opening under `## Summary` if body uses any `##` headings; bare paragraph otherwise. No orphaned opening above the first heading.
- **Evidence handling**: preserve existing `## Demo` / `## Screenshots` block verbatim unless asked to refresh. Splice freshly captured URL as `## Demo`. Never label test output as "Demo" / "Screenshots".
- **Visual aids**: Mermaid + tables for relationships, flows, state transitions, sequences, trade-offs, before/after. Inline at point of relevance. Skip for simple/prose-clear/rename/dep-bump. **Prose is authoritative when conflicting with a visual.**
- **GitHub gotcha**: never prefix list items with `#` (auto-links `#1` as issue ref). Use `org/repo#123` or full URL.

#### Step D — badge

CE-specific. Includes harness/model badge with URL-encoded parens (`%28` / `%29`) — "unencoded parens inside markdown image URLs break release-please's commit parser, which silently drops the commit from the changelog."

### Source 3 — `branch-creation.md`

Decision flow:
1. `git fetch --no-tags origin <base>`.
2. Check unpushed commits: `git log origin/<base>..HEAD --oneline`. If non-empty, ask: "Carry forward N unpushed commits onto the new feature branch, or leave them on local `<base>`?" Never default silently.
3. `git checkout -b <branch-name> "$BASE_REF"`. If checkout fails due to uncommitted overwrite, stash with descriptive name and retry; surface conflicts on `stash pop` rather than auto-resolving.

Fetch-failure fallback: branch from current local HEAD and note that base freshness was not verified.

### Source 4 — Lynch's *How to Write Useful Commit Messages*

**Article URL:** `https://refactoringenglish.com/chapters/commit-messages/` (saved HTML at `~/Downloads/`).

**Author position:** Michael Lynch, 20 years experience. Article published 2025-03-07. Excerpted from his upcoming book *Refactoring English*.

#### Four purposes of a commit message (in priority order)

1. **Helps the code reviewer** — "the most important scenario for a commit message."
2. **Communicates changes to teammates, downstream clients, end-users.**
3. **Facilitates future bug investigations** (years/decades later).
4. **Provides information to development tools** (release notes, cross-references).

#### Organizing information

- **Put the most important information first** — journalistic inverted pyramid. Reader stops when they have what they need.
- **Use headings to structure *long* commit messages.** Conditional, not universal. Lynch's own example uses Background / Motivation / Alternative 1 / Alternative 2 — chosen for the specific change, not a fixed template.

#### Title rubric (worked examples)

> "The title should describe the effect of the change rather than how you implemented it."

| Bad (mechanism) | Good (effect) |
|---|---|
| Add a mutex to guard the database handle | Prevent database corruption during simultaneous sign-ups |

#### Menu of sections (NOT a fixed template)

> "For a simple change, a one-line commit message could be sufficient. The more complex the change, the more detail the commit message needs."

> "The following is a mostly-exhaustive list of details that could be useful in a commit message."

Sections, in Lynch's priority order:
1. **A descriptive title.**
2. **A summary of how the change impacts clients and end-users.**
3. **The motivation for the change.**
4. **Breaking changes** with a recognizable convention.
5. **External references** — only non-obvious resources. Don't dump browser history.
6. **Justifications for new dependencies** — flag dependency additions and explain selection.
7. **Cross-references to issues or other changes** — `#1234`, auto-closing keywords like `Fixes`.
8. **Summaries of bugs or external references** — *summarize the relevant context, don't just link*. Worked example contrasts `Fixes #1234` alone vs. a paragraph explaining the BreakRandomWebsites extension scenario.
9. **Testing instructions** — when automated tests don't exist.
10. **Testing limitations** — disclose what scenarios weren't tested (e.g., "I don't have a bare-metal RISC-V machine to test this on, but emulated via qemu").
11. **What you learned** — "You'll be glad you wrote it down while it's fresh." Worked example: bash pipelines actually run jobs simultaneously.
12. **Alternative solutions you considered** — "Ideally, the explanation should live in a comment within the code itself rather than in the commit message." But for decisions with no logical home in code (e.g., "I originally tried `std.xml.Parser` but it doesn't include line-level metadata"), include in commit.
13. **Searchable artifacts** — for changes related to unique error messages, include the error text so `git log --grep` finds it later.
14. **Screenshots or videos** — supplement, not replace. A 15-second demo can be enough. Rambly 5-minute screencasts are poor substitutes.
15. **Rants and stories** — fun and sometimes informative, **save them until the end**. Worked example shows critical detail buried in 50-paragraph yarn vs. lead-with-fact + rant-at-end.
16. **Anything you're tempted to explain outside of the commit message** — emails, hallway chats, lectures at the desk. "Resist the temptation… do it in the commit message."

#### Leave out

1. **Information obvious from the code** — file list, APIs called, change size.
2. **Critical maintenance details** — too important to bury; they belong in *code comments* with automated checks (worked example: 2:1 offset ratio between `disk.c` and `file.c`).
3. **Short-term discussion** — PR comments, not commit body.
4. **Preview URLs and build artifacts** — tooling concern; "the more toil you add to the commit message, the more people will perceive it as a mechanical chore."

### Source 5 — local `mr` skill

**Path:** `/Users/bruno.azevedo/.claude/skills/mr/SKILL.md`. GitLab-focused. Pure writing aid (no git execution).

#### Structure (paraphrased)

- **Step 1 — motivation**: Linear issue or user's explanation. Linear MCP tools are used to extract context. Provide preliminary draft in first reply, don't wait for all details.
- **Step 2 — ask only for genuine gaps**: breaking changes, testing instructions when non-obvious. Two redirects: if user mentions alternative solutions → suggest code comment; if user shares rules future devs must follow → suggest code comments/linting.
- **Step 3 — write the commit message**:
  - Title: `type(scope): subject`, ≤50 chars, lowercase, default scope `time-off`.
  - **Body uses fixed three-heading template**: `## Impact` / `## Motivation` / `## Implementation Notes` (with "Omit entirely if nothing notable — don't pad it" for Implementation Notes).
- **Step 4 — copy-paste output**: title + body as separate blocks.
  - **BugBot preservation**: preserves Cursor BugBot block delimited by `<!-- CURSOR_SUMMARY -->` … `<!-- /CURSOR_SUMMARY -->` verbatim at end of MR description.
- **Step 5 — iterate** on feedback.

#### Where `mr` matches Lynch

- "Effect over mechanism" title rubric with the same mutex worked example.
- Inverted-pyramid framing in the body.
- Cross-reference issues with brief context (`#1234`, `Fixes #567`).
- Wrap component names / code symbols in backticks.
- Lessons learned as valuable content.
- Screenshots for UI changes.

#### Where `mr` diverges from Lynch

- **Fixed three-heading template** vs. Lynch's menu. `mr`'s `Impact / Motivation / Implementation Notes` is one choice; Lynch's article doesn't prescribe it.
- **Default scope `time-off`** is repo-specific; `mr` is essentially specialized to one Remote codebase. Lynch is repo-agnostic.
- **Title ≤50 chars** (`mr`) vs. ≤72 chars (CE / Conventional Commits). Lynch doesn't pin a number.
- `mr` doesn't include Lynch's "searchable artifacts (error message text)", "testing limitations", "alternatives belong in code first if possible", "dependency justifications" as named guidance.

## Synthesis — what to take from each source

### From `ce-commit-push-pr` (the bones)

- **Mode dispatch** (description-only / description-update / full workflow) — three distinct entry points, not one.
- **Step 1 branch routing** — the four-way decision tree (detached / default-with-work / default-no-work / feature) is well-shaped.
- **Step 2 convention precedence**: project instructions > recent commits > conventional commits default. Plus the `fix:` vs `feat:` rule.
- **Step 3 commit-splitting hygiene** — file-level grouping, 2–3 commits max, no `git add -A`/`.`, explicit paths.
- **Step 4 evidence decision tree** — keep the *decision* (when to ask about evidence) but simplify the *answers*. No automated capture. Two answers only: "use existing evidence" (paste URL or markdown embed) and "skip". The Loom/screenshot is produced by the user out-of-band.
- **Step 5 preview-before-apply** — the "new title `<X>` (<N> chars), summary leads with `<first two sentences>`, total body `<L>` lines" preview pattern.
- **`--body-file` safety** — temp file + quoted-sentinel heredoc, never stdin. This is non-obvious and the failure mode is silent.
- **`AskUserQuestion` blocking-tool guidance** — always block, never silently skip.
- **`pr-description-writing.md` Core Principle** — "the diff is already visible; describe what was impossible before / broken / shape changed." This generalizes Lynch's title rule.
- **Pre-A range/base resolution** — including fork PR handling, GHES quirks, and the `gh pr diff` fallback.
- **Step A adaptive sizing tiers** — typo / small / medium / large / perf. This is the missing piece from `mr`.
- **Step C body assembly order** — opening → body → test plan → evidence → badge.
- **Visual-aids guidance** with the "prose is authoritative when conflicting with a visual" rule.
- **GitHub `#` list-prefix gotcha.**

### From Lynch (the values)

- **Title-rubric worked-examples table** — keep the mutex example; reuse Lynch's other pairs.
- **Menu of optional sections** to replace `mr`'s fixed template. CE has size tiers but doesn't enumerate sections; Lynch enumerates sections but doesn't tier them. Combine.
- **"Summarize bugs, don't just link"** — explicit guidance at the cross-reference step.
- **"Searchable artifacts"** — include error message text verbatim somewhere when the change is error-related.
- **"What you learned"** as a first-class optional section.
- **"Alternatives belong in code first"** — only put them in the commit when they don't have a home in code.
- **"Testing limitations"** as a distinct section from testing instructions.
- **"Dependency justifications"** as a flag-required item.
- **"Rants at the end, not the top."**
- **"Anything you're tempted to explain outside the commit"** principle — counter to inline lectures.
- **"Leave out" list** — obvious-from-code, maintenance-critical-rules (belong in code), short-term discussion (belongs in PR comments), preview URLs.

### From `mr` (the local hooks)

- **Linear MCP integration** for motivation gathering — CE relies on diff only. Bruno's day-to-day workflow benefits from pulling the issue context.
- **Cursor BugBot block preservation** — `<!-- CURSOR_SUMMARY -->` blocks. CE has a parallel pattern for `## Demo` / `## Screenshots`; generalize.
- **Iterative refinement loop** as an explicit step — `mr` Step 5 surfaces this; CE handles it via preview-then-confirm.

### What to drop from each

- **From CE**: the Compound Engineering badge (replace with a dev-workflow badge or drop). **The `ce-demo-reel` automated-capture flow entirely** — not just because there's no equivalent skill, but because the cost/edge-case profile is wrong for Bruno's workflow. Local dev is slow to start, features are often gated behind flags that may not be enabled, and recording UI states reliably is a long tail of edge cases. Manual screenshots / Loom recordings are how Bruno actually captures evidence; the skill should accept that as an input, not try to automate it.
- **From Lynch**: the "rants" section is fun but undercuts PR utility in a professional shipping skill — keep the principle ("if you include color, save it for the end"), drop the explicit invitation.
- **From `mr`**: the fixed three-heading template; the hardcoded `time-off` scope; the 50-char title cap; the GitLab-only orientation.

### Tension points to resolve in the brainstorm

1. **Body composition**: pure menu-of-sections (Lynch) vs. size-tiered scaffolds (CE) vs. fixed template (`mr`). **Recommendation**: size-tiered scaffolds *that select from* the Lynch menu — tier sets a budget and a default skeleton, but the author picks which sections to include based on what the change has.
2. **GitHub vs GitLab**: CE is `gh`-only; `mr` is `glab`-implicit. **Recommendation**: detect the remote host and dispatch to the right CLI, sharing the body-composition logic.
3. **Linear integration**: keep it as an *optional* motivation source — fall back to diff-derived motivation when no Linear issue is supplied. Don't make Linear MCP a hard dependency.
4. **Demo block preservation**: generalize CE's `## Demo` / `## Screenshots` preservation rule to also handle Cursor BugBot blocks (`<!-- CURSOR_SUMMARY -->`) and any other automation-managed block.
5. **Commit message vs PR description divergence**: CE writes them as essentially the same content. `mr` writes them as the same content. Lynch's article is *only* about commit messages and treats PR description as something you can convert from a commit message. **Recommendation**: keep them aligned by default (commit message body = PR body), with an explicit option to diverge when needed (e.g., for squash-merge workflows where the PR description becomes the squashed commit message).
6. **Convention scope**: CE detects per-repo; `mr` hardcodes `time-off`. **Recommendation**: detect per-repo via project instructions / `git log` style, falling back to Conventional Commits.

## Code References

- `~/.claude/skills/mr/SKILL.md:46–67` — the fixed `Impact / Motivation / Implementation Notes` template that Bruno wants to revisit.
- `~/.claude/skills/mr/SKILL.md:83` — the Cursor BugBot block preservation rule.
- `~/.claude/skills/mr/SKILL.md:23–31` — Linear MCP motivation gathering.
- Local HTML: `~/Downloads/How to Write Useful Commit Messages · Refactoring English.html` — Lynch's full article (saved 2025-03-07 publication).

## Architecture Insights

- **CE's separation of skill orchestration (`SKILL.md`) from composition logic (`references/pr-description-writing.md`)** is a clean pattern for a shipping skill of any size. The orchestration is short and decision-tree-heavy; the composition reference is detailed and prescriptive. Worth replicating.
- **The body-file safety pattern** is a small but high-leverage piece of operational discipline — silent-empty-body failures are the kind of bug that's invisible until a stakeholder complains the PR has no description.
- **"Match weight to weight"** as a sizing principle is more useful than any specific template, because reviewers' attention budget scales with diff size, not with the author's enthusiasm.
- **The diff is already visible** is a sharper principle than "effect over mechanism" because it applies to every sentence in the body, not just the title.

## Historical Context (from docs/research/)

No prior research documents on shipping skills, commit messages, or `mr`-skill design were found in `docs/research/`. This is the first research note on this topic.

## Related Research

None yet. Future related research may include:
- A comparison of conventional-commit dialects across teams Bruno works with.
- A design-it-twice analysis of the body composition interface (template vs menu vs size-tier).

## Open Questions

1. Should the new skill live under `dev-workflow` as `ba:ship` (parallel to `ba:execute`, `ba:review`, etc.) or as a top-level skill outside the `ba:` namespace? It does not fit the "research and document" mold of most `ba:` commands, but it is implementation-adjacent.
2. Does the user want a single skill that handles both GitHub and GitLab, or two skills (`ba:ship-gh` / `ba:ship-gl`)? The composition logic is shared; only the CLI invocation diverges.
3. How should the skill interact with `ba:review` — should it auto-run review before shipping, or assume review has already happened?
4. **Resolved 2026-05-17**: scope is exactly what CE's name says — *commit, push, create PR with a good commit message*. "Autonomous shipping" was the wrong framing; this is not deployment or merge automation. The iteration loop from `mr` still applies as a refinement step inside that scope (e.g., preview-then-confirm before applying a PR description rewrite).
5. Should "what you learned" (Lynch) auto-populate from anything in the dev-workflow context (e.g., recent `docs/solutions/` entries)? Could be a high-value integration with `/ba:compound`.
