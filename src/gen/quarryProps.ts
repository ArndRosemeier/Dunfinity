/**
 * What the quarrymen left behind (layer 3 of the generator, docs/design/level-generator.md §3):
 * narrow-gauge rails down the aisles between pillars, ore carts, lamps on posts and on pillar faces,
 * site shacks at quiet crossings, what was left against the pillars (crates and barrels, tools and
 * buckets, stacks of cut blocks), derricks for lifting blocks, and the stones and chippings they let fall. Pure data, in tiles of PROP_TILE metres, so it runs in a worker.
 *
 * Everything hangs off the working's pillar grid: aisles run along u = k·s and v = k·s. A tile only
 * places what sits inside it, and every decision is a hash of the working and grid position, so
 * tiles agree with each other and a seed always gives the same quarry.
 */
import { owns, type Style } from './style';
import type { Dress } from './styleProps';
import { deriveSeed, hash3i, hashToFloat } from '@futuremagic/core';
import { PROP_TILE, gridBounds, hasRail, propRoll, propSeed, workingsIn } from './propGrid';
import { SHED, shedPoint, type Shed } from './sheds';
import type { Level } from './level';
import { rockDistance, type Working } from './quarry';
import { ASCENT, RUNG, ladderOf, type Ladder, type Shaft } from './descents';
import type { GrandmasCamp } from './grandmasCamp';
import type { SaltCircle } from './lair';
import { furnishCellar } from './cellarProps';
import { PropBuilder, local, type PropMesh, type Rgb, type V3 } from './propMesh';
import { propModel, type Model } from './models';
import { acrossFace, alongPath, inscribe, inscribeLettering, type Inscription } from './inscriptions';
import { latin } from '../lore/scripts';
import type { Mark } from '../lore/diary';
import { markLine, type PageSpot } from './diaryPages';
import { THRESHOLD_LINTELS } from '../lore/fragments';
import { SkyBuilder, skyLights } from './glowworms';

export { PROP_TILE } from './propGrid';

export interface PropTile {
  /** Wood, iron, glass: lit like the rock. */
  solid: PropMesh | null;
  /** Burning lamps and lit windows: they glow. */
  glow: PropMesh | null;
  /** Standing water, where the ground lies below the water table. */
  water: PropMesh | null;
  /** Water running in a sheet up the rock (the Cisterns): drawn rippling upwards. */
  flow: PropMesh | null;
  /** Loose stones on the floor: drawn as rock. */
  stones: PropMesh | null;
  /** The town's houses, walls and roofs: drawn as houses (plaster, tiles). */
  house: PropMesh | null;
  /** Glow-worm skies on the roof (src/gen/glowworms.ts): drawn as their lights. */
  sky: PropMesh | null;
  /** Burning lamps, x, y, z each: where the level's lights go. */
  lamps: Float32Array;
  /** What one cannot walk through: upright boxes, BLOCKER_STRIDE numbers each (src/world/blockers.ts). */
  blockers: Float32Array;
  /** Statues whose figure the view draws (and turns): x, top of the plinth, z, yaw, pose, each. */
  watchers: Float32Array;
  /** Writing in the old scripts on the tile's props (src/gen/inscriptions.ts), for the game to read. */
  inscriptions: Inscription[];
  counts: { sleepers: number; carts: number; lamps: number; lit: number; shacks: number; wet: number; shafts: number; stones: number; leftovers: number; derricks: number; statues: number; watchers: number; chapels: number; hanging: number; machines: number; ruins: number; uphill: number; chalk: number; dressed: number; skies: number };
}

/** Sleeper spacing along a track, metres. */
const STEP = 0.7;
/** A track shorter than this many sleepers is not laid. */
const MIN_RUN = 10;
/** Half the rail gauge, metres. */
const GAUGE = 0.3;
/** Water surface cell, metres; wet cells in a row merge into runs of up to WATER_RUN cells. */
const WATER_CELL = 2;
const WATER_RUN = 4;
/** Cells whose floor is up to this far above the water still carry the surface, so it reaches under the shore rock, metres. */
const SHORE = 1;

const WOOD: Rgb = [0.2, 0.13, 0.075];
const RUST: Rgb = [0.13, 0.065, 0.04];
const IRON: Rgb = [0.06, 0.055, 0.05];
const GLASS: Rgb = [0.09, 0.085, 0.07];
const FLAME: Rgb = [1.0, 0.72, 0.4];
const SHALLOW: Rgb = [0.2, 0.21, 0.18];
const DEEP: Rgb = [0.015, 0.03, 0.035];
/** An electric lamp's enamel shade and its bulb, burning. */
const ENAMEL: Rgb = [0.09, 0.13, 0.1];
const BULB: Rgb = [1.0, 0.85, 0.6];
const WAX: Rgb = [0.5, 0.47, 0.38];
/** Chalk on the rock. */
const CHALK_WHITE: Rgb = [0.82, 0.8, 0.74];
/**
 * Chalk numbers: how far a shaft may be to be counted, metres; the height of the number's foot
 * above the floor (min, extra); a digit's size (width, height), the gap between digits, a stroke's
 * half thickness, how far it reaches into and out of the rock (so the drawn rock, a mesh a few cm off the field, never hides it) and the length of the pieces laid onto the rock one by one, metres; how uneven the hand is, metres; how far
 * the writing leans (share of height).
 */
const CHALK = { far: 900, at: [1.45, 0.35], size: [0.24, 0.42], gap: 0.1, thick: 0.02, out: 0.06, piece: 0.1, jitter: 0.025, slant: 0.25 } as const;
/** Digit strokes, seven-segment style: each segment's ends (x, y) in a unit-wide, unit-tall cell. */
const SEGMENT_ENDS: Record<string, readonly [number, number, number, number]> = {
  a: [0, 1, 1, 1], b: [1, 1, 1, 0.5], c: [1, 0.5, 1, 0], d: [0, 0, 1, 0], e: [0, 0, 0, 0.5], f: [0, 0.5, 0, 1], g: [0, 0.5, 1, 0.5],
};
const SEGMENTS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abfgcd'];

/** A sheet of water running over the rock: it catches more light than the pool. */
const SHEET: Rgb = [0.3, 0.36, 0.36];
/**
 * Water running uphill: one try per `cell` metres; the pool must lap within `reach` metres of the
 * rock; how high it climbs (min, extra), metres; the step up the sheet, its width at the pool and at
 * the top, how far it wanders sideways, and how far it stands off the rock, metres.
 */
const UPHILL = { cell: 6, reach: 2.5, rise: [3, 4], step: 0.25, width: [0.55, 0.12], wiggle: 0.2, off: 0.03 } as const;

/** The waterworks' and the bunker's paint: army green, and the canvas of the bunks. */
const ARMY: Rgb = [0.07, 0.085, 0.05];
const CANVAS: Rgb = [0.3, 0.28, 0.21];

/**
 * Loose stones: one try per DEBRIS.cell metres of floor. The chance of a stone there: a few
 * everywhere, many in rubble and collapse, a skirt of chippings round the feet of pillars and walls.
 * Radii in metres, bigger where the roof came down.
 */
const DEBRIS = { cell: 1, base: 0.04, rubble: 0.6, collapse: 0.4, foot: 0.3, footWidth: 1.6, small: [0.03, 0.09] as const, big: [0.12, 0.45] as const };

export function quarryProps(level: Level, tx: number, tz: number): PropTile {
  return new TileBuilder(level, tx, tz).build();
}

class TileBuilder {
  private readonly solid = new PropBuilder();
  private readonly glow = new PropBuilder();
  private readonly water = new PropBuilder();
  private readonly flow = new PropBuilder();
  private readonly stones = new PropBuilder();
  private readonly house = new PropBuilder();
  private readonly sky = new SkyBuilder();
  private readonly lamps: number[] = [];
  private readonly blocks: number[] = [];
  private readonly watchers: number[] = [];
  private readonly inscriptions: Inscription[] = [];
  private readonly counts = { sleepers: 0, carts: 0, lamps: 0, lit: 0, shacks: 0, wet: 0, shafts: 0, stones: 0, leftovers: 0, derricks: 0, statues: 0, watchers: 0, chapels: 0, hanging: 0, machines: 0, ruins: 0, uphill: 0, chalk: 0, dressed: 0, skies: 0 };
  private readonly seed: number;
  private readonly x0: number;
  private readonly z0: number;

  constructor(private readonly level: Level, tx: number, tz: number) {
    this.seed = propSeed(level);
    this.x0 = tx * PROP_TILE;
    this.z0 = tz * PROP_TILE;
  }

  build(): PropTile {
    if (this.level.depth === 0) return this.cellar();
    const workings = this.workings();
    if (workings.some((w) => w.floor < 0)) this.flood();
    for (const sh of this.level.descents.within(this.x0, this.z0, this.x0 + PROP_TILE, this.z0 + PROP_TILE)) this.shaft(sh);
    for (const w of workings) {
      if (w.collapse > 0 || w.cavern) continue; // nobody works a collapsed working any more (or a cavern: nobody cut it)
      const [umin, umax, vmin, vmax] = this.gridBounds(w);
      const s = w.spacing;
      for (let k = Math.floor(umin / s); k <= Math.ceil(umax / s); k++) if (hasRail(this.seed, w, 0, k)) this.track(w, 0, k, vmin, vmax);
      for (let k = Math.floor(vmin / s); k <= Math.ceil(vmax / s); k++) if (hasRail(this.seed, w, 1, k)) this.track(w, 1, k, umin, umax);
      for (let iu = Math.floor(umin / s) - 1; iu <= Math.ceil(umax / s); iu++) {
        for (let iv = Math.floor(vmin / s) - 1; iv <= Math.ceil(vmax / s); iv++) {
          this.pillarLamp(w, iu, iv);
          this.chalk(w, iu, iv);
        }
      }
    }
    for (const shed of this.level.sheds.ofTile(this.x0 / PROP_TILE, this.z0 / PROP_TILE)) this.shed(shed);
    const camp = this.level.camp;
    if (camp && this.inTile(camp.x, camp.z)) this.grandmasCamp(camp);
    const page = this.level.page;
    if (page && this.inTile(page.x, page.z)) this.pageUnderStone(page);
    for (const c of this.level.lair?.circles ?? []) if (this.inTile(c.x, c.z)) this.saltCircle(c);
    this.nooks();
    if (this.level.band.uphill > 0) this.uphill();
    for (const st of this.level.field.styles) if (st.props) st.props(this.dress(st));
    this.debris();
    for (const sky of this.level.skies.near(this.x0 + PROP_TILE / 2, this.z0 + PROP_TILE / 2, PROP_TILE)) if (this.inTile(sky.x, sky.z)) { skyLights(this.level, sky, this.sky); this.counts.skies++; }
    return this.done();
  }

  /** Grandma's cellar: her things (src/gen/cellarProps.ts) and the old shaft, no quarry. */
  private cellar(): PropTile {
    for (const sh of this.level.descents.within(this.x0, this.z0, this.x0 + PROP_TILE, this.z0 + PROP_TILE)) this.shaft(sh);
    furnishCellar({
      solid: this.solid, glow: this.glow, house: this.house,
      inTile: (x, z) => this.inTile(x, z),
      light: (x, y, z) => this.light(x, y, z),
      block: (x, z, yaw, hx, hz, y0, y1) => this.block(x, z, yaw, hx, hz, y0, y1),
    });
    return this.done();
  }

  /** What a style gets to dress its own ground in this tile with (src/gen/styleProps.ts). */
  private dress(st: Style): Dress {
    return {
      solid: this.solid, glow: this.glow, level: this.level, x0: this.x0, z0: this.z0, size: PROP_TILE,
      seed: deriveSeed(this.seed, st.id),
      mine: (x, z) => this.inTile(x, z) && owns(st, x, z) && !this.byCamp(x, z),
      block: (x, z, yaw, hx, hz, y0, y1) => this.block(x, z, yaw, hx, hz, y0, y1),
      light: (x, y, z) => this.light(x, y, z),
      placed: () => { this.counts.dressed++; },
      write: (ins, width, depth, colour) => this.write(ins, width, depth, colour),
    };
  }

  /** A burning light at (x, y, z): the renderer lights the nearest few (src/render/props/lamps.ts). */
  private light(x: number, y: number, z: number): void {
    this.lamps.push(x, y, z);
    this.counts.lit++;
  }

  private done(): PropTile {
    return { solid: this.solid.build(), glow: this.glow.build(), water: this.water.build(), flow: this.flow.build(), stones: this.stones.build(), house: this.house.build(), sky: this.sky.mesh(), lamps: new Float32Array(this.lamps), blockers: new Float32Array(this.blocks), watchers: new Float32Array(this.watchers), inscriptions: this.inscriptions, counts: this.counts };
  }

  /** Stones and chippings over the floor of the tile (see DEBRIS). */
  private debris(): void {
    const n = Math.round(PROP_TILE / DEBRIS.cell), s = this.seed;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const r = (k: number) => hashToFloat(hash3i(s, this.x0 / DEBRIS.cell + i, this.z0 / DEBRIS.cell + j, k));
      const x = this.x0 + (i + r(1)) * DEBRIS.cell, z = this.z0 + (j + r(2)) * DEBRIS.cell;
      if (this.byCamp(x, z) || this.level.sheds.holding(x, z, undefined, -0.5)) continue; // (nor in a shed: the miners swept it)
      const col = this.level.columnAt(x, z);
      const foot = Math.max(0, 1 - rockDistance(col) / DEBRIS.footWidth);
      const chance = DEBRIS.base + DEBRIS.rubble * col.rubble + DEBRIS.collapse * col.collapse + DEBRIS.foot * foot;
      if (r(0) >= chance) continue;
      // Mostly chippings; a big block where the rubble is.
      const big = r(3) < 0.15 + 0.6 * Math.max(col.rubble, col.collapse);
      const [lo, hi] = big ? DEBRIS.big : DEBRIS.small;
      const rad = lo + (hi - lo) * r(4) * r(4);
      const g = this.level.groundAt(x, z);
      if (g < this.level.waterAt(x, z) + 0.02 || this.level.descents.at(x, z, 1) || this.level.sdf(x, g + rad + 0.05, z) < rad * 0.5) continue;
      const c = this.tone(0.85 + 0.3 * r(5));
      // Limestone breaks blocky: a slab turned any way, tipped a little, half sunk in the dust. In a
      // natural cavern the water wore it round: a boulder.
      const hx = rad * (0.6 + 0.5 * r(7)), hy = rad * (0.3 + 0.35 * r(6)), hz = rad * (0.6 + 0.5 * r(8));
      const a = r(9) * Math.PI, ca = Math.cos(a), sa = Math.sin(a), t1 = (r(10) - 0.5) * 0.6, t2 = (r(11) - 0.5) * 0.6;
      if (col.cavern > 0.5) this.stones.ellipsoid(x, g + hy * 0.25, z, hx, hy * 1.3, hz, c, 7, t1);
      else this.stones.box(x, g + hy * 0.25, z, [ca * hx, t1 * hx, -sa * hx], [-t1 * ca * hy, hy, t2 * hy], [sa * hz, -t2 * hz, ca * hz], c);
      if (big && hy > 0.12) this.block(x, z, a, hx * 0.9, hz * 0.9, g - 0.2, g + hy * 1.25);
      this.counts.stones++;
    }
  }

  /** Something in the way: an upright box at (x, z) turned by `yaw` (as `PropBuilder.upright`), half sizes hx, hz, from y0 to y1. */
  private block(x: number, z: number, yaw: number, hx: number, hz: number, y0: number, y1: number): void {
    this.blocks.push(x, z, hx, hz, Math.cos(yaw), Math.sin(yaw), y0, y1);
  }

  /** A railing or a beam in the way, from (x0, z0) to (x1, z1), `half` thick. */
  private blockLine(x0: number, z0: number, x1: number, z1: number, half: number, y0: number, y1: number): void {
    const dx = x1 - x0, dz = z1 - z0;
    this.block((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-dz, dx), Math.hypot(dx, dz) / 2, half, y0, y1);
  }

  /** The water surface: cells whose floor lies below the table, merged into runs along x. */
  private flood(): void {
    const n = PROP_TILE / WATER_CELL;
    for (let j = 0; j < n; j++) {
      const z0 = this.z0 + j * WATER_CELL, z1 = z0 + WATER_CELL;
      let start = -1;
      let depth = 0;
      for (let i = 0; i <= n; i++) {
        let d = -Infinity;
        if (i < n) {
          const cx = this.x0 + (i + 0.5) * WATER_CELL, cz = z0 + WATER_CELL / 2;
          d = this.level.waterAt(cx, cz) - this.level.columnAt(cx, cz).floor;
        }
        const wet = d > -SHORE; // a cell just above the shore still carries the surface, under the rock
        if (start >= 0 && (!wet || i - start === WATER_RUN)) {
          const x0 = this.x0 + start * WATER_CELL, x1 = this.x0 + i * WATER_CELL;
          if (depth > 0) {
            const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
            this.water.quad(x0, z0, x1, z1, corners.map(([x, z]) => this.level.waterAt(x, z)), corners.map(([x, z]) => this.waterColor(x, z)));
            this.counts.wet += i - start;
          }
          start = -1;
        }
        if (!wet) continue;
        if (start < 0) { start = i; depth = d; } else depth = Math.max(depth, d);
      }
    }
  }

  /**
   * Water that runs uphill (docs/design/town-and-first-strata.md §4, the Cisterns): one try per
   * UPHILL.cell metres where a pool laps against a pillar or a wall. From the pool a thin sheet of
   * water climbs the rock, wandering a little and narrowing as it goes, and ends a few metres up.
   */
  private uphill(): void {
    const U = UPHILL, n = Math.round(PROP_TILE / U.cell), s = deriveSeed(this.seed, 'uphill'), l = this.level;
    const nrm: [number, number, number] = [0, 0, 0];
    const onto = (x: number, y: number, z: number) => l.ontoRock(x, y, z, nrm);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const r = (k: number) => hashToFloat(hash3i(s, this.x0 / U.cell + i, this.z0 / U.cell + j, k));
      if (r(0) > l.band.uphill) continue;
      const x = this.x0 + (i + r(1)) * U.cell, z = this.z0 + (j + r(2)) * U.cell;
      const col = l.columnAt(x, z), y0 = l.waterAt(x, z) - 0.05, d = rockDistance(col);
      if (col.collapse > 0 || col.floor > y0 - 0.1 || d > U.reach || this.byCamp(x, z)) continue;
      const top = Math.min(y0 + U.rise[0] + r(3) * U.rise[1], col.ceiling - 1.5);
      const a: V3[] = [], b: V3[] = [], ns: V3[] = [], cs: Rgb[] = [];
      // Find the face well above the pool (at the pool, the floor is nearer than the rock).
      const face = onto(x, y0 + 1.5, z);
      if (!face) continue;
      const fn: V3 = [nrm[0], 0, nrm[2]];
      let p: [number, number, number] | null = onto(face[0] + fn[0] * 0.2, y0, face[2] + fn[2] * 0.2);
      if (!p) { p = [face[0], y0, face[2]]; nrm[0] = fn[0]; nrm[2] = fn[2]; }
      // The pool must lap right against the face there.
      if (l.groundAt(p[0] + nrm[0] * 0.6, p[2] + nrm[2] * 0.6) > y0 - 0.05) continue;
      const steps = Math.floor((top - y0) / U.step), phase = r(4) * 6.283;
      for (let k = 0; p && k <= steps; k++) {
        const y = y0 + k * U.step, f = k / steps;
        const tx = -nrm[2], tz = nrm[0];
        const half = (U.width[0] + (U.width[1] - U.width[0]) * f) / 2, wig = U.wiggle * Math.sin(y * 1.3 + phase) * f;
        const cx = p[0] + tx * wig + nrm[0] * U.off, cz = p[2] + tz * wig + nrm[2] * U.off;
        a.push([cx - tx * half, y, cz - tz * half]);
        b.push([cx + tx * half, y, cz + tz * half]);
        ns.push([nrm[0], 0, nrm[2]]);
        const c = 1 - 0.5 * f;
        cs.push([SHEET[0] * c, SHEET[1] * c, SHEET[2] * c]);
        const was: V3 = [nrm[0], 0, nrm[2]], px: number = p[0], pz: number = p[2];
        p = onto(px + was[0] * 0.3, y + U.step, pz + was[2] * 0.3);
        // Low down the foot of the rock may hide the face: keep to the line found above.
        if (!p && y + U.step < y0 + 1.5) { p = [px, y + U.step, pz]; nrm[0] = was[0]; nrm[2] = was[2]; }
      }
      if (a.length < 6) continue;
      this.flow.ribbon(a, b, ns, cs);
      this.counts.uphill++;
    }
  }

  /** Water colour by depth: shallow water shows the pale floor, deep water is nearly black. */
  private waterColor(x: number, z: number): Rgb {
    const k = Math.min(1, Math.max(0, (this.level.waterAt(x, z) - this.level.columnAt(x, z).floor) / 2));
    return [SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * k, SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * k, SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * k];
  }

  private inTile(x: number, z: number): boolean {
    return x >= this.x0 && x < this.x0 + PROP_TILE && z >= this.z0 && z < this.z0 + PROP_TILE;
  }

  /** The workings that reach into this tile. */
  private workings(): Working[] {
    return workingsIn(this.level, this.x0, this.z0, PROP_TILE);
  }

  /** The tile's extent in w's grid coordinates: [umin, umax, vmin, vmax]. */
  private gridBounds(w: Working): [number, number, number, number] {
    return gridBounds(this.level, w, this.x0, this.z0, PROP_TILE);
  }

  /** The band's stone colour (loose stones, cut blocks, carvings), times k. */
  private tone(k: number): Rgb {
    const c = this.level.band.stone;
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  /** A per-decision random number for working w. */
  private roll(w: Working, a: number, b: number, c: number): number {
    return propRoll(this.seed, w, a, b, c);
  }

  /** Whether aisle k (dir 0: u = k·s, running along v; dir 1: v = k·s, running along u) has a track. */


  /** World position of point t along aisle k, and the aisle's world direction. */
  private aisle(w: Working, dir: number, k: number, t: number): [number, number, number, number] {
    const at = k * w.spacing;
    const [x, z] = dir === 0 ? this.level.field.excavation.fromGrid(w, at, t) : this.level.field.excavation.fromGrid(w, t, at);
    const [x1, z1] = dir === 0 ? this.level.field.excavation.fromGrid(w, at, t + 1) : this.level.field.excavation.fromGrid(w, t + 1, at);
    return [x, z, x1 - x, z1 - z];
  }

  /** Can a track lie at (x, z) of working w: open, level floor with headroom, clear of pillars and borders. */
  private trackable(w: Working, x: number, z: number): boolean {
    const col = this.level.columnAt(x, z);
    if (col.working.id !== w.id || col.border < 5 || col.collapse > 0 || col.rubble > 0.02 || col.pillarD < 1.3 || !this.mine(x, z)) return false;
    if (this.level.descents.at(x, z, 2)) return false;
    return col.floor > this.level.waterAt(x, z) + 0.25 && this.level.sdf(x, col.floor + 1.8, z) > 1.2;
  }

  /** Lay the track along aisle k: sleepers, rails, and the carts and lamps along it. */
  private track(w: Working, dir: number, k: number, tmin: number, tmax: number): void {
    const ok = memo((i) => {
      const [x, z] = this.aisle(w, dir, k, i * STEP);
      return this.trackable(w, x, z);
    });
    // A point is laid if it is part of a run of at least MIN_RUN trackable points.
    const laid = (i: number) => {
      if (!ok(i)) return false;
      let n = 1;
      for (let j = i - 1; n < MIN_RUN && ok(j); j--) n++;
      for (let j = i + 1; n < MIN_RUN && ok(j); j++) n++;
      return n >= MIN_RUN;
    };
    const groundOf = memo((i) => {
      const [x, z] = this.aisle(w, dir, k, i * STEP);
      return this.level.groundAt(x, z);
    });
    for (let i = Math.floor(tmin / STEP) - 1; i <= Math.ceil(tmax / STEP) + 1; i++) {
      const [x, z, fx, fz] = this.aisle(w, dir, k, i * STEP);
      if (!this.inTile(x, z) || !laid(i)) continue;
      const g = groundOf(i);
      const yaw = Math.atan2(fx, fz);
      const px = fz, pz = -fx; // across the track
      const shade = 0.75 + 0.5 * this.roll(w, 10 + dir, k, i);
      this.solid.upright(x, g + 0.1, z, yaw, 0.6, 0.06, 0.1, [WOOD[0] * shade, WOOD[1] * shade, WOOD[2] * shade]);
      this.counts.sleepers++;
      if (laid(i + 1)) {
        const [x1, z1] = this.aisle(w, dir, k, (i + 1) * STEP);
        const g1 = groundOf(i + 1);
        for (const sd of [-GAUGE, GAUGE]) this.solid.beam(x + px * sd, g + 0.22, z + pz * sd, x1 + px * sd, g1 + 0.22, z1 + pz * sd, 0.03, 0.045, RUST);
      }
      const r = this.roll(w, 20 + dir, k, i);
      if (r < 1 / 140 && laid(i - 3) && laid(i + 3)) this.cart(x, g, z, yaw, r * 140);
      else if (r > 1 - 1 / 26) {
        const side = r > 1 - 1 / 52 ? 1.15 : -1.15;
        this.post(w, x + px * side, z + pz * side, -px * Math.sign(side), -pz * Math.sign(side), this.roll(w, 30 + dir, k, i));
      }
    }
  }

  /** An ore cart on the rails, sometimes still loaded. */
  private cart(x: number, g: number, z: number, yaw: number, r: number): void {
    const cart = propModel(r < 0.6 ? 'prop_cart_loaded' : 'prop_cart');
    this.solid.stamp(cart, x, g, z, yaw);
    this.block(x, z, yaw, 0.52, 0.82, g, g + cart.max[1]);
    this.counts.carts++;
  }

  /** A lamp post beside a track at (x, z), its arm reaching along (dx, dz) over the track. */
  private post(w: Working, x: number, z: number, dx: number, dz: number, r: number): void {
    const col = this.level.columnAt(x, z);
    if (col.working.id !== w.id || col.pillarD < 0.4 || this.level.descents.at(x, z, 1)) return;
    const g = this.level.groundAt(x, z);
    if (this.level.sdf(x, g + 1.5, z) < 0.4 || !this.level.dry(x, z, 0.1)) return;
    this.solid.upright(x, g + 1.25, z, 0, 0.05, 1.25, 0.05, IRON);
    this.block(x, z, 0, 0.07, 0.07, g, g + 2.5);
    const ax = x + dx * 0.55, az = z + dz * 0.55;
    this.solid.beam(x, g + 2.45, z, ax, g + 2.45, az, 0.03, 0.03, IRON);
    this.lamp(ax, g + 2.3, az, r < 0.45);
  }

  /** A lamp on a bracket on one face of a whole pillar. */
  private pillarLamp(w: Working, iu: number, iv: number): void {
    const r = this.roll(w, 40, iu, iv);
    if (r > 0.12) return;
    const s = w.spacing, half = w.pillar / 2;
    const face = Math.floor(this.roll(w, 41, iu, iv) * 4);
    const du = face === 0 ? 1 : face === 1 ? -1 : 0, dv = face === 2 ? 1 : face === 3 ? -1 : 0;
    const field = this.level.field.excavation;
    const [x, z] = field.fromGrid(w, (iu + 0.5) * s + du * (half + 0.05), (iv + 0.5) * s + dv * (half + 0.05));
    if (!this.inTile(x, z) || field.pillarAt(w, iu, iv) !== 'whole' || this.level.columnAt(x, z).olderTop !== -Infinity) return; // (not on an older drum)
    const [ox, oz] = field.fromGrid(w, (iu + 0.5) * s + du * (half + 0.6), (iv + 0.5) * s + dv * (half + 0.6));
    const col = this.level.columnAt(ox, oz);
    if (col.working.id !== w.id || col.rubble > 0.05 || this.level.descents.at(ox, oz, 1)) return;
    const g = this.level.groundAt(ox, oz);
    if (this.level.sdf(ox, g + 3, oz) < 0.3 || !this.level.dry(ox, oz, 0.1)) return;
    this.solid.beam(x, g + 3.3, z, ox, g + 3.3, oz, 0.03, 0.03, IRON);
    this.lamp(ox, g + 3.15, oz, r < 0.06);
  }

  /**
   * A chalk number on a face of pillar (iu, iv) (the Quarry): how far it is to the nearest way down,
   * in tens of metres. Walk towards the shaft and the numbers count down. Each stroke is a thin box
   * laid onto the rock, the digits a little uneven, as a hand writes them.
   */
  private chalk(w: Working, iu: number, iv: number): void {
    const b = this.level.band;
    if (b.chalk <= 0 || this.roll(w, 50, iu, iv) > b.chalk) return;
    const s = w.spacing, half = w.pillar / 2, field = this.level.field.excavation;
    const face = Math.floor(this.roll(w, 51, iu, iv) * 4);
    const du = face === 0 ? 1 : face === 1 ? -1 : 0, dv = face === 2 ? 1 : face === 3 ? -1 : 0;
    const [cx, cz] = field.fromGrid(w, (iu + 0.5) * s, (iv + 0.5) * s);
    const [fx, fz] = field.fromGrid(w, (iu + 0.5) * s + du * half, (iv + 0.5) * s + dv * half);
    if (!this.inTile(fx, fz) || field.pillarAt(w, iu, iv) !== 'whole') return;
    const nl = Math.hypot(fx - cx, fz - cz) || 1, nx = (fx - cx) / nl, nz = (fz - cz) / nl;
    const ox = fx + nx * 0.8, oz = fz + nz * 0.8;
    const col = this.level.columnAt(ox, oz);
    if (col.working.id !== w.id || col.rubble > 0.05 || !this.level.dry(ox, oz, 0.1) || this.level.descents.at(ox, oz, 2)) return;
    const shaft = this.level.descents.nearest(fx, fz, CHALK.far);
    if (!shaft) return;
    const n = Math.min(99, Math.max(1, Math.ceil(Math.hypot(shaft.x - fx, shaft.z - fz) / 10)));
    const digits = String(n), C = CHALK, tx = nz, tz = -nx; // (tx, tz): to the right, seen from in front
    const out: [number, number, number] = [nx, 0, nz];
    const r = (k: number) => this.roll(w, 60 + k, iu, iv);
    const y0 = this.level.groundAt(ox, oz) + C.at[0] + r(0) * C.at[1], slant = (r(1) - 0.5) * C.slant;
    const width = digits.length * C.size[0] + (digits.length - 1) * C.gap;
    const shift = (r(2) - 0.5) * 0.3;
    let k = 0;
    // A stroke from (a) to (b), in metres across and up the face from the number's lower left: in
    // short pieces, each laid onto the rock (the drawn rock is a mesh of the field, a few cm off it).
    const stroke = (ax: number, ay: number, bx: number, by: number) => {
      const j = (q: number) => (r(10 + k * 4 + q) - 0.5) * C.jitter;
      ax += j(0) + ay * slant; bx += j(2) + by * slant; ay += j(1); by += j(3);
      k++;
      const pieces = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / C.piece));
      const hx = (bx - ax) / pieces / 2, hy = (by - ay) / pieces / 2, len = Math.hypot(hx, hy) || 1;
      // Along the stroke; across it in the face (n × along, so the box is right-handed); out of the rock.
      const u = [tx * hx * 1.15, hy * 1.15, tz * hx * 1.15] as const;
      const v = [(-nz * hy) / len * C.thick, ((nz * tx - nx * tz) * hx) / len * C.thick, (nx * hy) / len * C.thick] as const;
      for (let q = 0; q < pieces; q++) {
        const mx = ax + (2 * q + 1) * hx - width / 2 + shift, my = ay + (2 * q + 1) * hy;
        const p = this.level.ontoRock(fx + tx * mx + nx * 0.3, y0 + my, fz + tz * mx + nz * 0.3, out, true);
        if (p) this.solid.box(p[0], p[1], p[2], u, v, [nx * C.out, 0, nz * C.out], CHALK_WHITE);
      }
    };
    let x = 0;
    for (const ch of digits) {
      for (const sg of SEGMENTS[Number(ch)]) {
        const [ax, ay, bx, by] = SEGMENT_ENDS[sg];
        stroke(x + ax * C.size[0], ay * C.size[1], x + bx * C.size[0], by * C.size[1]);
      }
      x += C.size[0] + C.gap;
    }
    if (r(3) < 0.5) stroke(-0.05, -0.08, width + 0.05, -0.1); // underlined
    this.counts.chalk++;
  }

  /** A lamp housing with its bulb below; a burning one glows and becomes a light. */
  private lamp(x: number, y: number, z: number, lit: boolean): void {
    this.solid.upright(x, y + 0.06, z, 0, 0.1, 0.05, 0.1, IRON);
    (lit ? this.glow : this.solid).upright(x, y - 0.06, z, 0, 0.065, 0.07, 0.065, lit ? FLAME : GLASS);
    this.counts.lamps++;
    if (!lit) return;
    this.counts.lit++;
    this.lamps.push(x, y - 0.25, z);
  }

  /**
   * A mine shaft (src/gen/descents.ts): a timber headframe over it with a pulley and a burning lamp,
   * a railing round the rim with a gap at the ladder, and the iron ladder down the wall.
   */
  private shaft(sh: Shaft): void {
    if (sh.up) { this.wayUp(sh); return; }
    const frame: Rgb = [WOOD[0] * 0.8, WOOD[1] * 0.8, WOOD[2] * 0.8];
    if (this.level.depth > 0) this.headframe(sh, frame); // (no room for one under grandma's house)
    this.railing(sh, frame);
    this.ladder(ladderOf(sh), 0.4);
    this.counts.shafts++;
  }

  /** A shaft's headframe: four legs leaning in to a square top, cross beams, a pulley wheel, a lamp. */
  private headframe(sh: Shaft, frame: Rgb): void {
    const { x, z, r, top } = sh;
    // Headframe: four legs leaning in to a square top, cross beams, a pulley wheel on top.
    const H = 7, base = r + 0.7, head = 1.1;
    const legs: [number, number, number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const a = sh.ladder + Math.PI / 4 + (k * Math.PI) / 2;
      legs.push([x + Math.cos(a) * base, z + Math.sin(a) * base, x + Math.cos(a) * head, z + Math.sin(a) * head]);
    }
    for (const [bx, bz, tx, tz] of legs) {
      this.solid.beam(bx, top, bz, tx, top + H, tz, 0.14, 0.14, frame);
      this.block(bx, bz, 0, 0.18, 0.18, top - 0.5, top + 2);
    }
    for (let k = 0; k < 4; k++) {
      const [, , ax, az] = legs[k], [, , bx, bz] = legs[(k + 1) % 4];
      this.solid.beam(ax, top + H, az, bx, top + H, bz, 0.1, 0.12, frame);
      const [lx, lz] = [legs[k][0] * 0.55 + legs[k][2] * 0.45, legs[k][1] * 0.55 + legs[k][3] * 0.45];
      const [mx, mz] = [legs[(k + 1) % 4][0] * 0.55 + legs[(k + 1) % 4][2] * 0.45, legs[(k + 1) % 4][1] * 0.55 + legs[(k + 1) % 4][3] * 0.45];
      this.solid.beam(lx, top + H * 0.45, lz, mx, top + H * 0.45, mz, 0.08, 0.1, frame);
    }
    const ca = Math.cos(sh.ladder), sa = Math.sin(sh.ladder);
    this.solid.box(x, top + H + 0.75, z, [ca * 0.06, 0, sa * 0.06], [0, 0.7, 0], [-sa * 0.7, 0, ca * 0.7], IRON); // pulley wheel
    this.solid.upright(x, top + (H + 6.75) / 2 - 6, z, 0, 0.015, (H + 6.75) / 2, 0.015, RUST); // the rope, hanging into the dark
    this.lamp(x + ca * 0.9, top + H - 0.3, z + sa * 0.9, true);
  }

  /** Railing round a shaft's rim: posts and two rails, open where the ladder is. */
  private railing(sh: Shaft, frame: Rgb): void {
    const { x, z, r, top } = sh;
    // Railing: posts round the rim and two rails between them, open where the ladder is.
    const n = 12, rr = r + 0.35;
    for (let k = 0; k < n; k++) {
      const a0 = sh.ladder + ((k + 0.5) * Math.PI * 2) / n, a1 = sh.ladder + ((k + 1.5) * Math.PI * 2) / n;
      const px = x + Math.cos(a0) * rr, pz = z + Math.sin(a0) * rr;
      this.solid.upright(px, top + 0.55, pz, a0, 0.05, 0.55, 0.05, frame);
      if (k === n - 1) continue; // the gap at the ladder
      const qx = x + Math.cos(a1) * rr, qz = z + Math.sin(a1) * rr;
      for (const h of [0.5, 1.0]) this.solid.beam(px, top + h, pz, qx, top + h, qz, 0.03, 0.03, frame);
      this.blockLine(px, pz, qx, qz, 0.06, top - 0.5, top + 1.05);
    }
  }

  /**
   * The way up (src/gen/descents.ts): the ladder up the pillar and on up the shaft in the ceiling,
   * held by brackets, and a burning lamp on the pillar beside its foot.
   */
  private wayUp(sh: Shaft): void {
    const l = ladderOf(sh);
    this.ladder(l, 0.6);
    for (let y = l.floor + 1.5; y < l.hi; y += 3) {
      for (const sd of [-1, 1]) {
        const bx = l.x - l.nz * l.halfWidth * sd, bz = l.z + l.nx * l.halfWidth * sd;
        this.solid.beam(bx, y, bz, bx + l.nx * (ASCENT.standoff + 0.25), y, bz + l.nz * (ASCENT.standoff + 0.25), 0.02, 0.02, IRON);
      }
    }
    // A lamp on an iron bracket out from the pillar, beside the ladder.
    const side = 0.9, lx = l.x - l.nz * side, lz = l.z + l.nx * side, out = -0.25; // (n points into the pillar)
    this.solid.beam(lx + l.nx * (ASCENT.standoff + 0.2), l.floor + 2.5, lz + l.nz * (ASCENT.standoff + 0.2), lx + l.nx * out, l.floor + 2.5, lz + l.nz * out, 0.02, 0.02, IRON);
    this.lamp(lx + l.nx * out, l.floor + 2.4, lz + l.nz * out, true);
    this.counts.shafts++;
  }

  /** A ladder's two stiles and its rungs (src/gen/descents.ts `Ladder`), the stiles `over` metres past the top rung. */
  private ladder(l: Ladder, over: number): void {
    const sx = -l.nz * l.halfWidth, sz = l.nx * l.halfWidth;
    const y0 = l.rim ? l.lo - 0.4 : l.floor, y1 = l.hi + over;
    for (const sd of [-1, 1]) this.solid.upright(l.x + sx * sd, (y0 + y1) / 2, l.z + sz * sd, 0, 0.025, (y1 - y0) / 2, 0.025, RUST);
    for (let y = l.lo; y <= l.hi + 1e-6; y += RUNG) this.solid.beam(l.x - sx, y, l.z - sz, l.x + sx, y, l.z + sz, 0.015, 0.015, RUST);
  }

  /**
   * Over the tile in cells of LEFT.cell metres: against the rock (a pillar or a wall) something left
   * behind; out in the open, now and then, a derrick for lifting blocks.
   */
  private nooks(): void {
    const n = Math.round(PROP_TILE / LEFT.cell), s = deriveSeed(this.seed, 'nooks');
    const o: [number, number, number] = [0, 0, 0];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const r = (k: number) => hashToFloat(hash3i(s, this.x0 / LEFT.cell + i, this.z0 / LEFT.cell + j, k));
      const x = this.x0 + (i + 0.15 + 0.7 * r(1)) * LEFT.cell, z = this.z0 + (j + 0.15 + 0.7 * r(2)) * LEFT.cell;
      if (this.byCamp(x, z) || this.level.sheds.holding(x, z, undefined, -2)) continue;
      const col = this.level.columnAt(x, z);
      if (col.collapse > 0 || col.rubble > 0.05 || col.border < 3 || this.level.descents.at(x, z, 4) || !this.level.dry(x, z, 0.1)) continue;
      // How far to the rock beside (a pillar or a wall; the floor and roof do not count).
      const g = this.level.groundAt(x, z), d = rockDistance(col);
      if (d < 0.3 || this.level.sdf(x, g + 2, z) < 0.3) continue;
      if (d < 2.2) {
        // Against a cavern's rock nobody left anything, but something far older stands there now and then.
        const b = this.level.band, cavern = col.cavern > 0.5;
        if (r(0) > (cavern ? b.ruins : LEFT.chance)) continue;
        // Back it against the rock: the rock's normal there points out into the air.
        this.level.normal(x, g + 1.6, z, o);
        const h = Math.hypot(o[0], o[2]);
        if (h < 0.5) continue;
        const ox = o[0] / h, oz = o[2] / h;
        const rx = x - ox * (d - 0.05), rz = z - oz * (d - 0.05);
        if (cavern) { this.ruin(rx, rz, ox, oz, g, r); continue; }
        if (!this.mine(x, z)) continue;
        if (r(5) < b.machines) this.waterworks(rx, rz, ox, oz, g, r);
        else if (r(5) >= b.machines + b.carvings) this.leftBehind(rx, rz, ox, oz, g, r);
        else if (r(6) < 0.2) this.chapel(rx, rz, ox, oz, g, r);
        else this.statue(rx, rz, ox, oz, r);
      } else if (!this.mine(x, z)) continue;
      else if (r(0) < LEFT.derricks && d > 5) this.derrick(x, z, r(3) * Math.PI * 2, r);
      else if (r(0) > 1 - this.level.band.hanging && d > 2.5) this.hangingLamp(x, z, g, r);
    }
  }

  /**
   * Something left against the rock at (x, z), backed onto it, (ox, oz) pointing away from it: crates
   * and a barrel, tools and a bucket, or a stack of cut blocks waiting to be hauled.
   */
  private leftBehind(x: number, z: number, ox: number, oz: number, g: number, r: (k: number) => number): void {
    const yaw = Math.atan2(ox, oz);
    // (side, out) from the rock face to world: side runs along the face, out away from it.
    const at = local(x, z, yaw);
    const ground = (px: number, pz: number) => this.level.groundAt(px, pz);
    const kind = Math.floor(r(10) * 3);
    // A model standing on the ground at (side, out), turned by `turn` from facing out, blocking its footprint.
    const put = (into: PropBuilder, m: Model, side: number, out: number, turn: number, opts: { lean?: number; scale?: number; tint?: Rgb; y?: number } = {}) => {
      const [px, pz] = at(side, out), s = opts.scale ?? 1, py = opts.y ?? ground(px, pz);
      into.stamp(m, px, py, pz, yaw + turn, opts);
      if (!opts.lean) this.block(px, pz, yaw + turn, m.max[0] * s, m.max[2] * s, py - 0.3, py + m.max[1] * s);
      return py + m.max[1] * s;
    };
    if (kind === 0) {
      // Crates, one on another sometimes, and a barrel.
      const crate = propModel('prop_crate');
      for (let c = 0; c < 2 + Math.floor(r(11) * 2); c++) {
        const scale = 0.75 + 0.4 * r(12 + c), turn = (r(15 + c) - 0.5) * 0.4;
        const top = put(this.solid, crate, -0.9 + c * 0.62, scale * 0.3 + 0.05, turn, { scale });
        if (c === 0 && r(18) < 0.5) put(this.solid, crate, -0.9, scale * 0.3 + 0.05, r(19), { scale: 0.55, y: top });
      }
      put(this.solid, propModel('prop_barrel'), 1.05, 0.37, r(20) * Math.PI * 2);
    } else if (kind === 1) {
      // A pick and a shovel leant on the rock, a bucket by them.
      put(this.solid, propModel('prop_pick'), -0.4, 0.42, (r(11) - 0.5) * 0.3, { lean: 0.42 });
      put(this.solid, propModel('prop_shovel'), 0.15, 0.45, (r(12) - 0.5) * 0.3, { lean: 0.42 });
      put(this.solid, propModel('prop_bucket'), 0.75, 0.4, r(13) * Math.PI * 2);
    } else {
      // Cut blocks, squared and stacked, the way they were never hauled up.
      const block = propModel('prop_cut_block'), rows = 1 + Math.floor(r(11) * 2), cols = 2 + Math.floor(r(12) * 2);
      for (let y = 0; y < rows; y++) for (let c = 0; c < cols - y; c++) {
        // The block is modelled white (its colours are only its shading): the band's stone paints it.
        const tint = this.tone((0.9 + 0.2 * r(13 + c + y * 3)) * 1.08);
        const turn = (r(20 + c) - 0.5) * 0.08 + (r(30 + c + y * 3) < 0.5 ? Math.PI : 0);
        const [cx, cz] = at(-0.85 + (c + y * 0.5) * 0.85, 0.5);
        this.stones.stamp(block, cx, g + y * 0.4, cz, yaw + turn, { tint });
        if (y === 0) this.block(cx, cz, yaw + turn, 0.4, 0.4, g - 0.3, g + 0.4 * rows);
      }
    }
    this.counts.leftovers++;
  }

  /**
   * A waterworks fitting against the rock at (x, z), (ox, oz) pointing away from it: pipes along the
   * rock on brackets with a valve on a branch, a pump on its plinth with its motor, or the wartime
   * bunker's furniture (a table and chairs by a filing cabinet, or a bunk bed).
   */
  private waterworks(x: number, z: number, ox: number, oz: number, g: number, r: (k: number) => number): void {
    const yaw = Math.atan2(ox, oz), at = local(x, z, yaw);
    const ground = (px: number, pz: number) => this.level.groundAt(px, pz);
    const kind = Math.floor(r(10) * 3);
    if (kind === 0) {
      // Two pipes along the rock, flanged, on brackets; a branch out and down with a valve wheel.
      const [qx, qz] = at(0, 0.8);
      if (this.level.sdf(qx, g + 2.4, qz) < 0.3) return;
      for (const [h, rad] of [[1.25, 0.16], [2.1, 0.11]] as const) {
        const [ax, az] = at(-2.2, 0.32), [bx, bz] = at(2.2, 0.32);
        this.solid.tube(ax, g + h, az, bx, g + h, bz, rad, RUST, 12);
        for (const sd of [-1.6, 0, 1.6]) {
          const [fx, fz] = at(sd - 0.04, 0.32), [gx, gz] = at(sd + 0.04, 0.32), [kx, kz] = at(sd, 0.02);
          this.solid.tube(fx, g + h, fz, gx, g + h, gz, rad * 1.3, IRON, 12);
          this.solid.beam(kx, g + h - rad - 0.04, kz, gx, g + h - rad - 0.04, gz, 0.03, 0.03, IRON);
        }
      }
      const [ex, ez] = at(0.9, 0.32), [dx, dz] = at(0.9, 0.62), dy = ground(dx, dz);
      this.solid.tube(ex, g + 1.25, ez, dx, g + 1.25, dz, 0.1, RUST);
      this.solid.tube(dx, g + 1.35, dz, dx, dy, dz, 0.1, RUST);
      this.solid.upright(dx, dy + 0.8, dz, yaw, 0.16, 0.12, 0.16, IRON);
      // The wheel, facing out: a rim of eight bars and two spokes.
      const [wx, wz] = at(0.9, 0.84), wy = dy + 0.8, R = 0.22;
      this.solid.beam(dx, wy, dz, wx, wy, wz, 0.02, 0.02, IRON);
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
        const [p0x, p0z] = at(0.9 + Math.cos(a0) * R, 0.84), [p1x, p1z] = at(0.9 + Math.cos(a1) * R, 0.84);
        this.solid.tube(p0x, wy + Math.sin(a0) * R, p0z, p1x, wy + Math.sin(a1) * R, p1z, 0.018, RUST, 6);
      }
      for (const a of [0, Math.PI / 2]) {
        const [p0x, p0z] = at(0.9 + Math.cos(a) * R, 0.84), [p1x, p1z] = at(0.9 - Math.cos(a) * R, 0.84);
        this.solid.beam(p0x, wy + Math.sin(a) * R, p0z, p1x, wy - Math.sin(a) * R, p1z, 0.012, 0.012, RUST);
      }
      this.block(dx, dz, yaw, 0.15, 0.3, dy - 0.3, g + 1.4);
      this.blockLine(...at(-2.2, 0.32), ...at(2.2, 0.32), 0.18, g + 1.05, g + 2.25);
    } else if (kind === 1) {
      // A pump on its concrete plinth, the motor beside it on one shaft, the outlet up and into the rock.
      const [px, pz] = at(0, 1.0), py = ground(px, pz);
      if (this.level.sdf(px, py + 2, pz) < 0.5 || !this.level.dry(px, pz, 0.05)) return;
      this.stones.upright(px, py + 0.11, pz, yaw, 1.1, 0.11, 0.7, this.tone(1.05));
      const [bx, bz] = at(-0.4, 1.0), [mx, mz] = at(0.5, 1.0), top = py + 0.22;
      this.solid.cylinder(bx, top + 0.45, bz, 0.4, 0.45, ARMY, 16, 0.08);
      this.solid.ellipsoid(bx, top + 0.9, bz, 0.4, 0.16, 0.4, ARMY, 14);
      this.solid.upright(mx, top + 0.3, mz, yaw, 0.38, 0.3, 0.3, [ARMY[0] * 0.8, ARMY[1] * 0.8, ARMY[2] * 0.8]);
      for (const sd of [-0.18, 0.18]) { const [fx, fz] = at(0.5 + sd, 1.0); this.solid.upright(fx, top + 0.3, fz, yaw, 0.02, 0.33, 0.33, IRON); }
      this.solid.beam(bx, top + 0.45, bz, mx, top + 0.3, mz, 0.06, 0.06, IRON);
      const [wx, wz] = at(-0.4, 0.05);
      this.solid.tube(bx, top + 0.95, bz, bx, top + 1.73, bz, 0.13, RUST, 12);
      this.solid.tube(bx, top + 1.6, bz, wx, top + 1.6, wz, 0.13, RUST, 12);
      this.block(px, pz, yaw, 1.1, 0.7, py - 0.3, py + 1.4);
    } else {
      const [cx, cz] = at(0, 1.1), gy = ground(cx, cz);
      if (this.level.sdf(cx, gy + 1.8, cz) < 0.4 || !this.level.dry(cx, cz, 0.05)) return;
      const wood: Rgb = [WOOD[0] * 1.6, WOOD[1] * 1.45, WOOD[2] * 1.2];
      if (r(12) < 0.55) {
        // A table, two chairs pulled up to it, a filing cabinet against the rock.
        this.solid.upright(cx, gy + 0.76, cz, yaw, 0.7, 0.025, 0.4, wood);
        for (const [a, b] of [[-0.64, 0.75], [0.64, 0.75], [-0.64, 1.45], [0.64, 1.45]]) { const [lx, lz] = at(a, b); this.solid.upright(lx, gy + 0.37, lz, yaw, 0.025, 0.37, 0.025, wood); }
        this.block(cx, cz, yaw, 0.7, 0.4, gy - 0.3, gy + 0.8);
        for (const sd of [-0.35, 0.4]) {
          const [sx, sz] = at(sd, 1.72), [kx, kz] = at(sd, 1.92), syaw = yaw;
          this.solid.upright(sx, gy + 0.45, sz, syaw, 0.2, 0.02, 0.2, wood);
          this.solid.upright(kx, gy + 0.7, kz, syaw, 0.2, 0.25, 0.02, wood);
          for (const [a, b] of [[-0.17, 1.55], [0.17, 1.55], [-0.17, 1.9], [0.17, 1.9]]) { const [lx, lz] = at(sd + a, b); this.solid.upright(lx, gy + 0.22, lz, syaw, 0.018, 0.22, 0.018, wood); }
          this.block(sx, sz, syaw, 0.22, 0.22, gy - 0.3, gy + 0.9);
        }
        const [fx, fz] = at(1.45, 0.32), fy = ground(fx, fz);
        this.solid.upright(fx, fy + 0.66, fz, yaw, 0.24, 0.66, 0.3, ARMY);
        for (let k = 0; k < 4; k++) { const [hx, hz] = at(1.45, 0.63); this.solid.upright(hx, fy + 0.2 + k * 0.32, hz, yaw, 0.06, 0.012, 0.012, IRON); }
        this.block(fx, fz, yaw, 0.24, 0.3, fy - 0.3, fy + 1.32);
      } else {
        // A bunk bed along the rock: posts, two frames, thin canvas mattresses.
        for (const [a, b] of [[-0.95, 0.12], [0.95, 0.12], [-0.95, 0.98], [0.95, 0.98]]) { const [px, pz] = at(a, b); this.solid.upright(px, gy + 0.85, pz, yaw, 0.025, 0.85, 0.025, ARMY); }
        for (const h of [0.38, 1.28]) {
          const [mx, mz] = at(0, 0.55);
          this.solid.upright(mx, gy + h, mz, yaw, 0.95, 0.03, 0.43, ARMY);
          this.solid.upright(mx, gy + h + 0.07, mz, yaw, 0.92, 0.05, 0.4, CANVAS);
        }
        const [bx, bz] = at(0, 0.55);
        this.block(bx, bz, yaw, 1.0, 0.46, gy - 0.3, gy + 1.7);
      }
    }
    this.counts.machines++;
  }

  /**
   * A miner carved in salt, on a plinth against the rock at (x, z), facing out along (ox, oz). Some of
   * them are watchers: only the plinth is part of the tile, and the figure on it is drawn by the view
   * (src/render/props/watchers.ts), which turns it to face you while you are not looking.
   */
  private statue(x: number, z: number, ox: number, oz: number, r: (k: number) => number): void {
    const px = x + ox * 0.5, pz = z + oz * 0.5;
    if (this.level.sdf(px, this.level.groundAt(px, pz) + 2.2, pz) < 0.45) return;
    const gy = this.level.groundAt(px, pz), yaw = Math.atan2(ox, oz), top = gy + 0.62;
    this.stones.upright(px, gy + 0.28, pz, yaw, 0.42, 0.34, 0.42, this.tone(0.95));
    this.block(px, pz, yaw, 0.42, 0.42, gy - 0.3, top + 1.8);
    const pose = Math.floor(r(41) * MINER_POSES);
    if (r(46) < WATCHERS) {
      this.watchers.push(px, top, pz, yaw, pose);
      this.counts.watchers++;
    } else carveMiner(this.stones, px, top, pz, yaw, pose, this.tone(1.1 + 0.1 * r(40)));
    this.counts.statues++;
  }

  /**
   * A salt chapel against the rock at (x, z), (ox, oz) pointing away from it: steps up to an altar,
   * a cross cut into the rock above it, and candles still burning.
   */
  private chapel(x: number, z: number, ox: number, oz: number, g: number, r: (k: number) => number): void {
    const yaw = Math.atan2(ox, oz);
    const at = local(x, z, yaw);
    for (const [sd, out] of [[-1.4, 1], [1.4, 1], [0, 1.6]]) {
      const [cx, cz] = at(sd, out);
      if (!this.level.dry(cx, cz, 0.1) || Math.abs(this.level.groundAt(cx, cz) - g) > 0.35) return;
    }
    const [hx, hz] = at(0, 0.6);
    if (this.level.sdf(hx, g + 3.2, hz) < 0.4) return;
    const [s1x, s1z] = at(0, 0.95), [s2x, s2z] = at(0, 0.6), [ax, az] = at(0, 0.42), [kx, kz] = at(0, 0.1);
    this.stones.upright(s1x, g, s1z, yaw, 1.5, 0.15, 0.95, this.tone(0.95));
    this.stones.upright(s2x, g + 0.2, s2z, yaw, 1.15, 0.15, 0.6, this.tone(1));
    this.stones.upright(ax, g + 0.85, az, yaw, 0.8, 0.5, 0.3, this.tone(1.1));
    this.stones.upright(ax, g + 1.37, az, yaw, 0.88, 0.03, 0.36, this.tone(1.15));
    this.stones.upright(kx, g + 2.75, kz, yaw, 0.1, 0.95, 0.12, this.tone(1.15));
    this.stones.upright(kx, g + 3.15, kz, yaw, 0.55, 0.1, 0.12, this.tone(1.15));
    this.block(s2x, s2z, yaw, 1.5, 0.95, g - 0.3, g + 1.4);
    const n = 3 + Math.floor(r(42) * 4);
    for (let c = 0; c < n; c++) {
      const [cx, cz] = at(-0.65 + (1.3 * c) / (n - 1), 0.42 + (r(43 + c) - 0.5) * 0.25);
      const h = 0.05 + 0.08 * r(50 + c);
      this.solid.cylinder(cx, g + 1.4 + h, cz, 0.025, h, WAX, 8);
      this.glow.upright(cx, g + 1.4 + h * 2 + 0.035, cz, yaw, 0.012, 0.03, 0.012, FLAME);
    }
    const [lx, lz] = at(0, 0.9);
    this.lamps.push(lx, g + 1.8, lz);
    this.counts.lit++;
    this.counts.chapels++;
  }

  /** Whether the miners' things may stand at (x, z): it is the excavation's, not another style's or an edge between (E5). */
  private mine(x: number, z: number): boolean {
    return owns(this.level.field.excavation, x, z);
  }

  /** Whether (x, z) is in grandma's camp, by a page of her diary or by one of her salt circles (nothing else lies there). */
  private byCamp(x: number, z: number): boolean {
    const c = this.level.camp, within = (px: number, pz: number, r: number) => Math.hypot(x - px, z - pz) < r;
    const p = this.level.page;
    return (!!c && within(c.x, c.z, 6)) || (!!p && within(p.x, p.z, 1.5)) || (this.level.lair?.circles ?? []).some((s) => within(s.x, s.z, s.r + 2));
  }

  /**
   * One of grandma's circles of infused salt (src/gen/lair.ts): a ring of pale crystals glowing
   * faintly blue on a crust of white salt, poured in a careful line sixty years ago.
   */
  private saltCircle(c: SaltCircle): void {
    const n = Math.round((c.r * Math.PI * 2) / 0.22);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, h = hashToFloat(hash3i(this.seed, c.x | 0, c.z | 0, k));
      const x = c.x + Math.cos(a) * c.r, z = c.z + Math.sin(a) * c.r, g = this.level.groundAt(x, z);
      this.solid.upright(x, g + 0.015, z, -a, 0.16, 0.03, 0.09, SALT_CRUST);
      if (h < 0.7) this.glow.upright(x + (h - 0.35) * 0.1, g + 0.05 + h * 0.05, z, a + h * 3, 0.025 + h * 0.02, 0.05 + h * 0.07, 0.025, SALT_GLOW);
    }
  }

  /**
   * Grandma's first camp (src/gen/grandmasCamp.ts): a canvas ridge tent, her bedroll showing in the
   * door, a ring of stones round a long-cold fire, a flat stone with her thermos and her note on it.
   */
  private grandmasCamp(c: GrandmasCamp): void {
    const { x, y: g, z, yaw } = c, at = local(x, z, yaw), ca = Math.cos(yaw), sa = Math.sin(yaw);
    // World vectors along the camp's side, forward and up.
    const side = (k: number): [number, number, number] => [ca * k, 0, -sa * k], fwd = (k: number): [number, number, number] => [sa * k, 0, ca * k];
    // The tent: two canvas slopes from the ridge (1.3 m up) to the floor 0.9 m out, 2.2 m long, behind the door.
    for (const s of [-1, 1]) {
      const [px, pz] = at(s * 0.45, -1.1), n = Math.hypot(0.45, 0.65);
      this.solid.box(px, g + 0.65, pz, fwd(1.1), [ca * s * 0.45, -0.65, -sa * s * 0.45], [ca * s * 0.65 / n * 0.015, 0.45 / n * 0.015, -sa * s * 0.65 / n * 0.015], CANVAS);
    }
    const [bx, bz] = at(0, -2.2);
    this.solid.box(bx, g + 0.62, bz, side(0.85), [0, 0.62, 0], fwd(0.015), [CANVAS[0] * 0.8, CANVAS[1] * 0.8, CANVAS[2] * 0.8]); // the back
    for (const fw of [0.02, -2.22]) { const [qx, qz] = at(0, fw); this.solid.upright(qx, g + 0.68, qz, yaw, 0.02, 0.68, 0.02, WOOD); } // poles
    const [rx, rz] = at(0, -1.1);
    this.solid.upright(rx, g + 0.06, rz, yaw, 0.32, 0.06, 0.95, BEDROLL);
    const [tx, tz] = at(0, -1.1);
    this.block(tx, tz, yaw, 0.95, 1.15, g - 0.3, g + 1.35);
    // The fire: a ring of stones, ash and the ends of burnt sticks.
    const [fx, fz] = at(0, 2.2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.stones.ellipsoid(fx + Math.sin(a) * 0.38, g + 0.05, fz + Math.cos(a) * 0.38, 0.1, 0.07, 0.09, this.tone(0.8), 6);
    }
    this.solid.ellipsoid(fx, g + 0.01, fz, 0.3, 0.02, 0.3, ASH, 8);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4;
      this.solid.beam(fx + Math.sin(a) * 0.25, g + 0.03, fz + Math.cos(a) * 0.25, fx - Math.sin(a) * 0.05, g + 0.06, fz - Math.cos(a) * 0.05, 0.03, 0.03, CHAR);
    }
    // The flat stone, her thermos and the note.
    const [sx, sz] = at(1.2, 2);
    this.stones.ellipsoid(sx, g + 0.1, sz, 0.38, 0.13, 0.3, this.tone(1), 8);
    this.block(sx, sz, yaw, 0.35, 0.3, g - 0.3, g + 0.22);
    const [hx, hz] = at(1.38, 2.08);
    this.solid.cylinder(hx, g + 0.4, hz, 0.045, 0.16, THERMOS, 10);
    this.solid.cylinder(hx, g + 0.59, hz, 0.05, 0.035, IRON, 10);
    const [nx, , nz] = c.note;
    this.solid.box(nx, c.note[1], nz, side(0.1), [0, 0.003, 0], fwd(0.075), PAPER);
  }

  /** A page torn out of grandma's diary (src/gen/diaryPages.ts): folded under a fist-sized stone, a corner of it showing. */
  private pageUnderStone(p: PageSpot): void {
    const at = local(p.x, p.z, p.yaw), ca = Math.cos(p.yaw), sa = Math.sin(p.yaw), g = p.y;
    const [px, pz] = at(0.05, 0.08);
    this.solid.box(px, g + 0.012, pz, [ca * 0.075, 0, -sa * 0.075], [0, 0.003, 0], [sa * 0.1, 0, ca * 0.1], PAPER);
    this.stones.ellipsoid(p.x, g + 0.06, p.z, 0.12, 0.07, 0.1, this.tone(0.9), 7);
    // Our letters on the rock beside it: chalk, cut deep, or scratched.
    const f = p.face;
    if (!f) return;
    for (const m of p.page.marks ?? []) {
      const M = MARK[m.hand], l = latin(m.text), place = alongPath(l, markLine(this.level, f, g + m.high)!, f.nx, f.nz, M.scale);
      inscribeLettering(this.solid, place, l, M.pen * place.scale, M.depth, M.colour);
    }
  }

  /**
   * A ruin against a cavern's rock at (x, z), (ox, oz) pointing away from it, older than any mine
   * and made for something taller than people: the front of a crypt (steps, two columns, a lintel
   * under a heavy gable, a doorway of darkness), or a stair of steps too tall to climb, leading up
   * into the rock.
   */
  private ruin(x: number, z: number, ox: number, oz: number, g: number, r: (k: number) => number): void {
    const yaw = Math.atan2(ox, oz), at = local(x, z, yaw), L = this.level;
    for (const [sd, out] of [[-2.4, 1.4], [2.4, 1.4], [0, 2.5], [-2, 4.5], [2, 4.5], [0, 6]]) {
      const [cx, cz] = at(sd, out);
      if (!L.dry(cx, cz, 0.1) || Math.abs(L.groundAt(cx, cz) - g) > 0.9 || L.sdf(cx, g + 1.5, cz) < 0.6) return;
    }
    const [hx, hz] = at(0, 1.2);
    if (L.sdf(hx, g + 6.5, hz) < 0.5) return;
    const old = (k: number): Rgb => { const c = this.tone(k); return [c[0] * 0.92, c[1] * 0.97, c[2] * 0.9]; };
    if (r(60) < 0.55) {
      // The crypt: two broad steps, columns, the lintel and gable, and the doorway, black. It stands
      // a little out from the rock, so the rock's bulges do not swallow the doorway.
      const at = local(x + ox * 0.7, z + oz * 0.7, yaw);
      const base = g + 0.6, high = 5.2;
      // (The steps reach a metre down: the floor in front of a cavern wall is never quite level.)
      for (const [out, top, hw, hd] of [[1.5, g + 0.3, 2.8, 0.55], [1.0, g + 0.6, 2.5, 0.45]] as const) {
        const [sx, sz] = at(0, out);
        this.stones.upright(sx, (g - 1 + top) / 2, sz, yaw, hw, (top - g + 1) / 2, hd, old(0.9));
      }
      const [px, pz] = at(0, 1.2);
      this.block(px, pz, yaw, 2.8, 0.9, g - 0.3, g + 0.6);
      for (const sd of [-1.9, 1.9]) {
        const [cx, cz] = at(sd, 0.85);
        this.stones.cylinder(cx, base + high / 2, cz, 0.36, high / 2, old(1), 12, 0.04);
        this.stones.upright(cx, base + high + 0.15, cz, yaw, 0.48, 0.15, 0.48, old(1.05)); // capital
        this.stones.upright(cx, base + 0.12, cz, yaw, 0.46, 0.12, 0.46, old(1.05)); // foot
        this.block(cx, cz, yaw, 0.45, 0.45, g, base + high);
      }
      const [lx, lz] = at(0, 0.75), top = base + high + 0.3;
      this.stones.upright(lx, top + 0.3, lz, yaw, 2.6, 0.3, 0.55, old(0.95));
      // Cut into the lintel's face, in Kerf runes: the dwarves' warning (src/lore/fragments.ts).
      this.lintel(x + ox * (0.7 + 1.3), top + 0.3, z + oz * (0.7 + 1.3), ox, oz, 2.4, THRESHOLD_LINTELS[Math.floor(r(62) * THRESHOLD_LINTELS.length)]);
      const [ax, az] = at(-2.7, 0.7), [bx, bz] = at(2.7, 0.7), [mx, mz] = at(0, 0.7);
      this.stones.beam(ax, top + 0.75, az, mx, top + 2.1, mz, 0.4, 0.3, old(0.9));
      this.stones.beam(bx, top + 0.75, bz, mx, top + 2.1, mz, 0.4, 0.3, old(0.9));
      const [dx, dz] = at(0, 0.1);
      this.solid.upright(dx, base + 1.9, dz, yaw, 1.05, 1.9, 0.3, VOID);
      const [wx, wz] = at(0, -0.5);
      this.stones.upright(wx, base + high / 2 + 0.5, wz, yaw, 2.4, high / 2 + 1.5, 0.6, old(0.8)); // the front's back wall, into the rock
      for (const sd of [-1.15, 1.15]) { const [fx, fz] = at(sd, 0.18); this.stones.upright(fx, base + 1.95, fz, yaw, 0.12, 1.95, 0.14, old(1.1)); }
    } else {
      // The stair: steps three times a person's, rising into the rock to nothing that is left.
      const n = 6, rise = 0.75, tread = 0.9;
      for (let k = 0; k < n; k++) {
        const out = (n - k - 0.5) * tread, top = g + rise * (k + 1);
        const [sx, sz] = at(0, out);
        this.stones.upright(sx, (g - 1 + top) / 2, sz, yaw, 2.2, (top - g + 1) / 2, tread / 2 + 0.02, old(0.85 + 0.2 * r(61 + k)));
        this.block(sx, sz, yaw, 2.2, tread / 2, g - 0.3, top);
      }
    }
    this.counts.ruins++;
  }

  /** A line of Kerf runes cut across a face whose middle is (x, y, z), looking out along (ox, oz), at most `half` metres either side. */
  private lintel(x: number, y: number, z: number, ox: number, oz: number, half: number, text: string): void {
    const ins = acrossFace(`lintel:${this.level.depth}:${Math.round(x)}:${Math.round(z)}`, 'kerf', text, LINTEL.where, x, y, z, ox, oz, half, LINTEL.scale);
    this.write(ins, LINTEL.cut * ins.place.scale, 0.015, CUT);
  }

  /** Lay `ins` on the tile's props and list it for the game to read. */
  private write(ins: Inscription, width: number, depth: number, colour: Rgb): void {
    inscribe(this.solid, ins, width, depth, colour);
    this.inscriptions.push(ins);
  }

  /** An old electric lamp hanging on its chain from the roof over (x, z), its bulb `HANG.low`–`HANG.high` above the floor; most still burn. */
  private hangingLamp(x: number, z: number, g: number, r: (k: number) => number): void {
    const y = g + HANG.low + (HANG.high - HANG.low) * r(44);
    if (this.level.sdf(x, y, z) < 0.8) return;
    // Up the chain to the roof.
    let roof = -1;
    for (let t = y + 0.4; t < y + HANG.chain;) {
      const d = this.level.sdf(x, t, z);
      if (d < 0.05) { roof = t; break; }
      t += Math.max(0.1, d * 0.9);
    }
    if (roof < 0) return;
    this.solid.upright(x, (roof + y + 0.36) / 2, z, 0, 0.012, (roof - y - 0.36) / 2 + 0.05, 0.012, IRON);
    this.solid.cylinder(x, y + 0.3, z, 0.05, 0.06, ENAMEL, 8);
    this.solid.cylinder(x, y + 0.17, z, 0.12, 0.08, ENAMEL, 14, 0, -1.5); // wide at the rim
    const lit = r(45) < 0.7;
    (lit ? this.glow : this.solid).ellipsoid(x, y + 0.04, z, 0.07, 0.09, 0.07, lit ? BULB : GLASS, 8);
    this.counts.lamps++;
    this.counts.hanging++;
    if (!lit) return;
    this.counts.lit++;
    this.lamps.push(x, y - 0.2, z);
  }

  /**
   * A wooden derrick for lifting blocks at (x, z): a mast on crossed sills, a boom leaning out along
   * `yaw` with its stay, the rope and hook hanging from the tip, sometimes a block left under it.
   */
  private derrick(x: number, z: number, yaw: number, r: (k: number) => number): void {
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const g = this.level.groundAt(x, z);
    const H = DERRICK.mast, reach = DERRICK.reach;
    const tx = x + sa * reach, tz = z + ca * reach, ty = g + H - 0.6;
    // Room for it all: the mast, the boom and under the tip.
    for (let k = 0; k <= 4; k++) {
      const f = k / 4;
      if (this.level.sdf(x, g + 1 + (H - 1) * f, z) < 0.5 || this.level.sdf(x + (tx - x) * f, g + 1.5 + (ty - g - 1.5) * f, z + (tz - z) * f) < 0.5) return;
    }
    if (!this.level.dry(tx, tz, 0.1) || this.level.descents.at(tx, tz, 3)) return;
    const wood: Rgb = [WOOD[0] * 1.05, WOOD[1] * 0.95, WOOD[2] * 0.8];
    for (const a of [yaw, yaw + Math.PI / 2]) this.solid.upright(x, g + 0.12, z, a, 0.12, 0.12, 1.4, wood);
    this.solid.upright(x, g + H / 2, z, yaw, 0.13, H / 2, 0.13, wood);
    this.block(x, z, yaw, 0.16, 0.16, g - 0.3, g + H);
    this.solid.beam(x + sa * 0.15, g + 1.5, z + ca * 0.15, tx, ty, tz, 0.1, 0.1, wood);
    this.solid.beam(x, g + H, z, tx, ty + 0.1, tz, 0.012, 0.012, RUST); // the stay
    const hook = g + 1.2 + r(30) * 1.5;
    this.solid.upright(tx, (ty + hook) / 2, tz, 0, 0.012, (ty - hook) / 2, 0.012, RUST);
    this.solid.upright(tx, hook - 0.08, tz, yaw, 0.05, 0.08, 0.03, IRON);
    if (r(31) < 0.5) {
      const by = this.level.groundAt(tx, tz);
      this.stones.upright(tx + 0.1, by + 0.3, tz - 0.1, yaw + r(32), 0.55, 0.3, 0.45, this.tone(1.05));
    }
    this.counts.derricks++;
  }

  /**
   * A site shed (src/gen/sheds.ts says where): the shack, its walls in the way but the doorway open
   * (the game hangs the door), and inside what the miners left: the stove under its pipe, a bunk
   * under the window, a table and stool, a shelf with tins, the calendar. A burning lamp hangs over
   * the table in a lit one. Crates stand against its side.
   */
  private shed(sh: Shed): void {
    const { x, y: g, z, yaw, tint, lit, working: w, iu, iv } = sh, spot = (sd: number, fw: number) => shedPoint(sh, sd, fw);
    this.solid.stamp(propModel('prop_shack_open'), x, g, z, yaw, { tint: [tint, tint, tint] });
    const [hx, hz] = SHED.half, y0 = g - 0.5, y1 = g + 2.7;
    const wall = (s0: number, f0: number, s1: number, f1: number) => {
      const [ax, az] = spot(s0, f0), [bx, bz] = spot(s1, f1);
      this.blockLine(ax, az, bx, bz, SHED.wall, y0, y1);
    };
    wall(-hx, -hz, hx, -hz); wall(-hx, -hz, -hx, hz); wall(hx, -hz, hx, hz);
    wall(-hx, hz, SHED.door[0], hz); wall(SHED.door[1], hz, hx, hz);
    // A thing inside: a box (side, fwd) of half sizes (hs, hf), from `bottom` to `top` over the floor.
    const fit = (sd: number, fw: number, hs: number, hf: number, bottom: number, top: number, c: Rgb, into = this.solid) => {
      const [bx, bz] = spot(sd, fw);
      into.upright(bx, g + (bottom + top) / 2, bz, yaw, hs, (top - bottom) / 2, hf, c);
    };
    const thing = (t: { readonly at: readonly [number, number]; readonly half: readonly [number, number]; readonly top: number }) => {
      const [bx, bz] = spot(t.at[0], t.at[1]);
      this.block(bx, bz, yaw, t.half[0], t.half[1], g - 0.2, g + t.top);
    };
    const legs = (t: { readonly at: readonly [number, number]; readonly half: readonly [number, number] }, top: number, c: Rgb) => {
      for (const ls of [-1, 1]) for (const lf of [-1, 1]) fit(t.at[0] + ls * (t.half[0] - 0.05), t.at[1] + lf * (t.half[1] - 0.05), 0.03, 0.03, 0, top, c);
    };
    // The stove: a black iron box on short legs, its pipe up into the roof's, its fire door to the room.
    const st = SHED.stove, [ss, sf] = st.at;
    fit(ss, sf, st.half[0], st.half[1], 0.12, st.top, IRON);
    fit(ss, sf, st.half[0] + 0.03, st.half[1] + 0.03, st.top - 0.03, st.top, [IRON[0] * 1.6, IRON[1] * 1.6, IRON[2] * 1.6]);
    legs(st, 0.12, IRON);
    fit(ss + st.half[0] + 0.005, sf, 0.01, 0.12, 0.2, 0.42, lit ? [FLAME[0] * 0.5, FLAME[1] * 0.3, FLAME[2] * 0.15] : RUST, lit ? this.glow : this.solid);
    const [px, pz] = spot(ss, sf);
    this.solid.tube(px, g + st.top, pz, px, g + SHED.height - 0.25, pz, 0.07, IRON, 8);
    thing(st);
    // The bunk: a plank frame, a canvas mattress, an army blanket folded at its foot.
    const bk = SHED.bunk, [bs, bf] = bk.at;
    fit(bs, bf, bk.half[0], bk.half[1], bk.top - 0.12, bk.top - 0.06, WOOD);
    legs(bk, bk.top - 0.06, WOOD);
    fit(bs, bf, bk.half[0] - 0.03, bk.half[1] - 0.03, bk.top - 0.06, bk.top, CANVAS);
    fit(bs, bf + bk.half[1] - 0.25, bk.half[0] - 0.02, 0.18, bk.top, bk.top + 0.08, ARMY);
    thing(bk);
    // The table and its stool, two tin cups; the shelf over it with tins; the calendar on the wall.
    const tb = SHED.table, [ts, tf] = tb.at;
    fit(ts, tf, tb.half[0], tb.half[1], tb.top - 0.04, tb.top, WOOD);
    legs(tb, tb.top - 0.04, WOOD);
    thing(tb);
    fit(ts, tf + 0.62, 0.17, 0.17, 0.42, 0.46, WOOD);
    for (const ls of [-1, 1]) for (const lf of [-1, 1]) fit(ts + ls * 0.12, tf + 0.62 + lf * 0.12, 0.02, 0.02, 0, 0.42, WOOD);
    for (const [cs, cf] of [[ts + 0.38, tf + 0.12], [ts + 0.22, tf + 0.18]]) {
      const [cx, cz] = spot(cs, cf);
      this.solid.cylinder(cx, g + tb.top + 0.05, cz, 0.04, 0.05, [0.32, 0.31, 0.28], 8);
    }
    const sl = SHED.shelf, [ls_, lf_] = sl.at;
    fit(ls_, lf_, sl.half[0], sl.half[1], sl.top - 0.03, sl.top, WOOD);
    for (const k of [-1, 1]) fit(ls_ + k * (sl.half[0] - 0.08), lf_, 0.02, sl.half[1], sl.top - 0.22, sl.top - 0.03, WOOD);
    for (let k = 0; k < 3; k++) {
      if (this.roll(w, 63 + k, iu, iv) < 0.35) continue;
      const [cx, cz] = spot(ls_ + 0.12 + k * 0.14, lf_ + 0.01);
      this.solid.cylinder(cx, g + sl.top + 0.06, cz, 0.04, 0.06, [0.25 + 0.1 * k, 0.18, 0.1], 8);
    }
    const [kx, kz] = spot(0.95, -hz + 0.1);
    this.solid.upright(kx, g + 1.45, kz, yaw, 0.16, 0.22, 0.004, [0.62, 0.6, 0.52]);
    this.solid.upright(kx, g + 1.62, kz, yaw, 0.16, 0.05, 0.006, [0.4, 0.06, 0.04]);
    // The windows: lit from inside, or dark glass.
    const [wx, wz] = spot(2.21, 0);
    (lit ? this.glow : this.solid).upright(wx, g + 1.55, wz, yaw, 0.02, 0.28, 0.4, lit ? [FLAME[0] * 0.7, FLAME[1] * 0.6, FLAME[2] * 0.5] : GLASS);
    const [lx, lz] = spot(-0.6, 1.75);
    this.lamp(lx, g + 2.25, lz, lit);
    if (lit) {
      const [ix, iz] = spot(ts, tf + 0.1);
      this.solid.tube(ix, g + SHED.height, iz, ix, g + 2.1, iz, 0.006, IRON, 4);
      this.lamp(ix, g + 2.05, iz, true);
    }
    for (let c = 0; c < 3; c++) {
      if (this.roll(w, 54 + c, iu, iv) < 0.4) continue;
      const size = 0.28 + 0.2 * this.roll(w, 57 + c, iu, iv), crate = propModel('prop_crate'), scale = size / crate.max[0];
      const [cx, cz] = spot(-2.2 - 0.4 - size - c * 0.1, -1.2 + c * 1.1);
      if (this.level.sdf(cx, this.level.groundAt(cx, cz) + 0.5, cz) < 0.6 || !this.level.dry(cx, cz, 0.05)) continue;
      const cy = this.level.groundAt(cx, cz), cyaw = yaw + this.roll(w, 60 + c, iu, iv);
      this.solid.stamp(crate, cx, cy, cz, cyaw, { scale });
      this.block(cx, cz, cyaw, size, size, cy - 0.3, cy + crate.max[1] * scale);
    }
    this.counts.shacks++;
  }
}

/** How many ways a carved miner stands (`carveMiner`), and the share of the statues that are watchers. */
export const MINER_POSES = 3;
const WATCHERS = 0.3;

/**
 * A miner carved in salt, into `b`: standing at (px, top, pz) (the top of its plinth) facing along
 * (sin yaw, cos yaw); pose 0 leans on his pick, 1 prays, 2 holds a lamp up into the dark.
 */
export function carveMiner(b: PropBuilder, px: number, top: number, pz: number, yaw: number, pose: number, salt: Rgb): void {
  // (side, out, up) on the figure to world: out is where it faces, up from the top of the plinth.
  const at = local(px, pz, yaw);
  const limb = (p: readonly [number, number, number], q: readonly [number, number, number], half: number) => {
    const [ax, az] = at(p[0], p[1]), [bx, bz] = at(q[0], q[1]);
    b.beam(ax, top + p[2], az, bx, top + q[2], bz, half, half, salt);
  };
  for (const sd of [-0.11, 0.11]) {
    const [lx, lz] = at(sd, 0), [fx, fz] = at(sd, 0.05);
    b.cylinder(lx, top + 0.45, lz, 0.085, 0.43, salt, 8, 0, 0.25);
    b.upright(fx, top + 0.06, fz, yaw, 0.07, 0.06, 0.13, salt);
  }
  b.cylinder(px, top + 1.17, pz, 0.2, 0.32, salt, 10, 0.1, 0.15);
  b.ellipsoid(px, top + 1.62, pz, 0.11, 0.13, 0.11, salt, 10);
  b.cylinder(px, top + 1.72, pz, 0.125, 0.05, salt, 10);
  b.cylinder(px, top + 1.68, pz, 0.17, 0.012, salt, 12);
  if (pose === 0) {
    // Leaning on his pick: the handle from the right hand to the plinth, the head across it.
    limb([-0.25, 0, 1.42], [-0.29, 0.04, 0.86], 0.05);
    limb([0.25, 0, 1.42], [0.3, 0.12, 1.12], 0.05);
    limb([0.3, 0.12, 1.12], [0.24, 0.24, 0.98], 0.045);
    limb([0.24, 0.26, 1.0], [0.3, 0.32, 0.05], 0.025);
    limb([0.06, 0.32, 0.05], [0.54, 0.32, 0.08], 0.03);
  } else if (pose === 1) {
    // Praying: the hands together in front of the chest.
    for (const sd of [-1, 1]) {
      limb([0.25 * sd, 0, 1.42], [0.2 * sd, 0.14, 1.12], 0.05);
      limb([0.2 * sd, 0.14, 1.12], [0.03 * sd, 0.24, 1.3], 0.045);
    }
  } else {
    // Holding a lamp up into the dark.
    limb([-0.25, 0, 1.42], [-0.29, 0.04, 0.86], 0.05);
    limb([0.25, 0, 1.42], [0.32, 0.1, 1.72], 0.05);
    limb([0.32, 0.1, 1.72], [0.3, 0.2, 2.02], 0.045);
    const [lx, lz] = at(0.3, 0.2);
    b.cylinder(lx, top + 2.14, lz, 0.07, 0.1, salt, 8, 0.2);
  }
}

/** What was left against the rock, and the derricks: the cell size scanned (m) and the chance per cell. */
const LEFT = { cell: 6, chance: 0.22, derricks: 0.006 };
/** A doorway into darkness. */
const VOID: Rgb = [0.008, 0.008, 0.01];
/** The dark of a chisel cut in old stone. */
const CUT: Rgb = [0.035, 0.03, 0.027];
/** How each hand of mark is laid (src/lore/diary.ts): metres to a unit, stroke width as a share of a unit, how proud, colour. */
const MARK: Readonly<Record<Mark['hand'], { scale: number; pen: number; depth: number; colour: Rgb }>> = {
  chalk: { scale: 0.065, pen: 0.14, depth: 0.004, colour: [0.84, 0.84, 0.8] },
  cut: { scale: 0.09, pen: 0.2, depth: 0.006, colour: [0.05, 0.04, 0.035] },
  scratch: { scale: 0.06, pen: 0.08, depth: 0.004, colour: [0.66, 0.64, 0.6] },
};
/** Runes on a lintel: at most this many metres to a unit (a rune is two units tall), cut this share of a unit wide; what one sees on reading them. */
const LINTEL = { scale: 0.2, cut: 0.16, where: 'Cut across the lintel, worn almost smooth: straight strokes on upright staves, none of them level. Runes.' };
/** Grandma's camp (her tent is CANVAS): the bedroll, ash and charred sticks, her thermos, the note. */
/** Grandma's salt circles: the white crust and the crystals' glow. */
const SALT_CRUST: Rgb = [0.62, 0.64, 0.66], SALT_GLOW: Rgb = [0.45, 0.7, 1.0];
const BEDROLL: Rgb = [0.25, 0.1, 0.08], ASH: Rgb = [0.13, 0.125, 0.12], CHAR: Rgb = [0.04, 0.035, 0.03], THERMOS: Rgb = [0.12, 0.28, 0.18], PAPER: Rgb = [0.78, 0.75, 0.66];
/** A hanging lamp's bulb height over the floor (low, high) and the longest chain it hangs on, m. */
const HANG = { low: 3.6, high: 5, chain: 30 };
/** A derrick's mast height and how far its boom reaches out, m. */
const DERRICK = { mast: 7, reach: 3.6 };

/** f, remembering its answer for each integer it was asked about. */
function memo<T>(f: (i: number) => T): (i: number) => T {
  const seen = new Map<number, T>();
  return (i) => {
    if (!seen.has(i)) seen.set(i, f(i));
    return seen.get(i) as T;
  };
}
