---
title: "Current Focus"
tags: [agent-coord-ui/core]
aliases: ["Focus", "Current Work"]
---

# Current Focus

> Quick reference for AI assistants and team members to instantly know where work stands.

---

## Active Work

**Project**: agent-coord-ui — 3D holographic command centre for agent coordination
**Phase**: Phase 3 — Polish & Production Hardening
**Task**: Node filter toolbar + remaining PRD interactions
**Branch**: `main`

---

## Quick Context

**What we're doing**: Completing Phase 3 — the holographic aesthetic is shipped and the Three.js/Zustand stability issues are resolved. Remaining work is the four PRD interactions that aren't yet implemented: filter toolbar, double-click focus lock, DM edge click, and stale node animated pulse.

**Why**: These four items complete all 8 PRD user stories (U1–U8) and make the graph navigable at scale (20+ nodes).

**Blocked by**: Nothing.

**Next up** (in order):

1. Filter toolbar in HUD (`graph.nodeVisibility` + Zustand `nameFilter` string)
2. DM edge click (`graph.onLinkClick` → open appropriate panel)
3. Stale node animated pulse (CSS keyframe on outer halo)
4. Double-click camera focus lock (`graph.cameraPosition` + node dim)

---

## Key Files

- Graph rendering: `apps/web/src/components/Graph3D.tsx`
- HUD + filter: `apps/web/src/components/HUD.tsx`
- Bus state: `apps/web/src/store/bus.ts`
- Design tokens: `apps/web/src/index.css`
- Architecture constraint (Three.js dedup): `apps/web/vite.config.ts`

---

## Dev Environment

```bash
pnpm --filter @coord-ui/api dev    # API at ws://localhost:3000
pnpm --filter @coord-ui/web dev    # UI at http://localhost:5173
tail -f logs/api.log               # Unified logs
```

---

## Recently Resolved

- ✅ **Multiple Three.js instances** — `three@0.184.0` + `resolve.dedupe: ['three']` in Vite config (ADR-006)
- ✅ **Infinite re-render on room/DM panels** — `useShallow` on all array selectors (ADR-008)
- ✅ **Holographic NEXUS theme** — glow nodes, Orbitron/Share Tech Mono fonts, scanlines, corner bracket panels (ADR-007)

---

## Session Notes

_Clear between sessions. Add blockers, discoveries, or context here during active work._

---

## Last Updated

**Date**: 2026-06-08
**Status**: Phase 3 in progress — 5/8 deliverables done
