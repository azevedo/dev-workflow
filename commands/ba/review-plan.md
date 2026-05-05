---
name: ba:review-plan
description: Review a plan with available agents and skills before implementation
argument-hint: "[path to plan file, or leave empty to auto-detect latest]"
---

# Review a Plan Before Implementation

Run discovery-based reviews against a plan document using whatever review agents and skills are available in the current environment. This catches issues at plan time — where leverage is highest — instead of after implementation.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

### Locate the Plan

**If a path was provided above**, read it directly.

**If no path was provided**, auto-detect the most recent plan:

```bash
ls -t docs/plans/*.md 2>/dev/null | head -1
```

If found, announce: "Found latest plan: `[filename]`. Reviewing this one."
If not found, ask the user: "No plans found in `docs/plans/`. Which file should I review?"

Read the plan file thoroughly before proceeding.

---

## Step 1: Discover Available Reviewers

Search for review agents and skills available in the current environment. Look for anything that can review a plan's proposals.

### 1a. Built-in reviewers

Always include these seven built-in reviewers — they live in `agents/review/` and are always available:

| Agent | Focus |
|---|---|
| `architecture-reviewer` | Architectural consistency, coupling, separation of concerns |
| `security-reviewer` | Security implications of proposed changes |
| `simplification-reviewer` | Over-engineering, unnecessary abstraction, YAGNI |
| `error-handling-reviewer` | Edge cases, error paths, graceful failures |
| `test-coverage-reviewer` | Test proposals, coverage gaps, testing approach |
| `deep-module-reviewer` | Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |

**All seven MUST appear as options in Step 2. Do not filter or omit any.**

### 1b. External reviewers

Search for additional review agents and skills available in the current environment. Look for anything that can review a plan's proposals.

**Check for these categories of reviewers (not an exhaustive list — discover what's available):**

| Category | What to look for | What it reviews in the plan |
|---|---|---|
| **Copy/content audit** | Skills or agents with "copy", "content", "writing", "norma" in name/description | UI labels, error messages, user-facing text proposed in the plan |
| **Code review** | Agents with "code-review", "reviewer" in name/description | Architecture decisions, approach quality, code examples in the plan |
| **Complexity assessment** | Skills with "complexity", "assess", "simplicity" in name/description | Whether the proposed approach is unnecessarily complex; whether non-obvious code or motivations are properly documented (Ousterhout) |
| **Test strategy review** | Agents or skills with "test" in name/description | Test proposals, coverage gaps, testing approach |
| **Security review** | Agents with "security", "sentinel" in name/description | Security implications of the proposed changes |

**Discovery method — this step is mandatory, do not skip it. Run all Glob calls in parallel:**

```
Glob("**/*.md", path="~/.claude/agents/")
Glob("**/*.md", path="~/.claude/skills/")
Glob("**/*.md", path="~/.claude/commands/")
Glob("**/*.md", path=".claude/agents/")
Glob("**/*.md", path=".claude/commands/")
Glob("**/*.md", path=".agents/")
Glob("**/*.md", path=".agents/agents/")
Glob("**/*.md", path=".agents/skills/")
Glob("**/*.md", path=".agents/commands/")
```

Read each discovered file's frontmatter (first 15 lines). The frontmatter is the authoritative source — it may be richer than the system-reminder summary. Include if `name`, `description`, or any frontmatter field contains: "review", "code-review", "reviewer", "quality", "lint", "audit", "assess", "guidelines", "compliance", "copy", "content", "writing", "security", "complexity", "test", "pattern", "architecture", "composition".

Also scan the system-reminder skills list as a fallback for skills not stored as files. Apply the same keyword matching.

Skills and commands are valid reviewers regardless of which directory they live in.

**Present ALL discovered reviewers to the user — let the user decide which to run.** Code reviewers (like `architecture-reviewer`, `security-reviewer`) are meaningful for plans too: they can evaluate architectural decisions and security implications of the proposed approach. Only exclude tools that truly cannot operate on text (e.g., linters, formatters, type checkers that require actual compilable source files).

Show all discovered external reviewers alongside built-ins. If an external overlaps with a built-in, note the overlap — never hide or remove a built-in.

---

## Step 2: Present Available Reviewers

Use **AskUserQuestion** with `multiSelect: true` to present reviewers. Each reviewer gets its own individual option — never bundle multiple reviewers into a single option.

**AskUserQuestion limits:** 1-4 questions per call, 2-4 options per question. Distribute reviewers across multiple questions within a single call to stay within these limits.

**Distribution rules:**

1. Collect all reviewers into an ordered list: 7 built-ins first, then discovered externals (with overlap notes if applicable).
2. Partition into groups of 2-4. Prefer groups of 3-4 to minimize questions. Never leave 1 reviewer alone — merge it into the adjacent group (keeping that group at ≤4).
3. Use short `header` values (max 12 chars), e.g.: `"Analysis"`, `"Quality"`, `"External"`.
4. If total reviewers exceed 16 (4 × 4), present the first 16 and list any remaining in a follow-up text message.

**Typical distributions:**

| Scenario | Questions |
|---|---|
| 7 built-in, 0 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") |
| 7 built-in, 1 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") |
| 7 built-in, 2-4 external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity (header "Quality") · Q3: 2-4 externals (header "External") |
| 7 built-in, 5+ external | Q1: Architecture, Security, Simplification, Deep-module (header "Analysis") · Q2: Error handling, Test coverage, Complexity, external-1 (header "Quality") · Q3-Q4: remaining externals partitioned to never leave 1 alone (header "External") |

**Question text:** First question: `"Which reviewers should I run against the plan? (select all that apply)"`. Subsequent questions: `"Additional reviewers:"`.

**Option format:**
- Built-in: label = `"Architecture reviewer"`, description = `"Architectural consistency, coupling, separation of concerns"`
- External: label = `"code-reviewer (agent)"`, description = `"S-I-D naming, functional patterns (overlaps with Architecture reviewer)"`

If no external reviewers were found after running the Globs, say so explicitly after presenting built-ins: "No external reviewers found in ~/.claude/agents/, .claude/agents/, ~/.claude/skills/, ~/.claude/commands/, .claude/commands/."

---

## Step 3: Run Selected Reviewers

Run the selected reviewers **in parallel** where possible. Every reviewer runs in its own isolated subagent context via the Agent tool — regardless of whether it is an agent or a skill.

For **skill-based reviewers**, instruct the subagent to invoke the skill (e.g., "Use the `[skill-name]` skill to review this plan.") and pass the plan content as context.

For each:

1. Provide the plan content as context
2. Frame the review appropriately: "This is a *plan*, not finished code. Review the proposed approach, not implementation details that don't exist yet."
3. For each reviewer, include guidance on what to focus on:
   - **Copy/content**: "Review all user-facing text proposed in this plan — labels, messages, placeholders, error text. Flag inconsistencies, unclear wording, or missing i18n considerations."
   - **Code review**: "Review the architectural approach, design decisions, and code examples. Focus on: is the approach sound? Are there simpler alternatives? Does it follow codebase patterns?"
   - **Complexity**: "Assess whether the proposed approach is unnecessarily complex. Check if non-obvious design choices are documented with clear rationale. Flag anything where a future reader would ask 'why was it done this way?'"
   - **Test strategy**: "Review the testing approach. Are the right scenarios covered? Are edge cases from the spec-flow analysis reflected in test proposals? Is the test granularity appropriate?"
   - **Security**: "Review for security implications in the proposed changes."

---

## Step 4: Consolidate & Present Findings

After all reviewers complete, present a consolidated summary:

```markdown
## Plan Review Summary

### [Reviewer Name]
**Findings:** [N issues]

#### Must Address (before implementation)
- [Finding]: [Why it matters] — [Suggested fix]

#### Consider (improve but not blocking)
- [Finding]: [Why it matters]

#### Looks Good
- [What was validated]

---

### [Next Reviewer...]
```

**Prioritize findings:**
- **Must Address**: Would cause rework if not fixed now (wrong copy, missing test scenario, complexity that signals wrong approach)
- **Consider**: Improvements that are cheaper to make now but not blocking
- **Looks Good**: Confirmation that aspects of the plan are solid

---

## Step 5: Apply Fixes

Use **AskUserQuestion**:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Apply all fixes** — Update the plan with all Must Address + Consider items
2. **Apply must-address only** — Fix only the blocking items
3. **Review one by one** — Go through each finding and decide
4. **Done** — Acknowledge findings, don't modify the plan

### Handling "Consider" items

Before writing any "Consider" fix into the plan, classify it:

**Implementation decision** — something the implementer can resolve with full context during execution (e.g., which utility to use, how to structure a helper). Write it into the plan as concrete guidance: a decision already made, not a question left open.

**Spec decision** — something that affects acceptance criteria, user-facing behaviour, scope, or requires stakeholder input (e.g., "should this error be dismissible?", "do we support X edge case?"). These must be resolved **before execution begins**.

For spec decisions, the valid resolutions are:
1. **Decide now** — answer the question, update the plan with the decision
2. **Iterate the plan** — flag it as a blocker, return to brainstorm/planning before executing

**Never write a spec decision into the plan as an open question.** An open question in a plan is a spec gap that will be silently decided during implementation, outside any review or planning process. If the answer is unknown, the plan is not ready to execute.

If applying fixes, edit the plan file directly, then confirm: "Plan updated at `[path]`."

---

## Step 5.5: Plan-Iteration Discipline Check

After Step 5 completes (regardless of whether fixes were applied), run the plan-iteration discipline gate. This step is unconditional — every `/ba:review-plan` invocation is one round, even when the user picked "Done" and no fixes were applied.

### 5.5a. Increment iteration count

Read the plan's YAML frontmatter. If `iteration_count:` is present and a non-negative integer, increment it by 1. If it is absent, malformed, or negative, treat it as 0 and write `iteration_count: 1`. Use a targeted Edit-tool call on the frontmatter field — do not rewrite unrelated fields.

After the Edit, the plan's `iteration_count` reflects the round being evaluated by the gate.

### 5.5b. Compute plan-body LoC

Plan body LoC excludes the YAML frontmatter span (the lines from the opening `---` through the closing `---` inclusive). Blank lines, code fences, and any `## Slices` table are counted.

You already have the start-of-session snapshot in memory (captured when `/ba:review-plan` was invoked, before any fix was written). Read the current plan file post-fix and compute current LoC against the same rule.

### 5.5c. Dispatch the gate

Dispatch `plan-iteration-gate` once, passing the four labeled inputs:

- Task plan-iteration-gate("Validate this plan-iteration round.

Plan path: [absolute path]

Iteration count: [N from 5.5a]

Snapshot LoC (start of session): [from 5.5b]
Current LoC (after fixes): [from 5.5b]

Plan content snapshot (start of session):
[snapshot body — frontmatter excluded]

Current plan content (after fixes):
[current body — frontmatter excluded]

Review findings (this round):
- Must Address: [list from Step 4, or 'none']
- Consider: [list from Step 4, or 'none']
- Looks Good: [list from Step 4, or 'none']

Apply the six-trigger checklist and the iteration-count reminder rule. Return only violations.")

### 5.5d. Surface the gate output

**If the gate returned `No discipline violations detected.`** (the exact literal string and iteration count < 3): print the line verbatim under a `## Plan-iteration discipline check` heading. Exit Step 5.5.

**If the gate returned a markdown report** (one or more violations, or iteration ≥ 3 with the reminder line): print the report verbatim. Do not present the findings via `AskUserQuestion`. Do not offer fix application. The gate is advisory; the user reads the report and decides what to do next outside this command.

**If the gate dispatch errored or timed out**: print a one-line note `Plan-iteration gate failed (non-blocking): [error]` and continue. The iteration-count increment from 5.5a is **not** rolled back — the round happened regardless of gate availability.

After Step 5.5 completes, `/ba:review-plan` exits.

---

## Important Guidelines

- **This reviews the plan, not code.** Don't dispatch tools that need actual source files to run.
- **Discovery is best-effort.** Different environments have different tools. That's fine — run what's available.
- **Reviewer not found is not an error.** If no copy auditor exists, skip that category. Report what was and wasn't covered.
- **Parallel execution.** Run independent reviewers concurrently to save time.
- **Plan-appropriate framing.** Always tell reviewers they're looking at a plan, not finished code.
