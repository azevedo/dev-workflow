---
date: 2026-07-18T15:27:11+0100
researcher: Claude
git_commit: 68e04c4af0b46b4c1c3d71e46bfae43b16a708e1
branch: main
repository: dev-workflow
topic: "Why /ba:compound never auto-triggers, how ce-compound handles it, and what to capture from the evolved ce-compound family"
tags: [research, compound, auto-invocation, skills, hooks, ce-compound, ce-compound-refresh, knowledge-compounding, external-comparison]
status: complete
last_updated: 2026-07-18
---

# Research: Why `/ba:compound` never auto-triggers, and what to capture from ce-compound

**Date**: 2026-07-18T15:27:11+0100
**Git Commit**: 68e04c4
**Branch**: main
**Repository**: dev-workflow

## Research Question

`/ba:compound` never auto-triggers — why? At the same time, figure out how the sibling `compound-engineering-plugin`'s `ce-compound` skill does it (if at all). The felt problem: compounding opportunities are missed because it's rare to go back into a finished session to check whether there were bumps worth recording, so more automatism is ideal — unless there are strong caveats. Separately, `ba:compound` was built months ago and `ce-compound` (plus siblings like `ce-compound-refresh`) has evolved a lot since; capture the improvements worth incorporating.

## Summary

Three findings, in order of importance:

1. **`/ba:compound` cannot auto-trigger the way it claims, because the mechanism it relies on does not exist.** The `<auto_invoke><trigger_phrases>` block lives in the command *body* (`commands/ba/compound.md:13-24`), but Claude Code never reads a skill/command body until *after* it has been invoked. Only the frontmatter `description`/`when_to_use` is visible beforehand, and **nothing in the engine scans conversation text for phrases like "that worked"**. "Auto-trigger" here is aspirational prose, not a wired mechanism. The only real path to non-manual invocation is *best-effort model judgment* — the model reading the description and choosing to call the tool — which is heavily biased toward following your next instruction rather than self-selecting a meta "let me document this" action mid-flow.

2. **`ce-compound` does not solve this either — and it deliberately stopped trying.** The evolved plugin ships **zero hooks**, no git hooks, no pipeline auto-run. Its flagship `lfg` autopilot (brainstorm→work→review→commit→PR) has **no compound step at all**. Every non-manual path is user-gated (a "compound it" phrase, an accept prompt, or a menu pick). Its SKILL.md *explicitly rejects* self-firing: "Bare 'automatically' or 'auto-run' is **not** on its own a headless signal." Tellingly, `ce-compound` even **removed** the trigger-phrase language from its `description` that `ba:compound` still carries. It went the opposite way: give up on conversational auto-fire, and instead (a) make *deliberate* invocation frictionless (auto-pick mode, auto-probe — no blocking questions), and (b) build a **headless mode** so an orchestrating skill or a human menu-choice can fire it unattended at the natural end of work.

3. **The honest answer to "more automatism":** Claude Code offers no event that fires on "problem solved." The realistic levers are a better `description` (cheap, best-effort), a `Stop`/`SessionEnd` **hook that can only nudge or run a script** (it cannot read Claude's reasoning), and — most promising for this setup — **chaining a capture offer into a command you already run at "done" moments** (`/ba:propose`, `/ba:review`). That is exactly the pattern `ce-pov`/`ce-debug`/`ce-optimize` use. Strong caveats apply (noise, flow-interruption, cost, banner-blindness), which is precisely why the mature plugin keeps a human in the loop.

Bonus context: **`docs/solutions/` does not exist in this repo.** `/ba:compound` has effectively never run to completion here, so `learnings-researcher` always finds an empty store. The loop has never once closed.

## Detailed Findings

### Part 1 — Why `/ba:compound` never auto-triggers (the mechanics)

**`ba:compound` is a slash command, not a `skills/` skill.** dev-workflow has no `skills/` directory; the command lives at `commands/ba/compound.md`. In current Claude Code (unified skills system), commands and skills are merged — both are surfaced to the model and both are model-invocable unless `disable-model-invocation: true` — so eligibility isn't the blocker. It is surfaced this session as `dev-workflow:ba:compound`.

**What the model actually sees before invocation is only the frontmatter.** The authoritative Claude Code docs are explicit: a skill's body "loads only when it's used," and the model decides invocation from the `description` (+ optional `when_to_use`), truncated at 1,536 characters in the listing. That means:

- `commands/ba/compound.md:13-24` — the `<auto_invoke><trigger_phrases>` block — **is inert**. `<auto_invoke>` and `<trigger_phrases>` are not recognized fields; there is no engine that watches the conversation for "that worked" / "it's fixed" and fires anything. The model only ever sees that block *after* the command is already running. (The same is true of the identical block in `ce-compound`'s body at `skills/ce-compound/SKILL.md:721-725` — equally inert.)
- The only thing that *could* cause a non-manual fire is the model reading `commands/ba/compound.md:2-3` (the `description`, which does mention the trigger phrases) and choosing to call it. This is **best-effort model judgment**, not a trigger.

**Why that judgment almost never fires it in practice:**

- **Attention goes to the next instruction.** When you say "that worked, now let's do X," the model does X. A documentation action is a *meta* interruption of the work; Claude Code's default posture biases toward the user's actual request and against self-selecting tangential tooling.
- **The command interrupts itself even if it did fire.** `commands/ba/compound.md:34-38` gates auto-trigger behind an `AskUserQuestion` confirmation ("I detected a solved problem… document it?"). So the design is friction-first on the auto path.
- **Listing budget.** With many skills/commands available, descriptions can be truncated/dropped to fit a character budget (`skillListingBudgetFraction`), further weakening an already best-effort signal.
- **The loop is cold.** Because `docs/solutions/` has never been created here (verified: the directory does not exist), there is no positive-feedback reinforcement — `learnings-researcher` reports "No documented solutions found" every time (`agents/learnings-researcher.md`).

**Hooks cannot rescue phrase-based triggering.** Claude Code hooks fire on *lifecycle events only* (SessionStart, SessionEnd, UserPromptSubmit, Stop, PreToolUse, PostToolUse, PostCompact…). Per the docs, hooks "cannot monitor conversation content or user messages for specific phrases, trigger based on Claude's reasoning or outputs, or react to arbitrary conversation state." So a hook can run a script on `Stop`, but it can only see filesystem/git state — never "we just solved something."

### Part 2 — How `ce-compound` handles it (it doesn't auto-fire; it made deliberate invocation cheap)

**Verdict from a full sweep of the plugin: no automatic-invocation wiring exists.**

- **No hooks.** No real `hooks.json` and no `"hooks"` manifest key anywhere (matches exist only under `tests/fixtures/`). None of the platform manifests (`.claude-plugin`, `.codex-plugin`, `.cursor-plugin`, `.devin-plugin`, `.grok-plugin`, `.kimi-plugin`, `.opencode`, `.pi`) wire an event/trigger to `ce-compound`.
- **`ce-setup` installs nothing that fires it.** It's a health check + config-template copier — no hook, no git hook, no cron, no standing instruction.
- **The `lfg` autopilot pipeline has no compound step.** Its ordered steps end at commit→PR→babysit→announce; it even offers `/ce-explain` for new concepts but never `ce-compound`.

**The three ways `ce-compound` is actually reached — all human-in-the-loop:**

1. **Manual** — user types `/ce-compound` (the documented "sixth step of the loop").
2. **Model-conversational** — the model may invoke it from its `description` ("Use when capturing a learning after work") — the same best-effort judgment as `ba:compound`, no stronger.
3. **Headless, caller-driven** — only from sibling skills, each **user-gated**:
   - `ce-pov` → invokes `ce-compound mode:headless` **only when the user says "compound it"** in response to an optional one-line nudge ("Want it in our decision history? say 'compound it.'"). Marked "Never mandatory."
   - `ce-debug` → runs `/ce-compound` **only if the user accepts** a blocking prompt; default is to skip silently unless the lesson generalizes.
   - `ce-optimize` → `/ce-compound` presented as a **menu option** after completion.
   - `ce-dogfood` → discretionary ("if the bug carried a reusable lesson").

**The design signal that matters most:** `ce-compound` *removed* the trigger-phrase advertising that `ba:compound` still has, and its SKILL.md explicitly says a bare "automatically" is not a signal to run unattended. Instead the evolution invested in two other things:

- **Frictionless deliberate runs.** Recent changes made the agent *decide* Full-vs-Lightweight mode instead of asking, and made session-history an automatic cheap probe instead of a question. The only interactive prompt left is the one that edits a tracked instruction file. Net effect: a *manual* `/ce-compound` is now one keystroke with essentially zero follow-up friction — the opposite of `ba:compound`'s confirmation-gated auto path.
- **Headless as the automation seam.** "Headless mode is intended for automations and skill-to-skill invocation where no human is present to answer questions." The point is that an *orchestrator* (or a human menu-choice at the end of work) fires it — not the conversation.

**Takeaway:** the ecosystem's best answer to "capture more, remember less" is not an event trigger. It is: (a) remove every reason *not* to run it manually, and (b) hang a capture offer off the moment work naturally concludes.

### Part 3 — The realistic levers for "more automatism" (and the strong caveats)

Ranked by reliability-and-fit for this setup:

1. **Sharpen the `description` for model-proactive invocation (cheapest).** Keep concrete trigger phrasing, but this stays best-effort. Iterating the description is the only knob that makes conversational auto-fire more likely; it will still miss and mis-time. Downside: false positives if too eager.
2. **Chain a capture offer into a command already run at "done" moments (best fit).** `/ba:propose` (commit/push/PR) and `/ba:review` both execute at the exact point where a problem has just been solved and verified — the moment the user says they never go back to. Adding an end-of-command "Document this learning? (y/headless-run)" mirrors the `ce-pov`/`ce-debug`/`ce-optimize` pattern and directly attacks the "I never revisit the session" problem, while keeping a human gate. This is the highest-leverage option here.
3. **A `Stop`/`SessionEnd` hook that *nudges* (not fires).** A `command` hook can print a reminder ("solved something worth compounding? `/ba:compound`") or a `prompt`/`agent` hook can ask Claude to judge — but it cannot read reasoning and cannot deterministically detect "solved." Caveats: banner-blindness (a reminder on every Stop becomes noise), token cost of a `prompt`/`agent` hook on every turn-end, and fragility (git state ≠ "we learned something"). The `agent` hook type is experimental.
4. **Remove the friction on the manual path (do this regardless).** Drop or soften the `AskUserQuestion` confirmation gate; auto-pick a lightweight vs full path. This is what actually moved the needle for `ce-compound` — a capture you'll actually run beats an auto-trigger that never fires.

**Strong caveats to "more automatism" (why the mature plugin keeps a human gate):**

- **Noise / false positives.** Firing on every "that worked" documents trivia. `ce-compound` guards with preconditions (non-trivial, verified, solved-not-in-progress).
- **Flow interruption & cost.** `ba:compound` currently dispatches 5 parallel subagents per run; auto-firing that mid-flow is expensive and disruptive.
- **Quality/grounding risk.** A capture fired reflexively mid-session may document an unverified or half-true fix — the exact failure `ce-compound`'s grounding validation exists to prevent.
- **Verified-solution ambiguity.** "That worked" is often said before the fix is actually confirmed; deterministic triggers can't tell.

### Part 4 — Improvements to capture from the evolved `ce-compound` / `ce-compound-refresh`

`ce-compound` accreted, over ~4 months: a schema/track model, overlap-aware create-vs-update, two deterministic validators, a session-history probe, a CONCEPTS.md vocabulary substrate, a scratch-artifact reliability pattern, auto-memory scanning, and headless + depth automation — while its *maintenance* half spun out into `ce-compound-refresh`.

**High value, low overhead — worth folding into `ba:compound`:**

- **Bug vs Knowledge track split (schema-driven templates).** Two distinct doc shapes (bug: Symptoms/What-Didn't-Work/Solution/Why/Prevention; knowledge: Context/Guidance/Why-It-Matters/When-To-Apply/Examples). Changes *what sections a doc even has*. Cost is a `schema.yaml` + a two-track template. `ba:compound` currently has one fixed template (`commands/ba/compound.md:86-121`).
- **`validate-doc-claims.py` (mechanical grounding).** ~1 stdlib script: checks that backticked file paths cited in the written doc exist in the tree, links resolve, SHAs are real, no leftover drafting scaffold. Highest value-per-line — a learning that cites a nonexistent path silently poisons future work. Rule: *adjudicate, don't auto-fix* (a doc may legitimately cite a path its own fix deleted).
- **`validate-frontmatter.py` (parser-safety).** ~1 stdlib script (no PyYAML): catches silent-corruption YAML (bad `---`, unquoted ` #` comment-truncation, unquoted `: `). Cheap insurance since `learnings-researcher` reads this frontmatter.
- **Overlap → update-existing vs create-new.** The single best anti-drift idea: before writing, score overlap with existing docs; on high overlap, **update the existing doc** with fresher context instead of creating a duplicate that will drift. This is the failure the whole `ce-compound-refresh` skill exists to clean up — cheaper to prevent.
- **Grounding *prose* rules (zero code).** "Read the defining `file:line` before asserting code behavior; cite PR numbers over bare commit SHAs; soften/attribute claims you can't verify." Pure instruction text, near-zero cost, directly improves trustworthiness.
- **One-learning-per-run guardrail + auto-memory scan.** Both cheap. The auto-memory scan is *directly relevant to this setup* — this repo already runs with `MEMORY.md` auto-memory injected, which `ce-compound` treats as *supplementary* (never primary) evidence, tagged for provenance.
- **Discoverability check.** Ensure `CLAUDE.md`/`README` surface `docs/solutions/` (what it is, when to search, which frontmatter fields) so agents actually consult it. Informational tone, not imperative.

**Frictionless-invocation change (the one that addresses the felt problem):**

- **Agent decides mode; no confirmation prompt.** `ce-compound` made Full-vs-Lightweight an agent decision and dropped blocking questions. Porting this — and dropping `ba:compound`'s auto-path `AskUserQuestion` gate — is what actually makes capture happen more often.

**Heavy / plugin-specific — skip or defer for a lightweight command:**

- **The entire `ce-compound-refresh` maintenance sweep.** Conceptually excellent — a five-outcome **Keep / Update / Consolidate / Replace / Delete** model, `status: stale` conservative-deferral, bounded-sweep safety (a headless scope hint that matches nothing exits rather than widening), all-three-must-hold delete gate. But it's a whole second command's worth of judgment. Defer; if wanted later, port the *5-outcome model + stale-marking* as its own slim command, not into `ba:compound`.
- **CONCEPTS.md vocabulary capture + seeding + reconciliation.** Elegant shared-glossary substrate, but a lot of non-obvious machinery (seeding rules, per-run reconciliation, a second discoverability target). High ceremony for a home-grown tool; skip or make it a much later opt-in.
- **Session-history probe (4 cross-platform JSONL scripts).** Clever wall-clock design, but heavy and platform-specific; the payoff (an *unrelated* prior session held related work) is marginal for solo use. Skip.
- **7 specialist agent prompts + Phase 3 optional reviews.** Redundant — this repo already has a strong reviewer roster in `/ba:review`.
- **Scratch-artifact run-dir pattern (issue #956).** Subagents write full prose to a scratch file and return only the path, because a subagent asked for long inline prose intermittently returns an executive summary instead. This *does* apply to `ba:compound` (it dispatches parallel subagents returning text, `commands/ba/compound.md:49-62`) — but it's a reliability refinement, only worth it if the parallel design is kept. If `ba:compound` moves to a single-pass "lightweight" shape, it's unnecessary.
- **Headless mode + `depth:` selector + shared grounding cache + multi-platform question abstraction.** Automation/infra for a 6-target distributed plugin. This repo is Claude-Code-only and interactive. (The shared grounding cache was even partially reverted upstream — evidence it wasn't worth the complexity.)

**Net recommendation:** `ce-compound`'s **Lightweight Mode** (`skills/ce-compound/SKILL.md:486-535`) is the blueprint for a better `ba:compound` — single-pass, no subagents, but keeping track-classification, exact-path collision handling, both deterministic validators, the read-only discoverability check, and update-vs-create. Treat Full mode's parallel research, session history, CONCEPTS.md seeding, and the whole refresh skill as heavier options to leave out or defer.

## Code References

Paths under `commands/`, `agents/`, `README.md` are in **this repo** (dev-workflow). Paths under `skills/` are in the **compound-engineering-plugin** (github.com/EveryInc/compound-engineering-plugin).

- `commands/ba/compound.md:2-3` — frontmatter `description` that still advertises "auto-triggers on phrases…"
- `commands/ba/compound.md:13-24` — the inert `<auto_invoke><trigger_phrases>` body block
- `commands/ba/compound.md:34-38` — the auto-path `AskUserQuestion` confirmation gate (friction)
- `commands/ba/compound.md:49-62` — 5 parallel subagents returning text (the parallel design)
- `commands/ba/compound.md:86-121` — the single fixed doc template
- `agents/learnings-researcher.md` — consumes `docs/solutions/`; reports empty when the store doesn't exist
- `README.md:159-166, 284-288` — README claims "let it auto-trigger" (aspirational; never fired)
- `skills/ce-compound/SKILL.md:3` — `description` with the trigger-phrase language *removed*
- `skills/ce-compound/SKILL.md:36` — explicit rejection of bare "automatically"/"auto-run" as a headless signal
- `skills/ce-compound/SKILL.md:721-725` — the equally-inert `<auto_invoke>` body block
- `skills/ce-compound/SKILL.md:486-535` — **Lightweight Mode** (the portable blueprint)
- `skills/ce-compound/scripts/validate-doc-claims.py` — mechanical grounding validator
- `skills/ce-compound/scripts/validate-frontmatter.py` — parser-safety validator (stdlib only)
- `skills/ce-compound/references/schema.yaml` — bug/knowledge track contract + category mapping
- `skills/ce-compound-refresh/SKILL.md:70-78` — the five-outcome maintenance model (Keep/Update/Consolidate/Replace/Delete)

## Architecture Insights

- **Body prose can't trigger; only frontmatter can be *seen* to trigger.** Any "auto-invoke" instruction placed in a skill/command body is decorative. If auto-invocation matters, it must live in `description`/`when_to_use` — and even then it's best-effort model judgment, not an event.
- **The ecosystem converged on "human-gated at the end of work," not "event-fired mid-conversation."** The most-evolved compound skill deliberately walked *away* from conversational auto-fire and toward frictionless manual + orchestrator-driven headless. The right lesson isn't "wire a trigger" — it's "make the run cheap and hang the offer off a moment you're already at."
- **Prevention beats maintenance.** Overlap-aware create-vs-update (in `ce-compound`) exists so the corpus doesn't drift into the mess that the entire `ce-compound-refresh` skill is built to repair. A lightweight command should adopt the cheap prevention and skip the heavy repair.
- **Deterministic validators are the highest value-per-line import.** Two small stdlib scripts turn "trust the model's prose" into "the cited paths provably exist" — the difference between a knowledge store that compounds and one that quietly poisons future work.
- **The loop has never closed here.** No `docs/solutions/` means every design discussion about `ba:compound`'s features is moot until *one* learning is captured. The first, smallest win is running it once — end to end — to create the directory and prove the `learnings-researcher` handoff.

## Historical Context (from docs/research/)

- `docs/research/2026-05-09-ce-code-review-vs-ba-review-research.md` — already notes `docs/solutions/*.md` is empty in this repo and raises the open question of whether `/ba:compound` should mine review findings as follow-ups. Corroborates Part 1's "cold loop."
- `docs/research/2026-06-17-plan-execute-vs-ce-comparison.html` — has a "Knowledge compounding" scoring row directly comparing `/ba:compound` to `ce-compound`, and a "Consume docs/solutions" row. Closest prior head-to-head.
- `docs/research/2026-05-17-shipping-skill-source-material-research.md` — open question asks whether a "what you learned" PR section should auto-populate from recent `docs/solutions/` entries, flagged as "a high-value integration with `/ba:compound`." This is an early sighting of Part 3's "chain capture into `/ba:propose`" idea.

## Related Research

- `docs/research/2026-06-27-html-output-mode-research.md` — prior port from compound-engineering (HTML rendering mechanics), useful as a precedent for "capture-then-adapt, don't copy verbatim."

## Open Questions

1. **Where should the capture offer hang?** `/ba:propose` (ship-time) is the strongest candidate for an end-of-work "document this learning?" nudge — but should it also/instead sit on `/ba:review`? Both are natural "done" moments.
2. **Nudge vs headless-run.** At that seam, offer a one-key confirm that then *runs* capture, or a fully headless capture with a post-hoc summary? The plugin keeps a human gate; is that the right call here, or is a solo repo tolerant of occasional over-capture?
3. **Which slice first?** Likely smallest-valuable: drop the auto-path confirmation friction + add the two deterministic validators + overlap-aware update-vs-create. Track split and grounding-prose rules are close behind. These are candidates for roadmap issues (hubbed by #29) rather than a competing design doc — this research is the evidence.
4. **Should `ba:compound` become a `skills/` skill** (to get first-class model auto-invocation semantics) rather than a `commands/` command? Marginal, given both are model-invocable now — but worth confirming against the current Claude Code version's behavior.
