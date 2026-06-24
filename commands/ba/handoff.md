---
name: ba:handoff
description: "Compact the current conversation into a handoff document for a fresh or parallel session to continue from — captures git state, references in-repo artifacts by path, and suggests exact next steps, saved to $TMPDIR."
argument-hint: "[what the next session will focus on]"
---

Write a handoff document that compacts the current conversation so another agent — or a fresh session of your own — can continue the work without re-reading the transcript. Save it to the user's OS temporary directory, never the workspace.

Create the file with `mktemp` so parallel sessions never collide on the name:

```bash
HANDOFF_FILE=$(mktemp "${TMPDIR:-/tmp}/ba-handoff.XXXXXX")
```

Use exactly this form. Do **not** use `mktemp -t` (it ignores `$TMPDIR` on macOS and writes to `/var/folders/...`), and do **not** put `XXXXXX` before a suffix like `-XXXXXX.md` (BSD `mktemp` treats those Xs literally and creates a file actually named `XXXXXX`). Once the doc is written, tell the user its exact path — parallel sessions can't see each other's context, so the path is how the next Claude finds the handoff.

If the session produced nothing worth handing off, say so to the user and don't write a file.

## What the document must carry

**Git state.** Record where the code stands so the next session doesn't have to rediscover it:

```bash
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git status --porcelain=v2 --branch   # branch, dirty/clean, ahead/behind (pushed/unpushed)
fi
```

Name the branch, whether the tree is clean or dirty, and whether commits are pushed. Report exactly what git reports — don't invent a branch name or an upstream that isn't there. If there's no repository, note "not in a git repository" instead of git state.

**In-repo artifacts — reference, don't restate.** When a fact already lives in a file, point to it by path instead of copying its content. This includes dev-workflow artifacts: `docs/brainstorms/`, `docs/plans/`, `docs/research/`, `docs/solutions/`, and `docs/reviews/`. The same applies to PRDs, ADRs, issues, commits, and diffs — cite them, don't duplicate them.

**`/ba:execute` progress.** If the session was executing a plan (`plan_schema: 2`), name the plan path and narrate U-resolution via `derive-state(plan, git, run_verify: false)` — subject scan only, **never** run `Verify:` commands (handoff must be side-effect-free; this is the `run_verify: false` asymmetry owned by the `## U-ID & Git-Derived State Convention` section in `execute.md`).

For each unit, the verdict is either `done-via-subject` (its `U<n>` appears in a commit subject in `<base>..HEAD`) or `pending`. Handoff **cannot** observe `done-via-verify` — a unit that is implemented but uncommitted reads `pending` here. Narrate pending units as: "uncommitted, not yet durable — commit and run `/ba:propose` to make it durable." State this limitation explicitly so the receiving session knows the progress report reflects **git durability**, not worktree state.

E.g. "mid-execute on `docs/plans/…-plan.md`: U1–U3 done-via-subject; U4–U5 pending (U4 may be implemented in working tree — verify before re-implementing)."

**Suggested next steps.** Add a "Suggested next steps" section listing the *exact* slash invocations the next agent should run — not prose hints. For example:

- `/ba:execute docs/plans/2026-06-04-feat-handoff-command-plan.md` — resume implementation
- `/ba:review HEAD~3..HEAD` — review what landed

## Always, regardless of the argument

- **Redact sensitive information.** Strip API keys, tokens, passwords, `.env` contents, full auth headers, and PII. Redaction is best-effort by eye — there's no scrubber behind it, so don't claim the doc is guaranteed clean; just don't write a secret into it.
- **State only verified facts.** Every path, branch, ID, and test result must come from something you actually observed this session. Don't fabricate file paths, commit SHAs, ticket IDs, or claims that tests passed. If you're summarizing from memory and aren't sure, label it "not verified this session" rather than asserting it.
- **Honour the argument.** If the user passed an argument to `/ba:handoff`, treat it as the next session's focus and lead with what that session needs. The argument controls emphasis and ordering only — it never licenses dropping git state, in-flight execute context, redaction, or the verified-facts rule.

Structure the document however the session's actual content warrants — there is no fixed template. A short session needs a short handoff.
