import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { CELLAR } from '../src/gen/cellar';
import { HOUSE_DOORS } from '../src/gen/doorways';
import { quarryProps } from '../src/gen/quarryProps';
import { Blockers } from '../src/world/blockers';
import { DOOR, DOORS_KEY, Doors } from '../src/world/doors';
import { Body, MOVE } from '../src/world/traverse/body';

const level = new Level(1, 0), FC = CELLAR.cellar.floor;

function world(): { blockers: Blockers; doors: Doors } {
  const blockers = new Blockers();
  for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 1; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  const doors = new Doors(level.doors);
  doors.into(blockers);
  return { blockers, doors };
}

/** Walk a body from a to b (straight), the doors swinging as they would; where it got to. */
function walk(w: ReturnType<typeof world>, a: [number, number, number], b: [number, number], seconds = 6): Body {
  const body = new Body(a[0], a[1], a[2]);
  const dt = 1 / 120;
  for (let t = 0; t < seconds && Math.hypot(b[0] - body.x, b[1] - body.z) > 0.25; t += dt) {
    w.doors.step(dt, t, body.x, body.y + MOVE.stepOver, body.y + MOVE.height, body.z, MOVE.radius, w.blockers);
    body.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(b[0] - body.x), -(b[1] - body.z)), sprint: false, jump: false }, dt, w.blockers);
  }
  return body;
}

/** Swing the doors on for `seconds` with nobody about. */
function wait(w: ReturnType<typeof world>, from: number, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.doors.step(1 / 60, from + t, 100, 0, 2, 100, MOVE.radius, w.blockers);
}

test("grandma's house has its doors, shut, the cellar's strange; none below the town", () => {
  assert.equal(level.doors.length, HOUSE_DOORS.length);
  assert.deepEqual(new Level(1, 1).doors, []);
  assert.equal(HOUSE_DOORS.filter((d) => d.kind === 'cellar').length, 1);
  for (const d of new Doors(level.doors).list) {
    const [mx, mz] = d.middle;
    assert.ok(level.sdf(mx, d.spec.y + 1, mz) > 0.3, `${d.spec.name}: its doorway is open air`);
  }
});

test('a shut door stops one; opened (E), one walks through', () => {
  const w = world();
  // The cellar door, from the cellar to the stair's foot.
  const shut = walk(w, [-12.6, FC, -1], [-10.2, -1], 3);
  assert.ok(shut.x < -11.5, `through the shut cellar door: x ${shut.x.toFixed(2)}`);
  const door = w.doors.near(shut.x, shut.y, shut.z);
  assert.equal(door?.spec.kind, 'cellar');
  w.doors.toggle(door!, 0);
  // Stand back while it swings (it will not swing through anyone), then go.
  const back = walk(w, [shut.x, shut.y, shut.z], [-12.7, -1], 1);
  wait(w, 1, DOOR.swing + 0.1);
  const through = walk(w, [back.x, back.y, back.z], [-10.2, -1]);
  assert.ok(through.x > -10.6, `through the open cellar door: stopped at x ${through.x.toFixed(2)}`);
  // An inner door too: hall to kitchen.
  const kitchen = w.doors.list.find((d) => d.spec.name === 'the kitchen door')!;
  const hall = walk(w, [-11.4, 2.7, 0], [-11.4, 3], 3);
  assert.ok(hall.z < 1.1, `through the shut kitchen door: z ${hall.z.toFixed(2)}`);
  w.doors.toggle(kitchen, 0);
  const away = walk(w, [hall.x, hall.y, hall.z], [-11.4, 0], 1);
  wait(w, 1, DOOR.swing + 0.1);
  assert.ok(walk(w, [away.x, away.y, away.z], [-11.4, 1.75]).z > 1.45, 'into the kitchen');
});

test('a door does not swing through whoever stands in its way', () => {
  const w = world();
  const door = w.doors.list.find((d) => d.spec.kind === 'cellar')!;
  w.doors.toggle(door, 0);
  // Standing just inside the cellar, where it opens to (it swings west, into the cellar).
  for (let t = 0; t < 2; t += 1 / 60) w.doors.step(1 / 60, t, -11.7, FC + 0.3, FC + 1.75, -0.9, MOVE.radius, w.blockers);
  assert.ok(door.open < 1, 'held');
  wait(w, 2, DOOR.swing + 0.1);
  assert.equal(door.open, 1, 'and opens once one steps away');
});

test('the cellar door shuts itself once nobody is near it, and says things; the others stay as left', () => {
  const w = world();
  const cellar = w.doors.list.find((d) => d.spec.kind === 'cellar')!, front = w.doors.list.find((d) => d.spec.kind === 'front')!;
  assert.match(w.doors.toggle(cellar, 0), /\w/);
  assert.equal(w.doors.toggle(front, 0), '');
  wait(w, 0, DOOR.swing + 0.1);
  assert.equal(cellar.open, 1);
  wait(w, 1, DOOR.wait + DOOR.swing + 0.5);
  assert.equal(cellar.open, 0, 'shut itself');
  assert.equal(front.open, 1, 'the front door stays open');
  assert.ok(w.blockers.count > 0 && DOORS_KEY === 'doors');
});
