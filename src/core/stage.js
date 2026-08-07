import * as THREE from 'three';
import { PALETTE, QUALITY, WALK } from './config.js';
import { damp } from './util.js';

// ---------------------------------------------------------------------------
// 描画の土台。透視投影カメラ、太陽光、空気遠近のための霧、影。
// 縦画面と横画面で画角と構図を切り替える。
// ---------------------------------------------------------------------------

const QUALITY_LEVELS = [
  // 一番軽い。古い端末や、電池が減ってきたときのため。
  { dpr: 1.0, shadows: false, shafts: false, dust: false },
  { dpr: 1.35, shadows: false, shafts: true, dust: true },
  { dpr: 1.7, shadows: true, shafts: true, dust: true },
  { dpr: 2.0, shadows: true, shafts: true, dust: true },
];

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(PALETTE.interiorHaze);

    this.scene = new THREE.Scene();
    // 空気遠近。奥へ行くほど埃っぽい空気の色に沈む。
    this.scene.fog = new THREE.FogExp2(PALETTE.interiorHaze, 0.0165);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.08, 320);
    this.camera.position.set(-4.6, 1.85, 3.1);

    // カメラは目標を追いかける。急に飛ばない。
    this.camPos = this.camera.position.clone();
    this.camTarget = new THREE.Vector3(1.5, 1.0, 0);
    this.desired = {
      pos: this.camPos.clone(),
      target: this.camTarget.clone(),
      fov: 40,
      lambda: 2.2,
    };

    this._buildLights();

    // 描画の重さを見て、勝手に軽くする。落ちるより、少し粗いほうがいい。
    const forced = new URLSearchParams(location.search).get('q');
    this.level = forced === 'low' ? 0 : forced === 'mid' ? 1 : forced === 'high' ? 3 : 3;
    this.autoTune = forced === null;
    this._frameAcc = 0;
    this._frameCount = 0;
    this._settle = 1.5;
    this.onQuality = null;

    this.portrait = false;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResize);
    this.resize();
    this.applyQuality();
  }

  applyQuality() {
    const q = QUALITY_LEVELS[this.level];
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.sun.castShadow = q.shadows;
    this.resize();
    this.onQuality?.(this.level, q);
  }

  _tune(dt) {
    if (!this.autoTune) return;
    this._settle -= dt;
    if (this._settle > 0) return;
    this._frameAcc += dt;
    this._frameCount++;
    if (this._frameAcc < 1.5) return;
    const avg = this._frameAcc / this._frameCount;
    this._frameAcc = 0;
    this._frameCount = 0;
    if (avg > 0.032 && this.level > 0) {
      this.level--;
      this._settle = 2.5;
      this.applyQuality();
    } else if (avg < 0.019 && this.level < QUALITY_LEVELS.length - 1) {
      this.level++;
      this._settle = 4;
      this.applyQuality();
    }
  }

  _buildLights() {
    const s = this.scene;

    // 空と地面の照り返し
    const hemi = new THREE.HemisphereLight(0xc6dcea, PALETTE.bounce, 1.35);
    s.add(hemi);
    this.hemi = hemi;

    // 屋根裏が真っ黒にならないよう、ごく弱い環境光を足す
    s.add(new THREE.AmbientLight(0xb59b78, 0.55));

    // 側面の開口から差し込む陽。長い影が作業場を横切る。
    const sun = new THREE.DirectionalLight(PALETTE.sun, 2.35);
    sun.position.set(-6, 7.5, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 42;
    const half = 9;
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.022;
    s.add(sun);
    s.add(sun.target);
    this.sun = sun;

    // 手前を起こすための、弱い補助光（逆光に負けないように）
    const fill = new THREE.DirectionalLight(0xffd9a8, 0.42);
    fill.position.set(4, 3.2, -7);
    s.add(fill);

    // 奥の戸口から抜けてくる明るさ
    const far = new THREE.PointLight(0xffe9c4, 12, 26, 2);
    far.position.set(WALK.x0 + WALK.span + 8, 2.0, 0);
    s.add(far);
    this.farGlow = far;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.portrait = h > w;
    const cap = QUALITY_LEVELS[this.level ?? 3].dpr;
    const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio, cap);
    this.pixelRatio = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 目標の構図を指示する。実際のカメラはここへ滑らかに寄っていく。 */
  frame(pos, target, { fov, lambda = 2.2, snap = false } = {}) {
    this.desired.pos.copy(pos);
    this.desired.target.copy(target);
    if (fov !== undefined) this.desired.fov = fov;
    this.desired.lambda = lambda;
    if (snap) {
      this.camPos.copy(pos);
      this.camTarget.copy(target);
      this.camera.fov = this.desired.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  update(dt) {
    this._tune(dt);
    const l = this.desired.lambda;
    this.camPos.x = damp(this.camPos.x, this.desired.pos.x, l, dt);
    this.camPos.y = damp(this.camPos.y, this.desired.pos.y, l, dt);
    this.camPos.z = damp(this.camPos.z, this.desired.pos.z, l, dt);
    this.camTarget.x = damp(this.camTarget.x, this.desired.target.x, l, dt);
    this.camTarget.y = damp(this.camTarget.y, this.desired.target.y, l, dt);
    this.camTarget.z = damp(this.camTarget.z, this.desired.target.z, l, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    const fov = damp(this.camera.fov, this.desired.fov, l, dt);
    if (Math.abs(fov - this.camera.fov) > 0.002) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // 影の箱をカメラの前へ寄せる。長い作業場ぜんぶは覆えない。
    const fx = this.camPos.x + 4.5;
    this.sun.position.set(fx - 6, 7.5, 11);
    this.sun.target.position.set(fx, 0.6, 0);
    this.sun.target.updateMatrixWorld();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** ワールド座標を CSS ピクセルへ。UI のヒント位置合わせに使う。 */
  project(v3, out = { x: 0, y: 0, visible: true }) {
    const p = v3.clone().project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.width;
    out.y = (-p.y * 0.5 + 0.5) * this.height;
    out.visible = p.z < 1;
    return out;
  }
}
