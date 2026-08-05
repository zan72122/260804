// The plaza above ground: quiet and empty at dusk, transformed into a night
// water show at the finale. Near (basin) / mid (lamps, benches, trees) /
// far (building silhouettes, sky dome) layers give depth.
import * as THREE from 'three';
import { tileTex, concreteTex, glowSprite, causticsTex } from './textures.js';

export const POOL_Y = 0.16;
export const POOL_R = 3.8;

export function buildPlaza() {
  const g = new THREE.Group();
  const parts = {};

  // ---------- sky dome ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uNight: { value: 0 } },
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uNight;
      varying vec3 vP;
      void main(){
        float h = clamp(normalize(vP).y, 0.0, 1.0);
        vec3 duskTop = vec3(0.10,0.14,0.34);
        vec3 duskHor = vec3(0.86,0.52,0.28);
        vec3 nightTop = vec3(0.012,0.02,0.06);
        vec3 nightHor = vec3(0.05,0.09,0.18);
        vec3 dusk  = mix(duskHor, duskTop, pow(h, 0.55));
        vec3 night = mix(nightHor, nightTop, pow(h, 0.6));
        gl_FragColor = vec4(mix(dusk, night, uNight), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), skyMat);
  g.add(sky);
  parts.skyMat = skyMat;

  // stars (fade in at night)
  const starGeo = new THREE.BufferGeometry();
  const N = 260;
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.46 + 0.06;
    const r = 55;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
    sp[i * 3 + 1] = Math.sin(e) * r;
    sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 0.28, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  g.add(stars);
  parts.starMat = starMat;

  // moon
  const moon = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xf5f0dc, transparent: true, opacity: 0 }));
  moon.position.set(-26, 26, -42);
  moon.lookAt(0, 0, 0);
  g.add(moon);
  parts.moonMat = moon.material;

  // ---------- ground ----------
  const groundMat = new THREE.MeshStandardMaterial({
    map: tileTex(), roughness: 0.4, metalness: 0.05,
  });
  groundMat.map.repeat.set(9, 9);
  // ring with a hole under the pool so mirrored jet particles read as a
  // deep reflection instead of being depth-culled by the ground plane
  const ground = new THREE.Mesh(new THREE.RingGeometry(POOL_R + 0.02, 34, 48, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);
  parts.groundMat = groundMat;
  // dark shaft below the pool (catches stray sightlines into the "depths")
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(POOL_R + 0.06, POOL_R + 0.06, 8, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x020608, side: THREE.BackSide }));
  shaft.position.y = -4 + POOL_Y;
  g.add(shaft);
  const shaftFloor = new THREE.Mesh(new THREE.CircleGeometry(POOL_R + 0.06, 32),
    new THREE.MeshBasicMaterial({ color: 0x010304 }));
  shaftFloor.rotation.x = -Math.PI / 2;
  shaftFloor.position.y = -7.8 + POOL_Y;
  g.add(shaftFloor);

  // ---------- fountain basin (near layer) ----------
  const stoneMat = new THREE.MeshStandardMaterial({ map: concreteTex('#7a7468'), roughness: 0.8 });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(POOL_R + 0.55, POOL_R + 0.7, 0.55, 48, 1, true), stoneMat);
  wall.position.y = 0.275;
  g.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(POOL_R + 0.62, 0.14, 12, 48), stoneMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.56;
  rim.castShadow = true;
  g.add(rim);
  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(POOL_R + 0.05, POOL_R + 0.05, 0.5, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: concreteTex('#5d584e'), roughness: 0.85, side: THREE.BackSide }));
  innerWall.position.y = 0.25;
  g.add(innerWall);

  // pool water — dark glossy disc; jets reflect via mirrored particles above it
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: 0x07242f, roughness: 0.06, metalness: 0.35,
    transparent: true, opacity: 0.62, depthWrite: false,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(POOL_R + 0.02, 48), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = POOL_Y;
  pool.renderOrder = 1;
  g.add(pool);
  parts.poolMat = poolMat;

  // shimmering caustics overlay (scrolls during the show)
  const caus = new THREE.Mesh(new THREE.CircleGeometry(POOL_R, 48),
    new THREE.MeshBasicMaterial({
      map: causticsTex(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
  caus.rotation.x = -Math.PI / 2;
  caus.position.y = POOL_Y + 0.01;
  g.add(caus);
  parts.caustics = caus;

  // dormant nozzle hardware in the pool (visible, but silent until finale)
  const brass = new THREE.MeshStandardMaterial({ color: 0x8f7442, metalness: 0.85, roughness: 0.4 });
  const nozzleAnchors = { center: new THREE.Vector3(0, POOL_Y, 0), ring: [], arc: [], fan: [] };
  const addNozzle = (x, z, r = 0.07) => {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, 0.12, 10), brass);
    n.position.set(x, POOL_Y + 0.03, z);
    g.add(n);
  };
  addNozzle(0, 0, 0.14);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 2.3, z = Math.sin(a) * 2.3;
    addNozzle(x, z);
    nozzleAnchors.ring.push(new THREE.Vector3(x, POOL_Y, z));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const x = Math.cos(a) * (POOL_R - 0.35), z = Math.sin(a) * (POOL_R - 0.35);
    addNozzle(x, z, 0.09);
    nozzleAnchors.arc.push(new THREE.Vector3(x, POOL_Y, z));
  }
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + Math.PI / 2;
    const x = Math.cos(a) * 1.2, z = Math.sin(a) * 1.2;
    addNozzle(x, z, 0.1);
    nozzleAnchors.fan.push(new THREE.Vector3(x, POOL_Y, z));
  }
  parts.nozzleAnchors = nozzleAnchors;

  // underwater lights: glow sprites + tinted point lights around the pool
  const uw = [];
  const glowMap = glowSprite();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 3.0, z = Math.sin(a) * 3.0;
    const spME = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, color: 0xffffff, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    spME.position.set(x, POOL_Y + 0.05, z);
    spME.scale.setScalar(3.1);
    g.add(spME);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x555b60, metalness: 0.8, roughness: 0.5 }));
    housing.position.set(x, POOL_Y - 0.02, z);
    g.add(housing);
    uw.push({ sprite: spME, pos: new THREE.Vector3(x, POOL_Y, z) });
  }
  // two real point lights that cycle colors (cheap but effective on the stone)
  const pl1 = new THREE.PointLight(0xffffff, 0, 16, 1.6); pl1.position.set(0, 1.2, 0); g.add(pl1);
  const pl2 = new THREE.PointLight(0xffffff, 0, 20, 1.8); pl2.position.set(0, 3.5, 0); g.add(pl2);
  parts.uwLights = uw;
  parts.poolLight = pl1;
  parts.showLight = pl2;

  // wet-ground glow decals around the basin (lit by the show)
  const decals = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const d = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20),
      new THREE.MeshBasicMaterial({
        map: glowMap, color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
    d.rotation.x = -Math.PI / 2;
    d.position.set(Math.cos(a) * 6.2, 0.01, Math.sin(a) * 6.2);
    g.add(d);
    decals.push(d);
  }
  parts.decals = decals;

  // ---------- mid layer: lamp posts, benches, trees ----------
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x20262b, metalness: 0.7, roughness: 0.5 });
  const lampheads = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 10), ironMat);
    pole.position.set(x, 1.7, z);
    pole.castShadow = true;
    g.add(pole);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfff3c9, emissive: 0x000000, emissiveIntensity: 2.2, roughness: 0.4,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), headMat);
    head.position.set(x, 3.5, z);
    g.add(head);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 12), ironMat);
    cap.position.set(x, 3.72, z);
    g.add(cap);
    const li = new THREE.PointLight(0xffd9a0, 0, 12, 1.8);
    li.position.set(x, 3.4, z);
    g.add(li);
    lampheads.push({ headMat, light: li });
  }
  parts.lampheads = lampheads;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4c3a28, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * 7.2, z = Math.sin(a) * 7.2;
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.45), woodMat);
    seat.position.y = 0.45;
    bench.add(seat);
    const back2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.06), woodMat);
    back2.position.set(0, 0.72, -0.2);
    bench.add(back2);
    [[-0.6], [0.6]].forEach(([lx]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), ironMat);
      leg.position.set(lx, 0.22, 0);
      bench.add(leg);
    });
    bench.position.set(x, 0, z);
    bench.lookAt(0, 0, 0);
    bench.castShadow = true;
    g.add(bench);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2d20, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1c3320, roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    const r = 11.5 + (i % 3) * 2.2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 1.6 + (i % 4) * 0.4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 8), trunkMat);
    trunk.position.set(x, h / 2, z);
    g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (i % 3) * 0.3, 10, 8), leafMat);
    crown.position.set(x, h + 0.8, z);
    crown.scale.y = 1.15;
    crown.castShadow = true;
    g.add(crown);
  }

  // ---------- far layer: building silhouettes with a few windows ----------
  const bldMat = new THREE.MeshStandardMaterial({ color: 0x0e131c, roughness: 1 });
  const winMats = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.13;
    const r = 27 + (i % 4) * 3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 3.5 + (i % 3) * 2, h = 5 + ((i * 7) % 9), d = 3.5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldMat);
    b.position.set(x, h / 2, z);
    b.rotation.y = -a;
    g.add(b);
    // windows: a handful of warm dots that turn on at night
    for (let k = 0; k < 5; k++) {
      const wm = new THREE.MeshBasicMaterial({
        color: 0xffca70, transparent: true, opacity: 0,
      });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.5), wm);
      const lx = (Math.random() - 0.5) * (w - 1);
      const ly = 1 + Math.random() * (h - 2);
      win.position.set(lx, ly - h / 2, d / 2 + 0.02);
      b.add(win);
      winMats.push(wm);
    }
  }
  parts.winMats = winMats;

  // floor grates where pop jets will fire from during the finale
  const grateMat = new THREE.MeshStandardMaterial({ color: 0x2a3136, metalness: 0.8, roughness: 0.55 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.05, 16), grateMat);
    gr.position.set(Math.cos(a) * 6.4, 0.025, Math.sin(a) * 6.4);
    g.add(gr);
  }

  // manhole / hatch we "arrive" from
  const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshStandardMaterial({ color: 0x333a40, metalness: 0.8, roughness: 0.5 }));
  hatch.rotation.x = -Math.PI / 2;
  hatch.position.set(5.6, 0.012, 2.2);
  g.add(hatch);

  // ambient + key lights for the plaza
  const hemi = new THREE.HemisphereLight(0x2a3450, 0x1a140f, 0.9);
  g.add(hemi);
  parts.hemi = hemi;
  const dusk = new THREE.DirectionalLight(0xd88a4d, 1.1);
  dusk.position.set(-20, 10, 8);
  g.add(dusk);
  parts.duskSun = dusk;

  // rainbow beams for the finale (additive cones, hidden until the show)
  const beams = [];
  const beamCols = [0xff5a8a, 0x51b5ff, 0x7dff8a, 0xffd455, 0xb96bff, 0x5affd8];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: beamCols[i], transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    cone.geometry.translate(0, 7, 0);
    const piv = new THREE.Group();
    piv.position.set(Math.cos(a) * (POOL_R + 0.9), 0.4, Math.sin(a) * (POOL_R + 0.9));
    piv.add(cone);
    piv.rotation.z = 0.35 * (i % 2 ? 1 : -1);
    g.add(piv);
    beams.push({ piv, cone, baseA: a });
  }
  parts.beams = beams;

  return { group: g, parts };
}
