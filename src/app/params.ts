/**
 * URL options for the game and the Level Lab (`?lab`): `?seed=<text or number>&depth=<level>&pos=x,y,z&look=yaw,pitch&color=<mode>&dark&light&gl&style=<id>&races[=<race>]&critters[=<depth or role>]&studio`
 * (look in degrees; color: rock, working or lod; dark: the Lab starts in headlamp darkness; light: the game starts lit; gl: force the WebGL 2 backend; style: every level of that one style but where one arrives, for trying a style out, src/gen/styles.ts; races: the Lab stands every race in a row before the view, or with a race id a man and a woman of it close up at eye height, src/render/humans/lineup.ts; critters: the Lab stands procedural creatures in a row, a sampler of every role, with a depth that level's bestiary, with a role three of it, src/render/creatures/critterLineup.ts; studio: with critters, the rock hidden and a plain floor under them).
 */
import { hashString } from '@futuremagic/core';
import { COLOR_MODES, type ColorMode } from '../gen/level';
import { NAMED_STYLES } from '../gen/styles';
import type { StyleId } from '../gen/style';

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
  /** Every level of this style (but where one arrives), or undefined for the bands' mixes. */
  style?: StyleId;
  /** Lab: every race side by side before the view ('' all of them, else that race close up), or null. */
  races: string | null;
  /** Lab: procedural creatures in a row ('' the sampler, else the bestiary of that depth), or null. */
  critters: string | null;
  /** Lab: the creatures on a plain floor, the rock hidden. */
  studio: boolean;
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
  const st = q.get('style') as StyleId | null;
  const style = st && NAMED_STYLES.includes(st) ? st : undefined;
  return { seed, depth, pos, look, color, dark: q.has('dark'), light: q.has('light'), forceWebGL: q.has('gl'), style, races: q.get('races'), critters: q.get('critters'), studio: q.has('studio') };
}

/**
 * Whether the game opens on the title screen: on a plain visit, or with `?title` (`&shot=<depth>` holds
 * on that depth's shot, for screenshots). A link that names
 * a seed, depth, place or style (a shared spot, a test view, the screenshot tools) goes straight in.
 */
export function titleWanted(search: string): boolean {
  const q = new URLSearchParams(search);
  return q.has('title') || !['seed', 'depth', 'pos', 'style'].some((k) => q.has(k));
}
