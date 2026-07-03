# QUEUE — agent-coord-ui

The inbound task queue. Phases are planned via `/plan-phase` and appear here as single items
referencing the full task breakdown. Ad-hoc tasks (bug fixes, improvements) are added directly by
the human. This file is intake only: live in-flight state lives in [[WORKSTREAMS]], completions
are recorded in `docs/DONE.md`.

**Write rule (single writer per file):** the human (or their planning proxy) writes here — add /
reorder / remove / edit items, set priority (`P1`/`P2`/`P3`; top-to-bottom breaks ties), add
constraints, acceptance criteria, or refs inline. Whoever executes work never edits this file — it
reads the top unblocked item fresh and appends the completion to `docs/DONE.md` instead. Pruning
satisfied items is the writer's job. No compare-and-swap ceremony needed: the filesystem enforces
the boundary.

## Queue

<!-- David / UI edit this region. Top-down priority: P1 > P2 > P3. -->

- [ ] (P1) Phase 8 — shared-secret token on the WS handshake + HTTP requests — reject unauthenticated connections before any pty\_\*, spawn_agent, teardown_agent, pane_send_keys, or send_message is processed
- [ ] (P1) Phase 8 — gate ALL privileged surfaces on auth, not just loopback (PTY attach, spawn/teardown, send-keys, send_message); keep loopback as defense-in-depth
- [ ] (P1) Phase 8 — token provisioning + storage (server env/secret; entered/stored client-side) with an explicit "unauthorized" UX, no silent fallback
- [ ] (P2) Phase 8 (stretch) — per-operator identity + audit log of privileged actions (who attached which PTY, who spawned/tore down)
- [ ] (P3) Phase 10 — Immersive WebXR (VR) graph view: PoC spike to view the live 3D graph in VR on a Meta Quest 3S. Rehost 3d-force-graph's render loop into renderer.setAnimationLoop + renderer.xr; isolate behind a `?xr` mount, no desktop regression (re: render-loop bug #43). See docs/phases/phase10/
- [ ] (P3) Phase 9 — HTTP proxy mode in watcher.ts (replace direct file import for non-local MCP)
- [ ] (P3) Phase 9 — Docker Compose for both services (web + api)
- [ ] (P3) Phase 9 — multi-operator: operator identity shown in DM threads + per-operator sessions
- [ ] (P3) Message persistence — messages currently lost on reload (PRD v1 non-goal; revisit)
