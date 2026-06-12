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
**Phase**: Post–Phase 8 — P2 hardening + Phase 9/10 forward planning
**Task**: node-pty dev preflight + doc reconciliation (this pass); Phase 10 (WebXR/VR) planned
**Branch**: `main`

---

## Quick Context

**What we're doing**: Phases 1–8 are complete — the holographic graph, all 8 PRD interactions, agent provisioning, the coordination cockpit (inbox + notifications + decision cards), UI componentization, the PTY-backed xterm terminal, and JWT auth (PR #54) all shipped. Current work is P2 hardening and forward planning, not a single feature push.

**Why**: With the core product done and auth in place, the focus shifts to operational robustness (clean fresh-pull startup, accurate docs) and de-risking the next exploratory phases.

**Blocked by**: Nothing.

**Next up** (in order):

1. ✅ node-pty install hardening — dev preflight fails fast on a stale install (committed)
2. ✅ Doc reconciliation — phase statuses + CURRENT_FOCUS refreshed (this pass)
3. `handleSend` `to`-field path-traversal validation (P2 security fast-follow from the #54 review — awaiting go-ahead)
4. Phase 8 stretch — per-operator audit log of privileged actions
5. Phase 10 — WebXR/VR PoC spike (planned; needs a secure-context dev tunnel for the Quest 3S)

---

## Key Files

- Graph rendering: `apps/web/src/components/Graph3D.tsx`
- PTY terminal: `apps/web/src/components/terminal/XtermPane.tsx` · `apps/api/src/pty.ts`
- Auth: `apps/api/src/auth.ts` · `apps/web/src/lib/auth.ts` · `apps/api/src/env.ts`
- Bus state: `apps/web/src/store/bus.ts`
- Dev preflight: `apps/api/scripts/preflight.mjs`
- Architecture constraint (Three.js dedup): `apps/web/vite.config.ts`

---

## Dev Environment

```bash
pnpm --filter @coord-ui/api dev    # API at ws://localhost:3000 (runs scripts/preflight.mjs first)
pnpm --filter @coord-ui/web dev    # UI at http://localhost:5173
tail -f logs/api.log               # Unified logs
```

> Auth is live locally: API needs `apps/api/.env` with `AUTH_JWT_SECRET` + `AUTH_PASSWORD` set (gitignored). The web app shows a login screen; log in to mint a JWT.

---

## Recently Resolved

- ✅ **Phase 8 auth** — JWT (HS256/`jose`) gating all privileged WS/HTTP surfaces; loopback as defense-in-depth (PR #54)
- ✅ **node-pty stale-install crash-loop** — dev preflight resolves deps + reapplies spawn-helper +x before `tsx watch`
- ✅ **Multiple Three.js instances** — `three@0.184.0` + `resolve.dedupe: ['three']` in Vite config (ADR-006)
- ✅ **Infinite re-render on room/DM panels** — `useShallow` on all array selectors (ADR-008)
- ✅ **Holographic NEXUS theme** — glow nodes, Orbitron/Share Tech Mono fonts, scanlines, corner bracket panels (ADR-007)

---

## Session Notes

_Clear between sessions. Add blockers, discoveries, or context here during active work._

---

## Last Updated

**Date**: 2026-06-12
**Status**: Phases 1–8 complete (auth shipped, PR #54). P2 hardening + Phase 9/10 planning.
