type Level = "debug" | "info" | "warn" | "error";

type Entry = {
  level: Level;
  message: string;
  context?: unknown;
  ts: string;
};

const ENDPOINT = "/api/logs";
const FLUSH_MS = 1000;
const MAX_BATCH = 20;

let queue: Entry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  timer = null;
  try {
    const body = JSON.stringify(batch);
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort; never throw from logger
  }
}

function enqueue(entry: Entry) {
  queue.push(entry);
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flush);
  window.addEventListener("error", (e) => {
    enqueue({
      level: "error",
      message: e.message,
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
      ts: new Date().toISOString(),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    enqueue({
      level: "error",
      message: "unhandledrejection",
      context: { reason: String(e.reason) },
      ts: new Date().toISOString(),
    });
  });
}

function emit(level: Level, message: string, context?: unknown) {
  const consoleFn =
    level === "debug" ? console.log : (console[level] as typeof console.log);
  consoleFn(`[${level}]`, message, context ?? "");
  enqueue({ level, message, context, ts: new Date().toISOString() });
}

export const logger = {
  debug: (m: string, c?: unknown) => emit("debug", m, c),
  info: (m: string, c?: unknown) => emit("info", m, c),
  warn: (m: string, c?: unknown) => emit("warn", m, c),
  error: (m: string, c?: unknown) => emit("error", m, c),
};
