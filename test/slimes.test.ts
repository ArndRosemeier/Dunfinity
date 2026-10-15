import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SLIME, Slimes, type Colony, type Faction, type Slime } from '../src/creatures/slimes';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 3);

type Prey = Fighter & { taken: Record<string, number> };
const someone = (x: number, z: number): Prey => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: {},
  get dead() { return false; }, hurt(a: number, cause: string) { this.taken[cause] = (this.taken[cause] ?? 0) + a; },
});

function colonies(s: Slimes, n = 8): Colony[] {
  const [ax, , az] = level.arrival, out: Colony[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const c = s.denAt(Math.floor(ax / SLIME.cell) + i, Math.floor(az / SLIME.cell) + j);
    if (c) out.push(c);
  }
  const d = (c: Colony) => Math.hypot(c.x - ax, c.z - az);
  return out.sort((a, b) => d(a) - d(b));
}

/** Someone standing `away` metres from the nearest colony of `faction`, on its floor. */
function near(faction: Faction, away: number): { lumen: Slimes; murk: Slimes; me: Prey; colony: Colony } {
  const lumen = new Slimes(level, 'lumen'), murk = new Slimes(level, 'murk');
  for (const c of colonies(faction === 'lumen' ? lumen : murk)) {
    for (let a = 0; a < 8; a++) {
      const x = c.x + Math.cos(a) * away, z = c.z + Math.sin(a) * away;
      if (Math.abs(level.groundAt(x, z) - c.y) < 0.4 && level.sdf(x, level.groundAt(x, z) + 1, z) > 0.6) return { lumen, murk, me: someone(x, z), colony: c };
    }
  }
  throw new Error('no colony');
}

function run(l: Slimes, m: Slimes, me: Prey, seconds: number, dt = 1 / 60, each?: (t: number) => void): void {
  for (let k = 0; k * dt < seconds; k++) {
    l.advance(dt, me, m.list);
    m.advance(dt, me, l.list);
    me.vx = me.vz = 0;
    each?.(k * dt);
  }
}

test('slimes live from level 2, both kinds', () => {
  assert.equal(colonies(new Slimes(new Level(1, 1), 'murk')).length, 0);
  assert.ok(colonies(new Slimes(level, 'lumen')).length > 3);
  assert.ok(colonies(new Slimes(level, 'murk')).length > 3);
});

test('Murk come for you, squashing down before each blow', () => {
  const { lumen, murk, me } = near('murk', 5);
  let blowAt = -1, first = -1;
  run(lumen, murk, me, 15, 1 / 60, (t) => {
    if (blowAt < 0 && murk.list.some((s) => s.mode === 'blow')) blowAt = t;
    if (first < 0 && me.taken.murk) first = t;
  });
  assert.ok(first > 0, 'a Murk hit you');
  assert.ok(first - blowAt >= SLIME.squash - 0.02, 'after the squash');
});

test('Lumen leave you be until you hurt one', () => {
  const { lumen, murk, me } = near('lumen', 2.5);
  run(lumen, murk, me, 10);
  assert.equal(me.taken.lumen ?? 0, 0, 'tolerated');
  const one = lumen.list.find((s) => !s.dead && Math.hypot(s.x - me.x, s.z - me.z) < 8)!;
  one.hurt(2, 'knife');
  run(lumen, murk, me, 15);
  assert.ok((me.taken.lumen ?? 0) > 0, 'now they come');
});

test('where colonies meet, Lumen and Murk fight', () => {
  const lumen = new Slimes(level, 'lumen'), murk = new Slimes(level, 'murk');
  let pair: [Colony, Colony] | null = null;
  for (const a of colonies(lumen, 12)) for (const b of colonies(murk, 12)) if (!pair && Math.hypot(a.x - b.x, a.z - b.z) < 20) pair = [a, b];
  assert.ok(pair, 'colonies that meet');
  // Watched from a way off (so the Murk are busy with the Lumen, not with you).
  const me = someone((pair[0].x + pair[1].x) / 2 + 30, (pair[0].z + pair[1].z) / 2);
  me.y = -1000;
  run(lumen, murk, me, 40);
  const hurt = (l: readonly Slime[]) => l.filter((s) => s.health < SLIME.health * s.size).length;
  assert.ok(hurt(lumen.list) > 0 && hurt(murk.list) > 0, `fighting: ${hurt(lumen.list)} lumen and ${hurt(murk.list)} murk hurt`);
});

test('they never jitter', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    const { lumen, murk, me } = near('murk', 6);
    const last = new Map<Slime, [number, number, number, number]>();
    const lastRev = new Map<Slime, number>(), run2 = new Map<Slime, boolean>();
    let back = 0;
    run(lumen, murk, me, 20, dt, (t) => {
      me.x += Math.cos(t * 0.4) * 0.5 * dt; me.z += Math.sin(t * 0.4) * 0.5 * dt; me.y = level.groundAt(me.x, me.z);
      for (const s of [...lumen.list, ...murk.list]) {
        if (s.mode !== 'go') { last.delete(s); continue; }
        const p = last.get(s);
        if (p) {
          const dx = s.x - p[0], dz = s.z - p[1];
          if (Math.hypot(dx, dz) > 0.002) {
            if (dx * p[2] + dz * p[3] < 0) {
              const quick = t - (lastRev.get(s) ?? -9) < 0.3;
              if (quick && run2.get(s)) back++;
              run2.set(s, quick);
              lastRev.set(s, t);
            }
            last.set(s, [s.x, s.z, dx, dz]);
          }
        } else last.set(s, [s.x, s.z, 0, 0]);
      }
    });
    assert.equal(back, 0, `back and forth ${back} times at dt ${dt}`);
  }
});
