import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRIFT, SaltDrift } from '../src/render/loot/saltDrift';

test('salt motes rise where the salt formed, stream to the nobody, and are gone', () => {
  const d = new SaltDrift(1);
  d.burst(0, 0, 0, 2, 10);
  const shown = () => d.root.children.filter((m) => m.visible);
  d.stream(10.5, 5, 1, 0);
  assert.ok(shown().length >= 8, `${shown().length} motes`);
  for (const m of shown()) assert.ok(m.position.y > 0.2 && Math.hypot(m.position.x, m.position.z) < 0.7, 'rising over the corpse');
  d.stream(10 + DRIFT.rise + DRIFT.fly * 0.95 + DRIFT.stagger * 11, 5, 1, 0); // (the last mote of the burst)
  for (const m of shown()) assert.ok(m.position.x > 3.5, 'nearly at the nobody');
  d.stream(13, 5, 1, 0);
  assert.equal(shown().length, 0);
});
