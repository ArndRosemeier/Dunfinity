# Dunfinity: the rift (story bible and the two scripts)

Status: **draft 2, decided by Arnd 2026-10-15 (LO1–LO4 below), no in-game text yet.** Part of [dunfinity-plan.md](dunfinity-plan.md). Builds on the story spine in [town-and-first-strata.md](town-and-first-strata.md) §1 and the strata in dunfinity-plan.md §4.4 / `src/gen/genome.ts`. Glyph sheet: run `npx tsx tools/lore/sheet.ts glyphs.svg glyphs.png` (drawn by `tools/lore/sheet.ts` from `src/lore/scripts.ts`).

Arnd's ask (2026-10-15): *the dungeon is a rift to the first world, and the deeper the player gets the clearer this becomes. Dwarven runes and elven script visible in game.*

## 0. Timeline (Arnd, 2026-10-17)

- **The game happens today (2026).** The player is grandma Grete's grandchild, come to her town after her death this year.
- **The town is a present-day town:** its people dress and live as people do now, and its shops take euros. Nothing in the town is staged as the 1960s.
- **The past shows only through what is left of it:** grandma's diary (1959–1971, a few later pages), the 1966 TV report on the title screen, the old mine, its relics and its dead.

---

## 1. The truth (for us; never stated in one place in game)

**The worlds are laid down like strata.** Ours is the newest. Before it there was another world, and before that another, each one finished, buried, and the next one built on its stones. Every world was copied from the one below it, the way a recipe is copied by hand: a little changed each time, never quite the same.

**The rift is where they never closed.** Under this valley a crack runs down through every world to the bottom one: **the first world**, the original that all the others were copied from. Our town stands over it; so did a town in every world before.

This one idea explains what the game already does:

| What the game does | Why, in the story |
|---|---|
| Every level goes on forever sideways | Below the Threshold, a level is not a cave. It is the floor of a whole buried world |
| Deeper is older, then stranger (D6, "depth is time") | Older worlds are earlier copies: rougher, then made under other rules |
| The Ossuaries hold a buried medieval town | It is *this* town, one world down. Same river, same street. A house where grandma's stands, with a bricked arch in its cellar |
| Infused (blue) salt seeps out of the rock and powers the recipes | It is what is left of the first world's sea, rising up the crack. First-world stuff: it makes things happen |
| The Salt-Touched | Miners who died down there: the salt has grown through their bones for eighty years and keeps them working |
| The Tall One will not cross infused salt | See the climbers below: a line of first-world salt is a line they were told never to cross |
| "Steps cut for someone twice my height" (grandma's note, level 9) | The climbers' stair |
| Nothing ends | The first world is at the bottom of an infinite stair. You get closer; you never arrive |

**The climbers.** Traffic in the rift goes both ways. People of every world dig *down* (for salt, for fire, for answers). Something else comes *up*: the long, quiet people who cut the oversized stairs. Their stairs turn up in every stratum, always going up. The Tall One on level 10 is the highest any has come: it stands at the top of its stair, under our world, waiting.

What the climbers want stays open on purpose, and the two old peoples disagree about it (§3). That disagreement is the mystery the player carries down.

**What happened in 1966** (fits the spine): grandma had been down many times, as deep as the Old Halls (her name scratched at level 40, as the plan has it). On her last trip a climber followed her *up*. She got home first, bricked the arch and laid the salt circle, and spent sixty years keeping it in. The Tall One on level 10 is still standing where she stopped it.

**Her father** stays a mystery, but a live one: his chalk marks keep turning up deeper, in the Old Halls, dated 1949, 1953. He was alive down there for years. The Quarry's chalk numbers that count *down* are his hand (open: do we ever find him).

## 2. How it becomes clear, stratum by stratum

One new fact per stratum, never a cutscene. The player gets it from places, objects and readable fragments, and the tin's jokes.

| Depth | Stratum | What the player can know after it | Carried by |
|---|---|---|---|
| 0–10 | Cellar, Quarry, Salt Works, Cisterns, Threshold | Something lives under the town. The mine found it in 1947; grandma held it back. *"The caves were here first."* | Grandma's notes and camp, the notary, the Tall One, oddities (uphill water, older pillars), the first worn runes on the Threshold's crypt fronts |
| 11–20 | The Ossuaries | **People have done this before.** The buried town is ours, one world older; it too had a grandma | The town's echo of the street layout, its bricked cellar arch, medieval grave texts in plain words, the first elven wards on sealed doors |
| 21–40 | The Old Halls | **It isn't a cave: it's a crack through worlds**, each level a world. The dwarves dug down for the first fire; the elves kept the way shut; the climbers come up | Kerf runes (dwarven) and Thread script (elven), two accounts that contradict each other; grandma's name at 40; her father's chalk |
| 41–60 | Before People | **Every world is a copy.** Fossils and formations that are rough drafts of things from ours (a tree, a dog, a house shape in the rock) | Shapes, not text. The climbers' stairs, still going up |
| 61+ | The Deep | **The first world is not dead.** The rules themselves were different down here | Each world's few laws ([generative-depth.md](generative-depth.md)); its writing a drifted copy of Kerf or Thread, harder to read the deeper it is (§4.3). The stairs and the salt continue |

The tin carries it in grandma's voice, e.g. a deep-chapter margin note: *"Every recipe is a copy of a copy. Somewhere down there is the first one, and I bet it's terrible."*

## 3. The two old peoples, two accounts

They lived in the same world (the Old Halls stratum), around the same crack, and wanted opposite things. Their inscriptions are the game's two unreliable narrators; grandma's notes are the third.

**The dwarves: the diggers.** Practical, proud, counting. They dug down on purpose, through world after world, after *the first fire*: the heat at the bottom (the forges at the foot of the hall chasms). Their writing is records and warnings: depths, hall names, who died where, what was found. They believed the climbers come to **take back** what the diggers took. They stopped writing at some depth; the last runes are hurried.

**The elves: the keepers.** They grew vaults over the crack and sang the doors shut. Their writing is wards, laments, names of the lost. They believed the climbers are **only going home** (or: coming home to us): refugees from something worse below. Grandma's salt circle copies an elven ward. She never knew what it said.

Neither is simply right. The player decides, or doesn't.

Living dwarves and elves: none in 21–40 for now, only their halls, vaults and writing (and their ghosts, if the bestiary wants them later). Note: the elven vaults style isn't built yet ("More dungeon level styles" has it next after the dwarven halls).

## 4. The scripts

Both are **real writing: English, spelled by ear**, and so are their drifted copies in the Deep (generative-depth.md G3), so every inscription in the dungeon can be read by a player with a notebook (as in Tunic or Fez). Nothing in either script is gibberish, ever: a decodable script that sometimes lies destroys the puzzle. Proper names may be invented words; everything else is English.

Glyph sheet: `tools/lore/sheet.ts`. The glyphs are data (`src/lore/scripts.ts`): a line of text becomes polylines and dots, which the sheet draws as SVG and the game will draw as geometry.

### 4.1 Kerf runes (dwarven)

- **Cut with a chisel:** straight strokes only, and never a level one ("a cut along the bedding splits the stone"). A rune is two units tall, one wide, mostly on a stave.
- **One rune per sound:** 23 letters plus TH. No C, Q or X: the dwarves spell by ear (cat → KAT, quick → KWIK, axe → AKS). That is a small puzzle in itself.
- Words are parted by two short notches. Numbers are spelled out.
- **In game:** gold-brown inlay in dark granite (the halls' inlay bands already exist in `src/gen/dwarven.ts`), large: 40–60 cm a rune, so it reads at third-person distance in torchlight.

### 4.2 Thread script (elven)

- **One unbroken line, the thread,** drawn first along whatever carries the text: a rib of a vault, the rim of a basin, a ring of salt. Consonants hang beneath it as curves; a vowel is a mark above the consonant it follows (dot A, tick E, two dots I, ring O, cup U), or above a short drop when no consonant comes before it. Each word's thread curls up at both ends.
- 20 consonants including TH and SH; no C, Q or X; CH is said soft (SH).
- Because it follows a line, it can bend: along vault ribs, round circles, spiralling up a column.
- **In game:** pale silver or salt-white on rock, along curves.

### 4.3 Where they appear

| Where | Script | What it says (kind) | Depth |
|---|---|---|---|
| **Round grandma's salt circle** in the cellar | Thread | A keeping ward she copied. Visible from the first minute, readable only by players who learn the script at 21+ | 0 |
| Worn lines on the Threshold's crypt fronts and giant stairs | Kerf | Fragments, half broken off: a teaser | 9–10 |
| Sealed doors in the Ossuaries | Thread | Wards over doors the medieval town walled up | 11–20 |
| Dwarven halls: wall friezes in the inlay bands, gate lintels, bridge parapets over the chasms, column bases | Kerf | Hall names, depths ("forty fathoms to the fire"), records, warnings, the diggers' account | 21–40 |
| Elven vaults: along the ribs, round column clusters | Thread | Wards, laments, the keepers' account | 21–40 (when the vaults land) |
| Grandma's name at level 40, her father's chalk | Latin letters, her hand | | 21–40 |
| The Deep | drifts of Kerf and Thread (decision G3) | Still English, still decodable: glyphs bent, mirrored, joined, sounds merged, more with strangeness; what was learned half-reads it | 61+ |

### 4.4 Reading them

- **E: read** at an inscription opens the panel with the glyphs drawn large, and under them what you can make out: letters you know shown as letters, the rest as the glyphs themselves.
- **Grandma's key:** a rubbing in the tin, found with her notes (Kerf at the Threshold camp, the Thread key much deeper, since she only half learned it), with the letters she was sure of pencilled in. Not all of them, and one wrong (she has R and W swapped, with a note: *"or the other way round"*).
- **My pick:** each new inscription you read adds one letter to the key (*you* pencil it in). Players who decode on their own get ahead; everyone else gets there by reading. The key lives in the tin, and the tin stays in the cellar, so later grandchildren find the earlier ones' pencil marks: knowledge is the one thing that carries over (it fits D11: nothing that makes you stronger).

### 4.5 How text is generated

- **Authored fragments** carry the story: a pool per stratum and script (the two accounts, the warnings, grandma), placed deterministically by `Rng(deriveSeed(seed, 'inscription', depth, ...))`, one revealing fragment within reach of each arrival, more further out.
- **Generated filler** keeps friezes from being empty and is always real English: a small grammar of hall names ("hall of the {noun}"), depth counts, gate names, names of the dead from a dwarven name generator, ward lines.

## 5. Build plan (PRs)

1. **Scripts as data** (`src/lore/scripts.ts`, the glyph sheet tool, tests): done as a draft with this doc.
2. **Reading:** `level.inscriptions`, the read panel drawing glyphs, the known letters (save), grandma's key in the tin.
3. **First sightings:** the Thread ring round the cellar's salt circle; worn Kerf on the Threshold ruins.
4. **Dwarven halls:** friezes, lintels, parapets, column bases (with "More dungeon level styles", who owns the halls; rendering as inlay geometry or decal, with "Rock materials").
5. **Elven vaults** ribs, when the vaults land; Ossuaries wards.
6. Fragments by depth, the generated filler, grandma's name at 40, her father's chalk.

Rendering note: the rock is meshed at 1 m, so glyphs cannot be carved into the SDF. They are thin geometry laid on the rock (inlay strips, like props) or a decal kind in `materials.ts`; I'll agree that with "Rock materials".

## 6. Decisions (Arnd, 2026-10-15)

| # | Decision |
|---|---|
| LO1 | **Stacked worlds:** below the Threshold each level is a buried world, each copied from the one below; the rift runs down to the first world, which is never reached |
| LO2 | **Real ciphers of English** that players can decode; never gibberish in either script (names aside) |
| LO3 | **Decoding carries over** as pencil marks in grandma's key in the tin; grandma's key starts partial, each new inscription read adds a letter |
| LO4 | **The climbers' motive stays open**; dwarves (take back) and elves (going home) disagree |

---

## Changelog
- 2026-10-16: grandma's diary (her pages torn out and left where she wrote them, one per stratum beat) in [grandmas-diary.md](grandmas-diary.md). Names her: Margarete "Grete" Hollmann; her father Josef.
- 2026-10-15 build: steps 3–5 in PR #117 (Threshold lintels, grandma's rubbing, dwarven gate names and panel friezes, elven rib lines along the vaults). Hall friezes run 30–50 cm a rune (a panel is ~5 m wide); bridge parapets wait for parapet geometry. Texts in `src/lore/fragments.ts`.
- 2026-10-15 draft 2.1: the Deep's scripts are drifted copies of Kerf and Thread, decodable (generative-depth.md G3), not unreadable.
- 2026-10-15 draft 2: Arnd took all four picks (LO1–LO4).
- 2026-10-15 draft 1: story bible, the two scripts, where they appear, reading, build plan.
