// Dev preflight — runs before `tsx watch` so a stale install fails fast with an
// actionable message instead of a cryptic ERR_MODULE_NOT_FOUND crash-loop.
//
// Two things bite the dev pair after a fresh `git pull`:
//   1. A new runtime dependency landed in package.json but `pnpm install` wasn't
//      re-run — the import throws ERR_MODULE_NOT_FOUND deep in the call stack.
//   2. node-pty's prebuilt spawn-helper lost its +x bit (pnpm strips it), so the
//      native binding loads but pty.spawn() later dies with "posix_spawnp failed".
// Catch both here, up front, and tell the operator exactly what to do.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixNodePtyPermissions } from "./fix-node-pty-permissions.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "..");
const require = createRequire(join(apiRoot, "package.json"));

function fail(msg) {
  console.error(`\n[preflight] ${msg}\n`);
  process.exit(1);
}

// 1. Every declared runtime dependency must resolve. A missing one means the
//    lockfile moved but `pnpm install` wasn't re-run after the pull.
const pkg = JSON.parse(readFileSync(join(apiRoot, "package.json"), "utf8"));
const missing = [];
for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (name.startsWith("@coord-ui/")) continue; // workspace pkgs built by turbo
  try {
    require.resolve(name);
  } catch {
    missing.push(name);
  }
}
if (missing.length > 0) {
  fail(
    `Missing dependencies: ${missing.join(", ")}.\n` +
      `Your install is stale after a pull — run \`pnpm install\` from the repo root, then retry.`,
  );
}

// 2. Re-apply the spawn-helper exec bit, then confirm the native binding loads.
fixNodePtyPermissions();
try {
  require("node-pty");
} catch (err) {
  fail(
    `node-pty failed to load (${err.code ?? err.message}).\n` +
      `Run \`pnpm install\` from the repo root to restore the native binding.`,
  );
}

console.log("[preflight] deps OK — node-pty native binding loaded.");
