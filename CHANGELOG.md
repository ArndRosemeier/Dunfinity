# Changelog

## v0.009 — Down the ladder

- Climbing a shaft's ladder is played out instead of a cut to black: the nobody walks to the ladder, turns their back to the shaft, lowers themself over the rim and climbs down hand over hand, hands and feet on the rungs (Scale's manhole climb). A few metres down the picture fades, and the next level comes up out of the dark.
- Below the first level you arrive at the foot of the way back up: an iron ladder bolted up the side of a pillar, into a shaft through the ceiling, with a burning lamp beside it. You climb the last metres down it, step off, and turn away.
- E at the foot of that ladder climbs back up to the level above, coming out over the rim of its nearest shaft.
- The camera turns to watch the climb (behind the climber, looking at the ladder).
- `ladderOf(shaft)` (rungs, the wall, where one gets on and off), `level.ascent`, `LadderClimb` (the puppet scene), `nobody.puppet`.

## v0.008 — Skin on WebGPU

- Fix: on WebGPU (Chrome, Edge) the nobody had no skin, only eyes, teeth, hair and clothes. The skin mesh needed 9 vertex buffers, one more than WebGPU allows, so its shader never built. Face coordinates and the expression column now share one attribute (`@futuremagic/humanoid`). WebGL was not affected.

## v0.007 — The way down

- Mine shafts: the Quarry's ways down. Round shafts 40 m deep, cut into the floor of intact workings, with a timber headframe, a pulley and a rope, a burning lamp, a railing round the rim and an iron ladder down one wall. None near where you arrive, more and more of them further out (the Territories rule): the nearest is usually 400–700 m away.
- Find one by the draft: within 600 m the HUD says where cold air comes from (ahead, to the left, behind-right…), stronger when close.
- At the ladder, E climbs down: a fade to black, and you come out on the next level with the health you had. Falling into a shaft is fatal. R after a death starts the next grandchild at the top again.
- `level.descents` and `level.arrival`; the level field carries the shafts, so meshing, collision and the camera all know them. `LevelView.go(level)` swaps the streamed rock and props without touching shaders (0 builds on the way down).

## v0.006 — The nobody is a person

- The box stand-in is gone: the nobody is Scale's human (decision D1), a grandchild with a face, hair and a body of their own from the seed, in rags (a patched tunic, worn trousers, foot wraps). Motion-captured animation follows the body: standing idle, walking, sprinting, jumping, falling, climbing, swimming and dying; the feet find the rock.
- Scale's humans now live in the shared `@futuremagic/humanoid` package (AssetGenerator): the pure body build plus a node-material-only renderer side (`Humanoid`: character, garments, animator, clips). Games bring their own clothes through a `Wardrobe` hook.
- The human assets (bodies, clips) are served from the package under `/humanoid/`.
- Shaders: the human's materials compile in the warm-up (`stage.warmUp(extra)`); after it, 0 builds while walking.

## v0.005 — Walk the Quarry

- The game is now the default page: you are the nobody, standing in a grand hall of the Quarry in the dark, with a lamp. The Level Lab moved to `?lab`.
- Movement on the rock itself (no physics engine, the level's distance field is the collision): walk, run, jump; walk into any rock to climb it while stamina lasts, except overhangs (decision L1), and lunge up or push off with Space; climb over the top onto a ledge; swim in water deeper than the chest; hard landings hurt and a long fall kills. Death is final: R sends the next grandchild.
- Third-person camera that orbits with the mouse and pulls in where rock is in the way; the wheel zooms down to first person (decision D9). A stand-in figure of boxes until Scale's human arrives.
- Shared setup: `LevelView` (scene, fixed lights, warm-up, rock and props) for the Lab and the game, `Controls` for input, `level.normal` and `level.trace`.
- Fix: the shader warm-up compiled only the material kinds in front of the camera; it now compiles all of them wherever the camera looks.

## v0.004 — Water in the Quarry

- Groundwater: each level has a water table a little above the lowest floor terrace, wandering slowly across the level. Low workings below it are flooded (pillars standing in dark, still water), others only hold puddles in dips, and the higher terraces stay dry. Deep water is darker than shallow water.
- Water surfaces are built with the props, per 64 m tile in workers, with a new glossy `water` material kind (compiled in the warm-up, like every kind).
- Tracks, lamps, shacks and crates keep out of the water; the Lab spawn is always dry.
- Level: `level.waterAt(x, z)`, the water surface height.

## v0.003 — Lamps and the miners' leftovers

- The Quarry's intact workings now hold what the quarrymen left: narrow-gauge tracks down the aisles between pillars, ore carts (some still loaded), lamp posts beside the tracks, lamps on pillar faces, and site shacks with a lamp over the door and sometimes a lit window and crates. Everything follows the working's pillar grid and comes from the seed, in 64 m tiles built in workers.
- Lamplight: about half the lamps still burn. Eight point lights, fixed before the shader warm-up, follow the burning lamps nearest the viewer and flicker a little; unused ones sit at zero, so lights never cause a shader build. Lamp flames and lit windows use a new unlit `glow` material kind.
- Lab: `F` now dims the ambient light and the headlamp too, so the lamps show; `?dark` starts that way. The HUD counts prop tiles and burning lamps.
- Level: `level.columnAt` and `level.groundAt` (the rock surface under a point, roughness included). The worker side of the pool protocol is one helper (`serve`), and worker mesh data becomes a three.js mesh in one place (`meshFromData`).

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
