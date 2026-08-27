import { BLOCK_INFO, isOpaque } from "./blocks.js";
import { tileUV } from "./textures.js";

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

const FACE_CATEGORY = { "0,1,0": "top", "0,-1,0": "bottom" }; // anything else is "side"

function faceCategory(dir) {
  return FACE_CATEGORY[dir.join(",")] ?? "side";
}

/**
 * A corner's local (0-1, 0-1) position within its face's own 2D plane —
 * for top/bottom faces that's (x, z); for a side face it's (the horizontal
 * axis that varies across that face, height). Works for all 6 directions
 * without a per-face lookup table because exactly one of x/y/z is fixed by
 * the face normal, and the other two vary from 0 to 1 across the quad.
 */
function localFaceUV(dir, corner) {
  const [cx, cy, cz] = corner;
  if (dir[1] !== 0) return [cx, cz]; // top or bottom
  const u = dir[0] !== 0 ? cz : cx; // side face: horizontal axis not fixed by the normal
  return [u, cy]; // v is always height on a side face
}

function emptyBucket() {
  return { positions: [], normals: [], colors: [], indices: [], uvs: [], quadCount: 0 };
}

function addFace(bucket, x, y, z, face, color, uvRect) {
  const [nx, ny, nz] = face.dir;
  const base = bucket.quadCount * 4;
  for (const corner of face.corners) {
    const [cx, cy, cz] = corner;
    bucket.positions.push(x + cx, y + cy, z + cz);
    bucket.normals.push(nx, ny, nz);
    bucket.colors.push(color[0] * face.shade, color[1] * face.shade, color[2] * face.shade);
    const [u, v] = localFaceUV(face.dir, corner);
    bucket.uvs.push(uvRect.u0 + u * (uvRect.u1 - uvRect.u0), uvRect.v0 + v * (uvRect.v1 - uvRect.v0));
  }
  bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  bucket.quadCount++;
}

function finalize(bucket) {
  return {
    positions: Float32Array.from(bucket.positions),
    normals: Float32Array.from(bucket.normals),
    colors: Float32Array.from(bucket.colors),
    uvs: Float32Array.from(bucket.uvs),
    indices: Uint32Array.from(bucket.indices),
    quadCount: bucket.quadCount,
  };
}

const FLAT_TILE = tileUV("stone"); // arbitrary; unused by materials with no texture map (e.g. water)
const WHITE = [1, 1, 1]; // textured faces carry hue in the map, not the vertex color

/**
 * Builds plain typed-array mesh data (positions/normals/colors/uvs/indices)
 * for one chunk's visible faces, split into opaque and water buckets.
 * Vertices use absolute world coordinates, so the resulting mesh needs no
 * transform. Queries world.getBlock (not the chunk directly) so faces on a
 * chunk boundary are correctly culled against the neighboring chunk — which
 * may generate that neighbor on demand as a side effect.
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

          if (info.textures) {
            const uvRect = tileUV(info.textures[faceCategory(face.dir)]);
            addFace(bucket, wx, wy, wz, face, WHITE, uvRect);
          } else {
            addFace(bucket, wx, wy, wz, face, info.color, FLAT_TILE);
          }
        }
      }
    }
  }

  return { opaque: finalize(opaque), water: finalize(water) };
}

export { buildChunkMeshData, FACES, faceCategory, localFaceUV };
