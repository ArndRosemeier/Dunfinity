# Faster checks on every change

- CI runs the tests and the two halves of the shader check (the Lab, the game) as three jobs side by side instead of one after another.
- A new push to a pull request cancels that pull request's older run.
- Two stale lines left in the duplication baseline are gone, so main's checks are green again.
