/**
 * The HUD (docs/design/ui.md): health and stamina top left with what just hurt, a boss's bar at the
 * top, the level's name as one arrives, the notice of the moment, what E (or another key) would do
 * now, grandma's salt, purse and the pack top right, and the keys while in the cellar.
 * The game hands it a `HudState` each frame (`render`); it touches the DOM only where something changed.
 *
 * `#hud` (the page's text HUD, still the Lab's) keeps the same lines as text, hidden, for the shot
 * tools that read it.
 */
import { growOn } from './growth';
import { child, esc, keycap, panel } from './panel';

const STYLE = `
  #hud { display: none; }
  #game-hud { position: fixed; inset: 0; pointer-events: none; z-index: 3; color: var(--ui-ink); font: 14px/1.35 var(--ui-font); text-shadow: var(--ui-text-shadow); }
  #game-hud .left { position: absolute; left: 16px; top: 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  #game-hud .vitals { position: relative; width: 250px; box-sizing: border-box; padding: 9px 12px 10px; display: grid; grid-template-columns: auto 1fr auto; gap: 5px 9px; align-items: center; }
  #game-hud .vitals .ui-label { font-size: 10px; }
  #game-hud .vitals .ui-meter { height: 9px; }
  #game-hud .vitals .num { font: 700 13px var(--ui-font); min-width: 24px; text-align: right; }
  #game-hud .vitals .mode { grid-column: 1 / -1; font-size: 12px; color: var(--ui-ink-dim); display: none; }
  #game-hud .hurt { padding-left: 2px; min-height: 18px; color: #ff8a70; font: 700 14px var(--ui-font); opacity: 0; transition: opacity .3s; }
  #game-hud .hurt.on { opacity: 1; transition: none; }
  #game-hud .tally { padding-left: 2px; font-size: 12px; color: var(--ui-ink-dim); white-space: pre; }
  #game-hud .purse { position: absolute; right: 16px; top: 50px; padding: 7px 12px; display: flex; flex-direction: column; gap: 2px; align-items: flex-end; font-size: 13px; }
  #game-hud .purse .salt { color: var(--ui-salt); font-weight: 700; }
  #game-hud .purse .salt::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: var(--ui-vein); box-shadow: 0 0 6px var(--ui-vein); vertical-align: .05em; }
  #game-hud .purse .dim { color: var(--ui-ink-dim); }
  #game-hud .boss { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); width: min(520px, 70vw); text-align: center; display: none; }
  #game-hud .boss .name { font: 400 22px var(--ui-font-display); letter-spacing: .12em; color: #f0d9b0; margin-bottom: 4px; }
  #game-hud .boss .ui-meter { height: 10px; --c: var(--ui-blood); overflow: visible; }
  #game-hud .boss .ui-meter::before { border-radius: 2px; }
  #game-hud .banner { position: absolute; left: 50%; top: 18vh; transform: translate(-50%, 6px); text-align: center; opacity: 0; transition: opacity 1.2s var(--ui-ease), transform 1.2s var(--ui-ease); }
  #game-hud .banner.on { opacity: 1; transform: translate(-50%, 0); }
  #game-hud .banner .ui-label { font-size: 12px; color: var(--ui-accent); letter-spacing: .3em; }
  #game-hud .banner .name { font: 400 46px/1.1 var(--ui-font-display); color: #f4ead6; text-shadow: 0 2px 12px #000, 0 0 30px #000c; margin-top: 4px; }
  #game-hud .banner .ui-rule { width: 70%; margin: 10px auto 0; }
  #game-hud .notice { position: absolute; left: 50%; top: 34vh; transform: translateX(-50%); max-width: min(640px, 86vw); padding: 8px 16px; text-align: center; white-space: pre-line;
    background: #0b0907a8; border: 1px solid var(--ui-line); border-radius: var(--ui-radius); opacity: 0; transition: opacity .4s; font-size: 15px; }
  #game-hud .notice.on { opacity: 1; transition: opacity .15s; }
  #game-hud .gain { position: absolute; left: 50%; top: calc(34vh + 54px); transform: translateX(-50%); color: var(--ui-salt); font: 500 15px var(--ui-font); opacity: 0; transition: opacity .6s; white-space: nowrap; }
  #game-hud .gain.on { opacity: 1; transition: opacity .2s; }
  #game-hud .prompt { position: absolute; left: 50%; bottom: 112px; transform: translateX(-50%); max-width: 86vw; text-align: center; font: 500 15px var(--ui-font); padding: 6px 14px;
    background: #0b0907b8; border: 1px solid var(--ui-line); border-radius: 20px; display: none; }
  #game-hud .prompt .ui-key { margin-right: 6px; }
  #game-hud .flags { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); color: #e0a050; font-size: 12px; }
  #game-hud .dev { position: absolute; left: 12px; bottom: 8px; font-size: 11px; color: var(--ui-ink-faint); }
  #game-hud .help { position: absolute; left: 16px; bottom: 32px; padding: 10px 14px; font-size: 13px; }
  #game-hud .help .keys { display: grid; grid-template-columns: auto auto; gap: 4px 10px; align-items: center; }
  #game-hud .help .k { text-align: right; white-space: nowrap; }
  #game-hud .help .t { color: var(--ui-ink-dim); }
  #game-hud .help .foot { margin-top: 6px; font-size: 12px; color: var(--ui-ink-faint); }
    background: radial-gradient(ellipse at center, #1a0503aa, #000e 75%); }
  @media (max-width: 720px) { #game-hud .help, #game-hud .tally { display: none; } #game-hud .banner .name { font-size: 32px; } }`;

/** The keys the help card and the pause menu list: the actions' own keys (bound by the player: `keysOf`), and what they do. */
export const HELP: readonly (readonly [readonly string[], string])[] = [
  [['Mouse0'], 'stab (click first to look round)'],
  [['KeyW', 'KeyA', 'KeyS', 'KeyD'], 'walk'],
  [['ShiftLeft'], 'run'],
  [['Space'], 'jump'],
  [['KeyE'], 'use, climb a ladder, pick up, read'],
  [['KeyC'], 'light a fire and rest'],
  [['Digit1'], 'to 0: grandma\'s cards (the bar)'],
  [['Tab'], 'pick a target'],
  [['KeyF'], 'headlamp'],
  [['KeyM'], 'map'],
  [['KeyJ'], 'grandma\'s diary'],
  [['KeyO'], 'settings'],
  [['Escape'], 'free the mouse; again: the menu'],
];

/** `HELP` with each key as the player has it (`label(action)`: its key's name). */
export function keysOf(label: (action: string) => string): readonly (readonly [readonly string[], string])[] {
  return HELP.map(([keys, t]) => [keys.map(label), t] as const);
}

/** Keys and what they do as the cells of a grid (a keycap cell, a text cell), for innerHTML. */
export function keysHtml(keys: readonly (readonly [readonly string[], string])[]): string {
  return keys.map(([k, t]) => `<div class="k">${k.map(keycap).join(' ')}</div><div class="t">${esc(t)}</div>`).join('');
}

/** What the HUD shows this frame. */
export interface HudState {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  /** 'climbing', 'swimming' or ''. */
  mode: string;
  /** What hurt just now, and how much ('a rat bites: -4'), or ''. */
  hurt: string;
  /** A boss after you: its name and the share of health it has left. */
  boss: { name: string; left: number } | null;
  /** The notice of the moment, and the salt just gained (or ''). */
  notice: string;
  gain: string;
  /** What a key would do now ('E: climb down the ladder'): a key's name before ': ' (at the start or after a sentence) is drawn as a keycap. */
  prompt: string;
  /** Lines under the vitals (what has been killed). */
  tally: readonly string[];
  /** Debug switches that are on, or ''. */
  flags: string;
  salt: number;
  euros: number;
  pack: { count: number; worth: number } | null;
  /** The grandchild is dead (the death screen, src/app/deathView.ts, has the screen: prompts and notices go). */
  dead: boolean;
  /** The renderer's line (backend, shaders), small in a corner. */
  dev: string;
  /** Show the keys. */
  help: boolean;
}

export class Hud {
  private readonly el: HTMLDivElement;
  private readonly parts: Record<'health' | 'stamina' | 'hn' | 'mode' | 'hurt' | 'tally' | 'purse' | 'boss' | 'bossName' | 'bossBar' | 'banner' | 'bannerLabel' | 'bannerName' | 'notice' | 'gain' | 'prompt' | 'flags' | 'dev' | 'help', HTMLDivElement>;
  private readonly text = document.getElementById('hud');
  /** What each part shows now, so the DOM changes only when it does. */
  private readonly shown = new Map<string, string>();
  private bannerUntil = -Infinity;
  private readonly helpKeys: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.el = panel(host, 'div', 'game-hud', STYLE);
    const left = child(this.el, 'div', 'left');
    const vitals = child(left, 'div', 'vitals ui-panel ui-grown');
    child(vitals, 'div', 'ui-label', 'Health');
    const health = child(vitals, 'div', 'ui-meter');
    health.style.setProperty('--c', 'var(--ui-blood)');
    const hn = child(vitals, 'div', 'num');
    child(vitals, 'div', 'ui-label', 'Stamina');
    const stamina = child(vitals, 'div', 'ui-meter');
    stamina.style.setProperty('--c', 'var(--ui-stamina)');
    child(vitals, 'div');
    const mode = child(vitals, 'div', 'mode');
    growOn(vitals, 'vitals', { amount: 0.6 });
    const purse = child(this.el, 'div', 'purse ui-panel ui-grown');
    const purseText = child(purse, 'div');
    growOn(purse, 'purse', { amount: 0.4, moss: false });
    const boss = child(this.el, 'div', 'boss ui-grown');
    const bossName = child(boss, 'div', 'name'), bossBar = child(boss, 'div', 'ui-meter');
    growOn(bossBar, 'boss', { amount: 0.8, moss: false });
    const banner = child(this.el, 'div', 'banner');
    const bannerLabel = child(banner, 'div', 'ui-label'), bannerName = child(banner, 'div', 'name');
    child(banner, 'div', 'ui-rule');
    const help = child(this.el, 'div', 'help ui-panel ui-grown');
    this.helpKeys = child(help, 'div', 'keys');
    child(help, 'div', 'foot', 'The help goes once you are below the cellar.');
    growOn(help, 'help', { amount: 0.5, moss: false });
    const parts = {
      health, stamina, hn, mode, purse: purseText, boss, bossName, bossBar, banner, bannerLabel, bannerName, help,
      hurt: child(left, 'div', 'hurt'), tally: child(left, 'div', 'tally'),
      notice: child(this.el, 'div', 'notice ui-grown'), gain: child(this.el, 'div', 'gain'), prompt: child(this.el, 'div', 'prompt ui-grown'),
      flags: child(this.el, 'div', 'flags'), dev: child(this.el, 'div', 'dev'),
    };
    growOn(parts.prompt, 'prompt', { amount: 0.35, moss: false });
    growOn(parts.notice, 'notice', { amount: 0.35, moss: false });
    this.parts = parts;
  }

  /** The keys on the help card (after the player has bound them anew: `keysOf`). */
  keys(keys: readonly (readonly [readonly string[], string])[]): void {
    this.helpKeys.innerHTML = keysHtml(keys);
  }

  /** Show the name of a level as one arrives: its number (none for the town and cellar) over its name, for `secs` from `now`. */
  banner(label: string, name: string, now: number, secs = 5): void {
    this.parts.bannerLabel.textContent = label;
    this.parts.bannerName.textContent = name;
    this.bannerUntil = now + secs;
  }

  render(s: HudState, now: number): void {
    const p = this.parts;
    const alive = !s.dead;
    this.set('health', String(Math.max(0, s.health / s.maxHealth)), (v) => p.health.style.setProperty('--v', v));
    this.set('stamina', String(Math.max(0, s.stamina / s.maxStamina)), (v) => p.stamina.style.setProperty('--v', v));
    this.set('hn', s.health.toFixed(0), (v) => (p.hn.textContent = v));
    this.set('mode', s.mode, (v) => { p.mode.textContent = v; p.mode.style.display = v ? 'block' : 'none'; });
    this.set('hurt', s.hurt, (v) => { if (v) p.hurt.textContent = v; p.hurt.classList.toggle('on', !!v); });
    this.set('tally', s.tally.join('\n'), (v) => (p.tally.textContent = v));
    this.set('purse', `${s.salt}|${s.euros}|${s.pack?.count}|${s.pack?.worth}`, () => {
      p.purse.innerHTML = `<div class="salt">${s.salt} infused salt</div>`
        + (s.euros ? `<div>€${s.euros} <span class="dim">in grandma's purse</span></div>` : '')
        + (s.pack ? `<div>${s.pack.count} ${s.pack.count === 1 ? 'find' : 'finds'} <span class="dim">· about €${s.pack.worth}</span></div>` : '');
    });
    this.set('boss', s.boss ? `${s.boss.name}|${s.boss.left.toFixed(3)}` : '', () => {
      p.boss.style.display = s.boss ? 'block' : 'none';
      if (!s.boss) return;
      p.bossName.textContent = s.boss.name;
      p.bossBar.style.setProperty('--v', String(Math.max(0, s.boss.left)));
    });
    this.set('banner', String(alive && now < this.bannerUntil), (v) => p.banner.classList.toggle('on', v === 'true'));
    this.set('notice', alive ? s.notice : '', (v) => { if (v) p.notice.textContent = v; p.notice.classList.toggle('on', !!v); });
    this.set('gain', alive ? s.gain : '', (v) => { if (v) p.gain.textContent = v; p.gain.classList.toggle('on', !!v); });
    this.set('prompt', alive ? s.prompt : '', (v) => {
      p.prompt.style.display = v ? 'block' : 'none';
      p.prompt.innerHTML = esc(v).replace(/(^|[.(] )([A-Z][\w ]{0,10}?): /g, (_, pre: string, k: string) => `${pre}${keycap(k)}`);
    });
    this.set('flags', s.flags, (v) => (p.flags.textContent = v));
    this.set('dev', s.dev, (v) => (p.dev.textContent = v));
    this.set('help', String(s.help && alive), (v) => { p.help.style.display = v === 'true' ? 'block' : 'none'; });
    if (this.text) {
      this.set('text', this.lines(s).join('\n'), (v) => (this.text!.textContent = v));
    }
  }

  /** The HUD as lines of text (the hidden `#hud`), first the health. */
  private lines(s: HudState): string[] {
    return [`health ${s.health.toFixed(0)}`, `stamina ${s.stamina.toFixed(0)}${s.mode ? `  ${s.mode}` : ''}`, s.hurt, s.dev, '', s.boss ? s.boss.name : '', s.notice, s.gain, s.prompt,
      s.flags, ...s.tally, `infused salt in grandma's tin: ${s.salt}`, s.euros ? `euros in grandma's purse: €${s.euros}` : '',
      s.pack ? `pack: ${s.pack.count} finds, worth about €${s.pack.worth}` : '', s.dead ? 'dead' : ''].filter((l, i) => i < 5 || l);
  }

  /** Run `apply(value)` when part `key` is to show something new. */
  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.shown.get(key) === value) return;
    this.shown.set(key, value);
    apply(value);
  }
}
