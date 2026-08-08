/**
 * Everything that never moves: the peat floor of the bog, the dikes that
 * hold the flood in, the surrounding autumn meadow, the distant treeline
 * and the sky.
 *
 * All of it is vertex-coloured geometry — no textures to download, no
 * texture memory on a phone, and the colour can follow the terrain
 * function exactly (wet peat in the hollow, dry grass on the crest).
 */

import * as THREE from 'three';
import { bogInset, floorHeight, type FieldVariant } from './layout';
import { clamp, noise2, smoothstep } from '../core/math';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uDusk;
  varying vec3 vDir;
  void main() {
    float t = clamp(vDir.y * 2.1 + 0.14, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, pow(t, 0.7));
    float sun = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 22.0);
    col += uSun * sun * (0.35 + uDusk * 0.85);
    // evening warmth creeps up from the horizon during the last scene
    col = mix(col, uSun * 0.95, uDusk * (1.0 - t) * 0.7);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Height of the land at a point: the bog floor inside the dike, the dike
 * crest just outside it, and rolling meadow beyond. Shared by the mesh
 * builder and the tree scatter so nothing floats or sinks.
 */
export function landHeight(v: FieldVariant, x: number, z: number): number {
  const inset = bogInset(v, x, z);
  const n = noise2(x * 0.22, z * 0.22);
  const n2 = noise2(x * 0.06 + 40, z * 0.06 - 12);
  if (inset >= 0) return floorHeight(v, x, z) + (n - 0.5) * 0.07;
  const d = -inset;
  const crest = smoothstep(clamp(d / 3.2, 0, 1)) * 1.7;
  const fall = smoothstep(clamp((d - 3.2) / 10.0, 0, 1));
  return crest - fall * 0.85 + (n - 0.5) * 0.16 + n2 * 0.9 * fall;
}

export class Terrain {
  readonly group = new THREE.Group();
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(private readonly v: FieldVariant, decor: boolean) {
    this.group.name = 'terrain';

    /* ---------- sky dome ---------- */
    const skyGeo = new THREE.SphereGeometry(300, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: v.skyTop.clone() },
        uBottom: { value: v.skyBottom.clone() },
        uSun: { value: v.sunColor.clone() },
        uSunDir: { value: new THREE.Vector3(0.42, 0.34, 0.58).normalize() },
        uDusk: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    sky.renderOrder = -100;
    sky.frustumCulled = false;
    this.group.add(sky);
    this.disposables.push(skyGeo, this.skyMat);

    /* ---------- bog floor + dikes + meadow ---------- */
    const span = Math.max(v.halfX, v.halfZ) * 2 + 70;
    const seg = 160;
    const geo = new THREE.PlaneGeometry(span, span, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    // the bog floor is a vine mat over peat, not bare soil
    const peatDeep = new THREE.Color('#3b2e1d');
    const peatWet = new THREE.Color('#5b4826');
    const vineFloor = new THREE.Color('#5d6d29');
    const bank = new THREE.Color('#9a854c');
    const grass = new THREE.Color('#6d8433');
    const autumn = new THREE.Color('#b3872e');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const inset = bogInset(v, x, z);
      const n = noise2(x * 0.22, z * 0.22);
      const n2 = noise2(x * 0.06 + 40, z * 0.06 - 12);
      const y = landHeight(v, x, z);
      if (inset >= 0) {
        const t = smoothstep(inset / 1.8);
        c.copy(bank).lerp(peatWet, t).lerp(vineFloor, (0.35 + n * 0.6) * t);
        c.lerp(peatDeep, 0.22 * n2 * t);
      } else {
        const t = clamp(-inset / 3.2, 0, 1);
        c.copy(bank).lerp(grass, t).lerp(autumn, n * 0.5 * t);
      }
      pos.setY(i, y);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.group.add(ground);
    this.disposables.push(geo, mat);

    /* ---------- supply channel behind the gate ---------- */
    this.buildChannel();

    /* ---------- distant treeline and farm sheds ---------- */
    if (decor) this.buildTrees();
  }

  private buildChannel(): void {
    const v = this.v;
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: '#8a8579', roughness: 0.85 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: v.waterTint.clone().multiplyScalar(1.5),
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    this.disposables.push(wallMat, waterMat);

    // A shallow flume running along the far dike, feeding the gate.
    const len = v.halfX * 1.5;
    const chanGeo = new THREE.BoxGeometry(len, 0.9, 3.4);
    const chan = new THREE.Mesh(chanGeo, waterMat);
    chan.position.set(-v.halfX * 0.15, 1.15, -v.halfZ - 3.6);
    g.add(chan);
    this.disposables.push(chanGeo);

    const wallGeo = new THREE.BoxGeometry(len + 1.2, 2.2, 0.7);
    for (const dz of [-1.95, 1.95]) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(-v.halfX * 0.15, 1.0, -v.halfZ - 3.6 + dz);
      w.castShadow = true;
      w.receiveShadow = true;
      g.add(w);
    }
    this.disposables.push(wallGeo);
    this.group.add(g);
  }

  private buildTrees(): void {
    const v = this.v;
    const r = v.rng;
    const count = 130;

    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 2.4, 5);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    // squash + jitter so the crowns are not obviously spheres
    const cp = crownGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      const y = cp.getY(i);
      const z = cp.getZ(i);
      const j = 0.82 + noise2(x * 3 + 5, z * 3 + 9) * 0.4;
      cp.setXYZ(i, x * j * 1.1, y * j * 0.86, z * j * 1.1);
    }
    crownGeo.computeVertexNormals();

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.95 });
    const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
    crowns.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    const palette = ['#5f7a34', '#8a6a2c', '#a85a2c', '#6d8a3f', '#c08a35'];

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + r.range(-0.05, 0.05);
      const rad = Math.max(v.halfX, v.halfZ) + r.range(15, 44);
      const x = Math.cos(ang) * rad * 1.15;
      const z = Math.sin(ang) * rad;
      const base = landHeight(v, x, z);
      const h = r.range(2.4, 5.2);
      p.set(x, base, z);
      q.identity();
      s.set(1, h / 2.4, 1);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);

      const cr = r.range(1.5, 3.1);
      p.set(x, base + h * 0.62 + cr * 0.5, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.range(0, 6.28));
      s.set(cr, cr * r.range(0.85, 1.2), cr);
      m.compose(p, q, s);
      crowns.setMatrixAt(i, m);
      col.set(r.pick(palette)).offsetHSL(0, r.range(-0.06, 0.06), r.range(-0.07, 0.07));
      crowns.setColorAt(i, col);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.frustumCulled = false;
    crowns.frustumCulled = false;
    this.group.add(trunks, crowns);
    this.disposables.push(trunkGeo, crownGeo, trunkMat, crownMat);
  }

  /** 0 = afternoon, 1 = the warm evening light of the closing shot. */
  setDusk(t: number): void {
    this.skyMat.uniforms.uDusk.value = t;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
