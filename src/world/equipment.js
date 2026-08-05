/**
 * 掃除の道具一式。
 * 透明ホース・吸い込みノズル・つなぎ口・スポンジ・ろ過フィルター。
 */
import * as THREE from 'three';
import { TANK } from './config.js';
import { Tube } from './tube.js';
import { makeGlassMaterial } from './diver.js';
import { applyCaustics } from './shaders.js';
import { clamp, dampV3, TAU } from '../core/util.js';

// フィルターは左手前寄せ。縦持ちでも必ず画面に入り、指を伸ばせる位置に置く。
export const FILTER_POS = new THREE.Vector3(-3.35, 0.98, -0.55);
// フィルター本体の右手前の角（rotation.y = 0.35 を織り込んだ位置）
export const PORT_POS = new THREE.Vector3(-2.59, 1.13, -0.30);
export const HOSE_REST_CONNECTOR = new THREE.Vector3(0.25, 0.40, 1.60);
export const HOSE_REST_NOZZLE = new THREE.Vector3(2.30, 0.34, 1.10);

const HOSE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const HOSE_FRAG = /* glsl */ `
  uniform vec3 uTint;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - abs(dot(N, V)), 2.2);

    // らせん状の補強リブ。ごく控えめにして、中が透けて見えるのを邪魔しない。
    float rib = pow(max(sin(vUv.x * 118.0 + vUv.y * 6.2831), 0.0), 26.0);

    vec3 L = normalize(vec3(-0.3, 1.0, 0.6));
    float spec = pow(max(dot(reflect(-V, N), L), 0.0), 64.0);

    vec3 col = mix(uTint, vec3(0.90, 1.0, 1.0), fres) + spec * 0.7 + rib * 0.18;
    float a = 0.035 + fres * 0.26 + rib * 0.12 + spec * 0.22;
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.62));
  }
`;

export class Equipment {
  constructor(scene, shared, bubbles) {
    this.scene = scene;
    this.shared = shared;
    this.bubbles = bubbles;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.connected = false;
    this.filterRunning = false;
    this.suction = 0;
    this._t = 0;

    this.connectorPos = HOSE_REST_CONNECTOR.clone();
    this.nozzlePos = HOSE_REST_NOZZLE.clone();
    this.connectorDir = new THREE.Vector3(0, 1, 0.4).normalize();
    this.nozzleDir = new THREE.Vector3(0, 1, 0.4).normalize();

    this._buildFilter();
    this._buildHose();
    this._buildConnector();
    this._buildNozzle();
    this._buildSponge();

    // 3 次ベジェ。制御点は曲線の外にあるので、行き過ぎ（ループ）が起きない。
    this.curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
    );
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  _mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.5,
      metalness: opts.metalness ?? 0.25,
      emissive: opts.emissive ?? 0x000000,
    });
    applyCaustics(m, this.shared, { scale: 0.85, strength: 0.6 });
    return m;
  }

  _buildFilter() {
    const g = new THREE.Group();
    const shell = this._mat(0xe9eef2, { roughness: 0.35, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.5, 0.95), shell);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const cap = this._mat(0x2fb6d8, { roughness: 0.3, metalness: 0.3 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.22, 1.04), cap);
    top.position.y = 0.82;
    g.add(top);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.18, 1.04), cap);
    bottom.position.y = -0.8;
    g.add(bottom);

    // 前面の窓。中で羽根車がくるくる回る。
    const window = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), makeGlassMaterial(new THREE.Color(0.6, 0.9, 1.0), 0.08));
    window.position.set(0, 0.05, 0.49);
    window.renderOrder = 11;
    g.add(window);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 26), cap);
    rim.position.set(0, 0.05, 0.48);
    g.add(rim);

    this.impeller = new THREE.Group();
    this.impeller.position.set(0, 0.05, 0.42);
    const bladeMat = this._mat(0xffd23f, { roughness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.045, 0.09), bladeMat);
      blade.position.set(Math.cos((i / 6) * TAU) * 0.17, Math.sin((i / 6) * TAU) * 0.17, 0);
      blade.rotation.z = (i / 6) * TAU;
      this.impeller.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12), this._mat(0x445a66));
    hub.rotation.x = Math.PI / 2;
    this.impeller.add(hub);
    g.add(this.impeller);

    // つなぎ口（ソケット）。光ってここだと教える。
    this.port = new THREE.Group();
    const socketOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.34, 18), this._mat(0x9fb0bb, { metalness: 0.75, roughness: 0.3 }));
    socketOuter.rotation.x = Math.PI / 2;
    this.port.add(socketOuter);
    const socketHole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16), new THREE.MeshBasicMaterial({ color: 0x06131a }));
    socketHole.rotation.x = Math.PI / 2;
    this.port.add(socketHole);

    this.portGlowMat = new THREE.MeshBasicMaterial({
      color: 0x7ff0ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.075, 10, 28), this.portGlowMat);
    glowRing.position.z = 0.06;
    this.port.add(glowRing);
    this.portGlowRing = glowRing;

    this.portLight = new THREE.PointLight(0x7ff0ff, 0, 3.2, 2);
    this.port.add(this.portLight);

    // ワールド座標で置きたいので、フィルタ本体とは独立させる
    this.port.position.copy(PORT_POS);
    this.port.lookAt(PORT_POS.clone().add(new THREE.Vector3(0.55, 0.20, 1)));
    this.group.add(this.port);

    // 運転ランプ
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x224433 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), this.lampMat);
    lamp.position.set(0.44, 0.62, 0.5);
    g.add(lamp);

    // 出水口。動き出すと泡が出る。
    this.outlet = new THREE.Object3D();
    this.outlet.position.set(0.52, 0.7, 0.2);
    g.add(this.outlet);

    g.position.copy(FILTER_POS);
    g.rotation.y = 0.35;
    this.filter = g;
    this.group.add(g);
  }

  _buildHose() {
    this.tube = new Tube(56, 10, 0.115);
    this.hoseMaterial = new THREE.ShaderMaterial({
      uniforms: { uTint: { value: new THREE.Color(0.55, 0.82, 0.88) }, uTime: this.shared.time },
      vertexShader: HOSE_VERT,
      fragmentShader: HOSE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.hose = new THREE.Mesh(this.tube.geometry, this.hoseMaterial);
    this.hose.renderOrder = 9;
    this.group.add(this.hose);
  }

  _buildConnector() {
    const g = new THREE.Group();
    const metal = this._mat(0xb9c6cd, { metalness: 0.85, roughness: 0.25 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.34, 18), metal);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.12, 18), this._mat(0xff8a3d, { roughness: 0.4 }));
    collar.rotation.x = Math.PI / 2;
    collar.position.z = -0.12;
    g.add(collar);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), metal);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.2;
    g.add(tip);
    g.traverse((o) => { o.castShadow = true; });
    this.connector = g;
    this.group.add(g);
  }

  _buildNozzle() {
    const g = new THREE.Group();
    const glass = makeGlassMaterial(new THREE.Color(0.55, 0.85, 0.95), 0.13);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.15, 0.5, 22, 1, true), glass);
    cone.position.z = 0.16;
    cone.rotation.x = Math.PI / 2;
    cone.renderOrder = 11;
    g.add(cone);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 16, 1, true), glass);
    neck.rotation.x = Math.PI / 2;
    neck.position.z = -0.18;
    neck.renderOrder = 11;
    g.add(neck);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 16), this._mat(0x37c9b0, { roughness: 0.5 }));
    grip.rotation.x = Math.PI / 2;
    grip.position.z = -0.02;
    g.add(grip);
    const lipMat = this._mat(0xffd23f, { roughness: 0.4, emissive: 0x2a1c00 });
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.04, 8, 26), lipMat);
    lip.position.z = 0.41;
    g.add(lip);

    // 吸い込み中に光るリング
    this.suckMat = new THREE.MeshBasicMaterial({
      color: 0x9ff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 26), this.suckMat);
    halo.position.z = 0.44;
    g.add(halo);
    this.suckHalo = halo;

    this.nozzleLight = new THREE.PointLight(0x9ff4ff, 0, 2.6, 2);
    this.nozzleLight.position.z = 0.5;
    g.add(this.nozzleLight);

    this.nozzle = g;
    this.group.add(g);
  }

  _buildSponge() {
    const g = new THREE.Group();
    // 黄色いスポンジ＋緑の研磨面。斜めに構えて両方の色が見えるようにする。
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, 0.22), this._mat(0xffd84d, { roughness: 0.98, metalness: 0 }));
    g.add(body);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.08), this._mat(0x4fd39a, { roughness: 0.92, metalness: 0 }));
    pad.position.z = 0.14;
    g.add(pad);
    // 泡だっている感じの粒
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.55,
    });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045 + Math.random() * 0.03, 8, 6), foamMat);
      b.position.set((Math.random() - 0.5) * 0.44, (Math.random() - 0.5) * 0.3, 0.17 + Math.random() * 0.04);
      g.add(b);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 8, 18), this._mat(0xff8a3d, { roughness: 0.6 }));
    strap.rotation.y = Math.PI / 2;
    strap.position.z = -0.15;
    g.add(strap);
    g.traverse((o) => { o.castShadow = true; });
    g.visible = false;
    this.sponge = g;
    this.group.add(g);
  }

  /** ホースの形。口金から立ち上がって、まん中がたるむ。 */
  _updateCurve() {
    const a = this.connectorPos, b = this.nozzlePos;
    const dist = Math.max(a.distanceTo(b), 0.4);
    const out = clamp(dist * 0.36, 0.35, 1.6);
    const sag = clamp(dist * 0.20, 0.15, 0.9);

    this.curve.v0.copy(a);
    this.curve.v3.copy(b);
    this.curve.v1.copy(a).addScaledVector(this.connectorDir, out);
    this.curve.v2.copy(b).addScaledVector(this.nozzleDir, out);
    this.curve.v1.y -= sag;
    this.curve.v2.y -= sag;
    // 砂に埋まらないように持ち上げる
    const floor = TANK.floorY + 0.16;
    this.curve.v1.y = Math.max(this.curve.v1.y, floor);
    this.curve.v2.y = Math.max(this.curve.v2.y, floor);
  }

  setConnected(on) {
    if (this.connected === on) return;
    this.connected = on;
    this.lampMat.color.setHex(on ? 0x66ff9c : 0x224433);
  }

  reset() {
    this.setConnected(false);
    this.filterRunning = false;
    this.portHint = false;
    this.suction = 0;
    this.connectorPos.copy(HOSE_REST_CONNECTOR);
    this.nozzlePos.copy(HOSE_REST_NOZZLE);
    this.connectorDir.set(0, 1, 0.4).normalize();
    this.nozzleDir.set(0, 1, 0.4).normalize();
    this.sponge.visible = false;
  }

  /** ホース内をたどる位置。落ち葉が吸われていく道のり。 */
  pointAlong(t, out = new THREE.Vector3()) {
    return this.curve.getPoint(clamp(t, 0, 1), out);
  }

  update(dt, t) {
    this._t += dt;
    this._updateCurve();
    this.tube.update(this.curve);

    // 口金の向きをホースに沿わせる
    this.connector.position.copy(this.connectorPos);
    this._tmp.copy(this.connectorPos).addScaledVector(this.connectorDir, -1);
    this.connector.lookAt(this._tmp);

    this.nozzle.position.copy(this.nozzlePos);
    this._tmp.copy(this.nozzlePos).addScaledVector(this.nozzleDir, -1);
    this.nozzle.lookAt(this._tmp);

    if (this.filterRunning) {
      this.impeller.rotation.z -= dt * 9;
      if (Math.random() < dt * 3.2) {
        this.outlet.getWorldPosition(this._tmp);
        this.bubbles.spawn(this._tmp.x, this._tmp.y, this._tmp.z, { r: 0.022 + Math.random() * 0.035, speed: 0.8 });
      }
    }

    // つなぎ口の呼びかけ（点滅）
    const pulse = 0.5 + 0.5 * Math.sin(this._t * 3.2);
    const want = this.portHint ? 0.35 + pulse * 0.45 : 0;
    this.portGlowMat.opacity += (want - this.portGlowMat.opacity) * Math.min(1, dt * 6);
    this.portGlowRing.scale.setScalar(1 + (this.portHint ? pulse * 0.18 : 0));
    this.portLight.intensity += ((this.portHint ? 2.2 + pulse * 2.0 : this.connected ? 1.0 : 0) - this.portLight.intensity) * Math.min(1, dt * 6);

    // 吸い込みの光
    const sp = this.suction;
    this.suckMat.opacity = sp * (0.25 + 0.2 * Math.sin(this._t * 12));
    this.suckHalo.scale.setScalar(1 + Math.sin(this._t * 9) * 0.12 * sp);
    this.nozzleLight.intensity = sp * 2.2;
  }
}
