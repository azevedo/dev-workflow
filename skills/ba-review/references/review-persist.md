# `/ba-review` — Persist Run Artifacts

The `--persist` run-artifact procedure for `/ba-review`. **This file is the only authority on what
that step does.** `skills/ba-review/SKILL.md` deliberately does not describe the procedure; nothing
in it is a summary you may act on instead of reading this.

**Consumer.** Exactly one — `skills/ba-review/SKILL.md`. That single-consumer status is why this
reference is skill-local and cited by bare relative path (`references/review-persist.md`) rather
than living at the repo root; see the reference-placement bullet in `CLAUDE.md`. Before adding a
second consumer, run the migration grep that bullet specifies.

**Load sites.** Two, both gated on `PERSIST=true` — so a default (`PERSIST=false`) run reads this
file not at all:

| Load site | Needs | Uses |
|---|---|---|
| Step 1d — announce scope | `SCOPE_REF` | 4.5a's table + `sanitize(s)`, to announce the fully-resolved target *before* Step 2's reviewer selection, preserving the `^C` affordance |
| Step 4.5 — persist run artifacts | the write procedure | 4.5a–4.5e in full |

**Input — `TIMESTAMP` arrives already captured.** It is captured **once**, at argument-parse time
(`skills/ba-review/SKILL.md`, Parse Arguments), *not* here in 4.5a. **Why, so this is not
"simplified" by re-deriving it closer to the write:** reviewers can take minutes, so deferring the
capture lets wall-clock advance between the Step 1d announcement and the Step 4.5 write, producing
announce-vs-write **skew** — the user is shown one directory and a different one is created.
Re-derive `TIMESTAMP` anywhere in this file and that bug comes back.

**Input — `SCOPE_TYPE`**, resolved by Step 1c or set implicitly by Step 1b for `mr` scope. Deriving
`SCOPE_REF` twice from 4.5a's table — once per load site — is safe. Deriving it the second time
from memory is not.

**Output — `PERSIST_WRITE_OK`.** Step 4.5e sets this fact. It is **true only when all three write
operations succeeded**: `mkdir`, every per-reviewer `Write`, and the `summary.md` `Write` — the
all-or-nothing three-way verdict enumerated in 4.5e. The resident Step 5 Done lines in
`skills/ba-review/SKILL.md` consult it, printing `Persisted to …` only when it is true, so a run
that warned about a failed write never also claims success.

---

## Procedure

### 4.5a. Derive the run directory name

`TIMESTAMP` was captured in Parse Arguments. Compute `SCOPE_REF` from `SCOPE_TYPE` (resolved by Step 1c, or set implicitly by Step 1b for `mr`):

| `SCOPE_TYPE` | `SCOPE_REF` formula | Example |
|---|---|---|
| `mr` | `mr-<N>` where N is the same MR/PR number Step 1b extracted | `mr-123` |
| `branch` | `sanitize(current_branch)`; on detached HEAD, falls through to `unknown` via the sanitize empty-string rule (HEAD SHA is still preserved in `summary.md`'s `head_sha` field) | `feat_add-auth`, `unknown` |
| `staged` | literal `staged` | `staged` |
| `recent` | literal `recent` (the underlying SHA range is recorded in `summary.md`'s scope section, not the directory name) | `recent` |
| `local-range` | `sanitize(range)` — `..` becomes `__`, slashes become `_` | `origin_main__HEAD`, `abc123__def456` |

**`mr` is the one row that bypasses `sanitize()`** — it interpolates `N` directly into `mr-<N>`. That is safe only because the `N` Step 1b extracts is a **numeric** MR/PR identifier. If that ever stops holding, this row must route through `sanitize()` like the others rather than interpolating raw.

**`sanitize(s)`**: replace every character outside `[A-Za-z0-9._-]` with `_`; collapse runs of `_` into one; trim leading and trailing `_`; if empty, fall back to `unknown`. Leading dots (`.bugfix` → `.bugfix`) and leading digits (`123-fix` → `123-fix`) pass through unchanged — the regex is intentionally permissive for both.

The full directory path is:

```
docs/reviews/${TIMESTAMP}-${SCOPE_REF}/
```

**Collision handling.** Before creating the directory, check whether it already exists. If yes, append `-2`, then `-3`, etc., to the full directory name until an unused name is found (`docs/reviews/${TIMESTAMP}-${SCOPE_REF}-2/`). One-second timestamp resolution makes this collision rare; the suffix is belt-and-braces.

### 4.5b. Create the run directory

```bash
mkdir -p docs/reviews/${TIMESTAMP}-${SCOPE_REF}/
```

### 4.5c. Write per-reviewer files

For each reviewer that was dispatched in Step 3, write a file named `<sanitized-reviewer-name>.md` inside the run directory.

Each per-reviewer file uses this template:

```markdown
---
reviewer: <reviewer-name>
source: built-in | external-agent | external-skill | user-typed
status: succeeded | failed
---

# <reviewer-name>

[Write the reviewer's **raw return text** here, verbatim as returned from the subagent in Step 3 — *not* Step 4's wrapped/consolidated form. Cross-reviewer merges, suppression, and validator coercions are recorded only in `summary.md`; per-reviewer files stay raw so a reader can always reconstruct what each reviewer actually said.

If `status: failed`, write a one-line failure reason in place of the raw text.
If `status: succeeded` but the reviewer returned an empty body, write `_Reviewer returned no findings._`]
```

### 4.5d. Write `summary.md`

The summary captures what a future reader needs to reconstruct the review without scrolling chat history:

```markdown
---
scope: mr | branch | staged | recent | local-range
timestamp: <TIMESTAMP>
head_sha: <git rev-parse HEAD at run time, or N/A for mr scope>
reviewers: [<reviewer-1>, <reviewer-2>, ...]
---

# Code Review — <scope description from Step 1d>

## Run Metadata

- Command: `/ba-review <original arguments including --persist>`
- Timestamp: <TIMESTAMP> (local time)
- HEAD SHA: <short SHA or N/A for mr scope>

## Scope

- Type: <SCOPE_TYPE>
- Diff stat: <STAT block from Step 1>
- Underlying SHA range (only when `recent` scope): <shortbase>..<shorthead>
- MR title / description: <if mr scope, from MR_TITLE + MR_DESCRIPTION; otherwise omit>
- Plan context (if Step 1e found one): plan filename + Overview + Acceptance Criteria, verbatim

## Reviewer Roster

| Reviewer | Source | Status | File |
|---|---|---|---|
| <reviewer-1> | built-in | succeeded | [<sanitized-name>.md](./<sanitized-name>.md) |
| <reviewer-2> | external-skill | failed | [<sanitized-name>.md](./<sanitized-name>.md) |
| ... | ... | ... | ... |

## Consolidated Findings

[The full Step 4 output verbatim — the consolidation summary with severity sections, merged findings, the suppressed section, and the header warning counters.]

## Validator Warnings

The internal validator coerced or dropped the following records during consolidation. Per-reviewer files (`<reviewer>.md` in this directory) contain the raw reviewer output for reference.

<one bullet per reviewer with at least one warning, e.g.:>
- *<reviewer-name>*: dropped <N> findings (no file:line); snapped <M> confidence values; <K> findings annotated `(off-diff)`.

When no warnings fired, omit this section entirely.
```

### 4.5e. Announce the persist target

After all writes complete:

> "Persisted review to `docs/reviews/${TIMESTAMP}-${SCOPE_REF}/` (`<N>` reviewer files + `summary.md`)."

If any write failed (`mkdir`, per-reviewer `Write`, or summary `Write`), warn:

> "⚠ Persist failed: `<reason>`. Findings above were displayed in chat only and are not on disk."

Set `PERSIST_WRITE_OK` from this same three-way verdict: **true** only if `mkdir`, every per-reviewer `Write`, and the `summary.md` `Write` all succeeded; **false** if any one of them failed. The resident Step 5 Done lines read this fact and suppress their `Persisted to …` line when it is false.

Continue to Step 5 regardless. The chat output is the source of truth on failure — the persist directory is supplementary.
