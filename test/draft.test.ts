import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftLine } from '../src/game/draft';

test('the draft says where the shaft is, from where the camera looks', () => {
  // yaw 0 looks along -z.
  assert.equal(draftLine(0, 0, 0, 0, -100), 'A cold draft from ahead.');
  assert.equal(draftLine(0, 0, 0, 100, 0), 'A cold draft from the right.');
  assert.equal(draftLine(0, 0, 0, -300, 0), 'A faint draft from the left.');
  assert.equal(draftLine(0, 0, 0, 0, 300), 'A faint draft from behind.');
  assert.equal(draftLine(0, 0, 0, 100, -100), 'A cold draft from ahead-right.');
  // Turned round (yaw π looks along +z), the same shaft is behind.
  assert.equal(draftLine(0, 0, Math.PI, 0, -100), 'A cold draft from behind.');
});

test('no draft far away; at the rim the air rises', () => {
  assert.equal(draftLine(0, 0, 0, 0, -700), null);
  assert.equal(draftLine(0, 0, 0, 3, 0), 'Cold air rises from the shaft.');
});
