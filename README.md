# ぽこぽこ！クランベリー・ウェットハーベスト

A touch-first 3D cranberry **wet harvest** for phones and tablets, built for a
four-year-old who cannot read yet.

> みずを いれて、ぐるぐるして、あかい みを うかせて、あつめて、すいこむ。

One harvest day on one boomed-off section of bog, start to finish, in three
to five minutes. No score, no stars, no timer, no way to fail.

---

## The loop

| # | Verb | Gesture | What the child sees |
|---|------|---------|---------------------|
| 1 | look | — | a dry section, red fruit low on the vines, and the crew, sluice, beater, boom and truck all in one world |
| 2 | flood | swipe **up** anywhere | the sluice lifts, water pours in and finds the low ground; the level climbs while the gate is open |
| 3 | churn | **drag** | the water reel drives where the finger goes; paddles beat the surface, fruit comes off the vine |
| 4 | watch | (stir, optional) | camera drops to the waterline: berries rise through the water, break the surface and bob — then rises to show a red bog |
| 5 | corral | **pull** a buoy | hauling a handle inward takes the boom ring in; the raft is herded and packs tighter |
| 6 | connect | **drag** | the hose nozzle snaps onto the floating coupling |
| 7 | suck | **press & hold** | fruit pulls off the water, runs visibly through the clear section of hose and heaps up in the truck bed |
| 8 | again | **tap a picture** | evening light, the truck pulls away, three picture buttons |

The same-field replay button is the biggest and sits in the middle.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173  (--host is on, so a phone on the
                   # same wifi can open it directly)
npm run build      # type-check + production bundle into dist/
npm run preview    # serve dist/ on :4173
npm run typecheck
npm test           # Playwright: scripted play-throughs at four device sizes,
                   # rotation, low-graphics, free play, suspend/restore
npm run shots      # authoring sweep: screenshots every scene at two sizes
```

`?tier=low|mid|high` on the URL forces a quality tier, which is handy for
checking the low-end path on a desktop.

## How it is built

* **Vite + TypeScript + three.js**, no other runtime dependencies.
* **No downloaded assets at all.** Every mesh, colour and sound is generated
  at load time, so first load is one JS bundle and nothing else.
* **Audio is synthesised** with the Web Audio API — gate rumble, reel chop,
  pump gulps, and pitch-scattered plops for surfacing fruit. Spoken cues use
  `SpeechSynthesis` in Japanese and are never load-bearing.

### Faking the physics

Nothing here is simulated properly, and that is the point: every effect is
the cheapest thing that still makes the cause visible.

* **Water** is one plane with a handful of sine waves plus up to four local
  disturbers (reel, finger, nozzle, boom). The flooding front is free — the
  fragment shader evaluates the same bog-floor function the CPU uses and
  discards anything above the water level, so water *finds the low ground*
  instead of a plane sliding up.
* **Berries** are rows in typed arrays and instances in one of two
  `InstancedMesh`es (detailed near the camera, cheap far away). Buoyancy is a
  per-berry spring with a staggered delay; crowd motion is a flow field plus
  a separation pass over a flat counting-sort grid; containment is the signed
  distance to the boom circle. A `packFactor` lets the raft heap up as the
  ring closes, which is what turns "berries move together" into "berries pack
  into a red mass".
* **The raft's colour is not the instances.** Floating fruit is splatted into
  a coarse density map that the water shader reads and paints as a mass of
  wet domes. A real raft is solid red at any distance and you only resolve
  individual fruit within a couple of metres — doing it this way is why the
  berries can be a believable size instead of having to be the size of the
  machine to make the bog turn red.
* **Contact shadows** are a handful of soft multiplied discs laid on the
  surface under the beater, the crew and the nozzle. The water is a custom
  transparent shader and cannot take part in the shadow pass, and anything
  floating with nothing underneath it reads as pasted on.
* **The boom** is a circle you *haul in*, not a rope with physics — always a
  smooth closed curve however erratic the dragging.
* **The hose** is a Catmull-Rom spline; the tube's vertex buffer is rewritten
  in place each frame, and the middle third uses a translucent material so
  the fruit riding the spline is visible going past.
* **The truck bed** is a jittered lattice of slots that heaps into a mound;
  every berry that goes down the hose gets a real place to land.

### Mobile

* Pixel ratio is capped per tier (1.25 / 1.75 / 2.0).
* A frame-time watchdog quietly steps the tier down after sustained slow
  frames; it never removes the signature moments, only the count of things.
* Paddle racks, vine clumps and boom floats are merged or instanced — a full
  scene is well under a hundred draw calls.
* No post-processing, no bloom, no screen-space refraction, no shadow except
  one small directional map (off on low).
* `visibilitychange` suspends audio and drops the huge first frame on return.

### Keeping the world honest

The scale is set by the person, not the other way round: an adult is 1.78m,
the beater is a machine one of them walks behind at about 1.2 m/s, the flood
is knee deep, and the section is the size a crew actually booms off at once.
Every other dimension — sluice, boom floats, suction bore, truck — was sized
against that, and the cameras were re-framed to match.

### Portrait and landscape

Every shot is authored twice — different distance, pitch, field of view and a
vertical bias that lifts the subject clear of the thumb zone. Rotating the
device never touches game state: the world owns all of it and the camera
simply recomposes on the next frame.

## Settings (behind the gear, for grown-ups)

Volume, spoken cues, reduced motion (shorter camera moves), and a low
graphics mode. Nothing else — no accounts, no analytics, no network calls, no
links out.
