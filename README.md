# ころころ橋渡しクレーン

A "bridge setting" (橋渡し) crane game for mobile web, built for four-year-olds:
a printed prize box lies across two steel bars, and every grab visibly nudges,
turns or tilts it until it finally slips **between** the bars and drops into the
tray with a satisfying thud.

There is no tutorial text, no shop, no currency — one finger to aim, one big
button to grab.

## Play it

```bash
node server.mjs          # → http://localhost:8080/
```

Any static file server works; there is no build step. Open the page on an
iPhone/iPad (portrait or landscape) or in a desktop browser.

* **Drag anywhere** — the claw follows your finger across the play surface.
* **Big orange button** — the claw goes down, closes and lifts.
* Repeat until the box falls. The next prize appears a few seconds later.

## How the bridge physics works

The prize is a real rigid body (Rapier3D) resting on two cylinders; nothing is
animated by hand. The crane is modelled the way a real cabinet is:

```
trolley (kinematic)            X / Y / Z gantry motion
   │  prismatic joint + spring motor  ← the cable: vertical compliance,
   │                                    so the claw can never crush the prize
carriage
   │  spherical joint with torque-limited motors ← the swing: the claw can only
   │                                                shove sideways with a
claw head                                          believable, limited force
   │  two revolute joints with force-limited position motors
prong L / prong R (dynamic)    ← the parts that actually touch the box
```

Because both the descent and the squeeze are *force* limited rather than
position driven, the outcome comes from geometry:

* aim at an **end** → the outer prong sweeps into that end's side face and the
  box slides across the bars, away from the claw;
* aim at a **corner** (front or back) → the same push is now off-centre, so the
  box yaws 10–30° — front and back corners turn it opposite ways;
* aim at the **middle** → both prongs land on top, the box is pressed and barely
  moves.

Round geometry is generated so the two rules that make 橋渡し work always hold:
the box overhangs each bar enough for the claw to reach an end, and it is narrow
enough that once one end loses its bar the centre of mass is already inside the
gap — so the prize tips **in**, not off the far side.

A small amount of invisible help sits on top of pure simulation: aim magnetism
towards the ends and corners, a contact-gated nudge in exactly the direction the
contact geometry already implies, a stronger nudge after grabs that achieved
little, and an un-wedging nudge for a box that jams diagonally in the gap. None
of it fires unless a prong is genuinely touching the box.

## Layout

| file | purpose |
| --- | --- |
| `index.html`, `styles.css` | shell, safe-area/touch handling, the one big button |
| `src/config.js` | tuned constants and per-round setup generation |
| `src/physics.js` | Rapier world: playfield, prize, crane joints |
| `src/crane.js` | grab state machine, aim assist, hidden difficulty help |
| `src/view.js` | three.js scene, cabinet, lighting, camera framing, confetti |
| `src/prizeArt.js` | procedurally drawn package artwork (no external assets) |
| `src/audio.js` | Web Audio synthesis — motor, servo, scrape, thud, fanfare |
| `src/input.js` | pointer → play-surface projection |
| `src/main.js` | frame loop, adaptive resolution, glue |
| `vendor/` | three.js and Rapier3D, vendored so the game runs offline |

## Tests

```bash
node test/physics-sim.mjs      # head-less: resting stability, aim differences, a full round
node test/play.mjs 10          # head-less: plays 10 rounds with a deliberate strategy
node test/play.mjs 10 alt      # ...and with a child-like alternating one (worst case)
node test/map.mjs              # head-less: aim → outcome map (which aim does what)
node test/tip.mjs              # head-less: where the box stops being stable on the bars

node server.mjs 8080 &
node test/e2e.mjs --shots      # real Chromium: portrait + landscape + iPad, drag, grab,
                               # repeated state change, the fall, the landing, next round
node test/shot.mjs             # screenshots for eyeballing a visual change
node test/fallshot.mjs         # screenshots of the teeter → slip → land sequence
```

`test/e2e.mjs` aims the way a player does — drag, look at where the claw ended
up, correct — so it exercises the real touch → projection → crane loop rather
than trusting any internal mapping.

Measured on the head-less runs: every round is won, in about four to six grabs
with a deliberate strategy and five to six when ends and corners are alternated
at random, and the box drops between the two bars (rather than off an outside
edge) in roughly nine rounds out of ten.
