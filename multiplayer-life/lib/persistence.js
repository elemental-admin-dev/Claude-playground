"use strict";

// Pure (no fs) serialize/deserialize for the board's on-disk save format, so
// a restarted server can resume the shared world instead of reseeding it
// randomly. Kept separate from the fs read/write calls in server.js so the
// format itself is unit-testable without touching disk.

const { createBoard, toArray } = require("./board");

function serializeState(board, tickNumber, nextTickAt) {
  return JSON.stringify({
    width: board.width,
    height: board.height,
    cells: toArray(board),
    tickNumber,
    nextTickAt,
  });
}

/**
 * Throws if `json` isn't parseable or is missing/has the wrong type for a
 * required field. Individual malformed or out-of-bounds cell entries are
 * dropped rather than thrown on, so the result can still omit cells that
 * were present but invalid in the input.
 */
function deserializeState(json) {
  const data = JSON.parse(json);
  if (
    typeof data !== "object" ||
    data === null ||
    !Number.isInteger(data.width) ||
    data.width <= 0 ||
    !Number.isInteger(data.height) ||
    data.height <= 0 ||
    !Array.isArray(data.cells) ||
    !Number.isInteger(data.tickNumber) ||
    !Number.isInteger(data.nextTickAt)
  ) {
    throw new Error("invalid saved board state");
  }

  const cells = data.cells.filter(
    (c) =>
      Array.isArray(c) &&
      c.length === 2 &&
      Number.isInteger(c[0]) &&
      Number.isInteger(c[1]) &&
      c[0] >= 0 &&
      c[0] < data.width &&
      c[1] >= 0 &&
      c[1] < data.height,
  );

  return {
    board: createBoard(data.width, data.height, cells),
    tickNumber: data.tickNumber,
    nextTickAt: data.nextTickAt,
  };
}

module.exports = { serializeState, deserializeState };
