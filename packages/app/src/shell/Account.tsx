import { ChevronsUpDown, Keyboard, LogOut, PanelsTopLeft, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Account } from "@tether/sdk";
import { go, setTheme, signOut } from "../state/sync";
import { store, useStore } from "../state/store";
import { MOD, useOutside } from "../ui/hooks";
import { ICON, Keycap, Segmented } from "../ui/primitives";
import { toggleRig } from "./Rig";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** A monogram on the accent tint. One solid tone, so it reads as a person and not as decoration. */
export function Avatar({ account, size = 32 }: { account: Account | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {account ? initials(account.name) : "?"}
    </span>
  );
}

function MenuItem({ icon, label, keys, onSelect, tone }: { icon: ReactNode; label: string; keys?: ReactNode; onSelect: () => void; tone?: "danger" }) {
  return (
    <button type="button" role="menuitem" className="acct-item" data-tone={tone} onClick={onSelect}>
      <span className="nav-icon">{icon}</span>
      <span className="acct-item-label">{label}</span>
      {keys && <span className="nav-keys">{keys}</span>}
    </button>
  );
}

/**
 * The bottom of the rail: who is signed in, and the doors to everything about
 * them and this workspace. The menu opens toward the content.
 */
export function AccountArea() {
  const account = useStore((state) => state.account);
  const theme = useStore((state) => state.prefs.theme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close, open);

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    button.current?.focus();
    action();
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (!open) return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"], .acct-theme button') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }
  };

  const mode = theme === "haze" ? "light" : theme === "haze-night" ? "dark" : theme === "system" ? "system" : "other";

  return (
    <div className="acct" ref={ref} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className="acct-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title={account ? `${account.name}, ${account.email}` : "Account"}
        onClick={() => setOpen(!open)}
      >
        <Avatar account={account} />
        <span className="acct-who">
          <span className="acct-name">{account?.name ?? "Not signed in"}</span>
          <span className="acct-team">{account?.team || account?.email}</span>
        </span>
        <ChevronsUpDown {...ICON} size={14} className="acct-chevron" />
      </button>
      {open && (
        <div className="acct-menu" role="menu" aria-label="Account">
          <div className="acct-head">
            <Avatar account={account} size={40} />
            <div className="acct-who">
              <span className="acct-name">{account?.name}</span>
              <span className="acct-team">{account?.email}</span>
            </div>
          </div>
          <div className="acct-group">
            <MenuItem icon={<Settings {...ICON} />} label="Settings" keys={<><Keycap>{MOD}</Keycap><Keycap>,</Keycap></>} onSelect={run(() => go({ name: "settings" }))} />
            <MenuItem icon={<PanelsTopLeft {...ICON} />} label="Rig layout" keys={<><Keycap>{MOD}</Keycap><Keycap>.</Keycap></>} onSelect={run(() => toggleRig(true))} />
            <MenuItem icon={<Keyboard {...ICON} />} label="Keyboard shortcuts" keys={<Keycap>?</Keycap>} onSelect={run(() => store.set({ shortcuts: true }))} />
          </div>
          <div className="acct-group acct-theme">
            <span className="acct-label">Theme{mode === "other" ? " · from Settings" : ""}</span>
            <Segmented
              size="sm"
              label="Theme"
              value={mode}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              onChange={(next, event) => setTheme(next === "light" ? "haze" : next === "dark" ? "haze-night" : "system", { x: event.clientX, y: event.clientY })}
            />
          </div>
          <div className="acct-group">
            <MenuItem icon={<LogOut {...ICON} />} label="Sign out" tone="danger" onSelect={run(() => void signOut())} />
          </div>
        </div>
      )}
    </div>
  );
}
