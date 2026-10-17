import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { DOG, DOG_NATURE, Dogs, type Dog, type Pack } from '../src/creatures/dogs';
import { CALM, HUNTING } from '../src/creatures/animals';
import { STAB, blowFrom, damage, nearestReached, type Fighter } from '../src/combat/combat';
import { withBand } from './where';

// The second Cisterns level (seed 1, level 12): on the first, seven dogs (more than one pack) are still up after the minute.
const level = new Level(...withBand('cistern', 1));
/** The ring a dog of size 1 circles you on, and its crouch (the tell). */
const RING = HUNTING.ring[0] + HUNTING.ring[1] * DOG_NATURE.totalLength, CROUCH = HUNTING.windup.flank;
const crouching = (g: Dog) => !!g.action && g.actionT * CALM.strike < CROUCH;
const circling = (g: Dog) => g.mode === 'stalk' && !g.action;

type Prey = Fighter & { taken: number; bites: { t: number; behind: number }[] };
const someone = (x: number, z: number): Prey => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, bites: [],
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function packs(d: Dogs, l = level, n = 8): Pack[] {
  const [ax, , az] = l.arrival, out: Pack[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const p = d.denAt(Math.floor(ax / DOG.cell) + i, Math.floor(az / DOG.cell) + j);
    if (p) out.push(p);
  }
  return out.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
}

/** Someone standing `away` metres from the nearest pack with open, dry floor round them. */
function near(away: number): { dogs: Dogs; me: Prey; pack: Pack } {
  const dogs = new Dogs(level);
  for (const p of packs(dogs)) {
    for (let a = 0; a < 12; a++) {
      const x = p.x + Math.cos(a) * away, z = p.z + Math.sin(a) * away, g = level.groundAt(x, z);
      if (Math.abs(g - p.y) > 0.5 || !level.dry(x, z, 0.05) || level.sdf(x, g + 1, z) < 0.6) continue;
      let open = 0;
      for (let b = 0; b < 8; b++) {
        const rx = x + Math.cos(b) * RING, rz = z + Math.sin(b) * RING;
        if (level.sdf(rx, level.groundAt(rx, rz) + 0.5, rz) > 0.5 && Math.abs(level.groundAt(rx, rz) - g) < 0.5) open++;
      }
      if (open >= 5) return { dogs, me: someone(x, z), pack: p };
    }
  }
  throw new Error('no pack with room round it');
}

/** You stand still facing `facing`; returns the seconds run. */
function run(dogs: Dogs, me: Prey, seconds: number, facing: number, dt = 1 / 60, each?: (t: number) => void): void {
  for (let k = 0; k * dt < seconds; k++) {
    const before = me.taken;
    dogs.advance(dt, me, null, facing);
    me.vx = me.vz = 0;
    if (me.taken > before) {
      const biter = dogs.list.find((g) => g.action && g.struck)!;
      const toDog = Math.atan2(-(biter.x - me.x), -(biter.z - me.z));
      me.bites.push({ t: k * dt, behind: Math.abs(((toDog - facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI) });
    }
    each?.(k * dt);
  }
}

test('feral dogs live in the Cisterns, not in the Quarry or the Salt Works', () => {
  assert.ok(packs(new Dogs(level)).length > 3, `packs on a Cisterns level (${level.seed}, ${level.depth})`);
  for (const [s, d] of [withBand('quarry'), withBand('quarry', 1), withBand('salt'), withBand('salt', 1)]) {
    const l = new Level(s, d);
    assert.equal(packs(new Dogs(l), l).length, 0, `none on ${l.band.id} level (${s}, ${d})`);
  }
});

test('a pack circles you and comes at you from behind, one at a time, with a crouch first', () => {
  const { dogs, me } = near(10);
  let crouchAt = -1, lungers = 0, maxLungers = 0;
  run(dogs, me, 25, 0, 1 / 60, (t) => {
    lungers = dogs.list.filter((g) => g.action).length;
    maxLungers = Math.max(maxLungers, lungers);
    if (crouchAt < 0 && dogs.list.some(crouching)) crouchAt = t;
  });
  assert.ok(me.bites.length >= 3, `${me.bites.length} bites`);
  assert.equal(maxLungers, 1, 'one at a time');
  assert.ok(me.bites[0].t - crouchAt >= CROUCH - 0.02, 'the crouch shows first');
  const fromBehind = me.bites.filter((b) => b.behind > Math.PI / 2).length;
  assert.ok(fromBehind >= me.bites.length * 0.6, `${fromBehind} of ${me.bites.length} from behind`);
  const ring = dogs.list.filter((g) => circling(g) && Math.abs(Math.hypot(g.x - me.x, g.z - me.z) - RING) < 1.5);
  assert.ok(ring.length >= 2, 'the others keep to the ring');
});

test('they never jitter', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    const { dogs, me } = near(10);
    const last = new Map<Dog, [number, number, number, number]>(), lastRev = new Map<Dog, number>(), twice = new Map<Dog, boolean>();
    let back = 0;
    run(dogs, me, 20, 0, dt, (t) => {
      me.x += Math.cos(t * 0.4) * 0.6 * dt; me.z += Math.sin(t * 0.4) * 0.6 * dt; me.y = level.groundAt(me.x, me.z);
      for (const g of dogs.list) {
        if (!circling(g)) { last.delete(g); continue; }
        const p = last.get(g);
        if (!p) { last.set(g, [g.x, g.z, 0, 0]); continue; }
        const dx = g.x - p[0], dz = g.z - p[1];
        if (Math.hypot(dx, dz) < 0.002) continue;
        if (dx * p[2] + dz * p[3] < 0) {
          const quick = t - (lastRev.get(g) ?? -9) < 0.3;
          if (quick && twice.get(g)) back++;
          twice.set(g, quick);
          lastRev.set(g, t);
        }
        last.set(g, [g.x, g.z, dx, dz]);
      }
    });
    assert.equal(back, 0, `back and forth ${back} times at dt ${dt}`);
  }
});

test('after a bite the dog hangs on a moment: someone who stabs back beats a pack (kills them or drives them off) and lives', () => {
  const { dogs, me } = near(10);
  let facing = 0, next = 0;
  run(dogs, me, 60, 0, 1 / 60, (t) => {
    const near = dogs.list.filter((g) => !g.dead && Math.hypot(g.x - me.x, g.z - me.z) < STAB.aim).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (!near) return;
    facing = Math.atan2(-(near.x - me.x), -(near.z - me.z));
    if (t < next) return;
    next = t + STAB.dur;
    const hit = nearestReached(blowFrom(me, facing, STAB), dogs.list);
    if (hit) damage(hit, 8, me.x, me.z, 3.5, 'knife');
  });
  // Killed, or so badly hurt it ran (every animal runs when the fight is hopeless).
  const up = dogs.list.filter((g) => !g.dead && g.health > g.maxHealth * CALM.hopeless + 0.01);
  assert.ok(up.length === 0 && dogs.list.some((g) => g.dead), `still in the fight: ${up.map((g) => `${g.mode} ${g.health.toFixed(0)}`).join(', ')}`);
  assert.ok(me.taken < 100, `took ${me.taken.toFixed(0)}`);
});
