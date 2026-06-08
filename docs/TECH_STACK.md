---
title: "Tech Stack — agent-coord-ui"
tags: [agent-coord-ui/core]
aliases: ["Tech Stack", "TECH_STACK"]
---

# agent-coord-ui — Complete Tech Stack

> Single source of truth for all technology choices, versions, and rationale. Referenced by AI agents when generating code, suggesting patterns, or debugging compatibility issues.

---

## 📋 Overview

**Project Type**: Full-stack web app — a 3D holographic command centre for monitoring and interacting with a live agent coordination bus (`agent-coord-mcp`).
**Architecture**: pnpm monorepo with Turborepo. Two apps (`apps/api`, `apps/web`) and two shared packages (`packages/shared`, `packages/ui`). No database — the API bridges directly to the `agent-coord-mcp` file-backed store.
**Primary Language**: TypeScript 5.x (strict mode, project references across all packages)

---

## 🏗️ Architecture

### Project Structure

```
agent-coord-ui/
├── apps/
│   ├── api/               # Hono + WebSocket bridge — polls agent-coord-mcp store, pushes events to UI
│   └── web/               # React + Vite SPA — 3D force graph + side-panel UI
├── packages/
│   ├── shared/            # Shared TypeScript types (BusEvent, AgentSnapshot, RoomSnapshot, MessageSnapshot)
│   └── ui/                # Shared React component primitives (if any)
├── docs/                  # Project documentation and Obsidian vault
└── logs/                  # Unified log output (api.log — captures both server + forwarded browser logs)
```

### Data Flow

```
agent-coord-mcp (file store)
        │  file poll / direct import (~1s cadence)
        ▼
   apps/api  (Hono + ws)
        │  WebSocket  ws://localhost:3000
        ▼
   apps/web  (React, Zustand store)
        │  useBusStore → Graph3D, SidePanel
        ▼
  3D Force Graph  ←→  Side Panel (DM / Room)
```

---

## 🎨 Frontend Stack (`apps/web/`)

### Core Framework & Build

| Technology | Version | Purpose                                      | Why This Choice                                                      |
| ---------- | ------- | -------------------------------------------- | -------------------------------------------------------------------- |
| React      | 19.x    | Component-based UI with concurrent rendering | Ecosystem maturity, Suspense for WS state, team familiarity          |
| Vite       | 6.x     | Build & dev server with HMR, ESM-native      | Near-instant HMR critical for iterating on 3D canvas work            |
| TypeScript | 5.x     | Strict typing across the API boundary        | Shared types via `@coord-ui/shared` prevent runtime shape mismatches |

### Styling & UI

| Technology      | Version | Purpose                                                | Why This Choice                                                        |
| --------------- | ------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Tailwind CSS    | 4.x     | Utility-first styling with CSS-first config (`@theme`) | CSS variables via `@theme` integrate cleanly with custom design tokens |
| Orbitron        | —       | Display font — HUD titles, node labels, button text    | Sci-fi register; widely recognisable as holographic UI typography      |
| Share Tech Mono | —       | Monospace data readouts, IDs, metadata                 | High legibility at small sizes, strongly technical feel                |
| Exo 2           | —       | Body / paragraph text                                  | Readable at conversational sizes, semi-condensed for dense panels      |
| Lucide React    | 0.474.x | Icon library                                           | Tree-shakeable, TypeScript-native, consistent stroke weight            |

### 3D Graph

| Technology     | Version | Purpose                                             | Why This Choice                                                     |
| -------------- | ------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| three          | 0.184.x | 3D scene, materials, lighting, custom node geometry | Required by 3d-force-graph; direct import for custom node objects   |
| 3d-force-graph | 1.73.x  | Force-directed 3D graph layout                      | Purpose-built Three.js wrapper; handles 100+ nodes with zero config |

> ⚠️ **Version pin**: `three` must stay at `^0.184.0` to match `three-render-objects@1.42.0` (transitive dep). Vite `resolve.dedupe: ['three']` ensures a single Three.js instance — do not remove this setting.

### State Management

| Technology | Version | Purpose                                               | Why This Choice                                                                                         |
| ---------- | ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Zustand    | 5.x     | Global bus state (agents, rooms, messages, selection) | Minimal boilerplate, plays well with external WS event sources, `useShallow` for stable array selectors |

### Key Frontend Patterns

- **Routing**: None — single-page, single-view app. Selection state (`useBusStore`) drives which panel is visible.
- **Data Fetching**: WebSocket only — `apps/web/src/lib/ws.ts` handles connect/reconnect; store subscribes via `busSocket.on()`.
- **Array Selectors**: Always wrap `filter`-based selectors (`roomMessages`, `dmMessages`) with `useShallow` to prevent infinite re-render loops.
- **Error Boundaries**: `ErrorBoundary.tsx` wraps the app root; client errors are POSTed to `/api/logs` and merged into the server log stream.

---

## ⚙️ Backend Stack (`apps/api/`)

### Core Framework & Runtime

| Technology | Version | Purpose                                   | Why This Choice                                                |
| ---------- | ------- | ----------------------------------------- | -------------------------------------------------------------- |
| Node.js    | 22.x    | Server runtime — event loop, native ESM   | Matches `agent-coord-mcp`; stable LTS                          |
| Hono       | 4.x     | Web framework — routing, middleware, CORS | Lightweight (~14kb), TypeScript-first, Web Standards-based     |
| ws         | —       | Native WebSocket server                   | Minimal overhead; browser WebSocket is the only client         |
| tsx        | —       | TypeScript execution (dev + watch)        | Zero-config TS in Node for dev; production would compile to JS |

### Logging

- **Library**: pino — structured NDJSON to console + rotating file at `logs/api.log`
- **Browser forwarding**: `apps/web/src/logger.ts` batches client errors and POSTs to `/api/logs`; pino re-emits with `source: "client"`
- **Result**: single `tail -f logs/api.log` captures both sides
- **Level**: controlled by `LOG_LEVEL` env var (default `info`)

### Key Backend Patterns

- **Validation**: Zod (via Hono middleware) on incoming REST payloads
- **Error Handling**: Hono's `onError` hook → structured pino error log + JSON response
- **No Database**: API reads `agent-coord-mcp` store directly (same host, file import). HTTP API mode planned for v2 networked deployment.

---

## 🔧 Infrastructure

### Package Management & Monorepo

| Technology | Version | Purpose                                                  | Why This Choice                                                    |
| ---------- | ------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| pnpm       | 10.x    | Dependency management with workspaces                    | Efficient disk usage via symlinks; first-class monorepo support    |
| Turborepo  | —       | Build orchestration — parallel tasks, content-hash cache | Reduces repeated builds in CI; simple `turbo.json` pipeline config |

### Development Environment

| Service          | URL                                         | Purpose                                          |
| ---------------- | ------------------------------------------- | ------------------------------------------------ |
| Frontend (Vite)  | http://localhost:5173                       | Dev server with HMR; proxies `/api` to port 3000 |
| Backend API + WS | http://localhost:3000 / ws://localhost:3000 | Hono server with `tsx watch` auto-reload         |

### Deployment

- **Target**: Local-only tool (v1). Single operator, same machine as `agent-coord-mcp`.
- **v2 Planned**: Docker Compose for networked / remote-team deployment with auth token.

---

## 📊 Dependency Summary

### Critical Production Dependencies

| Package          | Version  | Location   | Purpose                     | Upgrade Risk                                                                                      |
| ---------------- | -------- | ---------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| `three`          | ^0.184.0 | `apps/web` | 3D scene graph              | **High** — must match `three-render-objects` peer dep; Vite dedupe relies on exact version family |
| `3d-force-graph` | ^1.73.x  | `apps/web` | Force-directed graph layout | Medium — API stable but `nodeThreeObject` signature may change                                    |
| `zustand`        | ^5.x     | `apps/web` | Bus state                   | Low — v5 API stable; `useShallow` import path: `zustand/react/shallow`                            |
| `hono`           | ^4.x     | `apps/api` | HTTP + WS server            | Low                                                                                               |

---

## 🚀 Development Commands

```bash
# Setup
pnpm install                          # Install all workspace dependencies

# Development (run both together)
pnpm --filter @coord-ui/api dev       # Start API server on :3000 (tsx watch)
pnpm --filter @coord-ui/web dev       # Start Vite dev server on :5173

# Quality
pnpm --filter @coord-ui/web typecheck # TypeScript type check (no emit)
pnpm --filter @coord-ui/web build     # Production build (tsc + vite build)
pnpm --filter @coord-ui/web lint      # ESLint across src/

# Logs
tail -f logs/api.log                  # Unified server + browser logs
```

---

## ⚠️ Known Limitations & Future Upgrades

| Limitation                     | Impact                                  | Planned Upgrade                                        | When                             |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------ | -------------------------------- |
| No node spotlight / filter     | Hard to navigate graphs with 20+ agents | Add filter toolbar + camera focus-lock on double-click | Phase 3                          |
| No auth / multi-user           | Anyone on the network can read and send | Shared-secret token in v2                              | When networked deployment needed |
| HTTP API mode not implemented  | Requires same host as `agent-coord-mcp` | HTTP proxy mode for remote MCP                         | v2                               |
| No message history persistence | Messages lost on reload                 | Persist to local SQLite or forward from MCP store      | v2                               |

---

## 🔗 Related Documents

- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** - Why these technologies work together
- **[[DECISIONS|Decisions Log]]** - ADRs for each major technology choice
- **[[DESIGN_SYSTEM|Design System]]** - Visual language built on this stack
- **[[prd|PRD]]** - Product requirements and user stories
