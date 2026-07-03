---
title: "Workstreams"
tags: [groundwork/core]
aliases: ["Workstreams", "Active Work", "Streams"]
---

# Workstreams

> **Live state of every parallel stream of work.** The swarm-native replacement for a
> single "current focus" — one row per stream, scales from solo to a coordinated fleet.

This is the live counterpart to `[[QUEUE]]`:

- **`[[QUEUE]]`** = the _inbound_ queue — what to pick up next (human + `/plan-phase` own it).
- **`WORKSTREAMS.md`** = the _live_ state — what is in flight right now (whoever is working writes it, including a multi-agent coordinator).
- **`[[DONE]]`** = the _completion log_ — append-only, written by whoever executes.

Update with `/update-workstreams`.

---

## Active Streams

| Stream | Owner / Agent | Branch · Worktree | Status    | Blocker | Last note                                                    |
| ------ | ------------- | ----------------- | --------- | ------- | ------------------------------------------------------------ |
| —      | —             | —                 | ⏳ Queued | —       | Run `/kickstart`, then `/plan-phase` to populate the backlog |

Status: 🚧 In Progress · 🔍 In Review · ⏳ Queued · ⛔ Blocked · ✅ Done

---

## Recently Closed

_Closed streams move here with an outcome and date (YYYY-MM-DD)._

---

## Last Updated

**Date**: (set on first update)
**Status**: Template ready

<!-- ─────────────────────── coordinator extensions ───────────────────────
Present ONLY when a multi-agent coordinator runs this project (a solo
/update-workstreams user never adds these). Under a coordinator, WORKSTREAMS.md
is the single board — these sections replace the retired LIVE_STATE board.

`/update-workstreams` and `groundwork status` parse only the core above
(## Active Streams + ## Recently Closed) and MUST preserve everything below this
fence verbatim. Write-regions:
  · Active Streams / Recently Closed — shared; one row per owner; read-before-write CAS
  · all sections below — coordinator-only, single-writer
  · Needs David — coordinator writes; David clears

When adopted, the coordinator materialises these sections (drop the comment):

## Open PRs
| Repo | PR | Owner | Status | Merge Gate |
| ---- | -- | ----- | ------ | ---------- |

## Cutover Gates    (State distinguishes merged≠deployed, code-complete≠ops-ready)
| Gate | Owner | State | Notes |
| ---- | ----- | ----- | ----- |

## Needs David
| Decision | Context | Recommendation |
| -------- | ------- | -------------- |

## Risks
| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |

## Rooms
| Room | Purpose | Owner | State |
| ---- | ------- | ----- | ----- |

## Decisions Recorded
- <ADR / decision ref>
──────────────────────────────────────────────────────────────────────── -->
