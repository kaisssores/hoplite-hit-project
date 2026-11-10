import type { ThemeId } from "@tether/contract";

/**
 * A theme is a complete token set, not a recolor: surfaces, text roles, accent,
 * semantics, haze, corner scale, line weight and elevation all move together.
 * Components read only the CSS variables written by `applyTheme`.
 */
export interface Theme {
  id: ThemeId;
  name: string;
  family: "haze" | "classic";
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
    /** Fill for the one primary action and for selection. */
    accent: string;
    /** Text and icons placed on the accent fill. */
    accentInk: string;
    /** The accent used as text on a surface. Holds 4.5:1. */
    accentText: string;
    /** The accent used as a line or a mark. Holds 3:1. */
    accentLine: string;
    positive: string;
    warning: string;
    negative: string;
  };
  /** Opacity of the primary text color used for hairlines. */
  hairline: number;
  /** The mist around live things: the line in flight, the logo once connected, keyboard focus. */
  haze: { color: string; strength: number; canvas: number };
  radius: { xs: number; sm: number; md: number; lg: number; xl: number };
  /** Stroke of the tether line and of charts, in px. */
  stroke: number;
  shadow: { small: string; float: string };
  scrim: string;
}

const NEUTRAL_SHADOW_LIGHT = { small: "0 1px 2px rgb(17 27 46 / 0.05), 0 1px 1px rgb(17 27 46 / 0.03)", float: "0 12px 32px -8px rgb(17 27 46 / 0.16), 0 2px 6px rgb(17 27 46 / 0.06)" };
const NEUTRAL_SHADOW_DARK = { small: "none", float: "0 16px 40px rgb(0 0 0 / 0.45)" };

export const THEMES: Theme[] = [
  {
    id: "haze",
    name: "Haze",
    family: "haze",
    mode: "light",
    blurb: "Morning mist, milky blue",
    color: {
      deep: "#EEF2F8",
      page: "#F7F9FC",
      card: "#FFFFFF",
      raised: "#EAEFF6",
      text: "#111B2E",
      text2: "#44516A",
      text3: "#5B6780",
      accent: "#B7D1F3",
      accentInk: "#0D2647",
      accentText: "#285CA6",
      accentLine: "#5A8ED6",
      positive: "#1B7A50",
      warning: "#93600A",
      negative: "#BF3339",
    },
    hairline: 0.09,
    haze: { color: "#8DB4EC", strength: 0.32, canvas: 0.16 },
    radius: { xs: 6, sm: 8, md: 10, lg: 14, xl: 20 },
    stroke: 1.75,
    shadow: NEUTRAL_SHADOW_LIGHT,
    scrim: "rgb(17 27 46 / 0.24)",
  },
  {
    id: "haze-night",
    name: "Haze night",
    family: "haze",
    mode: "dark",
    blurb: "Harbor lights in fog",
    color: {
      deep: "#0A101C",
      page: "#0E1524",
      card: "#131B2D",
      raised: "#1A2438",
      text: "#E7EDF7",
      text2: "#A6B2C6",
      text3: "#8693AA",
      accent: "#A9C8F4",
      accentInk: "#0A1C36",
      accentText: "#A9C8F4",
      accentLine: "#8DB5EE",
      positive: "#5CC99A",
      warning: "#E3B35A",
      negative: "#F07A7E",
    },
    hairline: 0.09,
    haze: { color: "#7FA8E6", strength: 0.24, canvas: 0.1 },
    radius: { xs: 6, sm: 8, md: 10, lg: 14, xl: 20 },
    stroke: 1.75,
    shadow: NEUTRAL_SHADOW_DARK,
    scrim: "rgb(3 7 15 / 0.55)",
  },
  {
    id: "night-watch",
    name: "Night watch",
    family: "classic",
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
      accentLine: "#ff6b2c",
      positive: "#4cc38a",
      warning: "#e2a336",
      negative: "#ec5d5e",
    },
    hairline: 0.08,
    haze: { color: "#ff6b2c", strength: 0.18, canvas: 0 },
    radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 },
    stroke: 1.5,
    shadow: NEUTRAL_SHADOW_DARK,
    scrim: "rgb(0 0 0 / 0.5)",
  },
  {
    id: "chart-room",
    name: "Chart room",
    family: "classic",
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
      accentLine: "#c8410b",
      positive: "#15803d",
      warning: "#a16207",
      negative: "#c62828",
    },
    hairline: 0.1,
    haze: { color: "#c8410b", strength: 0.14, canvas: 0 },
    radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16 },
    stroke: 1.5,
    shadow: { small: "0 1px 2px rgb(27 26 24 / 0.05)", float: "0 8px 24px rgb(27 26 24 / 0.1)" },
    scrim: "rgb(27 26 24 / 0.28)",
  },
  {
    id: "deep-water",
    name: "Deep water",
    family: "classic",
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
      accentLine: "#6fd3c7",
      positive: "#8fd694",
      warning: "#e2b453",
      negative: "#ef6a6e",
    },
    hairline: 0.09,
    haze: { color: "#6fd3c7", strength: 0.18, canvas: 0 },
    radius: { xs: 6, sm: 8, md: 10, lg: 14, xl: 18 },
    stroke: 1.5,
    shadow: NEUTRAL_SHADOW_DARK,
    scrim: "rgb(0 0 0 / 0.5)",
  },
  {
    id: "signal",
    name: "Signal",
    family: "classic",
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
      accentLine: "#ffd60a",
      positive: "#5ee08f",
      warning: "#ffb224",
      negative: "#ff6f73",
    },
    hairline: 0.24,
    // Signal is for people who need edges, not atmosphere.
    haze: { color: "#ffd60a", strength: 0, canvas: 0 },
    radius: { xs: 0, sm: 2, md: 2, lg: 4, xl: 4 },
    stroke: 2,
    shadow: { small: "none", float: "0 0 0 1px rgb(255 255 255 / 0.24)" },
    scrim: "rgb(0 0 0 / 0.7)",
  },
];

/** "Follow the system" switches between these two. */
export const SYSTEM_PAIR: Record<"light" | "dark", ThemeId> = { light: "haze", dark: "haze-night" };

export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}

export function resolveTheme(choice: ThemeId | "system"): Theme {
  if (choice !== "system") return themeById(choice);
  const light = window.matchMedia("(prefers-color-scheme: light)").matches;
  return themeById(SYSTEM_PAIR[light ? "light" : "dark"]);
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** The CSS variables a theme produces. Also what the token inspector lists. */
export function themeVariables(theme: Theme): Record<string, string> {
  const text = rgb(theme.color.text);
  const haze = rgb(theme.haze.color);
  const dark = theme.mode === "dark";
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
    "--hover": `rgb(${text} / ${dark ? 0.05 : 0.04})`,
    // A toggle's track sits below the page and its thumb above it, whichever way the ramp runs.
    "--track": dark ? theme.color.deep : theme.color.raised,
    "--thumb": dark ? theme.color.raised : theme.color.card,
    // Fields are white on light themes so they read as writable, and a step up on dark ones.
    "--field": dark ? theme.color.raised : theme.color.card,
    "--accent": theme.color.accent,
    "--accent-ink": theme.color.accentInk,
    "--accent-text": theme.color.accentText,
    "--accent-line": theme.color.accentLine,
    "--accent-soft": `rgb(${rgb(theme.color.accentLine)} / ${dark ? 0.16 : 0.12})`,
    "--haze": `rgb(${haze} / ${theme.haze.strength})`,
    "--haze-faint": `rgb(${haze} / ${theme.haze.strength / 2.5})`,
    "--haze-canvas": `rgb(${haze} / ${theme.haze.canvas})`,
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
    "--shadow-small": theme.shadow.small,
    "--shadow-float": theme.shadow.float,
    "--scrim": theme.scrim,
  };
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeVariables(theme))) root.style.setProperty(name, value);
  root.dataset.theme = theme.id;
  root.dataset.mode = theme.mode;
  root.style.colorScheme = theme.mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.color.page);
}
