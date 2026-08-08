// The foundry itself: floor, walls, rafters, furnace, ladle, crane, tools.
//
// Depth is built deliberately in three bands so the picture reads at a glance:
//   far   -- brick wall, tall windows, roof trusses; desaturated into the fog
//   mid   -- furnace, mould, crane, the founder; fully lit, full detail
//   near  -- ingots, barrels, sand heaps; near-black silhouettes, cropped
// Aerial perspective comes from an exponential fog tinted with the furnace's
// own warm haze, so distance costs contrast the way it does in a real shop.

import * as THREE from '../core/three.js';
import { TEX, buildTextures, buildEnvMap, makeDotTexture, ENV } from './materials.js';
import { makeRng, TAU, lerp } from '../core/util.js';

export const FOG_COLOR = new THREE.Color(0x2b1d15);

/* helpers ------------------------------------------------------------- */
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, seg, mat, open = false) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);

function at(o, x, y, z) { o.position.set(x, y, z); return o; }

/** flat dark blob under an object -- cheap, reliable contact shadow */
function contactShadow(radius, opacity = 0.55) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(0,0,0,0.95)');
  rg.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, color: 0x000000 })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  return m;
}

export function buildWorkshop(scene, renderer) {
  buildTextures();
  const W = { group: new THREE.Group() };
  scene.add(W.group);

  scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.056);
  scene.background = FOG_COLOR.clone().multiplyScalar(0.8);
  const env = buildEnvMap(renderer);
  scene.environment = env;
  W.env = env;

  /* ================= materials ================= */
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: TEX.floor, normalMap: TEX.floorN,
      normalScale: new THREE.Vector2(0.8, 0.8), color: 0xffffff, roughness: 1.0, metalness: 0, envMapIntensity: 0.4 }),
    brick: new THREE.MeshStandardMaterial({ map: TEX.brick, normalMap: TEX.brickN,
      normalScale: new THREE.Vector2(1.0, 1.0), color: 0xffffff, roughness: 0.98, metalness: 0, envMapIntensity: 0.45 }),
    brickDark: new THREE.MeshStandardMaterial({ map: TEX.brick, normalMap: TEX.brickN,
      normalScale: new THREE.Vector2(0.9, 0.9), color: 0x6f5a4c, roughness: 0.98, metalness: 0 }),
    // the casting pit: sooty stone, not brick -- a red disc under the bell
    // was the most obviously plastic object left in the frame
    stone: new THREE.MeshStandardMaterial({ map: TEX.floor, normalMap: TEX.floorN,
      normalScale: new THREE.Vector2(1.1, 1.1), color: 0x6a6158, roughness: 0.99, metalness: 0, envMapIntensity: 0.25 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: 0.62, metalness: 0.85, envMapIntensity: 0.6 }),
    ironDark: new THREE.MeshStandardMaterial({ color: 0x211d1a, roughness: 0.72, metalness: 0.7, envMapIntensity: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.88, metalness: 0 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x3a2819, roughness: 0.92, metalness: 0 }),
    silhouette: new THREE.MeshStandardMaterial({ color: 0x120d0a, roughness: 1, metalness: 0 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x7a5136, roughness: 0.98, metalness: 0, envMapIntensity: 0.4 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb98a63, roughness: 0.85, metalness: 0, envMapIntensity: 0.4 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.78, metalness: 0.05 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2a3a30, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.55 }),
  };
  W.M = M;

  /* ================= far band: shell ================= */
  const far = new THREE.Group(); W.group.add(far); W.far = far;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  W.group.add(floor);
  W.floor = floor;

  // back wall + tall arched windows
  const wall = box(30, 9.5, 0.6, M.brick);
  at(wall, 0, 4.75, -8.2); wall.receiveShadow = true; far.add(wall);

  const glowTex = makeDotTexture(0.62, 128);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xbcd4f2, fog: true });
  const shaftMat = new THREE.MeshBasicMaterial({
    map: glowTex, color: 0xa9c6ea, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  W.windows = [];
  for (let i = -2; i <= 2; i++) {
    const x = i * 4.6;
    const s = new THREE.Shape();
    s.moveTo(-0.75, 0); s.lineTo(-0.75, 2.6);
    s.absarc(0, 2.6, 0.75, Math.PI, 0, true);
    s.lineTo(0.75, 0); s.lineTo(-0.75, 0);
    const g = new THREE.ShapeGeometry(s);
    const win = new THREE.Mesh(g, winMat);
    at(win, x, 3.5, -7.88);
    far.add(win); W.windows.push(win);
    // mullions
    for (const mx of [-0.26, 0.26]) { const b = box(0.07, 3.9, 0.1, M.brickDark); at(b, x + mx, 4.6, -7.84); far.add(b); }
    const bm = box(1.6, 0.08, 0.1, M.brickDark); at(bm, x, 5.1, -7.84); far.add(bm);
    // volumetric-ish light shaft
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 9.5), shaftMat);
    at(shaft, x + 1.1, 3.0, -5.4); shaft.rotation.y = 0.22; shaft.rotation.z = -0.30;
    shaft.renderOrder = 3;
    far.add(shaft);
  }

  // left wall closes the frame in landscape
  const lwall = box(0.6, 9.5, 17, M.brick);
  at(lwall, -8.6, 4.75, -1.0); far.add(lwall);

  // roof trusses -- read as scale reference above the bell
  for (let i = 0; i < 5; i++) {
    const z = -6.6 + i * 2.4;
    const beam = box(18, 0.34, 0.3, M.woodDark); at(beam, 0, 6.6, z); far.add(beam);
    const br1 = box(0.26, 0.26, 2.6, M.woodDark); at(br1, -5.4, 7.1, z); br1.rotation.x = 0.5; far.add(br1);
    const br2 = box(0.26, 0.26, 2.6, M.woodDark); at(br2, 5.4, 7.1, z); br2.rotation.x = -0.5; far.add(br2);
  }
  const ridge = box(0.4, 0.4, 17, M.woodDark); at(ridge, 0, 7.5, -1); far.add(ridge);

  // distant shelving, silhouetted
  const rng = makeRng(7);
  for (let i = 0; i < 16; i++) {
    const b = box(0.4 + rng() * 0.7, 0.5 + rng() * 1.4, 0.4 + rng() * 0.5, M.silhouette);
    at(b, -7.4 + rng() * 2.0, 0.4 + rng() * 2.4, -6.6 + rng() * 5.5);
    far.add(b);
  }

  /* ================= furnace ================= */
  const furnace = new THREE.Group();
  at(furnace, -3.85, 0, -1.7);
  furnace.rotation.y = 0.42;
  W.group.add(furnace); W.furnace = furnace;

  const fBase = box(2.9, 1.15, 2.5, M.brick); at(fBase, 0, 0.575, 0); fBase.castShadow = true; furnace.add(fBase);
  const fBody = box(2.55, 1.9, 2.25, M.brick); at(fBody, 0, 2.06, 0); fBody.castShadow = true; furnace.add(fBody);
  const fCap = box(2.75, 0.22, 2.45, M.brickDark); at(fCap, 0, 3.12, 0); furnace.add(fCap);
  const chim = cyl(0.30, 0.36, 3.2, 14, M.brickDark); at(chim, 0, 4.7, -0.7); chim.castShadow = true; furnace.add(chim);
  const chimCap = cyl(0.42, 0.36, 0.18, 14, M.ironDark); at(chimCap, 0, 6.35, -0.7); furnace.add(chimCap);
  // iron banding gives the mass a believable build
  for (const y of [1.35, 2.75]) {
    const b = box(2.62, 0.12, 2.32, M.iron); at(b, 0, y, 0); furnace.add(b);
  }

  // arched mouth cut into the front plate
  {
    const s = new THREE.Shape();
    s.moveTo(-1.28, -0.95); s.lineTo(1.28, -0.95); s.lineTo(1.28, 0.95); s.lineTo(-1.28, 0.95); s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.62, -0.95); hole.lineTo(-0.62, 0.18);
    hole.absarc(0, 0.18, 0.62, Math.PI, 0, true);
    hole.lineTo(0.62, -0.95); hole.closePath();
    s.holes.push(hole);
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }), M.brickDark);
    at(plate, 0, 2.06, 1.13); furnace.add(plate);
  }
  // hot interior
  const hearthMat = new THREE.MeshBasicMaterial({ color: 0x120806, fog: false });
  const hearth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), hearthMat);
  at(hearth, 0, 2.06, 0.55); furnace.add(hearth);
  W.hearthMat = hearthMat;

  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, color: 0xff8c33, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const fGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), glowMat);
  at(fGlow, 0, 2.0, 1.46); furnace.add(fGlow);
  W.furnaceGlow = fGlow; W.furnaceGlowMat = glowMat;

  // crucible sitting in the hearth
  const cruc = cyl(0.44, 0.36, 0.78, 18, M.ironDark);
  at(cruc, 0, 1.62, 0.42); furnace.add(cruc);
  W.crucible = cruc;
  const crucMelt = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, fog: false }));
  crucMelt.rotation.x = -Math.PI / 2;
  at(crucMelt, 0, 1.94, 0.42); crucMelt.visible = false; furnace.add(crucMelt);
  W.crucibleMelt = crucMelt;

  // sliding safety door -- its own material so it can glow when the furnace
  // behind it is running; with the door shut it is the only thing the player
  // can see of the fire, so it has to carry the news
  const door = new THREE.Group();
  const doorMat = M.iron.clone();
  W.doorMat = doorMat;
  const dPlate = box(1.55, 2.05, 0.12, doorMat); at(dPlate, 0, 0, 0); dPlate.castShadow = true; door.add(dPlate);
  for (const y of [-0.72, 0, 0.72]) { const rib = box(1.6, 0.1, 0.18, M.ironDark); at(rib, 0, y, 0.04); door.add(rib); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 8, 16), M.ironDark);
  at(handle, 0.55, 0, 0.14); door.add(handle);
  at(door, -1.62, 2.06, 1.26);          // parked open, to the side
  furnace.add(door);
  W.door = door;
  W.doorOpenX = -1.62; W.doorShutX = 0;

  // rails the door runs on
  for (const y of [1.05, 3.06]) { const rail = box(3.4, 0.08, 0.2, M.ironDark); at(rail, -0.8, y, 1.26); furnace.add(rail); }

  /* ================= casting pit / mould plinth ================= */
  const plinth = cyl(1.34, 1.46, 0.22, 40, M.stone);
  at(plinth, 0, 0.11, 0); plinth.receiveShadow = true; plinth.castShadow = true;
  W.group.add(plinth); W.plinth = plinth;
  const sandRing = cyl(1.9, 2.0, 0.09, 40, M.floor);
  at(sandRing, 0, 0.045, 0); sandRing.receiveShadow = true; W.group.add(sandRing);
  const cs = contactShadow(2.3, 0.6); at(cs, 0, 0.012, 0); W.group.add(cs);

  /* ================= crane ================= */
  const crane = new THREE.Group(); W.group.add(crane); W.crane = crane;
  for (const x of [-4.9, 4.3]) {
    const post = box(0.34, 6.0, 0.34, M.iron); at(post, x, 3.0, -0.5); post.castShadow = true; crane.add(post);
    const foot = box(0.8, 0.16, 0.8, M.ironDark); at(foot, x, 0.08, -0.5); crane.add(foot);
    const brace = box(0.16, 0.16, 2.2, M.iron); at(brace, x, 5.2, 0.5); brace.rotation.x = 0.72; crane.add(brace);
  }
  const gantry = box(10.8, 0.42, 0.36, M.iron); at(gantry, -0.3, 6.0, -0.5); gantry.castShadow = true; crane.add(gantry);
  const gantry2 = box(10.8, 0.14, 0.5, M.ironDark); at(gantry2, -0.3, 5.76, -0.5); crane.add(gantry2);
  const trolley = box(0.8, 0.5, 0.7, M.ironDark); at(trolley, 0, 5.58, -0.5); crane.add(trolley);
  const sheave = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 18), M.iron);
  at(sheave, 0, 5.5, -0.16); crane.add(sheave); W.sheave = sheave;
  // move the hoist line over the bell axis
  const trolleyArm = box(0.24, 0.24, 0.9, M.ironDark); at(trolleyArm, 0, 5.58, -0.1); crane.add(trolleyArm);

  /* ---- chain: instanced links so it can pay out believably ---- */
  const LINKS = 44;
  const linkGeo = new THREE.TorusGeometry(0.085, 0.026, 6, 12);
  const chain = new THREE.InstancedMesh(linkGeo, M.iron, LINKS);
  chain.castShadow = false;
  chain.frustumCulled = false;
  crane.add(chain);
  W.chain = chain; W.chainLinks = LINKS;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  /** hang the chain from the sheave down to `y`, at x/z */
  W.setChain = (topY, botY, x = 0, z = 0, sway = 0) => {
    const span = Math.max(0.001, topY - botY);
    const step = span / LINKS;
    for (let i = 0; i < LINKS; i++) {
      const u = i / LINKS;
      const y = topY - i * step;
      const s = Math.sin(u * 3.1 + sway * 4) * sway * 0.06 * (1 - u);
      _p.set(x + s, y, z);
      _e.set(i % 2 ? 0 : Math.PI / 2, 0, Math.PI / 2);
      _q.setFromEuler(_e);
      const sc = Math.min(1, step / 0.14);
      _s.set(1, 1, Math.max(0.4, sc));
      _m.compose(_p, _q, _s);
      chain.setMatrixAt(i, _m);
    }
    chain.instanceMatrix.needsUpdate = true;
  };
  W.setChain(5.5, 4.6);

  const hook = new THREE.Group();
  const hookBody = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 14, Math.PI * 1.45), M.iron);
  hookBody.rotation.z = Math.PI * 0.25; hook.add(hookBody);
  const hookShank = box(0.09, 0.34, 0.09, M.iron); at(hookShank, 0, 0.28, 0); hook.add(hookShank);
  at(hook, 0, 4.6, 0);
  crane.add(hook); W.hook = hook;

  /* ================= ladle + pouring lever ================= */
  const ladleRig = new THREE.Group();
  // Far enough left that its mast never stands in front of the bell -- the
  // pivot is now ~1.9 m from the casting axis while the ladle only reaches
  // 1.0 m, so the ladle can never swing over the bell either.
  at(ladleRig, -1.70, 0, 0.90);
  W.group.add(ladleRig); W.ladleRig = ladleRig;

  // Jib arm carrying the ladle over the mould.  It has to clear the tallest
  // flask plus its pouring cup, so the whole rig is sized off the temple bell.
  const jibPost = box(0.3, 5.3, 0.3, M.iron); at(jibPost, -0.9, 2.65, -0.6); jibPost.castShadow = true; ladleRig.add(jibPost);
  const jibFoot = cyl(0.62, 0.7, 0.16, 16, M.ironDark); at(jibFoot, -0.9, 0.08, -0.6); ladleRig.add(jibFoot);
  const jibArm = box(2.2, 0.24, 0.24, M.iron); at(jibArm, 0.15, 5.02, -0.6); jibArm.castShadow = true; ladleRig.add(jibArm);
  const jibStay = box(2.0, 0.12, 0.12, M.iron); at(jibStay, 0.1, 4.24, -0.6); jibStay.rotation.z = 0.38; ladleRig.add(jibStay);
  const yokeBar = box(0.14, 1.0, 0.14, M.iron); at(yokeBar, 1.0, 4.55, -0.6); ladleRig.add(yokeBar);
  const trunnion = box(0.12, 0.12, 1.1, M.iron); at(trunnion, 1.0, 4.05, -0.6); ladleRig.add(trunnion);

  const ladle = new THREE.Group();       // pivots about the trunnion axis (z)
  at(ladle, 1.0, 4.05, -0.16);
  ladleRig.add(ladle); W.ladle = ladle;

  const bowlOuter = cyl(0.60, 0.44, 0.74, 22, M.ironDark);
  at(bowlOuter, 0, -0.30, 0); bowlOuter.castShadow = true; ladle.add(bowlOuter);
  const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.045, 8, 24), M.iron);
  at(bowlRim, 0, 0.06, 0); bowlRim.rotation.x = Math.PI / 2; ladle.add(bowlRim);
  // pouring lip
  const lip = cyl(0.2, 0.13, 0.3, 10, M.ironDark, true);
  at(lip, 0.58, 0.06, 0); lip.rotation.z = -1.15; ladle.add(lip);
  W.ladleLip = new THREE.Object3D(); at(W.ladleLip, 0.70, 0.10, 0); ladle.add(W.ladleLip);
  // trunnion arms
  for (const z of [-0.62, 0.62]) { const a2 = box(0.1, 0.1, 0.5, M.iron); at(a2, 0, 0.0, z * 0.55); ladle.add(a2); }

  // molten surface inside the ladle -- counter-rotated to stay level
  const meltMat = new THREE.MeshBasicMaterial({ color: 0xffa040, fog: false });
  const melt = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), meltMat);
  melt.rotation.x = -Math.PI / 2;
  at(melt, 0, -0.08, 0); melt.visible = false;
  ladle.add(melt);
  W.ladleMelt = melt; W.ladleMeltMat = meltMat;

  // the big lever the child pulls
  const leverRig = new THREE.Group();
  at(leverRig, 1.55, 0, 1.85);
  W.group.add(leverRig); W.leverRig = leverRig;
  const lvBase = box(0.7, 0.34, 0.9, M.ironDark); at(lvBase, 0, 0.17, 0); leverRig.add(lvBase);
  const lvQuad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20, 1, false, 0, Math.PI), M.iron);
  at(lvQuad, 0, 0.5, 0); lvQuad.rotation.x = Math.PI / 2; leverRig.add(lvQuad);
  const lever = new THREE.Group(); at(lever, 0, 0.5, 0); leverRig.add(lever); W.lever = lever;
  const lvArm = box(0.14, 1.5, 0.14, M.iron); at(lvArm, 0, 0.75, 0); lvArm.castShadow = true; lever.add(lvArm);
  const lvKnob = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), M.wood);
  at(lvKnob, 0, 1.56, 0); lvKnob.castShadow = true; lever.add(lvKnob);
  W.leverKnob = lvKnob;

  /* ================= near band: silhouettes ================= */
  const near = new THREE.Group(); W.group.add(near); W.near = near;
  const rn = makeRng(31);
  // stacked ingots
  for (let i = 0; i < 7; i++) {
    const b = box(0.7, 0.16, 0.3, M.silhouette);
    at(b, 3.15 + (i % 2) * 0.06, 0.08 + i * 0.16, 3.15 + rn() * 0.12);
    b.rotation.y = rn() * 0.2; near.add(b);
  }
  // barrels
  for (const [x, z, r] of [[-3.5, 3.4, 0.42], [-2.6, 3.9, 0.38], [4.4, 2.4, 0.4]]) {
    const b = cyl(r, r * 0.95, 1.0, 14, M.silhouette); at(b, x, 0.5, z); near.add(b);
    const t = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 6, 14), M.silhouette);
    at(t, x, 0.72, z); t.rotation.x = Math.PI / 2; near.add(t);
  }
  // sand heap
  const heap = cyl(0.05, 1.5, 0.75, 18, M.silhouette); at(heap, -4.9, 0.37, 3.2); near.add(heap);
  // tool rack with long-handled tools
  const rack = box(0.12, 2.2, 0.12, M.silhouette); at(rack, 5.0, 1.1, 3.0); near.add(rack);
  for (let i = 0; i < 5; i++) {
    const t = cyl(0.035, 0.035, 2.1 + rn() * 0.5, 6, M.silhouette);
    at(t, 4.7 + i * 0.17, 1.05, 3.05 + rn() * 0.2);
    t.rotation.z = (rn() - 0.5) * 0.28; near.add(t);
  }
  // Low walls that crop only the corners of the frame.  A full-width one reads
  // as a black bar across the bottom of a phone; broken into two it does the
  // same depth job while leaving the working area clear.
  for (const s of [-1, 1]) {
    const front = box(7.5, 0.46, 0.5, M.silhouette);
    at(front, s * 6.0, 0.23, 4.9); near.add(front);
    const postF = box(0.28, 1.5, 0.28, M.silhouette);
    at(postF, s * 2.9, 0.75, 4.9); near.add(postF);
  }

  /* ---- water trough: rings out when the bell speaks ---- */
  const trough = new THREE.Group(); at(trough, 2.85, 0, 2.05); W.group.add(trough);
  const tOut = box(1.7, 0.55, 0.95, M.woodDark); at(tOut, 0, 0.275, 0); trough.add(tOut);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x14303a, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.6,
  });
  const waterU = { uTime: { value: 0 }, uRipple: { value: 0 } };
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waterU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;uniform float uRipple;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float d = length(position.xy);
        float w = sin(d*26.0 - uTime*7.0) * 0.012 * uRipple * exp(-d*1.1)
                + sin(position.x*7.0 + uTime*1.2) * 0.0022;
        transformed.z += w;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float dd = length(position.xy);
        float slope = cos(dd*26.0 - uTime*7.0) * 0.3 * uRipple * exp(-dd*1.1);
        objectNormal = normalize(vec3(-slope*position.x/max(dd,0.001), -slope*position.y/max(dd,0.001), 1.0));`);
  };
  waterMat.customProgramCacheKey = () => 'waterMat';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.78, 40, 24), waterMat);
  water.rotation.x = -Math.PI / 2; at(water, 0, 0.44, 0);
  trough.add(water);
  W.water = water; W.waterU = waterU;

  /* ---- hanging odds and ends that sway when the bell rings ---- */
  W.swingers = [];
  const addSwinger = (mesh, x, y, z, len) => {
    const pivot = new THREE.Group(); at(pivot, x, y, z); W.group.add(pivot);
    at(mesh, 0, -len, 0); pivot.add(mesh);
    const cord = cyl(0.012, 0.012, len, 5, M.ironDark); at(cord, 0, -len / 2, 0); pivot.add(cord);
    W.swingers.push({ pivot, phase: Math.random() * TAU, amp: 0 });
    return pivot;
  };
  {
    const lantern = new THREE.Group();
    const lm = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.7, metalness: 0.4 });
    lantern.add(box(0.22, 0.3, 0.22, lm));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false }));
    lantern.add(flame);
    W.lanternFlame = flame;
    addSwinger(lantern, -2.5, 5.4, 1.6, 0.9);
  }
  {
    const bucket = cyl(0.2, 0.16, 0.34, 12, M.ironDark);
    addSwinger(bucket, 2.4, 5.2, -1.8, 1.2);
  }
  {
    const plumb = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), M.iron);
    plumb.rotation.x = Math.PI;
    addSwinger(plumb, 4.4, 4.6, 0.9, 1.5);
  }
  {
    const hookIdle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12, Math.PI * 1.4), M.iron);
    addSwinger(hookIdle, -5.2, 5.0, -0.5, 1.0);
  }

  /* ---- birds on the truss: they scatter at the first strike ---- */
  W.birds = [];
  {
    const bm = new THREE.MeshStandardMaterial({ color: 0x1c1613, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bm);
      body.scale.set(1.5, 1, 1); b.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bm);
      at(head, 0.13, 0.07, 0); b.add(head);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), bm);
      at(tail, -0.16, 0.01, 0); tail.rotation.z = Math.PI / 2; b.add(tail);
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), bm);
      at(wingL, -0.01, 0.03, 0.07); b.add(wingL);
      const wingR = wingL.clone(); at(wingR, -0.01, 0.03, -0.07); b.add(wingR);
      at(b, -3.2 + i * 2.1 + Math.random() * 0.5, 6.79, -4.2 + (i % 2) * 2.4);
      b.rotation.y = Math.random() * TAU;
      W.group.add(b);
      W.birds.push({ obj: b, wings: [wingL, wingR], home: b.position.clone(), flying: 0, vel: new THREE.Vector3() });
    }
  }

  /* ================= the founder (adult) ================= */
  const man = new THREE.Group();
  at(man, -2.25, 0, 1.35); man.rotation.y = 0.85;
  W.group.add(man); W.founder = man;
  {
    const legL = cyl(0.13, 0.11, 0.9, 10, M.cloth); at(legL, -0.14, 0.45, 0); man.add(legL);
    const legR = cyl(0.13, 0.11, 0.9, 10, M.cloth); at(legR, 0.14, 0.45, 0); man.add(legR);
    const bootL = box(0.22, 0.14, 0.34, M.leather); at(bootL, -0.14, 0.07, 0.05); man.add(bootL);
    const bootR = box(0.22, 0.14, 0.34, M.leather); at(bootR, 0.14, 0.07, 0.05); man.add(bootR);
    const torso = cyl(0.27, 0.32, 0.78, 12, M.cloth); at(torso, 0, 1.28, 0); torso.castShadow = true; man.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), M.skin); at(head, 0, 1.86, 0); man.add(head);
    const armL = new THREE.Group(); at(armL, -0.34, 1.55, 0); man.add(armL);
    const armR = new THREE.Group(); at(armR, 0.34, 1.55, 0); man.add(armR);
    for (const [g, s] of [[armL, -1], [armR, 1]]) {
      const up = cyl(0.09, 0.08, 0.6, 8, M.cloth); at(up, 0, -0.3, 0); g.add(up);
      const lo = cyl(0.08, 0.07, 0.55, 8, M.cloth); at(lo, 0, -0.85, 0); g.add(lo);
      g.rotation.z = s * 0.16;
    }
    W.founderArms = [armL, armR];
    man.add(contactShadow(0.7, 0.5));

    // protective gear -- hidden until the player has him kit up
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.15, 0.16), M.leather);
    at(apron, 0, 1.15, 0.24); apron.visible = false; man.add(apron);
    const strapL = box(0.07, 0.5, 0.07, M.leather); at(strapL, -0.19, 1.62, 0.16); strapL.rotation.x = -0.2; strapL.visible = false; man.add(strapL);
    const strapR = strapL.clone(); at(strapR, 0.19, 1.62, 0.16); man.add(strapR);
    const gloveL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), M.leather);
    at(gloveL, -0.34, 0.75, 0); gloveL.visible = false; man.add(gloveL);
    const gloveR = gloveL.clone(); at(gloveR, 0.34, 0.75, 0); man.add(gloveR);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 10, 0, TAU, 0, Math.PI * 0.55), M.leather);
    at(helmet, 0, 1.88, 0); helmet.visible = false; man.add(helmet);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18), M.leather);
    at(brim, 0, 1.83, 0); brim.visible = false; man.add(brim);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.215, 14, 10, -0.9, 1.8, 0.55, 1.0), M.glass);
    at(visor, 0, 1.86, 0.02); visor.visible = false; man.add(visor);

    W.gear = {
      apron: [apron, strapL, strapR],
      gloves: [gloveL, gloveR],
      helmet: [helmet, brim, visor],
    };
  }

  /* ================= lighting ================= */
  const hemi = new THREE.HemisphereLight(0x8ea6c8, 0x4a3626, 0.34);
  scene.add(hemi); W.hemi = hemi;

  const key = new THREE.DirectionalLight(0xe6ecff, 3.30);
  key.position.set(-6.5, 9.0, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 2; key.shadow.camera.far = 26;
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.03;
  scene.add(key); scene.add(key.target);
  key.target.position.set(0, 1.4, 0);
  W.key = key;

  // cool rim from the windows behind -- separates silhouettes from the wall
  const rim = new THREE.DirectionalLight(0x8fb4e8, 1.15);
  rim.position.set(3.5, 5.5, -8);
  scene.add(rim); W.rim = rim;

  // the furnace's own light, driven by the stages
  const fire = new THREE.PointLight(0xff8a34, 0, 20, 2);
  fire.position.set(-3.3, 2.2, -0.6);
  scene.add(fire); W.fireLight = fire;

  // travels with the molten stream
  const pourLight = new THREE.PointLight(0xffa552, 0, 16, 2);
  pourLight.position.set(0, 2.6, 0);
  scene.add(pourLight); W.pourLight = pourLight;

  // fill on the mould so the near side never goes muddy
  const fill = new THREE.PointLight(0xffd0a2, 13, 15, 2);
  fill.position.set(2.6, 3.0, 3.4);
  scene.add(fill); W.fill = fill;

  // The work light over the casting pit.  This is what separates the mid band
  // from the background: whatever is on the axis is simply brighter than the
  // room around it, which is how a real shop is lit and how the eye finds the
  // subject without being told where to look.
  const work = new THREE.SpotLight(0xffe2be, 55, 14, 0.72, 0.55, 1.6);
  work.position.set(1.1, 6.2, 2.4);
  work.target.position.set(0, 1.2, 0);
  scene.add(work); scene.add(work.target);
  W.work = work;

  // a low practical by the furnace so that corner never dies
  const forgeFill = new THREE.PointLight(0xffb87a, 12, 9, 2);
  forgeFill.position.set(-2.6, 2.6, 1.4);
  scene.add(forgeFill); W.forgeFill = forgeFill;

  W.time = 0;
  return W;
}

/* ------------------------------------------------------------------ *
 *  per-frame life: flame flicker, sway, birds, water                   *
 * ------------------------------------------------------------------ */
export function updateWorkshop(W, dt, t) {
  W.time = t;

  // lantern flicker
  if (W.lanternFlame) {
    const f = 0.85 + Math.sin(t * 11.3) * 0.08 + Math.sin(t * 4.1) * 0.07;
    W.lanternFlame.scale.setScalar(f);
  }

  // hanging things settle back to rest
  for (const s of W.swingers) {
    s.amp *= Math.exp(-dt * 0.75);
    const a = s.amp;
    s.pivot.rotation.z = Math.sin(t * 2.6 + s.phase) * a;
    s.pivot.rotation.x = Math.cos(t * 2.2 + s.phase * 1.7) * a * 0.7;
  }

  // birds: perched idle, or a startled flight arc
  for (const b of W.birds) {
    if (b.flying > 0) {
      b.flying -= dt;
      b.vel.y += dt * 0.6;
      b.obj.position.addScaledVector(b.vel, dt);
      b.obj.rotation.y += dt * 0.8;
      const flap = Math.sin(t * 26 + b.home.x) * 0.9;
      b.wings[0].rotation.x = flap; b.wings[1].rotation.x = -flap;
      if (b.flying <= 0) { b.obj.visible = false; }
    } else if (b.obj.visible) {
      const bob = Math.sin(t * 1.6 + b.home.x * 3) * 0.012;
      b.obj.position.y = b.home.y + bob;
      b.obj.rotation.y += Math.sin(t * 0.7 + b.home.z) * dt * 0.3;
    }
  }

  if (W.waterU) {
    W.waterU.uTime.value = t;
    W.waterU.uRipple.value = Math.max(0, W.waterU.uRipple.value - dt * 0.45);
  }
}

/** shake every hanging object and ring the trough -- the bell's voice made visible */
export function shakeWorkshop(W, power = 1) {
  for (const s of W.swingers) s.amp = Math.max(s.amp, 0.16 * power);
  if (W.waterU) W.waterU.uRipple.value = Math.min(1.6, W.waterU.uRipple.value + 1.2 * power);
  for (const b of W.birds) {
    if (b.flying <= 0 && b.obj.visible) {
      b.flying = 4.0;
      b.vel.set((Math.random() - 0.5) * 3.2, 1.6 + Math.random() * 1.2, 1.5 + Math.random() * 2.0);
    }
  }
}
