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

**Check for these categories of reviewers (not an exhaustive list — discover what's available):**

| Category | What to look for | What it reviews in the plan |
|---|---|---|
| **Copy/content audit** | Skills or agents with "copy", "content", "writing", "norma" in name/description | UI labels, error messages, user-facing text proposed in the plan |
| **Code review** | Agents with "code-review", "reviewer" in name/description | Architecture decisions, approach quality, code examples in the plan |
| **Complexity assessment** | Skills with "complexity", "assess", "simplicity" in name/description | Whether the proposed approach is unnecessarily complex; whether non-obvious code or motivations are properly documented (Ousterhout) |
| **Test strategy review** | Agents or skills with "test" in name/description | Test proposals, coverage gaps, testing approach |
| **Security review** | Agents with "security", "sentinel" in name/description | Security implications of the proposed changes |

**Discovery method:**
- Check the available skills listed in the system context
- Check for agents in `~/.claude/agents/` and project `.claude/agents/`
- Note which ones are relevant to reviewing a *plan* (not all are — a linter isn't useful on a markdown plan)

**Important:** Not all discovered tools are appropriate for plan review. A plan contains *proposed* code and *strategy*, not finished implementation. Filter for reviewers that can meaningfully evaluate proposals, approaches, and design — skip tools that only work on actual source code (e.g., linters, formatters, type checkers).

---

## Step 2: Present Available Reviewers

Use **AskUserQuestion** with `multiSelect: true`:

**Question:** "I found these reviewers available in your environment. Which ones should I run against the plan?"

List each discovered reviewer as an option with:
- **Label**: The reviewer name
- **Description**: What it will check in the plan

Include all relevant reviewers found. The user picks which to run.

---

## Step 3: Run Selected Reviewers

Run the selected reviewers **in parallel** where possible. For each:

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

If applying fixes, edit the plan file directly, then confirm: "Plan updated at `[path]`."

---

## Important Guidelines

- **This reviews the plan, not code.** Don't dispatch tools that need actual source files to run.
- **Discovery is best-effort.** Different environments have different tools. That's fine — run what's available.
- **Reviewer not found is not an error.** If no copy auditor exists, skip that category. Report what was and wasn't covered.
- **Parallel execution.** Run independent reviewers concurrently to save time.
- **Plan-appropriate framing.** Always tell reviewers they're looking at a plan, not finished code.
