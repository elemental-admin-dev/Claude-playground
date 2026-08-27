"use strict";

const key = (x, y) => `${x},${y}`;

function createBoard(width, height, liveCells = []) {
  const cells = new Set(liveCells.map(([x, y]) => key(x, y)));
  return { width, height, cells };
}

function inBounds(board, x, y) {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

function isAlive(board, x, y) {
  return board.cells.has(key(x, y));
}

function countLiveNeighbors(board, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isAlive(board, x + dx, y + dy)) count++;
    }
  }
  return count;
}

/** Toggle a single cell in place. Returns whether the cell ended up alive. */
function toggleCell(board, x, y) {
  if (!inBounds(board, x, y)) throw new RangeError(`(${x}, ${y}) is outside the board`);
  const k = key(x, y);
  if (board.cells.has(k)) {
    board.cells.delete(k);
    return false;
  }
  board.cells.add(k);
  return true;
}

/** Advance the board one generation, following the standard Conway rules. */
function step(board) {
  const candidates = new Set();
  for (const k of board.cells) {
    const [x, y] = k.split(",").map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        candidates.add(key(x + dx, y + dy));
      }
    }
  }

  const nextCells = new Set();
  for (const k of candidates) {
    const [x, y] = k.split(",").map(Number);
    if (!inBounds(board, x, y)) continue;
    const n = countLiveNeighbors(board, x, y);
    const alive = board.cells.has(k);
    if ((alive && (n === 2 || n === 3)) || (!alive && n === 3)) {
      nextCells.add(k);
    }
  }

  return { width: board.width, height: board.height, cells: nextCells };
}

function toArray(board) {
  return [...board.cells].map((k) => k.split(",").map(Number));
}

module.exports = { createBoard, toggleCell, step, isAlive, inBounds, countLiveNeighbors, toArray };
