/**
 * Procedural creatures in a row, for looking them over (the Lab's `?critters`): a sampler of every
 * role at a spread of strangeness, or with a depth (`?critters=<depth>`) that level's own bestiary
 * (src/creatures/bestiary.ts). Each in turn walks a small ring, stands and watches the camera, and
 * does its action once, so the gaits and the actions can be seen.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import type { Object3D } from 'three/webgpu';
import { bestiaryOf, grow, type CritterRole, type Species } from '../../creatures/bestiary';
import { CritterFigure, CritterModel } from './critterView';
import type { GroundAt, RigInput } from './critterRig';

const SAMPLER: readonly CritterRole[] = ['scuttler', 'grazer', 'floater', 'watcher', 'giant', 'hunter', 'lurker', 'swarmer', 'brute'];

/** The action a species shows off. */
export function showAction(sp: Species): string {
  if (sp.peaceful) return sp.plan === 'floater' ? 'flinch' : 'rear';
  if (sp.tail.tip === 'sting') return 'sting';
  if (sp.plan === 'crab') return 'pinch';
  if (sp.role === 'brute') return 'slam';
  if (sp.role === 'hunter') return 'lunge';
  return 'bite';
}

interface Place {
  readonly fig: CritterFigure;
  readonly sp: Species;
  readonly cx: number;
  readonly cz: number;
  readonly ring: number;
  readonly face: number;
  readonly offset: number;
  ang: number;
  inp: { -readonly [K in keyof RigInput]: RigInput[K] };
}

export class CritterLineup {
  readonly figures: CritterFigure[] = [];
  private readonly places: Place[] = [];

  /** `depth`: that level's bestiary; null: the sampler (`count` per role, strangeness rising along the row). */
  constructor(seed: number, depth: number | null, private readonly ground: GroundAt, count = 2) {
    const species: Species[] = depth !== null ? bestiaryOf(seed, depth)
      : SAMPLER.flatMap((role) => Array.from({ length: count }, (_, k) => grow(new Rng(deriveSeed(seed, 'critters', role, k)), role, 0.4 + k * 1.2, `${role}.${k}`)));
    for (const sp of species) this.figures.push(new CritterModel(sp).figure(ground));
  }

  get roots(): Object3D[] { return this.figures.map((f) => f.root); }

  /** Stand them in a row `ahead` metres before (x, z) along `yaw` (forward (-sin, -cos)), each facing back. */
  lineUp(x: number, z: number, yaw: number, ahead: number): void {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    const widths = this.figures.map((f) => Math.max(0.5, f.model.species.totalLength * 1.1 + 0.3));
    const total = widths.reduce((a, b) => a + b, 0);
    let along = -total / 2;
    ahead = Math.max(ahead, total * 0.6);
    this.places.length = 0;
    this.figures.forEach((fig, k) => {
      const sp = fig.model.species;
      along += widths[k] / 2;
      const back = ahead + sp.totalLength * 0.6;
      const cx = x + fx * back + rx * along, cz = z + fz * back + rz * along;
      along += widths[k] / 2;
      this.places.push({
        fig, sp, cx, cz, ring: Math.max(0.15, sp.totalLength * 0.45), face: yaw + Math.PI, offset: k * 1.7, ang: 0,
        inp: { x: cx, y: this.ground(cx, cz), z: cz, yaw: yaw, vx: 0, vz: 0, dead: false, action: '', actionT: 0, lookAt: null, running: false, time: 0, scale: 1 },
      });
    });
  }

  /** Walk, stand and act in turns; `eye` is the camera they watch. */
  parade(dt: number, time: number, eye: readonly [number, number, number]): void {
    for (const p of this.places) {
      const t = (time + p.offset) % 14;
      const i = p.inp;
      i.time = time;
      i.lookAt = null;
      i.action = '';
      i.vx = i.vz = 0;
      if (t < 7) {
        // A ring: forward is (-sin yaw, -cos yaw), going round anticlockwise.
        const speed = p.sp.walkSpeed * (t > 4 ? 1.8 : 1);
        i.running = t > 4 && t < 6.5;
        p.ang += (speed / p.ring) * dt;
        const tx = -Math.sin(p.ang), tz = Math.cos(p.ang);
        const nx = p.cx + Math.cos(p.ang) * p.ring - p.ring, nz = p.cz + Math.sin(p.ang) * p.ring;
        i.vx = (nx - i.x) / Math.max(dt, 1e-3); i.vz = (nz - i.z) / Math.max(dt, 1e-3);
        i.x = nx; i.z = nz;
        i.yaw = Math.atan2(-tx, -tz);
      } else {
        i.running = false;
        // Face the camera, turning slowly.
        const want = Math.atan2(-(eye[0] - i.x), -(eye[2] - i.z));
        let d = want - i.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        i.yaw += d * Math.min(1, dt * 2);
        i.lookAt = eye;
        if (t > 10 && t < 12) { i.action = showAction(p.sp); i.actionT = (t - 10) / 2; }
      }
      i.y = this.ground(i.x, i.z);
      p.fig.animate(i, dt, i.action === 'flinch' ? Math.max(0, 1 - i.actionT * 3) : 0);
    }
  }
}
