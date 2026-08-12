'use strict';
/* ============================================================
 * audio.js — WebAudioで生成する短い効果音。
 * 音が出なくても遊べる(全APIはfail-safe)。
 * ============================================================ */
const SFX = (() => {
  let ac = null;
  let master = null;
  let drawNode = null;   // 描画中の「しゅるしゅる」
  let drawGain = null;
  let drawTarget = 0;

  function ensure() {
    if (ac) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    } catch (e) { ac = null; return false; }
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    if (ac.state === 'suspended') { ac.resume().catch(() => {}); }
  }

  function noiseBuffer(dur) {
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function env(gainNode, t0, a, peak, dur) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function tone(type, f0, f1, dur, peak, delay) {
    if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.85);
    const g = ac.createGain();
    env(g, t0, 0.008, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(filterType, freq, q, dur, peak, delay) {
    if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const f = ac.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    env(g, t0, 0.006, peak, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.1);
  }

  /* ----- 個別SE ----- */

  // 線を描いている間の「しゅるしゅる」。speed 0..1
  function drawLoopSet(speed) {
    if (!ac) return;
    if (!drawNode) {
      drawNode = ac.createBufferSource();
      drawNode.buffer = noiseBuffer(1.2);
      drawNode.loop = true;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = 0.8;
      drawGain = ac.createGain();
      drawGain.gain.value = 0;
      drawNode.connect(f); f.connect(drawGain); drawGain.connect(master);
      drawNode.start();
    }
    drawTarget = U.clamp(speed, 0, 1) * 0.10;
  }
  function drawLoopStop() { drawTarget = 0; }
  function tick(dt) {
    if (drawGain) {
      const g = drawGain.gain.value;
      drawGain.gain.value = g + (drawTarget - g) * Math.min(1, dt * 18);
    }
  }

  // クリームがふくらむ「もこもこ…」
  function grow() {
    if (!ac) return;
    noise('lowpass', 500, 0.7, 0.5, 0.10);
    tone('sine', 150, 320, 0.5, 0.06);
  }
  // クリーム完成「ぽふっ」
  function pofu() {
    if (!ac) return;
    noise('lowpass', 420, 0.8, 0.14, 0.22);
    tone('sine', 190, 90, 0.16, 0.20);
  }
  // トッピング「ぽんっ」
  function pon() {
    if (!ac) return;
    tone('sine', 480, 950, 0.10, 0.26);
    noise('highpass', 2500, 0.6, 0.05, 0.10);
  }
  // キラキラ(小さなベル)
  function bell(delay) {
    if (!ac) return;
    const d = delay || 0;
    tone('triangle', 1568, 1568, 0.30, 0.10, d);
    tone('triangle', 2093, 2093, 0.34, 0.08, d + 0.07);
    tone('triangle', 2637, 2637, 0.40, 0.06, d + 0.14);
  }
  // 住民のよろこび(短い歓声風アルペジオ)
  function cheer() {
    if (!ac) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone('triangle', f, f * 1.01, 0.18, 0.12, i * 0.07));
    noise('bandpass', 1500, 0.5, 0.25, 0.05, 0.05);
  }
  // ボタン「こつん」
  function tap() {
    if (!ac) return;
    tone('sine', 620, 520, 0.07, 0.12);
  }
  // むしゃむしゃ
  function munch(delay) {
    if (!ac) return;
    noise('lowpass', 700, 1.2, 0.09, 0.14, delay || 0);
  }

  return { unlock, drawLoopSet, drawLoopStop, tick, grow, pofu, pon, bell, cheer, tap, munch };
})();
