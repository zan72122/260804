/**
 * Fully procedural sound. No audio assets — every signature action gets a
 * synthesised voice so input and sound can never drift out of sync.
 *
 * Vocabulary (from the design brief):
 *   click   カチッ   block / stage locking
 *   tick    クルッ    handwheel ratchet (one per few degrees)
 *   cut     スッ      a section is born
 *   ribbon  スルスル  continuous, gain follows ribbon growth speed
 *   plop    ポチャン  section touches the water
 *   bloom   フワーッ  section relaxing flat
 *   sweep   スーッ    slide lifting out of the water
 *   thud    コトッ    slide into a bath
 *   knob    クルクル  focus knob (softer than the handwheel)
 *   pop     パッ      the fluorescence reveal
 */

type Ctx = AudioContext & { resume(): Promise<void> };

export class Audio {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ribbonGain: GainNode | null = null;
  private ribbonSrc: AudioBufferSourceNode | null = null;
  private ribbonFilter: BiquadFilterNode | null = null;
  private ambGain: GainNode | null = null;
  muted = false;
  private started = false;
  private lastAt: Record<string, number> = {};

  /** Must be called from a user gesture on iOS. Safe to call repeatedly. */
  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC() as Ctx;
    } catch {
      return;
    }
    this.started = true;
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.master);

    // one second of white noise, reused by every noise-based voice
    const len = Math.floor(ctx.sampleRate);
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    void ctx.resume();
    this.startAmbience();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.05);
    }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume(); }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Rate-limit a voice so a fast finger cannot machine-gun it. */
  private gate(key: string, minGap: number) {
    const t = this.now();
    if ((this.lastAt[key] ?? -99) > t - minGap) return false;
    this.lastAt[key] = t;
    return true;
  }

  private noise(dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    const t = ctx.currentTime;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(this.bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(
    freq: number, dur: number, gain: number,
    type: OscillatorType = 'sine', freq2?: number, attack = 0.008, delay = 0,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (freq2 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---- signature voices ---------------------------------------------------

  /** カチッ — something locked into place. */
  click(strength = 1) {
    if (!this.ctx || !this.gate('click', 0.05)) return;
    this.noise(0.055, 0.3 * strength, 'bandpass', 2600, 1200, 3);
    this.tone(880, 0.06, 0.1 * strength, 'square', 520, 0.002);
    this.tone(210, 0.12, 0.09 * strength, 'sine', 150, 0.004);
  }

  /** クルッ — one ratchet notch of the handwheel. `speed` in rev/s. */
  tick(speed: number) {
    if (!this.ctx || !this.gate('tick', 0.028)) return;
    const s = clamp01(speed / 1.6);
    this.noise(0.032, 0.055 + 0.05 * s, 'bandpass', 1500 + 1700 * s, 700, 6);
    this.tone(300 + 260 * s, 0.035, 0.028, 'triangle', 180, 0.002);
  }

  /** クルクル — focus knob, softer and rounder than the handwheel. */
  knob(speed: number) {
    if (!this.ctx || !this.gate('knob', 0.045)) return;
    const s = clamp01(speed / 1.2);
    this.noise(0.03, 0.022 + 0.018 * s, 'bandpass', 900 + 700 * s, 500, 4);
  }

  /** スッ — a section is sliced free. */
  cut() {
    if (!this.ctx || !this.gate('cut', 0.07)) return;
    this.noise(0.16, 0.16, 'highpass', 5200, 1400);
    this.noise(0.09, 0.08, 'bandpass', 3200, 2000, 2);
  }

  /** スルスル — continuous ribbon whisper; drive with 0..1 each frame. */
  ribbon(amount: number) {
    if (!this.ctx) return;
    const a = clamp01(amount);
    if (!this.ribbonSrc) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 2600;
      flt.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(flt).connect(g).connect(this.bus);
      src.start();
      this.ribbonSrc = src;
      this.ribbonGain = g;
      this.ribbonFilter = flt;
    }
    const t = this.ctx.currentTime;
    this.ribbonGain!.gain.setTargetAtTime(0.075 * a, t, 0.06);
    this.ribbonFilter!.frequency.setTargetAtTime(2100 + 1900 * a, t, 0.08);
  }

  stopRibbon() {
    if (this.ribbonGain && this.ctx)
      this.ribbonGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.09);
  }

  /** ポチャン — touching the water. */
  plop() {
    if (!this.ctx || !this.gate('plop', 0.06)) return;
    this.tone(320, 0.22, 0.16, 'sine', 900, 0.004);
    this.noise(0.12, 0.07, 'bandpass', 1400, 500, 2);
    this.tone(160, 0.3, 0.06, 'sine', 110, 0.01);
  }

  /** フワーッ — the section relaxing flat. Soft, slow, quiet. */
  bloom() {
    if (!this.ctx || !this.gate('bloom', 0.5)) return;
    this.tone(392, 1.5, 0.05, 'sine', 587, 0.35);
    this.tone(588, 1.6, 0.035, 'sine', 784, 0.45);
    this.noise(1.3, 0.03, 'lowpass', 700, 2400);
  }

  /** スーッ — slide sweeping up out of the water. */
  sweep() {
    if (!this.ctx || !this.gate('sweep', 0.2)) return;
    this.noise(0.55, 0.09, 'bandpass', 700, 3400, 1.6);
    this.tone(520, 0.5, 0.04, 'sine', 900, 0.08);
  }

  /** コトッ — slide set down into a bath. */
  thud() {
    if (!this.ctx || !this.gate('thud', 0.08)) return;
    this.tone(190, 0.16, 0.16, 'sine', 120, 0.003);
    this.noise(0.06, 0.07, 'bandpass', 800, 400, 2);
  }

  /** small liquid gurgle for the baths */
  drip() {
    if (!this.ctx || !this.gate('drip', 0.09)) return;
    this.tone(700 + Math.random() * 500, 0.13, 0.05, 'sine', 1500, 0.004);
  }

  /** ぱらり — ribbon separating. */
  tear() {
    if (!this.ctx || !this.gate('tear', 0.15)) return;
    this.noise(0.22, 0.075, 'highpass', 3800, 1500);
  }

  /** パッ — the reveal. Deliberately gentle: the picture is the payoff. */
  pop() {
    if (!this.ctx) return;
    const notes = [784, 988, 1319, 1568];
    notes.forEach((f, i) => this.tone(f, 1.5 + i * 0.25, 0.075 - i * 0.012, 'sine', undefined, 0.02, i * 0.045));
    this.noise(0.5, 0.03, 'highpass', 6000, 3000);
  }

  /** soft attention chime used by the hint system */
  hint() {
    if (!this.ctx || !this.gate('hint', 1.2)) return;
    this.tone(1046, 0.35, 0.03, 'sine', undefined, 0.02);
    this.tone(1568, 0.4, 0.02, 'sine', undefined, 0.03, 0.09);
  }

  /** whoosh used when the camera flies between stations */
  move() {
    if (!this.ctx || !this.gate('move', 0.3)) return;
    this.noise(0.45, 0.035, 'bandpass', 400, 1400, 1.2);
  }

  /** Quiet room tone so silence never feels broken. */
  private startAmbience() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(flt).connect(g).connect(this.bus);
    src.start();
    this.ambGain = g;
  }

  /** Dim the room tone when the lab lights go out. */
  setAmbience(level: number) {
    if (this.ambGain && this.ctx)
      this.ambGain.gain.setTargetAtTime(0.012 * level, this.ctx.currentTime, 0.5);
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const audio = new Audio();
