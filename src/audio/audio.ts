/**
 * The Web Audio engine (Scale's src/audio/Audio.ts, cut down): spatial one-shots with variations and
 * pitch, positioned loops its owner moves, and ambience beds that crossfade with where one is.
 *
 *   sources → category gain (effects · ambience · music) → master (volume, mute) → limiter → speakers
 *
 * Clips are listed in public/sounds/manifest.json (built by tools/audio/sfx.py) and decoded when first
 * wanted; a clip nobody wanted for IDLE_S is dropped and decoded again when next needed. Audio starts
 * on the first user gesture (browser autoplay rules). `?mute` in the URL forces silence (tests).
 */
import { Rng, deriveSeed } from '@futuremagic/core';
import { readSoundSettings, writeSoundSettings, type SoundSettings } from '../persist/settings';

export type SoundCategory = 'effects' | 'ambience' | 'music';

interface ManifestEntry { files: string[]; loop: boolean; gain: number }

/** A positioned loop its owner moves every frame (the campfire's crackle). */
export interface SoundLoop {
  set(x: number, y: number, z: number, gain: number, rate?: number): void;
  stop(): void;
}

/** Seconds a decoded clip may go unwanted before it is dropped. */
const IDLE_S = 90;
/** At most this many one-shots at once. */
const VOICES = 32;

export class SoundEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cats = new Map<SoundCategory, GainNode>();
  private manifest: Record<string, ManifestEntry> = {};
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = new Map<string, Promise<AudioBuffer[]>>();
  private amb = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private used = new Map<string, number>();
  private sweptAt = 0;
  private voices = 0;
  private readonly rng: Rng;
  private readonly forcedMute = new URLSearchParams(location.search).has('mute');
  settings: SoundSettings = readSoundSettings();

  constructor(seed: number, private readonly base: string) {
    this.rng = new Rng(deriveSeed(seed, 'audio'));
  }

  /** Read the clip list and start the context on the first gesture. */
  async init(): Promise<void> {
    try {
      this.manifest = await (await fetch(`${this.base}sounds/manifest.json`)).json();
    } catch { this.manifest = {}; }
    const start = () => {
      if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); return; }
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.gain;
      // A gentle limiter: many bites at once do not clip.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
      this.master.connect(comp).connect(ctx.destination);
      for (const c of ['effects', 'ambience', 'music'] as const) {
        const g = ctx.createGain();
        g.gain.value = this.level(c);
        g.connect(this.master);
        this.cats.set(c, g);
      }
    };
    // (iPad Safari only lets a touch's end start audio.)
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, start, { passive: true });
  }

  private get gain(): number { return this.settings.muted || this.forcedMute ? 0 : this.settings.volume; }

  /** A category's volume under the master. */
  private level(c: SoundCategory): number {
    const s = this.settings;
    return c === 'effects' ? s.effects : c === 'ambience' ? s.ambience : s.musicVolume;
  }

  /** Change and keep the settings. */
  set(s: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...s };
    writeSoundSettings(this.settings);
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.gain, ctx.currentTime, 0.05);
    for (const [c, g] of this.cats) g.gain.setTargetAtTime(this.level(c), ctx.currentTime, 0.05);
  }

  /** Is anything audible (music too)? */
  get audible(): boolean { return this.gain > 0; }

  /** The listener: at (x, y, z), looking along f, with up u. */
  listen(x: number, y: number, z: number, fx: number, fy: number, fz: number, ux = 0, uy = 1, uz = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener, t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(x, t); l.positionY.setValueAtTime(y, t); l.positionZ.setValueAtTime(z, t);
      l.forwardX.setValueAtTime(fx, t); l.forwardY.setValueAtTime(fy, t); l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(ux, t); l.upY.setValueAtTime(uy, t); l.upZ.setValueAtTime(uz, t);
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  private load(id: string): Promise<AudioBuffer[]> {
    this.used.set(id, performance.now() / 1000);
    const m = this.manifest[id], ctx = this.ctx;
    if (!m || !ctx) return Promise.resolve([]);
    let p = this.loading.get(id);
    if (p) return p;
    p = Promise.all(m.files.map(async (f) => ctx.decodeAudioData(await (await fetch(`${this.base}sounds/${f}`)).arrayBuffer())))
      .then((bufs) => { this.buffers.set(id, bufs); return bufs; })
      .catch(() => []);
    this.loading.set(id, p);
    return p;
  }

  /** Start decoding clips that are about to be needed. */
  preload(...ids: string[]): void {
    for (const id of ids) if (!this.buffers.has(id)) void this.load(id);
  }

  private withBuffers(id: string, go: (bufs: AudioBuffer[]) => void): void {
    const b = this.buffers.get(id);
    if (b) { this.used.set(id, performance.now() / 1000); go(b); } else void this.load(id).then(go);
  }

  /** A one-shot at (x, y, z); `refDist`: the distance it plays at full gain. Null position: not placed (the listener's own body). */
  play(id: string, at: { readonly x: number; readonly y: number; readonly z: number } | null, gain = 1, pitch = 1, refDist = 3): void {
    const ctx = this.ctx, m = this.manifest[id];
    if (!ctx || !m || this.voices >= VOICES) return;
    // (Chosen now, not when the clip has loaded: the same seed, the same sounds.)
    const pick = this.rng.float(), wobble = 0.94 + this.rng.float() * 0.12;
    this.withBuffers(id, (bufs) => {
      if (!bufs.length) return;
      const src = ctx.createBufferSource();
      src.buffer = bufs[Math.floor(pick * bufs.length)];
      src.playbackRate.value = pitch * wobble;
      const g = ctx.createGain();
      g.gain.value = gain * m.gain;
      let tail: AudioNode = src.connect(g);
      let pan: PannerNode | null = null;
      if (at) {
        pan = ctx.createPanner();
        pan.panningModel = 'HRTF';
        pan.distanceModel = 'inverse';
        pan.refDistance = refDist;
        pan.rolloffFactor = 1.3;
        pan.positionX.value = at.x; pan.positionY.value = at.y; pan.positionZ.value = at.z;
        tail = tail.connect(pan);
      }
      tail.connect(this.cats.get('effects')!);
      src.start();
      this.voices++;
      src.onended = () => { this.voices--; g.disconnect(); pan?.disconnect(); };
    });
  }

  /** A positioned loop (null until audio has started and the clip is decoded: ask again later). */
  loop(id: string, refDist = 3): SoundLoop | null {
    const ctx = this.ctx, m = this.manifest[id];
    if (!ctx || !m) return null;
    const bufs = this.buffers.get(id);
    if (!bufs?.length) { void this.load(id); return null; }
    this.used.set(id, performance.now() / 1000);
    const src = ctx.createBufferSource();
    src.buffer = bufs[0];
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = refDist;
    pan.rolloffFactor = 1.2;
    src.connect(g).connect(pan).connect(this.cats.get('effects')!);
    src.start(0, this.rng.float() * bufs[0].duration);
    return {
      set: (x, y, z, gain, rate = 1) => {
        const t = ctx.currentTime;
        this.used.set(id, performance.now() / 1000);
        pan.positionX.setTargetAtTime(x, t, 0.05); pan.positionY.setTargetAtTime(y, t, 0.05); pan.positionZ.setTargetAtTime(z, t, 0.05);
        g.gain.setTargetAtTime(gain * m.gain, t, 0.15);
        src.playbackRate.setTargetAtTime(rate, t, 0.2);
      },
      stop: () => { try { src.stop(); } catch { /* not started */ } g.disconnect(); pan.disconnect(); },
    };
  }

  /** Target levels (0…1) of the ambience beds: they crossfade; a bed is loaded when first heard. */
  ambience(levels: Readonly<Record<string, number>>): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = performance.now() / 1000;
    for (const [id, lvl] of Object.entries(levels)) {
      let a = this.amb.get(id);
      const bufs = this.buffers.get(id);
      if (lvl > 0.001) { if (bufs?.length) this.used.set(id, now); else if (this.manifest[id]) void this.load(id); }
      if (!a) {
        if (!bufs?.length || lvl <= 0.001) continue;
        const src = ctx.createBufferSource();
        src.buffer = bufs[0];
        src.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(this.cats.get('ambience')!);
        src.start(0, this.rng.float() * bufs[0].duration);
        a = { src, gain };
        this.amb.set(id, a);
      }
      a.gain.gain.setTargetAtTime(lvl * (this.manifest[id]?.gain ?? 1), ctx.currentTime, 0.8);
    }
    if (now - this.sweptAt > 10) { this.sweptAt = now; this.dropIdle(now); }
  }

  /** Decoded audio is float PCM, many times its file size: drop what nobody wanted for a while. */
  private dropIdle(now: number): void {
    for (const id of [...this.buffers.keys()]) {
      if (now - (this.used.get(id) ?? 0) < IDLE_S) continue;
      const a = this.amb.get(id);
      if (a) { try { a.src.stop(); } catch { /* not started */ } a.src.disconnect(); a.gain.disconnect(); this.amb.delete(id); }
      this.buffers.delete(id);
      this.loading.delete(id);
    }
  }

  /** Where the background music plays into, once audio runs. */
  musicOut(): { ctx: AudioContext; out: AudioNode } | null {
    const g = this.cats.get('music');
    return this.ctx && g ? { ctx: this.ctx, out: g } : null;
  }
}
