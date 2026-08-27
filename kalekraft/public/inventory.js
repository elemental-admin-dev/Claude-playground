// A simple per-block-id item count. Breaking a block adds one; placing one
// costs one — no infinite hotbar. Pure and serializable, no DOM/THREE.

class Inventory {
  constructor(initial = {}) {
    this.counts = { ...initial };
  }

  count(blockId) {
    return this.counts[blockId] ?? 0;
  }

  add(blockId, n = 1) {
    this.counts[blockId] = this.count(blockId) + n;
  }

  has(blockId, n = 1) {
    return this.count(blockId) >= n;
  }

  /** Removes n of blockId if there are enough; returns false (no-op) otherwise. */
  remove(blockId, n = 1) {
    if (!this.has(blockId, n)) return false;
    this.counts[blockId] -= n;
    return true;
  }

  serialize() {
    return { ...this.counts };
  }

  static deserialize(data) {
    return new Inventory(data ?? {});
  }
}

export { Inventory };
