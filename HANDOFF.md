# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T08:40:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** this branch's head · `bash scripts/gate.sh` green (build + 568 tests) · `?lab&races` screenshot (Actors races, 0 shader violations)

## Done

- Step 4 of replacing our humans with Actors (plan: `/mnt/project-files/dunfinity/actors/port-plan.md`):
  goblins (knife), scavengers (goblins with crowbars), the Tall One (umbral in a robe), Frau Weber,
  the shopkeepers, the stranger and the Lab's race lineup are Actors figures built by
  `figures(n, look, held)` (humanPool.ts) from `folkLook(race, seed, o, dressOf(...))` (looks.ts)
  on `folkCatalog()` (every race, no credited garments or hair). Their old outfits left wardrobe.ts.
- Before it: step 3, the grandchild and creator on Actors (#275), and the shared figure shadows.

## Next

- Step 5: ghosts (dwarf/elf ghosts, grandma's ghost) and skeletons (Salt-Touched, Foreman, the
  lineup's bones) on Actors. Step 6: thrown poses, then remove `@futuremagic/humanoid` (and
  `WARDROBE`'s today-garments, `setHumanAssetBase`).
- Run the Shaders workflow on the branch before asking for a merge (more figure shaders now).
- Townsfolk could drop face morphs so their bodies share one shadow shader (fewer warm frames).
