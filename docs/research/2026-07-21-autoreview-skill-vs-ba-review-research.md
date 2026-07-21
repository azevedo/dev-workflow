---
date: 2026-07-21T00:00:00Z
researcher: Claude
git_commit: 579f12b2a55baad138f19baea7ee2b006e22f6f6
branch: claude/autoreview-skill-analysis-auskdb
repository: dev-workflow
topic: "Analysis of openclaw/agent-skills autoreview SKILL.md and comparison vs /ba:review"
tags: [research, code-review, ba-review, autoreview, external-comparison, reviewer-architecture, scope-governance]
status: complete
last_updated: 2026-07-21
---

# autoreview (openclaw/agent-skills) — full analysis + comparison vs `/ba:review`

Source: `https://github.com/openclaw/agent-skills/blob/main/skills/autoreview/SKILL.md`
(frontmatter: `name: autoreview`, `description: "Pre-commit/ship code review: Codex default; optional Claude or Pi."`)

## 1. What autoreview is (mental model)

autoreview is a **closeout gate**: a thin markdown skill that instructs the agent to shell out to a bundled binary (`scripts/autoreview`) which freezes a diff into a validated *bundle*, sends it to **one external review model** (Codex by default, optionally Claude or Pi), validates the structured findings, and exits 0/nonzero. The skill's prose is almost entirely **operator discipline** wrapped around that binary — how to pick a target, how to keep the review in scope, when *not* to review, how to treat findings, and how to keep the reviewer sandboxed from the code it reviews.

Two lines fix its philosophy:

- *"Treat review output as advisory. Never blindly apply it. Verify every finding by reading the real code path and adjacent files."*
- *"Autoreview is a closeout gate, not permission to rewrite the task."*

It is explicitly **not** an approval-routing system ("This is code review, not Guardian `auto_review` approval routing") and it explicitly pairs itself with a separate `behavior-validator` skill because autoreview is *source-aware and source-only* — "A clean autoreview is not proof that a UI, CLI, API, or generated artifact works from the user's perspective."

## 2. Full section inventory

| Section | Purpose |
|---|---|
| **Header / Use when** | Codex default (`gpt-5.6-sol` high, retry `gpt-5.6-terra` only on account access failure); triggers; **prose/SKILL.md-only diffs are exempt** (but not user-facing docs, examples, config, scripts, generated files, behavior). |
| **Contract** | ~25 bullets of reviewer discipline — advisory findings, verify every finding, reject speculative/broad fixes, fix the scoped bug class, security must not cripple function, TruffleHog pre-scan, credential/proxy stripping, regression-provenance roles, heartbeat patience (up to 30 min), don't re-enter nested reviewers, "do not push just to review." |
| **Scope Governor** | Freeze a scope baseline; classify each finding **in-scope blocker / follow-up / stop-and-escalate**; hard stop triggers (2× diff growth, two non-converging cycles, "define the canonical contract first"); keep exploratory fixes local until proven in scope. |
| **Release Branches** | Freeze discipline: only release blockers/backports/data-loss/crash/security; no new behavior; follow-ups go to `main`. |
| **Skill Path** | Set `$AUTOREVIEW` / `$AUTOREVIEW_HARNESS` once (project-local, source checkout, or global; POSIX + PowerShell variants). |
| **Pick Target** | `--mode local` (alias `uncommitted`), `--mode branch --base origin/main`, `--mode commit --commit HEAD`; repo-relative `--prompt-file` / `--dataset`. |
| **Oversized Bundles** | Scan full patch, partition at section/file/line boundaries, every byte exactly once, **max 8 bounded passes**, merge before exit check; never drop lockfiles/schemas just to shrink. |
| **Parallel Closeout** | `--parallel-tests "<cmd>"` runs tests concurrently in an isolated Testbox home; format first; `OPENCLAW_TESTBOX=1` on the process not the command; trusted-maintainer-only credential hydration. |
| **Review Panels** | Opt-in multi-reviewer: `--reviewers codex,claude,pi`, `--panel`, keyed/inline model+thinking syntax; `all` = codex+claude+pi; Droid/Copilot/Cursor/OpenCode **fail closed** (can't confine to the review boundary). |
| **Models and Thinking** | Per-engine defaults + thinking ladders; `--model`/`--thinking` global or `engine=` keyed; `--fallback-model` (Claude only); env-var equivalents. |
| **Review Engine Isolation** | Per-engine flags that strip project config/tools/memory and run the reviewer in an empty workspace so reviewed code can't influence the reviewer. |
| **Context Efficiency / Helper / Env Defaults / Final Report** | Keep everything in one path; entry points; default-mode selection; the required final report (command, tests, findings accepted/rejected, clean result — don't rerun just to reword). |

## 3. Engine / model strategy (autoreview's defining feature)

This is the axis where autoreview is fundamentally different from `/ba:review`.

- **External model, second opinion.** The reviewer is a *different* model/CLI (Codex `gpt-5.6-sol`, Claude `claude-fable-5`, or Pi) invoked as a subprocess — the whole point is a second model looking at your work, not the same agent re-reading its own diff.
- **Strict engine pinning.** "Never switch or override the requested review engine/model except for the documented Codex Sol→Terra account-access fallback. Capacity, rate-limit, and unrelated failures keep the same engine/model." Only Claude gets a `--fallback-model` chain; non-Claude fallback *fails closed*.
- **Configurable reasoning effort** per engine (Codex `none…max`, Claude `low…max`, Pi `off…xhigh`), settable by flag or `AUTOREVIEW_*` env var, with a clear precedence order (CLI > env > default).
- **Panels** run several engines against **one frozen bundle** — but are opt-in and cost-gated, and the main agent still verifies each accepted finding.

## 4. Scope governance (autoreview's other defining feature)

autoreview treats scope creep as the primary failure mode of an over-eager review loop and encodes a real state machine:

1. **Freeze a baseline** before the first review (request, target branch, intended behavior, owner boundary, changed files, non-test LOC). For inherited/bloated branches, baseline against the *intended* PR diff, not existing drift.
2. **Classify every finding** as in-scope blocker / follow-up / stop-and-escalate.
3. **Hard stop triggers**: narrow PR turning into architecture/protocol/migration change; diff grows past **2× files or non-test LOC**; **two patch cycles without convergence** (pause and reclassify); the real fix is "define the canonical contract first"; the fix would make the PR no longer describe the same behavior.
4. **Keep exploratory fixes out of the landing lane** until proven in scope.
5. **Critical exceptions are enumerated**: active data loss, crash, broken install/upgrade, release blocker, concrete security exposure — nothing else justifies blowing up scope.

There is a dedicated **release-branch freeze** variant that tightens this further.

## 5. Security posture

- **TruffleHog pre-scan** over temporary snapshots of exactly the added/modified content before any engine call, matching TruffleHog's low-false-positive `verified,unknown` policy; fails (with install link) rather than auto-installing; recommends TruffleHog in PR CI as backup.
- **Credential/proxy hygiene**: reviewer subprocesses keep engine auth + non-credentialed proxy vars but strip process-injection, Git-override, and credentialed-proxy values.
- **Security-audit suppression auditability**: suppressed findings stay in structured output, active output keeps an unsuppressible suppression notice, aggregate findings can't hide unrelated active risk.
- **Regression provenance discipline**: keep blamed-author / blamed-PR-author / merger / current-author / PR-date roles separate; fall back to blamed commit SHA if no PR; identify the human trigger behind bot automerges.
- **Security perspective is always on** but must "not cripple legitimate functionality" — report only concrete, actionable risk.

## 6. Reviewer isolation (sandboxing the reviewer from the reviewed code)

A distinctive concern almost absent from `/ba:review`: because the reviewer is a full agentic CLI, autoreview hardens it so the *reviewed project* cannot hijack the *reviewer*:

- **Codex**: auth-only config reconstruction, `--ignore-user-config --ignore-rules --skip-git-repo-check`, empty workspace, permission profile granting read to the empty workspace only, web search kept.
- **Claude**: `--safe-mode --setting-sources user --strict-mcp-config --disallowedTools mcp__*` — project hooks/skills/plugins/MCP/CLAUDE.md all disabled, empty workspace, WebSearch on.
- **Pi**: `--no-approve --no-session --no-context-files --no-extensions --no-skills --no-prompt-templates --no-themes --no-tools`, neutral temp dir.
- **Droid/Copilot/Cursor/OpenCode fail closed** because their CLI contracts can't prove a repository-only sandbox.

## 7. Head-to-head: autoreview vs `/ba:review`

| Dimension | **autoreview** | **`/ba:review`** |
|---|---|---|
| Form factor | Markdown skill wrapping a compiled binary (`scripts/autoreview`) | Pure markdown command orchestrating subagents; no binary |
| Reviewer identity | **External model** (Codex/Claude/Pi) — a genuine second opinion | **Same model**, fanned out into 7 built-in + discovered subagents, each with a *lens* not a different brain |
| Selection | Single engine by default; panels opt-in and cost-gated | **Per-diff judged selection ledger** — every reviewer shown `✓`/`○` with a reason, never hidden, one-toggle Adjust |
| Findings model | Engine returns structured findings; binary validates; agent verifies each | 4-level severity ladder + `Looks Good`, **confidence anchors {0,25,50,75,100}**, parse→validate→group→**merge (+25/extra reviewer)**→**soft gate**→render |
| Corroboration | Panels give multiple opinions but no merge math described | Explicit dedup + confidence-boost math; corroboration can promote a finding past its floor |
| Scope discipline | **Formal scope governor** (baseline, 2× cap, two-cycle stop, escalation classes) + release freeze | Largely absent — review is read-only, fixes are opt-in per finding; no baseline/scope-break machinery |
| Diff sizing | Byte-exact partitioning, ≤8 bounded passes, merge before exit | Single-pass; warns above 2000 lines but doesn't chunk |
| Security tooling | **TruffleHog pre-scan**, cred/proxy stripping, provenance roles, suppression auditability | `security-reviewer` lens only (XSS/auth/sensitive-data), no secret scanner, no provenance |
| Reviewer sandboxing | **Heavily hardened** per-engine isolation; some engines fail closed | Subagents inherit the session; protected-artifacts guard is the main guardrail |
| Fix application | Reviewer is advisory; agent applies, reruns focused tests + rerun review until clean, in scope | Structured resolution menu (Accept all / Critical+High+Med-100 / one-by-one / Done) with per-finding recommended disposition + post-apply guard |
| Tests-in-loop | `--parallel-tests` runs tests concurrently in isolated Testbox | No test execution; review is static over the diff |
| Persistence | Final-report convention in chat; `--output`/`--json-output` files | `--persist` writes `docs/reviews/<ts>-<ref>/` (per-reviewer raw + `summary.md`) |
| Platform | Explicit POSIX + Windows/PowerShell paths and shells | Assumes a POSIX-ish git/gh/glab environment |
| "Don't over-review" | "Stop as soon as helper exits 0… don't rerun for a nicer clean line" | Never-dispatch-empty-set + overlap set-aside keep runs minimal |

### Where they converge (independently arrived-at good ideas)

- **Findings are advisory, verify before applying.** autoreview: "Never blindly apply it." `/ba:review`: confidence gate + recommended dispositions, code fixes are opt-in.
- **Don't hide reviewers/findings.** autoreview keeps suppressed findings auditable; `/ba:review` keeps every reviewer in the ledger and every suppressed finding in a visible bucket.
- **Overlap control.** autoreview panels are cost-gated; `/ba:review` sets aside redundant reviewers naming the survivor.
- **Reviewers must not delete/relocate protected work.** `/ba:review` has an explicit protected-artifacts guard; autoreview's empty-workspace isolation achieves a similar "reviewer can't touch the tree" effect by construction.
- **Read the real code, not just the diff.** Both instruct reading adjacent files / changed-file full content for context.

### Where they genuinely differ in kind

1. **Second model vs same model.** autoreview's entire value proposition is an *independent* model. `/ba:review` gets diversity from *lenses and discovered external reviewers*, not from a different base model. These are complementary, not competing.
2. **Scope governance.** autoreview has a first-class, testable scope state machine; `/ba:review` has essentially none because it never auto-applies large fixes — but that also means `/ba:review` gives no guidance when a review *does* trigger a cascade of fixes.
3. **Security tooling depth.** autoreview bolts on a real secret scanner + provenance protocol; `/ba:review`'s security coverage is a single reviewer lens.
4. **Reviewer sandboxing.** autoreview treats the reviewer as untrusted-adjacent and hardens it; `/ba:review` runs reviewers as trusted in-session subagents.
5. **Consolidation rigor.** `/ba:review`'s parse→merge→gate pipeline with confidence math is more formally specified than anything in autoreview's findings handling.

## 8. What each could borrow from the other

**Ideas `/ba:review` (this repo) could adopt from autoreview:**

- **A scope-governor micro-convention for the fix-apply phase.** Today `/ba:review` has a rich resolution menu but no "you've drifted past the task" brake. Porting autoreview's *classify → 2× cap → two-cycle stop → escalate* as guidance in Step 5 would harden the apply loop without adding a binary. (Fits the plugin's convention-heavy style; roadmap-worthy — see issue hub #29.)
- **A secret-scan pre-step.** A `security-reviewer` lens can't match a dedicated `verified,unknown` TruffleHog pass. Even an optional pre-review secret scan (fail-with-link, never auto-install) would be a cheap, high-value add.
- **Regression-provenance role separation** for findings on already-landed code (`--mode commit` analog) — keep blamed-author vs merger vs current-author distinct instead of guessing.
- **An external-model reviewer as a discovered reviewer.** `/ba:review` already discovers external skills/agents; an autoreview-style "second model" reviewer would slot into the existing ledger and give true model diversity, not just lens diversity.
- **Byte-exact chunked passes** for diffs over the 2000-line warning threshold, instead of just warning.

**Ideas autoreview could borrow from `/ba:review`:**

- **The judged selection ledger** — a per-run, never-hidden `✓`/`○` reviewer roster with reasons is a more legible interaction than "panels are opt-in."
- **Confidence anchors + merge math** — autoreview's panels lack `/ba:review`'s explicit corroboration-promotion (`+25 per extra reviewer`) and soft gate; that math turns multiple opinions into a ranked, de-duplicated list.
- **Persisted run artifacts** — `docs/reviews/<ts>-<ref>/` with raw-per-reviewer + `summary.md` is a stronger audit trail than a chat-only final report.

## 9. Bottom line

autoreview and `/ba:review` are solving the *same job* (post-implementation, pre-ship code review) from **opposite architectural starting points**:

- **autoreview** = "run a *different, sandboxed* model over a *frozen, secret-scanned* bundle, and keep the human fix loop *inside a hard scope boundary*." Its sophistication is in **process discipline, isolation, and security**; its findings-consolidation is comparatively thin.
- **`/ba:review`** = "fan the *same* model across *judged, never-hidden* lenses and discovered reviewers, then *consolidate with explicit confidence/merge math* and a *structured, opt-in fix menu*." Its sophistication is in **reviewer selection and findings consolidation**; its scope-governance, secret-scanning, and reviewer-sandboxing are comparatively thin.

They are more complementary than competitive. The highest-leverage cross-pollination for this repo is autoreview's **scope governor** and **secret-scan pre-step**, plus the option of registering an **external-model reviewer** in `/ba:review`'s existing discovery/ledger machinery to add true model diversity alongside the lens diversity it already has.

## Open questions / caveats

- This analysis is from `SKILL.md` prose only; the actual `scripts/autoreview` binary behavior (partitioning, validation, exit codes) was not read and may differ in detail.
- autoreview's model IDs (`gpt-5.6-sol`, `gpt-5.6-terra`, `claude-fable-5`) and CLI-version gates (Claude v2.1.169+, Pi v0.79.0+) are point-in-time; treat as illustrative.
- Any adoption of a scope-governor or secret-scan step into `/ba:review` should go through the roadmap (issue hub #29) and the repo's mirror-site conventions, not be bolted on ad hoc.
