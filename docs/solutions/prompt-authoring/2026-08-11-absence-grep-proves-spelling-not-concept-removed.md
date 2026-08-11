---
date: 2026-08-11
category: prompt-authoring
problem: retiring a named token from prose and verifying it with `! grep -q '<full token>'` reports green while abbreviated and numeric references to the deleted machinery survive as dangling instructions
tags: [prompt-authoring, verification, false-green, token-retirement, dangling-reference, acceptance-criteria, fresh-reader-check]
module: skills/ba-propose/SKILL.md (Step 5e/5f); plan `Verify:` lines; skills/ba-plan/SKILL.md ("Verify: minting rules"); .claude/agent_docs/prompt-authoring.md (review flags)
symptom: `grep -n '<full token>'` found 8 sites, all 8 were edited, and `! grep -q '<full token>'` exited 0 — green — while the file still carried a 9th site spelling the token short (`` the four `5f:` trace lines ``) and naming the four deleted print sites. Nothing failed. It surfaced only when a dispatched subagent read the file end-to-end and reported the spec self-contradictory
---

# An absence grep proves one spelling is gone, not that the concept is

## Problem

A change to `skills/ba-propose/SKILL.md` retired a named trace token,
`5f: capture offer suppressed`. The sweep looked exhaustive and the verification passed, but the
file shipped describing machinery that no longer existed.

What the author saw, in order:

1. `grep -n '5f: capture offer suppressed' skills/ba-propose/SKILL.md` → **8 sites** (four
   `print("5f: capture offer suppressed — <reason>")` calls in a pseudo-code sketch, four prose
   sentences quoting the token).
2. All 8 edited.
3. `! grep -q '5f: capture offer suppressed' skills/ba-propose/SKILL.md` → **exit 0. Green.**

A 9th site survived:

> Every `print` in 5f — the four `5f:` trace lines (`ship-url-unresolved` and `non-interactive`
> above the `try`, `already-captured` and `judged-not-reusable` inside it) …

It specifies four prints that no longer exist, positioned relative to a `try` that no longer
exists — but spells the token **abbreviated**, as `` `5f:` ``, so the full-token grep could not
match it. A later check found a **10th** site in the same family: "each of the four SILENCE guards
below emits exactly one …". Neither contains the string that was grepped for.

In this repo that is not a stale comment. The product *is* prompt text, so a dangling reference is
a live instruction a future subagent will read and try to execute.

## Investigation

The grep felt sufficient for a specific and recurring reason: the token was *coined* for this
section, so it read as a unique identifier, and 8 hits is small enough to feel enumerable — you can
see them all at once, edit them all, and "did I get them all?" collapses into "did the grep return
zero afterward?". The token's uniqueness was doing double duty: it was both the thing being removed
and the search key for finding what referenced it.

The author had the file open in context throughout the edit and still missed it. Reading for "is my
edit correct" is a different pass from reading for "does anything else here still assume the old
shape", and the green grep had already answered the second question — wrongly.

Detection came from outside the sweep entirely. A dispatched subagent, handed the file and asked to
*execute* the spec against a fixture, reported the spec internally inconsistent and quoted the
surviving sentence back.

The failure was also **ratified by the plan**. The implementation plan minted an acceptance
criterion (AC5, "the retired token appears nowhere in `skills/`") whose `Verify:` line was exactly
`! grep -q '5f: capture offer suppressed' skills/...`. So the project's own verification step would
have gone green on a self-contradicting file. The author's blind spot was laundered into the
artifact and then satisfied.

## Root Cause

The assertion answered a narrower question than the one that mattered.

- **Asserted:** the byte sequence `5f: capture offer suppressed` does not appear in this file.
- **Cared about:** this file no longer *describes* the deleted mechanism.

The gap between them is every spelling of the reference that is not the canonical one:
abbreviations (`` `5f:` ``), partial quotes, paraphrase, bare cardinals ("the four trace lines"),
and — worst — descriptions that never name the token at all but specify its behavior ("above the
`try`"). A grep for the canonical literal is a **lower bound** on the reference set, and nothing
tells you how loose a bound it is. Uniqueness of a *string* says nothing about uniqueness of the
*ways prose can point at it*.

Second half: **prose has no compiler.** Delete a function in code and every call site becomes a
build error — the language's resolver enumerates the reference set for you, in all its spellings,
for free. Delete a mechanism from prose and the dangling references stay syntactically perfect.
The only enumerator is a search you wrote yourself, using the vocabulary you happened to think of.

A third, structural contributor: the edit was **surgical** across 8 scattered sites in a 153-line
section. Surgical editing puts the burden of completeness on the sweep, because anything the sweep
misses is by definition still there.

Note also what an absence-only assertion is satisfied by. `! grep -q '<literal>'` goes green if you
truncate the file, delete the wrong section, or delete the file entirely. It cannot distinguish
"assertion held" from "subject gone" — a distinction `scripts/check-invariants.mjs` already takes
seriously elsewhere (`load-site-mirror` reads UNKNOWN, not PASS, below two blocks; `rubric-mirror`
reads UNKNOWN when a mirror file has no `Task` block).

## Solution

Two changes, both general.

**1. Replace the region wholesale instead of editing N scattered sites.** The real fix rewrote the
whole section — 153 lines down to 69 — rather than surgically removing 8 tokens. That is a
*structural* guarantee, not diligence: a stranded reference is a **survival phenomenon**, requiring
text you never read to persist across the edit. Wholesale replacement makes persistence impossible,
because every surviving line was authored against the new design. It is also what silently removed
the 10th site nobody had found yet.

**2. Assert a surviving positive invariant plus ordering, not only absence.** The strengthened
`Verify:` line that shipped:

```bash
grep -q 'capture: {decision}' skills/ba-propose/SKILL.md \
  && ! grep -q '5f: capture offer suppressed' skills/ba-propose/SKILL.md \
  && ! grep -q 'gates on its own predicate' skills/ba-propose/SKILL.md \
  && awk '/capture: \{decision\}/{r=NR} /Document this learning/{p=NR} END{exit !(r && p && r < p)}' \
       skills/ba-propose/SKILL.md
```

The `awk` clause does work no absence-grep can do: it asserts the new receipt line appears
**before** the offer prompt. That is a relational property of the new design, and text stranded
from the old design cannot satisfy it — either the anchor is missing or it is in the wrong place.
An absence-grep is satisfied by a file that says nothing; a positive invariant is only satisfied by
a file that says the right thing.

### The general recipe for retiring a named thing from prose

- **Assert what replaced it,** not only that it is gone — at least one `grep -q` for a token that
  exists only in the new design.
- **Assert an ordering or containment relation** between two new anchors. Ordering is the cheapest
  structural property to check and the hardest to satisfy accidentally.
- **Keep the absence-greps, but plural** — the canonical literal *and* every distinctive phrase
  from the old prose.
- **Sweep with a pattern list, not one token.** This is what actually produced confidence here,
  and every count is expected to be `0`:

  ```bash
  for pat in 'gates on its own predicate' 'required terminal step' 'try` boundary is unchanged' \
             'microseconds earlier' 'Print failure model' 'infallible' \
             'Silence preconditions' 'correct silence'; do
    printf '%-40s ' "$pat"; grep -c "$pat" skills/ba-propose/SKILL.md
  done
  ```

  Build the list by reading the **deleted text** for its distinctive vocabulary — coined phrases,
  abbreviations, structural landmarks like `try` — not by reasoning forward from the token name.

- **Grep bare cardinals in the touched file.** Prose numerals are co-references that share no
  characters with the token, which is exactly how the 9th site hid. Verified against the
  pre-change revision, this finds it:

  ```bash
  git show origin/main:skills/ba-propose/SKILL.md | grep -niE '\bfour\b'
  ```

  On the real file that returned 4 hits: the 9th site, the 10th site, and two unrelated
  "four-way decision" mentions. A ~50% false-positive rate on a 4-hit list is a trivial eyeball
  cost and it is the only tactic here that would have caught the miss at sweep time.

  Do **not** reach for a cleverer regex. A narrower numeral-plus-noun pattern was tried against
  this same file and returned **zero** hits — precision bought nothing and cost the finding.

## Prevention

**Phrase the criterion over what survives.** `ba-plan`'s minting rule (d) already requires a
`Verify:` to assert wiring for an addition; the deletion-shaped corollary is that **the retired
token must not be the subject of the assertion at all.** If the retired string appears in your
`Verify:` line and nothing else does, the check is almost certainly wrong.

**Rehearse falsifiability in the deletion flavour.** `ba-plan` already asks "what broken-but-
plausible state would still pass?". For a retirement unit the answer is always the same and belongs
in the plan verbatim: *"the section is gone, and a neighbouring sentence still refers to it in
abbreviated form or by count."* Then name which check fails under that state. If the answer is
"none", the `Verify:` is not done.

**Decide surgical vs wholesale at plan time, by premise.** Surgical when the section's organizing
premise survives and you are changing a leaf fact. Wholesale when the change invalidates the
premise the section is *organized around*. The readable tell: **if removing a token requires
touching most paragraphs of a section, you are already paying replacement's cost without buying its
safety.** Count grep hits per section — many hits get rewritten, one gets edited.

Wholesale replacement's own cost, and where it bites in this repo: it discards machine-boundary
literals — sentinels, exact anchors, byte-identical mirrored load-site blocks. Extract the contract
literals from the old section into an explicit list and re-assert each in the new one. It is
cheapest where CI pins those literals (`sentinels`, `rubric-mirror`, `load-site-mirror` catch a
dropped one) and most dangerous where it does not — `CLAUDE.md`'s hand-maintained U-ID / stack-base
grid, the reviewer counts, the `**Code-shape decision:**` label.

**The fresh-reader check.** Hand a subagent **only the post-change file** — not the diff, not the
plan, not the retired token's name — and ask it to inventory rather than approve:

> Read this file. List every mechanism, step, or value it says exists. For each, cite the line that
> mentions it and the line that defines it. Then list anything mentioned but never defined, and any
> count or enumeration you cannot verify from the file itself.

Why it worked, precisely: the author reads "the four `5f:` trace lines" and their own memory
silently supplies the referent, so the sentence parses as true — the check degenerates into
confirming an expectation. A reader with no memory of the intended change **has no referent to
supply**, so the same sentence surfaces as an unanswerable question. The asymmetry is *absence of
expectation*, not superior care. Which means the technique **fails the moment you brief the
reader**: telling it "I retired X, check for leftovers" restores the expectation and converts the
fresh reader into a grep with extra steps.

Limits, plainly: it is nondeterministic, unrepeatable, and not a regression detector — it catches
this instance and prevents nothing next time. It confabulates, so treat its output as questions to
adjudicate against the file, not findings. And it only sees the file boundary you give it; a
reference stranded in `README.md` is invisible to a reader handed one `SKILL.md`.

**Review the acceptance criterion, not only the change.** In `/ba-review-plan`, treat a `Verify:`
line whose assertion is the *absence* of a string as a finding by default, with one exception: a
machine-boundary literal that CI can also blocklist. Otherwise demand a positive-invariant
restatement. A related failure from the same run reinforces this: the plan's pre-committed A/B
decision rule was also unsatisfiable as written, because it required a signal on all four fixtures
while one fixture's ground truth was that signal's *absence*. Plan-time criteria get the same
scrutiny as the change — the author's blind spot propagates into them.

**What CI cannot pin here.** A general dangling-reference check for prose cannot exist: it would
need the set of live mechanisms in machine-readable form, and that set has no source of truth — it
*is* the prose. No regex distinguishes "the four `5f:` trace lines" written while the machinery
lived from the same sentence after it died. Do not plan one. Specifically, adding the retired token
to a blocklist would be the same presence-only grep this repo already classifies as a false-green,
merely negated — and it would still have missed the 9th site, which never contained the literal.

`scripts/check-invariants.mjs` already carries `retired-invocations`, a blocklist for a retired
spelling. Extend it only when the retired token is a **machine-boundary literal** with a single
canonical spelling that two processes had to agree on, and only as a **ratchet against
reintroduction** — never as the acceptance criterion for the removal.

**Design rule for any new check:** if the check's subject can be deleted, the check must report
three states — held / violated / subject-absent. Every `! grep -q` collapses the third into the
first.

**What generalizes past prompt repos** (any prose-as-product — docs, specs, config templates,
migration guides, runbooks): positive-invariant verification over absence; cardinal-numeral sweeps;
premise-death as the trigger for wholesale replacement; the fresh-reader check and the rule that
briefing destroys it; harvesting the referent set from the pre-change revision; three-state checks;
and reviewing the acceptance criterion. Specific to this repo: the `retired-invocations` ratchet,
the unpinned mirror obligations that make wholesale replacement riskier than the CI-pinned literals
suggest, and the fact that subagent dispatch is nearly free here — which is what makes the
fresh-reader check a default rather than a luxury.

## Related Documentation

The absence direction is new; two siblings cover the **presence** direction, where a variant
spelling is the thing to fail on rather than a thing a check can miss.

- [`2026-08-09-per-dispatch-block-ci-catches-template-drift.md`](2026-08-09-per-dispatch-block-ci-catches-template-drift.md)
  — **same failure family, closest match.** A `rubric-mirror` check named the right literal in the
  right file and still passed, because a per-file existence test over a literal that legitimately
  appears N times is satisfied by whichever copy is still correct. That is the presence-direction
  twin of this entry's defect, and its "a prose claim is unpinned by default" rule is what this
  entry inverts into "a claim of *removal* is unpinned by default."
- [`2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md`](2026-08-08-hoisted-text-invisible-to-dispatched-subagents.md)
  — near-sibling, and the prior art on removal-shaped acceptance criteria: *"Any AC phrased as 'X
  does not appear in Y' invites the implementation that deletes X and stops."* It reasons about the
  risk that **too much** got deleted; this entry is the complement, where too little did and the
  check could not tell. Also owns the "loose locator, byte-exact assertion" pattern.
- [`2026-07-31-probe-instrument-validation-false-zeros.md`](2026-07-31-probe-instrument-validation-false-zeros.md)
  — same family at the methodology level. Its governing rule generalizes this entry's specific
  lesson: *before trusting any zero, prove the instrument can produce a non-zero.* The green
  `! grep -q` was never shown capable of failing on the surviving spelling.
- [`2026-08-02-path-heuristics-misread-prompt-repo-filenames.md`](2026-08-02-path-heuristics-misread-prompt-repo-filenames.md)
  — adjacent, two concrete hooks: the nearest prior art for CI-pinning a literal token list in this
  repo (including an inverse arm that FAILs when *zero* paths match — the missing guard shape for a
  removal grep), and the only other entry whose module is `skills/ba-propose/SKILL.md`.
- [`2026-07-31-global-instructions-replace-the-step-under-test.md`](2026-07-31-global-instructions-replace-the-step-under-test.md)
  — adjacent; source of the idiom *"the absence is quiet."* This entry extends it: a token that did
  not get deleted is quiet too, if you only asked about one of its spellings.
