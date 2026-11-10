import { ArrowLeft, ChevronRight, KeyRound, Play, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { Api, ApiHealth, ApiModule, Endpoint, Key } from "@tether/sdk";
import { authHeader } from "../state/draft";
import { AUTH_LABEL, STATUS_LABEL, fmtClock, fmtCompact, fmtDay, fmtInt, fmtMs, fmtPct } from "../state/format";
import { transition, vtName } from "../state/motion";
import { compose, go, removeApi } from "../state/sync";
import { store, useStore } from "../state/store";
import { Modules } from "../shell/Rig";
import { Chart } from "../ui/Chart";
import { Code } from "../ui/Code";
import { TensionGlyph, tensionOf } from "../ui/Line";
import { Button, CopyButton, Empty, ICON, MethodTag } from "../ui/primitives";

const TITLES: Record<ApiModule, string> = {
  health: "Health",
  endpoints: "Endpoints",
  auth: "Authentication",
  changelog: "Changelog",
};

const AUTH_COPY: Record<Api["auth"], string> = {
  api_key: "Send your key in the X-Api-Key header on every request",
  bearer: "Send your key as a bearer token in the Authorization header",
  hmac: "Sign the timestamp and the body with your key's secret, and send the signature with the request",
  none: "This API takes no credentials and answers only on this machine",
};

function tryIt(api: Api, endpoint: Endpoint | null) {
  compose(api, endpoint);
  go({ name: "playground" });
}

function Health({ health }: { health: ApiHealth }) {
  const history = health.history;
  return (
    <div className="health">
      {health.note && (
        <p className="notice" data-status={health.status}>
          <TensionGlyph tension={tensionOf(health.status)} />
          {health.note}
        </p>
      )}
      <div className="health-grid">
        <Chart
          height={264}
          times={history.map((sample) => sample.t)}
          lines={[{ id: "p50", label: "p50", values: history.map((sample) => sample.p50), tone: "lead" }]}
          band={{ label: "p95", low: history.map((sample) => sample.p50), high: history.map((sample) => sample.p95) }}
          formatY={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`)}
          formatX={(time) => fmtClock(time, false)}
          readout={(index) => [
            { label: "Requests", value: fmtInt(history[index]?.requests ?? 0) },
            { label: "Errors", value: fmtInt(history[index]?.errors ?? 0) },
          ]}
        />
        <dl className="figures">
          <div>
            <dt>p50 now</dt>
            <dd className="num">{fmtMs(health.p50)}</dd>
          </div>
          <div>
            <dt>p95 now</dt>
            <dd className="num">{fmtMs(health.p95)}</dd>
          </div>
          <div>
            <dt>Errors, 24 h</dt>
            <dd className="num">{fmtPct(health.errorRate)}</dd>
          </div>
          <div>
            <dt>Uptime, 30 d</dt>
            <dd className="num">{health.uptime.toFixed(health.uptime >= 99.99 ? 3 : 2)}%</dd>
          </div>
          <div>
            <dt>Requests, 24 h</dt>
            <dd className="num">{fmtCompact(health.requests24h)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function EndpointRow({ api, endpoint, open, onToggle }: { api: Api; endpoint: Endpoint; open: boolean; onToggle: () => void }) {
  return (
    <li className="ep" data-open={open || undefined} data-flip style={{ "--vt": vtName(`ep-${api.id}`, endpoint.id) } as CSSProperties}>
      <button type="button" className="ep-head" aria-expanded={open} onClick={onToggle}>
        <ChevronRight {...ICON} className="ep-chevron" />
        <MethodTag method={endpoint.method} />
        <span className="ep-path mono">{endpoint.path}</span>
        <span className="ep-summary">{endpoint.summary}</span>
        {endpoint.scope && <span className="ep-scope mono">{endpoint.scope}</span>}
      </button>
      {open && (
        <div className="ep-body">
          <div className="ep-intro">
            <p>{endpoint.description}</p>
            <Button variant="primary" size="sm" icon={<Play {...ICON} />} onClick={() => tryIt(api, endpoint)}>
              Try it
            </Button>
          </div>
          {endpoint.params.length > 0 && (
            <table className="params">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>In</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.params.map((param) => (
                  <tr key={`${param.in}-${param.name}`}>
                    <td className="mono">
                      {param.name}
                      {param.required && <span className="req">required</span>}
                    </td>
                    <td>{param.in}</td>
                    <td className="mono">{param.type}</td>
                    <td>{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="ep-examples">
            {endpoint.requestBody !== undefined && (
              <figure className="example">
                <figcaption>
                  Request body
                  <CopyButton text={JSON.stringify(endpoint.requestBody, null, 2)} />
                </figcaption>
                <Code json gutter={false} text={JSON.stringify(endpoint.requestBody, null, 2)} />
              </figure>
            )}
            <figure className="example">
              <figcaption>
                Response <span className="num">{endpoint.response.status}</span>
                <CopyButton text={JSON.stringify(endpoint.response.body, null, 2)} />
              </figcaption>
              <Code json gutter={false} text={endpoint.response.body == null ? "No content" : JSON.stringify(endpoint.response.body, null, 2)} />
            </figure>
          </div>
        </div>
      )}
    </li>
  );
}

function Endpoints({ api }: { api: Api }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="eps">
      {api.endpoints.map((endpoint) => (
        <EndpointRow
          key={endpoint.id}
          api={api}
          endpoint={endpoint}
          open={open === endpoint.id}
          onToggle={() => void transition("flip", () => setOpen(open === endpoint.id ? null : endpoint.id))}
        />
      ))}
    </ul>
  );
}

function Auth({ api, keys }: { api: Api; keys: Key[] }) {
  const header = authHeader(api, null, true);
  const mine = keys.filter((key) => key.apiIds.includes(api.id));
  return (
    <div className="auth">
      <div className="auth-how">
        <p>{AUTH_COPY[api.auth]}</p>
        {header && (
          <div className="inline-code">
            <code className="mono">
              {header.name}: {header.value}
            </code>
            <CopyButton text={`${header.name}: ${header.value}`} />
          </div>
        )}
        {api.scopes.length > 0 && (
          <table className="params">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Grants</th>
              </tr>
            </thead>
            <tbody>
              {api.scopes.map((scope) => (
                <tr key={scope.name}>
                  <td className="mono">
                    {api.id}:{scope.name}
                  </td>
                  <td>{scope.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {api.auth !== "none" && (
        <div className="auth-keys">
          <div className="auth-keys-head">
            <h3>Your keys for {api.name}</h3>
            <Button size="sm" icon={<KeyRound {...ICON} />} onClick={() => store.set({ sheet: { type: "key", apiId: api.id } })}>
              New key
            </Button>
          </div>
          {mine.length === 0 ? (
            <p className="muted">No key is enabled for {api.name} yet</p>
          ) : (
            <ul className="key-list">
              {mine.map((key) => {
                const held = key.scopes.filter((scope) => scope.startsWith(`${api.id}:`)).length;
                return (
                  <li key={key.id} data-revoked={key.status === "revoked" || undefined}>
                    <span className="key-name">{key.name}</span>
                    <span className="mono muted">
                      {key.prefix}••••{key.last4}
                    </span>
                    <span className="muted">
                      {key.status === "revoked" ? "Revoked" : `${key.env === "live" ? "Live" : "Test"} · ${held} of ${api.scopes.length} scopes`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ApiDetail({ id }: { id: string }) {
  const api = useStore((state) => state.apis.find((entry) => entry.id === id));
  const health = useStore((state) => state.health[id]);
  const keys = useStore((state) => state.keys);
  const adapters = useStore((state) => state.server?.adapters);

  const back = (
    <a
      className="back"
      href="/"
      onClick={(event) => {
        event.preventDefault();
        go({ name: "catalog" });
      }}
    >
      <ArrowLeft {...ICON} />
      Catalog
    </a>
  );

  if (!api) {
    return (
      <div className="view">
        {back}
        <Empty title={`No API with the id “${id}”`}>It may have been removed from the catalog</Empty>
      </div>
    );
  }

  const adapter = adapters?.find((entry) => entry.id === api.adapter);
  return (
    <div className="view view-api">
      {back}
      <header className="api-head">
        <div className="api-title-row">
          <h1 className="view-title api-title" data-morph="name">
            {api.name}
          </h1>
          <span className="api-version mono">{api.version}</span>
          {api.stability !== "stable" && <span className="cat-stability" data-stability={api.stability}>{api.stability}</span>}
          <span className="cat-status api-status" data-status={health?.status}>
            <TensionGlyph tension={tensionOf(health?.status)} />
            {STATUS_LABEL[health?.status ?? "operational"]}
          </span>
        </div>
        <p className="api-desc">{api.description}</p>
        <div className="api-actions">
          <Button variant="primary" icon={<Play {...ICON} />} onClick={() => tryIt(api, api.endpoints[0] ?? null)}>
            Open in playground
          </Button>
          {api.auth !== "none" && (
            <Button icon={<KeyRound {...ICON} />} onClick={() => store.set({ sheet: { type: "key", apiId: api.id } })}>
              New key
            </Button>
          )}
          {api.origin === "registered" && (
            <Button
              variant="ghost"
              icon={<Trash2 {...ICON} />}
              onClick={() => {
                go({ name: "catalog" });
                void removeApi(api.id);
              }}
            >
              Remove
            </Button>
          )}
        </div>
        <dl className="api-facts">
          <div className="api-fact-wide">
            <dt>Base URL</dt>
            <dd className="mono">
              {api.baseUrl}
              <CopyButton text={api.baseUrl} />
            </dd>
          </div>
          <div>
            <dt>Auth</dt>
            <dd>{AUTH_LABEL[api.auth]}</dd>
          </div>
          <div>
            <dt>Rate limit</dt>
            <dd className="num">{fmtInt(api.rateLimit)} per min</dd>
          </div>
          <div>
            <dt>Reached through</dt>
            <dd title={adapter?.description}>{adapter?.label ?? api.adapter}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{api.owner}</dd>
          </div>
        </dl>
      </header>

      <Modules<ApiModule> page="api" titles={TITLES}>
        {(module) => {
          if (module === "health") return health ? { body: <Health health={health} /> } : null;
          if (module === "endpoints")
            return { meta: <span className="num">{api.endpoints.length}</span>, body: <Endpoints api={api} /> };
          if (module === "auth") return { meta: AUTH_LABEL[api.auth], body: <Auth api={api} keys={keys} /> };
          if (api.changelog.length === 0) return null;
          return {
            body: (
              <ol className="changelog">
                {api.changelog.map((entry) => (
                  <li key={entry.version}>
                    <span className="mono">{entry.version}</span>
                    <span className="muted num">{fmtDay(entry.date)}</span>
                    <span>{entry.note}</span>
                  </li>
                ))}
              </ol>
            ),
          };
        }}
      </Modules>
    </div>
  );
}
