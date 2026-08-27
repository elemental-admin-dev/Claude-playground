import test from "node:test";
import assert from "node:assert/strict";
import { heightAt, treeRootTrunkHeight, WATER_LEVEL } from "../public/terrain.js";

test("heightAt is deterministic for a given seed and column", () => {
  assert.equal(heightAt(12, -7, 5, 48), heightAt(12, -7, 5, 48));
});

test("heightAt stays within the chunk's vertical range", () => {
  for (let x = -50; x < 50; x += 7) {
    for (let z = -50; z < 50; z += 11) {
      const h = heightAt(x, z, 3, 48);
      assert.ok(h >= 0 && h < 48, `height ${h} out of range at (${x},${z})`);
    }
  }
});

test("heightAt differs by seed (almost always)", () => {
  let differed = false;
  for (let x = 0; x < 20; x++) {
    if (heightAt(x, 0, 1, 48) !== heightAt(x, 0, 2, 48)) {
      differed = true;
      break;
    }
  }
  assert.ok(differed);
});

test("treeRootTrunkHeight is deterministic and only 0, 3, or 4", () => {
  for (let x = -30; x < 30; x++) {
    for (let z = -30; z < 30; z += 5) {
      const h = treeRootTrunkHeight(x, z, 1);
      assert.ok(h === 0 || h === 3 || h === 4, `unexpected trunk height ${h}`);
      assert.equal(h, treeRootTrunkHeight(x, z, 1));
    }
  }
});

test("treeRootTrunkHeight is sparse, not on every column", () => {
  let treeCount = 0;
  for (let x = 0; x < 200; x++) {
    if (treeRootTrunkHeight(x, 0, 1) > 0) treeCount++;
  }
  assert.ok(treeCount > 0 && treeCount < 40, `expected a sparse scatter, got ${treeCount}/200`);
});

test("WATER_LEVEL is a sane fraction of a typical chunk height", () => {
  assert.ok(WATER_LEVEL > 0 && WATER_LEVEL < 48);
});
