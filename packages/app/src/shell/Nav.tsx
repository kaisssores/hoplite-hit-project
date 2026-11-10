import {
  BookOpen,
  ChartSpline,
  History,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  Search,
  SlidersHorizontal,
  SquareTerminal,
} from "lucide-react";
import type { ReactNode } from "react";
import { MOD } from "../ui/hooks";
import { Mark } from "../ui/Line";
import { ICON, Keycap } from "../ui/primitives";
import { go, setLayout } from "../state/sync";
import { store, useStore, type Route } from "../state/store";
import { RegionTag } from "./Rig";

const CONNECTION: Record<string, string> = {
  open: "Tethered",
  connecting: "Reaching server",
  lost: "Line lost, retrying",
};

function Item({
  route,
  icon,
  label,
  count,
  active,
}: {
  route: Route;
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <a
      className="nav-item"
      href={route.name === "catalog" ? "/" : `/${route.name}`}
      aria-current={active ? "page" : undefined}
      title={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        go(route);
      }}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {count != null && <span className="nav-count num">{count}</span>}
    </a>
  );
}

export function Nav() {
  const route = useStore((state) => state.route.name);
  const conn = useStore((state) => state.conn);
  const apis = useStore((state) => state.apis.length);
  const keys = useStore((state) => state.keys);
  const sessions = useStore((state) => state.sessions.length);
  const layout = useStore((state) => state.prefs.layout);
  const rig = useStore((state) => state.rig);
  const server = useStore((state) => state.server);
  const top = layout.nav === "top";
  const activeKeys = keys.filter((key) => key.status === "active").length;

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-brand">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            go({ name: "catalog" });
          }}
        >
          <Mark conn={conn} />
          <span className="brand-word">Tether</span>
        </a>
        {!top && (
          <button
            type="button"
            className="icon-btn nav-collapse"
            aria-label={layout.navCollapsed ? "Expand rail" : "Collapse rail"}
            title={layout.navCollapsed ? "Expand rail" : "Collapse rail"}
            onClick={() => setLayout({ navCollapsed: !layout.navCollapsed })}
          >
            {layout.navCollapsed ? <PanelLeftOpen {...ICON} /> : <PanelLeftClose {...ICON} />}
          </button>
        )}
      </div>

      <button type="button" className="nav-search" title="Search" onClick={() => store.set({ palette: true })}>
        <span className="nav-icon">
          <Search {...ICON} />
        </span>
        <span className="nav-label">Search</span>
        <span className="nav-keys">
          <Keycap>{MOD}</Keycap>
          <Keycap>K</Keycap>
        </span>
      </button>

      <div className="nav-items">
        <Item route={{ name: "catalog" }} icon={<BookOpen {...ICON} />} label="Catalog" count={apis} active={route === "catalog" || route === "api"} />
        <Item route={{ name: "playground" }} icon={<SquareTerminal {...ICON} />} label="Playground" active={route === "playground"} />
        <Item route={{ name: "keys" }} icon={<KeyRound {...ICON} />} label="Keys" count={activeKeys} active={route === "keys"} />
        <Item route={{ name: "usage" }} icon={<ChartSpline {...ICON} />} label="Usage" active={route === "usage"} />
        <Item route={{ name: "sessions" }} icon={<History {...ICON} />} label="Sessions" count={sessions} active={route === "sessions"} />
      </div>

      <div className="nav-foot">
        <Item route={{ name: "workbench" }} icon={<SlidersHorizontal {...ICON} />} label="Workbench" active={route === "workbench"} />
        <button
          type="button"
          className="nav-item"
          aria-pressed={rig}
          title="Rig layout"
          onClick={() => store.set({ rig: !rig })}
        >
          <span className="nav-icon">
            <PanelsTopLeft {...ICON} />
          </span>
          <span className="nav-label">Rig layout</span>
          <span className="nav-keys">
            <Keycap>{MOD}</Keycap>
            <Keycap>.</Keycap>
          </span>
        </button>
        <div className="nav-conn" data-conn={conn} title={server ? `Server ${server.version}` : undefined}>
          <span className="nav-conn-state">{CONNECTION[conn]}</span>
          <span className="nav-conn-host num">{window.location.host}</span>
        </div>
      </div>
      {rig && <RegionTag region="nav" label="Rail" />}
    </nav>
  );
}
