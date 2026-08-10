# tools/

A headless Playwright harness for the plush-crane game, driven against the
static server already serving this repo. Everything lives in one file,
`check.mjs`, with four subcommands:

```sh
node tools/check.mjs drama [N]   # default N = 24: run N grabs, check the drama guarantee
node tools/check.mjs beats       # one grab, screenshot every FSM state
node tools/check.mjs shots       # four device viewports + the collection room
node tools/check.mjs perf        # renderer stats vs. draw-call/triangle budgets
```

All four:
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
generous timeout, so a hung or broken state machine fails with a clear
"timed out waiting for X, game.state was Y" message instead of the harness
silently racing ahead of (or behind) the game.

## `drama [N]`

Runs N grabs. For each one it:
1. Waits for `game.state === 'aim'`.
2. Snapshots every `pile.bodies[i]` (position, quaternion, radius, species) —
   this is the harness's **own, independent measurement**, taken before and
   after the grab and diffed by identity (each body is tagged with a stable
   id on first sight, so a body that leaves the pile because it was won is
   detected as "removed" rather than silently dropped from the diff). It does
   not rely on anything the game itself reports. Reported per grab: max
   translation (m), max rotation (deg), and how many *other* bodies moved more
   than `DRAMA.NEIGHBOUR` metres (read out of `src/contracts.js`, not
   hardcoded).
3. Picks an aim point in one of three categories, derived live from
   `pile.bodies` — logged per grab:
   - `centre` — exactly on a toy's position (clean catch by the README's rules).
   - `offset` — 0.55-0.95m off a toy (deliberately in the slip/push band).
   - `far` — as far from every toy as the aim plane allows (probed by asking
     `game.setAim()` to clamp an out-of-range point, so the true cabinet
     bounds never need to be hardcoded here).
   About two shots per run are `far`; the rest alternate `centre`/`offset`.
4. Calls `startGrab()`, waits for `game.state` to reach `'won'` or return to
   `'aim'`, and if it won, clicks `#btn-again` to dismiss the reveal.
5. Reads `game.dramaLog[game.dramaLog.length - 1]` for the game's own claim
   (`grabType`, `outcome`, `chute`, `events`, `score`, `retried`).

Prints one row per grab, then a summary: pass/fail against "every grab scored
at least `MIN_DRAMA`" (parsed live from `src/contracts.js`), the distribution
of `outcome` and `chute`, how often `retried` was true, and the aggregate
independent-measurement stats. Exits 1 if any grab fails the guarantee, if
`game.dramaLog` never appears (the drama director hasn't landed yet — this is
expected until wave 2 lands, and is reported as a clear failure rather than a
crash), or if there were any console/page errors.

## `beats`

Drives a single grab and screenshots `tools/out/beat-<nn>-<state>.png` on
every `game.state` change (polled, not timed), then prints the wall-clock
timestamp of each transition. Use this to eyeball the choreography frame by
frame — it's the only subcommand meant to be looked at rather than graded.

## `shots`

Screenshots `tools/out/shot-<viewport>.png` for:
iPhone portrait (390x844), iPhone landscape (844x390), iPad portrait
(820x1180), iPad landscape (1180x820), plus the collection room in portrait.
For the room shot, `localStorage['nuigurumi-crane.collection.v1']` is seeded
(via `context.addInitScript`, before any page script runs) with a handful of
toys in the shape `src/storage.js` expects, then `#btn-room` is clicked.

## `perf`

Waits for the play scene to boot and for every pile body to report
`sleeping === true` (steady state), then reads `renderer.info` and prints draw
calls, triangles, programs, textures, geometries, a `scene.traverse` mesh
count, and the current pixel ratio. PASS/WARN against 340 draw calls and
120,000 triangles. This subcommand does not touch `game.dramaLog` and runs
against the game as it exists today.

## No new dependencies

`playwright` is imported by absolute path from the scratchpad's
`node_modules` (see `PLAYWRIGHT_ENTRY` in `check.mjs`) — nothing is added to
the repo. `check.mjs` is plain Node ESM (the `.mjs` extension is enough;
`node --check tools/check.mjs` passes with no `package.json` anywhere in this
directory or the repo root).
