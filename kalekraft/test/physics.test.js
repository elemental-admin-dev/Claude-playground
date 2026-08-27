import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { collidesAt, stepBody } from "../public/physics.js";
import { BLOCKS } from "../public/blocks.js";

function blankWorld() {
  return new World(0, { chunkSize: 10, chunkHeight: 10, autoGenerate: false });
}

test("collidesAt is false in open air", () => {
  const world = blankWorld();
  assert.equal(collidesAt(world, 5, 5, 5, 0.3, 1.7), false);
});

test("collidesAt is true when a solid block occupies the body's space", () => {
  const world = blankWorld();
  world.setBlock(5, 5, 5, BLOCKS.STONE);
  assert.equal(collidesAt(world, 5.1, 5, 5.1, 0.3, 1.7), true);
});

test("collidesAt respects a smaller body that a larger one wouldn't fit", () => {
  const world = blankWorld();
  // a single-block-wide pillar just past a wider body's reach but within a narrower one's
  world.setBlock(6, 5, 5, BLOCKS.STONE);
  const at = (halfWidth) => collidesAt(world, 5.5, 5, 5, halfWidth, 1.7);
  assert.equal(at(0.3), false); // 5.5 +/- 0.3 = [5.2, 5.8], doesn't reach block 6
  assert.equal(at(0.6), true); // 5.5 +/- 0.6 = [4.9, 6.1], does
});

test("stepBody applies gravity and moves the body", () => {
  const world = blankWorld();
  const body = { x: 5, y: 5, z: 5, vy: 0, onGround: false };
  const next = stepBody(world, body, { moveX: 0, moveZ: 0, speed: 1, jump: false, jumpSpeed: 0, halfWidth: 0.3, height: 1.7 }, 0.1);
  assert.ok(next.vy < 0);
  assert.ok(next.y < body.y);
});

test("stepBody scales horizontal movement by the given speed", () => {
  const world = blankWorld();
  const body = { x: 5, y: 5, z: 5, vy: 0, onGround: false };
  const next = stepBody(world, body, { moveX: 1, moveZ: 0, speed: 3, jump: false, jumpSpeed: 0, halfWidth: 0.3, height: 1.7 }, 0.1);
  assert.equal(next.vx, 3);
});
