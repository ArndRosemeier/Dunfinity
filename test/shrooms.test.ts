import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { PUFFCAP, Puffcaps, TOADSTOOL, Toadstools, type Patch } from '../src/creatures/shrooms';
import { SPORES } from '../src/creatures/spores';
import type { Population } from '../src/creatures/population';
import type { Fighter } from '../src/combat/combat';

// A level all of the fungal grotto (but where one arrives).
const grotto = new Level(1, 9, 'fungal');

type Prey = Fighter & { taken: number };
const someone = (l: Level, x: number, z: number): Prey => ({
  x, y: l.groundAt(x, z), z, vx: 0, vz: 0, radius: 0.35, height: 1.75, taken: 0,
  get dead() { return false; }, hurt(a: number) { this.taken += a; },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function patches(p: Population<Patch, any>, l: Level, n = 10): Patch[] {
  const [ax, az] = deepIn(l), out: Patch[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const d = p.denAt(Math.floor(ax / 24) + i, Math.floor(az / 24) + j);
    if (d) out.push(d);
  }
  return out.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
}

/** A point well inside the grotto (the home ground round the arrival is the excavation's), or the arrival if none. */
function deepIn(l: Level): [number, number] {
  const f = l.field, fungal = (x: number, z: number) => f.styles[f.regions.styleAt(x, z)].id === 'fungal';
  for (let r = 400; r < 2000; r += 50) for (let a = 0; a < 32; a++) {
    const x = Math.cos(a / 5) * r, z = Math.sin(a / 5) * r;
    if (fungal(x, z) && fungal(x + 120, z) && fungal(x - 120, z) && fungal(x, z + 120) && fungal(x, z - 120)) return [x, z];
  }
  return [l.arrival[0], l.arrival[2]];
}

/** A clear, level spot `away` metres from (x, z), on the same floor. */
function spot(l: Level, x: number, z: number, away: number): [number, number] {
  const y = l.groundAt(x, z);
  for (let a = 0; a < 48; a++) {
    const px = x + Math.cos(a * 0.4) * away, pz = z + Math.sin(a * 0.4) * away, py = l.groundAt(px, pz);
    if (Math.abs(py - y) < 0.5 && l.dry(px, pz, 0.05) && l.sdf(px, py + 1, pz) > 0.6) return [px, pz];
  }
  throw new Error('no clear spot');
}

function run(p: { advance(dt: number, prey: Fighter): number }, me: Prey, seconds: number, each?: (t: number) => void): void {
  const dt = 1 / 60;
  for (let k = 0; k * dt < seconds; k++) {
    p.advance(dt, me);
    me.vx = me.vz = 0;
    each?.(k * dt);
  }
}

test('mushroom monsters grow only on the fungal grotto\'s ground', () => {
  assert.ok(patches(new Toadstools(grotto), grotto).length > 5, 'toadstools in the grotto');
  assert.ok(patches(new Puffcaps(grotto), grotto).length > 3, 'puffcaps in the grotto');
  for (const l of [new Level(1, 4), new Level(1, 9, 'karst')]) {
    assert.equal(patches(new Toadstools(l), l).length, 0, `no toadstools on ${l.depth}`);
    assert.equal(patches(new Puffcaps(l), l).length, 0, `no puffcaps on ${l.depth}`);
  }
});

test('a toadstool is a mushroom until you come close; then it gets up (the tell) and slams you', () => {
  const ts = new Toadstools(grotto), den = patches(ts, grotto)[0];
  const far = someone(grotto, ...spot(grotto, den.x, den.z, 12));
  run(ts, far, 5);
  assert.ok(ts.list.length > 0 && ts.list.every((s) => s.mode === 'hide'), 'still hiding while you are 12 m off');
  const me = someone(grotto, ...spot(grotto, den.x, den.z, 3));
  let wokeAt = -1, slamAt = -1, hitAt = -1;
  run(ts, me, 20, (t) => {
    if (wokeAt < 0 && ts.list.some((s) => s.mode === 'wake')) wokeAt = t;
    if (slamAt < 0 && ts.list.some((s) => s.mode === 'slam')) slamAt = t;
    if (hitAt < 0 && me.taken > 0) hitAt = t;
  });
  assert.ok(wokeAt >= 0 && hitAt > 0, `woke at ${wokeAt}, hit at ${hitAt}`);
  assert.ok(slamAt - wokeAt >= TOADSTOOL.wake - 0.02, 'it gets all the way up before it slams');
  assert.ok(hitAt - slamAt >= TOADSTOOL.rear, `it rears back ${(hitAt - slamAt).toFixed(2)} s first`);
});

test('lose a toadstool and it walks back to its spot and roots itself again', () => {
  const ts = new Toadstools(grotto), den = patches(ts, grotto)[0];
  const me = someone(grotto, ...spot(grotto, den.x, den.z, 3));
  run(ts, me, 2.5);
  assert.ok(ts.list.some((s) => s.up), 'up');
  // You are gone (far up the level).
  me.y += 50;
  run(ts, me, 40);
  for (const s of ts.list) {
    assert.equal(s.mode, 'hide', 'hiding again');
    assert.ok(Math.hypot(s.x - s.hx, s.z - s.hz) < 1, 'on its spot');
  }
});

test('a toadstool chasing you never dithers back and forth', () => {
  const ts = new Toadstools(grotto), den = patches(ts, grotto)[0];
  const me = someone(grotto, ...spot(grotto, den.x, den.z, 3));
  const last = new Map<number, [number, number, number, number]>();
  let flips = 0;
  run(ts, me, 20, () => {
    for (const s of ts.list) {
      if (s.mode !== 'chase') { last.delete(s.id); continue; }
      const p = last.get(s.id);
      if (!p) { last.set(s.id, [s.x, s.z, 0, 0]); continue; }
      const dx = s.x - p[0], dz = s.z - p[1];
      if (Math.hypot(dx, dz) < 0.002) continue;
      if (dx * p[2] + dz * p[3] < 0) flips++;
      last.set(s.id, [s.x, s.z, dx, dz]);
    }
  });
  assert.ok(flips <= 4, `${flips} reversals`);
});

test('a puffcap that sees you draws in (the tell) and puffs spores that burn', () => {
  const ps = new Puffcaps(grotto);
  for (const den of patches(ps, grotto)) {
    const [x, z] = spot(grotto, den.x, den.z, 8);
    const me = someone(grotto, x, z);
    let puffAt = -1, hurtAt = -1;
    run(ps, me, 12, (t) => {
      if (puffAt < 0 && ps.list.some((p) => p.mode === 'puff')) puffAt = t;
      if (hurtAt < 0 && me.taken > 0) hurtAt = t;
    });
    if (puffAt < 0) continue; // not in sight of this one
    assert.ok(ps.list.every((p) => Math.hypot(p.vx, p.vz) === 0), 'rooted');
    assert.ok(hurtAt > 0, 'the spores reached you');
    assert.ok(hurtAt - puffAt >= PUFFCAP.release, `drawn in ${(hurtAt - puffAt).toFixed(2)} s first`);
    assert.ok(me.taken >= SPORES.burn, 'and burned');
    return;
  }
  assert.fail('no puffcap saw anyone');
});
