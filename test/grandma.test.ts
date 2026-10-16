import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR } from '../src/gen/cellar';
import { GRANDMA, Grandma, kinName } from '../src/world/grandma';
import type { Fallen } from '../src/gen/notary';

/** Walk the grandchild to (x, z) and step her for `secs`, collecting what she says. */
function steps(g: Grandma, from: number, secs: number, x: number, z: number, kin: Parameters<Grandma['keep']>[5]): string[] {
  const said: string[] = [];
  for (let t = from; t < from + secs; t += 0.1) {
    const w = g.keep(0.1, t, x, 0, z, kin);
    if (w) said.push(w);
  }
  return said;
}

test('she stands in the round room, in the air, near enough to the way in to be met', () => {
  const g = new Grandma(), level = new Level(1, 0);
  assert.ok(level.sdf(g.x, 1, g.z) > 0.3, 'in the air, not in a wall');
  assert.ok(Math.hypot(g.x - CELLAR.room.x, g.z - CELLAR.room.z) < CELLAR.room.r, 'in the round room');
  assert.ok(Math.hypot(CELLAR.start.x - g.x, CELLAR.start.z - g.z) < GRANDMA.notice, 'a grandchild arriving is near enough');
});

test('she is not there until a grandchild comes, then rises, speaks once, and fades away', () => {
  const g = new Grandma(), kin = { deepest: 0, fallen: [], seed: 1 };
  assert.deepEqual(steps(g, 0, 10, CELLAR.start.x, CELLAR.start.z, kin), [], 'nobody arrived: nothing');
  assert.equal(g.mode, 'away');
  g.arrive(1);
  const said = steps(g, 10, 20, CELLAR.start.x, CELLAR.start.z, kin);
  assert.equal(said.length, 1);
  assert.match(said[0], /tin/);
  assert.equal(g.mode, 'away', 'gone again');
  g.arrive(1);
  assert.deepEqual(steps(g, 30, 20, CELLAR.start.x, CELLAR.start.z, kin), [], 'back up from nowhere deep: nothing more to say');
});

test('a new grandchild hears of the cousin who fell, by name and where, not how', () => {
  const g = new Grandma(), fallen: Fallen[] = [{ heir: 1, depth: 4, what: 'a rat bites' }];
  g.arrive(2);
  const [w] = steps(g, 0, 20, CELLAR.start.x, CELLAR.start.z, { deepest: 4, fallen, seed: 7 });
  assert.ok(w.toLowerCase().includes(kinName(1, 7).toLowerCase()), w);
  assert.match(w, /level 4/);
  assert.doesNotMatch(w, /rat/);
});

test('back up from below she has the newest line the family has opened, once each, and nothing past it', () => {
  const g = new Grandma(), kin = { deepest: 10, fallen: [], seed: 1 };
  g.arrive(1);
  steps(g, 0, 20, CELLAR.start.x, CELLAR.start.z, kin);
  g.arrive(1);
  const [arch] = steps(g, 20, 20, CELLAR.start.x, CELLAR.start.z, kin);
  assert.match(arch, /didn't break it/);
  g.arrive(1);
  const [next] = steps(g, 40, 20, CELLAR.start.x, CELLAR.start.z, kin);
  assert.doesNotMatch(next, /didn't break it|town|Chalk/, 'nothing from deeper than the family has been');
});

test('she waits for the grandchild to come near', () => {
  const g = new Grandma(), kin = { deepest: 0, fallen: [], seed: 1 };
  g.arrive(1);
  assert.deepEqual(steps(g, 0, 20, CELLAR.cellar.x[0], 0, kin), [], 'still in the brick cellar: nothing');
  assert.equal(steps(g, 20, 20, CELLAR.start.x, CELLAR.start.z, kin).length, 1);
});
