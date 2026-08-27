import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { createPlayer, stepPlayer } from "../public/player.js";
import { BLOCKS } from "../public/blocks.js";

function flatFloorWorld() {
  const world = new World(0, { chunkSize: 10, chunkHeight: 10, autoGenerate: false });
  for (let x = 0; x < 30; x++) {
    for (let z = 0; z < 10; z++) {
      world.setBlock(x, 0, z, BLOCKS.STONE);
    }
  }
  return world;
}

test("a player above the ground falls under gravity", () => {
  const world = flatFloorWorld();
  const player = createPlayer(5, 5, 5);
  const next = stepPlayer(world, player, { moveX: 0, moveZ: 0, jump: false }, 0.1);
  assert.ok(next.vy < 0);
  assert.ok(next.y < player.y);
});

test("a player lands on the floor and stops falling", () => {
  const world = flatFloorWorld();
  let player = createPlayer(5, 3, 5);
  for (let i = 0; i < 200; i++) {
    player = stepPlayer(world, player, { moveX: 0, moveZ: 0, jump: false }, 1 / 60);
  }
  assert.equal(player.onGround, true);
  assert.equal(player.vy, 0);
  // resting y sits just below 1: the collision sample (y + 0.01) must stay >= 1.
  assert.ok(player.y >= 0.98 && player.y < 1.2);
});

test("a grounded player can jump", () => {
  const world = flatFloorWorld();
  let player = createPlayer(5, 3, 5);
  for (let i = 0; i < 200; i++) {
    player = stepPlayer(world, player, { moveX: 0, moveZ: 0, jump: false }, 1 / 60);
  }
  assert.equal(player.onGround, true);
  const jumped = stepPlayer(world, player, { moveX: 0, moveZ: 0, jump: true }, 1 / 60);
  assert.ok(jumped.vy > 0);
});

test("a two-block-tall wall blocks horizontal movement", () => {
  const world = flatFloorWorld();
  world.setBlock(6, 1, 5, BLOCKS.STONE);
  world.setBlock(6, 2, 5, BLOCKS.STONE);
  let player = createPlayer(5, 1, 5);
  for (let i = 0; i < 200; i++) {
    player = stepPlayer(world, player, { moveX: 1, moveZ: 0, jump: false }, 1 / 60);
  }
  assert.ok(player.x < 5.71); // too tall to step up onto; stopped by the wall
});

test("a single-block-tall ledge is auto-climbed, not blocked", () => {
  const world = flatFloorWorld();
  // a raised platform starting at x=6, one block tall, nothing above it
  for (let x = 6; x < 30; x++) world.setBlock(x, 1, 5, BLOCKS.STONE);
  let player = createPlayer(5, 1, 5);
  for (let i = 0; i < 200; i++) {
    player = stepPlayer(world, player, { moveX: 1, moveZ: 0, jump: false }, 1 / 60);
  }
  assert.ok(player.x > 6.5); // walked past the ledge, not stuck against it
  assert.ok(player.y > 1.9 && player.y < 2.2); // standing on top of the platform (floor + 1)
});
