/**
 * A level's light and air (docs/design/generative-depth.md §6.3): the colour of the fog and of the
 * ambient light from above and below, the headlamp's tint, how thick the air is and how strongly the
 * rock's seams glow. Ours in the town and the cellar; below, each level of 1–10 and each stratum deeper draws its own
 * from genes, and its laws (`tinted`, `haze`, `glow`, src/gen/laws.ts) push them all the way. All of it
 * reaches the renderer as uniforms and light colours (src/render/LevelView.ts): never a new shader.
 *
 * Pure: a function of (seed, depth).
 */
import { hexToRgb, hsl2rgb, mixRgb } from '@futuremagic/core';
import { bandOf } from './bands';
import { express, gene } from './genes';
import { lawsOf } from './laws';
import { strangeFrom, strangeness } from './genome';

type Rgb = [number, number, number];

export interface Air {
  /** The fog and the background behind it, sRGB 0–1 (as a hex colour would be). */
  readonly fog: Rgb;
  /** The ambient light from above and from below. */
  readonly sky: Rgb;
  readonly ground: Rgb;
  /** The headlamp's colour, and the burning lamps' flames. */
  readonly lamp: Rgb;
  readonly flame: Rgb;
  /** How far one sees: the fog's distances are multiplied by this (1: ours). */
  readonly clear: number;
  /** How strongly the rock's seams glow (`ROCK_VEINS`). */
  readonly veins: number;
}

/** Our air: what LevelView had before strata drew their own. */
const OURS = { fog: 0x050607, sky: 0x9aa6b4, ground: 0x2a2218, lamp: 0xfff0dc, flame: 0xffbe80 } as const;

/** The air's hue (0–1 round the wheel) and how much of it the light takes on (0: our grey-blue). */
const HUE = gene('air.hue', 0.6, [0.55, 0.65], [0, 1]);
const TINT = gene('air.tint', 0, [0, 0.15], [0, 0.7]);
/** The hue a `tinted` stratum's light takes: anywhere round the wheel. */
const LAW_HUE = gene('air.lawHue', 0.6, [0, 1], [0, 1]);
/** The headlamp's warmth: how much of the air's hue the lamp takes on too. */
const LAMP_TINT = gene('air.lampTint', 0, [0, 0.05], [0, 0.5]);
const CLEAR = gene('air.clear', 1, [0.85, 1.15], [0.35, 1.4]);
const GLOW = gene('air.glow', 0, [0, 0.2], [0, 1]);

export function airOf(seed: number, depth: number): Air {
  const band = bandOf(seed, depth);
  const laws = lawsOf(seed, depth);
  // A law's light is as strong as the stratum is strange: a tinge at the Ossuaries, a colour one names deeper.
  const law = Math.min(1, 0.5 + strangeness(seed, strangeFrom(depth)).amplitude / 4);
  const hue = laws.includes('tinted') ? express(LAW_HUE, seed, depth) : express(HUE, seed, depth);
  const tint = laws.includes('tinted') ? 0.85 * law : express(TINT, seed, depth);
  const lampTint = laws.includes('tinted') ? 0.6 * law : express(LAMP_TINT, seed, depth);
  const clear = laws.includes('haze') ? 0.4 : express(CLEAR, seed, depth);
  const glow = laws.includes('glow') ? 1 : express(GLOW, seed, depth);
  // A tinted stratum's light is a colour one can name: saturated, every light in it.
  const sat = laws.includes('tinted') ? 0.9 : 0.6;
  const tinted = (hex: number, l: number, t: number): Rgb => mixRgb(hexToRgb(hex), hsl2rgb(hue, sat, l), t);
  return {
    fog: tinted(OURS.fog, 0.03, tint),
    sky: tinted(OURS.sky, 0.6, tint),
    ground: tinted(OURS.ground, 0.15, tint),
    lamp: tinted(OURS.lamp, 0.72, lampTint),
    flame: tinted(OURS.flame, 0.62, laws.includes('tinted') ? 0.8 * law : lampTint),
    clear,
    veins: Math.max(band.veins, glow),
  };
}
