import { BLOCKS } from "./blocks.js";
import { heightAt, treeRootTrunkHeight, WATER_LEVEL } from "./terrain.js";

const TREE_HALO = 2; // a tree's canopy reaches at most 2 blocks from its root column

class Chunk {
  constructor(cx, cz, size, height) {
    this.cx = cx;
    this.cz = cz;
    this.size = size;
    this.height = height;
    this.blocks = new Uint8Array(size * size * height);
    this.dirty = false; // true once a player edit touches this chunk
  }

  inLocalBounds(lx, ly, lz) {
    return lx >= 0 && lx < this.size && ly >= 0 && ly < this.height && lz >= 0 && lz < this.size;
  }

  localIndex(lx, ly, lz) {
    return lx + lz * this.size + ly * this.size * this.size;
  }

  getBlock(lx, ly, lz) {
    if (!this.inLocalBounds(lx, ly, lz)) return BLOCKS.AIR;
    return this.blocks[this.localIndex(lx, ly, lz)];
  }

  setBlock(lx, ly, lz, id) {
    if (!this.inLocalBounds(lx, ly, lz)) return false;
    this.blocks[this.localIndex(lx, ly, lz)] = id;
    return true;
  }

  /** Fills terrain for this chunk's own columns, then trees rooted nearby (own or neighboring chunk) that overhang into it. */
  generate(seed) {
    const originX = this.cx * this.size;
    const originZ = this.cz * this.size;

    for (let lx = 0; lx < this.size; lx++) {
      for (let lz = 0; lz < this.size; lz++) {
        const wx = originX + lx;
        const wz = originZ + lz;
        const surface = Math.min(heightAt(wx, wz, seed, this.height), this.height - 1);
        for (let ly = 0; ly < this.height; ly++) {
          let id = BLOCKS.AIR;
          if (ly === 0) id = BLOCKS.BEDROCK;
          else if (ly < surface - 3) id = BLOCKS.STONE;
          else if (ly < surface) id = BLOCKS.DIRT;
          else if (ly === surface) id = surface <= WATER_LEVEL ? BLOCKS.SAND : BLOCKS.GRASS;
          else if (ly <= WATER_LEVEL) id = BLOCKS.WATER;
          this.blocks[this.localIndex(lx, ly, lz)] = id;
        }
      }
    }

    this._paintOverhangingTrees(seed, originX, originZ);
    return this;
  }

  _paintOverhangingTrees(seed, originX, originZ) {
    for (let wx = originX - TREE_HALO; wx < originX + this.size + TREE_HALO; wx++) {
      for (let wz = originZ - TREE_HALO; wz < originZ + this.size + TREE_HALO; wz++) {
        const trunkHeight = treeRootTrunkHeight(wx, wz, seed);
        if (!trunkHeight) continue;
        const surface = Math.min(heightAt(wx, wz, seed, this.height), this.height - 1);
        if (surface <= WATER_LEVEL) continue; // trees only take root on dry grass
        this._paintTree(wx, surface + 1, wz, trunkHeight, originX, originZ);
      }
    }
  }

  _paintTree(wx, baseY, wz, trunkHeight, originX, originZ) {
    for (let i = 0; i < trunkHeight; i++) {
      this._paintIfLocal(wx, baseY + i, wz, BLOCKS.WOOD, originX, originZ, false);
    }
    const canopyY = baseY + trunkHeight;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          this._paintIfLocal(wx + dx, canopyY + dy, wz + dz, BLOCKS.LEAVES, originX, originZ, true);
        }
      }
    }
  }

  _paintIfLocal(wx, wy, wz, id, originX, originZ, onlyIfAir) {
    const lx = wx - originX;
    const lz = wz - originZ;
    if (!this.inLocalBounds(lx, wy, lz)) return;
    if (onlyIfAir && this.getBlock(lx, wy, lz) !== BLOCKS.AIR) return;
    this.setBlock(lx, wy, lz, id);
  }
}

export { Chunk };
