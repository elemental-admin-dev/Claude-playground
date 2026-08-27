import { isSolid } from "./blocks.js";

const GRAVITY = -24;
const JUMP_SPEED = 8.5;
const MOVE_SPEED = 5;
const HALF_WIDTH = 0.3;
const HEIGHT = 1.7;
const EYE_OFFSET = 1.55;

function createPlayer(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false };
}

function collidesAt(world, x, y, z) {
  const minX = x - HALF_WIDTH;
  const maxX = x + HALF_WIDTH;
  const minZ = z - HALF_WIDTH;
  const maxZ = z + HALF_WIDTH;
  for (const cx of [minX, maxX]) {
    for (const cz of [minZ, maxZ]) {
      for (const cy of [y + 0.01, y + HEIGHT - 0.01]) {
        if (isSolid(world.getBlock(cx, cy, cz))) return true;
      }
    }
  }
  return false;
}

/**
 * Advances the player one physics step. `input.moveX`/`input.moveZ` are a
 * world-space horizontal direction (already camera-relative, need not be
 * normalized to exactly 1); `input.jump` requests a jump if grounded.
 */
function stepPlayer(world, player, input, dt) {
  let { x, y, z, vy } = player;

  const vx = input.moveX * MOVE_SPEED;
  const vz = input.moveZ * MOVE_SPEED;
  vy += GRAVITY * dt;
  if (input.jump && player.onGround) vy = JUMP_SPEED;

  let nx = x + vx * dt;
  if (collidesAt(world, nx, y, z)) nx = x;

  let nz = z + vz * dt;
  if (collidesAt(world, nx, y, nz)) nz = z;

  let ny = y + vy * dt;
  let onGround = false;
  if (collidesAt(world, nx, ny, nz)) {
    if (vy < 0) onGround = true;
    ny = y;
    vy = 0;
  }

  return { x: nx, y: ny, z: nz, vx, vy, vz, onGround };
}

export { createPlayer, stepPlayer, collidesAt, MOVE_SPEED, JUMP_SPEED, HALF_WIDTH, HEIGHT, EYE_OFFSET };
