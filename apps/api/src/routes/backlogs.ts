import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { HttpBindings } from "@hono/node-server";
import { loadAllBacklogs, rewriteQueueRegion } from "../backlog.js";
import { requireAuth } from "../auth.js";
import { logger } from "../logger.js";

const QueueItemSchema = z.object({
  priority: z.enum(["P1", "P2", "P3"]),
  text: z.string().min(1),
  refs: z.string().default(""),
  checked: z.literal(false).default(false),
});

const PutQueueSchema = z.object({
  queue: z.array(QueueItemSchema),
});

const app = new Hono<{ Bindings: HttpBindings }>();

app.get("/backlogs", requireAuth, async (c) => {
  try {
    const backlogs = await loadAllBacklogs();
    return c.json(backlogs);
  } catch (err) {
    logger.error({ err }, "backlogs: failed to load backlogs");
    return c.json({ error: "Failed to load backlogs" }, 500);
  }
});

// PUT /backlogs/:projectId/queue — auth required, rewrites ## Queue region atomically
app.put(
  "/backlogs/:projectId/queue",
  requireAuth,
  zValidator("json", PutQueueSchema),
  async (c) => {
    const projectId = decodeURIComponent(c.req.param("projectId"));
    const { queue } = c.req.valid("json");

    try {
      const updated = await rewriteQueueRegion(projectId, queue);
      return c.json(updated);
    } catch (err) {
      logger.error({ err, projectId }, "backlogs: failed to rewrite queue");
      return c.json({ error: "Failed to write queue" }, 500);
    }
  }
);

export { app as backlogRoutes };
