import type { AdapterId, AdapterInfo } from "@tether/contract";
import { createGraphqlAdapter } from "./graphql.ts";
import { httpAdapter } from "./http.ts";
import { loopbackAdapter } from "./loopback.ts";
import { createRestAdapter } from "./rest.ts";
import { Simulator } from "./simulation.ts";
import type { Adapter } from "./types.ts";

export type { Adapter, AdapterContext, AdapterResult, SelfFetch } from "./types.ts";

export type Adapters = Record<AdapterId, Adapter>;

/** One registry per server instance, so rate-limit and degradation counters never leak between instances. */
export function createAdapters(): Adapters {
  const simulator = new Simulator();
  return {
    rest: createRestAdapter(simulator),
    graphql: createGraphqlAdapter(simulator),
    loopback: loopbackAdapter,
    http: httpAdapter,
  };
}

export const adapterInfo = (adapters: Adapters): AdapterInfo[] => Object.values(adapters).map((a) => a.info);
