# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `dsh/session-93e1713f-7556-403e-b238-acef9bce7fd1` (writer)
- **at:** `2026-10-19T10:40:00Z`
- **branch / worktree:** `cos/cellar-under-house` · `/home/administrator/projects/Dunfinity/worktrees/cellar-under-house`
- **last verified:** `950a04a` · `npm test` 556 tests, 556 pass, 0 fail, 106 s · cheap gate `2` (build green, the full tier did not re-run)

## Done

- Grandma's cellar moved under the house: the brick vault `x [-15, -7.4]`, `z [-2.6, 2.6]`,
  spring 1.6, crown 2.2 (0.5 m under the hall's floor), its walls under the house's own.
- The way down is a turned stair inside the house's footprint: a flight east from the hall's east
  end, a half-landing, a second flight west to the cellar door at the foot; the well is cut
  through the vault and the house's floor (a thin rock wall round it, 0.5 m).
- The low doorway (north of the well), the round room (r 2.5), the broken arch, the passage and the
  chamber with the old shaft moved west with it (shaft `x 5.5`); the room's things, the cellar's
  shelves and bulb, the door, the ward and Way Home's spot follow `CELLAR`.
- The column's floor is the **topmost** ground: the house's floor over the cellar (so the hall's
  feet find 2.7, and the map and a poured salt line in the hall do not inherit the cellar's 0), the
  stair's own floor in the stairwell, 0 in the room/passage. The air no longer follows the column's
  floor (the stair uses `stairFloorAt(x, z) ?? 0`); the cellar's props are placed at 0 explicitly.
  Way Home's spot opens on the floor one stands on; the debug menu's depth-0 ground special case is
  gone.
- The pins: the cellar lies under the house, the stairs turn, the stairs have headroom, nothing
  drawn stands in the way up the stairs, one stands on the hall's floor; the walks, the four house
  rooms (with `[-12, 0]` back) and Way Home are updated to the new coordinates.

## In flight

- The PR from `cos/cellar-under-house` — pushed, waiting on the owner's review/merge.

## Next action (one)

The owner reviews and merges; then the next slice. Before dispatching: `node scripts/cos.mjs status
--one-line`, `git fetch` and compare `origin/main` (never a stale local branch), then brief ONE
writer into `worktrees/<slug>` with absolute paths.

## Open questions for the owner

- None.

## Read first

- `CLAUDE.md`
- `docs/CROSS-TOOL.md`
- `docs/ARCHITECTURE.md` (the seam index, for the first slice)
