---
name: check-versions
description: Check the project's dependencies against latest stable and flag drift
argument-hint: "[--all | package names]"
allowed-tools: Read, Glob, Grep, Bash
---

# Check Versions - Dependency Freshness Audit

Verify the project is on current, stable dependency versions and keep
`docs/STACK_MAP.md` honest. Run this when bootstrapping a project and periodically
afterwards — drift is silent otherwise.

## Fast path (preferred)

The project ships a deterministic helper that queries the npm registry:

```bash
node docs/.groundwork/scripts/check-versions.mjs        # curated stack present in package.json
node docs/.groundwork/scripts/check-versions.mjs --all  # every dependency
node docs/.groundwork/scripts/check-versions.mjs react vite   # specific packages
```

It prints `pinned vs latest` with a status column and exits non-zero if anything is a
major behind. Run it and narrate the result.

## Instructions

1. **Run the script** above. If it is absent, read each `package.json` (root +
   `apps/*` + `packages/*`) and check key deps with `npm view <pkg> version`.
2. **Summarize drift** — group into:
   - ✅ on latest stable
   - 🟡 same major, newer minor/patch available (safe bumps)
   - 🔴 one or more majors behind (needs a planned migration)
3. **Reconcile with `docs/STACK_MAP.md`**:
   - Update the `Latest stable` column and the `Last audited` date.
   - For majors behind, add/refresh a row in the **Pending upgrades** section.
4. **Do NOT bump inline.** Recommend each major bump as its own workstream
   (`/update-workstreams`) on a dedicated branch with build + test verification.
   Minor/patch bumps can be batched into one small stream.

Run once right after `/kickstart` (whenever a `package.json` exists) so the first
`STACK_MAP.md` reflects reality, and periodically after. Report the table, the drift
summary, and the STACK_MAP edits you made (or propose); flag anything that should become an
upgrade workstream.

Packages/flags: $ARGUMENTS
