import { BLOCK_INFO, isOpaque } from "./blocks.js";

// Each entry: 4 corner offsets (CCW as viewed from outside), face normal, and
// a shading multiplier standing in for cheap fake ambient occlusion.
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.8 },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8 },
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0 },
  { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], shade: 0.5 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.7 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.7 },
];

function emptyBucket() {
  return { positions: [], normals: [], colors: [], indices: [], quadCount: 0 };
}

function addFace(bucket, x, y, z, face, color) {
  const [nx, ny, nz] = face.dir;
  const base = bucket.quadCount * 4;
  for (const [cx, cy, cz] of face.corners) {
    bucket.positions.push(x + cx, y + cy, z + cz);
    bucket.normals.push(nx, ny, nz);
    bucket.colors.push(color[0] * face.shade, color[1] * face.shade, color[2] * face.shade);
  }
  bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  bucket.quadCount++;
}

function finalize(bucket) {
  return {
    positions: Float32Array.from(bucket.positions),
    normals: Float32Array.from(bucket.normals),
    colors: Float32Array.from(bucket.colors),
    indices: Uint32Array.from(bucket.indices),
    quadCount: bucket.quadCount,
  };
}

/**
 * Builds plain typed-array mesh data (positions/normals/colors/indices) for
 * the world's visible faces, split into opaque and water buckets. Pure and
 * WebGL-free so it's cheap to unit test; the renderer wraps the result in a
 * THREE.BufferGeometry.
 */
function buildMeshData(world) {
  const opaque = emptyBucket();
  const water = emptyBucket();

  for (let x = 0; x < world.width; x++) {
    for (let y = 0; y < world.height; y++) {
      for (let z = 0; z < world.depth; z++) {
        const id = world.getBlock(x, y, z);
        if (id === 0) continue;
        const info = BLOCK_INFO[id];
        const bucket = info.transparent ? water : opaque;

        for (const face of FACES) {
          const neighborId = world.getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
          if (isOpaque(neighborId)) continue;
          if (neighborId === id) continue;
          addFace(bucket, x, y, z, face, info.color);
        }
      }
    }
  }

  return { opaque: finalize(opaque), water: finalize(water) };
}

export { buildMeshData, FACES };
