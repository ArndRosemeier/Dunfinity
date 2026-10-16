/**
 * The stage: the one way things enter the visible scene (docs/SHADERS.md).
 *
 *  1. `warmUp()` compiles every material kind (materials.ts) against the real scene (its lights and
 *     fog) behind the loading screen, at full speed. Then the shader cap switches on.
 *  2. `add(obj)` compiles the object first (`compileAsync`: a cache hit for a warmed kind, otherwise a
 *     queued build under the cap) and only then puts it into the scene. Nothing ever draws with a
 *     shader that is not ready, so nothing compiles on the render path.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, type Camera, type InstancedMesh, type Object3D, type Scene, type WebGPURenderer } from 'three/webgpu';
import { allKinds, type MaterialKind } from './materials';
import { surfaceAttributes } from './meshes';
import { SURFACE_STRIDE } from '../gen/style';
import { ShaderCap } from './shaders/cap';
import { ShaderMonitor } from './shaders/monitor';
import { installShaderPolicy } from './shaders/patches';

/** Frames drawn to warm the shadow pass (async pipelines finish over a few). */
const WARM_FRAMES = 8;
/** A layer only the headlamp's shadow camera sees: casters warmed later are drawn into its map alone. */
const WARM_LAYER = 7;
/** Frames a caster warmed later stays in the shadow map (its build happens on the first). */
const SHADOW_FRAMES = 3;

/** Wait `n` animation frames. */
function frames(n: number): Promise<void> {
  return new Promise((done) => {
    const next = (): void => { if (--n <= 0) done(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  });
}

/**
 * What the shadow pass's shader for a caster depends on (it draws every caster with one material, so
 * not on the caster's own, apart from its type and any moved vertices): skinned or instanced, its
 * attributes and morphs, its material's side, cut-outs, type and position node. Casters alike share
 * a shader; one of each is drawn.
 */
function casterKey(m: Mesh): string {
  const g = m.geometry, mat = (Array.isArray(m.material) ? m.material[0] : m.material) as { type?: string; side?: number; alphaTest?: number; alphaMap?: unknown; positionNode?: { id?: number } | null };
  return [(m as { isSkinnedMesh?: boolean }).isSkinnedMesh, (m as { isInstancedMesh?: boolean }).isInstancedMesh, Object.keys(g.attributes).sort().join(','),
    Object.keys(g.morphAttributes).join(','), mat.side, (mat.alphaTest ?? 0) > 0, !!mat.alphaMap, mat.type, mat.positionNode?.id ?? ''].join('|');
}

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
    for (const o of [group, ...extra]) o.traverse((c) => { if ((c as Mesh).isMesh && (c as Mesh).castShadow) this.casters.add(casterKey(c as Mesh)); });
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

  /**
   * The camera of the light that casts shadows (the headlamp's). Set, everything prepared after the
   * warm-up also gets its shadow-pass shaders built ahead (`warmShadowsOf`).
   */
  set shadowCamera(cam: Camera) {
    cam.layers.enable(WARM_LAYER);
    this.shadowCam = cam;
  }
  private shadowCam: Camera | null = null;
  /** The kinds of shadow caster whose shadow-pass shaders are built (`casterKey`). */
  private readonly casters = new Set<string>();

  /**
   * Warm `objs` while the game is already drawing (behind the title screen) instead of in the
   * warm-up: one after another, each compiled under the cap and its shadows built like anything
   * prepared. Pass the roots of what will be added. Resolves when all are warm.
   */
  async warmLater(objs: readonly Object3D[]): Promise<void> {
    for (const o of objs) await this.prepare(o);
  }

  /**
   * The shadow pass draws casters with shaders of its own, which compileAsync does not build, and
   * builds them on the render path. So before `obj` (not in the scene yet) goes in, each new kind of
   * caster in it is drawn for a few frames into the shadow camera only (a layer the camera does not
   * see), holding the cap so nothing else starts near that build.
   */
  private async warmShadowsOf(obj: Object3D): Promise<void> {
    if (!this.shadowCam || !this.cap.active || obj.parent) return;
    const meshes: Mesh[] = [], fresh: Mesh[] = [];
    obj.traverse((c) => { if ((c as Mesh).isMesh) meshes.push(c as Mesh); });
    for (const m of meshes) {
      if (!m.castShadow) continue; // the shadow pass draws casters only
      const key = casterKey(m);
      if (this.casters.has(key)) continue;
      this.casters.add(key);
      fresh.push(m);
    }
    if (!fresh.length) return;
    const masks = meshes.map((m) => m.layers.mask), culled = meshes.map((m) => m.frustumCulled);
    for (const m of meshes) m.layers.disableAll();
    this.scene.add(obj);
    for (const m of fresh) {
      await this.cap.slot();
      this.cap.held = true;
      this.monitor.note = 'shadow warm-up';
      // Shown even if hidden or empty now (a pool with nobody in it yet): it will be drawn later.
      const hidden: Object3D[] = [];
      for (let p: Object3D | null = m; p && p !== this.scene; p = p.parent) if (!p.visible) { hidden.push(p); p.visible = true; }
      const inst = (m as InstancedMesh).isInstancedMesh ? m as InstancedMesh : null, count = inst?.count ?? 0;
      if (inst && !count) inst.count = 1;
      m.layers.set(WARM_LAYER);
      m.frustumCulled = false;
      await frames(SHADOW_FRAMES);
      m.layers.disableAll();
      if (inst) inst.count = count;
      for (const p of hidden) p.visible = false;
      this.monitor.note = '';
      this.cap.held = false;
      this.cap.take(); // booked again: the next build waits its spacing after this one
    }
    this.scene.remove(obj);
    meshes.forEach((m, i) => { m.layers.mask = masks[i]; m.frustumCulled = culled[i]; });
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
    }).then(() => this.warmShadowsOf(obj));
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
  if (kind.attributes.includes('surface')) surfaceAttributes(g, new Float32Array(3 * SURFACE_STRIDE));
  if (kind.attributes.includes('uv')) g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const m = new Mesh(g, kind.make());
  m.castShadow = kind.shadow.cast;
  m.receiveShadow = kind.shadow.receive;
  return m;
}
