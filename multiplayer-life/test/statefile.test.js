"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createBoard, toArray } = require("../lib/board");
const { loadState, saveState } = require("../lib/statefile");

function tempSavePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "multiplayer-life-test-"));
  return path.join(dir, "board-save.json");
}

test("loadState returns a null state (no error) for a missing file", () => {
  const result = loadState(tempSavePath(), 10, 10);
  assert.equal(result.state, null);
  assert.equal(result.error, undefined);
  assert.equal(result.sizeMismatch, undefined);
});

test("loadState returns an error for a corrupt/unparseable file", () => {
  const savePath = tempSavePath();
  fs.writeFileSync(savePath, "not json");
  const result = loadState(savePath, 10, 10);
  assert.equal(result.state, null);
  assert.ok(result.error instanceof Error);
});

test("loadState reports a size mismatch instead of returning a wrongly-sized board", () => {
  const savePath = tempSavePath();
  const board = createBoard(10, 10, [[1, 1]]);
  saveState(savePath, board, 3, 1000);
  const result = loadState(savePath, 20, 20); // different configured size
  assert.equal(result.state, null);
  assert.equal(result.sizeMismatch, true);
});

test("saveState then loadState round-trips the board and tick number", () => {
  const savePath = tempSavePath();
  const board = createBoard(8, 6, [
    [1, 1],
    [2, 2],
  ]);
  saveState(savePath, board, 7, 999999);
  const result = loadState(savePath, 8, 6);
  assert.notEqual(result.state, null);
  assert.equal(result.state.tickNumber, 7);
  assert.deepEqual(toArray(result.state.board).sort(), toArray(board).sort());
});

test("loadState's returned state never carries a nextTickAt field, even though it was saved", () => {
  const savePath = tempSavePath();
  const board = createBoard(5, 5, []);
  saveState(savePath, board, 0, 123456);
  const result = loadState(savePath, 5, 5);
  assert.ok(!("nextTickAt" in result.state));
});

test("saveState leaves no leftover .tmp file after a successful write", () => {
  const savePath = tempSavePath();
  saveState(savePath, createBoard(5, 5, []), 0, 0);
  assert.equal(fs.existsSync(`${savePath}.tmp`), false);
  assert.equal(fs.existsSync(savePath), true);
});

test("saveState overwrites a previous save with the latest state", () => {
  const savePath = tempSavePath();
  saveState(savePath, createBoard(5, 5, [[0, 0]]), 1, 100);
  saveState(savePath, createBoard(5, 5, [[4, 4]]), 2, 200);
  const result = loadState(savePath, 5, 5);
  assert.equal(result.state.tickNumber, 2);
  assert.deepEqual(toArray(result.state.board), [[4, 4]]);
});
