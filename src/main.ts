import { startLab } from './lab/Lab';

startLab(document.body).catch((err) => {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = `Could not start: ${err instanceof Error ? err.message : String(err)}`;
  throw err;
});
