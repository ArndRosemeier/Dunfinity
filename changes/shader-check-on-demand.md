# Checks that take minutes, not a quarter of an hour

- The shader check no longer runs on every change: it is started on demand (Actions → Shaders → Run workflow), every so often and after render changes.
- The tests run on three machines side by side, and the slowest test file is split in three, so a change is checked in about two minutes.
