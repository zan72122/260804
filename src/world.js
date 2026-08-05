// Renderer, lighting, the sewing table and the camera rig.
// Everything here exists to make the workshop feel warm and sunlit.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp } from './geom2d.js';

/**
 * Three quality steps. Phones report modest core counts even when they are
 * perfectly capable, so the middle tier — full effects, a slightly coarser
 * cloth — is the one most handsets land on.
 */
export function pickTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;      // undefined on Safari
  const px = window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1);
  if (cores <= 3 || mem <= 2) {
    return { name: 'low', clothNX: 35, clothNZ: 39, maxPR: 1.5, shadow: 1024, bloom: false, aa: false, tex: 512, sparkles: 150 };
  }
  if (cores <= 4 || px > 3.6e6) {
    return { name: 'mid', clothNX: 41, clothNZ: 47, maxPR: 2.0, shadow: 1536, bloom: true, aa: true, tex: 1024, sparkles: 240 };
  }
  return { name: 'high', clothNX: 45, clothNZ: 51, maxPR: 2.0, shadow: 2048, bloom: true, aa: true, tex: 1024, sparkles: 320 };
}

/** Frees the GPU resources of a discarded subtree. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints && !o.isSprite) return;
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

/** Soft round sprite used by every particle effect. */
export function makeSoftSprite(inner = '#ffffff', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, 'rgba(255,255,255,0.72)');
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Four-point twinkle used for sparkles. */
export function makeStarSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.fill();
  g.save();
  g.translate(64, 64);
  g.fillStyle = '#ffffff';
  for (let k = 0; k < 4; k++) {
    g.rotate(Math.PI / 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(7, -22, 0, -60);
    g.quadraticCurveTo(-7, -22, 0, 0);
    g.fill();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#e3c39c';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 190; i++) {
    const y = Math.random() * size;
    g.strokeStyle = `rgba(${168 + Math.random() * 40},${126 + Math.random() * 40},${88 + Math.random() * 36},${0.10 + Math.random() * 0.14})`;
    g.lineWidth = 1 + Math.random() * 5;
    g.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin(x * 0.017 + i) * 5 + Math.sin(x * 0.004 + i * 2) * 11;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

function matTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#dcefe6');
  grad.addColorStop(1, '#c4dfd7');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(120,175,164,0.4)';
  g.lineWidth = 1;
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * size;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(size, p); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rounded rectangle as a THREE.Shape. */
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const BACKDROP_VS = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACKDROP_FS = `
uniform vec3 top;
uniform vec3 mid;
uniform vec3 bottom;
varying vec3 vPos;
void main() {
  float h = normalize(vPos).y * 0.5 + 0.5;
  vec3 c = h > 0.5 ? mix(mid, top, (h - 0.5) * 2.0) : mix(bottom, mid, h * 2.0);
  gl_FragColor = vec4(c, 1.0);
}`;

export class World {
  constructor(canvas, tier) {
    this.tier = tier;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier.aa,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxPR));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf7cdb6, 13, 30);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    this.camera.position.set(0, 5.2, 5.4);
    this.camTarget = new THREE.Vector3(0, 0.4, 0);
    this.camGoalPos = this.camera.position.clone();
    this.camGoalTarget = this.camTarget.clone();
    this.frameCentre = new THREE.Vector3(0, 0.4, 0);
    this.framePts = null;
    this.frameDir = new THREE.Vector3(0, 0.86, 0.86).normalize();
    this.camSnap = true;
    this._worldUp = new THREE.Vector3(0, 1, 0);
    this._fF = new THREE.Vector3();
    this._fR = new THREE.Vector3();
    this._fU = new THREE.Vector3();
    this._fE = new THREE.Vector3();

    this._backdrop();
    this._lights();
    this._table();
    this._bokeh();
    this._composer();

    this.raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _backdrop() {
    const geo = new THREE.SphereGeometry(30, 32, 20);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BACKDROP_VS,
      fragmentShader: BACKDROP_FS,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#ffe6cd') },
        mid: { value: new THREE.Color('#fbcdb4') },
        bottom: { value: new THREE.Color('#e8ab9c') },
      },
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0xffeada, 0xe7c2ab, 0.5);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff3e0, 2.0);
    key.position.set(3.6, 7.4, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(this.tier.shadow, this.tier.shadow);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 22;
    const s = 5.0;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.scene.add(key);
    this.key = key;

    const fill = new THREE.DirectionalLight(0xcfe0f7, 0.34);
    fill.position.set(-4.5, 3.2, -3.4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffcfae, 0.26);
    rim.position.set(-1.5, 2.0, -6.0);
    this.scene.add(rim);
  }

  _table() {
    const group = new THREE.Group();

    // floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      new THREE.MeshStandardMaterial({ color: 0xe7bda9, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.4;
    floor.receiveShadow = true;
    group.add(floor);

    // table top with softly bevelled edges
    const shape = roundedRectShape(10.4, 9.0, 1.1);
    const top = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.44, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 4, curveSegments: 14,
      }),
      new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xffffff, roughness: 0.72, metalness: 0 })
    );
    top.rotation.x = Math.PI / 2;
    top.position.y = -0.16;      // its surface lands at y = -0.07, under the mat
    top.receiveShadow = true;
    top.castShadow = false;      // it is the ground here; casting only causes acne
    group.add(top);

    // cutting mat: the child's working square
    const matShape = roundedRectShape(4.1, 4.4, 0.42);
    const mat = new THREE.Mesh(
      new THREE.ExtrudeGeometry(matShape, {
        depth: 0.045, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 12,
      }),
      new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.9, metalness: 0 })
    );
    mat.rotation.x = Math.PI / 2;
    mat.position.y = -0.02;
    mat.receiveShadow = true;
    mat.castShadow = false;
    group.add(mat);

    // back wall, so the finished garment reads against something soft
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 16),
      new THREE.MeshStandardMaterial({ color: 0xffe8d6, roughness: 1 })
    );
    wall.position.set(0, 5.4, -7.6);
    wall.receiveShadow = true;
    group.add(wall);

    const skirting = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xfff3e6, roughness: 0.85 })
    );
    skirting.position.set(0, -1.15, -7.5);
    group.add(skirting);

    this.scene.add(group);
    this.tableGroup = group;
    this.tableTopY = 0.0;

    this._rack();
  }

  /** A wall rail where finished pieces are hung up. */
  _rack() {
    const g = new THREE.Group();
    g.position.set(0, 3.45, -6.8);

    const wood = new THREE.MeshStandardMaterial({ color: 0xd9a877, roughness: 0.65 });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 8.6, 14), wood);
    rail.rotation.z = Math.PI / 2;
    rail.castShadow = true;
    g.add(rail);
    for (const x of [-4.1, 4.1]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.1), wood);
      bracket.position.set(x, 0, -0.5);
      g.add(bracket);
    }

    this.scene.add(g);
    this.rack = g;
    this.rackSlots = [];
  }

  /**
   * Hangs a finished garment on the wall rail: a soft, puffed silhouette
   * cut from the same fabric.
   */
  hangOnRack(outline, bounds, texture) {
    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09,
      bevelSegments: 3, curveSegments: 6,
    });
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - bounds.minX) / w;
      uv[i * 2 + 1] = (pos.getY(i) - bounds.minY) / h;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.center();

    const piece = new THREE.Group();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: texture, roughness: 0.92, metalness: 0,
    }));
    mesh.castShadow = true;
    piece.add(mesh);

    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.028, 8, 20, Math.PI * 1.3),
      new THREE.MeshStandardMaterial({ color: 0xe6ecf2, metalness: 0.8, roughness: 0.3 })
    );
    hook.position.y = h * 0.5 + 0.12;
    hook.rotation.z = Math.PI * 0.35;
    piece.add(hook);

    const scale = 0.62;
    const slot = (this.rackCount = (this.rackCount || 0) + 1) % 7;
    piece.position.set(-3.3 + slot * 1.1, -h * 0.5 * scale - 0.2, 0.06);
    piece.rotation.z = (Math.random() - 0.5) * 0.12;
    piece.scale.setScalar(scale);

    if (this.rackSlots[slot]) {
      this.rack.remove(this.rackSlots[slot]);
      this.rackSlots[slot].traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      });
    }
    this.rack.add(piece);
    this.rackSlots[slot] = piece;
    return piece;
  }

  _bokeh() {
    const n = 90;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    this.bokehSeed = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 11 + Math.random() * 10;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 2.6 + Math.random() * 7.5;
      pos[i * 3 + 2] = Math.sin(a) * r - 4;
      size[i] = 0.5 + Math.random() * 1.6;
      this.bokehSeed.push({ y0: pos[i * 3 + 1], sp: 0.1 + Math.random() * 0.25, ph: Math.random() * 9 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.PointsMaterial({
      map: makeSoftSprite('#fff6e4'),
      size: 1.0,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffe6c8,
    });
    this.bokeh = new THREE.Points(geo, mat);
    this.bokeh.frustumCulled = false;
    this.scene.add(this.bokeh);
  }

  _composer() {
    if (!this.tier.bloom) { this.composer = null; return; }
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.72, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /**
   * Aims at `centre` from direction `dir` and backs off exactly far enough
   * that every point in `pts` stays inside the frustum. Fitting real points
   * rather than a bounding sphere is what makes portrait and landscape both
   * come out well composed — a flat cloth seen from above and a tall garment
   * seen from the front need very different distances.
   */
  fit(centre, pts, dir, snap = false) {
    this.frameCentre.copy(centre);
    this.framePts = pts;
    if (dir) this.frameDir.copy(dir).normalize();
    if (snap) this.camSnap = true;
  }

  _applyFrame(dt) {
    const aspect = this.camera.aspect;
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const tanH = tanV * aspect;

    const f = this._fF.copy(this.frameDir);
    const right = this._fR.crossVectors(this._worldUp, f);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = this._fU.crossVectors(f, right).normalize();

    let d = 1.2;
    const pts = this.framePts;
    if (pts) {
      for (let i = 0; i < pts.length; i++) {
        const e = this._fE.copy(pts[i]).sub(this.frameCentre);
        const z = e.dot(f);
        d = Math.max(d, z + Math.abs(e.dot(right)) / tanH, z + Math.abs(e.dot(up)) / tanV);
      }
    }

    this.camGoalTarget.copy(this.frameCentre);
    this.camGoalPos.copy(f).multiplyScalar(d).add(this.camGoalTarget);

    const k = this.camSnap ? 1 : 1 - Math.exp(-2.6 * dt);
    this.camera.position.lerp(this.camGoalPos, k);
    this.camTarget.lerp(this.camGoalTarget, k);
    this.camera.lookAt(this.camTarget);
    this.camSnap = false;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = h > w ? 46 : 40;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.tier.maxPR));
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
  }

  /** Where does a screen point land on the horizontal plane at height y? */
  pointerToPlane(ndc, y, out) {
    this.raycaster.setFromCamera(ndc, this.camera);
    this._plane.constant = -y;
    const hit = this.raycaster.ray.intersectPlane(this._plane, out);
    return hit ? out : null;
  }

  update(dt, t) {
    this._applyFrame(dt);
    const p = this.bokeh.geometry.attributes.position;
    for (let i = 0; i < this.bokehSeed.length; i++) {
      const s = this.bokehSeed[i];
      p.array[i * 3 + 1] = s.y0 + Math.sin(t * s.sp + s.ph) * 1.3;
      p.array[i * 3] += Math.sin(t * 0.13 + s.ph) * 0.0028;
    }
    p.needsUpdate = true;
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

export { clamp };
