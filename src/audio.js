// 手続き的サウンド（WebAudio）。ファイル不要・重機の質量感を優先。
import { clamp, clamp01, lerp } from './util.js';

let ctx = null;
let master = null;
let enabled = true;
let unlocked = false;
let noiseBuf = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 5;
  comp.attack.value = 0.004; comp.release.value = 0.20;
  master.connect(comp); comp.connect(ctx.destination);
  // ノイズバッファ（2秒）
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02; // ブラウンノイズ寄り
    d[i] = w * 0.6 + last * 3.2;
  }
  return ctx;
}

export function unlock() {
  ensure();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (!unlocked) {
    unlocked = true;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const o = ctx.createOscillator(); o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + 0.02);
  }
}
export function setEnabled(v) {
  enabled = v;
  if (master && ctx) master.gain.setTargetAtTime(v ? 0.85 : 0.0, ctx.currentTime, 0.05);
}
export function isEnabled() { return enabled; }
export function isReady() { return !!ctx && enabled; }

const now = () => ctx.currentTime;
function noiseSrc(loop = false) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = loop;
  return s;
}
function env(node, t0, a, d, peak = 1, sus = 0, susDur = 0, rel = 0.1) {
  const g = node.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  if (susDur > 0) {
    g.exponentialRampToValueAtTime(Math.max(sus, 0.0002), t0 + a + d);
    g.setValueAtTime(Math.max(sus, 0.0002), t0 + a + d + susDur);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d + susDur + rel);
  } else {
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
}

/* ---------- 継続音：刃が土に入る「ズズズズ」 ---------- */
class DigLoop {
  constructor() { this.on = false; }
  start() {
    if (!ensure() || this.on) return;
    this.on = true;
    const t0 = now();
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(master);
    // 土のこすれ
    this.n = noiseSrc(true);
    this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass';
    this.bp.frequency.value = 420; this.bp.Q.value = 0.8;
    this.ng = ctx.createGain(); this.ng.gain.value = 0.5;
    this.n.connect(this.bp); this.bp.connect(this.ng); this.ng.connect(this.out);
    // 低い油圧のうなり
    this.o = ctx.createOscillator(); this.o.type = 'sawtooth'; this.o.frequency.value = 47;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 180;
    this.og = ctx.createGain(); this.og.gain.value = 0.5;
    this.o.connect(this.lp); this.lp.connect(this.og); this.og.connect(this.out);
    // 微振動
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 7.5;
    this.lfoG = ctx.createGain(); this.lfoG.gain.value = 90;
    this.lfo.connect(this.lfoG); this.lfoG.connect(this.bp.frequency);
    this.n.start(t0); this.o.start(t0); this.lfo.start(t0);
    this.out.gain.setTargetAtTime(0.30, t0, 0.045);
  }
  set(intensity, depth) {
    if (!this.on) return;
    const t = now();
    this.out.gain.setTargetAtTime(0.10 + 0.30 * clamp01(intensity), t, 0.05);
    this.bp.frequency.setTargetAtTime(lerp(560, 240, clamp01(depth)), t, 0.09);
    this.o.frequency.setTargetAtTime(lerp(52, 38, clamp01(depth)), t, 0.09);
  }
  stop() {
    if (!this.on) return;
    this.on = false;
    const t = now();
    this.out.gain.setTargetAtTime(0.0001, t, 0.06);
    const { n, o, lfo } = this;
    setTimeout(() => { try { n.stop(); o.stop(); lfo.stop(); } catch (e) { } }, 400);
  }
}
export const digLoop = new DigLoop();

/* ---------- 継続音：抜く前の「ググググ」 ---------- */
class StrainLoop {
  constructor() { this.on = false; }
  start() {
    if (!ensure() || this.on) return;
    this.on = true;
    const t0 = now();
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(master);
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 41;
    this.o2 = ctx.createOscillator(); this.o2.type = 'square'; this.o2.frequency.value = 27;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 210; this.lp.Q.value = 3;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    this.o1.connect(this.lp); this.o2.connect(g2); g2.connect(this.lp);
    this.lp.connect(this.out);
    // 木がきしむ音
    this.n = noiseSrc(true);
    this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 900; this.bp.Q.value = 5;
    this.ng = ctx.createGain(); this.ng.gain.value = 0.10;
    this.n.connect(this.bp); this.bp.connect(this.ng); this.ng.connect(this.out);
    this.o1.start(t0); this.o2.start(t0); this.n.start(t0);
    this.out.gain.setTargetAtTime(0.26, t0, 0.10);
  }
  set(tension) {
    if (!this.on) return;
    const t = now();
    this.out.gain.setTargetAtTime(0.12 + 0.30 * clamp01(tension), t, 0.08);
    this.o1.frequency.setTargetAtTime(lerp(38, 58, clamp01(tension)), t, 0.12);
    this.lp.frequency.setTargetAtTime(lerp(160, 330, clamp01(tension)), t, 0.12);
    this.ng.gain.setTargetAtTime(0.04 + 0.16 * clamp01(tension), t, 0.10);
  }
  stop() {
    if (!this.on) return;
    this.on = false;
    const t = now();
    this.out.gain.setTargetAtTime(0.0001, t, 0.05);
    const { o1, o2, n } = this;
    setTimeout(() => { try { o1.stop(); o2.stop(); n.stop(); } catch (e) { } }, 400);
  }
}
export const strainLoop = new StrainLoop();

/* ---------- 継続音：エンジン ---------- */
class Engine {
  constructor() { this.on = false; this.load = 0; }
  start() {
    if (!ensure() || this.on) return;
    this.on = true;
    const t0 = now();
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(master);
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 33;
    this.o2 = ctx.createOscillator(); this.o2.type = 'sawtooth'; this.o2.frequency.value = 66.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.30;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 260;
    this.o1.connect(this.lp); this.o2.connect(g2); g2.connect(this.lp); this.lp.connect(this.out);
    this.n = noiseSrc(true);
    this.nf = ctx.createBiquadFilter(); this.nf.type = 'lowpass'; this.nf.frequency.value = 400;
    this.ng = ctx.createGain(); this.ng.gain.value = 0.05;
    this.n.connect(this.nf); this.nf.connect(this.ng); this.ng.connect(this.out);
    this.o1.start(t0); this.o2.start(t0); this.n.start(t0);
    this.out.gain.setTargetAtTime(0.075, t0, 0.5);
  }
  rev(load) {
    if (!this.on) return;
    const t = now();
    const f = lerp(31, 47, clamp01(load));
    this.o1.frequency.setTargetAtTime(f, t, 0.25);
    this.o2.frequency.setTargetAtTime(f * 2.02, t, 0.25);
    this.out.gain.setTargetAtTime(0.06 + 0.075 * clamp01(load), t, 0.25);
  }
  stop() {
    if (!this.on) return;
    this.on = false;
    const t = now();
    this.out.gain.setTargetAtTime(0.0001, t, 0.30);
    const { o1, o2, n } = this;
    setTimeout(() => { try { o1.stop(); o2.stop(); n.stop(); } catch (e) { } }, 1600);
  }
}
export const engine = new Engine();

/* ---------- 継続音：水 ---------- */
class WaterLoop {
  constructor() { this.on = false; }
  start() {
    if (!ensure() || this.on) return;
    this.on = true;
    const t0 = now();
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(master);
    this.n = noiseSrc(true);
    this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 1900; this.bp.Q.value = 0.7;
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 500;
    this.n.connect(this.hp); this.hp.connect(this.bp); this.bp.connect(this.out);
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 3.1;
    this.lg = ctx.createGain(); this.lg.gain.value = 700;
    this.lfo.connect(this.lg); this.lg.connect(this.bp.frequency);
    this.n.start(t0); this.lfo.start(t0);
    this.out.gain.setTargetAtTime(0.16, t0, 0.08);
  }
  stop() {
    if (!this.on) return;
    this.on = false;
    const t = now();
    this.out.gain.setTargetAtTime(0.0001, t, 0.10);
    const { n, lfo } = this;
    setTimeout(() => { try { n.stop(); lfo.stop(); } catch (e) { } }, 500);
  }
}
export const waterLoop = new WaterLoop();

/* ---------- ワンショット ---------- */
export function pop(scale = 1) {
  // 「スポン！」= 低いサーモンプ + ピッチが落ちる丸い音 + 土のはじけ
  if (!ensure()) return;
  const t0 = now();
  // 低音の解放
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(190 * scale, t0);
  o.frequency.exponentialRampToValueAtTime(46 * scale, t0 + 0.26);
  const g = ctx.createGain(); env(g, t0, 0.006, 0.42, 0.62);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.6);
  // 丸い「ポン」
  const o2 = ctx.createOscillator(); o2.type = 'triangle';
  o2.frequency.setValueAtTime(560 * scale, t0 + 0.01);
  o2.frequency.exponentialRampToValueAtTime(150 * scale, t0 + 0.17);
  const g2 = ctx.createGain(); env(g2, t0 + 0.01, 0.005, 0.22, 0.28);
  o2.connect(g2); g2.connect(master); o2.start(t0); o2.stop(t0 + 0.4);
  // 土がはがれる
  const n = noiseSrc(); const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(1500, t0); bp.Q.value = 0.6;
  bp.frequency.exponentialRampToValueAtTime(300, t0 + 0.3);
  const ng = ctx.createGain(); env(ng, t0, 0.004, 0.34, 0.34);
  n.connect(bp); bp.connect(ng); ng.connect(master); n.start(t0); n.stop(t0 + 0.5);
}

export function crumble(amount = 1) {
  // 「パラパラ」
  if (!ensure()) return;
  const t0 = now();
  const count = Math.round(6 + amount * 10);
  for (let i = 0; i < count; i++) {
    const t = t0 + Math.random() * 0.5 * amount;
    const n = noiseSrc();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 2600; bp.Q.value = 3;
    const g = ctx.createGain(); env(g, t, 0.002, 0.05 + Math.random() * 0.05, 0.06 + Math.random() * 0.06);
    n.connect(bp); bp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.2);
  }
}

export function thud(scale = 1) {
  // 「ズン」
  if (!ensure()) return;
  const t0 = now();
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(105 * scale, t0);
  o.frequency.exponentialRampToValueAtTime(32 * scale, t0 + 0.32);
  const g = ctx.createGain(); env(g, t0, 0.008, 0.5, 0.75);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.7);
  const n = noiseSrc(); const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 260;
  const ng = ctx.createGain(); env(ng, t0, 0.004, 0.20, 0.30);
  n.connect(lp); lp.connect(ng); ng.connect(master); n.start(t0); n.stop(t0 + 0.4);
}

export function clank(scale = 1) {
  // 金属の当たり「ガシャン」
  if (!ensure()) return;
  const t0 = now();
  [1, 1.47, 2.09, 2.71].forEach((m, i) => {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = 240 * scale * m * (0.98 + Math.random() * 0.04);
    const g = ctx.createGain(); env(g, t0, 0.002, 0.16 + i * 0.05, 0.10 / (i + 1));
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.5);
  });
  const n = noiseSrc(); const bp = ctx.createBiquadFilter();
  bp.type = 'highpass'; bp.frequency.value = 1600;
  const ng = ctx.createGain(); env(ng, t0, 0.002, 0.09, 0.12);
  n.connect(bp); bp.connect(ng); ng.connect(master); n.start(t0); n.stop(t0 + 0.2);
}

export function hydraulicStop() {
  // シリンダー停止時の「プシュッ」
  if (!ensure()) return;
  const t0 = now();
  const n = noiseSrc(); const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(2600, t0);
  bp.frequency.exponentialRampToValueAtTime(900, t0 + 0.25); bp.Q.value = 1.2;
  const g = ctx.createGain(); env(g, t0, 0.01, 0.30, 0.16);
  n.connect(bp); bp.connect(g); g.connect(master); n.start(t0); n.stop(t0 + 0.4);
}

export function click(freq = 660, vol = 0.16) {
  if (!ensure()) return;
  const t0 = now();
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const g = ctx.createGain(); env(g, t0, 0.004, 0.11, vol);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.2);
}

export function chime(base = 523.25) {
  if (!ensure()) return;
  const t0 = now();
  [0, 4, 7, 12].forEach((semi, i) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = base * Math.pow(2, semi / 12);
    const g = ctx.createGain(); env(g, t0 + i * 0.085, 0.01, 0.75, 0.16);
    o.connect(g); g.connect(master); o.start(t0 + i * 0.085); o.stop(t0 + i * 0.085 + 1.0);
  });
}

export function bird() {
  if (!ensure()) return;
  const t0 = now() + Math.random() * 0.2;
  const notes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    const t = t0 + i * (0.09 + Math.random() * 0.07);
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = 2100 + Math.random() * 1500;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * (0.6 + Math.random() * 0.9), t + 0.07);
    const g = ctx.createGain(); env(g, t, 0.008, 0.09, 0.055);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
  }
}

export function splash() {
  if (!ensure()) return;
  const t0 = now();
  const n = noiseSrc(); const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(700, t0);
  bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.18); bp.Q.value = 0.8;
  const g = ctx.createGain(); env(g, t0, 0.006, 0.28, 0.20);
  n.connect(bp); bp.connect(g); g.connect(master); n.start(t0); n.stop(t0 + 0.4);
}

// 環境音（そよ風）
let ambient = null;
export function startAmbient() {
  if (!ensure() || ambient) return;
  const t0 = now();
  const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(master);
  const n = noiseSrc(true);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 130;
  n.connect(hp); hp.connect(lp); lp.connect(out);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
  const lg = ctx.createGain(); lg.gain.value = 200;
  lfo.connect(lg); lg.connect(lp.frequency);
  n.start(t0); lfo.start(t0);
  out.gain.setTargetAtTime(0.035, t0, 2.0);
  ambient = { out, n, lfo };
}

export function stopAll() {
  digLoop.stop(); strainLoop.stop(); waterLoop.stop(); engine.stop();
}
