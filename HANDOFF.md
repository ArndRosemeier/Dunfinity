# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-22T15:20:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green with Actors 0.6.5 · Lab lineups vs 0.6.4: warm-up shaders 260 → 81 (races), 248 → 69 (ghosts), same look

## Done

- Actors 0.6.5 (Actors #23, on top of Scale's 0.6.4): every character shares one node graph per material kind; face morphs are plain attributes. Dunfinity #277 had installed Arnd's own 0.6.0, which did NOT have this yet; this PR brings it.
- Ghosts share their shaders (src/render/actors/ghost.ts, since #277).

## Next

- Run the Shaders workflow (title check) after the merge too.
- Several projects (Scale, Dunfinity) push to Actors: fetch Actors main before every Actors PR.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
