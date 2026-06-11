import { Hono } from "hono";
import { loadAllBacklogs } from "../backlog.js";
import { logger } from "../logger.js";

const app = new Hono();

app.get("/backlogs", async (c) => {
  try {
    const backlogs = await loadAllBacklogs();
    return c.json(backlogs);
  } catch (err) {
    logger.error({ err }, "backlogs: failed to load backlogs");
    return c.json({ error: "Failed to load backlogs" }, 500);
  }
});

export { app as backlogRoutes };
