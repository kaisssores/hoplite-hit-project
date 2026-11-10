import { BookOpen, ChartSpline, History, KeyRound, PanelLeftClose, PanelLeftOpen, Search, SquareTerminal } from "lucide-react";
import type { ReactNode } from "react";
import { go, setLayout } from "../state/sync";
import { routePath, store, useStore, type Route } from "../state/store";
import { MOD } from "../ui/hooks";
import { Logo } from "../ui/Logo";
import { ICON, Keycap } from "../ui/primitives";
import { AccountArea } from "./Account";
import { RegionTag } from "./Rig";

const CONNECTION: Record<string, string> = {
  open: "Tethered to the server",
  connecting: "Reaching the server",
  lost: "Line to the server lost, retrying",
};

function Item({ route, icon, label, count, active, keys }: { route: Route; icon: ReactNode; label: string; count?: number; active: boolean; keys: string }) {
  return (
    <a
      className="nav-item"
      href={routePath(route)}
      aria-current={active ? "page" : undefined}
      title={`${label}  G then ${keys}`}
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

export function Nav({ collapsed }: { collapsed: boolean }) {
  const route = useStore((state) => state.route.name);
  const conn = useStore((state) => state.conn);
  const apis = useStore((state) => state.apis.length);
  const keys = useStore((state) => state.keys);
  const sessions = useStore((state) => state.sessions.length);
  const layout = useStore((state) => state.prefs.layout);
  const rig = useStore((state) => state.rig);
  const top = layout.nav === "top";
  const activeKeys = keys.filter((key) => key.status === "active").length;

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-brand">
        <a
          className="brand"
          href="/"
          title={CONNECTION[conn]}
          onClick={(event) => {
            event.preventDefault();
            go({ name: "catalog" });
          }}
        >
          <Logo conn={conn} />
          <span className="sr-only">{CONNECTION[conn]}</span>
        </a>
        {!top && (
          <button
            type="button"
            className="icon-btn nav-collapse"
            aria-label={collapsed ? "Expand rail" : "Collapse rail"}
            title={collapsed ? "Expand rail" : "Collapse rail"}
            onClick={() => setLayout({ navCollapsed: !layout.navCollapsed })}
          >
            {collapsed ? <PanelLeftOpen {...ICON} /> : <PanelLeftClose {...ICON} />}
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
        <Item route={{ name: "catalog" }} keys="C" icon={<BookOpen {...ICON} />} label="Catalog" count={apis} active={route === "catalog" || route === "api"} />
        <Item route={{ name: "playground" }} keys="P" icon={<SquareTerminal {...ICON} />} label="Playground" active={route === "playground"} />
        <Item route={{ name: "keys" }} keys="K" icon={<KeyRound {...ICON} />} label="Keys" count={activeKeys} active={route === "keys"} />
        <Item route={{ name: "usage" }} keys="U" icon={<ChartSpline {...ICON} />} label="Usage" active={route === "usage"} />
        <Item route={{ name: "sessions" }} keys="S" icon={<History {...ICON} />} label="Sessions" count={sessions} active={route === "sessions"} />
      </div>

      <div className="nav-foot">
        <AccountArea />
      </div>
      {rig && <RegionTag region="nav" label="Rail" />}
    </nav>
  );
}
