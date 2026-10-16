/**
 * The debug menu's creature maker (Arnd, 2026-10-16: "give me the values you use to spawn them as a
 * slider array and a randomize option"): a procedural creature's role, body plan, skin, seed and
 * strangeness, then every knob of its genome (src/creatures/knobs.ts) as a slider. Randomize grows
 * a new one; Spawn puts it down in front of you, standing still so you can look at it; with one out,
 * letting go of a slider remakes it in place.
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { grow, PLANS, ROLES, type BodyPlan, type CritterRole, type Integument, type Species } from '../creatures/bestiary';
import { INTEGUMENT } from '../creatures/flesh';
import { KNOBS, knobsOf, tune } from '../creatures/knobs';
import { button, child } from './panel';

export const MAKER_STYLE = `
  #debug .maker select { background: var(--ui-dark-raised); color: var(--ui-ink); border: 1px solid var(--ui-line-bright); border-radius: 3px; font: inherit; margin: 1px 4px 1px 0; }
  #debug .maker .row { display: grid; grid-template-columns: 112px 1fr 38px; gap: 4px; align-items: center; margin: 1px 0; font-size: 12px; }
  #debug .maker .row input[type=range] { width: 100%; accent-color: var(--ui-accent); }
  #debug .maker .row span:last-child { text-align: right; color: var(--ui-ink-faint); font-variant-numeric: tabular-nums; }
  #debug .maker summary { cursor: pointer; margin: 4px 0; }`;

export class CreatureMaker {
  private role: CritterRole = 'grazer';
  private plan: BodyPlan | 'any' = 'any';
  private skin: Integument | 'any' = 'any';
  private seed = 1;
  private strange = 1;
  /** The species as grown from the choices above, and the knobs' values now. */
  private grown: Species;
  private values: Record<string, number> = {};
  /** A creature is out (letting go of a slider remakes it). */
  private out = false;
  private rolls = 0;
  private readonly rows = new Map<string, { readonly input: HTMLInputElement; readonly shown: HTMLSpanElement }>();
  private readonly seedBox: HTMLInputElement;
  private readonly selects: HTMLSelectElement[] = [];

  /** `spawn`: put this species down in front of you (null: take it away); what to say about it. */
  constructor(parent: HTMLElement, private readonly spawn: (sp: Species | null) => string, private readonly say: (text: string) => void) {
    const el = child(parent, 'div', 'maker');
    const select = <T extends string>(options: readonly T[], value: T, set: (v: T) => void) => {
      const s = child(el, 'select');
      for (const o of options) child(s, 'option', '', o).value = o;
      s.value = value;
      s.addEventListener('change', () => { set(s.value as T); this.regrow(); s.blur(); });
      this.selects.push(s);
      return s;
    };
    select(ROLES, this.role, (v) => { this.role = v; });
    select(['any', ...PLANS] as const, this.plan, (v) => { this.plan = v; });
    select(['any', ...INTEGUMENT] as const, this.skin, (v) => { this.skin = v; });
    const line = child(el, 'div');
    line.append('Seed ');
    this.seedBox = child(line, 'input');
    this.seedBox.type = 'number';
    this.seedBox.value = String(this.seed);
    this.seedBox.addEventListener('keydown', (e) => e.stopPropagation());
    this.seedBox.addEventListener('change', () => { this.seed = Math.floor(Number(this.seedBox.value) || 0); this.regrow(); });
    this.knobRow(el, 'strange', 'Strangeness', 0, 3, false, () => this.strange, (v) => { this.strange = v; this.regrow(); });
    const buttons = child(el, 'div');
    button(buttons, 'Randomize', () => this.randomize(), 'ui-btn small');
    button(buttons, 'Spawn', () => { this.out = true; this.spawnNow(); }, 'ui-btn small');
    button(buttons, 'Remove', () => { this.out = false; this.say(this.spawn(null)); }, 'ui-btn small');
    const genes = child(el, 'details');
    child(genes, 'summary', '', 'Its genome');
    for (const k of KNOBS) this.knobRow(genes, k.key, k.label, k.min, k.max, !!k.whole, () => this.values[k.key], (v) => { this.values[k.key] = v; if (this.out) this.spawnNow(); });
    this.grown = this.growNow();
    this.fillRows();
  }

  /** A new creature: any role, plan and skin, a new seed and strangeness. */
  randomize(): void {
    const rng = new Rng(deriveSeed(0x5eed, 'creature maker', ++this.rolls));
    this.role = rng.pick(ROLES);
    this.plan = 'any';
    this.skin = 'any';
    this.seed = rng.int(1, 99999);
    this.strange = rng.range(0, 3);
    [this.selects[0].value, this.selects[1].value, this.selects[2].value] = [this.role, this.plan, this.skin];
    this.seedBox.value = String(this.seed);
    this.regrow();
  }

  private growNow(): Species {
    return grow(new Rng(deriveSeed(this.seed, 'creature maker')), this.role, this.strange, `maker.${this.role}.${this.seed}`, {
      plan: this.plan === 'any' ? undefined : this.plan,
      integument: this.skin === 'any' ? undefined : this.skin,
    });
  }

  /** Grow anew from the choices; the sliders show what it grew into. */
  private regrow(): void {
    this.grown = this.growNow();
    this.fillRows();
    if (this.out) this.spawnNow();
  }

  private fillRows(): void {
    this.values = knobsOf(this.grown);
    for (const [key, r] of this.rows) {
      const v = key === 'strange' ? this.strange : this.values[key];
      r.input.value = String(v);
      r.shown.textContent = fmt(v);
    }
  }

  private spawnNow(): void {
    const sp = tune(this.grown, this.values);
    this.say(this.spawn(sp));
  }

  private knobRow(parent: HTMLElement, key: string, label: string, min: number, max: number, whole: boolean, get: () => number, set: (v: number) => void): void {
    const row = child(parent, 'label', 'row');
    child(row, 'span', '', label);
    const input = child(row, 'input');
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = whole ? '1' : String((max - min) / 200);
    const shown = child(row, 'span');
    input.addEventListener('input', () => { shown.textContent = fmt(Number(input.value)); });
    // Remade when let go, not on every step of a drag (meshing a body takes a moment).
    input.addEventListener('change', () => { set(Number(input.value)); input.blur(); });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    this.rows.set(key, { input, shown });
    input.value = String(get() ?? min);
  }
}

const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2));
