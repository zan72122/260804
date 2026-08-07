import * as THREE from 'three';
import { textures } from '../core/textures';
import type { CableDef } from '../core/content';

/**
 * A single continuous tube whose spine is rewritten every frame.
 *
 * The spine is supplied as a fixed-length array of world-space points, so the
 * ship-board run, the overboard catenary and the laid seabed section are all
 * literally the same mesh: one cable, tank to seabed, never a cut.
 *
 * Per-ring `aM` carries the *material* arc length measured from the anchored
 * (already laid) end. Because that end never moves, the helical marker stripe
 * printed from `aM` slides aft through the rollers exactly as fast as cable is
 * paid out - which is what sells the motion.
 */
export class TubeStrand {
  readonly rings: number;
  readonly radial: number;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  private posAttr: THREE.BufferAttribute;
  private nrmAttr: THREE.BufferAttribute;
  private mAttr: THREE.BufferAttribute;
  private radius: number;

  // scratch
  private tangents: THREE.Vector3[] = [];
  private normals: THREE.Vector3[] = [];
  private binormals: THREE.Vector3[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  uniforms: {
    uStripe: { value: THREE.Color };
    uGlow: { value: THREE.Color };
    uPulse: { value: number };
    uPulseHead: { value: number };
    uTotal: { value: number };
  };

  constructor(rings: number, radial: number, radius: number, def: CableDef) {
    this.rings = rings;
    this.radial = radial;
    this.radius = radius;
    const tex = textures();

    const count = rings * radial;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const aM = new Float32Array(count);
    // own "around the cable" coordinate: three's per-map uv varyings are named
    // per texture slot, so relying on a generic vUv in the fragment stage is
    // not portable
    const aRound = new Float32Array(count);
    const indices: number[] = [];
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial;
        const a = i * radial + j;
        const b = i * radial + j2;
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + j2;
        indices.push(a, c, b, b, c, d);
      }
    }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < radial; j++) {
        const k = i * radial + j;
        uvs[k * 2] = j / radial;
        uvs[k * 2 + 1] = 0;
        aRound[k] = j / radial;
      }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('aM', new THREE.BufferAttribute(aM, 1));
    geo.setAttribute('aRound', new THREE.BufferAttribute(aRound, 1));
    geo.setIndex(indices);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geometry = geo;
    this.posAttr = geo.attributes.position as THREE.BufferAttribute;
    this.nrmAttr = geo.attributes.normal as THREE.BufferAttribute;
    this.mAttr = geo.attributes.aM as THREE.BufferAttribute;
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.nrmAttr.setUsage(THREE.DynamicDrawUsage);
    this.mAttr.setUsage(THREE.DynamicDrawUsage);

    const jacket = tex.cableJacket.clone();
    jacket.needsUpdate = true;
    const nrm = tex.cableNormal.clone();
    nrm.needsUpdate = true;
    nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;

    this.uniforms = {
      uStripe: { value: new THREE.Color(def.stripe) },
      uGlow: { value: new THREE.Color(def.glow) },
      uPulse: { value: 0 },
      uPulseHead: { value: 0 },
      uTotal: { value: 1 },
    };

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.jacket),
      map: jacket,
      normalMap: nrm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.42,
      metalness: 0.18,
      emissive: new THREE.Color(def.glow),
      emissiveIntensity: 0,
    });

    const U = this.uniforms;
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uStripe = U.uStripe;
      shader.uniforms.uGlow = U.uGlow;
      shader.uniforms.uPulse = U.uPulse;
      shader.uniforms.uPulseHead = U.uPulseHead;
      shader.uniforms.uTotal = U.uTotal;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aM;
           attribute float aRound;
           varying float vM;
           varying float vRound;`,
        )
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vM = aM;\n vRound = aRound;`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uStripe;
           uniform vec3 uGlow;
           uniform float uPulse;
           uniform float uPulseHead;
           uniform float uTotal;
           varying float vM;
           varying float vRound;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // One marker stripe on a long helix (about 10 m of pitch). A tight
           // helix aliases into a flat wash of colour as soon as the cable is
           // more than a few metres away, which loses both the jacket and the
           // sense of motion.
           float band = fract(vRound + vM * 0.1);
           float stripe = smoothstep(0.115, 0.045, abs(band - 0.5));
           diffuseColor.rgb = mix(diffuseColor.rgb, uStripe * 0.8, stripe * 0.88);
           // metre marks: a thin light ring every few metres reads as "length"
           float mk = smoothstep(0.955, 0.995, fract(vM * 0.2));
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.66, 0.62), mk * 0.45);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           if (uPulse > 0.0) {
             float d = abs(vM - uPulseHead * uTotal);
             float head = exp(-d * d / 90.0);
             float base = 0.16;
             totalEmissiveRadiance += uGlow * uPulse * (base + head * 2.4);
           }`,
        );
    };

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    for (let i = 0; i < rings; i++) {
      this.tangents.push(new THREE.Vector3(0, 0, 1));
      this.normals.push(new THREE.Vector3(0, 1, 0));
      this.binormals.push(new THREE.Vector3(1, 0, 0));
    }
  }

  setColors(def: CableDef) {
    this.material.color.set(def.jacket);
    this.material.emissive.set(def.glow);
    this.uniforms.uStripe.value.set(def.stripe);
    this.uniforms.uGlow.value.set(def.glow);
    this.material.needsUpdate = true;
  }

  setRadius(r: number) {
    this.radius = r;
  }

  /**
   * @param spine  exactly `rings` world-space points, ordered from the anchored
   *               end (island / already-laid) towards the free end (cable tank)
   * @param taper  optional per-ring radius multiplier
   */
  update(spine: THREE.Vector3[], taper?: (i: number) => number) {
    const N = this.rings;
    const R = this.radial;
    const T = this.tangents;
    const Nm = this.normals;
    const B = this.binormals;

    // --- tangents (with fallback for degenerate/duplicated points) ---------
    for (let i = 0; i < N; i++) {
      const a = spine[Math.max(0, i - 1)];
      const b = spine[Math.min(N - 1, i + 1)];
      const t = T[i].subVectors(b, a);
      if (t.lengthSq() < 1e-10) {
        t.copy(i > 0 ? T[i - 1] : this.tmpA.set(1, 0, 0));
        if (t.lengthSq() < 1e-10) t.set(1, 0, 0);
      }
      t.normalize();
    }

    // --- parallel transport frames ---------------------------------------
    const t0 = T[0];
    const up = Math.abs(t0.y) > 0.9 ? this.tmpA.set(1, 0, 0) : this.tmpA.set(0, 1, 0);
    Nm[0].copy(up).cross(t0).normalize();
    if (Nm[0].lengthSq() < 1e-8) Nm[0].set(1, 0, 0);
    B[0].copy(t0).cross(Nm[0]).normalize();
    for (let i = 1; i < N; i++) {
      const prev = T[i - 1];
      const cur = T[i];
      const axis = this.tmpB.crossVectors(prev, cur);
      const len = axis.length();
      if (len < 1e-7) {
        Nm[i].copy(Nm[i - 1]);
      } else {
        axis.multiplyScalar(1 / len);
        const angle = Math.acos(Math.min(1, Math.max(-1, prev.dot(cur))));
        this.tmpQ.setFromAxisAngle(axis, angle);
        Nm[i].copy(Nm[i - 1]).applyQuaternion(this.tmpQ);
      }
      // re-orthogonalise against drift
      Nm[i].addScaledVector(cur, -Nm[i].dot(cur)).normalize();
      B[i].copy(cur).cross(Nm[i]).normalize();
    }

    // --- ring extrusion + material arc length ------------------------------
    const pos = this.posAttr.array as Float32Array;
    const nrm = this.nrmAttr.array as Float32Array;
    const marr = this.mAttr.array as Float32Array;
    let m = 0;
    for (let i = 0; i < N; i++) {
      if (i > 0) m += spine[i].distanceTo(spine[i - 1]);
      const r = this.radius * (taper ? taper(i) : 1);
      const p = spine[i];
      const nx = Nm[i];
      const bx = B[i];
      for (let j = 0; j < R; j++) {
        const a = (j / R) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const ox = nx.x * ca + bx.x * sa;
        const oy = nx.y * ca + bx.y * sa;
        const oz = nx.z * ca + bx.z * sa;
        const k = (i * R + j) * 3;
        pos[k] = p.x + ox * r;
        pos[k + 1] = p.y + oy * r;
        pos[k + 2] = p.z + oz * r;
        nrm[k] = ox;
        nrm[k + 1] = oy;
        nrm[k + 2] = oz;
        marr[i * R + j] = m;
      }
    }
    this.uniforms.uTotal.value = Math.max(1, m);
    this.posAttr.needsUpdate = true;
    this.nrmAttr.needsUpdate = true;
    this.mAttr.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** The bright termination head the child drags in the prep phase. */
export function buildCableTip(def: CableDef, accent: number) {
  const g = new THREE.Group();
  const steel = textures().steel;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.24, 1.5, 14),
    new THREE.MeshStandardMaterial({ map: steel, color: 0xd7dce0, roughness: 0.35, metalness: 0.85 }),
  );
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.35, emissive: accent, emissiveIntensity: 0.5 }),
  );
  collar.rotation.z = Math.PI / 2;
  collar.position.x = 0.55;
  g.add(collar);
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({
      color: def.glow,
      emissive: def.glow,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    }),
  );
  nose.position.x = 0.82;
  g.add(nose);
  // A billboarded halo so a four-year-old can see what to grab without being
  // told. It is the only "game-y" element on the deck, and it earns its place.
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textures().soft,
      color: def.glow,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.75,
    }),
  );
  halo.scale.setScalar(4.5);
  halo.position.set(0.6, 0, 0);
  g.add(halo);
  g.scale.setScalar(1.5);
  return { group: g, nose, halo };
}
