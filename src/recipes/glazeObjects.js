// かがみのケーキ 専用メッシュ/シェーダー工場
// cake.js のノイズ手法・作り方を踏襲しつつ、レシピ固有の形状（透明型・半円柱ムース・
// グレーズ殻・ナイフ・冷気パーティクル・トップ飾り）をここにまとめる。
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture, glowTexture } from '../util.js';

// 共通GLSLノイズ（cake.js と同等の簡易版をこのファイル内で完結させる）
const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
`;
const HSL2RGB_GLSL = /* glsl */ `
  vec3 hsl2rgb(vec3 c){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y*(rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
  }
`;

// --- 寸法 ---
export const MOLD_R = 0.085;
export const MOLD_H = 0.09;
export const MOUSSE_R = 0.076;
export const LAYER_H = MOLD_H / 3;
export const GLAZE_R = MOUSSE_R + 0.005;

// 半円柱の角度（右半分=x>=0 / 左半分=x<=0）。断面は常に x=0 の平面。
export const RIGHT_THETA = -Math.PI / 2;
export const LEFT_THETA = Math.PI / 2;
export const HALF_LEN = Math.PI;

// =========================================================================
// 透明リング型
// =========================================================================
export function createMold() {
  const geo = new THREE.CylinderGeometry(MOLD_R, MOLD_R, MOLD_H, 48, 1, true);
  geo.translate(0, MOLD_H / 2, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf7ff, roughness: 0.05, metalness: 0,
    transmission: 1.0, thickness: 0.02, ior: 1.3,
    clearcoat: 1.0, clearcoatRoughness: 0.05,
    transparent: true, opacity: 1, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // ふちに薄い金ライン（高級感）
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(MOLD_R, 0.0015, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0xe8bd6a, metalness: 0.85, roughness: 0.3 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.0005;
  const group = new THREE.Group();
  group.add(mesh, rim);
  return { group, mesh, mat };
}

// =========================================================================
// ムースの層（半円柱・注ぐたびに丈が伸びる）
// =========================================================================
export function createMousseLayer(thetaStart, index) {
  const geo = new THREE.CylinderGeometry(MOUSSE_R, MOUSSE_R, LAYER_H, 28, 1, true, thetaStart, HALF_LEN);
  geo.translate(0, LAYER_H / 2, 0); // ローカル y: 0(下)〜LAYER_H(上)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = index * LAYER_H;
  mesh.scale.y = 0.0001;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  return { mesh, mat, setFill(v) { mesh.scale.y = Math.max(0.0001, v); mesh.visible = v > 0.001; } };
}

// 現在そそいでいる層の液面（半円板）
export function createPourSurface(thetaStart) {
  const geo = new THREE.CircleGeometry(MOUSSE_R, 28, thetaStart, HALF_LEN);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffb3c6, roughness: 0.3, clearcoat: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return { mesh, mat };
}

// =========================================================================
// 断面キャップ（x=0 平面。層縞+フルーツ断面を描いた canvasTexture を貼る板）
// =========================================================================
export function createCapPlane() {
  const geo = new THREE.PlaneGeometry(MOUSSE_R * 2, MOLD_H);
  geo.rotateY(Math.PI / 2);
  geo.translate(0, MOLD_H / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return { mesh, mat };
}

// =========================================================================
// グレーズ殻: 側面（上から下へとろりと覆うドリップ・シェーダー）
// =========================================================================
export function createGlazeSide(thetaStart) {
  const geo = new THREE.CylinderGeometry(GLAZE_R, GLAZE_R, MOLD_H, 28, 1, true, thetaStart, HALF_LEN);
  geo.translate(0, MOLD_H / 2, 0);
  const uniforms = {
    uFlow: { value: 0 }, uTime: { value: 0 }, uRainbow: { value: 0 }, uMirror: { value: 0 },
    uColorA: { value: new THREE.Color(0xffffff) }, uColorB: { value: new THREE.Color(0xffffff) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN, vWorld;
      void main(){
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFlow, uTime, uRainbow, uMirror;
      uniform vec3 uColorA, uColorB;
      varying vec2 vUv; varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      ${HSL2RGB_GLSL}
      void main(){
        // 角度ごとに不揃いに垂れる（上→下）
        float n = vnoise(vec2(vUv.x*11.0+41.0, 0.0))*0.7 + vnoise(vec2(vUv.x*27.0+5.0, 3.0))*0.3;
        float dripLen = (0.32 + n*0.68) * uFlow;
        float below = 1.0 - vUv.y; // 0=上端 1=下端
        if (below > dripLen) discard;
        float tip = smoothstep(dripLen, dripLen - 0.10, below);
        vec3 base;
        if (uRainbow > 0.5) {
          float hue = fract(vUv.x*1.35 + vWorld.y*1.6 + uTime*0.05);
          base = hsl2rgb(vec3(hue, 0.72, 0.62));
        } else {
          base = mix(uColorB, uColorA, tip);
        }
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = normalize(vec3(0.5, 0.85, 0.4));
        float dif = 0.55 + 0.45*max(dot(N,L), 0.0);
        vec3 H = normalize(L+V);
        float spec = pow(max(dot(N,H), 0.0), 90.0 + uMirror*120.0);
        float fres = pow(1.0 - max(dot(N,V), 0.0), 2.2);
        vec3 col = base*dif + vec3(1.0)*spec*(0.7+uMirror*0.8) + vec3(1.0)*fres*(0.25+uMirror*0.4);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.castShadow = true;
  return {
    mesh, uniforms,
    setFlow(v) { uniforms.uFlow.value = v; mesh.visible = v > 0.01; },
    setColors(a, b) { uniforms.uColorA.value.set(a); uniforms.uColorB.value.set(b); },
    setRainbow(on) { uniforms.uRainbow.value = on ? 1 : 0; },
    setMirror(v) { uniforms.uMirror.value = v; },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// グレーズ殻: 天面（実マテリアルなので scene.environment を自動反射=本物の鏡面に）
export function createGlazeTop(thetaStart) {
  const geo = new THREE.CircleGeometry(GLAZE_R, 28, thetaStart, HALF_LEN);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.32, clearcoat: 1.0, clearcoatRoughness: 0.15, metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = MOLD_H + 0.0008;
  mesh.visible = false;
  mesh.receiveShadow = true;
  return {
    mesh, mat,
    setCoverage(v) { mesh.visible = v > 0.01; mesh.scale.setScalar(Math.max(0.001, Math.min(1, v * 1.6))); },
    setColor(hex) { mat.color.set(hex); },
    setMirror(v) { mat.roughness = 0.32 - v * 0.28; },
  };
}

// =========================================================================
// ナイフ
// =========================================================================
export function createKnife() {
  const group = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe4e6ec, metalness: 0.9, roughness: 0.18 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.15, MOUSSE_R * 2.3), bladeMat);
  blade.position.y = -0.075;
  blade.castShadow = true;
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd6604a, roughness: 0.55 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 12), handleMat);
  handle.position.y = 0.037;
  handle.castShadow = true;
  group.add(blade, handle);
  return { group };
}

// =========================================================================
// 冷気パーティクル（青い霜のきらめき）
// =========================================================================
export function createFrostParticles(count = 26) {
  const group = new THREE.Group();
  const tex = glowTexture('rgba(200,235,255,0.95)', 'rgba(200,235,255,0)');
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.012);
    group.add(s);
    items.push({ s, a: Math.random() * Math.PI * 2, r: 0.03 + Math.random() * 0.09, phase: Math.random(), speed: 0.4 + Math.random() * 0.5 });
  }
  let strength = 0;
  return {
    group,
    setStrength(v) { strength = v; },
    update(dt, t) {
      for (const it of items) {
        it.phase += dt * it.speed;
        const k = it.phase % 1;
        const a = it.a + t * 0.6;
        it.s.position.set(Math.cos(a) * it.r, k * 0.13, Math.sin(a) * it.r);
        it.s.scale.setScalar(0.006 + k * 0.02);
        it.s.material.opacity = strength * Math.sin(k * Math.PI) * 0.85;
      }
    },
  };
}

// =========================================================================
// 天面の飾り（金の粒・お花・ハート）
// =========================================================================
export function createGoldBit() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8c15a, metalness: 1.0, roughness: 0.25 });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.005, 0), mat);
    const a = (i / 3) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.006, 0.005, Math.sin(a) * 0.006);
    group.add(s);
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.userData.height = 0.012;
  return group;
}

export function createFlowerDeco() {
  const group = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xffb8d6, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), petalMat);
    petal.scale.set(1, 0.45, 1.8);
    const a = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.009, 0.006, Math.sin(a) * 0.009);
    petal.rotation.y = -a;
    group.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.0045, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd75e, roughness: 0.5 })
  );
  center.position.y = 0.007;
  group.add(center);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.userData.height = 0.014;
  return group;
}

// フルーツ断面キャンバス描画: 層の色縞＋沈めたフルーツの断面円
export function paintCapCanvas(layerColors, fruits) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#fff7fa'; g.fillRect(0, 0, s, s);
    // 3層の縞（下から上へ）
    const n = layerColors.length || 1;
    for (let i = 0; i < layerColors.length; i++) {
      g.fillStyle = layerColors[i] || '#ffffff';
      const y0 = s - (i + 1) * (s / 3);
      g.fillRect(0, y0, s, s / 3 + 1);
    }
    // 層の境目にうっすら線
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, s - i * (s / 3)); g.lineTo(s, s - i * (s / 3)); g.stroke(); }
    // フルーツの断面
    const FRUIT_COLOR = { strawberry: '#e8354d', blueberry: '#4a5fb0', orange: '#ffa53d' };
    for (const f of fruits) {
      const px = f.u * s, py = (1 - f.v) * s, r = s * 0.075;
      g.save();
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.clip();
      g.fillStyle = FRUIT_COLOR[f.kind] || '#e8354d';
      g.fillRect(px - r, py - r, r * 2, r * 2);
      if (f.kind === 'strawberry') {
        g.fillStyle = 'rgba(255,230,180,0.9)';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          g.beginPath(); g.arc(px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.55, r * 0.09, 0, 7); g.fill();
        }
      } else if (f.kind === 'orange') {
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = r * 0.14;
        for (let i = 0; i < 6; i++) {
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos((i / 6) * Math.PI * 2) * r, py + Math.sin((i / 6) * Math.PI * 2) * r); g.stroke();
        }
      } else {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.arc(px - r * 0.2, py - r * 0.2, r * 0.35, 0, 7); g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
    }
  });
}
