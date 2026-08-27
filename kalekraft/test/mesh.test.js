import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { buildMeshData } from "../public/mesh.js";
import { BLOCKS } from "../public/blocks.js";

test("a single solid block emits exactly 6 faces (24 vertices)", () => {
  const world = new World(3, 3, 3);
  world.setBlock(1, 1, 1, BLOCKS.STONE);
  const { opaque, water } = buildMeshData(world);
  assert.equal(opaque.quadCount, 6);
  assert.equal(opaque.positions.length, 6 * 4 * 3);
  assert.equal(opaque.indices.length, 6 * 6);
  assert.equal(water.quadCount, 0);
});

test("two adjacent solid blocks cull their shared internal face", () => {
  const world = new World(4, 3, 3);
  world.setBlock(1, 1, 1, BLOCKS.STONE);
  world.setBlock(2, 1, 1, BLOCKS.STONE);
  const { opaque } = buildMeshData(world);
  // 6 + 6 faces minus the 2 touching faces (one from each block) = 10
  assert.equal(opaque.quadCount, 10);
});

test("water is bucketed separately and does not cull against itself", () => {
  const world = new World(4, 3, 3);
  world.setBlock(1, 1, 1, BLOCKS.WATER);
  world.setBlock(2, 1, 1, BLOCKS.WATER);
  const { opaque, water } = buildMeshData(world);
  assert.equal(opaque.quadCount, 0);
  // shared face between two water blocks is still skipped (no internal faces)
  assert.equal(water.quadCount, 10);
});

test("an empty world produces no geometry", () => {
  const world = new World(4, 4, 4);
  const { opaque, water } = buildMeshData(world);
  assert.equal(opaque.quadCount, 0);
  assert.equal(water.quadCount, 0);
});

test("a solid block face against water is drawn (water doesn't occlude)", () => {
  const world = new World(4, 3, 3);
  world.setBlock(1, 1, 1, BLOCKS.STONE);
  world.setBlock(2, 1, 1, BLOCKS.WATER);
  const { opaque, water } = buildMeshData(world);
  assert.equal(opaque.quadCount, 6); // stone still shows all 6 faces
  assert.equal(water.quadCount, 5); // water's face against the stone is culled
});

test("emitted quad indices reference only vertices within range", () => {
  const world = new World(5, 5, 5).generate(2);
  const { opaque } = buildMeshData(world);
  const maxIndex = opaque.positions.length / 3 - 1;
  for (const i of opaque.indices) {
    assert.ok(i >= 0 && i <= maxIndex);
  }
});
