/**
 * 音は全部その場で合成する。外部ファイルなし＝読み込み待ちなし。
 * 4 歳児が長く触っても疲れないよう、耳に刺さる帯域は避けて柔らかく。
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.started = false;
    this._padGain = null;
    this._noiseBuffer = null;
  }

  /** ユーザー操作の中から呼ぶこと（iOS の自動再生制限のため）。 */
  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    this._noiseBuffer = this._makeNoise();
    this._startPad();
    this.started = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.08);
    }
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 水中のごく低い環境音＋ゆっくり動くパッド。 */
  _startPad() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    gain.connect(this.master);
    this._padGain = gain;

    // 遠くの水のうねり（ノイズにローパス＋ゆっくりした LFO）
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.085;
    noise.connect(lp).connect(noiseGain).connect(gain);
    noise.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    // やわらかい三度堆積の持続音
    [174.61, 261.63, 329.63, 392.0].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.05 / (i * 0.6 + 1);
      const trem = ctx.createOscillator();
      trem.frequency.value = 0.05 + i * 0.017;
      const tremGain = ctx.createGain();
      tremGain.gain.value = g.gain.value * 0.65;
      trem.connect(tremGain).connect(g.gain);
      trem.start();
      osc.connect(g).connect(gain);
      osc.start();
    });

    gain.gain.setTargetAtTime(0.55, ctx.currentTime, 3.0);
  }

  _env(node, t0, attack, decay, peak) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  /** ぷくっという泡。上がるピッチのサイン波。 */
  bubble(pitch = 1, vol = 0.28) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = 320 * pitch * (0.85 + Math.random() * 0.4);
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.exponentialRampToValueAtTime(base * 2.6, t0 + 0.09);
    const g = ctx.createGain();
    this._env(g, t0, 0.006, 0.1, vol);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  }

  /** きゅっ、と磨く音。バンドパスしたノイズの短いひと吹き。 */
  wipe(vol = 0.16) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, t0);
    bp.frequency.exponentialRampToValueAtTime(2200, t0 + 0.18);
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    this._env(g, t0, 0.02, 0.18, vol);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.3);
  }

  /** ごほうびのきらめき。ペンタトニックを順に鳴らす。 */
  chime(step = 0, vol = 0.22) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[step % scale.length];
    [1, 2, 3].forEach((h, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f * h;
      const g = ctx.createGain();
      this._env(g, t0, 0.01, 0.9 - i * 0.22, vol / (i * 2 + 1));
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    });
  }

  /** かちっ、とはまる音。 */
  click(vol = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.12);
    const g = ctx.createGain();
    this._env(g, t0, 0.004, 0.14, vol);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  /** 吸い込みの持続音。掃除中だけ鳴らして、止めたら消す。 */
  suction(on) {
    if (!this.ctx) return;
    if (!this._suck) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 480;
      bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this._suck = g;
    }
    const t = this.ctx.currentTime;
    this._suck.gain.setTargetAtTime(on && this.enabled ? 0.09 : 0.0001, t, 0.12);
  }

  /** クリア時のアルペジオ。 */
  fanfare() {
    if (!this.ctx || !this.enabled) return;
    const notes = [0, 1, 2, 3, 4, 5, 4, 5];
    notes.forEach((n, i) => setTimeout(() => this.chime(n, 0.2), i * 130));
  }
}
