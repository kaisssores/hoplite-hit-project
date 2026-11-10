import type { Env, Key, KeyInput, KeySecret } from "@tether/contract";
import type { StoredKey } from "./state.ts";
import { newId, randomString, sha256 } from "./util.ts";

const PREFIX_LENGTH = 13;

export function generateSecret(env: Env): string {
  return `tth_${env}_${randomString(24)}`;
}

/** Only the hash and the display fragments survive; the secret itself is returned once and forgotten. */
function describe(secret: string): Pick<Key, "prefix" | "last4"> {
  return { prefix: secret.slice(0, PREFIX_LENGTH), last4: secret.slice(-4) };
}

export function issueKey(input: KeyInput, now: number): { stored: StoredKey; secret: string } {
  const secret = generateSecret(input.env);
  const key: Key = {
    id: newId("key"),
    name: input.name.trim(),
    env: input.env,
    ...describe(secret),
    scopes: [...input.scopes],
    apiIds: [...input.apiIds],
    status: "active",
    createdAt: now,
    lastUsedAt: null,
    rotatedAt: null,
    requests: 0,
  };
  return { stored: { key, secretHash: sha256(secret) }, secret };
}

export function rotateKey(stored: StoredKey, now: number): { stored: StoredKey; secret: string } {
  const secret = generateSecret(stored.key.env);
  return {
    stored: { key: { ...stored.key, ...describe(secret), rotatedAt: now }, secretHash: sha256(secret) },
    secret,
  };
}

export const withSecret = (key: Key, secret: string): KeySecret => ({ key, secret });
