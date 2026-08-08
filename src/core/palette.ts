import { Color } from 'three';

/**
 * One controlled colour set for the whole diorama: cold indigo river, lacquer
 * black boat, ember orange fire. Everything else is a tint of these three.
 */
export const PAL = {
  nightSkyTop: new Color('#02030a'),
  nightSkyLow: new Color('#080e20'),
  duskSkyTop: new Color('#171c48'),
  duskSkyLow: new Color('#b2603e'),
  duskSkyGlow: new Color('#f0994a'),

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
  hullWood: new Color('#1b160f'),
  hullWoodLight: new Color('#3a2d20'),
  bamboo: new Color('#8a7b48'),
  basketStraw: new Color('#7d5c30'),
  rope: new Color('#8a7046'),
  ropeWet: new Color('#4b3a22'),
  iron: new Color('#2b2a2c'),

  featherBase: new Color('#121319'),
  featherSheen: new Color('#1f3b3a'),
  featherThroat: new Color('#9a8c70'),
  beak: new Color('#a58656'),
  eye: new Color('#ffb43a'),

  robe: new Color('#171c2c'),
  robeTrim: new Color('#2b3450'),
  strawSkirt: new Color('#8a6836'),
  skin: new Color('#c08e64'),
} as const;
