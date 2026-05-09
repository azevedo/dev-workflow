---
name: ba:brainstorm
description: Explore requirements and approaches through collaborative dialogue before planning implementation
argument-hint: "[feature idea or problem to explore]"
---

# Brainstorm a Feature or Improvement

Brainstorming answers **WHAT** to build through collaborative dialogue. It precedes `/ba:plan`, which answers **HOW** to build it.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty**, ask the user: "What would you like to explore? Describe the feature, problem, or improvement you're thinking about."

Do not proceed until you have a feature description from the user.

---

## Phase 0: Triage

Evaluate the request and classify into one of three levels. Follow this decision flowchart:

```
Q1: Is the expected behavior specific and testable?
    NO  → FULL
    YES → Q2

Q2: Is there only one reasonable approach?
    NO  → STANDARD (or FULL if >3 approaches or architectural decisions needed)
    YES → Q3

Q3: Does it follow an existing codebase pattern?
    NO  → STANDARD
    YES → Q4

Q4: Does it touch ≤ 3 files with no architectural impact?
    NO  → STANDARD
    YES → Q5

Q5: Any security, payments, external API, or privacy implications?
    YES → FULL (always)
    NO  → FAST-TRACK
```

**Announce the triage level to the user:**
- FAST-TRACK: "This looks straightforward — I'll do a quick confirmation and we can move to planning."
- STANDARD: "This needs some focused exploration. I'll research the codebase and ask a few questions."
- FULL: "This warrants thorough exploration. Let me research deeply and we'll work through the design together."

### Escalation Rules

At any point during brainstorming, escalate if:
- **FAST-TRACK → STANDARD**: User adds nuance, corrects an assumption, or says "actually..."
- **STANDARD → FULL**: Open questions multiply, user reveals hidden complexity, or multiple concerns emerge
- **Any level → FULL**: Security, payments, external API, or data privacy is involved

### De-escalation Rules

- **User says "just do it"**: Capture current understanding, confirm once, proceed to `/ba:plan`
- **User provides detailed spec mid-conversation**: Downshift level, but still confirm understanding

---

## FAST-TRACK Path

When triage result is FAST-TRACK:

1. Run a brief codebase check to confirm the pattern exists and assumptions hold:
   - Task repo-researcher("Quick check: confirm existing patterns for: <feature_description>")

2. State your understanding in 2-3 sentences.

3. Use **AskUserQuestion** to confirm: "I understand [X], using the [Y] pattern. Sound right?"
   - If confirmed → write the FAST-TRACK artifact, then **auto-chain to `/ba:plan`** (see below)
   - If user adds nuance → **escalate to STANDARD**

### FAST-TRACK Artifact

Even for FAST-TRACK, write a minimal brainstorm doc so the plan command can find it. This preserves context across commands.

```bash
mkdir -p docs/brainstorms/
```

Write to `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`:

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
status: approved
triage_level: fast-track
tags: [component-names]
---

# <Topic Title>

## What We're Building
[The 2-3 sentence understanding you confirmed with the user]

## Key Decisions
- [Any decisions from the confirmation, e.g., "Follow existing pattern X"]

## Acceptance Criteria
- [Testable criteria extracted from the feature description]
```

### FAST-TRACK Auto-Chain

After writing the artifact, **immediately invoke `/ba:plan`** with the feature description. Do NOT ask the user to run it manually — the whole point of FAST-TRACK is speed.

Announce: "Brainstorm captured. Proceeding to plan."

---

## STANDARD / FULL Path

### Phase 1: Understand Context

#### 1.1 Research (run in parallel)

- Task repo-researcher("Understand existing patterns and conventions related to: <feature_description>")
- Task learnings-researcher("Search for learnings related to: <feature_description>")

Wait for both agents to return before proceeding.

**Also check for recent research docs:**

```bash
ls -t docs/research/*.md 2>/dev/null | head -5
```

If research docs exist within 14 days and their frontmatter tags match the feature topic, read the **Summary** section from the most relevant doc(s) and incorporate as supplementary context alongside agent findings. This supplements — does not replace — the repo-researcher and learnings-researcher agents.

#### 1.2 Collaborative Dialogue

Use the **AskUserQuestion tool** to ask questions **one at a time**.

**Guidelines:**
- Prefer multiple choice when natural options exist
- Start broad (purpose, users, success criteria) then narrow (constraints, edge cases)
- Validate assumptions explicitly — state what you assume, ask if it's correct
- Incorporate research findings: "I found [pattern X] in the codebase. Should we follow that approach?"

**STANDARD**: Ask 2-4 focused clarifying questions.

**FULL**: Extended dialogue covering:
- Purpose and motivation
- Target users and their context
- Success criteria and how to measure them
- Constraints (technical, timeline, compatibility)
- Edge cases and failure scenarios
- Trade-offs the user is willing to make

**Exit condition:** Continue until the idea is clear OR user says "proceed."

### Phase 2: Explore Approaches

Phase 2 has two modes. The trigger below decides which fires; **do not announce the evaluation either way**.

#### Trigger: design-it-twice mode

Fire design-it-twice mode (parallel constraint-anchored dispatch) when ANY of the following is true:

- a new file / directory / module is being proposed,
- a new exported function / class / component is being proposed,
- a new public interface or API surface is being proposed,
- a new agent / command / skill is being proposed,
- a new public type that callers depend on is being proposed.

Do **not** fire for: modifications to existing modules, bug fixes, parameter additions, internals, or refactors that preserve external shape.

Mixed-scope brainstorms (new module + refactor in one brainstorm): fire if any portion proposes a new boundary; the dispatched sub-agents are scoped to the new portion only.

Tie-breaker on ambiguity: prefer firing. The cost of an unnecessary parallel dispatch is one round of LLM time; the cost of skipping a needed one is calcified design.

When the trigger does **not** fire, run the default mode below silently. No announcement. Single-shot per brainstorm session: if `## Locked Design` already exists in the brainstorm doc at this path, do not re-dispatch — proceed to default mode and note the prior dispatch in Phase 3 capture.

#### Design-it-twice mode (trigger fired)

Dispatch three `interface-design-generator` agents in parallel, one per constraint:

- Task interface-design-generator("Constraint: deepest-module. Brainstorm context: <3-8 sentence summary of what's being designed, including proposed module purpose, where it lives, dependencies, and constraints established in Phase 1.2 dialogue>.")
- Task interface-design-generator("Constraint: common-case. Brainstorm context: <same summary as above>.")
- Task interface-design-generator("Constraint: info-hiding. Brainstorm context: <same summary as above>.")

Wait for all three to return.

**Failure handling.** If any dispatch errors, returns empty, or returns output missing one or more of the five contract sections (`### Interface`, `### Usage example`, `### What's hidden behind the seam`, `### Dependency strategy`, `### Trade-offs`), **fall back to default mode above** for the entire pick step. Note the fallback in Phase 3 capture as: `Design-it-twice dispatch attempted; fell back to default Phase 2 enumeration because [reason].`

**Present.** Show each design sequentially with its full 5-part output (Design A — Deepest module, Design B — Common case, Design C — Info hiding). After the third presentation, contrast in prose on **depth** (leverage at the interface), **locality** (where change concentrates), **seam placement**, and **who pays the trade-offs**. **Lead with a recommendation** — a strong read, not a menu.

**Pick.** Use **AskUserQuestion** with exactly four options:
1. **Design A — Deepest module** — [one-line summary of A's interface]
2. **Design B — Common case** — [one-line summary of B's interface]
3. **Design C — Info hiding** — [one-line summary of C's interface]
4. **Hybrid** — combine elements across designs

If the user picks **Hybrid**, follow up with a second **AskUserQuestion** asking the user to describe the hybrid in one or two sentences (e.g., *"A's interface but B's error model"*). Capture the user's wording verbatim — it becomes the `**Source:**` line of `## Locked Design` in Phase 3 capture.

If the user explicitly rejects all four options, surface the misfire and offer: (a) accept one of A/B/C as a refinement starting point in plan, or (b) end this brainstorm and start a fresh one. **Do not re-dispatch within this brainstorm session** — single-shot is binding.

#### Default mode (trigger did not fire — fallback)

Propose **2-3 concrete approaches** based on research and conversation.

For each approach, provide:
- Brief description (2-3 sentences)
- Pros and cons
- When it's best suited

**Lead with your recommendation and explain why.** Apply YAGNI — prefer the simpler solution unless complexity is justified.

Use **AskUserQuestion** to ask which approach the user prefers (or if they want to explore a different direction).

### Phase 3: Capture the Design

Write a brainstorm document to `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`.

Ensure `docs/brainstorms/` directory exists before writing.

**Document template:**

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
status: approved
triage_level: standard | full
tags: [feature, component-names]
---

# <Topic Title>

## What We're Building
[1-2 paragraphs: what this is and who it's for]

## Why This Approach
[Approaches considered, why this one was chosen, what was rejected and why]

## Key Decisions
- [Decision]: [Rationale]

## Scope Boundaries
[What we're NOT doing — explicit exclusions to prevent scope creep]

## Acceptance Criteria
- [Measurable criterion 1]
- [Measurable criterion 2]

## Open Questions
- [Must be empty before handoff to plan]

## Convention Compliance
[Appended by convention-checker — see Phase 3.5]

## Next Steps
→ `/ba:plan` to create implementation plan
```

**Scaling:**
- **STANDARD**: Brief — a few sentences per section. Skip sections that don't apply.
- **FULL**: Comprehensive — 200-300 words per section where warranted. All sections populated.

#### When design-it-twice mode fired in Phase 2

If Phase 2's trigger fired and the user picked a design (A / B / C / Hybrid), append the two sections below **after `## Key Decisions`** in the brainstorm doc. Do not write either section when the trigger did not fire — keep the default template clean.

```markdown
## Locked Design

**Source:** [Design A — Deepest module | Design B — Common case | Design C — Info hiding | Hybrid: <verbatim quote of the user's hybrid description>]

### Interface
[Entry points + signatures + invariants/ordering/error modes from the chosen design. For a hybrid, source the relevant sections from each design referenced in the user's hybrid description.]

### Usage example
[Most-common caller from the chosen design.]

### What's hidden behind the seam
[From the chosen design.]

### Dependency strategy
[From the chosen design.]

### Trade-offs
[From the chosen design — preserve verbatim. Trade-offs from rejected designs go in `## Rejected Designs` below.]

This design is **locked** at brainstorm capture per the standing synthesis-lock Discipline Rule (`docs/brainstorms/2026-05-02-ousterhout-principles-roadmap-brainstorm.md` `### Concrete rules`). Plan and execute may refine this design within the bounds of the lock; they may not re-add elements from the rejected designs below.

## Rejected Designs

### [Design A | Design B | Design C] — [Deepest module | Common case | Info hiding] (rejected)
- **Interface summary:** [1-2 sentences sourced from the unchosen design's `### Interface` section.]
- **Why rejected:** [1-2 sentences sourced from the contrast prose and the user's pick reasoning. For a hybrid, identify which elements *were* incorporated and which were not.]

### [next rejected design]
[same shape — repeat for each unchosen design]
```

If the dispatch fell back to default mode (per the failure-handling rule in Phase 2), do **not** write `## Locked Design` or `## Rejected Designs` — capture the chosen approach inside `## Key Decisions` as today, and add a one-line note: `Design-it-twice dispatch attempted; fell back to default Phase 2 enumeration because [reason].`

If the dispatch was skipped because `## Locked Design` already exists at this path, add a one-line note in `## Key Decisions`: `Design-it-twice dispatch skipped — ## Locked Design section already present from prior session.`

**HARD GATE:** Before proceeding to Phase 3.5, check the Open Questions section. If there are open questions, YOU MUST ask the user about each one using AskUserQuestion before continuing. Move resolved questions to a "Resolved Questions" subsection.

### Phase 3.5: Convention-Compliance Check

**MANDATORY.** Run before writing the final artifact to disk.

1. Dispatch the convention-checker agent with the draft brainstorm content:
   - Task convention-checker("Validate this brainstorm against project conventions: <draft content summary including approach, technology choices, architecture decisions>")

2. Review the agent's findings.

3. **For each VIOLATION found**, use **AskUserQuestion** to present it to the user:
   - "Convention X says Y, but the brainstorm proposes Z. How should we handle this?"
   - Options:
     1. **Update brainstorm to comply** — Modify the design to follow the convention
     2. **Add justification for override** — Keep the design, document why the convention doesn't apply
     3. **Flag as known debt** — Acknowledge the deviation, plan to address later

4. **MUST resolve all violations** before writing the artifact to disk.

5. Append the compliance summary to the brainstorm document's "Convention Compliance" section.

### Phase 4: Handoff

Use **AskUserQuestion** to present next steps:

**Question:** "Brainstorm captured! What would you like to do next?"

**Options:**
1. **Proceed to planning** — Run `/ba:plan` in this session (will auto-detect this brainstorm)
2. **Fresh-context planning** — Clear context and plan with only the brainstorm loaded (saves tokens)
3. **Review and refine** — Revisit and improve specific sections
4. **Ask more questions** — I'll probe deeper on edge cases and constraints
5. **Done for now** — Return later

**Based on selection:**
- **Proceed to planning** → Invoke `/ba:plan <feature_description>` directly in this session.
- **Fresh-context planning** → Tell the user the exact command to copy-paste after clearing:
  ```
  Run `/clear`, then paste this:
  /ba:plan — read docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md and plan that feature
  ```
  Use the **actual filename** of the brainstorm just written — not a placeholder.
- **Review and refine** → Ask which section to improve, make changes, return to Phase 4
- **Ask more questions** → Return to Phase 1.2 and continue dialogue, then return to Phase 4
- **Done for now** → Display summary and exit

## Output Summary

When complete, display:

```
Brainstorm complete!

Document: docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md
Triage level: [FAST-TRACK | STANDARD | FULL]

Key decisions:
- [Decision 1]
- [Decision 2]

Next: Run `/ba:plan` when ready to create the implementation plan.
```

## Important Guidelines

- **Stay focused on WHAT, not HOW** — implementation details belong in the plan
- **Ask one question at a time** — don't overwhelm the user
- **Apply YAGNI ruthlessly** — resist complexity, prefer simpler approaches
- **Keep outputs concise** — 200-300 words per section max, even for FULL
- **Document decisions with rationale** — not just WHAT was decided but WHY
- **Err toward more brainstorming, not less** — the cost of a 10-minute brainstorm is low; the cost of building the wrong thing is high

NEVER CODE! Just explore and document decisions.
