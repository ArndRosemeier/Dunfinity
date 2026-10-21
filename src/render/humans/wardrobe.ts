/**
 * What the figures hold and wear on their sockets (src/render/actors/rig.ts), built in grip or head
 * space from the game's own models: Grandma's kitchen knife, the modelled hatchet, pick and crowbar,
 * Kemal's flashlight and umbrella, Grandma's pot lid and Kemal's hard hat.
 */
import { Group, type Mesh, type Object3D } from 'three/webgpu';
import { PropBuilder } from '../../gen/propMesh';
import { propModel } from '../../gen/models';
import { meshFromData } from '../meshes';
import { METAL, VERTEX_COLOR_SOLID } from '../materials';
import type { Item } from '../../loot/items';


/**
 * A held thing in grip space, from its parts: wood (or anything plain) and metal, built by `build`
 * into two PropBuilders, turned `tilt` radians about the fist's x.
 */
function held(build: (wood: PropBuilder, metal: PropBuilder) => void, tilt = 0): Object3D {
  const wood = new PropBuilder(), metal = new PropBuilder();
  build(wood, metal);
  const g = new Group();
  for (const [b, kind] of [[wood, VERTEX_COLOR_SOLID], [metal, METAL]] as const) {
    const data = b.build();
    if (!data) continue;
    const m: Mesh = meshFromData(data, kind);
    m.rotation.x = tilt;
    m.matrixAutoUpdate = true;
    g.add(m);
  }
  return g;
}

/**
 * Grandma's kitchen knife, in grip space (the fist round the handle at the origin, the blade up +y,
 * the edge towards -x): a dark wooden handle with two rivets, a steel blade with a curved belly.
 */
export function kitchenKnife(): Object3D {
  // Built blade up (+Y, out of the thumb side of the fist), edge along +Z, then turned about the
  // fist's x so the blade carries on the line of the forearm: held for a thrust, not like a hammer.
  return held((wood, steel) => {
    wood.upright(0, 0, 0, 0, 0.008, 0.055, 0.011, [0.12, 0.07, 0.04]);
    for (const y of [-0.025, 0.025]) wood.upright(0, y, 0, 0, 0.0085, 0.004, 0.004, [0.5, 0.48, 0.45]);
    steel.upright(0, 0.059, 0.001, 0, 0.006, 0.004, 0.012, [0.55, 0.56, 0.58]); // bolster
    // The blade: the spine straight along -z, the belly narrowing to the tip.
    const blade: [number, number, number][] = [[0.063, 0.16, 0.017], [0.16, 0.2, 0.0125], [0.2, 0.222, 0.0065], [0.222, 0.232, 0.0025]];
    for (const [y0, y1, hw] of blade) steel.box(0, (y0 + y1) / 2, -0.011 + hw, [0.0012, 0, 0], [0, (y1 - y0) / 2, 0], [0, 0, hw], [0.62, 0.63, 0.65]);
  }, KNIFE_TILT);
}

/**
 * A modelled tool held in the fist (the hatchet, pick and crowbar from AssetGenerator's Blender
 * props: origin at the butt of the handle, the handle up +y), stamped so the fist closes a hand's
 * breadth above the butt.
 */
function tool(name: 'held_hatchet' | 'held_pick' | 'held_crowbar'): Object3D {
  return held((paint) => paint.stamp(propModel(name), 0, -GRIP_UP, 0, 0));
}

/** How far above the butt of a modelled tool's handle the fist holds it, metres. */
const GRIP_UP = 0.07;

/** What each held item is built from (its defId, as the Salt-Touched's pick and the scavengers' crowbars use too), and its shape (for the grip). */
const TOOLS: Readonly<Record<string, readonly ['held_hatchet' | 'held_pick' | 'held_crowbar', string]>> = {
  hatchet: ['held_hatchet', 'axe-hatchet'],
  pick: ['held_pick', 'pick'],
  crowbar: ['held_crowbar', 'crowbar'],
};

/**
 * Kemal's flashlight, in grip space (along the forearm, the lamp end forward): a
 * black rubber barrel with a ridged grip and a chrome head round the glass.
 */
function flashlight(): Object3D {
  return held((rubber, chrome) => {
    rubber.tube(0, -0.07, 0, 0, 0.1, 0, 0.017, [0.06, 0.06, 0.065]);
    for (const y of [-0.04, -0.01, 0.02]) rubber.tube(0, y, 0, 0, y + 0.012, 0, 0.0185, [0.1, 0.1, 0.11]);
    chrome.tube(0, 0.1, 0, 0, 0.145, 0, 0.025, [0.62, 0.63, 0.66]);
    rubber.tube(0, 0.143, 0, 0, 0.147, 0, 0.022, [0.9, 0.88, 0.7]); // the glass
  }, FLASHLIGHT_TILT);
}

/** Kemal's big black umbrella, furled, in grip space like the knife: the crook in the fist, the ferrule forward. */
function umbrella(): Object3D {
  return held((wood) => {
    wood.ellipsoid(0, -0.06, 0, 0.022, 0.03, 0.022, [0.22, 0.13, 0.06], 8); // the crook
    wood.tube(0, -0.04, 0, 0, 0.62, 0, 0.007, [0.08, 0.08, 0.085]);
    wood.cylinder(0, 0.36, 0, 0.04, 0.2, [0.04, 0.04, 0.045], 10, 0.1, -0.75); // the furled canopy
  }, KNIFE_TILT);
}

/**
 * Grandma's pot lid, as a shield (on the forearm socket: its
 * face out along +z): dented blue enamel, a black rim and a wooden knob.
 */
function potLid(): Object3D {
  // Built face up (+y); the shield's face is +z.
  return held((wood, enamel) => {
    enamel.cylinder(0, 0, 0, 0.17, 0.008, [0.16, 0.24, 0.38], 20);
    enamel.cylinder(0, 0, 0, 0.175, 0.004, [0.05, 0.05, 0.06], 20);
    enamel.ellipsoid(0.06, 0.012, 0.03, 0.04, 0.006, 0.035, [0.12, 0.17, 0.26], 6); // the dent
    wood.cylinder(0, 0.025, 0, 0.022, 0.015, [0.2, 0.12, 0.06], 8);
  }, Math.PI / 2);
}

/**
 * The miner's hard hat on the head socket (its frame is the body's: +z forward): the packed model
 * (origin at the brim's centre underneath, lamp forward, made for a head of radius 0.1 m) scaled to
 * this head and lifted from the socket at ear height to sit on the crown.
 */
export function hardHat(headRadius: number): Object3D {
  const k = headRadius / HAT.radius;
  return held((paint) => paint.stamp(propModel('wear_hard_hat'), 0, headRadius * HAT.lift, HAT.forward * headRadius, 0, { scale: k }));
}

/** The hard hat's fit: the head it was made for, how far above the socket its brim sits and how far forward (both in head radii). */
const HAT = { radius: 0.1, lift: 0.3, forward: 0.05 } as const;

/**
 * How far the knife is turned from blade-up in the fist, radians: not at all, so the handle runs
 * through the closed fist and the blade comes out of the thumb side (the figure's guard turns the
 * forearm so that points at the foe). Turned further, the handle lay across the top of the fingers.
 */
const KNIFE_TILT = 0;
/** How far the flashlight is turned in the off hand's fist, radians: along the forearm, the lamp forward. */
const FLASHLIGHT_TILT = 2.7;

/** A held thing by its id (the knife, a tool, the pot lid, the flashlight, the umbrella), built in grip space. */
export function buildHeld(defId: string): Object3D {
  if (defId === 'knife') return kitchenKnife();
  if (TOOLS[defId]) return tool(TOOLS[defId][0]);
  if (defId === 'potlid') return potLid();
  if (defId === 'flashlight') return flashlight();
  if (defId === 'umbrella') return umbrella();
  throw new Error(`no held item "${defId}"`);
}

/** The tool of the kit `items` that is carried (a hatchet, pick or crowbar), if any. */
export const heldTool = (items: readonly Item[]): string | null => items.find((it) => TOOLS[it.kind])?.kind ?? null;
