import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tin } from '../src/loot/tin';
import { Cooked } from '../src/loot/recipes';
import { Practice } from '../src/loot/practice';
import { activeFamily, deleteFamily, families, freshWorldSeed, goNewGame, goStraightIn, loadByHand, manualSaves, MANUAL_SAVES, newFamily, readFamily, saveByHand, takeNewGame, takeStraightIn, writeFamily, type SaveData } from '../src/persist/save';

test('the tin, the cards and the practice come back as they were kept (through JSON)', () => {
  const tin = new Tin();
  tin.killed('rats');
  tin.reached(3);
  const back = Tin.from(JSON.parse(JSON.stringify(tin.data)));
  assert.equal(back.salt, tin.salt);
  assert.equal(back.deepest, 3);
  assert.equal(back.reached(3), null, 'level 3 was reached before');
  assert.notEqual(back.killed('rats')?.why, 'The first rat you have killed.');
  const c = new Cooked();
  tin.salt = 50;
  c.cook('duck', tin);
  c.cook('duck', tin);
  const cb = Cooked.from(JSON.parse(JSON.stringify(c.data)));
  assert.equal(cb.rank('duck'), 2);
  assert.equal(Cooked.from({ 'no-such-card': 3 }).data['duck' as const], undefined);
  const p = new Practice();
  p.use('climbing', 33);
  assert.equal(Practice.from(JSON.parse(JSON.stringify(p.data))).tier('climbing'), 2);
});

test('no storage, no save (and no throw)', () => {
  assert.equal(readFamily('x'), null);
  assert.deepEqual(families(), []);
  assert.equal(activeFamily(), null);
  assert.equal(takeStraightIn(), false);
});

/** A localStorage for one test (node has none). */
function withStorage(run: (store: Map<string, string>) => void): void {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  g.localStorage = {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  try { run(store); } finally { delete g.localStorage; }
}

const save = (heir: number, depth: number | null, extra: Partial<SaveData> = {}): SaveData => ({
  v: 1, heir, tin: { ...new Tin().data, deepest: depth ?? 0 }, taken: [],
  child: depth === null ? null : { depth, pos: [0, 0, 0], facing: 0, health: 10, stamina: 10, reached: depth, cooked: {}, practice: {}, pack: [] },
  ...extra,
});

test('families: several side by side, each in its mode, the last played first; forgetting one', () => {
  withStorage(() => {
    const a = newFamily(1, 'rogue', 1000);
    writeFamily(a, 1, save(0, 3), 1000);
    const b = newFamily(1, 'adventure', 2000);
    writeFamily(b, 1, save(2, null, { mode: 'adventure' }), 2000);
    assert.notEqual(a, b);
    assert.deepEqual(families().map((f) => [f.id, f.mode, f.heir, f.depth]), [[b, 'adventure', 2, null], [a, 'rogue', 0, 3]]);
    assert.equal(activeFamily()?.id, b, 'the newest is the one played');
    writeFamily(a, 1, save(1, 4), 3000);
    assert.equal(families()[0].id, a, 'kept last: first in the list');
    assert.equal(readFamily(a)?.child?.depth, 4);
    deleteFamily(b);
    assert.deepEqual(families().map((f) => f.id), [a]);
    assert.equal(readFamily(b), null);
  });
});

test('a family kept the old way (one per seed) is taken into the list once, as Rogue like', () => {
  withStorage((store) => {
    store.set('dunfinity:save:7', JSON.stringify(save(4, 2)));
    const [f] = families();
    assert.equal(f.seed, 7);
    assert.equal(f.mode, 'rogue');
    assert.equal(readFamily(f.id)?.heir, 4);
    assert.equal(activeFamily()?.id, f.id);
    assert.equal(families().length, 1, 'not taken in twice');
  });
});

test('Adventure: saves by hand, newest first, at most MANUAL_SAVES; loading one makes it the family save', () => {
  withStorage(() => {
    const id = newFamily(1, 'adventure', 1);
    for (let i = 0; i < MANUAL_SAVES + 2; i++) saveByHand(id, 1, save(0, i, { mode: 'adventure' }), 100 + i);
    const all = manualSaves(id);
    assert.equal(all.length, MANUAL_SAVES);
    assert.equal(all[0].data.child?.depth, MANUAL_SAVES + 1);
    writeFamily(id, 1, save(1, null, { mode: 'adventure' }), 500); // the grandchild died since
    assert.equal(loadByHand(id, all[3].at, 600), true);
    assert.equal(readFamily(id)?.child?.depth, all[3].data.child?.depth);
    assert.equal(loadByHand(id, 12345, 700), false);
    goStraightIn(true);
    assert.equal(takeStraightIn(), true);
    assert.equal(takeStraightIn(), false, 'asked once');
  });
});

test('each new family gets a world of its own; New Game over a kept one is asked once, past the title', () => {
  const seeds = new Set(Array.from({ length: 20 }, () => freshWorldSeed()));
  assert.ok(seeds.size > 15, 'fresh world seeds differ');
  for (const s of seeds) assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
  withStorage(() => {
    assert.equal(takeNewGame(), null);
    goNewGame('adventure');
    assert.equal(takeNewGame(), 'adventure');
    assert.equal(takeNewGame(), null, 'asked once');
    assert.equal(takeStraightIn(), true, 'the restart skips the title');
  });
});
