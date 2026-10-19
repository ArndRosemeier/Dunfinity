# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `dsh/session-93e1713f-7556-403e-b238-acef9bce7fd1`
- **at:** `2026-10-19T12:35:00Z`
- **branch / worktree:** `main` · `/home/administrator/projects/Dunfinity`
- **last verified:** `92f263f` (PR #269's head) · gate `0` (full) · 556 tests, 556 pass, 0 fail, 111.7 s · CI green; main `3f40f5f` carries the same tree

## Done

- **The cross-tool contract** (PR #268, merged `bdcea23`): `HANDOFF.md`, one gate
  (`scripts/gate.sh`: cheap `npm run build` / full `npm test`, atomic lock, exit codes
  0/1/2/9), the journal and worktree guard (`scripts/cos.mjs`, `.cos/hooks/`),
  `docs/CROSS-TOOL.md`, rules 8–10 in `CLAUDE.md`.
- **The cellar is under the house, down a turned stair** (PR #269, merged `3f40f5f`):
  the vault spans the house, its crown 0.5 m under the hall floor; a flight down east,
  a half-landing, a U-turn, a second flight west to the cellar door; the round room,
  the broken arch, the passage and the old shaft moved west with it (shaft x 5.5).
  Verified by my own full gate (0, 556/556) and my own injection: with the house/cellar
  floor priority swapped back, **"one stands on the hall's floor"** and the four-rooms
  walk go red.
- **Known residual (not hidden):** `groundAt(x, z)` without a body height answers the
  *topmost* floor, so inside the cellar it returns the hall's 2.7. Way Home passes the
  body's floor; foot IK returns null on the flat cellar floor; a poured salt line falls
  back to flat. A body-height-aware pass over the remaining consumers is a follow-up
  slice — do not let it be forgotten.

## In flight

- **The street is alive** (town slice, owner-approved: ambient motion + people
  acknowledge you). Writer on branch `cos/street-life`, worktree
  `/home/administrator/projects/Dunfinity/worktrees/street-life`. It owns: birds over
  the village, chimney smoke (one new `SMOKE` kind, shader policy), a cat on the wall,
  villagers who greet you, and 4–6 villagers callable with E. No new sound assets in
  this slice (sounds are the next one — see below), no day clock.

## Next action (one)

When the writer reports LANDED: fetch `origin/cos/street-life`, run the full gate in
that worktree, inject one named pin (e.g. drop the greeting's once-only guard), then
open the PR and merge. If it reports BLOCKED, read its evidence before re-dispatching.

## Queued after it

- **The town's sounds** (new host capability, owner-flagged 2026-10-19): `or request
  POST /audio/speech` with `bytedance-seed/seed-audio-1-0` generates sound effects from
  a prompt — proven, the take is `worktrees/birds-candidate.mp3`, and the exact command,
  limits and integration facts are in `worktrees/NOTES-town-slice.md`. Planned slice:
  birds by day, a far dog, a bell, hand-added to `public/sounds/manifest.json` (MP3 is
  fine: no ffmpeg or numpy on this host). Serialize it against the street slice — both
  add rows to `docs/ARCHITECTURE.md`.


## Open questions for the owner

- None.

## Read first

- `CLAUDE.md`
- `docs/CROSS-TOOL.md`
- `docs/ARCHITECTURE.md` (the cellar and town-life rows)
