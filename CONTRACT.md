# Spun Sugar — Architecture Contract (v1)

**This file is the single source of truth.** Written by the orchestrator. Agents MUST conform.
Game: one-finger mobile web toy for a 4-year-old. Swipe left/right over warm caramel with a tool
→ ultra-fine translucent amber sugar threads span two anchor points in mid-air → threads accumulate
into a glowing nest → lift the nest onto a dessert. No score, no text needed to play.

## Tech baseline
- Vanilla ES modules, **no build step, no external libs, no image/audio assets** (all procedural).
- Single `<canvas id="game">`, Canvas **2D** context. DPR capped at 2.
- Target: 60fps on iPhone. Portrait AND landscape. `touch-action:none`.
- Visual style: dark, low-saturation warm background; hero = thin translucent amber threads that
  catch light (use `globalCompositeOperation:'lighter'` sparingly, batched strokes).

## File ownership (STRICT — never edit a file you don't own)
| File | Owner | Role |
|---|---|---|
| `index.html` | orchestrator | frozen |
| `CONTRACT.md` | orchestrator | frozen |
| `js/bus.js` | orchestrator | frozen event bus |
| `js/state.js` | orchestrator | frozen state factory |
| `js/config.js` | orchestrator | frozen cross-module constants |
| `css/style.css` + `js/main.js` | agent **A1 app-shell** | boot, loop, phases |
| `js/input.js` | agent **A2 input** | pointer, swipe detection |
| `js/scene.js` | agent **A3 scene** | background, pot, anchors, dessert, camera |
| `js/tool.js` | agent **A4 tool** | dipper tool, caramel load, dip/drip visuals |
| `js/threads.js` | agent **A5 threads** | HERO: sugar thread system |
| `js/finish.js`, `js/audio.js` | agent **A6 finish** | nest lift finale, celebration, procedural sound |

Module-private tuning constants live INSIDE the owner's file, not in config.js.
Agents must not run git commands; the orchestrator commits between waves.

## Module interface (every js module in the table exports `default`)
```js
export default {
  init({ canvas, ctx, bus, state, config }),  // called once, in this order: scene, threads, tool, input, finish, audio
  resize(state),            // canvas size already updated in state.w/state.h/state.dpr
  update(dt, state),        // dt seconds (clamped ≤ 0.05); called every frame
  render(ctx, state),       // may be absent (input.js, audio.js)
}
```
`main.js` (A1) per-frame order:
1. update: `input, scene, tool, threads, finish, audio(optional)`
2. `ctx.setTransform(dpr,0,0,dpr,0,0)`; clear.
3. `scene.applyCamera(ctx, state)` (extra named export on scene) — applies translate/zoom.
4. render: `scene` (background+pot+dessert+anchors), `threads`, `tool`, `finish` (cues/sparkles).
5. `ctx.restore()` is A1's job via save/restore around camera.

## Shared state (created by `state.js` — shape is FROZEN; owners write ONLY their fields)
```js
state = {
  phase: 'play',        // 'play' | 'lift' | 'celebrate'   — owner: A1 (transitions on bus events)
  time: 0, w: 0, h: 0, dpr: 1,                            // owner: A1
  pointer: { x:0, y:0, down:false, vx:0, vy:0, speed:0 }, // owner: A2 (CSS px, always updated)
  tool:    { x:0, y:0, angle:0, caramel:0, dipping:false },// owner: A4 (caramel 0..1 = load on tool)
  layout:  null,        // owner: A3, set in init+resize. See Layout below.
  camera:  { x:0, y:0, zoom:1 },                          // owner: A3
  nest:    { fullness:0, ready:false, lift:0, x:0, y:0 }, // fullness/ready: A5. lift progress 0..1 + nest pos during lift: A6
}
```

### Layout (A3 computes from w/h; all coords CSS px)
```js
state.layout = {
  isPortrait,
  pot:     { x, y, rx, ry },        // glossy caramel pot, bottom-left area
  anchors: [ {x,y}, {x,y} ],        // two spun-sugar anchor posts, upper-middle, wide apart
  span:    { x0, x1, y },           // the airspace between anchors where threads form
  nestHome:{ x, y },                // center of the thread nest (midpoint under span)
  dessert: { x, y, r },             // dessert plate, bottom-right area
}
```
Layout must give the swipe zone (between/around anchors) the biggest screen share in both orientations.

## Bus events (js/bus.js: `bus.on(name, fn)`, `bus.emit(name, payload)`)
| Event | Payload | Emitter | Listeners (typical) |
|---|---|---|---|
| `pointer:down` | `{x,y}` | A2 | A6 (lift grab), audio unlock |
| `pointer:up` | `{x,y}` | A2 | A4, A6 |
| `swipe` | `{speed, dir}` | A2 on each L↔R direction reversal while down | A5 (arc variation), audio |
| `tool:dipped` | `{}` | A4 when tool refills at pot | audio |
| `threads:added` | `{delta, total}` | A5 (≤ a few times/sec) | A4 (consume caramel), audio shimmer |
| `nest:ready` | `{}` | A5 once when fullness ≥ 1 | A6 (show cue), A3 (dessert glow), audio |
| `lift:start` | `{}` | A6 when player grabs ready nest | A1 → phase='lift' |
| `nest:placed` | `{}` | A6 when nest lands on dessert | A1 → phase='celebrate', A3 (slow camera zoom-in), audio |
| `game:reset` | `{}` | A6 after ~4s celebration | A1 → phase='play', all modules reset via their `onReset` handling |

Every module must listen to `game:reset` itself and restore its own state (A5 clears threads, A4 refills caramel via auto-dip, A3 resets camera, …).

## Gameplay contract (who decides what)
- **A2 input**: pointer state every frame; a `swipe` = horizontal direction reversal (or pointer-up)
  with min travel ~40px. No game logic beyond that.
- **A5 threads** reads `state.pointer` + `state.tool` each frame during `phase==='play'`:
  when `pointer.down && pointer.speed > threshold && tool.caramel > 0` and the pointer is in/near the
  span airspace, it continuously spawns strands (rate scales with speed; 2–5 strands per pass).
  Strand look: sagging curve anchored near `anchors[0]↔[1]` with per-strand sag/jitter; faster swipe
  → slightly straighter & thinner, slower → thicker droopier. Also brief trailing wisps at the tool tip.
  A5 updates `nest.fullness` (0..1, reach 1 after ~8–12 passes) and emits events per table.
- **A4 tool**: tool follows pointer smoothly (spring). Touching pot ⇒ auto-dip animation
  (~0.4s, `dipping=true`, glossy caramel blob + 1–2 drips), sets `caramel=1`, emits `tool:dipped`.
  Caramel drains via `threads:added` (full load ≈ 2–3 passes). At `caramel==0` threads stop —
  the child naturally returns to the glossy pot (A3 makes the pot subtly pulse when caramel low —
  read `state.tool.caramel`).
- **A6 finish**: on `nest:ready` show a soft pulsing halo around nest + dessert. When pointer goes
  down inside nest area (while ready), emit `lift:start` and animate `nest.lift` 0→1 moving nest
  (follow finger loosely, then snap/glide onto dessert; if finger released early, glide anyway —
  a 4yo must never fail). Then `nest:placed`, sparkles/light sweep across threads, `game:reset`.
- **A5 during lift/celebrate**: render the whole thread system translated/scaled to `(nest.x,nest.y)`
  per `nest.lift`, condensing into a dome-shaped nest.

## Performance contract (A5 especially)
- ≤ ~140 live stroked strands. Older strands get **baked** into 1–3 offscreen canvases
  (redrawn only when baking) composited as images each frame → looks like hundreds of threads.
- Batch strokes: group strands into ≤ 4 style buckets per frame, one `beginPath()` per bucket.
- No shadowBlur on per-strand paths (allowed on ≤ 3 big cached layers). No per-frame allocations in hot loops.

## Definition of done
First swipe visibly makes threads within 100ms; finger direction matches thread direction; repeat
swipes obviously add more; stays smooth as nest fills; finale reads as "I made that"; playable with
zero text. Any on-screen text is decorative only.
