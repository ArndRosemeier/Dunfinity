import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '@futuremagic/core';
import { MoodDirector, MOOD_TUNING, type MusicSignals, type Mood } from '../src/audio/music/mood';
import { MOOD_TRACKS, parseTracks } from '../src/audio/music/tracks';

const calm: MusicSignals = { place: 'quarry', danger: false, boss: false, resting: false, dead: false };
const run = (d: MoodDirector, s: MusicSignals, secs: number): Mood | null => {
  let m: Mood | null = null;
  for (let t = 0; t < secs; t += 0.1) m = d.update(0.1, s).mood;
  return m;
};

test('calm music comes as an episode after a rest, of the place one is in', () => {
  const d = new MoodDirector(new Rng(1));
  assert.equal(run(d, calm, 1), null);
  assert.equal(run(d, calm, MOOD_TUNING.firstEpisode[1] + 1), 'quarry');
  d.endEpisode('quarry');
  assert.equal(run(d, calm, 5), null, 'rests after the piece');
});

test('danger comes in after a confirmation and stays through a short gap', () => {
  const d = new MoodDirector(new Rng(2));
  const danger = { ...calm, danger: true };
  assert.notEqual(d.update(0.1, danger).mood, 'danger', 'not on the first frame');
  assert.equal(run(d, danger, 2), 'danger');
  assert.equal(run(d, calm, MOOD_TUNING.dangerHold - 2), 'danger', 'held');
  assert.equal(run(d, calm, 4), null, 'then a rest');
});

test('the Foreman or the Tall One get the boss loop', () => {
  const d = new MoodDirector(new Rng(3));
  assert.equal(run(d, { ...calm, danger: true, boss: true }, 2), 'boss');
});

test('resting by a fire plays its piece once; death plays the elegy once', () => {
  const d = new MoodDirector(new Rng(4));
  assert.equal(run(d, { ...calm, resting: true }, 1), 'fire');
  assert.equal(run(d, calm, 1), null, 'gets up: the piece ends');
  assert.equal(run(d, { ...calm, dead: true }, 1), 'death');
  d.endEpisode('death');
  assert.equal(run(d, { ...calm, dead: true }, 3), null);
});

test('every mood has pieces, and the track list parses', () => {
  for (const [m, list] of Object.entries(MOOD_TRACKS)) assert.ok(list.length > 0, m);
  assert.deepEqual(parseTracks({ tracks: { a: { file: 'tracks/a.mp3', kind: 'stream', seconds: 3 }, b: { kind: 'x' } } }), { a: { file: 'tracks/a.mp3', kind: 'stream', seconds: 3 } });
  assert.equal(parseTracks(null), null);
});

test('every piece and every sound the game asks for is built', async () => {
  const { readFileSync } = await import('node:fs');
  const tracks = parseTracks(JSON.parse(readFileSync(new URL('../public/music/tracks.json', import.meta.url), 'utf8')))!;
  for (const list of Object.values(MOOD_TRACKS)) for (const id of list) assert.ok(tracks[id], `music ${id}`);
  const manifest = JSON.parse(readFileSync(new URL('../public/sounds/manifest.json', import.meta.url), 'utf8'));
  const ids = new Set<string>(['fire', 'amb_town', 'amb_town_day', 'amb_cellar', 'amb_quarry', 'amb_salt', 'amb_cistern', 'amb_threshold']);
  for (const f of ['../src/audio/gameSounds.ts', '../src/game/Game.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/\bplay\((?:[^'()]*\? )?'([a-z_]+)'(?: : '([a-z_]+)')?/g)) { ids.add(m[1]); if (m[2]) ids.add(m[2]); }
  }
  const { VOICES } = await import('../src/audio/gameSounds');
  for (const v of Object.values(VOICES)) {
    for (const e of Object.values(v.enter ?? {})) ids.add(e![0]);
    if (v.hurt) ids.add(v.hurt);
    if (v.die) ids.add(v.die);
    if (v.idle) ids.add(v.idle[1]);
  }
  assert.ok(ids.size > 25);
  for (const id of ids) assert.ok(manifest[id], `sound ${id}`);
});
