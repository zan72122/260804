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
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v += a*vnoise(p); p*=2.1; a*=0.5; } return v; }
`;
const HSL2RGB_GLSL = /* glsl */ `
  vec3 hsl2rgb(vec3 c){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y*(rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
  }
`;
// 環境マップ（equirect）のUV変換。three.js組み込みシェーダーと同じ式で、
// 手動反射サンプリングにそのまま使える。
const ENV_GLSL = /* glsl */ `
  vec2 equirectUv(vec3 dir){
    float u = atan(dir.z, dir.x) * 0.15915494 + 0.5;
    float v = asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5;
    return vec2(u, v);
  }
`;

// --- 寸法 ---
export const MOLD_R = 0.085;
export const MOLD_H = 0.09;
export const MOUSSE_R = 0.076;
export const LAYER_H = MOLD_H / 3;
export const GLAZE_R = MOUSSE_R + 0.005;

// 半円柱の角度: 決定論的構成に合わせ、断面は z=0 の垂直面固定
// （halfFront=z>=0側 / halfBack=z<=0側。カメラは常に+Z側から見る）。
// 注意: ジオメトリごとに角度の展開式が異なるため、同じ「前/後」を表すのに異なる
// thetaStartが要る（vendor/three.module.js を実測して確認済み）。
//  - CylinderGeometry: x=r*sin(theta), z=r*cos(theta)
//  - CircleGeometry(→rotateX(-PI/2)で天面に寝かせたもの): 世界z = -r*sin(theta)
export const FRONT_THETA_CYL = -Math.PI / 2;  // cylinder: z∈[0,r]
export const BACK_THETA_CYL = Math.PI / 2;    // cylinder: z∈[-r,0]
export const FRONT_THETA_TOP = -Math.PI;      // circle(天面): z∈[0,r]
export const BACK_THETA_TOP = 0;              // circle(天面): z∈[-r,0]
export const HALF_LEN = Math.PI;

// グレーズの見た目モード
const GLAZE_MODE = { pink: 0, choco: 1, rainbow: 2 };

// hex文字列を明暗調整して rgb() 文字列で返す（断面キャンバスの階調用）
function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => (amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  r = Math.max(0, Math.min(255, Math.round(f(r))));
  g = Math.max(0, Math.min(255, Math.round(f(g))));
  b = Math.max(0, Math.min(255, Math.round(f(b))));
  return `rgb(${r},${g},${b})`;
}

// hex→HSL→(彩度/明度を加算)→rgb() 文字列。断面の縞が実ムース色よりパッと見て
// 濃く分かるように使う（強い正面光でも白飛びしにくい）。
function hexToHsl(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslShade(hex, dS, dL) {
  const [h, s, l] = hexToHsl(hex);
  const s2 = Math.max(0, Math.min(1, s + dS)), l2 = Math.max(0, Math.min(1, l + dL));
  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l2 - c / 2;
  let rr, gg, bb;
  const hp = h * 6;
  if (hp < 1) { rr = c; gg = x; bb = 0; } else if (hp < 2) { rr = x; gg = c; bb = 0; }
  else if (hp < 3) { rr = 0; gg = c; bb = x; } else if (hp < 4) { rr = 0; gg = x; bb = c; }
  else if (hp < 5) { rr = x; gg = 0; bb = c; } else { rr = c; gg = 0; bb = x; }
  const R = Math.round((rr + m) * 255), G = Math.round((gg + m) * 255), B = Math.round((bb + m) * 255);
  return `rgb(${R},${G},${B})`;
}

// =========================================================================
// 透明リング型（屈折感のあるガラス質）
// =========================================================================
export function createMold() {
  const geo = new THREE.CylinderGeometry(MOLD_R, MOLD_R, MOLD_H, 48, 1, true);
  geo.translate(0, MOLD_H / 2, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xf3fbff, roughness: 0.035, metalness: 0,
    transmission: 1.0, thickness: 0.05, ior: 1.42,
    attenuationColor: new THREE.Color(0xdcf3ff), attenuationDistance: 0.1,
    clearcoat: 1.0, clearcoatRoughness: 0.04,
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

// ムース表面のサテンノイズ（微細な粒立ち+ラフネス変化のタイル状テクスチャ）。
// クリーム味の下地に細かい明暗を足すことで「無地の紙のような」平坦さを避ける。
let _mousseNoiseTex = null;
function mousseNoiseTexture() {
  if (_mousseNoiseTex) return _mousseNoiseTex;
  _mousseNoiseTex = canvasTexture(256, (g, s) => {
    g.fillStyle = '#8f8f8f'; g.fillRect(0, 0, s, s); // 中間ラフネス基準値
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 0.5 + Math.random() * 1.8;
      const light = Math.random() < 0.5;
      g.fillStyle = light ? `rgba(255,255,255,${0.05 + Math.random() * 0.14})` : `rgba(30,30,30,${0.04 + Math.random() * 0.1})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, { srgb: false, repeat: 3 });
  return _mousseNoiseTex;
}

// =========================================================================
// ムースの層（半円柱・注ぐたびに丈が伸びる）
// =========================================================================
export function createMousseLayer(thetaStart, index) {
  const geo = new THREE.CylinderGeometry(MOUSSE_R, MOUSSE_R, LAYER_H, 28, 1, true, thetaStart, HALF_LEN);
  geo.translate(0, LAYER_H / 2, 0); // ローカル y: 0(下)〜LAYER_H(上)
  const noiseTex = mousseNoiseTexture();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35,
    roughnessMap: noiseTex, bumpMap: noiseTex, bumpScale: 0.0007,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = index * LAYER_H;
  mesh.scale.y = 0.0001;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  return { mesh, mat, setFill(v) { mesh.scale.y = Math.max(0.0001, v); mesh.visible = v > 0.001; } };
}

// 型抜き後、上端の角が紙のように硬く見えないよう、ごく小さな面取りリングを足す
// （半円柱・厚み最小のテーパー付きバンド。上に向かってわずかに半径を絞る）
export function createEdgeChamfer(thetaStart) {
  const h = 0.006;
  const geo = new THREE.CylinderGeometry(MOUSSE_R * 0.97, MOUSSE_R, h, 28, 1, true, thetaStart, HALF_LEN);
  geo.translate(0, MOLD_H - h / 2, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xf1e6cf, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3,
    transparent: true, opacity: 0.75,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.visible = false;
  return { mesh, mat, setVisible(v) { mesh.visible = v; } };
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
// 霜のきらめきシェル（FREEZE中だけムースの外側をうっすら覆う微細スパークル）
// =========================================================================
export function createFrostShell(thetaStart) {
  const geo = new THREE.CylinderGeometry(MOUSSE_R + 0.0016, MOUSSE_R + 0.0016, MOLD_H, 24, 10, true, thetaStart, HALF_LEN);
  geo.translate(0, MOLD_H / 2, 0);
  const uniforms = { uTime: { value: 0 }, uStrength: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
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
      uniform float uTime, uStrength;
      varying vec2 vUv; varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      void main(){
        if (uStrength < 0.01) discard;
        float sp1 = pow(vnoise(vUv*60.0 + vec2(uTime*0.5, 0.0)), 6.0);
        float sp2 = pow(vnoise(vUv*100.0 - vec2(0.0, uTime*0.7) + 9.0), 7.0);
        float sparkle = clamp(sp1*9.0 + sp2*8.0, 0.0, 1.0);
        float dust = smoothstep(0.25, 0.85, vnoise(vUv*14.0 + 3.0)) * 0.55;
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 1.4);
        float a = (sparkle*1.0 + dust + fres*0.5) * uStrength;
        gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), clamp(a, 0.0, 1.0));
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return {
    mesh, uniforms,
    setStrength(v) { uniforms.uStrength.value = v; mesh.visible = v > 0.01; },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// 断面キャップ（z=0 平面。層縞+フルーツ断面を描いた canvasTexture を貼る板）
// PlaneGeometryは既定でXY平面・法線+Zなので回転不要（幅=X方向=グレーズ径、高さ=Y）。
// 両半分とも同じ向きのまま使う（material.side=DoubleSideなので裏面も描画され、
// かつ開いた際にどちらの面がカメラを向くかは各グループの回転で決まるため、
// ここで片方だけ180度反転させるとテクスチャが鏡像になってしまう）。
// =========================================================================
export function createCapPlane() {
  // 幅はグレーズ殻を含めた実際の断面直径(GLAZE_R*2)に一致させ、切断面へ密着させる
  const geo = new THREE.PlaneGeometry(GLAZE_R * 2, MOLD_H);
  geo.translate(0, MOLD_H / 2, 0);
  // 断面はしっとりしたムースの質感で、グレーズ殻のような強い艶は不要
  // （clearcoatを弱めに留め、強い正面光でも層縞のパステル色が白飛びしないようにする）
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.7, clearcoat: 0.08, clearcoatRoughness: 0.6, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return { mesh, mat };
}

// =========================================================================
// グレーズ殻: 側面（上から下へとろりと覆う。前線に厚みの盛り上がり+鏡面反射）
// =========================================================================
export function createGlazeSide(thetaStart, envMap) {
  const geo = new THREE.CylinderGeometry(GLAZE_R, GLAZE_R, MOLD_H, 28, 40, true, thetaStart, HALF_LEN);
  geo.translate(0, MOLD_H / 2, 0);
  const uniforms = {
    uFlow: { value: 0 }, uTime: { value: 0 }, uMode: { value: 0 }, uMirror: { value: 0 },
    uColorA: { value: new THREE.Color(0xffffff) }, uColorB: { value: new THREE.Color(0xffffff) },
    uEnvMap: { value: envMap || null }, uEnvIntensity: { value: 1.15 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    // FrontSideのみ描画: カスタムシェーダーはgl_FrontFacingで法線反転していないため、
    // DoubleSideのまま裏面(内側の凹面)が見えると常に暗く誤ったシェーディングになる。
    // 開いた際に断面キャップの背後へ回り込んで見えても、単に描画されない方が安全。
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      uniform float uFlow;
      varying vec2 vUv; varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      void main(){
        vUv = uv;
        // 側面の流下前線と同じノイズで、前線位置だけ外側にふくらませる（とろりとした厚み）
        float n = vnoise(vec2(uv.x*11.0+41.0, 0.0))*0.7 + vnoise(vec2(uv.x*27.0+5.0, 3.0))*0.3;
        float dripLen = (0.32 + n*0.68) * uFlow;
        float below = 1.0 - uv.y;
        float d = dripLen - below;
        float bulge = smoothstep(0.0, 0.05, d) * smoothstep(0.17, 0.04, d) * step(0.001, uFlow);
        vec3 p = position + normal * bulge * 0.0058;
        vN = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFlow, uTime, uMode, uMirror, uEnvIntensity;
      uniform vec3 uColorA, uColorB;
      uniform sampler2D uEnvMap;
      varying vec2 vUv; varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      ${HSL2RGB_GLSL}
      ${ENV_GLSL}
      void main(){
        // 角度ごとに不揃いに垂れる（上→下）
        float n = vnoise(vec2(vUv.x*11.0+41.0, 0.0))*0.7 + vnoise(vec2(vUv.x*27.0+5.0, 3.0))*0.3;
        float dripLen = (0.32 + n*0.68) * uFlow;
        float below = 1.0 - vUv.y; // 0=上端 1=下端
        if (below > dripLen) discard;
        float tip = smoothstep(dripLen, dripLen - 0.12, below);
        float ang = atan(vWorld.z, vWorld.x);
        vec3 base;
        if (uMode > 1.5) {
          // rainbow: パステル調で2〜3色相サイクルをやわらかくブレンド（完成時の鏡面トーンに合わせる）
          float hue = fract(ang*0.35 + vWorld.y*0.9 + uTime*0.04);
          vec3 hueCol = hsl2rgb(vec3(hue, 0.45, 0.74));
          float blendN = fbm(vec2(ang*1.1, vWorld.y*4.0 + uTime*0.1));
          base = mix(hueCol, vec3(1.0), 0.12 + blendN*0.1);
        } else if (uMode > 0.5) {
          // choco: 深い艶+わずかな流し筋
          float streak = fbm(vec2(vUv.x*5.0, vUv.y*3.0 - uTime*0.1));
          base = mix(uColorB, uColorA, 0.28 + streak*0.55);
        } else {
          // pink: ノイズで白ピンクのマーブル渦
          float m  = fbm(vec2(vUv.x*10.0, vUv.y*6.0) + 2.0);
          float m2 = fbm(vec2(vUv.x*19.0 - 1.0, vUv.y*11.0 + 3.0));
          base = mix(uColorA, vec3(1.0), smoothstep(0.35, 0.65, m));
          base = mix(base, uColorB, smoothstep(0.6, 0.9, m2) * 0.4);
        }
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        vec3 env = texture2D(uEnvMap, equirectUv(R)).rgb;
        // 反射先が床側の暗い帯(環境マップ下部)を向くと艶面が丸ごと沈むため、
        // 反射色が暗いときはミラー寄与を弱めてベース色寄りに戻す
        float envLum = dot(env, vec3(0.299, 0.587, 0.114));
        float envOk = smoothstep(0.06, 0.32, envLum);
        vec3 L = normalize(vec3(0.5, 0.85, 0.4));
        // 拡散項の下限を引き上げ（回転で主光源から法線が外れても沈みすぎない）
        float dif = 0.62 + 0.38*max(dot(N,L), 0.0);
        vec3 H = normalize(L+V);
        float spec = pow(max(dot(N,H), 0.0), 90.0 + uMirror*150.0);
        float fres = pow(1.0 - max(dot(N,V), 0.0), 2.2);
        vec3 col = base * dif * (1.0 - uMirror*0.4);
        col = mix(col, env * uEnvIntensity, uMirror * (0.55 + fres*0.35) * envOk);
        col += vec3(1.0) * spec * (0.65 + uMirror*0.9);
        col += vec3(1.0) * fres * (0.22 + uMirror*0.3);
        col += base * tip * 0.15;
        // カメラ方向からの固定フィルライト（第2灯）: シーンのpointLightはこの自作
        // ShaderMaterialに効かないため、法線がカメラを向いていれば常に底上げする
        float camFill = max(dot(N, V), 0.0);
        col += base * camFill * camFill * 0.4;
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
    setMode(key) { uniforms.uMode.value = GLAZE_MODE[key] ?? 0; },
    setMirror(v) { uniforms.uMirror.value = v; },
    setEnvMap(tex) { uniforms.uEnvMap.value = tex; },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// グレーズ殻: 天面（前線ハイライト帯+虹の色相流れ+鏡面反射）
export function createGlazeTop(thetaStart, envMap) {
  const geo = new THREE.CircleGeometry(GLAZE_R, 40, thetaStart, HALF_LEN);
  const uniforms = {
    uCoverage: { value: 0 }, uTime: { value: 0 }, uMode: { value: 0 }, uMirror: { value: 0 },
    uColorA: { value: new THREE.Color(0xffffff) }, uColorB: { value: new THREE.Color(0xffffff) },
    uEnvMap: { value: envMap || null }, uEnvIntensity: { value: 1.15 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec2 vUvL; varying vec3 vN, vWorld;
      void main(){
        vUvL = position.xy;
        vN = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCoverage, uTime, uMode, uMirror, uEnvIntensity;
      uniform vec3 uColorA, uColorB;
      uniform sampler2D uEnvMap;
      varying vec2 vUvL; varying vec3 vN, vWorld;
      ${NOISE_GLSL}
      ${HSL2RGB_GLSL}
      ${ENV_GLSL}
      void main(){
        float r = length(vUvL) / ${GLAZE_R.toFixed(6)};
        float a2 = atan(vUvL.y, vUvL.x);
        float edgeN = vnoise(vec2(a2*2.4, 0.0))*0.5 + vnoise(vec2(a2*5.3+7.0, 1.0))*0.5;
        float threshold = uCoverage*1.08 + (edgeN - 0.5)*0.22;
        if (r > threshold) discard;
        // 前線の厚み(ハイライト帯): 塗り広がる縁がぷっくり明るく光る
        float frontGlow = smoothstep(0.07, 0.0, threshold - r) * step(uCoverage, 0.995);
        float ang = atan(vWorld.z, vWorld.x);
        vec3 base;
        if (uMode > 1.5) {
          // rainbow天面: 彩度を抑え2〜3色相サイクル+放射方向にもソフトブレンド
          float hue = fract(ang*0.35 + r*0.5 + uTime*0.04);
          vec3 hueCol = hsl2rgb(vec3(hue, 0.45, 0.76));
          base = mix(vec3(1.0), hueCol, smoothstep(0.0, 0.55, r));
        } else if (uMode > 0.5) {
          float streak = fbm(vec2(r*6.0, ang*1.4 + uTime*0.08));
          base = mix(uColorB, uColorA, 0.32 + streak*0.55);
        } else {
          float m  = fbm(vUvL*46.0 + 4.0);
          float m2 = fbm(vUvL*82.0 - 3.0);
          base = mix(uColorA, vec3(1.0), smoothstep(0.35, 0.65, m));
          base = mix(base, uColorB, smoothstep(0.6, 0.9, m2)*0.4);
        }
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        vec3 env = texture2D(uEnvMap, equirectUv(R)).rgb;
        // 反射先が床側の暗い帯を向くと艶面が丸ごと沈むため、暗い反射のときはミラー寄与を弱める
        float envLum = dot(env, vec3(0.299, 0.587, 0.114));
        float envOk = smoothstep(0.06, 0.32, envLum);
        vec3 L = normalize(vec3(0.5, 0.85, 0.4));
        // 拡散項の下限を引き上げ（回転で主光源から法線が外れても沈みすぎない）
        float dif = 0.65 + 0.35*max(dot(N,L), 0.0);
        vec3 H = normalize(L+V);
        float spec = pow(max(dot(N,H), 0.0), 130.0 + uMirror*160.0);
        float fres = pow(1.0 - max(dot(N,V), 0.0), 2.5);
        vec3 col = base * dif * (1.0 - uMirror*0.45);
        col = mix(col, env * uEnvIntensity, uMirror * (0.55 + fres*0.35) * envOk);
        col += vec3(1.0) * spec * (0.55 + uMirror*0.9);
        col += vec3(1.0) * frontGlow * 0.55;
        // カメラ方向からの固定フィルライト（第2灯）
        float camFill = max(dot(N, V), 0.0);
        col += base * camFill * camFill * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = MOLD_H + 0.0008;
  mesh.visible = false;
  mesh.receiveShadow = true;
  return {
    mesh, uniforms,
    setCoverage(v) { uniforms.uCoverage.value = v; mesh.visible = v > 0.01; },
    setColors(a, b) { uniforms.uColorA.value.set(a); uniforms.uColorB.value.set(b); },
    setMode(key) { uniforms.uMode.value = GLAZE_MODE[key] ?? 0; },
    setMirror(v) { uniforms.uMirror.value = v; },
    setEnvMap(tex) { uniforms.uEnvMap.value = tex; },
    update(dt, t) { uniforms.uTime.value = t; },
  };
}

// =========================================================================
// ナイフ（金属反射）
// =========================================================================
export function createKnife() {
  const group = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xeef0f4, metalness: 0.95, roughness: 0.1 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.15, MOUSSE_R * 2.3), bladeMat);
  blade.position.y = -0.075;
  blade.castShadow = true;
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd6604a, roughness: 0.55 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 12), handleMat);
  handle.position.y = 0.037;
  handle.castShadow = true;
  group.add(blade, handle);
  return { group, bladeMat };
}

// =========================================================================
// 冷気パーティクル（青い霜のきらめき）
// =========================================================================
export function createFrostParticles(count = 34) {
  const group = new THREE.Group();
  const tex = glowTexture('rgba(210,240,255,0.98)', 'rgba(210,240,255,0)');
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
        it.s.scale.setScalar(0.007 + k * 0.024);
        it.s.material.opacity = strength * Math.sin(k * Math.PI) * 0.95;
      }
    },
  };
}

// =========================================================================
// 接触影（型・ケーキの直下に柔らかい暗部）
// =========================================================================
export function createContactShadow(radius) {
  const tex = canvasTexture(128, (g, s) => {
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, 'rgba(30,20,15,0.55)');
    rg.addColorStop(0.6, 'rgba(30,20,15,0.28)');
    rg.addColorStop(1, 'rgba(30,20,15,0)');
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
  }, { srgb: false });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.0004;
  mesh.renderOrder = -1;
  return { mesh };
}

// =========================================================================
// 天面の飾り（金の粒・お花・ハート）
// =========================================================================
export function createGoldBit() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8c15a, metalness: 1.0, roughness: 0.2 });
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
  const petalMat = new THREE.MeshPhysicalMaterial({ color: 0xffb8d6, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4, side: THREE.DoubleSide });
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
    new THREE.MeshStandardMaterial({ color: 0xffd75e, roughness: 0.4, metalness: 0.15 })
  );
  center.position.y = 0.007;
  group.add(center);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.userData.height = 0.014;
  return group;
}

// フルーツ断面キャンバス描画: しっとりムース質感(微細ノイズ・気泡)+層縞+艶のあるフルーツ断面
// 戻り値は { map, roughMap }（roughMapでフルーツ部分だけ艶を上げる）
export function paintCapCanvas(layerColors, fruits) {
  const S = 512;
  const draw = (g, s) => {
    g.fillStyle = '#fff7fa'; g.fillRect(0, 0, s, s);
    const lh = s / 3;
    for (let i = 0; i < layerColors.length; i++) {
      const c = layerColors[i] || '#ffffff';
      const y0 = s - (i + 1) * lh;
      // 強い正面照明でも縞が白飛びしないよう、実ムース色よりHSLで彩度+0.15/明度-0.1濃く
      const grad = g.createLinearGradient(0, y0, 0, y0 + lh);
      grad.addColorStop(0, hslShade(c, 0.15, -0.06));
      grad.addColorStop(0.55, hslShade(c, 0.15, -0.10));
      grad.addColorStop(1, hslShade(c, 0.15, -0.16));
      g.fillStyle = grad;
      g.fillRect(0, y0, s, lh + 1);
      // しっとりした微細ノイズ+気泡（ムースの質感）
      for (let k = 0; k < 340; k++) {
        const px = Math.random() * s, py = y0 + Math.random() * lh;
        const r = 0.5 + Math.random() * 2.2;
        g.fillStyle = Math.random() < 0.55 ? `rgba(255,255,255,${0.05 + Math.random() * 0.16})` : `rgba(40,20,20,${0.03 + Math.random() * 0.07})`;
        g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
      }
    }
    // 層の境目にくっきり線
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, s - i * lh); g.lineTo(s, s - i * lh); g.stroke(); }
    g.strokeStyle = 'rgba(120,90,70,0.12)'; g.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, s - i * lh + 2); g.lineTo(s, s - i * lh + 2); g.stroke(); }
    // フルーツの断面（艶あり: ハイライト+輪郭）
    const FRUIT_COLOR = { strawberry: '#e8354d', blueberry: '#4a5fb0', orange: '#ffa53d' };
    for (const f of fruits) {
      const px = f.u * s, py = (1 - f.v) * s, r = s * 0.11;
      g.save();
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.clip();
      const fc = FRUIT_COLOR[f.kind] || '#e8354d';
      // 断面がほぼ点に見えないよう、ひと回り大きく+彩度濃いめのグラデーションにする
      const rg = g.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r * 1.15);
      rg.addColorStop(0, shade(fc, 0.22));
      rg.addColorStop(0.55, shade(fc, -0.05));
      rg.addColorStop(1, shade(fc, -0.38));
      g.fillStyle = rg;
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
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.beginPath(); g.arc(px - r * 0.2, py - r * 0.2, r * 0.35, 0, 7); g.fill();
      }
      // 艶ハイライト（つやのあるフルーツ断面）
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(px - r * 0.35, py - r * 0.4, r * 0.28, r * 0.16, -0.5, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
    }
  };
  const map = canvasTexture(S, draw);
  const roughMap = canvasTexture(S, (g, s) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); // ムース部: 中程度のラフネス
    for (const f of fruits) {
      const px = f.u * s, py = (1 - f.v) * s, r = s * 0.11;
      g.fillStyle = '#303030'; // フルーツ部: 低ラフネス=艶
      g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
    }
  }, { srgb: false });
  return { map, roughMap };
}
