---
title: Migrate ba commands to plugin skills (/ba-<name>)
type: refactor
plan_schema: 2
status: active  # human-authored only — /ba:execute ignores this for control flow (including status: completed); progress is git-derived
date: 2026-07-30
detail_level: comprehensive
tags: [infra, skills-migration, invocation-namespace, issue-41]
---

# Migrate `ba` Commands to Plugin Skills Implementation Plan

## Overview

Move the nine commands at `commands/ba/<name>.md` to plugin skills at `skills/ba-<name>/SKILL.md`,
invoked `/ba-<name>`. The colon namespace `ba:` was never owned by this plugin — it was derived from
the `commands/ba/` directory name, and Claude Code **2.1.216** stopped resolving that derivation for
plugin commands. Nothing the plugin can ship restores the short form, so the fix is to stop
depending on the colon and fold the `ba` identity into the skill name itself.

Tracked as GitHub issue 41 (`ready`, `cluster:infra`).

## Current State

- Nine commands, `commands/ba/{brainstorm,compound,execute,handoff,plan,propose,research,review,review-plan}.md`.
  Identical three-key frontmatter — `name: ba:<n>`, `description`, `argument-hint` — at lines 1–5
  of each (`commands/ba/plan.md:1-5`).
- `/ba:<name>` returns `Unknown command` as of 2.1.216: the resolver reads the segment before the
  first colon as a plugin name, finds no plugin `ba`, and bails. First transcript failure
  2026-07-21 on 2.1.216; clean across 173 sessions on 2.1.181–2.1.215.
- **~225** `/ba:` or `commands/ba/` references across 22 live non-`docs/` files; **~2400** more in
  `docs/`.
- `scripts/check-invariants.mjs:83` — `PROMPT_SURFACE_DIRS = ['commands', 'agents']`, and
  `:84` `VERSION_BUMP_WATCHED_PREFIXES` derives from it plus `references`. All three CI checks
  read the corpus through this one constant.
- `references/html-rendering.md` is a deliberate single shared source (`references/html-rendering.md:65`
  — "Single source — cited by `/ba:execute`, `/ba:review-plan`, and `/ba:handoff`. Do not [duplicate]"),
  cited from 5 command bodies **and** from `agents/convention-checker.md:130-131`.
- No test suite for prompt text. Failures are silent: a wrong name burns a round-trip, it does not
  throw (`docs/plans/2026-06-24-refactor-flatten-agents-namespace-plan.md:67`).

### Verified this session, not assumed

| Claim | Evidence |
|---|---|
| A plugin skill resolves bare, `/name`, when its name differs from the plugin's | `ddsetup` is a plugin skill at `datadog/0.7.14/skills/ddsetup/SKILL.md`; `/ddsetup` resolves. Earlier `/frontend-design` and `/code-review` evidence was confounded (skill name == plugin name). |
| `$ARGUMENTS` interpolates inside a `SKILL.md` body | Probe skill with `<scope> #$ARGUMENTS </scope>` returned `INTERPOLATED=zulu-77`. Project scope; plugin scope is U1. |
| `argument-hint` is valid in skill frontmatter | Ships in 5 installed plugin `SKILL.md` files (slack, browser-qa, brag-document). |
| Project-scope commands still resolve `/ba:<n>` | `.claude/commands/ba/research.md` probe returned `PROBE-OK` — isolating the regression to the plugin path. |

## Acceptance Criteria

- AC1: Every one of the nine invokes as `/ba-<name>` from a fresh session, and as `/dev-workflow:ba-<name>`.
- AC2: Arguments reach the body — `/ba-execute docs/plans/x-plan.md` receives the path; `/ba-review-plan <p> --auto`
  parses its token; `/ba-plan "… output:html"` still resolves format.
- AC3: The three internal dispatches still fire model-initiated: `ba-plan` → `ba-review-plan --auto`
  (and parses the `[AUTO-SCORE: …]` sentinel), `ba-brainstorm` FAST-TRACK → `ba-plan`,
  `ba-propose` Step 5f → `ba-compound`.
- AC4: The six non-dispatch-target skills do not self-trigger on description match.
- AC5: A skill body's `references/*.md` load site resolves to the repo-root file, from inside
  `skills/ba-<name>/SKILL.md`.
- AC6: CI is green at every commit on the branch, and `version-bump` actively guards `skills/` —
  a prompt-only change under `skills/` with no version bump fails.
- AC7: No `/ba:` or `commands/ba/` string remains outside `docs/`, with one documented exception:
  `scripts/check-invariants.mjs` must contain both as the forbidden needles of the U17 check.
- AC8: `/ba-review`'s reviewer discovery does not select `ba-review` or `ba-review-plan` as external
  reviewers.
- AC9: `CLAUDE.md` describes the skills layout, and both the U-ID and stack-base axes are correct in
  the same PR that moves the files.
- AC10: `docs/` is untouched, and `docs/brainstorms/2026-07-30-plan-gate-before-write-ordering-brainstorm.md`
  stays untracked.
- AC11: A stale `/ba:` or `commands/ba/` string reintroduced anywhere outside `docs/` fails CI, naming
  the offending `file:line`.
- AC12: `/ba-handoff "<focus>"` and `/ba-research "<query>"` receive their argument via an explicit
  `$ARGUMENTS` placeholder rather than the harness append path. (Scope addition, accepted 2026-07-30 —
  see U10; stated as its own criterion so it is visible in the contract rather than implied by AC2.)

## What We're NOT Doing

- **Not filing the upstream 2.1.216 regression.** User decision this session, not a plan call.
- **Not rewriting `docs/`** — ~2400 stale `/ba:` occurrences across 91 historical brainstorms, plans,
  research and review artifacts. They are the record of what the commands were called when written;
  rewriting them would falsify that record for no runtime gain. (This is the volume-and-record
  rationale. It is *not* the protected-artifacts guard at `CLAUDE.md:80` — that guard binds reviewer
  subagents against removing files and explicitly leaves content review unaffected. Earlier drafts
  cited it as "artifact immutability"; no such convention exists.)
- **Not capturing the progressive-disclosure payoff.** `docs/research/2026-07-26-opus5-context-engineering-fit-research.md`
  measures `propose.md` at ~18.5k resident tokens and `review.md` at ~17.8k, and names skills as the
  guidance's vehicle for decomposing that. This plan carries the monolithic bodies across unchanged.
  The naming fix and the decomposition are independent; conflating them would make an urgent
  mechanical change wait on a large editorial one. Decomposition is **issue 59**, which already owns
  the checklist; take it after this migration, on the renamed `skills/` paths.
- **Not moving `references/` to skill-local `skills/*/references/`** — see Proposed Solution.
- **Not touching `.claude-plugin/marketplace.json`'s stale `0.1.0`** — pre-existing, unrelated.

## Proposed Solution

Hyphen-flatten the directory namespace into the skill name: `commands/ba/plan.md` →
`skills/ba-plan/SKILL.md`, invoked `/ba-plan`. The `ba` identity is kept; what is dropped is the
directory-derived pseudo-namespace, the part upstream can redefine without us.

Two independent reasons the separator is a hyphen and not a colon:
1. A colon is resolved only by upstream's namespace parser, which just proved it can change under us.
2. Colons in skill names break Windows paths outright — `ENOTDIR: mkdir '.config\opencode\skills\ce:brainstorm'`.

**Prior art.** `EveryInc/compound-engineering-plugin` ran this exact migration: `3e99c11c` (2026-03-08)
moved 27 files `commands/ce/plan.md` → `skills/ce-plan/SKILL.md`, with 25 of 27 at `R100` (bodies
byte-identical) and collateral limited to three files. Its `commands/ce/` → `ce-` flattening is the
same shape reached independently. It shipped `/ce:plan` → `/ce-plan` with no deprecation wrapper.

**`references/` stays at repo root.** A skill-local `skills/ba-plan/references/` cannot serve
`agents/convention-checker.md:130-131`, which reads `plan-sections.md` and `brainstorm-sections.md`
directly, and would force `html-rendering.md` to be duplicated across five skills — which that
file's own line 65 forbids. Consequence: the load-site path strings must be **explicitly anchored**
(U6), because skills resolve bundled files relative to `SKILL.md` and the bodies currently say the
bare relative `references/html-rendering.md`.

**Mirror-obligation reading (`CLAUDE.md:82`, `:83`).** "Updated together" is read as **same PR**, not
same commit. Phase 1 relocates all six grid files while the grid still names `commands/ba/*.md`;
Phase 3 corrects it. Two notes: (a) a relocation is not a change to the *convention* — U2 leaves the
U-ID grammar, `derive-state`, and `resolve-stack-base` prose byte-unchanged, so the letter of the
obligation arguably does not fire; (b) a green Phase 1 is not evidence the mirror held — neither CI
check tests citation-path accuracy, so a green Phase 1 with six stale grid cells is the expected
outcome, not a contradiction.

## Technical Considerations

- **Silent-failure discipline.** No compiler, no prompt test suite. Static greps are the
  verification; only the registry proves a runtime ID. Every unit's `Verify:` is therefore a
  conjunction (old string absent **and** new string present), never a presence-only grep.
- **`disable-model-invocation` carve-out.** Six of nine carry the flag. The three dispatch targets —
  `ba-plan`, `ba-review-plan`, `ba-compound` — omit it, because the flag blocks exactly the
  model-initiated invocation their callers depend on. Criterion, so the count is not arbitrary:
  *a skill omits the flag if and only if another skill's body invokes it.*
- **This migration cannot be validated in the session that writes it** — a session runs the body it
  loaded at start (`.claude/agent_docs/prompt-authoring.md:73-77`). Phase 4 is fresh-session work.

## System-Wide Impact

- **Interaction graph:** `ba-brainstorm` → `ba-plan` → `ba-review-plan` (`--auto`, sentinel-parsed)
  → `ba-execute` → `ba-propose` → `ba-compound`. Every arrow is a string in a prompt body; each is a
  silent-failure site.
- **Error propagation:** none of these throw. A stale dispatch name degrades to the model narrating
  "run it yourself", which no CI check detects.
- **State lifecycle:** `review.md:779` writes `- Command: /ba:review <args>` **into persisted review
  artifacts**, and `references/html-rendering.md:47` writes `Composed … by /ba:plan …` into generated
  HTML. Artifacts written before U8 permanently misattribute themselves; `docs/` immutability means
  they are not retro-fixed. This is why U8 sits early in Phase 2, ahead of cosmetic work.
- **Discovery interaction:** `review.md` sweeps a `skills/` discovery root, so the nine become
  reviewer-discovery candidates. Only `ba-review` and `ba-review-plan` descriptions pass its keyword
  filter, making self-selection the live risk (AC8).

## Implementation Phases

### Phase 0: Verify the premise before moving anything

#### U1 — Fresh-session probe: does a `ba-`prefixed skill in *this* plugin resolve bare?

The entire naming scheme rests on it, and `CLAUDE.md:70` currently asserts the opposite. `ddsetup`
already demonstrates a plugin skill resolving bare with a name unlike its plugin, so this is
confirmation, not discovery — but it is confirmation of *this* plugin, with a `ba-` prefix, at the
installed version, and it is cheap.

Decisions: add a throwaway `skills/ba-probe/SKILL.md` to the plugin whose body echoes a sentinel and
its interpolated `$ARGUMENTS`. Reload plugins, open a **fresh session**, invoke `/ba-probe alpha-1`.
Delete the probe before Phase 1 — it must not survive into the migration commit.

`test ! -d skills/ba-probe` is **not** a sufficient `Verify:` — it asserts only that the probe was
deleted, so skipping the fresh-session invocation entirely would pass it. The gate protecting the
plan's premise cannot be a static check; like U16 this unit is **commit-tag-only** and stays `pending`
until `U1` appears in a commit subject, with the probe result recorded on issue 41.

Test scenarios:
- `/ba-probe alpha-1` in a fresh session echoes the sentinel and `alpha-1` (Covers AC1, AC2)
- `/dev-workflow:ba-probe` also resolves (Covers AC1)
- The probe directory is gone before U2 runs (cleanup, not proof)

Verify: _(none — fresh-session runtime probe, commit-tag-only; see the phase gate below)_

> **Phase gate — three outcomes, not two.**
> - **Bare `/ba-probe` resolves and `$ARGUMENTS` interpolates** → proceed to Phase 1.
> - **Bare form fails** → stop. The naming scheme is wrong; the plan needs re-deciding, not executing.
> - **Partial pass** (bare resolves but `/dev-workflow:ba-probe` does not, or the sentinel echoes but
>   `$ARGUMENTS` does not interpolate for a `ba-` prefixed name) → stop and report which half failed.
>   AC1 and AC2 both depend on this probe, so a partial result is a re-decide, not a proceed.

---

### Phase 1: Mechanical move — one commit, CI green

#### U2 — `git mv` nine files and rewrite frontmatter only

Decisions: `git mv commands/ba/<n>.md skills/ba-<n>/SKILL.md` for all nine, so rename detection
keeps history. Prose bodies byte-unchanged. Frontmatter: `name: ba-<n>` (the colon is not a legal
skill name, which is why the move cannot be literally byte-unchanged); `description` and
`argument-hint` carry over verbatim; add `disable-model-invocation: true` to the six that are not
dispatch targets — `ba-brainstorm`, `ba-execute`, `ba-handoff`, `ba-propose`, `ba-research`,
`ba-review`. Omit it on `ba-plan`, `ba-review-plan`, `ba-compound`.

Remove `commands/` entirely — leaving a stub would keep the dead `/ba:` form in the picker.

Test scenarios:
- All nine resolve as `/ba-<name>` in a fresh session (Covers AC1)
- `commands/` no longer exists; nine `skills/ba-*/SKILL.md` do (Covers AC1)
- Each skill's `name:` equals its directory basename (Covers AC1)
- The six flagged skills carry the flag; the three dispatch targets do not (Covers AC3, AC4)

Verify: `test ! -d commands && [ "$(find skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)" -eq 9 ] && [ "$(grep -l 'disable-model-invocation: true' skills/ba-*/SKILL.md | wc -l)" -eq 6 ] && for d in skills/ba-*/; do n=$(basename "$d"); grep -qx "name: $n" "$d/SKILL.md" || exit 1; done`

The basename loop is the point: a presence-only colon check would pass `name: ba-plann` inside
`skills/ba-plan/`. `find` replaces `ls` — this shell aliases `ls` to `eza`, whose icons/ANSI can
corrupt parsed output.

#### U3 — Repoint the CI corpus constant

Decisions: `scripts/check-invariants.mjs:83` — `PROMPT_SURFACE_DIRS = ['skills', 'agents']`.
**Replace** `'commands'`, do not add: `loadCorpus` emits an `UNKNOWN` record for an absent directory,
and `UNKNOWN` exits 2. `VERSION_BUMP_WATCHED_PREFIXES` (`:84`) derives from this constant, so the
silent-green hole closes in the same edit — without it, `skills/` is unwatched and every future
prompt change ships with no version bump, i.e. every installed client keeps serving stale bodies
while CI stays green.

Test scenarios:
- A prompt-only edit under `skills/` with no version bump FAILs `version-bump` (Covers AC6)
- `sentinels` finds both AUTO-SCORE participants in the new corpus (Covers AC6)
- `references` finds all three reference files cited (Covers AC6)

Verify: `grep -q "PROMPT_SURFACE_DIRS = \['skills', 'agents'\]" scripts/check-invariants.mjs && ! grep -q "'commands'" scripts/check-invariants.mjs`

#### U4 — Repoint the selfcheck fixtures

Decisions: ~25 fixture paths in `scripts/selfcheck-invariants.mjs` move from `commands/a.md`,
`commands/c.md` to `skills/`; the three case names hard-coding `commands/` (`:184`, `:260`, `:269`)
are reworded. Rewrite the paths rather than teaching `loadCorpus` to tolerate an absent watched dir —
tolerance would reintroduce the vacuous-green the script exists to prevent.

Test scenarios:
- `node scripts/selfcheck-invariants.mjs` exits 0 (Covers AC6)
- No fixture writes under `commands/` (Covers AC6)

Verify: `! grep -q "commands/" scripts/selfcheck-invariants.mjs && grep -q "skills/" scripts/selfcheck-invariants.mjs`

#### U5 — Bump the plugin version

Decisions: `.claude-plugin/plugin.json` `0.38.0` → `0.39.0`. Same commit — it is the auto-update
cache key. Also update the `description`, which says "commands".

Test scenarios:
- Version is `0.39.0` and the file parses (Covers AC6)

Verify: `python3 -c "import json;d=json.load(open('.claude-plugin/plugin.json'));assert d['version']=='0.39.0'"`

> **Phase gate:** all four units done and CI green → proceed. Automated, no manual pause.
>
> **Do not push Phase 1 alone.** After U2 the five reference-citing skills (`ba-plan`, `ba-brainstorm`,
> `ba-review-plan`, `ba-execute`, `ba-handoff`) still carry bare `references/…` paths that no longer
> resolve from `skills/` — U6 fixes them, and U6 gates on a human-read fixture A/B. Phase 1 and Phase 2
> land in the same push, or the four active users get five broken skills. This is the one place the
> automated gate is not sufficient on its own.

---

### Phase 2: Machine-boundary strings

#### U6 — Anchor the `references/` load-site paths

The plan's sharpest risk. 17 load sites across `ba-plan`, `ba-brainstorm`, `ba-review-plan`,
`ba-execute`, `ba-handoff` say the bare relative `` `references/html-rendering.md` ``. That resolved
because the dev session's cwd is the repo root; from inside `skills/ba-plan/SKILL.md` the documented
skill convention resolves bundled files **relative to `SKILL.md`**, i.e. at
`skills/ba-plan/references/html-rendering.md`, which does not exist. Per
`.claude/agent_docs/prompt-authoring.md:11` a load-site path is a machine-boundary contract, so it
earns literal specification rather than steering.

Decisions: make every load site explicitly repo-root-anchored — the plugin-root form
`${CLAUDE_PLUGIN_ROOT}/references/<file>.md`, which is the only form that resolves both in-repo and
for a consumer whose cwd is their own project. Note this fixes a **pre-existing** latent bug: today
the bare path only works when cwd happens to be this repo.

**Fixture A/B required before committing the rewrite** (`CLAUDE.md:97`): the claim "a skill body
resolves `${CLAUDE_PLUGIN_ROOT}/references/x.md` but not bare `references/x.md`" is a claim about
model and harness behavior, and this repo's rule is that those get an A/B, not an argument. Run 3
fixtures × 2 conditions (bare path / anchored path) per
`.claude/agent_docs/prompt-authoring.md:79-93`, and read each subagent's full reasoning trace to
attribute the verdict — a baseline hit citing the caller's global `CLAUDE.md` is CONFOUNDED, not a
pass (`docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`).

**Collision with the existing `references` invariant — must be fixed in this same unit.**
`scripts/check-invariants.mjs:319` builds its needle as `` `\`references/${basename}\`` `` — with a
**leading backtick**. In the anchored form the basename is preceded by `/`, not a backtick, so
`includes()` returns false and the check FAILs for all three reference files. Anchoring the load
sites without touching the needle guarantees a red CI.

Fix: drop the leading backtick from the needle — `` `references/${basename}\`` `` — so it matches
both the bare and anchored forms. This is deliberately a *widening* of a machine-boundary contract,
which `.claude/agent_docs/prompt-authoring.md:65` says is normally the thing to flag; it is justified
here because the contract being enforced is "this reference file is cited from the corpus", and only
the *spelling* of a citation changed, not the obligation. Existing selfcheck fixtures (`:145-167`,
`:273`, `:311`) still match under the widened needle, so no fixture rewrite is needed. Do **not**
narrow it back to an anchored-only needle: `agents/convention-checker.md:130-131` cites the bare form,
and whether `${CLAUDE_PLUGIN_ROOT}` expands in an agent body is untested.

Test scenarios:
- A fresh-session `/ba-plan` with `output:html` loads the rendering reference and emits conformant HTML (Covers AC5)
- `/ba-review-plan` on an `.html` plan loads the same reference (Covers AC5)
- The A/B distinguishes the two conditions rather than both passing (Covers AC5)
- `references` check still PASSes for all three files after anchoring (Covers AC5, AC6)

Verify: `[ "$(grep -rho '\${CLAUDE_PLUGIN_ROOT}/references/[a-z-]*\.md' skills/ | wc -l)" -ge 17 ] && ! grep -rq '`references/' skills/ && grep -q 'needle = `references/' scripts/check-invariants.mjs`

#### U7 — Reviewer self-exclusion strings

Decisions: `skills/ba-review/SKILL.md` — the file-discovery exclusion list (was `review.md:265`:
`ba:plan`, `ba:brainstorm`, `ba:execute`) and the system-reminder fallback exclusion (was `:267`:
`ba:review`, `ba:review-plan`) become `ba-*`. Without this, discovery's keyword filter — which
`ba-review` and `ba-review-plan` descriptions both pass — no longer matches the exclusion strings,
and `/ba-review` can select itself as an external reviewer. Per `CLAUDE.md:79` the never-hide-ledger
convention binds four mirror sites: this file, `ba-review-plan` Step 2, `README.md`, `CLAUDE.md`.

Test scenarios:
- A review run's selection ledger lists neither `ba-review` nor `ba-review-plan` as external (Covers AC8)
- Plan-writer and execution skills stay excluded (Covers AC8)
- All four mirror sites carry the same names (Covers AC8, AC9)

Verify: `grep -q 'ba-review-plan' skills/ba-review/SKILL.md && ! grep -rq 'ba:review' skills/ba-review/SKILL.md skills/ba-review-plan/SKILL.md`

#### U8 — Strings written into generated artifacts

Decisions: `skills/ba-review/SKILL.md` (was `review.md:779`) `- Command: /ba-review <args …>`, and
`references/html-rendering.md:47`'s provenance example `Composed <date> by /ba-plan from …`. These
are emitted into files on disk, so every artifact written before this unit permanently misattributes
itself to a command that no longer exists — and `docs/` immutability means they are not retro-fixed.
Ahead of all cosmetic work for that reason.

Test scenarios:
- A `--persist` review run writes `Command: /ba-review …` (Covers AC7)
- A generated HTML plan's footer names `/ba-plan` (Covers AC7)

Verify: `grep -q '/ba-review' skills/ba-review/SKILL.md && grep -q '/ba-plan' references/html-rendering.md && ! grep -q '/ba:' references/html-rendering.md`

#### U9 — Internal dispatches and handoff menus

Decisions: the three model-initiated dispatches — `ba-plan` Step 7 → `/ba-review-plan <path> --auto`,
`ba-brainstorm` FAST-TRACK → `/ba-plan`, `ba-propose` Step 5f → `run("/ba-compound", …)` — plus every
handoff-menu invocation across `ba-plan`, `ba-execute`, `ba-review`, `ba-brainstorm`,
`ba-review-plan`. The `[AUTO-SCORE: …]` sentinel keyword set is untouched; only the invocation string
changes.

Test scenarios:
- `/ba-plan` completing a plan invokes `/ba-review-plan --auto` and parses the sentinel (Covers AC3)
- `ba-brainstorm` FAST-TRACK reaches `/ba-plan` without asking the user to run it (Covers AC3)
- `ba-propose` Step 5f offers and hands off to `/ba-compound` (Covers AC3)
- Handoff menus print `/ba-<name>` (Covers AC7)

Verify: `grep -q 'ba-review-plan <plan-path> --auto' skills/ba-plan/SKILL.md && grep -q '/ba-plan' skills/ba-brainstorm/SKILL.md && grep -q 'ba-compound' skills/ba-propose/SKILL.md && ! grep -rq '/ba:' skills/`

All three dispatches are asserted, not two. Without the `ba-brainstorm` clause, silently *deleting*
the FAST-TRACK line rather than rewriting it would pass — old string absent, new string never added.

#### U10 — Explicit `$ARGUMENTS` placeholders for `ba-handoff` and `ba-research`

Decisions: both bodies contain **zero** `$ARGUMENTS` placeholders (verified: `grep -c ARGUMENTS`
returns 0 for each) and rely on the harness appending typed args after the body. `ba-handoff:84`
says "If the user passed an argument to `/ba:handoff`, treat it as the next session's focus". Add an
explicit wrapper matching the other seven — `<focus> #$ARGUMENTS </focus>` and
`<research_query> #$ARGUMENTS </research_query>` — so both stop depending on the untested append
path. Without it, `/ba-handoff "focus on CI sequencing"` silently produces a generic handoff.

**Scope note.** This is a behavior change in a plan whose other units keep bodies byte-unchanged, and
neither skill is named by AC2. Accepted as an explicit scope addition (2026-07-30) and given its own
**AC12** so the growth is visible in the contract rather than absorbed under AC2.

Test scenarios:
- `/ba-handoff "CI sequencing"` scopes the handoff to that focus (Covers AC12)
- `/ba-research "how does X work"` starts on that query without a round-trip (Covers AC12)
- Bare `/ba-research` still falls into its wait-for-query branch (Covers AC12)

Verify: `grep -q 'ARGUMENTS' skills/ba-handoff/SKILL.md && grep -q 'ARGUMENTS' skills/ba-research/SKILL.md`

> **Phase gate:** all units done → proceed.

---

### Phase 3: Conventions and citations

#### U11 — `CLAUDE.md`: rewrite stale lines and add the three new invariants

Decisions. **Rewrite:** the command-namespace convention (`:70`) — it currently states `ba:` derives
from `commands/ba/` and that "plugin skills … are namespaced by the plugin name … not `ba:`", which
actively contradicts the new arrangement; the command listing and headings (`:9,13,14,15,19,23,27,31,35`);
`:55`; the never-hide mirror-site list (`:79`); the protected-artifacts roots (`:80`); the
code-shape-decision mirror sites (`:81`); the U-ID five-citation-site list (`:82`); the stack-base
axis line (`:83`); all six left-column cells of the two-axis grid (`:87-92`); the bare-filename
footnote (`:94`); the propose hand-off exception mirror sites (`:96`); and the prompt-authoring
trigger glob (`:97`), whose `commands/` no longer exists.

**Add**, because the migration introduces structural invariants with no home: (a) the
`skills/ba-<name>/SKILL.md` layout and the rule that `name:` equals the directory basename; (b) the
`disable-model-invocation` policy with its criterion — *omit the flag if and only if another skill
invokes it*; (c) `references/` stays at repo root and shared, read by both `skills/` and `agents/`,
with **two citation forms that must be described separately**: skill bodies use
`${CLAUDE_PLUGIN_ROOT}/references/<file>.md`, while `agents/convention-checker.md` keeps the bare
`references/<file>.md` because whether `${CLAUDE_PLUGIN_ROOT}` expands in an agent body is untested
(U6). Wording (c) as uniformly anchored would bake a false statement into the very rewrite meant to
fix stale documentation.

Also add the **sixth U-ID-axis site** to the `:82` list: `references/plan-sections.md:96` declares
`execute.md` the U-ID grammar owner and `:105` names the minter/consumer, so `CLAUDE.md:82`'s "all
five" has always been short by one. Named here explicitly rather than forward-referenced to U13 —
U11 runs first, and the site is already known at authoring time.

Test scenarios:
- No `commands/ba/` path remains in `CLAUDE.md` (Covers AC9)
- The grid's six left cells name `skills/ba-*/SKILL.md` (Covers AC9)
- Both axes are correct in the same PR as the move (Covers AC9)
- A reader can derive the `disable-model-invocation` split from the stated criterion (Covers AC4)

**Historical-mention carve-out.** A blanket string-absence check forecloses ever documenting the
migration itself — e.g. "these commands invoked as `/ba:<name>` before the 2.1.216 regression forced
the rename", which is exactly the context a future reader of `CLAUDE.md` needs. Allow **at most one**
such mention per file, inside a fenced code block, and match it that way: the check below tolerates
occurrences inside fences and forbids them in running prose. U17's standing check uses the same rule,
so the two agree. `README.md` (U14) gets the identical carve-out.

Verify: `! grep -q 'commands/ba' CLAUDE.md && [ "$(awk '/^```/{f=!f;next} !f' CLAUDE.md | grep -c '/ba:')" -eq 0 ] && grep -q 'disable-model-invocation' CLAUDE.md && grep -q 'skills/ba-' CLAUDE.md && grep -q 'plan-sections.md' CLAUDE.md`

#### U12 — `.claude/agent_docs/`

Decisions: `prompt-authoring.md` defines the prompt surface as `commands/ba/*.md`, `agents/*.md`,
`references/*.md` (`:3`, `:38`) and cites `commands/ba/plan.md` (`:62`). `CLAUDE.md:97` names this
file as the full convention gating prompt-touching diffs — so left alone, the document deciding what
counts as a runtime change points at a directory that no longer exists, and its review checklist
stops matching any diff. Also `roadmap-management.md:19` carries `/ba:brainstorm` → `/ba:plan`.

Test scenarios:
- The prompt-surface definition names `skills/` (Covers AC7, AC9)
- The roadmap flow line names the new invocations (Covers AC7)

Verify: `! grep -rqE 'commands/ba|/ba:' .claude/agent_docs/ && grep -q 'skills/' .claude/agent_docs/prompt-authoring.md`

#### U13 — `agents/` and `references/` citations

Decisions: each of the seven reviewer agents has **two** independent citations — the `description:`
field naming `/ba:review`, and a body line "Source of truth for the rubric: `commands/ba/review.md` §4"
(`architecture-reviewer.md:72`, `security-reviewer.md:74`, `simplification-reviewer.md:72`,
`error-handling-reviewer.md:73`, `test-coverage-reviewer.md:73`, `deep-module-reviewer.md:85`,
`complexity-reviewer.md:78`). Plus `interface-design-generator.md:3,10`. The `description:` fields
are user-visible in the picker and feed reviewer discovery, so both classes change.

`references/plan-sections.md:96` declares `commands/ba/execute.md` the U-ID grammar **owner** and
`:105` names the minter/consumer — making it a **sixth** U-ID-axis site absent from `CLAUDE.md:82`'s
"all five". Add it there (U11) rather than perpetuating the gap. `references/brainstorm-sections.md:6,15`
and `plan-sections.md:6,10` declare their own must-update-together mirror with the inline templates.

Test scenarios:
- All 14 reviewer citations point at `skills/ba-review/SKILL.md` (Covers AC7)
- Reviewer descriptions read `/ba-review` (Covers AC7)
- `plan-sections.md`'s owner citation resolves (Covers AC9)

Verify: `! grep -rqE 'commands/ba|/ba:' agents/ references/ && [ "$(grep -rl 'skills/ba-review' agents/ | wc -l)" -ge 7 ]`

#### U14 — `README.md`

Decisions: 42 lines carry `/ba:` or a `commands/` path, including four owner citations (`:183`, `:241`,
`:260`, `:264`). Update the command list, every invocation form, the install/update section, and the
artifact-path table. Per `CLAUDE.md:95` README must track command changes; per `:79` it is a
never-hide mirror site. Keep the Roadmap section a pointer to issue 29, not a second list.

Test scenarios:
- Every documented invocation is `/ba-<name>` (Covers AC7)
- The four owner citations point at `skills/` (Covers AC7)
- Roadmap stays a pointer (Covers AC9)

Verify: `! grep -q 'commands/ba' README.md && [ "$(awk '/^```/{f=!f;next} !f' README.md | grep -c '/ba:')" -eq 0 ] && grep -q '/ba-plan' README.md`

Same fenced-block historical-mention carve-out as U11 — forbidden in prose, tolerated inside a fence.

> **Phase gate:** all units done → proceed.

---

### Phase 4: Verification

#### U15 — Static sweep

Decisions: one grep proving no live surface retains the old strings, `docs/` excluded. This is the
safety net for the ~225 references, and the only mechanical check that the rename is complete. U17
then promotes it from a one-time hand-run grep into a standing invariant.

Test scenarios:
- Zero `/ba:` or `commands/ba/` outside `docs/` (Covers AC7)
- `docs/` still holds its historical references, unmodified (Covers AC10)
- The 07-30 brainstorm is still untracked (Covers AC10)

**Corpus, and the one exception.** The sweep excludes `docs/` (historical record) **and**
`scripts/check-invariants.mjs` — U17's check must contain `/ba:` and `commands/ba/` as its forbidden
needles, so the checker's own source is a permanent, documented exception. Without this carve-out U15
and U17 directly contradict each other and AC7 could never be true in the shipped repo.

Verify: `[ "$(grep -rlE 'commands/ba|/ba:' --exclude-dir=docs --exclude-dir=.git --exclude=check-invariants.mjs . | wc -l)" -eq 0 ] && git status --porcelain docs/ | grep -qx '?? docs/brainstorms/2026-07-30-plan-gate-before-write-ordering-brainstorm.md'`

The second clause now asserts the *whole* of `docs/` is clean except the one expected untracked file,
which is what AC10 actually claims — the previous form only checked that one file's status.

#### U16 — Fresh-session runtime probes

Static greps prove the source is clean; only the registry proves a runtime ID, and only an actual
invocation proves argument passing and model-initiated dispatch. Neither is inspectable from the
session that wrote the change.

Decisions: after `/reload-plugins`, in a **fresh** session — (1) invoke each of the nine bare and
confirm it loads its body; (2) invoke `/ba-execute <path>` and `/ba-review-plan <path> --auto` with
real arguments and confirm the value arrives; (3) drive `ba-plan` to Step 7 and confirm it
model-invokes `ba-review-plan --auto` and parses the sentinel; (4) confirm the six flagged skills do
not appear as model-invocable in the skills listing. Record results on issue 41.

These are manual runtime confirmations, not a `Verify:` — the unit is commit-tag-only and stays
`pending` until its `U16` appears in a commit subject.

Test scenarios:
- Nine bare invocations resolve and load their bodies (Covers AC1)
- Arguments arrive for the two argument-parsing skills (Covers AC2)
- `ba-plan` → `ba-review-plan --auto` fires model-initiated (Covers AC3)
- The six flagged skills are absent from the model-invocable listing (Covers AC4)

Verify: _(none — runtime registry check, commit-tag-only)_

#### U17 — Promote the sweep to a standing fourth invariant

U15 proves the rename is complete *once*, by hand. Nothing then stops a stale `/ba:` from creeping
back — and it would creep back silently, since a wrong invocation name burns a round-trip rather than
throwing. Two live channels make that more than theoretical: `docs/` keeps ~2400 `/ba:` occurrences by
design, and `learnings-researcher` reads `docs/solutions/` *into* future planning sessions, where a
model can faithfully copy the old form into a prompt body.

Decisions: add a fourth check to `scripts/check-invariants.mjs`, shaped on the existing `references`
check (`:302-332`) — load the same corpus, scan for forbidden needles `/ba:` and `commands/ba/`, and
FAIL with `file:line` per hit. Simpler than the `references` check: one fixed needle set, no subject
glob. Corpus is `PROMPT_SURFACE_DIRS` plus `README.md`, `CLAUDE.md`, and `.claude/agent_docs/`;
`docs/` is out of the corpus by construction, so it needs no allowlist.

**Scope note.** A fourth standing invariant is a durable increase in what this repo's tooling guards,
on top of nine file moves. Accepted as an explicit scope decision (2026-07-30) — recorded the same way
the upstream-regression exclusion is, so it reads as a decision rather than momentum. "The scripts are
already open" is why it is *cheap* now, not why it *belongs*.

Needle matching must implement the **same fenced-block carve-out** as U11/U14: an occurrence inside a
fenced code block is a documented historical mention and passes; one in running prose fails. And the
corpus excludes `scripts/` so the check cannot flag its own source — the exception AC7 now names.

Lands **after** U15, not in Phase 1 — added earlier it would be red through the content phases.

Test scenarios:
- A planted `/ba:plan` string under `skills/` FAILs the check with its `file:line` (Covers AC11)
- A clean tree PASSes (Covers AC11)
- A `/ba:` occurrence under `docs/` does **not** fail it (Covers AC10, AC11)
- `node scripts/selfcheck-invariants.mjs` covers both the PASS and FAIL case (Covers AC6)

Verify: `grep -q "commands/ba" scripts/check-invariants.mjs && node scripts/check-invariants.mjs >/dev/null && node scripts/selfcheck-invariants.mjs >/dev/null`

## Risk Analysis & Mitigation

| Risk | Mitigation |
|---|---|
| `/ba-<name>` doesn't resolve bare → nine dir names and ~225 minted strings are wrong | U1 gates the whole plan; `ddsetup` already de-risks it |
| `disable-model-invocation` blocks the three internal dispatches | Carve-out decided; AC3 probes all three in Phase 4 |
| `references/` load sites silently fail to resolve from `skills/` | U6, plugin-root anchoring, fixture A/B before commit |
| `version-bump` silently green forever under `skills/` | U3, one constant, in the mechanical commit |
| Blind find-and-replace changes prose that should stay | Per-site classification: dispatch-driving / path citation / prose. The issue-26 flattening named over-generalization its top risk |
| `/ba-review` selects itself as a reviewer | U7 + AC8 |
| Artifacts written mid-migration misattribute their command | U8 early in Phase 2 |
| Rollback | `git mv` back is trivial, but 0.39.0 is published and cached — a revert needs its own bump to propagate |

## Dependencies & Risks

- **Issue 41 / 59 sequencing — resolved 2026-07-30.** 41 was retitled (the stale
  "(gated on /ba: namespace surviving)" parenthetical dropped) and the hub, issue 29, was re-synced:
  41 leads "Ready to build now", its stale deferred row is gone, and the cross-lane note now reads
  **41 → 59** instead of "59 first". The old ordering existed because 59 captured the
  progressive-disclosure payoff without resolving 41's invocation question; 2.1.216 resolved that
  question by breaking it. 59 carries a comment recording the path shift it inherits.
- **Announcement.** Four active users; `/ba:<name>` already broken for them, so the migration
  restores function rather than removing it. Draft prepared.

## Testing Strategy

No prompt test suite exists. Four layers, in order of strength:
1. **CI invariants** (`sentinels`, `references`, `version-bump`) — green at every commit.
2. **Static greps** — every `Verify:` a conjunction, so a half-done rename fails rather than passing.
3. **Fresh-session runtime probes** (U1, U16) — the only evidence for registry resolution, argument
   passing, and model-initiated dispatch.
4. **A standing fourth invariant** (U17) — converts the one-time completeness sweep into a guard that
   fails future reintroductions, which would otherwise be silent.

Plus one **fixture A/B** for U6's path-resolution claim, with reasoning-trace attribution to guard
against the global-`CLAUDE.md` inheritance confound.

## Documentation Plan

`CLAUDE.md` (U11, including three added invariants), `.claude/agent_docs/prompt-authoring.md` and
`roadmap-management.md` (U12), `README.md` (U14), issue 41 (U1 probe result and U16 results).

## Sources & References

### Internal
- `scripts/check-invariants.mjs:83-84` — the single constant behind all three CI checks
- `references/html-rendering.md:65` — the single-shared-source rule
- `commands/ba/review.md:265,267,779` — exclusion lists and the persisted-artifact command string
- `CLAUDE.md:70,79-97` — the conventions this migration rewrites
- `.claude/agent_docs/prompt-authoring.md:11,65,73-93` — machine-boundary vs steering; the A/B method
- `docs/plans/2026-06-24-refactor-flatten-agents-namespace-plan.md:52,60,67,155` — the issue-26
  flattening precedent: silent failure, the dispatch-site vs prose distinction, static greps as
  verification
- `docs/research/2026-07-26-opus5-context-engineering-fit-research.md` — resident-weight measurements;
  why decomposition is the real payoff and why it is out of scope here
- `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md` — A/B
  attribution discipline

### External
- `EveryInc/compound-engineering-plugin` — `3e99c11c` (commands→skills, R100), `1514e51a`/`6fdffab0`/`82c1fe86`
  (alias-then-remove), `docs/solutions/integrations/colon-namespaced-names-break-windows-paths.md`

## Convention Compliance

- [x] Command/skill naming — `ba-<name>`, hyphen, `name:` == directory basename
- [x] Never-hide-ledger mirror sites — all four updated together (U7)
- [x] U-ID & stack-base two-axis obligation — same-PR reading stated and justified; sixth site added (U11, U13)
- [x] `references/` citation invariant — all three files stay cited from the new corpus (U3)
- [x] Version bump in the same commit as the prompt change (U5)
- [x] Planning commands never write code — this plan writes no code
- [x] `docs/` exempt and untouched (AC10)
- [x] Fixture A/B for the behavioral claim (U6)
- [x] Fourth invariant mechanically forbidding `/ba:` outside `docs/` — built, not deferred (U17)
- [ ] **Known debt:** progressive-disclosure decomposition of the four heavy bodies — explicitly out
      of scope; owned by **issue 59**, which already holds the checklist and survives this rename
      (bodies move byte-unchanged, so its line numbers hold and only its path prefixes shift)
