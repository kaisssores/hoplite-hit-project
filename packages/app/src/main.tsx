import "@fontsource-variable/instrument-sans/wdth.css";
import "@fontsource-variable/geist-mono";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/views.css";
import "./styles/bench.css";
import "./styles/motion.css";
import { createRoot } from "react-dom/client";
import { Shell } from "./shell/Shell";
import { connect } from "./state/sync";
import { applyTheme, resolveTheme } from "./theme/themes";

// Paint the default theme before the server answers, then let its preferences take over.
applyTheme(resolveTheme("night-watch"));
document.documentElement.dataset.first = "";
connect();

createRoot(document.getElementById("root")!).render(<Shell />);
