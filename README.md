# まぐろ かいたい — Giant Tuna Butchering

A browser game for a four-year-old, about the one thing that only this subject
can be about: **taking a fish the size of a person apart with a knife almost as
tall as the person holding it.**

Open `index.html` from any static server. No build step, no network access, no
installs — three.js is vendored into `vendor/`.

```
python3 -m http.server 8000     # then open http://localhost:8000
```

---

## What it is

A real WebGL 3D scene — perspective projection, real geometry, real occlusion,
real parallax and real fog — set in a fish market hall. A 2.68 m bluefin is slid
onto a work table and taken apart by a craftsman with a 1.7 m maguro-bocho.

The player never holds the knife. **The finger only shows the craftsman where
the line goes**, and he does the cutting.

### The sequence

| | |
|---|---|
| 1 | The tuna is slid onto the table; the craftsman steps up beside it with the knife |
| 2 | **Collar cut** — a long stroke from the dorsal ridge, over the flank, down to the belly |
| 3 | The head and collar come away and are set down, cut face to the crowd |
| 4 | **Roll** — a wide arc swipe chocks the fish over onto its side |
| 5 | **First pass down the backbone** — 1.5 m, nose end to tail |
| 6 | **Second pass** — one pass is not enough; the loin begins to part |
| 7 | **The lift** — an upward swipe. The loin rises *and rolls over*, so two crimson faces appear at once: the frame's, newly uncovered, and the loin's own, turned to the crowd |
| 8 | The loin is carried over and laid crimson-side up on the board |
| 9 | **Three cross cuts** into saku |
| 10 | The pieces are trimmed and lined up: akami, chutoro, otoro, in that order |
| 11 | Free play — tap any block |

No text, no timer, no score, no failure, no game over. Nothing can go wrong.

---

## Design decisions worth knowing

**Scale is the subject.** Every dimension is real and held to: the fish is
2.68 m, the craftsman 1.76 m, the blade 1.36 m on a 0.34 m handle, the table
0.735 m high. The craftsman is anchored into the camera framing at every stage
precisely so he is always available as a ruler. He walks the length of the fish
during the long cut rather than reaching — the stroke is a whole-body motion.

**The reveal is real geometry, not a trick.** The head, the upper loin (in four
future-saku segments) and the lower half with the frame are independent solids
built flush against each other. The crimson median faces exist inside the fish
from the first frame and are genuinely occluded by the pieces on top of them.
When the loin lifts, nothing fades in — a surface that was always there stops
being hidden.

**A four-year-old cannot miss.** A stroke may start anywhere on screen. The
finger is projected onto the cut path in screen space and snapped to it, so the
blade physically cannot be steered anywhere unsafe. Progress only ever moves
forward and is speed-capped, so a wild flick still produces the slow, confident
draw of a professional. Lifting the finger keeps the progress: a stroke can be
picked up again as many times as it takes, from wherever the next touch lands.
A stroke left a whisker short finishes itself.

**Nothing distressing.** The fish arrives as food, already at market. Cut faces
are clean, graded akami → chutoro → otoro with fat marbling and a pale
backbone. No blood, no viscera, no bone fragments, no anatomy.

**Depth reads at a glance.** Three separated bands: cropped foreground props for
parallax (which fade out if the camera ever closes on them, so they frame and
never block), the table and the work in the mid-ground, and a hazed far bay of
pillars, shutters, crates, other tuna on pallets and silhouetted workers. Aerial
perspective is real scene fog plus a cooler, dimmer far palette. Lighting is a
high key with a real shadow map, a cool rim off the shutters, and pendant lamps
with genuine falloff. Materials respond: polished steel, wet skin with a
clearcoat and a hint of iridescence, worn hinoki, cotton, rubber boots.

**Both orientations, live.** Nothing is baked. The camera fits itself to the
current world every frame from the stage's focus points, so rotating the device
is simply a different fit of the same live state — progress, stage and every
transform survive untouched. Portrait swings the camera round and rolls it so
the fish runs diagonally across the tall frame and reads long; landscape lays it
across the table. The subject is biased upward in frame in both, leaving the
lower band clear so a finger never covers what it is cutting; and every
separation, reveal and tidy-up plays as an animation *after* the finger lifts.

---

## Layout

```
index.html            page shell, import map, two icon buttons
css/style.css         full-bleed canvas, safe areas, no scroll/zoom on iOS
vendor/               three.js r180 (MIT), vendored so there is no CDN
src/
  main.js             renderer, resize, frame loop, HUD
  game.js             the stage machine, camera framing, choreography
  tuna.js             the fish: parametric body, separable solids, flesh grading
  knife.js            the maguro-bocho, and how it is laid against a cut
  craftsman.js        1.76 m rig: two-bone IK arms and legs, stepping, lean
  env.js              the hall: three depth bands, lights, environment probe
  paths.js            cut paths — arc-length polylines with normals and bite
  guide.js            chevron ribbon, kerf, demo hand, sparkles
  input.js            pointer capture and the stroke controller (snapping)
  audio.js            procedural draw/thud/chime; the game reads fine silent
  textures.js         every texture, drawn procedurally on a 2D canvas
```

## Automated play-through

`main.js` exposes `window.__sim(seconds, driver)`, which advances the simulation
without rendering while driving the real pointer → path → stroke pipeline. The
QA script uses it to play the whole game start to finish — including deliberately
sloppy strokes, strokes released and resumed mid-cut, and a device rotation
partway through — on iPhone and iPad viewports in both orientations.
