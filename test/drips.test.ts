import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { DRIP, DRIP_CYCLE, dripLook, heard, landed, tipOf, type DripLook, type DripSite } from '../src/gen/drips';

const look = (): DripLook => ({ height: 0, radius: 0, sunk: 0, drip: 0, wet: 0, t: 0 });

function sitesOf(seed: number, depth: number): DripSite[] {
  const l = new Level(seed, depth), [x, , z] = l.arrival;
  return l.drips.near(x, z, 160);
}

test('a few living stalagmites on every level below the cellar, the same for a seed', () => {
  for (const d of [1, 3, 6, 9]) {
    const a = sitesOf(1, d), b = sitesOf(1, d);
    assert.ok(a.length >= 3, `level ${d}: ${a.length} sites`);
    assert.deepEqual(a, b);
  }
  assert.equal(new Level(1, 0).drips.near(0, 0, 200).length, 0, 'none in grandma\'s cellar or the town');
});

test('a site stands on flat dry floor with room round it and the roof above', () => {
  const l = new Level(1, 3);
  for (const s of l.drips.near(l.arrival[0], l.arrival[2], 160)) {
    assert.ok(l.dry(s.x, s.z, 0.05), 'out of the water');
    for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) assert.ok(Math.abs(l.groundAt(s.x + dx, s.z + dz) - s.y) < 0.2, 'flat round it');
    assert.ok(l.sdf(s.x, s.y + 1, s.z) > 0.8, 'air where it grows');
    assert.ok(s.roof - s.y >= DRIP.roof[0] && s.roof - s.y <= DRIP.roof[1] + 0.6, 'a roof to drip from');
    assert.ok(l.sdf(s.x, s.roof + 0.3, s.z) < 0.2, 'the roof is rock');
    assert.ok(s.height < s.roof - s.y - 1, 'it never reaches the stalactite');
  }
});

test('the cycle: it drips and grows, stands, sinks into the floor, rests, and starts again, without a jump', () => {
  const s = sitesOf(1, 3)[0], l = look();
  const at = (t: number) => ({ ...dripLook(s, t - s.offset, l) });
  assert.equal(at(0).height, 0);
  assert.ok(at(1).drip > 0 && at(DRIP.grow / 2).drip === 1, 'drips while it grows');
  assert.ok(Math.abs(at(DRIP.grow).height - s.height) < 1e-6, 'full height when the dripping stops');
  assert.equal(at(DRIP.grow + 1).drip, 0);
  assert.ok(tipOf(at(DRIP.grow + DRIP.stand + DRIP.sink)) < -0.05, 'sunk away under the floor');
  assert.ok(at(DRIP.grow + 1).wet > 0.5 && at(DRIP.grow + DRIP.stand + 10).wet === 0, 'dries off');
  let last = at(0);
  for (let t = 0.05; t < DRIP_CYCLE * 2; t += 0.05) {
    const now = at(t), wrap = Math.abs(t % DRIP_CYCLE) < 0.06;
    if (!wrap) {
      assert.ok(Math.abs(tipOf(now) - tipOf(last)) < 0.01 && Math.abs(now.radius - last.radius) < 0.01, `smooth at ${t.toFixed(2)}`);
      if (now.t <= DRIP.grow) assert.ok(now.height >= last.height, 'only grows while it drips');
      else if (last.t >= DRIP.grow) assert.ok(tipOf(now) <= tipOf(last) + 1e-9, `only sinks after (${t.toFixed(2)}: ${tipOf(last)} -> ${tipOf(now)})`);
    }
    last = now;
  }
});

test('drops land a gap apart while it drips, and none while it rests', () => {
  const s = sitesOf(1, 3)[0], l = look();
  let drops = 0;
  for (let t = 0; t < DRIP_CYCLE; t += 1 / 60) drops += heard(s, t - s.offset, t + 1 / 60 - s.offset, l);
  const want = DRIP.grow / DRIP.gap;
  assert.ok(Math.abs(drops - want) < 6, `${drops} drops in a cycle, about ${want}`);
  dripLook(s, DRIP.grow / 2 - s.offset, l);
  assert.equal(landed(s, l, 10, 10 + DRIP.drops * DRIP.gap * 4), DRIP.drops * 4, 'every drop lands once a round');
});
