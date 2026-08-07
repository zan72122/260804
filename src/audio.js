/* WebAudio による手続き的サウンド（音声ファイル不要） */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});

  function Audio() {
    this.ready = false;
    this.ctx = null;
    this.enabled = true;
  }

  Audio.prototype.start = function () {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    var ctx = this.ctx = new AC();
    this.ready = true;

    var master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.master = master;

    // --- ノイズ源（共有） ---
    var len = ctx.sampleRate * 3;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    this.noiseBuf = buf;

    var wbuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var wd = wbuf.getChannelData(0);
    for (var j = 0; j < len; j++) wd[j] = Math.random() * 2 - 1;
    this.whiteBuf = wbuf;

    /* ---- 環境音（海と風） ---- */
    var amb = ctx.createBufferSource();
    amb.buffer = buf; amb.loop = true;
    var ambF = ctx.createBiquadFilter();
    ambF.type = 'lowpass'; ambF.frequency.value = 420; ambF.Q.value = 0.4;
    var ambG = ctx.createGain(); ambG.gain.value = 0.10;
    amb.connect(ambF); ambF.connect(ambG); ambG.connect(master);
    amb.start();
    this.ambGain = ambG;

    /* ---- ポンプ（低い唸り + 機械音） ---- */
    var pumpG = ctx.createGain(); pumpG.gain.value = 0.0;
    pumpG.connect(master);
    this.pumpGain = pumpG;

    var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 41;
    var o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 61.5;
    var o3 = ctx.createOscillator(); o3.type = 'square'; o3.frequency.value = 123;
    var pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 260; pf.Q.value = 3.5;
    var pg1 = ctx.createGain(); pg1.gain.value = 0.30;
    var pg2 = ctx.createGain(); pg2.gain.value = 0.20;
    var pg3 = ctx.createGain(); pg3.gain.value = 0.06;
    o1.connect(pg1); o2.connect(pg2); o3.connect(pg3);
    pg1.connect(pf); pg2.connect(pf); pg3.connect(pf);
    pf.connect(pumpG);
    o1.start(); o2.start(); o3.start();
    this.pumpOsc = [o1, o2, o3];
    this.pumpFilter = pf;

    // ポンプの脈動
    var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 2.6;
    var lfoG = ctx.createGain(); lfoG.gain.value = 42;
    lfo.connect(lfoG); lfoG.connect(pf.frequency);
    lfo.start();
    this.pumpLfo = lfo;

    /* ---- 排水の流れ ---- */
    var flow = ctx.createBufferSource(); flow.buffer = wbuf; flow.loop = true;
    var ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.8;
    var ff2 = ctx.createBiquadFilter(); ff2.type = 'highpass'; ff2.frequency.value = 300;
    var fg = ctx.createGain(); fg.gain.value = 0.0;
    flow.connect(ff); ff.connect(ff2); ff2.connect(fg); fg.connect(master);
    flow.start();
    this.flowGain = fg; this.flowFilter = ff;

    /* ---- プロペラの風切り ---- */
    var pw = ctx.createBufferSource(); pw.buffer = wbuf; pw.loop = true;
    var pwf = ctx.createBiquadFilter(); pwf.type = 'bandpass'; pwf.frequency.value = 300; pwf.Q.value = 2.2;
    var pwg = ctx.createGain(); pwg.gain.value = 0.0;
    pw.connect(pwf); pwf.connect(pwg); pwg.connect(master);
    pw.start();
    this.propGain = pwg; this.propFilter = pwf;

    /* ---- 洗浄の噴射 ---- */
    var ws = ctx.createBufferSource(); ws.buffer = wbuf; ws.loop = true;
    var wsf = ctx.createBiquadFilter(); wsf.type = 'bandpass'; wsf.frequency.value = 2600; wsf.Q.value = 0.7;
    var wsg = ctx.createGain(); wsg.gain.value = 0.0;
    ws.connect(wsf); wsf.connect(wsg); wsg.connect(master);
    ws.start();
    this.washGain = wsg;

    this.gullTimer = 4 + Math.random() * 6;
  };

  Audio.prototype.setPump = function (v) {
    if (!this.ready) return;
    var t = this.ctx.currentTime;
    this.pumpGain.gain.setTargetAtTime(v * 0.30, t, 0.25);
    this.pumpFilter.frequency.setTargetAtTime(200 + v * 190, t, 0.3);
    this.pumpLfo.frequency.setTargetAtTime(2.0 + v * 2.6, t, 0.3);
  };
  Audio.prototype.setFlow = function (v, pitch) {
    if (!this.ready) return;
    var t = this.ctx.currentTime;
    this.flowGain.gain.setTargetAtTime(v * 0.11, t, 0.2);
    this.flowFilter.frequency.setTargetAtTime(500 + (pitch || 0) * 1400, t, 0.3);
  };
  Audio.prototype.setProp = function (speed) {
    if (!this.ready) return;
    var t = this.ctx.currentTime;
    var s = Math.min(1, Math.abs(speed) / 4.5);
    this.propGain.gain.setTargetAtTime(s * 0.13, t, 0.08);
    this.propFilter.frequency.setTargetAtTime(140 + s * 620, t, 0.08);
  };
  Audio.prototype.setWash = function (v) {
    if (!this.ready) return;
    this.washGain.gain.setTargetAtTime(v * 0.075, this.ctx.currentTime, 0.06);
  };

  Audio.prototype._burst = function (o) {
    if (!this.ready) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var s = ctx.createBufferSource();
    s.buffer = o.white ? this.whiteBuf : this.noiseBuf;
    s.playbackRate.value = o.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq || 800;
    f.Q.value = o.q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur);
    s.start(t); s.stop(t + o.dur + 0.05);
  };

  Audio.prototype._tone = function (freq, dur, gain, type, sweep) {
    if (!this.ready) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  };

  Audio.prototype.splash = function (strength) {
    this._burst({ white: true, type: 'bandpass', freq: 1500, q: 0.6, gain: 0.20 * strength, dur: 0.75, sweep: 400 });
    this._tone(180, 0.22, 0.05 * strength, 'sine', 90);
  };
  Audio.prototype.thud = function (strength) {
    this._tone(52, 1.5, 0.42 * strength, 'sine', 27);
    this._tone(78, 0.9, 0.18 * strength, 'triangle', 40);
    this._burst({ type: 'lowpass', freq: 220, q: 1.2, gain: 0.22 * strength, dur: 1.1 });
  };
  Audio.prototype.gate = function () {
    this._burst({ type: 'lowpass', freq: 300, q: 1.0, gain: 0.20, dur: 3.2, attack: 0.6 });
    this._tone(46, 3.0, 0.16, 'sawtooth', 38);
  };
  Audio.prototype.clank = function () {
    this._burst({ white: true, type: 'bandpass', freq: 2200, q: 3.0, gain: 0.16, dur: 0.35, sweep: 900 });
    this._tone(320, 0.4, 0.09, 'triangle', 180);
  };
  Audio.prototype.horn = function () {
    if (!this.ready) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.25);
    g.gain.setValueAtTime(0.24, t + 2.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    g.connect(f); f.connect(this.master);
    [110, 138.6, 165, 220.5].forEach(function (fr, i) {
      var o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.004);
      var og = ctx.createGain(); og.gain.value = [0.5, 0.36, 0.2, 0.1][i];
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + 3.2);
    });
  };
  Audio.prototype.gull = function () {
    if (!this.ready) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var n = 2 + ((Math.random() * 3) | 0);
    for (var i = 0; i < n; i++) {
      var o = ctx.createOscillator();
      o.type = 'triangle';
      var st = t + i * 0.19;
      var f0 = 900 + Math.random() * 500;
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.7, st + 0.06);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.8, st + 0.16);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.035, st + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.17);
      o.connect(g); g.connect(this.master);
      o.start(st); o.stop(st + 0.2);
    }
  };
  Audio.prototype.chime = function (up) {
    var base = up ? 523.25 : 392.0;
    this._tone(base, 0.5, 0.07, 'sine');
    this._tone(base * 1.5, 0.6, 0.05, 'sine');
    var self = this;
    setTimeout(function () { self._tone(base * 2, 0.5, 0.04, 'sine'); }, 110);
  };
  Audio.prototype.tick = function (v) {
    this._tone(560 + v * 300, 0.05, 0.03, 'square');
  };

  Audio.prototype.update = function (dt) {
    if (!this.ready) return;
    this.gullTimer -= dt;
    if (this.gullTimer <= 0) {
      this.gullTimer = 7 + Math.random() * 14;
      this.gull();
    }
  };

  DD.Audio = Audio;
})(typeof window !== 'undefined' ? window : this);
