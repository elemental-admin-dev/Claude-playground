// Pure top-down minimap logic: for each world column, find the topmost
// non-air block and its render color. No canvas/DOM dependency, so it's
// testable without a browser; main.js turns the resulting grid into pixels.

import { BLOCKS, BLOCK_INFO } from "./blocks.js";

// A column with nothing in it at all (shouldn't normally happen above
// bedrock, but keeps the function total) renders as a neutral void color -
// also used for a column whose chunk hasn't generated yet (see
// buildMinimapGrid), so an unexplored area reads as "unknown" rather than
// forcing generation just to answer the minimap's question.
const VOID_COLOR = [0.05, 0.05, 0.08];

/**
 * Scans a column top-down for the first non-air block at y >= minY.
 * Returns { y, id } or null if the whole scanned range is air. Shared by
 * the minimap (wants the block id) and main.js's spawn-height lookup
 * (wants the y), so the two don't drift apart with separate copies of the
 * same loop.
 */
function findTopmostNonAir(world, x, z, minY = 0) {
  for (let y = world.chunkHeight - 1; y >= minY; y--) {
    const id = world.getBlock(x, y, z);
    if (id !== BLOCKS.AIR) return { y, id };
  }
  return null;
}

/** Scans a column top-down and returns the id of its topmost non-air block. */
function surfaceBlockAt(world, x, z) {
  return findTopmostNonAir(world, x, z)?.id ?? BLOCKS.AIR;
}

/** Block id -> [r, g, b] in 0..1, reusing each block's existing render color. */
function minimapColor(blockId) {
  return BLOCK_INFO[blockId]?.color ?? VOID_COLOR;
}

/** True if the chunk containing (x, z) already exists - i.e. reading it won't force-generate it. */
function isColumnLoaded(world, x, z) {
  const { cx, cz } = world.worldToChunkCoords(x, z);
  return world.getChunk(cx, cz) !== undefined;
}

/**
 * Builds a (2*radius+1) x (2*radius+1) grid of minimap colors centered on
 * (centerX, centerZ), one entry per world column, row-major from north
 * (-z) to south (+z) and west (-x) to east (+x).
 *
 * Columns in a chunk that hasn't generated yet render as VOID_COLOR
 * instead of triggering generation: the normal chunk-streaming path
 * already budgets how many chunks generate per frame (see
 * updateChunkStreaming/processChunkQueue in main.js) specifically to
 * avoid a hitch when entering a new area, and a periodic minimap rescan
 * touching every not-yet-generated chunk in its radius at once would
 * bypass that budget.
 */
function buildMinimapGrid(world, centerX, centerZ, radius) {
  const size = radius * 2 + 1;
  const grid = new Array(size * size);
  const cx = Math.floor(centerX);
  const cz = Math.floor(centerZ);
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const wx = cx + dx;
      const wz = cz + dz;
      const row = dz + radius;
      const col = dx + radius;
      grid[row * size + col] = isColumnLoaded(world, wx, wz) ? minimapColor(surfaceBlockAt(world, wx, wz)) : VOID_COLOR;
    }
  }
  return grid;
}

export { VOID_COLOR, findTopmostNonAir, surfaceBlockAt, minimapColor, isColumnLoaded, buildMinimapGrid };
