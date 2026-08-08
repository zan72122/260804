import { Color } from 'three';

/**
 * One controlled colour set for the whole diorama: cold indigo river, lacquer
 * black boat, ember orange fire. Everything else is a tint of these three.
 */
export const PAL = {
  nightSkyTop: new Color('#02030a'),
  nightSkyLow: new Color('#080e20'),
  duskSkyTop: new Color('#1b2350'),
  duskSkyLow: new Color('#8a5a52'),
  duskSkyGlow: new Color('#e08a4a'),

  waterDeep: new Color('#02040d'),
  waterShallow: new Color('#081227'),
  waterRim: new Color('#223b60'),

  fireCore: new Color('#fff3c4'),
  fireMid: new Color('#ff9d33'),
  fireEdge: new Color('#e0491a'),
  ember: new Color('#ff7a24'),

  moon: new Color('#bcd2ff'),
  mist: new Color('#243a5c'),

  hullLacquer: new Color('#14161c'),
  hullWood: new Color('#1e150d'),
  hullWoodLight: new Color('#3d2a1a'),
  bamboo: new Color('#8a7b48'),
  basketStraw: new Color('#7d5c30'),
  rope: new Color('#8a7046'),
  ropeWet: new Color('#4b3a22'),
  iron: new Color('#2b2a2c'),

  featherBase: new Color('#0d0f14'),
  featherSheen: new Color('#1f3b3a'),
  featherThroat: new Color('#c9b795'),
  beak: new Color('#c8a468'),
  eye: new Color('#ffb43a'),

  robe: new Color('#171c2c'),
  robeTrim: new Color('#2b3450'),
  strawSkirt: new Color('#8a6836'),
  skin: new Color('#c08e64'),
} as const;
