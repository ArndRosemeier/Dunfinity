# Rift genes

- The rift now reads six genes for its level: how far apart its faults lie, how wide and how tall its canyons are, how far their walls lean, and how many ledges and wedged boulders they have. Deep strata may push them far (canyons twice as wide or half as tall, faults crowded or far apart), the same way on every level of a stratum.
- The genes test (`test/styleGenes.test.ts`) now judges a style's slope by its 99.9th percentile, since a style's own roughness makes the very steepest probe a matter of luck.
