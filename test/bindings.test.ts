import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bindings, keyLabel } from '../src/input/bindings';
import { FIXED_KEYS, KEY_ACTIONS, SLOT_KEYS } from '../src/game/abilities';
import { GRAPHICS_DEFAULTS, SOUND_DEFAULTS, TABLET_GRAPHICS, readGraphicsSettings, readKeySettings, readSoundSettings } from '../src/persist/settings';

const ACTIONS = KEY_ACTIONS.map((a) => a.key);

test('every action has one key, every key one action: a taken key swaps', () => {
  const b = new Bindings(ACTIONS, FIXED_KEYS);
  assert.equal(b.actionOf('KeyW'), 'KeyW');
  assert.equal(b.actionOf('KeyU'), 'KeyU', 'a key no action has is itself');
  assert.equal(b.rebind('KeyW', 'ArrowUp'), null);
  assert.equal(b.keyOf('KeyW'), 'ArrowUp');
  assert.equal(b.actionOf('ArrowUp'), 'KeyW');
  assert.equal(b.actionOf('KeyW'), null, 'W walks no more');
  assert.equal(b.rebind('KeyE', 'ArrowUp'), 'KeyW', 'E takes ↑ and forward gets E');
  assert.equal(b.keyOf('KeyW'), 'KeyE');
  assert.equal(b.actionOf('KeyE'), 'KeyW');
  const keys = ACTIONS.map((a) => b.keyOf(a));
  assert.equal(new Set(keys).size, keys.length);
  for (const a of ACTIONS) assert.equal(b.actionOf(b.keyOf(a)), a);
});

test('fixed keys and unknown actions change nothing; moves come back from their data; clear undoes all', () => {
  const b = new Bindings(ACTIONS, FIXED_KEYS);
  assert.equal(b.canTake('Escape'), false);
  b.rebind('KeyF', 'Backquote');
  b.rebind('NoSuchAction', 'KeyU');
  assert.deepEqual(b.data, {});
  b.rebind('KeyM', 'KeyU');
  b.rebind('KeyF', 'Mouse0');
  const back = new Bindings(ACTIONS, FIXED_KEYS, JSON.parse(JSON.stringify(b.data)));
  for (const a of ACTIONS) assert.equal(back.keyOf(a), b.keyOf(a));
  assert.equal(back.keyOf('Mouse0'), 'KeyF', 'stab swapped onto F');
  back.rebind('KeyF', 'KeyF');
  back.rebind('Mouse0', 'Mouse0');
  back.clear();
  assert.deepEqual(back.data, {});
  // A broken kept entry (a fixed key, two actions on one key) still leaves every key unique.
  const odd = new Bindings(ACTIONS, FIXED_KEYS, { KeyW: 'Escape', KeyA: 'KeyU', KeyD: 'KeyU' });
  assert.equal(odd.keyOf('KeyW'), 'KeyW');
  const keys = ACTIONS.map((a) => odd.keyOf(a));
  assert.equal(new Set(keys).size, keys.length);
});

test('the settings list every bar slot once and no fixed key', () => {
  assert.equal(new Set(ACTIONS).size, ACTIONS.length);
  for (const k of SLOT_KEYS) assert.ok(ACTIONS.includes(k), k);
  for (const k of FIXED_KEYS) assert.ok(!ACTIONS.includes(k), k);
});

test('keys are named as players know them', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('Digit3'), '3');
  assert.equal(keyLabel('Mouse2'), 'RMB');
  assert.equal(keyLabel('ShiftLeft'), 'Shift');
  assert.equal(keyLabel('Numpad4'), 'Num 4');
  assert.equal(keyLabel('Space'), 'Space');
});

test('no storage: the settings are their defaults (and nothing throws)', () => {
  assert.deepEqual(readSoundSettings(), SOUND_DEFAULTS);
  assert.deepEqual(readGraphicsSettings(), GRAPHICS_DEFAULTS);
  assert.deepEqual(readKeySettings(), {});
});

test('the minimap is on by default, on a tablet too', () => {
  assert.equal(GRAPHICS_DEFAULTS.minimap, true);
  assert.equal(TABLET_GRAPHICS.minimap, true);
});
