# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `dsh/session-93e1713f-7556-403e-b238-acef9bce7fd1`
- **at:** `2026-10-19T09:13:00Z`
- **branch / worktree:** `cos/cross-tool-contract` · `/home/administrator/projects/Dunfinity`
- **last verified:** `d0644da` · gate `0` (full) · 551 tests, 551 pass, 0 fail, 103 s

## Done

- Adopted the cross-tool contract: `HANDOFF.md`, one gate (`scripts/gate.sh`, cheap
  `npm run build` / full `npm test`), the journal + worktree guard (`scripts/cos.mjs`,
  `scripts/cos-hook.mjs`, `.cos/hooks/`), `docs/CROSS-TOOL.md`, and rules 8–10 in
  `CLAUDE.md`. The PR + change-note + changelog flow is unchanged.
- A clean checkout is installable and checkable again: `git submodule update --init &&
  npm ci` (~40 s); it was neither when this session started.
- Baseline before the adoption: `npm test` at `c762b27` — 551/551, 109 s.

## In flight

- The adoption PR, from `cos/cross-tool-contract` — waiting on the owner's merge.

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
