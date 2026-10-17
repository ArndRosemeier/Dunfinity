import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { SUN, Suns, hangOf, sizeOf } from '../src/creatures/suns';
import { Body, MOVE, type BodyInput } from '../src/world/traverse/body';
import { withBand } from './where';

/** A Salt Works level below the first: its veins glow fully. */
const SALT = withBand('salt', 0, 2);

/** Run suns round a viewer standing at the arrival for `seconds`, calling `each` every step. */
function run(level: Level, seconds: number, each: (s: Suns, t: number) => void = () => {}, suns = new Suns(level)): Suns {
  const [x, , z] = level.arrival, y = level.groundAt(x, z) + 1.5, dt = 1 / 20;
  for (let t = 0; t < seconds; t += dt) { suns.advance(dt, x, y, z, 0, -1); each(suns, t); }
  return suns;
}

/** A sun called out of the rock round the arrival (the debug menu's way). */
function called(level: Level): Suns {
  const s = new Suns(level), [x, , z] = level.arrival;
  assert.ok(s.call(x, level.groundAt(x, z) + 1.5, z, 0, -1), 'a sun came');
  return s;
}

test('suns rise only where the rock glows: none in the cellar, now and then in the Salt Works', () => {
  let born = 0;
  run(new Level(1, 0), 400, (s) => { born += s.risen.splice(0).length; });
  assert.equal(born, 0);
  born = 0;
  run(new Level(...SALT), 600, (s) => { born += s.risen.splice(0).length; assert.ok(s.list.length <= SUN.most); });
  assert.ok(born >= 2 && born <= 10, `${born} born in ten minutes`);
});

test('they come from 1 m across to 4 m, small ones the commonest', () => {
  const sizes: number[] = [];
  for (let seed = 1; sizes.length < 40 && seed < 200; seed++) {
    const level = new Level(seed, 3), s = new Suns(level), [x, , z] = level.arrival;
    if (s.call(x, level.groundAt(x, z) + 1.5, z, 0, -1)) sizes.push(s.list[0].r * 2);
  }
  assert.ok(sizes.length >= 30);
  assert.ok(Math.min(...sizes) >= 1 && Math.max(...sizes) <= 4);
  assert.ok(Math.min(...sizes) < 1.6 && Math.max(...sizes) > 3.2, `sizes ${Math.min(...sizes)}–${Math.max(...sizes)}`);
  assert.ok(sizes.filter((d) => d < 2.5).length > sizes.length / 2);
});

test('a sun lasts about five minutes, wanders at varying speeds, bobs, and at its end sinks low and shrinks to nothing', () => {
  const level = new Level(...SALT), suns = called(level), sun = suns.list[0];
  const speeds: number[] = [], heights: [number, number][] = [];
  let last: [number, number, number] | null = null, gone = -1;
  run(level, 400, (s, t) => {
    if (!s.list.includes(sun)) { if (gone < 0) gone = t; return; }
    const d = level.sdf(sun.x, sun.y, sun.z) - sizeOf(sun);
    if (sun.age > SUN.rise) assert.ok(d > 0.2, `in the rock: ${d} at ${sun.age} s`);
    if (sun.age > SUN.rise && sun.age < sun.life) {
      speeds.push(Math.hypot(sun.vx, sun.vz));
      heights.push([sun.age, sun.y - sizeOf(sun) - level.groundAt(sun.x, sun.z, sun.y)]);
      if (last) assert.ok(Math.hypot(sun.vx - last[0], sun.vy - last[1], sun.vz - last[2]) < 0.2, 'no jolt (no jitter)');
      last = [sun.vx, sun.vy, sun.vz];
    }
  }, suns);
  assert.ok(gone > 260 && gone < 345, `gone after ${gone} s`);
  speeds.sort((a, b) => a - b);
  assert.ok(speeds[Math.floor(speeds.length * 0.9)] > speeds[Math.floor(speeds.length * 0.1)] * 1.8, 'its speed varies');
  const mid = heights.filter(([a]) => a > 60 && a < sun.life - SUN.end), end = heights.filter(([a]) => a > sun.life - 3);
  const mean = (h: [number, number][]) => h.reduce((s, [, y]) => s + y, 0) / h.length;
  assert.ok(mean(end) < mean(mid) - 1, `sinks: ${mean(mid).toFixed(1)} m then ${mean(end).toFixed(1)} m over the floor`);
  assert.ok(sizeOf({ ...sun, age: sun.life - 1 }) < sun.r * 0.25, 'shrunk');
  assert.equal(sizeOf({ ...sun, age: sun.life }), 0);
});

test('prominences swell, break off and fall as drops that splash below', () => {
  const level = new Level(...SALT), suns = called(level), sun = suns.list[0];
  let splashed = 0;
  run(level, 90, (s) => {
    for (const f of sun.flares) if (f.age > SUN.swell && f.splashed < 0) assert.ok(f.y < sun.y + sun.r, 'a drop falls');
    splashed += s.splashed.splice(0).length;
  }, suns);
  assert.ok(splashed >= 8, `${splashed} drops splashed in 90 s`);
});

test('ridden, it climbs high: letting go high up is a fall that hurts badly, unless something worn lets one float down', () => {
  const level = new Level(...SALT), suns = called(level), sun = suns.list[0];
  sun.ridden = true;
  run(level, 60, () => {}, suns);
  const feet: [number, number, number] = [0, 0, 0];
  hangOf(sun, feet);
  const floor = level.groundAt(feet[0], feet[2], feet[1]);
  assert.ok(feet[1] - floor > 6, `hung ${(feet[1] - floor).toFixed(1)} m over the floor`);
  const fall = (featherfall: number | null): Body => {
    const b = new Body(feet[0], feet[1], feet[2]);
    b.featherfall = featherfall;
    b.vx = sun.vx; b.vz = sun.vz;
    const still: BodyInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
    for (let i = 0; i < 600 && !b.grounded; i++) b.step(level, still, 1 / 60);
    return b;
  };
  const hard = fall(null), soft = fall(4);
  assert.ok(hard.health < MOVE.maxHealth - 15, `fell to ${hard.health}`);
  assert.equal(soft.health, MOVE.maxHealth);
});

test('suns are the same for the same seed and level', () => {
  const trail = () => { const out: number[] = []; run(new Level(...SALT), 300, (s) => { for (const p of s.list) out.push(Math.round(p.x * 1000)); }); return out; };
  assert.deepEqual(trail(), trail());
});
