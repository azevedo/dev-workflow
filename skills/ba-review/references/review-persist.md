# `/ba-review` — Persist Run Artifacts

The `--persist` run-artifact procedure for `/ba-review`. **This file is the only authority on the
steps of that procedure** — `skills/ba-review/SKILL.md` does not describe them, and nothing in it is
a summary you may act on instead of reading this. Single consumer, hence skill-local and cited by
bare relative path; see the reference-placement bullet in `CLAUDE.md` before adding a second.

**Preconditions this file does not own.** Facts left resident in the skill body, each tagged
`(satellite of `references/review-persist.md`)` — a **satellite** may state a fact about this
procedure, never restate a step of it. The load-bearing one: **a `NO_CHANGES` exit at Step 1c takes
precedence and no persist directory is created**, so this procedure does not run at all. The rest are
`TIMESTAMP`'s single-capture rule and the two Step 5 Done lines.

**Load sites.** Two, both gated on `PERSIST=true`, so a default run reads this file not at all:

| Load site | Uses |
|---|---|
| Step 1d — announce scope | 4.5a only: derive `SCOPE_REF` to announce the target before Step 2's reviewer selection. Creates nothing |
| Step 4.5 — persist run artifacts | 4.5a–4.5e in full |

**In — `TIMESTAMP`**, captured once at argument-parse time, *not* here in 4.5a. **Do not re-derive it
closer to the write:** reviewers take minutes, so a later capture lets wall-clock advance between the
Step 1d announcement and the Step 4.5 write, producing announce-vs-write **skew** — one directory
announced, a different one created.

**In — `SCOPE_TYPE`**, from Step 1c (or Step 1b for `mr`). Deriving `SCOPE_REF` from 4.5a's table
twice, once per load site, is safe; deriving it from memory the second time is not.

**In — 4.5c/4.5d only**, read from what Steps 1–4 left in context: the Step 3 roster with each
reviewer's `source`/`status`; **each reviewer's raw Step 3 return text, not Step 4's consolidated
form** (the one trap here); `STAT` and `head_sha`; `MR_TITLE`/`MR_DESCRIPTION` for `mr`; the Step 1e
plan context; Step 4's output verbatim; Step 4b's validator counters.

**Out — `PERSIST_WRITE_OK`**, set by 4.5e: **true only if all three writes succeeded** (`mkdir`,
every per-reviewer `Write`, `summary.md`). The resident Done lines print `Persisted to …` only when
it is true, so a warned failure never also claims success.

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
| `local-range` | `sanitize(range)` — slashes become `_`; dots pass through, so `..` survives | `origin_main..HEAD`, `abc123..def456` |

**`mr` is the one row that bypasses `sanitize()`** — it interpolates `N` directly into `mr-<N>`. Do not treat that as an assumption: **verify it before interpolating.** If `N` does not match the regex for one-or-more digits, route it through `sanitize()` like every other row. Step 1b should yield a numeric identifier from all five accepted forms, but it is prose executed by a model, not a parser with a fail-closed branch — so an anomalous `N` must degrade to an ugly directory name, never an extra path segment.

**`sanitize(s)`**: replace every character outside `[A-Za-z0-9._-]` with `_`; collapse runs of `_` into one; trim leading and trailing `_`; if empty, fall back to `unknown`. Leading dots (`.bugfix` → `.bugfix`) and leading digits (`123-fix` → `123-fix`) pass through unchanged — the regex is intentionally permissive for both. Because `.` is inside the allowed class, a `..` run also passes through (`origin/main..HEAD` → `origin_main..HEAD`); that is safe because `/` is always replaced, so no sanitized value can introduce a new path segment.

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
