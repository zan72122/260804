import * as THREE from 'three';

export type TerrainKind = 'sandflat' | 'ridge' | 'canyon';
export type BuildingKind = 'house' | 'lighthouse' | 'hospital' | 'lab' | 'antenna' | 'school';

export interface PlaceDef {
  /** Short label is never shown to the player - kept for authoring clarity only. */
  id: string;
  buildings: BuildingKind[];
  /** ground tint */
  tint: number;
  /** 0 = flat sandy cay, 1 = tall rocky island */
  relief: number;
}

export interface RouteDef {
  id: string;
  a: PlaceDef;
  b: PlaceDef;
  terrain: TerrainKind;
  /** map-space positions (x, z) on the chart plane */
  mapA: [number, number];
  mapB: [number, number];
  /** lateral wander of the seabed route, in world units */
  wander: [number, number, number];
  seed: number;
}

/** Total length of the playable seabed route, in metres. */
export const ROUTE_LENGTH = 380;
/** Nominal water depth at the middle of the route. */
export const BASE_DEPTH = 52;

export const ROUTES: RouteDef[] = [
  {
    id: 'harbour-lightisle',
    a: { id: 'harbour-town', buildings: ['house', 'house', 'hospital', 'antenna', 'school'], tint: 0x9fb28a, relief: 0.35 },
    b: { id: 'light-isle', buildings: ['lighthouse', 'house', 'house'], tint: 0xa8b48d, relief: 0.7 },
    terrain: 'sandflat',
    mapA: [-30, 12],
    mapB: [26, -14],
    wander: [10, -14, 6],
    seed: 11,
  },
  {
    id: 'lighthouse-lab',
    a: { id: 'cape-light', buildings: ['lighthouse', 'house', 'antenna'], tint: 0x94a884, relief: 0.85 },
    b: { id: 'research-isle', buildings: ['lab', 'lab', 'antenna', 'house'], tint: 0x8fa591, relief: 0.5 },
    terrain: 'ridge',
    mapA: [-24, -18],
    mapB: [30, 16],
    wander: [-16, 12, -8],
    seed: 23,
  },
  {
    id: 'mountain-city',
    a: { id: 'mountain-isle', buildings: ['house', 'house', 'lighthouse', 'school'], tint: 0x86a07c, relief: 1 },
    b: { id: 'bay-city', buildings: ['hospital', 'antenna', 'house', 'house', 'lab'], tint: 0xa3ae8c, relief: 0.25 },
    mapA: [-32, -4],
    mapB: [30, 6],
    terrain: 'canyon',
    wander: [-8, 18, -12],
    seed: 37,
  },
];

export interface RovDef {
  id: string;
  /** primary body colour */
  body: number;
  frame: number;
  /** 'boxy' work-class ROV vs 'torpedo' survey ROV */
  shape: 'boxy' | 'torpedo';
  lampCount: number;
}

export const ROVS: RovDef[] = [
  { id: 'kani', body: 0xf7b520, frame: 0x2b3136, shape: 'boxy', lampCount: 2 },
  { id: 'iruka', body: 0xe9eef2, frame: 0xd8622f, shape: 'torpedo', lampCount: 3 },
];

export interface CableDef {
  id: string;
  /** polyethylene jacket base */
  jacket: number;
  /** helical marker stripe - this is what the player actually picks */
  stripe: number;
  /** glow colour used for the finished data-pulse */
  glow: number;
}

export const CABLES: CableDef[] = [
  { id: 'kiiro', jacket: 0x22262a, stripe: 0xffc93c, glow: 0xffd873 },
  { id: 'mizuiro', jacket: 0x1d2a30, stripe: 0x46d8e0, glow: 0x8bf0f5 },
  { id: 'momoiro', jacket: 0x2a2026, stripe: 0xff86b8, glow: 0xffb2d4 },
];

export interface DecorDef {
  id: string;
  accent: number;
  lamp: number;
  /** draw little stars on the ROV / ship trim */
  stars: boolean;
  rainbow: boolean;
}

export const DECORS: DecorDef[] = [
  { id: 'work', accent: 0xf7b520, lamp: 0xfff2d0, stars: false, rainbow: false },
  { id: 'pink', accent: 0xff7ab0, lamp: 0xffe6f2, stars: true, rainbow: false },
  { id: 'rainbow', accent: 0x6fd6ff, lamp: 0xf2fbff, stars: true, rainbow: true },
];

export interface Selection {
  routeIndex: number;
  rovIndex: number;
  cableIndex: number;
  decorIndex: number;
}

export const defaultSelection = (): Selection => ({ routeIndex: 0, rovIndex: 0, cableIndex: 0, decorIndex: 0 });

/**
 * The single spline every subsystem agrees on: the ship sails above it, the
 * cable lands on it, the plough follows it and the finished line glows along
 * it. Keeping one curve is what makes "one cable, ship to seabed" hold up.
 */
export function buildRouteCurve(def: RouteDef): THREE.CatmullRomCurve3 {
  const L = ROUTE_LENGTH;
  const [w0, w1, w2] = def.wander;
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(L * 0.25, 0, w0),
    new THREE.Vector3(L * 0.5, 0, w1),
    new THREE.Vector3(L * 0.75, 0, w2),
    new THREE.Vector3(L, 0, 0),
  ];
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  return c;
}
