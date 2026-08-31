import test from "node:test";
import assert from "node:assert/strict";
import { SOUND_PRESETS, getPreset } from "../public/audio.js";

const VALID_TYPES = new Set(["tone", "noise", "chime"]);

test("getPreset returns a known preset by name", () => {
  assert.equal(getPreset("break"), SOUND_PRESETS.break);
});

test("getPreset returns null for an unknown kind, not a crash", () => {
  assert.equal(getPreset("not-a-real-sound"), null);
});

test("every preset has a recognized type and a positive duration/gain", () => {
  for (const [name, preset] of Object.entries(SOUND_PRESETS)) {
    assert.ok(VALID_TYPES.has(preset.type), `${name} has an unrecognized type "${preset.type}"`);
    assert.ok(preset.gain > 0 && preset.gain <= 1, `${name} gain ${preset.gain} out of (0, 1]`);
    if (preset.type === "chime") {
      assert.ok(preset.noteDuration > 0, `${name} noteDuration must be positive`);
      assert.ok(Array.isArray(preset.notes) && preset.notes.length > 0, `${name} needs at least one note`);
      for (const freq of preset.notes) assert.ok(freq > 0, `${name} note frequency must be positive`);
    } else {
      assert.ok(preset.duration > 0, `${name} duration must be positive`);
    }
  }
});

test("tone and jump presets specify an audible frequency", () => {
  assert.ok(SOUND_PRESETS.place.frequency > 0);
  assert.ok(SOUND_PRESETS.jump.frequency > 0);
});

test("the noise preset specifies a filter frequency", () => {
  assert.ok(SOUND_PRESETS.break.filterFreq > 0);
});
