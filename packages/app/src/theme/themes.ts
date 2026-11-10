import type { ThemeId } from "@tether/contract";

/**
 * A theme is a complete token set, not a recolor: surfaces, text roles, accent,
 * semantics, corner scale and line weight all move together. Components read
 * only the CSS variables written by `applyTheme`.
 */
export interface Theme {
  id: ThemeId;
  name: string;
  mode: "dark" | "light";
  blurb: string;
  color: {
    deep: string;
    page: string;
    card: string;
    raised: string;
    text: string;
    text2: string;
    text3: string;
    accent: string;
    /** Text and icons placed on the accent. */
    accentInk: string;
    /** The accent used as text or a line on a surface. */
    accentText: string;
    positive: string;
    warning: string;
    negative: string;
  };
  /** Opacity of the primary text color used for hairlines. */
  hairline: number;
  radius: { xs: number; sm: number; md: number; lg: number; xl: number };
  /** Stroke of the tether line and of charts, in px. */
  stroke: number;
  shadow: string;
}

export const THEMES: Theme[] = [
  {
    id: "night-watch",
    name: "Night watch",
    mode: "dark",
    blurb: "Graphite deck, safety-line orange",
    color: {
      deep: "#0f0f10",
      page: "#141415",
      card: "#19191b",
      raised: "#232325",
      text: "#ededed",
      text2: "#a1a1a6",
      text3: "#85858b",
      accent: "#ff6b2c",
      accentInk: "#1c0d04",
      accentText: "#ff7d45",
      positive: "#4cc38a",
      warning: "#e2a336",
      negative: "#ec5d5e",
    },
    hairline: 0.08,
    radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 },
    stroke: 1.5,
    shadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
  },
  {
    id: "chart-room",
    name: "Chart room",
    mode: "light",
    blurb: "Chart paper, burnt-orange ink",
    color: {
      deep: "#efeeeb",
      page: "#f7f6f4",
      card: "#ffffff",
      raised: "#eceae6",
      text: "#1b1a18",
      text2: "#55524d",
      text3: "#6f6b64",
      accent: "#c8410b",
      accentInk: "#ffffff",
      accentText: "#b83a08",
      positive: "#15803d",
      warning: "#a16207",
      negative: "#c62828",
    },
    hairline: 0.1,
    radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 },
    stroke: 1.5,
    shadow: "0 8px 24px rgba(27, 26, 24, 0.08)",
  },
  {
    id: "deep-water",
    name: "Deep water",
    mode: "dark",
    blurb: "Ink blue-black, beacon green",
    color: {
      deep: "#07080d",
      page: "#0b0d14",
      card: "#11141c",
      raised: "#1a1e28",
      text: "#eef0f5",
      text2: "#a3a9b8",
      text3: "#7a8296",
      accent: "#6fd3c7",
      accentInk: "#052521",
      accentText: "#7fdcd0",
      positive: "#8fd694",
      warning: "#e2b453",
      negative: "#ef6a6e",
    },
    hairline: 0.09,
    radius: { xs: 6, sm: 8, md: 10, lg: 14, xl: 18 },
    stroke: 1.5,
    shadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
  },
  {
    id: "signal",
    name: "Signal",
    mode: "dark",
    blurb: "High contrast, square corners, flag yellow",
    color: {
      deep: "#000000",
      page: "#000000",
      card: "#0b0b0b",
      raised: "#1c1c1c",
      text: "#ffffff",
      text2: "#cfcfcf",
      text3: "#a6a6a6",
      accent: "#ffd60a",
      accentInk: "#000000",
      accentText: "#ffd60a",
      positive: "#5ee08f",
      warning: "#ffb224",
      negative: "#ff6f73",
    },
    hairline: 0.24,
    radius: { xs: 0, sm: 2, md: 2, lg: 4, xl: 4 },
    stroke: 2,
    shadow: "0 0 0 1px rgba(255, 255, 255, 0.24)",
  },
];

export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}

export function resolveTheme(choice: ThemeId | "system"): Theme {
  if (choice !== "system") return themeById(choice);
  const light = window.matchMedia("(prefers-color-scheme: light)").matches;
  return themeById(light ? "chart-room" : "night-watch");
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** The CSS variables a theme produces. Also what the token inspector lists. */
export function themeVariables(theme: Theme): Record<string, string> {
  const text = rgb(theme.color.text);
  return {
    "--bg-deep": theme.color.deep,
    "--bg": theme.color.page,
    "--card": theme.color.card,
    "--raised": theme.color.raised,
    "--text": theme.color.text,
    "--text-2": theme.color.text2,
    "--text-3": theme.color.text3,
    "--line": `rgb(${text} / ${theme.hairline})`,
    "--line-strong": `rgb(${text} / ${Math.min(1, theme.hairline * 2)})`,
    "--hover": `rgb(${text} / ${theme.mode === "dark" ? 0.05 : 0.04})`,
    // A toggle's track sits below the page and its thumb above it, whichever way the ramp runs.
    "--track": theme.mode === "dark" ? theme.color.deep : theme.color.raised,
    "--thumb": theme.mode === "dark" ? theme.color.raised : theme.color.card,
    "--accent": theme.color.accent,
    "--accent-ink": theme.color.accentInk,
    "--accent-text": theme.color.accentText,
    "--accent-soft": `rgb(${rgb(theme.color.accent)} / ${theme.mode === "dark" ? 0.14 : 0.1})`,
    "--pos": theme.color.positive,
    "--warn": theme.color.warning,
    "--neg": theme.color.negative,
    "--neg-soft": `rgb(${rgb(theme.color.negative)} / 0.12)`,
    "--r-xs": `${theme.radius.xs}px`,
    "--r-sm": `${theme.radius.sm}px`,
    "--r-md": `${theme.radius.md}px`,
    "--r-lg": `${theme.radius.lg}px`,
    "--r-xl": `${theme.radius.xl}px`,
    "--stroke": `${theme.stroke}px`,
    "--shadow-float": theme.shadow,
  };
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeVariables(theme))) root.style.setProperty(name, value);
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.mode;
}
