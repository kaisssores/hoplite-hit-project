import type { Api, Endpoint, Method, Param } from "@tether/contract";

/** Small builders so the catalog reads like documentation rather than object soup. */
export const path = (name: string, description: string, example?: string): Param => ({
  name,
  in: "path",
  type: "string",
  required: true,
  description,
  ...(example ? { example } : {}),
});

export const query = (
  name: string,
  type: string,
  description: string,
  opts: { required?: boolean; example?: string } = {},
): Param => ({
  name,
  in: "query",
  type,
  required: opts.required ?? false,
  description,
  ...(opts.example ? { example: opts.example } : {}),
});

export const header = (name: string, description: string, opts: { required?: boolean; example?: string } = {}): Param => ({
  name,
  in: "header",
  type: "string",
  required: opts.required ?? false,
  description,
  ...(opts.example ? { example: opts.example } : {}),
});

interface EndpointSpec {
  description: string;
  params?: Param[];
  scope?: string | null;
  body?: unknown;
  status?: number;
  response: unknown;
}

export function endpoint(id: string, method: Method, route: string, summary: string, spec: EndpointSpec): Endpoint {
  return {
    id,
    method,
    path: route,
    summary,
    description: spec.description,
    params: spec.params ?? [],
    scope: spec.scope === undefined ? null : spec.scope,
    ...(spec.body === undefined ? {} : { requestBody: spec.body }),
    response: { status: spec.status ?? 200, body: spec.response },
  };
}

type OfficialApi = Omit<Api, "origin" | "registeredAt" | "owner" | "rateLimit"> & {
  owner: string;
  rateLimit: number;
  registeredAt: string;
};

/** Official entries are authored with an ISO registration date and stamped here. */
export function official(spec: OfficialApi): Api {
  return { ...spec, origin: "official", registeredAt: Date.parse(spec.registeredAt) };
}
