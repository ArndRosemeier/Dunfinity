/**
 * The debug menu's "Copy position": everything needed to come back to exactly where one stands (a
 * link with ?seed, ?depth, ?pos, ?look and ?style, which `parseViewParams` reads), and what the
 * level and the body say there, as a small block to paste into a report. And reading such a block
 * (or the bare link) back.
 */
import type { Level } from '../gen/level';
import type { Body } from '../world/traverse/body';
import type { Blockers } from '../world/blockers';
import { MOVE } from '../world/traverse/body';
import { parseViewParams, type ViewParams } from '../app/params';

/** Where the camera is: yaw and pitch (radians), its distance behind the nobody (0: first person). */
export interface CamState {
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
}

const deg = (r: number): string => ((r * 180) / Math.PI).toFixed(1);
const m = (v: number): string => v.toFixed(2);

/** The link back to (x, y, z) on `level` looking along the camera: `base` is the page's address without its query. */
export function positionLink(base: string, level: Level, body: Body, cam: CamState): string {
  const q = new URLSearchParams({ seed: String(level.seed), depth: String(level.depth), pos: [body.x, body.y, body.z].map((v) => v.toFixed(3)).join(','), look: `${deg(cam.yaw)},${deg(cam.pitch)}` });
  if (level.style) q.set('style', level.style);
  return `${base}?${q.toString().replace(/%2C/g, ',')}`;
}

/** The block to paste: the version, the link, and what the level and the body say at the nobody. */
export function positionReport(version: string, base: string, level: Level, body: Body, cam: CamState, blockers: Blockers | null): string {
  const { x, y, z } = body, f = level.field;
  const style = f.styles[f.regions.styleAt(x, z)], region = f.regions.regionAt(x, z);
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), waist = y + 0.9;
  const ahead = level.trace(x, waist, z, fx, 0, fz, 20);
  const r = MOVE.radius, lo = y + MOVE.stepOver, hi = y + MOVE.height;
  const blocked = (dx: number, dz: number) => !!blockers?.hits(x + dx, z + dz, r, lo, hi);
  return [
    `Dunfinity ${version} · position`,
    positionLink(base, level, body, cam),
    `seed ${level.seed} · level ${level.depth} (${level.band.name})${level.style ? ` · ?style=${level.style}` : ''} · style ${style.id} (region ${region.id})`,
    `feet ${m(x)} ${m(y)} ${m(z)} · facing ${deg(body.facing)}° · camera yaw ${deg(cam.yaw)}° pitch ${deg(cam.pitch)}° at ${m(cam.distance)} m`,
    `body ${body.mode}${body.grounded ? ', grounded' : ''}${body.ledge ? ', at a ledge' : ''} · velocity ${m(body.vx)} ${m(body.vy)} ${m(body.vz)} · health ${body.health.toFixed(0)} stamina ${body.stamina.toFixed(1)}`,
    `rock distance: feet ${m(level.sdf(x, y + 0.05, z))} waist ${m(level.sdf(x, waist, z))} head ${m(level.sdf(x, y + 1.6, z))} · rock ahead (camera) at ${ahead >= 20 ? '>20' : m(ahead)} m`,
    `floor ${m(level.floorAt(x, z))} ground ${m(level.groundAt(x, z))} water ${m(level.waterAt(x, z))} · climbable ahead ${level.climbable(x + fx * 0.5, waist, z + fz * 0.5)}`,
    `props in the way: here ${blocked(0, 0)} · 0.5 m ahead ${blocked(fx * 0.5, fz * 0.5)}`,
  ].join('\n');
}

/** The place in a pasted report or link (its first line holding a query), or null if there is none. */
export function readPosition(text: string): ViewParams | null {
  const q = /\?\S*\bpos=\S+/.exec(text)?.[0];
  if (!q) return null;
  const p = parseViewParams(q);
  return p.pos ? p : null;
}
