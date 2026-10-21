/**
 * A ghost of an Actors figure: every material of it seen through and glowing at its rim, in one tint,
 * faded by the figure's `fade` (a uniform: no recompile). Applied once, before the figure is first
 * compiled; the figure's materials are its own, so nothing is shared with the living. Ghosts cast no
 * shadow. (Came over from the old humanoid package's ghosts.)
 */
import type { Material, Mesh, MeshStandardNodeMaterial, NodeBuilder } from 'three/webgpu';
import { abs, diffuseColor, dot, float, luminance, materialEmissive, mix, normalView, positionViewDirection, pow, saturate, sub, vec3, vec4 } from 'three/tsl';
import { Color, SRGBColorSpace } from 'three/webgpu';
import type { Figure } from './figure';

export interface GhostLook {
  /** sRGB 0..1. */
  tint: [number, number, number];
  /** How much of it one sees, 0..1 (its rim more, its middle less). */
  opacity: number;
}

/** Make `f` a ghost in `g`'s tint. */
export function ghostly(f: Figure, g: GhostLook): void {
  const c = new Color().setRGB(g.tint[0], g.tint[1], g.tint[2], SRGBColorSpace), tint = vec3(c.r, c.g, c.b);
  const fade = f.fadeNode;
  f.character.object.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[]) {
      const n = mat as MeshStandardNodeMaterial;
      // Facing you, thin; at the edges, where one looks through more of it, stronger.
      const rim = pow(sub(1, saturate(abs(dot(normalView, positionViewDirection)))), 2);
      const seen = float(g.opacity).mul(rim.mul(1.6).add(0.35)).mul(fade);
      n.opacityNode = n.opacityNode ? (n.opacityNode as ReturnType<typeof float>).mul(seen) : seen;
      n.emissiveNode = ((n.emissiveNode ?? materialEmissive) as typeof tint).add(tint.mul(rim.mul(1.4).add(0.25)).mul(fade));
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
  });
}
