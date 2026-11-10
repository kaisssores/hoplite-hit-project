import type { AdapterInfo, ApiHealth, Api, Endpoint, ExchangeRequest, ExchangeResponse, Key } from "@tether/contract";

/** Calls the server's own routes without a socket. Used by the loopback adapter. */
export type SelfFetch = (path: string, init: RequestInit) => Response | Promise<Response>;

export interface AdapterContext {
  api: Api;
  /** `null` when the request does not match any documented endpoint. */
  endpoint: Endpoint | null;
  request: ExchangeRequest;
  key: Key | null;
  health: ApiHealth;
  /** Multiplier for every simulated delay. `0` removes them. */
  speed: number;
  sessionId: string;
  self: SelfFetch;
}

export type AdapterResult =
  | { ok: true; response: ExchangeResponse }
  | { ok: false; code: string; message: string };

/**
 * How the server reaches an API. Routes and the exchange runner only know this interface;
 * which adapter an API uses is data on the API itself.
 */
export interface Adapter {
  info: AdapterInfo;
  send(ctx: AdapterContext): Promise<AdapterResult>;
}
