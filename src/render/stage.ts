/**
 * The stage: the one way things enter the visible scene (docs/SHADERS.md).
 *
 *  1. `warmUp()` compiles every material kind (materials.ts) against the real scene (its lights and
 *     fog) behind the loading screen, at full speed. Then the shader cap switches on.
 *  2. `add(obj)` compiles the object first (`compileAsync`: a cache hit for a warmed kind, otherwise a
 *     queued build under the cap) and only then puts it into the scene. Nothing ever draws with a
 *     shader that is not ready, so nothing compiles on the render path.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, type Camera, type Object3D, type Scene, type WebGPURenderer } from 'three/webgpu';
import { allKinds, type MaterialKind } from './materials';
import { ShaderCap } from './shaders/cap';
import { ShaderMonitor } from './shaders/monitor';
import { installShaderPolicy } from './shaders/patches';

/** Frames drawn to warm the shadow pass (async pipelines finish over a few). */
const WARM_FRAMES = 8;

export class Stage {
  readonly cap = new ShaderCap();
  readonly monitor = new ShaderMonitor();
  /** Renderer hooks that could not be installed (a three.js update renamed an internal). */
  readonly missingHooks: string[];
  private pending = new Set<Object3D>();

  constructor(readonly renderer: WebGPURenderer, readonly scene: Scene, readonly camera: Camera) {
    this.missingHooks = installShaderPolicy(renderer, this.cap, this.monitor);
    (globalThis as { shaders?: ShaderMonitor }).shaders = this.monitor;
  }

  /** Objects compiled but not yet visible. */
  get waiting(): number { return this.pending.size; }

  /**
   * Compile every material kind, then switch the cap on. Call after lights and fog are set up.
   * `extra`: objects whose materials are not registry kinds (the humanoid's, made by its package),
   * compiled with them; add them with `add` later (a cache hit by then).
   */
  async warmUp(extra: readonly Object3D[] = []): Promise<void> {
    // One real frame first: it settles the render context (frame buffer target) that compiled
    // shaders are keyed by, and builds the renderer's own output pass.
    this.renderer.render(this.scene, this.camera);
    const standIns = allKinds().map((k) => standIn(k));
    for (const m of standIns) {
      m.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z - 2);
      m.frustumCulled = false; // compileAsync skips what is out of view, wherever the camera looks
    }
    const group = new Group();
    for (const m of standIns) group.add(m);
    await this.renderer.compileAsync(group, this.camera, this.scene);
    for (const o of extra) await this.prepare(o);
    // Then draw them, for the shadow pass's own (small) shaders, which compileAsync does not build.
    await this.warmShadows(group, extra);
    for (const m of standIns) m.geometry.dispose();
    this.monitor.phase = 'run';
    this.cap.active = true;
  }

  /**
   * The shadow pass draws casters with shaders of its own, which compileAsync does not build: draw
   * the stand-ins and `extra` in front of the camera (where the headlamp shines) for a few real
   * frames, so those build now, behind the loading screen, and not in play.
   */
  private async warmShadows(group: Group, extra: readonly Object3D[]): Promise<void> {
    const parents = extra.map((o) => o.parent);
    for (const o of extra) {
      group.add(o);
      o.traverse((c) => { c.frustumCulled = false; });
    }
    this.scene.add(group);
    for (let k = 0; k < WARM_FRAMES; k++) {
      this.renderer.render(this.scene, this.camera);
      await new Promise((r) => setTimeout(r, 30));
    }
    this.scene.remove(group);
    extra.forEach((o, i) => {
      o.removeFromParent();
      parents[i]?.add(o);
      o.traverse((c) => { c.frustumCulled = true; });
    });
  }

  /** Put `obj` into the scene once everything it draws with is compiled. */
  add(obj: Object3D): Promise<void> {
    this.pending.add(obj);
    return this.prepare(obj).then(() => {
      if (!this.pending.delete(obj)) return; // removed meanwhile
      this.scene.add(obj);
    });
  }

  /**
   * Compile everything `obj` draws with, without adding it (for callers that add it to a group of
   * their own once it is ready, like the terrain).
   */
  prepare(obj: Object3D): Promise<void> {
    // compileAsync skips what is outside the view; it must compile everything, or the object
    // would build its shader on the render path the first time it comes into view.
    const culled: Object3D[] = [];
    obj.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    return this.renderer.compileAsync(obj, this.camera, this.scene).finally(() => {
      for (const o of culled) o.frustumCulled = true;
    });
  }

  remove(obj: Object3D): void {
    this.pending.delete(obj);
    obj.removeFromParent();
  }

  /** One HUD line on the shader policy (plus any renderer hooks that could not be installed). */
  hudLine(): string {
    const s = this.monitor.summary();
    return `shaders ${s.warmup} warm-up + ${s.run} later · worst ${s.worstMs.toFixed(0)} ms · ${s.violations ? `${s.violations} POLICY VIOLATIONS (shaders.report())` : 'policy ok'}`
      + (this.missingHooks.length ? `\nshader hooks missing: ${this.missingHooks.join(', ')}` : '');
  }

  /** Once per frame, before rendering. */
  frame(): void {
    this.cap.newFrame();
  }
}

/** A tiny mesh with the kind's attributes, so its warm-up build matches real meshes of the kind. */
function standIn(kind: MaterialKind): Mesh {
  const g = new BufferGeometry();
  const tri = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  g.setAttribute('position', new Float32BufferAttribute(tri, 3));
  g.setIndex([0, 1, 2]); // part of the shader's cache key: every kind's meshes are indexed
  if (kind.attributes.includes('normal')) g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  if (kind.attributes.includes('color')) g.setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
  if (kind.attributes.includes('surface')) g.setAttribute('surface', new Float32BufferAttribute(new Array(12).fill(0), 4));
  if (kind.attributes.includes('uv')) g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const m = new Mesh(g, kind.make());
  m.castShadow = kind.shadow.cast;
  m.receiveShadow = kind.shadow.receive;
  return m;
}
