/**
 * The one renderer (guarded: nothing else may construct one). three.js WebGPURenderer: WebGPU where the
 * browser has it, its WebGL 2 backend everywhere else, so materials are written once (TSL / node materials).
 */
import { WebGPURenderer } from 'three/webgpu';

export interface RendererInfo {
  renderer: WebGPURenderer;
  /** Which backend three.js picked. */
  backend: 'webgpu' | 'webgl2';
}

export async function createRenderer(canvas: HTMLCanvasElement, opts: { forceWebGL?: boolean } = {}): Promise<RendererInfo> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: opts.forceWebGL ?? false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { renderer, backend };
}
