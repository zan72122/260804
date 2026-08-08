// Shared material library. UVs are authored in metres (see applyBoxUV), so one
// texture instance per material serves the whole scene at a consistent scale.

import * as THREE from '../vendor/three.module.js';
import * as T from './textures.js';
import { applySmoke } from './smoke.js';

function std(texSet, params = {}) {
  const m = new THREE.MeshStandardMaterial({
    ...texSet,
    roughness: 1.0,
    metalness: 0.0,
    ...params,
  });
  if (m.normalMap && params.normalScale) m.normalScale.copy(params.normalScale);
  return applySmoke(m);
}

let M = null;

export function buildMaterials() {
  if (M) return M;
  const nx = (s) => new THREE.Vector2(s, s);

  M = {
    floor: std(T.oakFloor(), { normalScale: nx(0.85), envMapIntensity: 0.5 }),
    wall: std(T.wallPaint([0.70, 0.67, 0.62]), { normalScale: nx(0.18) }),
    wallWarm: std(T.wallPaint([0.74, 0.63, 0.52], 23), { normalScale: nx(0.18) }),
    wallKid: std(T.wallPaint([0.62, 0.70, 0.74], 25), { normalScale: nx(0.18) }),
    ceiling: std(T.ceilingPlaster(), { normalScale: nx(0.22) }),
    joinery: std(T.paintedJoinery(), { normalScale: nx(0.22), roughness: 0.62, envMapIntensity: 0.5 }),
    joineryDark: std(T.paintedJoinery([0.26, 0.20, 0.15]), { normalScale: nx(0.22), roughness: 0.66, envMapIntensity: 0.5 }),
    hose: std(T.hoseJacket(), { normalScale: nx(1.0), roughness: 0.75 }),

    turnoutCoat: std(T.turnoutShell([0.50, 0.28, 0.055]), { normalScale: nx(0.8) }),
    turnoutTrouser: std(T.turnoutShell([0.44, 0.24, 0.05]), { normalScale: nx(0.8) }),
    tape: std(T.reflectiveTape(), {
      normalScale: nx(0.5), roughness: 0.35, metalness: 0.08,
      // Retro-reflective tape throws light straight back at the source; a little
      // emissive keeps it reading as the brightest thing in the smoke.
      emissive: new THREE.Color(0x2b3213), emissiveIntensity: 1.0,
    }),
    cylinder: std(T.filamentWound(), { normalScale: nx(0.6), roughness: 0.3, metalness: 0.0, envMapIntensity: 0.8 }),

    alu: std(T.brushedMetal([0.66, 0.67, 0.70]), { metalness: 0.95, roughness: 0.32, normalScale: nx(0.4), envMapIntensity: 1.0 }),
    steelDark: std(T.brushedMetal([0.30, 0.31, 0.33], 103), { metalness: 0.9, roughness: 0.45, normalScale: nx(0.4) }),
    brass: std(T.brushedMetal([0.72, 0.55, 0.24], 107), { metalness: 0.95, roughness: 0.30, normalScale: nx(0.4) }),

    rubber: std(T.rubber(), { roughness: 0.78, normalScale: nx(0.7) }),
    // Nomex hood: knitted, completely matte, soaks up the torch beam.
    hood: std(T.wovenWool([0.085, 0.082, 0.086], 149, 110), { roughness: 1.0, normalScale: nx(0.5), envMapIntensity: 0.15 }),
    webbing: std(T.wovenWool([0.075, 0.073, 0.078], 151, 140), { roughness: 0.94, normalScale: nx(0.6), envMapIntensity: 0.2 }),
    rubberGrey: std(T.rubber([0.13, 0.13, 0.14], 193), { roughness: 0.72, normalScale: nx(0.7) }),

    sofa: std(T.wovenWool([0.24, 0.26, 0.32], 133, 80), { normalScale: nx(0.45) }),
    cushion: std(T.wovenWool([0.42, 0.26, 0.24], 137, 80), { normalScale: nx(0.45) }),
    rug: std(T.wovenWool([0.45, 0.33, 0.26], 141, 120), { normalScale: nx(0.6) }),
    bedding: std(T.wovenWool([0.66, 0.62, 0.70], 145, 60), { normalScale: nx(0.4) }),

    furTeddy: std(T.plushFur([0.66, 0.46, 0.26]), { normalScale: nx(1.0) }),
    furMuzzle: std(T.plushFur([0.86, 0.74, 0.56], 155), { normalScale: nx(0.9) }),
    furKitten: std(T.plushFur([0.60, 0.56, 0.52], 159), { normalScale: nx(1.0) }),
    furKittenPale: std(T.plushFur([0.86, 0.83, 0.78], 161), { normalScale: nx(1.0) }),

    glassLens: applySmoke(new THREE.MeshPhysicalMaterial({
      color: 0x141820, roughness: 0.06, metalness: 0.0,
      transmission: 0.0, opacity: 0.62, transparent: true,
      clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    })),
    windowGlass: applySmoke(new THREE.MeshPhysicalMaterial({
      color: 0x0b1018, roughness: 0.04, metalness: 0.0,
      opacity: 0.35, transparent: true, clearcoat: 1.0, envMapIntensity: 1.2,
    })),

    exitGreen: applySmoke(new THREE.MeshStandardMaterial({
      color: 0x0a1a10, emissive: new THREE.Color(0x2ee878), emissiveIntensity: 5.0, roughness: 0.5,
    })),
    exitWhite: applySmoke(new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xd8fff0), emissiveIntensity: 2.2, roughness: 0.5,
    })),
    lampWarm: applySmoke(new THREE.MeshStandardMaterial({
      color: 0x2a2016, emissive: new THREE.Color(0xffc07a), emissiveIntensity: 3.0, roughness: 0.6,
    })),
    beaconRed: applySmoke(new THREE.MeshStandardMaterial({
      color: 0x2a0606, emissive: new THREE.Color(0xff3a22), emissiveIntensity: 7.0, roughness: 0.35,
    })),
    beaconBlue: applySmoke(new THREE.MeshStandardMaterial({
      color: 0x05102a, emissive: new THREE.Color(0x4a8bff), emissiveIntensity: 6.5, roughness: 0.35,
    })),
    hudGauge: applySmoke(new THREE.MeshStandardMaterial({
      color: 0x101416, emissive: new THREE.Color(0x36ff9a), emissiveIntensity: 1.6, roughness: 0.4,
    })),

    plasticRed: std(T.paintedJoinery([0.55, 0.09, 0.09]), { roughness: 0.38, normalScale: nx(0.3) }),
    plasticBlue: std(T.paintedJoinery([0.12, 0.24, 0.52]), { roughness: 0.38, normalScale: nx(0.3) }),
    plasticYellow: std(T.paintedJoinery([0.78, 0.60, 0.08]), { roughness: 0.4, normalScale: nx(0.3) }),
    plasticPink: std(T.paintedJoinery([0.80, 0.42, 0.55]), { roughness: 0.42, normalScale: nx(0.3) }),
    plasticBlack: std(T.paintedJoinery([0.055, 0.055, 0.06]), { roughness: 0.45, normalScale: nx(0.3) }),
    plasticWhite: std(T.paintedJoinery([0.84, 0.84, 0.85]), { roughness: 0.42, normalScale: nx(0.3) }),

    contactShadow: new THREE.MeshBasicMaterial({
      map: T.contactShadowTexture(), transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.NormalBlending, color: 0x000000,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  };
  return M;
}

export function materials() {
  return M || buildMaterials();
}
