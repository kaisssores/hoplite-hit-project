import { Check, PanelsTopLeft } from "lucide-react";
import type { CSSProperties } from "react";
import { LAYOUT_PRESETS, type ThemeId } from "@tether/sdk";
import { THEMES, resolveTheme, themeVariables, type Theme } from "../theme/themes";
import { fmtAgo } from "../state/format";
import { go, removeSavedLayout, setLayout, setMotion, setTheme } from "../state/sync";
import { useStore } from "../state/store";
import { toggleRig } from "../shell/Rig";
import { useNow } from "../ui/hooks";
import { Button, ICON, MethodTag, Segmented, Switch } from "../ui/primitives";

/** A theme drawn in its own tokens: surfaces, text roles, the line and a control corner. */
function ThemeCard({ theme, selected, onPick }: { theme: Theme; selected: boolean; onPick: (event: React.MouseEvent) => void }) {
  const c = theme.color;
  return (
    <button type="button" className="theme-card" aria-pressed={selected} onClick={onPick}>
      <span className="theme-preview" style={{ background: c.page, borderRadius: theme.radius.md } as CSSProperties}>
        <span className="theme-rail" style={{ background: c.deep }} />
        <span className="theme-body">
          <span className="theme-text" style={{ background: c.text, width: "46%" }} />
          <span className="theme-text" style={{ background: c.text3, width: "70%" }} />
          <svg width="100%" height="18" viewBox="0 0 120 18" preserveAspectRatio="none">
            <path d="M4 9 H116" stroke={c.accent} strokeWidth={theme.stroke} vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="theme-row">
            <span className="theme-chip" style={{ background: c.card, borderRadius: theme.radius.sm, boxShadow: `inset 0 0 0 1px ${c.text}22` }} />
            <span className="theme-chip" style={{ background: c.accent, borderRadius: theme.radius.sm }} />
          </span>
        </span>
      </span>
      <span className="theme-name">
        {theme.name}
        {selected && <Check {...ICON} />}
      </span>
      <span className="theme-blurb">{theme.blurb}</span>
    </button>
  );
}

const TOKEN_GROUPS: { title: string; names: string[]; kind: "color" | "radius" | "plain" }[] = [
  { title: "Surfaces", names: ["--bg-deep", "--bg", "--card", "--raised"], kind: "color" },
  { title: "Text", names: ["--text", "--text-2", "--text-3"], kind: "color" },
  { title: "Accent", names: ["--accent", "--accent-ink", "--accent-text", "--accent-soft"], kind: "color" },
  { title: "Meaning", names: ["--pos", "--warn", "--neg"], kind: "color" },
  { title: "Lines", names: ["--line", "--line-strong", "--stroke"], kind: "color" },
  { title: "Corners", names: ["--r-xs", "--r-sm", "--r-md", "--r-lg", "--r-xl"], kind: "radius" },
];

function Tokens({ theme }: { theme: Theme }) {
  const variables = themeVariables(theme);
  return (
    <div className="tokens">
      {TOKEN_GROUPS.map((group) => (
        <div className="token-group" key={group.title}>
          <h3>{group.title}</h3>
          <ul>
            {group.names.map((name) => (
              <li key={name}>
                {name === "--stroke" ? (
                  <span className="token-swatch token-stroke" />
                ) : group.kind === "radius" ? (
                  <span className="token-swatch token-corner" style={{ borderTopLeftRadius: `var(${name})` }} />
                ) : (
                  <span className="token-swatch" style={{ background: `var(${name})` }} />
                )}
                <span className="mono">{name}</span>
                <span className="mono muted">{variables[name]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="token-group">
        <h3>Type</h3>
        <ul>
          <li>
            <span className="token-type">Aa</span>
            <span className="mono">--font-ui</span>
            <span className="mono muted">Instrument Sans</span>
          </li>
          <li>
            <span className="token-type mono">01</span>
            <span className="mono">--font-mono</span>
            <span className="mono muted">Geist Mono</span>
          </li>
        </ul>
      </div>
      <div className="token-group">
        <h3>Motion</h3>
        <ul>
          <li>
            <svg className="token-curve" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M2 18 C 5.5 2, 7.8 2, 18 2" />
            </svg>
            <span className="mono">--ease</span>
            <span className="mono muted">cubic-bezier(0.22, 1, 0.36, 1)</span>
          </li>
          {[
            ["--t-fast", "140ms", "Hover, press, toggle"],
            ["--t-mid", "200ms", "Menus, copy, tabs"],
            ["--t-slow", "380ms", "Entrances, layout"],
          ].map(([name, value, use]) => (
            <li key={name}>
              <span className="token-type mono">{value!.replace("ms", "")}</span>
              <span className="mono">{name}</span>
              <span className="muted">{use}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Workbench() {
  const prefs = useStore((state) => state.prefs);
  const server = useStore((state) => state.server);
  const conn = useStore((state) => state.conn);
  const now = useNow();
  const resolved = resolveTheme(prefs.theme);
  const origin = (event: React.MouseEvent) => ({ x: event.clientX, y: event.clientY });
  const hub = useStore((state) => state.apis.find((api) => api.origin === "hub"));

  return (
    <div className="view view-workbench">
      <header className="view-head enter">
        <div>
          <h1 className="view-title">Workbench</h1>
          <p className="view-meta">Theme, layout and the server this window is tethered to</p>
        </div>
      </header>

      <section className="module enter">
        <header className="module-head">
          <h2 className="module-title">Theme</h2>
          <div className="module-meta">
            <span className="rig-inline">
              <Switch
                label="Follow the system"
                checked={prefs.theme === "system"}
                onChange={(on) => setTheme(on ? "system" : resolved.id, { x: window.innerWidth / 2, y: 200 })}
              />
              Follow the system
            </span>
          </div>
        </header>
        <div className="themes">
          {THEMES.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} selected={resolved.id === theme.id} onPick={(event) => setTheme(theme.id as ThemeId, origin(event))} />
          ))}
        </div>
        <div className="setting">
          <div>
            <p className="setting-name">Motion</p>
            <p className="muted">Reduced keeps state changes and drops travel</p>
          </div>
          <Segmented
            label="Motion"
            value={prefs.motion}
            options={[
              { value: "system", label: "System" },
              { value: "full", label: "Full" },
              { value: "reduced", label: "Reduced" },
            ]}
            onChange={setMotion}
          />
        </div>
      </section>

      <section className="module enter">
        <header className="module-head">
          <h2 className="module-title">Tokens in {resolved.name}</h2>
          <div className="module-meta">Every component reads these and nothing else</div>
        </header>
        <Tokens theme={resolved} />
      </section>

      <section className="module enter">
        <header className="module-head">
          <h2 className="module-title">Layout</h2>
          <div className="module-meta">
            <Button size="sm" icon={<PanelsTopLeft {...ICON} />} onClick={() => toggleRig(true)}>
              Rig layout
            </Button>
          </div>
        </header>
        <ul className="rigs">
          {LAYOUT_PRESETS.map((preset) => (
            <li key={preset.id}>
              <span className="rig-name">{preset.name}</span>
              <span className="muted">{preset.hint}</span>
              <Button size="sm" onClick={() => setLayout(preset.layout)}>
                Apply
              </Button>
            </li>
          ))}
          {prefs.saved.map((saved) => (
            <li key={saved.id}>
              <span className="rig-name">{saved.name}</span>
              <span className="muted">Saved by you</span>
              <span className="rig-row">
                <Button size="sm" variant="ghost" onClick={() => removeSavedLayout(saved.id)}>
                  Delete
                </Button>
                <Button size="sm" onClick={() => setLayout(saved.layout)}>
                  Apply
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="module enter">
        <header className="module-head">
          <h2 className="module-title">Server</h2>
          <div className="module-meta">{conn === "open" ? "Event stream open" : "Event stream down"}</div>
        </header>
        {server && (
          <>
            <dl className="api-facts">
              <div>
                <dt>Version</dt>
                <dd className="mono">{server.version}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{fmtAgo(server.startedAt, now)}</dd>
              </div>
              <div className="api-fact-wide">
                <dt>State file</dt>
                <dd className="mono">{server.dataPath}</dd>
              </div>
            </dl>
            <h3 className="sub-title">Adapters</h3>
            <ul className="adapters">
              {server.adapters.map((adapter) => (
                <li key={adapter.id}>
                  <span className="mono">{adapter.id}</span>
                  <span>{adapter.label}</span>
                  <span className="muted">{adapter.description}</span>
                  <span className="muted">{adapter.live ? "Live" : "Simulated"}</span>
                </li>
              ))}
            </ul>
            {hub && (
              <>
                <h3 className="sub-title">
                  Contract
                  <Button size="sm" variant="ghost" onClick={() => go({ name: "api", id: hub.id })}>
                    Open {hub.name} in the catalog
                  </Button>
                </h3>
                <ul className="routes">
                  {hub.endpoints.map((endpoint) => (
                    <li key={endpoint.id}>
                      <MethodTag method={endpoint.method} />
                      <span className="mono">{endpoint.path}</span>
                      <span className="muted">{endpoint.summary}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
