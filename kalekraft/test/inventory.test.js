import test from "node:test";
import assert from "node:assert/strict";
import { Inventory } from "../public/inventory.js";

test("a fresh inventory has zero of everything", () => {
  const inv = new Inventory();
  assert.equal(inv.count(3), 0);
  assert.equal(inv.has(3, 1), false);
});

test("add increases the count for that block id only", () => {
  const inv = new Inventory();
  inv.add(3);
  inv.add(3);
  inv.add(4, 5);
  assert.equal(inv.count(3), 2);
  assert.equal(inv.count(4), 5);
  assert.equal(inv.count(6), 0);
});

test("remove succeeds and decrements when enough is held", () => {
  const inv = new Inventory();
  inv.add(3, 5);
  assert.equal(inv.remove(3, 2), true);
  assert.equal(inv.count(3), 3);
});

test("remove fails and is a no-op when not enough is held", () => {
  const inv = new Inventory();
  inv.add(3, 1);
  assert.equal(inv.remove(3, 2), false);
  assert.equal(inv.count(3), 1); // unchanged
});

test("has reflects the current count against a threshold", () => {
  const inv = new Inventory();
  inv.add(3, 2);
  assert.equal(inv.has(3, 1), true);
  assert.equal(inv.has(3, 2), true);
  assert.equal(inv.has(3, 3), false);
});

test("serialize/deserialize round-trips exactly", () => {
  const inv = new Inventory();
  inv.add(3, 4);
  inv.add(6, 1);
  const restored = Inventory.deserialize(inv.serialize());
  assert.equal(restored.count(3), 4);
  assert.equal(restored.count(6), 1);
});

test("deserialize with no data produces an empty inventory, not a crash", () => {
  const inv = Inventory.deserialize(undefined);
  assert.equal(inv.count(3), 0);
});

test("mutating a deserialized inventory does not affect the original's data", () => {
  const inv = new Inventory();
  inv.add(3, 1);
  const snapshot = inv.serialize();
  const restored = Inventory.deserialize(snapshot);
  restored.add(3, 10);
  assert.equal(inv.count(3), 1);
  assert.equal(snapshot[3], 1);
});
