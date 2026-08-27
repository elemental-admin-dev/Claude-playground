import { collidesAt as collidesAtBody, stepBody } from "./physics.js";

const JUMP_SPEED = 8.5;
const MOVE_SPEED = 5;
const HALF_WIDTH = 0.3;
const HEIGHT = 1.7;
const EYE_OFFSET = 1.55;

function createPlayer(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false };
}

function collidesAt(world, x, y, z) {
  return collidesAtBody(world, x, y, z, HALF_WIDTH, HEIGHT);
}

/**
 * Advances the player one physics step. `input.moveX`/`input.moveZ` are a
 * world-space horizontal direction (already camera-relative, need not be
 * normalized to exactly 1); `input.jump` requests a jump if grounded.
 */
function stepPlayer(world, player, input, dt) {
  return stepBody(
    world,
    player,
    {
      moveX: input.moveX,
      moveZ: input.moveZ,
      speed: MOVE_SPEED,
      jump: input.jump,
      jumpSpeed: JUMP_SPEED,
      halfWidth: HALF_WIDTH,
      height: HEIGHT,
    },
    dt,
  );
}

export { createPlayer, stepPlayer, collidesAt, MOVE_SPEED, JUMP_SPEED, HALF_WIDTH, HEIGHT, EYE_OFFSET };
