/**
 * The people of the village out by day (town-and-first-strata.md §3; Arnd 2026-10-17: "the town
 * presented in day time with people wandering around"): townsfolk walking the village's streets
 * (src/gen/village.ts) on the right of the road, turning into another street where one meets theirs,
 * across the square from one street to another, back where a street leaves the village. Now and
 * then one stops a while and looks about. They never walk into whoever stands in their way: they
 * stop and wait, turned to them.
 *
 * Pure: a function of the town's seed and the time stepped; the drawing is
 * src/render/humans/villagerView.ts.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { TOWN, TOWN_SEED, VILLAGE, townGround } from '../gen/town';
import { alongPolyline, closestOnPolyline, polylineLength } from '../gen/polyline';
import type { Road } from '../gen/village';
import { turnTowards } from '../creatures/creature';

export const VILLAGERS = {
  /** How many walk the village, and how many of them start on grandma's street. */
  count: 20,
  onHerStreet: 6,
  /** Walking speed, m/s (each their own within this). */
  speed: [1.0, 1.45] as const,
  /** How far right of the road's centre they walk: this much in from the road's edge. */
  kerb: 0.9,
  /** How near another street's end must come to a street to meet it (beyond its half-width), m. */
  meet: 6,
  /** How far past the village's reach (from the square) they still walk before turning back, m. */
  beyond: 15,
  /** The chance of turning into a street met on the way. */
  turnInto: 0.45,
  /** A stop to look about: how often (a chance per second of walking), how long (s). */
  stop: { chance: 0.02, s: [3, 9] as const },
  /** How near one in their way makes them stop (m), and how fast they turn (rad/s). */
  wait: 1.4,
  turn: 4,
  /** How many different looks there are (the humans drawn; src/render/humans/villagerView.ts). */
  looks: 6,
  /** Calling on one (E): how near one must stand, and how long they go on talking (s). */
  call: { reach: 2.0, talk: 3 },
  /** A greeting: how near one comes (m), how far one goes before they will greet again (m), and how long they stop for it (s). */
  greet: { near: 2.5, far: 8, hold: 2.5 },
  /** How many of the six on her street answer when called on (the rest only greet). */
  callers: 5,
} as const;

/** What a villager says when you come near: plain, wry, the town's voice (each keeps the same one). */
const GREETINGS: readonly string[] = [
  'Morning.',
  'Terrible about your gran.',
  "You're the one from the city, then.",
  "Don't mind the dog.",
  'That house has been quiet a long while.',
  'You have her look about you.',
  'Careful on the cobbles after rain.',
  'The hill has been muttering all week.',
  'Ilse is open till four, if you need anything.',
  'Mind how you go.',
];

/** What one of the callable few says when called on (each keeps the same line every game). */
const CALLS: readonly string[] = [
  "You're Grete's, aren't you. We all knew her.",
  'The whole street has been talking about the house. Nothing unkind.',
  'If you want the pawn shop, it is up past the lane.',
  'Your gran bought salt by the sack. We thought it was for the winter.',
  'The hill has been noisy since the funeral. Probably the wind.',
  'Mind the cellar steps. They are older than they look.',
];

/** The town's people's own seed (the town's is 1931: the same people every game). */
const SEED = deriveSeed(TOWN_SEED, 'villagers');

/** The seed of the k-th look's `part` (its face and body, its clothes): the same every game. */
export const townsfolkSeed = (k: number, part: 'look' | 'clothes'): number => deriveSeed(SEED, part, k);

/** Where one street meets another: at `s` on this one, onto `to` at `toS` going `toDir`; `cross`: over the square. */
interface Junction {
  readonly s: number;
  readonly to: Street;
  readonly toS: number;
  readonly toDir: number;
  readonly cross: boolean;
}

/** A street of the village as the walkers know it: the part they walk (lo..hi m along it), and where others meet it. */
interface Street {
  readonly road: Road;
  readonly lo: number;
  readonly hi: number;
  readonly junctions: Junction[];
}

/** The village's walkable streets and where they meet (tracks out in the fields are not walked). */
function network(): Street[] {
  const Q = VILLAGE.square, reach = VILLAGE.spec.r + VILLAGERS.beyond, V = VILLAGERS;
  const streets: Street[] = [];
  for (const road of VILLAGE.roads) {
    if (road.kind === 'track') continue;
    const L = polylineLength(road.pts);
    let lo = Infinity, hi = -Infinity;
    for (let s = 0; s <= L; s += 2) {
      const [x, z] = alongPolyline(road.pts, s);
      if (road.given || Math.hypot(x - Q.x, z - Q.z) < reach) { lo = Math.min(lo, s); hi = Math.max(hi, s); }
    }
    if (hi - lo > 10) streets.push({ road, lo, hi, junctions: [] });
  }
  const pointOn = (st: Street, s: number) => alongPolyline(st.road.pts, s);
  const atSquare = (x: number, z: number) => Math.hypot(x - Q.x, z - Q.z) < Q.r + V.meet;
  for (const b of streets) {
    for (const bs of [b.lo, b.hi]) {
      const [ex, ez] = pointOn(b, bs), into = bs === b.lo ? 1 : -1;
      for (const a of streets) {
        if (a === b) continue;
        if (atSquare(ex, ez)) {
          // Streets that both start at the square: across it from one to the other.
          for (const as of [a.lo, a.hi]) {
            const [x, z] = pointOn(a, as);
            if (atSquare(x, z)) b.junctions.push({ s: bs, to: a, toS: as, toDir: as === a.lo ? 1 : -1, cross: true });
          }
          continue;
        }
        const c = closestOnPolyline(a.road.pts, ex, ez);
        if (c.d > a.road.hw + V.meet || c.s < a.lo || c.s > a.hi) continue;
        // B's end on A: from A into B, and from B's end onto A either way.
        a.junctions.push({ s: c.s, to: b, toS: bs, toDir: into, cross: false });
        if (c.s > a.lo + 2) b.junctions.push({ s: bs, to: a, toS: c.s, toDir: -1, cross: false });
        if (c.s < a.hi - 2) b.junctions.push({ s: bs, to: a, toS: c.s, toDir: 1, cross: false });
      }
    }
  }
  return streets;
}

let streets_: Street[] | null = null;
const streets = (): Street[] => (streets_ ??= network());

export class Villager {
  x = 0;
  y: number = TOWN.ground;
  z = 0;
  vx = 0;
  vz = 0;
  yaw = 0;
  readonly health = 1;
  readonly dead = false;
  /** Which street, how far along its road (m), which way (+1 / −1). */
  private street: Street;
  s: number;
  dir: number;
  /** Crossing the square to (x, z), where `street` starts; null on a street. */
  cross: { x: number; z: number } | null = null;
  /** Standing still until then (s): looking about, greeting or talking. */
  until = 0;
  /** Waiting for someone in the way to move, or for the body to hear them out. */
  waiting = false;
  /** Their own greeting and their own line when called on: the same every game. */
  readonly greeting: string;
  readonly line: string;
  /** Whether they are one of the few on her street who answer E (the rest only greet). */
  readonly talks: boolean;
  /** When they last greeted or were called on (s), and how long they stop for a greeting. */
  talkAt = -Infinity;
  private greetUntil = -Infinity;
  /** Whether a greeting is owed on the next approach (disarmed until the body goes well away). */
  private armed = true;

  constructor(readonly look: number, readonly speed: number, street: Street, s: number, dir: number, private readonly rng: Rng, talks = false) {
    this.street = street; this.s = s; this.dir = dir;
    this.talks = talks;
    const voice = rng.fork('voice');
    this.greeting = voice.pick(GREETINGS);
    this.line = voice.pick(CALLS);
    this.keepRight(Infinity);
    const [, , dx, dz] = alongPolyline(street.road.pts, s);
    this.yaw = Math.atan2(-dx * dir, -dz * dir);
  }

  /** The road they are on (or crossing the square to). */
  get road(): Road {
    return this.street.road;
  }

  /** Whether they are walking (not stopped nor waiting). */
  get walking(): boolean {
    return this.vx !== 0 || this.vz !== 0;
  }

  /**
   * Go towards where they belong on their street (on its right as they walk), by at most `reach`
   * metres: onto a new street or over to its other side they walk, they do not jump.
   */
  private keepRight(reach: number): void {
    const road = this.street.road, [x, z, dx, dz] = alongPolyline(road.pts, this.s);
    const off = Math.max(0.4, road.hw - VILLAGERS.kerb);
    // Right of the way they walk (forward f, right (−fz, fx)).
    const fx = dx * this.dir, fz = dz * this.dir;
    const tx = x - fz * off - this.x, tz = z + fx * off - this.z, d = Math.hypot(tx, tz), k = d > reach ? reach / d : 1;
    this.x += tx * k; this.z += tz * k;
    this.y = townGround(this.x, this.z).y;
  }

  /** Step by dt (s) at time `now`; (px, pz): whoever might stand in the way. */
  stroll(dt: number, now: number, px: number, pz: number): void {
    const ox = this.x, oz = this.z;
    let hx = 0, hz = 0;
    if (this.cross) { hx = this.cross.x - this.x; hz = this.cross.z - this.z; }
    else { const [, , dx, dz] = alongPolyline(this.street.road.pts, this.s); hx = dx * this.dir; hz = dz * this.dir; }
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl; hz /= hl;
    // Someone just ahead: stop and wait, turned to them (no stepping back and forth). A greeting
    // or a conversation stops them a while too, facing whoever they are speaking to.
    const ax = px - this.x, az = pz - this.z, ad = Math.hypot(ax, az);
    const held = now < this.greetUntil || this.talking(now);
    this.waiting = held || (ad < VILLAGERS.wait && ax * hx + az * hz > -0.2);
    if (!this.waiting && now >= this.until && this.rng.chance(VILLAGERS.stop.chance * dt)) this.until = now + this.rng.range(...VILLAGERS.stop.s);
    let wantYaw = Math.atan2(-hx, -hz);
    if (this.waiting) wantYaw = Math.atan2(-ax, -az);
    else if (now >= this.until) this.amble(dt);
    this.yaw = turnTowards(this.yaw, wantYaw, VILLAGERS.turn * dt);
    this.vx = dt > 0 ? (this.x - ox) / dt : 0;
    this.vz = dt > 0 ? (this.z - oz) / dt : 0;
  }

  /** Whether one standing at (x, y, z) is near enough to call on them. */
  canHear(x: number, y: number, z: number): boolean {
    return Math.abs(y - this.y) < 1.2 && Math.hypot(x - this.x, z - this.z) < VILLAGERS.call.reach;
  }

  /** Whether they are talking at `now` (their hands go, and they stand still for it). */
  talking(now: number): boolean {
    return now - this.talkAt < VILLAGERS.call.talk;
  }

  /** Call on them at `now`: the one line that is theirs, the same every game. */
  talk(now: number): string {
    this.talkAt = now;
    return this.line;
  }

  /**
   * Come near at (x, y, z) at `now`: one greeting as one enters their reach, and no other until one
   * has gone well away (`VILLAGERS.greet.far`) and comes back. Null when nothing is said.
   */
  acknowledge(now: number, x: number, y: number, z: number): string | null {
    const G = VILLAGERS.greet, d = Math.hypot(x - this.x, z - this.z);
    if (d > G.far) { this.armed = true; return null; }
    if (!this.armed || d >= G.near || Math.abs(y - this.y) >= 1.2) return null;
    this.armed = false;
    this.greetUntil = now + G.hold;
    return this.greeting;
  }

  private amble(dt: number): void {
    const step = this.speed * dt;
    if (this.cross) {
      const dx = this.cross.x - this.x, dz = this.cross.z - this.z, d = Math.hypot(dx, dz);
      if (d <= step) { this.cross = null; return; }
      this.x += (dx / d) * step; this.z += (dz / d) * step;
      this.y = townGround(this.x, this.z).y;
      return;
    }
    const st = this.street, s0 = this.s;
    this.s = Math.max(st.lo, Math.min(st.hi, this.s + step * this.dir));
    const ended = this.s === (this.dir > 0 ? st.hi : st.lo);
    // A street met on the way (passed this step), or at the end every way on.
    const passed = st.junctions.filter((j) => !j.cross && (j.s - s0) * this.dir > 0 && (j.s - this.s) * this.dir <= 0);
    if (passed.length && this.rng.chance(VILLAGERS.turnInto)) this.go(passed[this.rng.int(0, passed.length - 1)]);
    else if (ended) {
      const ways = st.junctions.filter((j) => Math.abs(j.s - this.s) < VILLAGERS.meet);
      if (ways.length) this.go(ways[this.rng.int(0, ways.length - 1)]);
      else this.dir = -this.dir;
    }
    if (!this.cross) this.keepRight(step * 1.6);
  }

  private go(j: Junction): void {
    this.street = j.to; this.s = j.toS; this.dir = j.toDir;
    if (j.cross) {
      const road = j.to.road, [x, z, dx, dz] = alongPolyline(road.pts, j.toS), off = Math.max(0.4, road.hw - VILLAGERS.kerb);
      this.cross = { x: x - dz * j.toDir * off, z: z + dx * j.toDir * off };
    }
  }
}

/** The village's walkers, the same every game: some on grandma's street, the rest anywhere on its streets. */
export function villagers(): Villager[] {
  const rng = new Rng(SEED), V = VILLAGERS, out: Villager[] = [], all = streets();
  const her = all.find((st) => st.road.given) ?? all[0];
  const total = all.reduce((a, st) => a + st.hi - st.lo, 0);
  // A few of the six on her street answer when called on (the same few every game).
  const callers = new Set(new Rng(deriveSeed(SEED, 'callers')).sample([...Array(V.onHerStreet).keys()], V.callers));
  for (let k = 0; k < V.count; k++) {
    let st = her;
    if (k >= V.onHerStreet) {
      let t = rng.range(0, total);
      for (const c of all) { t -= c.hi - c.lo; st = c; if (t <= 0) break; }
    }
    out.push(new Villager(k % V.looks, rng.range(...V.speed), st, rng.range(st.lo + 0.1 * (st.hi - st.lo), st.hi - 0.1 * (st.hi - st.lo)), rng.sign(), rng.fork('walker', k), callers.has(k)));
  }
  return out;
}

/** The villager one may call on nearest (x, y, z), if one who talks is within reach (E's last rung). */
export function callableVillager(list: readonly Villager[], x: number, y: number, z: number): Villager | null {
  let best: Villager | null = null, near = Infinity;
  for (const v of list) {
    if (!v.talks || !v.canHear(x, y, z)) continue;
    const d = (v.x - x) ** 2 + (v.z - z) ** 2;
    if (d < near) { near = d; best = v; }
  }
  return best;
}
