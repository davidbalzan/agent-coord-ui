#!/usr/bin/env node
/**
 * check-task — flip a task checkbox to done and recompute progress.
 * Shipped into a Groundwork project at docs/.groundwork/scripts/.
 * The /check-task skill calls this so checkbox math is deterministic.
 *
 * Usage:
 *   node check-task.mjs <task-id|text> [path/to/PHASEN_TASKS.md]
 *   node check-task.mjs 2.3
 *   node check-task.mjs "implement auth middleware" docs/phases/phase2/PHASE2_TASKS.md
 */
import fs from "node:fs";
import path from "node:path";

const [needle, explicitFile] = process.argv.slice(2);
if (!needle) {
  console.error("Usage: node check-task.mjs <task-id|text> [tasks-file]");
  process.exit(1);
}

const file = explicitFile || findTasksFile();
if (!file || !fs.existsSync(file)) {
  console.error("✗ No phase tasks file found. Pass one explicitly.");
  process.exit(1);
}

const lines = fs.readFileSync(file, "utf8").split("\n");
const isId = /^\d+(\.\d+)*$/.test(needle);
let hit = -1;

for (let i = 0; i < lines.length; i++) {
  if (!/^\s*-\s*\[ \]/.test(lines[i])) continue;
  const text = lines[i].toLowerCase();
  if (isId) {
    // Match "2.3" as a token (start of task text or "N.M:")
    if (new RegExp(`\\b${needle.replace(".", "\\.")}\\b`).test(lines[i])) {
      hit = i;
      break;
    }
  } else if (text.includes(needle.toLowerCase())) {
    hit = i;
    break;
  }
}

if (hit === -1) {
  console.error(`✗ No open task matching "${needle}" in ${file}`);
  process.exit(1);
}

lines[hit] = lines[hit].replace(/\[ \]/, "[x]");
const updated = recomputeProgress(lines.join("\n"));
fs.writeFileSync(file, updated.text);

console.log(`✓ Marked done: ${lines[hit].replace(/^\s*-\s*\[x\]\s*/, "").trim()}`);
console.log(
  `  Progress: ${updated.done}/${updated.total} (${updated.pct}%)  ${bar(updated.pct)}`
);
if (updated.done === updated.total)
  console.log("  🎉 All tasks complete — consider updating the roadmap & QUEUE/DONE.");

// ---------- helpers ----------
function findTasksFile() {
  const root = "docs/phases";
  if (!fs.existsSync(root)) return null;
  const found = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/PHASE.*TASKS\.md$/i.test(e.name)) found.push(p);
    }
  })(root);
  // Prefer the file with the most open checkboxes (the active phase).
  return found.sort((a, b) => openCount(b) - openCount(a))[0] || null;
}
function openCount(f) {
  return (fs.readFileSync(f, "utf8").match(/^\s*-\s*\[ \]/gm) || []).length;
}
function recomputeProgress(text) {
  let done = 0,
    total = 0;
  for (const l of text.split("\n")) {
    if (/^\s*-\s*\[[xX]\]/.test(l)) (done++, total++);
    else if (/^\s*-\s*\[ \]/.test(l)) total++;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  // Update an existing "Overall Progress" line if present.
  text = text.replace(
    /(\*\*Overall Progress\*\*:).*$/m,
    `$1 ${done}/${total} tasks (${pct}%)`
  );
  return { text, done, total, pct };
}
function bar(pct, w = 20) {
  const f = Math.round((pct / 100) * w);
  return "█".repeat(f) + "░".repeat(Math.max(0, w - f));
}
