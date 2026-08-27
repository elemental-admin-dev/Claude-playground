import { fbm2D } from "./noise.js";
import { BLOCKS, isSolid } from "./blocks.js";

const WATER_LEVEL = 10;

class World {
  constructor(width, height, depth) {
    this.width = width;
    this.height = height; // vertical
    this.depth = depth;
    this.blocks = new Uint8Array(width * height * depth);
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  index(x, y, z) {
    return x + z * this.width + y * this.width * this.depth;
  }

  getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (!this.inBounds(x, y, z)) return BLOCKS.AIR;
    return this.blocks[this.index(x, y, z)];
  }

  /** Returns false (no-op) for an out-of-bounds coordinate, true otherwise. */
  setBlock(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    this.blocks[this.index(x, y, z)] = id;
    return true;
  }

  heightAt(x, z, seed) {
    const n = fbm2D(x, z, seed, { octaves: 4, persistence: 0.5, lacunarity: 2, scale: 0.02 });
    return Math.floor(n * (this.height - WATER_LEVEL - 6)) + WATER_LEVEL + 2;
  }

  generate(seed = 1) {
    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.depth; z++) {
        const surface = Math.min(this.heightAt(x, z, seed), this.height - 1);
        for (let y = 0; y < this.height; y++) {
          let id = BLOCKS.AIR;
          if (y === 0) {
            id = BLOCKS.BEDROCK;
          } else if (y < surface - 3) {
            id = BLOCKS.STONE;
          } else if (y < surface) {
            id = BLOCKS.DIRT;
          } else if (y === surface) {
            id = surface <= WATER_LEVEL ? BLOCKS.SAND : BLOCKS.GRASS;
          } else if (y <= WATER_LEVEL) {
            id = BLOCKS.WATER;
          }
          this.blocks[this.index(x, y, z)] = id;
        }
      }
    }
    this._scatterTrees(seed);
    return this;
  }

  _scatterTrees(seed) {
    for (let x = 2; x < this.width - 2; x++) {
      for (let z = 2; z < this.depth - 2; z++) {
        const surface = Math.min(this.heightAt(x, z, seed), this.height - 1);
        if (surface <= WATER_LEVEL) continue;
        if (this.getBlock(x, surface, z) !== BLOCKS.GRASS) continue;
        const roll = fbm2D(x, z, seed + 9999, { octaves: 1, scale: 1 });
        if (roll < 0.965) continue;
        this._plantTree(x, surface + 1, z);
      }
    }
  }

  _plantTree(x, baseY, z) {
    const trunkHeight = 3 + ((x * 31 + z * 17) % 2);
    for (let i = 0; i < trunkHeight; i++) this.setBlock(x, baseY + i, z, BLOCKS.WOOD);
    const canopyY = baseY + trunkHeight;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const y = canopyY + dy;
          if (!this.inBounds(x + dx, y, z + dz)) continue;
          if (this.getBlock(x + dx, y, z + dz) === BLOCKS.AIR) {
            this.setBlock(x + dx, y, z + dz, BLOCKS.LEAVES);
          }
        }
      }
    }
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

  /** Run-length encoded snapshot, compact for mostly-uniform terrain. */
  serialize() {
    const runs = [];
    let current = this.blocks[0];
    let count = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i] === current) {
        count++;
      } else {
        runs.push(current, count);
        current = this.blocks[i];
        count = 1;
      }
    }
    runs.push(current, count);
    return { width: this.width, height: this.height, depth: this.depth, runs };
  }

  static deserialize(data) {
    const world = new World(data.width, data.height, data.depth);
    let i = 0;
    for (let r = 0; r < data.runs.length; r += 2) {
      const id = data.runs[r];
      const count = data.runs[r + 1];
      world.blocks.fill(id, i, i + count);
      i += count;
    }
    return world;
  }
}

export { World, WATER_LEVEL };
