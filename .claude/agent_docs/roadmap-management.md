# Roadmap & product-management

How dev-workflow decides and tracks what to build. The roadmap lives in **GitHub issues**, not in a doc.

## The hub

Issue **#29 (`[meta] dev-workflow roadmap`)** is the living map — and the answer to "where do I start?". Read it, not the raw issue list: it groups open work by readiness, sequences dependencies, and records *why* deferred/declined items are parked. Keep it current as items move.

## Conventions

- **`[roadmap]` title prefix** on roadmap items.
- **`cluster:*` lanes** — `autonomy` / `polish` / `review-quality` / `infra`. Filter the issue list by a cluster to slice the map.
- **State labels** — `ready` / `deferred` / `declined` / `needs-brainstorm`.
- **Deferred/declined carry a documented revisit trigger** ("revisit when X") — a triaged decision, not a silent drop.
- **Dependencies** live in the body ("Blocked by #N") and are sequenced in #29 (GitHub has no native blocked-by without Projects).

## The flow

idea → `needs-brainstorm` → `/ba:brainstorm` → `/ba:plan` → build → close, updating #29 as items move. A shipped item moves to #29's "Recently resolved".

## Evidence, not competing roadmaps

Research and comparison artifacts (e.g. files under `docs/research/`) are **linked from issues as evidence/rationale** — never spun into a parallel roadmap doc. One home (issues + #29). This convergence discipline is what keeps the roadmap from diverging across artifacts; it's the rule that turns "endless divergence" into a single tracked map.

## README

README's "Roadmap" section is a **pointer to #29**, not a second list — keep it a pointer.
