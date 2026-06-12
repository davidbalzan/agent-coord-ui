---
title: "Production Roadmap — agent-coord-ui"
tags: [agent-coord-ui/core]
aliases: ["Roadmap", "PRODUCTION_ROADMAP"]
---

# agent-coord-ui — Production Roadmap

> Single source of truth for the project's journey from current state to production readiness. Updated as phases progress and priorities shift.

---

## 🎯 Current Focus

**Phase**: Post–Phase 8 — hardening + forward planning (Phase 9/10)
**Task**: Phases 1–8 complete (auth shipped, PR #54). Now: P2 hardening (node-pty dev preflight, doc reconciliation) + Phase 9 (networked) / Phase 10 (WebXR) planning
**Status**: 🟢 Phases 1–8 Complete
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

- **Networked / multi-operator** (Phase 9): Single local operator only; no HTTP proxy mode, no per-operator sessions
- **Per-operator audit log** (Phase 8 stretch): Auth gates access but there's no record of who attached which PTY / spawned-tore-down
- **No persistence** (PRD §3 non-goal for v1): Messages lost on reload
- **Monitoring/alerting**: Logging in place but no health metrics or alerting; deployment is still a manual `pnpm dev` pair

> The four M5 graph interactions (filter/spotlight, double-click focus lock, DM edge click, stale pulse) and the **auth token** are now shipped — see Phases 3 & 8.

### 📈 Production Readiness Score

- **Functional Completeness**: ~95% — All 8 PRD user stories shipped; PTY terminal + auth in place. Remaining gaps are v2 (networked/multi-operator) + persistence.
- **Test Coverage**: Growing — unit tests across `bus.ts` selectors/notifications, `decisionPacket`, `notificationPriority`, `tmux`, `ws`, and auth (web + api suites green)
- **Security Posture**: Medium — JWT auth gates all privileged surfaces (Phase 8); loopback kept as defense-in-depth. Outstanding: shorten token TTL, revocation, token off localStorage before networked exposure
- **Operational Readiness**: Medium — Logging + dev preflight in place; no monitoring/alerting; deployment is manual `pnpm dev` pair

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
**Status**: 🟢 Complete

**Key Deliverables**:

- [x] Holographic NEXUS aesthetic (glow nodes, Orbitron/Share Tech Mono, scanlines, corner brackets)
- [x] Three.js custom node objects with additive-blended halos and PointLights
- [x] `useShallow` fix for stable array selectors (infinite re-render resolved)
- [x] `three@0.184` + Vite `dedupe` fix (multiple Three.js instance crash resolved)
- [x] **Node filter toolbar** — filter graph by room or agent name (HUD `nameFilter`)
- [x] **Double-click focus lock** — camera locks onto node, dims others (`interactions.ts`)
- [x] **DM edge click** — clicking agent↔agent line opens their DM thread (`onLinkClick`)
- [x] **Stale node pulse** — animated pulse for stale agents (`startGraphAnimationLoop`)
- [x] **Test suite** — vitest unit tests for `bus.ts` selectors (`bus.test.ts` + notifications/activity)

---

### Phase 4: Agent Provisioning & Terminal Groups (from the UI)

**Goal**: Spawn, configure, and register a fully set-up agent from the web UI — replacing the manual "split pane → launch → `/model` → join chat as `<name>`" ritual. Agents can be organized into named terminal groups (tmux windows/sessions) and torn down from the UI.
**Duration**: 1–2 weeks
**Status**: 🟢 Complete (PRs #1–#4, T6 in final gate)

**Context**: Today the operator hand-spawns every agent in tmux. The plumbing to automate this already exists — `apps/api/src/tmux.ts` has `sendKeys`, `capturePane`, and `listPanes` — so spawning is mostly sequencing existing primitives plus pane creation and **prompt-readiness detection** (the one hard part). Does not depend on the xterm.js work.

**Key Deliverables**:

- [x] tmux pane lifecycle primitives — `split-window`/`new-window`/`new-session` returning a pane id, `kill-pane` (PR #1)
- [x] Prompt-readiness detection — `waitForPrompt` polling `capturePane` so steps never blind-fire (PR #1)
- [x] Agent presets — model, role/skill, lane, rooms, launch command (persisted to `~/agent-coord/presets.json`) (PR #2)
- [x] Sequenced provisioner — create → launch → `/model` → skill-invoke → confirm registered, with progress events (PR #2)
- [x] WS/REST protocol — `spawn_agent`/`teardown_agent` WS routing, preset CRUD REST, loopback security gate (PR #3)
- [x] Launcher + preset-editor UI, per-agent teardown, named terminal groups (PR #4, T6)
- [x] Terminal groups modelled from tmux sessions; `TerminalGroup` type in `@coord-ui/shared` (T6)
- [x] Graph3D session group labels on pane nodes (T6)
- [x] Full injection hardening: all preset fields (`launchCmd`, `skillInvocation`, `repoPath`, `lane`, `rooms`) validated before reaching shell (T6)
- [x] Orphan-pane cleanup verified: mid-sequence failure test confirms `killPane` always called (T6)

**Detailed plan**: [Phase 4 Tasks](./phases/phase4/PHASE4_TASKS.md) · [Phase 4 README](./phases/phase4/README.md)

**Key Risk (resolved)**: readiness races — solved via `waitForPrompt` polling `capturePane` with configurable timeout + hard gate before each `send-keys`.

---

### Phase 5: David Coordination Cockpit

**Goal**: David coordinates from the UI — DM inbox + reply, prefix-ranked holographic notifications (emanate from sender node → center popup → bottom-left action dock), and `DAVID_DECISION`s as actionable cards answered in one click.
**Duration**: 1–2 weeks
**Status**: 🟢 Complete — `InboxPanel`, `NotificationLayer`, `DecisionCard` shipped; `decisionPacket`/`notificationPriority` unit-tested.

**Context**: De-risked because DMs to `david` already flow into the store (`inbox/david.jsonl` → `message` events) and `store.sendMessage` already round-trips replies. Mostly a web render+interaction layer.

**Detailed plan**: [Phase 5 Tasks](./phases/phase5/PHASE5_TASKS.md) · [Phase 5 README](./phases/phase5/README.md)

**Key Risk**: notification spam / missed DAVID_DECISION — mitigated by prefix-driven prominence + persistent action dock; terminal stays a fallback.

---

### Phase 6: UI Componentization & Design System

**Goal**: Extract a design-system layer (tokens + primitive components) and split the mega-files, behavior-preserving — so the NEXUS look is defined once and large files read whole.
**Duration**: 1–2 weeks (incremental)
**Status**: ✅ Complete

**Context**: Web app is ~9.5k LOC; Graph3D.tsx alone is 1,645 lines. Glass surface duplicated in 6 files, prefix→severity colour map in 4 (drift), `Share Tech Mono` inline in 18. Refactor during the feature lull, behavior-preserving (gate + visual spot-check per PR), soft feature freeze.

**Detailed plan**: [Phase 6 Tasks](./phases/phase6/PHASE6_TASKS.md) · [Phase 6 README](./phases/phase6/README.md)

**Key Risk**: refactors touch shared files (collide with features) + a no-behavior-change refactor can subtly shift rendering — mitigated by small slices, soft freeze, visual checks, Graph3D split last.

---

### Phase 7: Full Interactive Terminal (xterm.js)

**Goal**: Replace the ANSI-snapshot + send-keys terminal with a real PTY-backed xterm.js emulator — full cursor control, tab-completion, arrow keys, and Claude Code's interactive TUI work from the browser.
**Duration**: TBD
**Status**: 🟢 Complete — merged to `main` (node-pty + tmux attach bridge, loopback-gated → now auth-gated by Phase 8; `XtermPane` frontend with ANSI fallback; JetBrainsMono Nerd Font). See [[phases/phase7/README]].

**Context**: The current terminal (Phase 3) captures ANSI snapshots and injects text via `tmux send-keys`. It renders colours correctly but has no PTY connection, so interactive features (arrow keys, tab-complete, Ctrl+C, Claude Code spinner/prompts) don't work.

**Key Deliverables**:

- [x] Server-side PTY bridge — WebSocket endpoint that attaches to a tmux pane via `node-pty` running `tmux attach-session` and pipes stdin/stdout bidirectionally (`apps/api/src/pty.ts`)
- [x] xterm.js frontend — `XtermPane` replaces the `<pre>` output + input box, sized to pane dimensions via `FitAddon`
- [x] Resize sync — `FitAddon`/`ResizeObserver` → `pty_resize` keeps the remote PTY matched to the browser window
- [x] Input passthrough — all keystrokes (escape sequences, arrow keys, Ctrl+\*) forwarded raw to the PTY; no special-casing
- [x] Graceful fallback — read-only ANSI snapshot preview when no PTY session is active

**Key Risk (resolved)**: xterm.js bundle weight — mitigated by lazy-loading `@xterm/xterm` + addon (the "~3 MB" was uncompressed; real cost ~250–300 KB gzipped, off the initial path).

---

### Phase 8: Auth & Access Control

**Goal**: Put an authentication layer in front of the tool. As of Phase 7 the app exposes a **full interactive shell** (PTY → `tmux attach`) plus agent spawn/teardown, raw `send-keys`, and message sending over the WS/HTTP API. Today the only control on the dangerous surfaces is a **loopback check** (`clientIsLoopback`) — which is not real authn/authz and is bypassed the moment the port is forwarded, proxied, or bound non-locally.
**Duration**: TBD
**Status**: 🟢 Complete (P1) — JWT auth shipped, PR #54. Shared-secret → HS256 JWT (`jose`) gates all privileged WS/HTTP surfaces; loopback kept as defense-in-depth; `AuthGate`/`LoginScreen` UX, no silent fallback.

**Context**: Phase 7 turned the in-UI terminal into a real PTY (full shell access to every agent's tmux session). The loopback gate is defense-in-depth, not authentication — it gives no per-operator identity, no revocation, no audit, and fails open if the service is exposed beyond localhost.

**Key Deliverables**:

- [x] **Shared-secret token on the WS handshake + HTTP requests** — rejects unauthenticated connections (WS `1008` close) before any `pty_*`, `spawn_agent`, `teardown_agent`, `pane_send_keys`, or `send_message` is processed.
- [x] **Gate ALL privileged surfaces on auth, not just loopback** — PTY attach, spawn/teardown, send-keys, message send. Loopback retained as an extra layer; auth is the primary control.
- [x] Token provisioning + storage (`AUTH_PASSWORD`→JWT server-side; token in client localStorage), with an explicit "unauthorized" UX (`AuthGate`/`LoginScreen`), no silent fallback.
- [ ] (Stretch) Per-operator identity + a basic audit log of privileged actions (who attached which PTY, who spawned/tore down). _← remaining P2 follow-on._

**Key Risk (managed)**: auth scope creep — kept v1 to a single shared secret hard-gating the dangerous endpoints; multi-user/RBAC deferred. Hardening follow-ups (shorter TTL, revocation, token off localStorage, `/auth/login` rate-limit) tracked for pre-network exposure.

---

### Phase 9 (v2): Networked & Multi-Operator

**Goal**: Support remote teams beyond a single local operator (builds on Phase 8 auth).
**Duration**: TBD
**Status**: ⚪ Not Started

**Key Deliverables**:

- [ ] HTTP proxy mode in `watcher.ts` (replace direct file import) for non-local MCP
- [ ] Docker Compose for both services
- [ ] Multi-operator: operator identity shown in DM threads + per-operator sessions

---

### Phase 10: Immersive WebXR (VR) Graph View

**Goal**: Stand inside the live force graph in room-scale VR on a Meta Quest 3S via WebXR. **Spike-first** — prove the render-loop rehost before committing to a feature.
**Duration**: TBD (gated on the PoC)
**Status**: ⚪ Not Started — exploratory, pairs with Phase 9 v2 work

**Key Deliverables**:

- [ ] "Enter VR" entry behind a `navigator.xr` capability gate (desktop unaffected when absent)
- [ ] Rehost `3d-force-graph`'s internal rAF loop into `renderer.setAnimationLoop` with `renderer.xr.enabled` — the core risk
- [ ] Live WS updates visible in-session; clean restore to the desktop path on exit
- [ ] Validation on Quest 3S + go/no-go decision (in-place rehost vs. mirror-scene fallback)

**Key Risk**: `3d-force-graph` owns its renderer/camera/rAF loop — rehosting it for WebXR is the same render-loop coupling that caused bug #43. Isolate behind a `?xr` mount; treat the desktop path as sacred. Out of scope for the spike: controllers, immersive HUD, ray/gaze selection. See [[phases/phase10/README|Phase 10]].

---

## 📊 Implementation Priority Matrix

| Phase                     | Priority    | Blocks          | Complexity | Duration  | Key Risk                              |
| ------------------------- | ----------- | --------------- | ---------- | --------- | ------------------------------------- |
| Phase 1: Foundation       | 🔴 Critical | All             | Low        | 1 week    | None                                  |
| Phase 2: Live Graph       | 🔴 Critical | Phase 3+        | Medium     | 2 weeks   | WS event schema churn                 |
| Phase 3: Polish           | 🟡 High     | v2 perception   | Medium     | 1–2 weeks | Three.js coupling complexity          |
| Phase 4: Provisioning     | 🟡 High     | operator toil   | Medium     | 1–2 weeks | Readiness races, injection            |
| Phase 5: Cockpit          | 🟡 High     | David's UX      | Medium     | 1–2 weeks | Notification spam, missed decisions   |
| Phase 6: Componentization | ✅ Done     | maintainability | Medium     | 1–2 weeks | Refactor regressions, file collisions |
| Phase 7: xterm.js         | 🟢 Medium   | Phase 3         | High       | TBD       | Bundle size, PTY lifecycle            |
| Phase 8: Auth & Access    | 🟡 High     | safe exposure   | Medium     | TBD       | Auth scope creep                      |
| Phase 9: Networked        | 🟢 Medium   | —               | High       | TBD       | Depends on Phase 8 auth               |
| Phase 10: WebXR (VR)      | 🟢 Medium   | —               | High       | TBD       | Render-loop rehost (re: bug #43)      |

**Critical Path**: Phases 1–8 complete (foundation → graph → polish → provisioning → cockpit → componentization → xterm terminal → auth). Remaining work is independent and forward-looking: Phase 9 (networked/multi-operator) and Phase 10 (WebXR/VR), plus P2 hardening follow-ons.

---

## ⚡ Quick Wins (Available Now)

1. **"Open terminal" button in the Inbox + Agent panels** (~1–2 hours · LOW complexity) — Add a button on each agent's row/header in `InboxPanel.tsx` and the agent panel (`SidePanel`/`DMPanel`) that opens that agent's live terminal. Resolve the agent's pane (`Object.values(panes).find(p => p.agentId === id)`) and call `setPaneSelection(pane.id)` — the `FloatingTerminal` already opens on `paneSelection`. Disable/hide when the agent has no matched pane. (Pairs naturally with the Phase 7 PTY terminal.)

2. **"Open in inbox" action on notifications** (~1 hour · LOW complexity) — On each notification (popup + action dock in `NotificationLayer.tsx`), add an action — alongside Ack/Dismiss — that opens the inbox to that message's thread. The store already has the wiring: `setInboxOpen(true)` + `setActiveInboxThread(notification.from)` (optionally mark-read). Lets David jump from an alert straight into the conversation instead of only acknowledging it.

3. ~~**Stale node pulse**~~ — _done._

4. ~~**Filter input in HUD**~~ — _done (HUD `nameFilter`)._

5. ~~**DM edge click**~~ — _done (`onLinkClick` in `Graph3D`)._

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

| Date       | Change                                                                                                                                                                                                   | Reason                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-08 | Initial roadmap created from kickstart                                                                                                                                                                   | Project bootstrapped; Phase 1 & 2 retrospectively documented                                                                                                                                          |
| 2026-06-08 | Added Phase 4 (xterm.js interactive terminal)                                                                                                                                                            | ANSI snapshot approach can't support cursor keys / tab-complete / Claude Code TUI                                                                                                                     |
| 2026-06-10 | Inserted Phase 4 (Agent Provisioning & Terminal Groups); renumbered xterm.js → Phase 5, Networked → Phase 6                                                                                              | Automate the manual tmux spawn/configure/join ritual from the UI; reuses existing tmux infra, high operator value                                                                                     |
| 2026-06-11 | Inserted Phase 5 (David Coordination Cockpit); renumbered xterm.js → Phase 6, Networked → Phase 7. Also: read-only Task Backlog feature shipped (discovery + parser + panel) outside the phase numbering | Make the UI David's coordination surface (DM inbox + notifications + decision cards); DM data + send path already exist                                                                               |
| 2026-06-11 | Inserted Phase 6 (UI Componentization & Design System); renumbered xterm.js → Phase 7, Networked → Phase 8                                                                                               | ~9.5k LOC web app with heavy duplication (glass ×6, severity map ×4, font ×18) + 1,645-line Graph3D; componentize during the feature lull, behavior-preserving                                        |
| 2026-06-12 | Phase 7 built (in test). Split auth out as Phase 8 (Auth & Access Control, High) ahead of networking (now Phase 9). Added "open agent terminal" button as a quick win.                                   | Phase 7's PTY exposes a full shell over WS (only loopback-gated today) → auth is now urgent + warrants its own focused phase. David requested the per-agent open-terminal button + an auth mechanism. |
| 2026-06-12 | Appended Phase 10 (Immersive WebXR/VR Graph View) — spike-first, exploratory, appended (no renumber).                                                                                                    | David has a Quest 3S to test with; the graph is already a three.js scene. Scoped as a PoC to de-risk rehosting `3d-force-graph`'s render loop into WebXR before any feature commit.                   |

---

## 🔗 Related Documents

- **[[TECH_STACK|Tech Stack]]** — Technology choices and versions
- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** — System design and patterns
- **[[DECISIONS|Decisions Log]]** — Architectural Decision Records
- **[Phase Details](./phases/)** — Detailed phase task breakdowns
- **[[CURRENT_FOCUS|Current Focus]]** — What's actively being worked on right now
- **[[prd|PRD]]** — Original product requirements
