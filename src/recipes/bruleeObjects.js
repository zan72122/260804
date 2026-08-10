// 「あぶってパリン！」専用オブジェクト: 耐熱皿・カスタード・アイス・メレンゲドーム・
// バーナー・飴ガラス・破片・スパークラー・冷気ミスト
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture, glowTexture, clamp } from '../util.js';
import { createFlame } from '../cake.js';

// 簡易ノイズ（cake.jsのNOISE_GLSLは非公開のためローカルに複製）
const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
`;

// =========================================================================
// 白い耐熱皿（フチが波打つグラタン皿ふう） r≈0.11 h≈0.05
// =========================================================================
export function createDish() {
  const group = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.0, 0.006),
    new THREE.Vector2(0.058, 0.006),
    new THREE.Vector2(0.066, 0.012),
    new THREE.Vector2(0.062, 0.018),
    new THREE.Vector2(0.064, 0.021),
    new THREE.Vector2(0.084, 0.034),
    new THREE.Vector2(0.101, 0.044),
    new THREE.Vector2(0.110, 0.050), // フチ最外周（波打ちの起点）
    new THREE.Vector2(0.103, 0.047),
    new THREE.Vector2(0.088, 0.036),
    new THREE.Vector2(0.070, 0.024),
    new THREE.Vector2(0.0, 0.020),
  ];
  const maxR = 0.110;
  const geo = new THREE.LatheGeometry(pts, 96);
  const pos = geo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const r = Math.hypot(v3.x, v3.z);
    const a = Math.atan2(v3.z, v3.x);
    const rim = Math.pow(clamp(r / maxR, 0, 1), 9); // フチ付近だけ波打たせる
    const wave = 1 + Math.sin(a * 11) * 0.045 * rim;
    pos.setXYZ(i, v3.x * wave, v3.y, v3.z * wave);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xfffaf2, roughness: 0.16, clearcoat: 0.75, clearcoatRoughness: 0.22 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return { group, mesh, wellRadius: 0.058, wellFloorY: 0.020, rimY: 0.050 };
}

// =========================================================================
// カスタード（皿のくぼみに注がれる液面）
// =========================================================================
export function createCustardPool(radius, maxHeight = 0.022) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffe3ab, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.96, 1, 32, 1, true), bodyMat);
  group.add(body);

  const uniforms = { uTime: { value: 0 }, uPour: { value: 0 }, uRadius: { value: radius } };
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2, 44, 44);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime, uPour;
      varying vec2 vP;
      varying vec3 vWorld;
      void main(){
        vP = position.xy;
        float r = length(vP);
        float rip = (sin(r*70.0 - uTime*6.0)*0.0018 + sin(r*130.0 - uTime*9.0)*0.001) * uPour;
        vec3 p = vec3(position.x, position.y, rip);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRadius, uTime;
      varying vec2 vP;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main(){
        float r = length(vP);
        if (r > uRadius) discard;
        float n = vnoise(vP*40.0 + uTime*0.15);
        vec3 base = mix(vec3(1.0,0.85,0.55), vec3(1.0,0.90,0.66), n);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = normalize(vec3(0.5,0.8,0.4));
        vec3 N = normalize(vec3(0.0,0.0,1.0));
        float dif = 0.65 + 0.35*max(dot(N, L), 0.0);
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 40.0) * 0.5;
        vec3 col = base*dif + vec3(1.0,0.97,0.9)*spec;
        float edge = smoothstep(uRadius, uRadius-0.003, r);
        gl_FragColor = vec4(col, edge);
      }
    `,
  });
  const top = new THREE.Mesh(geo, mat);
  top.rotation.x = -Math.PI / 2;
  group.add(top);

  let level = 0;
  const setLevel = (v) => {
    level = clamp(v, 0, 1);
    const h = Math.max(0.001, level * maxHeight);
    body.scale.y = h;
    body.position.y = h / 2;
    top.position.y = h;
    body.visible = top.visible = level > 0.01;
  };
  setLevel(0);
  return {
    group, top, uniforms, maxHeight,
    setLevel, getLevel: () => level,
    setPouring(b) { uniforms.uPour.value = b ? 1 : Math.max(0, uniforms.uPour.value * 0.9); },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// アイスのスクープ（3種のフレーバー）
// =========================================================================
const FLAVORS = {
  vanilla: 0xfff3da,
  berry: 0xf05a86,
  melon: 0x8fdf9a,
};

export function createIceScoop(flavor) {
  const base = FLAVORS[flavor] ?? FLAVORS.vanilla;
  const geo = new THREE.SphereGeometry(0.027, 22, 16);
  const pos = geo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const n = Math.sin(v3.x * 90) * Math.sin(v3.y * 80) * Math.sin(v3.z * 85);
    const bump = 1 + n * 0.05;
    pos.setXYZ(i, v3.x * bump, v3.y * bump, v3.z * bump);
  }
  geo.computeVertexNormals();
  const hex = '#' + base.toString(16).padStart(6, '0');
  const tex = canvasTexture(64, (g, s) => {
    g.fillStyle = hex; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`;
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 0, 7); g.fill();
    }
  });
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, radius: 0.027 };
}

// =========================================================================
// メレンゲドーム（もこもこ絞り山、頂点はツンと角、動的テクスチャで焼き色を描く）
// =========================================================================
export function createMeringueDome(radius = 0.09, elongate = 1.55) {
  const geo = new THREE.SphereGeometry(radius, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const dir = v3.clone().normalize();
    const bump = 1 + (Math.sin(dir.x * 38 + dir.z * 29) * 0.5 + Math.sin(dir.y * 44 - dir.x * 19) * 0.5) * 0.010;
    v3.multiplyScalar(bump);
    pos.setXYZ(i, v3.x, v3.y, v3.z);
  }
  geo.scale(1, elongate, 1);
  geo.computeVertexNormals();

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fffaf4'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(230,214,190,${0.03 + Math.random() * 0.05})`;
    g.beginPath(); g.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 6, 0, 7); g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  // てっぺんのツンと角
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.11, radius * elongate * 0.32, 10),
    new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.85 })
  );
  peak.position.y = radius * elongate * 0.94;
  peak.castShadow = true;

  const group = new THREE.Group();
  group.add(mesh, peak);
  group.scale.setScalar(0.001);
  group.visible = false;

  const totalHeight = radius * elongate + peak.geometry.parameters.height * 0.9;

  const _lp = new THREE.Vector3();
  function localPointAt(u, vv) {
    const theta = vv * (Math.PI / 2);
    const phi = u * Math.PI * 2;
    const x = -radius * Math.cos(phi) * Math.sin(theta);
    const y = radius * Math.cos(theta) * elongate;
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return _lp.set(x, y, z);
  }

  return {
    group, mesh, peak, canvas, ctx2d: g, texture, radius, elongate, totalHeight,
    setGrowth(v) {
      group.scale.setScalar(Math.max(0.001, v));
      group.visible = v > 0.003;
    },
    localPointAt,
    normalAt(u, vv) { return localPointAt(u, vv).clone().normalize(); },
    worldPointAt(u, vv) {
      mesh.updateMatrixWorld();
      return mesh.localToWorld(localPointAt(u, vv).clone());
    },
    // uv位置に焼き色をじわっとスタンプ（低アルファを積み重ねて琥珀色に近づける）
    paintScorch(u, vv, strength = 0.05) {
      const px = u * size, py = (1 - vv) * size;
      const r = 34 + strength * 10;
      const rg = g.createRadialGradient(px, py, 0, px, py, r);
      rg.addColorStop(0, `rgba(96,52,16,${0.10 * strength})`);
      rg.addColorStop(0.6, `rgba(120,70,24,${0.06 * strength})`);
      rg.addColorStop(1, 'rgba(120,70,24,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      // 横方向の継ぎ目をまたぐ場合のケア
      if (px < r) { g.beginPath(); g.arc(px + size, py, r, 0, Math.PI * 2); g.fill(); }
      if (px > size - r) { g.beginPath(); g.arc(px - size, py, r, 0, Math.PI * 2); g.fill(); }
      texture.needsUpdate = true;
    },
  };
}

// キラキラ積もる砂糖（drawRangeで少しずつ増える）
export function createSugarGlints(radius, elongate, count = 90) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.random(), vv = Math.pow(Math.random(), 0.6);
    const theta = vv * (Math.PI / 2), phi = u * Math.PI * 2;
    positions[i * 3] = -radius * Math.cos(phi) * Math.sin(theta);
    positions[i * 3 + 1] = radius * Math.cos(theta) * elongate + 0.003;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  geo.setDrawRange(0, 0);
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
        vTw = 0.5 + 0.5*sin(uTime*(2.0+seed*3.0)+seed*40.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (5.0 + seed*5.0) * vTw * (1.0/-mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float star = smoothstep(0.5, 0.0, d) * smoothstep(0.2, 0.0, min(abs(p.x), abs(p.y)));
        gl_FragColor = vec4(vec3(1.0,1.0,0.96), star * vTw);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    setCoverage(v) { geo.setDrawRange(0, Math.floor(clamp(v, 0, 1) * count)); },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// パラパラ落ちる砂糖の粒（ドーム上空でループ）
export function createSugarFall(radius, elongate, count = 46) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count);
  const off = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    off[i * 2] = (Math.random() - 0.5) * radius * 1.7;
    off[i * 2 + 1] = (Math.random() - 0.5) * radius * 1.7;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('off', new THREE.BufferAttribute(off, 2));
  const top = radius * elongate + 0.10;
  const uniforms = { uTime: { value: 0 }, uTop: { value: top }, uActive: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute vec2 off;
      uniform float uTime, uTop;
      varying float vA;
      void main(){
        float speed = 0.14 + seed*0.10;
        float y = mod(uTop - uTime*speed - seed*uTop, uTop);
        vec3 p = vec3(off.x, y, off.y);
        vA = smoothstep(0.0, 0.18, y/uTop);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 3.4 * (1.0/-mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uActive;
      varying float vA;
      void main(){
        if (uActive <= 0.0) discard;
        vec2 p = gl_PointCoord - 0.5;
        if (length(p) > 0.5) discard;
        gl_FragColor = vec4(1.0, 0.98, 0.9, vA * uActive * 0.9);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    setActive(v) { uniforms.uActive.value = v ? 1 : 0; },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// バーナー（青い持ち手＋ノズル＋炎）
// =========================================================================
export function createTorchTool() {
  const group = new THREE.Group();
  const handleMat = new THREE.MeshPhysicalMaterial({ color: 0x2f6fe0, roughness: 0.35, clearcoat: 0.6 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.12, 14), handleMat);
  handle.rotation.z = Math.PI * 0.5;
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xcfcfd6, metalness: 0.85, roughness: 0.3 });
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.05, 12), nozzleMat);
  nozzle.rotation.z = -Math.PI * 0.5;
  nozzle.position.set(0.06, 0, 0);
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 10, Math.PI), handleMat);
  trigger.position.set(-0.03, -0.014, 0);
  group.add(handle, nozzle, trigger);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const flame = createFlame();
  flame.group.scale.setScalar(1.7);
  flame.group.rotation.z = -Math.PI * 0.5;
  flame.group.position.set(0.09, 0, 0);
  group.add(flame.group);

  return { group, flame, tipLocalOffset: new THREE.Vector3(0.09, 0, 0) };
}

// =========================================================================
// 飴ガラス層（艶のある琥珀色、fade-in）
// =========================================================================
export function createGlassShell(radius, elongate) {
  const geo = new THREE.SphereGeometry(radius * 1.035, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, elongate, 1);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd98f2e, roughness: 0.06,
    transmission: 0.55, thickness: 0.01, ior: 1.5,
    clearcoat: 1.0, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return {
    group: mesh, mesh,
    setCoverage(v) {
      const op = Math.max(0, v - 0.05) * 0.95;
      mesh.material.opacity = op;
      mesh.visible = op > 0.01;
    },
  };
}

// ヒビ（白線の放射クラック、段階ごとに描き足す）
export function createCrackOverlay(radius, elongate) {
  const size = 512;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(radius * 1.06, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, elongate, 1);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;

  function draw(stage) {
    g.clearRect(0, 0, size, size);
    if (stage > 0) {
      const cx = size * 0.5, cy = size * 0.05;
      const lines = stage === 1 ? 6 : stage === 2 ? 10 : 14;
      g.strokeStyle = 'rgba(255,255,255,0.88)';
      g.lineWidth = stage === 1 ? 2.5 : 3.5;
      for (let i = 0; i < lines; i++) {
        let x = cx, y = cy, ang = (i / lines) * Math.PI * 2 + Math.random() * 0.2;
        g.beginPath(); g.moveTo(x, y);
        const segs = 5 + stage * 2;
        for (let s = 0; s < segs; s++) {
          ang += (Math.random() - 0.5) * 0.6;
          const len = (size * 0.5) / segs * (0.7 + Math.random() * 0.6);
          x += Math.cos(ang) * len; y += Math.sin(ang) * len * 0.85 + len * 0.3;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    texture.needsUpdate = true;
  }

  return {
    group: mesh, mesh,
    setStage(stage) { mesh.visible = stage > 0; draw(stage); },
  };
}

// 割れて飛び散る飴ガラスの破片
export function createShards(count = 10) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd98f2e, roughness: 0.08, transmission: 0.4, thickness: 0.006,
    clearcoat: 1.0, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
  });
  const shards = [];
  for (let i = 0; i < count; i++) {
    const shape = new THREE.Shape();
    const n = 5 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = 0.012 + Math.random() * 0.016;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    mesh.visible = false;
    mesh.castShadow = true;
    group.add(mesh);
    shards.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), active: false, life: 0 });
  }
  return {
    group,
    burst(origin) {
      for (const sh of shards) {
        sh.mesh.visible = true;
        sh.active = true;
        sh.life = 1.6 + Math.random() * 0.6;
        sh.mesh.position.copy(origin);
        sh.mesh.position.x += (Math.random() - 0.5) * 0.02;
        sh.mesh.position.z += (Math.random() - 0.5) * 0.02;
        const a = Math.random() * Math.PI * 2;
        const up = 0.3 + Math.random() * 0.5;
        sh.vel.set(Math.cos(a) * (0.3 + Math.random() * 0.35), up, Math.sin(a) * (0.3 + Math.random() * 0.35));
        sh.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        sh.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      }
    },
    update(dt, floorY) {
      for (const sh of shards) {
        if (!sh.active) continue;
        sh.vel.y -= 1.6 * dt;
        sh.mesh.position.addScaledVector(sh.vel, dt);
        sh.mesh.rotation.x += sh.spin.x * dt;
        sh.mesh.rotation.y += sh.spin.y * dt;
        sh.mesh.rotation.z += sh.spin.z * dt;
        sh.life -= dt;
        if (sh.mesh.position.y < floorY) { sh.mesh.position.y = floorY; sh.vel.y = 0; sh.vel.x *= 0.85; sh.vel.z *= 0.85; }
        if (sh.life <= 0) { sh.active = false; sh.mesh.visible = false; }
      }
    },
  };
}

// =========================================================================
// 花火スパークラー（線香花火風）
// =========================================================================
export function createSparkler(count = 60) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count);
  const angles = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    angles[i * 2] = Math.random() * Math.PI * 2;
    angles[i * 2 + 1] = Math.random() * Math.PI * 0.5 + 0.1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('ang', new THREE.BufferAttribute(angles, 2));
  const uniforms = { uTime: { value: 0 }, uIgnite: { value: -10 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute vec2 ang;
      uniform float uTime, uIgnite;
      varying float vAlpha;
      void main(){
        float age = mod(uTime - uIgnite, 0.9);
        float speed = 0.25 + seed*0.35;
        vec3 dir = vec3(cos(ang.x)*sin(ang.y), cos(ang.y), sin(ang.x)*sin(ang.y));
        vec3 p = dir * speed * age;
        p.y -= 0.5 * age * age;
        vAlpha = step(uIgnite, uTime) * clamp(1.0 - age*1.2, 0.0, 1.0);
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_PointSize = (3.0 + seed*3.0) * (1.0/-mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main(){
        if (vAlpha <= 0.0) discard;
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(vec3(1.0, 0.85, 0.55), a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  const light = new THREE.PointLight(0xffb35a, 0, 0.5, 2);
  const group = new THREE.Group();
  group.add(points, light);
  let ignited = false;
  return {
    group, points, light,
    ignite(t) { ignited = true; uniforms.uIgnite.value = t; points.visible = true; },
    update(dt, t) {
      uniforms.uTime.value = t;
      if (ignited) light.intensity = 0.5 + Math.abs(Math.sin(t * 24)) * 0.6;
    },
  };
}

// 冷たい冷気ミスト（下に漂う）
export function createColdMist(count = 6) {
  const group = new THREE.Group();
  const tex = glowTexture('rgba(210,235,255,0.55)', 'rgba(210,235,255,0)');
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.07);
    group.add(s);
    items.push({ s, phase: Math.random() });
  }
  let strength = 0;
  return {
    group,
    setStrength(v) { strength = v; },
    update(dt, t) {
      for (const it of items) {
        it.phase += dt * 0.3;
        const k = it.phase % 1;
        it.s.position.set(Math.sin(it.phase * 5 + t) * 0.06, 0.07 - k * 0.09, Math.cos(it.phase * 4.2) * 0.06);
        it.s.scale.setScalar(0.05 + k * 0.09);
        it.s.material.opacity = strength * Math.sin(k * Math.PI) * 0.6;
      }
    },
  };
}
