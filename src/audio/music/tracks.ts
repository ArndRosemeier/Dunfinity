/**
 * The pieces of the score (Lyria 3 Pro, made and built by tools/audio/music.py into
 * public/music/tracks, listed in public/music/tracks.json): which plays for which mood. Pure data.
 *
 * Calm moods stream one piece (an MP3, played once); the danger moods loop a bar-true cut (Ogg,
 * decoded and looped sample-exact). Where a mood has two pieces, they take turns.
 */
import type { Mood } from './mood';

export const MOOD_TRACKS: Record<Mood, readonly string[]> = {
  town: ['town'],
  cellar: ['cellar'],
  quarry: ['quarry-1', 'quarry-2'],
  salt: ['salt'],
  cistern: ['cistern'],
  threshold: ['threshold'],
  fire: ['fire'],
  danger: ['danger-1', 'danger-2'],
  boss: ['boss'],
  death: ['death'],
};

export interface TrackInfo { file: string; kind: 'stream' | 'loop'; seconds: number }

/** Parse public/music/tracks.json (null when malformed). */
export function parseTracks(o: unknown): Record<string, TrackInfo> | null {
  const t = (o as { tracks?: Record<string, Partial<TrackInfo>> } | null)?.tracks;
  if (!t || typeof t !== 'object') return null;
  const out: Record<string, TrackInfo> = {};
  for (const [id, v] of Object.entries(t)) {
    if (typeof v?.file !== 'string' || (v.kind !== 'stream' && v.kind !== 'loop') || !(Number(v.seconds) > 0)) continue;
    out[id] = { file: v.file, kind: v.kind, seconds: Number(v.seconds) };
  }
  return out;
}
