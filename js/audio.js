'use strict';
(function (PPG) {
  // All sounds are synthesized with WebAudio: no assets, instant load,
  // and every sound is a direct answer to something the child did.
  class Sound {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.drawSrc = null;
      this.drawGain = null;
      this.drawBp = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 1.2);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch (e) { this.ctx = null; }
    }

    // ---- crayon "しゃらしゃら" while drawing ----
    startDraw() {
      if (!this.ctx) return;
      this.stopDraw(true);
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2800;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.master);
      src.start();
      this.drawSrc = src; this.drawGain = g; this.drawBp = bp;
    }
    setDrawLevel(speed) { // speed in px/sec
      if (!this.drawGain) return;
      const t = this.ctx.currentTime;
      const target = Math.min(0.14, speed * 0.00028);
      this.drawGain.gain.setTargetAtTime(target, t, 0.045);
      this.drawBp.frequency.setTargetAtTime(850 + Math.min(1400, speed * 1.3), t, 0.08);
    }
    stopDraw(hard) {
      if (!this.drawSrc) return;
      const src = this.drawSrc, g = this.drawGain;
      this.drawSrc = null; this.drawGain = null; this.drawBp = null;
      try {
        if (hard) { src.stop(); }
        else {
          g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
          setTimeout(() => { try { src.stop(); } catch (e) { } }, 260);
        }
      } catch (e) { }
    }

    // ---- generic short blip ----
    blip(freq, dur, vol, type, drop) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * (drop == null ? 0.6 : drop)), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.03);
    }

    bell(freq, dur, vol) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      [1, 2.76].forEach((mul, i) => {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * mul;
        const g = c.createGain();
        const v = vol * (i === 0 ? 1 : 0.24);
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.05);
      });
    }

    // ---- named game sounds ----
    pon(size) { // size 0..1 : bigger press → rounder deeper "ぽんっ"
      const f = 540 - 200 * size;
      this.blip(f, 0.16, 0.42, 'triangle', 0.5);
      this.blip(f * 0.5, 0.13, 0.22, 'sine', 0.55);
    }
    leafPop(i) { this.blip(420 + (i % 5) * 45, 0.07, 0.15, 'sine', 0.85); }
    petalPop(i) { this.blip(640 + (i % 8) * 55, 0.06, 0.17, 'sine', 0.88); }
    budSwell() { this.blip(300, 0.22, 0.14, 'sine', 1.5); }
    chime() {
      const notes = [1318, 1568, 1975, 2349, 2793];
      notes.forEach((f, i) => setTimeout(() => this.bell(f, 0.9, 0.10), i * 75));
    }
    tick() { this.bell(1760, 0.5, 0.05); }
    select() { this.blip(880, 0.09, 0.16, 'triangle', 1.25); }
    poof() { this.blip(320, 0.25, 0.2, 'sine', 0.4); this.flutter(0.12); }
    flutter(vol) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 340; bp.Q.value = 1.2;
      const g = c.createGain();
      const v = vol == null ? 0.05 : vol;
      g.gain.setValueAtTime(0, t);
      // amplitude flutter ~ wingbeats
      for (let i = 0; i < 7; i++) {
        g.gain.linearRampToValueAtTime(v, t + i * 0.055 + 0.02);
        g.gain.linearRampToValueAtTime(v * 0.15, t + i * 0.055 + 0.05);
      }
      g.gain.linearRampToValueAtTime(0, t + 0.45);
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + 0.5);
    }
    rainbowAppear() {
      const notes = [784, 988, 1175, 1568, 1975, 2349];
      notes.forEach((f, i) => setTimeout(() => this.bell(f, 1.1, 0.09), i * 90));
    }
  }
  PPG.sound = new Sound();
})(window.PPG);
