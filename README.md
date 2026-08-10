# にじいろ・グラスタワー / Rainbow Glass Tower

A gentle, spectacle-first web toy/game for young children (designed for a 4-year-old),
playable on iPhone and iPad in portrait and landscape.

**How to play**

- **Tap the cloud** (or anywhere in the empty sky) — the cloud starts pouring
  sparkling rainbow drink and keeps pouring, so both hands stay free.
  Tap the cloud again to stop.
- **Drag a glass bowl sideways** — it tilts (held upright by invisible magic, it
  never falls) and its overflow shifts from 50:50 toward 80:20 up to 100:0,
  steering the whole cascade underneath it. Let go and it springs back.
- **Touch the falling water** — your finger becomes a magic deflector: every
  stream within reach bends toward it, strongest right under the fingertip and
  fading with distance. Drag slowly to bend the waterfalls into other glasses;
  swipe fast to burst them into spray.

Fill every glass to set off a fireworks celebration and earn a star sticker.
The big rainbow button replays with a new drink color.

## Design notes

The glasses are **stemmed coupes**. That shape is what makes the toy playable:
the bowl is the only wide part, so the entire region where liquid falls is open
space. On an iPhone the corridor between neighboring stems is ~35px (a tumbler
tower of the same glass count leaves ~12px), and rows float ~30% of a glass
height apart, so every waterfall is visible and reachable by a small finger.

The tower is sized automatically: as many rows as fit with touch-friendly
glasses — 10 rows / 55 glasses on iPhone portrait, 11 / 66 on a Pro Max,
14 / 105 on iPad landscape, 18 / 171 on iPad portrait — capped by a live
frame-time monitor that lowers effect quality tiers (particles, DPR, extras)
before ever shrinking the tower. A full run takes roughly 1.5–2 minutes.

Rendering is sprite-cached Canvas 2D: static glass art, the bowl's liquid, and
the stream ribbon are each drawn once per frame and blitted per glass, and rim
glows are batched into a single composite pass. No dependencies, no build step.

## Run

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk also works.

## Structure

- `index.html` — page + minimal button UI (sound, reset, replay)
- `css/style.css` — layout, safe-area handling, replay button animation
- `js/audio.js` — tiny WebAudio synth (pour noise, chimes, fanfare, boing)
- `js/game.js` — overflow-graph simulation + optimized Canvas 2D rendering
- `js/main.js` — pointer routing (cloud / tilt / deflect), buttons, resize

## Test hooks

- `?sim=N` — deterministic fast-forward: N seconds of pouring
- `?script=tilt:r:i:bias;grab:r:i:L|R:tr:ti;cloudgrab:tr:ti` — scripted inputs
- `?rows=N` — force a row count (bypasses adaptive sizing)
- `?bench=N` — synchronous CPU benchmark, result in `document.title`
- `?auto`, `?turbo`, `?round=N` — demo pour / 6× speed / start theme

`window.__RGT__.test` exposes `geom()`, `pos(r,i)`, `bias(r,i)`, `grabCount()`,
`isPouring()` and friends for browser-driven tests.
