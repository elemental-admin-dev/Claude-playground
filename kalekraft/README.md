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

- `noise.js` — deterministic seeded 2D value noise + fBm, used for terrain
  heightmaps. No external noise library.
- `blocks.js` — the block type registry (id, name, color, solid/transparent).
- `world.js` — a flat `Uint8Array` voxel grid: terrain generation (including
  a scatter of trees), get/set, a DDA voxel raycaster for block targeting,
  and run-length-encoded serialize/deserialize for saves.
- `mesh.js` — turns a `World` into typed-array mesh data (positions, normals,
  vertex colors, indices), culling faces between two opaque blocks. Doesn't
  touch Three.js or WebGL, so it's fully unit-testable.
- `player.js` — pure physics: gravity, jumping, and axis-separated AABB vs.
  voxel collision.
- `main.js` — the only file that isn't unit tested: Three.js scene/camera
  setup, pointer-lock mouse look, keyboard input, the render loop, hotbar
  UI, and localStorage persistence. It's a thin wrapper around the modules
  above.
- `server.js` — Express serving `public/` as static files, plus Three's
  module build so the client can `import "three"` via an import map with no
  bundler or CDN dependency.

## Test

```
npm test
```

Runs unit tests (`node --test`) for noise, world generation/raycasting,
mesh face-culling, and player physics — the entire simulation core, with no
browser or WebGL required.

## Limitations

This is a tech-demo scale sandbox, not a game: a single fixed-size world (no
infinite/chunked streaming), no multiplayer, no crafting/inventory/mobs, no
textures (flat-shaded per-face colors), and editing rebuilds the whole mesh
rather than just the touched chunk. All fine at the ~48×32×48 block scale
this ships with, but the first things you'd want to change before growing
the world much further.
