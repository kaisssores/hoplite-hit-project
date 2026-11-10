# Architecture

Tether borrows its architecture from [opencode](https://github.com/anomalyco/opencode), not its look. opencode is a coding agent; what transfers is how it is put together: a background server that owns state, clients that connect to it, a provider layer that hides how a backend is reached, sessions that persist locally, and an API contract that is published and wrapped in an SDK.

```
 browser tab ─┐                            ┌─ rest      simulated REST upstream
 browser tab ─┼─ @tether/sdk ── HTTP ──► @tether/server ─ adapters ─┼─ graphql   simulated GraphQL upstream
 script, CLI ─┘        ▲         /v1          │                     ├─ loopback  this server's own routes
                       │                      │                     └─ http      real upstream over the network
                       └── SSE /v1/event ─────┤
                                              └─ .tether/state.json
              @tether/contract: types, events and route table shared by all three
```

## How each idea maps

| opencode | Tether | Where |
| --- | --- | --- |
| A headless server owns sessions and state; the terminal UI and the other front ends are clients of it | `@tether/server` owns the catalog, keys, sessions, exchanges, activity, health and preferences. The web client holds none of it | `packages/server/src/store.ts`, `runtime.ts` |
| Clients learn about changes from a server-sent event stream fed by an internal bus | Every state change is published on a bus and pushed over `GET /v1/event`. The client folds events into a local mirror | `server/src/bus.ts`, `routes/event.ts`, `app/src/state/sync.ts` |
| Work is asynchronous: a prompt is accepted, then progress streams back | `POST /v1/session/{id}/exchange` answers `202` at once. The request then travels four hops (queue, sign, upstream, return) and each one arrives as an `exchange.updated` event | `server/src/exchange.ts` |
| Model providers sit behind one interface, so the rest of the system does not care which is in use | APIs are reached through adapters behind one `Adapter` interface. Which adapter an API uses is data on the API. Routes and the exchange runner never branch on it | `server/src/adapters/*` |
| Sessions are stored locally and can be resumed | Sessions, their exchanges and their activity are written to `.tether/state.json`. A client remembers only the id of the session it has open | `server/src/store.ts`, `app/src/state/sync.ts` |
| The server publishes its API and the SDK is built on that contract | `@tether/contract` holds every wire type, the event union and the route table. The server serves the table at `GET /v1/doc`, `@tether/sdk` wraps it, and the catalog lists it as the Tether Hub API, callable from the playground | `packages/contract`, `packages/sdk`, `server/src/seed/hub.ts` |
| A sync layer in the client mirrors server state for rendering | `sync.ts` is the only module that calls the SDK. Views read the store and call actions; they never fetch | `app/src/state/` |

## The pieces

**Contract** (`packages/contract`). One file, no runtime dependencies. Catalog, health, keys, sessions, exchanges, usage, preferences (theme and layout), the `ServerEvent` union and `ROUTES`. Default and preset layouts live here too, so the server can validate and seed what the client renders.

**Server** (`packages/server`). Hono on Node. `createApp(runtime)` returns the app without opening a socket, which is how the tests and the loopback adapter call it. The store keeps state in memory and writes it atomically, debounced. Secrets are hashed; a key's secret is returned once, on create and on rotate. A health simulation produces a day of history per API and ticks live samples onto the stream.

**Adapters.** `send(ctx)` receives the API, the matched endpoint, the request, the key and the API's current health, and returns a response or a failure.

- `rest` answers from the endpoint's documented example and applies the rules a gateway would: maintenance and outage, unknown route, missing credentials, key not enabled, missing scope, required parameters, invalid JSON, rate limits. Latency follows the API's health.
- `graphql` does the same with GraphQL's conventions: authentication problems come back as `200` with an `errors` array.
- `loopback` executes against this server in process. It is how the Hub API is real.
- `http` forwards to the API's base URL with a timeout, and refuses loopback and private hosts.

Replacing the simulation with real upstreams means writing adapters. Nothing above them changes.

**SDK** (`packages/sdk`). `createTether({ baseUrl, fetch, session })` returns namespaced calls (`api`, `key`, `session`, `usage`, `preferences`, `health`, `server`) and `event.subscribe`, which reconnects when the stream drops. It sends the open session's id with each call so the server can file what happened under it.

**Client** (`packages/app`).

- `state/store.ts` is the mirror of server state plus what belongs to one window: route, open sheet, the request draft.
- `state/sync.ts` loads on first contact and after every reconnect, applies events, and exposes actions. Layout and theme changes show at once and are written to the server, which tells every other client.
- `state/motion.ts` runs every structural change as a named transition.
- `shell/` is the rail, the dock, the palette and the rigging layer. `views/` are the screens. `theme/themes.ts` is the token source.

## Life of a request

1. The playground builds an `ExchangeRequest` from the draft and calls `session.send`.
2. The server stores the exchange as `running` with the `queue` hop open, publishes it, records an activity row, and answers `202`.
3. It checks the key itself at the `auth` hop. A revoked or unknown key ends the exchange there as `failed`, with no response.
4. At `upstream` it resolves the API's adapter and calls `send`.
5. At `transfer` it closes the exchange as `done` with the response, updates the key's usage, the API's health and the usage counters, and publishes each.
6. Each step reaches every client as an event. The playground draws it on the line; the dock, the keys page and the usage page update from the same events.

`done` means a response came back, whatever its status. `failed` means none did. The interface keeps that distinction visible: a `403` is an intact line with a warning status, a timeout is a snapped line.

## Known limits of the prototype

- Upstreams for the official APIs are simulated, as described above.
- There is one user and no login. The server trusts whoever can reach it and binds to `127.0.0.1` by default.
- The store is a JSON file. The `Store` class is the seam for a database.
- The `http` adapter cannot sign with a key's secret, because the server keeps only its hash. It sends the key id instead.
