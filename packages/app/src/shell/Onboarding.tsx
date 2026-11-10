import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TetherError } from "@tether/sdk";
import { reducedMotion } from "../state/motion";
import { saveAccount, setStage, setTheme } from "../state/sync";
import { store, useStore } from "../state/store";
import { tensionOfConnection } from "../ui/Line";
import { LogoMark } from "../ui/Logo";
import { Segmented } from "../ui/primitives";

/** How long the mark takes to build. The intro never hands over before it has finished. */
const BUILD_MS = 1100;
/** How long the line holds taut before the next stage, so the connection is seen to land. */
const HOLD_MS = 520;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO = { name: "Mara Lindqvist", email: "mara@northwind.dev", team: "Payments platform" };

/**
 * Intro: the mark builds while the server is reached, and pulls taut when it
 * answers. Its tension is the real connection state, so a server that is not
 * running leaves the line fallen and says so.
 */
function Intro() {
  const phase = useStore((state) => state.phase);
  const conn = useStore((state) => state.conn);
  const [taut, setTaut] = useState(false);
  const started = useRef(performance.now());

  useEffect(() => {
    if (phase !== "ready") return;
    const quick = reducedMotion();
    const wait = quick ? 0 : Math.max(0, BUILD_MS - (performance.now() - started.current));
    const timers = [
      setTimeout(() => setTaut(true), wait),
      setTimeout(() => setStage(store.get().account ? "app" : "register"), wait + (quick ? 120 : HOLD_MS)),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const tension = taut ? "taut" : conn === "lost" ? "snapped" : "slack";
  const status = taut ? "Tethered" : conn === "lost" ? "No answer from the server yet" : "Reaching the server";

  return (
    <div className="intro">
      <LogoMark tension={tension} size={88} intro className="brand-mark intro-mark" />
      <p className="intro-word">Tether</p>
      <p className="intro-status" role="status" data-state={tension}>
        {status}
      </p>
      {conn === "lost" && !taut && (
        <p className="intro-hint">
          Start it with <code className="mono">npm run dev</code>. This page connects on its own
        </p>
      )}
    </div>
  );
}

type Fields = { name: string; email: string; team: string };

function problems(fields: Fields): Partial<Record<keyof Fields, string>> {
  const found: Partial<Record<keyof Fields, string>> = {};
  if (!fields.name.trim()) found.name = "Enter the name your team knows you by";
  if (!fields.email.trim()) found.email = "Enter your work email";
  else if (!EMAIL.test(fields.email.trim())) found.email = "That does not look like an email address";
  return found;
}

/** Registration. The account is kept by this Tether server; there is no password in the prototype. */
function Register() {
  const prefs = useStore((state) => state.prefs);
  const conn = useStore((state) => state.conn);
  const [fields, setFields] = useState<Fields>({ name: "", email: "", team: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => first.current?.focus({ preventScroll: true }), []);

  const found = problems(fields);
  const shown = (field: keyof Fields) => (submitted || touched[field] ? found[field] : undefined);
  const appearance = prefs.theme === "haze" ? "light" : prefs.theme === "haze-night" ? "dark" : prefs.theme === "system" ? "system" : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (Object.keys(found).length) {
      document.getElementById(`${id}-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await saveAccount({ name: fields.name.trim(), email: fields.email.trim(), team: fields.team.trim() });
      setStage("app");
    } catch (problem) {
      setError(problem instanceof TetherError ? problem.message : "The server did not answer. Try again in a moment");
      setBusy(false);
    }
  };

  const input = (field: keyof Fields, label: string, options: { type?: string; placeholder: string; hint?: string; autoComplete: string }) => {
    const message = shown(field);
    return (
      <div className="reg-field" data-invalid={message ? true : undefined}>
        <label htmlFor={`${id}-${field}`}>
          {label}
          {options.hint && <span className="field-hint">{options.hint}</span>}
        </label>
        <input
          ref={field === "name" ? first : undefined}
          id={`${id}-${field}`}
          className="input"
          type={options.type ?? "text"}
          autoComplete={options.autoComplete}
          placeholder={options.placeholder}
          value={fields[field]}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-${field}-error` : undefined}
          onChange={(event) => setFields({ ...fields, [field]: event.target.value })}
          onBlur={() => setTouched({ ...touched, [field]: true })}
        />
        <p className="reg-error" id={`${id}-${field}-error`} aria-live="polite">
          {message}
        </p>
      </div>
    );
  };

  return (
    <form className="register" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <header className="register-head">
        <span className="brand-lockup">
          <LogoMark tension={tensionOfConnection(conn)} size={32} className="brand-mark" />
          <span className="brand-word">Tether</span>
        </span>
        <h1 className="register-title" id={`${id}-title`}>
          Set up your account
        </h1>
        <p className="register-sub">Your keys, sessions and layout are kept by this Tether server. Nothing here leaves your machine.</p>
      </header>

      {input("name", "Name", { placeholder: "Mara Lindqvist", autoComplete: "name" })}
      {input("email", "Work email", { type: "email", placeholder: "mara@northwind.dev", autoComplete: "email" })}
      {input("team", "Team", { placeholder: "Payments platform", hint: "Optional", autoComplete: "organization" })}

      <div className="reg-field">
        <span className="reg-label" id={`${id}-appearance`}>
          Appearance
          <span className="field-hint">More themes in Settings</span>
        </span>
        <Segmented
          label="Appearance"
          value={appearance ?? "none"}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
          onChange={(next, event) =>
            setTheme(next === "light" ? "haze" : next === "dark" ? "haze-night" : "system", { x: event.clientX, y: event.clientY })
          }
        />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <footer className="register-foot">
        <button
          type="button"
          className="btn btn-ghost btn-md"
          onClick={() => {
            setFields(DEMO);
            setTouched({});
          }}
        >
          Fill in demo details
        </button>
        <button type="submit" className="btn btn-primary btn-md register-submit" disabled={busy || conn !== "open"} data-busy={busy || undefined}>
          <span className="roll" data-on={busy || undefined}>
            <span className="roll-a">Create account</span>
            <span className="roll-b">Creating</span>
          </span>
        </button>
      </footer>
    </form>
  );
}

/** Everything before the product: one scene, a horizon line across it, and haze where the line meets the mark. */
export function Onboarding() {
  const stage = useStore((state) => state.stage);
  return (
    <div className="scene" data-stage={stage}>
      <div className="scene-mist" aria-hidden="true" />
      <div className="scene-horizon" aria-hidden="true" />
      {stage === "intro" ? <Intro /> : <Register />}
      <p className="scene-foot mono">Local prototype · state in .tether/state.json</p>
    </div>
  );
}
