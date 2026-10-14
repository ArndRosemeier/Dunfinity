import { startLab } from './lab/Lab';
import { startGame } from './game/Game';

const start = new URLSearchParams(location.search).has('lab') ? startLab : startGame;
start(document.body).catch((err) => {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = `Could not start: ${err instanceof Error ? err.message : String(err)}`;
  throw err;
});
