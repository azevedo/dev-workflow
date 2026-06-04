---
title: "feat: Add /ba:handoff command"
type: feat
status: active
date: 2026-06-04
origin: docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md
detail_level: minimal
iteration_count: 0
tags: [command, handoff, plugin, productivity, multi-claude]
---

# feat: Add /ba:handoff command

Add a `/ba:handoff [focus]` command at `commands/ba/handoff.md`. When invoked, it
compacts the current conversation into a handoff document saved to the OS temp
directory (`$TMPDIR`) so a fresh or parallel session can pick up the work without
re-reading the transcript.

The body is an **integrated rewrite** of Matt Pocock's
[`handoff`](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md)
skill — single coherent voice, no labeled "Bruno-specific notes" seam — weaving
dev-workflow artifact awareness, git-state capture, and exact slash-invocation
suggestions into Matt's spine (see brainstorm:
docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md, `## Why This Approach`,
approach 3).

Docs-only change: one new command file plus three small registry/version edits.
No production code.

## Design change from the brainstorm — command, not skill

> **Why this plan diverges from the brainstorm's "skill" decision.** The brainstorm
> chose to ship handoff as a *skill* (`skills/handoff/SKILL.md`) invoked as
> `/ba:handoff`, on the premise that "`ba:` is the plugin-wide namespace, commands
> and skills alike." **That premise is technically false** (verified against the
> Claude Code plugin docs): plugin skills are namespaced by the plugin's `name`, so
> `skills/handoff/SKILL.md` would invoke as `/dev-workflow:handoff` — there is no
> `/ba:handoff` form for a skill. The `ba:` prefix on this plugin's commands comes
> from the `commands/ba/` **subdirectory**, which skills have no equivalent of.
>
> Bruno chose to preserve the `/ba:handoff` invocation (muscle-memory consistency
> with every other command) over the "skill" container. So the capability ships as
> a **command** at `commands/ba/handoff.md` (`name: ba:handoff`), invoked as
> `/ba:handoff` (full form `/dev-workflow:ba:handoff` — verified: this planning
> session was itself invoked as `/dev-workflow:ba:plan`).
>
> **What carries over unchanged:** the integrated body, all eight substantive
> content points, and every scope boundary. Only the container changes
> (skill → command) and labels follow ("suggested skills" → "suggested next
> steps", since the things to invoke in this plugin are commands). **Trade-off
> accepted:** a command is explicit-invocation only — no model auto-trigger.
>
> **Premise corrections this triggers** (tracked in Follow-up Corrections below):
> the brainstorm's invocation resolution, the CLAUDE.md `ba:`-prefix convention
> bullet, and the `feedback_ba_prefix_is_plugin_wide` memory all rest on the same
> wrong premise and are corrected.

## Acceptance Criteria

*(adapted from brainstorm: docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md, `## Acceptance Criteria` — "skill" → "command", invocation now genuinely `/ba:handoff`)*

- [ ] `commands/ba/handoff.md` exists and loads as a command when the plugin is installed; `/ba:handoff` (and `/dev-workflow:ba:handoff`) invoke it.
- [ ] Frontmatter contains `name: ba:handoff`, plus a `description` and `argument-hint` consistent with the body (three-key command shape).
- [ ] Body reads as a single coherent command — no labeled "Bruno-specific notes" section or other visible upstream-vs-local seam.
- [ ] Body covers, in some form, the eight substantive points: compact + save to `$TMPDIR`; git context; reference-don't-restate with dev-workflow paths called out; `/ba:execute` slice context; suggested next steps as exact slash invocations; redact sensitive info; verified facts only; honour the user's argument as next-session focus.
- [ ] Invoking `/ba:handoff` writes the handoff doc to `$TMPDIR` and tells the user the exact path.
- [ ] A handoff doc produced by the command references in-repo artifacts by path rather than restating their content.
- [ ] `.claude-plugin/plugin.json` version is bumped `0.19.0` → `0.20.0`.
- [ ] `README.md` lists `/ba:handoff` under `## Commands`, and the Roadmap line for `/ba:handoff` is marked shipped.
- [ ] `CLAUDE.md` registers the command (new `### Session Commands` category) and the `ba:`-prefix convention bullet is corrected to state `ba:` is a command-only namespace.

## What We're NOT Doing

*(carried from brainstorm: docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md, `## Scope Boundaries`)*

- Not changing the save target away from OS tempdir (`$TMPDIR`).
- Not adding a prescriptive handoff-doc template inside the command — the writing agent decides structure based on what the session produced.
- Not adding hook enforcement (e.g. PreToolUse) for handoff invocation.
- Not creating a user-scoped variant — plugin-only.
- Not auto-redacting PII via tooling — relies on the command's "redact sensitive information" instruction (best-effort by the model).
- Not adding a `skills/` directory or shipping handoff as a skill (see Design change above).
- Not touching `.claude-plugin/marketplace.json` — its embedded `version: 0.1.0` is pre-existing drift unrelated to this change; flagged, not fixed.

## Behaviors to Test

The command is an instruction document, so "behaviors" are what a competent agent
produces when it follows the body. Each line is a candidate manual check against a
doc the command writes.

- [ ] Writes the handoff doc to `$TMPDIR` (fallback `/tmp`) and reports the exact path to the user.
- [ ] Captures git state — branch, dirty/clean, pushed/unpushed — as git actually reports it.
- [ ] When invoked outside a git repository, notes "not in a git repository" instead of pasting a fatal error or omitting the section silently.
- [ ] References in-repo artifacts (incl. `docs/brainstorms/`, `docs/plans/`, `docs/research/`, `docs/solutions/`, `docs/reviews/`) by path rather than restating their content.
- [ ] When mid-`/ba:execute`, names the plan path and the slice number reached.
- [ ] Includes a "Suggested next steps" section with exact slash invocations (e.g. `/ba:execute docs/plans/<file>.md`), not prose hints.
- [ ] Redacts obvious secrets (API keys, tokens, PII) and does not claim the doc is guaranteed clean.
- [ ] States only verified facts; uncertain items are labeled "not verified this session" rather than asserted.
- [ ] When the user passes an argument, leads with that focus — but still includes git state, execute context, redaction, and verified-facts (argument controls emphasis, not omission).
- [ ] When there's nothing worth handing off, says so and does not write an empty file.

## Context

**Origin.** Approved brainstorm: `docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md`
(status: approved). It fixes the design intent; this plan mechanizes it, correcting
the one technical premise it got wrong (see Design change above).

**Repo facts (verified during research):**

- `.claude-plugin/plugin.json:3` — current `version` is `0.19.0`; the manifest declares **no** `commands`/`agents`/`skills` keys (directory-discovered). → no manifest structure change beyond the version bump.
- Command frontmatter precedent (three-key shape, `name: ba:<name>`): `commands/ba/plan.md:1-5`, `commands/ba/brainstorm.md:1-5`, `commands/ba/compound.md:1-5` (compound quotes its `description` because it contains a period/apostrophe — same reason this command's description is quoted).
- README command subsections use **backticked** `### \`/ba:<name> [args]\`` headings (README.md:72–152; e.g. `### \`/ba:slice [plan]\`` at :112, `### \`/ba:compound [context]\`` at :152). `### /ba:propose …` (:169) is an un-backticked outlier — do **not** copy it; use the backticked majority form.
- The Roadmap lists `/ba:handoff` as pending at **README.md:268**; shipped Roadmap items carry a trailing ✅ (README.md:265-267).
- CLAUDE.md version-bump convention at `CLAUDE.md:70`; README-update convention at `CLAUDE.md:79`. The `ba:`-prefix convention bullet (`CLAUDE.md:67` region — "Plugin prefix: `ba:` … applies across commands AND skills") is the factually-wrong line being corrected.

**Invocation forms (verified):**

- Commands: `/ba:<name>` (short) and `/dev-workflow:ba:<name>` (full). Ground truth: this session was invoked as `/dev-workflow:ba:plan`.
- Skills (for the corrected convention text): `/dev-workflow:<skill>` — namespaced by plugin name, no `ba:` segment.

**`$TMPDIR` + git-state idioms** (reuse exactly):

- Temp file: `commands/ba/propose.md:458` — `$(mktemp "${TMPDIR:-/tmp}/ba-propose-commit.XXXXXX")`. The `${TMPDIR:-/tmp}` fallback + X's-at-the-end template is the repo convention.
- Git state: `commands/ba/propose.md:94` — `git status --porcelain=v2 --branch` gives branch + dirty/clean + ahead/behind (pushed/unpushed) in one call.

**Verified `mktemp` gotchas (tested on this macOS/BSD machine — the one place a plausible instruction silently breaks):**

| Form | Result | Verdict |
|---|---|---|
| `mktemp "${TMPDIR:-/tmp}/ba-handoff.XXXXXX"` | `/tmp/.../ba-handoff.8dZrAN` — honors `$TMPDIR`, randomized | ✅ use this |
| `mktemp "${TMPDIR:-/tmp}/ba-handoff-XXXXXX.md"` | creates a **literal** file named `ba-handoff-XXXXXX.md` (BSD treats mid-template X's literally) | ❌ |
| `mktemp -t ba-handoff` | `/var/folders/.../T/...` — **ignores** `$TMPDIR` | ❌ |

So the body prescribes Form A verbatim (X's at the end, no suffix) and warns off `-t` and GNU-only flags. No `.md` extension — matches the repo idiom; the path is communicated to the user explicitly, and `mktemp`'s uniqueness guarantee matters precisely in the multi-claude/parallel case.

**Edge-case sentences woven in** (from spec-flow analysis — instruction granularity, no decision tree, per the brainstorm's no-template intent): git guard before status; "not in a git repository" fallback; nothing-to-hand-off → decline to write; argument controls emphasis not omission; verified-when-uncertain → label it; best-effort redaction with honest limitation.

## MVP

### `commands/ba/handoff.md` *(new)*

````markdown
---
name: ba:handoff
description: "Compact the current conversation into a handoff document for a fresh or parallel session to continue from — captures git state, references in-repo artifacts by path, and suggests exact next steps, saved to $TMPDIR."
argument-hint: "[what the next session will focus on]"
---

Write a handoff document that compacts the current conversation so another agent — or a fresh session of your own — can continue the work without re-reading the transcript. Save it to the user's OS temporary directory, never the workspace.

Create the file with `mktemp` so parallel sessions never collide on the name:

```bash
HANDOFF_FILE=$(mktemp "${TMPDIR:-/tmp}/ba-handoff.XXXXXX")
```

Use exactly this form. Do **not** use `mktemp -t` (it ignores `$TMPDIR` on macOS and writes to `/var/folders/...`), and do **not** put `XXXXXX` before a suffix like `-XXXXXX.md` (BSD `mktemp` treats those Xs literally and creates a file actually named `XXXXXX`). Once the doc is written, tell the user its exact path — parallel sessions can't see each other's context, so the path is how the next Claude finds the handoff.

If the session produced nothing worth handing off, say so to the user and don't write a file.

## What the document must carry

**Git state.** Record where the code stands so the next session doesn't have to rediscover it:

```bash
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git status --porcelain=v2 --branch   # branch, dirty/clean, ahead/behind (pushed/unpushed)
fi
```

Name the branch, whether the tree is clean or dirty, and whether commits are pushed. Report exactly what git reports — don't invent a branch name or an upstream that isn't there. If there's no repository, note "not in a git repository" instead of git state.

**In-repo artifacts — reference, don't restate.** When a fact already lives in a file, point to it by path instead of copying its content. This includes dev-workflow artifacts: `docs/brainstorms/`, `docs/plans/`, `docs/research/`, `docs/solutions/`, and `docs/reviews/`. The same applies to PRDs, ADRs, issues, commits, and diffs — cite them, don't duplicate them.

**`/ba:execute` progress.** If the session was executing a plan, name the plan path and the slice number you reached (e.g. "mid-execute on `docs/plans/2026-06-04-feat-…-plan.md`, slice 3 of 5") so the next session resumes in the right place.

**Suggested next steps.** Add a "Suggested next steps" section listing the *exact* slash invocations the next agent should run — not prose hints. For example:

- `/ba:execute docs/plans/2026-06-04-feat-handoff-command-plan.md` — resume implementation
- `/ba:review HEAD~3..HEAD` — review what landed

## Always, regardless of the argument

- **Redact sensitive information.** Strip API keys, tokens, passwords, `.env` contents, full auth headers, and PII. Redaction is best-effort by eye — there's no scrubber behind it, so don't claim the doc is guaranteed clean; just don't write a secret into it.
- **State only verified facts.** Every path, branch, ID, and test result must come from something you actually observed this session. Don't fabricate file paths, commit SHAs, ticket IDs, or claims that tests passed. If you're summarizing from memory and aren't sure, label it "not verified this session" rather than asserting it.
- **Honour the argument.** If the user passed an argument to `/ba:handoff`, treat it as the next session's focus and lead with what that session needs. The argument controls emphasis and ordering only — it never licenses dropping git state, in-flight execute context, redaction, or the verified-facts rule.

Structure the document however the session's actual content warrants — there is no fixed template. A short session needs a short handoff.
````

### `.claude-plugin/plugin.json`

Bump the version (line 3) — no other change:

```json
  "version": "0.20.0",
```

### `README.md`

**(a)** Insert a backticked `### \`/ba:handoff [focus]\`` subsection under `## Commands` (after the `/ba:propose` section, before the `### Severity ladder …` subsection at README.md:183):

```markdown
### `/ba:handoff [focus]`

Compacts the current conversation into a handoff document saved to your OS temp directory (`$TMPDIR`), so a fresh or parallel session can pick up the work without re-reading the transcript.

- **Git-state aware** — records branch, dirty/clean, and pushed/unpushed so the next session knows where the code stands
- **References, doesn't restate** — points at in-repo artifacts by path (`docs/brainstorms/`, `docs/plans/`, `docs/research/`, `docs/solutions/`, `docs/reviews/`) instead of duplicating them
- **Execution-aware** — if you're mid-`/ba:execute`, names the plan path and the slice number reached
- **Suggested next steps** — lists exact slash invocations for the next agent to run, not prose hints
- **Verified facts only** — redacts secrets and never fabricates paths, IDs, or test results

```

**(b)** Update the Roadmap line (README.md:268) to mark it shipped:

```markdown
- `/ba:handoff` — session continuity for multi-session work ✅
```

### `CLAUDE.md`

**(a)** Add a new command category after `### Knowledge Commands` and before `### Git Workflow Commands`:

```markdown
### Session Commands (capture context for handoff — never write code)

- `/ba:handoff [focus]` — Compact the current conversation into a handoff document (git state, in-repo artifact paths, suggested next steps) saved to `$TMPDIR` for a fresh or parallel session
```

**(b)** Correct the factually-wrong `ba:`-prefix convention bullet in `## Conventions`. Replace:

```markdown
- Plugin prefix: `ba:` — applies across commands AND skills (e.g. `/ba:plan`, `/ba:handoff`); not command-only
```

with:

```markdown
- Command namespace: `ba:` comes from the `commands/ba/` directory — every command invokes as `/ba:<name>` (full form `/dev-workflow:ba:<name>`). This namespace is command-only; plugin skills (if any are ever added) are namespaced by the plugin name (`/dev-workflow:<skill>`), not `ba:`
```

## Follow-up Corrections (premise fix)

The brainstorm's invocation decision rested on a wrong premise (skills get `ba:`).
Beyond the CLAUDE.md bullet above, two records need the same correction so the
mistake doesn't propagate:

- [ ] **Brainstorm** `docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md` — append a dated correction note (it already has a "Revised 2026-06-04" precedent) recording that the invocation premise was wrong and handoff ships as a command, not a skill. *(Done as part of this planning turn.)*
- [ ] **Auto-memory** `feedback_ba_prefix_is_plugin_wide` — correct to: `ba:` is a command-only namespace from `commands/ba/`; skills are namespaced by plugin name. *(Done as part of this planning turn — outside the repo, not a plan deliverable.)*

## Success Criteria

### Automated

- [ ] `test -f commands/ba/handoff.md` — command file exists
- [ ] `grep -q '^name: ba:handoff$' commands/ba/handoff.md` — correct command name
- [ ] `grep -q '^argument-hint:' commands/ba/handoff.md && grep -q '^description:' commands/ba/handoff.md` — required frontmatter keys present
- [ ] `grep -q 'mktemp "${TMPDIR:-/tmp}/ba-handoff.XXXXXX"' commands/ba/handoff.md` — prescribes the verified tempdir form
- [ ] `! grep -q 'Bruno-specific' commands/ba/handoff.md` — no labeled upstream-vs-local seam
- [ ] `grep -q '"version": "0.20.0"' .claude-plugin/plugin.json` — version bumped
- [ ] `grep -qF '### `/ba:handoff [focus]`' README.md` — backticked command heading added
- [ ] `grep -q '✅' <(grep '/ba:handoff' README.md)` — Roadmap line marked shipped
- [ ] `grep -q '### Session Commands' CLAUDE.md && grep -q '/ba:handoff' CLAUDE.md` — command registered in CLAUDE.md
- [ ] `! grep -q 'applies across commands AND skills' CLAUDE.md` — wrong `ba:`-prefix bullet removed/corrected

### Manual

- [ ] In a session where the plugin is installed/reloaded, `/ba:handoff` appears in the command list and invokes the command.
- [ ] Running `/ba:handoff some-focus` writes a doc under `$TMPDIR` and reports the exact path; the doc leads with `some-focus` but still carries git state and (if any) execute context.
- [ ] The produced doc references at least one in-repo artifact by path rather than restating it, and captures branch + dirty/clean + pushed state.
- [ ] Running `/ba:handoff` outside a git repo produces a doc noting "not in a git repository" without a fatal error.

## Convention Compliance

Validated by `convention-checker` against `CLAUDE.md` before writing this plan — **0 blocking violations after the README backtick fix**.

- [x] Command frontmatter `name: ba:handoff` — aligned (matches `commands/ba/plan.md` `name: ba:plan` etc.)
- [x] Bump `version` in `.claude-plugin/plugin.json` for every release — aligned (`0.19.0` → `0.20.0`, minor = feature add)
- [x] Update README.md when commands change — aligned; new heading uses the **backticked** `### \`/ba:handoff [focus]\`` majority style (convention-checker flagged the un-backticked form; corrected here), Roadmap line marked ✅
- [x] New `### Session Commands` category in CLAUDE.md — aligned (convention-checker endorsed a new category over folding into Knowledge/Quality; parenthetical matches existing grammar)
- [x] `ba:`-prefix convention bullet corrected — aligned-by-amendment (editing a factually-wrong convention is sanctioned, not a deviation; new wording verified: this session = `/dev-workflow:ba:plan`)
- [x] All artifacts require YAML frontmatter — aligned (command file + this plan)
- [x] Convention-compliance check mandatory before writing planning artifacts — aligned (two checker runs satisfy the gate)
- [x] Planning/execution/git-workflow command boundaries — N/A (this adds a command *definition*; the handoff command itself is read-only re: repo source — it writes a scratch file to `$TMPDIR`, captures git state read-only, never commits/pushes)
- [x] Agent-name-suffix conventions — N/A (no agent added)
- [x] `.claude-plugin/marketplace.json` stale `version: 0.1.0` — known pre-existing drift, **left untouched** per surgical-changes discipline; flag a separate issue if it matters

## Sources

- **Origin brainstorm:** `docs/brainstorms/2026-06-03-handoff-skill-brainstorm.md` — decisions carried forward: integrated rewrite (no seam), the eight substantive content points, all scope boundaries, `$TMPDIR` save target. **Corrected:** container is a command (not a skill) and invocation `/ba:handoff` is now genuinely achievable (the brainstorm's skill-gets-`ba:` premise was wrong).
- **Skill/command namespacing (the premise correction):** Claude Code plugin docs — https://code.claude.com/docs/en/plugins.md and https://code.claude.com/docs/en/plugins-reference.md. Plugin skills → `/plugin-name:skill`; the `ba:` command segment comes from `commands/ba/`.
- **Upstream (lineage, not contract):** Matt Pocock's `handoff` — https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md
- **Tempdir + git-state idioms:** `commands/ba/propose.md:94,458`
- **Frontmatter precedent:** `commands/ba/plan.md:1-5`, `commands/ba/brainstorm.md:1-5`, `commands/ba/compound.md:1-5`
- **README style + Roadmap line:** `README.md:112,152,169,268`
- **Conventions:** `CLAUDE.md:67` (`ba:` prefix — corrected), `CLAUDE.md:70` (version bump), `CLAUDE.md:79` (README update)
