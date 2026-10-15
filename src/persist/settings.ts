/**
 * The player's settings, kept between visits for every seed: the sound's volume, mute and music
 * switch. Reading never throws: a missing, blocked or broken entry is the default.
 */
export interface SoundSettings {
  /** Master volume 0…1. */
  readonly volume: number;
  readonly muted: boolean;
  /** Background music on. */
  readonly music: boolean;
}

export const SOUND_DEFAULTS: SoundSettings = { volume: 0.8, muted: false, music: true };

const KEY = 'dunfinity:sound';

export function readSoundSettings(): SoundSettings {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SoundSettings>;
    return {
      volume: Number.isFinite(o.volume) ? Math.max(0, Math.min(1, o.volume!)) : SOUND_DEFAULTS.volume,
      muted: typeof o.muted === 'boolean' ? o.muted : SOUND_DEFAULTS.muted,
      music: typeof o.music === 'boolean' ? o.music : SOUND_DEFAULTS.music,
    };
  } catch {
    return SOUND_DEFAULTS;
  }
}

export function writeSoundSettings(s: SoundSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // (storage blocked: the setting lasts for this visit)
  }
}
