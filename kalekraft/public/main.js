import * as THREE from "three";
import { World } from "./world.js";
import { buildChunkMeshData } from "./mesh.js";
import { BLOCKS, BLOCK_INFO, HOTBAR_BLOCKS } from "./blocks.js";
import { createPlayer, stepPlayer, EYE_OFFSET } from "./player.js";
import { KINDS, TILE_SIZE, pixelColor } from "./textures.js";
import { Inventory } from "./inventory.js";
import { createMob, stepMob, HALF_WIDTH as MOB_HALF_WIDTH, HEIGHT as MOB_HEIGHT } from "./mob.js";
import { HALF_WIDTH as PLAYER_HALF_WIDTH, HEIGHT as PLAYER_HEIGHT } from "./player.js";
import { RECIPES, craft } from "./crafting.js";
import { SHARED_WORLD_SEED } from "./config.js";
import { damp, dampAngle } from "./interp.js";
import { getPreset } from "./audio.js";
import { timeOfDay, sunDirection, ambientIntensity, sunIntensity, skyColor } from "./daynight.js";

const SAVE_KEY = "kalekraft-save-v4";
const REACH = 6;
const MOUSE_SENSITIVITY = 0.0022;
const RENDER_DISTANCE = 5; // chunks (radius)
const CHUNKS_PER_FRAME = 2; // budget so entering a new area doesn't stall a frame
const MOB_COUNT = 6;
const MOB_SPAWN_RADIUS = 12; // blocks, around the player's spawn point
// Comfortably beyond RENDER_DISTANCE (mesh-boundary queries generate ~1 chunk of
// halo past it) so a chunk isn't evicted and immediately regenerated as the
// player wanders back and forth near the render-distance edge.
const EVICT_DISTANCE = RENDER_DISTANCE + 3;
const MOVE_BROADCAST_MS = 100; // ~10Hz

// ---------------------------------------------------------------- world/save

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      world: World.deserialize(data.world),
      player: data.player ?? null,
      inventory: Inventory.deserialize(data.inventory),
    };
  } catch (err) {
    console.warn("kalekraft: failed to load save, starting fresh", err);
    return null;
  }
}

function columnSurface(world, wx, wz) {
  for (let y = world.chunkHeight - 1; y > 0; y--) {
    if (world.getBlock(wx, y, wz) !== BLOCKS.AIR) return y;
  }
  return null;
}

function findSpawn(world) {
  const wx = 8;
  const wz = 8;
  const surface = columnSurface(world, wx, wz);
  return { x: wx + 0.5, y: (surface ?? world.chunkHeight - 2) + 1, z: wz + 0.5 };
}

// Mobs aren't saved with the world — they're ambient wildlife, not player
// state, so a fresh batch spawns near the player every time the page loads.
function spawnMobs(world, center) {
  const mobs = [];
  for (let i = 0; i < MOB_COUNT; i++) {
    const wx = Math.floor(center.x + (Math.random() * 2 - 1) * MOB_SPAWN_RADIUS);
    const wz = Math.floor(center.z + (Math.random() * 2 - 1) * MOB_SPAWN_RADIUS);
    const surface = columnSurface(world, wx, wz);
    if (surface === null) continue;
    mobs.push(createMob(wx + 0.5, surface + 1, wz + 0.5));
  }
  return mobs;
}

const saved = loadSave();
let world = saved?.world ?? new World(SHARED_WORLD_SEED);
let player = createPlayer(0, 0, 0);
if (saved?.player) {
  Object.assign(player, saved.player);
} else {
  Object.assign(player, findSpawn(world));
}
let yaw = saved?.player?.yaw ?? 0;
let pitch = saved?.player?.pitch ?? 0;
let inventory = saved?.inventory ?? new Inventory();
let mobs = spawnMobs(world, player);

function persist() {
  const data = { world: world.serialize(), player: { ...player, yaw, pitch }, inventory: inventory.serialize() };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    flashSaveStatus("saved");
  } catch (err) {
    console.warn("kalekraft: failed to save", err);
  }
}

function newWorld() {
  if (!confirm("Discard your local edits and resync to the shared world?")) return;
  localStorage.removeItem(SAVE_KEY);
  world = new World(SHARED_WORLD_SEED);
  Object.assign(player, findSpawn(world), { vx: 0, vy: 0, vz: 0 });
  inventory = new Inventory();
  updateHotbarCounts();
  updateCraftingPanel();
  mobs = spawnMobs(world, player);
  rebuildMobMeshes();
  resetChunkStreaming();
}

// -------------------------------------------------------------------- scene

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const fogFar = RENDER_DISTANCE * world.chunkSize * 0.92;
scene.fog = new THREE.Fog(0x87ceeb, fogFar * 0.45, fogFar);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.rotation.order = "YXZ";

const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(0.6, 1, 0.4);
scene.add(sun);

let dayNightElapsed = 0;

function updateDayNight(dt) {
  dayNightElapsed += dt;
  const t = timeOfDay(dayNightElapsed);
  ambientLight.intensity = ambientIntensity(t);
  sun.intensity = sunIntensity(t);
  const dir = sunDirection(t);
  sun.position.set(dir.x, dir.y, dir.z);
  const sky = skyColor(t);
  scene.background.setRGB(sky.r, sky.g, sky.b);
  scene.fog.color.setRGB(sky.r, sky.g, sky.b);
}

function buildTextureAtlas() {
  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = KINDS.length * TILE_SIZE;
  atlasCanvas.height = TILE_SIZE;
  const ctx = atlasCanvas.getContext("2d");
  const image = ctx.createImageData(atlasCanvas.width, atlasCanvas.height);
  for (let i = 0; i < KINDS.length; i++) {
    const kind = KINDS[i];
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const [r, g, b] = pixelColor(kind, px, py);
        const idx = (py * atlasCanvas.width + (i * TILE_SIZE + px)) * 4;
        image.data[idx] = r;
        image.data[idx + 1] = g;
        image.data[idx + 2] = b;
        image.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(atlasCanvas);
  texture.magFilter = THREE.NearestFilter; // crisp pixels, no blur between tiles
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const opaqueMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  map: buildTextureAtlas(),
});
const waterMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.75,
});

function bucketToGeometry(bucket) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(bucket.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(bucket.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(bucket.colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(bucket.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(bucket.indices, 1));
  return geometry;
}

// ------------------------------------------------------------ chunk streaming
//
// Chunks stream in/out around the player as they move: meshed chunks within
// RENDER_DISTANCE stay in the scene, others get unmeshed (their voxel data
// stays cached in `world`, so re-entering an area just remeshes it — no
// regeneration, no lost edits). New chunks are meshed a few per frame so
// crossing into unexplored territory doesn't stall.

const chunkMeshes = new Map(); // "cx,cz" -> { opaqueMesh, waterMesh }
let pendingChunkQueue = [];
let lastPlayerChunk = null;

function chunkKeyOf(cx, cz) {
  return `${cx},${cz}`;
}

function meshChunk(cx, cz) {
  const { opaque, water } = buildChunkMeshData(world, cx, cz);
  const opaqueMesh = new THREE.Mesh(bucketToGeometry(opaque), opaqueMaterial);
  const waterMesh = new THREE.Mesh(bucketToGeometry(water), waterMaterial);
  scene.add(opaqueMesh, waterMesh);
  const key = chunkKeyOf(cx, cz);
  const existing = chunkMeshes.get(key);
  if (existing) {
    scene.remove(existing.opaqueMesh, existing.waterMesh);
    existing.opaqueMesh.geometry.dispose();
    existing.waterMesh.geometry.dispose();
  }
  chunkMeshes.set(key, { opaqueMesh, waterMesh });
}

function unmeshChunk(cx, cz) {
  const key = chunkKeyOf(cx, cz);
  const existing = chunkMeshes.get(key);
  if (!existing) return;
  scene.remove(existing.opaqueMesh, existing.waterMesh);
  existing.opaqueMesh.geometry.dispose();
  existing.waterMesh.geometry.dispose();
  chunkMeshes.delete(key);
}

function remeshIfLoaded(cx, cz) {
  if (chunkMeshes.has(chunkKeyOf(cx, cz))) meshChunk(cx, cz);
}

function resetChunkStreaming() {
  for (const key of [...chunkMeshes.keys()]) {
    const [cx, cz] = key.split(",").map(Number);
    unmeshChunk(cx, cz);
  }
  pendingChunkQueue = [];
  lastPlayerChunk = null;
}

function updateChunkStreaming() {
  const { cx: pcx, cz: pcz } = world.worldToChunkCoords(player.x, player.z);
  if (lastPlayerChunk && lastPlayerChunk.cx === pcx && lastPlayerChunk.cz === pcz) return;
  lastPlayerChunk = { cx: pcx, cz: pcz };

  const desired = new Set();
  const candidates = [];
  const r2 = RENDER_DISTANCE * RENDER_DISTANCE;
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      if (dx * dx + dz * dz > r2) continue;
      const cx = pcx + dx;
      const cz = pcz + dz;
      desired.add(chunkKeyOf(cx, cz));
      candidates.push({ cx, cz, dist: dx * dx + dz * dz });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);
  pendingChunkQueue = candidates.filter((c) => !chunkMeshes.has(chunkKeyOf(c.cx, c.cz)));

  for (const key of [...chunkMeshes.keys()]) {
    if (!desired.has(key)) {
      const [cx, cz] = key.split(",").map(Number);
      unmeshChunk(cx, cz);
    }
  }

  world.evictFarChunks(pcx, pcz, EVICT_DISTANCE);
}

function processChunkQueue() {
  let budget = CHUNKS_PER_FRAME;
  while (budget-- > 0 && pendingChunkQueue.length > 0) {
    const { cx, cz } = pendingChunkQueue.shift();
    meshChunk(cx, cz);
  }
}

// block-highlight wireframe, shown over whatever block the player is looking at
const highlightGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
const highlight = new THREE.LineSegments(highlightGeometry, new THREE.LineBasicMaterial({ color: 0x000000 }));
highlight.visible = false;
scene.add(highlight);

// ---------------------------------------------------------------------- mobs

const mobGeometry = new THREE.BoxGeometry(MOB_HALF_WIDTH * 2, MOB_HEIGHT, MOB_HALF_WIDTH * 2);
const mobMaterial = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
let mobMeshes = [];

function rebuildMobMeshes() {
  for (const mesh of mobMeshes) scene.remove(mesh);
  mobMeshes = mobs.map(() => {
    const mesh = new THREE.Mesh(mobGeometry, mobMaterial);
    scene.add(mesh);
    return mesh;
  });
}
rebuildMobMeshes();

function updateMobs(dt) {
  mobs = mobs.map((mob) => stepMob(world, mob, dt));
  mobs.forEach((mob, i) => {
    const mesh = mobMeshes[i];
    mesh.position.set(mob.x, mob.y + MOB_HEIGHT / 2, mob.z);
    if (mob.moveX !== 0 || mob.moveZ !== 0) mesh.rotation.y = Math.atan2(mob.moveX, mob.moveZ);
  });
}

// -------------------------------------------------------------- multiplayer
//
// Every client generates identical terrain from SHARED_WORLD_SEED, so the
// server only needs to relay *edits* (and player positions, for avatars),
// never terrain — including catch-up for a player who joins mid-session,
// via the server's own authoritative (edits-only) World. See the README.

const remotePlayerGeometry = new THREE.BoxGeometry(PLAYER_HALF_WIDTH * 2, PLAYER_HEIGHT, PLAYER_HALF_WIDTH * 2);
const remotePlayerMaterial = new THREE.MeshLambertMaterial({ color: 0x4aa3d9 });
const remotePlayers = new Map(); // playerId -> { mesh, targetX, targetY, targetZ, targetYaw }
const REMOTE_PLAYER_SMOOTHING = 12; // higher = closes the gap to the target faster
let myPlayerId = null;
let ws = null;
let lastMoveSentAt = 0;

// Moves are relayed at ~10Hz (MOVE_BROADCAST_MS), which looks visibly choppy
// if applied straight to the mesh. upsertRemotePlayer only updates the
// *target*; updateRemotePlayers eases the mesh toward it every frame.
function upsertRemotePlayer(id, x, y, z, yaw) {
  let entry = remotePlayers.get(id);
  if (!entry) {
    const mesh = new THREE.Mesh(remotePlayerGeometry, remotePlayerMaterial);
    scene.add(mesh);
    mesh.position.set(x, y + PLAYER_HEIGHT / 2, z); // first sighting: snap, don't ease in from the origin
    mesh.rotation.y = yaw;
    remotePlayers.set(id, { mesh, targetX: x, targetY: y, targetZ: z, targetYaw: yaw });
    return;
  }
  entry.targetX = x;
  entry.targetY = y;
  entry.targetZ = z;
  entry.targetYaw = yaw;
}

function updateRemotePlayers(dt) {
  for (const entry of remotePlayers.values()) {
    const { mesh } = entry;
    mesh.position.x = damp(mesh.position.x, entry.targetX, REMOTE_PLAYER_SMOOTHING, dt);
    mesh.position.y = damp(mesh.position.y - PLAYER_HEIGHT / 2, entry.targetY, REMOTE_PLAYER_SMOOTHING, dt) + PLAYER_HEIGHT / 2;
    mesh.position.z = damp(mesh.position.z, entry.targetZ, REMOTE_PLAYER_SMOOTHING, dt);
    mesh.rotation.y = dampAngle(mesh.rotation.y, entry.targetYaw, REMOTE_PLAYER_SMOOTHING, dt);
  }
}

function removeRemotePlayer(id) {
  const entry = remotePlayers.get(id);
  if (!entry) return;
  scene.remove(entry.mesh);
  remotePlayers.delete(id);
}

function connectMultiplayer() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "init") {
      myPlayerId = msg.playerId;
      for (const p of msg.others) upsertRemotePlayer(p.id, p.x, p.y, p.z, p.yaw);
      // Catch-up: the server's authoritative dirty chunks, for edits made
      // before we connected. Merge into our own world rather than
      // replacing it, so our own local edits survive.
      for (const dirtyChunk of msg.dirtyChunks ?? []) {
        world.applyDirtyChunk(dirtyChunk);
        remeshIfLoaded(dirtyChunk.cx, dirtyChunk.cz);
      }
    } else if (msg.type === "move") {
      upsertRemotePlayer(msg.playerId, msg.x, msg.y, msg.z, msg.yaw);
    } else if (msg.type === "edit") {
      const affected = world.setBlock(msg.x, msg.y, msg.z, msg.id);
      for (const { cx, cz } of affected) remeshIfLoaded(cx, cz);
    } else if (msg.type === "leave") {
      removeRemotePlayer(msg.playerId);
    }
  });

  ws.addEventListener("close", () => {
    for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
    setTimeout(connectMultiplayer, 2000);
  });
}
connectMultiplayer();

function sendEdit(x, y, z, id) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "edit", x, y, z, id }));
}

function maybeSendMove(now) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  if (now - lastMoveSentAt < MOVE_BROADCAST_MS) return;
  lastMoveSentAt = now;
  ws.send(JSON.stringify({ type: "move", x: player.x, y: player.y, z: player.z, yaw }));
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

// -------------------------------------------------------------------- input

const keys = new Set();
let selectedBlock = HOTBAR_BLOCKS[0];

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.repeat) return; // one-shot actions below should fire once per press, not per OS auto-repeat tick
  if (e.code === "KeyN") newWorld();
  if (e.code === "KeyC") toggleCraftingPanel();
  tryCraftFromKey(e.code);
  const digit = Number(e.key);
  if (digit >= 1 && digit <= HOTBAR_BLOCKS.length) selectBlock(HOTBAR_BLOCKS[digit - 1]);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

const overlay = document.getElementById("overlay");
const saveStatus = document.getElementById("save-status");
let saveStatusTimer = null;

function flashSaveStatus(text) {
  saveStatus.textContent = text;
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => (saveStatus.textContent = ""), 1500);
}

overlay.addEventListener("click", () => {
  canvas.requestPointerLock();
  ensureAudioContext(); // browsers require a user gesture before audio can play
});
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  overlay.classList.toggle("hidden", locked);
  if (!locked) persist();
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * MOUSE_SENSITIVITY;
  pitch -= e.movementY * MOUSE_SENSITIVITY;
  const limit = Math.PI / 2 - 0.01;
  pitch = Math.max(-limit, Math.min(limit, pitch));
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) breakBlock();
  else if (e.button === 2) placeBlock();
});

function forwardVector() {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
function rightVector() {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function currentTarget() {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  return world.raycast(camera.position, dir, REACH);
}

// ---------------------------------------------------------------------- audio
//
// Procedurally synthesized, like the textures and terrain — no audio files.
// Browsers require a user gesture before audio can play, so the
// AudioContext is created (or resumed) lazily on the first sound, which in
// practice is triggered by the overlay click that also engages pointer lock.

let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playSound(kind) {
  const preset = getPreset(kind);
  if (!preset) return;
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  if (preset.type === "tone") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(preset.frequency, now);
    gain.gain.setValueAtTime(preset.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + preset.duration);
  } else if (preset.type === "noise") {
    const length = Math.max(1, Math.floor(ctx.sampleRate * preset.duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = preset.filterFreq;
    gain.gain.setValueAtTime(preset.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
  } else if (preset.type === "chime") {
    preset.notes.forEach((frequency, i) => {
      const startAt = now + i * preset.noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(preset.gain, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + preset.noteDuration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + preset.noteDuration);
    });
  }
}

function breakBlock() {
  const hit = currentTarget();
  if (!hit) return;
  const brokenId = world.getBlock(hit.x, hit.y, hit.z);
  const affected = world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR);
  for (const { cx, cz } of affected) remeshIfLoaded(cx, cz);
  sendEdit(hit.x, hit.y, hit.z, BLOCKS.AIR);
  inventory.add(brokenId, 1);
  updateHotbarCounts();
  updateCraftingPanel();
  playSound("break");
}

function placeBlock() {
  if (!inventory.has(selectedBlock, 1)) return;
  const hit = currentTarget();
  if (!hit) return;
  const { place } = hit;
  if (intersectsPlayer(place.x, place.y, place.z)) return;
  inventory.remove(selectedBlock, 1);
  const affected = world.setBlock(place.x, place.y, place.z, selectedBlock);
  for (const { cx, cz } of affected) remeshIfLoaded(cx, cz);
  sendEdit(place.x, place.y, place.z, selectedBlock);
  updateHotbarCounts();
  updateCraftingPanel();
  playSound("place");
}

function intersectsPlayer(bx, by, bz) {
  const dx = Math.max(bx - (player.x + 0.3), player.x - 0.3 - (bx + 1), 0);
  const dz = Math.max(bz - (player.z + 0.3), player.z - 0.3 - (bz + 1), 0);
  const dy = Math.max(by - (player.y + 1.7), player.y - (by + 1), 0);
  return dx === 0 && dy === 0 && dz === 0;
}

// ------------------------------------------------------------------- hotbar

const hotbar = document.getElementById("hotbar");
const countElements = [];
const slotElements = HOTBAR_BLOCKS.map((id, i) => {
  const slot = document.createElement("div");
  slot.className = "slot";
  const swatch = document.createElement("div");
  swatch.className = "swatch";
  const [r, g, b] = BLOCK_INFO[id].color;
  swatch.style.background = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
  slot.appendChild(swatch);
  const label = document.createElement("div");
  label.textContent = String(i + 1);
  label.className = "slot-key";
  slot.appendChild(label);
  const count = document.createElement("div");
  count.className = "slot-count";
  slot.appendChild(count);
  countElements.push(count);
  slot.addEventListener("click", () => selectBlock(id));
  hotbar.appendChild(slot);
  return slot;
});

function selectBlock(id) {
  selectedBlock = id;
  const index = HOTBAR_BLOCKS.indexOf(id);
  slotElements.forEach((el, i) => el.classList.toggle("active", i === index));
}
selectBlock(selectedBlock);

function updateHotbarCounts() {
  HOTBAR_BLOCKS.forEach((id, i) => {
    const n = inventory.count(id);
    countElements[i].textContent = n > 0 ? String(n) : "";
    slotElements[i].classList.toggle("empty", n === 0);
  });
}
updateHotbarCounts();

// ----------------------------------------------------------------- crafting

const CRAFT_KEYS = ["KeyZ", "KeyX", "KeyV"]; // one per RECIPES entry, in order
if (CRAFT_KEYS.length < RECIPES.length) {
  throw new Error(`CRAFT_KEYS (${CRAFT_KEYS.length}) has fewer entries than RECIPES (${RECIPES.length}) — add a keybind for the new recipe.`);
}
const craftingPanel = document.getElementById("crafting-panel");
const craftingList = document.getElementById("crafting-list");

const recipeRows = RECIPES.map((recipe, i) => {
  const row = document.createElement("div");
  row.className = "recipe-row";

  const key = document.createElement("span");
  key.className = "recipe-key";
  key.textContent = CRAFT_KEYS[i].replace("Key", "");
  row.appendChild(key);

  const name = document.createElement("span");
  name.className = "recipe-name";
  name.textContent = recipe.name;
  row.appendChild(name);

  const need = document.createElement("span");
  need.className = "recipe-need";
  row.appendChild(need);

  craftingList.appendChild(row);
  return { row, need };
});

function updateCraftingPanel() {
  RECIPES.forEach((recipe, i) => {
    const parts = Object.entries(recipe.inputs).map(([blockId, count]) => {
      return `${inventory.count(Number(blockId))}/${count}`;
    });
    const ready = Object.entries(recipe.inputs).every(([blockId, count]) => inventory.has(Number(blockId), count));
    recipeRows[i].need.textContent = parts.join(", ");
    recipeRows[i].row.classList.toggle("ready", ready);
  });
}
updateCraftingPanel();

function toggleCraftingPanel() {
  craftingPanel.classList.toggle("hidden");
}

function tryCraftFromKey(code) {
  const index = CRAFT_KEYS.indexOf(code);
  if (index === -1) return;
  if (craft(inventory, RECIPES[index].id)) {
    updateHotbarCounts();
    updateCraftingPanel();
    playSound("craft");
  }
}

// --------------------------------------------------------------------- loop

const coordsEl = document.getElementById("coords");
const fpsEl = document.getElementById("fps");
let lastTime = performance.now();
let fpsAccumulator = 0;
let fpsFrames = 0;
let fpsDisplay = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateDayNight(dt);
  updateChunkStreaming();
  processChunkQueue();
  updateMobs(dt);
  updateRemotePlayers(dt);
  maybeSendMove(now);

  if (document.pointerLockElement === canvas) {
    const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const f = forwardVector();
    const r = rightVector();
    let moveX = f.x * forward + r.x * strafe;
    let moveZ = f.z * forward + r.z * strafe;
    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }
    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const wasOnGround = player.onGround;
    player = stepPlayer(world, player, { moveX, moveZ, jump: keys.has("Space"), sprint }, dt);
    if (wasOnGround && !player.onGround && player.vy > 0) playSound("jump");
  }

  camera.position.set(player.x, player.y + EYE_OFFSET, player.z);
  camera.rotation.set(pitch, yaw, 0, "YXZ");

  const hit = currentTarget();
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  coordsEl.textContent = `x=${player.x.toFixed(1)} y=${player.y.toFixed(1)} z=${player.z.toFixed(1)}`;
  fpsAccumulator += dt;
  fpsFrames++;
  if (fpsAccumulator >= 0.25) {
    fpsDisplay = Math.round(fpsFrames / fpsAccumulator);
    fpsAccumulator = 0;
    fpsFrames = 0;
    fpsEl.textContent = `${fpsDisplay} fps`;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

setInterval(persist, 15000);
window.addEventListener("beforeunload", persist);
