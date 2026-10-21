# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T23:10:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green (build + tests) with Actors 0.6.0 · Lab screenshots of the races, ghosts, skeletons and an elf close-up, side by side with 0.5.0 (same look; warm-up shaders: races 262 → 83, ghosts 250 → 69)

## Done

- Actors 0.6.0 (Actors PR #23): every character shares one node graph per material kind, its own values read at each draw; face morphs are plain vertex attributes. Dunfinity upgrades to it.
- Ghosts share their shaders too (src/render/actors/ghost.ts): ghost nodes built once per kind, a ghost's tint, opacity and fade read from the drawn material (`userData.ghost`). `Figure.fade` is a plain number now.

## Next

- Run the Shaders workflow (title check) on main after the merge: it timed out on the runner before this change.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
