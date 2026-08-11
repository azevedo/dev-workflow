# Authoring and changing prompt surface

This repo's product *is* prompt text — `skills/ba-*/SKILL.md`, `agents/*.md`, `references/*.md`. Every
line ships into someone's context window on every invocation. These are the two rules that govern
adding to it and the method that governs changing it.

## The trust gradient

Before adding a rule, decide which kind it is.

- **A machine-boundary contract** binds two processes that must agree: a sentinel string, a parser
  grammar, an anchor format, a path or ordering invariant, a temp-file lifetime. Specify these to
  the character. Re-derivation from prose plausibly produces a *different, wrong* structure, and
  the failure is silent.
- **Steering for the model's own judgment** is everything else. State the goal and stop. Rules that
  spell out mechanics a capable model already performs — menu layouts, counting procedures,
  threshold arithmetic standing in for a qualitative call — cost tokens, crowd out the instructions
  that matter, and get followed literally when they are subtly wrong.

Only the first kind earns literal specification. The second earns a sentence.

This distinction outlives any one model generation, which is why it is written as a category test
rather than as a list of what the current model does and doesn't need.

## Weight is a first-class cost

A command body loads in full on every invocation, whether or not a given branch runs. Material that
only matters in one branch belongs in `references/`, loaded at a named load site — the pattern
`references/html-rendering.md` establishes and `ba-plan` / `ba-brainstorm` consume.

Two habits that quietly add weight with no reader: duplicating a rule across a command body, an
agent file, and `CLAUDE.md` "for safety"; and leaving authoring residue in shipped prose — review-fix
parentheticals, rejected-alternative notes, checklists from the plan that produced the change. None
of that addresses the model. It competes with the text that does.

## Reviewing a prompt change

A diff touching `skills/ba-*/SKILL.md`, `agents/*.md`, or `references/*.md` changes runtime behavior,
not documentation. Read the whole changed file, not just the hunks — weight and duplication are
properties of the file, and a hunk can look fine while pushing an already-heavy command past what
its job needs.

Flag:

- **Over-specification** — mechanics where intent would do: packing algorithms, counting
  procedures, threshold arithmetic standing in for a qualitative call, prescribed wording for
  output the model composes.
- **Unreachable weight** — material in a command body that only one branch reaches, where a named
  load site in `references/` would do. Say roughly how many lines load unconditionally.
- **Defensive duplication** — a rule copied across a command body, an agent file, and `CLAUDE.md`
  "for safety". Distinguish this from a mirror-site obligation the repo has committed to; for those,
  flag the opposite — a convention change that misses one of its sites.
- **Authoring residue** — review-fix parentheticals, rejected-alternative rationale,
  residual-limitation notes, plan checklists. Anything speaking to the repo's history rather than to
  the model executing the text.
- **Same-turn self-verification** — a step that checks or scores an artifact the same run just
  produced, especially via a subagent. Reviewing work from a *prior* session is a product feature,
  not a finding.
- **Unevaluable conditions** — a branch predicated on state with no defined way to detect it. Reads
  as specified behavior; is dead.
- **Verification that only proves the text exists** — a `Verify:` line grepping for prose the same
  change just wrote confirms authorship, not behavior. `skills/ba-plan/SKILL.md`'s own `Verify:` minting
  rules already classify presence-only greps as false-greens.

Do not flag: machine-boundary contracts specified exactly — that precision is correct, and the
finding is when a change *loosens* one. Nor length as such; a long section that is all load-bearing
is fine, a short one that over-steers is not.

When a rule's necessity is genuinely uncertain, name the A/B that would settle it rather than
asserting a verdict. An untested claim about how a model behaves is the same mistake this checklist
exists to catch.

## Deciding a prompt change: fixture A/B

There is no automated suite for prose command files, and a running session executes the body it
loaded at start — so a prompt change cannot be dry-run in the session that wrote it. Reasoning about
what a prompt "should" do is not evidence. Run the change instead:

1. **Fixtures.** Three or so origins with *known ground truth* — you write them, so you know exactly
   which requirements exist. Plant the failure you are trying to prevent: a compound requirement, a
   costly half that is tempting to drop, a deliberately thin origin.
2. **Conditions.** At minimum: current `main`, and the proposed change. Add a cheap third arm when
   one exists — often a single paragraph that might achieve the same thing as a large mechanism.
3. **Run.** One subagent per fixture × condition, at the session model, each given only the
   specification excerpt and the origin, returning a compact structured block. No repo access:
   variance in what a subagent chooses to read is noise you do not want.
4. **Score.** Count what the change is *supposed* to fix, and count what it might cost — items
   surfaced to the user, criteria minted, requirements dropped. Both directions matter; a mechanism
   that fixes its target while suppressing a behavior you rely on is not a win.

Nine runs is roughly ten minutes. It is the only real evidence available here, and it has already
overturned a static review — see `docs/research/2026-07-26-opus5-context-engineering-fit-research.md`
for the assessment that motivated these rules and the run that tested one of them.

## Where a reference file lives, and how it is cited

`CLAUDE.md` carries the operative rule — placement by shareability, and the three citation forms.
This section carries the reasoning behind it, so the always-resident copy stays short. Read this
when adding a reference file, changing where one lives, or giving one a second consumer.

**Why shareability decides placement.** A repo-root `references/` file can be read by both a skill
and an agent; a skill-local one cannot. `agents/convention-checker.md` reads `plan-sections.md` and
`brainstorm-sections.md`, and `html-rendering.md` is cited from every skill that renders HTML — a
skill-local copy of any of those would have to be duplicated, which `html-rendering.md`'s own
single-source rule forbids. Single-consumer files carry none of that, so they sit next to the one
body that reads them and cost nothing to the rest.

**Why the three spellings differ.** One mechanism explains all of it: **a skill resolves bundled
paths relative to its own `SKILL.md`.** So a bare `references/<file>.md` in a skill body resolves
inside `skills/<name>/` — which is exactly right for a skill-local reference and exactly wrong for a
repo-root one, hence `${CLAUDE_PLUGIN_ROOT}/` for the latter. An agent is not a skill and does not
get that rebasing, so `agents/convention-checker.md` cites the root bare. Three forms, one rule,
each correct for its reader — which is why normalising them to one spelling breaks two of the three.

**Evidentiary footing, and its limit.** Bare-relative skill-local resolution was proven at runtime
by a three-arm probe (see `docs/plans/2026-08-08-refactor-prompt-surface-shrink-slice-2-plan.md`):
the file resolves to the skill-local path when its branch is taken, is not read when it is not, and
a missing file degrades to skip-and-continue rather than an improvised path. That probe ran under
`claude --plugin-dir`, where plugin-root and cwd coincide — the least discriminating configuration
available. **The result is verified for a working-tree plugin and unverified for an installed one.**
Read a first installed-plugin resolution failure as this claim breaking, not as a bug in the citing
skill. There is also no regression detector: nothing re-verifies on future invocations that the read
still happens, so re-run the probe on any model bump that changes the consuming skill's behavior.

**Promoting a skill-local reference to the root.** Placement follows consumer count, and consumer
count changes. Before adding a second consumer, enumerate the citers with
`grep -rn "references/<basename>" skills/ agents/`. Promotion is a file move **plus** a re-spelling
of every citation into its own reader's form; miss one and it fails only at runtime.

**A duplicated instruction is a contract, and this one is pinned.** When the same sentence must
appear at more than one site — as the `--persist` load site does in `skills/ba-review/SKILL.md` —
the copies are a machine-boundary contract, not prose, and an occurrence count cannot enforce them:
counting one substring's occurrences is unchanged by a divergence anywhere else in the block. The
`load-site-mirror` check extracts every block from its anchor to the next blank line and compares
them byte-for-byte, reporting `file:line` on the diverging copy. Fewer than two blocks is UNKNOWN,
not PASS — one copy left after a deletion must not read the same as two that agree.

**What CI does and does not pin here.** `scripts/check-invariants.mjs`'s `references` check walks the
**top-level** `references/` directory only, so a skill-local reference gets no cited-at-least-once
coverage at all — an orphaned one ships silently. Its needle also matches the bare and the
`${CLAUDE_PLUGIN_ROOT}`-anchored spellings alike, so a promotion that moves the file without
re-spelling its citers passes CI green. Both gaps are known and hand-maintained, not enforced.

## Shipping: one bump, and how to read a local `version-bump` FAIL

A ship gets **one** bump of `version` in `.claude-plugin/plugin.json`, however many commits it spans.
The version is the plugin's autoupdate cache key, so a second bump added mid-branch doesn't produce a
tidier history — it burns a version number that was never published, and consumers skip it.

That collides with how the `version-bump` check reads history. It compares `HEAD~1..HEAD` — exactly one
commit. On a branch, `HEAD~1` is the previous *branch* commit, so **every** prompt-surface commit except
the one that happens to carry the bump reads `FAIL: version unchanged while skills/, agents/,
references/ changed`. A branch that bumps in its third commit and touches `skills/` in its fifth will
fail locally at the fifth, while being perfectly correct.

In CI the same comparison means something different. On `pull_request`, GitHub checks out an ephemeral
merge commit whose first parent is the base branch tip, so `HEAD~1..HEAD` spans the PR's **cumulative**
diff — where the single bump sits alongside every prompt-surface change it covers, and the check passes.
(This is why `.github/workflows/invariants.yml` pins `fetch-depth: 0` and says not to shallow it.)

So a local FAIL at a branch HEAD is expected output, not a defect to fix, and **never** a reason to add
a bump. Confirm before acting: compare the branch's cumulative diff against its base and check whether
*that* range carries a bump. Only a whole PR that touches `skills/`, `agents/`, or `references/` with no
bump anywhere in it is the failure this check exists to catch.
