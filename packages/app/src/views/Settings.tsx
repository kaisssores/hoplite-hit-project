import { Check, ChevronRight, LogOut, PanelsTopLeft } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CATALOG_COLUMNS, LAYOUT_PRESETS, TetherError, type CatalogColumn, type ThemeId } from "@tether/sdk";
import { SYSTEM_PAIR, THEMES, resolveTheme, themeVariables, type Theme } from "../theme/themes";
import { fmtAgo, fmtDay } from "../state/format";
import { go, removeSavedLayout, saveAccount, setLayout, setMotion, setTheme, signOut } from "../state/sync";
import { useStore, type SettingsSection } from "../state/store";
import { Avatar } from "../shell/Account";
import { toggleRig } from "../shell/Rig";
import { ShortcutTable } from "../shell/Shortcuts";
import { useNow } from "../ui/hooks";
import { Button, ICON, MethodTag, Segmented, Switch } from "../ui/primitives";

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "layout", label: "Layout" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "server", label: "Server" },
];

const COLUMN_LABEL: Record<CatalogColumn, string> = {
  category: "Category",
  auth: "Auth",
  version: "Version",
  status: "Status",
  latency: "p50",
  traffic: "Requests 24 h",
};

/* ───────────── Profile ───────────── */

function Profile() {
  const account = useStore((state) => state.account);
  const [fields, setFields] = useState({ name: account?.name ?? "", email: account?.email ?? "", team: account?.team ?? "" });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = !!account && (fields.name !== account.name || fields.email !== account.email || fields.team !== account.team);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) return;
    setState("saving");
    setError(null);
    try {
      await saveAccount(fields);
      setState("saved");
      setTimeout(() => setState("idle"), 1600);
    } catch (problem) {
      setError(problem instanceof TetherError ? problem.message : "The server did not answer");
      setState("idle");
    }
  };

  return (
    <form className="profile" onSubmit={save}>
      <div className="profile-id">
        <Avatar account={account} size={56} />
        <div>
          <p className="profile-name">{account?.name}</p>
          <p className="muted">Member since {account ? fmtDay(account.createdAt) : "—"}</p>
        </div>
      </div>
      <div className="settings-fields">
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={fields.name} autoComplete="name" onChange={(event) => setFields({ ...fields, name: event.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Work email</span>
          <input className="input" type="email" value={fields.email} autoComplete="email" onChange={(event) => setFields({ ...fields, email: event.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">
            Team <span className="field-hint">Optional</span>
          </span>
          <input className="input" value={fields.team} autoComplete="organization" onChange={(event) => setFields({ ...fields, team: event.target.value })} />
        </label>
      </div>
      <div className="settings-actions">
        {error && <span className="form-error">{error}</span>}
        <Button variant="ghost" icon={<LogOut {...ICON} />} onClick={() => void signOut()}>
          Sign out
        </Button>
        <button type="submit" className="btn btn-primary btn-md" disabled={!dirty && state !== "saved"}>
          <span className="roll" data-on={state === "saved" || undefined}>
            <span className="roll-a">{state === "saving" ? "Saving" : "Save changes"}</span>
            <span className="roll-b">Saved</span>
          </span>
        </button>
      </div>
    </form>
  );
}

/* ───────────── Appearance ───────────── */

/** A theme drawn in its own tokens: rail, text roles, the line and the primary control. */
function ThemeCard({ theme, selected, onPick }: { theme: Theme; selected: boolean; onPick: (event: React.MouseEvent) => void }) {
  const c = theme.color;
  return (
    <button type="button" className="theme-card" aria-pressed={selected} onClick={onPick}>
      <span className="theme-preview" style={{ background: c.page, borderRadius: theme.radius.md } as CSSProperties}>
        <span className="theme-rail" style={{ background: c.deep }} />
        <span className="theme-body">
          <span className="theme-text" style={{ background: c.text, width: "46%" }} />
          <span className="theme-text" style={{ background: c.text3, width: "70%" }} />
          <svg width="100%" height="18" viewBox="0 0 120 18" preserveAspectRatio="none" aria-hidden="true">
            {theme.haze.strength > 0 && <path d="M4 9 H116" stroke={theme.haze.color} strokeOpacity={theme.haze.strength} strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
            <path d="M4 9 H116" stroke={c.accentLine} strokeWidth={theme.stroke} vectorEffect="non-scaling-stroke" />
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
      <span className="theme-blurb">
        {theme.blurb} · {theme.mode === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
}

const TOKEN_GROUPS: { title: string; names: string[]; kind: "color" | "radius" }[] = [
  { title: "Surfaces", names: ["--bg-deep", "--bg", "--card", "--raised"], kind: "color" },
  { title: "Text", names: ["--text", "--text-2", "--text-3"], kind: "color" },
  { title: "Accent", names: ["--accent", "--accent-ink", "--accent-text", "--accent-line"], kind: "color" },
  { title: "Haze", names: ["--haze", "--haze-faint", "--haze-canvas"], kind: "color" },
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
            ["--t-fast", "140", "Hover, press, toggle"],
            ["--t-mid", "200", "Menus, copy, tabs"],
            ["--t-slow", "380", "Entrances, layout"],
            ["--t-scene", "640", "Onboarding hand-offs"],
          ].map(([name, value, use]) => (
            <li key={name}>
              <span className="token-type mono">{value}</span>
              <span className="mono">{name}</span>
              <span className="muted">{use}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Appearance() {
  const prefs = useStore((state) => state.prefs);
  const layout = prefs.layout;
  const resolved = resolveTheme(prefs.theme);
  const [showTokens, setShowTokens] = useState(false);
  const pick = (id: ThemeId) => (event: React.MouseEvent) => setTheme(id, { x: event.clientX, y: event.clientY });
  const haze = THEMES.filter((theme) => theme.family === "haze");
  const classic = THEMES.filter((theme) => theme.family === "classic");

  return (
    <>
      <div className="setting setting-first">
        <div>
          <p className="setting-name">Follow the system</p>
          <p className="muted">
            Uses {THEMES.find((theme) => theme.id === SYSTEM_PAIR.light)?.name} in light mode and {THEMES.find((theme) => theme.id === SYSTEM_PAIR.dark)?.name} in dark mode
          </p>
        </div>
        <Switch label="Follow the system" checked={prefs.theme === "system"} onChange={(on) => setTheme(on ? "system" : resolved.id, { x: window.innerWidth / 2, y: 200 })} />
      </div>
      <h3 className="sub-title">Haze</h3>
      <div className="themes">
        {haze.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} selected={resolved.id === theme.id} onPick={pick(theme.id)} />
        ))}
      </div>
      <h3 className="sub-title">Classic</h3>
      <div className="themes">
        {classic.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} selected={resolved.id === theme.id} onPick={pick(theme.id)} />
        ))}
      </div>
      <div className="setting">
        <div>
          <p className="setting-name">Motion</p>
          <p className="muted">Reduced keeps every state change and drops the travel</p>
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
      <div className="setting">
        <div>
          <p className="setting-name">Density</p>
          <p className="muted">Compact fits more rows in tables and lists</p>
        </div>
        <Segmented
          label="Density"
          value={layout.density}
          options={[
            { value: "regular", label: "Regular" },
            { value: "compact", label: "Compact" },
          ]}
          onChange={(density) => setLayout({ density }, "flip")}
        />
      </div>
      <div className="setting">
        <div>
          <p className="setting-name">Tokens in {resolved.name}</p>
          <p className="muted">Every component reads these variables and nothing else</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm disclose" aria-expanded={showTokens} onClick={() => setShowTokens(!showTokens)}>
          <ChevronRight {...ICON} className="ep-chevron" />
          {showTokens ? "Hide tokens" : "Show tokens"}
        </button>
      </div>
      {showTokens && <Tokens theme={resolved} />}
    </>
  );
}

/* ───────────── Layout ───────────── */

function LayoutSettings() {
  const prefs = useStore((state) => state.prefs);
  const layout = prefs.layout;
  const presetId = LAYOUT_PRESETS.find((preset) => JSON.stringify(preset.layout) === JSON.stringify(layout))?.id;
  return (
    <>
      <ul className="rigs">
        {LAYOUT_PRESETS.map((preset) => (
          <li key={preset.id} data-current={presetId === preset.id || undefined}>
            <span className="rig-name">{preset.name}</span>
            <span className="muted">{preset.hint}</span>
            {presetId === preset.id ? (
              <span className="rig-current">
                <Check {...ICON} />
                In use
              </span>
            ) : (
              <Button size="sm" onClick={() => setLayout(preset.layout)}>
                Apply
              </Button>
            )}
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
      <div className="setting">
        <div>
          <p className="setting-name">Rail</p>
          <p className="muted">Where navigation sits, and whether it shows labels</p>
        </div>
        <div className="rig-row">
          <Segmented
            size="sm"
            label="Rail position"
            value={layout.nav}
            options={[
              { value: "left", label: "Left" },
              { value: "top", label: "Top" },
              { value: "right", label: "Right" },
            ]}
            onChange={(nav) => setLayout({ nav })}
          />
          <span className="rig-inline" data-disabled={layout.nav === "top" || undefined}>
            <Switch label="Icons only" checked={layout.navCollapsed && layout.nav !== "top"} onChange={(navCollapsed) => layout.nav !== "top" && setLayout({ navCollapsed })} />
            Icons only
          </span>
        </div>
      </div>
      <div className="setting">
        <div>
          <p className="setting-name">Activity dock</p>
          <p className="muted">The live record of this session</p>
        </div>
        <Segmented
          size="sm"
          label="Dock position"
          value={layout.dock}
          options={[
            { value: "right", label: "Right" },
            { value: "bottom", label: "Bottom" },
            { value: "hidden", label: "Off" },
          ]}
          onChange={(dock) => setLayout(dock === "bottom" ? { dock, dockSize: Math.min(layout.dockSize, 260) } : dock === "right" ? { dock, dockSize: Math.max(layout.dockSize, 300) } : { dock })}
        />
      </div>
      <div className="setting">
        <div>
          <p className="setting-name">Playground</p>
          <p className="muted">Request and response side by side, or stacked</p>
        </div>
        <Segmented
          size="sm"
          label="Playground split"
          value={layout.bench}
          options={[
            { value: "columns", label: "Side by side" },
            { value: "rows", label: "Stacked" },
          ]}
          onChange={(bench) => setLayout({ bench }, "flip")}
        />
      </div>
      <div className="setting setting-wrap">
        <div>
          <p className="setting-name">Catalog columns</p>
          <p className="muted">Shown in this order after the API name</p>
        </div>
        <div className="chips">
          {CATALOG_COLUMNS.map((column) => (
            <button
              key={column}
              type="button"
              className="chip"
              aria-pressed={layout.catalog.columns.includes(column)}
              onClick={() =>
                setLayout(
                  {
                    catalog: {
                      ...layout.catalog,
                      columns: layout.catalog.columns.includes(column) ? layout.catalog.columns.filter((entry) => entry !== column) : [...layout.catalog.columns, column],
                    },
                  },
                  null,
                )
              }
            >
              {COLUMN_LABEL[column]}
            </button>
          ))}
        </div>
      </div>
      <div className="setting">
        <div>
          <p className="setting-name">Rig mode</p>
          <p className="muted">Drag the rail and the dock to other edges, reorder and hide page modules, save a named rig</p>
        </div>
        <Button icon={<PanelsTopLeft {...ICON} />} onClick={() => toggleRig(true)}>
          Open rig mode
        </Button>
      </div>
    </>
  );
}

/* ───────────── Server ───────────── */

function Server() {
  const server = useStore((state) => state.server);
  const conn = useStore((state) => state.conn);
  const hub = useStore((state) => state.apis.find((api) => api.origin === "hub"));
  const now = useNow();
  if (!server) return null;
  return (
    <>
      <dl className="api-facts">
        <div>
          <dt>Connection</dt>
          <dd>{conn === "open" ? "Event stream open" : "Event stream down"}</dd>
        </div>
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
  );
}

/* ───────────── Page ───────────── */

export function Settings({ section }: { section?: SettingsSection }) {
  const [current, setCurrent] = useState<SettingsSection>(section ?? "profile");
  const body = useRef<HTMLDivElement>(null);

  // The section nav follows the reader: the last section whose heading has passed the top third.
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const onScroll = () => {
      const line = main.getBoundingClientRect().top + main.clientHeight / 3;
      let at: SettingsSection = "profile";
      for (const entry of SECTIONS) {
        const element = document.getElementById(`settings-${entry.id}`);
        if (element && element.getBoundingClientRect().top <= line) at = entry.id;
      }
      if (main.scrollTop + main.clientHeight >= main.scrollHeight - 4) at = SECTIONS[SECTIONS.length - 1]!.id;
      setCurrent(at);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    if (section) document.getElementById(`settings-${section}`)?.scrollIntoView({ block: "start" });
    return () => main.removeEventListener("scroll", onScroll);
  }, [section]);

  const jump = (id: SettingsSection) => {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(id);
  };

  const content: Record<SettingsSection, { title: string; hint: string; body: React.ReactNode }> = {
    profile: { title: "Profile", hint: "How you appear in session history and on keys you create", body: <Profile /> },
    appearance: { title: "Appearance", hint: "Theme, motion and density. Saved on the server, so every window follows", body: <Appearance /> },
    layout: { title: "Layout", hint: "Shape the product around how you work", body: <LayoutSettings /> },
    shortcuts: { title: "Shortcuts", hint: "Press ? anywhere to see these", body: <ShortcutTable /> },
    server: { title: "Server", hint: "The Tether server this window is tethered to", body: <Server /> },
  };

  return (
    <div className="view view-settings">
      <header className="view-head enter">
        <div>
          <h1 className="view-title">Settings</h1>
          <p className="view-meta">Your account, how Tether looks, and how it is laid out</p>
        </div>
      </header>
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((entry) => (
            <button key={entry.id} type="button" className="settings-link" aria-current={current === entry.id ? "true" : undefined} onClick={() => jump(entry.id)}>
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="settings-body" ref={body}>
          {SECTIONS.map((entry) => (
            <section key={entry.id} id={`settings-${entry.id}`} className="settings-section enter" aria-labelledby={`settings-${entry.id}-title`}>
              <header className="settings-section-head">
                <h2 className="module-title" id={`settings-${entry.id}-title`}>
                  {content[entry.id].title}
                </h2>
                <p className="muted">{content[entry.id].hint}</p>
              </header>
              <div className="settings-card">{content[entry.id].body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
