import { flushSync } from "react-dom";

/**
 * Every structural change in the client goes through `transition`. It wraps the
 * update in a view transition and tags <html> with the kind, so CSS decides
 * which elements keep their identity across the change:
 *
 *   route  — the page slides in the direction of travel, the API name morphs
 *   flip   — rows and modules glide to their new place
 *   shell  — rail, page and dock morph to the new arrangement
 *   theme  — the new theme spreads from where it was picked
 */
export type TransitionKind = "route" | "flip" | "shell" | "theme";

interface ViewTransitionLike {
  finished: Promise<void>;
}

let token = 0;

export function reducedMotion(): boolean {
  const choice = document.documentElement.dataset.motion;
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function transition(
  kind: TransitionKind,
  update: () => void,
  options: { dir?: "forward" | "back" | "lateral"; origin?: { x: number; y: number } } = {},
): Promise<void> {
  const start = (document as unknown as { startViewTransition?: (cb: () => void) => ViewTransitionLike })
    .startViewTransition;
  if (!start || reducedMotion()) {
    flushSync(update);
    return Promise.resolve();
  }
  const root = document.documentElement;
  const mine = ++token;
  root.dataset.vt = kind;
  if (options.dir) root.dataset.vtDir = options.dir;
  else delete root.dataset.vtDir;
  if (options.origin) {
    root.style.setProperty("--vt-x", `${options.origin.x}px`);
    root.style.setProperty("--vt-y", `${options.origin.y}px`);
  }
  const running = start.call(document, () => flushSync(update));
  const clear = () => {
    if (mine !== token) return;
    delete root.dataset.vt;
    delete root.dataset.vtDir;
  };
  return running.finished.then(clear, clear);
}

/** A valid CSS identifier for `view-transition-name`. */
export function vtName(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
