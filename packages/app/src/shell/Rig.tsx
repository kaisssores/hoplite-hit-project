import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_LAYOUT, LAYOUT_PRESETS, type Layout, type ModuleState } from "@tether/sdk";
import { transition, vtName } from "../state/motion";
import { commitLayout, previewLayout, removeSavedLayout, saveLayout, setLayout } from "../state/sync";
import { store, useStore } from "../state/store";
import { Button, ICON, IconButton, Segmented, Switch } from "../ui/primitives";

/**
 * Rigging: the product's own layout is an editable thing. In rig mode every
 * region and module shows its frame, can be dragged to a new place or hidden,
 * and the result is saved on the server like any other state.
 */

export function toggleRig(next = !store.get().rig) {
  void transition("flip", () => store.set({ rig: next, drag: null }));
}

/** Grid tracks and areas for a layout. The shell and the rig bar's miniature both use it. */
export function shellGrid(layout: Layout, scale = 1): CSSProperties {
  const px = (n: number) => `${Math.round(n * scale)}px`;
  const nav = layout.nav === "top" ? px(52) : layout.navCollapsed ? px(56) : px(layout.navWidth);
  const dock = px(layout.dockSize);
  const fill = "minmax(0, 1fr)";
  let columns: string[];
  let rows: string[];
  let areas: string[];
  if (layout.nav === "top") {
    if (layout.dock === "right") [columns, rows, areas] = [[fill, dock], [nav, fill], ["nav nav", "main dock"]];
    else if (layout.dock === "bottom") [columns, rows, areas] = [[fill], [nav, fill, dock], ["nav", "main", "dock"]];
    else [columns, rows, areas] = [[fill], [nav, fill], ["nav", "main"]];
  } else {
    const left = layout.nav === "left";
    if (layout.dock === "right") {
      [columns, rows, areas] = left ? [[nav, fill, dock], [fill], ["nav main dock"]] : [[fill, dock, nav], [fill], ["main dock nav"]];
    } else if (layout.dock === "bottom") {
      [columns, rows, areas] = left
        ? [[nav, fill], [fill, dock], ["nav main", "nav dock"]]
        : [[fill, nav], [fill, dock], ["main nav", "dock nav"]];
    } else {
      [columns, rows, areas] = left ? [[nav, fill], [fill], ["nav main"]] : [[fill, nav], [fill], ["main nav"]];
    }
  }
  return {
    gridTemplateColumns: columns.join(" "),
    gridTemplateRows: rows.join(" "),
    gridTemplateAreas: areas.map((area) => `"${area}"`).join(" "),
  };
}

function dockPatch(dock: Layout["dock"], layout: Layout): Partial<Layout> {
  if (dock === "bottom") return { dock, dockSize: Math.min(layout.dockSize, 260) };
  if (dock === "right") return { dock, dockSize: Math.max(layout.dockSize, 300) };
  return { dock };
}

/* ───────────── Dragging a region to an edge ───────────── */

const pointer = { x: 0, y: 0 };

export function RegionTag({ region, label }: { region: "nav" | "dock"; label: string }) {
  const dragging = useStore((state) => state.drag !== null);
  if (dragging) return null;
  return (
    <button
      type="button"
      className="region-tag"
      title={`Drag the ${label.toLowerCase()} to another edge`}
      onPointerDown={(event) => {
        event.preventDefault();
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        store.set({ drag: region });
      }}
    >
      <GripVertical {...ICON} size={14} />
      {label}
    </button>
  );
}

const ZONES = {
  nav: [
    { id: "left", label: "Rail left" },
    { id: "top", label: "Rail top" },
    { id: "right", label: "Rail right" },
  ],
  dock: [
    { id: "right", label: "Dock right" },
    { id: "bottom", label: "Dock bottom" },
  ],
} as const;

export function DropZones() {
  const drag = useStore((state) => state.drag);
  const layout = useStore((state) => state.prefs.layout);
  const [over, setOver] = useState<string | null>(null);
  const overRef = useRef<string | null>(null);
  overRef.current = over;
  const ghost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drag) return;
    const place = () => {
      if (ghost.current) ghost.current.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 20}px)`;
    };
    place();
    const move = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      place();
    };
    const up = () => {
      const zone = overRef.current;
      store.set({ drag: null });
      setOver(null);
      if (!zone) return;
      const current = store.get().prefs.layout;
      if (drag === "nav") setLayout({ nav: zone as Layout["nav"] });
      else setLayout(dockPatch(zone as Layout["dock"], current));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag]);

  if (!drag) return null;
  const current = drag === "nav" ? layout.nav : layout.dock;
  return (
    <div className="zones" data-drag={drag}>
      {ZONES[drag].map((zone) => (
        <div
          key={zone.id}
          className="zone"
          data-zone={zone.id}
          data-over={over === zone.id || undefined}
          data-current={current === zone.id || undefined}
          onPointerEnter={() => setOver(zone.id)}
          onPointerLeave={() => setOver((was) => (was === zone.id ? null : was))}
        >
          <span className="zone-label">{zone.label}</span>
        </div>
      ))}
      <div className="zone-ghost" ref={ghost}>
        <GripVertical {...ICON} size={14} />
        {drag === "nav" ? "Rail" : "Dock"}
      </div>
    </div>
  );
}

/* ───────────── The rig bar ───────────── */

function Mini({ layout }: { layout: Layout }) {
  return (
    <div className="rig-mini" style={shellGrid(layout, 0.085)} aria-hidden="true">
      <span style={{ gridArea: "nav" }} data-part="nav" />
      <span style={{ gridArea: "main" }} data-part="main" />
      {layout.dock !== "hidden" && <span style={{ gridArea: "dock" }} data-part="dock" />}
    </div>
  );
}

export function RigBar() {
  const prefs = useStore((state) => state.prefs);
  const layout = prefs.layout;
  const [name, setName] = useState("");
  const activePreset = LAYOUT_PRESETS.find((preset) => JSON.stringify(preset.layout) === JSON.stringify(layout))?.id;

  return (
    <div className="rig-bar" role="toolbar" aria-label="Rig layout">
      <div className="rig-group rig-intro">
        <Mini layout={layout} />
        <div>
          <p className="rig-title">Rigging</p>
          <p className="rig-hint">Drag a tag to an edge, drag modules to reorder</p>
        </div>
      </div>

      <div className="rig-group">
        <span className="rig-label">Rig</span>
        <div className="rig-row">
          {LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip"
              aria-pressed={activePreset === preset.id}
              title={preset.hint}
              onClick={() => setLayout(preset.layout)}
            >
              {preset.name}
            </button>
          ))}
          {prefs.saved.map((saved) => (
            <span key={saved.id} className="chip chip-split" data-flip style={{ "--vt": vtName("rig", saved.id) } as CSSProperties}>
              <button type="button" onClick={() => setLayout(saved.layout)} title="Apply this rig">
                {saved.name}
              </button>
              <button type="button" aria-label={`Delete ${saved.name}`} onClick={() => removeSavedLayout(saved.id)}>
                <X {...ICON} size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="rig-group">
        <span className="rig-label">Rail</span>
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
            <Switch
              label="Icons only"
              checked={layout.navCollapsed && layout.nav !== "top"}
              onChange={(navCollapsed) => layout.nav !== "top" && setLayout({ navCollapsed })}
            />
            Icons only
          </span>
        </div>
      </div>

      <div className="rig-group">
        <span className="rig-label">Dock</span>
        <Segmented
          size="sm"
          label="Dock position"
          value={layout.dock}
          options={[
            { value: "right", label: "Right" },
            { value: "bottom", label: "Bottom" },
            { value: "hidden", label: "Off" },
          ]}
          onChange={(dock) => setLayout(dockPatch(dock, layout))}
        />
      </div>

      <div className="rig-group">
        <span className="rig-label">Density</span>
        <Segmented
          size="sm"
          label="Density"
          value={layout.density}
          options={[
            { value: "regular", label: "Regular" },
            { value: "compact", label: "Compact" },
          ]}
          onChange={(density) => setLayout({ density }, "flip")}
        />
      </div>

      <div className="rig-group">
        <span className="rig-label">Playground</span>
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

      <div className="rig-group rig-end">
        <form
          className="rig-save"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            saveLayout(name.trim());
            setName("");
          }}
        >
          <input className="input input-sm" placeholder="Name this rig" value={name} onChange={(event) => setName(event.target.value)} aria-label="Rig name" />
          <Button size="sm" type="submit" disabled={!name.trim()}>
            Save
          </Button>
        </form>
        <Button size="sm" variant="ghost" onClick={() => setLayout(DEFAULT_LAYOUT)}>
          Reset
        </Button>
        <Button size="sm" variant="primary" onClick={() => toggleRig(false)}>
          Done
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Page modules ───────────── */

/**
 * A page made of modules. Their order and visibility come from the saved
 * layout; in rig mode each one shows a frame with a handle and a hide toggle.
 */
export function Modules<Id extends string>({
  page,
  titles,
  children,
}: {
  page: "api" | "usage";
  titles: Record<Id, string>;
  children: (id: Id) => { meta?: ReactNode; body: ReactNode } | null;
}) {
  const modules = useStore((state) => state.prefs.layout.modules);
  const rig = useStore((state) => state.rig);
  const order = modules[page] as unknown as ModuleState<Id>[];
  const container = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [dragging, setDragging] = useState<Id | null>(null);

  const write = (next: ModuleState<Id>[], save: boolean) => {
    const patch = { modules: { ...store.get().prefs.layout.modules, [page]: next } } as Partial<Layout>;
    if (save) return setLayout(patch, "flip");
    busy.current = true;
    void previewLayout(patch, "flip").then(() => (busy.current = false));
  };
  const current = () => store.get().prefs.layout.modules[page] as unknown as ModuleState<Id>[];
  const moveTo = (id: Id, to: number, save: boolean) => {
    const list = current().slice();
    const from = list.findIndex((entry) => entry.id === id);
    if (from === -1 || to < 0 || to >= list.length || to === from) return;
    const [entry] = list.splice(from, 1);
    list.splice(to, 0, entry!);
    write(list, save);
  };
  const toggle = (id: Id) =>
    write(current().map((entry) => (entry.id === id ? { ...entry, hidden: !entry.hidden } : entry)), true);

  const startDrag = (id: Id) => (event: React.PointerEvent) => {
    event.preventDefault();
    setDragging(id);
    const move = (moveEvent: PointerEvent) => {
      if (busy.current || !container.current) return;
      const frames = [...container.current.querySelectorAll<HTMLElement>(":scope > .module")];
      const from = frames.findIndex((frame) => frame.dataset.module === id);
      let to = from;
      frames.forEach((frame, index) => {
        const rect = frame.getBoundingClientRect();
        const middle = rect.top + rect.height / 2;
        if (index < from && moveEvent.clientY < middle && to === from) to = index;
        if (index > from && moveEvent.clientY > middle) to = index;
      });
      if (to !== from) moveTo(id, to, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(null);
      commitLayout();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="modules" ref={container}>
      {order.map((entry, index) => {
        if (entry.hidden && !rig) return null;
        const content = entry.hidden ? null : children(entry.id);
        if (!entry.hidden && !content) return null;
        return (
          <section
            key={entry.id}
            className="module"
            data-module={entry.id}
            data-hidden={entry.hidden || undefined}
            data-dragging={dragging === entry.id || undefined}
            data-flip
            style={{ "--vt": vtName(`mod-${page}`, entry.id) } as CSSProperties}
          >
            <header className="module-head">
              {rig && (
                <button type="button" className="module-grip" aria-label={`Drag ${titles[entry.id]}`} onPointerDown={startDrag(entry.id)}>
                  <GripVertical {...ICON} />
                </button>
              )}
              <h2 className="module-title">{titles[entry.id]}</h2>
              {content?.meta && !rig && <div className="module-meta">{content.meta}</div>}
              {rig && (
                <div className="module-tools">
                  <IconButton label="Move up" disabled={index === 0} onClick={() => moveTo(entry.id, index - 1, true)}>
                    <ArrowUp {...ICON} />
                  </IconButton>
                  <IconButton label="Move down" disabled={index === order.length - 1} onClick={() => moveTo(entry.id, index + 1, true)}>
                    <ArrowDown {...ICON} />
                  </IconButton>
                  <IconButton label={entry.hidden ? "Show module" : "Hide module"} onClick={() => toggle(entry.id)}>
                    {entry.hidden ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                  </IconButton>
                </div>
              )}
            </header>
            {content && <div className="module-body">{content.body}</div>}
          </section>
        );
      })}
    </div>
  );
}
