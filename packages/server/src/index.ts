import { serve } from "@hono/node-server";
import { DEFAULT_PORT } from "@tether/contract";
import { createApp } from "./app.ts";
import { createRuntime } from "./runtime.ts";

const port = Number(process.env.TETHER_PORT ?? DEFAULT_PORT);
const hostname = process.env.TETHER_HOST ?? "127.0.0.1";

const runtime = createRuntime({ port });
const app = createApp(runtime);

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`tether server listening on http://${info.address}:${info.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await runtime.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
