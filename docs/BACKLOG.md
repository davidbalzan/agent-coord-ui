# Backlog — agent-coord-ui

> Inbound task queue for the coordinator. David (and the agent-coord-ui UI) edit `## Queue`;
> the coordinator appends completed items to `## Done` with a PR ref. Append-only on Done —
> never edit the Queue region (David's / the UI's region).
>
> Queue item format (priority MUST be parenthesized):
> `- [ ] (P1) <task> — optional refs/constraints`
> Done item format:
> `- [x] <task> — <PR ref> · YYYY-MM-DD`

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

## Done

<!-- Coordinator appends completed items here with PR refs. Append-only. -->

- [x] (P1) Phase 8 — shared-secret token on WS handshake + HTTP; reject unauthenticated before any pty\_\*, spawn/teardown, pane_send_keys, send_message — PR #54 · 2026-06-12
- [x] (P1) Phase 8 — gate ALL privileged surfaces on auth (not just loopback); loopback kept as defense-in-depth — PR #54 · 2026-06-12
- [x] (P1) Phase 8 — token provisioning + storage (AUTH_PASSWORD→JWT, client localStorage) with explicit "unauthorized" UX (AuthGate/LoginScreen), no silent fallback — PR #54 · 2026-06-12
- [x] (P2) node-pty install hardening — dev preflight (scripts/preflight.mjs) resolves deps + reapplies spawn-helper +x + load-tests the native binding before `tsx watch`; fails fast with "run pnpm install" instead of ERR_MODULE_NOT_FOUND crash-loop — PR #55 · 2026-06-12
- [x] (P2) Doc reconciliation — marked Phase 3/5/7/8 complete in PRODUCTION_ROADMAP (boxes ticked, verified vs shipped code); refreshed CURRENT_FOCUS.md + roadmap header + readiness/critical-path; phase5/phase7 README acceptance boxes ticked — PR #55 · 2026-06-12
