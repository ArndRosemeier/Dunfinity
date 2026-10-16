# The interface: one look, grown over

Arnd, 2026-10-16: the alpha needs a polished UI, and its design language is organic: the slow blue salt veins of the rock, with a little green, creeping over the interface.

## The look

Everything drawn in the DOM uses `src/app/theme.ts` and nothing else for colour and type (docs/ARCHITECTURE.md, the theme row):

- **Two surfaces.** The lamp-lit dark (`ui-panel`) for the HUD, menus, What's new; paper (`ui-paper`) for what is read in the world: grandma's tin and diary, inscriptions, letters.
- **Type.** IM Fell English for titles and display (an old printed hand, the notary's and the diary's world), Alegreya on paper, Alegreya Sans for the interface. Self-hosted through `@fontsource` (OFL), latin subset.
- **Colour.** One accent, lamp gold (`--ui-accent`), for what is chosen, on or ready. Salt blue (`--ui-salt`) for grandma's magic and what it buys. Blood (`--ui-blood`) for health and harm, a dull gold for stamina. Paper inks: brown, red for refusals, blue for salt.
- **Keys** are keycaps (`keycap('E')`), never "E:" in text.

## The growth

`growOn(frame, name)` grows salt over an element (`src/app/growth.ts`):

- Thin veins along the frame, wandering mostly outwards, thinner towards the tip, with curls off them and glowing buds; moss gathered in a corner.
- **Never over text**: the growth stays on the frame, a few pixels in over the border at most.
- **Very slow**: it grows in over a few seconds when a panel opens; then a tip creeps out and back over 45 to 100 seconds and a glint of light runs along a vein now and then.
- **Cheap**: one small SVG per element, shaped once from a seed (the element's name), moved by CSS only.
- **Deeper, thicker**: `setGrowth(growthAt(depth))` (the game calls it on each level) from a little in grandma's cellar to thick by level 40.
- **Still** under `prefers-reduced-motion`, or with the class `ui-still` on the root element (a settings switch can set it).

The title screen and the introduction grow the same way: call `growOn` on their frames and buttons, and take colours and fonts from the theme.
