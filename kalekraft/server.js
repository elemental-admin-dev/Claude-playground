import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { World } from "./public/world.js";
import { SHARED_WORLD_SEED } from "./public/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/three.module.js", express.static(path.join(__dirname, "node_modules/three/build/three.module.js")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Every client generates the same terrain locally from SHARED_WORLD_SEED,
// so the server only needs to track *edits*, not the terrain itself — this
// authoritative World never calls generate() (autoGenerate: false), it's
// purely a sparse record of what's been changed, sent to new joiners as
// catch-up so they see edits made before they connected. It also tracks
// connected players (for placing their avatars) and forwards move events.
const serverWorld = new World(SHARED_WORLD_SEED, { autoGenerate: false });
const players = new Map(); // ws -> { id, x, y, z, yaw } | { id, x: null, ... } before their first move

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(message, exclude) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  players.set(ws, { id, x: null, y: null, z: null, yaw: 0 });

  const others = [...players.values()].filter((p) => p.id !== id && p.x !== null);
  send(ws, { type: "init", playerId: id, others, dirtyChunks: serverWorld.serialize().dirtyChunks });

  ws.on("error", (err) => {
    console.warn("kalekraft: client socket error", err.message);
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const me = players.get(ws);
    if (!me) return;

    if (msg.type === "move" && [msg.x, msg.y, msg.z, msg.yaw].every(Number.isFinite)) {
      me.x = msg.x;
      me.y = msg.y;
      me.z = msg.z;
      me.yaw = msg.yaw;
      broadcast({ type: "move", playerId: me.id, x: me.x, y: me.y, z: me.z, yaw: me.yaw }, ws);
    } else if (msg.type === "edit" && [msg.x, msg.y, msg.z].every(Number.isInteger) && Number.isInteger(msg.id)) {
      serverWorld.setBlock(msg.x, msg.y, msg.z, msg.id);
      broadcast({ type: "edit", x: msg.x, y: msg.y, z: msg.z, id: msg.id }); // including the sender, for uniform handling
    }
  });

  ws.on("close", () => {
    players.delete(ws);
    broadcast({ type: "leave", playerId: id });
  });
});

server.listen(PORT, () => {
  console.log(`kalekraft listening on http://localhost:${PORT}`);
});
