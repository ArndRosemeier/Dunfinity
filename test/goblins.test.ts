import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { GOBLIN_FOLK, Goblins, type Lair } from '../src/creatures/goblins';
import type { Fighter } from '../src/combat/combat';

const level = new Level(1, 25, 'goblin');

type Prey = Fighter & { taken: number };
const someone = (x: number, y: number, z: number): Prey => ({
  x, y, z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

function dens(g: Goblins, l = level, n = 40): Lair[] {
  const [ax, , az] = l.arrival, out: Lair[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const d = g.denAt(Math.floor(ax / GOBLIN_FOLK.cell) + i, Math.floor(az / GOBLIN_FOLK.cell) + j);
    if (d) out.push(d);
  }
  return out.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
}

/** Someone `away` metres from a den, on its floor, in sight of its middle. */
function near(away: number): { gob: Goblins; me: Prey; den: Lair } {
  const gob = new Goblins(level), l = level;
  for (const d of dens(gob)) {
    for (let a = 0; a < 24; a++) {
      const x = d.x + Math.cos(a) * away, z = d.z + Math.sin(a) * away, y = l.groundAt(x, z);
      if (Math.abs(y - d.y) > 0.6 || !l.dry(x, z, 0.05) || l.sdf(x, y + 1, z) < 0.5) continue;
      const L = Math.hypot(x - d.x, y - d.y, z - d.z);
      if (l.trace(d.x, d.y + 0.8, d.z, (x - d.x) / L, (y - d.y) / L, (z - d.z) / L, L) < L - 0.1) continue;
      return { gob, me: someone(x, y, z), den: d };
    }
  }
  throw new Error('no goblin den with room round it');
}

function run(g: Goblins, me: Prey, seconds: number, each?: (t: number) => void, dt = 1 / 60): void {
  for (let k = 0; k * dt < seconds; k++) {
    g.advance(dt, me);
    me.vx = me.vz = 0;
    each?.(k * dt);
  }
}

test('goblins live in the warrens\' dens, and nowhere else', () => {
  const all = dens(new Goblins(level));
  assert.ok(all.length > 3, `${all.length} dens`);
  for (const d of all) assert.ok(d.count >= GOBLIN_FOLK.count[0] && d.count <= GOBLIN_FOLK.count[1]);
  for (const style of ['karst', 'dwarven'] as const) assert.equal(dens(new Goblins(new Level(1, 25, style))).length, 0, `none in ${style}`);
  assert.equal(dens(new Goblins(new Level(1, 3))).length, 0, 'none on level 3');
});

test('a den sees you, one shrieks, and they all come and jab', () => {
  const { gob, me, den } = near(7);
  const modes = new Set<string>();
  run(gob, me, 12, () => { for (const g of gob.list) modes.add(g.mode); });
  assert.ok(den.roused, 'roused');
  assert.ok(modes.has('shriek'), [...modes].join());
  assert.ok(modes.has('jab'), [...modes].join());
  assert.ok(me.taken > 0, 'hurt');
});

test('a thief runs off with what it snatched and drops it where it dies', () => {
  const { gob, me } = near(6);
  let n = 0;
  gob.thief = () => ({ id: ++n });
  let thief = null as (typeof gob.list)[number] | null;
  let fled = false;
  run(gob, me, 30, () => { thief ??= gob.list.find((g) => g.loot !== null) ?? null; fled ||= thief?.mode === 'flee'; });
  assert.ok(fled, 'the thief ran');
  assert.ok(thief, 'something was snatched');
  thief!.hurt(999, 'knife');
  gob.advance(1 / 60, me);
  assert.equal(gob.dropped.length, 1);
  assert.ok(Math.hypot(gob.dropped[0].x - thief!.x, gob.dropped[0].z - thief!.z) < 0.5);
  assert.equal(thief!.loot, null);
});

test('goblins never jitter: a den at rest stays put', () => {
  const { gob, den } = near(6);
  const away = someone(den.x + 30, den.y + 10, den.z);
  run(gob, away, 0.5);
  assert.ok(gob.list.length > 0);
  const pos = gob.list.map((g) => [g.x, g.z, g.yaw]);
  run(gob, away, 4);
  gob.list.forEach((g, k) => {
    assert.equal(g.mode, 'squat');
    assert.ok(Math.hypot(g.x - pos[k][0], g.z - pos[k][1]) < 0.02, `moved ${Math.hypot(g.x - pos[k][0], g.z - pos[k][1])}`);
  });
});

/** Back and forth while coming for you: a reversal right after another, within a quarter second (as test/ratJitter.test.ts). */
for (const [name, dt, walk] of [['at 60 fps', 1 / 60, 0], ['at 10 fps', 1 / 10, 0], ['round a walking prey', 1 / 60, 1.2]] as const) {
  test(`goblins come round and jab without jittering (${name})`, () => {
    const { gob, me } = near(7);
    const last = new Map<object, [number, number, number, number]>(), at = new Map<object, number>(), quickRun = new Map<object, boolean>();
    let worst = 0;
    for (let k = 0; k * dt < 15; k++) {
      if (walk) { me.x += Math.cos(k * dt * 0.5) * walk * dt; me.z += Math.sin(k * dt * 0.5) * walk * dt; me.y = level.groundAt(me.x, me.z); }
      gob.advance(dt, me);
      me.vx = me.vz = 0;
      for (const g of gob.list) {
        if (g.dead || g.mode !== 'chase') { last.delete(g); continue; }
        const p = last.get(g);
        if (!p) { last.set(g, [g.x, g.z, 0, 0]); continue; }
        const dx = g.x - p[0], dz = g.z - p[1];
        if (Math.hypot(dx, dz) <= 0.002) continue;
        if (dx * p[2] + dz * p[3] < 0) {
          const quick = k * dt - (at.get(g) ?? -9) < 0.25;
          if (quick && quickRun.get(g)) worst++;
          quickRun.set(g, quick);
          at.set(g, k * dt);
        }
        last.set(g, [g.x, g.z, dx, dz]);
      }
    }
    assert.equal(worst, 0, `goblins went back and forth ${worst} times`);
  });
}
