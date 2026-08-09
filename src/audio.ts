// Tiny synthesized sound kit — no assets, unlocked on first user gesture
// (mobile Safari requires resume() inside a gesture handler).

export class SoundKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private moveOsc: OscillatorNode | null = null;
  private moveGain: GainNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private now(): number { return this.ctx ? this.ctx.currentTime : 0; }

  private tone(freq: number, dur: number, opts: {
    type?: OscillatorType; vol?: number; attack?: number;
    glideTo?: number; delay?: number;
  } = {}): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.now() + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), t0 + dur);
    }
    const vol = opts.vol ?? 0.3;
    const atk = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, opts: { vol?: number; freq?: number; q?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.now() + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = opts.freq ?? 1800;
    filt.Q.value = opts.q ?? 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // continuous soft hum while the claw slides (gain follows speed)
  setSlide(speed: number): void {
    if (!this.ctx || !this.master) return;
    if (!this.moveOsc) {
      this.moveOsc = this.ctx.createOscillator();
      this.moveOsc.type = 'triangle';
      this.moveOsc.frequency.value = 105;
      this.moveGain = this.ctx.createGain();
      this.moveGain.gain.value = 0;
      this.moveOsc.connect(this.moveGain).connect(this.master);
      this.moveOsc.start();
    }
    const target = Math.min(0.09, speed * 0.028);
    this.moveGain!.gain.setTargetAtTime(target, this.now(), 0.06);
    this.moveOsc.frequency.setTargetAtTime(95 + Math.min(60, speed * 14), this.now(), 0.08);
  }

  descend(): void {
    this.tone(340, 0.55, { type: 'triangle', vol: 0.12, glideTo: 150, attack: 0.05 });
    this.noise(0.5, { vol: 0.05, freq: 900, q: 0.8 });
  }

  rise(): void {
    this.tone(160, 0.45, { type: 'triangle', vol: 0.09, glideTo: 300, attack: 0.05 });
  }

  tap(): void { // claw tip touches capsule — small "コツ"
    this.noise(0.06, { vol: 0.3, freq: 2600, q: 2 });
    this.tone(620, 0.09, { vol: 0.18, glideTo: 480 });
  }

  koron(): void { // one tumble lands — woody "コロン"
    this.tone(520, 0.16, { type: 'sine', vol: 0.35, glideTo: 320 });
    this.tone(780, 0.1, { type: 'sine', vol: 0.14, glideTo: 560, delay: 0.012 });
    this.noise(0.05, { vol: 0.16, freq: 1400, q: 1.5 });
  }

  wobble(): void { // teeter near the edge
    this.tone(240, 0.32, { type: 'sine', vol: 0.13, glideTo: 200 });
    this.tone(205, 0.3, { type: 'sine', vol: 0.1, glideTo: 235, delay: 0.16 });
  }

  ston(): void { // the drop lands
    this.tone(150, 0.4, { type: 'sine', vol: 0.5, glideTo: 55 });
    this.noise(0.12, { vol: 0.3, freq: 700, q: 0.9 });
  }

  chuteTick(pitch = 1): void {
    this.tone(430 * pitch, 0.07, { type: 'sine', vol: 0.16, glideTo: 330 * pitch });
    this.noise(0.03, { vol: 0.08, freq: 2000, q: 2 });
  }

  chime(): void { // reached the outlet — soft completion arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.7, { type: 'sine', vol: 0.16, delay: i * 0.11, attack: 0.01 });
      this.tone(f * 2, 0.4, { type: 'sine', vol: 0.05, delay: i * 0.11, attack: 0.01 });
    });
  }

  pop(): void { // capsule appears
    this.tone(300, 0.12, { type: 'sine', vol: 0.2, glideTo: 520 });
  }
}
