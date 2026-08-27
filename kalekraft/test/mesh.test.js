import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { buildChunkMeshData } from "../public/mesh.js";
import { BLOCKS } from "../public/blocks.js";

function blankWorld(chunkSize = 6, chunkHeight = 6) {
  return new World(0, { chunkSize, chunkHeight, autoGenerate: false });
}

test("a single solid block emits exactly 6 faces (24 vertices)", () => {
  const world = blankWorld();
  world.setBlock(1, 1, 1, BLOCKS.STONE);
  const { opaque, water } = buildChunkMeshData(world, 0, 0);
  assert.equal(opaque.quadCount, 6);
  assert.equal(opaque.positions.length, 6 * 4 * 3);
  assert.equal(opaque.indices.length, 6 * 6);
  assert.equal(water.quadCount, 0);
});

test("two adjacent solid blocks cull their shared internal face", () => {
  const world = blankWorld();
  world.setBlock(1, 1, 1, BLOCKS.STONE);
  world.setBlock(2, 1, 1, BLOCKS.STONE);
  const { opaque } = buildChunkMeshData(world, 0, 0);
  // 6 + 6 faces minus the 2 touching faces (one from each block) = 10
  assert.equal(opaque.quadCount, 10);
});

test("water is bucketed separately and does not cull against itself", () => {
  const world = blankWorld();
  world.setBlock(1, 1, 1, BLOCKS.WATER);
  world.setBlock(2, 1, 1, BLOCKS.WATER);
  const { opaque, water } = buildChunkMeshData(world, 0, 0);
  assert.equal(opaque.quadCount, 0);
  assert.equal(water.quadCount, 10);
});

test("an empty chunk produces no geometry", () => {
  const world = blankWorld();
  const { opaque, water } = buildChunkMeshData(world, 0, 0);
  assert.equal(opaque.quadCount, 0);
  assert.equal(water.quadCount, 0);
});

test("a solid block face against water is drawn (water doesn't occlude)", () => {
  const world = blankWorld();
  world.setBlock(1, 1, 1, BLOCKS.STONE);
  world.setBlock(2, 1, 1, BLOCKS.WATER);
  const { opaque, water } = buildChunkMeshData(world, 0, 0);
  assert.equal(opaque.quadCount, 6); // stone still shows all 6 faces
  assert.equal(water.quadCount, 5); // water's face against the stone is culled
});

test("a face on a chunk boundary is culled against a block in the neighboring chunk", () => {
  const world = blankWorld(4, 6);
  world.setBlock(3, 1, 1, BLOCKS.STONE); // last column of chunk (0,0)
  world.setBlock(4, 1, 1, BLOCKS.STONE); // first column of chunk (1,0)
  const chunk0 = buildChunkMeshData(world, 0, 0);
  const chunk1 = buildChunkMeshData(world, 1, 0);
  assert.equal(chunk0.opaque.quadCount, 5); // +x face culled against chunk 1's block
  assert.equal(chunk1.opaque.quadCount, 5); // -x face culled against chunk 0's block
});

test("emitted quad indices reference only vertices within range", () => {
  const world = new World(2, { chunkSize: 6, chunkHeight: 12 });
  const { opaque } = buildChunkMeshData(world, 0, 0);
  const maxIndex = opaque.positions.length / 3 - 1;
  for (const i of opaque.indices) {
    assert.ok(i >= 0 && i <= maxIndex);
  }
});
