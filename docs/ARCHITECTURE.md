# Architecture and seam index

**Read this before writing any helper.** Each row is a question someone will ask while coding, and the one place that answers it. If your question is here, use that function. If it is not, search first (`rg`), then add the row in the same PR as the new seam. If a second way to answer a listed question seems needed, stop and say so in the PR instead of writing it. (Method: [docs/design/no-duplicates.md](design/no-duplicates.md).)

Rows marked *planned* name the seam we will build; do not invent a different one when the time comes.

## Seam index

### Numbers and randomness

| Question | The one way | Where |
|---|---|---|
| I need a random number | `new Rng(deriveSeed(seed, 'path', ...))`. Never `Math.random` (guarded). | `@futuremagic/core` rng.ts |
| A stable hash of ints, floats or a string | `hash2i`, `hash3i`, `hash2f`, `hash3f`, `hashString`, `hashCombine` | `@futuremagic/core` rng.ts |
| Smooth noise, fbm, ridged, domain warp | `Noise` | `@futuremagic/core` noise.ts |
| Cells, Voronoi distances, nearest feature point | `cellular2`, `cellular3` | `@futuremagic/core` noise.ts |
| clamp, lerp, remap, smoothstep, smooth min/max, angles, damping | `clamp`, `lerp`, `remap`, `smoothstep`, `smin`, `smax`, `angleDiff`, `damp`, ... | `@futuremagic/core` math.ts |
| Small vector math on plain arrays | `Vec3`, `v3add`, `v3dot`, ... | `@futuremagic/core` math.ts |
| Colour conversions | `hsl2rgb`, `hexToRgb`, `rgbToHex`, `srgbToLinear`, `mixRgb` | `@futuremagic/core` math.ts |
| A priority queue (A*, flood fills, event queues) | `MinHeap` | `@futuremagic/core` heap.ts |

### Rendering

| Question | The one way | Where |
|---|---|---|
| Make the renderer | `createRenderer` (guarded: nothing else constructs one) | `src/render/renderer.ts` |
| I need a material | Add or reuse a *kind*: `VERTEX_COLOR_SOLID.make()`. Never `new ...Material` elsewhere (guarded). | `src/render/materials.ts` |
| Put something into the visible scene | `stage.add(obj)`: compiles first, then adds | `src/render/stage.ts` |
| Compile shaders ahead of time | `stage.warmUp()` / `stage.add()` only (guarded) | `src/render/stage.ts` |
| Did something compile on the render path? | `shaders.report()` in the console; `npm run check:shaders` | `src/render/shaders/monitor.ts` |
| Where on screen is a world point? | `screen.toScreen` *(planned; guarded already)* | `src/render/screen.ts` |
| Where may the camera go? | `camera.solidAt` *(planned)* | `src/render/camera/` |

### The world (planned with the level generator)

| Question | The one way | Where |
|---|---|---|
| Is this point rock or air, how far to rock? | `world.sdf(x, y, z)`: the single density function | `src/world/` |
| Where is the floor or ceiling below/above a point? | `world.floorAt`, `world.ceilingAt` | `src/world/query/` |
| Can A see B? Can A shoot B? | `world.sight(a, b)` (rock, darkness and objects) | `src/world/query/` |
| How lit is this point? | `world.light(x, y, z)` | `src/world/query/` |
| Can this body stand, climb, swim here? | `traverse.*` (also used by the generator's reachability check) | `src/world/traverse/` |
| A persisted change to the world | `persist.mark(chunk, change)` (guarded: `localStorage` only in `src/persist/`) | `src/persist/` |
| Run work off the main thread | the worker pool (guarded: `new Worker` only there) | `src/workers/pool.ts` |

### Gameplay (planned)

| Question | The one way | Where |
|---|---|---|
| Does a blow, blast or effect reach someone? | `combat.reach(...)` then `combat.damage(...)`; never write `hp` | `src/combat/` |

### The Lab

| Question | The one way | Where |
|---|---|---|
| Read seed, depth, position and backend from the URL | `parseLabParams` | `src/lab/params.ts` |
| Fly around | `FlyCamera` | `src/lab/FlyCamera.ts` |

## Layers

Import rules, enforced by `npm test` (`tools/guards/rules.json`):

- `src/gen` (the generator) is pure data: no three.js, no render, no Lab, no world facade. It runs in workers and headless tests.
- `src/world` (queries) is pure: no three.js, no render, no Lab.
- `src/render` does not know about the Lab.

## Shared code

`@futuremagic/*` packages live in AssetGenerator (`vendor/assetgenerator/packages/`, a git submodule) and are installed as `file:` dependencies. Code there must not be re-implemented here; the duplication ratchet scans both. Move code into a package when a second project needs it ([docs/design/shared-package.md](design/shared-package.md)).
