/**
 * URL options for the game and the Level Lab (`?lab`): `?seed=<text or number>&depth=<level>&pos=x,y,z&look=yaw,pitch&color=<mode>&dark&light&gl`
 * (look in degrees; color: rock, working or lod; dark: the Lab starts in headlamp darkness; light: the game starts lit; gl: force the WebGL 2 backend).
 */
import { hashString } from '@futuremagic/core';
import { COLOR_MODES, type ColorMode } from '../gen/level';

export interface ViewParams {
  seed: number;
  depth: number;
  pos: [number, number, number] | null;
  /** Yaw and pitch in degrees. */
  look: [number, number] | null;
  color: ColorMode;
  /** Lab: start dark (headlamp fog, dim ambient light). */
  dark: boolean;
  /** Game: start in the lit survey view instead of the dark. */
  light: boolean;
  forceWebGL: boolean;
}

export function parseViewParams(search: string): ViewParams {
  const q = new URLSearchParams(search);
  const s = q.get('seed') ?? '1';
  const seed = /^\d+$/.test(s) ? Number(s) >>> 0 : hashString(s);
  const depth = Math.max(0, Math.floor(Number(q.get('depth') ?? '0')) || 0); // 0: grandma's cellar
  const p = (q.get('pos') ?? '').split(',').map(Number);
  const pos = p.length === 3 && p.every(Number.isFinite) ? (p as [number, number, number]) : null;
  const l = (q.get('look') ?? '').split(',').map(Number);
  const look = l.length === 2 && l.every(Number.isFinite) ? (l as [number, number]) : null;
  const c = q.get('color') as ColorMode | null;
  const color = c && COLOR_MODES.includes(c) ? c : 'rock';
  return { seed, depth, pos, look, color, dark: q.has('dark'), light: q.has('light'), forceWebGL: q.has('gl') };
}
