/**
 * The material registry (docs/SHADERS.md): every material in the game is made here, from a closed
 * list of kinds, so the set of shaders is known up front and compiled during warm-up. Guarded:
 * nothing outside this file may construct a material.
 *
 * Every mesh of a kind uses the kind's one material, so a kind is one shader; variation goes in
 * vertex attributes or uniforms, never in a new material. (When a kind needs per-mesh values,
 * Scale's sharedGraph pattern comes in: clones that share the node graph.)
 */
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, type Material, type Node } from 'three/webgpu';
import { abs, faceDirection, float, mx_fractal_noise_float, mx_noise_float, normalView, normalWorld, positionView, positionWorld, smoothstep, sin, vec2, vec3, vertexColor } from 'three/tsl';

export interface MaterialKind {
  readonly name: string;
  /** The geometry attributes meshes of this kind carry (warm-up builds a matching stand-in). Meshes are always indexed. */
  readonly attributes: readonly ('position' | 'normal' | 'color' | 'uv')[];
  /** Whether meshes of this kind cast and receive the headlamp's shadow (receiving is part of the shader's cache key). */
  readonly shadow: { readonly cast: boolean; readonly receive: boolean };
  /** The kind's material (one instance, made on first use). */
  make(): Material;
}

const kinds = new Map<string, MaterialKind>();

function defineKind(name: string, attributes: MaterialKind['attributes'], build: () => Material, shadow = { cast: true, receive: true }): MaterialKind {
  if (kinds.has(name)) throw new Error(`material kind "${name}" defined twice`);
  let proto: Material | null = null;
  const kind: MaterialKind = {
    name,
    attributes,
    shadow,
    make() {
      proto ??= Object.assign(build(), { name });
      return proto;
    },
  };
  kinds.set(name, kind);
  return kind;
}

/** Every kind, for the warm-up. */
export function allKinds(): readonly MaterialKind[] {
  return [...kinds.values()];
}

/** Lit, vertex-coloured solid: props, creatures, held things. */
export const VERTEX_COLOR_SOLID = defineKind('vertexColorSolid', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  return m;
});

/**
 * The rock: the generator's vertex colours (bands, dust, soot) with limestone worked into them in
 * the shader, from the world position so it needs no uvs and never repeats: mottling, a fine grain,
 * dark bedding seams on the walls, and a bumpy surface (a procedural height turned into a normal
 * with screen-space derivatives, Mikkelsen's surface-gradient bump). Same attributes as the solid kind.
 */
export const ROCK = defineKind('rock', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  const p = positionWorld;
  const mottle = mx_fractal_noise_float(p.mul(0.32), 3, 2.0, 0.5); // about -1..1, metres-wide patches
  const grain = mx_noise_float(p.mul(9.0)); // centimetre grain
  // Bedding: thin dark seams along the strata, wavering; only on steep faces (not the dusty floors).
  const steep = smoothstep(0.75, 0.35, abs(normalWorld.y));
  const bed = mx_noise_float(p.mul(vec3(0.05, 0.6, 0.05))); // which beds show a seam, and how strongly
  const seam = smoothstep(0.95, 0.995, abs(sin(p.y.mul(1.9).add(mottle.mul(2.2))))).mul(smoothstep(-0.1, 0.4, bed)).mul(steep);
  const flat = float(1).sub(steep);
  const grit = mx_noise_float(p.mul(23.0)).mul(flat); // dust and grit on the floors
  const shade = float(1).add(mottle.mul(0.12)).add(grain.mul(0.04)).add(grit.mul(0.07)).sub(seam.mul(0.25));
  m.colorNode = vertexColor().mul(shade);
  // Height for the bump: broad lumps, a chiselled roughness, the seams cut in.
  const height = mottle.mul(0.35).add(mx_noise_float(p.mul(3.1)).mul(0.12)).sub(seam.mul(0.12));
  m.normalNode = bumped(height, 0.35);
  m.roughnessNode = float(0.9).add(grain.mul(0.06));
  return m;
});

/** The view normal bent by a procedural `height` (Mikkelsen 2010, forward differences in screen space). */
function bumped(height: Node<'float'>, scale: number) {
  const dH = vec2(height.dFdx(), height.dFdy()).mul(scale);
  const sx = positionView.dFdx(), sy = positionView.dFdy(), n = normalView;
  const r1 = sy.cross(n), r2 = n.cross(sx);
  const det = sx.dot(r1).mul(faceDirection);
  const grad = det.sign().mul(dH.x.mul(r1).add(dH.y.mul(r2)));
  return det.abs().mul(n).sub(grad).normalize();
}

/** Unlit, vertex-coloured: things that give light (lamp flames, lit windows). Same attributes as the solid kind. */
export const GLOW = defineKind('glow', ['position', 'normal', 'color'], () => {
  const m = new MeshBasicNodeMaterial({ vertexColors: true });
  return m;
}, { cast: false, receive: false });

/** Standing water: dark and glossy, so lamps and the headlamp glint on it. Same attributes as the solid kind. */
export const WATER = defineKind('water', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.1 });
  return m;
}, { cast: false, receive: true });

/** Worked metal: a knife's blade, tools. Glints in the lamps. Same attributes as the solid kind. */
export const METAL = defineKind('metal', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.65 });
  return m;
});
