import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSES, townGround } from '../src/gen/town';
import { ridgeHeight } from '../src/gen/village';
import { BIRDS, BIRD_SEED, ROOF_TOP, birdAt, type Bird } from '../src/world/birds';
import { CHIMNEYS, chimneysOf } from '../src/gen/chimneys';
import { puffAt, type Puff } from '../src/world/smoke';
import { CAT, CAT_SEED, catAt, type Cat } from '../src/world/cat';
import { callableVillager, villagers } from '../src/world/villagers';

const aBird = (): Bird => ({ x: 0, y: 0, z: 0, yaw: 0, flap: 0, span: 1 });
const aPuff = (): Puff => ({ x: 0, y: 0, z: 0, size: 0, alpha: 0, shade: 1 });
const aCat = (): Cat => ({ x: 0, y: 0, z: 0, yaw: 0, pose: 'walk', gait: 0, sit: 0, jump: 0 });

test('the flock crosses the sky', () => {
  const a = aBird(), b = aBird();
  birdAt(7, 0, 0, a);
  birdAt(7, 0, 10, b);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 2, 'a bird has moved on in ten seconds');
  birdAt(7, 0, 3, a);
  birdAt(7, 0, 3, b);
  assert.deepEqual(a, b, 'the same seed and time give the same bird');
  assert.equal(BIRDS.count, BIRDS.flocks * BIRDS.each, 'three groups of four');
  const roof = Math.max(...HOUSES.map(ridgeHeight));
  assert.ok(Math.abs(ROOF_TOP - roof) < 1e-9, 'the roof line is the town\'s own');
  for (let k = 0; k < BIRDS.count; k++) {
    birdAt(BIRD_SEED, k, 0, a);
    assert.ok(a.y > roof, `bird ${k} above the roofs at ${a.y.toFixed(1)}`);
    birdAt(BIRD_SEED, k, 17, b);
    assert.ok(b.y > roof, `bird ${k} above the roofs later`);
  }
});

test('the smoke rises from the chimney', () => {
  assert.deepEqual(chimneysOf(1931), CHIMNEYS, 'the same seed picks the same chimneys');
  assert.equal(CHIMNEYS.length, 6, 'a seeded few of the town\'s houses smoke');
  assert.equal(CHIMNEYS[0].house, 0, 'grandma\'s house has one');
  for (const c of CHIMNEYS) {
    const p = aPuff();
    for (let k = 0; k < 6; k++) {
      puffAt(c, k, 0, p);
      assert.ok(Math.hypot(p.x - c.x, p.z - c.z) < 0.3, `puff ${k} starts at the mouth (${c.house})`);
      assert.ok(Math.abs(p.y - c.mouth) < 0.3, 'and at its height');
    }
    puffAt(c, 0, 1, p);
    const y1 = p.y;
    puffAt(c, 0, 3, p);
    assert.ok(p.y > y1 + 1, `the plume is higher two seconds on (${c.house})`);
    assert.ok(p.alpha < 0.62 && p.alpha > 0, 'and fading with height');
  }
});

test('the cat walks its wall', () => {
  const a = aCat(), b = aCat();
  let sits = 0, jumps = 0, onWall = 0;
  for (let t = 0; t < 40; t += 0.25) {
    catAt(CAT_SEED, t, a);
    const ground = townGround(a.x, a.z).y;
    assert.ok(a.y >= ground - 0.01, `above the ground at t ${t}`);
    if (a.pose === 'sit') sits++;
    if (a.pose === 'jump') jumps++;
    if (a.pose !== 'jump') {
      const wallLine = Math.abs(a.x - CAT.wall.x) < 1e-9, groundLine = Math.abs(a.x - CAT.ground.x) < 1e-9;
      assert.ok(wallLine || groundLine, `on the wall's line or the street's at t ${t}`);
      if (wallLine) {
        onWall++;
        assert.ok(Math.abs(a.y - CAT.wall.top) < 1e-9, 'its feet on the wall');
        assert.ok(a.z >= CAT.wall.z0 - 1e-9 && a.z <= CAT.wall.z1 + 1e-9, 'within the wall');
        assert.ok(a.y > ground + 0.4, 'a wall above the street, not the street');
      }
    }
  }
  assert.ok(sits > 0 && jumps > 0 && onWall > 0, `it walks (${onWall}), sits (${sits}) and jumps (${jumps})`);
  catAt(CAT_SEED, 5, a);
  catAt(CAT_SEED, 5, b);
  assert.deepEqual(a, b, 'the same seed and time give the same cat');
  catAt(CAT_SEED + 1, 5, b);
  assert.notDeepEqual(a, b, 'another seed starts it elsewhere');
});

test('a villager greets you once', () => {
  const v = villagers()[0];
  assert.equal(v.acknowledge(0, v.x + 10, v.y, v.z), null, 'nothing from far off');
  const first = v.acknowledge(1, v.x + 1, v.y, v.z);
  assert.equal(first, v.greeting, 'the line that is theirs');
  assert.equal(v.acknowledge(2, v.x + 1, v.y, v.z), null, 'not twice in a row');
  assert.equal(v.acknowledge(3, v.x + 4, v.y, v.z), null, 'still not, a few steps off');
  assert.equal(v.acknowledge(4, v.x + 9, v.y, v.z), null, 'going well away re-arms them');
  const again = v.acknowledge(5, v.x + 1, v.y, v.z);
  assert.equal(again, first, 'returning earns one more, the same one');
  assert.equal(v.acknowledge(6, v.x + 1, v.y, v.z), null, 'and never two in a row');
});

test('you can call on a villager', () => {
  const all = villagers(), callers = all.filter((v) => v.talks);
  assert.ok(callers.length >= 4 && callers.length <= 6, `a few callers: ${callers.length}`);
  const v = callers[0], line = v.talk(1);
  assert.equal(line, v.line, 'their own line');
  assert.equal(v.talk(2), line, 'the same line every time');
  const i = all.indexOf(v), again = villagers()[i];
  assert.equal(again.line, line, 'and the same every game');
  assert.equal(again.greeting, v.greeting, 'the greeting too');
  assert.ok(v.canHear(v.x + 1.5, v.y, v.z), 'within reach');
  assert.ok(!v.canHear(v.x + 3, v.y, v.z), 'beyond it');
  assert.equal(callableVillager([v], v.x + 1, v.y, v.z), v, 'the nearest in reach');
  assert.equal(callableVillager([v], v.x + 5, v.y, v.z), null, 'nothing when none is near');
  const quiet = all.find((x) => !x.talks)!;
  assert.equal(callableVillager([quiet], quiet.x + 0.5, quiet.y, quiet.z), null, 'only the talkers answer');
  const other = callers[1];
  other.x = v.x + 1.2; other.z = v.z;
  assert.equal(callableVillager([v, other], v.x + 1, v.y, v.z), other, 'the nearer of two');
});
