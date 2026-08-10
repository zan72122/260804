/* Rainbow Glass Tower — tiny WebAudio synth (no assets).
   Everything is generated: pour noise, glass chimes, celebration fanfare. */
'use strict';

window.Sound = (function () {
  let ctx = null, master = null, pourGain = null;
  let ready = false;
  let muted = false;
  try { muted = localStorage.getItem('rgt_muted') === '1'; } catch (e) { /* private mode */ }

  // Bright pentatonic ladder — chimes climb as the cascade spreads downward.
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0,
                 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];

  function init() {
    if (ready) { resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // Looping filtered noise for the pour sound; gain stays at 0 until pouring.
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 500;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.7;
    pourGain = ctx.createGain();
    pourGain.gain.value = 0;
    src.connect(hp); hp.connect(bp); bp.connect(pourGain); pourGain.connect(master);
    src.start();
    ready = true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, delay, dur, vol, type) {
    if (!ready) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function setPour(on) {
    if (!ready) return;
    const t = ctx.currentTime;
    pourGain.gain.cancelScheduledValues(t);
    pourGain.gain.setTargetAtTime(on ? 0.09 : 0, t, on ? 0.09 : 0.18);
  }

  // n-th glass filled: an ever-rising happy chime.
  function chime(n) {
    const f = NOTES[n % NOTES.length];
    tone(f, 0, 0.7, 0.15, 'triangle');
    tone(f * 1.5, 0.04, 0.45, 0.05, 'sine');
  }

  // First overflow of the top glass — a little magical flourish.
  function sparkle() {
    tone(NOTES[5], 0, 0.25, 0.09, 'sine');
    tone(NOTES[7], 0.08, 0.25, 0.09, 'sine');
    tone(NOTES[9], 0.16, 0.4, 0.09, 'sine');
  }

  function fanfare() {
    [0, 2, 4, 5, 7].forEach((n, k) => tone(NOTES[n], k * 0.13, 0.9, 0.13, 'triangle'));
    [5, 7, 9].forEach((n, k) => tone(NOTES[n], 0.7 + k * 0.1, 1.2, 0.07, 'sine'));
    tone(NOTES[10], 1.1, 1.8, 0.06, 'sine');
  }

  function pop() {
    tone(700 + Math.random() * 500, 0, 0.12, 0.05, 'sine');
  }

  // jelly wobble when a tilted glass springs back upright
  function boing() {
    tone(340, 0, 0.14, 0.06, 'sine');
    tone(300, 0.08, 0.16, 0.045, 'sine');
    tone(330, 0.17, 0.18, 0.03, 'sine');
  }

  // short bright blip when a palette swatch is picked
  function pick() {
    tone(NOTES[7], 0, 0.11, 0.08, 'triangle');
    tone(NOTES[7] * 2, 0.02, 0.07, 0.025, 'sine');
  }

  // soft wet "plop" the instant colour is injected into a stream
  function paint() {
    if (!ready) return;
    const t0 = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.2);

    // a breath of filtered noise for the wet texture
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    src.connect(bp); bp.connect(ng); ng.connect(master);
    src.start(t0);
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('rgt_muted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.9;
    return muted;
  }

  return { init, resume, setPour, chime, sparkle, fanfare, pop, boing, pick, paint,
           toggleMute, isMuted: () => muted };
})();
