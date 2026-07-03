<!-- GENERATED from .claude/skills/update-workstreams/SKILL.md by `groundwork`. Do not edit by hand. -->

# Update Workstreams - Live Parallel-Work Recorder

Update `docs/WORKSTREAMS.md` to reflect the live state of every parallel stream of work —
a table of **active streams**, not a single focus (the swarm-native replacement for
"current focus"). It is the live counterpart to `[[QUEUE]]`:

- **`QUEUE.md`** = the _inbound_ queue (what to pick up next). Owned by the human + `/plan-phase`.
- **`WORKSTREAMS.md`** = the _live_ state (what's in flight). Written by whoever's working,
  including an external coordinator that pulls from QUEUE and opens a stream here. See
  `[[GROUNDWORK_METHODOLOGY#multi-agent-seam]]`.
- **`DONE.md`** = the _completion log_ (append-only, written by the executor).

Working alone is just the one-row case — the model scales solo → fleet unchanged.

Preserve the file's frontmatter; use `[[wikilinks]]` (`[[DECISIONS#adr-005|ADR-005]]`, `[[QUEUE]]`).

**Write only the core; preserve coordinator extensions.** Under a multi-agent coordinator,
`WORKSTREAMS.md` may carry coordinator-only sections after the `<!-- coordinator extensions -->`
fence (Open PRs, Cutover Gates, Needs David, Risks, Rooms, Decisions Recorded). You edit
**only** `## Active Streams` and `## Recently Closed`; copy everything from that fence onward
through **verbatim** on every rewrite — never edit or drop it. Within Active Streams, touch
only the row(s) you own, and if another agent may be writing, re-read immediately before
writing (read-before-write) so you don't clobber a concurrent row.

## Instructions

1. Read `docs/WORKSTREAMS.md`.
2. From `the input you provide`/context: new stream → add a row; progress → update its Status / Last
   note; finished → move the row to `## Recently Closed` with an outcome.
3. Keep one row per active stream; update the `Last Updated` timestamp; confirm the result.

## Format

```markdown
## Active Streams

| Stream           | Owner / Agent | Branch · Worktree            | Status         | Blocker | Last note             |
| ---------------- | ------------- | ---------------------------- | -------------- | ------- | --------------------- |
| Phase 2 · Auth   | agent-api     | `feat/phase2-auth` · wt-auth | 🚧 In Progress | None    | JWT done, RBAC next   |
| Phase 3 · Search | —             | —                            | ⏳ Queued      | Phase 2 | pulled from [[QUEUE]] |

## Recently Closed

- ✅ Phase 1 · Foundation — agent-api · `feat/phase1` · merged YYYY-MM-DD
```

Guidelines: status = 🚧 In Progress · 🔍 In Review · ⏳ Queued · ⛔ Blocked · ✅ Done. Record
branch + worktree so any agent can resume the exact context. `Blocker` names the dependency
(another stream, a decision, a person), not just "yes". Dates `YYYY-MM-DD`.

Progress to record: (the input you provide)
