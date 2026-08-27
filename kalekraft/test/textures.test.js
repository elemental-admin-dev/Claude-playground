import test from "node:test";
import assert from "node:assert/strict";
import { KINDS, TILE_SIZE, pixelColor, tileUV } from "../public/textures.js";

test("pixelColor is deterministic for a given kind and pixel", () => {
  for (const kind of KINDS) {
    assert.deepEqual(pixelColor(kind, 3, 7), pixelColor(kind, 3, 7));
  }
});

test("pixelColor returns valid RGB bytes for every registered kind", () => {
  for (const kind of KINDS) {
    for (let py = 0; py < TILE_SIZE; py += 3) {
      for (let px = 0; px < TILE_SIZE; px += 3) {
        const [r, g, b] = pixelColor(kind, px, py);
        for (const c of [r, g, b]) {
          assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `${kind} (${px},${py}) -> ${c}`);
        }
      }
    }
  }
});

test("an unknown kind falls back to an unmistakable marker color, not a crash", () => {
  assert.deepEqual(pixelColor("not-a-real-kind", 0, 0), [255, 0, 255]);
});

test("grass-side is green near the top and brown lower down (a dirt-capped-by-grass look)", () => {
  const [rTop, gTop] = pixelColor("grass-side", 8, 0);
  const [rBottom, gBottom] = pixelColor("grass-side", 8, TILE_SIZE - 1);
  assert.ok(gTop > rTop); // green-dominant near the top
  assert.ok(rBottom > gBottom); // brown-dominant near the bottom
});

test("tileUV packs each kind into its own non-overlapping horizontal slice", () => {
  const rects = KINDS.map(tileUV);
  for (let i = 0; i < rects.length; i++) {
    assert.equal(rects[i].u0, i / KINDS.length);
    assert.equal(rects[i].u1, (i + 1) / KINDS.length);
    assert.equal(rects[i].v0, 0);
    assert.equal(rects[i].v1, 1);
  }
});

test("tileUV degrades to the first tile for an unregistered kind rather than throwing", () => {
  assert.deepEqual(tileUV("nonexistent"), tileUV(KINDS[0]));
});
