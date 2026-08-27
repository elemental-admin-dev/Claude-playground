"use strict";

const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { WebSocketServer } = require("ws");
const { createBoard, toggleCell, step, toArray } = require("./lib/board");
const { CooldownTracker } = require("./lib/cooldown");

const WIDTH = Number(process.env.BOARD_WIDTH) || 60;
const HEIGHT = Number(process.env.BOARD_HEIGHT) || 40;
const TICK_MS = Number(process.env.TICK_MS) || 5 * 60 * 1000;
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS) || 60 * 1000;
const PORT = Number(process.env.PORT) || 3000;
const SEED_DENSITY = 0.12;

function randomSeed(width, height, density) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < density) cells.push([x, y]);
    }
  }
  return cells;
}

let board = createBoard(WIDTH, HEIGHT, randomSeed(WIDTH, HEIGHT, SEED_DENSITY));
let tickNumber = 0;
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
}, TICK_MS);

// Bounds memory on a long-running server: drops cooldown entries for ids
// that haven't acted recently, which behave identically to an id that was
// never seen.
setInterval(() => cooldown.sweep(), COOLDOWN_MS);

server.listen(PORT, () => {
  console.log(`multiplayer-life listening on http://localhost:${PORT}`);
  console.log(`board ${WIDTH}x${HEIGHT}, tick every ${TICK_MS / 1000}s, cooldown ${COOLDOWN_MS / 1000}s`);
});
