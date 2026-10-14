# Dunfinity

A procedural roguelike dungeon crawler for the browser. Every level stretches forever sideways and there is always a level below. You start as a nobody with a kitchen knife.

Right now you can walk, climb and swim through the first band of levels (the Quarry) as the nobody. The **Level Lab** (`?lab`) is a free-fly viewer for the level generator. The design is in [docs/design/](docs/design/), starting with [dunfinity-plan.md](docs/design/dunfinity-plan.md).

## Run it

```sh
git clone --recurse-submodules https://github.com/ArndRosemeier/dunfinity
cd dunfinity
npm install
npm run dev        # http://localhost:5190
```

Already cloned without submodules: `git submodule update --init`.

### Playing

Click to capture the mouse. WASD to move, Shift to run, Space to jump. Walk into rock to climb it: any rock, as long as your stamina lasts (overhangs excepted). Water deeper than your chest is swum. Long drops hurt, and a death is final: the next grandchild takes the next knife (R). Mouse wheel zooms out, or in to first person. F switches between the dark and a lit survey view.

### URL parameters

| Parameter | Meaning |
|---|---|
| `lab` | Open the Level Lab (free fly) instead of the game |
| `seed=` | World seed, a number or any text (`?seed=grandma`) |
| `depth=` | Level depth, 1 and up |
| `pos=x,y,z` | Start position (default: in a grand hall near the origin) |
| `look=yaw,pitch` | Start view direction in degrees |
| `color=` | Lab: `rock`, `working` (each working its own colour) or `lod` (detail level) |
| `dark` | Lab: start in headlamp darkness, lit by the headlamp and the miners' lamps |
| `light` | Game: start in the lit survey view |
| `gl` | Force the WebGL 2 backend instead of WebGPU |

Lab controls: click for mouse look, WASD to move, Space and C for up and down, Shift for fast, mouse wheel for speed, V to cycle colours, F to switch between the survey view and headlamp darkness.

## Checks

```sh
npm test                 # unit tests and code guards
npm run build            # typecheck and production build
npm run check:shaders    # shader policy in headless Chromium (after build)
npm run shot -- "?seed=1&gl" out.png   # headless screenshot (add &lab for the Lab)
```

## Rules for contributors (human or AI)

[CLAUDE.md](CLAUDE.md): the seam index, the shader policy, and the duplication guards.
