# Dunfinity: level generator deep dive

Status: **draft 2, core decisions made, no code.** Part of [dunfinity-plan.md](dunfinity-plan.md) (gaps G1–G4).

Arnd's brief: *think big; small rooms are the exception; room grammars cause assumptions.*

---

## 1. The shift: a level is a landscape, not a floor plan

Room grammars (rooms + corridors, or Scale's named "Great Hall / Throat / Warrens") start from *gameplay shapes* and then dress them as caves. That bakes in assumptions: spaces have a size class, a door, a purpose. The result reads as "a dungeon", however you dress it.

The alternative is to build a level **the way the underground actually forms**, then let people (and monsters) move in, and only then check whether it plays:

> **Geology first. Water second. Inhabitants third. Gameplay pass last.**

Every layer is a deterministic function of `(seed, depth, x, z)` that can be evaluated anywhere, so the level is infinite with no global layout step. There are no rooms anywhere in the model; small spaces only appear where something *made* them (a tomb, a mine, a vault) or where geology pinches (a crawlway). That makes them the exception automatically.

Precedent we already own: Xenoworld's underworld is a continent-wide hollow defined by a floor and a ceiling per column (`uF`/`uC` in `Terrain.ts`), with pillars and sinkholes on top. Norgo's underworld is similar. This design generalises that idea and makes it the whole game.

---

## 2. Scale targets

Proposed, to be argued with:

| | Typical | Range |
|---|---|---|
| Major cavern span | 300–800 m | 100 m – 3 km |
| Void height (floor to ceiling) | 40–120 m | 3 m (crawl) – 400 m |
| Distance between "landmarks" | ~300 m | |
| Share of the walkable area that is narrow (< 6 m wide) | ~10 % | dial per stratum |
| One level, as experienced by a player before descending | 1–3 km² | unbounded |

For comparison, real caves of this size exist: Son Doong's main passage is ~200 m tall and 150 m wide, and Sarawak Chamber is ~600 × 400 m. Real underground spaces made by people are huge too: the Wieliczka salt mine and Turda salt mine have cathedral-sized chambers, and Tokyo's G-Cans flood cistern is a 177 m hall of 18 m pillars.

---

## 3. The four layers

### Layer 1: Geology (the void field)

**Base: the hollow.** Like Xenoworld, each level has a **floor** height `F(x,z)` and a **ceiling** height `C(x,z)`. The void exists where `C > F`. These two fields alone already give vast caverns (where `C − F` is large), walls and pillars (where it goes to zero), varying heights, slopes and terraces (with terracing applied to `F`), and natural ledges and cliffs.

**Then 3D terms** carve and add, because a pure floor/ceiling model has no overhangs or multiple storeys:

- overhangs and undercuts along walls
- natural bridges and arches (rock left standing across the void)
- side galleries one storey up, with ledges as their floors
- shafts and chimneys
- hanging rock (stalactite curtains), floor spikes, fallen blocks

**Formation processes, not biomes.** A low-frequency *process field* (km scale, soft blends) decides what formed each area, and each process has its own SDF signature:

| Process | What it makes | Feels like |
|---|---|---|
| **Dissolution** (karst) | Smooth tubes, scalloped walls, sumps, sinkholes, big domed chambers | Classic limestone cave |
| **Rift** (tectonic) | Very tall, narrow, km-long canyons; ledges along both walls; chockstones | Vertical, dizzying |
| **Collapse** | Huge chambers with breakdown rubble piles, broken ceilings | Chaotic, hilly floor |
| **Lava tube** | Long round tunnels, skylights into the level above, glassy floors | Fast travel, red light |
| **Geode / crystal** | Hollow shells lined with crystals, glowing | Wonder |
| **Organic** (later strata) | Ribbed, fleshy, root- or fungus-carved spaces | Alien |
| **Excavation** (made by people) | Quarry halls, salt-mine cathedrals, cisterns, mine levels | Strata 1–20 |

The biomes come *out of* this: crystal light where geodes are, fungus where it is wet and dark, lava where tubes run hot. The stratum genome only weights the processes and colours the result.

**Connectivity in an infinite world.** We can't check the whole level, so we guarantee it structurally. A sparse **backbone network** (jittered points on a ~1 km grid, joined as a relative-neighbourhood graph) is forced into the void field. Rifts, tubes, river valleys or broad passages run along it, never corridors. Everything else may dead-end, which is fine and realistic.

### Layer 2: Water

Water is the oldest sculptor and the best pathfinder:

- **Rivers** follow the floor field downhill and carve a valley into it. They are natural routes, and you can follow one.
- **Lakes and flooded zones** fill basins. These are swimmable, sometimes underwater passages.
- **Waterfalls** where a river leaves a ledge. **Drips and pools** everywhere wet.

Start static (computed levels, scripted falls). Xenoworld's flowing-water automaton is available later if we want water you can redirect.

### Layer 3: Inhabitants (history)

People and creatures settle the landscape *with reasons*, so structures sit where they make sense:

- **Settlements** on flat terraces near water, at defensible spots, or carved into cliff walls (cliff dwellings, Petra-style facades).
- **Roads** between settlements, following the easiest terrain. Where a road meets an obstacle, the builders solved it: **bridges** over rifts, **stairs** cut up cliffs, **ladders and chains**, **tunnels** through thin walls.
- **Fortifications** at chokepoints of the backbone.
- **Made small spaces, which are the rare ones:** tombs, vaults, cellars, mine galleries, shrines, prisons. These are the "smaller rectangular areas" from the brief, and they appear because someone built them.
- **Ruins layered by era** (depth is time): a stratum's own culture is intact; older cultures from below poke through as ruins.

**The neat trick:** connectivity repairs are diegetic. When the gameplay pass (layer 4) finds a gap the player can't cross, it doesn't spawn a random ramp. It asks layer 3 to build what the locals would have built there: a rope bridge, a stair, a ladder. Repairs look like history.

### Layer 4: Gameplay pass

- **Traversability:** walkable surfaces (slope), climbable surfaces (see 4.1), jump gaps, drops, swim.
- **Reachability check and repair** along the backbone and to every placed point of interest, using the player's real movement metrics.
- **Descents:** sinkholes, shafts, ancient stairwells, mine lifts. Their density rises with distance from where you arrived (Territories).
- **Points of interest:** loot, encounters, lost recipe cards, landmarks. Placement is driven by the Director (Norgo) and the genome.
- **Navigation data** for monsters, from the same analysis.

---

## 4. Consequences and proposals

### 4.1 Climbing: free climbing everywhere, with stamina (my pick)

Tomb Raider marks climbable ledges. In a generated SDF landscape, marking ledges is a whole extra generator that has to be "right" everywhere. The alternative is **Breath of the Wild style**: any rock is climbable, with speed and stamina cost set by steepness and roughness. Overhangs and wet or crystal surfaces can't be climbed.

Why it fits:
- Reachability becomes simple: *can I get there within one stamina bar of climbing?* No per-ledge bookkeeping.
- Big vertical spaces become playable instead of decorative.
- The inhabitants' ladders and stairs still matter as stamina-free routes.
- Recipes get an obvious branch: climbing stamina, grip on wet rock, climbing tools.

The cost is that cave walls must look climbable (grip texture, ledges from the 3D terms), and monsters that climb are needed so walls aren't a free escape.

### 4.2 Strata 1–10 must think big too

My draft-2 table put "cellars, sewers, bunkers" at levels 1–10. That contradicts the brief: those are corridor spaces. Fix: below grandma's cellar, the first strata are **made by people and huge**. An abandoned limestone quarry under the town (like Paris's quarries), a salt mine with cathedral chambers and carved altars (Wieliczka), a forgotten storm-water cistern of endless pillars (G-Cans), and old mine levels with lift shafts. Corridors exist only as the short connective bits between them. This keeps the modern-world flavour and the big scale from the first descent.

### 4.3 Big spaces need light to read as big

A 500 m cavern in total darkness is just a black screen. Each process brings its own **light sources**: glowing water, crystal, fungus, lava, skylights from lava tubes, the inhabitants' fires and lamps. Distant lights give scale and act as **landmarks** ("walk towards the green glow"). The player also gets thrown light (flares, a lantern) as a recipe and an item. Darkness also serves as our LOD fog for performance.

### 4.4 Rendering and streaming

- Surface nets over an **octree LOD** in workers, as in Norgo and Xenoworld. Both already stream km-scale SDF worlds, Norgo on iPad.
- One SDF function is the single truth for meshing, collision, monster footing, raycasts and prop placement (Xenoworld's rule).
- Persistent changes (D14) are stored per chunk as diffs. Changes to the terrain itself (if we allow digging or blasting) are CSG edits, as in Xenoworld's `Edits`.

### 4.5 Monster navigation (the hard part)

Big multi-storey caves defeat simple 2D grids. Proposal:
- **Navmesh tiles per chunk**, built in a worker from the chunk's mesh with a Recast-style voxelisation (there is a maintained WASM port, `recast-navigation-js`), plus **off-mesh links** for jumps, drops and the inhabitants' ladders.
- **Climbers and flyers** don't use the navmesh. They steer directly through the SDF (it answers "how far to rock?" everywhere).
- **Coarse graph** for long distances: the backbone network plus settlement roads.

### 4.6 Big spaces change combat

In a 500 m cavern you can be seen, and shot, from far away. That's good (tension, ranged enemies, flyers, sniping from ledges), but it also means:
- Enemy awareness needs line of sight *and* light. Being in darkness is stealth.
- Engagements need cover, which the generator supplies via rubble, pillars and ruins. The gameplay pass should check that open floors have some.
- Hordes can come from many directions. The Director should shape this.

---

## 5. How a level comes together (pipeline per chunk)

1. **Genome** for this depth (stratum, process weights, palette, inhabitants, rule).
2. **Macro fields** (cached per ~1 km cell): process field, backbone network, rivers, settlements and roads.
3. **Void SDF:** floor/ceiling + process terms + backbone carving + water carving + inhabitant structures as CSG (cut stairs, cliff dwellings, tunnels).
4. **Mesh** (worker, LOD) and **props** (scatter: rubble, fungus, crystals, stalagmites; structures: buildings, bridges).
5. **Analysis** (worker, near chunks only): walk/climb surfaces, reachability along the backbone and to POIs, navmesh tile.
6. **Repair** by asking layer 3 for a diegetic fix, then remesh that spot.
7. **Population and loot**, placed by the Director and genome, and filtered by the persistence diffs.

---

## 6. Prove it before building the game: the Level Lab

The first thing to build (when Arnd says go) is not the game but a **free-fly viewer** for the generator: seed + depth in the URL, a fly camera, a toggle for each layer, overlays for process field, backbone, settlements and the reachability graph. Norgo (`?viewer`) and Xenoworld both have one. Iterating on "does this feel vast and varied" without combat in the way is far faster. Only once a level looks great do we walk it with the nobody.

---

## 7. Decisions (Arnd, 2026-10-14)

| # | Decision | Consequence |
|---|---|---|
| L1 | **Free climbing on any rock, with stamina.** | Reachability = "within one stamina bar"; climbing monsters needed; climbing branch in the recipe box |
| L2 | **Strata 1–10 are huge human-made spaces** (quarry, salt mine, cistern, mines), **getting stranger deeper.** | Excavation process dominates early; the genome shifts the process weights towards the natural, then the alien, with depth |
| L3 | **Scale as proposed, plus smaller spaces where they make sense:** carved-out rooms, and even sheds or houses standing inside caverns. | Layer 3 places buildings as free-standing meshes inside caverns, with enterable interiors (Scale's interior splitter for the inside) |
| L4 | **Rock is permanent: no digging or blasting.** | No CSG edit system; meshes, collision and navmesh tiles can be cached per chunk; persistence diffs only hold entities and objects. Default I'm assuming: wooden things (doors, crates, sheds, bridges) can still break, rock never |
