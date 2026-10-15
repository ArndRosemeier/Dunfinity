/** The body's state as the humanoid animator's move state (pure, so tests run it). */
import { groundSpeed } from '../../creatures/creature';
import type { MoveState } from '@futuremagic/humanoid/three';
import type { Body } from '../../world/traverse/body';

/** What the animator should play for the body's state. The gait (walk, run) follows the speed. */
export function moveOf(b: Body): MoveState {
  if (b.dead) return 'dead';
  if (b.mode === 'climb') return 'climb';
  if (b.mode === 'swim') return 'swim';
  if (!b.grounded) return b.vy > 0.5 ? 'jump' : b.vy < -2 ? 'fall' : 'walk';
  const speed = groundSpeed(b);
  return speed < 0.3 ? 'idle' : speed < 5 ? 'walk' : 'sprint';
}
