# けむりのなかの きゅうじょたい / Low-Profile Search

A mobile web game for a four-year-old, about the one thing that matters in a
smoke-filled flat: **getting low and staying low.**

You put the SCBA facepiece on, shoulder the air cylinder, go in on your hands
and knees, follow the hose line with the torch, find the teddy and the kitten,
and bring them back out to the appliance.

## Playing

- **swipe down** — get low. The smoke banks against the ceiling, so the room
  opens up the moment your head drops into the clear layer near the floor.
- **swipe up** — stand back up (and lose your view again).
- **swipe left / right** — one crawl stroke. Rub back and forth to keep going.
- **press and hold** — keep crawling on your own.
- **tap or drag anywhere** — point the helmet torch there.

Keyboard equivalents (desktop): arrow keys / WASD, space.

No reading, no timer, no failure state. One play is two to four minutes.

## Running it

Any static file server, from the repository root:

    python3 -m http.server 8000
    # then open http://localhost:8000/

There is no build step, no backend and no network access at runtime — Three.js
is vendored in `vendor/`, and every texture, sound and model is generated in the
browser at boot.

## How it is put together

| file | what it does |
| --- | --- |
| `src/smoke.js` | the stratified-smoke shader — an analytic optical-depth integral injected into every material |
| `src/firefighter.js` | the SCBA rig: cylinder, harness, facepiece, helmet, and the stand/crawl poses |
| `src/apartment.js` | the flat, at 1:1 scale, with real wall thickness and lined door openings |
| `src/furniture.js`, `src/props.js` | contents of the flat, the hose line, the two things to find, the appliance |
| `src/textures.js`, `src/noise.js` | the procedural material bakery |
| `src/game.js` | phases, camera, lighting, update loop |
| `src/audio.js` | synthesised sound, including the SCBA regulator |
| `src/input.js` | the gesture layer |
