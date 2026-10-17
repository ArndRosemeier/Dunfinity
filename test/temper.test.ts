import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { AGGRESSION, bestiaryOf, type Species } from '../src/creatures/bestiary';
import { Critters, HERD, natureOf, type Critter, type Herd } from '../src/creatures/critters';
import { rangeOf } from '../src/creatures/animals';
import { ALARMS, FLOCKS, HABITS, LAMPS, PACES, STRATEGIES, temperOf } from '../src/creatures/temper';
import { damage, type Fighter } from '../src/combat/combat';

type Prey = Fighter & { taken: number };
const someone = (l: Level, x: number, z: number): Prey => ({
  x, y: l.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function many(): Species[] {
  const out: Species[] = [];
  for (let seed = 1; seed <= 12; seed++) for (const d of [1, 4, 9, 14, 25, 40]) out.push(...bestiaryOf(seed, d));
  return out;
}

/** Wake a herd that `pick` likes next to someone (`away` metres off). */
function wake(pick: (h: Herd) => boolean, away = 8): { c: Critters; me: Prey; h: Herd; l: Level } | null {
  for (let seed = 1; seed <= 12; seed++) for (const depth of [2, 5, 9, 14, 25]) {
    const l = new Level(seed, depth), c = new Critters(l), [ax, , az] = l.arrival;
    for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
      const h = c.denAt(Math.floor(ax / HERD.cell) + i, Math.floor(az / HERD.cell) + j);
      if (!h || !pick(h)) continue;
      const me = someone(l, h.x + away, h.z);
      c.advance(0.1, me);
      if (c.list.some((x) => x.herd === h)) return { c, me, h, l };
    }
  }
  return null;
}

test('a temper is the same every time and as varied as the bodies: every pace, flock, alarm, habit, lamp and strategy turns up', () => {
  const all = many();
  for (const sp of all.slice(0, 20)) assert.deepEqual(temperOf(sp), temperOf({ ...sp }));
  const seen = (pick: (t: ReturnType<typeof temperOf>) => string) => new Set(all.map((s) => pick(temperOf(s))));
  for (const [name, values, got] of [['pace', PACES, seen((t) => t.pace)], ['flock', FLOCKS, seen((t) => t.flock)], ['alarm', ALARMS, seen((t) => t.alarm)], ['habit', HABITS, seen((t) => t.habit)], ['lamp', LAMPS, seen((t) => t.lamp)], ['strategy', STRATEGIES, seen((t) => t.strategy)]] as const) {
    for (const v of values) assert.ok(got.has(v), `${name} ${v} never turns up`);
  }
  const cur = all.map((s) => temperOf(s).curious);
  assert.ok(Math.min(...cur) < -0.4 && Math.max(...cur) > 0.5, 'shy ones and curious ones');
});

test('the more aggressive, the further off it comes for you; one that leaves you be has no range', () => {
  const sp = bestiaryOf(3, 9)[0];
  let last = 0;
  for (const a of [0.56, 0.65, 0.8, 1]) {
    const r = rangeOf({ ...natureOf(sp), aggression: a, peaceful: false }, 1);
    assert.ok(r > last, `range ${r} at ${a}`);
    last = r;
  }
  assert.equal(rangeOf({ ...natureOf(sp), aggression: 0.4, peaceful: true }, 1), 0);
});

test('the most passive only run, even when hit; nothing peaceful ever hurts you unprovoked (habits, warnings, curiosity)', () => {
  const w = wake((h) => h.species.aggression < AGGRESSION.retaliate);
  assert.ok(w, 'a passive herd');
  for (let k = 0; k < 900; k++) w.c.advance(1 / 30, w.me);
  assert.equal(w.me.taken, 0, 'no harm in 30 s near them');
  const a = w.c.list.find((x) => x.herd === w.h && !x.dead) as Critter;
  w.me.x = a.x + 0.8; w.me.z = a.z; w.me.y = a.y;
  damage(a, 1, w.me.x, w.me.z, 0, 'knife');
  for (let k = 0; k < 120; k++) {
    w.c.advance(1 / 30, w.me);
    assert.notEqual(a.mode, 'fight');
    assert.ok(!a.action || a.action === '', `${a.species.id} struck back (${a.action})`);
  }
  assert.equal(w.me.taken, 0);
});

test('a herd that freezes in alarm stands stock still when you come close', () => {
  const w = wake((h) => h.species.peaceful && temperOf(h.species).alarm === 'freeze' && temperOf(h.species).curious < 0.3 && h.species.role !== 'giant' && h.species.role !== 'watcher' && !temperOf(h.species).bluff, 30);
  assert.ok(w, 'a freezing herd');
  const a = w.c.list.find((x) => x.herd === w.h && !x.dead) as Critter;
  // Step up to it, a little outside where it would bolt.
  const len = Math.max(0.2, a.species.totalLength * a.size);
  w.me.x = a.x + len + 2.5; w.me.z = a.z; w.me.y = a.y;
  let froze = false;
  for (let k = 0; k < 60 && !froze; k++) { w.c.advance(1 / 30, w.me); froze = a.mode === 'freeze'; }
  assert.ok(froze, `${a.species.id} did not freeze (${a.mode})`);
  const x = a.x, z = a.z;
  for (let k = 0; k < 30; k++) w.c.advance(1 / 30, w.me);
  assert.ok(a.mode !== 'freeze' || Math.hypot(a.x - x, a.z - z) < 0.05, 'still while frozen');
});
