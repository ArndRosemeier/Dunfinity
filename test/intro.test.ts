import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACE, Prologue, SHOTS, Walk, readTime } from '../src/game/prologue';
import { FirstSteps, STEPS, STEP_GROUPS } from '../src/game/firstSteps';
import { Level } from '../src/gen/level';
import { HOUSE_DOORS } from '../src/gen/doorways';
import { Body } from '../src/world/traverse/body';
import { Blockers } from '../src/world/blockers';

test('the prologue: its shots in order, each caption long enough to read, black at the start and around the cut, none at the end', () => {
  const p = new Prologue();
  const lines = SHOTS.flatMap((s) => s.lines);
  assert.ok(Math.abs(p.length - (PACE.lead + lines.reduce((a, l) => a + readTime(l), 0) + PACE.linger)) < 1e-9);
  assert.ok(p.length > 30 && p.length < 70, `${p.length} s`);
  assert.equal(p.frame().black, 1);
  const seen: string[] = [];
  let last = -1;
  for (; !p.done; p.advance(0.05)) {
    const f = p.frame();
    assert.ok(f.shot >= last, 'shots go backwards');
    last = f.shot;
    if (f.caption > 0.99) { const l = SHOTS[f.shot].lines[f.line]; if (seen[seen.length - 1] !== l) seen.push(l); }
  }
  assert.deepEqual(seen, lines, 'every caption shows fully, in order');
  // Black before the cut out of the house, black after it, clear at the end.
  const q = new Prologue(), cut = SHOTS.findIndex((s) => s.cut), [, end] = q.span(cut);
  q.t = end - 0.01; assert.ok(q.frame().black > 0.9);
  q.t = end + 0.01; assert.ok(q.frame().black > 0.9);
  q.t = q.length - 0.01; assert.equal(q.frame().black, 0);
});

test('a click hurries the prologue to the next caption, and past the last one it is over; Escape skips it', () => {
  const p = new Prologue();
  const n = SHOTS.flatMap((s) => s.lines).length;
  for (let i = 0; i < n; i++) { p.next(); assert.ok(!p.done, `over after ${i + 1} clicks`); assert.equal(p.frame().caption, 0, 'a caption starts faded'); }
  p.next();
  assert.ok(p.done);
  const q = new Prologue();
  q.skip();
  assert.ok(q.done);
});

test('the nobody walks each shot\'s way on the town\'s and the cellar\'s floor: up the street, through her front door into the hall', () => {
  const level = new Level(1, 0), blockers = new Blockers();
  for (const shot of SHOTS) {
    const st = shot.stand, b = new Body(st.x, level.groundAt(st.x, st.z) + 0.05, st.z), walk = new Walk(shot.acts);
    assert.ok(level.sdf(st.x, b.y + 1, st.z) > 0.3, 'standing in air');
    let opened = false;
    for (let t = 0; t < 40 && !walk.finished; t += 1 / 120) {
      const s = walk.stride(b.x, b.z, t);
      if (s.open) { opened = true; assert.ok(HOUSE_DOORS.some((d) => d.kind === s.open)); }
      b.step(level, { forward: s.forward, right: 0, yaw: s.yaw, sprint: false, jump: false }, 1 / 120, blockers);
    }
    assert.ok(walk.finished, `stuck at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`);
    assert.equal(opened, shot.acts.some((a) => 'open' in a));
    const h = level.haven!;
    assert.ok(Math.hypot(b.x - h.x, b.z - h.z) > h.r, 'a walk ends in her salt circle (it would tick that step)');
    // The camera stays in the air all the way.
    const p = new Prologue();
    for (let u = 0; u <= 1; u += 0.1) {
      const { eye } = p.camera(SHOTS.indexOf(shot), u, [b.x, b.y + 1.4, b.z]);
      assert.ok(level.sdf(eye[0], eye[1], eye[2]) > 0.2, `camera in the rock at ${eye.map((v) => v.toFixed(1))}`);
    }
  }
});

test('first steps: only the hook; the cellar one at a time, level 1 at once; done ahead of its turn counts; the way on finishes its group', () => {
  const s = new FirstSteps();
  assert.deepEqual(s.showing().map((x) => x.id), ['letter']);
  assert.ok(s.tick('cook'));
  assert.ok(s.tick('letter'));
  assert.deepEqual(s.showing().map((x) => x.id), ['letter', 'cook', 'down'], 'the tin, cooked early, shows done');
  assert.ok(!s.tick('cook'), 'ticked twice');
  assert.ok(!s.tick('diary'), 'an old step, off the list, does nothing (no pencil sound)');
  assert.deepEqual(s.showing().map((x) => x.id), ['letter', 'cook', 'down']);
  assert.ok(STEPS.length <= 5, 'a short list');
  const t = new FirstSteps();
  t.tick('down');
  assert.equal(t.group, 1, 'going down finishes the cellar');
  assert.deepEqual(t.showing().map((x) => x.id), STEP_GROUPS[1].steps.map((x) => x.id));
  t.tick('stab'); t.tick('deeper');
  assert.ok(t.finished);
  assert.deepEqual(t.showing(), []);
});

test('first steps kept: what was done comes back; over stays over; an old save without the list has it over', () => {
  const s = new FirstSteps();
  s.tick('letter'); s.tick('circle');
  const back = FirstSteps.from(JSON.parse(JSON.stringify(s.data)));
  assert.ok(back.isDone('letter') && !back.isDone('cook'));
  s.over = true;
  assert.equal(s.data, true);
  const over = FirstSteps.from(true);
  assert.ok(over.over && over.isDone('deeper') && !over.tick('letter'));
  assert.deepEqual(over.showing(), []);
  assert.equal(new Set(STEPS.map((x) => x.id)).size, STEPS.length);
});
