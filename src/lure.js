import * as THREE from 'three';
import * as TX from './textures.js';
import { featherGeometry, strapGeometry, RoundedBoxGeometry, approach } from './util.js';

/*
 * The lure: a padded leather cushion with a pair of feathers and bright
 * streamers, swung on a cord. The falconer whirls it in a vertical circle
 * beside the body — the gesture the player copies with a finger — and the hawk
 * turns to it.
 */

export function createLure() {
  const leatherTex = TX.leather(0x6d3a1a, 0xb4763c, 5);
  leatherTex.map.repeat.set(2, 2);
  leatherTex.normalMap.repeat.set(2, 2);

  const M = {
    pad: new THREE.MeshStandardMaterial({
      map: leatherTex.map,
      normalMap: leatherTex.normalMap,
      roughness: 0.6,
      metalness: 0.02,
    }),
    cord: new THREE.MeshStandardMaterial({ color: 0xc0a679, roughness: 0.95 }),
    feather: new THREE.MeshStandardMaterial({
      map: TX.featherVane(0xc79a6d, 0x51371f, 0xf3e6cd, true).map,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
    brass: new THREE.MeshStandardMaterial({ color: 0xdcb265, roughness: 0.28, metalness: 0.9 }),
  };

  const group = new THREE.Group();

  // The pad itself, a fat stitched cushion.
  const body = new THREE.Group();
  group.add(body);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.075, 0.2, 5, 0.035), M.pad);
  pad.castShadow = true;
  body.add(pad);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 6, 22), M.pad);
  seam.rotation.x = Math.PI / 2;
  seam.scale.set(0.95, 1.25, 1);
  body.add(seam);

  const swivel = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), M.brass);
  swivel.rotation.y = Math.PI / 2;
  swivel.position.y = 0.055;
  body.add(swivel);

  // Two feathers bound to the pad, as on a real lure.
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(
      featherGeometry(0.2, 0.06, { camber: 0.24, cup: 0.38, root: 0.42 }),
      M.feather,
    );
    f.rotation.set(Math.PI * 0.5, 0, s * 0.55);
    f.position.set(s * 0.045, -0.01, -0.03);
    f.castShadow = true;
    body.add(f);
  }

  // Bright streamers — this is what a small child's eye actually tracks.
  const ribbonColors = [0xf07fa4, 0xffd166, 0x8fe0c8, 0xa79aec];
  const ribbons = [];
  ribbonColors.forEach((c, i) => {
    const r = new THREE.Mesh(
      strapGeometry(0.26 + (i % 2) * 0.07, 0.028, 0.007, 0.4),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide }),
    );
    r.position.set((i - 1.5) * 0.028, -0.03, -0.06);
    r.castShadow = true;
    body.add(r);
    ribbons.push(r);
  });

  // Cord from hand to lure, rebuilt each frame so it can bow under speed.
  const cordMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.cord);
  cordMesh.frustumCulled = false;
  const cordGroup = new THREE.Group();
  cordGroup.add(cordMesh);

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _mid = new THREE.Vector3();
  let spin = 0;

  /** Redraw the cord as a gently bowed tube between hand and lure. */
  function updateCord(handPos, lurePos, slack) {
    _a.copy(handPos);
    _b.copy(lurePos);
    _mid.copy(_a).lerp(_b, 0.5);
    _mid.y -= slack;
    const curve = new THREE.QuadraticBezierCurve3(_a.clone(), _mid.clone(), _b.clone());
    cordMesh.geometry.dispose();
    cordMesh.geometry = new THREE.TubeGeometry(curve, 12, 0.0075, 5, false);
  }

  /**
   * Orients the lure so it trails the direction of travel and spins a little,
   * and flutters the streamers by speed.
   */
  function orient(vel, dt, speed) {
    const v = _a.copy(vel);
    if (v.lengthSq() > 1e-6) {
      v.normalize();
      // The pad leads, feathers and streamers trailing behind the direction of
      // travel: the lure's own "down" points back along its path.
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, -1, 0),
        v.clone().negate(),
      );
      group.quaternion.slerp(q, approach(8, dt));
    }
    spin += dt * speed * 0.8;
    body.rotation.y = Math.sin(spin) * 0.35;
    ribbons.forEach((r, i) => {
      r.rotation.x = -Math.min(speed * 0.18, 1.1) + Math.sin(spin * 2 + i) * 0.16;
      r.rotation.z = Math.sin(spin * 1.6 + i * 1.3) * 0.22;
    });
  }

  return { group, cordGroup, updateCord, orient, materials: M };
}
