---
name: ba:compound
description: "Document a recently solved problem to compound team knowledge. Use when a problem is solved -- auto-triggers on phrases like 'that worked', 'it's fixed', 'problem solved'."
argument-hint: "[optional: brief context about the fix]"
---

# Knowledge Compounding

Coordinate multiple subagents working in parallel to document a recently solved problem into `docs/solutions/` so the `learnings-researcher` agent can surface it in future brainstorm and plan sessions.

<context_hint> #$ARGUMENTS </context_hint>

## Auto-Invoke

<auto_invoke>
<trigger_phrases>
- "that worked"
- "it's fixed"
- "working now"
- "problem solved"
- "fixed it"
- "got it working"
</trigger_phrases>
</auto_invoke>

## Step 0: Pre-flight Check

Check conversation context first, then gate on trigger type:

1. Scan conversation for a problem/solution pair (at minimum: a problem statement
   and a resolution/fix). Use the context hint from arguments if provided.
2. If insufficient context: ask the user to provide more detail or a context hint.
   Do not proceed until a problem/solution pair is identifiable.
3. If auto-triggered: present a confirmation using AskUserQuestion that proves
   sufficient context exists:
   "I detected a solved problem: [brief problem summary]. Want me to document it?"
   Options: Yes (proceed) / No (cancel)
   If No: stop, do not dispatch subagents.
4. If explicitly invoked via `/ba:compound`: proceed directly (context already verified).

## Step 1: Phase 1 — Parallel Research

<critical_requirement>
Only ONE file gets written — the final documentation.
Phase 1 subagents return TEXT DATA to the orchestrator. They must NOT use Write,
Edit, or create any files. Only the orchestrator (Phase 2) writes the final file.
</critical_requirement>

<parallel_tasks>
Launch these 5 subagents IN PARALLEL using explicit Task calls:

- Task general-purpose("You are a **Context Analyzer**. Extract conversation history context: problem type, component/module, symptom (error messages, observable behavior), what was tried first. Return a YAML frontmatter skeleton with fields: date, category, problem (one-line), tags, module, symptom. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Solution Extractor**. Analyze all investigation steps in the conversation. Identify the root cause, what didn't work and why, and the working fix. Return a solution content block with code snippets formatted as markdown. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Related-Docs Finder**. Scan `docs/solutions/` for existing entries that overlap with this problem. Use Glob: `docs/solutions/**/*.md`. If the directory doesn't exist or is empty, return 'No existing docs found'. Return a list of related file paths with one-line descriptions. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Prevention Strategist**. Develop strategies to prevent this class of problem in the future. Consider: code patterns, testing, linting, documentation. Return a prevention/best-practices content block. Return TEXT ONLY — do not write any files.")

- Task general-purpose("You are a **Category Classifier**. Determine the optimal `docs/solutions/` category and filename. Category: kebab-case slug (e.g., auth, database, testing, performance, tooling, build-errors, runtime-errors, integration-issues). Filename: YYYY-MM-DD-[3-8 word kebab-case slug].md. Check if file already exists at target path; if so, append -2, -3, etc. Return the final category and filename. Return TEXT ONLY — do not write any files.")

</parallel_tasks>

## Step 2: Subagent Failure Check

**WAIT for all Phase 1 subagents to complete.**

Required subagents (abort if any fail or return empty required fields):
- Context Analyzer — must return non-empty `category`, `problem`, `module`
- Solution Extractor — must return non-empty solution content
- Category Classifier — must return non-empty category slug and filename

Optional subagents (degrade gracefully if fail):
- Related-Docs Finder → omit "Related Documentation" section
- Prevention Strategist → omit "Prevention" section

If a required subagent fails or returns empty required fields, treat it as a failure: report it and ask the user for more context. Show any partial results collected so far.

## Step 3: Phase 2 — Assembly & Write

<sequential_tasks>

1. Collect all text results from Phase 1 subagents
2. Assemble complete markdown file using this template:

```
---
date: YYYY-MM-DD
category: [category-slug]
problem: [one-line problem description]
tags: [tag1, tag2, tag3]
module: [component/module name]
symptom: [brief symptom description]
---

# [Problem Title]

## Problem

[Symptom description, observable behavior, error messages]

## Investigation

[What was tried, what didn't work and why]

## Root Cause

[Technical explanation of the root cause]

## Solution

[Step-by-step fix with code examples]

## Prevention

[Strategies to avoid in future — omit this section if Prevention Strategist failed]

## Related Documentation

[Links to overlapping docs/solutions/ entries — omit this section if Related-Docs Finder failed or found nothing]
```

3. Validate:
   - YAML frontmatter is well-formed
   - Category slug is kebab-case, no special characters
   - Filename matches YYYY-MM-DD-[slug].md pattern
4. Create directory: `mkdir -p docs/solutions/[category]/`
5. Write the single file: `docs/solutions/[category]/[filename].md`

</sequential_tasks>

## Step 4: Present Summary

Display results in this format:

```
Documentation complete

Subagent Results:
  ✓ Context Analyzer: [what it identified]
  ✓ Solution Extractor: [summary]
  ✓ Related-Docs Finder: [N related docs / none found]
  ✓ Prevention Strategist: [summary]
  ✓ Category Classifier: [category/filename]

File created:
  docs/solutions/[category]/[filename].md

[Brief content summary]
```

Then use AskUserQuestion with options: Continue working / View documentation / Other.

## Important Guidelines

- Only the orchestrator writes files — subagents return text data only
- Do not run a convention-checker gate — docs/solutions/ entries are knowledge artifacts
- Auto-trigger only fires during freeform conversation — suppress during active /ba: command flows
- CAUTION: Review extracted code snippets for secrets, API keys, tokens, or PII before writing
- If file write fails, show the assembled content to the user so it is not lost
- Follow YAML list format for tags: `tags: [tag1, tag2, tag3]`
- Category slugs must be kebab-case (lowercase, hyphens, no special characters)

NEVER CODE! Just document the solved problem.
