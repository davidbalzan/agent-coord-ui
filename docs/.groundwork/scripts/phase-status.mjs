#!/usr/bin/env node
/**
 * phase-status — deterministic phase progress report.
 * Shipped into a Groundwork project at docs/.groundwork/scripts/.
 * Run on demand (or via `groundwork status`) so percentages are computed, not guessed.
 *
 * Usage:
 *   node phase-status.mjs            # all phases
 *   node phase-status.mjs 2          # phase 2 only
 */
import fs from "node:fs";
import path from "node:path";

const arg = process.argv[2];
const root = "docs/phases";
if (!fs.existsSync(root)) {
  console.error("✗ docs/phases not found. Run /plan-phase first.");
  process.exit(1);
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/PHASE.*TASKS\.md$/i.test(e.name)) files.push(p);
  }
})(root);

const filtered = arg
  ? files.filter((f) => new RegExp(`phase0*${arg}\\b`, "i").test(f))
  : files;

if (filtered.length === 0) {
  console.error(arg ? `✗ No tasks file for phase ${arg}.` : "✗ No PHASE*_TASKS.md files.");
  process.exit(1);
}

let gDone = 0,
  gTotal = 0;
for (const f of filtered.sort()) {
  const text = fs.readFileSync(f, "utf8");
  const { done, total } = count(text);
  gDone += done;
  gTotal += total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const label = f.split(path.sep).slice(-2, -1)[0] || path.basename(f);
  console.log(`${label}  ${bar(pct)} ${String(pct).padStart(3)}%  (${done}/${total})`);
}

if (filtered.length > 1) {
  const pct = gTotal ? Math.round((gDone / gTotal) * 100) : 0;
  console.log("─".repeat(40));
  console.log(`TOTAL     ${bar(pct)} ${String(pct).padStart(3)}%  (${gDone}/${gTotal})`);
}

function count(text) {
  let done = 0,
    total = 0;
  for (const l of text.split("\n")) {
    if (/^\s*-\s*\[[xX]\]/.test(l)) (done++, total++);
    else if (/^\s*-\s*\[ \]/.test(l)) total++;
  }
  return { done, total };
}
function bar(pct, w = 20) {
  const f = Math.round((pct / 100) * w);
  return "█".repeat(f) + "░".repeat(Math.max(0, w - f));
}
