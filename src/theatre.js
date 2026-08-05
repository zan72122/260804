// 劇場そのもの。暗い舞台裏、板の床、プロセニアム、客席、吊りバー、そしてゴーストライト。
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp, damp, rand, hash1, easeInOutSine, smoothstep } from './util.js';
import { stageFloorTexture, backWallTexture, glowSprite, goldTexture } from './textures.js';

export const STAGE = {
  halfWidth: 6.7,
  prosceniumW: 13.4,
  prosceniumH: 8.0,
  floorZFront: 2.2,
  floorZBack: -11.5,
  battenY: 13.9,
};

/* ---------- 床の映り込み ---------- */
class FloorReflector {
  constructor(renderer, floor, scale = 0.5) {
    this.renderer = renderer;
    this.floor = floor;
    this.scale = scale;
    this.enabled = true;
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.texture.colorSpace = THREE.NoColorSpace;
    this.rt.texture.minFilter = THREE.LinearFilter;
    this.rt.texture.magFilter = THREE.LinearFilter;
    this.virtualCam = new THREE.PerspectiveCamera();
    this.textureMatrix = new THREE.Matrix4();
    this.normal = new THREE.Vector3(0, 1, 0);
    this._v = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this.hidden = [];
  }
  setSize(w, h) {
    this.rt.setSize(Math.max(2, Math.floor(w * this.scale)), Math.max(2, Math.floor(h * this.scale)));
  }
  update(scene, camera) {
    if (!this.enabled) return;
    const vc = this.virtualCam;
    const mirrorPos = new THREE.Vector3(0, 0, 0);

    this._rot.extractRotation(camera.matrixWorld);
    this._look.set(0, 0, -1).applyMatrix4(this._rot).add(camera.position);

    this._v.copy(camera.position).sub(mirrorPos);
    this._v.reflect(this.normal).negate().add(mirrorPos);
    vc.position.copy(this._v);

    this._v.copy(this._look).sub(mirrorPos);
    this._v.reflect(this.normal).negate().add(mirrorPos);
    const target = this._v.clone();

    vc.up.set(0, 1, 0).applyMatrix4(this._rot);
    vc.up.reflect(this.normal);
    vc.lookAt(target);
    vc.far = camera.far;
    vc.near = camera.near;
    vc.fov = camera.fov;
    vc.aspect = camera.aspect;
    vc.updateProjectionMatrix();
    vc.updateMatrixWorld();

    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.textureMatrix.multiply(this.floor.matrixWorld);

    // 床そのものと、床より下のものは映さない
    this.hidden.length = 0;
    scene.traverse((o) => {
      if (o.visible && (o === this.floor || o.userData.noReflect)) {
        this.hidden.push(o);
        o.visible = false;
      }
    });
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, vc);
    r.setRenderTarget(prevTarget);
    for (const o of this.hidden) o.visible = true;
  }
}

export class Theatre {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.scene.fog = new THREE.FogExp2(0x05060c, 0.021);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.viewFrom = null;
    this.viewTo = null;
    this.viewT = 1;
    this.viewDur = 1;
    this.time = 0;

    this.moodShow = 0;      // 0=舞台裏の暗がり 1=まばゆい本番

    this._buildFloor();
    this._buildRoom();
    this._buildProscenium();
    this._buildWings();
    this._buildBackstageProps();
    this._buildAudience();
    this._buildLights();
    this._buildDustMotes();

    this.reflector = new FloorReflector(renderer, this.floor, 0.5);
    this.setView('title', 0);
  }

  /* ---------- 床（磨かれた板。ここに光がうつる） ---------- */
  _buildFloor() {
    const tex = stageFloorTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.36, metalness: 0.06, color: 0xb9a08c,
    });
    this.reflectUniforms = {
      tReflect: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uReflect: { value: 0.42 },
    };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.tReflect = this.reflectUniforms.tReflect;
      shader.uniforms.textureMatrix = this.reflectUniforms.textureMatrix;
      shader.uniforms.uReflect = this.reflectUniforms.uReflect;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform mat4 textureMatrix;
          varying vec4 vMirrorCoord;
          varying vec3 vWorldPos;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vMirrorCoord = textureMatrix * vec4(transformed, 1.0);
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tReflect;
          uniform float uReflect;
          varying vec4 vMirrorCoord;
          varying vec3 vWorldPos;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          {
            vec2 muv = vMirrorCoord.xy / max(vMirrorCoord.w, 0.0001);
            // 少しにじませて、みがいた板のように
            vec3 refl = texture2D(tReflect, muv).rgb * 0.5;
            refl += texture2D(tReflect, muv + vec2(0.0060, 0.0)).rgb * 0.125;
            refl += texture2D(tReflect, muv - vec2(0.0060, 0.0)).rgb * 0.125;
            refl += texture2D(tReflect, muv + vec2(0.0, 0.0080)).rgb * 0.125;
            refl += texture2D(tReflect, muv - vec2(0.0, 0.0080)).rgb * 0.125;
            float ct = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
            float fres = pow(1.0 - ct, 3.2);
            float inRange = step(-11.6, vWorldPos.z) * step(vWorldPos.z, 2.4);
            float k = clamp(fres * uReflect * 2.4, 0.0, 0.78) * inRange;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, refl, k);
          }`);
    };
    this.floorMat = mat;
    const depth = STAGE.floorZFront - STAGE.floorZBack;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(25, depth, 1, 1), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = (STAGE.floorZFront + STAGE.floorZBack) / 2;
    floor.receiveShadow = true;
    this.floor = floor;
    this.scene.add(floor);

    // 舞台の先端（エプロン）の縁
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(18, 1.5, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x14151b, roughness: 0.85 })
    );
    edge.position.set(0, -0.75, STAGE.floorZFront + 0.15);
    edge.userData.noReflect = true;
    this.scene.add(edge);
  }

  _buildRoom() {
    const wallMat = new THREE.MeshStandardMaterial({
      map: backWallTexture(), color: 0x50525e, roughness: 0.95, metalness: 0,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), wallMat);
    back.position.set(0, 11, -13.5);
    back.receiveShadow = true;
    this.scene.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), wallMat);
      side.position.set(sx * 12.5, 11, -3);
      side.rotation.y = -sx * Math.PI / 2;
      this.scene.add(side);
    }
    // 天井（暗く）
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 34),
      new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 17.5, -3);
    this.scene.add(ceil);
  }

  /* ---------- プロセニアム（額縁） ---------- */
  _buildProscenium() {
    const g = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0x9c8562, roughness: 0.7, metalness: 0.12 });
    const gold = new THREE.MeshStandardMaterial({
      map: goldTexture(), color: 0xffffff, roughness: 0.28, metalness: 0.9, emissive: 0x140c00,
    });
    const halfOpen = STAGE.prosceniumW / 2;
    const H = STAGE.prosceniumH;

    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.6, H + 3.2, 1.5), cream);
      col.position.set(sx * (halfOpen + 1.3), (H + 3.2) / 2 - 0.4, 0.4);
      col.castShadow = true; col.receiveShadow = true;
      g.add(col);
      // 縦の飾り溝
      for (let i = 0; i < 3; i++) {
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, H + 1.4, 10, 1, false, 0, Math.PI), gold);
        fl.position.set(sx * (halfOpen + 0.45 + i * 0.72), (H + 1.4) / 2 - 0.2, 1.16);
        fl.rotation.x = -Math.PI / 2;
        fl.rotation.z = Math.PI / 2;
        g.add(fl);
      }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.55, 1.9), gold);
      cap.position.set(sx * (halfOpen + 1.3), H + 2.6, 0.4);
      g.add(cap);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(STAGE.prosceniumW + 5.2, 3.4, 1.5), cream);
    header.position.set(0, H + 1.5, 0.4);
    header.castShadow = true;
    g.add(header);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(STAGE.prosceniumW + 5.4, 0.34, 1.85), gold);
    trim.position.set(0, H - 0.1, 0.4);
    g.add(trim);
    // 中央の飾り
    const medal = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 10, 28), gold);
    medal.position.set(0, H + 1.8, 1.2);
    g.add(medal);
    const medalIn = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), gold);
    medalIn.position.set(0, H + 1.8, 1.2);
    g.add(medalIn);

    // 幕の上を隠す一文字幕（ペルメット）
    const pel = new THREE.Mesh(new THREE.BoxGeometry(STAGE.prosceniumW + 0.6, 1.5, 0.5),
      new THREE.MeshPhysicalMaterial({ color: 0x4a0716, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xd0687f) }));
    pel.position.set(0, H - 0.85, -0.55);
    g.add(pel);

    this.scene.add(g);
    this.proscenium = g;
  }

  _buildWings() {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0e0f14, roughness: 1 });
    // 客席からの見通し線に入らないよう、奥ほど外へ開く
    this.legs = [];
    this.borders = [];
    for (const [z, x, by] of [[-2.8, 8.8, 10.2], [-6.4, 10.2, 11.4]]) {
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(2.6, 12, 0.12), legMat);
        leg.position.set(sx * x, 6.0, z);
        leg.castShadow = true;
        leg.userData.homeX = sx * x;
        leg.userData.outX = sx * (x + 4.2);
        this.scene.add(leg);
        this.legs.push(leg);
      }
      const border = new THREE.Mesh(new THREE.BoxGeometry(26, 2.6, 0.12), legMat);
      border.position.set(0, by, z);
      border.userData.homeY = by;
      this.scene.add(border);
      this.borders.push(border);
    }
    // 吊りバー
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2b2d34, roughness: 0.5, metalness: 0.8 });
    for (const z of [-1.4, -4.2, -6.4, -9.0]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 17, 10), pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, STAGE.battenY, z);
      this.scene.add(pipe);
    }
  }

  /* ---------- 舞台裏らしい小物 ---------- */
  _buildBackstageProps() {
    const g = new THREE.Group();
    const rope = new THREE.MeshStandardMaterial({ color: 0x6a5c44, roughness: 1 });
    const sand = new THREE.MeshStandardMaterial({ color: 0x3a3528, roughness: 1 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x33353c, roughness: 0.5, metalness: 0.7 });

    // 綱と砂袋（袖の壁ぎわ）
    for (let i = 0; i < 7; i++) {
      const x = -STAGE.halfWidth - 2.3 - (i % 3) * 0.55;
      const z = -3.4 - i * 0.85;
      const len = rand(6, 11);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 5), rope);
      r.position.set(x, 14 - len / 2, z);
      g.add(r);
      const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), sand);
      bag.position.set(x, 14 - len - 0.4, z);
      bag.castShadow = true;
      g.add(bag);
    }
    // ロープを留める棚
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 7), new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.85, metalness: 0.25 }));
    rail.position.set(-STAGE.halfWidth - 2.9, 1.1, -9.4);
    g.add(rail);

    // 立てかけた書き割りの束
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b543a, roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.2, 0.09), woodMat);
      p.position.set(STAGE.halfWidth + 2.0 + i * 0.16, 2.6, -7.4 + i * 0.3);
      p.rotation.z = 0.10;
      p.rotation.y = -0.25;
      p.castShadow = true;
      g.add(p);
    }
    // 脚立
    const ladder = new THREE.Group();
    for (const sx of [-1, 1]) {
      const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.2, 0.1), metal);
      rail2.position.set(sx * 0.45, 2.1, 0);
      rail2.rotation.z = -sx * 0.07;
      ladder.add(rail2);
    }
    for (let i = 0; i < 7; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.24), metal);
      st.position.set(0, 0.55 + i * 0.55, 0);
      ladder.add(st);
    }
    ladder.position.set(-STAGE.halfWidth - 1.6, 0, -9.6);
    ladder.rotation.y = 0.6;
    ladder.traverse((o) => { o.castShadow = true; });
    g.add(ladder);

    // ケーブルの束と道具箱
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.3 }));
    box.position.set(STAGE.halfWidth + 1.7, 0.38, -3.2);
    box.castShadow = true;
    g.add(box);
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.4 + i * 0.07, 0.055, 6, 20),
        new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 }));
      coil.rotation.x = Math.PI / 2;
      coil.position.set(-STAGE.halfWidth - 1.2, 0.06 + i * 0.11, -2.2);
      g.add(coil);
    }
    this.scene.add(g);
    this.props = g;

    // ゴーストライト（暗い舞台にぽつんと灯る、あの電球）
    const gl = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), metal);
    stand.position.y = 1.1;
    gl.add(stand);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.12, 18), metal);
    base.position.y = 0.06;
    gl.add(base);
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.75 });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24 - i * 0.055, 0.012, 5, 18), cageMat);
      ring.position.y = 2.30 + i * 0.10;
      ring.rotation.x = Math.PI / 2;
      gl.add(ring);
    }
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 4), cageMat);
      const a = (i / 4) * Math.PI * 2;
      bar.position.set(Math.cos(a) * 0.21, 2.42, Math.sin(a) * 0.21);
      bar.rotation.z = Math.cos(a) * 0.32;
      bar.rotation.x = -Math.sin(a) * 0.32;
      gl.add(bar);
    }
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdca8, toneMapped: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), this.bulbMat);
    bulb.position.y = 2.28;
    gl.add(bulb);
    this.ghostGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite(), color: 0xffcf90, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, toneMapped: false, opacity: 0.5,
    }));
    this.ghostGlow.scale.setScalar(2.6);
    this.ghostGlow.position.y = 2.28;
    gl.add(this.ghostGlow);
    this.ghostLight = new THREE.PointLight(0xffc98a, 150, 48, 1.7);
    this.ghostLight.position.y = 2.3;
    gl.add(this.ghostLight);
    gl.position.set(-2.2, 0, -4.4);
    this.scene.add(gl);
    this.ghost = gl;
  }

  /* ---------- 客席 ---------- */
  _buildAudience() {
    const g = new THREE.Group();
    g.userData.noReflect = true;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1016, roughness: 1 });
    const hf = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), floorMat);
    hf.rotation.x = -Math.PI / 2;
    hf.position.set(0, -1.55, 16);
    g.add(hf);

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x5a1526, roughness: 0.85 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x120c14, roughness: 1 });
    this.heads = [];
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const z = 5.0 + r * 1.75;
      const y = -1.5 + r * 0.30;
      const cols = 13 + r;
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * 1.24;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.05, 0.42), seatMat);
        seat.position.set(x, y + 0.5, z);
        seat.rotation.x = -0.09;
        g.add(seat);
        if (hash1(r * 31.7 + c * 5.3) > 0.24) {
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 9), headMat);
          head.position.set(x + rand(-0.06, 0.06), y + 1.24, z - 0.24);
          head.scale.y = 1.15;
          g.add(head);
          const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.16, 4, 8), headMat);
          sh.position.set(head.position.x, y + 0.92, z - 0.22);
          g.add(sh);
          this.heads.push({ head, sh, phase: rand(0, 6.3), base: head.position.y });
        }
      }
    }
    this.scene.add(g);
    this.audience = g;

    // 客席のほのかな灯り
    this.houseLights = [];
    for (const x of [-8.5, 8.5]) {
      const l = new THREE.PointLight(0xffb877, 10, 26, 2);
      l.position.set(x, 4.2, 12);
      this.scene.add(l);
      this.houseLights.push(l);
    }
  }

  /* ---------- 明かり ---------- */
  _buildLights() {
    this.ambient = new THREE.AmbientLight(0x7f95d0, 0.55);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x9fb8ff, 0x241a2a, 0.62);
    this.scene.add(this.hemi);

    // 舞台裏の、青くつめたい こぼれ灯り（暗がりに奥ゆきを出す）
    this.workLights = [];
    const wl1 = new THREE.SpotLight(0x7fa8ff, 88, 40, 0.95, 1.0, 1.3);
    wl1.position.set(8.6, 10.5, -10.0);
    wl1.target.position.set(1.0, 0, -6.0);
    this.scene.add(wl1); this.scene.add(wl1.target);
    this.workLights.push(wl1);
    const wl2 = new THREE.SpotLight(0x9fc0ff, 56, 36, 1.0, 1.0, 1.3);
    wl2.position.set(-9.5, 9.0, -1.5);
    wl2.target.position.set(-3.0, 0, -5.0);
    this.scene.add(wl2); this.scene.add(wl2.target);
    this.workLights.push(wl2);

    // 本番のときに立ち上がる、舞台全体のあかり
    this.washes = [];
    const defs = [
      { x: -5.2, y: 11.0, z: 1.0, tx: -3.4, tz: -4.4, color: 0xffb6d0, k: 1.0 },
      { x: 0.0, y: 11.4, z: 1.4, tx: 0.0, tz: -3.6, color: 0xfff2dc, k: 1.15 },
      { x: 5.2, y: 11.0, z: 1.0, tx: 3.4, tz: -4.4, color: 0xa8dcff, k: 1.0 },
      { x: -3.4, y: 12.2, z: -8.2, tx: -2.0, tz: -5.6, color: 0xc9b6ff, k: 0.7 },
      { x: 3.4, y: 12.2, z: -8.2, tx: 2.0, tz: -5.6, color: 0xb6ffe0, k: 0.7 },
    ];
    for (const d of defs) {
      const l = new THREE.SpotLight(d.color, 0, 44, 0.72, 0.92, 1.5);
      l.position.set(d.x, d.y, d.z);
      l.target.position.set(d.tx, 0, d.tz);
      l.userData.k = d.k;
      this.scene.add(l);
      this.scene.add(l.target);
      this.washes.push(l);
    }
    // ホリゾント（背景）をむらなく照らすあかり
    this.cycLights = [];
    for (const x of [-6.0, 0, 6.0]) {
      const l = new THREE.SpotLight(0xffffff, 0, 46, 0.95, 1.0, 1.1);
      l.position.set(x, 12.6, -6.0);
      l.target.position.set(x * 0.7, 6.0, -13.5);
      this.scene.add(l);
      this.scene.add(l.target);
      this.cycLights.push(l);
    }

    // 上からのバックライト（出演者の輪郭をきらせる）
    this.backLight = new THREE.DirectionalLight(0xbfd8ff, 0);
    this.backLight.position.set(0, 12, -11);
    this.backLight.target.position.set(0, 2, -2);
    this.scene.add(this.backLight);
    this.scene.add(this.backLight.target);

    // 幕のうらがわを、うしろからやわらかく照らす灯り
    this.curtainBack = new THREE.SpotLight(0xffdcb0, 0, 38, 1.05, 0.9, 1.0);
    this.curtainBack.position.set(-0.6, 8.6, -5.4);
    this.curtainBack.target.position.set(0.4, 1.6, -0.5);
    this.scene.add(this.curtainBack);
    this.scene.add(this.curtainBack.target);
    this.curtainBackLevel = 0;

    // フットライト
    this.foots = [];
    const footMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 1.55;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), footMat);
      dome.position.set(x, 0.12, STAGE.floorZFront - 0.12);
      dome.userData.noReflect = false;
      this.scene.add(dome);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite(), color: 0xffd9a0, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, toneMapped: false, opacity: 0,
      }));
      sp.scale.setScalar(1.6);
      sp.position.copy(dome.position);
      this.scene.add(sp);
      this.foots.push({ dome, sp });
    }
    this.footLight = new THREE.SpotLight(0xffcf9a, 0, 26, 0.95, 1.0, 1.3);
    this.footLight.position.set(0, 0.25, STAGE.floorZFront - 0.2);
    this.footLight.target.position.set(0, 5.2, -6);
    this.scene.add(this.footLight);
    this.scene.add(this.footLight.target);
    this.footMat = footMat;
  }

  _buildDustMotes() {
    const N = 160;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-9, 9);
      pos[i * 3 + 1] = rand(0.2, 9);
      pos[i * 3 + 2] = rand(-11, 2);
      seed[i] = rand(0, 100);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.30 } },
      vertexShader: /* glsl */`
        attribute float aSeed; uniform float uTime;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.16 + aSeed) * 0.7;
          p.y += sin(uTime * 0.11 + aSeed * 2.3) * 0.5 + mod(uTime * 0.04 + aSeed, 1.0) * 0.4;
          p.z += cos(uTime * 0.13 + aSeed * 1.7) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = 0.35 + 0.65 * sin(uTime * 0.8 + aSeed * 6.0);
          gl_PointSize = 46.0 / max(1.0, -mv.z) * (0.4 + fract(aSeed) * 0.8);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uOpacity; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.85), a * a * vA * uOpacity);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.motes = new THREE.Points(g, this.moteMat);
    this.motes.frustumCulled = false;
    this.motes.userData.noReflect = true;
    this.scene.add(this.motes);
  }

  /* ---------- カメラの見どころ ---------- */
  static VIEWS = {
    title: { pos: [-4.6, 3.1, 2.6], look: [-1.0, 2.4, -6.4], fov: 58 },
    prep: { pos: [-3.4, 4.7, 4.6], look: [0.2, 3.0, -6.9], fov: 55 },
    lift: { pos: [-2.8, 4.6, 4.6], look: [0.0, 5.4, -6.6], fov: 54 },
    spot: { pos: [-3.6, 5.8, 6.2], look: [0.0, 1.8, -5.2], fov: 52 },
    curtain: { pos: [-1.4, 4.3, -6.6], look: [0.2, 3.4, 0.4], fov: 56 },
    reveal: { pos: [0.0, 3.6, 3.4], look: [0.0, 3.4, -4.5], fov: 56 },
    house: { pos: [0.0, 3.9, 10.6], look: [0.0, 3.1, -4.0], fov: 48 },
    show: { pos: [-0.6, 3.0, 6.4], look: [0.2, 2.3, -3.4], fov: 50 },
    free: { pos: [-1.0, 4.4, 7.6], look: [0.0, 2.4, -4.6], fov: 54 },
  };

  setView(name, dur = 2.2) {
    const v = Theatre.VIEWS[name];
    if (!v) return;
    const to = {
      pos: new THREE.Vector3(...v.pos),
      look: new THREE.Vector3(...v.look),
      fov: v.fov,
    };
    if (dur <= 0) {
      this.camPos.copy(to.pos);
      this.camLook.copy(to.look);
      this.camera.fov = to.fov;
      this.baseFov = to.fov;
      this.viewT = 1;
      this.viewTo = to;
      this.viewFrom = to;
    } else {
      this.viewFrom = {
        pos: this.camPos.clone(), look: this.camLook.clone(), fov: this.baseFov || this.camera.fov,
      };
      this.viewTo = to;
      this.viewT = 0;
      this.viewDur = dur;
    }
    this.viewName = name;
  }

  /* ---------- 明るさの気分 ---------- */
  setMood(show, dt = 1) {
    this.moodShow = clamp(show, 0, 1);
  }

  update(dt, aspect) {
    this.time += dt;
    const t = this.time;

    // カメラの移動
    if (this.viewT < 1) {
      this.viewT = Math.min(1, this.viewT + dt / this.viewDur);
      const k = easeInOutSine(this.viewT);
      this.camPos.lerpVectors(this.viewFrom.pos, this.viewTo.pos, k);
      this.camLook.lerpVectors(this.viewFrom.look, this.viewTo.look, k);
      this.baseFov = lerp(this.viewFrom.fov, this.viewTo.fov, k);
    }
    // たてに長い画面（スマホ）でも舞台がおさまるように、
    // 画角を少し広げつつ、カメラも少し引く
    const k = clamp(1.5 / Math.max(aspect, 0.40), 1, 2.4);
    const fovRad = 2 * Math.atan(Math.tan(this.baseFov * Math.PI / 360) * Math.pow(k, 0.42));
    const fov = clamp(fovRad * 180 / Math.PI, this.baseFov, 78);
    this.camera.fov = damp(this.camera.fov, fov, 8, dt);
    this.camera.position.copy(this.camPos);
    if (k > 1.001) {
      this.camera.position.sub(this.camLook).multiplyScalar(1 + (k - 1) * 0.55).add(this.camLook);
    }
    // ほんのり呼吸するカメラ
    this.camera.position.x += Math.sin(t * 0.24) * 0.10;
    this.camera.position.y += Math.sin(t * 0.31 + 1.2) * 0.07;
    this.camera.lookAt(this.camLook);
    this.camera.updateProjectionMatrix();

    // 暗がり → 本番
    const m = this.moodShow;
    this.ambient.intensity = lerp(0.55, 0.30, m);
    this.ambient.color.setHex(m > 0.5 ? 0xcfd8ff : 0x7f95d0);
    this.hemi.intensity = lerp(0.62, 0.32, m);
    this.backLight.intensity = lerp(0, 1.1, m);
    for (let i = 0; i < this.washes.length; i++) {
      this.washes[i].intensity = lerp(0, 168 * this.washes[i].userData.k, m) * (0.88 + 0.12 * Math.sin(t * 0.5 + i));
    }
    this.footLight.intensity = lerp(0, 30, m);
    for (const l of this.cycLights) l.intensity = lerp(6, 92, m);
    for (const f of this.foots) {
      f.sp.material.opacity = m * 0.85;
      f.dome.material.color.setRGB(1, lerp(0.55, 0.85, m), lerp(0.28, 0.62, m));
    }
    // ゴーストライトは本番になると、そっと消える
    const gi = lerp(1, 0.06, m);
    this.ghostLight.intensity = 150 * gi * (0.96 + 0.04 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
    this.ghostGlow.material.opacity = 0.5 * gi;
    this.bulbMat.color.setRGB(1, 0.86 * (0.35 + 0.65 * gi), 0.66 * (0.2 + 0.8 * gi));
    this.ghost.visible = gi > 0.08;

    for (const l of this.houseLights) l.intensity = lerp(10, 1.6, m);
    this.workLights[0].intensity = lerp(88, 5, m);
    this.workLights[1].intensity = lerp(56, 4, m);
    this.scene.fog.density = lerp(0.021, 0.010, m);
    this.scene.fog.color.setRGB(lerp(0.02, 0.05, m), lerp(0.024, 0.045, m), lerp(0.047, 0.08, m));
    this.floorMat.roughness = lerp(0.42, 0.30, m);
    this.reflectUniforms.uReflect.value = lerp(0.30, 0.17, m);

    this.curtainBack.intensity = lerp(this.curtainBack.intensity, this.curtainBackLevel * 250, 1 - Math.exp(-2.5 * dt));

    this.props.visible = m < 0.55;
    for (const leg of this.legs) leg.position.x = lerp(leg.userData.homeX, leg.userData.outX, m);
    for (const b of this.borders) b.position.y = b.userData.homeY + m * 2.4;
    this.moteMat.uniforms.uTime.value = t;
    this.moteMat.uniforms.uOpacity.value = lerp(0.30, 0.14, m);
  }

  applaudAudience(strength) {
    const t = this.time;
    for (const h of this.heads) {
      const k = strength * (0.5 + 0.5 * Math.sin(t * 9 + h.phase));
      h.head.position.y = h.base + k * 0.06;
      h.head.rotation.z = Math.sin(t * 7 + h.phase) * 0.09 * strength;
    }
  }

  renderReflection() {
    if (!this.reflector.enabled) {
      this.reflectUniforms.uReflect.value = 0;
      return;
    }
    this.reflector.update(this.scene, this.camera);
    this.reflectUniforms.tReflect.value = this.reflector.rt.texture;
    this.reflectUniforms.textureMatrix.value.copy(this.reflector.textureMatrix);
  }

  setSize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.reflector.setSize(w, h);
  }
}
