# Generative depth: strangeness, and content that never runs out

Status: **draft 2, 2026-10-15: G1–G5 decided (Arnd took all picks). No code yet.** Part of [dunfinity-plan.md](dunfinity-plan.md) (D6, §3.5, §4.4). Builds on [level-styles.md](level-styles.md), [level-styles-catalog.md](level-styles-catalog.md) §5, [lore.md](lore.md) and [recipe-box.md](recipe-box.md) (generated lost cards).

Arnd's ask (2026-10-15): *we can't plan infinite levels, so we need new kinds of generative content: procedural critters, procedural dungeon styles, procedural texture definitions, probably more. And a strangeness factor, translated into deviations from standards, that goes up as the player goes down.*

---

## 1. What the existing plan says, against Arnd's list

| # | In the plan or code today | Verdict | What changes |
|---|---|---|---|
| C1 | `src/gen/genome.ts`: from level 61 "The Deep" is a stratum every ten levels that draws 3–5 of the **same 12 hand-made styles**, all equally likely | **Contradicts.** This is exactly the "10,000 bowls of oatmeal" the plan warned about (§3.5): by level 200 the player has seen every combination | Deep strata draw *generated* styles (§4), and known styles with their genes pushed (§4.1) |
| C2 | Plan §4.4: authored down to 60, "algorithmic from 61 on". Strangeness is a cliff | **Arnd's version is better.** One curve from level 1, rising smoothly. The authored strata become anchors on that curve, not a different regime | `strangeness(seed, depth)` is one seam every generator reads (§2) |
| C3 | Lore LO1: every world is a copy of the one beneath it, "a little changed each time" | **Makes it better.** It tells us *what* strangeness is: how many copies away from ours. A deviation is our world's standard, copied wrong. So deviations should be *coherent per world* (a few rules that hold everywhere in a stratum), never per-object noise | Strangeness spends itself on a stratum's few **laws** (§2.3), not on wobbling everything a little |
| C4 | Lore table: the Deep's scripts are "rolled per stratum: unreadable" | **Conflicts** with LO2 ("never gibberish") and with the strangeness idea | Proposal: the Deep's scripts are **drifted copies** of Kerf and Thread, still English ciphers, their glyphs deviating with strangeness (§6.5). Decodable, harder |
| C5 | Rock shader (`materials.ts` `ROCK`): 8 rock types, each hand-coded; per vertex 8 weights | **Contradicts** procedural textures, and adding a ninth type means editing the shader | Rock types become **recipes as data** in per-level slots, one generic stone in the shader (§5). The 8 existing types become 8 presets |
| C6 | Shader policy: each compile <100 ms, ≤5/s, nothing after warm-up; every creature species has its own `CoatKind` | **Constrains** everything generated: a new shader per generated thing is forbidden | Generated things vary through **uniforms and vertex attributes** of a few fixed kinds, never new kinds (§5, §6.1) |
| C7 | Mobs are made offline in Blender (AssetGenerator `creature.quadruped`); memory says "procedural on-the-fly mobs: later, a TS port" | **Agrees**, but Blender cannot run in the browser, so infinite critters need a runtime pipeline | Two steps: cheap **kin** (re-proportioned, recoloured variants of our Blender mobs) first, then a runtime body-plan generator in TS (§6.1) |
| C8 | Plan §4.4 genome: "one rule (darkness, low gravity, flooding…) and mutators" | **Agrees**, this is the seed of §2.3 | Formalised as laws, counted by strangeness |
| C9 | Cisterns oddities (uphill water `FLOW`, older pillar drums), salt statues that turn | **Agrees**: these are the first hand-picked deviations | They become the first entries in the deviation catalogue (§3), so deeper strata can reuse them |
| C10 | Recipe box: generated lost cards from ~60, Norgo op recipes, power budget per depth | **Agrees** | Strangeness decides how far a card's ops stray from the core ones (§6.4) |

## 2. Strangeness

### 2.1 Two axes, never one

**Depth is difficulty; strangeness is distance from our world.** They rise together on average but are separate numbers. Weird must not mean hard, and hard must not need weird. A generator reads both and must not use one as the other.

### 2.2 The curve

`strangeness(seed, depth) → S`, pure, in `src/gen/genome.ts` (one seam, one row in ARCHITECTURE.md).

- **Trend:** S rises fast early and keeps rising slowly forever, so there is never a level where everything is already as strange as it gets. Proposal: `trend = log2(1 + depth / 8)`: about 0.2 at level 1, 1 at 8, 2.5 at 40, 3.9 at 110, 6 at 500.
- **Swing per stratum:** each stratum draws its own swing, ±40 % of the trend. Some deep worlds are **faithful copies**: eerily close to ours, a town street at level 300 that is almost right. Those calm strata make the strange ones land harder, and the lore supports them (a copy can be careful).
- **Amplitude is capped, count is not.** Past a cap (S ≈ 3), deviations stop growing in size (a wall can only be so warped before it is noise) and grow in *number and combination* instead: more laws per stratum, rarer laws, laws that interact.
- Levels 1–10: S is small and only spends itself on the hand-placed oddities (§3, C9). Town (depth 0): S = 0, always.

### 2.3 Standards and laws

Every generator that wants to deviate declares its **standards**: named parameters with the value our world has and two ranges.

```ts
// sketch: one registry of standards, read by generators, pushed by strangeness
gene('style.karst.domeHeight', { standard: 14, safe: [8, 24], strange: [4, 60] });
gene('rock.slot.hue',          { standard: 'band', safe: 0.08, strange: 0.5 });
gene('critter.legs',           { standard: 4, safe: [4, 4], strange: [2, 10] });
gene('law.gravity',            { standard: 1, safe: [1, 1], strange: [0.55, 1.3] });
```

- Below S ≈ 1, a gene draws inside its **safe** range (variety, not strangeness).
- Above it, a stratum picks a few genes and pushes them into the **strange** range, by S. Which genes, and how far, is the stratum's genome (`deriveSeed(seed, 'stratum', from)`), so a whole world deviates the same way.
- A **law** is a deviation the player can name in one sentence: "water runs uphill here", "the light is green and nothing casts a shadow", "everything has six legs", "gravity is weaker", "the walls are warm and soft". A stratum has `1 + floor(S)` laws, picked from the catalogue (§3), each applied everywhere in it. Laws are what the player remembers; genes underneath are what keeps two strata with the same law from looking alike.

### 2.4 What strangeness never touches (the invariants)

These are contracts, not standards. No gene can reach them, and the tests keep checking them at every depth:
- the edge contract E1–E6 and `LIPSCHITZ` (level-styles.md §2), walkable openings, connectivity, headroom at arrivals and ways down;
- **every action has a visible animation, and no mob ever jitters** (Arnd's gameplay rules);
- attacks are telegraphed; the player's own moveset and numbers (jump, climb, stamina) never change, only the world around them (so "low gravity" changes falls and creatures, not the nobody's jump: open question G4);
- the shader policy;
- determinism: everything is a pure function of (seed, depth, position).

## 3. The deviation catalogue (laws)

A list that grows with the game; each entry says which channel it touches, the S it needs, and who builds it. Starting set:

| Law | Channel | Min S | Exists? |
|---|---|---|---|
| Water flows uphill in places | water | 0.5 | yes (Cisterns, `FLOW`) |
| Things face another way when unseen | props | 0.5 | planned (salt statues) |
| Older things under ours (pillars, stairs) | geometry | 0.8 | yes (older pillar drums) |
| Light of another colour; the headlamp tinted | light | 1 | |
| Rock warm and glowing in seams | matter | 1 | partly (infused veins) |
| Too big: doors, steps, props at 1.5–2× | scale | 1.2 | partly (climbers' stair) |
| Everything symmetrical / everything leans one way | geometry | 1.5 | |
| Echo of our town (street, house, bricked arch) | landmark | 1.5 | planned (Ossuaries) |
| Creatures with one extra pair of limbs, or one fewer | life | 1.5 | |
| Lower gravity: longer falls, floating dust, leaping mobs | physics | 2 | |
| Soft walls that breathe (colour only, never the SDF) | matter | 2.5 | catalogue §5 "organic" |
| Ceilings that are floors: hanging forests, rain falling up | geometry | 3 | needs multi-floor envelope |
| Silence (sound damped), or everything echoes | sound | 2 | |
| Writing everywhere, cut into the walls themselves | writing | 3 | catalogue §5 "glyph-cut" |

## 4. Procedural styles (owner: "More dungeon level styles"; framework bits: main thread)

### 4.1 Step one: genes for the styles we have

Each of the 14 styles exposes its knobs as genes (dome height, tube radius, pillar spacing, rift width, block size, grain angle, thing density…), each with standard and safe/strange ranges that **the style's own tests prove stay inside E1–E6 and Lipschitz**. The genome then draws a *variant* of a style per stratum: "karst" at level 130 is karst with drawn genes. This multiplies 14 looks into thousands for little code, and it is the first thing that fixes C1.

### 4.2 Step two: crossings

The lore says each world copies the one below. A **crossed style** takes the envelope of one style and the detail of another (karst envelope with basalt columns; rift with fungal things), as long as both parts are bounded. It needs the `Style` contract split into its two halves (envelope, detail) that it already has in spirit (`column` and `at`). A crossing gets a generated id (`StyleId` must stop being a closed union for these: `gen:<hash>`).

### 4.3 Step three: the grammar style (61+)

One parametric style built from a small set of bounded operators: envelope recipes (warped noise families, terraces, domes, canyons), detail operators (pillars, ribs, blobs, shelves, crystals, glyph extrusions), thing kinds through `CaveThings`, grain through `Grain`. The genome writes a recipe; the style evaluates it. Catalogue §5's alien styles (organic, glyph-cut, floating) are recipes of it, not separate code.

**Acceptance gate:** every generated style is checked when the stratum is made (cheap sampling of the robustness suite: continuity, openness, headroom along the backbone) and rerolled deterministically (`deriveSeed(…, 'reroll', n)`) if it fails. Plus the variety signatures (catalogue §7), so a generated style is rejected when it measures like one already in the stratum.

## 5. Procedural textures (owner: "Rock materials")

Today's `ROCK` shader hard-codes 8 rock types. Proposal:

- A **rock recipe** is data: base and accent colours, bedding (thickness, waviness, angle), grain (crystal size, contrast), laminae and cleavage, veins (density, width, colour, glow), mottling scale, roughness and wetness, and an emissive term. About 16–24 numbers.
- The shader has **slots**: each level loads up to 8 recipes into uniform arrays (no new compile, ever). The per-vertex mix (`rocks`, `rocks2`) stays as it is, but its 8 weights now mean "slot 0–7", not "limestone…slate".
- Today's 8 types become **8 presets** of the recipe (a golden screenshot test that they still look the same, as near as the generic code gets).
- Strata from S ≈ 1 draw recipes: presets nudged inside safe ranges, then genuinely new stone (green glassy, banded red-black, white with gold veins). Laws like "warm glowing rock" are recipe genes.
- The same idea for the other kinds that should vary: water (colour, murk, glow), fog and ambient light (already uniforms), creature coats (§6.1), glows. **Never a new kind for a generated thing.**
- Risk: one generic stone shader may be slower than eight hand-tuned branches. Measure compile time against the 100 ms cap and frame cost early; the fallback is evaluating only the two strongest slots per fragment.

## 6. Procedural life and the rest

### 6.1 Critters (owner: the mobs thread; behaviour sims: main thread)

- **Kin first (cheap, soon).** A deeper "copy" of a species we have: bone scales (`Pose.scales` exists), proportions, coat hue and pattern from uniforms or attributes, an extra pair of legs where the rig allows. Clips stay valid. Rats, dogs, crickets and slimes get kin in strata 11+ as strangeness allows. Lore fit: "every world is a copy", so the deep has drafts of our dog.
- **Body plans at runtime (later, the real thing).** A TS port of `creature.quadruped`'s idea: a body-plan genome (segments, limb pairs, limb length, neck/tail chains, head shape, size) → SDF → surface nets in a worker (`src/gen/surfaceNets.ts` already exists) → automatic skin weights from bone distance → **procedural gait** by IK from leg count and length, plus a few templated actions (lunge, bite, sting, spit, slam) that satisfy the visible-animation rule by construction. One mesh per species per stratum, cached; individuals vary by uniforms. One generic `CRITTER` material kind with the coat in vertex attributes.
- **Behaviour is not generated from scratch.** It comes from **kits** we already have and test: swarm (rats), pack circle (dogs), leap and climb (crickets), ooze (slimes), swim (eels), lie in wait (shrooms), camp (scavengers). A species is a body plan × a kit × stats from the depth budget × an ability or two from Norgo ops. The anti-jitter rule lives in `Steer`, which every kit already uses.
- **Bosses:** a stratum boss is a large body plan with a kit, two or three telegraphed abilities and a place (a lair), like the Tall One. The climbers stay hand-made (Scale humans): they are the constant thread down.

### 6.2 Props and things (owner: "Props in Blender" for kits; styles thread for placement)

Offline Blender props stay for the authored strata. For the deep: parametric prop kits whose parts are taper pieces (`CaveThings` already makes roots, mushrooms, crystals from them) and boxes: stalks, shelves, ribs, idols, cairns, bone heaps, recoloured and rescaled by genes. Plus kin of our props (a mine cart copied wrong) for the "copy" feeling.

### 6.3 Light, air and sound (owners: main thread; sound thread)

Per stratum: light colour and power, fog colour and density, dust, the headlamp's tint (all uniforms already). Sound: a library of ambience and creature takes (Seed Audio, made offline by the sound thread), varied at runtime by pitch, filter, reverb and layering per stratum, and a "silence" law. New takes are asked of the sound thread, never made here.

### 6.3a Music (owner: the sound thread)

Arnd (2026-10-15): his project **ProcMuse** makes procedural music in a loop. Its style is wrong for Dunfinity, but the concept can be adapted for endless music deeper down, and it can run **together with compositions**. Proposal: the authored Lyria tracks (town, quarry, salt, cistern, threshold, danger, boss) stay for the hand-made strata. Below them, a ProcMuse-style engine plays per stratum from genes: key and mode, tempo, instrument set (drawn from a sample library the sound thread makes), density, and how far the harmony strays (strangeness). A calm stratum (G2) gets music close to the Threshold's; a strange one gets detuned, wrong-scale music. In tandem: a composed stem (a drone or the Lyria bed) underneath, with procedural phrases on top, so the deep never loops audibly. Next: read ProcMuse (its repo needs adding to the project) and agree the engine with the sound thread.

### 6.4 Lost cards (recipe-box.md)

Generated cards compose Norgo ops; strangeness decides how far they stray from the core tree's ops and how odd grandma's margin note gets.

### 6.5 Writing (owner: the lore thread)

Proposal against C4: the Deep's scripts are **drifts of Kerf and Thread**. A stratum's script is an ancestor script with its glyphs deviated by S (strokes bent, mirrored, joined, a sound merged) and still an English cipher. Players who learned Kerf can half-read a level-80 frieze, and the deeper they go the more they must re-learn. This keeps LO2 and turns the scripts themselves into the clearest picture of "copies of copies". Names and the dead stay generated (Xenoworld name generators).

## 7. Order of work (one PR each)

1. **The strangeness seam and the standards registry** (main thread): `strangeness(seed, depth)`, `gene()`, laws on the genome, a debug line in the HUD, and a **depth strip** tool: screenshots of one seed at depths 1, 11, 21, 41, 61, 100, 200, 500 side by side, so we judge strangeness by eye, not by reading code.
2. **Rock recipes and slots** (Rock materials): presets first (no visible change), then drawn recipes from S ≥ 1. Highest visual payoff per line of code.
3. **Style genes** for the existing styles (styles thread), starting with the ones the Deep uses most; the genome draws variants (fixes C1).
4. **Light and air per stratum** and the first three laws (light colour, too big, uphill water everywhere).
5. **Kin** of the existing mobs (mobs thread).
6. **Crossed styles**, then the **grammar style** with the acceptance gate.
7. **Runtime body plans** for critters, with the gait and the action templates.
8. Drifted scripts, prop kits, sound variation, generated bosses, more laws.

## 8. Decisions (Arnd took all five picks, 2026-10-15)

| # | Question | Decided |
|---|---|---|
| G1 | Strangeness from level 1 as one curve (authored strata are anchors), or only from 61 as the plan says now? | One curve from level 1 |
| G2 | Calm strata: may a deep world be a faithful, almost normal copy now and then? | Yes |
| G3 | The Deep's scripts: drifted but decodable, or unreadable as lore.md says? | Drifted, decodable |
| G4 | May laws touch the nobody (weaker gravity makes your jumps longer), or only the world and creatures? | Only the world, at first |
| G5 | What to build first? | The seam + depth strip, then rock recipes |

---

## Changelog
- 2026-10-15 draft 2: Arnd took G1–G5; music from a ProcMuse-style engine (6.3a).
- 2026-10-15 draft 1: contradictions C1–C10, strangeness (curve, standards, laws, invariants), deviation catalogue, procedural styles/textures/critters/props/sound/writing, order of work, decisions G1–G5.
