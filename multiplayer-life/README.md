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

For a quick local demo with a fast pace:

```
TICK_MS=10000 COOLDOWN_MS=5000 npm start
```

## How it works

- `lib/board.js` — pure Game of Life logic (toggle a cell, step a
  generation). No I/O, easy to unit test.
- `lib/cooldown.js` — a small per-key rate limiter used to enforce the
  1-minute placement cooldown.
- `server.js` — Express serves the static client; a `ws` WebSocket server
  broadcasts board state, applies placements (after checking the cooldown
  tracker), and runs the 5-minute tick loop with `setInterval`.
- `public/` — a canvas-based client. It renders the board, shows a
  countdown to the next tick and to the viewer's own cooldown, and sends
  `toggle` messages over the WebSocket on click.

Cooldowns are currently keyed by socket IP address, which is enough to
stop casual abuse on a single-host demo but is not a substitute for real
auth/rate-limiting in a public deployment (a proxy would need to forward
the real client IP via `X-Forwarded-For`, and a determined user could
still spoof it). Board state is in-memory only and resets on restart.

## Test

```
npm test
```

Runs the unit tests for the board and cooldown logic with Node's built-in
test runner (`node --test`).
