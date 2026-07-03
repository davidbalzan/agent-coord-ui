---
title: "Artifact Map"
tags: [groundwork/reference]
aliases: ["Artifacts", "Artifact Map", "Where things live"]
---

<!-- GENERATED from the Groundwork artifact manifest. Do not edit by hand;
     run `groundwork artifacts` after editing the manifest. -->

# Artifact Map

> **Agent reference.** Every Groundwork doc artifact: what it is, which skill **writes**
> it, who **reads** it, and the rules for touching it. Consult this to know _where things
> live_ before reading or editing — especially when picking up a `[[QUEUE]]` item.

## Project artifacts

| Artifact                             | Purpose                                                         | Written by                         | Read by                                        | Rules                                                                                 |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/PRD.md`                        | Product definition (problem, users, goals, scope, requirements) | /create-prd                        | /kickstart, /plan-phase                        | First artifact; the source for scaffolding                                            |
| `docs/CONTEXT.md (+ CONTEXT-MAP.md)` | Ubiquitous-language glossary / domain model                     | /domain-model                      | /start-session, /plan-phase                    | Glossary only — no implementation detail                                              |
| `docs/TECH_STACK.md`                 | Technology choices narrative                                    | /kickstart                         | /plan-phase, /start-session                    | No version numbers here — link to STACK_MAP                                           |
| `docs/STACK_MAP.md`                  | Single source of truth for versions (pinned + latest)           | /kickstart, /check-versions        | anyone bumping deps                            | The only place a version appears                                                      |
| `docs/ARCHITECTURE_GUIDE.md`         | System design, patterns, the "why"                              | /kickstart                         | /plan-phase                                    | —                                                                                     |
| `docs/DECISIONS.md`                  | Project ADRs (decision log)                                     | /log-decision, /kickstart          | /start-session                                 | ADRs are immutable; supersede, don't edit                                             |
| `docs/PRODUCTION_ROADMAP.md`         | Phase roadmap + "Current Status" pointer                        | /kickstart, /plan-phase            | /start-session, groundwork status              | Current Status points at WORKSTREAMS                                                  |
| `docs/phases/phaseN/README.md`       | Phase overview                                                  | /plan-phase                        | /start-session                                 | —                                                                                     |
| `docs/phases/phaseN/PHASEN_TASKS.md` | Detailed checkbox tasks                                         | /plan-phase                        | /check-task, /start-session, groundwork status | Progress recomputed by the helper script                                              |
| `docs/WORKSTREAMS.md`                | Live state of parallel streams                                  | /update-workstreams + coordinator  | everyone, /start-session                       | One row per active stream                                                             |
| `docs/QUEUE.md`                      | Inbound queue (phases + ad-hoc)                                 | /plan-phase + human                | /start-session, coordinator                    | Single writer per file: human/proxy only; executors never edit it                     |
| `docs/DONE.md`                       | Completion log                                                  | executor (solo you or coordinator) | /start-session, humans                         | Append-only; sole executor write in the queue seam; pinned em-dash+middot line format |
| `docs/DESIGN_SYSTEM.md`              | Visual language (optional)                                      | /kickstart                         | frontend work                                  | Only when there's a UI                                                                |
| `docs/FACTS.md`                      | Verified project facts (settled world-model)                    | whoever verified (or set-fact.mjs) | everyone, groundwork doctor                    | One writer per fact; entries carry verified/by/method; doctor flags stale (>14d)      |

## Reference (shipped, generic — same across projects)

| Artifact                         | Purpose                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/GROUNDWORK_METHODOLOGY.md` | The full methodology                                                                                                                                         |
| `docs/COMMANDS.md`               | Command/skill guide                                                                                                                                          |
| `docs/_INDEX.md`                 | Obsidian Map of Content (human navigation)                                                                                                                   |
| `docs/ARTIFACTS.md`              | This file (generated from the manifest)                                                                                                                      |
| `docs/.groundwork/scripts/`      | Deterministic helpers: check-task.mjs (/check-task), phase-status.mjs (groundwork status), check-versions.mjs (/check-versions), set-fact.mjs (FACTS upsert) |
| `docs/.groundwork/VERSION`       | Installed Groundwork version                                                                                                                                 |

## Cross-project (external)

| Artifact                                 | Purpose                   | Written by      |
| ---------------------------------------- | ------------------------- | --------------- |
| `$GROUNDWORK_KNOWLEDGE/notes/lessons.md` | Raw cross-project lessons | /remember       |
| `$GROUNDWORK_KNOWLEDGE/adr/NNNN-*.md`    | Formal cross-project ADRs | /remember --adr |

Resolve the central knowledge repo with `groundwork knowledge path`. Project-specific
decisions stay in `docs/DECISIONS.md`; cross-project lessons go to the central repo.

## Terms (Groundwork's own vocabulary)

- **ADR / decision** — a _formal, structured_ record of a choice with rationale and
  trade-offs. Lives in `docs/DECISIONS.md` (project, via `/log-decision`) or
  `$GROUNDWORK_KNOWLEDGE/adr/` (cross-project, via `/remember --adr`). Has frontmatter + sections.
- **Lesson / note** — a _raw, one-line, dated_ capture via `/remember` to
  `$GROUNDWORK_KNOWLEDGE/notes/lessons.md`. Unstructured; promote a keeper into an ADR
  with `/remember --adr`.
- **Decision vs lesson:** a decision is "we chose X over Y because…"; a lesson is "X is
  worth remembering."

When a project's _own_ domain reuses these words, define how its model maps onto these
source meanings in its `docs/CONTEXT.md`.

## The swarm seam (optional)

- **`QUEUE.md`** = what to do next (inbound). **`WORKSTREAMS.md`** = what's in flight (live). **`DONE.md`** = what shipped (completion log). **`FACTS.md`** = what's settled (verified world-model).
- Split by writer so single-writer-per-_file_ is filesystem-enforced: humans write QUEUE, the executor appends to DONE and never touches QUEUE; whoever verified a fact writes it.
- An external coordinator reads QUEUE, opens a stream in WORKSTREAMS, and appends completions to DONE as work proceeds; agents cite FACTS ids instead of restating world-state.
- Optional — Groundwork runs solo without it. The coordinator depends on this seam, not the
  reverse. Reference implementation: **`coord-mcp`** (MCP-based, harness-agnostic).
