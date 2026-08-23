---
date: 2026-08-23
topic: reviewer-model-selection
status: approved
triage_level: full
tags: [ba-review, ba-review-plan, reviewers, model-selection, cluster-model-fit]
---

# Reviewer Model Selection — Stakes-Based Carve-Out and a Per-Run Override

## What We're Building

Reviewer subagents in `/ba-review` and `/ba-review-plan` currently pin `model: sonnet` in agent
frontmatter with no override path anywhere in the plugin. Two changes fix that: `security-reviewer`
stops being pinned and follows the session model, and both review skills gain a per-run
`model:<value>` argument token that moves every other reviewer.

This is for two audiences. An external user running the plugin on a non-Anthropic host, who today
pays for a model they did not choose and cannot change without editing eight agent files; and the
maintainer, whose eight-way fan-out on large diffs must stay cheap by default.

Originating issue: #89. Interacts with #90 (merge math has no independence term), #36 (tiered review
escalation), #63 (effort as the cost lever).

## Why This Approach

**The originating sketch's central mechanism does not exist.** #89 proposed that a pinned name which
"does not resolve on this host" would cause the dispatch to omit the override and inherit — and
called that the clause that "quietly fixes P1 with no flag and no config file needed." Nothing in
this plugin executes; `model:` is read by the host loader, so no such check happens anywhere. The
field report is direct evidence against it: the Cursor user *received* Sonnet, which means Cursor
resolved `sonnet` fine. Their complaint is not an unresolvable name, it is that the plugin overrode
their model choice. So P1 requires a real override path, and the free fix was never available.

**The tier is the existing `model:` field, not a new one.** #89's open question 2 asked whether the
tier should live in agent frontmatter (a new field) or the skill roster table. Neither: if deep means
`inherit` and standard means pinned, `model:` already encodes it. A `tier:` field would duplicate
what `model:` says and the orchestrator still could not read it at dispatch, so the roster table
would need a mirror regardless.

**No config file.** A config tier was rejected twice on YAGNI grounds
(`docs/brainstorms/2026-06-27-html-output-mode-brainstorm.md:44` decision 7, "dev-workflow has zero
config infrastructure"; `docs/brainstorms/2026-06-06-ba-review-automation-brainstorm.md:172`). An
in-prose token stays inside that precedent and reuses a pattern the repo already ships.

**Rejected: a dash-flag.** `--model X` is value-taking on `/ba-review`'s scope-classification path, a
parse shape that path has never had, and `skills/ba-review/SKILL.md:30` documents the residual — an
unrecognized flag falls through to scope classification and dies as an unknown git revision. The
in-prose token avoids the shape entirely.

**Rejected: an env var.** `ba-propose`'s `BA_PROPOSE_REVIEW` is the closest precedent and would give
a wrong-host user a persistent default, which is what they actually want. Not taken — an in-prose
token was preferred for consistency with `output:`. Accepted cost: that user retypes `model:` each
run.

## Key Decisions

- **Deep tier is `security-reviewer` alone.** Applied compound-engineering's criterion rather than
  #89's recoverability framing. CE's deep tier is `correctness`, `security`, `adversarial`
  (`ce-code-review/references/dispatch-reviewers.md:26,44`), and what separates those three from its
  twelve mid-tier personas is *how the finding is produced*: each constructs a multi-step trace the
  model must generate itself — mental execution, cascade chains, input-to-sink paths. That capability
  scales with model tier; recognizing a known-shape gap at a point in the diff largely does not.

- **`error-handling-reviewer` is standard, on evidence, not by omission.** CE ships our reviewer
  almost bullet-for-bullet as `reliability-reviewer` — missing error handling on I/O boundaries,
  error swallowing, resource cleanup — and files it **mid-tier**. Its anchor 100 is "a
  `requests.get(url)` with no `timeout=` keyword"; anchor 75 is "you can point to the specific line
  missing the protection." That is presence/absence on one line. `agents/error-handling-reviewer.md:28-31`
  matches ("look for try/catch blocks", "what renders during loading"). #89's earlier
  two-member deep tier was not a measured call and is superseded.

- **`architecture-reviewer` stays standard** — #89's open question 1, answered. Nothing about it
  requires a self-constructed trace.

- **Roster gap, recorded not filed.** Two of CE's three deep personas have **no carrier on our
  roster**: we have no `correctness-reviewer` and no `adversarial-reviewer`. #6 owns
  intent-vs-implementation completeness and is explicitly "not implemented as an 8th reviewer agent";
  #89 notes the correctness remainder is "thin on its own and probably distributed." So the deep tier
  is 1-of-8 because of a roster gap, not because the tiering is wrong. Per #89's own instruction this
  is a sentence here, not a new issue.

- **Override surface: in-prose `model:<value>` token**, matching `ba-plan`'s shipped `output:html`
  (`skills/ba-plan/SKILL.md:4,28-34`). Scanned and stripped **before** scope classification,
  following the `--persist` ordering at `skills/ba-review/SKILL.md:18-20`. Grammar follows `output:`'s
  actual shipped behavior, not just its style: optional whitespace after the colon tolerated, and an
  unrecognized or empty value **dropped with a one-line note** rather than erroring. That last part
  is the honest replacement for the rejected fallback clause — it defines the unrecognized-value case
  without needing to know anything about host resolution.

- **Resolution order.** No token → pass no model; agent frontmatter decides. Token present → pass the
  value to **every reviewer on the roster except `security-reviewer`**, which inherits the session
  model unconditionally. Deliberately count-free: the standard set is a different size on each skill,
  and a literal would be correct on one and wrong on the other.

- **`security-reviewer` is the single exception to the override.** The stakes split becomes an
  invariant rather than a default. The alternative — #89's "forces both tiers to X" — lets
  `model:haiku` downgrade security review, which defeats the rationale for having a split at all.

- **Discovered external reviewers render `—`** in the Tier column, meaning their own definition
  decides; we do not own their frontmatter and cannot state a tier honestly. The override **does**
  move them: an explicit per-run choice should win over a third-party default. This keeps the ledger
  symmetric under the never-hide convention.

- **Visibility: a `Tier` column on both roster tables**, rendered onto the plain-text ledger line.
  Accepted with eyes open — see Known Debt.

- **Standard pin stays `sonnet`.** Changing the value is a separate question with no evidence behind
  it either way.

- **Deferred to plan:** whether to add a `CLAUDE.md` line naming the new mirror sites. Discoverability
  versus `prompt-authoring.md`'s "weight is a first-class cost". Decide there, not here.

## Known Debt

- **The Tier column is a new hand-maintained mirror axis with no CI pin** — 8 agent frontmatters, 2
  roster tables, 2 ledger renderers. `scripts/check-invariants.mjs` reads no agent frontmatter at all
  (not `name`, not `model`, not `tools`), so this ships with zero automated protection on the exact
  dimension it changes. This drift class has already bitten: `agents/comment-quality-reviewer.md`
  shipped `model: sonnet` while its own plan
  (`docs/plans/2026-08-09-feat-comment-quality-reviewer-builtin-plan.md:28`) specified `inherit`, and
  the plan's risk note at :132 reasons about behaviour at `inherit`. Nothing caught it.

- **At 1-of-8 the column carries seven identical values and one different one.** "Tier" is a heavy
  word for one carve-out. Dropping the tier vocabulary was offered and declined; keeping it is a
  deliberate bet that the roster gap gets filled later.

- **The tier assignment is decided by argument, and the repo's standard is fixture A/B.** CE's
  precedent is strong reasoning, not a measurement on our roster and our diffs. A dry-run will
  confirm the mechanism dispatches; it will not settle whether `error-handling-reviewer` finds less at
  `sonnet` than at session model. Named so it is not mistaken for settled.

## Scope Boundaries

- **`/ba-research` is not in scope**, though it carries the identical unstated split — codebase agents
  `inherit`, the two research-doc agents pinned `sonnet` (`skills/ba-research/SKILL.md:68-75`). Its
  roster is unchanged by this work and it has no ledger to render a tier into.
- **`research-analyzer` and `research-locator` keep `model: sonnet`.** They are not reviewers.
- **No new reviewer agent.** The correctness/adversarial gap is recorded above, not filled.
- **No change to the merge math.** #90 owns the independence term. Noted below as an interaction.
- **No env var, no config file, no dash-flag.**
- **No persistent per-checkout default.** A wrong-host user retypes `model:` each run.
- **The `sonnet` pin value itself is not revisited.**

## Interaction With #90

This introduces the roster's first genuine model diversity, which cuts both ways on the merge math.
It is where an independence term starts to pay — `security-reviewer` at session model is a materially
different source from seven pinned reviewers. It is also where #90's documented counter-effect starts
to bite: `skills/ba-review/SKILL.md` §4c groups findings by **exact `file:line` match**, and different
models tend to anchor the same defect at different lines. So merges that succeed today may begin to
fail. Not a blocker — the diversity is 1-of-8 — but the plan should not claim the merge math is
untouched in effect merely because it is untouched in text.

## Acceptance Criteria

- `agents/security-reviewer.md` carries `model: inherit`. The other seven `*-reviewer.md` files carry
  `model: sonnet`, unchanged.
- No new frontmatter field is added to any agent. The field set stays `name`, `description`, `model`,
  optional `tools`.
- With no `model:` token, both review skills dispatch every reviewer passing **no** model, exactly as
  today.
- With `model:X`, both skills pass `X` to every roster reviewer except `security-reviewer`, and to
  discovered external reviewers. `security-reviewer` receives no model override.
- `model:` with an unrecognized or empty value is dropped with a one-line note; the run proceeds.
- The token is stripped before scope classification — `/ba-review model:opus main..HEAD` resolves
  scope to `main..HEAD`, not to a bad revision.
- Both roster tables carry a `Tier` column; both ledgers render it, with `—` for discovered externals.
- No standard-tier count literal is written anywhere.
- `argument-hint` in both skills' frontmatter names the token.
- `README.md` is updated: both skill descriptions, both feature lists, and the agents table.
- `scripts/check-invariants.mjs` passes. Specifically `rubric-mirror`: the edited `- Task ` dispatch
  blocks each still contain `N ∈ {0, 25, 50, 75, 100}` byte-for-byte (the check is not
  whitespace-normalised, and zero blocks in a mirror file reads UNKNOWN, not PASS).
- `.claude-plugin/plugin.json` `version` bumped exactly once for the ship — check whether the branch
  already carries a bump before adding one.
- Dry-run in a fresh session via `claude --plugin-dir <repo>`, never merge-then-cache. The dry-run
  must assert from the log that the intended model actually served each subagent, rather than
  inferring it from output quality.

## Open Questions

None. All four of #89's open questions are answered above: (1) deep tier is `security-reviewer` alone;
(2) no new field — `model:` is the tier, roster table carries the display; (3) in-prose token, neither
flag nor config key; (4) `/ba-review` and `/ba-review-plan` only.

## Convention Compliance

Convention-checker run before the write. 18 conventions checked, 10 aligned, 3 violations, 6 advisory.
All three violations resolved with the user:

- **V1 — scope reductions must escalate conversationally, not be resolved in the artifact.** Already
  discharged. The `/ba-research` exclusion was an explicit option in the scope question, and the
  fallback-clause rejection was argued in conversation before the override surface was chosen. The
  entries above are the record, not the decision.
- **V2 — "the seven standard reviewers" is wrong on one skill** (7 on `/ba-review`, 6 on
  `/ba-review-plan`) and would mint a third unpinned count. Resolved: write no count at all; express
  the rule as "every reviewer except `security-reviewer`".
- **V3 — resolution order was silent on discovered external reviewers**, who share the ledger under
  the never-hide convention. Resolved: render `—`, and the override does move them.

Advisories adopted: `output:`'s full shipped grammar including drop-with-a-note (A1); `README.md`
update sites (A2); `argument-hint` on both skills (A3); the mirror-axis decision deferred to plan
(A4); the A/B caveat recorded under Known Debt rather than treated as settled (A5); rejections placed
under Key Decisions and Scope Boundaries rather than a `Rejected Designs` heading, which is
conditional on design-it-twice having fired (A6).

Confirmed non-issues: the colon in `model:<value>` is unaffected by the retired-invocation check,
which scans only for the literals `/ba:` and `commands/ba/`; the `CLAUDE.md` colon rule is scoped to
skill *names*, and `output:html` is the governing precedent. The token grammar is correctly classed as
a machine-boundary contract (specify to the character) while which reviewer gets which tier is
steering (state the criterion and stop). Adding a column does not collide with never-hide, which
forbids omitting reviewers.

## Next Steps
→ `/ba-plan` to create implementation plan
