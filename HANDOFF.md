# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T09:30:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** this branch's head · `bash scripts/gate.sh` green (build + 568 tests) · Lab screenshots of the races, skeletons and ghosts (0 shader violations)

## Done

- Steps 4 to 6 of replacing our humans with Actors (plan: `/mnt/project-files/dunfinity/actors/port-plan.md`):
  goblins, scavengers, the Tall One, Frau Weber, the shopkeepers, the stranger and the Lab's lineup
  (step 4); ghosts (`ghostly`, src/render/actors/ghost.ts) and skeletons (`skeletal`,
  src/render/actors/bones.ts: the old package's bones laid on Actors' rest skeleton) for the
  dwarf/elf ghosts, grandma's ghost, the Salt-Touched, the Foreman (step 5); `@futuremagic/humanoid`,
  its Vite asset plugin, the `WARDROBE` hook and the old outfits are gone (step 6). wardrobe.ts keeps
  only what figures hold and wear on sockets. Lab: `?lab&races=bones`, `?lab&races=ghosts`.

## Next

- Run the Shaders workflow on the branch before asking for a merge (many more figure shaders now).
- Townsfolk could drop face morphs so their bodies share one shadow shader (fewer warm frames).
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
