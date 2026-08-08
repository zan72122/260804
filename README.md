# 鵜飼のよる — Ukai no Yoru

A quiet browser game about **ukai**, the traditional Japanese art of fishing with
cormorants by firelight. Built for a four-year-old, playable with one finger, in
portrait or landscape, on an iPhone or an iPad.

There is no score, no timer, no way to lose, and nothing to read.

```
npm install
npm run dev       # http://localhost:5173
npm run build     # -> dist/index.html  (one self-contained file)
```

The build is a single HTML file with everything inlined, so it can be opened
straight from a phone (AirDrop, Files, `file://`) as well as served over http.

---

## The evening

1. **Dusk.** The boat slips out onto the river while the light goes.
2. **Fan the fire.** Brush a finger up and down over the kagaribi. Each stroke
   makes it flare, until the whole dark river turns orange.
3. **Send the birds.** Flick a finger from a cormorant out towards the water.
   It leaps, tips head-down, and slides under.
4. **Watch the water.** Each dive leaves expanding rings, rising bubbles, and a
   pale shape moving under the surface.
5. **Feel the rope.** When a bird finds a fish its tezuna shivers along its
   whole length.
6. **Haul.** Pull a finger back towards yourself, a few strokes. The slack comes
   up out of the water, the rope goes taut, the usho works hand over hand, and
   the bird bursts back through the surface.
7. **The basket fills.** The fish arcs from the bill into the kago and stays
   there.
8. **Drift on.** A long push up-river sends the boat downstream; once the
   basket is full, that same push ends the evening.

Then a single glowing button starts it again.

## Gestures

All one finger, all deliberately forgiving. What the finger *meant* is what
counts — the target is chosen by what the touch started near, and the direction
only breaks ties. A plain tap always does a gentler version of the right thing.

| Gesture | Effect |
| --- | --- |
| Short stroke over the fire | Fan the kagaribi |
| Stroke from a perched bird towards the river | Release that bird |
| Repeated strokes back towards yourself | Haul that rope in |
| Long stroke up-river on open water | Move the boat on |

If nothing happens for a few seconds, a wordless trail of dots appears on
whatever wants a finger, and the rope of any bird waiting to be hauled shivers
harder.

## What is actually simulated

The point of the game is the handful of movements that only happen in ukai, so
those are simulated rather than animated:

- **`src/sim/rope.ts`** — each tezuna is a verlet chain with distance
  constraints *and* bending stiffness. It sags into the river when a bird is
  close, lifts clear and goes taut as the bird swims out, hangs heavy and slow
  while submerged, and carries a travelling shiver when a fish is taken. Slack
  is taken up before the bird moves, so the first haul strokes feel different
  from the last ones.
- **`src/world/cormorant.ts`** — a rigged bird, not a posed one. The neck is a
  Bezier re-swept every frame between named shapes (alert, swim, hunt, proud),
  the tail lifts as the body tips into a dive, and the wings flick water off on
  surfacing. Under water the plumage picks up a faint silver cast, the way a
  diving cormorant's trapped air does.
- **`src/world/water.ts`** — a 17-octave 1/f wave spectrum with golden-angle
  directions and deep-water dispersion, analytic normals, and Fresnel-weighted
  reflection. That is what turns the fire into a shattered orange column on
  black water instead of a milky sheet. Ripple rings from every dive, every
  surfacing bird and every dipped rope are added into the same field.
- **`src/world/usho.ts`** — two-bone IK arms. The left fist holds the whole
  bundle of ropes at once and braces against their pull; the right works hand
  over hand when you haul, and reaches for the basket when you fan.

## Layout

Portrait and landscape are two separately authored camera compositions, not one
camera being squeezed, and both are nudged further for unusually tall phones and
for the iPad's 4:3. The scene re-frames on rotation without interrupting play.

## Performance notes

Aimed at mobile Safari:

- ~170 draw calls. Hundreds of small modelled parts — reeds, basket staves,
  cage bars, straw strands, every piece of a fish and of a bird's head — are
  merged into single vertex-coloured meshes at build time (`mergeAll`).
- One shadow-casting light, sitting in the fire, so contact shadows all point
  away from the flame.
- No post-processing: the glow is additive sprites and emissive materials under
  ACES tone mapping.
- Device pixel ratio is capped at 2 and steps down automatically if frame times
  slip.

## Tools

```
node tools/preview.mjs --beat=working --vp=ip     # one screenshot of one beat
node tools/playtest.mjs                            # full loop, all four devices
node tools/sheet.mjs out.png a.png b.png           # contact sheet
```

`playtest.mjs` drives real synthesised one-finger swipes through a whole
evening at iPhone and iPad sizes in both orientations, rotates the device
mid-run, and exercises replay. Both tools wait on the game clock rather than
wall-clock, because the software renderer used in headless testing runs far
below 60fps.

Requires `playwright` (`npm i -D playwright`, or symlink a global install into
`node_modules/`).

## On the subject matter

The player never does anything dangerous — a grown-up usho does the work and
the child's finger helps. The birds are never shown struggling, there is no
blood and no violence, and the fish simply arc into the basket. The intent is
respect for a thousand-year-old craft, abstracted gently enough for a small
child.
