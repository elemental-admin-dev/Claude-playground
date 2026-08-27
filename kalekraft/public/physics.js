// Shared voxel AABB physics: collision, gravity, and step-up-a-ledge
// movement, generic over a body's half-width/height so both the player and
// mobs (a smaller body, different speed) can use the same rules.

import { isSolid } from "./blocks.js";

const GRAVITY = -24;
const STEP_HEIGHT = 1.0; // a single raised block is auto-climbed instead of blocking movement

function collidesAt(world, x, y, z, halfWidth, height) {
  const minX = x - halfWidth;
  const maxX = x + halfWidth;
  const minZ = z - halfWidth;
  const maxZ = z + halfWidth;
  for (const cx of [minX, maxX]) {
    for (const cz of [minZ, maxZ]) {
      for (const cy of [y + 0.01, y + height - 0.01]) {
        if (isSolid(world.getBlock(cx, cy, cz))) return true;
      }
    }
  }
  return false;
}

/**
 * Advances one body one physics step: gravity, an optional jump, and
 * axis-separated collision against the voxel world with step-up-a-ledge
 * assist. `body` is `{x, y, z, vy, onGround}`; `moveX`/`moveZ` is a
 * world-space horizontal direction (need not be unit length).
 */
function stepBody(world, body, { moveX, moveZ, speed, jump, jumpSpeed, halfWidth, height }, dt) {
  let { x, y, z, vy } = body;

  const vx = moveX * speed;
  const vz = moveZ * speed;
  vy += GRAVITY * dt;
  if (jump && body.onGround) vy = jumpSpeed;

  let stepUp = 0;

  let nx = x + vx * dt;
  if (collidesAt(world, nx, y, z, halfWidth, height)) {
    if (!collidesAt(world, nx, y + STEP_HEIGHT, z, halfWidth, height)) stepUp = STEP_HEIGHT;
    else nx = x;
  }

  let nz = z + vz * dt;
  if (collidesAt(world, nx, y, nz, halfWidth, height)) {
    if (!collidesAt(world, nx, y + STEP_HEIGHT, nz, halfWidth, height)) stepUp = STEP_HEIGHT;
    else nz = z;
  }

  let ny = y + vy * dt;
  if (stepUp > 0 && ny < y + stepUp) {
    ny = y + stepUp;
    vy = Math.max(vy, 0);
  }

  let onGround = false;
  if (collidesAt(world, nx, ny, nz, halfWidth, height)) {
    if (vy < 0) onGround = true;
    ny = y;
    vy = 0;
  }

  return { x: nx, y: ny, z: nz, vx, vy, vz, onGround };
}

export { GRAVITY, STEP_HEIGHT, collidesAt, stepBody };
