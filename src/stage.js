/* =========================================================
   stage.js — レンダラ・カメラ・照明・空気遠近
   物理ベースの単位で組む（three r155+ のライト強度）
   ========================================================= */
import * as THREE from 'three';
import { envEquirect } from './textures.js';
import { WORLD } from './bakery.js';

export class Stage {
  constructor(canvas) {
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
      alpha: false, stencil: false, preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1c12);
    /* 空気遠近：奥ほど霞む。焼き場の空気（粉と湯気）を想定 */
    scene.fog = new THREE.FogExp2(0xb59a7c, 0.115);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.03, 40);
    this.camera.position.set(0, 1.55, 0.95);

    this._buildLights();
    this._buildEnv();

  }

  _buildEnv() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const tex = new THREE.CanvasTexture(envEquirect());
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const rt = pmrem.fromEquirectangular(tex);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.38;
    tex.dispose();
    pmrem.dispose();
  }

  _buildLights() {
    /* 窓からの昼光（主光源）。作業台へ斜めに差し込む */
    const key = new THREE.DirectionalLight(0xfff0d6, 6.4);
    key.position.set(-4.0, 3.4, 2.2);
    key.target.position.set(0.0, WORLD.benchTop, -0.35);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    const cam = key.shadow.camera;
    cam.left = -2.4; cam.right = 2.4; cam.top = 2.4; cam.bottom = -2.4;
    cam.near = 1.0; cam.far = 12.0;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 2.2;
    this.scene.add(key, key.target);
    this.key = key;

    /* 天井の照明（補助）。作業台の真上 */
    const lamp = new THREE.PointLight(0xffd2a0, 4.2, 7, 2);
    lamp.position.set(0.15, 2.62, -0.25);
    this.scene.add(lamp);
    this.lamp = lamp;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe9c4, toneMapped: false })
    );
    bulb.position.copy(lamp.position);
    this.scene.add(bulb);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.16, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2f2a26, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide })
    );
    shade.position.set(lamp.position.x, lamp.position.y + 0.10, lamp.position.z);
    this.scene.add(shade);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.8 })
    );
    cord.position.set(lamp.position.x, lamp.position.y + 0.38, lamp.position.z);
    this.scene.add(cord);

    /* 環境光（壁の跳ね返り） */
    const hemi = new THREE.HemisphereLight(0xe6d6bd, 0x40301f, 0.34);
    this.scene.add(hemi);
    this.hemi = hemi;

    /* 炉の光：炉口から手前へこぼれる。焼成中だけ強くする */
    const oven = new THREE.SpotLight(0xff8a34, 0, 5.0, 1.05, 0.62, 1.5);
    oven.position.set(0, WORLD.mouthY + 0.10, WORLD.ovenFront - 0.45);
    oven.target.position.set(0, WORLD.deckY, WORLD.ovenFront - 0.95);
    oven.castShadow = true;
    oven.shadow.mapSize.set(768, 768);
    oven.shadow.camera.near = 0.05;
    oven.shadow.camera.far = 3.0;
    oven.shadow.bias = -0.0012;
    oven.shadow.normalBias = 0.008;
    this.scene.add(oven, oven.target);
    this.ovenLight = oven;

    /* 炉室の奥からの照り返し（パンの向こう側の縁を起こす） */
    const rim = new THREE.PointLight(0xff9440, 0, 2.2, 2);
    rim.position.set(0, WORLD.deckY + 0.30, WORLD.ovenFront - 1.30);
    this.scene.add(rim);
    this.ovenRim = rim;

    /* 炉口から手前へ漏れる光 */
    const spill = new THREE.PointLight(0xff8a30, 0, 3.2, 2);
    spill.position.set(0, WORLD.mouthY, WORLD.ovenFront + 0.22);
    this.scene.add(spill);
    this.ovenSpill = spill;
  }

  setOvenHeat(k) {
    const flick = 1 + Math.sin(performance.now() * 0.006) * 0.045 + Math.sin(performance.now() * 0.017) * 0.028;
    this.ovenLight.intensity = 5.0 * k * flick;
    this.ovenSpill.intensity = 1.7 * k * flick;
    this.ovenRim.intensity = 1.5 * k * (2 - flick);
  }

  /* 炉の中にいるときは、部屋の環境光を落として炉の光だけで形を見せる。
     環境光が強いままだと、クープの凹凸が飛んで平らに見えてしまう。 */
  setInterior(k) {
    this.hemi.intensity = 0.34 - 0.25 * k;
    this.scene.environmentIntensity = 0.38 - 0.26 * k;
    this.key.intensity = 6.4 - 4.9 * k;
    this.lamp.intensity = 4.2 - 3.4 * k;
    this.renderer.toneMappingExposure = 1.0 - 0.10 * k;
    this.scene.fog.color.setHex(k > 0.5 ? 0x4a2a16 : 0xb59a7c);
  }

  resize(w, h, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
