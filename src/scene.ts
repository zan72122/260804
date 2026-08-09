import * as THREE from 'three';
import {
  RAIL, CABINET, CAPSULE_R, FALL_X, OUTLET, COLORS,
  CapsuleStyle, halfGap
} from './params';

export interface ClawRig {
  group: THREE.Group;          // whole claw assembly (hub position)
  trolley: THREE.Mesh;
  pole: THREE.Mesh;
  fingerPivots: THREE.Group[];
  setOpen(t: number): void;    // 0 = closed, 1 = open
}

export interface CapsuleRig {
  group: THREE.Group;          // world position
  spinner: THREE.Group;        // rolls (rotation.z)
  toy: THREE.Group;            // pendulum-lagged toy inside
  bottomMat: THREE.MeshPhysicalMaterial;
  setStyle(style: CapsuleStyle): void;
}

export interface StageRefs {
  root: THREE.Group;
  claw: ClawRig;
  capsule: CapsuleRig;
  ghostClaw: THREE.Group;
  hintRing: THREE.Sprite;
  aimBeam: THREE.Mesh;
  dropGlow: THREE.Mesh;
  outletGlow: THREE.PointLight;
  sparkles: THREE.Points;
  sparkleMat: THREE.PointsMaterial;
}

function radialGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// gradient along the rail: mint (narrow) -> warm coral (wide side)
function railGradientTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#93dcc9');
  g.addColorStop(0.5, '#b9d9b4');
  g.addColorStop(0.78, '#f2b78d');
  g.addColorStop(1, '#f79f7f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildRail(sign: 1 | -1): THREE.Mesh {
  const zA = sign * halfGap(RAIL.x0);
  const zB = sign * halfGap(RAIL.x1);
  const a = new THREE.Vector3(RAIL.x0 - 0.15, RAIL.y, zA);
  const b = new THREE.Vector3(RAIL.x1 + 0.15, RAIL.y, zB);
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(RAIL.r, RAIL.r, len, 20, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: railGradientTexture(), roughness: 0.35, metalness: 0.1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize()
  );
  mesh.castShadow = true;
  return mesh;
}

function buildClaw(): ClawRig {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xe8e6e2, roughness: 0.25, metalness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf2a9c4, roughness: 0.4, metalness: 0.2 });

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 20), metal);
  hub.castShadow = true;
  group.add(hub);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent);
  cap.position.y = 0.15;
  group.add(cap);

  const fingerPivots: THREE.Group[] = [];
  // three fingers; one pair straddles the push direction (+x)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 2; // finger 0 faces +x-ish pair layout
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 0.18, -0.12, Math.sin(angle) * 0.18);
    pivot.rotation.y = -angle;
    // finger: upper segment angling out+down, tip curving inward
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.52, 6, 12), metal);
    seg1.position.set(0.16, -0.3, 0);
    seg1.rotation.z = 0.5;
    seg1.castShadow = true;
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4, 6, 12), metal);
    seg2.position.set(0.28, -0.72, 0);
    seg2.rotation.z = -0.42;
    seg2.castShadow = true;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), accent);
    tip.position.set(0.2, -0.92, 0);
    pivot.add(seg1, seg2, tip);
    group.add(pivot);
    fingerPivots.push(pivot);
  }

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0xb9b4ac, roughness: 0.4, metalness: 0.7 })
  );
  pole.position.y = 0.7;
  group.add(pole);

  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.34), metal);
  trolley.castShadow = true;

  function setOpen(t: number): void {
    // t=1 fingers hang slightly spread, t=0 tips tuck inward to push
    for (const p of fingerPivots) p.rotation.z = -0.38 + 0.33 * t;
  }
  setOpen(1);

  return { group, trolley, pole, fingerPivots, setOpen };
}

function buildToy(kind: CapsuleStyle['toy'], color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 });
  if (kind === 'star') {
    const shape = new THREE.Shape();
    const R = 0.16, r = 0.068;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
    geo.center();
    g.add(new THREE.Mesh(geo, mat));
  } else if (kind === 'flower') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat);
      petal.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0);
      petal.scale.set(1, 1, 0.55);
      g.add(petal);
    }
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.5 })
    );
    core.scale.z = 0.6;
    core.position.z = 0.03;
    g.add(core);
  } else { // heart
    const s = new THREE.Shape();
    s.moveTo(0, -0.14);
    s.bezierCurveTo(0.16, 0.0, 0.15, 0.14, 0.0, 0.06);
    s.bezierCurveTo(-0.15, 0.14, -0.16, 0.0, 0, -0.14);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    geo.center();
    geo.scale(1.25, 1.25, 1);
    g.add(new THREE.Mesh(geo, mat));
  }
  return g;
}

function buildCapsule(): CapsuleRig {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  group.add(spinner);

  const topMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcedf5, transparent: true, opacity: 0.45,
    roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    depthWrite: false
  });
  const bottomMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2a9c4, transparent: true, opacity: 0.85,
    roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.2
  });

  // top hemisphere (clear) & bottom hemisphere (colored) — halves split on the
  // spinner's local y so the seam tumbles with the roll
  const top = new THREE.Mesh(new THREE.SphereGeometry(CAPSULE_R, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), topMat);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(CAPSULE_R * 0.995, 28, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bottomMat);
  bottom.castShadow = true;
  const seam = new THREE.Mesh(
    new THREE.TorusGeometry(CAPSULE_R * 0.995, 0.018, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
  );
  seam.rotation.x = Math.PI / 2;
  spinner.add(top, bottom, seam);

  // toy stays as a child of group (not spinner) so it can lag like a pendulum
  const toy = new THREE.Group();
  const toyInner = buildToy('star', 0xffd45e);
  toyInner.position.y = -0.08;
  toy.add(toyInner);
  group.add(toy);

  function setStyle(style: CapsuleStyle): void {
    bottomMat.color.setHex(style.bottom);
    toy.clear();
    const t = buildToy(style.toy, style.toyColor);
    t.position.y = -0.08;
    toy.add(t);
  }

  return { group, spinner, toy, bottomMat, setStyle };
}

export function buildStage(scene: THREE.Scene): StageRefs {
  const root = new THREE.Group();
  scene.add(root);

  const metalMat = new THREE.MeshStandardMaterial({ color: COLORS.metal, roughness: 0.35, metalness: 0.75 });
  const creamMat = new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.6, metalness: 0.05 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf4f2, transparent: true, opacity: 0.09,
    roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false
  });

  const { halfW, halfD, glassTop, baseTop } = CABINET;

  // ---- base pedestal ----
  const base = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.5, 1.1, halfD * 2 + 0.5), creamMat);
  base.position.y = baseTop - 0.55;
  base.receiveShadow = true;
  root.add(base);
  const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.56, 0.14, halfD * 2 + 0.56), metalMat);
  baseTrim.position.y = baseTop;
  root.add(baseTrim);

  // ---- chute tray inside base (slopes to the front-right outlet) ----
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 - 0.3, 0.12, halfD * 2 - 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd9ece2, roughness: 0.55 })
  );
  tray.position.set(0, 0.62, 0);
  tray.rotation.x = 0.075;   // slope toward front
  tray.rotation.z = -0.05;   // slope toward +x
  tray.receiveShadow = true;
  root.add(tray);

  // ---- glass walls ----
  const wallH = glassTop - baseTop;
  const wallY = baseTop + wallH / 2;
  const mkPanel = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
  // front glass leaves an opening for the outlet (capsule exits through it)
  const openL = OUTLET.x - 0.72, openR = OUTLET.x + 0.72, openTop = 1.32;
  const frontL = mkPanel(openL + halfW, wallH);
  frontL.position.set((openL - halfW) / 2, wallY, halfD);
  const frontR = mkPanel(halfW - openR, wallH);
  frontR.position.set((openR + halfW) / 2, wallY, halfD);
  const frontT = mkPanel(openR - openL, glassTop - openTop);
  frontT.position.set((openL + openR) / 2, (openTop + glassTop) / 2, halfD);
  root.add(frontL, frontR, frontT);
  const back = mkPanel(halfW * 2, wallH); back.position.set(0, wallY, -halfD); back.rotation.y = Math.PI;
  const left = mkPanel(halfD * 2, wallH); left.position.set(-halfW, wallY, 0); left.rotation.y = Math.PI / 2;
  const right = mkPanel(halfD * 2, wallH); right.position.set(halfW, wallY, 0); right.rotation.y = -Math.PI / 2;
  root.add(back, left, right);

  // ---- frame columns & top ----
  const colGeo = new THREE.BoxGeometry(0.14, wallH, 0.14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const col = new THREE.Mesh(colGeo, metalMat);
    col.position.set(sx * halfW, wallY, sz * halfD);
    root.add(col);
  }
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.4, 0.22, halfD * 2 + 0.4), metalMat);
  topCap.position.y = glassTop + 0.11;
  root.add(topCap);
  const topAccent = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 0.4, 0.1, halfD * 2 + 0.4),
    new THREE.MeshStandardMaterial({ color: 0xf2a9c4, roughness: 0.4, metalness: 0.3 })
  );
  topAccent.position.y = glassTop + 0.27;
  root.add(topAccent);

  // ---- gantry rail for the claw ----
  const gantry = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.2, 0.12, 0.22), metalMat);
  gantry.position.set(0, CABINET.gantryY, 0);
  root.add(gantry);

  // ---- rails (the ハの字 pair) + small end posts ----
  root.add(buildRail(1), buildRail(-1));
  const postMat = new THREE.MeshStandardMaterial({ color: 0xcfc9c0, roughness: 0.4, metalness: 0.6 });
  for (const ex of [RAIL.x0 - 0.15, RAIL.x1 + 0.15]) {
    for (const s of [1, -1] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, RAIL.y - baseTop, 10), postMat);
      post.position.set(ex, (RAIL.y + baseTop) / 2, s * halfGap(ex < 0 ? RAIL.x0 : RAIL.x1));
      root.add(post);
    }
  }

  // ---- widening-gap ribbon between the rails (shows where it opens up) ----
  {
    const N = 24;
    const verts: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const warm = new THREE.Color(0xffb361);
    for (let i = 0; i <= N; i++) {
      const x = RAIL.x0 + (i / N) * (RAIL.x1 - RAIL.x0);
      const hw = Math.max(0.02, halfGap(x) - RAIL.r);
      verts.push(x, RAIL.y - 0.12, -hw, x, RAIL.y - 0.12, hw);
      // additive: black = invisible, brightens toward the wide side
      const t = Math.pow(i / N, 1.6);
      const c = new THREE.Color(0x0a2e26).lerp(warm, t);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    const ribbon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    root.add(ribbon);
  }

  // ---- warm glow marking the wide/fall side ----
  const dropGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.2),
    new THREE.MeshBasicMaterial({
      map: radialGlowTexture('rgba(255,196,110,0.85)', 'rgba(255,196,110,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    })
  );
  dropGlow.rotation.x = -Math.PI / 2;
  dropGlow.position.set(FALL_X + 0.55, 0.72, 0);
  root.add(dropGlow);
  const glowLight = new THREE.PointLight(0xffc27a, 2.8, 4.5, 1.8);
  glowLight.position.set(FALL_X + 0.5, 1.6, 0);
  root.add(glowLight);

  // ---- outlet (front opening + external tray) ----
  const outletFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.16), metalMat);
  outletFrame.position.set(OUTLET.x, 1.18, halfD + 0.02);
  root.add(outletFrame);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), metalMat);
    side.position.set(OUTLET.x + s * 0.67, 0.75, halfD + 0.02);
    root.add(side);
  }
  const outerTray = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.95), creamMat);
  outerTray.position.set(OUTLET.x, 0.35, halfD + 0.5);
  outerTray.receiveShadow = true;
  root.add(outerTray);
  const trayLip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 0.1), metalMat);
  trayLip.position.set(OUTLET.x, 0.45, halfD + 0.93);
  root.add(trayLip);
  const outletGlow = new THREE.PointLight(0xffd9a0, 0, 2.5, 1.6);
  outletGlow.position.set(OUTLET.x, 0.9, halfD + 0.3);
  root.add(outletGlow);

  // ---- aim beam: soft light column under the claw while aiming ----
  const aimBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 2.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbfeee0, transparent: true, opacity: 0.11,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    })
  );
  aimBeam.position.set(0, RAIL.y + 1.05, 0);
  root.add(aimBeam);

  // ---- claw & ghost hint claw ----
  const claw = buildClaw();
  claw.group.scale.setScalar(1.15);
  claw.group.position.set(0, 4.4, 0);
  root.add(claw.group);
  claw.trolley.position.set(0, CABINET.gantryY, 0);
  root.add(claw.trolley);

  const ghostClaw = new THREE.Group();
  {
    const g = buildClaw();
    g.setOpen(0.35);
    g.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.material = new THREE.MeshBasicMaterial({
          color: 0xffb02e, transparent: true, opacity: 0.55, depthWrite: false
        });
        o.castShadow = false;
      }
    });
    ghostClaw.add(g.group);
  }
  root.add(ghostClaw);

  // pulsing marker at the contact point — visible even when the real claw
  // is already parked at the ideal spot
  const hintRing = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTexture('rgba(255,176,46,0.95)', 'rgba(255,176,46,0)'),
    transparent: true, opacity: 0.7, depthTest: false
  }));
  hintRing.scale.setScalar(0.7);
  root.add(hintRing);

  // ---- capsule ----
  const capsule = buildCapsule();
  root.add(capsule.group);

  // ---- celebration sparkles ----
  const sparkleGeo = new THREE.BufferGeometry();
  const N = 40;
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const sparkleMat = new THREE.PointsMaterial({
    size: 0.14, map: radialGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    color: 0xffe2ae
  });
  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  sparkles.visible = false;
  root.add(sparkles);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0xb9d4c9, 0.62);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2df, 2.4);
  key.position.set(3.5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5.5; key.shadow.camera.right = 5.5;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -1;
  key.shadow.camera.near = 1; key.shadow.camera.far = 20;
  key.shadow.bias = -0.002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfeaff, 0.7);
  fill.position.set(-4, 5, -3);
  scene.add(fill);

  return { root, claw, capsule, ghostClaw, hintRing, aimBeam, dropGlow, outletGlow, sparkles, sparkleMat };
}
