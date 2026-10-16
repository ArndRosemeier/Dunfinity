import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { PROP_TILE, quarryProps } from '../src/gen/quarryProps';
import { SHED, inFrame, shedPoint } from '../src/gen/sheds';
import { Blockers } from '../src/world/blockers';
import { DOOR, Doors } from '../src/world/doors';
import { Body, MOVE } from '../src/world/traverse/body';
import { Campfire } from '../src/world/fire';
import { Finds } from '../src/loot/finds';
import { Rats } from '../src/creatures/rats';
import { noticed } from '../src/combat/combat';

const level = new Level(1, 1);
const [sx, , sz] = level.spawn();
const shed = level.sheds.standingIn(sx - 200, sz - 200, sx + 200, sz + 200)[0];
const tile = (x: number, z: number) => [Math.floor(x / PROP_TILE), Math.floor(z / PROP_TILE)] as const;

/** The props round the shed in the way, and its door hung. */
function world(): { blockers: Blockers; doors: Doors } {
  const blockers = new Blockers(), [tx, tz] = tile(shed.x, shed.z);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) blockers.set(`${tx + i},${tz + j}`, quarryProps(level, tx + i, tz + j).blockers);
  const doors = new Doors([]);
  doors.meet(level.sheds.standingIn(shed.x - 100, shed.z - 100, shed.x + 100, shed.z + 100).map((s) => s.door));
  doors.into(blockers);
  return { blockers, doors };
}

/** Walk a body from (side, fwd) by way of the others (side, fwd) of the shed, the doors swinging; where it got to, in the shed's frame. */
function walk(w: ReturnType<typeof world>, a: [number, number], ways: [number, number][], seconds = 6, from = 0): { body: Body; at: [number, number] } {
  const [ax, az] = shedPoint(shed, a[0], a[1]);
  const body = new Body(ax, level.groundAt(ax, az), az);
  const dt = 1 / 120;
  let t = 0;
  for (const b of ways) {
    const [bx, bz] = shedPoint(shed, b[0], b[1]);
    for (; t < seconds && Math.hypot(bx - body.x, bz - body.z) > 0.25; t += dt) {
      w.doors.step(dt, from + t, body.x, body.y + MOVE.stepOver, body.y + MOVE.height, body.z, MOVE.radius, w.blockers);
      body.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(bx - body.x), -(bz - body.z)), sprint: false, jump: false }, dt, w.blockers);
    }
  }
  assert.equal(body.mode, 'walk', 'walked, not climbed');
  return { body, at: inFrame(shed, body.x, body.z) };
}

test('sheds stand where the props draw them, the same every time, none in the cellar', () => {
  assert.ok(shed, 'a shed near the seed-1 spawn');
  const [tx, tz] = tile(shed.x, shed.z);
  assert.equal(quarryProps(level, tx, tz).counts.shacks, level.sheds.ofTile(tx, tz).length);
  assert.deepEqual(new Level(1, 1).sheds.ofTile(tx, tz).map((s) => [s.x, s.z, s.door.says]), level.sheds.ofTile(tx, tz).map((s) => [s.x, s.z, s.door.says]));
  assert.deepEqual(new Level(1, 0).sheds.standingIn(-200, -200, 200, 200), []);
  assert.equal(level.sheds.holding(shed.x, shed.z), shed);
  assert.equal(shed.door.kind, 'shed');
});

test('its door is shut and stops one; opened (E), one walks in, and it says what is inside', () => {
  const w = world(), outside: [number, number] = [0.6, SHED.half[1] + 1.4], inside: [number, number] = [0, 0];
  const shut = walk(w, outside, [inside], 3);
  assert.ok(shut.at[1] > SHED.half[1], `through the shut shed door: fwd ${shut.at[1].toFixed(2)}`);
  const door = w.doors.near(shut.body.x, shut.body.y, shut.body.z);
  assert.equal(door?.spec.kind, 'shed');
  assert.ok(Doors.shut(door!));
  assert.ok(w.doors.toggle(door!, 0).length > 0, 'the first time, a line about the inside');
  // Stand back while it swings out (it will not swing through anyone), then go in.
  const back = walk(w, [shut.at[0], shut.at[1]], [[0.6, SHED.half[1] + 1.8]], 1.5);
  for (let t = 0; t < DOOR.swing + 0.1; t += 1 / 60) w.doors.step(1 / 60, 2 + t, back.body.x, back.body.y + MOVE.stepOver, back.body.y + MOVE.height, back.body.z, MOVE.radius, w.blockers);
  assert.equal(door!.open, 1, 'swung wide open');
  const into = walk(w, back.at, [[0.6, SHED.half[1] - 0.4], inside], 6, 3);
  assert.ok(Math.hypot(into.at[0], into.at[1]) < 0.4, `in the shed: at ${into.at.map((v) => v.toFixed(2))}`);
  assert.equal(w.doors.toggle(door!, 10), '', 'shut again: nothing to say');
  assert.equal(w.doors.toggle(door!, 11), '', 'opened again: said once');
});

test('its walls stop one everywhere but the doorway', () => {
  const w = world();
  for (const [a, b] of [[[-1.2, -SHED.half[1] - 1.2], [-1.2, 0]], [[-SHED.half[0] - 1.2, 0.5], [0, 0.5]], [[SHED.half[0] + 1.2, 0.5], [0, 0.5]], [[-1.2, SHED.half[1] + 1.2], [-1.2, 0]]] as [number, number][][]) {
    const got = walk(w, a, [b], 3).at;
    assert.ok(Math.abs(got[0]) > SHED.half[0] - 0.05 || Math.abs(got[1]) > SHED.half[1] - 0.05, `through a wall to ${got.map((v) => v.toFixed(2))}`);
  }
});

test('shut in it, nothing notices you and you can rest; with the door open, not', () => {
  const body = new Body(shed.x, shed.y, shed.z);
  body.hidden = true;
  assert.equal(noticed(body, 0.5, 20), false);
  body.health = 20;
  const fire = new Campfire(level, 100, 100);
  fire.step(body, false, 0, 1, true);
  assert.ok(fire.resting && body.health > 20, 'resting, mending');
  fire.step(body, true, 1, 1, true);
  assert.ok(!fire.resting, 'not with something after you');
  body.hidden = false;
  fire.step(body, false, 2, 1, false);
  assert.ok(!fire.resting, 'not with the door open');
});

test("the miners' things lie inside: on the table, the shelf, the bunk", () => {
  const rats = new Rats(level), finds = new Finds(level, (i, j) => rats.denAt(i, j), new Set());
  const inside = finds.near(shed.x, shed.z, 3).filter((f) => level.sheds.holding(f.x, f.z) === shed && f.y > shed.y + 0.3);
  assert.ok(inside.length >= 1 && inside.length <= 2, `${inside.length} finds in the shed`);
  for (const f of inside) {
    const [s, fw] = inFrame(shed, f.x, f.z);
    // One standing in the room reaches it.
    const [px, pz] = shedPoint(shed, Math.min(1.2, Math.max(-1.1, s)), Math.max(-0.4, fw + 0.8));
    const near = finds.inReach(px, shed.y, pz);
    assert.ok(near, `a find at ${s.toFixed(2)}, ${fw.toFixed(2)} in reach from the room`);
  }
});

test('no loose stones lie in a shed', () => {
  const [tx, tz] = tile(shed.x, shed.z), stones = quarryProps(level, tx, tz).stones;
  if (!stones) return;
  for (let i = 0; i < stones.positions.length; i += 3) {
    const [s, f] = inFrame(shed, stones.positions[i], stones.positions[i + 2]);
    assert.ok(Math.abs(s) > SHED.half[0] - 0.4 || Math.abs(f) > SHED.half[1] - 0.4, `a stone in the shed at ${s.toFixed(2)}, ${f.toFixed(2)}`);
  }
});
