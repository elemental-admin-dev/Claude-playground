// A tiny recipe system on top of Inventory: each recipe spends some input
// blocks for some output blocks. No furnace/heat mechanic — treat these as
// simplified stand-ins (stone -> brick, sand -> glass) for what would
// normally need smelting.

import { BLOCKS } from "./blocks.js";

const RECIPES = [
  { id: "planks", name: "Planks", inputs: { [BLOCKS.WOOD]: 1 }, outputs: { [BLOCKS.PLANKS]: 4 } },
  { id: "brick", name: "Brick", inputs: { [BLOCKS.STONE]: 2 }, outputs: { [BLOCKS.BRICK]: 1 } },
  { id: "glass", name: "Glass", inputs: { [BLOCKS.SAND]: 2 }, outputs: { [BLOCKS.GLASS]: 1 } },
];

function getRecipe(id) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

function canCraft(inventory, recipe) {
  return Object.entries(recipe.inputs).every(([blockId, count]) => inventory.has(Number(blockId), count));
}

/**
 * Attempts to craft `recipeId` from `inventory`. Returns true and mutates
 * the inventory (inputs removed, outputs added) on success; returns false
 * (a no-op) if the recipe doesn't exist or there isn't enough of an input.
 */
function craft(inventory, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe || !canCraft(inventory, recipe)) return false;
  for (const [blockId, count] of Object.entries(recipe.inputs)) inventory.remove(Number(blockId), count);
  for (const [blockId, count] of Object.entries(recipe.outputs)) inventory.add(Number(blockId), count);
  return true;
}

/**
 * Crafts `recipeId` repeatedly - as many times as the current inventory
 * allows in one call - stopping the moment there isn't enough of an input
 * left. Returns how many times it crafted (0 if not even once). Useful
 * for a "bulk craft" input that turns a whole stack of raw material into
 * its refined form in one keypress instead of one unit at a time.
 */
function craftMax(inventory, recipeId) {
  let count = 0;
  while (craft(inventory, recipeId)) count++;
  return count;
}

export { RECIPES, getRecipe, canCraft, craft, craftMax };
