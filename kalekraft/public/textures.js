// Deterministic, per-pixel procedural block textures. No image assets: each
// tile is generated from a pixel-coordinate hash, the same trick noise.js
// uses for terrain. Pure and canvas-free, so it's unit-testable; the actual
// <canvas> atlas is assembled in main.js (the untested glue layer) from
// pixelColor() below.

import { hash2 } from "./noise.js";

const TILE_SIZE = 16;
const KINDS = [
  "stone",
  "dirt",
  "sand",
  "grass-top",
  "grass-side",
  "wood-top",
  "wood-side",
  "leaves",
  "planks",
  "brick",
];

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(base, amount) {
  return [clampByte(base[0] + amount), clampByte(base[1] + amount), clampByte(base[2] + amount)];
}

function speckle(px, py, kindSeed, amount) {
  return (hash2(px, py, kindSeed) - 0.5) * amount;
}

/** RGB (0-255 each) of one pixel of a texture `kind`, at local tile coordinates. */
function pixelColor(kind, px, py, size = TILE_SIZE) {
  switch (kind) {
    case "stone": {
      const crack = hash2(px * 3, py * 3, 202) > 0.94 ? -35 : 0;
      return mix([128, 128, 132], speckle(px, py, 101, 40) + crack);
    }
    case "dirt":
      return mix([115, 82, 51], speckle(px, py, 103, 36));
    case "sand":
      return mix([206, 190, 145], speckle(px, py, 107, 24));
    case "grass-top":
      return mix([88, 155, 68], speckle(px, py, 109, 34));
    case "grass-side": {
      const capRows = Math.round(size * 0.3);
      if (py < capRows) return mix([88, 155, 68], speckle(px, py, 109, 34));
      return mix([115, 82, 51], speckle(px, py, 103, 36));
    }
    case "wood-top": {
      const c = (size - 1) / 2;
      const dist = Math.hypot(px - c, py - c);
      const ring = Math.sin(dist * 1.6) * 14;
      return mix([148, 108, 66], ring + speckle(px, py, 113, 10));
    }
    case "wood-side": {
      const stripe = Math.sin(px * 1.9 + hash2(Math.floor(px / 2), 0, 117) * 3) * 16;
      return mix([120, 84, 48], stripe + speckle(px, py, 119, 10));
    }
    case "leaves":
      return mix([58, 110, 46], speckle(px, py, 127, 46));
    case "planks": {
      const seam = py % 4 === 0 ? -22 : 0; // horizontal board edges
      const grain = Math.sin(py * 1.3 + hash2(0, Math.floor(py / 2), 131) * 3) * 10;
      return mix([176, 140, 90], grain + seam + speckle(px, py, 133, 8));
    }
    case "brick": {
      const rowHeight = 4;
      const brickWidth = 8;
      const row = Math.floor(py / rowHeight);
      const offset = (row % 2) * (brickWidth / 2);
      const isMortar = py % rowHeight === 0 || Math.floor((px + offset) % brickWidth) === 0;
      if (isMortar) return mix([158, 148, 138], speckle(px, py, 139, 10));
      return mix([150, 60, 45], speckle(px, py, 141, 20));
    }
    default:
      return [255, 0, 255]; // unmistakable "missing texture" marker
  }
}

/** UV rect (0-1) of a tile within the atlas, given the atlas is one row of KINDS.length tiles. */
function tileUV(kind) {
  const i = Math.max(0, KINDS.indexOf(kind));
  return { u0: i / KINDS.length, u1: (i + 1) / KINDS.length, v0: 0, v1: 1 };
}

export { KINDS, TILE_SIZE, pixelColor, tileUV };
