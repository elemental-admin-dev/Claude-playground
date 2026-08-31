"use strict";

// Pure canvas <-> grid coordinate math, used by client.js for both click
// handling and the hover-cell highlight. No DOM/canvas dependency beyond
// the plain numbers a click/mousemove event and a getBoundingClientRect()
// already give you, so it's unit-testable without a browser.

/**
 * Converts a mouse event's page coordinates into the grid cell they land
 * on. `rect` is the canvas's getBoundingClientRect() (accounts for CSS
 * scaling, since the canvas's CSS size and its pixel width/height can
 * differ - max-width: 100% in style.css means they usually do).
 */
function screenToCell(clientX, clientY, rect, canvasWidth, canvasHeight, cellSize) {
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;
  return {
    x: Math.floor(((clientX - rect.left) * scaleX) / cellSize),
    y: Math.floor(((clientY - rect.top) * scaleY) / cellSize),
  };
}

function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

// Loaded as a plain <script> in the browser (top-level function
// declarations there become globals automatically) and via require() in
// tests, where `module` exists and this export makes them reachable.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { screenToCell, inBounds };
}
