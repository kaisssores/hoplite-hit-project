import { CATALOG_COLUMNS, THEME_IDS, type Layout, type Preferences, type PreferencesPatch } from "@tether/contract";
import { clamp } from "./util.ts";

export class InvalidPreferences extends Error {}

const ENUMS = {
  nav: ["left", "right", "top"],
  dock: ["right", "bottom", "hidden"],
  density: ["compact", "regular"],
  bench: ["columns", "rows"],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function requireOneOf<T extends string>(name: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new InvalidPreferences(`${name} must be one of ${allowed.join(", ")}`);
}

function requireNumber(name: string, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new InvalidPreferences(`${name} must be a number`);
  return clamp(value, min, max);
}

function requireModules(name: string, value: unknown): { id: string; hidden: boolean }[] {
  if (!Array.isArray(value) || !value.every((m) => isRecord(m) && typeof m.id === "string" && typeof m.hidden === "boolean")) {
    throw new InvalidPreferences(`${name} must be a list of { id, hidden }`);
  }
  return value.map((m) => ({ id: m.id, hidden: m.hidden }));
}

function mergeLayout(current: Layout, patch: Record<string, unknown>): Layout {
  const next: Layout = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    switch (key) {
      case "nav":
      case "dock":
      case "density":
      case "bench":
        (next as unknown as Record<string, unknown>)[key] = requireOneOf(`layout.${key}`, value, ENUMS[key]);
        break;
      case "navCollapsed":
        if (typeof value !== "boolean") throw new InvalidPreferences("layout.navCollapsed must be a boolean");
        next.navCollapsed = value;
        break;
      case "navWidth":
        next.navWidth = requireNumber("layout.navWidth", value, 200, 360);
        break;
      case "dockSize":
        next.dockSize = requireNumber("layout.dockSize", value, 180, 520);
        break;
      case "benchRatio":
        next.benchRatio = requireNumber("layout.benchRatio", value, 0.25, 0.75);
        break;
      case "catalog": {
        if (!isRecord(value)) throw new InvalidPreferences("layout.catalog must be an object");
        const columns = value.columns;
        if (!Array.isArray(columns) || !columns.every((c) => (CATALOG_COLUMNS as string[]).includes(c as string))) {
          throw new InvalidPreferences(`layout.catalog.columns must be a list of ${CATALOG_COLUMNS.join(", ")}`);
        }
        next.catalog = { group: requireOneOf("layout.catalog.group", value.group, ["none", "category"] as const), columns: columns as Layout["catalog"]["columns"] };
        break;
      }
      case "modules": {
        if (!isRecord(value)) throw new InvalidPreferences("layout.modules must be an object");
        next.modules = {
          api: requireModules("layout.modules.api", value.api) as Layout["modules"]["api"],
          usage: requireModules("layout.modules.usage", value.usage) as Layout["modules"]["usage"],
        };
        break;
      }
      default:
        throw new InvalidPreferences(`Unknown layout field: ${key}`);
    }
  }
  return next;
}

/** Top level merges shallowly, `layout` merges one level down, and numbers are clamped to usable ranges. */
export function mergePreferences(current: Preferences, patch: PreferencesPatch): Preferences {
  if (!isRecord(patch)) throw new InvalidPreferences("Body must be an object");
  const next: Preferences = { ...current };
  if (patch.theme !== undefined) next.theme = requireOneOf("theme", patch.theme, [...THEME_IDS, "system"] as const);
  if (patch.motion !== undefined) next.motion = requireOneOf("motion", patch.motion, ["system", "full", "reduced"] as const);
  if (patch.layout !== undefined) {
    if (!isRecord(patch.layout)) throw new InvalidPreferences("layout must be an object");
    next.layout = mergeLayout(current.layout, patch.layout);
  }
  if (patch.saved !== undefined) {
    const saved = patch.saved;
    if (!Array.isArray(saved) || !saved.every((s) => isRecord(s) && typeof s.id === "string" && typeof s.name === "string" && isRecord(s.layout))) {
      throw new InvalidPreferences("saved must be a list of { id, name, layout }");
    }
    next.saved = saved;
  }
  return next;
}
