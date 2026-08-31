import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_LENGTH_SECONDS,
  timeOfDay,
  sunHeight,
  sunDirection,
  ambientIntensity,
  sunIntensity,
  skyColor,
  lerp,
  clamp01,
} from "../public/daynight.js";

test("clamp01 clamps to [0, 1]", () => {
  assert.equal(clamp01(-5), 0);
  assert.equal(clamp01(5), 1);
  assert.equal(clamp01(0.4), 0.4);
});

test("lerp interpolates linearly and hits both endpoints", () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test("timeOfDay wraps into [0, 1) for multiples of the day length", () => {
  assert.equal(timeOfDay(0), 0);
  assert.ok(Math.abs(timeOfDay(DAY_LENGTH_SECONDS) - 0) < 1e-9);
  assert.ok(Math.abs(timeOfDay(DAY_LENGTH_SECONDS * 3) - 0) < 1e-9);
  assert.ok(Math.abs(timeOfDay(DAY_LENGTH_SECONDS * 1.5) - 0.5) < 1e-9);
});

test("timeOfDay handles negative elapsed time (never returns a negative fraction)", () => {
  const t = timeOfDay(-10, 100);
  assert.ok(t >= 0 && t < 1);
  assert.ok(Math.abs(t - 0.9) < 1e-9);
});

test("timeOfDay respects a custom day length", () => {
  assert.ok(Math.abs(timeOfDay(50, 100) - 0.5) < 1e-9);
});

test("sunHeight peaks at noon (t=0.5) and troughs at midnight (t=0)", () => {
  assert.ok(Math.abs(sunHeight(0.5) - 1) < 1e-9);
  assert.ok(Math.abs(sunHeight(0) - -1) < 1e-9);
});

test("sunHeight crosses zero at sunrise (t=0.25) and sunset (t=0.75)", () => {
  assert.ok(Math.abs(sunHeight(0.25)) < 1e-9);
  assert.ok(Math.abs(sunHeight(0.75)) < 1e-9);
});

test("sunDirection points upward at noon and downward at midnight", () => {
  assert.ok(sunDirection(0.5).y > 0.9);
  assert.ok(sunDirection(0).y < -0.9);
});

test("ambient and sun intensity are both higher at noon than at midnight", () => {
  assert.ok(ambientIntensity(0.5) > ambientIntensity(0));
  assert.ok(sunIntensity(0.5) > sunIntensity(0));
});

test("sun intensity is exactly zero deep in the night, not just dim", () => {
  assert.equal(sunIntensity(0), 0);
  assert.equal(sunIntensity(0.05), 0);
});

test("ambient intensity never goes fully dark - there's always a little visibility", () => {
  for (let t = 0; t < 1; t += 0.05) {
    assert.ok(ambientIntensity(t) > 0);
  }
});

test("intensities and sky color are continuous across the midnight wraparound (t=0 vs t=1)", () => {
  // t doesn't naturally reach exactly 1 (timeOfDay stays in [0,1)), but the
  // functions should still agree at the seam so there's no visible pop.
  assert.ok(Math.abs(ambientIntensity(0) - ambientIntensity(1)) < 1e-9);
  assert.ok(Math.abs(sunIntensity(0) - sunIntensity(1)) < 1e-9);
  const midnight = skyColor(0);
  const alsoMidnight = skyColor(1);
  assert.ok(Math.abs(midnight.r - alsoMidnight.r) < 1e-9);
  assert.ok(Math.abs(midnight.g - alsoMidnight.g) < 1e-9);
  assert.ok(Math.abs(midnight.b - alsoMidnight.b) < 1e-9);
});

test("sky color is darker at midnight than at noon", () => {
  const midnight = skyColor(0);
  const noon = skyColor(0.5);
  const brightness = (c) => c.r + c.g + c.b;
  assert.ok(brightness(midnight) < brightness(noon));
});

test("sky color components always stay within [0, 1]", () => {
  for (let t = 0; t < 1; t += 0.02) {
    const c = skyColor(t);
    for (const channel of [c.r, c.g, c.b]) {
      assert.ok(channel >= 0 && channel <= 1, `channel ${channel} out of range at t=${t}`);
    }
  }
});
