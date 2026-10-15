/**
 * The material registry (docs/SHADERS.md): every material in the game is made here, from a closed
 * list of kinds, so the set of shaders is known up front and compiled during warm-up. Guarded:
 * nothing outside this file may construct a material.
 *
 * Every mesh of a kind uses the kind's one material, so a kind is one shader; variation goes in
 * vertex attributes or uniforms, never in a new material. (When a kind needs per-mesh values,
 * Scale's sharedGraph pattern comes in: clones that share the node graph.)
 */
import { AdditiveBlending, MeshBasicNodeMaterial, MeshStandardNodeMaterial, NoColorSpace, SRGBColorSpace, Texture, Vector3, type Material, type Node } from 'three/webgpu';
import { abs, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, cos, dot, faceDirection, float, length, max, mix, mod, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec2, normalize, normalView, normalMap, normalWorld, positionLocal, positionView, positionWorld, smoothstep, sin, texture, time, uniform, varying, vec2, vec3, vec4, vertexColor } from 'three/tsl';

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
  const steep = smoothstep(0.75, 0.35, abs(normalWorld.y));
  const flat = float(1).sub(steep);
  // Bedding: thin dark seams along the strata, wavering; only on steep faces (not the dusty floors).
  const bed = mx_noise_float(p.mul(vec3(0.05, 0.6, 0.05))); // which beds show a seam, and how strongly
  const seam = smoothstep(0.95, 0.995, abs(sin(p.y.mul(1.9).add(mottle.mul(2.2))))).mul(smoothstep(-0.1, 0.4, bed)).mul(steep);
  // The miners' pick marks (as much as the band's rock was cut by hand): shallow parallel scallops
  // across the walls, slanting one way or the other course by course.
  const lean = smoothstep(-0.15, 0.15, mx_noise_float(p.mul(vec3(0.22, 1.1, 0.22)).add(31.7)));
  const across = p.x.add(p.z).mul(4.2).add(mottle.mul(2.5));
  const pick = mix(sin(across.add(p.y.mul(2.6))), sin(across.sub(p.y.mul(2.6))), lean).mul(0.5).add(0.5).pow(3);
  const tool = pick.mul(steep).mul(ROCK_TOOLED).mul(smoothstep(-0.3, 0.3, mx_noise_float(p.mul(0.4).add(5.3))));
  // Cracks in the walls: the edges of cells, strongly warped (no tiles), in some stretches only.
  const warp = vec3(mottle.mul(0.9), mx_noise_float(p.mul(0.9).add(8.2)).mul(0.5), mottle.mul(-0.7));
  const cells = mx_worley_noise_vec2(p.mul(vec3(0.45, 0.3, 0.45)).add(warp));
  const crack = smoothstep(0.045, 0.0, cells.y.sub(cells.x)).mul(smoothstep(0.2, 0.55, mx_noise_float(p.mul(0.12).add(-3.1)))).mul(steep);
  // Iron and damp staining running down the walls; on the floors, damp patches and grit.
  const streak = smoothstep(0.15, 0.65, mx_noise_float(p.mul(vec3(0.7, 0.07, 0.7)).add(13.7))).mul(steep);
  const damp = smoothstep(0.3, 0.7, mx_noise_float(p.mul(0.18).add(vec3(2.1, 0, -6.4)))).mul(flat);
  const grit = mx_noise_float(p.mul(23.0)).mul(flat);
  // Height for the bump: broad lumps, a chiselled roughness, the seams, pick marks and cracks cut in.
  const height = mottle.mul(0.35).add(mx_noise_float(p.mul(3.1)).mul(0.12)).sub(seam.mul(0.12)).sub(tool.mul(0.14)).sub(crack.mul(0.2));
  m.normalNode = bumped(height, 0.35);
  // Colour: broad warmer and cooler stretches of stone, darker in the hollows, the seams and cracks
  // darker still, rust-brown streaks down the walls, damp darker floors.
  const tint = mx_fractal_noise_float(p.mul(0.06).add(17.0), 2, 2.0, 0.5);
  const hue = mix(mix(vec3(1, 1, 1), vec3(1.1, 0.97, 0.82), smoothstep(0.0, 0.5, tint)), vec3(0.88, 0.92, 0.98), smoothstep(0.0, -0.5, tint));
  const shade = float(0.92).add(mottle.mul(0.16)).add(grain.mul(0.05)).add(grit.mul(0.08))
    .sub(seam.mul(0.3)).sub(tool.mul(0.12)).sub(crack.mul(0.55)).sub(damp.mul(0.25))
    .mul(smoothstep(-0.55, 0.35, height).mul(0.3).add(0.7));
  const rust = mix(vec3(1, 1, 1), vec3(0.95, 0.78, 0.6), streak.mul(0.6));
  m.colorNode = vertexColor().mul(shade).mul(hue).mul(rust);
  m.roughnessNode = float(0.9).add(grain.mul(0.06)).sub(damp.mul(0.35));
  // Veins of infused salt (the Salt Works): thin glowing blue lines where a noise crosses zero,
  // branching finer near the main ones, only in some stretches of rock, pulsing slowly.
  const line = float(1).sub(abs(mx_noise_float(p.mul(0.16).add(vec3(mottle.mul(0.7))))));
  const fine = float(1).sub(abs(mx_noise_float(p.mul(0.55).add(13.1))));
  const stretch = smoothstep(0.15, 0.5, mx_noise_float(p.mul(0.045).add(vec3(7.3, 1.1, -4.2))));
  const vein = smoothstep(0.975, 0.996, line).add(smoothstep(0.985, 0.998, fine).mul(smoothstep(0.85, 0.97, line)).mul(0.7)).mul(stretch);
  const pulse = sin(time.mul(1.1).add(p.x.mul(0.13)).add(p.z.mul(0.09))).mul(0.15).add(0.85);
  // Thin lines alias into glitter far off: they fade out with distance (the fog hides the rest).
  const near = smoothstep(55, 20, length(positionView));
  m.emissiveNode = vec3(0.25, 0.6, 1.0).mul(vein.mul(pulse).mul(near).mul(ROCK_VEINS).mul(2.4));
  return m;
});

/** How strongly the rock shows veins of glowing infused salt (the level's band: 0 in the Quarry). Set by `LevelView`. */
export const ROCK_VEINS = uniform(0);

/** How much the rock shows the miners' pick marks (the level's band: `band.tooled`). Set by `LevelView`. */
export const ROCK_TOOLED = uniform(1);

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

/**
 * Water running in a thin sheet over the rock (the Cisterns' water that runs uphill): glossy like
 * standing water, with ripples that travel up the world's y, so it reads as climbing. Same attributes as the solid kind.
 */
export const FLOW = defineKind('flow', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.05, metalness: 0.1 });
  const p = positionWorld;
  const ripple = sin(p.y.mul(7).sub(time.mul(3.2)).add(mx_noise_float(p.mul(1.5)).mul(4))).mul(0.5).add(0.5);
  m.colorNode = vertexColor().mul(ripple.mul(ripple).mul(1.6).add(0.5));
  // A faint cold shimmer on the crests: it should not be possible, and it shows.
  m.emissiveNode = vec3(0.05, 0.09, 0.1).mul(ripple.mul(ripple).mul(ripple));
  return m;
}, { cast: false, receive: true });

/** Worked metal: a knife's blade, tools. Glints in the lamps. Same attributes as the solid kind. */
export const METAL = defineKind('metal', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.65 });
  return m;
});

/** A creature's coat, baked in Blender (AssetGenerator): its colour map and normal map. */
export interface CoatMaps {
  readonly colour: Texture;
  readonly normal: Texture;
}

/** A coat kind: lit, from its own two maps (filled in when the creature's glb loads: src/render/creatures/rigged.ts). */
export interface CoatKind extends MaterialKind {
  readonly maps: CoatMaps;
}

/**
 * One kind per Blender-made creature, so one shader each: the maps are fixed textures whose images
 * arrive with the glb (a new image is not a new shader). The skinned meshes compile their own
 * variant when the creature's pool is added with the Stage.
 */
function defineCoat(name: string): CoatKind {
  const maps: CoatMaps = { colour: new Texture(), normal: new Texture() };
  maps.colour.colorSpace = SRGBColorSpace;
  maps.normal.colorSpace = NoColorSpace;
  for (const t of [maps.colour, maps.normal]) t.flipY = false; // glTF's uvs
  const kind = defineKind(name, ['position', 'normal', 'uv'], () => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
    m.colorNode = texture(maps.colour);
    m.normalNode = normalMap(texture(maps.normal));
    return m;
  });
  return Object.assign(kind, { maps });
}

/** The feral dogs' coat (AssetGenerator spec creature_feral_dog). */
export const DOG_COAT = defineCoat('dogCoat');

/** The quarry rats' coat (AssetGenerator spec creature_quarry_rat). */
export const RAT_COAT = defineCoat('ratCoat');

/** The cave crickets' shell (AssetGenerator spec creature_cave_cricket). */
export const CRICKET_COAT = defineCoat('cricketCoat');

/** Where the headlamp is and which way it shines (world), for the dust in its beam: set every frame by `Dust`. */
export const DUST_LAMP = { at: uniform(new Vector3()), dir: uniform(new Vector3(0, 0, -1)) };
/** The dust box: motes fill a cube this many metres wide that travels with the camera. */
export const DUST_BOX = 12;

/**
 * Dust in the air, seen only where the headlamp's beam catches it: tiny soft specks, additive. One
 * mesh of quads (built by `Dust`): `position` is a mote's place in the box, `normal` carries its
 * corner (x, y, -1..1) and size (z, m), `color` its phase, drift speed and brightness. The vertex
 * shader drifts the motes, wraps them round the camera (so the box never runs out) and turns each
 * quad to face the camera. Same attributes as the solid kind.
 */
export const DUST = defineKind('dust', ['position', 'normal', 'color'], () => {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
  const corner = attribute<'vec3'>('normal', 'vec3'), seed = attribute<'vec3'>('color', 'vec3');
  const t = time.mul(seed.y.mul(0.5).add(0.2)).add(seed.x.mul(6.283));
  const drift = vec3(sin(t), sin(t.mul(0.7).add(1.3)).mul(0.6), cos(t.mul(0.9))).mul(0.25);
  const half = DUST_BOX / 2;
  const p = mod(positionLocal.add(drift).sub(cameraPosition).add(half), DUST_BOX).add(cameraPosition).sub(half);
  const view = cameraViewMatrix.mul(vec4(p, 1));
  m.vertexNode = cameraProjectionMatrix.mul(vec4(view.xy.add(corner.xy.mul(corner.z)), view.z, view.w));
  // Lit by the beam: inside the cone, falling off with distance from the lamp, gone right at the lamp (no glare on the lens).
  const toMote = p.sub(DUST_LAMP.at), d = length(toMote);
  const inBeam = smoothstep(0.82, 0.95, dot(normalize(toMote), DUST_LAMP.dir));
  const lit = varying(inBeam.mul(smoothstep(0.4, 1.2, d)).div(max(d.mul(d), 1).mul(0.1)).mul(seed.z), 'vDustLit');
  const soft = smoothstep(1, 0.2, length(varying(corner.xy, 'vDustCorner')));
  m.colorNode = vec3(1.0, 0.86, 0.66).mul(lit.mul(soft));
  return m;
}, { cast: false, receive: false });
