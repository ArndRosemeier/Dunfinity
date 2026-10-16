# Rock types become recipes

- The rock shader no longer hard-codes its eight kinds of stone: each is now a recipe of sixteen numbers (colours, beds, laminae, veins and how they glow, crystals, cleavage, salt) loaded into eight slots per level, so a level can carry any stone without a new shader.
- Today's eight rock types are the eight presets and look the same as before (a side-by-side check of four long walls differs by at most 1 in 255 per pixel).
