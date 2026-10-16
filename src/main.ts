import { startLab } from './lab/Lab';
import { startGame } from './game/Game';
import { mountWhatsNew } from './app/whatsNew';
import { LoadingScreen, NO_GRAPHICS, START_FAILED } from './app/loadingScreen';
import { GraphicsUnavailable } from './render/renderer';

const loading = new LoadingScreen(document.body);
mountWhatsNew(document.body);
const start = new URLSearchParams(location.search).has('lab') ? startLab : startGame;
start(document.body, loading).catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof GraphicsUnavailable) loading.fail(NO_GRAPHICS.title, NO_GRAPHICS.lines, detail);
  else loading.fail(START_FAILED.title, START_FAILED.lines, detail);
  throw err;
});
