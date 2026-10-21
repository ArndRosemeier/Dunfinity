/** The body's state as the figure animator's move state (pure, so tests run it). */
import { groundSpeed } from '../../creatures/creature';
import type { MoveState } from '../actors/figure';
import { MOVE, type Body } from '../../world/traverse/body';

/** What the animator should play for the body's state. The gait (walk, run) follows the speed. */
export function moveOf(b: Body): MoveState {
  if (b.dead) return 'dead';
  if (b.mode === 'climb') return 'climb';
  if (b.mode === 'swim') return 'swim';
  if (!b.grounded) return b.vy > 0.5 ? 'jump' : b.vy < -2 ? 'fall' : 'walk';
  const speed = groundSpeed(b);
  return speed < 0.3 ? 'idle' : speed < 5 ? 'walk' : 'sprint';
}

/**
 * The swim pose lies in the water at about hip height, not standing on the body's floating feet
 * (`MOVE.float` under the water): its water line is `line` of the human's height over the feet,
 * where the head rides at the surface with the face out. The figure is lifted to it while swimming,
 * at `rate` metres a second, so standing up in the shallows is no jump.
 */
export const SWIM = { line: 0.64, rate: 1.5 } as const;

/** How far the figure is drawn over a swimming body of a human `height` metres tall. */
export function swimLift(height: number): number {
  return MOVE.float - SWIM.line * height;
}
