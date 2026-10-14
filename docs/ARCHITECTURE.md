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
| Cells, Voronoi distances, nearest and second nearest feature point | `cellular2`, `cellular3` | `@futuremagic/core` noise.ts |
| How far to the border between two Voronoi cells? | `cellBorder` | `@futuremagic/core` noise.ts |
| clamp, lerp, remap, smoothstep, smooth min/max, angles, damping | `clamp`, `lerp`, `remap`, `smoothstep`, `smin`, `smax`, `angleDiff`, `damp`, ... | `@futuremagic/core` math.ts |
| Small vector math on plain arrays | `Vec3`, `v3add`, `v3dot`, ... | `@futuremagic/core` math.ts |
| Colour conversions | `hsl2rgb`, `hexToRgb`, `rgbToHex`, `srgbToLinear`, `mixRgb` | `@futuremagic/core` math.ts |
| A priority queue (A*, flood fills, event queues) | `MinHeap` | `@futuremagic/core` heap.ts |

### Rendering

| Question | The one way | Where |
|---|---|---|
| Make the renderer | `createRenderer` (guarded: nothing else constructs one) | `src/render/renderer.ts` |
| I need a material | Add or reuse a *kind*: `VERTEX_COLOR_SOLID.make()`, `GLOW.make()`, `WATER.make()`. Never `new ...Material` elsewhere (guarded). The one exception: humans, whose node materials the humanoid package makes (they are compiled through `stage.warmUp(extra)`). | `src/render/materials.ts` |
| Put something into the visible scene | `stage.add(obj)`: compiles first, then adds | `src/render/stage.ts` |
| Compile something you add to your own group later | `stage.prepare(obj)` | `src/render/stage.ts` |
| Show a level's rock around the viewer | `Terrain` (streams chunks, swaps without holes) | `src/render/terrain/Terrain.ts` |
| Turn worker mesh data (positions, normals, colours, indices) into a mesh | `meshFromData(data, kind)` | `src/render/meshes.ts` |
| Show a level's props (rails, lamps, shacks) around the viewer | `Props` (streams tiles) | `src/render/props/Props.ts` |
| Light the level's burning lamps | `LampLights` (a fixed pool made before the warm-up; never add lights later) | `src/render/props/lamps.ts` |
| Compile shaders ahead of time | `stage.warmUp(extra)` / `stage.add()` only (guarded); `extra` is for objects whose materials are not kinds (humans) | `src/render/stage.ts` |
| Did something compile on the render path? | `shaders.report()` in the console; `npm run check:shaders` | `src/render/shaders/monitor.ts` |
| Where on screen is a world point? | `screen.toScreen` *(planned; guarded already)* | `src/render/screen.ts` |
| A third-person camera that stays out of the rock | `OrbitCamera` (pulls in along `level.trace`) | `src/render/camera/OrbitCamera.ts` |
| Look at a level: scene, fixed lights, warm-up, streamed rock and props | `LevelView` (`LevelView.open`) | `src/render/LevelView.ts` |
| The player's figure | `Nobody` (Scale's human in rags, posed from the `Body`) | `src/render/humans/nobody.ts` |
| A human: body, skeleton, materials, clothes, animation | `Humanoid` (`Humanoid.create(look, { wardrobe })`, `dress`, `update`) | `@futuremagic/humanoid/three` |
| A human's look (race, age, hair, skin) from a seed | `randomAppearance(race, seed, opts)` | `@futuremagic/humanoid` |
| Which clothes exist and how they sit | `WARDROBE` (the package's `Wardrobe` hook) and outfits like `rags(seed)` | `src/render/humans/wardrobe.ts` |
| What the animator plays for the body's state | `moveOf(body)` | `src/render/humans/move.ts` |
| Where the human assets (bodies, clips) are served | `/humanoid/` from the package's `assets/` (Vite plugin), set by `setHumanAssetBase` | `vite.config.ts`, `src/render/humans/nobody.ts` |
| The HUD line on shader health | `stage.hudLine()` | `src/render/stage.ts` |

### The level (generator)

| Question | The one way | Where |
|---|---|---|
| Is this point rock or air, how far to rock? | `level.sdf(x, y, z)`: the single density function (positive in air) | `src/gen/level.ts` |
| Where is the floor under a point? | `level.floorAt(x, z)` (the working's floor; ignores pillars) | `src/gen/level.ts` |
| Which quarry working is this, what does it look like? | `level.workingAt(x, z)` | `src/gen/level.ts` |
| Where does a viewer start? | `level.spawn()` | `src/gen/level.ts` |
| Where exactly is the rock surface under a point (where props stand)? | `level.groundAt(x, z)` | `src/gen/level.ts` |
| Which way does the rock face here? | `level.normal(x, y, z, out)` | `src/gen/level.ts` |
| How far until a ray hits rock? | `level.trace(...)` | `src/gen/level.ts` |
| Is there water here, how high does it stand? | `level.waterAt(x, z)` (water wherever the ground is lower) | `src/gen/level.ts` |
| Border distance, pillars, rubble at a column | `level.columnAt(x, z)` | `src/gen/level.ts` |
| A quarry working's pillar grid: grid coordinates, which pillars stand | `field.toGrid`, `field.fromGrid`, `field.pillarAt` | `src/gen/quarry.ts` |
| What the miners left in a tile (rails, carts, lamps, shacks), and its standing water | `quarryProps(level, tx, tz)` | `src/gen/quarryProps.ts` |
| Build merged box geometry for props | `PropBuilder` (`box`, `upright`, `beam`) | `src/gen/propMesh.ts` |
| Sample the field on a grid fast | `level.sampleGrid` (one column pass per x, z) | `src/gen/level.ts` |
| Turn a grid of distances into a mesh | `surfaceNets` | `src/gen/surfaceNets.ts` |
| Mesh one chunk of a level | `meshChunk` (skips chunks far from any surface) | `src/gen/chunkMesh.ts` |
| Which chunks, at which detail, around a viewer? | `chunksAround` (octree; marks sides next to coarser chunks) | `src/world/chunks.ts` |
| Run work off the main thread | `WorkerPool` / `createMeshPool` / `createPropsPool` (guarded: `new Worker` only there) | `src/workers/pool.ts` |
| Write a worker script | `serve(handle)` and `levelFor(seed, depth)` | `src/workers/serve.ts` |

### The world (planned)

| Question | The one way | Where |
|---|---|---|
| Where is the ceiling above a point? | `world.ceilingAt` | `src/world/query/` |
| Can A see B? Can A shoot B? | `world.sight(a, b)` (rock, darkness and objects) | `src/world/query/` |
| How lit is this point? | `world.light(x, y, z)` | `src/world/query/` |
| Move a body on the rock: walk, climb, swim, fall | `Body.step` and its metrics `MOVE` (the reachability check will use the same) | `src/world/traverse/body.ts` |
| A persisted change to the world | `persist.mark(chunk, change)` (guarded: `localStorage` only in `src/persist/`) | `src/persist/` |

### Gameplay (planned)

| Question | The one way | Where |
|---|---|---|
| Does a blow, blast or effect reach someone? | `combat.reach(...)` then `combat.damage(...)`; never write `hp` | `src/combat/` |

### The Lab

| Question | The one way | Where |
|---|---|---|
| Read seed, depth, position, look, colour mode and backend from the URL | `parseViewParams` | `src/app/params.ts` |
| Held keys, mouse look, wheel | `Controls` | `src/input/controls.ts` |
| Fly around | `FlyCamera` | `src/lab/FlyCamera.ts` |

## Layers

Import rules, enforced by `npm test` (`tools/guards/rules.json`):

- `src/gen` (the generator) is pure data: no three.js, no render, no Lab, no world facade. It runs in workers and headless tests.
- `src/world` (queries) is pure: no three.js, no render, no Lab.
- `src/render` does not know about the Lab.

## Shared code

`@futuremagic/*` packages live in AssetGenerator (`vendor/assetgenerator/packages/`, a git submodule) and are installed as `file:` dependencies. Code there must not be re-implemented here; the duplication ratchet scans both. Move code into a package when a second project needs it ([docs/design/shared-package.md](design/shared-package.md)).
