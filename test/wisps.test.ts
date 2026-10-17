import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { WISP, Wisps, glowOf, shine, type Wisp } from '../src/creatures/wisps';
import { bandOf } from '../src/gen/bands';
import { where, withBand } from './where';

/** A Salt Works level below the first (as level 4 always was), and three of them in three worlds. */
const SALT = withBand('salt', 0, 2);
const SALT_WORLDS: [number, number][] = [];
while (SALT_WORLDS.length < 3) {
  const after = SALT_WORLDS.at(-1)?.[0] ?? 0;
  SALT_WORLDS.push(where((s, d) => s > after && bandOf(s, d).id === 'salt', 0, 2));
}

/** Run wisps round a viewer standing at the arrival for `seconds`, calling `each` every step. */
function run(level: Level, seconds: number, each: (w: Wisps, t: number) => void = () => {}): Wisps {
  const w = new Wisps(level), [x, , z] = level.arrival, y = level.groundAt(x, z) + 1.5;
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) { w.advance(dt, x, y, z, 0, -1); each(w, t); }
  return w;
}

test('wisps rise as often as the rock glows: none in the cellar, a few where seams glow faintly, most in the Salt Works', () => {
  assert.equal(glowOf(new Level(1, 0)).strength, 0);
  assert.equal(glowOf(new Level(...SALT)).strength, 1);
  const born = (l: Level) => { let n = 0; run(l, 120, (w) => { n += w.risen.splice(0).length; }); return n; };
  assert.equal(born(new Level(1, 0)), 0);
  const faint = new Level(...withBand('quarry')); // (level 1 in the Quarry, as level 1 always was)
  if (glowOf(faint).strength < WISP.faint) assert.equal(born(faint), 0);
  else assert.ok(born(faint) * 3 < born(new Level(...SALT)), 'faint seams bear far fewer than the Salt Works');
});

test('in the Salt Works a few are born, never more than the most at once, and every one pops with its flash', () => {
  for (const [seed, depth] of SALT_WORLDS) {
    let born = 0, popped = 0, most = 0;
    run(new Level(seed, depth), 120, (w) => {
      born += w.risen.splice(0).length;
      popped += w.popped.splice(0).length;
      most = Math.max(most, w.list.length);
    });
    assert.ok(born >= 5, `seed ${seed}: ${born} born in two minutes`);
    assert.ok(most <= WISP.most);
    assert.ok(popped >= born - WISP.most, `seed ${seed}: ${popped} of ${born} popped`);
  }
});

test('a wisp drifts along the rock: out of it, never far from it, smoothly (no jitter)', () => {
  const level = new Level(...SALT);
  const last = new Map<Wisp, [number, number, number]>();
  let checked = 0;
  run(level, 120, (w) => {
    for (const p of w.list) {
      const d = level.sdf(p.x, p.y, p.z);
      assert.ok(d > (p.age < WISP.rise ? 0 : 0.3), `inside the rock: ${d} at ${p.age} s`);
      if (p.age > WISP.rise + 3) assert.ok(d < WISP.far + 1.5, `adrift ${d} m from the rock`);
      const v = last.get(p);
      if (v && p.age > WISP.rise + 0.1) {
        // The velocity turns gently between steps: never a flip.
        const dv = Math.hypot(p.vx - v[0], p.vy - v[1], p.vz - v[2]);
        assert.ok(dv < 0.05, `velocity jumped by ${dv}`);
        checked++;
      }
      last.set(p, [p.vx, p.vy, p.vz]);
      assert.ok(Math.hypot(p.vx, p.vy, p.vz) < WISP.speed * 3);
    }
  });
  assert.ok(checked > 100);
});

test('the flash is short and bright, then the wisp is dark and gone', () => {
  const w: Wisp = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ox: 0, oy: 0, oz: 0, nx: 0, ny: 1, nz: 0, age: 0, life: 10, phase: 0.3 };
  const at = (age: number) => shine({ ...w, age });
  assert.ok(at(0).bright < 0.05, 'it starts faint, inside the rock');
  assert.ok(at(5).light > 1 && at(5).light < WISP.flashLight / 4);
  assert.ok(at(10).light >= WISP.flashLight * 0.99, 'the flash starts at its brightest');
  assert.ok(at(10).light > at(9.99).light * 4);
  assert.ok(at(10 + WISP.flash * 0.9).light < WISP.flashLight * 0.05);
  assert.equal(at(10 + WISP.flash).size, 0);
  assert.equal(WISP.flash, 0.2);
});

test('wisps are the same for the same seed and level', () => {
  const trail = () => { const out: number[] = []; run(new Level(5, 4), 40, (w) => { for (const p of w.list) out.push(Math.round(p.x * 1000)); }); return out; };
  assert.deepEqual(trail(), trail());
});
