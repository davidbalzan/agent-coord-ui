---
title: "Phase 5 Tasks"
tags: [agent-coord-ui/phase, agent-coord-ui/tasks]
aliases: ["Phase 5 Tasks"]
---

# agent-coord-ui — Phase 5: David Coordination Cockpit

## Overview

Make the UI the surface David coordinates _from_: a DM inbox, prefix-ranked holographic
notifications, and actionable `DAVID_DECISION` cards. Most of the data already exists —
DMs to `david` flow into the store from `~/agent-coord/inbox/david.jsonl`, and
`store.sendMessage(to, body, isDM)` already round-trips replies over WS — so this is
predominantly a web (render + interaction) phase.

## 🔍 Implementation Audit Summary

**CRITICAL FINDINGS**: The transport is done. `apps/api/src/watcher.ts` reads inbox
`*.jsonl` (incl. `david.jsonl`) → `message` events → `store.messages` (MessageSnapshot:
from/to/body/timestamp/isDM). `store.sendMessage` already sends. So: inbox = filter the
existing stream; reply = existing send; notifications/decision-cards = a presentation +
interaction layer on top. Minimal/no server work.

### 📊 Components to Implement

- **InboxPanel.tsx** — threaded coordinator↔David DM view + reply
- **NotificationLayer.tsx** — prefix→priority classifier + holographic popup → action dock
- **DecisionCard.tsx** + decision-packet parser — structured DAVID_DECISION with option buttons
- **store/bus.ts** — inbox selectors, read-state, notification queue, dock state
- Sender-node anchoring via Graph3D `graph2ScreenCoords` (coordinate the Graph3D lock)

### ⚠️ Impact Assessment

- Notification spam if every message pops → prefix-gate prominence.
- Missed DAVID_DECISION stalls work → persistent unread + action dock, terminal fallback.
- Decision-packet drift → tolerant parser, malformed → plain DM.

## 🎯 Target Architecture

```
apps/web/src/
├── components/InboxPanel.tsx          # NEW — threaded DM view + reply
├── components/NotificationLayer.tsx   # NEW — popup pipeline + bottom-left action dock
├── components/DecisionCard.tsx        # NEW — DAVID_DECISION card w/ option buttons
├── lib/decisionPacket.ts              # NEW — parse Context/Options/Recommendation/If-no-action
└── store/bus.ts                       # + inbox selectors, readState, notifications[], dock[]
```

### Principles

1. Reuse the message stream + `sendMessage` — no new transport.
2. State in the store; components presentational.
3. Prefix drives prominence — never pop FYI.
4. Never lose a DAVID_DECISION — persists until acted on.
5. UI is additive — terminal stays a working fallback.

## 📋 Implementation Tasks

### Sprint 1: Inbox Foundation

#### [ ] Task 1: DM Inbox panel + reply

**Priority**: HIGH · **Package**: apps/web · **Dependencies**: None

- [ ] 1.1 Store selectors: David's DMs (isDM && from/to === "david"), grouped by counterpart agent into threads
- [ ] 1.2 InboxPanel.tsx — thread list + thread view, comfortable/wide reading surface, NEXUS aesthetic
- [ ] 1.3 Reply composer → `sendMessage(counterpart, body, isDM=true)`
- [ ] 1.4 Entry point (HUD button or dock); open/close store state
- [ ] 1.5 pnpm typecheck + web build green
      **Deliverable**: David reads + replies to coordinator DMs from the UI.

#### [ ] Task 2: Read-state + unread surfacing

**Priority**: HIGH · **Package**: apps/web · **Dependencies**: Task 1

- [ ] 2.1 Client-side read-state (per-message or per-thread last-read ts), persisted to localStorage
- [ ] 2.2 Unread badges (per thread + global)
- [ ] 2.3 Guarantee unactioned DAVID_DECISIONs stay visibly unread
- [ ] 2.4 Tests for unread computation
      **Deliverable**: nothing silently missed; clear unread state.

### Sprint 2: Notifications + Decision Cards

#### [ ] Task 3: Prefix-prioritized notification layer

**Priority**: HIGH · **Package**: apps/web · **Dependencies**: Task 1

- [ ] 3.1 Classifier: message prefix → priority (DAVID_DECISION/BLOCKER=loud; RISK/DONE=dock+badge; FYI=subtle)
- [ ] 3.2 NotificationLayer.tsx — loud path: center popup (auto-dwell ~5s) → animate to bottom-left **action dock**, persist until acted/dismissed
- [ ] 3.3 Quiet path: dock entry / badge only; FYI = subtle (optional graph pulse), no popup
- [ ] 3.4 Notification queue + dock state in store; dismiss/act clears
- [ ] 3.5 Tests for the classifier
      **Deliverable**: attention matches importance; no spam.

#### [ ] Task 4: Sender-node anchored animation

**Priority**: MEDIUM · **Package**: apps/web (Graph3D — coordinate lock) · **Dependencies**: Task 3

- [ ] 4.1 Resolve sender agent's node screen pos via `graph2ScreenCoords`
- [ ] 4.2 Stage-1 of the popup emanates from that node → travels to center
- [ ] 4.3 Graceful fallback when sender has no node (e.g. off-graph): popup from edge
      **Deliverable**: notifications are spatially tied to the graph.

#### [ ] Task 5: Actionable DAVID_DECISION cards

**Priority**: HIGH · **Package**: apps/web (+ lib parser) · **Dependencies**: Tasks 1, 3

- [ ] 5.1 `decisionPacket.ts` — parse Context / Options (numbered) / Recommendation / If-no-action; tolerant (malformed → null)
- [ ] 5.2 DecisionCard.tsx — render context + options as buttons (recommended one highlighted)
- [ ] 5.3 Clicking an option → `sendMessage(coordinator, "<chosen option>", isDM=true)`, mark decision resolved, clear notification
- [ ] 5.4 Malformed packet → fall back to plain DM rendering (never crash)
- [ ] 5.5 Parser unit tests (canonical + malformed)
      **Deliverable**: David answers decisions in one click from the UI.

## 🎯 Success Criteria

### Functional

- [ ] Threaded inbox; reply from UI
- [ ] Prefix-matched notification: emanate from sender node → center → action dock
- [ ] DAVID_DECISION card with option buttons; click replies + clears
- [ ] No DAVID_DECISION silently lost

### Quality

- [ ] typecheck + web build + tests green
- [ ] Decision parser + classifier unit-tested incl. malformed
- [ ] FYI/DONE never trigger center popup

### Architecture

- [ ] Reuses message stream + sendMessage
- [ ] State in store, components presentational
- [ ] Terminal remains a fallback

## 📅 Timeline

- **Sprint 1 (Inbox)**: 3–4 days (Tasks 1–2)
- **Sprint 2 (Notifications + cards)**: 4–5 days (Tasks 3–5)
- **Total**: ~1–2 weeks

## 🚀 Progress

1. ⚪ Task 1 (Inbox panel) — not started — **recommended first slice**
2. ⚪ Task 2 (Read-state)
3. ⚪ Task 3 (Notification layer)
4. ⚪ Task 4 (Sender anchoring)
5. ⚪ Task 5 (Decision cards)

## 🎯 CURRENT STATUS: 0/5 — awaiting kickoff (Task 1 first)

## 📝 Notes

- Coordinate the DAVID_DECISION packet shape with playbook-owner so the card parser matches canonical format.
- Graph3D edits (Task 4) need the coordinator-held lock — coordinate before touching.
- UI is additive; never make coordination _depend_ on it — terminal stays the fallback.
