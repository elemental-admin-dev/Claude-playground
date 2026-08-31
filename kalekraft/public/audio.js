// Sound "recipes" for a small set of game events — parameters only, no
// actual audio synthesis (that needs a real AudioContext, so it lives in
// main.js). Keeping the presets here as plain data makes them easy to
// unit test without a browser.

const SOUND_PRESETS = {
  break: { type: "noise", duration: 0.12, filterFreq: 900, gain: 0.35 },
  place: { type: "tone", frequency: 220, duration: 0.08, gain: 0.25 },
  jump: { type: "tone", frequency: 180, duration: 0.06, gain: 0.2 },
  craft: { type: "chime", notes: [523.25, 659.25], noteDuration: 0.1, gain: 0.3 }, // C5, E5
};

function getPreset(kind) {
  return SOUND_PRESETS[kind] ?? null;
}

export { SOUND_PRESETS, getPreset };
