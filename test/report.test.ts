import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { AIRING, PACE, REPORT, linesOf, onAir, shotSeconds, shotStart, voiceOf } from '../src/lore/report';

test('every still of the report and the set it plays on are painted', () => {
  for (const id of new Set([...REPORT.map((s) => s.still).filter(Boolean), 'set'])) assert.ok(existsSync(`public/report/${id}.webp`), `public/report/${id}.webp`);
});

test('the report opens on its card, gives each shot time to be read, and loops through snow', () => {
  assert.equal(REPORT[0].still, null);
  for (const s of REPORT) assert.ok(shotSeconds(s) >= s.caption.length / PACE.read, s.caption);
  assert.equal(onAir(0).shot, 0);
  assert.equal(onAir(AIRING - 1).shot, -1); // snow between airings
  assert.equal(onAir(AIRING + 0.5).shot, 0);
  for (let i = 0; i < REPORT.length; i++) assert.equal(onAir(shotStart(i) + 0.01).shot, i);
});

test('a caption shows in whole sentences, a line at a time, all of it in order', () => {
  for (const s of REPORT) {
    const lines = linesOf(s.caption);
    assert.equal(lines.join(' '), s.caption);
    for (const l of lines) assert.ok(l.length <= PACE.line || !l.slice(0, -1).match(/[.!?] /), l);
  }
  const i = 2, seen: string[] = [];
  for (let t = 0; t < shotSeconds(REPORT[i]); t += 0.1) {
    const { line } = onAir(shotStart(i) + t);
    if (seen.at(-1) !== line) seen.push(line);
  }
  assert.deepEqual(seen, linesOf(REPORT[i].caption));
});

test('the presenter speaks each voiced line as it comes up, and only then', () => {
  const sounds = JSON.parse(readFileSync('public/sounds/manifest.json', 'utf8'));
  const heard: string[] = [];
  let last = '';
  for (let t = 0; t < AIRING; t += 0.05) {
    const air = onAir(t), key = `${air.shot}:${air.line}`;
    if (key !== last) { const v = voiceOf(air); if (v) heard.push(v); }
    last = key;
  }
  const voiced = REPORT.filter((s) => s.voice).map((s) => s.voice!.id);
  assert.deepEqual(heard, voiced);
  for (const id of voiced) assert.ok(sounds[id], `${id} in the sound manifest`);
});
