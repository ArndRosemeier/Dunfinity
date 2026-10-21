/**
 * The town's people one calls on, on screen, Actors figures: Frau Weber (src/world/neighbour.ts),
 * old, in her cardigan, on her doorstep; the stranger at Ilse's (src/world/stranger.ts), one of the
 * game's peoples of the deep (src/creatures/folk.ts) in dark travelling clothes; Kemal and Ilse
 * behind their shop counters (src/world/shopkeeper.ts). And grandma's ghost in her round room
 * (src/world/grandma.ts): Grete as she was at the end, old, her hair up in a bun, in her cardigan, made a ghost in the salt's own blue, rising, talking and fading with a slow flicker. They
 * turn to whoever comes near and talk with their hands. Each is drawn with a HumanPool of one (built
 * before the warm-up: its `people.figures` go to `view.start`).
 */
import { deriveSeed } from '@futuremagic/core';
import { HumanPool, figures, type PoolFigure } from '../creatures/humanPool';
import { dressOf, folkLook } from '../actors/looks';
import type { GhostLook } from '../actors/ghost';
import { talking, type Townsperson } from '../../world/townsperson';
import { WEBER } from '../../world/neighbour';
import { STRANGER } from '../../world/stranger';
import { KEEPER } from '../../world/shopkeeper';
import type { Shop } from '../../gen/town';
import { GRANDMA, type Grandma } from '../../world/grandma';
import { deepFolk } from '../../creatures/folk';

/** How far off they are drawn, metres. */
const SHOWN = 45;

/** Grandma's ghost: the infused salt's glow, deeper than the elves' silver-blue. */
const GRETE: GhostLook = { tint: [0.45, 0.75, 1], opacity: 0.45 };

/** Frau Weber's cardigan over a long dark skirt, and her slippers. */
const WEBERS = dressOf([['briefs', [0.8, 0.8, 0.8]], ['fisherman-sweater', [0.42, 0.33, 0.36]], ['skirt', [0.12, 0.12, 0.16]], ['cloth-shoes', [0.3, 0.12, 0.14]]]);
/** Grandma's cardigan over a long dark skirt, and her slippers. */
const GRETES = dressOf([['briefs', [0.8, 0.8, 0.8]], ['fisherman-sweater', [0.42, 0.33, 0.36]], ['skirt', [0.12, 0.12, 0.16]], ['cloth-shoes', [0.3, 0.12, 0.14]]]);
/** The stranger's dark travelling clothes and worn boots. */
const TRAVELLER = dressOf([['briefs', [0.2, 0.2, 0.2]], ['longsleeve', [0.14, 0.13, 0.12]], ['wool-pants', [0.12, 0.11, 0.1]], ['pirate-boots', [0.22, 0.16, 0.1]]]);
/** The shopkeepers: Kemal's brown shop coat over grey work trousers; Ilse's bottle-green cardigan over a dark skirt. */
const KEEPERS = {
  hardware: dressOf([['briefs', [0.8, 0.8, 0.8]], ['longsleeve', [0.34, 0.24, 0.14]], ['wool-pants', [0.24, 0.24, 0.25]], ['work-boots', [0.12, 0.09, 0.07]]]),
  pawn: dressOf([['briefs', [0.8, 0.8, 0.8]], ['fisherman-sweater', [0.14, 0.26, 0.18]], ['skirt', [0.13, 0.11, 0.12]], ['cloth-shoes', [0.16, 0.08, 0.06]]]),
} as const;

export class NeighbourView<T extends Townsperson = Townsperson> {
  readonly people: HumanPool<T>;

  static async create(): Promise<NeighbourView> {
    // She has lived across the street for sixty years.
    const seed = deriveSeed(1931, 'weber');
    return new NeighbourView(await figures(1, () => folkLook('human', seed, { age: 0.97, female: true }, WEBERS)), WEBER.talk, 'happy');
  }

  /** The stranger at Ilse's: the first of this game's peoples of the deep. */
  static async stranger(seed: number): Promise<NeighbourView> {
    const s = deriveSeed(seed, 'stranger');
    return new NeighbourView(await figures(1, () => folkLook(deepFolk(seed)[0], s, { age: 0.55, female: (s & 1) === 1 }, TRAVELLER)), STRANGER.talk, 'happy');
  }

  /** A shopkeeper behind the counter, the same for every seed: Kemal, a man of fifty-odd; Ilse, a woman of seventy. */
  static async keeper(shop: Shop): Promise<NeighbourView> {
    const seed = deriveSeed(1931, shop), look = shop === 'hardware' ? { age: 0.55, female: false } : { age: 0.75, female: true };
    return new NeighbourView(await figures(1, () => folkLook('human', seed, look, KEEPERS[shop])), KEEPER.talk, 'happy');
  }

  /** Grandma's ghost: Grete, born 1940, the same for every seed, her hair up in the bun she wore for sixty years. */
  static async grandma(): Promise<NeighbourView<Grandma>> {
    const seed = deriveSeed(1940, 'grete');
    return new NeighbourView<Grandma>(await figures(1, () => folkLook('human', seed, { age: 0.97, female: true, hair: 'hair-bun' }, GRETES), () => null, { ghost: GRETE }), GRANDMA.talk, 'sad', (g, time) => g.seen(time) * (0.88 + 0.12 * Math.sin(time * 1.3)));
  }

  private constructor(h: PoolFigure[], talk: number, mood: 'happy' | 'sad', fade?: (n: T, time: number) => number) {
    this.people = new HumanPool<T>(h, SHOWN, (n, time) => ({
      anim: { move: 'idle', action: talking(n, time) ? { id: 'talk', t0: n.talkAt, dur: talk } : undefined, mood: talking(n, time) ? mood : 'neutral' },
      combat: false,
    }), 0.7, fade);
  }
}
