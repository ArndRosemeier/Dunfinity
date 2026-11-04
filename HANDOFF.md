# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-11-05T00:30:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green with Actors 0.33.4 and AssetGenerator b34dda6

## Done

- Actors 0.33.4 (from 0.8.2) and the AssetGenerator submodule at b34dda6 (210 commits; the game only imports `@futuremagic/core`, which only gained `ground.ts`; none of `tools/props/models.json`'s specs changed, so the props pack was not rebuilt). `today()` now filters by Actors' theme tags (`filterCatalog`, modern + vintage, without real-faith) and drops helmets and gowns; test/today.test.ts. New Actors defaults on: skin detail, cloth tuck, cloth motion; face rig, living face and wrinkles stay off.

## Next

- Real-WebGPU check for Dunfinity: launch Chromium with Actors' flags (`--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --disable-vulkan-surface`) and count vertex buffers per pipeline, as Actors' `apps/viewer/scripts/webgpu-check.mjs` does; the Lab race lineup takes ~9 min to report ready.
- Several projects (Scale, Dunfinity) push to Actors: fetch Actors main before every Actors PR.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
