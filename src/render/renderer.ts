/**
 * The one renderer (guarded: nothing else may construct one). three.js WebGPURenderer: WebGPU where the
 * browser has it, its WebGL 2 backend everywhere else, so materials are written once (TSL / node materials).
 */
import { ACESFilmicToneMapping, WebGPURenderer } from 'three/webgpu';

export interface RendererInfo {
  renderer: WebGPURenderer;
  /** Which backend three.js picked. */
  backend: 'webgpu' | 'webgl2';
}

export async function createRenderer(canvas: HTMLCanvasElement, opts: { forceWebGL?: boolean } = {}): Promise<RendererInfo> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: opts.forceWebGL ?? false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Filmic tone mapping: rock close to the headlamp rolls off into warm highlights instead of clipping
  // to flat white (it is applied in the output pass, so no material shader changes with it).
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { renderer, backend };
}

/** Exposure for the tone mapping. */
export const EXPOSURE = 1.0;
