import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Rng } from '@futuremagic/core';
import { bedsOf, ChurchBell, TOWER_BELL, TownBirds, TOWN_BIRDS, type BirdCall } from '../src/audio/gameSounds';
import { MOOD_TRACKS, parseTracks } from '../src/audio/music/tracks';
import { HOUSES } from '../src/gen/town';

/** The beds of a map that are on (the others fading out). */
const on = (beds: Record<string, number>): string[] => Object.entries(beds).filter(([, level]) => level > 0).map(([id]) => id);

test("the town's bed is the day bed", () => {
  assert.deepEqual(on(bedsOf('town', false)), ['amb_town_day'], 'the town by day');
  assert.deepEqual(on(bedsOf('town', true)), ['amb_town'], 'the town at night');
  assert.deepEqual(on(bedsOf('cellar', false)), ['amb_cellar'], 'the cellar');
  assert.deepEqual(on(bedsOf('cellar', true)), ['amb_cellar'], 'the cellar is the cellar by night too');
  assert.equal(bedsOf('town', false).amb_town, 0, 'the night bed fades out by day');
  assert.equal(bedsOf('town', true).amb_town_day, 0, 'nothing of the day plays at night');
});

test('birds sing over the town', () => {
  const birds = new TownBirds(new Rng(7));
  const ear = { x: -20, y: 4.4, z: 0 };
  const ground = (): number => 2.7;
  assert.ok(birds.due >= TOWN_BIRDS.every[0] && birds.due <= TOWN_BIRDS.every[1], 'the first call is 5–13 s off');
  // In the cellar, and at night, nothing calls however long one listens.
  for (let i = 0; i < 600; i++) assert.equal(birds.nextCall(0.1, false, ear, ground), null);
  const wait = birds.due;
  let t = 0, call: BirdCall | null = null;
  for (; !call && t < 20; t += 0.1) call = birds.nextCall(0.1, true, ear, ground);
  assert.ok(call, 'a call comes in the town by day');
  assert.ok(t >= wait && t <= wait + 0.1, `the next call lands within 5–13 s (${t.toFixed(2)})`);
  const d = Math.hypot(call.x - ear.x, call.z - ear.z);
  assert.ok(d >= TOWN_BIRDS.away[0] && d <= TOWN_BIRDS.away[1], `8–20 m from the ear (${d.toFixed(2)})`);
  assert.ok(call.y > ground(), `above the town's ground (${call.y.toFixed(2)})`);
  assert.ok(call.variant >= 0 && call.variant <= 2, 'one of the takes');
  assert.ok(birds.due >= TOWN_BIRDS.every[0] && birds.due <= TOWN_BIRDS.every[1], 'and again 5–13 s after it');
});

test('the bell rings coming up', () => {
  const tower = HOUSES.find((h) => h.kind === 'tower');
  assert.ok(tower, 'the town has a church tower');
  assert.deepEqual(TOWER_BELL, { x: tower.cx, y: tower.eaves, z: tower.cz }, 'the bell hangs in the tower');

  const bell = new ChurchBell();
  assert.equal(bell.ring(0), false, 'not on the first frame at depth 0');
  assert.equal(bell.ring(1), false, 'not going down');
  assert.equal(bell.ring(0), true, 'one bell as one comes up from level 1');
  assert.equal(bell.ring(0), false, 'and not again on the frame after');
  assert.equal(bell.ring(2), false, 'not going down deeper');
  assert.equal(bell.ring(0), true, 'one bell the next time one comes up');
});

test('every file the manifest names is on disk', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/sounds/manifest.json', import.meta.url), 'utf8')) as Record<string, { files: string[] }>;
  let n = 0;
  for (const [id, entry] of Object.entries(manifest)) {
    for (const file of entry.files) {
      assert.ok(existsSync(new URL(`../public/sounds/${file}`, import.meta.url)), `sound ${id} names sounds/${file}, which is missing`);
      n++;
    }
  }
  assert.ok(n > 60, 'the manifest names the game’s sounds');
});

test("the day song is one of the town's pieces", () => {
  assert.ok(MOOD_TRACKS.town.includes('town-day'), "the town's pieces take turns");
  const tracks = parseTracks(JSON.parse(readFileSync(new URL('../public/music/tracks.json', import.meta.url), 'utf8')));
  assert.ok(tracks, 'the track list parses');
  const day = tracks['town-day'];
  assert.ok(day, 'tracks.json lists town-day');
  assert.equal(day.kind, 'stream');
  assert.ok(day.seconds > 0, 'a positive length');
  assert.equal(day.file, 'tracks/town-day.mp3');
  assert.ok(existsSync(new URL('../public/music/tracks/town-day.mp3', import.meta.url)), 'the piece is on disk');
});
