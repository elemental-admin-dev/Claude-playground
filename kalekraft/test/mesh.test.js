import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { buildChunkMeshData, faceCategory, localFaceUV } from "../public/mesh.js";
import { BLOCKS } from "../public/blocks.js";
import { KINDS } from "../public/textures.js";

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

test("a textured block emits a uv per vertex within its own atlas tile", () => {
  const world = blankWorld();
  world.setBlock(1, 1, 1, BLOCKS.GRASS);
  const { opaque } = buildChunkMeshData(world, 0, 0);
  assert.equal(opaque.uvs.length, opaque.quadCount * 4 * 2);
  for (let i = 0; i < opaque.uvs.length; i++) {
    assert.ok(opaque.uvs[i] >= 0 && opaque.uvs[i] <= 1);
  }
});

test("grass uses a different atlas tile per face category (top vs side vs bottom)", () => {
  const world = blankWorld();
  world.setBlock(2, 2, 2, BLOCKS.GRASS);
  const { opaque } = buildChunkMeshData(world, 0, 0);
  // each face is 4 verts * 2 floats = 8 uv values in emission order matching FACES: +x,-x,+y(top),-y(bottom),+z,-z
  const uAt = (faceIndex) => opaque.uvs[faceIndex * 8];
  const topTile = KINDS.indexOf("grass-top");
  const bottomTile = KINDS.indexOf("dirt");
  const sideTile = KINDS.indexOf("grass-side");
  assert.equal(Math.floor(uAt(2) * KINDS.length), topTile); // +y face
  assert.equal(Math.floor(uAt(3) * KINDS.length), bottomTile); // -y face
  assert.equal(Math.floor(uAt(0) * KINDS.length), sideTile); // +x face
});

test("water (untextured) still emits a valid, in-range uv per vertex", () => {
  const world = blankWorld();
  world.setBlock(1, 1, 1, BLOCKS.WATER);
  const { water } = buildChunkMeshData(world, 0, 0);
  assert.equal(water.uvs.length, water.quadCount * 4 * 2);
  for (const v of water.uvs) assert.ok(v >= 0 && v <= 1);
});

test("faceCategory maps +y/-y to top/bottom and everything else to side", () => {
  assert.equal(faceCategory([0, 1, 0]), "top");
  assert.equal(faceCategory([0, -1, 0]), "bottom");
  for (const dir of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
    assert.equal(faceCategory(dir), "side");
  }
});

test("localFaceUV maps a side face's corner height directly to v", () => {
  assert.deepEqual(localFaceUV([1, 0, 0], [1, 0, 0]), [0, 0]);
  assert.deepEqual(localFaceUV([1, 0, 0], [1, 1, 0]), [0, 1]);
});
