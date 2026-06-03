---
date: 2026-06-03
topic: ba-polish-command
status: approved
triage_level: full
tags: [polish, browser-automation, agent-browser, command]
---

# `/ba:polish` — Conversational Browser Polish Command

## What We're Building

A new slash command, `/ba:polish`, that adds a **polish phase** to the plugin's
workflow — the human-judgment bookend that runs after `/ba:review`. It is a
human-in-the-loop, conversational step where the **main agent drives a real
browser** so the developer can iterate on the *feel* of a just-built feature:
design, spacing, copy, empty/error states, motion. It is inspired by Every's
`ce-polish-beta` skill and by their workflow evolution (`Brainstorm → work →
review → compound` grew into `Ideate → brainstorm → plan → work → review →
polish → compound`), where polish became "the new end" of the loop because the
middle of the cycle is increasingly automated and the human's leverage moved to
the bookends.

It is for the developer who, today, polishes by hand — manually launching the
dev server, opening the browser, and capturing screenshots — and wants that
setup tax removed and the screenshot→diagnose→fix→hot-reload→re-screenshot loop
closed inside one conversation.

This brainstorm scopes **v0** only.

## Why This Approach

We considered where browser/platform knowledge should live and how much
machinery the plugin should own. Three framings were weighed:

- **A platform "map" the plugin owns and compounds** — rejected for v0. The
  "how the app works" map is *repo-specific* knowledge that belongs in the
  consuming frontend repo (as a skill the team governs), not in this generic
  plugin — the same way `CLAUDE.md` conventions live in the consuming repo. The
  plugin should *consume* such a map if present, never own it. Governance is
  undefined, so this is parked (see Scope Boundaries + Next Steps).
- **A persisted run-dir artifact per session** — rejected. Every's polish is
  deliberately "purely conversational — no checklists or envelopes," and the
  developer confirmed they don't want persistence. Polish writes nothing.
- **The conversational polish loop itself** — accepted as the v0 focus. It is
  generic mechanics (launch → scope → drive → iterate), which is the plugin's
  job, and it is valuable even with zero platform map because the plan + diff
  already orient the browser agent ("tier-1" context).

For the browser mechanism we chose **Vercel's `agent-browser` CLI** over Chrome
DevTools MCP. Research showed agent-browser already covers ~90% of the inspection
surface (console, errors, network, computed styles, traces, web vitals, React
renders) via Bash with ref-based (`@e1`/`@e2`) accessibility selection at
near-zero standing token cost, while Chrome DevTools MCP loads ~17–18k tokens of
tool schemas every turn — re-paying the exact tax Every shed when they swapped
Playwright MCP for agent-browser. The lean tool is also what lets the **main
agent drive directly** (keeping the conversational loop intact) instead of
isolating browser cost in a sub-agent — sub-agents run autonomously to
completion and cannot do tight human-in-the-loop back-and-forth.

## Key Decisions

- **Polish is its own command category** — *Rationale:* it doesn't fit the
  documented "execution = plan-driven" class (it is plan-less, driven by live
  developer feel + the diff). Resolving the convention check, we add a new
  **Polish Commands** category to `CLAUDE.md`/`README.md`: *"drive the running
  app — iterate on feel; never write production code beyond UI/feel fixes; never
  fix correctness bugs."* Mirrors Every's separate polish phase.
- **Sole v0 browser driver: `agent-browser` CLI** — *Rationale:* token
  efficiency + lets the main agent drive. Assumed installed; fail with a clear
  install hint if missing.
- **Main agent drives, no sub-agents** — *Rationale:* polish is interactive;
  sub-agent dispatch (as `/ba:review` uses) suits autonomous fan-out, not
  human-in-the-loop iteration. Side benefit: no new agent files.
- **Note bugs, don't fix them** — *Rationale:* keeps the lane sharp. "Review
  catches the bug; polish asks if it feels right." Correctness bugs are surfaced
  and deferred to `/ba:review` or `/ba:debug`.
- **Owns getting the app running (detect-or-launch)** — *Rationale:* removes the
  setup tax. Detect a running dev server; else launch via framework auto-detect
  + an optional `launch.json`-style config. Tear down only what it started.
- **Scopes from the current branch diff vs base** — *Rationale:* the just-built
  feature is the context; changed files → routes/components to look at.
- **No persisted artifacts** — purely conversational; no run-dir, no checklist.

## Locked Design

**Source:** Hybrid — B's user-facing contract (bare `/ba:polish` default +
`--route`/`--no-launch`/`--base` escape-hatch flags) wrapped around C's single
ui-driver verb seam (`navigate`/`observe`/`act`) so the browser driver can be
swapped via one adapter. C's other speculative seams (scope-resolver,
app-runner role indirection, generic error codes) are dropped as YAGNI until the
platform-map roadmap item lands.

### Interface

**Invocation:** `/ba:polish [scope-hint] [--route <path>] [--no-launch] [--base <ref>]`

- `scope-hint` (optional positional, free text) — narrows the diff-derived
  target set (e.g., `"empty states on the dashboard"`).
- `--route <path>` — narrow to a single route instead of every changed route
  (escape hatch for large diffs).
- `--no-launch` — skip server detection/launch; assume the dev server is up.
- `--base <ref>` — override the diff base (default: merge-base with `main`/`master`).

**Internal phase contract (ordered; each phase gates the next):**
1. **Preflight** — verify `agent-browser` on PATH; verify a git repo with a
   non-empty diff vs base. Hard-stop errors only here.
2. **Scope** — compute changed routes/components from the branch diff; produce
   an ordered (most-changed-first) target list, narrowed by `scope-hint`/`--route`.
3. **Serve** — resolve a base URL: probe for a running dev server; if none,
   auto-detect framework and launch (skipped to probe-or-assume under `--no-launch`).
4. **Drive + Iterate** — the only interactive phase. Per target: open it via the
   **ui-driver seam** (`navigate`/`observe`/`act`), surface feel observations,
   take developer direction, apply UI/feel fixes, hot-reload, re-observe.
   Bug-notes accumulate in memory.
5. **Wrap** — fires once on the session-end condition; replays accumulated
   bug-notes as a single deferral handoff to `/ba:review`/`/ba:debug`. Writes nothing.

**Invariants:** phases 1→2→3 are strictly ordered and gating; 4 is interactive;
5 fires exactly once. The command never edits source beyond UI/feel fixes, never
fixes a correctness bug (only notes it), never writes an artifact. All browser
control goes through the three ui-driver verbs; `agent-browser` is one adapter
behind them.

**Error modes:** `agent-browser` missing → stop in Preflight with install hint;
empty diff vs base → stop ("nothing changed vs `<base>`"); server won't start →
stop in Serve with the launch stderr + a "`--no-launch` and start it yourself"
hint; on `main`/`master` → branch-check warning (mirrors `execute.md`).

### Usage example

```
dev$ /ba:polish
  Base: main · 3 changed routes · dev server already up on :3000
  Looking at /checkout (most-changed) ...
  FEEL: "Place order" button sits flush against the total — no breathing room.
        Empty-cart state shows a raw "[]". Spinner has no label.
        (noted a possible bug: tax line shows NaN when qty=0 — deferring)
  What do you want to tweak, or "next"?
dev> more space on the button, and the empty state needs copy
  ... [drives the app, re-observes] ... better — spacing reads now.
dev> next ... done
  Session over. 1 bug noted: /checkout tax NaN at qty=0 → run /ba:review or /ba:debug
```

### What's hidden behind the seam

- **The browser driver** — that v0 shells to `agent-browser` with `@e1`/`@e2`
  refs is invisible at the contract; swapping to another driver touches only the
  adapter behind `navigate`/`observe`/`act`.
- **Base-ref resolution** — merge-base computation; the developer names a base
  only via `--base`.
- **Diff→surface mapping** — framework-specific logic turning changed files into
  navigable routes/components, ordered most-changed-first.
- **Server lifecycle** — port probing, framework auto-detect, optional
  `launch.json`-style config, and teardown of only self-started servers.
- **Bug-note bookkeeping** — accumulated in memory, replayed once at wrap.

### Dependency strategy

All dependencies are reached via Bash in fail-fast order. `agent-browser` is the
one hard precondition (verified in Preflight). `git` is read-only (merge-base +
diff feed Scope). The dev server is owned: probe first, launch only if nothing
answers, tear down only what was started. The browser is driven exclusively
through the ui-driver verb seam so the driver can be replaced by writing one
adapter without moving the invocation signature, phase order, drive loop,
bug-note flow, or session-end condition.

### Trade-offs

- **High leverage:** bare `/ba:polish` does the whole launch→scope→drive loop;
  the common invocation is one token, and base/scope/server are all derived.
- **High leverage:** the one driver seam absorbs the concrete risk that
  agent-browser gets replaced (Every swapped drivers once already) at near-zero
  cost — one adapter, no contract change.
- **Thin leverage:** large diffs can open more surfaces than wanted — the
  developer pays a `--route` flag to narrow (edge case reachable, not free).
- **Thin leverage:** non-standard/monorepo setups force `--no-launch` + manual
  server start.
- **Cost:** the silent merge-base default is almost always right but invisible;
  unusual branch topologies require noticing the announced base and using `--base`.

## Rejected Designs

### Design A — Deepest module (rejected)
- **Interface summary:** `/ba:polish [scope-hint]`, no flags; every choice
  behind the seam; a discovered `polish.config.json` as the only escape hatch.
- **Why rejected:** too rigid for an *exploratory* tool — no in-band way to
  polish an un-diffed surface or point at an undetected server (config-file
  spelunking required), and when auto-detect misfires there's no knob to grab.
  The hybrid keeps A's deep default but restores B's escape hatches.

### Design C — Info hiding (rejected as a whole; one seam retained)
- **Interface summary:** role-named contract with three seams (scope-resolver,
  app-runner, ui-driver) and generic error codes; driver swap + platform-map
  both free at the contract.
- **Why rejected:** speculative generality for a single-driver/single-launcher/
  single-scope-source v0 — the maintainer pays an indirection tax now for
  changes we deliberately deferred. **Retained:** C's single `ui-driver` verb
  seam (the one axis with concrete expected churn). Dropped: the scope-resolver
  abstraction, app-runner role indirection, and generic error codes — to be
  refactored in if/when the platform-map roadmap item lands.

## Scope Boundaries

**Out of scope for v0 (explicit exclusions):**
- The **Tier-2 platform-map seam** (consuming an external, repo-owned "how the
  app works" map). Parked as a roadmap item — see Next Steps.
- **Chrome DevTools MCP** as a primary or secondary/throttling driver — researched
  and rejected (token cost; agent-browser covers the polish surface).
- **Persisted artifacts** of any kind (run-dirs, checklists, screenshots-to-disk).
- **Fixing correctness bugs** — noted and deferred to `/ba:review`/`/ba:debug`.
- **Sub-agent dispatch** — polish is main-agent-driven.

## Acceptance Criteria

- `/ba:polish` exists at `commands/ba/polish.md` with command frontmatter
  matching sibling commands (`name`, `description`, `argument-hint`).
- Bare `/ba:polish` runs the full Preflight→Scope→Serve→Drive→Wrap loop with no
  flags in the common case (current branch, running-or-launchable server).
- `--route`, `--no-launch`, and `--base` behave as the documented escape hatches.
- Missing `agent-browser` produces a clear install hint and stops before any
  server launch; empty diff and server-won't-start each stop with their
  specified message.
- All browser interaction goes through a single `navigate`/`observe`/`act` seam
  with `agent-browser` as the v0 adapter.
- Noticed correctness bugs are surfaced and deferred, never auto-fixed; the wrap
  step replays them once.
- No file is written by a polish session.
- A new **Polish Commands** category is added to `CLAUDE.md` and `README.md`, and
  `/ba:polish` is listed; `version` in `.claude-plugin/plugin.json` is bumped.

## Open Questions

(None — all resolved during this brainstorm.)

### Resolved Questions
- *Where does browser/platform knowledge live?* → In the consuming frontend repo,
  not the plugin. Plugin consumes if present (parked seam).
- *Persist a run-dir?* → No. Purely conversational.
- *Main agent or sub-agent drives?* → Main agent (interactivity).
- *Browser tool?* → `agent-browser` CLI for v0.
- *Dev server ownership?* → Detect-or-launch.
- *Default target?* → Current branch diff vs base.
- *agent-browser dependency?* → Assume installed + install hint on failure.
- *Class conflict (execution = plan-driven)?* → New "Polish" command category.

## Convention Compliance

Convention-compliance gate run before write (mandatory per `CLAUDE.md`). Result:
1 violation, 2 justified overrides, 7 aligned, 4 not applicable.

- **Resolved violation:** `/ba:polish` did not fit the documented "execution =
  plan-driven" class. **Resolution:** add a new **Polish Commands** category to
  `CLAUDE.md`/`README.md` with its own authority definition (feel + diff; never
  fix correctness bugs). This requires a `CLAUDE.md` edit beyond the command-list
  line — captured in Acceptance Criteria and to be done at execute time.
- **Justified overrides:** no runtime frontmatter / no convention-gate output
  (polish persists no artifacts, so the artifact rules don't attach); code-writing
  scoped to UI/feel fixes (polish is neither a planning nor a git-workflow
  command, so those code-boundary rules don't bind — valid once the new category
  exists).
- **Aligned:** `ba:` prefix; `commands/ba/polish.md` location; no new agents;
  README + CLAUDE.md update intent; version-bump intent; brainstorm artifact path
  + this gate.

## Next Steps

→ `/ba:plan` to create the implementation plan.

**Roadmap (defer to plan phase, then file as a GitHub issue):** the Tier-2
platform-map seam — let `/ba:polish` consume an external, repo-owned platform map
when present. To be filed once polish reaches the plan phase, per the developer's
instruction.
