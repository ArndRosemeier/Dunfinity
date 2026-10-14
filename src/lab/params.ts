/** Level Lab URL options: `?seed=<text or number>&depth=<level>&pos=x,y,z&gl` (gl: force the WebGL 2 backend). */
import { hashString } from '@futuremagic/core';

export interface LabParams { seed: number; depth: number; pos: [number, number, number] | null; forceWebGL: boolean }

export function parseLabParams(search: string): LabParams {
  const q = new URLSearchParams(search);
  const s = q.get('seed') ?? '1';
  const seed = /^\d+$/.test(s) ? Number(s) >>> 0 : hashString(s);
  const depth = Math.max(1, Math.floor(Number(q.get('depth') ?? '1')) || 1);
  const p = (q.get('pos') ?? '').split(',').map(Number);
  const pos = p.length === 3 && p.every(Number.isFinite) ? (p as [number, number, number]) : null;
  return { seed, depth, pos, forceWebGL: q.has('gl') };
}
