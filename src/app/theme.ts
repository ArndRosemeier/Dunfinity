/**
 * The game's one look for everything drawn in the DOM (the HUD, the ability bar, the panels, the
 * title screen, the introduction): its fonts, its colours as CSS custom properties on :root, and a
 * few shared classes. A panel, the title screen or the introduction uses these and never its own
 * hex colours or font stacks; `THEME` gives the same colours to a canvas (the map).
 *
 * Two surfaces:
 * - the lamp-lit dark (`ui-panel`): the HUD, menus, What's new, the debug menu;
 * - paper (`ui-paper`): what is read in the world, grandma's tin and diary, inscriptions, letters.
 *
 * Fonts (self-hosted, OFL): IM Fell English for titles and display (an old printed hand, the
 * notary's and the diary's world), Alegreya for text on paper, Alegreya Sans for the interface.
 */
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/alegreya/latin-400.css';
import '@fontsource/alegreya/latin-400-italic.css';
import '@fontsource/alegreya/latin-700.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';

/** The colours and fonts, for code that cannot read CSS variables (canvas drawing). */
export const THEME = {
  /** Interface text on the dark, and its quieter shades. */
  ink: '#ece3d0',
  inkDim: '#b3a68c',
  inkFaint: '#7a6f5e',
  /** The dark surface (translucent and solid) and its lines. */
  dark: '#0e0c0ae6',
  darkSolid: '#16130f',
  darkRaised: '#231e17',
  line: '#4f4232',
  lineBright: '#8a7656',
  /** Lamp gold: what is chosen, on, or ready; the one accent. */
  accent: '#e9b85c',
  /** Infused salt (grandma's magic) and what it buys. */
  salt: '#9ccbe4',
  /** Grandma's salt grown over the interface (src/app/growth.ts): its veins, their glow, and moss. */
  vein: '#9fdcff',
  veinGlow: '#3d9ad6',
  moss: '#5f8f45',
  mossLight: '#9cc46a',
  /** Health and harm. */
  blood: '#c9452f',
  /** Stamina. */
  stamina: '#c9b66a',
  /** Good news (practice gained, a letter learned). */
  good: '#9fc27d',
  /** How tough a creature is for you (grandma's Salt Sight, src/combat/challenge.ts): easy, a fair fight, risky, run, deadly. */
  challenge: ['#9fdcff', '#9cc46a', '#e9b85c', '#e07a3a', '#d63a2a'],
  /** The rough read of a kind never fought, muted: looks harmless, looks dangerous, looks deadly. */
  challengeRough: ['#8fb8a8', '#c9a25c', '#b8483a'],
  /** Paper and the ink on it. */
  paper: '#ebe1c8',
  paperDeep: '#ddcfae',
  paperInk: '#2b2116',
  paperDim: '#6d5a3d',
  paperLine: '#b9a582',
  paperRed: '#8a2a1a',
  paperBlue: '#2f5d7a',
  fontDisplay: "'IM Fell English', Georgia, serif",
  fontPaper: "Alegreya, Georgia, serif",
  fontUi: "'Alegreya Sans', system-ui, sans-serif",
} as const;

const CSS = `
  :root {
    --ui-ink: ${THEME.ink}; --ui-ink-dim: ${THEME.inkDim}; --ui-ink-faint: ${THEME.inkFaint};
    --ui-dark: ${THEME.dark}; --ui-dark-solid: ${THEME.darkSolid}; --ui-dark-raised: ${THEME.darkRaised};
    --ui-line: ${THEME.line}; --ui-line-bright: ${THEME.lineBright};
    --ui-accent: ${THEME.accent}; --ui-salt: ${THEME.salt}; --ui-blood: ${THEME.blood}; --ui-stamina: ${THEME.stamina}; --ui-good: ${THEME.good};
    --ui-vein: ${THEME.vein}; --ui-vein-glow: ${THEME.veinGlow}; --ui-moss: ${THEME.moss};
    --ui-paper: ${THEME.paper}; --ui-paper-deep: ${THEME.paperDeep}; --ui-paper-ink: ${THEME.paperInk}; --ui-paper-dim: ${THEME.paperDim};
    --ui-paper-line: ${THEME.paperLine}; --ui-paper-red: ${THEME.paperRed}; --ui-paper-blue: ${THEME.paperBlue};
    --ui-font-display: ${THEME.fontDisplay}; --ui-font-paper: ${THEME.fontPaper}; --ui-font: ${THEME.fontUi};
    --ui-radius: 4px; --ui-shadow: 0 10px 40px #000c, 0 2px 6px #0008; --ui-glow: 0 0 10px ${THEME.accent}66;
    --ui-text-shadow: 0 1px 2px #000, 0 0 6px #000a;
    --ui-ease: cubic-bezier(.2, .7, .2, 1);
  }
  html, body { font-family: var(--ui-font); }

  /* The lamp-lit dark: a framed panel with a thin inner rule. */
  .ui-panel { background: linear-gradient(180deg, #1a1611f0, var(--ui-dark)); color: var(--ui-ink); border: 1px solid var(--ui-line); border-radius: var(--ui-radius);
    box-shadow: var(--ui-shadow), inset 0 0 0 1px #ffffff08, inset 0 1px 0 #ffffff10; font: 14px/1.45 var(--ui-font); }
  /* Paper: grandma's tin, her diary, a letter, an inscription read. */
  .ui-paper { background: radial-gradient(ellipse at 50% 40%, var(--ui-paper), var(--ui-paper-deep) 140%); color: var(--ui-paper-ink); border: 1px solid var(--ui-paper-dim);
    border-radius: 2px; box-shadow: var(--ui-shadow), inset 0 0 40px #8a765633; font: 16px/1.5 var(--ui-font-paper); }
  /* A panel in the middle of the screen, shown with the class 'open' (fades and rises in). */
  .ui-modal { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -48%); z-index: 9;
    visibility: hidden; opacity: 0; transition: opacity .18s var(--ui-ease), transform .18s var(--ui-ease), visibility 0s .18s; }
  .ui-modal.open { visibility: visible; opacity: 1; transform: translate(-50%, -50%); transition: opacity .18s var(--ui-ease), transform .18s var(--ui-ease); }

  /* What scrolls inside a frame that something grows on (the frame itself must not clip). */
  .ui-scroll { max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; }
  .ui-title { font: 400 22px/1.15 var(--ui-font-display); letter-spacing: .01em; margin: 0 0 8px; }
  .ui-label { font: 700 11px/1.3 var(--ui-font); letter-spacing: .14em; text-transform: uppercase; color: var(--ui-ink-dim); }
  .ui-paper .ui-label { color: var(--ui-paper-dim); }
  .ui-rule { height: 1px; border: 0; margin: 10px 0; background: linear-gradient(90deg, transparent, var(--ui-line-bright), transparent); }
  .ui-paper .ui-rule { background: linear-gradient(90deg, transparent, var(--ui-paper-line), transparent); }

  /* A key to press, drawn as a keycap. */
  .ui-key { display: inline-block; min-width: 1.5em; padding: 0 .4em; box-sizing: border-box; text-align: center; font: 700 .82em/1.6 var(--ui-font);
    color: var(--ui-ink); background: linear-gradient(180deg, #3a3126, #241e17); border: 1px solid #6d5a3d; border-bottom-width: 2px; border-radius: 3px; vertical-align: .08em; }
  .ui-paper .ui-key { color: var(--ui-paper-ink); background: linear-gradient(180deg, #f6efdc, #d9caa6); border-color: var(--ui-paper-dim); }
  /* The line of keys at the foot of a panel. */
  .ui-keys { margin-top: 12px; font: 13px/1.8 var(--ui-font); color: var(--ui-ink-dim); }
  .ui-paper .ui-keys { color: var(--ui-paper-dim); }

  .ui-btn { font: 500 14px/1 var(--ui-font); color: var(--ui-ink); background: linear-gradient(180deg, #2c251c, #1b1712); border: 1px solid var(--ui-line-bright);
    border-radius: var(--ui-radius); padding: 8px 16px; cursor: pointer; letter-spacing: .02em; transition: border-color .12s, color .12s, box-shadow .12s, background .12s; }
  .ui-btn:hover, .ui-btn:focus-visible { border-color: var(--ui-accent); color: #fff3d6; box-shadow: var(--ui-glow); outline: none; }
  .ui-btn:active { background: #15120e; }
  .ui-btn.primary { border-color: var(--ui-accent); color: #fff3d6; background: linear-gradient(180deg, #4a3a20, #2a2114); }
  .ui-btn.small { padding: 4px 9px; font-size: 12px; }

  /* A thin bar (health, stamina, a timer): set --v (0…1) and the bar colour as --c. */
  .ui-meter { position: relative; height: 8px; background: #000a; border: 1px solid #000; border-radius: 2px; box-shadow: 0 0 0 1px #ffffff12; overflow: hidden; }
  .ui-meter::before { content: ''; position: absolute; inset: 0; width: calc(var(--v, 1) * 100%); background: linear-gradient(180deg, color-mix(in srgb, var(--c, var(--ui-accent)) 80%, #fff), var(--c, var(--ui-accent)) 55%, color-mix(in srgb, var(--c, var(--ui-accent)) 70%, #000)); transition: width .12s linear; }

  /* Played by touch (:root.ui-touch, set by the game): keycap hints give way to what fingers do. */
  .ui-touch-only { display: none; }
  :root.ui-touch .ui-touch-only { display: revert; }
  :root.ui-touch .ui-keys-only, :root.ui-touch .ui-keys { display: none; }
  /* Buttons big enough for a fingertip (at least 40 px high). */
  :root.ui-touch .ui-btn { min-height: 40px; padding: 10px 18px; font-size: 15px; }
  :root.ui-touch .ui-btn.small { min-height: 40px; padding: 6px 10px; font-size: 13px; }

  /* Thin scrollbars that suit the panels. */
  .ui-scroll { scrollbar-width: thin; scrollbar-color: var(--ui-line-bright) transparent; }
`;

let added = false;

/** Put the theme into the page (once; every panel calls it). */
export function useTheme(): void {
  if (added || typeof document === 'undefined') return;
  added = true;
  const style = document.createElement('style');
  style.id = 'theme';
  style.textContent = CSS;
  document.head.prepend(style);
}

