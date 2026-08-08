/* =========================================================
   audio.js — WebAudio による手続き的効果音（ES module 版）
   音声ファイルは一切持たず、その場で合成する。
   ========================================================= */
'use strict';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);


  const Audio = {
    ctx: null,
    master: null,
    enabled: true,
    ready: false,
    _noiseBuf: null,
    _frictionNode: null,
  };

  function ensure() {
    if (Audio.ctx) return Audio.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    Audio.ctx = new AC();
    Audio.master = Audio.ctx.createGain();
    Audio.master.gain.value = 0.85;
    Audio.master.connect(Audio.ctx.destination);
    Audio._noiseBuf = makeNoise(Audio.ctx, 2.0);
    Audio.ready = true;
    return Audio.ctx;
  }

  function makeNoise(ctx, sec) {
    const len = (ctx.sampleRate * sec) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // 少しブラウン寄りに
      d[i] = w * 0.7 + last * 3.0;
    }
    return buf;
  }

  /* iOS はユーザー操作の中でしか鳴らせないので、最初のタッチで解錠 */
  Audio.unlock = function () {
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    // 無音を一度鳴らして解錠を確実にする
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g); g.connect(Audio.master);
    o.start(); o.stop(ctx.currentTime + 0.03);
  };

  Audio.setEnabled = function (v) {
    Audio.enabled = v;
    if (Audio.master) Audio.master.gain.value = v ? 0.85 : 0.0;
  };

  function now() { return Audio.ctx.currentTime; }

  function noiseSource(dur, playbackRate) {
    const s = Audio.ctx.createBufferSource();
    s.buffer = Audio._noiseBuf;
    s.loop = true;
    if (playbackRate) s.playbackRate.value = playbackRate;
    s.start(0, Math.random() * 1.2);
    s.stop(now() + dur + 0.05);
    return s;
  }

  function env(gain, t0, a, d, peak, tail) {
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + (tail || 0));
  }

  function guard() {
    if (!Audio.enabled) return false;
    if (!Audio.ctx) ensure();
    if (!Audio.ctx) return false;
    if (Audio.ctx.state === 'suspended') Audio.ctx.resume();
    return true;
  }

  /* ---------- ポフ（生地を置く） ---------- */
  Audio.pof = function (vol) {
    if (!guard()) return;
    const t = now(), v = vol === undefined ? 1 : vol;
    // 低い胴鳴り
    const o = Audio.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    const g = Audio.ctx.createGain();
    env(g, t, 0.005, 0.20, 0.42 * v);
    o.connect(g); g.connect(Audio.master);
    o.start(t); o.stop(t + 0.32);
    // 粉の散る空気
    const n = noiseSource(0.3);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(320, t + 0.22);
    const ng = Audio.ctx.createGain();
    env(ng, t, 0.006, 0.20, 0.20 * v);
    n.connect(f); f.connect(ng); ng.connect(Audio.master);
  };

  /* ---------- 指で押す（ぷにっ） ---------- */
  Audio.press = function (pitch) {
    if (!guard()) return;
    const t = now();
    const o = Audio.ctx.createOscillator();
    o.type = 'sine';
    const base = 300 * (pitch || 1);
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.12);
    const g = Audio.ctx.createGain();
    env(g, t, 0.004, 0.11, 0.18);
    o.connect(g); g.connect(Audio.master);
    o.start(t); o.stop(t + 0.2);

    const n = noiseSource(0.16);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.9;
    const ng = Audio.ctx.createGain();
    env(ng, t, 0.004, 0.10, 0.10);
    n.connect(f); f.connect(ng); ng.connect(Audio.master);
  };

  /* ---------- 成形の摩擦音（連続・速度で音量が変わる） ---------- */
  Audio.frictionStart = function () {
    if (!guard()) return;
    if (Audio._frictionNode) return;
    const n = Audio.ctx.createBufferSource();
    n.buffer = Audio._noiseBuf; n.loop = true;
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.6;
    const f2 = Audio.ctx.createBiquadFilter();
    f2.type = 'highpass'; f2.frequency.value = 140;
    const g = Audio.ctx.createGain();
    g.gain.value = 0.0001;
    n.connect(f); f.connect(f2); f2.connect(g); g.connect(Audio.master);
    n.start(0, Math.random());
    Audio._frictionNode = { src: n, gain: g, filt: f };
  };
  Audio.frictionLevel = function (level) {
    const fn = Audio._frictionNode;
    if (!fn || !Audio.ctx) return;
    const t = now();
    const v = clamp(level, 0, 1);
    fn.gain.gain.setTargetAtTime(0.0001 + v * 0.16, t, 0.05);
    fn.filt.frequency.setTargetAtTime(420 + v * 1500, t, 0.06);
  };
  Audio.frictionStop = function () {
    const fn = Audio._frictionNode;
    if (!fn) return;
    const t = now();
    fn.gain.gain.setTargetAtTime(0.0001, t, 0.06);
    try { fn.src.stop(t + 0.5); } catch (e) { /* noop */ }
    Audio._frictionNode = null;
  };

  /* ---------- スッ（クープ） ---------- */
  Audio.slash = function (speed) {
    if (!guard()) return;
    const t = now();
    const sp = clamp(speed === undefined ? 0.6 : speed, 0.2, 1.4);
    const n = noiseSource(0.3);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(4200 * sp, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.16);
    const g = Audio.ctx.createGain();
    env(g, t, 0.008, 0.14, 0.30);
    n.connect(f); f.connect(g); g.connect(Audio.master);

    // 刃が抜ける小さな倍音
    const o = Audio.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500 * sp, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.13);
    const og = Audio.ctx.createGain();
    env(og, t, 0.006, 0.10, 0.055);
    o.connect(og); og.connect(Audio.master);
    o.start(t); o.stop(t + 0.2);
  };

  /* ---------- シュワッ（蒸気） ---------- */
  Audio.steam = function (dur) {
    if (!guard()) return;
    const t = now(), D = dur || 1.8;
    const n = noiseSource(D + 0.4);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.65;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3600, t + 0.22);
    f.frequency.exponentialRampToValueAtTime(700, t + D);
    const g = Audio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.34, t + 0.14);
    g.gain.setValueAtTime(0.34, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    n.connect(f); f.connect(g); g.connect(Audio.master);
  };

  /* ---------- パチパチ（皮のはぜる音） ---------- */
  Audio.crackle = function (vol) {
    if (!guard()) return;
    const t = now() + Math.random() * 0.02;
    const n = noiseSource(0.06);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2600 + Math.random() * 2600;
    const g = Audio.ctx.createGain();
    env(g, t, 0.001, 0.035, (0.05 + Math.random() * 0.07) * (vol || 1));
    n.connect(f); f.connect(g); g.connect(Audio.master);
  };

  /* ---------- コンコン（叩く） ---------- */
  Audio.knock = function () {
    if (!guard()) return;
    const t0 = now();
    [0, 0.155].forEach((off, i) => {
      const t = t0 + off;
      // 打撃のアタック
      const n = noiseSource(0.1);
      const f = Audio.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
      const g = Audio.ctx.createGain();
      env(g, t, 0.001, 0.05, 0.20);
      n.connect(f); f.connect(g); g.connect(Audio.master);
      // 中が空洞に鳴る感じ
      [[196, 0.16], [430, 0.10], [880, 0.05]].forEach(([fr, amp]) => {
        const o = Audio.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(fr * (i ? 1.04 : 1), t);
        o.frequency.exponentialRampToValueAtTime(fr * 0.9, t + 0.18);
        const og = Audio.ctx.createGain();
        env(og, t, 0.002, 0.16, amp);
        o.connect(og); og.connect(Audio.master);
        o.start(t); o.stop(t + 0.3);
      });
    });
  };

  /* ---------- ふくらむ（オーブンスプリング）低いうねり ---------- */
  Audio.swell = function (dur) {
    if (!guard()) return;
    const t = now(), D = dur || 3.2;
    const o = Audio.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(112, t + D);
    const g = Audio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11, t + D * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    o.connect(g); g.connect(Audio.master);
    o.start(t); o.stop(t + D + 0.1);
  };

  /* ---------- クープが開く瞬間のやわらかい合図 ---------- */
  Audio.pop = function (pitch) {
    if (!guard()) return;
    const t = now();
    const o = Audio.ctx.createOscillator();
    o.type = 'sine';
    const p = 380 * (pitch || 1);
    o.frequency.setValueAtTime(p * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(p * 1.5, t + 0.09);
    const g = Audio.ctx.createGain();
    env(g, t, 0.004, 0.13, 0.10);
    o.connect(g); g.connect(Audio.master);
    o.start(t); o.stop(t + 0.22);
  };

  /* ---------- きらきら（工程が進んだ合図） ---------- */
  Audio.chime = function (kind) {
    if (!guard()) return;
    const t = now();
    const seq = kind === 'big'
      ? [523.25, 659.25, 783.99, 1046.5]
      : [659.25, 987.77];
    seq.forEach((fr, i) => {
      const st = t + i * 0.085;
      const o = Audio.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      const o2 = Audio.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = fr * 2.01;
      const g = Audio.ctx.createGain();
      const g2 = Audio.ctx.createGain();
      env(g, st, 0.006, 0.42, 0.10);
      env(g2, st, 0.006, 0.24, 0.030);
      o.connect(g); g.connect(Audio.master);
      o2.connect(g2); g2.connect(Audio.master);
      o.start(st); o.stop(st + 0.7);
      o2.start(st); o2.stop(st + 0.5);
    });
  };

  /* ---------- ふわっ（UI タップ） ---------- */
  Audio.tapUI = function () {
    if (!guard()) return;
    const t = now();
    const o = Audio.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(760, t);
    o.frequency.exponentialRampToValueAtTime(1180, t + 0.07);
    const g = Audio.ctx.createGain();
    env(g, t, 0.004, 0.10, 0.075);
    o.connect(g); g.connect(Audio.master);
    o.start(t); o.stop(t + 0.18);
  };

  /* ---------- 布に置く（さらっ） ---------- */
  Audio.cloth = function () {
    if (!guard()) return;
    const t = now();
    const n = noiseSource(0.4);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(2400, t); f.Q.value = 0.5;
    f.frequency.exponentialRampToValueAtTime(900, t + 0.3);
    const g = Audio.ctx.createGain();
    env(g, t, 0.02, 0.26, 0.12);
    n.connect(f); f.connect(g); g.connect(Audio.master);
  };

  /* ---------- オーブンの扉 ---------- */
  Audio.door = function (open) {
    if (!guard()) return;
    const t = now();
    const o = Audio.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(open ? 90 : 130, t);
    o.frequency.exponentialRampToValueAtTime(open ? 150 : 60, t + 0.25);
    const g = Audio.ctx.createGain();
    env(g, t, 0.01, 0.24, 0.22);
    o.connect(g); g.connect(Audio.master);
    o.start(t); o.stop(t + 0.4);
    const n = noiseSource(0.3);
    const f = Audio.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const ng = Audio.ctx.createGain();
    env(ng, t, 0.01, 0.2, 0.09);
    n.connect(f); f.connect(ng); ng.connect(Audio.master);
  };

  /* ---------- オーブンのごく低い唸り（焼成中だけ） ---------- */
  Audio.ovenHum = function (on) {
    if (!guard()) return;
    if (on) {
      if (Audio._hum) return;
      const n = Audio.ctx.createBufferSource();
      n.buffer = Audio._noiseBuf; n.loop = true;
      const f = Audio.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 190; f.Q.value = 1.2;
      const g = Audio.ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.075, now(), 0.6);
      n.connect(f); f.connect(g); g.connect(Audio.master);
      n.start(0, Math.random());
      Audio._hum = { src: n, gain: g };
    } else if (Audio._hum) {
      const h = Audio._hum;
      h.gain.gain.setTargetAtTime(0.0001, now(), 0.4);
      try { h.src.stop(now() + 1.6); } catch (e) { /* noop */ }
      Audio._hum = null;
    }
  };


export const Sfx = Audio;
export default Audio;
