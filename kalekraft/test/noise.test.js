import test from "node:test";
import assert from "node:assert/strict";
import { valueNoise2D, fbm2D } from "../public/noise.js";

test("valueNoise2D is deterministic for the same seed", () => {
  assert.equal(valueNoise2D(3.2, 7.9, 42), valueNoise2D(3.2, 7.9, 42));
});

test("valueNoise2D differs across seeds (almost always)", () => {
  assert.notEqual(valueNoise2D(3.2, 7.9, 1), valueNoise2D(3.2, 7.9, 2));
});

test("valueNoise2D stays within [0, 1]", () => {
  for (let i = 0; i < 200; i++) {
    const v = valueNoise2D(i * 0.37, i * 1.91, 7);
    assert.ok(v >= 0 && v <= 1, `out of range: ${v}`);
  }
});

test("valueNoise2D is continuous at integer lattice points", () => {
  // At an exact lattice point the smootherstep interpolation collapses to the corner hash.
  const atLattice = valueNoise2D(5, 5, 3);
  const nearLattice = valueNoise2D(5.001, 5.001, 3);
  assert.ok(Math.abs(atLattice - nearLattice) < 0.01);
});

test("fbm2D is deterministic and bounded", () => {
  const a = fbm2D(10.5, -3.2, 99, { octaves: 4 });
  const b = fbm2D(10.5, -3.2, 99, { octaves: 4 });
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 1);
});
