import { fileURLToPath } from "node:url";
import { DEFAULT_PORT, TETHER_VERSION, type ServerInfo } from "@tether/contract";
import { adapterInfo, createAdapters, type Adapters, type SelfFetch } from "./adapters/index.ts";
import { Bus } from "./bus.ts";
import { HealthSim } from "./health.ts";
import { Store } from "./store.ts";

export interface RuntimeOptions {
  /** Where state is persisted. Defaults to `TETHER_DATA`, then `<repo>/.tether/state.json`. */
  dataPath?: string;
  port?: number;
  /** Scales every simulated delay. `0` removes them. Defaults to `TETHER_SPEED`, then 1. */
  speed?: number;
  /** Runs the health ticker. Tests turn it off. */
  ticker?: boolean;
  now?: () => number;
}

/** Everything a request handler or the exchange runner needs, built once per server. */
export interface Runtime {
  store: Store;
  bus: Bus;
  health: HealthSim;
  adapters: Adapters;
  speed: number;
  port: number;
  /** Set by `createApp`; lets the loopback adapter call the app without a socket. */
  self: SelfFetch;
  close(): Promise<void>;
}

export const serverInfo = (rt: Runtime): ServerInfo => ({
  version: TETHER_VERSION,
  startedAt: rt.store.startedAt,
  dataPath: rt.store.dataPath,
  adapters: adapterInfo(rt.adapters),
});

const REPO_STATE = fileURLToPath(new URL("../../../.tether/state.json", import.meta.url));

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const port = options.port ?? Number(process.env.TETHER_PORT ?? DEFAULT_PORT);
  const speed = options.speed ?? Number(process.env.TETHER_SPEED ?? 1);
  const bus = new Bus();
  const store = new Store({ dataPath: options.dataPath ?? process.env.TETHER_DATA ?? REPO_STATE, port, now: options.now }, bus);
  const health = new HealthSim(bus, options.now);
  for (const api of store.listApis()) health.ensure(api.id);
  if (options.ticker !== false) health.start();

  return {
    store,
    bus,
    health,
    adapters: createAdapters(),
    speed,
    port,
    self: () => {
      throw new Error("createApp has not been called for this runtime");
    },
    async close() {
      health.stop();
      await store.flush();
    },
  };
}
