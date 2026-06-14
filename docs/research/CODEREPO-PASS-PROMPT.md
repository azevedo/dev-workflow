# Plan-verbosity research — code-repo pass (consolidates with an earlier md-only pass)

> This prompt is meant to be run on a machine with a **real code repository** (not the dev-workflow
> plugin repo, whose deliverable is markdown). It is the second of two research passes; the first
> (md-only) lives at `docs/research/2026-06-13-plan-verbosity-research.md` on branch
> `claude/plan-verbosity-research-3al1it`. Paste everything below the line as the session prompt.

---

## Operate in research mode
Investigate and document only — do NOT modify the `/ba:plan` command (or any command). Diagnose;
the fix is a separate later step. Persist findings to a durable doc under `docs/research/` named
`YYYY-MM-DD-plan-verbosity-coderepo-research.md` so it can be consolidated with a prior pass.

## The problem (fixed — do not redrift)
Reviewing a `/ba:plan` output doc costs me too much to read. That's the whole problem.
This is about the FORM of plan output (how/where content is presented for review), NOT its PURPOSE
(what a plan is for). Changing presentation = in scope. Redefining what a plan is, or "should this
command exist" = out of scope.

## Why this pass exists: there's a prior pass, and it was evidence-starved
I already ran this on my dev-workflow *plugin* repo. That repo's deliverable is markdown, so its
plans are atypical (plan "code blocks" are command specs), the corpus was small (24 plans), and it
had NO usable execution transcripts and NO inline PR review comments — so its review-value findings
are INFERRED, not observed. That doc's diagnosis: the cost is a template "framing tax" at the
COMPREHENSIVE detail level (redundant approach/risk sections, intra-doc duplication like
Testing-Strategy/Documentation-Plan restating the body, and brainstorm→plan duplication of
scope/alternatives) — NOT the code blocks. Volume target it proposed: COMPREHENSIVE 1040→~650-750,
STANDARD 510→~400, MINIMAL left alone.

THIS repo is a real code repo with more plans, real transcripts, and PR review threads — the
behavioral evidence the prior pass lacked. Your job is to get the FULL picture and either
corroborate or overturn the prior diagnosis.

## Start from MY actual evidence — do not take my self-diagnosis at face value
1. Pull real plan docs across ALL three detail levels (MINIMAL/STANDARD/COMPREHENSIVE), including a
   painful large COMPREHENSIVE one and a lean MINIMAL one. Sample every level.
2. Bucket their content by section × (volume, review-value). Measure volume (lines per section,
   code vs prose). This part is objective — do it carefully.
3. For review-value, use BEHAVIORAL evidence, not my claims:
   - Conversation transcripts (.jsonl under ~/.claude/projects/<this-repo>/) — what I skim, where I
     intervene mid-flight, what I ask to change/cut/expand when a plan is on screen.
   - My PR review comments / review threads on plan-bearing PRs — what I actually flag.
   Infer what I scrutinize vs skim from these, then map it onto the section buckets.

## Things I know about my own review (inputs to verify, not gospel)
- Code blocks are bulky but I keep them on PURPOSE — getting code roughly right at plan time stops
  me rewriting later. Do NOT propose cutting them; at most, make them cheaper to scan.
- My self-reported review criteria are lossy. Prefer inference from transcripts/PR comments.

## Specifically validate or overturn the prior pass's hypotheses
- Do the framing sections (Overview/Proposed Solution/Technical Approach, Risk Analysis, Testing
  Strategy, Documentation Plan, System-Wide Impact) actually get skimmed in my real transcripts?
- Does the "cost lives in framing, not code" claim hold when code blocks are real code, not
  markdown specs? Re-derive the prose/code ratio and the volume targets from THIS corpus.
- Is the COMPREHENSIVE-level inflation the dominant driver here too, or is the cost distributed
  differently?
- Use the SAME section-taxonomy buckets so the two volume maps merge directly.

## Don't duplicate sibling commands
Before proposing new structure, check what brainstorm/slice/review-plan (or this repo's equivalents)
already own. Don't have `plan` re-host a responsibility a sibling already covers.

## Output
A research doc that: (a) presents the volume map and the BEHAVIORAL review-value findings for THIS
repo; (b) explicitly states where it agrees with / contradicts the md-only pass; (c) proposes a fix
direction (trim, compress, demote, restructure, progressive disclosure, a companion read view, or
"leave it — cost is elsewhere") with an evidence-based line/time target. Goal: plan docs that are
"cheap and trustworthy to review." Then commit and push to branch
`claude/plan-verbosity-research-3al1it` (the same branch holding the md-only pass) so I can
consolidate both. Pull the branch first; add a new file, don't overwrite the existing
`*-plan-verbosity-research.md`.
