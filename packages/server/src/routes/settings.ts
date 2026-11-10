import type { UsageRange } from "@tether/contract";
import { Hono } from "hono";
import { InvalidPreferences, mergePreferences } from "../preferences.ts";
import { HttpError, invalid } from "../errors.ts";
import type { Runtime } from "../runtime.ts";
import { buildUsage } from "../usage.ts";
import { readJson } from "./http.ts";

const RANGES: UsageRange[] = ["24h", "7d", "30d"];

export function settingsRoutes(rt: Runtime): Hono {
  const { store, health } = rt;
  const app = new Hono();

  app.get("/usage", (c) => {
    const range = c.req.query("range") ?? "24h";
    if (!(RANGES as string[]).includes(range)) throw invalid(`range must be one of ${RANGES.join(", ")}`);
    return c.json(buildUsage(range as UsageRange, store, health, Date.now()));
  });

  app.get("/preferences", (c) => c.json(store.getPreferences()));

  app.put("/preferences", async (c) => {
    try {
      return c.json(store.setPreferences(mergePreferences(store.getPreferences(), await readJson(c))));
    } catch (error) {
      if (error instanceof InvalidPreferences) throw new HttpError(422, "invalid_preferences", error.message);
      throw error;
    }
  });

  return app;
}
