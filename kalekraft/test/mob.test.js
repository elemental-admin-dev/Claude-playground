import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { createMob, stepMob, HALF_WIDTH as MOB_HALF_WIDTH, HEIGHT as MOB_HEIGHT } from "../public/mob.js";
import { HALF_WIDTH as PLAYER_HALF_WIDTH, HEIGHT as PLAYER_HEIGHT } from "../public/player.js";
import { BLOCKS } from "../public/blocks.js";

function flatFloorWorld(size = 20) {
  const world = new World(0, { chunkSize: size, chunkHeight: 20, autoGenerate: false });
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      world.setBlock(x, 0, z, BLOCKS.STONE);
    }
  }
  return world;
}

// Deterministic in [0, 1): same sequence every call, so tests are reproducible.
function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("a mob falls under gravity like the player does", () => {
  const world = flatFloorWorld();
  let mob = createMob(5, 5, 5, seededRng(1));
  const first = stepMob(world, mob, 0.1, seededRng(1));
  assert.ok(first.vy < 0);
  assert.ok(first.y < mob.y);
});

test("a mob lands on the floor and stops falling", () => {
  const world = flatFloorWorld();
  let mob = createMob(5, 3, 5, seededRng(2));
  const rng = seededRng(2);
  for (let i = 0; i < 200; i++) mob = stepMob(world, mob, 1 / 60, rng);
  assert.equal(mob.onGround, true);
  assert.ok(mob.y >= 0.9 && mob.y < 1.3);
});

test("a mob picks a new heading once its wander timer expires", () => {
  const world = flatFloorWorld();
  const rng = seededRng(3);
  let mob = createMob(5, 1, 5, rng);
  const initialHeading = { moveX: mob.moveX, moveZ: mob.moveZ };
  let headingChanged = false;
  for (let i = 0; i < 600; i++) {
    // 600 * 1/60 = 10s, comfortably past MAX_WANDER_S
    mob = stepMob(world, mob, 1 / 60, rng);
    if (mob.moveX !== initialHeading.moveX || mob.moveZ !== initialHeading.moveZ) {
      headingChanged = true;
      break;
    }
  }
  assert.equal(headingChanged, true);
});

test("a mob stuck against a wall picks a new heading instead of pushing forever", () => {
  const world = flatFloorWorld();
  // wall along x=8, tall enough that step-up can't help
  for (let x = 8; x <= 8; x++) {
    for (let y = 1; y <= 3; y++) {
      for (let z = 0; z < 20; z++) world.setBlock(x, y, z, BLOCKS.STONE);
    }
  }
  const rng = seededRng(4);
  let mob = createMob(7.5, 1, 5, rng);
  mob = { ...mob, moveX: 1, moveZ: 0, wanderTimer: 999 }; // force it to walk straight into the wall
  for (let i = 0; i < 120; i++) mob = stepMob(world, mob, 1 / 60, rng);
  assert.ok(mob.x < 8); // never clipped through the wall
});

test("a mob's body is smaller than the player's", () => {
  assert.ok(MOB_HALF_WIDTH < PLAYER_HALF_WIDTH);
  assert.ok(MOB_HEIGHT < PLAYER_HEIGHT);
});

test("stepMob is deterministic for a given rng sequence", () => {
  const world = flatFloorWorld();
  const mobA = createMob(5, 5, 5, seededRng(42));
  const mobB = createMob(5, 5, 5, seededRng(42));
  let a = mobA;
  let b = mobB;
  const rngA = seededRng(42);
  const rngB = seededRng(42);
  for (let i = 0; i < 50; i++) {
    a = stepMob(world, a, 1 / 60, rngA);
    b = stepMob(world, b, 1 / 60, rngB);
  }
  assert.deepEqual(a, b);
});
