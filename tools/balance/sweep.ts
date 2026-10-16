/**
 * The creature sweep of levels 1–10, headless: `node --import tsx tools/balance/sweep.ts [depths] [seeds]`
 * (defaults 1,...,10 and 3). For each level it stands a nobody 8 m from the two nearest dens of every
 * kind in turn (30 s each, the whole level's fauna about), stabbing back at whatever is in reach of
 * the knife, never dodging, healing as the game does. It prints, per level:
 *
 * - what the fights cost (health taken, by cause; how often the nobody went down; the lowest health),
 *   a gauge for balance: a player who rolls and guards takes less;
 * - the longest stalemate: something counted as after you (`Fauna.after`) with no blow either way;
 * - creature bugs: NaN, inside the rock, under the floor, going back and forth (Arnd's no-jitter rule).
 *
 * Candidates for a human to read, not a verdict. Read-only against src/.
 */
import { Rng } from '@futuremagic/core';
import { Level } from '../../src/gen/level';
import { Fauna, type Foe } from '../../src/creatures/fauna';
import { STAB, blowFrom, damage, nearestReached, reach, type Fighter } from '../../src/combat/combat';
import { MOVE } from '../../src/world/traverse/body';

const depths = (process.argv[2] ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const seeds = Number(process.argv[3] ?? 3);
const dt = 1 / 30, STAY = 30, AWAY = 8;

/** A den of any kind, as the populations keep them (their spread and dens are their own business). */
interface Kind { name: string; spread: { cell: number }; placed: { x: number; z: number }[]; denAt(i: number, j: number): { x: number; z: number } | null }

class Nobody implements Fighter {
  vx = 0; vz = 0; yaw = 0;
  readonly radius = MOVE.radius;
  readonly height = MOVE.height;
  health = MOVE.maxHealth;
  low = MOVE.maxHealth; downs = 0; unhurt = 99;
  readonly taken: Record<string, number> = {};
  constructor(public x: number, public y: number, public z: number) {}
  get dead(): boolean { return false; }
  hurt(a: number, cause: string): void {
    this.taken[cause] = (this.taken[cause] ?? 0) + a;
    this.health -= a; this.unhurt = 0;
    if (this.health <= 0) { this.downs++; this.health = MOVE.maxHealth; } // (counted, then up again: the sweep goes on)
    this.low = Math.min(this.low, Math.max(0, this.health));
  }
}

const fmt = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ');

for (const depth of depths) for (let seed = 1; seed <= seeds; seed++) {
  const level = new Level(seed, depth), fauna = new Fauna(level), rng = new Rng(seed * 977 + depth);
  const [ax, , az] = level.arrival;
  // Where to stand: AWAY metres from the two nearest dens of each kind, on dry, open floor.
  const stations: [number, number][] = [];
  for (const pop of (fauna as unknown as { all: readonly Kind[] }).all) {
    const c = pop.spread.cell, dens = [...pop.placed];
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = pop.denAt(Math.floor(ax / c) + i, Math.floor(az / c) + j); if (d) dens.push(d); }
    dens.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
    let n = 0;
    for (const den of dens) {
      if (n >= 2) break;
      for (let a = 0; a < 16; a++) {
        const x = den.x + Math.cos(a) * AWAY, z = den.z + Math.sin(a) * AWAY, g = level.groundAt(x, z);
        if (level.dry(x, z, 0.05) && level.sdf(x, g + 1, z) > 0.6) { stations.push([x, z]); n++; break; }
      }
    }
  }
  const me = new Nobody(ax, level.groundAt(ax, az), az);
  const issues = new Map<string, { n: number; at: string }>();
  const note = (k: string, at: string) => { const i = issues.get(k); if (i) i.n++; else issues.set(k, { n: 1, at }); };
  const track = new Map<Foe, { x: number; z: number; dx: number; dz: number; at: number; quick: boolean }>();
  let station = -1, nextStab = 0, stale = 0, worst = 0, worstAt = '';
  for (let t = 0; t < stations.length * STAY; t += dt) {
    if (Math.floor(t / STAY) !== station) {
      station = Math.floor(t / STAY);
      [me.x, me.z] = stations[station]; me.y = level.groundAt(me.x, me.z); stale = 0;
    }
    const foes = fauna.foes(), dist = (e: Foe) => Math.hypot(e.x - me.x, e.z - me.z);
    // Stab back at the nearest the knife can reach, turned to it (as the game's aim does).
    const near = foes.filter((e) => !e.dead && dist(e) < STAB.aim && reach(blowFrom(me, Math.atan2(-(e.x - me.x), -(e.z - me.z)), { ...STAB, range: STAB.range + 0.5 }), e)).sort((a, b) => dist(a) - dist(b));
    if (near.length) {
      me.yaw = Math.atan2(-(near[0].x - me.x), -(near[0].z - me.z));
      if (t >= nextStab) {
        nextStab = t + STAB.dur;
        const r = nearestReached(blowFrom(me, me.yaw, STAB), foes);
        if (r) damage(r, rng.range(STAB.damage[0], STAB.damage[1]), me.x, me.z, STAB.knock, 'knife');
      }
    }
    me.vx = me.vz = 0;
    me.unhurt += dt;
    if (me.unhurt > MOVE.healAfter) me.health = Math.min(MOVE.maxHealth, me.health + MOVE.healRate * dt);
    fauna.advance(dt, me, { x: me.x, y: me.y + 1.6, z: me.z, dx: -Math.sin(me.yaw), dy: 0, dz: -Math.cos(me.yaw) }, me.yaw);
    // A stalemate: after you, nothing in reach, no blow either way.
    stale = fauna.after(me) && !near.length && me.unhurt > 1 ? stale + dt : 0;
    if (stale > worst) { worst = stale; worstAt = `${me.x.toFixed(0)},${me.y.toFixed(1)},${me.z.toFixed(0)}: ` + foes.filter((e) => !e.dead && dist(e) < 14).slice(0, 5).map((e) => `${e.constructor.name} ${e.mode} ${dist(e).toFixed(1)} m, ${(e.y - me.y).toFixed(1)} up`).join('; '); }
    for (const e of foes) {
      const kind = `${e.constructor.name} ${e.mode}`, at = `${e.x.toFixed(1)},${e.y.toFixed(1)},${e.z.toFixed(1)}`;
      if (!Number.isFinite(e.x + e.y + e.z + e.health)) { note(`NaN: ${kind}`, at); continue; }
      if (e.dead) { track.delete(e); continue; }
      const s = level.sdf(e.x, e.y + e.height * 0.5, e.z);
      if (s < -0.25) note(`inside the rock: ${kind}`, `${at} (${s.toFixed(2)})`);
      if (kind.startsWith('Cricket') || kind.startsWith('Eel')) continue; // (on walls, in the air, under water)
      if (e.y < level.groundAt(e.x, e.z) - 0.6) note(`under the floor: ${kind}`, at);
      // Back and forth: a quick reversal right after another (as in test/ratJitter.test.ts).
      const p = track.get(e);
      if (!p) { track.set(e, { x: e.x, z: e.z, dx: 0, dz: 0, at: -9, quick: false }); continue; }
      const dx = e.x - p.x, dz = e.z - p.z;
      if (Math.hypot(dx, dz) < 0.002) continue;
      if (dx * p.dx + dz * p.dz < 0) {
        const quick = t - p.at < 0.25;
        if (quick && p.quick) note(`back and forth: ${kind}`, at);
        p.quick = quick; p.at = t;
      }
      p.x = e.x; p.z = e.z; p.dx = dx; p.dz = dz;
    }
  }
  console.log(`Level ${depth}, seed ${seed}: ${stations.length} stops; taken ${fmt(me.taken) || 'nothing'}; down ${me.downs}x, lowest ${me.low.toFixed(0)}; longest stalemate ${worst.toFixed(0)} s${worst > 15 ? ` (${worstAt})` : ''}`);
  for (const [k, { n, at }] of issues) console.log(`  ${k} (${n} steps), e.g. at ${at}`);
  console.log(`  ${fauna.tally().join(', ') || 'nothing killed'}`);
}
console.log('\nCandidates for a human to read: a stand-and-stab nobody is a gauge, not a player. Bites, blows and lunges reverse on purpose.');
