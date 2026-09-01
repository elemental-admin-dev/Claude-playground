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
let hoverCell = null; // { x, y } | null - the cell under the mouse, or none
let connected = false;

// Cached instead of calling canvas.getBoundingClientRect() on every
// mousemove (a forced-layout call, and mousemove can fire dozens of times
// a second) - refreshed only when the layout might actually have changed.
let canvasRect = canvas.getBoundingClientRect();
function refreshCanvasRect() {
  canvasRect = canvas.getBoundingClientRect();
}
window.addEventListener("resize", refreshCanvasRect);
window.addEventListener("scroll", refreshCanvasRect, { passive: true });

// True exactly when a click on hoverCell would actually register: a click
// with no live connection or during a cooldown both silently no-op (see
// the click handler below), so the hover color needs to agree with both,
// not just the cooldown.
function hoverIsClickable() {
  return connected && Date.now() >= cooldownUntil;
}
let lastHoverClickable = null; // tracks what draw() last painted, to skip redundant redraws

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

  if (hoverCell) {
    // Green while a click would register, red otherwise (on cooldown, or
    // no live connection) - so the outline itself tells you whether
    // hovering is actionable right now, not just which cell it is.
    const clickable = hoverIsClickable();
    lastHoverClickable = clickable;
    ctx.strokeStyle = clickable ? "#5ee6a8" : "#e65e5e";
    ctx.lineWidth = 2;
    ctx.strokeRect(hoverCell.x * CELL_SIZE + 1, hoverCell.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  } else {
    lastHoverClickable = null;
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

  // Keeps the hover highlight's red/green color in sync with the cooldown
  // even if the mouse hasn't moved since it expired - otherwise it can sit
  // stuck red for a moment after a click actually becomes clickable again.
  // Only actually redraws (the whole grid, not just the outline) when the
  // clickable state has flipped since the last paint - this runs 4x/sec
  // for as long as the mouse doesn't move, and a full redraw is wasted
  // work the other ~3.99 times/sec when nothing visibly changed.
  if (hoverCell && hoverIsClickable() !== lastHoverClickable) draw();
}
setInterval(updateCountdowns, 250);

let ws = null;

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener("open", () => {
    connectionEl.textContent = "live";
    connected = true;
    if (hoverCell) draw(); // the hover outline may have been showing red for "no connection"
  });

  ws.addEventListener("close", () => {
    connectionEl.textContent = "disconnected — retrying…";
    connected = false;
    if (hoverCell) draw();
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
        refreshCanvasRect(); // canvas's pixel size just changed, its layout box likely did too
        hoverCell = null; // a resized board can leave a stale hoverCell pointing outside the new grid
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

canvas.addEventListener("mousemove", (event) => {
  const { x, y } = screenToCell(event.clientX, event.clientY, canvasRect, canvas.width, canvas.height, CELL_SIZE);
  const next = inBounds(x, y, width, height) ? { x, y } : null;
  if (hoverCell?.x === next?.x && hoverCell?.y === next?.y) return; // no change, skip the redraw
  hoverCell = next;
  draw();
});

canvas.addEventListener("mouseleave", () => {
  if (!hoverCell) return;
  hoverCell = null;
  draw();
});

canvas.addEventListener("click", (event) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return; // no live connection to send the click on
  if (Date.now() < cooldownUntil) return;
  const { x, y } = screenToCell(event.clientX, event.clientY, canvasRect, canvas.width, canvas.height, CELL_SIZE);
  if (!inBounds(x, y, width, height)) return;

  ws.send(JSON.stringify({ type: "toggle", x, y }));
  // Optimistic lock; the server's "cooldown" or "denied" reply corrects this if needed.
  cooldownUntil = Date.now() + cooldownMs;
});

connect();
