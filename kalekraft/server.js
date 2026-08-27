import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/three.module.js", express.static(path.join(__dirname, "node_modules/three/build/three.module.js")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// A pure relay: every client generates the same terrain locally from a
// shared, fixed seed (see SHARED_WORLD_SEED in public/main.js), so the
// server doesn't need to hold any world state itself — it just tracks
// connected players (for placing their avatars) and forwards edit/move
// events. A player who joins mid-session won't see edits made before they
// connected; see the README for why that's an accepted limitation here.
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
  send(ws, { type: "init", playerId: id, others });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const me = players.get(ws);
    if (!me) return;

    if (msg.type === "move" && [msg.x, msg.y, msg.z, msg.yaw].every(Number.isFinite)) {
      me.x = msg.x;
      me.y = msg.y;
      me.z = msg.z;
      me.yaw = msg.yaw;
      broadcast({ type: "move", playerId: me.id, x: me.x, y: me.y, z: me.z, yaw: me.yaw }, ws);
    } else if (msg.type === "edit" && [msg.x, msg.y, msg.z].every(Number.isInteger) && Number.isInteger(msg.id)) {
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
