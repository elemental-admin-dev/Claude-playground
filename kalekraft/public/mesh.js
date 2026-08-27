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
 * one chunk's visible faces, split into opaque and water buckets. Vertices
 * use absolute world coordinates, so the resulting mesh needs no transform.
 * Queries world.getBlock (not the chunk directly) so faces on a chunk
 * boundary are correctly culled against the neighboring chunk — which may
 * generate that neighbor on demand as a side effect.
 *
 * Pure and WebGL-free so it's cheap to unit test; the renderer wraps the
 * result in a THREE.BufferGeometry.
 */
function buildChunkMeshData(world, cx, cz) {
  const opaque = emptyBucket();
  const water = emptyBucket();
  const { chunkSize: size, chunkHeight: height } = world;
  const originX = cx * size;
  const originZ = cz * size;

  for (let lx = 0; lx < size; lx++) {
    for (let ly = 0; ly < height; ly++) {
      for (let lz = 0; lz < size; lz++) {
        const wx = originX + lx;
        const wy = ly;
        const wz = originZ + lz;
        const id = world.getBlock(wx, wy, wz);
        if (id === 0) continue;
        const info = BLOCK_INFO[id];
        const bucket = info.transparent ? water : opaque;

        for (const face of FACES) {
          const neighborId = world.getBlock(wx + face.dir[0], wy + face.dir[1], wz + face.dir[2]);
          if (isOpaque(neighborId)) continue;
          if (neighborId === id) continue;
          addFace(bucket, wx, wy, wz, face, info.color);
        }
      }
    }
  }

  return { opaque: finalize(opaque), water: finalize(water) };
}

export { buildChunkMeshData, FACES };
