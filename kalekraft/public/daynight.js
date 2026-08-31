// Pure day/night cycle math: given how many seconds have elapsed, derive a
// time-of-day fraction and everything lighting depends on (sun height/
// direction, ambient/sun brightness, sky color). No THREE.js dependency, so
// it's testable without a renderer; main.js applies the numbers to the
// scene each frame.

const DAY_LENGTH_SECONDS = 600; // one full day/night cycle, real time

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(colorA, colorB, t) {
  return {
    r: lerp(colorA.r, colorB.r, t),
    g: lerp(colorA.g, colorB.g, t),
    b: lerp(colorA.b, colorB.b, t),
  };
}

/** Elapsed seconds -> fraction of a day in [0, 1). t=0/1 is midnight, t=0.5 is noon. */
function timeOfDay(elapsedSeconds, dayLengthSeconds = DAY_LENGTH_SECONDS) {
  const cycled = elapsedSeconds % dayLengthSeconds;
  return (cycled < 0 ? cycled + dayLengthSeconds : cycled) / dayLengthSeconds;
}

/** -1 (straight down, deep night) to 1 (straight up, noon); 0 at sunrise/sunset. */
function sunHeight(t) {
  return Math.sin(2 * Math.PI * (t - 0.25));
}

/** A unit-ish direction for the sun's DirectionalLight to shine from. */
function sunDirection(t) {
  const angle = 2 * Math.PI * (t - 0.25);
  return { x: Math.cos(angle), y: Math.sin(angle), z: 0.35 };
}

// How much of the sun's height maps into "fully day" - keeps a little
// ambient light in the sky even right at the sunrise/sunset horizon instead
// of a hard cutoff at h=0.
const DAYLIGHT_SOFTNESS = 0.15;
const DAYLIGHT_RANGE = 1 + DAYLIGHT_SOFTNESS;

function daylightFactor(t) {
  return clamp01((sunHeight(t) + DAYLIGHT_SOFTNESS) / DAYLIGHT_RANGE);
}

const AMBIENT_NIGHT = 0.18;
const AMBIENT_DAY = 0.65;

function ambientIntensity(t) {
  return lerp(AMBIENT_NIGHT, AMBIENT_DAY, daylightFactor(t));
}

const SUN_DAY_MAX = 0.85;

function sunIntensity(t) {
  return lerp(0, SUN_DAY_MAX, clamp01(sunHeight(t) + 0.1));
}

const NIGHT_SKY = { r: 0.02, g: 0.02, b: 0.08 };
const DAY_SKY = { r: 0.53, g: 0.81, b: 0.92 };
const SUNSET_SKY = { r: 0.95, g: 0.45, b: 0.25 };

function skyColor(t) {
  const base = lerpColor(NIGHT_SKY, DAY_SKY, daylightFactor(t));
  // Blend in a warm horizon tint only while the sun is near the horizon.
  const horizonWeight = clamp01(1 - Math.abs(sunHeight(t)) / 0.35);
  return lerpColor(base, SUNSET_SKY, horizonWeight * 0.5);
}

export {
  DAY_LENGTH_SECONDS,
  timeOfDay,
  sunHeight,
  sunDirection,
  daylightFactor,
  ambientIntensity,
  sunIntensity,
  skyColor,
  lerp,
  lerpColor,
  clamp01,
};
