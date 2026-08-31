// Frame-rate-independent smoothing ("damping") toward a target value, for
// easing a remote player's rendered position/rotation between the sparse
// (~10Hz) network updates instead of snapping. Pure and side-effect-free —
// callers own the actual mesh mutation.

/**
 * Exponentially eases `current` toward `target`. Frame-rate independent:
 * calling this once with dt=0.1 or ten times with dt=0.01 lands at (very
 * nearly) the same place. `smoothing` is roughly "how many times per
 * second the gap halves-ish" — higher closes the gap faster.
 */
function damp(current, target, smoothing, dt) {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}

/** Wraps an angle in radians into (-PI, PI]. */
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Like damp(), but for an angle in radians — always turns the short way around. */
function dampAngle(current, target, smoothing, dt) {
  const delta = wrapAngle(target - current);
  return current + delta * (1 - Math.exp(-smoothing * dt));
}

export { damp, wrapAngle, dampAngle };
