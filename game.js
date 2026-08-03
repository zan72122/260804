// ぴかぴかレールごう — 4歳向けレール削正車あそび
// カタカタ(みつける) → ガコン(といしをおろす) → シャーッ(けずる) → スーッ(しずかにはしる)
import * as THREE from './vendor/three.module.min.js';

/* ================= 基本セットアップ ================= */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const DAY_SKY = new THREE.Color(0xbfe6f7);
const DUSK_SKY = new THREE.Color(0x4a5a9c);
scene.background = DAY_SKY.clone();
scene.fog = new THREE.Fog(scene.background, 26, 46);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

const hemi = new THREE.HemisphereLight(0xfff6e6, 0x9db87a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(6, 12, 4);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe4ff, 0.5);
fill.position.set(-7, 6, -6);
scene.add(fill);

/* ================= 小道具 ================= */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const TAU = Math.PI * 2;

// タイムライン小助手（待ち時間ではなく演出用の逐次処理）
const tasks = [];
function after(sec, fn) { tasks.push({ t: 0, dur: sec, fn: null, done: fn }); }
function tween(dur, fn, done) { tasks.push({ t: 0, dur, fn, done }); }
function updateTasks(dt) {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const k = tasks[i];
    k.t += dt;
    const p = clamp(k.t / k.dur, 0, 1);
    if (k.fn) k.fn(p);
    if (k.t >= k.dur) { tasks.splice(i, 1); if (k.done) k.done(); }
  }
}

/* ================= 線路（ループ曲線） ================= */
const CENTER = new THREE.Vector3(0, 0, 0);
const loopPts = [];
{
  const RX = 6.6, RZ = 4.3;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const wob = 1 + 0.045 * Math.sin(a * 3 + 1.2);
    loopPts.push(new THREE.Vector3(Math.cos(a) * RX * wob, 0, Math.sin(a) * RZ * wob));
  }
}
const curve = new THREE.CatmullRomCurve3(loopPts, true, 'centripetal');
const N = 1200;                       // 曲線の分割数（リング数）
const P = curve.getSpacedPoints(N);   // P[0]..P[N], P[N]≈P[0]
const TAN = [], LEFT = [];
for (let i = 0; i <= N; i++) {
  const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
  const t = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
  TAN.push(t);
  LEFT.push(new THREE.Vector3(t.z, 0, -t.x)); // 進行方向左手
}
let LOOP_LEN = 0;
for (let i = 0; i < N; i++) LOOP_LEN += P[i].distanceTo(P[i + 1]);

const _sp = new THREE.Vector3(), _st = new THREE.Vector3(), _sl = new THREE.Vector3();
function sampleAt(u, out) { // out: {pos,tan,left}
  u = ((u % 1) + 1) % 1;
  const f = u * N, i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, k = f - Math.floor(f);
  out.pos.lerpVectors(P[i0], P[i1], k);
  out.tan.lerpVectors(TAN[i0], TAN[i1], k).normalize();
  out.left.set(out.tan.z, 0, -out.tan.x);
  return out;
}
const mkSample = () => ({ pos: new THREE.Vector3(), tan: new THREE.Vector3(), left: new THREE.Vector3() });
function deltaU(a, b) { return ((b - a + 1.5) % 1) - 0.5; } // aからbへの符号付き最短距離
function worldToDu(w) { return w / LOOP_LEN; }

/* ================= レール本体（波打ち＋研磨で銀色） ================= */
const GAUGE = 0.52;
const RAIL_BASE = 0.10, RAIL_H = 0.105;
const RAIL_TOP = RAIL_BASE + RAIL_H;
// レール断面（I形の面影、外周を一周）: [横, 高さ]
const PROF = [
  [-0.052, 0.000], [0.052, 0.000], [0.052, 0.026], [0.026, 0.048],
  [0.026, 0.066], [0.047, 0.080], [0.047, 0.105], [-0.047, 0.105],
  [-0.047, 0.080], [-0.026, 0.066], [-0.026, 0.048], [-0.052, 0.026],
];
const PROF_N = PROF.length;
const PROF_SHADE = PROF.map(([, y]) => 0.72 + 0.28 * (y / RAIL_H)); // 下ほど暗く

const polish = new Float32Array(N);   // 0..1 リングごとの研磨度
polish.fill(1);                        // 最初は全体ぴかぴか、ゾーンだけ荒れる
let zone = { u0: 0.16, len: 0.12 };   // 波打ちゾーン
const WAVE_BUMPS = 9, WAVE_AMP = 0.052;
let waveGrow = 1;                      // 夜のうちに波が育つ演出用 0→1

function zoneS(u) { const s = ((u - zone.u0 + 1) % 1); return s < zone.len ? s / zone.len : -1; }
function waveEnv(u) { const s = zoneS(u); return s < 0 ? 0 : smoothstep(0, 0.16, s) * smoothstep(1, 0.84, s); }
function ringDy(i) {
  const u = i / N, env = waveEnv(u);
  if (env === 0) return 0;
  const s = zoneS(u);
  return WAVE_AMP * waveGrow * env * (1 - polish[i]) * Math.sin(s * WAVE_BUMPS * TAU);
}

const COL_SILVER = new THREE.Color(0xeef3fb);
const COL_DULL = new THREE.Color(0x8e8a84);
const COL_RUST = new THREE.Color(0x9c5f33);
const _c = new THREE.Color();
function ringColor(i, out) {
  const u = i / N, env = waveEnv(u), p = polish[i];
  out.copy(COL_DULL).lerp(COL_SILVER, p * p * 0.9 + p * 0.1);
  if (env > 0) out.lerp(COL_RUST, env * (1 - p) * 0.85 * waveGrow);
  return out;
}

const rails = []; // {mesh, posAttr, colAttr}
function buildRail(side) {
  const rings = N + 1;
  const pos = new Float32Array(rings * PROF_N * 3);
  const col = new Float32Array(rings * PROF_N * 3);
  const idx = [];
  const s = mkSample();
  for (let i = 0; i < rings; i++) {
    sampleAt(i / N, s);
    const dy = ringDy(i % N);
    ringColor(i % N, _c);
    for (let k = 0; k < PROF_N; k++) {
      const o = (i * PROF_N + k) * 3;
      pos[o] = s.pos.x + s.left.x * (side * GAUGE / 2 + PROF[k][0]);
      pos[o + 1] = RAIL_BASE + PROF[k][1] + dy;
      pos[o + 2] = s.pos.z + s.left.z * (side * GAUGE / 2 + PROF[k][0]);
      const sh = PROF_SHADE[k];
      col[o] = _c.r * sh; col[o + 1] = _c.g * sh; col[o + 2] = _c.b * sh;
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < PROF_N; k++) {
    const k2 = (k + 1) % PROF_N;
    const a = i * PROF_N + k, b = i * PROF_N + k2, c2 = (i + 1) * PROF_N + k, d = (i + 1) * PROF_N + k2;
    idx.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0xbfd4e8 });
  const mesh = new THREE.Mesh(g, m);
  scene.add(mesh);
  rails.push({ mesh, posAttr: g.getAttribute('position'), colAttr: g.getAttribute('color') });
}
buildRail(-1); buildRail(1);

function refreshRings(i0, i1) { // 両閉区間 (u順, wrap対応) の位置と色を更新
  const list = [];
  const span = ((i1 - i0 + N) % N);
  for (let d = 0; d <= span; d++) list.push((i0 + d) % N);
  for (const r of rails) {
    const pa = r.posAttr.array, ca = r.colAttr.array;
    for (const i of list) {
      const dy = ringDy(i);
      ringColor(i, _c);
      for (const ri of (i === 0 ? [0, N] : [i])) {
        for (let k = 0; k < PROF_N; k++) {
          const o = (ri * PROF_N + k) * 3;
          pa[o + 1] = RAIL_BASE + PROF[k][1] + dy;
          const sh = PROF_SHADE[k];
          ca[o] = _c.r * sh; ca[o + 1] = _c.g * sh; ca[o + 2] = _c.b * sh;
        }
      }
    }
    r.posAttr.needsUpdate = true; r.colAttr.needsUpdate = true;
  }
}
function refreshZone(pad = 0.02) {
  refreshRings(Math.floor(((zone.u0 - pad) % 1 + 1) % 1 * N), Math.ceil(((zone.u0 + zone.len + pad) % 1) * N) % N);
}

/* ================= 枕木・バラスト・地面 ================= */
// カメラをふさぐ木や丘はふわっと小さくなる
const occluders = [];
{
  const tieGeo = new THREE.BoxGeometry(0.16, 0.055, 0.86);
  const tieMat = new THREE.MeshLambertMaterial({ color: 0xc98d5e });
  const nTies = 150;
  const ties = new THREE.InstancedMesh(tieGeo, tieMat, nTies);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const s = mkSample(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < nTies; i++) {
    sampleAt(i / nTies, s);
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), s.tan);
    m4.compose(new THREE.Vector3(s.pos.x, 0.075, s.pos.z), q, sc);
    ties.setMatrixAt(i, m4);
  }
  scene.add(ties);

  // バラスト（線路の座布団）
  const bw = 0.85;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const st = mkSample();
  for (let i = 0; i <= N; i++) {
    sampleAt(i / N, st);
    const o = i * 6;
    pos[o] = st.pos.x + st.left.x * bw; pos[o + 1] = 0.05; pos[o + 2] = st.pos.z + st.left.z * bw;
    pos[o + 3] = st.pos.x - st.left.x * bw; pos[o + 4] = 0.05; pos[o + 5] = st.pos.z - st.left.z * bw;
  }
  const idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xd8c3ae })));

  // 地面（フェルトの丘）
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(19, 48).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x9fd58a })
  );
  ground.position.y = -0.01;
  scene.add(ground);
  const hillMat = new THREE.MeshLambertMaterial({ color: 0xb2df9b });
  [[-9.5, -7.5, 3.2], [10, -6, 2.6], [9, 7.5, 3.4], [-10, 7, 2.4]].forEach(([x, z, r]) => {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), hillMat);
    h.scale.y = 0.42; h.position.set(x, 0, z); scene.add(h);
    occluders.push({ obj: h, r: r * 0.9, baseSy: 0.42, k: 1 });
  });
}

// 木・お花・くも
const bobbles = [];
{
  const trunkG = new THREE.CylinderGeometry(0.09, 0.12, 0.5, 8);
  const leafG = new THREE.SphereGeometry(0.42, 12, 10);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0xa2795a });
  const leafColors = [0x7ecb7a, 0x98d97e, 0x6fbf8f, 0xffb7c9];
  const treeSpots = [[-8.3, -3], [-7.6, 2.8], [-3.5, -6.1], [2.8, -6.3], [7.9, -3.4], [8.4, 2.6], [3.6, 6.4], [-2.6, 6.5], [0.4, -7.6], [-5.9, 5.6]];
  for (const [x, z] of treeSpots) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(trunkG, trunkM); t.position.y = 0.25; g.add(t);
    const l = new THREE.Mesh(leafG, new THREE.MeshLambertMaterial({ color: leafColors[Math.floor(rand(leafColors.length))] }));
    l.position.y = 0.75; l.scale.setScalar(rand(0.8, 1.25)); g.add(l);
    g.position.set(x, 0, z); g.rotation.y = rand(TAU);
    scene.add(g); bobbles.push(g);
    occluders.push({ obj: g, r: 1.0, baseSy: 1, k: 1 });
  }
  const dotG = new THREE.SphereGeometry(0.07, 8, 6);
  const dots = new THREE.InstancedMesh(dotG, new THREE.MeshLambertMaterial(), 60);
  const m4 = new THREE.Matrix4(); const col = new THREE.Color();
  const pal = [0xff8fab, 0xffd166, 0x9bd1ff, 0xffffff, 0xc9a6ff];
  for (let i = 0; i < 60; i++) {
    const a = rand(TAU), r = rand(1.5, 18);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.75;
    m4.makeTranslation(x, 0.06, z);
    dots.setMatrixAt(i, m4);
    dots.setColorAt(i, col.setHex(pal[i % pal.length]));
  }
  scene.add(dots);
}
const clouds = [];
{
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let ci = 0; ci < 4; ci++) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 0.9), 10, 8), cm);
      b.position.set(i * 0.7 - 0.7, rand(-0.1, 0.15), rand(-0.2, 0.2));
      g.add(b);
    }
    g.position.set(rand(-10, 10), rand(4.5, 6.5), rand(-8, 4));
    scene.add(g); clouds.push(g);
  }
}

// 駅（ミント号のおうち）
const U_STATION = 0.62;
{
  const s = mkSample(); sampleAt(U_STATION, s);
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 0.8), new THREE.MeshLambertMaterial({ color: 0xf3e3c8 }));
  base.position.y = 0.12; g.add(base);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.9), new THREE.MeshLambertMaterial({ color: 0xff9db5 }));
  roof.position.y = 1.05; g.add(roof);
  [[-0.9], [0.9]].forEach(([x]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    p.position.set(x, 0.6, 0); g.add(p);
  });
  const out = s.left.clone().multiplyScalar(-1.35);
  g.position.set(s.pos.x + out.x, 0, s.pos.z + out.z);
  g.rotation.y = Math.atan2(s.tan.x, s.tan.z) + Math.PI / 2;
  scene.add(g);
}

/* ================= テクスチャ（お顔・光） ================= */
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function faceTexture(happy) {
  return canvasTex(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#2b2b33'; ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 7; ctx.lineCap = 'round';
    if (!happy) {
      for (const x of [40, 88]) { ctx.beginPath(); ctx.arc(x, 52, 11, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#fff';
      for (const x of [44, 92]) { ctx.beginPath(); ctx.arc(x, 48, 3.5, 0, TAU); ctx.fill(); }
    } else {
      for (const x of [40, 88]) {
        ctx.beginPath(); ctx.arc(x, 56, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.arc(64, 74, 17, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
    ctx.fillStyle = '#ffb3c1';
    for (const x of [22, 106]) { ctx.beginPath(); ctx.arc(x, 74, 8, 0, TAU); ctx.fill(); }
  });
}
const FACE_NORMAL = faceTexture(false), FACE_HAPPY = faceTexture(true);
const glowTex = canvasTex(64, 64, (ctx) => {
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
});
const starTex = canvasTex(64, 64, (ctx) => {
  ctx.translate(32, 32); ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 9 : 26, a = (i / 10) * TAU - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
});

/* ================= 削正車（けずりゃんこ号） ================= */
const grinder = new THREE.Group();
scene.add(grinder);
const CAR_HALF = 0.85;
let grinderFace;
const stones = []; // {group, disc, down(0..1), spin, side, off}
{
  const bodyM = new THREE.MeshLambertMaterial({ color: 0xffc63c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.82), bodyM);
  body.position.y = 0.82; grinder.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.76), new THREE.MeshLambertMaterial({ color: 0xff9d3c }));
  cab.position.set(0.52, 1.26, 0); grinder.add(cab);
  const winM = new THREE.MeshLambertMaterial({ color: 0xcdeeff });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.6), winM);
  win.position.set(0.52, 1.32, 0); grinder.add(win);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.86), new THREE.MeshLambertMaterial({ color: 0xff5d73 }));
  roof.position.set(0.52, 1.5, 0); grinder.add(roof);
  const lampM = new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0xffe28a, emissiveIntensity: 0.7 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lampM);
  lamp.position.set(0.88, 0.98, 0); grinder.add(lamp);
  // おかお（前面）
  grinderFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: FACE_NORMAL, transparent: true })
  );
  grinderFace.position.set(0.867, 0.86, 0);
  grinderFace.rotation.y = Math.PI / 2;
  grinder.add(grinderFace);
  // 車輪（大きめ＝車体下に砥石が見える空間をつくる）
  const whG = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14).rotateX(Math.PI / 2);
  const whM = new THREE.MeshLambertMaterial({ color: 0x4a4a55 });
  for (const x of [-0.66, 0.66]) for (const z of [-0.31, 0.31]) {
    const w = new THREE.Mesh(whG, whM); w.position.set(x, 0.35, z); grinder.add(w);
  }
  // 台枠（細くして砥石が左右にはみ出して見える）
  const fr = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0x6b6b78 }));
  fr.position.y = 0.52; grinder.add(fr);
  // 砥石×3ペア（左右レール上）
  const armM = new THREE.MeshLambertMaterial({ color: 0x8a8a99 });
  const stoneM = new THREE.MeshLambertMaterial({ color: 0xf08a36 });
  const bandM = new THREE.MeshLambertMaterial({ color: 0x8a4f28 });
  for (let k = 0; k < 3; k++) {
    const off = (k - 1) * 0.52;
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.09), armM);
      arm.position.y = 0.22; g.add(arm);
      const disc = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18), stoneM);
      disc.add(st);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.035, 18), bandM);
      disc.add(band);
      const nub = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.025, 0.04), bandM);
      nub.position.y = 0.055; disc.add(nub);
      disc.position.y = -0.02; g.add(disc);
      g.position.set(off, 0.5, side * GAUGE / 2);
      grinder.add(g);
      stones.push({ group: g, disc, down: 0, spin: 0, side, off, pairIndex: k });
    }
  }
}
// 砥石ペアの上下（down 0=上 1=レールに接地、落下ストローク大きめ）
const STONE_UP_Y = 0.5;
const STONE_DOWN_Y = RAIL_TOP + 0.075;
function setStonePair(k, v) {
  for (const s of stones) if (s.pairIndex === k) {
    s.down = v;
    s.group.position.y = lerp(STONE_UP_Y, STONE_DOWN_Y, v);
  }
}

// ミント号（かくにん列車）
const mint = new THREE.Group();
scene.add(mint);
let mintFace;
{
  const bodyM = new THREE.MeshLambertMaterial({ color: 0xa8e6cf });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 0.74), bodyM);
  b.position.y = 0.6; mint.add(b);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.74), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  top.position.y = 0.96; mint.add(top);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 0.8), new THREE.MeshLambertMaterial({ color: 0xff9db5 }));
  roof.position.y = 1.1; mint.add(roof);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 10), new THREE.MeshLambertMaterial({ color: 0xff9db5 }));
  chim.position.set(0.35, 1.24, 0); mint.add(chim);
  mintFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.56),
    new THREE.MeshBasicMaterial({ map: FACE_NORMAL, transparent: true })
  );
  mintFace.position.set(0.579, 0.68, 0); mintFace.rotation.y = Math.PI / 2; mint.add(mintFace);
  const whG = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14).rotateX(Math.PI / 2);
  const whM2 = new THREE.MeshLambertMaterial({ color: 0x555566 });
  for (const x of [-0.38, 0.38]) for (const z of [-0.3, 0.3]) {
    const w = new THREE.Mesh(whG, whM2); w.position.set(x, 0.32, z); mint.add(w);
  }
  // 客車
  const coach = new THREE.Group();
  const cb = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.7), new THREE.MeshLambertMaterial({ color: 0xffd9e2 }));
  cb.position.y = 0.6; coach.add(cb);
  const cr = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.76), new THREE.MeshLambertMaterial({ color: 0xa8e6cf }));
  cr.position.y = 0.9; coach.add(cr);
  for (const x of [-0.3, 0.3]) for (const z of [-0.28, 0.28]) {
    const w = new THREE.Mesh(whG, whM2); w.position.set(x, 0.32, z); coach.add(w);
  }
  coach.position.x = -1.15;
  mint.add(coach);
}

// 車両を線路に置く（前後の車軸で向きを決める）
const _sA = mkSample(), _sB = mkSample();
function placeOnTrack(obj, u, axleDist, lateral = 0, yLift = 0, bounce = 0, roll = 0) {
  const d = worldToDu(axleDist);
  sampleAt(u + d, _sA); sampleAt(u - d, _sB);
  const mx = (_sA.pos.x + _sB.pos.x) / 2, mz = (_sA.pos.z + _sB.pos.z) / 2;
  const dirx = _sA.pos.x - _sB.pos.x, dirz = _sA.pos.z - _sB.pos.z;
  const yaw = Math.atan2(-dirz, dirx);
  sampleAt(u, _sl === undefined ? _sA : _sA); // keep
  const lx = _sA.left.x, lz = _sA.left.z;
  obj.position.set(mx + lx * lateral, yLift + bounce, mz + lz * lateral);
  obj.rotation.set(0, yaw, roll);
}

/* ================= 火花・星パーティクル ================= */
function makeParticles(count, tex, blending) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } },
    vertexShader: `
      attribute float psize; varying vec3 vC;
      void main(){ vC = color;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = psize * (240.0 / -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D map; varying vec3 vC;
      void main(){ vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vC * t.rgb, t.a); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const items = [];
  for (let i = 0; i < count; i++) items.push({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 0, r: 1, g: 1, b: 1, grav: 0, bounce: 0, fadeCol: null });
  return { pts, items, pos, col, size, head: 0, count };
}
const sparks = makeParticles(1100, glowTex, THREE.AdditiveBlending);
const starsP = makeParticles(300, starTex, THREE.NormalBlending);

function emit(sys, o) {
  const it = sys.items[sys.head]; sys.head = (sys.head + 1) % sys.count;
  Object.assign(it, { life: o.life, max: o.life, x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, s: o.s || 0.1, r: o.r, g: o.g, b: o.b, grav: o.grav || 0, bounce: o.bounce || 0, fadeCol: o.fadeCol || null });
}
function updateParticles(sys, dt) {
  const { items, pos, col, size } = sys;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.life > 0) {
      it.life -= dt;
      it.vy += it.grav * dt;
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
      if (it.bounce && it.y < 0.08 && it.vy < 0) { it.y = 0.08; it.vy *= -it.bounce; it.vx *= 0.7; it.vz *= 0.7; }
      const k = clamp(it.life / it.max, 0, 1);
      const o = i * 3;
      pos[o] = it.x; pos[o + 1] = it.y; pos[o + 2] = it.z;
      let r = it.r, g = it.g, b = it.b;
      if (it.fadeCol) { r = lerp(it.fadeCol[0], r, k); g = lerp(it.fadeCol[1], g, k); b = lerp(it.fadeCol[2], b, k); }
      col[o] = r; col[o + 1] = g; col[o + 2] = b;
      size[i] = it.s * (0.35 + 0.65 * k);
      if (it.life <= 0) { pos[o + 1] = -99; size[i] = 0; }
    }
  }
  sys.pts.geometry.getAttribute('position').needsUpdate = true;
  sys.pts.geometry.getAttribute('color').needsUpdate = true;
  sys.pts.geometry.getAttribute('psize').needsUpdate = true;
}
function goldSpark(x, y, z, dirx, dirz, speed, up = 0) {
  const sp = speed * rand(0.9, 2.0) + 0.8;
  emit(sparks, {
    x: x + rand(-0.03, 0.03), y: y + rand(0, 0.04), z: z + rand(-0.03, 0.03),
    vx: -dirx * sp + rand(-0.6, 0.6), vy: rand(0.5, 1.8) + up, vz: -dirz * sp + rand(-0.6, 0.6),
    life: rand(0.45, 1.1), s: rand(0.1, 0.22),
    r: 1, g: rand(0.8, 0.98), b: rand(0.3, 0.55), fadeCol: [0.85, 0.15, 0.05],
    grav: -4.2, bounce: 0.4,
  });
}
function whiteGlint(x, y, z) {
  emit(sparks, {
    x, y, z, vx: rand(-0.15, 0.15), vy: rand(0.4, 0.9), vz: rand(-0.15, 0.15),
    life: rand(0.4, 0.7), s: rand(0.12, 0.2), r: 1, g: 1, b: 0.95, grav: -0.6,
  });
}
function starBurst(x, y, z, n = 18, spread = 2.2) {
  const pal = [[1, 0.85, 0.3], [1, 0.6, 0.75], [0.6, 0.85, 1], [0.75, 1, 0.8], [1, 1, 1]];
  for (let i = 0; i < n; i++) {
    const c = pal[i % pal.length], a = rand(TAU);
    emit(starsP, {
      x, y: y + rand(0, 0.2), z,
      vx: Math.cos(a) * rand(0.3, spread), vy: rand(1, 2.6), vz: Math.sin(a) * rand(0.3, spread),
      life: rand(0.7, 1.3), s: rand(0.12, 0.24), r: c[0], g: c[1], b: c[2], grav: -2.6,
    });
  }
}

/* ================= 火花の帯（リボン） ================= */
function makeRibbon(maxPts) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(maxPts * 2 * 3);
  const col = new Float32Array(maxPts * 2 * 4);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('rcol', new THREE.BufferAttribute(col, 4));
  const idx = [];
  for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: `attribute vec4 rcol; varying vec4 vC;
      void main(){ vC = rcol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec4 vC; void main(){ gl_FragColor = vC; }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, pos, col, pts: [], maxPts };
}
const ribbons = [makeRibbon(70), makeRibbon(70)]; // 左右レール
function ribbonPush(rb, x, z, heat) {
  rb.pts.push({ x, z, heat, age: 0 });
  if (rb.pts.length > rb.maxPts) rb.pts.shift();
}
function ribbonUpdate(rb, dt) {
  for (const p of rb.pts) p.age += dt;
  while (rb.pts.length && rb.pts[0].age > 1.6) rb.pts.shift();
  const n = rb.pts.length;
  for (let i = 0; i < rb.maxPts; i++) {
    const o6 = i * 6, o8 = i * 8;
    if (i < n) {
      const p = rb.pts[i];
      const nx = (i < n - 1) ? rb.pts[i + 1] : p, px = (i > 0) ? rb.pts[i - 1] : p;
      let dx = nx.x - px.x, dz = nx.z - px.z;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const fade = (1 - p.age / 1.6);
      const w = 0.17 * fade * (0.4 + p.heat);
      rb.pos[o6] = p.x + dz * w; rb.pos[o6 + 1] = RAIL_TOP + 0.02; rb.pos[o6 + 2] = p.z - dx * w;
      rb.pos[o6 + 3] = p.x - dz * w; rb.pos[o6 + 4] = RAIL_TOP + 0.02; rb.pos[o6 + 5] = p.z + dx * w;
      const a = fade * fade * clamp(p.heat, 0, 1);
      const r = 1, g = lerp(0.4, 0.9, fade), b = lerp(0.05, 0.4, fade);
      for (const off of [0, 4]) { rb.col[o8 + off] = r; rb.col[o8 + off + 1] = g; rb.col[o8 + off + 2] = b; rb.col[o8 + off + 3] = a; }
    } else {
      rb.pos[o6 + 1] = -99; rb.pos[o6 + 4] = -99;
      rb.col[o8 + 3] = 0; rb.col[o8 + 7] = 0;
    }
  }
  rb.mesh.geometry.getAttribute('position').needsUpdate = true;
  rb.mesh.geometry.getAttribute('rcol').needsUpdate = true;
}

/* ================= ゾーンの光る帯・きらり ================= */
let zoneGlow;
function buildZoneGlow() {
  if (zoneGlow) { scene.remove(zoneGlow); zoneGlow.geometry.dispose(); }
  const steps = 60;
  const pos = new Float32Array((steps + 1) * 2 * 3);
  const s = mkSample();
  for (let i = 0; i <= steps; i++) {
    const u = zone.u0 + (i / steps) * zone.len;
    sampleAt(u, s);
    const w = 0.62;
    const o = i * 6;
    pos[o] = s.pos.x + s.left.x * w; pos[o + 1] = RAIL_TOP + 0.03; pos[o + 2] = s.pos.z + s.left.z * w;
    pos[o + 3] = s.pos.x - s.left.x * w; pos[o + 4] = RAIL_TOP + 0.03; pos[o + 5] = s.pos.z - s.left.z * w;
  }
  const idx = [];
  for (let i = 0; i < steps; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  zoneGlow = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: 0xffa04a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  zoneGlow.frustumCulled = false;
  scene.add(zoneGlow);
}
buildZoneGlow();

// 「ひっぱってね」矢印（下ろしていない砥石の上でふわふわ）
const arrowTex = canvasTex(64, 64, (ctx) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(255,150,60,.95)';
  ctx.lineWidth = 10; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(32, 54); ctx.lineTo(10, 26); ctx.lineTo(24, 26); ctx.lineTo(24, 8);
  ctx.lineTo(40, 8); ctx.lineTo(40, 26); ctx.lineTo(54, 26);
  ctx.closePath(); ctx.stroke(); ctx.fill();
});
const stoneArrows = [0, 1, 2].map(() => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
  sp.scale.setScalar(0.42);
  scene.add(sp);
  return sp;
});

// 砥石とレールの接点の光
const contactGlows = stones.map(() => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffdf9a, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sp.scale.setScalar(0.4);
  scene.add(sp);
  return sp;
});

// きらり（研磨済みレールを走る白い光）
const glints = [];
for (let i = 0; i < 2; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(0.65);
  scene.add(sp);
  glints.push({ sp, t: -1, side: i ? 1 : -1 });
}
function runGlint() {
  for (const g of glints) g.t = 0;
  SND.glintRun();
}

// お花（ごほうびの花壇、ラウンドごとに増える）
const rewardFlowers = [];
function bloomFlowers() {
  const s = mkSample();
  const made = [];
  for (let i = 0; i < 5; i++) {
    const u = zone.u0 + zone.len * (0.15 + 0.7 * (i / 4));
    sampleAt(u, s);
    const side = i % 2 ? 1 : -1;
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.28, 6), new THREE.MeshLambertMaterial({ color: 0x6fbf6f }));
    stem.position.y = 0.14; g.add(stem);
    const petM = new THREE.MeshLambertMaterial({ color: [0xff8fab, 0xffd166, 0xc9a6ff, 0x9bd1ff, 0xffffff][i % 5] });
    for (let p = 0; p < 5; p++) {
      const pe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), petM);
      const a = (p / 5) * TAU;
      pe.position.set(Math.cos(a) * 0.09, 0.3, Math.sin(a) * 0.09);
      g.add(pe);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffdd55 }));
    core.position.y = 0.3; g.add(core);
    g.position.set(s.pos.x + s.left.x * side * rand(1.1, 1.5), 0, s.pos.z + s.left.z * side * rand(1.1, 1.5));
    g.scale.setScalar(0.001);
    scene.add(g);
    rewardFlowers.push(g); made.push(g);
    if (rewardFlowers.length > 40) { const old = rewardFlowers.shift(); scene.remove(old); }
  }
  made.forEach((g, i) => {
    after(0.15 * i, () => {
      tween(0.5, (k) => { const e = 1 + 0.3 * Math.sin(k * Math.PI); g.scale.setScalar(k * e); }, () => g.scale.setScalar(1));
      starBurst(g.position.x, 0.4, g.position.z, 6, 1.2);
    });
  });
}

/* ================= 音（WebAudio 合成） ================= */
const SND = (() => {
  let ac = null, master = null, noiseBuf = null, muted = false;
  let shaaNodes = null, whirrNodes = null, suuNodes = null, kataTimer = 0;
  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.85;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    const len = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function resume() { init(); if (ac.state !== 'running') ac.resume(); }
  function now() { return ac ? ac.currentTime : 0; }
  function env(g, t0, a, peak, dec, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + dec);
  }
  function noise({ dur = 0.1, bp = null, lp = null, hp = null, q = 1, gain = 0.2, at = 0.004, when = 0 }) {
    if (!ac || muted) return;
    const t0 = now() + when;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    let node = src;
    if (bp) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q; node.connect(f); node = f; }
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    const g = ac.createGain(); node.connect(g); g.connect(master);
    env(g, t0, at, gain, dur);
    src.start(t0); src.stop(t0 + at + dur + 0.05);
  }
  function tone({ f = 440, f2 = null, type = 'sine', dur = 0.2, gain = 0.2, at = 0.005, when = 0, lp = null }) {
    if (!ac || muted) return;
    const t0 = now() + when;
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    let node = o;
    if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; node.connect(fl); node = fl; }
    const g = ac.createGain(); node.connect(g); g.connect(master);
    env(g, t0, at, gain, dur);
    o.start(t0); o.stop(t0 + at + dur + 0.05);
  }
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  return {
    resume,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.85; },
    // カタカタ（波打ちの振動音）
    kata(dt, intensity) {
      if (!ac || muted) return;
      kataTimer -= dt;
      if (kataTimer <= 0) {
        kataTimer = 0.085 + rand(0.02);
        noise({ dur: 0.03, bp: 1500 + rand(700), q: 2.5, gain: 0.14 * intensity });
        tone({ f: 170 + rand(50), f2: 110, dur: 0.05, gain: 0.1 * intensity, type: 'triangle' });
      }
    },
    boop() { tone({ f: 330, f2: 240, dur: 0.1, gain: 0.14, type: 'sine' }); },
    pop() { tone({ f: 520, f2: 760, dur: 0.09, gain: 0.14, type: 'sine' }); },
    found() {
      tone({ f: NOTE(79), dur: 0.28, gain: 0.22, type: 'triangle' });
      tone({ f: NOTE(84), dur: 0.4, gain: 0.22, type: 'triangle', when: 0.16 });
      noise({ dur: 0.3, hp: 5000, gain: 0.05, when: 0.16 });
    },
    horn() {
      tone({ f: 392, dur: 0.13, gain: 0.13, type: 'square', lp: 1400 });
      tone({ f: 392, f2: 294, dur: 0.3, gain: 0.13, type: 'square', lp: 1400, when: 0.19 });
    },
    putt() { tone({ f: 92, f2: 70, dur: 0.06, gain: 0.16, type: 'triangle' }); },
    gakon(i) {
      const m = 1 + i * 0.13;
      noise({ dur: 0.05, bp: 750, q: 2, gain: 0.3 });
      tone({ f: 175 * m, f2: 80, dur: 0.09, gain: 0.28, type: 'square', lp: 900 });
      // コン
      tone({ f: 135 * m, f2: 56, dur: 0.3, gain: 0.5, type: 'sine', when: 0.08 });
      noise({ dur: 0.025, bp: 2500, q: 3, gain: 0.13, when: 0.08 });
      tone({ f: 640 * m, dur: 0.32, gain: 0.06, type: 'triangle', when: 0.085 });
      navigator.vibrate?.(35);
    },
    kon(i) { // 砥石をしまう軽い音
      tone({ f: 300 * (1 + i * 0.16), f2: 500 * (1 + i * 0.16), dur: 0.1, gain: 0.16, type: 'sine' });
      noise({ dur: 0.02, bp: 3000, gain: 0.07 });
    },
    whirrStart() {
      if (!ac || muted || whirrNodes) return;
      const g = ac.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, now() + 0.5);
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; o.connect(g);
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      src.connect(f); f.connect(g);
      g.connect(master); o.start(); src.start();
      whirrNodes = { g, o, src };
    },
    whirrStop() {
      if (!whirrNodes) return;
      const { g, o, src } = whirrNodes; whirrNodes = null;
      g.gain.linearRampToValueAtTime(0, now() + 0.3);
      o.stop(now() + 0.4); src.stop(now() + 0.4);
    },
    shaaStart() {
      if (!ac || muted || shaaNodes) return;
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
      const hs = ac.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 6000; hs.gain.value = 4;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(hs); hs.connect(g); g.connect(master);
      src.start();
      shaaNodes = { src, bp, g };
    },
    shaaSet(intensity, deep) {
      if (!shaaNodes) return;
      const t = now();
      shaaNodes.g.gain.setTargetAtTime(clamp(intensity, 0, 0.5), t, 0.06);
      shaaNodes.bp.frequency.setTargetAtTime(deep ? 1300 : 2000 + intensity * 5200, t, 0.08);
      // ぱちぱち
      if (intensity > 0.1 && Math.random() < intensity * 0.5) {
        noise({ dur: 0.014, hp: 3500, gain: 0.1 * Math.random() });
      }
    },
    shaaStop() {
      if (!shaaNodes) return;
      const { src, g } = shaaNodes; shaaNodes = null;
      g.gain.linearRampToValueAtTime(0, now() + 0.25);
      src.stop(now() + 0.35);
    },
    glintRun() {
      [84, 86, 88, 91, 93].forEach((n, i) => {
        tone({ f: NOTE(n), dur: 0.4, gain: 0.13, type: 'triangle', when: i * 0.08 });
        tone({ f: NOTE(n) * 3, dur: 0.2, gain: 0.03, type: 'sine', when: i * 0.08 });
      });
    },
    suuStart() {
      if (!ac || muted || suuNodes) return;
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      const g = ac.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.13, now() + 0.6);
      src.connect(lp); lp.connect(g); g.connect(master); src.start();
      suuNodes = { src, g };
    },
    suuStop() {
      if (!suuNodes) return;
      const { src, g } = suuNodes; suuNodes = null;
      g.gain.linearRampToValueAtTime(0, now() + 0.7);
      src.stop(now() + 0.8);
    },
    plink(i) {
      const seq = [84, 88, 91, 93, 96, 93, 91, 88];
      const n = seq[i % seq.length];
      tone({ f: NOTE(n), dur: 0.5, gain: 0.11, type: 'sine' });
      tone({ f: NOTE(n) * 3.01, dur: 0.2, gain: 0.02, type: 'sine' });
    },
    jingle() {
      [72, 76, 79, 84].forEach((n, i) => tone({ f: NOTE(n), dur: 0.35, gain: 0.15, type: 'triangle', when: i * 0.1 }));
      [91, 96].forEach((n, i) => tone({ f: NOTE(n), dur: 0.5, gain: 0.1, type: 'sine', when: 0.45 + i * 0.12 }));
      noise({ dur: 0.4, hp: 6000, gain: 0.05, when: 0.4 });
    },
    night() {
      tone({ f: NOTE(69), dur: 1.4, gain: 0.05, type: 'triangle', at: 0.4 });
      tone({ f: NOTE(76), dur: 1.4, gain: 0.04, type: 'triangle', at: 0.5, when: 0.3 });
    },
    squeak() { tone({ f: 900, f2: 650, dur: 0.12, gain: 0.05, type: 'sine' }); },
  };
})();

/* ================= 擬音の吹き出し（DOM） ================= */
const wordsEl = document.getElementById('words');
const activeWords = [];
const _v3 = new THREE.Vector3();
function showWord(text, worldPos, { size = 9, color = '#ff9d3c', shiver = false, life = 1.7 } = {}) {
  const el = document.createElement('div');
  el.className = 'word' + (shiver ? ' shiver' : '');
  el.textContent = text;
  el.style.fontSize = `min(${size}vmin, 64px)`;
  el.style.setProperty('--oc', color);
  wordsEl.appendChild(el);
  const w = { el, pos: worldPos.clone(), life };
  activeWords.push(w);
  return w;
}
function updateWords(dt) {
  for (let i = activeWords.length - 1; i >= 0; i--) {
    const w = activeWords[i];
    w.life -= dt;
    _v3.copy(w.pos).project(camera);
    const x = (_v3.x * 0.5 + 0.5) * innerWidth;
    const y = (-_v3.y * 0.5 + 0.5) * innerHeight;
    w.el.style.left = clamp(x, 90, innerWidth - 90) + 'px';
    w.el.style.top = clamp(y, 40, innerHeight - 40) + 'px';
    if (w.life <= 0) { w.el.remove(); activeWords.splice(i, 1); }
  }
}

/* ================= 状態 ================= */
const ST = { INTRO: 0, FIND: 1, FOUND_SEQ: 2, DEPLOY: 3, GRIND: 4, RETRACT: 5, CHECK_WAIT: 6, CHECK_RUN: 7, CELEBRATE: 8, NIGHT: 9 };
let state = ST.INTRO;
let elapsed = 0;

const mintT = { u: 0, v: 0, bounce: 0, roll: 0, rattling: false, kataWordCooldown: 0 };
const grinderT = { u: 0.5, lateral: 1.35, y: 0, dip: 0, driving: false, puttTimer: 0 };
const U_GARAGE = 0.5;
let stonePairsDown = [false, false, false];
let deployHintTime = 0;
let grindHold = { active: false, time: 0 };
let shaaWordShown = false;
let checkPlinkI = 0, checkPlinkTimer = 0;
let shake = 0, thump = 0;
let mintTargetU = null, mintTargetSpeed = 0;
let grinderWatchLateral = 0;
let roundCount = 0;

function pickZone() {
  // 駅とガレージから離れた場所に新しい波打ちゾーン
  let u0;
  do { u0 = rand(1); } while (
    Math.abs(deltaU(u0 + 0.06, U_STATION)) < 0.16 ||
    Math.abs(deltaU(u0 + 0.06, U_GARAGE)) < 0.14
  );
  zone = { u0, len: rand(0.10, 0.13) };
}

function zoneCenterPos(out) {
  const s = _zc; sampleAt(zone.u0 + zone.len / 2, s);
  out.copy(s.pos); return out;
}
const _zc = mkSample();
const _zcv = new THREE.Vector3();

function zoneMeanPolish() {
  let sum = 0, n = 0;
  const i0 = Math.floor(zone.u0 * N), cnt = Math.floor(zone.len * N);
  for (let d = 0; d < cnt; d++) { sum += polish[(i0 + d) % N]; n++; }
  return n ? sum / n : 1;
}

/* ================= カメラ ================= */
const camPos = new THREE.Vector3(0, 12, 12);
const camLook = new THREE.Vector3(0, 0, 0);
const _tPos = new THREE.Vector3(), _tLook = new THREE.Vector3(), _side = new THREE.Vector3();
function portraitZoom() {
  const a = innerWidth / innerHeight;
  return a < 1 ? clamp(1.05 / a, 1, 2.1) : 1;
}
function outward(p, out) { out.set(p.x, 0, p.z).sub(CENTER).setY(0).normalize(); return out; }
function camTarget() {
  const pz = portraitZoom();       // 距離（縦画面は引く）
  const ph = Math.min(pz, 1.35);   // 高さは伸ばしすぎない（見下ろしすぎ防止）
  switch (state) {
    case ST.INTRO:
    case ST.FIND:
    case ST.NIGHT: {
      _tPos.set(0.5, 11.5 * pz, 12.5 * pz * 0.92);
      _tLook.set(0, -0.6, 0.4 - (pz - 1) * 2.6);
      // 走行中のミント号へほんの少し引かれる
      _tLook.lerp(mint.position, 0.15);
      break;
    }
    case ST.FOUND_SEQ: {
      zoneCenterPos(_zcv);
      _tPos.set(0.5, 10.5 * pz, 11.5 * pz).lerp(_zcv.clone().add(new THREE.Vector3(0, 6 * pz, 7 * pz)), 0.4);
      _tLook.copy(_zcv).multiplyScalar(0.6);
      break;
    }
    case ST.DEPLOY: {
      outward(grinder.position, _side);
      _tPos.copy(grinder.position).addScaledVector(_side, 3.5 * Math.min(pz, 1.5)).add(new THREE.Vector3(0, 1.0 * ph, 0));
      _tLook.copy(grinder.position).add(new THREE.Vector3(0, 0.42, 0));
      break;
    }
    case ST.GRIND:
    case ST.RETRACT: {
      zoneCenterPos(_zcv);
      outward(_zcv, _side);
      _tPos.copy(_zcv).addScaledVector(_side, 6.0 * pz).add(new THREE.Vector3(0, 3.9 * ph, 0));
      _tPos.lerp(grinder.position.clone().addScaledVector(_side, 6.0 * pz).add(new THREE.Vector3(0, 3.9 * ph, 0)), 0.4);
      _tLook.copy(_zcv).lerp(grinder.position, 0.4).add(new THREE.Vector3(0, 0.2, 0));
      break;
    }
    case ST.CHECK_WAIT: {
      outward(mint.position, _side);
      _tPos.copy(mint.position).addScaledVector(_side, 4.4 * pz).add(new THREE.Vector3(0, 2.6 * ph, 0));
      _tLook.copy(mint.position).add(new THREE.Vector3(0, 0.4, 0));
      break;
    }
    case ST.CHECK_RUN: {
      outward(mint.position, _side);
      _tPos.copy(mint.position).addScaledVector(_side, 4.2 * pz).add(new THREE.Vector3(0, 2.2 * ph, 0));
      _tLook.copy(mint.position).add(new THREE.Vector3(0, 0.45, 0));
      break;
    }
    case ST.CELEBRATE: {
      zoneCenterPos(_zcv);
      outward(_zcv, _side);
      _tPos.copy(_zcv).addScaledVector(_side, 6 * pz).add(new THREE.Vector3(0, 4.2 * ph, 0));
      _tLook.copy(_zcv);
      break;
    }
  }
}
function updateCamera(dt) {
  camTarget();
  const k = 1 - Math.exp(-dt * 2.6);
  camPos.lerp(_tPos, k);
  camLook.lerp(_tLook, k);
  camera.position.copy(camPos);
  // 画面のゆれ
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    camera.position.z += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-dt * 6);
  }
  if (thump > 0.001) {
    camera.position.y -= thump;
    thump *= Math.exp(-dt * 10);
  }
  camera.lookAt(camLook);
  updateOccluders(dt);
}

// カメラと注視点の間をふさぐ木・丘をふわっと縮める
const _ocA = new THREE.Vector3(), _ocB = new THREE.Vector3(), _ocP = new THREE.Vector3();
function updateOccluders(dt) {
  const nearView = state === ST.DEPLOY || state === ST.GRIND || state === ST.RETRACT ||
    state === ST.CHECK_WAIT || state === ST.CHECK_RUN || state === ST.CELEBRATE || state === ST.FOUND_SEQ;
  _ocA.copy(camera.position); _ocB.copy(camLook);
  const ab = _ocB.clone().sub(_ocA);
  const abLen2 = ab.lengthSq() || 1;
  for (const oc of occluders) {
    let target = 1;
    if (nearView) {
      _ocP.copy(oc.obj.position); _ocP.y += 0.6;
      const t = clamp(_ocP.clone().sub(_ocA).dot(ab) / abLen2, 0, 1);
      const d = _ocP.distanceTo(_ocA.clone().addScaledVector(ab, t));
      if (d < oc.r + 0.7) target = 0.02;
    }
    oc.k = lerp(oc.k, target, 1 - Math.exp(-dt * 7));
    const s = oc.k;
    oc.obj.scale.set(s, oc.baseSy * s, s);
  }
}

/* ================= 入力 ================= */
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -RAIL_TOP);
const _ndc = new THREE.Vector2(), _hit = new THREE.Vector3();
let pointerDown = false;
let pointerScreen = { x: 0, y: 0 };
let dragStone = null; // {pairIndex, startY, id}
const activePointers = new Map(); // 小さい手のマルチタッチに耐える

function screenToTrackU(x, y, windowU0 = null, windowLen = null) {
  _ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(_ndc, camera);
  if (!ray.ray.intersectPlane(groundPlane, _hit)) return null;
  let best = -1, bestD = Infinity;
  if (windowU0 === null) {
    for (let i = 0; i < N; i += 4) {
      const dx = P[i].x - _hit.x, dz = P[i].z - _hit.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
  } else {
    const i0 = Math.floor(windowU0 * N), cnt = Math.floor(windowLen * N);
    for (let d = 0; d <= cnt; d += 2) {
      const i = (i0 + d) % N;
      const dx = P[i].x - _hit.x, dz = P[i].z - _hit.z;
      const dd = dx * dx + dz * dz;
      if (dd < bestD) { bestD = dd; best = i; }
    }
  }
  return { u: best / N, dist: Math.sqrt(bestD), world: _hit.clone() };
}

function raycastStones(x, y) {
  _ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(_ndc, camera);
  let best = null, bestD = Infinity;
  const wp = new THREE.Vector3();
  for (const s of stones) {
    s.group.getWorldPosition(wp);
    const d = ray.ray.distanceToPoint(wp);
    if (d < 0.42 && d < bestD) { bestD = d; best = s; }
  }
  return best;
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  SND.resume();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  pointerDown = true;
  if (activePointers.size === 1) {
    pointerScreen = { x: e.clientX, y: e.clientY };
    onTapDown(e.clientX, e.clientY, e.pointerId);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const first = activePointers.keys().next().value;
  if (e.pointerId === first) pointerScreen = { x: e.clientX, y: e.clientY };
  if (state === ST.DEPLOY && dragStone && e.pointerId === dragStone.id) {
    const dy = e.clientY - dragStone.startY;
    if (dy > 30) { lowerStonePair(dragStone.pairIndex); dragStone = null; }
  }
});
const endPointer = (e) => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.delete(e.pointerId);
  if (state === ST.DEPLOY && dragStone && e.pointerId === dragStone.id) {
    // 小さいタップでもOK（4歳にやさしく）
    lowerStonePair(dragStone.pairIndex);
    dragStone = null;
  }
  if (activePointers.size === 0) {
    pointerDown = false;
    grindHold.active = false;
  } else {
    const p = activePointers.values().next().value;
    pointerScreen = { x: p.x, y: p.y };
  }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

function onTapDown(x, y, pointerId) {
  switch (state) {
    case ST.FIND: {
      const t = screenToTrackU(x, y);
      if (!t) return;
      zoneCenterPos(_zcv);
      const dZone = Math.hypot(t.world.x - _zcv.x, t.world.z - _zcv.z);
      const dTrain = Math.hypot(t.world.x - mint.position.x, t.world.z - mint.position.z);
      const zoneR = zone.len * LOOP_LEN * 0.5 + 1.3;
      if (dZone < zoneR || (mintT.rattling && dTrain < 2.4)) {
        startFoundSeq();
      } else {
        SND.boop();
        starBurst(t.world.x, 0.2, t.world.z, 5, 1);
      }
      break;
    }
    case ST.DEPLOY: {
      const s = raycastStones(x, y);
      if (s && !stonePairsDown[s.pairIndex]) {
        dragStone = { pairIndex: s.pairIndex, startY: y, id: pointerId };
      } else {
        SND.boop();
      }
      break;
    }
    case ST.GRIND: {
      grindHold = { active: true, time: 0 };
      break;
    }
    case ST.CHECK_WAIT: {
      const t = screenToTrackU(x, y);
      if (!t) return;
      const dTrain = Math.hypot(t.world.x - mint.position.x, t.world.z - mint.position.z);
      if (dTrain < 2.6) startCheckRun();
      else { SND.boop(); starBurst(t.world.x, 0.2, t.world.z, 5, 1); }
      break;
    }
    default: {
      if (state === ST.CELEBRATE || state === ST.CHECK_RUN) {
        const t = screenToTrackU(x, y);
        if (t) starBurst(t.world.x, 0.3, t.world.z, 6, 1.2);
        SND.pop();
      }
    }
  }
}

/* ================= フェーズ進行 ================= */
function startRound() {
  pickZone();
  waveGrow = 1;
  const i0 = Math.floor(zone.u0 * N), cnt = Math.ceil(zone.len * N);
  for (let d = 0; d <= cnt; d++) polish[(i0 + d) % N] = 0;
  refreshZone();
  buildZoneGlow();
  // ミント号はゾーンのちょっと手前からスタート
  mintT.u = ((zone.u0 - 0.12) % 1 + 1) % 1;
  mintT.v = 0.045;
  mintTargetU = null;
  state = ST.FIND;
}

function startFoundSeq() {
  state = ST.FOUND_SEQ;
  SND.found();
  zoneCenterPos(_zcv);
  starBurst(_zcv.x, RAIL_TOP + 0.3, _zcv.z, 22, 2.6);
  showWord('！', _zcv.clone().add(new THREE.Vector3(0, 1.2, 0)), { size: 11, color: '#ff8fab' });
  // ミント号は駅まですーっと帰る
  mintTargetU = U_STATION;
  mintTargetSpeed = 0.07;
  // 削正車出動
  after(0.7, () => SND.horn());
  after(1.1, () => {
    // 待避場所から線路にヨイショと乗る
    const fromLat = grinderT.lateral;
    tween(0.7, (k) => {
      grinderT.lateral = lerp(fromLat, 0, smoothstep(0, 1, k));
      grinderT.y = Math.sin(k * Math.PI) * 0.35;
    }, () => {
      grinderT.lateral = 0; grinderT.y = 0;
      grinderT.driving = true;
      thump = 0.06;
      SND.putt();
    });
  });
}

function grinderArrive() {
  grinderT.driving = false;
  SND.squeak();
  state = ST.DEPLOY;
  deployHintTime = 0;
  stonePairsDown = [false, false, false];
}

function lowerStonePair(k) {
  if (stonePairsDown[k]) return;
  stonePairsDown[k] = true;
  SND.gakon(k);
  thump = 0.12;
  shake = Math.max(shake, 0.05);
  grinderT.dip = 0.07; // 車体がドスンと沈む
  const s = stones.find((s) => s.pairIndex === k);
  const wp = new THREE.Vector3(); s.group.getWorldPosition(wp);
  showWord('ガコン', wp.add(new THREE.Vector3(0, 0.9, 0)), { size: stonePairsDown.filter(Boolean).length === 1 ? 9 : 7, color: '#e8833a' });
  tween(0.22, (p) => {
    const ov = p < 0.7 ? p / 0.7 : 1 + 0.25 * Math.sin((p - 0.7) / 0.3 * Math.PI);
    setStonePair(k, Math.min(ov, 1.12));
  }, () => setStonePair(k, 1));
  // ちりの輪
  for (const st of stones) if (st.pairIndex === k) {
    const wp2 = new THREE.Vector3(); st.group.getWorldPosition(wp2);
    for (let i = 0; i < 8; i++) {
      const a = rand(TAU);
      emit(starsP, {
        x: wp2.x, y: RAIL_TOP + 0.05, z: wp2.z,
        vx: Math.cos(a) * rand(0.4, 1), vy: rand(0.2, 0.6), vz: Math.sin(a) * rand(0.4, 1),
        life: rand(0.3, 0.5), s: rand(0.06, 0.1), r: 0.85, g: 0.8, b: 0.72, grav: -1.5,
      });
    }
  }
  if (stonePairsDown.every(Boolean)) {
    after(0.45, () => {
      SND.whirrStart();
      SND.shaaStart();
      state = ST.GRIND;
      shaaWordShown = false;
    });
  }
}

function finishGrind() {
  state = ST.RETRACT;
  SND.shaaStop();
  SND.whirrStop();
  zoneCenterPos(_zcv);
  starBurst(_zcv.x, RAIL_TOP + 0.4, _zcv.z, 26, 3);
  grinderFace.material.map = FACE_HAPPY;
  [0, 1, 2].forEach((k) => {
    after(0.35 + k * 0.28, () => {
      SND.kon(k);
      tween(0.18, (p) => setStonePair(k, 1 - p), () => setStonePair(k, 0));
    });
  });
  after(1.5, () => {
    runGlint();
    // 削正車は脇によけて見学
    tween(0.8, (k) => {
      grinderWatchLateral = lerp(0, -1.6, smoothstep(0, 1, k));
      grinderT.lateral = grinderWatchLateral;
      grinderT.y = Math.sin(k * Math.PI) * 0.3;
    }, () => { grinderT.y = 0; });
  });
  after(2.6, () => {
    state = ST.CHECK_WAIT;
    checkPlinkI = 0;
  });
}

function startCheckRun() {
  state = ST.CHECK_RUN;
  SND.pop();
  mintT.v = 0;
  mintTargetU = null;
  updateMint.traveled = 0;
  checkPlinkTimer = 0;
  SND.suuStart();
  starBurst(mint.position.x, 1, mint.position.z, 10, 1.6);
}

function celebrate() {
  state = ST.CELEBRATE;
  SND.suuStop();
  SND.jingle();
  roundCount++;
  zoneCenterPos(_zcv);
  starBurst(_zcv.x, 1, _zcv.z, 30, 3.4);
  bloomFlowers();
  mintFace.material.map = FACE_HAPPY;
  after(2.6, () => beginNight());
}

function beginNight() {
  state = ST.NIGHT;
  SND.night();
  grinderFace.material.map = FACE_NORMAL;
  mintFace.material.map = FACE_NORMAL;
  const oldZoneGlowOpacity = zoneGlow.material.opacity;
  // くらくなる → 新しい波打ち → あさ
  tween(1.2, (k) => setDaylight(1 - k));
  after(1.3, () => {
    pickZone();
    waveGrow = 0;
    const i0 = Math.floor(zone.u0 * N), cnt = Math.ceil(zone.len * N);
    for (let d = 0; d <= cnt; d++) polish[(i0 + d) % N] = 0;
    buildZoneGlow();
    // 波がむくむく育つ
    tween(0.9, (k) => { waveGrow = k; refreshZone(); }, () => { waveGrow = 1; refreshZone(); });
    zoneCenterPos(_zcv);
    starBurst(_zcv.x, 0.6, _zcv.z, 8, 1.5);
  });
  after(2.6, () => {
    tween(1.0, (k) => setDaylight(k), () => {
      mintT.u = ((zone.u0 - 0.12) % 1 + 1) % 1;
      mintT.v = 0.045;
      mintTargetU = null;
      state = ST.FIND;
    });
  });
}
function setDaylight(k) {
  scene.background.copy(DUSK_SKY).lerp(DAY_SKY, k);
  scene.fog.color.copy(scene.background);
  hemi.intensity = lerp(0.35, 1.0, k);
  sun.intensity = lerp(0.4, 1.6, k);
}

/* ================= 更新ループ ================= */
const contactWp = new THREE.Vector3();
let dirtyMin = -1, dirtyMax = -1;
function markDirty(i) {
  if (dirtyMin < 0) { dirtyMin = i; dirtyMax = i; return; }
  dirtyMin = Math.min(dirtyMin, i); dirtyMax = Math.max(dirtyMax, i);
}

function updateMint(dt) {
  if (state === ST.FIND || state === ST.INTRO) {
    mintT.u = (mintT.u + mintT.v * dt) % 1;
  } else if (mintTargetU !== null) {
    const d = deltaU(mintT.u, mintTargetU);
    if (Math.abs(d) < 0.004) { mintT.u = mintTargetU; mintTargetU = null; mintT.v = 0; }
    else {
      const dir = d > 0 ? 1 : 1; // ループは前進のみ（後ろ向きに走らない）
      const dist = ((mintTargetU - mintT.u) % 1 + 1) % 1;
      const sp = clamp(dist * 1.2, 0.02, mintTargetSpeed);
      mintT.u = (mintT.u + sp * dt * dir) % 1;
      if (dist < 0.01) { mintTargetU = null; mintT.v = 0; }
    }
  } else if (state === ST.CHECK_RUN) {
    mintT.v = Math.min(0.085, mintT.v + dt * 0.07);
    const du = mintT.v * dt;
    mintT.u = (mintT.u + du) % 1;
    updateMint.traveled += du;
  }

  // 波打ちゾーンでのがたがた
  const inZone = waveEnv(mintT.u + worldToDu(0.4)) > 0.05 || waveEnv(mintT.u - worldToDu(0.4)) > 0.05;
  const zoneRough = inZone && zoneMeanPolish() < 0.5 && waveGrow > 0.5;
  if ((state === ST.FIND || state === ST.INTRO) && zoneRough && mintT.v > 0.01) {
    mintT.rattling = true;
    mintT.bounce = Math.abs(Math.sin(elapsed * 34)) * 0.055 + Math.abs(Math.sin(elapsed * 47)) * 0.03;
    mintT.roll = Math.sin(elapsed * 39) * 0.06;
    SND.kata(dt, 1);
    shake = Math.max(shake, 0.035);
    mintT.kataWordCooldown -= dt;
    if (mintT.kataWordCooldown <= 0) {
      mintT.kataWordCooldown = 2.4;
      showWord('カタカタ', mint.position.clone().add(new THREE.Vector3(0, 1.6, 0)), { size: 9, color: '#e8833a', shiver: true });
    }
  } else {
    mintT.rattling = false;
    mintT.bounce *= Math.exp(-dt * 8);
    mintT.roll *= Math.exp(-dt * 8);
  }

  // スーッと走行中の演出
  if (state === ST.CHECK_RUN) {
    const inZ = zoneS(mintT.u) >= 0;
    if (inZ) {
      checkPlinkTimer -= dt;
      if (checkPlinkTimer <= 0) {
        checkPlinkTimer = 0.28;
        SND.plink(checkPlinkI++);
        // 車輪の下にきらきら
        for (const side of [-1, 1]) {
          sampleAt(mintT.u, _sA);
          emit(starsP, {
            x: _sA.pos.x + _sA.left.x * side * GAUGE / 2, y: RAIL_TOP + 0.04, z: _sA.pos.z + _sA.left.z * side * GAUGE / 2,
            vx: rand(-0.2, 0.2), vy: rand(0.3, 0.8), vz: rand(-0.2, 0.2),
            life: rand(0.4, 0.7), s: rand(0.08, 0.13), r: 1, g: 1, b: 1, grav: -1,
          });
        }
      }
      if (!updateMint.suuShown) {
        updateMint.suuShown = true;
        showWord('スーッ', mint.position.clone().add(new THREE.Vector3(0, 1.7, 0)), { size: 10, color: '#7cc3e8' });
      }
    }
    // 一周ぶん走ったらおしまい
    if (updateMint.traveled >= 0.995) {
      updateMint.suuShown = false;
      mintT.v = 0;
      celebrate();
    }
  }

  placeOnTrack(mint, mintT.u, 0.38, 0, 0, mintT.bounce, mintT.roll);
}
updateMint.traveled = 0;
updateMint.suuShown = false;

function updateGrinder(dt) {
  if (grinderT.driving) {
    // ゾーン手前まで自走
    const target = ((zone.u0 - worldToDu(CAR_HALF) - 0.005) % 1 + 1) % 1;
    const dist = ((target - grinderT.u) % 1 + 1) % 1;
    if (dist < 0.006 || dist > 0.994) {
      grinderT.u = target;
      grinderArrive();
    } else {
      // 距離によらず3秒くらいで到着（待たせない）
      const sp = clamp(Math.max(dist * 1.1, 0.06), 0.06, 0.4);
      grinderT.u = (grinderT.u + sp * dt) % 1;
      grinderT.puttTimer -= dt;
      if (grinderT.puttTimer <= 0) { grinderT.puttTimer = 0.16; SND.putt(); }
    }
  }

  if (state === ST.GRIND) {
    // 指の位置へ、ゾーンのまわりだけ動ける
    let target = null;
    if (pointerDown) {
      const w0 = ((zone.u0 - 0.06) % 1 + 1) % 1;
      const t = screenToTrackU(pointerScreen.x, pointerScreen.y, w0, zone.len + 0.12);
      if (t) target = t.u;
    }
    if (target !== null) {
      const d = deltaU(grinderT.u, target);
      const maxV = 0.11;
      const v = clamp(d * 6, -maxV, maxV);
      grinderT.u = ((grinderT.u + v * dt) % 1 + 1) % 1;
      updateGrinder.speed = Math.abs(v) * LOOP_LEN; // world units/s
    } else {
      updateGrinder.speed *= Math.exp(-dt * 10);
    }
    // 長押しでその場けずり
    if (pointerDown && grindHold.active && updateGrinder.speed < 0.4) grindHold.time += dt;
    else grindHold.time = 0;
    const inPlace = grindHold.time > 0.25;

    // 研磨と火花
    const speed = updateGrinder.speed;
    const grinding = speed > 0.15 || inPlace;
    let sparkTotal = 0;
    if (grinding) {
      for (const st of stones) {
        const cu = ((grinderT.u + worldToDu(st.off)) % 1 + 1) % 1;
        const ci = Math.floor(cu * N);
        const env = waveEnv(cu);
        // 研磨: 足あと ±5リング
        const fp = 5;
        const rate = inPlace ? 1.6 : clamp(speed * 0.75, 0.2, 1.9);
        for (let d = -fp; d <= fp; d++) {
          const i = (ci + d + N) % N;
          if (waveEnv(i / N) > 0) {
            const fall = 1 - Math.abs(d) / (fp + 1);
            const before = polish[i];
            polish[i] = clamp(before + rate * fall * dt, 0, 1);
            if (polish[i] !== before) {
              markDirty(i);
              // 磨きあがった瞬間の白いきらめき
              if (before < 0.95 && polish[i] >= 0.95 && Math.random() < 0.25) {
                sampleAt(i / N, _sB);
                whiteGlint(_sB.pos.x + _sB.left.x * st.side * GAUGE / 2, RAIL_TOP + 0.05, _sB.pos.z + _sB.left.z * st.side * GAUGE / 2);
              }
            }
          }
        }
        // 火花はこすっている砥石とレールの接点から
        sampleAt(cu, _sA);
        const px = _sA.pos.x + _sA.left.x * st.side * GAUGE / 2;
        const pz2 = _sA.pos.z + _sA.left.z * st.side * GAUGE / 2;
        const heat = clamp((env > 0 ? (1 - polish[ci]) * 0.9 + 0.35 : 0.12) * (inPlace ? 1 : clamp(speed / 1.5, 0.2, 1)), 0, 1);
        const nSp = inPlace ? 4 : Math.floor(clamp(speed * 3.2, 0, 9) * heat + rand(0.9));
        for (let i = 0; i < nSp; i++) {
          if (inPlace) {
            // 火花の噴水
            goldSpark(px, RAIL_TOP + 0.02, pz2, 0, 0, 0.3, rand(1.2, 2.4));
          } else {
            const sgn = updateGrinder.lastMove >= 0 ? 1 : -1;
            goldSpark(px, RAIL_TOP + 0.02, pz2, _sA.tan.x * sgn, _sA.tan.z * sgn, speed);
          }
        }
        sparkTotal += heat;
        st.spin += dt * (inPlace ? 26 : 12 + speed * 6);
        st.disc.rotation.y = st.spin;
        // 接点の光
        const glow = contactGlows[stones.indexOf(st)];
        glow.position.set(px, RAIL_TOP + 0.03, pz2);
        glow.material.opacity = clamp(heat * (0.55 + 0.35 * Math.sin(elapsed * 31 + st.off * 9)), 0, 1);
        glow.scale.setScalar(0.3 + heat * 0.35);
      }
      // 帯（左右レール）
      if (!inPlace && speed > 0.3) {
        for (const [ri, side] of [[0, -1], [1, 1]]) {
          sampleAt(grinderT.u, _sA);
          ribbonPush(ribbons[ri],
            _sA.pos.x + _sA.left.x * side * GAUGE / 2,
            _sA.pos.z + _sA.left.z * side * GAUGE / 2,
            clamp(speed / 2.2, 0.2, 1));
        }
      }
      // ことば
      if (!shaaWordShown && speed > 1.2) {
        shaaWordShown = true;
        showWord('シャーッ', grinder.position.clone().add(new THREE.Vector3(0, 1.6, 0)), { size: 10, color: '#ffd166' });
      }
      shake = Math.max(shake, inPlace ? 0.03 : clamp(speed * 0.012, 0, 0.03));
    } else {
      for (const st of stones) { st.spin += dt * 8; st.disc.rotation.y = st.spin; }
      for (const g of contactGlows) g.material.opacity *= Math.exp(-dt * 12);
    }
    SND.shaaSet(inPlace ? 0.34 : clamp(speed * 0.13, 0, 0.42), inPlace);
    if (pointerDown) updateGrinder.lastMove = grinderT.u - (updateGrinder.prevU ?? grinderT.u);
    updateGrinder.prevU = grinderT.u;

    // ぜんぶ銀色になったら
    if (zoneMeanPolish() > 0.965) finishGrind();
  }

  if (state !== ST.GRIND) for (const g of contactGlows) g.material.opacity *= Math.exp(-dt * 10);
  grinderT.dip *= Math.exp(-dt * 9);
  placeOnTrack(grinder, grinderT.u, 0.6, grinderT.lateral, grinderT.y - grinderT.dip, 0, 0);
}
updateGrinder.speed = 0;
updateGrinder.lastMove = 0;

function updateZoneGlow(dt) {
  if (!zoneGlow) return;
  let op = 0;
  if (state === ST.FIND) {
    op = mintT.rattling ? 0.35 + 0.3 * Math.sin(elapsed * 12) : 0.14 + 0.1 * Math.sin(elapsed * 3);
  } else if (state === ST.FOUND_SEQ || state === ST.DEPLOY) {
    op = 0.3 + 0.12 * Math.sin(elapsed * 5);
  } else if (state === ST.GRIND) {
    op = 0.16 * (1 - zoneMeanPolish());
  }
  zoneGlow.material.opacity = lerp(zoneGlow.material.opacity, op, 1 - Math.exp(-dt * 6));
}

function updateGlints(dt) {
  for (const g of glints) {
    if (g.t < 0) { g.sp.material.opacity = 0; continue; }
    g.t += dt * 0.9;
    if (g.t > 1) { g.t = -1; g.sp.material.opacity = 0; continue; }
    const u = zone.u0 + zone.len * g.t;
    sampleAt(u, _sA);
    g.sp.position.set(
      _sA.pos.x + _sA.left.x * g.side * GAUGE / 2,
      RAIL_TOP + 0.06,
      _sA.pos.z + _sA.left.z * g.side * GAUGE / 2
    );
    g.sp.material.opacity = Math.sin(g.t * Math.PI) * 0.9;
  }
}

const _awp = new THREE.Vector3();
function updateDeployHint(dt) {
  if (state !== ST.DEPLOY) {
    for (const a of stoneArrows) a.material.opacity *= Math.exp(-dt * 10);
    return;
  }
  deployHintTime += dt;
  // まだ下りていない砥石がふわふわ光り、矢印が「ひっぱってね」
  for (const st of stones) {
    if (!stonePairsDown[st.pairIndex]) {
      const pulse = 1 + 0.12 * Math.sin(elapsed * 5 + st.pairIndex * 2);
      st.disc.scale.setScalar(pulse);
    } else {
      st.disc.scale.setScalar(1);
    }
  }
  for (let k = 0; k < 3; k++) {
    const a = stoneArrows[k];
    if (stonePairsDown[k]) { a.material.opacity *= Math.exp(-dt * 10); continue; }
    const st = stones.find((s) => s.pairIndex === k && s.side === 1);
    st.group.getWorldPosition(_awp);
    a.position.set(_awp.x, _awp.y + 0.55 + 0.1 * Math.sin(elapsed * 4 + k), _awp.z);
    a.material.opacity = deployHintTime > 0.6 ? 0.85 + 0.15 * Math.sin(elapsed * 4) : 0;
  }
}

/* ================= メインループ ================= */
let last = performance.now();
let fpsEMA = 60;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  elapsed += dt;
  fpsEMA = lerp(fpsEMA, 1 / Math.max(dt, 1e-4), 0.03);

  updateTasks(dt);
  updateMint(dt);
  updateGrinder(dt);
  updateZoneGlow(dt);
  updateGlints(dt);
  updateDeployHint(dt);
  updateParticles(sparks, dt);
  updateParticles(starsP, dt);
  for (const rb of ribbons) ribbonUpdate(rb, dt);
  if (dirtyMin >= 0) { refreshRings(dirtyMin, dirtyMax); dirtyMin = -1; dirtyMax = -1; }

  // 背景の小さな生気
  clouds.forEach((c, i) => { c.position.x += dt * 0.08 * (i % 2 ? 1 : -1); if (c.position.x > 14) c.position.x = -14; if (c.position.x < -14) c.position.x = 14; });
  bobbles.forEach((b, i) => { b.rotation.z = Math.sin(elapsed * 1.2 + i) * 0.02; });
  if (state === ST.CHECK_WAIT) {
    mint.position.y += Math.abs(Math.sin(elapsed * 4)) * 0.06;
  }

  updateCamera(dt);
  updateWords(dt);
  renderer.render(scene, camera);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 300));
resize();

/* ================= 開始 ================= */
const intro = document.getElementById('intro');
function startGame() {
  if (state !== ST.INTRO) return;
  SND.resume();
  intro.classList.add('hide');
  startRound();
}
intro.addEventListener('pointerdown', startGame);

const muteBtn = document.getElementById('mute');
let muted = false;
muteBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  muted = !muted;
  SND.setMuted(muted);
  muteBtn.textContent = muted ? '🔇' : '🔊';
});

// 初期配置
grinderT.u = U_GARAGE;
placeOnTrack(grinder, grinderT.u, 0.6, grinderT.lateral, 0, 0, 0);
mintT.u = 0.05;
placeOnTrack(mint, mintT.u, 0.38, 0, 0, 0, 0);
setDaylight(1);
requestAnimationFrame(frame);

/* ================= 試遊用フック ================= */
window.__g = {
  get state() { return state; },
  ST, zone,
  get zoneRef() { return zone; },
  get fps() { return fpsEMA; },
  get polishMean() { return zoneMeanPolish(); },
  get mintU() { return mintT.u; },
  get grinderU() { return grinderT.u; },
  get rattling() { return mintT.rattling; },
  get wordCount() { return activeWords.length; },
  toScreen(x, y, z) {
    _v3.set(x, y, z).project(camera);
    return { x: (_v3.x * 0.5 + 0.5) * innerWidth, y: (-_v3.y * 0.5 + 0.5) * innerHeight };
  },
  trackPointScreen(u) {
    const s = mkSample(); sampleAt(u, s);
    return this.toScreen(s.pos.x, RAIL_TOP, s.pos.z);
  },
  zoneCenterScreen() { return this.trackPointScreen(zone.u0 + zone.len / 2); },
  mintScreen() { return this.toScreen(mint.position.x, mint.position.y + 0.5, mint.position.z); },
  stoneScreens() {
    const wp = new THREE.Vector3();
    return [0, 1, 2].map((k) => {
      const st = stones.find((s) => s.pairIndex === k && s.side === 1);
      st.group.getWorldPosition(wp);
      return this.toScreen(wp.x, wp.y, wp.z);
    });
  },
  start: startGame,
};
