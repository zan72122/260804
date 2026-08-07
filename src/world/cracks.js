// Cracks that run across the outer mould.
//
// A crack is grown in (theta, height) surface space and then lifted onto the
// real mould surface as a thin ribbon, so it hugs the curvature instead of
// floating.  A `uGrow` uniform runs every branch outward at once, and the
// leading tip glows: the casting inside is still hot, and that is the first
// hint of what is about to come out.

import * as THREE from '../core/three.js';
import { moldSurfaceR, moldHeight } from './profiles.js';
import { TAU, clamp01, makeRng, lerp } from '../core/util.js';

const VERT = `
attribute float aT;
attribute float aW;
varying float vT;
varying float vW;
void main(){
  vT = aT; vW = aW;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const FRAG = `
uniform float uGrow;
uniform float uHeat;
varying float vT;
varying float vW;
void main(){
  if ( vT > uGrow ) discard;
  float edge = 1.0 - abs( vW );
  float dark = smoothstep( 0.0, 0.55, edge );
  // the newest millimetre of the crack still shows the heat behind it
  float tip = smoothstep( uGrow - 0.10, uGrow, vT ) * uHeat;
  vec3 col = mix( vec3( 0.035, 0.026, 0.020 ), vec3( 1.0, 0.46, 0.13 ), tip * 0.9 );
  gl_FragColor = vec4( col, dark );
  #include <colorspace_fragment>
}`;

export class CrackField {
  constructor(parent, shape) {
    this.shape = shape;
    this.H = moldHeight(shape);
    this.parent = parent;
    this.groups = [];
  }

  /**
   * Grow a new crack star centred on (theta, u).
   * @returns {{mesh:THREE.Mesh, uniforms:object}}
   */
  add(theta, u, { branches = 4, length = 0.42, seed = Math.random() * 1e6, width = 0.028 } = {}) {
    const rng = makeRng(seed | 0);
    const pos = [], tArr = [], wArr = [], idx = [];
    const S = this.shape, H = this.H;

    const surface = (th, uu, out) => {
      const uc = clamp01(uu);
      const r = moldSurfaceR(S, uc, th) + 0.010;
      out.set(Math.cos(th) * r, uc * H, Math.sin(th) * r);
      return out;
    };

    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    const dir = new THREE.Vector3(), nrm = new THREE.Vector3(), side = new THREE.Vector3();

    const emitBranch = (th0, u0, ang, len, w0, depth) => {
      const STEPS = 9;
      const pts = [];
      let th = th0, uu = u0, a = ang;
      for (let i = 0; i <= STEPS; i++) {
        pts.push([th, uu]);
        a += (rng() - 0.5) * 0.85;
        const step = len / STEPS;
        th += Math.cos(a) * step * 1.7;   // theta space is "wider" than height
        uu += Math.sin(a) * step;
        if (uu < 0.02 || uu > 0.99) a = -a;
        uu = clamp01(uu);
      }
      const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        surface(pts[i][0], pts[i][1], pA);
        const iP = Math.max(0, i - 1), iN = Math.min(pts.length - 1, i + 1);
        surface(pts[iP][0], pts[iP][1], pB);
        surface(pts[iN][0], pts[iN][1], pC);
        dir.subVectors(pC, pB);
        if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0);
        dir.normalize();
        nrm.set(Math.cos(pts[i][0]), 0.25, Math.sin(pts[i][0])).normalize();
        side.crossVectors(dir, nrm).normalize().multiplyScalar(w0 * (1 - t * 0.72) * 0.5);
        for (const s of [1, -1]) {
          pos.push(pA.x + side.x * s, pA.y + side.y * s, pA.z + side.z * s);
          tArr.push(t); wArr.push(s);
        }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a0 = base + i * 2;
        idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
      }
      // side shoots, so the crack looks like it is tearing rather than drawn
      if (depth > 0) {
        for (let k = 0; k < 2; k++) {
          const i = 2 + Math.floor(rng() * (pts.length - 4));
          emitBranch(pts[i][0], pts[i][1], ang + (rng() - 0.5) * 2.4,
            len * (0.35 + rng() * 0.3), w0 * 0.6, depth - 1);
        }
      }
    };

    for (let b = 0; b < branches; b++) {
      const a = (b / branches) * TAU + rng() * 0.9;
      emitBranch(theta, u, a, length * (0.7 + rng() * 0.6), width, 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(tArr, 1));
    geo.setAttribute('aW', new THREE.Float32BufferAttribute(wArr, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();

    const uniforms = { uGrow: { value: 0 }, uHeat: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    this.parent.add(mesh);
    const rec = { mesh, uniforms, grow: 0 };
    this.groups.push(rec);
    return rec;
  }

  update(dt, speed = 2.4) {
    for (const g of this.groups) {
      if (g.grow < 1) {
        g.grow = Math.min(1, g.grow + dt * speed);
        g.uniforms.uGrow.value = g.grow;
      }
    }
  }

  setHeat(h) { for (const g of this.groups) g.uniforms.uHeat.value = h; }

  /** the cracks live on the shell -- once it is gone they must go too */
  hide() { for (const g of this.groups) g.mesh.visible = false; }

  clear() {
    for (const g of this.groups) {
      this.parent.remove(g.mesh);
      g.mesh.geometry.dispose(); g.mesh.material.dispose();
    }
    this.groups.length = 0;
  }
}
