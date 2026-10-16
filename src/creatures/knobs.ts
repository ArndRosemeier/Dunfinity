/**
 * A species' genome as knobs (the debug menu's creature maker, Arnd 2026-10-16): the values a
 * species is grown from, each with its range, to read off a grown species and to set by hand. `tune`
 * applies them and settles what follows from them (mass, speeds, length: `settle`), so a hand-made
 * creature is still a believable one: thick legs stay thick for its weight only if you leave them.
 *
 * Pure: species in, species out.
 */
import { clamp, hsl2rgb } from '@futuremagic/core';
import { rgbHue, settle, type Rgb, type Species } from './bestiary';

export interface Knob {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  /** Whole numbers only. */
  readonly whole?: boolean;
  get(sp: Species): number;
  /** The species with this knob at `v` (not yet settled). */
  set(sp: Species, v: number): Species;
}

const knob = (key: string, label: string, min: number, max: number, get: (sp: Species) => number, set: (sp: Species, v: number) => Species, whole = false): Knob => ({ key, label, min, max, whole, get, set });

/** The colour turned by `turn` of the colour wheel, keeping its lightness and saturation. */
function turned(c: Rgb, turn: number): Rgb {
  const mx = Math.max(...c), mn = Math.min(...c), l = (mx + mn) / 2, d = mx - mn;
  const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return hsl2rgb((rgbHue(c) + turn + 1) % 1, clamp(s, 0, 1), l);
}

export const KNOBS: readonly Knob[] = [
  knob('length', 'Torso length (m)', 0.08, 4.5, (s) => s.length, (s, v) => ({ ...s, length: v })),
  knob('girth', 'Girth', 0.05, 0.6, (s) => s.girth, (s, v) => ({ ...s, girth: v })),
  knob('width', 'Body width', 0.5, 2, (s) => s.bodyWidth, (s, v) => ({ ...s, bodyWidth: v })),
  knob('height', 'Body height', 0.3, 1.4, (s) => s.bodyHeight, (s, v) => ({ ...s, bodyHeight: v })),
  knob('chest', 'Chest', 0.6, 1.4, (s) => s.chest, (s, v) => ({ ...s, chest: v })),
  knob('arch', 'Spine arch', -0.2, 0.6, (s) => s.spineArch, (s, v) => ({ ...s, spineArch: v })),
  knob('chunky', 'Soft .. hard-edged', 0, 1, (s) => s.chunky, (s, v) => ({ ...s, chunky: v })),
  knob('legLength', 'Leg length', 0, 2.5, (s) => s.limbs.length, (s, v) => ({ ...s, limbs: { ...s.limbs, length: v } })),
  knob('legThickness', 'Leg thickness', 0.03, 0.5, (s) => s.limbs.thickness, (s, v) => ({ ...s, limbs: { ...s.limbs, thickness: v } })),
  knob('splay', 'Leg sprawl', 0, 1, (s) => s.limbs.splay, (s, v) => ({ ...s, limbs: { ...s.limbs, splay: v } })),
  knob('hind', 'Hind to front legs', 0.8, 1.6, (s) => s.limbs.hindRatio, (s, v) => ({ ...s, limbs: { ...s.limbs, hindRatio: v } })),
  knob('neck', 'Neck length', 0.04, 1.6, (s) => s.neckLen, (s, v) => ({ ...s, neckLen: v })),
  knob('neckRaise', 'Neck raised', -0.2, 1.2, (s) => s.neckRaise, (s, v) => ({ ...s, neckRaise: v })),
  // Stars and drifters have no head; anything else keeps one.
  knob('head', 'Head size', 0, 0.5, (s) => s.head.size, (s, v) => ({ ...s, head: { ...s.head, size: s.plan === 'radial' || s.plan === 'floater' ? 0 : Math.max(0.08, v) } })),
  knob('snout', 'Snout', 0, 1.8, (s) => s.head.snout, (s, v) => ({ ...s, head: { ...s.head, snout: v } })),
  knob('eyes', 'Eyes', 0, 8, (s) => s.head.eyes, (s, v) => ({ ...s, head: { ...s.head, eyes: v } }), true),
  knob('eyeSize', 'Eye size', 0.5, 2, (s) => s.head.eyeSize, (s, v) => ({ ...s, head: { ...s.head, eyeSize: v } })),
  knob('stalks', 'Eye stalks', 0, 1.4, (s) => s.head.stalks, (s, v) => ({ ...s, head: { ...s.head, stalks: v } })),
  knob('antennae', 'Feelers', 0, 1.2, (s) => s.head.antennae, (s, v) => ({ ...s, head: { ...s.head, antennae: v } })),
  knob('horns', 'Horns', 0, 4, (s) => s.head.horns, (s, v) => ({ ...s, head: { ...s.head, horns: v === 3 ? 4 : v, hornLen: v && !s.head.hornLen ? 0.8 : s.head.hornLen } }), true),
  knob('hornLen', 'Horn length', 0, 1.8, (s) => s.head.hornLen, (s, v) => ({ ...s, head: { ...s.head, hornLen: v } })),
  knob('ears', 'Ears', 0, 1.6, (s) => s.head.ears, (s, v) => ({ ...s, head: { ...s.head, ears: v } })),
  knob('tail', 'Tail length', 0, 2.5, (s) => s.tail.length, (s, v) => ({ ...s, tail: { ...s.tail, length: v } })),
  knob('tailCurl', 'Tail curl', -0.3, 1.8, (s) => s.tail.curl, (s, v) => ({ ...s, tail: { ...s.tail, curl: v } })),
  knob('spikes', 'Back spikes', 0, 9, (s) => s.dorsal.spikes, (s, v) => ({ ...s, dorsal: { ...s.dorsal, spikes: v } }), true),
  knob('shell', 'Shell', 0, 1, (s) => s.dorsal.shell, (s, v) => ({ ...s, dorsal: { ...s.dorsal, shell: v } })),
  knob('arms', 'Arms (stars, drifters)', 0, 12, (s) => s.arms, (s, v) => ({ ...s, arms: v }), true),
  knob('armLen', 'Arm length', 0, 2.6, (s) => s.armLen, (s, v) => ({ ...s, armLen: v })),
  knob('hue', 'Hue turned', 0, 1, () => 0, (s, v) => ({ ...s, colors: { ...s.colors, base: turned(s.colors.base, v), secondary: turned(s.colors.secondary, v), accent: turned(s.colors.accent, v) } })),
  knob('pattern', 'Pattern contrast', 0, 1, (s) => s.colors.patternContrast, (s, v) => ({ ...s, colors: { ...s.colors, patternContrast: v } })),
  knob('glow', 'Glow', 0, 1, (s) => s.colors.glowAmount, (s, v) => ({ ...s, colors: { ...s.colors, glowAmount: v } })),
  knob('translucent', 'See-through skin', 0, 1, (s) => s.colors.translucent, (s, v) => ({ ...s, colors: { ...s.colors, translucent: v } })),
];

/** Each knob's value on `sp`. */
export function knobsOf(sp: Species): Record<string, number> {
  return Object.fromEntries(KNOBS.map((k) => [k.key, k.get(sp)]));
}

/** `sp` with the knobs in `values` set (the rest as grown), settled. */
export function tune(sp: Species, values: Readonly<Record<string, number>>): Species {
  let out = sp;
  for (const k of KNOBS) {
    const v = values[k.key];
    if (v === undefined || v === k.get(sp)) continue;
    const c = clamp(v, k.min, k.max);
    out = k.set(out, k.whole ? Math.round(c) : c);
  }
  return settle(out);
}
