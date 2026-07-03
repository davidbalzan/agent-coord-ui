---
title: "Facts"
tags: [groundwork/core]
aliases: ["Facts", "Fact Store", "Verified Facts"]
---

# Facts

> **Verified project facts — the shared world-model.** One entry per settled question about
> this project's reality ("does X exist?", "is Y enabled?"). A claim belongs here only once
> it has been _verified_; everything else is a hypothesis that stays in conversation.

This is the seam file next to `[[QUEUE]]` (inbound), `[[WORKSTREAMS]]` (live), and
`[[DONE]]` (completion log): **FACTS.md** is the _settled_ state — answers that were
verified once so they don't get re-derived, re-asserted, and drift. Useful solo,
essential with multiple agents.

**Write rules:**

- **One writer per fact:** whoever verified it writes it. A conflicting read replaces the
  entry (don't append a duplicate id).
- Every entry carries **when**, **who**, and **how** it was verified. `groundwork doctor`
  flags entries missing those, and entries older than 14 days.
- Other docs and messages **cite fact ids** instead of restating the claim.
- Re-verify on dispute or staleness — update the `verified:` line in place.

**Entry format (pinned — required, not just an example):**

```
- `fact-id` — the claim, stated so it stays true or false
  verified: YYYY-MM-DDTHH:MMZ · by: who-verified · method: how it was verified
```

One fact per entry: stable kebab-case id in backticks · **em-dash `—` (U+2014)** · claim on
the first line; the indented second line uses **middot `·` (U+00B7)** separators — exact
glyphs, not ASCII. Parsers (doctor, `set-fact.mjs`, UIs) split on those glyphs.

## Facts

<!-- add entries in the pinned format above, e.g.:
     - `auto-disavow-flag` — does NOT exist anywhere in the codebase
       verified: 2026-07-02T14:30Z · by: disavow-worker-1 · method: git grep + gh api origin/main
-->
