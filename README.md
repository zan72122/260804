# ぬいぐるみクレーン — Plush Crane

A mobile-web claw machine built around one moment: a cold silver claw closing
around a soft toy, lifting it, and the toy's arms and ears swinging a beat
later. Aimed at a four-year-old — no reading, no small buttons, no camera
controls, one gesture and one big button.

Play by opening `index.html` from any static server.

```sh
node serve.mjs        # http://localhost:8080
```

Verification harness (headless Chromium, see `tools/README.md`):

```sh
node tools/check.mjs drama 10   # every grab must produce a visible event
node tools/check.mjs settle 3   # the heap stacks, sleeps and never clips
node tools/check.mjs beats      # a screenshot per beat of one grab
node tools/check.mjs shots      # four viewports plus the collection room
node tools/check.mjs perf       # draw calls and triangles against budget
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

### Every grab is an event

The rule the whole rework is built on: **never let a grab resolve to "nothing
changed"**. A grab runs as beats, about 6.3 seconds, with two peaks — the catch
and the delivery — and nothing is ever still:

```
open → descend → touch → close → settle → [regrip] → lift → carry → teeter → release → fall
```

`touch` dents the fabric and shoves the neighbours; `close` drags the toy toward
the claw axis; `settle` is the "what's going to happen?" beat, where the claw
holds still and the toy rotates into its hanging pose. Only then is the outcome
committed.

**What the claw catches is a consequence of aim, never a die roll.** Every prize
carries grab points — body, head, ear, arm, leg, tail — resolved from its real
geometry. The caught point is pinned under the claw and the body swings around
it, so hooking a rabbit by one ear turns the whole toy over. The point also
decides whether the grip holds: an ear or a tail comes loose partway through the
lift, and the toy that slips lands somewhere easier than where it started.

A director measures what actually moved — rotation, translation, a neighbour
knocked over, a buried toy surfacing — against a snapshot taken when the claw
closed. If a grab would have produced nothing it re-grips a few centimetres over
and tries again, and failing that drags the toy over its neighbours. Scoring is
a high-water mark, not a final snapshot: a toy lifted clear and dropped back into
the same dent still counts, because the child watched it happen.

Verified headlessly by `node tools/check.mjs drama` — ten grabs across centre,
offset and far aims, every one scoring at least one event, cross-checked against
an independent measurement of every body's position and orientation.

### Being fair to a four-year-old

Real claw machines cheat by randomly weakening the grip. This one never does.
Aim decides everything, in two stages.

First, whether the fingers reach a toy at all — within about 0.74 m of the claw
axis they close on it, further out they shove it, further still they hit the mat
and jolt the whole platform.

Then **which part** they closed on, which is what decides the rest:

| caught by | holds? | what you see |
| --- | --- | --- |
| body, head | yes | lifts square and steady |
| arm, leg | yes | hangs lopsided, the free limbs swinging |
| ear, tail | no | the toy turns right over, then comes loose mid-lift |

A toy that slips lands toward the front and centre — a miss always leaves the
child better off, never worse. A hidden assist closes part of the gap before the
descent when you were nearly right: the crane creeps a few centimetres during the
"open" beat, so it reads as the machine settling rather than as auto-aim. No
layout can make a prize unreachable, and no grab can leave the case unchanged.

---

## Structure

| file | what it owns |
| --- | --- |
| `src/main.js` | renderer, environment map, scene switching, input, adaptive quality |
| `src/game.js` | play scene: framing, aiming, the grab state machine, hero-moment camera |
| `src/claw.js` | crane rig — rails, bridge, carriage, telescoping tube, three-fingered claw |
| `src/plush.js` | the six prize species, built procedurally, with their spring rigs |
| `src/pile.js` | prize-heap layout and simulation |
| `src/drama.js` | picks what the claw caught, measures what the grab did |
| `src/contracts.js` | the numbers every module agrees on |
| `src/cabinet.js` | the machine, the prize chute, the arcade behind it, and `CAB` (all shared dimensions) |
| `src/showcase.js` | the win close-up and the collection room |
| `src/materials.js` | plush / metal / acrylic / thread shaders |
| `src/textures.js` | every texture, drawn to a canvas at load |
| `src/audio.js` | Web Audio synthesis, including the iOS unlock |
| `src/merge.js` | static-geometry merger (three's `BufferGeometryUtils` is not vendored) |
| `src/storage.js` | collection persistence |

### The prize heap

Twelve toys in two tiers. The heap is **authored, not simulated**: a soft-sphere
relaxation gives no guarantee of holding a saddle across hundreds of settle
steps, and the minority of layouts where it failed left a toy either slid flat
onto the mat or ratcheted up into mid-air — both instantly obvious, neither
recoverable once the round had started. So every stacked toy is placed on a
solved tangency seat, residual overlap is pushed apart with gravity off so
nothing can slide, and the round is handed over asleep. The solver owns
everything that happens *after* the claw arrives; it no longer decides what the
shelf looks like.

Two tiers rather than three, because a plush's mesh is smaller than its
collision radius in most directions — a tall stack of touching spheres reads on
screen as toys hovering with air between them. A wide base with one row nestled
into its gaps buries four to six toys and still looks like a pile.

`node tools/check.mjs settle` asserts all of it: everything asleep, nothing
crossing the glass, nothing floating, something buried.

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
- Prizes build at three detail levels: `hero` (win close-up, small collections),
  `game` (front and top of the heap) and `far` (buried or at the back, silhouette
  and face only). Each toy's static parts are also merged per material, which is
  what makes twelve of them affordable.
- Shared low-poly primitives, one shadow-casting mesh per toy mass, sleeping
  physics bodies, and merged static cabinet geometry.
- Roughly 127k triangles and ~306 draw calls in the play scene with twelve prizes.

### Mobile web

`touch-action: none`, no rubber-band, no pinch, no hover anywhere, safe-area
insets on every control, `visualViewport`-driven resize, orientation handled by
re-composing the layout (portrait crops the marquee and keeps the lower third
for the button; landscape frames the whole machine and moves the controls into
the right-hand margin), audio unlocked on the first gesture, and a WebGL
context-loss handler.
