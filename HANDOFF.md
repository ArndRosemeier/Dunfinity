# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T03:40:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** this branch's head · gate (see PR) · `npm run check:shaders -- title` locally (see PR)

## Done

- **Fix for the Shaders workflow's title job** (red on main since #274). Each Actors figure has
  shadow shaders of its own (its skinning nodes are per figure), and so does each old hairstyle,
  but the Stage's shadow warm-up drew one caster per kind. `Figure` now marks its object
  `OWN_SHADOWS` (src/render/stage.ts) and the warm-up draws every shown part under it; meshes with
  `hairAux` (old humans' hair) are drawn one by one too. Teeth, tongue and eyes cast no shadow.
- Earlier: step 2 of replacing our humans with Actors (#274: townsfolk on `Figure`).
  Plan: `/mnt/project-files/dunfinity/actors/port-plan.md`.

## Next

- Step 3 (in progress on this thread, not in this PR): the player (`Nobody`) on `Figure` with
  `FigureRig` (sockets, pose layer, two-bone IK; src/render/actors/rig.ts), ladder climb on it, the
  creator on Actors' `CharacterEditor` (v0.3.0 options), saves keep a `CharacterConfig`.
- Steps 4 to 6: goblins, scavengers, peoples of the deep, tall ones, bosses; ghosts and skeletons;
  then remove `@futuremagic/humanoid`.
- Note: in SwiftShader the title's creator reaches "Go down" after 7 to 10 minutes locally (the
  scene is ~1M triangles at 0.02 to 0.4 fps); the check's limit is 15 minutes.
