"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CooldownTracker } = require("../lib/cooldown");

test("a fresh id may act immediately", () => {
  const tracker = new CooldownTracker(60_000);
  assert.equal(tracker.canAct("a", 1000), true);
  assert.equal(tracker.remaining("a", 1000), 0);
});

test("tryAct records the action and blocks further acts within the window", () => {
  const tracker = new CooldownTracker(60_000);
  assert.equal(tracker.tryAct("a", 0), true);
  assert.equal(tracker.canAct("a", 30_000), false);
  assert.equal(tracker.remaining("a", 30_000), 30_000);
  assert.equal(tracker.tryAct("a", 30_000), false);
});

test("acting is allowed again once the cooldown elapses", () => {
  const tracker = new CooldownTracker(60_000);
  tracker.tryAct("a", 0);
  assert.equal(tracker.canAct("a", 60_000), true);
  assert.equal(tracker.tryAct("a", 60_000), true);
});

test("cooldowns are tracked independently per id", () => {
  const tracker = new CooldownTracker(60_000);
  tracker.tryAct("a", 0);
  assert.equal(tracker.canAct("b", 0), true);
  assert.equal(tracker.tryAct("b", 0), true);
});
