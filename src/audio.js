// ---------------------------------------------------------------------------
//  A little procedural audio. Nothing here is required to understand the game —
//  the whole thing reads silently — but the long draw of steel and the soft
//  "su—" as a loin comes free are worth having.
// ---------------------------------------------------------------------------

export function createAudio() {
  let ctx = null, master = null, drawGain = null, drawSrc = null, drawFilt = null;
  let enabled = true, started = false;

  function noiseBuffer(c, seconds = 2) {
    const n = Math.floor(c.sampleRate * seconds);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03;             // gently brown-tinted
      d[i] = last * 3.2;
    }
    return b;
  }

  function start() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.85 : 0;
    master.connect(ctx.destination);

    // continuous blade-through-flesh bed, gated by the stroke speed
    drawSrc = ctx.createBufferSource();
    drawSrc.buffer = noiseBuffer(ctx, 3);
    drawSrc.loop = true;
    drawFilt = ctx.createBiquadFilter();
    drawFilt.type = 'bandpass';
    drawFilt.frequency.value = 900;
    drawFilt.Q.value = 0.9;
    drawGain = ctx.createGain();
    drawGain.gain.value = 0;
    drawSrc.connect(drawFilt).connect(drawGain).connect(master);
    drawSrc.start();
    started = true;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  /** speed01: 0..1 how fast the blade is travelling right now. */
  function draw(speed01) {
    if (!started) return;
    const t = ctx.currentTime;
    drawGain.gain.setTargetAtTime(Math.min(0.16, speed01 * 0.16), t, 0.06);
    drawFilt.frequency.setTargetAtTime(600 + speed01 * 1900, t, 0.08);
  }

  function tone(freq, dur, type = 'sine', vol = 0.20, delay = 0, glide = 0) {
    if (!started) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function swish(vol = 0.3, dur = 0.55) {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(420, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function thud(vol = 0.35) {
    if (!started) return;
    tone(88, 0.35, 'sine', vol, 0, 0.45);
    swish(vol * 0.35, 0.20);
  }

  function chime(root = 523.25) {
    if (!started) return;
    const ratios = [1, 1.25, 1.5, 2];
    ratios.forEach((r, i) => tone(root * r, 1.1 - i * 0.12, 'sine', 0.16 - i * 0.02, i * 0.09));
  }

  function blip(n = 0) {
    if (!started) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    tone(scale[n % scale.length], 0.45, 'triangle', 0.18, 0, 1.0);
    tone(scale[n % scale.length] * 2, 0.28, 'sine', 0.07, 0.01, 1.0);
  }

  function setEnabled(v) {
    enabled = v;
    if (master) master.gain.setTargetAtTime(v ? 0.85 : 0, ctx.currentTime, 0.05);
  }

  return { start, resume, draw, swish, thud, chime, blip, tone, setEnabled, get enabled() { return enabled; } };
}
