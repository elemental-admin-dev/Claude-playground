"use strict";

const fs = require("node:fs");
const { serializeState, deserializeState } = require("./persistence");

/**
 * Loads a previously saved board from `path`. Returns `{ state, error,
 * sizeMismatch }` where `state` is `{ board, tickNumber }` on success, or
 * `null` if there's nothing usable to resume: a missing file, a corrupt
 * one (`error` set), or one whose dimensions don't match the currently
 * configured width/height (`sizeMismatch: true`). This module only
 * touches disk and validates - callers decide how (or whether) to log.
 *
 * `nextTickAt` is deliberately NOT part of the returned state: the tick
 * schedule is always recomputed fresh relative to server startup (the
 * setInterval driving it always starts a new TICK_MS countdown at boot),
 * so a restored value would be stale after any real downtime. Returning
 * it here would be a standing invitation for a future edit to read it
 * again and reintroduce that bug.
 */
function loadState(path, width, height) {
  let json;
  try {
    json = fs.readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return { state: null };
    return { state: null, error: err };
  }

  let restored;
  try {
    restored = deserializeState(json);
  } catch (err) {
    return { state: null, error: err };
  }

  if (restored.board.width !== width || restored.board.height !== height) {
    return { state: null, sizeMismatch: true };
  }

  return { state: { board: restored.board, tickNumber: restored.tickNumber } };
}

/**
 * Writes the board's state to `path` via write-to-temp-then-rename, so a
 * save interrupted mid-flush (SIGKILL, OOM) leaves the previous save file
 * intact rather than a truncated, unloadable one.
 */
function saveState(path, board, tickNumber, nextTickAt) {
  const tmpPath = `${path}.tmp`;
  fs.writeFileSync(tmpPath, serializeState(board, tickNumber, nextTickAt));
  fs.renameSync(tmpPath, path);
}

module.exports = { loadState, saveState };
