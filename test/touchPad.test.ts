import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_ACTIONS } from '../src/game/abilities';
import { touchLabel } from '../src/input/touchButtons';

test('every touch button stands for an action the game has', () => {
  for (const a of ['Mouse0', 'Space', 'KeyE', 'Tab', 'KeyZ', 'KeyT', 'KeyM', 'KeyI', 'KeyJ', 'KeyF', 'KeyC']) {
    assert.ok(KEY_ACTIONS.some((k) => k.key === a), a);
    assert.ok(touchLabel(a), a);
  }
  assert.equal(touchLabel('KeyE'), 'Use');
  assert.equal(touchLabel('KeyQ'), null);
});
