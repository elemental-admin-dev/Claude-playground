"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createBoard, toArray } = require("../lib/board");
const { serializeState, deserializeState } = require("../lib/persistence");

test("round-trips a board's cells, tick number, and next-tick time", () => {
  const board = createBoard(10, 8, [
    [1, 1],
    [2, 2],
    [3, 1],
  ]);
  const json = serializeState(board, 7, 123456789);
  const restored = deserializeState(json);

  assert.equal(restored.board.width, 10);
  assert.equal(restored.board.height, 8);
  assert.equal(restored.tickNumber, 7);
  assert.equal(restored.nextTickAt, 123456789);
  assert.deepEqual(
    toArray(restored.board).sort(),
    toArray(board).sort(),
  );
});

test("round-trips an empty board", () => {
  const board = createBoard(5, 5, []);
  const restored = deserializeState(serializeState(board, 0, 0));
  assert.deepEqual(toArray(restored.board), []);
});

test("rejects malformed JSON", () => {
  assert.throws(() => deserializeState("not json"));
});

test("rejects JSON missing required fields", () => {
  assert.throws(() => deserializeState(JSON.stringify({ width: 10, height: 10 })));
});

test("rejects a non-object top level (array, null, primitive)", () => {
  assert.throws(() => deserializeState(JSON.stringify([1, 2, 3])));
  assert.throws(() => deserializeState(JSON.stringify(null)));
  assert.throws(() => deserializeState(JSON.stringify(42)));
});

test("rejects non-positive width/height", () => {
  assert.throws(() =>
    deserializeState(JSON.stringify({ width: 0, height: 10, cells: [], tickNumber: 0, nextTickAt: 0 })),
  );
  assert.throws(() =>
    deserializeState(JSON.stringify({ width: 10, height: -1, cells: [], tickNumber: 0, nextTickAt: 0 })),
  );
});

test("silently drops malformed or out-of-bounds cell entries instead of throwing", () => {
  const restored = deserializeState(
    JSON.stringify({
      width: 5,
      height: 5,
      cells: [
        [1, 1], // valid
        [10, 10], // out of bounds
        [-1, 0], // out of bounds
        "not-a-pair", // malformed
        [1], // wrong length
        [1.5, 2], // non-integer
        null,
      ],
      tickNumber: 0,
      nextTickAt: 0,
    }),
  );
  assert.deepEqual(toArray(restored.board), [[1, 1]]);
});

test("rejects a negative tickNumber", () => {
  assert.throws(() =>
    deserializeState(
      JSON.stringify({ width: 10, height: 10, cells: [], tickNumber: -1, nextTickAt: 0 }),
    ),
  );
});

test("rejects a negative nextTickAt", () => {
  assert.throws(() =>
    deserializeState(
      JSON.stringify({ width: 10, height: 10, cells: [], tickNumber: 0, nextTickAt: -1 }),
    ),
  );
});
