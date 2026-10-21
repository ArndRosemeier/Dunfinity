/**
 * Who the Actors figures are: seeded looks (the same seed, the same person), people of today in
 * their clothes and the other peoples (goblins, the peoples of the deep...) in what they are given.
 */
import { outfitGarments, randomConfig, seededRandom, type CharacterPatch } from '@actors/generator';
import type { RaceId } from '@actors/human';
import { folkCatalog, humanCatalog } from './pack';

/** Everyday outfits of today (Actors' outfit presets), for men and for women. */
const TODAY = {
  male: ['casual', 'polo', 'cargo', 'street', 'work', 'weekend', 'layers'],
  female: ['casual', 'layers', 'long-skirt', 'polo', 'casual-suit', 'sport', 'shift-dress'],
} as const;

/** Muted, everyday colours for clothes (sRGB). */
const EVERYDAY = ['#3a3f4a', '#5b6470', '#8b8e93', '#1f2a44', '#3566a8', '#2f6b45', '#5f6838', '#6b4a32', '#d2bd98', '#7a2e2e', '#e6e1d6', '#46505e'];

export interface PersonOptions {
  /** 0 young adult .. 1 old. */
  age: number;
  female: boolean;
  /** A figure in the distance: the plainer body (fewer triangles). */
  far?: boolean;
}

/** A person of today: body, face and hair from `seed`, dressed for an ordinary day. */
export async function personOfToday(seed: number, o: PersonOptions): Promise<CharacterPatch> {
  const { catalog, base } = await humanCatalog();
  const random = seededRandom(seed);
  const look = randomConfig(catalog, base, { random, gender: o.female ? 'female' : 'male', outfit: false });
  look.body.ageYears = Math.round(20 + Math.min(1, Math.max(0, o.age)) * 62);
  if (look.body.ageYears > 62 && random() < 0.8) look.hairColor = '#9a968f';
  const ids = o.female ? TODAY.female : TODAY.male;
  const preset = catalog.outfits.find((p) => p.id === ids[Math.floor(random() * ids.length)]) ?? catalog.outfits[0];
  const outfit = outfitGarments(preset, look.body);
  const garmentColors: Record<string, string> = { ...preset.colors };
  for (const g of outfit) if (random() < 0.6) garmentColors[g] = EVERYDAY[Math.floor(random() * EVERYDAY.length)];
  return { ...look, outfit, garmentColors, anatomy: false, detail: o.far ? 'low' : 'high', animation: null };
}

/** What one of another people wears: garments (Actors ids) and their colours (sRGB hex, by garment). */
export interface Dress {
  readonly outfit: readonly string[];
  readonly colors?: Readonly<Record<string, string>>;
}

export interface FolkOptions extends PersonOptions {
  /** Hair (an Actors hair id; null: none), if not the people's own by the seed. */
  hair?: string | null;
}

/** One of `race` (Actors' peoples): body, face, skin and hair from `seed`, in `dress`. */
export async function folkLook(race: RaceId, seed: number, o: FolkOptions, dress: Dress): Promise<CharacterPatch> {
  const { catalog, base } = await folkCatalog();
  const look = randomConfig(catalog, base, { random: seededRandom(seed), gender: o.female ? 'female' : 'male', outfit: false, race });
  look.body.ageYears = Math.round(20 + Math.min(1, Math.max(0, o.age)) * 62);
  if (o.hair !== undefined) look.hair = o.hair;
  return { ...look, outfit: [...dress.outfit], garmentColors: { ...dress.colors }, anatomy: false, detail: o.far ? 'low' : 'high', animation: null };
}

/** A colour of the game's (linear 0..1, like the props') as Actors takes it: sRGB hex. */
export function hexOf(c: readonly [number, number, number]): string {
  const ch = (v: number) => {
    const x = Math.min(1, Math.max(0, v));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0');
  };
  return `#${ch(c[0])}${ch(c[1])}${ch(c[2])}`;
}

/** A dress from garments and their colours (the game's, `hexOf`). */
export function dressOf(parts: readonly (readonly [string, readonly [number, number, number]])[]): Dress {
  return { outfit: parts.map(([g]) => g), colors: Object.fromEntries(parts.map(([g, c]) => [g, hexOf(c)])) };
}
