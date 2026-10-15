# Dunfinity: plan and gap analysis

Living document. Status: **draft 2, open for discussion, no code yet.**
Sources checked (main, 2026-10-14): `ArndRosemeier/Scale`, `Norgo`, `AssetGenerator`, `World` (Xenoworld). The `Dunfinity` repo exists and is empty.

---

## 1. The pitch

A procedural roguelike dungeon crawler in the browser (TypeScript, three.js). Each level stretches forever sideways and there is always a level below; depth is difficulty. You start as a nobody with a kitchen knife.

**The hook (decided):** a small town at street level. Your grandmother has died in her house; nobody visited her for thirty years. In the cellar there is an old wall, and behind it a strange small room. Behind that, the dungeon. You go down with what was in her kitchen.

---

## 2. Decisions so far

| # | Decision | Notes |
|---|---|---|
| D1 | **Humans use Scale's model** (the prettier Woman/Man bodies). Races come from the Norgo work. | See 3.1: the races already run on the pretty bodies, so elves etc. are close to free |
| D2 | **Game modes:** default = Territories + permadeath. "Hunted" (Heat) is a difficulty option. A casual mode with save/load. | No supply/light clock: rejected as micromanagement |
| D3 | **Street-level start** in a small town; grandma's house and cellar are the entrance. | |
| D4 | **One entrance only.** A mid-tier **Recall** skill teleports to the strange room in the cellar and back to where you left. | |
| D5 | **Shared package lives in AssetGenerator**, brought up to date. Parts tied to the own 3D engine are not used and will be retired. | See 3.2 for how |
| D6 | **The deep gets stranger algorithmically**, in the spirit of Norgo and Xenoworld, rather than through hand-designed content. | See 4.4 |
| D7 | **Skill buying**, not random skill finds, explained in-world by an item found at the very start (like Scale's karma). | See 4.2 |
| D8 | **Level geometry like Tomb Raider:** varying height, biomes, ledges, buildings, vast caverns, and also smaller rectangular areas. Not uniform or grid-like. | See 4.3 |
| D9 | **Third-person camera by default**, with zoom-in to first person always available. | Norgo already does wheel-zoom to first person |
| D10 | **Real-time** action. | |
| D11 | **Pure permadeath: nothing carries over.** Grandma's kitchen has an endless supply of kitchen knives, so every new nobody takes the next one from the block. | Knife notches and the revenant self are dropped as meta-progression; a dead nobody's corpse and gear may still lie in the dungeon if the world seed persists (open) |
| D13 | **Same dungeon across runs.** "New game" is the only way to get a fresh seed. A dead nobody's gear lies on the corpse at first, then vanishes over time: the deep denizens loot it. | Proposal: looters actually carry and use what they took, so the goblin swinging your old axe is the way to get it back. Needs per-level persistent state (diffs, Norgo save pattern) |
| D14 | **Persistence across runs:** opened chests, taken uniques and killed bosses stay done; ordinary monsters slowly repopulate; the map is forgotten, but old chalk marks remain. Since levels are endless sideways, a new nobody can always find fresh things before going deeper. | Save holds diffs for touched chunks only; old, far diffs for ordinary things decay (which *is* the repopulation), so saves don't grow without bound |
| D17 | **Level generator** decisions L1–L4 (free climbing with stamina; big human-made strata 1–10 getting stranger; big scale with carved rooms and houses inside caverns; permanent rock) | See [level-generator.md](level-generator.md) section 7 |
| D18 | **Recipe box details** R1–R7: cooking at fires, **infused salt** as currency, practice gates, chapters open with depth, generated lost cards, and a tongue-in-cheek voice | See [recipe-box.md](recipe-box.md) |
| D19 | **Town and levels 1–10:** story spine (1947 accident, grandma's father, the tall one); each nobody is another grandchild (weary notary); euros for mundane gear in town, infused salt for recipes, never mixing; bands Quarry / Salt Works / Cisterns / Threshold | See [town-and-first-strata.md](town-and-first-strata.md) |
| D12 | **Recipe box.** Core recipes are bought with one generic currency (essence, earned by variety); optional "lost cards" for hidden branches are found deterministically per stratum. | See 4.2 |
| D15 | **Desktop and iPad.** | Touch controls for third-person action and climbing (Norgo `touch.ts` as base); iPad memory budgets (Norgo `core/budgets.ts`); lazy-load audio per stratum; WebGL2 baseline, WebGPU where available |
| D16 | **Single-player.** | Keep the sim in a worker for performance, but drop strict server authority and the net protocol: simpler code |

---

## 3. Corrections and pushback (round 2)

### 3.1 The pretty model and the races are not separate things (good news)

I looked at how Scale builds its prettier bodies. `tools/avatar/base-bodies/conform.py` fits the MakeHuman mesh onto the Woman (and the Man made from her). It stores the result as **per-vertex offsets on MakeHuman's topology** in `conform.bin`, together with the Woman rig's skin weights folded into MakeHuman's bones. At runtime the offsets are added after the macro morph. In the script's own words: *"so age, weight, muscle, height, races, clothes, LODs and expressions keep working on the same topology."*

So the pretty body is a layer *on top of* the MakeHuman shape system, not a replacement for it:

- **Every Norgo race already renders on the pretty bodies** (Scale's `races.ts` holds all ten). That includes elves.
- **The animations are compatible:** it is the same skeleton, and the weights come from the Woman rig.
- **What remains is tuning, not porting.** Race face targets (`chin-prognathism-incr` etc.) were tuned against MakeHuman's face, so some races may look off on the new face. Expect a visual pass per race, not new tech.

(Side note: AssetGenerator holds a *third* human route, the MPFB export plus Godot Character Studio. I'd treat Scale's as canonical and leave that one alone.)

### 3.2 AssetGenerator as the shared home: yes, but it needs a TypeScript half

Today AssetGenerator is a **Python + headless Blender** pipeline, a **Rust** viewer built on your engine, and a **Godot** studio. It has no TypeScript or npm. The shared *runtime* code Dunfinity needs (humanoid, rng, abilities, items) is TypeScript, so it needs somewhere to live inside that repo.

Proposal:

- `AssetGenerator/pipeline/`: the offline side, which it is already good at. Blender specs, and also Scale's `conform.py` / `build-human-assets.ts` / synth-sound tools, the Quaternius and KayKit packs.
- `AssetGenerator/packages/`: a new npm workspace with `@futuremagic/core` (rng, noise, geom, worker pool), `@futuremagic/humanoid` (bodies, races, garment shells, animator, ragdoll), and later `abilities` and `items`. Dunfinity consumes it as a git dependency (or a local workspace link while developing).
- **Extract on demand.** Only what Dunfinity actually takes, when it takes it. Scale and Norgo keep their own copies until you decide to migrate them, so Dunfinity is never blocked on keeping two other games green. This is my one remaining concern with the shared package, and extracting on demand addresses it.

Bonus found there: **Quaternius Ultimate Monsters** (50 CC0 bodies in 3 rig families) and **KayKit skeletons**. That's an early dungeon bestiary before the procedural creatures are ready.

### 3.3 Tomb Raider geometry changes the camera answer

I recommended a three-quarter top-down camera. With ledges, vertical caverns and buildings inside caves, I now **reverse that**: top-down cameras fail at verticality (you can't read heights, ceilings occlude, ledges are invisible). **Third-person with a free orbit camera** fits D8, and it shows off the humans. It also brings three things we must plan for:

- **A traversal moveset:** jump, ledge grab, climb, drop, fall damage. Scale's and Norgo's animators already have climb/air families.
- **Reachability guarantees:** the generator must know exactly how far the player can jump and climb, and prove every region is reachable (Spelunky-style).
- **3D monster navigation:** a navmesh with jump/climb/drop links, plus climbers and flyers that ignore it. This is the hardest technical gap (G2).

### 3.4 Skill buying: fine, but watch three traps

1. **Grind.** If the currency comes only from kills, players farm. Make it come from *variety*: first kills of a species, new regions entered, depth records, discoveries.
2. **Solved builds.** A fully visible tree gets "solved" on a wiki. Counter: some branches only appear once you find a torn-out page deep down (see 4.2). That's buying, not random finding: you still choose and pay.
3. **Permadeath meaning.** Purchased skills are lost on death in the default mode. That's correct for a roguelike, but it makes the early game repeat a lot. Keep the first tier cheap and fast.

I'd keep one piece of Norgo's use-based system: **buying unlocks a skill, using it improves it.** Buy "Knife Work", get better at it by stabbing. Both ideas fit, and they don't compete.

### 3.5 "Algorithmic strangeness" needs a grammar, or it becomes oatmeal

Infinite procedural variety tends to read as sameness: "10,000 bowls of oatmeal". What Xenoworld does right is a **genome**: `WorldParams` is a pure function of the seed that decides palettes, species, civilisations and physics, and every system reads from it. Dunfinity should do the same per stratum: a **StratumGenome** (see 4.4). We design the grammar and its rules carefully, and the content comes from it.

### 3.6 Recall makes the cellar a safe room

Fine by me, with one rule: in Hunted mode, recalling does **not** cool the heat down. Otherwise Recall becomes the panic button that defeats the mode.

---

## 4. Concepts (round 2)

### 4.1 Grandma

Thirty years without visitors, and a sealed cellar. The obvious reading is that **she kept people away on purpose**: she was holding the door. She died, and the seal is failing. Her story is the game's slow mystery:

- **The strange small room** is her threshold: an armchair, a lamp, a chalk circle on the floor, a bricked-up arch. It's the Recall anchor and your stash.
- She **went down herself** when she was young. The kitchen knife is hers, and so is the item from 4.2.
- Pieces of her story turn up at depth: her notes, her old camp, her name scratched into a wall at level 40. Never a cutscene, always something you find.
- In the town above, a few neighbours remember her. That's useful for a tiny hub without inventing a whole town: a hardware store, a pawn shop, a doctor.

### 4.2 The item that explains skill buying: two options

**A. Grandma's recipe box (my pick).** A battered tin box of index cards in her handwriting. Skills are *recipes*: "Knife Work", "Quiet Feet", "Way Home" (Recall). The dungeon's essence, which you absorb by doing new things, is what you "cook" them with. It fits the kitchen knife perfectly and gives the game a warm, slightly funny voice. Torn-out cards found deeper unlock hidden branches (3.4).

**B. Grandma's ledger.** A household account book that writes itself: every deed down there appears as an entry, and the balance is what you can spend. It's closer to Scale's karma, more serious, and a bit more generic.

Either way, there is one currency, earned by variety, and the item is found in the strange room before your first step down.

**Clarification (after Arnd's doubt about hunting for ingredients):** the recipe box does *not* mean hunting specific ingredients for specific skills. The whole core tree is in the box from the start and is bought with the one generic currency (essence). Hunting only applies to optional **lost cards**: hidden branches and oddities. Those should come from the stratum genome deterministically ("lost cards of the dwarven halls appear in strata 21–40, in forge regions") so that a player who goes looking can find them, rather than waiting on luck in an infinite world. If even that feels wrong, drop lost cards and the box is simply the skill tree with a story.

### 4.3 How a level is built (sketch, superseded)

**Superseded by [level-generator.md](level-generator.md):** no region archetypes or room grammar; geology → water → inhabitants → gameplay pass. Kept below for history.

The aim is Tomb-Raider-like spaces from a generator that never ends:

1. **Region map.** The infinite plane of a level is split into irregular regions (Voronoi with noise). Each region gets an **archetype** and a biome from the stratum genome:
   - *Vast cavern*: hundreds of metres wide, pillars, a ruin or village inside it
   - *Warren*: tight winding tunnels, ambush spaces
   - *Built complex*: the rectangular part: halls, corridors, vaults, rooms with doors (Scale's interior splitter)
   - *Chasm / shaft*: mostly vertical, ledges, bridges, things below
   - *Lake / flooded*: water, islands
   - *Set piece* (rare): a landmark worth walking to (a giant statue, a buried cathedral, a crashed thing)
2. **Vertical profile.** Every region has its own floor and ceiling band, so a level can be 8 m tall in a warren and 250 m in a cavern. Regions meet through transitions (ramps, drops, climbs, stairs).
3. **One density field.** Caverns are SDF (Scale's `deep` field and mesher, Xenoworld's terms). Built complexes are boxes carved out of it with CSG. Buildings, bridges, stairs and ledges are placed as meshes on top. Everything streams in chunks, generated in workers.
4. **Traversal graph.** Using the player's exact movement metrics, the generator checks reachability, and repairs it where needed with a ladder, rope, rubble ramp or bridge. The same graph feeds monster navigation.
5. **Dressing and encounters.** Props, light sources, loot and monster groups, paced by the Director (Norgo's).
6. **Descents.** Each region has a chance of a way down (a stairwell, a shaft, a sinkhole). Further from where you arrived means more variance, which is the Territories rule (D2).

Levels are separate spaces linked by descents, not one continuous 3D world. That keeps generation simple and lets each level's height vary freely.

### 4.4 Depth is time, and the genome

| Depth | Stratum | Reuse |
|---|---|---|
| 0 | **The town**: grandma's street, her house, the cellar | Scale small-town seed |
| 1–10 | Below the cellar: huge human-made spaces (abandoned quarry, salt-mine cathedrals, storm cisterns, old mine levels); cellars/sewers only as short connectors | Scale `underground`, see level-generator.md 4.2 |
| 11–20 | Crypts, catacombs, a buried medieval town | Norgo settlements, items |
| 21–40 | Halls of the old races: dwarven forges, elven vaults, goblin warrens | Norgo races, architecture, culture |
| 41–60 | Before people: fungal caverns, geodes, magma, bone hollows | Scale `deep`, Norgo underworld biomes, creature genome |
| 61+ | **Algorithmic from here on**: alien civilisations, glyph scripts, odd gravity, procedural species | Xenoworld (genome, languages, glyphs, gravity, fauna) |

Every stratum (authored or not) is a **StratumGenome**: palette, biome mix, region-archetype weights, species list, a resident civilisation and its language, one **rule** (darkness, low gravity, flooding, magic-dampening, swarms...), and mutators. From level 61 on, the genome itself is rolled from the seed and depth, with strangeness rising, so the game stays endless without new art.

### 4.5 Game modes

| | Permadeath | Save/load |
|---|---|---|
| **Territories** (default) | **Default** | Casual |
| **Hunted** (Heat on) | Hard | Casual-hard |

---

## 5. Reuse inventory

### Scale (≈163k LOC; three.js, Rapier, WebGL2, WebGPU port in progress)

| Value | Module | What you get |
|---|---|---|
| ★★★ | `src/humanoid`, `client/anim`, `avatar`, `physics/ragdoll`, `items` + `public/assets/human` (≈11k LOC, 6 MB) | Pretty bodies, all ten races, garment shells, procedural animator (~70 one-shots: stab, block, cast, roll, climb, die…), IK, ragdolls, LOD, crowd baking |
| ★★★ | `src/underground/deep` (≈3.8k) | SDF caverns, worker mesher, floor/ceiling queries, slime factions with a boss |
| ★★ | `src/underground` rooms/sewers/metro, `src/interior` | Strata 1–10 content, room/door graphs for built complexes |
| ★★ | `Caster.ts`, `shared/status.ts`, threat zones/aggro | Enemy casting with tells, status effects, boss armour/weak spots |
| ★★ | Power designs, `ElementFx`, `PowerSynth`, synth tools | Powers' tuning and visuals (mechanics are city-coupled, so rewrite) |
| ★ | `core`, `WorkerPool`, test harness | Determinism and tooling |

### Norgo (≈105k LOC; three.js, server in a Web Worker)

| Value | Module | What you get |
|---|---|---|
| ★★★ | `gameplay/data` + op runner | 41 skills and 202 data-driven abilities → the raw material for the skill tree; 92 status effects |
| ★★★ | `items` | ~265 bases, affixes, rarity, deterministic loot, procedural meshes |
| ★★ | `gm/Director` | Pacing and difficulty |
| ★★ | `creatures` | Procedural bestiary, 8 body plans, utility AI |
| ★★ | Race tables, culture, architecture styles | Stats, names, deities, building styles per race |
| ★ | Audio stems (cave, underdread, combat, boss), fx library, touch controls | |

### AssetGenerator

| Value | What | |
|---|---|---|
| ★★ | Quaternius Ultimate Monsters (50, CC0), KayKit skeletons | Early bestiary |
| ★★ | Blender spec pipeline | Props, bridges, crates, dungeon dressing on demand |
| — | Rust viewer, Godot Character Studio, MPFB humans | Not needed |

### Xenoworld (`World` repo)

| Value | What |
|---|---|
| ★★★ | `WorldParams` genome pattern, `RNG.fork(tag)` discipline |
| ★★ | Procedural languages, names and glyph scripts; civilisations; procedural fauna with IK |
| ★★ | SDF terms (cheese chambers, crystal veins, hourglass pillars, sinkholes), gravity fields, flowing-water automaton |

**Architecture recommendation (unchanged):** Norgo's structure (sim in a worker, data-driven abilities, `save()/load()` per system), Scale's renderer and humans, Xenoworld's genome discipline.

---

## 6. Gap analysis

| # | Gap | Size | Notes |
|---|---|---|---|
| G1 | **Infinite level generator** (4.3): regions, archetypes, vertical profiles, SDF + CSG + meshes, descents | Large | The heart of the game |
| G2 | **3D navigation**: navmesh per chunk with jump/climb/drop links | Large | Neither project has it |
| G3 | **Reachability check and repair** against player movement metrics | Medium | New; shares G2's graph |
| G4 | **Traversal moveset**: jump, ledge grab, climb, fall damage | Medium | Animations partly exist |
| G5 | **Third-person orbit camera** with collision for tight spaces, plus first-person zoom (first-person arms/weapon view) | Medium | |
| G6 | **Skill tree + currency** (recipe box), built from Norgo's 202 abilities | Medium | Mostly design and data |
| G7 | **StratumGenome** and the difficulty model (strata, composition, mutators, item level past 40) | Medium | Design first |
| G8 | **Modes and saves**: permadeath, casual saves, Hunted/Heat | Small–medium | Norgo save pattern |
| G9 | **Close-quarters combat feel**: hit-stop, knockback, dodge, telegraphs | Medium | Animator and Caster help |
| G10 | **Exploration memory**: 3D map of an infinite level, landmarks | Medium | Harder in 3D than 2D |
| G11 | **Dungeon lighting** as gameplay (torch, darkness, light budgets) | Medium | |
| G12 | **Dungeon gear** for the humans | Medium | Norgo meshes cover much |
| G13 | **The town and grandma's house** (small hub, cellar, strange room) | Small–medium | |
| G14 | **Shared TS packages** in AssetGenerator (3.2) | Medium | Extract on demand |
| G15 | **Race visual pass** on the pretty bodies | Small | |
| G16 | **Asset weight**: lazy-load per stratum | Small | |
| G17 | **Licensing/credits**: conform.bin CC BY 3.0, medieval dress CC-BY, Stable Audio, Lyria | Small | |

---

## 7. Open questions

None at the top level. Next planning step: deep dives (see 8).

## 8. Next planning steps

Deep-dive documents, one at a time, each ending in decisions:
1. **Level generator** (G1–G3): see [level-generator.md](level-generator.md).
2. **Recipe box** (G6): see [recipe-box.md](recipe-box.md).
3. **Strata 1–10 content**: see [town-and-first-strata.md](town-and-first-strata.md).
4. **Shared package setup** (G14): see [shared-package.md](shared-package.md).
5. **Avoiding duplicate code:** see [no-duplicates.md](no-duplicates.md).
6. **The story and the old scripts** (the rift to the first world, Kerf runes, Thread script): see [lore.md](lore.md).

## 9. First milestone (when you say go)

"Grandma's cellar": the house and cellar, the strange room, the recipe box, the kitchen knife, levels 1–10 with two region archetypes (warren + built complex), three enemy types, the first recipe tier, permadeath. If that loop is fun, everything else is content.

---

## Changelog
- 2026-10-14 draft 2.12: duplicate-code method in no-duplicates.md.
- 2026-10-14 draft 2.11: shared package plan in shared-package.md.
- 2026-10-14 draft 2.10: D19 town and levels 1–10 accepted.
- 2026-10-14 draft 2.9: town, grandma's house and levels 1–10 deep dive in town-and-first-strata.md; two concept images.
- 2026-10-14 draft 2.8: D18 recipe box decisions; infused salt; first concept image (concept/strange-room.jpg).
- 2026-10-14 draft 2.7: recipe box deep dive in recipe-box.md.
- 2026-10-14 draft 2.6: D17 level generator decisions.
- 2026-10-14 draft 2.5: level generator deep dive in level-generator.md; 4.3 superseded; strata 1–10 rethought as big human-made spaces.
- 2026-10-14 draft 2.4: D12 recipe box final, D15 desktop + iPad, D16 single-player; next planning steps.
- 2026-10-14 draft 2.3: D14 persistence rules accepted; save growth note.
- 2026-10-14 draft 2.2: D13 same dungeon across runs, corpse gear looted by denizens.
- 2026-10-14 draft 2.1: D9 third person + first-person zoom, D10 real-time, D11 pure permadeath (endless knife block), D12 recipe box tentative with clarification.
- 2026-10-14 draft 2: Arnd's decisions D1–D8; human-model correction (conform offsets); AssetGenerator and Xenoworld reviewed; camera recommendation reversed; skill-buy design; level generator sketch; genome; modes.
- 2026-10-14 draft 1: repo survey, pushback, concepts, reuse inventory, gaps, questions.
