# DONE — agent-coord-ui

The completion log — **append-only, the executor is the sole writer** (solo you, or an external
coordinator pulling from `docs/QUEUE.md`). On completing a queue item, append one line with the PR
ref. Nobody else writes here, and the executor writes nowhere else in the queue seam (it never
touches `docs/QUEUE.md`; the queue's writer prunes satisfied items there).

**Done-line format (pinned — required, not just an example):**

```
- [x] <task> — owner/repo#N · YYYY-MM-DD
```

Use the **em-dash `—` (U+2014)** before the PR ref and the **middot `·` (U+00B7)** before the
date — exact glyphs, not ASCII. Parsers that consume this file (e.g. the agent-coord-ui
BacklogPanel) split on those glyphs; an ASCII hyphen/period renders the panel empty.

## Done

<!-- Coordinator appends completed items here with PR refs. Append-only. -->

- [x] (P1) Phase 8 — shared-secret token on WS handshake + HTTP; reject unauthenticated before any pty\_\*, spawn/teardown, pane_send_keys, send_message — PR #54 · 2026-06-12
- [x] (P1) Phase 8 — gate ALL privileged surfaces on auth (not just loopback); loopback kept as defense-in-depth — PR #54 · 2026-06-12
- [x] (P1) Phase 8 — token provisioning + storage (AUTH_PASSWORD→JWT, client localStorage) with explicit "unauthorized" UX (AuthGate/LoginScreen), no silent fallback — PR #54 · 2026-06-12
- [x] (P2) node-pty install hardening — dev preflight (scripts/preflight.mjs) resolves deps + reapplies spawn-helper +x + load-tests the native binding before `tsx watch`; fails fast with "run pnpm install" instead of ERR_MODULE_NOT_FOUND crash-loop — PR #55 · 2026-06-12
- [x] (P2) Doc reconciliation — marked Phase 3/5/7/8 complete in PRODUCTION_ROADMAP (boxes ticked, verified vs shipped code); refreshed CURRENT_FOCUS.md + roadmap header + readiness/critical-path; phase5/phase7 README acceptance boxes ticked — PR #55 · 2026-06-12
- [x] (P3) Phase 10 — WebXR (VR) graph view PoC spike: in-place render-loop rehost validated GO on Quest 3S (stereo, tracking, live WS updates, clean exit/restore); ?xr lazy entry, 0 desktop-path bytes; XR_HTTPS no-cable dev loop documented — PR #56 · 2026-06-12
- [x] (P1) Queue-split step 1 (agent-coordination#5) — backlog reader prefers docs/QUEUE.md + docs/DONE.md, per-side legacy BACKLOG.md fallback, tolerant headerless parse (#58 class), rewriteQueueRegion targets QUEUE.md when present; parity verified on real backlog across legacy/split/mixed — PR #59 · 2026-07-03
