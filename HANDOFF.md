# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_015a9FszEAngcaUHDv4wySRi` (cloud, thread "Actors humans replace ours")
- **at:** `2026-10-21T01:00:00Z`
- **branch / worktree:** `claude/actors-humans-evkdkn` · the cloud container's own clone
- **last verified:** this branch's head · gate (see PR) · townsfolk screenshotted in the town (`?seed=1&gl&light`)

## Done

- **Step 2 of replacing our humans with Actors** (plan: `/mnt/project-files/dunfinity/actors/port-plan.md`).
  Actors 0.2.0 (`@actors/core|human|three|generator`, from its GitHub release tarballs) is installed;
  `tools/actors/pack.mjs` fetches the matching asset pack (without the CMU library) into
  `.actors-pack/<version>` (git-ignored, cached in CI); the `actorsPack` Vite plugin serves it at
  `/actors/` and copies it into the build (~300 MB, files loaded only when worn).
- `src/render/actors/`: `pack.ts` (pack URL, shared fetcher, catalog without CC-BY items),
  `animator.ts` (`FigureAnimator`: move states → Actors clips, lower/upper split, actions on the
  upper body placed by the game clock, flinch, moods as expressions, stride matched to speed),
  `figure.ts` (`Figure`: Character + animator, faces −Z by yaw like the old humans),
  `looks.ts` (`personOfToday`).
- `HumanPool` takes any `PoolFigure`; `townsfolkPool()` builds Actors figures.

## Next

- Step 3: the player (`Nobody`) and the character creator on Actors' `CharacterEditor`; saves keep a `CharacterConfig`.
- Step 4: goblins, scavengers, peoples of the deep, tall ones, bosses on Actors races. Step 5: ghosts and skeletons. Step 6: ladder climb and thrown poses, then remove `@futuremagic/humanoid`.
- Not done yet in the animator: foot IK on uneven floor, look-at, lip flap.
