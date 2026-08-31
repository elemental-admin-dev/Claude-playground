"use strict";

/**
 * Parses a positive-number env var, falling back to `defaultValue` for a
 * missing, non-numeric, zero, or negative value. Plain `Number(x) ||
 * default` gets this wrong: it silently treats an explicit "0" as unset
 * (falling back instead of honoring it) while letting a negative value
 * through untouched, since a negative number is still truthy. Passing a
 * negative interval straight to setInterval is especially dangerous - Node
 * clamps any delay under 1ms to ~1ms, so a bad env var turns into a
 * multi-hundred-times-per-second callback storm instead of a clean error.
 *
 * `env` defaults to `process.env` but is injectable for testing.
 */
function positiveNumberFromEnv(name, defaultValue, env = process.env) {
  const raw = env[name];
  if (raw === undefined) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`multiplayer-life: ${name}=${JSON.stringify(raw)} is invalid (must be a positive number), using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

module.exports = { positiveNumberFromEnv };
