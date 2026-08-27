// Deterministic 2D value noise + fBm. No external deps, works in Node and the browser.

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295; // -> [0, 1)
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Deterministic 2D value noise in roughly [0, 1], continuous and seed-stable. */
function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smootherstep(x - x0);
  const sy = smootherstep(y - y0);

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

/** Fractal Brownian motion: layered value noise, normalized to roughly [0, 1]. */
function fbm2D(x, y, seed, { octaves = 4, persistence = 0.5, lacunarity = 2, scale = 1 } = {}) {
  let amplitude = 1;
  let frequency = scale;
  let sum = 0;
  let maxAmplitude = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * frequency, y * frequency, seed + i * 101) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return sum / maxAmplitude;
}

export { hash2, valueNoise2D, fbm2D };
