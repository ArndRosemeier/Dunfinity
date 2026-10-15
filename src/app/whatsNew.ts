/**
 * The version label and the "What's new" panel: the version history from CHANGELOG.md (one version
 * per merge, v0.001 up), shown in the game and the Lab.
 */
import changelog from '../../CHANGELOG.md?raw';
import { noteHtml, parseChangelog } from './changelog';
import { addStyle } from './panel';

/** The version this build is (the newest in CHANGELOG.md). */
export const VERSION = parseChangelog(changelog)[0]?.version ?? 'v?';

/** The version button (top right) and its panel. */
export function mountWhatsNew(host: HTMLElement): void {
  const releases = parseChangelog(changelog);
  addStyle(`
    #version { position: fixed; right: 12px; top: 10px; z-index: 10; font: inherit; color: #cfd6dc; background: #0b0d10cc; border: 1px solid #3a4148; border-radius: 4px; padding: 3px 9px; cursor: pointer; }
    #version:hover { border-color: #8a96a2; }
    #whatsnew { position: fixed; right: 12px; top: 40px; bottom: 12px; width: min(460px, calc(100vw - 24px)); z-index: 10; overflow-y: auto; background: #0b0d10ee; border: 1px solid #3a4148; border-radius: 6px; padding: 4px 16px 12px; display: none; }
    #whatsnew.open { display: block; }
    #whatsnew h2 { font-size: 15px; margin: 12px 0 2px; }
    #whatsnew h3 { font-size: 13px; margin: 14px 0 4px; color: #e8d9b8; }
    #whatsnew ul { margin: 0; padding-left: 18px; }
    #whatsnew li { margin: 3px 0; }
    #whatsnew code { font-size: 12px; color: #a9c3d6; }`);
  const button = document.createElement('button');
  button.id = 'version';
  button.textContent = `${releases[0]?.version ?? 'v?'} · What's new`;
  const panel = document.createElement('div');
  panel.id = 'whatsnew';
  panel.innerHTML = '<h2>What\'s new</h2>' + releases.map((r) =>
    `<h3>${r.version} · ${noteHtml(r.title)}</h3><ul>${r.notes.map((n) => `<li>${noteHtml(n)}</li>`).join('')}</ul>`).join('');
  const toggle = (open = !panel.classList.contains('open')) => {
    panel.classList.toggle('open', open);
    if (open && document.pointerLockElement) document.exitPointerLock();
  };
  button.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') toggle(false); });
  host.append(button, panel);
}
