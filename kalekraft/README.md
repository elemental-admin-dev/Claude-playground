# Kalekraft

A small browser voxel sandbox — not Minecraft (trademark reasons, and
scope), but the same idea in miniature: procedurally generated terrain
with a few wandering passive mobs, first-person movement with gravity and
collision, gathering and placing blocks (break one to add it to your
inventory, spend one to place it), crafting raw blocks into refined ones,
a shared multiplayer world — anyone who opens the page walks the same
terrain and sees the same edits, live — and a few procedurally synthesized
sound effects (no audio files) for breaking, placing, jumping, and
crafting. Rendered with Three.js.

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
| `Shift` | Sprint (1.6x move speed) |
| `Space` | Jump |
| Mouse | Look |
| Left click | Break the targeted block (adds it to your inventory) |
| Right click | Place the selected block (costs one from your inventory) |
| `1`-`9` | Select a hotbar block |
| `C` | Toggle the crafting panel |
| `Z` / `X` / `V` | Craft Planks / Brick / Glass (works whether the panel is open or not) |
| `Esc` | Release the mouse (auto-saves) |
| `N` | Discard your local edits and resync to the shared world |

Breaking, placing, jumping, and crafting each play a small synthesized
sound. Browsers only allow audio after a user gesture, so sound stays
silent until you click the title screen to lock the pointer — same click
that starts everything else.

You start with nothing — break blocks to collect them. Each hotbar slot
shows how many of that block you're carrying; an empty slot (dimmed, no
count) can't be placed until you gather more. The crafting panel (`C`)
shows what each recipe needs and turns green once you have enough — no
mouse needed, since a visible cursor isn't available while the pointer is
locked for looking around. Your local view of the world (and your
inventory) autosaves to `localStorage` every 15 seconds and whenever you
release the pointer, so reloading the page resumes where you left off.

Everyone who loads the page is in the **same world** and sees each other
as simple blue boxes moving around; breaking or placing a block shows up
for everyone almost immediately. Open the page in two tabs (or have a
friend on the same network hit your machine's address) to see it.

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

**Multiplayer works because the seed is shared, not because the world is
synced.** Every client generates identical terrain from the same fixed
`SHARED_WORLD_SEED` (`config.js`), so the server never needs to hold or
transmit any *terrain* — only *edits*. It keeps its own authoritative
`World` (with `autoGenerate: false`, so it's purely a sparse record of
what's been changed) and relays two kinds of events between clients: block
edits (applied to the server's World, then broadcast, so everyone's
`world.setBlock` stays in sync) and player positions (for avatars). A
newly-connecting client gets that authoritative World's dirty chunks in
its `init` message and merges them into its own already-generated world
via `world.applyDirtyChunk()` — so a late joiner does see edits made
before they connected, without the server ever having to transmit or hold
any terrain, only the sparse diff.

- `noise.js` — deterministic seeded 2D value noise + fBm, used for terrain
  heightmaps. No external noise library.
- `blocks.js` — the block type registry (id, name, color, solid/transparent,
  and which procedural texture each face uses).
- `textures.js` — a deterministic, per-pixel procedural texture for each
  block "kind" (stone, dirt, grass top/side, wood top/side, leaves, sand,
  planks, brick, glass), generated from a pixel-coordinate hash — no image
  assets. Pure; the actual `<canvas>` atlas is assembled in `main.js`.
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
  block targeting (chunk-boundary-agnostic), save/load that only persists
  chunks a player has actually edited (everything else regenerates
  identically from the seed), and `applyDirtyChunk()` for merging a
  server-sent edit into an existing world without discarding the rest of
  it — the multiplayer catch-up path.
- `config.js` — the one constant (`SHARED_WORLD_SEED`) both `main.js` and
  `server.js` import, so client and server terrain can never drift apart.
- `mesh.js` — turns one chunk into typed-array mesh data (positions,
  normals, vertex colors, UVs, indices), culling faces between two opaque
  blocks (including across a chunk boundary, via `world.getBlock`) and
  mapping each face to its block's atlas tile. The vertex color carries
  only the per-face fake-AO shade (white for textured blocks, the real hue
  for untextured ones like water) — hue comes from the texture map.
  Doesn't touch Three.js or WebGL, so it's fully unit-testable.
- `physics.js` — shared AABB-vs-voxel collision, gravity, and step-up
  movement, generic over a body's size/speed so both the player and mobs
  use the same rules.
- `player.js` — a thin wrapper over `physics.js` with the player's own
  size/speed/jump constants.
- `mob.js` — a small passive wanderer built on the same `physics.js`:
  picks a random heading, walks it for a few seconds (or immediately if it
  gets stuck against something), then picks a new one. The AI is seeded by
  an injectable `rng`, so it's fully deterministic and unit-testable.
- `inventory.js` — a simple per-block-id item count: breaking adds one,
  placing costs one (and refuses if you don't have one). Serializable, so
  it saves and loads with the rest of the world.
- `crafting.js` — a tiny recipe registry on top of `Inventory` (wood ->
  planks, stone -> brick, sand -> glass): `craft(inventory, recipeId)`
  checks and spends the inputs and grants the output in one step, a no-op
  if you're short on materials. No furnace/heat mechanic — these are
  simplified stand-ins for what would normally need smelting.
- `interp.js` — frame-rate-independent exponential easing (`damp`) toward a
  target value, plus an angle-aware variant (`dampAngle`) that always turns
  the short way around. Used to smooth remote players' rendered position
  between the sparse (~10Hz) multiplayer position updates instead of
  visibly snapping to each one.
- `audio.js` — sound "recipes" (type, duration, frequency/notes, gain) for
  break/place/jump/craft, as plain data with no `AudioContext` dependency,
  so the presets are unit-testable without a browser. The actual synthesis
  (oscillators for tones/chimes, a filtered noise buffer for the break
  sound) happens in `main.js`, which has the real `AudioContext`.
- `main.js` — the only file that isn't unit tested: Three.js scene/camera
  setup, pointer-lock mouse look, keyboard input, the render loop, the
  chunk streaming manager (mesh chunks within render distance a few per
  frame, unmesh — not discard — the rest as the player moves), spawning
  and rendering mobs as simple colored boxes, hotbar and crafting-panel
  UI, localStorage persistence, procedural sound synthesis from
  `audio.js`'s presets, and the multiplayer WebSocket connection
  (sending edits/position, applying incoming edits, rendering other
  players as blue boxes). It's a thin wrapper around the modules above.
  Mobs themselves
  aren't saved or synced — they're ambient wildlife, not shared state, so
  a fresh batch spawns near each player independently on load.
- `server.js` — Express serving `public/` as static files (plus Three's
  module build, so the client can `import "three"` via an import map with
  no bundler or CDN dependency) and a `ws` WebSocket server that relays
  edit/move/leave events between connected clients. Holds its own
  authoritative `World` (edits only, never generates terrain) purely to
  answer the question "what's changed?" for a newly-connecting client —
  see the multiplayer note above.

## Test

```
npm test
```

Runs unit tests (`node --test`) for noise, terrain rules, chunk-aware world
generation/raycasting (including determinism across chunk and negative
coordinates, and boundary-straddling trees), procedural textures, mesh
face-culling and UV mapping, inventory accounting, crafting recipes,
frame-rate-independent damping (including angle wraparound), sound preset
data, shared physics, and player/mob movement (including that mob AI is
deterministic for a given rng) — the entire simulation core, with no
browser or WebGL required.

## Limitations

This is a tech-demo scale sandbox, not a game: only 3 crafting recipes
(planks/brick/glass) and no deeper progression (tools, armor, multi-step
chains), and mobs are purely decorative and unsynced — each
client's mobs wander independently, with no interaction with the player,
each other, or combat. Multiplayer is real but intentionally minimal: no
chat, no player-vs-player interaction beyond seeing each other move and
each other's edits, and inventories are per-client, not shared. The
server's authoritative World (edits only) also grows unboundedly over a
long-running server's uptime, the same tradeoff `evictFarChunks` solves on
the client but that doesn't apply server-side, since it has no player
position to measure "far" from. Anything taller than a
single block (a tree trunk, a cliff face) still fully blocks walking into
it — jump over it or go around; single-block ledges auto-step. The world
itself is no longer the limiting factor: chunks stream in as you
walk, generation and re-meshing are budgeted per frame, editing only
rebuilds the touched chunk(s), and unedited chunks far from the player are
evicted from memory (an edited chunk never is, since there's nowhere else
its changes are recorded until the next save) — so memory stays bounded by
render distance plus wherever you've actually built, not by how far you've
walked in total.
