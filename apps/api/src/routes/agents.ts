import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { HttpBindings } from "@hono/node-server";
import type { Context, Next } from "hono";
import { loadPresets, savePresets } from "../presets.js";
import { logger } from "../logger.js";

// ─── Loopback gate ────────────────────────────────────────────────────────────

export function isLoopback(addr: string | undefined): boolean {
  return (
    addr === "127.0.0.1" ||
    addr === "::1" ||
    addr === "::ffff:127.0.0.1" ||
    addr === "localhost"
  );
}

async function requireLoopback(
  c: Context<{ Bindings: HttpBindings }>,
  next: Next
) {
  const addr = c.env?.incoming?.socket?.remoteAddress;
  if (!isLoopback(addr)) {
    logger.warn({ addr }, "rejected non-loopback preset write");
    return c.json({ error: "Local access only" }, 403);
  }
  return next();
}

// ─── Input validation ─────────────────────────────────────────────────────────

// Block the most dangerous shell injection chars; {} are allowed for template placeholders.
const NO_SHELL_META = /^[^;&|`$\n\r\0]+$/;

const presetSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\w-]+$/, "id must be alphanumeric/underscore/hyphen only"),
  label: z.string().min(1).max(100),
  model: z
    .string()
    .regex(/^[\w.-]+$/, "model must be alphanumeric/dot/hyphen only"),
  role: z.enum(["coordinator", "worker"]),
  lane: z
    .string()
    .max(64)
    .regex(/^[\w-]*$/, "lane must be alphanumeric/underscore/hyphen only")
    .optional(),
  rooms: z
    .array(
      z
        .string()
        .min(1)
        .max(64)
        .regex(
          /^[\w-]+$/,
          "room name must be alphanumeric/underscore/hyphen only"
        )
    )
    .optional(),
  repoPath: z
    .string()
    .max(512)
    .refine(
      (v) => NO_SHELL_META.test(v),
      "repoPath contains shell metacharacters"
    )
    .optional(),
  launchCmd: z
    .string()
    .min(1)
    .max(256)
    .refine(
      (v) => NO_SHELL_META.test(v),
      "launchCmd contains shell metacharacters"
    ),
  skillInvocation: z
    .string()
    .min(1)
    .max(512)
    .refine(
      (v) => NO_SHELL_META.test(v),
      "skillInvocation contains shell metacharacters"
    ),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const agentRoutes = new Hono<{ Bindings: HttpBindings }>();

// GET — open (read-only)
agentRoutes.get("/agents/presets", async (c) => {
  const presets = await loadPresets();
  return c.json(presets);
});

// POST — loopback only
agentRoutes.post(
  "/agents/presets",
  requireLoopback,
  zValidator("json", presetSchema),
  async (c) => {
    const body = c.req.valid("json");
    const presets = await loadPresets();
    if (presets.find((p) => p.id === body.id)) {
      return c.json({ error: `Preset "${body.id}" already exists` }, 409);
    }
    presets.push(body);
    await savePresets(presets);
    logger.info({ id: body.id }, "preset created");
    return c.json(body, 201);
  }
);

// PUT — loopback only
agentRoutes.put(
  "/agents/presets/:id",
  requireLoopback,
  zValidator("json", presetSchema),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const presets = await loadPresets();
    const idx = presets.findIndex((p) => p.id === id);
    if (idx === -1) {
      return c.json({ error: `Preset "${id}" not found` }, 404);
    }
    presets[idx] = body;
    await savePresets(presets);
    logger.info({ id }, "preset updated");
    return c.json(body);
  }
);

// DELETE — loopback only
agentRoutes.delete("/agents/presets/:id", requireLoopback, async (c) => {
  const id = c.req.param("id");
  const presets = await loadPresets();
  const idx = presets.findIndex((p) => p.id === id);
  if (idx === -1) {
    return c.json({ error: `Preset "${id}" not found` }, 404);
  }
  presets.splice(idx, 1);
  await savePresets(presets);
  logger.info({ id }, "preset deleted");
  return c.body(null, 204);
});
