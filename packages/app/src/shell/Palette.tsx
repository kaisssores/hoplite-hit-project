import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { THEMES } from "../theme/themes";
import { compose, go, newSession, recents, setTheme, signOut } from "../state/sync";
import { store, useStore } from "../state/store";
import { ICON, Keycap, MethodTag } from "../ui/primitives";
import { toggleRig } from "./Rig";

interface Command {
  id: string;
  group: string;
  label: ReactNode;
  /** Lowercase text the query is matched against. */
  text: string;
  hint?: string;
  run: () => void;
}

/** One search over pages, APIs, endpoints and actions. Enter runs the highlighted row. */
export function Palette() {
  const apis = useStore((state) => state.apis);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const close = () => store.set({ palette: false });

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = (
      [
        ["catalog", "Catalog"],
        ["playground", "Playground"],
        ["keys", "Keys"],
        ["usage", "Usage"],
        ["sessions", "Sessions"],
        ["settings", "Settings"],
      ] as const
    ).map(([name, label]) => ({
      id: `page-${name}`,
      group: "Go to",
      label,
      text: label.toLowerCase(),
      run: () => go({ name }),
    }));
    const apiRows: Command[] = apis.map((api) => ({
      id: `api-${api.id}`,
      group: "APIs",
      label: api.name,
      text: `${api.name} ${api.id} ${api.category}`.toLowerCase(),
      hint: api.category,
      run: () => go({ name: "api", id: api.id }),
    }));
    const endpoints: Command[] = apis.flatMap((api) =>
      api.endpoints.map((endpoint) => ({
        id: `ep-${api.id}-${endpoint.id}`,
        group: "Try an endpoint",
        label: (
          <>
            <MethodTag method={endpoint.method} /> <span className="mono">{endpoint.path}</span>
          </>
        ),
        text: `${endpoint.method} ${endpoint.path} ${endpoint.summary} ${api.name}`.toLowerCase(),
        hint: api.name,
        run: () => {
          compose(api, endpoint);
          go({ name: "playground" });
        },
      })),
    );
    const actions: Command[] = [
      { id: "new-key", group: "Actions", label: "New key", text: "new key create credential", run: () => store.set({ sheet: { type: "key" }, palette: false }) },
      { id: "register", group: "Actions", label: "Register an API", text: "register api add", run: () => store.set({ sheet: { type: "register" }, palette: false }) },
      { id: "new-session", group: "Actions", label: "New session", text: "new session start", run: () => void newSession() },
      { id: "rig", group: "Actions", label: "Rig layout", text: "rig layout customize arrange", run: () => toggleRig(true) },
      { id: "shortcuts", group: "Actions", label: "Keyboard shortcuts", text: "keyboard shortcuts keys help", run: () => store.set({ shortcuts: true }) },
      { id: "sign-out", group: "Actions", label: "Sign out", text: "sign out log out account", run: () => void signOut() },
      ...THEMES.map((theme) => ({
        id: `theme-${theme.id}`,
        group: "Theme",
        label: theme.name,
        text: `theme ${theme.name} ${theme.blurb}`.toLowerCase(),
        hint: theme.blurb,
        run: () => setTheme(theme.id, { x: window.innerWidth / 2, y: window.innerHeight / 3 }),
      })),
    ];
    return [...pages, ...apiRows, ...endpoints, ...actions];
  }, [apis]);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      // Before anything is typed: where you were last, then the places and actions.
      const byId = new Map(commands.map((command) => [command.id, command]));
      const recent = recents()
        .map((entry) => byId.get(entry.type === "api" ? `api-${entry.apiId}` : `ep-${entry.apiId}-${entry.endpointId}`))
        .filter((command): command is Command => !!command)
        .map((command) => ({ ...command, id: `recent-${command.id}`, group: "Recent" }));
      return [...recent, ...commands.filter((command) => command.group === "Go to" || command.group === "Actions")];
    }
    return commands.filter((command) => words.every((word) => command.text.includes(word))).slice(0, 40);
  }, [commands, query]);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    list.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    store.set({ palette: false });
    command.run();
  };

  let lastGroup = "";
  return (
    <div className="palette-layer" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <div className="palette" role="dialog" aria-label="Search">
        <div className="palette-input">
          <Search {...ICON} />
          <input
            autoFocus
            placeholder="Search APIs, endpoints and actions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setCursor((at) => (results.length ? (at + step + results.length) % results.length : 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(results[cursor]);
              } else if (event.key === "Escape") {
                close();
              }
            }}
          />
          <Keycap>Esc</Keycap>
        </div>
        <div className="palette-list" ref={list}>
          {results.length === 0 && <p className="palette-none">Nothing matches “{query}”</p>}
          {results.map((command, index) => {
            const heading = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <div key={command.id}>
                {heading && <div className="menu-group">{heading}</div>}
                <button
                  type="button"
                  className="palette-item"
                  data-cursor={index === cursor}
                  onPointerMove={() => setCursor(index)}
                  onClick={() => run(command)}
                >
                  <span className="palette-label">{command.label}</span>
                  {command.hint && <span className="palette-hint">{command.hint}</span>}
                  <CornerDownLeft {...ICON} size={14} className="palette-enter" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
