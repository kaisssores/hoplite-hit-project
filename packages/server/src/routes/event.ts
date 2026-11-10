import type { ServerEvent } from "@tether/contract";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serverInfo, type Runtime } from "../runtime.ts";

const HEARTBEAT_MS = 15_000;

/** One long-lived stream per client. Every message is a bare `data:` line so `EventSource.onmessage` receives it. */
export function eventRoutes(rt: Runtime): Hono {
  const app = new Hono();

  app.get("/event", (c) =>
    streamSSE(c, async (stream) => {
      const send = (event: ServerEvent) => stream.writeSSE({ data: JSON.stringify(event) }).catch(() => undefined);

      await send({ type: "server.connected", properties: serverInfo(rt) });
      const unsubscribe = rt.bus.subscribe((event) => void send(event));
      const heartbeat = setInterval(() => void send({ type: "server.heartbeat", properties: { at: Date.now() } }), HEARTBEAT_MS);

      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(heartbeat);
      unsubscribe();
    }),
  );

  return app;
}
