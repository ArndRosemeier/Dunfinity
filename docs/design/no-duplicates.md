# Dunfinity: keeping one way to do each thing (method)

Status: **draft 1, for discussion.** Part of [dunfinity-plan.md](dunfinity-plan.md).

Sources: Arnd's `Toolbox` repo (`duplicate-candidates`, `repeated-code`, `docs/SEAM-INDEX.md`, `WAY-OF-WORKING.md` §7.3) and how Scale applied them (`docs/CONVENTIONS.md`, the "guarded" selftest checks, the v0.130 audit).

---

## 1. Diagnosis

**Why vibe coding duplicates:** the writer (me, or a worker I start) doesn't *know* the helper exists. Context is limited, the helper is in a file nobody opened, and writing a new 10-line function is easier than finding the old one. Nothing fails, and each copy is correct where it is born (Toolbox's key sentence). The copies only hurt later, when one gets fixed and the others don't. Scale's example is Tab-targeting in the sewers: about eight systems each did their own distance and line-of-sight check.

**What Toolbox gives us:** two excellent *finders* (same-name functions; same body under different names; pasted idioms ranked by specificity) and a *process* (seam index, `COPIES:` line, "exactly one" pins).

**What Scale shows:** applied *after* the fact (an audit at v0.130, then folding one PR at a time), it works but is slow and expensive. Folding 160k lines is a project of its own.

**So for Dunfinity, a greenfield:** do it *preventively*, from the first commit, and make it **mechanical** so it does not depend on anyone remembering.

---

## 2. The method: five layers

### Layer 1: Make the one way easy to find (discoverability)

Most duplication is prevented if the existing helper is found within seconds.

- **The seam index from day one** (`docs/ARCHITECTURE.md`, Toolbox skeleton). Rows are **phrased as questions**, like Scale's CONVENTIONS ("Is this point in rock?", "Can A see B?", "Where does something dropped land?"), because a writer searches by intent, not by function name. Each row names the one function and its file. It's short enough to read on every task.
- **Seeded before any code** with the questions we already know will come up, using Scale's hard-won list adapted to caves:

  | Question | The one way (planned) |
  |---|---|
  | Is this point rock or air, how far to rock? | `world.sdf(x,y,z)`: the single density function (Xenoworld rule) |
  | Where is the floor or ceiling below/above a point? | `world.floorAt`, `world.ceilingAt` |
  | Can A see B? Can A shoot B? | `world.sight(a, b)` (rock *and* darkness *and* objects) |
  | How lit is this point? | `world.light(x,y,z)` (for stealth, awareness, rendering) |
  | Can this body stand, climb, swim here? | `traverse.*` (one place, also used by the generator's reachability check) |
  | Does a blow, blast or effect reach someone? | `combat.reach(...)` → `combat.damage(...)`, never writing `hp` |
  | Where on screen is a world point? | `screen.toScreen` |
  | Where may the camera go? | `camera.solidAt` |
  | Any random number | `rng.derive(seed, 'path', ...)`, never `Math.random` |
  | Persisted world change | `persist.mark(chunk, change)` |

- **Code layout that matches the questions.** Space queries live under `world/query/`, combat under `combat/`. A writer looking for "line of sight" finds one folder.
- **`CLAUDE.md` / `AGENTS.md`** in the repo says, in its first lines: read the seam index before writing any helper; if a second mechanism seems needed, stop and report it.

### Layer 2: Make the one way hard to bypass (architecture)

- **One facade per domain.** Gameplay code asks the world through `world.*`, never through the chunk store, the mesh or physics directly.
- **Import boundaries as a test.** A small dependency-free node test (Toolbox style) checks the layer map: for example, `gameplay/` may import `world/query/` but not `world/gen/` internals, and nothing imports Rapier except `physics/`. That way a shortcut is a red test, not a quiet copy.
- **Data over code.** Abilities are Norgo's op recipes and creatures come from genomes, so a new ability is a data entry, not new code. Whole classes of duplication don't arise.
- **The shared package is the first seam.** Anything in `@futuremagic/*` must not be re-implemented in Dunfinity (see layer 3c).

### Layer 3: Tripwires in `npm test` (pins)

Every pin goes red on a *new* copy, naming the sites.

- **3a. Banned patterns, with an allowlist of exactly the seam file.** `Math.random`, `.project(` on a camera, raw raycasts, direct `hp` writes, `new Rapier...` outside `physics/`. This is Scale's "guarded" check, built in from the start.
- **3b. The body-clone inventory** (Toolbox §7.3). Every named function body is normalised; any body that appears more than once must be listed in a checked-in inventory with a reason. A new copy goes red. A folded copy also goes red, as a *stale* entry, until its line is deleted, so a blessing can't outlive the duplication.
- **3c. Ratchets on Toolbox's finders.** `duplicate-candidates` and `repeated-code` run in the test, over `src/` **plus the shared packages**, so a re-implementation of something in AssetGenerator is caught too. Their counts (cross-file clone clusters, idioms above the specificity floor) are stored in a baseline file. **They may go down, never up.** On a greenfield the baseline starts at zero.
- **3d. One pin per fold.** When a fold happens later ("three things computed damage falloff; now `combat.falloff` does"), it lands with a test that fails if a second implementation appears.

### Layer 4: The routine on every change

For every PR (by me or a worker):

1. **Before writing:** look the question up in the seam index, grep for it, and name the seam being extended.
2. **In the PR description:** the **`COPIES:` line**, Toolbox's format. Either `COPIES: 1 — checked (grepped: floorAt, groundAt, height)` or `COPIES: 3→1 — world.floorAt`.
3. **Same PR:** a new seam gets its seam-index row, and a moved seam gets its row updated.
4. **Before opening:** run the finders and the reuse-focused code review, and fold anything the change introduced.

### Layer 5: Sweeps

The tripwires catch exact and near-exact copies. They can't see **paraphrases**: two different algorithms for the same idea. That needs a human-style read. Every ~10 PRs (or once a week), a sweep:
- run both finders with lowered thresholds (`--min-info 0`, `--clone-floor 0.6`),
- read the reports for *concept* duplicates, not just text,
- fold what's worth folding, each fold with its own pin.

---

## 3. Where Toolbox itself lives

Toolbox says it is upstream and is **copied** (`cp -r Toolbox/tools`), not linked. We follow its contract: copy `tools/` into Dunfinity, and fixes go back to Toolbox. The Dunfinity-specific checks (banned patterns, import boundaries, the body inventory) live in Dunfinity's own `tools/guards/`, written the Toolbox way: dependency-free node, each with a test.

---

## 4. What I'd skip

- **No linters or heavy dependencies for this** (ESLint rules, dependency-cruiser). The Toolbox approach (small node scripts with tests) is enough and stays portable.
- **No "duplication score" dashboard.** Ratchets and a red test do the job; a number nobody acts on doesn't.

---

## 5. Questions

1. **Ratchets that block** (tests go red when duplication grows) **(my pick)**, or report only?
2. **The sweep:** every ~10 PRs **(my pick)**, or a weekly scheduled routine?
