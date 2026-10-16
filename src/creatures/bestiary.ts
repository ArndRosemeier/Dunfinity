/**
 * The procedural creatures (docs/design/procedural-creatures.md): a level's own animals, each a body
 * plan grown from a seed, not a model. `speciesOf(seed, depth, slot)` draws one species' genome: its
 * body plan (four legs, two, six, eight, a crab's, a centipede's, a snake's, a slug's, a star's, a
 * drifting bell), its proportions, its head (snout, jaws, eyes, horns, feelers), its skin (fur, hide,
 * scales, chitin, slime, stone) and colours, how it moves, and its place in the cave's life: the
 * peaceful ones that are there to be watched (grazers, scuttlers, floaters, giants, watchers) and the
 * ones that hunt you.
 *
 * Every species is first a believable animal: legs scaled to the weight they carry (a heavy body
 * stands on pillars, a light one on threads), the gait its legs allow, speeds from its leg length,
 * pale or dark in the dark. Strangeness then buys it oddities (`ODDITIES`), a few at a time: more eyes,
 * eyes on stalks, an extra pair of legs, one huge claw, a glowing lure, see-through skin. The deeper
 * and stranger the level, the more it can afford; levels 1-10 already get a little.
 *
 * Pure: a function of (seed, depth, slot). A stratum's species are the same on all its levels.
 */
import { Rng, clamp, deriveSeed, hsl2rgb, lerp, mixRgb } from '@futuremagic/core';
import { strangeness, stratumOf } from '../gen/genome';

export type Rgb = [number, number, number];

/** What it is in the cave's life. The first five are peaceful (there to be watched, they flee or ignore you); the rest hunt you. */
export type CritterRole = 'scuttler' | 'grazer' | 'floater' | 'giant' | 'watcher' | 'hunter' | 'lurker' | 'swarmer' | 'brute';
export const PEACEFUL: readonly CritterRole[] = ['scuttler', 'grazer', 'floater', 'giant', 'watcher'];

export type BodyPlan = 'quadruped' | 'biped' | 'hexapod' | 'octopod' | 'crab' | 'myriapod' | 'serpent' | 'slug' | 'radial' | 'floater';
export type Integument = 'fur' | 'hide' | 'scales' | 'chitin' | 'slime' | 'stone';
export type PatternKind = 'none' | 'stripes' | 'spots' | 'bands' | 'patches' | 'mottled' | 'saddle' | 'eyespots';
export type Gait = 'walk' | 'trot' | 'gallop' | 'bound' | 'stride' | 'waddle' | 'tripod' | 'wave' | 'slither' | 'glide' | 'drift';
export type FootKind = 'paw' | 'hoof' | 'claw' | 'pad' | 'point';
export type TailTip = 'none' | 'club' | 'sting' | 'tuft' | 'spikes' | 'lure';

export interface HeadGenome {
  /** Cranium radius relative to torso length. */
  size: number;
  /** Snout length relative to head size (0: a flat face), and how thick its tip is (0.2 pointed .. 0.9 blunt). */
  snout: number;
  snoutTip: number;
  /** Jaws that close sideways (insects, crabs), length relative to the head (0: none). */
  mandibles: number;
  /** Horns: 0, 1, 2 or 4; length, curl, sweep (0 up, 1 back, -1 forward). */
  horns: number;
  hornLen: number;
  hornCurl: number;
  hornSweep: number;
  crest: number;
  frill: number;
  /** Eyes: how many (0 blind), how big, on stalks. */
  eyes: number;
  eyeSize: number;
  stalks: number;
  pupil: 'round' | 'slit' | 'compound' | 'none';
  /** Ears relative to the head (0: none), 0 round .. 1 pointed. */
  ears: number;
  earPoint: number;
  tusks: number;
  /** Feelers relative to torso length (0: none). */
  antennae: number;
  whiskers: boolean;
  /** A glowing lure on a stalk over the head (an angler's). */
  lure: number;
}

export interface LimbGenome {
  /** Leg pairs. */
  pairs: number;
  /** Leg length relative to torso length, thickness relative to torso girth (from the weight it carries). */
  length: number;
  thickness: number;
  /** Hind legs to front legs. */
  hindRatio: number;
  digitigrade: boolean;
  /** Sideways sprawl (0 upright mammal .. 1 spider). */
  splay: number;
  foot: FootKind;
  footSize: number;
  /** Arms (upright bipeds, or a crab's claws), their length relative to the torso; one claw much bigger (a fiddler's). */
  arms: boolean;
  armLength: number;
  claws: number;
  bigClaw: number;
}

export interface TailGenome {
  length: number;
  segments: number;
  thickness: number;
  /** Upward curl (a scorpion's over its back above 1). */
  curl: number;
  tip: TailTip;
}

export interface DorsalGenome {
  spikes: number;
  spikeLen: number;
  plates: boolean;
  /** A shell over the back (beetle, tortoise; a snail's coil on a slug), 0..1. */
  shell: number;
  /** A drifter's glowing sacs. */
  sacs: number;
}

export interface Coloring {
  base: Rgb;
  secondary: Rgb;
  belly: Rgb;
  accent: Rgb;
  glow: Rgb;
  eye: Rgb;
  keratin: Rgb;
  pattern: PatternKind;
  /** Pattern frequency per torso length, and its contrast. */
  patternScale: number;
  patternContrast: number;
  /** Pale belly, darker back (0..1). */
  countershade: number;
  /** Glowing spots or lines (0..1), and which: 0 dots, 1 lines, 2 the whole skin. */
  glowAmount: number;
  glowStyle: number;
  roughness: number;
  /** Oily sheen (beetles), 0..1. */
  sheen: number;
  /** See-through skin with the glowing insides showing (0..1). */
  translucent: number;
}

export interface Species {
  /** Stable id: `<role>.<slot>.<stratum or level>`. */
  readonly id: string;
  readonly seed: number;
  readonly role: CritterRole;
  readonly peaceful: boolean;
  readonly plan: BodyPlan;
  readonly integument: Integument;
  /** Torso length (pelvis to chest), metres. */
  readonly length: number;
  readonly girth: number;
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  readonly chest: number;
  readonly belly: number;
  readonly spineSegs: number;
  readonly spineArch: number;
  readonly upright: boolean;
  readonly neckLen: number;
  readonly neckSegs: number;
  readonly neckRaise: number;
  readonly head: HeadGenome;
  readonly limbs: LimbGenome;
  readonly tail: TailGenome;
  readonly dorsal: DorsalGenome;
  /** Radial plans: arms around the body, their length relative to the torso. */
  readonly arms: number;
  readonly armLen: number;
  /** Blend of its parts: 0 soft and organic .. 1 hard-edged. */
  readonly chunky: number;
  readonly colors: Coloring;
  readonly gait: Gait;
  /** Metres per second. */
  readonly walkSpeed: number;
  readonly runSpeed: number;
  /** Mass, kilograms; how high the hips stand; its whole length; its body's radius for the sims. */
  readonly mass: number;
  readonly hipHeight: number;
  readonly totalLength: number;
  readonly radius: number;
  /** A floater's height over the floor, metres. */
  readonly altitude: number;
  /** How many go together. */
  readonly group: readonly [number, number];
  /** The oddities strangeness bought it (`ODDITIES`). */
  readonly oddities: readonly Oddity[];
  /** How strange it was allowed to be. */
  readonly strangeness: number;
}

/** What strangeness can buy a species, each with its price. */
export const ODDITIES = {
  manyEyes: 1,
  stalkEyes: 1,
  blind: 0.6,
  extraLegs: 1.2,
  bigClaw: 1,
  lure: 1.2,
  translucent: 1.5,
  longNeck: 0.8,
  bigHead: 0.6,
  tinyHead: 0.6,
  spines: 0.5,
  shell: 0.8,
  feelers: 0.5,
  glowing: 0.7,
  oddColour: 0.8,
  stilts: 1,
  scorpion: 1,
} as const;
export type Oddity = keyof typeof ODDITIES;

/** Roles a level draws from: peaceful ones first, so every level has life to watch. */
const ROLE_PLANS: Record<CritterRole, { length: [number, number]; plans: [BodyPlan, number][] }> = {
  scuttler: { length: [0.06, 0.28], plans: [['hexapod', 4], ['crab', 3], ['octopod', 1.5], ['quadruped', 2], ['myriapod', 1.2], ['slug', 1], ['radial', 0.8]] },
  grazer: { length: [0.5, 1.4], plans: [['quadruped', 5], ['hexapod', 1.5], ['slug', 1.5], ['biped', 0.8], ['crab', 0.8]] },
  floater: { length: [0.3, 1.2], plans: [['floater', 1]] },
  giant: { length: [2.2, 4], plans: [['quadruped', 4], ['hexapod', 1.5], ['biped', 1], ['slug', 0.7], ['octopod', 0.8]] },
  watcher: { length: [0.25, 0.7], plans: [['quadruped', 3], ['biped', 2], ['octopod', 1], ['radial', 1], ['crab', 1]] },
  hunter: { length: [0.6, 1.3], plans: [['quadruped', 5], ['biped', 2], ['octopod', 1.5], ['hexapod', 1]] },
  lurker: { length: [0.4, 1.2], plans: [['octopod', 2], ['serpent', 2], ['myriapod', 1.5], ['crab', 1.2], ['quadruped', 1]] },
  swarmer: { length: [0.12, 0.35], plans: [['hexapod', 3], ['quadruped', 2], ['octopod', 1.5], ['myriapod', 1]] },
  brute: { length: [1.3, 2.2], plans: [['quadruped', 3], ['biped', 2], ['crab', 1.2], ['hexapod', 1]] },
};

const LEG_PAIRS: Record<BodyPlan, number> = { quadruped: 2, biped: 1, hexapod: 3, octopod: 4, crab: 4, myriapod: 9, serpent: 0, slug: 0, radial: 0, floater: 0 };

/** Arthropod-like plans: chitin and jointed thread legs. */
function jointed(plan: BodyPlan): boolean {
  return plan === 'hexapod' || plan === 'octopod' || plan === 'crab' || plan === 'myriapod';
}

/** Gravity, for speeds from leg length (Froude scaling: v = sqrt(Fr·g·leg)). */
const G = 9.81;

/** The roles of a level's slots: what lives there (slot 0, 1: peaceful; 2, 3: hunters; more as it gets deeper). */
export function rolesOf(seed: number, depth: number): CritterRole[] {
  const rng = new Rng(deriveSeed(seed, 'bestiary', stratumOf(depth)?.from ?? depth));
  const peaceful: CritterRole[] = ['scuttler', 'grazer', 'floater', 'watcher', 'giant'];
  const hostile: CritterRole[] = ['hunter', 'lurker', 'swarmer', 'brute'];
  const first = rng.pick(['scuttler', 'grazer', 'watcher'] as const);
  const out: CritterRole[] = [first, rng.pick(peaceful.filter((r) => r !== first))];
  if (depth > 10) out.push(...rng.sample(hostile, depth > 30 ? 3 : 2));
  if (depth > 20 && rng.chance(0.6)) out.push(rng.pick(peaceful.filter((r) => !out.includes(r))));
  return [...new Set(out)];
}

/** The species in slot `slot` of the level of `depth`, playing `role`. */
export function speciesOf(seed: number, depth: number, slot: number, role: CritterRole): Species {
  const at = stratumOf(depth)?.from ?? depth;
  const rng = new Rng(deriveSeed(seed, 'species', at, slot, role));
  // Some strangeness from the very first level (Arnd, 2026-10-16), rising with depth.
  const strange = clamp(0.35 + strangeness(seed, at).s * 0.9, 0, 3.5);
  return grow(rng, role, strange, `${role}.${slot}.${at}`);
}

/** The level's species: one per role it draws. */
export function bestiaryOf(seed: number, depth: number): Species[] {
  return rolesOf(seed, depth).map((role, slot) => speciesOf(seed, depth, slot, role));
}

/** Grow one species. */
export function grow(rng: Rng, role: CritterRole, strange: number, id: string): Species {
  const spec = ROLE_PLANS[role];
  const peaceful = PEACEFUL.includes(role);
  let plan = rng.weighted(spec.plans, (p) => p[1])[0];

  // ---------------- oddities, bought with strangeness
  const odd = new Set<Oddity>();
  let budget = strange * rng.range(0.5, 1.1);
  const offer = rng.shuffle(Object.keys(ODDITIES) as Oddity[]);
  for (const o of offer) {
    if (budget < ODDITIES[o]) continue;
    if (!fits(o, plan, role, odd)) continue;
    if (!rng.chance(0.45)) continue;
    odd.add(o);
    budget -= ODDITIES[o];
  }

  let length = Math.exp(lerp(Math.log(spec.length[0]), Math.log(spec.length[1]), rng.float()));
  const isJointed = jointed(plan);

  // ---------------- skin
  const integ: Integument = (() => {
    if (plan === 'slug' || plan === 'floater') return 'slime';
    if (isJointed) return rng.chance(0.85) ? 'chitin' : rng.pick(['stone', 'slime'] as const);
    if (plan === 'serpent') return rng.weighted(['scales', 'slime', 'hide'] as const, (_, i) => [5, 2, 1.5][i]);
    if (role === 'giant' || role === 'brute') return rng.weighted(['hide', 'stone', 'scales', 'fur'] as const, (_, i) => [4, 2, 2, 1.5][i]);
    return rng.weighted(['fur', 'hide', 'scales', 'slime'] as const, (_, i) => [4, 3, 2.5, 1][i]);
  })();

  // ---------------- limbs: thickness from the weight they carry
  let pairs = LEG_PAIRS[plan];
  if (plan === 'myriapod') pairs = rng.int(7, 11);
  if (odd.has('extraLegs')) pairs += plan === 'biped' ? 1 : plan === 'quadruped' ? 1 : 0;
  if (odd.has('extraLegs') && plan === 'biped') plan = 'quadruped';
  if (odd.has('extraLegs') && plan === 'quadruped' && pairs === 3) plan = 'hexapod';
  const girth = plan === 'serpent' ? rng.range(0.07, 0.11) : plan === 'myriapod' ? rng.range(0.08, 0.12) : plan === 'slug' ? rng.range(0.16, 0.24) : plan === 'radial' || plan === 'floater' ? rng.range(0.4, 0.6) : plan === 'crab' ? rng.range(0.3, 0.42) : isJointed ? rng.range(0.2, 0.3) : rng.range(0.17, 0.26) * (role === 'giant' || role === 'brute' ? 1.15 : 1);
  const legLenRel = (() => {
    if (pairs === 0) return 0;
    if (plan === 'myriapod') return rng.range(0.25, 0.4);
    if (plan === 'crab') return rng.range(0.7, 1.1);
    if (isJointed) return rng.range(0.7, 1.4) * (plan === 'octopod' ? 1.25 : 1) * (odd.has('stilts') ? 1.8 : 1);
    if (plan === 'biped') return rng.range(0.85, 1.3);
    if (role === 'scuttler' || role === 'swarmer') return rng.range(0.35, 0.6);
    return rng.range(0.6, 1.05) * (odd.has('stilts') ? 1.7 : 1);
  })();
  // Allometry: legs of a heavy animal are thicker for their length (cross-section grows with weight, l^3).
  const heft = clamp(Math.pow(length, 0.5) * 0.9, 0.35, 1.6);
  const thickness = isJointed ? rng.range(0.07, 0.11) * (0.8 + heft * 0.35) : rng.range(0.24, 0.32) * (0.75 + heft * 0.35) / Math.sqrt(Math.max(1, pairs / 2)) * (odd.has('stilts') ? 0.7 : 1);
  const upright = plan === 'biped' && (role === 'brute' || role === 'watcher' ? rng.chance(0.45) : rng.chance(0.15));
  const crabClaws = plan === 'crab' || (plan === 'octopod' && odd.has('scorpion'));
  const limbs: LimbGenome = {
    pairs,
    length: legLenRel,
    thickness,
    hindRatio: plan === 'quadruped' ? (rng.chance(0.25) ? rng.range(1.15, 1.5) : rng.range(0.92, 1.08)) : 1,
    digitigrade: !isJointed && !upright && (plan === 'biped' || role === 'hunter' || rng.chance(0.4)),
    splay: plan === 'crab' ? rng.range(0.85, 1) : isJointed ? rng.range(0.7, 1) : integ === 'scales' && plan === 'quadruped' && rng.chance(0.6) ? rng.range(0.45, 0.75) : rng.range(0, 0.15),
    foot: isJointed ? 'point' : role === 'grazer' || role === 'giant' ? rng.pick(['hoof', 'pad', 'paw'] as const) : role === 'hunter' || role === 'brute' ? 'claw' : rng.pick(['paw', 'claw', 'pad'] as const),
    footSize: rng.range(0.85, 1.25) * (role === 'giant' ? 1.25 : 1),
    arms: upright || crabClaws,
    armLength: crabClaws ? rng.range(0.6, 1) : upright ? rng.range(0.9, 1.4) : 0,
    claws: crabClaws ? 1 : 0,
    bigClaw: odd.has('bigClaw') ? rng.range(1.8, 2.6) : 1,
  };

  // ---------------- head
  const head: HeadGenome = {
    size: (plan === 'radial' || plan === 'floater' ? 0 : isJointed ? rng.range(0.2, 0.3) : plan === 'slug' ? rng.range(0.22, 0.3) : rng.range(0.19, 0.28)) * (odd.has('bigHead') ? 1.45 : odd.has('tinyHead') ? 0.6 : 1),
    snout: isJointed || plan === 'slug' ? rng.range(0, 0.3) : role === 'grazer' || role === 'giant' ? rng.range(0.9, 1.6) : role === 'hunter' || role === 'brute' ? rng.range(0.8, 1.5) : plan === 'serpent' ? rng.range(0.5, 1) : rng.range(0.4, 1.2),
    snoutTip: rng.range(0.35, 0.85),
    mandibles: isJointed && rng.chance(0.65) ? rng.range(0.5, 1.3) : 0,
    horns: 0,
    hornLen: 0,
    hornCurl: 0,
    hornSweep: 0,
    crest: !isJointed && rng.chance(0.12 + strange * 0.06) ? rng.range(0.3, 1) : 0,
    frill: !isJointed && rng.chance(0.05 + strange * 0.05) ? rng.range(0.5, 1.1) : 0,
    eyes: 2,
    eyeSize: rng.range(0.85, 1.25),
    stalks: 0,
    pupil: isJointed ? 'compound' : rng.pick(['round', 'slit', 'round'] as const),
    ears: integ === 'fur' && !isJointed ? rng.range(0.35, 1.3) * (role === 'scuttler' || role === 'watcher' ? 1.4 : 1) : 0,
    earPoint: rng.float(),
    tusks: 0,
    antennae: plan === 'hexapod' || plan === 'myriapod' ? rng.range(0.3, 1.1) : odd.has('feelers') ? rng.range(0.4, 0.9) : 0,
    whiskers: integ === 'fur' && rng.chance(0.5),
    lure: odd.has('lure') ? rng.range(0.8, 1.4) : 0,
  };
  if ((role === 'grazer' || role === 'giant' || role === 'brute') && rng.chance(0.55) && !isJointed && plan !== 'slug') {
    head.horns = rng.weighted([1, 2, 4] as const, (_, i) => [0.6, 3, 0.6 + strange * 0.4][i]);
    head.hornLen = rng.range(0.4, 1.6);
    head.hornCurl = rng.range(0, 1.2);
    head.hornSweep = rng.range(-0.3, 1.1);
  }
  if ((role === 'giant' || role === 'brute') && !isJointed && rng.chance(0.25)) head.tusks = rng.range(0.4, 1);
  if (odd.has('manyEyes')) head.eyes = rng.pick([3, 4, 6, 8]);
  if (plan === 'octopod' && head.eyes === 2) head.eyes = rng.pick([2, 4, 6, 8]);
  if (odd.has('stalkEyes')) head.stalks = rng.range(0.6, 1.3);
  if (plan === 'crab' && !odd.has('stalkEyes')) head.stalks = rng.chance(0.6) ? rng.range(0.4, 0.8) : 0;
  if (odd.has('blind')) { head.eyes = 0; head.antennae = Math.max(head.antennae, rng.range(0.4, 0.9)); head.whiskers = !isJointed; }

  // ---------------- neck, tail
  let neckLen = isJointed || plan === 'slug' ? 0.06 : rng.range(0.15, 0.45);
  if (odd.has('longNeck')) neckLen = rng.range(0.9, 1.5);
  if (plan === 'radial' || plan === 'floater') neckLen = 0.04;
  if (upright) neckLen = rng.range(0.08, 0.2);
  const neckRaise = plan === 'serpent' || plan === 'slug' ? 0.1 : upright ? 0.1 : isJointed ? rng.range(-0.1, 0.2) : neckLen > 0.6 ? rng.range(0.6, 1.1) : rng.range(0.2, 0.7);
  const tail: TailGenome = {
    length: plan === 'serpent' ? rng.range(1.4, 2.4) : plan === 'myriapod' ? 0 : plan === 'slug' ? rng.range(0.2, 0.4) : isJointed ? (odd.has('scorpion') ? rng.range(0.9, 1.3) : plan === 'hexapod' && rng.chance(0.25) ? rng.range(0.4, 0.9) : 0) : plan === 'radial' || plan === 'floater' ? 0 : upright ? (rng.chance(0.3) ? rng.range(0.3, 0.7) : 0) : rng.range(0.3, 1.3),
    segments: 0,
    thickness: rng.range(0.35, 0.75),
    curl: odd.has('scorpion') ? rng.range(1.2, 1.7) : isJointed ? rng.range(0.4, 1) : rng.range(-0.2, 0.4),
    tip: odd.has('scorpion') ? 'sting' : odd.has('lure') && plan === 'serpent' ? 'lure' : rng.weighted(['none', 'club', 'tuft', 'spikes'] as const, (_, i) => [6, role === 'brute' || role === 'giant' ? 1.2 : 0.2, integ === 'fur' ? 1.5 : 0, 0.3 + strange * 0.2][i]),
  };
  if (plan === 'biped' && !upright) tail.length = Math.max(tail.length, rng.range(0.9, 1.5)); // a counterweight
  tail.segments = tail.length > 0 ? clamp(Math.round(3 + tail.length * 5), 3, plan === 'serpent' ? 14 : 9) : 0;
  const dorsal: DorsalGenome = {
    spikes: odd.has('spines') || (integ === 'scales' && rng.chance(0.2)) ? rng.int(4, 9) : 0,
    spikeLen: rng.range(0.08, 0.25),
    plates: (role === 'giant' || role === 'brute') && rng.chance(0.15),
    shell: odd.has('shell') || (integ === 'chitin' && plan !== 'crab' && rng.chance(0.35)) || (plan === 'slug' && rng.chance(0.5)) ? rng.range(0.5, 1) : 0,
    sacs: plan === 'floater' ? rng.int(0, 4) : 0,
  };
  if (dorsal.plates) dorsal.spikes = rng.int(5, 8);

  const arms = plan === 'radial' ? rng.int(5, 7) : plan === 'floater' ? rng.int(6, 12) : 0;
  const armLen = plan === 'radial' ? rng.range(1, 1.7) : plan === 'floater' ? rng.range(1.2, 2.6) : 0;

  // ---------------- colours: earthy and pale in the dark, a little colour where it lives on glow
  const colors = colour(rng, integ, plan, role, strange, odd);

  // ---------------- gait and speeds (Froude: a walk at Fr ~0.25, a run at Fr ~2)
  const gait: Gait = plan === 'floater' ? 'drift' : plan === 'serpent' ? 'slither' : plan === 'slug' ? 'glide' : plan === 'radial' || pairs >= 4 ? 'wave' : pairs === 3 ? 'tripod' : pairs === 1 ? (rng.chance(0.15) ? 'waddle' : 'stride') : role === 'scuttler' || role === 'swarmer' ? (rng.chance(0.5) ? 'bound' : 'trot') : role === 'hunter' || role === 'grazer' ? 'gallop' : rng.chance(0.5) ? 'trot' : 'walk';
  const legM = length * legLenRel;
  const hipHeight = pairs === 0 ? length * girth * (plan === 'floater' ? 1 : 1.1) : isJointed ? legM * 0.42 + length * girth * 0.3 : legM * 0.93 * (1 - limbs.splay * 0.5) + length * girth * 0.2;
  const legForSpeed = Math.max(0.03, pairs ? legM : length * 0.3);
  let walkSpeed = Math.sqrt(0.25 * G * legForSpeed) * (isJointed ? 1.4 : 1);
  let runSpeed = Math.sqrt(2 * G * legForSpeed) * (isJointed ? 1.6 : 1) * (role === 'giant' ? 0.5 : 1);
  if (plan === 'slug') { walkSpeed = clamp(length * 0.25, 0.05, 0.4); runSpeed = walkSpeed * 1.6; }
  if (plan === 'serpent') { walkSpeed = clamp(length * 0.8, 0.3, 1.4); runSpeed = walkSpeed * 3; }
  if (plan === 'floater') { walkSpeed = 0.25; runSpeed = 0.8; }
  walkSpeed = clamp(walkSpeed, 0.05, 2); runSpeed = clamp(runSpeed, 0.15, 9);
  const neckM = length * neckLen, headR = length * head.size, tailM = length * tail.length;
  const totalLength = length + neckM * Math.cos(neckRaise) + headR * (1 + head.snout) + tailM;
  const vol = length * Math.PI * (length * girth) ** 2;
  const mass = Math.max(0.005, vol * 1000 * 1.6);
  const group: readonly [number, number] = role === 'scuttler' ? [3, 8] : role === 'swarmer' ? [5, 10] : role === 'grazer' ? [2, 6] : role === 'floater' ? [2, 6] : role === 'hunter' ? [2, 5] : role === 'watcher' ? [1, 2] : [1, 1];
  const spineSegs = plan === 'serpent' ? rng.int(9, 13) : plan === 'myriapod' ? pairs + 1 : plan === 'slug' ? 5 : plan === 'radial' || plan === 'floater' ? 1 : rng.int(3, 5);

  return {
    id, seed: rng.nextU32(), role, peaceful, plan, integument: integ,
    length, girth,
    bodyWidth: plan === 'radial' || plan === 'floater' ? 1 : plan === 'crab' ? rng.range(1.4, 1.9) : plan === 'slug' ? rng.range(0.9, 1.2) : rng.range(0.82, 1.15),
    bodyHeight: plan === 'floater' ? rng.range(0.7, 1.1) : plan === 'radial' ? rng.range(0.3, 0.5) : plan === 'crab' ? rng.range(0.45, 0.6) : plan === 'slug' ? rng.range(0.7, 0.95) : rng.range(0.9, 1.2),
    chest: plan === 'radial' || plan === 'floater' ? 1 : rng.range(0.85, 1.3),
    belly: rng.range(0, 0.35),
    spineSegs,
    spineArch: plan === 'serpent' || plan === 'slug' ? 0 : rng.range(-0.1, 0.3) + (dorsal.shell ? 0.2 : 0),
    upright, neckLen, neckSegs: clamp(Math.round(1 + neckLen * 5), 1, 6), neckRaise,
    head, limbs, tail, dorsal, arms, armLen,
    chunky: integ === 'stone' ? rng.range(0.5, 0.8) : integ === 'chitin' ? rng.range(0.3, 0.55) : rng.range(0, 0.2),
    colors, gait, walkSpeed, runSpeed, mass,
    hipHeight, totalLength,
    radius: clamp(Math.max(length * girth * 1.2, Math.min(totalLength, length * 1.2) * 0.32), 0.04, 2.5),
    altitude: plan === 'floater' ? rng.range(1.2, 3.5) : 0,
    group,
    oddities: [...odd],
    strangeness: strange,
  };
}

/** May this species have this oddity? */
function fits(o: Oddity, plan: BodyPlan, role: CritterRole, has: Set<Oddity>): boolean {
  const legs = LEG_PAIRS[plan] > 0;
  switch (o) {
    case 'manyEyes': case 'stalkEyes': return plan !== 'radial' && plan !== 'floater' && !has.has('blind');
    case 'blind': return plan !== 'floater' && !has.has('manyEyes') && !has.has('stalkEyes');
    case 'extraLegs': return plan === 'quadruped' || plan === 'biped';
    case 'bigClaw': return plan === 'crab';
    case 'lure': return role === 'lurker' || role === 'watcher' || role === 'hunter' || role === 'floater';
    case 'translucent': return plan !== 'radial';
    case 'longNeck': return plan === 'quadruped' || plan === 'biped';
    case 'bigHead': return plan !== 'radial' && plan !== 'floater' && !has.has('tinyHead');
    case 'tinyHead': return plan !== 'radial' && plan !== 'floater' && !has.has('bigHead');
    case 'spines': return plan !== 'floater' && plan !== 'radial';
    case 'shell': return plan === 'quadruped' || plan === 'hexapod' || plan === 'slug';
    case 'feelers': return plan !== 'floater';
    case 'glowing': return true;
    case 'oddColour': return true;
    case 'stilts': return legs && plan !== 'myriapod' && plan !== 'crab';
    case 'scorpion': return plan === 'octopod';
  }
}

/** The colours of a species: cave animals are pale or dark and earthy; strangeness and glow add colour. */
function colour(rng: Rng, integ: Integument, plan: BodyPlan, role: CritterRole, strange: number, odd: Set<Oddity>): Coloring {
  // Cave palettes: bone, clay, slate, soot, rust, lichen, and albino flesh.
  const EARTH: Rgb[] = [[0.78, 0.74, 0.66], [0.55, 0.45, 0.36], [0.36, 0.34, 0.33], [0.2, 0.18, 0.17], [0.52, 0.33, 0.22], [0.48, 0.5, 0.38], [0.86, 0.72, 0.68], [0.62, 0.58, 0.5]];
  let base = rng.pick(EARTH);
  let secondary = rng.pick(EARTH);
  if (integ === 'chitin') { base = mixRgb(base, [0.12, 0.1, 0.09], rng.range(0.3, 0.7)); secondary = mixRgb(secondary, base, 0.5); }
  if (integ === 'slime') base = mixRgb(base, [0.85, 0.8, 0.78], rng.range(0.2, 0.6));
  if (integ === 'stone') { base = mixRgb([0.42, 0.4, 0.38], base, 0.3); secondary = mixRgb(base, [0.2, 0.2, 0.2], 0.5); }
  if (odd.has('oddColour') || rng.chance(Math.min(0.5, strange * 0.12))) {
    const hue = rng.float();
    const c = hsl2rgb(hue, rng.range(0.4, 0.75), rng.range(0.3, 0.5));
    if (rng.chance(0.5)) secondary = c; else base = mixRgb(base, c, rng.range(0.5, 0.85));
  }
  const jitter = (c: Rgb, a: number): Rgb => [clamp(c[0] + rng.range(-a, a), 0.02, 1), clamp(c[1] + rng.range(-a, a), 0.02, 1), clamp(c[2] + rng.range(-a, a), 0.02, 1)];
  base = jitter(base, 0.04);
  secondary = jitter(secondary, 0.05);
  const glowHue = rng.chance(0.65) ? rng.range(0.42, 0.6) : rng.pick([0.08, 0.15, 0.8, rng.float()]);
  const glowing = odd.has('glowing') || odd.has('lure') || plan === 'floater' || odd.has('translucent');
  const pattern: PatternKind = integ === 'stone' ? rng.pick(['none', 'bands', 'mottled'] as const) : rng.weighted(['none', 'stripes', 'spots', 'bands', 'patches', 'mottled', 'saddle', 'eyespots'] as const, (_, i) => [2.5, role === 'hunter' ? 2 : 1, 2, integ === 'chitin' || plan === 'serpent' || plan === 'myriapod' ? 3 : 0.4, 1, 1.6, 1, 0.2 + strange * 0.3][i]);
  return {
    base, secondary,
    belly: mixRgb(base, [0.93, 0.9, 0.84], rng.range(0.35, 0.7)),
    accent: hsl2rgb(rng.float(), rng.range(0.55, 0.9), rng.range(0.4, 0.55)),
    glow: hsl2rgb(glowHue, rng.range(0.7, 1), 0.6),
    eye: isEyeDark(rng) ? [0.05, 0.04, 0.04] : hsl2rgb(rng.pick([0.08, 0.12, 0.15, 0.3, 0.55, 0.95]), rng.range(0.5, 0.9), rng.range(0.4, 0.6)),
    keratin: integ === 'chitin' ? mixRgb(base, [0.05, 0.04, 0.03], 0.6) : rng.pick([[0.85, 0.8, 0.68], [0.22, 0.19, 0.17], [0.55, 0.45, 0.32]] as Rgb[]),
    pattern,
    patternScale: rng.range(3, 8) * (pattern === 'stripes' ? 1.3 : 1),
    patternContrast: rng.range(0.35, 0.9),
    countershade: integ === 'chitin' || integ === 'stone' ? rng.range(0, 0.3) : rng.range(0.35, 0.9),
    glowAmount: glowing ? rng.range(0.5, 1) : rng.chance(0.08 + strange * 0.06) ? rng.range(0.2, 0.6) : 0,
    glowStyle: plan === 'floater' ? rng.pick([0, 2]) : rng.weighted([0, 1, 2], (_, i) => [3, 2, 0.4][i]),
    roughness: integ === 'slime' ? rng.range(0.15, 0.3) : integ === 'chitin' ? rng.range(0.25, 0.45) : integ === 'scales' ? rng.range(0.4, 0.6) : integ === 'stone' ? 0.85 : integ === 'hide' ? rng.range(0.55, 0.75) : rng.range(0.75, 0.95),
    sheen: integ === 'chitin' && rng.chance(0.35) ? rng.range(0.3, 0.9) : 0,
    translucent: odd.has('translucent') || plan === 'floater' ? rng.range(0.5, 0.9) : 0,
  };
}

function isEyeDark(rng: Rng): boolean {
  return rng.chance(0.35);
}
