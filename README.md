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

Three geometric facts make the *bridge* setting work, and every generated round
is built to satisfy them:

* **Overhang** — the box sticks out past each bar far enough for a prong to get
  down beside an end.
* **Tip-in** — the box is short enough that the moment one end loses its bar,
  the centre of mass is already inside the gap, so it tips **in** rather than
  being shoved off the far side.
* **No-jam** — `hypot(height, depth) < gap`, so whatever angle the box starts
  dropping in at, the gap is always wide enough for it to keep going. Without
  this rule a box can lock diagonally across the bars and no amount of poking
  will free it — that single constraint is the difference between "wedged
  forever" and the ズルッ slip.

**The claw reaches, it does not just press.** The prongs are longer than the box
is tall, and on a grab aimed at an end the machine folds the prong that would
land on the lid up out of the way, so the other one drops all the way down the
side of the box before closing. That is what makes the result depend on where
you aimed instead of on where the claw happened to bottom out:

| aim | what happens |
| --- | --- |
| an **end** | the closing prong sweeps into that end's side face; the box slides across the bars, away from the claw |
| an end's **near or far corner** | the same push is now off-centre, so the box also yaws 10–20° — the near and far corners turn it opposite ways |
| the **middle** | both prongs come down on the lid, the claw presses, and the box barely moves |

Everything above is contact between simulated bodies. On top of it sits a small
amount of invisible help, none of which can fire unless a prong is genuinely
touching the box: aim magnetism onto the two ends (the middle is never magnetic,
so "aim at the middle" keeps meaning it), a nudge in exactly the direction the
contact geometry already implies, a little more of it after grabs that achieved
little, a bias that prefers dropping the box **into** the gap over shoving it
off an outside edge, and a nudge for a box that has half fallen in and stalled.

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
node test/progress.mjs 6       # head-less: per-grab slide/turn/tilt and bar-contact state,
node test/progress.mjs 6 alt   #   plus the share of grabs that visibly changed anything
node test/tip.mjs              # head-less: where the box stops being stable on the bars
node test/depth.mjs            # head-less: how deep the claw actually reaches beside the box

node server.mjs 8080 &
node test/e2e.mjs --shots      # real Chromium: portrait + landscape + iPad, drag, grab,
                               # repeated state change, the fall, the landing, next round
node test/shot.mjs             # screenshots for eyeballing a visual change
node test/fallshot.mjs         # screenshots of the teeter → slip → land sequence
```

`test/e2e.mjs` aims the way a player does — drag, look at where the claw ended
up, correct — so it exercises the real touch → projection → crane loop rather
than trusting any internal mapping.

Measured on the head-less runs: every round is won; a deliberate strategy takes
about three to five grabs and a child-like one that alternates ends and corners
every single time takes about eight. **Every grab in the deliberate runs
produces a visible change** (>0.7 cm of travel, >4° of turn or >4° of tilt), and
around nine in ten do even under the alternating worst case. Typical single
grab: 1–2 cm of slide and 10–20° of turn. The box drops between the two bars,
rather than off an outside edge, in roughly nine rounds out of ten.
