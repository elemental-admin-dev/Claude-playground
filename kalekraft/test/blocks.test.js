import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, BLOCK_INFO, HOTBAR_BLOCKS, isSolid, isOpaque } from "../public/blocks.js";

test("AIR is neither solid nor opaque", () => {
  assert.equal(isSolid(BLOCKS.AIR), false);
  assert.equal(isOpaque(BLOCKS.AIR), false);
});

test("every block in BLOCK_INFO has a name and a color", () => {
  for (const [id, info] of Object.entries(BLOCK_INFO)) {
    assert.equal(typeof info.name, "string", `block ${id} missing a name`);
    assert.ok(Array.isArray(info.color) && info.color.length === 3, `block ${id} missing a color`);
  }
});

test("a block with textures but no explicit transparent flag is both solid and opaque", () => {
  for (const [id, info] of Object.entries(BLOCK_INFO)) {
    if (info.transparent) continue;
    if (info.solid === false) continue;
    assert.equal(isOpaque(Number(id)), true, `${info.name} should be opaque`);
  }
});

test("water and glass are both solid-or-not-but-transparent, matching their intended look", () => {
  assert.equal(isSolid(BLOCKS.WATER), false); // you can walk/fall through water
  assert.equal(isOpaque(BLOCKS.WATER), false); // and see through it

  assert.equal(isSolid(BLOCKS.GLASS), true); // but glass is a real wall...
  assert.equal(isOpaque(BLOCKS.GLASS), false); // ...you can still see through
});

test("every hotbar block is a real, placeable (solid) entry in BLOCK_INFO", () => {
  for (const id of HOTBAR_BLOCKS) {
    assert.ok(BLOCK_INFO[id], `hotbar references unknown block id ${id}`);
    assert.notEqual(BLOCK_INFO[id].solid, false, `${BLOCK_INFO[id].name} in the hotbar should be solid`);
  }
});
