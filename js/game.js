/* ねつききゅうを とばそう！ — 4さい向け 熱気球グラウンドクルー 3D
   実際の立ち上げ手順（風確認→バーナーテスト→展開→接続→ベント点検→口開け→送風→
   クラウンライン→ウェイオフ→クイックリリース）を、全部ちがう一指ジェスチャで再現 */
(() => {
'use strict';
const T = window.THREE;
if (!T) { document.body.textContent = '3D ライブラリの よみこみに しっぱいしました'; return; }

/* ============================== utils ============================== */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = t => smooth(t);
const TAU = Math.PI * 2;

function n2(a, b) {
  return Math.sin(a * 1.7 + b * 2.3) * 0.5 + Math.sin(a * 3.1 - b * 1.3 + 1.7) * 0.3 +
         Math.sin(a * 0.9 + b * 5.1 + 4.1) * 0.2;
}
function curve1(pts, t) {
  t = clamp(t, 0, 1);
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  const u = (t - p1[0]) / Math.max(1e-6, p2[0] - p1[0]);
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u +
    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
}
const COL = s => new T.Color(s).convertSRGBToLinear();

function mergeGeoms(list) {
  let vc = 0;
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  parts.forEach(g => vc += g.attributes.position.count);
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Float32Array(vc * 3);
  let o = 0;
  parts.forEach(g => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.setAttribute('color', new T.BufferAttribute(col, 3));
  return out;
}
function tint(geom, color, jitter = 0) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const c = COL(color);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
    arr[i * 3] = c.r * j; arr[i * 3 + 1] = c.g * j; arr[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new T.BufferAttribute(arr, 3));
  return g;
}
function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const tx = new T.CanvasTexture(cv);
  tx.encoding = T.sRGBEncoding; tx.anisotropy = 4;
  return tx;
}

/* ============================== renderer / scene ============================== */
const app = document.getElementById('app');
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
app.appendChild(renderer.domElement);

const scene = new T.Scene();
scene.fog = new T.Fog(0xf2cfa8, 130, 1500);
const camera = new T.PerspectiveCamera(55, 1, 0.1, 4000);

const sunDir = new T.Vector3(0.62, 0.30, -0.72).normalize();
const sun = new T.DirectionalLight(0xffd9a8, 2.3);
sun.position.copy(sunDir).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -36; sun.shadow.camera.right = 36;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 400; sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
scene.add(new T.HemisphereLight(0xaecdff, 0x5f8a48, 0.85));
scene.add(new T.AmbientLight(0xffe0c0, 0.22));

/* ============================== sky / sun ============================== */
const skyUni = { uSun: { value: sunDir.clone() }, uLift: { value: 0 } };
const sky = new T.Mesh(new T.SphereGeometry(2600, 32, 20),
  new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false, uniforms: skyUni,
    vertexShader: `varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      varying vec3 vW; uniform vec3 uSun; uniform float uLift;
      void main(){
        vec3 d = normalize(vW);
        float h = clamp(d.y, -0.12, 1.0);
        vec3 zen = mix(vec3(.45,.66,.94), vec3(.30,.50,.94), uLift);
        vec3 mid = mix(vec3(.99,.80,.62), vec3(1.0,.70,.60), uLift);
        vec3 hor = mix(vec3(1.0,.85,.60), vec3(1.0,.72,.46), uLift);
        vec3 c = mix(hor, mid, smoothstep(0.0,0.18,h));
        c = mix(c, zen, smoothstep(0.10,0.65,h));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0,.85,.55) * pow(s, 600.0) * 4.0;
        c += vec3(1.0,.70,.40) * pow(s, 24.0) * (0.55+0.35*uLift);
        c += vec3(1.0,.55,.65) * pow(s, 6.0) * 0.16 * (1.0-h);
        if(d.y < 0.0) c = mix(c, vec3(.83,.72,.58), smoothstep(0.0,-0.1,d.y));
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
scene.add(sky);

/* ============================== ground / field ============================== */
const groundTex = canvasTex(1024, (g, S) => {
  g.fillStyle = '#69a84f'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const r = 4 + Math.random() * 26;
    g.fillStyle = `rgba(${70 + Math.random() * 50},${140 + Math.random() * 55},${55 + Math.random() * 40},0.10)`;
    g.beginPath(); g.arc(Math.random() * S, Math.random() * S, r, 0, TAU); g.fill();
  }
  const cx = S / 2, cy = S / 2;
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * TAU, rr = Math.random() * S * 0.115;
    g.fillStyle = `rgba(${150 + Math.random() * 40},${118 + Math.random() * 30},${76 + Math.random() * 24},${0.10 + Math.random() * 0.13})`;
    g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, 26 + Math.random() * 60, 18 + Math.random() * 40, a, 0, TAU); g.fill();
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 90},${100 + Math.random() * 70},${70 + Math.random() * 50},${Math.random() * 0.35})`;
    const a = Math.random() * TAU, rr = Math.pow(Math.random(), 0.6) * S * 0.14;
    g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.8 + Math.random() * 2, 0, TAU); g.fill();
  }
});
const groundNear = new T.Mesh(new T.CircleGeometry(70, 48),
  new T.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
groundNear.rotation.x = -Math.PI / 2; groundNear.receiveShadow = true;
scene.add(groundNear);
const groundFar = new T.Mesh(new T.RingGeometry(69, 2200, 48),
  new T.MeshStandardMaterial({ color: COL('#67a24d'), roughness: 1 }));
groundFar.rotation.x = -Math.PI / 2; groundFar.position.y = -0.03;
scene.add(groundFar);

const bladeTex = canvasTex(128, (g) => {
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 22; i++) {
    const x = 8 + Math.random() * 112, w = 3 + Math.random() * 5, h = 55 + Math.random() * 68;
    g.strokeStyle = `rgba(${50 + Math.random() * 50},${120 + Math.random() * 70},${40 + Math.random() * 40},0.95)`;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, 128);
    g.quadraticCurveTo(x + (Math.random() - 0.5) * 26, 128 - h * 0.6, x + (Math.random() - 0.5) * 40, 128 - h);
    g.stroke();
  }
});
{
  const bg = new T.PlaneGeometry(1.3, 0.85);
  bg.translate(0, 0.4, 0);
  const bm = new T.MeshStandardMaterial({ map: bladeTex, alphaTest: 0.45, side: T.DoubleSide, roughness: 1 });
  const inst = new T.InstancedMesh(bg, bm, 240);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v3 = new T.Vector3();
  for (let i = 0; i < 240; i++) {
    const a = Math.random() * TAU, r = 12 + Math.pow(Math.random(), 0.7) * 46;
    e.set(0, Math.random() * TAU, 0); q.setFromEuler(e);
    const s = 0.7 + Math.random() * 0.9;
    m4.compose(v3.set(Math.cos(a) * r, 0, Math.sin(a) * r), q, new T.Vector3(s, s, s));
    inst.setMatrixAt(i, m4);
  }
  scene.add(inst);
}
{
  const fg = new T.CircleGeometry(0.09, 6); fg.rotateX(-Math.PI / 2); fg.translate(0, 0.06, 0);
  const fm = new T.MeshBasicMaterial({ vertexColors: false });
  const inst = new T.InstancedMesh(fg, fm, 90);
  const cols = ['#ffffff', '#ffe066', '#ff9ec4', '#c9a5ff'];
  const m4 = new T.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * TAU, r = 14 + Math.pow(Math.random(), 0.8) * 44;
    m4.makeTranslation(Math.cos(a) * r, 0, Math.sin(a) * r);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, COL(cols[i % 4]));
  }
  scene.add(inst);
}

/* ============================== 町・木・山・川 ============================== */
{
  const parts = [];
  const wallCols = ['#f6e7d0', '#f0d7b8', '#e8e2e6', '#f3d9c8', '#dfe8f0', '#f7efdc'];
  const roofCols = ['#c65b4e', '#b04a3e', '#8a6b4f', '#6b7f95', '#a8563f', '#7a8f66'];
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * TAU, r = 70 + Math.pow(Math.random(), 0.85) * 340;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 5 + Math.random() * 6, d = 5 + Math.random() * 6, h = 3.4 + Math.random() * 3.6;
    const wall = tint(new T.BoxGeometry(w, h, d), wallCols[i % 6], 0.08);
    wall.translate(x, h / 2, z);
    const roof = tint(new T.ConeGeometry(Math.max(w, d) * 0.78, 2.4 + Math.random() * 1.6, 4), roofCols[i % 6], 0.08);
    roof.rotateY(Math.PI / 4); roof.translate(x, h + 1.2, z);
    parts.push(wall, roof);
  }
  scene.add(new T.Mesh(mergeGeoms(parts), new T.MeshLambertMaterial({ vertexColors: true })));
}
{
  const parts = [];
  for (let i = 0; i < 150; i++) {
    const a = Math.random() * TAU, r = 55 + Math.pow(Math.random(), 0.9) * 380;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 0.8 + Math.random() * 1.6;
    const trunk = tint(new T.CylinderGeometry(0.35 * s, 0.5 * s, 2.4 * s, 5), '#8a6242', 0.15);
    trunk.translate(x, 1.2 * s, z);
    const fol = tint(new T.SphereGeometry(2.4 * s, 7, 6), i % 3 ? '#4d8f3a' : '#5fa348', 0.16);
    fol.scale(1, 1.25, 1); fol.translate(x, 4.4 * s, z);
    parts.push(trunk, fol);
  }
  scene.add(new T.Mesh(mergeGeoms(parts), new T.MeshLambertMaterial({ vertexColors: true })));
}
{
  const river = new T.Mesh(new T.RingGeometry(215, 246, 64, 1, 0.4, 2.1),
    new T.MeshStandardMaterial({ color: COL('#63b7d9'), roughness: 0.25, metalness: 0.35 }));
  river.rotation.x = -Math.PI / 2; river.position.y = 0.05; scene.add(river);
  const roadM = new T.MeshLambertMaterial({ color: COL('#9a9187') });
  const r1 = new T.Mesh(new T.PlaneGeometry(7, 620), roadM);
  r1.rotation.x = -Math.PI / 2; r1.rotation.z = 0.5; r1.position.set(60, 0.04, -40); scene.add(r1);
  const r2 = r1.clone(); r2.rotation.z = -1.1; r2.position.set(-70, 0.04, 60); scene.add(r2);
}
function ridge(rad, hMax, color, seed) {
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const h = hMax * (0.5 + 0.5 * Math.abs(n2(i * 1.3 + seed, seed)));
    const cone = tint(new T.ConeGeometry(rad * 0.24, h, 5), color, 0.05);
    cone.translate(Math.cos(a) * rad, h / 2 - 4, Math.sin(a) * rad);
    pts.push(cone);
  }
  scene.add(new T.Mesh(mergeGeoms(pts), new T.MeshLambertMaterial({ vertexColors: true })));
}
ridge(760, 150, '#7a8fb0', 2.3);
ridge(1250, 300, '#8a90c0', 7.7);

/* ============================== 雲・虹・鳥 ============================== */
const clouds = [];
{
  const mat = new T.MeshLambertMaterial({ color: COL('#ffffff'), emissive: COL('#ffdfe8'), emissiveIntensity: 0.22, transparent: true, opacity: 0.96 });
  for (let i = 0; i < 15; i++) {
    const parts = [];
    const n = 4 + (i % 3);
    for (let k = 0; k < n; k++) {
      const s = 5 + Math.random() * 9;
      const g = new T.SphereGeometry(s, 9, 7);
      g.scale(1.25, 0.72, 1);
      g.translate((k - n / 2) * s * 1.05, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 5);
      parts.push(g);
    }
    const mesh = new T.Mesh(mergeGeoms(parts), mat);
    const a = (i / 15) * TAU + Math.random();
    const r = i < 5 ? 34 + i * 9 : 90 + Math.random() * 260;
    mesh.position.set(Math.cos(a) * r, 55 + i * 13 + Math.random() * 18, Math.sin(a) * r);
    mesh.userData.drift = 0.4 + Math.random() * 0.7;
    scene.add(mesh); clouds.push(mesh);
  }
}
const rainbow = (() => {
  const geo = new T.PlaneGeometry(2, 2, 90, 12);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const R = 190, W = 42;
  for (let i = 0; i < pos.count; i++) {
    const a = uv.getX(i) * Math.PI;
    const rr = R - uv.getY(i) * W;
    pos.setXYZ(i, Math.cos(a) * rr, Math.sin(a) * rr, 0);
  }
  geo.computeVertexNormals();
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
    uniforms: { uOp: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float uOp;
      vec3 band(float t){
        vec3 c = vec3(0.);
        c = mix(vec3(1.,.2,.25), vec3(1.,.55,.15), smoothstep(.0,.17,t));
        c = mix(c, vec3(1.,.95,.2), smoothstep(.17,.34,t));
        c = mix(c, vec3(.25,.85,.35), smoothstep(.34,.51,t));
        c = mix(c, vec3(.2,.6,.95), smoothstep(.51,.68,t));
        c = mix(c, vec3(.35,.3,.9), smoothstep(.68,.85,t));
        c = mix(c, vec3(.6,.35,.9), smoothstep(.85,1.,t));
        return c; }
      void main(){
        float e = smoothstep(0.,.10,vUv.y)*smoothstep(1.,.90,vUv.y);
        gl_FragColor = vec4(band(vUv.y), uOp * e * .55); }`
  });
  const m = new T.Mesh(geo, mat);
  m.position.set(-270, 0, 320); m.rotation.y = 2.44; m.visible = false;
  scene.add(m);
  return m;
})();
const birds = new T.Group();
{
  const wingG = new T.BufferGeometry();
  wingG.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0, 1.1, 0.1, -0.35, 1.1, 0.1, 0.35]), 3));
  wingG.computeVertexNormals();
  const mat = new T.MeshBasicMaterial({ color: COL('#3a3450'), side: T.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const b = new T.Group();
    const w1 = new T.Mesh(wingG, mat), w2 = new T.Mesh(wingG, mat);
    w2.scale.x = -1;
    b.add(w1, w2); b.userData = { ph: Math.random() * TAU, w1, w2, off: i };
    birds.add(b);
  }
  birds.visible = false; scene.add(birds);
}

/* ============================== 気球（外皮） ============================== */
const GORES = 12, SEGG = 4, RINGS = 34;
const COLS = GORES * (SEGG + 1);
const R_PTS = [[0, 2.35], [0.12, 4.9], [0.3, 6.9], [0.5, 7.55], [0.7, 6.9], [0.85, 5.2], [0.95, 2.9], [1, 0.5]];
const H_PTS = [[0, 0], [0.12, 1.8], [0.3, 4.6], [0.5, 7.6], [0.7, 10.4], [0.85, 12.6], [0.95, 14.2], [1, 15.2]];
const ringR = [], ringH = [];
for (let j = 0; j <= RINGS; j++) { const v = j / RINGS; ringR.push(curve1(R_PTS, v)); ringH.push(curve1(H_PTS, v)); }
const colU = [], colGore = [];
for (let g = 0; g < GORES; g++) for (let k = 0; k <= SEGG; k++) {
  colU.push(((g * SEGG + k) / (GORES * SEGG)) * TAU); colGore.push(g);
}
const VERTS = COLS * (RINGS + 1);
const envGeo = new T.BufferGeometry();
{
  const pos = new Float32Array(VERTS * 3), col = new Float32Array(VERTS * 3), idx = [];
  const pal = ['#ff8fb3', '#ffd166', '#8fd8ff', '#fff3df', '#c9a5ff', '#7ee8c0'].map(COL);
  for (let j = 0; j <= RINGS; j++) for (let i = 0; i < COLS; i++) {
    const vi = j * COLS + i;
    let c = pal[colGore[i] % pal.length];
    const v = j / RINGS;
    let mul = 1 - 0.12 * Math.max(0, 1 - v * 9);
    mul *= 0.97 + 0.03 * Math.sin(colU[i] * 3 + v * 20);
    col[vi * 3] = c.r * mul; col[vi * 3 + 1] = c.g * mul; col[vi * 3 + 2] = c.b * mul;
  }
  for (let j = 0; j < RINGS; j++) for (let g = 0; g < GORES; g++) for (let k = 0; k < SEGG; k++) {
    const a = j * COLS + g * (SEGG + 1) + k, b = a + 1, c = a + COLS, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  envGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
  envGeo.setAttribute('color', new T.BufferAttribute(col, 3));
  envGeo.setIndex(idx);
  envGeo.computeVertexNormals();
}
const envelope = new T.Mesh(envGeo, new T.MeshStandardMaterial({
  vertexColors: true, roughness: 0.62, metalness: 0, side: T.DoubleSide,
}));
envelope.castShadow = true; envelope.receiveShadow = true;
envelope.frustumCulled = false;
const crownCap = new T.Mesh(new T.SphereGeometry(0.72, 12, 8),
  new T.MeshStandardMaterial({ color: COL('#d84a5f'), roughness: 0.6 }));
crownCap.castShadow = true;

const aerostat = new T.Group();
aerostat.add(envelope, crownCap);
scene.add(aerostat);
envelope.visible = crownCap.visible = false;  // ステップ3までは収納袋の中

/* パラシュートベント（頂部の弁）＋ベルクロタブ */
const ventGroup = new T.Group();
const ventTabs = [];
{
  const disc = new T.Mesh(new T.CircleGeometry(1.15, 20),
    new T.MeshStandardMaterial({ color: COL('#c9364d'), roughness: 0.7, side: T.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
  ventGroup.add(disc);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const tab = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.28),
      new T.MeshStandardMaterial({ color: COL('#fff3df'), roughness: 0.8, emissive: COL('#ffd23f'), emissiveIntensity: 0.5 }));
    tab.position.set(Math.cos(a) * 1.28, 0.12, Math.sin(a) * 1.28);
    tab.rotation.y = -a; tab.rotation.z = 0.5;   // 開いてめくれてる
    tab.userData.a = a; tab.userData.done = false;
    ventGroup.add(tab); ventTabs.push(tab);
  }
  ventGroup.visible = false;
  aerostat.add(ventGroup);
}

const P = {
  spread: 0, inflate: 0, rise: 0,
  mouthOpen: 0,   // 口持ち 0..1
  fan: 0, burner: 0, alt: 0, bob: 0,
};
const mouthAnchor = new T.Vector3();
function envMouthAnchor(riseE) {
  mouthAnchor.set(0, lerp(0.14, 3.55, riseE), lerp(1.45, 0, riseE));
  return mouthAnchor;
}
let timeNow = 0;
function updateEnvelope() {
  const spE = easeOut(P.spread);
  const riE = easeInOut(P.rise);
  const th = (1 - riE) * Math.PI / 2;
  const cosT = Math.cos(th), sinT = Math.sin(th);
  const zLen = lerp(0.2, 1, spE);
  const ma = envMouthAnchor(riE);
  const pos = envGeo.attributes.position.array;
  const t = timeNow;
  const flutter = P.fan * 0.22 + 0.05;
  for (let j = 0; j <= RINGS; j++) {
    const v = j / RINGS, r = ringR[j], h = ringH[j];
    const sLoc = smooth(clamp(P.inflate * 1.45 - 0.45 * v, 0, 1));
    const openR = P.mouthOpen * clamp(1 - v / 0.14, 0, 1);  // 口もちで開く範囲
    let vs = lerp(0.05, 1, sLoc);
    vs = Math.max(vs, 0.8 * openR);
    let xw = lerp(1.32, 1, sLoc);
    xw = lerp(xw, 1.05, openR);
    const ringLift = (r * vs + 0.06) * sinT;
    const wAmp = (1 - Math.max(sLoc, openR)) * (0.30 + 1.0 * (1 - spE));
    const fAmp = (1 - sLoc) * flutter;
    const axY = h * cosT + ringLift;
    const axZ = h * sinT * zLen;
    const xSpread = lerp(0.3, 1, spE);  // 袋から出る前は幅もたたまれている
    for (let i = 0; i < COLS; i++) {
      const u = colU[i], vi = (j * COLS + i) * 3;
      const cu = Math.cos(u), su = Math.sin(u);
      let px = cu * r * xw * xSpread;
      let py = axY - su * r * sinT * vs;
      let pz = axZ + su * r * cosT;
      py += wAmp * (0.35 + 0.3 * n2(u * 2.1 + j * 0.8, v * 9 + 3));
      py += fAmp * Math.sin(t * 9 + u * 2 + v * 26) * 0.6;
      px += fAmp * Math.sin(t * 7 + v * 18) * 0.25;
      py += (1 - spE) * (0.65 + 0.5 * n2(u * 1.5, j * 1.7)) * (0.4 + v * 0.4);
      py += sLoc * 0.06 * Math.sin(t * 1.2 + u * 3 + v * 6);
      pos[vi] = ma.x + px; pos[vi + 1] = ma.y + py; pos[vi + 2] = ma.z + pz;
    }
  }
  envGeo.attributes.position.needsUpdate = true;
  envGeo.computeVertexNormals();
  crownCap.position.set(ma.x, ma.y + ringH[RINGS] * cosT + (ringR[RINGS] + 0.06) * sinT, ma.z + ringH[RINGS] * sinT * zLen);
  // ベントは布に追従（平置き=上向き、横倒し膨張=+Z向き、直立=上向き）
  const crownS = smooth(clamp(P.inflate * 1.45 - 0.45, 0, 1));
  ventGroup.position.copy(crownCap.position);
  ventGroup.position.y += 0.15 * (1 - crownS * sinT);
  ventGroup.position.z += 0.5 * crownS * sinT;
  ventGroup.rotation.x = Math.PI / 2 * sinT * crownS;
  const vScale = lerp(1, 0.8, riE);
  ventGroup.scale.setScalar(vScale);
}
function mouthRingPoint(k, n, out) {
  const riE = easeInOut(P.rise);
  const th = (1 - riE) * Math.PI / 2;
  const u = (k / n) * TAU + Math.PI / n;
  const r = ringR[0];
  const sLoc = smooth(clamp(P.inflate * 1.45, 0, 1));
  let vs = lerp(0.05, 1, sLoc); vs = Math.max(vs, 0.8 * P.mouthOpen);
  let xw = lerp(1.32, 1, sLoc); xw = lerp(xw, 1.05, P.mouthOpen);
  const ma = envMouthAnchor(riE);
  const sinT = Math.sin(th), cosT = Math.cos(th);
  out.set(ma.x + Math.cos(u) * r * xw,
    ma.y + (r * vs + 0.06) * sinT - Math.sin(u) * r * sinT * vs,
    ma.z + Math.sin(u) * r * cosT);
  return out;
}

/* ============================== かご・バーナー・くま ============================== */
const wickerTex = canvasTex(256, (g, S) => {
  g.fillStyle = '#a5793f'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 10) for (let x = 0; x < S; x += 18) {
    g.fillStyle = `rgba(${140 + Math.random() * 60},${100 + Math.random() * 40},${45 + Math.random() * 25},0.9)`;
    g.beginPath(); g.roundRect((x + (y % 20)) % S - 2, y, 15, 7, 3); g.fill();
    g.strokeStyle = 'rgba(70,45,15,0.5)'; g.stroke();
  }
});
wickerTex.wrapS = wickerTex.wrapT = T.RepeatWrapping; wickerTex.repeat.set(2, 2);
const basket = new T.Group();
const cableRings = [];   // カラビナを掛ける吊りリング×4
{
  const mat = new T.MeshStandardMaterial({ map: wickerTex, roughness: 0.85 });
  const body = new T.Mesh(new T.BoxGeometry(1.35, 1.05, 1.35), mat);
  body.position.y = 0.55; body.castShadow = true; body.receiveShadow = true;
  const rim = new T.Mesh(new T.TorusGeometry(0.86, 0.07, 8, 4),
    new T.MeshStandardMaterial({ color: COL('#6d4326'), roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.y = 1.1;
  basket.add(body, rim);
  const skidM = new T.MeshStandardMaterial({ color: COL('#5d3a20'), roughness: 0.8 });
  for (const sx of [-0.5, 0.5]) {
    const sk = new T.Mesh(new T.BoxGeometry(0.16, 0.09, 1.5), skidM);
    sk.position.set(sx, 0.045, 0); sk.castShadow = true; basket.add(sk);
  }
  const tankM = new T.MeshStandardMaterial({ color: COL('#c8ccd4'), metalness: 0.75, roughness: 0.3 });
  for (const [tx, tz] of [[-0.42, -0.42], [0.42, 0.42]]) {
    const tk = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.85, 12), tankM);
    tk.position.set(tx, 0.75, tz); basket.add(tk);
    const cap = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.1, 10),
      new T.MeshStandardMaterial({ color: COL('#c44'), metalness: 0.4, roughness: 0.4 }));
    cap.position.set(tx, 1.22, tz); basket.add(cap);
  }
  // 吊りリング（カラビナ受け）: 上枠の4隅
  const ringM = new T.MeshStandardMaterial({ color: COL('#d8dce4'), metalness: 0.9, roughness: 0.25, emissive: COL('#7fd4ff'), emissiveIntensity: 0 });
  for (const [rx, rz] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
    const rg = new T.Mesh(new T.TorusGeometry(0.09, 0.028, 8, 14), ringM.clone());
    rg.position.set(rx, 1.22, rz);
    basket.add(rg); cableRings.push(rg);
  }
}
const burnerUnit = new T.Group();
{
  const poleM = new T.MeshStandardMaterial({ color: COL('#8a8f98'), metalness: 0.8, roughness: 0.35 });
  for (const [px, pz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.25, 8), poleM);
    pole.position.set(px * 0.55, 1.65, pz * 0.55);
    pole.rotation.set(pz * 0.28, 0, -px * 0.28);
    basket.add(pole);
  }
  const plate = new T.Mesh(new T.BoxGeometry(0.6, 0.06, 0.6), poleM);
  plate.position.y = 2.2; burnerUnit.add(plate);
  const can = new T.Mesh(new T.CylinderGeometry(0.13, 0.15, 0.3, 12),
    new T.MeshStandardMaterial({ color: COL('#5a5f68'), metalness: 0.85, roughness: 0.3 }));
  can.position.y = 2.4; burnerUnit.add(can);
  for (let i = 0; i < 3; i++) {
    const coil = new T.Mesh(new T.TorusGeometry(0.17, 0.017, 6, 18),
      new T.MeshStandardMaterial({ color: COL('#b87a33'), metalness: 0.9, roughness: 0.25 }));
    coil.rotation.x = Math.PI / 2; coil.position.y = 2.28 + i * 0.07;
    burnerUnit.add(coil);
  }
  basket.add(burnerUnit);
}
const flameOuter = new T.Mesh(new T.ConeGeometry(0.3, 1.7, 10, 1, true),
  new T.MeshBasicMaterial({ color: COL('#ff9330'), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
const flameInner = new T.Mesh(new T.ConeGeometry(0.15, 1.0, 8, 1, true),
  new T.MeshBasicMaterial({ color: COL('#9fd4ff'), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
flameOuter.geometry.translate(0, 0.85, 0); flameInner.geometry.translate(0, 0.5, 0);
const flame = new T.Group();
flame.add(flameOuter, flameInner);
flame.position.y = 2.5; flame.scale.setScalar(0.001);
const pilot = flame.clone(); pilot.visible = false; pilot.scale.setScalar(0.12);
basket.add(flame, pilot);
const burnerLight = new T.PointLight(0xff9a3c, 0, 60, 2);
burnerLight.position.y = 3.2; basket.add(burnerLight);
/* 飛行中のベント（排気）ロープ: 赤いひも */
const ventRope = new T.Group();
{
  const rm = new T.MeshStandardMaterial({ color: COL('#d8344a'), roughness: 0.7 });
  const seg = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.3, 6), rm);
  seg.position.y = 1.75; ventRope.add(seg);
  const knob = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), rm);
  knob.position.y = 1.1; ventRope.add(knob);
  ventRope.position.set(0.58, 0, 0.58);
  ventRope.visible = false;
  basket.add(ventRope);
}
/* くまのパイロット */
const bear = new T.Group();
{
  const fur = new T.MeshStandardMaterial({ color: COL('#b5793f'), roughness: 0.9 });
  const light = new T.MeshStandardMaterial({ color: COL('#e0b684'), roughness: 0.9 });
  const body = new T.Mesh(new T.SphereGeometry(0.26, 12, 10), fur); body.scale.set(1, 1.15, 0.85); body.position.y = 0.3;
  const head = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), fur); head.position.y = 0.72;
  const muzzle = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), light); muzzle.position.set(0, 0.68, 0.16);
  const e1 = new T.Mesh(new T.SphereGeometry(0.025, 6, 5), new T.MeshBasicMaterial({ color: 0x21160c })); e1.position.set(-0.07, 0.76, 0.17);
  const e2 = e1.clone(); e2.position.x = 0.07;
  const ear1 = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), fur); ear1.position.set(-0.13, 0.9, 0);
  const ear2 = ear1.clone(); ear2.position.x = 0.13;
  const armR = new T.Mesh(T.CapsuleGeometry ? new T.CapsuleGeometry(0.055, 0.16, 3, 6) : new T.SphereGeometry(0.08, 6, 5), fur);
  armR.position.set(0.24, 0.42, 0); armR.rotation.z = -0.7;
  bear.add(body, head, muzzle, e1, e2, ear1, ear2, armR);
  bear.userData.arm = armR;
  bear.position.set(3.2, 0, -5.6);
  bear.traverse(o => { o.castShadow = true; });
  scene.add(bear);
}

/* かごの姿勢: upright(テスト) → tipped(接続〜送風) → 直立 */
const basketState = { pose: 'upright', tipT: -1, connectedCount: 0 };
const BASKET_START = new T.Vector3(-4.6, 0, -5.2);
basket.position.copy(BASKET_START);
basket.rotation.y = 0.55;
scene.add(basket);
function basketPose(riE) { // tipped → 直立（rise 連動）
  const tip = 1 - riE;
  basket.position.set(0, lerp(0.66, 0.02, riE) * tip + 0.02, lerp(-0.55, 0, riE));
  basket.rotation.set(-tip * 1.25, 0, 0);
}

/* ============================== 吊りケーブル（カラビナ接続） ============================== */
const ropeMat = new T.MeshStandardMaterial({ color: COL('#d9c49a'), roughness: 0.85 });
const cables = [];
{
  // 実機通り赤・黒のロードケーブル。最初は交差して散らばっている
  const colsC = ['#c0392b', '#3a3d44', '#c0392b', '#3a3d44'];
  const loose = [ [2.1, -3.1], [-1.0, -3.4], [1.0, -3.3], [-2.1, -3.0] ]; // 交差配置（0と2, 1と3が入れ違い）
  for (let i = 0; i < 4; i++) {
    const mat = new T.MeshStandardMaterial({ color: COL(colsC[i]), roughness: 0.6, metalness: 0.2 });
    const mesh = new T.Mesh(new T.BufferGeometry(), mat);
    mesh.frustumCulled = false;
    const carab = new T.Mesh(new T.TorusGeometry(0.13, 0.045, 8, 14),
      new T.MeshStandardMaterial({ color: COL('#e8b83a'), metalness: 0.85, roughness: 0.3, emissive: COL('#ffd23f'), emissiveIntensity: 0.35 }));
    carab.castShadow = true;
    scene.add(mesh, carab);
    cables.push({
      state: 'loose',   // loose | drag | fly | connected
      end: new T.Vector3(loose[i][0], 0.16, loose[i][1]),
      flyFrom: new T.Vector3(), flyT: 0,
      mesh, carab, ringIdx: i,
    });
  }
}
const _mp = new T.Vector3(), _rp = new T.Vector3(), _mid = new T.Vector3();
function ringWorldPos(i, out) {
  basket.updateMatrixWorld();
  return out.copy(cableRings[i].position).applyMatrix4(basket.matrixWorld);
}
function rebuildCable(i) {
  const c = cables[i];
  mouthRingPoint(c.ringIdx, 4, _mp);
  _mp.add(aerostat.position);
  let end = c.end;
  if (c.state === 'connected') { end = ringWorldPos(c.ringIdx, _rp); }
  const dist = _mp.distanceTo(end);
  const rest = c.state === 'connected' ? 2.4 : 4.2;
  const sag = Math.max(0.03, (rest - dist) * 0.4);
  _mid.lerpVectors(_mp, end, 0.5); _mid.y = Math.max(0.06, _mid.y - sag);
  const curve = new T.CatmullRomCurve3([_mp.clone(), _mid.clone(), end.clone()]);
  const g = new T.TubeGeometry(curve, 10, 0.032, 6, false);
  c.mesh.geometry.dispose(); c.mesh.geometry = g;
  c.carab.position.copy(end);
  if (c.state !== 'connected') c.carab.position.y = Math.max(0.12, end.y);
  c.carab.rotation.y = timeNow * 0.5 + i;
}
function rebuildCables() { for (let i = 0; i < 4; i++) rebuildCable(i); }

/* ============================== クラウンライン ============================== */
const crownLine = new T.Mesh(new T.BufferGeometry(), ropeMat.clone());
crownLine.frustumCulled = false; crownLine.visible = false;
scene.add(crownLine);
let crownAnchorZ = 25, crownDropT = -1;
function rebuildCrownLine() {
  if (!crownLine.visible) return;
  const a = crownCap.position.clone().add(aerostat.position);
  let b = new T.Vector3(0, 0.25, crownAnchorZ);
  if (crownDropT >= 0) { // 立ち上げ完了→ロープを放して落ちる
    const k = clamp(crownDropT, 0, 1);
    b.lerpVectors(b, new T.Vector3(0, 0.1, 12), k);
    crownLine.material.transparent = true;
    crownLine.material.opacity = 1 - Math.max(0, crownDropT - 1) * 1.4;
  }
  const dist = a.distanceTo(b);
  const sag = Math.max(0.05, (27 - dist) * 0.18);
  const mid = new T.Vector3().lerpVectors(a, b, 0.5); mid.y = Math.max(0.1, mid.y - sag);
  const g = new T.TubeGeometry(new T.CatmullRomCurve3([a, mid, b]), 12, 0.035, 6, false);
  crownLine.geometry.dispose(); crownLine.geometry = g;
}

/* ============================== 係留（クイックリリース）と杭 ============================== */
const stake = new T.Group();
{
  const w = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 0.9, 8),
    new T.MeshStandardMaterial({ color: COL('#8a5a30'), roughness: 0.85 }));
  w.rotation.z = 0.25; w.position.y = 0.3; w.castShadow = true;
  stake.add(w);
  stake.position.set(1.2, 0, -5.2);
  scene.add(stake);
}
const qrHandle = new T.Group();
{
  const red = new T.MeshStandardMaterial({ color: COL('#e03434'), roughness: 0.5 });
  const grip = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.42, 10), red);
  grip.rotation.z = Math.PI / 2; grip.position.y = 0.72;
  const ringP = new T.Mesh(new T.TorusGeometry(0.11, 0.03, 8, 14), red);
  ringP.position.y = 0.56;
  qrHandle.add(grip, ringP);
  qrHandle.position.copy(stake.position);
  scene.add(qrHandle);
}
const moorRope = new T.Mesh(new T.BufferGeometry(), ropeMat.clone());
moorRope.frustumCulled = false; moorRope.visible = false; scene.add(moorRope);
let moorReleased = false, moorFallT = -1;
function rebuildMooring() {
  const a = new T.Vector3(0.55, 0.9, -0.6);
  basket.updateMatrixWorld();
  a.applyMatrix4(basket.matrixWorld);
  const b = new T.Vector3().copy(stake.position); b.y = 0.55;
  if (moorReleased) {
    const k = clamp(moorFallT, 0, 1);
    a.lerpVectors(a, new T.Vector3(stake.position.x, 0.1, stake.position.z + 0.7), k);
    moorRope.material.opacity = 1 - Math.max(0, moorFallT - 1.5) * 2;
    moorRope.material.transparent = true;
  }
  const dist = a.distanceTo(b);
  const sag = Math.max(0.05, (5.2 - dist) * 0.35);
  const mid = new T.Vector3().lerpVectors(a, b, 0.5); mid.y = Math.max(0.08, mid.y - sag);
  const g = new T.TubeGeometry(new T.CatmullRomCurve3([a, mid, b]), 12, 0.035, 6, false);
  moorRope.geometry.dispose(); moorRope.geometry = g;
}

/* ============================== 送風ファン ============================== */
const fan = new T.Group();
const fanBlades = new T.Group();
const starterHandle = new T.Group();
{
  const yellow = new T.MeshStandardMaterial({ color: COL('#f2b632'), metalness: 0.35, roughness: 0.45 });
  const dark = new T.MeshStandardMaterial({ color: COL('#3c4048'), metalness: 0.6, roughness: 0.4 });
  const ring1 = new T.Mesh(new T.TorusGeometry(1.0, 0.09, 10, 28), yellow);
  const ring2 = new T.Mesh(new T.TorusGeometry(1.0, 0.05, 8, 28), dark); ring2.position.z = 0.28;
  const hub = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.35, 12), dark);
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const bl = new T.Mesh(new T.BoxGeometry(0.75, 0.3, 0.03), dark);
    bl.position.set(Math.cos(i / 5 * TAU) * 0.55, Math.sin(i / 5 * TAU) * 0.55, 0);
    bl.rotation.z = i / 5 * TAU + Math.PI / 2; bl.rotation.y = 0.6;
    fanBlades.add(bl);
  }
  for (let i = 0; i < 8; i++) {
    const bar = new T.Mesh(new T.BoxGeometry(0.035, 2.0, 0.02), dark);
    bar.rotation.z = i / 8 * Math.PI; bar.position.z = 0.3;
    fan.add(bar);
  }
  const motor = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.5, 14), yellow);
  motor.rotation.x = Math.PI / 2; motor.position.z = -0.35;
  const frame = new T.Group();
  for (const sx of [-0.8, 0.8]) {
    const leg = new T.Mesh(new T.BoxGeometry(0.09, 1.35, 0.09), yellow);
    leg.position.set(sx, -0.65, 0.15); leg.rotation.x = -0.2; frame.add(leg);
  }
  const wheelM = new T.MeshStandardMaterial({ color: COL('#22252a'), roughness: 0.7 });
  for (const sx of [-0.8, 0.8]) {
    const wh = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.12, 14), wheelM);
    wh.rotation.z = Math.PI / 2; wh.position.set(sx, -1.28, 0.35); frame.add(wh);
  }
  // スターターロープ（エンジン後ろのT字ハンドル）
  const cord = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.4, 6),
    new T.MeshStandardMaterial({ color: COL('#f2ead8'), roughness: 0.8 }));
  cord.position.y = -0.2;
  const tBar = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.3, 8),
    new T.MeshStandardMaterial({ color: COL('#e03434'), roughness: 0.5 }));
  tBar.rotation.z = Math.PI / 2; tBar.position.y = -0.44;
  starterHandle.add(cord, tBar);
  starterHandle.position.set(0.34, -0.1, -0.62);
  fan.add(ring1, ring2, hub, fanBlades, motor, frame, starterHandle);
  fan.position.set(6.4, 1.5, -6.2);   // ステップ7でクルーが押してくるまで駐機
  fan.lookAt(0, 1.6, 1.4);
  fan.traverse(o => { o.castShadow = true; });
  scene.add(fan);
}
const windStreaks = [];
{
  const wm = new T.MeshBasicMaterial({ color: COL('#eef7ff'), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  for (let i = 0; i < 26; i++) {
    const s = new T.Mesh(new T.PlaneGeometry(0.05, 0.8), wm.clone());
    s.userData.t = Math.random();
    scene.add(s); windStreaks.push(s);
  }
}
const fanFrom = new T.Vector3(2.5, 1.5, -2.0), fanTo = new T.Vector3(-0.3, 1.3, 2.6);

/* ============================== 収納袋・パイバル・小物 ============================== */
const envBag = new T.Group();
{
  const red = new T.MeshStandardMaterial({ color: COL('#b8383f'), roughness: 0.85 });
  const body = new T.Mesh(new T.CylinderGeometry(0.85, 0.9, 1.5, 14), red);
  body.rotation.x = Math.PI / 2; body.position.y = 0.85;
  const lid = new T.Mesh(new T.TorusGeometry(0.82, 0.1, 8, 16), red);
  lid.position.set(0, 0.85, 0.78);
  envBag.add(body, lid);
  envBag.position.set(1.9, 0, 1.1);
  envBag.rotation.y = -0.3;
  envBag.traverse(o => { o.castShadow = true; });
  scene.add(envBag);
}
const pibal = new T.Group();
{
  const ball = new T.Mesh(new T.SphereGeometry(0.28, 12, 10),
    new T.MeshStandardMaterial({ color: COL('#e03434'), roughness: 0.35 }));
  ball.position.y = 1.15; ball.castShadow = true;
  const str = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 1.0, 4),
    new T.MeshBasicMaterial({ color: COL('#f5f0e0') }));
  str.position.y = 0.55;
  pibal.add(ball, str);
  pibal.position.set(3.7, 0, -4.9);
  scene.add(pibal);
}
let pibalState = { released: false, t: 0 };
/* 口もちハンドルの目印（ステップ6のみ） */
const mouthHandles = [];
{
  const hm = new T.MeshBasicMaterial({ color: COL('#ffd23f'), transparent: true, opacity: 0.9, depthWrite: false });
  for (const side of [-1, 1]) {
    const grp = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(0.55, 0.09, 8, 20), hm.clone());
    ring.rotation.x = -Math.PI / 2;
    const knob = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), hm.clone());
    knob.position.y = 0.18;
    grp.add(ring, knob);
    grp.visible = false; grp.userData.side = side;
    scene.add(grp); mouthHandles.push(grp);
  }
}
{
  const crateM = new T.MeshStandardMaterial({ color: COL('#a8804f'), roughness: 0.85 });
  const c1 = new T.Mesh(new T.BoxGeometry(0.8, 0.6, 0.6), crateM); c1.position.set(3.9, 0.3, -4.4);
  const c2 = new T.Mesh(new T.BoxGeometry(0.6, 0.5, 0.6), crateM); c2.position.set(3.6, 0.25, -5.2); c2.rotation.y = 0.4;
  c1.castShadow = c2.castShadow = true;
  scene.add(c1, c2);
  const coil = new T.Group();
  for (let i = 0; i < 3; i++) {
    const t = new T.Mesh(new T.TorusGeometry(0.32 - i * 0.02, 0.05, 6, 16), ropeMat);
    t.rotation.x = Math.PI / 2; t.position.y = 0.06 + i * 0.09;
    coil.add(t);
  }
  coil.position.set(4.6, 0, -3.3); scene.add(coil);
}
const flags = new T.Group();
let flagAmp = 1;
{
  const p1 = new T.Vector3(-9, 0, -8), p2 = new T.Vector3(-3, 0, -11);
  const poleM = new T.MeshStandardMaterial({ color: COL('#e8e2d5'), roughness: 0.6 });
  for (const p of [p1, p2]) {
    const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 2.6, 8), poleM);
    pole.position.set(p.x, 1.3, p.z); pole.castShadow = true; flags.add(pole);
  }
  const fcols = ['#ff8fb3', '#ffd166', '#8fd8ff', '#c9a5ff', '#7ee8c0'];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const x = lerp(p1.x, p2.x, t), z = lerp(p1.z, p2.z, t);
    const y = 2.5 - Math.sin(t * Math.PI) * 0.45;
    const tri = new T.Mesh(new T.ConeGeometry(0.16, 0.42, 3),
      new T.MeshLambertMaterial({ color: COL(fcols[i % 5]), side: T.DoubleSide }));
    tri.position.set(x, y - 0.2, z); tri.rotation.x = Math.PI;
    tri.userData.ph = i; flags.add(tri);
  }
  scene.add(flags);
}

/* ============================== きらきらパーティクル ============================== */
const starTex = canvasTex(64, (g) => {
  g.clearRect(0, 0, 64, 64);
  g.translate(32, 32); g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 6 : 15, a = i / 10 * TAU - Math.PI / 2;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
});
const SPARK_N = 240;
const sparkGeo = new T.BufferGeometry();
const sparkPos = new Float32Array(SPARK_N * 3), sparkCol = new Float32Array(SPARK_N * 3);
const sparkVel = new Float32Array(SPARK_N * 3), sparkLife = new Float32Array(SPARK_N).fill(0);
sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('color', new T.BufferAttribute(sparkCol, 3));
const sparks = new T.Points(sparkGeo, new T.PointsMaterial({
  map: starTex, size: 0.55, transparent: true, depthWrite: false,
  vertexColors: true, blending: T.AdditiveBlending, sizeAttenuation: true,
}));
sparks.frustumCulled = false;
scene.add(sparks);
let sparkCursor = 0;
const sparkPalette = ['#fff3a0', '#ffd0e8', '#b8f0ff', '#d0ffc0'].map(COL);
const firePalette = ['#fff3a0', '#ffb45e', '#9fd4ff', '#ffdf80'].map(COL);
function burst(p, n = 18, spd = 3, firey = false) {
  for (let i = 0; i < n; i++) {
    const k = sparkCursor = (sparkCursor + 1) % SPARK_N;
    sparkLife[k] = 1;
    sparkPos[k * 3] = p.x; sparkPos[k * 3 + 1] = p.y; sparkPos[k * 3 + 2] = p.z;
    const a = Math.random() * TAU, b = Math.random() * Math.PI;
    const s = spd * (0.4 + Math.random() * 0.8);
    sparkVel[k * 3] = Math.sin(b) * Math.cos(a) * s;
    sparkVel[k * 3 + 1] = Math.cos(b) * s + 1.5;
    sparkVel[k * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
    const c = (firey ? firePalette : sparkPalette)[k % 4];
    sparkCol[k * 3] = c.r; sparkCol[k * 3 + 1] = c.g; sparkCol[k * 3 + 2] = c.b;
  }
}
function updateSparks(dt) {
  for (let k = 0; k < SPARK_N; k++) {
    if (sparkLife[k] <= 0) { sparkPos[k * 3 + 1] = -999; continue; }
    sparkLife[k] -= dt * 0.7;
    sparkVel[k * 3 + 1] -= dt * 4;
    sparkPos[k * 3] += sparkVel[k * 3] * dt;
    sparkPos[k * 3 + 1] += sparkVel[k * 3 + 1] * dt;
    sparkPos[k * 3 + 2] += sparkVel[k * 3 + 2] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.color.needsUpdate = true;
}

/* ============================== サウンド ============================== */
const AudioEngine = (() => {
  let ctx = null, master = null, fanGain = null, burnGain = null, windGain = null, bgmGain = null;
  let started = false, noiseBuffer = null;
  function noiseBuf(c) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function init() {
    if (started) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    started = true;
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    noiseBuffer = noiseBuf(ctx);
    const fs = ctx.createBufferSource(); fs.buffer = noiseBuffer; fs.loop = true;
    const fb = ctx.createBiquadFilter(); fb.type = 'bandpass'; fb.frequency.value = 320; fb.Q.value = 0.7;
    fanGain = ctx.createGain(); fanGain.gain.value = 0;
    fs.connect(fb); fb.connect(fanGain); fanGain.connect(master); fs.start();
    const bs = ctx.createBufferSource(); bs.buffer = noiseBuffer; bs.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 900;
    burnGain = ctx.createGain(); burnGain.gain.value = 0;
    bs.connect(bf); bf.connect(burnGain); burnGain.connect(master); bs.start();
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 48;
    const sg = ctx.createGain(); sg.gain.value = 0.25;
    saw.connect(sg); sg.connect(burnGain); saw.start();
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuffer; ws.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    ws.connect(wf); wf.connect(windGain); windGain.connect(master); ws.start();
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.22; bgmGain.connect(master);
    bgmNext = ctx.currentTime + 0.2;
  }
  const MELODY = [523.25, 523.25, 783.99, 783.99, 880, 880, 783.99, 0,
    698.46, 698.46, 659.25, 659.25, 587.33, 587.33, 523.25, 0,
    783.99, 783.99, 698.46, 698.46, 659.25, 659.25, 587.33, 0,
    783.99, 783.99, 698.46, 698.46, 659.25, 659.25, 587.33, 0];
  let bgmIdx = 0, bgmNext = 0;
  function tickBgm() {
    if (!ctx) return;
    while (bgmNext < ctx.currentTime + 0.35) {
      const f = MELODY[bgmIdx % MELODY.length];
      if (f > 0) {
        for (const [mul, amp] of [[1, 0.5], [2, 0.14], [4, 0.05]]) {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
          const g = ctx.createGain();
          g.gain.setValueAtTime(amp, bgmNext);
          g.gain.exponentialRampToValueAtTime(0.001, bgmNext + 0.9);
          o.connect(g); g.connect(bgmGain);
          o.start(bgmNext); o.stop(bgmNext + 1);
        }
      }
      bgmIdx++; bgmNext += 0.42;
    }
  }
  function blip(freq, dur = 0.12, type = 'sine', vol = 0.3, slide = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }
  function noiseHit(freq, dur = 0.15, vol = 0.3, type = 'highpass') {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(); s.stop(ctx.currentTime + dur + 0.05);
  }
  return {
    init, tickBgm,
    setFan(v) { if (fanGain) fanGain.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.1); },
    setBurner(v) { if (burnGain) burnGain.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.08); },
    setWind(v) { if (windGain) windGain.gain.setTargetAtTime(v * 0.3, ctx.currentTime, 0.4); },
    pop() { blip(500, 0.1, 'triangle', 0.35, 2.2); },
    click() { blip(1300, 0.05, 'square', 0.2); },
    kachin() { blip(1900, 0.06, 'square', 0.22); setTimeout(() => blip(2800, 0.12, 'sine', 0.18), 40); },
    spark() { noiseHit(3200, 0.05, 0.25); blip(2400, 0.03, 'square', 0.12); },
    velcro() { noiseHit(1800, 0.14, 0.3); },
    starter(rev) { blip(70, 0.35, 'sawtooth', 0.3, rev ? 3.2 : 1.6); noiseHit(500, 0.3, 0.2, 'bandpass'); },
    snap() { noiseHit(2400, 0.08, 0.35); blip(320, 0.1, 'triangle', 0.3, 0.5); },
    chime() { blip(880, 0.4, 'sine', 0.3); setTimeout(() => blip(1318.5, 0.5, 'sine', 0.3), 110); },
    fanfare() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => blip(f, 0.5, 'sine', 0.32), i * 130)); },
    boing() { blip(220, 0.25, 'sine', 0.3, 2.8); },
    whoosh() { blip(200, 0.5, 'sine', 0.15, 0.4); },
  };
})();

/* ============================== UI ============================== */
const ui = {
  say: document.getElementById('say'),
  stars: document.getElementById('stars'),
  hand: document.getElementById('hand'),
  holdBtn: document.getElementById('holdBtn'),
  holdLabel: document.getElementById('holdLabel'),
  title: document.getElementById('title'),
  startBtn: document.getElementById('startBtn'),
  replay: document.getElementById('replay'),
};
const N_STEPS = 10;
for (let i = 0; i < N_STEPS; i++) {
  const s = document.createElement('span'); s.textContent = '⭐'; ui.stars.appendChild(s);
}
function say(text) {
  ui.say.textContent = text;
  ui.say.classList.remove('hidden');
}
function starOn(i) { const c = ui.stars.children[i]; if (c) c.classList.add('on'); }
function domBurst(x, y) {
  const em = ['⭐', '✨', '🌟', '💛', '💖'];
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('div');
    d.className = 'burst'; d.textContent = em[i % em.length];
    d.style.left = x + 'px'; d.style.top = y + 'px';
    document.body.appendChild(d);
    requestAnimationFrame(() => {
      const a = Math.random() * TAU;
      d.style.transform = `translate(${Math.cos(a) * (60 + Math.random() * 80)}px, ${Math.sin(a) * 60 - 80}px) scale(${0.6 + Math.random()}) rotate(${(Math.random() - 0.5) * 180}deg)`;
      d.style.opacity = '0';
    });
    setTimeout(() => d.remove(), 1100);
  }
}
function showHold(emoji, label) {
  ui.holdBtn.textContent = emoji;
  ui.holdBtn.classList.remove('hidden');
  ui.holdLabel.textContent = label;
  ui.holdLabel.classList.remove('hidden');
  setHoldProgress(0);
}
function hideHold() { ui.holdBtn.classList.add('hidden'); ui.holdLabel.classList.add('hidden'); }
function setHoldProgress(t) {
  ui.holdBtn.style.background = `conic-gradient(#ffd23f ${t * 360}deg, rgba(255,255,255,.88) ${t * 360}deg)`;
}

/* ============================== ステート機械 ============================== */
const Game = {
  phase: 'title',
  step: 0,
  holding: false,
  seqT: 0, flightT: 0, idleT: 0,
  sparkCount: 0, testBurn: 0, ignited: false,
  strokes: 0, fanRunning: false,
  tabsLeft: 5, cablesLeft: 4,
  openL: 0, openR: 0,
  crownReady: false,
  bearIn: false,
  altOffset: 0, burning: false, venting: false,
  _saidTags: {},
};
let tapTargets = [];    // {getPos, radius, drag, onTap, onDragMove, onDragEnd}
const _proj = new T.Vector3();
function screenPos(w) {
  _proj.copy(w).project(camera);
  return { x: (_proj.x * 0.5 + 0.5) * innerWidth, y: (-_proj.y * 0.5 + 0.5) * innerHeight, z: _proj.z };
}
const camCtl = {
  pos: new T.Vector3(16, 5, -15), look: new T.Vector3(0, 2, 2),
  tPos: new T.Vector3(16, 5, -15), tLook: new T.Vector3(0, 2, 2),
  speed: 1.6,
  set(p, l, snap) {
    this.tPos.set(p[0], p[1], p[2]); this.tLook.set(l[0], l[1], l[2]);
    if (snap) { this.pos.copy(this.tPos); this.look.copy(this.tLook); }
  },
  update(dt) {
    const k = 1 - Math.exp(-dt * this.speed);
    this.pos.lerp(this.tPos, k); this.look.lerp(this.tLook, k);
    camera.position.copy(this.pos);
    camera.lookAt(this.look);
  }
};
function portrait() { return innerHeight > innerWidth * 1.05; }
function camScale() { return portrait() ? 1.45 : 1; }
function sayOnce(tag, text) { if (!Game._saidTags[tag]) { Game._saidTags[tag] = 1; say(text); } }

let holdProgress = 0;
let ropesDirty = true;

/* ---- 全10ステップ（全部ちがうジェスチャ） ---- */
const STEPS = [
  { /* 1 パイバル放球（はなす） */
    enter() {
      say('🎈 ちいさな ふうせんを そらへ！\nかぜを しらべよう');
      const s = camScale();
      camCtl.set([8 * s, 3 * s, -10 * s], [3.5, 1.5, -4.5]);
      tapTargets = [{
        getPos: () => new T.Vector3(pibal.position.x, pibal.position.y + 1.2, pibal.position.z),
        radius: 130,
        onTap() { releasePibal(); },
        drag: true,
        onDragMove(dx, dy) { if (dy < -20) releasePibal(); }, // 上へスワイプでも
      }];
    },
    hint: () => pibalState.released ? null : new T.Vector3(pibal.position.x, pibal.position.y + 1.2, pibal.position.z),
    test: () => ({ from: new T.Vector3(3.7, 1.2, -4.9), to: new T.Vector3(3.7, 3.5, -4.9) }),
  },
  { /* 2 バーナーテスト（連打点火→ながおしで炎） */
    enter() {
      say('🔥 カチカチ タッチして\nバーナーに ひを つけよう！');
      const s = camScale();
      camCtl.set([-1 * s, 2.4 * s, -9.5 * s], [-4.6, 1.6, -5.2]);
      tapTargets = [{
        getPos: () => { basket.updateMatrixWorld(); return new T.Vector3(0, 2.4, 0).applyMatrix4(basket.matrixWorld); },
        radius: 150,
        onTap(pt, sp) {
          if (Game.ignited) return;
          Game.sparkCount++;
          AudioEngine.spark();
          basket.updateMatrixWorld();
          const bp = new T.Vector3(0, 2.5, 0).applyMatrix4(basket.matrixWorld);
          burst(bp, 6, 1.5, true);
          if (Game.sparkCount >= 3) {
            Game.ignited = true;
            pilot.visible = true;
            AudioEngine.pop();
            say('🔥 ついた！ こんどは ながおしで\nおおきな ひを だしてみよう！');
            showHold('🔥', 'ながおし してね');
          }
        },
      }];
    },
    hint() {
      basket.updateMatrixWorld();
      return new T.Vector3(0, 2.4, 0).applyMatrix4(basket.matrixWorld);
    },
    test: () => null,
  },
  { /* 3 布をひっぱりだす（引く） */
    enter() {
      say('🫳 ふくろから ぬのを\nずるずる ひっぱりだそう！');
      const s = camScale();
      camCtl.set([13 * s, 6 * s, -9 * s], [0, 0.6, 5]);
      envelope.visible = crownCap.visible = ventGroup.visible = true; // 袋から登場
      burst(new T.Vector3(1.2, 1, 1.4), 12, 2);
    },
    hint() { // 布の先端（つかむところ）
      const zLen = lerp(0.2, 1, easeOut(P.spread));
      return new T.Vector3(0, 0.8, 1.45 + 15.2 * zLen);
    },
    test() {
      const zLen = lerp(0.2, 1, easeOut(P.spread));
      return { from: new T.Vector3(0, 0.8, 1.45 + 15.2 * zLen), to: new T.Vector3(0, 0.8, 15.5) };
    },
  },
  { /* 4 カラビナ接続（ドラッグ&スナップ、交差なおし） */
    enter() {
      say('🪝 カラビナを ひっぱって\nわっかに カチン と つなごう！');
      const s = camScale();
      camCtl.set([4.6 * s, 4.8 * s, -8 * s], [0, 0.6, -1.2]);
      tapTargets = cables.map((c, i) => ({
        getPos: () => c.carab.position,
        radius: 95,
        drag: true,
        active: () => c.state === 'loose',
        onDragMove(dx, dy, world) {
          if (c.state !== 'loose' && c.state !== 'drag') return;
          if (c.state === 'loose') c.state = 'drag';
          if (world) {
            c.end.set(clamp(world.x, -5, 5), 0.55, clamp(world.z, -5.5, 4));
            ropesDirty = true;
          }
        },
        onDragEnd() { if (c.state === 'drag') flyCable(i); },
        onTap() { if (c.state === 'loose') flyCable(i); },
      }));
    },
    hint() {
      const c = cables.find(c => c.state === 'loose');
      return c ? c.carab.position.clone() : null;
    },
    test() {
      const i = cables.findIndex(c => c.state === 'loose');
      if (i < 0) return null;
      return { from: cables[i].carab.position.clone(), to: ringWorldPos(i, new T.Vector3()) };
    },
  },
  { /* 5 ベント点検（ペタペタ） */
    enter() {
      say('🔴 てっぺんの べんを\nペタペタ とじよう！');
      const s = camScale();
      camCtl.set([3.5 * s, 7.5 * s, 21.5 * s], [0, 0.3, 16.2]);
      tapTargets = ventTabs.map((tab) => ({
        getPos: () => { ventGroup.updateMatrixWorld(); return tab.position.clone().applyMatrix4(ventGroup.matrixWorld); },
        radius: 80,
        active: () => !tab.userData.done,
        onTap() {
          if (tab.userData.done) return;
          tab.userData.done = true;
          tab.rotation.z = 0;
          tab.position.y = 0.07;
          tab.material.emissiveIntensity = 0;
          AudioEngine.velcro();
          ventGroup.updateMatrixWorld();
          burst(tab.position.clone().applyMatrix4(ventGroup.matrixWorld), 8, 1.5);
          Game.tabsLeft--;
          if (Game.tabsLeft <= 0) setTimeout(() => completeStep(), 450);
        },
      }));
    },
    hint() {
      const tab = ventTabs.find(t => !t.userData.done);
      if (!tab) return null;
      ventGroup.updateMatrixWorld();
      return tab.position.clone().applyMatrix4(ventGroup.matrixWorld);
    },
    test: () => null,
  },
  { /* 6 口をひらく（よこにドラッグ） */
    enter() {
      say('👐 ぬのの くちを よこに\nぐいっと ひらこう！');
      const s = camScale();
      camCtl.set([4.5 * s, 6 * s, -3.5 * s], [0, 0.4, 1.4]);
      mouthHandles.forEach(h => h.visible = true);
      const mkHandle = (side) => ({ // side: -1 left(+x?), +1
        getPos: () => {
          const r = ringR[0];
          const open = side < 0 ? Game.openL : Game.openR;
          return new T.Vector3(side * r * lerp(1.32, 1.05, open), 0.5 + open * 1.4, 1.45);
        },
        radius: 120,
        drag: true,
        active: () => (side < 0 ? Game.openL : Game.openR) < 0.9,
        onDragMove(dx, dy) {
          // 外向き or 上向きのドラッグ量で開く
          const amt = (Math.abs(dx) + Math.max(0, -dy)) / Math.min(innerWidth, innerHeight);
          if (side < 0) Game.openL = clamp(Game.openL + amt * 1.8, 0, 1);
          else Game.openR = clamp(Game.openR + amt * 1.8, 0, 1);
          P.mouthOpen = (Game.openL + Game.openR) / 2;
          ropesDirty = true;
          if (Game.openL >= 0.9 && Game.openR >= 0.9 && Game.phase === 'step6') {
            Game.phase = 'step6done';
            P.mouthOpen = 1;
            AudioEngine.whoosh();
            setTimeout(() => completeStep(), 400);
          }
        },
      });
      tapTargets = [mkHandle(-1), mkHandle(1)];
    },
    hint() {
      const r = ringR[0];
      if (Game.openL < 0.9) return new T.Vector3(-r * 1.3, 0.6, 1.45);
      if (Game.openR < 0.9) return new T.Vector3(r * 1.3, 0.6, 1.45);
      return null;
    },
    test() {
      const r = ringR[0];
      if (Game.openL < 0.9) return { from: new T.Vector3(-r * 1.3, 0.6, 1.45), to: new T.Vector3(-r * 1.32 - 3, 2.2, 1.45) };
      return { from: new T.Vector3(r * 1.3, 0.6, 1.45), to: new T.Vector3(r * 1.32 + 3, 2.2, 1.45) };
    },
  },
  { /* 7 スターターを引いてファン始動（したに引く）→ 送風で65% */
    enter() {
      say('🌀 ロープを したに ひっぱって\nファンを うごかそう！');
      Game.fanMoveT = 0;  // クルーがファンを押してくる
      const s = camScale();
      camCtl.set([5.5 * s, 2.6 * s, -5.5 * s], [2.6, 1.2, -2.3]);
      tapTargets = [{
        getPos: () => { fan.updateMatrixWorld(); return starterHandle.children[1].getWorldPosition(new T.Vector3()); },
        radius: 150,
        drag: true,
        active: () => !Game.fanRunning,
        onDragMove(dx, dy) { /* 引き量は onDragEnd で判定するため蓄積のみ */ },
        onDragEnd(dx, dy) {
          if (Game.fanRunning) return;
          if (dy > 30 && dy > Math.abs(dx) * 0.5) starterStroke();
        },
        onTap() { if (!Game.fanRunning) starterStroke(); }, // タップでも半カウント
      }];
    },
    hint() {
      if (Game.fanRunning) return null;
      fan.updateMatrixWorld();
      return starterHandle.children[1].getWorldPosition(new T.Vector3());
    },
    test() {
      if (Game.fanRunning) return null;
      fan.updateMatrixWorld();
      const p = starterHandle.children[1].getWorldPosition(new T.Vector3());
      return { from: p, to: p.clone().add(new T.Vector3(0, -2.2, 0)) };
    },
  },
  { /* 8 クラウンライン綱引きで起こす（ぐーっと引く） */
    enter() {
      say('🪢 てっぺんの ロープを ぐーっと\nひっぱって ききゅうを おこそう！');
      crownLine.visible = true;
      Game.crownReady = true;
      P.mouthOpen = 0; // 空気圧で口は保たれる（inflate側で表現）
      // クルーがファンを引き離す
    },
    hint() { return P.rise < 1 ? new T.Vector3(0, 1.2, 20) : null; },
    test: () => P.rise < 1 ? { from: new T.Vector3(0, 1.2, 20), to: new T.Vector3(0, 0.4, 24) } : null,
  },
  { /* 9 くま搭乗→かごを押さえる（ながおし） */
    enter() {
      say('🧸 パイロットが のるよ！');
      const s = camScale();
      camCtl.set([9 * s, 3.5 * s, -10 * s], [0, 3, 0]);
      Game.bearIn = false;
      bear.userData.jump = 0;
      setTimeout(() => {
        say('🤲 ふわふわ しないように\nかごを ぎゅーっと おさえてて！');
        showHold('🧺', 'ぎゅーっと おさえてね');
      }, 1400);
    },
    hint: () => null,
    test: () => null,
  },
  { /* 10 クイックリリースを引き抜く */
    enter() {
      hideHold();
      say('🔴 あかい ハンドルを\nひきぬこう！ しゅっぱつだ！');
      const s = camScale();
      camCtl.set([7.5 * s, 2.8 * s, -9.5 * s], [1.2, 1.2, -4.2]);
      camCtl.speed = 1.2;
      tapTargets = [{
        getPos: () => new T.Vector3(stake.position.x, 0.75, stake.position.z),
        radius: 140,
        drag: true,
        qrTaps: 0,
        onDragMove(dx, dy) { if (Math.hypot(dx, dy) > 45) startLaunch(); },
        onTap() { this.qrTaps = (this.qrTaps || 0) + 1; AudioEngine.click(); if (this.qrTaps >= 2) startLaunch(); },
      }];
    },
    hint: () => new T.Vector3(stake.position.x, 0.75, stake.position.z),
    test: () => ({ from: new T.Vector3(1.2, 0.75, -5.2), to: new T.Vector3(1.2, 0.2, -3.2) }),
  },
];

function enterStep(i) {
  Game.step = i;
  Game.phase = 'step' + (i + 1);
  Game.idleT = 0;
  tapTargets = [];
  holdProgress = 0;
  camCtl.speed = 1.6;
  STEPS[i].enter();
}
function completeStep() {
  AudioEngine.chime();
  starOn(Game.step);
  domBurst(innerWidth / 2, innerHeight * 0.3);
  hideHold();
  const next = Game.step + 1;
  ui.say.classList.add('hidden');
  if (next < STEPS.length) setTimeout(() => enterStep(next), 650);
}

/* ---- 各ステップのアクション ---- */
function releasePibal() {
  if (pibalState.released) return;
  pibalState.released = true; pibalState.t = 0;
  AudioEngine.whoosh();
  burst(pibal.position.clone().add(new T.Vector3(0, 1.4, 0)), 12, 2);
}
function flyCable(i) {
  const c = cables[i];
  c.state = 'fly'; c.flyT = 0;
  c.flyFrom.copy(c.end);
}
function starterStroke() {
  Game.strokes++;
  starterHandle.position.y = -0.45; // びよん
  if (Game.strokes >= 3) {
    Game.fanRunning = true;
    AudioEngine.starter(true);
    say('🌀 ブォーン！ かぜが はいっていくよ！\nタッチで ぬのを ぱたぱた してみてね');
    const s = camScale();
    camCtl.speed = 0.6;
    camCtl.set([14 * s, 6.5 * s, -10 * s], [0, 2, 4]);
  } else {
    AudioEngine.starter(false);
    fanBlades.rotation.z += 2.5; // ブルン
  }
}
function startLaunch() {
  if (Game.phase === 'launch' || Game.phase === 'flight') return;
  Game.phase = 'launch';
  Game.seqT = 0;
  moorReleased = true; moorFallT = 0;
  qrHandle.visible = false;
  tapTargets = [];
  AudioEngine.snap(); AudioEngine.fanfare();
  starOn(9);
  burst(new T.Vector3(stake.position.x, 1, stake.position.z), 24, 3);
  say('🎈 リリース！ ふわ〜っ');
}

/* ============================== 入力（タップ＋ドラッグ） ============================== */
const ray = new T.Raycaster();
const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
const ndc = new T.Vector2();
const dragST = { active: false, target: null, sx: 0, sy: 0, lx: 0, ly: 0, moved: 0 };

function pointerWorld(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const out = new T.Vector3();
  return ray.ray.intersectPlane(groundPlane, out) ? out : null;
}
function pickTarget(x, y) {
  let best = null, bestD = 1e9;
  for (const tg of tapTargets) {
    if (tg.active && !tg.active()) continue;
    const sp = screenPos(tg.getPos());
    if (sp.z > 1) continue;
    const d = Math.hypot(sp.x - x, sp.y - y);
    if (d < bestD) { bestD = d; best = tg; }
  }
  const forgiving = Math.min(innerWidth, innerHeight) * 0.24;
  return (best && bestD < Math.max(best.radius, forgiving)) ? best : null;
}
function onDown(x, y) {
  AudioEngine.init();
  Game.idleT = 0;
  dragST.active = true; dragST.sx = dragST.lx = x; dragST.sy = dragST.ly = y; dragST.moved = 0;
  dragST.target = null;
  const ph = Game.phase;
  if (ph === 'flight') {
    // ベントロープなら排気、それ以外はバーナー
    const vp = ventRope.children[1].getWorldPosition(new T.Vector3());
    const sp = screenPos(vp);
    if (Math.hypot(sp.x - x, sp.y - y) < Math.min(innerWidth, innerHeight) * 0.2) {
      Game.venting = true; AudioEngine.whoosh();
    } else {
      Game.burning = true;
    }
    return;
  }
  if (ph === 'launch') {
    const w = pointerWorld(x, y);
    if (w) burst(new T.Vector3(w.x, aerostat.position.y + 2, w.z), 10, 2);
    return;
  }
  if (ph === 'step2' && Game.ignited) { Game.holding = true; return; }
  if (ph === 'step9') { Game.holding = true; return; }
  const tg = pickTarget(x, y);
  if (tg) {
    dragST.target = tg;
    if (!tg.drag && tg.onTap) { tg.onTap(pointerWorld(x, y)); domBurst(x, y); dragST.target = null; }
  }
  if (ph === 'step7' && Game.fanRunning) { // 送風中のおあそびタップ
    const w = pointerWorld(x, y);
    if (w) { burst(new T.Vector3(w.x, 1.2, w.z), 8, 2); AudioEngine.pop(); }
  }
}
function onMove(x, y) {
  if (!dragST.active) return;
  const dx = x - dragST.lx, dy = y - dragST.ly;
  dragST.lx = x; dragST.ly = y;
  dragST.moved += Math.hypot(dx, dy);
  const totDx = x - dragST.sx, totDy = y - dragST.sy;
  const ph = Game.phase;
  if (dragST.target && dragST.target.drag && dragST.target.onDragMove) {
    dragST.target.onDragMove(totDx, totDy, pointerWorld(x, y), dx, dy);
  }
  if (ph === 'step3') { // 布ひっぱり: ワールド座標に直結
    const w = pointerWorld(x, y);
    if (w) {
      const want = clamp((w.z - 2.5) / 12.5, 0, 1);
      if (want > P.spread) P.spread = Math.min(P.spread + 0.05, want); // なめらかに追従
    }
    P.spread = clamp(P.spread + Math.hypot(dx, dy) / Math.min(innerWidth, innerHeight) * 0.25, 0, 1); // 保険
    if (Math.random() < 0.3) {
      const w2 = pointerWorld(x, y);
      if (w2) burst(new T.Vector3(w2.x, 0.8, w2.z), 2, 1.2);
    }
    if (P.spread >= 0.99 && Game.phase === 'step3') {
      Game.phase = 'step3done';
      P.spread = 1;
      envBag.visible = false;
      setTimeout(() => completeStep(), 400);
    }
  }
  if (ph === 'step8' && dy > 0) { // クラウンライン: 下に引いた分だけ起きる
    const pull = dy / innerHeight;
    P.rise = clamp(P.rise + pull * 0.9, 0, 1);
    P.inflate = 0.65 + 0.35 * P.rise;
    ropesDirty = true;
    if (Math.random() < 0.2) burst(new T.Vector3(0, 1.5, 18), 2, 1.5);
  }
}
function onUp() {
  if (dragST.target && dragST.target.drag) {
    const totDx = dragST.lx - dragST.sx, totDy = dragST.ly - dragST.sy;
    if (dragST.moved < 18 && dragST.target.onTap) dragST.target.onTap();
    else if (dragST.target.onDragEnd) dragST.target.onDragEnd(totDx, totDy);
  }
  dragST.active = false; dragST.target = null;
  Game.holding = false; Game.burning = false; Game.venting = false;
}
addEventListener('pointerdown', e => { if (e.target.closest('button')) return; onDown(e.clientX, e.clientY); });
addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
addEventListener('pointerup', onUp);
addEventListener('pointercancel', onUp);
ui.holdBtn.addEventListener('pointerdown', e => { AudioEngine.init(); Game.holding = true; e.stopPropagation(); });
addEventListener('contextmenu', e => e.preventDefault());
ui.startBtn.addEventListener('click', () => {
  AudioEngine.init();
  ui.title.classList.add('hidden');
  enterStep(0);
});
ui.replay.addEventListener('click', () => location.reload());

/* ============================== 進行 update ============================== */
const _hp = new T.Vector3();
let ropeTimer = 0;
function updateGame(dt) {
  AudioEngine.tickBgm();
  const ph = Game.phase;

  /* ---- 1 パイバル ---- */
  if (pibalState.released && pibalState.t < 8) {
    pibalState.t += dt;
    const t = pibalState.t;
    pibal.position.y = t * (2.2 + t * 0.7);
    pibal.position.z += dt * (1.5 + t * 0.8);  // 風下（+Z）へ流れる
    pibal.position.x += dt * 0.4;
    pibal.rotation.z = Math.sin(t * 3) * 0.15;
    if (ph === 'step1') {
      camCtl.tLook.lerp(new T.Vector3(pibal.position.x, pibal.position.y + 1, pibal.position.z), 1 - Math.exp(-dt * 2));
      if (t > 2.6 && !Game._saidTags.pibal) {
        Game._saidTags.pibal = 1;
        say('🍃 かぜは あっちむき で おだやか！\nきょうは とばせるよ！');
        flagAmp = 0.3;
        setTimeout(() => completeStep(), 1600);
      }
    }
  }

  /* ---- 2 バーナーテスト ---- */
  if (ph === 'step2' && Game.ignited) {
    const target = Game.holding ? 1 : 0.05;
    P.burner = lerp(P.burner, target, 1 - Math.exp(-dt * 5));
    if (Game.holding) {
      Game.testBurn += dt;
      holdProgress = clamp(Game.testBurn / 1.6, 0, 1);
      setHoldProgress(holdProgress);
      if (holdProgress >= 1) {
        Game.phase = 'step2done';
        hideHold();
        P.burner = 0;
        say('✅ バーナー よし！\nかごを よこに たおすよ〜');
        basketState.tipT = 0;  // かごを倒して定位置へ
        AudioEngine.chime();
      }
    }
  }
  if (basketState.tipT >= 0 && basketState.pose === 'upright') {
    basketState.tipT += dt / 1.6;
    const t = clamp(basketState.tipT, 0, 1);
    const e = easeInOut(t);
    basket.position.lerpVectors(BASKET_START, new T.Vector3(0, 0.66, -0.55), e);
    basket.position.y = lerp(0, 0.66, e) + Math.sin(t * Math.PI) * 0.5;
    basket.rotation.y = lerp(0.55, 0, e);
    basket.rotation.x = lerp(0, -1.25, smooth((t - 0.4) / 0.6));
    if (t >= 1) {
      basketState.pose = 'tipped';
      AudioEngine.pop();
      ropesDirty = true;
      setTimeout(() => completeStep(), 500);
    }
  }

  /* ---- 4 ケーブルのスナップ飛行 ---- */
  for (let i = 0; i < 4; i++) {
    const c = cables[i];
    if (c.state === 'fly') {
      c.flyT += dt / 0.4;
      const t = clamp(c.flyT, 0, 1);
      ringWorldPos(c.ringIdx, _rp);
      c.end.lerpVectors(c.flyFrom, _rp, easeOut(t));
      c.end.y += Math.sin(t * Math.PI) * 0.8;
      ropesDirty = true;
      if (t >= 1) {
        c.state = 'connected';
        cableRings[c.ringIdx].material.emissiveIntensity = 0;
        c.carab.material.emissiveIntensity = 0;
        AudioEngine.kachin();
        burst(_rp, 12, 2);
        Game.cablesLeft--;
        if (Game.cablesLeft <= 0 && Game.phase === 'step4') {
          Game.phase = 'step4done';
          setTimeout(() => completeStep(), 500);
        }
      }
    }
  }
  if (ph === 'step4') { // 未接続リングを光らせる
    for (let i = 0; i < 4; i++) {
      cableRings[i].material.emissiveIntensity = cables[i].state === 'connected' ? 0 :
        0.6 + 0.4 * Math.sin(timeNow * 5 + i);
    }
  }

  /* ---- 7 ファンを押してくる→送風（自動でコールドインフレ 65%） ---- */
  if (Game.fanMoveT != null && Game.fanMoveT < 1) {
    Game.fanMoveT = Math.min(1, Game.fanMoveT + dt / 1.5);
    const k = easeInOut(Game.fanMoveT);
    fan.position.set(lerp(6.4, 2.6, k), 1.5, lerp(-6.2, -2.3, k));
    fanBlades.rotation.z += dt * 1.5;
  }
  if (Game.fanRunning) {
    P.fan = lerp(P.fan, 1, dt * 2);
    P.mouthOpen = Math.max(P.mouthOpen, 0.6); // 風圧で口は開いたまま
    if (ph === 'step7' && P.inflate < 0.65) {
      P.inflate = Math.min(0.65, P.inflate + dt * 0.075);
      ropesDirty = true;
      if (P.inflate > 0.3) sayOnce('cold1', '🎈 よこに ねたまま\nどんどん ふくらんでいくよ！');
      if (P.inflate >= 0.65 && Game.phase === 'step7') {
        Game.phase = 'step7done';
        sayOnce('cold2', '⛽ 65パーセント！ コールドインフレ かんりょう！');
        setTimeout(() => completeStep(), 1300);
      }
    }
  } else {
    starterHandle.position.y = lerp(starterHandle.position.y, -0.1, dt * 6);
  }

  /* ---- 8 クラウンライン（起立） ---- */
  if (ph === 'step8') {
    const s = camScale();
    const r = easeInOut(P.rise);
    // クラウン側から見る→起きるにつれ引きの画に
    camCtl.speed = 0.9;
    camCtl.set([lerp(7, 15, r) * s, lerp(3.5, 8, r) * s, lerp(23, 27, r) * s],
      [0, lerp(2, 9, r), lerp(6, 0, r)]);
    crownAnchorZ = lerp(25, 10, r); // 係が歩み寄る
    P.burner = 0.55 + 0.35 * Math.sin(timeNow * 6) * 0.5 + 0.35; // パイロットが連続バーン
    { // ファンはクルーが引き離す
      const k = smooth((P.rise - 0.05) / 0.3);
      fan.position.set(lerp(2.6, 9.5, k), 1.5, lerp(-2.3, -8.5, k));
      P.fan = lerp(P.fan, clamp(1 - P.rise * 2.5, 0, 1), dt * 2);
    }
    if (P.rise > 0.25) sayOnce('rise1', '🎈 すごい！ ゆっくり\nおきあがってきた！');
    if (P.rise > 0.7) sayOnce('rise2', '🎈 もうすこし！ ぐーっと！');
    // 引かなくても少しずつ（あきないように・失敗なし）
    if (dragST.active) P.rise = clamp(P.rise + dt * 0.02, 0, 1);
    if (Game.idleT > 7) P.rise = clamp(P.rise + dt * 0.05, 0, 1);
    P.inflate = 0.65 + 0.35 * P.rise;
    ropesDirty = true;
    if (P.rise >= 1 && Game.phase === 'step8') {
      Game.phase = 'step8done';
      crownDropT = 0; // 係がロープを放す
      say('🙌 たった！ クラウンライン はなして！');
      AudioEngine.fanfare();
      setTimeout(() => completeStep(), 1500);
    }
  }
  if (crownDropT >= 0 && crownDropT < 2.2) {
    crownDropT += dt;
    ropesDirty = true;
    if (crownDropT >= 2.2) crownLine.visible = false;
  }

  /* ---- 9 くま搭乗＆押さえ ---- */
  if (bear.userData.jump != null && bear.userData.jump < 1 && !Game.bearIn) {
    bear.userData.jump += dt / 1.1;
    const t = clamp(bear.userData.jump, 0, 1);
    const from = new T.Vector3(3.2, 0, -5.6);
    basket.updateMatrixWorld();
    const to = new T.Vector3(0, 0.55, 0).applyMatrix4(basket.matrixWorld);
    bear.position.lerpVectors(from, to, easeInOut(t));
    bear.position.y += Math.sin(t * Math.PI) * 2.6;
    if (t >= 1) {
      Game.bearIn = true;
      basket.attach(bear);
      AudioEngine.boing();
    }
  }
  if (ph === 'step9' && Game.bearIn) {
    if (Game.holding) {
      holdProgress = clamp(holdProgress + dt / 2.6, 0, 1);
      P.burner = lerp(P.burner, 0.9, dt * 5);
      // ウェイオフ: 浮きたそうにゆれる
      P.bob = Math.sin(timeNow * 1.8) * 0.2 + holdProgress * 0.35;
      aerostat.position.y = P.bob;
      ropesDirty = true;
    } else {
      P.burner = lerp(P.burner, 0.1, dt * 4);
    }
    setHoldProgress(holdProgress);
    if (holdProgress >= 1 && Game.phase === 'step9') {
      Game.phase = 'step9done';
      say('⚖️ ちょうど いいうきぐあい！');
      AudioEngine.chime();
      setTimeout(() => completeStep(), 900);
    }
  }
  if (bear.userData.arm && (ph === 'flight' || ph === 'launch')) {
    bear.userData.arm.rotation.z = -0.7 + Math.sin(timeNow * 6) * 0.5;
  }

  /* ---- launch（リリース→浮上） ---- */
  if (ph === 'launch') {
    Game.seqT += dt;
    const t = Game.seqT;
    moorFallT += dt * 0.8;
    P.burner = 0.9 + 0.1 * Math.sin(timeNow * 9);
    P.alt = Math.pow(Math.min(t, 4), 1.6) * 0.55;
    aerostat.position.y = P.bob + P.alt;
    ropesDirty = true;
    const s = camScale();
    camCtl.speed = 0.7;
    camCtl.set([lerp(10, 20, t / 4) * s, lerp(3, 6, t / 4) * s, lerp(-13, -24, t / 4) * s],
      [0, 4.5 + P.alt * 0.5, 0]);
    if (t >= 4) {
      Game.phase = 'flight';
      Game.flightT = 0;
      Game.altOffset = 0;
      ventRope.visible = true;
      say('🎈 とんだー！ そらの たびへ しゅっぱーつ！');
      AudioEngine.fanfare();
      setTimeout(() => sayOnce('ctl', '🔥 ながおし ＝ うえへ\n🔴 あかいロープ ＝ ゆっくり おりる'), 5000);
      setTimeout(() => { ui.say.classList.add('hidden'); ui.replay.classList.remove('hidden'); }, 12000);
    }
  }

  /* ---- flight（本物の操縦: バーナー=上昇 / ベント=下降） ---- */
  if (ph === 'flight') {
    Game.flightT += dt;
    const ft = Game.flightT;
    if (Game.burning) {
      Game.altOffset += dt * 9;
      P.burner = lerp(P.burner, 1, dt * 6);
      if (Math.random() < dt * 3) burst(new T.Vector3(aerostat.position.x, P.alt + 3.5, aerostat.position.z), 4, 2, true);
    } else P.burner = lerp(P.burner, 0.18 + 0.06 * Math.sin(timeNow * 7), dt * 4);
    if (Game.venting) {
      Game.altOffset -= dt * 11;
      ventGroup.scale.setScalar(0.8 + Math.sin(timeNow * 20) * 0.12); // 弁がパタパタ
      AudioEngine.setWind(1);
    }
    Game.altOffset = clamp(Game.altOffset, -70, 80);
    const profileAlt = Math.min(150, 4 + ft * 3.1);
    const altTarget = clamp(profileAlt + Game.altOffset, 25, 225);
    P.alt = lerp(P.alt, altTarget, 1 - Math.exp(-dt * 0.55));
    aerostat.position.y = P.alt;
    aerostat.position.x = Math.sin(ft * 0.07) * 6 * clamp(ft / 30, 0, 1);
    aerostat.position.z = Math.sin(ft * 0.05 + 2) * 6 * clamp(ft / 30, 0, 1);
    aerostat.rotation.z = Math.sin(ft * 0.35) * 0.02;
    aerostat.rotation.x = Math.sin(ft * 0.28 + 1) * 0.015;
    flightCamera(ft);
    const lift = clamp(P.alt / 150, 0, 1);
    skyUni.uLift.value = lift;
    scene.fog.near = lerp(130, 300, lift);
    scene.fog.far = lerp(1500, 2600, lift);
    scene.fog.color.setStyle(lift > 0.5 ? '#f6d8c0' : '#f2cfa8').convertSRGBToLinear();
    AudioEngine.setWind(lift * 0.8);
    if (P.alt > 55 && !rainbow.visible) { rainbow.visible = true; AudioEngine.chime(); }
    if (rainbow.visible) rainbow.material.uniforms.uOp.value = clamp((P.alt - 55) / 40, 0, 1);
    if (P.alt > 95 && !birds.visible) birds.visible = true;
    for (const c of clouds) {
      if (Math.abs(c.position.y - (P.alt + 8)) < 6 && !c.userData.poffed) {
        const d = Math.hypot(c.position.x - aerostat.position.x, c.position.z - aerostat.position.z);
        if (d < 55) { c.userData.poffed = true; burst(new T.Vector3(aerostat.position.x, P.alt + 10, aerostat.position.z), 20, 4); AudioEngine.whoosh(); }
      }
    }
    ropesDirty = ropesDirty || (Math.floor(timeNow * 4) % 8 === 0); // ときどきロープ再構築（ゆれ）
  }

  /* ---- 常時アニメ ---- */
  fanBlades.rotation.z += dt * (2 + P.fan * 38);
  AudioEngine.setFan(P.fan);
  AudioEngine.setBurner(clamp(P.burner - 0.05, 0, 1));
  const fl = clamp(P.burner, 0, 1.2);
  const flick = 1 + 0.22 * Math.sin(timeNow * 33) + 0.12 * Math.sin(timeNow * 57);
  flame.scale.set(Math.max(0.001, fl * flick * 0.9), Math.max(0.001, fl * (1.6 + 0.5 * flick)), Math.max(0.001, fl * flick * 0.9));
  burnerLight.intensity = fl * (3.2 + Math.sin(timeNow * 41));
  pilot.visible = Game.ignited && P.burner < 0.2 && Game.phase !== 'title';
  for (const s of windStreaks) {
    const u = s.userData;
    if (P.fan > 0.15) {
      u.t += dt * (0.9 + P.fan * 1.4);
      if (u.t > 1) { u.t = 0; u.ox = (Math.random() - 0.5) * 1.6; u.oy = (Math.random() - 0.5) * 1.2; }
      const t = u.t;
      s.position.lerpVectors(fanFrom, fanTo, t);
      s.position.x += (u.ox || 0) * t; s.position.y += (u.oy || 0) * t;
      s.material.opacity = P.fan * 0.35 * Math.sin(t * Math.PI);
      s.lookAt(camera.position);
    } else s.material.opacity = 0;
  }
  flagAmp = lerp(flagAmp, pibalState.released ? 0.3 : 1, dt * 0.5);
  flags.children.forEach(c => {
    if (c.userData.ph != null) c.rotation.z = Math.sin(timeNow * (1.5 + flagAmp * 1.6) + c.userData.ph) * 0.25 * (0.4 + flagAmp);
  });
  for (const c of clouds) c.position.x += c.userData.drift * dt;
  if (birds.visible) {
    birds.children.forEach((b, i) => {
      const a = timeNow * 0.28 + i * 1.05;
      b.position.set(aerostat.position.x + Math.cos(a) * (26 + i * 3),
        P.alt + 4 + Math.sin(timeNow * 0.7 + i) * 3,
        aerostat.position.z + Math.sin(a) * (26 + i * 3));
      b.rotation.y = -a - Math.PI / 2;
      const flap = Math.sin(timeNow * 9 + b.userData.ph) * 0.7;
      b.userData.w1.rotation.z = flap; b.userData.w2.rotation.z = -flap;
    });
  }
  // 収納袋: 引き出すほどぺたんこに
  if (envBag.visible) {
    const k = 1 - easeOut(P.spread) * 0.85;
    envBag.scale.set(1, k, 1);
  }
  // 口もちハンドルの目印
  if (mouthHandles[0].visible) {
    if (ph !== 'step6' && ph !== 'step6done') mouthHandles.forEach(h => h.visible = false);
    else {
      const r0 = ringR[0];
      for (const h of mouthHandles) {
        const side = h.userData.side;
        const open = side < 0 ? Game.openL : Game.openR;
        h.position.set(side * r0 * lerp(1.32, 1.05, open), 0.5 + open * 1.4, 1.45);
        const pl = 1 + 0.15 * Math.sin(timeNow * 5 + side);
        h.scale.setScalar(pl);
        h.children.forEach(c => c.material.opacity = open >= 0.9 ? 0.15 : 0.85);
      }
    }
  }

  /* ---- 布・ロープ更新 ---- */
  updateEnvelope();
  if (basketState.pose === 'tipped') basketPose(easeInOut(P.rise));
  ropeTimer += dt;
  const cablesActive = cables.some(c => c.state === 'drag' || c.state === 'fly');
  if ((ropesDirty || ph === 'launch' || cablesActive) && ropeTimer > 0.09) {
    ropeTimer = 0;
    rebuildCables();
    if (basketState.pose === 'tipped' && (!moorReleased || moorFallT < 2)) rebuildMooring();
    rebuildCrownLine();
    ropesDirty = false;
  }
  moorRope.visible = basketState.pose === 'tipped' && Game.step >= 8 && (!moorReleased || moorFallT < 2);
  qrHandle.visible = moorRope.visible && !moorReleased;
  for (const c of cables) { c.mesh.visible = c.carab.visible = Game.step >= 3; }

  /* ---- ヒント ---- */
  const stepDef = STEPS[Game.step];
  let hintP = null;
  if (ph.startsWith('step') && !ph.endsWith('done') && stepDef && stepDef.hint) hintP = stepDef.hint();
  Game.idleT += dt;
  if (hintP && !dragST.active) {
    const sp = screenPos(_hp.copy(hintP).add(new T.Vector3(0, 0.5, 0)));
    ui.hand.style.left = clamp(sp.x, 30, innerWidth - 30) + 'px';
    ui.hand.style.top = clamp(sp.y, 60, innerHeight - 40) + 'px';
    ui.hand.classList.remove('hidden');
  } else ui.hand.classList.add('hidden');

  sun.position.copy(sunDir).multiplyScalar(120).add(aerostat.position);
  sun.target.position.copy(aerostat.position);

  updateSparks(dt);
  camCtl.update(dt);
}

/* 飛行中のカメラ */
const FLIGHT_KEYS = [
  { t: 0,  off: [11, 1.5, -13], look: [0, 5, 0] },
  { t: 7,  off: [16, 4, -19],  look: [0, 3, 0] },
  { t: 16, off: [21, 9, -25],  look: [0, -5, 3] },
  { t: 27, off: [24, 5, -28],  look: [0, -2, 0] },
  { t: 38, off: [24, 5, -26],  look: [0, 0, 0] },
  { t: 50, off: [20, 3, 26],   look: [0, 2, 0] },
];
function flightCamera(ft) {
  const s = camScale();
  let a = FLIGHT_KEYS[0], b = FLIGHT_KEYS[FLIGHT_KEYS.length - 1];
  for (let i = 0; i < FLIGHT_KEYS.length - 1; i++) {
    if (ft >= FLIGHT_KEYS[i].t && ft < FLIGHT_KEYS[i + 1].t) { a = FLIGHT_KEYS[i]; b = FLIGHT_KEYS[i + 1]; break; }
  }
  let u = ft >= b.t ? 1 : smooth((ft - a.t) / (b.t - a.t));
  const off = [lerp(a.off[0], b.off[0], u) * s, lerp(a.off[1], b.off[1], u) * s, lerp(a.off[2], b.off[2], u) * s];
  const lk = [lerp(a.look[0], b.look[0], u), lerp(a.look[1], b.look[1], u), lerp(a.look[2], b.look[2], u)];
  if (ft >= FLIGHT_KEYS[FLIGHT_KEYS.length - 1].t) {
    const ang = (ft - 50) * 0.06;
    off[0] = Math.cos(ang) * 30 * s; off[2] = Math.sin(ang) * 30 * s;
    off[1] = 6 + Math.sin(ft * 0.1) * 3;
    lk[1] = -4;
  }
  camCtl.speed = 0.8;
  let lookP = [aerostat.position.x + lk[0], P.alt + lk[1] + 6, aerostat.position.z + lk[2]];
  if (ft > 34 && ft < 50) {
    const w = smooth((ft - 34) / 4) * smooth((50 - ft) / 4);
    lookP = [lerp(lookP[0], (aerostat.position.x + rainbow.position.x) / 2, w * 0.55),
             lerp(lookP[1], (P.alt + 90) / 1, w * 0.35),
             lerp(lookP[2], (aerostat.position.z + rainbow.position.z) / 2, w * 0.55)];
  }
  camCtl.set([aerostat.position.x + off[0], P.alt + off[1], aerostat.position.z + off[2]], lookP);
}

/* ============================== resize / loop ============================== */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = portrait() ? 68 : 55;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
let frameCount = 0, fpsAcc = 0, fpsAvg = 60;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  timeNow += dt;
  fpsAcc += dt; frameCount++;
  if (fpsAcc > 1) { fpsAvg = frameCount / fpsAcc; frameCount = 0; fpsAcc = 0; }
  if (Game.phase !== 'title') updateGame(dt);
  else { updateEnvelope(); camCtl.update(dt); }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

/* ============================== debug API（試遊テスト用） ============================== */
window.GAME = {
  P, Game, camera,
  fps: () => fpsAvg,
  start() { ui.startBtn.click(); },
  hintScreen() {
    const d = STEPS[Game.step];
    const p = d && d.hint ? d.hint() : null;
    return p ? screenPos(p) : null;
  },
  gesture() { // テスト用: 現ステップの推奨ドラッグ（from/to スクリーン座標）
    const d = STEPS[Game.step];
    const g = d && d.test ? d.test() : null;
    if (!g) return null;
    return { from: screenPos(g.from), to: screenPos(g.to) };
  },
  press(on) { Game.holding = on; },
  burn(on) { Game.burning = on; },
  vent(on) { Game.venting = on; },
  camSnap() { camCtl.pos.copy(camCtl.tPos); camCtl.look.copy(camCtl.tLook); camCtl.update(0.001); },
  ff(sec) { for (let i = 0; i < sec * 60; i++) updateGame(1 / 60); },
};
})();
