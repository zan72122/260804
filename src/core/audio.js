// ---------------------------------------------------------------------------
// 音はすべてその場で合成する。音源ファイルなし。
// iOS は最初のタッチまで音を止めるので、resume() を必ず一度呼ぶ。
// ---------------------------------------------------------------------------

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.enabled = true;
    this._noiseBuf = null;
    this._loops = new Map();
  }

  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._noiseBuf = this._makeNoise(2.0);
      this.ready = true;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.72 + w * 0.28; // 少しだけ低域寄りの雑音
      d[i] = last * 1.6;
    }
    return buf;
  }

  get t() {
    return this.ctx.currentTime;
  }

  _env(gain, t0, a, d, peak) {
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  tone(freq, { dur = 0.3, type = 'sine', gain = 0.2, attack = 0.005, detune = 0, delay = 0 } = {}) {
    if (!this.ready || !this.enabled) return;
    const t0 = this.t + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.detune.value = detune;
    this._env(g, t0, attack, dur, gain);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + attack + dur + 0.05);
  }

  noise({ dur = 0.25, gain = 0.2, freq = 900, q = 1.2, type = 'bandpass', sweepTo = null, delay = 0, attack = 0.01 } = {}) {
    if (!this.ready || !this.enabled) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t0, attack, dur, gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + attack + dur + 0.05);
  }

  // --- 効果音 ------------------------------------------------------------

  /** 繊維束がフックに掛かる */
  hookOn() {
    this.noise({ dur: 0.18, gain: 0.22, freq: 1500, sweepTo: 500, q: 0.9 });
    this.tone(320, { dur: 0.16, type: 'triangle', gain: 0.1 });
  }

  /** 木が木に当たる */
  knock(pitch = 1) {
    this.tone(220 * pitch, { dur: 0.12, type: 'triangle', gain: 0.22 });
    this.tone(430 * pitch, { dur: 0.07, type: 'sine', gain: 0.1 });
    this.noise({ dur: 0.06, gain: 0.14, freq: 2200, q: 0.7 });
  }

  /** ロープが張られる */
  stretch() {
    this.noise({ dur: 0.9, gain: 0.16, freq: 380, sweepTo: 1400, q: 2.2, attack: 0.2 });
  }

  pop(pitch = 1) {
    this.tone(660 * pitch, { dur: 0.18, type: 'sine', gain: 0.14, attack: 0.008 });
    this.tone(990 * pitch, { dur: 0.12, type: 'sine', gain: 0.07, delay: 0.05 });
  }

  /** 段階クリアの、やわらかい上がり音 */
  chime() {
    const scale = [523.25, 659.25, 783.99, 1046.5];
    scale.forEach((f, i) =>
      this.tone(f, { dur: 0.75, type: 'sine', gain: 0.13, attack: 0.01, delay: i * 0.085 })
    );
  }

  /** 梵鐘。非整数倍音を重ねる。 */
  bell() {
    if (!this.ready || !this.enabled) return;
    const base = 118;
    const partials = [
      [1.0, 0.5, 7.0],
      [2.0, 0.3, 5.0],
      [2.76, 0.2, 3.6],
      [4.07, 0.12, 2.4],
      [5.43, 0.08, 1.6],
      [8.21, 0.05, 1.0],
    ];
    const t0 = this.t;
    for (const [ratio, amp, decay] of partials) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = base * ratio;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(amp * 0.5, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + decay + 0.1);
    }
    this.noise({ dur: 0.25, gain: 0.2, freq: 2600, q: 0.6 });
  }

  // --- 継続音 -------------------------------------------------------------

  /** ぐるぐる撚っているときの、繊維がきしむ持続音 */
  loop(name, { freq = 700, q = 3, type = 'bandpass' } = {}) {
    if (!this.ready || !this.enabled) return null;
    let l = this._loops.get(name);
    if (!l) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      l = { src, filter: f, gain: g };
      this._loops.set(name, l);
    }
    return l;
  }

  setLoop(name, amount, freq) {
    const l = this.loop(name);
    if (!l) return;
    const t = this.t;
    l.gain.gain.setTargetAtTime(Math.max(0.0001, amount), t, 0.08);
    if (freq) l.filter.frequency.setTargetAtTime(freq, t, 0.08);
  }

  silenceAll() {
    for (const name of this._loops.keys()) this.setLoop(name, 0);
  }

  setMuted(m) {
    this.enabled = !m;
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.t, 0.05);
  }
}

export const audio = new Audio();
