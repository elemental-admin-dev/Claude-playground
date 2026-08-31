"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { positiveNumberFromEnv } = require("../lib/env");

test("returns the default when the env var is unset", () => {
  assert.equal(positiveNumberFromEnv("MISSING", 42, {}), 42);
});

test("parses a valid positive number", () => {
  assert.equal(positiveNumberFromEnv("X", 10, { X: "5000" }), 5000);
});

test("falls back to the default for an explicit 0, not silently accepting it", () => {
  assert.equal(positiveNumberFromEnv("X", 10, { X: "0" }), 10);
});

test("falls back to the default for a negative value instead of passing it through", () => {
  assert.equal(positiveNumberFromEnv("X", 10, { X: "-50" }), 10);
});

test("falls back to the default for a non-numeric value", () => {
  assert.equal(positiveNumberFromEnv("X", 10, { X: "banana" }), 10);
});

test("falls back to the default for Infinity/NaN-producing input", () => {
  assert.equal(positiveNumberFromEnv("X", 10, { X: "Infinity" }), 10);
});
