"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { WebSocketServer } = require("ws");
const { createBoard, toggleCell, step, toArray } = require("./lib/board");
const { CooldownTracker } = require("./lib/cooldown");
const { serializeState, deserializeState } = require("./lib/persistence");

const WIDTH = Number(process.env.BOARD_WIDTH) || 60;
const HEIGHT = Number(process.env.BOARD_HEIGHT) || 40;
const TICK_MS = Number(process.env.TICK_MS) || 5 * 60 * 1000;
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS) || 60 * 1000;
const PORT = Number(process.env.PORT) || 3000;
const SEED_DENSITY = 0.12;
const SAVE_FILE = process.env.SAVE_FILE || path.join(__dirname, "board-save.json");
const SAVE_INTERVAL_MS = Number(process.env.SAVE_INTERVAL_MS) || 30 * 1000;

function randomSeed(width, height, density) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < density) cells.push([x, y]);
    }
  }
  return cells;
}

function loadSavedState() {
  try {
    const json = fs.readFileSync(SAVE_FILE, "utf8");
    const restored = deserializeState(json);
    if (restored.board.width !== WIDTH || restored.board.height !== HEIGHT) {
      console.warn("multiplayer-life: saved board size doesn't match configured size, starting fresh");
      return null;
    }
    return restored;
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("multiplayer-life: couldn't load saved state, starting fresh:", err.message);
    return null;
  }
}

function saveState() {
  try {
    // Write-then-rename instead of an in-place write, so a save that's
    // interrupted mid-flush (SIGKILL, OOM) leaves the previous save file
    // intact rather than a truncated, unloadable one.
    const tmpFile = `${SAVE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, serializeState(board, tickNumber, nextTickAt));
    fs.renameSync(tmpFile, SAVE_FILE);
  } catch (err) {
    console.warn("multiplayer-life: couldn't save state:", err.message);
  }
}

const saved = loadSavedState();
let board = saved ? saved.board : createBoard(WIDTH, HEIGHT, randomSeed(WIDTH, HEIGHT, SEED_DENSITY));
let tickNumber = saved ? saved.tickNumber : 0;
// Always scheduled relative to *this* startup, not the saved value: the
// setInterval below always starts a fresh TICK_MS countdown at boot, so a
// restored nextTickAt from before a restart would be stale (already in the
// past, or ahead of when the timer will actually fire) and desync the
// countdown clients display from when the tick server-side actually happens.
let nextTickAt = Date.now() + TICK_MS;
const cooldown = new CooldownTracker(COOLDOWN_MS);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function clientKeyFor(req) {
  // Real deployments behind a proxy should trust X-Forwarded-For instead;
  // this is deliberately simple for a same-host demo.
  return req.socket.remoteAddress;
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

function initMessage() {
  return {
    type: "init",
    width: WIDTH,
    height: HEIGHT,
    cells: toArray(board),
    tickNumber,
    nextTickAt,
    tickMs: TICK_MS,
    cooldownMs: COOLDOWN_MS,
  };
}

wss.on("connection", (ws, req) => {
  ws.clientKey = clientKeyFor(req);
  send(ws, initMessage());

  ws.on("error", (err) => {
    console.warn("multiplayer-life: client socket error", err.message);
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null || msg.type !== "toggle") return;

    const { x, y } = msg;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;

    const now = Date.now();
    if (!cooldown.tryAct(ws.clientKey, now)) {
      send(ws, { type: "denied", retryAfterMs: cooldown.remaining(ws.clientKey, now) });
      return;
    }

    const alive = toggleCell(board, x, y);
    broadcast({ type: "update", x, y, alive });
    send(ws, { type: "cooldown", retryAfterMs: COOLDOWN_MS });
  });
});

setInterval(() => {
  board = step(board);
  tickNumber += 1;
  nextTickAt = Date.now() + TICK_MS;
  broadcast({ type: "tick", cells: toArray(board), tickNumber, nextTickAt });
  saveState();
}, TICK_MS);

// Bounds memory on a long-running server: drops cooldown entries for ids
// that haven't acted recently, which behave identically to an id that was
// never seen.
setInterval(() => cooldown.sweep(), COOLDOWN_MS);

// Autosaves between ticks too, so edits (not just generations) survive a
// restart instead of only the last tick's state.
setInterval(saveState, SAVE_INTERVAL_MS);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    saveState();
    process.exit(0);
  });
}

server.listen(PORT, () => {
  console.log(`multiplayer-life listening on http://localhost:${PORT}`);
  console.log(`board ${WIDTH}x${HEIGHT}, tick every ${TICK_MS / 1000}s, cooldown ${COOLDOWN_MS / 1000}s`);
  console.log(saved ? `resumed saved state (tick ${tickNumber}) from ${SAVE_FILE}` : `no saved state found, seeded a fresh board`);
});
