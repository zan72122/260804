import * as THREE from 'three';
import { textures } from '../core/textures';
import type { DecorDef, RovDef } from '../core/content';
import { clamp01 } from '../core/util';

/** Additive cone that stands in for the light shaft in suspended water. */
function lightCone(color: number, length: number, spread: number) {
  const g = new THREE.ConeGeometry(spread, length, 22, 1, true);
  g.translate(0, -length / 2, 0);
  // apex at the origin, base towards -Z: the lamp's forward axis
  g.rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vPos;
      void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      varying vec2 vUv; varying vec3 vPos;
      void main() {
        // uv.y is 1 at the apex, so the shaft is brightest at the lamp and
        // dissolves into the water further out
        float along = clamp(vUv.y, 0.0, 1.0);
        float core = pow(along, 1.35) * (0.35 + 0.65 * along);
        float shimmer = 0.86 + 0.14 * sin(uTime * 2.1 + vPos.z * 0.9);
        float a = core * uOpacity * shimmer * 0.26;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, mat);
}

export interface RovBuild {
  group: THREE.Group;
  lamps: THREE.Mesh[];
  cones: THREE.Mesh[];
  spots: THREE.SpotLight[];
  fill: THREE.PointLight;
  thrusters: THREE.Mesh[];
  /** 0..1 lamp intensity, ramped by the game */
  setLights: (v: number, time: number) => void;
  thrusterPorts: THREE.Vector3[];
}

export function buildRov(def: RovDef, decor: DecorDef): RovBuild {
  const tex = textures();
  const group = new THREE.Group();
  const lamps: THREE.Mesh[] = [];
  const cones: THREE.Mesh[] = [];
  const spots: THREE.SpotLight[] = [];
  const thrusters: THREE.Mesh[] = [];
  const thrusterPorts: THREE.Vector3[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    map: tex.steel,
    normalMap: tex.steelNormal,
    color: def.body,
    roughness: 0.52,
    metalness: 0.35,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    map: tex.steel,
    color: def.frame,
    roughness: 0.66,
    metalness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: decor.accent,
    roughness: 0.45,
    metalness: 0.3,
    emissive: decor.accent,
    emissiveIntensity: 0.12,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0d1a20,
    roughness: 0.08,
    metalness: 0.4,
    emissive: 0x0b1a22,
  });

  // ROV overall size ~2.6 m long: a real work-class vehicle.
  if (def.shape === 'boxy') {
    // tubular frame
    const fw = 1.5;
    const fh = 1.35;
    const fl = 2.5;
    const barR = 0.055;
    const bar = (x: number, y: number, z: number, len: number, axis: 'x' | 'y' | 'z') => {
      const g = new THREE.CylinderGeometry(barR, barR, len, 8);
      const m = new THREE.Mesh(g, frameMat);
      if (axis === 'x') m.rotation.z = Math.PI / 2;
      if (axis === 'z') m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
      group.add(m);
    };
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) bar(sx * fw / 2, sy * fh / 2, 0, fl, 'z');
    for (const sz of [-1, 1])
      for (const sy of [-1, 1]) bar(0, sy * fh / 2, sz * fl / 2, fw, 'x');
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) bar(sx * fw / 2, 0, sz * fl / 2, fh, 'y');

    // buoyancy block on top
    const buoy = new THREE.Mesh(new THREE.BoxGeometry(fw * 0.95, 0.52, fl * 0.86), bodyMat);
    buoy.position.y = fh / 2 - 0.16;
    group.add(buoy);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(fw * 0.97, 0.14, fl * 0.87), accentMat);
    stripe.position.y = fh / 2 - 0.16;
    group.add(stripe);

    // pressure housings
    for (const sx of [-1, 1]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 16), frameMat);
      can.rotation.x = Math.PI / 2;
      can.position.set(sx * 0.5, 0.05, -0.1);
      group.add(can);
    }
    // camera dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glassMat);
    dome.position.set(0, 0.22, -fl / 2 + 0.08);
    group.add(dome);
    // skids
    for (const sx of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, fl * 0.95), frameMat);
      skid.position.set(sx * 0.62, -fh / 2 - 0.06, 0);
      group.add(skid);
    }
    // manipulator arm
    {
      const arm = new THREE.Group();
      arm.position.set(0.42, -0.42, -1.0);
      const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.7, 10), accentMat);
      a1.rotation.z = -0.8;
      a1.position.set(0.2, -0.1, 0);
      arm.add(a1);
      const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 10), frameMat);
      a2.rotation.z = -0.2;
      a2.position.set(0.46, -0.42, -0.1);
      arm.add(a2);
      for (const s of [-1, 1]) {
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.05), frameMat);
        jaw.position.set(0.53, -0.7, s * 0.06);
        jaw.rotation.z = s * 0.2;
        arm.add(jaw);
      }
      group.add(arm);
    }
    // thrusters: 4 horizontal + 2 vertical
    const tp: [number, number, number, number][] = [
      [-0.72, -0.2, 0.95, 0],
      [0.72, -0.2, 0.95, 0],
      [-0.72, -0.2, -0.95, 0],
      [0.72, -0.2, -0.95, 0],
      [-0.6, 0.35, 0.2, 1],
      [0.6, 0.35, 0.2, 1],
    ];
    for (const [x, y, z, vert] of tp) {
      const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.26, 14, 1, true), frameMat);
      duct.material.side = THREE.DoubleSide;
      if (!vert) duct.rotation.x = Math.PI / 2;
      duct.position.set(x, y, z);
      group.add(duct);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.07), accentMat);
      prop.position.copy(duct.position);
      if (!vert) prop.rotation.x = Math.PI / 2;
      group.add(prop);
      thrusters.push(prop);
      thrusterPorts.push(new THREE.Vector3(x, y, z + (vert ? 0 : 0.2)));
    }
  } else {
    // torpedo-shaped survey ROV
    const hullGeo = new THREE.CapsuleGeometry(0.45, 1.6, 8, 20);
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    group.add(hull);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.3, 24), accentMat);
    band.rotation.x = Math.PI / 2;
    band.position.z = 0.2;
    group.add(band);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), glassMat);
    nose.position.z = -1.22;
    group.add(nose);
    // tail fins
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.5), frameMat);
      fin.position.z = 1.05;
      fin.rotation.z = (i / 4) * Math.PI * 2;
      fin.position.x = Math.sin((i / 4) * Math.PI * 2) * 0.45;
      fin.position.y = Math.cos((i / 4) * Math.PI * 2) * 0.45;
      group.add(fin);
    }
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.34, 18, 1, true), frameMat);
    duct.material.side = THREE.DoubleSide;
    duct.rotation.x = Math.PI / 2;
    duct.position.z = 1.32;
    group.add(duct);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.1), accentMat);
    prop.rotation.x = Math.PI / 2;
    prop.position.z = 1.32;
    group.add(prop);
    thrusters.push(prop);
    thrusterPorts.push(new THREE.Vector3(0, 0, 1.5));
    // side thrusters
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 12, 1, true), frameMat);
      st.material.side = THREE.DoubleSide;
      st.position.set(s * 0.5, -0.18, 0.55);
      group.add(st);
      thrusterPorts.push(new THREE.Vector3(s * 0.6, -0.18, 0.55));
    }
    // skid
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 1.5), frameMat);
    skid.position.y = -0.56;
    group.add(skid);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), frameMat);
      leg.position.set(s * 0.32, -0.4, 0);
      group.add(leg);
    }
  }

  // ---- lamps ---------------------------------------------------------------
  const lampPositions: THREE.Vector3[] =
    def.lampCount === 2
      ? [new THREE.Vector3(-0.62, 0.18, -1.05), new THREE.Vector3(0.62, 0.18, -1.05)]
      : [
          new THREE.Vector3(-0.5, 0.05, -1.0),
          new THREE.Vector3(0.5, 0.05, -1.0),
          new THREE.Vector3(0, 0.42, -0.85),
        ];

  const lensGeo = new THREE.CircleGeometry(0.15, 16);
  for (let i = 0; i < lampPositions.length; i++) {
    const p = lampPositions[i];
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.3, 14), frameMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.copy(p);
    group.add(housing);
    const lens = new THREE.Mesh(
      lensGeo,
      new THREE.MeshBasicMaterial({ color: decor.lamp, transparent: true, opacity: 0.15 }),
    );
    lens.position.copy(p).add(new THREE.Vector3(0, 0, -0.16));
    group.add(lens);
    lamps.push(lens);
    const cone = lightCone(decor.lamp, 15, 2.7);
    cone.position.copy(p);
    cone.rotation.x = 0.16;
    group.add(cone);
    cones.push(cone);
  }

  // Two real spotlights carry the actual illumination; the rest is fake volume.
  for (let i = 0; i < 2; i++) {
    const s = new THREE.SpotLight(decor.lamp, 0, 70, 0.6, 0.5, 1.7);
    const p = lampPositions[Math.min(i, lampPositions.length - 1)];
    s.position.copy(p);
    s.target.position.set(p.x * 1.4, p.y - 4.2, p.z - 9);
    group.add(s);
    group.add(s.target);
    spots.push(s);
  }
  const fill = new THREE.PointLight(decor.lamp, 0, 26, 1.6);
  fill.position.set(0, 0.2, -0.8);
  group.add(fill);

  // status beacon so the vehicle reads as "powered" even before lights on
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x54ff9e }),
  );
  beacon.position.set(0, 0.8, 0.6);
  group.add(beacon);

  const setLights = (v: number, time: number) => {
    const k = clamp01(v);
    for (const s of spots) s.intensity = k * 175;
    fill.intensity = k * 46;
    for (const l of lamps) {
      const m = l.material as THREE.MeshBasicMaterial;
      m.opacity = 0.12 + k * 0.88;
    }
    for (const c of cones) {
      const m = c.material as THREE.ShaderMaterial;
      m.uniforms.uOpacity.value = k;
      m.uniforms.uTime.value = time;
      c.visible = k > 0.01;
    }
    const bm = beacon.material as THREE.MeshBasicMaterial;
    bm.color.setHex(Math.sin(time * 3) > 0 ? 0x54ff9e : 0x1c5c36);
  };
  setLights(0, 0);

  return { group, lamps, cones, spots, fill, thrusters, setLights, thrusterPorts };
}

// ---------------------------------------------------------------------------
// Cable plough
// ---------------------------------------------------------------------------

export interface PloughBuild {
  group: THREE.Group;
  /** where the cable enters the plough's bellmouth (local) */
  inlet: THREE.Vector3;
  /** where the cable leaves, at the bottom of the trench (local) */
  outlet: THREE.Vector3;
  /** where sand is thrown (local) */
  shareTip: THREE.Vector3;
  share: THREE.Object3D;
  skids: THREE.Object3D[];
}

/**
 * A towed cable plough: heavy fabricated sled, twin skids, a depressor share
 * that opens the trench and a bellmouth that feeds the cable in behind it.
 * Roughly 8 m long, 4 m wide, 3.4 m tall - close to the real thing.
 */
export function buildPlough(decor: DecorDef): PloughBuild {
  const tex = textures();
  const group = new THREE.Group();
  const skids: THREE.Object3D[] = [];

  const steel = new THREE.MeshStandardMaterial({
    map: tex.steel,
    normalMap: tex.steelNormal,
    color: 0x8b939a,
    roughness: 0.68,
    metalness: 0.7,
  });
  // Chassis stays high-visibility subsea yellow; the chosen decoration only
  // shows up on the instrument pod and the tow eye.
  const painted = new THREE.MeshStandardMaterial({
    map: tex.hullPaint,
    normalMap: tex.hullNormal,
    color: 0xd8a12a,
    roughness: 0.72,
    metalness: 0.25,
  });
  const trim = new THREE.MeshStandardMaterial({
    map: tex.hullPaint,
    color: decor.accent,
    roughness: 0.6,
    metalness: 0.25,
  });
  const dark = new THREE.MeshStandardMaterial({ map: tex.steel, color: 0x3d4348, roughness: 0.8, metalness: 0.55 });
  const wear = new THREE.MeshStandardMaterial({ color: 0xb9bfc4, roughness: 0.32, metalness: 0.9 });

  // main beam / chassis (plough travels along -Z, i.e. forward is -Z)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 7.4), painted);
  beam.position.set(0, 1.35, 0);
  group.add(beam);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 6.4), steel);
    side.position.set(s * 1.6, 1.1, 0.2);
    group.add(side);
    // cross braces
    for (const z of [-2.4, 0, 2.4]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), steel);
      br.rotation.z = Math.PI / 2;
      br.position.set(0, 1.1, z);
      group.add(br);
    }
    // skids
    const skid = new THREE.Group();
    const flat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 6.2), dark);
    skid.add(flat);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 1.5), dark);
    toe.position.set(0, 0.28, -3.5);
    toe.rotation.x = -0.42;
    skid.add(toe);
    const wearStrip = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 6.2), wear);
    wearStrip.position.y = -0.13;
    skid.add(wearStrip);
    skid.position.set(s * 1.75, 0.16, 0);
    group.add(skid);
    skids.push(skid);
    // legs
    for (const z of [-2.2, 1.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.1, 0.5), steel);
      leg.position.set(s * 1.72, 0.75, z);
      group.add(leg);
    }
  }

  // depressor share: the wedge that opens the trench
  const share = new THREE.Group();
  {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.0, 2.3);
    bladeShape.lineTo(-0.9, 2.3);
    bladeShape.lineTo(-1.55, 0.55);
    bladeShape.lineTo(-0.7, -0.05);
    bladeShape.closePath();
    const geo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.34, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
    geo.rotateY(Math.PI / 2);
    geo.translate(-0.17, 0, 0);
    const blade = new THREE.Mesh(geo, steel);
    share.add(blade);
    // the cutting edge, polished by the sand
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.9), wear);
    edge.position.set(0, 0.12, -0.72);
    edge.rotation.x = 0.52;
    share.add(edge);
    // share wings that push the spoil aside into berms
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 2.2), dark);
      wing.position.set(s * 0.55, 0.55, 0.55);
      wing.rotation.y = -s * 0.42;
      share.add(wing);
    }
  }
  share.position.set(0, 0.05, -1.1);
  group.add(share);

  // cable bellmouth + depressor tube: cable enters high, exits into the trench
  {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.34, 1.1, 18, 1, true), dark);
    bell.material.side = THREE.DoubleSide;
    bell.position.set(0, 2.85, 2.9);
    bell.rotation.x = -0.72;
    group.add(bell);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 14, 1, true), steel);
    tube.material.side = THREE.DoubleSide;
    tube.position.set(0, 1.5, 1.3);
    tube.rotation.x = -0.62;
    group.add(tube);
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.0, 14, 1, true), dark);
    boot.material.side = THREE.DoubleSide;
    boot.position.set(0, 0.15, -0.05);
    boot.rotation.x = -0.25;
    group.add(boot);
  }

  // tow bridle
  {
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.6, 8), steel);
      arm.position.set(s * 1.0, 2.4, 4.0);
      arm.rotation.set(-0.5, 0, -s * 0.28);
      group.add(arm);
    }
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 18), trim);
    eye.position.set(0, 3.3, 5.5);
    eye.rotation.y = Math.PI / 2;
    group.add(eye);
  }

  // instrument pod + a small work light so the plough is legible in the dark
  {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.2), trim);
    pod.position.set(0, 2.5, 1.0);
    group.add(pod);
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 12),
      new THREE.MeshBasicMaterial({ color: decor.lamp }),
    );
    lamp.position.set(0, 2.4, -1.65);
    lamp.rotation.y = Math.PI;
    group.add(lamp);
    // One lamp, sat over the share and reaching both ways: forward onto the
    // cutting edge and aft into the open trench. Every extra point light costs
    // a loop iteration on every lit pixel, which mobile GPUs feel.
    const work = new THREE.PointLight(0xffe6bd, 105, 30, 1.6);
    work.position.set(0, 2.4, 0.6);
    group.add(work);
    for (const s2 of [-1, 1]) {
      const aftLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 12),
        new THREE.MeshBasicMaterial({ color: decor.lamp }),
      );
      aftLens.position.set(s2 * 0.7, 2.1, 3.3);
      group.add(aftLens);
    }
    for (const s of [-1, 1]) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: s > 0 ? 0x54ff9e : 0xffb04a }),
      );
      marker.position.set(s * 1.8, 2.0, 3.0);
      group.add(marker);
    }
  }

  return {
    group,
    inlet: new THREE.Vector3(0, 3.3, 3.3),
    outlet: new THREE.Vector3(0, -0.35, -0.4),
    shareTip: new THREE.Vector3(0, -0.4, -1.9),
    share,
    skids,
  };
}

/** Soft dark ellipse that keeps vehicles visually planted on the seabed. */
export function contactShadow(radius = 3) {
  const g = new THREE.CircleGeometry(radius, 24);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.5 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uOpacity; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.25, 1.0, d)) * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 2;
  return mesh;
}
