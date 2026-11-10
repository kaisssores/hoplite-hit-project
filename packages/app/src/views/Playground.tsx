import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Api, Endpoint, Exchange, Key, Method } from "@tether/sdk";
import {
  COVERAGE_NOTE,
  SNIPPET_LANGS,
  authHeader,
  bodyProblem,
  coverage,
  endpointOf,
  hasBody,
  pickKey,
  queryString,
  resolvePath,
  snippet,
  type SnippetLang,
} from "../state/draft";
import { HOP_LABEL, fmtBytes, fmtMs } from "../state/format";
import { commitLayout, compose, go, previewLayout, send, setDraft } from "../state/sync";
import { store, useStore, type Draft, type Row } from "../state/store";
import { exchangeTone } from "../shell/Dock";
import { Code, looksLikeJson } from "../ui/Code";
import { RequestLine, usePaced } from "./RequestLine";
import { MOD, useElapsed } from "../ui/hooks";
import { Button, CopyButton, Empty, ICON, IconButton, Keycap, MethodTag, Segmented, Select } from "../ui/primitives";

type RequestTab = "params" | "headers" | "body" | "code";
type ResponseTab = "body" | "headers" | "timing";
const memory = { requestFor: "", request: "params" as RequestTab, response: "body" as ResponseTab, lang: "curl" as SnippetLang };

function LiveMs() {
  return <>{fmtMs(useElapsed(true))}</>;
}

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className="tab" onClick={() => onChange(option.value)}>
          {option.label}
          {option.count ? <span className="tab-count num">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Request side ───────────── */

function RowsEditor({
  rows,
  onChange,
  notes,
  addLabel,
}: {
  rows: Row[];
  onChange: (next: Row[]) => void;
  notes?: Record<string, string>;
  addLabel: string;
}) {
  const patch = (index: number, change: Partial<Row>) => onChange(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  return (
    <div className="rows">
      {rows.map((row, index) => (
        <div className="rows-row" key={index} data-off={!row.on || undefined}>
          <input type="checkbox" className="check" checked={row.on} aria-label={`Send ${row.k || "parameter"}`} onChange={(event) => patch(index, { on: event.target.checked })} />
          <input className="input mono" placeholder="name" value={row.k} onChange={(event) => patch(index, { k: event.target.value })} />
          <input className="input mono" placeholder="value" value={row.v} onChange={(event) => patch(index, { v: event.target.value, on: true })} />
          <span className="rows-note">{notes?.[row.k]}</span>
          <IconButton label="Remove" onClick={() => onChange(rows.filter((_, at) => at !== index))}>
            <X {...ICON} />
          </IconButton>
        </div>
      ))}
      <Button size="sm" variant="ghost" icon={<Plus {...ICON} />} onClick={() => onChange([...rows, { k: "", v: "", on: true }])}>
        {addLabel}
      </Button>
    </div>
  );
}

function RequestPane({ draft, api, endpoint, activeKey }: { draft: Draft; api: Api; endpoint: Endpoint | null; activeKey: Key | null }) {
  // A request opens on the tab that holds its content, and remembers a choice made for the same endpoint.
  const target = `${draft.apiId}:${draft.endpointId}`;
  const [tab, setTab] = useState<RequestTab>(() => (memory.requestFor === target ? memory.request : hasBody(draft) && draft.body ? "body" : "params"));
  memory.requestFor = target;
  const [lang, setLang] = useState(memory.lang);
  memory.request = tab;
  memory.lang = lang;
  const pathNames = [...draft.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
  const notes = Object.fromEntries((endpoint?.params ?? []).map((param) => [param.name, param.description]));
  const auth = authHeader(api, activeKey);
  const problem = bodyProblem(draft);
  const code = useMemo(() => snippet(lang, api, draft), [lang, api, draft]);
  const sent = draft.query.filter((row) => row.on && row.k).length + pathNames.length;

  return (
    <section className="pane" aria-label="Request">
      <header className="pane-head">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "params", label: "Params", count: sent },
            { value: "headers", label: "Headers", count: draft.headers.filter((row) => row.on && row.k).length + (auth ? 1 : 0) },
            { value: "body", label: "Body" },
            { value: "code", label: "Code" },
          ]}
        />
      </header>
      <div className="pane-body" key={tab}>
        {tab === "params" && (
          <>
            {pathNames.length > 0 && (
              <div className="rows">
                <p className="rows-title">Path</p>
                {pathNames.map((name) => (
                  <div className="rows-row rows-fixed" key={name}>
                    <span className="mono rows-key">{name}</span>
                    <input
                      className="input mono"
                      placeholder="value"
                      value={draft.pathParams[name] ?? ""}
                      onChange={(event) => setDraft({ pathParams: { ...draft.pathParams, [name]: event.target.value } })}
                    />
                    <span className="rows-note">{notes[name]}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="rows-title">Query</p>
            <RowsEditor rows={draft.query} notes={notes} addLabel="Add parameter" onChange={(query) => setDraft({ query })} />
          </>
        )}
        {tab === "headers" && (
          <>
            <p className="rows-title">Set by Tether</p>
            <div className="rows">
              {auth && (
                <div className="rows-row rows-fixed">
                  <span className="mono rows-key">{auth.name}</span>
                  <span className="mono rows-value">{auth.value}</span>
                  <span className="rows-note">{activeKey ? `Signed with ${activeKey.name}` : "No key chosen"}</span>
                </div>
              )}
              {hasBody(draft) && draft.body.trim() && (
                <div className="rows-row rows-fixed">
                  <span className="mono rows-key">Content-Type</span>
                  <span className="mono rows-value">application/json</span>
                  <span className="rows-note">Added when a body is sent</span>
                </div>
              )}
            </div>
            <p className="rows-title">Yours</p>
            <RowsEditor rows={draft.headers} notes={notes} addLabel="Add header" onChange={(headers) => setDraft({ headers })} />
          </>
        )}
        {tab === "body" &&
          (hasBody(draft) ? (
            <div className="body-editor">
              <textarea
                className="textarea mono"
                spellCheck={false}
                value={draft.body}
                placeholder="{ }"
                aria-label="Request body"
                onChange={(event) => setDraft({ body: event.target.value })}
              />
              <div className="body-foot">
                <span className="body-state" data-bad={problem ? true : undefined}>
                  {problem ?? (draft.body.trim() ? "Valid JSON" : "No body")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!problem || !draft.body.trim()}
                  onClick={() => setDraft({ body: JSON.stringify(JSON.parse(draft.body), null, 2) })}
                >
                  Format
                </Button>
              </div>
            </div>
          ) : (
            <Empty title={`${draft.method} requests carry no body`} />
          ))}
        {tab === "code" && (
          <div className="snippet">
            <div className="snippet-head">
              <Segmented size="sm" label="Language" value={lang} options={SNIPPET_LANGS.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={setLang} />
              <CopyButton text={code} label="Copy" />
            </div>
            <Code text={code} gutter={false} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────── Response side ───────────── */

interface Advice {
  text: string;
  action?: { label: string; run: () => void };
}

function advise(exchange: Exchange, api: Api, endpoint: Endpoint | null, keys: Key[]): Advice | null {
  const other = pickKey(api, endpoint, keys, exchange.request.env);
  const otherKey = other && other !== exchange.request.keyId ? keys.find((key) => key.id === other) : null;
  const useOther = otherKey ? { label: `Use ${otherKey.name}`, run: () => setDraft({ keyId: otherKey.id }) } : undefined;
  const newKey = { label: "New key", run: () => store.set({ sheet: { type: "key", apiId: api.id } }) };
  const health = { label: "See health", run: () => go({ name: "api", id: api.id }) };

  if (exchange.state === "failed") {
    const code = exchange.error?.code;
    if (code === "key_revoked" || code === "key_not_found") return { text: "Tether refused to sign with this key", action: useOther ?? newKey };
    if (code === "env_mismatch") return { text: "This key belongs to the other environment", action: useOther };
    if (code === "upstream_timeout") return { text: "The request left Tether and nothing came back", action: health };
    return { text: "The request did not reach the upstream" };
  }
  const status = exchange.response?.status ?? 0;
  if (status === 401) return { text: "The upstream wants credentials for this call", action: useOther ?? newKey };
  if (status === 403) {
    const scope = endpoint?.scope ? `${api.id}:${endpoint.scope}` : null;
    return { text: scope ? `This call needs the scope ${scope}` : "This key is not allowed to make this call", action: useOther ?? newKey };
  }
  if (status === 429) return { text: `The limit is ${api.rateLimit} requests per minute for each key` };
  if (status === 503) return { text: "The upstream is not answering normally right now", action: health };
  return null;
}

function Timing({ exchange }: { exchange: Exchange }) {
  const total = Math.max(1, exchange.ms ?? exchange.phases.reduce((sum, phase) => sum + (phase.ms ?? 0), 0));
  return (
    <table className="timing">
      <tbody>
        {exchange.phases.map((phase) => (
          <tr key={phase.hop} data-lost={exchange.error?.hop === phase.hop || undefined}>
            <th>{HOP_LABEL[phase.hop]}</th>
            <td className="timing-track">
              <span className="timing-bar" style={{ transform: `scaleX(${(phase.ms ?? 0) / total})` }} />
            </td>
            <td className="num right">{fmtMs(phase.ms)}</td>
          </tr>
        ))}
        <tr className="timing-total">
          <th>Total</th>
          <td />
          <td className="num right">{fmtMs(exchange.ms)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function ResponsePane({
  exchange,
  previous,
  api,
  endpoint,
  keys,
  adapterLabel,
}: {
  exchange: Exchange | null;
  previous: Exchange | null;
  api: Api;
  endpoint: Endpoint | null;
  keys: Key[];
  adapterLabel: string;
}) {
  const [tab, setTab] = useState(memory.response);
  memory.response = tab;
  const running = exchange?.state === "running";
  // While a request is in flight the last answer stays readable, dimmed, until the new one lands.
  const shown = running ? previous : exchange;
  const tone = shown ? exchangeTone(shown) : "ok";
  const advice = shown && !running ? advise(shown, api, endpoint, keys) : null;
  const hop = exchange?.phases[exchange.phases.length - 1]?.hop ?? "queue";

  let body: ReactNode;
  if (!shown) {
    body = running ? null : <Empty title="No response yet">Send the request and the answer lands here</Empty>;
  } else if (shown.state === "failed") {
    body = (
      <div className="lost">
        <p className="lost-title">No response</p>
        <p className="lost-message">{shown.error?.message}</p>
        <dl className="lost-facts">
          <div>
            <dt>Lost at</dt>
            <dd>{HOP_LABEL[shown.error?.hop ?? "upstream"]}</dd>
          </div>
          <div>
            <dt>Code</dt>
            <dd className="mono">{shown.error?.code}</dd>
          </div>
          <div>
            <dt>After</dt>
            <dd className="num">{fmtMs(shown.ms)}</dd>
          </div>
        </dl>
      </div>
    );
  } else if (tab === "headers") {
    body = (
      <table className="params headers">
        <tbody>
          {Object.entries(shown.response?.headers ?? {}).map(([name, value]) => (
            <tr key={name}>
              <td className="mono">{name}</td>
              <td className="mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (tab === "timing") {
    body = <Timing exchange={shown} />;
  } else {
    const text = shown.response?.body ?? "";
    body = text ? <Code text={text} json={looksLikeJson(text)} /> : <Empty title="Empty body">The upstream answered without content</Empty>;
  }

  return (
    <section className="pane" aria-label="Response" data-running={running || undefined}>
      <header className="pane-head">
        {running ? (
          <p className="res-status" data-tone="running">
            <span className="res-code">{HOP_LABEL[hop]}</span>
            <span className="num muted">
              <LiveMs key={exchange?.id} />
            </span>
          </p>
        ) : shown?.state === "done" ? (
          <p className="res-status" data-tone={tone} key={shown.id}>
            <span className="res-code num">{shown.response?.status}</span>
            <span className="res-text">{shown.response?.statusText}</span>
            <span className="num muted">{fmtMs(shown.ms)}</span>
            <span className="num muted">{fmtBytes(shown.response?.size ?? 0)}</span>
          </p>
        ) : shown ? (
          <p className="res-status" data-tone="bad" key={shown.id}>
            <span className="res-code">Line lost</span>
            <span className="muted">{HOP_LABEL[shown.error?.hop ?? "upstream"]}</span>
          </p>
        ) : (
          <p className="res-status muted">Response</p>
        )}
        {shown?.state === "done" && (
          <>
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "body", label: "Body" },
                { value: "headers", label: "Headers", count: Object.keys(shown.response?.headers ?? {}).length },
                { value: "timing", label: "Timing" },
              ]}
            />
            <CopyButton text={shown.response?.body ?? ""} />
          </>
        )}
      </header>
      {advice && (
        <div className="advice" data-tone={tone} key={shown?.id}>
          <span>{advice.text}</span>
          {advice.action && (
            <Button size="sm" onClick={advice.action.run}>
              {advice.action.label}
            </Button>
          )}
        </div>
      )}
      <div className="pane-body res-body" key={`${shown?.id}-${tab}`}>
        {body}
      </div>
    </section>
  );
}

/* ───────────── The bench ───────────── */

function BenchSplitter() {
  const onDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const split = event.currentTarget.parentElement!;
    const rect = split.getBoundingClientRect();
    const rows = store.get().prefs.layout.bench === "rows";
    document.documentElement.dataset.resizing = rows ? "row" : "col";
    const move = (moveEvent: PointerEvent) => {
      const ratio = rows ? (moveEvent.clientY - rect.top) / rect.height : (moveEvent.clientX - rect.left) / rect.width;
      void previewLayout({ benchRatio: Math.min(0.75, Math.max(0.25, Number(ratio.toFixed(3)))) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      delete document.documentElement.dataset.resizing;
      commitLayout();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return <div className="splitter bench-splitter" role="separator" aria-label="Resize request and response" onPointerDown={onDown} />;
}

export function Playground() {
  const draft = useStore((state) => state.draft);
  const apis = useStore((state) => state.apis);
  const keys = useStore((state) => state.keys);
  const exchanges = useStore((state) => state.exchanges);
  const activeId = useStore((state) => state.activeExchangeId);
  const sending = useStore((state) => state.sending);
  const layout = useStore((state) => state.prefs.layout);
  const adapters = useStore((state) => state.server?.adapters);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void send();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exchange = exchanges.find((entry) => entry.id === activeId) ?? null;
  const paced = usePaced(exchange);

  const api = apis.find((entry) => entry.id === draft?.apiId);
  if (!draft || !api) {
    return (
      <div className="view">
        <Empty title="Nothing to send yet">Pick an endpoint from the catalog to fill the request</Empty>
      </div>
    );
  }

  const endpoint = endpointOf(api, draft.endpointId);
  const previous = exchange
    ? (exchanges.filter((entry) => entry.state !== "running" && entry.startedAt < exchange.startedAt).at(-1) ?? null)
    : null;
  const running = sending || paced.exchange?.state === "running";
  const activeKey = keys.find((key) => key.id === draft.keyId) ?? null;
  const cover = activeKey ? coverage(activeKey, api, endpoint, draft.env) : null;
  const adapterLabel = adapters?.find((entry) => entry.id === api.adapter)?.label ?? api.adapter;
  const resolved = resolvePath(draft) + queryString(draft);
  const warning =
    cover && cover !== "ok"
      ? `${activeKey?.name}: ${COVERAGE_NOTE[cover].toLowerCase()}`
      : !activeKey && api.auth !== "none"
        ? "No key chosen"
        : null;

  const setPath = (path: string, method = draft.method) => {
    const match = api.endpoints.find((entry) => entry.path === path && entry.method === method);
    setDraft({ path, method, endpointId: match?.id ?? null });
  };
  const setEnv = (env: Draft["env"]) => {
    const keep = activeKey && activeKey.env === env;
    setDraft({ env, keyId: keep ? draft.keyId : pickKey(api, endpoint, keys, env) });
  };

  const split = { "--bench-a": `${layout.benchRatio}fr`, "--bench-b": `${1 - layout.benchRatio}fr` } as CSSProperties;

  return (
    <div className="bench" data-split={layout.bench}>
      <header className="bench-top enter">
        <h1 className="sr-only">Playground</h1>
        <Select
          label="API"
          value={api.id}
          options={apis.map((entry) => ({ value: entry.id, label: entry.name, group: entry.category }))}
          onChange={(id) => {
            const next = apis.find((entry) => entry.id === id)!;
            compose(next, next.endpoints[0] ?? null);
          }}
        />
        <Select
          className="bench-endpoint"
          label="Endpoint"
          value={draft.endpointId}
          placeholder="Custom request"
          options={api.endpoints.map((entry) => ({
            value: entry.id,
            label: entry.summary,
            meta: (
              <>
                <MethodTag method={entry.method} /> <span className="mono">{entry.path}</span>
              </>
            ),
          }))}
          onChange={(id) => compose(api, endpointOf(api, id))}
        />
        {api.auth !== "none" && (
          <>
            <Segmented
              size="sm"
              label="Environment"
              value={draft.env}
              options={[
                { value: "live", label: "Live" },
                { value: "test", label: "Test" },
              ]}
              onChange={setEnv}
            />
            <Select
              align="right"
              label="Key"
              value={draft.keyId ?? "none"}
              options={[
                ...keys.map((key) => ({
                  value: key.id,
                  label: key.name,
                  meta: COVERAGE_NOTE[coverage(key, api, endpoint, draft.env)],
                })),
                { value: "none", label: "No key", meta: "Send without credentials" },
              ]}
              onChange={(id) => setDraft({ keyId: id === "none" ? null : id })}
            />
          </>
        )}
      </header>

      <div className="bench-url enter">
        <Select
          className="bench-method"
          value={draft.method}
          options={METHODS.map((method) => ({ value: method, label: <MethodTag method={method} /> }))}
          onChange={(method) => setPath(draft.path, method)}
        />
        <label className="url">
          <span className="url-base mono">{api.baseUrl}</span>
          <input className="url-path mono" value={draft.path} spellCheck={false} aria-label="Path" onChange={(event) => setPath(event.target.value)} />
        </label>
        <button type="button" className="btn btn-primary btn-md send" data-sending={running || undefined} disabled={running} onClick={() => void send()}>
          <span className="roll" data-on={running || undefined}>
            <span className="roll-a">Send</span>
            <span className="roll-b">Sending</span>
          </span>
          <span className="send-keys">
            <Keycap>{MOD}</Keycap>
            <Keycap>↵</Keycap>
          </span>
        </button>
      </div>

      {(resolved !== draft.path || warning) && (
        <p className="bench-resolved mono">
          {resolved !== draft.path && (
            <span title="The URL that will be called">
              {api.baseUrl}
              {resolved}
            </span>
          )}
          {warning && <span className="bench-warn">{warning}</span>}
        </p>
      )}

      <RequestLine paced={paced} api={api} adapterLabel={adapterLabel} />

      <div className="bench-split" style={split}>
        <RequestPane key={`${draft.apiId}:${draft.endpointId}`} draft={draft} api={api} endpoint={endpoint} activeKey={activeKey} />
        <BenchSplitter />
        <ResponsePane exchange={paced.exchange} previous={previous} api={api} endpoint={endpoint} keys={keys} adapterLabel={adapterLabel} />
      </div>
    </div>
  );
}
