// 効果音と音楽をすべてWebAudioで合成する（外部アセットなし）
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      return; // 音なしでも遊べる
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    // ホワイトノイズバッファ（1秒）
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get ok() { return !!this.ctx; }
  now() { return this.ctx.currentTime; }

  _noise(dur, filterType, freq, q, gain, rate = 1, when = 0) {
    const t = this.now() + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
    return f;
  }

  _tone(freq, dur, type, gain, when = 0, freqEnd = null) {
    const t = this.now() + when;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // 巨大な雪塊が着地するドスン
  thud() {
    if (!this.ok) return;
    this._tone(90, 0.5, 'sine', 0.9, 0, 38);
    this._noise(0.35, 'lowpass', 240, 0.7, 0.5);
  }

  // 削るザクザク（intensity 0..1）
  scrape(intensity = 0.5) {
    if (!this.ok) return;
    const p = 0.7 + Math.random() * 0.6;
    this._noise(0.1 + intensity * 0.1, 'bandpass', 380 + intensity * 900 + Math.random() * 250, 1.6, 0.16 + intensity * 0.22, p);
    this._noise(0.06, 'highpass', 2600, 1, 0.05 + intensity * 0.06, p);
  }

  // ブラシのサラサラ
  brush() {
    if (!this.ok) return;
    this._noise(0.22, 'highpass', 2200 + Math.random() * 800, 0.8, 0.07, 0.9 + Math.random() * 0.3);
  }

  // 芯（完成面）に当たったときのカチン
  ting() {
    if (!this.ok) return;
    this._tone(1900 + Math.random() * 500, 0.12, 'triangle', 0.06);
  }

  // キラキラ（パーツ装着・スポット設置）
  chime(step = 0) {
    if (!this.ok) return;
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // Cペンタ
    const f = scale[step % scale.length];
    this._tone(f, 0.9, 'sine', 0.22);
    this._tone(f * 2, 0.5, 'sine', 0.08, 0.02);
    this._tone(f * 3.01, 0.3, 'sine', 0.03, 0.04);
  }

  pop() {
    if (!this.ok) return;
    this._tone(300, 0.12, 'square', 0.12, 0, 700);
    this._noise(0.08, 'bandpass', 1400, 1.5, 0.08);
  }

  click() {
    if (!this.ok) return;
    this._tone(700, 0.06, 'square', 0.15, 0, 300);
  }

  whoosh(dur = 0.9) {
    if (!this.ok) return;
    const f = this._noise(dur, 'bandpass', 300, 1.2, 0.35, 0.8);
    f.frequency.exponentialRampToValueAtTime(2400, this.now() + dur * 0.85);
  }

  // 花火：ヒュー…ドン＋パチパチ
  firework() {
    if (!this.ok) return;
    this._tone(900, 0.7, 'sine', 0.05, 0, 1600);
    const t = 0.75;
    this._tone(70, 0.5, 'sine', 0.5, t, 40);
    this._noise(0.4, 'lowpass', 900, 0.8, 0.3, 1, t);
    for (let i = 0; i < 7; i++) {
      this._noise(0.05, 'highpass', 3200, 1, 0.06, 1.4, t + 0.15 + Math.random() * 0.55);
    }
  }

  // 大歓声のかわりのシャンシャン鈴
  jingle() {
    if (!this.ok) return;
    for (let i = 0; i < 6; i++) this._noise(0.08, 'highpass', 5200, 2, 0.05, 1.6, i * 0.09);
  }

  // フィナーレ音楽（オルゴール＋パッド）ループ
  startMusic() {
    if (!this.ok || this.musicTimer) return;
    const bpm = 84;
    const eighth = 60 / bpm / 2;
    const chords = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [196.0, 246.94, 293.66], // G
      [261.63, 329.63, 392.0], // C
    ];
    const melodyScale = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    let nextTime = this.now() + 0.1;
    let melIdx = 3;
    const scheduleStep = (step, when) => {
      // パッド：2小節ごとにコード
      if (step % 16 === 0) {
        const chord = chords[(step / 16) % chords.length];
        for (const f of chord) {
          for (const det of [-3, 3]) {
            const t = when;
            const o = this.ctx.createOscillator();
            o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 750;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.045, t + 0.7);
            g.gain.setValueAtTime(0.045, t + eighth * 16 - 0.7);
            g.gain.linearRampToValueAtTime(0.0001, t + eighth * 16);
            o.connect(lp).connect(g).connect(this.master);
            o.start(t); o.stop(t + eighth * 16 + 0.1);
          }
        }
      }
      // オルゴール：ランダムウォークのペンタトニック
      if (step % 2 === 0 && Math.random() < 0.8) {
        melIdx = Math.max(0, Math.min(melodyScale.length - 1, melIdx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 2 : 1)));
        const f = melodyScale[melIdx];
        const t = when;
        this._tone(f, 1.4, 'sine', 0.13, t - this.now());
        this._tone(f * 4, 0.5, 'sine', 0.02, t - this.now());
      }
      // 鈴
      if (step % 4 === 2) this._noise(0.07, 'highpass', 6000, 2, 0.02, 1.5, when - this.now());
    };
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      while (nextTime < this.now() + 0.35) {
        scheduleStep(this.musicStep, nextTime);
        nextTime += eighth;
        this.musicStep++;
      }
    }, 120);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
