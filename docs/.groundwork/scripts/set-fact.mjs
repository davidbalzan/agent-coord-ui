#!/usr/bin/env node
/*
 * set-fact.mjs — deterministic upsert into docs/FACTS.md.
 *
 * Usage:
 *   node docs/.groundwork/scripts/set-fact.mjs <fact-id> "<claim>" --by <agent> --method "<how>"
 *
 * Writes (or replaces, matched by id) one entry in the pinned FACTS grammar:
 *   - `fact-id` — claim
 *     verified: YYYY-MM-DDTHH:MMZ · by: agent · method: how
 *
 * Timestamp is stamped here (UTC, minute precision) so agents can't fabricate or forget it.
 * Atomic write: temp file + rename. Exits non-zero on malformed input or missing FACTS.md.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--by" || args[i] === "--method" || args[i] === "--file") {
    flags[args[i].slice(2)] = args[++i];
  } else positional.push(args[i]);
}
const [id, claim] = positional;

const usage = () => {
  console.error(
    'usage: set-fact.mjs <fact-id> "<claim>" --by <agent> --method "<how>" [--file docs/FACTS.md]'
  );
  process.exit(1);
};
if (!id || !claim || !flags.by || !flags.method) usage();
if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error(`fact id must be kebab-case (got \`${id}\`)`);
  process.exit(1);
}
if (/\n/.test(claim) || /\n/.test(flags.method)) {
  console.error("claim and method must be single-line");
  process.exit(1);
}

const file = path.resolve(flags.file || "docs/FACTS.md");
if (!fs.existsSync(file)) {
  console.error(`${file} not found — run \`groundwork init\`/\`update --docs\` first`);
  process.exit(1);
}

const ts = new Date().toISOString().slice(0, 16) + "Z"; // YYYY-MM-DDTHH:MMZ
const entry = `- \`${id}\` — ${claim}\n  verified: ${ts} · by: ${flags.by} · method: ${flags.method}`;

const text = fs.readFileSync(file, "utf8");
const lines = text.split("\n");

// Locate an existing entry with this id (entry line + its indented meta line, if any).
const entryRe = new RegExp(`^- \`${id}\` — `);
const start = lines.findIndex((l) => entryRe.test(l));
let out;
if (start >= 0) {
  const hasMeta = /^ {2}verified:/.test(lines[start + 1] || "");
  lines.splice(start, hasMeta ? 2 : 1, ...entry.split("\n"));
  out = lines.join("\n");
} else {
  const facts = lines.findIndex((l) => /^## Facts\s*$/.test(l));
  if (facts < 0) {
    console.error("no `## Facts` section in FACTS.md — file is malformed");
    process.exit(1);
  }
  // Append after the last existing content of the section (end of file or next heading).
  let end = lines.length;
  for (let i = facts + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  while (end > facts + 1 && lines[end - 1].trim() === "") end--;
  lines.splice(end, 0, "", ...entry.split("\n"));
  out = lines.join("\n");
}

const tmp = `${file}.${process.pid}.tmp`;
fs.writeFileSync(tmp, out);
fs.renameSync(tmp, file);
console.log(`${start >= 0 ? "updated" : "added"} \`${id}\` (verified: ${ts})`);
