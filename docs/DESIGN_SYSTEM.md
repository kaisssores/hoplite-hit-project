# Tether design system

The reference for building Tether screens. The reasoning behind these choices is in [DESIGN.md](DESIGN.md).

Sources of truth:

- `packages/app/src/theme/themes.ts` — every theme-dependent value, written to CSS variables by `applyTheme`.
- `packages/app/src/styles/base.css` — theme-independent tokens (`:root`), primitives and focus.
- `packages/app/src/styles/motion.css` — keyframes, view transitions and reduced motion.
- `scripts/contrast.mjs` — prints the contrast ratios quoted below for the Haze themes.

Components read CSS variables only. Never put a hex value in a component or stylesheet; add a role to `Theme` instead.

## Color

### Roles

| Variable | Role | Haze | Haze night |
| --- | --- | --- | --- |
| `--bg-deep` | Wells: tracks, code blocks, inset areas | `#EEF2F8` | `#0A101C` |
| `--bg` | The canvas behind everything | `#F7F9FC` | `#0E1524` |
| `--card` | Content surfaces | `#FFFFFF` | `#131B2D` |
| `--raised` | Hover on cards, menus on dark, segmented tracks | `#EAEFF6` | `#1A2438` |
| `--text` | Primary text, titles | `#111B2E` | `#E7EDF7` |
| `--text-2` | Secondary text, body in dense rows | `#44516A` | `#A6B2C6` |
| `--text-3` | Labels, meta, idle icons | `#5B6780` | `#8693AA` |
| `--accent` | Fill of the one primary action, selection | `#B7D1F3` | `#A9C8F4` |
| `--accent-ink` | Text and icons on `--accent` | `#0D2647` | `#0A1C36` |
| `--accent-text` | Accent as text on a surface (links, active nav) | `#285CA6` | `#A9C8F4` |
| `--accent-line` | Accent as a line: the line in flight, focus ring, chart lead | `#5A8ED6` | `#8DB5EE` |
| `--accent-soft` | Tinted backgrounds: selected rows, `::selection` | `--accent-line` at 12% | at 16% |
| `--pos` / `--warn` / `--neg` | Semantic text and lines | `#1B7A50` / `#93600A` / `#BF3339` | `#5CC99A` / `#E3B35A` / `#F07A7E` |
| `--neg-soft` | Background of destructive buttons and error callouts | `--neg` at 12% | same |
| `--line` / `--line-strong` | Hairlines, at 9% and 18% of `--text` | derived | derived |
| `--hover` | Hover wash, 4% (light) or 5% (dark) of `--text` | derived | derived |
| `--field` | Input background | `--card` | `--raised` |
| `--scrim` | Behind dialogs, palette and sheets | navy at 24% | near-black at 55% |

Rules:

- `--accent` is a fill, never text. Use `--accent-text` for words and `--accent-line` for strokes.
- One `btn-primary` per screen. Everything else is secondary, ghost or danger.
- Semantic colors carry meaning only (status, errors, diffs). A status is never shown by color alone; it also has a line shape (taut, slack, snapped, dashed) or a word.

### Haze

| Variable | Use | Haze | Haze night |
| --- | --- | --- | --- |
| `--haze` | The active strand of the request line, the logo bloom, the intro scene | `#8DB4EC` at 32% | `#7FA8E6` at 24% |
| `--haze-faint` | Mist outside focus rings and focused inputs (`--haze` ÷ 2.5) | 12.8% | 9.6% |
| `--haze-canvas` | The 360px wash at the top of the canvas and the onboarding backdrop | 16% | 10% |

Haze is decoration around something live, never a carrier of information, and is limited to the places listed in DESIGN.md. Classic themes set `canvas` to 0; Signal sets every haze value to 0. Do not add new haze surfaces without adding them to that list.

### Contrast

Measured with `node scripts/contrast.mjs` (WCAG 2.x relative luminance). Lowest value for each pairing across `--bg`, `--card`, `--raised` and `--bg-deep`:

| Pairing | Required | Haze | Haze night |
| --- | --- | --- | --- |
| `--text` on any surface | 4.5 | > 14 | > 13 |
| `--text-2` | 4.5 | 6.91 | 7.24 |
| `--text-3` | 4.5 | 4.92 | 5.00 |
| `--accent-text` | 4.5 | 5.73 | 9.06 |
| `--pos` | 4.5 | 4.61 | 7.59 |
| `--warn` | 4.5 | 4.64 | 8.03 |
| `--neg` | 4.5 | 4.85 | 5.76 |
| `--accent-ink` on `--accent` | 4.5 | 9.69 | 9.95 |
| `--accent-line` on `--bg` / `--card` (non-text) | 3.0 | 3.17 / 3.35 | 8.66 / 8.16 |

Text on `--raised` is at its tightest in Haze; keep body copy on `--card` or `--bg` and use `--raised` for short labels and hover states. The classic themes keep the ratios documented when they were introduced; Signal exceeds 7:1 for all text roles.

## Type

| Token | Value |
| --- | --- |
| `--font-ui` | Instrument Sans Variable (width axis) |
| `--font-mono` | Geist Mono Variable |
| Body | 14/20, weight 400, width 100% |
| Titles | weight 500, width 80–88%, letter-spacing −0.005em |
| Mono | 13px; figures use `.num` (tabular numerals, 0.93em) |
| Small | 13px for meta, 11–12px only for token types and keycaps |

Two weights (400, 500). Sentence case everywhere. No tracked uppercase.

## Space and size

| Token | Regular | Compact |
| --- | --- | --- |
| `--row` | 36px | 32px |
| `--row-lg` | 48px | 40px |
| `--pad` (page padding) | 32px | 24px |
| `--gap` (between modules) | 40px | 32px |

Everything else is on a 4px grid. Controls are 36px (`.btn`) or 28px (`.btn-sm`, `.icon-btn`). The page is capped at 1320px.

## Shape and elevation

| Token | Haze themes | Classic | Signal |
| --- | --- | --- | --- |
| `--r-xs` / `--r-sm` / `--r-md` / `--r-lg` / `--r-xl` | 6 / 8 / 10 / 14 / 20 | 4 / 6 / 8 / 12 / 16 (Deep water 6–18) | 0 / 2 / 2 / 4 / 4 |
| `--stroke` (line and charts) | 1.75px | 1.5px | 2px |

- Nested radii subtract their padding: an 8px-padded child of an `--r-lg` card uses `--r-sm` or less.
- Content surfaces (`.cat`, `.module-body`, `.keys`, `.sessions`, `.figures-row`, `.settings-card`) are `--card` with `inset 0 0 0 1px var(--line)` and `--shadow-small`. Rail and dock stay on the canvas without a card.
- `--shadow-small` is a 1–2px neutral navy shadow on light themes and `none` on dark ones, where depth comes from surface steps.
- `--shadow-float` is for menus, the palette, dialogs and sheets only.
- No colored shadows. The only blurred color in the product is haze.

## Icons

lucide-react at 16px, stroke 1.5 (`ICON` in `ui/primitives.tsx`), colored by the surrounding text role. Icon-only buttons use `IconButton`, which requires a `label` for the accessible name and tooltip.

## Components

Primitives live in `ui/primitives.tsx`; shell pieces in `shell/`.

### Buttons

| Variant | Rest | Hover | Active | Disabled | Busy |
| --- | --- | --- | --- | --- | --- |
| `primary` | `--accent` fill, `--accent-ink` text | fill mixed 14% toward `--accent-line` | scale 0.98 | 45% opacity, default cursor | `data-busy`, label rolls to the progressive form ("Sending", "Creating") |
| `secondary` | `--card`, `--line-strong` inset, small shadow | `--raised` | scale 0.98 | 45% opacity | — |
| `ghost` | transparent, `--text-2` | `--hover` wash, `--text` | scale 0.98 | 45% opacity | — |
| `danger` | `--neg-soft`, `--neg` text | `--neg` mixed at 20% | scale 0.98 | 45% opacity | — |
| `IconButton` | `--text-3` | `--hover`, `--text` | — | 45% opacity | — |

`CopyButton` swaps its icon to a check and its label to "Copied" in place for 1.4 s.

### Inputs

`.input` / `.textarea`: `--field` background, `--line-strong` inset at rest, `--text-3` inset on hover, `--accent-line` inset plus a 4px `--haze-faint` ring on focus, `--neg` inset when `aria-invalid="true"`. Error text sits under the field, is linked with `aria-describedby` and announced with `aria-live="polite"`. `Field` pairs a label, the control and an optional hint.

### Choice controls

- `Switch`: `role="switch"` with `aria-checked`; off, a `--track` track with a `--text-3` thumb; on, an `--accent-line` track with a `--card` thumb.
- `Segmented`: `role="radiogroup"` of `role="radio"` buttons over a `--track` well, with one `--thumb` that slides to the selection; selected and hovered items are `--text`, others `--text-3`.
- `Select`: a button (`aria-haspopup="listbox"`, `aria-expanded`) that opens a `role="listbox"` menu.

### Menus and dialogs

- Account menu (`shell/Account.tsx`): `role="menu"` opening upward from the rail foot. Focus moves to the first item on open; ↑/↓ wrap, Home/End jump, Esc closes and returns focus to the trigger, an outside click closes. Destructive items use `data-tone="danger"`.
- Palette and shortcuts dialog: `role="dialog"` with `aria-modal`, `--scrim` behind, `--shadow-float`, closed by Esc or a click on the scrim.
- Sheets slide in from the right edge over `--scrim`.

### Status

- `TensionGlyph` and the logo show taut, slack or snapped; see the signature table in DESIGN.md.
- The offline banner (`role="status"`) sits at the top of the page while the event stream is reconnecting or lost.
- Empty states (`Empty`) give a title, one sentence and at most one action.

## Layout and responsiveness

The shell is a CSS grid of rail, page and dock whose arrangement comes from the saved layout (`prefs.layout`). Breakpoints:

| Where | Query | Change |
| --- | --- | --- |
| Shell | viewport ≤ 900px | Rail shown icons-only and the dock hidden, without overwriting the saved layout |
| Usage page | page container ≤ 1040px | Modules stack in one column |
| Keys list | page container ≤ 1000px | The APIs column is dropped |
| API page, usage figures | page container ≤ 860px | Health and auth grids stack; figures wrap two per row |
| Catalog | page container ≤ 560px | Rows keep the name and status line; search and sort take full width |
| Playground | page container ≤ 600px | Send gets its own row; request and response stack whatever the saved split; the line names only its end posts and drops readout timings (the response pane keeps them) |
| Response header | response pane ≤ 540px | Status text is dropped, the code remains |
| Registration | viewport ≤ 520px | Tighter padding; actions stack full width with the primary on top |

Page-level rules use container queries on `main` rather than viewport queries, because the rail and dock decide how wide the page is.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Every transition and animation |
| `--t-fast` | 140ms | Hover, press, color |
| `--t-mid` | 200ms | Opacity, small reveals, view-transition cross-fades |
| `--t-slow` | 380ms | Moves, line tension, view-transition groups |
| `--t-scene` | 640ms | Onboarding stage changes only |

- Animate `transform`, `opacity`, `clip-path`, SVG `d` and stroke. Never width, height, top or left.
- Nothing loops. The intro's 1.1 s build and the logo's 1.1 s haze bloom play once.
- Structural changes go through `transition(kind, update)` in `state/motion.ts` (`route`, `flip`, `shell`, `theme`, `stage`).
- The motion preference is `system`, `full` or `reduced`, stored on the server. `reduced` (or `system` with the OS asking for less) skips view transitions, shortens the intro hand-over to 120 ms and collapses CSS durations to 1 ms.

## Keyboard

| Keys | Action |
| --- | --- |
| `⌘/Ctrl K`, `/` | Search pages, APIs, endpoints and actions (`/` filters the catalog when it is open) |
| `⌘/Ctrl ,` | Settings |
| `⌘/Ctrl .` | Rig layout |
| `?` | Shortcut list |
| `Esc` | Close what is open |
| `G` then `C` / `P` / `K` / `U` / `S` | Catalog, Playground, Keys, Usage, Sessions |
| `⌘/Ctrl ↵` | Send the request |
| `↑` `↓` | Move through catalog rows and menus |

Single-key shortcuts are ignored while typing in a field and while the palette or a sheet is open. The table is defined once in `shell/Shortcuts.tsx` and rendered both in the `?` dialog and in Settings.

## Focus

Every interactive element shows `outline: 2px solid var(--accent-line)` with a 2px offset on `:focus-visible`, plus a 6px `--haze-faint` ring on buttons and links. Never remove the outline without replacing it.
