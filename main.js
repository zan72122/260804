// よまつりの じゅんび — 4歳向け 夜祭り準備 3D ゲーム
// Three.js WebGL / 一指ジェスチャー操作 / 縦横対応 / 全音声は WebAudio 合成
import * as THREE from 'three';

/* ============================================================ utils */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeBack = t => { const c = 1.70158 + 1; return 1 + c * Math.pow(t - 1, 3) + (c - 1) * Math.pow(t - 1, 2); };
const D2R = Math.PI / 180;
const minDim = () => Math.min(window.innerWidth, window.innerHeight);

let nowSec = 0;
const tweens = [];
function tween(dur, fn, { ease = easeInOut, delay = 0, done = null } = {}) {
  tweens.push({ t0: nowSec + delay, dur, fn, ease, done });
}
function updateTweens() {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (nowSec < tw.t0) continue;
    const k = clamp((nowSec - tw.t0) / tw.dur, 0, 1);
    tw.fn(tw.ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
}
function delay(sec, fn) { tween(0.001, () => {}, { delay: sec, done: fn }); }

/* ============================================================ audio */
class Sfx {
  constructor() { this.ctx = null; this.muted = false; this._lastScribble = 0; this._lastRub = 0; this._lastCreak = 0; }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.drumBus = this.ctx.createGain(); this.drumBus.gain.value = 1;
      const dly = this.ctx.createDelay(1); dly.delayTime.value = 0.26;
      const fb = this.ctx.createGain(); fb.gain.value = 0.22;
      const wet = this.ctx.createGain(); wet.gain.value = 0.3;
      this.drumBus.connect(this.master);
      this.drumBus.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.85; }
  _osc(type, f0, t, dur, g0, { f1 = null, dest = null, pan = 0 } = {}) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(g0, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    let out = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  _noise(t, dur, g0, { type = 'lowpass', freq = 800, q = 1, dest = null } = {}) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    s.playbackRate.value = rand(0.85, 1.15);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(g0, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master);
    s.start(t); s.stop(t + dur + 0.05);
    return f;
  }
  pop(pitch = 1) { if (!this.ctx) return; const t = this.now();
    this._osc('sine', 380 * pitch, t, 0.14, 0.35, { f1: 760 * pitch }); }
  thump() { if (!this.ctx) return; const t = this.now();
    this._osc('sine', 120, t, 0.25, 0.5, { f1: 55 }); this._noise(t, 0.12, 0.2, { freq: 300 }); }
  swish() { if (!this.ctx) return; const t = this.now();
    const f = this._noise(t, 0.4, 0.3, { type: 'bandpass', freq: 900, q: 1.4 });
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.35); }
  boing() { if (!this.ctx) return; const t = this.now(); const c = this.ctx;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.3);
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.4); }
  chime(notes = [880, 1108.7, 1318.5]) { if (!this.ctx) return; const t = this.now();
    notes.forEach((f, i) => {
      this._osc('sine', f, t + i * 0.09, 0.6, 0.16);
      this._osc('sine', f * 2.76, t + i * 0.09, 0.25, 0.05);
    }); }
  /* 竹のきしみ（骨組みを伸ばすとき）: p=0..1 */
  creak(p) { if (!this.ctx) return; const t = this.now();
    if (t - this._lastCreak < 0.07) return; this._lastCreak = t;
    this._osc('sawtooth', 110 + p * 240, t, 0.07, 0.05, { f1: 90 + p * 260 });
    this._noise(t, 0.05, 0.05, { type: 'bandpass', freq: 1200 + p * 800, q: 4 }); }
  /* 紙をこする音 */
  rub() { if (!this.ctx) return; const t = this.now();
    if (t - this._lastRub < 0.12) return; this._lastRub = t;
    this._noise(t, 0.16, 0.14, { type: 'bandpass', freq: rand(900, 1500), q: 1.2 }); }
  /* クレヨンのカリカリ音: speed=0..1 */
  scribble(speed = 0.5) { if (!this.ctx) return; const t = this.now();
    if (t - this._lastScribble < 0.09) return; this._lastScribble = t;
    this._noise(t, 0.08, 0.06 + speed * 0.06, { type: 'bandpass', freq: 2200 + speed * 1400, q: 2 }); }
  /* 滑車のラチェット */
  ratchet() { if (!this.ctx) return; const t = this.now();
    this._noise(t, 0.03, 0.3, { type: 'highpass', freq: 2400 });
    this._osc('square', 420, t + 0.01, 0.05, 0.12, { f1: 240 });
    this._noise(t + 0.05, 0.03, 0.2, { type: 'highpass', freq: 2000 }); }
  /* ばちの風切り音 */
  whoosh(g = 0.3) { if (!this.ctx) return; const t = this.now();
    const f = this._noise(t, 0.2, g, { type: 'bandpass', freq: 500, q: 1 });
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.16); }
  don(t, { gain = 1, size = 1, pan = 0 } = {}) { if (!this.ctx) return;
    const f0 = 105 / size, f1 = 42 / size;
    this._osc('sine', f0, t, 0.55 * size, 0.9 * gain, { f1, dest: this.drumBus, pan });
    this._osc('sine', f0 * 1.6, t, 0.18, 0.25 * gain, { f1: f1 * 1.8, dest: this.drumBus, pan });
    this._noise(t, 0.06, 0.5 * gain, { freq: 260, dest: this.drumBus }); }
  ka(t, gain = 0.5) { if (!this.ctx) return;
    this._noise(t, 0.07, gain, { type: 'highpass', freq: 1800, dest: this.drumBus });
    this._osc('square', 900, t, 0.05, 0.06 * gain, { dest: this.drumBus }); }
  kane(t, accent = 1) { if (!this.ctx) return;
    this._osc('square', 2200, t, 0.18, 0.045 * accent);
    this._osc('square', 3130, t, 0.12, 0.03 * accent); }
  flute(t, freq, dur) { if (!this.ctx) return; const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const lfo = c.createOscillator(); lfo.frequency.value = 5.4;
    const lg = c.createGain(); lg.gain.value = freq * 0.012;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.06);
    g.gain.setValueAtTime(0.11, t + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05); }
}
const sfx = new Sfx();

/* ============================================================ canvas textures */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function canvasTex(c, { repeat = null, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
function noise(ctx, w, h, alpha, n = 900) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${(Math.random() * alpha).toFixed(3)})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, rand(1, 3), rand(1, 3));
  }
}
function woodTex(base = '#9a6b3f', dark = '#7c5330') {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(60,35,15,${rand(0.06, 0.22)})`;
    x.lineWidth = rand(1, 3.5); x.beginPath();
    const y = rand(0, 256); x.moveTo(0, y);
    for (let px = 0; px <= 256; px += 32) x.lineTo(px, y + Math.sin(px * 0.05 + i) * rand(2, 6));
    x.stroke();
  }
  x.fillStyle = dark;
  for (let i = 0; i < 7; i++) { x.globalAlpha = rand(0.08, 0.2); x.fillRect(0, rand(0, 250), 256, rand(2, 8)); }
  x.globalAlpha = 1; noise(x, 256, 256, 0.08);
  return canvasTex(c, { repeat: [1, 1] });
}
function plasterTex(tint = '#e8ddc8') {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = tint; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 0.1, 1400);
  x.fillStyle = 'rgba(120,90,60,0.12)'; x.fillRect(0, 236, 256, 20);
  return canvasTex(c);
}
function stoneTex() {
  const [c, x] = makeCanvas(256, 512);
  x.fillStyle = '#9b958c'; x.fillRect(0, 0, 256, 512);
  const rows = 8, cols = 3;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const w = 256 / cols, h = 512 / rows;
    const px = q * w + (r % 2 ? w / 2 : 0), py = r * h;
    x.fillStyle = `hsl(${rand(30, 45)},${rand(6, 14)}%,${rand(52, 64)}%)`;
    x.fillRect((px % 256) + 2, py + 2, w - 4, h - 4);
    if (px + w > 256) x.fillRect(px - 256 + 2, py + 2, w - 4, h - 4);
  }
  noise(x, 256, 512, 0.12, 2200);
  x.fillStyle = 'rgba(70,60,45,0.18)';
  for (let i = 0; i < 40; i++) { const s = rand(6, 30); x.fillRect(rand(0, 256), rand(0, 512), s, s * 0.4); }
  return canvasTex(c, { repeat: [2, 14] });
}
function dirtTex() {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#8d7a55'; x.fillRect(0, 0, 256, 256);
  noise(x, 256, 256, 0.14, 2600);
  x.fillStyle = 'rgba(90,120,50,0.25)';
  for (let i = 0; i < 60; i++) x.fillRect(rand(0, 256), rand(0, 256), rand(2, 9), rand(2, 6));
  return canvasTex(c, { repeat: [24, 24] });
}
function stripeTex(c1 = '#e33b3b', c2 = '#fff7ec') {
  const [c, x] = makeCanvas(256, 128);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * 32, 0, 32, 128); }
  x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, 110, 256, 18);
  noise(x, 256, 128, 0.05);
  return canvasTex(c);
}
/* ---- 提灯の絵柄 ---- */
function drawHana(x, cx, cy, s) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = '#ff7fa8';
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 - Math.PI / 2;
    x.beginPath(); x.ellipse(Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.52, s * 0.4, s * 0.3, a, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#e6486f';
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 - Math.PI / 2;
    x.beginPath(); x.ellipse(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.26, s * 0.18, a, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#ffd83a'; x.beginPath(); x.arc(0, 0, s * 0.26, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f5a91e';
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.arc(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14, s * 0.045, 0, Math.PI * 2); x.fill(); }
  x.restore();
}
function drawSakana(x, cx, cy, s) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = '#3f8fd8';
  x.beginPath(); x.ellipse(0, 0, s * 0.75, s * 0.48, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(s * 0.6, 0); x.lineTo(s * 1.15, -s * 0.42); x.lineTo(s * 1.15, s * 0.42); x.closePath(); x.fill();
  x.fillStyle = '#78b8ea';
  x.beginPath(); x.ellipse(0, s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI); x.fill();
  x.strokeStyle = '#2c6eae'; x.lineWidth = s * 0.06;
  for (let i = -1; i <= 1; i++) { x.beginPath(); x.arc(i * s * 0.26, -s * 0.02, s * 0.16, 0.3, Math.PI - 0.3); x.stroke(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(-s * 0.42, -s * 0.12, s * 0.15, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.arc(-s * 0.44, -s * 0.12, s * 0.08, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3f8fd8';
  x.beginPath(); x.ellipse(-s * 0.05, -s * 0.5, s * 0.22, s * 0.14, -0.5, 0, Math.PI * 2); x.fill();
  x.restore();
}
function drawHoshi(x, cx, cy, s) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = '#ffc927'; x.strokeStyle = '#f09a12'; x.lineWidth = s * 0.08;
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.42 : s * 0.95;
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(-s * 0.18, -s * 0.1, s * 0.09, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffe89a';
  x.beginPath(); x.arc(s * 0.7, -s * 0.75, s * 0.1, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(-s * 0.85, s * 0.55, s * 0.08, 0, Math.PI * 2); x.fill();
  x.restore();
}
const MOTIFS = { hana: drawHana, sakana: drawSakana, hoshi: drawHoshi };
function lanternCanvas(design) {
  const [c, x] = makeCanvas(512, 512);
  x.fillStyle = '#fdf3df'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 51.2) {
    const g = x.createLinearGradient(0, i, 0, i + 51.2);
    g.addColorStop(0, 'rgba(150,110,60,0.16)'); g.addColorStop(0.35, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,110,60,0.16)');
    x.fillStyle = g; x.fillRect(0, i, 512, 51.2);
  }
  noise(x, 512, 512, 0.04, 700);
  x.fillStyle = '#d43a2f'; x.fillRect(0, 0, 512, 46); x.fillRect(0, 466, 512, 46);
  x.fillStyle = '#a82418'; x.fillRect(0, 44, 512, 7); x.fillRect(0, 461, 512, 7);
  if (design) { MOTIFS[design](x, 128, 250, 78); MOTIFS[design](x, 384, 250, 78); }
  return c;
}
function projCanvasFrom(drawFn) {
  const [c, x] = makeCanvas(256, 256);
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 126);
  g.addColorStop(0, 'rgba(255,190,90,0.85)'); g.addColorStop(0.72, 'rgba(255,150,50,0.35)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.globalAlpha = 0.9;
  if (drawFn) drawFn(x);
  x.globalAlpha = 1;
  return c;
}
function glowCanvas(color = '255,190,100') {
  const [c, x] = makeCanvas(128, 128);
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, `rgba(${color},0.95)`); g.addColorStop(0.4, `rgba(${color},0.4)`); g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
}

/* ============================================================ renderer / scene */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcfe8fa, 0.0075);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

const camState = { pos: new THREE.Vector3(0.55, 1.5, 2.1), look: new THREE.Vector3(0, 1.2, -0.4), hfov: 58, yaw: 0, pitch: 0 };
function applyCamera() {
  const aspect = camera.aspect;
  const h = camState.hfov * D2R;
  let v = 2 * Math.atan(Math.tan(h / 2) / Math.max(aspect, 0.55));
  camera.fov = clamp(v / D2R, 34, 98);
  const dir = camState.pos.clone().sub(camState.look).normalize();
  const pull = aspect < 1 ? (1 - aspect) * 1.6 : 0;
  camera.position.copy(camState.pos).addScaledVector(dir, pull);
  const look = camState.look.clone();
  if (camState.yaw || camState.pitch) {
    const d = look.clone().sub(camera.position);
    const len = d.length();
    const sph = new THREE.Spherical().setFromVector3(d);
    sph.theta -= camState.yaw; sph.phi = clamp(sph.phi + camState.pitch, 0.3, Math.PI - 0.3);
    look.copy(camera.position).add(new THREE.Vector3().setFromSpherical(sph).setLength(len));
  }
  camera.lookAt(look);
  camera.updateProjectionMatrix();
}
function tweenCamera(pos, look, hfov, dur = 1.8, done = null) {
  const p0 = camState.pos.clone(), l0 = camState.look.clone(), f0 = camState.hfov;
  const p1 = new THREE.Vector3(...pos), l1 = new THREE.Vector3(...look);
  tween(dur, t => {
    camState.pos.lerpVectors(p0, p1, t);
    camState.look.lerpVectors(l0, l1, t);
    camState.hfov = lerp(f0, hfov, t);
  }, { done });
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  applyCamera();
}
window.addEventListener('resize', resize);
const _wp = new THREE.Vector3();
function toScreen(v3) {
  const sp = v3.clone().project(camera);
  return { x: (sp.x + 1) / 2 * window.innerWidth, y: (1 - sp.y) / 2 * window.innerHeight };
}
function objScreen(obj) { obj.getWorldPosition(_wp); return toScreen(_wp); }
function lanternMidScreen(lan) { lan.g.userData.inner.getWorldPosition(_wp); _wp.y += LANTERN_H / 2; return toScreen(_wp); }

/* ============================================================ lights & env */
const hemi = new THREE.HemisphereLight(0xbfe0ff, 0xe8d7b0, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3d8, 2.4);
sun.position.set(24, 38, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
function setShadowExtent(e, focusZ = 0) {
  const c = sun.shadow.camera;
  c.left = -e; c.right = e; c.top = e; c.bottom = -e; c.near = 1; c.far = 120;
  sun.target.position.set(0, 0, focusZ);
  c.updateProjectionMatrix();
}
setShadowExtent(7, -1);
scene.add(sun, sun.target);

const skyUni = {
  cTop: { value: new THREE.Color('#2f7fd4') },
  cMid: { value: new THREE.Color('#79bdf2') },
  cHor: { value: new THREE.Color('#eaf6ff') },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cHor; varying vec3 vP;
    void main(){ float h=normalize(vP).y;
      vec3 col = h>0.22 ? mix(cMid,cTop,smoothstep(0.22,0.85,h)) : mix(cHor,cMid,smoothstep(-0.04,0.22,h));
      gl_FragColor=vec4(col,1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), skyMat);
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{
  const n = 260, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), e = rand(0.12, 1.35), r = 280;
    p[i * 3] = Math.cos(a) * Math.cos(e) * r;
    p[i * 3 + 1] = Math.sin(e) * r;
    p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xfff6d8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
scene.add(new THREE.Points(starGeo, starMat));

const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowCanvas('255,235,180')), transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
sunSprite.scale.set(46, 46, 1); sunSprite.position.set(90, 120, -160);
scene.add(sunSprite);
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowCanvas('220,230,255')), transparent: true, opacity: 0, fog: false, depthWrite: false }));
moonSprite.scale.set(26, 26, 1); moonSprite.position.set(-110, 140, -180);
scene.add(moonSprite);

const ENV = [
  { top: '#2f7fd4', mid: '#79bdf2', hor: '#eaf6ff', fog: '#cfe8fa', fd: 0.0075, hemiS: '#bfe0ff', hemiG: '#e8d7b0', hemiI: 0.9, sunC: '#fff3d8', sunI: 2.4, sunP: [24, 38, 18], stars: 0, sunSp: [90, 120, -160], sunSc: 46, sunOp: 0.95, exp: 1.05 },
  { top: '#3b3f80', mid: '#e8845c', hor: '#ffcf72', fog: '#dd9668', fd: 0.009, hemiS: '#a888b8', hemiG: '#6b4a3a', hemiI: 0.5, sunC: '#ff9440', sunI: 1.1, sunP: [-30, 9, -6], stars: 0.12, sunSp: [-140, 26, -190], sunSc: 60, sunOp: 0.85, exp: 1.0 },
  { top: '#0b1035', mid: '#1b2560', hor: '#413063', fog: '#151b40', fd: 0.011, hemiS: '#25316e', hemiG: '#1b1532', hemiI: 0.34, sunC: '#9fb4ee', sunI: 0.3, sunP: [-18, 42, -28], stars: 1, sunSp: [-140, 26, -190], sunSc: 60, sunOp: 0, exp: 1.0 },
];
const envState = { t: 0 };
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpColor(target, a, b, t) { _c1.set(a); _c2.set(b); target.copy(_c1).lerp(_c2, t); }
function applyEnv(t) {
  envState.t = t;
  const i = t < 1 ? 0 : 1;
  const k = clamp(t - i, 0, 1);
  const A = ENV[i], B = ENV[i + 1] || ENV[i];
  lerpColor(skyUni.cTop.value, A.top, B.top, k);
  lerpColor(skyUni.cMid.value, A.mid, B.mid, k);
  lerpColor(skyUni.cHor.value, A.hor, B.hor, k);
  lerpColor(scene.fog.color, A.fog, B.fog, k);
  scene.fog.density = lerp(A.fd, B.fd, k);
  lerpColor(hemi.color, A.hemiS, B.hemiS, k);
  lerpColor(hemi.groundColor, A.hemiG, B.hemiG, k);
  hemi.intensity = lerp(A.hemiI, B.hemiI, k);
  lerpColor(sun.color, A.sunC, B.sunC, k);
  sun.intensity = lerp(A.sunI, B.sunI, k);
  sun.position.set(lerp(A.sunP[0], B.sunP[0], k), lerp(A.sunP[1], B.sunP[1], k), lerp(A.sunP[2], B.sunP[2], k));
  starMat.opacity = lerp(A.stars, B.stars, k);
  sunSprite.position.set(lerp(A.sunSp[0], B.sunSp[0], k), lerp(A.sunSp[1], B.sunSp[1], k), lerp(A.sunSp[2], B.sunSp[2], k));
  sunSprite.scale.setScalar(lerp(A.sunSc, B.sunSc, k));
  sunSprite.material.opacity = lerp(A.sunOp, B.sunOp, k);
  moonSprite.material.opacity = clamp(t - 1.3, 0, 0.7);
  renderer.toneMappingExposure = lerp(A.exp, B.exp, k);
  sun.castShadow = t < 1.4;
}

/* ============================================================ materials */
const M = {
  woodDark: new THREE.MeshStandardMaterial({ map: woodTex('#6e4a28', '#553818'), roughness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.8 }),
  woodLight: new THREE.MeshStandardMaterial({ map: woodTex('#c99a5f', '#a87b45'), roughness: 0.75 }),
  bamboo: new THREE.MeshStandardMaterial({ color: 0xc9b06a, roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.5, metalness: 0.1 }),
  vermilion: new THREE.MeshStandardMaterial({ map: woodTex('#c4472c', '#9c2f1c'), roughness: 0.7 }),
  rope: new THREE.MeshStandardMaterial({ color: 0x8a6b42, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x4a5261, roughness: 0.9 }),
  roofDark: new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.9 }),
};

/* ============================================================ world */
const world = new THREE.Group();
scene.add(world);
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: dirtTex(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  world.add(ground);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(9, 170), new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95 }));
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, -71); street.receiveShadow = true;
  world.add(street);
}
const windowMats = [];
function makeWindowMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3a3730, emissive: 0xffa64d, emissiveIntensity: 0, roughness: 0.4 });
  windowMats.push({ mat: m, delay: rand(0, 1) });
  return m;
}
const plasterA = plasterTex('#e8ddc8'), plasterB = plasterTex('#dfd0b2'), plasterC = plasterTex('#d9cbc0');
function makeHouse(w, h, d, side, detail) {
  const g = new THREE.Group();
  const tex = [plasterA, plasterB, plasterC][Math.floor(rand(0, 3))];
  const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2; body.castShadow = detail; body.receiveShadow = true;
  g.add(body);
  const rw = w + 0.7, rd = d + 0.7, rh = h * 0.42;
  const slopeLen = Math.hypot(rd / 2, rh);
  const ang = Math.atan2(rh, rd / 2);
  const mat = detail ? M.roof : M.roofDark;
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.09, slopeLen + 0.15), mat);
  s1.position.set(0, h + rh / 2, rd / 4); s1.rotation.x = ang; s1.castShadow = detail;
  const s2 = s1.clone(); s2.position.z = -rd / 4; s2.rotation.x = -ang;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.14, 0.22), M.roofDark);
  ridge.position.y = h + rh;
  g.add(s1, s2, ridge);
  const face = new THREE.Group();
  face.position.x = side * (w / 2 + 0.01);
  face.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  const nw = Math.max(1, Math.round(d / 2.6));
  for (let i = 0; i < nw; i++) {
    const wx = (i - (nw - 1) / 2) * 2.1;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), makeWindowMat());
    win.position.set(wx, h * 0.62, 0.02);
    face.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.06), M.woodDark);
    frame.position.set(wx, h * 0.62 + 0.5, 0.03); face.add(frame);
    const frame2 = frame.clone(); frame2.position.y = h * 0.62 - 0.5; face.add(frame2);
    if (detail) for (let b = -2; b <= 2; b++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.05), M.woodDark);
      bar.position.set(wx + b * 0.24, h * 0.62, 0.04); face.add(bar);
    }
  }
  if (detail) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7), M.woodDark);
    door.position.set(0, 0.85, 0.02); face.add(door);
  }
  g.add(face);
  return g;
}
{
  let z = -3.5;
  while (z > -78) {
    const d = rand(4.6, 6.6);
    const detail = z > -26;
    for (const side of [-1, 1]) {
      const w = rand(4.5, 6), h = rand(3.4, 4.6);
      const house = makeHouse(w, h, d - rand(0, 0.7), -side, detail);
      house.position.set(side * (4.5 + w / 2 + rand(0.1, 0.7)), 0, z - d / 2);
      world.add(house);
    }
    z -= d + rand(0.3, 1);
  }
  const farMat = new THREE.MeshStandardMaterial({ color: 0x9b8f95, roughness: 1 });
  for (let k = 0; k < 26; k++) {
    const w = rand(4, 9), h = rand(2.5, 5.5);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, rand(4, 8)), farMat);
    const sx = Math.random() > 0.5 ? 1 : -1;
    b.position.set(sx * rand(6, 42), h / 2, rand(-84, -112));
    world.add(b);
  }
}
function mountainMesh(color, h, z, seed) {
  const [c, x] = makeCanvas(1024, 256);
  x.fillStyle = color; x.beginPath(); x.moveTo(0, 256);
  for (let px = 0; px <= 1024; px += 16) {
    const y = 256 - (90 + Math.sin(px * 0.004 + seed) * 60 + Math.sin(px * 0.013 + seed * 3) * 30 + Math.sin(px * 0.03 + seed * 7) * 12);
    x.lineTo(px, y);
  }
  x.lineTo(1024, 256); x.closePath(); x.fill();
  const t = canvasTex(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(360, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true, depthWrite: false }));
  m.position.set(0, h * 0.32, z);
  return m;
}
world.add(mountainMesh('#5a7a8a', 60, -150, 2.1));
world.add(mountainMesh('#48657a', 44, -125, 5.7));

/* ============================================================ 屋台 */
const stallGroups = [];
function makeStall(kind, side, z) {
  const g = new THREE.Group();
  g.position.set(side * 5.6, 0, z);
  g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const stripe = stripeTex(['#e33b3b', '#2f6fbf', '#e88b1f', '#3f9a4d'][kind], '#fff7ec');
  for (const [px, pz] of [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.55], [1.15, 0.55]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), M.wood);
    p.position.set(px, 1.15, pz); p.castShadow = true; g.add(p);
  }
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.85, 1.0), M.woodLight);
  counter.position.set(0, 0.45, 0.1); counter.castShadow = true; counter.receiveShadow = true;
  g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.1), M.woodDark);
  top.position.set(0, 0.9, 0.1); g.add(top);
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.6), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.9, side: THREE.DoubleSide }));
  skirt.position.set(0, 0.58, 0.62); g.add(skirt);
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.5), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.9, side: THREE.DoubleSide }));
  awn.position.set(0, 2.28, 0.25); awn.rotation.x = -Math.PI / 2 + 0.42; awn.castShadow = true;
  g.add(awn);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.9), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.9, side: THREE.DoubleSide }));
  back.position.set(0, 2.32, -0.45); back.rotation.x = Math.PI / 2 - 0.5; g.add(back);
  if (kind === 0) {
    for (let i = 0; i < 6; i++) {
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.15 }));
      a.position.set(-0.7 + (i % 3) * 0.35, 1.12, 0.28 - Math.floor(i / 3) * 0.3);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), M.bamboo);
      st.position.copy(a.position); st.position.y -= 0.14;
      g.add(a, st);
    }
  } else if (kind === 1) {
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.8), new THREE.MeshStandardMaterial({ color: 0x7ab5d8, roughness: 0.6 }));
    tub.position.set(0, 1.03, 0.15); g.add(tub);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x5aa6d8, roughness: 0.1, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 1.16, 0.15); g.add(water);
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8622a, roughness: 0.4 }));
      f.scale.set(1.6, 0.7, 0.9); f.position.set(rand(-0.6, 0.6), 1.17, 0.15 + rand(-0.25, 0.25));
      f.rotation.y = rand(0, 6.28); g.add(f);
    }
  } else if (kind === 2) {
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0f4, roughness: 1 }));
      w.position.set(-0.6 + i * 0.4, 1.25, 0.1); w.scale.set(1, 1.2, 1);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), M.bamboo);
      st.position.set(w.position.x, 1.02, 0.1);
      g.add(w, st);
    }
  } else {
    const grid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.7), M.black);
    grid.position.set(0, 1.0, 0.15); g.add(grid);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb5732a, roughness: 0.5 }));
      b.position.set(-0.42 + (i % 4) * 0.28, 1.06, 0.02 + Math.floor(i / 4) * 0.26);
      g.add(b);
    }
  }
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, emissive: 0xffc25e, emissiveIntensity: 0, roughness: 0.3 });
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), bulbMat);
    b.position.set(-1.2 + i * 0.4, 1.9 - Math.sin(i / 6 * Math.PI) * 0.08, 0.92);
    g.add(b);
  }
  world.add(g);
  stallGroups.push({ g, bulbMat, worldPos: new THREE.Vector3(side * 5.0, 1.4, z) });
  return g;
}
makeStall(0, -1, -8.5);
makeStall(1, 1, -12.5);
makeStall(2, -1, -17.5);
makeStall(3, 1, -21.5);

/* ============================================================ 門 */
const gate = new THREE.Group();
{
  gate.position.set(0, 0, -30);
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 5.2, 14), M.vermilion);
    pillar.position.set(sx * 3.4, 2.6, 0); pillar.castShadow = true;
    gate.add(pillar);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.35, 14), M.black);
    base.position.set(sx * 3.4, 0.17, 0);
    gate.add(base);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 0.5), M.vermilion);
  beam.position.y = 4.7; beam.castShadow = true; gate.add(beam);
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 0.36), M.vermilion);
  beam2.position.y = 3.85; gate.add(beam2);
  const top = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.28, 0.9), M.roofDark);
  top.position.y = 5.05; top.castShadow = true; gate.add(top);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.95), M.roofDark);
    cap.position.set(sx * 4.55, 5.22, 0); cap.rotation.z = sx * 0.28;
    gate.add(cap);
  }
  const [c, x] = makeCanvas(256, 128);
  x.fillStyle = '#20242c'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#c9a227'; x.lineWidth = 8; x.strokeRect(6, 6, 244, 116);
  x.fillStyle = '#f5e6b8'; x.font = '900 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('まつり', 128, 68);
  const signMat = new THREE.MeshStandardMaterial({ map: canvasTex(c), roughness: 0.6, emissive: 0xffd070, emissiveMap: canvasTex(c), emissiveIntensity: 0 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.08), signMat);
  sign.position.set(0, 4.28, 0.05);
  gate.add(sign);
  gate.userData.signMat = signMat;
  world.add(gate);
}

/* ============================================================ 作業台まわり */
const bench = new THREE.Group();
{
  bench.position.set(0, 0, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.09, 1.0), M.woodLight);
  top.position.y = 0.92; top.castShadow = true; top.receiveShadow = true;
  bench.add(top);
  for (const [lx, lz] of [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.09), M.wood);
    leg.position.set(lx, 0.45, lz); leg.castShadow = true;
    bench.add(leg);
  }
  const potCols = [0xff7fa8, 0x3f8fd8, 0xffc927];
  potCols.forEach((pc, i) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.4 }));
    pot.position.set(-0.75 + i * 0.16, 1.01, 0.32);
    const paintM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), new THREE.MeshStandardMaterial({ color: pc, roughness: 0.3 }));
    paintM.position.copy(pot.position); paintM.position.y = 1.055;
    bench.add(pot, paintM);
  });
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), M.bamboo);
  brush.rotation.z = Math.PI / 2 - 0.2; brush.position.set(-0.5, 0.98, 0.2);
  bench.add(brush);
  for (const sx of [-1.15, 1.15]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.85, 10), M.wood);
    post.position.set(sx, 0.925, -0.85); post.castShadow = true;
    bench.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.35, 10), M.bamboo);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.82, -0.85); bar.castShadow = true;
  bench.add(bar);
  world.add(bench);
}

/* ============================================================ 提灯 */
const LANTERN_H = 0.6;
let paperGeo = null;
function getPaperGeo() {
  if (paperGeo) return paperGeo;
  const pts = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const yn = i / N;
    let r = 0.29 * (0.56 + 0.44 * Math.sin(yn * Math.PI));
    r *= 1 + 0.02 * Math.sin(yn * Math.PI * 2 * 9);
    pts.push(new THREE.Vector2(Math.max(r, 0.13), yn * (LANTERN_H - 0.1) + 0.05));
  }
  paperGeo = new THREE.LatheGeometry(pts, 36);
  return paperGeo;
}
const designTexCache = {};
function getDesignTex(design) {
  const key = design || 'plain';
  if (!designTexCache[key]) designTexCache[key] = canvasTex(lanternCanvas(design));
  return designTexCache[key];
}
const glowTex = canvasTex(glowCanvas());
const projTexCache = {};
function getProjTex(design) {
  const key = design || 'plain';
  if (!projTexCache[key]) {
    projTexCache[key] = canvasTex(projCanvasFrom(design ? x => { MOTIFS[design](x, 128, 128, 62); x.globalAlpha = 0.25; MOTIFS[design](x, 128, 128, 70); } : null));
  }
  return projTexCache[key];
}
const RUB_SECTORS = 12;
function makeLantern(design, { drawable = false, withFrame = false } = {}) {
  // 原点 = 吊り下げ点（上端）。中身は下方向へ。
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = -0.72;
  inner.rotation.y = Math.PI / 2; // 絵柄(u=0.25/0.75)を正面と背面へ
  g.add(inner);
  g.userData.inner = inner;
  let tex, ownCanvas = null, overlay = null, overlayX = null, ownX = null;
  if (drawable) {
    ownCanvas = lanternCanvas(null);
    ownX = ownCanvas.getContext('2d');
    const [ov, ovx] = makeCanvas(512, 512);
    overlay = ov; overlayX = ovx;
    tex = canvasTex(ownCanvas);
  } else {
    tex = getDesignTex(design);
  }
  const paperMat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.9,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0,
  });
  const paper = new THREE.Mesh(getPaperGeo(), paperMat);
  paper.castShadow = true;
  inner.add(paper);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.045, 20), M.black);
  capTop.position.y = LANTERN_H - 0.03;
  const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.145, 0.045, 20), M.black);
  capBot.position.y = 0.03;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 14, Math.PI), M.black);
  handle.position.y = LANTERN_H - 0.01;
  inner.add(capTop, capBot, handle);
  const candle = new THREE.Group();
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.5 }));
  wax.position.y = 0.11;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8), new THREE.MeshBasicMaterial({ color: 0xffc93a, transparent: true, opacity: 0 }));
  flame.position.y = 0.21;
  candle.add(wax, flame);
  candle.visible = false;
  inner.add(candle);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffcf8a }));
  glow.scale.set(1.5, 1.5, 1);
  glow.position.y = LANTERN_H / 2;
  inner.add(glow);
  // 骨組み（制作用）
  let frameGroup = null, frameParts = null;
  if (withFrame) {
    frameGroup = new THREE.Group();
    inner.add(frameGroup);
    frameParts = [];
    for (const rz of [0, Math.PI / 2]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, LANTERN_H - 0.1, 6), M.bamboo);
      rod.rotation.y = rz;
      frameGroup.add(rod);
      frameParts.push({ mesh: rod, kind: 'rod' });
    }
    const hoopYs = [0.09, 0.22, 0.35, 0.47];
    for (const hy of hoopYs) {
      const yn = (hy - 0.05) / (LANTERN_H - 0.1);
      const r = 0.29 * (0.56 + 0.44 * Math.sin(yn * Math.PI));
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 24), M.bamboo);
      hoop.rotation.x = Math.PI / 2;
      frameGroup.add(hoop);
      frameParts.push({ mesh: hoop, kind: 'hoop', y1: hy });
    }
  }
  const obj = {
    g, paperMat, paper, glow, candle, flame, design, lit: 0, flick: rand(0, 10),
    ownCanvas, ownX, overlay, overlayX, tex, hasMarks: false, projTexOverride: null,
    frameGroup, frameParts,
    setStretch(s) {
      // 骨組みの伸び 0..1 と 上キャップ・持ち手の追従
      if (!frameParts) return;
      for (const p of frameParts) {
        if (p.kind === 'rod') {
          p.mesh.scale.y = lerp(0.12, 1, s);
          p.mesh.position.y = lerp(0.1, LANTERN_H / 2, s);
        } else {
          p.mesh.position.y = lerp(0.05 + p.y1 * 0.16, p.y1, s);
        }
      }
      capTop.position.y = lerp(0.14, LANTERN_H - 0.03, s);
      handle.position.y = lerp(0.16, LANTERN_H - 0.01, s);
    },
    setLit(k) {
      obj.lit = k;
      paperMat.emissiveIntensity = k * 1.5;
      glow.material.opacity = k * 0.55;
      flame.material.opacity = k;
    },
    /* おえかき: uv 0..1（u=周方向, v=下から上） */
    strokeTo(u, v, pu, pv, color) {
      if (!ownX) return;
      obj.hasMarks = true;
      const W = 512;
      const y0 = (1 - clamp(pv, 0.15, 0.85)) * W, y1 = (1 - clamp(v, 0.15, 0.85)) * W;
      let x0 = pu * W, x1 = u * W;
      if (Math.abs(x1 - x0) > W / 2) { x0 = x1; } // 巻きの継ぎ目はつなげない
      for (const [tx0, tx1] of [[x0, x1], [(x0 + W / 2) % W, (x1 + W / 2) % W]]) {
        for (const ctx of [ownX, overlayX]) {
          ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.lineWidth = 30; ctx.globalAlpha = 0.95;
          ctx.beginPath(); ctx.moveTo(tx0, y0); ctx.lineTo(tx1 === tx0 ? tx1 + 0.5 : tx1, y1); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      obj.tex.needsUpdate = true;
    },
    stampAt(u, v, design) {
      if (!ownX) return;
      obj.hasMarks = true;
      const W = 512;
      const y = (1 - clamp(v, 0.2, 0.8)) * W;
      const x0 = u * W;
      for (const tx of [x0, (x0 + W / 2) % W]) {
        for (const ctx of [ownX, overlayX]) {
          MOTIFS[design](ctx, tx, y, 62);
          if (tx < 70) MOTIFS[design](ctx, tx + W, y, 62);
          if (tx > W - 70) MOTIFS[design](ctx, tx - W, y, 62);
        }
      }
      obj.tex.needsUpdate = true;
    },
    buildProj() {
      if (!overlay) return null;
      const src = overlay;
      obj.projTexOverride = canvasTex(projCanvasFrom(x => {
        x.drawImage(src, 128, 100, 256, 312, 34, 34, 188, 188);
      }));
      return obj.projTexOverride;
    },
  };
  g.userData.lantern = obj;
  return obj;
}
/* 紙貼りの部分表示（アルファマップ） */
function attachRubAlpha(lan) {
  const [ac, ax] = makeCanvas(256, 64);
  ax.fillStyle = '#000'; ax.fillRect(0, 0, 256, 64);
  const at = new THREE.CanvasTexture(ac);
  lan.rubAlphaC = ac; lan.rubAlphaX = ax; lan.rubAlphaTex = at;
  lan.paperMat.transparent = true;
  lan.paperMat.alphaMap = at;
  lan.paperMat.side = THREE.DoubleSide;
  lan.paperMat.needsUpdate = true;
}
function paintRubSectors(lan, sectors) {
  const ax = lan.rubAlphaX;
  const w = 256 / RUB_SECTORS;
  ax.fillStyle = '#000'; ax.fillRect(0, 0, 256, 64);
  for (let i = 0; i < RUB_SECTORS; i++) {
    const a = clamp(sectors[i], 0, 1);
    if (a <= 0) continue;
    ax.fillStyle = `rgba(255,255,255,${a})`;
    ax.fillRect(i * w - 1, 0, w + 2, 64);
  }
  lan.rubAlphaTex.needsUpdate = true;
}
function finishRub(lan) {
  lan.paperMat.transparent = false;
  lan.paperMat.alphaMap = null;
  lan.paperMat.side = THREE.FrontSide;
  lan.paperMat.needsUpdate = true;
  if (lan.frameGroup) lan.frameGroup.visible = false; // 骨は紙の内側へ（リブは形状で残る）
}
/* ポインタ→提灯表面の UV（レイと提灯軸の最近接点から計算。当てにくさゼロ） */
const _ray = new THREE.Raycaster();
const _ptr = new THREE.Vector2();
const _pRay = new THREE.Vector3(), _pSeg = new THREE.Vector3();
function lanternPointerUV(px, py, lan) {
  // カメラへ向いた縦平面（提灯軸を通る）と視線の交点から円筒面を展開する。
  // 指の真下に絵が乗り、端では漸近的に側面へ回る。
  _ptr.x = (px / window.innerWidth) * 2 - 1;
  _ptr.y = -(py / window.innerHeight) * 2 + 1;
  _ray.setFromCamera(_ptr, camera);
  lan.g.userData.inner.getWorldPosition(_wp);
  const az = Math.atan2(camera.position.x - _wp.x, camera.position.z - _wp.z);
  const n = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
  _plane.setFromNormalAndCoplanarPoint(n, _wp);
  let hit = _ray.ray.intersectPlane(_plane, _hit);
  if (!hit) { // ほぼ真横からの視線などの保険: 軸との最近接点
    const v0 = _wp.clone(); v0.y += 0.05;
    const v1 = _wp.clone(); v1.y += LANTERN_H - 0.05;
    _ray.ray.distanceSqToSegment(v0, v1, _pRay, _pSeg);
    hit = _pSeg;
  }
  const lat = new THREE.Vector3(-Math.cos(az), 0, Math.sin(az));
  const off = hit.clone().sub(_wp).dot(lat);
  const phi = az - Math.asin(clamp(off / 0.29, -1, 1));
  const u = ((phi - Math.PI / 2) / (Math.PI * 2) % 1 + 1) % 1;
  const v = clamp((hit.y - _wp.y - 0.05) / (LANTERN_H - 0.1), 0, 1);
  return { u, v };
}

/* ============================================================ 制作アンカーと小物 */
const craftAnchor = new THREE.Group();
craftAnchor.position.set(0, 0.965 + 0.72, 0.02);
world.add(craftAnchor);
const candleProp = new THREE.Group();
{
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.5 }));
  wax.position.y = 0.08; wax.castShadow = true;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6), M.black);
  wick.position.y = 0.17;
  candleProp.add(wax, wick);
  candleProp.visible = false;
  world.add(candleProp);
}
const CANDLE_HOME = new THREE.Vector3(0.62, 0.965, 0.3);

/* ============================================================ 電柱とロープ（引き上げ式） */
const POLE_DEFS = [
  { x: 4.15, z: -5 }, { x: -4.15, z: -11 }, { x: 4.15, z: -17 }, { x: -4.15, z: -23 },
];
const poles = [];
for (const p of POLE_DEFS) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.5, 10), M.wood);
  post.position.y = 2.25; post.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), M.wood);
  arm.position.y = 4.3;
  g.add(post, arm);
  g.position.set(p.x, 0, p.z);
  g.scale.y = 0.001; g.visible = false;
  world.add(g);
  poles.push(g);
}
const SPAN_ANCHORS = [
  [new THREE.Vector3(4.15, 4.35, -5), new THREE.Vector3(-4.15, 4.35, -11)],
  [new THREE.Vector3(-4.15, 4.35, -11), new THREE.Vector3(4.15, 4.35, -17)],
  [new THREE.Vector3(4.15, 4.35, -17), new THREE.Vector3(-4.15, 4.35, -23)],
  [new THREE.Vector3(-4.15, 4.35, -23), new THREE.Vector3(2.9, 4.55, -29.8)],
  [new THREE.Vector3(-2.9, 4.45, -30), new THREE.Vector3(2.9, 4.45, -30)],
];
const LOW_Y = 1.68, LOW_DROOP = 0.32;
const ropes = [];
function ropeCurve(span, k) {
  const [a, b] = SPAN_ANCHORS[span];
  const A = new THREE.Vector3(a.x, lerp(LOW_Y, a.y, k), a.z);
  const B = new THREE.Vector3(b.x, lerp(LOW_Y, b.y, k), b.z);
  const mid = A.clone().lerp(B, 0.5);
  mid.y -= lerp(LOW_DROOP, span === 4 ? 0.22 : 0.42, k);
  return new THREE.CatmullRomCurve3([A, mid, B]);
}
for (let s = 0; s < SPAN_ANCHORS.length; s++) {
  const curve = ropeCurve(s, 0);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.016, 6, false), M.rope);
  mesh.visible = false;
  world.add(mesh);
  ropes.push({ mesh, curve, span: s, k: 0, attached: [] });
}
function setRopeHeight(r, k) {
  r.k = k;
  r.curve = ropeCurve(r.span, k);
  r.mesh.geometry.dispose();
  r.mesh.geometry = new THREE.TubeGeometry(r.curve, 32, 0.016, 6, false);
  for (const att of r.attached) {
    const p = r.curve.getPoint(att.t);
    att.lan.g.position.set(p.x, p.y - 0.02, p.z);
  }
}
const hangPoints = [];
for (let s = 0; s < SPAN_ANCHORS.length; s++) {
  for (let i = 0; i < 5; i++) hangPoints.push({ span: s, t: (i + 1) / 6 });
}
function hangPointPos(hp) { return ropes[hp.span].curve.getPoint(hp.t); }
function attachLantern(lan, hp) {
  const p = hangPointPos(hp);
  lan.g.position.set(p.x, p.y - 0.02, p.z);
  ropes[hp.span].attached.push({ lan, t: hp.t });
  lan.hp = hp;
  // 地面投影（未点灯）
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({ map: lan.projTexOverride || getProjTex(lan.design), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2;
  disc.rotation.z = rand(0, Math.PI * 2);
  disc.position.set(p.x, 0.02 + hangOrder.length * 0.0006, p.z);
  disc.visible = false;
  world.add(disc);
  lan.proj = disc;
  hangOrder.push(lan);
}
const hangOrder = []; // 点灯カスケード順（手前の端 → 門）

/* 引きロープ（滑車） */
const pulley = new THREE.Group();
let pulleyHandle, pulleyRope;
{
  pulley.position.set(3.05, 0, -3.3);
  pulleyRope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0xb84a3a, roughness: 1 }));
  pulley.add(pulleyRope);
  pulleyHandle = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 12), M.woodLight);
  grip.rotation.z = Math.PI / 2;
  grip.castShadow = true;
  pulleyHandle.add(grip);
  for (const sx of [-0.31, 0.31]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.5 }));
    knob.position.x = sx;
    pulleyHandle.add(knob);
  }
  pulley.add(pulleyHandle);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 16), M.woodDark);
  wheel.position.y = 4.32;
  pulley.add(wheel);
  const wireUp = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.2, 6), M.rope);
  wireUp.position.set(0.55, 4.32, -0.8);
  wireUp.rotation.z = 1.1; wireUp.rotation.x = 0.6;
  pulley.add(wireUp);
  pulley.visible = false;
  world.add(pulley);
}
const HANDLE_TOP = 1.72;
function setHandleY(y) {
  pulleyHandle.position.y = y;
  const top = 4.25;
  pulleyRope.position.y = (top + y) / 2;
  pulleyRope.scale.y = Math.max(top - y, 0.1);
}
setHandleY(HANDLE_TOP);

/* ============================================================ 太鼓 */
const drum = new THREE.Group();
let drumSkin, bachiPivot;
{
  drum.position.set(1.28, -2.2, -0.72);
  drum.rotation.y = -0.35;
  const standMat = M.woodDark;
  for (const sx of [-0.42, 0.42]) {
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.14), standMat);
    legA.position.set(sx, 0.52, -0.25); legA.rotation.x = 0.35; legA.castShadow = true;
    const legB = legA.clone(); legB.position.z = 0.25; legB.rotation.x = -0.35;
    drum.add(legA, legB);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.5), standMat);
  rail.position.y = 0.28;
  drum.add(rail);
  const bodyTex = woodTex('#8a4f2a', '#6b3a1c');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.62, 26), new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.65 }));
  body.rotation.x = Math.PI / 2; body.position.y = 1.06; body.castShadow = true;
  drum.add(body);
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#f0dcba'; x.beginPath(); x.arc(128, 128, 128, 0, Math.PI * 2); x.fill();
  noise(x, 256, 256, 0.06, 600);
  x.fillStyle = '#b03028';
  for (let i = 0; i < 3; i++) {
    x.save(); x.translate(128, 128); x.rotate(i / 3 * Math.PI * 2);
    x.beginPath(); x.arc(0, -34, 26, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(0, -20, 34, -Math.PI * 0.5, Math.PI * 0.6); x.lineTo(0, -20); x.closePath(); x.fill();
    x.restore();
  }
  drumSkin = new THREE.Mesh(new THREE.CircleGeometry(0.44, 26), new THREE.MeshStandardMaterial({ map: canvasTex(c), roughness: 0.8 }));
  drumSkin.position.set(0, 1.06, 0.315);
  drum.add(drumSkin);
  const skinBack = new THREE.Mesh(new THREE.CircleGeometry(0.44, 26), new THREE.MeshStandardMaterial({ color: 0xe8d4b0, roughness: 0.8 }));
  skinBack.position.set(0, 1.06, -0.315); skinBack.rotation.y = Math.PI;
  drum.add(skinBack);
  const tackMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.3, metalness: 0.6 });
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2;
    const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), tackMat);
    t1.position.set(Math.cos(a) * 0.43, 1.06 + Math.sin(a) * 0.43, 0.3);
    drum.add(t1);
  }
  bachiPivot = new THREE.Group();
  bachiPivot.position.set(0.42, 1.62, 0.55);
  bachiPivot.rotation.x = -1.5;
  const bachi = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.55, 10), new THREE.MeshStandardMaterial({ color: 0xf0e2c8, roughness: 0.5 }));
  bachi.position.y = -0.22;
  bachiPivot.add(bachi);
  bachiPivot.visible = false;
  drum.add(bachiPivot);
  const bachi2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.55, 10), new THREE.MeshStandardMaterial({ color: 0xf0e2c8, roughness: 0.5 }));
  bachi2.rotation.z = 1.3; bachi2.rotation.y = 0.4; bachi2.position.set(-0.35, 0.36, 0.2);
  drum.add(bachi2);
  drum.visible = false;
  world.add(drum);
}
const drumCenter = new THREE.Object3D();
drumCenter.position.set(0, 1.06, 0.1);
drum.add(drumCenter);
const drumLight = new THREE.PointLight(0xffb45e, 0, 5, 2);
drumLight.position.set(0.3, 2.1, 0.9);
drum.add(drumLight);

/* ============================================================ ヒント表示 */
const hint = new THREE.Group();
const hintRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
hintRing.rotation.x = Math.PI / 2;
hintRing.renderOrder = 5;
const hintArrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 12),
  new THREE.MeshBasicMaterial({ color: 0xff5b4a, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
hintArrow.rotation.x = Math.PI;
hintArrow.renderOrder = 5;
hint.add(hintRing, hintArrow);
hint.visible = false;
scene.add(hint);
let hintTargetPos = null, hintTargetObj = null, hintCfg = { r: 0.35, y: 0.5 };
function setHintAt(posOrObj, r = 0.35, yOff = 0.5) {
  hintTargetObj = null; hintTargetPos = null;
  if (posOrObj && posOrObj.isVector3) hintTargetPos = posOrObj.clone();
  else if (posOrObj) hintTargetObj = posOrObj;
  hintCfg = { r, y: yOff };
  hint.visible = !!posOrObj;
}
function updateHint() {
  if (!hint.visible) return;
  if (hintTargetObj) hintTargetObj.getWorldPosition(_wp);
  else if (hintTargetPos) _wp.copy(hintTargetPos);
  hint.position.copy(_wp);
  const s = 1 + 0.14 * Math.sin(nowSec * 5);
  hintRing.scale.setScalar(hintCfg.r / 0.3 * s);
  hintRing.position.y = 0.02;
  hintArrow.position.y = hintCfg.y + 0.12 + 0.07 * Math.sin(nowSec * 5);
}

/* ============================================================ パーティクル */
const sparkGeo = new THREE.BufferGeometry();
const SPARK_N = 70;
const sparkPos = new Float32Array(SPARK_N * 3);
const sparkVel = [];
let sparkLife = -1;
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparkMat = new THREE.PointsMaterial({ map: canvasTex(glowCanvas('255,230,140')), size: 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const sparks = new THREE.Points(sparkGeo, sparkMat);
scene.add(sparks);
function burstSparks(pos) {
  for (let i = 0; i < SPARK_N; i++) {
    sparkPos[i * 3] = pos.x; sparkPos[i * 3 + 1] = pos.y; sparkPos[i * 3 + 2] = pos.z;
    sparkVel[i] = new THREE.Vector3(rand(-1, 1), rand(0.5, 2.2), rand(-1, 1)).multiplyScalar(rand(0.4, 1));
  }
  sparkLife = 0;
  sparkGeo.attributes.position.needsUpdate = true;
}
function updateSparks(dt) {
  if (sparkLife < 0) return;
  sparkLife += dt;
  if (sparkLife > 0.9) { sparkLife = -1; sparkMat.opacity = 0; return; }
  sparkMat.opacity = 1 - sparkLife / 0.9;
  for (let i = 0; i < SPARK_N; i++) {
    sparkVel[i].y -= dt * 2.4;
    sparkPos[i * 3] += sparkVel[i].x * dt;
    sparkPos[i * 3 + 1] += sparkVel[i].y * dt;
    sparkPos[i * 3 + 2] += sparkVel[i].z * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}
const fireflyGeo = new THREE.BufferGeometry();
const FF_N = 46;
{
  const p = new Float32Array(FF_N * 3);
  for (let i = 0; i < FF_N; i++) {
    p[i * 3] = rand(-6, 6); p[i * 3 + 1] = rand(0.5, 4); p[i * 3 + 2] = rand(2, -34);
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const fireflyMat = new THREE.PointsMaterial({ map: canvasTex(glowCanvas('255,240,170')), size: 0.14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
scene.add(new THREE.Points(fireflyGeo, fireflyMat));

const lightPool = [];
for (let i = 0; i < 7; i++) {
  const l = new THREE.PointLight(0xffa94d, 0, 9, 2);
  scene.add(l);
  lightPool.push(l);
}

/* ============================================================ UI 参照 */
const NUM_CRAFT = 3;
const msgEl = document.getElementById('msg');
const paintbarEl = document.getElementById('paintbar');
const doneBtn = document.getElementById('doneBtn');
const handEl = document.getElementById('hand');
let msgTimer = 0;
function say(text, hold = 0) {
  msgEl.textContent = text;
  msgEl.classList.add('show');
  clearTimeout(msgTimer);
  if (hold > 0) msgTimer = setTimeout(() => msgEl.classList.remove('show'), hold * 1000);
}
function hideMsg() { msgEl.classList.remove('show'); }

/* ============================================================ ゲーム状態 */
const lanterns = [];
const craftQueue = [];
const state = {
  phase: 'intro', craftIdx: 0, craftStep: '', current: null, busy: false,
  cascadeEvents: [], cascadeIdx: 0, cascadeT0: 0, cascadeT1: 0,
  windowT0: 0, musicOn: false, hoistStep: 0, hoistMax: 6,
  lastActionAt: 0,
};
let gesture = null; // 現在のジェスチャーハンドラ
let camShake = 0;
function setGesture(g) { gesture = g; state.lastActionAt = nowSec; }

/* ============================================================ ゴーストハンド（お手本） */
let handVisible = false;
function updateHand() {
  const idle = nowSec - state.lastActionAt;
  const show = gesture && gesture.demo && !state.busy && idle > 8 && state.phase !== 'finale';
  if (show !== handVisible) { handVisible = show; handEl.style.opacity = show ? 1 : 0; }
  if (!show) return;
  const d = gesture.demo();
  if (!d) return;
  const t = (nowSec % 1.7) / 1.7;
  let x, y;
  if (d.mode === 'circle') {
    x = d.from.x + Math.cos(t * Math.PI * 2) * d.r;
    y = d.from.y + Math.sin(t * Math.PI * 2) * d.r * 0.5;
  } else if (d.mode === 'zigzag') {
    x = lerp(d.from.x, d.to.x, t) + Math.sin(t * Math.PI * 6) * 30;
    y = lerp(d.from.y, d.to.y, t);
  } else {
    const e = easeInOut(clamp(t * 1.25, 0, 1));
    x = lerp(d.from.x, d.to.x, e);
    y = lerp(d.from.y, d.to.y, e);
  }
  handEl.style.transform = `translate(${x - 18}px, ${y - 6}px)`;
}

/* ============================================================ 入力ルーター */
let ptrDown = null;
canvas.addEventListener('pointerdown', e => {
  sfx.ensure();
  state.lastActionAt = nowSec;
  canvas.setPointerCapture(e.pointerId);
  ptrDown = { x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, t: performance.now(), moved: false, engaged: false };
  if (state.busy) return;
  if (state.phase === 'finale') { ptrDown.yaw0 = camState.yaw; ptrDown.pitch0 = camState.pitch; return; }
  if (gesture && gesture.onStart) ptrDown.engaged = gesture.onStart(e.clientX, e.clientY) !== false;
});
canvas.addEventListener('pointermove', e => {
  if (!ptrDown) return;
  const dx = e.clientX - ptrDown.px, dy = e.clientY - ptrDown.py;
  ptrDown.px = e.clientX; ptrDown.py = e.clientY;
  if (Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y) > 9) ptrDown.moved = true;
  if (state.phase === 'finale') {
    if (ptrDown.moved) {
      camState.yaw = clamp(ptrDown.yaw0 + (e.clientX - ptrDown.x) * 0.0022, -0.55, 0.55);
      camState.pitch = clamp(ptrDown.pitch0 + (e.clientY - ptrDown.y) * 0.0016, -0.22, 0.25);
    }
    return;
  }
  if (state.busy) return;
  if (ptrDown.engaged && gesture && gesture.onMove) gesture.onMove(e.clientX, e.clientY, dx, dy);
});
function ptrUp(e) {
  if (!ptrDown) return;
  const wasTap = !ptrDown.moved && performance.now() - ptrDown.t < 450;
  const info = ptrDown;
  ptrDown = null;
  if (state.phase === 'finale') { if (wasTap) replayWave(); return; }
  if (state.busy) return;
  if (!gesture) return;
  if (wasTap && gesture.onTap) gesture.onTap(info.x, info.y);
  else if (info.engaged && gesture.onEnd) gesture.onEnd(info.px, info.py);
}
canvas.addEventListener('pointerup', ptrUp);
canvas.addEventListener('pointercancel', ptrUp);

/* 画面距離ヘルパ */
function nearScreen(px, py, target, frac) {
  const s = target.isVector3 ? toScreen(target) : objScreen(target);
  return Math.hypot(s.x - px, s.y - py) < frac * minDim();
}

/* ============================================================ 汎用ドラッグ&ドロップ */
const dropRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0x6ee87a, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
dropRing.renderOrder = 6;
scene.add(dropRing);
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
function startDragStep({ obj, dropPos, dropR = 0.55, ringR = 0.4, ringUp = false, liftScale = 1.2, onDone, demoFromObj = true }) {
  const startPos = obj.position.clone();
  let held = false, taps = 0;
  dropRing.position.copy(dropPos);
  dropRing.rotation.set(ringUp ? 0 : Math.PI / 2, 0, 0);
  if (ringUp) dropRing.rotation.x = 0; else dropRing.rotation.x = Math.PI / 2;
  dropRing.scale.setScalar(ringR / 0.3);
  dropRing.material.opacity = 0.85;
  setHintAt(dropPos, ringR, 0.4);
  const camDir = new THREE.Vector3();
  function success() {
    state.busy = true;
    held = false;
    dropRing.material.opacity = 0;
    setHintAt(null);
    const from = obj.position.clone();
    sfx.pop(1.2);
    tween(0.28, t => {
      obj.position.lerpVectors(from, dropPos, easeOut(t));
      obj.scale.setScalar(lerp(liftScale, 1, t));
    }, { done: () => { obj.scale.setScalar(1); burstSparks(dropPos); sfx.chime([660, 880]); onDone(); } });
  }
  function fail() {
    held = false;
    const from = obj.position.clone();
    sfx.boing();
    tween(0.4, t => {
      obj.position.lerpVectors(from, startPos, easeInOut(t));
      obj.position.y = lerp(from.y, startPos.y, t) + Math.sin(t * Math.PI) * 0.25;
      obj.scale.setScalar(lerp(liftScale, 1, t));
    });
  }
  setGesture({
    kind: 'drag',
    onStart(px, py) {
      if (!nearScreen(px, py, obj, 0.2)) return false;
      held = true;
      sfx.pop(0.9);
      obj.scale.setScalar(liftScale);
      camera.getWorldDirection(camDir);
      _plane.setFromNormalAndCoplanarPoint(camDir, dropPos);
      return true;
    },
    onMove(px, py) {
      if (!held) return;
      _ptr.x = (px / window.innerWidth) * 2 - 1;
      _ptr.y = -(py / window.innerHeight) * 2 + 1;
      _ray.setFromCamera(_ptr, camera);
      if (_ray.ray.intersectPlane(_plane, _hit)) {
        obj.position.lerp(_hit, 0.55);
        const d = obj.position.distanceTo(dropPos);
        if (d < dropR * 1.6) obj.position.lerp(dropPos, 0.18); // 磁石
        dropRing.material.opacity = d < dropR * 1.6 ? 1 : 0.85;
        dropRing.scale.setScalar((ringR / 0.3) * (d < dropR * 1.6 ? 1.25 : 1));
      }
    },
    onEnd(px, py) {
      if (!held) return;
      if (obj.position.distanceTo(dropPos) < dropR || nearScreen(px, py, dropPos, 0.15)) success();
      else fail();
    },
    onTap(px, py) {
      if (!nearScreen(px, py, obj, 0.22)) return;
      taps++;
      state.lastActionAt = nowSec;
      if (taps >= 2) { // タップ救済: 2回で自動へ
        const from = obj.position.clone();
        state.busy = true;
        dropRing.material.opacity = 0;
        setHintAt(null);
        sfx.boing();
        tween(0.55, t => {
          obj.position.lerpVectors(from, dropPos, easeInOut(t));
          obj.position.y = lerp(from.y, dropPos.y, easeInOut(t)) + Math.sin(t * Math.PI) * 0.4;
        }, { done: () => { burstSparks(dropPos); sfx.chime([660, 880]); onDone(); } });
      } else {
        tween(0.25, t => { obj.position.y = startPos.y + Math.sin(t * Math.PI) * 0.12; });
        sfx.pop(1);
      }
    },
    demo() {
      return { from: demoFromObj ? objScreen(obj) : toScreen(startPos), to: toScreen(dropPos), mode: 'line' };
    },
  });
}

/* ============================================================ 制作フェーズ */
function startCraft() {
  state.phase = 'craft';
  applyEnv(0);
  tweenCamera([0.5, 1.55, 2.15], [0, 1.25, -0.35], 60, 2.2, () => nextLantern());
  say('ちょうちんを つくろう!', 3);
}
function nextLantern() {
  if (state.craftIdx >= NUM_CRAFT) { startInstall(); return; }
  const lan = makeLantern(null, { drawable: true, withFrame: true });
  craftAnchor.add(lan.g);
  lan.paper.visible = false;
  lan.setStretch(0);
  state.current = lan;
  state.busy = false;
  lan.g.scale.setScalar(0.01);
  tween(0.4, t => lan.g.scale.setScalar(easeBack(t)), { done: () => { lan.g.scale.setScalar(1); stepStretch(); } });
  sfx.pop(0.8);
}
/* ---- 1. 骨組みを上へ引き伸ばす ---- */
function stepStretch() {
  state.busy = false;
  state.craftStep = 'stretch';
  say('ほねぐみを うえへ びよーんと のばそう!');
  const lan = state.current;
  let s = 0, lastMile = 0;
  setHintAt(lan.g.userData.inner, 0.4, 0.75);
  function complete() {
    state.busy = true;
    setHintAt(null);
    tween(0.3, t => { lan.setStretch(lerp(s, 1, easeBack(t))); }, {
      done: () => {
        lan.setStretch(1);
        sfx.pop(1.4);
        craftAnchor.getWorldPosition(_wp); _wp.y -= 0.3;
        burstSparks(_wp);
        delay(0.35, stepRub);
      },
    });
  }
  function add(d) {
    s = clamp(s + d, 0, 1);
    lan.setStretch(s);
    const mile = Math.floor(s * 8);
    if (mile !== lastMile) { lastMile = mile; sfx.creak(s); }
    if (s >= 0.8) complete();
  }
  setGesture({
    kind: 'stretch',
    onStart(px, py) { return nearScreen(px, py, lan.g.userData.inner, 0.24); },
    onMove(px, py, dx, dy) { add(-dy / (window.innerHeight * 0.33)); },
    onEnd() {},
    onTap(px, py) {
      if (!nearScreen(px, py, lan.g.userData.inner, 0.24)) return;
      sfx.pop(0.9 + s);
      add(0.22);
    },
    demo() {
      const c = lanternMidScreen(lan);
      return { from: { x: c.x, y: c.y + 40 }, to: { x: c.x, y: c.y - window.innerHeight * 0.26 }, mode: 'line' };
    },
    progress: () => s,
  });
}
/* ---- 2. 紙をこすって貼る ---- */
function stepRub() {
  state.busy = false;
  state.craftStep = 'rub';
  say('かみを こすって はろう!');
  const lan = state.current;
  attachRubAlpha(lan);
  lan.paper.visible = true;
  const sectors = new Float32Array(RUB_SECTORS);
  paintRubSectors(lan, sectors);
  setHintAt(lan.g.userData.inner, 0.4, 0.75);
  let assistFront = 0;
  function coverage() { let s = 0; for (let i = 0; i < RUB_SECTORS; i++) s += sectors[i]; return s / RUB_SECTORS; }
  function complete() {
    state.busy = true;
    setHintAt(null);
    tween(0.35, t => {
      for (let i = 0; i < RUB_SECTORS; i++) sectors[i] = Math.max(sectors[i], t);
      paintRubSectors(lan, sectors);
    }, { done: () => {
      finishRub(lan);
      sfx.swish(); sfx.pop(1.3);
      delay(0.3, stepDraw);
    } });
  }
  function fillAt(u, amount) {
    // 紙は一周巻きなので、こすった場所の反対側も一緒に貼られる
    const idx = Math.floor(u * RUB_SECTORS) % RUB_SECTORS;
    for (const base of [idx, (idx + RUB_SECTORS / 2) % RUB_SECTORS]) {
      sectors[base] = clamp(sectors[base] + amount, 0, 1);
      sectors[(base + 1) % RUB_SECTORS] = clamp(sectors[(base + 1) % RUB_SECTORS] + amount * 0.6, 0, 1);
      sectors[(base + RUB_SECTORS - 1) % RUB_SECTORS] = clamp(sectors[(base + RUB_SECTORS - 1) % RUB_SECTORS] + amount * 0.6, 0, 1);
    }
    paintRubSectors(lan, sectors);
    sfx.rub();
    if (coverage() >= 0.85) complete();
  }
  setGesture({
    kind: 'rub',
    onStart(px, py) { return nearScreen(px, py, lan.g.userData.inner, 0.28); },
    onMove(px, py, dx, dy) {
      if (Math.hypot(dx, dy) < 1.5) return;
      const { u } = lanternPointerUV(px, py, lan);
      fillAt(u, 0.34);
    },
    onEnd() {},
    onTap(px, py) {
      if (!nearScreen(px, py, lan.g.userData.inner, 0.28)) return;
      // タップ救済: 正面から順に2セクターずつ
      const u = (0.25 + assistFront / RUB_SECTORS) % 1;
      assistFront += 2;
      fillAt(u, 1); fillAt((u + 1 / RUB_SECTORS) % 1, 1);
      sfx.rub();
    },
    demo() {
      const c = lanternMidScreen(lan);
      const w = window.innerWidth * 0.1;
      return { from: { x: c.x, y: c.y }, r: w + 40, mode: 'circle' };
    },
    progress: coverage,
  });
}
/* ---- 3. おえかき + スタンプ ---- */
const paint = { mode: 'brush', color: '#e6486f', design: 'hana' };
function stepDraw() {
  state.busy = false;
  state.craftStep = 'draw';
  say('ゆびで えを かこう! スタンプも おせるよ');
  const lan = state.current;
  paintbarEl.classList.add('show');
  doneBtn.classList.remove('show');
  let prev = null;
  setGesture({
    kind: 'draw',
    onStart(px, py) {
      if (!nearScreen(px, py, lan.g.userData.inner, 0.34)) return false;
      const { u, v } = lanternPointerUV(px, py, lan);
      if (paint.mode === 'stamp') {
        lan.stampAt(u, v, paint.design);
        sfx.chime([784, 988]);
        lan.g.userData.inner.getWorldPosition(_wp); _wp.y += 0.3;
        burstSparks(_wp);
      } else {
        prev = { u, v };
        lan.strokeTo(u + 0.0005, v, u, v, paint.color);
        sfx.scribble(0.3);
      }
      if (lan.hasMarks) doneBtn.classList.add('show');
      return true;
    },
    onMove(px, py, dx, dy) {
      if (paint.mode !== 'brush' || !prev) return;
      const { u, v } = lanternPointerUV(px, py, lan);
      lan.strokeTo(u, v, prev.u, prev.v, paint.color);
      prev = { u, v };
      sfx.scribble(clamp(Math.hypot(dx, dy) / 22, 0.15, 1));
      if (lan.hasMarks) doneBtn.classList.add('show');
    },
    onEnd() { prev = null; },
    onTap() {},
    demo() {
      const c = lanternMidScreen(lan);
      return { from: { x: c.x - 55, y: c.y + 10 }, to: { x: c.x + 55, y: c.y - 25 }, mode: 'zigzag' };
    },
  });
}
function finishDraw() {
  if (state.craftStep !== 'draw' || state.busy) return;
  const lan = state.current;
  if (!lan || !lan.hasMarks) return;
  state.busy = true;
  paintbarEl.classList.remove('show');
  doneBtn.classList.remove('show');
  lan.buildProj();
  sfx.chime();
  craftAnchor.getWorldPosition(_wp); _wp.y -= 0.35;
  burstSparks(_wp);
  tween(0.4, t => {
    const s = 1 + 0.12 * Math.sin(t * Math.PI);
    lan.g.scale.set(s, 1 / s, s);
  }, { done: () => { lan.g.scale.setScalar(1); delay(0.2, stepCandle); } });
}
/* ---- 4. ろうそくを運んで入れる ---- */
function stepCandle() {
  state.busy = false;
  state.craftStep = 'candle';
  say('ろうそくを ちょうちんの まるへ はこぼう!');
  const lan = state.current;
  candleProp.visible = true;
  candleProp.position.copy(CANDLE_HOME);
  candleProp.scale.setScalar(0.001);
  tween(0.35, t => candleProp.scale.setScalar(easeBack(t)), { done: () => candleProp.scale.setScalar(1) });
  craftAnchor.getWorldPosition(_wp);
  const dropPos = new THREE.Vector3(_wp.x, _wp.y - 0.68, _wp.z + 0.12);
  startDragStep({
    obj: candleProp, dropPos, dropR: 0.4, ringR: 0.3,
    onDone: () => {
      candleProp.visible = false;
      lan.candle.visible = true;
      // 提灯がひょいと跳ねてかぶさる
      tween(0.35, t => { lan.g.position.y = Math.sin(t * Math.PI) * 0.18; }, {
        done: () => { lan.g.position.y = 0; sfx.boing(); delay(0.25, stepHang); },
      });
    },
  });
}
/* ---- 5. できた提灯をぼうへ運ぶ ---- */
function stepHang() {
  state.busy = false;
  state.craftStep = 'hang';
  say('ちょうちんを ぼうへ はこぼう!');
  const lan = state.current;
  const idx = state.craftIdx;
  const from = new THREE.Vector3();
  lan.g.getWorldPosition(from);
  craftAnchor.remove(lan.g);
  world.add(lan.g);
  lan.g.position.copy(from);
  const dropPos = new THREE.Vector3(-0.55 + idx * 0.55, 1.8, -0.85);
  startDragStep({
    obj: lan.g, dropPos, dropR: 0.5, ringR: 0.35,
    onDone: () => {
      lan.swing = 0.5;
      craftQueue.push(lan);
      lanterns.push(lan);
      state.craftIdx++;
      state.current = null;
      state.craftStep = '';
      delay(0.35, nextLantern);
    },
  });
}

/* ============================================================ 設置フェーズ */
function startInstall() {
  state.phase = 'install';
  state.craftStep = 'hook';
  state.busy = true;
  setGesture(null);
  setShadowExtent(30, -14);
  tweenCamera([3.4, 3.6, 6.5], [0, 2.6, -14], 66, 2.4, () => {
    // 柱がポンポン立ち、ロープが低い位置に張られる
    poles.forEach((p, i) => {
      delay(0.1 + i * 0.2, () => {
        p.visible = true;
        sfx.pop(0.9 + i * 0.1);
        tween(0.4, t => { p.scale.y = easeBack(t); }, {});
      });
    });
    ropes.forEach((r, i) => {
      delay(1.0 + i * 0.25, () => {
        r.mesh.visible = true;
        const total = r.mesh.geometry.index.count;
        r.mesh.geometry.setDrawRange(0, 0);
        sfx.swish();
        tween(0.45, t => { r.mesh.geometry.setDrawRange(0, Math.floor(total * t)); });
      });
    });
    delay(2.6, () => { state.busy = false; nextHook(0); });
  });
}
/* 自作提灯をロープのフックへつなぐ */
function nextHook(i) {
  if (i >= NUM_CRAFT) { friendsArrive(); return; }
  say('ちょうちんを ひもへ つなごう!');
  state.craftStep = 'hook';
  const lan = craftQueue[i];
  const hp = hangPoints[i];
  const p = hangPointPos(hp);
  const dropPos = new THREE.Vector3(p.x, p.y - 0.02, p.z);
  startDragStep({
    obj: lan.g, dropPos, dropR: 0.7, ringR: 0.4,
    onDone: () => {
      attachLantern(lan, hp);
      lan.swing = 0.6;
      state.busy = false;
      nextHook(i + 1);
    },
  });
}
/* みんなの提灯が飛んでくる */
function friendsArrive() {
  state.busy = true;
  setGesture(null);
  say('みんなの ちょうちんも きたよ!', 3.5);
  const designs = ['hana', 'sakana', 'hoshi'];
  const rest = hangPoints.slice(NUM_CRAFT);
  rest.forEach((hp, j) => {
    const lan = makeLantern(designs[j % 3]);
    lan.candle.visible = true;
    lan.g.position.set(rand(-1.5, 1.5), 1.6, rand(0.5, 1.5));
    world.add(lan.g);
    lanterns.push(lan);
    const from = lan.g.position.clone();
    const p = hangPointPos(hp);
    const to = new THREE.Vector3(p.x, p.y - 0.02, p.z);
    delay(0.09 * j, () => {
      sfx.pop(0.8 + (j % 5) * 0.12);
      tween(0.7, t => {
        const e = easeInOut(t);
        lan.g.position.lerpVectors(from, to, e);
        lan.g.position.y = lerp(from.y, to.y, e) + Math.sin(t * Math.PI) * 1.1;
      }, { done: () => { attachLantern(lan, hp); lan.swing = 0.6; if (j % 6 === 0) sfx.boing(); } });
    });
  });
  delay(rest.length * 0.09 + 1.1, startHoist);
}
/* 引きロープで張り上げる */
function startHoist() {
  state.busy = false;
  state.craftStep = 'pull';
  say('ロープを したへ ひっぱろう!');
  pulley.visible = true;
  pulley.scale.setScalar(0.001);
  tween(0.4, t => pulley.scale.setScalar(easeBack(t)), { done: () => pulley.scale.setScalar(1) });
  setHintAt(pulleyHandle, 0.35, 0.4);
  let pullAcc = 0, springing = false;
  function clickHoist() {
    if (state.hoistStep >= state.hoistMax) return;
    state.hoistStep++;
    const k0 = (state.hoistStep - 1) / state.hoistMax;
    const k1 = state.hoistStep / state.hoistMax;
    sfx.ratchet();
    sfx.creak(k1);
    tween(0.4, t => { ropes.forEach(r => setRopeHeight(r, lerp(k0, k1, t))); }, {
      ease: easeOut,
      done: () => {
        hangOrder.forEach(l => { l.swing = Math.max(l.swing || 0, 0.35); });
        if (state.hoistStep >= state.hoistMax) hoistDone();
      },
    });
  }
  function hoistDone() {
    state.busy = true;
    setGesture(null);
    setHintAt(null);
    sfx.chime();
    hangOrder.forEach(l => { l.swing = 0.7; });
    tween(0.4, t => setHandleY(lerp(pulleyHandle.position.y, HANDLE_TOP, t)));
    delay(1.0, () => {
      tween(0.5, t => { pulley.scale.setScalar(1 - t); }, { done: () => { pulley.visible = false; } });
      startDusk();
    });
  }
  setGesture({
    kind: 'pull',
    onStart(px, py) { return nearScreen(px, py, pulleyHandle, 0.26); },
    onMove(px, py, dx, dy) {
      if (dy <= 0 || springing) return;
      pullAcc += dy;
      const travel = clamp(pullAcc / (window.innerHeight * 0.14), 0, 1);
      setHandleY(lerp(HANDLE_TOP, HANDLE_TOP - 0.55, travel));
      if (pullAcc > window.innerHeight * 0.13) {
        pullAcc = 0;
        clickHoist();
        springing = true;
        tween(0.22, t => setHandleY(lerp(HANDLE_TOP - 0.55, HANDLE_TOP, t)), { done: () => { springing = false; } });
      }
    },
    onEnd() {
      pullAcc = 0;
      tween(0.25, t => setHandleY(lerp(pulleyHandle.position.y, HANDLE_TOP, t)));
    },
    onTap(px, py) {
      if (!nearScreen(px, py, pulleyHandle, 0.26)) return;
      // タップ救済: 1タップ = 1段
      tween(0.15, t => setHandleY(lerp(HANDLE_TOP, HANDLE_TOP - 0.4, Math.sin(t * Math.PI))));
      clickHoist();
    },
    demo() {
      const c = objScreen(pulleyHandle);
      return { from: c, to: { x: c.x, y: c.y + window.innerHeight * 0.2 }, mode: 'line' };
    },
    progress: () => state.hoistStep / state.hoistMax,
  });
}

/* ============================================================ 夕暮れ */
function startDusk() {
  state.phase = 'dusk';
  state.craftStep = '';
  say('ゆうがたに なってきたよ…', 4);
  tween(6, t => applyEnv(t), { ease: easeInOut });
  tweenCamera([-0.3, 2.35, 3.0], [0.3, 1.75, -10], 62, 5.5);
  delay(4.5, () => {
    drum.visible = true;
    sfx.thump();
    tween(0.9, t => { drumLight.intensity = t * 3.2; });
    tween(0.9, t => { drum.position.y = lerp(-2.2, 0, easeOut(t)); }, {
      done: () => {
        bachiPivot.visible = true;
        state.phase = 'ceremony';
        state.busy = false;
        say('ばちを シュッ! と ふりおろそう!');
        setHintAt(drumCenter, 0.9, 1.0);
        armDrumSwipe();
      },
    });
  });
}
/* ---- 太鼓: スワイプで振り下ろす ---- */
function armDrumSwipe() {
  let startY = 0, taps = 0, struck = false;
  setGesture({
    kind: 'swipe',
    onStart(px, py) {
      startY = py;
      struck = false;
      // ばちが構える
      tween(0.15, t => { bachiPivot.rotation.x = lerp(bachiPivot.rotation.x, -1.6, t); });
      sfx.pop(0.7);
      return true;
    },
    onMove(px, py) {
      if (struck) return;
      const dy = py - startY;
      const prog = clamp(dy / (window.innerHeight * 0.13), 0, 1);
      bachiPivot.rotation.x = lerp(-1.6, 0.2, prog);
      if (prog >= 1 && nearScreen(px, py, drumCenter, 0.6)) {
        struck = true;
        const vel = clamp((py - startY) / (performance.now() - (ptrDown ? ptrDown.t : performance.now() - 300)) * 8, 0.6, 1.6);
        strikeDrum(vel);
      }
    },
    onEnd() {
      if (!struck) tween(0.3, t => { bachiPivot.rotation.x = lerp(bachiPivot.rotation.x, -1.5, t); });
    },
    onTap(px, py) {
      if (!nearScreen(px, py, drumCenter, 0.3)) return;
      taps++;
      sfx.pop(1);
      tween(0.2, t => { bachiPivot.rotation.x = -1.5 + Math.sin(t * Math.PI) * 0.3; });
      if (taps >= 2) { struck = true; strikeDrum(1); } // タップ救済
    },
    demo() {
      const c = objScreen(drumCenter);
      return { from: { x: c.x + 30, y: c.y - window.innerHeight * 0.26 }, to: { x: c.x, y: c.y }, mode: 'line' };
    },
  });
}
function strikeDrum(vel = 1) {
  if (state.phase !== 'ceremony') return;
  state.phase = 'cascade';
  setGesture(null);
  setHintAt(null);
  hideMsg();
  sfx.ensure();
  sfx.whoosh(0.2 + vel * 0.2);
  tween(0.1, t => { bachiPivot.rotation.x = lerp(bachiPivot.rotation.x, 0.55, easeOut(t)); }, {
    done: () => { tween(0.5, t => { bachiPivot.rotation.x = lerp(0.55, -1.5, easeInOut(t)); }, { delay: 0.15 }); },
  });
  const t0 = sfx.now() + 0.12;
  sfx.don(t0, { gain: 0.95 + vel * 0.35, size: 1.25 });
  delay(0.12, () => {
    tween(0.4, t => {
      const k = (1 - t) * Math.sin(t * 40);
      drumSkin.scale.setScalar(1 + k * 0.06);
      camShake = (1 - t) * 0.035;
    }, { ease: x => x });
  });
  // カスケード計画: 端(手前)から順に
  const evs = [];
  let bt = t0 + 0.95;
  for (let i = 0; i < hangOrder.length; i++) {
    const iv = lerp(0.5, 0.24, clamp(i / 14, 0, 1));
    evs.push({ t: bt, type: 'lantern', idx: i });
    const hp = hangOrder[i].g.position;
    const pan = clamp(hp.x / 6, -0.7, 0.7);
    const dist = clamp(-hp.z / 32, 0, 1);
    if (i % 2 === 0) sfx.don(bt, { gain: lerp(0.55, 0.22, dist), size: 0.82, pan });
    else sfx.ka(bt, lerp(0.4, 0.18, dist));
    bt += iv;
  }
  for (let s = 0; s < stallGroups.length; s++) {
    evs.push({ t: bt, type: 'stall', idx: s });
    sfx.don(bt, { gain: 0.5, size: 0.9, pan: s % 2 ? 0.5 : -0.5 });
    bt += 0.4;
  }
  evs.push({ t: bt, type: 'windows' });
  sfx.ka(bt, 0.4); bt += 0.45;
  evs.push({ t: bt, type: 'gate' });
  sfx.don(bt, { gain: 0.9, size: 1.1 }); bt += 0.7;
  sfx.don(bt, { gain: 0.7, size: 1 });
  sfx.don(bt + 0.34, { gain: 0.7, size: 1 });
  sfx.don(bt + 0.85, { gain: 1.2, size: 1.3 });
  sfx.kane(bt + 0.85, 1.4);
  evs.push({ t: bt + 0.85, type: 'finale' });
  state.cascadeEvents = evs;
  state.cascadeIdx = 0;
  state.cascadeT0 = t0;
  state.cascadeT1 = bt + 0.85;
}
function lightLantern(lan) {
  tween(0.3, t => lan.setLit(t), { ease: easeOut });
  if (lan.proj) {
    lan.proj.visible = true;
    tween(0.5, t => {
      lan.proj.material.opacity = t * 0.55;
      lan.proj.scale.setScalar(lerp(0.4, 1, easeBack(t)));
    });
  }
  lan.swing = Math.max(lan.swing || 0, 0.35);
}
function runCascade() {
  const evs = state.cascadeEvents;
  const tNow = sfx.now();
  if (state.cascadeT1 > state.cascadeT0) {
    const p = clamp((tNow - state.cascadeT0) / (state.cascadeT1 - state.cascadeT0), 0, 1);
    applyEnv(1 + p);
  }
  while (state.cascadeIdx < evs.length && evs[state.cascadeIdx].t <= tNow) {
    const ev = evs[state.cascadeIdx++];
    if (ev.type === 'lantern') {
      const lan = hangOrder[ev.idx];
      lightLantern(lan);
      const slot = [0, 2, 4, 9, 22].indexOf(ev.idx);
      if (slot >= 0) {
        const L = lightPool[slot];
        L.position.copy(lan.g.position); L.position.y -= 0.4;
        tween(0.4, t => { L.intensity = t * 6; });
      }
    } else if (ev.type === 'stall') {
      const st = stallGroups[ev.idx];
      tween(0.5, t => { st.bulbMat.emissiveIntensity = t * 2.2; });
      if (ev.idx < 2) {
        const L = lightPool[5 + ev.idx];
        L.position.copy(st.worldPos);
        tween(0.5, t => { L.intensity = t * 5; });
      }
    } else if (ev.type === 'windows') {
      state.windowT0 = nowSec;
    } else if (ev.type === 'gate') {
      tween(0.8, t => { gate.userData.signMat.emissiveIntensity = t * 1.6; });
      burstSparks(new THREE.Vector3(0, 4.3, -29.5));
    } else if (ev.type === 'finale') {
      startFinale();
    }
  }
}
/* ============================================================ フィナーレ */
function startFinale() {
  state.phase = 'finale';
  applyEnv(2);
  say('おまつりの よるだ! やったね!', 6);
  tween(2, t => { fireflyMat.opacity = t * 0.8; });
  hangOrder.forEach(lan => {
    tween(0.3, t => lan.setLit(1 + Math.sin(t * Math.PI) * 0.7));
  });
  burstSparks(new THREE.Vector3(0, 3.5, -8));
  tweenCamera([0, 2.1, -1.8], [0, 2.7, -18], 62, 3, () => {
    tween(40, t => {
      camState.pos.set(Math.sin(t * Math.PI * 2) * 0.4, 2.1, lerp(-1.8, -13, t));
      camState.look.set(0, 2.6, lerp(-18, -32, t));
    }, { ease: easeInOut });
  });
  delay(1.2, startMusic);
}
let lastWave = -10;
function replayWave() {
  if (state.phase !== 'finale') return;
  if (nowSec - lastWave < 2.4) return;
  lastWave = nowSec;
  const t0 = sfx.now() + 0.1;
  sfx.don(t0, { gain: 1, size: 1.2 });
  tween(0.16, t => { bachiPivot.rotation.x = lerp(-1.5, 0.55, easeOut(t)); }, {
    done: () => { tween(0.5, t => { bachiPivot.rotation.x = lerp(0.55, -1.5, easeInOut(t)); }, { delay: 0.1 }); },
  });
  hangOrder.forEach((lan, i) => {
    delay(0.15 + i * 0.05, () => {
      tween(0.5, t => lan.setLit(1 + Math.sin(t * Math.PI) * 0.9));
      if (i % 5 === 0) sfx.pop(1 + i * 0.03);
    });
  });
}
/* ============================================================ おはやし */
const music = { nextT: 0, beat: 0, bpm: 116 };
const MELODY = [440, 523.25, 587.33, 523.25, 440, 392, 440, 0, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 523.25, 0,
  659.25, 587.33, 523.25, 440, 392, 440, 523.25, 0, 440, 392, 349.23, 392, 440, 523.25, 440, 0];
function startMusic() { state.musicOn = true; music.nextT = sfx.now() + 0.1; music.beat = 0; }
function updateMusic() {
  if (!state.musicOn || !sfx.ctx) return;
  const spb = 60 / music.bpm / 2;
  while (music.nextT < sfx.now() + 0.3) {
    const b = music.beat;
    const t = music.nextT;
    const inBar = b % 8;
    if (inBar === 0) sfx.don(t, { gain: 0.34, size: 1 });
    if (inBar === 4) sfx.don(t, { gain: 0.22, size: 0.85 });
    if (inBar === 6) sfx.ka(t, 0.16);
    if (inBar % 2 === 1) sfx.kane(t, inBar === 3 ? 0.9 : 0.55);
    const note = MELODY[b % MELODY.length];
    if (note > 0) sfx.flute(t, note, spb * (Math.random() > 0.7 ? 1.9 : 0.95));
    music.beat++;
    music.nextT += spb;
  }
}

/* ============================================================ UI ハンドラ */
document.querySelectorAll('.stampBtn').forEach(btn => {
  const cx = btn.querySelector('canvas').getContext('2d');
  cx.fillStyle = '#fffdf5'; cx.fillRect(0, 0, 128, 128);
  MOTIFS[btn.dataset.design](cx, 64, 64, 40);
  btn.addEventListener('click', () => {
    sfx.ensure(); sfx.pop(1.1);
    paint.mode = 'stamp'; paint.design = btn.dataset.design;
    document.querySelectorAll('.stampBtn, .colorBtn').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
  });
});
document.querySelectorAll('.colorBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.ensure(); sfx.pop(0.9);
    paint.mode = 'brush'; paint.color = btn.dataset.color;
    document.querySelectorAll('.stampBtn, .colorBtn').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
  });
});
doneBtn.addEventListener('click', () => { sfx.ensure(); finishDraw(); });
const muteBtn = document.getElementById('mute');
muteBtn.addEventListener('click', () => {
  sfx.ensure();
  sfx.setMuted(!sfx.muted);
  muteBtn.innerHTML = sfx.muted ? '&#128263;' : '&#128266;';
});
document.getElementById('startBtn').addEventListener('click', () => {
  sfx.ensure();
  sfx.chime();
  document.getElementById('intro').classList.add('hide');
  muteBtn.style.display = 'block';
  delay(0.3, startCraft);
});

/* ============================================================ main loop */
let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const t = performance.now();
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  nowSec = t / 1000;
  updateTweens();
  updateHint();
  updateHand();
  updateSparks(dt);
  if (state.phase === 'cascade') runCascade();
  updateMusic();
  for (const lan of lanterns) {
    if (lan.swing && lan.swing > 0.01) {
      lan.swing *= Math.pow(0.5, dt);
      lan.g.rotation.z = Math.sin(nowSec * 4 + lan.flick) * lan.swing * 0.35;
      lan.g.rotation.x = Math.cos(nowSec * 3.4 + lan.flick) * lan.swing * 0.2;
    }
    if (lan.lit >= 0.99) {
      const f = 1 + 0.09 * Math.sin(nowSec * 7.3 + lan.flick) + 0.05 * Math.sin(nowSec * 12.7 + lan.flick * 2);
      lan.paperMat.emissiveIntensity = 1.5 * f * lan.lit;
      lan.glow.material.opacity = 0.55 * f * Math.min(lan.lit, 1);
      if (lan.proj) lan.proj.material.opacity = 0.55 * (0.9 + 0.1 * Math.sin(nowSec * 5 + lan.flick));
    }
  }
  if (state.windowT0) {
    const wt = nowSec - state.windowT0;
    for (const w of windowMats) {
      w.mat.emissiveIntensity = clamp((wt - w.delay) / 0.7, 0, 1) * 1.3;
    }
  }
  if (fireflyMat.opacity > 0) {
    const p = fireflyGeo.attributes.position;
    for (let i = 0; i < FF_N; i++) {
      p.array[i * 3] += Math.sin(nowSec * 0.7 + i) * dt * 0.3;
      p.array[i * 3 + 1] += Math.cos(nowSec * 0.5 + i * 2) * dt * 0.2;
    }
    p.needsUpdate = true;
  }
  applyCamera();
  if (camShake > 0.001) {
    camera.position.x += rand(-1, 1) * camShake;
    camera.position.y += rand(-1, 1) * camShake;
    camShake *= Math.pow(0.02, dt);
  }
  renderer.render(scene, camera);
}
resize();
applyEnv(0);
animate();

/* ============================================================ debug API（試遊検証用） */
window.__game = {
  get phase() { return state.phase; },
  get craftStep() { return state.craftStep; },
  get craftIdx() { return state.craftIdx; },
  get busy() { return state.busy; },
  get cascadeIdx() { return state.cascadeIdx; },
  get cascadeTotal() { return state.cascadeEvents.length; },
  get envT() { return envState.t; },
  get hoistK() { return state.hoistStep / state.hoistMax; },
  get hasMarks() { return state.current ? state.current.hasMarks : false; },
  get stepProgress() { return gesture && gesture.progress ? gesture.progress() : -1; },
  litCount() { return lanterns.filter(l => l.lit > 0.5).length; },
  lanternCount() { return lanterns.length; },
  gesture() {
    if (!gesture || state.busy) return null;
    const d = gesture.demo ? gesture.demo() : null;
    if (!d) return null;
    return { type: gesture.kind, from: d.from, to: d.to || d.from, r: d.r || 0 };
  },
};
