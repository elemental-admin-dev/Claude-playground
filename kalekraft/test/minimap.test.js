import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../public/world.js";
import { BLOCKS, BLOCK_INFO } from "../public/blocks.js";
import { VOID_COLOR, surfaceBlockAt, minimapColor, buildMinimapGrid } from "../public/minimap.js";

function emptyWorld() {
  return new World(0, { chunkSize: 10, chunkHeight: 10, autoGenerate: false });
}

test("surfaceBlockAt returns AIR for an empty column", () => {
  const world = emptyWorld();
  assert.equal(surfaceBlockAt(world, 3, 3), BLOCKS.AIR);
});

test("surfaceBlockAt finds the topmost non-air block in a column", () => {
  const world = emptyWorld();
  world.setBlock(3, 1, 3, BLOCKS.STONE);
  world.setBlock(3, 4, 3, BLOCKS.GRASS);
  world.setBlock(3, 2, 3, BLOCKS.DIRT);
  assert.equal(surfaceBlockAt(world, 3, 3), BLOCKS.GRASS);
});

test("surfaceBlockAt treats water as a visible surface, not something to see through", () => {
  const world = emptyWorld();
  world.setBlock(3, 1, 3, BLOCKS.STONE);
  world.setBlock(3, 5, 3, BLOCKS.WATER);
  assert.equal(surfaceBlockAt(world, 3, 3), BLOCKS.WATER);
});

test("minimapColor returns each block's existing render color", () => {
  assert.deepEqual(minimapColor(BLOCKS.GRASS), BLOCK_INFO[BLOCKS.GRASS].color);
  assert.deepEqual(minimapColor(BLOCKS.WATER), BLOCK_INFO[BLOCKS.WATER].color);
});

test("minimapColor falls back to the void color for air or an unknown id", () => {
  assert.deepEqual(minimapColor(BLOCKS.AIR), VOID_COLOR);
  assert.deepEqual(minimapColor(9999), VOID_COLOR);
});

test("buildMinimapGrid returns a (2*radius+1)^2 grid", () => {
  const world = emptyWorld();
  const grid = buildMinimapGrid(world, 5, 5, 3);
  assert.equal(grid.length, 7 * 7);
  for (const color of grid) assert.equal(color.length, 3);
});

test("buildMinimapGrid places the center column's color at the grid's center cell", () => {
  const world = emptyWorld();
  world.setBlock(5, 1, 5, BLOCKS.SAND);
  const radius = 2;
  const grid = buildMinimapGrid(world, 5, 5, radius);
  const size = radius * 2 + 1;
  const centerIndex = radius * size + radius; // row=radius, col=radius
  assert.deepEqual(grid[centerIndex], BLOCK_INFO[BLOCKS.SAND].color);
});

test("buildMinimapGrid rounds a fractional center down to its containing column", () => {
  const world = emptyWorld();
  world.setBlock(5, 1, 5, BLOCKS.BRICK);
  const radius = 1;
  const grid = buildMinimapGrid(world, 5.7, 5.2, radius);
  const size = radius * 2 + 1;
  assert.deepEqual(grid[radius * size + radius], BLOCK_INFO[BLOCKS.BRICK].color);
});

test("buildMinimapGrid lays out columns row-major, north-to-south then west-to-east", () => {
  const world = emptyWorld();
  world.setBlock(4, 1, 4, BLOCKS.STONE); // (dx=-1, dz=-1) relative to center (5,5)
  world.setBlock(6, 1, 6, BLOCKS.WOOD); // (dx=+1, dz=+1)
  const radius = 1;
  const grid = buildMinimapGrid(world, 5, 5, radius);
  const size = radius * 2 + 1; // 3
  assert.deepEqual(grid[0 * size + 0], BLOCK_INFO[BLOCKS.STONE].color); // top-left: -z, -x
  assert.deepEqual(grid[2 * size + 2], BLOCK_INFO[BLOCKS.WOOD].color); // bottom-right: +z, +x
});
