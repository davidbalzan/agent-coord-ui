import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { HttpBindings } from "@hono/node-server";
import { authConfigured, issueToken, passwordMatches } from "../auth.js";
import { logger } from "../logger.js";

const loginSchema = z.object({ password: z.string().min(1).max(512) });

export const authRoutes = new Hono<{ Bindings: HttpBindings }>();

// Lets the client decide whether to show the login screen. No secrets leaked.
authRoutes.get("/auth/status", (c) =>
  c.json({ authRequired: authConfigured() })
);

// Exchange the shared operator password for a short-lived signed JWT.
authRoutes.post("/auth/login", zValidator("json", loginSchema), async (c) => {
  if (!authConfigured()) {
    return c.json({ error: "auth not configured" }, 503);
  }
  const { password } = c.req.valid("json");
  if (!passwordMatches(password)) {
    const addr = c.env?.incoming?.socket?.remoteAddress;
    logger.warn({ addr }, "auth: failed login attempt");
    return c.json({ error: "invalid credentials" }, 401);
  }
  const token = await issueToken();
  return c.json({ token });
});
