/**
 * Headless screenshots of the game or the Lab (`?lab`): `npm run shot -- "<url query>" out.png [more pairs...]`.
 * Serves the production build (run `npm run build` first) and renders in Chromium with SwiftShader
 * (no GPU needed), so it works in the cloud container. Prints the page's console errors.
 * SwiftShader is slow: a deep level can take minutes to report ready, and a frame long enough that a
 * screenshot needs minutes too. `SHOT_WAIT=<ms>` waits that long after ready (creatures wake, packs close in).
 */
import { openShooter } from './shooter.mjs';

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2) {
  console.error('usage: npm run shot -- "<query>" out.png [...]');
  process.exit(2);
}
const shooter = await openShooter();
for (let i = 0; i < args.length; i += 2) {
  const { hud, shaders } = await shooter.shoot(args[i], args[i + 1]);
  console.log(`${args[i + 1]}: ${hud}`);
  console.log(shaders);
}
await shooter.close();
process.exit(shooter.failed ? 1 : 0);
