import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPE_SIZE, ROCK_PRESETS, ROCK_SLOTS, ROCK_TYPES, packRecipe, rockRecipesOf } from '../src/gen/rockTypes';
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
  assert.deepEqual(new Level(1, 12).rockRecipes, rockRecipesOf(1, 12));
  assert.equal(ROCK_PRESETS.salt.salt, 1);
  for (const t of ROCK_TYPES) if (t !== 'salt') assert.equal(ROCK_PRESETS[t].salt, 0);
});

test('levels 1-10 carry the presets; a stratum draws its own stone, the same on all its levels', () => {
  for (const d of [0, 1, 10]) rockRecipesOf(5, d).forEach((r, i) => assert.equal(r, ROCK_PRESETS[ROCK_TYPES[i]]));
  const a = rockRecipesOf(5, 11), b = rockRecipesOf(5, 17);
  assert.deepEqual(a, b);
  assert.deepEqual(a, rockRecipesOf(5, 11));
  assert.notDeepEqual(a, rockRecipesOf(5, 21));
  assert.notDeepEqual(a, rockRecipesOf(6, 11));
  assert.notDeepEqual(a.map((r) => r.base), ROCK_TYPES.map((t) => ROCK_PRESETS[t].base));
});

test('drawn stone stays drawable, and deep strata somewhere glow or stray far', () => {
  let glowing = 0, strayed = 0;
  for (let seed = 1; seed <= 40; seed++)
    for (const d of [11, 21, 41, 61, 91]) {
      const rs = rockRecipesOf(seed, d);
      if (rs[0].glow > 0) glowing++;
      for (const [i, r] of rs.entries()) {
        for (const v of [...r.base, ...r.bedColor, ...r.veinColor]) assert.ok(v >= 0 && v < 10, `colour ${v}`);
        assert.ok(r.bed >= 0 && r.bed <= 1 && r.laminae >= 0 && r.laminae <= 0.9 && r.vein >= 0 && r.vein <= 1);
        assert.ok(r.spots >= -2 && r.spots <= 2 && r.cleavage >= 0 && r.cleavage <= 0.8);
        assert.equal(r.salt, ROCK_PRESETS[ROCK_TYPES[i]].salt);
        const p = ROCK_PRESETS[ROCK_TYPES[i]].base;
        if (Math.max(...r.base.map((v, k) => Math.abs(v - p[k]))) > 0.5) strayed++;
      }
    }
  assert.ok(glowing > 0, 'no stratum glows');
  assert.ok(strayed > 0, 'no stone strays');
});
