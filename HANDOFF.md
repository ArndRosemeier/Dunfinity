# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-22T19:40:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green with Actors 0.6.6

## Done

- Actors 0.6.6: fixes 0.6.5 on real WebGPU (face morphs took 4 vertex buffers, a face mesh needed 9, WebGPU allows 8; now one interleaved buffer). Tail races rebuild draws when bones change. CI only checks the WebGL 2 backend, so it could not catch this: Actors has `apps/viewer/scripts/webgpu-check.mjs` for real WebGPU.

## Next

- Run the Shaders workflow (title check) after the merge too.
- Several projects (Scale, Dunfinity) push to Actors: fetch Actors main before every Actors PR.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
