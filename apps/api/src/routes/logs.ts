import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logger } from "../logger.js";

const entrySchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string().max(4000),
  context: z.unknown().optional(),
  ts: z.string().optional(),
});

const payloadSchema = z.union([entrySchema, z.array(entrySchema).max(50)]);

export const logRoutes = new Hono();

logRoutes.post("/logs", zValidator("json", payloadSchema), (c) => {
  const body = c.req.valid("json");
  const entries = Array.isArray(body) ? body : [body];
  const ua = c.req.header("user-agent");
  for (const e of entries) {
    logger[e.level](
      { source: "client", ua, context: e.context, clientTs: e.ts },
      e.message
    );
  }
  return c.body(null, 204);
});
