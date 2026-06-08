import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import pretty from "pino-pretty";

function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  return start;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(here);
const logDir = resolve(repoRoot, "logs");
mkdirSync(logDir, { recursive: true });

const fileStream = createWriteStream(resolve(logDir, "api.log"), {
  flags: "a",
});
const isDev = process.env.NODE_ENV !== "production";
const consoleStream = isDev ? pretty({ colorize: true }) : process.stdout;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "api", pid: process.pid },
  },
  pino.multistream([{ stream: fileStream }, { stream: consoleStream }])
);

export const logFilePath = resolve(logDir, "api.log");
