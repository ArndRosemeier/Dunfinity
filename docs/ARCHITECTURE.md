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
| I need a material | Add or reuse a *kind*: `VERTEX_COLOR_SOLID.make()`, `ROCK.make()` (the generated rock), `DUST.make()` (motes, moved by the shader), `GLOW.make()`, `METAL.make()`, `WATER.make()`, `FLOW.make()` (water running over rock, rippling upwards). Never `new ...Material` elsewhere (guarded). The one exception: humans, whose node materials the humanoid package makes (they are compiled through `stage.warmUp(extra)`). | `src/render/materials.ts` |
| Put something into the visible scene | `stage.add(obj)`: compiles first, then adds | `src/render/stage.ts` |
| Compile something you add to your own group later | `stage.prepare(obj)` | `src/render/stage.ts` |
| Show a level's rock around the viewer | `Terrain` (streams chunks, swaps without holes) | `src/render/terrain/Terrain.ts` |
| Turn worker mesh data (positions, normals, colours, indices) into a mesh | `meshFromData(data, kind)` | `src/render/meshes.ts` |
| A small hand-built mesh posed per frame (creature parts, finds) | `meshOf(build, kind)` | `src/render/meshes.ts` |
| Put a mesh on a kind (its material and the kind's shadow flags) | `wear(mesh, kind)` | `src/render/meshes.ts` |
| A creature modelled, rigged and animated in Blender (AssetGenerator's creature generators): load its glb, a copy per figure, play its clips (faded, gaits paced by distance, a flinch on top) | `Rigged.fetch(file, coat)` (no coat: a skin in vertex colours, the mushroom monsters); a figure is a `RiggedFigure` (its `clipFor` and `travelled`; `faster` for gait bands; `place` for one that climbs; `posed` for one whose body the sim shapes, an eel's chain), or `rig.figure()` + `Animator` by hand; the glb in `public/creatures/`, its coat a `CoatKind` (`DOG_COAT`, `RAT_COAT`, `CRICKET_COAT`, `LUMEN_COAT`, `MURK_COAT`, `EEL_COAT`) in `materials.ts`; skinned figures go into the warm-up's `extra` | `src/render/creatures/rigged.ts` |
| Show a level's props (rails, lamps, shacks) around the viewer | `Props` (streams tiles) | `src/render/props/Props.ts` |
| Which meshes cast and receive the headlamp's shadow | the material kind's `shadow` flags, set by `meshFromData` (never per mesh) | `src/render/materials.ts` |
| How strongly the rock's veins glow, and the band's finish of its rock (its mix of rock types in patches and beds, rock salt, concrete shuttering, wet sheen) | `ROCK_VEINS.value`, `ROCK_FINISH`, set by `LevelView` from `level.band.veins` / `level.band.finish` | `src/render/materials.ts` |
| How a style's rock is worked at a point (pick marks, masonry and its course height, flowstone), for the rock shader | `Style.surface` (a `Surface`; natural rock if left out), blended by `StyledField.surface`, meshed as the `surface` attribute (`level.surfaces`) | `src/gen/style.ts`, `src/gen/styledField.ts` |
| An antialiased thin line in a shader (joints, cracks, board marks) | `thinLine(dist, width)` | `src/render/materials.ts` |
| Where the headlamp is carried (it casts the one shadow) | `view.carrier` (null: on the camera) | `src/render/LevelView.ts` |
| Dust in the air, seen in the headlamp's beam | `Dust` (one mesh of the `DUST` kind; `follow(lamp)` each frame) | `src/render/dust.ts` |
| Light the level's burning lamps | `LampLights` (a fixed pool made before the warm-up; never add lights later; `power` from `band.lamplight`) | `src/render/props/lamps.ts` |
| Compile shaders ahead of time | `stage.warmUp(extra)` / `stage.add()` only (guarded); `extra` is for objects whose materials are not kinds (humans) | `src/render/stage.ts` |
| Did something compile on the render path? | `shaders.report()` in the console; `npm run check:shaders` | `src/render/shaders/monitor.ts` |
| Where on screen is a world point? | `screen.toScreen` *(planned; guarded already)* | `src/render/screen.ts` |
| A third-person camera that stays out of the rock | `OrbitCamera` (pulls in along `level.trace`) | `src/render/camera/OrbitCamera.ts` |
| Look at a level: scene, fixed lights, warm-up, streamed rock and props; switch to another level | `LevelView` (`LevelView.open`, `view.go(level)`) | `src/render/LevelView.ts` |
| The player's figure | `Nobody` (Scale's human in rags, posed from the `Body`) | `src/render/humans/nobody.ts` |
| A human: body, skeleton, materials, clothes, animation | `Humanoid` (`Humanoid.create(look, { wardrobe })`, `dress`, `update`) | `@futuremagic/humanoid/three` |
| A human's look (race, age, hair, skin) from a seed | `randomAppearance(race, seed, opts)` | `@futuremagic/humanoid` |
| Which clothes and held items exist and how they sit | `WARDROBE` (the package's `Wardrobe` hook: clothes, and items like the kitchen knife) and outfits like `rags(seed)` | `src/render/humans/wardrobe.ts` |
| What the animator plays for the body's state | `moveOf(body)` | `src/render/humans/move.ts` |
| Play out a ladder climb (walk up, over a rim or at the foot, hands and feet on the rungs, a level change in the middle), and the pull-up over the top of a climb on the rock (step `ledge`) | `LadderClimb` (`play(steps)`, `advance`) | `src/render/humans/ladderClimb.ts` |
| Pose the nobody in a scripted scene (not from the body) | `nobody.puppet(...)` with the animator's `override` / `limbs` | `src/render/humans/nobody.ts` |
| Where the human assets (bodies, clips) are served | `/humanoid/` from the package's `assets/` (Vite plugin), set by `setHumanAssetBase` | `vite.config.ts`, `src/render/humans/nobody.ts` |
| The HUD line on shader health | `stage.hudLine()` | `src/render/stage.ts` |

### The level (generator)

| Question | The one way | Where |
|---|---|---|
| Is this point rock or air, how far to rock? | `level.sdf(x, y, z)`: the single density function (positive in air) | `src/gen/level.ts` |
| A kind of place (a level style: the excavation halls, grandma's cellar, karst, rift, collapse, catacombs, dungeon rooms, root hollows, fungal grotto, lava tubes, geodes, basalt columns, flooded galleries, dwarven halls), and the level's field put together from its styles | `Style` (`column`, `at`, `color`, `climbable`, `portal`; its column's floor and ceiling are its envelope); `StyledField` (`level.field`; `field.styles`, `field.regions`, and `field.excavation` for the workings' own business: `workingAt`, `toGrid`, `fromGrid`, `pillarAt`); the edge contract E1–E6 lives in `StyledField` only | `src/gen/style.ts`, `src/gen/styledField.ts`, `src/gen/karst.ts`, `src/gen/rift.ts`, `src/gen/collapse.ts`, `src/gen/catacombs.ts`, `src/gen/dungeon.ts`, `src/gen/roots.ts`, `src/gen/fungal.ts`, `src/gen/lava.ts`, `src/gen/geode.ts`, `src/gen/basalt.ts`, `src/gen/flooded.ts`, `src/gen/dwarven.ts` (a style is made from the level's seed, band and water table: `src/gen/styles.ts`), plan: `docs/design/level-styles.md` |
| Making a level's styles from its mix; a new style's one registry entry; a level all of one style for trying it out (`?style=<id>`) | `stylesOf(mix, excavation, seed, band)`, `onlyMix`, `NAMED_STYLES`; `new Level(seed, depth, style?)` and `level.key` (a `LevelKey`, what workers make the same level from) | `src/gen/styles.ts`, `src/gen/level.ts` |
| Which style owns a point, and how much of each style is there (the region map; a level's `Mix` of styles and weights is on its band) | `Regions` (`styleAt`, `regionAt`, `sharesAt`); a style's own share is `style.share(x, z)`; a level's mix is `mixOf(seed, depth)` (`src/gen/bands.ts`), a style's share of a whole mix `shareOf(mix, id)` | `src/gen/regions.ts` |
| Below level 10: which stratum a depth is in, and the styles a world draws for it | `stratumOf(depth)`, `genome(seed, stratum)`, `STRATA` (read through `mixOf` and `bandOf`) | `src/gen/genome.ts` |
| Whether a style's own things (pillars, props, dens, ways down) may stand at a point (E5) | `owns(style, x, z)` (share ≥ `SHARE_OWN`; there the field is exactly the style's) | `src/gen/style.ts` |
| Distance to a box from a point's offsets beyond its half-sizes (a style's rooms, blocks, niches, pillars) | `boxDist2(qx, qz)`, `boxDist3(qx, qy, qz)` | `src/gen/shapes.ts` |
| Jittered Voronoi cells with a smooth blend at their borders (the workings, the style regions) | `voronoiNear(seed, x, z, size, jitter, blend, out)`, `blendShare` | `src/gen/voronoi.ts` |
| A column with no pillar (stump, stub, older drum) | `noPillar(col)` | `src/gen/quarry.ts` |
| A column no crew worked (another style's: no pillar, rubble or collapse; the working that stands for it) | `unworked(col, working, border, cavern)` | `src/gen/quarry.ts` |
| A level style's own things on its own ground (plants, mushrooms, bones, crystals; not the excavation's, which are `quarryProps`) | `Style.props(d: Dress)`, placing with `scatter(d, cell, salt, room, place)` and `roofOver`; called by the prop pass only on the style's own ground (E5) | `src/gen/styleProps.ts`, `src/gen/quarryProps.ts` |
| Passages joining every cell of a grid (a tree, west or south, plus some for loops: the dungeon's corridors, the geodes' cracks) | `joined(cells, i, j, axis, extra)` | `src/gen/gridTree.ts` |
| A style's grain on a level (the angle from the seed) and the frame turned by it, u along and v across (the catacombs', dungeon's and dwarven halls' grids); parallel meandering lines all one way along it (the rift's faults, the lava's tubes) and the point of the nearest one | `grainOf`, `Grain` (`u`, `v`, `xz`), `GrainLines` (a `Grain`; `line`, `nearest`) | `src/gen/grainLines.ts` |
| Solid things of a style's own standing in a cave's chambers (roots, giant mushrooms, crystals): made per chamber of a grid of cells from a seed, a column asking only those near it; tapered round pieces | `CaveThings` (`column`, `at`, `nearest`) over `Chambers` (`karstChambers(cave)` for a karst) with a `ThingKind` (`make`, `plan`, `dist`); `Taper`, `taperPlan`, `taperDist`; the style caps its field at `THING_REACH` | `src/gen/caveThings.ts` |
| Where is the floor under a point? | `level.floorAt(x, z)` (the working's floor; ignores pillars) | `src/gen/level.ts` |
| Which quarry working is this, what does it look like? | `level.workingAt(x, z)` | `src/gen/level.ts` |
| Put a point onto an upright rock face (chalk on a pillar, water running up it) | `level.ontoRock(x, y, z, n, fixed)` | `src/gen/level.ts` |
| Is a spot dry ground? How far to the rock beside a column? | `level.dry(x, z, margin)`; `rockDistance(col)` | `src/gen/level.ts`, `src/gen/quarry.ts` |
| Which band (Quarry, Salt Works, Cisterns, ...) a depth belongs to, and how it looks: rock colours, pillar fluting, floor steps between halls, water, glowing veins, what was left against the rock (carvings, waterworks), the share of natural caverns (`band.caverns`, `Working.cavern`, `Column.cavern` in `QuarryField`), its name | `bandOf(depth)`, `level.band` (passed to `QuarryField`) | `src/gen/bands.ts` |
| Grandma's cellar (depth 0, the same for every seed): its rooms, her house's ground floor above (`CELLAR.house`; thin inner walls are furniture), the old shaft, its things | `CellarField` (a `QuarryField` whose `column`/`at`/`color` are the cellar's), `CELLAR`, `CELLAR_SHAFT`, `CELLAR_BAND`; furnished by `furnishCellar` through `quarryProps` | `src/gen/cellar.ts`, `src/gen/cellarProps.ts` |
| The town above (depth 0): grandma's street at night, its houses, the hill and the valley | `TOWN`, `HOUSES`, `townAir` (joined into `CellarField.at`), `townGround`, `houseColors`; furnished by `furnishTown` (crisp house shells over the field's rounded houses, lamps, windows) | `src/gen/town.ts`, `src/gen/townProps.ts` |
| Shops in the town and grandma's purse (euros, kept for the family, never salt) | `House.shop`, `shopDoor(shop)` (where one stands to deal); Ilse's pawn shop: `sell(pack, visit)`, `PAWN`; Kemal's hardware store: `Gear` (`buy`, its `climb`/`edge`/`armour` factors, saved as `GrandchildData.gear`), `GEAR`, applied through `Body.armour`; the purse is `SaveData.euros` | `src/gen/town.ts`, `src/loot/pawn.ts`, `src/loot/hardware.ts`, `src/persist/save.ts` |
| Neighbours one calls on in the town (Frau Weber) | `House.home`, `homeDoor(who)` (shops and homes both stand at `atDoor(house)`); `Neighbour` (`canHear`, `talk(known, now)`, `turn`, `blocker` under `WEBER_KEY`), drawn by `NeighbourView` (a `HumanPool` of one) | `src/gen/town.ts`, `src/world/neighbour.ts`, `src/render/humans/neighbourView.ts` |
| Something to read on a level (grandma's note, the notary's letter); a place always safe to rest in (her salt circle) | `level.writing`, `level.haven` (rested in through `Campfire`); the letter's text `notaryLetter(heir, seed)` | `src/gen/level.ts`, `src/world/fire.ts`, `src/gen/notary.ts` |
| Where does a viewer start? | `level.arrival` (by grandma's armchair in the cellar; at the way up below); `level.spawn()` for a hall near a point | `src/gen/level.ts` |
| Where exactly is the rock surface under a point (where props stand)? | `level.groundAt(x, z)` | `src/gen/level.ts` |
| Which way does the rock face here? | `level.normal(x, y, z, out)` | `src/gen/level.ts` |
| How far until a ray hits rock? | `level.trace(...)` | `src/gen/level.ts` |
| Is there water here, how high does it stand? | `level.waterAt(x, z)` (water wherever the ground is lower) | `src/gen/level.ts` |
| Border distance, pillars, rubble at a column | `level.columnAt(x, z)` | `src/gen/level.ts` |
| A quarry working's pillar grid: grid coordinates, which pillars stand, which stand on an older drum (`col.olderTop`, `OLDER`, `band.older`) | `field.toGrid`, `field.fromGrid`, `field.pillarAt` | `src/gen/quarry.ts` |
| What the miners left in a tile (rails, carts, lamps, shacks, things left against the rock, derricks, loose stones; in the Salt Works statues, chapels and hanging lamps; in the Threshold's caverns ruins (`band.ruins`); in the Cisterns water running up the rock (`band.uphill`, the `flow` mesh); in the Quarry chalk numbers counting down to the nearest way down (`band.chalk`); as much as `level.band` asks for), and its standing water | `quarryProps(level, tx, tz)` | `src/gen/quarryProps.ts` |
| A point in a prop's own frame (across, ahead) in world x, z | `local(x, z, yaw)` | `src/gen/propMesh.ts` |
| Where a human's feet find the floor (foot IK) | `floorUnder(() => level)` | `src/render/humans/nobody.ts` |
| Carve a salt miner (statues, and the watchers' figures) | `carveMiner(builder, x, top, z, yaw, pose, colour)` | `src/gen/quarryProps.ts` |
| Draw the watcher statues (turn to you while unseen) | `Watchers` (`draw(props.watcherLists, x, z, camera, dt)`, in `LevelView.frame`); the tiles list them in `PropTile.watchers` | `src/render/props/watchers.ts` |
| A prop made in Blender (crate, barrel, bucket, pick, shovel, cut stone), placed into a tile | `propModel(name)` then `PropBuilder.stamp(m, x, y, z, yaw, { lean, scale, tint })`; models are AssetGenerator specs listed in `tools/props/models.json`, packed by `npm run props` (Blender: `BLENDER_PYTHON` with pip's bpy) into the generated `src/gen/models.pack.ts` | `src/gen/models.ts`, `src/gen/propMesh.ts` |
| Build merged box geometry for props | `PropBuilder` (`box`, `upright`, `beam`, `ellipsoid` for smooth round parts, `cylinder` for barrels and buckets, `tube` for pipes and rims between any two points, `ribbon` for a strip between two polylines) | `src/gen/propMesh.ts` |
| One thing per grid cell (shafts, rat nests), decided once per cell | `CellMemo` (`at(i, j)`) | `src/gen/cellMemo.ts` |
| Where are the ways down (shafts), which is nearest, where is its ladder? | `level.descents` (`of`, `at`, `nearest`, `within`), `ladderTop(shaft)`; the field already contains them | `src/gen/descents.ts` |
| Where does a player arrive on a level? | `level.arrival` (below the first level: the foot of `level.ascent`, the way up) | `src/gen/level.ts` |
| Where are a ladder's rungs, which way is its wall, where does one get on and off? | `ladderOf(shaft)` (a `Ladder`; `RUNG` spacing) | `src/gen/descents.ts` |
| Sample the field on a grid fast | `level.sampleGrid` (one column pass per x, z) | `src/gen/level.ts` |
| Turn a grid of distances into a mesh | `surfaceNets` | `src/gen/surfaceNets.ts` |
| Mesh one chunk of a level | `meshChunk` (skips chunks far from any surface: `farFromSurface`, a sample per octant) | `src/gen/chunkMesh.ts` |
| Which chunks, at which detail, around a viewer? | `chunksAround` (octree; marks sides next to coarser chunks) | `src/world/chunks.ts` |
| Run work off the main thread | `WorkerPool` / `createMeshPool` / `createPropsPool` (guarded: `new Worker` only there) | `src/workers/pool.ts` |
| Write a worker script | `serve(handle)` and `levelFor(seed, depth)` | `src/workers/serve.ts` |

### The world (planned)

| Question | The one way | Where |
|---|---|---|
| Where is the ceiling above a point? | `world.ceilingAt` | `src/world/query/` |
| Can A see B? Can A shoot B? | `world.sight(a, b)` (rock, darkness and objects) | `src/world/query/` |
| How lit is this point? | `world.light(x, y, z)` | `src/world/query/` |
| Move a body on the rock: walk, climb, swim, fall | `Body.step(level, input, dt, blockers)` and its metrics `MOVE` (the reachability check will use the same); which walls can be climbed: `level.climbable` (the field's `climbable`: all rock, not built walls); the top of a climb: `Body.ledge` (held until `overLedge()`, which the game calls once the pull-up has played) | `src/world/traverse/body.ts` |
| Doors that open and shut (where they hang; swinging them, blocking while shut; drawing them) | `HOUSE_DOORS` / `DoorSpec`, `level.doors`; `Doors` (`near`, `toggle`, `step`, `into` the Blockers under `DOORS_KEY`); `DoorView` (`hang`, `draw`) | `src/gen/doorways.ts`, `src/world/doors.ts`, `src/render/props/doorView.ts` |
| Is a prop in the way? Push out of the props | `Blockers` (`pushOut`, `hits`); the generator lists each tile's boxes (`PropTile.blockers`), `Props` keeps them (`view.props.blockers`) | `src/world/blockers.ts` |
| A persisted change to the world | `persist.mark(chunk, change)` (guarded: `localStorage` only in `src/persist/`) | `src/persist/` |
| Keep the game between visits (the family's tin, heirs and finds taken; the living grandchild) | `readSave(seed)`, `writeSave(seed, data)`; each kept thing gives its `data` and takes it back with `from` (`Tin`, `Cooked`, `Practice`, `Explored`) | `src/persist/save.ts` |

### Gameplay

| Question | The one way | Where |
|---|---|---|
| Does a creature notice the nobody? (closer when it tiptoes: `Fighter.hush`, `Body.tiptoe`) | `noticed(prey, d, notice)`; never compare against a `notice` range directly | `src/combat/combat.ts` |
| Does a guard (grandma's pot lid) stop part of a blow? | `Fighter.shield(fromX, fromZ)`, asked by `damage` (`Body.shield` with `Body.lid`, `Body.guarding`); never scale damage at the attacker | `src/combat/combat.ts`, `src/world/traverse/body.ts` |
| Does a blow, blast or effect reach someone? Who does it hit? | `reach(blow, fighter)`, `nearestReached(blow, fighters)` then `damage(...)`; never write health elsewhere. Anyone hittable is a `Fighter` | `src/combat/combat.ts` |
| Rats: nests, waking, chasing, biting | `Rats` (a `Population`: `advance(dt, prey)`, `list`, `denAt`) and its numbers `RAT` | `src/creatures/rats.ts` |
| Place a drawn creature's figure (at its feet, turned, scaled) | `placeFigure(root, creature)` | `src/render/creatures/figures.ts` |
| Draw the rats | `RatView` (a `FigurePool` added once with the Stage; `draw(rats, time)`) | `src/render/creatures/ratView.ts` |
| Walk a creature over the floor: steer to a goal round what is in the way, arrive without overshooting (no jitter), keep out of its prey's legs | `Steer` (`move`, `close` to close in on someone, `slide`, `walkable`) with the kind's `Gait` (`probe`: how high it looks for a wall) | `src/creatures/steer.ts` |
| The Salt-Touched: where they work, noticing, chasing, the pick blow | `SaltTouched` (a `Population`: `advance(dt, prey)`, `list`, `denAt`) and its numbers `TOUCHED`; how many per band: `band.touched` | `src/creatures/touched.ts` |
| Draw the Salt-Touched | `TouchedView` (a `HumanPool` built before the warm-up: `figures` go to `view.start`; `draw(list, x, z, dt, time)`) | `src/render/creatures/touchedView.ts` |
| Cave crickets: perches on the rock, leaps, bites, scattering from the headlamp | `Crickets` (a `Population`: `advance(dt, prey, lamp)`, `list`, `denAt`), numbers `CRICKET`, how many per band `band.crickets` | `src/creatures/crickets.ts` |
| Draw the cave crickets | `CricketView` (a `FigurePool` added once with the Stage; `draw(crickets, time)`) | `src/render/creatures/cricketView.ts` |
| Slimes: Lumen and Murk colonies, their war, pulses, the squash-and-throw blow | `Slimes` (a `Population` per faction: `advance(dt, prey, otherFaction.list)`), numbers `SLIME`; a hurt creature's `cause` says who hurt it | `src/creatures/slimes.ts` |
| Draw the slimes | `SlimeView` (`lumen` and `murk` `FigurePool`s added once with the Stage) | `src/render/creatures/slimeView.ts` |
| Feral dogs: packs that circle you and lunge from behind one at a time | `Dogs` (a `Population`: `advance(dt, prey, facing)`), numbers `DOG`; how many per band: `band.dogs` | `src/creatures/dogs.ts` |
| Draw the feral dogs | `DogView` (a `FigurePool` added once with the Stage; `draw(dogs, time)`) | `src/render/creatures/dogView.ts` |
| Brine eels: swimming the deep and wading water (never out of it), the wake, rearing up, the strike; the body chain | `Eels` (a `Population`: `advance(dt, prey)`), numbers `EEL`, per band `band.eels`; `Eel.chain` for the view | `src/creatures/eels.ts` |
| Draw the brine eels | `EelView` (a `FigurePool`; the rigged body's bones laid along `Eel.chain`, the head on clips) | `src/render/creatures/eelView.ts` |
| The fungal grotto's mushroom monsters: toadstools that hide as mushrooms, get up on their roots and slam; rooted puffcaps that lob spores | `Toadstools`, `Puffcaps` (each a `Population` of patches on the grotto's own ground: `advance(dt, prey)`), numbers `TOADSTOOL`, `PUFFCAP`; `Puffcaps.spores` | `src/creatures/shrooms.ts` |
| Spores lobbed at you and the clouds they burst into (burning while you stand in them) | `Spores` (`lob`, `advance(dt, prey)`, `balls`, `clouds`), numbers `SPORES` | `src/creatures/spores.ts` |
| Draw the mushroom monsters and their spores | `ShroomView` (two `FigurePool`s, `spores.draw(spores, time)`) | `src/render/creatures/shroomView.ts` |
| Scavengers: camps round a fire, wary camps that warn you off, robbers, the crowbar, running when badly hurt; what they call out | `Scavengers` (a `Population`: `advance(dt, prey)`, `said`/`calls`), numbers `SCAVENGER`, per band `band.scavengers` (from level 4) | `src/creatures/scavengers.ts` |
| Draw the scavengers and their camps | `ScavengerView` (`people`: a `HumanPool`; `camps`: a `FigurePool` of fires and crates) | `src/render/creatures/scavengerView.ts` |
| The Tall One (level 10 boss): its lair, stalking round grandma's salt circles, the stare, the reach, waiting at a circle's edge | `TallOnes` (a `Population`: `advance(dt, prey)`, `stares`), numbers `TALL` | `src/creatures/tallOne.ts` |
| Draw the Tall One | `TallOneView` (a `HumanPool` of one gaunt human in a shroud) | `src/render/creatures/tallOneView.ts` |
| The Tall One's lair and grandma's salt circles (level 10), whether a spot is in one | `level.lair` (`lairOf(level)`, numbers `LAIR`), `inCircle(circles, x, z)`; the circles' props are built with their tiles in `quarryProps` | `src/gen/lair.ts` |
| Find a landmark's place out from the arrival (caverns first), and check the floor round a spot is open | `searchOut(level, turn, near, far, step, found)`, `openFloor(level, points, g, slope, head, room)` | `src/gen/searchOut.ts` |
| The nobody's rest fire: lighting it (where, when not), resting by it (healing, breath), burning down | `Campfire` (`whyNot`, `light`, `step`, `kindling`, `burning`, `left`), numbers `FIRE` | `src/world/fire.ts` |
| Draw a small fire on the floor (stones, ash, flickering flames that die down) | `Hearth` (`hearthParts()` once, then `new Hearth(parts)`, `flicker(time, burn)`) | `src/render/props/hearth.ts` |
| Grandma's first camp (level 9): where it is, what her note says | `level.camp` (`grandmasCamp(level)`, numbers `CAMP`, the note `NOTE`); its props are built with its tile in `quarryProps` | `src/gen/grandmasCamp.ts` |
| Draw a pool of humans after a list (the nearest; each keeps its human while near; flinch on a blow) | `HumanPool` (`draw(list, x, z, dt, time)`, `figures` for the warm-up) and `humans(n, look, clothes)` to build them | `src/render/creatures/humanPool.ts` |
| The Foreman (level 5 boss): his hall in a cathedral, the bell that calls the Salt-Touched, his salt crust (front blows glance off) | `Foreman` (a `Population` with one hall: `advance(dt, prey, touched)`, `hall`), numbers `FOREMAN`; the bell's call: `SaltTouched.call(x, z, r)`; his crew: `SaltTouched.gather` | `src/creatures/foreman.ts` |
| Draw the Foreman and his bell | `ForemanView` (one human built tall, added once with the Stage; `draw(boss, hall, dt, time)`) | `src/render/creatures/foremanView.ts` |
| Everything living on a level, together: made, stepped, the foes a blow can hit, whether something is after you, the HUD tally | `Fauna` (`advance(dt, prey, lamp)`, `foes()`, `after(prey)`, `tally()`, `bossLine(prey)`) | `src/creatures/fauna.ts` |
| The pick blow over the head (wind-up, commit, land), and closing in to swing it | `pickSwing(w, t, S, prey, aim, steer, rng, cause, dt)` and `closeIn(w, swingT, prey, S, speed, steer, dt, face)` with a `PickSwing` | `src/creatures/pick.ts` |
| A blow struck by someone standing somewhere | `blowFrom(at, yaw, swing)` | `src/combat/combat.ts` |
| What every creature is (health, hurt, death, `provoked`) | `Creature`; `groundSpeed(v)` | `src/creatures/creature.ts` |
| A kind of creature on a level: dens per cell, waking near you, sleeping far off, the dead staying dead, stepping | `Population` (subclass: `denIn`, `hatch`, `act`, using `sites`, `floorFor`, `countIn`, `around`, `brood` to hatch a den, `roamFrom` to wander, `lieDead` for the step of the dead, `apart`, and `placed` for dens off the grid; it ticks every creature's `hurtT`/`deadT`; callers: `advance(dt, prey, ctx)`, `list`, `denAt`, `nearestDen`, `killed`, `blockers`) | `src/creatures/population.ts` |
| Draw a pool of creature figures | `FigurePool` (a `Figure` per creature: `root`, `pose`; `draw(list, time, from)` draws the nearest when there are more than it holds) | `src/render/creatures/figures.ts` |
| Slow a walker down | `brake(w, rate, dt)` | `src/creatures/steer.ts` |
| What lies about to be found (floor finds, rat hoards), what is in reach, what is taken | `Finds` (`near`, `inReach`, `take`), kinds and values in `FINDS` | `src/loot/finds.ts` |
| What the nobody carries up | `Pack` (`items`, `worth`) | `src/loot/finds.ts` |
| Infused salt in grandma's tin: what a first is worth, and less for the next ones | `Tin` (`killed(kind)`, `reached(depth)`, `camp(depth)` → a `Gain` or null), numbers in `SALT`, the falling-off in `pinches(k, base)` | `src/loot/tin.ts` |
| Which creatures you killed since last asked, and where they fell | `fauna.fallen()` (kind = the population's `name`; each `Population` keeps its `fallen`) | `src/creatures/fauna.ts` |
| Show salt drifting from where it formed into the nobody | `SaltDrift` (`burst(x, y, z, amount, now)`, `stream(now, tx, ty, tz)`) | `src/render/loot/saltDrift.ts` |
| The nobody rolls out of the way (grandma's Duck card); blows miss a fighter while it evades | `body.roll(dx, dz, stamina, safe)`, `body.rolling`, `body.evading`; `Fighter.evading`, checked in `damage()` | `src/world/traverse/body.ts`, `src/combat/combat.ts` |
| Throw a knife (grandma's Second Helpings) or toss a Sunday candle: flight, whom a knife hits, where things land, which candles burn | `Thrown` (`throw(x, y, z, yaw, foes)`, `toss(x, y, z, yaw)`, `fly(level, foes, rng, dt)`, `missiles`, `candles`), numbers `THROW`, `CANDLE`; drawn by `ThrownView` (`arrange`; grandma's knife from `kitchenKnife()`) | `src/combat/thrown.ts`, `src/render/humans/thrownView.ts` |
| Lights the things of the dark keep away from (Sunday candles) | `fauna.glare = …` (rats and crickets); a kind asks `this.glaring(c, shun)` (`Population`); the light itself: `props.loose` (x, y, z each) | `src/creatures/population.ts`, `src/render/props/Props.ts` |
| Salt the creatures will not cross (grandma's Salt Line, poured; her circles round the Tall One's lair) | `SaltLine` (`whyNot`, `pour`, `pouring`, `keeping(now)`, `shown`), `fauna.salt = …` → `Steer.salt` (no step further in; a kind opts out with `heedsSalt = false`); drawn by `SaltLineView` | `src/world/saltLine.ts`, `src/creatures/steer.ts`, `src/render/props/saltLine.ts` |
| Grandma's recipe cards: what each is and costs, what a grandchild has cooked, and what that does to the numbers (knife, resting, climbing) | `CARDS` (a card's depth gate `opens`), `CHAPTERS`, `card(id)`; `Cooked` (`rank`, `costOf`, `cantCook`, `cook`, lost cards `has`/`find`, and the effects `knife`, `helpings`, `duck`, `candles`, `soup`, `climbing`) | `src/loot/recipes.ts` |
| Practice: what a grandchild got better at by doing it, and what that does to the numbers | `Practice` (`use(skill, n)`, `tier`, `more`, `less`), `SKILLS`, `TIERS` | `src/loot/practice.ts` |
| Show the tin open by the fire | `TinView` (`show(cooked, tin, sel, why)`, `hide`, `TinView.order()`) | `src/app/tinView.ts` |
| Remember what a grandchild has seen of each level (exploration memory) | `Explored` (`see(level, x, y, z)`, `has(depth, i, j)`, `cells`, `data`/`from`), `EXPLORE` | `src/world/explored.ts` |
| A DOM panel of the game (its stylesheet and element) | `panel(host, tag, id, css)`, `addStyle(css)` | `src/app/panel.ts` |
| Show the map of what was seen (M) | `MapView` (`toggle`, `draw(level, explored, x, y, z, yaw, fire, now)`); a style's floor colour there is `Style.mapFloor` (default `MAP_FLOOR`) | `src/app/mapView.ts` |
| Draw the finds | `FindView` (pools per kind added once with the Stage; `draw(finds, time)`) | `src/render/loot/findView.ts` |
| Stab with the knife | `STAB` and `stab()` in the game loop (soft aim at the nearest rat ahead) | `src/game/Game.ts` |
| The debug menu (`): every ability, invulnerable (`Body.invulnerable`), tireless, any level; the places worth checking out on a level and where to stand by each | `DebugMenu` (`toggle`, `refresh`, with the game's `DebugActions`); `placesOn(level, fauna, x, z)` | `src/app/debugMenu.ts`, `src/game/debugPlaces.ts` |

### Sound and music

| Question | The one way | Where |
|---|---|---|
| Play a sound: one-shot (placed or on the nobody), a positioned loop, ambience beds; volume, mute, music switch (kept through `src/persist/settings.ts`) | `SoundEngine` (`play(id, at, gain, pitch)`, `loop`, `ambience`, `set`); clips in `public/sounds/manifest.json` | `src/audio/audio.ts` |
| Which sounds the world makes (footsteps, landings, hurt, creatures' modes, doors, the fire, the bell) and which ambience and music | `GameSounds.update(scene)` once a frame; the game's own events through `sounds.play(id, at)`; a creature kind's voice in `VOICES` | `src/audio/gameSounds.ts` |
| Where one is, for sound (town, cellar, a band) | `GameSounds.place(level, pos)` | `src/audio/gameSounds.ts` |
| Which music plays when | `MoodDirector` (pure; moods, episodes, danger hold), pieces per mood `MOOD_TRACKS`, played by `Music` / `TrackPlayer` | `src/audio/music/` |
| Make or change a sound effect or a piece of music | edit its prompt in `tools/audio/sounds.json` / `music.json`, then `tools/audio/sfx.py gen, screen, build` / `music.py gen, build` | `tools/audio/` |

### The Lab

| Question | The one way | Where |
|---|---|---|
| Read seed, depth, position, look, colour mode and backend from the URL | `parseViewParams` | `src/app/params.ts` |
| The version and its history (What's new) | `parseChangelog` (CHANGELOG.md), shown by `mountWhatsNew` | `src/app/changelog.ts`, `src/app/whatsNew.ts` |
| Held keys, presses this frame (`tap`; unasked presses are dropped by `endFrame`), mouse look, wheel | `Controls` | `src/input/controls.ts` |
| Fly around | `FlyCamera` | `src/lab/FlyCamera.ts` |

## Layers

Import rules, enforced by `npm test` (`tools/guards/rules.json`):

- `src/gen` (the generator) is pure data: no three.js, no render, no Lab, no world facade. It runs in workers and headless tests.
- `src/world` (queries) is pure: no three.js, no render, no Lab.
- `src/render` does not know about the Lab.
- `src/audio` does not know three.js, the renderer, the Lab or the game: the game hands it plain numbers each frame.

## Shared code

`@futuremagic/*` packages live in AssetGenerator (`vendor/assetgenerator/packages/`, a git submodule) and are installed as `file:` dependencies. Code there must not be re-implemented here; the duplication ratchet scans both. Move code into a package when a second project needs it ([docs/design/shared-package.md](design/shared-package.md)).
