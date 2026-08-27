import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { BLOCKS } from "../public/blocks.js";

function blankWorld(chunkSize = 4, chunkHeight = 4) {
  return new World(0, { chunkSize, chunkHeight, autoGenerate: false });
}

test("a blank (non-generating) world is all air until edited", () => {
  const world = blankWorld();
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      for (let z = 0; z < 4; z++) {
        assert.equal(world.getBlock(x, y, z), BLOCKS.AIR);
      }
    }
  }
});

test("getBlock above/below the vertical range is air, not a crash", () => {
  const world = blankWorld();
  assert.equal(world.getBlock(0, -1, 0), BLOCKS.AIR);
  assert.equal(world.getBlock(0, 100, 0), BLOCKS.AIR);
});

test("setBlock outside the vertical range is a no-op reporting no affected chunks", () => {
  const world = blankWorld();
  assert.deepEqual(world.setBlock(0, -1, 0, BLOCKS.STONE), []);
  const affected = world.setBlock(1, 1, 1, BLOCKS.STONE);
  assert.ok(affected.length >= 1);
  assert.equal(world.getBlock(1, 1, 1), BLOCKS.STONE);
});

test("setBlock reports the neighbor chunk too when the edit is on a chunk boundary", () => {
  const world = blankWorld(4, 4);
  const affected = world.setBlock(0, 1, 1, BLOCKS.STONE); // lx === 0
  assert.deepEqual(
    affected.sort((a, b) => a.cx - b.cx),
    [{ cx: -1, cz: 0 }, { cx: 0, cz: 0 }].sort((a, b) => a.cx - b.cx),
  );
});

test("a fresh chunk always has bedrock at y=0, including at negative world coordinates", () => {
  const world = new World(7, { chunkSize: 8, chunkHeight: 24 });
  for (const [x, z] of [[0, 0], [5, 5], [-3, 4], [-20, -20], [31, -9]]) {
    assert.equal(world.getBlock(x, 0, z), BLOCKS.BEDROCK, `bedrock missing at (${x}, ${z})`);
  }
});

test("generation is deterministic for a given seed, across chunk and negative coordinates", () => {
  const a = new World(42, { chunkSize: 8, chunkHeight: 24 });
  const b = new World(42, { chunkSize: 8, chunkHeight: 24 });
  for (let x = -20; x < 20; x += 3) {
    for (let z = -20; z < 20; z += 3) {
      for (let y = 0; y < 24; y += 5) {
        assert.equal(a.getBlock(x, y, z), b.getBlock(x, y, z));
      }
    }
  }
});

test("a tree straddling a chunk boundary agrees with itself on both sides", () => {
  // Find a seed/column where a tree roots exactly on a chunk edge, then
  // confirm both neighboring chunks paint the same leaves where they overlap.
  const chunkSize = 8;
  const seed = 99;
  const probe = new World(seed, { chunkSize, chunkHeight: 32 });
  let treeX = null;
  for (let x = -40; x < 40; x++) {
    // a column at a chunk boundary (local x === 0)
    if (((x % chunkSize) + chunkSize) % chunkSize !== 0) continue;
    const hasWoodAbove = [...Array(6).keys()].some((dy) => probe.getBlock(x, 20 + dy, 0) !== BLOCKS.AIR);
    if (hasWoodAbove) {
      treeX = x;
      break;
    }
  }
  if (treeX === null) return; // no boundary tree in this scan window; nothing to check

  const fromLeft = new World(seed, { chunkSize, chunkHeight: 32 });
  const fromRight = new World(seed, { chunkSize, chunkHeight: 32 });
  // Force generation order to differ: right chunk first, then left, vs. left first.
  fromRight.getOrCreateChunk(Math.floor(treeX / chunkSize), 0);
  fromRight.getOrCreateChunk(Math.floor(treeX / chunkSize) - 1, 0);
  fromLeft.getOrCreateChunk(Math.floor(treeX / chunkSize) - 1, 0);
  fromLeft.getOrCreateChunk(Math.floor(treeX / chunkSize), 0);

  for (let dx = -3; dx <= 3; dx++) {
    for (let y = 15; y < 32; y++) {
      assert.equal(fromLeft.getBlock(treeX + dx, y, 0), fromRight.getBlock(treeX + dx, y, 0));
    }
  }
});

test("serialize/deserialize round-trips edited chunks exactly", () => {
  const world = new World(3, { chunkSize: 8, chunkHeight: 24 });
  world.setBlock(2, 5, 2, BLOCKS.WOOD); // chunk (0,0)
  world.setBlock(20, 5, 2, BLOCKS.WOOD); // a different chunk
  const restored = World.deserialize(world.serialize());
  assert.equal(restored.getBlock(2, 5, 2), BLOCKS.WOOD);
  assert.equal(restored.getBlock(20, 5, 2), BLOCKS.WOOD);
});

test("unedited chunks are not saved, but regenerate identically from the seed", () => {
  const world = new World(11, { chunkSize: 8, chunkHeight: 24 });
  world.getBlock(50, 0, 50); // touch a chunk without editing it
  const snapshot = world.serialize();
  assert.equal(snapshot.dirtyChunks.length, 0);

  const restored = World.deserialize(snapshot);
  for (let y = 0; y < 24; y++) {
    assert.equal(restored.getBlock(50, y, 50), world.getBlock(50, y, 50));
  }
});

test("raycast hits a solid block placed directly ahead", () => {
  const world = blankWorld(4, 10);
  world.setBlock(5, 5, 5, BLOCKS.STONE);
  const hit = world.raycast({ x: 5.5, y: 5.5, z: 0.5 }, { x: 0, y: 0, z: 1 }, 10);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [5, 5, 5]);
  assert.deepEqual(hit.normal, { x: 0, y: 0, z: -1 });
  assert.deepEqual(hit.place, { x: 5, y: 5, z: 4 });
});

test("raycast returns null when nothing is within range", () => {
  const world = blankWorld(4, 10);
  const hit = world.raycast({ x: 0.5, y: 5.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5);
  assert.equal(hit, null);
});

test("raycast ignores water (non-solid) and finds the block behind it", () => {
  const world = blankWorld(4, 10);
  world.setBlock(3, 5, 5, BLOCKS.WATER);
  world.setBlock(4, 5, 5, BLOCKS.STONE);
  const hit = world.raycast({ x: 0.5, y: 5.5, z: 5.5 }, { x: 1, y: 0, z: 0 }, 10);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [4, 5, 5]);
});

test("evictFarChunks drops unedited chunks beyond keepRadius", () => {
  const world = new World(1, { chunkSize: 8, chunkHeight: 16 });
  world.getOrCreateChunk(0, 0);
  world.getOrCreateChunk(10, 0);
  const evicted = world.evictFarChunks(0, 0, 2);
  assert.equal(evicted, 1);
  assert.equal(world.getChunk(0, 0) !== undefined, true);
  assert.equal(world.getChunk(10, 0), undefined);
});

test("evictFarChunks never drops a dirty (edited) chunk, however far", () => {
  const world = new World(1, { chunkSize: 8, chunkHeight: 16 });
  world.setBlock(80, 1, 0, BLOCKS.STONE); // far chunk, but edited
  const evicted = world.evictFarChunks(0, 0, 2);
  assert.equal(evicted, 0);
  assert.notEqual(world.getChunk(10, 0), undefined);
  assert.equal(world.getBlock(80, 1, 0), BLOCKS.STONE);
});

test("an evicted chunk regenerates identically to before eviction", () => {
  const world = new World(4, { chunkSize: 8, chunkHeight: 24 });
  const before = world.getBlock(40, 5, 40);
  world.evictFarChunks(0, 0, 1);
  assert.equal(world.getChunk(5, 5), undefined); // confirm it was actually evicted
  assert.equal(world.getBlock(40, 5, 40), before);
});

test("raycast finds a block across a chunk boundary", () => {
  const world = blankWorld(4, 10); // chunk size 4, so x=20 is chunk 5, far from origin's chunk 0
  world.setBlock(20, 5, 5, BLOCKS.STONE);
  const hit = world.raycast({ x: 0.5, y: 5.5, z: 5.5 }, { x: 1, y: 0, z: 0 }, 25);
  assert.ok(hit);
  assert.deepEqual([hit.x, hit.y, hit.z], [20, 5, 5]);
});
