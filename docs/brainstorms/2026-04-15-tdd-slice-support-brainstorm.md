---
date: 2026-04-15
topic: tdd-slice-support
status: approved
triage_level: fast-track
tags: [ba:tdd, ba:slice, ba:execute]
---

# Add Slice Support to ba:tdd

## What We're Building
Mirror ba:execute's slice mechanics into ba:tdd so that sliced plans can be executed with either command interchangeably. A user should be able to run slice 1 with ba:execute and slice 2 with ba:tdd (or vice versa) on the same sliced plan. Also update ba:slice's completion menu to offer both execution modes.

## Key Decisions
- Mirror, don't abstract: copy ba:execute's slice patterns directly into ba:tdd rather than extracting shared infrastructure. Two self-contained commands are simpler than a shared slice library.
- Slice scopes behaviors, not just tasks: in ba:tdd, the slice marker range filters the behavior list (the TDD equivalent of ba:execute's task list).
- ba:slice offers execution mode choice: the "Start slice 1" option asks whether to use execute or tdd, rather than hardcoding ba:execute.
- Update the ba:execute note that says slice parsing is "specific to ba:execute" — it's now shared across execution commands.

## Acceptance Criteria
- ba:tdd accepts `--slice N` flag and scopes behavior extraction to the slice range
- ba:tdd detects sliced plans and prompts for slice selection when no `--slice` flag is given
- ba:tdd uses slice-specific branch naming (`-slice-N`)
- ba:tdd commit messages include `Slice: N/M` alongside the TDD cycle info
- ba:tdd has a slice completion flow (status table update, next-slice menu referencing ba:tdd)
- ba:slice offers both ba:execute and ba:tdd as execution options in Step 5
- plugin.json version bumped
- README.md updated to reflect ba:tdd slice support and ba:slice's dual execution options
- CLAUDE.md command descriptions stay consistent with the changes

## Convention Compliance
- plugin.json version bump: included in acceptance criteria
- README.md update: included in acceptance criteria
- CLAUDE.md update: included in acceptance criteria
