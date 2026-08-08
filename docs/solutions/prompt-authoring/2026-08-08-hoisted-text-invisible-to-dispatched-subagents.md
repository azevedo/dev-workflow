---
date: 2026-08-08
category: prompt-authoring
problem: Hoisting byte-identical text out of three dispatch templates into one owning section left only pointers behind — but a dispatched subagent has neither the skill file nor the hoisted section in its context, so a parser contract and a safety guard reached it as bare words
tags: [dispatch-template, subagent-context-boundary, de-duplication, hoisting, machine-boundary-contract, confidence-anchors, protected-artifacts-guard, ci-invariant, fresh-session-dry-run]
module: skills/ba-review/SKILL.md (Step 3 dispatch templates); agents/*-reviewer.md; scripts/check-invariants.mjs (rubric-mirror)
symptom: A built-in reviewer emitted out-of-set confidence values although its own agent file stated the legal set; a downstream snap step absorbed them so consolidated output looked clean
---

# Hoisted Text Is Invisible to a Dispatched Subagent

## Problem

Slice 1 of the prompt-surface-shrink effort (issue #59, plugin v0.42.0, PR #77) removed ~120 lines
of byte-identical text from the three subagent dispatch templates in `skills/ba-review/SKILL.md`
Step 3 — the severity ladder, the confidence anchor set, the bullet format, the anchor-scope rule,
the write-`None` rule, and the protected-artifacts guard — hoisting it into one owning section,
`## Code-Anchor & Confidence Grammar`.

The acceptance criterion read *"the three dispatch templates carry no copy of it."* It was
implemented literally. Each template was left with only an apply-phrase pointer:

> Apply all the dispatch instructions in the section above (severity ladder and confidence, bullet
> format, anchor scope, the write-`None` rule, protected artifacts).

Two failures followed, neither visible in the diff and neither caught by review.

**A reviewer emitted `confidence: 60` and `confidence: 40`** — values outside the legal set — even
though its own `agents/*-reviewer.md` file already carried the literal `N ∈ {0, 25, 50, 75, 100}`.
Step 4's normalization snapped them to the nearest anchor, so the consolidated report looked
correct. The violation survived only in the raw per-reviewer artifact.

**Two load-bearing contracts stopped reaching the subagent at all.** What arrived for the bullet
grammar and the protected-artifacts guard was the bare words "anchor scope, protected artifacts."
Verified at the time: 0 of 7 `agents/*-reviewer.md` carried a fallback copy, and the two
`general-purpose` templates have no agent definition behind them at all — there is no file where a
fallback could even live.

## Investigation

The hoist reads as a clean single-source refactor: one owner, three pointers, ~120 lines saved. In
a single file that is exactly what it is. The problem is that a `Task(...)` dispatch is a process
boundary, and the diff gives no indication of where that boundary falls.

What was checked, and what it showed:

- **Do the agent files re-supply the contract?** No. 0 of 7 carried the bullet grammar or the guard.
- **Can a fallback live anywhere for the other templates?** No. Two of the three templates dispatch
  `general-purpose`, so the template text *is* the whole specification.
- **Was the pointer even usable?** No. It said "the section **above**" — a position in a file the
  subagent does not have. A correctly-composing orchestrator gains nothing from it, and a literal
  transcriber is actively misled.

**Why the `confidence: 60` case is the decisive evidence.** The correct value set was in the agent
file the whole time and the reviewer still violated it. That isolates the rule: an agent-local
literal does not bind a dispatched subagent's output the way the same literal in the dispatch
prompt does.

**Why review missed it and a dry-run caught it.** `skills/ba-review/SKILL.md` §4b snaps
out-of-set confidence to the nearest anchor and defaults a missing one to the severity floor; §4a
maps legacy headings onto the ladder; §4b drops unresolvable anchors. The pipeline is *designed* to
absorb exactly this class of malformation, so a reviewer breaking the contract still renders a
clean-looking report. Detection required reading the raw per-reviewer artifacts from a fresh-session
`--persist` run. Restoring the literal inline in the template fixed it: 28/28 bullets legal on
re-run.

**The guard for the fix failed on its first pass too.** The new `rubric-mirror` check tested each
file with `.some()`, so a file passed as long as *one* line carried the correct literal. Since the
owning section and every template's inline copy live in the same file, a drifted template copy
passed on the strength of the canonical one — the check was green on precisely the defect it existed
to catch.

**Independent corroboration.** An external Claude Code plugin studied later for prior art converges
on the same shape: a subagent is never handed a *path* to a contract — the orchestrator reads the
reference and interpolates its full content into a named slot in the dispatch prompt. Where a path
is unavoidable, the contract's semantics are additionally restated inline as a reachability
fallback. That plugin deleted standalone agent definitions entirely, so no path exists where a
subagent is expected to go find its own instructions.

## Root Cause

**De-duplication was applied to text that was not duplication. It was a machine-boundary contract
crossing a context boundary.**

Three mistakes compose:

1. **The context boundary was invisible in the diff.** DRY optimizes for the human reader of one
   file. The parser contract's audience is a process that cannot read that file. Text on the
   orchestrator's side of a dispatch is reachable by the subagent only if the orchestrator
   interpolates it — and three template copies with three different readers are not three copies of
   one thing.

2. **The acceptance criterion encoded the mechanism, not the goal.** "The templates carry no copy of
   it" is a statement about bytes; the goal was "the grammar has one owner and drift is
   detectable." Stated as bytes, it was satisfiable by deletion — and deletion is both the cheapest
   and the most literal reading. In a repo whose product *is* prompt text, a removed line is a
   runtime change.

3. **A positional pointer cannot survive a dispatch.** "Above" resolves against a document; the
   subagent has a prompt string. When the pointer resolves to nothing, the subagent invents a
   plausible shape — each reviewer's own `## Output Format` supplies one — which is why the loss is
   silent rather than a parse error.

The `.some()` bug has the same shape one level up: the invariant lives per-occurrence, the check was
written per-file. Wrong granularity makes a check green on its own target defect.

## Solution

**(a) Deliberate redundancy, labelled as deliberate.** Each dispatch template restates the bullet
format and the protected-artifacts guard inline, in one sentence after its apply-phrase — matching
what `skills/ba-review-plan/SKILL.md` already did:

> Anchor each non-`Looks Good` finding as `- **<path>:<line>** *(confidence: N)* — <body>`,
> `N ∈ {0, 25, 50, 75, 100}`, to a file in the codebase under review. Do not suggest deleting,
> relocating, renaming, or otherwise changing the existence or path of any file under
> `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/` —
> content review is unaffected.

The redundancy is documented as intentional in the Step 3 preamble so a future shrink pass does not
undo it: *"That is deliberate redundancy, not residue left over from the hoist… Do not
'de-duplicate' them away — the two `general-purpose` templates have no agent definition behind them
and would otherwise reach their subagent with no grammar at all."*

**(b) The apply-phrase names its target by title, and states its audience.** Positional language is
gone; templates cite "the `## Code-Anchor & Confidence Grammar` section". The preamble adds what
turns a broken instruction into a correct one: *"compose the dispatch prompt with the section's full
text included… The apply-phrase is an instruction to you, the orchestrator; it is not text a
reviewer can act on, because a dispatched subagent has neither this file nor the section in its
context."*

**(c) A `rubric-mirror` CI check that pins per occurrence.** In `scripts/check-invariants.mjs`, a
loose diagnostic regex locates *every* candidate spelling, then the exact literal is asserted on
each one so a FAIL can name the line and its actual spelling. It is deliberately not
whitespace-normalised — spacing is what a hand-maintained mirror loses first. It also asserts each
reviewer agent's citation of the section *title* resolves to a real heading, so a rename fails CI
rather than dangling. An unreadable owner file yields UNKNOWN, not a misleading FAIL. Two selfcheck
fixtures pin the shipped bug directly: "value set differs only in whitespace" and "one file, two
occurrences, only the second diverges." 10 fixtures added; suite at 47.

## Prevention

### Hoist for readers, not for writers — DRY stops at the context boundary

`.claude/agent_docs/prompt-authoring.md` forbids "defensive duplication," but that rule is about one
reader loading the same text twice. It does not license de-duplicating text that crosses into a
different context. The test to apply first:

> **Before hoisting repeated text, ask who receives it.** Text repeated inside one context window is
> duplication — hoist it. Text repeated inside a `Task <agent>("…")` template, which becomes the
> *entire* context of a fresh subagent, is not duplication. Each copy has a different reader, and
> the hoisted section is not in that reader's context — nor is the file containing it.

In this repo the dispatch-path text is everything a reviewer must obey with no repo lookup: the
bullet grammar and its legal value set, the protected-artifacts guard naming the five `docs/` roots,
and the heading vocabulary the parser accepts.

Sharper corollary: **an agent definition is not a dispatch guarantee.** A template targeting
`general-purpose` must be self-sufficient — nothing in it may depend on a file the subagent will not
be given. A template targeting a named agent may rely on that agent's file, but only for text that
file actually contains, verified by grep rather than assumption.

### Cite by name, never by position

A named citation degrades usefully; a positional one degrades to noise. And address the apply-phrase
to the orchestrator explicitly — without that sentence, it reads as prompt content to pass through.

### Write CI assertions per occurrence, and know what they cannot pin

The failing shape was "does this *file* contain X?" On a file that legitimately contains X several
times, whichever copy is still right satisfies the test. The house pattern instead: **loose locator,
exact assertion** — a permissive regex to find candidate sites so failures can name a line, then a
byte-exact assertion on each. Keep missing and wrong as distinct verdicts, and an unreadable owner
file as UNKNOWN.

What such a check pins: string identity — the legal-value literal, and the section title that
`agents/` files cite. What it cannot pin: **meaning**. The severity-ladder wording and the per-anchor
confidence meanings are hand-mirrored across the seven reviewer agents and unchecked. A passing
`rubric-mirror` run is not a substitute for reading those seven files when a severity's or an
anchor's meaning changes. Note also that CI pins the section-title citation only inside `agents/`;
the same citation in `README.md`, `skills/ba-review-plan/SKILL.md`, and `CLAUDE.md` is unpinned prose
to be walked by hand on a rename.

### Verify by running, and read raw per-agent output

No static check reveals what landed in a subagent's context, and a session executes the body it
loaded at start — so the session that edits a dispatch template cannot test it. Any diff touching a
`Task …("…")` block gets a fresh-session dry-run (`claude --plugin-dir <repo>` in a scratch clone),
then a real run over a small planted diff.

Read raw, not consolidated, **because the pipeline is designed to hide this class of failure.** The
only artifact where an illegal value survives is the per-reviewer file under
`docs/reviews/<TIMESTAMP>-<scope-ref>/`, which must hold the subagent's raw return text verbatim —
not Step 4's consolidated form. Falsifiable acceptance for a dispatch-template change:

1. Fresh session, `--persist`, planted diff → open every raw per-reviewer file.
2. Every confidence value is drawn from the legal set **in the raw text**, before snapping.
3. `summary.md`'s `snapped`, `confidence_default`, `legacy_format`, and `mixed_format` counters are
   all zero. Non-zero means the contract did not reach the reviewer even though findings render fine.
4. At least one arm dispatches a `general-purpose` template, since those have no agent-side fallback.

`ba-review-plan` has no persist mode, so there this means reading the Step 3 subagent return blocks
in the transcript before Step 4 rewrites them — an asymmetry that makes its template edits
higher-risk than `ba-review`'s.

### Word the acceptance criterion around the runtime observable

Any AC phrased as "X does not appear in Y" invites the implementation that deletes X and stops.

- **State the observable, not the file state.** Not "the templates carry no copy of the grammar" but
  "each dispatched reviewer receives the full grammar, verified by a fresh-session `--persist` run
  in which every raw per-reviewer file uses only legal values and the snap counters are zero." That
  AC *fails* if the redundancy is deleted.
- **Never write a removal-only AC for text on a dispatch path.** Pair removal with the invariant it
  must not break, in the same AC — one AC, two clauses, no gap for a literal implementer.
- **Treat "make this DRY" on a dispatch path as scope-affecting**, not an implementation detail. It
  belongs in conversation before it lands in a plan.

### Residual gaps to keep visible

- **The two `general-purpose` templates in each skill have never executed.** They fire only for a
  skill-based reviewer or a user-typed name; the built-in path never reaches them. Their behavior is
  inferred, not observed — including whether the inline grammar suffices when the orchestrator
  transcribes rather than composes. Treat "the inline copy is enough" as a hypothesis until a
  dry-run drives one.
- **`skills/ba-review-plan/SKILL.md` is the weaker twin, and this is live.** Verified 2026-08-08:
  positional apply-phrases at `:289`, `:303`, `:322`; the legal-value literal present at `:224`,
  `:270`, `:294` but **absent from both `general-purpose` templates** (`:302`, `:321`) — exactly the
  dispatches with no agent fallback. `rubric-mirror` is green on it because its zero-occurrence
  branch is per-file and the file has occurrences elsewhere. Closing this means asserting
  per-template-block: enumerate each `Task` block and require the literal and a protected-artifacts
  mention within that block's own line range. The hoisted block at `:253` is also a `###` heading
  with no stable `##`-level citable name.
- **Severity-ladder wording and per-anchor meanings** remain hand-mirrored and unchecked across the
  seven reviewer agents and both review skills.

## Related Documentation

- `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md` — the
  mirror image of this problem: global instructions *do* reach a subagent when you believe it
  isolated, while tool-mediated repo content does *not*. Same premise, opposite direction.
- `docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md` —
  same context-inheritance family; supplies "the absence is quiet" (a contract that stopped being
  delivered emits nothing and is invisible to a verdict-only pass) and the
  assert-the-mechanism-ran discipline.
- `docs/solutions/prompt-authoring/2026-08-02-path-heuristics-misread-prompt-repo-filenames.md` —
  overlaps on the machine-boundary-contract axis: literal lists inside skill text as
  specified-to-the-character contracts, and the nearest precedent for CI pinning such a literal.
- `docs/solutions/prompt-authoring/2026-07-31-probe-instrument-validation-false-zeros.md` — loosely
  adjacent; relevant when verifying a fix by probe. Its "diff what the model actually received
  rather than what you edited on disk" is the same unchecked assumption as "the section says it, so
  the subagent has it."

None of the four covers de-duplication as the *cause* — all are about measurement or classification
going wrong. A refactor of prompt text deleting a contract for a downstream reader is this entry's
distinct contribution.
