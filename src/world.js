import * as THREE from 'three';
import {
  V3, srand, srange, clamp01, lerp, smooth, easeOutBack, easeOutCubic,
  mergeGeoms, mat4, makeSkyTexture,
} from './util.js';

/* ------------------------------------------------------------------ *
 *  Layout constants (all in metres; the park is ~34m x 30m)
 * ------------------------------------------------------------------ */
export const LAYOUT = {
  fountain: V3(0, 0, 3.4),
  junction: V3(0, 0, -6),
  gateExit: V3(0, 0, -12.8),
  wheelPos: V3(9, 0, 0),
  pond: V3(9, 0, 2.9),
  westPool: V3(-9, 0, 3.0),
  basket: V3(4.2, 0, 6.3),
  beds: [V3(-12.4, 0, -4.6), V3(-12.4, 0, -1.2), V3(-12.4, 0, 2.2)],
  bedW: 3.0,
  bedD: 2.2,
};

const FLOWER_PALETTE = [0xff6fa5, 0xffd23e, 0xb487f0, 0xff8b5e, 0xfff6f0, 0xf25c78];

/* shared materials -------------------------------------------------- */
function makeMaterials() {
  const std = (color, opt = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...opt });
  return {
    stone: std(0xb6ac99, { flatShading: true }),
    stoneDark: std(0x8e8474, { flatShading: true }),
    wood: std(0x8a6a44, { flatShading: true }),
    woodDark: std(0x6b5233, { flatShading: true }),
    soil: std(0xa5865c, { flatShading: true }),
    soilDark: std(0x6f5439, { flatShading: true }),
    brass: std(0xc9a24a, { roughness: 0.35, metalness: 0.65 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x3fa9e0, roughness: 0.15, metalness: 0,
      transparent: true, opacity: 0.88, emissive: 0x104a70,
      side: THREE.DoubleSide,
    }),
    jet: new THREE.MeshBasicMaterial({
      color: 0xaadcf8, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
    marker: new THREE.MeshBasicMaterial({
      color: 0xffcf4d, transparent: true, opacity: 0.85, depthWrite: false,
    }),
  };
}

/* ------------------------------------------------------------------ */
export function buildWorld(scene) {
  const M = makeMaterials();
  const world = {
    M,
    life: 0,               // 0 = dry park, 1 = fully revived
    time: 0,
    beds: [],
    plants: [],
    trees: [],
    anims: [],             // small tween list {t,dur,fn(k)}
  };

  /* ============ sky, light, fog, far scenery ============ */
  const sunDry = { color: new THREE.Color(0xffdfae), intensity: 2.0 };
  const sunLush = { color: new THREE.Color(0xfff4da), intensity: 2.7 };
  const sun = new THREE.DirectionalLight(sunDry.color, sunDry.intensity);
  sun.position.set(13, 21, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  sun.target.position.set(0, 0, -3);

  const hemiDry = { sky: new THREE.Color(0xd9cfb2), gnd: new THREE.Color(0x8a7a5c), i: 0.75 };
  const hemiLush = { sky: new THREE.Color(0xbfe3ff), gnd: new THREE.Color(0x7fae6a), i: 0.95 };
  const hemi = new THREE.HemisphereLight(hemiDry.sky, hemiDry.gnd, hemiDry.i);
  scene.add(hemi);

  const fogDry = { color: new THREE.Color(0xdcc9a4), near: 30, far: 95 };
  const fogLush = { color: new THREE.Color(0xcfe9f5), near: 38, far: 130 };
  scene.fog = new THREE.Fog(fogDry.color.clone(), fogDry.near, fogDry.far);

  const skyGeo = new THREE.SphereGeometry(150, 24, 14);
  const skyDry = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    map: makeSkyTexture([[0, '#cdd3d3'], [0.45, '#e6dcc0'], [0.72, '#ead4a8'], [1, '#dfc79a']]),
    side: THREE.BackSide, fog: false,
  }));
  const skyLush = new THREE.Mesh(new THREE.SphereGeometry(148, 24, 14), new THREE.MeshBasicMaterial({
    map: makeSkyTexture([[0, '#3f9fe0'], [0.5, '#8fd0f4'], [0.78, '#d9f1fb'], [1, '#eefaf0']]),
    side: THREE.BackSide, fog: false, transparent: true, opacity: 0,
  }));
  skyDry.position.set(0, -4, -10);
  skyLush.position.copy(skyDry.position);
  scene.add(skyDry, skyLush);

  // rolling hills (mid distance) and mountains (far, faded by fog)
  const hills = [];
  const hillDefs = [
    [-26, -32, 11, 4.2], [8, -36, 15, 5.2], [30, -30, 10, 3.6], [-6, -44, 20, 6.5],
    [44, -40, 13, 4.5], [-44, -38, 14, 4.8],
  ];
  for (const [x, z, r, h] of hillDefs) {
    const m = new THREE.MeshStandardMaterial({ color: 0xa39355, roughness: 1, flatShading: true });
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
    hill.scale.set(1, h / r, 0.8);
    hill.position.set(x, -r * 0.25, z);
    scene.add(hill);
    hills.push({ mesh: hill, dry: new THREE.Color(0xa39355), lush: new THREE.Color(0x5f9b4d) });
  }
  // far mountain ridge: low, wide, heavily fog-faded (aerial perspective)
  for (const [x, z, r, h] of [[-62, -105, 38, 11], [2, -115, 50, 14], [58, -100, 34, 9]]) {
    const mt = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 7),
      new THREE.MeshStandardMaterial({ color: 0xa8b8c4, roughness: 1, flatShading: true })
    );
    mt.position.set(x, h / 2 - 2, z);
    scene.add(mt);
  }

  /* ============ terrain ============ */
  const GW = 96, GH = 84;
  const groundGeo = new THREE.PlaneGeometry(GW, GH, 88, 76);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;

  // polylines used both for path colouring and for the "life wave" timing
  const waterLines = [
    [V3(0, 0, -12.8), V3(0, 0, -6)], [V3(0, 0, -6), V3(-9, 0, -6)],
    [V3(-9, 0, -6), V3(-9, 0, 3)], [V3(0, 0, -6), V3(9, 0, -6)],
    [V3(9, 0, -6), V3(9, 0, 2.9)], [V3(0, 0, -6), V3(0, 0, 3.4)],
  ];
  const distToWater = (x, z) => {
    let d = Infinity;
    const p = V3(x, 0, z), tmp = V3(), line = new THREE.Line3();
    for (const [a, b] of waterLines) {
      line.set(a, b);
      line.closestPointToPoint(p, true, tmp);
      d = Math.min(d, tmp.distanceTo(p));
    }
    return Math.min(d, p.distanceTo(LAYOUT.fountain));
  };

  const dryCol = [], lushCol = [], lifeTh = [];
  const cDryGrass = new THREE.Color(0xb39a63), cLushGrass = new THREE.Color(0x5fa04e);
  const cDrySand = new THREE.Color(0xcfba8d), cLushSand = new THREE.Color(0xdcc79b);
  const cStonePad = new THREE.Color(0xb3a992);
  const tmpC = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    // gentle height noise, flatter inside the play area
    const inPlay = Math.abs(x) < 17 && z > -17 && z < 13;
    let y = (Math.sin(x * 0.55) * Math.cos(z * 0.48) + Math.sin(x * 1.7 + z * 1.3) * 0.4) * 0.05;
    if (!inPlay) y += Math.max(0, (Math.abs(x) - 17) * 0.02) + Math.max(0, (-z - 17) * 0.05);
    gp.setY(i, y);

    // soft-edged sandy plaza + paths (feathered, so borders are not blocky)
    const segDist = (px, pz, ax, az, bx, bz) => {
      const dx = bx - ax, dz = bz - az;
      let t = ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz);
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
    };
    const soft = (d, r, feather = 1.3) => clamp01((r - d) / feather);
    const sandK = Math.max(
      soft(Math.hypot(x, z - 3.4), 4.9),
      soft(segDist(x, z, 0, 6, 0, 14.5), 1.3),
      soft(segDist(x, z, -4.3, 1.6, -9.6, 1.6), 1.0),
      soft(segDist(x, z, 4, 4, 9.8, 4), 1.0)
    );
    const dTerrace = Math.max(Math.abs(x) - 6.8, Math.abs(z + 15.3) - 3.1);
    const terrK = clamp01((0.6 - dTerrace) / 1.2);
    const n = (srand() - 0.5) * 0.09;
    tmpC.copy(cDryGrass).lerp(cDrySand, sandK).lerp(cStonePad, terrK).offsetHSL(0, 0, n);
    dryCol.push(tmpC.r, tmpC.g, tmpC.b);
    tmpC.copy(cLushGrass).lerp(cLushSand, sandK).lerp(cStonePad, terrK).offsetHSL(0, 0, n);
    lushCol.push(tmpC.r, tmpC.g, tmpC.b);
    // life wave threshold: spreads outward from the waterways
    lifeTh.push(clamp01(distToWater(x, z) / 26) * 0.8 + srand() * 0.2);
  }
  groundGeo.computeVertexNormals();
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(dryCol.slice(), 3));
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  world.groundLife = { geo: groundGeo, dry: dryCol, lush: lushCol, th: lifeTh, applied: -1 };

  /* ============ channel network ============ */
  const trenchGeom = (len, centered) => {
    const items = [
      { geom: new THREE.BoxGeometry(0.92, 0.12, len), matrix: mat4(0, 0.06, centered ? 0 : len / 2) },
      { geom: new THREE.BoxGeometry(0.22, 0.34, len), matrix: mat4(-0.56, 0.17, centered ? 0 : len / 2) },
      { geom: new THREE.BoxGeometry(0.22, 0.34, len), matrix: mat4(0.56, 0.17, centered ? 0 : len / 2) },
    ];
    return mergeGeoms(items);
  };

  function makeRun(a, b, { gap = false } = {}) {
    const len = a.distanceTo(b);
    const run = { a: a.clone(), b: b.clone(), len, fill: 0, gap };
    if (!gap) {
      const trench = new THREE.Mesh(trenchGeom(len, false), M.stone);
      trench.position.copy(a);
      trench.lookAt(b.x, 0, b.z);
      trench.castShadow = true;
      trench.receiveShadow = true;
      scene.add(trench);
      run.trench = trench;
    }
    const wg = new THREE.PlaneGeometry(0.8, len);
    wg.rotateX(-Math.PI / 2);
    wg.translate(0, 0, len / 2);
    const water = new THREE.Mesh(wg, M.water);
    water.position.set(a.x, 0.24, a.z);
    water.lookAt(b.x, 0.24, b.z);
    water.visible = false;
    water.renderOrder = 2;
    scene.add(water);
    run.water = water;
    run.setFill = (f) => {
      run.fill = clamp01(f);
      water.visible = run.fill > 0.002;
      water.scale.z = Math.max(run.fill, 0.002);
    };
    run.headPos = () => V3().lerpVectors(run.a, run.b, run.fill).setY(0.26);
    return run;
  }

  const J = LAYOUT.junction;
  const branches = {
    main: [
      makeRun(V3(0, 0, -12.8), V3(0, 0, -10.4)),
      makeRun(V3(0, 0, -10.4), V3(0, 0, -8.4), { gap: true }),
      makeRun(V3(0, 0, -8.4), V3(0, 0, -6)),
    ],
    west: [
      makeRun(J, V3(-9, 0, -6)),
      makeRun(V3(-9, 0, -6), V3(-9, 0, -2.4)),
      makeRun(V3(-9, 0, -2.4), V3(-9, 0, -0.4), { gap: true }),
      makeRun(V3(-9, 0, -0.4), V3(-9, 0, 2.5)),
    ],
    east: [
      makeRun(J, V3(4, 0, -6)),
      makeRun(V3(4, 0, -6), V3(6, 0, -6), { gap: true }),
      makeRun(V3(6, 0, -6), V3(9, 0, -6)),
      makeRun(V3(9, 0, -6), V3(9, 0, 2.4)),
    ],
    center: [makeRun(J, V3(0, 0, 1.15))],
  };

  // junction pad
  {
    const pad = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.BoxGeometry(2.1, 0.3, 2.1), matrix: mat4(0, 0.15, 0) },
        { geom: new THREE.BoxGeometry(1.5, 0.14, 1.5), matrix: mat4(0, 0.34, 0) },
      ]),
      M.stoneDark
    );
    // carve look: put a thinner dark top then the water square above it
    pad.position.set(J.x, 0, J.z);
    pad.receiveShadow = true; pad.castShadow = true;
    scene.add(pad);
    const jw = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), M.water);
    jw.position.set(J.x, 0.44, J.z);
    jw.visible = false;
    world.junctionWater = jw;
    scene.add(jw);
  }

  // gap data + loose pieces
  const gapDefs = [
    { run: branches.main[1] },
    { run: branches.west[2] },
    { run: branches.east[1] },
  ];
  const gaps = gapDefs.map((g, i) => {
    const c = V3().lerpVectors(g.run.a, g.run.b, 0.5);
    const dir = V3().subVectors(g.run.b, g.run.a).normalize();
    // rubble stones hint that a piece is missing
    const rubble = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.IcosahedronGeometry(0.16, 0), matrix: mat4(-0.5, 0.1, 0.3) },
        { geom: new THREE.IcosahedronGeometry(0.12, 0), matrix: mat4(0.4, 0.08, -0.35) },
        { geom: new THREE.IcosahedronGeometry(0.1, 0), matrix: mat4(0.1, 0.07, 0.1) },
      ]),
      M.stoneDark
    );
    rubble.position.copy(c);
    rubble.castShadow = true;
    scene.add(rubble);
    const marker = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 8, 32), M.marker.clone());
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(c).setY(0.12);
    marker.visible = false;
    scene.add(marker);
    return { index: i, center: c, dir, run: g.run, filled: false, marker, rubble };
  });

  // one loose piece lies near each gap (piece i pairs with gap i)
  const pieceHomes = [
    { pos: V3(2.6, 0, -8.6), rot: 0.45 },
    { pos: V3(-6.8, 0, -2.6), rot: 1.2 },
    { pos: V3(6.4, 0, -8.2), rot: 2.1 },
  ];
  const pieces = pieceHomes.map((h, i) => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(trenchGeom(2, true), M.stone);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 2.0), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.4;
    group.add(hit);
    group.position.copy(h.pos);
    group.rotation.y = h.rot;
    scene.add(group);
    return { index: i, group, hit, home: h, snapped: false, dragging: false };
  });

  world.channels = { branches, gaps, pieces };
  world.setGapMarkers = (v) => gaps.forEach((g) => { g.marker.visible = v && !g.filled; });
  world.snapPiece = (piece, gap) => {
    piece.snapped = true;
    gap.filled = true;
    gap.marker.visible = false;
    gap.rubble.visible = false;
    piece.group.position.copy(gap.center).setY(0);
    piece.group.rotation.set(0, Math.abs(gap.dir.x) > 0.5 ? Math.PI / 2 : 0, 0);
    world.anims.push({
      t: 0, dur: 0.35,
      fn: (k) => { piece.group.position.y = (1 - easeOutCubic(k)) * 0.8; },
    });
  };

  /* ============ gate + reservoir (north terrace) ============ */
  const gate = new THREE.Group();
  gate.position.set(0, 0, -13.2);
  {
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(12, 1.0, 5.4), M.stoneDark);
    terrace.position.set(0, 0.5, -2.6);
    terrace.castShadow = true; terrace.receiveShadow = true;
    gate.add(terrace);
    // reservoir walls
    const wall = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, d), M.stone);
      m.position.set(x, 1.4, z);
      m.castShadow = true; m.receiveShadow = true;
      gate.add(m);
    };
    wall(6.4, 0.5, 0, -4.6);
    wall(0.5, 3.4, -3.0, -2.9);
    wall(0.5, 3.4, 3.0, -2.9);
    wall(2.3, 0.5, -1.85, -1.35);
    wall(2.3, 0.5, 1.85, -1.35);
    const resWater = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 2.9), M.water);
    resWater.position.set(0, 1.42, -2.9);
    gate.add(resWater);
    world.reservoirWater = resWater;

    // pillars + lintel
    const pillarG = mergeGeoms([
      { geom: new THREE.BoxGeometry(0.78, 2.7, 0.95), matrix: mat4(0, 1.35, 0) },
      { geom: new THREE.BoxGeometry(1.0, 0.3, 1.15), matrix: mat4(0, 2.85, 0) },
    ]);
    for (const sx of [-1.25, 1.25]) {
      const p = new THREE.Mesh(pillarG, M.stone);
      p.position.set(sx, 0, -1.1);
      p.castShadow = true; p.receiveShadow = true;
      gate.add(p);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 0.95), M.stone);
    lintel.position.set(0, 3.15, -1.1);
    lintel.castShadow = true;
    gate.add(lintel);

    // sluice door (wood, X-braced)
    const doorG = mergeGeoms([
      { geom: new THREE.BoxGeometry(1.7, 1.75, 0.16), matrix: mat4(0, 0, 0) },
      { geom: new THREE.BoxGeometry(0.16, 2.1, 0.06), matrix: mat4(0, 0, 0.1, 0, 0, 0.7) },
      { geom: new THREE.BoxGeometry(0.16, 2.1, 0.06), matrix: mat4(0, 0, 0.1, 0, 0, -0.7) },
      { geom: new THREE.BoxGeometry(1.8, 0.18, 0.07), matrix: mat4(0, 0.75, 0.1) },
    ]);
    const door = new THREE.Mesh(doorG, M.woodDark);
    door.position.set(0, 1.55, -1.05);
    door.castShadow = true;
    gate.add(door);
    world.gateDoor = door;

    // big handle-wheel above the lintel
    const hw = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 10, 24), M.wood);
    hw.add(ring);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), M.wood);
      sp.rotation.z = (i / 3) * Math.PI;
      hw.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M.brass);
    hw.add(hub);
    hw.position.set(0, 3.95, -0.9);
    hw.children.forEach((c) => { c.castShadow = true; });
    gate.add(hw);
    world.gateWheel = hw;

    // spill chute from reservoir down to channel start
    const chute = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.BoxGeometry(1.1, 0.14, 1.6), matrix: mat4(0, 0, 0) },
        { geom: new THREE.BoxGeometry(0.16, 0.34, 1.6), matrix: mat4(-0.55, 0.14, 0) },
        { geom: new THREE.BoxGeometry(0.16, 0.34, 1.6), matrix: mat4(0.55, 0.14, 0) },
      ]),
      M.stone
    );
    chute.position.set(0, 0.55, -0.25);
    chute.rotation.x = 0.62;
    chute.castShadow = true; chute.receiveShadow = true;
    gate.add(chute);
    const chuteWater = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.7).rotateX(-Math.PI / 2), M.water);
    chuteWater.position.set(0, 0.68, -0.25);
    chuteWater.rotation.x = 0.62;
    chuteWater.visible = false;
    gate.add(chuteWater);
    world.chuteWater = chuteWater;

    // invisible fat hit area over the whole gate front
    const ghit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
    ghit.position.set(0, 2.2, -0.8);
    gate.add(ghit);
    world.gateHit = ghit;
  }
  scene.add(gate);
  world.gate = gate;
  world.gateOpen = 0;
  world.setGateOpen = (v) => {
    world.gateOpen = clamp01(v);
    world.gateDoor.position.y = 1.55 + world.gateOpen * 1.5;
    world.gateWheel.rotation.z = world.gateOpen * 5;
  };
  world.gateHandlePos = () => V3(0, 2.6, -14.1);

  /* ============ fountain ============ */
  const fountain = new THREE.Group();
  fountain.position.copy(LAYOUT.fountain);
  {
    const basin = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.CylinderGeometry(2.5, 2.62, 0.5, 28, 1, true), matrix: mat4(0, 0.25, 0) },
        { geom: new THREE.TorusGeometry(2.5, 0.15, 10, 28), matrix: mat4(0, 0.52, 0, Math.PI / 2) },
        { geom: new THREE.CylinderGeometry(2.45, 2.45, 0.14, 28), matrix: mat4(0, 0.07, 0) },
        { geom: new THREE.CylinderGeometry(0.62, 0.78, 0.95, 12), matrix: mat4(0, 0.5, 0) },
        { geom: new THREE.CylinderGeometry(0.85, 0.7, 0.2, 12), matrix: mat4(0, 1.05, 0) },
        { geom: new THREE.SphereGeometry(0.34, 12, 10), matrix: mat4(0, 1.25, 0) },
      ]),
      M.stone
    );
    basin.castShadow = true; basin.receiveShadow = true;
    fountain.add(basin);

    const bw = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.05, 28), M.water);
    bw.position.y = 0.18;
    bw.visible = false;
    fountain.add(bw);
    world.basinWater = bw;

    // inlet notch from the centre channel into the basin (south side)
    const inlet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.7), M.stone);
    inlet.position.set(0, 0.2, -2.5);
    fountain.add(inlet);

    world.nozzles = [];
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const ng = new THREE.Group();
      const body = new THREE.Mesh(
        mergeGeoms([
          { geom: new THREE.CylinderGeometry(0.09, 0.11, 0.2, 10), matrix: mat4(0, 0.1, 0) },
          { geom: new THREE.CylinderGeometry(0.035, 0.075, 0.16, 10), matrix: mat4(0, 0.28, 0) },
        ]),
        M.brass
      );
      body.castShadow = true;
      ng.add(body);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.2;
      ng.add(hit);
      // jet cone, hidden until the finale
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.8, 10, 1, true), M.jet);
      jet.geometry.translate(0, 0.9, 0);
      jet.position.y = 0.3;
      jet.scale.set(1, 0.001, 1);
      jet.visible = false;
      ng.add(jet);
      ng.position.set(Math.cos(ang) * 0.55, 1.12, Math.sin(ang) * 0.55);
      const tilt = 0.55 + srand() * 0.3;
      ng.rotation.set(Math.cos(ang + 1.2) * tilt, 0, Math.sin(ang + 0.6) * tilt + 0.3);
      fountain.add(ng);
      world.nozzles.push({ group: ng, hit, jet, jetOn: 0, fixed: false, ang });
    }
    // centre plume from the top dome
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.9, 12, 1, true), M.jet);
    plume.geometry.translate(0, 1.45, 0);
    plume.position.y = 1.35;
    plume.scale.set(1, 0.001, 1);
    plume.visible = false;
    fountain.add(plume);
    world.plume = plume;
  }
  scene.add(fountain);
  world.fountain = fountain;
  world.fixNozzle = (n) => {
    n.fixed = true;
    const from = n.group.rotation.clone();
    world.anims.push({
      t: 0, dur: 0.55,
      fn: (k) => {
        const e = easeOutBack(k);
        n.group.rotation.set(from.x * (1 - e), 0, from.z * (1 - e));
      },
    });
  };

  /* ============ waterwheel + mill hut ============ */
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(LAYOUT.wheelPos.x, 0, LAYOUT.wheelPos.z);
  {
    for (const sx of [-0.95, 0.95]) {
      const sup = new THREE.Mesh(
        mergeGeoms([
          { geom: new THREE.BoxGeometry(0.5, 1.5, 0.8), matrix: mat4(0, 0.75, 0) },
          { geom: new THREE.BoxGeometry(0.7, 0.25, 1.0), matrix: mat4(0, 0.1, 0) },
        ]),
        M.stoneDark
      );
      sup.position.x = sx;
      sup.castShadow = true; sup.receiveShadow = true;
      wheelGroup.add(sup);
    }
    const wheel = new THREE.Group();
    const items = [];
    for (const sx of [-0.32, 0.32]) {
      items.push({ geom: new THREE.TorusGeometry(1.25, 0.07, 8, 22), matrix: mat4(sx, 0, 0, 0, Math.PI / 2, 0) });
    }
    for (let i = 0; i < 4; i++) {
      items.push({ geom: new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), matrix: mat4(0, 0, 0, (i / 4) * Math.PI, 0, 0) });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      items.push({
        geom: new THREE.BoxGeometry(0.72, 0.5, 0.1),
        matrix: mat4(0, Math.cos(a) * 1.2, Math.sin(a) * 1.2, -a + Math.PI / 2, 0, 0),
      });
    }
    items.push({ geom: new THREE.CylinderGeometry(0.09, 0.09, 2.3, 8), matrix: mat4(0, 0, 0, 0, 0, Math.PI / 2) });
    const wheelMesh = new THREE.Mesh(mergeGeoms(items), M.wood);
    wheelMesh.castShadow = true;
    wheel.add(wheelMesh);
    wheel.position.set(0, 1.42, 0);
    wheelGroup.add(wheel);
    world.wheel = wheel;
    world.wheelSpeed = 0;

    // little mill hut beside the wheel
    const hut = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.BoxGeometry(2.4, 1.8, 2.2), matrix: mat4(0, 0.9, 0) },
        { geom: new THREE.ConeGeometry(2.05, 1.3, 4), matrix: mat4(0, 2.4, 0, 0, Math.PI / 4, 0) },
        { geom: new THREE.BoxGeometry(0.7, 1.0, 0.1), matrix: mat4(-0.4, 0.5, 1.12) },
      ]),
      new THREE.MeshStandardMaterial({ color: 0xcbb691, flatShading: true, roughness: 0.9 })
    );
    hut.position.set(2.6, 0, 0.4);
    hut.castShadow = true; hut.receiveShadow = true;
    wheelGroup.add(hut);
  }
  scene.add(wheelGroup);

  /* ============ ponds at branch ends ============ */
  function makePool(center, r) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 8, 22), M.stone);
    rim.rotation.x = -Math.PI / 2;
    rim.position.copy(center).setY(0.14);
    rim.castShadow = true;
    scene.add(rim);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.05, r - 0.05, 0.05, 22), M.water);
    w.position.copy(center).setY(0.16);
    w.visible = false;
    scene.add(w);
    return { water: w };
  }
  world.pond = makePool(LAYOUT.pond, 1.0);
  world.westPool = makePool(LAYOUT.westPool, 0.7);

  /* ============ flower beds ============ */
  LAYOUT.beds.forEach((c, bi) => {
    const g = new THREE.Group();
    g.position.copy(c);
    const W = LAYOUT.bedW, D = LAYOUT.bedD;
    const frame = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.BoxGeometry(W + 0.3, 0.3, 0.16), matrix: mat4(0, 0.15, -D / 2 - 0.08) },
        { geom: new THREE.BoxGeometry(W + 0.3, 0.3, 0.16), matrix: mat4(0, 0.15, D / 2 + 0.08) },
        { geom: new THREE.BoxGeometry(0.16, 0.3, D + 0.3), matrix: mat4(-W / 2 - 0.08, 0.15, 0) },
        { geom: new THREE.BoxGeometry(0.16, 0.3, D + 0.3), matrix: mat4(W / 2 + 0.08, 0.15, 0) },
      ]),
      M.wood
    );
    frame.castShadow = true; frame.receiveShadow = true;
    g.add(frame);

    const soilMat = M.soil.clone();
    const soil = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, D), soilMat);
    soil.position.y = 0.11;
    soil.receiveShadow = true;
    g.add(soil);

    // dry cracks: thin dark slats, hidden as tilling progresses
    const crackItems = [];
    for (let i = 0; i < 7; i++) {
      crackItems.push({
        geom: new THREE.BoxGeometry(srange(0.4, 1.0), 0.012, 0.05),
        matrix: mat4(srange(-W / 2 + 0.5, W / 2 - 0.5), 0.225, srange(-D / 2 + 0.3, D / 2 - 0.3), 0, srange(0, 3.1)),
      });
    }
    const cracks = new THREE.Mesh(mergeGeoms(crackItems), M.soilDark);
    g.add(cracks);

    // furrow ridges pop up as the child tills
    const furrows = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.16, 0.2), M.soilDark);
      f.position.set(0, 0.22, -D / 2 + (i + 0.5) * (D / 4));
      f.scale.y = 0.001;
      f.castShadow = true;
      g.add(f);
      furrows.push(f);
    }
    scene.add(g);
    world.beds.push({
      index: bi, group: g, center: c.clone(), soil, soilMat, cracks, furrows,
      progress: 0, tilled: false, plants: [], shown: 0,
    });
  });

  world.tillBed = (bed, amount) => {
    if (bed.tilled) return false;
    bed.progress = clamp01(bed.progress + amount);
    const want = Math.floor(bed.progress * 4.0001);
    while (bed.shown < want && bed.shown < 4) {
      const f = bed.furrows[bed.shown++];
      world.anims.push({ t: 0, dur: 0.4, fn: (k) => { f.scale.y = Math.max(easeOutBack(k), 0.001); } });
    }
    bed.cracks.visible = bed.progress < 0.6;
    bed.soilMat.color.lerpColors(new THREE.Color(0xa5865c), new THREE.Color(0x87683f), bed.progress);
    if (bed.progress >= 1) bed.tilled = true;
    return bed.tilled;
  };

  /* planted flowers ------------------------------------------------- */
  world.plantSeed = (bed, worldPos) => {
    const color = new THREE.Color(FLOWER_PALETTE[world.plants.length % FLOWER_PALETTE.length]);
    const g = new THREE.Group();
    g.position.set(worldPos.x, 0.24, worldPos.z);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), M.soilDark);
    mound.scale.y = 0.55;
    mound.castShadow = true;
    g.add(mound);
    const stub = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0xbfae76, flatShading: true }));
    stub.position.y = 0.12;
    g.add(stub);

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4e8f3a, flatShading: true });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 7), stemMat);
    stem.geometry.translate(0, 0.5, 0);
    stem.scale.y = 0.001;
    stem.castShadow = true;
    g.add(stem);

    const leafG = new THREE.Group();
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), stemMat);
      leaf.scale.set(1, 0.25, 0.5);
      leaf.position.set(s * 0.13, 0, 0);
      leaf.rotation.z = s * -0.5;
      leafG.add(leaf);
    }
    leafG.position.y = 0.22;
    leafG.scale.setScalar(0.001);
    g.add(leafG);

    const headMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 });
    const petalItems = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      petalItems.push({
        geom: new THREE.SphereGeometry(0.09, 8, 6),
        matrix: mat4(Math.cos(a) * 0.09, 0.1, Math.sin(a) * 0.09, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 1, 1.7, 0.55),
      });
    }
    const head = new THREE.Group();
    const petals = new THREE.Mesh(mergeGeoms(petalItems), headMat);
    petals.castShadow = true;
    head.add(petals);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe066, flatShading: true }));
    core.position.y = 0.06;
    head.add(core);
    head.scale.setScalar(0.001);
    head.visible = false;
    g.add(head);

    scene.add(g);
    const plant = {
      bed, group: g, stub, stem, leafG, head, color,
      pos: g.position.clone(), state: 'seed', swayPhase: srand() * 6.28,
    };
    bed.plants.push(plant);
    world.plants.push(plant);
    return plant;
  };

  world.bloomPlant = (plant, delay = 0) => {
    if (plant.state !== 'seed') return;
    plant.state = 'growing';
    world.anims.push({
      t: -delay, dur: 1.5,
      fn: (k) => {
        const grow = smooth(clamp01(k / 0.55));
        plant.stem.scale.y = Math.max(0.001, grow * 0.62);
        plant.stub.visible = k < 0.1;
        plant.head.visible = k > 0.35;
        plant.head.position.y = plant.stem.scale.y;
        const hk = clamp01((k - 0.45) / 0.55);
        plant.head.scale.setScalar(Math.max(0.001, easeOutBack(hk) * 1.35));
        plant.leafG.scale.setScalar(Math.max(0.001, easeOutBack(clamp01((k - 0.3) / 0.5))));
      },
      done: () => { plant.state = 'bloomed'; },
    });
  };

  /* ============ fallen leaves (instanced) ============ */
  const LEAF_N = 16;
  {
    const lg = new THREE.PlaneGeometry(0.4, 0.26, 2, 1);
    const lp = lg.attributes.position;
    for (let i = 0; i < lp.count; i++) if (Math.abs(lp.getX(i)) < 0.01) lp.setZ(i, 0.07);
    lg.computeVertexNormals();
    const lm = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1, flatShading: true });
    const inst = new THREE.InstancedMesh(lg, lm, LEAF_N);
    inst.castShadow = true;
    const cols = [0xc9722e, 0xb5542a, 0xd9973a, 0x9c6a2c, 0xc44a35];
    const leaves = [];
    for (let i = 0; i < LEAF_N; i++) {
      const a = srand() * Math.PI * 2, r = 2.7 + srand() * 1.8;
      const pos = V3(Math.cos(a) * r * 0.9, 0.03, 3.4 + Math.sin(a) * r * 0.75);
      // keep every leaf inside the leaves-task camera view, even in portrait
      pos.x = Math.max(-3.1, Math.min(5.6, pos.x));
      pos.z = Math.max(0.7, Math.min(7.6, pos.z));
      leaves.push({
        i, pos, rot: srand() * Math.PI * 2, state: 'ground', t: 0,
        scale: 0.85 + srand() * 0.5,
      });
      inst.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    world.leafInst = inst;
    world.leaves = leaves;
    world.leavesCollected = 0;
  }
  world.collectLeaf = (leaf) => {
    if (leaf.state !== 'ground') return false;
    leaf.state = 'fly';
    leaf.t = 0;
    const b = LAYOUT.basket;
    leaf.ctrl = V3(
      (leaf.pos.x + b.x) / 2 + srange(-1, 1),
      1.6 + srand() * 1.2,
      (leaf.pos.z + b.z) / 2 + srange(-1, 1)
    );
    world.leavesCollected++;
    return true;
  };

  /* basket */
  {
    const basket = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.CylinderGeometry(0.55, 0.4, 0.55, 12, 1, true), matrix: mat4(0, 0.28, 0) },
        { geom: new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), matrix: mat4(0, 0.03, 0) },
        { geom: new THREE.TorusGeometry(0.55, 0.05, 8, 14), matrix: mat4(0, 0.55, 0, Math.PI / 2) },
        { geom: new THREE.TorusGeometry(0.5, 0.045, 8, 14, Math.PI), matrix: mat4(0, 0.55, 0, 0, 0, 0) },
      ]),
      new THREE.MeshStandardMaterial({ color: 0xa9834f, flatShading: true, roughness: 0.9, side: THREE.DoubleSide })
    );
    basket.position.copy(LAYOUT.basket);
    basket.castShadow = true; basket.receiveShadow = true;
    scene.add(basket);
  }

  /* ============ trees, bench, lamps ============ */
  const treeDefs = [
    [-15, -8, 1.3], [15.5, -7, 1.4], [-14, 4.5, 1.2], [14.5, 7, 1.3],
    [-7, -14.6, 1.1], [7, -14.6, 1.1], [-16, 10.5, 1.4], [16, 11, 1.3],
    [-15.5, -13, 1.2], [12.5, 11.5, 1.1],
    [-5.5, 9.8, 1.0, 'sakura'], [6.3, 10.4, 1.0, 'sakura'],
  ];
  for (const [x, z, s, kind] of treeDefs) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.CylinderGeometry(0.14, 0.24, 1.2, 7), matrix: mat4(0, 0.6, 0, 0, 0, 0.06) },
        { geom: new THREE.CylinderGeometry(0.09, 0.14, 0.9, 7), matrix: mat4(0.12, 1.5, 0, 0, 0, 0.22) },
      ]),
      M.woodDark
    );
    trunk.castShadow = true;
    g.add(trunk);
    const isSakura = kind === 'sakura';
    const folMat = new THREE.MeshStandardMaterial({ color: 0x8f7d4f, flatShading: true, roughness: 1 });
    const fol = new THREE.Group();
    const blobs = [[0, 2.2, 0, 1.0], [0.7, 1.9, 0.25, 0.7], [-0.6, 1.95, -0.2, 0.65], [0.1, 2.7, -0.35, 0.6]];
    for (const [bx, by, bz, br] of blobs) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(br, 1), folMat);
      b.position.set(bx, by, bz);
      b.castShadow = true;
      fol.add(b);
    }
    fol.scale.setScalar(0.82);
    g.add(fol);
    g.scale.setScalar(s);
    g.rotation.y = srand() * Math.PI * 2;
    scene.add(g);
    world.trees.push({
      group: g, fol, folMat,
      dry: new THREE.Color(0x8f7d4f),
      lush: new THREE.Color(isSakura ? 0xf0a7c8 : 0x4f9c44),
      th: clamp01(distToWater(x, z) / 22),
      swayPhase: srand() * 6.28,
    });
  }

  // bench
  {
    const bench = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.BoxGeometry(1.8, 0.09, 0.16), matrix: mat4(0, 0.45, -0.12) },
        { geom: new THREE.BoxGeometry(1.8, 0.09, 0.16), matrix: mat4(0, 0.45, 0.08) },
        { geom: new THREE.BoxGeometry(1.8, 0.09, 0.16), matrix: mat4(0, 0.45, 0.28) },
        { geom: new THREE.BoxGeometry(1.8, 0.16, 0.08), matrix: mat4(0, 0.85, -0.24, -0.25) },
        { geom: new THREE.BoxGeometry(1.8, 0.16, 0.08), matrix: mat4(0, 1.05, -0.29, -0.25) },
        { geom: new THREE.BoxGeometry(0.12, 0.45, 0.5), matrix: mat4(-0.75, 0.22, 0.05) },
        { geom: new THREE.BoxGeometry(0.12, 0.45, 0.5), matrix: mat4(0.75, 0.22, 0.05) },
      ]),
      M.wood
    );
    bench.position.set(-4.6, 0, 7.2);
    bench.rotation.y = 0.6;
    bench.castShadow = true; bench.receiveShadow = true;
    scene.add(bench);
    world.benchTop = V3(-4.6, 1.15, 7.2);
  }

  // lamps
  world.lamps = [];
  for (const [x, z] of [[3.4, -1.6], [-3.6, 0.2]]) {
    const glass = new THREE.MeshStandardMaterial({
      color: 0xfff3cf, emissive: 0x000000, roughness: 0.4,
    });
    const lamp = new THREE.Mesh(
      mergeGeoms([
        { geom: new THREE.CylinderGeometry(0.06, 0.1, 2.3, 8), matrix: mat4(0, 1.15, 0) },
        { geom: new THREE.CylinderGeometry(0.16, 0.22, 0.1, 8), matrix: mat4(0, 0.05, 0) },
      ]),
      M.stoneDark
    );
    lamp.position.set(x, 0, z);
    lamp.castShadow = true;
    scene.add(lamp);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glass);
    head.position.set(x, 2.42, z);
    scene.add(head);
    world.lamps.push({ glass, top: V3(x, 2.62, z) });
  }

  /* ============ life transition ============ */
  world.setLife = (v) => {
    world.life = clamp01(v);
    const t = world.life;
    // sky + fog + light
    skyLush.material.opacity = t;
    scene.fog.color.lerpColors(fogDry.color, fogLush.color, t);
    scene.fog.near = lerp(fogDry.near, fogLush.near, t);
    scene.fog.far = lerp(fogDry.far, fogLush.far, t);
    sun.color.lerpColors(sunDry.color, sunLush.color, t);
    sun.intensity = lerp(sunDry.intensity, sunLush.intensity, t);
    hemi.color.lerpColors(hemiDry.sky, hemiLush.sky, t);
    hemi.groundColor.lerpColors(hemiDry.gnd, hemiLush.gnd, t);
    hemi.intensity = lerp(hemiDry.i, hemiLush.i, t);
    // ground vertex colours sweep outward from the waterways
    const gl = world.groundLife;
    if (Math.abs(t - gl.applied) > 0.02 || (t >= 1 && gl.applied < 1)) {
      gl.applied = t;
      const attr = gl.geo.attributes.color;
      for (let i = 0; i < attr.count; i++) {
        const th = gl.th[i];
        const k = smooth(clamp01((t * 1.25 - th) / 0.25));
        attr.setXYZ(
          i,
          lerp(gl.dry[i * 3], gl.lush[i * 3], k),
          lerp(gl.dry[i * 3 + 1], gl.lush[i * 3 + 1], k),
          lerp(gl.dry[i * 3 + 2], gl.lush[i * 3 + 2], k)
        );
      }
      attr.needsUpdate = true;
    }
    for (const tr of world.trees) {
      const k = smooth(clamp01((t * 1.25 - tr.th * 0.8) / 0.35));
      tr.folMat.color.lerpColors(tr.dry, tr.lush, k);
      tr.fol.scale.setScalar(lerp(0.82, 1.06, easeOutCubic(k)));
    }
    for (const h of hills) h.mesh.material.color.lerpColors(h.dry, h.lush, smooth(t));
    for (const l of world.lamps) l.glass.emissive.setHex(t > 0.5 ? 0xffdf8a : 0x000000);
    for (const bed of world.beds) {
      bed.soilMat.color.lerpColors(new THREE.Color(0x87683f), new THREE.Color(0x5e4529), t);
    }
  };

  /* ============ per-frame world animation ============ */
  const leafM = new THREE.Matrix4();
  const leafQ = new THREE.Quaternion();
  const leafE = new THREE.Euler();
  const leafS = new THREE.Vector3();
  const leafP = new THREE.Vector3();

  world.update = (dt, time) => {
    world.time = time;

    // mini tween queue
    for (let i = world.anims.length - 1; i >= 0; i--) {
      const a = world.anims[i];
      a.t += dt;
      if (a.t < 0) continue;
      const k = clamp01(a.t / a.dur);
      a.fn(k);
      if (k >= 1) {
        if (a.done) a.done();
        world.anims.splice(i, 1);
      }
    }

    // reservoir + open water shimmer
    const sh = 1 + Math.sin(time * 2.1) * 0.012;
    world.reservoirWater.scale.y = sh;
    if (world.basinWater.visible) world.basinWater.position.y = 0.30 + Math.sin(time * 2.4) * 0.008;

    // gap markers pulse
    for (const g of world.channels.gaps) {
      if (g.marker.visible) {
        const hot = g.marker.userData.hot ? 1.25 : 1;
        g.marker.scale.setScalar((1 + Math.sin(time * 4) * 0.12) * hot);
        g.marker.material.opacity = 0.55 + Math.sin(time * 4) * 0.25;
      }
    }

    // waterwheel
    if (world.wheelSpeed > 0.001) world.wheel.rotation.x -= world.wheelSpeed * dt;

    // fountain jets follow their on-ness with a lively wobble
    for (const n of world.nozzles) {
      if (n.jet.visible) {
        const w = 1 + Math.sin(time * 9 + n.ang * 7) * 0.1;
        n.jet.scale.set(1, Math.max(0.001, n.jetOn * w), 1);
      }
    }
    if (world.plume.visible) {
      world.plume.scale.set(1, Math.max(0.001, world.plumeOn || 0) * (1 + Math.sin(time * 8) * 0.08), 1);
    }

    // trees sway gently
    for (const tr of world.trees) {
      tr.fol.rotation.z = Math.sin(time * 0.9 + tr.swayPhase) * 0.02;
    }

    // bloomed flowers sway
    for (const p of world.plants) {
      if (p.state === 'bloomed') {
        p.group.rotation.z = Math.sin(time * 1.6 + p.swayPhase) * 0.07;
        p.group.rotation.x = Math.cos(time * 1.3 + p.swayPhase) * 0.05;
      }
    }

    // leaves: idle flutter + fly-to-basket animation
    let leafDirty = false;
    for (const lf of world.leaves) {
      if (lf.state === 'ground') {
        leafP.copy(lf.pos);
        leafE.set(-Math.PI / 2 + 0.15, 0, lf.rot);
        leafS.setScalar(lf.scale);
      } else if (lf.state === 'fly') {
        lf.t += dt * 1.4;
        const k = clamp01(lf.t);
        const b = LAYOUT.basket;
        // quadratic bezier: ground -> arc -> basket mouth
        const inv = 1 - k;
        leafP.set(
          inv * inv * lf.pos.x + 2 * inv * k * lf.ctrl.x + k * k * b.x,
          inv * inv * lf.pos.y + 2 * inv * k * lf.ctrl.y + k * k * 0.6,
          inv * inv * lf.pos.z + 2 * inv * k * lf.ctrl.z + k * k * b.z
        );
        leafE.set(lf.t * 6, lf.t * 4, lf.rot);
        leafS.setScalar(lf.scale * (1 - k * 0.55));
        if (k >= 1) { lf.state = 'done'; leafS.setScalar(0.001); }
        leafDirty = true;
      } else {
        leafP.set(0, -5, 0);
        leafS.setScalar(0.001);
      }
      leafQ.setFromEuler(leafE);
      leafM.compose(leafP, leafQ, leafS);
      world.leafInst.setMatrixAt(lf.i, leafM);
    }
    if (leafDirty || !world._leafInit) {
      world.leafInst.instanceMatrix.needsUpdate = true;
      world._leafInit = true;
    }
  };

  world.setLife(0);
  return world;
}
