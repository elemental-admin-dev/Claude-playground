"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { screenToCell, inBounds } = require("../public/coords.js");

test("screenToCell maps a point at the canvas origin to cell (0, 0)", () => {
  const rect = { left: 0, top: 0, width: 120, height: 120 };
  assert.deepEqual(screenToCell(0, 0, rect, 120, 120, 12), { x: 0, y: 0 });
});

test("screenToCell maps a point in the middle of a cell to that cell, not the next one", () => {
  const rect = { left: 0, top: 0, width: 120, height: 120 };
  // cell size 12: point (17, 29) is in cell (1, 2) -> floor(17/12)=1, floor(29/12)=2
  assert.deepEqual(screenToCell(17, 29, rect, 120, 120, 12), { x: 1, y: 2 });
});

test("screenToCell accounts for the canvas's rect offset on the page", () => {
  const rect = { left: 50, top: 100, width: 120, height: 120 };
  assert.deepEqual(screenToCell(50, 100, rect, 120, 120, 12), { x: 0, y: 0 });
  assert.deepEqual(screenToCell(62, 112, rect, 120, 120, 12), { x: 1, y: 1 });
});

test("screenToCell accounts for CSS scaling (rect size differs from canvas pixel size)", () => {
  // canvas is 120x120 pixels but displayed at 60x60 CSS pixels (max-width: 100% shrank it) -> 2x scale factor
  const rect = { left: 0, top: 0, width: 60, height: 60 };
  assert.deepEqual(screenToCell(6, 6, rect, 120, 120, 12), { x: 1, y: 1 });
});

test("inBounds is true inside the grid and false outside it, including negative coords", () => {
  assert.equal(inBounds(0, 0, 10, 10), true);
  assert.equal(inBounds(9, 9, 10, 10), true);
  assert.equal(inBounds(10, 5, 10, 10), false);
  assert.equal(inBounds(5, 10, 10, 10), false);
  assert.equal(inBounds(-1, 5, 10, 10), false);
  assert.equal(inBounds(5, -1, 10, 10), false);
});
