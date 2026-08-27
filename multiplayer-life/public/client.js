"use strict";

const CELL_SIZE = 12;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const tickCountdownEl = document.getElementById("tick-countdown");
const cooldownCountdownEl = document.getElementById("cooldown-countdown");
const generationEl = document.getElementById("generation");
const connectionEl = document.getElementById("connection");

let width = 0;
let height = 0;
let live = new Set();
let nextTickAt = 0;
let cooldownUntil = 0;
let cooldownMs = 60_000;

function cellKey(x, y) {
  return `${x},${y}`;
}

function draw() {
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--grid");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--cell");
  for (const key of live) {
    const [x, y] = key.split(",").map(Number);
    ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 1, CELL_SIZE - 1);
  }
}

function setLiveFromArray(cells) {
  live = new Set(cells.map(([x, y]) => cellKey(x, y)));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function updateCountdowns() {
  const now = Date.now();
  tickCountdownEl.textContent = formatDuration(nextTickAt - now);

  const remaining = cooldownUntil - now;
  if (remaining <= 0) {
    cooldownCountdownEl.textContent = "ready";
    cooldownCountdownEl.classList.add("ready");
    canvas.classList.remove("locked");
  } else {
    cooldownCountdownEl.textContent = formatDuration(remaining);
    cooldownCountdownEl.classList.remove("ready");
    canvas.classList.add("locked");
  }
}
setInterval(updateCountdowns, 250);

let ws = null;

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener("open", () => {
    connectionEl.textContent = "live";
  });

  ws.addEventListener("close", () => {
    connectionEl.textContent = "disconnected — retrying…";
    setTimeout(connect, 2000);
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case "init": {
        width = msg.width;
        height = msg.height;
        canvas.width = width * CELL_SIZE;
        canvas.height = height * CELL_SIZE;
        setLiveFromArray(msg.cells);
        nextTickAt = msg.nextTickAt;
        cooldownMs = msg.cooldownMs;
        generationEl.textContent = msg.tickNumber;
        draw();
        break;
      }
      case "update": {
        const key = cellKey(msg.x, msg.y);
        if (msg.alive) live.add(key);
        else live.delete(key);
        draw();
        break;
      }
      case "tick": {
        setLiveFromArray(msg.cells);
        nextTickAt = msg.nextTickAt;
        generationEl.textContent = msg.tickNumber;
        draw();
        break;
      }
      case "cooldown": {
        cooldownUntil = Date.now() + msg.retryAfterMs;
        break;
      }
      case "denied": {
        cooldownUntil = Date.now() + msg.retryAfterMs;
        break;
      }
    }
  });
}

canvas.addEventListener("click", (event) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return; // no live connection to send the click on
  if (Date.now() < cooldownUntil) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((event.clientX - rect.left) * scaleX) / CELL_SIZE);
  const y = Math.floor(((event.clientY - rect.top) * scaleY) / CELL_SIZE);
  if (x < 0 || x >= width || y < 0 || y >= height) return;

  ws.send(JSON.stringify({ type: "toggle", x, y }));
  // Optimistic lock; the server's "cooldown" or "denied" reply corrects this if needed.
  cooldownUntil = Date.now() + cooldownMs;
});

connect();
