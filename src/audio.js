// WebAudioによる合成サウンド（外部アセットなし）
// 最初のタップで unlock() を呼ぶこと（iOSの自動再生制限対応）
let ctx = null;
let master = null;
let bgmGain = null;
let bgmTimer = null;
let pourNode = null;
let stirNode = null;
let torchNode = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlock() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
}

function noiseBuffer(c, sec = 1) {
  const buf = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq, { type = 'sine', dur = 0.4, gain = 0.2, attack = 0.005, glideTo = null, delay = 0 } = {}) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// --- 効果音 ---
export const sfx = {
  tap() { tone(880, { type: 'triangle', dur: 0.12, gain: 0.15 }); },
  pop(pitch = 1) {
    tone(300 * pitch, { type: 'sine', dur: 0.18, gain: 0.25, glideTo: 700 * pitch });
  },
  plop() { tone(220, { type: 'sine', dur: 0.25, gain: 0.3, glideTo: 90 }); },
  puff() {
    const c = ac();
    const s = c.createBufferSource(); s.buffer = noiseBuffer(c, 0.4);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain();
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    s.connect(f).connect(g).connect(master); s.start();
  },
  ding() {
    tone(1318.5, { dur: 1.2, gain: 0.2 });
    tone(1975.5, { dur: 1.0, gain: 0.08, delay: 0.01 });
  },
  chime(step = 0) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    tone(notes[step % notes.length], { type: 'sine', dur: 0.5, gain: 0.18 });
  },
  sparkle() {
    [1567, 1975, 2637].forEach((f, i) => tone(f, { dur: 0.4, gain: 0.08, delay: i * 0.07 }));
  },
  whoosh() {
    const c = ac();
    const s = c.createBufferSource(); s.buffer = noiseBuffer(c, 0.6);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    const t0 = c.currentTime;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(2000, t0 + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    s.connect(f).connect(g).connect(master); s.start();
  },
  meltRumble() {
    tone(90, { type: 'sine', dur: 1.6, gain: 0.22, glideTo: 45 });
    tone(140, { type: 'triangle', dur: 1.2, gain: 0.1, glideTo: 70, delay: 0.1 });
  },
  fanfare() {
    // オルゴール風ファンファーレ
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1567.98];
    seq.forEach((f, i) => {
      tone(f, { type: 'sine', dur: 0.7, gain: 0.16, delay: i * 0.16 });
      tone(f * 2, { type: 'sine', dur: 0.5, gain: 0.05, delay: i * 0.16 });
    });
  },
  // シャッという切り音（ナイフ）
  knifeCut() {
    const c = ac();
    const s = c.createBufferSource(); s.buffer = noiseBuffer(c, 0.25);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain();
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    s.connect(f).connect(g).connect(master); s.start();
    tone(1800, { type: 'triangle', dur: 0.08, gain: 0.12, delay: 0.01 });
  },
  // キラキラ下降アルペジオ（冷気/フリーズ）
  freeze() {
    const notes = [2093, 1760, 1568, 1319, 1047];
    notes.forEach((f, i) => tone(f, { type: 'sine', dur: 0.35, gain: 0.12, delay: i * 0.06 }));
  },
  // するり + ポン（型抜き）
  unmold() {
    tone(480, { type: 'sine', dur: 0.32, gain: 0.14, glideTo: 860 });
    tone(260, { type: 'sine', dur: 0.16, gain: 0.22, glideTo: 620, delay: 0.3 });
  },
  // ぽとん（アイスをすくって乗せる）
  scoop() { tone(240, { type: 'sine', dur: 0.22, gain: 0.28, glideTo: 100 }); },
  // 飴ガラスが割れる音: stage 1..3（高くなるほど派手に）
  crack(stage = 1) {
    const n = Math.max(1, Math.min(3, stage));
    tone(1800 + n * 300, { type: 'square', dur: 0.08, gain: 0.08 + n * 0.03 });
    tone(3200 + n * 400, { type: 'triangle', dur: 0.06, gain: 0.05 + n * 0.02, delay: 0.02 });
    if (n >= 3) {
      const c = ac();
      const s = c.createBufferSource(); s.buffer = noiseBuffer(c, 0.5);
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
      const g = c.createGain();
      const t0 = c.currentTime;
      g.gain.setValueAtTime(0.35, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      s.connect(f).connect(g).connect(master); s.start();
    }
  },
};

// バーナーのゴォー音（ループ）: strength 0..1
export function setTorchSound(strength) {
  const c = ac();
  if (strength > 0 && !torchNode) {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, 2); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(master); s.start();
    torchNode = { s, g, f };
  }
  if (torchNode) {
    torchNode.g.gain.setTargetAtTime(strength * 0.16, c.currentTime, 0.08);
    torchNode.f.frequency.setTargetAtTime(500 + strength * 500, c.currentTime, 0.1);
    if (strength <= 0) {
      const n = torchNode; torchNode = null;
      setTimeout(() => { try { n.s.stop(); } catch (e) {} }, 400);
    }
  }
}

// 注ぐ音（ループ）: strength 0..1
export function setPourSound(strength) {
  const c = ac();
  if (strength > 0 && !pourNode) {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, 2); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(master); s.start();
    pourNode = { s, g, f };
  }
  if (pourNode) {
    pourNode.g.gain.setTargetAtTime(strength * 0.18, c.currentTime, 0.08);
    if (strength <= 0) {
      const n = pourNode; pourNode = null;
      setTimeout(() => { try { n.s.stop(); } catch (e) {} }, 400);
    }
  }
}

// かき混ぜ音（ループ）: speed 0..1
export function setStirSound(speed) {
  const c = ac();
  if (speed > 0 && !stirNode) {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, 2); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(master); s.start();
    stirNode = { s, g, f };
  }
  if (stirNode) {
    stirNode.g.gain.setTargetAtTime(speed * 0.15, c.currentTime, 0.1);
    stirNode.f.frequency.setTargetAtTime(400 + speed * 900, c.currentTime, 0.1);
    if (speed <= 0) {
      const n = stirNode; stirNode = null;
      setTimeout(() => { try { n.s.stop(); } catch (e) {} }, 500);
    }
  }
}

// やさしいオルゴールBGM
const MELODY = [0, 4, 7, 12, 7, 4, 9, 7, 5, 9, 12, 16, 12, 9, 7, 4];
export function startBGM() {
  if (bgmTimer) return;
  const c = ac();
  bgmGain = c.createGain();
  bgmGain.gain.value = 0.5;
  bgmGain.connect(master);
  let i = 0;
  const base = 523.25;
  bgmTimer = setInterval(() => {
    if (c.state !== 'running') return;
    const n = MELODY[i % MELODY.length];
    const f = base * Math.pow(2, n / 12);
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.045, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o.connect(g).connect(bgmGain);
    o.start(t0); o.stop(t0 + 1.2);
    i++;
  }, 560);
}
