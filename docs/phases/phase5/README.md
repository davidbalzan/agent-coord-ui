---
title: "Phase 5: David Coordination Cockpit"
tags: [agent-coord-ui/phase]
aliases: ["Phase 5"]
---

# Phase 5: David Coordination Cockpit

**Duration**: 1–2 weeks — mostly web; the data + send path already exist.
**Status**: ⚪ Not Started
**Priority**: 🟡 High — turns the UI from a dashboard you _watch_ into a cockpit you _coordinate from_; lets David move coordination off the terminal.

---

## 📋 Phase Overview

**Goal**: David can run coordination from the UI — read coordinator DMs, reply, and get attention-ranked holographic notifications, with `DAVID_DECISION`s rendered as actionable cards he can answer in one click.

**Current State**: David coordinates in tmux/chat. The UI observes the bus (graph, panels, status) and can already _send_ messages (`store.sendMessage`), but there's no inbox view, no notifications, and decisions are answered by typing in the terminal.

**Target State**: A DM/inbox panel (threaded coordinator↔David), a prefix-prioritized notification layer (holographic: emanate from the sender node → center popup → park in a bottom-left action dock), and structured `DAVID_DECISION` cards with option buttons that reply for him. The terminal remains a fallback.

**Key enabler (de-risks the phase):** DMs to `david` already flow into the store — the API watcher reads `~/agent-coord/inbox/david.jsonl` and emits `message` events; `store.sendMessage(to, body, isDM)` already round-trips via WS `send_message`. So most of this is rendering + interaction on data that's already present.

---

## 📊 Quick Stats

- **Sprints**: 2 (Inbox foundation, then notifications + decision cards)
- **Major Tasks**: 5
- **New Files**: ~4 (`InboxPanel.tsx`, `NotificationLayer.tsx`, `DecisionCard.tsx`, a decision-packet parser)
- **Modified Files**: ~3 (`store/bus.ts` for inbox/read-state/notification queue, HUD or a dock entry, possibly Graph3D for sender-node anchoring)
- **Server Changes**: Minimal/none — DM data + send path already exist; read-state is client-side
- **Test Coverage Target**: Unit tests for the decision-packet parser and the prefix→priority classifier

---

## 🎯 Key Deliverables

### Sprint 1: Inbox Foundation (Week 1)

- ⚪ **DM Inbox panel** — threaded view of coordinator↔David DMs (filter `messages` where `isDM` and `from===david`/`to===david`), grouped by counterpart; reply via existing `sendMessage`. Wider/comfortable reading surface.
- ⚪ **Read-state + unread badges** — track read/unread client-side; surface unread counts; never silently drop a `DAVID_DECISION`.

### Sprint 2: Notifications + Decision Cards (Week 2)

- ⚪ **Prefix-prioritized notification layer** — classify incoming messages by prefix (`DAVID_DECISION`/`BLOCKER` = loud; `RISK`/`DONE` = dock + badge; `FYI` = subtle/graph pulse). Holographic flow: emanate from sender node → center popup (few seconds) → park in a bottom-left **action dock** until acted on/dismissed.
- ⚪ **Sender-node anchoring** — stage-1 of the animation originates at the sender agent's node via `graph2ScreenCoords`, tying notifications to the spatial model.
- ⚪ **Actionable decision cards** — parse the coordinator `DAVID_DECISION` packet (Context / Options / Recommendation / If-no-action) into a structured card with option buttons; clicking an option replies to the coordinator via `sendMessage`.

---

## ✅ Success Criteria

### Functional Requirements

- [ ] David sees coordinator DMs in a threaded inbox panel and can reply from the UI
- [ ] A new incoming message produces a notification whose prominence matches its prefix (DAVID_DECISION/BLOCKER loud → FYI subtle); it animates from the sender node, pops center, then parks bottom-left for action
- [ ] A `DAVID_DECISION` renders as a card with its options as buttons; clicking one sends the chosen reply back to the coordinator and clears the notification
- [ ] No incoming `DAVID_DECISION` is silently lost — unread state is visible until acted on

### Quality Requirements

- [ ] `pnpm typecheck` + web build + tests green
- [ ] Decision-packet parser and prefix→priority classifier are unit-tested (incl. malformed packets → fall back to plain message, never crash)
- [ ] Notifications are not spammy — FYI/DONE never trigger the center popup

### Architecture Requirements

- [ ] Reuse the existing message stream + `sendMessage`; no duplicate transport
- [ ] Notification/inbox state lives in the store; components stay presentational
- [ ] Terminal remains a working fallback for coordination (UI is additive, not a hard dependency)

---

## ⚠️ Risks & Mitigation

| Risk                                                                                            | Impact    | Likelihood | Mitigation                                                                                                                |
| ----------------------------------------------------------------------------------------------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Notification spam** — every message pops → noise, defeats the point                           | 🟡 Medium | 🔴 High    | Prefix-driven priority; only DAVID_DECISION/BLOCKER get the center popup; FYI is a quiet graph pulse                      |
| **Missed DAVID_DECISION** — UI becomes primary surface, a dropped notification stalls real work | 🔴 High   | 🟡 Medium  | Persistent unread state + action dock until acted on; keep terminal as fallback; never auto-expire an unactioned decision |
| **Half-bridge** — read-only inbox forces context-switch back to terminal to act                 | 🟡 Medium | 🟡 Medium  | Ship the full loop in Sprint 1+2: read + reply + act inline                                                               |
| **Decision-packet format drift** — parser breaks on non-canonical packets                       | 🟡 Medium | 🟡 Medium  | Tolerant parser; malformed → render as plain DM (never crash); coordinate packet format with playbook-owner               |

---

## 🔗 Dependencies

- **Required**: existing message stream into the store (DMs to `david` already sourced from `inbox/david.jsonl`) and `store.sendMessage` (both present from Phases 2–4).
- **Optional**: Graph3D `graph2ScreenCoords` for sender-node anchoring (already used by the radial menu).
- **Coordinate**: `DAVID_DECISION` packet format with `playbook-owner` (so the card parser matches the canonical shape).

---

## ⏭️ Next Phase

After completion → Phase 6: Full Interactive Terminal (xterm.js) · Phase 7: Networked & Multi-Operator. See [[PRODUCTION_ROADMAP]].
