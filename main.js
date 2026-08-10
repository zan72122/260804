// ベルベット ケーキやさん — velvet-spray entremet game
// All world rendering happens in a Three.js perspective scene; HTML is HUD only.
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// small utils
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function canvasTexture(w, h, draw, opts = {}) {
  const tex = new THREE.CanvasTexture(makeCanvas(w, h, draw));
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  return tex;
}

// CPU value noise (for procedural textures)
const _perm = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (X, Y) => _perm[(_perm[X & 255] + Y) & 255] / 255;
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2; }
  return s;
}

// ---------------------------------------------------------------------------
// procedural textures for the kitchen set
// ---------------------------------------------------------------------------
function marbleTexture() {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#eae4da'; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h); const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 260, y / 260, 4);
      const warp = fbm(x / 130 + 40, y / 130, 3) * 3.2;
      // one broad diagonal vein family, soft-edged
      let vein = Math.abs(Math.sin((x / w) * 2.6 + (y / h) * 1.3 + warp + n * 3.2));
      vein = Math.pow(1 - vein, 7);
      let vein2 = Math.abs(Math.sin((y / h) * 1.8 + fbm(x / 200, y / 200 + 9, 3) * 4.0));
      vein2 = Math.pow(1 - vein2, 10) * 0.5;
      const base = 230 + (n - 0.5) * 12;
      const k = clamp(vein * 42 + vein2 * 30, 0, 60);
      const i = (y * w + x) * 4;
      d[i] = base - k * 0.8; d[i + 1] = base - 4 - k; d[i + 2] = base - 9 - k * 1.1; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}
function marbleRoughTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 40, y / 40, 3);
      const v = 40 + n * 60;                          // polished stone, mild variation
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
    }
  }, { linear: true });
}
function tileTexture() {
  return canvasTexture(1024, 512, (g, w, h) => {
    const tw = 128, th = 64;
    g.fillStyle = '#c4bab0'; g.fillRect(0, 0, w, h);   // grout
    for (let row = 0; row * th < h; row++) {
      const off = (row % 2) * tw * 0.5;
      for (let col = -1; col * tw < w + tw; col++) {
        const x = col * tw + off, y = row * th;
        const ggrad = g.createLinearGradient(x, y, x, y + th);
        const tint = 219 + (vnoise(col * 3.7, row * 2.9) - 0.5) * 18;
        ggrad.addColorStop(0, `rgb(${tint + 10},${tint + 7},${tint + 1})`);
        ggrad.addColorStop(0.55, `rgb(${tint},${tint - 2},${tint - 7})`);
        ggrad.addColorStop(1, `rgb(${tint - 12},${tint - 14},${tint - 18})`);
        g.fillStyle = ggrad;
        const p = 3; // grout gap
        roundRect(g, x + p, y + p, tw - p * 2, th - p * 2, 4); g.fill();
        // bevel highlight
        g.fillStyle = 'rgba(255,255,255,.22)';
        roundRect(g, x + p, y + p + 1, tw - p * 2, 5, 3); g.fill();
        // subtle glaze speckle
        g.fillStyle = `rgba(120,110,100,${0.05 + vnoise(col * 9.1, row * 7.3) * 0.05})`;
        g.fillRect(x + p, y + th - p - 4, tw - p * 2, 4);
      }
    }
  }, { repeat: [5.5, 4.5] });
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function brushedRadialTexture() {
  // roughness map with fine concentric rings — spun aluminium turntable plate
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    for (let r = 4; r < w / 2; r += 1) {
      const v = 70 + vnoise(r * 0.9, 3) * 90 + Math.sin(r * 1.7) * 18;
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    }
  }, { linear: true });
}
function woodTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const grain = fbm(x / 210, y / 22, 4);
      const ring = Math.sin(grain * 26 + x / 55) * 0.5 + 0.5;
      const v = 122 + ring * 46 + (vnoise(x / 6, y / 6) - 0.5) * 16;
      g.fillStyle = `rgb(${v | 0},${(v * 0.66) | 0},${(v * 0.4) | 0})`;
      g.fillRect(x, y, 1, 1);
    }
  }, { repeat: [1, 1] });
}
function towelTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#f3efe6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { // weave
      g.fillStyle = `rgba(180,170,150,${0.10 + (y % 4 === 0 ? 0.08 : 0)})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 1, h); }
    g.fillStyle = 'rgba(190,70,70,.85)'; g.fillRect(0, 30, w, 12); g.fillRect(0, 208, w, 12);
    g.fillStyle = 'rgba(190,70,70,.5)'; g.fillRect(0, 48, w, 4); g.fillRect(0, 196, w, 4);
  }, { repeat: [2, 2] });
}
function softBlobTexture() { // contact-shadow / mist sprite
  return canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.55, 'rgba(255,255,255,.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { linear: true });
}
function sparkleTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const gr = g.createRadialGradient(cx, cy, 1, cx, cy, w / 2);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,240,190,.6)');
    gr.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,235,.95)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, 8); g.lineTo(cx, h - 8); g.moveTo(8, cy); g.lineTo(w - 8, cy); g.stroke();
  }, { linear: true });
}

// ---------------------------------------------------------------------------
// audio — all procedural (spray hiss, clicks, fanfare)
// ---------------------------------------------------------------------------
class AudioFX {
  constructor() { this.ctx = null; this.hissGain = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.5;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1200;
    this.hissGain = this.ctx.createGain(); this.hissGain.gain.value = 0;
    src.connect(bp); bp.connect(hp); hp.connect(this.hissGain); this.hissGain.connect(this.ctx.destination);
    src.start();
  }
  hiss(on) {
    if (!this.hissGain) return;
    const t = this.ctx.currentTime;
    this.hissGain.gain.cancelScheduledValues(t);
    this.hissGain.gain.setTargetAtTime(on ? 0.16 : 0, t, on ? 0.03 : 0.08);
  }
  blip(freq = 660, dur = 0.09, vol = 0.18, type = 'sine') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  star() { this.blip(880, .12, .2); setTimeout(() => this.blip(1174, .16, .2), 90); }
  fanfare() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.blip(f, .3, .22, 'triangle'), i * 130));
  }
}
const sfx = new AudioFX();

// ---------------------------------------------------------------------------
// renderer / scene / camera
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8d8078);
scene.fog = new THREE.Fog(0x8d8078, 2.6, 6.5);

const camera = new THREE.PerspectiveCamera(41, window.innerWidth / window.innerHeight, 0.05, 20);
const CAKE_C = new THREE.Vector3(0, 1.055, 0);   // where the cake sits (lookAt target)
function frameCamera() {
  const portrait = window.innerHeight > window.innerWidth;
  camera.fov = portrait ? 44 : 33;
  camera.position.set(0.06, 1.33, portrait ? 1.06 : 1.16);
  camera.lookAt(CAKE_C.x, CAKE_C.y + 0.01, CAKE_C.z);
  camera.updateProjectionMatrix();
}
frameCamera();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.72;

// ---------------------------------------------------------------------------
// lights
// ---------------------------------------------------------------------------
const keyLight = new THREE.DirectionalLight(0xfff1dc, 3.0);   // window daylight, from left
keyLight.position.set(-1.4, 2.3, 0.9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 6;
keyLight.shadow.camera.left = -0.9; keyLight.shadow.camera.right = 0.9;
keyLight.shadow.camera.top = 0.9; keyLight.shadow.camera.bottom = -0.9;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.radius = 5;
keyLight.target.position.copy(CAKE_C);
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.DirectionalLight(0xcfd8ff, 0.38); // cool bounce from the right
fillLight.position.set(1.6, 1.6, 0.6);
scene.add(fillLight);

const hemi = new THREE.HemisphereLight(0xfff4e4, 0x6b5a4c, 0.34);
scene.add(hemi);

// low side spotlight for the finale texture reveal
const revealSpot = new THREE.SpotLight(0xffe6c0, 0, 3, Math.PI / 9, 0.45, 1.2);
revealSpot.position.set(0.7, 1.12, 0.35);
revealSpot.target.position.copy(CAKE_C);
scene.add(revealSpot, revealSpot.target);

// ---------------------------------------------------------------------------
// shared materials / textures
// ---------------------------------------------------------------------------
const TEX = {
  blob: softBlobTexture(),
  sparkle: sparkleTexture(),
};

function contactShadow(radius, opacity, y, parent = scene) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, opacity, color: 0x000000, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// kitchen set — counter, wall, window, shelf, props
// ---------------------------------------------------------------------------
const COUNTER_Y = 0.90;
function buildKitchen() {
  const g = new THREE.Group();

  // marble countertop with chamfered front edge — runs all the way back to the wall
  // note: after rotateX(-PI/2) the shape's +y becomes world -z, so front edge (z=+0.66) is shape y=-0.66
  const topShape = new THREE.Shape();
  const W = 1.45;
  topShape.moveTo(-W, -0.66); topShape.lineTo(W, -0.66); topShape.lineTo(W, 1.38); topShape.lineTo(-W, 1.38); topShape.closePath();
  const topGeo = new THREE.ExtrudeGeometry(topShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3 });
  topGeo.rotateX(-Math.PI / 2);
  const marble = new THREE.MeshPhysicalMaterial({
    map: marbleTexture(), roughnessMap: marbleRoughTexture(),
    roughness: 1.0, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.25,
    envMapIntensity: 0.7,
  });
  marble.map.repeat.set(1.2, 0.9); marble.map.wrapS = marble.map.wrapT = THREE.RepeatWrapping;
  const top = new THREE.Mesh(topGeo, marble);
  top.position.y = COUNTER_Y - 0.041;
  top.receiveShadow = true;
  g.add(top);

  // marble backsplash upstand + soft AO strip where counter meets the wall
  const upstand = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.09, 0.02), marble);
  upstand.position.set(0, COUNTER_Y + 0.043, -1.335);
  g.add(upstand);
  const aoStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 0.06),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(4, 64, (gg, w2, h2) => {
        const gr = gg.createLinearGradient(0, 0, 0, h2);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
        gg.fillStyle = gr; gg.fillRect(0, 0, w2, h2);
      }, { linear: true }),
      transparent: true, depthWrite: false,
    })
  );
  aoStrip.position.set(0, COUNTER_Y + 0.118, -1.339);
  g.add(aoStrip);

  // counter body (painted cabinet front with panel grooves)
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x5f6e6a, roughness: 0.55, metalness: 0.05 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.86, 1.16), cabMat);
  cab.position.set(0, COUNTER_Y - 0.475, -0.03);
  cab.receiveShadow = true;
  g.add(cab);
  // drawer lines + knobs (near-field detail)
  const grooveMat = new THREE.MeshStandardMaterial({ color: 0x47554f, roughness: 0.7 });
  for (const gx of [-0.72, 0, 0.72]) {
    for (const gy of [0.72, 0.5]) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.012), grooveMat);
      groove.position.set(gx, gy, 0.55);
      g.add(groove);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xc9b37e, metalness: 0.9, roughness: 0.35 })
      );
      knob.position.set(gx, gy - 0.1, 0.56);
      g.add(knob);
    }
  }

  // back wall — subway tile
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3.2),
    new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.35, metalness: 0.0, envMapIntensity: 0.5 })
  );
  wall.position.set(0, 2.0, -1.35);
  wall.receiveShadow = true;
  g.add(wall);

  // window (left) — frame + glowing daylight panel, matches key light direction
  const winG = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.5 });
  const fw = 0.78, fh = 1.1, ft = 0.055;
  for (const [x, y, w, h] of [
    [0, fh / 2, fw + ft, ft], [0, -fh / 2, fw + ft, ft],
    [-fw / 2, 0, ft, fh], [fw / 2, 0, ft, fh], [0, 0, ft * 0.6, fh], [0, 0, fw, ft * 0.6],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
    bar.position.set(x, y, 0); winG.add(bar);
  }
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fh),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(128, 192, (gg, w, h) => {
        const gr = gg.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#8fbde8'); gr.addColorStop(0.55, '#d8e6dd'); gr.addColorStop(1, '#ffe8bd');
        gg.fillStyle = gr; gg.fillRect(0, 0, w, h);
        // distant treeline silhouette for scale
        gg.fillStyle = 'rgba(110,140,110,0.55)';
        for (let x = 0; x < w; x += 4) {
          const th2 = 24 + vnoise(x / 9, 3) * 22;
          gg.fillRect(x, h * 0.62 - th2 * 0.3, 4, th2);
        }
        gg.fillStyle = 'rgba(240,250,255,0.85)';
        gg.beginPath(); gg.ellipse(w * 0.3, h * 0.2, 26, 10, 0, 0, Math.PI * 2); gg.fill();
        gg.beginPath(); gg.ellipse(w * 0.72, h * 0.3, 20, 8, 0, 0, Math.PI * 2); gg.fill();
      }), fog: false,
    })
  );
  sky.position.z = -0.028;
  winG.add(sky);
  // window sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.12, 0.03, 0.09), frameMat);
  sill.position.set(0, -fh / 2 - 0.03, 0.03);
  winG.add(sill);
  winG.position.set(-0.52, 1.52, -1.33);
  g.add(winG);

  // wooden shelf (right) with props
  const shelfMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.035, 0.24), shelfMat);
  shelf.position.set(0.62, 1.38, -1.22);
  g.add(shelf);
  const shelf2 = shelf.clone(); shelf2.position.y = 1.64; g.add(shelf2);
  // shelf brackets (so it doesn't float)
  const brMat = new THREE.MeshStandardMaterial({ color: 0x3c3c40, metalness: 0.6, roughness: 0.5 });
  for (const sy of [1.38, 1.64]) for (const sx of [0.25, 1.0]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.03), brMat);
    br.position.set(sx, sy - 0.095, -1.31);
    g.add(br);
    const br2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.2), brMat);
    br2.position.set(sx, sy - 0.028, -1.22);
    g.add(br2);
  }

  // shelf props: flour jar, copper pot, bowls, cocoa tin
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f8f5, roughness: 0.06, metalness: 0, transmission: 0.85, thickness: 0.01,
    transparent: true, opacity: 0.9,
  });
  const flourMat = new THREE.MeshStandardMaterial({ color: 0xf1e8d8, roughness: 1 });
  const jar = new THREE.Group();
  const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.16, 24), glassMat);
  const flourFill = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.045, 0.11, 20), flourMat);
  flourFill.position.y = -0.02;
  const jarLid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 24),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }));
  jarLid.position.y = 0.09;
  jar.add(jarBody, flourFill, jarLid);
  jar.position.set(0.34, 1.478, -1.22);
  g.add(jar);

  const copper = new THREE.MeshStandardMaterial({ color: 0xb46b42, metalness: 0.95, roughness: 0.32 });
  const potPts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; potPts.push(new THREE.Vector2(0.07 * (0.75 + 0.25 * Math.sin(t * 2.4)), t * 0.11)); }
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 28), copper);
  pot.position.set(0.55, 1.6575, -1.22);
  g.add(pot);
  const potHandle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 10, 20, Math.PI), copper);
  potHandle.position.set(0.55, 1.7675, -1.22);
  g.add(potHandle);

  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 20),
    new THREE.MeshStandardMaterial({ color: 0x8c3b2e, metalness: 0.4, roughness: 0.4 }));
  tin.position.set(0.95, 1.4625, -1.22);
  g.add(tin);
  for (let i = 0; i < 3; i++) {
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075 - i * 0.012, 0.045 - i * 0.008, 0.05, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: [0xd6907e, 0xe8d9b8, 0x94a98c][i], roughness: 0.4, side: THREE.DoubleSide })
    );
    bowl.position.set(0.75 + i * 0.004, 1.4225 + i * 0.045, -1.22);
    g.add(bowl);
  }

  // ---- near-field counter props ----
  // steel mixing bowl (left mid)
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dade, metalness: 1.0, roughness: 0.22 });
  const bowlPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    bowlPts.push(new THREE.Vector2(0.02 + 0.115 * Math.sin(t * Math.PI * 0.52), 0.005 + t * 0.085));
  }
  bowlPts.push(new THREE.Vector2(0.125, 0.098), new THREE.Vector2(0.118, 0.098)); // rolled rim
  const bigBowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 40), steel);
  bigBowl.position.set(-0.33, COUNTER_Y, -0.5);
  bigBowl.castShadow = true; bigBowl.receiveShadow = true;
  g.add(bigBowl);
  contactShadow(0.16, 0.4, COUNTER_Y + 0.002, g).position.set(-0.33, COUNTER_Y + 0.002, -0.5);

  // whisk leaning in the bowl
  const whisk = new THREE.Group();
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * 0.028, 0.05, Math.sin(a) * 0.028),
      new THREE.Vector3(Math.cos(a) * 0.02, 0.1, Math.sin(a) * 0.02),
      new THREE.Vector3(0, 0.13, 0),
    ]);
    whisk.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0016, 6), wireMat));
  }
  const whiskHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.11, 12), steel);
  whiskHandle.position.y = 0.185;
  whisk.add(whiskHandle);
  whisk.position.set(-0.36, COUNTER_Y + 0.04, -0.52);
  whisk.rotation.z = 0.6; whisk.rotation.x = -0.15;
  g.add(whisk);

  // folded kitchen towel (right foreground)
  const towelMat = new THREE.MeshStandardMaterial({ map: towelTexture(), roughness: 0.95 });
  const towel = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const layer = new THREE.Mesh(new THREE.BoxGeometry(0.22 - i * 0.008, 0.012, 0.15 - i * 0.006), towelMat);
    layer.position.y = 0.006 + i * 0.0115;
    layer.rotation.y = (i - 1) * 0.06;
    layer.castShadow = true; layer.receiveShadow = true;
    towel.add(layer);
  }
  towel.position.set(0.27, COUNTER_Y, 0.12);
  towel.rotation.y = -0.35;
  g.add(towel);

  // chocolate bonbons on a small plate (foreground left)
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.06, 0.014, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xf6f1e8, roughness: 0.15, clearcoat: 0.8 })
  );
  plate.position.set(-0.245, COUNTER_Y + 0.007, -0.08);
  plate.castShadow = true; plate.receiveShadow = true;
  g.add(plate);
  const bonbonMat = new THREE.MeshPhysicalMaterial({ color: 0x3d2417, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.12 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 14), bonbonMat);
    b.scale.y = 0.8;
    const a = i * 1.9;
    b.position.set(-0.245 + Math.cos(a) * 0.032, COUNTER_Y + 0.026, -0.08 + Math.sin(a) * 0.032);
    b.castShadow = true;
    g.add(b);
  }

  // hanging pendant lamp above (practical light source, matches warm fill)
  const lampG = new THREE.Group();
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.13, 0.12, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a4245, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide })
  );
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
  bulb.position.y = -0.045;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cord.position.y = 0.55;
  lampG.add(shade, bulb, cord);
  lampG.position.set(0.3, 2.02, -0.72);
  g.add(lampG);
  const lampLight = new THREE.PointLight(0xffdca0, 0.5, 2.5, 2);
  lampLight.position.set(0.3, 1.95, -0.72);
  g.add(lampLight);

  return g;
}
scene.add(buildKitchen());

// ---------------------------------------------------------------------------
// turntable (cast-iron base + spun aluminium plate) — the plate group spins
// ---------------------------------------------------------------------------
const plateGroup = new THREE.Group();  // rotating part: plate + board + cake
{
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x43464c, metalness: 0.85, roughness: 0.42 });
  const basePts = [
    new THREE.Vector2(0.0005, 0), new THREE.Vector2(0.105, 0), new THREE.Vector2(0.11, 0.006),
    new THREE.Vector2(0.108, 0.02), new THREE.Vector2(0.085, 0.035), new THREE.Vector2(0.04, 0.043),
    new THREE.Vector2(0.024, 0.048), new THREE.Vector2(0.02, 0.06), new THREE.Vector2(0.019, 0.105),
    new THREE.Vector2(0.023, 0.112), new THREE.Vector2(0.0005, 0.112),
  ];
  const base = new THREE.Mesh(new THREE.LatheGeometry(basePts, 48), ironMat);
  base.position.y = COUNTER_Y;
  base.castShadow = true; base.receiveShadow = true;
  scene.add(base);
  contactShadow(0.15, 0.5, COUNTER_Y + 0.0015);

  const alu = new THREE.MeshStandardMaterial({
    color: 0xb8bcc2, metalness: 1.0, roughness: 0.5,
    roughnessMap: brushedRadialTexture(), envMapIntensity: 1.1,
  });
  const platePts = [
    new THREE.Vector2(0.0005, 0.004), new THREE.Vector2(0.112, 0.004), new THREE.Vector2(0.122, 0.002),
    new THREE.Vector2(0.125, -0.004), new THREE.Vector2(0.122, -0.012), new THREE.Vector2(0.115, -0.014),
    new THREE.Vector2(0.0005, -0.014),
  ];
  const plate = new THREE.Mesh(new THREE.LatheGeometry(platePts, 64), alu);
  plate.castShadow = true; plate.receiveShadow = true;
  plateGroup.add(plate);

  // gold cake board
  const board = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.098, 0.004, 48),
    new THREE.MeshStandardMaterial({ color: 0xd8ac52, metalness: 0.85, roughness: 0.3 })
  );
  board.position.y = 0.007;
  board.castShadow = true;
  plateGroup.add(board);
  // soft contact shadow of the cake on its board
  const cakeAO = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.21),
    new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, opacity: 0.32, color: 0x241505, depthWrite: false })
  );
  cakeAO.rotation.x = -Math.PI / 2;
  cakeAO.position.y = 0.0093;
  cakeAO.renderOrder = 1;
  plateGroup.add(cakeAO);

  plateGroup.position.set(0, COUNTER_Y + 0.126, 0);
  scene.add(plateGroup);
}

// ---------------------------------------------------------------------------
// the entremet — lathe geometry with per-pixel paint (glaze → velvet)
// ---------------------------------------------------------------------------
const PAINT_SIZE = 1024;
const CAKE_SHAPES = [
  { name: 'dome', h: 0.078, r: 0.088, profile: (t) => Math.sin(Math.acos(1 - Math.min(1, t * 1.06)) ) }, // dome via circle
  { name: 'puck', h: 0.07, r: 0.086, profile: null },   // rounded cylinder — built manually below
  { name: 'cone', h: 0.082, r: 0.09, profile: null },   // gentle frustum
];
const GLAZE_COLORS = [0xf3e4cf, 0xefe0d6, 0xf5ead2];

function buildCakeProfile(shapeIdx) {
  // returns array of Vector2 from bottom (y=0) to top pole, roughly arc-uniform
  const pts = [];
  const S = CAKE_SHAPES[shapeIdx];
  if (S.name === 'dome') {
    const R = S.r, H = S.h;
    // slightly squashed hemisphere with a tiny vertical skirt
    pts.push(new THREE.Vector2(R * 0.985, 0));
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * R, 0.004 + Math.sin(a) * (H - 0.004)));
    }
  } else if (S.name === 'puck') {
    const R = S.r, H = S.h, F = 0.024; // big top fillet
    pts.push(new THREE.Vector2(R * 0.99, 0));
    pts.push(new THREE.Vector2(R, 0.006));
    const sideN = 8;
    for (let i = 1; i <= sideN; i++) pts.push(new THREE.Vector2(R, 0.006 + (i / sideN) * (H - F - 0.006)));
    const N = 14;
    for (let i = 1; i <= N; i++) {
      const a = (i / N) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - F + Math.cos(a) * F, H - F + Math.sin(a) * F));
    }
  } else {
    const R = S.r, H = S.h, R2 = R * 0.72, F = 0.018;
    pts.push(new THREE.Vector2(R * 0.99, 0));
    pts.push(new THREE.Vector2(R, 0.006));
    const sideN = 10;
    for (let i = 1; i <= sideN; i++) {
      const t = i / sideN;
      pts.push(new THREE.Vector2(lerp(R, R2 + F * 0.4, t), 0.006 + t * (H - F - 0.006)));
    }
    const N = 12;
    for (let i = 1; i <= N; i++) {
      const a = (i / N) * (Math.PI / 2);
      pts.push(new THREE.Vector2((R2 - F) + Math.cos(a) * F, (H - F) + Math.sin(a) * F));
    }
  }
  // close the top pole
  pts.push(new THREE.Vector2(0.0004, CAKE_SHAPES[shapeIdx].h + 0.0002));
  return pts;
}

class Cake {
  constructor(shapeIdx, glazeColor) {
    this.shapeIdx = shapeIdx;
    // --- paint target: rgb = velvet colour, a = coverage ---
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = PAINT_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.ctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    this.paintTex = new THREE.CanvasTexture(this.canvas);
    this.paintTex.colorSpace = THREE.SRGBColorSpace;
    this.paintTex.wrapS = THREE.RepeatWrapping;      // u wraps around the cake
    this.paintTex.anisotropy = 4;
    this.paintDirty = false;

    // small canvas used to estimate coverage cheaply
    this.covCanvas = document.createElement('canvas');
    this.covCanvas.width = this.covCanvas.height = 64;
    this.covCtx = this.covCanvas.getContext('2d', { willReadFrequently: true });

    const pts = buildCakeProfile(shapeIdx);
    const geo = new THREE.LatheGeometry(pts, 96);
    geo.computeVertexNormals();
    this.radiusByV = pts.map(p => p.x);              // lathe v == index/(len-1)

    const mat = new THREE.MeshPhysicalMaterial({
      color: glazeColor,
      roughness: 0.10,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      sheen: 1.0,
      sheenColor: new THREE.Color(0xffffff),
      sheenRoughness: 0.55,
      envMapIntensity: 1.0,
    });
    mat.defines = { USE_UV: '' };
    const paintTex = this.paintTex;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPaint = { value: paintTex };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uPaint;
          float velvetHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float velvetNoise(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(velvetHash(i), velvetHash(i + vec2(1.,0.)), u.x),
                       mix(velvetHash(i + vec2(0.,1.)), velvetHash(i + vec2(1.,1.)), u.x), u.y);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec4 velvetSample = texture2D(uPaint, vUv);
          float velvetCov = smoothstep(0.04, 0.55, velvetSample.a);
          // powder grain: droplets darken/lighten the coat unevenly
          float velvetGrain = velvetNoise(vUv * 620.0) * 0.55 + velvetNoise(vUv * 173.0) * 0.45;
          vec3 velvetCol = velvetSample.rgb * (0.9 + velvetGrain * 0.2);
          diffuseColor.rgb = mix(diffuseColor.rgb, velvetCol, velvetCov);`)
        .replace('float roughnessFactor = roughness;', `float roughnessFactor = mix(roughness, 0.93 + velvetGrain * 0.06, velvetCov);`)
        .replace('material.clearcoat = clearcoat;', `material.clearcoat = clearcoat * (1.0 - velvetCov);`)
        .replace('material.sheenColor = sheenColor;', `material.sheenColor = mix(vec3(0.0), velvetSample.rgb * 0.75 + 0.22, velvetCov);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          // micro-fuzz: static uv-anchored normal jitter where velvet covers
          {
            float nx = velvetNoise(vUv * 540.0) - 0.5;
            float ny = velvetNoise(vUv * 540.0 + 71.3) - 0.5;
            normal = normalize(normal + velvetCov * 0.5 * vec3(nx, ny, 0.0));
          }`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.y = 0.0092;   // sits on the board
    this.coverage = 0;
  }

  // paint a spray splat at uv with the given css colour; strength 0..1
  splat(u, v, color, strength, worldRadius) {
    const ctx = this.ctx, S = PAINT_SIZE;
    const rIdx = clamp(v, 0, 1) * (this.radiusByV.length - 1);
    const rLocal = Math.max(this.radiusByV[Math.round(rIdx)], 0.012);
    const rMax = CAKE_SHAPES[this.shapeIdx].r;
    // world radius → uv extents (u spans full circumference, v spans profile arc ~ h + r)
    const circumference = 2 * Math.PI * rLocal;
    const profileLen = CAKE_SHAPES[this.shapeIdx].h + rMax * 0.9;
    const du = clamp(worldRadius / circumference, 0.004, 0.30) * S;
    const dv = (worldRadius / profileLen) * S * 0.62;
    const cx = u * S, cy = (1 - v) * S;
    // soft base wash so coverage saturates smoothly under the speckles
    ctx.fillStyle = color;
    ctx.globalAlpha = strength * 0.16;
    for (const wrap of [-S, 0, S]) {
      const x = cx + wrap;
      if (x < -du || x > S + du) continue;
      ctx.beginPath();
      ctx.ellipse(x, cy, du * 0.72, dv * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const dots = 30;
    for (let i = 0; i < dots; i++) {
      // gaussian-ish scatter
      const a = Math.random() * Math.PI * 2;
      const rr = (Math.random() + Math.random()) * 0.5;
      const px = Math.cos(a) * rr * du, py = Math.sin(a) * rr * dv;
      const dotR = rand(1.8, 4.6) * (S / 1024);
      ctx.globalAlpha = strength * rand(0.35, 0.8) * (1 - rr * 0.45);
      for (const wrap of [-S, 0, S]) {   // u seam duplication
        const x = cx + px + wrap;
        if (x < -8 || x > S + 8) continue;
        ctx.beginPath();
        ctx.arc(x, cy + py, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.paintDirty = true;
  }

  computeCoverage() {
    const c = this.covCtx, N = 64;
    c.clearRect(0, 0, N, N);
    c.drawImage(this.canvas, 0, 0, N, N);
    const data = c.getImageData(0, 0, N, N).data;
    let sum = 0, wsum = 0;
    for (let y = 0; y < N; y++) {
      const v = 1 - y / (N - 1);
      const rIdx = Math.round(v * (this.radiusByV.length - 1));
      const w = Math.max(this.radiusByV[rIdx], 0.004);   // area weight ∝ local radius
      for (let x = 0; x < N; x++) {
        const a = data[(y * N + x) * 4 + 3] / 255;
        sum += w * Math.min(a * 1.25, 1);
        wsum += w;
      }
    }
    this.coverage = sum / wsum;
    return this.coverage;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.paintTex.dispose();
  }
}

// ---------------------------------------------------------------------------
// spray gun (gravity-feed culinary sprayer) + chef's gloved hand
// ---------------------------------------------------------------------------
function buildGun() {
  const gun = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f7f68, metalness: 0.75, roughness: 0.34 });
  const aluMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1.0, roughness: 0.28 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a24f, metalness: 1.0, roughness: 0.3 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x252527, metalness: 0.1, roughness: 0.85 });

  // main body: horizontal barrel with chamfered nose
  const bodyPts = [
    new THREE.Vector2(0.0005, 0), new THREE.Vector2(0.016, 0), new THREE.Vector2(0.021, 0.006),
    new THREE.Vector2(0.023, 0.02), new THREE.Vector2(0.023, 0.075), new THREE.Vector2(0.02, 0.09),
    new THREE.Vector2(0.013, 0.098), new THREE.Vector2(0.0005, 0.1),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 28), bodyMat);
  body.rotation.x = -Math.PI / 2;     // lathe +y axis → -z (muzzle points forward)
  body.position.z = 0.01;
  gun.add(body);

  // nozzle: air cap + brass tip
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.02, 20), aluMat);
  cap.rotation.x = Math.PI / 2; cap.position.z = -0.098;
  gun.add(cap);
  const horn1 = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 10), aluMat);
  horn1.position.set(0.013, 0, -0.104);
  const horn2 = horn1.clone(); horn2.position.x = -0.013;
  gun.add(horn1, horn2);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.007, 0.014, 14), brassMat);
  tip.rotation.x = Math.PI / 2; tip.position.z = -0.112;
  gun.add(tip);

  // gravity cup on top (aluminium, with lid)
  const cupPts = [
    new THREE.Vector2(0.0005, 0), new THREE.Vector2(0.012, 0), new THREE.Vector2(0.02, 0.008),
    new THREE.Vector2(0.033, 0.05), new THREE.Vector2(0.034, 0.085), new THREE.Vector2(0.031, 0.088),
    new THREE.Vector2(0.03, 0.083), new THREE.Vector2(0.0005, 0.083),
  ];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 28), aluMat);
  cup.position.set(0, 0.022, -0.055);
  gun.add(cup);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.033, 0.012, 28), aluMat);
  lid.position.set(0, 0.117, -0.055);
  gun.add(lid);
  const lidKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.01, 14), rubberMat);
  lidKnob.position.set(0, 0.128, -0.055);
  gun.add(lidKnob);

  // grip (angled, rubber-wrapped, chamfered via capsule-ish box stack)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.078, 0.028), rubberMat);
  grip.geometry.translate(0, -0.038, 0);
  grip.position.set(0, -0.005, 0.026);
  grip.rotation.x = -0.35;
  gun.add(grip);
  const gripBase = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.05), bodyMat);
  gripBase.position.set(0, -0.005, 0.02);
  gun.add(gripBase);

  // trigger (animates when spraying)
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.034, 0.007), aluMat);
  trigger.geometry.translate(0, -0.017, 0);
  trigger.position.set(0, -0.008, -0.03);
  trigger.rotation.x = 0.15;
  gun.add(trigger);

  // air-hose stub at grip bottom
  const hoseNut = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.014, 10), brassMat);
  hoseNut.position.set(0, -0.082, 0.056);
  hoseNut.rotation.x = -0.35;
  gun.add(hoseNut);
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.088, 0.058), new THREE.Vector3(0.015, -0.15, 0.09),
    new THREE.Vector3(0.06, -0.24, 0.16), new THREE.Vector3(0.16, -0.3, 0.26),
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 24, 0.004, 10), rubberMat);
  gun.add(hose);

  // --- chef's gloved hand wrapping the grip (simplified but shaded) ---
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xf1f0ea, roughness: 0.8 });
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.021, 18, 14), gloveMat);
  palm.scale.set(0.95, 1.5, 0.85);
  palm.position.set(0.008, -0.036, 0.03);
  hand.add(palm);
  for (let i = 0; i < 4; i++) {   // fingers wrapping the grip toward the trigger
    const f = new THREE.Group();
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0058, 0.017, 6, 10), gloveMat);
    seg1.rotation.x = Math.PI / 2;
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0053, 0.012, 6, 10), gloveMat);
    seg2.rotation.x = Math.PI / 2 + 1.0;
    seg2.position.set(0, -0.006, -0.017);
    f.add(seg1, seg2);
    f.position.set(0.007, -0.02 - i * 0.0135, 0.012 - i * 0.004);
    f.rotation.y = -0.18;
    hand.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.02, 6, 10), gloveMat);
  thumb.rotation.set(0.5, 0, -0.9);
  thumb.position.set(0.02, -0.024, 0.046);
  hand.add(thumb);
  // sleeve (chef's white jacket cuff) trailing down toward the lower-right, off frame
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.046, 0.22, 18), gloveMat);
  sleeve.position.set(0.1, -0.15, 0.1);
  sleeve.rotation.set(0.55, 0, -0.8);
  hand.add(sleeve);
  gun.add(hand);

  gun.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  gun.scale.setScalar(0.88);
  return { gun, trigger };
}

// ---------------------------------------------------------------------------
// spray particles + mist cone + cold vapour + finale sparkles
// ---------------------------------------------------------------------------
class SprayParticles {
  constructor(scene, count = 480) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);       // 0 = dead
    this.maxLife = new Float32Array(count);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.alpha = new Float32Array(count);
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.PointsMaterial({
      size: 0.0085, color: 0x6b4226, transparent: true, opacity: 0.85,
      depthWrite: false, sizeAttenuation: true, map: TEX.blob,
    });
    this.mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );');
    };
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    scene.add(this.points);
  }
  setColor(hex) { this.mat.color.set(hex); }
  emit(origin, dir, speed, n) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.count;
      const j = i * 3;
      this.pos[j] = origin.x + rand(-0.002, 0.002);
      this.pos[j + 1] = origin.y + rand(-0.002, 0.002);
      this.pos[j + 2] = origin.z + rand(-0.002, 0.002);
      // cone spread ±9°
      const spread = 0.16;
      const vx = dir.x + rand(-spread, spread), vy = dir.y + rand(-spread, spread), vz = dir.z + rand(-spread, spread);
      const s = speed * rand(0.75, 1.15);
      const inv = s / Math.hypot(vx, vy, vz);
      this.vel[j] = vx * inv; this.vel[j + 1] = vy * inv; this.vel[j + 2] = vz * inv;
      this.maxLife[i] = this.life[i] = rand(0.1, 0.2);
      this.alpha[i] = 1;
    }
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const j = i * 3;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += (this.vel[j + 1] - 0.4 * (this.maxLife[i] - this.life[i])) * dt; // slight gravity
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.vel[j] *= 0.985; this.vel[j + 1] *= 0.985; this.vel[j + 2] *= 0.985;
      this.alpha[i] = clamp(this.life[i] / this.maxLife[i], 0, 1) * 0.9;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}
const spray = new SprayParticles(scene);

// translucent mist cone between nozzle and surface (volume feel)
const mistCone = new THREE.Mesh(
  new THREE.ConeGeometry(0.035, 1, 20, 1, true),
  new THREE.MeshBasicMaterial({
    map: TEX.blob, transparent: true, opacity: 0.0, depthWrite: false,
    color: 0x8a6a4f, side: THREE.DoubleSide, blending: THREE.NormalBlending,
  })
);
mistCone.frustumCulled = false;
scene.add(mistCone);

// cold vapour drifting off the frozen entremet
const vapours = [];
{
  const vapMat = new THREE.SpriteMaterial({ map: TEX.blob, color: 0xdfe8ee, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(vapMat.clone());
    s.scale.setScalar(rand(0.06, 0.13));
    s.userData = { a: rand(0, Math.PI * 2), r: rand(0.05, 0.1), spd: rand(0.15, 0.3), ph: rand(0, 10) };
    scene.add(s);
    vapours.push(s);
  }
}

// finale sparkles
class Sparkles {
  constructor() {
    this.group = new THREE.Group();
    this.items = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX.sparkle, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0xffe9b0,
      }));
      sp.scale.setScalar(0.02);
      this.group.add(sp);
      this.items.push({ sp, seed: Math.random() * 10 });
    }
    scene.add(this.group);
    this.active = false;
  }
  update(t) {
    for (const it of this.items) {
      const ph = t * 1.3 + it.seed * 7;
      const cyc = (ph % 2) / 2;
      const a = it.seed * 39.7;
      const r = 0.085 + (it.seed % 0.3) * 0.15;
      it.sp.position.set(Math.cos(a + t * 0.3) * r, 1.06 + (it.seed % 0.5) * 0.36 + cyc * 0.03, Math.sin(a + t * 0.3) * r);
      const tw = Math.max(0, Math.sin(cyc * Math.PI));
      it.sp.material.opacity = this.active ? tw * 0.9 : 0;
      it.sp.scale.setScalar(0.008 + tw * 0.022);
    }
  }
}
const sparkles = new Sparkles();

// ---------------------------------------------------------------------------
// game state
// ---------------------------------------------------------------------------
const VELVET_COLORS = [
  { hex: 0x4a2a17, css: '#4a2a17', name: 'チョコ' },
  { hex: 0xc76a86, css: '#c76a86', name: 'いちご' },
  { hex: 0x7fa065, css: '#7fa065', name: 'ピスタチオ' },
  { hex: 0xe0aa4e, css: '#e0aa4e', name: 'マンゴー' },
];
let colorIdx = 0;
let cake = null;
let cakeCount = 0;
let state = 'start';         // start | play | reveal | done
let plateAngle = 0, plateVel = 0, plateHold = 0;
let sprayingPtr = null, rotatePtr = null, rotateLastX = 0;
let aimPoint = new THREE.Vector3(), aimNormal = new THREE.Vector3(0, 0, 1), aimValid = false, aimOnCake = false;
let aimUV = new THREE.Vector2();
let revealT = 0;
let starsLit = 0;
let lastCovCheck = 0;
let firstSprayDone = false;

const { gun, trigger } = buildGun();
gun.position.set(0.09, 1.1, 0.46);
gun.visible = false;
scene.add(gun);
let gunTargetPos = gun.position.clone();
let gunShown = 0; // 0..1 ease in

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function newCake() {
  if (cake) { plateGroup.remove(cake.mesh); cake.dispose(); }
  const shapeIdx = cakeCount % CAKE_SHAPES.length;
  cake = new Cake(shapeIdx, GLAZE_COLORS[cakeCount % GLAZE_COLORS.length]);
  plateGroup.add(cake.mesh);
  cakeCount++;
  starsLit = 0;
  updateMeter(0);
  document.querySelectorAll('.star').forEach(s => s.classList.remove('lit'));
  toast('つめたい ケーキが きたよ！ ❄️');
  for (const s of vapours) s.material.opacity = 0.16;
}

// ---------------------------------------------------------------------------
// HUD wiring
// ---------------------------------------------------------------------------
const meterFill = document.getElementById('meterFill');
const paletteEl = document.getElementById('palette');
const hintEl = document.getElementById('hint');
const toastEl = document.getElementById('toast');
let toastTimer = 0;

VELVET_COLORS.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'swatch' + (i === 0 ? ' sel' : '');
  b.style.background = `radial-gradient(circle at 35% 30%, ${lighten(c.css, 40)}, ${c.css} 60%, ${darken(c.css, 25)})`;
  b.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    colorIdx = i;
    document.querySelectorAll('.swatch').forEach((s, j) => s.classList.toggle('sel', j === i));
    spray.setColor(c.hex);
    mistCone.material.color.set(c.hex).multiplyScalar(1.15);
    sfx.ensure(); sfx.blip(520 + i * 90, 0.08, 0.15);
  });
  paletteEl.appendChild(b);
});
function lighten(hex, amt) { return shade(hex, amt); }
function darken(hex, amt) { return shade(hex, -amt); }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
spray.setColor(VELVET_COLORS[0].hex);
mistCone.material.color.set(VELVET_COLORS[0].hex).multiplyScalar(1.15);

function updateMeter(cov) {
  const pct = clamp(cov / 0.88, 0, 1) * 100;
  meterFill.style.width = pct + '%';
  const c = VELVET_COLORS[colorIdx];
  meterFill.style.background = `linear-gradient(180deg, ${lighten(c.css, 30)}, ${c.css})`;
  const th = [0.3, 0.6, 0.87];
  for (let i = 0; i < 3; i++) {
    if (cov >= th[i] && starsLit <= i) {
      starsLit = i + 1;
      document.getElementById('star' + (i + 1)).classList.add('lit');
      sfx.star();
    }
  }
}
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 2600);
}

document.getElementById('startBtn').addEventListener('pointerup', () => {
  sfx.ensure(); sfx.blip(700, .1, .2);
  const ov = document.getElementById('startOv');
  ov.style.opacity = 0; ov.style.pointerEvents = 'none';
  setTimeout(() => ov.remove(), 600);
  state = 'play';
  gun.visible = true;
});
document.getElementById('nextBtn').addEventListener('pointerup', () => {
  sfx.ensure(); sfx.blip(700, .1, .2);
  const ov = document.getElementById('finishOv');
  ov.classList.remove('show'); ov.style.pointerEvents = 'none';
  sparkles.active = false;
  revealSpot.intensity = 0;
  keyLight.intensity = 3.0;
  hemi.intensity = 0.34;
  fillLight.intensity = 0.38;
  scene.environmentIntensity = 0.72;
  state = 'play';
  gun.visible = true;
  newCake();
});

// rotate buttons (hold to spin)
for (const [id, dir] of [['rotL', 1], ['rotR', -1]]) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); plateHold = dir; sfx.ensure(); };
  const off = () => { plateHold = 0; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}

// ---------------------------------------------------------------------------
// input on the 3D canvas — one finger sprays, a drag low on screen spins
// ---------------------------------------------------------------------------
const cv = renderer.domElement;
cv.style.touchAction = 'none';

function setNDC(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
const plateHitProxy = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.2, 0.08, 24),
  new THREE.MeshBasicMaterial({ visible: false })
);
plateHitProxy.position.set(0, COUNTER_Y + 0.1, 0);
scene.add(plateHitProxy);
// big invisible aim sphere so the gun keeps tracking even off the cake
const aimProxy = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 24, 16),
  new THREE.MeshBasicMaterial({ visible: false })
);
aimProxy.position.copy(CAKE_C);
scene.add(aimProxy);

cv.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return;
  sfx.ensure();
  setNDC(e);
  raycaster.setFromCamera(ndc, camera);
  // low band of the screen OR the turntable rim = spin drag
  const hitPlate = raycaster.intersectObject(plateHitProxy)[0];
  const lowBand = e.clientY > window.innerHeight * 0.82;
  const hitCake = cake && raycaster.intersectObject(cake.mesh)[0];
  if ((lowBand || (hitPlate && !hitCake)) && rotatePtr === null) {
    rotatePtr = e.pointerId; rotateLastX = e.clientX;
    return;
  }
  if (sprayingPtr === null) {
    sprayingPtr = e.pointerId;
    updateAim(e);
    sfx.hiss(true);
    if (!firstSprayDone) { firstSprayDone = true; hintEl.style.opacity = 0; setTimeout(() => hintEl.remove(), 600); }
  }
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === sprayingPtr) updateAim(e);
  else if (e.pointerId === rotatePtr) {
    const dx = e.clientX - rotateLastX;
    rotateLastX = e.clientX;
    plateVel += dx * 0.00045 * 60;
  }
});
function endPtr(e) {
  if (e.pointerId === sprayingPtr) { sprayingPtr = null; sfx.hiss(false); }
  if (e.pointerId === rotatePtr) rotatePtr = null;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);

function updateAim(e) {
  setNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = cake && raycaster.intersectObject(cake.mesh)[0];
  if (hit) {
    aimPoint.copy(hit.point);
    aimNormal.copy(hit.face.normal).transformDirection(cake.mesh.matrixWorld);
    aimUV.copy(hit.uv);
    aimValid = true; aimOnCake = true;
  } else {
    const hit2 = raycaster.intersectObject(aimProxy)[0];
    if (hit2) {
      aimPoint.copy(hit2.point);
      aimNormal.copy(hit2.point).sub(CAKE_C).normalize();
      aimValid = true;
    }
    aimOnCake = false;
  }
}

// ---------------------------------------------------------------------------
// reveal sequence
// ---------------------------------------------------------------------------
function startReveal() {
  state = 'reveal';
  revealT = 0;
  sprayingPtr = null; sfx.hiss(false);
  sfx.fanfare();
  sparkles.active = true;
  toast('よこから ひかりを あててみよう ✨');
}

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const camBase = new THREE.Vector3();
let camSway = 0;
let frameNo = 0;

const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _nozzleWorld = new THREE.Vector3();
const _sprayDir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // ---- turntable spin ----
  if (plateHold !== 0) plateVel = lerp(plateVel, plateHold * 2.4, 0.12);
  plateVel *= 0.945;
  if (state === 'reveal' || state === 'done') plateVel = lerp(plateVel, 0.55, 0.03);
  plateAngle += plateVel * dt * (state === 'play' ? 60 * 0.016 : 1) * (state === 'play' ? 1 : 1);
  plateGroup.rotation.y = plateAngle;

  // ---- spraying ----
  const spraying = state === 'play' && sprayingPtr !== null && aimValid;
  if (spraying) {
    // gun placement: hover off the surface, nozzle aimed at the hit point
    _dir.copy(aimNormal); _dir.y = Math.max(_dir.y * 0.35, -0.1);
    _dir.normalize();
    _side.crossVectors(_up, _dir).normalize();
    // hold the gun off the surface to the lower-right of the aim point; keep it clear of the cake
    gunTargetPos.copy(aimPoint)
      .addScaledVector(_dir, 0.2)
      .addScaledVector(_up, 0.03)
      .addScaledVector(_side, 0.06);
    gunTargetPos.y = Math.max(gunTargetPos.y, COUNTER_Y + 0.16);
  } else {
    // rest pose: lower right, muzzle toward the cake, partly in frame so kids see it waiting
    gunTargetPos.set(0.09, 1.1, 0.46);
  }
  gun.position.lerp(gunTargetPos, 1 - Math.pow(0.0018, dt));
  // orient: -z toward aim
  _m.lookAt(gun.position, aimValid ? aimPoint : CAKE_C, _up);
  _q.setFromRotationMatrix(_m);
  gun.quaternion.slerp(_q, 1 - Math.pow(0.0025, dt));
  gunShown = lerp(gunShown, gun.visible ? 1 : 0, 0.1);

  // trigger animation + recoil buzz
  trigger.rotation.x = lerp(trigger.rotation.x, spraying ? -0.1 : 0.15, 0.25);
  if (spraying) gun.position.y += Math.sin(t * 90) * 0.0004;

  // nozzle world pos
  _nozzleWorld.set(0, 0, -0.115).applyMatrix4(gun.matrixWorld);

  if (spraying) {
    _sprayDir.copy(aimPoint).sub(_nozzleWorld).normalize();
    spray.emit(_nozzleWorld, _sprayDir, 2.3, 18);
    // mist cone from nozzle to surface
    const dist = _nozzleWorld.distanceTo(aimPoint);
    mistCone.material.opacity = lerp(mistCone.material.opacity, 0.22 + Math.sin(t * 47) * 0.04, 0.3);
    mistCone.scale.set(1, dist, 1);
    mistCone.position.copy(_nozzleWorld).addScaledVector(_sprayDir, dist * 0.5);
    _dir.copy(_sprayDir).negate();          // cone apex (+y) at the nozzle, base at the cake
    _q.setFromUnitVectors(_up, _dir);
    mistCone.quaternion.copy(_q);
    // paint
    if (aimOnCake && cake) {
      const c = VELVET_COLORS[colorIdx];
      cake.splat(aimUV.x, aimUV.y, c.css, 0.85, 0.021);
      cake.splat(aimUV.x, aimUV.y, c.css, 0.4, 0.034);
    }
  } else {
    mistCone.material.opacity = lerp(mistCone.material.opacity, 0, 0.2);
  }

  // throttle paint-texture uploads to every other frame while the finger is down
  frameNo++;
  if (cake && cake.paintDirty && (!spraying || (frameNo & 1) === 0)) {
    cake.paintTex.needsUpdate = true; cake.paintDirty = false;
  }

  // coverage check (throttled)
  if (state === 'play' && cake && t - lastCovCheck > 0.45) {
    lastCovCheck = t;
    if (cake.paintTex.needsUpdate || spraying || cake.coverage > 0) {
      const cov = cake.computeCoverage();
      updateMeter(cov);
      if (cov >= 0.875) startReveal();
    }
  }

  spray.update(dt);

  // cold vapour
  for (const s of vapours) {
    const u = s.userData;
    const ph = (t * u.spd + u.ph) % 1;
    s.position.set(
      Math.cos(u.a + t * 0.2) * u.r,
      CAKE_C.y - 0.02 + ph * 0.12,
      Math.sin(u.a + t * 0.2) * u.r
    );
    const fade = cake ? (1 - cake.coverage * 0.9) : 1;
    s.material.opacity = Math.sin(ph * Math.PI) * 0.15 * fade;
  }

  // ---- reveal cinematics ----
  if (state === 'reveal' || state === 'done') {
    revealT += dt;
    const k = clamp(revealT / 2.2, 0, 1);
    keyLight.intensity = lerp(3.0, 0.4, k);
    hemi.intensity = lerp(0.34, 0.12, k);
    fillLight.intensity = lerp(0.38, 0.08, k);
    scene.environmentIntensity = lerp(0.72, 0.22, k);
    revealSpot.intensity = lerp(0, 42, k);
    // low side-light sweeping around the cake — velvet nap catches the grazing light
    const az = -0.9 + Math.sin(revealT * 0.45) * 1.15;
    revealSpot.position.set(Math.sin(az) * 0.62, CAKE_C.y + 0.1, Math.cos(az) * 0.62);
    sparkles.update(t);
    if (state === 'reveal' && revealT > 2.8) {
      state = 'done';
      gun.visible = false;
      const ov = document.getElementById('finishOv');
      ov.classList.add('show'); ov.style.pointerEvents = 'auto';
    }
    // slow celebratory dolly
    camera.position.x = camBase.x + Math.sin(revealT * 0.3) * 0.05;
    camera.lookAt(CAKE_C.x, CAKE_C.y + 0.01, CAKE_C.z);
  } else {
    // subtle handheld sway
    camSway = t;
    camera.position.x = camBase.x + Math.sin(camSway * 0.5) * 0.004 + Math.sin(camSway * 1.7) * 0.0015;
    camera.position.y = camBase.y + Math.sin(camSway * 0.8) * 0.003;
    camera.lookAt(CAKE_C.x, CAKE_C.y + 0.01, CAKE_C.z);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  frameCamera();
  camBase.copy(camera.position);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
camBase.copy(camera.position);

newCake();
window.__game_ok = true;
window.__debug = { get cake() { return cake; }, startReveal, newCake, scene, camera };
animate();
