import { createHash, randomBytes, randomInt } from "node:crypto";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

export function randomString(length: number, alphabet = BASE62): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export const newId = (prefix: string, length = 8) => `${prefix}_${randomString(length, BASE36)}`;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomHex = (bytes: number) => randomBytes(bytes).toString("hex");

export const between = (min: number, max: number) => min + Math.random() * (max - min);

export function slugify(value: string, max = 32): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Deterministic PRNG so seeded traffic looks the same after every restart. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function withQuery(path: string, query: Record<string, string>): string {
  const search = new URLSearchParams(query).toString();
  return search ? `${path}?${search}` : path;
}

export const clone = <T>(value: T): T => structuredClone(value);

/** Pretty-prints JSON text; anything else passes through untouched. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export const byteLength = (text: string) => Buffer.byteLength(text, "utf8");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `12 Nov, 14:05` in the server's local time. */
export function shortStamp(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hh}:${mm}`;
}

export const defaultSessionTitle = (at: number) => `Session ${shortStamp(at)}`;
export const isDefaultSessionTitle = (title: string) => /^Session \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/.test(title);

export const isoDate = (at: number) => new Date(at).toISOString().slice(0, 10);
