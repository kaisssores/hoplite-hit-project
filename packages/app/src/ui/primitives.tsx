import { Check, ChevronsUpDown, Copy, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Method } from "@tether/sdk";
import { useOutside } from "./hooks";

export const ICON = { size: 16, strokeWidth: 1.5 } as const;

/* ───────────── Buttons ───────────── */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, children, className = "", ...rest }: ButtonProps) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children != null && <span className="btn-label">{children}</span>}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/** Copies, then holds a check for a moment so the result is seen where the click happened. */
export function CopyButton({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be denied in embedded previews. The state still confirms the intent.
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      className={`copy ${label ? "copy-labeled" : ""} ${className}`}
      data-copied={copied}
      onClick={copy}
      aria-label={label ? undefined : "Copy"}
      title={label ? undefined : "Copy"}
    >
      <span className="copy-icons">
        <Copy {...ICON} className="copy-a" />
        <Check {...ICON} className="copy-b" />
      </span>
      {label && (
        <span className="roll">
          <span className="roll-a">{label}</span>
          <span className="roll-b">Copied</span>
        </span>
      )}
    </button>
  );
}

/* ───────────── Toggles ───────────── */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** Equal-width segments with one thumb that slides to the selection. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T, event: React.MouseEvent) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const style = { "--seg-count": options.length, "--seg-index": index } as CSSProperties;
  return (
    <div className={`seg seg-${size}`} role="radiogroup" aria-label={label} style={style}>
      <span className="seg-thumb" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          className="seg-item"
          onClick={(event) => onChange(option.value, event)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Small text parts ───────────── */

export function Keycap({ children }: { children: ReactNode }) {
  return <kbd className="keycap">{children}</kbd>;
}

export function MethodTag({ method }: { method: Method }) {
  return (
    <span className="method" data-method={method}>
      {method}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="empty-body">{children}</p>}
      {action}
    </div>
  );
}

/* ───────────── Select ───────────── */

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  meta?: ReactNode;
  group?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder = "Choose",
  align = "left",
  className = "",
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  label?: string;
  placeholder?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close, open);
  const current = options.find((option) => option.value === value);

  const toggle = () => {
    setCursor(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen((was) => !was);
  };
  const choose = (option: SelectOption<T>) => {
    onChange(option.value);
    setOpen(false);
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        toggle();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setCursor((at) => (at + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[cursor];
      if (option) choose(option);
    }
  };

  let lastGroup: string | undefined;
  return (
    <div className={`select ${className}`} ref={ref} onKeyDown={onKey}>
      <button type="button" className="select-btn" aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        {label && <span className="select-label">{label}</span>}
        <span className="select-value">{current?.label ?? <span className="muted">{placeholder}</span>}</span>
        <ChevronsUpDown {...ICON} size={14} />
      </button>
      {open && (
        <div className="menu" data-align={align} role="listbox">
          {options.map((option, index) => {
            const heading = option.group !== lastGroup ? option.group : undefined;
            lastGroup = option.group;
            return (
              <div key={option.value}>
                {heading && <div className="menu-group">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  data-cursor={index === cursor}
                  className="menu-item"
                  onPointerEnter={() => setCursor(index)}
                  onClick={() => choose(option)}
                >
                  <span className="menu-label">{option.label}</span>
                  {option.meta && <span className="menu-meta">{option.meta}</span>}
                  <Check {...ICON} size={14} className="menu-check" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────── Sheet ───────────── */

/** A panel that slides in from the edge the dock is not on. It leaves the same way it came. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 180);
  }, [onClose]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [close]);
  return (
    <div className="sheet-layer" data-closing={closing}>
      <div className="scrim" onClick={close} />
      <aside className="sheet" role="dialog" aria-label={title}>
        <header className="sheet-head">
          <div>
            <h2 className="sheet-title">{title}</h2>
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={close}>
            <X {...ICON} />
          </IconButton>
        </header>
        {children(close)}
      </aside>
    </div>
  );
}
