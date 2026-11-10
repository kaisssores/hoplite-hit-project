import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { ApiInput, AuthScheme, Method } from "@tether/sdk";
import { AUTH_LABEL } from "../state/format";
import { registerApi } from "../state/sync";
import { useStore } from "../state/store";
import { Button, Field, ICON, IconButton, MethodTag, Segmented, Select, Sheet } from "../ui/primitives";

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const AUTHS: AuthScheme[] = ["api_key", "bearer", "hmac", "none"];

/** Register an API of your own. It joins the catalog and can be called from the playground at once. */
export function RegisterSheet({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const categories = useStore((state) => state.apis);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://");
  const [auth, setAuth] = useState<AuthScheme>("api_key");
  const [upstream, setUpstream] = useState<ApiInput["upstream"]>("simulated");
  const [endpoints, setEndpoints] = useState<ApiInput["endpoints"]>([{ method: "GET", path: "/status", summary: "Read service status" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const known = [...new Set(categories.map((api) => api.category))];
  const [category, setCategory] = useState(known[0] ?? "Platform");

  const patch = (index: number, change: Partial<ApiInput["endpoints"][number]>) =>
    setEndpoints(endpoints.map((endpoint, at) => (at === index ? { ...endpoint, ...change } : endpoint)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name the API");
    if (!/^https?:\/\/.+/.test(baseUrl.trim())) return setError("The base URL starts with http:// or https://");
    const rows = endpoints.filter((endpoint) => endpoint.path.trim());
    if (rows.length === 0) return setError("Add at least one endpoint");
    if (rows.some((endpoint) => !endpoint.path.startsWith("/"))) return setError("Endpoint paths start with a slash");
    setBusy(true);
    try {
      const api = await registerApi({
        name: name.trim(),
        summary: summary.trim() || `${name.trim()} API`,
        category,
        baseUrl: baseUrl.trim().replace(/\/$/, ""),
        auth,
        upstream,
        endpoints: rows.map((endpoint) => ({ ...endpoint, summary: endpoint.summary.trim() || `${endpoint.method} ${endpoint.path}` })),
      });
      onDone(api.id);
    } catch (problem) {
      setError((problem as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet title="Register an API" subtitle="It joins the catalog next to the official ones" onClose={onClose}>
      {(close) => (
        <form className="sheet-body" onSubmit={submit}>
          <Field label="Name">
            <input className="input" autoFocus placeholder="Loyalty" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Summary">
            <input className="input" placeholder="Points, tiers and rewards for members" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </Field>
          <Field label="Base URL">
            <input className="input mono" spellCheck={false} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </Field>
          <div className="field-pair">
            <div className="field">
              <span className="field-label">Category</span>
              <Select value={category} options={known.map((entry) => ({ value: entry, label: entry }))} onChange={setCategory} />
            </div>
            <div className="field">
              <span className="field-label">Auth</span>
              <Select value={auth} options={AUTHS.map((entry) => ({ value: entry, label: AUTH_LABEL[entry] }))} onChange={setAuth} />
            </div>
          </div>
          <Field label="Upstream" hint={upstream === "live" ? "Tether forwards requests to the base URL" : "Tether answers in place of the API"}>
            <Segmented
              label="Upstream"
              value={upstream}
              options={[
                { value: "simulated", label: "Simulated" },
                { value: "live", label: "Live HTTP" },
              ]}
              onChange={setUpstream}
            />
          </Field>
          <div className="field">
            <span className="field-label">Endpoints</span>
            <div className="reg-endpoints">
              {endpoints.map((endpoint, index) => (
                <div className="reg-endpoint" key={index}>
                  <Select
                    className="bench-method"
                    value={endpoint.method}
                    options={METHODS.map((method) => ({ value: method, label: <MethodTag method={method} /> }))}
                    onChange={(method) => patch(index, { method })}
                  />
                  <input className="input mono" placeholder="/members/{id}" spellCheck={false} value={endpoint.path} onChange={(event) => patch(index, { path: event.target.value })} />
                  <input className="input" placeholder="What it does" value={endpoint.summary} onChange={(event) => patch(index, { summary: event.target.value })} />
                  <IconButton label="Remove endpoint" disabled={endpoints.length === 1} onClick={() => setEndpoints(endpoints.filter((_, at) => at !== index))}>
                    <X {...ICON} />
                  </IconButton>
                </div>
              ))}
              <Button size="sm" variant="ghost" icon={<Plus {...ICON} />} onClick={() => setEndpoints([...endpoints, { method: "GET", path: "/", summary: "" }])}>
                Add endpoint
              </Button>
            </div>
          </div>
          <div className="sheet-foot">
            {error && <span className="form-error">{error}</span>}
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              Register
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
