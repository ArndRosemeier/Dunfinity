import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kept, Prepared } from '../src/render/prepared';
import { chunkKey } from '../src/world/chunks';

test('what is kept stays up to its budget; the oldest used go first', () => {
  const kept = new Kept<number>(100);
  for (let i = 0; i < 5; i++) kept.set(`k${i}`, i, 30);
  assert.equal(kept.get('k0'), undefined, 'the oldest went');
  assert.equal(kept.get('k1'), undefined);
  assert.equal(kept.get('k2'), 2, 'the newest three stay');
  kept.set('k5', 5, 30); // k2 was just read: k3 goes
  assert.equal(kept.get('k3'), undefined);
  assert.equal(kept.get('k2'), 2);
  assert.equal(kept.get('k4'), 4);
});

test('a chunk or tile kept for one level is found for that level only', () => {
  const p = new Prepared(), a = { seed: 1, depth: 3 }, b = { seed: 1, depth: 4 }, k = chunkKey(0, 1, 0, 2);
  const mesh = { positions: new Float32Array(9), normals: new Float32Array(9), indices: new Uint32Array(3), colors: new Float32Array(9), surfaces: new Float32Array(12) };
  p.keepChunk(a, k, 'rock', mesh);
  p.keepChunk(a, chunkKey(0, 2, 0, 2), 'rock', null);
  assert.equal(p.chunk(a, k, 'rock'), mesh);
  assert.equal(p.chunk(a, chunkKey(0, 2, 0, 2), 'rock'), null, 'known empty');
  assert.equal(p.chunk(b, k, 'rock'), undefined, 'not for another level');
  assert.equal(p.chunk(a, k, 'lod'), undefined, 'not in another colour mode');
  assert.equal(p.tile(a, 0, 0), undefined);
});
