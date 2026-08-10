# にじいろ・グラスタワー / Rainbow Glass Tower

A gentle, spectacle-first web toy/game for young children (designed for a 4-year-old),
playable on iPhone and iPad in portrait and landscape.

**How to play**
- **Touch and hold empty space** — a smiling rain cloud pours sparkling rainbow
  drink into the top glass. Full glasses overflow into the rows below, cascading
  down the whole tower.
- **Drag a glass sideways** — it tilts (held by invisible magic, it never falls)
  and its overflow shifts from 50:50 toward 80:20 up to 100:0, steering the
  whole cascade underneath.
- **Touch a falling stream** — your finger catches the flow like a transparent
  spoon. Drag slowly to bend the stream into a neighboring glass; swipe fast
  to burst it into spray that sprinkles nearby glasses.

Fill every glass to set off a fireworks celebration and earn a star sticker.
The big rainbow button replays with a new drink color.

## Tower size & performance

The pyramid is sized automatically: as many rows as fit the screen with
touch-friendly glasses (≈11–12 rows / 66–78 glasses on iPhone portrait, up to
16 rows / 136 glasses on iPad), capped by a live frame-time monitor that lowers
effect quality tiers (particles, DPR, accents) before shrinking the tower.
Rendering is sprite-cached Canvas 2D — no dependencies, no build step.

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
- `js/main.js` — pointer routing (pour / tilt / stream-push), buttons, resize

## Test hooks

- `?sim=N` — deterministic fast-forward: N seconds of holding the pour
- `?script=tilt:r:i:bias;grab:r:i:L|R:tr:ti;cloudgrab:tr:ti` — scripted inputs
- `?rows=N` — force a row count (bypasses adaptive sizing)
- `?bench=N` — synchronous CPU benchmark, result in `document.title`
- `?auto`, `?turbo`, `?round=N` — demo pour / 6× speed / start theme
