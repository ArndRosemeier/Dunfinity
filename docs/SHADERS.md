# Shader policy

Shader compiles are the worst kind of stutter: the frame waits for a driver. Scale fought this for a long time and ended with strict rules. Dunfinity has them from the first commit.

## The rules

1. **Each shader compile blocks for under 100 ms.**
2. **After the loading screen, at most 5 new shaders per second, at least 200 ms apart, and at most one per frame.**
3. **Nothing compiles on the render path.** An object enters the scene only after its shaders are ready.

So even in the worst case, shaders take at most half of any stretch of time, and the game never freezes.

## How the code keeps them

| Piece | File | What it does |
|---|---|---|
| Material registry | `src/render/materials.ts` | Every material is a *kind* from a closed list, and every mesh of a kind shares one material. So the set of shaders is known up front. Variation goes in vertex attributes or uniforms, never in a new material. |
| Stage | `src/render/stage.ts` | `warmUp()` renders one frame and compiles every kind against the real scene (lights, fog, render target) behind the loading screen. Then the cap switches on. `add(obj)` compiles the object first (including when it is outside the view) and only then puts it into the scene. |
| Cap | `src/render/shaders/cap.ts` | Hands out build slots: ≤ 5 per second, ≥ 200 ms apart, one per frame. Off during warm-up. |
| Renderer hooks | `src/render/shaders/patches.ts` | The safety net, on three r186 internals: async node builds queue one at a time behind the cap; a draw pipeline nobody compiled is created async and the object skipped until it is ready; no per-frame buffer uploads; GPU compile and link costs are timed. A hook that cannot be installed is listed in the Lab HUD. |
| Monitor | `src/render/shaders/monitor.ts` | Records every build. `shaders.report()` in the browser console lists breaches; the Lab HUD shows a summary. |

## What you must do

- **A new look is a new kind** in `materials.ts`, with the attributes its meshes carry. Meshes of a kind are indexed and carry exactly those attributes: the attribute set and the index are part of the shader's cache key, so a mismatch means a second shader nobody warmed.
- **Lights are fixed before the warm-up.** The number of lights is part of every shader's cache key. Moving lights (lamps) come from the fixed pool in `src/render/props/lamps.ts`; an unused light stays in the scene at intensity 0 (hiding it would change the key). Their *order* is part of the key too (three hashes lights in the order the scene is walked): never move a light to another parent after the warm-up; move the light itself (the headlamp rides on the camera and is placed where it is carried, `LevelView.carrier`). Whether a light casts shadows and whether a mesh receives them are in the key as well: shadow flags come with the material kind (`kind.shadow`), and the warm-up draws a few real frames so the shadow pass's own shaders are built then.
- **Put things into the scene with `stage.add`**, or `stage.prepare` first when you add them to a group of your own (the terrain does this), never plain `scene.add` for anything drawn with a new material or geometry layout.
- **Humans are the one exception to the registry.** `@futuremagic/humanoid` makes their node materials (skin, eyes, hair, garments), sharing one graph per kind between characters. A human is built before the warm-up and handed to `stage.warmUp(extra)`, which compiles it against the real scene; it is added with `stage.add` afterwards (a cache hit). Its hidden parts (the far detail levels) are never shown, so they are never compiled.
- **Never** construct a material outside `materials.ts`, use `onBeforeCompile`, or call `renderer.compile*` outside the Stage. `npm test` fails on all three (`tools/guards/rules.json`).

## How it is checked

- `npm test`: the cap and the monitor (unit tests with a fake clock) and the guard rules.
- `npm run check:shaders` (after `npm run build`), in headless Chromium:
  1. **Steady state:** after warm-up, a fly-through builds zero shaders.
  2. **Cap:** eight new shader variants requested at once are built one at a time, ≥ 200 ms apart, ≤ 5 per second, each under 100 ms.
  3. **Game:** after its warm-up, the first seconds of play build zero shaders.

It is not part of CI (too slow in SwiftShader): run it on demand, every so often and after render changes, with Actions → **Shaders** → Run workflow (any branch), and fix what it finds. That workflow runs the Lab half (1, 2) and the game half (3) side by side (`-- lab`, `-- game`). Locally, `--no-cap` leaves out 2, the slowest part, when the Stage and the shader hooks are untouched.

The check runs on the WebGL 2 backend with SwiftShader (no GPU in CI). Headless WebGPU in Chromium 1194 fails inside three r186 (`createView` swizzle), so the WebGPU path is checked by hand in a real browser for now: open the Lab and look at the HUD line.

## Lessons from Scale this is built on

- Warm-up must compile against the *real* scene and render target. A shader's cache key includes lights, fog, the render context and the geometry layout, so a warm-up against a different setup warms nothing.
- `compileAsync` skips objects outside the view. They then compile on the render path the first time the camera turns. The Stage turns culling off while compiling.
- Pipelines are a separate cost from the shader source. They need their own async path.
