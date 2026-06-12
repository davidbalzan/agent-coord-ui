---
title: "Phase 10 Tasks"
tags: [agent-coord-ui/phase, agent-coord-ui/tasks]
aliases: ["Phase 10 Tasks"]
---

# Phase 10: Immersive WebXR (VR) Graph View — Tasks

## Overview

Stand inside the live agent-coordination force graph in room-scale VR on a **Meta Quest 3S** via WebXR. The app already renders a real `THREE.Scene`/`WebGLRenderer` through `3d-force-graph@1.80.0` + `three@0.184.0` ([[Graph3D]]); this phase is a **proof-of-concept spike** to enable an immersive session over that existing scene — nothing more. The whole phase is gated on one unknown: whether we can rehost `3d-force-graph`'s internal render loop into `renderer.setAnimationLoop` without forking the library or regressing the desktop path.

See [[phases/phase10/README|Phase 10 README]] for goal, scope, and risks. Links: [[PRODUCTION_ROADMAP]], [[ARCHITECTURE_GUIDE]], [[TECH_STACK]], [[DECISIONS]], [[CURRENT_FOCUS]].

## 🔍 Spike Audit Summary

**CRITICAL FINDING**: `3d-force-graph` owns its renderer, camera, controls, **and rAF render loop** (via `three-render-objects`). WebXR cannot run on a plain `requestAnimationFrame` loop — it requires `renderer.xr.enabled = true` + `renderer.setAnimationLoop(cb)` rendering the XR camera each frame. So the spike's real work is a **frame-loop rehost**, not "add a button."

### 📊 Surfaces touched

- **New (web)**: `apps/web/src/xr/` — `XrGraphView.tsx` (isolated mount), `enterXr.ts` (rehost + restore logic), `VRButton` wrapper.
- **Read/validate (web)**: `apps/web/src/components/Graph3D.tsx` — the live graph instance + its Zustand→scene effects (must keep firing in-session); `graph/animationLoop.ts` (`startGraphAnimationLoop` — material-only, expected loop-agnostic).
- **Config**: Vite dev server secure-context / HTTPS or tunnel for headset LAN loading.
- **Shared types**: none expected (no new bus events for the spike).

### ⚠️ Impact Assessment

- **Render-loop coupling**: rehosting the loop is the same coupling class as bug [[project_render_loop_bug|#43]]. Treat the desktop mouse path as sacred — isolate XR behind a `?xr` mount and session state.
- **Library-internals reliance**: depends on `graph.renderer()/scene()/camera()/controls()` + a usable `tickFrame()`/`pauseAnimation()`. If absent in 1.80.0 → mirror-scene fallback (Task 4).
- **Secure context**: WebXR needs HTTPS or `localhost`; plain LAN http won't expose `navigator.xr` on the headset.
- **Comfort**: graph is in unit-space (~±400); XR is metric — needs a root transform to room scale.

### 📈 Scale

- **4 Major Tasks** (T1–T4) → spike only; full feature (controllers/HUD/selection) deferred to 10.2–10.4.
- **~3–5 new files**, ~0 desktop-path edits (isolation is the whole point).
- **Estimate**: TBD until T2 validates the rehost — that's the gate.

## 🎯 Target Architecture

### Structure

```
apps/web/src/
├── xr/
│   ├── XrGraphView.tsx     # isolated mount of the graph for an XR session (?xr=1)
│   ├── enterXr.ts          # pause lib loop → xr.enabled → setAnimationLoop → restore on sessionend
│   └── VrEntryButton.tsx   # VRButton behind navigator.xr.isSessionSupported gate
└── components/
    └── Graph3D.tsx         # UNCHANGED desktop path; XR reads its graph instance, never edits the mount
```

### Integration Pattern

- **Isolation**: XR is a separate mount reached by an explicit flag/route. The default desktop render path is never modified.
- **Loop ownership**: exactly one loop runs at a time — the library's rAF (desktop) **or** `renderer.setAnimationLoop` (XR). Switching is driven by `sessionstart`/`sessionend`.
- **Restore contract**: leaving VR must return the renderer to the library's loop with `xr.enabled = false`, node positions and camera intact.
- **Fallback**: if in-place rehost is unstable, a read-only mirror scene rebuilt from `graph.graphData()` each XR frame.

### Architecture Principles

1. **Desktop path is sacred** — zero regressions; XR is additive and isolated.
2. **One render loop at a time** — never double-drive the renderer.
3. **Validate library internals before building on them** — `tickFrame`/accessors confirmed in T2, not assumed.
4. **Spike, then decide** — the phase output may be a fallback decision, not a shipped feature. That's a success.
5. **Lazy-load XR** — keep `three/examples` + XR off the default desktop bundle path.

## 📋 Tasks

### Phase 1: Entry & Capability

#### [ ] Task 1: Spike harness + WebXR capability gate

**Priority**: HIGH
**Package**: `apps/web/src/xr`
**Dependencies**: None

**Sub-Steps**:

- [x] 1.1: Add an isolated XR mount (`XrGraphView`) reachable via `?xr=1` (or a hidden route) that mounts the existing graph — never alter the default desktop mount in `Graph3D`/`App`.
- [x] 1.2: Add `VrEntryButton` wrapping `three/examples/jsm/webxr/VRButton.js`, rendered only when `await navigator.xr?.isSessionSupported('immersive-vr')` is true.
- [x] 1.3: Lazy-load the whole XR entry so non-XR/desktop bundles are unaffected.
- [ ] 1.4: Verify on Quest 3S the button appears and a session **starts** (rendering correctness comes in T2).

**Deliverables**: an XR-capable entry that launches a session on the headset; desktop build untouched.

#### [ ] Task 2: Renderer rehost into the XR animation loop

**Priority**: CRITICAL
**Package**: `apps/web/src/xr`
**Dependencies**: Task 1

**Sub-Steps**:

- [x] 2.1: Enumerate what `3d-force-graph@1.80.0` actually exposes — `renderer()`, `scene()`, `camera()`, `controls()`, `pauseAnimation()`, `resumeAnimation()`, `tickFrame()` — and log the real surface (don't assume).
- [x] 2.2: On `sessionstart`: `graph.pauseAnimation()`, `renderer.xr.enabled = true`, `renderer.setAnimationLoop(() => { graph.tickFrame?.(); renderer.render(graph.scene(), renderer.xr.getCamera()); })`.
- [x] 2.3: Apply a root `THREE.Group` transform so the ~±400-unit cluster sits at a comfortable seated/standing scale in metres.
- [ ] 2.4: Confirm the force simulation + message particles still advance each XR frame (driven by `tickFrame`).
- [x] 2.5: **Decision checkpoint** — if no clean `tickFrame`/handoff exists, STOP and record the gap; route to Task 4 fallback. **Outcome: clean handoff exists — in-place rehost viable, no fallback needed (see README spike findings).**

**Deliverables**: the live graph rendered stereoscopically in-headset via the XR loop.

**🔄 Rollback Plan** _(risky task — render-loop coupling, see bug #43)_:

- **Revert trigger**: desktop path regresses, renderer double-drives, or positions reset on enter/exit.
- **Rollback steps**: XR is isolated behind `?xr` — disabling the entry point fully reverts; `git revert` the `xr/` additions. Desktop path was never edited.
- **Notification**: flag to coordinator/David; capture findings in [[DECISIONS]] before retrying.

### Phase 2: Live Data & Restore

#### [ ] Task 3: Live updates in-session + clean desktop restore

**Priority**: HIGH
**Package**: `apps/web/src/xr`
**Dependencies**: Task 1, Task 2

**Sub-Steps**:

- [ ] 3.1: Verify Zustand→graph effects (`agent_join/leave/update`, `room_update`, `message`, particle bursts) keep mutating the scene while in-session.
- [ ] 3.2: Confirm `startGraphAnimationLoop` (stale pulse / labels / pane waves — material mutations only) runs correctly under the XR loop.
- [x] 3.3: On `sessionend`: `renderer.setAnimationLoop(null)`, `renderer.xr.enabled = false`, `graph.resumeAnimation()`, re-fit desktop camera.
- [ ] 3.4: Regression pass — desktop mouse/trackball, focus lock, filter, node colors all behave exactly as before entering/exiting VR.

**Deliverables**: real-time graph in VR; lossless return to the desktop cockpit.

### Phase 3: Headset Validation

#### [ ] Task 4: Quest 3S validation + fallback decision

**Priority**: HIGH
**Package**: `apps/web` + dev tooling
**Dependencies**: Task 1–Task 3

**Sub-Steps**:

- [ ] 4.1: Stand up a secure context for headset LAN loading (HTTPS dev server or `localhost` port-forward/tunnel); document the steps.
- [ ] 4.2: Load on Quest 3S; capture stereoscopic rendering, head-tracking smoothness, live-update visibility, frame timing (~72/90 Hz).
- [ ] 4.3: Record outcome with a short clip/notes.
- [ ] 4.4: **Decision gate** — if in-place rehost is unstable, specify the **mirror-scene fallback** (read-only second scene rebuilt from `graph.graphData()` per XR frame) and scope it as the real Phase 10 feature path in [[DECISIONS]].

**🎯 SUCCESS CRITERIA**: a clear go/no-go on the in-place rehost, validated on real hardware, with the feature path (rehost vs mirror) decided and documented.

## 🎯 Success Criteria

### Functional

- [ ] "Enter VR" shows only on WebXR-capable browsers; desktop UX unchanged when absent.
- [ ] Operator enters an immersive session on Quest 3S and sees the graph in stereoscopic 3D with head tracking.
- [ ] Live WS updates (new agents, message particle bursts) visible in-session.
- [ ] Exiting VR cleanly restores the desktop graph — no frozen loop, no double render, positions intact.

### Quality

- [ ] `pnpm -r typecheck` passes across packages.
- [ ] Web build green; existing web tests green.
- [ ] XR code lazy-loaded; default desktop bundle path unaffected.
- [ ] No new ESLint errors.

### Architecture

- [ ] Desktop render path in `Graph3D` unmodified (XR reads, never edits the mount).
- [ ] Exactly one render loop active at a time (library rAF XOR XR `setAnimationLoop`).
- [ ] Library-internals reliance validated (T2.1), not assumed; gap → documented fallback.

## 📅 Estimated Timeline

**Phase 1 (Entry & Capability)**: 0.5–1 day — button + isolated mount + session start.
**Phase 2 (Renderer rehost + restore)**: TBD — **gated on T2.1 validation**; this is the unknown that sizes the phase.
**Phase 3 (Headset validation + decision)**: 0.5–1 day on hardware.

**Total**: not estimable until the T2 rehost is proven — that is precisely why this phase is a spike, not a feature commit.

## 📝 Notes

- WebXR requires a **secure context** — the headset can't access `navigator.xr` over plain LAN http. Sort the HTTPS/tunnel story early (T4.1) or testing stalls.
- This phase may legitimately conclude with a **fallback decision** rather than a shipped VR view. Capturing the go/no-go + the mirror-scene path in [[DECISIONS]] is a complete, valuable outcome.
- Treat the desktop render loop as untouchable — the [[project_render_loop_bug|#43 node-pulse/hydration regression]] came from exactly this coupling.
- Controllers, immersive HUD, and ray/gaze selection are **out of scope** here — they're 10.2–10.4 follow-ons, only if the spike greenlights the rehost.
