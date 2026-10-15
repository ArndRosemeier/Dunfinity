# Changelog

## v0.030 — Scavengers

- From level 4 you are not the only living person down here. Scavengers camp in twos and threes round small fires, sitting on crates. Most want to be left alone: they get up as you come near, one of them warns you off, and they let you pass at a distance. Walk into their camp or stab one and they all come for you with crowbars.
- Some camps are robbers. They want your pack and come for you as soon as they see you.
- A badly hurt scavenger drops everything and runs.

## v0.029 — Brine eels

- From level 5 there is something in the water. Pale brine eels, three metres long, lie deep in the brine lakes of the Salt Works and the flooded halls of the Cisterns. Wade into their water, or stand at its edge, and one comes for you, its back breaking the surface. It rears its head out of the water (your warning), strikes, and sinks back to come round again. They never leave the water: get out of it.
- Fix: when more creatures of a kind are near than can be drawn, the nearest are the ones you see.

## v0.028 — Feral dogs

- In the Cisterns, packs of feral dogs lie up in dry corners. Once they have seen you they do not rush you. The pack spreads out round you and circles, and one at a time the dog furthest behind your back drops onto its haunches (that is your warning), lunges in, bites and springs back to its place. Keep turning to face them.
- They glare: their eyes throw your headlamp back.

## v0.027 — The Cisterns

- Levels 6 to 8 are a new place: the Cisterns, a forgotten water-works and wartime bunker built into the mine. Long, regular halls of plain concrete pillars, about half of them standing in water you wade through, a few flooded deep enough to swim.
- Along the walls: rusted pipes on brackets with valve wheels, old pumps on their concrete plinths, and where it stayed dry the bunker's 1940s furniture (a table and chairs by a filing cabinet, bunk beds).
- Fewer Salt-Touched down here, and no cave crickets; the slimes are still about.

## v0.026 — The Foreman

- Level 5 has a boss. In a salt cathedral, beside an old mine bell on its timber frame, waits the Foreman: a Salt-Touched three metres tall. Rouse him and he strikes the bell with his pick, and every Salt-Touched of his crew working the rock round the hall comes for you, however far off. Then he comes himself: slow, with a long wind-up, and a blow that takes nearly half your health.
- His chest is crusted with salt, so a knife from in front mostly skids off. Get behind him. Badly hurt, he goes back and rings the bell once more, and that is your chance.
- His health shows at the top of the screen while he is after you.
- The tally of the killed now counts only what you killed (slimes kill each other too).

## v0.025 — Slimes

- From level 2 the floors have slimes, in colonies of three to five, and they come in two kinds at war. Lumen are pale jelly with glowing motes in them; Murk are black and oily. Where a Lumen colony and a Murk colony meet, they fight.
- Murk come for you. Lumen leave you alone, until you stab one; then that whole colony is after you (they calm down once you have been gone a while).
- They move in pulses, squeezing and flowing. Before a blow a slime squashes down (your warning), then throws itself forward. Hit, it quivers; dead, it melts into a puddle.
- Behind the scenes: all four kinds of creature now pick their den sites the same way.

## v0.024 — Sweep

- Behind the scenes: a duplication sweep (both finders). The five local frames of the props generator fold into one helper, and the nobody and the Salt-Touched find the floor under their feet the same way. Nothing changes in play.

## v0.023 — Cave crickets

- Pale cave crickets the size of a dog cling to the pillars and walls a few metres up, in little groups, feelers sweeping. Come near and they drop on you one after another: each sinks onto its long hind legs (that is your warning), leaps, lands on you with a knock, bites, and leaps off to come again from another side.
- They hate light. One that your headlamp is on will not leap at you, and one caught in the beam on the floor scatters into the dark and waits there before it tries again. Keep your light on them and they come at you from the sides.
- From level 1, and in the Salt Works too.

## v0.022 — Watchers

- Some of the salt miners on their plinths are watchers. Look away from one for a moment, and when you look back it is facing you. It never moves while you look.

## v0.021 — The Salt-Touched

- In the Salt Works you are no longer alone. The lost miners are still down there, changed: grey skin crusted with salt crystals, pale glowing eyes, salt-white hair, in their salt-stiff work clothes. Each one still works the rock where it stood, and you hear the pick before you see it.
- Come close, or stab one, and it turns, trudges after you and brings the pick down over its head. It is slow and the wind-up is long and plain, so you can step back out of it; if it lands, it takes a third of your health and throws you back. Get far enough away and it goes back to its rock. The knife works on them too; the ones you lay to rest stay down.
- Rats and the Salt-Touched now walk the floor the same way, so neither can jitter.
- Fix: a badly hurt rat was meant to bolt now and then, and never did. Now it does.

## v0.020 — Chapels and statues

- The salt miners carved. Against the salt walls and pillars stand statues of miners on their plinths: one leans on his pick, one prays, one holds a lamp up into the dark. Here and there a little chapel: steps up to an altar, a cross cut into the rock above, candles still burning.
- Old electric lamps hang on long chains from the roof of the Salt Works halls. Most of them still burn, though nothing down here has power.
- Loose stones and cut blocks are salt in the Salt Works.

## v0.019 — The Salt Works

- From level 3 down you are in the Salt Works: grey-white rock salt instead of limestone, its pillars fluted where the miners cut them, the pools brine. Thin blue veins glow in the salt, slowly pulsing, so the halls are never quite dark.
- The level name in the HUD says which band you are in.

## v0.018 — Solid things, steady knees

- You can no longer walk through the props. Carts, shacks, crates, barrels, stacked blocks, lamp posts, derricks, big fallen stones and the railings round the shafts stop you, and the rats run round them too. Rails, sleepers and chippings you still step over.
- Fix: a standing knee could fold backwards or snap bent on uneven ground (Scale's humans had it too). The leg's IK lost track of which way the knee bends when the leg was nearly straight, and it popped on and off with tiny ground offsets. Now knees always bend forward and settle smoothly.

## v0.017 — Dust and leavings

- Dust hangs in the air: fine specks drift in the headlamp's beam, and only there, so the cone of light shows in the dark.
- The quarrymen left more behind. Against pillars and walls: crates (one stacked on another now and then) and a barrel, a pick and a shovel leant on the rock with a bucket, or a stack of squared blocks that were never hauled up. Out in the halls, here and there, a wooden derrick for lifting blocks, its rope and hook still hanging, sometimes over the block it never lifted.

## v0.016 — Shadows

- The headlamp casts shadows. It is a cone now, carried above the nobody's head and shining where you look, with a little light spilling all round. Stones, pillars, props, rats and the nobody throw shadows away from it, so from behind you see them stretch ahead into the dark.
- Fix: the first moments in a level built a dozen shaders while you played (a stutter). The lamp was moved onto the figure after the warm-up, and that alone changed what every shader is keyed by. Now no shader is built after the warm-up, shadows included.

## v0.015 — Rats you can see coming

- Rats no longer jitter. Before, a rat by your legs could flick back and forth between two spots: its place round you turned as it moved, it overshot and came back, and it dithered left and right round a stone. Now each rat takes its own place round you (fixed by where its nest lies), slows as it arrives and stops, and keeps to one side going round things. Tests check that no rat goes back and forth, at 60 fps, at 10 fps and round a walking player.
- Every rat action shows. A rat that notices you stands up on its hind legs a moment, nose to you, before the charge. A bite rears back with the mouth up, then lunges in, head down and paws out, and the rat really jumps forward and back. A lunge stops at your legs instead of running into them.
- Getting hurt shows: the edges of the screen flash red (in first person too), as well as the flinch.

## v0.014 — Stones underfoot

- Loose stones on the floors of the Quarry: a few everywhere, a skirt of chippings round the feet of the pillars and walls where the miners cut, and heaps of broken blocks where the roof came down. Limestone breaks blocky, so they are slabs and blocks, half sunk in the dust, in the same limestone as the walls.
- Props tiles carry a `stones` mesh, drawn in the `ROCK` kind.

## v0.013 — Limestone

- The rock looks like rock: limestone mottled in patches a metre or two across, a fine grain, dark bedding seams that come and go along the walls and pillars, gritty dusty floors, and a bumpy surface the headlamp rakes across. All worked out in the shader from where a point is, so it never repeats and needs no textures.
- The new `ROCK` material kind (one shader, compiled in the warm-up like the rest).

## v0.012 — Finds

- Things to find: what the miners left on the floor of the Quarry (old Pfennigs, brass tally tokens, chisels, clay pipes, tobacco tins, a carbide lamp now and then) and what the rats dragged into their nests (rats hoard shiny things: silver spoons, medals, a pocket watch, gold rings only there). A faint twinkle gives a find away in the dark.
- E picks up the find at your feet (the nobody stoops for it). The HUD says what you carry and what the pawn shop up top might pay for it. A dead nobody's pack stays down there; a find once taken is gone from the level for the next grandchild too.
- The knife is held for a thrust now: the blade carries on the line of the arm instead of pointing back.
- Fix: a key pressed where it meant nothing no longer fires later. E pressed during a climb used to send you straight back down the next shaft you came out at; R pressed while alive used to skip the death screen.
- Health comes back slowly once nothing has hurt you for ten seconds.
- `Finds`, `Pack`, `FindView`, `meshOf`, `Controls.endFrame`.

## v0.011 — Rats and the kitchen knife

- Rats: the first enemy. Fat quarry rats, about 40 cm with the tail, with glowing eyes; they live in nests a few to a nest on the dry floor of the workings (none near where you arrive, a few more on each level down). They sniff about the nest; get close and the nest notices, and they run at you, spread round you and bite. Badly hurt ones bolt for a moment. They scramble up knee-high ledges, but not up walls.
- The nobody carries grandma's kitchen knife. Click (with the mouse captured) to stab: it turns you to the nearest rat ahead and lunges. Two stabs kill most rats. The knife comes out when rats are after you and goes back after a while.
- Bites hurt and make the nobody flinch; the HUD says what hurt you, and if the rats get you, it says so. "rats killed" counts this level's rats.
- The dead stay dead while you are on the level.
- `src/combat/combat.ts` (blows and damage for anyone who can be hit), `Rats`, `RatView`, `CellMemo`, the METAL material kind.

## v0.010 — What's new

- The version is shown top right; click it for this history, newest first (Esc closes it). Each merge to main is one version: v0.001, v0.002, ...

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
