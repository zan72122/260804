# ろうと いろの ぬの — a batik tulis game

A browser game for a four year old, about the one thing that makes batik
*batik*: **the lines you draw first are gone at the end, and the colours they
were hiding are all that remain.**

Open `index.html` (any static server; ES modules need `http://`, not `file://`)
and press はじめる.

```
npx http-server . -p 8080 -c-1
```

Runs in Safari on iPhone and iPad, portrait and landscape. No build step, no
dependencies, no network calls, no assets — the whole workshop is generated
geometry and the sounds are synthesised at runtime.

## What you do

A craft robot holds the canting. The child's finger only guides its hand, so
nothing hot is ever theirs to handle.

1. **Pick a motif** — a big flower, clouds, waves and a bird, stars and leaves,
   or a blank cloth.
2. **とろーっ** — trace the guide. Molten wax runs out of the canting's spout,
   a hair above your fingertip, and sets as a raised amber line. Slow gives a
   fat line, quick gives a fine one, pausing leaves a droplet. Every speed
   works; a wobbly finger gets pulled gently onto the guide.
3. **ザブン** — swipe down. The cloth touches the indigo with a *chapun* and a
   ring of ripples, the colour climbs the fibre with a ragged wet line, and the
   wax refuses it. Swipe up and it comes out heavy and dripping.
4. **More wax** — this round seals the blue you want to keep.
5. **The soga bath** — brown over the open cloth; brown over blue goes almost
   black, exactly as it does in a real workshop.
6. **するする** — the wax removal. Sweep sideways: the wax clouds, softens,
   flattens, breaks into pale flakes and drifts off. Wherever it leaves, the
   colour it was protecting appears for the first time.
7. **バサッ** — swipe wide and the finished cloth flies open, the far edge
   catching up a beat late.

Then: the same motif again, a different one, or free drawing.

## The idea

Not a colouring game. A game about **reserving a colour for later**.

The chip in the top corner always shows the colour the wax is holding on to
right now — cream during the first round, indigo during the second. So the
question a child is actually answering is not *what colour shall I paint this*
but *what colour do I want to still be here at the end*. Put the wax on the
petals first and the petals stay white; wax the centre after the blue bath and
the centre stays blue. Same flower, different order, different cloth.

That is why it is worth replaying: to find out what you reserved.

## No way to lose

No timer, no score, no failure state. Wax cannot drip and spoil the cloth, the
wrong dye cannot ruin it, and running out of wax just makes the pot glow. Every
gesture also has a big button behind it, so a child who cannot manage the swipe
still gets the whole chain.

## How it is built

Plain ES modules and one WebGL2 context. No framework.

| File | What it does |
| --- | --- |
| `js/fabric.js` | The cloth's memory: a colour texture and a wax texture. The whole batik causality lives in the dye pass — it darkens every texel *except* the ones the wax is sealing. |
| `js/cloth.js` | Verlet cloth: sags on the frame, gets heavier where it soaks up dye, piles up inside the tub, and its free edges lag when it is shaken out. |
| `js/scene.js` | The workshop — floor, walls, window, gawangan, tubs, the robot and its two-bone IK arm — all generated geometry with a sun shadow map. |
| `js/shaders.js` | Weave, wax relief and gloss, subtractive dye absorption, the translucent bath, nglorod, bloom and grade. |
| `js/game.js` | The phase chain and every gesture. |
| `js/patterns.js` | Motifs, split into a first and second waxing round. |
| `js/audio.js` | Every sound, synthesised: the pour, the *chapun*, drips, the shimmer of wax letting go, the *basa*. |

Rotating the device changes only the camera framing and the layout. The wax
you have drawn, the dye history and the colour record all survive — and if the
browser drops the GL context, `fabric.js` replays its journal so a half-finished
cloth is never lost.

## Culture

The process, the tool and the motifs are described in
[`docs/culture.md`](docs/culture.md), including why the game deliberately does
*not* hand a child a traced copy of parang or kawung.
