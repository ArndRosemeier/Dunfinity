/**
 * The doors of grandma's house (depth 0): where each hangs, how wide, which way it swings. Pure
 * data; src/world/doors.ts opens and shuts them, src/render/props/doorView.ts draws them. The
 * quarry sheds' doors are the same kind of thing, hung by src/gen/sheds.ts.
 */
import { CELLAR } from './cellar';
import { TOWN } from './town';

/** What a door is: an inner door, her front door, the cellar's (the strange one), or a quarry shed's. */
export type DoorKind = 'inner' | 'front' | 'cellar' | 'shed';

export interface DoorSpec {
  /** The hinge, at the foot of the door. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  /** The panel's yaw when shut (its length runs along (cos, −sin) from the hinge), and the turn to open it (±π/2). */
  readonly shut: number;
  readonly swing: number;
  readonly kind: DoorKind;
  /** What the HUD calls it. */
  readonly name: string;
  /** What one sees the first time it is opened, if anything. */
  readonly says?: string;
}

const F = CELLAR.house.floor, S = CELLAR.stairs, D = TOWN.door;
const H = 2.0, Q = Math.PI / 2;

/** Her doors: the cellar's at the foot of its stairs, the front door, and the three inner ones off the hall. */
export const HOUSE_DOORS: readonly DoorSpec[] = [
  // At the foot of the turned stair, across its mouth, opening west into the cellar.
  { x: S.foot.x, y: 0, z: S.foot.z, width: S.foot.width, height: S.foot.height, shut: Q, swing: Q, kind: 'cellar', name: 'the cellar door' },
  // The front door, at the inside of the hall's west wall, opening into the hall.
  { x: CELLAR.house.x[0] - 0.05, y: F, z: D.z[0], width: D.z[1] - D.z[0], height: D.top - 0.05, shut: -Q, swing: Q, kind: 'front', name: 'the front door' },
  // The kitchen and her bedroom (north of the hall), the living room (south): into the room.
  { x: -9.4, y: F, z: 1.1, width: 1.0, height: H, shut: Math.PI, swing: Q, kind: 'inner', name: 'the kitchen door' },
  { x: -12.6, y: F, z: 1.1, width: 1.0, height: H, shut: Math.PI, swing: Q, kind: 'inner', name: 'the bedroom door' },
  { x: -11.2, y: F, z: -1.1, width: 1.0, height: H, shut: Math.PI, swing: -Q, kind: 'inner', name: 'the living-room door' },
];
