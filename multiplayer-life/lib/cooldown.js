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
}

module.exports = { CooldownTracker };
