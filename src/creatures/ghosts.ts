/**
 * The ghosts of the old races (docs/design/lore.md §3: "only their halls, vaults and writing, and
 * their ghosts"): a dwarf in the dwarven halls, an elf in the elven vaults, one to a haunt, each
 * walking its old beat back and forth with a pause at either end. Seen, a ghost stops and turns to
 * you; come close and it speaks, once, a line of its people's account (the diggers' and the
 * keepers' contradict each other, lore.md §3), then it fades and is gone for this visit.
 *
 * They are not foes: no blade touches them and they touch no one. Salt does not stop them.
 *
 * Pure: floor walking with src/creatures/steer.ts.
 */
import { angleDiff, hash3f } from '@futuremagic/core';
import type { Level } from '../gen/level';
import { owns } from '../gen/style';
import { noticed, type Fighter } from '../combat/combat';
import { Creature } from './creature';
import { Population, type Den } from './population';

export const GHOST = {
  radius: 0.3,
  height: 1.7,
  /** Walking its beat, m/s; the pause at each end (min, extra), s; the beat's length (min, extra), m. */
  walk: 0.6,
  pause: [3, 4] as const,
  beat: [6, 8] as const,
  /** It turns to you this close, and goes back to its beat beyond `lose`; it speaks this close. */
  notice: 11,
  lose: 15,
  speak: 4.5,
  /** Seconds it speaks (stands, turned to you), then seconds it takes to fade. */
  speaking: 4,
  fading: 3,
  /** Haunts: per cell, the chance of one, none this close to the arrival. */
  cell: 70,
  chance: 0.6,
  quiet: 30,
  wake: 60,
  sleep: 85,
} as const;

export type GhostRace = 'dwarf' | 'elf';
export type GhostMode = 'walk' | 'pause' | 'watch' | 'speak' | 'fade' | 'dead';

/** What the dead say: the diggers' account, and the keepers' (lore.md §3). */
export const GHOST_LINES: Record<GhostRace, readonly string[]> = {
  dwarf: [
    'Forty fathoms more to the fire. Keep digging.',
    'We took the heat from below. They are coming to take it back.',
    'Count the halls. Write the depth on the gate. Who comes after must know.',
    'The climbers are not lost. They know the way up. They know what we took.',
    'I went down for the first fire. I did not come up.',
    'The elves shut their doors on us. Let them sing to the dark.',
  ],
  elf: [
    'Shut the door behind you. Sing it shut.',
    'They are not coming for you. They are only going home.',
    'We kept the way closed. We were wrong to keep it closed.',
    'The diggers broke the floor of the world. Something climbs out of the hole.',
    'Say their names. The ones who went down. Say them.',
    'Your grandmother drew our ward in salt. She never knew what it says.',
  ],
};

export class Ghost extends Creature<GhostMode> {
  t = 0;
  /** The end of its beat it is walking to: 0 the haunt, 1 the far end. */
  to = 1;
  /** How much of it shows (the view's fade), 0..1. */
  shown = 1;

  constructor(readonly id: number, readonly haunt: Haunt) {
    super(haunt.x, haunt.y, haunt.z, haunt.yaw, GHOST.radius, GHOST.height, 1, 'walk');
  }

  get race(): GhostRace { return this.haunt.race; }
}

/** A haunt: one end of the beat (x, z) and the other (bx, bz), on one floor; whose ghost. */
export interface Haunt extends Den {
  readonly y: number;
  readonly bx: number;
  readonly bz: number;
  readonly yaw: number;
  readonly race: GhostRace;
  /** Its line. */
  readonly line: string;
}

export class Ghosts extends Population<Haunt, Ghost> {
  protected override heedsSalt = false;
  /** The last thing a ghost said and whose, and how many have spoken so far (the game shows each new one). */
  said = '';
  saidBy: GhostRace = 'dwarf';
  calls = 0;

  constructor(level: Level) {
    super(level, 'ghosts', GHOST, { arrive: 0.4, still: 0.05, step: 0.5, drop: 1, accel: 3, turn: 3, face: 4 });
  }

  protected denIn(key: number, i: number, j: number): Haunt | null {
    const f = this.level.field, G = GHOST;
    for (const [x, z] of this.sites(i, j, G.chance, 6)) {
      const st = f.styles[f.regions.styleAt(x, z)];
      if ((st.id !== 'dwarven' && st.id !== 'elven') || !owns(st, x, z)) continue;
      const y = this.floorFor(x, z, 2.4, 1);
      if (y === null) continue;
      // The far end of its beat: the first of a few seeded ways with the same floor and nothing in the way.
      for (let k = 0; k < 6; k++) {
        const a = hash3f(this.seed, key, k, 1) * Math.PI * 2, d = G.beat[0] + G.beat[1] * hash3f(this.seed, key, k, 2);
        const bx = x + Math.sin(a) * d, bz = z + Math.cos(a) * d, by = this.level.groundAt(bx, bz);
        if (Math.abs(by - y) > 0.4 || this.floorFor(bx, bz, 2.4, 1) === null) continue;
        if (this.level.trace(x, y + 1, z, Math.sin(a), 0, Math.cos(a), d) < d - 0.2) continue;
        const race: GhostRace = st.id === 'dwarven' ? 'dwarf' : 'elf', lines = GHOST_LINES[race];
        return { key, x, z, y, bx, bz, yaw: Math.atan2(-Math.sin(a), -Math.cos(a)), race, line: lines[Math.floor(hash3f(this.seed, key, 3, 3) * lines.length)] };
      }
    }
    return null;
  }

  protected hatch(h: Haunt, gone: (id: number) => boolean): Ghost[] {
    return gone(h.key) ? [] : [new Ghost(h.key, h)];
  }

  protected act(g: Ghost, prey: Fighter, _: null, dt: number): number {
    const G = GHOST, h = g.haunt;
    g.t += dt;
    g.provoked = false;
    if (g.dead) { g.shown = 0; return 0; }
    const dx = prey.x - g.x, dz = prey.z - g.z, d = Math.hypot(dx, dz), toYou = Math.atan2(-dx, -dz);
    const sees = !prey.dead && Math.abs(prey.y - g.y) < 3 && noticed(prey, d, G.notice);
    switch (g.mode) {
      case 'walk': {
        const tx = g.to ? h.bx : h.x, tz = g.to ? h.bz : h.z;
        this.steer.move(g, tx, tz, G.walk, dt, null);
        if (sees) { g.mode = 'watch'; g.t = 0; }
        else if (Math.hypot(tx - g.x, tz - g.z) < 0.3) { g.mode = 'pause'; g.t = 0; }
        break;
      }
      case 'pause': {
        this.steer.move(g, g.x, g.z, 0, dt, null);
        if (sees) { g.mode = 'watch'; g.t = 0; }
        else if (g.t > G.pause[0] + G.pause[1] * hash3f(this.seed, g.id, Math.floor(g.to), 9)) { g.to = 1 - g.to; g.mode = 'walk'; g.t = 0; }
        break;
      }
      case 'watch':
        this.steer.move(g, g.x, g.z, 0, dt, toYou);
        if (d < G.speak && Math.abs(angleDiff(g.yaw, toYou)) < 0.5) {
          g.mode = 'speak'; g.t = 0;
          this.said = h.line; this.saidBy = h.race; this.calls++;
        } else if (prey.dead || d > G.lose) { g.mode = 'walk'; g.t = 0; }
        break;
      case 'speak':
        this.steer.move(g, g.x, g.z, 0, dt, toYou);
        if (g.t > G.speaking) { g.mode = 'fade'; g.t = 0; }
        break;
      case 'fade':
        this.steer.move(g, g.x, g.z, 0, dt, null);
        g.shown = Math.max(0, 1 - g.t / G.fading);
        // Gone for this visit (dead to the Population, which keeps the dead dead; never a kill).
        if (g.shown === 0) g.hurt(1, 'faded');
        break;
    }
    return 0;
  }
}
