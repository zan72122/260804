/* 空港グランドハンドリング — WebAudio による効果音合成（外部素材なし） */
(function (AG) {
  'use strict';
  const A = (AG.Audio = {});
  let ctx = null, master = null, ready = false;
  const loops = {};

  function noiseBuffer(sec) {
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.5 + last * 2.0;
    }
    return buf;
  }

  A.init = function () {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    A.noise = noiseBuffer(3);
    buildLoops();
    ready = true;
  };

  A.unlock = function () {
    A.init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  A.get = () => ctx;

  function mkNoiseSrc() {
    const s = ctx.createBufferSource();
    s.buffer = A.noise; s.loop = true; s.start();
    return s;
  }

  function buildLoops() {
    /* --- ジェットエンジンのアイドル音（ファンの高音 + 低い轟音） --- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      const whineOsc = ctx.createOscillator(); whineOsc.type = 'sawtooth'; whineOsc.frequency.value = 380;
      const whineOsc2 = ctx.createOscillator(); whineOsc2.type = 'sawtooth'; whineOsc2.frequency.value = 574;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 5;
      const wg = ctx.createGain(); wg.gain.value = 0.10;
      whineOsc.connect(bp); whineOsc2.connect(bp); bp.connect(wg); wg.connect(g);
      const n = mkNoiseSrc();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
      const ng = ctx.createGain(); ng.gain.value = 0.55;
      n.connect(lp); lp.connect(ng); ng.connect(g);
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 1.2;
      const hg = ctx.createGain(); hg.gain.value = 0.10;
      n.connect(hp); hp.connect(hg); hg.connect(g);
      whineOsc.start(); whineOsc2.start();
      loops.engine = { g, osc: [whineOsc, whineOsc2], bp, lp, base: [380, 574] };
    }
    /* --- ブリッジ駆動モーター --- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 92;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 46;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3;
      const g2 = ctx.createGain(); g2.gain.value = 0.34;
      o.connect(lp); o2.connect(lp); lp.connect(g2); g2.connect(g);
      const n = mkNoiseSrc();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2;
      const ng = ctx.createGain(); ng.gain.value = 0.09;
      n.connect(bp); bp.connect(ng); ng.connect(g);
      /* うなり */
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 7.5;
      const lfoG = ctx.createGain(); lfoG.gain.value = 5;
      lfo.connect(lfoG); lfoG.connect(o.frequency); lfo.start();
      o.start(); o2.start();
      loops.bridge = { g, osc: [o, o2], base: [92, 46] };
    }
    /* --- ディーゼル（トラクター・ローダー） --- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 21;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 4;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o.connect(lp); o2.connect(lp); lp.connect(g2); g2.connect(g);
      const n = mkNoiseSrc();
      const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 700;
      const ng = ctx.createGain(); ng.gain.value = 0.14;
      n.connect(bp); bp.connect(ng); ng.connect(g);
      o.start(); o2.start();
      loops.diesel = { g, osc: [o, o2], base: [42, 21] };
    }
    /* --- ベルトコンベア --- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      const n = mkNoiseSrc();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.1;
      const ng = ctx.createGain(); ng.gain.value = 0.30;
      n.connect(bp); bp.connect(ng); ng.connect(g);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const og = ctx.createGain(); og.gain.value = 0.22;
      o.connect(lp); lp.connect(og); og.connect(g); o.start();
      loops.belt = { g, osc: [o], base: [58] };
    }
    /* --- 給油ポンプ --- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      const n = mkNoiseSrc();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 460; bp.Q.value = 0.9;
      const ng = ctx.createGain(); ng.gain.value = 0.40;
      n.connect(bp); bp.connect(ng); ng.connect(g);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 118;
      const og = ctx.createGain(); og.gain.value = 0.16;
      o.connect(og); og.connect(g); o.start();
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 11;
      const lg = ctx.createGain(); lg.gain.value = 0.10;
      lfo.connect(lg); lg.connect(og.gain); lfo.start();
      loops.pump = { g, osc: [o], base: [118] };
    }
    /* --- 環境音（風・遠くの空港） --- */
    {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
      const n = mkNoiseSrc();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4;
      const ng = ctx.createGain(); ng.gain.value = 0.22;
      n.connect(lp); lp.connect(ng); ng.connect(g);
      loops.amb = { g, osc: [], base: [] };
    }
  }

  function setLoop(name, level, pitch, ramp) {
    if (!ready) return;
    const L = loops[name];
    if (!L) return;
    const t = ctx.currentTime;
    L.g.gain.cancelScheduledValues(t);
    L.g.gain.setTargetAtTime(Math.max(0, level), t, ramp === undefined ? 0.12 : ramp);
    if (pitch !== undefined) {
      for (let i = 0; i < L.osc.length; i++) {
        L.osc[i].frequency.setTargetAtTime(L.base[i] * pitch, t, 0.12);
      }
    }
  }
  A.engine = (lv, p) => setLoop('engine', lv * 0.55, p);
  A.bridge = (lv, p) => setLoop('bridge', lv * 0.35, p, 0.06);
  A.diesel = (lv, p) => setLoop('diesel', lv * 0.42, p);
  A.belt = (lv, p) => setLoop('belt', lv * 0.25, p, 0.08);
  A.pump = (lv) => setLoop('pump', lv * 0.32, 1, 0.1);
  A.ambient = (lv) => setLoop('amb', lv * 0.30, 1, 0.5);
  A.stopAll = function () {
    for (const k in loops) setLoop(k, 0, undefined, 0.2);
  };

  /* --- ワンショット --- */
  function env(gain, t0, a, d, peak) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function tone(freq, type, dur, peak, delay, sweep) {
    if (!ready) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.008, dur, peak === undefined ? 0.25 : peak);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }
  A.tone = tone;

  function noiseBurst(dur, freq, Q, peak, delay, type) {
    if (!ready) return;
    const t0 = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = A.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.value = freq; f.Q.value = Q || 3;
    const g = ctx.createGain();
    env(g, t0, 0.004, dur, peak === undefined ? 0.3 : peak);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + 0.1);
  }
  A.noiseBurst = noiseBurst;

  /* 輪止めの「カコン！」 */
  A.thunk = function () {
    noiseBurst(0.05, 1500, 2.5, 0.30);
    tone(180, 'triangle', 0.16, 0.42, 0, 96);
    tone(340, 'square', 0.06, 0.14, 0.005, 250);
    noiseBurst(0.18, 320, 1.2, 0.14, 0.01, 'lowpass');
  };
  /* ブリッジ接続の「コトン」 */
  A.dock = function () {
    tone(126, 'sine', 0.34, 0.40, 0, 84);
    noiseBurst(0.10, 700, 1.4, 0.20);
    tone(252, 'triangle', 0.14, 0.16, 0.01, 190);
  };
  /* 連結の「ガチャン」 */
  A.latch = function () {
    noiseBurst(0.07, 2600, 3, 0.26);
    noiseBurst(0.16, 900, 1.6, 0.20, 0.02);
    tone(150, 'square', 0.2, 0.24, 0.01, 80);
  };
  /* 電源プラグの「カチッ」 */
  A.click = function () {
    noiseBurst(0.03, 3400, 5, 0.22);
    tone(880, 'square', 0.05, 0.12, 0.006, 620);
  };
  /* ブレーキの軋み */
  A.squeal = function (len) {
    if (!ready) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1250, t0);
    o.frequency.exponentialRampToValueAtTime(680, t0 + (len || 1.2));
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (len || 1.2));
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + (len || 1.2) + 0.1);
  };
  /* ワンドを振る風切り音 */
  A.whoosh = function (strength) {
    if (!ready) return;
    const s = Math.min(1, Math.abs(strength));
    if (s < 0.08) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = A.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(500, t0);
    f.frequency.exponentialRampToValueAtTime(1800, t0 + 0.14);
    f.Q.value = 1.4;
    const g = ctx.createGain();
    env(g, t0, 0.03, 0.22, 0.11 * s);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 0.4);
  };
  /* エアブレーキの排気 */
  A.hiss = function () {
    noiseBurst(0.55, 2400, 0.9, 0.16, 0, 'highpass');
  };
  /* 成功のきらめき */
  A.chime = function () {
    const sc = [523.25, 659.25, 783.99, 1046.5];
    sc.forEach((f, i) => { tone(f, 'sine', 0.7, 0.20, i * 0.075); tone(f * 2, 'sine', 0.4, 0.05, i * 0.075); });
  };
  A.fanfare = function () {
    const sc = [392, 523.25, 659.25, 783.99, 1046.5];
    sc.forEach((f, i) => {
      tone(f, 'triangle', 0.55, 0.22, i * 0.105);
      tone(f * 1.5, 'sine', 0.35, 0.08, i * 0.105);
    });
    noiseBurst(0.5, 4000, 0.8, 0.06, 0.5, 'highpass');
  };
  A.blip = function (up) {
    tone(up ? 660 : 440, 'sine', 0.12, 0.14, 0, up ? 990 : 330);
  };
})(window.AG);
