import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { RAT, Rats, type Nest } from '../src/creatures/rats';
import { Dogs, TOWN_DOG, type Pack } from '../src/creatures/dogs';
import { Critters, HERD, type Herd } from '../src/creatures/critters';
import { pastureOf } from '../src/creatures/pasture';
import { CRICKET, Crickets, type Group } from '../src/creatures/crickets';
import { SLIME, Slimes, type Colony } from '../src/creatures/slimes';
import { EEL, Eels, type Pool } from '../src/creatures/eels';
import { LIFE } from '../src/creatures/life';
import { afterYou } from '../src/creatures/animals';
import { VILLAGE, townGround } from '../src/gen/town';
import type { Fighter } from '../src/combat/combat';
import type { Creature } from '../src/creatures/creature';

type Prey = Fighter & { taken: number };
const someone = (x: number, y: number, z: number): Prey => ({
  x, y, z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function dens<D>(p: { denAt(i: number, j: number): D | null }, cell: number, x: number, z: number, n = 8): D[] {
  const out: D[] = [], ci = Math.floor(x / cell), cj = Math.floor(z / cell);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const d = p.denAt(ci + i, cj + j); if (d) out.push(d); }
  return out;
}

/** Someone standing still `away` metres off den d, on its floor. */
function off(l: Level, d: { x: number; y: number; z: number }, away: number): Prey {
  for (let a = 0; a < 24; a++) {
    const x = d.x + Math.cos(a) * away, z = d.z + Math.sin(a) * away, y = l.groundAt(x, z, d.y + 1);
    if (Math.abs(y - d.y) < 3 && l.sdf(x, y + 1, z) > 0.5) return someone(x, y, z);
  }
  return someone(d.x + away, d.y, d.z);
}

/** What the animals of one den did over `seconds`: who fed (still, at a food spot), who lay down at rest, and when the den rested. */
function watch<C extends Creature<string> & { readonly id: number }>(step: () => void, list: () => readonly C[], mine: (c: C) => boolean, seconds: number, dt: number) {
  const fed = new Set<number>(), lay = new Set<number>(), feeding = new Map<number, number>();
  let restFrames = 0, upWhileRest = 0, maxFeedSpeed = 0;
  for (let t = 0; t < seconds; t += dt) {
    step();
    const ours = list().filter((c) => mine(c) && !c.dead);
    const down = ours.filter((c) => c.pose === 'rest');
    if (down.length) { restFrames++; if (down.length < ours.length) upWhileRest++; }
    for (const c of ours) {
      // (Still once it has stopped at its food: half a second in.)
      const f = c.pose === 'feed' ? (feeding.get(c.id) ?? 0) + dt : 0;
      feeding.set(c.id, f);
      if (f > 0) fed.add(c.id);
      if (f > 0.5) maxFeedSpeed = Math.max(maxFeedSpeed, Math.hypot(c.vx, c.vz));
      if (c.pose === 'rest') lay.add(c.id);
    }
  }
  return { fed, lay, restFrames, upWhileRest, maxFeedSpeed };
}

test('a pasture is the same every time, on its den\'s dry floor, and its wall and water spots face what they feed on', () => {
  const l = new Level(1, 3), r = new Rats(l);
  const nest = dens<Nest>(r, RAT.cell, l.arrival[0], l.arrival[2]).find((n) => Math.hypot(n.x - l.arrival[0], n.z - l.arrival[2]) > 30)!;
  for (const diet of ['floor', 'wall', 'water', 'bloom'] as const) {
    const a = pastureOf(l, nest, diet, 8, 0.2, 0.32), b = pastureOf(l, nest, diet, 8, 0.2, 0.32);
    assert.deepEqual([a.food, a.nook], [b.food, b.nook]);
    assert.ok(a.food.length > 0, `${diet}: some food`);
    for (const s of a.food) {
      assert.ok(Math.hypot(s.x - nest.x, s.z - nest.z) < 8 * 2 + 3, `${diet}: near home`);
      assert.ok(l.dry(s.x, s.z, 0), `${diet}: dry`);
      if (s.kind === 'wall') assert.ok(l.trace(s.x, s.y + 0.2, s.z, -Math.sin(s.face), 0, -Math.cos(s.face), 2) < 1.5, 'faces the rock');
      if (s.kind === 'water') assert.ok(!l.dry(s.x - Math.sin(s.face) * 1.5, s.z - Math.cos(s.face) * 1.5, 0.02) || !l.dry(s.x - Math.sin(s.face) * 3, s.z - Math.cos(s.face) * 3, 0.02), 'faces the water');
    }
    assert.ok(Math.hypot(a.nook.x - nest.x, a.nook.z - nest.z) < 8 + 0.1, 'a nook near home');
  }
});

test('quarry rats feed, keep still at it, then sleep together with one up as sentry, and wake when you come close', () => {
  const l = new Level(1, 1), r = new Rats(l);
  const nest = dens<Nest>(r, RAT.cell, l.arrival[0], l.arrival[2]).find((n) => Math.hypot(n.x - l.arrival[0], n.z - l.arrival[2]) > 30 && n.count >= LIFE.sentry)!;
  const me = off(l, nest, 30);
  const w = watch(() => { r.advance(1 / 15, me); me.vx = me.vz = 0; }, () => r.list, (x) => x.nest === nest, 320, 1 / 15);
  assert.ok(r.list.some((x) => x.nest === nest), 'the nest woke');
  assert.ok(!r.list.some((x) => x.nest === nest && afterYou(x)) && me.taken === 0, 'they never saw you');
  assert.ok(w.fed.size >= 2, `they fed (${w.fed.size})`);
  assert.ok(w.maxFeedSpeed < 0.3, `still while feeding (${w.maxFeedSpeed.toFixed(2)} m/s)`);
  assert.ok(w.restFrames > 100, `the nest rested (${w.restFrames} frames)`);
  assert.ok(w.lay.size >= nest.count - 1, `all but one lay down (${w.lay.size} of ${nest.count})`);
  assert.ok(w.upWhileRest > 0, 'a sentry stays up');
  // Into its hours of rest, then walk up to it.
  for (let k = 0; k < 4000 && !r.list.some((x) => x.nest === nest && x.pose === 'rest'); k++) r.advance(1 / 15, me);
  const sleeper = r.list.find((x) => x.nest === nest && x.pose === 'rest')!;
  assert.ok(sleeper, 'one asleep');
  const close = off(l, { x: sleeper.x, y: sleeper.y, z: sleeper.z }, 2.5);
  let woke = false;
  for (let k = 0; k < 30; k++) { r.advance(1 / 15, close); woke ||= r.list.some((x) => x.nest === nest && afterYou(x)); }
  assert.ok(woke, 'you woke them');
  assert.ok(r.list.filter((x) => x.nest === nest).every((x) => x.pose !== 'rest'), 'all up');
});

test('village dogs feed and lie down to rest too', () => {
  const town = new Level(1, 0), dogs = new Dogs(town, true), V = VILLAGE.spec;
  const pack = dens<Pack>(dogs, TOWN_DOG.cell, V.x, V.z, 4).sort((a, b) => b.count - a.count)[0];
  const me = someone(pack.x + 25, townGround(pack.x + 25, pack.z).y, pack.z);
  const w = watch(() => { dogs.advance(1 / 15, me, null, 0); me.vx = me.vz = 0; }, () => dogs.list, (g) => g.pack === pack, 320, 1 / 15);
  assert.ok(w.fed.size >= 1, `they fed (${w.fed.size})`);
  assert.ok(w.lay.size >= 1, `they lay down (${w.lay.size})`);
  assert.equal(me.taken, 0);
});

test('the strange animals live the same life: a herd feeds and rests', () => {
  let found = false;
  for (const [seed, depth] of [[1, 14], [2, 14], [3, 20], [4, 12]] as const) {
    const l = new Level(seed, depth), c = new Critters(l);
    const herd = dens<Herd>(c, HERD.cell, l.arrival[0], l.arrival[2], 6).find((h) => h.species.peaceful && h.count >= 2 && h.species.altitude === 0);
    if (!herd) continue;
    const me = off(l, herd, 40);
    const w = watch(() => { c.advance(1 / 15, me, null); me.vx = me.vz = 0; }, () => c.list, (x) => x.herd === herd, 320, 1 / 15);
    if (!c.list.some((x) => x.herd === herd)) continue;
    assert.ok(w.fed.size >= 1, `${herd.species.id} fed`);
    assert.ok(w.lay.size >= 1, `${herd.species.id} rested`);
    found = true;
    break;
  }
  assert.ok(found, 'a herd to watch');
});

test('cave crickets nibble the salt off their rock and sleep on it with their group', () => {
  let found = false;
  for (const [seed, depth] of [[1, 2], [2, 3], [3, 1], [4, 4]] as const) {
    const l = new Level(seed, depth), c = new Crickets(l);
    const group = dens<Group>(c, CRICKET.cell, l.arrival[0], l.arrival[2]).find((g) => Math.hypot(g.x - l.arrival[0], g.z - l.arrival[2]) > 30 && g.perches.length >= 2);
    if (!group) continue;
    const me = off(l, { x: group.x, y: l.groundAt(group.x, group.z), z: group.z }, 40);
    const w = watch(() => { c.advance(1 / 15, me, null); me.vx = me.vz = 0; }, () => c.list, (x) => x.group === group, 320, 1 / 15);
    if (!c.list.some((x) => x.group === group)) continue;
    assert.ok(w.fed.size >= 1, `they fed (${w.fed.size})`);
    assert.ok(w.lay.size >= 1, `they slept (${w.lay.size})`);
    assert.ok(w.maxFeedSpeed < 0.05, 'still on the rock while feeding');
    assert.ok(c.list.filter((x) => x.group === group).every((x) => x.mode === 'perch'), 'they stayed up on their rock');
    found = true;
    break;
  }
  assert.ok(found, 'a group to watch');
});

test('slimes ooze off to feed and sleep with their colony', () => {
  let found = false;
  for (const [seed, depth] of [[1, 3], [2, 4], [3, 5], [4, 6]] as const) {
    const l = new Level(seed, depth);
    for (const s of [new Slimes(l, 'lumen'), new Slimes(l, 'murk')]) {
      const colony = dens<Colony>(s, SLIME.cell, l.arrival[0], l.arrival[2]).find((g) => Math.hypot(g.x - l.arrival[0], g.z - l.arrival[2]) > 30);
      if (!colony) continue;
      const me = off(l, colony, 40);
      const w = watch(() => { s.advance(1 / 15, me, []); me.vx = me.vz = 0; }, () => s.list, (x) => x.colony === colony, 320, 1 / 15);
      if (!s.list.some((x) => x.colony === colony)) continue;
      assert.ok(w.fed.size >= 1, `${s.faction} fed (${w.fed.size})`);
      assert.ok(w.lay.size >= 1, `${s.faction} slept (${w.lay.size})`);
      found = true;
      break;
    }
    if (found) break;
  }
  assert.ok(found, 'a colony to watch');
});

test('brine eels nose along the bottom for food and lie still in their hours of rest', () => {
  let found = false;
  for (const [seed, depth] of [[1, 6], [2, 7], [3, 6], [4, 8], [5, 6]] as const) {
    const l = new Level(seed, depth), e = new Eels(l);
    const pool = dens<Pool>(e, EEL.cell, l.arrival[0], l.arrival[2]).find((p) => Math.hypot(p.x - l.arrival[0], p.z - l.arrival[2]) > 30);
    if (!pool) continue;
    const me = off(l, pool, 40);
    // (Still once it has lain a few seconds: its speed eases off.)
    const lying = new Map<number, number>();
    let restSpeed = 0;
    const w = watch(() => {
      e.advance(1 / 15, me); me.vx = me.vz = 0;
      for (const x of e.list) {
        const t = x.pose === 'rest' ? (lying.get(x.id) ?? 0) + 1 / 15 : 0;
        lying.set(x.id, t);
        if (t > 3) restSpeed = Math.max(restSpeed, x.speed);
      }
    }, () => e.list, (x) => x.pool === pool, 320, 1 / 15);
    if (!e.list.some((x) => x.pool === pool)) continue;
    assert.ok(w.fed.size >= 1, `they foraged (${w.fed.size})`);
    assert.ok(w.lay.size >= 1, `they rested (${w.lay.size})`);
    assert.ok(restSpeed < 0.1, `still at rest (${restSpeed.toFixed(2)} m/s)`);
    found = true;
    break;
  }
  assert.ok(found, 'a pool to watch');
});
