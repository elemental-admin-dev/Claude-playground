import { Chunk } from "./chunk.js";
import { BLOCKS, isSolid } from "./blocks.js";

const DEFAULT_CHUNK_SIZE = 16;
const DEFAULT_CHUNK_HEIGHT = 48;

function rleEncode(typedArray) {
  const runs = [];
  let current = typedArray[0];
  let count = 0;
  for (let i = 0; i < typedArray.length; i++) {
    if (typedArray[i] === current) {
      count++;
    } else {
      runs.push(current, count);
      current = typedArray[i];
      count = 1;
    }
  }
  runs.push(current, count);
  return runs;
}

function rleDecodeInto(typedArray, runs) {
  let i = 0;
  for (let r = 0; r < runs.length; r += 2) {
    typedArray.fill(runs[r], i, i + runs[r + 1]);
    i += runs[r + 1];
  }
}

/**
 * A chunk-streaming voxel world: chunks are generated on demand (and kept
 * resident once generated, so edits are never lost while the session
 * runs) and terrain is deterministic from (seed, chunk coords) alone, so
 * the world is effectively unbounded in x/z. Only chunks a player has
 * edited need to be saved — everything else regenerates identically from
 * the seed.
 */
class World {
  constructor(seed, { chunkSize = DEFAULT_CHUNK_SIZE, chunkHeight = DEFAULT_CHUNK_HEIGHT, autoGenerate = true } = {}) {
    this.seed = seed;
    this.chunkSize = chunkSize;
    this.chunkHeight = chunkHeight;
    this.autoGenerate = autoGenerate;
    this.chunks = new Map();
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  worldToChunkCoords(x, z) {
    return { cx: Math.floor(x / this.chunkSize), cz: Math.floor(z / this.chunkSize) };
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  getOrCreateChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz, this.chunkSize, this.chunkHeight);
      if (this.autoGenerate) chunk.generate(this.seed);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= this.chunkHeight) return BLOCKS.AIR;
    const { cx, cz } = this.worldToChunkCoords(x, z);
    const chunk = this.getOrCreateChunk(cx, cz);
    return chunk.getBlock(x - cx * this.chunkSize, y, z - cz * this.chunkSize);
  }

  /**
   * Sets a block and returns the chunk coordinates whose mesh may need
   * rebuilding: the edited chunk, plus any neighbor sharing the edited
   * cell's face (a block on a chunk boundary changes what faces the
   * neighboring chunk should draw too). Empty array if y is out of range.
   */
  setBlock(x, y, z, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= this.chunkHeight) return [];
    const { cx, cz } = this.worldToChunkCoords(x, z);
    const chunk = this.getOrCreateChunk(cx, cz);
    const lx = x - cx * this.chunkSize;
    const lz = z - cz * this.chunkSize;
    chunk.setBlock(lx, y, lz, id);
    chunk.dirty = true;

    const affected = [{ cx, cz }];
    if (lx === 0) affected.push({ cx: cx - 1, cz });
    if (lx === this.chunkSize - 1) affected.push({ cx: cx + 1, cz });
    if (lz === 0) affected.push({ cx, cz: cz - 1 });
    if (lz === this.chunkSize - 1) affected.push({ cx, cz: cz + 1 });
    return affected;
  }

  /**
   * Voxel DDA raycast. Returns null if nothing solid is hit within maxDistance,
   * otherwise { x, y, z, normal, place } where `place` is the empty cell just
   * before the hit — where a new block would go.
   */
  raycast(origin, direction, maxDistance = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDelta = {
      x: direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity,
      y: direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity,
      z: direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity,
    };

    const boundary = (pos, step) => (step > 0 ? Math.floor(pos) + 1 - pos : pos - Math.floor(pos));
    let tMax = {
      x: direction.x !== 0 ? boundary(origin.x, stepX) * tDelta.x : Infinity,
      y: direction.y !== 0 ? boundary(origin.y, stepY) * tDelta.y : Infinity,
      z: direction.z !== 0 ? boundary(origin.z, stepZ) * tDelta.z : Infinity,
    };

    let normal = { x: 0, y: 0, z: 0 };
    let traveled = 0;

    while (traveled <= maxDistance) {
      if (isSolid(this.getBlock(x, y, z))) {
        // `normal` points back toward the ray origin, so stepping along it
        // from the hit cell lands on the empty cell the ray passed through.
        const place = { x: x + normal.x, y: y + normal.y, z: z + normal.z };
        return { x, y, z, normal, place };
      }

      if (tMax.x < tMax.y && tMax.x < tMax.z) {
        x += stepX;
        traveled = tMax.x;
        tMax.x += tDelta.x;
        normal = { x: -stepX, y: 0, z: 0 };
      } else if (tMax.y < tMax.z) {
        y += stepY;
        traveled = tMax.y;
        tMax.y += tDelta.y;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        traveled = tMax.z;
        tMax.z += tDelta.z;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
    return null;
  }

  /** Only edited ("dirty") chunks are saved; everything else regenerates identically from the seed. */
  serialize() {
    const dirtyChunks = [];
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      dirtyChunks.push({ cx: chunk.cx, cz: chunk.cz, runs: rleEncode(chunk.blocks) });
    }
    return { seed: this.seed, chunkSize: this.chunkSize, chunkHeight: this.chunkHeight, dirtyChunks };
  }

  static deserialize(data) {
    const world = new World(data.seed, { chunkSize: data.chunkSize, chunkHeight: data.chunkHeight });
    for (const saved of data.dirtyChunks) {
      const chunk = new Chunk(saved.cx, saved.cz, data.chunkSize, data.chunkHeight);
      rleDecodeInto(chunk.blocks, saved.runs);
      chunk.dirty = true;
      world.chunks.set(world.chunkKey(saved.cx, saved.cz), chunk);
    }
    return world;
  }
}

export { World };
