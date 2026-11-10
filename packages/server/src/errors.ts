import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Thrown anywhere in a handler; `app.onError` turns it into `{ error: { code, message } }`. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);
export const invalid = (message: string) => new HttpError(422, "invalid_input", message);

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function requireString(body: Record<string, unknown>, field: string, options: { optional?: boolean; max?: number } = {}): string {
  const value = body[field];
  if (value === undefined && options.optional) return "";
  if (typeof value !== "string" || (!options.optional && !value.trim())) throw invalid(`${field} is required`);
  if (options.max && value.length > options.max) throw invalid(`${field} must be at most ${options.max} characters`);
  return value.trim();
}

export function requireOneOf<T extends string>(body: Record<string, unknown>, field: string, allowed: readonly T[], fallback?: T): T {
  const value = body[field] ?? fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw invalid(`${field} must be one of ${allowed.join(", ")}`);
}
