/**
 * A ghost of an Actors figure: every material of it seen through and glowing at its rim, in one tint,
 * faded by the figure's `fade`. Applied once, before the figure is first compiled; the figure's
 * materials are its own, so nothing is shared with the living. Ghosts cast no shadow. (Came over from
 * the old humanoid package's ghosts.)
 *
 * The ghost nodes are built once per kind of material (Actors shares one graph per kind): a ghost's
 * tint, opacity and fade are read from the drawn material at each draw, so every ghost shares the
 * shaders of its kinds instead of building its own.
 */
import type { Material, MeshStandardNodeMaterial, NodeBuilder } from 'three/webgpu';
import { abs, diffuseColor, dot, luminance, materialEmissive, mix, normalView, positionViewDirection, pow, saturate, sub, uniform, vec3, vec4 } from 'three/tsl';
import { Color, SRGBColorSpace } from 'three/webgpu';
import { STAND_IN, type Figure } from './figure';

export interface GhostLook {
  /** sRGB 0..1. */
  tint: [number, number, number];
  /** How much of it one sees, 0..1 (its rim more, its middle less). */
  opacity: number;
}

/** A material's ghost values (in its `userData`), read at each draw. */
const GHOST = 'ghost';
interface GhostValues { tint: Color; opacity: number; readonly fade: number }

type Frame = { material?: Material | null };
const ghostOf = (frame: Frame): GhostValues | undefined => frame.material?.userData[GHOST] as GhostValues | undefined;
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** The shared ghost inputs and rim (built on first use). */
let shared: { tint: Any; opacity: Any; fade: Any; rim: Any } | null = null;
function inputs(): NonNullable<typeof shared> {
  return shared ??= {
    tint: (uniform(new Color()) as Any).onObjectUpdate((f: Frame) => ghostOf(f)?.tint),
    opacity: (uniform(1) as Any).onObjectUpdate((f: Frame) => ghostOf(f)?.opacity),
    fade: (uniform(1) as Any).onObjectUpdate((f: Frame) => ghostOf(f)?.fade),
    // Facing you, thin; at the edges, where one looks through more of it, stronger.
    rim: pow(sub(1, saturate(abs(dot(normalView, positionViewDirection)))), 2),
  };
}

/** The ghost's opacity and glow over a kind's own (one pair per kind: keyed by the kind's nodes). */
const opacities = new Map<unknown, Any>(), glows = new Map<unknown, Any>();
function ghostOpacity(base: Any): Any {
  let n = opacities.get(base);
  if (!n) {
    const g = inputs();
    const seen = g.opacity.mul(g.rim.mul(1.6).add(0.35)).mul(g.fade);
    n = base ? base.mul(seen) : seen;
    opacities.set(base, n);
  }
  return n;
}
function ghostGlow(base: Any): Any {
  let n = glows.get(base);
  if (!n) {
    const g = inputs();
    n = (base ?? materialEmissive).add(g.tint.mul(g.rim.mul(1.4).add(0.25)).mul(g.fade));
    glows.set(base, n);
  }
  return n;
}

/** Make `f` a ghost in `g`'s tint. */
export function ghostly(f: Figure, g: GhostLook): void {
  const tint = new Color().setRGB(g.tint[0], g.tint[1], g.tint[2], SRGBColorSpace);
  const values: GhostValues = { tint, opacity: g.opacity, get fade() { return f.fade; } };
  // A ghost casts no shadow: its bodies' shadow stand-ins go (their material is shared).
  for (const m of f.meshes()) {
    if (m.name === STAND_IN) {
      m.removeFromParent();
      continue;
    }
    m.castShadow = false;
    m.userData[STAND_IN] = false; // and none comes back (src/render/actors/figure.ts shadows)
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[]) {
      const n = mat as MeshStandardNodeMaterial;
      n.userData[GHOST] = values;
      n.opacityNode = ghostOpacity(n.opacityNode);
      n.emissiveNode = ghostGlow(n.emissiveNode);
      // Pale and dim in the light (the light passes through it): its own colours mostly washed out;
      // what shows is the glow.
      const base = n.setupDiffuseColor;
      n.setupDiffuseColor = function (this: MeshStandardNodeMaterial, builder: NodeBuilder) {
        base.call(this, builder);
        const d = diffuseColor.rgb;
        diffuseColor.assign(vec4(mix(d, vec3(luminance(d)), 0.7).mul(0.3), diffuseColor.a));
      };
      n.transparent = true;
      n.depthWrite = false;
      n.needsUpdate = true;
    }
  }
}
