import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { BLOCKS } from "../public/blocks.js";

test("a fresh world is all air", () => {
  const world = new World(4, 4, 4);
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      for (let z = 0; z < 4; z++) {
        assert.equal(world.getBlock(x, y, z), BLOCKS.AIR);
      }
    }
  }
});

test("getBlock outside the world is air, not a crash", () => {
  const world = new World(4, 4, 4);
  assert.equal(world.getBlock(-1, 0, 0), BLOCKS.AIR);
  assert.equal(world.getBlock(100, 0, 0), BLOCKS.AIR);
});

test("setBlock outside the world is a no-op and reports false", () => {
  const world = new World(4, 4, 4);
  assert.equal(world.setBlock(-1, 0, 0, BLOCKS.STONE), false);
  assert.equal(world.setBlock(1, 1, 1, BLOCKS.STONE), true);
  assert.equal(world.getBlock(1, 1, 1), BLOCKS.STONE);
});

test("generate produces bedrock at y=0 and stays in bounds", () => {
  const world = new World(16, 24, 16).generate(1);
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      assert.equal(world.getBlock(x, 0, z), BLOCKS.BEDROCK);
    }
  }
});

test("generate is deterministic for a given seed", () => {
  const a = new World(16, 24, 16).generate(5);
  const b = new World(16, 24, 16).generate(5);
  assert.deepEqual(a.blocks, b.blocks);
});

test("serialize/deserialize round-trips exactly", () => {
  const world = new World(8, 8, 8).generate(3);
  world.setBlock(2, 2, 2, BLOCKS.WOOD);
  const restored = World.deserialize(world.serialize());
  assert.deepEqual(restored.blocks, world.blocks);
  assert.equal(restored.width, world.width);
});

test("raycast hits a solid block placed directly ahead", () => {
  const world = new World(10, 10, 10);
  world.setBlock(5, 5, 5, BLOCKS.STONE);
  const hit = world.raycast({ x: 5.5, y: 5.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [5, 5, 5]);
  assert.deepEqual(hit.normal, { x: 0, y: 0, z: -1 });
  assert.deepEqual(hit.place, { x: 5, y: 5, z: 4 });
});

test("raycast returns null when nothing is within range", () => {
  const world = new World(10, 10, 10);
  const hit = world.raycast({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5);
  assert.equal(hit, null);
});

test("raycast ignores water (non-solid) and finds the block behind it", () => {
  const world = new World(10, 10, 10);
  world.setBlock(3, 5, 5, BLOCKS.WATER);
  world.setBlock(4, 5, 5, BLOCKS.STONE);
  const hit = world.raycast({ x: 0.5, y: 5.5, z: 5.5 }, { x: 1, y: 0, z: 0 }, 10);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [4, 5, 5]);
});
