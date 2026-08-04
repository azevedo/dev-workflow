---
date: 2026-08-02
category: prompt-authoring
problem: /ba-propose Step 2 path-pattern heuristics infer a file's runtime role from its filename, and invert in a prompt repo — shipping "Proof: pending" on a diff with passing tests and "Risk: high — touches security" on a prompt-only refactor
tags: [ba-propose, pr-body, path-heuristics, false-facts, proof-detection, risk-classification, silent-failure, prompt-authoring]
module: skills/ba-propose/SKILL.md
symptom: Composed PR body rendered "Proof: pending — add tests / QA notes / screenshots before merge" although 7 new cases passed in scripts/selfcheck-invariants.mjs, and would have rendered "Risk: high" because agents/security-reviewer.md word-boundary-matched the `security` sensitive-path class. No error, no warning.
---

# Path-pattern heuristics misread a prompt repo's filenames

## Problem

`/ba-propose` composes a PR body from facts materialized by deterministic "gather" sub-steps in
its Step 2. Two of those sub-steps classify files by path-name pattern. On a single real run,
both misclassified this repo — each producing a reviewer-facing statement that was not merely
unhelpful but **false**.

Neither failure raises an error or changes an exit code. The PR body simply states something
untrue. They were caught only because the composed preview was read against known facts before
publishing.

## Investigation

**Misfire 1 — Step 2e (Proof detection).** `proof = automated` requires a file with `A`/`M`
status matching one of:

```
*_test.*
*.test.*
*_spec.*
*.spec.*
test_*.*
<any path under a test/ | tests/ | spec/ | __tests__/ segment>
```

This repo's entire automated harness is `scripts/selfcheck-invariants.mjs`, run as
`node scripts/selfcheck-invariants.mjs`. It matches no glob in that list, so detection fell
through to the terminal `pending` branch and rendered:

`**Proof:** _pending — add tests / QA notes / screenshots before merge_`

— on a diff that *added 7 new test cases*, bringing the harness to 41, all green.

**Misfire 2 — Step 2g (sensitive-path classification).** `sensitive_paths_touched` matches class
words on a path-segment / word boundary, explicitly not as a substring; the spec even carries a
false-positive carve-out ("so `AuthorList.tsx` does not match `auth`"). The `security` class is:

```
crypto
secret
permission
acl
security
```

The diff touched `agents/security-reviewer.md`. `security` matches cleanly on the hyphen word
boundary — and the carve-out does not rescue it, because this is not a substring accident: the
file is genuinely *named* `security`. Downstream, Step 2h's risk table is first-match-wins with
the top row `high` when `breaking_signal` is true **or** `sensitive_paths_touched` is non-empty.
So a prompt de-duplication refactor would have been announced to reviewers as `Risk: high`.

Both are single-run observations, but neither is diff-specific: the harness filename and the
reviewer-agent filenames are permanent fixtures of the repo, so any future diff touching either
reproduces the same output.

## Root Cause

Both heuristics infer a file's **runtime role** from its **name**, resting on a convention that
holds in application repos: *a file named for a domain is code that implements or touches that
domain.*

This repo's product is prompt text. Its filenames describe a **review role** or an **authoring
role**, not a runtime surface:

- `agents/security-reviewer.md` is an agent prompt that *reviews for* security. It touches no
  auth, no crypto, no secrets. It is the *reader* of security-sensitive code, never the subject.
- `scripts/selfcheck-invariants.mjs` *is* the test harness. It is named for what it checks (repo
  invariants) rather than for being a test, because it is the runner and not a case file.

The inference inverts in both directions at once: the file named for a sensitive domain is the
least sensitive kind of file in the repo, and the file that constitutes the test evidence carries
no test-shaped name. Nothing about the matching logic is buggy — the globs and word-boundary
rules do exactly what they say. The failure is the unstated premise underneath them.

A prompt-authoring repo is adversarial input to its own path classifiers: its filenames are drawn
from the same vocabulary those classifiers hunt for.

## Solution

### Applied workaround (this run only — not a code change)

Both classifications were overridden, and the override was **disclosed with its reasoning in the
same message, before composing** — not applied silently. Silent deviation was rejected: these
rules are machine-boundary spec text, and quietly diverging from them is the drift the repo
guards against. Applying the spec literally was also rejected: it is deterministic and spec'd,
but it would have put two false statements in front of a reviewer.

| Fact | Spec value | Overridden to | Why |
|---|---|---|---|
| `proof` | `pending`, no pointer | `automated`, pointer `scripts/selfcheck-invariants.mjs` | 7 cases added, 41 total, all green — "pending" is false |
| `sensitive_paths_touched` | `{security}` | empty | `agents/security-reviewer.md` is a reviewer prompt, not a security surface |
| `risk` (derived) | `high` via 2h row 1 | `medium` | With 2g empty, the size row matched: 18 files changed > 10 threshold |

**The line drawn:** override only where the heuristic yields a statement that is *false*, never
where it is merely *less helpful*. On the same run Step 2i returned `focus_areas = ()`, which
suppressed the `## Where to look` section entirely. That was **left as spec'd** — an omitted
section is unhelpful, not untrue, and does not clear the bar for deviating.

### Proposed permanent fix — identified, NOT landed

No change to `skills/ba-propose/SKILL.md` has been made. The override above is the only thing
that has actually happened.

One unit, two edits:

1. **Widen Step 2e's test-file globs** so this repo's harness is recognised — e.g. admitting
   `scripts/selfcheck-*.mjs` alongside the existing patterns.
2. **Narrow Step 2g's `security` class** so a filename naming a *review role* is not read as a
   *runtime security surface*.

**Acceptance:** a `/ba-propose` run over a diff touching both `agents/security-reviewer.md` and
`scripts/selfcheck-invariants.mjs` renders `Proof: automated` and `Risk: medium`, with no manual
override and no disclosure paragraph.

Both edits are machine-boundary contracts (glob lists and class-word lists), so both get
specified to the character rather than steered — and the change is decided by fixture A/B on a
real diff, not by argument.

## Prevention

- **The authoring rule, stated generally:** *a filename is evidence of a file's subject, not of
  its runtime role.* Before writing a path-pattern heuristic into a spec, ask what the pattern is
  a proxy for, then check whether the repo has files that discuss that subject without performing
  it — review agents, linters, checkers, fixtures, docs and prompt specs all name the thing they
  act *on*. Where such files exist, key on structural position (the directory a runner actually
  reads, a manifest entry, a declared script) rather than the name.
- **Word-boundary matching is not the guard you think it is.** It solves accidental substrings
  (`AuthorList.tsx` / `auth`) and does nothing for a file genuinely named after the domain it
  reviews. A carve-out written against the substring case will read as if the class is already
  defended.
- **Render the basis, not just the verdict.** A path-derived fact should carry the matched path
  and matched token, and the preview should show them inline
  (`Risk: high — security (matched \`security\` in \`agents/security-reviewer.md\`)`). A false
  claim then reads as obviously false at a glance rather than as a bare adjective.
- **Absent evidence is not negative evidence.** `proof` has no way to say *I could not tell*; it
  collapses "no tests exist" and "the detector's conventions don't apply here" into the same
  accusatory `pending — add tests before merge`. A third value mirroring the repo's existing
  PASS/FAIL/UNKNOWN discipline would separate them.
- **Candidate check (not built):** a `path-heuristic-selfmatch` invariant that parses the literal
  token lists out of Steps 2e/2g, globs the repo's own tracked paths, and FAILs on any repo path
  matching a class token without an exemption entry — plus the inverse arm, FAILing when *zero*
  repo paths match the test globs (inert globs). Today it would fire on
  `agents/security-reviewer.md` and would have caught the harness gap from the other direction.
- **Overrides are legitimate; unrecorded ones are not.** An override belongs as a named entry
  co-located with the token list it exempts (`path`, `class`, one-line why), so a future token
  addition is reviewed against it in the same diff. An override that lives only in someone's head
  reappears as the same false claim on the next run.

## Related Documentation

All three existing entries are about instrument failure in *experiments*; this one is instrument
failure in *production* — a shipped skill misreading the repo it runs in.

- `docs/solutions/prompt-authoring/2026-07-31-probe-instrument-validation-false-zeros.md` — the
  canonical false-zero entry. Misfire 1 is exactly that shape: `proof: pending` is a false zero
  from a detector that structurally *cannot* return non-zero on this repo. Its rule transfers
  directly — before trusting any zero, prove the instrument can produce a non-zero.
- `docs/solutions/prompt-authoring/2026-07-28-fixture-ab-subagent-claude-md-inheritance.md` — its
  second confound (a broad classifier firing on surface text rather than the thing it means to
  detect) is the closest existing analogue to misfire 2. Its corrective — attribute a verdict to
  a specific source, or treat it as inconclusive — is what a sensitive-path classifier needs.
- `docs/solutions/prompt-authoring/2026-07-31-global-instructions-replace-the-step-under-test.md`
  — shares the "the absence is quiet" theme: a step that did not run emits nothing, exactly how a
  non-matching glob reports as `pending` rather than "detector found nothing to look at."
