import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { Critters, HERD, HUNT, fitSize, powerOf, type Critter, type Herd } from '../src/creatures/critters';
import { damage, type Fighter } from '../src/combat/combat';
import { temperOf } from '../src/creatures/temper';

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

test('no animals in grandma\'s cellar; a few herds from level 1, more deeper, and some hunters among them', () => {
  assert.equal(herds(new Critters(new Level(1, 0)), new Level(1, 0)).length, 0);
  let shallow = 0, deep = 0, hunters = 0;
  for (const seed of [1, 2, 3]) {
    const a = new Level(seed, 2), b = new Level(seed, 14);
    const ha = herds(new Critters(a), a), hb = herds(new Critters(b), b);
    for (const h of [...ha, ...hb]) {
      if (h.species.peaceful) assert.equal(h.scale, 1);
      else hunters++;
    }
    shallow += ha.filter((h) => h.species.peaceful).length; deep += hb.filter((h) => h.species.peaceful).length;
  }
  assert.ok(shallow > 0, 'some herds on level 2');
  assert.ok(deep > shallow, `deeper has more (${shallow} vs ${deep})`);
  assert.ok(hunters > 0, 'some hunters');
});

test('a hunter is grown to a fair fight for its level: small and weak on level 1, big and strong deep down', () => {
  for (const seed of [1, 2, 3, 4]) for (const depth of [1, 4, 9, 30]) {
    for (const sp of new Critters(new Level(seed, depth)).species.filter((s) => !s.peaceful)) {
      const size = fitSize(sp, depth), p = powerOf(sp, size), want = (HUNT.base + HUNT.per * depth) * HUNT.strategy[temperOf(sp).strategy];
      if (size > HUNT.size[0] && size < HUNT.size[1]) assert.ok(Math.abs(p.health - want) < want * 0.02, `${sp.id} health ${p.health} for ${want}`);
      if (depth <= 9 && temperOf(sp).strategy !== 'charge') assert.ok(p.health < 60 && p.blow < 15, `${sp.id} on level ${depth}: ${JSON.stringify(p)}`);
    }
  }
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
    const w = wake(seed, depth, (h) => h.species.peaceful);
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
    const w = wake(seed, depth, (h) => h.species.peaceful);
    if (!w) continue;
    const prev = new Map<number, [number, number]>(), flips = new Map<number, number>();
    for (let k = 0; k < 600; k++) {
      w.c.advance(1 / 30, w.me);
      for (const a of w.c.list) {
        if (!a.species.peaceful) continue;
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
    for (const [id, n] of flips) assert.ok(n < 40, `animal ${id} reversed ${n} times in 20 s (jitter)`);
  }
});

test('hunters come for you: a tell, then the blow; then they spring back and come again', () => {
  let found = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const depth of [2, 6, 14]) {
    const w = wake(seed, depth, (h) => !h.species.peaceful);
    if (!w) continue;
    found++;
    const pack = w.c.list.filter((x) => x.herd === w.h);
    // Stand on their floor (they cannot climb to a ledge), near enough that even the shortest-ranged one comes.
    for (let a = 0; a < 12; a++) {
      const x = pack[0].x + Math.cos(a) * 1.4, z = pack[0].z + Math.sin(a) * 1.4;
      if (Math.abs(w.l.groundAt(x, z) - pack[0].y) < 0.2 && w.l.sdf(x, pack[0].y + 1, z) > 0.5) { w.me.x = x; w.me.z = z; w.me.y = w.l.groundAt(x, z); break; }
    }
    let hits = 0, struckBeforeTell = false, backs = 0;
    for (let k = 0; k < 900 && (hits < 3 || !backs); k++) {
      const before = w.me.taken;
      w.c.advance(1 / 30, w.me);
      if (w.me.taken > before) {
        hits++;
        // (One its warning drove to fight back bites as any animal does, after the calm tell.)
        const tell = (a: Critter) => a.mode === 'fight' ? HERD.windup : HUNT.windup[temperOf(a.species).strategy];
        if (!pack.some((a) => a.action && a.actionT * HERD.strike >= tell(a))) struckBeforeTell = true;
      }
      if (pack.some((a) => a.mode === 'back')) backs++;
    }
    assert.ok(hits > 0, `${w.h.species.id} on level ${depth} (seed ${seed}) never struck: ${pack.map((a) => `${a.mode} ${Math.hypot(a.x - w.me.x, a.z - w.me.z).toFixed(1)} dy ${(a.y - w.me.y).toFixed(1)}`).join(', ')}`);
    assert.ok(!struckBeforeTell, `${w.h.species.id} struck before its tell`);
    assert.ok(backs > 0, `${w.h.species.id} never sprang back`);
  }
  assert.ok(found >= 3, `hunters found: ${found}`);
});

test('a beaten hunter runs, and its pack keeps away from you meanwhile', () => {
  let n = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const depth of [3, 14]) {
    const w = wake(seed, depth, (h) => !h.species.peaceful);
    if (!w) continue;
    const a = w.c.list.find((x) => x.herd === w.h && !x.dead) as Critter;
    a.health = a.maxHealth * 0.25;
    damage(a, 0.01, a.x + 0.5, a.z, 0, 'knife');
    w.c.advance(0.05, w.me);
    assert.equal(a.mode, 'flee', `${a.species.id} did not run (${a.mode})`);
    n++;
  }
  assert.ok(n > 0);
});

test('waiting their turn round you, hunters do not jitter', () => {
  let n = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const depth of [3, 14]) {
    const w = wake(seed, depth, (h) => !h.species.peaceful);
    if (!w) continue;
    n++;
    const pack = w.c.list.filter((x) => x.herd === w.h), last = new Map<number, [number, number]>(), flips = new Map<number, number>();
    for (let k = 0; k < 600; k++) {
      const at = new Map(pack.map((a) => [a.id, [a.x, a.z] as const]));
      w.c.advance(1 / 30, w.me);
      for (const a of pack) {
        // Only while it waits: a blow and the spring back after it are meant to go to and fro.
        if (a.mode !== 'stalk' || a.action || a.dead) { last.delete(a.id); continue; }
        const [x0, z0] = at.get(a.id)!, v: [number, number] = [a.x - x0, a.z - z0], was = last.get(a.id);
        if (was && v[0] * was[0] + v[1] * was[1] < -1e-6 && Math.hypot(...v) > 2e-3) flips.set(a.id, (flips.get(a.id) ?? 0) + 1);
        last.set(a.id, v);
      }
    }
    for (const [id, f] of flips) assert.ok(f < 25, `${w.h.species.id} ${id} reversed ${f} times in 20 s while waiting (jitter)`);
  }
  assert.ok(n > 0);
});
