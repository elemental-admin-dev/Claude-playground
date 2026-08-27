"use strict";

/** Tracks a per-key action cooldown (e.g. one placement per IP per minute). */
class CooldownTracker {
  constructor(cooldownMs) {
    this.cooldownMs = cooldownMs;
    this.lastActionAt = new Map();
  }

  /** Milliseconds until `id` may act again; 0 if it may act now. */
  remaining(id, now = Date.now()) {
    const last = this.lastActionAt.get(id);
    if (last === undefined) return 0;
    return Math.max(0, this.cooldownMs - (now - last));
  }

  canAct(id, now = Date.now()) {
    return this.remaining(id, now) === 0;
  }

  /** Records an action for `id`. Returns false without recording if still on cooldown. */
  tryAct(id, now = Date.now()) {
    if (!this.canAct(id, now)) return false;
    this.lastActionAt.set(id, now);
    return true;
  }

  /**
   * Drops entries whose cooldown has already fully elapsed. Safe to call at
   * any time — canAct/remaining/tryAct behave identically for a dropped id
   * as for one that was never seen — this just bounds memory on a
   * long-running server that many distinct ids pass through over time.
   */
  sweep(now = Date.now()) {
    for (const [id, last] of this.lastActionAt) {
      if (now - last >= this.cooldownMs) this.lastActionAt.delete(id);
    }
  }
}

module.exports = { CooldownTracker };
