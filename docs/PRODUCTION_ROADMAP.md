---
title: "Production Roadmap — agent-coord-ui"
tags: [agent-coord-ui/core]
aliases: ["Roadmap", "PRODUCTION_ROADMAP"]
---

# agent-coord-ui — Production Roadmap

> Single source of truth for the project's journey from current state to production readiness. Updated as phases progress and priorities shift.

---

## 🎯 Current Focus

**Phase**: Phase 3 — Polish & Production Hardening
**Task**: Node spotlight / filter toolbar
**Status**: 🟡 In Progress
**Branch**: `main`
**Blocking Issues**: None

---

## 📊 Current State Assessment

### ✅ What We Have

- **Monorepo scaffold** — pnpm workspaces, Turborepo pipeline, shared TypeScript types via `@coord-ui/shared`
- **Live 3D force graph** — Agents and rooms as glowing nodes, real-time updates over WebSocket, directional particle flow on message edges
- **Holographic UI** — Full NEXUS aesthetic (electric cyan glows, Orbitron/Share Tech Mono fonts, scanline overlay, corner bracket panels)
- **Side panel interactions** — Click agent → DM thread with compose; click room → room chat with member list and compose
- **HUD status bar** — Live counts (active/idle/stale agents, rooms), system status indicator
- **WebSocket bridge** — Auto-reconnect, `full_state` on connect, delta events (`agent_join/leave/update`, `room_update`, `message`)
- **Unified logging** — pino server logs + client error forwarding → single `logs/api.log`
- **ErrorBoundary** — Catches runtime errors, POSTs to `/api/logs`, recovers gracefully

### 🚨 What's Missing for Production

- **Node filter / spotlight** (M5): No way to focus on one agent or room when the graph is large; visual noise becomes unmanageable beyond ~15 nodes
- **Double-click focus lock** (M5, PRD U8): Camera doesn't lock onto a selected node for close inspection
- **DM edge click** (PRD U5): Clicking the line between two agents should open their DM thread — currently only clicking the agent node works
- **Stale pulse animation** (M5): Stale nodes should visually pulse red to stand out; currently just a static red glow
- **Auth token** (open question from PRD §10): Exposing on a network has no protection; planned for v2 but needs a decision
- **No persistence** (PRD §3 non-goal for v1): Messages lost on reload

### 📈 Production Readiness Score

- **Functional Completeness**: 80% — Core flows work; filter/spotlight and edge-click interactions remain
- **Test Coverage**: ~0% — No unit or integration tests written yet; logic is concentrated in the WS bridge and Zustand store
- **Security Posture**: Low — Acceptable for local-only v1; must address before any networked exposure
- **Operational Readiness**: Medium — Logging in place; no monitoring/alerting; deployment is manual `pnpm dev` pair

---

## 🗺️ Phase Overview

### Phase 1: Foundation & Scaffold

**Goal**: Monorepo boots, API serves WebSocket, Vite app loads and connects.
**Duration**: 1 week
**Status**: 🟢 Complete

**Key Deliverables**:

- [x] pnpm monorepo with Turborepo, `@coord-ui/shared` types
- [x] Hono API server with WebSocket upgrade
- [x] Vite React app with Zustand bus store wired to WS
- [x] `BusEvent` union type and snapshot interfaces

---

### Phase 2: Live Graph & Core Interactions

**Goal**: Agents and rooms appear as nodes with real-time updates; operator can DM any agent and post to any room.
**Duration**: 2 weeks
**Status**: 🟢 Complete

**Key Deliverables**:

- [x] `3d-force-graph` rendering agents and rooms as nodes with correct edge types
- [x] WebSocket `full_state` + delta events flowing into store
- [x] `DMPanel` — DM thread history + compose for any agent
- [x] `RoomPanel` — Room chat + member list + compose
- [x] `SidePanel` — Selection-driven container (click node → open panel)
- [x] Directional particle animation on message edges
- [x] HUD stats bar (active / idle / stale counts, room count)

---

### Phase 3: Polish & Production Hardening

**Goal**: Holographic aesthetic complete, all PRD interactions implemented, app is stable and navigable with 20+ nodes.
**Duration**: 1–2 weeks
**Status**: 🟡 In Progress

**Key Deliverables**:

- [x] Holographic NEXUS aesthetic (glow nodes, Orbitron/Share Tech Mono, scanlines, corner brackets)
- [x] Three.js custom node objects with additive-blended halos and PointLights
- [x] `useShallow` fix for stable array selectors (infinite re-render resolved)
- [x] `three@0.184` + Vite `dedupe` fix (multiple Three.js instance crash resolved)
- [ ] **Node filter toolbar** — filter graph by room or agent name
- [ ] **Double-click focus lock** — camera locks onto node, dims others
- [ ] **DM edge click** — clicking agent↔agent line opens their DM thread
- [ ] **Stale node pulse** — animated red pulse for stale agents (CSS keyframe on node aura)
- [ ] **Test suite** — vitest unit tests for `bus.ts` selectors and `watcher.ts` diff logic

---

### Phase 4 (v2): Networked & Multi-Operator

**Goal**: Support remote teams; auth token; HTTP API mode for non-local MCP.
**Duration**: TBD
**Status**: ⚪ Not Started

**Key Deliverables**:

- [ ] Shared-secret token on WS handshake
- [ ] HTTP proxy mode in `watcher.ts` (replace direct file import)
- [ ] Docker Compose for both services
- [ ] Multi-operator: operator identity shown in DM threads

---

## 📊 Implementation Priority Matrix

| Phase               | Priority    | Blocks        | Complexity | Duration  | Key Risk                     |
| ------------------- | ----------- | ------------- | ---------- | --------- | ---------------------------- |
| Phase 1: Foundation | 🔴 Critical | All           | Low        | 1 week    | None                         |
| Phase 2: Live Graph | 🔴 Critical | Phase 3+      | Medium     | 2 weeks   | WS event schema churn        |
| Phase 3: Polish     | 🟡 High     | v2 perception | Medium     | 1–2 weeks | Three.js coupling complexity |
| Phase 4: Networked  | 🟢 Medium   | —             | High       | TBD       | Auth scope creep             |

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (sequential; Phase 4 is independent v2 work)

---

## ⚡ Quick Wins (Available Now)

1. **Stale node pulse** (~1 hour) — Add `animation: glow-pulse 1s ease-in-out infinite` to the halo sphere material in `buildGlowNode` when status is `stale`. No new deps.

2. **Filter input in HUD** (~2 hours) — Add a text input to `HUD.tsx` that writes a `nameFilter` string to the store; `Graph3D.tsx` reads it and calls `graph.nodeVisibility(n => n.label.includes(filter))`.

3. **DM edge click** (~1 hour) — Wire `onLinkClick` in `Graph3D.tsx`; for `membership` links open the room, for `dm` links open the agent DM panel.

---

## 📈 Success Metrics

### Technical

- [ ] Graph navigable with 30+ agents without visual confusion (filter operational)
- [ ] Zero infinite re-render warnings in browser console
- [ ] `pnpm typecheck` passes across all packages
- [ ] Single `pnpm dev` + `pnpm --filter @coord-ui/api dev` brings the full stack up cleanly

### Functional (PRD)

- [ ] All 8 PRD user stories (U1–U8) verifiable against running app
- [ ] Operator can send DM to any agent and post to any room
- [ ] Agent status visible at a glance via node colour + glow

---

## 🔄 Revision History

| Date       | Change                                 | Reason                                                       |
| ---------- | -------------------------------------- | ------------------------------------------------------------ |
| 2026-06-08 | Initial roadmap created from kickstart | Project bootstrapped; Phase 1 & 2 retrospectively documented |

---

## 🔗 Related Documents

- **[[TECH_STACK|Tech Stack]]** — Technology choices and versions
- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** — System design and patterns
- **[[DECISIONS|Decisions Log]]** — Architectural Decision Records
- **[Phase Details](./phases/)** — Detailed phase task breakdowns
- **[[CURRENT_FOCUS|Current Focus]]** — What's actively being worked on right now
- **[[prd|PRD]]** — Original product requirements
