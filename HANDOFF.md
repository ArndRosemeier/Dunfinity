# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T06:40:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** this branch's head · `bash scripts/gate.sh` green (build + 568 tests) · creator screenshots headless · `npm run check:shaders -- title` ok locally

## Done

- Step 3 of replacing our humans with Actors (plan: `/mnt/project-files/dunfinity/actors/port-plan.md`):
  the grandchild (`Nobody`) is an Actors `Figure`; `FigureRig` (src/render/actors/rig.ts) gives it
  sockets (tool in the fist or at the hip, flashlight/umbrella, pot lid, hard hat), a pose layer and
  two-bone reach (ladder climb); the creator is Actors' `CharacterEditor` on a model character never
  drawn (src/app/creatorView.ts, src/game/creator.ts); `today()` keeps the catalog to people of today;
  saves keep `character: CharacterConfig` (old `look`/`outfit` are left unread). Old outfit code
  (src/loot/outfit.ts, `rags`, `grandchildsClothes`) is gone.
- Before it (#275): Actors figures' shadow shaders warmed per figure, solid parts shared (`PLAIN_SHADOW`).

## Next

- Step 4: goblins, scavengers, peoples of the deep, tall ones, bosses on Actors races. Step 5: ghosts
  and skeletons. Step 6: thrown poses, then remove `@futuremagic/humanoid` (and `WARDROBE`'s
  today-garments in wardrobe.ts, `setHumanAssetBase`).
- `npm run check:shaders -- title` passes locally on this work (Go down after 533 s, 0 builds after).
- Townsfolk could drop face morphs so their bodies share one shadow shader (fewer warm frames).
- In SwiftShader the title reaches "Go down" after 10 to 25 minutes; the check waits 30.
