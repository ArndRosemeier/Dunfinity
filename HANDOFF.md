# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-24T13:30:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green with Actors 0.8.2; Lab race lineup on real WebGPU (SwiftShader Vulkan): max 7 of 8 vertex buffers, no WebGPU errors

## Done

- Actors 0.8.2 (from 0.6.6). New in Actors: the futuristic Commonwear 3026 wardrobe (kept out of `today()`, src/render/actors/today.ts, with a test), shared screen textures (`ScreenTexturePool`; Dunfinity wears no screen fabrics, so nothing to wire), sheer stockings keep the skin beneath them.

## Next

- Real-WebGPU check for Dunfinity: launch Chromium with Actors' flags (`--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --disable-vulkan-surface`) and count vertex buffers per pipeline, as Actors' `apps/viewer/scripts/webgpu-check.mjs` does; the Lab race lineup takes ~9 min to report ready.
- Several projects (Scale, Dunfinity) push to Actors: fetch Actors main before every Actors PR.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
