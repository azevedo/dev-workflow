---
name: ba:review-plan
description: Review a plan with available agents and skills before implementation
argument-hint: "[path to plan file, or leave empty to auto-detect latest]"
---

# Review a Plan Before Implementation

Run a judged section-scoring review against a plan document using the seven built-in review agents (plus any reviewer you name explicitly via Adjust). The judge scores the plan's sections and targets the weak or risky ones; the result is a **selection ledger** — every reviewer enumerated, selected (`✓`) or set aside (`○`) with a one-line reason. This catches issues at plan time — where leverage is highest — instead of after implementation.

## Plan File

<plan_path> #$ARGUMENTS </plan_path>

### Invocation mode

Scan the arguments for an `--auto` token. If present, this is the **auto path** (invoked by `/ba:plan`
Step 7 per the **Auto-invoke contract** below); strip the token and treat the remainder as the plan path.
If absent, this is the **manual path** (the user ran `/ba:review-plan` directly). The mode is the single
signal that drives the entry-point-conditional empty-`✓` invariant (Step 2) and the verdict-sentinel
behavior (Auto-invoke contract) — there is no other way to detect auto mode, so it must be read here.

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

## Step 1: Score Sections & Build the Selection Ledger

### 1a. Built-in reviewers

These seven built-in reviewers live flat in `agents/` and are always available:

| Agent | Focus |
|---|---|
| `architecture-reviewer` | Architectural consistency, coupling, separation of concerns |
| `security-reviewer` | Security implications of proposed changes |
| `simplification-reviewer` | Over-engineering, unnecessary abstraction, YAGNI |
| `error-handling-reviewer` | Edge cases, error paths, graceful failures |
| `test-coverage-reviewer` | Test proposals, coverage gaps, testing approach |
| `deep-module-reviewer` | Ousterhout deep-module design: interface depth, dependency injection, side-effect discipline |
| `complexity-reviewer` | Ousterhout's three complexity manifestations: cognitive load, change amplification, obscurity / unknown-unknowns |

**All seven built-in reviewers MUST appear in the selection ledger (Step 2) — selected (`✓`)
or set aside (`○`), each with a reason. Never omit a reviewer from the ledger or from the
Adjust pick-list.**

review-plan does **no** external-reviewer discovery: there is no Glob sweep across agent/skill
directories. The 7 built-ins are the roster; a rare plan-relevant external stays reachable only via
the Adjust "Other" free-text option (Step 2). review-plan is a **third mirror site** of the never-hide
ledger convention (alongside `commands/ba/review.md` Step 2 and `README.md`).

### 1b. Judge each reviewer against the plan

For **each** of the seven built-ins, answer one question:

> **Does this plan have a weak or risky section in this reviewer's domain?**

Score the plan's sections and target the weak ones. This is a judgment call on the **content actually
present in the plan** — the proposed architecture, the security surface of the approach, abstraction and
coupling decisions, error/edge-case coverage, the test strategy, complexity and information hiding, and so
on. It is **not** a scoring rubric and **not** a section→reviewer mapping. Judge what the plan actually
proposes.

- **Meaningful-work bar.** Select (`✓`) a reviewer only when the plan has a genuinely weak or risky
  section in its domain — not a token keyword match, not merely a "safe pair." Otherwise set it aside
  (`○`).
- **Overlap.** When two otherwise-selected reviewers are largely redundant *on this plan*, keep the
  deeper one and set the other aside (`○`), naming the **surviving** reviewer as the reason. Keep both
  when each contributes a distinct part worth having. No numeric threshold — this is a stated judgment,
  recorded in the ledger. For a three-way overlap, keep one and name it as the survivor for the other two.
- **Uncertainty.** When the call is genuinely 50/50, set aside (`○`) with a reason that names the
  **absent or ambiguous weak surface** — the ledger + Adjust make a wrong set-aside one toggle away to
  correct. (This is why `○` reasons must cite the absent weak section, not say "not relevant": the honest
  reason is what lets the user spot a wrong call.)
- **Reason quality.** Every `✓` reason cites the **weak section** present in the plan; every `○` reason
  cites the **absent weak surface** or the overlapping reviewer.

This judgment writes **no state** — it is recomputed fresh on every run.

---

## Step 2: Present the Selection Ledger & Confirm

Print the **full roster** of seven built-ins as plain text (not a widget) in stable order — every
reviewer on its own line:

```
Reviewer selection — 7 built-in reviewers (<S> ✓ selected, <A> ○ set aside)

✓ architecture-reviewer — the layering decision in **Technical Approach** is underspecified; structure worth a look
✓ simplification-reviewer — **Proposed Solution** introduces an abstraction that may be premature
○ security-reviewer — no auth, input-handling, or sensitive-data surface proposed in this plan
○ error-handling-reviewer — no new IO or error paths in the proposed approach
○ test-coverage-reviewer — overlaps with simplification-reviewer here; simplification covers the over-build risk
○ deep-module-reviewer — no new module or interface proposed; nothing to score for interface depth
○ complexity-reviewer — plan is small and linear; no cognitive-load surface
```

**No elision.** The guarantee is the **enumeration**: every reviewer appears on its own line exactly
once. Never truncate, summarize ("…and N others"), or drop a low-relevance reviewer — a reviewer missing
from the ledger is unreachable, which violates the never-hide guarantee.

The ledger footer carries **no** discovery note. review-plan runs no Glob sweep, so there is no "No
external reviewers found in …" line to print (there is no discovery).

Then confirm with a single **AskUserQuestion**. The branch depends on whether the `✓` set is empty.

**When the `✓` set is non-empty** — question: "Run the selected reviewers, or adjust the set?"
1. **Run the ✓ set** — dispatch the selected reviewers (Step 3).
2. **Adjust** — open the full pick-list to change the set.
3. **Cancel review** — exit without running any reviewer (no findings produced).

**Entry-point-conditional empty-`✓` invariant.** What happens on an empty `✓` set depends on **how
review-plan was entered**:

- **Manual path** (no `--auto` token, the user explicitly asked for a review) — an empty `✓` set offers
  Adjust/Cancel (below). The user asked; do not silently do nothing.
- **Auto path** (`--auto` token present — invoked by `/ba:plan` Step 7, per the **Auto-invoke contract**
  below) — an empty `✓` set **self-suppresses**: zero widgets, print the clean sentinel, return control to
  the caller.

This is one named invariant with two behaviors keyed off the `--auto` token (read in **Invocation mode**);
it is resolved concretely in the **Auto-invoke contract** section below and `commands/ba/plan.md` Step 7.

**When the `✓` set is empty on the manual path** — question: "No section was judged weak in any
reviewer's domain. Pick reviewers manually, or cancel?" Drop the "Run" option (per the
never-dispatch-empty-set invariant below); the options are exactly `1 = Adjust`, `2 = Cancel review` — no
hidden "Run" at position 1.
1. **Adjust** — pick reviewers manually from the full list.
2. **Cancel review** — exit without running any reviewer.

> The third option is **Cancel review**, not "Done." It runs nothing and produces no findings, avoiding a
> collision with Step 5's "Done" (acknowledge findings).

**Common-case guarantee:** when the user accepts the default `✓` set ("Run the ✓ set"), exactly **one**
AskUserQuestion appears between the ledger and dispatch.

### Adjust — full pick-list

Present **every** built-in (the identical set of seven, with **no** judgment re-filtering) as an
individual, selectable option via **AskUserQuestion** with `multiSelect: true`. **Each reviewer gets its
own option — never bundle multiple reviewers into a single option.**

Apply these distribution rules:

1. Collect the seven built-ins into an ordered list.
2. Partition into groups of 2-4 (prefer 3-4 to minimize questions). If the final group would be a lone
   reviewer, rebalance with the adjacent group — split their combined members into two groups of 2-3,
   rather than pushing one group past 4. A typical split: Q1 architecture, security, simplification,
   deep-module (header `"Analysis"`); Q2 error-handling, test-coverage, complexity (header `"Quality"`).
3. Use short `header` values (max 12 chars), e.g. `"Analysis"`, `"Quality"`.
4. The reviewers marked `✓` in the ledger are the recommended default. **If the entering `✓` set is
   empty** (an all-`○` ledger), open Adjust with **nothing** pre-checked — do not fall back to the `○` set
   as a default.

The **"Other"** free-text option accepts a reviewer name not in the built-in roster; typed names resolve
via Step 3's user-typed handling, which is **self-contained in Step 3**.

**Invariant — never dispatch an empty set.** This is the single rule behind both the empty-`✓` manual
branch above and any all-deselected Adjust result — they are two entry points to it, not competing
mechanisms. At any confirm or Adjust step, an empty resulting set routes to a forced choice, never a
silent run:
- **Non-empty** result → proceed to Step 3 with that set.
- **Empty** result (the judge selected none, or the user deselected everything) → ask "No reviewers
  selected. Adjust again or cancel?" Looping re-opens the pick-list; **cancel here is identical to "Cancel
  review"** at the confirm step — no reviewers run, no findings.

---

## Plan-Anchor & Confidence Grammar

This grammar is a **parser contract**: every dispatched reviewer (Step 3) and the Step 4 parser must
agree on it exactly. It is written here as the literal authority — do not re-derive it from prose
elsewhere, or a divergent token shape (line-numbered vs key-based) will be silently dropped at parse.
It adapts `commands/ba/review.md`'s `**<path>:<line>**` bullet grammar to plan anchors; line numbers do
**not** appear (plans are edited freely and line anchors would rot).

**Anchor namespaces.** A finding's anchor is exactly one of three forms, written verbatim as the bold
token at the head of the bullet:

| Namespace | Anchor token | Example | Owned by |
|---|---|---|---|
| **Section heading** | the normalized heading text | `**Overview**`, `**Technical Approach**` | the plan's section structure |
| `### U<n>` implementation unit | the `U<n>` key | `**U3**` | `commands/ba/execute.md` (consumed here) |
| keyed acceptance criterion | the `AC<n>` key | `**AC2**` | `commands/ba/plan.md` (consumed here) |

review-plan **consumes** the `### U<n>` grammar (owned by `execute.md`) and the keyed-`AC<n>` grammar
(owned by `plan.md`). It does **not** mint or redefine either.

**Literal bullet format** (reviewers must emit exactly this):

```
- **<anchor>** *(confidence: N)* — <body>
```

where `<anchor>` is a section-heading text, a `U<n>` key, or an `AC<n>` key, and `N ∈ {0, 25, 50, 75, 100}`.

**Matching rule.** An anchor resolves against the plan by **case-insensitive exact** match on the
normalized heading text / key string (collapse internal whitespace, trim, drop surrounding markdown). A
struck (`strike-don't-renumber`) `U<n>` does **not** resolve. A non-resolving anchor is **dropped** by
consolidation (Step 4) and counted in the surfaced **`dropped_off_plan`** counter.

The drop reason must distinguish:
- **not-found** — "anchor names no heading / U-ID / AC-key in the plan"
- **struck** — "anchor names a struck/superseded `U<n>`"

so the surfaced counter message tells the reader which it was, rather than forcing a manual re-scan.

---

## Step 3: Run Selected Reviewers

For each selected reviewer, dispatch a fresh subagent using the Agent tool — regardless of whether it is a
built-in agent, a skill, or a user-typed name. Every reviewer runs in its own isolated context. Run all
selected reviewers **in parallel**. If a reviewer fails or returns empty, note it for the Coverage block
but do not block other results.

**Built-in vs external dispatch:** built-in plugin reviewers use `subagent_type: dev-workflow:<name>`
(e.g. `dev-workflow:security-reviewer`). The selection ledger shows bare display names for readability;
the dispatch uses the fully-qualified ID. Discovered/typed **external** reviewers (e.g. `code-reviewer`)
dispatch by their own name, **never** prefixed with `dev-workflow:`.

### Dispatch instructions — apply to ALL templates

Every dispatch template (built-in, skill, user-typed/"Other", custom dimension) embeds the following,
verbatim where quoted:

1. **Plan framing.** "This is a *plan*, not finished code. Review the proposed approach, not implementation
   details that don't exist yet."
2. **Native vocabulary.** Instruct the reviewer to emit `## Must Address` / `## Consider` / `## Looks Good`
   as the primary heading vocabulary. The parser accepts the four-level Critical/High/Medium/Low ladder
   only as a compatibility alias (Step 4a) — **without this instruction every reviewer defaults to
   code-review headings and every run needlessly exercises the fallback-mapping path.**
3. **Anchor specificity.** Instruct the reviewer to anchor each finding to the **most specific applicable
   key**: `U<n>` > `AC<n>` > section heading. A section heading and a `U<n>` nested under it are **distinct
   dedup fingerprints** (Step 4c) — two reviewers flagging the same concern at different granularity will
   not merge, silently losing corroboration lift.
4. **Bullet grammar.** Emit each non-`Looks Good` finding in the exact bullet format from the
   **Plan-Anchor & Confidence Grammar** above: `- **<anchor>** *(confidence: N)* — <body>`,
   `N ∈ {0, 25, 50, 75, 100}`. `Looks Good` bullets stay `- [Validated aspect]` (no anchor, no confidence).
   If no findings at a severity, write `None` under that heading.
5. **Protected artifacts.** Do not suggest deleting, removing, hiding, gitignoring, relocating, renaming,
   archiving, consolidating, splitting, or otherwise changing the existence, path, or identity of any file
   under `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/research/`, or `docs/reviews/`. These
   directories are intentional workflow outputs. You may still review and flag content-quality issues
   inside these files (vague acceptance criteria, missing edge cases, broken references), and you may
   review changes to these files when they appear in the diff — the guard protects the file's existence
   and location, not its contents.

> The protected-artifacts guard is **load-bearing here**: the reviewed plan itself lives under
> `docs/plans/`. The carve-out ("review changes/contents, never propose deleting/relocating") is exactly
> what lets a reviewer flag plan *content* without proposing to move or delete the plan.

### Templates

**Agent-based (built-in) reviewer** — prompt the subagent directly:

- Task <reviewer-agent>("Review this **plan**, not finished code, for [dimension focus]. Apply all the
  dispatch instructions in the section above (plan framing, native vocabulary, most-specific-key anchoring,
  the bullet grammar, protected artifacts).

  Emit your findings under the headings `## Must Address` / `## Consider` / `## Looks Good` (NOT
  Critical/High/Medium/Low). Anchor each non-`Looks Good` finding to the most specific plan key as
  `- **<anchor>** *(confidence: N)* — <body>`, `N ∈ {0,25,50,75,100}`.

  Plan path: [path]
  Plan content: [the full plan]
  Plan context: [Overview + Acceptance Criteria]")

**Skill-based reviewer** — instruct the subagent to invoke the skill:

- Task general-purpose("Use the `[skill-name]` skill to review this **plan**, not finished code. Apply all
  the dispatch instructions in the section above, including emitting `## Must Address` / `## Consider` /
  `## Looks Good` headings and the anchor/confidence bullet grammar. [same context block as the agent template]")

**User-typed reviewers** (an "Other" name from Adjust, not a built-in). First **dedup** the typed name
against the already-selected built-in set — if it resolves to a built-in already selected, do **not**
double-dispatch. Otherwise **resolve the name**:

1. **Normalize:** strip any leading `/` to get the bare name.
2. **Match against skills:** if the bare name (or a prefix-qualified variant like `namespace:bare-name`,
   or a `/bare-name` skill) appears in the system-reminder skills list → dispatch as a **skill-based
   reviewer** (template above).
3. **Match against agent types:** if the bare name matches the **suffix** of a registered
   `dev-workflow:<name>` ID (e.g. typing `security-reviewer` matches `dev-workflow:security-reviewer`) →
   dispatch as an **agent-based reviewer** using the full `dev-workflow:<name>` ID. If it matches a
   non-`dev-workflow:` registered agent type exactly, dispatch by that name.
4. **No match → custom review dimension:** dispatch as a `general-purpose` subagent (do **not** use the
   typed name as `subagent_type` — it is not a registered agent type):

- Task general-purpose("You are a reviewer specializing in **[user-typed name]**. Review this **plan, not
  finished code**, through that lens. Apply all the dispatch instructions in the section above, including
  emitting `## Must Address` / `## Consider` / `## Looks Good` headings and the anchor/confidence bullet
  grammar. [same context block]")

---

## Step 4: Consolidate & Present Findings

After all reviewers complete, the orchestrator runs an internal pipeline. Reviewers emit prose; the
orchestrator extracts records; the user sees re-rendered prose. **The user-visible output is prose. The
records are internal to consolidation.**

The pipeline operates as `parse → validate → group → merge → gate → render`: dedup happens **before** the
soft gate so corroboration can promote a finding past its floor (the `+25 per extra reviewer` math is what
makes the ordering matter).

**Severity rank** is the 2-rung plan-native ladder: **Must Address (2) > Consider (1)**. `Looks Good` is a
separate bucket, exempt from anchor/confidence/gate (mirrors review.md's Looks-Good carve-out).

### 4a. Parse each reviewer's raw return text

For each reviewer's return text, extract records using this grammar (permissive):

| Token | Rule |
|---|---|
| Native severity section | `^## ` followed by a recognised label (case-insensitive): `Must Address`, `Consider`, `Looks Good`. Trailing text after the label is allowed (`## Must Address (before implementation)` matches `Must Address`). |
| Foreign-ladder section | `^## ` followed by `Critical`, `High`, `Medium`, or `Low` — map `Critical/High → Must Address`, `Medium/Low → Consider`. This is a **compatibility alias** (a reviewer defaulting to code-review headings), not a legacy format to flag — Must Address / Consider **is** the native vocabulary here. |
| Bullet anchor | `^- \*\*<anchor>\*\*` where `<anchor>` is a section-heading text, a `U<n>` key, or an `AC<n>` key (see **Plan-Anchor & Confidence Grammar**). The first `**…**` on the line is the anchor; subsequent bold markers are body content. |
| Confidence marker | After the anchor, optional `\*\(confidence:\s*<N>\s*\)\*` (case-insensitive on `confidence`). |
| Em-dash separator | `—`, `–`, or `--`, optionally surrounded by whitespace. |
| Body | Everything after the separator until the next bullet (`^- \*\*`) or next heading (`^## `). Non-bullet, non-heading lines are body continuation of the parent bullet. |
| `None` token | A heading whose only content is the literal `None` (case-insensitive, possibly `_None_` / `*None*`) emits zero records under that heading. No warning. |
| `Looks Good` bullet | Format stays `- [Validated aspect]`. No anchor, no confidence. Record severity = `Looks Good`; skip anchor/confidence extraction. **Separate bucket — not a rung on the Must Address / Consider ladder.** Confidence floor does not apply; dedup does not cross `Looks Good` and other severities; merge/promotion math is irrelevant. |

Produce a list of records `(severity, anchor, confidence, body, reviewer_name)` per reviewer.

### 4b. Validate each record

For each non-`Looks Good` record, run these checks. Increment the named counter on failure.

| Check | Action on failure | Counter |
|---|---|---|
| Severity ∈ {Must Address, Consider} | Default to `Consider` | `coerced` (shared) |
| Anchor is parseable (a non-empty bold token) | Drop record | `dropped_no_anchor` |
| Anchor resolves in the plan (case-insensitive exact on a section heading / live `U<n>` / `AC<n>`, per the grammar) | Drop record | `dropped_off_plan` (record whether **not-found** or **struck**) |
| Confidence ∈ {0, 25, 50, 75, 100} | If numeric: snap to nearest anchor (ties go up). If non-numeric or missing: default to the section severity's floor (`Must Address → 50`, `Consider → 75`). | `snapped` or `confidence_default` |
| Body non-empty | Coerce body to `(no description)` | `coerced` (shared) |

The `coerced` counter is shared between severity-default and empty-body coercions — both signal "the
reviewer's output needed light salvaging." There is **no** `git ls-files` file-existence check (no diff,
no repo-file check) and **no** `off_diff` annotation — the anchor-resolution check replaces them.

**Anchor resolution runs against the plan snapshot** read in **Locate the Plan**, not the live file on
disk. This matters when Step 5 applies fixes that rename or strike headings: a single consolidation pass
validates against one stable snapshot, so a mid-session edit from a *prior* resolution round cannot
silently drop a later reviewer's anchors. (Re-validating against the post-edit plan is the Step 5 apply
concern, handled there.)

`Looks Good` records skip every check above. Two checks still run: an empty body is coerced to
`(no description)` and increments `coerced`; a `## Looks Good` heading whose only content is the literal
`None` token emits zero records, per §4a's `None` rule.

### 4c. Group records by normalized-anchor fingerprint

Group all non-`Looks Good` records by their **normalized anchor string** (the dedup fingerprint). A section
heading and a `U<n>` nested under it are **distinct** fingerprints (different granularity, different
anchor) — they do **not** merge. `Looks Good` records are grouped separately — they only merge among
themselves.

### 4d. Merge each group

For groups of size ≥ 2:

- **Severity** = `max(group)` using rank `Must Address (2) > Consider (1)`.
- **Confidence** = `max(c_i for i where c_i > 0) + 25 × (count(c_i > 0) − 1)`, capped at 100. The anchor
  step size is **25** (the gap between adjacent anchors in `{0, 25, 50, 75, 100}`). Reviewers with
  `c_i = 0` are excluded from both the `max(·)` and the count — a zero vote records the consideration in
  attribution but does not corroborate. Worked examples: two reviewers at 50/50 → `50 + 25 × 1 = 75`;
  three at 50/50/50 → `50 + 25 × 2 = 100`; two at 75/0 → `75 + 25 × 0 = 75` (the zero contributes nothing).
- **Body** = render the merged-finding template (see 4f). Keep every reviewer's bullet with attribution.

For groups of size 1, pass through with no attribution suffix — the single reviewer's identity is already
discoverable from the Coverage block.

### 4e. Apply soft gate

Compare each merged record's *merged confidence* against the *merged severity*'s floor:

| Merged severity | Confidence floor |
|---|---|
| Must Address | ≥ 50 |
| Consider | ≥ 75 |

The `Consider` floor is **higher** than `Must Address` on purpose: Consider findings are more often
speculative, so they need stronger corroboration to surface, while Must-Address findings should clear a
lower bar so genuinely high-stakes issues aren't gated away. (A reviewer that omits confidence defaults to
its section's floor in §4b — i.e. it is assumed to just meet the bar, not be silently suppressed.)

Below-floor records move to the `## Suppressed (low confidence)` bucket. Above-floor records render in the
main severity sections. `Looks Good` is exempt (no floor).

When a `Must Address` finding falls below its floor, increment `must_address_suppressed`. This counter is
surfaced in the consolidation header so high-stakes findings are not buried.

### 4f. Render

Render the consolidated output:

````markdown
## Plan Review Summary

Plan: <plan path>
Reviewers: <N> ran, <N> succeeded, <N> failed
Findings: <raw_count> raw → <displayed_count> after dedup
<conditional warning lines — see header template below>

### Must Address (before implementation)
- **<anchor>** *(confidence: <N>)* — <body or merged template>

### Consider (improve but not blocking)
- ...

### Looks Good
- <validated aspect>

### Suppressed (low confidence) — <K> findings

#### Must Address *(suppressed)*
- **<anchor>** *(confidence: <N>)* — <body>

#### Consider *(suppressed)*
- ...
````

(Heading levels: the suppressed bucket is an H3 / `###` peer of the main severity sections; its inner
severity sub-headings use H4 / `####`. Plain Markdown headings — no HTML — because this block renders
inline in the Claude Code terminal.)

```markdown
## Coverage

- Reviewers that ran: <list>
- Reviewers set aside (not dispatched): <list>
- Reviewers that failed: <list, if any>
```

The set-aside line preserves the never-hide guarantee post-consolidation: a reader can still see which of
the 7 built-ins ran versus were excluded, mirroring the pre-dispatch ledger.

**Surviving header warning lines** — each `⚠ ...` line is emitted only when its counter is ≥ 1, in the
order shown. (review.md's diff/ladder-specific counters — `legacy_format`, `mixed_format`, `off_diff`,
`dropped_file_not_in_repo` — are **not** carried here.)

```
⚠ <K> Must-Address findings suppressed by confidence gate — see Suppressed section
⚠ Defaults applied: <C> missing confidence (→ section floor: Must Address=50, Consider=75)
⚠ Snapped: <P> findings to nearest confidence anchor
⚠ Coerced: <X> findings (severity defaulted to Consider, or body coerced to "(no description)")
⚠ Dropped: <D> findings (no parseable anchor) + <N> not-found + <M> struck (anchor not in plan)
```

When `raw_count == displayed_count`, render `Findings: <count> (no overlap)` instead.

**Merged-finding template** — show `(own_severity, conf own_conf)` only when a reviewer's own severity OR
confidence differs from the merged values:

```markdown
- **<anchor>** *(confidence: <merged_conf>, merged from <K> reviewers)* — <highest-severity reviewer's one-sentence summary>
  - *<reviewer-1> (<own_severity>, conf <own_conf>):* <full body>   ← shown only when diverging from merged
  - *<reviewer-2>:* <full body>                                       ← own_severity AND own_conf match merged
```

For single-reviewer findings, pass through without attribution: `- **<anchor>** *(confidence: <N>)* — <body>`.

---

## Step 5: Apply Fixes

This is the plan-native resolution menu. It edits **only the plan `.md`** — it does **not** drag in
`/ba:review`'s auto-revert / bidirectional-reconciliation / baseline-test harness (there are no tests to
run on a plan `.md`).

Use **AskUserQuestion**:

**Question:** "How would you like to handle the findings?"

**Options:**
1. **Apply all fixes** — Update the plan with all main-section Must Address + Consider items
2. **Apply must-address only** — Fix only the blocking items
3. **Review one by one** — Go through each finding and decide
4. **Done** — Acknowledge findings, don't modify the plan

**Suppressed findings are excluded** from every apply option. The `## Suppressed (low confidence)` bucket
is surfaced for visibility only — "Apply all fixes" applies main-section Must Address + Consider findings
and **skips** anything in Suppressed. (A user who wants a suppressed finding addressed promotes it manually
or re-runs after corroboration.)

**Applier-facing protected artifacts.** The applier may edit the **content** of the plan (and of any file
under `docs/{brainstorms,plans,solutions,research,reviews}/` a finding targets), but must **never** apply a
finding that deletes, relocates, or renames them — consistent with the Step 3 reviewer-dispatch guard
(identity protected, contents not).

**Merged-finding classification.** When a merged finding has contributing findings of mixed class, treat
the merged finding as a **spec decision** if *any* contributor is a spec decision (the stricter, safer
classification) — route it through the spec-decision resolution below, never write it as an open question.

### Handling "Consider" items

Before writing any "Consider" fix into the plan, classify it:

**Implementation decision** — something the implementer can resolve with full context during execution (e.g., which utility to use, how to structure a helper). Write it into the plan as concrete guidance: a decision already made, not a question left open.

**Spec decision** — something that affects acceptance criteria, user-facing behaviour, scope, or requires stakeholder input (e.g., "should this error be dismissible?", "do we support X edge case?"). These must be resolved **before execution begins**.

For spec decisions, the valid resolutions are:
1. **Decide now** — answer the question, update the plan with the decision
2. **Iterate the plan** — flag it as a blocker, return to brainstorm/planning before executing

**Never write a spec decision into the plan as an open question.** An open question in a plan is a spec gap that will be silently decided during implementation, outside any review or planning process. If the answer is unknown, the plan is not ready to execute.

If applying fixes, edit the plan file directly, then confirm: "Plan updated at `[path]`."

### Caller-context-aware exit

**Every** terminal Step 5 path must return control to the caller — not just "Done" but also each apply
path ("Apply all fixes", "Apply must-address only") after its "Plan updated" confirmation, and the
one-by-one walk once the last finding is dispositioned. The exit target depends on how review-plan was
entered (the `--auto` token, read in **Invocation mode**):

- **Manual path** (no `--auto`) — the terminal path ends the command, as today.
- **Auto path** (`--auto` present, invoked from `/ba:plan` Step 7 per the **Auto-invoke contract** below) —
  the terminal path returns control to `plan.md` Step 7's handoff menu rather than ending. This is the
  mechanism that honors the contract's "→ proceed to the handoff menu". **Without this hook the auto path
  strands in resolution and never shows the handoff menu** — and it must hold for an apply-and-confirm exit
  just as much as for "Done", since the user may apply fixes without ever selecting "Done".

---

## Auto-invoke contract

review-plan **owns** this contract; `commands/ba/plan.md` Step 7 **cites** it. It defines how `/ba:plan`
invokes this engine in **auto mode** at the end of planning, and — critically — **how the verdict is
signaled back**. review-plan is invoked as a command, not a typed function, so the channel must be
explicit: two implementors would otherwise invent it differently.

**How auto mode is entered.** `/ba:plan` invokes `/ba:review-plan <plan-path> --auto`. The `--auto` token
(read in **Invocation mode**) is the only signal that distinguishes the two paths.

**Verdict signal.** An auto-mode pass ends by printing exactly **one** sentinel line:

- `[AUTO-SCORE: clean]` — the section-scoring judge (Step 1b) marked **no** section weak (empty `✓` set).
- `[AUTO-SCORE: weak — <reviewer list>]` — at least one reviewer was selected (non-empty `✓` set); the list
  names the selected reviewers.
- `[AUTO-SCORE: error — <reason>]` — the pass could not complete (plan unreadable, judge errored, dispatch
  failed). The sentinel is **always** printed, even on failure, so the caller never waits on a missing line.

`plan.md` Step 7 reads this line to pick its branch; it treats `error` (and any absent/malformed sentinel)
identically to `clean` — proceed to the handoff menu, never strand.

**Widget ownership.** review-plan **owns** every widget on the auto path end-to-end (the ledger and the
ask-before-dispatch confirm). `plan.md` only reads the sentinel and waits — it never presents review-plan's
ledger or confirm itself. This prevents a double-widget before dispatch.

**Flow (auto mode):**

1. Run the section-scoring judge (Step 1b) against the just-written plan.
2. **Clean (empty `✓`)** → emit **zero** widgets (the entry-point-conditional empty-`✓` invariant,
   auto-path branch); print `[AUTO-SCORE: clean]` followed by a one-line "**no weak sections**" status;
   return control to the caller.
3. **Weak (non-empty `✓`)** → print `[AUTO-SCORE: weak — <reviewer list>]`; surface the selection ledger
   (Step 2) and **ask before dispatching** (review-plan owns this confirm). On dispatch, run Step 3 → the
   Step 4 pipeline → Step 5 resolution, then return control to the caller via Step 5's
   **caller-context-aware exit** (which covers *every* Step 5 exit, not just "Done").
4. **Error** → print `[AUTO-SCORE: error — <reason>]` and return control to the caller.

A failed or empty auto-mode pass must **still** return control to the caller — never strand `/ba:plan`
without its handoff menu.

The **manual** path (no `--auto` token) and the auto path share this one engine but differ only at the
empty-`✓` edge: manual offers Adjust/Cancel; auto self-suppresses (above). Everything downstream of a
non-empty `✓` set is identical. (review-plan's status as the third never-hide mirror site is stated in
Step 1a; the `CLAUDE.md`/`README.md` edits recording it live in those files.)

---

## Important Guidelines

- **This reviews the plan, not code.** Don't dispatch tools that need actual source files to run.
- **Reviewer not found is not an error.** A typed "Other" reviewer that resolves to nothing falls back to a custom dimension. Report what was and wasn't covered.
- **Parallel execution.** Run independent reviewers concurrently to save time.
- **Plan-appropriate framing.** Always tell reviewers they're looking at a plan, not finished code.
