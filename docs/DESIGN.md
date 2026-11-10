# Design rationale

The interface was directed and audited with the [unslop](../.claude/skills/unslop/SKILL.md) skill by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0: a direction taken from the product, then spacing, color, icons, copy, type, layout, details, visuals and motion in that order, then a rendered check against its list of signs.

Tokens, component states, breakpoints and contrast figures are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). This document explains why they are what they are.

## Direction

- **Product.** Tether is where developers find a company's user-facing APIs, get credentials, send test requests and watch health.
- **Character.** Taut, exact, calm. The first version was weatherproof and dark; this one is the same harbor on a bright morning.
- **World.** Rigging and mooring, seen through morning haze over water: line under load, posts, tide tables, and the milky blue of sky meeting sea before the fog lifts. Surfaces are near-white with a cool tint, text is a deep harbor navy rather than black, and the accent is a soft sky blue.
- **Moments.** Three places get the richness. The first-run intro, where the mark is built and pulls taut when the server answers; the request line in the playground; and the latency chart on an API page, drawn like a tide table.
- **Signature.** The tether line. State is tension: taut means connected and carrying load, slack means holding but sagging, snapped means nothing gets through. Haze is the signature's light: it appears around a line only while it is carrying something.

The signature is one idea used everywhere it is true and nowhere else:

| Place | Taut | Slack | Snapped |
| --- | --- | --- | --- |
| The logo mark | Event stream open (haze blooms once) | Connecting | Server unreachable |
| The intro | Server answered, hand over to the app | Reaching the server | No answer, with the command that starts it |
| Catalog status | Operational | Degraded | Outage (maintenance is a dashed line) |
| The request line | A hop that carried the request | A hop not yet reached | The hop where the request was lost |
| Activity dock | A request that got an answer | | A request that got none |

There are no spinners and no status dots in the product. The line does that work.

## Why soft blue, and how the haze is kept restrained

A milky blue accent is pleasant to look at for hours, but pale blue is a weak text color and a weak status line. The palette therefore splits the accent into four roles instead of reusing one hex everywhere:

- **Fill** (`#B7D1F3`): the primary button and selection. Dark navy ink sits on it at 9.7:1, so the button is soft without being washed out.
- **Text** (`#285CA6`): links and accented labels, 6.6:1 on cards.
- **Line** (`#5A8ED6`): the line in flight, focus rings, chart leads. Holds 3:1 against cards, the non-text minimum.
- **Haze** (`#8DB4EC` at 32 percent): mist, never information.

Haze is allowed in exactly four places, each tied to something live:

1. Around the active stretch of the request line, and only that stretch.
2. Behind the logo mark, as a single bloom when the event stream connects.
3. Around keyboard focus, as a faint ring outside the solid outline.
4. On the onboarding scene and as a 360px wash at the top of the canvas, the only places it covers an area.

It is never on text, cards, buttons at rest, charts or hover states. Signal, the high-contrast theme, sets it to zero.

## Anti-slop decisions

- **One accent, kept rare.** It marks what is live or primary: the line in flight, the Send button, the lead series in a chart, focus and rig handles.
- **Quiet chrome.** One cool ramp per theme, three text roles, hairlines at 9 percent of the text color. On Haze, content sits on white cards with a hairline and a 1px shadow over the tinted canvas; chrome (rail, dock) stays on the canvas. No gradient text, glass, colored shadows or glowing borders.
- **No stat-card dashboard.** The catalog is a typographic index with aligned mono columns. Usage leads with four figures on a rule, one main chart and ranked lists.
- **Type chosen for the character.** Instrument Sans with titles set condensed (80 to 88 percent width) so they read pulled tight; Geist Mono for paths, tokens and figures with tabular numerals. Weights 400 and 500 only. Sentence case, no tracked uppercase labels.
- **Spacing on a 4px grid.** Rows are 36 and 48 (32 and 40 in compact). Nested radii subtract their padding. Haze themes use slightly rounder corners (10 to 20) than the classic set.
- **Copy says what happens.** No greetings, exclamation marks or hype. Errors say where the request was lost and what to try. Registration says where the data lives.
- **Icons.** lucide at 16px, 1.5 stroke, in the color of their text role.

## First run

1. **Intro.** The T-shaped mark draws in over 1.1 s while the client reaches the server. The line pulls taut only when the event stream is actually open, holds for half a second, then hands over. If the server is down, the line stays fallen and the page says how to start it, then continues on its own once it can connect.
2. **Registration.** Name, email and an optional team, plus a light, dark or system appearance choice that is applied live. Fields validate on blur and on submit with inline messages tied to the field. "Fill in demo details" exists for walkthroughs. The account is local to the prototype server: there is no password and no identity provider.
3. **Into the app.** The registration card recedes, the mark travels to its place at the top of the rail, and the shell rises in reading order. Returning users skip registration.

## Account and settings

The account lives at the bottom of the rail: avatar initials, name and team, collapsing to the avatar when the rail is icons-only. It opens a menu with Settings, Keyboard shortcuts, Layout (rig mode), a three-way theme switch and Sign out. The menu is fully keyboard navigable (arrows, Home, End, Esc) and returns focus to its trigger.

Settings replaces the old Workbench page (`/workbench` still routes there). Sections: Profile, Appearance (theme gallery grouped Haze and Classic, follow-system switch, motion, density), Layout (rail and dock position, icons-only rail, playground split, saved rigs), Shortcuts, and Server (adapters and the token reference). Every setting is a server-side preference, so it survives reloads and every connected window follows it.

## Animation

Motion has one easing curve, `cubic-bezier(0.22, 1, 0.36, 1)`, three durations (140, 200 and 380 ms) plus a 640 ms scene duration used only by onboarding, and never animates layout properties.

| Motion | What it explains |
| --- | --- |
| The mark draws, then pulls taut with one haze bloom | The client reached the server |
| Registration recedes, the mark travels to the rail and the shell rises in | You are in, and it is the same line |
| The page slides left going from catalog to API to playground, right coming back | Where you are in browse, inspect, test |
| An API's name travels from its catalog row to the page title | It is the same object |
| Rows and modules glide when filtered, sorted or reordered | What moved, as opposed to what changed |
| Rail, page and dock morph when the layout changes | The same three regions, rearranged |
| The request line: the active hop pulls taut with haze around it, finished hops stay taut, the response returns along the bottom strand | The request happens on the server, hop by hop |
| The line snaps at the failing hop | Where the request was lost |
| A new theme spreads from the swatch that was clicked | Cause and effect |
| A new activity row rises at the top of the dock | It just arrived over the stream |

Hop events can arrive milliseconds apart; the line plays them back no faster than 160 ms per stretch, but the timings shown are always the server's. Structural changes run through one helper, `transition(kind, update)`, with kinds `route`, `flip`, `shell`, `theme` and `stage`. The motion preference (system, full, reduced) is saved; reduced skips view transitions, shortens the intro and collapses durations.

## Connection loss

The event stream sends a heartbeat. If none arrives for a while, the SDK closes and reopens the stream rather than trusting an `EventSource` that a proxy is holding open. The logo goes slack while reconnecting and snaps if the server stays unreachable; an inline banner at the top of the page says the line is lost and that it will reconnect on its own.

## Customization: rigging

Rig mode (`Ctrl/⌘ + .`, or Layout in the account menu) shows the frame of every region and module:

- **Regions.** Drag the rail to the left, top or right edge and the dock to the right or bottom, or turn the dock off. Splitters resize the rail, dock and playground split.
- **Modules.** API and usage pages are made of modules that can be reordered or hidden.
- **Catalog.** Choose columns and group by category.
- **Rigs.** Three built in (Browse, Bench, Watch); any arrangement can be saved under a name.

A layout is one object in the contract, stored in the server's preferences.

## Theming

A theme is a complete token set, not a recolor: surfaces, text roles, the four accent roles, semantics, haze, corner scale, line weight and elevation move together.

| Theme | Family | Mode | Character |
| --- | --- | --- | --- |
| Haze | Haze | Light | The default. Milky blue on cool white, navy text, haze on |
| Haze night | Haze | Dark | Harbor lights in fog: deep blue-navy, the same sky blue as fill and text |
| Night watch | Classic | Dark | The original graphite and safety-line orange |
| Chart room | Classic | Light | Chart paper, burnt-orange ink |
| Deep water | Classic | Dark | Ink blue-black, beacon green |
| Signal | Classic | Dark | High contrast, square corners, a 2px line, no haze |

"Follow the system" pairs Haze and Haze night with the OS setting.
