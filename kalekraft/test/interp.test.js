import test from "node:test";
import assert from "node:assert/strict";
import { damp, wrapAngle, dampAngle } from "../public/interp.js";

test("damp with dt=0 doesn't move at all", () => {
  assert.equal(damp(0, 10, 8, 0), 0);
});

test("damp moves toward the target, never overshooting it", () => {
  const next = damp(0, 10, 8, 0.1);
  assert.ok(next > 0 && next < 10);
});

test("damp approaches (but never exactly reaches) the target over time", () => {
  let value = 0;
  for (let i = 0; i < 300; i++) value = damp(value, 10, 8, 1 / 60);
  assert.ok(Math.abs(value - 10) < 0.01);
  assert.notEqual(value, 10);
});

test("damp is frame-rate independent: many small steps ~= one big step covering the same time", () => {
  let stepped = 0;
  for (let i = 0; i < 10; i++) stepped = damp(stepped, 10, 5, 0.01);
  const jumped = damp(0, 10, 5, 0.1);
  assert.ok(Math.abs(stepped - jumped) < 1e-6);
});

test("damp with negative delta (target below current) also approaches without overshoot", () => {
  const next = damp(10, 0, 8, 0.1);
  assert.ok(next < 10 && next > 0);
});

test("wrapAngle keeps values already in range unchanged", () => {
  assert.ok(Math.abs(wrapAngle(0) - 0) < 1e-9);
  assert.ok(Math.abs(wrapAngle(1) - 1) < 1e-9);
});

test("wrapAngle brings an out-of-range angle back into (-PI, PI]", () => {
  const wrapped = wrapAngle(3 * Math.PI); // == PI, wrapped
  assert.ok(Math.abs(wrapped - Math.PI) < 1e-9);
});

test("dampAngle turns the short way across the -PI/PI boundary", () => {
  const almostPi = Math.PI - 0.1;
  const almostNegPi = -Math.PI + 0.1;
  // going from almostPi toward almostNegPi the short way increases the angle
  // (wrapping past PI), not decreases it by spinning the long way around
  const next = dampAngle(almostPi, almostNegPi, 8, 0.01);
  assert.ok(next > almostPi || next < -almostPi + 0.001);
});

test("dampAngle converges to the target angle over time, wraparound included", () => {
  let angle = Math.PI - 0.05;
  const target = -Math.PI + 0.05;
  for (let i = 0; i < 300; i++) angle = dampAngle(angle, target, 8, 1 / 60);
  assert.ok(Math.abs(wrapAngle(angle - target)) < 0.01);
});
