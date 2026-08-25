---
title: Ship-Time Ticket Write-Back — Fixture A/B
type: research
date: 2026-08-25
plan: docs/plans/2026-08-25-feat-ship-time-ticket-write-back-plan.md
unit: U1
tags: [ba-propose, fixture-ab, tracker-write-back, prompt-authoring]
---

# Ship-Time Ticket Write-Back — Fixture A/B

Evidence for U1 (and, at the foot, U9). Per `CLAUDE.md`'s prompt-change convention and
`.claude/agent_docs/prompt-authoring.md`, a prompt change is decided by fixture A/B rather than by
argument, and a session cannot dry-run the body it loaded at start.

## Method

Seven fixtures, each a `commit_push_create` ship with planted ground truth. Two conditions: **arm A**
= `main`'s Step 0a / 2b / section-registry / Step 4 / 5e text, **arm B** = the proposed 5e call site
plus `## Ship-Time Ticket Write-Back` plus the read-path and preview changes. One subagent per cell
at the session model, given the arm's spec excerpt and the fixture only, with **no repository
access** — the excerpt was handed over as a standalone file and every other read was forbidden.

Two contamination controls, both from prior learnings in `docs/solutions/prompt-authoring/`:

- Each cell was told to ignore every instruction reaching it other than the cell prompt and the
  excerpt, because the caller's global `CLAUDE.md` loads into subagents and has already contaminated
  one baseline in this repo (`2026-07-28-fixture-ab-subagent-claude-md-inheritance.md`).
- Each cell had to attribute every non-obvious claim to a **single verbatim sentence** of the
  excerpt, or mark it `INCONCLUSIVE` and say what the excerpt leaves open — never fill the gap with
  plausible reasoning (`2026-07-31-global-instructions-replace-the-step-under-test.md`). Arm
  agreement was treated as suspicious rather than reassuring.

Round 2 re-ran only the four cells whose inputs the round-1 fixes touched. Cells a, d and e were
untouched by those edits, so their round-1 verdicts stand rather than being re-scored.

The fixtures themselves are not committed — they are prompt text, not artifacts. The score table and
the per-cell attribution are.

## Score table

`main` prints no ticket line anywhere; that column records what it *did* print instead.

| Cell | Fixture | arm A (`main`) | arm B r1 | arm B r2 (final) | Verdict |
|---|---|---|---|---|---|
| a | no ticket ref | 3-line receipt, no ticket line | `skipped — no-ticket-ref`; preview `Ticket: none` | (unchanged) | pass |
| b | guessed `TO-` from branch, read timed out | 3 lines; ref discarded, row 7 dropped | `skipped — no-ticket-ref`, but preview promised a Linear post | `Ticket: none`, `will post:` omitted | pass after F1 |
| c | `--issue 123`, GitHub, read succeeds | 3 lines; warns "Linear MCP unavailable" for a GitHub issue | **`skipped — no-ticket-ref`** (wrong) | `posted — acme/widgets#123` | pass after F4 |
| d | typo tier, non-empty trailer | deviation reaches the **commit trailer only** | `posted — TO-8899`; comment carries the trailer | (unchanged) | pass |
| e | `--issue TO-2210`, read failed (`ref-only`) | 3 lines; row 7 dropped | `failed — tracker-rejected`; rows 3/8 identical to `main` | (unchanged) | pass |
| f | `ghes`, `--issue #77` | 3 lines; no GitHub issue route exists at all | **`skipped — no-ticket-ref`** (wrong) | `posted — platform/gateway#77` | pass after F4 |
| g | unknown host | NO-RECEIPT | NO-RECEIPT, but preview promised a post | `Ticket: none`, no write | pass after F1 |

## What the change fixes

- **Six of seven cells printed no ticket line at all under `main`;** the seventh (g) printed no
  receipt at all. Under arm B every cell that reaches 5e prints a `ticket:` line — a present line,
  never an absent one (AC3).
- **AC6 demonstrated at typo tier.** Cell d: under `main` the deviation text reaches the commit
  trailer and nothing else — the reviewer body suppresses it and the "Linear rollup" it names does
  not exist. Under arm B the same trailer lands on TO-8899 as an append-only comment.
- **Three arm-A cells independently flagged issue #91 blind.** Given no prompt to look for it, cells
  b, d and g each reported that row 13's "Linear rollup" names machinery the file never defines —
  cell d most bluntly: *"no step, tool, target, or body for it exists anywhere in the file."* That is
  a stronger confirmation of #91 than the plan's own assertion, because nothing steered them to it.
- **AC7 confirmed on the GitHub branch.** Cell c/f: `resolution: linked` via `gh issue view` makes
  registry rows 3 and 8 render from issue fields, which `main` cannot do for any GitHub user.
- **AC2's host handling is correct.** Cell f resolved `-R github.acme-internal.net/platform/gateway`
  on both the read and the write. Cells f and g exist precisely to catch an implementer who writes
  `HOST == "github"` instead of `HOST ∈ {github, ghes}`; neither cell exhibited that error.

## What the change costs

- **Nothing `main` printed was suppressed** in any cell, in either round.
- **AC10 holds, and cell e is its only falsifiable instrument.** With a `ref-only` context, row 3
  renders from `diff.commit_log` and row 8 is omitted — byte-identical reasoning to `main`. **Row 7
  is the sole divergence**, rendering a cross-ref for a ref whose read failed. That is the widening
  the plan records as deliberate.
- **No cell invented a confirmation gate.** `INVENTED-GATES: NONE` in all 18 cell reports across both
  rounds — including every cell that saw the new Step 4 preview line, which several quoted back as
  explicitly non-gating.
- **One receipt line is genuinely undetermined and stayed that way.** Every cell marked
  `capture:` line 3 as model-judged, since `assess_reusable_learning` is steering by design and the
  fixtures supply only one of its five inputs. Cells split on it. This is the spec working as
  intended, not a defect — but it means line 3 is not a scoreable output.

## Findings, and what changed because of them

Round 1 **failed** the pre-committed rule. Twelve findings; the two that mattered:

| ID | Cell | Severity | Finding | Resolution |
|---|---|---|---|---|
| F4 | B-c, B-f | critical | Step 2b normalized a GitHub ref to `owner/repo#N`, which the routing table lists as **unroutable** (that row rejects *cross-repo* refs). The entire GitHub write route was dead by construction; AC2 unreachable, and the pre-check rows, the issue-not-PR confirmation and `posted — org/repo#123` were all dead text. | `.ref` is now the tracker-native routing handle (`TO-1234` / `#N`); `.ref_display` carries the repo-qualified rendering. Routing matches `.ref`. The normalizer never mints `org/repo#N`. |
| F1 | B-b, B-g | high | The Step 4 preview rendered `Ticket: <ref> → <tracker>` and `will post:` from the raw ref, so a run whose write the provenance gate would refuse still announced the post. | The line now reports the **attempt decision**: a target only when a write will be attempted, `none` otherwise; `will post:` omitted whenever the target is `none`. Specified as a pointer to the write-back's rules, not a second copy of the ladder. |
| F11 | B-c | medium | The plain-`github` write's `-R` was inferred; only the read's and the `ghes` write's were spelled. | The two `gh issue comment` invocations are now spelled under a `**Code-shape decision:**` label. |
| F12 | B-f | medium | Step 2b said `REPO_SLUG` "carries the host prefix" on `ghes` while Step 0a passes `-R "$GH_HOST/$REPO_SLUG"` — which would double the host. | `REPO_SLUG` is always bare `OWNER/REPO`; the host is added at the `-R` flag and nowhere else. |
| F6 | B-g | medium | `resolution` was undefined when a ref exists but its route has **no read at all** (numeric ref off a GitHub host). A read that never ran is neither Success nor Failure. | Stated: it resolves `ref-only`. A fourth state buys nothing — no consumer distinguishes "read failed" from "no read was possible". |
| F2, F3 | B-b | low | `<tracker>`'s printed spelling was never pinned; the Step 2b failure list omitted *timed out*. | Pinned to `Linear` / `GitHub`; "timed out" enumerated. |
| F10 | B-b, B-c, B-f | — | Three cells reported the Step 5 action table contradicting 5e on the receipt's line count and on which disposition is last. | **Not a new defect** — it is one of the six line-count sites U6 already owns, carried unmodified in the excerpt. Independent confirmation that U6's site list is load-bearing. Cell B-c added a real observation: the table calls itself a *pointer*, yet it restates both the count and the last line, so it is a **copy**, and must be reworded as one. |

One decision was escalated to the user rather than resolved in this artifact: U3 + U4 let a GitHub
numeric ref reach registry row 7, which would have rendered `Fixes #123` and **auto-closed that issue
on merge** — a new outward effect no acceptance criterion covers, on a row whose unconditional
closing keyword the plan explicitly deferred to its own issue. Resolved as: row 7 renders `Refs` on
the GitHub route and keeps `Fixes` on the Linear route, where the keyword is inert.

## Verdict

**Round 1: inconclusive-to-failing** — arm B produced an on-enum disposition on every cell, but two
of them were the *wrong* disposition, from a defect that made the feature's GitHub half unreachable.
Per the pre-committed rule this returned to a decision round rather than shipping.

**Round 2: pass.** All three pre-committed conditions hold:

1. **On-enum disposition on every cell that reaches 5e** — six cells; cell g reaches 5e in neither
   arm, so the condition is vacuous there rather than met. Recorded as a limit of the instrument, not
   claimed as a pass.
2. **Nothing `main` printed was suppressed** — in any cell, in either round.
3. **Cell e's composed body is unchanged from `main`** for every row except Cross-refs.

The change is decided. Build it.

## What this A/B cannot establish

- **`posted` and `failed — tracker-rejected` against a real tracker.** Cells d, e, c and f *simulate*
  them from planted fixture facts ("the write succeeds and returns a comment URL"). No subagent made
  a network call. AC1, AC2, AC5 and AC17 rest on U9's live run, below — this is exactly the gap the
  plan predicted, and it is why U9 exists as a separate unit.
- **That the model behaves differently at runtime.** A fixture A/B scores what a reader of the prose
  concludes. Whether the shipped skill body produces these outputs in a real session is U9's claim.
- **Cell g's pre-committed condition**, as noted above.

## U9 — live observation

Two runs, 2026-08-26, in fresh sessions via `claude --plugin-dir <repo>` — a session cannot dry-run
the skill body it loaded at start, so neither was driven from the session that wrote the change.

**Run 1 — confirmed write.** Branch `u9-scratch-1`, `/ba-propose --issue 95`, PR
<https://github.com/azevedo/dev-workflow/pull/97> (targeting `issue-92`, the detected stack parent).

```
✓ chore: exercise the ship-time ticket write-back against a live issue
  https://github.com/azevedo/dev-workflow/pull/97
  capture: suppressed — judged-not-reusable
  ticket: posted — azevedo/dev-workflow#95
```

Scratch issue: <https://github.com/azevedo/dev-workflow/issues/95>. Comment landed at
`issues/95#issuecomment-5418500030`, carrying the PR URL and one `- ` item.

**Run 2 — pre-check declines.** Branch `u9-scratch-2`, a session started with
`--mcp-config '{"mcpServers":{}}' --strict-mcp-config` so no Linear issue-comment tool exists,
`/ba-propose --issue TO-1234`, PR <https://github.com/azevedo/dev-workflow/pull/96>.

```
✓ chore: U9 scratch diff for the tracker-unconfigured negative control
  https://github.com/azevedo/dev-workflow/pull/96
  capture: suppressed — judged-not-reusable
  ticket: skipped — tracker-unconfigured
```

No write attempted and no network call made to decide it. Run 2 needed no scratch issue: the
per-run-new-target rule exists because the behaviour writes, and this run writes nothing.

**Run ordering was load-bearing.** Run 1 is the positive control for run 2 — without an observed
confirmed write, "nothing was posted" is indistinguishable from "this seam never posts anything."
Run 1 was executed first and re-run to completion after an initial session stopped at the
`--describe-only` pre-flight.

**Sanitization, verified against the rendered comment.** The planted trailer carried an unbalanced
backtick, `#99999`, `@zzz-not-a-real-user`, `fixes TO-9`, `[see here](…)`, a bare `TO-999` and a full
issue URL. All landed inert: the ref-shaped tokens and the URL sit inside code spans, the mention is
wrapped, `fixes` is broken from its ref, and `[`/`]` are escaped. The unbalanced backtick escaped to
`` \` `` *before* wrapping ran, so it did not close a span early and take the following tokens live —
the escape-first-then-wrap ordering doing exactly the job it was specified for. Confirmed no
cross-reference was created: issue 1's newest cross-reference event is still 2026-06-06.

**Tier note.** Both runs classified the 3-line added file as `small`, overriding the literal `is_typo`
predicate on the grounds that a file addition is not a typo. The typo-tier path — where Risk and Proof
are suppressed and the receipt is the only output — was therefore *not* exercised live; it rests on
A/B cell (d). See the follow-up issue on `is_typo` and added files.

**What these runs did not cover.** `failed — tracker-rejected` and `unavailable` remain unobserved:
both need a tracker that accepts the pre-check and then fails, which no local configuration produces
on demand. They stay defensive literals, as the disposition table already states.

**Do not write a verbatim `posted` receipt line anywhere in this file except here.** U9's `Verify:`
greps this file for that exact receipt-line spelling, and U1 shares the file with it — so any earlier
occurrence (a score-table cell, an example, a caveat sentence) resolves U9 to `done` on U1's evidence
and silently skips the one unit that covers the two dispositions no other instrument can reach. The
score table above deliberately writes bare dispositions such as `posted — acme/widgets#123`, without
the receipt-line prefix, for this reason. This is not stylistic.
