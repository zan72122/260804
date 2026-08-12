/* にじいろタウン - プロシージャルサウンド（Web Audio） */
window.NT = window.NT || {};
(function () {
  const A = { ctx: null, master: null, ready: false };
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.5, 1174.7, 1318.5];

  A.init = function () {
    if (A.ready) { A.resume(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.55;
      A.master.connect(A.ctx.destination);
      makeDrawLoop();
      startAmbient();
      A.ready = true;
    } catch (e) { /* 無音でも進行可能 */ }
  };
  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  function now() { return A.ctx.currentTime; }

  function noiseBuffer(sec) {
    const len = Math.floor(A.ctx.sampleRate * sec);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- 描画音：ノイズループ、速度でゲイン/フィルタが動く ----
  let drawGain = null, drawFilter = null;
  function makeDrawLoop() {
    const src = A.ctx.createBufferSource();
    src.buffer = noiseBuffer(1.2);
    src.loop = true;
    drawFilter = A.ctx.createBiquadFilter();
    drawFilter.type = 'bandpass';
    drawFilter.frequency.value = 900;
    drawFilter.Q.value = 0.8;
    drawGain = A.ctx.createGain();
    drawGain.gain.value = 0;
    src.connect(drawFilter).connect(drawGain).connect(A.master);
    src.start();
  }
  A.drawMove = function (speed) { // speed: px/ms 程度
    if (!A.ready) return;
    const v = Math.min(1, speed * 0.9);
    drawGain.gain.setTargetAtTime(0.05 + v * 0.16, now(), 0.03);
    drawFilter.frequency.setTargetAtTime(500 + v * 2600, now(), 0.04);
  };
  A.drawStop = function () {
    if (!A.ready) return;
    drawGain.gain.setTargetAtTime(0, now(), 0.06);
  };

  function tone(freq, t0, dur, { type = 'sine', vol = 0.2, glideTo = 0, attack = 0.01 } = {}) {
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(A.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ---- 点を置く「ぽん！」 ----
  A.pon = function () {
    if (!A.ready) return;
    const t0 = now();
    tone(640, t0, 0.16, { type: 'triangle', vol: 0.42, glideTo: 300 });
    tone(1280, t0, 0.09, { type: 'sine', vol: 0.18, glideTo: 700 });
    // クリック感
    const src = A.ctx.createBufferSource();
    src.buffer = noiseBuffer(0.05);
    const f = A.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    src.connect(f).connect(g).connect(A.master);
    src.start(t0);
  };

  // ---- タップ（UI） ----
  A.tap = function () {
    if (!A.ready) return;
    tone(880, now(), 0.1, { type: 'sine', vol: 0.16, glideTo: 1100 });
  };
  A.select = function (i) {
    if (!A.ready) return;
    tone(PENTA[i % PENTA.length], now(), 0.18, { type: 'triangle', vol: 0.22 });
  };

  // ---- 育つ音：上昇アルペジオ＋シマー ----
  A.grow = function (dur) {
    if (!A.ready) return;
    const t0 = now();
    const seq = [0, 1, 2, 4, 5, 7];
    seq.forEach((s, i) => {
      const tt = t0 + (i / seq.length) * dur * 0.85;
      tone(PENTA[s], tt, 0.35, { type: 'sine', vol: 0.13 });
      tone(PENTA[s] * 2, tt + 0.02, 0.3, { type: 'sine', vol: 0.05 });
    });
    // 柔らかい上昇ノイズ
    const src = A.ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(400, t0);
    f.frequency.exponentialRampToValueAtTime(3200, t0 + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0, t0);
    g.gain.linearRampToValueAtTime(0.08, t0 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(A.master);
    src.start(t0);
  };

  // ---- ヒーロー要素が開く（花・イチゴなど） ----
  A.bloom = function () {
    if (!A.ready) return;
    const t0 = now();
    [0, 2, 4, 7].forEach((s, i) => tone(PENTA[s], t0 + i * 0.03, 0.7, { type: 'sine', vol: 0.14 }));
    tone(PENTA[7] * 2, t0 + 0.1, 0.6, { type: 'sine', vol: 0.06 });
  };

  // ---- キラキラ ----
  A.sparkle = function () {
    if (!A.ready) return;
    const t0 = now();
    const f = PENTA[4 + Math.floor(Math.random() * 4)];
    tone(f * 2, t0, 0.22, { type: 'sine', vol: 0.07 });
  };

  // ---- 住民の歓声（小さな「わーい」風グライド） ----
  A.cheer = function () {
    if (!A.ready) return;
    const t0 = now();
    tone(500, t0, 0.18, { type: 'triangle', vol: 0.15, glideTo: 900 });
    tone(600, t0 + 0.16, 0.2, { type: 'triangle', vol: 0.15, glideTo: 1050 });
    tone(1200, t0 + 0.34, 0.25, { type: 'sine', vol: 0.08, glideTo: 1500 });
  };

  A.munch = function () {
    if (!A.ready) return;
    const t0 = now();
    for (let i = 0; i < 2; i++) {
      const src = A.ctx.createBufferSource();
      src.buffer = noiseBuffer(0.07);
      const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700 + i * 150; f.Q.value = 2;
      const g = A.ctx.createGain();
      const tt = t0 + i * 0.18;
      g.gain.setValueAtTime(0.22, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + 0.07);
      src.connect(f).connect(g).connect(A.master);
      src.start(tt);
    }
  };

  A.door = function () {
    if (!A.ready) return;
    tone(320, now(), 0.16, { type: 'triangle', vol: 0.14, glideTo: 420 });
  };

  A.chirp = function () {
    if (!A.ready) return;
    const t0 = now();
    tone(2200, t0, 0.08, { type: 'sine', vol: 0.05, glideTo: 2900 });
    tone(2500, t0 + 0.12, 0.07, { type: 'sine', vol: 0.04, glideTo: 2100 });
  };

  // ---- 町のアンビエント：ゆっくりしたパッド ----
  let ambientTimer = null;
  function startAmbient() {
    const chords = [[0, 2, 4], [1, 3, 5], [2, 4, 6], [0, 3, 5]];
    let ci = 0;
    function playChord() {
      const t0 = now();
      const ch = chords[ci % chords.length]; ci++;
      ch.forEach(s => {
        const o = A.ctx.createOscillator();
        const g = A.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = PENTA[s] / 4;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.028, t0 + 2.2);
        g.gain.linearRampToValueAtTime(0.0, t0 + 6.2);
        o.connect(g).connect(A.master);
        o.start(t0); o.stop(t0 + 6.5);
      });
    }
    playChord();
    ambientTimer = setInterval(() => {
      if (A.ctx.state === 'running') {
        playChord();
        if (Math.random() < 0.4) setTimeout(() => A.chirp(), 1500 + Math.random() * 2500);
      }
    }, 6000);
  }

  A.haptic = function (ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  };

  NT.audio = A;
})();
