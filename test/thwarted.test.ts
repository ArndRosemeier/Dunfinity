import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { RAT, Rats, type Nest } from '../src/creatures/rats';
import { Fauna } from '../src/creatures/fauna';
import { Slimes } from '../src/creatures/slimes';
import type { Fighter } from '../src/combat/combat';

/** Someone standing still at (x, z), never hurt (the rats keep at it). */
const someone = (level: Level, x: number, z: number): Fighter & { taken: number } => ({
  x, y: level.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0, get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

/** Nests near the arrival, nearest first. */
function nests(level: Level, rats: Rats): Nest[] {
  const [ax, , az] = level.arrival, out: Nest[] = [];
  for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
    const n = rats.denAt(Math.floor(ax / RAT.cell) + i, Math.floor(az / RAT.cell) + j);
    if (n) out.push(n);
  }
  return out.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
}

test('rats that cannot get up to you give up and go home, and nothing counts as after you', () => {
  // Level 1, seed 4 (a Quarry level 1, as seed 5's was): the nearest nest's rats run at you, 9 m off, up a ledge they cannot take and give up (found by a sweep of the seeds' level 1).
  const level = new Level(4, 1), fauna = new Fauna(level), rats = fauna.rats;
  const nest = nests(level, rats)[0];
  let me: (Fighter & { taken: number }) | null = null;
  for (let a = 0; a < 16 && !me; a++) {
    const x = nest.x + Math.cos(a) * 9, z = nest.z + Math.sin(a) * 9, g = level.groundAt(x, z);
    if (Math.abs(g - nest.y) < 1 && level.dry(x, z, 0.05) && level.sdf(x, g + 1, z) > 0.6) me = someone(level, x, z);
  }
  assert.ok(me);
  let chased = false;
  for (let t = 0; t < 20; t += 1 / 60) {
    rats.advance(1 / 60, me);
    me.vx = me.vz = 0;
    chased ||= rats.list.some((r) => r.mode === 'chase');
  }
  assert.ok(chased, 'they came for you');
  assert.equal(me.taken, 0, 'none got at you');
  assert.ok(!rats.list.some((r) => r.mode === 'chase' && r.balk === 0 && Math.hypot(r.vx, r.vz) < 0.05), 'no rat stands frozen mid-chase');
  assert.equal(fauna.after(me), false, 'nothing after you (the fire would let you rest)');
});

test('creatures wake on their den\'s floor, never inside the rock', () => {
  // Level 2, seed 1 and 2: a rat nest and a slime colony beside a ledge put some of their brood under the floor.
  for (const seed of [1, 2]) {
    const level = new Level(seed, 2), [ax, , az] = level.arrival;
    for (const pop of [new Rats(level), new Slimes(level, 'murk'), new Slimes(level, 'lumen')]) {
      for (let x = ax - 300; x <= ax + 300; x += 40) for (let z = az - 300; z <= az + 300; z += 40) {
        pop.advance(1 / 60, someone(level, x, z), [] as never); // (slimes: no enemy slimes about)
        for (const c of pop.list) {
          const s = level.sdf(c.x, c.y + c.height * 0.5, c.z);
          assert.ok(s > -0.05, `${pop.name} ${c.id} at ${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)} is in the rock (${s.toFixed(2)})`);
        }
      }
    }
  }
});
