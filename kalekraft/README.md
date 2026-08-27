# Kalekraft

A small browser voxel sandbox — not Minecraft (trademark reasons, and
scope), but the same idea in miniature: procedurally generated terrain,
first-person movement with gravity and collision, and the ability to break
and place blocks, rendered with Three.js.

## Run

```
npm install
npm start
```

Open http://localhost:4000, click the title screen to lock the pointer, and
you're in.

**Controls**

| Input | Action |
| --- | --- |
| `WASD` | Move |
| `Space` | Jump |
| Mouse | Look |
| Left click | Break the targeted block |
| Right click | Place the selected block |
| `1`-`6` | Select a hotbar block |
| `Esc` | Release the mouse (auto-saves) |
| `N` | Discard the world and generate a new one |

The world autosaves to `localStorage` every 15 seconds and whenever you
release the pointer, so reloading the page resumes where you left off.

## How it works

Same split as the other playground projects: pure, unit-tested logic in
`public/`, with a thin Three.js layer wiring it to the screen.

The world is **chunked and streams in around the player**, not a fixed
box: chunks (16×48×16) generate on demand as you explore, deterministically
from a world seed, so it's effectively unbounded in x/z. Chunks stay
cached in memory once generated (so re-entering an area never regenerates
or loses edits) but are only meshed/rendered within a radius of the
player; editing a block rebuilds just the one or two affected chunks'
meshes, not the whole world.

- `noise.js` — deterministic seeded 2D value noise + fBm, used for terrain
  heightmaps. No external noise library.
- `blocks.js` — the block type registry (id, name, color, solid/transparent).
- `terrain.js` — pure, chunk-agnostic terrain rules: surface height and
  "is a tree rooted here" are both plain functions of `(worldX, worldZ,
  seed)`. That's what lets two neighboring chunks agree on a tree that
  straddles their shared border without needing each other to exist first.
- `chunk.js` — a single chunk's `Uint8Array` block grid: fills its own
  terrain, then paints any tree (rooted in its own columns or a
  neighboring chunk's, within the tree canopy's reach) that overhangs into
  it.
- `world.js` — the chunk manager: generates/caches chunks on demand,
  routes `getBlock`/`setBlock` to the right one, a DDA voxel raycaster for
  block targeting (chunk-boundary-agnostic), and save/load that only
  persists chunks a player has actually edited — everything else
  regenerates identically from the seed.
- `mesh.js` — turns one chunk into typed-array mesh data (positions,
  normals, vertex colors, indices), culling faces between two opaque
  blocks (including across a chunk boundary, via `world.getBlock`).
  Doesn't touch Three.js or WebGL, so it's fully unit-testable.
- `player.js` — pure physics: gravity, jumping, and axis-separated AABB vs.
  voxel collision.
- `main.js` — the only file that isn't unit tested: Three.js scene/camera
  setup, pointer-lock mouse look, keyboard input, the render loop, the
  chunk streaming manager (mesh chunks within render distance a few per
  frame, unmesh — not discard — the rest as the player moves), hotbar UI,
  and localStorage persistence. It's a thin wrapper around the modules
  above.
- `server.js` — Express serving `public/` as static files, plus Three's
  module build so the client can `import "three"` via an import map with no
  bundler or CDN dependency.

## Test

```
npm test
```

Runs unit tests (`node --test`) for noise, terrain rules, chunk-aware world
generation/raycasting (including determinism across chunk and negative
coordinates, and boundary-straddling trees), mesh face-culling, and player
physics — the entire simulation core, with no browser or WebGL required.

## Limitations

This is a tech-demo scale sandbox, not a game: no multiplayer, no
crafting/inventory/mobs, no textures (flat-shaded per-face colors), and
loaded chunks are never evicted (memory grows, unbounded, with how far a
single session explores — fine for a play session, not for a long-running
server). The world itself is no longer the limiting factor: chunks stream
in as you walk, generation and re-meshing are budgeted per frame, and
editing only rebuilds the touched chunk(s).
