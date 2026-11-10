import { useEffect, type CSSProperties } from "react";
import { commitLayout, go, previewLayout } from "../state/sync";
import { routePath, store, useStore, type Route } from "../state/store";
import { isTyping, useMedia } from "../ui/hooks";
import { TensionGlyph } from "../ui/Line";
import { ApiDetail } from "../views/ApiDetail";
import { Catalog } from "../views/Catalog";
import { Keys, KeySheet } from "../views/Keys";
import { Playground } from "../views/Playground";
import { RegisterSheet } from "../views/Register";
import { Sessions } from "../views/Sessions";
import { Settings } from "../views/Settings";
import { Usage } from "../views/Usage";
import { Dock } from "./Dock";
import { Nav } from "./Nav";
import { Onboarding } from "./Onboarding";
import { Palette } from "./Palette";
import { DropZones, RigBar, shellGrid, toggleRig } from "./Rig";
import { ShortcutsDialog } from "./Shortcuts";

function View({ route }: { route: Route }) {
  switch (route.name) {
    case "catalog":
      return <Catalog />;
    case "api":
      return <ApiDetail id={route.id} />;
    case "playground":
      return <Playground />;
    case "keys":
      return <Keys />;
    case "usage":
      return <Usage />;
    case "sessions":
      return <Sessions />;
    case "settings":
      return <Settings section={route.section} />;
  }
}

/** A draggable edge. Sizes follow the pointer directly and are saved once on release. */
function Splitter({ target }: { target: "nav" | "dock" }) {
  const onDown = (event: React.PointerEvent) => {
    event.preventDefault();
    const layout = store.get().prefs.layout;
    const vertical = target === "dock" && layout.dock === "bottom";
    const origin = vertical ? event.clientY : event.clientX;
    const start = target === "nav" ? layout.navWidth : layout.dockSize;
    const sign = target === "nav" && layout.nav === "left" ? 1 : -1;
    const [min, max] = target === "nav" ? [200, 360] : [180, 520];
    document.documentElement.dataset.resizing = vertical ? "row" : "col";
    const move = (moveEvent: PointerEvent) => {
      const delta = (vertical ? moveEvent.clientY : moveEvent.clientX) - origin;
      const size = Math.round(Math.min(max, Math.max(min, start + sign * delta)));
      void previewLayout(target === "nav" ? { navWidth: size } : { dockSize: size });
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
  return <div className="splitter" data-target={target} role="separator" aria-label={`Resize ${target === "nav" ? "rail" : "dock"}`} onPointerDown={onDown} />;
}

/** Shown only while the event stream is down. What is on screen may be stale until it returns. */
function Offline() {
  const conn = useStore((state) => state.conn);
  if (conn === "open") return null;
  return (
    <div className="offline" role="status">
      <TensionGlyph tension={conn === "lost" ? "snapped" : "slack"} />
      {conn === "lost" ? "Line to the server lost. What you see may be out of date; reconnecting" : "Reconnecting to the server"}
    </div>
  );
}

const GO_KEYS: Record<string, Route> = {
  c: { name: "catalog" },
  p: { name: "playground" },
  k: { name: "keys" },
  u: { name: "usage" },
  s: { name: "sessions" },
};

function useShortcuts() {
  useEffect(() => {
    let pendingGo = 0;
    const onKey = (event: KeyboardEvent) => {
      const state = store.get();
      if (state.stage !== "app") return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "k") {
        event.preventDefault();
        store.set({ palette: !state.palette, shortcuts: false });
      } else if (mod && key === ".") {
        event.preventDefault();
        toggleRig();
      } else if (mod && key === ",") {
        event.preventDefault();
        go({ name: "settings" });
      } else if (event.key === "Escape" && state.rig && !state.palette && !state.sheet && !state.shortcuts) {
        toggleRig(false);
      } else if (event.key === "Escape" && state.shortcuts) {
        store.set({ shortcuts: false });
      } else if (mod || event.altKey || isTyping(event.target) || state.palette || state.sheet) {
        return;
      } else if (event.key === "?") {
        event.preventDefault();
        store.set({ shortcuts: !state.shortcuts });
      } else if (event.key === "/" && state.route.name !== "catalog") {
        event.preventDefault();
        store.set({ palette: true });
      } else if (pendingGo > performance.now() && GO_KEYS[key]) {
        event.preventDefault();
        pendingGo = 0;
        go(GO_KEYS[key]!);
      } else if (key === "g") {
        pendingGo = performance.now() + 1000;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function Shell() {
  const stage = useStore((state) => state.stage);
  const route = useStore((state) => state.route);
  const saved = useStore((state) => state.prefs.layout);
  // A narrow window keeps the saved layout but shows it with the rail as icons and no dock.
  const narrow = useMedia("(max-width: 900px)");
  const layout = narrow ? { ...saved, dock: "hidden" as const, navCollapsed: true } : saved;
  const rig = useStore((state) => state.rig);
  const palette = useStore((state) => state.palette);
  const shortcuts = useStore((state) => state.shortcuts);
  const sheet = useStore((state) => state.sheet);
  useShortcuts();

  if (stage !== "app") return <Onboarding />;

  const collapsed = layout.navCollapsed && layout.nav !== "top";
  return (
    <div
      className="shell"
      data-nav={layout.nav}
      data-dock={layout.dock}
      data-collapsed={collapsed || undefined}
      data-rig={rig || undefined}
      style={shellGrid(layout) as CSSProperties}
    >
      <div className="region region-nav">
        <Nav collapsed={collapsed} />
        {layout.nav !== "top" && !collapsed && <Splitter target="nav" />}
      </div>
      <main className="main" id="main" data-route={route.name}>
        <Offline />
        <div className="page" key={routePath(route)} data-route={route.name}>
          <View route={route} />
        </div>
      </main>
      {layout.dock !== "hidden" && (
        <div className="region region-dock">
          <Dock />
          <Splitter target="dock" />
        </div>
      )}
      {rig && <RigBar />}
      <DropZones />
      {palette && <Palette />}
      {shortcuts && <ShortcutsDialog />}
      {sheet?.type === "key" && <KeySheet apiId={sheet.apiId} onClose={() => store.set({ sheet: null })} />}
      {sheet?.type === "register" && (
        <RegisterSheet
          onClose={() => store.set({ sheet: null })}
          onDone={(id) => {
            store.set({ sheet: null });
            go({ name: "api", id });
          }}
        />
      )}
    </div>
  );
}
