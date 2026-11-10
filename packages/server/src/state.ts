import type { Activity, Api, Exchange, Key, Preferences, Session } from "@tether/contract";

/** A key as the server keeps it: the public record plus a hash of the secret. */
export interface StoredKey {
  key: Key;
  secretHash: string;
}

export interface UsageCounter {
  requests: number;
  errors: number;
}

/** Traffic recorded from real exchanges, keyed by the start of the hour in ms. */
export interface UsageHour {
  apis: Record<string, UsageCounter>;
  keys: Record<string, number>;
}

/** The whole state file. The official catalog, health and incidents are rebuilt from code on every boot. */
export interface Persisted {
  version: 1;
  registered: Api[];
  keys: StoredKey[];
  sessions: Session[];
  exchanges: Exchange[];
  activity: Activity[];
  preferences: Preferences;
  usage: Record<string, UsageHour>;
}
