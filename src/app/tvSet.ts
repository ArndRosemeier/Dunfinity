/**
 * The title screen's television: a 1960s set in a dark living room (public/report/set.webp), playing
 * the late-evening report on what came up in grandma's town in September 1966 (src/lore/report.ts).
 * Black and white: grainy press stills panned slowly, the programme's card, its words, name straps,
 * and the signal's trouble (snow, a rolling hum bar, torn lines). Whenever a shader builds behind the
 * title, the vertical hold slips: the picture rolls once (`frameAt(now, builds)`).
 *
 * One canvas over the whole window. The picture is drawn small (as a 1966 set would show it) and
 * scaled up into the glass; the words are drawn sharp over it.
 */
import { Rng, clamp, deriveSeed, lerp, smoothstep } from '@futuremagic/core';
import { PROGRAMME, REPORT, onAir, shotStart, type OnAir } from '../lore/report';
import { THEME } from './theme';

/** The set's picture (pixels) and where its glass is in it (picture pixels): the tube's face and its corner radius. */
const SET = { w: 1600, h: 1066, glass: { x: 514, y: 394, w: 474, h: 344, r: 60 } };
/** The picture drawn small: 4:3, as broadcast. */
const PIC = { w: 384, h: 288 };
/**
 * Where the glass sits on the window, as fractions of it: landscape (right of the menu; the glass at
 * most this wide and tall) and portrait (above the menu).
 */
const PLACE = {
  wide: { x: 0.66, y: 0.5, w: 0.4, h: 0.5 },
  tall: { x: 0.5, y: 0.33, w: 0.86, h: 0.42 },
};
/**
 * The signal: grain, how hard the picture shakes sideways, the hum bar's darkness and period (s),
 * how long a vertical-hold slip takes (s) and the least time between two, how often the signal
 * tears by itself (s, a range), and how long the set takes to come on and go off (s).
 */
const SIGNAL = { grain: 0.12, wobble: 0.6, hum: 0.12, humPeriod: 7, slip: 0.55, slipGap: 1.1, tears: [7, 18] as const, on: 0.9, off: 0.45 };
/** How long a name strap stays (s), how far a still drifts and zooms over its shot. */
const STRAP = 5;
const PAN = { zoom: [1.06, 1.2] as const, drift: 0.06 };

export class TvSet {
  readonly canvas: HTMLCanvasElement;
  /** The set and the stills are loaded. */
  readonly loaded: Promise<void>;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pic: HTMLCanvasElement;
  private readonly px: CanvasRenderingContext2D;
  private readonly src: HTMLCanvasElement;
  private readonly sx: CanvasRenderingContext2D;
  private readonly snow: HTMLCanvasElement[] = [];
  private readonly lines: CanvasPattern | null;
  private readonly rng: Rng;
  private set: HTMLImageElement | null = null;
  private readonly stills = new Map<string, HTMLImageElement>();
  /** When the set came on, and when it was told to go off (null: not yet); seconds into the airing it came on at. */
  private onAt: number | null = null;
  private offAt: number | null = null;
  private readonly from: number;
  /** The last slip's start, the shader builds seen so far, how rough the signal is (0..1, it calms), the next tear by itself. */
  private slipAt = -Infinity;
  private builds = 0;
  private rough = 0;
  private nextTear = 0;
  private last = 0;
  private dpr = 1;

  /**
   * `seed`: the world's, so the signal's trouble is the same each time; `from`: seconds into the
   * airing the set comes on at (0: from the start); `pinned`: hold on that shot (for screenshots).
   */
  constructor(host: HTMLElement, seed: number, from: number, private readonly pinned: number | null) {
    this.rng = new Rng(deriveSeed(seed, 'tv'));
    this.from = pinned !== null ? shotStart(clamp(pinned, 0, REPORT.length - 1)) + 3 : from;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tv';
    host.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    [this.pic, this.px] = canvas(PIC.w, PIC.h);
    [this.src, this.sx] = canvas(PIC.w, PIC.h);
    for (let k = 0; k < 4; k++) this.snow.push(grain(PIC.w * 1.5, PIC.h * 1.5, this.rng));
    const [line, lx] = canvas(1, 3);
    lx.fillStyle = 'rgba(0,0,0,0.5)';
    lx.fillRect(0, 2, 1, 1);
    this.lines = this.ctx.createPattern(line, 'repeat');
    this.nextTear = this.rng.range(...SIGNAL.tears);
    const base = import.meta.env.BASE_URL;
    const ids = [...new Set(REPORT.map((s) => s.still).filter((s): s is string => !!s))];
    this.loaded = Promise.all([
      image(`${base}report/set.webp`).then((i) => { this.set = i; }),
      ...ids.map((id) => image(`${base}report/${id}.webp`).then((i) => { this.stills.set(id, i); }, () => {})),
    ]).then(() => {});
  }

  /** Switch the set on (the picture opens out from a line). */
  on(now: number): void {
    this.onAt ??= now;
  }

  /** Switch it off (the picture shrinks to a dot); `frameAt` shows it going. */
  off(now: number): void {
    this.offAt ??= now;
  }

  /** What was on the air at the last frame (null before the first). */
  playing: OnAir | null = null;

  /** How rough the signal is now, 0..1 (for the hiss). */
  get trouble(): number { return this.rough; }

  /**
   * Draw a frame at `now` (seconds); `builds`: shader builds so far (each new one may slip the hold).
   * True when the picture slipped this frame (for its crackle).
   */
  frameAt(now: number, builds: number): boolean {
    const dt = clamp(now - this.last, 0, 0.1), slipped = this.slipAt;
    this.last = now;
    if (builds > this.builds) {
      this.rough = Math.min(1, this.rough + 0.25 * (builds - this.builds));
      this.builds = builds;
      if (now - this.slipAt > SIGNAL.slipGap) this.slipAt = now;
    }
    if (this.onAt !== null && now - this.onAt > this.nextTear && this.pinned === null) {
      this.nextTear = now - this.onAt + this.rng.range(...SIGNAL.tears);
      this.rough = Math.min(1, this.rough + 0.5);
      if (this.rng.chance(0.4) && now - this.slipAt > SIGNAL.slipGap) this.slipAt = now;
    }
    this.rough = Math.max(0, this.rough - dt * 0.6);
    this.fit();
    const air = this.playing = onAir(this.from + (this.onAt === null || this.pinned !== null ? 0 : now - this.onAt)); // a pinned shot holds
    this.broadcast(air, now);
    this.compose(air, now);
    return this.slipAt !== slipped && this.offAt === null;
  }

  /** Where the glass is on the window (CSS pixels), and the scale of the set's picture. */
  glass(): { x: number; y: number; w: number; h: number; r: number; k: number; ox: number; oy: number } {
    const W = this.canvas.clientWidth || innerWidth, H = this.canvas.clientHeight || innerHeight;
    const g = SET.glass, p = W >= H ? PLACE.wide : PLACE.tall;
    const k = Math.max(Math.min(p.w * W / g.w, p.h * H / g.h), W >= H ? Math.max(W / SET.w, H / SET.h) : 0);
    let ox = p.x * W - (g.x + g.w / 2) * k, oy = p.y * H - (g.y + g.h / 2) * k;
    // The room covers the window where it can.
    if (SET.w * k >= W) ox = clamp(ox, W - SET.w * k, 0);
    if (SET.h * k >= H) oy = clamp(oy, H - SET.h * k, 0);
    return { x: ox + g.x * k, y: oy + g.y * k, w: g.w * k, h: g.h * k, r: g.r * k, k, ox, oy };
  }

  /** The canvas matches the window. */
  private fit(): void {
    const c = this.canvas, dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.dpr = dpr;
  }

  /** The broadcast, small: the shot, then the signal's trouble over it. */
  private broadcast(air: OnAir, now: number): void {
    const { sx, px } = this, W = PIC.w, H = PIC.h, r = this.rng;
    sx.globalCompositeOperation = 'source-over';
    sx.globalAlpha = 1;
    sx.fillStyle = 'rgb(18,18,18)';
    sx.fillRect(0, 0, W, H);
    const shot = REPORT[air.shot];
    if (!shot) {
      sx.drawImage(this.snow[r.int(0, this.snow.length - 1)], -r.range(0, W / 2), -r.range(0, H / 2));
    } else if (!shot.still) {
      this.card(air.t);
    } else {
      const img = this.stills.get(shot.still);
      if (img) {
        const pan = new Rng(deriveSeed(this.rng.seed, 'pan', air.shot));
        const u = smoothstep(0, 1, air.t / 12), z = lerp(PAN.zoom[0], PAN.zoom[1], pan.chance(0.5) ? u : 1 - u);
        const dx = pan.range(-1, 1) * PAN.drift, dy = pan.range(-1, 1) * PAN.drift * 0.5;
        const s = Math.max(W / img.width, H / img.height) * z, iw = img.width * s, ih = img.height * s;
        sx.drawImage(img, (W - iw) / 2 + dx * W * (u - 0.5), (H - ih) / 2 + dy * H * (u - 0.5), iw, ih);
      }
    }
    // The tube's phosphor: cool white on grey.
    sx.globalCompositeOperation = 'multiply';
    sx.fillStyle = 'rgb(214,224,230)';
    sx.fillRect(0, 0, W, H);
    sx.globalCompositeOperation = 'source-over';

    // Onto the picture, line by line: shaken sideways, rolled by a slip.
    px.fillStyle = 'black';
    px.fillRect(0, 0, W, H);
    const slip = (now - this.slipAt) / SIGNAL.slip, rough = this.rough;
    const roll = slip >= 0 && slip < 1 ? Math.round(smoothstep(0, 1, slip) * H) : 0;
    const band = 6;
    for (let y = 0; y < H; y += band) {
      const tear = rough > 0.2 && r.chance(rough * 0.15) ? r.range(-1, 1) * rough * 24 : 0;
      const x = Math.sin(y * 0.09 + now * 7) * SIGNAL.wobble * (0.4 + rough) + tear;
      const sy = (y + roll) % H;
      px.drawImage(this.src, 0, sy, W, Math.min(band, H - sy), x, y, W, Math.min(band, H - sy));
    }
    // The black between frames, seen while the picture rolls.
    if (roll) { px.fillStyle = 'black'; px.fillRect(0, H - roll - 5, W, 10); }
    // Snow over everything, more when the signal is rough; the hum bar crawling up.
    px.globalAlpha = SIGNAL.grain + rough * 0.25;
    px.drawImage(this.snow[r.int(0, this.snow.length - 1)], -r.range(0, W / 2), -r.range(0, H / 2));
    px.globalAlpha = 1;
    const hy = H - ((now / SIGNAL.humPeriod) % 1) * (H * 1.6);
    const hum = px.createLinearGradient(0, hy - H * 0.3, 0, hy + H * 0.3);
    hum.addColorStop(0, 'rgba(0,0,0,0)');
    hum.addColorStop(0.5, `rgba(0,0,0,${SIGNAL.hum})`);
    hum.addColorStop(1, 'rgba(0,0,0,0)');
    px.fillStyle = hum;
    px.fillRect(0, 0, W, H);
    // The set breathing: the whole picture a little brighter or darker from frame to frame.
    px.fillStyle = `rgba(0,0,0,${r.range(0, 0.05)})`;
    px.fillRect(0, 0, W, H);
  }

  /** The programme's card: its name and the evening, over slowly widening rings. */
  private card(t: number): void {
    const { sx } = this, W = PIC.w, H = PIC.h;
    sx.fillStyle = 'rgb(40,40,40)';
    sx.fillRect(0, 0, W, H);
    sx.lineWidth = 9;
    for (let i = 0; i < 9; i++) {
      const rad = ((i * 34 + t * 18) % 306);
      sx.strokeStyle = `rgba(150,150,150,${0.35 * (1 - rad / 306)})`;
      sx.beginPath();
      sx.arc(W / 2, H / 2, rad, 0, Math.PI * 2);
      sx.stroke();
    }
  }

  /** The room, the picture in its glass, the words over it, the glass itself, and the set's light on the room. */
  private compose(air: OnAir, now: number): void {
    const { ctx } = this, d = this.dpr, g = this.glass();
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (this.set) ctx.drawImage(this.set, g.ox, g.oy, SET.w * g.k, SET.h * g.k);
    const power = this.power(now);
    // The set's own light on the room (brighter when the snow fills it).
    if (power > 0) {
      const cx = g.x + g.w / 2, cy = g.y + g.h / 2, glow = (air.shot < 0 ? 0.22 : 0.14) * power * (0.85 + this.rng.range(0, 0.15));
      const light = ctx.createRadialGradient(cx, cy, g.w * 0.3, cx, cy, g.w * 1.6);
      light.addColorStop(0, `rgba(200,215,230,${glow})`);
      light.addColorStop(1, 'rgba(200,215,230,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = light;
      ctx.fillRect(g.x - g.w * 2, g.y - g.w * 2, g.w * 5, g.w * 5);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, g.r);
    ctx.clip();
    if (power > 0) {
      // Coming on, the picture opens out from a bright line; going off, it shrinks to a dot.
      const opening = this.offAt === null, sy = opening ? Math.max(0.006, power) : Math.max(0.006, power * power);
      const sxw = opening ? 1 : Math.max(0.01, power);
      const h = g.h * sy, w = g.w * sxw;
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = Math.min(1, 0.3 + power);
      ctx.drawImage(this.pic, g.x + (g.w - w) / 2, g.y + (g.h - h) / 2, w, h);
      ctx.globalAlpha = 1;
      if (power < 1) {
        ctx.fillStyle = `rgba(235,240,245,${(1 - power) * 0.8})`;
        ctx.fillRect(g.x + (g.w - w) / 2, g.y + (g.h - h) / 2, w, h);
      }
      if (power > 0.95) this.words(air, g, now);
    }
    // Scan lines, the tube's dark edges, and the room's reflection on the glass.
    ctx.fillStyle = this.lines!;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.globalAlpha = 1;
    const edge = ctx.createRadialGradient(g.x + g.w / 2, g.y + g.h / 2, g.h * 0.35, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.72);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = edge;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    const shine = ctx.createLinearGradient(g.x, g.y, g.x + g.w * 0.6, g.y + g.h * 0.7);
    shine.addColorStop(0, 'rgba(255,240,215,0.10)');
    shine.addColorStop(0.5, 'rgba(255,240,215,0.02)');
    shine.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.restore();
  }

  /** The words: the line being said along the bottom, a name strap low on the left at a shot's start, the programme's name on its card. */
  private words(air: OnAir, g: { x: number; y: number; w: number; h: number }, now: number): void {
    const { ctx } = this, shot = REPORT[air.shot], u = g.h / 100;
    const slip = (now - this.slipAt) / SIGNAL.slip;
    const dy = slip >= 0 && slip < 1 ? smoothstep(0, 1, slip) * g.h : 0;
    ctx.save();
    ctx.translate(Math.sin(now * 7) * SIGNAL.wobble * 0.5, -dy);
    ctx.shadowColor = 'rgba(225,235,245,0.5)';
    ctx.shadowBlur = 5 * u / 4;
    ctx.fillStyle = 'rgb(236,240,244)';
    ctx.textBaseline = 'alphabetic';
    if (shot && !shot.still) {
      const a = smoothstep(0.5, 2, air.t);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `700 ${11 * u}px ${THEME.fontUi}`;
      spaced(ctx, PROGRAMME.name, g.x + g.w / 2, g.y + g.h * 0.5, 1.5 * u);
      ctx.font = `400 ${4.6 * u}px ${THEME.fontUi}`;
      ctx.fillText(PROGRAMME.date, g.x + g.w / 2, g.y + g.h * 0.64);
    }
    if (shot?.strap && air.t < STRAP) {
      const a = smoothstep(0.3, 0.9, air.t) * (1 - smoothstep(STRAP - 0.6, STRAP, air.t));
      ctx.globalAlpha = a;
      ctx.font = `700 ${5.6 * u}px ${THEME.fontUi}`;
      ctx.textAlign = 'left';
      const tw = ctx.measureText(shot.strap).width, x = g.x + g.w * 0.08, y = g.y + g.h * 0.2;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(10,10,10,0.78)';
      ctx.fillRect(x - 2.5 * u, y - 6 * u, tw + 5 * u, 8.6 * u);
      ctx.shadowBlur = 5 * u / 4;
      ctx.fillStyle = 'rgb(236,240,244)';
      ctx.fillText(shot.strap, x, y);
    }
    if (air.line) {
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(13, 5.4 * u)}px ${THEME.fontUi}`; // still readable on a phone
      const rows = rowsOf(ctx, air.line, g.w * 0.86), lh = Math.max(16, 6.6 * u);
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 2.5 * u;
      rows.forEach((row, i) => ctx.fillText(row, g.x + g.w / 2, g.y + g.h * 0.9 - (rows.length - 1 - i) * lh));
    }
    ctx.restore();
  }

  /** How far the set is on: 0 off, 1 on (it comes on and goes off quickly). */
  private power(now: number): number {
    if (this.onAt === null) return 0;
    const on = smoothstep(0, SIGNAL.on, now - this.onAt);
    return this.offAt === null ? on : on * (1 - smoothstep(0, SIGNAL.off, now - this.offAt));
  }

  /** Drop the canvas. */
  dispose(): void {
    this.canvas.remove();
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return [c, c.getContext('2d')!];
}

/** A frame of snow: grey grain, seeded. */
function grain(w: number, h: number, rng: Rng): HTMLCanvasElement {
  const [c, x] = canvas(w, h), img = x.createImageData(c.width, c.height), p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const v = rng.nextU32() & 255;
    p[i] = p[i + 1] = p[i + 2] = v;
    p[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
}

/** Text with letters spaced apart, centred on x. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number): void {
  ctx.letterSpacing = `${gap}px`;
  ctx.fillText(text, x, y);
  ctx.letterSpacing = '0px';
}

/** A line of words broken into rows no wider than `max`. */
function rowsOf(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const rows: string[] = [];
  let row = '';
  for (const word of text.split(' ')) {
    const next = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(next).width > max) { rows.push(row); row = word; } else row = next;
  }
  if (row) rows.push(row);
  return rows;
}
