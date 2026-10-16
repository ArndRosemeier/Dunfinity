/**
 * The material registry (docs/SHADERS.md): every material in the game is made here, from a closed
 * list of kinds, so the set of shaders is known up front and compiled during warm-up. Guarded:
 * nothing outside this file may construct a material.
 *
 * Every mesh of a kind uses the kind's one material, so a kind is one shader; variation goes in
 * vertex attributes or uniforms, never in a new material. (When a kind needs per-mesh values,
 * Scale's sharedGraph pattern comes in: clones that share the node graph.)
 */
import { AdditiveBlending, MeshBasicNodeMaterial, MeshStandardNodeMaterial, NoColorSpace, SRGBColorSpace, Texture, Vector3, Vector4, type Material, type Node } from 'three/webgpu';
import { RECIPE_SIZE, ROCK_PRESETS, ROCK_SLOTS, ROCK_TYPES, packRecipe, type RockRecipe } from '../gen/rockTypes';
import { Fn, If, abs, attribute, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, cos, dot, faceDirection, float, length, max, min, mix, mod, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_cell_noise_float, mx_noise_float, mx_noise_vec3, mx_worley_noise_float, mx_worley_noise_vec2, hue, saturation, normalize, normalView, normalMap, normalWorld, positionGeometry, positionLocal, positionView, positionWorld, smoothstep, sin, texture, time, uniform, uniformArray, varying, vec2, vec3, vec4, vertexColor } from 'three/tsl';

export interface MaterialKind {
  readonly name: string;
  /** The geometry attributes meshes of this kind carry (warm-up builds a matching stand-in). Meshes are always indexed. */
  readonly attributes: readonly ('position' | 'normal' | 'color' | 'uv' | 'surface')[]; // 'surface' carries `rocks` and `rocks2` with it (meshes.ts `surfaceAttributes`)
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
 * uniforms (`ROCK_FINISH`: concrete cast in board shuttering, wet sheen; `ROCK_VEINS`); which rock it is, per
 * vertex (`rocks`, `rocks2`: the style's `RockMix`, src/gen/rockTypes.ts), in patches and beds.
 * Natural rock (all 0) is broken stone: mottled, bedded, cracked, iron-stained.
 */
export const ROCK = defineKind('rock', ['position', 'normal', 'color', 'surface'], () => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  const p = positionWorld;
  const surf = attribute<'vec4'>('surface', 'vec4');
  const tooled = surf.x, masonry = surf.y.clamp(0, 1), flow = surf.z.clamp(0, 1);
  const natural = float(1).sub(masonry).mul(float(1).sub(flow));
  const mottle = mx_fractal_noise_float(p.mul(0.32), 3, 2.0, 0.5); // about -1..1, metres-wide patches
  // Which rock this is: the style's mix of rock types (per vertex, src/gen/rockTypes.ts order:
  // limestone, sandstone, shale, granite, salt, basalt, marble, slate) laid out in patches and beds
  // 5-30 m across, each type winning where its own noise runs high, the edges between them soft.
  // Beds: the noise stretched level, so a type runs along a wall as a layer; blobs: patches.
  const rocksA = attribute<'vec4'>('rocks', 'vec4'), rocksB = attribute<'vec4'>('rocks2', 'vec4');
  const bedAt = vec3(p.x.mul(0.055), p.y.mul(0.32), p.z.mul(0.055)), blobAt = p.mul(0.035);
  const kindA = mx_fractal_noise_vec3(bedAt, 2, 2.0, 0.5).mul(0.6).add(mx_noise_vec3(blobAt).mul(0.5));
  const kindB = mx_fractal_noise_vec3(bedAt.add(17.3), 2, 2.0, 0.5).mul(0.6).add(mx_noise_vec3(blobAt.add(9.1)).mul(0.5));
  const kindC = mx_fractal_noise_vec3(bedAt.add(-31.7), 2, 2.0, 0.5).mul(0.6).add(mx_noise_vec3(blobAt.add(-4.4)).mul(0.5));
  const share = (w: Node<'float'>, n: Node<'float'>) => w.mul(smoothstep(-0.9, 0.9, n).pow(3)).add(0.00001);
  const ws = [share(rocksA.x, kindA.x), share(rocksA.y, kindA.y), share(rocksA.z, kindA.z), share(rocksA.w, kindB.x),
    share(rocksB.x, kindB.y), share(rocksB.y, kindB.z), share(rocksB.z, kindC.x), share(rocksB.w, kindC.y)];
  const kinds = ws.reduce((a, b) => a.add(b));
  const slots = ws.map((w) => smoothstep(0.35, 0.65, w.div(kinds)));
  const kindSum = slots.reduce((a, b) => a.add(b)).add(0.001);
  // How much of it is rock salt: its own patterns (beds, clay partings, the machines' rings, lumps).
  const saltShare = slots.map((s, i) => s.mul(recipe(i * 4 + 3).z)).reduce((a, b) => a.add(b));
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
  const tool = pick.mul(smoothstep(0.4, 0.15, gpos.fwidth())).mul(float(1).sub(saltShare)).mul(steep).mul(tooled.clamp(0, 1)).mul(float(1).sub(masonry)).mul(smoothstep(-0.4, 0.1, mx_noise_float(p.mul(0.4).add(5.3))));
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
  // Each rock type's own look: pale cream limestone; ochre sandstone in beds a hand thick, some
  // darker; dark shale split into thin laminae; grey-pink granite thick with dark and pale crystals.
  const sandBed = sin(p.y.mul(13).add(mottle.mul(2.5)).add(strata.mul(2))).mul(0.5).add(0.5);
  const lamina = thinLine(p.y.mul(16).add(mottle.mul(1.5)).fract().sub(0.5).abs().div(16), float(0.006)).mul(steep).mul(smoothstep(0.35, 0.12, p.y.mul(16).fwidth()));
  const crystal = mx_worley_noise_float(p.mul(28)).mul(smoothstep(1.0, 0.3, p.mul(28).x.fwidth()));
  const granSpot = smoothstep(0.3, 0.1, crystal).mul(0.45).sub(smoothstep(0.55, 0.85, crystal).mul(0.2));
  // Black basalt, its pale specks; white marble with grey veins; blue-grey slate split along its cleavage.
  const veinAt = mx_noise_float(p.mul(vec3(0.22, 0.5, 0.22)).add(vec3(mottle.mul(0.4)))).abs();
  const marbleVein = thinLine(veinAt.mul(1.2), float(0.01)).add(smoothstep(0.05, 0.0, veinAt).mul(0.25)).mul(smoothstep(-0.2, 0.3, mx_noise_float(p.mul(0.15).add(2.2))));
  const cleave = thinLine(p.y.mul(9).add(u.mul(3.5)).add(mottle).fract().sub(0.5).abs().div(9), float(0.005)).mul(smoothstep(0.35, 0.12, p.y.mul(9).add(u.mul(3.5)).fwidth()));
  // Each slot's stone from its recipe (src/gen/rockTypes.ts `RockRecipe`, four vec4s): its colour
  // shading through its beds, darkened along laminae and cleavage, pale or dark crystals, veins.
  let rockHue: Node<'vec3'> = vec3(0.001, 0.001, 0.001), veinGlow: Node<'vec3'> = vec3(0, 0, 0);
  for (let i = 0; i < ROCK_SLOTS; i++) {
    const a = recipe(i * 4), b = recipe(i * 4 + 1), c = recipe(i * 4 + 2), d = recipe(i * 4 + 3);
    const stone = mix(a.xyz, b.xyz, a.w.mul(sandBed)).mul(float(1).sub(b.w.mul(lamina))).mul(float(1).add(d.x.mul(granSpot))).mul(float(1).sub(d.y.mul(cleave)));
    rockHue = rockHue.add(mix(stone, c.xyz, c.w.mul(marbleVein)).mul(slots[i]));
    veinGlow = veinGlow.add(c.xyz.mul(marbleVein.mul(d.w).mul(slots[i])));
  }
  rockHue = rockHue.div(kindSum);
  const rockKind = mix(vec3(1, 1, 1), rockHue, float(1).sub(masonry).mul(float(1).sub(flow.mul(0.7))));
  // Rock salt (the Salt Works), as it looks in a real mine: dark grey-brown salt with pale, near white
  // beds and thin streaks running level along the walls, a pinkish bed here and there, dark clay
  // partings, and rings of fine grooves where the miners' cutting machines stopped.
  const saltBed = mx_noise_float(vec3(p.x.mul(0.03), p.y.mul(1.4).add(mottle.mul(0.25)), p.z.mul(0.03)));
  const saltStreak = mx_noise_float(vec3(p.x.mul(0.35), p.y.mul(6.5).add(mottle.mul(0.6)), p.z.mul(0.35)));
  const saltPale = smoothstep(0.25, 0.45, saltBed).mul(0.8).add(smoothstep(0.35, 0.55, saltStreak).mul(steep.mul(0.45).add(0.15))).add(blotch.mul(0.15)).clamp(0, 1);
  const saltHue = mix(mix(vec3(0.5, 0.46, 0.42), vec3(1.55, 1.52, 1.46), saltPale), vec3(1.05, 0.88, 0.74), smoothstep(-0.45, -0.25, saltBed).mul(smoothstep(-0.05, -0.25, saltBed)));
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
  const hNatural = mottle.mul(0.3).add(cells.x.mul(0.45)).add(lumps.mul(0.12)).sub(seam.mul(0.12)).sub(tool.mul(0.12)).sub(crack.mul(0.25)).mul(float(1).sub(shutter.mul(0.7))).sub(ring.mul(0.04).mul(saltShare).mul(worked)).add(lumps.mul(0.18).mul(saltShare));
  const hMasonry = edge.oneMinus().mul(0.12).sub(joint.mul(0.2)).add(mottle.mul(0.1)).add(lumps.mul(0.06)).add(grain.mul(0.03));
  const hFlow = mottle.mul(0.25).add(drip.mul(0.18).mul(steep)).add(rim.mul(0.1)).add(sin(p.y.mul(38).add(drip.mul(9))).mul(0.006).mul(smoothstep(0.5, 0.2, p.y.mul(38).fwidth())));
  // What covers the rock (per vertex, `cover`: src/gen/style.ts `Cover`): moss, bark.
  const cov = attribute<'vec2'>('cover', 'vec2');
  // Moss: on floors, ledges and the tops of things, as lush as the style says, thick in patches and
  // broken at its edges, a few tufts up the walls; cushions a hand across, a fine fuzz of fronds.
  const mossEdge = blotch; // (the rock's own noises, reused: no new ones for the cover but where it needs its own scale)
  const tuft = smoothstep(0.2, 0.5, mottle);
  const mossBed = cov.x.mul(smoothstep(0.1, 0.7, normalWorld.y).add(tuft.mul(steep).mul(0.45)));
  const moss = smoothstep(0.3, 0.55, mossBed.add(mossEdge.mul(0.3)));
  const fuzzAt = p.mul(36);
  // (Its own noises only where there is moss, its bark's only on a root: bare rock pays nothing for them. Their
  // fades by distance are taken out here, where every pixel runs: derivatives inside a branch are undefined.)
  const mossNoise = Fn(() => {
    const n = vec2(0, 0.5).toVar();
    If(moss.greaterThan(0.001), () => { n.assign(vec2(mx_noise_float(fuzzAt), mx_worley_noise_float(p.mul(2.4).add(1.7)))); });
    return n;
  })();
  const fuzz = mossNoise.x.mul(smoothstep(1.0, 0.3, fuzzAt.x.fwidth()));
  const cushion = mossNoise.y;
  const mossHue = mix(vec3(0.05, 0.11, 0.025), vec3(0.17, 0.3, 0.06), fuzz.mul(0.5).add(0.5)).mul(float(1.2).sub(cushion.mul(0.6)))
    .add(vec3(0.14, 0.12, 0.0).mul(smoothstep(0.3, 0.7, mottle))); // yellower, drier stretches
  // Bark (a root): fibrous ridges and deep furrows running along the root, the long way being the
  // axis its surface faces least; grey-green lichen in places.
  const an = abs(normalWorld), least = min(min(an.x, an.y), an.z);
  const along = vec3(smoothstep(0.0, 0.4, an.x.sub(least)), smoothstep(0.0, 0.4, an.y.sub(least)), smoothstep(0.0, 0.4, an.z.sub(least))).mul(0.8).add(0.2);
  const barkAt = p.mul(along).mul(4.5);
  const bark = smoothstep(0.3, 0.7, cov.y);
  const barkNoise = Fn(() => {
    const n = vec2(0, 0).toVar();
    If(bark.greaterThan(0.001), () => { n.assign(vec2(mx_noise_float(barkAt.add(vec3(mottle.mul(0.6)))), mx_noise_float(barkAt.mul(3)))); });
    return n;
  })();
  const barkFade = barkAt.fwidth().length();
  const ridge = float(1).sub(abs(barkNoise.x)).pow(2).sub(0.5).mul(smoothstep(0.6, 0.2, barkFade)).add(0.5);
  const barkFine = barkNoise.y.mul(smoothstep(0.2, 0.067, barkFade));
  const lichen = smoothstep(0.25, 0.55, blotch);
  const barkHue = mix(vec3(0.13, 0.09, 0.06), vec3(0.32, 0.24, 0.16), ridge).mul(barkFine.mul(0.15).add(1)).mul(mix(vec3(1, 1, 1), vec3(1.25, 1.35, 1.1), lichen.mul(0.6)));
  const height = mix(mix(mix(hNatural, hMasonry, masonry), hFlow, flow).sub(boardLine.mul(0.05).add(tie.mul(0.15)).mul(shutter)),
    ridge.mul(0.1).add(barkFine.mul(0.015)), bark)
    .add(cushion.oneMinus().mul(0.25).add(fuzz.mul(0.03)).mul(moss));
  m.normalNode = bumped(height, 0.35);

  // Colour: broad warmer and cooler stretches of stone, darker in the hollows, the seams and cracks
  // darker still, rust-brown streaks down the walls, damp darker floors.
  const tint = mx_fractal_noise_float(p.mul(0.3).add(17.0), 2, 2.0, 0.5); // a few metres across: one wall shows both
  const hue = mix(mix(vec3(1, 1, 1), vec3(1.14, 0.96, 0.78), smoothstep(0.0, 0.5, tint)), vec3(0.86, 0.92, 1.0), smoothstep(0.0, -0.5, tint));
  // Across the cave: whole stretches of wall tens of metres long run lighter or darker, ochre or
  // grey-brown, so no two walls look alike.
  const broad = mx_fractal_noise_float(p.mul(0.07).add(vec3(-31.0, 5.5, 12.0)), 2, 2.0, 0.5), broadHue = mx_noise_float(p.mul(0.05).add(44.0));
  const region = mix(mix(vec3(1, 1, 1), vec3(1.12, 0.99, 0.84), smoothstep(0.05, 0.45, broadHue)), vec3(0.8, 0.82, 0.86), smoothstep(-0.05, -0.45, broadHue))
    .mul(broad.mul(0.55).add(1).clamp(0.62, 1.3));
  const natShade = float(0.9).add(mottle.mul(0.22)).add(strata.mul(0.16).mul(steep)).add(grain.mul(0.07)).add(grit.mul(0.1)).add(speck)
    .sub(seam.mul(0.4)).sub(tool.mul(0.1)).sub(crack.mul(0.65)).sub(damp.mul(0.3)).sub(clay.mul(0.4).add(ring.mul(0.05)).mul(saltShare));
  const masShade = float(0.72).add(block.mul(0.4)).add(fleck.mul(0.1)).add(mottle.mul(0.14)).add(grain.mul(0.08)).add(grit.mul(0.06)).sub(joint.mul(0.4)).sub(edge.mul(0.06)).sub(damp.mul(0.2));
  const flowBand = sin(p.y.mul(7).add(drip.mul(4)).add(mottle.mul(3))).mul(0.5).add(0.5); // the colour bands of a curtain
  const flowShade = float(1.0).add(drip.mul(0.14).mul(steep)).add(mottle.mul(0.1)).sub(rim.mul(0.12)).add(grain.mul(0.06)).add(speck.mul(0.5)).sub(flowBand.mul(0.12).mul(steep));
  const shade = mix(mix(natShade, masShade, masonry), flowShade, flow)
    .add(mx_cell_noise_float(boardId).sub(0.5).mul(0.12).sub(boardLine.mul(0.06)).sub(tie.mul(0.5)).mul(shutter))
    .mul(smoothstep(-0.55, 0.35, height).mul(0.35).add(0.65)); // hollows darker
  const rust = mix(vec3(1, 1, 1), vec3(0.95, 0.74, 0.55), streak.mul(0.65).mul(natural));
  const cream = mix(vec3(1, 1, 1), mix(vec3(1.08, 1.0, 0.86), vec3(1.12, 0.9, 0.7), flowBand.mul(steep)), flow);
  const blockHue = mix(vec3(1, 1, 1), mix(vec3(1.05, 1.0, 0.92), vec3(0.94, 0.98, 1.04), block), masonry);
  const salt = mix(vec3(1, 1, 1), saltHue, saltShare.mul(natural));
  const stone = vertexColor().mul(shade).mul(mix(float(1), texture, float(1).sub(flow.mul(0.6)))).mul(stain).mul(rockKind).mul(salt).mul(hue).mul(region).mul(rust).mul(cream).mul(blockHue);
  m.colorNode = mix(mix(stone, barkHue, bark), mossHue, moss);
  // Wet sheen: some stretches of rock run with water and shine in the lamps; flowstone is always damp.
  const wetMask = smoothstep(0.1, 0.5, mx_noise_float(p.mul(vec3(0.3, 0.05, 0.3)).add(-9.4))).mul(ROCK_FINISH.wet).add(flow.mul(0.6)).add(damp.mul(ROCK_FINISH.wet)).clamp(0, 1);
  m.roughnessNode = float(0.9).add(grain.mul(0.06)).sub(wetMask.mul(0.55)).add(moss.mul(0.1)).clamp(0.05, 1);

  // Thin lines alias into glitter far off: they fade out with distance (the fog hides the rest).
  const near = smoothstep(55, 20, length(positionView));
  // Veins of infused salt (the Salt Works): thin glowing blue lines where a noise crosses zero,
  // branching finer near the main ones, only in some stretches of rock, pulsing slowly. They creep:
  // the noise drifts through the rock a few centimetres a second, so a line wanders, splits and fades.
  const creep = vec3(0.3, 1, -0.4).mul(time.mul(VEIN_CREEP));
  const line = float(1).sub(abs(mx_noise_float(p.mul(0.16).add(vec3(mottle.mul(0.7))).add(creep))));
  const fine = float(1).sub(abs(mx_noise_float(p.mul(0.55).add(13.1).add(creep.mul(2)))));
  const stretch = smoothstep(0.15, 0.5, mx_noise_float(p.mul(0.045).add(vec3(7.3, 1.1, -4.2))));
  const vein = smoothstep(0.975, 0.996, line).add(smoothstep(0.985, 0.998, fine).mul(smoothstep(0.85, 0.97, line)).mul(0.7)).mul(stretch);
  const pulse = sin(time.mul(1.1).add(p.x.mul(0.13)).add(p.z.mul(0.09))).mul(0.15).add(0.85);
  // Salt crystals glinting in the headlamp (it is carried at the eye): tiny facets that catch the
  // light as the viewer moves, only close by.
  const facet = mx_worley_noise_float(p.mul(9));
  const twinkle = smoothstep(0.5, 0.85, mx_noise_float(p.mul(13).add(cameraPosition.mul(1.7))));
  const glint = smoothstep(0.16, 0.04, facet).mul(twinkle).mul(smoothstep(14, 2, length(positionView))).mul(natural.add(worked).clamp(0, 1)).mul(saltShare);
  m.emissiveNode = vec3(0.25, 0.6, 1.0).mul(vein.mul(pulse).mul(near).mul(ROCK_VEINS).mul(2.4)).add(vec3(0.85, 0.9, 1.0).mul(glint.mul(2.2))).add(veinGlow.div(kindSum).mul(near));
  return m;
});

/**
 * The level's rock recipes, one per slot (src/gen/rockTypes.ts `RockRecipe`, packed four vec4s each by
 * `packRecipe`); a vertex's `rocks`, `rocks2` weigh the slots. Uniforms: any stone, never a new shader.
 * Set by `LevelView` (`setRockRecipes`).
 */
export const ROCK_RECIPES = uniformArray(Array.from({ length: ROCK_SLOTS * 4 }, () => new Vector4()), 'vec4');

/** The k-th vec4 of `ROCK_RECIPES`. */
const recipe = (k: number) => ROCK_RECIPES.element(k) as unknown as Node<'vec4'>;

/** Load `recipes` (one per slot) into `ROCK_RECIPES`. */
export function setRockRecipes(recipes: readonly RockRecipe[]): void {
  const packed = new Array<number>(ROCK_SLOTS * RECIPE_SIZE).fill(0);
  recipes.forEach((r, i) => packRecipe(r, packed, i * RECIPE_SIZE));
  (ROCK_RECIPES.array as Vector4[]).forEach((v, k) => v.fromArray(packed, k * 4));
}
setRockRecipes(ROCK_TYPES.map((t) => ROCK_PRESETS[t]));

/** How fast the glowing veins creep (noise units a second: 0.004 moves a line about 2.5 cm a second). */
const VEIN_CREEP = 0.004;

/** How strongly the rock shows veins of glowing infused salt (the level's band: 0 in the Quarry). Set by `LevelView`. */
export const ROCK_VEINS = uniform(0);

/**
 * The band's finish of its rock (`band.finish`), set by `LevelView`: worked walls cast in concrete
 * against board shuttering, how wet the rock runs. (Which rock it is comes per vertex: `rocks`.)
 */
export const ROCK_FINISH = { formwork: uniform(0), wet: uniform(0) };

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

/**
 * A house of the town (src/gen/townProps.ts): its walls in render, painted the vertex colour, blotchy,
 * streaked by rain, grimy in patches and cracked; what faces up (its roof) in rows of overlapping tiles,
 * clay or slate as the colour says, each tile its own shade. A light shader of its own: the rock's is
 * far too heavy for props (the town's shells drawn with it stall a software renderer).
 */
export const HOUSE = defineKind('house', ['position', 'normal', 'color'], () => {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const p = positionWorld, roof = smoothstep(0.3, 0.45, normalWorld.y);
  const u = abs(normalWorld.x).greaterThan(abs(normalWorld.z)).select(p.z, p.x);
  // Render: blotches a hand across, a fine sandy grain, rain streaks, grime, a few hairline cracks.
  const blotch = mx_fractal_noise_float(p.mul(2.3).add(4.4), 2, 2.0, 0.5);
  const grainAt = p.mul(14), grain = mx_noise_float(grainAt).mul(smoothstep(1.0, 0.3, grainAt.fwidth().length()));
  const streak = smoothstep(0.15, 0.65, mx_noise_float(p.mul(vec3(0.7, 0.07, 0.7)).add(13.7)));
  const grime = smoothstep(0.0, 0.6, mx_noise_float(p.mul(vec3(0.5, 0.15, 0.5)).add(3.3)));
  const crack = thinLine(abs(mx_noise_float(p.mul(0.9).add(7.1))), float(0.012)).mul(smoothstep(0.35, 0.6, mx_noise_float(p.mul(0.35).add(2.2))));
  const render = vertexColor().mul(blotch.mul(0.1).add(grain.mul(0.06)).add(1)).mul(float(1).sub(streak.mul(0.22)).sub(crack.mul(0.5)))
    .mul(mix(vec3(1, 1, 1), vec3(0.72, 0.68, 0.6), grime));
  // Tiles: rows up the slope, each row half a tile along from the last, a shadow under each row's edge.
  const row = p.y.div(0.13), along = u.div(0.22).add(row.floor().mul(0.5));
  const edge = smoothstep(0.75, 1.0, row.fract()), gap = thinLine(min(along.fract(), float(1).sub(along.fract())).mul(0.22), float(0.006));
  const fade = smoothstep(0.35, 0.12, row.fwidth());
  const tile = vertexColor().mul(mx_cell_noise_float(vec3(along.floor(), row.floor(), 5.5)).mul(0.4).add(0.8)).mul(float(1).sub(edge.mul(0.45).add(gap.mul(0.5)).mul(fade)));
  m.colorNode = mix(render, tile, roof);
  m.normalNode = bumped(mix(blotch.mul(0.04).add(grain.mul(0.01)).sub(crack.mul(0.08)), float(1).sub(edge.mul(fade)).mul(0.1), roof), 0.35);
  m.roughnessNode = float(0.92).sub(roof.mul(0.25));
  return m;
});

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

/**
 * A coat as a deeper stratum's kin wear it (src/creatures/kin.ts): its hue turned (radians), its
 * saturation and lightness scaled, and a pattern of stripes or spots darkened into it (`pattern` 0:
 * none), `grain` to the metre on the creature's rest shape, so it holds still on the moving body.
 * Uniforms: one stratum's kin is set when its level is shown, and never a new shader.
 */
export interface CoatLook {
  readonly hue: { value: number };
  readonly sat: { value: number };
  readonly val: { value: number };
  readonly pattern: { value: number };
  readonly stripes: { value: number };
  readonly grain: { value: number };
}

/** A coat kind: lit, from its own two maps (filled in when the creature's glb loads: src/render/creatures/rigged.ts), worn as its `look` says. */
export interface CoatKind extends MaterialKind {
  readonly maps: CoatMaps;
  readonly look: CoatLook;
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
  const look = { hue: uniform(0), sat: uniform(1), val: uniform(1), pattern: uniform(0), stripes: uniform(0), grain: uniform(5) };
  const kind = defineKind(name, ['position', 'normal', 'uv'], () => {
    const m = new MeshStandardNodeMaterial({ roughness, metalness: 0 });
    const p = positionGeometry.mul(look.grain);
    const wobble = mx_noise_float(p.mul(0.7));
    // Stripes across the body (its length is the rest shape's z) or spots: 1 where the coat darkens.
    const stripe = smoothstep(0.2, 0.7, sin(p.z.mul(2.2).add(wobble.mul(2.5))));
    const spot = smoothstep(0.15, 0.4, mx_noise_float(p.mul(1.3)));
    const mark = mix(spot, stripe, look.stripes).mul(look.pattern);
    const coat = saturation(hue(texture(maps.colour).rgb, look.hue), look.sat).mul(look.val);
    m.colorNode = coat.mul(float(1).sub(mark.mul(0.75)));
    m.normalNode = normalMap(texture(maps.normal));
    return m;
  });
  return Object.assign(kind, { maps, look });
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

/** The brine eels' skin (AssetGenerator spec creature_brine_eel): slimy. */
export const EEL_COAT = defineCoat('eelCoat', 0.35);

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
