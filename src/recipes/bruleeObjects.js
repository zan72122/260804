// 「あぶってパリン！」専用オブジェクト: ラメキン・カスタード・アイス・絞りメレンゲドーム・
// バーナー・飴ガラス・破片・スパークラー・冷気ミスト
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture, glowTexture, clamp, lerp } from '../util.js';

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

function smoothstep(e0, e1, x) { x = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return x * x * (3 - 2 * x); }

// =========================================================================
// 白磁ラメキン（縦フルート溝＋縁ロール） r≈0.075 h≈0.06
// =========================================================================
export function createDish() {
  const group = new THREE.Group();
  const wellRadius = 0.050, wellFloorY = 0.020, rimY = 0.058;
  const pts = [
    new THREE.Vector2(0.0, 0.006),
    new THREE.Vector2(0.046, 0.006),
    new THREE.Vector2(0.050, 0.010),
    new THREE.Vector2(0.046, 0.016),
    new THREE.Vector2(0.055, 0.024),
    new THREE.Vector2(0.062, 0.036),
    new THREE.Vector2(0.067, 0.048),
    new THREE.Vector2(0.070, 0.052),
    new THREE.Vector2(0.076, 0.056), // ロール縁の外側ふくらみ
    new THREE.Vector2(0.074, 0.060), // 縁のてっぺん
    new THREE.Vector2(0.067, 0.058), // 内側へ丸まる
    new THREE.Vector2(0.060, 0.050),
    new THREE.Vector2(0.052, 0.030),
    new THREE.Vector2(0.0, wellFloorY),
  ];
  const geo = new THREE.LatheGeometry(pts, 64);
  const pos = geo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const r = Math.hypot(v3.x, v3.z);
    const a = Math.atan2(v3.z, v3.x);
    const outerEnv = smoothstep(wellRadius + 0.004, wellRadius + 0.014, r);
    const rimEnv = 1 - smoothstep(0.050, 0.058, v3.y);
    const flute = Math.cos(a * 22) * 0.0024 * outerEnv * Math.max(rimEnv, 0.12);
    const nr = r + flute;
    const s = r > 0.0001 ? nr / r : 1;
    pos.setXYZ(i, v3.x * s, v3.y, v3.z * s);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xfffaf3, roughness: 0.14, clearcoat: 0.85, clearcoatRoughness: 0.18 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);

  // 接地の柔らかい影ブロブ（浮いて見えないように）
  const shadowTex = glowTexture('rgba(40,25,15,0.32)', 'rgba(40,25,15,0)');
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.20, 0.20),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0015;
  group.add(shadow);

  return { group, mesh, wellRadius, wellFloorY, rimY };
}

// =========================================================================
// カスタード（皿のくぼみに注がれる液面、バニラ斑点＋縁のメニスカス）
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
      uniform float uTime, uPour, uRadius;
      varying vec2 vP;
      varying vec3 vWorld;
      void main(){
        vP = position.xy;
        float r = length(vP);
        float rip = (sin(r*70.0 - uTime*6.0)*0.0018 + sin(r*130.0 - uTime*9.0)*0.001) * uPour;
        float meniscus = smoothstep(uRadius*0.82, uRadius, r) * 0.0032;
        vec3 p = vec3(position.x, position.y, rip + meniscus);
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
        // バニラビーンズの黒い斑点
        float speck = step(0.978, vnoise(vP*260.0 + 17.0)) * step(0.4, vnoise(vP*90.0 - 5.0));
        base = mix(base, vec3(0.22,0.14,0.05), speck * 0.75);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = normalize(vec3(0.5,0.8,0.4));
        vec3 N = normalize(vec3(0.0,0.0,1.0));
        float dif = 0.62 + 0.38*max(dot(N, L), 0.0);
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 70.0) * 0.65;
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
// アイスのスクープ（ディッシャーの巻き筋＋ざらつき＋フレーバー模様＋接地の溶けだまり）
// =========================================================================
const FLAVORS = {
  vanilla: 0xfff3da,
  berry: 0xf05a86,
  melon: 0x8fdf9a,
};

function flavorTexture(flavor, hex) {
  const hexStr = '#' + hex.toString(16).padStart(6, '0');
  return canvasTexture(128, (g, s) => {
    g.fillStyle = hexStr; g.fillRect(0, 0, s, s);
    // 氷の粒立ち(ざらつき)
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.11})`;
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.4, 0, 7); g.fill();
    }
    if (flavor === 'vanilla') {
      // バニラビーンズの黒い種
      for (let i = 0; i < 100; i++) {
        g.fillStyle = `rgba(38,22,10,${0.5 + Math.random() * 0.4})`;
        g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 0.6 + Math.random() * 0.7, 0.6 + Math.random() * 0.7, 0, 0, 7); g.fill();
      }
    } else if (flavor === 'berry') {
      // マーブル模様
      for (let i = 0; i < 9; i++) {
        const cx = Math.random() * s, cy = Math.random() * s;
        const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 10 + Math.random() * 14);
        grd.addColorStop(0, 'rgba(150,10,45,0.55)');
        grd.addColorStop(1, 'rgba(150,10,45,0)');
        g.fillStyle = grd;
        g.beginPath(); g.ellipse(cx, cy, 12 + Math.random() * 10, 6 + Math.random() * 8, Math.random() * Math.PI, 0, 7); g.fill();
      }
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = `rgba(255,214,230,${0.3 + Math.random() * 0.3})`;
        g.lineWidth = 2 + Math.random() * 3;
        g.beginPath();
        g.moveTo(Math.random() * s, Math.random() * s);
        g.bezierCurveTo(Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s);
        g.stroke();
      }
    } else if (flavor === 'melon') {
      // メロンの薄縞
      g.strokeStyle = 'rgba(255,255,255,0.32)';
      for (let i = -2; i < 10; i++) {
        g.lineWidth = 1.3 + Math.random();
        g.beginPath();
        const y0 = i * 14;
        g.moveTo(0, y0);
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 4);
        g.stroke();
      }
    }
  });
}

const iceRoughTex = canvasTexture(48, (g, s) => {
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const v = 128 + Math.round((Math.random() - 0.5) * 80);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
  }
}, { srgb: false });

export function createIceScoop(flavor) {
  const base = FLAVORS[flavor] ?? FLAVORS.vanilla;
  const R = 0.027;
  const geo = new THREE.SphereGeometry(R, 26, 18);
  const pos = geo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const dir = v3.clone().normalize();
    // てっぺんはディッシャーで巻き上げた渦筋、底は皿に寄せて平らに
    const swirl = Math.sin(Math.atan2(dir.z, dir.x) * 5 + dir.y * 6) * 0.030 * smoothstep(-0.2, 0.9, dir.y);
    const fine = Math.sin(v3.x * 95) * Math.sin(v3.y * 88) * Math.sin(v3.z * 90) * 0.045;
    const flat = dir.y < -0.55 ? lerp(1, 0.82, smoothstep(-0.55, -1, dir.y)) : 1;
    const bump = (1 + swirl + fine) * flat;
    v3.multiplyScalar(bump);
    pos.setXYZ(i, v3.x, v3.y, v3.z);
  }
  geo.computeVertexNormals();
  const tex = flavorTexture(flavor, base);
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughnessMap: iceRoughTex, roughness: 0.85, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;

  // 接地部のうっすら溶けだまり
  const meltHex = { vanilla: 0xfff0d0, berry: 0xff9fb8, melon: 0xd7f0c0 }[flavor] ?? 0xffffff;
  const melt = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.35, 24),
    new THREE.MeshPhysicalMaterial({ color: meltHex, roughness: 0.15, transparent: true, opacity: 0.32, clearcoat: 0.6 })
  );
  melt.rotation.x = -Math.PI / 2;
  melt.position.y = -R * 0.86;

  const group = new THREE.Group();
  group.add(mesh, melt);
  return { group, mesh, radius: R };
}

// =========================================================================
// 絞りメレンゲドーム（らせん絞りコイル＋巻きツノ＋フレネル裏透かし＋焼き色ベイク）
// =========================================================================
const RIDGE_N = 9;          // 絞り山の本数
const RIDGE_TURNS = 3.4;    // らせんの巻き数（3〜4周）
const RIDGE_AMP = 0.125;    // 絞り山の振幅（半径比）
const APEX_TAPER_END = 0.09; // 頂点付近で山を消すしきい値
const CURL_END = 0.15;      // 巻きツノの範囲
const CURL_ANGLE = 2.35;    // 巻きツノが倒れる向き
const FINE_AMP = 0.026;     // 微細ノイズ振幅

// v3(半径radiusの球面上の点, 未伸長)にらせん絞り山＋巻きツノを適用し、
// 「峰らしさ」(-1..1)を返す（焼けやすさマップのベイクにも使う）
function meringueBump(v3, radius, theta, phi) {
  const latFrac = theta / (Math.PI / 2); // 0=頂点 .. 1=底
  const phase = phi * RIDGE_N - latFrac * RIDGE_TURNS * Math.PI * 2;
  let w = Math.cos(phase);
  w = Math.sign(w) * Math.pow(Math.abs(w), 0.6); // 山を尖らせ谷を丸く
  const taper = smoothstep(0, APEX_TAPER_END, latFrac);
  const ridge = w * taper;
  const nx = v3.x / radius, ny = v3.y / radius, nz = v3.z / radius;
  const fine = (Math.sin(nx * 46 + nz * 33) * 0.5 + Math.sin(ny * 52 - nx * 21) * 0.5) * FINE_AMP * (0.4 + 0.6 * taper);
  const bump = 1 + ridge * RIDGE_AMP + fine;
  v3.multiplyScalar(bump);

  const curlT = clamp(1 - latFrac / CURL_END, 0, 1);
  if (curlT > 0) {
    const p2 = curlT * curlT;
    v3.x += Math.cos(CURL_ANGLE) * p2 * radius * 0.42;
    v3.z += Math.sin(CURL_ANGLE) * p2 * radius * 0.42;
    v3.y -= p2 * radius * 0.16;
  }
  return ridge;
}

export function createMeringueDome(radius = 0.09, elongate = 1.55) {
  const wSeg = 72, hSeg = 40;
  const geo = new THREE.SphereGeometry(radius, wSeg, hSeg, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  const uvAttr = geo.attributes.uv;

  // 峰らしさ(曲率相当)を各頂点でJS計算し、小さなcanvasへUVベイク（lighten合成で最大値を残す）
  const BAKE = 96;
  const bakeCanvas = document.createElement('canvas');
  bakeCanvas.width = bakeCanvas.height = BAKE;
  const bg = bakeCanvas.getContext('2d');
  bg.fillStyle = '#000'; bg.fillRect(0, 0, BAKE, BAKE);
  bg.globalCompositeOperation = 'lighten';

  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const dir = v3.clone().normalize();
    const theta = Math.acos(clamp(dir.y, -1, 1));
    const phi = Math.atan2(v3.z, -v3.x);
    const ridge = meringueBump(v3, radius, theta, phi);
    pos.setXYZ(i, v3.x, v3.y, v3.z);

    const px = uvAttr.getX(i) * BAKE;
    const py = (1 - uvAttr.getY(i)) * BAKE;
    const g255 = Math.round(clamp(ridge * 0.5 + 0.5, 0, 1) * 255);
    bg.fillStyle = `rgb(${g255},${g255},${g255})`;
    bg.beginPath(); bg.arc(px, py, 2.6, 0, Math.PI * 2); bg.fill();
    if (px < 3) { bg.beginPath(); bg.arc(px + BAKE, py, 2.6, 0, Math.PI * 2); bg.fill(); }
    if (px > BAKE - 3) { bg.beginPath(); bg.arc(px - BAKE, py, 2.6, 0, Math.PI * 2); bg.fill(); }
  }
  geo.scale(1, elongate, 1);
  geo.computeVertexNormals();

  const peakImg = bg.getImageData(0, 0, BAKE, BAKE).data;
  const PEAK = new Float32Array(BAKE * BAKE);
  for (let i = 0; i < BAKE * BAKE; i++) PEAK[i] = 0.5 + (peakImg[i * 4] / 255) * 1.25;

  const heat = new Float32Array(BAKE * BAKE);
  const burnt = new Uint8Array(BAKE * BAKE);
  const speck = new Float32Array(BAKE * BAKE);
  for (let i = 0; i < BAKE * BAKE; i++) speck[i] = (Math.random() - 0.5) * 14;

  // 焼き色(map)・艶(roughnessMap)・飴殻の被覆(coverage)の3枚を焼き状態から都度再構築
  const COLOR_SIZE = 320;
  const colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = COLOR_SIZE;
  const colorCtx = colorCanvas.getContext('2d');
  const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = COLOR_SIZE;
  const roughCtx = roughCanvas.getContext('2d');
  const coverCanvas = document.createElement('canvas'); coverCanvas.width = coverCanvas.height = 128;
  const coverCtx = coverCanvas.getContext('2d');

  const smallColor = document.createElement('canvas'); smallColor.width = smallColor.height = BAKE;
  const smallColorCtx = smallColor.getContext('2d');
  const smallRough = document.createElement('canvas'); smallRough.width = smallRough.height = BAKE;
  const smallRoughCtx = smallRough.getContext('2d');
  const smallCover = document.createElement('canvas'); smallCover.width = smallCover.height = BAKE;
  const smallCoverCtx = smallCover.getContext('2d');

  const colorImg = smallColorCtx.createImageData(BAKE, BAKE);
  const roughImg = smallRoughCtx.createImageData(BAKE, BAKE);
  const coverImg = smallCoverCtx.createImageData(BAKE, BAKE);

  // 焼き色の段階LUT: 白 → クリーム → 黄金 → 琥珀 → 焦げ茶
  const LUT = [
    [0.00, 255, 250, 244],
    [0.26, 250, 224, 175],
    [0.50, 230, 172, 86],
    [0.74, 172, 104, 42],
    [1.00, 84, 46, 20],
  ];
  const _rgb = [0, 0, 0];
  function lutColor(h, out) {
    h = clamp(h, 0, 1);
    let i = 0;
    while (i < LUT.length - 2 && h > LUT[i + 1][0]) i++;
    const a = LUT[i], b = LUT[i + 1];
    const t = clamp((h - a[0]) / (b[0] - a[0] || 1), 0, 1);
    out[0] = lerp(a[1], b[1], t);
    out[1] = lerp(a[2], b[2], t);
    out[2] = lerp(a[3], b[3], t);
  }

  const texture = new THREE.CanvasTexture(colorCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  const coverTexture = new THREE.CanvasTexture(coverCanvas);

  function redraw() {
    for (let i = 0; i < BAKE * BAKE; i++) {
      const h = heat[i];
      lutColor(h, _rgb);
      let r = _rgb[0] + speck[i], g = _rgb[1] + speck[i] * 0.8, b = _rgb[2] + speck[i] * 0.6;
      let rough = 0.58 - smoothstep(0.05, 0.85, h) * 0.46;
      if (burnt[i]) {
        r *= 0.4; g *= 0.32; b *= 0.28;
        rough = Math.min(rough, 0.14);
      }
      const j = i * 4;
      colorImg.data[j] = clamp(r, 0, 255); colorImg.data[j + 1] = clamp(g, 0, 255); colorImg.data[j + 2] = clamp(b, 0, 255); colorImg.data[j + 3] = 255;
      const rg = Math.round(clamp(rough, 0.06, 0.62) * 255);
      roughImg.data[j] = rg; roughImg.data[j + 1] = rg; roughImg.data[j + 2] = rg; roughImg.data[j + 3] = 255;
      const cov = Math.round(smoothstep(0.16, 0.62, h) * 255);
      coverImg.data[j] = cov; coverImg.data[j + 1] = cov; coverImg.data[j + 2] = cov; coverImg.data[j + 3] = 255;
    }
    smallColorCtx.putImageData(colorImg, 0, 0);
    smallRoughCtx.putImageData(roughImg, 0, 0);
    smallCoverCtx.putImageData(coverImg, 0, 0);
    colorCtx.imageSmoothingEnabled = true;
    colorCtx.clearRect(0, 0, COLOR_SIZE, COLOR_SIZE);
    colorCtx.drawImage(smallColor, 0, 0, COLOR_SIZE, COLOR_SIZE);
    roughCtx.imageSmoothingEnabled = true;
    roughCtx.clearRect(0, 0, COLOR_SIZE, COLOR_SIZE);
    roughCtx.drawImage(smallRough, 0, 0, COLOR_SIZE, COLOR_SIZE);
    coverCtx.imageSmoothingEnabled = true;
    coverCtx.clearRect(0, 0, 128, 128);
    coverCtx.drawImage(smallCover, 0, 0, 128, 128);
    texture.needsUpdate = true;
    roughTexture.needsUpdate = true;
    coverTexture.needsUpdate = true;
  }
  redraw(); // 初期状態(白いメレンゲ)を描く

  const mat = new THREE.MeshStandardMaterial({ map: texture, roughnessMap: roughTexture, roughness: 1.0 });
  // フレネルによる薄暖色の裏透かし（フェイクSSS）
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: new THREE.Color(0xffc98f) };
    shader.uniforms.uRimStrength = { value: 0.26 };
    shader.fragmentShader = 'uniform vec3 uRimColor;\nuniform float uRimStrength;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      {
        vec3 rN = normalize( vNormal );
        vec3 rV = normalize( vViewPosition );
        float rFres = pow( 1.0 - max( dot( rN, rV ), 0.0 ), 2.2 );
        outgoingLight += uRimColor * rFres * uRimStrength;
      }
      #include <opaque_fragment>
      `
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(0.001);
  group.visible = false;

  const totalHeight = radius * elongate * 1.18; // 絞り山・巻きツノを含めた概算高さ

  const _lp = new THREE.Vector3();
  // u:0..1(周方向) V:1=頂点..0=底(raycastのuv.yと同じ向き)
  function localPointAt(u, V) {
    const theta = (1 - V) * (Math.PI / 2);
    const phi = u * Math.PI * 2;
    _lp.set(-radius * Math.cos(phi) * Math.sin(theta), radius * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta));
    meringueBump(_lp, radius, theta, phi);
    _lp.y *= elongate;
    return _lp;
  }

  function stampAt(cx, cy, strength) {
    const rad = 7.5, rad2 = rad * rad;
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(BAKE - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(BAKE - 1, Math.ceil(cy + rad));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy, d2 = dx * dx + dy * dy;
        if (d2 > rad2) continue;
        const idx = yy * BAKE + xx;
        const falloff = 1 - Math.sqrt(d2) / rad;
        const gain = falloff * falloff * strength * PEAK[idx] * 0.5;
        if (gain <= 0) continue;
        const nh = clamp(heat[idx] + gain, 0, 1);
        heat[idx] = nh;
        if (nh > 0.86 && !burnt[idx] && Math.random() < gain * 3.5) burnt[idx] = 1;
      }
    }
  }

  return {
    group, mesh, geometry: geo, texture, roughTexture, coverageTexture: coverTexture, radius, elongate, totalHeight,
    setGrowth(v) {
      group.scale.setScalar(Math.max(0.001, v));
      group.visible = v > 0.003;
    },
    localPointAt,
    normalAt(u, V) { return localPointAt(u, V).clone().normalize(); },
    worldPointAt(u, V) {
      mesh.updateMatrixWorld();
      return mesh.localToWorld(localPointAt(u, V).clone());
    },
    // uv位置に焼き色をスタンプ（曲率マップで凸部ほど強く焼ける）
    paintScorch(u, V, strength = 0.05, skipRedraw = false) {
      const cx = u * BAKE, cy = (1 - V) * BAKE;
      stampAt(cx, cy, strength);
      if (cx < 8) stampAt(cx + BAKE, cy, strength);
      if (cx > BAKE - 8) stampAt(cx - BAKE, cy, strength);
      if (!skipRedraw) redraw();
    },
    // ドーム全体にじんわり回る余熱。峰(PEAKが高い)ほど早く焦げ、谷はクリーム色
    // 止まりで残るように重み付けし、TORCH完了時には表面の大半が黄金〜琥珀に
    // 覆われるようにする（狙い撃ちのpaintScorchだけでは塗り残しが出るため併用）
    soakHeat(hdt, skipRedraw = false) {
      const rate = 0.155;
      for (let i = 0; i < BAKE * BAKE; i++) {
        const w = 0.28 + 0.62 * ((PEAK[i] - 0.5) / 1.25);
        const gain = hdt * rate * w;
        const nh = clamp(heat[i] + gain, 0, 1);
        heat[i] = nh;
        if (nh > 0.88 && !burnt[i] && Math.random() < gain * 3.0) burnt[i] = 1;
      }
      if (!skipRedraw) redraw();
    },
    requestRedraw() { redraw(); },
  };
}

// =========================================================================
// メレンゲドームの割れた欠片（くさび状に4〜6分割し、外側へ倒れ開く）
// 既存の焼き色ジオメトリ/テクスチャをそのまま流用し、三角形を方位角(phi)で
// バケット分けして個々の欠片ジオメトリを作る。底の縁を蝶番にして外へ倒すので、
// 下側は器の縁に残ったまま上だけ開いたような見た目になる
// =========================================================================
export function createMeringueWedges(meringue, count = 5) {
  const { geometry, texture, roughTexture, localPointAt } = meringue;
  const group = new THREE.Group();

  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = src.attributes.position, nrm = src.attributes.normal, uvAttr = src.attributes.uv;
  const triCount = Math.floor(pos.count / 3);
  const buckets = Array.from({ length: count }, () => ({ pos: [], nrm: [], uv: [] }));
  for (let t = 0; t < triCount; t++) {
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const idx = t * 3 + k; cx += pos.getX(idx); cz += pos.getZ(idx); }
    let phi = Math.atan2(cz, -cx); // meringueBump系と同じphi定義
    if (phi < 0) phi += Math.PI * 2;
    const bucket = Math.min(count - 1, Math.floor((phi / (Math.PI * 2)) * count));
    const b = buckets[bucket];
    for (let k = 0; k < 3; k++) {
      const idx = t * 3 + k;
      b.pos.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
      b.nrm.push(nrm.getX(idx), nrm.getY(idx), nrm.getZ(idx));
      b.uv.push(uvAttr.getX(idx), uvAttr.getY(idx));
    }
  }

  // 表(外側)は焼き色テクスチャ、裏(内側=断面)は白いメレンゲの中身に見えるよう
  // gl_FrontFacingで塗り分ける（そのままだと裏面にも焼き色マップが映り、
  // 「焦げた破片の山」に見えて食欲を損なうため）。
  // 影は落とさない/受けない（欠片同士が密集して倒れると二重の陰影で黒く沈み、
  // 07(炙り直後)の黄金〜琥珀と別物に見えてしまうため）。わずかなemissiveで
  // 明るさの下限を確保し、どの向きでも同じ焼き色に見えるようにする
  const mat = new THREE.MeshStandardMaterial({
    map: texture, roughnessMap: roughTexture, roughness: 1.0, side: THREE.DoubleSide,
    emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.18,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      if (!gl_FrontFacing) {
        diffuseColor.rgb = vec3(1.0, 0.98, 0.93);
      }
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      if (!gl_FrontFacing) { roughnessFactor = 0.78; }
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      if (!gl_FrontFacing) { totalEmissiveRadiance = vec3(0.0); }
      `
    );
  };
  const SCALE = 0.78; // 開いたときに皿から出過ぎないよう少し縮める(蝶番基準)
  const pivots = [];
  for (let i = 0; i < count; i++) {
    const b = buckets[i];
    if (b.pos.length === 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));

    const uMid = (i + 0.5) / count;
    const phiMid = uMid * Math.PI * 2;
    // 底(V=0)のこの方位の点を蝶番にする（器の縁とほぼ同じ高さ・半径）
    const hinge = localPointAt(uMid, 0).clone();
    // up(0,1,0)からradial外向きベクトルへ最短回転する軸
    const axis = new THREE.Vector3(Math.sin(phiMid), 0, -Math.cos(phiMid)).normalize();

    const radial = new THREE.Vector3(hinge.x, 0, hinge.z).normalize();
    const pivot = new THREE.Group();
    pivot.position.copy(hinge);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.copy(hinge).multiplyScalar(-SCALE); // 蝶番を拡縮の中心に保つ
    mesh.scale.setScalar(SCALE);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    pivot.add(mesh);
    group.add(pivot);
    pivots.push({
      pivot, axis, radial, hinge: hinge.clone(),
      startT: 0, duration: 0.7, finalAngle: 1.1, finalOffset: new THREE.Vector3(),
    });
  }
  group.visible = false;

  return {
    group,
    // t: 破裂した瞬間の経過秒(clockT)。以降update(t)に絶対時刻を渡すだけで
    // dt/hdtの積分に頼らず開き切る（低fps環境でも実時間で確実に完了する）
    open(t) {
      group.visible = true;
      pivots.forEach((p, i) => {
        p.startT = t + i * 0.025;
        p.duration = 0.6 + Math.random() * 0.3;
        // 花びらが開くように、蝶番(器の縁)を軸にほぼ水平(約90〜100度)まで
        // 外側へ倒し、皿の外周に平たく着地させる。90度を超えると欠片の
        // 質量は中心の真上から完全に外れるため、アイス・カスタードを覆わない
        p.finalAngle = 1.58 + Math.random() * 0.17; // 約90.5〜100度（皿へ潜り込まない範囲）
        p.finalOffset.set(
          p.radial.x * (0.012 + Math.random() * 0.014),
          -(0.008 + Math.random() * 0.006),
          p.radial.z * (0.012 + Math.random() * 0.014)
        );
      });
    },
    update(t) {
      for (const p of pivots) {
        const k = clamp((t - p.startT) / p.duration, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        p.pivot.position.set(
          p.hinge.x + p.finalOffset.x * e,
          p.hinge.y + p.finalOffset.y * e,
          p.hinge.z + p.finalOffset.z * e
        );
        p.pivot.quaternion.setFromAxisAngle(p.axis, p.finalAngle * e);
      }
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
export function createTorchFlame() {
  // コア(青白)＋外炎(橙)の2層＋熱ゆらぎ
  const uniforms = { uTime: { value: 0 }, uSeed: { value: Math.random() * 10 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime, uSeed;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float shimmer = sin(uTime*16.0 + uSeed + uv.y*8.0) * 0.06 * uv.y;
        vec3 p = right * (position.x + shimmer*0.012) + up * position.y;
        vec4 wp = modelMatrix * vec4(0.0,0.0,0.0,1.0);
        wp.xyz += p;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv - vec2(0.5, 0.22);
        p.y /= 1.8 + sin(uTime*13.0+uSeed)*0.10;
        float d = length(p);
        float outer = smoothstep(0.5, 0.05, d);
        float core = smoothstep(0.22, 0.0, length(p*vec2(1.0,1.15)));
        vec3 outerCol = mix(vec3(1.0,0.35,0.05), vec3(1.0,0.75,0.2), vUv.y);
        vec3 coreCol = mix(vec3(0.55,0.75,1.0), vec3(1.0,1.0,0.95), smoothstep(0.0,0.16,d));
        vec3 col = mix(outerCol*outer, coreCol, core);
        float a = clamp(outer*0.8 + core, 0.0, 1.0);
        gl_FragColor = vec4(col*(outer*1.1+core*1.5), a);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.05), mat);
  mesh.geometry.translate(0, 0.016, 0);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, uniforms, update(dt, t) { uniforms.uTime.value = t; } };
}

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

  const flame = createTorchFlame();
  flame.group.scale.setScalar(1.8);
  flame.group.rotation.z = -Math.PI * 0.5;
  flame.group.position.set(0.09, 0, 0);
  group.add(flame.group);

  return { group, flame, tipLocalOffset: new THREE.Vector3(0.09, 0, 0) };
}

// =========================================================================
// 飴ガラス層（透明感のある琥珀。焼き色マップの被覆テクスチャをそのままalphaMapに使い、
// 「焼けた場所にだけ」飴がまとうようにする＝縁の垂れしずくも数か所つける）
// =========================================================================
export function createGlassShell(meringueGeo, coverageTexture, radius, elongate) {
  const geo = meringueGeo.clone();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
  const THICK = radius * 0.05;
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    n3.fromBufferAttribute(nrm, i);
    v3.addScaledVector(n3, THICK);
    pos.setXYZ(i, v3.x, v3.y, v3.z);
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd08a34, roughness: 0.10,
    transmission: 0.62, thickness: 0.012, ior: 1.45,
    clearcoat: 1.0, clearcoatRoughness: 0.06,
    transparent: true, opacity: 0.92, alphaMap: coverageTexture,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;

  // 縁の垂れしずく（クリアコート+opacityで軽量に）
  const dripMat = new THREE.MeshPhysicalMaterial({ color: 0xc27a22, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.1, transparent: true, opacity: 0.88 });
  const drips = new THREE.Group();
  const DN = 6;
  const dripMeshes = [];
  for (let i = 0; i < DN; i++) {
    const a = (i / DN) * Math.PI * 2 + Math.random() * 0.4;
    const rimTheta = (Math.PI / 2) * 0.97;
    const bx = -radius * Math.cos(a) * Math.sin(rimTheta);
    const bz = radius * Math.sin(a) * Math.sin(rimTheta);
    const by = radius * Math.cos(rimTheta) * elongate;
    const drip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.05, 10, 8), dripMat);
    drip.scale.set(0.6, 1.2, 0.6);
    drip.position.set(bx, by - radius * 0.02, bz);
    drip.visible = false;
    drips.add(drip);
    dripMeshes.push(drip);
  }

  const group = new THREE.Group();
  group.add(mesh, drips);

  return {
    group, mesh,
    setCoverage(v) {
      mesh.visible = v > 0.04;
      const dripShow = clamp((v - 0.55) / 0.45, 0, 1);
      dripMeshes.forEach((d, i) => {
        const t = clamp(dripShow * 1.3 - i * 0.12, 0, 1);
        d.visible = t > 0.02;
        d.scale.set(0.6, 1.2 + t * 1.3, 0.6);
      });
    },
  };
}

// ヒビ（濃色の放射クラック線＋影/ハイライトで段差を演出、段階ごとに描き足す）
export function createCrackOverlay(meringueGeo, radius, elongate) {
  const size = 512;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = meringueGeo.clone();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
  // 飴ガラス層(THICK=radius*0.05)より外側に置き、ヒビ線が飴の下に埋もれず
  // ちゃんと表面に見えるようにする
  const THICK = radius * 0.072;
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    n3.fromBufferAttribute(nrm, i);
    v3.addScaledVector(n3, THICK);
    pos.setXYZ(i, v3.x, v3.y, v3.z);
  }
  const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.25, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;

  function strokeLine(pts, color, width) {
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }

  function draw(stage) {
    g.clearRect(0, 0, size, size);
    if (stage > 0) {
      const cx = size * 0.5, cy = size * 0.06;
      const lines = stage === 1 ? 6 : stage === 2 ? 10 : 14;
      const segs = 5 + stage * 2;
      for (let i = 0; i < lines; i++) {
        let x = cx, y = cy, ang = (i / lines) * Math.PI * 2 + Math.random() * 0.2;
        const pts = [[x, y]];
        for (let s = 0; s < segs; s++) {
          ang += (Math.random() - 0.5) * 0.6;
          const len = (size * 0.5) / segs * (0.7 + Math.random() * 0.6);
          x += Math.cos(ang) * len; y += Math.sin(ang) * len * 0.85 + len * 0.3;
          pts.push([x, y]);
        }
        // 影(右下)→濃色の本体→ハイライト(左上)の3層でわずかな段差を演出
        g.save(); g.translate(1.1, 1.1);
        strokeLine(pts, 'rgba(30,14,4,0.55)', stage === 1 ? 3.2 : 4.2);
        g.restore();
        strokeLine(pts, 'rgba(58,28,10,0.92)', stage === 1 ? 2.2 : 3.0);
        g.save(); g.translate(-0.8, -0.8);
        strokeLine(pts, 'rgba(255,224,180,0.55)', 1.1);
        g.restore();
      }
    }
    texture.needsUpdate = true;
  }

  return {
    group: mesh, mesh,
    setStage(stage) { mesh.visible = stage > 0; draw(stage); },
  };
}

// 割れて飛び散る飴ガラスの破片（厚みあり、皿の周りに回転しながら落ちて着地する）
// 位置は経過秒(t)だけの純関数として計算する（dt/hdtの積分に頼らない）。
// これによりヘッドレス低fps環境でもコマ送りの合間に実時間が大きく進んでいれば
// その分だけ正しく「着地済み」の姿勢が描かれ、宙に静止したまま残ることがない。
export function createShards(count = 13) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xd98f2e, roughness: 0.10, clearcoat: 1.0, clearcoatRoughness: 0.06,
    transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  });
  const shards = [];
  for (let i = 0; i < count; i++) {
    const shape = new THREE.Shape();
    const n = 5 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = 0.006 + Math.random() * 0.008; // 従来の約半分サイズ
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0016, bevelEnabled: true, bevelSize: 0.0004, bevelThickness: 0.0004, bevelSegments: 1 });
    geo.translate(0, 0, -0.0008);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.castShadow = true;
    group.add(mesh);
    shards.push({
      mesh, active: false, landed: false, burstT: 0, duration: 1,
      start: new THREE.Vector3(), target: new THREE.Vector3(),
      rot0: new THREE.Vector3(), spin: new THREE.Vector3(), arcH: 0,
    });
  }
  return {
    group,
    // origin: 発生位置(頂点付近) / floorY: 着地面の高さ(皿の上面) / t: 破裂時の経過秒
    burst(origin, floorY, t) {
      for (const sh of shards) {
        sh.mesh.visible = true;
        sh.active = true;
        sh.landed = false;
        sh.burstT = t;
        sh.duration = 0.7 + Math.random() * 0.55; // 必ず1.5秒以内に着地しきる
        sh.start.copy(origin);
        sh.start.x += (Math.random() - 0.5) * 0.02;
        sh.start.z += (Math.random() - 0.5) * 0.02;
        const a = Math.random() * Math.PI * 2;
        const r = 0.085 + Math.random() * 0.05; // 器のすぐ外〜皿の上に散らばる
        sh.target.set(Math.cos(a) * r, floorY + 0.002 + Math.random() * 0.004, Math.sin(a) * r);
        sh.arcH = 0.05 + Math.random() * 0.06;
        sh.rot0.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        sh.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
        sh.mesh.position.copy(sh.start);
        sh.mesh.rotation.set(sh.rot0.x, sh.rot0.y, sh.rot0.z);
      }
    },
    update(t) {
      for (const sh of shards) {
        if (!sh.active) continue;
        const k = clamp((t - sh.burstT) / sh.duration, 0, 1);
        const ek = 1 - Math.pow(1 - k, 2); // 水平方向は減速しながら広がる
        const fall = k * k; // 落下は加速するように
        sh.mesh.position.x = lerp(sh.start.x, sh.target.x, ek);
        sh.mesh.position.z = lerp(sh.start.z, sh.target.z, ek);
        const arc = Math.sin(k * Math.PI) * sh.arcH;
        sh.mesh.position.y = lerp(sh.start.y, sh.target.y, fall) + arc;
        sh.mesh.rotation.set(
          sh.rot0.x + sh.spin.x * k,
          sh.rot0.y + sh.spin.y * k,
          sh.rot0.z + sh.spin.z * k
        );
        if (k >= 1) { sh.active = false; sh.landed = true; } // 着地して静止。そのまま残す
      }
    },
  };
}

// =========================================================================
// 花火スパークラー（線香花火風）
// =========================================================================
export function createSparkler(count = 90) {
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
        gl_PointSize = (6.0 + seed*5.0) * (1.0/-mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main(){
        if (vAlpha <= 0.0) discard;
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.68) * 1.3, a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  const light = new THREE.PointLight(0xffd79a, 0, 0.95, 2);
  // 花火の持ち手（細い棒）。先端(発光点=グループ原点)から下へ伸ばし、
  // てっぺんに「立っている」ことが一目でわかるようにする
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xc9a45e, roughness: 0.55, metalness: 0.1 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0035, 0.09, 8), stickMat);
  stick.position.y = -0.043;
  stick.castShadow = true;
  stick.visible = false;
  const group = new THREE.Group();
  group.add(points, light, stick);
  let ignited = false;
  return {
    group, points, light, stick,
    ignite(t) { ignited = true; uniforms.uIgnite.value = t; points.visible = true; stick.visible = true; },
    update(dt, t) {
      uniforms.uTime.value = t;
      if (ignited) light.intensity = 1.1 + Math.abs(Math.sin(t * 24)) * 1.3;
    },
  };
}

// 冷たい冷気ミスト（アイスの周りをふわりと漂う。大きめ・明るめにして視認性を確保）
export function createColdMist(count = 12) {
  const group = new THREE.Group();
  const tex = glowTexture('rgba(232,247,255,0.95)', 'rgba(232,247,255,0)');
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.11);
    group.add(s);
    items.push({ s, phase: Math.random(), r: 0.04 + Math.random() * 0.085 });
  }
  let strength = 0;
  return {
    group,
    setStrength(v) { strength = v; },
    update(dt, t) {
      for (const it of items) {
        it.phase += dt * 0.24;
        const k = it.phase % 1;
        const a = it.phase * 1.7;
        it.s.position.set(Math.sin(a) * it.r, 0.11 - k * 0.15, Math.cos(a) * it.r);
        it.s.scale.setScalar(0.09 + k * 0.18);
        it.s.material.opacity = strength * Math.sin(k * Math.PI) * 0.95;
      }
    },
  };
}
