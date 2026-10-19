# Working on Dunfinity

1. **Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the seam index) before writing any helper.** Use the one way it names. A new seam gets its row in the same PR. If a second way to do a listed thing seems needed, stop and report it instead of writing it.
2. **Shaders follow [docs/SHADERS.md](docs/SHADERS.md):** materials only from `src/render/materials.ts`, things enter the scene through `stage.add`, no `onBeforeCompile`, no `renderer.compile*` outside the Stage.
3. **No `Math.random`.** Every random number comes from a seed (`Rng`, `deriveSeed`).
4. **Every PR description has a `COPIES:` line** ([no-duplicates.md](docs/design/no-duplicates.md) layer 4): `COPIES: 1 — checked (grepped: ...)` or `COPIES: 3→1 — <seam>`.
5. **`npm test` must be green.** It runs the guards: banned patterns, layer boundaries and the duplication ratchet. A `NEW` duplication finding means fold the copy into one seam, or list it in `tools/guards/duplication-baseline.json` with a reason. A `STALE` one means delete its baseline line.
6. **Every ~10 PRs, a sweep:** run both finders (`npm run dup`, `npm run repeated -- --min-info 0 --clone-floor 0.6`; reports land in `reports/`), read for concept duplicates, fold what is worth folding.
7. **Each PR adds a change note** `changes/<slug>.md` (`# Title`, then `- ` bullets; see [changes/README.md](changes/README.md)). Never edit `CHANGELOG.md` or pick a version: after the merge a workflow folds the notes into it as the next versions (v0.001 + 0.001 per merge). PR titles carry no version.
8. **The baton is [HANDOFF.md](HANDOFF.md)** ([docs/CROSS-TOOL.md](docs/CROSS-TOOL.md)): read it before you start, overwrite it before you stop, commit it with the work.
9. **Run checks through the one gate:** `bash scripts/gate.sh` (cheap tier `npm run build`; full tier adds `npm test`). Exit `0` green, `1` red, `2` cheap only, `9` lock busy (VOID). Never hand-roll `npm test` for a landing, and never pipe a check through `tail`/`head`.
10. **A writer session works only in its own `worktrees/<slug>`.** The main tree belongs to whoever asked for the change.

Design: [docs/design/](docs/design/) (the main plan is `dunfinity-plan.md`).

Checks that need a browser: `npm run build`, then `npm run check:shaders` and `npm run shot -- "?seed=1&gl" out.png`. In the cloud container set `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and use `?gl` (headless WebGPU fails in three r186 there).
