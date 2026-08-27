// A small passive wanderer: picks a random horizontal direction, walks it
// for a while, then picks a new one — turning around immediately if that
// walk left it blocked. Falls under the same gravity/collision/step-up
// physics as the player, just with a smaller body and no jumping.

import { stepBody, collidesAt } from "./physics.js";

const MOB_SPEED = 1.6;
const HALF_WIDTH = 0.25;
const HEIGHT = 0.9;
const MIN_WANDER_S = 1.5;
const MAX_WANDER_S = 4;

function randomHeading(rng = Math.random) {
  const angle = rng() * Math.PI * 2;
  return { moveX: Math.cos(angle), moveZ: Math.sin(angle) };
}

function createMob(x, y, z, rng = Math.random) {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    ...randomHeading(rng),
    wanderTimer: MIN_WANDER_S + rng() * (MAX_WANDER_S - MIN_WANDER_S),
  };
}

/** Advances one mob one tick: wander AI (pure, seeded by `rng`) plus physics. */
function stepMob(world, mob, dt, rng = Math.random) {
  let { moveX, moveZ, wanderTimer } = mob;
  wanderTimer -= dt;

  const isMoving = moveX !== 0 || moveZ !== 0;
  const isStuck = mob.onGround && isMoving && stuckHorizontally(world, mob);
  if (wanderTimer <= 0 || isStuck) {
    ({ moveX, moveZ } = randomHeading(rng));
    wanderTimer = MIN_WANDER_S + rng() * (MAX_WANDER_S - MIN_WANDER_S);
  }

  const next = stepBody(world, mob, { moveX, moveZ, speed: MOB_SPEED, jump: false, jumpSpeed: 0, halfWidth: HALF_WIDTH, height: HEIGHT }, dt);
  return { ...next, moveX, moveZ, wanderTimer };
}

/** True if the mob tried to move but didn't (walked into something taller than a step). */
function stuckHorizontally(world, mob) {
  const { moveX, moveZ } = mob;
  if (moveX === 0 && moveZ === 0) return false;
  return collidesAt(world, mob.x + moveX * 0.1, mob.y, mob.z + moveZ * 0.1, HALF_WIDTH, HEIGHT);
}

export { createMob, stepMob, MOB_SPEED, HALF_WIDTH, HEIGHT };
