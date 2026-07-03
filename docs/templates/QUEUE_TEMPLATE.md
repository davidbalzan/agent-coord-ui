# QUEUE — <project>

The inbound task queue. Phases are planned via `/plan-phase` and appear here as single items
referencing the full task breakdown. Ad-hoc tasks (bug fixes, improvements) are added directly by
the human. This file is intake only: live in-flight state lives in [[WORKSTREAMS]], completions
are recorded in `docs/DONE.md`.

**Write rule (single writer per file):** the human (or their planning proxy) writes here — add /
reorder / remove / edit items, set priority (`P1`/`P2`/`P3`; top-to-bottom breaks ties), add
constraints, acceptance criteria, or refs inline. Whoever executes work never edits this file — it
reads the top unblocked item fresh and appends the completion to `docs/DONE.md` instead. Pruning
satisfied items is the writer's job. No compare-and-swap ceremony needed: the filesystem enforces
the boundary.

## Queue

- [ ] (P1) Phase 1: [Phase Name] — see [[phases/phase1/PHASE1_TASKS]] · acceptance: all Phase 1 success criteria met
