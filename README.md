# にじいろ・グラスタワー / Rainbow Glass Tower

A gentle, spectacle-first web toy/game for young children (designed for a 4-year-old),
playable on iPhone and iPad in portrait and landscape.

**How to play**

- **Tap the cloud** — it starts pouring milky white drink and keeps pouring, so
  both hands stay free. Tap the cloud again to stop.
- **Tap a colour swatch** in the bar at the bottom — it arms your finger with
  that colour (tap the same swatch again to disarm it). With a colour armed,
  tapping the cloud dyes the pour itself and always starts it — a coloured tap
  can never stop the pour.
- **Drag a glass bowl sideways** — it tilts (held upright by invisible magic, it
  never falls) and its overflow shifts from 50:50 toward 80:20 up to 100:0,
  steering the whole cascade underneath it. Let go and it springs back.
- **Touch the falling water** — your finger becomes a magic deflector: every
  stream within reach bends toward it, strongest right under the fingertip and
  fading with distance. Drag slowly to bend the waterfalls into other glasses;
  swipe fast to burst them into spray. If a colour is armed, that same touch
  also dyes the stream, and the colour keeps flowing downhill into whatever
  glass it reaches next.

A glass's colour freezes the instant it fills — nothing can change it after
that, so the order glasses fill in (which tilting and deflecting control) is
what permanently decides the finished pattern.

Fill every glass to set off a fireworks celebration and earn a star sticker;
the finished tower is saved as a thumbnail into the album (top-left button, so
she can look back at earlier towers). The big rainbow button replays with a
new sky theme.

## Design notes

The glasses are **stemmed coupes**. That shape is what makes the toy playable:
the bowl is the only wide part, so the entire region where liquid falls is open
space. On an iPhone the corridor between neighboring stems is ~34px (a tumbler
tower of the same glass count leaves ~12px), and rows float ~30% of a glass
height apart, so every waterfall is visible and reachable by a small finger.

The tower is sized automatically: as many rows as fit with touch-friendly
glasses, after reserving space for the colour palette bar at the bottom —
10 rows / 55 glasses on iPhone portrait, 11 / 66 on a Pro Max, 13 / 91 on
iPad landscape, 18 / 171 on iPad portrait — capped by a live frame-time
monitor that lowers effect quality tiers (particles, DPR, extras) before ever
shrinking the tower. A full run takes roughly 1.5–2 minutes.

Colour is a tiny model on purpose: each glass, the cloud, and the pooled table
puddle just carry a `{h, c}` tint (hue + purity; `c === 0` is plain white
milk), mixed volume-weighted wherever liquid combines, so two colours never
turn brown or grey — they blend toward each other's hue, or cancel toward
pearly white if they're near-opposite. Two rules make the cascade the whole
point instead of a decoration:

- **Colour can only enter through the cloud or a stream, never a glass
  directly.** If a tap could dye a glass on the spot, a child would just tap
  every glass in the tower and the branching structure underneath — the whole
  reason for tilting and deflecting — would stop mattering.
- **A full glass passes on whatever colour is flowing through it right now,
  not its own frozen colour.** A glass locks its displayed colour the moment
  it fills, but its overflow still carries this frame's actual inflow onward.
  Without that, once the top rows filled the lower rows could never be
  painted at all — the tower would go permanently colour-blind from the top
  down.

Rendering is sprite-cached Canvas 2D: static glass art, each bowl's liquid,
and the stream ribbon are drawn once per distinct colour and blitted per
glass (an LRU cache keyed by a quantised tint, bounded so an arbitrarily
colourful tower stays cheap), and rim glows are batched into a single
composite pass. No dependencies, no build step.

## Run

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk also works.

## Structure

- `index.html` — page + minimal button UI (sound, reset, replay, album)
- `css/style.css` — layout, safe-area handling, replay button animation
- `js/color.js` — the `{h,c}` tint model: mixing, CSS conversion, the 7-colour palette
- `js/liquid-art.js` — cached bowl/stream sprite rendering for any tint
- `js/audio.js` — tiny WebAudio synth (pour noise, chimes, fanfare, boing, paint blip)
- `js/palette.js` — the colour swatch bar (arms/disarms the painting brush)
- `js/album.js` — saves finished towers as thumbnails and shows the gallery
- `js/game.js` — overflow-graph simulation, colour flow/freezing, optimized Canvas 2D rendering
- `js/main.js` — pointer routing (cloud / tilt / deflect), palette/album wiring, buttons, resize

## Test hooks

- `?sim=N` — deterministic fast-forward: N seconds of pouring
- `?script=tilt:r:i:bias;grab:r:i:L|R:tr:ti;cloudgrab:tr:ti;paint:r:i:L|R:h:c` — scripted inputs
- `?rows=N` — force a row count (bypasses adaptive sizing)
- `?bench=N` — synchronous CPU benchmark, result in `document.title`
- `?auto`, `?turbo`, `?round=N` — demo pour / 6× speed / start theme

`window.__RGT__.test` exposes `geom()`, `pos(r,i)`, `bias(r,i)`, `grabCount()`,
`isPouring()`, `tintAt(r,i)`, `cloudTint()`, `poolTint()`,
`paintStream(r,i,side,tint)` and friends for browser-driven tests.
`window.Game` (same object) also exposes `setBrush(tintOrNull)`,
`getBrush()`, and `getTintGrid()` — the colour data the album thumbnail is
built from.
