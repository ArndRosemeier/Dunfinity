# Working on Dunfinity

1. **Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the seam index) before writing any helper.** Use the one way it names. A new seam gets its row in the same PR. If a second way to do a listed thing seems needed, stop and report it instead of writing it.
2. **Shaders follow [docs/SHADERS.md](docs/SHADERS.md):** materials only from `src/render/materials.ts`, things enter the scene through `stage.add`, no `onBeforeCompile`, no `renderer.compile*` outside the Stage.
3. **No `Math.random`.** Every random number comes from a seed (`Rng`, `deriveSeed`).
4. **Every PR description has a `COPIES:` line** ([no-duplicates.md](docs/design/no-duplicates.md) layer 4): `COPIES: 1 — checked (grepped: ...)` or `COPIES: 3→1 — <seam>`.
5. **`npm test` must be green.** It runs the guards: banned patterns, layer boundaries and the duplication ratchet. A `NEW` duplication finding means fold the copy into one seam, or list it in `tools/guards/duplication-baseline.json` with a reason. A `STALE` one means delete its baseline line.
6. **Every ~10 PRs, a sweep:** run both finders (`npm run dup`, `npm run repeated -- --min-info 0 --clone-floor 0.6`; reports land in `reports/`), read for concept duplicates, fold what is worth folding.
7. **Each PR bumps the version** in `CHANGELOG.md` (v0.001, v0.002, ...).

Design: [docs/design/](docs/design/) (the main plan is `dunfinity-plan.md`).

Checks that need a browser: `npm run build`, then `npm run check:shaders` and `npm run shot -- "?seed=1&gl" out.png`. In the cloud container set `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and use `?gl` (headless WebGPU fails in three r186 there).
