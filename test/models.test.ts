import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propModel } from '../src/gen/models';
import { PropBuilder } from '../src/gen/propMesh';

test('every packed model decodes: on the ground, centred, outward normals, colours in range', () => {
  for (const name of ['prop_crate', 'prop_barrel', 'prop_bucket', 'prop_pick', 'prop_shovel', 'prop_cut_block'] as const) {
    const m = propModel(name);
    assert.ok(m.indices.length > 30 && m.indices.length % 3 === 0, name);
    assert.ok(Math.abs(m.min[1]) < 0.01, `${name} stands on y = 0, not ${m.min[1]}`);
    assert.ok(Math.abs(m.min[0] + m.max[0]) < 0.02 && Math.abs(m.min[2] + m.max[2]) < 0.02, `${name} is centred`);
    for (const i of m.indices) assert.ok(i < m.positions.length / 3);
    for (const c of m.colors) assert.ok(c >= 0 && c <= 1);
    // The signed volume of a closed mesh wound outwards is positive.
    let vol = 0;
    const P = m.positions;
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3];
      vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    assert.ok(vol > 0, `${name} winds outwards`);
  }
});

test('stamp turns a model like upright and leans its top back', () => {
  const shovel = propModel('prop_shovel');
  const b = new PropBuilder();
  // Facing +x (yaw 90°), leant back: the top ends up towards -x.
  b.stamp(shovel, 10, 2, 5, Math.PI / 2, { lean: 0.4 });
  const mesh = b.build()!;
  let top = 0;
  for (let i = 1; i < mesh.positions.length; i += 3) if (mesh.positions[i] > mesh.positions[top * 3 + 1]) top = (i - 1) / 3;
  assert.ok(mesh.positions[top * 3] < 10 - 0.3, `the top leans back: x ${mesh.positions[top * 3]}`);
  assert.ok(mesh.positions[top * 3 + 1] > 2.8, 'and is still high up');
  assert.equal(mesh.indices.length, shovel.indices.length);
});
