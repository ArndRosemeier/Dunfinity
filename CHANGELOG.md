# Changelog

## v0.001 — Scaffold and Level Lab shell

- Vite + TypeScript app, three.js r186 `WebGPURenderer` (WebGL 2 fallback, TSL materials only). Builds for `/dunfinity/` with `npm run build:publish`.
- Level Lab: free-fly camera, seed, depth and position from the URL, `?gl` forces WebGL 2.
- Shared code from `@futuremagic/core` (AssetGenerator, git submodule): seeded RNG, noise, math, heap.
- Shader policy ([docs/SHADERS.md](docs/SHADERS.md)): material registry, Stage (warm-up, compile before add), cap of 5 per second at least 200 ms apart, monitor, renderer hooks. Checked headless with `npm run check:shaders`.
- Code guards in `npm test`: banned patterns, layer boundaries, duplication ratchet over `src/` and the shared package (Toolbox finders).
- Seam index ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)), design docs in `docs/design/`.
