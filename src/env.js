// ---------------------------------------------------------------------------
//  The market hall.
//
//  Three deliberately separated depth bands:
//    far   (z -8 .. -26)  pillars, shutters, crates, haze, silhouetted workers
//    mid   (z -1.4 .. 1)  the work table, the fish, the craftsman
//    near  (z  1.6 .. 2.4) trays, buckets, hanging strip curtain — cropped,
//                          dark and low contrast, purely there for parallax
//  Aerial perspective comes from real fog plus a cooler, dimmer far palette.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { makeRng } from './util.js';
import {
  woodTexture, concreteTexture, steelTexture, iceTexture, crateTexture, skyTexture, clothTexture,
} from './textures.js';

export const TABLE = { w: 3.75, d: 1.42, h: 0.735, topT: 0.115 };

export function createEnvironment(scene, renderer) {
  const rng = makeRng(20260808);
  const group = new THREE.Group();
  group.name = 'hall';
  scene.add(group);

  // Aerial perspective: the haze has to bite early enough that the far bay of
  // the hall genuinely loses contrast against the mid-ground.
  const FOG = new THREE.Color('#6a7f92');
  scene.fog = new THREE.Fog(FOG, 5.0, 27);
  scene.background = skyTexture();
  scene.backgroundBlurriness = 0.6;
  scene.backgroundIntensity = 0.5;

  /* ---------------------------------------------------------- materials -- */
  const matFloor = new THREE.MeshStandardMaterial({
    color: '#6f7579', map: concreteTexture(), roughness: 0.50, metalness: 0.0, envMapIntensity: 0.5,
  });
  const matWood = new THREE.MeshPhysicalMaterial({
    color: '#d9bb8d', map: woodTexture(4), roughness: 0.55, clearcoat: 0.30, clearcoatRoughness: 0.4,
    envMapIntensity: 0.8,
  });
  const matSteel = new THREE.MeshStandardMaterial({
    color: '#b9c1c6', map: steelTexture(), roughness: 0.34, metalness: 0.85, envMapIntensity: 1.2,
  });
  const matDarkSteel = new THREE.MeshStandardMaterial({ color: '#4a5158', roughness: 0.55, metalness: 0.7 });
  const matConcrete = new THREE.MeshStandardMaterial({ color: '#6d747a', roughness: 0.88, envMapIntensity: 0.3 });
  const matFar = new THREE.MeshStandardMaterial({ color: '#586570', roughness: 0.92, envMapIntensity: 0.22 });
  const matRoof = new THREE.MeshStandardMaterial({ color: '#4a545e', roughness: 0.95, envMapIntensity: 0.2 });
  const matCrateA = new THREE.MeshStandardMaterial({ color: '#ffffff', map: crateTexture('#1f5f8c'), roughness: 0.68 });
  const matCrateB = new THREE.MeshStandardMaterial({ color: '#ffffff', map: crateTexture('#2b6f5a'), roughness: 0.68 });
  const matIce = new THREE.MeshPhysicalMaterial({
    color: '#e6f1f6', map: iceTexture(), roughness: 0.30, clearcoat: 0.8, transmission: 0.05, envMapIntensity: 1.3,
  });
  const matSilhouette = new THREE.MeshStandardMaterial({ color: '#3c4855', roughness: 0.9 });
  const matNear = new THREE.MeshStandardMaterial({ color: '#3a4149', roughness: 0.7, envMapIntensity: 0.35 });

  const add = (mesh, cast = true, receive = true) => {
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  };

  /* -------------------------------------------------------------- floor -- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // drainage channel running behind the table — a real detail of a fish hall
  const drain = new THREE.Mesh(new THREE.BoxGeometry(28, 0.05, 0.26), matDarkSteel);
  drain.position.set(0, 0.006, -2.35);
  drain.receiveShadow = true;
  group.add(drain);
  for (let i = -6; i <= 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.26), matSteel);
    bar.position.set(i * 0.62, 0.036, -2.35);
    group.add(bar);
  }

  /* -------------------------------------------------------------- table -- */
  const table = new THREE.Group();
  table.name = 'table';
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, TABLE.topT, TABLE.d), matWood);
  top.position.y = TABLE.h - TABLE.topT / 2;
  add(top);
  // laminated plank seams
  for (let i = -2; i <= 2; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, TABLE.topT + 0.002, TABLE.d + 0.002), matDarkSteel);
    seam.position.set(i * 0.62, TABLE.h - TABLE.topT / 2, 0);
    seam.material = new THREE.MeshStandardMaterial({ color: '#7d6242', roughness: 0.8 });
    table.add(seam);
  }
  const apronRail = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w - 0.16, 0.075, TABLE.d - 0.16), matSteel);
  apronRail.position.y = TABLE.h - TABLE.topT - 0.05;
  add(apronRail);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, TABLE.h - 0.12, 12), matSteel);
      leg.position.set(sx * (TABLE.w / 2 - 0.20), (TABLE.h - 0.12) / 2, sz * (TABLE.d / 2 - 0.18));
      add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.045, 12), matDarkSteel);
      foot.position.set(leg.position.x, 0.022, leg.position.z);
      add(foot);
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, TABLE.d - 0.36), matSteel);
    brace.position.set(sx * (TABLE.w / 2 - 0.20), 0.20, 0);
    add(brace);
  }
  const braceX = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w - 0.40, 0.05, 0.05), matSteel);
  braceX.position.set(0, 0.20, -TABLE.d / 2 + 0.18);
  add(braceX);
  group.add(table);

  // a second board to the side, where the loin is laid out and cut into saku
  const board = new THREE.Group();
  const boardTop = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.075, 0.82), matWood);
  boardTop.position.y = TABLE.h + 0.038;
  boardTop.castShadow = true; boardTop.receiveShadow = true;
  board.add(boardTop);
  const boardEdge = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.012, 0.84), matDarkSteel);
  boardEdge.position.y = TABLE.h + 0.002;
  board.add(boardEdge);
  board.position.set(-0.95, 0, 0.15);
  board.visible = false;
  group.add(board);

  /* --------------------------------------------------- near foreground -- */
  // These exist purely for parallax. They must never be allowed to sit between
  // the camera and the work, so every one of them fades out as the camera
  // closes on it.
  const near = new THREE.Group();
  near.name = 'foreground';
  const nearProps = [];
  const claim = (m) => {
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.depthWrite = true;
      nearProps.push(o);
    });
    return m;
  };
  {
    // stack of shallow trays, cropped by the left edge of frame
    const trayMat = new THREE.MeshStandardMaterial({ color: '#5b656f', roughness: 0.55, envMapIntensity: 0.5 });
    for (let i = 0; i < 7; i++) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.055, 0.44), trayMat);
      tray.position.set(-3.55 + rng() * 0.02, 0.80 + i * 0.052, 2.30 + (rng() - 0.5) * 0.03);
      tray.rotation.y = (rng() - 0.5) * 0.12;
      tray.castShadow = true;
      near.add(claim(tray));
    }
    const trayStand = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.80, 0.52), matNear);
    trayStand.position.set(-3.55, 0.40, 2.30);
    trayStand.castShadow = true;
    near.add(claim(trayStand));

    // steel bucket, right foreground
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.165, 0.34, 20), matSteel);
    bucket.position.set(3.30, 0.17, 2.35);
    bucket.castShadow = true;
    near.add(claim(bucket));
    const bucketRim = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.014, 8, 24), matSteel);
    bucketRim.position.set(3.30, 0.34, 2.35);
    bucketRim.rotation.x = Math.PI / 2;
    near.add(claim(bucketRim));

    // knife rack with the rest of the set
    const rack = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.55, 0.09), matNear);
    post.position.y = 0.775; post.castShadow = true; rack.add(post);
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.62), matNear);
    barTop.position.set(0, 1.42, 0.24); rack.add(barTop);
    for (let i = 0; i < 3; i++) {
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.44 + i * 0.10, 0.055), matSteel);
      kb.position.set(0.01, 1.16 - i * 0.03, 0.06 + i * 0.16);
      kb.castShadow = true;
      rack.add(kb);
      const kh = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.15, 8), matWood);
      kh.position.set(0.01, 1.40 - i * 0.03 + (0.44 + i * 0.10) / 2 - 0.15, 0.06 + i * 0.16);
      rack.add(kh);
    }
    rack.position.set(3.90, 0, 1.80);
    rack.rotation.y = -0.42;
    near.add(claim(rack));

    // hanging PVC strip curtain, top-left, deliberately cropped
    const stripMat = new THREE.MeshPhysicalMaterial({
      color: '#c8d6d2', roughness: 0.35, transmission: 0.55, thickness: 0.02,
      transparent: true, opacity: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.8,
    });
    for (let i = 0; i < 7; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 1.35), stripMat);
      strip.position.set(-4.35 + i * 0.225, 2.55, 2.55);
      strip.rotation.set(0, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.05);
      near.add(claim(strip));
    }
    const curtainRail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.10, 0.14), matNear);
    curtainRail.position.set(-3.6, 3.25, 2.55);
    near.add(claim(curtainRail));
  }
  group.add(near);

  /* ------------------------------------------------------ mid dressing -- */
  {
    // ice bin beside the table
    const bin = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.50, 0.72), matCrateA);
    bin.position.set(2.85, 0.25, -0.55);
    add(bin);
    const ice = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.13, 0.62), matIce);
    ice.position.set(2.85, 0.52, -0.55);
    add(ice);

    // a hose coiled on the floor and a wall tap: the hall is a wet place
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 8, 30), new THREE.MeshStandardMaterial({ color: '#2f6f4e', roughness: 0.6 }));
    hose.rotation.x = Math.PI / 2;
    hose.position.set(-3.1, 0.024, -1.05);
    add(hose);
    const hose2 = hose.clone(); hose2.scale.setScalar(0.78); hose2.position.y = 0.06; add(hose2);
  }

  /* -------------------------------------------------- far background ---- */
  const far = new THREE.Group();
  far.name = 'background';
  {
    // back wall + roller shutters
    const wall = new THREE.Mesh(new THREE.BoxGeometry(46, 7.2, 0.5), matConcrete);
    wall.position.set(0, 3.6, -16.5);
    wall.receiveShadow = true;
    far.add(wall);
    for (let i = -2; i <= 2; i++) {
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.5, 0.16), matFar);
      shutter.position.set(i * 5.2, 1.75, -16.2);
      far.add(shutter);
      for (let r = 0; r < 6; r++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.14, 0.05), matDarkSteel);
        slat.position.set(i * 5.2, 0.36 + r * 0.56, -16.10);
        far.add(slat);
      }
    }
    // structural pillars, staggered in depth so parallax reads
    for (let i = -3; i <= 3; i++) {
      for (const z of [-8.5, -13.5]) {
        if (Math.abs(i) < 1 && z === -8.5) continue;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.52, 6.4, 0.52), matConcrete);
        p.position.set(i * 4.6 + (z === -13.5 ? 2.3 : 0), 3.2, z);
        p.castShadow = false; p.receiveShadow = true;
        far.add(p);
        if (z === -8.5) {
          const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.78), matConcrete);
          cap2.position.set(p.position.x, 6.35, z);
          far.add(cap2);
        }
      }
    }
    // roof beams
    for (let i = -3; i <= 3; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(46, 0.28, 0.20), matFar);
      beam.position.set(0, 6.55, -3 - i * 3.6);
      far.add(beam);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 0.25, 46), matRoof);
    roof.position.set(0, 6.9, -10);
    far.add(roof);
    // side walls, so the hall never opens onto nothing
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 44), matConcrete);
      side.position.set(sx * 22, 3.6, -10);
      far.add(side);
    }

    // crate stacks
    for (let s = 0; s < 8; s++) {
      const bx = -14 + rng() * 28;
      const bz = -6.5 - rng() * 8.5;
      const n = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.34, 0.56), rng() < 0.5 ? matCrateA : matCrateB);
        c.position.set(bx + (rng() - 0.5) * 0.09, 0.17 + k * 0.345, bz + (rng() - 0.5) * 0.09);
        c.rotation.y = (rng() - 0.5) * 0.22;
        far.add(c);
      }
    }

    // other tuna waiting on pallets — the theme, restated in the distance
    for (let i = 0; i < 5; i++) {
      const px = -9 + i * 3.9 + rng() * 1.2;
      const pz = -5.4 - rng() * 2.2;
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.14, 0.95), matFar);
      pallet.position.set(px, 0.07, pz);
      far.add(pallet);
      const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.85, 4, 14), new THREE.MeshStandardMaterial({
        color: '#8b98a2', roughness: 0.4, metalness: 0.12, envMapIntensity: 0.6,
      }));
      t.rotation.z = Math.PI / 2;
      t.scale.set(1, 1, 0.72);
      t.position.set(px, 0.32, pz);
      far.add(t);
      const backMat = new THREE.MeshStandardMaterial({ color: '#26313c', roughness: 0.55 });
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 1.72, 4, 12), backMat);
      back.rotation.z = Math.PI / 2;
      back.scale.set(1, 1, 0.62);
      back.position.set(px, 0.44, pz);
      far.add(back);
      const tf = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.40, 3), backMat);
      tf.rotation.z = Math.PI / 2;
      tf.rotation.x = Math.PI / 2;
      tf.position.set(px - 1.32, 0.34, pz);
      far.add(tf);
      const df = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), backMat);
      df.position.set(px + 0.15, 0.62, pz);
      far.add(df);
    }

    // a dark back and a tail on each waiting fish, so they read from here
    // as tuna rather than as grey cylinders

    const workers = [];
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.62, 4, 10), matSilhouette);
      body.position.y = 1.10; w.add(body);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), matSilhouette);
      h.position.y = 1.60; w.add(h);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 4, 8), matSilhouette);
        leg.position.set(s * 0.09, 0.42, 0); w.add(leg);
      }
      w.position.set(-11 + rng() * 22, 0, -6 - rng() * 7);
      w.rotation.y = rng() * 6.28;
      w.userData.phase = rng() * 6.28;
      w.userData.speed = 0.10 + rng() * 0.22;
      w.userData.homeX = w.position.x;
      workers.push(w);
      far.add(w);
    }
    far.userData.workers = workers;
  }
  group.add(far);

  /* ------------------------------------------------------------ lights -- */
  const lights = new THREE.Group();
  scene.add(lights);

  const hemi = new THREE.HemisphereLight('#9fbdd4', '#2e2c28', 0.40);
  lights.add(hemi);

  // High and only slightly to the side, so the fish drops a real contact
  // shadow onto the table instead of throwing it out of frame.
  const key = new THREE.DirectionalLight('#fff0d8', 3.30);
  key.position.set(1.9, 7.4, 2.7);
  key.target.position.set(-0.15, 0.80, -0.15);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -3.6; key.shadow.camera.right = 3.6;
  key.shadow.camera.top = 3.4; key.shadow.camera.bottom = -3.4;
  key.shadow.camera.near = 2.5; key.shadow.camera.far = 16;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.022;
  key.shadow.radius = 2.4;
  lights.add(key, key.target);

  const fill = new THREE.DirectionalLight('#8fb6d4', 0.34);
  fill.position.set(-5.5, 3.4, -3.6);
  lights.add(fill);

  // cool rim from the shutters behind: separates the fish from the far bay
  const rim = new THREE.DirectionalLight('#cfe6ff', 0.85);
  rim.position.set(-2.6, 2.9, -7.5);
  lights.add(rim);

  // pendant lamps: real geometry, real point lights, real falloff
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#f6f1e2', emissive: '#ffe9c4', emissiveIntensity: 2.6, roughness: 0.4,
  });
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#3f464c', roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide });
  const lampPts = [];
  for (let i = -2; i <= 2; i++) {
    for (const z of [-1.2, -7.6]) {
      const x = i * 4.2 + (z === -7.6 ? 2.1 : 0);
      if (Math.abs(x) > 13) continue;
      const y = 4.15;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 18, 1, true), shadeMat);
      shade.position.set(x, y, z);
      far.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), lampMat);
      bulb.position.set(x, y - 0.16, z);
      far.add(bulb);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.5, 6), matDarkSteel);
      wire.position.set(x, y + 1.25, z);
      far.add(wire);
      if (z === -1.2 && Math.abs(x) < 7) {
        const pl = new THREE.PointLight('#ffdcae', 22, 13, 2.0);
        pl.position.set(x, y - 0.2, z);
        lights.add(pl);
        lampPts.push(pl);
      }
    }
  }

  /* ------------------------------------------------- environment probe -- */
  // A tiny lightbox rendered to a PMREM so steel, wet skin and clearcoat all
  // have something real to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  {
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(14, 9, 14),
      new THREE.MeshBasicMaterial({ color: '#43505c', side: THREE.BackSide }),
    );
    envScene.add(shell);
    const strip = (w, h, d, col, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      envScene.add(m);
    };
    strip(9, 9, 0, '#fff2dc', [0, 4.42, 0], [Math.PI / 2, 0, 0]);      // ceiling glow
    strip(11, 3.2, 0, '#8fb6d6', [0, 2.4, -6.9], [0, 0, 0]);           // cool far wall
    strip(11, 2.4, 0, '#5c6771', [0, 1.6, 6.9], [0, Math.PI, 0]);      // near bounce
    strip(14, 14, 0, '#6a6f70', [0, -4.4, 0], [-Math.PI / 2, 0, 0]);   // floor bounce
    for (let i = -2; i <= 2; i++) strip(1.5, 1.5, 0, '#fff6e4', [i * 3, 4.3, i * 1.4], [Math.PI / 2, 0, 0]);
  }
  const envRT = pmrem.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  /* -------------------------------------------------------------- api ---- */
  let t = 0;
  const _cw = new THREE.Vector3();
  const _ndc = new THREE.Vector3();
  const smooth = (e0, e1, x) => {
    const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return k * k * (3 - 2 * k);
  };

  /**
   * Foreground props earn their keep by framing the shot from the edges. The
   * moment one drifts toward the middle — which happens the instant the camera
   * swings for a portrait screen — it stops being parallax and starts being an
   * obstruction, so it fades out. Distance alone is not enough to catch this:
   * the test is where the prop lands on screen, and how big it is there.
   */
  function fadeForeground(camera) {
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    for (const o of nearProps) {
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      _cw.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
      const d = camera.position.distanceTo(_cw);
      const base = o.userData.baseOpacity ?? (o.userData.baseOpacity = o.material.opacity);

      const sc = Math.max(o.scale.x, o.scale.y, o.scale.z);
      const rY = (g.boundingSphere.radius * sc) / Math.max(0.2, d * tanH);
      const rX = rY / Math.max(0.2, camera.aspect);
      _ndc.copy(_cw).project(camera);
      const clear = Math.max(Math.abs(_ndc.x) - rX, Math.abs(_ndc.y) - rY);

      const a = base * smooth(0.22, 0.68, clear) * smooth(1.0, 2.0, d);
      o.material.opacity = a;
      o.visible = a > 0.02;
    }
  }

  function update(dt, camera) {
    t += dt;
    if (camera) fadeForeground(camera);
    for (const w of far.userData.workers) {
      w.position.x = w.userData.homeX + Math.sin(t * w.userData.speed + w.userData.phase) * 1.35;
      w.rotation.y = Math.cos(t * w.userData.speed + w.userData.phase) > 0 ? 1.5 : -1.5;
      w.position.y = Math.abs(Math.sin(t * w.userData.speed * 6 + w.userData.phase)) * 0.022;
    }
    for (let i = 0; i < lampPts.length; i++) {
      lampPts[i].intensity = 22 + Math.sin(t * (2.1 + i * 0.7) + i) * 0.7;
    }
  }

  return { group, table, board, key, lights, update, TABLE, matWood };
}
