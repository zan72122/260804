/*
 * Small synthesised sound kit — no files, no downloads. The game reads without
 * it (the brief asks for a silent clip to be legible on its own), but a wingbeat
 * you can hear makes the cast and the landing land harder for a small child.
 */

export function createAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let started = false;
  let enabled = true;

  function noiseBuffer(seconds = 2) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      // Lightly brown-ed noise: warmer, less hissy than pure white.
      last = (last + 0.03 * white) / 1.03;
      d[i] = last * 3.2;
    }
    return buf;
  }

  let noise = null;

  function start() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      enabled = false;
      return;
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noise = noiseBuffer(2.5);

    // Steady meadow wind underneath everything.
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0.055;
    src.connect(lp).connect(windGain).connect(master);
    src.start();

    // Slow swell so the wind breathes.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(windGain.gain);
    lfo.start();

    started = true;
  }

  function resume() {
    if (!started) start();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function burst({ freq = 500, q = 0.9, dur = 0.28, gain = 0.3, sweepTo = null, delay = 0 }) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(freq, t0);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function tone({ freq = 660, dur = 0.35, gain = 0.12, type = 'sine', delay = 0, to = null }) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    resume,
    get ready() {
      return started;
    },
    /** A single wingbeat — air moved by a big feathered surface. */
    flap(strength = 1, delay = 0) {
      burst({
        freq: 240 + Math.random() * 90,
        q: 0.55,
        dur: 0.2 + strength * 0.12,
        gain: 0.16 * strength,
        sweepTo: 110,
        delay,
      });
    },
    /** The hard first beat off the fist. */
    cast() {
      burst({ freq: 620, q: 0.5, dur: 0.5, gain: 0.42, sweepTo: 130 });
      this.flap(1.2, 0.1);
      this.flap(1.0, 0.32);
      this.flap(0.8, 0.56);
    },
    /** Feet meeting the glove. */
    thump() {
      burst({ freq: 150, q: 1.4, dur: 0.22, gain: 0.32, sweepTo: 70 });
      tone({ freq: 150, to: 74, dur: 0.2, gain: 0.1, type: 'sine' });
    },
    /** Bells on the jesses. */
    bell(n = 3) {
      for (let i = 0; i < n; i++) {
        tone({
          freq: 1750 + Math.random() * 420,
          dur: 0.22,
          gain: 0.045,
          type: 'triangle',
          delay: i * 0.075 + Math.random() * 0.03,
        });
      }
    },
    /** Leather creak / buckle click. */
    click() {
      burst({ freq: 2100, q: 3, dur: 0.09, gain: 0.14, sweepTo: 900 });
    },
    /** The lure cutting the air; called continuously while it swings. */
    swish(speed) {
      burst({ freq: 300 + speed * 160, q: 1.6, dur: 0.16, gain: 0.035 + speed * 0.02, sweepTo: 200 });
    },
    /** Warm little flourish when the hawk is back on the fist. */
    settle() {
      tone({ freq: 523, dur: 0.5, gain: 0.07, type: 'sine' });
      tone({ freq: 784, dur: 0.55, gain: 0.055, type: 'sine', delay: 0.08 });
      tone({ freq: 1046, dur: 0.6, gain: 0.04, type: 'sine', delay: 0.16 });
    },
    /** The hawk's own call, used sparingly when it turns for home. */
    call() {
      tone({ freq: 1500, to: 1050, dur: 0.42, gain: 0.05, type: 'sawtooth' });
      tone({ freq: 1420, to: 980, dur: 0.36, gain: 0.03, type: 'sawtooth', delay: 0.38 });
    },
  };
}
