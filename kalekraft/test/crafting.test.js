import test from "node:test";
import assert from "node:assert/strict";
import { Inventory } from "../public/inventory.js";
import { RECIPES, getRecipe, canCraft, craft, craftMax } from "../public/crafting.js";
import { BLOCKS } from "../public/blocks.js";

test("every recipe references real, distinct block ids in inputs and outputs", () => {
  const knownIds = new Set(Object.values(BLOCKS));
  for (const recipe of RECIPES) {
    for (const id of [...Object.keys(recipe.inputs), ...Object.keys(recipe.outputs)]) {
      assert.ok(knownIds.has(Number(id)), `${recipe.id} references unknown block id ${id}`);
    }
  }
});

test("getRecipe finds a known recipe and returns null for an unknown one", () => {
  assert.equal(getRecipe("planks")?.id, "planks");
  assert.equal(getRecipe("not-a-recipe"), null);
});

test("canCraft is false without enough of an input", () => {
  const inventory = new Inventory();
  const recipe = getRecipe("planks");
  assert.equal(canCraft(inventory, recipe), false);
  inventory.add(BLOCKS.WOOD, 1);
  assert.equal(canCraft(inventory, recipe), true);
});

test("craft succeeds, spending inputs and granting outputs", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.WOOD, 3);
  const ok = craft(inventory, "planks");
  assert.equal(ok, true);
  assert.equal(inventory.count(BLOCKS.WOOD), 2); // spent 1 of 3
  assert.equal(inventory.count(BLOCKS.PLANKS), 4); // granted 4
});

test("craft fails and is a no-op without enough inputs", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.STONE, 1); // brick needs 2
  const ok = craft(inventory, "brick");
  assert.equal(ok, false);
  assert.equal(inventory.count(BLOCKS.STONE), 1); // unchanged
  assert.equal(inventory.count(BLOCKS.BRICK), 0);
});

test("craft fails for an unknown recipe id, without touching the inventory", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.WOOD, 5);
  const ok = craft(inventory, "nonexistent");
  assert.equal(ok, false);
  assert.equal(inventory.count(BLOCKS.WOOD), 5);
});

test("crafting glass spends exactly the sand it needs, repeatedly", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.SAND, 5);
  assert.equal(craft(inventory, "glass"), true);
  assert.equal(inventory.count(BLOCKS.SAND), 3);
  assert.equal(inventory.count(BLOCKS.GLASS), 1);
  assert.equal(craft(inventory, "glass"), true);
  assert.equal(inventory.count(BLOCKS.SAND), 1);
  assert.equal(inventory.count(BLOCKS.GLASS), 2);
  assert.equal(craft(inventory, "glass"), false); // only 1 sand left, needs 2
});

test("craftMax crafts repeatedly until an input runs out, returning how many times", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.SAND, 7); // glass needs 2 sand each -> 3 crafts, 1 left over
  const count = craftMax(inventory, "glass");
  assert.equal(count, 3);
  assert.equal(inventory.count(BLOCKS.SAND), 1);
  assert.equal(inventory.count(BLOCKS.GLASS), 3);
});

test("craftMax returns 0 and is a no-op when there isn't enough for even one craft", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.STONE, 1); // brick needs 2
  const count = craftMax(inventory, "brick");
  assert.equal(count, 0);
  assert.equal(inventory.count(BLOCKS.STONE), 1);
  assert.equal(inventory.count(BLOCKS.BRICK), 0);
});

test("craftMax returns 0 for an unknown recipe id, without touching the inventory", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.WOOD, 5);
  const count = craftMax(inventory, "nonexistent");
  assert.equal(count, 0);
  assert.equal(inventory.count(BLOCKS.WOOD), 5);
});

test("craftMax on an exact multiple leaves nothing of the input behind", () => {
  const inventory = new Inventory();
  inventory.add(BLOCKS.WOOD, 4); // planks needs 1 wood each -> exactly 4 crafts
  const count = craftMax(inventory, "planks");
  assert.equal(count, 4);
  assert.equal(inventory.count(BLOCKS.WOOD), 0);
  assert.equal(inventory.count(BLOCKS.PLANKS), 16); // 4 crafts x 4 planks each
});
