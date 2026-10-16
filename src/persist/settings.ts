/**
 * The player's settings, kept between visits for every seed: the sound (volumes, mute, music
 * switch), the keys and the graphics (quality, reduced motion). Reading never throws: a missing, blocked or broken
 * entry is the default, and a bad field in one is that field's default.
 */
export interface SoundSettings {
  /** Master volume 0…1. */
  readonly volume: number;
  /** Each category's volume 0…1, under the master. */
  readonly effects: number;
  readonly ambience: number;
  readonly musicVolume: number;
  readonly muted: boolean;
  /** Background music on. */
  readonly music: boolean;
}

export const SOUND_DEFAULTS: SoundSettings = { volume: 0.8, effects: 1, ambience: 1, musicVolume: 1, muted: false, music: true };

/** How much the graphics ask of the machine (src/render/quality.ts says what each means). */
export type Quality = 'low' | 'medium' | 'high';
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

export interface GraphicsSettings {
  readonly quality: Quality;
  /** Reduced motion: the interface keeps still (the `ui-still` class on the page). */
  readonly still: boolean;
}

export const GRAPHICS_DEFAULTS: GraphicsSettings = { quality: 'high', still: false };
/** A tablet's (a touch screen, no mouse) until the player picks: one pixel per screen point, as its GPU is a laptop's at best and its screen has twice the points. */
export const TABLET_GRAPHICS: GraphicsSettings = { quality: 'medium', still: false };

/** Keys the player moved: an action (the key it answers to by default) → the key it answers to now. */
export type KeySettings = Readonly<Record<string, string>>;

const unit = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const flag = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

export const readSoundSettings = (): SoundSettings => kept('sound', SOUND_DEFAULTS, (o) => ({
  volume: unit(o.volume, SOUND_DEFAULTS.volume),
  effects: unit(o.effects, SOUND_DEFAULTS.effects),
  ambience: unit(o.ambience, SOUND_DEFAULTS.ambience),
  musicVolume: unit(o.musicVolume, SOUND_DEFAULTS.musicVolume),
  muted: flag(o.muted, SOUND_DEFAULTS.muted),
  music: flag(o.music, SOUND_DEFAULTS.music),
}));
export const writeSoundSettings = (s: SoundSettings): void => keep('sound', s);

/** The graphics kept, or `defaults` for what was never set (`TABLET_GRAPHICS` on a tablet). */
export const readGraphicsSettings = (defaults = GRAPHICS_DEFAULTS): GraphicsSettings => kept('graphics', defaults, (o) => ({
  quality: QUALITIES.includes(o.quality as Quality) ? (o.quality as Quality) : defaults.quality,
  still: flag(o.still, defaults.still),
}));
export const writeGraphicsSettings = (s: GraphicsSettings): void => keep('graphics', s);

export const readKeySettings = (): KeySettings => kept<KeySettings>('keys', {}, (o) =>
  Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === 'string')));
export const writeKeySettings = (s: KeySettings): void => keep('keys', s);

function kept<T>(name: string, defaults: T, fix: (o: Record<string, unknown>) => T): T {
  try {
    const o: unknown = JSON.parse(localStorage.getItem(`dunfinity:${name}`) ?? '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? fix(o as Record<string, unknown>) : defaults;
  } catch {
    return defaults;
  }
}

function keep(name: string, value: unknown): void {
  try {
    localStorage.setItem(`dunfinity:${name}`, JSON.stringify(value));
  } catch {
    // (storage blocked: the setting lasts for this visit)
  }
}
