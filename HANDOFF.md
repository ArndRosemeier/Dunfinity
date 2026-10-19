# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `dsh/session-93e1713f-7556-403e-b238-acef9bce7fd1`
- **at:** `2026-10-19T09:15:00.000Z`
- **branch / worktree:** `cos/cross-tool-contract` · `/home/administrator/projects/Dunfinity`
- **last verified:** `c762b27` · `npm test` 551/551, 0 fail, 109 s (run before the gate existed)

## Done

- Adopted the cross-tool contract: `HANDOFF.md`, one gate (`scripts/gate.sh`, cheap
  `npm run build` / full `npm test`), the journal + worktree guard (`scripts/cos.mjs`,
  `scripts/cos-hook.mjs`, `.cos/hooks/`), `docs/CROSS-TOOL.md`, and rules 8–10 in
  `CLAUDE.md`. The PR + change-note + changelog flow is unchanged.
- A clean checkout is now installable and checkable: `git submodule update --init &&
  npm ci` (~40 s), then `npm test` green at `c762b27`.

## In flight

- None. This landing waits on the owner's merge (`cos/cross-tool-contract`).

## Next action (one)

The owner names the next slice. Before dispatching: `node scripts/cos.mjs status
--one-line`, `git fetch` and compare `origin/main` (never a stale local branch), then
brief ONE writer into `worktrees/<slug>` with absolute paths.

## Open questions for the owner

- None.

## Read first

- `CLAUDE.md`
- `docs/CROSS-TOOL.md`
- `docs/ARCHITECTURE.md` (the seam index, for the first slice)
