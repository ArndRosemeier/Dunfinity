# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T19:40:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** this branch's head · `bash scripts/gate.sh` green (build + 568 tests) · Lab screenshots of the races, skeletons and ghosts (0 shader violations) · local `npm run check:shaders -- title` ok (ready at 597 s, 0 builds after going down)

## Done

- Steps 4 to 6 of replacing our humans with Actors (plan: `/mnt/project-files/dunfinity/actors/port-plan.md`):
  goblins, scavengers, the Tall One, Frau Weber, the shopkeepers, the stranger and the Lab's lineup
  (step 4); ghosts (`ghostly`, src/render/actors/ghost.ts) and skeletons (`skeletal`,
  src/render/actors/bones.ts: the old package's bones laid on Actors' rest skeleton) for the
  dwarf/elf ghosts, grandma's ghost, the Salt-Touched, the Foreman (step 5); `@futuremagic/humanoid`,
  its Vite asset plugin, the `WARDROBE` hook and the old outfits are gone (step 6). wardrobe.ts keeps
  only what figures hold and wear on sockets. Lab: `?lab&races=bones`, `?lab&races=ghosts`.

- The title Shaders check: body shadows go through one shared stand-in (`Figure.shadows`), and the
  Stage keeps a never-disposed tiny copy of each shared shadow caster (`keeper` in stage.ts), since
  three drops a shader once its last user is disposed (the title's people, the creator's spare).

## Next

- The title warm-up is slow under SwiftShader (each figure's materials are its own shaders): an Actors upstream change sharing material graphs would cut it.
- `?lab&races=<race>` puts the camera inside a house at depth 0 (pre-existing; the row view is fine).
