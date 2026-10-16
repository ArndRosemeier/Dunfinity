/**
 * The version label and the "What's new" panel: the version history from CHANGELOG.md (one version
 * per merge, v0.001 up), shown in the game and the Lab.
 */
import changelog from '../../CHANGELOG.md?raw';
import { noteHtml, parseChangelog } from './changelog';
import { growOn } from './growth';
import { addStyle, button, child } from './panel';

/** The version this build is (the newest in CHANGELOG.md). */
export const VERSION = parseChangelog(changelog)[0]?.version ?? 'v?';

/** The version button (top right) and its panel. */
export function mountWhatsNew(host: HTMLElement): void {
  const releases = parseChangelog(changelog);
  addStyle(`
    #version { position: fixed; right: 12px; top: 10px; z-index: 10; }
    #whatsnew { position: fixed; right: 12px; top: 44px; width: min(460px, calc(100vw - 24px)); z-index: 10;
      visibility: hidden; opacity: 0; transform: translateY(-6px); transition: opacity .18s var(--ui-ease), transform .18s var(--ui-ease), visibility 0s .18s; }
    #whatsnew.open { visibility: visible; opacity: 1; transform: none; transition: opacity .18s var(--ui-ease), transform .18s var(--ui-ease); }
    #whatsnew > .ui-scroll { max-height: calc(100vh - 58px); padding: 6px 18px 14px; }
    #whatsnew h2 { margin: 12px 0 4px; }
    #whatsnew h3 { font: 700 14px var(--ui-font); margin: 16px 0 4px; color: var(--ui-accent); }
    #whatsnew ul { margin: 0; padding-left: 18px; color: var(--ui-ink); }
    #whatsnew li { margin: 3px 0; }
    #whatsnew li::marker { color: var(--ui-ink-faint); }
    #whatsnew code { font-size: 12px; color: var(--ui-salt); }`);
  const version = button(host, `${releases[0]?.version ?? 'v?'} · What's new`, () => toggle(), 'ui-btn small');
  version.id = 'version';
  const panel = document.createElement('div');
  panel.id = 'whatsnew';
  panel.className = 'ui-panel';
  const text = child(panel, 'div', 'ui-scroll');
  growOn(panel, 'whatsnew', { amount: 0.8 });
  text.innerHTML = '<h2 class="ui-title">What\'s new</h2>' + releases.map((r) =>
    `<h3>${r.version} · ${noteHtml(r.title)}</h3><ul>${r.notes.map((n) => `<li>${noteHtml(n)}</li>`).join('')}</ul>`).join('');
  const toggle = (open = !panel.classList.contains('open')) => {
    panel.classList.toggle('open', open);
    if (open && document.pointerLockElement) document.exitPointerLock();
  };
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') toggle(false); });
  host.append(panel);
}
