---
title: "Phase 3: Polish & Production Hardening"
tags: [agent-coord-ui/phase]
aliases: ["Phase 3", "Polish Phase"]
---

# Phase 3: Polish & Production Hardening

**Duration**: 1–2 weeks
**Status**: 🟡 In Progress
**Priority**: 🟡 High — completes the PRD; gates v2 networked work

---

## 📋 Phase Overview

**Goal**: All PRD user stories demonstrable; holographic aesthetic fully implemented; app stable and navigable at 20+ nodes with zero console errors.

**Current State**: Holographic theme shipped, glow nodes working, panels stable. Three.js dedup crash and infinite re-render loop both resolved. Filter, focus-lock, and edge-click interactions remain.

**Target State**: A fully interactive holographic command centre. Any agent or room is reachable in one click. Large graphs can be filtered to reduce noise. Camera can lock onto any node. All 8 PRD user stories (U1–U8) are demonstrable end-to-end.

---

## 📊 Quick Stats

- **Tasks Remaining**: 4 (filter toolbar, focus lock, edge click, stale pulse)
- **Estimated Effort**: 1–2 days of focused work
- **Test Coverage Target**: Basic unit tests for `bus.ts` selectors and `watcher.ts` diff logic
- **Performance Target**: Graph navigable with 30+ nodes without perceptible frame drops

---

## 🎯 Key Deliverables

### Sprint 1: Aesthetic & Stability ✅ Done

- [x] **Holographic theme** — Orbitron/Share Tech Mono fonts, electric cyan `#00d4ff` palette, scanline + grain overlays
- [x] **Glow nodes** — Three.js `Group` with emissive core + dual additive-blended halos + `PointLight` per node
- [x] **Panel redesign** — Corner brackets, `holo-btn`/`holo-input` angular clip-path components, message bubble clip-paths
- [x] **`three@0.184` upgrade** — Matches `three-render-objects@1.42.0` peer dep; Vite `dedupe: ['three']` enforces single instance
- [x] **`useShallow` fix** — `roomMessages` and `dmMessages` selectors wrapped; infinite re-render loop resolved

### Sprint 2: PRD Interaction Completeness 🟡 In Progress

- [ ] **Filter toolbar** — HUD text input filters graph nodes by name. `graph.nodeVisibility(n => n.label.toLowerCase().includes(filter))`. Store filter string in Zustand. Clear button. (PRD U8)
- [ ] **Double-click focus lock** — `onNodeClick` with double-click detection: camera lerps to node position, `graph.cameraPosition({ ... })`. All other nodes dimmed to 20% opacity. (PRD U8, table row "Double-click node")
- [ ] **DM edge click** — Wire `graph.onLinkClick`: if `link.kind === 'dm'` open DM panel for source/target; if `link.kind === 'membership'` open room panel. (PRD U5)
- [ ] **Stale node pulse** — For stale agents, add `animation: glow-pulse 1s ease-in-out infinite` to the outer halo material's `opacity` via a `userData` flag + requestAnimationFrame tick in Graph3D. (PRD U7)

### Sprint 3: Quality 🟡 Not Started

- [ ] **Unit tests** — vitest tests for `roomMessages`, `dmMessages`, `selectAgentIds` in `bus.ts`; diff logic in `watcher.ts`
- [ ] **`pnpm typecheck`** — Confirm passes across all packages after Three.js upgrade

---

## ✅ Success Criteria

### Functional Requirements

- [ ] Filter input in HUD reduces visible nodes in real time; clearing restores all
- [ ] Double-clicking a node locks camera to it and dims all others
- [ ] Clicking an agent↔agent edge opens the DM thread for that pair
- [ ] Stale agents visibly pulse red to distinguish from idle (static amber)

### Quality Requirements

- [ ] Zero `Maximum update depth exceeded` errors when clicking any node
- [ ] Zero `Multiple instances of Three.js` warnings in console
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm build` completes without errors

### PRD Verification

- [ ] U1: All live agents visible as nodes ✅
- [ ] U2: Rooms visible as distinct nodes with membership edges ✅
- [ ] U3: Messages animate along edges as particles ✅
- [ ] U4: Click agent → DM panel → compose and send ✅
- [ ] U5: Click agent↔agent edge → DM thread (needs edge-click work)
- [ ] U6: Click room → room chat → compose and post ✅
- [ ] U7: Agent status encoded in node colour + glow ✅; stale pulse needs work
- [ ] U8: Filter / spotlight a single room or agent (needs filter + focus-lock)

---

## ⚠️ Risks & Mitigation

| Risk                                                                | Impact                                           | Likelihood | Mitigation                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| Three.js animation loop conflicts with `3d-force-graph` render loop | Medium — stale pulse may flicker or break layout | Low        | Use `requestAnimationFrame` inside the graph's own `onEngineTick` callback, not a separate loop |
| Camera lock competes with user orbit/pan                            | Medium — confusing UX                            | Medium     | Use a single-click → select, double-click → lock/unlock toggle; escape key to unlock            |
| Filter hides nodes that are linked to visible nodes                 | Low — edge rendering glitch                      | Medium     | Use `graph.linkVisibility` mirroring `nodeVisibility` to hide orphaned edges                    |

---

## 🚀 Getting Started

```bash
# Both servers must be running
pnpm --filter @coord-ui/api dev       # ws://localhost:3000
pnpm --filter @coord-ui/web dev       # http://localhost:5173

# After changes
pnpm --filter @coord-ui/web typecheck
```

### Before Starting Each Task

1. Check [[CURRENT_FOCUS]] for the active task
2. Reference [[DESIGN_SYSTEM]] for colour values and component patterns before writing any new UI
3. Reference [[ARCHITECTURE_GUIDE]] for the Three.js dedup constraint before touching `Graph3D.tsx`

---

## ⏭️ Next Phase

After completion: → [Phase 4: Networked Deployment](../phase4/) — auth token, HTTP API mode, Docker Compose for multi-operator remote use.

---

## 🔗 Related Documents

- **[[PRODUCTION_ROADMAP|Production Roadmap]]** — Phase context in the full roadmap
- **[[DESIGN_SYSTEM|Design System]]** — Colour values, glow system, component patterns
- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** — Three.js dedup constraint, `useShallow` pattern
- **[[DECISIONS|Decisions Log]]** — ADRs for tech choices affecting this phase
