---
title: "Phase 10: Immersive WebXR (VR) Graph View"
tags: [agent-coord-ui/phase]
aliases: ["Phase 10"]
---

# Phase 10: Immersive WebXR (VR) Graph View

**Duration**: TBD — spike-first; a full feature estimate only after the PoC de-risks the render-loop rehost.
**Status**: 🟢 Spike Complete — validated on Quest 3S 2026-06-12; **GO on in-place rehost** (see T4 outcome in [[phases/phase10/PHASE10_TASKS|Tasks]]). Follow-ons 10.2–10.4 unlocked.
**Priority**: 🟢 Medium (exploratory) — forward-looking, pairs with [[phases/phase9/README|Phase 9]] (v2). Not on the critical path.
**Branch**: `feat/phase10-webxr`

---

## 🎯 Goal

Let an operator put on a **Meta Quest 3S** and stand inside the live agent-coordination force graph in **room-scale VR** via WebXR — nodes and message edges floating in 3D around them, updating in real time over the existing WebSocket.

**Current state**: `Graph3D.tsx` renders the graph with `3d-force-graph@1.80.0` on top of `three@0.184.0` — a real `THREE.Scene` / `THREE.WebGLRenderer`, desktop mouse/trackball only. No WebXR, no headset entry point. three.js already ships WebXR support; we just don't enable it.

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

- Access `graph.renderer()/scene()/camera()/controls()`; confirm which accessors `3d-force-graph@1.80.0` actually exposes (validate, don't assume).
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

- [x] "Enter VR" appears only on WebXR-capable browsers; desktop build & UX **unchanged** when absent.
- [x] On the Quest 3S, the operator enters an immersive session and sees the agent graph in stereoscopic 3D with head tracking.
- [x] Live WS updates (new agents, message particle bursts) are visible while in-session.
- [x] Exiting VR cleanly restores the desktop mouse/trackball graph — no frozen loop, no doubled rendering, node positions intact.
- [x] `pnpm -r typecheck` + web build + existing tests green; XR code is lazy-loaded and off the default desktop path.

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

## 🔍 Spike findings (T2.1 — validated against `3d-force-graph@1.80.0` dist source)

- ✅ `pauseAnimation()` cleanly cancels the library's internal rAF; `resumeAnimation()` restarts it.
- ✅ The internal `ThreeForceGraph` object (owner of `tickFrame()` — force sim + link particles) is added to the scene via `.objects([forceGraph])`, so it's discoverable as the scene child with a `tickFrame` method. **In-place rehost is viable — no fork, no mirror-scene fallback needed.**
- ⚠️ The library **always renders through an `EffectComposer`** (`three-render-objects` `stateInit`), which bypasses the XR framebuffer — the XR loop must call `renderer.render(scene, camera)` directly. Composer post-effects (bloom) are absent in-headset; acceptable for the spike.
- ⚠️ `WebXRManager` mutates the passed camera's pose while presenting — desktop camera + controls target are saved on `sessionstart` and restored explicitly on `sessionend`.
- ⚠️ Window rAF can be throttled while an immersive session presents, so the XR loop pumps the cosmetic material tick (`graphCosmeticTick`) directly, and the two message-path one-shot rAFs in `Graph3D` became `setTimeout(0)` (same post-effects ordering, but timers keep firing in-session).

Implementation: `apps/web/src/xr/` (`XrEntry.tsx` lazy entry · `enterXr.ts` rehost/restore · `graphHandle.ts` registry). Opt-in via `?xr`; verified code-split — zero XR bytes on the default desktop path.

## 🔌 Dev tunnel for headset testing (T4.1)

WebXR needs a secure context — plain LAN `http://` won't expose `navigator.xr` on the headset.

**Proven path (no cable) — HTTPS over LAN.** Headset and Mac on the same Wi-Fi:

```bash
XR_HTTPS=1 VITE_WS_URL=wss://<mac-lan-ip>:5173/ws pnpm dev
```

`XR_HTTPS=1` turns on `@vitejs/plugin-basic-ssl` (self-signed) + `host: true` in the vite config, and the `/ws` proxy entry carries the bus WebSocket through the same TLS origin (a secure page may not open plain `ws://` to another host). Both env vars are declared as `passThroughEnv` on the `dev` task in `turbo.json` — turbo 2's strict env mode strips them otherwise. On the headset, open `https://<mac-lan-ip>:5173/?xr=1` in the Meta Quest Browser, accept the self-signed-cert warning (the page remains a secure context), and log in — Phase 8 auth works normally. If the page won't load, check the macOS firewall (allow node).

**Alternative — adb reverse** (Quest in developer mode, **data-capable** USB-C cable — charge-only cables don't enumerate):

```bash
adb reverse tcp:5173 tcp:5173   # web (vite dev)
adb reverse tcp:3000 tcp:3000   # API + WS
```

Then `http://localhost:5173/?xr=1` on the headset — `localhost` is a secure context, no certs needed. Default dev flow (no `XR_HTTPS`) is byte-identical to before in both cases.

---

## ⏭️ Next (post-spike, if greenlit)

- **10.2** Controller interaction — ray-pick a node, grab/pan/scale the cluster.
- **10.3** Immersive HUD — port the NEXUS HUD stats into a world-space panel.
- **10.4** Gaze/ray node selection → open the DM thread / pane in a world-space panel.

See [[PRODUCTION_ROADMAP]].
