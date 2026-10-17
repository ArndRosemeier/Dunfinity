import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SCAVENGER, Scavengers, type Camp, type Scavenger } from '../src/creatures/scavengers';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 4);

type Prey = Fighter & { taken: number };
const someone = (x: number, z: number): Prey => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function camps(s: Scavengers, l = level, n = 6): Camp[] {
  const [ax, , az] = l.arrival, out: Camp[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const c = s.denAt(Math.floor(ax / SCAVENGER.cell) + i, Math.floor(az / SCAVENGER.cell) + j);
    if (c) out.push(c);
  }
  return out.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
}

/** Someone standing `away` metres from the fire of the nearest camp that is (or is not) robbers, on open floor. */
function near(away: number, robbers: boolean): { scav: Scavengers; me: Prey; camp: Camp } {
  for (const l of [level, new Level(2, 4), new Level(3, 5)]) {
    const scav = new Scavengers(l);
    for (const c of camps(scav, l)) {
      if (c.robbers !== robbers) continue;
      for (let a = 0; a < 24; a++) {
        const x = c.x + Math.cos(a) * away, z = c.z + Math.sin(a) * away, g = l.groundAt(x, z);
        if (Math.abs(g - c.y) > 0.5 || !l.dry(x, z, 0.05) || l.sdf(x, g + 1, z) < 0.6) continue;
        const L = Math.hypot(x - c.x, g - c.y, z - c.z);
        if (l.trace(c.x, c.y + 1, c.z, (x - c.x) / L, (g - c.y) / L, (z - c.z) / L, L) < L - 0.1) continue;
        return { scav, me: { ...someone(x, z), y: g }, camp: c };
      }
    }
  }
  throw new Error(`no ${robbers ? 'robbers' : 'wary'} camp with room round it`);
}

function run(s: Scavengers, me: Prey, seconds: number, dt = 1 / 60, each?: (t: number) => void): void {
  for (let k = 0; k * dt < seconds; k++) {
    s.advance(dt, me);
    me.vx = me.vz = 0;
    each?.(k * dt);
  }
}

test('scavengers camp on any level, at home from level 4 (some of them robbers), rarer and fewer above it', () => {
  const all = [level, new Level(2, 4), new Level(1, 6)].flatMap((l) => camps(new Scavengers(l), l));
  assert.ok(all.length > 4, `${all.length} camps`);
  assert.ok(all.some((c) => c.robbers) && all.some((c) => !c.robbers), 'both kinds');
  const people = (l: Level) => camps(new Scavengers(l), l).reduce((s, c) => s + c.count, 0), home = people(new Level(1, 6));
  for (const d of [1, 2]) assert.ok(people(new Level(1, d)) < home / 2, `fewer on level ${d} than on level 6`);
  assert.ok(camps(new Scavengers(new Level(1, 1)), new Level(1, 1)).every((c) => c.count === 1), 'one alone at a camp on level 1');
});

test('a wary camp gets up and warns you off, but leaves you alone at a distance', () => {
  const { scav, me } = near(8, false);
  run(scav, me, 10);
  assert.equal(me.taken, 0);
  assert.ok(scav.calls >= 1 && scav.said.length > 0, 'one of them called out');
  assert.ok(scav.list.some((s) => s.mode === 'stand'), 'they are on their feet');
});

test('walk into a wary camp and they come for you, crowbars first', () => {
  const { scav, me } = near(3, false);
  run(scav, me, 15);
  assert.ok(me.taken > 0, 'they hit you');
});

test('robbers come for you on sight, and a badly hurt one runs', () => {
  const { scav, me } = near(10, true);
  let hit = false;
  run(scav, me, 15, 1 / 60, () => { hit ||= me.taken > 0; });
  assert.ok(hit, 'they hit you');
  const s = scav.list.find((x) => !x.dead)!;
  s.hurt(SCAVENGER.health * 0.7, 'knife');
  const d0 = Math.hypot(s.x - me.x, s.z - me.z);
  run(scav, me, 3);
  assert.equal(s.mode, 'flee');
  assert.ok(Math.hypot(s.x - me.x, s.z - me.z) > d0 + 3, 'it ran');
});

test('they never jitter', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    for (const robbers of [false, true]) {
      const { scav, me } = near(robbers ? 10 : 3, robbers);
      const last = new Map<Scavenger, [number, number, number, number]>(), lastRev = new Map<Scavenger, number>(), twice = new Map<Scavenger, boolean>();
      let back = 0;
      run(scav, me, 20, dt, (t) => {
        for (const s of scav.list) {
          if (s.mode !== 'chase' && s.mode !== 'home') { last.delete(s); continue; }
          const p = last.get(s);
          if (!p) { last.set(s, [s.x, s.z, 0, 0]); continue; }
          const dx = s.x - p[0], dz = s.z - p[1];
          if (Math.hypot(dx, dz) < 0.002) continue;
          if (dx * p[2] + dz * p[3] < 0) {
            const quick = t - (lastRev.get(s) ?? -9) < 0.3;
            if (quick && twice.get(s)) back++;
            twice.set(s, quick);
            lastRev.set(s, t);
          }
          last.set(s, [s.x, s.z, dx, dz]);
        }
      });
      assert.equal(back, 0, `back and forth ${back} times at dt ${dt} (${robbers ? 'robbers' : 'wary'})`);
    }
  }
});
