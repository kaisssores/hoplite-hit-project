import type { Context } from "hono";
import { HttpError, isRecord } from "../errors.ts";

/** Reads a JSON object body. An empty body counts as `{}` so optional-body POSTs stay simple. */
export async function readJson(c: Context): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  if (!isRecord(parsed)) throw new HttpError(422, "invalid_input", "Body must be a JSON object");
  return parsed;
}
