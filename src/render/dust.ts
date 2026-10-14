/**
 * Dust hanging in the air of the workings, seen only in the headlamp's beam (the `DUST` kind does
 * the drifting, the wrapping round the camera and the lighting). One mesh of quads built once from a
 * seed; each frame only the lamp's place and direction go to the shader.
 */
import { Vector3, type Mesh, type SpotLight } from 'three/webgpu';
import { Rng, deriveSeed } from '@futuremagic/core';
import { meshFromData } from './meshes';
import { DUST, DUST_BOX, DUST_LAMP } from './materials';

/** How many motes fill the box, and their size range (m). */
const DUST_COUNT = 2000;
const SIZE = [0.006, 0.016] as const;

export class Dust {
  readonly mesh: Mesh;
  private readonly at = new Vector3();
  private readonly to = new Vector3();

  constructor(seed: number) {
    const rng = new Rng(deriveSeed(seed, 'dust'));
    const positions = new Float32Array(DUST_COUNT * 12), normals = new Float32Array(DUST_COUNT * 12), colors = new Float32Array(DUST_COUNT * 12);
    const indices = new Uint32Array(DUST_COUNT * 6);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < DUST_COUNT; i++) {
      const x = rng.range(0, DUST_BOX), y = rng.range(0, DUST_BOX), z = rng.range(0, DUST_BOX);
      const size = rng.range(SIZE[0], SIZE[1]), phase = rng.float(), speed = rng.float(), bright = rng.range(0.3, 1);
      for (let c = 0; c < 4; c++) {
        const k = (i * 4 + c) * 3;
        positions.set([x, y, z], k);
        normals.set([corners[c][0], corners[c][1], size], k);
        colors.set([phase, speed, bright], k);
      }
      indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    this.mesh = meshFromData({ positions, normals, colors, indices }, DUST);
    this.mesh.name = 'dust';
    this.mesh.frustumCulled = false; // the shader moves the motes round the camera
  }

  /** Follow the lamp (once per frame, after it is placed). */
  follow(lamp: SpotLight): void {
    lamp.getWorldPosition(this.at);
    lamp.target.getWorldPosition(this.to);
    DUST_LAMP.at.value.copy(this.at);
    DUST_LAMP.dir.value.copy(this.to.sub(this.at).normalize());
  }
}
