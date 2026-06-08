# AI Learnings

Accumulated knowledge about AI integration patterns from project experience.

## Entries

- [2026-01-23] Use structured output (JSON schemas) for consistent AI responses
- [2026-01-23] Support multiple AI providers (Claude, local LLMs) with provider abstraction
- [2026-02-18] pi-mono (badlogic/pi-mono) has proven patterns for agent state machines, message steering/interruption, mid-session model handoff, subagent orchestration, and streaming granularity. Documented in `docs/REFERENCE_PI_MONO.md` for incremental adoption into baseAgent. We stay on Vercel AI SDK + Zod but borrow the architectural ideas.
- [2026-02-20] Prefer injecting dynamic context (dates, user info, environment state) directly into the system prompt over teaching the agent to look it up via tools. This is more token-efficient (~15 tokens vs a full tool call iteration) and always accurate. Applied this pattern for date/time injection in run-session.ts.
