# Changelog

## v0.002 — The Quarry in the Level Lab

- First level generator band: the Quarry (levels 1–2). Room-and-pillar limestone workings about 220 m across, each with its own pillar grid, height and floor terrace; grand halls with 30–55 m pillar spacing; collapsed workings with broken pillars, rubble hills and domed ceilings; natural rock between workings, broken through in many places. Floors, ceilings and collapse blend across the borders between workings.
- One density function per level (`level.sdf`), meshed with surface nets in chunks of 32³ cells, at four levels of detail (1, 2, 4, 8 m cells) out to 900 m. Chunks next to coarser ones overlap them so there are no cracks. Meshing runs in a worker pool; the terrain swaps chunk sets in one frame, so moving never opens holes.
- Lab: spawns in an intact grand hall; HUD shows the working you are in and mesh stats; `V` cycles colours (rock, working, detail level), `F` switches between survey fog and headlamp darkness. New URL params `look=yaw,pitch` and `color=`.
- `@futuremagic/core`: cellular results now name the second nearest cell, and `cellBorder` gives the exact Voronoi border distance (AssetGenerator PR #5).

## v0.001 — Scaffold and Level Lab shell

- Vite + TypeScript app, three.js r186 `WebGPURenderer` (WebGL 2 fallback, TSL materials only). Builds for `/dunfinity/` with `npm run build:publish`.
- Level Lab: free-fly camera, seed, depth and position from the URL, `?gl` forces WebGL 2.
- Shared code from `@futuremagic/core` (AssetGenerator, git submodule): seeded RNG, noise, math, heap.
- Shader policy ([docs/SHADERS.md](docs/SHADERS.md)): material registry, Stage (warm-up, compile before add), cap of 5 per second at least 200 ms apart, monitor, renderer hooks. Checked headless with `npm run check:shaders`.
- Code guards in `npm test`: banned patterns, layer boundaries, duplication ratchet over `src/` and the shared package (Toolbox finders).
- Seam index ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)), design docs in `docs/design/`.
