# たかじょう — Falconry for four-year-olds

A browser game about **鷹匠 (takajō)** — a falconer and their hawk — built for
iPhone and iPad, portrait and landscape. There is no score, no timer, no game
over and no written instruction anywhere in it.

The whole game is one chain of body actions, the chain you only ever see in
falconry:

1. **The falconer pulls on the thick leather gauntlet.** — *tap*
2. **The arm goes out level**, and the hawk steps from its bow perch onto the fist.
3. **The little brass clasp comes off** the jesses. — *tap or short tug*
4. **The arm punches forward** and the hawk beats away off the fist. — *swipe up*
5. The hawk climbs and **circles high over the field**.
6. **The lure swings** on its cord in a wide circle beside the falconer. — *draw circles with a finger*
7. The hawk's own circle **tightens toward the lure** as the child keeps it moving.
8. **The arm goes level again.** — *swipe toward the middle of the screen*
9. A speck far out over the fields **grows, spreads its wings, cups them, fans its tail**…
10. …and **lands on the fist** with a thump you can feel in the falconer's arm.

Then the hawk is back on the glove and a single swipe sends it out again. One
loop runs about two to four minutes.

## Playing it

```sh
npm install
npm run dev          # http://localhost:5173  (open it on a phone on the same wifi)
```

For a build you can host anywhere:

```sh
npm run build        # writes a single self-contained docs/index.html
npm run preview
```

`docs/index.html` is one file with everything inlined — no assets to fetch, no
server-side anything. Drop it on any static host (GitHub Pages serves `docs/`
directly) and it runs.

Add `?quality=low` to the URL to drop shadows and thin the grass on an older
device. The game also steps its own resolution down automatically if it cannot
hold a reasonable frame rate.

## How it is built

Three.js, no art assets. Every surface is generated at runtime on a 2D canvas —
leather grain and its normal map for the gauntlet, scalloped plumage for the
hawk, woven wool for the tunic, growth rings for the perch — which is why the
whole game fits in a single HTML file.

| file | what's in it |
| --- | --- |
| `src/hawk.js` | the bird: a real wing skeleton (humerus / forearm / hand) with individually fanning primaries, trailing secondaries, a spreading tail, folding legs and jesses |
| `src/falconer.js` | the falconer's rig and pose vocabulary, and the gauntlet |
| `src/world.js` | terrain out to the hills, wind-driven instanced grass, trees, fence, bow perch, lighting |
| `src/game.js` | the state machine, the flight model and the camera |
| `src/input.js` | gesture reading, tuned for small hands |
| `src/textures.js` | every procedural texture |
| `src/hints.js` | the wordless nudges |
| `src/audio.js` | synthesised wingbeats, bells and thumps — no audio files |

### Two decisions worth knowing about

**The wing is a skeleton, not a flapping card.** The whole game is built to pay
off one image — a folded bird opening into a full span and cupping its wings to
stop on a hand — and that only works if the wing actually folds. Joint angles
are computed as *absolute* sweeps from straight-outboard and converted to
relative angles at the last moment, because a tucked wing is a Z-fold (humerus
back, forearm forward, hand back again) that no chain of relative guesses ever
lands on.

**Nothing asks a four-year-old to be accurate.** Circling is measured as
accumulated turn about a rolling centroid of the last half-second of finger
positions, which tolerates lopsided, drifting, changing-direction potatoes; and
any sustained movement at all, circle or not, still drives the lure round at a
pace matched to how fast they are moving. Swipes only need to go roughly the
right way. In the two tap steps a tap anywhere works, because there is only one
thing in the world to touch — the pulsing ring is there to teach *where* the
clasp is, not to be a target. If a child hesitates, the falconer starts offering
the arm on their own.

## Playtests

```sh
npm run preview &
node tools/play.mjs iphone-portrait     # drives the whole loop twice with real gestures
node tools/shots.mjs out/               # frames from every stage, all five screen sizes
node tools/studio.mjs out/              # hawk turntable: folded / gliding / braking
```

`tools/play.mjs` runs the game with `?quality=low` and a debug time scale,
because the headless browser rasterises in software at a few frames a second.
