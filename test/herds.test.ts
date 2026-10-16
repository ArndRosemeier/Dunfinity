import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Critters, HERD, powerOf, type Critter, type Herd } from '../src/creatures/critters';
import { damage, type Fighter } from '../src/combat/combat';

type Prey = Fighter & { taken: number };
const someone = (l: Level, x: number, z: number): Prey => ({
  x, y: l.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function herds(c: Critters, l: Level, n = 10): Herd[] {
  const [ax, , az] = l.arrival, out: Herd[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const h = c.denAt(Math.floor(ax / HERD.cell) + i, Math.floor(az / HERD.cell) + j);
    if (h) out.push(h);
  }
  return out;
}

test('no animals in grandma\'s cellar; a few herds of peaceful species from level 1, more deeper', () => {
  assert.equal(herds(new Critters(new Level(1, 0)), new Level(1, 0)).length, 0);
  let shallow = 0, deep = 0;
  for (const seed of [1, 2, 3]) {
    const a = new Level(seed, 2), b = new Level(seed, 14);
    const ha = herds(new Critters(a), a), hb = herds(new Critters(b), b);
    for (const h of [...ha, ...hb]) assert.ok(h.species.peaceful, `${h.species.id} is peaceful`);
    shallow += ha.length; deep += hb.length;
  }
  assert.ok(shallow > 0, 'some herds on level 2');
  assert.ok(deep > shallow, `deeper has more (${shallow} vs ${deep})`);
});

test('power grows with size: a colossus can kill you, a scuttler cannot hurt much', () => {
  const l = new Level(1, 14), c = new Critters(l);
  for (const sp of c.species) {
    const p = powerOf(sp);
    assert.ok(p.health > 0 && p.blow > 0);
  }
  const big = powerOf({ ...c.species[0], mass: 3000 }), small = powerOf({ ...c.species[0], mass: 0.2 });
  assert.ok(big.blow > 50 && big.health > 400, `colossus ${JSON.stringify(big)}`);
  assert.ok(small.blow < 3 && small.health < 6, `scuttler ${JSON.stringify(small)}`);
});

/** Wake a herd next to someone and step them. */
function wake(seed: number, depth: number, pick: (h: Herd) => boolean): { c: Critters; me: Prey; h: Herd; l: Level } | null {
  const l = new Level(seed, depth), c = new Critters(l);
  for (const h of herds(c, l)) {
    if (!pick(h)) continue;
    const me = someone(l, h.x + 6, h.z);
    c.advance(0.1, me);
    if (c.list.some((x) => x.herd === h)) return { c, me, h, l };
  }
  return null;
}

test('hurt, every animal reacts: a heavy one fights back, a light one runs (or nips first)', () => {
  let fought = 0, fled = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const depth of [3, 8, 14, 25]) {
    const w = wake(seed, depth, () => true);
    if (!w) continue;
    const a = w.c.list.find((x) => x.herd === w.h && !x.dead) as Critter;
    damage(a, 1, a.x + 0.5, a.z, 0, 'knife');
    w.c.advance(0.05, w.me);
    assert.ok(a.dead || a.mode === 'fight' || a.mode === 'flee' || a.action !== '', `${a.species.id} ignored a blow (${a.mode})`);
    if (a.mode === 'fight') fought++; else fled++;
  }
  assert.ok(fought + fled > 3, `animals found: ${fought + fled}`);
});

test('they never come after you unprovoked, and none jitters while grazing and wandering', () => {
  for (const seed of [1, 2, 3]) for (const depth of [4, 14]) {
    const w = wake(seed, depth, () => true);
    if (!w) continue;
    const prev = new Map<number, [number, number]>(), flips = new Map<number, number>();
    for (let k = 0; k < 600; k++) {
      w.c.advance(1 / 30, w.me);
      for (const a of w.c.list) {
        assert.notEqual(a.mode, 'fight', `${a.species.id} attacked unprovoked`);
        const p = prev.get(a.id);
        if (p) {
          const vx = a.x - p[0], vz = a.z - p[1];
          const was = (a as unknown as { _v?: [number, number] })._v;
          if (was && vx * was[0] + vz * was[1] < -1e-6 && Math.hypot(vx, vz) > 1e-3) flips.set(a.id, (flips.get(a.id) ?? 0) + 1);
          (a as unknown as { _v?: [number, number] })._v = [vx, vz];
        }
        prev.set(a.id, [a.x, a.z]);
      }
    }
    assert.equal(w.me.taken, 0);
    for (const [id, n] of flips) assert.ok(n < 40, `animal ${id} reversed ${n} times in 20 s (jitter)`);
  }
});
