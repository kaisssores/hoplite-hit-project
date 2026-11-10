import { ChevronRight, Plus, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Api, Env, Key, KeySecret } from "@tether/sdk";
import { fmtAgo, fmtCompact, fmtDay } from "../state/format";
import { transition, vtName } from "../state/motion";
import { compose, createKey, go, revokeKey, rotateKey, setDraft } from "../state/sync";
import { store, useStore } from "../state/store";
import { useNow } from "../ui/hooks";
import { Button, CopyButton, Empty, Field, ICON, Segmented, Sheet } from "../ui/primitives";

/** A secret, shown once. The characters arrive in order, the way they came off the wire. */
function Secret({ value }: { value: string }) {
  return (
    <div className="secret">
      <code className="mono secret-value" aria-label={value}>
        {value.split("").map((char, index) => (
          <span key={index} style={{ "--i": index } as CSSProperties} aria-hidden="true">
            {char}
          </span>
        ))}
      </code>
      <CopyButton text={value} label="Copy" />
    </div>
  );
}

function KeyRow({ keyItem, apis, now }: { keyItem: Key; apis: Api[]; now: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [rotated, setRotated] = useState<KeySecret | null>(null);
  const [busy, setBusy] = useState(false);
  const revoked = keyItem.status === "revoked";
  const flip = (update: () => void) => void transition("flip", update);
  const names = keyItem.apiIds.map((id) => apis.find((api) => api.id === id)?.name ?? id);

  const rotate = async () => {
    setBusy(true);
    try {
      const result = await rotateKey(keyItem.id);
      flip(() => {
        setRotated(result);
        setOpen(true);
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="keyrow" data-open={open || undefined} data-revoked={revoked || undefined} data-flip style={{ "--vt": vtName("key", keyItem.id) } as CSSProperties}>
      <div className="keyrow-main">
        <button type="button" className="keyrow-toggle" aria-expanded={open} onClick={() => flip(() => setOpen(!open))}>
          <ChevronRight {...ICON} className="ep-chevron" />
          <span className="keyrow-name">{keyItem.name}</span>
        </button>
        <span className="keyrow-env" data-env={keyItem.env}>
          {revoked ? "Revoked" : keyItem.env === "live" ? "Live" : "Test"}
        </span>
        <span className="mono keyrow-token">
          {keyItem.prefix}••••{keyItem.last4}
        </span>
        <span className="keyrow-apis" title={names.join(", ")}>
          {names.slice(0, 2).join(", ")}
          {names.length > 2 && <span className="muted"> +{names.length - 2}</span>}
        </span>
        <span className="muted keyrow-used">{fmtAgo(keyItem.lastUsedAt, now)}</span>
        <span className="num right">{fmtCompact(keyItem.requests)}</span>
        <span className="keyrow-actions">
          {!revoked &&
            (confirm ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setConfirm(false);
                    void revokeKey(keyItem.id);
                  }}
                >
                  Revoke now
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" icon={<RotateCw {...ICON} />} disabled={busy} onClick={() => void rotate()}>
                  Rotate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                  Revoke
                </Button>
              </>
            ))}
        </span>
      </div>
      {open && (
        <div className="keyrow-body">
          {rotated && (
            <div className="keyrow-rotated">
              <p>New secret, shown once. The old one has stopped working.</p>
              <Secret value={rotated.secret} />
              <Button size="sm" variant="ghost" onClick={() => flip(() => setRotated(null))}>
                Stored it
              </Button>
            </div>
          )}
          <dl className="keyrow-facts">
            <div>
              <dt>Created</dt>
              <dd>{fmtDay(keyItem.createdAt)}</dd>
            </div>
            <div>
              <dt>Rotated</dt>
              <dd>{keyItem.rotatedAt ? fmtDay(keyItem.rotatedAt) : "Never"}</dd>
            </div>
            <div className="keyrow-scopes">
              <dt>Scopes</dt>
              <dd>
                {keyItem.scopes.length === 0 ? (
                  <span className="muted">None. The key authenticates but grants nothing</span>
                ) : (
                  keyItem.scopes.map((scope) => (
                    <span key={scope} className="scope mono">
                      {scope}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}

export function Keys() {
  const keys = useStore((state) => state.keys);
  const apis = useStore((state) => state.apis);
  const now = useNow();
  const active = keys.filter((key) => key.status === "active").length;
  return (
    <div className="view view-keys">
      <header className="view-head enter">
        <div>
          <h1 className="view-title">Keys</h1>
          <p className="view-meta">
            {active} active · {keys.length - active} revoked · secrets are shown once and stored as hashes
          </p>
        </div>
        <Button variant="primary" icon={<Plus {...ICON} />} onClick={() => store.set({ sheet: { type: "key" } })}>
          New key
        </Button>
      </header>
      {keys.length === 0 ? (
        <Empty title="No keys yet">A key lets a service call the APIs you enable for it</Empty>
      ) : (
        <div className="keys enter">
          <div className="keys-head">
            <span>Name</span>
            <span>Environment</span>
            <span>Token</span>
            <span>APIs</span>
            <span>Last used</span>
            <span className="right">Requests</span>
            <span />
          </div>
          <ul>
            {keys.map((key) => (
              <KeyRow key={key.id} keyItem={key} apis={apis} now={now} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ───────────── New key ───────────── */

export function KeySheet({ apiId, onClose }: { apiId?: string; onClose: () => void }) {
  const apis = useStore((state) => state.apis);
  const eligible = useMemo(() => apis.filter((api) => api.auth !== "none"), [apis]);
  const readScopes = (api: Api) => api.scopes.filter((scope) => /read/.test(scope.name)).map((scope) => `${api.id}:${scope.name}`);
  const first = eligible.find((api) => api.id === apiId);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<Env>("test");
  const [chosen, setChosen] = useState<string[]>(first ? [first.id] : []);
  const [scopes, setScopes] = useState<string[]>(first ? first.scopes.map((scope) => `${first.id}:${scope.name}`) : []);
  const [created, setCreated] = useState<KeySecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(null), [name, chosen]);

  const toggleApi = (api: Api) => {
    void transition("flip", () => {
      if (chosen.includes(api.id)) {
        setChosen(chosen.filter((id) => id !== api.id));
        setScopes(scopes.filter((scope) => !scope.startsWith(`${api.id}:`)));
      } else {
        setChosen([...chosen, api.id]);
        setScopes([...scopes, ...readScopes(api)]);
      }
    });
  };
  const toggleScope = (scope: string) =>
    setScopes(scopes.includes(scope) ? scopes.filter((entry) => entry !== scope) : [...scopes, scope]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Give the key a name you will recognize later");
    if (chosen.length === 0) return setError("Enable at least one API");
    setBusy(true);
    try {
      setCreated(await createKey({ name: name.trim(), env, apiIds: chosen, scopes }));
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={created ? "Key created" : "New key"} subtitle={created ? created.key.name : "Scope it to what the caller needs"} onClose={onClose}>
      {(close) =>
        created ? (
          <div className="sheet-body">
            <p className="sheet-note">This is the only time the secret is shown. Tether keeps a hash, so a lost secret means rotating the key.</p>
            <Secret value={created.secret} />
            <div className="sheet-foot">
              <Button variant="ghost" onClick={close}>
                Done
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const api = apis.find((entry) => entry.id === (apiId ?? created.key.apiIds[0]));
                  if (api) {
                    compose(api, api.endpoints[0] ?? null);
                    setDraft({ keyId: created.key.id, env: created.key.env });
                  }
                  close();
                  go({ name: "playground" });
                }}
              >
                Try it in the playground
              </Button>
            </div>
          </div>
        ) : (
          <form className="sheet-body" onSubmit={submit}>
            <Field label="Name">
              <input className="input" autoFocus placeholder="Billing worker" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Environment" hint="Test keys never touch live data">
              <Segmented
                label="Environment"
                value={env}
                options={[
                  { value: "test", label: "Test" },
                  { value: "live", label: "Live" },
                ]}
                onChange={setEnv}
              />
            </Field>
            <div className="field">
              <span className="field-label">
                APIs and scopes
                <span className="field-hint">Read scopes are preselected</span>
              </span>
              <ul className="grant">
                {eligible.map((api) => {
                  const on = chosen.includes(api.id);
                  return (
                    <li key={api.id} className="grant-api" data-on={on || undefined} data-flip style={{ "--vt": vtName("grant", api.id) } as CSSProperties}>
                      <label className="grant-head">
                        <input type="checkbox" className="check" checked={on} onChange={() => toggleApi(api)} />
                        <span>{api.name}</span>
                        <span className="muted grant-cat">{api.category}</span>
                      </label>
                      {on && api.scopes.length > 0 && (
                        <div className="grant-scopes">
                          {api.scopes.map((scope) => {
                            const full = `${api.id}:${scope.name}`;
                            return (
                              <label key={full} className="grant-scope" title={scope.description}>
                                <input type="checkbox" className="check" checked={scopes.includes(full)} onChange={() => toggleScope(full)} />
                                <span className="mono">{scope.name}</span>
                                <span className="muted">{scope.description}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="sheet-foot">
              {error && <span className="form-error">{error}</span>}
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={busy}>
                Create key
              </Button>
            </div>
          </form>
        )
      }
    </Sheet>
  );
}
