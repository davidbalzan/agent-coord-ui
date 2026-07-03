#!/usr/bin/env node
/**
 * check-versions — compare the project's pinned dependencies against the latest
 * stable on the npm registry, so docs/STACK_MAP.md never silently goes stale.
 * Shipped into a Groundwork project at docs/.groundwork/scripts/.
 *
 * Usage:
 *   node check-versions.mjs            # check the curated stack present in package.json(s)
 *   node check-versions.mjs --all      # check every dependency
 *   node check-versions.mjs react vite # check specific packages
 *
 * Exit code: 0 if all up to date, 1 if any are behind (useful in CI / bootstrap).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const all = args.includes("--all");
const explicit = args.filter((a) => !a.startsWith("--"));

// Curated "this is the stack" list — only those actually present get checked.
const CURATED = new Set([
  "react", "react-dom", "vite", "@vitejs/plugin-react",
  "hono", "@hono/node-server", "zod",
  "tailwindcss", "typescript", "turbo", "vitest",
  "eslint", "prettier",
  "drizzle-orm", "drizzle-kit", "postgres", "mysql2", "better-sqlite3",
  "zustand",
]);

const deps = collectDeps();
const names = explicit.length
  ? explicit
  : Object.keys(deps).filter((n) => all || CURATED.has(n));

if (names.length === 0) {
  console.log("No matching dependencies found in package.json. Try --all.");
  process.exit(0);
}

console.log("Checking latest stable versions on the npm registry…\n");
const rows = [];
let behind = 0;
for (const name of names.sort()) {
  const current = deps[name] || "(not installed)";
  let latest = "?";
  try {
    latest = execFileSync("npm", ["view", name, "version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    latest = "(lookup failed)";
  }
  const state = classify(current, latest);
  if (state.behind) behind++;
  rows.push({ name, current, latest, label: state.label });
}

const w = Math.max(...rows.map((r) => r.name.length), 7);
console.log(`${"package".padEnd(w)}  ${"pinned".padEnd(12)} ${"latest".padEnd(12)} status`);
console.log("─".repeat(w + 40));
for (const r of rows) {
  console.log(
    `${r.name.padEnd(w)}  ${r.current.padEnd(12)} ${r.latest.padEnd(12)} ${r.label}`
  );
}

console.log(
  behind
    ? `\n${behind} package(s) behind. Plan bumps as a dedicated workstream and update docs/STACK_MAP.md.`
    : "\n✓ All checked packages are on the latest stable major."
);
process.exit(behind ? 1 : 0);

// ---------- helpers ----------
function collectDeps() {
  const files = ["package.json"];
  for (const dir of ["apps", "packages"]) {
    if (fs.existsSync(dir)) {
      for (const sub of fs.readdirSync(dir)) {
        const p = path.join(dir, sub, "package.json");
        if (fs.existsSync(p)) files.push(p);
      }
    }
  }
  const out = {};
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const pkg = JSON.parse(fs.readFileSync(f, "utf8"));
    Object.assign(out, pkg.dependencies, pkg.devDependencies);
  }
  return out;
}

function major(v) {
  const m = String(v).replace(/^[\^~>=<\s]+/, "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function classify(current, latest) {
  const cM = major(current);
  const lM = major(latest);
  if (cM === null || lM === null) return { behind: false, label: "·" };
  if (cM < lM) return { behind: true, label: `⬆ ${lM - cM} major behind` };
  if (cM > lM) return { behind: false, label: "ahead?" };
  // same major — compare full for a soft hint
  const clean = (v) => String(v).replace(/^[\^~>=<\s]+/, "");
  return clean(current) === latest
    ? { behind: false, label: "✓ latest" }
    : { behind: false, label: "✓ current major (minor/patch available)" };
}
