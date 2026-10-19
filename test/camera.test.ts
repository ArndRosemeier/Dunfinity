import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PerspectiveCamera } from 'three/webgpu';
import { Level } from '../src/gen/level';
import { CELLAR } from '../src/gen/cellar';
import { quarryProps, PROP_TILE } from '../src/gen/quarryProps';
import { Blockers } from '../src/world/blockers';
import { OrbitCamera } from '../src/render/camera/OrbitCamera';

const box = (x: number, z: number, yaw: number, hx: number, hz: number, y0 = 0, y1 = 2) => new Float32Array([x, z, hx, hz, Math.cos(yaw), Math.sin(yaw), y0, y1]);

/** Just what the orbit camera sets. */
function stubCamera() {
  const position = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } };
  return { position, rotation: { set() {} } } as unknown as PerspectiveCamera & { position: typeof position };
}

test('a ray stops short of a turned box, misses one beside or above it, and goes on from inside one', () => {
  const b = new Blockers();
  b.set('t', box(3, 0, 0.7, 0.1, 1.5));
  const t = b.trace(0, 1, 0, 1, 0, 0, 6, 0.3);
  assert.ok(t > 1.8 && t < 2.8, `stopped at ${t.toFixed(2)}`);
  assert.equal(b.trace(0, 1, 4, 1, 0, 0, 6, 0.3), 6, 'beside it');
  assert.equal(b.trace(0, 2.5, 0, 1, 0, 0, 6, 0.3), 6, 'over it');
  assert.equal(b.trace(3, 1, 0, 0, 0, 1, 1, 0.3), 1, 'from inside it');
  // Starting within the skin of it, heading in: no way out at all.
  b.set('u', box(10, 0, 0, 0.1, 1));
  assert.equal(b.trace(9.75, 1, 0, 1, 0, 0, 6, 0.3), 0);
  assert.equal(b.trace(9.75, 1, 0, -1, 0, 0, 6, 0.3), 6, 'heading away');
});

test("in grandma's hall the camera does not swing through her thin walls into the next room", () => {
  const level = new Level(1, 0), blockers = new Blockers();
  for (let tz = -1; tz <= 0; tz++) for (let tx = -2; tx <= 0; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  assert.ok(blockers.count > 0 && PROP_TILE > 0);
  const camera = stubCamera(), cam = new OrbitCamera(camera, level);
  const eye = [-13.9, CELLAR.house.floor + 1.5, 0] as const; // (west of the stairwell, the living room's door and her bedroom's)
  // Looking north from the hall: behind is south, through the wall into the living room.
  cam.yaw = Math.PI; cam.pitch = 0; cam.distance = 4;
  for (let i = 0; i < 60; i++) cam.follow(eye[0], eye[1], eye[2], 1 / 60);
  assert.ok(camera.position.z < -2, `the rock alone lets it into the living room: z ${camera.position.z.toFixed(2)}`);
  cam.blockers = blockers;
  const zs: number[] = [];
  for (let i = 0; i < 120; i++) { cam.follow(eye[0], eye[1], eye[2], 1 / 60); zs.push(camera.position.z); }
  assert.ok(camera.position.z > -1.6, `through the wall: z ${camera.position.z.toFixed(2)}`);
  // Held there, still: no shaking between two places.
  assert.ok(Math.max(...zs.slice(-30)) - Math.min(...zs.slice(-30)) < 1e-6, 'the camera jitters');
  // Through a doorway (the kitchen's, north at x -11.9..-10.9, behind one looking south) it may go on.
  cam.yaw = 0;
  for (let i = 0; i < 240; i++) cam.follow(-11.4, eye[1] - 0.3, 0, 1 / 60);
  assert.ok(camera.position.z > 1.3, `held at the doorway: z ${camera.position.z.toFixed(2)}`);
});
