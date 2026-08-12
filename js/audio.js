/* ============================================================
   ぬいぬい！ フェルトタウン — audio.js
   WebAudio による やわらかい効果音 + オルゴール風BGM
   ============================================================ */
'use strict';

const Snd = {
  ctx: null,
  master: null,
  bgmGain: null,
  muted: false,
  bgmTimer: 0,
  started: false,

  // 最初のタッチで呼ぶ（iOSのオーディオ解禁）
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.16;
      this.bgmGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  },

  // 単音（オルゴール風：サイン＋倍音、短い減衰）
  note(freq, when, dur, vol, dest, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.05);
    // きらっとした倍音
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = freq * 3;
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol * 0.18, t + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5);
    o2.connect(g2); g2.connect(dest || this.master);
    o2.start(t); o2.stop(t + dur);
  },

  // ---- 効果音 ----
  PENTA: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],

  // 線を描いている間の さらさら音（距離に応じて呼ぶ）
  drawTick(i) {
    if (!this.ctx || this.muted) return;
    const f = this.PENTA[i % this.PENTA.length];
    this.note(f, 0, 0.16, 0.05);
  },

  // 点を置く「ぽんっ」
  pon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.2);
  },

  // ボタンUIタップ
  tap() { this.note(659.25, 0, 0.15, 0.12); },

  // 色えらび
  pick(i) { this.note(this.PENTA[(i * 2) % 6], 0, 0.25, 0.14); },

  // ぬい目が走る「ちくちく」
  stitch() { this.note(1318.5, 0, 0.06, 0.05, null, 'triangle'); },

  // 布がふわっと広がる
  puff() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.35;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = 0.35;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  // 完成ファンファーレ（やさしいアルペジオ + きらきら）
  fanfare() {
    if (!this.ctx) return;
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => this.note(f, i * 0.09, 0.5, 0.14));
    for (let i = 0; i < 6; i++) {
      this.note(1568 + Math.random() * 800, 0.45 + i * 0.06, 0.3, 0.05);
    }
  },

  // 住民のよろこび「ぴょこぴょこ」
  cheer() {
    if (!this.ctx) return;
    [783.99, 987.77, 783.99, 1174.7].forEach((f, i) => this.note(f, i * 0.1, 0.18, 0.1, null, 'triangle'));
  },

  // ---- BGM（オルゴール風の短いループを生成し続ける）----
  MELO: [
    [0, 0], [2, 0.5], [4, 1], [2, 1.5], [0, 2], [4, 2.5], [5, 3],
    [4, 4], [2, 4.5], [1, 5], [2, 5.5], [0, 6], [-1, 7]
  ],
  BASE: 523.25,
  ST: [0, 2, 4, 5, 7, 9, 11],

  startBgm() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const bar = 8 * 0.42; // 1ループの長さ（秒）
    const loop = () => {
      if (!this.ctx || this.muted) { this.bgmTimer = setTimeout(loop, bar * 1000); return; }
      for (const [deg, beat] of this.MELO) {
        const oct = deg < 0 ? 0.5 : 1;
        const d = ((deg % 7) + 7) % 7;
        const f = this.BASE * oct * Math.pow(2, this.ST[d] / 12);
        this.note(f, beat * 0.42, 0.9, 0.5, this.bgmGain);
      }
      // やさしい低音
      [0, 4].forEach(b => this.note(this.BASE / 2, b * 0.42, 1.4, 0.35, this.bgmGain, 'triangle'));
      this.bgmTimer = setTimeout(loop, bar * 1000);
    };
    loop();
  }
};
