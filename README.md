# Tether

Tether is a prototype of an official user API hub: one place to browse a company's user-facing APIs, read their documentation, issue and manage keys, send test requests, watch health and usage, and pick up a working session where it was left.

It is built as a starting point for a design and engineering team, not as a mockup. A local server owns all state, a typed SDK is the only way to reach it, and the web client is one connected client among any number.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. The server listens on port 4096 and the client reaches it through `/v1`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (4096) and web client (5173), both with reload |
| `npm run build && npm start` | Builds the client; the server serves it and the API from one port |
| `npm run typecheck` | Type-checks every package |
| `npm test` | Server tests: catalog, keys, exchange lifecycle, adapters, preferences, account |

State is written to `.tether/state.json`. Delete it to start from the seed again.

## A five minute tour

0. **First run.** The mark is drawn while the client reaches the server and pulls taut when it answers. Create a local account (name, email, optional team; no password) or use "Fill in demo details".
1. **Catalog.** Search with `/`, filter by category, sort by latency. Status is drawn as line tension: taut, slack or snapped.
2. **An API.** Open Payments. Its name travels from the row to the page title. Expand an endpoint and press Try it.
3. **Playground.** Press Send (`Ctrl/⌘ + Enter`). The request goes out along the line hop by hop and the response comes back along the bottom strand. Choose the revoked key "Old mobile app" to see the line snap at the signing hop, or call a Messaging endpoint with "Support tooling" to see a 403 with a way out.
4. **Keys.** Create a key, see its secret once, rotate or revoke it. The activity dock records each step.
5. **Rig layout** (`Ctrl/⌘ + .`). Drag the rail or the dock to another edge, reorder or hide page modules, choose catalog columns, save the result as a named rig.
6. **Account and Settings.** Open the account at the foot of the rail for Settings (`Ctrl/⌘ + ,`), shortcuts (`?`), a quick light/dark/system switch and sign out. Settings holds the profile, all six themes, motion, density and layout.
7. **A second window.** Open the app in another tab. Layout, theme, account, keys and activity stay in step, because both are clients of the same server.

`Ctrl/⌘ + K` searches pages, APIs, endpoints and actions from anywhere.

## Layout of the repository

```
packages/contract   Types for everything that crosses the wire, the event union, the route table
packages/server     Hono server: state, persistence, event stream, adapters, simulated upstreams
packages/sdk        createTether(): typed calls and the event subscription
packages/app        React client: sync layer, shell, views, theme tokens, motion
docs/               Architecture note and design rationale
.claude/skills      The unslop skill used to audit and direct the interface
```

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) maps the prototype to the opencode architecture it borrows from.
- [docs/DESIGN.md](docs/DESIGN.md) covers the visual direction, motion, rigging and theming.

## What is simulated

The official APIs in the catalog do not exist. The `rest` and `graphql` adapters answer from recorded examples on the server, with latency, authentication, scopes, rate limits and failures that follow each API's health. The `loopback` adapter is real: the Tether Hub entry in the catalog calls this server's own routes. The `http` adapter is real too and forwards registered APIs marked Live HTTP to their base URL, refusing private addresses.
