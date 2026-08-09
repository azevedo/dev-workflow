---
date: 2026-08-09
category: prompt-authoring
problem: A documented residual gap survived a full merge because the CI check meant to catch it asserted per file, so a stripped dispatch template passed on a sibling template's correct copy
tags: [dispatch-template, ci-invariant-granularity, residual-gap-closure, sibling-file-recurrence, prompt-authoring]
module: scripts/check-invariants.mjs (rubric-mirror); skills/ba-review-plan/SKILL.md (Step 3 dispatch templates)
symptom: rubric-mirror reported PASS on a file whose two `general-purpose` dispatch templates carried neither the legal confidence-value literal nor the protected-artifacts guard — the check named the right literal in the right file and still could not see the defect
---

# Per-Dispatch-Block CI Catches What Per-File CI Cannot

**This is the closure entry for the residual gap recorded in
[`2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md`](2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md).**
That entry diagnosed the defect class (hoisted text is invisible across a dispatch boundary), fixed
it in `skills/ba-review/SKILL.md`, and — under *Residual gaps to keep visible* — named the sibling
file, the exact line numbers still broken, and the fix to apply. Read it first. This entry documents
only what happened **after** that prediction was written down.

Do not re-derive the DRY-across-a-dispatch-boundary lesson here. It is already written.

## Problem

The predecessor entry stated, on 2026-08-08, that `skills/ba-review-plan/SKILL.md` carried the same
defect: positional apply-phrases in all three dispatch templates, and both `general-purpose`
templates missing the legal-value literal and the protected-artifacts guard. It even prescribed the
fix — *"asserting per-template-block: enumerate each `Task` block and require the literal and a
protected-artifacts mention within that block's own line range."*

The gap then survived an entire slice-2 branch, review, and squash merge. Throughout that window
`node scripts/check-invariants.mjs --only rubric-mirror` reported **PASS** on the broken file.

That is the finding. Not "prompt text drifted" — that was already known and written down. The
finding is that **a documented residual gap does not self-close, and a green check actively
masked it.**

## Investigation

Three things independently made the gap hard to see, and each looked like reassurance:

1. **The consolidation parser is correct.** Step 4's normalization table snaps an out-of-set
   confidence to the nearest anchor and defaults a missing one to the section floor, recording
   `snapped` / `confidence_default`. A reviewer that never received the grammar produces output the
   parser cleans up. No error path is taken. *(Mechanism confirmed by reading Step 4; no run
   artifact from the broken window was recovered, so this is a reachable path, not an observed
   event.)*

2. **Each reviewer agent supplies its own `## Output Format`.** A subagent missing the
   dispatch-supplied grammar still emits well-formed-*looking* bullets from its own definition.
   There is no shape difference to grep for.

3. **CI named the right literal in the right file and still passed.** This was the expensive one.
   `RUBRIC_MIRROR_FILES` already listed `skills/ba-review-plan/SKILL.md`. The check asserted
   `RUBRIC_VALUE_SET_LITERAL` with a zero-occurrence test:

   ```js
   if (occurrences.length === 0) {
     records.push(makeRecord('rubric-mirror', file, null, 'FAIL', message));
     continue;
   }
   ```

   The file carries the literal several times — once in its owning grammar section, once inline per
   template. A per-file existence test is satisfied by **whichever copy is still right**.

**Why the twin got fixed and the sibling did not.** Slice 1 fixed `ba-review` because that is where
the evidence surfaced — a reviewer emitted `confidence: 60`. `ba-review-plan` had no equivalent
observable, so the same reasoning that produced a fix in one file produced only a note in the other.
The generalizable rule: **fix the class across every dispatch surface in the same pass, because the
surface without an observable is the one that stays broken.**

## Root Cause

**The assertion's granularity did not match the unit that reaches a reader.**

A dispatch template is not a fragment of a document — it *becomes* the entire context of a fresh
subagent. The unit that matters is therefore the `Task` block, not the file. A check written at file
granularity over a literal that legitimately appears N times cannot distinguish "every template has
it" from "one template has it and two do not."

The tell that a check is at the wrong granularity: **it names the right literal in the right files
and still cannot see the defect.**

## Solution

The CI change landed **before** the prompt fix, so the fix was verified by a check capable of
failing on it rather than grandfathered past a loose one.

### Enumerate blocks, bound them on both delimiters

`scripts/check-invariants.mjs`. A block runs from its `- Task ` line to the line before the next
`- Task ` **or** the next `##` heading, whichever comes first:

```js
const taskBlocks = (lines) => {
  const starts = [];
  lines.forEach((line, i) => {
    if (RUBRIC_TASK_BLOCK_ANCHOR.test(line)) starts.push(i);
  });
  return starts.map((start, n) => {
    let end = n + 1 < starts.length ? starts[n + 1] : lines.length;
    for (let j = start + 1; j < end; j += 1) {
      if (lines[j].startsWith('##')) { end = j; break; }
    }
    return { line: start + 1, body: lines.slice(start, end) };
  });
};
```

The `##` bound is load-bearing. With next-sibling alone, the last block in a section swallows the
rest of the file and passes on a literal belonging to a later section.

### Four properties worth copying into any mirror check

- **Loose locator, byte-exact assertion.** `RUBRIC_VALUE_SET_ANY_SPELLING` exists only to *find* a
  candidate so a FAIL can name `file:line`; the verdict comes from `.includes(LITERAL)`. One regex
  doing both jobs either misses the drift or cannot report where it is.
- **Per-occurrence *and* per-block — neither subsumes the other.** The occurrence loop catches a
  *drifted* copy anywhere in the file; the block loop catches a copy *missing from a block*.
- **Missing vs drifted stay distinct verdicts.** The block loop reports only *missing*, because a
  drifted copy still matches the loose locator and the occurrence loop already failed it at the
  offending line. Double-reporting dilutes the first message.
- **Zero subjects is UNKNOWN, never PASS.** A mirror file whose templates were all deleted must not
  report identically to one whose every template is correct.

### Add coverage, do not swap it

The pre-existing file-level branch was **kept**. The seven `agents/*-reviewer.md` files carry no
`Task` blocks, so replacing it would have silently dropped their coverage — the same class of
mistake as the original bug, one level up.

### A/B every fixture against the pre-fix implementation

Four fixtures were added (suite 52 → 56). Each was run against `git show <pre-fix>:scripts/check-invariants.mjs`
copied next to the new selfcheck: **4 of 56 fail on the old checker, 56 of 56 pass on the new one.**
A fixture that passes on both versions pins nothing.

## Prevention

1. **Match assertion granularity to the unit that reaches a reader.** If the meaningful unit is a
   block, enumerate blocks. A per-file existence test over a repeated literal is satisfied by any
   surviving copy.

2. **Apply the fallback test before deciding what to inline.** Ask what the receiving context
   already contains:

   | Template kind | Receiver's fallback | Inline requirement |
   |---|---|---|
   | `Task <dev-workflow:*-reviewer>` | the agent definition in `agents/` | inline what the agent file lacks |
   | `Task general-purpose("Use the \`[skill]\` skill…")` | the named skill's body — not ours | inline the full contract |
   | `Task general-purpose("You are a reviewer specializing in…")` | nothing at all | inline the full contract |

   **"The agent definition supplies it" is a claim about a specific file — grep before relying on
   it.** See *Known open gap* below for what happens when you don't.

3. **Dry-run against a routing input, not just a fresh session.** A running session executes the
   skill body it loaded at start, so validation needs `claude --plugin-dir <repo>` in a fresh
   session. The part that is easy to miss: **built-in reviewers only exercise the agent-based
   template.** Accepting the default selection never reaches either `general-purpose` template — the
   naive dry-run that looks like a pass. Reach them via **Adjust**: a name in the skills list routes
   to the skill-based template; a name matching nothing routes to the custom-dimension template.
   (Careful — `code-reviewer` and `dragon-test-reviewer` are registered agent types here and route
   to the *agent-based* template instead, reproducing the wrong-path illusion one level down.)

4. **Instrument the probe, don't eyeball it.** `ba-review-plan` already emits `Snapped` / `Dropped` /
   `Defaults applied` counters. A dispatch that reached its subagent without the grammar shows up as
   nonzero on a well-formed plan. State the success criterion up front — `Snapped: 0, Dropped: 0` —
   rather than "the output looked fine." The parser's coercion counters *are* the signal; they were
   simply never read as one.

5. **A prose claim of mirroring is unpinned by default.** A sentence like "each template below also
   carries X inline" is an assertion *about the file*, and assertions about the file are either
   pinned by a check or verified by grep during review.

## Known open gap (verified 2026-08-09, not fixed here)

The per-block check pins exactly one contract: the confidence literal. The **protected-artifacts
guard** — the other half lost in the original incident — is pinned nowhere. Measured across all six
dispatch blocks:

| Block | literal | guard |
|---|---|---|
| `ba-review-plan:300` (agent-based) | ✓ | **✗** |
| `ba-review-plan:314`, `:342` | ✓ | ✓ |
| `ba-review:484`, `:502`, `:526` | ✓ | ✓ |

`grep -rl 'docs/brainstorms/' agents/` returns **zero files**, so the built-in reviewers have no
fallback for it either. Meanwhile `skills/ba-review-plan/SKILL.md` now asserts that *"each template
below also carries the bullet grammar and the protected-artifacts guard inline"* — a sentence added
by this same change, and false for one of three templates, on the skill where `CLAUDE.md` calls the
guard load-bearing because the reviewed plan lives under `docs/plans/`.

Three-legs status: **reachable, no observed impact.** The text permits the loss and the fallback is
absent, but no transcript shows a reviewer proposing a plan deletion. Treat it as the seed fixture
for generalizing the check to a contract table, not as an incident.

Open scope call, deliberately not decided here: whether that generalization stops at the guard or
extends to the other two items templates carry (native `## Must Address` vocabulary,
most-specific-key anchoring). Neither is a *parser* contract, so pinning them byte-exact may be
over-specification under the trust gradient.

## Related Documentation

- [`2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md`](2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md)
  — **the direct predecessor.** Diagnosed the class, fixed the twin file, and recorded this gap as a
  residual. This entry closes it.
- [`2026-07-31-global-instructions-replace-the-step-under-test.md`](2026-07-31-global-instructions-replace-the-step-under-test.md)
  — a dispatch step silently replaced in both arms of a dry run; source of the assert-the-mechanism-ran
  discipline that Prevention #4 applies.
- [`2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`](2026-07-28-fixture-ab-subagent-claude-md-inheritance.md)
  — the mirror-image context-boundary case: global CLAUDE.md *does* reach an isolated subagent while
  tool-mediated repo content does not.
- [`2026-08-02-path-heuristics-misread-prompt-repo-filenames.md`](2026-08-02-path-heuristics-misread-prompt-repo-filenames.md)
  — nearest prior art on covering a prompt-repo defect with `scripts/selfcheck-invariants.mjs`.
