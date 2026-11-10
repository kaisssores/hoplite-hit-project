import "@fontsource-variable/instrument-sans/wdth.css";
import "@fontsource-variable/geist-mono";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/views.css";
import "./styles/bench.css";
import "./styles/onboarding.css";
import "./styles/motion.css";
import { createRoot } from "react-dom/client";
import type { ThemeId } from "@tether/sdk";
import { Shell } from "./shell/Shell";
import { THEME_CACHE, connect } from "./state/sync";
import { applyTheme, resolveTheme } from "./theme/themes";

// Paint the last theme this browser saw before the server answers, so the intro does not flash another one.
applyTheme(resolveTheme((localStorage.getItem(THEME_CACHE) as ThemeId | "system" | null) ?? "haze"));
connect();

createRoot(document.getElementById("root")!).render(<Shell />);
