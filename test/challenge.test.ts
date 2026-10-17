import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOf, knowledgeOf, tierOf, wordOf, type Might } from '../src/combat/challenge';
import { STAB } from '../src/combat/combat';
import { MOVE } from '../src/world/traverse/body';
import { RAT } from '../src/creatures/rats';
import { TOUCHED } from '../src/creatures/touched';
import { TALL } from '../src/creatures/tallOne';

/** A new grandchild with grandma's kitchen knife. */
const you: Might = { health: MOVE.maxHealth, blow: (STAB.damage[0] + STAB.damage[1]) / 2, every: STAB.dur };
const mean = (r: readonly [number, number]) => (r[0] + r[1]) / 2;

test('Salt Sight measures a fight against you: a rat is easy, a Salt-Touched a fight, a Tall One run, a grazing colossus deadly', () => {
  assert.equal(tierOf({ health: RAT.health, blow: mean(RAT.biteDamage), every: 1.4 }, you), 0);
  const touched = tierOf({ health: TOUCHED.health, blow: mean(TOUCHED.swing.damage), every: TOUCHED.swing.dur + TOUCHED.swing.rest }, you);
  assert.ok(touched >= 1 && touched <= 2, `Salt-Touched: ${touched}`);
  assert.ok(tierOf({ health: TALL.health, blow: mean(TALL.reach.damage), every: TALL.reach.dur + TALL.reach.rest }, you) >= 3, 'a Tall One: run or worse');
  assert.equal(tierOf({ health: 900, blow: 60, every: 2 }, you), 4, 'a ten-metre grazer');
  // A helmet (armour) and a better blade make the same foe less of a fight.
  const foe: Might = { health: 120, blow: 25, every: 1.4 };
  assert.ok(tierOf(foe, { ...you, blow: you.blow * 3 }, 0.5) < tierOf(foe, you));
});

test('a kind never fought still gives a rough read; a few kills a guess; then it is sure', () => {
  assert.equal(knowledgeOf(0), 'untested');
  assert.equal(knowledgeOf(1), 'guess');
  assert.equal(knowledgeOf(3), 'known');
  assert.equal(wordOf(4, 'untested'), 'looks deadly', 'never nothing: a deadly one always looks deadly');
  assert.equal(wordOf(0, 'untested'), 'looks harmless');
  assert.equal(wordOf(2, 'guess'), 'risky?');
  assert.equal(wordOf(3, 'known'), 'run');
  assert.deepEqual([0, 1, 2, 3, 4].map((t) => bandOf(t as 0)), [0, 0, 1, 2, 2]);
});
