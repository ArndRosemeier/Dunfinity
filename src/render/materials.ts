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
import { abs, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, cos, dot, faceDirection, float, length, max, min, mix, mod, mx_fractal_noise_float, mx_cell_noise_float, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec2, normalize, normalView, normalMap, normalWorld, positionLocal, positionView, positionWorld, smoothstep, sin, texture, time, uniform, varying, vec2, vec3, vec4, vertexColor } from 'three/tsl';

export interface MaterialKind {
  readonly name: string;
  /** The geometry attributes meshes of this kind carry (warm-up builds a matching stand-in). Meshes are always indexed. */
  readonly attributes: readonly ('position' | 'normal' | 'color' | 'uv' | 'surface')[];
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
 * The rock: the generator's vertex colours (bands, dust, soot) with the stone's finer look worked in
 * by the shader, from the world position so it needs no uvs and never repeats, and a bumpy surface
 * (a procedural height turned into a normal with screen-space derivatives, Mikkelsen's surface-gradient
 * bump). How the rock was worked comes per vertex from its style (`surface`, src/gen/style.ts
 * `Surface`: pick marks, masonry and its course height, flowstone); the band's finish comes in
 * uniforms (`ROCK_FINISH`: rock salt, concrete cast in board shuttering, wet sheen; `ROCK_VEINS`).
 * Natural rock (all 0) is broken stone: mottled, bedded, cracked, iron-stained.
 */
export const ROCK = defineKind('rock', ['position', 'normal', 'color', 'surface'], () => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  const p = positionWorld;
  const surf = attribute<'vec4'>('surface', 'vec4');
  const tooled = surf.x, masonry = surf.y.clamp(0, 1), flow = surf.z.clamp(0, 1);
  const natural = float(1).sub(masonry).mul(float(1).sub(flow));
  const mottle = mx_fractal_noise_float(p.mul(0.32), 3, 2.0, 0.5); // about -1..1, metres-wide patches
  const grain = mx_noise_float(p.mul(9.0)); // centimetre grain
  const lumps = mx_noise_float(p.mul(3.1)); // a chiselled roughness, hand-sized
  const steep = smoothstep(0.75, 0.35, abs(normalWorld.y));
  const flat = float(1).sub(steep);
  // Along a wall, horizontally (masonry courses, shuttering boards run this way): x or z, whichever
  // the wall faces across (a direction from the normal itself would swing round a pillar too fast).
  const u = abs(normalWorld.x).greaterThan(abs(normalWorld.z)).select(p.z, p.x);
  // Bedding: thin dark seams along the strata, wavering; only on steep faces (not the dusty floors).
  const bed = mx_noise_float(p.mul(vec3(0.05, 0.6, 0.05))); // which beds show a seam, and how strongly
  const seamAt = p.y.mul(1.9).add(mottle.mul(2.2)).div(Math.PI).fract().sub(0.5).abs().mul(Math.PI / 1.9); // metres to the nearest bed's parting
  const seam = thinLine(seamAt, float(0.012)).add(smoothstep(0.06, 0.0, seamAt).mul(0.4)).mul(smoothstep(-0.1, 0.4, bed)).mul(steep).mul(natural);
  // The beds themselves: layers of slightly different stone, a hand to an arm thick.
  const strata = mx_noise_float(vec3(p.x.mul(0.04), p.y.mul(2.1).add(mottle.mul(0.7)), p.z.mul(0.04)));
  // The miners' pick marks (as much as the style says): rows of scooped grooves a hand apart, each
  // row of work slanting its own way, the ridges between the scoops left sharp.
  const prow = p.y.div(0.42).add(lumps.mul(0.15)).floor();
  const slant = mx_cell_noise_float(vec3(prow, 0, 9.1)).sub(0.5).mul(1.8);
  const gpos = u.add(p.y.mul(slant)).div(0.1).add(lumps.mul(0.8)).add(grain.mul(0.15));
  const scoop = gpos.fract().mul(2).sub(1);
  // Each groove is a few strokes, not one long furrow: deeper and shallower along it, gone in places.
  const stroke = smoothstep(-0.2, 0.45, mx_noise_float(vec3(gpos.floor().mul(1.7), p.y.mul(3.2), prow.mul(2.3))));
  const pick = float(1).sub(scoop.mul(scoop)).mul(stroke);
  const worked = smoothstep(0.0, 0.08, tooled).mul(float(1).sub(masonry));
  const tool = pick.mul(smoothstep(0.4, 0.15, gpos.fwidth())).mul(float(1).sub(ROCK_FINISH.salt)).mul(steep).mul(tooled.clamp(0, 1)).mul(float(1).sub(masonry)).mul(smoothstep(-0.4, 0.1, mx_noise_float(p.mul(0.4).add(5.3))));
  // Cracks in the walls: the edges of cells, a little warped (no tiles), in some stretches only:
  // a hairline, dark, with a shadowed lip beside it.
  const warp = vec3(mottle.mul(0.4), mx_noise_float(p.mul(0.9).add(8.2)).mul(0.25), mottle.mul(-0.3));
  const cells = mx_worley_noise_vec2(p.mul(vec3(0.45, 0.3, 0.45)).add(warp));
  const border = cells.y.sub(cells.x).mul(1.4);
  const crack = thinLine(border, float(0.01)).add(smoothstep(0.08, 0.0, border).mul(0.35)).mul(smoothstep(0.1, 0.5, mx_noise_float(p.mul(0.12).add(-3.1)))).mul(steep).mul(natural);
  // Grains of other minerals in the stone: dark specks and pale flecks, crisp, a few centimetres apart.
  const speckD = mx_worley_noise_float(p.mul(11)), speckL = mx_worley_noise_float(p.mul(7).add(21.3));
  const speckFade = smoothstep(1.2, 0.4, p.mul(11).x.fwidth());
  const speck = smoothstep(0.32, 0.12, speckL).mul(0.16).sub(smoothstep(0.22, 0.06, speckD).mul(0.22)).mul(speckFade);
  // Iron and damp staining running down the walls; on the floors, damp patches and grit.
  const streak = smoothstep(0.15, 0.65, mx_noise_float(p.mul(vec3(0.7, 0.07, 0.7)).add(13.7))).mul(steep);
  const damp = smoothstep(0.25, 0.7, mx_noise_float(p.mul(0.18).add(vec3(2.1, 0, -6.4)))).mul(flat);
  const grit = mx_noise_float(p.mul(23.0)).mul(flat);
  // The stone's own colour texture, at several sizes: a fine grain of light and dark (fading where
  // it is finer than a pixel), blotches a hand across, and stains of iron and of grey.
  const fineAt = p.mul(16);
  const fleck = mx_fractal_noise_float(fineAt, 3, 2.1, 0.6).mul(smoothstep(1.2, 0.35, fineAt.x.fwidth().max(fineAt.y.fwidth())));
  const blotch = mx_fractal_noise_float(p.mul(2.3).add(4.4), 2, 2.0, 0.5);
  const iron = smoothstep(0.2, 0.55, mx_noise_float(p.mul(0.8).add(vec3(3.1, 7.7, 1.3))));
  const grey = smoothstep(0.25, 0.6, mx_noise_float(p.mul(0.6).add(vec3(-5.2, 2.4, 9.9))));
  const texture = float(1).add(fleck.mul(0.32)).add(blotch.mul(0.22));
  const stain = mix(mix(vec3(1, 1, 1), vec3(1.16, 0.9, 0.68), iron.mul(0.7)), vec3(0.82, 0.88, 0.95), grey.mul(0.6));
  // Rock salt (the Salt Works), as it looks in a real mine: dark grey-brown salt with pale, near white
  // beds and thin streaks running level along the walls, a pinkish bed here and there, dark clay
  // partings, and rings of fine grooves where the miners' cutting machines stopped.
  const saltBed = mx_noise_float(vec3(p.x.mul(0.03), p.y.mul(1.4).add(mottle.mul(0.25)), p.z.mul(0.03)));
  const saltStreak = mx_noise_float(vec3(p.x.mul(0.35), p.y.mul(6.5).add(mottle.mul(0.6)), p.z.mul(0.35)));
  const saltPale = smoothstep(-0.1, 0.35, saltBed).mul(0.7).add(smoothstep(0.2, 0.5, saltStreak).mul(0.45)).add(blotch.mul(0.2)).clamp(0, 1);
  const saltHue = mix(mix(vec3(0.62, 0.58, 0.55), vec3(1.45, 1.43, 1.38), saltPale), vec3(1.3, 1.02, 0.95), smoothstep(0.4, 0.62, saltBed));
  const clay = thinLine(saltBed.sub(-0.45).abs().mul(0.4), float(0.01)).mul(steep);
  const ringCell = vec3(u.div(1.7).floor(), p.y.div(1.3).floor(), 2.9), ringJ = mx_cell_noise_float(ringCell).sub(0.5);
  const ringU = u.div(1.7).floor().add(0.5).add(ringJ.mul(0.5)).mul(1.7), ringY = p.y.div(1.3).floor().add(0.5).sub(ringJ.mul(0.4)).mul(1.3);
  const ringR = length(vec2(u.sub(ringU), p.y.sub(ringY)));
  const ring = thinLine(ringR.div(0.07).fract().sub(0.5).abs().mul(0.07), float(0.006)).mul(smoothstep(0.85, 0.4, ringR)).mul(smoothstep(-0.1, 0.3, mx_noise_float(p.mul(0.5).add(6.6)))).mul(steep);

  // Masonry: blocks (or bricks) in courses, each course half a block along from the last; flagstones
  // on the floors. Each block its own shade, its edges worn round, the mortar joints sunk in.
  const course = mix(float(0.6), surf.w, smoothstep(0.01, 0.04, surf.w));
  const row = p.y.div(course).floor(), bu = u.div(course.mul(2.2)).add(row.mul(0.5));
  const fy = p.y.div(course).fract(), fx = bu.fract();
  const wallJoint = min(min(fy, float(1).sub(fy)).mul(course), min(fx, float(1).sub(fx)).mul(course.mul(2.2)));
  const flag = course.mul(2).clamp(0.5, 1.2), frow = p.z.div(flag).floor(), fu = p.x.div(flag.mul(1.4)).add(frow.mul(0.5));
  const fz = p.z.div(flag).fract(), fxx = fu.fract();
  const floorJoint = min(min(fz, float(1).sub(fz)).mul(flag), min(fxx, float(1).sub(fxx)).mul(flag.mul(1.4)));
  const jointAt = mix(floorJoint, wallJoint, steep).add(grain.mul(0.006));
  const mortar = course.mul(0.03).max(0.005);
  const jointLine = thinLine(jointAt, mortar);
  // Blocks too small to see one by one (bricks far off) fade to an even wall instead of shimmering.
  const blockFade = smoothstep(0.3, 0.1, max(mix(fu, bu, steep).fwidth(), mix(p.z.div(flag), p.y.div(course), steep).fwidth()));
  const edge = smoothstep(mortar.mul(4), mortar, jointAt).mul(blockFade); // the worn round edge of a block
  const joint = jointLine.mul(blockFade.mul(0.8).add(0.2)).mul(masonry);
  const blockId = mix(vec3(fu.floor(), frow, 3.7), vec3(bu.floor(), row, 1.3), steep.round());
  const block = mx_cell_noise_float(blockId).sub(0.5).mul(blockFade).add(0.5); // 0..1, one per block
  // Flowstone (natural caves): smooth creamy sheets, ribbed by drips running down, rimmed pools on the floor.
  const drip = mx_noise_float(p.mul(vec3(2.4, 0.16, 2.4)).add(vec3(mottle.mul(0.6))));
  const rim = smoothstep(0.9, 0.99, sin(mottle.mul(6).add(p.y.mul(3))).mul(0.5).add(0.5)).mul(flat).mul(0.5);
  // The band's finish: concrete cast in board shuttering (boards' lines, each board its own shade, tie holes).
  const board = p.y.div(0.2).fract(), boardId = vec3(p.y.div(0.2).floor(), u.div(2.4).floor(), 7.1);
  const boardLine = thinLine(min(board, float(1).sub(board)).mul(0.2), float(0.012));
  const tie = thinLine(length(vec2(u.div(0.6).fract().sub(0.5), p.y.div(0.6).fract().sub(0.5))).mul(0.6), float(0.018));
  const shutter = worked.mul(steep).mul(ROCK_FINISH.formwork);

  // Height for the bump: per surface kind, blended.
  const hNatural = mottle.mul(0.3).add(cells.x.mul(0.45)).add(lumps.mul(0.12)).sub(seam.mul(0.12)).sub(tool.mul(0.12)).sub(crack.mul(0.25)).mul(float(1).sub(shutter.mul(0.7))).sub(ring.mul(0.04).mul(ROCK_FINISH.salt).mul(worked));
  const hMasonry = edge.oneMinus().mul(0.12).sub(joint.mul(0.2)).add(mottle.mul(0.1)).add(lumps.mul(0.06)).add(grain.mul(0.03));
  const hFlow = mottle.mul(0.25).add(drip.mul(0.18).mul(steep)).add(rim.mul(0.1)).add(sin(p.y.mul(38).add(drip.mul(9))).mul(0.006).mul(smoothstep(0.5, 0.2, p.y.mul(38).fwidth())));
  const height = mix(mix(hNatural, hMasonry, masonry), hFlow, flow).sub(boardLine.mul(0.05).add(tie.mul(0.15)).mul(shutter));
  m.normalNode = bumped(height, 0.35);

  // Colour: broad warmer and cooler stretches of stone, darker in the hollows, the seams and cracks
  // darker still, rust-brown streaks down the walls, damp darker floors.
  const tint = mx_fractal_noise_float(p.mul(0.3).add(17.0), 2, 2.0, 0.5); // a few metres across: one wall shows both
  const hue = mix(mix(vec3(1, 1, 1), vec3(1.14, 0.96, 0.78), smoothstep(0.0, 0.5, tint)), vec3(0.86, 0.92, 1.0), smoothstep(0.0, -0.5, tint));
  const natShade = float(0.9).add(mottle.mul(0.22)).add(strata.mul(0.16).mul(steep)).add(grain.mul(0.07)).add(grit.mul(0.1)).add(speck)
    .sub(seam.mul(0.4)).sub(tool.mul(0.1)).sub(crack.mul(0.65)).sub(damp.mul(0.3)).sub(clay.mul(0.4).add(ring.mul(0.05)).mul(ROCK_FINISH.salt));
  const masShade = float(0.72).add(block.mul(0.4)).add(fleck.mul(0.1)).add(mottle.mul(0.14)).add(grain.mul(0.08)).add(grit.mul(0.06)).sub(joint.mul(0.4)).sub(edge.mul(0.06)).sub(damp.mul(0.2));
  const flowBand = sin(p.y.mul(7).add(drip.mul(4)).add(mottle.mul(3))).mul(0.5).add(0.5); // the colour bands of a curtain
  const flowShade = float(1.0).add(drip.mul(0.14).mul(steep)).add(mottle.mul(0.1)).sub(rim.mul(0.12)).add(grain.mul(0.06)).add(speck.mul(0.5)).sub(flowBand.mul(0.12).mul(steep));
  const shade = mix(mix(natShade, masShade, masonry), flowShade, flow)
    .add(mx_cell_noise_float(boardId).sub(0.5).mul(0.12).sub(boardLine.mul(0.06)).sub(tie.mul(0.5)).mul(shutter))
    .mul(smoothstep(-0.55, 0.35, height).mul(0.35).add(0.65)); // hollows darker
  const rust = mix(vec3(1, 1, 1), vec3(0.95, 0.74, 0.55), streak.mul(0.65).mul(natural));
  const cream = mix(vec3(1, 1, 1), mix(vec3(1.08, 1.0, 0.86), vec3(1.12, 0.9, 0.7), flowBand.mul(steep)), flow);
  const blockHue = mix(vec3(1, 1, 1), mix(vec3(1.05, 1.0, 0.92), vec3(0.94, 0.98, 1.04), block), masonry);
  const salt = mix(vec3(1, 1, 1), saltHue, ROCK_FINISH.salt.mul(natural));
  m.colorNode = vertexColor().mul(shade).mul(mix(float(1), texture, float(1).sub(flow.mul(0.6)))).mul(stain).mul(salt).mul(hue).mul(rust).mul(cream).mul(blockHue);
  // Wet sheen: some stretches of rock run with water and shine in the lamps; flowstone is always damp.
  const wetMask = smoothstep(0.1, 0.5, mx_noise_float(p.mul(vec3(0.3, 0.05, 0.3)).add(-9.4))).mul(ROCK_FINISH.wet).add(flow.mul(0.6)).add(damp.mul(ROCK_FINISH.wet)).clamp(0, 1);
  m.roughnessNode = float(0.9).add(grain.mul(0.06)).sub(wetMask.mul(0.55));

  // Thin lines alias into glitter far off: they fade out with distance (the fog hides the rest).
  const near = smoothstep(55, 20, length(positionView));
  // Veins of infused salt (the Salt Works): thin glowing blue lines where a noise crosses zero,
  // branching finer near the main ones, only in some stretches of rock, pulsing slowly.
  const line = float(1).sub(abs(mx_noise_float(p.mul(0.16).add(vec3(mottle.mul(0.7))))));
  const fine = float(1).sub(abs(mx_noise_float(p.mul(0.55).add(13.1))));
  const stretch = smoothstep(0.15, 0.5, mx_noise_float(p.mul(0.045).add(vec3(7.3, 1.1, -4.2))));
  const vein = smoothstep(0.975, 0.996, line).add(smoothstep(0.985, 0.998, fine).mul(smoothstep(0.85, 0.97, line)).mul(0.7)).mul(stretch);
  const pulse = sin(time.mul(1.1).add(p.x.mul(0.13)).add(p.z.mul(0.09))).mul(0.15).add(0.85);
  // Salt crystals glinting in the headlamp (it is carried at the eye): tiny facets that catch the
  // light as the viewer moves, only close by.
  const facet = mx_worley_noise_float(p.mul(9));
  const twinkle = smoothstep(0.5, 0.85, mx_noise_float(p.mul(13).add(cameraPosition.mul(1.7))));
  const glint = smoothstep(0.16, 0.04, facet).mul(twinkle).mul(smoothstep(14, 2, length(positionView))).mul(natural.add(worked).clamp(0, 1)).mul(ROCK_FINISH.salt);
  m.emissiveNode = vec3(0.25, 0.6, 1.0).mul(vein.mul(pulse).mul(near).mul(ROCK_VEINS).mul(2.4)).add(vec3(0.85, 0.9, 1.0).mul(glint.mul(2.2)));
  return m;
});

/** How strongly the rock shows veins of glowing infused salt (the level's band: 0 in the Quarry). Set by `LevelView`. */
export const ROCK_VEINS = uniform(0);

/**
 * The band's finish of its rock (`band.finish`), set by `LevelView`: rock salt (dark grey-brown with pale,
 * level white beds and streaks, the cutting machines' groove rings, glinting in the headlamp), worked
 * walls cast in concrete against board shuttering, how wet the rock runs.
 */
export const ROCK_FINISH = { salt: uniform(0), formwork: uniform(0), wet: uniform(0) };

/**
 * A line `width` metres to either side of where `dist` (metres) is 0, antialiased: soft over a pixel,
 * and where it is thinner than a pixel, fainter instead of broken into dashes.
 */
function thinLine(dist: Node<'float'>, width: Node<'float'>) {
  const px = dist.fwidth().max(1e-4);
  return smoothstep(width.add(px), width.sub(px).max(0), dist).mul(width.mul(2).div(px).clamp(0, 1));
}

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

/**
 * Standing water: clear over the shallows (the floor shows through, tinted), dark and green-black
 * where it is deep, its surface stirred by slow ripples so the lamps and the headlamp glint and
 * wobble on it. Its vertex colour is the props' depth shade (pale shallow, near black deep). Same attributes as the solid kind.
 */
export const WATER = defineKind('water', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false, roughness: 0.04, metalness: 0 });
  const p = positionWorld, c = vertexColor();
  const deep = float(1).sub(smoothstep(0.03, 0.2, c.x)); // 0 shallow .. 1 deep, from the depth shade
  const ripple = mx_noise_float(vec3(p.x.mul(1.3), time.mul(0.35), p.z.mul(1.3))).mul(0.6)
    .add(mx_noise_float(vec3(p.x.mul(4.1).add(time.mul(0.4)), time.mul(0.6), p.z.mul(4.1))).mul(0.25));
  m.normalNode = bumped(ripple, 0.06);
  m.colorNode = mix(vec3(0.16, 0.2, 0.17), vec3(0.008, 0.022, 0.026), deep);
  m.opacityNode = mix(float(0.55), float(0.96), deep);
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
function defineCoat(name: string, roughness = 0.85): CoatKind {
  const maps: CoatMaps = { colour: new Texture(), normal: new Texture() };
  maps.colour.colorSpace = SRGBColorSpace;
  maps.normal.colorSpace = NoColorSpace;
  for (const t of [maps.colour, maps.normal]) t.flipY = false; // glTF's uvs
  const kind = defineKind(name, ['position', 'normal', 'uv'], () => {
    const m = new MeshStandardNodeMaterial({ roughness, metalness: 0 });
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

/** The slimes' skins (AssetGenerator specs creature_lumen_slime, creature_murk_slime): wet, so glossy. */
export const LUMEN_COAT = defineCoat('lumenCoat', 0.25);
export const MURK_COAT = defineCoat('murkCoat', 0.18);

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
