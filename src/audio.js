/* ============================================================
 *  audio.js — WebAudio による完全合成の効果音
 *  外部音源なし。iOS のため必ずユーザー操作で resume する。
 * ============================================================ */

function noiseBuffer(ctx, seconds = 2, brown = true) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    else d[i] = w;
  }
  return buf;
}

export class Audio {
  constructor() {
    this.ready = false;
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // やわらかいリミッタ代わり
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 5;
    comp.attack.value = 0.005; comp.release.value = 0.22;
    comp.connect(this.master);
    this.bus = comp;

    this.brown = noiseBuffer(ctx, 3, true);
    this.white = noiseBuffer(ctx, 1.5, false);

    /* --- 常時ループ：カッターヘッドの唸り「ゴゴゴゴ」 --- */
    const rum = ctx.createBufferSource();
    rum.buffer = this.brown; rum.loop = true;
    const rumLP = ctx.createBiquadFilter();
    rumLP.type = 'lowpass'; rumLP.frequency.value = 210; rumLP.Q.value = 1.6;
    const rumG = ctx.createGain(); rumG.gain.value = 0;
    rum.connect(rumLP); rumLP.connect(rumG); rumG.connect(this.bus);
    rum.start();
    this.rumbleGain = rumG; this.rumbleLP = rumLP;

    // 低音の芯（うねりを出すため 2 基を微妙にデチューン）
    this.growls = [];
    for (const f of [33, 41.5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 130;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(lp); lp.connect(g); g.connect(this.bus); o.start();
      this.growls.push({ o, g, base: f });
    }

    /* --- 常時ループ：砕石のガラガラ --- */
    const gr = ctx.createBufferSource();
    gr.buffer = this.white; gr.loop = true;
    const grBP = ctx.createBiquadFilter();
    grBP.type = 'bandpass'; grBP.frequency.value = 2600; grBP.Q.value = 0.9;
    const grG = ctx.createGain(); grG.gain.value = 0;
    gr.connect(grBP); grBP.connect(grG); grG.connect(this.bus); gr.start();
    this.gravelGain = grG;

    /* --- 常時ループ：ベルトコンベアの走行音 --- */
    const bl = ctx.createBufferSource();
    bl.buffer = this.brown; bl.loop = true;
    const blBP = ctx.createBiquadFilter();
    blBP.type = 'bandpass'; blBP.frequency.value = 620; blBP.Q.value = 1.1;
    const blG = ctx.createGain(); blG.gain.value = 0;
    bl.connect(blBP); blBP.connect(blG); blG.connect(this.bus); bl.start();
    this.beltGain = blG;

    /* --- 坑内のアンビエンス --- */
    const amb = ctx.createBufferSource();
    amb.buffer = this.brown; amb.loop = true;
    const ambLP = ctx.createBiquadFilter();
    ambLP.type = 'lowpass'; ambLP.frequency.value = 400;
    const ambG = ctx.createGain(); ambG.gain.value = 0.05;
    amb.connect(ambLP); ambLP.connect(ambG); ambG.connect(this.bus); amb.start();

    this.ready = true;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  /** カッターヘッドの回転量 0..1 と掘進中かどうか */
  setCutter(spin, digging) {
    if (!this.ready) return;
    const t = this.t;
    const g = 0.30 * spin + (digging ? 0.28 : 0);
    this.rumbleGain.gain.setTargetAtTime(g, t, 0.25);
    this.rumbleLP.frequency.setTargetAtTime(150 + spin * 260 + (digging ? 130 : 0), t, 0.3);
    for (const gr of this.growls) {
      gr.g.gain.setTargetAtTime(spin * 0.095 * (digging ? 1.5 : 1), t, 0.3);
      gr.o.frequency.setTargetAtTime(gr.base * (0.8 + spin * 0.35), t, 0.4);
    }
    this.gravelGain.gain.setTargetAtTime(digging ? 0.11 * spin : 0.0, t, 0.15);
    this.beltGain.gain.setTargetAtTime(digging ? 0.055 : 0.012 * spin, t, 0.3);
  }

  _env(node, t, a, d, peak) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  /** 「カコン」— セグメントが嵌る音 */
  clunk(pitch = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    // 打撃のアタック
    const n = ctx.createBufferSource(); n.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1500 * pitch; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    n.connect(bp); bp.connect(ng); ng.connect(this.bus);
    this._env(ng, t, 0.004, 0.09, 0.34);
    n.start(t); n.stop(t + 0.2);
    // 胴鳴り（低い方が「コン」）
    [[196, 0.30, 0.34], [128, 0.42, 0.26], [92, 0.55, 0.16]].forEach(([f, d, a], i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f * pitch * 1.7, t);
      o.frequency.exponentialRampToValueAtTime(f * pitch, t + 0.05);
      const g = ctx.createGain(); o.connect(g); g.connect(this.bus);
      this._env(g, t, 0.005, d, a);
      o.start(t); o.stop(t + d + 0.1);
    });
  }

  /** 油圧のシュッ */
  hiss(dur = 0.5, level = 0.16) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const n = ctx.createBufferSource(); n.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5200, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + dur);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    n.connect(bp); bp.connect(g); g.connect(this.bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.start(t); n.stop(t + dur + 0.1);
  }

  /** 電動機の起動 */
  spinUp() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(48, t);
    o.frequency.exponentialRampToValueAtTime(330, t + 1.7);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + 1.7);
    const g = ctx.createGain();
    o.connect(lp); lp.connect(g); g.connect(this.bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    o.start(t); o.stop(t + 2.1);
    this.hiss(0.7, 0.10);
  }

  /** リング完成のきらめき */
  fanfare() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const st = t + i * 0.085;
      [1, 2, 3].forEach((h, k) => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f * h;
        const g = ctx.createGain(); o.connect(g); g.connect(this.bus);
        const peak = 0.16 / (h * h);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(peak, st + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
        o.start(st); o.stop(st + 1.0);
      });
    });
    // きらきら
    for (let i = 0; i < 14; i++) {
      const st = t + 0.1 + Math.random() * 0.7;
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 1400 + Math.random() * 2600;
      const g = ctx.createGain(); o.connect(g); g.connect(this.bus);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.05, st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.3);
      o.start(st); o.stop(st + 0.35);
    }
  }

  /** 吸着したときの軽いポン */
  snap() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.09);
    const g = ctx.createGain(); o.connect(g); g.connect(this.bus);
    this._env(g, t, 0.006, 0.13, 0.13);
    o.start(t); o.stop(t + 0.2);
  }

  /** 岩の落下・土砂 */
  rockDrop() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    const n = ctx.createBufferSource(); n.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 900; bp.Q.value = 1.4;
    const g = ctx.createGain();
    n.connect(bp); bp.connect(g); g.connect(this.bus);
    this._env(g, t, 0.006, 0.18, 0.09);
    n.start(t); n.stop(t + 0.3);
  }

  /** 警笛（掘進開始の合図） */
  horn() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.t;
    [220, 277].forEach((f) => {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); o.connect(lp); lp.connect(g); g.connect(this.bus);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
      g.gain.setValueAtTime(0.07, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.start(t); o.stop(t + 0.6);
    });
  }
}
