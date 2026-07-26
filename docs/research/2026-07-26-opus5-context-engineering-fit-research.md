---
date: 2026-07-26T23:16:01+01:00
researcher: Claude
git_commit: 52ff5057123185bb5907b67e34d407af59022051
branch: reconciliation-ledger
repository: dev-workflow
topic: "How the Claude 5 context-engineering rules affect dev-workflow's prompt surface"
tags: [research, opus-5, context-engineering, prompt-weight, self-verification, progressive-disclosure, external-comparison]
status: complete
last_updated: 2026-07-26
---

# Research: dev-workflow's fit against the Claude 5 context-engineering rules

**Date**: 2026-07-26T23:16:01+01:00
**Git Commit**: 52ff505
**Branch**: reconciliation-ledger
**Repository**: dev-workflow

## Research Question

Anthropic published new context-engineering guidance for the Claude 5 generation, and Every
published a vibe check reporting that Opus 5 broke their existing plugin workflows. dev-workflow is
the same class of artifact as the plugin Every reported problems with. Which parts of this prompt
surface are now working against the model, which are newly validated, and which are unaffected?

## Sources

External:

- **The new rules of context engineering for Claude 5 generation models** —
  <https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models>
- **Prompting Claude Opus 5** (official) —
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5>
- **Vibe Check: Claude Opus 5 Is Brilliant in Flashes, Frustrating in Practice** (Every, paywalled) —
  <https://every.to/vibe-check/opus-5>; the load-bearing claims are also in the author's public
  thread <https://x.com/danshipper/status/2080700057892815114>

Internal: a full style audit of `commands/ba/*.md`, `agents/*.md`, `references/*.md`, `CLAUDE.md`
(7,491 lines at 52ff505). File:line citations below are from that commit.

## Summary

Three findings, in descending order of consequence.

1. **`/ba:plan` runs four-to-five same-turn self-verification layers over an artifact the same
   model just wrote.** The Opus 5 guide names this exact pattern and says to remove it. This is the
   single largest misfit and it is also the most expensive: two of the layers dispatch subagents.
2. **The two largest commands are ~18k tokens of always-resident prompt with 40–60% unreachable on
   any given run.** The progressive-disclosure discipline the guidance asks for already exists in
   this repo (`references/*.md`), but it is applied to the smaller half of the surface.
3. **The judgment-first material is newly validated and should be protected.** Several sections
   already anticipate this guidance and predate it.

The Every datapoint matters because it is the closest available analogue: an elaborate
multi-command plugin workflow that Opus 5 "didn't play well with," where the resolution was
deleting the scaffolding rather than reinforcing it. The causal direction is the counter-intuitive
part — the scaffolding did not prevent early stopping and instruction-missing, it contributed to
them.

## Finding 1 — Same-turn self-verification

The guidance is unusually direct:

> If your prompt contains explicit verification instructions ("include a final verification step
> for any non-trivial task," "use a subagent to verify"), **remove them**: instructions like these
> cause over-verification on Claude Opus 5, and removing them reduces wasted tokens with no loss in
> quality. The same applies to legacy harness scaffolding that adds separate verification steps.

> **Do not use subagents to verify or double-check your own work.**

> Claude Opus 5 catches and fixes its own mistakes well without prompting. Avoid instructing
> re-checks it already performs.

`/ba:plan` stacks these over one artifact, in one turn, after Step 4 drafts it:

| Layer | Site | Cost |
|---|---|---|
| Convention-compliance gate (**MANDATORY**) | `commands/ba/plan.md:497-511` | subagent dispatch |
| Brainstorm cross-check (7-item checklist) | `commands/ba/plan.md:523-537` | inline |
| HTML post-compose audit (10 rows) | `references/html-rendering.md:300-318`, cited `plan.md:566` | inline, HTML path |
| Auto-score pass → `/ba:review-plan --auto` | `commands/ba/plan.md:570-591` | judge + up to 7 reviewer subagents |

`commands/ba/execute.md:471` ("System-Wide Self-Check") is the same pattern in the execute path.

**The distinction that matters:** this does not condemn `/ba:review` or `/ba:review-plan` as
user-invoked commands. Reviewing a diff or a plan from a prior session is a product feature, and
Opus 5 is reportedly strong at it — "high precision and recall... accuracy holds at lower effort
settings." The line is **same-turn self-verification vs. cross-session review**. The four layers
above are on the wrong side of it; the standalone commands are not.

This overlaps an already-open question (the `/ba:plan` convention-gate reconsideration) which was
filed before this guidance existed. The guidance supplies the missing external evidence that
question was waiting on.

## Finding 2 — Always-resident prompt weight

> **Then:** Load all context immediately in system prompts. **Now:** Use selective loading through
> skills and deferred tools... Move detailed guidance into callable skills.

Anthropic's own datapoint: they removed **over 80% of Claude Code's system prompt** for Opus 5 and
Fable 5 with no performance degradation.

Measured weight (bytes/4; real counts run 15–30% higher on dense tables):

| File | Lines | ~tokens | Unreachable on a typical run |
|---|---|---|---|
| `commands/ba/propose.md` | 917 | ~18.5k | Step 3 composition spec (~170 ln) + Step 5f (~150 ln, `commit_push_create` only) |
| `commands/ba/review.md` | 1,135 | ~17.8k | `--persist` step (~116 ln) + mutually-exclusive local/MR resolvers (~290 ln) + 1b/1c diff capture |
| `commands/ba/plan.md` | 785 | ~9k | 2 of 3 detail-level templates (~150 ln always dead) |
| `commands/ba/execute.md` | 616 | ~9.8k | both `.md`/`.html` validation branches resident |

`commands/ba/review.md:710` self-documents the dead weight: the `--persist` step "has no effect on
the default flow" yet loads on every run.

The pattern to extend already exists and is well-designed: the **canonical load-site pattern** at
`references/html-rendering.md:8-12`, cited rather than restated by `plan.md:558-566`,
`brainstorm.md:137-143`. Also the cross-command runtime include at `review.md:135-138`,
`propose.md:143-149`, `handoff.md:52-56` ("open that section and run its steps verbatim — the full
algorithm lives only there").

**Consequence for the deferred commands→skills migration:** skills are the guidance's *named*
vehicle for progressive disclosure. That item was deferred on the grounds that the invocation
question (`/ba:<name>` vs `/dev-workflow:<name>`) was unresolved; the payoff side of that trade has
now materially increased. Its revisit trigger has effectively fired.

## Finding 3 — Repetition

> **Then:** Repeat instructions across system prompt and tool descriptions. **Now:** Consolidate
> into tool descriptions only. Claude 5 doesn't need reinforcement from multiple sources.

Eight named "keep in sync" obligations exist, plus a mirror-site *grid* in `CLAUDE.md:83-94` whose
own rationale is drift management. The clearest single candidate is the severity/confidence rubric
pasted verbatim into all seven built-in reviewer agents
(`architecture-reviewer.md:72`, `security-reviewer.md:74`, `simplification-reviewer.md:72`,
`test-coverage-reviewer.md:73`, `error-handling-reviewer.md:73`, `complexity-reviewer.md:78`,
`deep-module-reviewer.md:85`), with an explicit note that it is "duplicated here for
**defence-in-depth** — a reviewer reading only its own agent file still sees the rubric."

That is insurance against a dispatcher that forgets to include it. It is a weak-model hedge.

Unlabeled duplication inside single files is larger in token terms: `review.md` Step 3 triplicates
the severity table + confidence table + protected-artifacts paragraph + bullet-format spec across
its three dispatch templates (`414-440`, `460-486`, `512-538`) — ~120 lines of byte-identical text.
`review-plan.md:248-319` already demonstrates the fix: state the shared requirements once, shrink
each template to 3–6 lines.

## Finding 4 — Reviewer prompts that ask for conservatism

> If your review prompt says "only report high-severity issues" or "be conservative," the model may
> follow that instruction literally and report less; ask it to report everything and filter in a
> separate pass instead.

The architecture here is already correct — `review.md:561-704` is exactly the separate filter pass
(`parse → validate → group → merge → gate → render`). The risk is that severity/confidence
rubrics embedded in the *dispatch* prompts pull filtering upstream into generation, where the
guidance says it costs recall. Needs a read of the rubric text specifically for withholding
language, not a redesign.

## Finding 5 — Prose-in / regex-out subagent contracts

> **Then:** Provide usage examples for tools. **Now:** Design expressive tool parameters instead.

The reviewer contract is untyped prose in, hand-written grammar out: `review.md:563-578` defines a
7-rule permissive parser (including an em-dash rule accepting `—`/`–`/`--`), and `582-595` runs a
6-check validator with named salvage counters — `coerced`, `dropped_no_fileline`, `snapped`,
`confidence_default`, `dropped_file_not_in_repo`, `off_diff`, plus `legacy_format` and
`mixed_format`. The existence of the last two is direct evidence the prose contract drifts in
practice.

`agents/interface-design-generator.md` already shows the in-repo alternative: declared `## Inputs`
(`27-32`), declared `## Output Format` (`47-66`), and the parse-failure contract stated at both
ends — agent side (`71`) and caller side (`brainstorm.md:226`).

## Finding 6 — Two new levers, currently unused

- **Effort.** `low`/`medium` "produce strong quality at a fraction of the tokens and latency";
  Every's practical finding was blunter — "medium or low effort works better, as more time given to
  think increases the likelihood of annoying behaviors." Review accuracy specifically "holds at
  lower effort settings, which supports a fast pass at review time and a more thorough pass later,"
  which maps directly onto a tiered-review design. Currently 9 of 17 agents pin `model: sonnet`;
  none set effort.
- **Deliverable length.** "Files that Claude Opus 5 writes to disk (reports, Markdown documents,
  summaries) are often longer than on prior models." Every artifact this plugin produces is such a
  file. No command carries length calibration; the templates constrain *shape* only.

## What is newly validated — protect these

Several sections already read as if written against this guidance:

- `commands/ba/review.md:287-290` — the deliberate refusal to become a lookup table: "It is **not**
  a scoring rubric and **not** a category→reviewer mapping... *(A fixed category→reviewer table is
  rejected on purpose... do not regress this step into a lookup table.)*"
- `commands/ba/research.md:70-75` — "Each agent knows its job — tell it what you're looking for,
  not how to search. Don't write detailed prompts about HOW to search — the agents already know."
- `commands/ba/handoff.md:86` — "Structure the document however the session's actual content
  warrants — there is no fixed template." The one file written entirely in the judgment-first
  register.
- The `references/` canonical load-site pattern (Finding 2).
- The never-hide selection ledger's enumeration guarantee — this is a *product* commitment about
  surfacing choices to the user, not model steering, and is unaffected.

## What should stay specified

The guidance targets over-steering, not interface contracts. These are machine-boundary
specifications and should not be relaxed:

- `propose.md:605,676` — the single-Bash-call `mktemp`/heredoc/`git commit -F` invariant, written
  against "a confirmed, repeated production incident."
- Sentinel strings (`[AUTO-SCORE: …]`, `__BA_PROPOSE_COMMIT_END__`) and the reviewer bullet grammar
  — these are parser contracts between two processes.
- The U-ID anchor grammar and `resolve-stack-base` — cross-command owned operations.
- HTML `id=""` requirements — consumed by downstream extraction.

The repo already articulates this trust gradient, and even has a named convention for when to
distrust prose and hand the model literal code (`plan.md:477-481`, applied at `execute.md:337-341`
and `propose.md:743-751`).

## Incidental finding — maintenance chatter in runtime prompts

Distinct from the above, and cheap to fix: authoring and review-cycle notes are resident in prompts
the model reads at runtime. `propose.md` carries **8** `(Review fix: …)` parentheticals (`29`,
`295`, `329`, `334`, `345`, `367`, `445`, `506`), each explaining what a prior draft got wrong;
`execute.md` carries 6 `**Residual (documented)**` maintainer notes; `execute.md:409-414` is a
literal plan-execution checklist ("Five-site walk (U-ID convention edit)... All five walked") left
inside the shipped command. `propose.md:53` and `519` document trade-offs at lock time and a
rejected earlier design.

None of this addresses the model. It competes with the instructions that do.

## Open questions

- Does Opus 5 actually drop origin requirements in `/ba:plan` at a rate that justifies a
  reconciliation step, given the guidance's claim that its own scope-discipline paragraph is the
  intended remedy? This is empirically testable and currently untested.
- Is there a measurable quality cost to removing the four self-verification layers, or only a token
  saving? The guidance asserts "no loss in quality" generally; this repo has no eval harness to
  confirm it locally.
- Prompt-only changes cannot be dry-run in a live session (the running session executes the body
  loaded at session start), so every item in this lane needs a fresh-session A/B.
