# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `dsh/session-93e1713f-7556-403e-b238-acef9bce7fd1`
- **at:** `2026-10-19T14:10:00Z`
- **branch / worktree:** `main` · `/home/administrator/projects/Dunfinity`
- **last verified:** `e7844e4` (PR #271's head) · gate `0` (full) · 566 tests, 566 pass, 0 fail, 106 s · CI green; main `6993ad8` carries it

## Done

- **The cross-tool contract** (PR #268): `HANDOFF.md`, one gate (`scripts/gate.sh`,
  cheap `npm run build` / full `npm test`, atomic lock, codes 0/1/2/9), the journal and
  worktree guard, `docs/CROSS-TOOL.md`, rules 8–10 in `CLAUDE.md`.
- **The cellar under the house, down a turned stair** (PR #269): the vault spans the
  house, its crown 0.5 m under the hall floor; a flight, a half-landing, a U-turn, a
  second flight to the cellar door; the round room, the arch, the passage and the old
  shaft moved west with it (shaft x 5.5).
- **The street is alive** (PR #270): birds over the roofs, chimney smoke (the one new
  `SMOKE` kind), a cat on the plinth, villagers who greet you once per approach, five
  callable with E. `canHear(person, …)`/`talking(person, …)` live once in
  `src/world/townsperson.ts`; the duplication baseline is net unchanged.
- **The town's sounds** (PR #271): `amb_town_day` by day (the prologue keeps the night
  bed), bird calls every 5–13 s, a church bell when one comes back up, and `town-day` as
  a second town piece. The six MP3s are the owner-approved takes, byte-identical.
- **Known residual (not hidden):** `groundAt(x, z)` without a body height answers the
  *topmost* floor, so inside the cellar it returns the hall's 2.7. Way Home passes the
  body's floor; foot IK returns null on the flat cellar floor; a poured salt line falls
  back to flat. A body-height-aware pass over the remaining consumers is a follow-up
  slice — do not let it be forgotten.

## In flight

- None. Every writer was retired with its worktree and branch.

## Next action (one)

The owner names the next slice. Unfinished thread from the town work, deliberately
deferred: the **events** pass — a funeral procession for the previous heir when one comes
up, a cart down the lane, a market on the square. Before dispatching anything:
`node scripts/cos.mjs status --one-line`, `git fetch` and compare `origin/main`, then
brief ONE writer into `worktrees/<slug>` with absolute paths.

## Open questions for the owner

- None.

## Read first

- `CLAUDE.md`
- `docs/CROSS-TOOL.md`
- `docs/ARCHITECTURE.md` (the cellar, town-life, and sound-and-music rows)
