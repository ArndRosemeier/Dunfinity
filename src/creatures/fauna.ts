/**
 * Everything that lives on a level, together: the rats, the Salt-Touched, the cave crickets, the
 * two slime factions, the feral dogs, the brine eels, the scavengers, on level 5 the Foreman and his crew, and on level 10 the Tall One. Made in one go for a level (or a
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
import { Dogs, type Dog } from './dogs';
import { Eels, type Eel } from './eels';
import { Scavengers, type Scavenger } from './scavengers';
import { TALL, TallOnes, type TallOne } from './tallOne';

export type Foe = Rat | Touched | Cricket | Slime | Boss | Dog | Eel | Scavenger | TallOne;

/** Something after you this close counts (the knife comes out). */
const THREAT = 14;

export class Fauna {
  readonly rats: Rats;
  readonly touched: SaltTouched;
  readonly crickets: Crickets;
  readonly lumen: Slimes;
  readonly murk: Slimes;
  readonly foreman: Foreman;
  readonly dogs: Dogs;
  readonly eels: Eels;
  readonly scavengers: Scavengers;
  readonly tall: TallOnes;

  constructor(level: Level) {
    this.rats = new Rats(level);
    this.touched = new SaltTouched(level);
    this.crickets = new Crickets(level);
    this.lumen = new Slimes(level, 'lumen');
    this.murk = new Slimes(level, 'murk');
    this.foreman = new Foreman(level);
    this.dogs = new Dogs(level);
    this.eels = new Eels(level);
    this.scavengers = new Scavengers(level);
    this.tall = new TallOnes(level);
    const hall = this.foreman.hall;
    if (hall) this.touched.gather(hall.x, hall.z, FOREMAN.crew, 5);
  }

  /** The props in the way: they all walk round them. */
  set blockers(b: Blockers | null) {
    this.rats.blockers = this.touched.blockers = this.crickets.blockers = this.lumen.blockers = this.murk.blockers = this.foreman.blockers = this.dogs.blockers = this.scavengers.blockers = this.tall.blockers = b;
  }

  /** Step them all by dt; `lamp`: your headlamp (the crickets shun it); `facing`: which way you face (the dogs go for your back). Returns whether a heavy blow (a pick, a crowbar) landed on you. */
  advance(dt: number, prey: Fighter, lamp: Lamp, facing: number): boolean {
    this.rats.advance(dt, prey);
    const struck = this.touched.advance(dt, prey) + this.foreman.advance(dt, prey, this.touched) + this.scavengers.advance(dt, prey) + this.tall.advance(dt, prey) > 0;
    this.crickets.advance(dt, prey, lamp);
    this.lumen.advance(dt, prey, this.murk.list);
    this.murk.advance(dt, prey, this.lumen.list);
    this.dogs.advance(dt, prey, facing);
    this.eels.advance(dt, prey);
    return struck;
  }

  /** Everyone a blow can hit (the dead included). */
  foes(): Foe[] {
    return [...this.rats.list, ...this.touched.list, ...this.crickets.list, ...this.lumen.list, ...this.murk.list, ...this.foreman.list, ...this.dogs.list, ...this.eels.list, ...this.scavengers.list, ...this.tall.list];
  }

  /** The ones you killed since the last call, by kind (a population's name) and where they fell. */
  fallen(): { kind: string; x: number; y: number; z: number }[] {
    const out: { kind: string; x: number; y: number; z: number }[] = [];
    for (const p of [this.rats, this.touched, this.crickets, this.lumen, this.murk, this.foreman, this.dogs, this.eels, this.scavengers, this.tall]) {
      for (const f of p.fallen.splice(0)) out.push({ kind: p.name, ...f });
    }
    return out;
  }

  /** Whether something near is after `prey`. */
  after(prey: Fighter): boolean {
    const near = (c: Foe) => !c.dead && Math.hypot(c.x - prey.x, c.z - prey.z) < THREAT;
    return this.rats.list.some((r) => (r.mode === 'chase' || r.mode === 'bite') && near(r))
      || [...this.touched.list, ...this.foreman.list].some((t) => t.angry && near(t))
      || this.crickets.list.some((c) => c.angry && near(c))
      || this.dogs.list.some((g) => g.hunting && near(g))
      || this.eels.list.some((e) => e.mode !== 'cruise' && near(e))
      || this.scavengers.list.some((s) => (s.hostile || s.mode === 'stand') && near(s))
      || this.tall.list.some((t) => t.hunting && !t.dead && Math.hypot(t.x - prey.x, t.z - prey.z) < TALL.notice)
      || [...this.lumen.list, ...this.murk.list].some((s) => s.foe === prey && near(s));
  }

  /** The HUD's tally of the killed. */
  tally(): string[] {
    const lines: string[] = [], slimes = this.lumen.killed + this.murk.killed;
    if (this.rats.killed) lines.push(`rats killed: ${this.rats.killed}`);
    if (slimes) lines.push(`slimes killed: ${slimes}`);
    if (this.crickets.killed) lines.push(`cave crickets killed: ${this.crickets.killed}`);
    if (this.dogs.killed) lines.push(`feral dogs killed: ${this.dogs.killed}`);
    if (this.eels.killed) lines.push(`brine eels killed: ${this.eels.killed}`);
    if (this.scavengers.killed) lines.push(`scavengers killed: ${this.scavengers.killed}`);
    if (this.touched.killed) lines.push(`Salt-Touched laid to rest: ${this.touched.killed}`);
    if (this.foreman.killed) lines.push('The Foreman is dead.');
    if (this.tall.killed) lines.push('The Tall One is dead.');
    return lines;
  }

  /** A boss's health bar (the Foreman's, the Tall One's) while it is after `prey`, else ''. */
  bossLine(prey: Fighter): string {
    const f = this.foreman.list[0], t = this.tall.list[0];
    const bar = (name: string, health: number, of: number) => {
      const n = Math.round((health / of) * 30);
      return `${name}  ${'█'.repeat(n)}${'░'.repeat(30 - n)}`;
    };
    if (f && !f.dead && f.angry && Math.hypot(f.x - prey.x, f.z - prey.z) <= FOREMAN.forget) return bar('THE FOREMAN', f.health, FOREMAN.health);
    if (t && !t.dead && t.hunting) return bar('THE TALL ONE', t.health, TALL.health);
    return '';
  }
}
