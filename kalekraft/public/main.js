import * as THREE from "three";
import { World } from "./world.js";
import { buildChunkMeshData } from "./mesh.js";
import { BLOCKS, BLOCK_INFO, HOTBAR_BLOCKS } from "./blocks.js";
import { createPlayer, stepPlayer, EYE_OFFSET } from "./player.js";
import { KINDS, TILE_SIZE, pixelColor } from "./textures.js";
import { Inventory } from "./inventory.js";

const SAVE_KEY = "kalekraft-save-v3";
const REACH = 6;
const MOUSE_SENSITIVITY = 0.0022;
const RENDER_DISTANCE = 5; // chunks (radius)
const CHUNKS_PER_FRAME = 2; // budget so entering a new area doesn't stall a frame
// Comfortably beyond RENDER_DISTANCE (mesh-boundary queries generate ~1 chunk of
// halo past it) so a chunk isn't evicted and immediately regenerated as the
// player wanders back and forth near the render-distance edge.
const EVICT_DISTANCE = RENDER_DISTANCE + 3;

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

function findSpawn(world) {
  const wx = 8;
  const wz = 8;
  for (let y = world.chunkHeight - 1; y > 0; y--) {
    if (world.getBlock(wx, y, wz) !== BLOCKS.AIR) return { x: wx + 0.5, y: y + 1, z: wz + 0.5 };
  }
  return { x: wx + 0.5, y: world.chunkHeight - 1, z: wz + 0.5 };
}

const saved = loadSave();
let world = saved?.world ?? new World(Math.floor(Math.random() * 1e9));
let player = createPlayer(0, 0, 0);
if (saved?.player) {
  Object.assign(player, saved.player);
} else {
  Object.assign(player, findSpawn(world));
}
let yaw = saved?.player?.yaw ?? 0;
let pitch = saved?.player?.pitch ?? 0;
let inventory = saved?.inventory ?? new Inventory();

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
  if (!confirm("Discard this world and generate a new one?")) return;
  localStorage.removeItem(SAVE_KEY);
  world = new World(Math.floor(Math.random() * 1e9));
  Object.assign(player, findSpawn(world), { vx: 0, vy: 0, vz: 0 });
  inventory = new Inventory();
  updateHotbarCounts();
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

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(0.6, 1, 0.4);
scene.add(sun);

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
  if (e.code === "KeyN") newWorld();
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

overlay.addEventListener("click", () => canvas.requestPointerLock());
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

function breakBlock() {
  const hit = currentTarget();
  if (!hit) return;
  const brokenId = world.getBlock(hit.x, hit.y, hit.z);
  const affected = world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR);
  for (const { cx, cz } of affected) remeshIfLoaded(cx, cz);
  inventory.add(brokenId, 1);
  updateHotbarCounts();
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
  updateHotbarCounts();
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

  updateChunkStreaming();
  processChunkQueue();

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
    player = stepPlayer(world, player, { moveX, moveZ, jump: keys.has("Space") }, dt);
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
