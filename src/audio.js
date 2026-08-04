// All sound is synthesized (no assets). Created lazily on first user gesture.
let AC = null, master = null, noiseBuf = null;
let waterGain = null, suckGain = null, suckBp = null;
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function unlock() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
  const len = (AC.sampleRate * 2) | 0;
  noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // gentle water ambience loop
  const wn = AC.createBufferSource(); wn.buffer = noiseBuf; wn.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.5;
  waterGain = AC.createGain(); waterGain.gain.value = 0;
  wn.connect(lp); lp.connect(waterGain); waterGain.connect(master); wn.start();
  // suction loop
  const sn = AC.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 1.1;
  suckBp = bp;
  suckGain = AC.createGain(); suckGain.gain.value = 0;
  sn.connect(bp); bp.connect(suckGain); suckGain.connect(master); sn.start();
}

export function setWater(v) { if (waterGain) waterGain.gain.setTargetAtTime(v * 0.10, AC.currentTime, 0.25); }
// gain follows suction strength; pitch climbs as the water thins so the
// ear tracks the water level too
export function setSuck(v, level = 1) {
  if (!suckGain) return;
  suckGain.gain.setTargetAtTime(v * 0.18, AC.currentTime, 0.12);
  if (suckBp) suckBp.frequency.setTargetAtTime(200 + (1 - c01(level)) * 430, AC.currentTime, 0.15);
}

function tone(f, dur, delay = 0, type = 'sine', g = 0.16, glide = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(g, t + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function whoosh(dur = 0.5, f0 = 800, f1 = 200, g = 0.18, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const gn = AC.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(g, t + 0.06);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp); bp.connect(gn); gn.connect(master);
  s.start(t); s.stop(t + dur + 0.1);
}

export const sfx = {
  tap() { tone(440, 0.09, 0, 'sine', 0.07); },
  chime() { tone(523, 0.5, 0, 'sine', 0.11); tone(659, 0.6, 0.09, 'sine', 0.10); tone(784, 0.9, 0.18, 'sine', 0.09); },
  big() { tone(523, 0.6, 0, 'sine', 0.11); tone(659, 0.7, 0.12, 'sine', 0.11); tone(784, 0.8, 0.24, 'sine', 0.11); tone(1046, 1.2, 0.36, 'sine', 0.09); },
  pop() { tone(880, 0.16, 0, 'sine', 0.13, 640); },
  pita() { tone(740, 0.28, 0, 'triangle', 0.10); tone(1108, 0.45, 0.09, 'sine', 0.07); },
  pour() { whoosh(0.7, 1300, 320, 0.15); },
  splash() { whoosh(0.35, 900, 480, 0.12); },
  flip() { whoosh(0.45, 500, 1500, 0.10); },
  press() { whoosh(0.9, 300, 80, 0.16); },
  wob() { tone(230, 0.25, 0, 'sine', 0.06, 180); },
  // tiny deposition grain — pitch rises with fill so filling is audible
  grain(fill) { tone(380 + c01(fill) * 520, 0.07, 0, 'sine', 0.045); },
  // the last film of water slipping through the sheet
  sip() { whoosh(0.55, 700, 120, 0.15); },
};
