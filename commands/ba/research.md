---
name: ba:research
description: "Conduct comprehensive codebase research with parallel sub-agents"
argument-hint: "[research question or area of interest]"
---

# Codebase Research

You are tasked with conducting comprehensive research across the codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings.

## Initial Setup

When this command is invoked, respond with:

> I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.

Then wait for the user's research query.

## Steps to follow after receiving the research query:

### Step 0: Detect Prior Research

Check for recent research documents that could be relevant:

```bash
ls -t docs/research/*.md 2>/dev/null | head -5
```

If recent docs found (within 14 days), check if any match the current topic by reading their YAML frontmatter (topic, tags).

If a relevant match is found, use **AskUserQuestion**:
- "Found recent research: `docs/research/[filename]` — [topic]. What would you like to do?"
- Options:
  1. **Append follow-up** — Add new findings to the existing document
  2. **Start fresh** — Create a new research document

If appending: read the existing doc fully, then skip to Step 9 flow (follow-up mode).
If starting fresh or no prior research found: continue to Step 1.

### Step 1: Read mentioned files first

- If the user mentions specific files, read them FULLY using the Read tool
- **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
- **CRITICAL**: Read these files yourself in the main context before spawning any sub-agents
- This ensures you have full context before decomposing the research

### Step 2: Analyze and decompose the research question

- Break down the user's query into composable research areas
- Consider underlying patterns, connections, and architectural implications
- Identify specific components, patterns, or concepts to investigate
- Create a research plan using TodoWrite to track all subtasks
- Consider which directories, files, or architectural patterns are relevant

### Step 3: Spawn parallel sub-agent tasks

Create multiple Task agents to research different aspects concurrently. Use specialized agents:

**For codebase research:**

- Use the **codebase-locator** agent to find WHERE files and components live
- Use the **codebase-analyzer** agent to understand HOW specific code works
- Use the **codebase-pattern-finder** agent to find examples of similar implementations

**For research docs:**

- Use the **research-locator** agent to discover what documents exist in `docs/research/`
- Use the **research-analyzer** agent to extract key insights from the most relevant documents

Dispatch guidance:

- Run ALL 5 agents in parallel — each has its own search tools and works independently
- Each agent knows its job — tell it what you're looking for, not how to search
- Don't write detailed prompts about HOW to search — the agents already know
- If an agent returns empty results, that's acceptable — note the gap in the synthesis

### Step 4: Wait for all sub-agents and synthesize

- **IMPORTANT**: Wait for ALL sub-agent tasks to complete before proceeding
- If any agent fails or times out, proceed with available results and clearly note what's missing
- Compile all results (codebase and research doc findings)
- Prioritize live codebase findings as primary source of truth
- Use research doc findings as supplementary historical context
- Connect findings across different components
- Include specific file paths and line numbers for reference
- Highlight patterns, connections, and architectural decisions
- Answer the user's specific questions with concrete evidence

### Step 5: Gather metadata

Run these commands to gather document metadata:

```bash
git log -1 --format="%H" && git branch --show-current && basename $(git rev-parse --show-toplevel)
```

Filename: `docs/research/YYYY-MM-DD-description-research.md`
- YYYY-MM-DD is today's date
- description is a 3-5 word kebab-case summary of the research topic
- If a file with the same name already exists, append `-2`, `-3`, etc.

### Step 6: Generate research document

```bash
mkdir -p docs/research/
```

Write the document with this structure:

```markdown
---
date: [Current date and time with timezone in ISO format]
researcher: Claude
git_commit: [Current commit hash]
branch: [Current branch name]
repository: [Repository name]
topic: "[User's Question/Topic]"
tags: [research, codebase, relevant-component-names]
status: complete
last_updated: [Current date in YYYY-MM-DD format]
---

# Research: [User's Question/Topic]

**Date**: [date]
**Git Commit**: [hash]
**Branch**: [branch]
**Repository**: [repo]

## Research Question

[Original user query]

## Summary

[High-level findings answering the user's question]

## Detailed Findings

### [Component/Area 1]

- Finding with reference (`file.ext:line`)
- Connection to other components
- Implementation details

### [Component/Area 2]

...

## Code References

- `path/to/file.ext:123` — Description of what's there
- `another/file.ts:45-67` — Description of the code block

## Architecture Insights

[Patterns, conventions, and design decisions discovered]

## Historical Context (from docs/research/)

[Relevant insights from previous research documents, if any]

- `docs/research/something-research.md` — Historical decision about X

## Related Research

[Links to other research documents in docs/research/]

## Open Questions

[Any areas that need further investigation]
```

Tags in YAML frontmatter: derive from key nouns in the research question plus component/module names discovered by agents.

### Step 7: Add GitLab permalinks (conditional)

Check if permalinks can be generated:

```bash
git remote get-url origin 2>/dev/null
git log -1 --format="%H"
```

- Parse the remote URL to extract the GitLab host, organization, and repository name
- If on main/master or commit is pushed: generate permalinks
- Create permalinks: `https://<gitlab-host>/<org>/<repo>/-/blob/<commit>/<file>#L<line>`
- Replace local file references with permalinks in the document
- If not a GitLab repo, unpushed, or no remote: skip silently, keep local file paths

### Step 8: Present findings

- Present a concise summary of findings to the user
- Include key file references for easy navigation
- Ask if they have follow-up questions or need clarification

### Step 9: Handle follow-up questions

- If the user has follow-up questions, append to the same research document
- Update frontmatter: `last_updated` date and add `last_updated_note: "Follow-up: [brief description]"`
- Add a new section: `## Follow-up: [Brief description] — [timestamp]`
- Spawn new sub-agents as needed for additional investigation
- Continue updating the document

## Important Notes

- Always use parallel Task agents to maximize efficiency and minimize context usage
- Always run fresh codebase research — never rely solely on existing research documents
- The docs/research/ directory provides historical context to supplement live findings
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only operations
- Consider cross-component connections and architectural patterns
- Keep the main agent focused on synthesis, not deep file reading
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read mentioned files first before spawning sub-tasks (Step 1)
  - ALWAYS wait for all sub-agents to complete before synthesizing (Step 4)
  - ALWAYS gather metadata before writing the document (Step 5 before Step 6)
  - NEVER write the research document with placeholder values
- **Path handling**: Use full paths from repository root
- **Frontmatter consistency**: Keep fields consistent across all research documents

NEVER CODE! Just research and document findings.
