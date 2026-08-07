// ============================================================================
// 音 — WebAudio の合成音だけ（外部ファイルなし）。
// iOS では最初のタップまで AudioContext を作らない。
// ============================================================================

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noiseBuf = null;
    this._loop = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      return true;
    } catch (e) { return false; }
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.55 : 0.0;
  }

  _noise(dur, filterType, freq, gain, q) {
    if (!this.enabled || !this.ensure()) return null;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
    return { src, f, g };
  }

  _tone(freq, dur, gain, type, slideTo) {
    if (!this.enabled || !this.ensure()) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  fold() { this._noise(0.22, 'bandpass', 2600, 0.06, 0.8); }
  rustle(amt = 1) { this._noise(0.16, 'highpass', 1800, 0.03 * amt, 0.7); }
  wrap() { this._noise(0.13, 'bandpass', 3400, 0.05, 2.0); this._tone(760, 0.08, 0.02, 'triangle'); }
  clampBoard() { this._tone(180, 0.16, 0.09, 'sine', 90); this._noise(0.1, 'lowpass', 700, 0.05); }
  plop() { this._tone(420, 0.16, 0.10, 'sine', 130); this._noise(0.14, 'lowpass', 900, 0.06); }
  splash() { this._noise(0.32, 'highpass', 1200, 0.07, 0.6); }
  slosh(amt) { this._noise(0.28, 'bandpass', 500 + amt * 400, 0.035 * amt, 0.9); }
  drip() { this._tone(900 + Math.random() * 300, 0.10, 0.035, 'sine', 380); }
  snap() { this._noise(0.08, 'highpass', 4200, 0.09, 1.2); this._tone(1500, 0.05, 0.03, 'square', 600); }
  wind() { this._noise(0.6, 'bandpass', 700, 0.035, 0.5); }
  reveal() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.7, 0.055, 'triangle'), i * 105));
  }
  chime() { this._tone(880, 0.5, 0.05, 'triangle'); this._tone(1320, 0.6, 0.03, 'sine'); }
  pop() { this._tone(1200, 0.05, 0.02, 'sine', 700); }
}
