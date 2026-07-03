# DONE — <project>

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

<!-- append here, one per line, in the pinned format above:
     - [x] <task> — owner/repo#N · YYYY-MM-DD -->
