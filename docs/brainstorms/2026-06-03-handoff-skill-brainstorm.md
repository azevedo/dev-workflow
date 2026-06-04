---
date: 2026-06-03
topic: handoff-skill
status: approved
triage_level: standard
tags: [skill, productivity, handoff, multi-claude]
---

# Handoff Skill (port of Matt Pocock's `handoff`)

## What We're Building

A skill bundled in the dev-workflow plugin (`skills/handoff/SKILL.md`) that
compacts the current conversation into a handoff document for another agent
to pick up. Inspired by Matt Pocock's [`handoff`](https://github.com/mattpocock/skills/blob/main/skills/productivity/handoff/SKILL.md)
skill, integrated into a single coherent body that weaves in dev-workflow
artifact awareness, git-state capture, and parallel-session (multi-claude)
context — no separate "Bruno-specific notes" section. First skill bundled
in the plugin (the plugin currently ships `commands/` and `agents/` only).

## Why This Approach

Three approaches were considered:

1. **Verbatim copy.** Smallest possible change. Trusts auto-loaded CLAUDE.md
   and memory to enforce no-fabrication and discipline rules at handoff-writing
   time. Rejected because the multi-claude usage pattern (167 overlap events,
   43% of messages from parallel sessions per the 2026-05-26 insights report)
   makes git-state and in-flight-artifact capture concretely load-bearing —
   leaving that as implicit guidance loses information at the seam.

2. **Verbatim + small Bruno addendum.** Matt's body unchanged, plus a labeled
   "Bruno-specific notes" section. Rejected: produces a stilted skill with a
   visible seam between "his" and "mine"; "do not modify the upstream" is a
   fictional constraint, not a real one.

3. **Integrated rewrite using Matt's skill as the starting point** *(chosen)*.
   One coherent body, no labeled addendum. Matt's framing (compact the
   conversation, save to OS tempdir, reference rather than duplicate, redact
   sensitive info, suggest skills for the next agent) is preserved as the
   spine. Bruno's additions (git context, dev-workflow artifact paths,
   `/ba:execute` slice context, exact slash-command form for suggested
   skills, verified-facts-only) are woven into the relevant instructions
   directly. Plugin-bundled so the dev-workflow references are colocated
   with the commands they reference. Upstream is cited in the brainstorm
   rationale and the eventual commit/PR — that's lineage, not contract.

## Key Decisions

- **Body:** integrated rewrite using Matt Pocock's `handoff` SKILL.md as the
  starting point. Single coherent voice, no separate "Bruno-specific notes"
  section. Modify freely; cite upstream in the brainstorm rationale and the
  commit/PR.
- **Frontmatter:** `name: handoff`, `description`, `argument-hint`. Reword
  `description` and `argument-hint` if the integrated body warrants it; the
  slug `handoff` stays so `/ba:handoff` is the invocation.
- **Install location:** `skills/handoff/SKILL.md` inside the dev-workflow
  plugin. Repo-of-origin decides scope; the plugin is also how Bruno bundles
  useful skills to himself, and the plugin can be installed anywhere — so
  plugin scope does not sacrifice portability. First skill bundled in the
  plugin; sets the precedent for `skills/<name>/SKILL.md`.
- **Invocation:** `/ba:handoff [what the next session will focus on]`. The
  `ba:` prefix is the plugin-wide namespace (commands and skills alike), not
  command-only — matches every existing plugin artifact and Bruno's muscle
  memory. Full namespaced form `/dev-workflow:ba:handoff` works via the
  plugin manifest.
- **Save target for handoff docs:** OS tempdir. On macOS that resolves to
  `$TMPDIR`. Unchanged from Matt's design.
- **Substantive content the integrated body must carry** (woven into the
  relevant instructions, not labeled as additions):
  1. Compact the conversation into a handoff doc; save to `$TMPDIR`.
  2. Capture git context: branch, dirty/clean, pushed/unpushed.
  3. Reference in-repo artifacts by path rather than restating their
     content — including dev-workflow paths (`docs/brainstorms/`,
     `docs/plans/`, `docs/research/`, `docs/solutions/`, `docs/reviews/`).
  4. If mid-`/ba:execute`, name the plan path and the slice number.
  5. Include a "suggested skills" section using **exact slash invocations**
     (e.g. `/ba:execute docs/plans/<file>.md`), not prose hints.
  6. Redact sensitive information (API keys, tokens, PII).
  7. Only verified facts. No fabricated IDs, paths, test results, or
     claims.
  8. If the user passed an argument, treat it as the next session's focus
     and tailor the doc accordingly.
- **No design-it-twice dispatch.** The trigger matches "new skill" formally,
  but the interface is fully fixed by Matt's existing template; the only
  decision was augmentation approach. The three approaches in `## Why This
  Approach` are the meaningful design space.

## Scope Boundaries

What we are **not** doing:

- Not changing the save target away from OS tempdir.
- Not adding a prescriptive handoff-doc template inside the skill — the
  writing agent decides structure based on what the session actually
  produced.
- Not adding hook enforcement (e.g. PreToolUse) for handoff invocation —
  out of scope here, separate decision.
- Not creating a user-scoped (`~/.claude/skills/`) variant. Plugin-only.
- Not auto-redacting PII via tooling — relies on the skill's "redact
  sensitive information" instruction.
- Not generalizing the plugin's `skills/` layout beyond `skills/<name>/SKILL.md`
  in this iteration — first-skill precedent only.

## Acceptance Criteria

- `skills/handoff/SKILL.md` exists in the dev-workflow repo and is loadable as
  a skill when the plugin is installed.
- Frontmatter contains `name: handoff`, plus a `description` and
  `argument-hint` consistent with the body. Slug must be `handoff` so
  `/ba:handoff` is the invocation.
- Body reads as a single coherent skill — no labeled "Bruno-specific notes"
  section or other visible upstream-vs-local seam.
- Body covers, in some form, the eight substantive points listed under Key
  Decisions (compact + save to $TMPDIR; git context; reference-don't-restate
  with dev-workflow paths called out; `/ba:execute` slice context;
  suggested-skills as exact slash invocations; redact sensitive info;
  verified facts only; honour the user's argument as next-session focus).
- Invoking `/ba:handoff` in a session where the plugin is installed
  triggers the skill and writes the handoff doc to `$TMPDIR`.
- A handoff doc produced by the skill references in-repo artifacts by path
  rather than restating their content.
- `.claude-plugin/plugin.json` version is bumped (per project convention).
- `README.md` is updated to list the new skill under a Skills section (per
  project convention, extended here to skills since this is the first one).

## Open Questions

*(none — resolved during dialogue)*

## Resolved Questions

- **Verbatim vs augmented vs integrated?** → Integrated rewrite. Earlier
  draft chose verbatim+addendum via AskUserQuestion; corrected on Bruno's
  pushback ("we don't need the 'no modifying Matt's body' bit, that's a
  fictional restraint. I'm fine with modifying"). Recorded as feedback
  memory `feedback-upstream-is-starting-point-not-contract` so the default
  applies to future ports.
- **Save location?** → OS tempdir, unchanged from Matt's original. The
  multi-claude case is served by telling the user the path, not by relocating.
- **Install scope (user vs plugin)?** → Plugin (`skills/handoff/SKILL.md`
  inside dev-workflow). Repo-of-origin is the scope signal; the plugin is
  also how Bruno bundles useful skills to himself, and it can be installed
  anywhere — so plugin scope does not sacrifice portability. Earlier draft
  resolved this as user-scope; corrected on Bruno's pushback. Recorded as
  feedback memory `feedback-skills-repo-origin-decides-scope` so the default
  applies to future skill brainstorms.
- **Invocation prefix (`/dev-workflow:` vs `/ba:`)?** → `/ba:handoff`. `ba:`
  is the plugin-wide namespace across commands and skills, not command-only.
  Earlier draft used `/dev-workflow:handoff`; corrected on Bruno's pushback.
  Recorded as feedback memory `feedback-ba-prefix-is-plugin-wide`; CLAUDE.md
  updated to read "Plugin prefix: `ba:`".

  **Revised 2026-06-04 (planning):** the "`ba:` is plugin-wide, skills too"
  premise is **technically wrong** — verified against the Claude Code plugin
  docs. Plugin *skills* are namespaced by the plugin name
  (`/dev-workflow:<skill>`); the `ba:` prefix comes **only** from the
  `commands/ba/` directory. There is no `/ba:handoff` form for a skill. To keep
  the `/ba:handoff` invocation, Bruno chose to ship the capability as a
  **command** (`commands/ba/handoff.md`, `name: ba:handoff`), not a skill. The
  integrated body, the eight substantive content points, and all scope
  boundaries are unchanged — only the container changes (skill → command), and
  a command trades away model auto-trigger. See plan
  `docs/plans/2026-06-04-feat-handoff-command-plan.md` (§ "Design change from
  the brainstorm") and corrected memory `feedback-ba-prefix-is-command-only`.
  The CLAUDE.md `ba:` bullet is corrected by that plan.

## Convention Compliance

Validated against dev-workflow brainstorm conventions on 2026-06-03. Filename,
frontmatter, section structure, scope-boundary explicitness, and
acceptance-criteria testability all align with `commands/ba/brainstorm.md`
Phase 3 (STANDARD path). `## Locked Design` / `## Rejected Designs` are
correctly absent because design-it-twice was not fired; the omission is
justified in `## Key Decisions` (the skill's interface is fixed by Matt
Pocock's template, so the meaningful design space is augmentation scope,
captured as the three approaches in `## Why This Approach`). This is a
documented override of the "prefer firing" tie-breaker, not a violation.

**Revised 2026-06-04** — three corrections applied: (1) install scope
flipped from user-level to plugin (`skills/handoff/SKILL.md` inside
dev-workflow), so plugin-internal conventions now apply
(`.claude-plugin/plugin.json` version bump and `README.md` update are both
required, reflected in Acceptance Criteria); (2) `ba:` prefix convention
**does** apply — `ba:` is the plugin-wide namespace (commands and skills
alike), so the skill is invoked as `/ba:handoff`; (3) verbatim+addendum
framing dropped in favour of integrated rewrite — Matt's text is a
starting point, not a contract. No agent is being added, so agent-name-
suffix conventions remain N/A. No violations to resolve.

## Next Steps

→ `/ba:plan` to produce the implementation plan (single-file write, plus a
verification step that the skill loads).
