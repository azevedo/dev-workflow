---
name: ba:plan
description: Transform feature descriptions into well-structured implementation plans following project conventions
argument-hint: "[feature description, bug report, or improvement idea]"
---

# Create an Implementation Plan

Transform feature descriptions, bug reports, or improvement ideas into well-structured implementation plans that follow project conventions and best practices.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty**, ask the user: "What would you like to plan? Describe the feature, bug fix, or improvement you have in mind."

Do not proceed until you have a clear feature description from the user.

---

## Step 0: Detect Prior Work

**Check for brainstorm output first.**

Search for recent brainstorm documents that match this feature:

```bash
ls -la docs/brainstorms/*.md 2>/dev/null | head -10
```

**Relevance criteria:** A brainstorm is relevant if:
- The topic (from filename or YAML frontmatter) semantically matches the feature description
- Created within the last 14 days
- If multiple candidates match, use the most recent one

**If a relevant brainstorm exists:**
1. Read the brainstorm document thoroughly — every section matters
2. Announce: "Found brainstorm from [date]: [topic]. Using as foundation for planning."
3. Extract and carry forward ALL of the following into the plan:
   - Key decisions and their rationale
   - Chosen approach and why alternatives were rejected
   - Constraints and requirements discovered during brainstorming
   - Scope boundaries (What We're NOT Doing)
   - Open questions (flag for resolution during planning)
   - Acceptance criteria
   - Convention compliance findings
4. **Skip the idea refinement below** — the brainstorm already answered WHAT to build
5. **The brainstorm is the origin document.** Reference specific decisions with `(see brainstorm: docs/brainstorms/<filename>)` throughout the plan. Do not paraphrase decisions in a way that loses their original context.
6. Do not omit brainstorm content — if the brainstorm discussed it, the plan must address it.

**If multiple brainstorms could match:**
Use **AskUserQuestion** to ask which brainstorm to use, or whether to proceed without one.

**If no brainstorm found (or not relevant), run idea refinement:**

Refine the idea through collaborative dialogue using **AskUserQuestion**:
- Ask questions one at a time to understand the idea fully
- Prefer multiple choice when natural options exist
- Focus on: purpose, constraints, success criteria
- Continue until clear OR user says "proceed"

During refinement, gather signals for the research decision:
- **User familiarity**: Do they know codebase patterns? Are they pointing to examples?
- **Topic risk**: Security, payments, external APIs warrant more caution
- **Uncertainty level**: Is the approach clear or open-ended?

---

## Step 1: Local Research (Always Runs — Parallel)

Run these agents **in parallel** to gather local context:

- Task repo-researcher("Research existing patterns, conventions, and CLAUDE.md guidance related to: <feature_description>")
- Task learnings-researcher("Search for documented learnings related to: <feature_description>")

**What to extract:**
- Existing patterns the implementation should follow
- CLAUDE.md conventions (naming, file org, architecture, testing, dependencies)
- Documented learnings and gotchas from `docs/solutions/`
- Related file paths with `file:line` references

Wait for both agents before proceeding.

**Also check for recent research docs:**

```bash
ls -t docs/research/*.md 2>/dev/null | head -5
```

If research docs exist within 14 days and their frontmatter tags match the feature topic, read the **Summary** section from the most relevant doc(s) and incorporate as supplementary context alongside agent findings. This supplements — does not replace — the repo-researcher and learnings-researcher agents.

## Step 1.5: Research Decision

Based on signals from Step 0 and findings from Step 1, decide on external research.

**High-risk topics → always research externally.** Security, payments, external APIs, data privacy. The cost of missing something is too high.

**Strong local context → skip external research.** Codebase has good patterns, CLAUDE.md has guidance, user knows what they want.

**Uncertainty or unfamiliar territory → research.** User is exploring, codebase has no examples, new technology.

**Announce the decision briefly:**
- "Your codebase has solid patterns for this. Proceeding without external research."
- "This involves payment processing, so I'll research current best practices first."

## Step 1.5b: External Research (Conditional)

**Only run if Step 1.5 indicates external research is valuable.**

Use web search to find:
- Current best practices for the technology/pattern
- Framework documentation for the specific feature area
- Known pitfalls and security considerations

Synthesize findings — extract actionable guidance, not raw search results.

## Step 1.6: Consolidate Research

After all research completes, consolidate:

- Relevant file paths from repo research (with `file:line` references)
- Institutional learnings from `docs/solutions/` (key insights, gotchas to avoid)
- External best practices (if external research was done)
- CLAUDE.md conventions that apply to this plan
- Related issues or PRs discovered

**Optional validation:** Briefly summarize findings and ask if anything looks off or missing before proceeding.

---

## Step 2: Structure & Detail Level

### Title & Categorization

- Draft a clear, searchable title using conventional format: `feat: Add user authentication`, `fix: Cart total calculation`, `refactor: Extract payment service`
- Determine issue type: feat | fix | refactor
- Convert title to filename: `YYYY-MM-DD-<type>-<descriptive-name>-plan.md`
  - Example: `feat: Add User Authentication` → `2026-03-08-feat-add-user-authentication-plan.md`
  - Keep it descriptive (3-5 words after prefix)

### Choose Detail Level

Select based on complexity. Simpler is mostly better.

#### MINIMAL (Quick Plan)

**Best for:** Simple bugs, small improvements, clear features with ≤3 files.

Sections: Problem/feature description, acceptance criteria, context, MVP code.

#### STANDARD (Most Features)

**Best for:** Most features, moderate bugs, team collaboration. 4-10 files.

Sections: Everything in MINIMAL plus overview, proposed solution, technical considerations, system-wide impact, what we're NOT doing, success metrics, dependencies & risks.

#### COMPREHENSIVE (Major Features)

**Best for:** Major features, architectural changes, complex integrations. 10+ files.

Sections: Everything in STANDARD plus phased implementation with per-phase success criteria (automated + manual), alternatives considered, risk analysis, API surface parity, integration test scenarios, documentation plan.

---

## Step 3: SpecFlow Analysis

After structuring the plan, run the spec-flow analyzer to validate completeness:

- Task spec-flow-analyzer("Analyze this feature for user flow completeness, edge cases, and gaps: <feature_description + key decisions from brainstorm/research>")

**After receiving results:**
- Review identified gaps and edge cases
- Incorporate critical and important findings into acceptance criteria
- Add missing error handling or validation requirements to the plan
- Note any flow permutations that need addressing

---

## Step 4: Draft the Plan

Write the plan using the chosen detail level template.

### YAML Frontmatter (all levels)

```yaml
---
title: [Descriptive Title]
type: feat | fix | refactor
status: active
date: YYYY-MM-DD
origin: docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md  # if originated from brainstorm, otherwise omit
detail_level: minimal | standard | comprehensive
tags: [feature, component-names]
---
```

### MINIMAL Template

````markdown
# [Title]

[Brief problem/feature description]

## Acceptance Criteria

- [ ] Core requirement 1
- [ ] Core requirement 2

## What We're NOT Doing

[Explicit scope boundaries — prevents scope creep]

## Context

[Critical information: relevant files, patterns to follow]

## MVP

### [filename.ext]

```language
[Actual code — not descriptions of code]
```

## Sources

- Origin brainstorm: [path] (if applicable)
- Related: [file_path:line references]
````

### STANDARD Template

````markdown
# [Title] Implementation Plan

## Overview

[What and why, 2-3 sentences]

## Current State

[What exists, key discoveries with file:line references]

## What We're NOT Doing

[Explicit scope boundaries]

## Proposed Solution

[High-level approach and reasoning]

## Technical Considerations

- Architecture impacts
- Performance implications
- Security considerations

## System-Wide Impact

- **Interaction graph**: [What callbacks/middleware/observers fire?]
- **Error propagation**: [How do errors flow across layers?]
- **State lifecycle risks**: [Can partial failure leave inconsistent state?]

## Implementation Approach

### Changes Required

**File**: `exact/path/to/file.ext`
```language
[Actual code — not descriptions]
```

### Success Criteria

#### Automated:
- [ ] `command to run` — expected result

#### Manual:
- [ ] [Human verification step]

## Dependencies & Risks

[What could block or complicate this]

## Sources & References

- Origin brainstorm: [path] (if applicable)
- Similar implementations: [file_path:line]
- Documentation: [urls]
````

### COMPREHENSIVE Template

````markdown
# [Title] Implementation Plan

## Overview

[Executive summary: what, why, and high-level approach]

## Current State

[What exists, key discoveries with file:line references]

## What We're NOT Doing

[Explicit scope boundaries]

## Proposed Solution

[Comprehensive solution design]

## Technical Approach

### Architecture

[Detailed technical design]

### Alternative Approaches Considered

[Other solutions evaluated and why rejected]

## Implementation Phases

### Phase 1: [Foundation]

#### Changes Required
**File**: `exact/path/to/file.ext`
```language
[Actual code]
```

#### Success Criteria
##### Automated:
- [ ] `command to run` — expected result
##### Manual:
- [ ] [Human verification step]

> **Phase gate:** Automated verification must pass. Pause for manual verification before proceeding to Phase 2.

---

### Phase 2: [Core Implementation]

[Same structure as Phase 1]

---

### Phase N: [Polish & Integration]

[Same structure]

## System-Wide Impact

### Interaction Graph
[Map the chain reaction: what callbacks, middleware, observers, and event handlers fire?]

### Error & Failure Propagation
[Trace errors from lowest layer up. Identify retry conflicts and silent failures.]

### State Lifecycle Risks
[Walk through each step that persists state. Can partial failure orphan rows or leave caches stale?]

### API Surface Parity
[List all interfaces that expose equivalent functionality. Note which need updating.]

### Integration Test Scenarios
[3-5 cross-layer test scenarios that unit tests would never catch]

## Risk Analysis & Mitigation

[Comprehensive risk assessment with mitigation strategies]

## Testing Strategy

[Unit, integration, manual testing approach]

## Documentation Plan

[What docs need updating]

## Sources & References

### Origin
- Brainstorm: [path] — Key decisions carried forward: [list 2-3 major decisions]

### Internal References
- Architecture decisions: [file_path:line]
- Similar features: [file_path:line]

### External References
- Documentation: [urls]
- Best practices: [urls]
````

**Key rules for all templates:**
- Include **exact file paths** — never placeholders
- Include **actual code** — not descriptions of code
- Separate success criteria into **Automated** and **Manual**
- Phase gates in COMPREHENSIVE: automated passes first, then pause for manual verification
- Always include "What We're NOT Doing"

---

## Step 5: Convention-Compliance Check

**MANDATORY.** Run before writing the plan to disk.

1. Dispatch the convention-checker agent:
   - Task convention-checker("Validate this plan against project conventions: <summary of plan including file paths, naming, architecture decisions, test structure, new dependencies>")

2. Review the agent's findings.

3. **For each VIOLATION**, use **AskUserQuestion** to present it:
   - "Convention X says Y, but the plan does Z. How should we handle this?"
   - Options:
     1. **Update plan to comply** — Modify the plan to follow the convention
     2. **Add justification for override** — Keep the plan as-is, document why
     3. **Flag as known debt** — Acknowledge, plan to address later

4. **MUST resolve all violations** before writing the plan to disk.

5. Append compliance summary to the plan's end:
   ```markdown
   ## Convention Compliance
   - [x] [Convention A] — aligned
   - [x] [Convention B] — justified override: [reason]
   - [ ] [Convention C] — known debt: [reason, plan to address]
   ```

---

## Step 6: Brainstorm Cross-Check

**Only if plan originated from a brainstorm.**

Before finalizing, re-read the brainstorm document and verify:

- [ ] Every key decision from the brainstorm is reflected in the plan
- [ ] The chosen approach matches what was decided in the brainstorm
- [ ] Constraints and requirements are captured in acceptance criteria
- [ ] Open questions from the brainstorm are either resolved or flagged
- [ ] The `origin:` frontmatter field points to the brainstorm file
- [ ] The Sources section includes the brainstorm with carried-forward decisions
- [ ] Scope boundaries from the brainstorm are in "What We're NOT Doing"

If anything was dropped, add it back before writing.

---

## Step 7: Write & Present

**REQUIRED: Write the plan file to disk before presenting options.**

```bash
mkdir -p docs/plans/
```

Use the Write tool to save the plan to `docs/plans/YYYY-MM-DD-<type>-<descriptive-name>-plan.md`.

Confirm: "Plan written to `docs/plans/[filename]`"

Use **AskUserQuestion** to present next steps:

**Question:** "Plan ready at `docs/plans/[filename]`. What would you like to do next?"

**Options:**
1. **Start implementation** — Begin executing this plan in the current session
2. **Fresh-context implementation** — Clear context and implement with only the plan loaded (saves tokens)
3. **Review plan** — Run `/ba:review-plan` to review with available agents and skills (copy, complexity, tests, code review)
4. **Review and refine** — Manually improve specific sections of the plan
5. **Create issue** — Create issue in project tracker (GitHub/Linear)
6. **Done for now** — Return later

**Based on selection:**
- **Start implementation** → Begin implementing the plan directly in this session.
- **Fresh-context implementation** → Tell the user: "Run `/clear` then read the plan and implement it: `docs/plans/[filename]`". This gives a clean context window with only the plan, no brainstorm/research token overhead.
- **Review plan** → Invoke `/ba:review-plan docs/plans/[filename]` to discover and run available review agents/skills against the plan.
- **Review and refine** → Ask which section, make changes, return to options.
- **Create issue** → Detect tracker from CLAUDE.md and create:
  - GitHub: `gh issue create --title "<type>: <title>" --body-file <plan_path>`
  - Linear: `linear issue create --title "<title>" --description "$(cat <plan_path>)"`
  - No tracker: Ask user which they use, suggest adding to CLAUDE.md
- **Done for now** → Display summary and exit

## Output Summary

When complete, display:

```
Plan complete!

Document: docs/plans/YYYY-MM-DD-<type>-<name>-plan.md
Detail level: [MINIMAL | STANDARD | COMPREHENSIVE]
Origin: [brainstorm path or "standalone"]

Key sections:
- [What it covers]
- [Number of phases, if COMPREHENSIVE]

Convention compliance: [N aligned, N overrides, N debt items]
```

**IMPORTANT:** The plan is DONE. Do NOT suggest running `/ba:plan` again — it just ran. The only forward options are: implement, refine, create issue, or stop.

## Important Guidelines

- **Research before writing** — understand the codebase before proposing changes
- **Exact file paths and code** — never use placeholders
- **Separate automated and manual verification** — different audiences, different timing
- **"What We're NOT Doing" at every level** — prevents scope creep
- **Convention compliance is mandatory** — not optional, not skippable
- **Brainstorm decisions are binding** — carry them forward, don't silently drop them
- **Simpler plans are better** — choose MINIMAL unless complexity demands more

NEVER CODE! Just research and write the plan.
