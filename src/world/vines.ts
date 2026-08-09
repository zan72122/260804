/**
 * The cranberry vines: low woody runners with small leathery leaves.
 *
 * One InstancedMesh of a procedurally built clump. Nothing here is a flat
 * card — the strands are tapered three-sided tubes so they still read as
 * plants from the low, near-the-water camera. Sway happens in the vertex
 * shader and gets stronger once the bog is flooded, which is what sells
 * "these plants are underwater now".
 */

import * as THREE from 'three';
import { bogInset, floorHeight, type FieldVariant } from './layout';
import { clamp } from '../core/math';

/** A tapered 3-sided strand following a gentle arc. */
function pushStrand(
  verts: number[],
  idx: number[],
  origin: THREE.Vector3,
  dir: THREE.Vector2,
  length: number,
  rise: number,
  radius: number,
  segs: number,
): void {
  const base = verts.length / 3;
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(-dir.y, 0, dir.x).normalize();
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const px = origin.x + dir.x * length * t;
    const pz = origin.z + dir.y * length * t;
    const py = origin.y + rise * Math.sin(t * Math.PI * 0.82) - t * t * rise * 0.25;
    const r = radius * (1 - t * 0.72);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + t * 0.6;
      const ox = Math.cos(a) * r;
      const oy = Math.sin(a) * r;
      verts.push(
        px + side.x * ox + up.x * oy,
        py + side.y * ox + up.y * oy,
        pz + side.z * ox + up.z * oy,
      );
    }
  }
  for (let s = 0; s < segs; s++) {
    const a = base + s * 3;
    const b = base + (s + 1) * 3;
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      idx.push(a + k, b + k, a + k2);
      idx.push(a + k2, b + k, b + k2);
    }
  }
}

/** A small leaf: a thin four-sided lozenge with real thickness. */
function pushLeaf(
  verts: number[],
  idx: number[],
  at: THREE.Vector3,
  dir: THREE.Vector2,
  size: number,
  tilt: number,
): void {
  const base = verts.length / 3;
  const f = new THREE.Vector3(dir.x, Math.sin(tilt), dir.y).normalize();
  const s = new THREE.Vector3(-dir.y, 0, dir.x).normalize().multiplyScalar(size * 0.34);
  const n = new THREE.Vector3().crossVectors(f, s).normalize().multiplyScalar(size * 0.05);
  const tip = f.clone().multiplyScalar(size);
  const mid = f.clone().multiplyScalar(size * 0.45);
  const pts = [
    at.clone(),
    at.clone().add(mid).add(s).add(n),
    at.clone().add(tip),
    at.clone().add(mid).sub(s).add(n),
    at.clone().add(mid).add(s).sub(n),
    at.clone().add(mid).sub(s).sub(n),
  ];
  pts.forEach((p) => verts.push(p.x, p.y, p.z));
  idx.push(base, base + 1, base + 2, base + 2, base + 3, base);
  idx.push(base, base + 2, base + 4, base + 2, base + 5, base);
}

function buildClumpGeometry(seed: number): THREE.BufferGeometry {
  const verts: number[] = [];
  const idx: number[] = [];
  let s = seed;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const strands = 6;
  for (let i = 0; i < strands; i++) {
    const a = (i / strands) * Math.PI * 2 + rand() * 0.9;
    const dir = new THREE.Vector2(Math.cos(a), Math.sin(a));
    const len = 0.34 + rand() * 0.26;
    pushStrand(
      verts,
      idx,
      new THREE.Vector3(0, 0.02, 0),
      dir,
      len,
      0.13 + rand() * 0.12,
      0.019 + rand() * 0.011,
      2,
    );
    // two leaves per strand
    for (let l = 0; l < 2; l++) {
      const t = 0.4 + l * 0.38;
      pushLeaf(
        verts,
        idx,
        new THREE.Vector3(dir.x * len * t, 0.05 + 0.12 * Math.sin(t * 2.4), dir.y * len * t),
        new THREE.Vector2(Math.cos(a + rand() * 1.4 - 0.7), Math.sin(a + rand() * 1.4 - 0.7)),
        0.085 + rand() * 0.05,
        0.5 + rand() * 0.7,
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export class Vines {
  readonly mesh: THREE.InstancedMesh;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly geo: THREE.BufferGeometry;
  private readonly uniforms = {
    uTime: { value: 0 },
    uSway: { value: 0.01 },
    uWet: { value: 0 },
  };

  /** Anchor points where berries hang, filled while scattering the clumps. */
  readonly anchors: THREE.Vector3[] = [];

  constructor(v: FieldVariant, count: number) {
    this.geo = buildClumpGeometry(v.seed ^ 0x9e37);
    this.mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.82,
      metalness: 0,
      vertexColors: false,
    });
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uSway = this.uniforms.uSway;
      shader.uniforms.uWet = this.uniforms.uWet;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uSway;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec3 iPos = instanceMatrix[3].xyz;
           float amt = uSway * smoothstep(-0.02, 0.34, transformed.y);
           transformed.x += sin(uTime * 1.25 + iPos.x * 0.8 + iPos.z * 0.35) * amt;
           transformed.z += cos(uTime * 0.97 + iPos.z * 0.72 - iPos.x * 0.3) * amt * 0.8;
           transformed.y += sin(uTime * 1.7 + iPos.x * 1.1) * amt * 0.25;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWet;')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.42, 0.58, 0.58), uWet);`,
        );
    };

    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, count);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'vines';

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    const r = v.rng;

    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 12) {
      guard++;
      const x = r.range(-v.halfX, v.halfX);
      const z = r.range(-v.halfZ, v.halfZ);
      if (bogInset(v, x, z) < 0.5) continue;
      const y = floorHeight(v, x, z);
      p.set(x, y, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.range(0, Math.PI * 2));
      const sc = r.range(1.35, 2.15);
      scl.set(sc, r.range(0.8, 1.25) * sc, sc);
      m.compose(p, q, scl);
      this.mesh.setMatrixAt(placed, m);

      // green through to russet — autumn vines are never one colour
      const t = r.bell();
      col.setHSL(0.22 - t * 0.15, 0.42 + t * 0.2, 0.17 + t * 0.09);
      this.mesh.setColorAt(placed, col);

      // berry anchor sites live just above the runners
      if (placed % 1 === 0) {
        this.anchors.push(
          new THREE.Vector3(
            x + r.range(-0.4, 0.4),
            y + r.range(0.12, 0.34),
            z + r.range(-0.4, 0.4),
          ),
        );
      }
      placed++;
    }
    this.mesh.count = placed;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number, flood: number): void {
    this.uniforms.uTime.value += dt;
    // dry vines are stiff; submerged vines drift
    this.uniforms.uSway.value = 0.012 + clamp(flood, 0, 1) * 0.055;
    this.uniforms.uWet.value = clamp(flood * 1.15, 0, 1);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
