// Pure top-down minimap logic: for each world column, find the topmost
// non-air block and its render color. No canvas/DOM dependency, so it's
// testable without a browser; main.js turns the resulting grid into pixels.

import { BLOCKS, BLOCK_INFO } from "./blocks.js";

// A column with nothing in it at all (shouldn't normally happen above
// bedrock, but keeps the function total) renders as a neutral void color.
const VOID_COLOR = [0.05, 0.05, 0.08];

/** Scans a column top-down and returns the id of its topmost non-air block. */
function surfaceBlockAt(world, x, z) {
  for (let y = world.chunkHeight - 1; y >= 0; y--) {
    const id = world.getBlock(x, y, z);
    if (id !== BLOCKS.AIR) return id;
  }
  return BLOCKS.AIR;
}

/** Block id -> [r, g, b] in 0..1, reusing each block's existing render color. */
function minimapColor(blockId) {
  return BLOCK_INFO[blockId]?.color ?? VOID_COLOR;
}

/**
 * Builds a (2*radius+1) x (2*radius+1) grid of minimap colors centered on
 * (centerX, centerZ), one entry per world column, row-major from north
 * (-z) to south (+z) and west (-x) to east (+x).
 */
function buildMinimapGrid(world, centerX, centerZ, radius) {
  const size = radius * 2 + 1;
  const grid = new Array(size * size);
  const cx = Math.floor(centerX);
  const cz = Math.floor(centerZ);
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const row = dz + radius;
      const col = dx + radius;
      grid[row * size + col] = minimapColor(surfaceBlockAt(world, cx + dx, cz + dz));
    }
  }
  return grid;
}

export { VOID_COLOR, surfaceBlockAt, minimapColor, buildMinimapGrid };
