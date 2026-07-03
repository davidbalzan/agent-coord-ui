---
mode: ask
description: Figure out where the project is in the Groundwork flow and recommend the next step. Use when the user asks 'what's next', 'where are we', 'what should I do now', or seems unsure which Groundwork skill to run.
---

<!-- GENERATED from .claude/skills/next/SKILL.md by `groundwork`. Do not edit by hand. -->

# Next - Groundwork Flow Guide

Act as the project's flow coach. Inspect the current state, tell the user exactly where
they are in the Groundwork lifecycle, and recommend the single best next action (with a
short why). This skill never edits files — it orients and points.

## How to assess (read these, in order)

1. `docs/TECH_STACK.md` / `docs/PRODUCTION_ROADMAP.md` — do the project docs exist yet?
2. `docs/STACK_MAP.md` — are versions pinned and recently audited (`Last audited` date)?
3. `docs/PRD.md` (or `docs/PRD_*.md`) — is there a PRD?
4. `docs/phases/phase*/PHASE*_TASKS.md` — do task files exist, and how many checkboxes
   are open vs done? (For exact counts, suggest `groundwork status` or
   `docs/.groundwork/scripts/phase-status.mjs`.)
5. `docs/WORKSTREAMS.md` — any active streams in flight?
6. `docs/QUEUE.md` (or legacy `docs/BACKLOG.md`) — what is the next unblocked `- [ ]` item in `## Queue`?
7. `docs/DECISIONS.md` — recent or pending ADRs.

## Decision tree

Pick the FIRST matching state and recommend its action:

| State detected                                                                                                     | Recommend                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| No `PRD.md` (and no project docs)                                                                                  | `/create-prd "<idea>"` — **first step**: define the product before scaffolding |
| PRD exists, but no `TECH_STACK.md` / `PRODUCTION_ROADMAP.md`                                                       | `/kickstart` — scaffold the project docs **from the PRD**                      |
| Designing and terminology is fuzzy/conflicting, or no `CONTEXT.md` yet                                             | `/domain-model` — pin the ubiquitous language (+ bounded contexts)             |
| Docs exist, a `package.json` is present, `STACK_MAP` never audited or stale                                        | `/check-versions` — pin to latest stable before building                       |
| Roadmap exists but no `PHASE*_TASKS.md`                                                                            | `/plan-phase 1 "<name>"` — break the first phase into tasks                    |
| Task file has open `- [ ]` items, no active stream                                                                 | `/start-session`, then work the next task; `/check-task <id>` as you finish    |
| Work in progress                                                                                                   | `/update-workstreams` to record state; `/log-decision` for any new choices     |
| All tasks in current phase done                                                                                    | `groundwork status` to confirm, then `/plan-phase N+1` for the next phase      |
| A reusable cross-project lesson surfaced, knowledge repo configured                                                | `/remember` it (or `/remember --adr` if it's a real decision with trade-offs)  |
| A lesson surfaced but no knowledge repo set (no `$GROUNDWORK_KNOWLEDGE` and no `~/.config/groundwork/config.json`) | `groundwork knowledge init` first, then `/remember`                            |
| A project-specific decision was made                                                                               | `/log-decision` (writes this project's `docs/DECISIONS.md`)                    |
| A feature now needs persistence and there's no DB                                                                  | `/add-data-layer`                                                              |

If several apply, choose the one earliest in the flow that is incomplete — finishing the
foundation beats jumping ahead.

## Output format

```
## Where you are
<one or two sentences: current phase/task, what's done, what's open>

## Recommended next step
**`/<skill> <args>`** — <why this, now>

## Also worth doing
- <secondary suggestion, if any>
- <blocker to clear, if any>
```

Keep it short and decisive — one clear recommendation, not a menu. If the user passed
`the input you provide`, bias the recommendation toward that area.

Focus area (optional): (the input you provide)
