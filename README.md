# Croquembouche

丸いお菓子を、甘いのりでくっつけて大きな塔にする。

A small 3D web game for phones and tablets, built for a four year old.
There is no score, no timer, no shop and no text — only the thing a
croquembouche actually is: choux buns glued together with caramel, ring by
ring, until a tower stands on the bench.

## The loop

1. Touch anywhere — the waiting choux comes to your finger.
2. Carry it over the copper pot. The caramel reaches for it, the bottom goes
   glossy amber and a thread pulls away as you lift.
3. Carry it to the tower. Every open seat in the current ring lights up and
   pulls; let go and it snaps home with a soft knock.
4. Close a ring and the next one starts, a little smaller and a little higher.
   The camera rises with it.
5. The very last choux lands alone on the summit.
6. Then a fork appears: sweep left and right and threads of spun sugar wrap
   the tower until it glitters. The camera pulls back for the reveal.
7. Tap the circular arrow to build another one.

18 choux across five rings (6 → 5 → 4 → 2 → 1). A tower takes two to four
minutes.

## Running it

Any static file server works — the game is plain ES modules with three.js
vendored into `vendor/`, so there is no build step and no network access at
runtime.

```sh
npm start            # http://localhost:8080/
# or: python3 -m http.server 8080
```

On iPhone/iPad open the URL in Safari. Sound starts on the first touch
(iOS requires a gesture before audio can play).

## Layout

| path              | what it holds                                                        |
| ----------------- | -------------------------------------------------------------------- |
| `index.html`      | page shell, viewport/gesture setup, the wordless "again" button       |
| `src/game.js`     | the whole game: input, magnets, dipping, stacking, sugar, camera      |
| `src/world.js`    | bench, pot, bowl, base plate, lights, materials, sparkle system       |
| `src/geo.js`      | procedural choux + caramel-shell geometry, strands, canvas textures   |
| `src/audio.js`    | every sound, synthesised with WebAudio (no audio files)               |
| `vendor/`         | three.js r169 (MIT), vendored so the game runs offline                |
| `serve.mjs`       | dependency-free static server for local play                          |

## Notes on the feel

- **Nothing to aim at.** A touch anywhere picks up the choux and eases it to
  the finger, so a four year old cannot miss the target.
- **One magnet at a time.** Before the choux is dipped only the caramel pulls
  and only the pot glows; after it is dipped only the tower pulls and the open
  seats appear. There is never a choice about what to do next.
- **No failure state.** Releasing an undipped choux hops it back to the bowl
  and makes the pot glow harder. Releasing a dipped one always lands it.
- **Everything is procedural.** Choux are displaced spheres with baked-in
  vertex colour (five shared shapes, so the GPU sees five geometries and one
  material), caramel is a clamped copy of the same shell, and the sounds are
  oscillators. The whole game is the vendored three.js plus ~40 KB of source.
- **Two compositions.** In landscape the pot and bowl sit either side of the
  tower; in portrait they move toward the viewer so the frame stays tall. The
  camera fits the scene analytically each frame, so the tower never leaves the
  screen at any height or aspect ratio.
