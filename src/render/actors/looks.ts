/**
 * Who the Actors figures are: seeded looks (the same seed, the same person) in clothes of today.
 */
import { outfitGarments, randomConfig, seededRandom, type CharacterPatch } from '@actors/generator';
import { humanCatalog } from './pack';

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
