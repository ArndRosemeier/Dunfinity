# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-11-05T10:00:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green with Actors 0.34.0; creator probe on `?gl` wearing 3026 and medieval presets, no shader policy violations

## Done

- Actors 0.34.0: the creator (src/game/creator.ts) loads its model character with `allow: GRANDCHILD` (src/render/actors/today.ts: humans only) and the `uncredited` catalog, so every uncredited garment is on offer (Arnd 2026-11-05: medieval and futuristic are fine for the player). Editor sections are now `body`, `face`, `outfit`, each with Simple/Detailed tabs. Townsfolk keep `today()`; the dice (`personOfToday`) still rolls someone of today.

## Next

- Real-WebGPU check for Dunfinity: launch Chromium with Actors' flags (`--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --disable-vulkan-surface`) and count vertex buffers per pipeline, as Actors' `apps/viewer/scripts/webgpu-check.mjs` does; the Lab race lineup takes ~9 min to report ready.
- Several projects (Scale, Dunfinity) push to Actors: fetch Actors main before every Actors PR.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
