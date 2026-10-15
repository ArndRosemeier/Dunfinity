/**
 * Grandma's Salt Line (a lost card, src/loot/recipes.ts): the nobody kneels and pours a circle of
 * infused salt round itself. While it keeps, the animals will not cross it (src/creatures/steer.ts)
 * and neither will the Tall One (it never crosses her circles); the Salt-Touched and people will.
 * One at a time: pouring another sweeps up the last.
 *
 * Pure: a circle on the floor and the times it is poured and wears off; the level says where the
 * floor allows one.
 */
import type { Level } from '../gen/level';
import type { SaltCircle } from '../gen/lair';

export const SALT_LINE = {
  /** Kneeling and pouring, seconds: the circle works once it is closed. */
  pour: 2.2,
  /** Its last seconds, the crystals going dull one by one. */
  wane: 5,
  /** How far the floor round its rim may be off its centre, up or down, metres (a few spots may be). */
  level: 1,
} as const;

/** A poured circle: poured from `at`, working from `at + SALT_LINE.pour` for `keeps` seconds. */
export interface Poured extends SaltCircle {
  readonly at: number;
  readonly keeps: number;
}

export class SaltLine {
  circle: Poured | null = null;

  /** Why a circle of radius r cannot be poured round (x, z) on `level` (null: it can). */
  whyNot(level: Level, x: number, z: number, r: number, grounded: boolean): string | null {
    if (!grounded) return 'Not in mid-air.';
    const g = level.groundAt(x, z);
    let rough = 0;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (level.sdf(px, g + 1, pz) < 0) continue; // against the rock: the line runs along its foot
      if (!level.dry(px, pz, 0.05)) return 'Not in the wet. It would wash away.';
      if (Math.abs(level.groundAt(px, pz) - g) > SALT_LINE.level) rough++;
    }
    if (rough > 2) return 'The floor is too rough here for a line.';
    return null;
  }

  /** Pour a circle of radius r round (x, z), keeping `keeps` seconds once closed (check `whyNot` first). */
  pour(level: Level, x: number, z: number, r: number, keeps: number, now: number): void {
    this.circle = { x, y: level.groundAt(x, z), z, r, at: now, keeps };
  }

  /** Whether the nobody is still kneeling over it. */
  pouring(now: number): boolean {
    return !!this.circle && now - this.circle.at < SALT_LINE.pour;
  }

  /** The circles that keep them out now (none while it is poured, or once it has worn off). */
  keeping(now: number): readonly SaltCircle[] {
    const c = this.circle;
    if (!c) return [];
    const t = now - c.at - SALT_LINE.pour;
    if (t >= c.keeps) { this.circle = null; return []; }
    return t >= 0 ? [c] : [];
  }

  /**
   * How much of the line shows: the share poured so far (0 → 1 as the nobody goes round), and the
   * share of its crystals still bright (1 → 0 in its last seconds).
   */
  shown(now: number): { poured: number; bright: number } {
    const c = this.circle;
    if (!c) return { poured: 0, bright: 0 };
    const t = now - c.at;
    return { poured: Math.min(1, t / SALT_LINE.pour), bright: Math.max(0, Math.min(1, (SALT_LINE.pour + c.keeps - t) / SALT_LINE.wane)) };
  }
}
