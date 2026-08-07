// Shared material library.
//
// Materials are cached and reused so the whole market runs on a couple of
// dozen draw-call states. Each one is tuned for how the real thing responds to
// light: waxed counter wood is semi-glossy with a bump, terracotta is matte and
// porous, brass is a rough metal that never goes mirror-clean, glass refracts.

import * as THREE from 'three';
import * as TEX from './textures.js';

const cache = new Map();
const get = (key, build) => {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
};

function setRepeat(maps, rx, ry) {
  for (const m of Object.values(maps)) {
    if (m && m.isTexture) { m.wrapS = m.wrapT = THREE.RepeatWrapping; m.repeat.set(rx, ry); }
  }
}

/** Waxed hardwood counter — the surface the whole game is played on. */
export function counterWood() {
  return get('counterWood', () => {
    const t = TEX.wood({ base: 0xb08453, dark: 0x53381d, planks: 5, rings: 20, wear: 0.85, seed: 21 });
    return new THREE.MeshStandardMaterial({
      map: t.map, roughnessMap: t.roughnessMap, bumpMap: t.bumpMap,
      bumpScale: 0.35, roughness: 1.0, metalness: 0.0, color: 0xffffff,
    });
  });
}

/** Rough sawn pine — crates, shelving, stall frames. */
export function crateWood(tone = 0) {
  return get(`crateWood${tone}`, () => {
    const t = TEX.wood({
      base: [0xc0a173, 0x9d7f56, 0xa98b60][tone] ?? 0xc0a173,
      dark: 0x604222, planks: 3, rings: 14, wear: 1.0, seed: 33 + tone,
    });
    return new THREE.MeshStandardMaterial({
      map: t.map, roughnessMap: t.roughnessMap, bumpMap: t.bumpMap,
      bumpScale: 0.5, roughness: 1.0, metalness: 0.0,
    });
  });
}

/** Dark stained structural timber — posts, beams, the stall's skeleton. */
export function darkWood() {
  return get('darkWood', () => {
    const t = TEX.wood({ base: 0x6b4a2c, dark: 0x2c1c0f, planks: 2, rings: 12, wear: 0.7, seed: 51 });
    return new THREE.MeshStandardMaterial({
      map: t.map, roughnessMap: t.roughnessMap, bumpMap: t.bumpMap,
      bumpScale: 0.4, roughness: 0.95, metalness: 0.0,
    });
  });
}

/** Painted wood with chipping — signage, shutters, cart panels. */
export function paintedWood(color = 0x2f6b64, seed = 5) {
  return get(`painted${color}${seed}`, () => {
    const t = TEX.wood({ base: color, dark: 0x3a2a1c, planks: 3, rings: 10, wear: 1.2, seed });
    return new THREE.MeshStandardMaterial({
      map: t.map, roughnessMap: t.roughnessMap, bumpMap: t.bumpMap,
      bumpScale: 0.3, roughness: 0.8, metalness: 0.0,
    });
  });
}

/** Brass / bronze with tarnish — pot rims, lantern frames, handles. */
export function brass(dark = false) {
  return get(`brass${dark}`, () => new THREE.MeshStandardMaterial({
    color: dark ? 0x8a6a2f : 0xc79a4a,
    metalness: 1.0, roughness: 0.44,
    roughnessMap: TEX.grunge({ scale: 7, seed: 61, lo: 0.3, hi: 0.85 }),
  }));
}

/** Scuffed steel — pans, knives, hardware. */
export function steel(rough = 0.38) {
  return get(`steel${rough}`, () => new THREE.MeshStandardMaterial({
    color: 0xb9bcc0, metalness: 1.0, roughness: rough,
    roughnessMap: TEX.grunge({ scale: 9, seed: 71, lo: 0.45, hi: 1.0 }),
  }));
}

/** Blackened cast iron — stoves, brackets, lamp posts. */
export function iron() {
  return get('iron', () => new THREE.MeshStandardMaterial({
    color: 0x2a2724, metalness: 0.85, roughness: 0.72,
    roughnessMap: TEX.grunge({ scale: 6, seed: 81, lo: 0.5, hi: 1.0 }),
  }));
}

/** Glazed ceramic — plates, bowls, cups. Clearcoat gives the glaze sheen. */
export function ceramic(color = 0xf3ede2, rough = 0.22) {
  return get(`ceramic${color}${rough}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0,
    clearcoat: 0.85, clearcoatRoughness: 0.14,
    roughnessMap: TEX.grunge({ scale: 12, seed: 91, lo: 0.7, hi: 1.0 }),
  }));
}

/** Unglazed terracotta — pots, tiles, planters. */
export function terracotta(color = 0xb2603c) {
  return get(`terra${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.95, metalness: 0,
    roughnessMap: TEX.grunge({ scale: 10, seed: 101, lo: 0.8, hi: 1 }),
    bumpMap: TEX.grunge({ scale: 26, seed: 103 }), bumpScale: 0.06,
  }));
}

/**
 * Clear glass.
 *
 * Deliberately alpha-blended rather than `transmission`: a single transmissive
 * material in the frame makes three.js re-render the whole scene into a
 * transmission target every frame, and there are jars, glasses and ice all over
 * this board. Heavy clearcoat plus a tight roughness gets the same read — a
 * bright rim, a dark body, the label showing through — for one draw call.
 */
export function glass(color = 0xffffff) {
  return get(`glass${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.05, metalness: 0,
    transparent: true, opacity: 0.22,
    clearcoat: 0.9, clearcoatRoughness: 0.05,
    side: THREE.DoubleSide, depthWrite: false,
  }));
}

/** Ice: like glass but frostier and a touch more opaque. */
export function ice() {
  return get('ice', () => new THREE.MeshPhysicalMaterial({
    color: 0xdeeef4, roughness: 0.16, metalness: 0,
    transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.2,
  }));
}

/** Liquid inside glass — dense, slightly glossy, reads through the vessel. */
export function liquid(color = 0xf2b134) {
  return get(`liquid${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.12, metalness: 0,
    transparent: true, opacity: 0.88,
    clearcoat: 0.7, clearcoatRoughness: 0.15,
  }));
}

/** Edible surfaces: soft, matte, with a hint of subsurface warmth. */
export function food(color, o = {}) {
  const { rough = 0.55, sheen = 0.0, clearcoat = 0.0, seed = 0 } = o;
  return get(`food${color}${rough}${sheen}${clearcoat}${seed}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0,
    sheen, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xffffff),
    clearcoat, clearcoatRoughness: 0.3,
    roughnessMap: seed ? TEX.grunge({ scale: 14, seed: 130 + seed, lo: 0.72, hi: 1.05 }) : null,
  }));
}

/** Woven cloth — awnings, aprons, sacks. */
export function awning(a, b, seed = 13) {
  return get(`awning${a}${b}${seed}`, () => {
    const t = TEX.stripes({ a, b, count: 8, seed });
    const m = new THREE.MeshStandardMaterial({
      map: t.map, bumpMap: t.bumpMap, bumpScale: 0.15,
      roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
    });
    return m;
  });
}

/** Plain sackcloth / burlap. */
export function sackcloth(color = 0xcbb187) {
  return get(`sack${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 1.0, metalness: 0,
    bumpMap: TEX.grunge({ scale: 40, seed: 141 }), bumpScale: 0.12,
    roughnessMap: TEX.grunge({ scale: 8, seed: 143, lo: 0.85, hi: 1 }),
  }));
}

/** Plaza paving. `tiles` sets how many cobble cells span the plane. */
export function paving(tiles = 40, base = 0x8b8378) {
  return get(`paving${tiles}${base}`, () => {
    const t = TEX.cobble({ base, seed: 3 });
    const map = t.map.clone(), bumpMap = t.bumpMap.clone(), roughnessMap = t.roughnessMap.clone();
    for (const m of [map, bumpMap, roughnessMap]) { m.needsUpdate = true; m.repeat.set(tiles, tiles); }
    return new THREE.MeshStandardMaterial({
      map, bumpMap, roughnessMap, bumpScale: 0.6, roughness: 1, metalness: 0,
    });
  });
}

/** Rendered wall for near/mid buildings and garden walls. */
export function wall(color = 0xd9c3a2, repeat = 2, weather = 0.7) {
  return get(`wall${color}${repeat}${weather}`, () => {
    const t = TEX.plaster({ base: color, weather, seed: 11 + repeat });
    const map = t.map.clone(), roughnessMap = t.roughnessMap.clone(), bumpMap = t.bumpMap.clone();
    for (const m of [map, roughnessMap, bumpMap]) { m.needsUpdate = true; m.repeat.set(repeat, repeat); }
    return new THREE.MeshStandardMaterial({ map, roughnessMap, bumpMap, bumpScale: 0.25, roughness: 1 });
  });
}

/** Distant building block with lit windows baked into the emissive map. */
export function facadeMat(o = {}) {
  const key = `facade${JSON.stringify(o)}`;
  return get(key, () => {
    const t = TEX.facade(o);
    const map = t.map.clone(), emissiveMap = t.emissiveMap.clone();
    const [rx, ry] = o.repeat || [1, 1];
    for (const m of [map, emissiveMap]) { m.needsUpdate = true; m.repeat.set(rx, ry); }
    return new THREE.MeshStandardMaterial({
      map, emissiveMap,
      emissive: new THREE.Color(o.emissive ?? 0xffb867),
      emissiveIntensity: o.emissiveIntensity ?? 1.0,
      roughness: 1, metalness: 0,
    });
  });
}

/** Roof tiles. */
export function roofTile(color = 0x9c5236) {
  return get(`roof${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.95, metalness: 0,
    bumpMap: TEX.grunge({ scale: 20, seed: 151 }), bumpScale: 0.2,
    roughnessMap: TEX.grunge({ scale: 5, seed: 153, lo: 0.75, hi: 1 }),
  }));
}

/** Paper — tickets, price tags, wrapping. */
export function paper(color = 0xf0e4cb) {
  return get(`paper${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
    bumpMap: TEX.grunge({ scale: 30, seed: 161 }), bumpScale: 0.03,
  }));
}

/** Additive glow used for lamp globes, merge flashes and light shafts. */
export function emissive(color = 0xffc98a, intensity = 3) {
  return get(`emis${color}${intensity}`, () => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    toneMapped: false,
  }));
}

/**
 * Additive halo around a light source. This is the game's bloom: a camera
 * facing sprite of scattered light, so lamps glow without a post chain.
 */
export function halo(color = 0xffc98a, strength = 1) {
  return get(`halo${color}${strength}`, () => new THREE.SpriteMaterial({
    map: TEX.sprite('glow'),
    color: new THREE.Color(color).multiplyScalar(strength),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: true,
  }));
}

/** Leaves/greens — thin, waxy, double sided. */
export function leaf(color = 0x4f7a30) {
  return get(`leaf${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.58, metalness: 0, side: THREE.DoubleSide,
    sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xbfe08a),
    clearcoat: 0.25, clearcoatRoughness: 0.4,
  }));
}

export function skin(color = 0xd8a583) {
  return get(`skin${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.68, metalness: 0, sheen: 0.25,
    sheenColor: new THREE.Color(0xffd9c4),
  }));
}

export function cloth(color = 0x3f5a78, rough = 0.95) {
  return get(`cloth${color}${rough}`, () => new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: 0,
    bumpMap: TEX.grunge({ scale: 34, seed: 171 }), bumpScale: 0.05,
  }));
}

export function hair(color = 0x2b1d16) {
  return get(`hair${color}`, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0,
  }));
}

/** Drop every cached material (used when tearing the scene down). */
export function disposeAll() {
  for (const m of cache.values()) m.dispose?.();
  cache.clear();
}
