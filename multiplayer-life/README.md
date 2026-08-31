# Multiplayer Game of Life

A shared Conway's Game of Life board, r/place-style:

- The board **advances on its own** every 5 minutes (configurable).
- Anyone connected can **place or remove a single cell** at any time, but
  each visitor is limited to **one placement per minute** (configurable),
  enforced by the server.
- Everyone sees the same board update live over WebSockets.

## Run

```
npm install
npm start
```

Then open http://localhost:3000 — open it in a couple of browser tabs (or
have someone else on your network hit your IP) to see updates sync live.

### Configuration

Environment variables, all optional:

| Variable       | Default | Meaning                              |
| -------------- | ------- | ------------------------------------- |
| `PORT`         | `3000`  | HTTP/WebSocket port                   |
| `BOARD_WIDTH`  | `60`    | Board width in cells                  |
| `BOARD_HEIGHT` | `40`    | Board height in cells                 |
| `TICK_MS`      | `300000`| Milliseconds between simulation ticks |
| `COOLDOWN_MS`  | `60000` | Milliseconds a client must wait between placements |
| `SAVE_FILE`    | `./board-save.json` | Path the board autosaves to and resumes from |
| `SAVE_INTERVAL_MS` | `30000` | Milliseconds between autosaves |

For a quick local demo with a fast pace:

```
TICK_MS=10000 COOLDOWN_MS=5000 npm start
```

## How it works

- `lib/board.js` — pure Game of Life logic (toggle a cell, step a
  generation). No I/O, easy to unit test.
- `lib/cooldown.js` — a small per-key rate limiter used to enforce the
  1-minute placement cooldown.
- `lib/persistence.js` — pure (no `fs`) serialize/deserialize of the board's
  save format (cells, tick number, next-tick time), so it's unit-testable
  without touching disk; validates and drops any malformed or
  out-of-bounds cell entries instead of trusting the file blindly, and
  rejects a negative `tickNumber`/`nextTickAt` outright rather than
  accepting an impossible value.
- `lib/statefile.js` — the `fs`-touching half of persistence: `loadState`
  reads and validates a save file (returning `{ state, error,
  sizeMismatch }` so the caller decides how to log each case), and
  `saveState` writes one via write-to-temp-then-rename, so a save
  interrupted mid-write leaves the previous file intact instead of a
  truncated one. `loadState`'s returned state deliberately omits
  `nextTickAt` - the tick schedule is always recomputed fresh at startup
  (see below), so returning a stale value here would just invite a future
  edit to read it again and reintroduce that bug. Tested against a real
  temp directory, not mocked.
- `lib/env.js` — `positiveNumberFromEnv(name, default)` parses a numeric
  env var, falling back to the default for anything that isn't a real
  positive number (missing, `"0"`, negative, non-numeric) instead of the
  `Number(x) || default` idiom's bug: that idiom treats an explicit `"0"`
  as unset *and* lets a negative value through untouched (still truthy).
  A negative `SAVE_INTERVAL_MS` or `TICK_MS` reaching `setInterval`
  directly would be a real problem - Node clamps any delay under 1ms to
  ~1ms, turning a bad env var into a same-callback-hundreds-of-times-
  per-second storm that starves the event loop.
- `server.js` — Express serves the static client; a `ws` WebSocket server
  broadcasts board state, applies placements (after checking the cooldown
  tracker), and runs the 5-minute tick loop with `setInterval`. Also loads
  `lib/statefile.js`'s save file on startup (if its dimensions match the
  configured board size) and autosaves periodically, after every tick, and
  on `SIGINT`/`SIGTERM`, so a restart resumes the shared board instead of
  reseeding it randomly. `nextTickAt` is always computed fresh relative to
  this startup, never resumed from the save file.
- `public/` — a canvas-based client. It renders the board, shows a
  countdown to the next tick and to the viewer's own cooldown, and sends
  `toggle` messages over the WebSocket on click.

Cooldowns are currently keyed by socket IP address, which is enough to
stop casual abuse on a single-host demo but is not a substitute for real
auth/rate-limiting in a public deployment (a proxy would need to forward
the real client IP via `X-Forwarded-For`, and a determined user could
still spoof it). Board state survives a restart via periodic autosave to
`SAVE_FILE` (see Configuration) as long as `BOARD_WIDTH`/`BOARD_HEIGHT`
don't change between runs; if they do, or the save file is missing or
unreadable, the server falls back to a fresh randomly-seeded board.

## Test

```
npm test
```

Runs the unit tests for the board, cooldown, persistence format, env-var
parsing, and the save-file load/save path (against a real temp directory)
with Node's built-in test runner (`node --test`).
