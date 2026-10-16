import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPE_SIZE, ROCK_PRESETS, ROCK_SLOTS, ROCK_TYPES, packRecipe } from '../src/gen/rockTypes';
import { Level } from '../src/gen/level';

test('a recipe packs into RECIPE_SIZE numbers, in the shader order', () => {
  const out = new Array<number>(RECIPE_SIZE + 2).fill(-1);
  packRecipe(ROCK_PRESETS.sandstone, out, 1);
  assert.equal(out[0], -1);
  assert.equal(out[RECIPE_SIZE + 1], -1);
  assert.deepEqual(out.slice(1, 5), [...ROCK_PRESETS.sandstone.base, 1]);
  assert.equal(out[1 + 15], ROCK_PRESETS.sandstone.glow);
});

test('the presets fill the slots in RockMix order (no visible change from the hand-coded types)', () => {
  const level = new Level(1, 3);
  assert.equal(level.rockRecipes.length, ROCK_SLOTS);
  ROCK_TYPES.forEach((t, i) => assert.equal(level.rockRecipes[i], ROCK_PRESETS[t]));
  assert.equal(ROCK_PRESETS.salt.salt, 1);
  for (const t of ROCK_TYPES) if (t !== 'salt') assert.equal(ROCK_PRESETS[t].salt, 0);
});
