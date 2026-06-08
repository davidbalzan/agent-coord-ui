---
title: "Architecture Guide — agent-coord-ui"
tags: [agent-coord-ui/core]
aliases: ["Architecture Guide", "ARCHITECTURE_GUIDE"]
---

# agent-coord-ui — Architecture Guide

> Documents **why** architectural decisions were made, not just what they are. Primary reference for AI agents and developers making consistent design decisions.

---

## 🏗️ Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/web (React SPA)                     │
│                                                                 │
│  ┌──────────────────┐       ┌───────────────────────────────┐  │
│  │   Graph3D        │       │  SidePanel                    │  │
│  │  (Three.js /     │◄─────►│  ├── DMPanel (agent thread)   │  │
│  │  3d-force-graph) │       │  └── RoomPanel (room chat)    │  │
│  └──────────────────┘       └───────────────────────────────┘  │
│          ▲                              ▲                       │
│          └──────────────────────────────┘                       │
│                        Zustand (useBusStore)                    │
│                        busSocket.on() → store.set()             │
│                             ▲                                   │
│                     ws://localhost:3000                         │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    apps/api (Hono + ws)                         │
│  watcher.ts polls agent-coord-mcp store (~1s cadence)           │
│  Diffs state → emits BusEvents to all connected WS clients      │
│  REST: POST /api/messages (send DM or room post)                │
│        POST /api/logs     (client error forwarding)             │
└─────────────────────────────┬───────────────────────────────────┘
                              │ file import / HTTP
                ┌─────────────▼──────────────┐
                │     agent-coord-mcp         │
                │  (file-backed store, same   │
                │   host as this process)     │
                └────────────────────────────┘
```

### Key Components

- **`apps/web` — React SPA**: Owns all UI. Subscribes to the WS event stream via `busSocket`, maintains all state in a single Zustand store. Renders a full-screen 3D graph (Three.js) with a slide-in side panel for selected nodes. No server-side rendering; single-operator local tool.
- **`apps/api` — Hono bridge**: The only process that touches `agent-coord-mcp`. Polls the store, diffs state, pushes `BusEvent` frames to connected WS clients. Exposes a tiny REST API for message sends and log forwarding. Does NOT hold business logic — it is a pure reactive bridge.
- **`packages/shared` — Type contract**: `BusEvent`, `AgentSnapshot`, `RoomSnapshot`, `MessageSnapshot`. This is the API boundary. Changing a type here is a breaking change that affects both apps simultaneously — treat with care.

### Communication Patterns

- **Frontend ↔ API**: Native browser WebSocket at `ws://localhost:3000`. JSON frames typed as `BusEvent`. The WS URL is overridable via `VITE_WS_URL` env var.
- **API ↔ MCP Store**: Direct file import (same host, v1). The watcher reads store files at ~1s cadence and computes diffs.
- **Cross-Package**: TypeScript project references with `workspace:*` protocol. Types flow from `packages/shared` → `apps/api` and `apps/web`. No runtime package publish needed.

---

## 🤔 Why a Pure WebSocket Event Stream?

### The Problem

`agent-coord-mcp` is a file-backed store — it doesn't push events. The UI needs live updates as agents join, leave, and post messages without polling from the browser.

### Decision

The API layer acts as a stateful bridge: it polls the store, computes diffs, and pushes typed `BusEvent` frames over WebSocket. The browser never polls; it reacts.

### Alternatives Considered

1. **SSE (Server-Sent Events)**
   - Pros: Simpler than WS, built into browsers, HTTP/2-multiplexable
   - Cons: Unidirectional — the operator can't send messages back without a separate REST call. Coupling two transports adds complexity.
   - Rejected because: The operator needs to post to rooms and DM agents. Bidirectional WS handles both directions in one connection.

2. **Browser polling the MCP store directly**
   - Pros: No bridge needed
   - Cons: The MCP store is a local file — not accessible from the browser. Would require exposing it via HTTP anyway.
   - Rejected because: Same work, worse result.

### Why WS + Hono Bridge is Better

- Single connection handles both receive (graph updates) and send (DM, room post)
- `auto-reconnect` logic in `ws.ts` makes the UI resilient to API restarts
- Bridge can be extracted to HTTP API mode (v2) without any frontend changes — just swap the `VITE_WS_URL`

---

## 🤔 Why Three.js Custom Node Objects for Glow?

### The Problem

`3d-force-graph` renders plain solid spheres by default. The holographic aesthetic requires emissive glow halos on nodes that convey agent status at a glance.

### Decision

Use `nodeThreeObject` to return a custom `THREE.Group` per node: inner solid emissive sphere + two outer additive-blended transparent spheres as bloom approximation + a `PointLight` for local scene illumination.

### The Deduplication Constraint

`3d-force-graph` bundles its own Three.js internally via `three-render-objects`. Importing `three` directly without deduplication creates two Three.js instances — the library's internal renderer doesn't recognise materials/geometries created from the external instance, causing `Cannot read properties of undefined (reading 'setFromMatrixPosition')`.

**Fix enforced in `vite.config.ts`**:

```ts
resolve: {
  dedupe: ["three"];
}
```

This forces both imports to the same module instance. `three` must be `^0.184.0` to satisfy `three-render-objects@1.42.0`'s peer dep — do not downgrade.

### Why Not Post-Processing Bloom?

`UnrealBloomPass` / `EffectComposer` would produce higher-quality bloom but requires taking over the renderer setup from `3d-force-graph`. The dual-sphere additive blending approach achieves ~80% of the visual result with zero renderer coupling.

---

## 📁 Directory Structure

```
apps/web/src/
├── components/
│   ├── Graph3D.tsx      # Three.js scene wrapper — node/link rendering only, no business logic
│   ├── HUD.tsx          # Top status bar — reads agent/room counts from store
│   ├── SidePanel.tsx    # Container — reads selection, renders DMPanel or RoomPanel
│   ├── DMPanel.tsx      # Agent DM thread + compose
│   └── RoomPanel.tsx    # Room chat + member list + compose
├── store/
│   └── bus.ts           # Zustand store — single source of truth for all WS state
├── lib/
│   └── ws.ts            # WebSocket client — connect, reconnect, on(), send()
├── index.css            # Tailwind + @theme tokens + global animation keyframes
└── main.tsx             # Entry — ErrorBoundary wraps App

apps/api/src/
├── index.ts             # Hono server entry — HTTP + WS upgrade
├── watcher.ts           # Polls agent-coord-mcp store, diffs, emits BusEvents
└── router.ts            # REST routes (/api/messages, /api/logs)

packages/shared/src/
└── index.ts             # BusEvent union type + snapshot interfaces
```

### File Naming Conventions

- **Components**: `PascalCase.tsx` — e.g., `Graph3D.tsx`, `RoomPanel.tsx`
- **Utilities / lib**: `camelCase.ts` — e.g., `ws.ts`, `bus.ts`
- **No barrel exports** in components — import each file directly to keep HMR fast

---

## 📈 Upgrade Paths

### Current State

**What**: Single-host local tool. API reads MCP store by direct file import. No auth. Single WS endpoint.
**Best for**: One operator, one machine, one `agent-coord-mcp` instance.

### Growing → Networked Deployment

**When to upgrade**:

- Team grows beyond one operator
- `agent-coord-mcp` runs on a different host

**Migration effort**: Medium (~2 days)
**Strategy**: Replace direct file import in `watcher.ts` with HTTP calls to `agent-coord-mcp`'s API. Add shared-secret token to WS handshake. Docker Compose wraps both services.

### Maturity → Multi-Bus / Federation

**When to upgrade**:

- Need to monitor multiple independent `agent-coord-mcp` instances in one view

**Migration effort**: High (~2 weeks)
**Strategy**: `apps/api` becomes a fan-in multiplexer. `packages/shared` adds a `busId` discriminator to all events.

---

## ✅ Best Practices

### 1. Array Selectors Must Use `useShallow`

```tsx
// DO: Stable reference via shallow comparison
const msgs = useBusStore(useShallow((s) => roomMessages(s, roomId)));

// DON'T: Inline filter returns new array every render → infinite re-render loop
const msgs = useBusStore((s) => roomMessages(s, roomId));
```

### 2. Three.js Objects Must Use the Deduplicated `three` Import

```tsx
// DO: Import from 'three' — Vite dedupe ensures this is the same instance as 3d-force-graph
import * as THREE from "three";

// DON'T: Import from the bundled copy inside 3d-force-graph or three-render-objects
// There is no public path to that copy — this serves as a reminder not to fight the dedup
```

### 3. All Backend Logging via `getLogger()`, Never `console.*`

```ts
// DO:
const logger = getLogger();
logger.info("ws", "client connected", { clientId });

// DON'T: console.log leaks unstructured output and bypasses the unified log file
```

---

## 🔗 Related Documents

- **[[DECISIONS|Decisions Log]]** - Detailed ADRs for every major architectural choice
- **[[TECH_STACK|Tech Stack]]** - Technology choices with versions, rationale, and upgrade risks
- **[[CURRENT_FOCUS|Current Focus]]** - What's actively being worked on
- **[[DESIGN_SYSTEM|Design System]]** - Holographic visual language and component patterns
- **[[prd|PRD]]** - Original product requirements
