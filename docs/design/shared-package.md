# Dunfinity: shared package in AssetGenerator (plan)

Status: **draft 1, for discussion, no code.** Part of [dunfinity-plan.md](dunfinity-plan.md) (decision D5, gap G14).

Arnd's call: shared code lives in **AssetGenerator**, brought up to date. The parts tied to his own 3D engine are not used and will be retired later.

---

## 1. What AssetGenerator is today

- **Python + headless Blender** asset pipeline: JSON specs in `assets/specs/` → QA-gated `.glb` + previews (`tools/ag.py`).
- **Rust viewer** (`viewer/`, Cargo workspace depending on `../Engine`): to be retired.
- **Godot Character Studio** with MPFB humans (`character_studio/`, `assets/humans/`): a third human route, not the one we use.
- **Monster packs:** Quaternius Ultimate Monsters (50, CC0), KayKit skeletons.
- **Modular dungeon tiles:** `tools/emit_tall_dungeon.py` and `cave_profile.py` bake floor/rise/vault tiles for a tile catalog in the `Modular` repo. That's a tile grammar, exactly what the level-generator decisions moved away from, so it isn't reused for levels. The Blender pipeline itself is still useful for props (mine carts, lifts, headframes, doors, furniture).
- **No TypeScript, no npm.**

---

## 2. Target layout

Add a TypeScript half next to what exists. Don't move the Python tools (no churn for nothing).

```
AssetGenerator/
  assets/ tools/ blender/ ...      existing Python/Blender pipeline (unchanged)
  pipeline/
    humans/                        build-human-assets.ts, conform.py, make_male.py, mh-dump.ts (from Scale)
    anim/                          build-anim-clips.ts, cmu-bvh (from Scale)
    audio/                         synth*.mjs, sfx/seed.py, screen.py (from Scale)
  packages/                        npm workspaces (root package.json: "workspaces": ["packages/*"])
    core/        @futuremagic/core       rng/deriveSeed, noise, math, geom2, heap, budgets, WorkerPool
    humanoid/    @futuremagic/humanoid   bodies, races, parts, garment shells, animator, avatar import + assets
    gameplay/    @futuremagic/gameplay   (later) Norgo's ability ops, effects, items, loot
    ragdoll/     @futuremagic/ragdoll    (later) behind a small physics adapter
  viewer/ character_studio/        legacy, retire later
```

The root `package.json` sits beside `Cargo.toml` and `pyproject.toml` without interfering.

---

## 3. How Dunfinity consumes it

| Option | How | Verdict |
|---|---|---|
| **A. Git submodule + `file:` links** | Dunfinity has `vendor/assetgenerator` as a submodule pinned to a commit; `package.json` uses `"@futuremagic/humanoid": "file:vendor/assetgenerator/packages/humanoid"` | **My pick.** Pinned, reproducible, works in cloud sessions and on Arnd's machine, and editing the shared code from inside Dunfinity is easy |
| B. GitHub Packages registry | Publish versions, install normally | Cleaner versioning, but needs auth tokens everywhere and a publish step for every change |
| C. npm git dependency | `github:ArndRosemeier/AssetGenerator` | npm can't install a subfolder of a monorepo from git: doesn't work well |

**Ship TypeScript source, not built JS.** Vite and `tsc` in Dunfinity compile it directly. No build step in the package, so source maps and go-to-definition work.

**Assets** (`human.bin` 5.7 MB, `conform.bin`, `clips.bin`): live in `packages/humanoid/assets/` and are served through a tiny Vite plugin (or copied into `public/` by a script). The package takes a base URL for them so the host decides where they live.

---

## 4. What moves first (milestone 1 needs only these)

### `@futuremagic/core` (≈1.4k LOC, from Scale `src/core`)
Trivial. Note: Scale, Norgo and Xenoworld each have their own rng; we take **Scale's** (`deriveSeed(seed, 'path', ...)`) and that becomes the house standard.

### `@futuremagic/humanoid` (≈11.9k LOC, from Scale `src/humanoid` + `src/avatar` + `items/types`/`wearable`)
- Coupling is low. Outside `core`, the humanoid imports only four tiny render helpers: `skyOcclusion` (84 LOC), `gpuMode` (23), `color` (12), `skinIndex` (19), plus `shared/types`.
  - `color` and `skinIndex` move in as is.
  - `gpuMode` becomes an option passed in (WebGL2 or WebGPU).
  - `skyOcclusion` is city-specific shading; it becomes an optional hook (Dunfinity will pass its own cave-light function).
- `streetwear.ts` and `wardrobe.ts` stay in Scale. The package keeps the **garment-shell system** and a neutral wardrobe API; Dunfinity defines its own gear (and grandchildren's everyday clothes).
- Base: **Scale's** humanoid (newer: conform bodies, animator improvements), not Norgo's.
- Licence notes go with the assets: `conform.bin` is CC BY 3.0 (Bananaboy), the rest CC0 / CMU.

### Later
- `@futuremagic/gameplay`: Norgo's `gameplay/data` (abilities, effects), op runner, items and loot, when the recipe box is built. Needs a slim context interface instead of Norgo's `ServerContext`.
- `@futuremagic/ragdoll`: Scale's ragdoll imports Pedestrians, Player and the ground model; it needs a physics adapter interface first.
- Audio pipeline tools: whenever we make Dunfinity's sounds.

---

## 5. Rules

1. **Extract on demand.** Only what Dunfinity uses, when it starts using it.
2. **Scale and Norgo are not migrated** as part of this. They keep their copies; switching them over later is a separate decision.
3. **Pinned versions.** Dunfinity bumps the submodule commit deliberately, never "latest".
4. **Headless tests travel with the code** (a subset of Scale's harness: body build determinism, asset loading, animator smoke test).
5. **No engine code:** nothing in `packages/` may import from the Rust/Engine side.

---

## 6. Questions

1. **Submodule + `file:` links (my pick)**, or a package registry?
2. **Rename the repo?** "AssetGenerator" will now hold runtime code too. Keeping the name is fine; something like `futuremagic-kit` would describe it better. I have no strong opinion.
3. **Scope prefix:** `@futuremagic/...` (matches your app host), or another?
