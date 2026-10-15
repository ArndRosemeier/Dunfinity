/**
 * The slimes on screen (src/creatures/slimes.ts): Lumen, a pale jelly with glowing motes in it, and
 * Murk, a black, oily one with a sheen. They squeeze along in pulses, squash down before a blow and
 * throw themselves forward with it, quiver when hit, and melt into a puddle when they die.
 *
 * A fixed pool per faction, added with the Stage once.
 */
import { Group } from 'three/webgpu';
import type { Rgb } from '../../gen/propMesh';
import { meshOf as mesh } from '../meshes';
import { GLOW, METAL, VERTEX_COLOR_SOLID } from '../materials';
import { SLIME, type Faction, type Slime } from '../../creatures/slimes';
import { FigurePool, placeFigure, type Figure } from './figures';

/** How many of each faction can be drawn at once. */
const POOL = 16;

const LUMEN: Rgb = [0.42, 0.62, 0.6], MOTE: Rgb = [0.5, 1.0, 0.9], MURK: Rgb = [0.05, 0.035, 0.06], BUMP: Rgb = [0.09, 0.05, 0.1];

function parts(faction: Faction) {
  const R = SLIME.radius, H = SLIME.height / 2;
  if (faction === 'lumen') {
    return [
      mesh((b) => b.ellipsoid(0, H, 0, R, H, R, LUMEN, 14), VERTEX_COLOR_SOLID),
      // Glowing motes just under the skin (poking through it): on the surface, round and up.
      mesh((b) => {
        for (const [a, up, r] of [[0.3, 0.5, 0.05], [1.6, 0.8, 0.045], [2.7, 0.3, 0.04], [3.9, 0.65, 0.05], [5.1, 0.4, 0.04], [0.9, 1.2, 0.035]]) {
          const c = Math.cos(up), sn = Math.sin(up);
          b.ellipsoid(Math.cos(a) * c * R * 0.97, H + sn * H * 0.97, Math.sin(a) * c * R * 0.97, r, r, r, MOTE, 6);
        }
      }, GLOW),
    ];
  }
  return [
    mesh((b) => {
      b.ellipsoid(0, H, 0, R, H, R, MURK, 14);
      for (const [x, y, z, r] of [[0.2, 0.3, 0.12, 0.12], [-0.17, 0.26, -0.15, 0.11], [0.02, 0.4, -0.12, 0.1]]) b.ellipsoid(x, y, z, r, r * 0.8, r, BUMP, 8);
    }, METAL),
  ];
}

class SlimeFigure implements Figure<Slime> {
  readonly root = new Group();
  private readonly body = new Group();

  constructor(p: ReturnType<typeof parts>) {
    this.root.add(this.body);
    for (const m of p) this.body.add(m.clone());
  }

  pose(s: Slime, time: number): void {
    const R = this.root, B = this.body;
    placeFigure(R, s);
    // Squash (down and out) and stretch (forward), the jelly's wobble on top.
    let squash = 0, stretch = 0;
    const wobble = Math.sin(time * 7 + s.id) * 0.03 + Math.max(0, 1 - s.hurtT / 0.4) * Math.sin(time * 40) * 0.12;
    if (s.mode === 'dead') {
      const k = Math.min(1, s.deadT / 1.2);
      B.scale.set(1 + 0.7 * k, 1 - 0.85 * k, 1 + 0.7 * k);
      return;
    }
    if (s.mode === 'blow') {
      const t = s.blowT;
      if (t < SLIME.squash) squash = 0.4 * (t / SLIME.squash);
      else if (t < SLIME.squash + SLIME.throw) { squash = -0.15; stretch = 0.45; }
      else squash = 0.1 * Math.max(0, 1 - (t - SLIME.squash - SLIME.throw) / 0.3);
    } else if (s.mode === 'go' || s.mode === 'ooze') {
      // The pulse: gather (squash), then flow out forward.
      const p = Math.sin(s.phase);
      squash = -0.08 * p + 0.06;
      stretch = 0.15 * Math.max(0, p);
    }
    B.scale.set(1 + squash * 0.6 + wobble, 1 - squash - wobble, 1 + squash * 0.6 + stretch + wobble);
  }
}

/** Both factions' pools: Lumen and Murk. */
export class SlimeView {
  readonly lumen = new FigurePool<Slime>('lumen', POOL, ((p) => () => new SlimeFigure(p))(parts('lumen')));
  readonly murk = new FigurePool<Slime>('murk', POOL, ((p) => () => new SlimeFigure(p))(parts('murk')));
  readonly root = new Group();

  constructor() {
    this.root.add(this.lumen.root, this.murk.root);
  }
}
