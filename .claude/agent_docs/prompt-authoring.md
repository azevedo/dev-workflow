# Authoring and changing prompt surface

This repo's product *is* prompt text — `commands/ba/*.md`, `agents/*.md`, `references/*.md`. Every
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
`references/html-rendering.md` establishes and `plan.md` / `brainstorm.md` consume.

Two habits that quietly add weight with no reader: duplicating a rule across a command body, an
agent file, and `CLAUDE.md` "for safety"; and leaving authoring residue in shipped prose — review-fix
parentheticals, rejected-alternative notes, checklists from the plan that produced the change. None
of that addresses the model. It competes with the text that does.

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
