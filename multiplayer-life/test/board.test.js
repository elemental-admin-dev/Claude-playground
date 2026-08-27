"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBoard, toggleCell, step, isAlive, inBounds, toArray } = require("../lib/board");

test("toggleCell adds a dead cell and reports it alive", () => {
  const board = createBoard(5, 5);
  const alive = toggleCell(board, 2, 2);
  assert.equal(alive, true);
  assert.equal(isAlive(board, 2, 2), true);
});

test("toggleCell removes a live cell and reports it dead", () => {
  const board = createBoard(5, 5, [[2, 2]]);
  const alive = toggleCell(board, 2, 2);
  assert.equal(alive, false);
  assert.equal(isAlive(board, 2, 2), false);
});

test("toggleCell rejects out-of-bounds coordinates", () => {
  const board = createBoard(5, 5);
  assert.throws(() => toggleCell(board, -1, 0), RangeError);
  assert.throws(() => toggleCell(board, 5, 0), RangeError);
});

test("a lonely cell dies", () => {
  const board = createBoard(5, 5, [[2, 2]]);
  const next = step(board);
  assert.equal(isAlive(next, 2, 2), false);
});

test("a block still life is stable", () => {
  const block = [[1, 1], [1, 2], [2, 1], [2, 2]];
  const board = createBoard(5, 5, block);
  const next = step(board);
  assert.deepEqual(toArray(next).sort(), block.sort());
});

test("a blinker oscillates with period two", () => {
  const horizontal = [[1, 2], [2, 2], [3, 2]];
  const vertical = [[2, 1], [2, 2], [2, 3]];
  const board = createBoard(5, 5, horizontal);
  const afterOne = step(board);
  assert.deepEqual(toArray(afterOne).sort(), vertical.sort());
  const afterTwo = step(afterOne);
  assert.deepEqual(toArray(afterTwo).sort(), horizontal.sort());
});

test("a dead cell with exactly three neighbors is born", () => {
  const board = createBoard(5, 5, [[1, 1], [1, 2], [2, 1]]);
  const next = step(board);
  assert.equal(isAlive(next, 2, 2), true);
});

test("step never produces cells outside the board", () => {
  const board = createBoard(3, 3, [[0, 0], [0, 1], [1, 0]]);
  const next = step(board);
  for (const [x, y] of toArray(next)) {
    assert.equal(inBounds(next, x, y), true);
  }
});
