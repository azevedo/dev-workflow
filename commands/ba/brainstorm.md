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
