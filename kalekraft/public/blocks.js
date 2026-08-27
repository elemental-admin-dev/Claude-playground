// Block type registry: ids, display names, render colors, and physical properties.

const BLOCKS = Object.freeze({
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  BEDROCK: 8,
});

const BLOCK_INFO = {
  [BLOCKS.STONE]: { name: "Stone", color: [0.5, 0.5, 0.52], solid: true },
  [BLOCKS.DIRT]: { name: "Dirt", color: [0.45, 0.32, 0.2], solid: true },
  [BLOCKS.GRASS]: { name: "Grass", color: [0.36, 0.62, 0.28], solid: true },
  [BLOCKS.SAND]: { name: "Sand", color: [0.86, 0.78, 0.55], solid: true },
  [BLOCKS.WATER]: { name: "Water", color: [0.2, 0.45, 0.85], solid: false, transparent: true },
  [BLOCKS.WOOD]: { name: "Wood", color: [0.42, 0.29, 0.16], solid: true },
  [BLOCKS.LEAVES]: { name: "Leaves", color: [0.2, 0.5, 0.18], solid: true },
  [BLOCKS.BEDROCK]: { name: "Bedrock", color: [0.15, 0.15, 0.17], solid: true },
};

// Selectable in the hotbar, in slot order. Water/bedrock are world-generated only.
const HOTBAR_BLOCKS = [BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.SAND, BLOCKS.WOOD, BLOCKS.LEAVES];

function isSolid(id) {
  return id !== BLOCKS.AIR && BLOCK_INFO[id]?.solid !== false;
}

function isOpaque(id) {
  return id !== BLOCKS.AIR && !BLOCK_INFO[id]?.transparent;
}

export { BLOCKS, BLOCK_INFO, HOTBAR_BLOCKS, isSolid, isOpaque };
