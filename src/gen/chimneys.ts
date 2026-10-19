/**
 * The town's chimneys (town-and-first-strata.md §3): a seeded few of its houses have one, always
 * grandma's. Where a stack rises, the roof it comes through and the mouth its smoke leaves are
 * the same every game; the stacks themselves are built with the houses (src/gen/townProps.ts) and
 * the smoke is modelled from these mouths (src/world/smoke.ts). Pure data.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { HOUSES, TOWN, TOWN_SEED } from './town';
import { ridgeHeight } from './village';
import { local } from './propMesh';

/** A chimney: the stack's centre in plan, its house's yaw, the roof at its foot, the cap's top and the mouth smoke leaves. */
export interface Chimney {
  /** The index of its house in `HOUSES`. */
  readonly house: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** The roof's height at the stack, where it begins below it. */
  readonly roof: number;
  /** The bottom of the stack (under the roof) and the top of its cap. */
  readonly base: number;
  readonly top: number;
  /** Where the plume starts: the top of its pot. */
  readonly mouth: number;
}

/** How many houses smoke: her own and a seeded handful near her street. */
const SMOKING = 5;

/** The houses that may have one: her own (always), and the houses near her street. */
function smokingHouses(): number[] {
  const [west, east] = TOWN.street.x, streetX = (west + east) / 2;
  const near: number[] = [];
  HOUSES.forEach((h, i) => {
    if (i === 0 || h.kind !== 'house' || h.ridge === 'spire') return;
    if (Math.hypot(h.cx - streetX, h.cz) < 110) near.push(i);
  });
  // A village always has enough houses by her street; if not, any house will do.
  if (near.length < SMOKING) {
    HOUSES.forEach((h, i) => {
      if (i === 0 || h.kind !== 'house' || h.ridge === 'spire' || near.includes(i)) return;
      near.push(i);
    });
  }
  return near;
}

/**
 * The town's chimneys for one seed: grandma's first, then a seeded handful of her neighbours'.
 * Two calls with the same seed give the same houses, stack for stack.
 */
export function chimneysOf(seed: number): Chimney[] {
  const rng = new Rng(deriveSeed(seed, 'chimneys')), near = smokingHouses();
  const picked = [0, ...rng.sample(near, SMOKING)].sort((a, b) => a - b);
  return picked.map((i) => {
    const H = HOUSES[i], { cx, cz, yaw } = H, r = new Rng(deriveSeed(seed, 'chimney', i));
    // A stack on one pitch of the roof, a little off the ridge so it has a chimney breast below it.
    const across = H.ridge === 'across';
    const side = across ? r.range(0.16, 0.34) * H.hu * r.sign() : r.range(-0.4, 0.4) * H.hu;
    const fwd = across ? r.range(-0.4, 0.4) * H.hv : r.range(0.16, 0.34) * H.hv * r.sign();
    const [x, z] = local(cx, cz, yaw)(side, fwd);
    const ridge = ridgeHeight(H), roof = ridge - Math.abs(across ? side : fwd) * H.pitch;
    const top = ridge + r.range(0.7, 2.0);
    return { house: i, x, z, yaw, roof, base: roof - 0.55, top, mouth: top + 0.4 };
  });
}

/** The town's chimneys, the same every game. */
export const CHIMNEYS: readonly Chimney[] = chimneysOf(TOWN_SEED);
