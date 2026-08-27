import * as THREE from "three";
import { World } from "./world.js";
import { buildMeshData } from "./mesh.js";
import { BLOCKS, BLOCK_INFO, HOTBAR_BLOCKS } from "./blocks.js";
import { createPlayer, stepPlayer, EYE_OFFSET } from "./player.js";

const WORLD_WIDTH = 48;
const WORLD_HEIGHT = 32;
const WORLD_DEPTH = 48;
const SAVE_KEY = "kalekraft-save-v1";
const REACH = 6;
const MOUSE_SENSITIVITY = 0.0022;

// ---------------------------------------------------------------- world/save

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { world: World.deserialize(data.world), player: data.player ?? null };
  } catch (err) {
    console.warn("kalekraft: failed to load save, starting fresh", err);
    return null;
  }
}

function findSpawn(world) {
  const cx = Math.floor(world.width / 2);
  const cz = Math.floor(world.depth / 2);
  for (let y = world.height - 1; y > 0; y--) {
    if (world.getBlock(cx, y, cz) !== BLOCKS.AIR) return { x: cx + 0.5, y: y + 1, z: cz + 0.5 };
  }
  return { x: cx + 0.5, y: world.height - 1, z: cz + 0.5 };
}

const saved = loadSave();
let world = saved?.world ?? new World(WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH).generate(Math.floor(Math.random() * 1e9));
let player = createPlayer(0, 0, 0);
if (saved?.player) {
  Object.assign(player, saved.player);
} else {
  Object.assign(player, findSpawn(world));
}
let yaw = saved?.player?.yaw ?? 0;
let pitch = saved?.player?.pitch ?? 0;

function persist() {
  const data = { world: world.serialize(), player: { ...player, yaw, pitch } };
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
  world = new World(WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH).generate(Math.floor(Math.random() * 1e9));
  Object.assign(player, findSpawn(world), { vx: 0, vy: 0, vz: 0 });
  rebuildMeshes();
}

// -------------------------------------------------------------------- scene

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 24, 60);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.rotation.order = "YXZ";

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(0.6, 1, 0.4);
scene.add(sun);

const opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const waterMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.75,
});

let opaqueMesh = null;
let waterMesh = null;

function bucketToGeometry(bucket) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(bucket.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(bucket.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(bucket.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(bucket.indices, 1));
  return geometry;
}

function rebuildMeshes() {
  if (opaqueMesh) {
    scene.remove(opaqueMesh);
    opaqueMesh.geometry.dispose();
  }
  if (waterMesh) {
    scene.remove(waterMesh);
    waterMesh.geometry.dispose();
  }
  const { opaque, water } = buildMeshData(world);
  opaqueMesh = new THREE.Mesh(bucketToGeometry(opaque), opaqueMaterial);
  waterMesh = new THREE.Mesh(bucketToGeometry(water), waterMaterial);
  scene.add(opaqueMesh, waterMesh);
}
rebuildMeshes();

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
  world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR);
  rebuildMeshes();
}

function placeBlock() {
  const hit = currentTarget();
  if (!hit) return;
  const { place } = hit;
  if (intersectsPlayer(place.x, place.y, place.z)) return;
  world.setBlock(place.x, place.y, place.z, selectedBlock);
  rebuildMeshes();
}

function intersectsPlayer(bx, by, bz) {
  const dx = Math.max(bx - (player.x + 0.3), player.x - 0.3 - (bx + 1), 0);
  const dz = Math.max(bz - (player.z + 0.3), player.z - 0.3 - (bz + 1), 0);
  const dy = Math.max(by - (player.y + 1.7), player.y - (by + 1), 0);
  return dx === 0 && dy === 0 && dz === 0;
}

// ------------------------------------------------------------------- hotbar

const hotbar = document.getElementById("hotbar");
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
  label.style.position = "absolute";
  label.style.fontSize = "0.55rem";
  label.style.marginTop = "-30px";
  slot.style.position = "relative";
  slot.appendChild(label);
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
