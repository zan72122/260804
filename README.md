# にじいろ・グラスタワー / Rainbow Glass Tower

A gentle, spectacle-first web toy/game for young children (designed for a 4-year-old),
playable on iPhone and iPad in portrait and landscape.

**How to play:** touch and hold anywhere — a smiling rain cloud pours sparkling
rainbow drink into the top glass. When a glass fills, it overflows into the
glasses below, cascading down the whole tower. Fill every glass to set off a
fireworks celebration and earn a star sticker. The big rainbow button replays
with a new drink color and a new tower shape.

## Run

Serve the folder and open it (any static server works):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk also works (no modules, no build step,
no dependencies).

## Structure

- `index.html` — page + minimal button UI (sound, reset, replay)
- `css/style.css` — layout, safe-area handling, replay button animation
- `js/audio.js` — tiny WebAudio synth (pour noise, chimes, fanfare)
- `js/game.js` — overflow-graph simulation + Canvas 2D rendering
- `js/main.js` — input (press-and-hold to pour), buttons, resize

## Test hooks

- `?auto` — pours automatically (demo/headless testing)
- `?turbo` — greatly accelerated fill/flow rates for quick verification
