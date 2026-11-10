import type { Key } from "@tether/contract";
import type { StoredKey } from "../state.ts";
import { DAY, HOUR, MINUTE, sha256 } from "../util.ts";
import { OFFICIAL_APIS } from "./catalog.ts";

export const SEED_KEY_IDS = {
  checkout: "key_checkout",
  staging: "key_staging",
  support: "key_support",
  mobile: "key_mobile",
} as const;

const allScopes = (apiId: string) => OFFICIAL_APIS.find((a) => a.id === apiId)!.scopes.map((s) => `${apiId}:${s.name}`);

function stored(key: Key): StoredKey {
  // Seed secrets are not recoverable by design; nothing in the prototype checks them.
  return { key, secretHash: sha256(`seed:${key.id}`) };
}

export function buildKeys(now: number): StoredKey[] {
  const stagingApis = OFFICIAL_APIS.filter((a) => a.id !== "reports").map((a) => a.id);
  return [
    stored({
      id: SEED_KEY_IDS.checkout,
      name: "Checkout service",
      env: "live",
      prefix: "tth_live_8f3k",
      last4: "q2Zx",
      scopes: ["payments:charges.write", "payments:charges.read", "identity:users.read", "ledger:accounts.read"],
      apiIds: ["payments", "identity", "ledger"],
      status: "active",
      createdAt: now - 94 * DAY,
      lastUsedAt: now - 3 * MINUTE,
      rotatedAt: now - 31 * DAY,
      requests: 184_212,
    }),
    stored({
      id: SEED_KEY_IDS.staging,
      name: "Staging",
      env: "test",
      prefix: "tth_test_Zk3m",
      last4: "9aLd",
      scopes: stagingApis.flatMap(allScopes),
      apiIds: stagingApis,
      status: "active",
      createdAt: now - 152 * DAY,
      lastUsedAt: now - 4 * HOUR,
      rotatedAt: null,
      requests: 41_880,
    }),
    stored({
      id: SEED_KEY_IDS.support,
      name: "Support tooling",
      env: "live",
      prefix: "tth_live_Vn72",
      last4: "Hc5t",
      scopes: ["identity:users.read", "messaging:messages.read", "search:search.query"],
      apiIds: ["identity", "messaging", "search"],
      status: "active",
      createdAt: now - 47 * DAY,
      lastUsedAt: now - 26 * MINUTE,
      rotatedAt: null,
      requests: 12_406,
    }),
    stored({
      id: SEED_KEY_IDS.mobile,
      name: "Old mobile app",
      env: "live",
      prefix: "tth_live_Rb41",
      last4: "w0Ke",
      scopes: ["identity:users.read", "files:files.read"],
      apiIds: ["identity", "files"],
      status: "revoked",
      createdAt: now - 261 * DAY,
      lastUsedAt: now - 21 * DAY,
      rotatedAt: now - 140 * DAY,
      requests: 96_330,
    }),
  ];
}
