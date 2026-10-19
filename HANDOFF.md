# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `dsh/session-93e1713f-7556-403e-b238-acef9bce7fd1`
- **at:** `2026-10-19T13:55:00Z`
- **branch / worktree:** `main` · `/home/administrator/projects/Dunfinity`
- **last verified:** `07393b2` (PR #270's head) · gate `0` (full) · 561 tests, 561 pass, 0 fail, 106 s · CI green; main `2cdae9e` carries it

## Done

- **The cross-tool contract** (PR #268): `HANDOFF.md`, one gate (`scripts/gate.sh`,
  cheap `npm run build` / full `npm test`, atomic lock, codes 0/1/2/9), the journal and
  worktree guard, `docs/CROSS-TOOL.md`, rules 8–10 in `CLAUDE.md`.
- **The cellar under the house, down a turned stair** (PR #269): the vault spans the
  house, its crown 0.5 m under the hall floor; a flight, a half-landing, a U-turn, a
  second flight to the cellar door; the round room, the arch, the passage and the old
  shaft moved west with it (shaft x 5.5). Verified by my own gate and injection.
- **The street is alive** (PR #270): birds over the roofs, chimney smoke (the one new
  `SMOKE` kind), a cat on the plinth, villagers who greet you once per approach and five
  callable with E. The fold `07393b2` put `canHear(person, …)`/`talking(person, …)` in
  `src/world/townsperson.ts` once and left the duplication baseline **net unchanged**
  (the two entries the first landing added were deleted).
- **Known residual (not hidden):** `groundAt(x, z)` without a body height answers the
  *topmost* floor, so inside the cellar it returns the hall's 2.7. Way Home passes the
  body's floor; foot IK returns null on the flat cellar floor; a poured salt line falls
  back to flat. A body-height-aware pass over the remaining consumers is a follow-up
  slice — do not let it be forgotten.

## In flight

- **The town's sounds** (owner-approved; the takes are approved by ear). Writer on
  branch `cos/town-sounds`, worktree
  `/home/administrator/projects/Dunfinity/worktrees/town-sounds`. It owns: the day bed
  (`amb_town_day`) with the night bed kept for the prologue, sparse bird calls by day,
  a bell when one comes back up from below, and `town-day` as a second town music piece.
  The six MP3s live in `worktrees/audio-candidates/` (and the plan, the exact seams and
  the audio-generation method are in `worktrees/NOTES-town-slice.md`).

## Next action (one)

When the writer reports LANDED: fetch `origin/cos/town-sounds`, run the full gate in
that worktree, inject one named pin (e.g. make the bed choice ignore the night flag),
then open the PR and merge.

## Open questions for the owner

- None.

## Read first

- `CLAUDE.md`
- `docs/CROSS-TOOL.md`
- `docs/ARCHITECTURE.md` (the cellar, town-life and village rows)
