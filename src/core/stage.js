/**
 * 描画ステージ。
 * HDR のオフスクリーンに本描画 → ブルーム抽出 → 分離ガウシアン →
 * 合成（水のゆらぎ・色被り・周辺減光・ACES トーンマップ）という並びで、
 * 「常軌を逸するほど綺麗」を安いコストで狙う。
 */
import * as THREE from 'three';
import { clamp } from './util.js';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** 画面いっぱいの三角形。フルスクリーン矩形より 1 パス分だけ安い。 */
function fullscreenGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return g;
}

/** NaN と Inf を潰す。1 ピクセルの異常値がブルームで画面全体に広がるのを防ぐ。 */
const SANITIZE_GLSL = /* glsl */ `
  vec3 sanitize(vec3 c) {
    c.x = (c.x == c.x) ? c.x : 0.0;
    c.y = (c.y == c.y) ? c.y : 0.0;
    c.z = (c.z == c.z) ? c.z : 0.0;
    return min(c, vec3(48.0));
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  ${SANITIZE_GLSL}
  void main() {
    vec3 c = sanitize(texture2D(tDiffuse, vUv).rgb);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(uThreshold, uThreshold + uKnee, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;   // テクセル単位のぼかし方向
  varying vec2 vUv;
  void main() {
    // 9 タップのガウシアン（線形サンプリングで 5 フェッチに畳んである）
    vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
    vec2 o1 = uDirection * 1.3846153846;
    vec2 o2 = uDirection * 3.2307692308;
    sum += texture2D(tDiffuse, vUv + o1) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv - o1) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv + o2) * 0.0702702703;
    sum += texture2D(tDiffuse, vUv - o2) * 0.0702702703;
    gl_FragColor = sum;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uTime;
  uniform float uBloom;
  uniform float uExposure;
  uniform float uWobble;      // 水ごしのゆらぎ量
  uniform float uVignette;
  uniform float uCaustics;    // 画面全体にうっすら乗る光の網
  uniform vec3  uTint;
  uniform vec2  uResolution;
  varying vec2 vUv;

  vec3 sanitize(vec3 c) {
    c.x = (c.x == c.x) ? c.x : 0.0;
    c.y = (c.y == c.y) ? c.y : 0.0;
    c.z = (c.z == c.z) ? c.z : 0.0;
    return min(c, vec3(48.0));
  }

  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    // 水面ごしに覗いているような、ごく僅かな屈折ゆらぎ。
    float w1 = sin(uv.y * 21.0 + uTime * 1.15) + sin(uv.y * 8.3 - uTime * 0.72);
    float w2 = cos(uv.x * 17.0 - uTime * 0.95) + cos(uv.x * 6.1 + uTime * 0.51);
    uv += vec2(w1, w2) * 0.00085 * uWobble;

    vec3 base = sanitize(texture2D(tScene, uv).rgb);
    vec3 bloom = sanitize(texture2D(tBloom, uv).rgb);
    vec3 col = base + bloom * uBloom;

    // 光の網。水面の揺らぎが空気中まで滲んでいる感じ。
    float cg = sin(uv.x * 26.0 + uTime * 0.9) * sin(uv.y * 22.0 - uTime * 0.7);
    col += max(cg, 0.0) * uCaustics * vec3(0.35, 0.75, 0.9);

    // 暗部をわずかに青へ寄せて、水中らしい色被りを作る。
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col * uTint, col, smoothstep(0.0, 0.55, lum));

    // 水中はどうしても眠くなるので、彩度とコントラストを少し起こす。
    col = mix(vec3(lum), col, 1.28);
    col = max(col, vec3(0.0));
    col = pow(col, vec3(1.06));

    float v = 1.0 - smoothstep(0.30, 1.12, length((vUv - 0.5) * vec2(1.0, 1.05)));
    col *= mix(1.0 - uVignette, 1.0, v);

    col = aces(col * uExposure);

    // ごく薄いフィルムグレイン。のっぺりを防ぐ。
    col += (hash(vUv * uResolution + fract(uTime)) - 0.5) * 0.010;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <colorspace_fragment>
  }
`;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));
    this.isMobile = isMobile;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,          // ポストのオフスクリーン側で MSAA を効かせる
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // 合成パスで ACES をかける
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x02090f, 1);

    this.maxPixelRatio = isMobile ? 2 : 2;
    this.resolutionScale = 1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    const samples = isMobile ? 2 : 4;
    const rtOpts = {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      samples,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.sceneRT.texture.minFilter = THREE.LinearFilter;
    this.sceneRT.texture.magFilter = THREE.LinearFilter;

    const halfOpts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    this.brightRT = new THREE.WebGLRenderTarget(1, 1, halfOpts);
    this.blurA = new THREE.WebGLRenderTarget(1, 1, halfOpts);
    this.blurB = new THREE.WebGLRenderTarget(1, 1, halfOpts);
    for (const rt of [this.brightRT, this.blurA, this.blurB]) {
      rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    const geo = fullscreenGeometry();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.sceneRT.texture },
        uThreshold: { value: 1.05 },
        uKnee: { value: 0.65 },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false, depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDirection: { value: new THREE.Vector2() } },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false, depthWrite: false,
    });
    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tBloom: { value: this.blurA.texture },
        uTime: { value: 0 },
        uBloom: { value: 0.40 },
        uExposure: { value: 1.0 },
        uWobble: { value: 1 },
        uVignette: { value: 0.46 },
        uCaustics: { value: 0.010 },
        uTint: { value: new THREE.Color(0.66, 0.90, 1.14) },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false, depthWrite: false,
    });

    this.brightQuad = new THREE.Mesh(geo, this.brightMat);
    this.blurQuad = new THREE.Mesh(geo, this.blurMat);
    this.compositeQuad = new THREE.Mesh(geo, this.compositeMat);
    for (const q of [this.brightQuad, this.blurQuad, this.compositeQuad]) q.frustumCulled = false;

    this.quadScene = new THREE.Scene();

    this.size = new THREE.Vector2(1, 1);
    // 端末が重いときだけ静かに解像度を落とす（見た目は保ち、コマ落ちを防ぐ）
    this._frameTimes = [];
    this._lastAdapt = 0;
  }

  setSize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) * this.resolutionScale;
    this.size.set(width, height);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    const w = Math.max(2, Math.floor(width * dpr));
    const h = Math.max(2, Math.floor(height * dpr));
    this.sceneRT.setSize(w, h);
    const bw = Math.max(2, Math.floor(w / 2));
    const bh = Math.max(2, Math.floor(h / 2));
    this.brightRT.setSize(bw, bh);
    this.blurA.setSize(bw, bh);
    this.blurB.setSize(bw, bh);
    this.compositeMat.uniforms.uResolution.value.set(w, h);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** 実測フレーム時間から解像度スケールを段階的に調整する。 */
  adapt(dt, now) {
    this._frameTimes.push(dt);
    if (this._frameTimes.length > 60) this._frameTimes.shift();
    if (now - this._lastAdapt < 2.5 || this._frameTimes.length < 60) return;
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    let next = this.resolutionScale;
    if (avg > 1 / 34) next = clamp(this.resolutionScale - 0.15, 0.6, 1);
    else if (avg < 1 / 55) next = clamp(this.resolutionScale + 0.1, 0.6, 1);
    if (Math.abs(next - this.resolutionScale) > 0.01) {
      this.resolutionScale = next;
      this.setSize(this.size.x, this.size.y);
    }
    this._lastAdapt = now;
    this._frameTimes.length = 0;
  }

  render(time) {
    const r = this.renderer;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.scene, this.camera);

    // 明部抽出
    this.quadScene.clear();
    this._draw(this.brightQuad, this.brightRT);

    // 横 → 縦 を 2 周。半解像度なので安い。
    const bw = this.brightRT.width, bh = this.brightRT.height;
    let src = this.brightRT;
    for (let i = 0; i < 2; i++) {
      const spread = 1 + i * 1.6;
      this.blurMat.uniforms.tDiffuse.value = src.texture;
      this.blurMat.uniforms.uDirection.value.set(spread / bw, 0);
      this._draw(this.blurQuad, this.blurB);
      this.blurMat.uniforms.tDiffuse.value = this.blurB.texture;
      this.blurMat.uniforms.uDirection.value.set(0, spread / bh);
      this._draw(this.blurQuad, this.blurA);
      src = this.blurA;
    }

    this.compositeMat.uniforms.uTime.value = time;
    r.setRenderTarget(null);
    this._draw(this.compositeQuad, null);
  }

  _draw(quad, target) {
    this.quadScene.children.length = 0;
    this.quadScene.add(quad);
    this.renderer.setRenderTarget(target);
    if (target) this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
