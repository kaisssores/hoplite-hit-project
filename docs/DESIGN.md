# Design rationale

The interface was directed and audited with the [unslop](../.claude/skills/unslop/SKILL.md) skill by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0: a direction taken from the product, then spacing, color, icons, copy, type, layout, details, visuals and motion in that order, then a rendered check against its list of signs.

## Direction

- **Product.** Tether is where developers find a company's user-facing APIs, get credentials, send test requests and watch health.
- **Character.** Taut, exact, weatherproof.
- **World.** Rigging and mooring: line under load, posts, tide tables. Surfaces stay neutral graphite, as an app that is looked at for hours should. The world shows in the accent (the orange of a safety line), in the charts and in the signature.
- **Moments.** Two places get the richness. The request line in the playground, and the latency chart on an API page, drawn like a tide table with a hairline grid, mono labels and one line in the accent.
- **Signature.** The tether line. State is tension: taut means connected and carrying load, slack means holding but sagging, snapped means nothing gets through.

The signature is one idea used everywhere it is true and nowhere else:

| Place | Taut | Slack | Snapped |
| --- | --- | --- | --- |
| The logo mark | Event stream open | Connecting | Server unreachable |
| Catalog status | Operational | Degraded | Outage (maintenance is a dashed line) |
| The request line | A hop that carried the request | A hop not yet reached | The hop where the request was lost |
| Activity dock | A request that got an answer | | A request that got none |

There are no spinners and no status dots in the product. The line does that work.

## Anti-slop decisions

- **One accent, kept rare.** It marks what is live: the line in flight, the Send button that pulls it taut, the lead series in a chart, the keyboard focus ring, and the handles in rig mode. Primary buttons elsewhere use the text color as a fill.
- **Neutral chrome.** One ramp per theme, three text roles, hairlines at 8 to 10 percent of the text color. Depth comes from surface steps on dark themes. No gradients, glows, glass or colored shadows.
- **No stat-card dashboard.** The catalog is a typographic index with aligned mono columns. Usage leads with four figures set as numbers on a rule, one main chart, and ranked lists with thin bars beside it. Nothing has a sparkline.
- **Type chosen for the character.** Instrument Sans has a width axis, so titles are set condensed (80 to 88 percent) and read as pulled tight; body text stays at full width. Geist Mono carries paths, tokens and figures, with tabular numerals. Weights are 400 and 500 only. Sentence case throughout, no tracked uppercase labels.
- **Spacing on a 4px grid.** Rows are 36 and 48 (32 and 40 in compact). Nested radii subtract their padding.
- **Copy says what happens.** No greetings, no exclamation marks, no hype. Comparisons name what they compare to. Errors say where the request was lost and offer the next step.
- **JSON stays in the ramp.** Keys recede and values read first, instead of a rainbow highlighter competing with the line.
- **Icons.** lucide at 16px with a 1.5 stroke, in the color of their text role.
- **Plausible data.** Ten official APIs with real-shaped endpoints, scopes and changelogs. Health, usage and playground results agree with each other because they come from the same server state.

## Animation

Motion has one easing curve, `cubic-bezier(0.22, 1, 0.36, 1)`, three durations (140, 200 and 380 ms), and never animates layout properties: it moves transforms, opacity, clip paths and SVG path data. Nothing loops. Each animation is there to explain something.

| Motion | What it explains |
| --- | --- |
| The page slides left going from catalog to API to playground, right coming back, and rises on lateral moves | Where you are in browse, inspect, test |
| An API's name travels from its catalog row to the page title and back | It is the same object |
| Rows and modules glide when a list is filtered, sorted, expanded or reordered | What moved, as opposed to what changed |
| Rail, page and dock morph when the layout changes | The same three regions, rearranged |
| The request line: idle strands sag, the active hop pulls taut in the accent with a knot riding it, finished hops stay taut, the response returns along the bottom strand | The request is asynchronous and happens on the server, hop by hop |
| The line snaps at the failing hop | No response came back, and where it was lost |
| The previous response dims while a new request is in flight, then the new one rises in | The answer on screen is stale, then fresh |
| Copy swaps to a check and "Copied" in place; Send rolls to "Sending" | Feedback where the action was taken |
| A new secret arrives character by character | It is shown once |
| A new theme spreads from the swatch that was clicked | Cause and effect |
| A new activity row rises in at the top of the dock | It just arrived over the stream |

The hop events can arrive within a few milliseconds of each other. The line plays them back one stretch at a time, never faster than 160 ms each, so a fast request is still seen travelling. The timings shown are always the server's.

Structural changes run as view transitions through one helper, `transition(kind, update)`. It tags the document with the kind (`route`, `flip`, `shell` or `theme`) and CSS decides which elements keep their identity. Browsers without view transitions get the same state change without the travel. The motion preference (system, full, reduced) is a saved setting; reduced skips transitions and collapses durations.

## Customization: rigging

The product's own structure is editable from inside it. Rig mode (`Ctrl/⌘ + .`) shows the frame of every region and module:

- **Regions.** Drag the rail to the left, top or right edge and the dock to the right or bottom, or turn the dock off. The rail collapses to icons. Splitters resize the rail, the dock and the playground split at any time.
- **Modules.** API pages and the usage page are made of modules. Drag them to reorder, or hide them. Hidden modules stay visible in rig mode so they can be brought back.
- **Catalog.** Choose columns and group by category.
- **Density and playground split.** Regular or compact; request and response side by side or stacked.
- **Rigs.** Three built in (Browse, Bench, Watch). Any arrangement can be saved under a name and applied later.

A layout is one object in the contract, stored in the server's preferences. Applying a rig is a single write, and every connected window follows it with the same morph.

## Theming

A theme is a complete token set, not a recolor. `theme/themes.ts` defines each one, and `themeVariables` turns it into the CSS variables that every component reads: four surfaces, three text roles, hairlines, the accent with its ink and text variants, three semantic colors, a five-step corner scale, the stroke weight of the line and charts, and the floating shadow.

| Theme | Mode | What moves besides color |
| --- | --- | --- |
| Night watch | Dark | The default: graphite, safety-line orange |
| Chart room | Light | Paper surfaces, a darker accent that holds 4.5:1 as text and as a fill, soft shadows instead of surface steps |
| Deep water | Dark | Ink ramp, beacon green accent, softer corners |
| Signal | Dark | High contrast, hairlines three times stronger, square corners, a 2px line |

"Follow the system" pairs Night watch and Chart room with the OS setting. The Workbench shows every token of the current theme with its live value, drawn using the token itself.
