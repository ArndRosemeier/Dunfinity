/**
 * Everything that lives on a level, together: the rats, the Salt-Touched, the cave crickets, the
 * two slime factions and, on level 5, the Foreman and his crew. Made in one go for a level (or a
 * new grandchild), stepped in one go, and asked in one place whom a blow can hit and whether
 * something is after you.
 *
 * Pure, like the kinds it holds.
 */
import type { Level } from '../gen/level';
import type { Fighter } from '../combat/combat';
import type { Blockers } from '../world/blockers';
import { Rats, type Rat } from './rats';
import { SaltTouched, type Touched } from './touched';
import { Crickets, type Cricket, type Lamp } from './crickets';
import { Slimes, type Slime } from './slimes';
import { Foreman, FOREMAN, type Boss } from './foreman';

export type Foe = Rat | Touched | Cricket | Slime | Boss;

/** Something after you this close counts (the knife comes out). */
const THREAT = 14;

export class Fauna {
  readonly rats: Rats;
  readonly touched: SaltTouched;
  readonly crickets: Crickets;
  readonly lumen: Slimes;
  readonly murk: Slimes;
  readonly foreman: Foreman;

  constructor(level: Level) {
    this.rats = new Rats(level);
    this.touched = new SaltTouched(level);
    this.crickets = new Crickets(level);
    this.lumen = new Slimes(level, 'lumen');
    this.murk = new Slimes(level, 'murk');
    this.foreman = new Foreman(level);
    const hall = this.foreman.hall;
    if (hall) this.touched.gather(hall.x, hall.z, FOREMAN.crew, 5);
  }

  /** The props in the way: they all walk round them. */
  set blockers(b: Blockers | null) {
    this.rats.blockers = this.touched.blockers = this.crickets.blockers = this.lumen.blockers = this.murk.blockers = this.foreman.blockers = b;
  }

  /** Step them all by dt; `lamp`: your headlamp (the crickets shun it). Returns whether a heavy blow (a pick) landed on you. */
  advance(dt: number, prey: Fighter, lamp: Lamp): boolean {
    this.rats.advance(dt, prey);
    const struck = this.touched.advance(dt, prey) + this.foreman.advance(dt, prey, this.touched) > 0;
    this.crickets.advance(dt, prey, lamp);
    this.lumen.advance(dt, prey, this.murk.list);
    this.murk.advance(dt, prey, this.lumen.list);
    return struck;
  }

  /** Everyone a blow can hit (the dead included). */
  foes(): Foe[] {
    return [...this.rats.list, ...this.touched.list, ...this.crickets.list, ...this.lumen.list, ...this.murk.list, ...this.foreman.list];
  }

  /** Whether something near is after `prey`. */
  after(prey: Fighter): boolean {
    const near = (c: Foe) => !c.dead && Math.hypot(c.x - prey.x, c.z - prey.z) < THREAT;
    return this.rats.list.some((r) => (r.mode === 'chase' || r.mode === 'bite') && near(r))
      || [...this.touched.list, ...this.foreman.list].some((t) => t.angry && near(t))
      || this.crickets.list.some((c) => c.angry && near(c))
      || [...this.lumen.list, ...this.murk.list].some((s) => s.foe === prey && near(s));
  }

  /** The HUD's tally of the killed. */
  tally(): string[] {
    const lines: string[] = [], slimes = this.lumen.killed + this.murk.killed;
    if (this.rats.killed) lines.push(`rats killed: ${this.rats.killed}`);
    if (slimes) lines.push(`slimes killed: ${slimes}`);
    if (this.crickets.killed) lines.push(`cave crickets killed: ${this.crickets.killed}`);
    if (this.touched.killed) lines.push(`Salt-Touched laid to rest: ${this.touched.killed}`);
    if (this.foreman.killed) lines.push('The Foreman is dead.');
    return lines;
  }

  /** The Foreman's health bar while he is after `prey`, else ''. */
  bossLine(prey: Fighter): string {
    const f = this.foreman.list[0];
    if (!f || f.dead || !f.angry || Math.hypot(f.x - prey.x, f.z - prey.z) > FOREMAN.forget) return '';
    const n = Math.round((f.health / FOREMAN.health) * 30);
    return `THE FOREMAN  ${'█'.repeat(n)}${'░'.repeat(30 - n)}`;
  }
}
