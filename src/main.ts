import { startGame } from './game/Game';
import { mountWhatsNew } from './app/whatsNew';
import { LoadingScreen, NO_GRAPHICS, START_FAILED } from './app/loadingScreen';
import { GraphicsUnavailable } from './render/renderer';

const loading = new LoadingScreen(document.body);
mountWhatsNew(document.body);
// The Lab (?lab) is a tool, not the game: its code loads only when asked for.
const start = new URLSearchParams(location.search).has('lab') ? import('./lab/Lab').then((m) => m.startLab(document.body, loading)) : startGame(document.body, loading);
start.catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof GraphicsUnavailable) loading.fail(NO_GRAPHICS.title, NO_GRAPHICS.lines, detail);
  else loading.fail(START_FAILED.title, START_FAILED.lines, detail);
  throw err;
});
