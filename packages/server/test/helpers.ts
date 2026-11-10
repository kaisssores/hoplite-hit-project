import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Exchange, ExchangeRequest } from "@tether/contract";
import { createApp } from "../src/app.ts";
import { createRuntime } from "../src/runtime.ts";

export interface Harness {
  dataPath: string;
  rt: ReturnType<typeof createRuntime>;
  call<T = unknown>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: T }>;
  /** Sends an exchange and waits until it is no longer running. */
  exchange(sessionId: string, request: Partial<ExchangeRequest> & Pick<ExchangeRequest, "apiId" | "method" | "path">): Promise<Exchange>;
  close(): Promise<void>;
}

export async function harness(existingDir?: string): Promise<Harness & { dir: string }> {
  const dir = existingDir ?? (await mkdtemp(join(tmpdir(), "tether-test-")));
  const dataPath = join(dir, "state.json");
  const rt = createRuntime({ dataPath, speed: 0, ticker: false, port: 4096 });
  const app = createApp(rt, { clientDir: join(dir, "no-client") });

  const call: Harness["call"] = async (method, path, body, headers = {}) => {
    const response = await app.request(path, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as never };
  };

  return {
    dir,
    dataPath,
    rt,
    call,
    async exchange(sessionId, request) {
      const full: ExchangeRequest = { endpointId: null, query: {}, headers: {}, body: null, keyId: null, env: "live", ...request };
      const accepted = await call<Exchange>("POST", `/v1/session/${sessionId}/exchange`, full);
      if (accepted.status !== 202) throw new Error(`exchange rejected: ${JSON.stringify(accepted.body)}`);
      for (let i = 0; i < 200; i++) {
        const list = await call<Exchange[]>("GET", `/v1/session/${sessionId}/exchange`);
        const found = list.body.find((e) => e.id === accepted.body.id)!;
        if (found.state !== "running") return found;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error("exchange never finished");
    },
    async close() {
      await rt.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
