# Items and the inventory

Decided 2026-10-16: Arnd took my picks on every fork except F2, which he rewrote (below). He also asked for a trinket slot. Thread: "do we have an inventory?". The pack panel and the 8-find limit (PR #150) are step 0 of this plan, not a throwaway.

## What it has to fit

- **D11, pure permadeath.** Everything a grandchild carries is lost when they die. That makes item progression *within a run*: the deeper you are, the better the things you hold, and dying throws them away. Progression across runs stays where it is: in grandma's tin (salt, recipe cards) and in the family's purse.
- **Two currencies.** Euros buy mundane things in town. Salt buys cards. Items never cost salt and never make salt.
- **Spells already exist as grandma's recipe cards.** They are cooked from the tin and put on the ability bar (`src/game/abilities.ts`, `src/render/spells.ts`). There will be no second magic system. Wands make cards better and never add spells of their own (see F5).
- **The nobody fantasy.** The game starts with a kitchen knife and rags. Gear has to feel scrounged: a miner's helmet, a crowbar, a goblin's stolen hatchet. A shiny sword from a chest at level 2 would break that. Proper arms and armour come deeper down, where the dwarves, elves and peoples of the deep left them.
- **No grind treadmill.** Norgo's items (about 265 bases, with affixes and rarity) are a good catalogue to draw from. Its affix soup would bury this game's tone, though, so we take few bases and give each one a clear job.

## Forks (my pick first)

**F1. Slots.** Eight: head, body, hands, legs, feet, main hand, off hand and one trinket. The trinket slot was added for F2, since slimes can swallow trinkets. The humanoid package already has all of these as `EquipSlot`s, worn through the Wardrobe hook, so armour shows on the body. Rings can come later. The alternative is the package's full sixteen slots, which means more clutter and more models.

**F2. Where items come from (Arnd's rule).** An item turns up only where it makes sense:
- Worn and held gear comes from humanoids and miners' sheds: what scavengers, goblins, the Salt-Touched and ghosts wear and wield, and what the miners left behind.
- A slime may have swallowed a trinket.
- A rat has nothing much on it.
- There are no random treasure chests. The exception is a lair where one makes sense, such as the goblin boss's hut.
- Kemal still sells the mundane pieces in town.

**F3. Tiers with depth.** My pick ties each base to the stratum it belongs to. Levels 1–10 have miners' and town gear. Levels 11–20 have crypt iron and dwarven work. Deeper strata draw their materials from the genes (`gene`/`express`), so a strange stratum has strange metal. On top of the base there are four quality steps: worn, sound, fine and master. Qualities only ever change numbers. At most one property ("of the salt", "goblin-made") appears, and only below level 10. The alternative is Norgo's affixes and rarity colours.

**F4. Weapons.** My pick is a handful of weapon types, each with its own moveset through the `Fighter`/reach/damage seam in `src/combat/combat.ts`:
- knife: fast stab
- hatchet or pick: slow chop that hits hard
- crowbar: blunt, knocks back, and prises shut things open
- spear (deeper): long reach
- two-handed axe or hammer (deeper): uses the off hand too

Grandma's knife is always in the block. Cards that use a blade work with any blade. Cards that name the knife (Second Helpings throws it, Tenderising uses its handle) swap to it for that move. The alternative is to keep cards knife-only and make weapons basic attacks only.

**F5. Wands.** My pick is that a wand is a focus held in the off hand (or main hand, with no weapon). It strengthens one chapter of grandma's cards: for example +1 rank, less stamina, a longer reach, or a second candle burning. In the world, foci are salt-crusted things from the deep: a salt rod, a bone whistle, a tallow spoon from her own kitchen. That gives the caster a play style without bypassing the tin, because a wand never casts a card you haven't cooked. The alternative is wands that hold charges of uncooked cards, which would undercut the tin.

**F6. Armour.** My pick: every piece adds armour, which reduces damage through the combat seam. Heavy pieces cost something:
- stamina while climbing and swimming
- noise while sneaking
- a helmet narrows the headlamp a little (maybe)

Kemal's helmet becomes the first head piece. The alternative is armour as plain numbers with no cost.

**F7. The inventory screen.** My pick grows PR #150's pack panel (I) into a paper doll beside the pack:
- the eight slots on the left
- the pack on the right, holding 8 things in all, finds and spare items together
- E on a pack item equips it or swaps it in
- the chosen item compared with the one it replaces

Equipped items don't use pack room. There is no grid and no weight. The alternative is a Diablo-style grid with item sizes.

**F8. Death and the corpse.** My pick follows D13: the dead grandchild's gear lies on the corpse, and scavengers and goblins take it and use it against the next grandchild, so killing them gets it back. This is built last. The alternative is that gear simply vanishes.

## Who makes what

- The **Props in Blender** thread makes held models: weapons, wands, shields. The humanoid's garment shells make worn armour, and the Wardrobe hook dresses it in `src/render/humans/wardrobe.ts`.
- **Polished UI** owns the look. The panel reuses `Modal`, theme.ts and growth.ts.
- **Sound** is asked for the hit and equip sounds of each weapon type.

## Build order (one PR each)

0. Pack panel and 8-find limit: PR #150, merge as it is.
1. Items as data (`src/loot/items.ts`): bases, quality and depth tier, all seeded. Equipment slots, the paper doll in the pack panel, and equipping. Saved with the grandchild.
2. Armour on the body through the Wardrobe hook, and armour in the damage seam. Kemal's helmet and gloves become items.
3. Weapon types with their movesets and animations: hatchet, pick and crowbar first. Every move gets a visible animation, per the gameplay rules.
4. Foci (wands) that strengthen card chapters, shown in the tin and on the bar.
5. Sources: Kemal's new stock, shed and floor tools, humanoid foes dropping what they hold, deep halls below level 10.
6. Corpse gear looted and used by denizens (D13).
