import { clamp, clamp01 } from './util';

/**
 * Everything is synthesised with WebAudio - no asset files, so the whole game
 * stays a static bundle. Tone is deliberately soft: no stingers, no alarms.
 */

function noiseBuffer(ctx: AudioContext, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // brownish
    d[i] = white * 0.55 + last * 3.2;
  }
  return buf;
}

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private started = false;
  muted = false;

  // continuously-controlled voices
  private seaGain!: GainNode;
  private seaFilter!: BiquadFilterNode;
  private deepGain!: GainNode;
  private payGain!: GainNode;
  private payFilter!: BiquadFilterNode;
  private payRateOsc!: OscillatorNode;
  private machGain!: GainNode;
  private machOsc!: OscillatorNode;
  private digGain!: GainNode;
  private digFilter!: BiquadFilterNode;

  /** Must be called from inside a user gesture (iOS requirement). */
  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? window.AudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.started = true;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.noise = noiseBuffer(ctx, 3);

    const loopNoise = (filterType: BiquadFilterType, freq: number, q: number, gain: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return { f, g };
    };

    // surface sea wash
    const sea = loopNoise('bandpass', 620, 0.55, 0);
    this.seaFilter = sea.f;
    this.seaGain = sea.g;
    // deep low rumble
    const deep = loopNoise('lowpass', 150, 0.7, 0);
    this.deepGain = deep.g;
    // cable slither (payout)
    const pay = loopNoise('bandpass', 1500, 1.4, 0);
    this.payFilter = pay.f;
    this.payGain = pay.g;
    // digging grind
    const dig = loopNoise('bandpass', 340, 1.1, 0);
    this.digFilter = dig.f;
    this.digGain = dig.g;

    // slow LFO wobble on payout so it reads as "cable running over a sheave"
    this.payRateOsc = ctx.createOscillator();
    this.payRateOsc.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 420;
    this.payRateOsc.connect(lfoGain).connect(this.payFilter.frequency);
    this.payRateOsc.start();

    // machinery hum (winch / tensioner)
    this.machOsc = ctx.createOscillator();
    this.machOsc.type = 'sawtooth';
    this.machOsc.frequency.value = 62;
    const mf = ctx.createBiquadFilter();
    mf.type = 'lowpass';
    mf.frequency.value = 260;
    this.machGain = ctx.createGain();
    this.machGain.gain.value = 0;
    this.machOsc.connect(mf).connect(this.machGain).connect(this.master);
    this.machOsc.start();
  }

  private at() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private ramp(p: AudioParam, v: number, t = 0.15) {
    if (!this.ctx) return;
    const now = this.at();
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(this.muted ? 0 : v, now + t);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.ramp(this.master.gain, m ? 0 : 0.9, 0.2);
  }

  /** 0 = above water, 1 = fully submerged. */
  setSubmersion(v: number) {
    if (!this.ctx) return;
    const s = clamp01(v);
    this.ramp(this.seaGain.gain, (1 - s) * 0.075 + 0.012, 0.5);
    this.seaFilter.frequency.setTargetAtTime(620 - s * 430, this.at(), 0.4);
    this.ramp(this.deepGain.gain, s * 0.14, 0.6);
  }

  /** payout rate normalised 0..1 */
  setPayout(v: number) {
    if (!this.ctx) return;
    const s = clamp01(v);
    this.ramp(this.payGain.gain, s * 0.12, 0.08);
    this.payRateOsc.frequency.setTargetAtTime(3 + s * 11, this.at(), 0.1);
    this.ramp(this.machGain.gain, s * 0.045, 0.2);
  }

  setDigging(v: number) {
    if (!this.ctx) return;
    const s = clamp01(v);
    this.ramp(this.digGain.gain, s * 0.1, 0.12);
    this.digFilter.frequency.setTargetAtTime(300 + s * 420, this.at(), 0.15);
  }

  setMachinery(v: number) {
    if (!this.ctx) return;
    this.ramp(this.machGain.gain, clamp01(v) * 0.05, 0.25);
  }

  /** Short pitched blip - used for taps, snaps and confirmations. */
  blip(freq = 660, dur = 0.16, type: OscillatorType = 'sine', vol = 0.16) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  /** Wooden marimba-ish tap for UI. */
  tap() {
    this.blip(880, 0.14, 'triangle', 0.13);
    this.blip(1320, 0.09, 'sine', 0.05);
  }

  /** Metallic clunk when the cable seats into a roller / tensioner. */
  clunk() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 3.5;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    src.connect(f).connect(g).connect(this.master);
    src.start(now, Math.random() * 2);
    src.stop(now + 0.35);
    this.blip(210, 0.18, 'sine', 0.1);
  }

  /** Cable breaking the surface. */
  splash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2600, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.6);
    f.Q.value = 0.9;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    src.connect(f).connect(g).connect(this.master);
    src.start(now, Math.random());
    src.stop(now + 0.8);
  }

  /** Soft sand puff. */
  puff(vol = 0.16) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1.4;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    src.connect(f).connect(g).connect(this.master);
    src.start(now, Math.random());
    src.stop(now + 0.6);
  }

  /** Warm rising arpeggio for the connection moment. */
  fanfare() {
    if (!this.ctx || this.muted) return;
    const notes = [392, 494, 587, 784, 988, 1175];
    notes.forEach((f, i) => {
      window.setTimeout(() => this.blip(f, 0.7, 'triangle', 0.12), i * 170);
      window.setTimeout(() => this.blip(f * 2, 0.4, 'sine', 0.05), i * 170 + 30);
    });
  }

  /** Little sparkle when an island building lights up. */
  spark(i: number) {
    const scale = [523, 587, 659, 784, 880, 1046, 1175];
    this.blip(scale[i % scale.length] * 2, 0.5, 'sine', 0.08);
  }

  /** Gentle sonar-ish ping used sparingly underwater. */
  ping() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const g = ctx.createGain();
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(1180, now);
    o.frequency.exponentialRampToValueAtTime(760, now + 1.1);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 1.35);
  }

  /** Light switch-on: relay click then a swelling glow tone. */
  lightsOn() {
    this.clunk();
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const g = ctx.createGain();
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(320, now);
    o.frequency.linearRampToValueAtTime(660, now + 0.5);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 1.25);
  }

  silenceLoops() {
    if (!this.ctx) return;
    this.setPayout(0);
    this.setDigging(0);
    this.ramp(this.machGain.gain, 0, 0.3);
  }

  /** Deep-sea creature call: low, slow, friendly. */
  whale() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const base = 150 + Math.random() * 70;
    o.frequency.setValueAtTime(base, now);
    o.frequency.linearRampToValueAtTime(base * 1.5, now + 1.1);
    o.frequency.linearRampToValueAtTime(base * 0.9, now + 2.4);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.7);
    g.gain.linearRampToValueAtTime(0, now + 2.6);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 2.7);
  }
}

export const sound = new Sound();
export const audioVol = (v: number) => clamp(v, 0, 1);
