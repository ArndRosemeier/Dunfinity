/**
 * What each graphics quality (src/persist/settings.ts) asks of the machine: how many pixels are drawn
 * (at most this many per CSS pixel, never more than the screen has), the headlamp's shadow map, and
 * how soon the rock far off is drawn coarser (the chunk tree's split). None of it changes a shader,
 * so a change applies at once without compiling anything (docs/SHADERS.md).
 */
import type { Quality } from '../persist/settings';
import { DEFAULT_VIEW } from '../world/chunks';

export interface QualityPreset {
  readonly pixels: number;
  readonly shadowMap: number;
  readonly split: number;
}

export const QUALITY: Readonly<Record<Quality, QualityPreset>> = {
  low: { pixels: 0.75, shadowMap: 512, split: 0.8 },
  medium: { pixels: 1, shadowMap: 1024, split: 0.95 },
  high: { pixels: 2, shadowMap: 1024, split: DEFAULT_VIEW.split },
};

/** How each quality is described in the settings. */
export const QUALITY_NOTES: Readonly<Record<Quality, string>> = {
  low: 'Fewer pixels, softer shadows, coarser rock far off. For older laptops.',
  medium: 'One pixel per screen point, a little less rock detail far off.',
  high: 'Sharp on high-DPI screens, full rock detail.',
};
