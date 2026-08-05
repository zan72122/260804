// レンダラ・カメラ・照明・向き（縦/横）対応のカメラフレーミング。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, damp, lerp, tween, easeInOutCubic } from './util.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    const bg = new THREE.Color('#f3e2c7');
    this.scene.background = bg;
    // 空気遠近：奥へ行くほど白っぽく霞ませる
    this.scene.fog = new THREE.Fog('#f6e7cf', 4.2, 16);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
    this.camera.position.set(0, 1.5, 2.2);

    this._setupLights();
    this._setupEnv();

    // フレーミング状態
    this.focusTarget = new THREE.Vector3(0, 0.1, 0);
    this.focusRadius = 0.8;
    this.yaw = -0.2;
    this.pitch = 0.62;
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._shake = 0;
    this._sway = new THREE.Vector2();
    this._swayTarget = new THREE.Vector2();
    this.portrait = false;

    this.raycaster = new THREE.Raycaster();
    this.resize();
    this._applyFocus(true);
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight('#fff4e0', '#6b4a2c', 0.40);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#fff0d2', 1.45);
    key.position.set(2.6, 4.2, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    const s = 2.6;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 3;
    this.scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight('#cfe4ff', 0.32);
    fill.position.set(-3, 2.2, 1.4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight('#ffd9a0', 0.42);
    rim.position.set(-1.2, 1.6, -3.2);
    this.scene.add(rim);
  }

  _setupEnv() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = env.texture;
    pmrem.dispose();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.portrait = h >= w;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.portrait ? 2 : 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = this.portrait ? 44 : 36;
    this.camera.updateProjectionMatrix();
    this._applyFocus(true);
  }

  /**
   * 注目させたい球（中心 + 半径）が画面に収まるようカメラを置く。
   * 縦画面では寄って一工程を大きく、横画面では引いて作業台全体を見せる。
   */
  focus(center, radius, opts = {}) {
    this.focusTarget.copy(center);
    this.focusRadius = radius;
    this.yawBase = opts.yaw ?? this.yawBase ?? -0.18;
    this.pitchBase = opts.pitch ?? this.pitchBase ?? 0.6;
    this.margin = opts.margin ?? 1.0;
    this._applyFocus(false);
  }

  _applyFocus(instant) {
    const portrait = this.portrait;
    const yaw = (this.yawBase ?? -0.18) + (portrait ? -0.16 : 0.0);
    const pitch = (this.pitchBase ?? 0.6) + (portrait ? 0.1 : -0.02);
    // 横画面は文脈を広く見せる、縦画面は寄る
    const r = this.focusRadius * (portrait ? 1.02 : 1.32) * (this.margin ?? 1);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = Math.max(r / Math.tan(vFov / 2), r / Math.tan(hFov / 2)) + 0.15;
    this._camLook.copy(this.focusTarget);
    this._camPos.set(
      this.focusTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      this.focusTarget.y + Math.sin(pitch) * dist,
      this.focusTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    if (instant) {
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camLook);
      this._look = this._camLook.clone();
    }
  }

  punch(amount = 0.02) {
    this._shake = Math.min(0.07, this._shake + amount);
  }

  setSway(nx, ny) {
    this._swayTarget.set(clamp(nx, -1, 1) * 0.035, clamp(ny, -1, 1) * 0.025);
  }

  update(dt) {
    this._applyFocus(false);
    this._sway.x = damp(this._sway.x, this._swayTarget.x, 4, dt);
    this._sway.y = damp(this._sway.y, this._swayTarget.y, 4, dt);
    const p = this._camPos.clone();
    p.x += this._sway.x;
    p.y += this._sway.y;
    if (this._shake > 0.0005) {
      p.x += (Math.random() - 0.5) * this._shake;
      p.y += (Math.random() - 0.5) * this._shake;
      this._shake = damp(this._shake, 0, 9, dt);
    }
    const lam = 6;
    this.camera.position.x = damp(this.camera.position.x, p.x, lam, dt);
    this.camera.position.y = damp(this.camera.position.y, p.y, lam, dt);
    this.camera.position.z = damp(this.camera.position.z, p.z, lam, dt);
    if (!this._look) this._look = this._camLook.clone();
    this._look.x = damp(this._look.x, this._camLook.x, lam, dt);
    this._look.y = damp(this._look.y, this._camLook.y, lam, dt);
    this._look.z = damp(this._look.z, this._camLook.z, lam, dt);
    this.camera.lookAt(this._look);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** 見本カードやプロジェクト選択用のサムネイルを描き出す */
  renderThumbnail(object3d, size = 320, options = {}) {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      colorSpace: THREE.SRGBColorSpace,
      samples: 4,
    });
    const scene = new THREE.Scene();
    scene.background = null;
    scene.environment = this.scene.environment;
    const hemi = new THREE.HemisphereLight('#ffffff', '#8a6a48', 0.7);
    const dir = new THREE.DirectionalLight('#fff3dd', 1.5);
    dir.position.set(2, 3.4, 2.6);
    scene.add(hemi, dir);
    scene.add(object3d);

    const box = new THREE.Box3().setFromObject(object3d);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.12, box.getBoundingSphere(new THREE.Sphere()).radius);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 40);
    const yaw = options.yaw ?? 0.7, pitch = options.pitch ?? 0.42;
    const d = (r / Math.tan(THREE.MathUtils.degToRad(35) / 2)) * 1.08;
    cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
    cam.lookAt(c);

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(scene, cam);
    const buf = new Uint8Array(size * size * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(0x000000, 1);

    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    // WebGL は上下反転しているので戻す
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size * 4;
      img.data.set(buf.subarray(src, src + size * 4), y * size * 4);
    }
    ctx.putImageData(img, 0, 0);
    rt.dispose();
    scene.remove(object3d);
    return canvas;
  }

  /** 画面座標(NDC) からレイを作る */
  rayFrom(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster;
  }
}
