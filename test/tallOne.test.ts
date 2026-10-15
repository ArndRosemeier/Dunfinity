import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { LAIR } from '../src/gen/lair';
import { TALL, TallOnes, type TallOne } from '../src/creatures/tallOne';
import type { Fighter } from '../src/combat/combat';
import { PROP_TILE, quarryProps } from '../src/gen/quarryProps';

const level = new Level(1, LAIR.depth);
const lair = level.lair!;
/** The salt circles, nearest the lair first. */
const circles = [...lair.circles].sort((a, b) => Math.hypot(a.x - lair.x, a.z - lair.z) - Math.hypot(b.x - lair.x, b.z - lair.z));

type Prey = Fighter & { taken: number; hits: number };
const someone = (x: number, z: number): Prey => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, hits: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; this.hits++; },
});

/** Someone `away` metres from the lair on open floor (out of the salt), seen from it. */
function standing(away: number): Prey {
  for (let a = 0; a < 48; a++) {
    const x = lair.x + Math.cos(a * 0.13) * away, z = lair.z + Math.sin(a * 0.13) * away, g = level.groundAt(x, z);
    if (!level.dry(x, z, 0.1) || level.sdf(x, g + 1, z) < 0.8 || Math.abs(g - lair.y) > 1.5) continue;
    if (lair.circles.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 4)) continue;
    const L = Math.hypot(x - lair.x, g - lair.y, z - lair.z);
    if (level.trace(lair.x, lair.y + 2, lair.z, (x - lair.x) / L, (g - lair.y) / L, (z - lair.z) / L, L) < L - 0.5) continue;
    return someone(x, z);
  }
  throw new Error('no open spot');
}

function run(t: TallOnes, me: Prey, seconds: number, dt = 1 / 60, each?: (s: number) => void): void {
  for (let k = 0; k * dt < seconds; k++) {
    t.advance(dt, me);
    me.vx = me.vz = 0;
    each?.(k * dt);
  }
}

test('the Tall One stands in a cavern on level 10, salt circles round it; nowhere else', () => {
  assert.ok(lair.circles.length >= LAIR.circles - 2, `${lair.circles.length} circles`);
  for (const c of lair.circles) {
    assert.ok(level.dry(c.x, c.z, 0.1));
    assert.ok(quarryProps(level, Math.floor(c.x / PROP_TILE), Math.floor(c.z / PROP_TILE)).glow, 'its crystals glow');
  }
  for (const d of [5, 9]) assert.equal(new Level(1, d).lair, null);
  const t = new TallOnes(level);
  run(t, someone(level.arrival[0], level.arrival[2]), 1);
  assert.equal(t.list.length, 0, 'not awake from the arrival');
});

test('from afar it stares (arms open first), close up it reaches', () => {
  const t = new TallOnes(level), me = standing(14);
  let stareAt = -1, firstHit = -1;
  run(t, me, 40, 1 / 60, (s) => {
    const o = t.list[0];
    if (stareAt < 0 && o?.mode === 'stare') stareAt = s;
    if (firstHit < 0 && me.hits > 0) firstHit = s;
  });
  assert.ok(stareAt >= 0 && firstHit > stareAt + TALL.stare.windup - 0.05, `stare at ${stareAt}, first hit at ${firstHit}`);
  assert.ok(t.stares >= 1);
  assert.ok(me.hits >= 3, `${me.hits} hits`);
});

test('in a circle of salt you are safe: it waits outside and never steps in', () => {
  const c = circles[0], me = someone(c.x, c.z), t = new TallOnes(level);
  // It has seen you first.
  run(t, standing(10), 0.5);
  let inside = 0;
  run(t, me, 40, 1 / 60, () => { for (const o of t.list) if (Math.hypot(o.x - c.x, o.z - c.z) < c.r + o.radius) inside++; });
  assert.equal(me.taken, 0);
  assert.equal(inside, 0);
  const o = t.list[0];
  assert.equal(o.mode, 'balk', 'it waits for you');
  assert.ok(Math.hypot(o.x - c.x, o.z - c.z) < c.r + 8, 'by the circle (as near as the floor lets it)');
});

test('it never jitters, going round the salt or waiting at its edge', () => {
  for (const dt of [1 / 60, 1 / 10]) {
    for (const me of [standing(20), someone(circles[1].x, circles[1].z)]) {
      const t = new TallOnes(level);
      run(t, standing(10), 0.5);
      const last = new Map<TallOne, [number, number, number, number]>(), lastRev = new Map<TallOne, number>(), twice = new Map<TallOne, boolean>();
      let back = 0;
      run(t, me, 40, dt, (s) => {
        for (const o of t.list) {
          if (o.mode !== 'stalk' && o.mode !== 'balk' && o.mode !== 'home') { last.delete(o); continue; }
          const p = last.get(o);
          if (!p) { last.set(o, [o.x, o.z, 0, 0]); continue; }
          const dx = o.x - p[0], dz = o.z - p[1];
          if (Math.hypot(dx, dz) < 0.002) continue;
          if (dx * p[2] + dz * p[3] < 0) {
            const quick = s - (lastRev.get(o) ?? -9) < 0.3;
            if (quick && twice.get(o)) back++;
            twice.set(o, quick);
            lastRev.set(o, s);
          }
          last.set(o, [o.x, o.z, dx, dz]);
        }
      });
      assert.equal(back, 0, `back and forth ${back} times at dt ${dt}`);
    }
  }
});
