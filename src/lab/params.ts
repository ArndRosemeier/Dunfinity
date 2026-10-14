/**
 * Level Lab URL options: `?seed=<text or number>&depth=<level>&pos=x,y,z&look=yaw,pitch&color=<mode>&gl`
 * (look in degrees; color: rock, working or lod; gl: force the WebGL 2 backend).
 */
import { hashString } from '@futuremagic/core';
import { COLOR_MODES, type ColorMode } from '../gen/level';

export interface LabParams {
  seed: number;
  depth: number;
  pos: [number, number, number] | null;
  /** Yaw and pitch in degrees. */
  look: [number, number] | null;
  color: ColorMode;
  forceWebGL: boolean;
}

export function parseLabParams(search: string): LabParams {
  const q = new URLSearchParams(search);
  const s = q.get('seed') ?? '1';
  const seed = /^\d+$/.test(s) ? Number(s) >>> 0 : hashString(s);
  const depth = Math.max(1, Math.floor(Number(q.get('depth') ?? '1')) || 1);
  const p = (q.get('pos') ?? '').split(',').map(Number);
  const pos = p.length === 3 && p.every(Number.isFinite) ? (p as [number, number, number]) : null;
  const l = (q.get('look') ?? '').split(',').map(Number);
  const look = l.length === 2 && l.every(Number.isFinite) ? (l as [number, number]) : null;
  const c = q.get('color') as ColorMode | null;
  const color = c && COLOR_MODES.includes(c) ? c : 'rock';
  return { seed, depth, pos, look, color, forceWebGL: q.has('gl') };
}
