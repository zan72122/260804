// ケーキ製作に関わる全オブジェクト: ボウル・生地・型・スポンジ・クリーム・飾り・ドーム・ソース
import * as THREE from '../vendor/three.module.js';
import { canvasTexture, glowTexture, spongeTexture, clamp, lerp } from './util.js';

// 共通GLSLノイズ
const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v += a*vnoise(p); p*=2.1; a*=0.5; } return v; }
`;

// =========================================================================
// 生地の表面（混ぜる渦・波紋）— ボウルと型の両方で使う
// =========================================================================
export function createBatterSurface(radius) {
  const geo = new THREE.PlaneGeometry(radius * 2.15, radius * 2.15, 56, 56);
  const uniforms = {
    uTime: { value: 0 },
    uStir: { value: 0 },        // かき混ぜの勢い 0..1
    uPhase: { value: 0 },       // 渦の累積回転
    uMix: { value: 0 },         // 混ざり具合 0..1
    uRadius: { value: radius },
    uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime, uStir, uPhase, uRadius;
      varying vec2 vP;
      varying vec3 vN, vWorld;
      float disp(vec2 p){
        float r = length(p);
        float a = atan(p.y, p.x);
        float rip = sin(r*95.0 - uTime*7.0 + a*3.0 + uPhase*2.0)*0.0030
                  + sin(r*150.0 - uTime*11.0 - a*2.0)*0.0016;
        float dip = -0.013*exp(-r*r/(uRadius*uRadius*0.10));
        return (rip + dip) * uStir;
      }
      void main(){
        vP = position.xy;
        float e = 0.004;
        float h  = disp(vP);
        float hx = disp(vP + vec2(e, 0.0));
        float hy = disp(vP + vec2(0.0, e));
        vec3 p = vec3(position.x, position.y, h);
        vec3 n = normalize(vec3(-(hx-h)/e, -(hy-h)/e, 1.0));
        vN = normalize(normalMatrix * n);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uStir, uPhase, uMix, uRadius;
      uniform vec3 uLightDir;
      varying vec2 vP;
      varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      void main(){
        float r = length(vP);
        if (r > uRadius) discard;
        // 渦で回転した座標（中心ほど速く回る）
        float twist = uPhase * (1.4 - r/uRadius);
        float ca = cos(twist), sa = sin(twist);
        vec2 q = mat2(ca, -sa, sa, ca) * vP / uRadius;
        // 材料の色（卵・小麦粉・牛乳・いちご）が渦模様で混ざる
        float n1 = fbm(q*4.0 + 3.1);
        float n2 = fbm(q*7.0 - 1.7 + uPhase*0.06);
        vec3 yolk  = vec3(1.00, 0.78, 0.30);
        vec3 flour = vec3(1.00, 0.97, 0.90);
        vec3 milk  = vec3(0.99, 0.96, 0.88);
        vec3 berry = vec3(1.00, 0.62, 0.72);
        vec3 swirl = mix(flour, yolk, smoothstep(0.35, 0.65, n1));
        swirl = mix(swirl, berry, smoothstep(0.5, 0.8, n2));
        swirl = mix(swirl, milk, smoothstep(0.6, 0.9, fbm(q*3.0+9.0))*0.5);
        // 完成した生地はなめらかなピンクに、うっすら筋を残す
        vec3 done = vec3(1.00, 0.83, 0.87);
        done += (n2 - 0.5) * 0.05;
        vec3 base = mix(swirl, done, uMix);
        // 照明（拡散 + つやのある反射で液体らしく）
        vec3 N = normalize(vN);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(cameraPosition - vWorld);
        float dif = 0.60 + 0.40 * max(dot(N, L), 0.0);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 60.0) * 0.55;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18;
        vec3 col = base * dif + vec3(1.0, 0.98, 0.92) * (spec + fres);
        float edge = smoothstep(uRadius, uRadius - 0.004, r);
        gl_FragColor = vec4(col, edge);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return {
    mesh,
    uniforms,
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// ボウル（陶器・パステルミント）
// =========================================================================
export function createBowl() {
  const group = new THREE.Group();
  const pts = [];
  // 外形プロファイル（足つきボウル）
  pts.push(new THREE.Vector2(0.0, 0.0));
  pts.push(new THREE.Vector2(0.048, 0.0));
  pts.push(new THREE.Vector2(0.052, 0.012));
  pts.push(new THREE.Vector2(0.045, 0.02));
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.046 + Math.sin(t * Math.PI * 0.52) * 0.072, 0.02 + t * 0.078));
  }
  pts.push(new THREE.Vector2(0.120, 0.102));
  pts.push(new THREE.Vector2(0.116, 0.104));
  // 内壁
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.042 + Math.sin(t * Math.PI * 0.52) * 0.070, 0.026 + t * 0.076));
  }
  pts.push(new THREE.Vector2(0.0, 0.026));
  const geo = new THREE.LatheGeometry(pts, 48);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe8dc, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.25,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const batter = createBatterSurface(0.099);
  batter.mesh.position.y = 0.062;
  group.add(batter.mesh);

  return { group, batter, mesh };
}

// =========================================================================
// 木のスプーン（かき混ぜ用）
// =========================================================================
export function createSpoon() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: 0.6 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.19, 10), mat);
  handle.position.y = 0.115;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), mat);
  head.scale.set(1, 1.35, 0.55);
  head.position.y = 0.012;
  handle.castShadow = head.castShadow = true;
  group.add(handle, head);
  group.rotation.z = 0.35;
  return { group };
}

// =========================================================================
// 注ぐ流れ（生地・ソース共用）
// =========================================================================
export function createStream(color, { emissive = 0, radius = 0.011 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 12, 24, true);
  geo.translate(0, -0.5, 0); // 上端が原点、下へ伸びる
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uEmissive: { value: emissive },
    uFlow: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime, uFlow;
      varying vec2 vUv;
      varying vec3 vN, vWorld;
      void main(){
        vUv = uv;
        vec3 p = position;
        // 落ちながらくねる・下ほど細くなる
        float sway = sin(uv.y*14.0 + uTime*9.0) * 0.25 * (1.0-uv.y);
        p.x += sway * 0.3;
        float taper = mix(1.0, 0.72, 1.0-uv.y);
        p.xz *= taper * uFlow;
        vN = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uEmissive, uFlow;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      void main(){
        if (uFlow < 0.02) discard;
        // 流れ落ちる縞模様
        float streak = fbm(vec2(vUv.x*6.0, vUv.y*3.0 + uTime*2.2));
        vec3 col = uColor * (0.82 + streak*0.30);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
        col += vec3(1.0, 0.97, 0.9) * fres * 0.35;
        col += uColor * uEmissive * (0.6 + streak*0.4);
        gl_FragColor = vec4(col, 0.96);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  const api = {
    mesh,
    uniforms,
    flow: 0,
    // top: Vector3, bottomY: 落下先の高さ
    set(top, bottomY) {
      mesh.position.copy(top);
      mesh.scale.set(radius, Math.max(0.001, top.y - bottomY), radius);
    },
    setFlow(f) {
      api.flow = f;
      uniforms.uFlow.value = f;
      mesh.visible = f > 0.02;
    },
    update(dt, t) { uniforms.uTime.value = t; },
  };
  return api;
}

// =========================================================================
// ケーキ型（金属・中に生地がたまる）
// =========================================================================
export function createPan() {
  const group = new THREE.Group();
  const pts = [
    new THREE.Vector2(0, 0.001),
    new THREE.Vector2(0.086, 0.001),
    new THREE.Vector2(0.096, 0.078),
    new THREE.Vector2(0.104, 0.082),
    new THREE.Vector2(0.100, 0.084),
    new THREE.Vector2(0.092, 0.078),
    new THREE.Vector2(0.082, 0.006),
    new THREE.Vector2(0, 0.006),
  ];
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9d9de, metalness: 0.85, roughness: 0.35 });
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);

  // たまっていく生地（円柱 + 表面）
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffd4dc, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.082, 1, 32, 1, true), bodyMat);
  const surface = createBatterSurface(0.085);
  surface.uniforms.uMix.value = 1;
  group.add(body, surface.mesh);

  let level = 0;
  const setLevel = (v) => {
    level = v;
    const h = 0.006 + v * 0.062;
    body.scale.y = Math.max(0.001, h - 0.006);
    body.position.y = 0.006 + (h - 0.006) / 2;
    surface.mesh.position.y = h;
    body.visible = surface.mesh.visible = v > 0.01;
  };
  setLevel(0);
  return { group, surface, setLevel, getLevel: () => level };
}

// =========================================================================
// ケーキスタンド
// =========================================================================
export function createCakeStand() {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xfff2f6, roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.2 });
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.055, 0),
    new THREE.Vector2(0.06, 0.006),
    new THREE.Vector2(0.024, 0.018),
    new THREE.Vector2(0.02, 0.05),
    new THREE.Vector2(0.14, 0.056),
    new THREE.Vector2(0.148, 0.062),
    new THREE.Vector2(0.145, 0.066),
    new THREE.Vector2(0.0, 0.066),
  ];
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  // 皿の縁の金ライン
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.1455, 0.0022, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0xe8bd6a, metalness: 0.9, roughness: 0.25 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.065;
  group.add(ring);
  return { group, topY: 0.066 };
}

// =========================================================================
// スポンジ層（虹色の段）
// =========================================================================
const SPONGE_COLORS = ['#ffb9c8', '#ffe49a', '#b4ecd2'];
export function createSponge(index) {
  const tint = SPONGE_COLORS[index % SPONGE_COLORS.length];
  const tex = spongeTexture(tint);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const geo = new THREE.CylinderGeometry(0.088, 0.088, 0.036, 40, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, height: 0.036 };
}

// =========================================================================
// 絞りクリーム（渦巻き・drawRangeで徐々に現れる）
// =========================================================================
export function createCreamSwirl(colorHex, baseRadius = 0.078) {
  const pts = [];
  const turns = 3.0;
  const N = 130;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * turns * Math.PI * 2;
    const r = lerp(baseRadius, 0.008, t);
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.0105 + Math.sin(t * 40) * 0.0006, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubularSegments = 240;
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 0.0115, 10, false);
  const totalIndex = geo.index.count;
  const mat = new THREE.MeshPhysicalMaterial({
    color: colorHex, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  geo.setDrawRange(0, 0);
  return {
    mesh,
    curve,
    height: 0.023,
    setProgress(p) {
      const seg = Math.floor(clamp(p, 0, 1) * tubularSegments);
      geo.setDrawRange(0, seg * 10 * 6);
      mesh.visible = seg > 0;
    },
    tipAt(p) { return curve.getPoint(clamp(p, 0, 1)); },
  };
}

// =========================================================================
// 絞り袋
// =========================================================================
export function createPipingBag() {
  const group = new THREE.Group();
  const clothTex = canvasTexture(128, (g, s) => {
    g.fillStyle = '#ff9db5'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 6;
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + 60, s); g.stroke(); }
  });
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.13, 20),
    new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.75 })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 0.095;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.012, 0.028, 12),
    new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.85, roughness: 0.3 })
  );
  tip.rotation.x = Math.PI;
  tip.position.y = 0.018;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), cone.material);
  knot.position.y = 0.165;
  cone.castShadow = true;
  group.add(cone, tip, knot);
  group.scale.setScalar(0.68);
  return { group };
}

// =========================================================================
// 飾り（いちご・ブルーベリー・オレンジ・クッキー・ハートあめ・ろうそく）
// =========================================================================
function strawberryTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#e8354d'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const px = x * 21 + (y % 2) * 10 + 5, py = y * 21 + 6;
      g.fillStyle = '#ffd98e';
      g.beginPath(); g.ellipse(px, py, 2.2, 3.2, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(140,10,30,0.5)';
      g.beginPath(); g.ellipse(px + 1, py + 1, 2.2, 3.2, 0, 0, 7); g.fill();
      g.fillStyle = '#ffe9b0';
      g.beginPath(); g.ellipse(px, py, 1.6, 2.4, 0, 0, 7); g.fill();
    }
  });
}

export function createDecoration(kind) {
  const group = new THREE.Group();
  let height = 0.03;
  if (kind === 'strawberry') {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 18, 14),
      new THREE.MeshPhysicalMaterial({ map: strawberryTexture(), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.3 })
    );
    body.scale.set(1, 1.28, 1);
    body.position.y = 0.019;
    group.add(body);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9b4f, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.014, 6), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.007, 0.038, Math.sin(a) * 0.007);
      leaf.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      group.add(leaf);
    }
    height = 0.042;
  } else if (kind === 'blueberry') {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x4a5fb0, roughness: 0.35, clearcoat: 0.5 });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), mat);
      const a = (i / 3) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.009, 0.009, Math.sin(a) * 0.009);
      group.add(b);
    }
    height = 0.018;
  } else if (kind === 'orange') {
    const tex = canvasTexture(128, (g, s) => {
      g.fillStyle = '#ffb347'; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, 7); g.fill();
      g.fillStyle = '#ffd489';
      for (let i = 0; i < 8; i++) {
        g.save(); g.translate(s / 2, s / 2); g.rotate((i / 8) * Math.PI * 2);
        g.beginPath(); g.moveTo(0, 0);
        g.arc(0, 0, s * 0.42, -0.32, 0.32); g.closePath(); g.fill();
        g.restore();
      }
      g.strokeStyle = '#ff9c2e'; g.lineWidth = 6;
      g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 3, 0, 7); g.stroke();
    });
    const slice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.006, 24),
      [new THREE.MeshStandardMaterial({ color: 0xffa53d, roughness: 0.5 }),
       new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }),
       new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })]
    );
    slice.rotation.set(0.5, 0, 0.2);
    slice.position.y = 0.012;
    group.add(slice);
    height = 0.026;
  } else if (kind === 'cookie') {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd9a05e, roughness: 0.9 });
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.007, 20), mat);
    c.position.y = 0.0075;
    c.rotation.set(0.35, 0.4, 0);
    group.add(c);
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x54341e, roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const chip = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), chipMat);
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.011;
      chip.position.set(Math.cos(a) * r, 0.0035 + 0.002, Math.sin(a) * r);
      c.add(chip);
    }
    height = 0.024;
  } else if (kind === 'candy') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.35);
    shape.bezierCurveTo(0, 0.6, -0.5, 0.6, -0.5, 0.25);
    shape.bezierCurveTo(-0.5, -0.05, 0, -0.3, 0, -0.55);
    shape.bezierCurveTo(0, -0.3, 0.5, -0.05, 0.5, 0.25);
    shape.bezierCurveTo(0.5, 0.6, 0, 0.6, 0, 0.35);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
    geo.scale(0.026, 0.026, 0.026);
    geo.rotateX(-0.25);
    const heart = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xff5f8f, roughness: 0.12, clearcoat: 1.0 }));
    heart.position.y = 0.017;
    group.add(heart);
    height = 0.035;
  } else if (kind === 'candle') {
    const stripeTex = canvasTexture(64, (g, s) => {
      g.fillStyle = '#fff6f8'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#ff8fb0';
      for (let i = -2; i < 6; i++) {
        g.save(); g.translate(0, i * 16); g.rotate(-0.5);
        g.fillRect(-20, 0, s + 40, 7);
        g.restore();
      }
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0075, 0.0075, 0.055, 12),
      new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.4 })
    );
    body.position.y = 0.0275;
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0012, 0.0012, 0.008, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    wick.position.y = 0.058;
    group.add(body, wick);
    // 炎（点火時に表示）
    const flame = createFlame();
    flame.group.position.y = 0.065;
    flame.group.visible = false;
    group.add(flame.group);
    group.userData.flame = flame;
    height = 0.07;
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.userData.kind = kind;
  group.userData.height = height;
  return group;
}

// ろうそくの炎（ビルボード + ゆらぎ）
export function createFlame() {
  const uniforms = { uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uSeed;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        // ビルボード（カメラに正対）+ ゆらぎ
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float sway = sin(uTime*9.0 + uSeed)*0.15 * uv.y;
        vec3 p = right * (position.x + sway*0.01) + up * position.y;
        vec4 wp = modelMatrix * vec4(0.0,0.0,0.0,1.0);
        wp.xyz += p;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv - vec2(0.5, 0.32);
        p.y /= 1.6 + sin(uTime*11.0 + uSeed)*0.08;
        float d = length(p);
        float core = smoothstep(0.24, 0.02, d);
        float glow = smoothstep(0.5, 0.1, d) * 0.5;
        vec3 col = mix(vec3(1.0,0.55,0.1), vec3(1.0,0.95,0.75), core);
        float a = clamp(core + glow, 0.0, 1.0);
        gl_FragColor = vec4(col * (core*1.6 + glow), a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.038), mat);
  mesh.geometry.translate(0, 0.012, 0);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, uniforms, update(dt, t) { uniforms.uTime.value = t; } };
}

// =========================================================================
// チョコレートドーム（溶けるシェーダー）
// =========================================================================
export function createChocoDome() {
  const geo = new THREE.SphereGeometry(0.142, 56, 40, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, 1.85, 1); // 高さ約0.263 — ケーキ+飾りを覆う
  const uniforms = {
    uTime: { value: 0 },
    uMelt: { value: 0 },          // 0..1 溶け具合
    uBaseY: { value: 0 },         // ドーム底の世界Y（毎フレーム更新）
    uHeight: { value: 0.263 },
    uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uMelt, uBaseY, uHeight, uTime;
      varying vec3 vN, vWorld;
      varying float vCutY;
      ${NOISE_GLSL}
      void main(){
        vec3 p = position;
        vec4 wp0 = modelMatrix * vec4(p, 1.0);
        float topY = uBaseY + uHeight;
        float cutY = topY - uMelt * (uHeight * 1.25);
        vCutY = cutY;
        // 溶け際より上の頂点はとろりと垂れ下がる（溶け始めるまでは触らない）
        float over = wp0.y - cutY;
        if (uMelt > 0.004 && over > 0.0) {
          float sag = min(over, 0.03) + over * 0.25;
          wp0.y -= sag * (0.7 + 0.3*sin(atan(p.z, p.x)*7.0 + uTime*2.0));
          // 内側に少しすぼむ
          wp0.xz = mix(wp0.xz, vec2(modelMatrix[3][0], modelMatrix[3][2]), min(over*3.0, 0.25));
        }
        vN = normalize(normalMatrix * normal);
        vWorld = wp0.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp0;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uMelt, uTime;
      uniform vec3 uLightDir;
      varying vec3 vN, vWorld;
      varying float vCutY;
      ${NOISE_GLSL}
      void main(){
        float n = fbm(vWorld.xz * 42.0 + vWorld.y * 22.0);
        // 溶け際: ノイズでとろりと不揃いに消えていく
        float edgeY = vCutY + (n - 0.5) * 0.022;
        if (uMelt > 0.004 && vWorld.y > edgeY) discard;
        vec3 choco = vec3(0.28, 0.16, 0.09);
        vec3 melty = vec3(0.48, 0.26, 0.12);
        // 溶け際に近いほど温かく光る
        float warm = smoothstep(0.045, 0.0, edgeY - vWorld.y) * step(0.001, uMelt);
        vec3 base = mix(choco, melty, warm);
        base += (n - 0.5) * 0.05;
        vec3 N = normalize(vN);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(cameraPosition - vWorld);
        float dif = 0.45 + 0.55 * max(dot(N, L), 0.0);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 70.0);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = base * dif + vec3(1.0, 0.95, 0.85) * spec * 0.7 + vec3(0.5, 0.35, 0.2) * fres * 0.4;
        col += vec3(1.0, 0.45, 0.15) * warm * 0.35 * uMelt;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return {
    mesh,
    uniforms,
    setMelt(v) { uniforms.uMelt.value = v; },
    update(dt, t) {
      uniforms.uTime.value = t;
      uniforms.uBaseY.value = mesh.getWorldPosition(_v3).y;
    },
  };
}
const _v3 = new THREE.Vector3();

// 溶けたチョコのしずく（プール式）
export function createDrips(count = 22) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x5a3417, roughness: 0.18, clearcoat: 0.9 });
  const drips = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), mat);
    m.scale.set(0.8, 1.7, 0.8);
    m.visible = false;
    group.add(m);
    drips.push({ m, vy: 0, life: 0, active: false });
  }
  return {
    group,
    spawn(pos) {
      const d = drips.find(d => !d.active);
      if (!d) return;
      d.active = true;
      d.m.visible = true;
      d.m.position.copy(pos);
      d.vy = -0.05 - Math.random() * 0.1;
      d.life = 1.4;
    },
    update(dt, floorY) {
      for (const d of drips) {
        if (!d.active) continue;
        d.vy -= 2.2 * dt;
        d.m.position.y += d.vy * dt;
        d.life -= dt;
        if (d.m.position.y <= floorY + 0.004) {
          d.m.position.y = floorY + 0.004;
          d.m.scale.set(1.6, 0.45, 1.6);
        }
        if (d.life <= 0) { d.active = false; d.m.visible = false; d.m.scale.set(0.8, 1.7, 0.8); }
      }
    },
  };
}

// 溶けたチョコが皿に広がるプール
export function createMeltPool() {
  const geo = new THREE.CircleGeometry(1, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.hypot(x, y);
    if (r > 0.5) {
      const a = Math.atan2(y, x);
      const w = 1 + Math.sin(a * 7) * 0.06 + Math.sin(a * 13 + 2) * 0.05;
      pos.setXY(i, x * w, y * w);
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x38200e, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(0.001);
  mesh.visible = false;
  return {
    mesh,
    setSize(r) {
      mesh.visible = r > 0.005;
      mesh.scale.setScalar(Math.max(0.001, r));
    },
  };
}

// =========================================================================
// ソースピッチャー（銅製・あたたかいソース）
// =========================================================================
export function createPitcher() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd88f56, metalness: 0.85, roughness: 0.28 });
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.038, 0),
    new THREE.Vector2(0.05, 0.02),
    new THREE.Vector2(0.052, 0.06),
    new THREE.Vector2(0.038, 0.095),
    new THREE.Vector2(0.042, 0.115),
    new THREE.Vector2(0.04, 0.117),
    new THREE.Vector2(0.034, 0.1),
    new THREE.Vector2(0.0, 0.1),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat);
  body.castShadow = true;
  group.add(body);
  // 注ぎ口
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 10, 1, true), mat);
  spout.rotation.z = 2.2;
  spout.position.set(0.052, 0.108, 0);
  group.add(spout);
  // 取っ手
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.045, 0.105, 0),
    new THREE.Vector3(-0.075, 0.09, 0),
    new THREE.Vector3(-0.08, 0.05, 0),
    new THREE.Vector3(-0.05, 0.02, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 16, 0.006, 8), mat);
  group.add(handle);
  // 中の光るソース
  const sauce = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 20),
    new THREE.MeshBasicMaterial({ color: 0xffa63e })
  );
  sauce.rotation.x = -Math.PI / 2;
  sauce.position.y = 0.096;
  group.add(sauce);
  // 湯気の出所を示すほんのり光
  const glow = new THREE.PointLight(0xff9c40, 0.4, 0.4, 2);
  glow.position.y = 0.12;
  group.add(glow);
  return { group, spoutLocal: new THREE.Vector3(0.062, 0.125, 0) };
}

// =========================================================================
// ケーキのソースコート（上から垂れるキャラメル）
// =========================================================================
export function createDripCrown(radius = 0.0905) {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.075, 48, 1, true);
  geo.translate(0, -0.0375, 0);
  const uniforms = { uFlow: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN, vWorld;
      void main(){
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFlow, uTime;
      varying vec2 vUv;
      varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      void main(){
        // 角度ごとに垂れの長さが違う
        float n = vnoise(vec2(vUv.x * 14.0, 0.0)) * 0.7 + vnoise(vec2(vUv.x * 31.0, 3.0)) * 0.3;
        float dripLen = (0.35 + n * 0.65) * uFlow;
        float below = 1.0 - vUv.y; // 0=上端, 1=下端
        if (below > dripLen) discard;
        // 先端は丸く濃く
        float tip = smoothstep(dripLen, dripLen - 0.12, below);
        vec3 caramel = vec3(0.78, 0.45, 0.15);
        vec3 dark = vec3(0.55, 0.28, 0.08);
        vec3 base = mix(dark, caramel, tip);
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = normalize(vec3(0.5, 0.8, 0.4));
        float dif = 0.5 + 0.5 * max(dot(N, L), 0.0);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 50.0);
        vec3 col = base * dif + vec3(1.0, 0.9, 0.7) * spec * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshPhysicalMaterial({ color: 0xb5661f, roughness: 0.1, clearcoat: 1.0 })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.001;
  const group = new THREE.Group();
  group.add(mesh, top);
  group.visible = false;
  return {
    group,
    uniforms,
    setFlow(v) {
      group.visible = v > 0.01;
      uniforms.uFlow.value = v;
      top.scale.setScalar(Math.max(0.001, Math.min(1, v * 1.5)));
    },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// 紙吹雪
// =========================================================================
export function createConfetti(count = 240) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const palette = [
    [1, 0.55, 0.65], [1, 0.85, 0.4], [0.55, 0.85, 0.65], [0.55, 0.7, 1], [0.85, 0.6, 1], [1, 1, 1],
  ];
  for (let i = 0; i < count; i++) {
    const c = palette[i % palette.length];
    colors.set(c, i * 3);
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const uniforms = { uTime: { value: 0 }, uBurst: { value: -10 }, uOrigin: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float seed;
      uniform float uTime, uBurst;
      uniform vec3 uOrigin;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vColor = color;
        float age = uTime - uBurst;
        float a1 = seed * 6.2832;
        float a2 = fract(seed * 7.13) * 3.1416 - 1.5708;
        float speed = 0.35 + fract(seed * 3.7) * 0.5;
        vec3 dir = vec3(cos(a1)*cos(a2), 0.9 + fract(seed*5.3)*0.6, sin(a1)*cos(a2));
        vec3 p = uOrigin + dir * speed * age;
        p.y -= 0.65 * age * age;
        p.x += sin(age * 4.0 + seed * 20.0) * 0.03;
        vAlpha = clamp(2.2 - age * 0.75, 0.0, 1.0) * step(0.0, age);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = (5.0 + fract(seed*9.1) * 6.0) * (1.0 / -mv.z) * ${(window.devicePixelRatio > 1 ? '2.0' : '1.0')};
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        if (vAlpha <= 0.0) discard;
        vec2 p = gl_PointCoord - 0.5;
        if (max(abs(p.x), abs(p.y)) > 0.42) discard;
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return {
    points,
    burst(origin, t) {
      uniforms.uBurst.value = t;
      uniforms.uOrigin.value.copy(origin);
      points.visible = true;
    },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// キラキラ（タイトル・ドーム演出）
// =========================================================================
export function createSparkles(count = 60) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.1 + Math.random() * 0.16;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.03 + Math.random() * 0.3;
    positions[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      varying float vTw;
      void main(){
        vTw = 0.5 + 0.5 * sin(uTime * (2.0 + seed * 3.0) + seed * 40.0);
        vec3 p = position;
        p.y += sin(uTime * 0.7 + seed * 9.0) * 0.02;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_PointSize = (6.0 + seed * 8.0) * vTw * (1.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float star = smoothstep(0.5, 0.0, d) * smoothstep(0.18, 0.0, min(abs(p.x), abs(p.y)));
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.85), star * vTw);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, update(dt, t) { uniforms.uTime.value = t; } };
}

// =========================================================================
// 湯気
// =========================================================================
export function createSteam(count = 5) {
  const group = new THREE.Group();
  const tex = glowTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.05);
    group.add(s);
    items.push({ s, phase: Math.random() });
  }
  let strength = 0;
  return {
    group,
    setStrength(v) { strength = v; },
    update(dt, t) {
      for (const it of items) {
        it.phase += dt * 0.45;
        const k = it.phase % 1;
        it.s.position.set(Math.sin(it.phase * 6.28 + t) * 0.02, k * 0.16, Math.cos(it.phase * 5.1) * 0.015);
        it.s.scale.setScalar(0.03 + k * 0.075);
        it.s.material.opacity = strength * Math.sin(k * Math.PI) * 0.5;
      }
    },
  };
}

// =========================================================================
// 材料アイテム（演出用: 卵・小麦粉袋・牛乳・いちご）
// =========================================================================
export function createIngredient(kind) {
  const group = new THREE.Group();
  if (kind === 'egg') {
    const egg = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xfae7c8, roughness: 0.45 })
    );
    egg.scale.set(1, 1.3, 1);
    group.add(egg);
  } else if (kind === 'flour') {
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.07, 0.032),
      new THREE.MeshStandardMaterial({ color: 0xfdf3e0, roughness: 0.85 })
    );
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.02, 0.034),
      new THREE.MeshStandardMaterial({ color: 0x8fc3e8, roughness: 0.7 })
    );
    group.add(bag, band);
  } else if (kind === 'milk') {
    const carton = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.075, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.6 })
    );
    const roofL = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.028, 0.042),
      new THREE.MeshStandardMaterial({ color: 0x9fd3f0, roughness: 0.6 })
    );
    roofL.position.y = 0.045;
    roofL.scale.y = 0.6;
    group.add(carton, roofL);
  } else if (kind === 'berry') {
    return createDecoration('strawberry');
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return group;
}
