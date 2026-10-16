# Floating islands

- The third alien style for the deep (61 on): the floor gives way to round drops with no bottom in sight, and in each one flat-topped islands hang in the void, tapering beneath like mountains turned over, mossy on top and lit by tufts of glowing lichen.
- Natural arches join every island to the rim or to another island, so all of them can be walked to; a walk over the drops is a test that every island is reached.
- Step off the edge and you fall into the dark: you come back where you last stood, hurt by the fall (25 health) but never killed by it.
- Creatures never step off an island or the rim.
- Ground over a void is found by stepping down from above: `level.groundAt(x, z, from)` gives the first rock under a height. Walkers, pets, thrown things and spells pass their own height, so something under an island stands on what is under it, not on the island's top.
- A level with a void has no water table over it: it drains into the drops.
- Genes: drop size, islands per drop, island size and how far apart their heights lie.
