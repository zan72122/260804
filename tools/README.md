# tools/

A headless Playwright harness for the plush-crane game, driven against the
static server already serving this repo. Everything lives in one file,
`check.mjs`, with five subcommands:

```sh
node tools/check.mjs drama [N]   # default N = 24: run N grabs, check the drama guarantee
node tools/check.mjs beats       # one grab, screenshot every FSM state
node tools/check.mjs shots       # four device viewports + the collection room
node tools/check.mjs perf        # renderer stats vs. draw-call/triangle budgets
node tools/check.mjs settle [N]  # default N = 3: does the prize heap settle sanely?
```

All five:
- Launch Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) with
  `--use-gl=swiftshader --enable-unsafe-swiftshader --no-sandbox`, and navigate
  to `http://localhost:8099/` (the static server, expected to already be running
  — start it with `node serve.mjs 8099` from the repo root if it isn't).
- Collect every `console` error and `pageerror` for the whole run and print
  them at the end. A page error always makes the run exit non-zero.
- Poll `game.state` (and other live conditions) with a `waitFor` helper
  instead of sleeping a fixed duration — see the caveat below for why.

## The swiftshader / slow-motion caveat

Rendering here is software (SwiftShader), not GPU-accelerated. The game's own
`requestAnimationFrame` loop still ticks once per real frame, but each frame
takes far longer to render than on real hardware — so the same number of
*wall-clock* seconds corresponds to far fewer *game-time* seconds than on a
phone. A beat that's nominally under a second (see `BEAT` in
`src/contracts.js`) can take tens of real seconds here.

Consequently this harness never does `await sleep(N)` and assumes the game
has reached some particular state. Every wait is a `waitForFunction` poll
against the live page (`game.state`, `pile.bodies[i].sleeping`, etc.) with a
generous timeout.

## Failure handling: a timed-out wait never destroys the report

A precondition failing (a pile that never sleeps, a state machine that never
leaves a beat) is itself the interesting result — throwing it away by
crashing before anything gets printed is the wrong behaviour twice over.

So `waitFor()` **never throws**. On timeout it immediately prints a
`WARN: waitFor(<label>) timed out after <ms>ms -- game.state=<state>` line,
records the message, and returns `{ ok: false, state }` — the caller
inspects `ok` and carries on with whatever state actually exists. Every
subcommand still prints its full report (table + summary + the
console/page-error dump) even when one or more waits timed out, and the
process still exits non-zero at the end: any timeout/precondition warning
counts as a failure alongside console and page errors, and all three are
listed at the bottom of the output.

`perf`'s and `settle`'s pile-settle wait was cut from 120000ms down to 15000ms
(`SETTLE_TIMEOUT_MS`): a healthy pile is pre-settled and velocity-zeroed by
`pile.layout()` before the game even reaches `'aim'`, then falls asleep after
`SLEEP_TIME` (0.30s of game time) of low speed — so 15s is already very
generous for swiftshader slow motion, and a pile that hasn't slept by then is
genuinely stuck, not just rendering slowly. When it times out, both
subcommands print the diagnostic that actually explains a stuck pile: bodies
asleep, the fastest body in the pile (pile.js's own `|vel| + |angVel|*0.25`
sleep metric), the highest body centre, and how many bodies are overlapping
an interior wall.

`drama`'s per-grab FSM stall detector (`BEAT_STALL_MS`, 60000ms) works the
same way: if `game.state` doesn't change for that long, the grab is recorded
as a stall (with the beat name and how long it sat there) instead of hanging
the whole run, the page is closed and reopened fresh, and the remaining
grabs still get their shot. See `drama` below.

## `drama [N]`

Runs N grabs. For each one it:
1. Polls for `game.state === 'aim'` (never a fixed sleep).
2. Snapshots every `pile.bodies[i]` (position, quaternion, radius, species) —
   this is the harness's **own, independent measurement**, taken before and
   after the grab and diffed by identity (each body is tagged with a stable
   id on first sight, so a body that leaves the pile because it was won is
   detected as "removed" rather than silently dropped from the diff). It does
   not rely on anything the game itself reports.
3. Picks an aim point in one of three categories, derived live from
   `pile.bodies` — logged per grab:
   - `centre` — exactly on a toy's position (clean catch by the README's rules).
   - `offset` — 0.55-0.95m off a toy (deliberately in the slip/push band).
   - `far` — as far from every toy as the aim plane allows (probed by asking
     `game.setAim()` to clamp an out-of-range point, so the true cabinet
     bounds never need to be hardcoded here).
   About two shots per run are `far`; the rest alternate `centre`/`offset`.
4. Calls `startGrab()`, then **polls `game.state` for transitions** rather
   than waiting once for a terminal state: if the state hasn't changed for
   `BEAT_STALL_MS` (60s — every named beat in `BEAT` is under 1s of game
   time, so this is very generous), the grab is recorded as a stall (beat
   name + how long it sat there), the page is closed and a fresh one opened,
   and the harness moves on to the next grab. A crashed page (an `evaluate`
   that throws mid-poll) is treated the same way. This is what makes `drama`
   able to finish a report even while the state machine it's driving is
   still being worked on elsewhere.
5. On a real win, clicks `#btn-again` to dismiss the reveal.
6. Reads `game.dramaLog[game.dramaLog.length - 1]` for the game's own claim
   (`grabType`, `outcome`, `chute`, `events`, `score`, `retried`).

Prints one row per grab (stalled grabs show `STALL` with the beat/duration in
the `flag` column), then a summary: pass/fail against "every grab scored at
least `MIN_DRAMA`" (parsed live from `src/contracts.js`), the distribution of
`outcome`, `chute`, **and `grabType`** (if every scored grab returns the same
`grabType`, the summary prints a loud `*** WARNING ***` — the grab-point
mechanic is not varying by aim), how often `retried` was true, how many
grabs stalled, and the aggregate independent-measurement stats.

It also explicitly calls out **mismatches**: any grab where the game's own
log claims a nonzero score but the harness's independent before/after
measurement saw no body move (< 1cm translation, < 1deg rotation, nothing
removed from the pile) — that mismatch is the one bug this tool exists to
catch, and it is reported by grab number with both the game's claim and the
harness's measurement side by side.

Exits 1 if any grab fails the guarantee, if any grab stalled, if any grab
mismatched, if `game.dramaLog` never appears (the drama director hasn't
landed yet — reported as a clear failure rather than a crash), or if there
were any console/page errors or timeout warnings.

## `beats`

Drives a single grab and screenshots `tools/out/beat-<nn>-<state>.png` on
every `game.state` change (polled, not timed), then prints the wall-clock
timestamp of each transition. If the sequence stalls (no state change for 5
minutes of wall-clock time), it prints a WARN and reports whatever states it
did capture rather than throwing an unhandled error. Use this to eyeball the
choreography frame by frame — it's the only subcommand meant to be looked at
rather than graded.

## `shots`

Screenshots `tools/out/shot-<viewport>.png` for:
iPhone portrait (390x844), iPhone landscape (844x390), iPad portrait
(820x1180), iPad landscape (1180x820), plus the collection room in portrait.
For the room shot, `localStorage['nuigurumi-crane.collection.v1']` is seeded
(via `context.addInitScript`, before any page script runs) with a handful of
toys in the shape `src/storage.js` expects, then `#btn-room` is clicked. A
viewport whose page never boots is skipped (with a WARN) rather than aborting
the remaining viewports.

## `perf`

Waits for the play scene to boot and for every pile body to report
`sleeping === true` (steady state, 15s deadline — see the failure-handling
section above), then reads `renderer.info` and prints draw calls, triangles,
programs, textures, geometries, a `scene.traverse` mesh count, and the
current pixel ratio. PASS/WARN against 340 draw calls and 120,000 triangles.
If the pile never settles in time, it still measures and reports the
renderer stats (labelled "NOT settled") plus the pile diagnostic (asleep
count, max speed, highest centre, wall overlaps). This subcommand does not
touch `game.dramaLog` and runs against the game as it exists today.

## `settle [N]`

A fast, focused check of the prize heap, since that is the current fault
line. Loads the page once, then for each of N runs (default 3 — freshly
reseeded with `game.newRound(true)` after the first, so a lucky layout can't
carry the check) polls until the pile stops moving or the 15s deadline
passes, then reports and PASS/FAILs on:
- bodies asleep (expect all of them),
- bodies whose sphere crosses an interior wall — `|pos.x| + radius > CAB.inX`
  or `|pos.z| + radius > CAB.inZ` (expect zero),
- highest body centre, which must exceed 1.4x a single toy's own resting
  height (`radius * 0.93`, mirroring `Body.floorY`) or the heap has
  collapsed to one layer,
- how many bodies have `covered > 0` after `game.pile.refreshCoverage()`
  (expect at least one buried toy).

`CAB.inX` / `CAB.inZ` are read live out of `src/cabinet.js` by parsing the
`export const CAB = { ... }` block — never hardcoded here, the same approach
`readContract()` already used for `src/contracts.js`.

As of this writing the live game **fails** `settle`: the heap consistently
settles flat (max body centre ≈0.33m, well under the ≈0.46m one-layer-margin
threshold), several bodies sit past the interior walls, and no body is ever
buried (`covered` is always 0 across every run) — the pile is not building a
three-layer heap. This is the fault line `tools/check.mjs perf`'s original
120-second timeout was quietly hiding.

## No new dependencies

`playwright` is imported by absolute path from the scratchpad's
`node_modules` (see `PLAYWRIGHT_ENTRY` in `check.mjs`) — nothing is added to
the repo. `check.mjs` is plain Node ESM (the `.mjs` extension is enough;
`node --check tools/check.mjs` passes with no `package.json` anywhere in this
directory or the repo root).
