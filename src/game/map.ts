import * as THREE from 'three';
import { ROUTES } from '../core/content';
import { buildPlace, type PlaceBuild } from '../world/islands';
import { Ocean } from '../world/ocean';
import { Sky } from '../world/sky';
import { clamp01, damp, dampVec, easeInOutCubic, lerp, smoothstep } from '../core/util';

/**
 * The three candidate crossings are staggered rather than stacked, so the
 * chart's bounding box stays roughly square and reads well in both portrait
 * and landscape without moving anything when the device rotates.
 */
const PAIR_LAYOUT: [number, number, number, number][] = [
  [-78, -86, 14, -116],
  [-52, 22, 66, -6],
  [-20, 128, 80, 100],
];
const MAP_SCALE = 2.2;

/** The dashed / glowing link drawn between two places on the chart. */
class ChartLink {
  mesh: THREE.Mesh;
  uni: Record<string, THREE.IUniform>;
  curve: THREE.CatmullRomCurve3;

  constructor(a: THREE.Vector3, b: THREE.Vector3, glow: number) {
    const mid = a.clone().lerp(b, 0.5);
    const side = new THREE.Vector3().subVectors(b, a).normalize().cross(new THREE.Vector3(0, 1, 0));
    mid.addScaledVector(side, 16);
    mid.y = 1.4;
    this.curve = new THREE.CatmullRomCurve3([a.clone(), a.clone().lerp(mid, 0.5), mid, mid.clone().lerp(b, 0.5), b.clone()]);
    const geo = new THREE.TubeGeometry(this.curve, 180, 1.15, 8, false);
    this.uni = {
      uConnected: { value: 0 },
      uTime: { value: 0 },
      uGlow: { value: new THREE.Color(glow) },
      uHi: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uni,
      transparent: true,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vN;
        void main(){
          vUv = uv; vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uConnected, uTime, uHi;
        uniform vec3 uGlow;
        varying vec2 vUv; varying vec3 vN;
        void main(){
          float along = vUv.x;
          float dash = step(0.45, fract(along * 46.0));
          float lit = 0.42 + 0.58 * abs(vN.y);
          // three light packets running towards the far island
          float beads = 0.0;
          for (int i = 0; i < 3; i++) {
            float head = fract(uTime * 0.26 + float(i) * 0.333);
            float d = abs(along - head);
            beads += exp(-d * d * 900.0);
          }
          vec3 off = vec3(0.30, 0.36, 0.42) * lit;
          vec3 on  = uGlow * (0.75 + beads * 2.6) * lit;
          float a = mix(dash * 0.55, 1.0, uConnected);
          a = max(a, uHi * 0.9);
          vec3 col = mix(off * (0.6 + uHi * 0.8), on, uConnected);
          if (a < 0.02) discard;
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
  }

  update(time: number, connected: number, highlight: number) {
    this.uni.uTime.value = time;
    this.uni.uConnected.value = connected;
    this.uni.uHi.value = highlight;
  }
}

export interface MapPair {
  a: PlaceBuild;
  b: PlaceBuild;
  link: ChartLink;
  centre: THREE.Vector3;
  posA: THREE.Vector3;
  posB: THREE.Vector3;
}

export class MapStage {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  pairs: MapPair[] = [];
  ocean: Ocean;
  sky: Sky;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private targetFov = 46;
  private connected = 0;
  private highlight = -1;
  /** 0 = wide chart, 1 = closed in on the selected pair */
  private zoom = 0;
  private ray = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hitPoint = new THREE.Vector3();
  time = 0;
  private fogTint = new THREE.Color(0xbcdcea);
  private duskSun = new THREE.Color(0xffb066);
  private duskSky = new THREE.Color(0x8fa6d8);
  private tmpA = new THREE.Color();
  private tmpB = new THREE.Color();
  private tmpC = new THREE.Color();
  private tmpV = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 6000);
    this.scene.fog = new THREE.FogExp2(0xbcdcea, 0.00062);

    this.sky = new Sky(2600);
    this.scene.add(this.sky.mesh);

    this.ocean = new Ocean(2200);
    this.scene.add(this.ocean.mesh);

    this.hemi = new THREE.HemisphereLight(0xd6ecff, 0x2c4a52, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sun.position.set(180, 260, -220);
    this.scene.add(this.sun);

    ROUTES.forEach((def, i) => {
      const [ax, az, bx, bz] = PAIR_LAYOUT[i];
      const posA = new THREE.Vector3(ax, 0, az);
      const posB = new THREE.Vector3(bx, 0, bz);
      const a = buildPlace(def.a, MAP_SCALE);
      const b = buildPlace(def.b, MAP_SCALE);
      a.group.position.copy(posA);
      b.group.position.copy(posB);
      this.scene.add(a.group, b.group);
      const link = new ChartLink(
        posA.clone().setY(1.2),
        posB.clone().setY(1.2),
        0x8bf0f5,
      );
      this.scene.add(link.mesh);
      for (let k = 0; k < a.buildingCount; k++) a.setLit(k, 0);
      for (let k = 0; k < b.buildingCount; k++) b.setLit(k, 0);
      a.setSignal(0);
      b.setSignal(0);
      this.pairs.push({ a, b, link, centre: posA.clone().lerp(posB, 0.5), posA, posB });
    });

    this.camPos.set(0, 265, 230);
    this.camLook.set(0, 0, 0);
    this.targetPos.copy(this.camPos);
  }

  setLinkColor(glow: number, index: number) {
    (this.pairs[index].link.uni.uGlow.value as THREE.Color).setHex(glow);
  }

  /** Which pair is under this screen point? Very forgiving on purpose. */
  pick(ndc: THREE.Vector2): number {
    this.ray.setFromCamera(ndc, this.camera);
    if (!this.ray.ray.intersectPlane(this.groundPlane, this.hitPoint)) return -1;
    let best = -1;
    let bd = Infinity;
    this.pairs.forEach((p, i) => {
      const d = Math.min(this.hitPoint.distanceTo(p.posA), this.hitPoint.distanceTo(p.posB), this.hitPoint.distanceTo(p.centre) * 0.85);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return bd < 95 ? best : -1;
  }

  setHighlight(i: number) {
    this.highlight = i;
  }

  /** Wide chart shot; portrait pulls back and tilts down a little more. */
  framePicker(portrait: boolean) {
    this.zoom = 0;
    this.targetFov = portrait ? 58 : 46;
    // Steep enough that the chart fills the frame instead of running off to a
    // horizon, and far enough that the widest pair still fits across portrait's
    // narrow horizontal field.
    this.targetPos.set(0, portrait ? 470 : 250, portrait ? 135 : 150);
    this.targetLook.set(0, 0, portrait ? -4 : -4);
  }

  /** Close-up on the finished link. */
  frameResult(index: number, portrait: boolean, t: number) {
    this.zoom = 1;
    const p = this.pairs[index];
    const ang = t * 0.06;
    this.targetFov = portrait ? 56 : 44;
    this.targetPos.set(
      p.centre.x + Math.sin(ang) * 45,
      portrait ? 255 : 125,
      p.centre.z + (portrait ? 190 : 100),
    );
    this.targetLook.copy(p.centre).setY(10);
  }

  setConnected(v: number) {
    this.connected = v;
  }

  /**
   * Evening falls over the finished crossing. Daylight simply drowns lit
   * windows and a glowing cable; at dusk the reward is legible at a glance,
   * which is the whole point of the last beat.
   */
  setDusk(v: number) {
    const d = clamp01(v);
    this.sun.intensity = lerp(2.6, 0.32, d);
    this.sun.color.setHex(0xfff1d6).lerp(this.duskSun, d);
    this.hemi.intensity = lerp(1.15, 0.46, d);
    this.hemi.color.setHex(0xd6ecff).lerp(this.duskSky, d);
    this.sky.setMood(
      new THREE.Color(0x2f79bd).lerp(new THREE.Color(0x101f3d), d).getHex(),
      new THREE.Color(0xbfe0ef).lerp(new THREE.Color(0xf0a469), d).getHex(),
      new THREE.Color(0xfff3d8).lerp(new THREE.Color(0xffb066), d).getHex(),
    );
    this.ocean.setSky(
      this.tmpA.setHex(0x9fd4ee).lerp(this.tmpB.setHex(0x4a4a7e), d),
      this.tmpC.setHex(0xfff0d2).lerp(this.tmpB.setHex(0xffab68), d),
    );
    this.ocean.setWater(
      this.tmpA.setHex(0x0d4a6b).lerp(this.tmpB.setHex(0x061a30), d),
      this.tmpC.setHex(0x2b8fae).lerp(this.tmpB.setHex(0x1d3a58), d),
      this.tmpA.setHex(0x7fd7e8).lerp(this.tmpB.setHex(0x35506f), d),
    );
    this.fogTint.setHex(0xbcdcea).lerp(this.tmpB.setHex(0x30436b), d);
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogTint);
  }

  /** During the finale only the finished crossing stays on screen. */
  focusPair(index: number | null) {
    this.pairs.forEach((p, i) => {
      const on = index === null || i === index;
      p.a.group.visible = on;
      p.b.group.visible = on;
      p.link.mesh.visible = on;
    });
  }

  update(dt: number, aspect: number) {
    this.time += dt;
    dampVec(this.camPos, this.targetPos, 1.6, dt);
    dampVec(this.camLook, this.targetLook, 1.9, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov = damp(this.camera.fov, this.targetFov, 3, dt);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.sky.update(this.time, this.camera);
    this.ocean.update(this.time, this.camera, this.fogTint, 0.00062);

    this.pairs.forEach((p, i) => {
      const hi = this.highlight === i ? 1 : 0;
      const conn = this.zoom === 1 && this.highlight === i ? this.connected : 0;
      p.link.update(this.time, conn, hi * (0.35 + Math.sin(this.time * 3) * 0.18));
      // gentle bob for the unconnected signal marks
      const bob = Math.sin(this.time * 1.4 + i) * 0.6;
      p.a.signal.position.y = p.a.signal.userData.baseY ?? (p.a.signal.userData.baseY = p.a.signal.position.y);
      p.a.signal.position.y += bob;
      p.b.signal.position.y = p.b.signal.userData.baseY ?? (p.b.signal.userData.baseY = p.b.signal.position.y);
      p.b.signal.position.y += bob;
      p.a.signal.rotation.y = Math.sin(this.time * 0.5 + i) * 0.3;
      p.b.signal.rotation.y = Math.sin(this.time * 0.5 + i + 1) * 0.3;
      if (p.a.beaconBeam) p.a.beaconBeam.rotation.y = this.time * 0.8;
      if (p.b.beaconBeam) p.b.beaconBeam.rotation.y = this.time * 0.8 + 1.4;
    });
  }

  /** Progressive celebration: signal marks, then buildings one by one. */
  applyFinale(index: number, t: number, onSpark: (i: number) => void) {
    const p = this.pairs[index];
    const total = p.a.buildingCount + p.b.buildingCount;
    const conn = smoothstep(0, 1.1, t);
    this.setConnected(conn);
    const sig = smoothstep(0.7, 1.6, t);
    p.a.setSignal(sig);
    p.b.setSignal(sig);
    for (let i = 0; i < total; i++) {
      const start = 1.5 + i * 0.42;
      const v = easeInOutCubic(clamp01((t - start) / 0.75));
      if (v > 0 && !p.a.group.userData[`sp${i}`] && v > 0.2) {
        p.a.group.userData[`sp${i}`] = true;
        onSpark(i);
      }
      if (i < p.a.buildingCount) p.a.setLit(i, v);
      else p.b.setLit(i - p.a.buildingCount, v);
    }
  }

  resetFinale(index: number) {
    const p = this.pairs[index];
    for (let i = 0; i < p.a.buildingCount + p.b.buildingCount; i++) delete p.a.group.userData[`sp${i}`];
    for (let i = 0; i < p.a.buildingCount; i++) p.a.setLit(i, 0);
    for (let i = 0; i < p.b.buildingCount; i++) p.b.setLit(i, 0);
    p.a.setSignal(0);
    p.b.setSignal(0);
    this.setConnected(0);
  }

  /** Screen position of a world point, in CSS pixels. */
  project(world: THREE.Vector3, w: number, h: number, out: { x: number; y: number }) {
    this.tmpV.copy(world).project(this.camera);
    out.x = (this.tmpV.x * 0.5 + 0.5) * w;
    out.y = (-this.tmpV.y * 0.5 + 0.5) * h;
  }
}
