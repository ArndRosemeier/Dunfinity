import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { GHOST, GHOST_LINES, Ghosts, type Haunt } from '../src/creatures/ghosts';
import { Fauna } from '../src/creatures/fauna';
import type { Fighter } from '../src/combat/combat';

const someone = (x: number, y: number, z: number): Fighter => ({ x, y, z, vx: 0, vz: 0, radius: 0.35, height: 1.75, get dead() { return false; }, hurt() {} });

function haunts(g: Ghosts, l: Level, n = 14): Haunt[] {
  const [ax, , az] = l.arrival, out: Haunt[] = [];
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const h = g.denAt(Math.floor(ax / GHOST.cell) + i, Math.floor(az / GHOST.cell) + j);
    if (h) out.push(h);
  }
  return out;
}

test('dwarf ghosts haunt the dwarven halls and elf ghosts the elven vaults, nowhere else', () => {
  for (const [style, race] of [['dwarven', 'dwarf'], ['elven', 'elf']] as const) {
    const l = new Level(1, 25, style), all = haunts(new Ghosts(l), l);
    assert.ok(all.length > 2, `${all.length} haunts in ${style}`);
    for (const h of all) {
      assert.equal(h.race, race);
      assert.ok(GHOST_LINES[race].includes(h.line));
      assert.ok(Math.hypot(h.bx - h.x, h.bz - h.z) >= GHOST.beat[0] - 1e-9);
    }
  }
  for (const style of ['goblin', 'karst'] as const) { const l = new Level(1, 25, style); assert.equal(haunts(new Ghosts(l), l).length, 0, style); }
});

test('a ghost walks its beat, turns to you, speaks once, fades and is gone; it is no foe', () => {
  const l = new Level(1, 25, 'dwarven'), ghosts = new Ghosts(l), h = haunts(ghosts, l)[0];
  const far = someone(h.x + 40, h.y + 20, h.z);
  for (let k = 0; k < 60 * 20; k++) ghosts.advance(1 / 60, far);
  const g = ghosts.list[0];
  assert.ok(Math.hypot(g.x - h.x, g.z - h.z) > 0.5 || Math.hypot(g.x - h.bx, g.z - h.bz) > 0.5, 'it walked');
  const me = someone(g.x + 2.5, g.y, g.z);
  const modes = new Set<string>();
  for (let k = 0; k < 60 * 12; k++) { ghosts.advance(1 / 60, me); modes.add(g.mode); }
  assert.ok(modes.has('watch') && modes.has('speak') && modes.has('fade'), [...modes].join());
  assert.equal(ghosts.calls, 1);
  assert.equal(ghosts.said, h.line);
  assert.ok(g.dead && g.shown === 0);
  assert.equal(ghosts.killed, 0, 'never a kill');
  const fauna = new Fauna(l);
  assert.ok(!fauna.foes().some((f) => (f as object) instanceof Object && 'haunt' in f), 'not a foe');
});
