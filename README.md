# Dunfinity

A procedural roguelike dungeon crawler for the browser. Every level stretches forever sideways and there is always a level below. You start as a nobody with a kitchen knife.

Right now the repository holds the **Level Lab**: a free-fly viewer for the level generator, with the first band of levels (the Quarry). The design is in [docs/design/](docs/design/), starting with [dunfinity-plan.md](docs/design/dunfinity-plan.md).

## Run it

```sh
git clone --recurse-submodules https://github.com/ArndRosemeier/dunfinity
cd dunfinity
npm install
npm run dev        # http://localhost:5190
```

Already cloned without submodules: `git submodule update --init`.

### Lab URL parameters

| Parameter | Meaning |
|---|---|
| `seed=` | World seed, a number or any text (`?seed=grandma`) |
| `depth=` | Level depth, 1 and up |
| `pos=x,y,z` | Start position of the camera (default: in a grand hall near the origin) |
| `look=yaw,pitch` | Start view direction in degrees |
| `color=` | `rock`, `working` (each working its own colour) or `lod` (detail level) |
| `gl` | Force the WebGL 2 backend instead of WebGPU |

Controls: click for mouse look, WASD to move, Space and C for up and down, Shift for fast, mouse wheel for speed, V to cycle colours, F to switch between survey fog and headlamp darkness.

## Checks

```sh
npm test                 # unit tests and code guards
npm run build            # typecheck and production build
npm run check:shaders    # shader policy in headless Chromium (after build)
npm run shot -- "?seed=1&gl" out.png   # headless screenshot
```

## Rules for contributors (human or AI)

[CLAUDE.md](CLAUDE.md): the seam index, the shader policy, and the duplication guards.
