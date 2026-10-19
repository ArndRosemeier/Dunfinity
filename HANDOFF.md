# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_01FyMJNLkFSHoPaEfNDrZzLV` (cloud)
- **at:** `2026-10-19T16:00:00Z`
- **branch / worktree:** `claude/wonderful-volta-9eekj9` · the cloud container's own clone (no other writer there)
- **last verified:** this branch's head · gate `0` (full, 568/568) · the aura in a preview page and in the game (depth 3)

## Done

- **Salt Sight as an aura** (this branch, after #272): `SaltSightView` draws a glow round each
  creature, brightest at the body and fading outwards, its edge flowing, breathing, patches
  drifting round (a conic gradient), currents of salt running round it, motes drifting off
  (stateless: time + the creature's seed, `hash3f`). The glows go on a quarter-size canvas
  stretched over the view (blurred where `ctx.filter` exists). Outline geometry moved to
  `src/app/outline.ts` (tested; `saltSight.ts` itself imports the theme's fonts, so node cannot
  load it). Checked in a preview page and in the game (depth 3, seed 1, rats round the player).
  Observed, not changed: Salt Sight only rings what `seen(f)` passes, and low rats behind floor
  bumps are not seen from a standing camera.

- **The cellar's geometry, fixed** (follow-up to PR #269). The terrain is meshed on a
  one-metre grid (`BASE_STEP`), and #269's 0.5 m floor between the cellar's vault (2.2) and
  the hall's floor (2.7) had no grid point inside it: the hall, kitchen and living room had no
  floor drawn over the cellar, and the cellar no vault (one saw up into her rooms). The stair's
  foot was also pinched shut: no body could walk from the cellar to the stairs (the tests
  started the climb inside the foot, so never saw it). The cellar's walls were coloured as its
  floor (`col.floor` is the topmost floor, the hall's).
- Now: the cellar's floor is `CELLAR.cellar.floor` −1.3 (vault 0.6/1.3, the old proportions),
  the rock between 1.3 and 2.7 straddles the grid at y = 2; the turned stair stands in its own
  walled well at the hall's east end (flights 1 m wide on grid lines z = 0 and z = −1), the
  cellar door in the cellar's east wall at its foot; the low doorway is a low passage under the
  kitchen and up stone steps to the room (a wider `mouth` at the room). Upstairs the living
  room's wall moved to z −1.6, the kitchen's door to x [−11.9, −10.9] (the bedroom's wall to
  x −12). `WAY.cellar` carries the cellar's floor.
- New test: "the hall's floor and the cellar's vault are drawn where they are, on the
  terrain's one-metre grid" (interpolates the field between grid samples, as the mesher does).
  The climb now starts in the middle of the cellar.

## Known residual (not hidden)

- `groundAt(x, z)` without a body height still answers the *topmost* floor (over the cellar,
  the hall's 2.7). The way back and the cellar's props pass their own floor. A body-height
  pass over the remaining consumers is still a follow-up slice.
- Any shape that sits between two airs, under 2 m across, must keep to the grid (see the note
  on `CELLAR`); a new room under the house must be checked with the grid test.

## In flight

- None.

## Next action (one)

The owner reviews the cellar in the game and names the next slice (the deferred town
**events** pass: a funeral procession, a cart down the lane, a market on the square).

## Open questions for the owner

- None.

## Read first

- `CLAUDE.md`
- `docs/CROSS-TOOL.md`
- `docs/ARCHITECTURE.md` (the cellar row)
