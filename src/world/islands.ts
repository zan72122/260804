import * as THREE from 'three';
import type { BuildingKind, PlaceDef } from '../core/content';
import { textures } from '../core/textures';
import { clamp01, fbm, makeNoise2D, makeRng } from '../core/util';

export interface PlaceBuild {
  group: THREE.Group;
  /** one entry per building; index order is the order they light up */
  windows: THREE.MeshStandardMaterial[];
  lamp: THREE.PointLight;
  signal: THREE.Group;
  beacon: THREE.Mesh | null;
  beaconBeam: THREE.Mesh | null;
  radius: number;
  setLit(index: number, v: number): void;
  setSignal(v: number): void;
  buildingCount: number;
}

const WINDOW_OFF = 0x1b2026;

function windowMat() {
  return new THREE.MeshStandardMaterial({
    color: WINDOW_OFF,
    emissive: new THREE.Color(0xffcf85),
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.4,
  });
}

function addWindows(
  parent: THREE.Object3D,
  mat: THREE.MeshStandardMaterial,
  w: number,
  h: number,
  rows: number,
  cols: number,
  faceZ: number,
  sizeW: number,
  sizeH: number,
  yOff: number,
) {
  const geo = new THREE.PlaneGeometry(sizeW, sizeH);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(((c + 0.5) / cols - 0.5) * w, yOff + ((r + 0.5) / rows - 0.5) * h, faceZ);
      parent.add(m);
    }
}

function buildBuilding(kind: BuildingKind, mat: THREE.MeshStandardMaterial, rng: () => number) {
  const g = new THREE.Group();
  const tex = textures();
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex.hullPaint,
    color: 0xdad3c4,
    roughness: 0.92,
    metalness: 0.02,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f5a48, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c4, roughness: 0.7, metalness: 0.3 });
  let beacon: THREE.Mesh | null = null;
  let beam: THREE.Mesh | null = null;

  switch (kind) {
    case 'house': {
      const w = 1.6 + rng() * 0.6;
      const d = 1.5 + rng() * 0.5;
      const h = 1.3 + rng() * 0.5;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h / 2;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, 0.9, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + 0.42;
      g.add(roof);
      addWindows(g, mat, w * 0.7, h * 0.5, 1, 2, d / 2 + 0.01, 0.34, 0.4, h * 0.55);
      addWindows(g, mat, w * 0.7, h * 0.5, 1, 2, -d / 2 - 0.01, 0.34, 0.4, h * 0.55);
      break;
    }
    case 'lighthouse': {
      const h = 5.2;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, h, 16), wallMat);
      tower.position.y = h / 2;
      g.add(tower);
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72 - i * 0.07, 0.78 - i * 0.07, 0.55, 16), new THREE.MeshStandardMaterial({ color: 0xc4453c, roughness: 0.85 }));
        band.position.y = 0.9 + i * 1.5;
        g.add(band);
      }
      const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.12, 16), trimMat);
      gallery.position.y = h;
      g.add(gallery);
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.85, 12), mat);
      lantern.position.y = h + 0.5;
      g.add(lantern);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.5, 12), trimMat);
      cap.position.y = h + 1.1;
      g.add(cap);
      beacon = lantern;
      // rotating beam
      const bg = new THREE.ConeGeometry(1.5, 15, 14, 1, true);
      bg.rotateZ(Math.PI / 2);
      bg.translate(7.5, 0, 0);
      beam = new THREE.Mesh(
        bg,
        new THREE.ShaderMaterial({
          uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffe9b8) } },
          vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader: `
            uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;
            void main(){
              float a = pow(1.0 - vUv.y, 1.6) * uOpacity * 0.34;
              if (a < 0.004) discard;
              gl_FragColor = vec4(uColor, a);
            }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.y = h + 0.5;
      g.add(beam);
      break;
    }
    case 'hospital': {
      const w = 3.2;
      const h = 2.6;
      const d = 2.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h / 2;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.18, d + 0.1), trimMat);
      roof.position.y = h;
      g.add(roof);
      addWindows(g, mat, w * 0.8, h * 0.6, 2, 4, d / 2 + 0.01, 0.36, 0.34, h * 0.52);
      addWindows(g, mat, w * 0.8, h * 0.6, 2, 4, -d / 2 - 0.01, 0.36, 0.34, h * 0.52);
      // red cross
      const crossMat = new THREE.MeshStandardMaterial({ color: 0xe05248, emissive: 0x852b25, emissiveIntensity: 0.4, roughness: 0.6 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.08), crossMat);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.08), crossMat);
      c1.position.set(0, h + 0.7, 0);
      c2.position.set(0, h + 0.7, 0);
      g.add(c1, c2);
      const helipad = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18), new THREE.MeshStandardMaterial({ color: 0x4a5158, roughness: 0.95 }));
      helipad.rotation.x = -Math.PI / 2;
      helipad.position.set(0.9, h + 0.11, 0);
      g.add(helipad);
      break;
    }
    case 'lab': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.2), wallMat);
      base.position.y = 0.8;
      g.add(base);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), trimMat);
      dome.position.y = 1.6;
      g.add(dome);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.2, 1.2), mat);
      slit.position.set(0, 2.0, 0.7);
      g.add(slit);
      addWindows(g, mat, 2.0, 0.7, 1, 3, 1.11, 0.4, 0.4, 0.85);
      break;
    }
    case 'antenna': {
      const mastH = 5.6;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, mastH, 8), trimMat);
      mast.position.y = mastH / 2;
      g.add(mast);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.08, 0.035, 6, 14), trimMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.5 + i * 1.4;
        g.add(ring);
      }
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), trimMat);
      dish.material.side = THREE.DoubleSide;
      dish.rotation.x = -1.0;
      dish.position.set(0.6, 2.4, 0);
      g.add(dish);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat);
      top.position.y = mastH + 0.1;
      g.add(top);
      beacon = top;
      const hut = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.2), wallMat);
      hut.position.set(-1.2, 0.5, 0.4);
      g.add(hut);
      addWindows(g, mat, 1.0, 0.4, 1, 2, 1.01, 0.26, 0.3, 0.55);
      break;
    }
    case 'school': {
      const w = 4.4;
      const h = 2.0;
      const d = 2.0;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h / 2;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.3), roofMat);
      roof.position.y = h + 0.1;
      g.add(roof);
      addWindows(g, mat, w * 0.85, h * 0.55, 2, 6, d / 2 + 0.01, 0.28, 0.3, h * 0.52);
      addWindows(g, mat, w * 0.85, h * 0.55, 2, 6, -d / 2 - 0.01, 0.28, 0.3, h * 0.52);
      const clock = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), mat);
      clock.position.set(0, h + 0.6, d / 2 + 0.02);
      g.add(clock);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), wallMat);
      tower.position.set(0, h + 0.6, 0);
      g.add(tower);
      break;
    }
  }
  return { group: g, beacon, beam };
}

/** The "no signal" / "signal" mark that floats above a place. Never any text. */
function buildSignalMark() {
  const g = new THREE.Group();
  const mats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 3; i++) {
    const r = 0.55 + i * 0.45;
    const geo = new THREE.TorusGeometry(r, 0.075, 6, 26, Math.PI * 0.72);
    geo.rotateZ(Math.PI * 0.64);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3f4a52,
      emissive: new THREE.Color(0x6ff0d8),
      emissiveIntensity: 0,
      roughness: 0.5,
      metalness: 0.2,
    });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.userData.step = i;
    g.add(m);
  }
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 9),
    new THREE.MeshStandardMaterial({ color: 0x3f4a52, emissive: 0x6ff0d8, emissiveIntensity: 0, roughness: 0.4 }),
  );
  g.add(dot);
  mats.push(dot.material as THREE.MeshStandardMaterial);
  // a slash across the arcs while disconnected
  const slash = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.16, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd2564e, emissive: 0x561f1c, emissiveIntensity: 0.4, roughness: 0.6 }),
  );
  slash.rotation.z = -0.72;
  g.add(slash);
  g.userData.mats = mats;
  g.userData.slash = slash;
  return g;
}

export function buildPlace(def: PlaceDef, scale = 1): PlaceBuild {
  const tex = textures();
  const group = new THREE.Group();
  const rng = makeRng(def.id.length * 137 + def.buildings.length * 31 + 7);
  const noise = makeNoise2D(def.id.charCodeAt(0) * 17 + 3);
  const radius = 15 * scale;
  const height = (2.5 + def.relief * 9) * scale;

  // ---- island body -------------------------------------------------------
  const RINGS = 26;
  const SEG = 40;
  const verts: number[] = [];
  const uvs: number[] = [];
  const cols: number[] = [];
  const idx: number[] = [];
  const grass = new THREE.Color(0x6f8f5a);
  const sandC = new THREE.Color(0xd9c9a3);
  const rockC = new THREE.Color(0x7d7a72);
  const tint = new THREE.Color(def.tint);
  const tmp = new THREE.Color();
  const heightAt = (r: number, a: number) => {
    const shore = 1 - clamp01(r / radius);
    const bump = fbm(noise, Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12, 4) * 0.5 + 0.5;
    // broad, gently domed land with a real beach ring, so the island actually
    // reads as land from a chart-height camera instead of a speck
    return Math.pow(shore, 1.05) * height * (0.5 + bump * 0.7) - 0.62 * scale;
  };
  for (let i = 0; i <= RINGS; i++) {
    const r = (i / RINGS) * radius * 1.18;
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const wob = 1 + fbm(noise, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 3) * 0.22;
      const rr = r * wob;
      const y = heightAt(rr, a);
      verts.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uvs.push(Math.cos(a) * r * 0.06, Math.sin(a) * r * 0.06);
      const hn = clamp01(y / (height * 0.7));
      tmp.copy(sandC).lerp(grass, clamp01((y + 0.5) / (1.6 * scale)));
      tmp.lerp(rockC, Math.pow(hn, 1.6) * 0.7);
      tmp.lerp(tint, 0.18);
      if (y < -0.4 * scale) tmp.lerp(new THREE.Color(0x9a8f74), 0.6);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < RINGS; i++)
    for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j;
      const b = a + 1;
      const c = a + SEG + 1;
      const d = c + 1;
      // +j is anticlockwise and +i is outwards, so this winding faces up
      idx.push(a, b, c, b, d, c);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const land = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: tex.islandGround, vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  group.add(land);

  // ---- buildings ---------------------------------------------------------
  const windows: THREE.MeshStandardMaterial[] = [];
  const beacons: (THREE.Mesh | null)[] = [];
  const beams: (THREE.Mesh | null)[] = [];
  const n = def.buildings.length;
  def.buildings.forEach((kind, i) => {
    const mat = windowMat();
    windows.push(mat);
    const b = buildBuilding(kind, mat, rng);
    beacons.push(b.beacon);
    beams.push(b.beam);
    const a = (i / n) * Math.PI * 2 + 0.6;
    const rr = radius * (kind === 'lighthouse' ? 0.18 : 0.38 + rng() * 0.3);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    b.group.position.set(x, heightAt(Math.hypot(x, z), a) - 0.06 * scale, z);
    b.group.rotation.y = -a + Math.PI / 2 + (rng() - 0.5) * 0.5;
    b.group.scale.setScalar(scale);
    group.add(b.group);
  });

  // little trees for scale
  {
    const trunk = new THREE.CylinderGeometry(0.06, 0.09, 0.7, 5);
    trunk.translate(0, 0.35, 0);
    const crown = new THREE.ConeGeometry(0.45, 1.1, 7);
    crown.translate(0, 1.1, 0);
    const tm = new THREE.MeshStandardMaterial({ color: 0x54733f, roughness: 0.95 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b533a, roughness: 0.95 });
    const count = 26;
    const im1 = new THREE.InstancedMesh(trunk, trunkMat, count);
    const im2 = new THREE.InstancedMesh(crown, tm, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s3 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = radius * (0.25 + rng() * 0.62);
      const y = heightAt(r, a);
      if (y < 0.15 * scale) continue;
      p3.set(Math.cos(a) * r, y, Math.sin(a) * r);
      s3.setScalar(scale * (0.8 + rng() * 0.7));
      m4.compose(p3, q, s3);
      im1.setMatrixAt(placed, m4);
      im2.setMatrixAt(placed, m4);
      placed++;
    }
    im1.count = placed;
    im2.count = placed;
    im1.instanceMatrix.needsUpdate = true;
    im2.instanceMatrix.needsUpdate = true;
    group.add(im1, im2);
  }

  const lamp = new THREE.PointLight(0xffd6a0, 0, 70 * scale, 1.8);
  lamp.position.set(0, height * 0.8 + 2, 0);
  group.add(lamp);

  const signal = buildSignalMark();
  signal.scale.setScalar(scale * 3.0);
  signal.position.set(0, height + 10 * scale, 0);
  group.add(signal);

  const signalMats = signal.userData.mats as THREE.MeshStandardMaterial[];
  const slash = signal.userData.slash as THREE.Mesh;

  const lit = new Float32Array(n);

  return {
    group,
    windows,
    lamp,
    signal,
    beacon: beacons.find((b) => b) ?? null,
    beaconBeam: beams.find((b) => b) ?? null,
    radius,
    buildingCount: n,
    setLit(index: number, v: number) {
      if (index < 0 || index >= windows.length) return;
      lit[index] = v;
      windows[index].emissiveIntensity = v * 4.2;
      windows[index].color.setHex(WINDOW_OFF).lerp(new THREE.Color(0xffe6bd), v * 0.55);
      const bm = beacons[index];
      if (bm) {
        const m = bm.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = v * 5.0;
      }
      const be = beams[index];
      if (be) (be.material as THREE.ShaderMaterial).uniforms.uOpacity.value = v;
      let total = 0;
      for (let i = 0; i < n; i++) total += lit[i];
      lamp.intensity = (total / n) * 420;
    },
    setSignal(v: number) {
      for (const m of signalMats) {
        m.emissiveIntensity = v * 3.4;
        m.color.setHex(0x3f4a52).lerp(new THREE.Color(0x8ffbe6), v * 0.6);
      }
      slash.visible = v < 0.5;
      const sm = slash.material as THREE.MeshStandardMaterial;
      sm.opacity = 1;
      sm.color.setHex(0xd2564e);
    },
  };
}
