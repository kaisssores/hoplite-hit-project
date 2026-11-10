import { useEffect, type CSSProperties } from "react";
import { commitLayout, go, previewLayout } from "../state/sync";
import { routePath, store, useStore, type Route } from "../state/store";
import { isTyping, useMedia } from "../ui/hooks";
import { Mark } from "../ui/Line";
import { ApiDetail } from "../views/ApiDetail";
import { Catalog } from "../views/Catalog";
import { Keys, KeySheet } from "../views/Keys";
import { Playground } from "../views/Playground";
import { RegisterSheet } from "../views/Register";
import { Sessions } from "../views/Sessions";
import { Usage } from "../views/Usage";
import { Workbench } from "../views/Workbench";
import { Dock } from "./Dock";
import { Nav } from "./Nav";
import { Palette } from "./Palette";
import { DropZones, RigBar, shellGrid, toggleRig } from "./Rig";

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
    case "workbench":
      return <Workbench />;
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

function Boot() {
  const conn = useStore((state) => state.conn);
  return (
    <div className="boot">
      <div className="boot-brand">
        <Mark conn={conn} />
        <span className="brand-word">Tether</span>
      </div>
      <p className="boot-state">{conn === "lost" ? "No answer from the server yet, retrying" : "Reaching the server"}</p>
      {conn === "lost" && (
        <p className="boot-hint">
          Start both with <code className="mono">npm run dev</code>
        </p>
      )}
    </div>
  );
}

export function Shell() {
  const phase = useStore((state) => state.phase);
  const route = useStore((state) => state.route);
  const saved = useStore((state) => state.prefs.layout);
  // A narrow window keeps the saved layout but shows it with the rail as icons and no dock.
  const narrow = useMedia("(max-width: 900px)");
  const layout = narrow ? { ...saved, dock: "hidden" as const, navCollapsed: true } : saved;
  const rig = useStore((state) => state.rig);
  const palette = useStore((state) => state.palette);
  const sheet = useStore((state) => state.sheet);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        store.set({ palette: !store.get().palette });
      } else if (mod && event.key === ".") {
        event.preventDefault();
        toggleRig();
      } else if (event.key === "Escape" && store.get().rig && !store.get().palette && !store.get().sheet) {
        toggleRig(false);
      } else if (event.key === "/" && !isTyping(event.target) && store.get().route.name !== "catalog") {
        event.preventDefault();
        store.set({ palette: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (phase === "booting") return <Boot />;

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
        <Nav />
        {layout.nav !== "top" && !collapsed && <Splitter target="nav" />}
      </div>
      <main className="main" id="main" data-route={route.name}>
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
