// node-pty ships prebuilt `spawn-helper` binaries, but pnpm extracts them
// without the execute bit — which makes `pty.spawn()` fail at runtime with
// "Error: posix_spawnp failed." Restore +x after every install.
// Best-effort and silent: no-op if node-pty isn't installed or on platforms
// without a spawn-helper (e.g. Windows).
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readdirSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/**
 * Restore +x on node-pty's prebuilt spawn-helper binaries. Best-effort:
 * returns silently if node-pty isn't resolvable or the platform has no helper.
 */
export function fixNodePtyPermissions() {
  let prebuildsDir;
  try {
    prebuildsDir = join(
      dirname(require.resolve("node-pty/package.json")),
      "prebuilds",
    );
  } catch {
    return; // node-pty not resolvable — nothing to fix
  }

  try {
    for (const platform of readdirSync(prebuildsDir)) {
      const helper = join(prebuildsDir, platform, "spawn-helper");
      try {
        chmodSync(helper, 0o755);
      } catch {
        // no spawn-helper for this platform (e.g. win32) — skip
      }
    }
  } catch {
    // prebuilds dir missing — skip
  }
}

// Run when invoked directly as the `postinstall` hook.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fixNodePtyPermissions();
}
