---
title: "fix: Exclude fixer skills from /ba:review reviewer discovery"
type: fix
status: done
date: 2026-04-15
detail_level: minimal
tags: [review, discovery, simplify, exclusion]
---

# Exclude Fixer Skills from /ba:review Reviewer Discovery

The `simplify` skill (a Claude Code built-in) gets discovered as an external reviewer by `/ba:review` because its description ("Review changed code for reuse, quality, and efficiency, then fix any issues found") matches the keyword filter on "review" and "quality". But `simplify` is a **fixer** — it modifies files — not a **reviewer** — which should be read-only and produce structured findings. Running it inside the review pipeline either produces unstructured output or mutates files mid-review while other reviewers run in parallel.

## Acceptance Criteria

- [ ] `simplify` no longer appears in `/ba:review` reviewer selection
- [ ] The built-in `simplification-reviewer` continues to appear (it covers the same dimension, read-only)
- [ ] Both exclusion clauses in Step 2b are updated (file-based discovery + system-reminder scan)
- [ ] An inline comment explains the "read-only reviewer contract" so future maintainers know when to add to this list
- [ ] Version bump in `.claude-plugin/plugin.json`

## What We're NOT Doing

- **Not building automatic fixer detection.** We're adding `simplify` to the explicit exclusion list — the same proven pattern used for `ba:plan`, `ba:execute`, etc. Semantic detection ("does this skill modify code?") is over-engineering for a single case.
- **Not blocking user-typed overrides.** If a user manually types `simplify` in Step 3's free-text path, it still runs. The exclusion only governs auto-discovery. This is intentional — explicit user intent should be respected.
- **Not changing `/ba:review-plan`.** Its discovery policy is more permissive by design ("only exclude tools that truly cannot operate on text"). A fixer running against plan text is harmless noise, not a file-mutation risk.

## Context

**File to change:** `commands/ba/review.md`

**Exclusion clause 1 — file-based discovery (line 230):**
Current:
> Only exclude if it is one of these specific categories: plan writers (`ba:plan`, `ba:brainstorm`), execution commands (`ba:execute`, `ba:tdd`), or the built-in agents already listed in 2a.

Change to:
> Only exclude if it is one of these specific categories: plan writers (`ba:plan`, `ba:brainstorm`), execution commands (`ba:execute`, `ba:tdd`), fixer skills that modify code rather than producing read-only findings (`simplify`), or the built-in agents already listed in 2a.

**Exclusion clause 2 — system-reminder scan (line 232):**
Current:
> Exclude: `ba:review`, `ba:review-plan`, and other orchestration skills.

Change to:
> Exclude: `ba:review`, `ba:review-plan`, fixer skills (`simplify`), and other orchestration skills.

**Version bump:** `.claude-plugin/plugin.json` — patch increment.

## Convention Compliance

- [x] Plan artifact path format — aligned
- [x] YAML frontmatter — aligned
- [x] Planning commands never write code — aligned
- [x] Built-in reviewers always appear — aligned (excluding non-reviewers, not hiding legitimate reviewers)
- [x] External reviewers shown alongside with overlap notes — aligned (fixer skills are not reviewers)
- [x] No new commands/agents/paths — README.md update not required
