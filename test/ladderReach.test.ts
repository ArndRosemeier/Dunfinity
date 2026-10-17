import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR_SHAFT } from '../src/gen/cellar';
import { ladderOf, ladderTop, offersLadder, LADDER_REACH } from '../src/gen/descents';
import { rimWalk } from '../src/render/humans/ladderClimb';

const S = CELLAR_SHAFT;

test("the cellar shaft's ladder is offered anywhere round its rim, not only beside the ladder", () => {
  const cellar = new Level(1, 0);
  let floors = 0;
  for (let a = 0; a < 360; a += 10) for (const d of [S.r + 0.3, S.r + 0.9, S.r + 1.5]) {
    const x = S.x + Math.cos((a * Math.PI) / 180) * d, z = S.z + Math.sin((a * Math.PI) / 180) * d;
    if (cellar.sdf(x, 1, z) < 0.4) continue; // (rock: nobody stands there)
    floors++;
    assert.ok(offersLadder(S, x, cellar.groundAt(x, z), z, false), `offered at ${a}°, ${d.toFixed(1)} m`);
  }
  assert.ok(floors > 60, 'the chamber has floor all round the hole');
  // Coming out of the passage, the ladder is offered before one is at the hole.
  assert.ok(offersLadder(S, 13.3, 0, 0, false));
});

test('the offer holds a little farther out than it starts (no flicker), and is gone well away or off the floor level', () => {
  const edge = S.r + LADDER_REACH.rim + LADDER_REACH.hold / 2;
  assert.equal(offersLadder(S, S.x - edge, 0, S.z, false), false);
  assert.equal(offersLadder(S, S.x - edge, 0, S.z, true), true);
  assert.equal(offersLadder(S, S.x - 6, 0, S.z, true), false);
  assert.equal(offersLadder(S, S.x - S.r - 0.5, -3, S.z, true), false, 'not while down in the shaft');
  assert.equal(offersLadder(S, S.x, 0, S.z, true), false, 'not over the middle of the hole');
});

test('the walk to the ladder from the far side goes round the hole, never over it, and ends where one gets on', () => {
  const [lx, lz] = ladderTop(S);
  const p: [number, number] = [0, 0];
  for (const [x0, z0] of [[13.3, 0], [13.6, 0.4], [15, -2.2], [15, 2.3], [16.8, 0.5]]) {
    const len = rimWalk(x0, z0, lx, lz, [S.x, S.z, S.r], 0, p);
    assert.ok(len < 9, `a short walk round (${len.toFixed(1)} m)`);
    for (let f = 0; f <= 1; f += 0.02) {
      rimWalk(x0, z0, lx, lz, [S.x, S.z, S.r], f, p);
      assert.ok(Math.hypot(p[0] - S.x, p[1] - S.z) >= S.r + 0.4, `clear of the hole at ${f.toFixed(2)} from ${x0}, ${z0}`);
    }
    rimWalk(x0, z0, lx, lz, [S.x, S.z, S.r], 1, p);
    assert.ok(Math.hypot(p[0] - lx, p[1] - lz) < 0.05, 'ends at the top of the ladder');
  }
  // The ladder of the way down is on the far side from the passage: the walk round is the point.
  assert.ok(ladderOf(S).x > S.x);
});
