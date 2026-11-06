# Handoff — Dunfinity

<!-- One screen, overwritten in place. The next session — DSH or Claude Code —
     reads this after CLAUDE.md and docs/CROSS-TOOL.md. -->

- **by:** `claude-code/session_01QFLEQKgENyRNe1szXUTsD2` (cloud, thread "Adopt latest Actors and AssetGenerator")
- **at:** `2026-11-06T13:10:00Z`
- **branch / worktree:** `claude/project-thread-fedg1u` · the cloud container's own clone
- **last verified:** `bash scripts/gate.sh` green with Actors 0.34.4 and AG a0eae25; title/creator checked by the on-demand Shaders workflow on the branch

## Done

- Actors 0.34.0 → 0.34.4 (shoes fit, no leg cut above boots, opaque-only skin hiding, humans-only filters drop horns/tails/scales/leaf hair/crest fins). No API changes needed in Dunfinity.
- AssetGenerator submodule b34dda6 → a0eae25. Dunfinity does not import `@futuremagic/stage`; its own shader hooks (src/render/shaders/patches.ts) took that commit's fix, `balancedBindingRelease` (three r186 bind groups released for render objects never set up).

## Next

- Dunfinity's shader hooks are an older copy of `@futuremagic/stage`'s (which also has rebindSwitchedTextures, keepTextureUpdates, shareShadowNodes, fixedBundleUniforms). Folding Dunfinity onto the package would end the copy; not done here (feel freeze, adoption only).
- Local `npm run check:shaders` lab part times out at 120 s in the cloud container; use the Shaders workflow.
- Real-WebGPU check for Dunfinity is still open (see Actors `apps/viewer/scripts/webgpu-check.mjs`).
- Several projects (Scale, Dunfinity) push to Actors: fetch Actors main before every Actors PR.
