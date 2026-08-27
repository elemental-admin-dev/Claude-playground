// Pure, chunk-agnostic terrain rules: given a world (x, z) column and a
// seed, these always produce the same answer regardless of which chunk (or
// generation order) is asking. That's what lets neighboring chunks agree on
// a tree that straddles their shared border without needing each other to
// exist yet.

import { fbm2D } from "./noise.js";

const WATER_LEVEL = 14;

function properMod(n, m) {
  return ((n % m) + m) % m;
}

/** Surface height (inclusive, the topmost solid block) at a world column. */
function heightAt(worldX, worldZ, seed, chunkHeight) {
  const n = fbm2D(worldX, worldZ, seed, { octaves: 4, persistence: 0.5, lacunarity: 2, scale: 0.02 });
  const amplitude = chunkHeight - WATER_LEVEL - 9;
  return Math.floor(n * amplitude) + WATER_LEVEL + 3;
}

/** Trunk height of a tree rooted at this column, or 0 if none grows here. */
function treeRootTrunkHeight(worldX, worldZ, seed) {
  const roll = fbm2D(worldX, worldZ, seed + 9999, { octaves: 1, scale: 1 });
  if (roll < 0.965) return 0;
  return 3 + properMod(worldX * 31 + worldZ * 17, 2);
}

export { WATER_LEVEL, heightAt, treeRootTrunkHeight };
