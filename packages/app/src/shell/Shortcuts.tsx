import { X } from "lucide-react";
import type { ReactNode } from "react";
import { store } from "../state/store";
import { MOD } from "../ui/hooks";
import { ICON, IconButton, Keycap } from "../ui/primitives";

export const SHORTCUTS: { group: string; rows: { keys: ReactNode; label: string }[] }[] = [
  {
    group: "Anywhere",
    rows: [
      { keys: <><Keycap>{MOD}</Keycap><Keycap>K</Keycap></>, label: "Search pages, APIs, endpoints and actions" },
      { keys: <Keycap>/</Keycap>, label: "Search, or filter the catalog when it is open" },
      { keys: <><Keycap>{MOD}</Keycap><Keycap>,</Keycap></>, label: "Settings" },
      { keys: <><Keycap>{MOD}</Keycap><Keycap>.</Keycap></>, label: "Rig layout" },
      { keys: <Keycap>?</Keycap>, label: "This list" },
      { keys: <Keycap>Esc</Keycap>, label: "Close what is open" },
    ],
  },
  {
    group: "Go to",
    rows: [
      { keys: <><Keycap>G</Keycap><Keycap>C</Keycap></>, label: "Catalog" },
      { keys: <><Keycap>G</Keycap><Keycap>P</Keycap></>, label: "Playground" },
      { keys: <><Keycap>G</Keycap><Keycap>K</Keycap></>, label: "Keys" },
      { keys: <><Keycap>G</Keycap><Keycap>U</Keycap></>, label: "Usage" },
      { keys: <><Keycap>G</Keycap><Keycap>S</Keycap></>, label: "Sessions" },
    ],
  },
  {
    group: "Playground and catalog",
    rows: [
      { keys: <><Keycap>{MOD}</Keycap><Keycap>↵</Keycap></>, label: "Send the request" },
      { keys: <><Keycap>↑</Keycap><Keycap>↓</Keycap></>, label: "Move through catalog rows and menus" },
    ],
  },
];

export function ShortcutTable() {
  return (
    <div className="shortcuts">
      {SHORTCUTS.map((group) => (
        <section key={group.group}>
          <h3>{group.group}</h3>
          <dl>
            {group.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.keys}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function ShortcutsDialog() {
  const close = () => store.set({ shortcuts: false });
  return (
    <div className="palette-layer" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <div className="palette dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <header className="dialog-head">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <IconButton label="Close" autoFocus onClick={close}>
            <X {...ICON} />
          </IconButton>
        </header>
        <ShortcutTable />
      </div>
    </div>
  );
}
