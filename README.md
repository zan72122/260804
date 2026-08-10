# ぬいぐるみクレーン — Plush Crane

A mobile-web claw machine built around one moment: a cold silver claw closing
around a soft toy, lifting it, and the toy's arms and ears swinging a beat
later. Aimed at a four-year-old — no reading, no small buttons, no camera
controls, one gesture and one big button.

Play by opening `index.html` from any static server.

```sh
node serve.mjs        # http://localhost:8080
```

No build step, no CDN, no binary assets. Three.js is vendored in
`vendor/three/`; every texture, mesh and sound is generated at runtime.

---

## How it plays

1. **Drag anywhere** — the target ring on the prize floor follows your finger
   one-to-one (raycast against the aim plane, with the grab offset preserved so
   your finger never hides the target). A short tap also just sends the crane
   to that spot.
2. **Press the big round button** — the claw opens, descends, touches the toy,
   closes, and lifts. Input is locked for the whole sequence.
3. **The toy swings** on its way to the chute, drops with a *ゴトン*, and is
   shown up close.
4. **もういちど** to play again, **おへや** to visit the room where every toy
   you have won actually lives. Tap one and it hops, waves, tilts its head, or
   spins. The collection is saved in `localStorage`.

### Being fair to a four-year-old

Real claw machines cheat by randomly weakening the grip. This one never does.
Outcomes are a pure function of where you aimed:

| horizontal distance to the nearest toy | outcome |
| --- | --- |
| ≤ 0.50 | clean catch |
| ≤ 0.74 | grabbed, then slips during the lift — the toy tumbles somewhere easier |
| ≤ 1.25 | pushed: it rolls, rotates, rights itself, and drifts toward the front |
| beyond that | the claw hits the mat and the whole platform jolts the pile |

A hidden assist closes part of the gap before the descent when you were nearly
right — the crane creeps a few centimetres during the "open" beat, so it reads
as the machine settling rather than as auto-aim. There is no outcome where
nothing at all changes, and no layout where a prize becomes unreachable.

---

## Structure

| file | what it owns |
| --- | --- |
| `src/main.js` | renderer, environment map, scene switching, input, adaptive quality |
| `src/game.js` | play scene: framing, aiming, the grab state machine, hero-moment camera |
| `src/claw.js` | crane rig — rails, bridge, carriage, telescoping tube, three-fingered claw |
| `src/plush.js` | the six prize species, built procedurally, with their spring rigs |
| `src/pile.js` | prize-pile simulation and per-round layout |
| `src/cabinet.js` | the machine, the prize chute, the arcade behind it, and `CAB` (all shared dimensions) |
| `src/showcase.js` | the win close-up and the collection room |
| `src/materials.js` | plush / metal / acrylic / thread shaders |
| `src/textures.js` | every texture, drawn to a canvas at load |
| `src/audio.js` | Web Audio synthesis, including the iOS unlock |
| `src/merge.js` | static-geometry merger (three's `BufferGeometryUtils` is not vendored) |
| `src/storage.js` | collection persistence |

### The plush toys

Six species — うさぎ / くま / ねこ / いぬ / ひよこ / ユニコーン — with three
colourways each, distinguished by silhouette rather than palette: long
two-segment rabbit ears, a bear's round ears and muzzle, a cat's cone ears and
three-segment tail, a dog's floppy ears and eye patch, a chick's tuft and
wings, a unicorn's horn and mane.

They read as *manufactured toys*, not creatures: embroidered bead eyes ringed
with thread, a stitched ω mouth, a crown seam over the back of the head, a
side seam around the body, joint seams, a ribbon or bell collar, and a woven
hangtag.

Materials in priority order:

1. **Short-pile fabric** — `MeshStandardMaterial` patched at
   `lights_fragment_end` with a fresnel pile term and a cheap scatter term,
   over a canvas-generated fabric normal map. A second expanded shell mesh with
   a fresnel-only alpha adds the fuzzy outline.
2. **Claw metal** — full metalness, brushed micro-scratch normals, PMREM
   environment so it picks up the cabinet's pink and blue LEDs.
3. **Acrylic** — reflections, clearcoat, edge trims and an additive smudge
   overlay. No refraction: it is not worth the fill rate.

### Secondary motion

Every dangly part (ears, arms, legs, tails, head) hangs on a pivot driven by a
damped spring fed the body's acceleration in body space, plus a "hang toward
true down" term that scales up when the toy is airborne. Squash is a separate
volume-preserving spring, kicked on landing and held while the claw grips. The
toy under the claw is a two-axis pendulum driven by the crane's acceleration.
None of it is rigid-body solving — it is all cause-and-effect a child can read.

### Performance

- Pixel ratio is capped at 1.75 and auto-tuned from a rolling frame average;
  at the lowest tier shadows and fuzz shells switch off.
- Prizes build at two detail levels: `hero` (win close-up, small collections)
  and `game` (in the case), which drops trim smaller than a stitch.
- Shared low-poly primitives, one shadow-casting mesh per toy mass, sleeping
  physics bodies, and merged static cabinet geometry.
- Roughly 56k triangles and ~275 draw calls in the play scene.

### Mobile web

`touch-action: none`, no rubber-band, no pinch, no hover anywhere, safe-area
insets on every control, `visualViewport`-driven resize, orientation handled by
re-composing the layout (portrait crops the marquee and keeps the lower third
for the button; landscape frames the whole machine and moves the controls into
the right-hand margin), audio unlocked on the first gesture, and a WebGL
context-loss handler.
