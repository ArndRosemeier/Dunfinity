# The cross-tool contract — Dunfinity

Two harnesses work this repo: the DeepSeek Harness (DSH) and Claude Code. A session
in either can continue the work of the other, because the workspace is the session:
the same repo, the same rules, the same gate, the same baton. Transcripts are not
shared and are not the target.

The doctrine — why each rule exists, and the long version of it — is in
`~/projects/Toolbox/docs/` (`GATE.md`, `BRIEF.md`, `WAY-OF-WORKING.md`,
`TRAPS.md`). This file binds only what is true of Dunfinity.

## The files that carry the work

| File | Answers |
| --- | --- |
| `CLAUDE.md` | the law. One instruction file; never create a second |
| `HANDOFF.md` | what the baton is right now — one screen, overwritten at every stop |
| `.cos/journal.jsonl` | what actually ran (append-only, local, gitignored) |
| `scripts/gate.sh` | did it pass — the one way the checks run |
| `.cos/worktrees` | which worktrees a writer may write in |

## Start

1. Read `CLAUDE.md`, then this file, then `HANDOFF.md`.
2. `node scripts/cos.mjs status --one-line`, and check it against reality: `git fetch`
   and `origin/main` (never a stale local branch), `git worktree list`, the gate lock
   (`.gate-lock/owner`), and the live agent list.
3. Fix the record where it lied, report one line, and only then dispatch.

## During

- **One gate:** `bash scripts/gate.sh`. The cheap tier (`npm run build`) blocks the
  push; the full tier adds `npm test` and is what makes a landing VERIFIED. Exit `0`
  green, `1` red, `2` cheap only, `9` refused (VOID — not evidence). Never hand-roll
  `npm test` for a landing, and never pipe a check through `tail`/`head`.
- **Writers:** at most two, each in its own `worktrees/<slug>` on branch
  `claude/<slug>`, briefed with absolute paths. Record each before dispatch with
  `node scripts/cos.mjs worktree add <absolute path>`; `worktree clear` when none
  remain.
- **The dispatcher keeps the verdict.** A green gate is evidence, not the verdict; a
  pass proves the change does what its author meant, not that it is right.

## Stop

1. Run the tier the change asks for, and quote its exit code and counts.
2. Overwrite `HANDOFF.md` (draft: `node scripts/cos.mjs handoff`), then commit it with
   the landing. A handoff that is not committed does not exist.
3. Land the project's own way: a PR from the branch, `changes/<slug>.md` for anything
   a player would notice, a `COPIES:` line in the PR body. Never edit `CHANGELOG.md`
   or pick a version.

## The hook layer

Installed once per host in `~/.claude/settings.json`; it runs `.cos/hooks/<event>.sh`
when the file exists and no-ops otherwise. In DSH the bridge is profile-level and read
at startup: project-level `.claude/settings.json` hooks do not load there.
