import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { Horseradish, RADISH, type Root } from '../src/combat/horseradish';
import { Cooked } from '../src/loot/recipes';
import type { Fighter } from '../src/combat/combat';

const DT = 1 / 60;
const flat = (): number => 0;

function dummy(x: number, z: number, health = 500): Fighter & { health: number; cause: string } {
  return { x, y: 0, z, vx: 0, vz: 0, radius: 0.3, height: 0.6, health, cause: '', get dead() { return this.health <= 0; }, hurt(a: number, c: string) { this.health -= a; this.cause = c; } };
}

/** Step until the root is gone (or `max` seconds), recording the phases it went through and its bites. */
function run(h: Horseradish, foes: Fighter[], max = 20): { phases: string[]; bites: number } {
  const phases: string[] = [], rng = new Rng(5);
  let bites = 0;
  for (let t = 0; t < max && h.roots.length; t += DT) {
    const r: Root = h.roots[0];
    if (phases[phases.length - 1] !== r.phase) phases.push(r.phase);
    bites += h.tunnel(DT, foes, flat, rng).length;
  }
  return { phases, bites };
}

test('by rank, a root bites once, twice, three times', () => {
  for (const rank of [1, 2, 3]) {
    const rooting = Cooked.from({ horseradish: rank }).horseradish!, h = new Horseradish(), rat = dummy(0, -12);
    h.set(0, 0, 0, rat, rooting);
    const { phases, bites } = run(h, [rat]);
    assert.equal(bites, rank, `rank ${rank}`);
    assert.deepEqual(phases, ['dig', 'rise', 'up', 'shrivel']);
    assert.equal(rat.cause, 'horseradish');
    assert.ok(rat.health <= 500 - rank * rooting.damage[0]);
    assert.equal(h.roots.length, 0, 'it shrivelled away');
  }
});

test('it tunnels fast, straight at its quarry, and comes up next to it', () => {
  const rooting = Cooked.from({ horseradish: 1 }).horseradish!, h = new Horseradish(), rat = dummy(9, 0);
  const r = h.set(0, 0, 0, rat, rooting);
  let t = 0;
  while (r.phase === 'dig' && t < 5) { h.tunnel(DT, [rat], flat, new Rng(1)); t += DT; }
  assert.equal(r.phase, 'rise');
  assert.ok(t < 9 / RADISH.speed + 0.1, `there in ${t.toFixed(2)} s`);
  assert.ok(Math.hypot(rat.x - r.x, rat.z - r.z) - rat.radius <= RADISH.near + 1e-6);
  assert.ok(Math.abs(r.z) < 1e-9, 'straight there');
});

test('one that gets away is dug after; a dead quarry hands it to the next; with none near it shrivels', () => {
  const rooting = Cooked.from({ horseradish: 3 }).horseradish!, rng = new Rng(2);
  const h = new Horseradish(), rat = dummy(4, 0, 30), dog = dummy(8, 3);
  const r = h.set(0, 0, 0, rat, rooting);
  let dived = false;
  for (let t = 0; t < 12 && h.roots.length; t += DT) {
    // The rat runs off once the root is up, until it sees it dive.
    if (r.phase === 'up' && !dived) rat.x += 6 * DT;
    h.tunnel(DT, [rat, dog], flat, rng);
    dived ||= r.phase === 'dive';
  }
  assert.ok(dived, 'it dived after the rat');
  assert.ok(rat.dead, 'and got it');
  assert.ok(dog.health < 500, 'then went after the dog');
  const lone = new Horseradish(), mouse = dummy(5, 0);
  lone.set(0, 0, 0, mouse, rooting);
  mouse.health = 0;
  const { phases, bites } = run(lone, [mouse]);
  assert.equal(bites, 0);
  assert.deepEqual(phases, ['dig', 'rise', 'shrivel']);
});

test('it never bites what is not its quarry, and gives up after digging too long', () => {
  const rooting = Cooked.from({ horseradish: 1 }).horseradish!, h = new Horseradish();
  const quick = dummy(4, 0), stander = dummy(0.5, 0);
  const r = h.set(0, 0, 0, quick, rooting);
  for (let t = 0; t < RADISH.digs + 1 && h.roots.length; t += DT) {
    quick.x += RADISH.speed * 1.2 * DT;
    h.tunnel(DT, [quick, stander], flat, new Rng(1));
  }
  assert.equal(stander.health, 500);
  assert.equal(quick.health, 500);
  assert.ok(r.phase === 'rise' || r.phase === 'shrivel');
});
