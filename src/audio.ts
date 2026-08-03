/**
 * All sound is synthesized with WebAudio — no assets, and nothing plays
 * until unlock() runs inside the first user gesture (mobile Safari rule).
 * A master lowpass "muffle" closes when the inspection hood is down.
 */
export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private hum: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;
  private pour: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private uv: { osc: OscillatorNode; lfo: OscillatorNode; lfoG: GainNode; gain: GainNode } | null = null;
  private demag: { osc: OscillatorNode; gain: GainNode } | null = null;
  private lastShimmer = 0;
  private lastWipe = 0;

  get unlocked(): boolean { return this.ctx !== null; }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 18000;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.muffle);
    this.muffle.connect(ctx.destination);
    const len = ctx.sampleRate * 1.2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === "suspended") void ctx.resume();
  }

  /** dark=1 pulls a soft lowpass over everything (hood closed). */
  setDark(dark: number): void {
    if (!this.ctx || !this.muffle || !this.master) return;
    const f = 18000 - dark * 16400;
    this.muffle.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.2);
    this.master.gain.setTargetAtTime(0.9 - dark * 0.25, this.ctx.currentTime, 0.2);
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  private env(peak: number, attack: number, decay: number): GainNode | null {
    if (!this.ctx || !this.master) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master);
    return g;
  }

  /** short soft fabric scrub, rate-limited */
  wipe(): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastWipe < 140) return;
    this.lastWipe = now;
    const src = this.noiseSource();
    const g = this.env(0.05, 0.02, 0.16);
    if (!src || !g) return;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700 + Math.random() * 500;
    f.Q.value = 0.8;
    src.connect(f); f.connect(g);
    src.start();
    src.stop(this.ctx.currentTime + 0.25);
  }

  /** yoke / part settling with a soft "kotoh" */
  clack(): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.09);
    const g = this.env(0.22, 0.004, 0.13);
    if (!g) return;
    o.connect(g);
    o.start(); o.stop(this.ctx.currentTime + 0.16);
    const src = this.noiseSource();
    const g2 = this.env(0.06, 0.001, 0.05);
    if (src && g2) {
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 2500;
      src.connect(f); f.connect(g2);
      src.start(); src.stop(this.ctx.currentTime + 0.06);
    }
  }

  humStart(): void {
    if (!this.ctx || !this.master || this.hum) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = 58;
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine"; osc2.frequency.value = 116;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.4);
    osc.connect(gain); osc2.connect(gain);
    gain.connect(this.master);
    osc.start(); osc2.start();
    this.hum = { osc, osc2, gain };
  }

  humStop(): void {
    if (!this.ctx || !this.hum) return;
    const { osc, osc2, gain } = this.hum;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
    osc.stop(this.ctx.currentTime + 1);
    osc2.stop(this.ctx.currentTime + 1);
    this.hum = null;
  }

  pourStart(): void {
    if (!this.ctx || !this.master || this.pour) return;
    const src = this.noiseSource();
    if (!src) return;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 1100;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, this.ctx.currentTime + 0.2);
    src.connect(f); f.connect(gain); gain.connect(this.master);
    src.start();
    this.pour = { src, gain };
  }

  pourStop(): void {
    if (!this.ctx || !this.pour) return;
    const { src, gain } = this.pour;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
    src.stop(this.ctx.currentTime + 0.5);
    this.pour = null;
  }

  /** delicate ping as particles snap into place, rate limited */
  shimmer(): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastShimmer < 190) return;
    this.lastShimmer = now;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 1500 + Math.random() * 1400;
    const g = this.env(0.03, 0.01, 0.3);
    if (!g) return;
    o.connect(g);
    o.start(); o.stop(this.ctx.currentTime + 0.35);
  }

  /** curtain sliding down — a soft fabric whoosh */
  whoosh(): void {
    if (!this.ctx) return;
    const src = this.noiseSource();
    const g = this.env(0.12, 0.08, 0.5);
    if (!src || !g) return;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1800, this.ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(240, this.ctx.currentTime + 0.55);
    src.connect(f); f.connect(g);
    src.start(); src.stop(this.ctx.currentTime + 0.7);
  }

  uvStart(): void {
    if (!this.ctx || !this.master || this.uv) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = 196;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine"; lfo.frequency.value = 5.5;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 4;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(this.master);
    osc.start(); lfo.start();
    this.uv = { osc, lfo, lfoG, gain };
  }

  /** loudness follows lamp movement speed */
  uvLevel(level: number): void {
    if (!this.ctx || !this.uv) return;
    const v = 0.015 + Math.min(1, level) * 0.05;
    this.uv.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  uvStop(): void {
    if (!this.ctx || !this.uv) return;
    const { osc, lfo, gain } = this.uv;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    osc.stop(this.ctx.currentTime + 0.6);
    lfo.stop(this.ctx.currentTime + 0.6);
    this.uv = null;
  }

  /** small two-note success as an indication connects */
  ding(): void {
    if (!this.ctx) return;
    const notes = [880, 1174.7];
    notes.forEach((f, i) => {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const g = this.env(0.09, 0.01 + i * 0.12, 0.5);
      if (!g) return;
      o.connect(g);
      o.start(this.ctx.currentTime + i * 0.12);
      o.stop(this.ctx.currentTime + i * 0.12 + 0.6);
    });
  }

  camera(): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = "square"; o.frequency.value = 2400;
    const g = this.env(0.05, 0.002, 0.05);
    if (!g) return;
    o.connect(g);
    o.start(); o.stop(this.ctx.currentTime + 0.06);
    const o2 = this.ctx.createOscillator();
    o2.type = "triangle"; o2.frequency.value = 620;
    const g2 = this.env(0.07, 0.02, 0.12);
    if (!g2) return;
    o2.connect(g2);
    o2.start(this.ctx.currentTime + 0.05);
    o2.stop(this.ctx.currentTime + 0.22);
  }

  demagStart(): void {
    if (!this.ctx || !this.master || this.demag) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = 82;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(this.master);
    osc.start();
    this.demag = { osc, gain };
  }

  /** residual 1 -> 0: hum fades and drops in pitch */
  demagLevel(residual: number): void {
    if (!this.ctx || !this.demag) return;
    this.demag.gain.gain.setTargetAtTime(residual * 0.12, this.ctx.currentTime, 0.12);
    this.demag.osc.frequency.setTargetAtTime(40 + residual * 45, this.ctx.currentTime, 0.15);
  }

  demagStop(): void {
    if (!this.ctx || !this.demag) return;
    const { osc, gain } = this.demag;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    osc.stop(this.ctx.currentTime + 1.2);
    this.demag = null;
  }

  /** completion — three gentle notes */
  jingle(): void {
    if (!this.ctx) return;
    [523.25, 659.25, 784].forEach((f, i) => {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      const g = this.env(0.1, 0.01 + i * 0.16, 0.7);
      if (!g) return;
      o.connect(g);
      o.start(this.ctx.currentTime + i * 0.16);
      o.stop(this.ctx.currentTime + i * 0.16 + 0.8);
    });
  }

  /** non-verbal hint blip */
  pin(): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = "sine"; o.frequency.value = 987;
    const g = this.env(0.04, 0.01, 0.25);
    if (!g) return;
    o.connect(g);
    o.start(); o.stop(this.ctx.currentTime + 0.3);
  }

  /** silence every continuous voice (phase resets, replay) */
  stopLoops(): void {
    this.humStop(); this.pourStop(); this.uvStop(); this.demagStop();
  }
}
