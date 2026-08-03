/**
 * All game audio is synthesised with WebAudio — no audio files.
 * The AudioContext is only created inside a real user gesture (iOS Safari
 * requirement) and is created exactly once; rotating or resizing never
 * touches the audio graph, so sounds can't double-play.
 */

interface Loop {
  gain: GainNode;
  filter: BiquadFilterNode;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private grindLoop: Loop | null = null;
  private grindOsc: OscillatorNode | null = null;
  private grindOscGain: GainNode | null = null;
  private mistLoop: Loop | null = null;
  private whooshLoop: Loop | null = null;
  /** How many times a context was created — must stay ≤1 (test-observed). */
  startCount = 0;
  private soft = false;
  /** Last grind intensity sent — observable for tests. */
  grindIntensity = 0;
  whooshLevel = 0;

  /** Call from a genuine user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.startCount++;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.soft ? 0.28 : 0.85;
    this.master.connect(this.ctx.destination);
    // 2s of white noise, looped by every noise-based voice
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Current master gain value (-1 before the context exists). Test-observed. */
  get masterGain(): number {
    return this.master ? this.master.gain.value : -1;
  }

  setSoft(soft: boolean): void {
    this.soft = soft;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(soft ? 0.28 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = this.noiseBuf.duration;
    return src;
  }

  private makeLoop(type: BiquadFilterType, freq: number, q: number): Loop | null {
    if (!this.ctx || !this.master) return null;
    const src = this.noiseSource();
    if (!src) return null;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    return { gain, filter };
  }

  // ---- one-shot voices -------------------------------------------------

  /** Short percussive tick: wheel hitting corrugation. strength 0..1 */
  gataTick(strength: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, strength);
    // low thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5 * s, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);
    // metallic rattle
    this.burst(0.04, 900, 3, 0.22 * s);
  }

  private burst(dur: number, freq: number, q: number, gain: number, when = 0): void {
    if (!this.ctx || !this.master) return;
    const src = this.noiseSource();
    if (!src) return;
    const t = this.ctx.currentTime + when;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Laser scan blip; pitch follows bump height (0..1). */
  scanBlip(height: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 520 + height * 620;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Soft rising sweep while the laser travels. */
  scanSweep(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(440, t + 3.0);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.3);
    g.gain.setValueAtTime(0.05, t + 2.6);
    g.gain.linearRampToValueAtTime(0.0001, t + 3.0);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 3.1);
  }

  /** Servo whir for a unit descending one stage. */
  servo(down = true): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(down ? 260 : 160, t);
    osc.frequency.linearRampToValueAtTime(down ? 150 : 260, t + 0.28);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(f).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Contact thud (stage 2 of lowering). */
  clunk(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
    this.burst(0.06, 500, 2, 0.2);
  }

  /** The heavy GAKON lock. */
  gakon(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
    // metallic ring + latch clack
    this.burst(0.05, 2400, 4, 0.3);
    this.burst(0.16, 750, 8, 0.28, 0.03);
    const ring = this.ctx.createOscillator();
    ring.type = 'triangle';
    ring.frequency.value = 620;
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.14, t + 0.03);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    ring.connect(rg).connect(this.master);
    ring.start(t + 0.03);
    ring.stop(t + 0.55);
  }

  /** Magnetic snap when a unit docks. */
  snap(): void {
    this.burst(0.05, 1400, 3, 0.25);
    this.burst(0.09, 300, 2, 0.3, 0.01);
  }

  /** Small ratchet tick while the lever moves. */
  ratchet(): void {
    this.burst(0.03, 1800, 5, 0.12);
  }

  /** Two-note success chime. */
  chime(): void {
    if (!this.ctx || !this.master) return;
    const notes = [660, 990];
    notes.forEach((freq, i) => {
      const t = this.ctx!.currentTime + i * 0.16;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  // ---- continuous voices ----------------------------------------------

  /** Grinding hiss: intensity 0..1 (contact × speed × roughness), bright 0..1. */
  setGrind(intensity: number, bright: number): void {
    this.grindIntensity = intensity;
    if (!this.ctx) return;
    if (!this.grindLoop) {
      this.grindLoop = this.makeLoop('bandpass', 1800, 0.8);
      if (this.ctx && this.master) {
        // stone motor hum under the hiss
        this.grindOsc = this.ctx.createOscillator();
        this.grindOsc.type = 'sawtooth';
        this.grindOsc.frequency.value = 70;
        this.grindOscGain = this.ctx.createGain();
        this.grindOscGain.gain.value = 0;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 300;
        this.grindOsc.connect(lp).connect(this.grindOscGain).connect(this.master);
        this.grindOsc.start();
      }
    }
    if (this.grindLoop) {
      const t = this.ctx.currentTime;
      this.grindLoop.gain.gain.setTargetAtTime(intensity * 0.5, t, 0.04);
      this.grindLoop.filter.frequency.setTargetAtTime(1200 + bright * 2200, t, 0.06);
      this.grindOscGain?.gain.setTargetAtTime(intensity * 0.16, t, 0.05);
      this.grindOsc?.frequency.setTargetAtTime(60 + bright * 60, t, 0.08);
    }
  }

  /** Water mist hiss, level 0..1. */
  setMist(level: number): void {
    if (!this.ctx) return;
    if (!this.mistLoop) this.mistLoop = this.makeLoop('highpass', 5000, 0.6);
    this.mistLoop?.gain.gain.setTargetAtTime(level * 0.1, this.ctx.currentTime, 0.08);
  }

  /** Quiet gliding whoosh for the repaired test run, level 0..1. */
  setWhoosh(level: number): void {
    this.whooshLevel = level;
    if (!this.ctx) return;
    if (!this.whooshLoop) this.whooshLoop = this.makeLoop('lowpass', 500, 0.4);
    this.whooshLoop?.gain.gain.setTargetAtTime(level * 0.16, this.ctx.currentTime, 0.1);
  }

  /** Silence all continuous voices (phase changes). */
  quietLoops(): void {
    this.setGrind(0, 0);
    this.setMist(0);
    this.setWhoosh(0);
  }
}
