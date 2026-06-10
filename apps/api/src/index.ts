import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import "dotenv/config";
import { env } from "./env.js";
import { logger, logFilePath } from "./logger.js";
import { healthRoutes } from "./routes/health.js";
import { logRoutes } from "./routes/logs.js";
import { agentRoutes } from "./routes/agents.js";
import { busWatcher } from "./watcher.js";
import { attachWss } from "./ws.js";

const app = new Hono();

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durMs: Date.now() - start,
    },
    "request"
  );
});

app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
  })
);

app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "unhandled error");
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.route("/api", healthRoutes);
app.route("/api", logRoutes);
app.route("/api", agentRoutes);

const server = serve({ fetch: app.fetch, port: env.API_PORT }, () => {
  logger.info(
    { port: env.API_PORT, logFile: logFilePath },
    `Server running on http://localhost:${env.API_PORT}`
  );
});

// @ts-expect-error — serve() returns a node http.Server at runtime
attachWss(server);
busWatcher
  .start()
  .catch((err) => logger.error({ err }, "busWatcher.start error"));

export default app;
