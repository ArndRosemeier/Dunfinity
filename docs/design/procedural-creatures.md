# Procedural creatures

Arnd (2026-10-16, after a playtest): more strangeness from the start; creatures that feel strange but
believable; a lot of variety, not one form with other sizes and colours; ideally the whole skeleton
procedural. And: not everything that moves is hostile, some creatures are there for wonder.

This is step 7 of [generative-depth.md](generative-depth.md) (runtime body plans), built on Norgo's
creature generator (Arnd's own world), ported and pushed further.

## 1. The pipeline

`Species` → `Anatomy` → `Flesh` → a skinned figure → `CritterRig`, all pure functions of a seed.

| Step | File | What it is |
|---|---|---|
| Species | `src/creatures/bestiary.ts` | The genome: body plan, role, sizes, head, limbs, tail, dorsal, skin, colours, gait, speeds, oddities. `bestiaryOf(seed, depth)` is a level's fauna. |
| Anatomy | `src/creatures/anatomy.ts` | A rest skeleton (bones, identity rotations) and the flesh as primitives (round cones, ellipsoids, rounded boxes) bound to bones; eyes, legs, chains. |
| Flesh | `src/creatures/flesh.ts` | The primitives blended (smooth-min) into one surface, meshed by surface nets; soft skin weights; the coat painted per vertex (pattern, countershading, horn, shell, glow, folds' shade). About 100 ms a species. |
| Material | `src/render/materials.ts` `CRITTER`, `CRITTER_EYE` | One kind for every species: the integument's fine grain (fur, hide, scales, chitin, slime, stone) from a per-vertex `look`; glow pulses; see-through skin; a red hurt flash. Eyes with iris, pupil and eyeshine. |
| Figure | `src/render/creatures/critterView.ts` | The SkinnedMesh with its own skeleton, padded to `CRITTER_BONES` (96). |
| Rig | `src/render/creatures/critterRig.ts` | Every pose computed per frame: gaits, planted IK feet, body following the ground, spine sway, spring tails, feelers and tentacles, the head watching, actions. |

## 2. The body-plan grammar

Ten plans: quadruped, biped, hexapod, octopod, crab, myriapod, serpent, slug, radial (a walking star)
and floater (a bell with tentacles). Each plan has its own skeleton builder, and every part inside it
varies: spine segments and arch, neck length and segments, head shape (snout, jaw, horns, ears, eye
count and placement, feelers, eye stalks, a lure), limb count, joints (plantigrade, digitigrade,
sprawling, insect), feet (paw, hoof, claw, pad, point), tail length and tip (club, sting, tuft, spikes,
lure), dorsal plates, spines or a shell. So two species of one plan differ in their bones, not only in
their sizes.

**Roles** choose the plan and the size: peaceful ones (scuttler, grazer, floater, giant, watcher) and
hostile ones (hunter, lurker, swarmer, brute).

**Oddities** are how strangeness shows: each species has a budget from the level's strangeness and
buys deviations from a coherent base (many eyes, eye stalks, blind, extra legs, one big claw, a lure,
see-through skin, a long neck, a big or tiny head, spines, a shell, feelers, glowing, odd colours,
stilts, a scorpion tail). A coherent animal with two or three odd things reads as strange but real; a
pile of random parts reads as noise.

Strangeness here starts above zero at level 1 (`0.35 + strangeness × 0.9`), as Arnd asked; the
world's own strangeness curve stays with the generative-depth plan.

## 3. Believability

- Bilateral symmetry always; radial only for the radial plans.
- Leg thickness grows faster than length with mass (a giant's legs are pillars, a scuttler's are
  threads).
- Speeds from leg length (walk at Froude number 0.25, run at 2), so small things patter and big
  things lumber; the gait follows the leg count (walk, trot, gallop, bound, a biped's stride, an
  insect's alternating tripod, waves along many legs).
- Muscle under the skin: haunches, a neck, a ribcage, brow and cheeks, knuckles at the joints.
- Countershading (a pale belly), ambient occlusion in the folds, the fine grain of its skin.
- Feet stay planted where they stand on the real ground; the body pitches and rolls with the feet.
- Nothing jitters: every follower is a damped spring or an eased blend.
- Every action winds up before it strikes (the rule that every action is seen).

## 4. Shaders

One `CRITTER` kind and one `CRITTER_EYE` kind for every species, compiled once in the warm-up. A
species is data in vertex attributes, never a new shader. Skinning shaders are keyed by bone count,
so every skeleton is padded to 96 bones.

## 5. Fit with genes and kin

- The bestiary is a function of (seed, depth): the hand-made kin (src/creatures/kin.ts) stay our
  world's animals, dressed per level. Procedural species are the other inhabitants.
- From level 11 a stratum keeps its fauna, so a world's creatures are consistent across its levels.
- Later, a stratum's genes (src/gen/genes.ts) can push the bestiary's knobs (eye count, leg count,
  skin) so a world's fauna shares a family resemblance.

## 6. Peaceful creatures

Arnd's picks (2026-10-16):
- Procedural species live from level 1: peaceful ones (rare and mild on levels 1 to 10) and hunters
  too, as long as a hunter's power fits its level (Arnd's correction: not all of them are peaceful).
  The hand-made foes stay.
- Sizes vary widely; now and then a colossus, a slow peaceful grazer some ten metres long.
- Fighting power scales with size, so attacking a colossus is suicide.
- Every creature retaliates when attacked, or flees if the fight is hopeless.
- Colourful: many species wear a colour scheme (a warning's black and yellow, complements,
  neighbouring hues, jewel tones, cave-fish pastels, one loud mark on an earth body), not one tint.


Most of what moves should not attack. Peaceful species graze, scuttle, drift and watch: they flee
from the player, follow each other in herds, or look at the lamp and keep their distance. They are for
wonder and for a living cave. (The light wisps from glowing rock are a separate thread.)

The hunting ones (hunter, lurker, swarmer, brute) take a share of the dens (about a third on levels 1
to 10, more deeper). They are grown to a fair fight for their level (`fitSize` in
src/creatures/critters.ts): a pack member's health is 12 + 2.5 per level, times its role's share (a
swarmer 0.35, a lurker 1.4, a brute 3), and its size follows from that, so power is still size. They
stalk you, at most two of a pack strike at once, each blow has a wind-up before the lunge (or the
brute's slam), and after it they spring back. A lurker lies still until you are nearly on it. Badly
hurt, they run.

## 7. Rollout, one PR each

1. Generator, mesher, material, rig and the Lab's `?critters` lineup (no gameplay).
2. Peaceful ambient species in the levels: graze, flee, drift, herd, watch.
3. Hostile species with templated actions (bite, lunge, sting, slam, pinch) wired into combat.
4. Floaters and fliers, giants.
5. Crossings with our own animals (kin), bosses.

Meshing moves into a worker when species are built during play.
