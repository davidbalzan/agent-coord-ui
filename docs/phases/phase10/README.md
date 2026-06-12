---
title: "Phase 10: Immersive WebXR (VR) Graph View"
tags: [agent-coord-ui/phase]
aliases: ["Phase 10"]
---

# Phase 10: Immersive WebXR (VR) Graph View

**Duration**: TBD — spike-first; a full feature estimate only after the PoC de-risks the render-loop rehost.
**Status**: ⚪ Not Started
**Priority**: 🟢 Medium (exploratory) — forward-looking, pairs with [[phases/phase9/README|Phase 9]] (v2). Not on the critical path.
**Branch**: `feat/phase10-webxr` (when started)

---

## 🎯 Goal

Let an operator put on a **Meta Quest 3S** and stand inside the live agent-coordination force graph in **room-scale VR** via WebXR — nodes and message edges floating in 3D around them, updating in real time over the existing WebSocket.

**Current state**: `Graph3D.tsx` renders the graph with `3d-force-graph@1.73.5` on top of `three@0.184.0` — a real `THREE.Scene` / `THREE.WebGLRenderer`, desktop mouse/trackball only. No WebXR, no headset entry point. three.js already ships WebXR support; we just don't enable it.

**Target state (this phase = PoC spike)**: an "Enter VR" button appears in a WebXR-capable browser; pressing it on the Quest 3S drops the operator into the graph in stereoscopic 3D with head tracking and live updates, **without breaking the existing desktop 2D/mouse render path or the node-pulse / hydration behavior**. Controller interaction, immersive HUD, and ray/gaze node selection are explicitly **out of scope for the spike** (see Phase 10.x follow-ons).

---

## 🧩 The core technical problem

`3d-force-graph` owns its own renderer, camera, controls, **and `requestAnimationFrame` render loop** (via `three-render-objects`). WebXR is incompatible with a plain rAF loop: an immersive session must be driven by **`renderer.setAnimationLoop(cb)`** with **`renderer.xr.enabled = true`**, and rendering must use the XR camera each frame.

So the spike is fundamentally about **rehosting the frame loop** without forking the library:

1. Get the internal objects the library exposes: `graph.renderer()`, `graph.scene()`, `graph.camera()`, `graph.controls()`.
2. Pause the library's own loop (`graph.pauseAnimation()`).
3. Set `renderer.xr.enabled = true`, mount a `VRButton`.
4. Drive frames ourselves: `renderer.setAnimationLoop(() => { graph.tickFrame?.(); renderer.render(graph.scene(), <xr camera>) })` — advancing the force sim + particle ticks each XR frame.
5. On session end, restore the desktop path: `setAnimationLoop(null)`, `graph.resumeAnimation()`.

**The key unknown to validate first**: whether `3d-force-graph`/`three-render-objects` exposes a usable per-frame tick (`tickFrame()`) and whether `pauseAnimation()` + manual rehost cleanly hands the renderer to XR and back. If it does not, fall back to a parallel read-only XR scene that mirrors `graph.scene()` (Task 4 fallback) rather than driving the live instance.

This is the same render-loop coupling class that produced the [[project_render_loop_bug|node-pulse/hydration bug (#43)]] — treat the desktop path as sacred and guard every change behind session state.

---

## 📋 Task Breakdown

### Task 1 — Spike harness + capability gate (`apps/web`) · HIGH · no deps

- Add `VRButton` (from `three/examples/jsm/webxr/VRButton.js`) behind a `navigator.xr?.isSessionSupported('immersive-vr')` check — render nothing on non-XR browsers (desktop unaffected).
- New isolated entry: a `?xr=1` route/flag or a dedicated `XrGraphView` that mounts the existing graph so the spike never touches the default desktop mount path.
- Verify the button appears and a session **starts** in the Quest 3S browser (even before rendering is correct).

### Task 2 — Renderer rehost into the XR loop · CRITICAL · dep: T1

- Access `graph.renderer()/scene()/camera()/controls()`; confirm which accessors `3d-force-graph@1.73.5` actually exposes (validate, don't assume).
- `graph.pauseAnimation()`, `renderer.xr.enabled = true`, `renderer.setAnimationLoop(...)` driving `graph.tickFrame?.()` + `renderer.render(scene, renderer.xr.getCamera())`.
- Scale/position the world to room scale (the graph spans ~±400 units; XR is in metres — apply a root `THREE.Group` transform so the cluster sits at a comfortable ~1.5 m standing distance).

### Task 3 — Live updates + desktop restore · HIGH · deps: T1+T2

- Confirm WS deltas (`agent_join/leave/update`, `message`, particle bursts) still mutate the scene while in-session — the Zustand→graph effects must keep firing.
- Keep `startGraphAnimationLoop` (stale pulse / labels / pane waves) running in XR (it only mutates materials — should be loop-agnostic; verify).
- On `sessionend`: `setAnimationLoop(null)`, restore `renderer.xr.enabled = false`, `graph.resumeAnimation()`, re-fit desktop camera. **No desktop regression** is the bar.

### Task 4 — Validation on Quest 3S + fallback decision · HIGH · deps: T1–T3

- Load on the Quest 3S over LAN (needs HTTPS or `http://localhost` port-forward — WebXR requires a secure context; document the dev-tunnel setup).
- Capture: does it render stereoscopically, head-track smoothly, and update live? Frame timing acceptable (~72/90 Hz)?
- **Decision gate**: if the in-place rehost is unstable, document the **mirror-scene fallback** (a second read-only `THREE.Scene` rebuilt from `graph.graphData()` each frame, rendered by an XR-owned renderer) and scope it as the real Phase 10 feature path.

---

## ✅ Success Criteria (spike)

- [ ] "Enter VR" appears only on WebXR-capable browsers; desktop build & UX **unchanged** when absent.
- [ ] On the Quest 3S, the operator enters an immersive session and sees the agent graph in stereoscopic 3D with head tracking.
- [ ] Live WS updates (new agents, message particle bursts) are visible while in-session.
- [ ] Exiting VR cleanly restores the desktop mouse/trackball graph — no frozen loop, no doubled rendering, node positions intact.
- [ ] `pnpm -r typecheck` + web build + existing tests green; XR code is lazy-loaded and off the default desktop path.

---

## ⚠️ Risks

| Risk                                                                  | Impact                                          | Likelihood | Mitigation                                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `3d-force-graph` exposes no usable `tickFrame()` / clean loop handoff | 🔴 High — blocks in-place rehost                | 🟡 Medium  | Validate in Task 2 **before** building further; fall back to the mirror-scene path (Task 4) instead of forking |
| Render-loop rehost regresses the desktop path (re: bug #43)           | 🔴 High — breaks the primary product            | 🟡 Medium  | Isolated `?xr` mount; guard everything behind session state; restore on `sessionend`; desktop path untouched   |
| WebXR secure-context requirement (HTTPS) for LAN headset testing      | 🟡 Medium — can't load on Quest over plain http | 🔴 High    | Document a dev tunnel / `localhost` port-forward / self-signed HTTPS for the Vite dev server                   |
| World scale / comfort (graph in unit-space vs metres) causes nausea   | 🟡 Medium                                       | 🟡 Medium  | Root `THREE.Group` transform; seated default; conservative locomotion (none in spike — head-look only)         |
| Bundle bloat from XR example modules                                  | 🟢 Low                                          | 🟡 Medium  | Lazy-load the XR entry; tree-shake `three/examples` imports                                                    |

---

## 🔗 Dependencies

- **Required**: the live three.js graph ([[phases/phase3/README|Phase 3]] / Graph3D) — already in place.
- **Optional**: none. Independent of auth/networking, but if the headset loads the app over LAN it inherits [[phases/phase8/README|Phase 8]] auth (login on the headset browser).
- **Blocks**: nothing — exploratory leaf phase.

### External Dependencies

- Meta Quest 3S with the Meta Quest Browser (WebXR support).
- A secure context to load the dev app on the headset (HTTPS or `localhost` forward).

---

## ⏭️ Next (post-spike, if greenlit)

- **10.2** Controller interaction — ray-pick a node, grab/pan/scale the cluster.
- **10.3** Immersive HUD — port the NEXUS HUD stats into a world-space panel.
- **10.4** Gaze/ray node selection → open the DM thread / pane in a world-space panel.

See [[PRODUCTION_ROADMAP]].
