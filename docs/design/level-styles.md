# Level styles: many kinds of place in one level

Arnd, 2026-10-15: "The overall layout of all the levels looks same-ish." It does, for a plain reason. There is one generator, the excavation field (`src/gen/quarry.ts`: Voronoi workings with pillar grids), and every band only turns its knobs (`src/gen/bands.ts`). This doc replaces "one field, many looks" with **many styles, mixed per level**. It is the "formation processes" of [level-generator.md](level-generator.md) §3, made concrete.

Arnd's sketch: `GenerateLevel(dimensions, styles[], weights[])`. A style is a contract that can be implemented, a level can hold several, and the weights say how much of the level each one gets. New styles can be added as we go, so going arbitrarily deep becomes possible. His two requirements:

1. The volume filler has to be **seriously robust**.
2. There has to be a **contract for style edges**, so that where two styles meet it looks natural.

---

## 1. The pieces

```
Level(seed, depth)
  └─ mix = mixOf(seed, depth)          // [{ style, weight }], from the band (1–10) or the stratum genome (deeper)
  └─ regions = RegionMap(seed, mix)    // which style owns each point, and the edge between them
  └─ field = StyledField(regions)      // the one SDF everything reads (bodies, creatures, meshes, props)
```

- **Style.** A pure, worker-safe implementation of one kind of place: excavation halls, karst, rift, collapse, lava tube, crystal, and later the alien ones. It is never "props only": a style owns the *shape* of its rock first, then its colour, props, lights, water and which creatures live there.
- **Mix.** The styles of a level and their weights. Levels 1–10 take theirs from the band table. Deeper, the stratum genome draws them (`deriveSeed`), so an infinite world never runs out.
- **Region map.** A slow, seeded partition of the plane into regions, a few hundred metres across. Each region gets one style, chosen by weight, so over a level each style covers about its weight's share of the area. It answers `regionsNear(x, z)`: the owning style, the distance to the nearest edge, and every neighbouring region within the edge band, each with its blend distance. This is the same exact, three-way-corner-safe neighbour scan `workingsNear` already does for workings (v0.066).
- **Styled field.** For a point it asks the region map which styles are near, asks each of them, and blends the answers under the edge contract (§2). Inside a region, away from edges, it is exactly that style's field and costs exactly that style's time.

## 2. The edge contract

Two styles never just meet. Where regions touch, there is an **edge band** of width `E` (start at 40 m) on both sides of the border. Inside it, the styled field follows these rules. A new style is accepted only if it keeps them, and the tests in §4 check them for every pair of styles.

**E1. Shared envelope.** Every style reports, per column, an *envelope*: a floor height and a ceiling height, its idea of where the walkable ground and the roof are. In the edge band, the styled floor and ceiling are the weighted blend of the neighbours' envelopes, with weights that come in and go out smoothly (as the workings' blend does now). So floors ramp from one style's height to the other's. No cliffs, no steps that jump at a border.

**E2. Shape fades, it does not switch.** Each style's own 3D detail (pillars, scallops, ribs, crystals, breakdown blocks) is multiplied by that style's weight. Detail fades out towards the border instead of being cut through. A pillar is never sliced in half by an edge, because it is either whole inside the core or not there. Where both weights are near ½, what is left is the blended envelope plus **edge rock**: a shared transition material (rough, natural, fractured stone) that both styles accept. Real geology looks like that too, since a mine breaking into a cave goes through broken rock.

**E3. Passable edges.** An edge is a place, not a wall. Along every border, openings are guaranteed at least every `G` metres of border (start at 60 m). Each is at least 4 m wide and 3 m high, with a floor slope you can walk. A backbone of passages between region centres (level-generator.md §3, connectivity) crosses edges only through these openings. Between openings, edges may be solid rock, with ledges and climbable faces.

**E4. Bounded field.** The blended SDF stays inside the Lipschitz bound that bodies, sphere tracing and chunk skipping rely on (`LIPSCHITZ` = 1.6 in `chunkMesh.ts`). Each style must be ≤ 1.3 on its own. The blend's extra term, `|dA − dB| · |∇w|`, is held under 0.3 by clamping how far two styles' fields may disagree in the band (they are pulled towards the envelope first) and by the band's width.

**E5. Ownership of things.** Props, dens, lamps and landmarks belong to one style. A style places them only where its weight is ≥ 0.9, never in the blend. The edge band gets its own *edge props*: fallen blocks, rubble and the miners' timbering where a mine meets a cave. Colour blends by weight. Water is one table for the level, not per style.

**E6. Same everywhere.** Everything is a pure function of (seed, depth, x, y, z). The same point gives the same answer in any worker, in any order, at any chunk boundary.

### 2a. As built (v0.074)

What the code does, where it differs from the plan above:

- **Regions** (`src/gen/regions.ts`): jittered Voronoi cells about 360 m across (the same scan as the workings, `src/gen/voronoi.ts`). Each gets a style by weight; the region round the origin, where one arrives and the way up is, is always the mix's first style. The edge band is 80 m (blend distance) on each side. A style's *share* at a point is the sum of its regions' blend shares, and every nearby region counts, so the shares are symmetric across a border.
- **Weights** (`StyledField.weigh`): a style with a share of at most 1 − `SHARE_OWN` (0.1) gets no weight in the field, the others split the rest. So wherever a style owns a point (E5), the field there is exactly its own, and its ladders, shafts and pillars fit it.
- **E1** as planned: floor and ceiling are blended by weight and every style then answers with that envelope.
- **E2**: the field is the weighted sum of the styles' answers, each clamped to ±*k*. *k* is 4 m on a border and grows 1 m per metre of blend distance away from it, on every column of a multi-style level, so it never jumps. No separate edge rock yet: the blend of the two rocks and colours reads as a transition.
- **E3**: one passage per border, not openings every 60 m. Between two regions of different styles, a polyline runs from a portal in one (`Style.portal`: the karst gives its nearest chamber, the excavation the point itself) through the middle of their border to a portal in the other. Along it the field is at least an arched tunnel 10 m wide, 3 m high at the walls and 5.5 m in the middle.
- **E4**: the clamp keeps the blend 1-Lipschitz. Measured: edges are no steeper than the styles' own insides (p99 and p99.9 of the slope).
- **E5**: `owns(style, x, z)` is the one test. Pillars, the miners' props and lamps, ways down and the way up all use it. Karst things will too.
- Tests: `test/styles.test.ts` holds every mixed band to all of this.
- **Mixes** (v0.092, step 6): every band of levels 1–10 is a mix (`src/gen/bands.ts`), and `mixOf(seed, depth)` scales each weight by up to √2 either way per level, so no two levels of a band are alike. A region's style is a weighted race (`-ln(u) / w`, salted by the style's id), so adding a style to a mix does not reshuffle the regions of the others. The home ground is every region whose feature point is within 520 m of the origin: the arrival, its way up and the first ways down stay the first style's. The spawn needs a point the excavation owns. Ways down are the excavation's own, so `Descents` makes a cell of it likelier to hold one where the excavation is a small share of the mix (down to 0.2): a mostly-caves level has as many ways down near you as a quarry.
- **Stratum genome** (step 7): below level 10, `src/gen/genome.ts`. A run of levels is a stratum (11–20 the Ossuaries, 21–40 the Old Halls, 41–60 Before People, then one every ten levels, "the Deep"). Each has a palette of styles with affinities; a world (seed) draws 3–5 of them by affinity, weights × 0.5–1.5, the workings a fixed share of the whole (0.25 falling to 0.12) so one always arrives in them and ways down exist. Every level of the stratum shares that genome and leans its own way through `mixOf`. Dungeon rooms are capped at a quarter of the other styles. From 61 every style is in the palette. A new style joins a stratum's palette (and `ALL` for the Deep). The deep bands are the Threshold's numbers under the stratum's name.
- **Adding a style** (v0.075): a file implementing `Style`, its id in `StyleId`, one entry in `src/gen/styles.ts`, a share in a band's mix, a level with it in `MIXED` in `test/styles.test.ts`. `?style=<id>` makes every level that style but for the arrival's region, to look at it in the game or the Lab.

## 3. The style contract (TypeScript sketch)

```ts
interface Style {
  readonly id: StyleId;                       // 'excavation' | 'karst' | 'rift' | 'collapse' | ...
  /** Per column (y-independent): its envelope, plus whatever private data it needs (into its own column object). */
  column(x: number, z: number, out: StyleColumn): StyleColumn;   // out.floor, out.ceiling are the envelope (E1)
  /** Signed distance at height y in a column it filled, positive in air: its own detail, unscaled (the field applies E2). */
  detail(col: StyleColumn, x: number, y: number, z: number): number;
  /** Rock colour at a surface point. */
  color(col: StyleColumn, x: number, y: number, z: number, out: Float32Array, o: number): void;
  /** Its props, lamps and blockers for a props tile, only where its weight ≥ 0.9 (E5). */
  props(tile: PropTileBuilder, weightAt: (x: number, z: number) => number): void;
  /** Creature chances per den cell, ways down and other gameplay knobs, as data. */
  readonly life: StyleLife;
}
```

Today's `QuarryField` becomes the first style, `excavation`, unchanged in look. Its `Working` and pillar grid stay its own business. Code that asks about workings (props, descents) goes through the style that owns the point.

## 4. Robustness: what the tests hold every style and every pair to

Each style runs the suite alone and in an edge with every other style, over many seeds:

- **Continuity:** neighbouring samples differ by at most `LIPSCHITZ · distance`, across region edges and three-way corners included (sampled densely along borders).
- **Walkable edges:** at every guaranteed opening (E3), a body walks from one region's core into the other's (the `Body` simulation already used by the climb tests).
- **No hidden walls:** along any straight line across an edge band, the floor never rises more than a climbable step without rock showing (the v0.066 invisible-wall bug, as a test).
- **Connectivity:** from the arrival, the region centres within 1 km and the ways down are reachable by the backbone.
- **Headroom and floors:** arrival, descents, camps and dens stand on dry floor with headroom, in whatever style they fall.
- **No missing surfaces:** chunk skipping never skips a chunk with surface in it (the v0.066 probe, for every style).
- **Budget:** a column costs at most twice the excavation style's time, so streaming keeps up.
- **Variety:** each style's own signature measures differently from the others (ceiling height, openness, floor roughness, wall curvature). The tests assert that, so two styles can't quietly converge.

## 5. Order of work (one PR each)

1. **Excavation becomes a style.** `Style` contract, `StyledField` with one style, and the region map with one region kind. Byte-identical SDF on sampled points (a golden test), no visible change.
2. **Region map and edges.** Weighted regions, the edge band, E1–E6, the robustness suite, and a debug overlay on the map (M) showing regions.
3. **Karst.** Smooth dissolved tubes and big domed chambers, scalloped walls, sinkholes.
4. **Rift.** Tall, narrow canyons kilometres long, ledges along both walls, chockstones.
5. **Collapse.** Huge chambers, hills of breakdown blocks, broken ceilings.
6. **Real mixes for levels 1–10.** For example: the Quarry mostly excavation with some collapse; the Salt Works excavation and collapse; the Cisterns excavation and karst; the Threshold mostly karst and rift with a little excavation. Then the stratum genome draws the mixes below.
